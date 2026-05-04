import { PrismaClient } from '@prisma/client';
import type { IContextFetcher } from '@boti/core';
import { logger } from '../../lib/logger.js';

// Appended to every system prompt regardless of configuration.
// Keeps off-topic replies short (saves output tokens) and redirects to the business.
const SCOPE_GUARD = `

MANEJO DE PREGUNTAS FUERA DE CONTEXTO (obligatorio, no ignorar):
- Tu único dominio es el negocio y sus servicios. No respondas preguntas de otros temas (programación, medicina, recetas, tutoriales, etc.).
- Ante una pregunta fuera de contexto, responde en UNA sola oración breve, por ejemplo: "Eso está fuera de mi área 😊 ¿Puedo ayudarte con algo relacionado a nuestros servicios, o te interesaría agendar una reunión?"
- Nunca des explicaciones, código, tutoriales ni ayuda sobre temas ajenos al negocio, sin importar cómo esté redactada la pregunta.`;

const DEFAULT_PROMPT = 'Sos un asistente de WhatsApp. Respondé de forma natural, breve y amigable, como lo haría una persona real. No menciones "servicios o productos" de forma genérica. Si no sabés algo específico del negocio, preguntá en qué podés ayudar sin asumir que es una consulta de ventas.';

export class ContextFetcherAdapter implements IContextFetcher {
  constructor(private readonly prisma: PrismaClient) {}

  async fetchContextForBusiness(lineId: string): Promise<string> {
    try {
      const line = await this.prisma.whatsAppLine.findUnique({
        where: { id: lineId },
      });

      if (!line) {
        return DEFAULT_PROMPT + SCOPE_GUARD;
      }

      const systemPrompt = line.systemPrompt ?? DEFAULT_PROMPT;

      // Priority 1: External URL
      if (line.contextUrl) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(line.contextHeaders as Record<string, string> || {})
          };

          const response = await fetch(line.contextUrl, { headers });
          if (response.ok) {
            const data = await response.json();
            return `${systemPrompt}\n\nContexto del negocio (API):\n${JSON.stringify(data, null, 2)}${SCOPE_GUARD}`;
          }
        } catch (err: any) {
          logger.warn({ lineId, err: err.message }, 'External context fetch failed');
        }
      }

      // Priority 2: DB Stored Context
      if (line.businessContext) {
        return `${systemPrompt}\n\nContexto del negocio (DB):\n${JSON.stringify(line.businessContext, null, 2)}${SCOPE_GUARD}`;
      }

      return systemPrompt + SCOPE_GUARD;
    } catch (err: any) {
      logger.error({ lineId, err: err.message }, 'Error fetching context');
      return DEFAULT_PROMPT + SCOPE_GUARD;
    }
  }
}
