# Boti — Pendientes para Lanzamiento

Este documento cubre todo lo que falta implementar antes de lanzar Boti como producto con clientes pagos. Organizado por área, con prioridad y estado actual.

---

## Estado General

| Área | Progreso | Listo para producción |
|------|----------|-----------------------|
| Core WhatsApp + IA | 90% | ✅ Funciona |
| Autenticación | 70% | ⚠️ Falta RBAC y gestión de usuarios |
| Multi-tenancy | 0% | ❌ No existe |
| Planes y cuotas | 0% | ❌ No existe |
| Seguridad HTTP | 40% | ❌ Sin rate limiting ni validación |
| Frontend — páginas core | 60% | ⚠️ Faltan gestión de usuarios, planes, settings |
| Mensajes multimedia | 25% | ❌ Sin upload ni preview |
| Onboarding | 0% | ❌ No existe |
| Observabilidad | 30% | ⚠️ Logs básicos, sin métricas |
| Infraestructura K8s | 85% | ✅ Casi lista |

---

## 1. Multi-Tenancy (Prioridad: Crítica)

**Problema:** El sistema es actualmente single-tenant. Todos los clientes comparten la misma base de datos sin aislamiento. No se puede lanzar con múltiples clientes pagos en este estado.

### Backend

- [ ] Agregar modelo `Tenant` al schema de Prisma (id, name, slug, planId, createdAt)
- [ ] Agregar modelo `Plan` (id, name, maxLines, maxOperators, maxMessagesPerMonth, price)
- [ ] Agregar modelo `Subscription` (id, tenantId, planId, startsAt, endsAt, status, messagesUsed)
- [ ] Agregar `tenantId` a: `User`, `WhatsAppLine`, `Client`, `Message`, `AuditLog`, `ConversationContext`
- [ ] Middleware `resolveTenant` que inyecte el `tenantId` en cada request autenticado
- [ ] Actualizar todas las queries del router para filtrar por `tenantId` (actualmente sin filtro)
- [ ] Endpoint `POST /api/tenants` para crear un nuevo cliente/tenant (solo super-admin)
- [ ] Endpoint `GET /api/tenants/:id/subscription` para ver el plan y consumo actual
- [ ] Rol super-admin separado del admin del tenant

### Frontend

- [ ] El admin de cada tenant solo ve sus propios datos (actualmente ve todo)
- [ ] No aplica cambios de UI hasta que el backend esté multi-tenant

