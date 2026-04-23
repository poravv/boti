// Driven Adapter: AI Services
// Implements IAIService for Gemini and OpenAI. Extend easily for Claude/Grok.

import type { IAIService, AIMessage } from '@boti/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

export class GeminiAIAdapter implements IAIService {
  private model;

  constructor(apiKey: string, modelName = 'gemini-1.5-flash') {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async generateReply(messages: AIMessage[], _options?: any): Promise<string> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));

    const chat = this.model.startChat({
      systemInstruction: systemMsg?.content,
      history: history.slice(0, -1),
    });

    const lastUserMsg = history.at(-1)?.parts[0].text ?? '';
    const result = await chat.sendMessage(lastUserMsg);
    return result.response.text();
  }
}

export class OpenAIAdapter implements IAIService {
  private client: OpenAI;

  constructor(apiKey: string, private readonly model = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
  }

  async generateReply(messages: AIMessage[], _options?: any): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

// Factory to pick the right adapter based on line config
export class MultiAIProviderAdapter implements IAIService {
  private adapters: Map<string, IAIService> = new Map();

  constructor(private readonly prisma: PrismaClient) {
    // Pre-initialize default adapters if keys are present
    if (process.env.GEMINI_API_KEY) {
      this.adapters.set('gemini', new GeminiAIAdapter(process.env.GEMINI_API_KEY));
    }
    if (process.env.OPENAI_API_KEY) {
      this.adapters.set('openai', new OpenAIAdapter(process.env.OPENAI_API_KEY));
    }
  }

  async generateReply(messages: AIMessage[], options?: { lineId: string }): Promise<string> {
    const lineId = options?.lineId;
    let provider = 'gemini';
    let lineKey: string | null = null;
    let lineModel: string | null = null;

    if (lineId) {
      const line = await this.prisma.whatsAppLine.findUnique({ where: { id: lineId } });
      provider = line?.assignedAiProvider || 'gemini';
      lineKey = line?.aiApiKey || null;
      lineModel = line?.aiModel || null;
    }

    // Auto-detect provider if model starts with gpt- (OpenAI)
    if (lineModel?.startsWith('gpt-')) {
      provider = 'openai';
    } else if (lineModel?.startsWith('gemini-')) {
      provider = 'gemini';
    }

    // If a specific key OR model is provided for this line, use it
    if (lineKey || lineModel) {
      const key = lineKey || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY);
      const model = lineModel || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

      if (!key) throw new Error(`API Key for ${provider} is missing`);

      try {
        const tempAdapter = provider === 'openai' 
          ? new OpenAIAdapter(key, model) 
          : new GeminiAIAdapter(key, model);
        return await tempAdapter.generateReply(messages);
      } catch (err: any) {
        console.error(`[AI_ERROR] provider=${provider} model=${model} error=${err.message}`);
        throw err;
      }
    }

    const adapter = this.adapters.get(provider) || this.adapters.get('gemini');
    if (!adapter) throw new Error(`AI Provider ${provider} not configured`);

    return adapter.generateReply(messages);
  }
}

export function createAIService(prisma: PrismaClient): IAIService {
  return new MultiAIProviderAdapter(prisma);
}
