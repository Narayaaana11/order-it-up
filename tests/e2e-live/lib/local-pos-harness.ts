import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import { LOCAL_POS_PORT_BASE, allocatePorts, releasePort } from './ports';
import {
  type HttpResponse,
  type ManagedProcessResource,
  type RequestOptions,
  type WsHandle,
  assertStatus,
  buildWsHandle,
  createWsFrameQueue,
  hashBcrypt,
  httpRequest,
  killChildTreeSync,
  registerManagedResource,
  removeTempDirWithRetry,
  unregisterManagedResource,
  waitForWsFrame,
} from './test-kit';

export type LocalPosTarget = 'main' | 'kds' | 'serverApp';

export interface LocalPosPorts {
  main: number;
  kds: number;
  serverApp: number;
}

export interface LocalPosHarnessOptions {
  env?: Record<string, string | undefined>;
  exactPorts?: boolean;
  startupTimeoutMs?: number;
  jwtSecret?: string;
  adminJwtSecret?: string;
  adminEmail?: string;
  adminPassword?: string;
  keepTempDir?: boolean;
}

export interface SetupOwnerOverrides {
  name?: string;
  email?: string;
  password?: string;
  business_name?: string;
  store_name?: string;
  business_type?: string;
  setup_profile?: 'empty' | 'express' | 'demo';
  service_model?: 'qsr' | 'finedine';
  country?: string;
  currency?: string;
  timezone?: string;
  master_pin?: string;
}

