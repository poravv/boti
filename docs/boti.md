# Boti — WhatsApp Business Automation Platform

Boti es una plataforma de gestión y automatización de WhatsApp orientada a negocios. Permite conectar múltiples líneas de WhatsApp, responder a clientes con inteligencia artificial configurable por línea, y gestionar conversaciones desde una interfaz web en tiempo real.

---

## Arquitectura

- **Monorepo** con `apps/backend`, `apps/frontend` y `packages/core`
- **Backend:** Node.js + Express, Hexagonal Architecture (Domain → Application → Infrastructure)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Base de datos:** PostgreSQL (Prisma ORM)
- **Cola de mensajes:** Redis + BullMQ
- **WhatsApp:** Baileys (`@whiskeysockets/baileys`)
- **Despliegue:** Kubernetes (KEDA autoscaling) + GitHub Actions CI/CD

---

## Capacidades Funcionales

### 1. Gestión de Líneas WhatsApp

- Conexión de múltiples números simultáneamente (sin límite de líneas)
- Vinculación por código QR generado en tiempo real y mostrado en la UI
- Reconexión automática ante caídas de sesión
- Persistencia de sesión en Redis (sobrevive reinicios del servidor)
- Estados de línea en tiempo real: `CONNECTED`, `DISCONNECTED`, `CONNECTING`, `QR_PENDING`
- Desconexión y desvinculación de líneas desde la UI

### 2. Motor de IA por Línea

- Soporte para múltiples proveedores de IA en la misma instalación:
  - **Google Gemini** (1.5 Flash / 1.5 Pro)
  - **OpenAI** (GPT-4o / GPT-4o-mini)
  - **Anthropic Claude** (integración lista para activar)
  - **Grok** (integración lista para activar)
- Configuración independiente por línea: proveedor, modelo y API key
- Prompt de sistema personalizable por línea (personalidad del bot)
- Contexto de negocio inyectable en formato JSON (FAQs, precios, horarios, catálogo)
- Contexto externo via URL: el sistema puede fetchear datos actualizados desde cualquier API antes de responder
- Historial de conversación configurable (por defecto: últimos 10 mensajes)
- La IA responde automáticamente a mensajes entrantes; los operadores pueden pausarla en cualquier momento

### 3. Centro de Mensajes (Inbox)

- Lista de conversaciones con búsqueda por nombre o teléfono
- Fotos reales de WhatsApp cuando Baileys puede resolver el avatar del contacto
- Vista de hilo por contacto con mensajes ordenados cronológicamente
- Diferenciación visual entre mensajes entrantes (cliente) y salientes (bot/operador)
- Envío manual de mensajes desde la web hacia cualquier contacto
- Indicadores de estado de entrega: Pendiente → Enviado → Fallido
- Conteo de mensajes no leídos por conversación y contador global
- Marcado automático de mensajes como leídos al abrir la conversación
- Actualización en tiempo real sin necesidad de recargar la página (WebSocket con heartbeat y reconexión)
- Latencia de entrega: mensaje procesado en ~1-2 segundos vía BullMQ

### 4. Gestión de Contactos (Clientes)

- Registro automático del contacto al recibir el primer mensaje
- Asignación de conversación a un operador específico desde el inbox
- Modo pausa de IA por contacto (ej. "pausar 1 hora" para atención manual)
- Bloqueo de contactos (permanente o temporal)
- Visualización del agente asignado en la lista de chats

### 5. Anti-Spam y Protección

- Rate limiting por número de teléfono: máximo 50 mensajes por minuto (configurable)
- Bloqueo automático de 24 horas al superar el umbral
- Notificación en tiempo real al operador cuando se detecta spam
- El bloqueo se gestiona en Redis (sin impacto en la base de datos principal)

### 6. Notificaciones en Tiempo Real

- Canal WebSocket en `/ws` para todos los clientes conectados
- Eventos emitidos por el servidor:

| Evento | Cuándo se emite |
|--------|----------------|
| `message:new` | Llega un mensaje entrante o se envía uno saliente |
| `message:status` | Cambia el estado de entrega de un mensaje |
| `line:status` | Una línea cambia de estado (conectada, QR, desconectada) |
| `operator:notification` | Eventos del sistema (spam detectado, errores de envío) |

- Sonido de notificación al recibir mensajes nuevos
- Centro de notificaciones en la UI con historial de eventos

