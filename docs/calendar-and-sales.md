# Calendar y Ventas Autónomas

Referencia técnica para desarrolladores sobre el sistema de citas y el módulo de ventas con PagoPar.

---

## 1. Sistema de citas (CalendarService)

**Archivo:** `apps/backend/src/services/CalendarService.ts`

El calendario es local (Prisma). No depende de Google Calendar ni de ningún servicio externo. Siempre está disponible para todas las líneas.

### Detalles técnicos

| Parámetro | Valor |
|-----------|-------|
| Timezone | `America/Asuncion` — UTC-4, sin DST |
| Horario de trabajo | 08:00–19:00 |
| Intervalo de slots | 30 minutos |
| Duración por defecto | 60 minutos |
| Límite de agendamiento | 90 días desde hoy |

Las fechas se almacenan en UTC en la base de datos. Al parsear una fecha/hora sin offset explícito, el servidor asume `-04:00` (Paraguay local).

---

### Herramientas de IA

#### `check_availability`

Consulta los slots libres para una fecha dada. Solo muestra horarios sugeridos; `create_appointment` acepta cualquier hora aunque no aparezca aquí.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `fecha` | `string` | Sí | Fecha en formato `YYYY-MM-DD` |
| `duracion_minutos` | `number` | No | Duración en minutos (defecto: 60) |

Retorna una lista de horarios disponibles en formato `HH:MM`, o un mensaje indicando que no hay disponibilidad.

---

#### `create_appointment`

Crea una cita nueva en el calendario.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `titulo` | `string` | Sí | Título o motivo de la cita |
| `fecha_hora` | `string` | Sí | ISO 8601, ej: `2026-04-30T17:30:00` |
| `duracion_minutos` | `number` | No | Defecto: 60 |
| `notas` | `string` | No | Contexto de la conversación. Incluir siempre aunque sea breve. |

**Comportamientos clave:**
- Si `fecha_hora` no incluye offset, se asume `-04:00`.
- Si la fecha supera los 90 días desde hoy, el servidor rechaza la cita con un mensaje pidiendo verificar el mes. Esto previene que la IA use meses incorrectos (ej: noviembre cuando el cliente dijo "el jueves 30" en abril).
- Verifica conflictos de horario antes de crear. Si hay otra cita en el mismo slot, retorna error.

---

#### `reschedule_appointment`

Cancela todas las citas pendientes (`SCHEDULED`) del cliente y crea una nueva en el horario indicado.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `nueva_fecha_hora` | `string` | Sí | ISO 8601, ej: `2026-05-01T17:00:00` |
| `titulo` | `string` | No | Si se omite, mantiene el título de la cita anterior |
| `duracion_minutos` | `number` | No | Defecto: 60 |
| `notas` | `string` | No | Contexto de la cita. Incluir siempre. |

**Comportamientos clave:**
- Cancela todas las citas futuras del cliente en la línea, no solo la más reciente.
- Verifica conflictos con citas de **otros** clientes antes de crear la nueva.
- Aplica la misma validación de 90 días que `create_appointment`.
- Si no había citas previas, igual crea la nueva sin error.

---

### UI — CalendarPage

**Archivo:** `apps/frontend/src/components/pages/CalendarPage.tsx`

#### Navegación

- Los botones `<` y `>` cambian de mes. Al cambiar de mes se limpia el día seleccionado.
- Si hay más de una línea, aparece un selector de línea en el header.
- Las citas se cargan para el mes visible (desde el primer al último día del mes).

#### Vista de calendario

- Grilla mensual con días de la semana (Dom–Sáb).
- Los días con citas muestran puntos indicadores (hasta 3 puntos).
- Al hacer clic en un día, la lista lateral filtra las citas de ese día. Clic de nuevo en el mismo día deselecciona y muestra el mes completo.
- El día actual se marca con fondo primario/10 y texto en negrita.

#### Lista de citas

Cada tarjeta muestra:
- Título de la cita
- Fecha corta + rango horario (ej: `jue. 30 abr. · 17:30 – 18:30`)
- Nombre del cliente y teléfono (si están disponibles)
- Vista previa de notas (máximo 2 líneas, italic)

Acciones por tarjeta:
- **Ojo (visibility):** abre el modal de detalle
- **X (cancel):** cancela la cita directamente (sin modal de confirmación)

#### Modal de detalle

Se abre con el botón de visibilidad o haciendo clic en el título. Se cierra con `Escape`, haciendo clic en el fondo, o con el botón "Cerrar".

