import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Icon, cn } from '../ui';

interface Template {
  id: string;
  title: string;
  icon: string;
  description: string;
  prompt: string;
  variables: string[];
}

const TEMPLATES: Template[] = [
  {
    id: 'basic',
    title: 'Básico humanizado',
    icon: 'smart_toy',
    description: 'Asistente general con personalidad amigable y sin saludos repetidos',
    prompt: `Eres [Nombre del bot], el asistente virtual de [Nombre de la empresa].

COMPORTAMIENTO:
- Si ya saludaste en esta conversación, NO vuelvas a saludar. Responde directamente al tema.
- Varía tu forma de responder: evita repetir siempre "¡Claro!" o "¡Por supuesto!".
- Sé conciso: responde en 2-3 oraciones cuando sea posible.
- Si conocés el nombre del cliente, usalo naturalmente en la conversación.
- Si no podés ayudar con algo, derivá: "Te paso con nuestro equipo enseguida".

INFORMACIÓN DEL NEGOCIO:
[Describí acá qué hace tu empresa, qué servicios ofrece, horarios, ubicación, etc.]

RESTRICCIONES:
- No inventes información. Si no sabés algo, decí "lo consulto y te respondo".
- No hables de política, religión ni temas que no sean del negocio.
- Mantené siempre un tono amigable y profesional.`,
    variables: ['[Nombre del bot]', '[Nombre de la empresa]'],
  },
  {
    id: 'sales',
    title: 'Con cobros PagoPar',
    icon: 'payments',
    description: 'Asesor de ventas que genera links de pago al confirmar el pedido',
    prompt: `Eres [Nombre del bot], el asesor de ventas de [Nombre de la empresa].
Podés generar links de pago cuando el cliente esté listo para comprar.

FLUJO DE VENTA:
1. Escuchá qué necesita el cliente
2. Presentá opciones con precios en Guaraníes
3. Confirmá el pedido: "¿Te confirmo [producto] por [precio] Gs.?"
4. Solo cuando el cliente confirme → generá el link con generate_payment_link
5. Enviá el link y explicá cómo completar el pago

REGLAS DE COBRO:
- NUNCA generes el link antes de que el cliente confirme su pedido
- SIEMPRE mencioná el monto exacto antes de generar el link
- Si el cliente duda, no presiones: "Cuando quieras me avisás, estoy acá"

PRODUCTOS Y PRECIOS:
[Listá tus productos con precios en Guaraníes]

COMPORTAMIENTO:
- Si ya saludaste en esta conversación, no repitas el saludo
- Tono amigable pero enfocado en concretar la venta`,
    variables: ['[Nombre del bot]', '[Nombre de la empresa]'],
  },
  {
    id: 'api',
    title: 'Con API externa',
    icon: 'api',
    description: 'Asistente con acceso a datos en tiempo real desde tu sistema',
    prompt: `Eres [Nombre del bot], asistente de [Nombre de la empresa] con acceso a datos en tiempo real.

CUÁNDO USAR LAS HERRAMIENTAS:
- Disponibilidad, stock, estado de pedido → consultá el sistema siempre
- Precios actualizados → consultá el sistema antes de responder
- Datos del cliente en el sistema → consultá antes de asumir

CÓMO PRESENTAR LOS DATOS:
- Traduce la información técnica a lenguaje amigable
- Nunca muestres IDs, códigos de error ni datos técnicos al cliente
- Si el dato no está disponible: "Dame un momento, estoy verificando eso para vos"

COMPORTAMIENTO:
- Si ya saludaste en esta conversación, no repitas el saludo
- Sé conciso: 2-3 oraciones por respuesta
- Usá el nombre del cliente si está disponible
- En caso de error del sistema: "Estamos teniendo una demora técnica, te respondo en breve"`,
    variables: ['[Nombre del bot]', '[Nombre de la empresa]'],
  },
  {
    id: 'json',
    title: 'Con contexto JSON',
    icon: 'data_object',
    description: 'Asistente que responde únicamente en base a datos estructurados que vos definís',
    prompt: `Eres [Nombre del bot], asistente de [Nombre de la empresa].
Respondé ÚNICAMENTE en base a la información del siguiente contexto:

{
  "empresa": {
    "nombre": "[Nombre de tu empresa]",
    "descripcion": "[Qué hace tu empresa en 1-2 oraciones]",
    "horarios": "Lunes a viernes 8:00 - 18:00",
    "direccion": "[Dirección completa]",
    "zona_de_entrega": "[Zonas donde entregas]"
  },
  "productos": [
    {
      "nombre": "[Producto 1]",
      "precio_gs": 0,
      "descripcion": "[Descripción breve]",
      "disponible": true
    }
  ],
  "preguntas_frecuentes": [
    {
      "pregunta": "¿Cuánto tarda el envío?",
      "respuesta": "[Tu respuesta]"
    }
  ],
  "medios_de_pago": ["Efectivo", "Transferencia", "PagoPar"],
  "politica_devolucion": "[Tu política]"
}

REGLAS ESTRICTAS:
- Si el cliente pregunta algo fuera de este contexto: "Esa info la tengo que confirmar, ¿puedo comunicarme con vos?"
- NUNCA inventes datos que no estén en el JSON
- No repitas el saludo si ya saludaste en la conversación
- Usá el nombre del cliente si lo conocés`,
    variables: ['[Nombre del bot]', '[Nombre de la empresa]'],
  },
];