export interface SetupOwnerResult {
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenant: any;
  email: string;
  password: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export interface LocalPosLoginResult {
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export interface KdsWsHandle extends WsHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authSuccess: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any;
}

export interface LocalPosHarness {
  readonly portsRequested: LocalPosPorts;
  readonly portsBound: LocalPosPorts;
  readonly tmpDir: string;
  readonly dbPath: string;
  readonly logs: string[];
  readonly adminCredentials: { email: string; password: string };
  baseUrl(target?: LocalPosTarget): string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request<T = any>(
    target: LocalPosTarget,
    reqPath: string,
    opts?: RequestOptions,
  ): Promise<HttpResponse<T>>;
  setupOwner(overrides?: SetupOwnerOverrides): Promise<SetupOwnerResult>;
  login(
    email: string,
    password: string,
    target?: LocalPosTarget,
  ): Promise<LocalPosLoginResult>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activatePlan(licenseKey: string, token: string): Promise<any>;
  wsKds(token: string, target?: 'main' | 'kds'): Promise<KdsWsHandle>;
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

function formatLogsTail(logs: string[], maxLines = 40): string {
  return logs.slice(-maxLines).join('\n');
}

function normalizePath(reqPath: string): string {
  return reqPath.startsWith('/') ? reqPath : `/${reqPath}`;
}

export async function startLocalPos(
  opts: LocalPosHarnessOptions = {},
): Promise<LocalPosHarness> {
  const devServerPath = path.join(REPO_ROOT, 'dev-server.js');
  if (!fs.existsSync(devServerPath)) {
    throw new Error(`dev-server.js not found at ${devServerPath}`);
  }

  const [reqMain, reqKds, reqServerApp] = await allocatePorts(3, LOCAL_POS_PORT_BASE, 10);
  const portsRequested: LocalPosPorts = {
    main: reqMain,
    kds: reqKds,
    serverApp: reqServerApp,
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-e2e-pos-'));
  const dbPath = path.join(tmpDir, 'oiu.db');

  const jwtSecret = opts.jwtSecret ?? crypto.randomBytes(32).toString('hex');
  let adminJwtSecret = opts.adminJwtSecret ?? crypto.randomBytes(32).toString('hex');
  if (adminJwtSecret === jwtSecret) {
    adminJwtSecret = crypto.randomBytes(32).toString('hex');
  }

  const adminEmail = opts.adminEmail ?? 'admin@e2e.local';
  const adminPassword = opts.adminPassword ?? 'AdminPass123!';
  const adminPasswordHash = hashBcrypt(adminPassword, 10);

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'test',
    PORT: String(portsRequested.main),
    KDS_PORT: String(portsRequested.kds),
    SERVER_APP_PORT: String(portsRequested.serverApp),
    OIU_DEV_USER_DATA: tmpDir,
    OIU_E2E_DB_PATH: dbPath,
    JWT_SECRET: jwtSecret,
    OIU_ADMIN_JWT_SECRET: adminJwtSecret,
    OIU_ADMIN_BOOTSTRAP_EMAIL: adminEmail,
    OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH: adminPasswordHash,
  };

  if (opts.env) {
    for (const [key, value] of Object.entries(opts.env)) {
      if (value === undefined) {
        delete childEnv[key];
      } else {
        childEnv[key] = value;
      }
    }
  }

  const electronExe = resolveElectronExecutable();
  const proc: ChildProcess = spawn(electronExe, [devServerPath], {
    cwd: REPO_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
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

  const exitPromise = new Promise<void>((resolve) => {
    proc.once('exit', (code, signal) => {
      exited = true;
      exitCode = code;
      exitSignal = signal;
      resolve();
    });
  });

  const parsedPorts: Partial<LocalPosPorts> = {};
  let stdoutRemainder = '';

  const parseStdoutLine = (line: string): void => {
    const mainMatch =
      /\[DevServer\]\s+.*?Main API running on http:\/\/localhost:(\d+)/.exec(line) ??
      /\[Server\] HTTP server running on http:\/\/localhost:(\d+)/.exec(line);
    if (mainMatch) {
      parsedPorts.main = Number(mainMatch[1]);
    }

    const kdsMatch =
      /\[DevServer\]\s+.*?KDS Server running on http:\/\/localhost:(\d+)/.exec(line) ??
      /\[KDS Server\] HTTP server running on http:\/\/localhost:(\d+)/.exec(line);
    if (kdsMatch) {
      parsedPorts.kds = Number(kdsMatch[1]);
    }

    const serverAppMatch =
      /\[DevServer\]\s+.*?Server App running on http:\/\/localhost:(\d+)/.exec(line) ??
      /\[Server App\] HTTP server running on http:\/\/localhost:(\d+)/.exec(line);
    if (serverAppMatch) {
      parsedPorts.serverApp = Number(serverAppMatch[1]);
    }
  };

  proc.stdout?.setEncoding('utf8');
  proc.stdout?.on('data', (chunk: string) => {
    appendLogLines(logs, chunk, '');
    const combined = stdoutRemainder + chunk;
    const parts = combined.split(/\r?\n/);
    stdoutRemainder = parts.pop() ?? '';
    for (const part of parts) {
      parseStdoutLine(part);
    }
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
          if (proc.stdin && proc.stdin.writable) {
            proc.stdin.write('SHUTDOWN\n');
            proc.stdin.end();
          } else {
            proc.kill('SIGTERM');
          }
        } catch {
          try {
            proc.kill('SIGTERM');
          } catch {
            // Ignore
          }
        }

        const graceful = await Promise.race([
          exitPromise.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 8000)),
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
      releasePort(portsRequested.main);
      releasePort(portsRequested.kds);
      releasePort(portsRequested.serverApp);

      if (!opts.keepTempDir) {
        await removeTempDirWithRetry(tmpDir);
      }
    })();

    return stopPromise;
  };

  const startupTimeoutMs = opts.startupTimeoutMs ?? 30_000;
  const deadline = Date.now() + startupTimeoutMs;

  try {
    while (
      parsedPorts.main === undefined ||
      parsedPorts.kds === undefined ||
      parsedPorts.serverApp === undefined
    ) {
      if (exited) {
        throw new Error(
          `Local POS dev-server exited early (code=${exitCode}, signal=${exitSignal}) before binding all 3 ports.\nLogs:\n${formatLogsTail(logs)}`,
        );
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out after ${startupTimeoutMs}ms waiting for Local POS ports (parsed=${JSON.stringify(parsedPorts)}).\nLogs:\n${formatLogsTail(logs)}`,
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    const portsBound: LocalPosPorts = {
      main: parsedPorts.main,
      kds: parsedPorts.kds,
      serverApp: parsedPorts.serverApp,
    };

    if (opts.exactPorts) {
      if (
        portsBound.main !== portsRequested.main ||
        portsBound.kds !== portsRequested.kds ||
        portsBound.serverApp !== portsRequested.serverApp
      ) {
        throw new Error(
          `Exact port isolation failed: requested=${JSON.stringify(portsRequested)}, bound=${JSON.stringify(portsBound)}`,
        );
      }
    }

    const baseUrl = (target: LocalPosTarget = 'main'): string =>
      `http://127.0.0.1:${portsBound[target]}`;

    const healthReady = { main: false, kds: false, serverApp: false };
    while (!healthReady.main || !healthReady.kds || !healthReady.serverApp) {
      if (exited) {
        throw new Error(
          `Local POS dev-server exited early during health polling (code=${exitCode}, signal=${exitSignal}).\nLogs:\n${formatLogsTail(logs)}`,
        );
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting for Local POS /api/health readiness (${JSON.stringify(healthReady)}).\nLogs:\n${formatLogsTail(logs)}`,
        );
      }

      if (!healthReady.main) {
        try {
          const res = await httpRequest(`${baseUrl('main')}/api/health`, { timeoutMs: 2000 });
          if (
            res.status === 200 &&
            res.data?.status === 'ok' &&
            res.data?.db === 'ok' &&
            res.data?.service === 'Order It Up Local API'
          ) {
            healthReady.main = true;
          }
        } catch {
          // Retry until deadline
        }
      }

      if (!healthReady.kds) {
        try {
          const res = await httpRequest(`${baseUrl('kds')}/api/health`, { timeoutMs: 2000 });
          if (
            res.status === 200 &&
            res.data?.status === 'ok' &&
            res.data?.service === 'Order It Up KDS Server'
          ) {
            healthReady.kds = true;
          }
        } catch {
          // Retry until deadline
        }
      }

      if (!healthReady.serverApp) {
        try {
          const res = await httpRequest(`${baseUrl('serverApp')}/api/health`, { timeoutMs: 2000 });
          if (
            res.status === 200 &&
            res.data?.status === 'ok' &&
            res.data?.service === 'Order It Up Server App'
          ) {
            healthReady.serverApp = true;
          }
        } catch {
          // Retry until deadline
        }
      }

      if (!healthReady.main || !healthReady.kds || !healthReady.serverApp) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = async <T = any>(
      target: LocalPosTarget,
      reqPath: string,
      reqOpts?: RequestOptions,
    ): Promise<HttpResponse<T>> => {
      return httpRequest<T>(`${baseUrl(target)}${normalizePath(reqPath)}`, reqOpts);
    };

    const setupOwner = async (overrides: SetupOwnerOverrides = {}): Promise<SetupOwnerResult> => {
      const statusRes = await request('main', '/api/auth/setup/status');
      assertStatus(statusRes, 200, 'setup/status');
      const masterPinAvailable = Boolean(statusRes.data?.masterPinAvailable);

      const email = overrides.email ?? 'owner@e2e.local';
      const password = overrides.password ?? 'OwnerPass123!';
      const payload: Record<string, unknown> = {
        name: overrides.name ?? 'E2E Owner',
        email,
        password,
        business_name: overrides.business_name ?? 'E2E Test Bistro',
        setup_profile: overrides.setup_profile ?? 'express',
        service_model: overrides.service_model ?? 'qsr',
        country: overrides.country ?? 'IN',
        currency: overrides.currency ?? 'INR',
        timezone: overrides.timezone ?? 'Asia/Kolkata',
        terms_accepted: true,
      };
      if (overrides.store_name !== undefined) payload['store_name'] = overrides.store_name;
      if (overrides.business_type !== undefined) payload['business_type'] = overrides.business_type;
      if (overrides.master_pin !== undefined) {
        payload['master_pin'] = overrides.master_pin;
      } else if (masterPinAvailable) {
        payload['master_pin'] = '1234';
      }

      const res = await request('main', '/api/auth/setup/initialize', {
        method: 'POST',
        body: payload,
      });
      assertStatus(res, 200, 'setup/initialize');

      const token = String(res.data?.access_token ?? '');
      if (!token) {
        throw new Error(`setup/initialize returned empty access_token: ${res.rawText}`);
      }

      return {
        token,
        user: res.data?.user,
        tenant: res.data?.tenant,
        email,
        password,
        raw: res.data,
      };
    };

    const login = async (
      email: string,
      password: string,
      target: LocalPosTarget = 'main',
    ): Promise<LocalPosLoginResult> => {
      const res = await request(target, '/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      assertStatus(res, 200, `login(${target})`);
      const token = String(res.data?.access_token ?? '');
      if (!token) {
        throw new Error(`login(${target}) returned empty access_token: ${res.rawText}`);
      }
      return {
        token,
        user: res.data?.user,
        raw: res.data,
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activatePlan = async (licenseKey: string, token: string): Promise<any> => {
      const res = await request('main', '/api/subscription/activate', {
        method: 'POST',
        token,
        body: { licenseKey },
      });
      assertStatus(res, 200, 'subscription/activate');
      if (res.data?.ok !== true) {
        throw new Error(`subscription/activate did not return ok=true: ${res.rawText}`);
      }
      return res.data;
    };

    const wsKds = async (
      token: string,
      target: 'main' | 'kds' = 'kds',
    ): Promise<KdsWsHandle> => {
      const wsUrl = `ws://127.0.0.1:${portsBound[target]}/kds`;
      const ws = new WebSocket(wsUrl);
      const queue = createWsFrameQueue(ws);

      const connected = await waitForWsFrame(
        queue,
        (msg) => msg?.type === 'connected',
        5000,
      );

      ws.send(JSON.stringify({ type: 'auth', token }));
      const authFrame = await waitForWsFrame(
        queue,
        (msg) => msg?.type === 'auth_success' || msg?.type === 'auth_error',
        5000,
      );
      if (authFrame?.type === 'auth_error') {
        try {
          ws.close();
        } catch {
          // ignore
        }
        throw new Error(`KDS WebSocket auth failed: ${authFrame?.message ?? JSON.stringify(authFrame)}`);
      }

      const initialData = await waitForWsFrame(
        queue,
        (msg) => msg?.type === 'initial_data',
        5000,
      );

      const baseHandle = buildWsHandle(ws, wsUrl, queue, connected);
      const kdsHandle: KdsWsHandle = {
        ...baseHandle,
        authSuccess: authFrame,
        initialData,
        async close(): Promise<void> {
          openSockets.delete(kdsHandle);
          await baseHandle.close();
        },
      };

      openSockets.add(kdsHandle);
      return kdsHandle;
    };

    return {
      portsRequested,
      portsBound,
      tmpDir,
      dbPath,
      logs,
      adminCredentials: { email: adminEmail, password: adminPassword },
      baseUrl,
      request,
      setupOwner,
      login,
      activatePlan,
      wsKds,
      stop,
    };
  } catch (err) {
    await stop().catch(() => undefined);
    throw err;
  }
}