Campos mostrados:
- Título
- Fecha completa (ej: `jueves, 30 de abril de 2026`)
- Rango horario + duración en minutos
- Nombre y teléfono del cliente
- Badge de estado (`Programada` / `Cancelada` / `Completada`)
- Notas completas (sin truncar)

El botón **Cancelar cita** dentro del modal solo aparece si el estado es `SCHEDULED`. Al cancelar, cierra el modal automáticamente.

---

## 2. Ventas Autónomas / PagoPar

**Archivos:**
- `apps/backend/src/services/SalesService.ts`
- `apps/frontend/src/components/pages/AutonomousSalesPage.tsx`

### Flujo general

```
Cliente expresa intención de compra
  → Bot llama generate_payment_link
    → SalesService crea orden en PagoPar
      → Retorna URL de pago al bot
        → Bot envía URL al cliente por WhatsApp
          → Cliente paga en PagoPar
            → PagoPar llama webhook POST /api/webhook/pagopar/{lineId}
              → SalesService marca venta como PAID
                → (Opcional) Llama al Facturador
              → Bot envía confirmación de pago al cliente
```

Las ventas autónomas solo están activas si `autonomousSalesEnabled = true` **y** existe un `pagoParConfig` para la línea.

Una compra por WhatsApp no crea una cita automáticamente. El pedido queda registrado como venta/pedido en `SaleRecord`; solo se calendariza cuando la conversación requiere explícitamente una reunión, turno, instalación, visita o servicio agendado mediante las herramientas del calendario.

---

### Herramienta de IA

#### `generate_payment_link`

Genera un link de pago de PagoPar. Usar **solo** cuando el cliente haya confirmado que quiere comprar y se haya acordado el precio.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `producto` | `string` | Sí | Nombre del producto o servicio |
| `monto` | `number` | Sí | Monto en Guaraníes (PYG), sin decimales |
| `descripcion` | `string` | No | Descripción breve del pedido |

Retorna directamente la URL de pago de PagoPar.

El `orderId` generado sigue el formato `BOTI-{lineId[0:8]}-{timestamp}`.

---

### Configuración PagoPar

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Base URL | No | Defecto: `https://api.pagopar.com` |
| Public Key | Sí | Clave pública de PagoPar |
| Private Key | Sí (solo al crear) | Clave privada. No se pre-carga en el form. Dejar vacío en edición para mantener la existente. |
| Sandbox Mode | — | Toggle. En `true`: links de prueba. En `false`: cobra dinero real. |

**Webhook URL:** siempre es `{BACKEND_BASE_URL}/api/webhook/pagopar/{lineId}`. Se genera automáticamente en el servidor — no se puede configurar ni sobreescribir desde la UI. Esto garantiza que la notificación de pago de una línea nunca llegue al webhook de otra.

**Tarjetas de prueba (sandbox):**
- Visa: `4000 0000 0000 0001` — venc. 12/30 — CVV 123
- Mastercard: `5100 0000 0000 0000` — venc. 12/30 — CVV 123

---

### Configuración Facturador

Se llama automáticamente después de confirmar un pago, si está activo.

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Base URL | Sí | Endpoint POST de facturación |
| X-Access-Key | Sí | Clave de acceso |
| X-Secret-Key | Solo al crear | No se pre-carga. Dejar vacío en edición para mantener la existente. |
| X-Api-Key | No | Opcional según el proveedor |
| Body Template | Sí | JSON con placeholders (ver tabla abajo) |
| Success Example | No | JSON de referencia para validar la respuesta |

#### Placeholders disponibles en el body template

| Placeholder | Valor en tiempo de ejecución |
|-------------|------------------------------|
| `{{TRANSACTION_ID}}` | ID interno de la venta en Boti |
| `{{PAGOPAR_ORDER_ID}}` | ID de la orden en PagoPar |
| `{{FECHA_EMISION}}` | ISO 8601 con offset `-03:00` |
| `{{MONTO_TOTAL}}` | Monto en PYG (string) |
| `{{CLIENTE_TELEFONO}}` | Número de teléfono del cliente |
| `{{PRODUCTO}}` | Nombre del producto |
| `{{CANTIDAD}}` | Cantidad (generalmente `1`) |
| `{{PRECIO_UNITARIO}}` | Precio unitario en PYG |

#### Comportamiento post-pago

