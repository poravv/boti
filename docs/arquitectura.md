# Arquitectura de Boti

> Documentación técnica generada el 2026-04-23. Refleja el estado actual del código en `main`.

---

## 1. Overview

**Boti** es una plataforma de atención al cliente automatizada basada en WhatsApp. Permite a las empresas conectar múltiples líneas de WhatsApp, configurar un asistente de IA por línea (OpenAI o Gemini), gestionar conversaciones en tiempo real desde un panel web, e integrar APIs externas para enriquecer el contexto del bot.

### Stack principal

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS, servido con Nginx |
| Backend | Node.js + Express 4 + TypeScript, arquitectura hexagonal |
| Base de datos | PostgreSQL via Prisma ORM |
| Cola de mensajes | BullMQ sobre Redis 7 |
| WhatsApp | @whiskeysockets/baileys (multi-line) |
| IA | OpenAI SDK + @google/generative-ai (seleccionable por línea) |
| WebSockets | ws (servidor nativo sobre HTTP) |
| Infraestructura | Kubernetes (namespace `boti`) + KEDA autoscaler |
| CI/CD | GitHub Actions → GHCR → kubectl (self-hosted runner) |

---

## 2. Diagrama de Arquitectura General

```mermaid
graph TB
  subgraph Cliente["Navegador del operador"]
    Browser["React SPA"]
  end

  subgraph K8s["Kubernetes — namespace: boti"]
    Ingress["Ingress NGINX\nboti.mindtechpy.net\n(TLS cert-manager)"]

    subgraph Frontend["Pod: boti-frontend"]
      Nginx["Nginx\n:80\nSPA estática"]
    end

    subgraph Backend["Pod: boti-backend"]
      Express["Express\n:3001\nHTTP + WS"]
      WsManager["WebSocketManager\n/ws"]
      BullMQ["BullMQ Worker\ncola outbound"]
    end

    subgraph Infra["Infraestructura compartida"]
      PG["PostgreSQL\n:5432"]
      Redis["Redis 7\n:6379"]
    end

    KEDA["KEDA ScaledObject\n(Redis Streams + CPU)"]
  end

  subgraph Externo["Servicios externos"]
    WA["WhatsApp\n(Servidores Meta)"]
    OpenAI["OpenAI API"]
    Gemini["Gemini API\n(@google/generative-ai)"]
    ExternalAPIs["APIs de negocio\n(configurables por línea)"]
  end

  Browser -- "HTTPS / WSS" --> Ingress
  Ingress -- "/api/* + /ws" --> Express
  Ingress -- "/*" --> Nginx
  Express --> PG
  Express --> Redis
  BullMQ --> Redis
  Express --> WsManager
  WsManager -- "WS push" --> Browser
  Express -- "Baileys multi-line" --> WA
  WA -- "mensajes entrantes" --> Express
  Express --> OpenAI
  Express --> Gemini
  Express --> ExternalAPIs
  KEDA -- "escala 1-2 réplicas" --> Backend
```

---

## 3. Arquitectura Hexagonal (Backend)

El backend sigue estrictamente la arquitectura hexagonal: el dominio (core) no depende de ningún framework ni infraestructura. Las dependencias apuntan siempre hacia adentro.

```mermaid
graph LR
  subgraph Infraestructura["Capa de Infraestructura (adapters)"]
    direction TB
    HTTP["HTTP Adapter\nExpress router.ts"]
    PrismaDB["Prisma Repositories\nClientRepo / MessageRepo\nContextRepo / ExternalApiRepo"]
    BaileysWA["BaileysAdapter\nIWhatsAppProvider"]
    AIAdapter["AIServiceAdapter\nIAIService\n(OpenAI / Gemini)"]
    BullMQAdapter["BullMQAdapter\nIMessageQueue"]
    SpamFilter["SpamFilterAdapter"]
    ContextFetcher["ContextFetcherAdapter\nIContextFetcher"]
    AuditAdapter["WinstonAuditAdapter\nIAuditLogger"]
    WSManager["WebSocketManager\nINotifier"]
  end

  subgraph Aplicacion["Capa de Aplicación (use cases)"]
    direction TB
    HandleInbound["HandleInboundMessage\n(caso de uso principal)"]
    SendMessage["SendMessage"]
    BlockClient["BlockClient"]
  end

  subgraph Dominio["Capa de Dominio (core package)"]
    direction TB
    Ports["Puertos outbound\nIWhatsAppProvider\nIClientRepository\nIMessageRepository\nIContextRepository\nIMessageQueue\nIAIService\nIContextFetcher\nIExternalApiRepository\nIAuditLogger\nINotifier"]
    Entities["Entidades\nClient / Message\nWhatsAppLine\nConversationContext\nUser / AuditLog"]
  end

  HTTP --> HandleInbound
  HTTP --> SendMessage
  HTTP --> BlockClient
  HandleInbound --> Ports
  SendMessage --> Ports
  BlockClient --> Ports
  PrismaDB -.->|implementa| Ports
  BaileysWA -.->|implementa| Ports
  AIAdapter -.->|implementa| Ports
  BullMQAdapter -.->|implementa| Ports
  SpamFilter -.->|usa| BlockClient
  ContextFetcher -.->|implementa| Ports
  AuditAdapter -.->|implementa| Ports
  WSManager -.->|implementa| Ports
  Ports --> Entities
```

