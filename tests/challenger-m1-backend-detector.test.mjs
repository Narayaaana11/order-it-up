/**
 * Challenger Test Suite for Milestone M1
 * File: tests/challenger-m1-backend-detector.test.mjs
 *
 * Empirical Stress-Testing:
 * 1. Live vs unreachable endpoints (1500ms timeout, ECONNREFUSED)
 * 2. Mixed Content / Browser Network Error simulation (TypeError: Failed to fetch)
 * 3. Zero unhandled promise rejections oracle
 * 4. AbortSignal pre-aborted and mid-flight cancellation
 * 5. Malformed HTTP responses (500, 404, HTML body, non-string JSON)
 * 6. Concurrency burst (30 concurrent checks)
 * 7. SSR Hydration & snapshot determinism in dashboard-store
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Set NODE_PATH dynamically so resolution works cleanly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Import target modules using dynamic import with relative path
const detectorModulePath = path.join(ROOT, 'landing', 'src', 'lib', 'backend-detector.ts');
const storeModulePath = path.join(ROOT, 'landing', 'src', 'lib', 'dashboard-store.ts');

const {
  checkBackendHealth,
  probeSingleEndpoint,
  getBackendStatusLabel,
  INITIAL_HEALTH_STATUS,
  DEFAULT_PROBE_TIMEOUT_MS,
} = await import(`file://${detectorModulePath.replace(/\\/g, '/')}`);

const {
  getDashboardServerSnapshot,
  getDashboardSnapshot,
  INITIAL_DASHBOARD_STATE,
  hydrateDashboardStore,
  dashboardActions,
} = await import(`file://${storeModulePath.replace(/\\/g, '/')}`);

describe('Challenger M1: Backend Detector & SSR Hydration Stress Tests', () => {
  let liveServer;
  let livePort;
  let slowServer;
  let slowPort;
  let errorServer;
  let errorPort;
  let garbageServer;
  let garbagePort;

  const unhandledRejections = [];
  const rejectionHandler = (reason) => {
    unhandledRejections.push(reason);
  };

  before(async () => {
    process.on('unhandledRejection', rejectionHandler);

    // 1. Live Healthy Server
    liveServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ service: 'Order It Up POS Engine', version: '1.2.0' }));
    });
    await new Promise((resolve) => liveServer.listen(0, '127.0.0.1', resolve));
    livePort = liveServer.address().port;

    // 2. Slow / Hanging Server (deliberately exceeds timeout)
    slowServer = http.createServer((req, res) => {
      // Deliberately hold connection open without sending response
    });
    await new Promise((resolve) => slowServer.listen(0, '127.0.0.1', resolve));
    slowPort = slowServer.address().port;

    // 3. HTTP 500 Error Server
    errorServer = http.createServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });
    await new Promise((resolve) => errorServer.listen(0, '127.0.0.1', resolve));
    errorPort = errorServer.address().port;

    // 4. Garbage Non-JSON 200 Server
    garbageServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body><h1>Gateway</h1></body></html>');
    });
    await new Promise((resolve) => garbageServer.listen(0, '127.0.0.1', resolve));
    garbagePort = garbageServer.address().port;
  });

  after(async () => {
    process.removeListener('unhandledRejection', rejectionHandler);
    await Promise.all([
      new Promise((resolve) => liveServer.close(resolve)),
      new Promise((resolve) => slowServer.close(resolve)),
      new Promise((resolve) => errorServer.close(resolve)),
      new Promise((resolve) => garbageServer.close(resolve)),
    ]);
  });

  describe('1. Endpoint Probing Invariants & Health Detection', () => {
    it('successfully detects live healthy endpoint with latency and metadata', async () => {
      const res = await probeSingleEndpoint(`http://127.0.0.1:${livePort}/api/health`, 1000);
      assert.strictEqual(res.connected, true, 'Live endpoint should report connected: true');
      assert.ok(typeof res.latencyMs === 'number' && res.latencyMs >= 1, 'Latency should be a positive number');
      assert.strictEqual(res.service, 'Order It Up POS Engine', 'Service name should match payload');
      assert.strictEqual(res.version, '1.2.0', 'Version should match payload');
      assert.strictEqual(res.error, undefined, 'No error should be present');
    });

    it('gracefully handles unreachable endpoint (ECONNREFUSED) without throwing', async () => {
      // Port 59999 has no listener
      const res = await probeSingleEndpoint('http://127.0.0.1:59999/api/health', 500);
      assert.strictEqual(res.connected, false, 'Unreachable endpoint should report connected: false');
      assert.ok(res.error, 'Error message should be populated');
      assert.match(res.error, /Network \/ Mixed Content blocked/, 'Should map connection failure to clean message');
    });

    it('enforces timeout with AbortController on hanging endpoints', async () => {
      const start = Date.now();
      const res = await probeSingleEndpoint(`http://127.0.0.1:${slowPort}/api/health`, 200);
      const elapsed = Date.now() - start;

      assert.strictEqual(res.connected, false, 'Hanging endpoint should report connected: false');
      assert.match(res.error, /Timeout after 200ms/, 'Error message should indicate timeout');
      assert.ok(elapsed >= 180 && elapsed < 800, `Elapsed time should be close to 200ms, was ${elapsed}ms`);
    });

    it('handles HTTP 500 status cleanly', async () => {
      const res = await probeSingleEndpoint(`http://127.0.0.1:${errorPort}/api/health`, 500);
      assert.strictEqual(res.connected, false, '500 error should report connected: false');
      assert.match(res.error, /HTTP 500/, 'Error should describe HTTP 500');
    });

    it('handles non-JSON HTTP 200 response without parsing crash', async () => {
      const res = await probeSingleEndpoint(`http://127.0.0.1:${garbagePort}/api/health`, 500);
      assert.strictEqual(res.connected, true, 'HTTP 200 with HTML should still report connected: true');
      assert.strictEqual(res.service, 'Order It Up Local Service', 'Should fall back to default service title');
    });
  });

  describe('2. Multi-Service Aggregation & Mixed Mode Status', () => {
    it('elevates to mode: live when at least one endpoint is connected', async () => {
      const result = await checkBackendHealth({
        api: `http://127.0.0.1:${livePort}/api/health`,
        kds: 'http://127.0.0.1:59999/api/health', // dead
        waiter: 'http://127.0.0.1:59999/api/health', // dead
      }, 500);

      assert.strictEqual(result.status.mode, 'live', 'Mode should be live if any service is connected');
      assert.strictEqual(result.status.apiConnected, true);
      assert.strictEqual(result.status.kdsConnected, false);
      assert.strictEqual(result.status.waiterConnected, false);
      assert.ok(typeof result.status.latencyMs === 'number');

      const label = getBackendStatusLabel(result.status);
      assert.match(label, /Live Engine Active: :3001 POS/);
    });

    it('elevates to mode: live and picks minimum latency when non-API service is connected', async () => {
      const result = await checkBackendHealth({
        api: 'http://127.0.0.1:59999/api/health', // dead
        kds: `http://127.0.0.1:${livePort}/api/health`, // live
        waiter: 'http://127.0.0.1:59999/api/health', // dead
      }, 500);

      assert.strictEqual(result.status.mode, 'live');
      assert.strictEqual(result.status.apiConnected, false);
      assert.strictEqual(result.status.kdsConnected, true);
      assert.strictEqual(result.status.waiterConnected, false);
      assert.ok(typeof result.status.latencyMs === 'number');

      const label = getBackendStatusLabel(result.status);
      assert.match(label, /Live Engine Active: :3002 KDS/);
    });

    it('falls back cleanly to mode: standalone when all endpoints are dead', async () => {
      const result = await checkBackendHealth({
        api: 'http://127.0.0.1:59999/api/health',
        kds: 'http://127.0.0.1:59998/api/health',
        waiter: 'http://127.0.0.1:59997/api/health',
      }, 300);

      assert.strictEqual(result.status.mode, 'standalone');
      assert.strictEqual(result.status.apiConnected, false);
      assert.strictEqual(result.status.kdsConnected, false);
      assert.strictEqual(result.status.waiterConnected, false);
      assert.strictEqual(result.status.latencyMs, undefined);

      const label = getBackendStatusLabel(result.status);
      assert.match(label, /Standalone Simulation Mode • Offline Edge Sandbox/);
    });
  });

  describe('3. Mixed Content & Browser Sandbox Simulation (Cloudflare Pages)', () => {
    it('simulates TypeError: Failed to fetch (Active Mixed Content Block) with zero unhandled rejections', async () => {
      const originalFetch = globalThis.fetch;
      try {
        // Mock fetch throwing exact browser Mixed Content TypeError
        globalThis.fetch = async () => {
          throw new TypeError('Failed to fetch');
        };

        const result = await checkBackendHealth({
          api: 'http://127.0.0.1:3001/api/health',
          kds: 'http://127.0.0.1:3002/api/health',
          waiter: 'http://127.0.0.1:3003/api/health',
        }, 500);

        assert.strictEqual(result.status.mode, 'standalone');
        assert.strictEqual(result.status.apiConnected, false);
        assert.strictEqual(result.status.kdsConnected, false);
        assert.strictEqual(result.status.waiterConnected, false);
        assert.strictEqual(result.details.api.error, 'Network / Mixed Content blocked');
        assert.strictEqual(result.details.kds.error, 'Network / Mixed Content blocked');
        assert.strictEqual(result.details.waiter.error, 'Network / Mixed Content blocked');

        // Check unhandled rejections oracle
        assert.strictEqual(unhandledRejections.length, 0, 'No unhandled promise rejections must occur');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('simulates NetworkError (CORS preflight rejection) with zero unhandled rejections', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          throw new TypeError('NetworkError when attempting to fetch resource.');
        };

        const result = await checkBackendHealth({}, 500);
        assert.strictEqual(result.status.mode, 'standalone');
        assert.strictEqual(unhandledRejections.length, 0, 'Zero unhandled rejections on CORS block');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('4. AbortSignal & Cancellation Semantics', () => {
    it('handles pre-aborted parent signal immediately without hanging', async () => {
      const preAborted = AbortSignal.abort();
      const start = Date.now();
      const result = await checkBackendHealth({
        api: `http://127.0.0.1:${slowPort}/api/health`,
        kds: `http://127.0.0.1:${slowPort}/api/health`,
        waiter: `http://127.0.0.1:${slowPort}/api/health`,
      }, 5000, preAborted);
      const elapsed = Date.now() - start;

      assert.strictEqual(result.status.mode, 'standalone');
      assert.ok(elapsed < 200, `Pre-aborted check should resolve immediately, took ${elapsed}ms`);
    });

    it('aborts cleanly when parent signal triggers mid-flight', async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50);

      const start = Date.now();
      const result = await checkBackendHealth({
        api: `http://127.0.0.1:${slowPort}/api/health`,
      }, 3000, controller.signal);
      const elapsed = Date.now() - start;
      clearTimeout(timer);

      assert.strictEqual(result.status.mode, 'standalone');
      assert.ok(elapsed < 600, `Mid-flight abort should terminate promptly, took ${elapsed}ms`);
    });
  });

  describe('5. Concurrency & Stress Load', () => {
    it('survives burst of 30 concurrent health checks without socket starvation or unhandled rejections', async () => {
      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(
          checkBackendHealth({
            api: i % 2 === 0 ? `http://127.0.0.1:${livePort}/api/health` : 'http://127.0.0.1:59999/api/health',
            kds: `http://127.0.0.1:${livePort}/api/health`,
            waiter: 'http://127.0.0.1:59999/api/health',
          }, 800)
        );
      }

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 30);
      results.forEach((r) => {
        assert.strictEqual(r.status.mode, 'live', 'Should detect live services under concurrent load');
      });
      assert.strictEqual(unhandledRejections.length, 0, 'Zero unhandled rejections under concurrent burst');
    });
  });

  describe('6. SSR Hydration & Snapshot Determinism (dashboard-store)', () => {
    it('guarantees getDashboardServerSnapshot returns isHydrated: false deterministically', () => {
      const serverSnap1 = getDashboardServerSnapshot();
      const serverSnap2 = getDashboardServerSnapshot();

      assert.strictEqual(serverSnap1.isHydrated, false, 'Server snapshot must have isHydrated: false');
      assert.strictEqual(serverSnap2.isHydrated, false, 'Server snapshot must have isHydrated: false');
      assert.strictEqual(serverSnap1.activeRole, 'owner');
      assert.strictEqual(serverSnap1.activePerspective, 'merchant');
      assert.strictEqual(serverSnap1.outlets.length, 3, 'Must have 3 initial outlets');
    });

    it('safely tolerates hydrateDashboardStore when window is undefined (SSR pass)', () => {
      // In Node.js environment, window is undefined by default
      assert.strictEqual(typeof window, 'undefined');
      assert.doesNotThrow(() => {
        hydrateDashboardStore();
      }, 'hydrateDashboardStore must not throw in SSR / Node.js environment');
    });

    it('safely handles simulated corrupted localStorage in browser environment', () => {
      const mockStorage = {
        getItem: () => '{ invalid-json-payload',
        setItem: () => {},
      };

      globalThis.window = {
        addEventListener: () => {},
      };
      globalThis.localStorage = mockStorage;

      try {
        assert.doesNotThrow(() => {
          hydrateDashboardStore();
        }, 'Should safely catch corrupted localStorage without throwing');
      } finally {
        delete globalThis.window;
        delete globalThis.localStorage;
      }
    });

    it('operational state mutations remain synchronous, pure and intact', () => {
      const snapshot = getDashboardSnapshot();
      assert.ok(snapshot.orders.length >= 4, 'Seed data must contain orders');
      assert.ok(snapshot.tables.length >= 8, 'Seed data must contain tables');

      // Test license key generator oracle
      const targetTenantId = snapshot.tenants[0].id;
      const lic = dashboardActions.generateLicenseKey(targetTenantId, 'enterprise', 'A1B2');
      assert.strictEqual(typeof lic, 'string', 'generateLicenseKey should return license key string');
      assert.match(lic, /^OIUP-ENT1-A1B2-[0-9A-Z]{4}$/, 'Generated license must match contract format');

      const updatedSnap = getDashboardSnapshot();
      const tenant = updatedSnap.tenants.find((t) => t.id === targetTenantId);
      assert.ok(tenant, `Tenant ${targetTenantId} must exist`);
      assert.ok(tenant.licenseKeys.some((l) => l.key === lic), 'License key must be registered on tenant');
    });
  });
});
