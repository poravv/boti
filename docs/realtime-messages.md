# Mensajes en Tiempo Real

Referencia técnica del flujo actual de mensajería en vivo en Boti.

---

## Objetivo

El centro de mensajes debe mostrar conversaciones nuevas y mensajes entrantes sin que el operador tenga que refrescar el navegador, cambiar de página o esperar a que responda la IA.

El flujo actual prioriza tres garantías:

- El mensaje entrante se guarda en base de datos antes de emitir WebSocket.
- El frontend recibe el `message.id` real, no un ID temporal.
- Si el WebSocket se corta, el cliente reconecta con backoff y heartbeat.

---

## Backend

Archivos principales:

- `apps/backend/src/index.ts`
- `apps/backend/src/lib/WebSocketManager.ts`
- `packages/core/src/use-cases/HandleInboundMessage.ts`

### Flujo inbound

```
WhatsApp/Baileys recibe mensaje
  -> backend extrae contacto, contenido, tipo y avatar
  -> HandleInboundMessage persiste Client, Chat y Message
  -> backend emite message:new con message y chat reales
  -> debounce de IA procesa la respuesta sin duplicar el inbound
```

El caso de uso acepta `persistInbound` e `inboundMessageId` para separar dos responsabilidades:

- Primera entrada: persistir el mensaje real y emitirlo al frontend.
- Procesamiento posterior de IA: reutilizar el inbound ya guardado sin crear duplicados.

### Payload `message:new`

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

### Heartbeat

`WebSocketManager` mantiene vivos los clientes conectados con `ping/pong` y limpia conexiones muertas. También responde mensajes `ping` enviados desde el frontend con `pong`.

Esto evita que el navegador quede con una conexión aparentemente abierta pero sin recibir eventos reales.

---

## Frontend

Archivos principales:

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/MessageCenter.tsx`

### Conexión WebSocket

`App.tsx` mantiene una conexión global a `/ws` con:

- reconexión automática;
- backoff progresivo;
- heartbeat periódico;
- estado visual de conexión;
- distribución de eventos por `window.dispatchEvent`.

### Message Center

`MessageCenter.tsx` escucha `message:new` y actualiza:

- hilo abierto;
- lista de conversaciones;
- último mensaje;
- contador de no leídos;
- avatar/nombre del contacto.

Cuando el evento contiene `message` y `chat`, se usa esa información directamente. Si por compatibilidad llega un payload antiguo sin `message`, el frontend conserva un fallback optimista, pero ese no debe ser el camino normal.

---

## Avatares

Archivos principales:

- `apps/backend/src/adapters/whatsapp/BaileysAdapter.ts`
- `apps/backend/src/adapters/db/PrismaRepositories.ts`
- `apps/frontend/src/components/MessageCenter.tsx`

Baileys intenta resolver la foto con `sock.profilePictureUrl(jid, 'image')`. El resultado se guarda en `Client.avatarUrl` y se cachea en memoria por línea/teléfono para evitar consultas repetidas.

La UI muestra el avatar en:

- lista de conversaciones;
- header del chat;
- burbujas inbound.

Si WhatsApp no entrega imagen, se muestra un fallback sobrio con inicial.

---

## Contrato operativo

| Caso | Comportamiento esperado |
|------|--------------------------|
| Mensaje entrante nuevo | Aparece en el hilo y en la lista sin refrescar |
| Chat no seleccionado | La lista se actualiza y aumenta no leídos |
| WebSocket caído | Reconecta con backoff y reanuda eventos |
| Conexión zombie | Heartbeat la detecta y fuerza reconexión |
| Foto no disponible | Se muestra fallback con inicial |

