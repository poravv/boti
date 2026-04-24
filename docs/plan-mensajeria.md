# Plan de Mensajería — Features de Alto Valor

## Las 5 Features Propuestas

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|---------|----------|
| 1 | **Cierre de conversación (OPEN/CLOSED)** | Desbloquea modelo de negocio + CRM real | 10-14h | 🔴 Alta |
| 2 | **Notas internas de operador** | Productividad de equipo + handoff entre operadores | 7-10h | 🔴 Alta |
| 3 | Respuestas rápidas (canned responses) | Velocidad de respuesta manual (-80% tiempo) | 10-14h | 🟡 Media |
| 4 | Etiquetas/Tags en conversaciones | Segmentación + filtros + reportes | 12-16h | 🟡 Media |
| 5 | Panel de actividad / timeline de operadores | Auditoría contextual por conversación | 6-8h | 🟢 Baja |

**Top 2 seleccionadas: Feature 1 + Feature 2**
- Feature 1 desbloquea el modelo de negocio (sin OPEN/CLOSED no hay límite de conversaciones activas)
- Feature 2 es el diferenciador de productividad más visible para equipos — se venden juntas como "gestión de casos"

---

## Feature 1 — Cierre de Conversación

### Por qué es valiosa
Sin estado de conversación, todos los chats son iguales. Los operadores no saben qué casos están resueltos. La lista crece indefinidamente. El límite de conversaciones activas (el modelo de negocio) no se puede aplicar.

### Fases

**Fase 1 — DB (1h)**
Archivo: `apps/backend/prisma/schema.prisma`
```prisma
// Agregar en model Client:
conversationStatus  String    @default("OPEN")
closedAt            DateTime?
closedByUserId      String?
closedBy            User?     @relation("ClosedConversations", fields: [closedByUserId], references: [id])
```

**Fase 2 — Endpoints HTTP (2h)**
Archivo: `apps/backend/src/http/router.ts`
```
POST /api/clients/:phone/close    → status CLOSED + broadcast WS
POST /api/clients/:phone/reopen   → status OPEN + broadcast WS
GET  /api/chats?status=OPEN|CLOSED|ALL  (modificar existente)
```

**Fase 3 — Reapertura automática (1h)**
Archivo: `packages/core/src/use-cases/HandleInboundMessage.ts`
Después del check de `isBlocked`: si `client.conversationStatus === 'CLOSED'`, hacer `update({ conversationStatus: 'OPEN' })` antes de procesar el mensaje.

**Fase 4 — Cron auto-cierre (1h)**
Archivo: `apps/backend/src/index.ts`
`setInterval` cada hora que cierra conversaciones con `updatedAt < 30 días`.

**Fase 5 — Frontend (5h)**
Archivo: `apps/frontend/src/components/MessageCenter.tsx`
- Tabs en sidebar: "Abiertas | Cerradas | Todas" — pasa `?status=` a `/api/chats`
- Botón "Cerrar caso" en header del hilo
- Banner verde cuando conversación está cerrada + botón "Reabrir"
- WS handler para `conversation:closed` / `conversation:reopened`

---

## Feature 2 — Notas Internas de Operador

### Por qué es valiosa
Los operadores no pueden hacer handoff de un caso sin salir del panel (email, WhatsApp propio, etc.). Las notas internas permiten dejar contexto visible para el equipo, sin que el cliente las vea.

### Fases

**Fase 1 — DB (1h)**
Archivo: `apps/backend/prisma/schema.prisma`
```prisma
model InternalNote {
  id          String   @id @default(uuid())
  clientPhone String
  authorId    String
  content     String
  createdAt   DateTime @default(now())
  author      User     @relation(fields: [authorId], references: [id])
  @@index([clientPhone])
}
```

**Fase 2 — Endpoints HTTP (1.5h)**
Archivo: `apps/backend/src/http/router.ts`
```
GET    /api/clients/:phone/notes
POST   /api/clients/:phone/notes       { content }
DELETE /api/clients/:phone/notes/:id   (solo autor o ADMIN)
```
El POST hace broadcast WS `note:new` para actualización en tiempo real.

**Fase 3 — Frontend (5h)**
Archivo: `apps/frontend/src/components/MessageCenter.tsx`

Nuevo tipo `ThreadItem = Message | InternalNote`. Las notas se cargan en paralelo con los mensajes y se intercalan por `createdAt`.

Toggle en el footer del compositor:
- `[Mensaje]` `[📝 Nota interna]` — botones pill
- En modo nota: input con fondo ámbar, placeholder "Nota interna (solo visible para operadores)..."
- Al guardar: `POST /api/clients/:phone/notes`

Nuevo componente `NoteBubble`:
- Fondo ámbar (`bg-amber-50 border-amber-200`)
- Header: icono `edit_note` + "Nota interna — {nombre del autor}"
- Texto + timestamp

---

## Resumen de Esfuerzo

| Feature | Total horas |
|---------|------------|
| Cierre de conversación | 10-14h |
| Notas internas | 7-10h |
| **Total** | **17-24h** |

Ambas son independientes — se pueden desarrollar en paralelo. Las migraciones de DB se pueden combinar en un solo `migrate dev`.

---

## Features Futuras (Backlog)

### Respuestas Rápidas (Canned Responses)
Modelo `CannedResponse { id, lineId?, shortcode, content }`. Al escribir `/` en el compositor aparece un dropdown con las opciones filtradas. Página de gestión en `/admin/canned-responses`.

### Etiquetas (Tags)
Modelos `Tag { id, name, color }` y `ClientTag { clientId, tagId }`. Chips de colores en la lista de chats y en el header del hilo. Filtro por tag en el sidebar.

### Timeline de Actividad
Filtrar `AuditLog` por `clientPhone` y renderizar como timeline colapsable en el panel derecho del hilo.