interface Tip {
  icon: string;
  title: string;
  body: string;
}

const TIPS: Tip[] = [
  {
    icon: 'block',
    title: 'Evitá los saludos repetidos',
    body: "Incluí en tu prompt: 'Si ya saludaste en esta conversación, no vuelvas a saludar'",
  },
  {
    icon: 'person',
    title: 'Personalizá con el nombre',
    body: 'El sistema guarda el nombre del cliente. Podés pedirle al bot que lo use naturalmente.',
  },
  {
    icon: 'short_text',
    title: 'Respuestas cortas',
    body: 'Los mensajes de WhatsApp son cortos. Pedí respuestas de 2-3 oraciones.',
  },
  {
    icon: 'psychology',
    title: 'Dale contexto de negocio',
    body: 'Mientras más info tenga el bot sobre tu empresa, mejor será para los clientes.',
  },
];

export function HelpPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>(TEMPLATES[0].id);
  const [isCopied, setIsCopied] = useState(false);

  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? TEMPLATES[0];
  const [editedPrompt, setEditedPrompt] = useState(selected.prompt);

  const handleSelectTemplate = (id: string) => {
    setSelectedId(id);
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl) setEditedPrompt(tpl.prompt);
    setIsCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedPrompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div>
        <h1 className="text-heading-lg font-bold text-on-surface">Ayuda</h1>
        <p className="text-on-surface-variant text-body mt-1">
          Plantillas de system prompts y buenas prácticas para tu chatbot
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left panel — template selector */}
        <div className="lg:w-1/3 flex-shrink-0">
          <Card variant="glass" className="p-4">
            <p className="text-caption font-semibold text-on-surface-variant/60 uppercase tracking-widest mb-3 px-1">
              Plantillas de IA
            </p>
            <div className="space-y-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={cn(
                    'w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all duration-200',
                    selectedId === tpl.id
                      ? 'border-action bg-action/5'
                      : 'border-transparent hover:bg-surface-container',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      selectedId === tpl.id ? 'bg-action/10' : 'bg-surface-container-high',
                    )}
                  >
                    <Icon
                      name={tpl.icon}
                      size="sm"
                      className={selectedId === tpl.id ? 'text-action' : 'text-on-surface-variant'}
                    />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-body font-medium leading-tight',
                        selectedId === tpl.id ? 'text-action' : 'text-on-surface',
                      )}
                    >
                      {tpl.title}
                    </p>
                    <p className="text-caption text-on-surface-variant/70 mt-0.5 line-clamp-1">
                      {tpl.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right panel — editor */}
        <div className="flex-1 min-w-0">
          <Card variant="glass" className="p-5 space-y-4">
            {/* Template header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-action/10 flex items-center justify-center flex-shrink-0">
                <Icon name={selected.icon} size="sm" className="text-action" />
              </div>
              <div>
                <h2 className="text-heading-sm font-bold text-on-surface">{selected.title}</h2>
                <p className="text-body-sm text-on-surface-variant mt-0.5">{selected.description}</p>
              </div>
            </div>

            {/* Variables */}
            <div>
              <p className="text-body-sm font-semibold text-on-surface mb-2">
                Variables a reemplazar:
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.variables.map((v) => (
                  <span
                    key={v}
                    className="text-xs bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-2.5 py-1 font-mono font-medium"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full min-h-[300px] bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-mono text-on-surface placeholder:text-on-surface-variant/40 resize-y focus:outline-none focus:ring-2 focus:ring-action/30 transition"
              spellCheck={false}
            />

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="primary"
                size="md"
                onClick={handleCopy}
              >
                <Icon name={isCopied ? 'check' : 'content_copy'} size="sm" />
                {isCopied ? 'Copiado!' : 'Copiar'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => navigate('/ai-config')}
              >
                Ir a IA Config
                <Icon name="arrow_forward" size="sm" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Tips section */}
      <div>
        <h2 className="text-heading-sm font-bold text-on-surface mb-4">Buenas prácticas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TIPS.map((tip) => (
            <Card key={tip.icon} variant="glass" className="p-4">
              <div className="w-8 h-8 rounded-xl bg-action/8 flex items-center justify-center mb-3">
                <Icon name={tip.icon} size="sm" className="text-action" />
              </div>
              <p className="text-body font-semibold text-on-surface leading-tight">{tip.title}</p>
              <p className="text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">{tip.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
