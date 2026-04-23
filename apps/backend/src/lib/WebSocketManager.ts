// WebSocket Manager — real-time status notifications to the frontend

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../lib/logger.js';

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      logger.info({ total: this.clients.size }, 'WS client connected');

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info({ total: this.clients.size }, 'WS client disconnected');
      });
    });
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
