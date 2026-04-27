// Hexagonal Architecture - All Outbound Ports (Interfaces the core needs)
import type { Client, Message, WhatsAppLine, ConversationContext, AuditLog, User } from '../entities/index.js';

// --- WhatsApp ---
export interface IWhatsAppProvider {
  connectLine(lineId: string): Promise<string | null>;
  disconnectLine(lineId: string): Promise<void>;
  sendTextMessage(lineId: string, to: string, text: string): Promise<string>; // returns message ID
  sendMediaMessage(lineId: string, to: string, mediaPath: string, type: 'IMAGE' | 'PDF'): Promise<string>;
  getLineStatus(lineId: string): Promise<WhatsAppLine['status']>;
  getQrCode(lineId: string): Promise<string | null>;
}

// --- Repositories ---
export interface IClientRepository {
  findByPhone(phone: string): Promise<Client | null>;
  upsert(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>, orgId?: string): Promise<Client>;
  blockClient(phone: string, until: Date): Promise<void>;
}

export interface IMessageRepository {
  save(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  updateStatus(messageId: string, status: Message['status'], sentAt?: Date): Promise<void>;
  findByClientPhone(phone: string, limit?: number): Promise<Message[]>;
}

export interface IContextRepository {
  get(lineId: string, clientPhone: string): Promise<ConversationContext | null>;
  save(ctx: ConversationContext): Promise<void>;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

// --- Queue ---
export interface IMessageQueue {
  enqueue(lineId: string, payload: OutboundMessagePayload): Promise<void>;
}

export interface OutboundMessagePayload {
  to: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'PDF' | 'LINK';
  mediaPath?: string;
  clientMessageId?: string;
}

// --- AI ---
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export type AIReplyResult =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCallId: string; name: string; args: Record<string, unknown> };

export interface IAIService {
  generateReply(messages: AIMessage[], options?: { lineId?: string }): Promise<string>;
  generateReplyWithTools?(
    messages: AIMessage[],
    tools: AIToolDef[],
    options?: { lineId?: string },
  ): Promise<AIReplyResult>;
}

// --- Sales / Autonomous Selling ---
export interface ISalesService {
  isEnabledForLine(lineId: string): Promise<boolean>;
  getToolDefinitions(): AIToolDef[];
  executeTool(
    lineId: string,
    clientPhone: string,
    clientName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string>;
}

// --- Context Manager ---
export interface IContextFetcher {
  fetchContextForBusiness(lineId: string): Promise<string>; // Fetches from external API or fallback JSON
}

// --- External API Integration ---
export interface ExternalApiConfig {
  id: string;
  lineId: string;
  name: string;
  baseUrl: string;
  method: string;
  headers: Record<string, string>;
  body?: string | null;
  outputKey?: string | null;
  username?: string | null;
  password?: string | null;
  isActive: boolean;
}

export interface IExternalApiRepository {
  findByLineId(lineId: string): Promise<ExternalApiConfig[]>;
}

// --- Audit ---
export interface IAuditLogger {
  logEvent(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void>;
}

// --- Notifications ---
export interface INotifier {
  notifyOperators(lineId: string, event: 'NEW_MESSAGE' | 'AI_ERROR' | 'SPAM_DETECTED' | 'OPERATOR_REQUESTED' | 'MANUAL_INTERVENTION_NEEDED', details: any): Promise<void>;
}
