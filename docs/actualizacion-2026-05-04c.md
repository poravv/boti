# Actualización técnica — 2026-05-04 (sesión C)

## Resumen

Esta sesión investigó y corrigió la causa raíz de dos bugs relacionados: los mensajes de WhatsApp no llegaban al teléfono del usuario, y la página `/messages` no actualizaba en tiempo real sin necesidad de navegar para ir y volver.

Ambos bugs tenían la misma causa raíz: el JID `@lid` de WhatsApp multi-device se usaba simultáneamente como identificador de cliente en la DB, como número de teléfono en eventos WS, y como JID de enrutamiento para enviar mensajes — roles que requieren valores distintos.

---

## Contexto: JIDs `@lid` en WhatsApp multi-device

WhatsApp usa el protocolo multi-device para dispositivos vinculados. En este protocolo, el remitente puede identificarse con un JID de tipo `@lid` (Linked Device Identifier), por ejemplo `254756035538974@lid`, en lugar del JID estándar `595981586823@s.whatsapp.net`.

Baileys intenta resolver el LID al número de teléfono real vía `signalRepository?.lidMapping?.getPNForLID(jid)`. Esta resolución falla cuando:
- El contacto no está en la lista sincronizada de Baileys
- Es la primera vez que ese contacto envía un mensaje al bot

---

## Bugs corregidos

### 1. WhatsApp no entregaba la respuesta del bot

**Archivo:** `apps/backend/src/adapters/whatsapp/BaileysAdapter.ts`

**Causa:** Cuando el LID no resolvía, `fromPhone` quedaba como `'254756035538974'` (solo el número sin sufijo). `sendTextMessage` lo convertía a `'254756035538974@s.whatsapp.net'` — un JID inválido para un dispositivo @lid. WhatsApp no entregaba el mensaje.

**Fix anterior (incorrecto):** Se descartaban los mensajes LID no resolvibles con `continue`, lo que dejaba al bot sin responder.

**Fix correcto:** Usar el JID completo `'254756035538974@lid'` como `fromPhone` cuando el LID no resuelve. `sendTextMessage` ya maneja correctamente JIDs con `@`:

```typescript
if (jid.endsWith('@lid')) {
  try {
    const pn = await (sock as any).signalRepository?.lidMapping?.getPNForLID(jid);
    if (pn) {
      fromPhone = pn.split('@')[0];           // LID resuelto → número real
    } else {
      fromPhone = jid;                         // LID no resuelto → usar @lid completo
      baileysLogger.warn({ jid }, 'LID unresolvable — using @lid JID for routing');
    }
  } catch (err) {
    fromPhone = jid;
  }
}
```

```typescript
// En sendTextMessage — ya soportaba JIDs con @
const cleanTo = to.includes('@') ? to : `${to.split(':')[0]}@s.whatsapp.net`;
// '254756035538974@lid' → se mantiene como '254756035538974@lid' ✓
```

---

### 2. `/messages` no actualizaba en tiempo real

**Archivos:** `apps/backend/src/index.ts`, `packages/core/src/use-cases/HandleInboundMessage.ts`

**Causa:** `fromPhone` tenía doble rol: identificador de cliente en la DB y JID de enrutamiento. Cuando `fromPhone = '254756035538974@lid'`:

1. La DB almacenaba `client.phone = '254756035538974@lid'`
2. `fetchChats` (HTTP) retornaba `phone = '254756035538974@lid'`
3. Los eventos WS del frontend strippeaban el `@` → `phone = '254756035538974'`
4. `mergeChatUpdate` comparaba `'254756035538974@lid' !== '254756035538974'` → sin match → creaba una entrada duplicada

El resultado: dos entradas en la lista de chats para el mismo contacto. Al navegar y volver, `fetchChats` limpiaba las entradas WS y solo quedaba la entrada de la DB.

**Fix:** Separar `displayPhone` (para DB/WS/frontend) de `routingJid` (para `queue.enqueue`):