### 7. Dashboard y Métricas

- Mensajes totales y mensajes del día con indicador de tendencia
- Líneas activas en tiempo real
- Total de leads (contactos registrados)
- Tráfico por hora: gráfico de barras de las últimas 15 horas
- Porcentaje de rendimiento del sistema
- Registro de actividad reciente (últimas 5 entradas de auditoría)
- Actualización automática cada 10 segundos

### 8. Ventas Autónomas

- Generación de links de pago PagoPar desde conversaciones de WhatsApp
- Registro persistente de pedidos, pagos, facturas y errores en `SaleRecord`
- Tabla operativa en `/sales` con ventas y reuniones en una sola vista
- Estados normalizados: pedido, pagado, facturado, error de facturación, error de pedido y reunión
- Si el cliente pagó pero falló la facturación, la venta queda marcada como vendida y pendiente de factura manual
- Conservación de datos fiscales relevantes: documento/RUC, nombre o razón social, email y JSON fiscal completo
- Integración opcional con facturador externo mediante body template configurable por línea

### 9. Calendario

- Calendario local basado en Prisma, sin dependencia de Google Calendar
- Citas por línea y cliente
- Creación, reagendamiento y cancelación desde herramientas de IA
- Validación de conflictos, duración y rango máximo de 90 días
- Las compras no se calendarizan automáticamente; solo se crea cita cuando el flujo requiere reunión, turno o servicio agendado

### 10. Auditoría

- Registro persistente en base de datos de todos los eventos relevantes:
  - Mensajes enviados y recibidos
  - Bloqueos de spam
  - Errores de la IA
  - Acciones de usuarios
- Cada entrada incluye: usuario, acción, detalles JSON, IP y timestamp
- Acceso desde el Dashboard con modal de log completo

### 11. Autenticación y Control de Acceso

- Autenticación JWT con expiración de 7 días
- Roles: `ADMIN` y `OPERATOR`
- Admin creado automáticamente al iniciar si no existe
- Logout automático ante token expirado o inválido (evento `auth:unauthorized`)
- Todas las rutas protegidas excepto `/api/health` y `/api/auth/login`

### 12. Cola de Mensajes Salientes

- BullMQ sobre Redis para procesamiento asíncrono de mensajes salientes
- 20 workers concurrentes
- Reintentos automáticos: 3 intentos con backoff exponencial (2s → 4s → 8s)
- KEDA escala los pods del backend según carga de la cola
- Los mensajes nunca se pierden aunque el bot esté bajo carga

---

## Modelo de Datos

### WhatsAppLine
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único de la línea |
| `name` | String | Nombre amigable (ej. "Soporte", "Ventas") |
| `phone` | String? | Número telefónico (se llena al conectar) |
| `status` | Enum | Estado de conexión actual |
| `systemPrompt` | String? | Personalidad/instrucciones del bot |
| `assignedAiProvider` | String? | Proveedor de IA (gemini, openai, anthropic) |
| `aiApiKey` | String? | API key por línea (override del global) |
| `aiModel` | String? | Modelo específico (ej. gpt-4o, gemini-1.5-pro) |
| `businessContext` | JSON? | Contexto del negocio en JSON |
| `contextUrl` | String? | URL externa para fetchear contexto dinámico |
| `maxMessages` | Int | Máximo de mensajes de historial (default: 10) |

### Client
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `phone` | String | Número (clave única) |
| `name` | String | Nombre del contacto |
| `avatarUrl` | String? | Foto de perfil resuelta desde WhatsApp |
| `isBlocked` | Bool | Si está bloqueado |
| `blockedUntil` | DateTime? | Expiración del bloqueo temporal |
| `aiPausedUntil` | DateTime? | IA pausada hasta esta fecha |
| `assignedToUserId` | UUID? | Operador asignado |

### Message
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `lineId` | UUID | Línea que envió/recibió |
| `clientPhone` | String | Teléfono del contacto |
| `content` | String | Texto del mensaje |
| `type` | Enum | TEXT, IMAGE, PDF, LINK |
| `direction` | Enum | INBOUND, OUTBOUND |
| `status` | Enum | PENDING, SUCCESS, FAILED |
| `isRead` | Bool | Si fue leído por el operador |

