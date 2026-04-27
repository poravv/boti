# Boti — WhatsApp Business Automation Platform

Plataforma SaaS multi-tenant para automatizar WhatsApp Business con IA. Permite conectar múltiples líneas de WhatsApp, gestionar conversaciones en tiempo real y delegar respuestas a modelos de IA (Gemini, OpenAI, Claude, Grok).

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20 + Express + TypeScript |
| Frontend | React 18 + Vite + Tailwind CSS |
| Base de datos | PostgreSQL 15 (Prisma ORM) |
| Caché / colas | Redis 7 + BullMQ |
| WhatsApp | Baileys (multi-línea) |
| Autenticación | Firebase Auth + JWT propio |
| Infra | Docker Compose (local) · Kubernetes + KEDA (prod) |
| CI/CD | GitHub Actions → GHCR → kubectl rollout |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React/Vite)  →  nginx (port 80)          │
│  SPA + WebSocket client                             │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP + WS
┌──────────────────────▼──────────────────────────────┐
│  Backend (Express)  port 3001                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Auth JWT   │  │  REST router │  │  WS hub   │  │
│  └─────────────┘  └──────┬───────┘  └───────────┘  │
│                          │                          │
│  ┌───────────────────────▼──────────────────────┐  │
│  │  Hexagonal core                              │  │
│  │  Domain: Client · Message · WhatsAppLine     │  │
│  │  Use Cases: HandleInbound · SendMessage      │  │
│  │  Ports: AIPort · WhatsAppPort · QueuePort    │  │
│  └───────┬──────────────────┬───────────────────┘  │
│          │                  │                       │
│  ┌───────▼──────┐  ┌────────▼────────┐             │
│  │  Prisma      │  │  BullMQ workers │             │
│  │  (Postgres)  │  │  (Redis)        │             │
│  └──────────────┘  └────────┬────────┘             │
│                             │                       │
│  ┌──────────────────────────▼────────────────────┐ │
│  │  Baileys adapters (1 por línea WhatsApp)      │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

El flujo de un mensaje entrante:

1. WhatsApp → Baileys → filtro de spam (Redis)
2. Upsert de cliente + guardado de mensaje (Prisma)
3. Chequeo de pausa de IA y asignación de operador
4. Fetch de contexto de conversación + APIs externas
5. Llamada al proveedor de IA (OpenAI / Gemini / Claude)
6. Encolado de respuesta (BullMQ) → envío por Baileys
7. Broadcast vía WebSocket al panel web

---

## Variables de entorno

Copiar `.env.example` → `.env` en la raíz del repo (usado por Docker Compose):

```env
# Base de datos
DATABASE_URL=postgresql://boti_user:boti_password@postgres:5432/boti_db?schema=public

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=cambia-esto-en-produccion

# IA (cada org provee sus propias keys desde el panel)
GEMINI_API_KEY=
OPENAI_API_KEY=

# App
PORT=3001
NODE_ENV=production
CONTEXT_MAX_MESSAGES=15
SPAM_THRESHOLD=50
BACKEND_BASE_URL=http://localhost:3001

# Firebase Auth (backend — verificación de tokens)
FIREBASE_AUTH_ENABLED=true
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   # JSON completo de la service account

# Firebase (frontend — bakeado en build por Vite)
VITE_WS_URL=ws://localhost:3001
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> **FIREBASE_SERVICE_ACCOUNT_JSON**: descargar desde Firebase Console → Project Settings → Service Accounts → "Generate new private key". Pegar el JSON completo como una sola línea.

---

## Correr en local (Docker Compose)

```bash
# Primera vez
cp .env.example .env   # completar variables

# Levantar todo
docker-compose up --build -d

# Ver logs
docker-compose logs -f backend

# Aplicar migraciones manualmente si es necesario
docker exec boti-backend npx prisma migrate deploy
```

Servicios expuestos:
- `http://localhost` → Frontend
- `http://localhost:3001` → Backend API
- `localhost:5432` → PostgreSQL
- `localhost:6379` → Redis

---

## Desarrollo local (sin Docker)

