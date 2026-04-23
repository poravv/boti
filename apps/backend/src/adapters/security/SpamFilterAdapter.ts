// Driven Adapter: Anti-Spam Rate Limiter using Redis
// Blocks clients who exceed SPAM_THRESHOLD messages per minute

import type Redis from 'ioredis';
import type { BlockClientUseCase } from '@boti/core';
import { logger } from '../../lib/logger.js';

const SPAM_THRESHOLD = parseInt(process.env.SPAM_THRESHOLD ?? '50', 10);
const WINDOW_SECONDS = 60;

export class SpamFilterAdapter {
  constructor(
    private readonly redis: Redis,
    private readonly blockClient: BlockClientUseCase,
  ) {}

  /**
   * Returns true if message should be dropped (user is spamming).
   */
  async check(phone: string): Promise<boolean> {
    const key = `spam:${phone}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }

    if (count > SPAM_THRESHOLD) {
      logger.warn({ phone, count }, 'Spam detected — blocking user');
      await this.blockClient.execute(phone, 'SPAM_DETECTED');
      return true;
    }

    return false;
  }
}
