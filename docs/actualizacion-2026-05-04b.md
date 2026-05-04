# Actualización técnica — 2026-05-04 (sesión B)

## Resumen

Esta sesión corrigió ocho bugs de estabilidad y UX: redirección en refresco, bloqueo de login por verificación de email, spinner permanente al cancelar QR, colores interiores inconsistentes con el tema oscuro, teléfono de línea mostrando el ID en lugar del número real, crash del backend al desconectar WhatsApp, QR que no aparecía aunque el backend lo tenía disponible, y tokens CSS faltantes que rompían Toast y Modal.

---

## Bugs corregidos

### 1. Refresco de página redirige al landing

**Archivo:** `apps/frontend/src/App.tsx`

**Causa:** El bloque `catch` de `checkAuth` limpiaba el token ante cualquier error de red, incluyendo errores transitorios.

**Fix:** Se eliminó la limpieza del token en el `catch`. Solo el evento `auth:unauthorized` (HTTP 401) debe cerrar la sesión.

```ts
} catch {
  // solo auth:unauthorized (401) hace logout — no limpiar token por errores de red
} finally {
  setLoading(false);
}
```

---

### 2. Login bloqueado con "Email no verificado"

**Archivo:** `apps/frontend/src/components/Login.tsx`

**Causa:** Se verificaba `firebaseUser.emailVerified` después del login con Firebase. Usuarios legítimos autenticados vía backend quedaban bloqueados.

**Fix:** Se eliminó el chequeo de `emailVerified`. La verificación de sesión la hace el backend.

---

### 3. Spinner permanente al cancelar QR

**Archivo:** `apps/frontend/src/components/WhatsAppConnections.tsx`

**Causa:** El botón "Cancelar" solo limpiaba `activeQrLine` y `currentQr`, pero el status de la línea en el array `lines` seguía siendo `QR_PENDING`. El spinner depende de `line.status`, no del estado del wizard.

**Fix:** Se agregó `cancelQr(lineId)` que:
1. Limpia el estado del wizard inmediatamente.
2. Actualiza el status local de la línea a `DISCONNECTED`.
3. Llama `POST /api/lines/:id/disconnect` para cerrar la sesión en Baileys.

```ts
const cancelQr = async (lineId: string) => {
  setActiveQrLine(null);
  setCurrentQr(null);
  setLines(prev => prev.map(l =>
    l.id === lineId ? { ...l, status: 'DISCONNECTED' as const, qrCode: undefined } : l
  ));
  try {
    await apiFetch(`/api/lines/${lineId}/disconnect`, { method: 'POST' });
  } catch { /* ignore */ }
};
```

---

### 4. Colores interiores (sidebar, header) inconsistentes con el tema oscuro

**Archivos:** `apps/frontend/src/components/layout/Sidebar.tsx`, `Header.tsx`, `AppShell.tsx`

**Causa:** La landing page usaba `#0B1120` (navy oscuro) pero el interior de la app usaba tokens claros (`bg-white/70`, `glass`).

**Fix:**
- Sidebar: `bg-[#0B1120]` con texto `text-white/50` y activo `text-action`.
- Header: `bg-[#0B1120]/95 backdrop-blur-xl` con texto `text-white/90`.
- AppShell: fondo principal `bg-slate-50` para contraste con el sidebar oscuro.

---

### 5. Teléfono de línea mostrando el ID en vez del número real

**Archivos:** `apps/backend/src/http/router.ts`, `BaileysAdapter.ts`, `index.ts`

**Causa:** El router usaba `phone: line.id` (hardcodeado por error). Baileys no extraía ni persistía el número real.

**Fix en tres partes:**

1. **BaileysAdapter.ts** — extrae el teléfono del JID al conectar:
```ts
const phone = sock.user?.id?.split(':')[0]?.split('@')[0] ?? undefined;
this.onStatusChange?.(lineId, 'CONNECTED', undefined, phone);
```

2. **index.ts** — persiste el teléfono en Prisma al recibir `CONNECTED`:
```ts
if (status === 'CONNECTED' && phone) {
  await prisma.whatsAppLine.update({ where: { id: lineId }, data: { phone } });
}
```

3. **router.ts** — `GET /api/lines` retorna `phone: line.phone ?? null` en lugar de `line.id`.

---

### 6. Crash del backend al desconectar WhatsApp

