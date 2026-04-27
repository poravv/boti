# Arquitectura de Boti

> Actualizado: 2026-04-27. Refleja el estado actual del código en `main`.

---

## Visión general

Boti sigue **Arquitectura Hexagonal** (Ports & Adapters). El dominio no conoce nada de Express, Prisma, Firebase ni Baileys. Las dependencias apuntan siempre hacia adentro.

```
Infrastructure → Application → Domain
```

---

## Capas

### Domain (`/domain`)

Entidades puras de negocio. Cero imports de frameworks.

- `Client` — contacto de WhatsApp (teléfono, estado, asignación)
- `Message` — unidad de comunicación (dirección, tipo, estado)
- `WhatsAppLine` — línea conectada con su configuración de IA
- `ConversationContext` — historial resumido por (línea, contacto)

Puertos (interfaces que el dominio espera pero no implementa):
- `AIPort` — generar respuesta dado un contexto
- `WhatsAppPort` — enviar mensajes por una línea
- `QueuePort` — encolar trabajos de envío
- `ContextPort` — leer/escribir contexto de conversación

### Application (`/application`)

Casos de uso. Orquesta el dominio sin saber qué implementación de puerto se usa.

- `HandleInboundMessage` — flujo completo de un mensaje entrante: dedup, spam, AI, queue
- `SendMessage` — envío manual o por cola
- `BlockClient`, `AssignClient`, `CloseConversation` — operaciones de gestión

### Infrastructure (`/adapters`, `/http`, `/lib`)

Implementaciones concretas de los puertos + capa HTTP:

| Adaptador | Puerto que implementa |
|---|---|
| `BaileysAdapter` | `WhatsAppPort` |
| `OpenAIAdapter` / `GeminiAdapter` | `AIPort` |
| `BullMQAdapter` | `QueuePort` |
| `PrismaConversationRepo` | `ContextPort` |
| `RedisSpamFilter` | — (infraestructura interna) |
| `WebSocketManager` | — (broadcast al cliente web) |
| `AuthService` | — (JWT + Firebase) |

---

## Flujo de mensaje entrante

```
WhatsApp
  │
  ▼
BaileysAdapter.onMessage()
  │
  ├── Dedup (Redis SET con TTL) — descarta duplicados
  │
  ├── SpamFilter — si supera umbral, pausa AI y notifica operador
  │
  ├── Prisma: upsert Client + insert Message
  │
  ├── Chequeo de pausa AI (client.aiPaused)
  │   └── Si pausado → skip IA, notifica operador
  │
  ├── Fetch ConversationContext (últimos N mensajes del resumen)
  │
  ├── ContextFetcher: llama APIs externas activas
  │   └── Inyecta resultado en el prompt
  │
  ├── AIAdapter.generateReply(systemPrompt, context, message)
  │
  ├── BullMQ: enqueue SendMessage job
  │
  └── WebSocketManager.broadcast('message:new', ...)
```

---

## Multi-tenancy

Cada recurso (líneas, clientes, mensajes, usuarios) está asociado a una `Organization` via `orgId`. El middleware `requireLineOwnership` verifica en cada request que la línea pertenece al tenant del usuario autenticado.

```
User → Organization → WhatsAppLine → Client → Message
                   → Plan (límites)
                   → User[] (operadores)
```

La columna `orgId` en cada tabla es el pivote de aislamiento. Ninguna query devuelve datos de otro tenant.

---

## Autenticación

### Flujo Firebase + JWT propio

```
Cliente Web
  │
  ├── signInWithGoogle() / signInWithEmail()  ← Firebase Auth SDK
  │
  ├── getIdToken()  →  Firebase ID Token (1h de vida)
  │
  ├── POST /api/auth/firebase-session
  │       { idToken }
  │         │
  │         ├── firebase-admin.verifyIdToken()
  │         ├── upsert User en Postgres
  │         ├── si primer login: crear Org + asignar plan Trial
  │         └── firmar JWT propio (7 días)
  │
  └── Todas las llamadas API usan: Authorization: Bearer <JWT propio>
```

