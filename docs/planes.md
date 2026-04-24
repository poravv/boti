# Boti — Planes y Estrategia Comercial (Mercado Paraguay)

> **Modelo de costos actualizado**: Cada cliente configura su propia API key de IA (OpenAI, Gemini, etc.).
> Boti no asume ningún costo de tokens. El gasto de IA corre 100% por cuenta del cliente en todos los planes.

---

## Planes

### Básico — Gs. 150.000 / mes
> Para emprendedores, tiendas pequeñas y freelancers que quieren automatizar su primer número.

| Límite | Valor |
|--------|-------|
| Líneas WhatsApp | 1 |
| Operadores | 1 |
| Mensajes IA / mes | 1.000 |
| Proveedor IA | El cliente configura su propia API key |
| Dashboard | Básico (métricas simples) |
| Soporte | Email, 48h hábiles |

**Incluye:**
- Conexión QR de 1 número
- Respuestas automáticas con IA (OpenAI, Gemini, Claude — a elección del cliente)
- Historial de conversaciones
- 1 prompt de sistema básico

**No incluye:**
- Asignación de operadores
- Contexto JSON personalizado
- APIs externas
- Pausa de IA por contacto

---

### Growth — Gs. 380.000 / mes
> El plan principal. Para negocios que ya tienen volumen y necesitan escalar sin contratar más gente.

| Límite | Valor |
|--------|-------|
| Líneas WhatsApp | 5 |
| Operadores | 5 |
| Mensajes IA / mes | 5.000 |
| Proveedor IA | El cliente configura su propia API key (todos los proveedores) |
| Dashboard | Completo (métricas + auditoría) |
| Soporte | WhatsApp directo, 24h hábiles |

**Incluye todo lo del Básico más:**
- Múltiples líneas y operadores
- Asignación de conversaciones a operadores
- Pausa de IA por contacto para atención manual
- Contexto de negocio en JSON (FAQs, precios, horarios)
- Selección de proveedor y modelo de IA por línea
- APIs externas (hasta 3 integraciones por línea)
- Dashboard completo con tráfico por hora y auditoría

**No incluye:**
- APIs externas ilimitadas
- Soporte prioritario
- Informes exportables

---

### Enterprise — Gs. 1.500.000+ / mes
> Para e-commerce serios, clínicas, inmobiliarias, academias grandes, call centers y empresas medianas.

| Límite | Valor |
|--------|-------|
| Líneas WhatsApp | Ilimitadas |
| Operadores | Ilimitados |
| Mensajes IA / mes | Ilimitados (según capacidad acordada) |
| Proveedor IA | Todos (OpenAI, Gemini, Claude, Grok — API key del cliente) |
| Dashboard | Completo + reportes exportables |
| Soporte | Soporte directo, SLA definido |

**Incluye todo el Growth más:**
- Líneas y operadores sin tope
- APIs externas ilimitadas por línea
- Features custom a medida según contrato
- Reportes y exportación de conversaciones
- Capacitación incluida
- Infraestructura dedicada disponible (costo adicional)

**Precio base:** Gs. 1.500.000 / mes + setup inicial

---

## Setup Inicial (único pago)

Cobrar setup es la estrategia más efectiva en PY. Los clientes pagan más fácil un pago único que una mensualidad alta.

| Paquete | Precio | Incluye |
|---------|--------|---------|
| Setup Básico | Gs. 200.000 | Conexión del número + configuración de API key + prompt de sistema |
| Setup Completo | Gs. 350.000 | Todo lo anterior + carga de FAQs + contexto JSON + configuración de APIs externas |
| Setup Enterprise | Gs. 500.000+ | Todo lo anterior + integración con sistemas del cliente + capacitación del equipo |

**Regla:** Nunca hacer setup gratis. El tiempo de configuración es trabajo real y el cliente lo valorará más si lo paga.

---

## Límites de Mensajes IA — Por Qué Son Necesarios

El límite ya no protege el costo de tokens (ese costo es del cliente). Protege los recursos de la plataforma compartida.

Cada mensaje procesado consume:
- CPU para encolamiento y procesamiento (BullMQ)
- Conexiones WebSocket y Redis
- Escrituras en base de datos (mensajes, contexto, auditoría)
- Ancho de banda del servidor

