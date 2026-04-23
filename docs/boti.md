-Boti sera un chatbot con bayleis la version mas estable posible.
-Se podra integrar con uno o mas numeros de linea para responder a los clientes o derivar a operadores 
-Se debe poder integrar con gemini, openai claude grok por x-api-key para poder entrenarse con la informacion del sistema y el stock disponible y debe poder refrescar su base de conocimientos periodicamente o a pedido por ejemplo consultar stock 
-Se debe poder integrar a cualquier sistema por medio de x-api-key, jwt, usuario password, access key y secret key y los curls para recuperar la data relativamente organizada y detallada y con su json de response de ejemplo especialmente de productos y stock disponible
-Debe recibir un prompt para entender el contexto del negocio y que este optimizado para no perder el contexto de la conversacion con el cliente y asi poder resolver sus dudas o inquietudes de forma precisa y coherente.
-Debe poder manejar conversaciones concurrentes y tener una base de datos en tiempo real de los clientes y sus consultas.
-Debe poder manejar conversations concurrentes pero sin usar exageradamente el contexto largo sino el nombre del cliente y un resumen de la conversacion (ideal del total bien resumido) o los ultimos 10 mensajes (parametrizable desde la app) para mantener el contexto de la conversacion pero optimizando costos
-El diseño debe ser moderno y minimalista pero muy intuitivo y facil de usar por personas no tecnicas. 
-Debe poder enviar pdf, imagenes, links 
-En caso de tener demasiados mensajes debe tener una cola de mensajeria para no sobrecargar la memoria ram.
-Debe tener filtro contra ataques y spam, debe bloquear por 24hs al usuario si detecta mas de 50 mensajes en un minuto.
-Debe poder enviar mensajes en tiempo real a los clientes con un indicador de envio exitoso, fallido o pendiente.
-debe tener un sistema de auditoria para registrar todos los eventos relevantes del sistema y guardar los logs en base de datos y en archivos de texto.
-debe tener un sistema de notificaciones para notificar a los operadores de nuevos mensajes o eventos relevantes.
-debe tener un sistema de permisos y roles para gestionar el acceso al sistema.
-En caso de no tener un sistema debe poder recibir un json de contexto por default con todo el contexto y basarse en ello en caso de no tener un sistema externo donde recuperar la informacion.


El sistema debe estar compuesto por:
-Frontend
-Backend
-Base de datos
-Inteligencia artificial

Y sera un monorepo
Para probar se debe usar docker y docker compose para levantar el entorno completo localmente


MCP de stich del disenho :
REDACTED
## Stitch Instructions

Get the images and code for the following Stitch project's screens:
## Project
Title: Boti AI WhatsApp Manager
ID: 2833983067247269474

## Screens:
1. Design System
    ID: asset-stub-assets-3571e250600c4160900ba7d2f17cd2d7-1776948077858

2. Dashboard - Boti
    ID: e12eb71f7bf6466aab31288ce1065288

3. Message Center - Boti
    ID: c0664aa2e7044c4ca27cf1204bbd1ded

4. WhatsApp Connections - Boti
    ID: d6d298df8f7a40c7b2e9d3ad8a606cb2

5. AI Configuration - Boti
    ID: ea58323ca0e14776a4abb36dd1be1ccd

Use a utility like `curl -L` to download the hosted URLs.