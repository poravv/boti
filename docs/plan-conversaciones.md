# Plan: Gestión de Estado de Conversaciones (OPEN/CLOSED)

## Resumen

8 fases, ~7 horas de desarrollo. Agrega estado `OPEN | CLOSED` a las conversaciones con cierre manual desde el panel, reapertura automática, cron de auto-cierre por inactividad y nueva stat en el Dashboard.

## Grafo de dependencias

```
Fase 1 (entidades + ports)
  └─► Fase 2 (schema Prisma)
      └─► Fase 3 (adapter repositorio)
          ├─► Fase 4 (use-case — reopen logic)
          ├─► Fase 5 (HTTP endpoints + stats)
          └─► Fase 6 (cron auto-cierre)
Fase 5 ─► Fase 7 (frontend)
Fase 4+5+6 ─► Fase 8 (guard AI — opcional)
```

---

## Fase 1 — Domain Layer (30 min)

### `packages/core/src/entities/index.ts`
Agregar a `ConversationContext`:
```ts
export type ConversationStatus = 'OPEN' | 'CLOSED';

export interface ConversationContext {
  // ...campos existentes...
  status: ConversationStatus;  // NUEVO
  closedAt?: Date | null;       // NUEVO
}
```

### `packages/core/src/ports/outbound.ts`
Extender `IContextRepository`:
```ts
export interface IContextRepository {
  get(lineId: string, clientPhone: string): Promise<ConversationContext | null>;
  save(ctx: ConversationContext): Promise<void>;
  // NUEVOS:
  setStatus(lineId: string, clientPhone: string, status: 'OPEN' | 'CLOSED', closedAt: Date | null): Promise<void>;
  closeInactiveBefore(cutoff: Date): Promise<number>;
  countOpen(): Promise<number>;
}
```

Extender evento en `INotifier`:
```ts
event: '...' | 'CONVERSATION_CLOSED' | 'CONVERSATION_REOPENED'
```

---

## Fase 2 — Schema Prisma (20 min)

### `apps/backend/prisma/schema.prisma`
```prisma
model ConversationContext {
  // ...campos existentes...
  status      String    @default("OPEN")  // NUEVO
  closedAt    DateTime?                    // NUEVO

  @@index([status])  // para countOpen() eficiente
  @@unique([lineId, clientPhone])
}
```

Ejecutar:
```bash
cd apps/backend && npx prisma migrate dev --name add_conversation_status
npx prisma generate
```

Rows existentes quedan en `status = 'OPEN'` por el default. Migración no destructiva.

---

## Fase 3 — Adapter Repositorio (45 min)

### `apps/backend/src/adapters/db/PrismaRepositories.ts`

**Modificar** `PrismaContextRepository.get()` — mapear `status` y `closedAt`:
```ts
return {
  ...rowExistente,
  status: (row.status as 'OPEN' | 'CLOSED') ?? 'OPEN',
  closedAt: row.closedAt ?? null,
};
```

**Modificar** `PrismaContextRepository.save()` — incluir en `update` y `create`.

**Agregar** 3 métodos nuevos:
```ts
async setStatus(lineId, clientPhone, status, closedAt): Promise<void>
async closeInactiveBefore(cutoff: Date): Promise<number>  // retorna filas cerradas
async countOpen(): Promise<number>
```

---

## Fase 4 — Use-Case: Lógica de Reapertura (40 min)

### `packages/core/src/use-cases/HandleInboundMessage.ts`

**Entre** paso 4 (get/create context) y paso 5 (build prompt), insertar:

```ts
// Reapertura automática si conversación cerrada
if (ctx.status === 'CLOSED') {
  ctx.status = 'OPEN';
  ctx.closedAt = null;
  await contextRepo.setStatus(lineId, fromPhone, 'OPEN', null);
  await notifier.notifyOperators(lineId, 'CONVERSATION_REOPENED', { clientPhone: fromPhone });
}

// Placeholder límite de conversaciones concurrentes (se activará con multi-tenancy)
const OPEN_LIMIT = parseInt(process.env.MAX_OPEN_CONVERSATIONS ?? '9999', 10);
if (ctx.status === 'CLOSED') {
  const openCount = await contextRepo.countOpen();
  if (openCount >= OPEN_LIMIT) {
    await auditLogger.logEvent({ action: 'OPEN_LIMIT_REACHED', details: { lineId, clientPhone: fromPhone, openCount } });
  }
}
```

**Al construir** un `ctx` nuevo (lines 70–78), agregar `status: 'OPEN'` y `closedAt: null`.

---

