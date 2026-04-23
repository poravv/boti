# Boti Development Protocol

## 1. Context Optimization Rule
- Include **Last 10 messages** + **Conversation Summary**.
- Keep track of User Name for personalization.

## 2. Security & Anti-Spam
- **Spam Filter**: Monitor message frequency. If a user exceeds 50 messages/minute, block for 24 hours automatically.
- **Audit**: Log every critical event (auth, message sent, error, spam block) to both DB and text logs.

## 3. Media & Messaging
- **Multi-media Support**: Ensure the system can send/receive PDFs, images, and links via Baileys.
- **Status Indicators**: Implement real-time status tracking: `PENDING` -> `SUCCESS` or `FAILED`.
- **Queueing**: Use a persistent queue for outgoing messages to handle spikes without crashing the process.

## 4. Environment & Deployment
- Use **Docker Compose** for local development.
- Maintain a **Monorepo** structure for frontend/backend cohesion.

## 5. Security & Access Control
- **Roles and Permissions**: The dashboard must support RBAC (Role-Based Access Control) to manage operator access.
- **Audit Logs**: All critical actions (settings change, user block, manual message sent) must be logged with the user ID, timestamp, and action details.

## 6. Context & Integrations
- **Fallback Context**: If the external system (e.g., API for stock) is down or unavailable, the system MUST fallback to a default `context.json` file.
- **Notifications**: The system must proactively notify operators (via dashboard or a specific WhatsApp line) of critical events (e.g., AI error, spam attack detected, operator requested).
