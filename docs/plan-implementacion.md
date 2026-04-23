# Boti — Plan de Implementación Definitivo

## Decisión de Autenticación: NO usar Firebase

| Criterio | Firebase | JWT propio (actual) |
|----------|----------|---------------------|
| Bloqueo de tenant completo | ❌ No nativo, requiere iterar usuarios | ✅ Un UPDATE en Postgres |
| Trial de 15 días | ❌ No existe, lógica 100% custom igual | ✅ Campo `trialEndsAt` en Subscription |
| Revocación de sesión | ⚠️ Complejo | ✅ Delete RefreshToken en Redis/DB |
| Sincronización con Prisma | ❌ Doble fuente de verdad | ✅ Una sola fuente |
| Dependencia externa | Alta | Ninguna |

**Solución: JWT propio + Refresh Tokens en DB** (access token 15 min, refresh 7 días).
Revocación instantánea borrando los RefreshToken del tenant/usuario.

---

## Mapa de Dependencias

```
FASE 1 (Schema + ENV)
  └─> FASE 2 (Auth + Registro)
        └─> FASE 3 (Multi-tenancy en queries)
              ├─> FASE 4 (Planes y cuotas)
              │     └─> FASE 5 (Trial + Crons)
              ├─> FASE 6 (CRUD usuarios + Seguridad HTTP)
              └─> FASE 7 (Frontend)
                    └─> FASE 8 (Onboarding + Deuda técnica)
                          └─> FASE 9 (Infraestructura K8s)
```

---

## FASE 1 — Fundaciones: Schema, ENV y Seed
**Duración estimada: 1 día**

### 1.1 Nuevos modelos en Prisma
Archivo: `apps/backend/prisma/schema.prisma`

**Modelos nuevos:**

