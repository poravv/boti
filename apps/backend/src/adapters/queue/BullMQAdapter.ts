// Driven Adapter: BullMQ Message Queue
// Implements IMessageQueue and processes outgoing messages via Baileys

import { Queue, Worker, Job } from 'bullmq';
import type { IMessageQueue, OutboundMessagePayload, IWhatsAppProvider, IMessageRepository } from '@boti/core';
import { logger } from '../../lib/logger.js';

const QUEUE_NAME = 'boti-outbound';

export class BullMQAdapter implements IMessageQueue {
  private queue: Queue;
  private worker?: Worker;

  constructor(
    private readonly redisConnection: { host: string; port: number },
    private readonly whatsApp: IWhatsAppProvider,
    private readonly messageRepo: IMessageRepository,
    private readonly wsNotify: (event: string, data: any) => void,
  ) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }

  async enqueue(lineId: string, payload: OutboundMessagePayload): Promise<void> {
    await this.queue.add(`msg-${lineId}`, { lineId, ...payload });
  }

  startWorker(): void {
    this.worker = new Worker<{ lineId: string } & OutboundMessagePayload>(
      QUEUE_NAME,
      async (job: Job) => {
        const { lineId, to, content, type, mediaPath, clientMessageId } = job.data;

        // Notify frontend: PENDING
        if (clientMessageId) this.wsNotify('message:status', { id: clientMessageId, status: 'PENDING' });

        try {
          let msgId: string;
          if (type === 'TEXT') {
            msgId = await this.whatsApp.sendTextMessage(lineId, to, content);
          } else {
            msgId = await this.whatsApp.sendMediaMessage(lineId, to, mediaPath, type);
          }

          // Save outbound message to DB
          const saved = await this.messageRepo.save({
            lineId, clientPhone: to, content, type, direction: 'OUTBOUND', status: 'SUCCESS', sentAt: new Date(),
          });

          // Update status in DB
          await this.messageRepo.updateStatus(saved.id, 'SUCCESS', new Date());

          // Notify frontend: SUCCESS & NEW MESSAGE
          this.wsNotify('message:status', { id: clientMessageId ?? saved.id, status: 'SUCCESS', outboundId: msgId });
          this.wsNotify('message:new', { lineId, fromPhone: to, content, type, direction: 'OUTBOUND' });

          logger.info({ lineId, to, type, msgId }, 'Message sent successfully');
        } catch (err: any) {
          logger.error({ lineId, to, err: err.message }, 'Failed to send message');
          if (clientMessageId) this.wsNotify('message:status', { id: clientMessageId, status: 'FAILED' });
          throw err; // Let BullMQ retry
        }
      },
      { connection: this.redisConnection, concurrency: 20 },
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err: err.message }, 'Job permanently failed after retries');
    });

    logger.info('BullMQ outbound worker started');
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
