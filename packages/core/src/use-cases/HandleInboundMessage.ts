// Core Use Case: HandleInboundMessageUseCase
// This is the "brain" of the bot. Handles incoming messages, checks spam, generates AI reply, and enqueues response.

import type { HandleInboundMessageUseCase } from '../ports/inbound.js';
import type {
  IClientRepository,
  IMessageRepository,
  IContextRepository,
  IMessageQueue,
  IAIService,
  IContextFetcher,
  IAuditLogger,
  INotifier,
} from '../ports/outbound.js';

interface Deps {
  clientRepo: IClientRepository;
  messageRepo: IMessageRepository;
  contextRepo: IContextRepository;
  queue: IMessageQueue;
  aiService: IAIService;
  contextFetcher: IContextFetcher;
  auditLogger: IAuditLogger;
  notifier: INotifier;
  maxMessages: number; // configurable, default 10
  spamThreshold: number; // messages per minute
}

export class HandleInboundMessage implements HandleInboundMessageUseCase {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    lineId: string;
    fromPhone: string;
    fromName: string;
    content: string;
    type: string;
  }): Promise<void> {
    const { lineId, fromPhone, fromName, content } = input;
    const { clientRepo, messageRepo, contextRepo, queue, aiService, contextFetcher, auditLogger, notifier, maxMessages } = this.deps;

    // 1. Upsert client
    const client = await clientRepo.upsert({ phone: fromPhone, name: fromName, isBlocked: false });

    // 2. Check if blocked
    if (client.isBlocked && client.blockedUntil && client.blockedUntil > new Date()) {
      return; // silently drop message from blocked user
    }

    // 2b. Check if AI is paused for this client
    const isAiPaused = client.aiPausedUntil && client.aiPausedUntil > new Date();

    // 3. Save inbound message
    const inboundMessage = await messageRepo.save({
      lineId,
      clientPhone: fromPhone,
      content,
      type: 'TEXT',
      direction: 'INBOUND',
      status: 'SUCCESS',
      sentAt: new Date(),
    });

    // 4. Get or create conversation context
    let ctx = await contextRepo.get(lineId, fromPhone);

    if (!ctx) {
      ctx = {
        clientPhone: fromPhone,
        lineId,
        clientName: fromName,
        summary: '',
        lastMessages: [],
        updatedAt: new Date(),
      };
    }

    // 5. Build the AI prompt with business context + conversation history
    const businessContext = await contextFetcher.fetchContextForBusiness(lineId);

    const SAFETY_WRAPPER = `
REGLAS DE CONVERSACIÓN (Escucha Activa):
1. NO seas un vendedor ansioso. Si el usuario solo saluda, tú SOLO saludas y te pones a disposición.
2. NUNCA menciones precios o planes a menos que el usuario lo pregunte o la conversación sea sobre costos.
3. ADÁPTATE a la energía del usuario. Si el usuario es breve, tú eres breve.
4. Tu prioridad es ENTENDER el problema del usuario antes de ofrecer una solución.

DIRECTIVAS DEL NEGOCIO (Prioridad):
`;

    const aiMessages = [
      { role: 'system' as const, content: SAFETY_WRAPPER + businessContext },
      ...ctx.lastMessages.map((m) => ({
        role: m.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      { role: 'user' as const, content }, // Incluir el mensaje actual
    ];

    // 6. Generate AI reply
    if (isAiPaused) {
      await notifier.notifyOperators(lineId, 'MANUAL_INTERVENTION_NEEDED', { clientPhone: fromPhone, content });
      return;
    }

    let replyText: string;
    try {
      replyText = await aiService.generateReply(aiMessages, { lineId } as any);
      
      // Filtro de humanización: si ya saludamos antes, removemos saludos repetidos
      const hasGreeted = ctx.lastMessages.some(m => m.direction === 'OUTBOUND' && /hola|buenas|buenos/i.test(m.content));
      if (hasGreeted) {
        replyText = replyText.replace(/^(¡?Hola!?|Buenos días|Buenas tardes|Buenas noches)[.,! ]*/i, '');
      }
    } catch (err: any) {
      await auditLogger.logEvent({ action: 'AI_ERROR', details: { lineId, error: err.message } });
      await notifier.notifyOperators(lineId, 'AI_ERROR', { clientPhone: fromPhone });
      replyText = 'En este momento no puedo responderte. Un operador te atenderá pronto.';
    }

    // 7. Enqueue outbound reply
    await queue.enqueue(lineId, { to: fromPhone, content: replyText, type: 'TEXT', clientMessageId: inboundMessage.id });

    // 8. Update and Persist conversation history to Context Repo
    const inboundHistory = { direction: 'INBOUND', content, type: 'TEXT', createdAt: new Date() } as any;
    const outboundHistory = { direction: 'OUTBOUND', content: replyText, type: 'TEXT', createdAt: new Date() } as any;
    
    ctx.lastMessages.push(inboundHistory);
    ctx.lastMessages.push(outboundHistory);
    
    // Limit to last N messages to keep context clean but relevant
    if (ctx.lastMessages.length > 10) {
      ctx.lastMessages = ctx.lastMessages.slice(-10);
    }

    ctx.updatedAt = new Date();
    await contextRepo.save(ctx);
  }
}
