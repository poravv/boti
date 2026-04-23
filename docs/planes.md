# Boti — Planes y Estrategia Comercial (Mercado Paraguay)

---

## Planes

### Básico — Gs. 150.000 / mes
> Para emprendedores, tiendas pequeñas y freelancers que quieren automatizar su primer número.

| Límite | Valor |
|--------|-------|
| Líneas WhatsApp | 1 |
| Operadores | 1 |
| Mensajes IA / mes | 500 |
| Proveedor IA | Gemini Flash (costo menor) |
| Dashboard | Básico (métricas simples) |
| Soporte | Email, 48h hábiles |

**Incluye:**
- Conexión QR de 1 número
- Respuestas automáticas con IA
- Historial de conversaciones
- 1 prompt de sistema (sin configuración avanzada)

**No incluye:**
- Asignación de operadores
- Contexto JSON personalizado
- Configuración de modelo/proveedor de IA
- Pausa de IA por contacto

---

### Growth — Gs. 380.000 / mes
> El plan principal. Para negocios que ya tienen volumen y necesitan escalar sin contratar más gente.

| Límite | Valor |
|--------|-------|
| Líneas WhatsApp | 5 |
| Operadores | 5 |
| Mensajes IA / mes | 3.000 |
| Proveedor IA | Gemini Pro, OpenAI GPT-4o-mini (a elección) |
| Dashboard | Completo (métricas + auditoría) |
| Soporte | WhatsApp directo, 24h hábiles |

**Incluye todo lo del Básico más:**
- Múltiples líneas y operadores
- Asignación de conversaciones a operadores
- Pausa de IA por contacto para atención manual
- Contexto de negocio en JSON (FAQs, precios, horarios)
- Selección de proveedor de IA por línea
- Dashboard completo con tráfico por hora
- API key propia (opcional, para reducir costos del cliente)

**No incluye:**
- Soporte prioritario
- Configuración personalizada
- Informes exportables

---

### Enterprise — Gs. 1.500.000+ / mes
> Para e-commerce serios, clínicas, inmobiliarias, academias grandes, call centers y empresas medianas.

| Límite | Valor |
|--------|-------|
| Líneas WhatsApp | Ilimitadas |
| Operadores | Ilimitados |
| Mensajes IA / mes | Ilimitados (con API key propia obligatoria) |
| Proveedor IA | Todos (Gemini, OpenAI, Claude, Grok) |
| Dashboard | Completo + reportes exportables |
| Soporte | Soporte directo, SLA definido |

**Incluye todo el Growth más:**
- Líneas y operadores sin tope
- Infraestructura dedicada (namespace propio en K8s)
- API key propia del cliente (el costo de IA corre por su cuenta)
- Features custom a medida según contrato
- Integración con sistemas externos via URL de contexto
- Reportes y exportación de conversaciones
- Capacitación incluida

**Precio base:** Gs. 1.500.000 / mes + setup inicial

---

## Setup Inicial (único pago)

Cobrar setup es la estrategia más efectiva en PY. Los clientes pagan más fácil un pago único que una mensualidad alta.

| Paquete | Precio | Incluye |
|---------|--------|---------|
| Setup Básico | Gs. 200.000 | Conexión del número + prompt de sistema |
| Setup Completo | Gs. 350.000 | Conexión + prompt + carga de FAQs + contexto JSON |
| Setup Enterprise | Gs. 500.000+ | Todo lo anterior + integración con sistema del cliente + capacitación |

**Regla:** Nunca hacer setup gratis. El tiempo de configuración es trabajo real y el cliente lo valorará más si lo paga.

---

## Límites de Mensajes IA — Por Qué Son Obligatorios

Los proveedores de IA (Google, OpenAI) cobran por token. Sin un límite, un solo cliente activo puede disparar el costo operativo mensual.

**Cálculo de referencia:**

| Plan | Mensajes/mes | Costo estimado en API (GPT-4o-mini) | Margen |
|------|-------------|--------------------------------------|--------|
| Básico | 500 | ~USD 0.50 | Alto |
| Growth | 3.000 | ~USD 3.00 | Alto |
| Enterprise | Ilimitado | Cliente pone su propia API key | Sin riesgo |

**Regla de Enterprise:** Líneas ilimitadas solo funcionan si el cliente pone su propia API key. De lo contrario, el costo de IA es impredecible. Esto está implementado en la plataforma (`aiApiKey` por línea).

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
> "Tu negocio responde clientes 24/7 y genera ventas sin contratar más gente"

El mercado PY responde a resultados concretos y ahorro de costo laboral, no a tecnología.

### Errores frecuentes a evitar

| Error | Consecuencia |
|-------|-------------|
| Cobrar Gs. 50.000 | Clientes de bajo valor, soporte excesivo, no cubre costos |
| No cobrar setup | Trabajo gratis desde el día 1, el cliente no lo valora |
| No limitar IA | El costo de API escala más rápido que los ingresos |
| Bajar precio por miedo | Posiciona el producto como commodity, difícil de subir después |

---

## Proyección Realista (escenario conservador)

| Plan | Clientes | Precio | Ingreso mensual |
|------|----------|--------|-----------------|
| Básico | 15 | Gs. 150.000 | Gs. 2.250.000 |
| Growth | 30 | Gs. 380.000 | Gs. 11.400.000 |
| Enterprise | 3 | Gs. 1.500.000 | Gs. 4.500.000 |
| **Total** | **48** | | **Gs. 18.150.000 / mes** |

Con infraestructura en K8s compartida, el costo operativo de 48 clientes es mínimo.
El margen real a ese volumen supera el 80%.

---

## Implicancias Técnicas para Implementar

Las siguientes funcionalidades necesitan desarrollo para soportar los planes:

| Funcionalidad | Estado actual | Prioridad |
|---------------|--------------|-----------|
| Tabla `Plan` y `Subscription` en DB | No existe | Alta |
| Límite de mensajes IA por mes | No existe | Alta |
| Límite de líneas por tenant | No existe | Alta |
| Límite de operadores por tenant | No existe | Media |
| Multi-tenancy (namespaces por cliente) | No existe | Alta |
| Panel de administración de suscripciones | No existe | Media |
| Alerta cuando el cliente llega al 80% del límite | No existe | Media |
| Bloqueo automático de IA al superar límite | No existe | Alta |
| Reportes exportables (Enterprise) | No existe | Baja |

---

## Roadmap de Planes (orden sugerido)

1. **Implementar multi-tenancy básico** — cada cliente tiene su propio `tenantId`, sus líneas y sus operadores aislados
2. **Agregar modelo `Subscription`** — plan activo, fecha de inicio/fin, límite de mensajes
3. **Contador de mensajes IA** — incrementar por cada respuesta generada, bloquear si supera el límite
4. **Panel de administración** — que el dueño de Boti pueda ver todos los clientes, sus consumos y cambiar planes
5. **Cobro automático** (futuro) — integración con Bancard o similar para débito recurrente
