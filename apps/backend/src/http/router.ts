// Express Router — REST API routes

import { Router, type Request, type Response } from 'express';
import type {
  IWhatsAppProvider,
  SendMessage,
  BlockClient,
} from '@boti/core';
import { PrismaClient } from '@prisma/client';
import { PrismaMessageRepository, PrismaClientRepository } from '../adapters/db/PrismaRepositories.js';
import { AuthService } from '../lib/AuthService.js';
import type { WebSocketManager } from '../lib/WebSocketManager.js';

const messageRepo = new PrismaMessageRepository();
const clientRepo = new PrismaClientRepository();

export function createRouter(
  whatsApp: IWhatsAppProvider,
  sendMessage: SendMessage,
  blockClient: BlockClient,
  prisma: PrismaClient,
  wsManager: WebSocketManager,
): Router {
  const router = Router();
  const authService = new AuthService(prisma);

  // --- Auth Middleware ---
  const authMiddleware = (req: Request, res: Response, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });

    (req as any).user = decoded;
    next();
  };

  // --- Admin Middleware ---
  const requireAdmin = (req: Request, res: Response, next: () => void) => {
    if ((req as any).user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Se requiere rol ADMIN.' });
    }
    next();
  };

  // --- Auth Endpoints ---
  router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

      const isValid = await authService.comparePassword(password, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = authService.generateToken({ userId: user.id, email: user.email, role: user.role });
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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
      const valid = await authService.comparePassword(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta.' });
      const hashed = await authService.hashPassword(newPassword);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Stats
  router.get('/stats', authMiddleware, async (_req, res) => {
    try {
      const totalMessages = await prisma.message.count();
      const allLines = await prisma.whatsAppLine.findMany({ select: { id: true } });
      const lineStatuses = await Promise.all(allLines.map(l => whatsApp.getLineStatus(l.id)));
      const activeLinesCount = lineStatuses.filter(s => s === 'CONNECTED').length;
      const totalLeads = await prisma.client.count();
      const messagesToday = await prisma.message.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      const hourlyTraffic = await Promise.all(
        Array.from({ length: 15 }).map(async (_, i) => {
          const start = new Date();
          start.setHours(start.getHours() - (14 - i), 0, 0, 0);
          const end = new Date(start);
          end.setHours(end.getHours() + 1);
          
          return prisma.message.count({
            where: {
              createdAt: { gte: start, lt: end }
            }
          });
        })
      );

      res.json({
        totalMessages,
        activeLines: activeLinesCount,
        totalLeads,
        messagesToday,
        hourlyTraffic,
        leadsTrend: '+5%',
        performance: '99%'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Lines
  router.get('/lines', authMiddleware, async (_req, res) => {
    try {
      const dbLines = await prisma.whatsAppLine.findMany();
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

  router.post('/lines/:lineId/connect', authMiddleware, async (req, res) => {
    try {
      const { lineId } = req.params;
      console.log(`[Router] Connection request for line: ${lineId}`);
      
      // Ensure line exists in DB
      await prisma.whatsAppLine.upsert({
        where: { id: lineId },
        update: {},
        create: { 
          id: lineId,
          name: lineId, // Added missing required field
          systemPrompt: 'Eres un asistente útil.',
          businessContext: {},
          assignedAiProvider: 'gemini'
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
  router.get('/lines/:lineId/config', authMiddleware, async (req, res) => {
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

  router.put('/lines/:lineId/config', authMiddleware, async (req, res) => {
    try {
      const { lineId } = req.params;
      const { systemPrompt, businessContext, assignedAiProvider, aiApiKey, aiModel } = req.body;

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
          aiModel
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

  router.get('/lines/:lineId/context', authMiddleware, async (req, res) => {
    try {
      const { lineId } = req.params;
      const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } });
      if (!line) return res.status(404).json({ error: 'Line not found' });
      res.json({ businessContext: line.businessContext, systemPrompt: line.systemPrompt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/lines/:lineId/context', authMiddleware, async (req, res) => {
    try {
      const { lineId } = req.params;
      const { businessContext, systemPrompt } = req.body;
      const updated = await prisma.whatsAppLine.upsert({
        where: { id: lineId },
        create: { id: lineId, name: lineId, businessContext, systemPrompt, assignedAiProvider: 'gemini' },
        update: { businessContext, systemPrompt },
      });
      res.json({ businessContext: updated.businessContext, systemPrompt: updated.systemPrompt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/lines/:lineId/disconnect', authMiddleware, async (req, res) => {
    try {
      await whatsApp.disconnectLine(req.params.lineId);
      res.json({ status: 'disconnected' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/lines/:lineId', authMiddleware, async (req, res) => {
    try {
      const { lineId } = req.params;
      await whatsApp.disconnectLine(lineId);
      await prisma.whatsAppLine.delete({ where: { id: lineId } });
      res.json({ status: 'deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/lines/:lineId/status', authMiddleware, async (req, res) => {
    const status = await whatsApp.getLineStatus(req.params.lineId);
    const qrCode = await whatsApp.getQrCode(req.params.lineId);
    res.json({ status, qrCode });
  });

  // Audit Logs
  router.get('/audit-logs', authMiddleware, async (_req, res) => {
    try {
      const logs = await prisma.auditLog.findMany({
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
      const where = statusFilter === 'ALL' ? {} : { conversationStatus: statusFilter };
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

  router.get('/messages/unread-count', authMiddleware, async (_req, res) => {
    try {
      const count = await prisma.message.count({
        where: { direction: 'INBOUND', isRead: false }
      });
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/messages/:phone', authMiddleware, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 30, 100);
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
      
      const pausedUntil = new Date(Date.now() + (hours * 60 * 60 * 1000));
      
      await prisma.client.update({
        where: { phone },
        data: { aiPausedUntil: pausedUntil }
      });
      
      res.json({ status: 'paused', pausedUntil });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/clients/:phone/assign', authMiddleware, async (req, res) => {
    try {
      const { phone } = req.params;
      const { agentId } = req.body; // Can be null to unassign

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

  router.get('/agents', authMiddleware, async (_req, res) => {
    try {
      const agents = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true }
      });
      res.json({ agents });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── External APIs ────────────────────────────────
  router.get('/lines/:lineId/external-apis', authMiddleware, async (req, res) => {
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

  router.post('/lines/:lineId/external-apis', authMiddleware, async (req, res) => {
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

  router.put('/lines/:lineId/external-apis/:apiId', authMiddleware, async (req, res) => {
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

  router.delete('/lines/:lineId/external-apis/:apiId', authMiddleware, async (req, res) => {
    try {
      await prisma.externalApi.delete({ where: { id: req.params.apiId } });
      res.json({ status: 'deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/lines/:lineId/external-apis/:apiId/test', authMiddleware, async (req, res) => {
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

  // --- User Management (Admin only) ---

  router.get('/users', authMiddleware, requireAdmin, async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ users });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name?.trim() || !email?.trim() || !password || !role) {
      return res.status(400).json({ error: 'name, email, password y role son requeridos.' });
    }
    if (!['ADMIN', 'OPERATOR'].includes(role)) {
      return res.status(400).json({ error: 'role debe ser ADMIN u OPERATOR.' });
    }
    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });

      const passwordHash = await authService.hashPassword(password);
      const user = await prisma.user.create({
        data: { name: name.trim(), email: email.trim(), passwordHash, role },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      res.status(201).json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const requesterId = (req as any).user.userId;
    const { name, role, isActive } = req.body;

    if (id === requesterId) {
      if (role !== undefined) return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
      if (isActive === false) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo.' });
    }

    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name.trim();
      if (role !== undefined) data.role = role;
      if (isActive !== undefined) data.isActive = isActive;

      const user = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const requesterId = (req as any).user.userId;

    if (id === requesterId) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
    }

    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
