import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import { UNIFIED_PORT_BASE, allocatePort, releasePort } from '../lib/ports';
import {
  type UnifiedBackendHarness,
  type UnifiedBackendHarnessOptions,
  startUnifiedBackend,
} from '../lib/unified-backend-harness';
import {
  type WsHandle,
  assert,
  assertEqual,
  assertJson,
  assertStatus,
  buildWsHandle,
  createWsFrameQueue,
  hashScrypt,
  httpRequest,
  killChildTreeSync,
  registerManagedResource,
  registerTest,
  removeTempDirWithRetry,
  unregisterManagedResource,
  waitForWsFrame,
} from '../lib/test-kit';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const nodeRequire = createRequire(__filename);
let cachedRawRuntime: { exe: string; useElectronAsNode: boolean } | null = null;

function resolveRawUnifiedRuntime(): { exe: string; useElectronAsNode: boolean } {
  if (cachedRawRuntime) return cachedRawRuntime;
  const backendSqliteDir = path.join(REPO_ROOT, 'backend', 'node_modules', 'better-sqlite3');
  if (fs.existsSync(backendSqliteDir) && !process.versions.electron) {
    const probe = spawnSync(
      process.execPath,
      ['-e', "const D=require('./backend/node_modules/better-sqlite3'); new D(':memory:').close();"],
      { cwd: REPO_ROOT, stdio: 'ignore' },
    );
    if (probe.status === 0) {
      cachedRawRuntime = { exe: process.execPath, useElectronAsNode: false };
      return cachedRawRuntime;
    }
  }
  const resolved: unknown = nodeRequire('electron');
  if (typeof resolved !== 'string' || !resolved.trim()) {
    throw new Error('Could not resolve Electron executable via require("electron")');
  }
  cachedRawRuntime = { exe: resolved, useElectronAsNode: true };
  return cachedRawRuntime;
}

async function withBackend<T>(
  opts: UnifiedBackendHarnessOptions,
  fn: (harness: UnifiedBackendHarness) => Promise<T>,
): Promise<T> {
  const harness = await startUnifiedBackend(opts);
  try {
    return await fn(harness);
  } finally {
    await harness.stop();
  }
}

