// WebSocket Manager — real-time status notifications to the frontend

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../lib/logger.js';

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private heartbeat: ReturnType<typeof setInterval>;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      (ws as any).isAlive = true;
      this.clients.add(ws);
      logger.info({ total: this.clients.size }, 'WS client connected');

      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('message', (raw) => {
        if (raw.toString() === '{"event":"ping"}') {
          ws.send(JSON.stringify({ event: 'pong', data: {}, ts: Date.now() }));
        }
      });

      ws.on('error', (err) => {
        logger.warn({ err }, 'WS client error');
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info({ total: this.clients.size }, 'WS client disconnected');
      });
    });

    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if ((client as any).isAlive === false) {
          this.clients.delete(client);
          client.terminate();
          continue;
        }

        (client as any).isAlive = false;
        client.ping();
      }
    }, 30000);

    this.wss.on('close', () => clearInterval(this.heartbeat));
  }

  broadcast(event: string, data: any): void {
    const payload = JSON.stringify({ event, data, ts: Date.now() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
