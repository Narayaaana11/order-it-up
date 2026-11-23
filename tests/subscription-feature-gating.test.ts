/** Integration tests for Subscription Plan feature gating and offline-first boundary. */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-subscription-gating-test-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') {
    return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  }
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer, seedOwnerUser, api, closeDatabase,
} = require('./helpers/test-setup');
const { registerRoutes } = require('../main/routes/index');
const { subscriptionService } = require('../main/services/subscription');
const assert = require('node:assert');

async function testSubscriptionFeatureGating() {
  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);
  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    console.log('[Test] 1. Initial State: Default trial (Pro tier, operational)');
    const initialInfo = subscriptionService.getSubscriptionInfo();
    assert.strictEqual(initialInfo.isOperational, true);
    assert.strictEqual(initialInfo.plan, 'pro');
    assert.strictEqual(subscriptionService.hasFeature('inventoryTracking'), true);
    assert.strictEqual(subscriptionService.hasFeature('kdsStations'), true);
    assert.strictEqual(subscriptionService.hasFeature('multiOutlet'), false);

    console.log('[Test] 2. Cloud Subscription Sync: downgrade to Starter plan');
    subscriptionService.syncFromCloud({
      status: 'active',
      plan: 'starter',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    });

    const starterInfo = subscriptionService.getSubscriptionInfo();
    assert.strictEqual(starterInfo.plan, 'starter');
    assert.strictEqual(starterInfo.status, 'active');
    assert.strictEqual(subscriptionService.hasFeature('inventoryTracking'), false);
    assert.strictEqual(subscriptionService.hasFeature('kdsStations'), false);

    console.log('[Test] 3. Verify Route Gating on Starter: Inventory endpoints return 403');
    const invRes = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'GET',
      headers: authHeader,
    });
    assert.strictEqual(invRes.status, 403, `Expected 403 on Starter plan, got ${invRes.status}`);
    assert.strictEqual(invRes.data?.code, 'FEATURE_NOT_ENTITLED');
    assert.strictEqual(invRes.data?.feature, 'inventoryTracking');

    console.log('[Test] 4. Upgrade to Enterprise via cloud sync');
    subscriptionService.syncFromCloud({
      status: 'active',
      plan: 'enterprise',
      current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
    });

    const entInfo = subscriptionService.getSubscriptionInfo();
    assert.strictEqual(entInfo.plan, 'enterprise');
    assert.strictEqual(subscriptionService.hasFeature('inventoryTracking'), true);
    assert.strictEqual(subscriptionService.hasFeature('multiOutlet'), true);

    console.log('[Test] 5. Verify Route Access on Enterprise: Inventory succeeds (200 OK)');
    const invResEnt = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'GET',
      headers: authHeader,
    });
    assert.strictEqual(invResEnt.status, 200, `Expected 200 on Enterprise plan, got ${invResEnt.status}`);
    assert.strictEqual(invResEnt.data?.ok, true);

    console.log('[Test] 6. Offline-first Invariant: Expired status restricts features but NEVER crashes core orders');
    subscriptionService.updateSubscription({
      status: 'expired',
      plan: 'starter',
      currentPeriodEnd: new Date(Date.now() - 86400000).toISOString(),
    });

    const expiredInfo = subscriptionService.getSubscriptionInfo();
    assert.strictEqual(expiredInfo.isOperational, false);

    // Gated feature is rejected with SUBSCRIPTION_NOT_OPERATIONAL
    const invResExpired = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'GET',
      headers: authHeader,
    });
    assert.strictEqual(invResExpired.status, 403);
    assert.strictEqual(invResExpired.data?.code, 'SUBSCRIPTION_NOT_OPERATIONAL');

    // Core POS order listing remains non-blocked and functional for business continuity
    const ordersRes = await api(baseUrl, '/api/orders', {
      method: 'GET',
      headers: authHeader,
    });
    assert.strictEqual(ordersRes.status, 200, 'Core orders endpoint must stay operational when expired');

    console.log('All subscription feature gating tests passed successfully.');
  } finally {
    server.close();
    closeDatabase();
  }
}

testSubscriptionFeatureGating().catch((err) => {
  console.error('[FATAL] Subscription feature gating test failed:', err);
  process.exit(1);
});