async function withRawBackendHealthOnly(
  envOverrides: Record<string, string | undefined>,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const entryPath = path.join(REPO_ROOT, 'backend', 'dist', 'index.js');
  if (!fs.existsSync(entryPath)) {
    throw new Error(`backend/dist/index.js not found at ${entryPath}`);
  }
  const port = await allocatePort(UNIFIED_PORT_BASE);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-e2e-cloud-'));
  const dbPath = path.join(tmpDir, 'unified.db');
  const backupDir = path.join(tmpDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const adminHash = await hashScrypt('PlatformAdmin123!');
  const runtime = resolveRawUnifiedRuntime();
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    DB_PATH: dbPath,
    BACKUP_DIR: backupDir,
    BACKUP_INTERVAL_MS: '86400000',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    PLATFORM_ADMIN_JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    PLATFORM_ADMIN_EMAIL: 'platform-admin@e2e.local',
    PLATFORM_ADMIN_PASSWORD_HASH: adminHash,
    ALLOW_SELF_SERVICE_REGISTRATION: 'true',
    ENVIRONMENT: 'development',
    FRONTEND_ORIGIN: 'http://localhost:3000',
  };
  if (runtime.useElectronAsNode) {
    childEnv['ELECTRON_RUN_AS_NODE'] = '1';
  }
  for (const [key, val] of Object.entries(envOverrides)) {
    if (val === undefined) {
      delete childEnv[key];
    } else {
      childEnv[key] = val;
    }
  }

  const proc: ChildProcess = spawn(runtime.exe, [entryPath], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv,
  });
  const managed = { proc, tmpDir, keepTempDir: false };
  registerManagedResource(managed);

  let exited = false;
  let exitCode: number | null = null;
  const logs: string[] = [];
  proc.stdout?.setEncoding('utf8');
  proc.stdout?.on('data', (chunk: string) => logs.push(chunk));
  proc.stderr?.setEncoding('utf8');
  proc.stderr?.on('data', (chunk: string) => logs.push(chunk));
  const exitPromise = new Promise<void>((resolve) => {
    proc.once('exit', (code) => {
      exited = true;
      exitCode = code;
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 20_000;
    let healthy = false;
    while (!healthy) {
      if (exited) {
        throw new Error(`Raw backend exited early (code=${exitCode}): ${logs.join('')}`);
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for raw backend /health: ${logs.join('')}`);
      }
      try {
        const res = await httpRequest(`${baseUrl}/health`, { timeoutMs: 2000 });
        if (res.status === 200) {
          healthy = true;
          break;
        }
      } catch {
        // retry
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    await fn(baseUrl);
  } finally {
    if (!exited && proc.exitCode === null && proc.signalCode === null) {
      try {
        proc.kill('SIGTERM');
      } catch {
        // ignore
      }
      const graceful = await Promise.race([
        exitPromise.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
      ]);
      if (!graceful && !exited) {
        killChildTreeSync(proc.pid);
        await Promise.race([
          exitPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
      }
    }
    unregisterManagedResource(managed);
    releasePort(port);
    await removeTempDirWithRetry(tmpDir);
  }
}

async function expectWsRejectedStatus(
  wsUrl: string,
  expectedStatus: number,
  headers?: Record<string, string>,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, headers ? { headers } : undefined);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      reject(new Error(`Timed out waiting for WS rejection (${expectedStatus}) on ${wsUrl}`));
    }, 5000);

    ws.once('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.terminate();
      reject(new Error(`Expected WS ${expectedStatus} rejection on ${wsUrl}, but handshake succeeded`));
    });

    ws.once('unexpected-response', (_req, res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const statusCode = res.statusCode ?? 0;
      res.resume();
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      resolve(statusCode);
    });

    ws.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function wsConnectWithHeaders(
  wsUrl: string,
  headers: Record<string, string>,
): Promise<WsHandle> {
  const ws = new WebSocket(wsUrl, { headers });
  const queue = createWsFrameQueue(ws);
  try {
    const connected = await waitForWsFrame(queue, (m) => m?.type === 'connected', 5000);
    return buildWsHandle(ws, wsUrl, queue, connected);
  } catch (err) {
    try {
      ws.terminate();
    } catch {
      // ignore
    }
    throw err;
  }
}

function rawHttpGet(port: number, rawPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'GET',
        path: rawPath,
        timeout: 5000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`rawHttpGet timed out for ${rawPath}`));
    });
    req.end();
  });
}

function createSignedJwtWithWrongSecret(orgId: string, userId: string, branchId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      org: orgId,
      branch: branchId,
      role: 'owner',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', 'completely-wrong-secret-key-for-e2e-test-0001')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function getFirstProduct(harness: UnifiedBackendHarness, token: string): Promise<{
  id: string;
  name: string;
  base_price: number;
  tax_rate: number;
}> {
  const catalogRes = await harness.request('/api/catalog/master', { token });
  const catalog = assertJson(catalogRes, 200, (d) => Array.isArray(d.products) && d.products.length > 0);
  const p = catalog.products[0];
  return {
    id: String(p.id),
    name: String(p.name),
    base_price: Number(p.base_price),
    tax_rate: Number(p.tax_rate ?? 0),
  };
}

// ============================================================================
// Feature F13: Cloud Runtime, Health, Readiness & Backups (5 Tier 1, 6 Tier 2)
// ============================================================================

registerTest({
  id: 'f13:t1:health-and-ready',
  tier: 1,
  feature: 'F13: Cloud Runtime & Health',
  title: '/health, /api/health, /ready, and /api/ready report operational & ready',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const h1 = await harness.request('/health');
      assertJson(h1, 200, (d) =>
        d.service === 'orderitup-unified-server' &&
        d.status === 'operational' &&
        typeof d.websocket?.totalConnections === 'number' &&
        typeof d.websocket?.kdsConnections === 'number' &&
        typeof d.websocket?.posConnections === 'number',
      );

      const h2 = await harness.request('/api/health');
      assertJson(h2, 200, (d) =>
        d.service === 'orderitup-unified-server' && d.status === 'operational',
      );

      const r1 = await harness.request('/ready');
      assertJson(r1, 200, (d) => d.service === 'orderitup-cloud-api' && d.status === 'ready');
      assertEqual(r1.headers.get('cache-control'), 'no-store', 'Expected Cache-Control: no-store on /ready');

      const r2 = await harness.request('/api/ready');
      assertJson(r2, 200, (d) => d.service === 'orderitup-cloud-api' && d.status === 'ready');
    });
  },
});

registerTest({
  id: 'f13:t1:static-web-serving',
  tier: 1,
  feature: 'F13: Cloud Runtime & Health',
  title: 'Serves static index.html and hashed assets from STATIC_WEB_DIR',
  async run(): Promise<void> {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-e2e-static-'));
    try {
      const indexHtml = '<!doctype html><html><body><h1>Order It Up E2E</h1></body></html>';
      const appJs = 'console.log("oiu-e2e-static-js");';
      fs.writeFileSync(path.join(staticDir, 'index.html'), indexHtml, 'utf8');
      fs.writeFileSync(path.join(staticDir, 'app.js'), appJs, 'utf8');

      await withBackend({ env: { STATIC_WEB_DIR: staticDir } }, async (harness) => {
        const rootRes = await harness.request('/');
        assertStatus(rootRes, 200, 'GET /');
        assert(
          (rootRes.headers.get('content-type') ?? '').includes('text/html'),
          `Expected text/html content-type, got ${rootRes.headers.get('content-type')}`,
        );
        assertEqual(rootRes.headers.get('x-content-type-options'), 'nosniff');
        assertEqual(rootRes.rawText, indexHtml);

        const jsRes = await harness.request('/app.js');
        assertStatus(jsRes, 200, 'GET /app.js');
        assert(
          (jsRes.headers.get('content-type') ?? '').includes('application/javascript'),
          `Expected application/javascript, got ${jsRes.headers.get('content-type')}`,
        );
        assert(
          (jsRes.headers.get('cache-control') ?? '').includes('immutable'),
          `Expected immutable Cache-Control on /app.js, got ${jsRes.headers.get('cache-control')}`,
        );
        assertEqual(jsRes.rawText, appJs);
      });
    } finally {
      await removeTempDirWithRetry(staticDir);
    }
  },
});

registerTest({
  id: 'f13:t1:backups-create-list',
  tier: 1,
  feature: 'F13: Cloud Runtime & Health',
  title: 'Platform admin creates manual SQLite backup and lists backups',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const adminToken = await harness.platformAdminLogin();
      const createRes = await harness.request('/api/admin/backups', {
        method: 'POST',
        token: adminToken,
      });
      const created = assertJson(
        createRes,
        201,
        (d) =>
          d.success === true &&
          typeof d.backup?.filename === 'string' &&
          Number(d.backup?.sizeBytes) > 0 &&
          typeof d.backup?.createdAt === 'string',
      );
      const backupFile = path.join(harness.backupDir, created.backup.filename);
      assert(fs.existsSync(backupFile), `Expected backup file on disk at ${backupFile}`);

      const listRes = await harness.request('/api/admin/backups', { token: adminToken });
      const listed = assertJson(listRes, 200, (d) => Array.isArray(d.backups));
      assert(
        listed.backups.some((b: { filename?: string }) => b.filename === created.backup.filename),
        'Expected listed backups to include newly created backup filename',
      );
    });
  },
});

registerTest({
  id: 'f13:t1:ws-stats-reflect-connections',
  tier: 1,
  feature: 'F13: Cloud Runtime & Health',
  title: '/health websocket counters track live /ws/kds and /ws/pos connections',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const kdsWs = await harness.wsConnect('/ws/kds', org.token, { branch_id: org.branch.id });
      const posWs = await harness.wsConnect('/ws/pos', org.token, { branch_id: org.branch.id });

      try {
        const openRes = await harness.request('/health');
        const openData = assertJson(openRes, 200);
        assert(openData.websocket.kdsConnections >= 1, 'Expected kdsConnections >= 1');
        assert(openData.websocket.posConnections >= 1, 'Expected posConnections >= 1');
        assert(openData.websocket.totalConnections >= 2, 'Expected totalConnections >= 2');
      } finally {
        await kdsWs.close();
        await posWs.close();
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      const closedRes = await harness.request('/health');
      const closedData = assertJson(closedRes, 200);
      assertEqual(closedData.websocket.kdsConnections, 0, 'Expected kdsConnections === 0 after close');
      assertEqual(closedData.websocket.posConnections, 0, 'Expected posConnections === 0 after close');
      assertEqual(closedData.websocket.totalConnections, 0, 'Expected totalConnections === 0 after close');
    });
  },
});

registerTest({
  id: 'f13:t1:cors-preflight-dev',
  tier: 1,
  feature: 'F13: Cloud Runtime & Health',
  title: 'OPTIONS preflight returns allowed methods and Access-Control-Allow-Origin',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const res = await harness.request('/api/orders', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,idempotency-key',
        },
      });
      assertStatus(res, [200, 204], 'OPTIONS /api/orders');
      const allowOrigin = res.headers.get('access-control-allow-origin') ?? '';
      assert(
        allowOrigin === 'http://localhost:3000' || allowOrigin === '*',
        `Unexpected Access-Control-Allow-Origin: ${allowOrigin}`,
      );
      const allowMethods = (res.headers.get('access-control-allow-methods') ?? '').toUpperCase();
      assert(allowMethods.includes('POST') && allowMethods.includes('PATCH'), `Unexpected allow-methods: ${allowMethods}`);
      const allowHeaders = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase();
      assert(
        allowHeaders.includes('authorization') && allowHeaders.includes('idempotency-key'),
        `Unexpected allow-headers: ${allowHeaders}`,
      );
    });
  },
});

registerTest({
  id: 'f13:t2:ready-503-short-jwt-secret',
  tier: 2,
  feature: 'F13: Cloud Runtime & Health',
  title: '/ready returns 503 SERVICE_CONFIGURATION_INCOMPLETE when JWT_SECRET < 32 chars',
  async run(): Promise<void> {
    await withRawBackendHealthOnly({ JWT_SECRET: 'too-short' }, async (baseUrl) => {
      const readyRes = await httpRequest(`${baseUrl}/ready`);
      assertJson(
        readyRes,
        503,
        (d) => d.status === 'not_ready' && d.code === 'SERVICE_CONFIGURATION_INCOMPLETE',
      );
    });
  },
});

registerTest({
  id: 'f13:t2:ready-503-duplicate-admin-secret',
  tier: 2,
  feature: 'F13: Cloud Runtime & Health',
  title: '/ready returns 503 SERVICE_CONFIGURATION_INCOMPLETE when PLATFORM_ADMIN_JWT_SECRET === JWT_SECRET',
  async run(): Promise<void> {
    const sharedSecret = crypto.randomBytes(32).toString('hex');
    await withRawBackendHealthOnly(
      { JWT_SECRET: sharedSecret, PLATFORM_ADMIN_JWT_SECRET: sharedSecret },
      async (baseUrl) => {
        const readyRes = await httpRequest(`${baseUrl}/ready`);
        assertJson(
          readyRes,
          503,
          (d) => d.status === 'not_ready' && d.code === 'SERVICE_CONFIGURATION_INCOMPLETE',
        );
      },
    );
  },
});

registerTest({
  id: 'f13:t2:backups-unauthenticated-401',
  tier: 2,
  feature: 'F13: Cloud Runtime & Health',
  title: '/api/admin/backups rejects missing and malformed Bearer tokens with 401',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const missingRes = await harness.request('/api/admin/backups');
      assertStatus(missingRes, 401, 'GET /api/admin/backups without token');

      const badRes = await harness.request('/api/admin/backups', {
        method: 'POST',
        token: 'bad.jwt.token',
      });
      assertStatus(badRes, 401, 'POST /api/admin/backups with malformed token');
    });
  },
});

registerTest({
  id: 'f13:t2:backups-revoked-token-401',
  tier: 2,
  feature: 'F13: Cloud Runtime & Health',
  title: '/api/admin/backups rejects revoked JWT after logout',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const logoutRes = await harness.request('/api/auth/logout', {
        method: 'POST',
        token: org.token,
      });
      assertStatus(logoutRes, 200, 'POST /api/auth/logout');

      const getRes = await harness.request('/api/admin/backups', { token: org.token });
      assertStatus(getRes, 401, 'GET /api/admin/backups with revoked token');

      const postRes = await harness.request('/api/admin/backups', {
        method: 'POST',
        token: org.token,
      });
      assertStatus(postRes, 401, 'POST /api/admin/backups with revoked token');
    });
  },
});

registerTest({
  id: 'f13:t2:backups-cross-tenant-owner-rejected',
  tier: 2,
  feature: 'F13: Cloud Runtime & Health',
  title: '/api/admin/backups rejects tenant owner and non-owner staff tokens',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const orgA = await harness.registerOrg({ clientIp: '10.13.1.1' });
      const orgB = await harness.registerOrg({ clientIp: '10.13.1.2' });

      const cashierEmail = `cashier-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
      const memberRes = await harness.request('/api/memberships', {
        method: 'POST',
        token: orgA.token,
        body: {
          email: cashierEmail,
          name: 'Org A Cashier',
          password: 'CashierPass123!',
          role: 'cashier',
          branch_id: orgA.branch.id,
        },
      });
      assertStatus(memberRes, 201, 'create cashier membership');
      const cashierLogin = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: cashierEmail, password: 'CashierPass123!' },
      });
      const cashierToken = assertJson(cashierLogin, 200).token as string;

      const cashierGet = await harness.request('/api/admin/backups', { token: cashierToken });
      assertStatus(cashierGet, [401, 403], 'cashier GET /api/admin/backups');

      const ownerBGet = await harness.request('/api/admin/backups', { token: orgB.token });
      assertStatus(ownerBGet, [401, 403], 'tenant owner GET /api/admin/backups must be rejected');

      const ownerBPost = await harness.request('/api/admin/backups', {
        method: 'POST',
        token: orgB.token,
      });
      assertStatus(ownerBPost, [401, 403], 'tenant owner POST /api/admin/backups must be rejected');
    });
  },
});