---

## 4. Diagrama de Base de Datos

Modelos Prisma sobre PostgreSQL. Todos los IDs son UUID.

```mermaid
erDiagram
  Client {
    String id PK
    String phone UK
    String name
    Boolean isBlocked
    DateTime blockedUntil
    DateTime aiPausedUntil
    String assignedToUserId FK
    DateTime createdAt
    DateTime updatedAt
  }

  Message {
    String id PK
    String lineId FK
    String clientPhone FK
    String content
    String type
    String direction
    String status
    DateTime sentAt
    Boolean isRead
    DateTime createdAt
  }

  WhatsAppLine {
    String id PK
    String name
    String phone
    String status
    String systemPrompt
    String assignedAiProvider
    String aiApiKey
    String aiModel
    String contextUrl
    Json contextHeaders
    Json businessContext
    Int maxMessages
    DateTime createdAt
  }

  ConversationContext {
    String id PK
    String lineId
    String clientPhone
    String clientName
    String summary
    Json messages
    DateTime updatedAt
  }

  User {
    String id PK
    String email UK
    String passwordHash
    String name
    String role
    Boolean isActive
    DateTime createdAt
  }

  AuditLog {
    String id PK
    String userId
    String action
    Json details
    String ipAddress
    DateTime createdAt
  }

  ExternalApi {
    String id PK
    String lineId FK
    String name
    String baseUrl
    String method
    Json headers
    String body
    String outputKey
    String username
    String password
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }

  Client ||--o{ Message : "tiene"
  Client }o--|| User : "asignado a"
  WhatsAppLine ||--o{ Message : "contiene"
  WhatsAppLine ||--o{ ExternalApi : "configura"
  ConversationContext }o--|| WhatsAppLine : "pertenece a (lineId)"
  ConversationContext }o--|| Client : "pertenece a (clientPhone)"
```

Valores de enumeración (almacenados como `String`):

| Campo | Valores posibles |
|-------|-----------------|
| `Message.type` | `TEXT`, `IMAGE`, `PDF`, `LINK` |
| `Message.direction` | `INBOUND`, `OUTBOUND` |
| `Message.status` | `PENDING`, `SUCCESS`, `FAILED` |
| `WhatsAppLine.status` | `CONNECTED`, `DISCONNECTED`, `CONNECTING`, `QR_PENDING` |
| `User.role` | `ADMIN`, `OPERATOR` |
| `ExternalApi.method` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |

---

## 5. Flujo de Mensaje Entrante

Recorrido completo desde que WhatsApp recibe un mensaje hasta que el bot responde.