El `authMiddleware` solo verifica el JWT propio. El ID token de Firebase se consume una sola vez en `/firebase-session` y no vuelve a procesarse.

### Roles

```
OPERATOR  →  ADMIN  →  SUPERADMIN
```

- `OPERATOR`: gestión de conversaciones asignadas
- `ADMIN`: gestión del tenant (líneas, usuarios, config de IA)
- `SUPERADMIN`: panel global SaaS (todas las orgs, planes, otros super admins)

El email `andyvercha@gmail.com` recibe `SUPERADMIN` automáticamente en el primer login.

---

## Planes y límites

El middleware `checkPlanLimit(resource)` se ejecuta antes de crear líneas o usuarios:

```typescript
// POST /api/lines → crea línea, verificando límite del plan
router.post('/lines', authMiddleware, requireAdmin, checkPlanLimit('lines'), handler)
```

Lógica de `checkPlanLimit`:
1. Busca la Org del usuario autenticado con su Plan
2. Si `isActive === false` → 403 (cuenta suspendida)
3. Si `trialEndsAt < now` y no tiene plan pago → 403 (trial expirado)
4. Si `plan.maxLines !== -1` y `lineCount >= plan.maxLines` → 403 (límite alcanzado)

`-1` en cualquier límite significa ilimitado (plan Enterprise).

---

## WebSocket

Un único servidor WS en `/ws`. El cliente conecta con el JWT:

```
ws://host/ws?token=<JWT>
```

El `WebSocketManager` mantiene un mapa de `orgId → Set<WebSocket>` para hacer broadcast solo al tenant correcto.

| Evento | Payload |
|---|---|
| `message:new` | `{ lineId, phone, message }` |
| `message:status` | `{ messageId, status }` |
| `line:status` | `{ lineId, status, qr? }` |
| `conversation:assigned` | `{ phone, operatorId }` |
| `conversation:status` | `{ phone, status }` |
| `operator:notification` | `{ type, message, phone? }` |
| `sale:paid` | `{ lineId, phone, amount, orderId }` |
| `note:new` | `{ phone, note }` |

---

## Colas (BullMQ)

Redis como broker. Workers paralelos (20 concurrentes, escalable con KEDA en K8s).

```
Inbound handler
  └── queue.add('send-message', { lineId, to, content, type })
        │
        └── Worker
              ├── BaileysAdapter.sendMessage()
              └── Prisma: update Message status
```

Reintentos automáticos en caso de fallo transitorio de Baileys.

---

## Infraestructura de producción

```
GitHub Actions
  │
  ├── docker build + push → GHCR
  │
  └── kubectl set image → K8s cluster
        │
        ├── Deployment: backend (KEDA autoscale por queue depth)
        ├── Deployment: frontend (nginx con deferred DNS para backend)
        ├── StatefulSet: postgres
        ├── StatefulSet: redis
        └── Secrets: JWT, Firebase, DB credentials
```

Variables sensibles nunca se hardcodean. Se inyectan como K8s secrets o GitHub secrets en CI.

---

## Decisiones técnicas clave

| Decisión | Razón |
|---|---|
| JWT propio en lugar de solo Firebase | Independencia de Firebase en las APIs. Un solo lugar de validación en `authMiddleware`. Firebase ID Token se consume una sola vez. |
| Límites por conversaciones activas, no mensajes | Refleja el consumo real de recursos (Redis, WS, workers). Más simple de explicar al cliente. |
| Cada org pone su propia API key de IA | Boti no asume costo de tokens. Billing simplificado. |
| BullMQ para envío | Desacopla el procesamiento del mensaje entrante del envío. Permite reintentos sin bloquear. |
| Dedup en Redis con TTL | Baileys puede re-emitir el mismo evento. Sin dedup habría respuestas duplicadas. |
| nginx con `resolver` dinámico | Nginx no falla al arrancar si el backend aún no está disponible. Crítico en Docker Compose donde los contenedores inician en paralelo. |
| Hexagonal architecture | Permite cambiar Baileys por otra librería de WA o Prisma por otro ORM sin tocar el dominio. |
