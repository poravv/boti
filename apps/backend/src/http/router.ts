// Express Router — REST API routes

import { Router, type Request, type Response } from 'express';
import type {
  IWhatsAppProvider,
  SendMessage,
  BlockClient,
} from '@boti/core';
import { PrismaClient } from '@prisma/client';
import { PrismaMessageRepository, PrismaClientRepository } from '../adapters/db/PrismaRepositories.js';
import { AuthService, FIREBASE_AUTH_ENABLED } from '../lib/AuthService.js';
import { orgScope } from '../lib/orgScope.js';
import type { WebSocketManager } from '../lib/WebSocketManager.js';
import type { SalesService } from '../services/SalesService.js';
import type { CalendarService } from '../services/CalendarService.js';
import { EmailService } from '../services/EmailService.js';

const messageRepo = new PrismaMessageRepository();
const clientRepo = new PrismaClientRepository();

export function createRouter(
  whatsApp: IWhatsAppProvider,
  sendMessage: SendMessage,
  blockClient: BlockClient,
  prisma: PrismaClient,
  wsManager: WebSocketManager,
  salesService?: SalesService,
  calendarService?: CalendarService,
): Router {
  const router = Router();
  const authService = new AuthService(prisma);
  const emailService = new EmailService(prisma);

  async function notifyAdmin(waMessage: string): Promise<void> {
    try {
      const adminNumber = (process.env.ADMIN_WA_NUMBER || '595981586823').replace('+', '');
      const adminJid = adminNumber + '@s.whatsapp.net';

      let lineId = process.env.ADMIN_NOTIFICATION_LINE_ID;
      if (!lineId) {
        const firstLine = await prisma.whatsAppLine.findFirst({ select: { id: true } });
        lineId = firstLine?.id;
      }

      if (!lineId) {
        console.warn('[notifyAdmin] No WhatsApp line available for notification');
        return;
      }

      await whatsApp.sendTextMessage(lineId, adminJid, waMessage);
    } catch (err) {
      console.warn('[notifyAdmin] WhatsApp notification failed:', err);
    }
  }

  // --- Auth Middleware ---
  // Always verifies the boti JWT (issued by /auth/firebase-session or /auth/login).
  // Firebase ID tokens are only consumed once in /auth/firebase-session — never here.
  const authMiddleware = async (req: Request, res: Response, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired token' });

    (req as any).user = decoded;

    // SUPERADMIN bypasses org checks — they manage all orgs
    const orgId = (decoded as any).orgId as string | undefined;
    if (!orgId && (decoded as any).role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Usuario sin organización asignada. Contactá al administrador.' });
    }
    if (orgId && (decoded as any).role !== 'SUPERADMIN') {
      try {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { isActive: true },
        });
        if (org && !org.isActive) {
          return res.status(403).json({ error: 'Tu organización está inactiva. Contactá al administrador.' });
        }
      } catch (_) {
        // DB failure — let the request through rather than locking everyone out
      }
    }

    next();
  };

  // --- Admin Middleware ---
  const requireAdmin = (req: Request, res: Response, next: () => void) => {
    const role = (req as any).user?.role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Se requiere rol ADMIN.' });
    }
    next();
  };

  // --- Super-Admin Middleware ---
  const requireSuperAdmin = (req: Request, res: Response, next: () => void) => {
    if ((req as any).user?.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Acceso exclusivo de super-administrador.' });
    }
    next();
  };

  // --- Plan Limit Middleware ---
  const checkPlanLimit = (resource: 'lines' | 'users') => async (req: Request, res: Response, next: () => void) => {
    const orgId = (req as any).user?.orgId as string | undefined;
    if (!orgId) return next();
    try {
      const org = await prisma.organization.findUnique({ where: { id: orgId }, include: { plan: true } });
      if (!org) return next();
      if (!org.isActive) return res.status(403).json({ error: 'Tu organización está inactiva. Contactá al administrador.' });
      if (org.trialEndsAt && org.trialEndsAt < new Date()) {
        return res.status(403).json({ error: 'Tu período de prueba expiró. Actualizá tu plan para continuar.' });
      }
      if (org.plan) {
        if (resource === 'lines' && org.plan.maxLines > 0) {
          const count = await prisma.whatsAppLine.count({ where: { orgId } });
          if (count >= org.plan.maxLines) return res.status(403).json({ error: `Límite de líneas WhatsApp alcanzado (${org.plan.maxLines}). Actualizá tu plan.` });
        }
        if (resource === 'users' && org.plan.maxUsers > 0) {
          const count = await prisma.user.count({ where: { orgId } });
          if (count >= org.plan.maxUsers) return res.status(403).json({ error: `Límite de usuarios alcanzado (${org.plan.maxUsers}). Actualizá tu plan.` });
        }
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  // --- Line Ownership Middleware ---
  const requireLineOwnership = async (req: Request, res: Response, next: () => void) => {
    const { lineId } = req.params;
    if (!lineId) return next();
    if ((req as any).user?.role === 'SUPERADMIN') return next();
    const userOrgId = (req as any).user?.orgId as string | undefined;
    try {
      const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId }, select: { orgId: true } });
      if (!line) return res.status(404).json({ error: 'Línea no encontrada.' });
      if (!line.orgId || !userOrgId || line.orgId !== userOrgId) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  // --- Auth Endpoints ---
  router.post('/auth/login', async (req, res) => {
    const { email, username, password } = req.body;
    if (!password || (!email && !username)) {
      return res.status(400).json({ error: 'email o username requerido, junto con password.' });
    }
    try {
      const user = email
        ? await prisma.user.findUnique({ where: { email } })
        : await prisma.user.findUnique({ where: { username: (username as string).toLowerCase() } });
      if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

      const isValid = await authService.comparePassword(password, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

      const orgId = user.orgId ?? '';
      const token = authService.generateToken({ userId: user.id, email: user.email ?? user.username ?? '', role: user.role, orgId });
      res.json({ token, user: { id: user.id, email: user.email, username: user.username, name: user.name, role: user.role, orgId } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/auth/me', authMiddleware, (req, res) => {
    res.json((req as any).user);
  });

  router.put('/auth/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Campos requeridos.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      if (!user.passwordHash) return res.status(400).json({ error: 'Tu cuenta usa autenticación Firebase. Cambiá la contraseña desde Google.' });
      const valid = await authService.comparePassword(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta.' });
      const hashed = await authService.hashPassword(newPassword);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/auth/register-org', async (req, res) => {
    // When Firebase is active, registration goes through Firebase (which enforces email verification).
    // Blocking this endpoint prevents bypassing verification via direct API calls.
    if (FIREBASE_AUTH_ENABLED) {
      return res.status(403).json({ error: 'Registro por este método deshabilitado. Usá Google o email con verificación.' });
    }
    const { orgName, ownerName, ownerEmail, ownerPassword } = req.body as {
      orgName?: string; ownerName?: string; ownerEmail?: string; ownerPassword?: string;
    };
    if (!orgName?.trim() || !ownerName?.trim() || !ownerEmail?.trim() || !ownerPassword) {
      return res.status(400).json({ error: 'orgName, ownerName, ownerEmail y ownerPassword son requeridos.' });
    }
    if (ownerPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    const slug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    try {
      const existing = await prisma.organization.findUnique({ where: { slug } });
      if (existing) return res.status(409).json({ error: 'Ya existe una organización con ese nombre.' });
      const org = await prisma.organization.create({ data: { name: orgName.trim(), slug } });
      const passwordHash = await authService.hashPassword(ownerPassword);
      const user = await prisma.user.create({
        data: { name: ownerName.trim(), email: ownerEmail.trim().toLowerCase(), passwordHash, role: 'ADMIN', isActive: true, orgId: org.id },
      });
      // Assign trial plan automatically
      const trialPlan = await prisma.plan.findFirst({ where: { slug: 'trial' }, select: { trialDays: true } }).catch(() => null);
      await authService.assignTrialPlan(org.id).catch(() => {});
      const token = authService.generateToken({ userId: user.id, email: user.email ?? '', role: user.role, orgId: org.id });

      // Fire-and-forget notifications — never block registration
      try {
        const trialDaysCount = trialPlan?.trialDays ?? 14;
        const adminEmail = process.env.ADMIN_EMAIL || 'andyvercha@gmail.com';
        const waMsg = `🆕 *Nueva org en Boti*\n\n📋 *Org:* ${orgName.trim()}\n👤 *Dueño:* ${ownerName.trim()}\n📧 *Email:* ${ownerEmail.trim()}\n⏱ *Trial:* ${trialDaysCount} días\n🕐 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`;
        notifyAdmin(waMsg).catch(() => {});
        emailService.sendWelcome(ownerEmail.trim(), ownerName.trim(), orgName.trim(), trialDaysCount).catch(() => {});
        emailService.sendAdminNewOrg(adminEmail, orgName.trim(), ownerName.trim(), ownerEmail.trim(), trialDaysCount).catch(() => {});
      } catch (_) {}

      return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: org.id }, org: { id: org.id, name: org.name, slug: org.slug } });
    } catch (err: any) {
      if (err?.code === 'P2002') return res.status(409).json({ error: 'Email ya registrado.' });
      return res.status(500).json({ error: 'Error interno.' });
    }
  });

  // Exchange Firebase ID token for a boti session token
  router.post('/auth/firebase-session', async (req, res) => {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) return res.status(400).json({ error: 'idToken requerido.' });
    try {
      const resolved = await authService.verifyFirebaseAndResolveUser(idToken);
      if (!resolved) return res.status(401).json({ error: 'Token de Firebase inválido o usuario no encontrado.' });
      const token = authService.generateToken(resolved);
      const user = await prisma.user.findUnique({
        where: { id: resolved.userId },
        select: { id: true, email: true, name: true, role: true, orgId: true },
      });

      // Fire-and-forget notifications on first Google sign-up
      if (resolved.isNew && resolved.role !== 'SUPERADMIN') {
        try {
          const trialPlan = await prisma.plan.findFirst({ where: { slug: 'trial' }, select: { trialDays: true } }).catch(() => null);
          const trialDays = trialPlan?.trialDays ?? 15;
          const adminEmail = process.env.ADMIN_EMAIL || 'andyvercha@gmail.com';
          const waMsg = `🆕 *Nueva org en Boti (Google)*\n\n👤 *Usuario:* ${resolved.name}\n📧 *Email:* ${resolved.email}\n⏱ *Trial:* ${trialDays} días\n🕐 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`;
          notifyAdmin(waMsg).catch(() => {});
          emailService.sendWelcome(resolved.email, resolved.name, resolved.name, trialDays).catch(() => {});
          emailService.sendAdminNewOrg(adminEmail, resolved.name, resolved.name, resolved.email, trialDays).catch(() => {});
        } catch (_) {}
      }

      return res.json({ token, user });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Public: plan catalog (no auth — used by landing page)
  router.get('/plans', async (_req: Request, res: Response) => {
    try {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, price: true, maxLines: true, maxUsers: true, maxConversationsPerMonth: true, trialDays: true, aiEnabled: true },
        orderBy: { price: 'asc' },
      });
      res.json({ plans });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stats
  router.get('/stats', authMiddleware, async (req, res) => {
    try {
      const orgId = (req as any).user.orgId as string;
      const lineFilter = { orgId };
      const clientFilter = { orgId };

      const [totalMessages, allLines, totalLeads, messagesToday] = await Promise.all([
        prisma.message.count({ where: { line: lineFilter } }),
        prisma.whatsAppLine.findMany({ where: lineFilter, select: { id: true } }),
        prisma.client.count({ where: clientFilter }),
        prisma.message.count({
          where: {
            line: lineFilter,
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          }
        }),
      ]);

      const lineStatuses = await Promise.all(allLines.map(l => whatsApp.getLineStatus(l.id)));
      const activeLinesCount = lineStatuses.filter(s => s === 'CONNECTED').length;

      const hourlyTraffic = await Promise.all(
        Array.from({ length: 15 }).map(async (_, i) => {
          const start = new Date();
          start.setHours(start.getHours() - (14 - i), 0, 0, 0);
          const end = new Date(start);
          end.setHours(end.getHours() + 1);
          return prisma.message.count({ where: { line: lineFilter, createdAt: { gte: start, lt: end } } });
        })
      );

      res.json({ totalMessages, activeLines: activeLinesCount, totalLeads, messagesToday, hourlyTraffic, leadsTrend: '+5%', performance: '99%' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Lines
  router.get('/lines', authMiddleware, async (req, res) => {
    try {
      const dbLines = await prisma.whatsAppLine.findMany({ where: { ...orgScope(req) } });
      const lines = await Promise.all(dbLines.map(async (line) => ({
        id: line.id,
        name: line.name, // Use actual name
        phone: line.id, // Actually the phone is usually the ID in this setup or we get it from baileys
        status: await whatsApp.getLineStatus(line.id),
        qrCode: await whatsApp.getQrCode(line.id),
      })));
      res.json({ lines });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/lines/:lineId/connect', authMiddleware, requireLineOwnership, checkPlanLimit('lines'), async (req, res) => {
    try {
      const { lineId } = req.params;
      console.log(`[Router] Connection request for line: ${lineId}`);
      
      // Ensure line exists in DB
      await prisma.whatsAppLine.upsert({
        where: { id: lineId },
        update: {},
        create: {
          id: lineId,
          name: lineId,
          systemPrompt: 'Eres un asistente útil.',
          businessContext: {},
          assignedAiProvider: 'gemini',
          orgId: (req as any).user.orgId,
        }
      });

      const qrCode = await whatsApp.connectLine(lineId);
      console.log(`[Router] QR for ${lineId}: ${qrCode ? 'Generated' : 'Pending'}`);
      res.json({ status: 'connecting', qrCode });
    } catch (err: any) {
      console.error(`[Router] Error connecting ${req.params.lineId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // AI Configuration Endpoints
  router.get('/lines/:lineId/config', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const { lineId } = req.params;
      const line = await prisma.whatsAppLine.findUnique({
        where: { id: lineId }
      });

      if (!line) {
        return res.status(404).json({ error: 'Line not found' });
      }

      res.json({
        systemPrompt: line.systemPrompt,
        businessContext: line.businessContext,
        assignedAiProvider: line.assignedAiProvider,
        hasApiKey: !!line.aiApiKey,
        aiModel: line.aiModel
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/lines/:lineId/config', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const { lineId } = req.params;
      const { systemPrompt, businessContext, assignedAiProvider, aiApiKey, aiModel } = req.body;
      const existingLine = await prisma.whatsAppLine.findUnique({ where: { id: lineId } });
      if (existingLine && existingLine.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });

      const baseUpdate: Record<string, unknown> = { systemPrompt, businessContext, assignedAiProvider, aiModel };
      if (aiApiKey !== undefined && aiApiKey !== '') baseUpdate.aiApiKey = aiApiKey;

      const updated = await prisma.whatsAppLine.upsert({
        where: { id: lineId },
        create: {
          id: lineId,
          name: lineId,
          systemPrompt,
          businessContext,
          assignedAiProvider,
          ...(aiApiKey ? { aiApiKey } : {}),
          aiModel,
          orgId: (req as any).user.orgId,
        },
        update: baseUpdate
      });

      res.json({
        systemPrompt: updated.systemPrompt,
        businessContext: updated.businessContext,
        assignedAiProvider: updated.assignedAiProvider,
        hasApiKey: !!updated.aiApiKey,
        aiModel: updated.aiModel
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/lines/:lineId/context', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const { lineId } = req.params;
      const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } });
      if (!line) return res.status(404).json({ error: 'Line not found' });
      res.json({ businessContext: line.businessContext, systemPrompt: line.systemPrompt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/lines/:lineId/context', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const { lineId } = req.params;
      const { businessContext, systemPrompt } = req.body;
      const existingLine = await prisma.whatsAppLine.findUnique({ where: { id: lineId } });
      if (existingLine && existingLine.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      const updated = await prisma.whatsAppLine.upsert({
        where: { id: lineId },
        create: { id: lineId, name: lineId, businessContext, systemPrompt, assignedAiProvider: 'gemini', orgId: (req as any).user.orgId },
        update: { businessContext, systemPrompt },
      });
      res.json({ businessContext: updated.businessContext, systemPrompt: updated.systemPrompt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/lines/:lineId/disconnect', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      await whatsApp.disconnectLine(req.params.lineId);
      res.json({ status: 'disconnected' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/lines/:lineId', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const { lineId } = req.params;
      const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } });
      if (!line || line.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      await whatsApp.disconnectLine(lineId);
      await prisma.whatsAppLine.delete({ where: { id: lineId } });
      res.json({ status: 'deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/lines/:lineId/status', authMiddleware, requireLineOwnership, async (req, res) => {
    const status = await whatsApp.getLineStatus(req.params.lineId);
    const qrCode = await whatsApp.getQrCode(req.params.lineId);
    res.json({ status, qrCode });
  });

  // Audit Logs
  router.get('/audit-logs', authMiddleware, async (req, res) => {
    try {
      const users = await prisma.user.findMany({ where: { ...orgScope(req) }, select: { id: true } });
      const userIds = users.map(u => u.id);
      const logs = await prisma.auditLog.findMany({
        where: { userId: { in: userIds } },
        take: 50,
        orderBy: { createdAt: 'desc' }
      });
      res.json({ logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Messages
  router.post('/messages/send', authMiddleware, async (req, res) => {
    const { lineId, to, content, type, mediaPath } = req.body;
    try {
      await sendMessage.execute({ lineId, to, content, type, mediaPath });
      res.json({ status: 'queued' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/chats', authMiddleware, async (req, res) => {
    try {
      const statusFilter = (req.query.status as string) || 'OPEN';
      const where = statusFilter === 'ALL'
        ? { ...orgScope(req) }
        : { conversationStatus: statusFilter, ...orgScope(req) };
      const clients = await prisma.client.findMany({
        where,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              messages: {
                where: { direction: 'INBOUND', isRead: false }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      const chats = clients.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        lastMsg: c.messages[0]?.content || '',
        time: c.messages[0]?.createdAt || c.updatedAt,
        status: 'ACTIVE',
        assignedTo: c.assignedTo,
        aiPausedUntil: c.aiPausedUntil,
        unreadCount: (c as any)._count.messages,
        lineId: c.messages[0]?.lineId,
        conversationStatus: (c as any).conversationStatus ?? 'OPEN',
        closedAt: (c as any).closedAt ?? null,
      }));

      res.json({ chats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/contacts', authMiddleware, async (req, res) => {
    try {
      const search = (req.query.search as string) ?? '';
      const where: Record<string, unknown> = { ...orgScope(req) };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ];
      }
      const contacts = await prisma.client.findMany({
        where,
        select: {
          id: true, phone: true, name: true,
          conversationStatus: true, createdAt: true, updatedAt: true,
          isBlocked: true, orgId: true,
          assignedTo: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, createdAt: true, lineId: true, direction: true } },
          _count: { select: { messages: { where: { direction: 'INBOUND', isRead: false } } } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      });
      res.json({
        contacts: contacts.map(c => ({
          id: c.id, phone: c.phone, name: c.name,
          conversationStatus: c.conversationStatus,
          createdAt: c.createdAt, updatedAt: c.updatedAt,
          isBlocked: c.isBlocked,
          assignedTo: c.assignedTo,
          lastMsg: c.messages[0]?.content ?? '',
          lastMsgAt: c.messages[0]?.createdAt ?? c.updatedAt,
          lastMsgDirection: c.messages[0]?.direction ?? null,
          lineId: c.messages[0]?.lineId ?? null,
          unreadCount: (c as any)._count.messages,
        })),
        total: contacts.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/messages/unread-count', authMiddleware, async (req, res) => {
    try {
      const orgId = (req as any).user.orgId as string;
      const count = await prisma.message.count({
        where: { direction: 'INBOUND', isRead: false, line: { orgId } }
      });
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/messages/:phone', authMiddleware, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 30, 100);
      const cl = await prisma.client.findUnique({ where: { phone: req.params.phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
      const beforeId = req.query.before as string | undefined;
      const messages = await messageRepo.findByClientPhone(req.params.phone, limit, beforeId);
      const hasMore = messages.length === limit;
      res.json({ messages, hasMore });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/messages/:phone/read', authMiddleware, async (req, res) => {
    try {
      await messageRepo.markAsRead(req.params.phone);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clients
  router.post('/clients/:phone/pause', authMiddleware, async (req, res) => {
    try {
      const { phone } = req.params;
      const { hours } = req.body;
      const cl = await prisma.client.findUnique({ where: { phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });

      const pausedUntil = new Date(Date.now() + (hours * 60 * 60 * 1000));
      await prisma.client.update({ where: { phone }, data: { aiPausedUntil: pausedUntil } });
      res.json({ status: 'paused', pausedUntil });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/clients/:phone/unpause', authMiddleware, async (req, res) => {
    try {
      const { phone } = req.params;
      const cl = await prisma.client.findUnique({ where: { phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });

      await prisma.client.update({ where: { phone }, data: { aiPausedUntil: null } });
      res.json({ status: 'active' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/clients/:phone/assign', authMiddleware, async (req, res) => {
    try {
      const { phone } = req.params;
      const { agentId } = req.body; // Can be null to unassign
      const cl = await prisma.client.findUnique({ where: { phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });

      const updated = await prisma.client.update({
        where: { phone },
        data: {
          assignedToUserId: agentId,
          aiPausedUntil: agentId ? new Date('2099-12-31T23:59:59Z') : null,
        },
      });

      wsManager.broadcast('conversation:assigned', { phone, assignedToUserId: agentId });
      res.json({ status: 'assigned', client: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/clients/:phone', authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido.' });
    try {
      const existing = await prisma.client.findUnique({ where: { phone: req.params.phone } });
      if (!existing || existing.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      const client = await prisma.client.update({
        where: { phone: req.params.phone },
        data: { name: name.trim() },
      });
      res.json({ client });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/clients/:phone/close', authMiddleware, async (req, res) => {
    try {
      const { phone } = req.params;
      const userId = (req as any).user.userId;
      const cl = await prisma.client.findUnique({ where: { phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      await prisma.client.update({
        where: { phone },
        data: {
          conversationStatus: 'CLOSED',
          closedAt: new Date(),
          closedByUserId: userId,
          assignedToUserId: null,
          aiPausedUntil: null,
        },
      });
      wsManager.broadcast('conversation:status', { phone, status: 'CLOSED' });
      res.json({ status: 'closed' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/clients/:phone/reopen', authMiddleware, async (req, res) => {
    try {
      const { phone } = req.params;
      const cl = await prisma.client.findUnique({ where: { phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      await prisma.client.update({
        where: { phone },
        data: {
          conversationStatus: 'OPEN',
          closedAt: null,
          closedByUserId: null,
        },
      });
      wsManager.broadcast('conversation:status', { phone, status: 'OPEN' });
      res.json({ status: 'reopened' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/clients/:phone/notes', authMiddleware, async (req, res) => {
    try {
      const cl = await prisma.client.findUnique({ where: { phone: req.params.phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      const notes = await prisma.internalNote.findMany({
        where: { clientPhone: req.params.phone },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ notes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/clients/:phone/notes', authMiddleware, async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Contenido requerido.' });
    try {
      const cl = await prisma.client.findUnique({ where: { phone: req.params.phone } });
      if (!cl || cl.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      const note = await prisma.internalNote.create({
        data: {
          clientPhone: req.params.phone,
          authorId: (req as any).user.userId,
          content: content.trim(),
        },
        include: { author: { select: { id: true, name: true } } },
      });
      wsManager.broadcast('note:new', { clientPhone: req.params.phone, note });
      res.status(201).json({ note });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/clients/:phone/notes/:noteId', authMiddleware, async (req, res) => {
    try {
      const note = await prisma.internalNote.findUnique({ where: { id: req.params.noteId } });
      if (!note) return res.status(404).json({ error: 'Nota no encontrada.' });
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (note.authorId !== userId && user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Sin permisos para eliminar esta nota.' });
      }
      await prisma.internalNote.delete({ where: { id: req.params.noteId } });
      res.json({ status: 'deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/agents', authMiddleware, async (req, res) => {
    try {
      const agents = await prisma.user.findMany({
        where: { isActive: true, ...orgScope(req) },
        select: { id: true, name: true, role: true }
      });
      res.json({ agents });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── External APIs ────────────────────────────────
  router.get('/lines/:lineId/external-apis', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const apis = await prisma.externalApi.findMany({
        where: { lineId: req.params.lineId },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ apis });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/lines/:lineId/external-apis', authMiddleware, requireLineOwnership, async (req, res) => {
    const { name, baseUrl, method, headers, body, outputKey, username, password } = req.body;
    if (!name || !baseUrl) return res.status(400).json({ error: 'name y baseUrl son requeridos.' });
    try {
      const api = await prisma.externalApi.create({
        data: {
          lineId: req.params.lineId,
          name,
          baseUrl,
          method: method || 'GET',
          headers: headers || {},
          body: body || null,
          outputKey: outputKey || null,
          username: username || null,
          password: password || null,
        },
      });
      res.status(201).json({ api });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/lines/:lineId/external-apis/:apiId', authMiddleware, requireLineOwnership, async (req, res) => {
    const { name, baseUrl, method, headers, body, outputKey, username, password, isActive } = req.body;
    try {
      const api = await prisma.externalApi.update({
        where: { id: req.params.apiId },
        data: {
          ...(name !== undefined && { name }),
          ...(baseUrl !== undefined && { baseUrl }),
          ...(method !== undefined && { method }),
          ...(headers !== undefined && { headers }),
          ...(body !== undefined && { body }),
          ...(outputKey !== undefined && { outputKey }),
          ...(username !== undefined && { username }),
          ...(password !== undefined && { password }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json({ api });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/lines/:lineId/external-apis/:apiId', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      await prisma.externalApi.delete({ where: { id: req.params.apiId } });
      res.json({ status: 'deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/lines/:lineId/external-apis/:apiId/test', authMiddleware, requireLineOwnership, async (req, res) => {
    const { baseUrl, method, headers: reqHeaders, body, outputKey, username, password } = req.body;
    if (!baseUrl) return res.status(400).json({ error: 'baseUrl es requerido.' });
    try {
      const headers: Record<string, string> = { ...(reqHeaders || {}) };
      if (username && password) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      }
      const bodyStr = body && body.trim() ? body : undefined;
      const fetchOpts: RequestInit = {
        method: method || 'GET',
        headers,
        ...(bodyStr ? { body: bodyStr } : {}),
      };
      const resp = await fetch(baseUrl, fetchOpts);
      const text = await resp.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = text; }

      let extracted: any = parsed;
      if (outputKey && typeof parsed === 'object') {
        for (const key of outputKey.split('.')) {
          extracted = extracted?.[key];
          if (extracted === undefined) break;
        }
      }
      res.json({
        status: resp.status,
        ok: resp.ok,
        raw: parsed,
        extracted: outputKey ? extracted : undefined,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Ventas Autónomas ─────────────────────────────

  // GET /lines/:lineId/sales-config
  router.get('/lines/:lineId/sales-config', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const { lineId } = req.params;
      const line = await prisma.whatsAppLine.findUnique({
        where: { id: lineId },
        select: {
          autonomousSalesEnabled: true,
          pagoParConfig: {
            select: { id: true, publicKey: true, sandboxMode: true, callbackUrl: true },
          },
          facturadorConfig: {
            select: {
              id: true, baseUrl: true, accessKey: true, apiKey: true,
              bodyTemplate: true, successExample: true, isActive: true,
            },
          },
        },
      });

      if (!line) return res.status(404).json({ error: 'Línea no encontrada.' });

      res.json({
        autonomousSalesEnabled: line.autonomousSalesEnabled,
        pagoParConfig: line.pagoParConfig
          ? {
              id: line.pagoParConfig.id,
              publicKey: line.pagoParConfig.publicKey,
              hasPrivateKey: true, // never expose privateKey
              sandboxMode: line.pagoParConfig.sandboxMode,
              callbackUrl: line.pagoParConfig.callbackUrl,
            }
          : null,
        facturadorConfig: line.facturadorConfig
          ? {
              id: line.facturadorConfig.id,
              baseUrl: line.facturadorConfig.baseUrl,
              accessKey: line.facturadorConfig.accessKey,
              hasSecretKey: true, // never expose secretKey
              apiKey: line.facturadorConfig.apiKey,
              bodyTemplate: line.facturadorConfig.bodyTemplate,
              successExample: line.facturadorConfig.successExample,
              isActive: line.facturadorConfig.isActive,
            }
          : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /lines/:lineId/sales-config — updates toggle + PagoPar config + Facturador config
  router.put('/lines/:lineId/sales-config', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const { lineId } = req.params;
      const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } });
      if (!line || line.orgId !== (req as any).user.orgId) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }

      const { autonomousSalesEnabled, pagoParConfig, facturadorConfig } = req.body;

      // Update toggle
      if (autonomousSalesEnabled !== undefined) {
        await prisma.whatsAppLine.update({
          where: { id: lineId },
          data: { autonomousSalesEnabled },
        });
      }

      // Upsert PagoPar config — only update privateKey if provided and non-empty
      if (pagoParConfig) {
        const { publicKey, privateKey, sandboxMode, callbackUrl } = pagoParConfig;
        const existing = await prisma.pagoParConfig.findUnique({ where: { lineId } });

        const data: Record<string, unknown> = {};
        if (publicKey !== undefined) data.publicKey = publicKey;
        if (sandboxMode !== undefined) data.sandboxMode = sandboxMode;
        if (callbackUrl !== undefined) data.callbackUrl = callbackUrl;
        if (privateKey !== undefined && privateKey !== '') data.privateKey = privateKey;

        if (existing) {
          await prisma.pagoParConfig.update({ where: { lineId }, data });
        } else if (publicKey && privateKey) {
          await prisma.pagoParConfig.create({
            data: { lineId, publicKey, privateKey, sandboxMode: sandboxMode ?? true, callbackUrl: callbackUrl ?? null },
          });
        }
      }

      // Upsert Facturador config — only update secretKey if provided and non-empty
      if (facturadorConfig) {
        const { baseUrl, accessKey, secretKey, apiKey, bodyTemplate, successExample, isActive } = facturadorConfig;
        const existing = await prisma.facturadorConfig.findUnique({ where: { lineId } });

        const data: Record<string, unknown> = {};
        if (baseUrl !== undefined) data.baseUrl = baseUrl;
        if (accessKey !== undefined) data.accessKey = accessKey;
        if (apiKey !== undefined) data.apiKey = apiKey;
        if (bodyTemplate !== undefined) data.bodyTemplate = bodyTemplate;
        if (successExample !== undefined) data.successExample = successExample;
        if (isActive !== undefined) data.isActive = isActive;
        if (secretKey !== undefined && secretKey !== '') data.secretKey = secretKey;

        if (existing) {
          await prisma.facturadorConfig.update({ where: { lineId }, data });
        } else if (baseUrl && accessKey && secretKey && bodyTemplate) {
          await prisma.facturadorConfig.create({
            data: {
              lineId,
              baseUrl,
              accessKey,
              secretKey,
              apiKey: apiKey ?? null,
              bodyTemplate,
              successExample: successExample ?? null,
              isActive: isActive ?? true,
            },
          });
        }
      }

      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /lines/:lineId/sales — sale records for a line
  router.get('/lines/:lineId/sales', authMiddleware, requireLineOwnership, async (req, res) => {
    try {
      const sales = await prisma.saleRecord.findMany({
        where: { lineId: req.params.lineId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ sales });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /webhook/pagopar/:lineId — PagoPar payment notification (no auth: called by PagoPar)
  router.post('/webhook/pagopar/:lineId', async (req, res) => {
    try {
      const { lineId } = req.params;
      const payload = req.body;

      // Validate token
      const config = await prisma.pagoParConfig.findUnique({ where: { lineId } });
      if (!config) return res.status(404).json({ error: 'Config not found' });

      const { PagoParAdapter } = await import('../adapters/payments/PagoParAdapter.js');
      const pagopar = new PagoParAdapter(config.publicKey, config.privateKey, config.sandboxMode);

      const result = payload?.resultado?.[0];
      const hashPedido = result?.hash_pedido;
      const receivedToken = result?.token;
      const pagado = result?.pagado;

      // Reject invalid or unverified notifications
      if (!hashPedido || !receivedToken || !pagopar.validateWebhookToken(hashPedido, receivedToken)) {
        return res.status(400).json({ error: 'Token inválido' });
      }

      if (pagado && salesService) {
        const confirmed = await salesService.handlePaymentConfirmation(lineId, hashPedido);

        if (confirmed) {
          // Notify operators via WebSocket
          wsManager.broadcast('sale:paid', { lineId, hashPedido, ...confirmed });

          // Send WhatsApp confirmation to the client
          const { clientPhone, amount, productName, invoiceId } = confirmed;
          const amountFormatted = amount.toLocaleString('es-PY');
          let confirmMsg =
            `✅ *¡Pago confirmado!*\n\n` +
            `Producto: ${productName}\n` +
            `Monto: Gs. ${amountFormatted}\n`;
          if (invoiceId) confirmMsg += `Factura: ${invoiceId}\n`;
          confirmMsg += `\n¡Gracias por tu compra! 🎉`;

          try {
            await whatsApp.sendTextMessage(lineId, clientPhone, confirmMsg);
          } catch (err: any) {
            console.error('[Webhook PagoPar] Error sending WA confirmation:', err.message);
          }
        }
      }

      // PagoPar expects the payload echoed back with HTTP 200
      res.json(payload);
    } catch (err: any) {
      console.error('[Webhook PagoPar]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Calendario ───────────────────────────────────────

  // GET /lines/:lineId/calendar-config
  router.get('/lines/:lineId/calendar-config', authMiddleware, requireLineOwnership, (req, res) => {
    res.json({ isConnected: false });
  });

  // GET /lines/:lineId/appointments?from=ISO&to=ISO
  router.get('/lines/:lineId/appointments', authMiddleware, requireLineOwnership, async (req, res) => {
    if (!calendarService) return res.json({ appointments: [] });
    try {
      const from = req.query.from ? new Date(String(req.query.from)) : new Date();
      const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const appointments = await calendarService.getAppointments(req.params.lineId, from, to);
      res.json({ appointments });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /lines/:lineId/appointments/:id — cancel appointment
  router.delete('/lines/:lineId/appointments/:appointmentId', authMiddleware, requireLineOwnership, async (req, res) => {
    if (!calendarService) return res.status(503).json({ error: 'Servicio de calendario no configurado.' });
    try {
      await calendarService.cancelAppointment(req.params.lineId, req.params.appointmentId);
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- User Management (Admin only) ---

  router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { ...orgScope(req) },
        select: {
          id: true, name: true, email: true, username: true, role: true, isActive: true,
          lineId: true, line: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ users });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', authMiddleware, requireAdmin, checkPlanLimit('users'), async (req, res) => {
    const { name, username, password, role, lineId } = req.body;
    if (!name?.trim() || !username?.trim() || !password || !role) {
      return res.status(400).json({ error: 'name, username, password y role son requeridos.' });
    }
    if (!['ADMIN', 'OPERATOR'].includes(role)) {
      return res.status(400).json({ error: 'role debe ser ADMIN u OPERATOR.' });
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      return res.status(400).json({ error: 'username solo puede contener letras, números, puntos, guiones y guiones bajos.' });
    }
    try {
      const existing = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
      if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario.' });

      const passwordHash = await authService.hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          username: username.trim().toLowerCase(),
          passwordHash,
          role,
          orgId: (req as any).user.orgId,
          lineId: lineId || null,
        },
        select: {
          id: true, name: true, username: true, role: true, isActive: true,
          lineId: true, line: { select: { id: true, name: true } },
        },
      });
      res.status(201).json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const requesterId = (req as any).user.userId;
    const { name, role, isActive, lineId } = req.body;

    if (id === requesterId) {
      if (role !== undefined) return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
      if (isActive === false) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo.' });
    }

    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
      if (target.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name.trim();
      if (role !== undefined) data.role = role;
      if (isActive !== undefined) data.isActive = isActive;
      if (lineId !== undefined) data.lineId = lineId || null;

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true, name: true, email: true, username: true, role: true, isActive: true,
          lineId: true, line: { select: { id: true, name: true } },
        },
      });
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /users/:id/deactivate — soft delete (keep record, block login)
  router.patch('/users/:id/deactivate', authMiddleware, requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (id === (req as any).user.userId) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo.' });
    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
      if (target.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });
      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, name: true, username: true, role: true, isActive: true, lineId: true, line: { select: { id: true, name: true } } },
      });
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /users/:id — hard delete (removes from DB)
  router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (id === (req as any).user.userId) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
      if (target.orgId !== (req as any).user.orgId) return res.status(403).json({ error: 'Acceso denegado.' });

      await prisma.$transaction([
        prisma.internalNote.deleteMany({ where: { authorId: id } }),
        prisma.client.updateMany({ where: { assignedToUserId: id }, data: { assignedToUserId: null } }),
        prisma.client.updateMany({ where: { closedByUserId: id }, data: { closedByUserId: null } }),
        prisma.user.delete({ where: { id } }),
      ]);
      res.json({ status: 'deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Plan info (attached to auth/me via helper) ──────────────────────────────
  router.get('/org/plan', authMiddleware, async (req, res) => {
    const orgId = (req as any).user?.orgId as string | undefined;
    if (!orgId) return res.json({ plan: null });
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: { plan: true },
      });
      const lineCount = await prisma.whatsAppLine.count({ where: { orgId } });
      const userCount = await prisma.user.count({ where: { orgId } });
      res.json({
        org: {
          id: org?.id,
          name: org?.name,
          isActive: org?.isActive,
          trialEndsAt: org?.trialEndsAt,
          conversationsThisMonth: org?.conversationsThisMonth,
        },
        plan: org?.plan ?? null,
        usage: { lines: lineCount, users: userCount, conversations: org?.conversationsThisMonth ?? 0 },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /org — current org profile
  router.get('/org', authMiddleware, async (req, res) => {
    const orgId = (req as any).user?.orgId as string | undefined;
    if (!orgId) return res.status(403).json({ error: 'Sin organización.' });
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: { plan: true },
      });
      if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
      res.json({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description ?? '',
        isActive: org.isActive,
        trialEndsAt: org.trialEndsAt,
        plan: org.plan ? { name: org.plan.name, slug: org.plan.slug } : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /org — update org name and description (admin only)
  router.put('/org', authMiddleware, async (req, res) => {
    const orgId = (req as any).user?.orgId as string | undefined;
    const role = (req as any).user?.role as string | undefined;
    if (!orgId) return res.status(403).json({ error: 'Sin organización.' });
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') return res.status(403).json({ error: 'Solo administradores pueden editar la organización.' });
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
    try {
      const org = await prisma.organization.update({
        where: { id: orgId },
        data: { name: name.trim(), description: description?.trim() ?? null },
      });
      res.json({ id: org.id, name: org.name, slug: org.slug, description: org.description ?? '' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Super-Admin endpoints ────────────────────────────────────────────────────

  // GET /admin/orgs — all orgs with plan + usage
  router.get('/admin/orgs', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const orgs = await prisma.organization.findMany({
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      const result = await Promise.all(orgs.map(async (org) => {
        const [lineCount, userCount] = await Promise.all([
          prisma.whatsAppLine.count({ where: { orgId: org.id } }),
          prisma.user.count({ where: { orgId: org.id } }),
        ]);
        const owner = await prisma.user.findFirst({
          where: { orgId: org.id, role: 'ADMIN' },
          select: { email: true, name: true },
          orderBy: { createdAt: 'asc' },
        });
        const trialExpired = org.trialEndsAt ? org.trialEndsAt < new Date() : false;
        return { ...org, lineCount, userCount, owner, trialExpired };
      }));
      res.json({ orgs: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /admin/orgs/:id — update plan, isActive
  router.patch('/admin/orgs/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { planId, isActive, trialEndsAt } = req.body as { planId?: string; isActive?: boolean; trialEndsAt?: string };
    try {
      const data: Record<string, any> = {};
      if (planId !== undefined) { data.planId = planId; data.planStartedAt = new Date(); data.trialEndsAt = null; }
      if (isActive !== undefined) data.isActive = isActive;
      if (trialEndsAt !== undefined) data.trialEndsAt = new Date(trialEndsAt);
      const org = await prisma.organization.update({ where: { id }, data, include: { plan: true } });

      // Notify org owner when a plan is assigned
      if (planId) {
        try {
          const [owner, plan] = await Promise.all([
            prisma.user.findFirst({ where: { orgId: id, role: 'ADMIN' }, select: { email: true, name: true }, orderBy: { createdAt: 'asc' } }),
            prisma.plan.findUnique({ where: { id: planId }, select: { name: true } }),
          ]);
          if (owner && plan) {
            emailService.sendPlanAssigned(owner.email ?? '', owner.name, plan.name).catch(() => {});
          }
        } catch (_) {}
      }

      res.json({ org });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/plans — all plans
  router.get('/admin/plans', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
      res.json({ plans });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /admin/plans — create plan
  router.post('/admin/plans', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { name, slug, price, maxLines, maxUsers, maxConversationsPerMonth, trialDays, aiEnabled } = req.body;
    try {
      const plan = await prisma.plan.create({
        data: { name, slug, price: Number(price), maxLines: Number(maxLines), maxUsers: Number(maxUsers), maxConversationsPerMonth: Number(maxConversationsPerMonth), trialDays: Number(trialDays ?? 0), aiEnabled: Boolean(aiEnabled ?? true) },
      });
      res.status(201).json({ plan });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /admin/plans/:id — update plan
  router.put('/admin/plans/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, price, maxLines, maxUsers, maxConversationsPerMonth, trialDays, aiEnabled, isActive } = req.body;
    try {
      const data: Record<string, any> = {};
      if (name !== undefined) data.name = name;
      if (price !== undefined) data.price = Number(price);
      if (maxLines !== undefined) data.maxLines = Number(maxLines);
      if (maxUsers !== undefined) data.maxUsers = Number(maxUsers);
      if (maxConversationsPerMonth !== undefined) data.maxConversationsPerMonth = Number(maxConversationsPerMonth);
      if (trialDays !== undefined) data.trialDays = Number(trialDays);
      if (aiEnabled !== undefined) data.aiEnabled = Boolean(aiEnabled);
      if (isActive !== undefined) data.isActive = Boolean(isActive);
      const plan = await prisma.plan.update({ where: { id }, data });
      res.json({ plan });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/superadmins — list all SUPERADMIN users
  router.get('/admin/superadmins', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'SUPERADMIN' },
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ admins });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /admin/superadmins — promote an existing user to SUPERADMIN
  router.post('/admin/superadmins', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email requerido' });
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado. Debe registrarse primero.' });
      if (user.role === 'SUPERADMIN') return res.status(400).json({ error: 'El usuario ya es super admin.' });
      const updated = await prisma.user.update({
        where: { email },
        data: { role: 'SUPERADMIN' },
        select: { id: true, name: true, email: true, createdAt: true },
      });
      res.json({ admin: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /admin/superadmins/:id — revoke SUPERADMIN role (back to ADMIN)
  router.delete('/admin/superadmins/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
    const requestingUserId = (req as any).user?.userId;
    if (req.params.id === requestingUserId) {
      return res.status(400).json({ error: 'No podés revocar tu propio rol de super admin.' });
    }
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      if (user.role !== 'SUPERADMIN') return res.status(400).json({ error: 'El usuario no es super admin.' });
      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { role: 'ADMIN' },
        select: { id: true, name: true, email: true, createdAt: true },
      });
      res.json({ admin: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /org/plan/request-upgrade — org requests a plan upgrade (notifies admin)
  router.post('/org/plan/request-upgrade', authMiddleware, async (req, res) => {
    const { desiredPlan, notes } = req.body;
    if (!desiredPlan) return res.status(400).json({ error: 'desiredPlan requerido' });

    const userId = (req as any).user.userId;
    const orgId = (req as any).user.orgId;

    try {
      const [org, user] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
      ]);

      if (!org || !user) return res.status(404).json({ error: 'Org o usuario no encontrado' });

      const adminEmail = process.env.ADMIN_EMAIL || 'andyvercha@gmail.com';
      const waMsg = `📋 *Solicitud de upgrade*\n\n🏢 *Org:* ${org.name}\n📧 *Email:* ${user.email}\n📦 *Plan solicitado:* ${desiredPlan}\n📝 *Notas:* ${notes || '—'}`;

      notifyAdmin(waMsg).catch(() => {});
      emailService.sendAdminPlanRequest(adminEmail, org.name, user.email ?? '', desiredPlan, notes || '').catch(() => {});

      res.json({ ok: true, message: 'Solicitud enviada. Te contactaremos pronto.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/config — list system config (passwords masked)
  router.get('/admin/config', authMiddleware, requireSuperAdmin, async (_req, res) => {
    try {
      const configs = await prisma.systemConfig.findMany();
      const safe = configs.map(c => ({
        key: c.key,
        value: c.key.includes('pass') || c.key.includes('password') ? '••••••••' : c.value,
      }));
      res.json({ config: safe });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /admin/config — upsert system config entries
  router.put('/admin/config', authMiddleware, requireSuperAdmin, async (req, res) => {
    const updates: Array<{ key: string; value: string }> = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array of {key, value}' });

    try {
      await Promise.all(
        updates.map(({ key, value }) =>
          prisma.systemConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        )
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /admin/config/test-email — send a test email using current SMTP config
  router.post('/admin/config/test-email', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { to } = req.body as { to?: string };
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Email de destino inválido.' });
    }
    try {
      await emailService.sendMail({
        to,
        subject: 'Boti — Email de prueba',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c30">
            <h2 style="color:#006b5f">Configuración SMTP funcionando</h2>
            <p>Este es un email de prueba enviado desde el panel de administración de <strong>Boti</strong>.</p>
            <p>Si estás viendo esto, la configuración SMTP está correcta.</p>
            <hr style="border:none;border-top:1px solid #e5eeff;margin:24px 0"/>
            <p style="font-size:12px;color:#71787c">Enviado: ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}</p>
          </div>`,
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/stats — global SaaS stats
  router.get('/admin/stats', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const [totalOrgs, activeOrgs, totalUsers, totalLines] = await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { isActive: true } }),
        prisma.user.count(),
        prisma.whatsAppLine.count(),
      ]);
      const trialOrgs = await prisma.organization.count({
        where: { plan: { slug: 'trial' }, isActive: true },
      });
      const plans = await prisma.plan.findMany({ include: { _count: { select: { organizations: true } } } });
      res.json({ totalOrgs, activeOrgs, trialOrgs, totalUsers, totalLines, plans });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
