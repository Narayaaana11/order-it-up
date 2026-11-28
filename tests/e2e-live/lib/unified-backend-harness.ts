import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import { UNIFIED_PORT_BASE, allocatePort, releasePort } from './ports';
import {
  type HttpResponse,
  type ManagedProcessResource,
  type RequestOptions,
  type WsHandle,
  assertStatus,
  buildWsHandle,
  createWsFrameQueue,
  hashScrypt,
  httpRequest,
  killChildTreeSync,
  registerManagedResource,
  removeTempDirWithRetry,
  unregisterManagedResource,
  waitForWsFrame,
} from './test-kit';

export interface UnifiedBackendHarnessOptions {
  env?: Record<string, string | undefined>;
  startupTimeoutMs?: number;
  jwtSecret?: string;
  platformAdminJwtSecret?: string;
  platformAdminEmail?: string;
  platformAdminPassword?: string;
  keepTempDir?: boolean;
}

export interface RegisterOrgOptions {
  restaurantName?: string;
  ownerName?: string;
  email?: string;
  password?: string;
  serviceModel?: 'qsr' | 'cafe' | 'finedine';
  country?: string;
  currency?: string;
  timezone?: string;
  clientIp?: string;
  legalName?: string;
  taxNumber?: string;
  address?: string;
  phone?: string;
}