```prisma
model Plan {
  id                  String         @id @default(uuid())
  name                String         // "Basico" | "Growth" | "Enterprise"
  maxLines            Int
  maxOperators        Int
  maxMessagesPerMonth Int            // -1 = ilimitado
  priceGs             Int
  createdAt           DateTime       @default(now())
  subscriptions       Subscription[]
}

model Tenant {
  id           String         @id @default(uuid())
  name         String
  slug         String         @unique
  status       String         @default("TRIAL")
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  users        User[]
  lines        WhatsAppLine[]
  clients      Client[]
  auditLogs    AuditLog[]
  subscription Subscription?
}

model Subscription {
  id                 String    @id @default(uuid())
  tenantId           String    @unique
  tenant             Tenant    @relation(fields: [tenantId], references: [id])
  planId             String
  plan               Plan      @relation(fields: [planId], references: [id])
  status             String    @default("TRIAL") // TRIAL | ACTIVE | BLOCKED | CANCELLED
  trialEndsAt        DateTime?
  currentPeriodStart DateTime  @default(now())
  currentPeriodEnd   DateTime
  messagesUsed       Int       @default(0)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenantId  String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

**Modelos existentes — cambios:**
- `User`: agregar `tenantId String`, `tenant Tenant @relation(...)`, rol agrega `SUPER_ADMIN`, agregar `refreshTokens RefreshToken[]`
- `WhatsAppLine`: agregar `tenantId String`, `tenant Tenant @relation(...)`
- `Client`: cambiar `phone @unique` → `@@unique([tenantId, phone])`, agregar `tenantId String`. **Atención:** Message.client pasa a referenciar `Client.id` (UUID) en vez de `clientPhone` — la FK cambia. La migración debe incluir `UPDATE Message SET clientId = (SELECT id FROM Client WHERE phone = Message.clientPhone LIMIT 1)`.
- `Message`: agregar `tenantId String`, cambiar `clientPhone String` por `clientId String`, `client Client @relation(fields: [clientId], references: [id])`
- `ConversationContext`: agregar `tenantId String`, ajustar `@@unique([tenantId, lineId, clientPhone])`
- `AuditLog`: agregar `tenantId String?`

### 1.2 Variables de entorno nuevas
Archivo: `apps/backend/.env.example`

```env
SUPER_ADMIN_EMAIL=superadmin@boti.com
SUPER_ADMIN_PASSWORD=change_me_on_first_deploy
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=7
TRIAL_DAYS=15
```

### 1.3 Validación de ENV al arranque
Archivo: `apps/backend/src/lib/env.ts` (nuevo)

Función `validateEnv()` que verifica al iniciar: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (rechazar si es el valor default `boti-super-secret-key`), `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`. Si alguna falta → `process.exit(1)` con mensaje claro.

### 1.4 Seed de planes y SUPER_ADMIN
Archivo: `apps/backend/prisma/seed.ts` (nuevo)

Seed idempotente (upsert) que crea:
1. Plan **Básico**: 1 línea, 1 operador, 500 msgs/mes, Gs. 150.000
2. Plan **Growth**: 5 líneas, 5 operadores, 3.000 msgs/mes, Gs. 380.000
3. Plan **Enterprise**: 999 líneas, 999 operadores, -1 msgs (ilimitado), Gs. 1.500.000
4. Tenant `"Boti Internal"` + User `SUPER_ADMIN` usando las vars de ENV

Agregar en `package.json` del backend: `"prisma": { "seed": "tsx prisma/seed.ts" }`

### 1.5 Actualizar start.sh
Cambiar `prisma db push` → `prisma migrate deploy`. Agregar `prisma db seed` posterior.
Generar la primera migración con: `npx prisma migrate dev --name add_multitenancy`

**✅ Criterio done Fase 1:**
- `prisma migrate dev` sin errores con el nuevo schema
- `prisma db seed` crea los 3 planes y el SUPER_ADMIN
- El backend falla con mensaje claro si `JWT_SECRET` no está definido

---

## FASE 2 — Auth Robusto: Refresh Tokens + Registro Público
**Duración estimada: 1.5 días**

### 2.1 Refactorizar AuthService
Archivo: `apps/backend/src/lib/AuthService.ts`

- `generateAccessToken({ userId, email, role, tenantId, tenantStatus })` — expira en `ACCESS_TOKEN_EXPIRY` (15m)
- `generateRefreshToken()` — retorna `crypto.randomUUID()`
- `verifyAccessToken(token)` — payload tipado o null; lanzar `TOKEN_EXPIRED` si expiró
- `saveRefreshToken(userId, tenantId, token)` — persiste en DB con `expiresAt = now + REFRESH_TOKEN_EXPIRY_DAYS`
- `rotateRefreshToken(oldToken)` — en una transacción: valida, borra el viejo, crea uno nuevo
- `revokeAllForTenant(tenantId)` — `deleteMany({ where: { tenantId } })`
- Eliminar el fallback `|| 'boti-super-secret-key'` en `JWT_SECRET`

### 2.2 Nuevos endpoints de auth
Archivo: `apps/backend/src/http/router.ts`

**POST /auth/login** (reemplazar actual):
- Incluir tenant + subscription en la query del usuario
- Generar access token (15m) + refresh token (7d)
- Responder: `{ accessToken, refreshToken, user: { id, email, name, role, tenantId } }`

**POST /auth/refresh** (nuevo):
- Recibe `refreshToken` en body
- Llama `rotateRefreshToken` → nuevo par de tokens
- Si falla: 401

**POST /auth/logout** (nuevo):
- `prisma.refreshToken.delete({ where: { token } })`
- 204 sin body

**POST /auth/register** (nuevo, público, sin authMiddleware):
- Validar con Zod: `{ companyName, name, email, password (min 8) }`
- En una transacción: crear Tenant → Subscription (TRIAL, `trialEndsAt = now + TRIAL_DAYS`) → User (ADMIN)
- Responder con el mismo formato que login

### 2.3 Actualizar authMiddleware
- Si el token expiró: 401 con `{ error: 'TOKEN_EXPIRED' }` (el frontend sabrá que debe refrescar)
- Adjuntar `req.user = { userId, email, role, tenantId, tenantStatus }`

### 2.4 apiClient.ts en el frontend
Archivo: `apps/frontend/src/lib/apiClient.ts`

- Access token en memoria + localStorage; refresh token en localStorage
- Si el server responde 401 `TOKEN_EXPIRED`: llamar `POST /api/auth/refresh` automáticamente → reintentar la request original
- Si el refresh falla: disparar `auth:unauthorized`
- Exportar `logout()` que llama `POST /api/auth/logout` antes de limpiar tokens

### 2.5 Actualizar Login.tsx y App.tsx
- `Login.tsx`: `onLogin(accessToken, refreshToken, user)`
- `App.tsx`: manejar los dos tokens; `handleLogout` llama `logout()` del apiClient

**✅ Criterio done Fase 2:**
- Login devuelve dos tokens; refresh funciona
- POST /auth/register crea Tenant + Subscription TRIAL + User ADMIN
- El frontend renueva el token automáticamente al expirar (sin que el usuario note nada)

---

## FASE 3 — Multi-tenancy: Middleware + Queries Filtradas
**Duración estimada: 2 días** ⚠️ Mayor superficie de cambio

### 3.1 Middlewares de tenant
Archivo: `apps/backend/src/http/middlewares/tenant.ts` (nuevo)

**`requireAuth`**: extrae JWT, verifica, pone `req.user` con tenantId.

**`requireTenant`** (después de requireAuth):
- Busca tenant + subscription en DB
- Si `status === 'BLOCKED'`: 403 `{ error: 'TENANT_BLOCKED' }`
- Si `status === 'TRIAL'` y `trialEndsAt < now`: 403 `{ error: 'TRIAL_EXPIRED' }`
- Adjuntar `req.tenant = { id, status, subscription }` al request

**`requireAdmin`**: verifica `role === 'ADMIN'` o `'SUPER_ADMIN'`

**`requireSuperAdmin`**: verifica `role === 'SUPER_ADMIN'`

### 3.2 Filtrar TODAS las queries por tenantId
Archivo: `apps/backend/src/http/router.ts`

Cada endpoint agrega `tenantId: req.user.tenantId` en todos los `where`:

| Endpoint | Cambio |
|----------|--------|
| `GET /lines` | `where: { tenantId }` |
| `POST /lines/:id/connect` | Verificar que la línea pertenece al tenant antes de conectar |
| `GET/PUT /lines/:id/config` | `where: { id, tenantId }` |
| `GET/PUT /lines/:id/context` | `where: { id, tenantId }` |
| `GET /stats` | Todas las queries de count con `tenantId` |
| `GET /audit-logs` | `where: { tenantId }` |
| `GET /chats` | `where: { tenantId }` |
| `GET /messages/:phone` | Buscar por `{ tenantId, phone }` → luego mensajes por clientId |
| `POST /messages/send` | Verificar que la línea pertenece al tenant |
| `POST /clients/:phone/pause` | `where: { tenantId, phone }` (unique compuesto) |
| `POST /clients/:phone/assign` | `where: { tenantId, phone }` |
| `GET /agents` | `where: { tenantId, isActive: true }` |
| `GET /messages/unread-count` | Join via client → filtrar por tenantId |

### 3.3 Repositorios tenant-aware
Archivo: `apps/backend/src/adapters/db/PrismaRepositories.ts`

Hacer los repositorios aceptar `tenantId` como parámetro en cada método:
- `PrismaClientRepository.findByPhone(phone, tenantId)`
- `PrismaClientRepository.upsert(data, tenantId)`
- `PrismaContextRepository.get(lineId, clientPhone, tenantId)`

### 3.4 Handler de mensaje inbound con tenantId
Archivo: `apps/backend/src/index.ts`

En el handler `whatsApp.setOnMessage`: obtener `tenantId` de la línea antes de ejecutar `handleInbound.execute`.

### 3.5 Actualizar el core
Archivo: `packages/core/src/ports/outbound.ts` y `packages/core/src/entities/index.ts`

Agregar `tenantId: string` a entidades y firmas de interfaces de repositorios.

**✅ Criterio done Fase 3:**
- Crear dos tenants manualmente en la DB → confirmar que las queries de uno no devuelven datos del otro
- Un tenant BLOCKED recibe 403 en cualquier endpoint protegido

---

## FASE 4 — Planes y Cuotas
**Duración estimada: 1.5 días**

### 4.1 Límite de líneas al crear
Archivo: `apps/backend/src/http/router.ts`

Antes de crear una línea (`POST /lines` o en connect):
```ts
const lineCount = await prisma.whatsAppLine.count({ where: { tenantId } })
if (plan.maxLines !== -1 && lineCount >= plan.maxLines)
  return res.status(403).json({ error: 'PLAN_LIMIT_LINES' })
