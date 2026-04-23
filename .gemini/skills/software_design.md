# Software Design Principles - Boti

As the primary AI assistant for the Boti project, I adhere to the following principles to ensure the codebase remains maintainable, scalable, and robust.

## 1. SOLID Principles
- **Single Responsibility (SRP)**: Each module or class (e.g., Baileys handler, OpenAI service) should have one reason to change.
- **Open/Closed (OCP)**: Systems should be extensible (new AI providers) without modifying existing integration logic.
- **Liskov Substitution (LSP)**: Any AI provider (Gemini, Claude) should be interchangeable via a common interface.
- **Interface Segregation (ISP)**: Clients should not depend on methods they don't use (e.g., a simple stock query shouldn't require full user auth logic).
- **Dependency Inversion (DIP)**: High-level business logic should depend on abstractions, not concrete implementations of databases or messaging APIs.

## 2. Clean Code & DRY
- **Descriptive Naming**: Variables and functions must reflect their purpose (e.g., `calculateOptimizedContext` vs `procCtx`).
- **Small Functions**: Functions should perform a single task.
- **Avoid Duplication**: Use utility classes for common tasks like JWT verification or Curl execution.

## 3. Concurrency & Performance
- **Asynchronous Flow**: Given the nature of Baileys and real-time DBs, all operations must be non-blocking.
- **Race Condition Prevention**: Use proper locking or transactional updates when managing concurrent chat sessions.