registerTest({
  id: 'f13:t2:static-path-traversal',
  tier: 2,
  feature: 'F13: Cloud Runtime & Health',
  title: 'Static server blocks .. and URL-encoded path traversal with 403 or 404',
  async run(): Promise<void> {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-e2e-static-trav-'));
    try {
      fs.writeFileSync(path.join(staticDir, 'index.html'), '<html>ok</html>', 'utf8');
      await withBackend({ env: { STATIC_WEB_DIR: staticDir } }, async (harness) => {
        const rawDotDot = await rawHttpGet(harness.port, '/../../package.json');
        assert(
          rawDotDot.status === 403 || rawDotDot.status === 404,
          `Expected 403 or 404 for /../../package.json, got ${rawDotDot.status} (body=${rawDotDot.body.slice(0, 200)})`,
        );
        assert(!rawDotDot.body.includes('"order-it-up"'), 'Path traversal leaked package.json');

        const encoded = await rawHttpGet(harness.port, '/%2e%2e/%2e%2e/package.json');
        assert(
          encoded.status === 403 || encoded.status === 404,
          `Expected 403 or 404 for /%2e%2e/%2e%2e/package.json, got ${encoded.status} (body=${encoded.body.slice(0, 200)})`,
        );
        assert(!encoded.body.includes('"order-it-up"'), 'Encoded path traversal leaked package.json');
      });
    } finally {
      await removeTempDirWithRetry(staticDir);
    }
  },
});

// ============================================================================
// Feature F14: Cloud Real-Time WebSockets (/ws/kds, /ws/pos) (5 T1, 6 T2)
// ============================================================================

registerTest({
  id: 'f14:t1:ws-query-token-and-ping-pong',
  tier: 1,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: '/ws/kds and /ws/pos connect via ?token=, emit connected, and reply pong',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const kds = await harness.wsConnect('/ws/kds', org.token, { branch_id: org.branch.id });
      const pos = await harness.wsConnect('/ws/pos', org.token, { branch_id: org.branch.id });
      try {
        assertEqual(kds.connected?.channel, 'kds');
        assertEqual(kds.connected?.orgId, org.tenant.id);
        assertEqual(kds.connected?.branchId, org.branch.id);

        assertEqual(pos.connected?.channel, 'pos');
        assertEqual(pos.connected?.orgId, org.tenant.id);
        assertEqual(pos.connected?.branchId, org.branch.id);

        kds.send({ type: 'ping' });
        const kdsPong = await kds.waitForMessage((m) => m?.type === 'pong', 5000);
        assert(typeof kdsPong.timestamp === 'string' && !Number.isNaN(Date.parse(kdsPong.timestamp)));

        pos.send({ type: 'ping' });
        const posPong = await pos.waitForMessage((m) => m?.type === 'pong', 5000);
        assert(typeof posPong.timestamp === 'string' && !Number.isNaN(Date.parse(posPong.timestamp)));
      } finally {
        await kds.close();
        await pos.close();
      }
    });
  },
});

registerTest({
  id: 'f14:t1:ws-bearer-header-upgrade',
  tier: 1,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: '/ws/kds accepts Authorization: Bearer <jwt> handshake header',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const ws = await wsConnectWithHeaders(
        `ws://127.0.0.1:${harness.port}/ws/kds?branch_id=${encodeURIComponent(org.branch.id)}`,
        { Authorization: `Bearer ${org.token}` },
      );
      try {
        assertEqual(ws.connected?.type, 'connected');
        assertEqual(ws.connected?.channel, 'kds');
        assertEqual(ws.connected?.orgId, org.tenant.id);
        assertEqual(ws.connected?.branchId, org.branch.id);
      } finally {
        await ws.close();
      }
    });
  },
});

registerTest({
  id: 'f14:t1:order-create-and-update-broadcast',
  tier: 1,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'POST /api/orders broadcasts order:created and PATCH /api/orders/:id/status broadcasts order:updated',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstProduct(harness, org.token);
      const kds = await harness.wsConnect('/ws/kds', org.token, { branch_id: org.branch.id });
      const pos = await harness.wsConnect('/ws/pos', org.token, { branch_id: org.branch.id });

      try {
        const createRes = await harness.request('/api/orders', {
          method: 'POST',
          token: org.token,
          body: {
            branch_id: org.branch.id,
            order_type: 'takeaway',
            items: [{ product_id: product.id, quantity: 1 }],
          },
        });
        const created = assertJson(createRes, 201, (d) => typeof d.order?.id === 'string');
        const orderId = created.order.id as string;

        const kdsCreated = await kds.waitForMessage((m) => m?.type === 'order:created', 5000);
        const posCreated = await pos.waitForMessage((m) => m?.type === 'order:created', 5000);
        assertEqual(kdsCreated.orgId, org.tenant.id);
        assertEqual(kdsCreated.payload?.data?.order?.id, orderId);
        assertEqual(posCreated.payload?.data?.order?.id, orderId);

        const updateRes = await harness.request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
          method: 'PATCH',
          token: org.token,
          body: { status: 'completed', expected_version: 1 },
        });
        assertStatus(updateRes, 200, 'PATCH /api/orders/:id/status');

        const kdsUpdated = await kds.waitForMessage((m) => m?.type === 'order:updated', 5000);
        const posUpdated = await pos.waitForMessage((m) => m?.type === 'order:updated', 5000);
        assertEqual(kdsUpdated.orgId, org.tenant.id);
        assertEqual(posUpdated.orgId, org.tenant.id);
      } finally {
        await kds.close();
        await pos.close();
      }
    });
  },
});

registerTest({
  id: 'f14:t1:kds-ticket-broadcast',
  tier: 1,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'PATCH /api/kitchen/tickets/:id/status broadcasts kds:ticket_updated',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      const product = await getFirstProduct(harness, org.token);

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const orderData = assertJson(orderRes, 201, (d) => typeof d.order?.kitchen_ticket_id === 'string');
      const ticketId = orderData.order.kitchen_ticket_id as string;

      const kds = await harness.wsConnect('/ws/kds', org.token, { branch_id: org.branch.id });
      try {
        const patchRes = await harness.request(`/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`, {
          method: 'PATCH',
          token: org.token,
          body: { status: 'preparing' },
        });
        assertStatus(patchRes, 200, 'PATCH /api/kitchen/tickets/:id/status');

        const msg = await kds.waitForMessage((m) => m?.type === 'kds:ticket_updated', 3000);
        assertEqual(msg.orgId, org.tenant.id);
        assertEqual(msg.branchId, org.branch.id);
        assertEqual(msg.payload?.data?.ticket?.status, 'preparing');
      } finally {
        await kds.close();
      }
    });
  },
});

registerTest({
  id: 'f14:t1:qr-order-and-pos-sync-broadcast',
  tier: 1,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'POST /api/qr/order broadcasts order:created and POST /api/pos/events broadcasts sync event',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      const product = await getFirstProduct(harness, org.token);

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-WS-1', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const qrCodeRes = await harness.request(`/api/qr/tables/${encodeURIComponent(tableId)}/code`, {
        token: org.token,
      });
      const tableToken = assertJson(qrCodeRes, 200).table_token as string;

      const pinRes = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'WS Sync POS' },
      });
      const code = assertJson(pinRes, 200).code as string;
      const pairRes = await harness.request('/api/pos/pair', {
        method: 'POST',
        body: { code },
      });
      const terminalToken = assertJson(pairRes, 200).terminal_token as string;

      const kds = await harness.wsConnect('/ws/kds', org.token, { branch_id: org.branch.id });
      const pos = await harness.wsConnect('/ws/pos', org.token, { branch_id: org.branch.id });
      try {
        const qrOrderRes = await harness.request('/api/qr/order', {
          method: 'POST',
          token: tableToken,
          idempotencyKey: `qr_ws_idem_${crypto.randomBytes(8).toString('hex')}`,
          headers: { 'X-Real-IP': '10.14.1.1' },
          body: {
            table_id: tableId,
            items: [{ product_id: product.id, quantity: 1 }],
          },
        });
        const qrOrder = assertJson(qrOrderRes, 201);
        const qrOrderId = qrOrder.order.id as string;

        const qrWsKds = await kds.waitForMessage(
          (m) => m?.type === 'order:created' && m?.payload?.data?.order?.id === qrOrderId,
          5000,
        );
        assertEqual(qrWsKds.orgId, org.tenant.id);
        assertEqual(qrWsKds.branchId, org.branch.id);

        const qrWsPos = await pos.waitForMessage(
          (m) => m?.type === 'order:created' && m?.payload?.data?.order?.id === qrOrderId,
          5000,
        );
        assertEqual(qrWsPos.orgId, org.tenant.id);
        assertEqual(qrWsPos.branchId, org.branch.id);

        const posOrderId = crypto.randomUUID();
        const syncRes = await harness.request('/api/pos/events', {
          method: 'POST',
          token: terminalToken,
          body: {
            events: [
              {
                id: `evt_ws_${crypto.randomBytes(4).toString('hex')}`,
                type: 'order.created',
                payload: {
                  id: posOrderId,
                  order_number: 'POS-WS-1',
                  subtotal: 100,
                  tax_total: 5,
                  grand_total: 105,
                  status: 'active',
                  ordered_at: new Date(Date.now() - 2000).toISOString(),
                  items: [{ id: `item_${posOrderId}`, product_name: 'Chai', quantity: 1, unit_price: 100, subtotal: 100 }],
                },
              },
            ],
          },
        });
        assertJson(syncRes, 200, (d) => d.success === true && d.processed_count === 1);

        const syncWs = await pos.waitForMessage(
          (m) =>
            ['order:created', 'order:updated', 'pos:sync'].includes(String(m?.type)) &&
            (m?.payload?.path === '/api/pos/events' || m?.payload?.data?.order?.id === posOrderId),
          3000,
        );
        assertEqual(syncWs.orgId, org.tenant.id);
        assertEqual(syncWs.branchId, org.branch.id);
      } finally {
        await kds.close();
        await pos.close();
      }
    });
  },
});