```

### 4.2 Límite de operadores al crear usuario
```ts
const opCount = await prisma.user.count({ where: { tenantId, isActive: true } })
if (plan.maxOperators !== -1 && opCount >= plan.maxOperators)
  return res.status(403).json({ error: 'PLAN_LIMIT_OPERATORS' })
```

### 4.3 Contador de mensajes IA
Archivo: `apps/backend/src/index.ts`

En el handler de mensaje inbound, antes de `handleInbound.execute`:
1. Obtener subscription del tenant
2. Si `messagesUsed >= maxMessagesPerMonth` (y no es -1): guardar el mensaje en DB pero NO llamar a la IA. Broadcast `quota:exceeded` por WebSocket.
3. Si hay cuota: `prisma.subscription.update({ data: { messagesUsed: { increment: 1 } } })` → ejecutar handleInbound

### 4.4 Endpoint GET /subscription/usage
Responde: `{ plan: { name, maxLines, maxOperators, maxMessagesPerMonth, priceGs }, usage: { linesUsed, operatorsUsed, messagesUsed, trialEndsAt, status, currentPeriodEnd } }`

**✅ Criterio done Fase 4:**
- Crear líneas hasta el límite del plan → la siguiente es rechazada con 403
- El contador `messagesUsed` sube con cada respuesta de IA
- Al alcanzar el límite, el bot deja de responder pero los mensajes se guardan

---

## FASE 5 — Trial de 15 Días + Crons
**Duración estimada: 1 día**

### 5.1 Cron diario: expirar trials vencidos
Archivo: `apps/backend/src/index.ts`

Usando `node-schedule`:
```ts
schedule.scheduleJob('0 1 * * *', async () => {
  await prisma.subscription.updateMany({
    where: { status: 'TRIAL', trialEndsAt: { lte: new Date() } },
    data: { status: 'BLOCKED' }
  })
  logger.info('Trial expiry check completed')
})
```

### 5.2 Cron mensual: reset de contadores de mensajes
```ts
schedule.scheduleJob('0 0 1 * *', async () => {
  await prisma.subscription.updateMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    data: { messagesUsed: 0, currentPeriodStart: new Date() }
  })
  logger.info('Monthly message counter reset completed')
})
```

**✅ Criterio done Fase 5:**
- Cambiar `trialEndsAt` a fecha pasada en DB → el siguiente request retorna 403 `TRIAL_EXPIRED`
- Los crons se pueden disparar manualmente cambiando temporalmente el schedule a `* * * * *`

---

## FASE 6 — CRUD de Usuarios + Seguridad HTTP
**Duración estimada: 1.5 días**

### 6.1 CRUD de usuarios (todos con `[requireAuth, requireTenant, requireAdmin]`)
Archivo: `apps/backend/src/http/router.ts`

| Endpoint | Comportamiento |
|----------|---------------|
| `GET /users` | Lista usuarios del tenant (sin passwordHash) |
| `POST /users` | Valida Zod, verifica límite de operadores, bcrypt hash, crea usuario |
| `PUT /users/:id` | Edita nombre/rol/isActive. No puede dejar 0 admins activos |
| `DELETE /users/:id` | No puede eliminarse a sí mismo ni al último ADMIN. Revoca sus refresh tokens |
| `POST /users/:id/reset-password` | Genera contraseña temporal de 12 chars, responde en texto plano una sola vez |

### 6.2 Rate limiting
Instalar `express-rate-limit`. Aplicar:
- Global: 100 req/min por IP en `/api`
- Login: 5 intentos/min por IP en `POST /auth/login` (skipSuccessfulRequests: true)

### 6.3 Validación Zod en todos los endpoints de escritura
Crear middleware helper `validate(schema)`. Aplicar a:

| Endpoint | Schema |
|----------|--------|
| `POST /auth/login` | `email: z.string().email(), password: z.string().min(1)` |
| `POST /auth/register` | `companyName (min 2), name (min 2), email, password (min 8)` |
| `POST /messages/send` | `lineId (uuid), to (min 10), content (max 4000), type (enum)` |
| `PUT /lines/:id/config` | `assignedAiProvider (enum), aiApiKey?, aiModel?` |
| `PUT /lines/:id/context` | `businessContext (object?), systemPrompt (max 4000)?` |
| `POST /clients/:phone/pause` | `hours: z.number().int().min(1).max(168)` |
| `POST/PUT /users` | Ver 6.1 |

### 6.4 Reemplazar console.log/error por logger
- `router.ts` líneas 127, 143, 146 → `logger.info/error`
- `AIServiceAdapter.ts` → `logger.error`

### 6.5 Panel Super Admin — endpoints
`[requireAuth, requireSuperAdmin]`:
- `GET /admin/tenants` — lista con plan, status, consumo, usuarios, líneas
- `POST /admin/tenants` — crear tenant manual: `{ name, planId, adminEmail, adminPassword }`
- `PATCH /admin/tenants/:id` — `{ status?, planId? }`. Si `status=BLOCKED`: revoca todos los RefreshToken del tenant
- `GET /admin/tenants/:id/usage` — mismo formato que /subscription/usage

**✅ Criterio done Fase 6:**
- 5to intento de login fallido → 429
- POST /users con password de 7 chars → 422 (Zod error)
- SUPER_ADMIN puede bloquear un tenant; sus usuarios reciben 403 en el siguiente request

---

## FASE 7 — Frontend: Páginas Nuevas y Actualizaciones
**Duración estimada: 3 días**

### 7.1 Página /register (pública)
Archivo: `apps/frontend/src/components/pages/Register.tsx` (nuevo)

Formulario: Nombre empresa, Nombre completo, Email, Contraseña. POST `/api/auth/register`. Al éxito: guardar tokens → redirigir a `/` (mostrará checklist de onboarding).

Agregar en `App.tsx` como ruta pública antes del bloque de autenticación.

### 7.2 Protección de rutas por rol
Archivo: `apps/frontend/src/App.tsx`

```tsx
function ProtectedRoute({ children, roles }) {
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return <>{children}</>
}
```

| Ruta | Roles permitidos |
|------|-----------------|
| `/admin` | SUPER_ADMIN |
| `/settings/users`, `/settings`, `/subscription` | ADMIN, SUPER_ADMIN |
| `/messages`, `/connections`, `/ai-config`, `/` | Todos autenticados |

### 7.3 Navitems dinámicos por rol
Archivo: `apps/frontend/src/App.tsx`

Custom hook `useNavItems(role)` que retorna los ítems de navegación según el rol. OPERATOR solo ve Messages. ADMIN ve todo excepto /admin. SUPER_ADMIN ve /admin adicional.

### 7.4 Banner de trial en AppShell
Archivo: `apps/frontend/src/components/layout/AppShell.tsx`

Banner condicional visible en todas las páginas:
- `status === 'TRIAL'` y más de 3 días restantes: fondo amarillo — "Te quedan X días de prueba gratuita"
- Últimos 3 días: fondo rojo
- `status === 'BLOCKED'`: banner full-width rojo con "Tu cuenta fue suspendida. Contactá soporte."

El `App.tsx` obtiene la subscription de `GET /api/subscription/usage` al iniciar y la pasa como prop.

### 7.5 Página /settings/users
Archivo: `apps/frontend/src/components/pages/settings/UsersSettings.tsx` (nuevo)

- Tabla: Nombre, Email, Rol, Estado, Acciones
- Indicador: "Operadores: X/N"
- Modal "Agregar operador": Nombre, Email, Rol, Contraseña
- Modal "Editar": Nombre, Rol, Activo/inactivo
- "Reset password": muestra contraseña temporal una sola vez en modal
- Confirmación antes de eliminar
- Botón "Agregar" deshabilitado con tooltip si se alcanzó el límite

### 7.6 Página /settings
Archivo: `apps/frontend/src/components/pages/settings/TenantSettings.tsx` (nuevo)

- Nombre del negocio editable (`PATCH /api/tenant`)
- Plan activo: badge con nombre + precio
- 3 progress bars: Líneas X/N, Operadores X/N, Mensajes IA X/N
- Botón "Cambiar plan" → modal o link a /subscription

Nuevo endpoint backend requerido: `PATCH /api/tenant` → `prisma.tenant.update({ where: { id: tenantId }, data: { name } })`

### 7.7 Página /subscription
Archivo: `apps/frontend/src/components/pages/Subscription.tsx` (nuevo)

- Countdown de trial (si aplica)
- Barras de progreso coloreadas (verde < 70%, amarillo 70-90%, rojo > 90%)
- Cards de los 3 planes con límites y precios. Plan actual con badge "Plan actual". Los otros con botón "Contactar para upgrade"

### 7.8 Página /admin (Super Admin)
Archivo: `apps/frontend/src/components/pages/AdminPanel.tsx` (nuevo)

- Tabla de todos los tenants: Nombre, Plan, Status, Trial vence, Msgs usados, Líneas, Operadores
- Filtros por status y plan
- Acciones: Bloquear/Desbloquear, Ver detalle (modal)
- Botón "Crear tenant" (modal con el formulario)

### 7.9 Correcciones en componentes existentes

| Archivo | Cambio |
|---------|--------|
| `Login.tsx` | Cambiar `v2.0.0` por `import.meta.env.VITE_APP_VERSION`. Agregar link "Crear cuenta" → `/register` |
| `Header.tsx` | Eliminar bloque del campo de búsqueda deshabilitado. Solo queda NotificationCenter + avatar |
| `WhatsAppConnections.tsx` | El "Uptime 99.8%" hardcodeado → eliminar el dato falso |

**✅ Criterio done Fase 7:**
- Nuevo usuario puede registrarse en `/register` y ver el dashboard
- Sidebar muestra solo rutas del rol correspondiente
- Banner de trial visible para TRIAL; invisible para ACTIVE
- `/admin` accesible solo por SUPER_ADMIN

---

## FASE 8 — Onboarding, Error Boundaries y Deuda Técnica
**Duración estimada: 1.5 días**

### 8.1 Checklist de primer uso
Archivo: `apps/frontend/src/components/pages/OnboardingChecklist.tsx` (nuevo)

Si `linesCount === 0 && totalMessages === 0` al entrar al dashboard → mostrar checklist en lugar del dashboard:

1. ✅/⬜ Conectar primer número de WhatsApp → `/connections`
2. ✅/⬜ Configurar la personalidad del bot → `/ai-config` (marcado si `systemPrompt` no vacío)
3. ✅/⬜ Agregar contexto del negocio → `/ai-config` (marcado si `businessContext` no es `{}`)
4. ✅/⬜ Agregar un operador → `/settings/users` (marcado si hay OPERATOR activo)

Cuando todos están completos: mostrar el dashboard normal.

### 8.2 Plantillas de system prompt
Archivo: `apps/frontend/src/lib/promptTemplates.ts` (nuevo, constante pura)

5 plantillas: Ventas/Tienda, Soporte Técnico, Clínica/Consultorio, Inmobiliaria, Academia/Cursos.

En `AIConfiguration.tsx`: dropdown "Usar plantilla" que pre-llena el textarea `systemPrompt`.

### 8.3 Error Boundary global
Archivo: `apps/frontend/src/components/ErrorBoundary.tsx` (nuevo)

Class component con `componentDidCatch`. Renderiza `EmptyState` con botón "Recargar página" en lugar de pantalla en blanco.

En `App.tsx`: envolver cada `<Route>` en `<ErrorBoundary>`.

### 8.4 Estados de error explícitos
En `Dashboard.tsx`, `WhatsAppConnections.tsx`, `MessageCenter.tsx`, `AIConfiguration.tsx`:
- Reemplazar `catch {}` vacíos y `console.error` silenciosos por `setError(err.message)`
- Si `error !== null`: mostrar `<EmptyState icon="error" title="Error al cargar" description={error} />`

### 8.5 Confirmaciones en acciones destructivas
Usar `<Modal>` existente de `src/components/ui/Modal.tsx` antes de:
- Desconectar una línea de WhatsApp
- Eliminar un usuario
- Bloquear un tenant (en AdminPanel)

**✅ Criterio done Fase 8:**
- Tenant nuevo ve el checklist de onboarding
- Desconectar línea muestra modal de confirmación
- Dashboard muestra EmptyState de error si el backend está caído
- Cero `console.log/error` en el frontend (excepto ErrorBoundary)

---

## FASE 9 — Infraestructura K8s
**Duración estimada: 1.5 días**

### 9.1 Redis PubSub para WebSocket multi-réplica
Archivo: `apps/backend/src/lib/WebSocketManager.ts`

Problema: con 2 réplicas del backend, eventos de WebSocket del Pod A no llegan a clientes conectados al Pod B.

Solución:
```ts
// En el constructor
const redisSub = redis.duplicate() // Conexión separada para subscribe
redisSub.subscribe('boti:ws-events')
redisSub.on('message', (channel, msg) => {
  const { event, data } = JSON.parse(msg)
  this.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(msg) })
})

