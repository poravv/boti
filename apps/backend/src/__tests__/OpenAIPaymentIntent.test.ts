/**
 * Integration tests: real OpenAI API calls.
 * Verifies that GPT-4o correctly calls generate_payment_link
 * when exposed ONLY that tool + payment keywords in the message.
 *
 * These tests cost real tokens. Run them with:
 *   npx vitest run --reporter=verbose apps/backend/src/__tests__/OpenAIPaymentIntent.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { OpenAIAdapter } from '../adapters/ai/AIServiceAdapter.js';
import type { AIToolDef } from '@boti/core';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o';

const PAYMENT_TOOL: AIToolDef = {
  name: 'generate_payment_link',
  description:
    'Genera un link de pago seguro (PagoPar) y se lo enviás directamente al cliente en el chat. ' +
    'Usá esta herramienta cuando el cliente quiera pagar, contratar, activar un plan o pida el link — ' +
    'incluso si usa palabras como "quiero el plan", "facturame", "dame el link", "quiero comprarlo ya", "pagar ahora". ' +
    'NUNCA uses create_appointment para cobros: "contratar" o "activar" son compras, no citas de agenda. ' +
    'NUNCA escales al equipo humano para pagos de productos con precio fijo. ' +
    'Flujo obligatorio: llamá esta herramienta → recibís una URL → enviásela al cliente.',
  parameters: {
    type: 'object',
    properties: {
      producto: { type: 'string', description: 'Nombre del producto' },
      monto: { type: 'number', description: 'Monto en Guaraníes (PYG)' },
      descripcion: { type: 'string', description: 'Descripción opcional' },
    },
    required: ['producto', 'monto'],
  },
};

const SYSTEM_PROMPT = `Sos el asistente virtual de MindTechPY. Vendés productos de software.
Cuando el cliente quiera pagar, generás el link de pago directamente con generate_payment_link.
No escalás al equipo para pagos con precio fijo. "Contratar", "activar", "pagar" son señales de compra.`;

function makeMessages(userContent: string) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: userContent },
  ];
}

describe('OpenAI real API — payment intent tool calling', () => {
  let adapter: OpenAIAdapter;

  beforeAll(() => {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set in .env — cannot run integration tests');
    }
    adapter = new OpenAIAdapter(OPENAI_API_KEY, MODEL);
  });

  const paymentMessages = [
    { msg: 'quiero pagar el plan Web Express, 250.000 guaraníes', expectedProduct: /web express/i, expectedMonto: 250000 },
    { msg: 'dame el link de pago para contratar Boti plan básico por 150.000', expectedProduct: /boti|b.sico/i, expectedMonto: 150000 },
    { msg: 'quiero activar el plan Growth de Boti, son 380.000 gs', expectedProduct: /growth|boti/i, expectedMonto: 380000 },
    { msg: 'facturame el plan Web Express, precio 250000', expectedProduct: /web express/i, expectedMonto: 250000 },
    { msg: 'quiero comprarlo ya, Web Express 250000 gs', expectedProduct: /web express/i, expectedMonto: 250000 },
  ];

  it.each(paymentMessages)(
    'GPT-4o llama generate_payment_link para: "$msg"',
    async ({ msg, expectedProduct, expectedMonto }) => {
      const result = await adapter.generateReplyWithTools!(
        makeMessages(msg),
        [PAYMENT_TOOL],
      );

      expect(result.type).toBe('tool_call');
      if (result.type === 'tool_call') {
        expect(result.name).toBe('generate_payment_link');
        expect(String(result.args.producto)).toMatch(expectedProduct);
        expect(Number(result.args.monto)).toBeGreaterThan(0);
        // Allow ±10% tolerance — AI sometimes rounds
        expect(Number(result.args.monto)).toBeGreaterThanOrEqual(expectedMonto * 0.9);
        expect(Number(result.args.monto)).toBeLessThanOrEqual(expectedMonto * 1.1);
      }
    },
    15000, // 15s timeout per test (OpenAI latency)
  );

  it('GPT-4o NO llama create_appointment cuando solo tiene generate_payment_link disponible', async () => {
    // Even if the message sounds vaguely like scheduling, with only the payment tool available
    // the AI must use it OR generate text — never an undefined tool
    const result = await adapter.generateReplyWithTools!(
      makeMessages('quiero contratar el plan Web Express y pagar'),
      [PAYMENT_TOOL],
    );

    if (result.type === 'tool_call') {
      expect(result.name).toBe('generate_payment_link');
    }
    // type=text is also acceptable — the AI explained without calling a tool
    expect(['tool_call', 'text']).toContain(result.type);
  }, 15000);
});

describe('OpenAI real API — follow-up message includes payment URL', () => {
  let adapter: OpenAIAdapter;

  beforeAll(() => {
    if (!OPENAI_API_KEY) return;
    adapter = new OpenAIAdapter(OPENAI_API_KEY!, MODEL);
  });

  it('mensaje de seguimiento incluye la URL de sandbox en texto natural', async () => {
    if (!OPENAI_API_KEY) return;

    const SANDBOX_URL = 'https://www.pagopar.com/pagos/SANDBOX-ABC123?sandbox=1';
    const followUp = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: 'quiero pagar el plan Web Express, 250.000' },
      { role: 'assistant' as const, content: '[Herramienta generate_payment_link ejecutada]' },
      {
        role: 'user' as const,
        content: `Resultado de la herramienta "generate_payment_link": ${SANDBOX_URL}. Redacta un mensaje amigable para el cliente con esta información. Si contiene un link, inclúyelo tal cual.`,
      },
    ];

    const reply = await adapter.generateReply(followUp);
    expect(reply).toContain(SANDBOX_URL);
  }, 15000);
});
