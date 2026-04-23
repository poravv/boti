// Hexagonal Architecture - Inbound Ports (Use Cases the core exposes)

export interface SendMessageUseCase {
  execute(input: { lineId: string; to: string; content: string; type?: 'TEXT' | 'IMAGE' | 'PDF' | 'LINK'; mediaPath?: string }): Promise<void>;
}

export interface HandleInboundMessageUseCase {
  execute(input: { lineId: string; fromPhone: string; fromName: string; content: string; type: string }): Promise<void>;
}

export interface ConnectWhatsAppLineUseCase {
  execute(lineId: string): Promise<{ qrCode?: string }>;
}

export interface BlockClientUseCase {
  execute(phone: string, reason: string): Promise<void>;
}

export interface GetDashboardStatsUseCase {
  execute(): Promise<{ activeLines: number; totalMessages: number; blockedClients: number }>;
}
