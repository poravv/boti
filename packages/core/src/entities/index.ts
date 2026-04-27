// Hexagonal Architecture - Domain Entities

export interface Client {
  id: string;
  phone: string;
  name: string;
  isBlocked: boolean;
  blockedUntil?: Date;
  aiPausedUntil?: Date;
  conversationStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  lineId: string;
  clientPhone: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'PDF' | 'LINK';
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  sentAt?: Date;
  createdAt: Date;
}

export interface WhatsAppLine {
  id: string;
  name: string;
  phone?: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_PENDING';
  qrCode?: string;
  assignedAiProvider?: string;
  systemPrompt?: string;
  createdAt: Date;
}

export interface ConversationContext {
  clientPhone: string;
  lineId: string;
  clientName: string;
  summary: string;
  lastMessages: Message[];
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR';
  isActive: boolean;
  createdAt: Date;
}

export interface SaleRecord {
  id: string;
  lineId: string;
  clientPhone: string;
  hashPedido?: string;
  pagoParOrderId?: string;
  paymentLinkUrl?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'INVOICED' | 'FAILED';
  items: unknown[];
  invoiceId?: string;
  paidAt?: Date;
  invoicedAt?: Date;
  createdAt: Date;
}