registerTest({
  id: 'f14:t2:ws-missing-and-bad-jwt-401',
  tier: 2,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: '/ws/kds and /ws/pos reject missing, malformed, and wrong-secret JWTs with 401',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const wrongSecretJwt = createSignedJwtWithWrongSecret(org.tenant.id, org.user.id, org.branch.id);

      for (const wsPath of ['/ws/kds', '/ws/pos']) {
        const missing = await expectWsRejectedStatus(`ws://127.0.0.1:${harness.port}${wsPath}`, 401);
        assertEqual(missing, 401, `missing token on ${wsPath}`);

        const bad = await expectWsRejectedStatus(`ws://127.0.0.1:${harness.port}${wsPath}?token=invalid`, 401);
        assertEqual(bad, 401, `malformed token on ${wsPath}`);

        const wrong = await expectWsRejectedStatus(
          `ws://127.0.0.1:${harness.port}${wsPath}?token=${encodeURIComponent(wrongSecretJwt)}`,
          401,
        );
        assertEqual(wrong, 401, `wrong-secret JWT on ${wsPath}`);
      }
    });
  },
});

registerTest({
  id: 'f14:t2:ws-unknown-path-404',
  tier: 2,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'Unknown WebSocket upgrade path returns 404',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const status = await expectWsRejectedStatus(
        `ws://127.0.0.1:${harness.port}/ws/unknown?token=${encodeURIComponent(org.token)}`,
        404,
      );
      assertEqual(status, 404, 'Expected 404 on unknown WS path');
    });
  },
});

registerTest({
  id: 'f14:t2:ws-revoked-token-401',
  tier: 2,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'Revoked JWT after POST /api/auth/logout is rejected on WS upgrade',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const logoutRes = await harness.request('/api/auth/logout', {
        method: 'POST',
        token: org.token,
      });
      assertStatus(logoutRes, 200);

      for (const wsPath of ['/ws/kds', '/ws/pos']) {
        const status = await expectWsRejectedStatus(
          `ws://127.0.0.1:${harness.port}${wsPath}?token=${encodeURIComponent(org.token)}`,
          401,
        );
        assertEqual(status, 401, `revoked token on ${wsPath}`);
      }
    });
  },
});

registerTest({
  id: 'f14:t2:ws-cross-branch-isolation',
  tier: 2,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'Branch-scoped user cannot subscribe to ?branch_id=<otherBranch> (403)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'enterprise');

      const branch2Res = await harness.request('/api/branches', {
        method: 'POST',
        token: org.token,
        body: { name: 'Second Outlet', code: 'BR-02' },
      });
      const branch2Id = assertJson(branch2Res, 201).branch_id as string;

      const cashierEmail = `b1-cashier-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
      const memRes = await harness.request('/api/memberships', {
        method: 'POST',
        token: org.token,
        body: {
          email: cashierEmail,
          name: 'Branch 1 Cashier',
          password: 'CashierPass123!',
          role: 'cashier',
          branch_id: org.branch.id,
        },
      });
      assertStatus(memRes, 201);

      const loginRes = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: cashierEmail, password: 'CashierPass123!' },
      });
      const cashierToken = assertJson(loginRes, 200).token as string;

      const status = await expectWsRejectedStatus(
        `ws://127.0.0.1:${harness.port}/ws/kds?token=${encodeURIComponent(cashierToken)}&branch_id=${encodeURIComponent(branch2Id)}`,
        403,
      );
      assertEqual(status, 403, 'Expected 403 when branch-1 user subscribes to branch-2 WS');
    });
  },
});

registerTest({
  id: 'f14:t2:ws-branch-broadcast-scoping',
  tier: 2,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'Order created on Branch 1 does not broadcast to Branch 2 WS client of same org',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'enterprise');
      const product = await getFirstProduct(harness, org.token);

      const branch2Res = await harness.request('/api/branches', {
        method: 'POST',
        token: org.token,
        body: { name: 'Branch Two', code: 'BR-02' },
      });
      const branch2Id = assertJson(branch2Res, 201).branch_id as string;

      const wsBranch1 = await harness.wsConnect('/ws/kds', org.token, { branch_id: org.branch.id });
      const wsBranch2 = await harness.wsConnect('/ws/kds', org.token, { branch_id: branch2Id });
      try {
        const orderRes = await harness.request('/api/orders', {
          method: 'POST',
          token: org.token,
          body: {
            branch_id: org.branch.id,
            order_type: 'takeaway',
            items: [{ product_id: product.id, quantity: 1 }],
          },
        });
        assertStatus(orderRes, 201);

        const b1Msg = await wsBranch1.waitForMessage((m) => m?.type === 'order:created', 5000);
        assertEqual(b1Msg.branchId, org.branch.id);

        const b2Frames = await wsBranch2.collectMessages(400);
        assertEqual(b2Frames.length, 0, `Expected 0 frames on branch 2 WS, got ${JSON.stringify(b2Frames)}`);
      } finally {
        await wsBranch1.close();
        await wsBranch2.close();
      }
    });
  },
});

registerTest({
  id: 'f14:t2:ws-cross-org-isolation',
  tier: 2,
  feature: 'F14: Cloud Real-Time WebSockets',
  title: 'Org A mutations never leak to Org B WS clients',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const orgA = await harness.registerOrg({ clientIp: '10.14.2.1' });
      const orgB = await harness.registerOrg({ clientIp: '10.14.2.2' });
      const productA = await getFirstProduct(harness, orgA.token);

      const orgBKds = await harness.wsConnect('/ws/kds', orgB.token, { branch_id: orgB.branch.id });
      const orgBPos = await harness.wsConnect('/ws/pos', orgB.token, { branch_id: orgB.branch.id });
      try {
        const orderRes = await harness.request('/api/orders', {
          method: 'POST',
          token: orgA.token,
          body: {
            branch_id: orgA.branch.id,
            order_type: 'takeaway',
            items: [{ product_id: productA.id, quantity: 1 }],
          },
        });
        assertStatus(orderRes, 201);

        const [kdsFrames, posFrames] = await Promise.all([
          orgBKds.collectMessages(400),
          orgBPos.collectMessages(400),
        ]);
        assertEqual(kdsFrames.length, 0, 'Org B KDS WS received Org A event');
        assertEqual(posFrames.length, 0, 'Org B POS WS received Org A event');
      } finally {
        await orgBKds.close();
        await orgBPos.close();
      }
    });
  },
});

// ============================================================================
// Feature F15: Cloud Auth, Registration, Orgs & Pilots (6 Tier 1, 7 Tier 2)
// ============================================================================

registerTest({
  id: 'f15:t1:setup-status-and-register-login-me',
  tier: 1,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'setup/status, register, login, me full auth lifecycle',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const statusRes = await harness.request('/api/auth/setup/status');
      assertJson(
        statusRes,
        200,
        (d) => d.needsSetup === false && d.masterPinAvailable === false && d.mode === 'cloud_saas',
      );

      const reg = await harness.registerOrg({
        restaurantName: 'Cloud Lifecycle Kitchen',
        ownerName: 'Lifecycle Owner',
      });
      assertEqual(reg.tenant?.plan, 'starter');
      assertEqual(reg.tenant?.status, 'trial');

      const me1 = await harness.request('/api/auth/me', { token: reg.token });
      assertJson(
        me1,
        200,
        (d) => d.user?.email === reg.email && d.tenant?.id === reg.tenant.id,
      );

      const loginRes = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: reg.email, password: reg.password },
      });
      const loginData = assertJson(
        loginRes,
        200,
        (d) => typeof d.token === 'string' && d.user?.email === reg.email && d.tenant?.id === reg.tenant.id,
      );

      const me2 = await harness.request('/api/auth/me', { token: loginData.token });
      assertJson(me2, 200, (d) => d.user?.id === reg.user.id && d.tenant?.id === reg.tenant.id);
    });
  },
});

