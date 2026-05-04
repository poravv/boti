# Actualización técnica — 2026-05-04

## Resumen

Esta actualización profesionaliza la experiencia frontend, estabiliza la mensajería en tiempo real, agrega avatares reales de WhatsApp, mejora el registro de ventas autónomas y deja las migraciones listas para despliegue en Kubernetes vía GitHub Actions.

---

## Frontend profesional

Archivos principales:

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/pages/Dashboard.tsx`
- `apps/frontend/src/components/pages/AutonomousSalesPage.tsx`
- `apps/frontend/src/components/MessageCenter.tsx`
- `apps/frontend/src/components/ui/Icon.tsx`
- `apps/frontend/src/index.css`
- `apps/frontend/tailwind.config.js`

Cambios:

- Paleta visual más sobria y profesional, orientada a consola B2B.
- Dashboard rediseñado con jerarquía operativa, métricas y actividad reciente.
- Navbar con iconografía Lucide en lugar de Material Symbols.
- Remoción de la fuente Material Symbols del HTML/CSS.
- Tabla de ventas autónomas con estados, datos fiscales, errores y reuniones.

---

## Mensajería en tiempo real

Archivos principales:

- `apps/backend/src/index.ts`
- `apps/backend/src/lib/WebSocketManager.ts`
- `packages/core/src/use-cases/HandleInboundMessage.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/MessageCenter.tsx`

Cambios:

- El backend persiste mensajes entrantes antes de emitir `message:new`.
- El evento WebSocket ahora incluye `message` y `chat` reales.
- El frontend actualiza hilo, lista de chats y contadores sin refrescar la página.
- Se agregó heartbeat `ping/pong` y limpieza de conexiones WebSocket muertas.
- El cliente WebSocket reconecta con backoff progresivo.

Contrato principal:

```ts
{
  event: 'message:new',
  data: {
    lineId: string;
    clientPhone: string;
    fromPhone: string;
    fromName: string;
    avatarUrl?: string | null;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'PDF' | 'LINK';
    message: Message;
    chat: Chat;
  };
}
```

---

## Avatares de WhatsApp

Archivos principales:

- `apps/backend/src/adapters/whatsapp/BaileysAdapter.ts`
- `apps/backend/src/adapters/db/PrismaRepositories.ts`
- `apps/backend/prisma/schema.prisma`
- `packages/core/src/entities/index.ts`
- `apps/frontend/src/components/MessageCenter.tsx`

Cambios:

- Nuevo campo `Client.avatarUrl`.
- Baileys resuelve foto con `sock.profilePictureUrl(jid, 'image')`.
- Cache en memoria por línea/teléfono para evitar consultas repetidas.
- UI muestra avatar en lista de conversaciones, header e inbound bubbles.
- Fallback visual con inicial cuando WhatsApp no entrega imagen.

Migración:

- `apps/backend/prisma/migrations/20260504000000_add_client_avatar_url/migration.sql`

---

## Baileys

Paquete usado:

- `@whiskeysockets/baileys@6.7.21`

Criterio:

- `7.0.0-rc.9` aparece como latest, pero sigue siendo release candidate.
- `6.7.21` es la versión no RC elegida para producción conservadora.
- Se mantiene el import actual desde `@whiskeysockets/baileys` para minimizar riesgo de migración.

Referencias:

- GitHub Releases: https://github.com/WhiskeySockets/Baileys/releases
- npm: https://www.npmjs.com/package/@whiskeysockets/baileys

---

## Ventas autónomas

Archivos principales:

- `apps/backend/src/services/SalesService.ts`
- `apps/backend/src/http/router.ts`
- `apps/frontend/src/components/pages/AutonomousSalesPage.tsx`
- `apps/backend/prisma/schema.prisma`

Cambios:

- `/sales` ahora muestra historial operativo de ventas y reuniones.
- `GET /api/lines/:lineId/sales` retorna `sales`, `appointments`, `events` y `summary`.
- Se registran pedidos pendientes, pagos, facturas emitidas, errores de pedido y errores de facturación.
- Si el cliente pagó pero falló la factura, la venta queda como vendida con estado `PAID_INVOICE_ERROR`.
- Se conservan datos fiscales para facturación manual: documento/RUC, nombre, email y JSON fiscal completo.
- Las reuniones se muestran en la misma tabla, pero una compra no se calendariza automáticamente.

Nuevos campos:

- `SaleRecord.failureStage`
- `SaleRecord.failureReason`

Migración:

- `apps/backend/prisma/migrations/20260504001000_add_sale_failure_details/migration.sql`

---

## Migraciones y Kubernetes

Archivo principal:

- `apps/backend/start.sh`

Cambio:

- Se reemplazó `npx prisma db push` por `npx prisma migrate deploy`.

Motivo:

- `db push` sincroniza schema y puede saltarse el historial versionado de migraciones.
- `migrate deploy` aplica las carpetas de `apps/backend/prisma/migrations`, que son las que viajan en la imagen Docker y se ejecutan durante el rollout de GitHub Actions.

Contexto K8s:

- El workflow reconstruye backend cuando cambia `apps/backend/**`.
- El Dockerfile copia `apps/backend/prisma` al runtime image.
- El rollout actual pausa KEDA y escala backend a 1 réplica antes de desplegar.
- Si en el futuro el backend queda con varias réplicas permanentes, conviene mover `migrate deploy` a un Job dedicado previo al rollout.

---

## Validación ejecutada

```bash
npx prisma validate --schema apps/backend/prisma/schema.prisma
npm run build --workspaces
npx vitest run apps/backend/src/__tests__/PagoParAdapter.test.ts packages/core/src/__tests__/HandleInboundMessage.test.ts
```

Resultado:

- Prisma schema válido.
- Build de backend, frontend y core correcto.
- 38 tests pasados.

