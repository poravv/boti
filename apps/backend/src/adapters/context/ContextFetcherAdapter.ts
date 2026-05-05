import { PrismaClient } from '@prisma/client';
import type { IContextFetcher } from '@boti/core';
import { logger } from '../../lib/logger.js';

// Appended to every system prompt regardless of line configuration.
const BEHAVIOR_RULES = `

REGLAS DE CONVERSACIÓN (obligatorio, nunca ignorar):

1. BREVEDAD: Máximo 2-3 oraciones por respuesta. Si el cliente pide un listado explícito, podés extenderte, pero nunca más de 5 ítems y sin sub-bullets.

2. ESTILO CONSULTIVO — nunca dumps de catálogo:
   - Cuando el cliente pregunta "qué servicios tienen" o similar, NO listes todo. En cambio, hacé UNA pregunta para entender su necesidad. Ejemplo: "Tenemos varias soluciones 😊 ¿Estás buscando algo para atención al cliente, presencia web, o algo más puntual?"
   - Solo recomendá un servicio específico cuando el cliente ya expresó una necesidad concreta.
   - Guiá la conversación de a una pregunta a la vez, como lo haría un buen vendedor.

3. SIN LISTAS NI BULLETS salvo que el cliente los pida explícitamente.

4. FUERA DE CONTEXTO: Si el cliente pregunta algo ajeno al negocio (programación, medicina, recetas, etc.), respondé en una sola oración: "Eso está fuera de mi área 😊 ¿Te puedo ayudar con algo de nuestros servicios?" — nunca respondas la pregunta off-topic.`;

const DEFAULT_PROMPT = 'Sos un asesor comercial de WhatsApp. Respondé de forma natural, breve y amigable, como lo haría una persona real. Tu objetivo es entender qué necesita el cliente antes de recomendar algo.';

export class ContextFetcherAdapter implements IContextFetcher {
  constructor(private readonly prisma: PrismaClient) {}

  async fetchContextForBusiness(lineId: string): Promise<string> {
    try {
      const line = await this.prisma.whatsAppLine.findUnique({
        where: { id: lineId },
      });

      if (!line) {
        return DEFAULT_PROMPT + BEHAVIOR_RULES;
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
            return `${systemPrompt}\n\nContexto del negocio (API):\n${JSON.stringify(data, null, 2)}${BEHAVIOR_RULES}`;
          }
        } catch (err: any) {
          logger.warn({ lineId, err: err.message }, 'External context fetch failed');
        }
      }

      // Priority 2: DB Stored Context
      if (line.businessContext) {
        return `${systemPrompt}\n\nContexto del negocio (DB):\n${JSON.stringify(line.businessContext, null, 2)}${BEHAVIOR_RULES}`;
      }

      return systemPrompt + BEHAVIOR_RULES;
    } catch (err: any) {
      logger.error({ lineId, err: err.message }, 'Error fetching context');
      return DEFAULT_PROMPT + BEHAVIOR_RULES;
    }
  }
}