registerTest({
  id: 'f15:t1:refresh-token-rotation',
  tier: 1,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'POST /api/auth/refresh issues valid rotated JWT while session is active',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const refreshRes = await harness.request('/api/auth/refresh', {
        method: 'POST',
        token: org.token,
      });
      const refreshed = assertJson(
        refreshRes,
        200,
        (d) =>
          typeof d.access_token === 'string' &&
          d.access_token.length > 20 &&
          typeof d.token === 'string' &&
          d.expires_in === 604800 &&
          d.user?.id === org.user.id,
      );

      const meRes = await harness.request('/api/auth/me', { token: refreshed.access_token });
      assertJson(meRes, 200, (d) => d.user?.id === org.user.id);
    });
  },
});

registerTest({
  id: 'f15:t1:enterprise-restaurants-and-branches',
  tier: 1,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'Enterprise org creates second restaurant concept and second branch',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'enterprise');

      const restRes = await harness.request('/api/restaurants', {
        method: 'POST',
        token: org.token,
        body: { name: 'Second Concept Diner', concept_type: 'finedine' },
      });
      const restData = assertJson(
        restRes,
        201,
        (d) => d.success === true && d.restaurant?.name === 'Second Concept Diner',
      );

      const branchRes = await harness.request('/api/branches', {
        method: 'POST',
        token: org.token,
        body: {
          name: 'Indiranagar Outlet',
          code: 'BR-02',
          restaurant_id: restData.restaurant.id,
        },
      });
      const branchData = assertJson(
        branchRes,
        201,
        (d) => d.success === true && typeof d.branch_id === 'string' && d.branch?.name === 'Indiranagar Outlet',
      );

      const listRest = await harness.request('/api/restaurants', { token: org.token });
      const rests = assertJson(listRest, 200, (d) => Array.isArray(d.restaurants));
      assert(rests.restaurants.some((r: { id: string }) => r.id === restData.restaurant.id));

      const listBranches = await harness.request('/api/branches', { token: org.token });
      const branches = assertJson(listBranches, 200, (d) => Array.isArray(d.branches));
      assert(branches.branches.some((b: { id: string }) => b.id === branchData.branch_id));
    });
  },
});

registerTest({
  id: 'f15:t1:memberships-crud-and-staff-login',
  tier: 1,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'Owner grants branch cashier membership with password, staff logs in, owner revokes',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const staffEmail = `staff-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
      const createRes = await harness.request('/api/memberships', {
        method: 'POST',
        token: org.token,
        body: {
          email: staffEmail,
          name: 'Floor Cashier',
          password: 'StaffPassword123!',
          role: 'cashier',
          branch_id: org.branch.id,
        },
      });
      const created = assertJson(
        createRes,
        201,
        (d) => d.success === true && typeof d.membership_id === 'string',
      );

      const staffLogin = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: staffEmail, password: 'StaffPassword123!' },
      });
      assertJson(staffLogin, 200, (d) => d.user?.email === staffEmail && typeof d.token === 'string');

      const listRes = await harness.request('/api/memberships', { token: org.token });
      const listed = assertJson(listRes, 200, (d) => Array.isArray(d.memberships));
      assert(
        listed.memberships.some((m: { id: string; role: string }) => m.id === created.membership_id && m.role === 'cashier'),
        'Expected created cashier membership in GET /api/memberships',
      );

      const delRes = await harness.request(`/api/memberships/${encodeURIComponent(created.membership_id)}`, {
        method: 'DELETE',
        token: org.token,
      });
      assertJson(delRes, 200, (d) => d.success === true);
    });
  },
});

registerTest({
  id: 'f15:t1:pilot-request-approve-redeem',
  tier: 1,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'Public pilot request -> platform admin approval & invitation -> redeem creates org',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const pilotEmail = `pilot-${crypto.randomBytes(4).toString('hex')}@e2e.local`;
      const reqRes = await harness.request('/api/pilot-requests', {
        method: 'POST',
        body: {
          contact_name: 'Pilot Founder',
          restaurant_name: 'Pilot Cafe',
          email: pilotEmail,
          country: 'IN',
          restaurant_type: 'cafe',
          outlet_count: 2,
          consent: true,
        },
      });
      const pilotReq = assertJson(
        reqRes,
        201,
        (d) => d.ok === true && typeof d.request?.id === 'string',
      );
      const reqId = pilotReq.request.id as string;

      const adminToken = await harness.platformAdminLogin();
      const approveRes = await harness.request(`/api/platform-admin/pilot-requests/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'approved',
          reason: 'Approved for E2E pilot workflow test',
        },
      });
      assertJson(approveRes, 200, (d) => d.ok === true && d.request?.status === 'approved');

      const inviteRes = await harness.request(
        `/api/platform-admin/pilot-requests/${encodeURIComponent(reqId)}/invitation`,
        {
          method: 'POST',
          token: adminToken,
        },
      );
      const inviteData = assertJson(
        inviteRes,
        201,
        (d) => d.ok === true && /^[a-f0-9]{64}$/.test(String(d.invitation?.token)),
      );

      const redeemRes = await harness.request('/api/pilot-invitations/redeem', {
        method: 'POST',
        body: {
          token: inviteData.invitation.token,
          password: 'PilotPassword123!',
        },
      });
      assertJson(
        redeemRes,
        201,
        (d) =>
          typeof d.token === 'string' &&
          d.user?.email === pilotEmail &&
          typeof d.tenant?.id === 'string' &&
          typeof d.branch?.id === 'string',
      );
    });
  },
});

registerTest({
  id: 'f15:t1:setup-demo-dev',
  tier: 1,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'POST /api/auth/setup-demo seeds TasteCraft demo org on empty development DB',
  async run(): Promise<void> {
    await withBackend({ env: { ENVIRONMENT: 'development' } }, async (harness) => {
      const setup1 = await harness.request('/api/auth/setup-demo', { method: 'POST' });
      assertJson(setup1, 200, (d) => d.success === true);

      const loginRes = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: 'owner@tastecraft.com', password: 'admin123' },
      });
      assertJson(loginRes, 200, (d) => typeof d.token === 'string' && d.user?.email === 'owner@tastecraft.com');

      const setup2 = await harness.request('/api/auth/setup-demo', { method: 'POST' });
      assertJson(
        setup2,
        200,
        (d) => typeof d.message === 'string' && d.message.toLowerCase().includes('already initialized'),
      );
    });
  },
});

registerTest({
  id: 'f15:t2:register-disabled-403',
  tier: 2,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'POST /api/auth/register returns 403 PILOT_ACCESS_REQUIRED when ALLOW_SELF_SERVICE_REGISTRATION=false',
  async run(): Promise<void> {
    await withBackend({ env: { ALLOW_SELF_SERVICE_REGISTRATION: 'false' } }, async (harness) => {
      const res = await harness.request('/api/auth/register', {
        method: 'POST',
        body: {
          restaurant_name: 'Blocked Bistro',
          owner_name: 'Blocked Owner',
          email: `blocked-${crypto.randomBytes(3).toString('hex')}@e2e.local`,
          password: 'Password123!',
        },
      });
      assertJson(res, 403, (d) => d.code === 'PILOT_ACCESS_REQUIRED');
    });
  },
});

registerTest({
  id: 'f15:t2:setup-demo-production-403',
  tier: 2,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'POST /api/auth/setup-demo returns 403 when ENVIRONMENT=production',
  async run(): Promise<void> {
    await withBackend({ env: { ENVIRONMENT: 'production' } }, async (harness) => {
      const res = await harness.request('/api/auth/setup-demo', { method: 'POST' });
      assertJson(res, 403, (d) => typeof d.error === 'string' && d.error.includes('disabled'));
    });
  },
});

registerTest({
  id: 'f15:t2:logout-revokes-token',
  tier: 2,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'POST /api/auth/logout revokes JWT across /api/auth/me, /api/auth/refresh, and /api/orders',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const logoutRes = await harness.request('/api/auth/logout', {
        method: 'POST',
        token: org.token,
      });
      assertStatus(logoutRes, 200);

      const meRes = await harness.request('/api/auth/me', { token: org.token });
      assertStatus(meRes, 401, 'GET /api/auth/me after logout');

      const refreshRes = await harness.request('/api/auth/refresh', {
        method: 'POST',
        token: org.token,
      });
      assertStatus(refreshRes, 401, 'POST /api/auth/refresh after logout');

      const ordersRes = await harness.request('/api/orders', { token: org.token });
      assertStatus(ordersRes, 401, 'GET /api/orders after logout');
    });
  },
});