1. `SalesService.handlePaymentConfirmation` recibe el `hashPedido` desde el webhook.
2. Verifica que la venta esté en estado `PENDING` (idempotencia: pagos duplicados se ignoran).
3. Actualiza el estado a `PAID`.
4. Si hay `facturadorConfig` activo, llama al facturador con el body template resuelto.
5. Si el facturador responde con éxito, el estado pasa a `INVOICED` y se guarda el `invoiceId`.
6. Si el facturador falla, el estado pasa a `PAID_INVOICE_FAILED`. La venta queda marcada como pagada/vendida, pero con error de facturación pendiente.
7. El caller (router) envía el mensaje de confirmación de pago por WhatsApp.

---

## 3. Historial de ventas y reuniones

La pantalla `/sales` consume `GET /api/lines/:lineId/sales` y muestra una tabla operativa con ventas, pedidos, pagos, facturas, errores y reuniones.

### Endpoint

`GET /api/lines/:lineId/sales?limit=100`

Respuesta principal:

| Campo | Descripción |
|-------|-------------|
| `sales` | Registros crudos de `SaleRecord` |
| `appointments` | Citas recientes de la línea |
| `events` | Lista unificada para tabla de ventas/reuniones |
| `summary` | Métricas agregadas para la cabecera |

### Estados normalizados en `events`

| Estado UI | Origen | Significado |
|-----------|--------|-------------|
| `ORDER` | `SaleRecord.PENDING` | Pedido generado, link de pago pendiente |
| `PAID` | `SaleRecord.PAID` | Pago confirmado, sin factura emitida |
| `INVOICED` | `SaleRecord.INVOICED` | Pago confirmado y factura emitida |
| `PAID_INVOICE_ERROR` | `SaleRecord.PAID_INVOICE_FAILED` | Pago confirmado, facturación fallida |
| `ERROR` | `SaleRecord.FAILED` | Falló la creación del pedido/link o una etapa previa al pago |
| `MEETING` | `Appointment.SCHEDULED` | Reunión/cita programada |
| `CANCELLED` | `Appointment.CANCELLED` | Reunión/cita cancelada |

### Campos relevantes por evento

| Campo | Descripción |
|-------|-------------|
| `kind` | `SALE` o `MEETING` |
| `sold` | `true` cuando hubo pago confirmado, incluso si falló la factura |
| `status` | Estado normalizado para la UI |
| `productName` | Producto o servicio comprado/solicitado |
| `description` | Detalle del pedido o notas de la reunión |
| `amount` | Monto en PYG |
| `clientPhone` | Teléfono del cliente |
| `receptorDocumento` | Documento/RUC para facturación manual |
| `receptorNombre` | Nombre o razón social para facturación manual |
| `receptorEmail` | Email fiscal, si fue informado |
| `fiscalData` | JSON fiscal completo cuando exista |
| `paymentUrl` | Link de pago PagoPar |
| `invoiceId` | Identificador de factura emitida |
| `failureStage` | Etapa donde ocurrió el error |
| `failureReason` | Mensaje técnico/operativo del error |

### Reglas de negocio

- Si el cliente pagó y falló la facturación, el evento debe quedar como vendido (`sold = true`) y visible como `PAID_INVOICE_ERROR`.
- Los datos fiscales deben permanecer disponibles para emitir la factura manualmente.
- Los errores de creación de link de pago quedan como `FAILED` con `failureStage = PAYMENT_LINK`.
- Una factura emitida correctamente queda marcada como `INVOICED` y muestra `invoiceId`.
- Las reuniones aparecen en la misma tabla para que ventas y agenda se puedan auditar desde una sola pantalla.

### UI — AutonomousSalesPage

**Archivo:** `apps/frontend/src/components/pages/AutonomousSalesPage.tsx`

- Selector de línea WhatsApp en la parte superior.
- Métricas resumidas: ingresos vendidos, órdenes/pedidos, facturas, reuniones y errores.
- Tabla de historial con fecha, cliente, estado, detalle, monto, datos fiscales y referencia.
- Los estados pagados con error de factura se muestran como vendidos, pero con alerta operativa.
- Los datos fiscales visibles permiten emitir una factura manual si el proveedor externo falló.
- Toggle de activación/desactivación de ventas autónomas con badge de estado.
- Dos pestañas: **PagoPar** y **Facturador**.
- Un único botón "Guardar configuración" que persiste ambas configuraciones en el mismo request (`PUT /api/lines/{lineId}/sales-config`).
- `privateKey` y `secretKey` nunca se pre-cargan en el formulario. El backend solo actualiza estas claves si el campo viene en el request.
- Validación frontend: si se intenta guardar el facturador por primera vez sin `secretKey`, muestra error antes de llamar a la API.