**Archivo:** `apps/backend/src/index.ts`

**Causa:** Baileys dispara `sendRetryRequest` internamente durante el cierre del socket. En Node 15+, una promesa rechazada sin manejador termina el proceso.

**Fix:** Handler global al inicio del proceso:
```ts
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('[unhandledRejection] non-fatal:', msg);
});
```

---

### 7. QR no aparece aunque el backend tiene `QR_PENDING`

**Archivo:** `apps/frontend/src/components/WhatsAppConnections.tsx`

**Causa:** El QR solo se mostraba cuando el usuario hacía clic en "Reconectar" (que seteaba `activeQrLine`). Si el backend ya tenía un QR pendiente (reinicio de pod, etc.), el frontend no lo detectaba.

**Fix en dos partes:**

1. `fetchLines` detecta QR pendiente al cargar la página:
```ts
const pending = fetched.find(l => l.status === 'QR_PENDING' && l.qrCode);
if (pending) {
  setActiveQrLine(pending.id);
  setCurrentQr(pending.qrCode!);
}
```

2. Handler WebSocket muestra QR para cualquier línea (no solo la activa):
```ts
if (status === 'QR_PENDING' && qrCode) {
  setActiveQrLine(lineId);
  setCurrentQr(qrCode);
}
```

---

### 8. Tokens CSS faltantes rompían Toast y Modal

**Archivos:** `apps/frontend/tailwind.config.js`, `apps/frontend/src/index.css`

**Causa:** Varios tokens usados en `Toast.tsx` y `Modal.tsx` no existían:
- `glass-elevated` (clase CSS)
- `animate-bounce-in`, `animate-fade-in-down` (keyframes)
- `on-success-container`, `error-container` y variantes M3 similares (colores)
- `bg-white/98` no existe en la escala de opacidad de Tailwind v3

**Fix:**
- `index.css`: agregado `.glass-elevated { @apply bg-white backdrop-blur-xl border border-white/60 shadow-glass-lg rounded-xl; }`
- `tailwind.config.js`: keyframes y animaciones `bounce-in`, `fade-in-down`, `bounce-slow`.
- `tailwind.config.js`: tokens M3 `container` y `on-*-container` para `success`, `warning`, `info`, `error` + `inverse-surface`.
- `index.css`: `bg-white/98` → `bg-white`.

---

## Rediseño de páginas

### `/connections` (WhatsAppConnections)

- Layout mobile-first: lista de líneas aparece primero en móvil (CSS `order-1 lg:order-2`), QR wizard ocupa 2/3 en desktop (`lg:col-span-2 order-2 lg:order-1`).
- Botón "Reconectar" siempre visible (sin depender de hover).
- Teléfono se muestra con prefijo `+` y solo si existe.
- Auto-conexión al QR en carga de página y por WebSocket para cualquier línea.
- Cancelar QR ahora cierra el wizard Y detiene el intento de conexión en el backend.

### `/ai-config` (AIConfiguration)

- Selector de proveedor como radio cards visuales (OpenAI / Gemini / Anthropic con colores de marca).
- Tabs a ancho completo (`flex-1`).
- Editor de system prompt: fondo oscuro (`bg-[#0B1120]`), fuente monoespaciada, 16 filas.
- Editor JSON con validación en tiempo real y mensaje de error inline.
- Campo API Key con toggle mostrar/ocultar.
- Panel lateral con resumen en vivo de la configuración activa.

---

## Notas de Tailwind v3

La escala de opacidad estándar es: `5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100`. El valor `98` no existe — usar `95` o sintaxis arbitraria `bg-white/[0.98]`.

---

## Commits de esta sesión

```
52932a7 fix: cancelar QR detiene spinner y desconecta backend
3c1fe7c fix: mostrar QR automáticamente si backend ya tiene QR_PENDING
<prev>  fix: crash backend por unhandledRejection en desconexión Baileys
<prev>  fix: teléfono de línea ahora muestra número real de Baileys
<prev>  fix: tokens CSS faltantes en Toast y Modal
<prev>  feat: rediseño completo /ai-config
<prev>  feat: rediseño /connections mobile-first con reconexión visible
<prev>  fix: dark theme sidebar y header consistente con landing
<prev>  fix: login no bloqueado por emailVerified de Firebase
<prev>  fix: refresco de página no redirige al landing
```