## Fase 5 — HTTP Endpoints (45 min)

### `apps/backend/src/http/router.ts`

**Cambiar firma** de `createRouter` para recibir `contextRepo` y `wsManager`:
```ts
export function createRouter(whatsApp, sendMessage, blockClient, prisma, contextRepo, wsManager)
```

**Nuevos endpoints:**
```
POST /api/conversations/:lineId/:phone/close
POST /api/conversations/:lineId/:phone/reopen
```

Cierre hace: `setStatus CLOSED`, log en AuditLog, broadcast WS `conversation:status`.

**`GET /api/stats`** — agregar:
```ts
const openConversations = await contextRepo.countOpen();
res.json({ ...existente, openConversations });
```

**`GET /api/chats`** — join con `ConversationContext` para devolver `conversationStatus` y `closedAt` por chat.

### `apps/backend/src/index.ts`
Actualizar la llamada a `createRouter(...)` pasando `contextRepo` y `wsManager` como parámetros adicionales.

---

## Fase 6 — Cron Auto-cierre (30 min)

### `apps/backend/src/index.ts`

`node-schedule` ya es dependencia del proyecto. Agregar después del arranque de la cola:

```ts
import schedule from 'node-schedule';

// Ejecuta diariamente a las 02:00
schedule.scheduleJob('0 2 * * *', async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const count = await contextRepo.closeInactiveBefore(cutoff);
  if (count > 0) {
    logger.info({ count }, 'Auto-closed inactive conversations');
    await prisma.auditLog.create({ data: { action: 'AUTO_CLOSE_INACTIVE', details: { count, cutoffDate: cutoff.toISOString() } } });
  }
});
```

En el handler de shutdown agregar: `await schedule.gracefulShutdown()`.

---

## Fase 7 — Frontend (90 min)

### `apps/frontend/src/components/MessageCenter.tsx`

1. **Extender interfaz `Chat`**: agregar `conversationStatus?: 'OPEN' | 'CLOSED'` y `closedAt?: string | null`

2. **Handler `handleCloseConversation`**: POST a `/api/conversations/:lineId/:phone/close`, actualizar estado local optimista

3. **Header del chat**:
   - Badge dinámico: `success + dot` si ABIERTA, `neutral` si CERRADA
   - Botón "Cerrar conversación" (solo visible si ABIERTA) con icono `lock`

4. **Banner en chat cerrado** (debajo del banner de IA pausada):
   ```
   🔒 Esta conversación está cerrada. Se reabrirá automáticamente si el cliente responde.
   ```

5. **Lista de contactos**: `opacity-60` + icono `lock` sobre el avatar para conversaciones cerradas

6. **WebSocket**: manejar evento `conversation:status` para actualizar estado en tiempo real sin refetch

### `apps/frontend/src/components/pages/Dashboard.tsx`

1. Agregar `openConversations` a la interfaz `Stats`
2. Agregar `StatTile` con título "Conversaciones abiertas", icono `forum`, tone `primary`
3. Ajustar grid para acomodar 4 tiles secundarios

---

## Fase 8 — Guard IA (opcional, 15 min)

La lógica de reapertura en la Fase 4 garantiza que cuando el AI procesa un mensaje, la conversación ya está OPEN. No se necesita guard adicional. Si en el futuro se agrega un flag `doNotReopen`, se agrega un early return antes del AI call.

---

## Registro de Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Rows existentes sin `status` | Default `"OPEN"` en schema — migración segura |
| Race condition: 2 mensajes simultáneos en conv. cerrada | `updateMany` idempotente — el segundo es no-op |
| Cron en múltiples réplicas | `updateMany WHERE status='OPEN'` es seguro de ejecutar 2 veces |
| `countOpen()` lento en tabla grande | Índice `@@index([status])` en el schema |
| Cambio de firma de `createRouter` | Exactamente 1 caller en `index.ts` |

---

## Archivos Críticos

| Archivo | Fase |
|---------|------|
| `packages/core/src/entities/index.ts` | 1 |
| `packages/core/src/ports/outbound.ts` | 1 |
| `apps/backend/prisma/schema.prisma` | 2 |
| `apps/backend/src/adapters/db/PrismaRepositories.ts` | 3 |
| `packages/core/src/use-cases/HandleInboundMessage.ts` | 4 |
| `apps/backend/src/http/router.ts` | 5 |
| `apps/backend/src/index.ts` | 5, 6 |
| `apps/frontend/src/components/MessageCenter.tsx` | 7 |
| `apps/frontend/src/components/pages/Dashboard.tsx` | 7 |
