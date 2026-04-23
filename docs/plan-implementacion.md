# Boti — Plan de Implementación v1.0

## Decisión: Autenticación

**No usar Firebase.** Análisis técnico confirma que es overkill para B2B de 100-1000 usuarios.

| Criterio | Firebase | JWT propio (actual) |
|----------|----------|---------------------|
| Bloqueo de tenant completo | ❌ No nativo, requiere iterar usuarios | ✅ Un UPDATE en Postgres |
| Trial de 15 días | ❌ No existe, lógica 100% custom igual | ✅ Campo `trialEndsAt` en Subscription |
| Revocación instantánea de sesión | ⚠️ Posible pero complejo | ✅ Refresh token en Redis → delete key |
| Sincronización con Postgres/Prisma | ❌ Doble fuente de verdad, usuarios huérfanos | ✅ Una sola fuente |
| Complejidad operativa | Alta | Baja |
| Costo | $0 (pero dependencia externa) | $0 |

**Decisión: mantener JWT propio + agregar Refresh Tokens en Redis** para poder revocar sesiones al bloquear usuarios o tenants.

---

## Arquitectura Target

```
Super Admin (nosotros)
  └── Tenant (empresa cliente)
        ├── Subscription (plan + trial + cuota)
        ├── Admin del tenant (1)
        └── Operators (N, según plan)
              └── WhatsApp Lines, Clients, Messages
```

**Roles:**
- `SUPER_ADMIN` — nosotros, acceso total, gestión de tenants
- `ADMIN` — dueño del negocio cliente, gestiona su tenant
- `OPERATOR` — empleado del cliente, solo inbox

---

## Fase 1 — Fundación (Semana 1-2)
> Objetivo: multi-tenancy + auth robusto + trial. Sin esto no hay producto.

### 1.1 Schema de base de datos

**Modelos nuevos:**

```prisma
model Tenant {
  id           String         @id @default(uuid())
  name         String
  slug         String         @unique
  createdAt    DateTime       @default(now())
  subscription Subscription?
  users        User[]
  lines        WhatsAppLine[]
  clients      Client[]
  messages     Message[]
  auditLogs    AuditLog[]
}

model Plan {
  id                   String         @id @default(uuid())
  name                 String         @unique  // "basico" | "growth" | "enterprise"
  maxLines             Int
  maxOperators         Int
  maxMessagesPerMonth  Int            // -1 = ilimitado
  priceGs              Int
  subscriptions        Subscription[]
}

model Subscription {
  id             String    @id @default(uuid())
  tenantId       String    @unique
  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  planId         String
  plan           Plan      @relation(fields: [planId], references: [id])
  status         String    @default("TRIAL")  // TRIAL | ACTIVE | BLOCKED | CANCELLED
  trialEndsAt    DateTime
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  messagesUsed   Int       @default(0)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Modelos modificados — agregar `tenantId`:**
- `User` → `tenantId String`, `role` agrega `SUPER_ADMIN`
- `WhatsAppLine` → `tenantId String`
- `Client` → `tenantId String`
- `Message` → `tenantId String`
- `AuditLog` → `tenantId String?`
- `ConversationContext` → `tenantId String`

**Seed inicial:**
```ts
// Plan "growth" como seed del primer tenant (nosotros para pruebas)
// Super admin: superadmin@boti.com
// Plans: basico, growth, enterprise con sus límites
```

---

### 1.2 Auth — Refresh Tokens + Revocación

**Flujo de login nuevo:**
1. POST `/api/auth/login` → valida credenciales + verifica tenant activo
2. Genera `accessToken` (JWT, 15 min) + `refreshToken` (UUID, 7 días, guardado en DB)
3. Frontend guarda `accessToken` en memoria y `refreshToken` en `httpOnly cookie`
4. Cada request usa `accessToken`; al expirar, llama `POST /api/auth/refresh`
5. Para bloquear: eliminar todos los `RefreshToken` del usuario/tenant → sesiones mueren en max 15 min

**Endpoints nuevos:**
- `POST /api/auth/refresh` — recibe refreshToken, emite nuevo accessToken
- `POST /api/auth/logout` — elimina refreshToken del servidor
- `POST /api/auth/register` — registro de nuevo tenant (crea Tenant + Subscription TRIAL + User ADMIN)

**Middleware actualizado:**
```
authMiddleware → verifica accessToken → inyecta { userId, tenantId, role } en req
tenantMiddleware → verifica Subscription.status !== BLOCKED → si bloqueado, 403
```

**Bloqueo de tenant:**
```ts
// Para bloquear acceso inmediato:
await prisma.subscription.update({ where: { tenantId }, data: { status: 'BLOCKED' } });
await prisma.refreshToken.deleteMany({ where: { user: { tenantId } } });
// Próximo request de cualquier usuario del tenant → 403
```

---

### 1.3 Trial de 15 días

**Al registrarse:**
```ts
trialEndsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
status: 'TRIAL'
```

**BullMQ cron diario (cada 24h):**
```ts
// Verificar trials vencidos → cambiar status a BLOCKED
const expired = await prisma.subscription.findMany({
  where: { status: 'TRIAL', trialEndsAt: { lt: new Date() } }
});
for (const sub of expired) {
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'BLOCKED' } });
  // Notificar al admin del tenant por email (futuro)
}
```

**El `tenantMiddleware` maneja el bloqueo automáticamente** — no hay código extra en cada endpoint.

---

### 1.4 Endpoints de gestión de tenants (Super Admin)

```
POST   /api/admin/tenants              — crear tenant con plan y trial
GET    /api/admin/tenants              — listar todos con status y consumo
GET    /api/admin/tenants/:id          — detalle de un tenant
PATCH  /api/admin/tenants/:id/block    — bloquear/desbloquear
PATCH  /api/admin/tenants/:id/plan     — cambiar de plan
GET    /api/admin/tenants/:id/usage    — consumo del mes actual
```

Todos requieren `role === SUPER_ADMIN`.

---

### 1.5 Multi-tenancy en queries existentes

Todas las queries del router pasan a filtrar por `tenantId`:

```ts
// Antes
const chats = await prisma.client.findMany({ ... })