### SaleRecord
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `lineId` | UUID | Línea donde ocurrió la venta |
| `clientPhone` | String | Teléfono del comprador |
| `productName` | String | Producto o servicio solicitado |
| `description` | String? | Detalle del pedido |
| `amount` | Int | Monto en PYG |
| `status` | Enum | PENDING, PAID, INVOICED, PAID_INVOICE_FAILED, FAILED |
| `paymentUrl` | String? | Link de pago PagoPar |
| `invoiceId` | String? | ID de factura si fue emitida |
| `receptorDocumento` | String? | Documento/RUC para factura manual |
| `receptorNombre` | String? | Nombre o razón social |
| `receptorEmail` | String? | Email fiscal |
| `fiscalData` | JSON? | Datos fiscales completos |
| `failureStage` | String? | Etapa donde falló el flujo |
| `failureReason` | String? | Detalle del error |

---

## Flujos Principales

### Mensaje entrante (cliente → bot)
1. Baileys recibe el mensaje de WhatsApp
2. Filtro anti-spam: si supera el umbral, bloquea y notifica
3. Se guarda el cliente, chat y mensaje en la base de datos
4. Se emite `message:new` por WebSocket con el `message` y `chat` reales
5. Se verifica si la IA está pausada para ese contacto
6. Se obtiene el contexto del negocio y el historial de conversación
7. Se llama a la IA con system prompt + contexto + historial
8. La respuesta se encola en BullMQ
9. BullMQ worker envía el mensaje vía Baileys
10. Se emite el mensaje saliente por WebSocket → la UI se actualiza en tiempo real

### Conexión de nueva línea
1. Admin abre `/connections` y hace clic en "Nueva Conexión"
2. Ingresa nombre amigable → POST `/api/lines/{id}/connect`
3. Baileys genera código QR
4. Se emite `line:status: QR_PENDING` → la UI muestra el QR
5. El admin escanea con su teléfono
6. WhatsApp confirma → `line:status: CONNECTED`
7. La línea aparece disponible en AI Configuration

---

## Endpoints HTTP

| Método | Ruta | Función |
|--------|------|---------|
| POST | `/api/auth/login` | Autenticación, retorna JWT |
| GET | `/api/auth/me` | Perfil del usuario actual |
| GET | `/api/lines` | Listar líneas con estado y QR |
| POST | `/api/lines/:id/connect` | Iniciar conexión / generar QR |
| POST | `/api/lines/:id/disconnect` | Desconectar línea |
| GET | `/api/lines/:id/status` | Estado actual + QR |
| GET | `/api/lines/:id/config` | Config de IA (proveedor, modelo) |
| PUT | `/api/lines/:id/config` | Actualizar config de IA |
| GET | `/api/lines/:id/context` | Contexto del negocio + system prompt |
| PUT | `/api/lines/:id/context` | Actualizar contexto + system prompt |
| GET | `/api/chats` | Lista de chats con último mensaje |
| GET | `/api/messages/:phone` | Historial con un contacto |
| POST | `/api/messages/send` | Enviar mensaje manual |
| POST | `/api/messages/:phone/read` | Marcar mensajes como leídos |
| GET | `/api/messages/unread-count` | Contador global de no leídos |
| POST | `/api/clients/:phone/pause` | Pausar IA para un contacto |
| POST | `/api/clients/:phone/assign` | Asignar contacto a operador |
| GET | `/api/lines/:lineId/sales` | Historial unificado de ventas, pagos, facturas, errores y reuniones |
| GET | `/api/agents` | Listar operadores activos |
| GET | `/api/stats` | Métricas del dashboard |
| GET | `/api/audit-logs` | Últimas 50 entradas de auditoría |
| GET | `/api/health` | Health check (sin auth) |

---

## Infraestructura de Producción

- **Kubernetes** con namespace dedicado `boti`
- **PostgreSQL** con PVC persistente (Longhorn)
- **Redis** con PVC persistente (Longhorn)
- **KEDA** autoscaling: escala el backend de 1 a 2 réplicas según carga de la cola y CPU
- **cert-manager** con Let's Encrypt para TLS automático
- **nginx Ingress** con soporte WebSocket nativo en `/ws`
- **GitHub Actions** con runner self-hosted: build → push a GHCR → deploy en K8s
- **Prisma migrations** aplicadas con `npx prisma migrate deploy` al iniciar el backend
- **Health checks** automáticos en el pipeline; rollback manual en caso de falla
