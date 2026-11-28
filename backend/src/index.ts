import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { D1SqliteAdapter } from './db/d1-sqlite-adapter';
import { runMigrations } from './db/migrator';
import { RealtimeWsHub } from './ws-hub';
import { BackupService } from './services/backup-service';
import { tryServeStaticFile } from './static-server';
import cloudWorker from './api/index';
import { Env } from './api/routes/pairing';
import { verifyJWT, hashString } from './api/auth';
import { getUserMemberships, isOrgOwnerOrAdmin } from './api/rbac';

export interface UnifiedServerOptions {
  port?: number;
  host?: string;
  dbPath?: string;
  backupDir?: string;
  migrationDirs?: string[];
  staticDirs?: string[];
  envOverrides?: Record<string, string | undefined>;
}

export interface RunningUnifiedServer {
  server: http.Server;
  port: number;
  adapter: D1SqliteAdapter;
  wsHub: RealtimeWsHub;
  backupService: BackupService;
  stop: () => Promise<void>;
}

function buildEnv(adapter: D1SqliteAdapter, overrides?: Record<string, string | undefined>): Env {
  const source = { ...process.env, ...overrides };
  return {
    DB: adapter as unknown as Env['DB'],
    JWT_SECRET: source.JWT_SECRET || '',
    ENVIRONMENT: source.ENVIRONMENT || 'production',
    ALLOW_SELF_SERVICE_REGISTRATION: source.ALLOW_SELF_SERVICE_REGISTRATION || 'false',
    RATE_LIMIT_LOGIN_IP: source.RATE_LIMIT_LOGIN_IP,
    RATE_LIMIT_LOGIN_ACCOUNT: source.RATE_LIMIT_LOGIN_ACCOUNT,
    RATE_LIMIT_PAIR_CLAIM_IP: source.RATE_LIMIT_PAIR_CLAIM_IP,
    RATE_LIMIT_PAIR_GENERATE_BRANCH: source.RATE_LIMIT_PAIR_GENERATE_BRANCH,
    RATE_LIMIT_DEMO_SETUP_IP: source.RATE_LIMIT_DEMO_SETUP_IP,
    RATE_LIMIT_SYNC_EVENTS_TERMINAL: source.RATE_LIMIT_SYNC_EVENTS_TERMINAL,
    RATE_LIMIT_PILOT_REQUEST_IP: source.RATE_LIMIT_PILOT_REQUEST_IP,
    RATE_LIMIT_PILOT_REQUEST_EMAIL: source.RATE_LIMIT_PILOT_REQUEST_EMAIL,
    FRONTEND_ORIGIN: source.FRONTEND_ORIGIN || '',
    PLATFORM_ADMIN_EMAIL: source.PLATFORM_ADMIN_EMAIL || '',
    PLATFORM_ADMIN_PASSWORD_HASH: source.PLATFORM_ADMIN_PASSWORD_HASH || '',
    PLATFORM_ADMIN_JWT_SECRET: source.PLATFORM_ADMIN_JWT_SECRET || '',
    RESEND_API_KEY: source.RESEND_API_KEY,
    PILOT_INVITATION_FROM: source.PILOT_INVITATION_FROM,
    PILOT_INVITATION_BASE_URL: source.PILOT_INVITATION_BASE_URL,
    RAZORPAY_KEY_ID: source.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: source.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: source.RAZORPAY_WEBHOOK_SECRET,
    REQUIRE_PROVIDER_VERIFIED_NONCASH: source.REQUIRE_PROVIDER_VERIFIED_NONCASH || 'true',
  };
}

