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
  IExternalApiRepository,
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
  externalApiRepo: IExternalApiRepository;
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
    const { clientRepo, messageRepo, contextRepo, queue, aiService, contextFetcher, auditLogger, notifier, externalApiRepo, maxMessages } = this.deps;

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

    // Call active external APIs and append their responses to context
    let enrichedContext = businessContext;
    try {
      const externalApis = await externalApiRepo.findByLineId(lineId);
      const apiResults: string[] = [];
      for (const api of externalApis) {
        try {
          const headers: Record<string, string> = { ...api.headers };
          if (api.username && api.password) {
            headers['Authorization'] = 'Basic ' + Buffer.from(`${api.username}:${api.password}`).toString('base64');
          }
          const bodyStr = api.body ? api.body.replace(/\{\{message\}\}/g, content) : undefined;
          const fetchOpts: RequestInit = {
            method: api.method,
            headers,
            ...(bodyStr ? { body: bodyStr } : {}),
          };
          const resp = await fetch(api.baseUrl, fetchOpts);
          if (!resp.ok) continue;
          const json = await resp.json();
          let extracted: any = json;
          if (api.outputKey) {
            for (const key of api.outputKey.split('.')) {
              extracted = extracted?.[key];
              if (extracted === undefined) break;
            }
          }
          const resultStr = typeof extracted === 'string' ? extracted : JSON.stringify(extracted);
          apiResults.push(`[${api.name}]: ${resultStr}`);
        } catch {
          // Skip failing APIs silently
        }
      }
      if (apiResults.length > 0) {
        enrichedContext = businessContext + '\n\n--- Datos en tiempo real ---\n' + apiResults.join('\n');
      }
    } catch {
      // If external API enrichment fails, continue with base context
    }

    // Extract business name for out-of-scope redirect message
    let businessName = 'nuestro negocio';
    try {
      const parsed = JSON.parse(businessContext);
      if (parsed.empresa) businessName = parsed.empresa;
      else if (parsed.businessName) businessName = parsed.businessName;
      else if (parsed.name) businessName = parsed.name;
    } catch {
      // businessContext is plain text, not JSON — keep default
    }

    const clientDisplayName = client.name && client.name !== fromPhone
      ? client.name
      : null;

    const SYSTEM_PROMPT = `Eres un asistente virtual de atención al cliente. Responde ÚNICAMENTE sobre los temas del negocio descritos a continuación.

REGLAS ESTRICTAS:
1. Si el usuario pide algo fuera del contexto del negocio (generar código, hacer cálculos, responder preguntas generales, escribir textos, etc.), responde SOLAMENTE: "Solo puedo ayudarte con temas relacionados a ${businessName}. ¿En qué puedo ayudarte?"
2. NO generes código, scripts, ni contenido técnico de ningún tipo.
3. NO respondas preguntas de cultura general, matemáticas, traducciones, ni nada que no esté directamente relacionado con los servicios/productos del negocio.
4. Sé amable pero directo al redirigir al usuario al contexto correcto.
5. Si el usuario saluda, responde cordialmente y pregunta en qué puedes ayudarle (relacionado al negocio).
6. NUNCA menciones que eres un modelo de lenguaje, que usas IA, o que eres ChatGPT/OpenAI.

${clientDisplayName ? `El cliente se llama ${clientDisplayName}. Cuando sea natural, dirígete a él/ella por su nombre.\n\n` : ''}CONTEXTO DEL NEGOCIO:
`;

    const aiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT + enrichedContext },
      ...ctx.lastMessages.map((m) => ({
        role: m.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      { role: 'user' as const, content },
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
