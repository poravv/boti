// Boti Backend — Entry Point
// Wires together all adapters following Hexagonal Architecture

import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Redis from 'ioredis';

import { logger } from './lib/logger.js';
import { WebSocketManager } from './lib/WebSocketManager.js';

import { AuthService } from './lib/AuthService.js';
import { BaileysWhatsAppAdapter } from './adapters/whatsapp/BaileysAdapter.js';
import { BullMQAdapter } from './adapters/queue/BullMQAdapter.js';
import { SpamFilterAdapter } from './adapters/security/SpamFilterAdapter.js';
import { createAIService } from './adapters/ai/AIServiceAdapter.js';
import { ContextFetcherAdapter } from './adapters/context/ContextFetcherAdapter.js';
import { WinstonAuditAdapter } from './adapters/audit/WinstonAuditAdapter.js';
import {
  PrismaClientRepository,
  PrismaMessageRepository,
  PrismaContextRepository,
  PrismaExternalApiRepository,
  resolveOrgIdFromLine,
  prisma,
} from './adapters/db/PrismaRepositories.js';

import { HandleInboundMessage, SendMessage, BlockClient } from '@boti/core';
import { createRouter } from './http/router.js';
import { SalesService } from './services/SalesService.js';
import { CalendarService } from './services/CalendarService.js';
import { EmailService } from './services/EmailService.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const MAX_MESSAGES = parseInt(process.env.CONTEXT_MAX_MESSAGES ?? '10', 10);
const SPAM_THRESHOLD = parseInt(process.env.SPAM_THRESHOLD ?? '50', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function bootstrap() {
  // ─── Infrastructure ──────────────────────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  const server = http.createServer(app);
  const wsManager = new WebSocketManager(server);

  const redis = new Redis(REDIS_URL);
  const redisConn = { host: redis.options.host ?? 'localhost', port: redis.options.port ?? 6379 };

  // ─── Repositories ────────────────────────────────────────────────────
  const baseClientRepo = new PrismaClientRepository();
  const clientRepo = baseClientRepo;
  const messageRepo = new PrismaMessageRepository();
  const contextRepo = new PrismaContextRepository();
  const externalApiRepo = new PrismaExternalApiRepository();

  // ─── Audit Logger ────────────────────────────────────────────────────
  const auditLogger = new WinstonAuditAdapter(async (entry) => {
    await prisma.auditLog.create({ data: { action: entry.action, details: entry.details as any, userId: entry.userId } });
  });

  // --- AI Service ------------------------------------------------------
  const aiService = createAIService(prisma);
  const authService = new AuthService(prisma);

  // --- Sales Service ---------------------------------------------------
  const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? `http://localhost:${PORT}`;
  const salesService = new SalesService(prisma, BACKEND_BASE_URL);

  // --- Calendar Service ------------------------------------------------
  const calendarService = new CalendarService(prisma);

  // --- Seed Default Org + Admin User ---
  const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
  // Ensure default org exists
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: { id: DEFAULT_ORG_ID, name: 'Default', slug: 'default' },
  });
  // Ensure admin user exists with orgId
  const adminEmail = 'admin@boti.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashedPassword = await authService.hashPassword('admin123');
    await prisma.user.create({
      data: { email: adminEmail, passwordHash: hashedPassword, name: 'Boti Admin', role: 'ADMIN', isActive: true, orgId: DEFAULT_ORG_ID },
    });
    logger.info('Default admin user created.');
  } else if (!existingAdmin.orgId) {
    await prisma.user.update({ where: { email: adminEmail }, data: { orgId: DEFAULT_ORG_ID } });
  }

  // --- Seed Default Plans (idempotent — runs every start, never overwrites) ---
  const planSeeds = [
    { slug: 'trial',  name: 'Trial',  price: 0,      maxLines: 1, maxUsers: 2,  maxConversationsPerMonth: 100, trialDays: 15, aiEnabled: true },
    { slug: 'basico', name: 'Básico', price: 150000,  maxLines: 1, maxUsers: 5,  maxConversationsPerMonth: 500, trialDays: 0,  aiEnabled: true },
    { slug: 'pro',    name: 'Pro',    price: 350000,  maxLines: 3, maxUsers: 10, maxConversationsPerMonth: -1,  trialDays: 0,  aiEnabled: true },
  ];
  for (const seed of planSeeds) {
    await prisma.plan.upsert({ where: { slug: seed.slug }, update: {}, create: seed });
  }
  // Deactivate obsolete plans so they no longer appear publicly
  await prisma.plan.updateMany({ where: { slug: { in: ['starter', 'enterprise'] } }, data: { isActive: false } });

  // ─── Context Fetcher ─────────────────────────────────────────────────
  const contextFetcher = new ContextFetcherAdapter(prisma);

  // ─── WhatsApp Adapter ────────────────────────────────────────────────
  const whatsApp = new BaileysWhatsAppAdapter(redis, (lineId, status, qrCode) => {
    wsManager.broadcast('line:status', { lineId, status, qrCode });
    logger.info({ lineId, status }, 'WhatsApp line status changed');
  });

  // ─── Use Cases ───────────────────────────────────────────────────────
  const blockClientUseCase = new BlockClient(clientRepo, auditLogger);

  const notifier = {
    async notifyOperators(lineId: string, event: string, details: any) {
      wsManager.broadcast('operator:notification', { lineId, event, details });
    },
  };

  const handleInbound = new HandleInboundMessage({
    clientRepo,
    messageRepo,
    contextRepo,
    queue: null as any, // filled after queue init below
    aiService,
    contextFetcher,
    auditLogger,
    notifier,
    externalApiRepo,
    salesService,
    calendarService,
    maxMessages: MAX_MESSAGES,
    spamThreshold: SPAM_THRESHOLD,
  });

  const sendMessageUseCase = new SendMessage(null as any, auditLogger);

  // ─── Queue ───────────────────────────────────────────────────────────
  const queue = new BullMQAdapter(
    redisConn,
    whatsApp,
    messageRepo,
    (event, data) => wsManager.broadcast(event, data),
  );
  // Patch use cases with real queue
  (handleInbound as any).deps.queue = queue;
  (sendMessageUseCase as any).queue = queue;

  queue.startWorker();

  // Auto-close conversations inactive for 12+ hours — runs every hour
  setInterval(async () => {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const result = await prisma.client.updateMany({
      where: { conversationStatus: 'OPEN', updatedAt: { lt: cutoff } },
      data: {
        conversationStatus: 'CLOSED',
        closedAt: new Date(),
        assignedToUserId: null,
        aiPausedUntil: null,
      },
    });
    if (result.count > 0) {
      logger.info({ count: result.count }, 'Auto-closed inactive conversations');
    }
  }, 60 * 60 * 1000);

  // ─── Spam Filter ─────────────────────────────────────────────────────
  const spamFilter = new SpamFilterAdapter(redis, blockClientUseCase);

  // ─── Incoming Message Handler ─────────────────────────────────────────
  // Debounce: wait before processing so rapid consecutive messages from the
  // same client are accumulated and sent to the AI as a single turn.
  const debounceMs = parseInt(process.env.INBOUND_DEBOUNCE_MS ?? '3000', 10);
  interface Pending { content: string; fromName: string; lineId: string; timer: ReturnType<typeof setTimeout> }
  const pending = new Map<string, Pending>();

  whatsApp.setOnMessage(async (lineId, fromPhone, fromName, content, type) => {
    const isSpam = await spamFilter.check(fromPhone);
    if (isSpam) {
      wsManager.broadcast('operator:notification', { lineId, event: 'SPAM_DETECTED', details: { phone: fromPhone } });
      return;
    }

    // Broadcast immediately so the UI shows the message without waiting for AI.
    wsManager.broadcast('message:new', { lineId, fromPhone, clientPhone: fromPhone, fromName, content, type });

    const key = `${lineId}:${fromPhone}`;
    const existing = pending.get(key);

    if (existing) {
      // Append new content and reset the timer.
      clearTimeout(existing.timer);
      existing.content = existing.content + '\n' + content;
    }

    const accumulated = existing?.content ?? content;

    const timer = setTimeout(async () => {
      pending.delete(key);
      const lineOrgId = await resolveOrgIdFromLine(prisma, lineId);
      baseClientRepo.currentOrgId = lineOrgId;

      // Plan enforcement: block processing if trial expired or conversation limit reached
      if (lineOrgId) {
        const org = await prisma.organization.findUnique({
          where: { id: lineOrgId },
          select: { isActive: true, trialEndsAt: true, conversationsThisMonth: true, plan: { select: { maxConversationsPerMonth: true } } },
        });
        if (!org || !org.isActive) { baseClientRepo.currentOrgId = undefined; return; }
        if (org.trialEndsAt && org.trialEndsAt < new Date()) { baseClientRepo.currentOrgId = undefined; return; }
        if (org.plan && org.plan.maxConversationsPerMonth > 0 && org.conversationsThisMonth >= org.plan.maxConversationsPerMonth) {
          baseClientRepo.currentOrgId = undefined; return;
        }
      }

      // Snapshot updatedAt before processing to detect new session (>6h since last activity)
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const existingClient = await prisma.client.findUnique({ where: { phone: fromPhone }, select: { updatedAt: true } });
      const isNewSession = !existingClient || (Date.now() - existingClient.updatedAt.getTime()) > SIX_HOURS;

      await handleInbound.execute({ lineId, fromPhone, fromName, content: accumulated, type });
      baseClientRepo.currentOrgId = undefined;

      // Increment monthly conversation counter once per session, non-blocking
      if (isNewSession && lineOrgId) {
        prisma.organization.update({
          where: { id: lineOrgId },
          data: { conversationsThisMonth: { increment: 1 } },
        }).catch(() => {});
      }
    }, debounceMs);

    pending.set(key, { content: accumulated, fromName, lineId, timer });
  });

  // Root Health Check
  app.get('/', (req, res) => {
    res.json({ status: 'Boti Backend is running', timestamp: new Date() });
  });

  // ─── HTTP Routes ─────────────────────────────────────────────────────
  app.use('/api', createRouter(whatsApp, sendMessageUseCase, blockClientUseCase, prisma, wsManager, salesService, calendarService));

  // ─── Autostart Lines ────────────────────────────────────────────────
  try {
    const activeLines = await prisma.whatsAppLine.findMany();
    logger.info({ count: activeLines.length }, 'Autostarting WhatsApp lines...');
    for (const line of activeLines) {
      whatsApp.connectLine(line.id).catch(err => {
        logger.error({ lineId: line.id, err: err.message }, 'Failed to autostart line');
      });
    }
  } catch (err) {
    logger.error({ err }, 'Error during autostart');
  }

  // ─── Start ────────────────────────────────────────────────────────────
  server.listen(PORT, () => {
    logger.info({ port: PORT }, '🚀 Boti backend running');
  });

  // Reset monthly conversation counters for orgs whose reset date has passed — runs every hour
  setInterval(async () => {
    try {
      const now = new Date();
      const result = await prisma.organization.updateMany({
        where: { usageResetAt: { lte: now } },
        data: {
          conversationsThisMonth: 0,
          usageResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });
      if (result.count > 0) {
        logger.info({ count: result.count }, 'Reset usage counters for organizations');
      }
    } catch (err) {
      logger.error({ err }, 'Usage reset cron failed');
    }
  }, 60 * 60 * 1000);

  // ─── Trial Expiry Warning Cron ────────────────────────────────────────
  // Runs every hour. Sends a warning email when trialEndsAt is ~3 days away
  // (within a 2h window centered on 72h) so the email fires exactly once.
  const emailService = new EmailService(prisma);
  setInterval(async () => {
    try {
      const now = new Date();
      const lower = new Date(now.getTime() + 71 * 60 * 60 * 1000); // 71h from now
      const upper = new Date(now.getTime() + 73 * 60 * 60 * 1000); // 73h from now
      const expiringOrgs = await prisma.organization.findMany({
        where: { trialEndsAt: { gte: lower, lte: upper }, isActive: true },
      });
      for (const org of expiringOrgs) {
        if (!org.trialEndsAt) continue;
        const admin = await prisma.user.findFirst({
          where: { orgId: org.id, role: 'ADMIN', isActive: true },
          select: { email: true, name: true },
        });
        if (!admin) continue;
        await emailService.sendTrialExpiring(admin.email ?? '', admin.name, org.name, org.trialEndsAt).catch(() => {});
        logger.info({ orgId: org.id, email: admin.email }, 'Trial expiry warning email sent');
      }
    } catch (err) {
      logger.error({ err }, 'Trial warning cron failed');
    }
  }, 60 * 60 * 1000);

  // ─── Graceful Shutdown ────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated...');
    await queue.shutdown();
    await prisma.$disconnect();
    redis.disconnect();
    server.close(() => {
      logger.info('Server closed. Goodbye.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during bootstrap');
  process.exit(1);
});
