/**
 * Regression coverage: the local POS API must not fabricate global SaaS data.
 * Run with: node tests/run-electron-node-test.cjs tests/admin-platform-data.test.ts
 */
const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-admin-platform-test-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

process.env.OIU_ADMIN_JWT_SECRET = 'test-only-central-admin-jwt-secret-with-more-than-32-characters';
process.env.OIU_ADMIN_BOOTSTRAP_EMAIL = 'platform-admin@test.local';
process.env.OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH = require('bcryptjs').hashSync('TestOnly-Admin-Password-2026!', 10);
process.env.OIU_ADMIN_BOOTSTRAP_NAME = 'Test Platform Admin';

const express = require('express');
const {
  initTestDb, startServer, api, assert, assertEqual, getResults, closeDatabase,
} = require('./helpers/test-setup');
const { adminRoutes } = require('../main/admin/routes');
const { generateAdminToken } = require('../main/admin/auth');

async function main() {
  console.log('Central Admin: no fabricated SaaS tenant data');
  console.log('='.repeat(55));

  initTestDb();
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  const adminToken = generateAdminToken({
    id: 'env-bootstrap-admin',
    email: 'platform-admin@test.local',
    name: 'Test Platform Admin',
    role: 'SUPER_ADMIN',
  });
  const headers = { Authorization: `Bearer ${adminToken}` };
  const { baseUrl, server } = await startServer(app);

  try {
    const metrics = await api(baseUrl, '/api/admin/metrics', { headers });
    assertEqual(metrics.status, 200, 'Admin metrics endpoint remains available for local health');
    assertEqual(metrics.data.metrics.tenantMetricsAvailable, false, 'Global tenant metrics explicitly report unavailable');
    assertEqual(metrics.data.metrics.totalStores, null, 'Global store count is not fabricated');
    assertEqual(metrics.data.metrics.activeStores, null, 'Global active-store count is not fabricated');
    assertEqual(metrics.data.metrics.totalTerminals, null, 'Global terminal count is not fabricated');
    assertEqual(metrics.data.metrics.estimatedMrrInr, null, 'Global MRR is not fabricated');

    const tenants = await api(baseUrl, '/api/admin/tenants', { headers });
    assertEqual(tenants.status, 503, 'Global tenant directory fails closed until cloud source is configured');
    assertEqual(tenants.data.availability, 'unavailable', 'Tenant directory explains unavailable state');
    assertEqual(tenants.data.tenants.length, 0, 'No demo tenants are returned');

    const plan = await api(baseUrl, '/api/admin/tenants/store_demo/plan', {
      method: 'POST',
      headers,
      body: { plan: 'enterprise', status: 'active' },
    });
    assertEqual(plan.status, 503, 'Global subscription changes are blocked without authoritative cloud control plane');
  } finally {
    server.close();
    closeDatabase();
    Module._load = originalLoad;
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  const results = getResults();
  console.log(`\\nResults: ${results.passed}/${results.total} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  try { closeDatabase(); } catch {}
  Module._load = originalLoad;
  fs.rmSync(testDir, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
