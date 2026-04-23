import { PrismaClient } from '@prisma/client';
import type { IContextFetcher } from '@boti/core';
import { logger } from '../../lib/logger.js';

export class ContextFetcherAdapter implements IContextFetcher {
  constructor(private readonly prisma: PrismaClient) {}

  async fetchContextForBusiness(lineId: string): Promise<string> {
    try {
      const line = await this.prisma.whatsAppLine.findUnique({
        where: { id: lineId },
      });

      if (!line) {
        return 'Eres un asistente de negocio.';
      }

      const systemPrompt = line.systemPrompt ?? 'Eres un asistente de negocio.';

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
            return `${systemPrompt}\n\nContexto del negocio (API):\n${JSON.stringify(data, null, 2)}`;
          }
        } catch (err: any) {
          logger.warn({ lineId, err: err.message }, 'External context fetch failed');
        }
      }

      // Priority 2: DB Stored Context
      if (line.businessContext) {
        return `${systemPrompt}\n\nContexto del negocio (DB):\n${JSON.stringify(line.businessContext, null, 2)}`;
      }

      return systemPrompt;
    } catch (err: any) {
      logger.error({ lineId, err: err.message }, 'Error fetching context');
      return 'Eres un asistente de negocio.';
    }
  }
}