**Archivos afectados:**
- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/http/router.ts` (todas las queries)
- `apps/backend/src/index.ts` (seed del tenant inicial)

---

## 2. Planes y Cuotas (Prioridad: Crítica)

**Problema:** No existe ningún control de límites. Cualquier cliente podría usar líneas, operadores y mensajes IA ilimitados sin restricción.

### Backend

- [ ] Contador de mensajes IA por suscripción: incrementar en `AIServiceAdapter` antes de cada llamada
- [ ] Verificar cuota antes de llamar a la IA; retornar error si el tenant superó el límite mensual
- [ ] Verificar límite de líneas al crear una nueva (`POST /lines`) según el plan activo
- [ ] Verificar límite de operadores al crear un usuario en un tenant
- [ ] Reset automático del contador `messagesUsed` al inicio de cada mes (job BullMQ o cron)
- [ ] Endpoint `GET /api/subscription/usage` — consumo actual vs límite del plan
- [ ] Alerta cuando el tenant alcanza el 80% de su cuota mensual (notificación WebSocket + email)
- [ ] Bloqueo automático de respuestas IA cuando se supera la cuota (guardar mensaje pero no responder)

### Frontend

- [ ] Banner de alerta cuando el tenant está en 80%+ de cuota mensual
- [ ] Página de uso de plan con barra de progreso de mensajes consumidos
- [ ] Mensaje claro al operador si la IA está bloqueada por cuota

---

## 3. Gestión de Usuarios (Prioridad: Alta)

**Problema:** Solo existe el usuario admin creado por seed. No hay forma de crear operadores desde la UI. Los roles no están verificados en ningún endpoint.

### Backend

- [ ] `POST /api/users` — crear usuario (solo admin del tenant)
- [ ] `GET /api/users` — listar usuarios del tenant
- [ ] `PUT /api/users/:id` — editar nombre, rol, activar/desactivar
- [ ] `DELETE /api/users/:id` — eliminar usuario
- [ ] `POST /api/users/:id/reset-password` — reset de contraseña
- [ ] Verificar `user.role === 'ADMIN'` en endpoints sensibles (crear líneas, configurar IA, ver auditoría)
- [ ] Los operadores solo pueden acceder al inbox y asignar conversaciones; no pueden tocar configuración
- [ ] Validar al crear usuario: email único dentro del tenant, password mínimo 8 caracteres

### Frontend

- [ ] Página `/settings/users` — tabla de usuarios con nombre, rol, estado, acciones
- [ ] Modal "Nuevo Operador" — formulario con nombre, email, rol, contraseña temporal
- [ ] Modal "Editar Usuario" — cambiar nombre, rol, activar/desactivar
- [ ] Botón "Cambiar contraseña" en el perfil del usuario actual
- [ ] Bloquear acceso a páginas de configuración para usuarios con rol OPERATOR

**Archivos afectados:**
- `apps/backend/src/http/router.ts` — agregar endpoints y checks de rol
- `apps/frontend/src/App.tsx` — agregar ruta `/settings/users`
- `apps/frontend/src/components/layout/Sidebar.tsx` — agregar enlace al menú

---

## 4. Seguridad HTTP (Prioridad: Alta)

**Problema:** El sistema no tiene protección contra fuerza bruta ni validación de inputs. Cualquier bot puede intentar login miles de veces o enviar datos malformados.

### Backend

- [ ] Rate limiting en endpoint de login: máximo 5 intentos por IP por minuto (`express-rate-limit`)
- [ ] Rate limiting global en la API: máximo 100 requests por minuto por IP
- [ ] Validación de inputs con Zod en todos los endpoints (ya está en `package.json`, no se usa):
  - `POST /api/auth/login` — validar email y password
  - `POST /api/messages/send` — validar lineId, to (formato E.164), content (max 4096 chars)
  - `PUT /api/lines/:id/config` — validar provider, model, apiKey
  - `PUT /api/lines/:id/context` — validar businessContext (JSON válido), systemPrompt (max 4000 chars)
  - `POST /api/clients/:phone/pause` — validar hours (número positivo, max 72)
- [ ] Eliminar el fallback del JWT secret (`|| 'boti-super-secret-key'`); fallar al arrancar si no está definido
- [ ] Verificar al arranque que todas las variables de entorno requeridas existen
- [ ] Reemplazar los `console.log/console.error` restantes por el logger de Winston

**Archivos afectados:**
- `apps/backend/src/http/router.ts`
- `apps/backend/src/lib/AuthService.ts`
- `apps/backend/src/index.ts`

---

## 5. Frontend — Páginas Faltantes (Prioridad: Alta)

### Páginas a crear

- [ ] **`/settings/users`** — Gestión de usuarios del tenant (ver sección 3)
- [ ] **`/settings`** — Configuración general del tenant: nombre del negocio, zona horaria, plan activo
- [ ] **`/subscription`** — Ver plan actual, consumo mensual, opción de upgrade
- [ ] **`/audit`** — Historial completo de auditoría con filtros por fecha, usuario y acción

### Páginas existentes con features incompletos

- [ ] **Dashboard** — El buscador en el Header dice "Búsqueda próximamente..." (eliminar o implementar)
- [ ] **Dashboard** — La versión en el footer (`v2.0.0`) está hardcodeada; leer del `package.json`
- [ ] **MessageCenter** — Los mensajes de tipo IMAGE y PDF no se muestran; solo muestra texto
- [ ] **AIConfiguration** — No hay feedback si la URL de contexto externo falla al validarse
- [ ] **WhatsAppConnections** — El "Uptime 99.8%" está hardcodeado; debe venir del backend

### UX / Calidad

- [ ] Agregar error boundaries en React para que un crash en una página no tire toda la app
- [ ] Estados de error explícitos en todas las páginas (actualmente algunas muestran pantalla en blanco si falla la API)
- [ ] Confirmación antes de acciones destructivas: desconectar línea, eliminar usuario, bloquear contacto

---

## 6. Mensajes Multimedia (Prioridad: Media)

**Problema:** El schema y Baileys soportan imágenes y PDFs, pero no hay endpoint de upload ni visualización en el chat.

### Backend

- [ ] Endpoint `POST /api/upload` — recibir archivo (multipart/form-data), guardar en disco o S3, retornar URL
- [ ] Configurar almacenamiento: directorio local con PVC en K8s (suficiente para MVP) o S3/compatible
- [ ] Validaciones de upload: tipo MIME (solo image/*, application/pdf), tamaño máximo 10 MB
- [ ] Al recibir imagen/PDF de WhatsApp: descargar el buffer de Baileys y guardarlo para que el operador pueda verlo
- [ ] Endpoint `GET /api/media/:id` — servir el archivo al frontend

### Frontend

- [ ] En el input del chat: botón para adjuntar imagen o PDF
- [ ] Mostrar imagen en el hilo del chat (thumbnail con click para ampliar)
- [ ] Mostrar PDF con ícono y link de descarga en el chat
- [ ] Indicador de progreso al subir archivo

---

## 7. Onboarding (Prioridad: Media)

**Problema:** Un nuevo cliente que entra por primera vez ve el dashboard vacío sin ninguna guía. No sabe que tiene que conectar una línea antes de recibir mensajes.

### Frontend

- [ ] Detección de primer acceso: si el tenant no tiene líneas ni mensajes, mostrar pantalla de bienvenida
- [ ] Checklist de setup visible en el dashboard hasta que se complete:
  1. Conectar primera línea de WhatsApp
  2. Configurar el prompt de sistema de la IA
  3. Agregar contexto del negocio (opcional)
  4. Agregar un operador (opcional)
- [ ] Tooltips de ayuda en cada sección explicando para qué sirve cada configuración
- [ ] Plantillas de system prompt pre-cargadas para elegir: Ventas, Soporte, Clínica, Inmobiliaria

---

## 8. Infraestructura y DevOps (Prioridad: Media)

**Problema:** La infraestructura K8s está casi lista pero tiene algunos gaps de producción.

### Docker

- [ ] Verificar que el frontend Dockerfile no referencia `nginx.conf` inexistente (usa ConfigMap de K8s en producción, pero el Dockerfile debe ser autocontenido para builds locales)
- [ ] Agregar `HEALTHCHECK` instruction en ambos Dockerfiles
- [ ] Agregar usuario no-root en ambos Dockerfiles (`USER node` en backend, `USER nginx` en frontend)
- [ ] Verificar que `netcat` (`nc`) está instalado en el backend Alpine antes de usarlo en `start.sh`

### Kubernetes

- [ ] Agregar `HorizontalPodAutoscaler` o confiar solo en KEDA (actualmente redundante, cleanup)
- [ ] WebSocket en multi-réplica: si el backend escala a 2 pods, los clientes WebSocket conectados a pod A no reciben eventos del pod B. Solución: Redis PubSub adapter para el WebSocketManager
- [ ] Backup automático de la base de datos PostgreSQL (CronJob en K8s)
- [ ] NetworkPolicy para aislar los pods (solo el ingress puede hablar con el frontend, solo el backend puede hablar con postgres/redis)

### Observabilidad

- [ ] Centralizar logs: configurar Winston para escribir a stdout en formato JSON (K8s los captura)
- [ ] Agregar `requestId` a cada request y propagarlo a todos los logs
- [ ] Métricas básicas: endpoint `/api/metrics` con contadores de mensajes, errores y latencia (Prometheus-compatible)

---

## 9. Correcciones Menores (Prioridad: Baja)

Bugs y deuda técnica que no bloquean pero deben resolverse antes del lanzamiento:

- [ ] `console.log` y `console.error` en `router.ts` (líneas 127, 143, 146) → reemplazar por logger
- [ ] `console.error` en `AIServiceAdapter.ts` (línea 100) → reemplazar por logger
- [ ] JWT secret fallback `'boti-super-secret-key'` en `AuthService.ts` → eliminar fallback, fallar fuerte
- [ ] Versión hardcodeada `v2.0.0` en `Login.tsx` → leer de `package.json` o variable de entorno
- [ ] "Uptime 99.8%" hardcodeado en `WhatsAppConnections.tsx` → calcular o eliminar
- [ ] "Búsqueda próximamente..." en `Header.tsx` → eliminar el campo o implementarlo
- [ ] `CONTEXT_MAX_MESSAGES` no está documentado en `.env.example` del backend
- [ ] `start.sh` usa `nc -z postgres 5432` para esperar la DB; verificar que `netcat-openbsd` esté en el Dockerfile

---

## Resumen de Prioridades

### Bloquean el lanzamiento (hacer antes de tener el primer cliente pago)

1. Multi-tenancy — sin esto, todos los clientes ven datos de todos
2. Límites por plan — sin esto, un cliente puede arruinar el costo de toda la plataforma
3. Gestión de usuarios desde la UI — sin esto, agregar operadores requiere acceso directo a la DB
4. Rate limiting en login — mínimo de seguridad para exposición a internet

### Importantes pero no bloquean (hacer en el primer mes)

5. Validación de inputs con Zod
6. Páginas de configuración y plan en el frontend
7. Onboarding básico (checklist de setup)
8. Redis PubSub para WebSocket multi-réplica

### Mejoras para versión estable (hacer en el segundo mes)

9. Mensajes multimedia completos
10. Página de auditoría completa
11. Backups automáticos de PostgreSQL
12. Métricas Prometheus
13. Eliminar hardcodeos y deuda técnica menor