async function readIncomingBody(req: http.IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function toWebRequest(req: http.IncomingMessage, body?: Buffer): Request {
  const host = req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const url = `${proto}://${host}${req.url || '/'}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method: req.method || 'GET',
    headers,
    body: body ? new Uint8Array(body) : undefined,
  });
}

async function sendWebResponse(res: http.ServerResponse, webRes: Response): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!webRes.body) {
    res.end();
    return;
  }

  const buffer = Buffer.from(await webRes.arrayBuffer());
  res.end(buffer);
}

function resolveDefaultMigrationDirs(): string[] {
  const candidates = [
    path.resolve(__dirname, '../migrations'),
    path.resolve(__dirname, '../../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'backend/migrations'),
  ];
  return [...new Set(candidates)].filter((dir) => fs.existsSync(dir));
}

function resolveDefaultStaticDirs(): string[] {
  const envStatic = process.env.STATIC_WEB_DIR;
  const envLanding = process.env.LANDING_WEB_DIR;
  const candidates = [
    envStatic,
    envLanding,
    path.resolve(process.cwd(), 'desktop-ui/out'),
    path.resolve(process.cwd(), 'landing/out'),
  ].filter((d): d is string => Boolean(d));
  return [...new Set(candidates)];
}

async function emitRealtimeEventsIfMutation(
  req: Request,
  res: Response,
  env: Env,
  wsHub: RealtimeWsHub
): Promise<Response> {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !res.ok) {
    return res;
  }

  const pathname = new URL(req.url).pathname;
  const isOrderMutation =
    pathname.startsWith('/api/orders') ||
    pathname.startsWith('/api/cloud/orders') ||
    pathname === '/api/qr/order' ||
    pathname.startsWith('/api/public/qr/');
  const isKdsMutation = pathname.startsWith('/api/kitchen-tickets');
  const isTableMutation = pathname.startsWith('/api/tables');

  if (!isOrderMutation && !isKdsMutation && !isTableMutation) {
    return res;
  }

  const cloned = res.clone();
  let data: any = null;
  try {
    data = await cloned.json();
  } catch {
    return res;
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  let orgId = data?.organization_id || data?.order?.organization_id || null;
  let branchId = data?.branch_id || data?.order?.branch_id || null;

  if (token) {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (payload) {
      orgId = orgId || payload.org;
      branchId = branchId || payload.branch;
    }
  }

  if ((!orgId || !branchId) && (pathname === '/api/qr/order' || pathname.startsWith('/api/public/qr/')) && data?.order?.id) {
    const orderRow = await env.DB.prepare(
      'SELECT organization_id, branch_id FROM synced_orders WHERE id = ?'
    )
      .bind(data.order.id)
      .first<{ organization_id: string; branch_id: string }>();
    if (orderRow) {
      orgId = orgId || orderRow.organization_id;
      branchId = branchId || orderRow.branch_id;
    }
  }

  if (orgId) {
    const event = isKdsMutation
      ? 'kds:ticket_updated'
      : isTableMutation
      ? 'table:updated'
      : method === 'POST'
      ? 'order:created'
      : 'order:updated';
    wsHub.broadcast(orgId, branchId, event, { path: pathname, data });
  }

  return res;
}

export async function startUnifiedServer(
  options: UnifiedServerOptions = {}
): Promise<RunningUnifiedServer> {
  const envOverrides = options.envOverrides;
  const port = options.port ?? Number(envOverrides?.PORT || process.env.PORT || 8080);
  const host = options.host ?? (envOverrides?.HOST || process.env.HOST || '0.0.0.0');
  const dbPath =
    options.dbPath ??
    (envOverrides?.DB_PATH || process.env.DB_PATH || path.resolve(process.cwd(), 'data/oiu-unified.db'));
  const backupDir =
    options.backupDir ??
    (envOverrides?.BACKUP_DIR || process.env.BACKUP_DIR || path.resolve(path.dirname(dbPath), 'backups'));

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const adapter = new D1SqliteAdapter(dbPath);
  const migrationDirs = options.migrationDirs ?? resolveDefaultMigrationDirs();
  const migrationResult = runMigrations(adapter, migrationDirs, backupDir);
  if (migrationResult.applied.length > 0) {
    console.log(
      `[UnifiedServer] Applied ${migrationResult.applied.length} migrations: ${migrationResult.applied.join(', ')}`
    );
  }

  const env = buildEnv(adapter, envOverrides);
  const wsHub = new RealtimeWsHub(() => env.JWT_SECRET, adapter);
  const backupService = new BackupService(adapter, {
    backupDir,
    retentionDays: Number(envOverrides?.BACKUP_RETENTION_DAYS || process.env.BACKUP_RETENTION_DAYS || 14),
    s3Endpoint: envOverrides?.OCI_S3_ENDPOINT || process.env.OCI_S3_ENDPOINT,
    s3Region: envOverrides?.OCI_S3_REGION || process.env.OCI_S3_REGION,
    s3Bucket: envOverrides?.OCI_S3_BUCKET || process.env.OCI_S3_BUCKET,
    s3AccessKeyId: envOverrides?.OCI_S3_ACCESS_KEY_ID || process.env.OCI_S3_ACCESS_KEY_ID,
    s3SecretAccessKey: envOverrides?.OCI_S3_SECRET_ACCESS_KEY || process.env.OCI_S3_SECRET_ACCESS_KEY,
  });
  const staticDirs = options.staticDirs ?? resolveDefaultStaticDirs();

  const server = http.createServer(async (req, res) => {
    try {
      const body = await readIncomingBody(req);
      const webReq = toWebRequest(req, body);
      const url = new URL(webReq.url);
      const pathname = url.pathname;

      // Health & WebSocket stats
      if (pathname === '/health' || pathname === '/api/health') {
        await sendWebResponse(
          res,
          Response.json({
            service: 'orderitup-unified-server',
            version: '1.0.0',
            status: 'operational',
            engine: 'Node.js 22 + SQLite WAL (Oracle Cloud)',
            websocket: wsHub.getStats(),
          })
        );
        return;
      }

      // Admin SQLite backup endpoints
      if (pathname === '/api/admin/backups') {
        const authHeader = webReq.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const payload = token ? await verifyJWT(token, env.JWT_SECRET) : null;
        if (!payload) {
          await sendWebResponse(res, Response.json({ error: 'Unauthorized' }, { status: 401 }));
          return;
        }
        const tokenHash = await hashString(token);
        const nowSeconds = Math.floor(Date.now() / 1000);
        const revoked = await env.DB.prepare(
          'SELECT 1 AS revoked FROM cloud_token_revocations WHERE token_hash = ? AND expires_at > ?'
        )
          .bind(tokenHash, nowSeconds)
          .first<{ revoked: number }>();
        if (revoked) {
          await sendWebResponse(res, Response.json({ error: 'Unauthorized' }, { status: 401 }));
          return;
        }
        const memberships = await getUserMemberships(env.DB, payload.org, payload.sub);
        if (!isOrgOwnerOrAdmin(memberships)) {
          await sendWebResponse(res, Response.json({ error: 'Forbidden' }, { status: 403 }));
          return;
        }
        if (webReq.method === 'GET') {
          await sendWebResponse(
            res,
            Response.json({ backups: backupService.listBackups() })
          );
          return;
        }
        if (webReq.method === 'POST') {
          const entry = await backupService.createBackup('manual');
          await sendWebResponse(res, Response.json({ success: true, backup: entry }, { status: 201 }));
          return;
        }
      }

      // Serve static web exports for non-API routes when available
      const isApiRoute =
        pathname.startsWith('/api/') ||
        pathname === '/ready' ||
        pathname === '/health';

      if (!isApiRoute && (webReq.method === 'GET' || webReq.method === 'HEAD')) {
        const staticRes = tryServeStaticFile(pathname, staticDirs);
        if (staticRes) {
          await sendWebResponse(res, staticRes);
          return;
        }
      }

      // Delegate to unified Cloud API router
      const workerRes = await cloudWorker.fetch(webReq, env);
      const finalRes = await emitRealtimeEventsIfMutation(webReq, workerRes, env, wsHub);
      await sendWebResponse(res, finalRes);
    } catch (error) {
      console.error('[UnifiedServer] Request error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });

  server.on('upgrade', (req, socket, head) => {
    void wsHub.handleUpgrade(req, socket, head).then((handled) => {
      if (!handled) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  const activePort = typeof address === 'object' && address ? address.port : port;

  // Background scheduled tasks (replacing Cloudflare cron triggers)
  const backupIntervalMs = Number(
    envOverrides?.BACKUP_INTERVAL_MS || process.env.BACKUP_INTERVAL_MS || 24 * 60 * 60 * 1000
  );
  const backupTimer = setInterval(() => {
    void backupService.createBackup('scheduled').catch((err) => {
      console.error('[UnifiedServer] Scheduled backup failed:', err);
    });
  }, backupIntervalMs);
  backupTimer.unref();

  const stop = async (): Promise<void> => {
    clearInterval(backupTimer);
    await wsHub.close();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    adapter.close();
  };

  return { server, port: activePort, adapter, wsHub, backupService, stop };
}

if (require.main === module) {
  startUnifiedServer()
    .then(({ port, stop }) => {
      console.log(`[UnifiedServer] Order It Up Oracle Backend listening on :${port}`);
      const shutdown = () => {
        console.log('[UnifiedServer] Shutting down gracefully...');
        void stop().then(() => process.exit(0));
      };
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    })
    .catch((err) => {
      console.error('[UnifiedServer] Failed to start:', err);
      process.exit(1);
    });
}
