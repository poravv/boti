import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleInboundMessage } from '../use-cases/HandleInboundMessage.js';
import type {
  IClientRepository,
  IMessageRepository,
  IContextRepository,
  IMessageQueue,
  IAIService,
  IContextFetcher,
  IAuditLogger,
  INotifier,
  IExternalApiRepository,
  ISalesService,
  ICalendarService,
  AIToolDef,
} from '../ports/outbound.js';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

const PAYMENT_TOOL: AIToolDef = {
  name: 'generate_payment_link',
  description: 'Genera un link de pago',
  parameters: {
    type: 'object',
    properties: {
      producto: { type: 'string', description: 'Nombre del producto' },
      monto: { type: 'number', description: 'Monto en PYG' },
    },
    required: ['producto', 'monto'],
  },
};

const CALENDAR_TOOLS: AIToolDef[] = [
  {
    name: 'check_availability',
    description: 'Consulta disponibilidad',
    parameters: { type: 'object', properties: { fecha: { type: 'string', description: '' } }, required: ['fecha'] },
  },
  {
    name: 'create_appointment',
    description: 'Agenda cita',
    parameters: { type: 'object', properties: { titulo: { type: 'string', description: '' }, fecha_hora: { type: 'string', description: '' } }, required: ['titulo', 'fecha_hora'] },
  },
];