```typescript
// apps/backend/src/index.ts
whatsApp.setOnMessage(async (lineId, fromPhone, fromName, content, type, avatarUrl) => {
  // Separar rol display (sin sufijo) del rol de enrutamiento (JID completo)
  const displayPhone = fromPhone.split('@')[0]; // '254756035538974'
  const routingJid = fromPhone;                  // '254756035538974@lid'

  // Todas las operaciones de DB y WS usan displayPhone
  const client = await baseClientRepo.upsert({ phone: displayPhone, ... });
  wsManager.broadcast('message:new', { fromPhone: displayPhone, ... });

  // El enrutamiento usa routingJid
  await handleInbound.execute({ fromPhone: displayPhone, routingJid, ... });
});
```

```typescript
// packages/core/src/use-cases/HandleInboundMessage.ts
async execute(input: {
  fromPhone: string;      // para DB, contexto, herramientas
  routingJid?: string;    // para queue.enqueue (diferente solo cuando @lid no resuelve)
  ...
}): Promise<void> {
  const routingJid = input.routingJid ?? input.fromPhone;
  ...
  // Línea 249: usa routingJid para enqueue
  await queue.enqueue(lineId, { to: routingJid, content: replyText, type: 'TEXT', ... });
}
```

**Resultado:**

| Escenario | Antes del fix | Después del fix |
|-----------|--------------|-----------------|
| LID resuelto | Funciona (número real) | Funciona igual |
| LID no resuelto — DB | `phone = '254756035538974@lid'` | `phone = '254756035538974'` |
| LID no resuelto — WS | `chat.phone = '254756035538974@lid'` → frontend strips a `'254756035538974'` | `chat.phone = '254756035538974'` |
| LID no resuelto — envío | `to = '254756035538974@s.whatsapp.net'` (JID inválido, falla) | `to = '254756035538974@lid'` (JID correcto, entrega) |
| Real-time /messages | Mismatch `@lid` vs sin sufijo → dos entradas | Siempre consistente → un solo chat |

---

## Investigación descartada

Durante la investigación se analizó en detalle el código de `MessageCenter.tsx` y se verificó que:

- El handler WS (`handleWSEvent`) es correcto y recibe los eventos
- `filteredChats` no filtra por `conversationStatus` — todos los chats pasan
- `mergeChatUpdate` retorna un nuevo array reference → React re-renderiza
- `setChats(prev => mergeChatUpdate(...))` evita stale closure

La raíz del problema no era el frontend sino la inconsistencia del campo `phone` entre la API HTTP y los eventos WS, causada por el doble rol de `fromPhone`.

---

## Comportamiento post-fix

Cuando LID **resuelve** (contacto conocido):
- `fromPhone = '595981586823'` → `displayPhone = routingJid = '595981586823'`
- Todo funciona como siempre, sin cambio observable

Cuando LID **no resuelve** (contacto nuevo o no sincronizado):
- `displayPhone = '254756035538974'` (LID-stripped)
- `routingJid = '254756035538974@lid'`
- DB muestra número `'254756035538974'` (visible en /messages)
- Bot entrega la respuesta al dispositivo `@lid` ✓
- Chat aparece en tiempo real en /messages ✓
- Con el tiempo, Baileys acumula el LID mapping y futuras reconexiones pueden resolver al número real

---

## Deployment requerido

Los fixes son en backend (TypeScript compilado en Docker). Requieren nuevo pod:

```bash
kubectl rollout restart deployment/boti-backend -n boti
kubectl rollout status deployment/boti-backend -n boti
```

---

## Commits de esta sesión

```
d3e64c2  fix: separar displayPhone de routingJid para mensajes @lid de WhatsApp
4eea2bd  fix: saltear mensajes de LID no resolvibles — evita responder a JID inválido
```

_(El commit 4eea2bd fue el fix incorrecto que descartaba mensajes LID. El commit d3e64c2 es el fix correcto y final.)_