```bash
# Instalar dependencias
npm install

# Levantar PostgreSQL y Redis (Docker)
docker-compose up postgres redis -d

# Backend (hot-reload)
npm run dev -w @boti/backend

# Frontend (hot-reload)
npm run dev -w @boti/frontend
```

El frontend dev server corre en `http://localhost:5173` y hace proxy al backend en `3001`.

---

## Firebase Auth

La autenticación usa Firebase Auth en el cliente y valida tokens en el backend con Firebase Admin SDK.

**Flujo:**
1. Usuario hace login con Google o Email/Password en Firebase
2. El cliente obtiene el `idToken` de Firebase
3. `POST /api/auth/firebase-session` — el backend verifica el token, crea/actualiza el usuario en Postgres, devuelve un **JWT propio** (7 días)
4. Todas las llamadas API subsiguientes usan el JWT propio en el header `Authorization: Bearer <token>`

**Primer login:** crea automáticamente una Organización + asigna plan Trial (15 días).

**Super admin:** el email `andyvercha@gmail.com` recibe rol `SUPERADMIN` y plan Enterprise automáticamente en su primer login.

**Setup Firebase:**
1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Authentication → Email/Password y Google
3. Descargar service account JSON y pegarlo en `FIREBASE_SERVICE_ACCOUNT_JSON`
4. Agregar dominio de producción en Authentication → Authorized domains

---

## Base de datos

```bash
# Crear nueva migración (desarrollo)
npx prisma migrate dev --name descripcion -w @boti/backend

# Aplicar migraciones en producción
npx prisma migrate deploy

# Abrir Prisma Studio
npx prisma studio -w @boti/backend
```

**Modelos principales:**

| Modelo | Descripción |
|---|---|
| `Organization` | Tenant raíz — tiene plan, trial, usage tracking |
| `Plan` | Definición de límites (lines, users, conversations) |
| `User` | Operador/Admin con rol: `OPERATOR`, `ADMIN`, `SUPERADMIN` |
| `WhatsAppLine` | Línea conectada con config de IA, prompt, APIs externas |
| `Client` | Contacto de WhatsApp (por número de teléfono) |
| `Message` | Cada mensaje enviado/recibido |
| `ConversationContext` | Historial resumido por (línea, contacto) |
| `ExternalApi` | API externa que el bot consulta al responder |
| `Appointment` | Citas agendadas por el bot (Google Calendar) |
| `SaleRecord` | Ventas registradas (PagoPar + Facturador) |

---

## API — Resumen de endpoints

Todos requieren `Authorization: Bearer <token>` salvo los marcados con `(público)`.

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Login email/password (legado) |
| `POST` | `/api/auth/firebase-session` | Intercambia idToken Firebase → JWT propio |
| `GET` | `/api/auth/me` | Usuario actual |
| `PUT` | `/api/auth/change-password` | Cambiar contraseña |
| `GET` | `/api/health` | Health check (público) |

### Líneas WhatsApp
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/lines` | Listar líneas del tenant |
| `POST` | `/api/lines/:id/connect` | Iniciar conexión (genera QR) |
| `POST` | `/api/lines/:id/disconnect` | Desconectar |
| `GET/PUT` | `/api/lines/:id/config` | Config de IA (provider, model, key) |
| `GET/PUT` | `/api/lines/:id/context` | Contexto de negocio + system prompt |
| `GET/POST/PUT/DELETE` | `/api/lines/:id/external-apis` | APIs externas del bot |
| `POST` | `/api/lines/:id/external-apis/:apiId/test` | Probar API en vivo |

### Conversaciones
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/chats` | Lista de chats activos con filtros |
| `GET` | `/api/messages/:phone` | Historial paginado |
| `POST` | `/api/messages/send` | Enviar mensaje manual |
| `POST` | `/api/clients/:phone/pause` | Pausar IA N horas |
| `POST` | `/api/clients/:phone/unpause` | Reanudar IA |
| `POST` | `/api/clients/:phone/assign` | Asignar operador |
| `POST` | `/api/clients/:phone/close` | Cerrar conversación |
| `POST` | `/api/clients/:phone/reopen` | Reabrir conversación |

