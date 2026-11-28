import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync, type ChildProcess } from 'node:child_process';
import bcrypt from 'bcryptjs';
import WebSocket, { type RawData } from 'ws';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface HttpResponse<T = any> {
  status: number;
  ok: boolean;
  headers: Headers;
  data: T;
  rawText: string;
}

export interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  timeoutMs?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function httpRequest<T = any>(
  url: string,
  opts: RequestOptions = {},
): Promise<HttpResponse<T>> {
  const method = (opts.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {};

  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      headers[k] = v;
    }
  }

  const hasHeader = (name: string): boolean => {
    const target = name.toLowerCase();
    return Object.keys(headers).some((k) => k.toLowerCase() === target);
  };

  if (opts.token && !hasHeader('authorization')) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  }
  if (opts.idempotencyKey && !hasHeader('idempotency-key')) {
    headers['Idempotency-Key'] = opts.idempotencyKey;
  }

  let requestBody: string | undefined;
  if (opts.rawBody !== undefined) {
    requestBody = opts.rawBody;
    if (!hasHeader('content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  } else if (opts.body !== undefined) {
    requestBody = JSON.stringify(opts.body);
    if (!hasHeader('content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: requestBody,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });

  const rawText = await res.text();
  let parsed: unknown = null;
  if (rawText.trim().length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    data: parsed as T,
    rawText,
  };
}

export type Tier = 1 | 2 | 3 | 4;

export interface TestCase {
  id: string;
  tier: Tier;
  feature: string;
  title: string;
  smoke?: boolean;
  run: () => Promise<void>;
}

export interface TestFilter {
  tier?: Tier | 'all';
  suite?: string;
  smoke?: boolean;
}

export interface TestCaseResult {
  id: string;
  tier: Tier;
  feature: string;
  title: string;
  smoke: boolean;
  status: 'passed' | 'failed';
  durationMs: number;
  error?: string;
  stack?: string;
}

export interface TestRunReport {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: TestCaseResult[];
  byTier: Record<number, { total: number; passed: number; failed: number }>;
  byFeature: Record<string, { total: number; passed: number; failed: number }>;
}

export class TestRegistry {
  private readonly cases: TestCase[] = [];
  private readonly ids = new Set<string>();

  register(tc: TestCase): void {
    if (this.ids.has(tc.id)) {
      throw new Error(`Duplicate test case id registered: ${tc.id}`);
    }
    this.ids.add(tc.id);
    this.cases.push(tc);
  }

  list(filter: TestFilter = {}): TestCase[] {
    const suiteNeedle = filter.suite?.trim().toLowerCase();
    return this.cases.filter((tc) => {
      if (filter.smoke && !tc.smoke) {
        return false;
      }
      if (filter.tier !== undefined && filter.tier !== 'all' && tc.tier !== filter.tier) {
        return false;
      }
      if (suiteNeedle) {
        const hayId = tc.id.toLowerCase();
        const hayFeature = tc.feature.toLowerCase();
        const hayTitle = tc.title.toLowerCase();
        if (!hayId.includes(suiteNeedle) && !hayFeature.includes(suiteNeedle) && !hayTitle.includes(suiteNeedle)) {
          return false;
        }
      }
      return true;
    });
  }

  count(): number {
    return this.cases.length;
  }

  async runAll(
    filter: TestFilter = {},
    onResult?: (result: TestCaseResult) => void,
  ): Promise<TestRunReport> {
    const matched = this.list(filter);
    const skipped = this.cases.length - matched.length;
    const results: TestCaseResult[] = [];
    const byTier: Record<number, { total: number; passed: number; failed: number }> = {};
    const byFeature: Record<string, { total: number; passed: number; failed: number }> = {};
    const runStart = Date.now();

    for (const tc of matched) {
      const start = Date.now();
      let status: 'passed' | 'failed' = 'passed';
      let errorMsg: string | undefined;
      let stack: string | undefined;

      try {
        await tc.run();
      } catch (err) {
        status = 'failed';
        if (err instanceof Error) {
          errorMsg = err.message;
          stack = err.stack;
        } else {
          errorMsg = String(err);
        }
      }

      const durationMs = Date.now() - start;
      const result: TestCaseResult = {
        id: tc.id,
        tier: tc.tier,
        feature: tc.feature,
        title: tc.title,
        smoke: Boolean(tc.smoke),
        status,
        durationMs,
        ...(errorMsg !== undefined ? { error: errorMsg } : {}),
        ...(stack !== undefined ? { stack } : {}),
      };
      results.push(result);

      const tierBucket = (byTier[tc.tier] ??= { total: 0, passed: 0, failed: 0 });
      tierBucket.total += 1;
      if (status === 'passed') tierBucket.passed += 1;
      else tierBucket.failed += 1;

      const featureBucket = (byFeature[tc.feature] ??= { total: 0, passed: 0, failed: 0 });
      featureBucket.total += 1;
      if (status === 'passed') featureBucket.passed += 1;
      else featureBucket.failed += 1;

      onResult?.(result);
    }

    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.length - passed;

    return {
      total: results.length,
      passed,
      failed,
      skipped,
      durationMs: Date.now() - runStart,
      results,
      byTier,
      byFeature,
    };
  }
}

export const registry = new TestRegistry();

export function registerTest(tc: TestCase): void {
  registry.register(tc);
}

// ── Assertions ────────────────────────────────────────────────────────────────

export function assert(cond: unknown, msg?: string): asserts cond {
  if (!cond) {
    throw new Error(msg ?? 'Assertion failed');
  }
}

export function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (!Object.is(actual, expected)) {
    const prefix = msg ? `${msg}: ` : '';
    throw new Error(
      `${prefix}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function assertStatus(
  res: { status: number; rawText?: string },
  expected: number | number[],
  context?: string,
): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(res.status)) {
    const prefix = context ? `${context}: ` : '';
    const snippet = res.rawText ? ` | body=${res.rawText.slice(0, 600)}` : '';
    throw new Error(
      `${prefix}expected HTTP status ${allowed.join(' or ')}, got ${res.status}${snippet}`,
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertJson<T = any>(
  res: { status: number; data: unknown; rawText?: string },
  expectedStatus: number | number[],
  predicate?: (data: T) => unknown,
): T {
  assertStatus(res, expectedStatus);
  if (res.data === null || res.data === undefined) {
    throw new Error(
      `Expected JSON response body (status=${res.status}), got ${res.rawText ?? String(res.data)}`,
    );
  }
  const typed = res.data as T;
  if (predicate) {
    const outcome = predicate(typed);
    if (outcome === false) {
      throw new Error(
        `Response JSON predicate returned false (status=${res.status}): ${res.rawText ?? JSON.stringify(typed)}`,
      );
    }
  }
  return typed;
}

// ── Crypto, Passwords & Webhook Signatures ────────────────────────────────────

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function signRazorpayWebhook(
  secret: string,
  rawBody: string | Buffer,
): Record<string, string> {
  return {
    'x-razorpay-signature': hmacSha256Hex(secret, rawBody),
  };
}

export function signRazorpayPayment(
  keySecret: string,
  orderId: string,
  paymentId: string,
): string {
  return hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
}

export function signSwiggyWebhook(
  secret: string,
  rawBody: string | Buffer,
): Record<string, string> {
  return {
    'x-swiggy-signature': hmacSha256Hex(secret, rawBody),
  };
}

export function signZomatoWebhook(
  secret: string,
  rawBody: string | Buffer,
  header: 'x-zomato-signature' | 'x-zomato-auth' = 'x-zomato-signature',
): Record<string, string> {
  return {
    [header]: hmacSha256Hex(secret, rawBody),
  };
}

export function hashBcrypt(password: string, rounds = 10): string {
  return bcrypt.hashSync(password, rounds);
}

export function hashScrypt(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(
        `scrypt$N=16384,r=8,p=1$${salt.toString('hex')}$${derivedKey.toString('hex')}`,
      );
    });
  });
}

// ── WebSocket Frame Queue & Handle Helpers ────────────────────────────────────

interface PendingWaiter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  predicate: (msg: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (msg: any) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export interface WsFrameQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly frames: any[];
  readonly closed: boolean;
  readonly closeCode: number | undefined;
  readonly closeReason: string | undefined;
  readonly error: Error | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitFor: <T = any>(predicate: (msg: any) => boolean, timeoutMs?: number) => Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collect: (durationMs: number) => Promise<any[]>;
}

function decodeWsRawData(data: RawData): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

export function createWsFrameQueue(ws: WebSocket): WsFrameQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frames: any[] = [];
  const waiters: PendingWaiter[] = [];
  let closed = false;
  let closeCode: number | undefined;
  let closeReason: string | undefined;
  let socketError: Error | undefined;

  const rejectAllWaiters = (reason: Error): void => {
    while (waiters.length > 0) {
      const w = waiters.shift()!;
      clearTimeout(w.timer);
      w.reject(reason);
    }
  };

  ws.on('message', (raw: RawData) => {
    const text = decodeWsRawData(raw);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { _raw: text };
    }

    for (let i = 0; i < waiters.length; i += 1) {
      const waiter = waiters[i];
      let matched = false;
      try {
        matched = waiter.predicate(parsed);
      } catch {
        matched = false;
      }
      if (matched) {
        waiters.splice(i, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(parsed);
        return;
      }
    }

    frames.push(parsed);
  });

  ws.on('error', (err: Error) => {
    socketError = err;
    rejectAllWaiters(err);
  });

  ws.on('close', (code: number, reasonBuf: Buffer) => {
    closed = true;
    closeCode = code;
    closeReason = reasonBuf.toString('utf8');
    rejectAllWaiters(
      new Error(`WebSocket closed before matching frame (code=${code}, reason=${closeReason})`),
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waitFor = <T = any>(predicate: (msg: any) => boolean, timeoutMs = 5000): Promise<T> => {
    for (let i = 0; i < frames.length; i += 1) {
      if (predicate(frames[i])) {
        const [hit] = frames.splice(i, 1);
        return Promise.resolve(hit as T);
      }
    }

    if (socketError) {
      return Promise.reject(socketError);
    }
    if (closed) {
      return Promise.reject(
        new Error(
          `WebSocket already closed (code=${closeCode ?? 'unknown'}, reason=${closeReason ?? ''})`,
        ),
      );
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = waiters.indexOf(entry);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for WebSocket frame (buffered=${frames.length})`,
          ),
        );
      }, timeoutMs);

      const entry: PendingWaiter = {
        predicate,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve: resolve as (msg: any) => void,
        reject,
        timer,
      };
      waiters.push(entry);
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collect = async (durationMs: number): Promise<any[]> => {
    await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
    return frames.splice(0, frames.length);
  };

  return {
    get frames() {
      return frames;
    },
    get closed() {
      return closed;
    },
    get closeCode() {
      return closeCode;
    },
    get closeReason() {
      return closeReason;
    },
    get error() {
      return socketError;
    },
    waitFor,
    collect,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function waitForWsFrame<T = any>(
  queue: WsFrameQueue,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  predicate: (msg: any) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  return queue.waitFor<T>(predicate, timeoutMs);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function collectWsFrames(queue: WsFrameQueue, durationMs: number): Promise<any[]> {
  return queue.collect(durationMs);
}

export interface WsHandle {
  ws: WebSocket;
  url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connected: any;
  queue: WsFrameQueue;
  send(msg: unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitForMessage<T = any>(predicate: (msg: any) => boolean, timeoutMs?: number): Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collectMessages(durationMs: number): Promise<any[]>;
  close(): Promise<void>;
}

export function buildWsHandle(
  ws: WebSocket,
  url: string,
  queue: WsFrameQueue,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connected: any,
): WsHandle {
  return {
    ws,
    url,
    connected,
    queue,
    send(msg: unknown): void {
      const payload = typeof msg === 'string' ? msg : JSON.stringify(msg);
      ws.send(payload);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waitForMessage<T = any>(predicate: (msg: any) => boolean, timeoutMs = 5000): Promise<T> {
      return waitForWsFrame<T>(queue, predicate, timeoutMs);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collectMessages(durationMs: number): Promise<any[]> {
      return collectWsFrames(queue, durationMs);
    },
    async close(): Promise<void> {
      if (ws.readyState === WebSocket.CLOSED) return;
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = (): void => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          try {
            ws.terminate();
          } catch {
            // ignore
          }
          finish();
        }, 2000);

        ws.once('close', finish);
        try {
          ws.close();
        } catch {
          try {
            ws.terminate();
          } catch {
            // ignore
          }
          finish();
        }
      });
    },
  };
}

// ── Shared Process & Temp-Dir Cleanup Registry ────────────────────────────────

export interface ManagedProcessResource {
  proc: ChildProcess;
  tmpDir: string;
  keepTempDir: boolean;
}

const managedResources = new Set<ManagedProcessResource>();
let globalHooksInstalled = false;

export function killChildTreeSync(pid: number | undefined): void {
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // Process may have already exited
  }
}

export function removeTempDirSync(tmpDir: string): void {
  if (!tmpDir) return;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Best-effort during synchronous exit hook
  }
}

export async function removeTempDirWithRetry(
  tmpDir: string,
  attempts = 15,
  delayMs = 150,
): Promise<void> {
  if (!tmpDir || !fs.existsSync(tmpDir)) return;
  for (let i = 0; i < attempts; i += 1) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      const isRetryable = code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY';
      if (!isRetryable || i === attempts - 1) {
        throw err;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function cleanupAllManagedSync(): void {
  for (const res of Array.from(managedResources)) {
    if (res.proc.exitCode === null && res.proc.signalCode === null) {
      killChildTreeSync(res.proc.pid);
    }
    if (!res.keepTempDir) {
      removeTempDirSync(res.tmpDir);
    }
    managedResources.delete(res);
  }
}

function ensureGlobalCleanupHooks(): void {
  if (globalHooksInstalled) return;
  globalHooksInstalled = true;

  process.on('exit', () => {
    cleanupAllManagedSync();
  });

  process.on('SIGINT', () => {
    cleanupAllManagedSync();
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    cleanupAllManagedSync();
    process.exit(143);
  });
}

export function registerManagedResource(resource: ManagedProcessResource): void {
  ensureGlobalCleanupHooks();
  managedResources.add(resource);
}

export function unregisterManagedResource(resource: ManagedProcessResource): void {
  managedResources.delete(resource);
}
