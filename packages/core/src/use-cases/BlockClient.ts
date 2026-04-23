// Core Use Case: BlockClientUseCase

import type { BlockClientUseCase } from '../ports/inbound.js';
import type { IClientRepository, IAuditLogger } from '../ports/outbound.js';

const BLOCK_DURATION_MS = parseInt(process.env.SPAM_BLOCK_DURATION_MS ?? '86400000', 10);

export class BlockClient implements BlockClientUseCase {
  constructor(
    private readonly clientRepo: IClientRepository,
    private readonly auditLogger: IAuditLogger,
  ) {}

  async execute(phone: string, reason: string, blockedByUserId?: string): Promise<void> {
    const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
    await this.clientRepo.blockClient(phone, blockedUntil);
    await this.auditLogger.logEvent({
      userId: blockedByUserId,
      action: 'CLIENT_BLOCKED',
      details: { phone, reason, blockedUntil },
    });
  }
}