```mermaid
sequenceDiagram
  actor WA as WhatsApp<br/>(servidor Meta)
  participant Baileys as BaileysAdapter
  participant Spam as SpamFilterAdapter<br/>(Redis)
  participant Handler as HandleInboundMessage
  participant ClientRepo as PrismaClientRepository
  participant MsgRepo as PrismaMessageRepository
  participant CtxRepo as PrismaContextRepository
  participant ExtAPI as APIs externas
  participant AI as AIServiceAdapter<br/>(OpenAI / Gemini)
  participant Queue as BullMQAdapter<br/>(Redis)
  participant WSMgr as WebSocketManager
  participant Operator as Panel operador<br/>(React SPA)

  WA->>Baileys: Mensaje entrante (lineId, from, content)
  Baileys->>Spam: check(fromPhone)
  alt Es spam
    Spam-->>WSMgr: broadcast("operator:notification", SPAM_DETECTED)
    WSMgr-->>Operator: WS push — alerta spam
  else No es spam
    Baileys->>Handler: execute({lineId, fromPhone, content})
    Handler->>ClientRepo: upsert(phone, name)
    ClientRepo-->>Handler: Client
    alt Cliente bloqueado
      Handler-->>Baileys: return (silencioso)
    else AI pausada para este cliente
      Handler->>WSMgr: notifyOperators(MANUAL_INTERVENTION_NEEDED)
      WSMgr-->>Operator: WS push — intervención manual
    else Flujo normal
      Handler->>MsgRepo: save(INBOUND, SUCCESS)
      MsgRepo-->>Handler: Message
      Handler->>CtxRepo: get(lineId, clientPhone)
      CtxRepo-->>Handler: ConversationContext (o null)
      Handler->>ExtAPI: fetch APIs activas de la línea
      ExtAPI-->>Handler: resultados enriquecidos
      Handler->>AI: generateReply(systemPrompt + contexto + historial + mensaje)
      AI-->>Handler: replyText
      Handler->>Queue: enqueue(lineId, {to, replyText, type: TEXT})
      Handler->>CtxRepo: save(contexto actualizado)
      Queue->>MsgRepo: save(OUTBOUND, PENDING)
      Queue->>Baileys: sendTextMessage(lineId, to, replyText)
      Baileys->>WA: Envío del mensaje
      WA-->>Baileys: ACK (messageId)
      Queue->>MsgRepo: updateStatus(SUCCESS, sentAt)
      Queue->>WSMgr: broadcast("message:status", {SUCCESS})
      WSMgr-->>Operator: WS push — estado del mensaje
    end
    Baileys->>WSMgr: broadcast("message:new", {lineId, fromPhone, content})
    WSMgr-->>Operator: WS push — mensaje nuevo
  end
```

---

## 6. Flujo de Autenticación

```mermaid
sequenceDiagram
  actor U as Operador / Admin
  participant FE as React SPA
  participant API as Express /api/auth
  participant DB as PostgreSQL

  U->>FE: Ingresa email + contraseña
  FE->>API: POST /api/auth/login {email, password}
  API->>DB: SELECT user WHERE email=?
  DB-->>API: User (passwordHash, role, isActive)
  alt Credenciales inválidas o usuario inactivo
    API-->>FE: 401 Unauthorized
    FE-->>U: Mensaje de error
  else Credenciales válidas
    API->>API: bcrypt.compare(password, hash)
    API->>API: jwt.sign({userId, email, role}, JWT_SECRET)
    API-->>FE: {token, user}
    FE->>FE: localStorage.setItem("token", token)
    FE-->>U: Redirige a /
  end

  Note over FE,API: Llamadas posteriores
  FE->>API: GET /api/* Authorization: Bearer <token>
  API->>API: authMiddleware: jwt.verify(token)
  alt Token inválido / expirado
    API-->>FE: 401
    FE->>FE: dispara auth:unauthorized → logout
  else Token válido
    API-->>FE: 200 + datos
  end

  Note over U,FE: Cambio de contraseña
  U->>FE: Formulario en /profile
  FE->>API: PUT /api/auth/change-password {currentPassword, newPassword}
  API->>DB: Verifica contraseña actual, guarda nuevo hash
  API-->>FE: {status: "ok"}
```

---

## 7. Infraestructura K8s

Todo bajo el namespace `boti` en un clúster Kubernetes con NGINX Ingress y cert-manager.