// Después
const { tenantId } = (req as any).user
const chats = await prisma.client.findMany({ where: { tenantId }, ... })
```

Archivos a modificar: `router.ts` (todos los endpoints), `index.ts` (seed).

---

## Fase 2 — Gestión de Usuarios y Planes (Semana 3)
> Objetivo: que el admin del tenant pueda operar sin tocar la DB.

### 2.1 Endpoints de usuarios (por tenant)

```
GET    /api/users              — listar usuarios del tenant (ADMIN only)
POST   /api/users              — crear operador (ADMIN only, verifica límite del plan)
PUT    /api/users/:id          — editar nombre, rol, activar/desactivar
DELETE /api/users/:id          — eliminar (no puede eliminar al propio ADMIN)
POST   /api/users/:id/reset-password  — genera contraseña temporal
```

**Validaciones:**
- Al crear: verificar `users.count < plan.maxOperators`
- Email único dentro del tenant
- No puede haber dos ADMIN por tenant
- Password mínimo 8 caracteres (Zod)

### 2.2 Endpoints de suscripción (para el tenant)

```
GET    /api/subscription        — plan actual, días de trial, mensajes usados/disponibles
GET    /api/subscription/usage  — historial de consumo diario del mes
```

### 2.3 Cuotas de mensajes IA

**En `AIServiceAdapter` — antes de llamar a la IA:**
```ts
const sub = await prisma.subscription.findUnique({ where: { tenantId } });
if (sub.plan.maxMessagesPerMonth !== -1 && sub.messagesUsed >= sub.plan.maxMessagesPerMonth) {
  // Guardar el mensaje entrante pero no responder con IA
  await notifyQuotaExceeded(tenantId);
  return null;
}
await prisma.subscription.update({
  where: { tenantId },
  data: { messagesUsed: { increment: 1 } }
});
```

**BullMQ cron mensual (día 1 de cada mes):**
```ts
await prisma.subscription.updateMany({
  where: { status: { in: ['ACTIVE', 'TRIAL'] } },
  data: { messagesUsed: 0, currentPeriodStart: new Date() }
});
```

### 2.4 Seguridad HTTP

- `express-rate-limit`: 5 intentos/min en login, 100 req/min global
- Validación Zod en todos los endpoints de escritura
- Eliminar fallback del JWT secret → crash al arrancar si no está definido
- Reemplazar `console.log/error` por Winston logger

---

## Fase 3 — Frontend (Semana 4)
> Objetivo: que todo lo anterior sea operable desde la UI.

### 3.1 Página de registro público `/register`

Flujo para nuevo cliente:
1. Formulario: nombre empresa + nombre + email + password
2. POST `/api/auth/register` → crea tenant + trial de 15 días
3. Redirige al dashboard con banner de trial ("Te quedan 15 días gratis")

### 3.2 Banner de trial y cuota

**Visible en todas las páginas (en el Header):**
- Si `status === 'TRIAL'`: "🕐 Trial: te quedan N días — Activá tu plan"
- Si `messagesUsed >= 80% del límite`: "⚠️ Usaste el 80% de tus mensajes IA este mes"
- Si `status === 'BLOCKED'`: banner rojo full-width con link a contacto

### 3.3 Página `/settings/users`

- Tabla: nombre, email, rol, estado (activo/inactivo), acciones
- Modal "Nuevo Operador": nombre, email, password temporal, rol
- Botones: editar, activar/desactivar, eliminar
- Indicador: "X/N operadores usados según tu plan"

### 3.4 Página `/settings`

- Nombre del negocio (editable)
- Plan activo con fecha de renovación
- Barra de progreso: mensajes IA usados del mes
- Botón "Cambiar plan" → modal con comparación de planes
- Botón "Contactar soporte"

### 3.5 Página `/subscription`

- Detalle del plan: límites, precio, fecha de próxima renovación
- Consumo del mes: mensajes IA, líneas activas, operadores activos
- Historial de consumo diario (gráfico de barras, últimos 30 días)
- Para trial: countdown prominente con CTA de upgrade

### 3.6 Control de acceso por rol

```tsx
// En App.tsx — rutas protegidas por rol
<Route path="/ai-config" element={<RequireRole role="ADMIN"><AIConfiguration /></RequireRole>} />
<Route path="/connections" element={<RequireRole role="ADMIN"><WhatsAppConnections /></RequireRole>} />
<Route path="/settings" element={<RequireRole role="ADMIN"><Settings /></RequireRole>} />
// /messages accesible para ADMIN y OPERATOR
```

### 3.7 Panel Super Admin `/admin` (ruta separada)

- Lista de todos los tenants con plan, status, consumo
- Botones: bloquear/desbloquear, cambiar plan
- Solo accesible con `role === SUPER_ADMIN`

---

## Fase 4 — Onboarding y Pulido (Semana 5)

### 4.1 Checklist de primer uso

Al entrar por primera vez (sin líneas ni mensajes):
```
□ Conectá tu primer número de WhatsApp    → /connections
□ Configurá la personalidad del bot       → /ai-config
□ Agregá el contexto de tu negocio        → /ai-config
□ Invitá a tu primer operador (opcional)  → /settings/users
```

Desaparece cuando todos los pasos están completos.

### 4.2 Plantillas de system prompt

Al crear o editar el prompt en AIConfiguration, opción "Usar plantilla":
- 🛍️ Ventas / tienda online
- 🏥 Clínica / consultorio
- 🏠 Inmobiliaria
- 🎓 Academia / cursos
- 💼 Soporte técnico

### 4.3 Error boundaries y estados vacíos

- Error boundary global en App.tsx
- Cada página con estado de error explícito (no pantalla en blanco)
- Confirmación en acciones destructivas (desconectar línea, eliminar usuario)

---

## Resumen de Fases

| Fase | Duración | Entregable |
|------|----------|------------|
| 1 — Fundación | 2 semanas | Multi-tenancy + Auth + Trial funcional |
| 2 — Usuarios y Planes | 1 semana | CRUD usuarios, cuotas, seguridad HTTP |
| 3 — Frontend | 1 semana | Registro, settings, panel admin, roles UI |
| 4 — Onboarding | 1 semana | Checklist, plantillas, pulido UX |

**Total estimado: 5 semanas para un producto lanzable con clientes pagos.**

---

## Orden de implementación dentro de cada fase

### Fase 1 (hacer en este orden estricto)
1. Schema Prisma → migraciones
2. Seed de planes (básico/growth/enterprise) y super admin
3. RefreshToken + middleware de auth actualizado
4. `tenantMiddleware` con verificación de status
5. Endpoint `/api/auth/register`
6. Endpoint `/api/admin/tenants` (CRUD básico)
7. Agregar `tenantId` a todas las queries del router
8. BullMQ cron para expirar trials

### Fase 2
1. Rate limiting + Zod en todos los endpoints
2. Endpoints `/api/users` CRUD
3. Validación de límites al crear líneas y usuarios
4. Contador de mensajes IA en AIServiceAdapter
5. Cron de reset mensual de contadores

### Fase 3
1. Página `/register` pública
2. Banner de trial en Header
3. Control de acceso por rol en rutas
4. Página `/settings/users`
5. Página `/settings`
6. Página `/subscription`
7. Panel `/admin` (super admin)

### Fase 4
1. Checklist de onboarding
2. Plantillas de system prompt
3. Error boundaries
4. Estados vacíos y confirmaciones

---

## Variables de entorno nuevas requeridas

```env
# .env additions
SUPER_ADMIN_EMAIL=superadmin@boti.com
SUPER_ADMIN_PASSWORD=...          # Fuerte, no default
ACCESS_TOKEN_EXPIRY=15m           # Corto para revocación rápida
REFRESH_TOKEN_EXPIRY_DAYS=7
TRIAL_DAYS=15
```

---

## Lo que NO está en este plan (backlog post-lanzamiento)

- Mensajes multimedia (upload + storage)
- Cobro automático via Bancard
- Exportación de conversaciones
- Redis PubSub para WebSocket multi-réplica
- Métricas Prometheus
- Backups automáticos de Postgres
