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

const messageRepo = new PrismaMessageRepository();
const clientRepo = new PrismaClientRepository();

export function createRouter(
  whatsApp: IWhatsAppProvider,
  sendMessage: SendMessage,
  blockClient: BlockClient,
  prisma: PrismaClient,
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
        aiApiKey: line.aiApiKey,
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

      const updated = await prisma.whatsAppLine.upsert({
        where: { id: lineId },
        create: {
          id: lineId,
          name: lineId,
          systemPrompt,
          businessContext,
          assignedAiProvider,
          aiApiKey,
          aiModel
        },
        update: {
          systemPrompt,
          businessContext,
          assignedAiProvider,
          aiApiKey,
          aiModel
        }
      });

      res.json(updated);
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

  router.get('/chats', authMiddleware, async (_req, res) => {
    try {
      const clients = await prisma.client.findMany({
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
        lineId: c.messages[0]?.lineId
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
        data: { assignedToUserId: agentId }
      });

      res.json({ status: 'assigned', client: updated });
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

  return router;
}