```mermaid
graph TB
  subgraph Internet
    User["Navegador\nhttps://boti.mindtechpy.net"]
  end

  subgraph K8s_Namespace["Namespace: boti"]
    subgraph Ingress_Layer["Ingress"]
      Ing["Ingress: boti-ingress\nnginx + TLS (Let's Encrypt)\nboti.mindtechpy.net"]
    end

    subgraph Workloads["Workloads"]
      FE_Deploy["Deployment: boti-frontend\nréplicas: 1\nRollingUpdate maxSurge:1\nimage: ghcr.io/elporavv/boti-frontend:latest\nRecursos: 32-128Mi / 20-100m CPU"]
      BE_Deploy["Deployment: boti-backend\nréplicas: 1-2 (KEDA)\nRollingUpdate maxUnavailable:1\nimage: ghcr.io/elporavv/boti-backend:latest\nRecursos: 128-384Mi / 50-300m CPU\nNODE_OPTIONS: --max_old_space_size=384"]
      PG_Deploy["Deployment: postgres\nRecreate strategy\nimage: postgres\nVol: hostPath /data/boti/postgres"]
      Redis_Deploy["Deployment: redis\nRecreate strategy\nimage: redis:7-alpine\nappendonly: yes\nVol: hostPath /data/boti/redis"]
    end

    subgraph Services["Services (ClusterIP)"]
      FE_Svc["Service: boti-frontend-service\n:80 → pod:80"]
      BE_Svc["Service: boti-backend-service\n:80 → pod:3001"]
      PG_Svc["Service: postgres\n:5432 → pod:5432"]
      Redis_Svc["Service: redis\n:6379 → pod:6379"]
    end

    subgraph Autoscaling["Autoscaling"]
      KEDA_Auth["TriggerAuthentication\nredis-trigger-auth"]
      KEDA_SO["ScaledObject: boti-backend-scaledobject\nmin:1 max:2\nTrigger 1: redis-streams\n  stream: bull:boti-outbound:events\nTrigger 2: CPU > 70%\ncooldown: 600s"]
      PDB["PodDisruptionBudget\nboti-backend"]
    end

    subgraph Config["Configuración"]
      CM_Backend["ConfigMap: backend-config"]
      CM_Nginx["ConfigMap: frontend-nginx-config\nNginx SPA config"]
      Secrets["Secret: backend-env-secrets\nDATABASE_URL / REDIS_URL / JWT_SECRET\nSecret: postgres-secrets\nSecret: ghcr-secret"]
    end
  end

  User -- "HTTPS/WSS" --> Ing
  Ing -- "/api/* /ws" --> BE_Svc --> BE_Deploy
  Ing -- "/*" --> FE_Svc --> FE_Deploy
  BE_Deploy --> PG_Svc --> PG_Deploy
  BE_Deploy --> Redis_Svc --> Redis_Deploy
  KEDA_SO -- "escala" --> BE_Deploy
  KEDA_SO --> KEDA_Auth --> Secrets
  PDB --> BE_Deploy
  CM_Backend --> BE_Deploy
  CM_Nginx --> FE_Deploy
```

---

## 8. CI/CD Pipeline

Pipeline en GitHub Actions (`.github/workflows/deploy.yml`), disparado en cada push a `main`. Usa un runner self-hosted con acceso a `kubectl`.

```mermaid
graph LR
  subgraph Trigger
    Push["push → main"]
  end

  subgraph Job1["detect-changes"]
    DC["dorny/paths-filter\noutputs:\n  backend: true/false\n  frontend: true/false"]
  end

  subgraph Job2["build-backend\n(solo si cambió backend/packages/k8s)"]
    BB1["docker/setup-buildx"]
    BB2["Login GHCR\n(GHCR_PAT)"]
    BB3["Build & Push\nghcr.io/.../boti-backend\n:sha-XXXXXXX\n:latest\nplatforms: linux/amd64\ncache: GHA"]
  end

  subgraph Job3["build-frontend\n(solo si cambió frontend/k8s)"]
    BF1["docker/setup-buildx"]
    BF2["Login GHCR"]
    BF3["Build & Push\nghcr.io/.../boti-frontend\n:sha-XXXXXXX\n:latest\nplatforms: linux/amd64\ncache: GHA"]
  end

  subgraph Job4["deploy-infra\n(siempre, idempotente)"]
    DI1["kubectl apply namespace"]
    DI2["Crear/actualizar Secrets\n(ghcr-secret, backend-env-secrets\npostgres-secrets)"]
    DI3["kubectl apply postgres.yaml\nwait --timeout=180s"]
    DI4["kubectl apply redis.yaml\nwait --timeout=120s"]
    DI5["kubectl apply configmap.yaml"]
    DI6["kubectl apply ingress.yaml"]
  end

  subgraph Job5["deploy-backend\n(solo si backend cambió + infra OK)"]
    DB1["Pausar KEDA ScaledObject"]
    DB2["kubectl apply backend-deployment + pdb"]
    DB3["kubectl set image :sha-XXXXXXX"]
    DB4["kubectl rollout status --timeout=600s"]
    DB5["Reanudar KEDA ScaledObject"]
    DB6["Health check\ncurl /api/health ×10"]
  end

  subgraph Job6["deploy-frontend\n(solo si frontend cambió + infra OK)"]
    DF1["kubectl apply frontend-deployment"]
    DF2["kubectl set image :sha-XXXXXXX"]
    DF3["kubectl rollout status --timeout=300s"]
  end

  subgraph Job7["summary\n(siempre)"]
    S1["Imprime estado de pods\nservices, ingress"]
  end

  Push --> DC
  DC -->|backend=true| BB1 --> BB2 --> BB3
  DC -->|frontend=true| BF1 --> BF2 --> BF3
  BB3 --> DI1
  BF3 --> DI1
  DI1 --> DI2 --> DI3 --> DI4 --> DI5 --> DI6
  DI6 -->|backend changed| DB1 --> DB2 --> DB3 --> DB4 --> DB5 --> DB6
  DI6 -->|frontend changed| DF1 --> DF2 --> DF3
  DB6 --> S1
  DF3 --> S1
```

