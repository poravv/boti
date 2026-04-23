// Driven Adapter: Audit Logger using Winston
// Logs to DB and rotating log files

import winston from 'winston';
import type { IAuditLogger, AuditLog } from '@boti/core';

const fileLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/audit.log', maxsize: 5_242_880, maxFiles: 10 }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

export class WinstonAuditAdapter implements IAuditLogger {
  constructor(
    // Pass in a DB save function so we stay decoupled from Prisma
    private readonly saveToDb?: (entry: Omit<AuditLog, 'id' | 'createdAt'>) => Promise<void>,
  ) {}

  async logEvent(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    fileLogger.info({ ...entry, timestamp: new Date().toISOString() });
    try {
      await this.saveToDb?.(entry);
    } catch (err: any) {
      fileLogger.error({ msg: 'Failed to persist audit log to DB', err: err.message });
    }
  }
}