### Admin del tenant (rol ADMIN o SUPERADMIN)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/stats` | Métricas del dashboard |
| `GET/POST/PUT/DELETE` | `/api/users` | Gestión de usuarios del tenant |
| `GET` | `/api/org/plan` | Plan actual + uso |
| `GET` | `/api/audit-logs` | Últimas 50 entradas de auditoría |

### Super Admin (solo rol SUPERADMIN)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/stats` | Estadísticas globales del SaaS |
| `GET/PATCH` | `/api/admin/orgs` | Listar y editar organizaciones |
| `GET/POST/PUT` | `/api/admin/plans` | Gestionar planes |
| `GET/POST/DELETE` | `/api/admin/superadmins` | Gestionar super admins |

### WebSocket events (ws://host/ws?token=JWT)
| Evento | Dirección | Descripción |
|---|---|---|
| `message:new` | server→client | Nuevo mensaje (entrante o enviado) |
| `message:status` | server→client | Cambio de estado de entrega |
| `line:status` | server→client | Cambio de estado de línea |
| `conversation:assigned` | server→client | Asignación de operador |
| `conversation:status` | server→client | Apertura/cierre |
| `operator:notification` | server→client | Alertas del sistema |
| `sale:paid` | server→client | Pago confirmado |
| `note:new` | server→client | Nota interna añadida |

---

## Planes y límites

| Plan | Precio | Líneas | Usuarios | Conv/mes |
|---|---|---|---|---|
| Trial | Gratis | 1 | 2 | 200 |
| Starter | $29 | 1 | 5 | 1.000 |
| Pro | $79 | 3 | 15 | 5.000 |
| Enterprise | $199 | ∞ | ∞ | ∞ |

El trial dura 15 días. Al vencer se bloquea el acceso hasta asignar un plan pago. Los límites se verifican en el middleware `checkPlanLimit` antes de crear líneas o usuarios.

---

## Roles de usuario

| Rol | Capacidades |
|---|---|
| `OPERATOR` | Ver chats asignados, enviar mensajes, agregar notas |
| `ADMIN` | Todo lo anterior + gestionar líneas, usuarios, configuración de IA |
| `SUPERADMIN` | Todo lo anterior + panel global: orgs, planes, otros super admins |

---

## CI/CD

El pipeline `.github/workflows/deploy.yml`:
1. Build de imagen Docker backend/frontend → push a GHCR
2. `kubectl set image` en el cluster para hacer rollout
3. Variables sensibles como `FIREBASE_SERVICE_ACCOUNT_JSON` y `JWT_SECRET` se inyectan como Kubernetes secrets

**Secrets requeridos en GitHub:**

```
JWT_SECRET
DATABASE_URL
REDIS_URL
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_WS_URL
KUBECONFIG (o KUBE_CONFIG_DATA)
```

---

## Estructura del repositorio

```
boti/
├── apps/
│   ├── backend/
│   │   ├── prisma/              # Schema + migraciones
│   │   ├── src/
│   │   │   ├── domain/          # Entidades y puertos (sin dependencias externas)
│   │   │   ├── application/     # Casos de uso
│   │   │   ├── adapters/        # Baileys, AI, BullMQ, WebSocket
│   │   │   ├── http/            # router.ts — todos los endpoints REST
│   │   │   └── lib/             # AuthService, Firebase, helpers
│   │   └── Dockerfile
│   └── frontend/
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/          # Componentes base: Button, Badge, Card, Modal
│       │   │   ├── layout/      # Sidebar, AppShell
│       │   │   └── pages/       # Una página por ruta
│       │   └── lib/             # apiClient, firebase, hooks
│       ├── tailwind.config.js
│       ├── nginx.conf
│       └── Dockerfile
├── packages/
│   └── core/                    # Tipos compartidos entre frontend y backend
├── docs/                        # Documentación adicional
├── docker-compose.yml
└── .env                         # Variables de entorno (no commitear)
```
