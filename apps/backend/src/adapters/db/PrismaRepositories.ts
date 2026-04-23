// Prisma Repository Adapters
// Implement the domain IRepository interfaces using Prisma

import { PrismaClient } from '@prisma/client';
import type { IClientRepository, IMessageRepository, IContextRepository, IAuditLogger, Client, Message, ConversationContext } from '@boti/core';

const prisma = new PrismaClient();
export { prisma };

// ─── Client Repository ───────────────────────────────────────────────────────
export class PrismaClientRepository implements IClientRepository {
  async findByPhone(phone: string): Promise<Client | null> {
    return prisma.client.findUnique({ where: { phone } }) as any;
  }

  async upsert(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    return prisma.client.upsert({
      where: { phone: data.phone },
      update: { name: data.name },
      create: { phone: data.phone, name: data.name },
    }) as any;
  }

  async blockClient(phone: string, until: Date): Promise<void> {
    await prisma.client.update({
      where: { phone },
      data: { isBlocked: true, blockedUntil: until },
    });
  }
}

// ─── Message Repository ───────────────────────────────────────────────────────
export class PrismaMessageRepository implements IMessageRepository {
  async save(msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    return prisma.message.create({ data: msg as any }) as any;
  }

  async updateStatus(id: string, status: Message['status'], sentAt?: Date): Promise<void> {
    await prisma.message.update({ where: { id }, data: { status, sentAt } });
  }

  async findByClientPhone(phone: string, limit = 50): Promise<Message[]> {
    return prisma.message.findMany({
      where: { clientPhone: phone },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as any;
  }

  async markAsRead(phone: string): Promise<void> {
    await prisma.message.updateMany({
      where: { clientPhone: phone, direction: 'INBOUND', isRead: false },
      data: { isRead: true },
    });
  }
}

// ─── Context Repository ───────────────────────────────────────────────────────
export class PrismaContextRepository implements IContextRepository {
  async get(lineId: string, clientPhone: string): Promise<ConversationContext | null> {
    const row = await prisma.conversationContext.findUnique({ where: { lineId_clientPhone: { lineId, clientPhone } } });
    if (!row) return null;
    return {
      clientPhone: row.clientPhone,
      lineId: row.lineId,
      clientName: row.clientName,
      summary: row.summary,
      lastMessages: (row.messages as any[]) ?? [],
      updatedAt: row.updatedAt,
    };
  }

  async save(ctx: ConversationContext): Promise<void> {
    await prisma.conversationContext.upsert({
      where: { lineId_clientPhone: { lineId: ctx.lineId, clientPhone: ctx.clientPhone } },
      update: { summary: ctx.summary, messages: ctx.lastMessages as any, clientName: ctx.clientName, updatedAt: ctx.updatedAt },
      create: {
        lineId: ctx.lineId, clientPhone: ctx.clientPhone, clientName: ctx.clientName,
        summary: ctx.summary, messages: ctx.lastMessages as any,
      },
    });
  }
}
