// Core Use Case: SendMessageUseCase
// Enqueues an outbound message. Used by operators sending manual messages.

import type { SendMessageUseCase } from '../ports/inbound.js';
import type { IMessageQueue, IAuditLogger } from '../ports/outbound.js';

export class SendMessage implements SendMessageUseCase {
  constructor(
    private readonly queue: IMessageQueue,
    private readonly auditLogger: IAuditLogger,
  ) {}

  async execute(input: {
    lineId: string;
    to: string;
    content: string;
    type?: 'TEXT' | 'IMAGE' | 'PDF' | 'LINK';
    mediaPath?: string;
    operatorId?: string;
  }): Promise<void> {
    const { lineId, to, content, type = 'TEXT', mediaPath, operatorId } = input;

    await this.queue.enqueue(lineId, { to, content, type, mediaPath });

    await this.auditLogger.logEvent({
      userId: operatorId,
      action: 'MANUAL_MESSAGE_SENT',
      details: { lineId, to, type },
    });
  }
}
