import fs from 'node:fs';
import WebSocket from 'ws';
import { startLocalPos, type LocalPosHarness } from '../lib/local-pos-harness';
import { startUnifiedBackend, type UnifiedBackendHarness } from '../lib/unified-backend-harness';
import {
  assert,
  assertEqual,
  assertJson,
  registerTest,
} from '../lib/test-kit';

function expectWsRejected401(wsUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      reject(new Error(`Timed out waiting for 401 rejection on ${wsUrl}`));
    }, 5000);

    ws.once('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      reject(new Error(`Expected 401 rejection on ${wsUrl}, but WebSocket opened`));
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

registerTest({
  id: 'harness-smoke:unified-backend-http-ws-cleanup',
  tier: 1,
  feature: 'Harness Smoke',
  title: 'Unified Backend boots isolated, handles admin/org/plan/WS, and cleans up temp dir',
  smoke: true,
  async run(): Promise<void> {
    let harness: UnifiedBackendHarness | undefined;
    let tmpDir = '';

    try {
      harness = await startUnifiedBackend();
      tmpDir = harness.tmpDir;

      assert(harness.port >= 18100, `Expected port >= 18100, got ${harness.port}`);
      assert(fs.existsSync(harness.tmpDir), 'Expected tmpDir to exist while running');
      assert(fs.existsSync(harness.dbPath), 'Expected isolated unified.db to exist');

      const healthRes = await harness.request('/health');
      assertJson(healthRes, 200, (d) => d.status === 'operational' && d.service === 'orderitup-unified-server');

      const readyRes = await harness.request('/ready');
      assertJson(readyRes, 200, (d) => d.status === 'ready');

      const adminToken1 = await harness.platformAdminLogin();
      const adminToken2 = await harness.platformAdminLogin();
      assert(adminToken1.length > 20, 'Expected non-empty platform admin JWT');
      assertEqual(adminToken2, adminToken1, 'Expected cached platform admin token');

      const org = await harness.registerOrg({
        restaurantName: 'Smoke Cloud Bistro',
        ownerName: 'Smoke Owner',
      });
      assert(org.token.length > 20, 'Expected org auth JWT');
      assert(typeof org.tenant?.id === 'string' && org.tenant.id.length > 0, 'Expected tenant id');
      assert(typeof org.branch?.id === 'string' && org.branch.id.length > 0, 'Expected branch id');

      const upgraded = await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      assertEqual(upgraded?.ok, true, 'Expected upgradeOrgPlan ok=true');
      assertEqual(upgraded?.tenant?.subscription?.plan_code, 'pro', 'Expected plan_code=pro');

      const kdsWs = await harness.wsConnect('/ws/kds', org.token, { branch_id: org.branch.id });
      try {
        assertEqual(kdsWs.connected?.channel, 'kds', 'Expected KDS WS channel');
        kdsWs.send({ type: 'ping' });
        const pong = await kdsWs.waitForMessage((m) => m?.type === 'pong', 5000);
        assertEqual(pong.type, 'pong');
      } finally {
        await kdsWs.close();
      }

      const posWs = await harness.wsConnect('/ws/pos', org.token, { branch_id: org.branch.id });
      try {
        assertEqual(posWs.connected?.channel, 'pos', 'Expected POS WS channel');
        posWs.send({ type: 'ping' });
        const pong = await posWs.waitForMessage((m) => m?.type === 'pong', 5000);
        assertEqual(pong.type, 'pong');
      } finally {
        await posWs.close();
      }

      const unauthStatus = await expectWsRejected401(`ws://127.0.0.1:${harness.port}/ws/kds`);
      assertEqual(unauthStatus, 401, 'Expected 401 on unauthenticated /ws/kds');

      await harness.stop();
      assert(!fs.existsSync(tmpDir), `Expected tmpDir ${tmpDir} to be removed after stop()`);
    } finally {
      if (harness) {
        await harness.stop();
      }
    }
  },
});

registerTest({
  id: 'harness-smoke:local-pos-http-ws-cleanup',
  tier: 1,
  feature: 'Harness Smoke',
  title: 'Local POS boots isolated, serves all 3 health endpoints, setup/login/plan/KDS WS, and cleans up',
  smoke: true,
  async run(): Promise<void> {
    let harness: LocalPosHarness | undefined;
    let tmpDir = '';

    try {
      harness = await startLocalPos();
      tmpDir = harness.tmpDir;

      assert(
        harness.portsRequested.main >= 13100 &&
          harness.portsRequested.kds >= harness.portsRequested.main + 10 &&
          harness.portsRequested.serverApp >= harness.portsRequested.kds + 10,
        `Expected spaced requested ports >= 13100, got ${JSON.stringify(harness.portsRequested)}`,
      );
      assert(fs.existsSync(harness.tmpDir), 'Expected Local POS tmpDir to exist while running');
      assert(fs.existsSync(harness.dbPath), 'Expected isolated Local POS oiu.db to exist');

      const mainHealth = await harness.request('main', '/api/health');
      assertJson(
        mainHealth,
        200,
        (d) => d.status === 'ok' && d.db === 'ok' && d.service === 'Order It Up Local API',
      );

      const kdsHealth = await harness.request('kds', '/api/health');
      assertJson(
        kdsHealth,
        200,
        (d) => d.status === 'ok' && d.service === 'Order It Up KDS Server',
      );

      const serverAppHealth = await harness.request('serverApp', '/api/health');
      assertJson(
        serverAppHealth,
        200,
        (d) => d.status === 'ok' && d.service === 'Order It Up Server App',
      );

      const owner = await harness.setupOwner({
        name: 'Smoke Local Owner',
        business_name: 'Smoke Local Bistro',
      });
      assert(owner.token.length > 20, 'Expected owner setup access_token');
      assertEqual(owner.user?.role, 'owner', 'Expected owner role');

      const loginRes = await harness.login(owner.email, owner.password, 'main');
      assert(loginRes.token.length > 20, 'Expected owner login access_token');

      const subRes = await harness.activatePlan('DEV-PRO', owner.token);
      assertEqual(subRes?.ok, true, 'Expected activatePlan ok=true');
      assertEqual(subRes?.subscription?.plan, 'pro', 'Expected pro plan activated');

      const kdsWs = await harness.wsKds(owner.token, 'kds');
      try {
        assertEqual(kdsWs.connected?.type, 'connected');
        assertEqual(kdsWs.authSuccess?.type, 'auth_success');
        assertEqual(kdsWs.initialData?.type, 'initial_data');

        kdsWs.send({ type: 'ping' });
        const pong = await kdsWs.waitForMessage((m) => m?.type === 'pong', 5000);
        assertEqual(pong.type, 'pong');
      } finally {
        await kdsWs.close();
      }

      await harness.stop();
      assert(!fs.existsSync(tmpDir), `Expected tmpDir ${tmpDir} to be removed after stop()`);
    } finally {
      if (harness) {
        await harness.stop();
      }
    }
  },
});