---

## 9. Endpoints HTTP (tabla completa)

Todos los endpoints se montan bajo el prefijo `/api`. Los marcados con **JWT** requieren header `Authorization: Bearer <token>`.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/` | No | Health check raíz — retorna `{status, timestamp}` |
| `POST` | `/api/auth/login` | No | Login con email/contraseña — retorna `{token, user}` |
| `GET` | `/api/auth/me` | JWT | Retorna el payload del token del usuario actual |
| `PUT` | `/api/auth/change-password` | JWT | Cambia la contraseña del usuario autenticado |
| `GET` | `/api/health` | No | Health check — retorna `{status: "ok", ts}` |
| `GET` | `/api/stats` | JWT | Estadísticas globales: mensajes totales, líneas activas, leads, tráfico por hora |
| `GET` | `/api/lines` | JWT | Lista todas las líneas WhatsApp con estado y QR code |
| `POST` | `/api/lines/:lineId/connect` | JWT | Conecta (o reconecta) una línea WhatsApp — inicia flujo QR |
| `POST` | `/api/lines/:lineId/disconnect` | JWT | Desconecta una línea WhatsApp |
| `DELETE` | `/api/lines/:lineId` | JWT | Desconecta y elimina una línea de la BD |
| `GET` | `/api/lines/:lineId/status` | JWT | Estado actual y QR code de una línea |
| `GET` | `/api/lines/:lineId/config` | JWT | Configuración de IA de la línea (systemPrompt, provider, apiKey, model) |
| `PUT` | `/api/lines/:lineId/config` | JWT | Actualiza configuración de IA de la línea |
| `GET` | `/api/lines/:lineId/context` | JWT | Obtiene contexto de negocio y systemPrompt de la línea |
| `PUT` | `/api/lines/:lineId/context` | JWT | Actualiza contexto de negocio y systemPrompt |
| `GET` | `/api/lines/:lineId/external-apis` | JWT | Lista las APIs externas configuradas para la línea |
| `POST` | `/api/lines/:lineId/external-apis` | JWT | Crea una nueva API externa para la línea |
| `PUT` | `/api/lines/:lineId/external-apis/:apiId` | JWT | Actualiza una API externa existente |
| `DELETE` | `/api/lines/:lineId/external-apis/:apiId` | JWT | Elimina una API externa |
| `POST` | `/api/lines/:lineId/external-apis/:apiId/test` | JWT | Prueba en vivo una API externa y retorna la respuesta |
| `GET` | `/api/audit-logs` | JWT | Últimos 50 registros de auditoría ordenados por fecha desc |
| `POST` | `/api/messages/send` | JWT | Encola un mensaje saliente manual `{lineId, to, content, type, mediaPath}` |
| `GET` | `/api/messages/unread-count` | JWT | Conteo total de mensajes entrantes no leídos |
| `GET` | `/api/messages/:phone` | JWT | Historial de mensajes de un cliente (paginado por cursor: `?limit=30&before=<id>`) |
| `POST` | `/api/messages/:phone/read` | JWT | Marca todos los mensajes entrantes del cliente como leídos |
| `GET` | `/api/chats` | JWT | Lista de chats activos con último mensaje, asignación, y conteo de no leídos |
| `POST` | `/api/clients/:phone/pause` | JWT | Pausa la IA para el cliente durante N horas `{hours}` |
| `POST` | `/api/clients/:phone/assign` | JWT | Asigna (o desasigna) un agente a un cliente `{agentId}` |
| `PUT` | `/api/clients/:phone` | JWT | Actualiza el nombre del cliente |
| `GET` | `/api/agents` | JWT | Lista todos los agentes activos `{id, name, role}` |

---

## 10. Eventos WebSocket

El servidor expone un WebSocket en `/ws`. El cliente envía `{event: "ping"}` cada 30 segundos como heartbeat. El servidor hace broadcast a todos los clientes conectados.

| Evento | Dirección | Payload | Cuándo se emite |
|--------|-----------|---------|-----------------|
| `line:status` | Server → Client | `{lineId, status, qrCode}` | La línea Baileys cambia de estado (CONNECTING, QR_PENDING, CONNECTED, DISCONNECTED) |
| `message:new` | Server → Client | `{lineId, fromPhone, clientPhone, fromName, content, type}` | Llega un mensaje entrante no spam |
| `message:status` | Server → Client | `{messageId, status, sentAt}` | El worker BullMQ procesa un mensaje saliente (SUCCESS o FAILED) |
| `operator:notification` | Server → Client | `{lineId, event, details}` | Eventos de sistema: `SPAM_DETECTED`, `AI_ERROR`, `MANUAL_INTERVENTION_NEEDED`, `NEW_MESSAGE` |

El frontend suscribe todos los eventos vía `window.dispatchEvent(new CustomEvent('boti:ws-event', {detail: data}))` y los componentes escuchan `boti:ws-event`.

---

## 11. Stack tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| Frontend | React | 18.3.1 | UI declarativa con hooks |
| Frontend | Vite | 5.4.2 | Build tool y dev server |
| Frontend | Tailwind CSS | 3.4.10 | Estilos utility-first |
| Frontend | React Router DOM | 6.26.1 | Enrutamiento SPA |
| Frontend | TypeScript | 5.5.4 | Tipado estático |
| Frontend | Nginx | alpine | Servidor de archivos estáticos en contenedor |
| Backend | Node.js + Express | 4.19.2 | Servidor HTTP REST + WebSocket |
| Backend | TypeScript | 5.5.4 | Tipado estático |
| Backend | Prisma ORM | 5.16.0 | Acceso a BD tipado, migraciones |
| Backend | ws | 8.17.1 | Servidor WebSocket nativo |
| Backend | BullMQ | 5.12.0 | Cola de mensajes sobre Redis (outbound) |
| Backend | ioredis | 5.4.1 | Cliente Redis (auth state Baileys + BullMQ) |
| Backend | @whiskeysockets/baileys | 7.0.0-rc.9 | Conexión multi-línea a WhatsApp Web |
| Backend | openai | 4.55.0 | SDK OpenAI (GPT-4o, etc.) |
| Backend | @google/generative-ai | 0.18.0 | SDK Gemini (proveedor alternativo de IA) |
| Backend | jsonwebtoken | 9.0.2 | Generación/verificación de tokens JWT |
| Backend | helmet | 7.1.0 | Headers de seguridad HTTP |
| Backend | pino | 9.3.2 | Logger estructurado JSON |
| Base de datos | PostgreSQL | latest | Almacenamiento relacional principal |
| Caché / Cola | Redis | 7-alpine | Autenticación Baileys + cola BullMQ |
| Infraestructura | Kubernetes | — | Orquestación de contenedores |
| Infraestructura | KEDA | v1alpha1 | Autoescalado basado en métricas Redis + CPU |
| Infraestructura | NGINX Ingress | — | Enrutamiento TLS, proxy HTTP/WS |
| Infraestructura | cert-manager | — | Certificados TLS automáticos (Let's Encrypt) |
| CI/CD | GitHub Actions | — | Pipeline build + deploy en self-hosted runner |
| Registro | GHCR | — | Almacenamiento de imágenes Docker |
| Monorepo | npm workspaces | — | `apps/backend`, `apps/frontend`, `packages/core` |
