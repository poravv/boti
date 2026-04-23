# Boti AI WhatsApp Manager - Development Plan

This document outlines the architecture, technology stack, and step-by-step execution plan for the Boti project. It has been generated based on the requirements in `docs/boti.md` and incorporates industry-standard features necessary for this type of system.

## 1. Additional Features Identified (Pre-added)

Based on experience with Baileys and WhatsApp chatbots, I have added the following critical features to the plan:
1.  **Graceful Shutdown**: Essential to ensure messages currently in the queue or being processed by Baileys are safely saved or completed before the server restarts.
2.  **State & Session Recovery**: If the server crashes, Baileys must reconnect without losing the context of ongoing conversations or resending duplicate messages.
3.  **Health Checks & Telemetry**: APIs (`/health`, `/metrics`) to allow Docker/Kubernetes to monitor if the WhatsApp connection is truly alive, not just the Node process.

## 2. Architecture & Tech Stack

We will use a **Monorepo** structure managed by `npm workspaces` (or `pnpm`/`turborepo` if preferred). The entire system follows **Hexagonal Architecture (Ports and Adapters)**.

### Tech Stack
-   **Frontend**: Vite + React + Vanilla CSS/Modules (Fast, lightweight).
-   **Backend**: Node.js + TypeScript + Express/Fastify.
-   **Database**: PostgreSQL (Persistence) + Redis (Queue, Cache, Rate Limits).
-   **Infrastructure**: Docker + Docker Compose.

### Monorepo Structure
```text
/boti
├── apps/
│   ├── frontend/       (Vite + React - Dashboard UI)
│   └── backend/        (Node.js + Baileys + API)
├── packages/
│   ├── core/           (Domain Entities, Use Cases, Interfaces/Ports)
│   ├── infrastructure/ (Database Repositories, Redis Queue Adapter)
│   └── shared/         (Common DTOs, Types)
└── docker-compose.yml
```

## 3. Execution Phases

### Phase 1: Infrastructure & Monorepo Initialization
1.  Initialize the monorepo structure and base `package.json`.
2.  Create the `docker-compose.yml` including PostgreSQL and Redis.
3.  Set up the `packages/core` directory to define the Hexagonal Ports (`IMessageRepository`, `IWhatsAppClient`, `IAIService`).

### Phase 2: Backend Core & WhatsApp Provider
1.  Implement the Baileys adapter (connection, multi-line support, state recovery).
2.  Implement the **Message Queue** using BullMQ to handle incoming/outgoing messages asynchronously.
3.  Implement the **Context Manager** (Last 10 messages + Summary logic).

### Phase 3: AI & Integrations
1.  Implement the AI Adapters (Gemini, OpenAI, Claude).
2.  Implement the fallback mechanism (read from `context.json` if external API fails).
3.  Implement the external system HTTP integration ports (`x-api-key`, `jwt`).

### Phase 4: Security & Audit
1.  Implement the **Anti-Spam Filter** middleware (blocks >50 msgs/min using Redis).
2.  Implement the **Audit System** (log critical events to DB and files).
3.  Implement Roles & Permissions logic for the API.

### Phase 5: Frontend Dashboard
1.  Initialize the Vite React app.
2.  Implement the UI based on the `example` HTML/CSS provided by the user.
3.  Connect the frontend to the backend via WebSockets for real-time status (`PENDING`, `SUCCESS`, `FAILED`) and notifications.