| Plan | Mensajes/mes | Costo de infraestructura aprox. | Margen |
|------|-------------|--------------------------------------|--------|
| Básico | 1.000 | Gs. 8.000 | Muy alto |
| Growth | 5.000 | Gs. 30.000 | Alto |
| Enterprise | Ilimitados | Acordado en contrato | Controlado |

**El costo de tokens de IA (OpenAI, Gemini, etc.) corre 100% por cuenta del cliente en todos los planes.**

---

## Estrategia de Pricing para Paraguay

### Sensibilidad al precio local

| Precio mensual | Reacción típica del cliente PY |
|---------------|-------------------------------|
| Gs. 100.000–150.000 | "Ok, pruebo" — entrada sin fricción |
| Gs. 300.000–400.000 | "Lo pienso" — necesita ver el valor claramente |
| Gs. 600.000–900.000 | "¿Qué incluye exactamente?" — justificar con ROI |
| Gs. 1.000.000+ | "Esto ya es empresa grande" — necesita contrato |

### Cómo posicionar el producto

**No decir:**
> "Automatización de WhatsApp con IA"

**Decir:**
> "Tu negocio responde clientes 24/7 y genera ventas sin contratar más gente. Conectas tu propio proveedor de IA, nosotros ponemos la plataforma."

El mercado PY responde a resultados concretos y ahorro de costo laboral, no a tecnología.

### Argumento ante "¿por qué pago si yo pongo la API key?"

El valor de Boti **no es la IA** — esa la pone el cliente. El valor es:
- Infraestructura 24/7 en servidor dedicado
- Integración con WhatsApp Business (legal, estable, multi-línea)
- Panel multiagente con asignaciones y auditoría
- Contexto de negocio, FAQs y APIs externas conectadas
- Todo listo para usar, sin desarrollo propio

### Errores frecuentes a evitar

| Error | Consecuencia |
|-------|-------------|
| Cobrar Gs. 50.000 | Clientes de bajo valor, soporte excesivo, no cubre costos |
| No cobrar setup | Trabajo gratis desde el día 1, el cliente no lo valora |
| No limitar mensajes | Los recursos de plataforma escalan con el volumen |
| Bajar precio por miedo | Posiciona el producto como commodity, difícil de subir después |

---

## Proyección Realista (escenario conservador)

| Plan | Clientes | Precio | Ingreso mensual |
|------|----------|--------|-----------------|
| Básico | 15 | Gs. 150.000 | Gs. 2.250.000 |
| Growth | 30 | Gs. 380.000 | Gs. 11.400.000 |
| Enterprise | 3 | Gs. 1.500.000 | Gs. 4.500.000 |
| **Total** | **48** | | **Gs. 18.150.000 / mes** |

### Estructura de costos operativos (sin costo de IA)

| Concepto | Costo mensual estimado |
|----------|----------------------|
| Servidor K8s (VPS dedicado) | Gs. 350.000 |
| Dominio + SSL | Gs. 15.000 |
| Backups + ancho de banda | Gs. 50.000 |
| **Total infraestructura** | **Gs. 415.000 / mes** |

**Margen bruto a 48 clientes: ~97.7%**
*(Gs. 18.150.000 ingreso − Gs. 415.000 infra = Gs. 17.735.000 margen)*

El costo de IA se eliminó completamente del modelo operativo de Boti.

---

## Implicancias Técnicas Pendientes

| Funcionalidad | Estado actual | Prioridad |
|---------------|--------------|-----------|
| Tabla `Plan` y `Subscription` en DB | Pendiente | Alta |
| Límite de mensajes IA por mes | Pendiente | Alta |
| Límite de líneas por tenant | Pendiente | Alta |
| Límite de operadores por tenant | Pendiente | Media |
| Multi-tenancy (aislamiento por cliente) | Pendiente | Alta |
| Panel de administración de suscripciones | Pendiente | Media |
| Alerta cuando el cliente llega al 80% del límite | Pendiente | Media |
| Bloqueo automático al superar límite | Pendiente | Alta |
| Reportes exportables (Enterprise) | Pendiente | Baja |
