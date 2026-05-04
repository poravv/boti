# Refactor profesional del frontend de Boti

## Diagnóstico actual

El frontend vive en `apps/frontend` y usa React 18, Vite, Tailwind y componentes propios en `src/components/ui`. La aplicación ya tiene tokens visuales, layout responsive y navegación operativa, pero la percepción general sigue siendo informal por exceso de superficies tipo glass, radios grandes en zonas densas, contraste visual poco jerárquico y una composición de mensajería más cercana a una app casual que a una consola de operación.

El centro de mensajes es el flujo crítico. Antes de este refactor, los mensajes entrantes dependían de un WebSocket sin reconexión robusta y el backend emitía `message:new` antes de persistir el mensaje real. Eso obligaba al frontend a inyectar mensajes temporales y luego refrescar tarde, lo que explica que a veces el chat solo apareciera al recargar o cambiar de página.

## Dirección visual

La interfaz debe sentirse como una plataforma B2B de atención y automatización: sobria, compacta, confiable y fácil de escanear durante uso prolongado. No debe parecer una landing, un juguete ni una app de stickers.

Principios:

- Reducir glassmorphism a casos puntuales como header o popovers; usar superficies planas con bordes sutiles.
- Bajar radios en contenedores operativos a `8px` o menos, dejando avatares como únicos elementos completamente redondos.
- Mantener una paleta profesional con base blanca/gris fría, primario oscuro y acentos teal solo para acción, estado activo y foco.
- Priorizar densidad: listas, tablas, conversaciones y formularios deben mostrar más información útil con menos decoración.
- Usar iconografía funcional para acciones repetidas y texto solo donde la acción pueda ser ambigua.

## Tokens recomendados

Colores:

- `background`: `#F5F7FA`
- `surface`: `#FFFFFF`
- `surface-muted`: `#F0F4F8`
- `surface-selected`: `#E8F5F3`
- `primary`: `#0F2A3A`
- `action`: `#0F9F8E`
- `text-primary`: `#111827`
- `text-secondary`: `#4B5563`
- `border-subtle`: `#D7DEE7`
- `success`: `#15803D`
- `warning`: `#B45309`
- `danger`: `#B91C1C`

Forma y elevación:

- Paneles principales: `8px`.
- Inputs, selects y botones: `6px`.
- Cards repetidas: `8px`.
- Sombras solo para overlays, menús, modales y headers elevados.
- Bordes de `1px` con `border-subtle`; evitar sombras permanentes en cada card.

Tipografía:

- Mantener Inter.
- Títulos de página: 18-20px, peso 600.
- Subtítulos de panel: 14-16px, peso 600.
- Listas y tablas: 13-14px.
- Overlines solo para estados o secciones muy pequeñas; no abusar de uppercase.

## Arquitectura de frontend

Refactorizar `apps/frontend/src` en capas claras:

- `components/ui`: primitives sin lógica de negocio.
- `components/layout`: shell, navegación, header, notificaciones.
- `features/messages`: lista de chats, header de conversación, thread, composer, notas internas.
- `features/connections`: gestión de líneas y QR.
- `features/dashboard`: métricas y panel operativo.
- `lib/realtime`: cliente WebSocket con reconexión, heartbeat y eventos tipados.
- `lib/api`: fetchers tipados y manejo de errores.

El objetivo es sacar `MessageCenter.tsx` del formato monolítico. Debe dividirse como mínimo en:

- `MessageCenterPage`
- `ConversationList`
- `ConversationHeader`
- `MessageThread`
- `MessageBubble`
- `InternalNoteBubble`
- `MessageComposer`
- `ContactAvatar`
- `useRealtimeMessages`
- `useConversations`

## Mensajería en tiempo real

Contrato esperado para `message:new`:

```ts
{
  event: 'message:new',
  data: {
    lineId: string;
    clientPhone: string;
    fromPhone: string;
    fromName: string;
    avatarUrl?: string | null;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'PDF';
    message: Message;
    chat: Chat;
  }
}
```

Reglas:

- El backend debe emitir `message:new` después de guardar el mensaje entrante.
- El frontend debe insertar el `message.id` real, no un ID temporal salvo fallback extremo.
- Si el WebSocket cae, el cliente debe reconectar con backoff y mantener heartbeat.
- Al reconectar, cada pantalla crítica debe poder resincronizar su estado con REST.
- El contador de no leídos debe actualizarse por evento y confirmarse por REST.

## Avatares de WhatsApp

Los contactos deben mostrar foto real cuando Baileys pueda obtenerla:

- Guardar `Client.avatarUrl`.
- Resolver con `sock.profilePictureUrl(jid, 'image')`.
- Cachear por línea y teléfono para evitar consultas repetidas.
- Mostrar fallback con inicial sobria cuando WhatsApp no entregue foto.
- Usar avatar en lista, header de conversación y burbujas inbound.

## Baileys

La versión publicada como `latest` en npm para `baileys` y `@whiskeysockets/baileys` es `7.0.0-rc.9`, pero sigue siendo release candidate. Para producción estable conviene usar la última versión no RC y no deprecada: `6.7.21`. La versión `6.17.16` aparece publicada, pero npm la marca como deprecada por versión incorrecta.

Decisión técnica:

- Usar `@whiskeysockets/baileys@6.7.21` para minimizar cambios de importación.
- No usar `7.0.0-rc.9` hasta que exista un release final.
- Mantener reconexión propia por línea con backoff, sin borrar credenciales salvo logout/conflict.

## Migraciones y Kubernetes

Las migraciones deben desplegarse como artefactos versionados, no con sincronización directa del schema. En producción el backend debe ejecutar `npx prisma migrate deploy` contra las carpetas en `apps/backend/prisma/migrations`.

Reglas para CI/CD:

- Cada cambio de schema debe incluir una carpeta nueva en `apps/backend/prisma/migrations`.
- El Dockerfile del backend debe copiar `apps/backend/prisma` al runtime image.
- El entrypoint del backend debe usar `prisma migrate deploy`, nunca `prisma db push`.
- El workflow de GitHub Actions ya detecta cambios en `apps/backend/**`, por lo que una migración reconstruye y despliega la imagen backend.
- En Kubernetes, el rollout actual pausa KEDA y escala backend a 1 réplica antes de desplegar; esto evita ejecuciones paralelas de migración durante el rollout. Si el backend pasa a múltiples réplicas permanentes, conviene mover `migrate deploy` a un Job dedicado previo al rollout.

## Plan de implementación

Fase 1, estabilidad:

- Persistir mensajes inbound antes de emitir WebSocket.
- Añadir payload `message` y `chat` a `message:new`.
- Agregar heartbeat y limpieza de clientes muertos en backend.
- Agregar reconexión con backoff en frontend.
- Agregar `avatarUrl` a clientes y renderizarlo en mensajería.

Fase 2, profesionalización visual:

- Reemplazar contenedores `rounded-2xl` del shell por radios `lg`.
- Reducir sombras `glass` en páginas operativas.
- Convertir Message Center a layout de consola: lista compacta, header fijo, timeline sobria y composer denso.
- Unificar botones de acción en grupos compactos.
- Crear estados vacíos sobrios sin ilustraciones ni textos promocionales.

Fase 3, deuda estructural:

- Extraer hooks y componentes de mensajería.
- Tipar eventos WebSocket.
- Añadir tests unitarios para reducer de conversaciones y manejo de eventos realtime.
- Agregar prueba e2e básica del flujo `message:new`.
