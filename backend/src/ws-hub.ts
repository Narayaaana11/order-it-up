import * as http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyJWT, hashString, JWTPayload } from './api/auth';
import { D1SqliteAdapter } from './db/d1-sqlite-adapter';
import { getUserMemberships, isAuthorizedForBranch, isOrgOwnerOrAdmin } from './api/rbac';

export interface WsClientMeta {
  userId: string;
  orgId: string;
  branchId: string | null;
  channel: 'kds' | 'pos';
  role: string;
}

export class RealtimeWsHub {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, WsClientMeta>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly getJwtSecret: () => string,
    private readonly db?: D1SqliteAdapter
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, meta: WsClientMeta) => {
      this.clients.set(ws, meta);
      ws.send(
        JSON.stringify({
          type: 'connected',
          channel: meta.channel,
          orgId: meta.orgId,
          branchId: meta.branchId,
          timestamp: new Date().toISOString(),
        })
      );

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg?.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
        } catch {
          // Ignore malformed client frames
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    this.heartbeatTimer = setInterval(() => {
      for (const ws of this.clients.keys()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    }, 30_000);
    this.heartbeatTimer.unref();
  }

  async handleUpgrade(
    req: http.IncomingMessage,
    socket: any,
    head: Buffer
  ): Promise<boolean> {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    if (pathname !== '/ws/kds' && pathname !== '/ws/pos') {
      return false;
    }

    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;
    const token = url.searchParams.get('token') || bearerToken;

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return true;
    }

    const payload: JWTPayload | null = await verifyJWT(token, this.getJwtSecret());
    if (!payload) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return true;
    }

    const requestedBranchId = url.searchParams.get('branch_id');
    const branchId = requestedBranchId || payload.branch || null;

    if (this.db) {
      const tokenHash = await hashString(token);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const revoked = await this.db
        .prepare('SELECT 1 AS revoked FROM cloud_token_revocations WHERE token_hash = ? AND expires_at > ?')
        .bind(tokenHash, nowSeconds)
        .first<{ revoked: number }>();
      if (revoked) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return true;
      }

      const memberships = await getUserMemberships(this.db, payload.org, payload.sub);
      if (memberships.length === 0) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return true;
      }

      if (branchId) {
        const branchAuth = await isAuthorizedForBranch(this.db, payload.org, memberships, branchId);
        if (!branchAuth.authorized) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return true;
        }
      } else if (!isOrgOwnerOrAdmin(memberships)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return true;
      }
    }

    const channel: 'kds' | 'pos' = pathname === '/ws/kds' ? 'kds' : 'pos';
    const meta: WsClientMeta = {
      userId: payload.sub,
      orgId: payload.org,
      branchId,
      channel,
      role: payload.role,
    };

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req, meta);
    });
    return true;
  }

  broadcast(
    orgId: string,
    branchId: string | null | undefined,
    event: string,
    payload: Record<string, unknown>,
    channels: Array<'kds' | 'pos'> = ['kds', 'pos']
  ): number {
    const message = JSON.stringify({
      type: event,
      orgId,
      branchId: branchId ?? null,
      payload,
      timestamp: new Date().toISOString(),
    });

    let delivered = 0;
    for (const [ws, meta] of this.clients.entries()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (meta.orgId !== orgId) continue;
      if (!channels.includes(meta.channel)) continue;
      if (branchId && meta.branchId && meta.branchId !== branchId) continue;
      ws.send(message);
      delivered += 1;
    }
    return delivered;
  }

  getStats(): { totalConnections: number; kdsConnections: number; posConnections: number } {
    let kdsConnections = 0;
    let posConnections = 0;
    for (const meta of this.clients.values()) {
      if (meta.channel === 'kds') kdsConnections += 1;
      else posConnections += 1;
    }
    return {
      totalConnections: this.clients.size,
      kdsConnections,
      posConnections,
    };
  }

  async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const ws of this.clients.keys()) {
      try {
        ws.close(1001, 'Server shutting down');
      } catch {
        // Ignore close errors
      }
    }
    this.clients.clear();
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
