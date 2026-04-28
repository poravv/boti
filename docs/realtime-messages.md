# Mensajes en Tiempo Real

Referencia técnica sobre el fix de actualización instantánea de mensajes en el MessageCenter.

---

## Causa raíz

**Archivo:** `apps/backend/src/index.ts`

El backend emite el evento WebSocket `message:new` para mensajes entrantes **inmediatamente**, antes de que el mensaje se escriba en la base de datos. La escritura ocurre después de un debounce de 3 segundos. El frontend llamaba `fetchMessages()` al recibir ese evento, pero la DB aún no tenía el registro — devolvía la lista desactualizada. Por eso los mensajes solo aparecían tras recargar la página.

El badge de notificaciones no tenía este problema porque usa los datos del payload WS directamente, sin consultar la DB.

---

## El fix (tres partes)

**Archivo:** `apps/frontend/src/components/MessageCenter.tsx`

### 1. Mensaje entrante — actualización optimista

Cuando llega `message:new` **sin** campo `direction` en el payload (mensaje inbound), el mensaje se inyecta directamente en el estado React desde el payload WS. El usuario lo ve de inmediato.

Un guard de dedup previene entradas duplicadas: compara contenido + ventana de 5 segundos antes de insertar.

### 2. Mensaje saliente — fetch normal

Cuando llega `message:new` con `direction: 'OUTBOUND'` en el payload, significa que BullMQ ya terminó de procesar y escribió en DB (`apps/backend/src/adapters/queue/BullMQAdapter.ts`, línea 62). En este caso se llama `fetchMessages()` normalmente y devuelve el hilo completo con IDs reales y la respuesta de la IA.

### 3. Fallback — fetch silencioso a los 5s

Si no llega ningún evento OUTBOUND (IA pausada, error, etc.), `fetchMessagesBackground()` se ejecuta 5 segundos después del evento inbound. Es un fetch silencioso — no activa el spinner de carga — y reemplaza los IDs temporales por los IDs reales de DB.

---

## Nuevo helper: `fetchMessagesBackground`

Idéntico a `fetchMessages` pero **no** setea `loadingMessages: true`. Evita el flash del spinner durante sincronizaciones de fondo. Se usa exclusivamente en el fallback de 5 segundos.

---

## Flujo completo post-fix

```
Cliente envía mensaje por WhatsApp
  → WS message:new (sin direction) llega al frontend
    → Mensaje aparece en el hilo de forma instantánea (estado React)
      → Timer de 5s arranca
        → ~3–10s después: IA procesa y envía respuesta
          → WS message:new (OUTBOUND) llega
            → fetchMessages() → hilo se actualiza con IDs reales y respuesta IA
              → Timer de 5s se cancela
        → Si no llega OUTBOUND (IA pausada / error):
          → fetchMessagesBackground() a los 5s reemplaza IDs temporales
```

---

## Tabla de comportamientos por tipo de evento

| Evento WS | `direction` en payload | Acción |
|-----------|------------------------|--------|
| `message:new` | ausente (inbound) | Inyección optimista en estado React + timer fallback 5s |
| `message:new` | `OUTBOUND` | `fetchMessages()` — fetch completo con spinner |
| Timeout fallback | — | `fetchMessagesBackground()` — fetch silencioso sin spinner |