function makeClient(overrides = {}) {
  return {
    id: 'client-1',
    phone: '595992000001',
    name: 'Test User',
    isBlocked: false,
    blockedUntil: undefined,
    aiPausedUntil: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<{
  ai: Partial<IAIService>;
  sales: Partial<ISalesService>;
  calendar: Partial<ICalendarService>;
  salesEnabled: boolean;
  calendarConnected: boolean;
}> = {}) {
  const { salesEnabled = true, calendarConnected = true } = overrides;

  const clientRepo: IClientRepository = {
    upsert: vi.fn().mockResolvedValue(makeClient()),
    findByPhone: vi.fn().mockResolvedValue(null),
    blockClient: vi.fn().mockResolvedValue(undefined),
  };

  const messageRepo: IMessageRepository = {
    save: vi.fn().mockResolvedValue({ id: 'msg-1', lineId: 'line-1', clientPhone: '595992000001' }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    findByClientPhone: vi.fn().mockResolvedValue([]),
  };

  const contextRepo: IContextRepository = {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  };

  const queue: IMessageQueue = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  };

  const aiService: IAIService = {
    generateReply: vi.fn().mockResolvedValue('Respuesta del bot'),
    generateReplyWithTools: vi.fn().mockResolvedValue({ type: 'text', content: 'Respuesta del bot' }),
    ...overrides.ai,
  };

  const contextFetcher: IContextFetcher = {
    fetchContextForBusiness: vi.fn().mockResolvedValue('Contexto del negocio'),
  };

  const auditLogger: IAuditLogger = {
    logEvent: vi.fn().mockResolvedValue(undefined),
  };

  const notifier: INotifier = {
    notifyOperators: vi.fn().mockResolvedValue(undefined),
  };

  const externalApiRepo: IExternalApiRepository = {
    findByLineId: vi.fn().mockResolvedValue([]),
  };

  const salesService: ISalesService = {
    isEnabledForLine: vi.fn().mockResolvedValue(salesEnabled),
    getToolDefinitions: vi.fn().mockReturnValue([PAYMENT_TOOL]),
    executeTool: vi.fn().mockResolvedValue('https://www.pagopar.com/pagos/SANDBOX-ABC?sandbox=1'),
    ...overrides.sales,
  };

  const calendarService: ICalendarService = {
    isConnectedForLine: vi.fn().mockResolvedValue(calendarConnected),
    getToolDefinitions: vi.fn().mockReturnValue(CALENDAR_TOOLS),
    executeTool: vi.fn().mockResolvedValue('Cita agendada para el lunes 10:00'),
    getAppointments: vi.fn().mockResolvedValue([]),
    cancelAppointment: vi.fn().mockResolvedValue(undefined),
    ...overrides.calendar,
  };

  const useCase = new HandleInboundMessage({
    clientRepo,
    messageRepo,
    contextRepo,
    queue,
    aiService,
    contextFetcher,
    auditLogger,
    notifier,
    externalApiRepo,
    salesService,
    calendarService,
    maxMessages: 10,
    spamThreshold: 50,
  });

  return { useCase, clientRepo, messageRepo, contextRepo, queue, aiService, salesService, calendarService, notifier };
}

const BASE_INPUT = {
  lineId: 'line-1',
  fromPhone: '595992000001',
  fromName: 'Test User',
  type: 'TEXT',
};

// ---------------------------------------------------------------------------
// GROUP 1 — Payment intent detection: which tools reach the AI
// ---------------------------------------------------------------------------

describe('Tool filtering by payment intent', () => {
  const PAYMENT_MESSAGES = [
    'quiero pagar el plan Web Express, 250.000',
    'dame el link de pago',
    'quiero contratar el plan básico',
    'activar plan ya',
    'quiero el plan Growth',
    'facturame el servicio',
    'quiero pagar ahora',
    'quiero comprarlo ya',
    'quiero comprar el plan pro',
  ];

  const NON_PAYMENT_MESSAGES = [
    'quiero agendar una reunión',
    'necesito una demo',
    'hola, ¿qué servicios tienen?',
    'cuánto cuesta el plan?',
    '¿hay disponibilidad el lunes?',
    'quiero ver una demostración antes de decidir',
  ];

  it.each(PAYMENT_MESSAGES)(
    'payment message "%s" → solo generate_payment_link llega al AI',
    async (content) => {
      const { useCase, aiService } = makeDeps();
      await useCase.execute({ ...BASE_INPUT, content });

      const calls = vi.mocked(aiService.generateReplyWithTools!).mock.calls;
      expect(calls.length).toBe(1);
      const tools = calls[0][1]; // second arg is tools array
      expect(tools.every((t: AIToolDef) => t.name === 'generate_payment_link')).toBe(true);
      expect(tools.some((t: AIToolDef) => t.name === 'create_appointment')).toBe(false);
      expect(tools.some((t: AIToolDef) => t.name === 'check_availability')).toBe(false);
    },
  );

  it.each(NON_PAYMENT_MESSAGES)(
    'non-payment message "%s" → todos los tools llegan al AI',
    async (content) => {
      const { useCase, aiService } = makeDeps();
      await useCase.execute({ ...BASE_INPUT, content });

      const calls = vi.mocked(aiService.generateReplyWithTools!).mock.calls;
      expect(calls.length).toBe(1);
      const tools = calls[0][1];
      const names = tools.map((t: AIToolDef) => t.name);
      expect(names).toContain('generate_payment_link');
      expect(names).toContain('create_appointment');
      expect(names).toContain('check_availability');
    },
  );
});

// ---------------------------------------------------------------------------
// GROUP 2 — Tool call execution: generate_payment_link
// ---------------------------------------------------------------------------

describe('generate_payment_link flow', () => {
  it('AI retorna tool_call generate_payment_link → executeTool llamado → URL encolada en mensaje', async () => {
    const FAKE_URL = 'https://www.pagopar.com/pagos/SANDBOX-XYZ?sandbox=1';

    const { useCase, queue, salesService } = makeDeps({
      ai: {
        generateReplyWithTools: vi.fn().mockResolvedValue({
          type: 'tool_call',
          toolCallId: 'tc-1',
          name: 'generate_payment_link',
          args: { producto: 'Web Express', monto: 250000 },
        }),
        generateReply: vi.fn().mockResolvedValue(`Acá tenés tu link: ${FAKE_URL}`),
      },
      sales: {
        executeTool: vi.fn().mockResolvedValue(FAKE_URL),
      },
    });

    await useCase.execute({ ...BASE_INPUT, content: 'quiero pagar el plan Web Express, 250.000' });

    expect(vi.mocked(salesService.executeTool)).toHaveBeenCalledWith(
      'line-1',
      '595992000001',
      'Test User',
      'generate_payment_link',
      { producto: 'Web Express', monto: 250000 },
    );

    const enqueueCall = vi.mocked(queue.enqueue).mock.calls[0];
    expect(enqueueCall[0]).toBe('line-1');
    expect(enqueueCall[1].to).toBe('595992000001');
    expect(enqueueCall[1].content).toContain(FAKE_URL);
  });

  it('generate_payment_link ejecutado → URL del sandbox incluida en respuesta final', async () => {
    const SANDBOX_URL = 'https://www.pagopar.com/pagos/SANDBOX-HASH?sandbox=1';

    const { useCase, queue } = makeDeps({
      ai: {
        generateReplyWithTools: vi.fn().mockResolvedValue({
          type: 'tool_call',
          toolCallId: 'tc-2',
          name: 'generate_payment_link',
          args: { producto: 'Boti Plan Básico', monto: 150000 },
        }),
        generateReply: vi.fn().mockResolvedValue(`Acá tenés el link: ${SANDBOX_URL}`),
      },
      sales: {
        executeTool: vi.fn().mockResolvedValue(SANDBOX_URL),
      },
    });

    await useCase.execute({ ...BASE_INPUT, content: 'quiero contratar Boti plan básico' });

    const enqueuedContent = vi.mocked(queue.enqueue).mock.calls[0][1].content;
    expect(enqueuedContent).toContain(SANDBOX_URL);
  });

  it('AI retorna tool_call generate_payment_link → calendar tools NUNCA ejecutados', async () => {
    const { useCase, calendarService } = makeDeps({
      ai: {
        generateReplyWithTools: vi.fn().mockResolvedValue({
          type: 'tool_call',
          toolCallId: 'tc-3',
          name: 'generate_payment_link',
          args: { producto: 'Web Express', monto: 250000 },
        }),
        generateReply: vi.fn().mockResolvedValue('Link generado'),
      },
    });

    await useCase.execute({ ...BASE_INPUT, content: 'quiero pagar el plan' });

    expect(vi.mocked(calendarService.executeTool)).not.toHaveBeenCalled();
  });

  it('error en executeTool → mensaje de error amigable encolado, no excepción al exterior', async () => {
    const { useCase, queue } = makeDeps({
      ai: {
        generateReplyWithTools: vi.fn().mockResolvedValue({
          type: 'tool_call',
          toolCallId: 'tc-4',
          name: 'generate_payment_link',
          args: { producto: 'Web Express', monto: 250000 },
        }),
        generateReply: vi.fn().mockResolvedValue('Hubo un error al generar el link.'),
      },
      sales: {
        executeTool: vi.fn().mockRejectedValue(new Error('PagoPar timeout')),
      },
    });

    await expect(
      useCase.execute({ ...BASE_INPUT, content: 'quiero pagar' })
    ).resolves.not.toThrow();

    expect(vi.mocked(queue.enqueue)).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GROUP 3 — create_appointment NOT called for payment messages
// ---------------------------------------------------------------------------

describe('create_appointment never triggered for payment messages', () => {
  const paymentVariants = [
    'quiero contratar el plan Growth ahora',
    'activar ya, me convence',
    'dame el link para pagar',
    'quiero pagar 380.000 por el plan Growth',
    'facturame nombre Andrés Vera',
  ];

  it.each(paymentVariants)(
    '"%s" → create_appointment NUNCA en los tools pasados al AI',
    async (content) => {
      const { useCase, aiService } = makeDeps();
      await useCase.execute({ ...BASE_INPUT, content });

      const calls = vi.mocked(aiService.generateReplyWithTools!).mock.calls;
      if (calls.length > 0) {
        const tools = calls[0][1];
        expect(tools.some((t: AIToolDef) => t.name === 'create_appointment')).toBe(false);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// GROUP 4 — Calendar flow (not contaminated by payment logic)
// ---------------------------------------------------------------------------

describe('Calendar flow unaffected', () => {
  it('mensaje de agenda → check_availability disponible para el AI', async () => {
    const { useCase, aiService } = makeDeps({
      ai: {
        generateReplyWithTools: vi.fn().mockResolvedValue({
          type: 'tool_call',
          toolCallId: 'cal-1',
          name: 'check_availability',
          args: { fecha: '2026-05-05' },
        }),
        generateReply: vi.fn().mockResolvedValue('Disponible el lunes a las 10:00'),
      },
      calendar: {
        executeTool: vi.fn().mockResolvedValue('Horarios: 09:00, 10:00, 14:00'),
      },
    });

    await useCase.execute({ ...BASE_INPUT, content: 'quiero agendar una reunión el lunes' });

    const tools = vi.mocked(aiService.generateReplyWithTools!).mock.calls[0][1];
    expect(tools.some((t: AIToolDef) => t.name === 'check_availability')).toBe(true);
  });

  it('mensaje de agenda → calendar executeTool llamado con args correctos', async () => {
    const { useCase, calendarService } = makeDeps({
      ai: {
        generateReplyWithTools: vi.fn().mockResolvedValue({
          type: 'tool_call',
          toolCallId: 'cal-2',
          name: 'create_appointment',
          args: { titulo: 'Demo MindTechPY', fecha_hora: '2026-05-05T10:00:00' },
        }),
        generateReply: vi.fn().mockResolvedValue('Cita agendada para el lunes a las 10:00'),
      },
    });

    await useCase.execute({ ...BASE_INPUT, content: 'quiero agendar una reunión el lunes a las 10' });

    expect(vi.mocked(calendarService.executeTool)).toHaveBeenCalledWith(
      'line-1',
      '595992000001',
      'Test User',
      'create_appointment',
      { titulo: 'Demo MindTechPY', fecha_hora: '2026-05-05T10:00:00' },
    );
  });
});

// ---------------------------------------------------------------------------
// GROUP 5 — Client blocking / AI pause
// ---------------------------------------------------------------------------

describe('Client access control', () => {
  it('cliente bloqueado → mensaje descartado silenciosamente', async () => {
    const { useCase, queue, aiService } = makeDeps({
      sales: { isEnabledForLine: vi.fn().mockResolvedValue(false) },
      calendar: { isConnectedForLine: vi.fn().mockResolvedValue(false) },
    });

    // Override clientRepo for blocked client
    const blockedDeps = makeDeps();
    vi.mocked(blockedDeps.clientRepo.upsert).mockResolvedValue(
      makeClient({ isBlocked: true, blockedUntil: new Date(Date.now() + 60000) })
    );

    await blockedDeps.useCase.execute({ ...BASE_INPUT, content: 'quiero pagar' });

    expect(vi.mocked(blockedDeps.queue.enqueue)).not.toHaveBeenCalled();
    expect(vi.mocked(blockedDeps.aiService.generateReplyWithTools!)).not.toHaveBeenCalled();
  });

  it('AI pausada → notifier llamado, sin respuesta automática', async () => {
    const pausedDeps = makeDeps();
    vi.mocked(pausedDeps.clientRepo.upsert).mockResolvedValue(
      makeClient({ aiPausedUntil: new Date(Date.now() + 60000) })
    );

    await pausedDeps.useCase.execute({ ...BASE_INPUT, content: 'quiero pagar' });

    expect(vi.mocked(pausedDeps.notifier.notifyOperators)).toHaveBeenCalledWith(
      'line-1',
      'MANUAL_INTERVENTION_NEEDED',
      expect.objectContaining({ clientPhone: '595992000001' }),
    );
    expect(vi.mocked(pausedDeps.queue.enqueue)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GROUP 6 — Conversation history management
// ---------------------------------------------------------------------------

describe('Context persistence', () => {
  it('contexto vacío → se inicializa y guarda correctamente', async () => {
    const { useCase, contextRepo } = makeDeps({
      ai: { generateReplyWithTools: vi.fn().mockResolvedValue({ type: 'text', content: 'Hola' }) },
    });
    vi.mocked(contextRepo.get).mockResolvedValue(null);

    await useCase.execute({ ...BASE_INPUT, content: 'hola' });

    expect(vi.mocked(contextRepo.save)).toHaveBeenCalledWith(
      expect.objectContaining({
        lineId: 'line-1',
        clientPhone: '595992000001',
        lastMessages: expect.arrayContaining([
          expect.objectContaining({ direction: 'INBOUND', content: 'hola' }),
          expect.objectContaining({ direction: 'OUTBOUND' }),
        ]),
      }),
    );
  });

  it('historial existente → no supera el límite de 10 mensajes', async () => {
    const { useCase, contextRepo } = makeDeps({
      ai: { generateReplyWithTools: vi.fn().mockResolvedValue({ type: 'text', content: 'ok' }) },
    });

    // Simulate context already at 10 messages
    const existingMessages = Array.from({ length: 10 }, (_, i) => ({
      direction: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
      content: `msg ${i}`,
      type: 'TEXT',
      createdAt: new Date(),
    }));
    vi.mocked(contextRepo.get).mockResolvedValue({
      lineId: 'line-1',
      clientPhone: '595992000001',
      clientName: 'Test',
      summary: '',
      lastMessages: existingMessages as any,
      updatedAt: new Date(),
    });

    await useCase.execute({ ...BASE_INPUT, content: 'mensaje nuevo' });

    const savedCtx = vi.mocked(contextRepo.save).mock.calls[0][0];
    expect(savedCtx.lastMessages.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// GROUP 7 — Ventas deshabilitadas / solo calendario
// ---------------------------------------------------------------------------

describe('Tool availability when features are disabled', () => {
  it('ventas deshabilitadas + calendario conectado → solo tools de calendario', async () => {
    const { useCase, aiService } = makeDeps({ salesEnabled: false, calendarConnected: true });
    await useCase.execute({ ...BASE_INPUT, content: 'quiero agendar' });

    const tools = vi.mocked(aiService.generateReplyWithTools!).mock.calls[0][1];
    expect(tools.every((t: AIToolDef) => t.name !== 'generate_payment_link')).toBe(true);
  });

  it('ventas habilitadas + calendario desconectado → solo generate_payment_link', async () => {
    const { useCase, aiService } = makeDeps({ salesEnabled: true, calendarConnected: false });
    await useCase.execute({ ...BASE_INPUT, content: 'quiero agendar' });

    const tools = vi.mocked(aiService.generateReplyWithTools!).mock.calls[0][1];
    expect(tools.every((t: AIToolDef) => t.name === 'generate_payment_link')).toBe(true);
  });

  it('ventas y calendario deshabilitados → generateReply (sin tools) llamado', async () => {
    const { useCase, aiService } = makeDeps({ salesEnabled: false, calendarConnected: false });
    await useCase.execute({ ...BASE_INPUT, content: 'hola' });

    expect(vi.mocked(aiService.generateReplyWithTools!)).not.toHaveBeenCalled();
    expect(vi.mocked(aiService.generateReply)).toHaveBeenCalled();
  });
});