export interface RegisterOrgResult {
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenant: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  restaurant: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  branch: any;
  email: string;
  password: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export interface UnifiedBackendHarness {
  readonly baseUrl: string;
  readonly port: number;
  readonly tmpDir: string;
  readonly dbPath: string;
  readonly backupDir: string;
  readonly logs: string[];
  readonly platformAdminCredentials: { email: string; password: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request<T = any>(reqPath: string, opts?: RequestOptions): Promise<HttpResponse<T>>;
  platformAdminLogin(forceRefresh?: boolean): Promise<string>;
  registerOrg(opts?: RegisterOrgOptions): Promise<RegisterOrgResult>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upgradeOrgPlan(
    orgId: string,
    planCode: 'starter' | 'pro' | 'enterprise',
    reason?: string,
    billingCycle?: 'monthly' | 'yearly',
  ): Promise<any>;
  wsConnect(
    wsPath: '/ws/kds' | '/ws/pos' | string,
    token?: string,
    query?: Record<string, string>,
  ): Promise<WsHandle>;
  stop(): Promise<void>;
}

const MAX_LOG_LINES = 500;
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const nodeRequire = createRequire(__filename);

function resolveElectronExecutable(): string {
  const resolved: unknown = nodeRequire('electron');
  if (typeof resolved !== 'string' || resolved.trim().length === 0) {
    throw new Error('Could not resolve Electron executable path via require("electron")');
  }
  return resolved;
}

function appendLogLines(logs: string[], chunk: string, prefix: string): void {
  const lines = chunk.split(/\r?\n/);
  for (const line of lines) {
    if (line.length === 0) continue;
    logs.push(`${prefix}${line}`);
    if (logs.length > MAX_LOG_LINES) {
      logs.shift();
    }
  }
}

let cachedUnifiedRuntime: { exe: string; useElectronAsNode: boolean } | null = null;

function resolveUnifiedRuntime(): { exe: string; useElectronAsNode: boolean } {
  if (cachedUnifiedRuntime) return cachedUnifiedRuntime;

  const backendSqliteDir = path.join(REPO_ROOT, 'backend', 'node_modules', 'better-sqlite3');
  if (fs.existsSync(backendSqliteDir) && !process.versions.electron) {
    // Verify ABI compatibility (backend/node_modules/better-sqlite3 may be built for Electron ABI rather than Node 22).
    const probe = spawnSync(
      process.execPath,
      ['-e', "const D=require('./backend/node_modules/better-sqlite3'); new D(':memory:').close();"],
      { cwd: REPO_ROOT, stdio: 'ignore' },
    );
    if (probe.status === 0) {
      cachedUnifiedRuntime = { exe: process.execPath, useElectronAsNode: false };
      return cachedUnifiedRuntime;
    }
  }

  cachedUnifiedRuntime = { exe: resolveElectronExecutable(), useElectronAsNode: true };
  return cachedUnifiedRuntime;
}

function formatLogsTail(logs: string[], maxLines = 40): string {
  return logs.slice(-maxLines).join('\n');
}

function normalizePath(reqPath: string): string {
  return reqPath.startsWith('/') ? reqPath : `/${reqPath}`;
}

export async function startUnifiedBackend(
  opts: UnifiedBackendHarnessOptions = {},
): Promise<UnifiedBackendHarness> {
  const entryPath = path.join(REPO_ROOT, 'backend', 'dist', 'index.js');
  if (!fs.existsSync(entryPath)) {
    throw new Error(`backend/dist/index.js not found at ${entryPath}`);
  }

  const port = await allocatePort(UNIFIED_PORT_BASE);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-e2e-cloud-'));
  const dbPath = path.join(tmpDir, 'unified.db');
  const backupDir = path.join(tmpDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const jwtSecret = opts.jwtSecret ?? crypto.randomBytes(32).toString('hex');
  let platformAdminJwtSecret =
    opts.platformAdminJwtSecret ?? crypto.randomBytes(32).toString('hex');
  if (platformAdminJwtSecret === jwtSecret) {
    platformAdminJwtSecret = crypto.randomBytes(32).toString('hex');
  }

  const platformAdminEmail = opts.platformAdminEmail ?? 'platform-admin@e2e.local';
  const platformAdminPassword = opts.platformAdminPassword ?? 'PlatformAdmin123!';
  const platformAdminPasswordHash = await hashScrypt(platformAdminPassword);

  const runtime = resolveUnifiedRuntime();
  const runtimeExe = runtime.exe;

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    DB_PATH: dbPath,
    BACKUP_DIR: backupDir,
    BACKUP_INTERVAL_MS: '86400000',
    JWT_SECRET: jwtSecret,
    PLATFORM_ADMIN_JWT_SECRET: platformAdminJwtSecret,
    PLATFORM_ADMIN_EMAIL: platformAdminEmail,
    PLATFORM_ADMIN_PASSWORD_HASH: platformAdminPasswordHash,
    ALLOW_SELF_SERVICE_REGISTRATION: 'true',
    ENVIRONMENT: 'development',
    FRONTEND_ORIGIN: 'http://localhost:3000',
    REQUIRE_PROVIDER_VERIFIED_NONCASH: 'false',
    RATE_LIMIT_LOGIN_IP: '5000',
    RATE_LIMIT_LOGIN_ACCOUNT: '5000',
    RATE_LIMIT_PAIR_CLAIM_IP: '5000',
    RATE_LIMIT_PAIR_GENERATE_BRANCH: '5000',
    RATE_LIMIT_DEMO_SETUP_IP: '5000',
    RATE_LIMIT_SYNC_EVENTS_TERMINAL: '5000',
    RATE_LIMIT_PILOT_REQUEST_IP: '100',
    RATE_LIMIT_PILOT_REQUEST_EMAIL: '100',
  };

  if (runtime.useElectronAsNode) {
    childEnv['ELECTRON_RUN_AS_NODE'] = '1';
  }

  if (opts.env) {
    for (const [key, value] of Object.entries(opts.env)) {
      if (value === undefined) {
        delete childEnv[key];
      } else {
        childEnv[key] = value;
      }
    }
  }

  const proc: ChildProcess = spawn(runtimeExe, [entryPath], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv,
  });

  const managedResource: ManagedProcessResource = {
    proc,
    tmpDir,
    keepTempDir: Boolean(opts.keepTempDir),
  };
  registerManagedResource(managedResource);

  const logs: string[] = [];
  const openSockets = new Set<WsHandle>();
  let stopPromise: Promise<void> | null = null;
  let exited = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let cachedAdminToken: string | null = null;

  const exitPromise = new Promise<void>((resolve) => {
    proc.once('exit', (code, signal) => {
      exited = true;
      exitCode = code;
      exitSignal = signal;
      resolve();
    });
  });

  proc.stdout?.setEncoding('utf8');
  proc.stdout?.on('data', (chunk: string) => {
    appendLogLines(logs, chunk, '');
  });

  proc.stderr?.setEncoding('utf8');
  proc.stderr?.on('data', (chunk: string) => {
    appendLogLines(logs, chunk, '[stderr] ');
  });

  const stop = async (): Promise<void> => {
    if (stopPromise) return stopPromise;

    stopPromise = (async () => {
      for (const handle of Array.from(openSockets)) {
        try {
          await handle.close();
        } catch {
          // Ignore close errors during teardown
        }
        openSockets.delete(handle);
      }

      if (!exited && proc.exitCode === null && proc.signalCode === null) {
        try {
          proc.kill('SIGTERM');
        } catch {
          // Ignore
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

      unregisterManagedResource(managedResource);
      releasePort(port);

      if (!opts.keepTempDir) {
        await removeTempDirWithRetry(tmpDir);
      }
    })();

    return stopPromise;
  };

  const baseUrl = `http://127.0.0.1:${port}`;
  const startupTimeoutMs = opts.startupTimeoutMs ?? 30_000;
  const deadline = Date.now() + startupTimeoutMs;

  try {
    let healthOk = false;
    let readyOk = false;

    while (!healthOk || !readyOk) {
      if (exited) {
        throw new Error(
          `Unified backend exited early (code=${exitCode}, signal=${exitSignal}) before becoming ready.\nLogs:\n${formatLogsTail(logs)}`,
        );
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out after ${startupTimeoutMs}ms waiting for Unified Backend /health & /ready (healthOk=${healthOk}, readyOk=${readyOk}).\nLogs:\n${formatLogsTail(logs)}`,
        );
      }

      if (!healthOk) {
        try {
          const res = await httpRequest(`${baseUrl}/health`, { timeoutMs: 2000 });
          if (res.status === 200) {
            healthOk = true;
          }
        } catch {
          // Retry
        }
      }

      if (!readyOk) {
        try {
          const res = await httpRequest(`${baseUrl}/ready`, { timeoutMs: 2000 });
          if (res.status === 200) {
            readyOk = true;
          }
        } catch {
          // Retry
        }
      }

      if (!healthOk || !readyOk) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = async <T = any>(
      reqPath: string,
      reqOpts?: RequestOptions,
    ): Promise<HttpResponse<T>> => {
      return httpRequest<T>(`${baseUrl}${normalizePath(reqPath)}`, reqOpts);
    };

    const platformAdminLogin = async (forceRefresh = false): Promise<string> => {
      if (cachedAdminToken && !forceRefresh) {
        return cachedAdminToken;
      }
      const res = await request('/api/platform-admin/login', {
        method: 'POST',
        body: {
          email: platformAdminEmail,
          password: platformAdminPassword,
        },
      });
      assertStatus(res, 200, 'platform-admin/login');
      const token = String(res.data?.token ?? '');
      if (!token) {
        throw new Error(`platform-admin/login returned empty token: ${res.rawText}`);
      }
      cachedAdminToken = token;
      return token;
    };

    const registerOrg = async (regOpts: RegisterOrgOptions = {}): Promise<RegisterOrgResult> => {
      const suffix = crypto.randomBytes(4).toString('hex');
      const email = regOpts.email ?? `owner-${suffix}@e2e.local`;
      const password = regOpts.password ?? 'OwnerPass123!';
      const payload: Record<string, unknown> = {
        restaurant_name: regOpts.restaurantName ?? `E2E Restaurant ${suffix}`,
        owner_name: regOpts.ownerName ?? 'E2E Owner',
        email,
        password,
        service_model: regOpts.serviceModel ?? 'qsr',
        country: regOpts.country ?? 'IN',
        currency: regOpts.currency ?? 'INR',
        timezone: regOpts.timezone ?? 'Asia/Kolkata',
      };
      if (regOpts.legalName !== undefined) payload['legal_name'] = regOpts.legalName;
      if (regOpts.taxNumber !== undefined) payload['tax_number'] = regOpts.taxNumber;
      if (regOpts.address !== undefined) payload['address'] = regOpts.address;
      if (regOpts.phone !== undefined) payload['phone'] = regOpts.phone;

      const headers: Record<string, string> = {};
      if (regOpts.clientIp) {
        headers['X-Real-IP'] = regOpts.clientIp;
      }

      const res = await request('/api/auth/register', {
        method: 'POST',
        headers,
        body: payload,
      });
      assertStatus(res, 201, 'auth/register');

      const token = String(res.data?.token ?? res.data?.access_token ?? '');
      if (!token) {
        throw new Error(`auth/register returned empty token: ${res.rawText}`);
      }

      return {
        token,
        user: res.data?.user,
        tenant: res.data?.tenant,
        restaurant: res.data?.restaurant,
        branch: res.data?.branch,
        email,
        password,
        raw: res.data,
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upgradeOrgPlan = async (
      orgId: string,
      planCode: 'starter' | 'pro' | 'enterprise',
      reason?: string,
      billingCycle?: 'monthly' | 'yearly',
    ): Promise<any> => {
      const adminToken = await platformAdminLogin();
      const body: Record<string, unknown> = {
        plan_code: planCode,
        reason: reason ?? 'E2E harness plan upgrade for feature verification',
      };
      if (billingCycle) {
        body['billing_cycle'] = billingCycle;
      }

      const res = await request(
        `/api/platform-admin/tenants/${encodeURIComponent(orgId)}/subscription`,
        {
          method: 'PATCH',
          token: adminToken,
          body,
        },
      );
      assertStatus(res, 200, 'platform-admin/tenants/:id/subscription');
      return res.data;
    };

    const wsConnect = async (
      wsPath: '/ws/kds' | '/ws/pos' | string,
      token?: string,
      query?: Record<string, string>,
    ): Promise<WsHandle> => {
      const url = new URL(`ws://127.0.0.1:${port}${normalizePath(wsPath)}`);
      if (token !== undefined) {
        url.searchParams.set('token', token);
      }
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          url.searchParams.set(k, v);
        }
      }

      const wsUrl = url.toString();
      const ws = new WebSocket(wsUrl);
      const queue = createWsFrameQueue(ws);

      const connected = await waitForWsFrame(
        queue,
        (msg) => msg?.type === 'connected',
        5000,
      );

      const baseHandle = buildWsHandle(ws, wsUrl, queue, connected);
      const trackedHandle: WsHandle = {
        ...baseHandle,
        async close(): Promise<void> {
          openSockets.delete(trackedHandle);
          await baseHandle.close();
        },
      };
      openSockets.add(trackedHandle);
      return trackedHandle;
    };

    return {
      baseUrl,
      port,
      tmpDir,
      dbPath,
      backupDir,
      logs,
      platformAdminCredentials: {
        email: platformAdminEmail,
        password: platformAdminPassword,
      },
      request,
      platformAdminLogin,
      registerOrg,
      upgradeOrgPlan,
      wsConnect,
      stop,
    };
  } catch (err) {
    await stop().catch(() => undefined);
    throw err;
  }
}
