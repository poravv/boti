// Driven Adapter: AI Services
// Implements IAIService for Gemini and OpenAI. Extend easily for Claude/Grok.

import type { IAIService, AIMessage, AIToolDef, AIReplyResult } from '@boti/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

export class GeminiAIAdapter implements IAIService {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName = 'gemini-1.5-flash') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  private get model() {
    return this.genAI.getGenerativeModel({ model: this.modelName });
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

  async generateReplyWithTools(
    messages: AIMessage[],
    tools: AIToolDef[],
    _options?: any,
  ): Promise<AIReplyResult> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));

    const geminiTools = [{
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT' as const,
          properties: Object.fromEntries(
            Object.entries((t.parameters as any).properties ?? {}).map(([k, v]: [string, any]) => [
              k,
              { type: (v.type ?? 'STRING').toUpperCase(), description: v.description ?? '' },
            ]),
          ),
          required: (t.parameters as any).required ?? [],
        },
      })),
    }];

    const modelWithTools = this.genAI.getGenerativeModel({
      model: this.modelName,
      tools: geminiTools as any,
    });

    const chat = modelWithTools.startChat({
      systemInstruction: systemMsg?.content,
      history: history.slice(0, -1),
    });

    const lastUserMsg = history.at(-1)?.parts[0].text ?? '';
    const result = await chat.sendMessage(lastUserMsg);
    const response = result.response;

    const fnCall = response.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
    if (fnCall?.functionCall) {
      return {
        type: 'tool_call',
        toolCallId: `gemini-${Date.now()}`,
        name: fnCall.functionCall.name,
        args: (fnCall.functionCall.args ?? {}) as Record<string, unknown>,
      };
    }

    return { type: 'text', content: response.text() };
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

  async generateReplyWithTools(
    messages: AIMessage[],
    tools: AIToolDef[],
    _options?: any,
  ): Promise<AIReplyResult> {
    const openAiTools = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: openAiTools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const tc = choice.message.tool_calls[0];
      return {
        type: 'tool_call',
        toolCallId: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      };
    }

    return { type: 'text', content: choice.message.content ?? '' };
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

  private async resolveAdapter(options?: { lineId?: string }): Promise<IAIService> {
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

    if (lineModel?.startsWith('gpt-')) provider = 'openai';
    else if (lineModel?.startsWith('gemini-')) provider = 'gemini';

    if (lineKey || lineModel) {
      const key = lineKey || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY);
      const model = lineModel || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');
      if (!key) throw new Error(`API Key for ${provider} is missing`);
      return provider === 'openai' ? new OpenAIAdapter(key, model) : new GeminiAIAdapter(key, model);
    }

    const adapter = this.adapters.get(provider) || this.adapters.get('gemini');
    if (!adapter) throw new Error(`AI Provider ${provider} not configured`);
    return adapter;
  }

  async generateReply(messages: AIMessage[], options?: { lineId?: string }): Promise<string> {
    try {
      const adapter = await this.resolveAdapter(options);
      return await adapter.generateReply(messages);
    } catch (err: any) {
      console.error(`[AI_ERROR] error=${err.message}`);
      throw err;
    }
  }

  async generateReplyWithTools(
    messages: AIMessage[],
    tools: AIToolDef[],
    options?: { lineId?: string },
  ): Promise<AIReplyResult> {
    const adapter = await this.resolveAdapter(options);
    if (!adapter.generateReplyWithTools) {
      // Fallback: call without tools and return as text
      const content = await adapter.generateReply(messages);
      return { type: 'text', content };
    }
    return adapter.generateReplyWithTools(messages, tools, options);
  }
}

export function createAIService(prisma: PrismaClient): IAIService {
  return new MultiAIProviderAdapter(prisma);
}