registerTest({
  id: 'f15:t2:refresh-suspended-sub-rejected',
  tier: 2,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'POST /api/auth/refresh and /api/auth/login reject suspended subscription with 402',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const adminToken = await harness.platformAdminLogin();
      const suspendRes = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/subscription`,
        {
          method: 'PATCH',
          token: adminToken,
          body: {
            plan_code: 'starter',
            status: 'suspended',
            reason: 'E2E suspended subscription rejection test',
          },
        },
      );
      assertStatus(suspendRes, 200);

      const loginRes = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: org.email, password: org.password },
      });
      assertStatus(loginRes, 402, 'login with suspended subscription');

      const refreshRes = await harness.request('/api/auth/refresh', {
        method: 'POST',
        token: org.token,
      });
      assertStatus(refreshRes, 402, 'refresh with suspended subscription');
    });
  },
});

registerTest({
  id: 'f15:t2:refresh-revoked-membership-rejected',
  tier: 2,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'POST /api/auth/refresh rejects user whose membership was revoked',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const cashierEmail = `revoked-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
      const createRes = await harness.request('/api/memberships', {
        method: 'POST',
        token: org.token,
        body: {
          email: cashierEmail,
          name: 'Temp Cashier',
          password: 'CashierPass123!',
          role: 'cashier',
          branch_id: org.branch.id,
        },
      });
      const membershipId = assertJson(createRes, 201).membership_id as string;

      const loginRes = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: cashierEmail, password: 'CashierPass123!' },
      });
      const tokenC = assertJson(loginRes, 200).token as string;

      const delRes = await harness.request(`/api/memberships/${encodeURIComponent(membershipId)}`, {
        method: 'DELETE',
        token: org.token,
      });
      assertStatus(delRes, 200);

      const ordersRes = await harness.request('/api/orders', { token: tokenC });
      assertStatus(ordersRes, 403, 'GET /api/orders after membership revocation');

      const refreshRes = await harness.request('/api/auth/refresh', {
        method: 'POST',
        token: tokenC,
      });
      assertStatus(refreshRes, 403, 'POST /api/auth/refresh after membership revocation');
    });
  },
});

registerTest({
  id: 'f15:t2:starter-multioutlet-gated-403',
  tier: 2,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'starter and pro plans block POST /api/restaurants and POST /api/branches with 403 PLAN_FEATURE_REQUIRED',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();

      const starterRest = await harness.request('/api/restaurants', {
        method: 'POST',
        token: org.token,
        body: { name: 'Blocked Concept' },
      });
      assertJson(starterRest, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'multiOutlet');

      const starterBranch = await harness.request('/api/branches', {
        method: 'POST',
        token: org.token,
        body: { name: 'Blocked Branch' },
      });
      assertJson(starterBranch, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'multiOutlet');

      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const proRest = await harness.request('/api/restaurants', {
        method: 'POST',
        token: org.token,
        body: { name: 'Blocked Concept Pro' },
      });
      assertJson(proRest, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'multiOutlet');

      const proBranch = await harness.request('/api/branches', {
        method: 'POST',
        token: org.token,
        body: { name: 'Blocked Branch Pro' },
      });
      assertJson(proBranch, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'multiOutlet');
    });
  },
});

registerTest({
  id: 'f15:t2:pilot-invitation-single-use-410',
  tier: 2,
  feature: 'F15: Cloud Auth, Orgs & Pilots',
  title: 'Pilot invitation token cannot be redeemed twice (410) and rejects invalid/short tokens',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const pilotEmail = `singleuse-${crypto.randomBytes(4).toString('hex')}@e2e.local`;
      const reqRes = await harness.request('/api/pilot-requests', {
        method: 'POST',
        body: {
          contact_name: 'Single Use Pilot',
          restaurant_name: 'Single Use Cafe',
          email: pilotEmail,
          country: 'IN',
          restaurant_type: 'qsr',
          outlet_count: 1,
          consent: true,
        },
      });
      const reqId = assertJson(reqRes, 201).request.id as string;

      const adminToken = await harness.platformAdminLogin();
      const approveRes = await harness.request(`/api/platform-admin/pilot-requests/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'approved', reason: 'Approve for single-use invitation test' },
      });
      assertStatus(approveRes, 200);

      const inviteRes = await harness.request(
        `/api/platform-admin/pilot-requests/${encodeURIComponent(reqId)}/invitation`,
        { method: 'POST', token: adminToken },
      );
      const token = assertJson(inviteRes, 201).invitation.token as string;

      const firstRedeem = await harness.request('/api/pilot-invitations/redeem', {
        method: 'POST',
        body: { token, password: 'ValidPassword123!' },
      });
      assertStatus(firstRedeem, 201, 'first pilot invitation redeem');

      const secondRedeem = await harness.request('/api/pilot-invitations/redeem', {
        method: 'POST',
        body: { token, password: 'ValidPassword123!' },
      });
      assertStatus(secondRedeem, 410, 'second pilot invitation redeem');

      const unknownHex = 'a'.repeat(64);
      const unknownRedeem = await harness.request('/api/pilot-invitations/redeem', {
        method: 'POST',
        body: { token: unknownHex, password: 'ValidPassword123!' },
      });
      assertStatus(unknownRedeem, 410, 'unknown 64-hex invitation token');

      const badFormatRedeem = await harness.request('/api/pilot-invitations/redeem', {
        method: 'POST',
        body: { token: 'not-a-64-hex-token', password: 'ValidPassword123!' },
      });
      assertStatus(badFormatRedeem, 400, 'malformed invitation token');
    });
  },
});

// ============================================================================
// Feature F16: Cloud Terminal Pairing, POS Sync & Public QR (6 Tier 1, 7 Tier 2)
// ============================================================================

registerTest({
  id: 'f16:t1:pairing-generate-claim-disconnect',
  tier: 1,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'pro org generates 6-digit PIN, terminal claims token, terminal disconnects',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const genRes = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'Front Counter 1' },
      });
      const genData = assertJson(
        genRes,
        200,
        (d) => /^\d{6}$/.test(String(d.code)) && d.branch_id === org.branch.id && typeof d.expires_at === 'string',
      );

      const pairRes = await harness.request('/api/pos/pair', {
        method: 'POST',
        body: { code: genData.code, app_version: '2.0.0' },
      });
      const pairData = assertJson(
        pairRes,
        200,
        (d) =>
          d.success === true &&
          typeof d.terminal_id === 'string' &&
          typeof d.terminal_token === 'string' &&
          d.terminal_token.startsWith('pos_') &&
          d.organization_id === org.tenant.id &&
          d.branch_id === org.branch.id,
      );

      const discRes = await harness.request('/api/pos/disconnect', {
        method: 'POST',
        token: pairData.terminal_token,
      });
      assertJson(discRes, 200, (d) => d.success === true);
    });
  },
});

registerTest({
  id: 'f16:t1:pos-events-order-payment-closure',
  tier: 1,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'POST /api/pos/events ingests order.created, payment.settled, and closure.recorded batches',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const pinRes = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'Sync POS' },
      });
      const code = assertJson(pinRes, 200).code as string;
      const pairRes = await harness.request('/api/pos/pair', {
        method: 'POST',
        body: { code },
      });
      const terminalToken = assertJson(pairRes, 200).terminal_token as string;

      const orderId = crypto.randomUUID();
      const closureId = crypto.randomUUID();
      const nowIso = new Date(Date.now() - 2000).toISOString();
      const evOrder = `ev_ord_${crypto.randomBytes(4).toString('hex')}`;
      const evPay = `ev_pay_${crypto.randomBytes(4).toString('hex')}`;
      const evCls = `ev_cls_${crypto.randomBytes(4).toString('hex')}`;

      const syncRes = await harness.request('/api/pos/events', {
        method: 'POST',
        token: terminalToken,
        body: {
          sent_at: new Date().toISOString(),
          events: [
            {
              id: evOrder,
              type: 'order.created',
              payload: {
                id: orderId,
                order_number: 'POS-1001',
                order_type: 'dine_in',
                status: 'completed',
                subtotal: 200,
                tax_total: 10,
                discount_total: 0,
                grand_total: 210,
                payment_method: 'cash',
                ordered_at: nowIso,
                items: [
                  {
                    id: `item_${orderId}`,
                    product_name: 'Masala Chai',
                    quantity: 2,
                    unit_price: 100,
                    subtotal: 200,
                    tax_amount: 10,
                  },
                ],
              },
            },
            {
              id: evPay,
              type: 'payment.settled',
              payload: {
                order_id: orderId,
                amount: 210,
                payment_method: 'cash',
                payment_id: `pay_${orderId}`,
                idempotency_key: `idem_${orderId}`,
              },
            },
            {
              id: evCls,
              type: 'closure.recorded',
              payload: {
                id: closureId,
                closure_date: new Date().toISOString().slice(0, 10),
                opening_cash: 500,
                cash_sales: 210,
                card_sales: 0,
                upi_sales: 0,
                other_sales: 0,
                expected_cash: 710,
                actual_cash: 710,
                variance: 0,
              },
            },
          ],
        },
      });
      assertJson(
        syncRes,
        200,
        (d) =>
          d.success === true &&
          d.processed_count === 3 &&
          d.failed_count === 0 &&
          Array.isArray(d.synced_ids) &&
          d.synced_ids.includes(evOrder) &&
          d.synced_ids.includes(evPay) &&
          d.synced_ids.includes(evCls),
      );

      const ordersRes = await harness.request(`/api/orders?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      const ordersData = assertJson(ordersRes, 200, (d) => Array.isArray(d.orders));
      const synced = ordersData.orders.find((o: { id: string }) => o.id === orderId);
      assert(synced, 'Expected synced order to appear in GET /api/orders');
      assertEqual(synced.payment_status, 'paid');
    });
  },
});