// En broadcast()
redis.publish('boti:ws-events', JSON.stringify({ event, data }))
```

Pasar instancia Redis al constructor de `WebSocketManager` en `index.ts`.

### 9.2 USER no-root en Dockerfiles
Archivo: `apps/backend/Dockerfile`
```dockerfile
RUN addgroup -S boti && adduser -S boti -G boti
RUN chown -R boti:boti /app
USER boti
```

Archivo: `apps/frontend/Dockerfile`
```dockerfile
USER nginx
```

### 9.3 CronJob de backup de PostgreSQL
Archivo: `k8s/postgres-backup-cronjob.yaml` (nuevo)

CronJob diario a las 3am UTC: `pg_dump | gzip > /backup/boti-YYYYMMDD.sql.gz`. Retención: 7 días (`find -mtime +7 -delete`). Requiere un PVC separado para los backups.

**✅ Criterio done Fase 9:**
- Con 2 réplicas del backend, mensaje en Pod A aparece en cliente WebSocket de Pod B
- Dockerfiles corren con usuario no-root (`docker inspect` confirma)
- CronJob de backup ejecutable manualmente sin errores

---

## Resumen

| Fase | Contenido | Días |
|------|-----------|------|
| 1 | Schema Prisma + ENV + Seed | 1 |
| 2 | Auth robusto + Refresh Tokens + Registro | 1.5 |
| 3 | Multi-tenancy — middlewares + queries | 2 |
| 4 | Planes y cuotas | 1.5 |
| 5 | Trial 15 días + crons automáticos | 1 |
| 6 | CRUD usuarios + rate limiting + Zod | 1.5 |
| 7 | Frontend — páginas nuevas + rol guards | 3 |
| 8 | Onboarding + error boundaries + deuda técnica | 1.5 |
| 9 | Redis PubSub + Dockerfiles + K8s backup | 1.5 |
| **Total** | | **~15 días hábiles** |

---

## Riesgos Documentados

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Migración `Client.phone @unique` → `@@unique([tenantId, phone])` rompe FK en Message | Alto | Escribir migración manual con UPDATE antes del ALTER |
| `HandleInboundMessage` no tiene tenantId en el core | Medio | Inyectarlo desde `index.ts` (documentar deuda técnica) |
| Refresh tokens en localStorage son vulnerables a XSS | Bajo (B2B) | Documentar trade-off; mitigar con CSP headers via Helmet |
| Seed de SUPER_ADMIN corre en cada deploy | Bajo | Usar upsert (idempotente) |

---

## Backlog Post-Lanzamiento (fuera del alcance actual)

- Mensajes multimedia (upload + storage + preview en chat)
- Cobro automático via Bancard
- Exportación de conversaciones (Enterprise)
- Métricas Prometheus + Grafana
- Backups con notificaciones automáticas
- Multi-region / read replicas para Enterprise
