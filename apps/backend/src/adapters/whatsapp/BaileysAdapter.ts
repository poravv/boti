// Driven Adapter: Baileys WhatsApp Provider
// Implements IWhatsAppProvider using @whiskeysockets/baileys

import makeWASocket, {
  DisconnectReason,
  type WASocket,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import * as P from 'pino';
import Redis from 'ioredis';
import type { IWhatsAppProvider } from '@boti/core';
import { useRedisAuthState } from './RedisAuthState.js';

const AUTH_DIR = path.join(process.cwd(), '.baileys-auth');
const BAILEYS_VERSION: [number, number, number] = [2, 3000, 1033893291];

const baileysLogger = (P as any).default({ level: 'info' });

interface LineState {
  socket: WASocket;
  qrCode: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_PENDING';
  messageStatusCallbacks: Map<string, (status: 'SUCCESS' | 'FAILED') => void>;
  ephemeralByJid: Map<string, number>;
  clearAuth?: () => Promise<void>;
  intentionalClose?: boolean; // set before socket.end() to suppress auto-reconnect
}

export class BaileysWhatsAppAdapter implements IWhatsAppProvider {
  private lines = new Map<string, LineState>();
  private onMessageCallback?: (lineId: string, from: string, fromName: string, content: string, type: string) => void;
  // Dedup: track seen Baileys message IDs to skip replays on reconnect.
  private seenIds = new Map<string, number>();
  // One pending reconnect timer per line — cancel before reconnecting to prevent accumulation.
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly redis: Redis,
    private readonly onStatusChange?: (lineId: string, status: LineState['status'], qrCode?: string) => void,
  ) {
    // Purge seen IDs older than 10 minutes every 5 minutes.
    setInterval(() => {
      const cutoff = Date.now() - 10 * 60 * 1000;
      for (const [id, ts] of this.seenIds) {
        if (ts < cutoff) this.seenIds.delete(id);
      }
    }, 5 * 60 * 1000);
  }

  /** Register handler for incoming messages */
  setOnMessage(cb: typeof this.onMessageCallback) {
    this.onMessageCallback = cb;
  }

  // forceNewQr=true (default): used by API calls — wipes existing creds so Baileys emits a fresh QR.
  // forceNewQr=false: used by internal auto-reconnect — preserves creds so Baileys can resume a
  //   session (e.g. after a 515 stream restart following a successful pairing).
  async connectLine(lineId: string, forceNewQr = true): Promise<string | null> {
    // Cancel any pending auto-reconnect timer for this line.
    const pendingTimer = this.reconnectTimers.get(lineId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.reconnectTimers.delete(lineId);
    }

    const existingLine = this.lines.get(lineId);

    // If already connected, nothing to do
    if (existingLine && existingLine.status === 'CONNECTED') {
      baileysLogger.info({ lineId }, 'Line already connected, skipping');
      return null;
    }

    baileysLogger.info({ lineId, forceNewQr }, 'Ensuring fresh session for connection attempt');

    // 1. Close existing socket if any — mark intentional so the close handler skips auto-reconnect.
    if (existingLine) {
      existingLine.intentionalClose = true;
      try { existingLine.socket.end(undefined); } catch (e) {}
      this.lines.delete(lineId);
    }

    // 2. Only wipe Redis auth when the caller explicitly wants a fresh QR (user-triggered connect).
    //    Auto-reconnect (forceNewQr=false) must preserve creds so Baileys can resume the session.
    if (forceNewQr && existingLine) {
      baileysLogger.info({ lineId }, 'Clearing stale Redis auth to force fresh QR');
      const { clear } = await useRedisAuthState(lineId, this.redis);
      await clear();
    }

    // 3. Load fresh auth state (empty if just cleared, or first-time connect)
    const { state, saveCreds, clear: clearAuth } = await useRedisAuthState(lineId, this.redis);

    const sock = makeWASocket({
      version: BAILEYS_VERSION,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      browser: ['Chrome (Linux)', 'Chrome', '145.0.0'],
      printQRInTerminal: false,
      logger: baileysLogger,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 60000,
    });

    const lineState: LineState = {
      socket: sock,
      qrCode: null,
      status: 'CONNECTING',
      messageStatusCallbacks: new Map(),
      ephemeralByJid: new Map(),
      clearAuth
    };
    this.lines.set(lineId, lineState);

    sock.ev.on('creds.update', saveCreds);

    // Promise to wait for first QR or Connection
    const waitForInit = new Promise<string | null>((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 20000); // Increased timeout to 20s for Redis/Connection

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        baileysLogger.info({ connection, qr: !!qr }, 'Connection update received');

        if (qr) {
          lineState.qrCode = qr;
          lineState.status = 'QR_PENDING';
          baileysLogger.info({ lineId }, 'QR code emitted');
          this.onStatusChange?.(lineId, 'QR_PENDING', qr);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(qr);
          }
        }

        if (connection === 'open') {
          lineState.status = 'CONNECTED';
          lineState.qrCode = null;
          baileysLogger.info({ lineId }, 'WhatsApp connection opened successfully');
          this.onStatusChange?.(lineId, 'CONNECTED');
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(null);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          baileysLogger.warn({ lineId, statusCode, reason: lastDisconnect?.error?.message, intentional: lineState.intentionalClose }, 'Connection closed');

          lineState.status = 'DISCONNECTED';
          this.onStatusChange?.(lineId, 'DISCONNECTED');

          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(null);
          }

          // Skip auto-reconnect if this close was triggered by connectLine itself.
          if (lineState.intentionalClose) return;

          // If conflict or stream error, clear auth before retry
          if (statusCode === 401 || statusCode === 408 || lastDisconnect?.error?.message?.includes('conflict')) {
            baileysLogger.info({ lineId }, 'Conflict or timeout detected, wiping Redis session and retrying...');
            await clearAuth();
          }

          if (shouldReconnect) {
            // Track the timer so a subsequent connectLine call can cancel it.
            // Pass forceNewQr=false: auth was already cleared above for 401/408/conflict,
            // and for other codes (e.g. 515 stream restart) we must keep the saved creds.
            const timer = setTimeout(() => {
              this.reconnectTimers.delete(lineId);
              this.connectLine(lineId, false);
            }, 5000);
            this.reconnectTimers.set(lineId, timer);
          }
        }
      });
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const jid = msg.key.remoteJid ?? '';
        if (jid === 'status@broadcast') continue;
        if (jid.endsWith('@g.us')) continue;

        let fromPhone = jid.split('@')[0].split(':')[0];
        
        if (jid.endsWith('@lid')) {
          try {
            const pn = await (sock as any).signalRepository?.lidMapping?.getPNForLID(jid);
            if (pn) {
              fromPhone = pn.split('@')[0];
            }
          } catch (err) {
            baileysLogger.debug({ jid, err }, 'Failed to resolve LID');
          }
        }

        const fromName = msg.pushName ?? fromPhone;
        
        let content = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || 
                      msg.message?.imageMessage?.caption || 
                      msg.message?.videoMessage?.caption || 
                      '';

        if (msg.message?.ephemeralMessage) {
          content = msg.message.ephemeralMessage.message?.conversation || 
                    msg.message.ephemeralMessage.message?.extendedTextMessage?.text || content;
        }
        if (msg.message?.viewOnceMessage?.message) {
          content = msg.message.viewOnceMessage.message.conversation || 
                    msg.message.viewOnceMessage.message.extendedTextMessage?.text || content;
        }
        if (msg.message?.viewOnceMessageV2?.message) {
          content = msg.message.viewOnceMessageV2.message.conversation || 
                    msg.message.viewOnceMessageV2.message.extendedTextMessage?.text || content;
        }

        if (!content && !msg.message?.imageMessage && !msg.message?.documentMessage) continue;

        const msgType = msg.message?.imageMessage ? 'IMAGE'
          : msg.message?.documentMessage ? 'PDF'
          : 'TEXT';

        // Skip if this exact message was already processed (Baileys replay on reconnect).
        const baileysId = msg.key.id ?? '';
        if (baileysId && this.seenIds.has(baileysId)) continue;
        if (baileysId) this.seenIds.set(baileysId, Date.now());

        this.onMessageCallback?.(lineId, fromPhone, fromName, content, msgType);
      }
    });

    sock.ev.on('messages.update', (updates) => {
      for (const upd of updates) {
        const ack = upd.update.status;
        const cb = lineState.messageStatusCallbacks.get(upd.key.id ?? '');
        if (cb) {
          cb(ack && ack >= 2 ? 'SUCCESS' : 'FAILED');
          lineState.messageStatusCallbacks.delete(upd.key.id ?? '');
        }
      }
    });

    sock.ev.on('chats.upsert', (chats) => {
      for (const chat of chats) {
        const jid = chat.id ?? '';
        if (!jid) continue;
        if (chat.ephemeralExpiration) {
          lineState.ephemeralByJid.set(jid, chat.ephemeralExpiration);
        } else if (chat.ephemeralExpiration === 0 || chat.ephemeralExpiration === null) {
          lineState.ephemeralByJid.delete(jid);
        }
      }
    });

    sock.ev.on('chats.update', (updates) => {
      for (const upd of updates) {
        const jid = upd.id ?? '';
        if (!jid) continue;
        if (upd.ephemeralExpiration) {
          lineState.ephemeralByJid.set(jid, upd.ephemeralExpiration);
        } else if (upd.ephemeralExpiration === 0 || upd.ephemeralExpiration === null) {
          lineState.ephemeralByJid.delete(jid);
        }
      }
    });

    return waitForInit;
  }

  async disconnectLine(lineId: string): Promise<void> {
    const pending = this.reconnectTimers.get(lineId);
    if (pending) { clearTimeout(pending); this.reconnectTimers.delete(lineId); }
    const line = this.lines.get(lineId);
    if (line) {
      line.intentionalClose = true;
      await line.socket.logout();
      if (line.clearAuth) await line.clearAuth();
      this.lines.delete(lineId);
    }
  }

  async sendTextMessage(lineId: string, to: string, text: string): Promise<string> {
    const line = this.getLineOrThrow(lineId);
    const cleanTo = to.includes('@') ? to : `${to.split(':')[0]}@s.whatsapp.net`;
    const ephemeralExpiration = line.ephemeralByJid.get(cleanTo);
    const result = await line.socket.sendMessage(
      cleanTo,
      { text },
      ephemeralExpiration ? { ephemeralExpiration } : undefined,
    );
    return result?.key.id ?? '';
  }

  async sendMediaMessage(lineId: string, to: string, mediaPath: string, type: 'IMAGE' | 'PDF'): Promise<string> {
    const line = this.getLineOrThrow(lineId);
    const buffer = fs.readFileSync(mediaPath);
    const filename = path.basename(mediaPath);
    const cleanTo = to.includes('@') ? to : `${to.split(':')[0]}@s.whatsapp.net`;
    const ephemeralExpiration = line.ephemeralByJid.get(cleanTo);
    const sendOpts = ephemeralExpiration ? { ephemeralExpiration } : undefined;

    let result;
    if (type === 'IMAGE') {
      result = await line.socket.sendMessage(cleanTo, { image: buffer }, sendOpts);
    } else {
      result = await line.socket.sendMessage(cleanTo, { document: buffer, fileName: filename, mimetype: 'application/pdf' }, sendOpts);
    }
    return result?.key.id ?? '';
  }

  async getLineStatus(lineId: string): Promise<LineState['status']> {
    return this.lines.get(lineId)?.status ?? 'DISCONNECTED';
  }

  async getQrCode(lineId: string): Promise<string | null> {
    return this.lines.get(lineId)?.qrCode ?? null;
  }

  private getLineOrThrow(lineId: string) {
    const line = this.lines.get(lineId);
    if (!line || line.status !== 'CONNECTED') throw new Error(`Line ${lineId} is not connected.`);
    return line;
  }
}
