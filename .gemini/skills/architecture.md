# Architectural Patterns - Boti

The Boti project strictly follows a **Hexagonal Architecture (Ports and Adapters)** for both the frontend and backend within a **Monorepo** structure. This ensures business logic is entirely decoupled from external frameworks, UIs, and databases.

## 1. Project Structure (Monorepo)
- **apps/frontend**: Management Dashboard (React/Next.js or Vite).
- **apps/backend**: Core logic, API, and WebSocket server (Node/TypeScript).
- **packages/shared**: Core domain entities, DTOs, and utility functions shared between ports.
- **infrastructure**: Docker Compose and environment configurations.

## 2. Hexagonal Architecture Principles
- **Domain (Core)**: Contains business rules, entities, and use cases (e.g., `SendMessageUseCase`, `BlockSpammerUseCase`). Zero external dependencies.
- **Ports (Interfaces)**:
  - *Driving Ports (Inbound)*: APIs, WebSockets, or UI controllers that trigger core logic.
  - *Driven Ports (Outbound)*: Interfaces for things the core needs (e.g., `IWhatsAppClient`, `IMessageRepository`).
- **Adapters (Implementations)**:
  - *Driving Adapters*: Express/Fastify routes, React components.
  - *Driven Adapters*: Baileys implementation, Redis Queue, PostgreSQL Repository, Gemini API client.

## 3. Backend Adapters (Infrastructure)
- **WhatsApp Adapter**: Implements `IWhatsAppClient` using Baileys.
- **Queue Adapter**: Implements `IMessageQueue` using Redis.
- **Audit/Logging Adapter**: Implements `IAuditLogger` to save to DB and files.
- **AI Adapter**: Implements `IAIAssistant` wrapping Gemini/OpenAI.


## 4. Frontend Adapters & UI
- **UI Architecture**: Components are strictly Presentational. State management and API calls are handled via Adapters (e.g., Custom Hooks implementing use cases).
- **Fast Framework**: Use a highly performant framework (e.g., Vite + React) for rapid dashboard rendering.
- **Real-time Adapter**: WebSockets implementation to receive live status updates (Success/Failed/Pending).
