/**
 * System Diagnostics & Health Endpoint Integration Test
 *
 * Verifies that:
 * 1. GET /api/system/health returns complete database, storage, queue, and memory metrics.
 * 2. SQLite WAL checkpointing can be queried and triggered via POST /api/system/wal-checkpoint.
 * 3. Health report reflects database schema version and queue counts.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/system-health.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-sys-health-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => '1.0.0' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser,
  api, assert, assertEqual,
  closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');

async function main() {
  console.log('=== System Diagnostics & Health Test Suite ===\n');

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // 1. GET /api/system/health
    console.log('--- 1. Testing GET /api/system/health ---');
    const resHealth = await api(baseUrl, '/api/system/health', {
      headers: authHeader,
    });

    assertEqual(resHealth.status, 200, 'Health endpoint returned 200 OK');
    assertEqual(resHealth.data.status, 'ok', 'Status is ok');
    assert(Boolean(resHealth.data.timestamp), 'Timestamp is provided');
    assert(typeof resHealth.data.uptime_seconds === 'number', 'Uptime seconds is a number');

    // Database metrics
    const dbMetrics = resHealth.data.database;
    assert(Boolean(dbMetrics), 'database metrics object is present');
    assertEqual(dbMetrics.ok, true, 'database.ok is true');
    assert(dbMetrics.schema_version >= 92, `schema_version is >= 92 (actual: ${dbMetrics.schema_version})`);
    assertEqual(dbMetrics.integrity, 'ok', 'integrity is ok');
    assert(typeof dbMetrics.size_bytes === 'number', 'size_bytes is a number');
    assert(typeof dbMetrics.wal_size_bytes === 'number', 'wal_size_bytes is a number');
    assert(Boolean(dbMetrics.wal_checkpoint), 'wal_checkpoint is present');

    // Queue metrics
    const queueMetrics = resHealth.data.queues;
    assert(Boolean(queueMetrics), 'queues metrics object is present');
    assert(typeof queueMetrics.aggregator_outbox_pending === 'number', 'aggregator_outbox_pending is a number');
    assert(typeof queueMetrics.cloud_sync_outbox_pending === 'number', 'cloud_sync_outbox_pending is a number');

    // Memory metrics
    const memMetrics = resHealth.data.memory;
    assert(Boolean(memMetrics), 'memory metrics object is present');
    assert(memMetrics.heap_used_bytes > 0, 'heap_used_bytes > 0');

    // 2. POST /api/system/wal-checkpoint
    console.log('\n--- 2. Testing POST /api/system/wal-checkpoint ---');
    const resCheckpoint = await api(baseUrl, '/api/system/wal-checkpoint', {
      method: 'POST',
      headers: authHeader,
    });

    assertEqual(resCheckpoint.status, 200, 'WAL checkpoint endpoint returned 200 OK');
    assertEqual(resCheckpoint.data.ok, true, 'Checkpoint returned ok: true');
    assert(Boolean(resCheckpoint.data.checkpoint), 'Checkpoint details returned');
    assert(typeof resCheckpoint.data.checkpoint.checkpointed === 'number', 'checkpointed count is a number');

    console.log('\nAll System Health & Diagnostics tests passed successfully!');
  } finally {
    server.close();
    closeDatabase();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