registerTest({
  id: 'f16:t1:pos-events-idempotent-replay',
  tier: 1,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'POST /api/pos/events replays identical event ID + payload idempotently',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const pinRes = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'Replay POS' },
      });
      const code = assertJson(pinRes, 200).code as string;
      const pairRes = await harness.request('/api/pos/pair', { method: 'POST', body: { code } });
      const terminalToken = assertJson(pairRes, 200).terminal_token as string;

      const eventId = `ev_replay_${crypto.randomBytes(4).toString('hex')}`;
      const orderId = crypto.randomUUID();
      const body = {
        events: [
          {
            id: eventId,
            type: 'order.created',
            payload: {
              id: orderId,
              order_number: 'POS-REP-1',
              subtotal: 100,
              tax_total: 5,
              grand_total: 105,
              status: 'completed',
              ordered_at: new Date(Date.now() - 2000).toISOString(),
            },
          },
        ],
      };

      const r1 = await harness.request('/api/pos/events', { method: 'POST', token: terminalToken, body });
      assertJson(
        r1,
        200,
        (d) => d.success === true && d.processed_count === 1 && d.failed_count === 0 && d.synced_ids?.[0] === eventId,
      );

      const r2 = await harness.request('/api/pos/events', { method: 'POST', token: terminalToken, body });
      assertJson(
        r2,
        200,
        (d) => d.success === true && d.processed_count === 1 && d.failed_count === 0 && d.synced_ids?.[0] === eventId,
      );
    });
  },
});

registerTest({
  id: 'f16:t1:pos-catalog-snapshot',
  tier: 1,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'GET /api/pos/catalog returns branch categories, products, and snapshot_at',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const catRes = await harness.request('/api/categories', {
        method: 'POST',
        token: org.token,
        body: { name: 'Snap Beverages' },
      });
      const catId = assertJson(catRes, 201).category.id as string;

      const prodRes = await harness.request('/api/products', {
        method: 'POST',
        token: org.token,
        body: { name: 'Filter Coffee', price: 95, category_id: catId, tax_rate: 5 },
      });
      const prodId = assertJson(prodRes, 201).id as string;

      const pinRes = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'Catalog POS' },
      });
      const code = assertJson(pinRes, 200).code as string;
      const pairRes = await harness.request('/api/pos/pair', { method: 'POST', body: { code } });
      const terminalToken = assertJson(pairRes, 200).terminal_token as string;

      const snapRes = await harness.request('/api/pos/catalog', { token: terminalToken });
      const snap = assertJson(
        snapRes,
        200,
        (d) =>
          d.branch_id === org.branch.id &&
          Array.isArray(d.categories) &&
          Array.isArray(d.products) &&
          typeof d.snapshot_at === 'string',
      );
      const found = snap.products.find((p: { id: string }) => p.id === prodId);
      assert(found, 'Expected created product in GET /api/pos/catalog');
      assertEqual(Number(found.effective_price), 95);
    });
  },
});

registerTest({
  id: 'f16:t1:public-qr-full-flow',
  tier: 1,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'Table QR code -> public menu -> idempotent QR order -> order tracking',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      const product = await getFirstProduct(harness, org.token);

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'QR-1', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const qrCodeRes = await harness.request(`/api/qr/tables/${encodeURIComponent(tableId)}/code`, {
        token: org.token,
      });
      const qrCode = assertJson(
        qrCodeRes,
        200,
        (d) =>
          d.success === true &&
          /^[a-f0-9]{64}$/.test(String(d.table_token)) &&
          typeof d.qr_url === 'string' &&
          d.qr_url.includes(tableId),
      );

      const menuRes = await harness.request(`/api/qr/menu?table_id=${encodeURIComponent(tableId)}`, {
        token: qrCode.table_token,
      });
      assertJson(
        menuRes,
        200,
        (d) =>
          d.ok === true &&
          d.table?.id === tableId &&
          Array.isArray(d.products) &&
          d.products.some((p: { id: string }) => p.id === product.id),
      );

      const orderRes = await harness.request('/api/qr/order', {
        method: 'POST',
        token: qrCode.table_token,
        idempotencyKey: `qr_full_${crypto.randomBytes(8).toString('hex')}`,
        headers: { 'X-Real-IP': '10.16.1.1' },
        body: {
          table_id: tableId,
          items: [{ product_id: product.id, quantity: 2 }],
          customer_name: 'Guest One',
        },
      });
      const orderData = assertJson(
        orderRes,
        201,
        (d) =>
          d.ok === true &&
          typeof d.order?.id === 'string' &&
          typeof d.order?.tracking_token === 'string' &&
          d.order?.status === 'pending',
      );

      const trackRes = await harness.request(`/api/qr/order/${encodeURIComponent(orderData.order.id)}`, {
        token: orderData.order.tracking_token,
      });
      assertJson(
        trackRes,
        200,
        (d) => d.ok === true && d.order?.id === orderData.order.id && d.order?.status === 'pending',
      );
    });
  },
});

registerTest({
  id: 'f16:t1:pos-qr-orders-lease-and-ack',
  tier: 1,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'GET /api/pos/qr-orders leases Cloud QR order to terminal and POST /ack marks delivered',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      const product = await getFirstProduct(harness, org.token);

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'QR-LEASE', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;
      const qrCodeRes = await harness.request(`/api/qr/tables/${encodeURIComponent(tableId)}/code`, {
        token: org.token,
      });
      const tableToken = assertJson(qrCodeRes, 200).table_token as string;

      const pairTerminal = async (name: string): Promise<string> => {
        const g = await harness.request('/api/pairing/generate', {
          method: 'POST',
          token: org.token,
          body: { branch_id: org.branch.id, terminal_name: name },
        });
        const code = assertJson(g, 200).code as string;
        const p = await harness.request('/api/pos/pair', { method: 'POST', body: { code } });
        return assertJson(p, 200).terminal_token as string;
      };

      const term1 = await pairTerminal('Lease POS 1');
      const term2 = await pairTerminal('Lease POS 2');

      const qrOrderRes = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        idempotencyKey: `qr_lease_${crypto.randomBytes(8).toString('hex')}`,
        headers: { 'X-Real-IP': '10.16.1.2' },
        body: {
          table_id: tableId,
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const qrOrderId = assertJson(qrOrderRes, 201).order.id as string;

      const poll1 = await harness.request('/api/pos/qr-orders', { token: term1 });
      const orders1 = assertJson(poll1, 200, (d) => Array.isArray(d.orders));
      assert(orders1.orders.some((o: { id: string }) => o.id === qrOrderId), 'Expected Terminal 1 to lease QR order');

      const poll2 = await harness.request('/api/pos/qr-orders', { token: term2 });
      const orders2 = assertJson(poll2, 200, (d) => Array.isArray(d.orders));
      assertEqual(orders2.orders.length, 0, 'Expected Terminal 2 not to see order leased by Terminal 1');

      const ack1 = await harness.request(`/api/pos/qr-orders/${encodeURIComponent(qrOrderId)}/ack`, {
        method: 'POST',
        token: term1,
        body: { local_order_id: 'LOCAL-ORD-99' },
      });
      assertJson(ack1, 200, (d) => d.ok === true);

      const ackReplay = await harness.request(`/api/pos/qr-orders/${encodeURIComponent(qrOrderId)}/ack`, {
        method: 'POST',
        token: term1,
        body: { local_order_id: 'LOCAL-ORD-99' },
      });
      assertJson(ackReplay, 200, (d) => d.ok === true && d.replay === true);

      const ackConflict = await harness.request(`/api/pos/qr-orders/${encodeURIComponent(qrOrderId)}/ack`, {
        method: 'POST',
        token: term2,
        body: { local_order_id: 'LOCAL-ORD-100' },
      });
      assertStatus(ackConflict, 409, 'wrong terminal acking delivered QR order');
    });
  },
});

registerTest({
  id: 'f16:t2:starter-pairing-gated-403',
  tier: 2,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'starter plan blocks POST /api/pairing/generate with 403 PLAN_FEATURE_REQUIRED',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const res = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'Blocked POS' },
      });
      assertJson(res, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'cloudSync');
    });
  },
});

registerTest({
  id: 'f16:t2:pairing-single-use-409-and-disconnected-terminal',
  tier: 2,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'Claimed PIN cannot be reused (409); disconnected terminal cannot sync (403) or poll QR (401)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const genRes = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'SingleUse POS' },
      });
      const code = assertJson(genRes, 200).code as string;

      const claim1 = await harness.request('/api/pos/pair', { method: 'POST', body: { code } });
      const terminalToken = assertJson(claim1, 200).terminal_token as string;

      const claim2 = await harness.request('/api/pos/pair', { method: 'POST', body: { code } });
      assertStatus(claim2, 409, 'reusing claimed pairing code');

      const badCode = await harness.request('/api/pos/pair', { method: 'POST', body: { code: '999999' } });
      assertStatus(badCode, 404, 'unknown pairing code');

      const malformed = await harness.request('/api/pos/pair', { method: 'POST', body: { code: 'abc' } });
      assertStatus(malformed, 400, 'malformed pairing code');

      const disc = await harness.request('/api/pos/disconnect', {
        method: 'POST',
        token: terminalToken,
      });
      assertStatus(disc, 200);

      const syncAfterDisc = await harness.request('/api/pos/events', {
        method: 'POST',
        token: terminalToken,
        body: { events: [] },
      });
      assertStatus(syncAfterDisc, 403, 'sync after terminal disconnect');

      const qrPollAfterDisc = await harness.request('/api/pos/qr-orders', {
        token: terminalToken,
      });
      assertStatus(qrPollAfterDisc, 401, 'qr-orders poll after terminal disconnect');
    });
  },
});

registerTest({
  id: 'f16:t2:pos-events-payload-conflict',
  tier: 2,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'POST /api/pos/events rejects same event ID with different payload',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const gen = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'Conflict POS' },
      });
      const code = assertJson(gen, 200).code as string;
      const pair = await harness.request('/api/pos/pair', { method: 'POST', body: { code } });
      const terminalToken = assertJson(pair, 200).terminal_token as string;

      const eventId = `ev_conf_${crypto.randomBytes(4).toString('hex')}`;
      const orderId = crypto.randomUUID();

      const first = await harness.request('/api/pos/events', {
        method: 'POST',
        token: terminalToken,
        body: {
          events: [
            {
              id: eventId,
              type: 'order.created',
              payload: {
                id: orderId,
                order_number: 'POS-CONF-1',
                subtotal: 100,
                tax_total: 5,
                grand_total: 105,
                status: 'completed',
              },
            },
          ],
        },
      });
      assertJson(first, 200, (d) => d.success === true && d.processed_count === 1);

      const conflict = await harness.request('/api/pos/events', {
        method: 'POST',
        token: terminalToken,
        body: {
          events: [
            {
              id: eventId,
              type: 'order.created',
              payload: {
                id: orderId,
                order_number: 'POS-CONF-1',
                subtotal: 200,
                tax_total: 10,
                grand_total: 210,
                status: 'completed',
              },
            },
          ],
        },
      });
      assertJson(
        conflict,
        200,
        (d) =>
          d.success === false &&
          d.processed_count === 0 &&
          d.failed_count === 1 &&
          Array.isArray(d.synced_ids) &&
          d.synced_ids.length === 0,
      );
    });
  },
});

registerTest({
  id: 'f16:t2:pos-events-batch-and-size-limits-413',
  tier: 2,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'POST /api/pos/events rejects >250 events and >2MB payloads with 413',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const gen = await harness.request('/api/pairing/generate', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, terminal_name: 'Limit POS' },
      });
      const code = assertJson(gen, 200).code as string;
      const pair = await harness.request('/api/pos/pair', { method: 'POST', body: { code } });
      const terminalToken = assertJson(pair, 200).terminal_token as string;

      const tooManyEvents = Array.from({ length: 251 }, (_, i) => ({
        id: `ev_batch_${i}`,
        type: 'inventory.updated',
        payload: { seq: i },
      }));
      const resCount = await harness.request('/api/pos/events', {
        method: 'POST',
        token: terminalToken,
        body: { events: tooManyEvents },
      });
      assertStatus(resCount, 413, '251 events batch');

      const bigFiller = 'x'.repeat(2 * 1024 * 1024 + 1024);
      const resSize = await harness.request('/api/pos/events', {
        method: 'POST',
        token: terminalToken,
        body: { events: [{ id: 'ev_big', type: 'inventory.updated', payload: { blob: bigFiller } }] },
      });
      assertStatus(resSize, 413, '>2MB sync payload');
    });
  },
});

registerTest({
  id: 'f16:t2:qr-code-missing-frontend-origin-503',
  tier: 2,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'GET /api/qr/tables/:id/code returns 503 when FRONTEND_ORIGIN is unset',
  async run(): Promise<void> {
    await withBackend({ env: { FRONTEND_ORIGIN: undefined } }, async (harness) => {
      const org = await harness.registerOrg();
      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'QR-NOORIGIN', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const qrRes = await harness.request(`/api/qr/tables/${encodeURIComponent(tableId)}/code`, {
        token: org.token,
      });
      assertJson(
        qrRes,
        503,
        (d) => typeof d.error === 'string' && d.error.includes('public web origin'),
      );
    });
  },
});

registerTest({
  id: 'f16:t2:qr-order-idempotency-replay-and-conflict',
  tier: 2,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'POST /api/qr/order replays identical retry (200), rejects altered payload (409), rejects missing/bad key (400)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstProduct(harness, org.token);
      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'QR-IDEM', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;
      const qrCodeRes = await harness.request(`/api/qr/tables/${encodeURIComponent(tableId)}/code`, {
        token: org.token,
      });
      const tableToken = assertJson(qrCodeRes, 200).table_token as string;

      const missingKey = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        headers: { 'X-Real-IP': '10.16.2.1' },
        body: { table_id: tableId, items: [{ product_id: product.id, quantity: 1 }] },
      });
      assertStatus(missingKey, 400, 'missing Idempotency-Key');

      const badKey = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        idempotencyKey: 'short',
        headers: { 'X-Real-IP': '10.16.2.2' },
        body: { table_id: tableId, items: [{ product_id: product.id, quantity: 1 }] },
      });
      assertStatus(badKey, 400, 'short Idempotency-Key');

      const idemKey = `qr_idem_test_${crypto.randomBytes(6).toString('hex')}`;
      const createRes = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        idempotencyKey: idemKey,
        headers: { 'X-Real-IP': '10.16.2.3' },
        body: { table_id: tableId, items: [{ product_id: product.id, quantity: 1 }] },
      });
      const created = assertJson(createRes, 201);

      const replayRes = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        idempotencyKey: idemKey,
        headers: { 'X-Real-IP': '10.16.2.4' },
        body: { table_id: tableId, items: [{ product_id: product.id, quantity: 1 }] },
      });
      const replayed = assertJson(replayRes, 200);
      assertEqual(replayed.order?.id, created.order.id, 'Expected idempotent replay to return same order.id');

      const conflictRes = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        idempotencyKey: idemKey,
        headers: { 'X-Real-IP': '10.16.2.5' },
        body: { table_id: tableId, items: [{ product_id: product.id, quantity: 3 }] },
      });
      assertStatus(conflictRes, 409, 'reused Idempotency-Key with different quantity');
    });
  },
});

registerTest({
  id: 'f16:t2:qr-tracking-token-isolation-404',
  tier: 2,
  feature: 'F16: Cloud Pairing, Sync & Public QR',
  title: 'GET /api/qr/order/:id rejects missing, wrong, or cross-order tracking tokens with 404',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstProduct(harness, org.token);
      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'QR-TRACK', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;
      const qrCodeRes = await harness.request(`/api/qr/tables/${encodeURIComponent(tableId)}/code`, {
        token: org.token,
      });
      const tableToken = assertJson(qrCodeRes, 200).table_token as string;

      const orderARes = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        idempotencyKey: `qr_track_a_${crypto.randomBytes(6).toString('hex')}`,
        headers: { 'X-Real-IP': '10.16.3.1' },
        body: { table_id: tableId, items: [{ product_id: product.id, quantity: 1 }] },
      });
      const orderA = assertJson(orderARes, 201).order;

      const orderBRes = await harness.request('/api/qr/order', {
        method: 'POST',
        token: tableToken,
        idempotencyKey: `qr_track_b_${crypto.randomBytes(6).toString('hex')}`,
        headers: { 'X-Real-IP': '10.16.3.2' },
        body: { table_id: tableId, items: [{ product_id: product.id, quantity: 2 }] },
      });
      const orderB = assertJson(orderBRes, 201).order;

      const missingTok = await harness.request(`/api/qr/order/${encodeURIComponent(orderA.id)}`);
      assertStatus(missingTok, 404, 'missing tracking token');

      const withTableTok = await harness.request(`/api/qr/order/${encodeURIComponent(orderA.id)}`, {
        token: tableToken,
      });
      assertStatus(withTableTok, 404, 'table_token used as tracking token');

      const withOrderBTok = await harness.request(`/api/qr/order/${encodeURIComponent(orderA.id)}`, {
        token: orderB.tracking_token,
      });
      assertStatus(withOrderBTok, 404, 'order B tracking_token used on order A');
    });
  },
});
