/**
 * Migration v92 coverage: Persistent Outbound Aggregator Outbox
 */
const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');

let activeTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-migration-v92-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => activeTestDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const { initDatabase, getDatabase, getCurrentSchemaVersion, closeDatabase } = require('../main/db');
const {
  enqueueAggregatorOutbox,
  processAggregatorOutbox,
  sendAggregatorOutboundAction,
} = require('../main/services/aggregator-service');
const {
  swiggyMockAdapter,
  zomatoMockAdapter,
  initAggregatorSimulators,
} = require('../main/services/aggregator-simulator');

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function run() {
  console.log('=== Migration v92 & Aggregator Outbox Test Suite ===\n');

  try {
    initDatabase();
    const db = getDatabase();

    // 1. Schema version check
    const currentVersion = getCurrentSchemaVersion();
    assert(currentVersion >= 92, `Current schema version is >= 92 (actual: ${currentVersion})`);

    // 2. Table structure check
    const tableInfo = db.prepare('PRAGMA table_info(aggregator_outbox)').all() as any[];
    const columnNames = tableInfo.map((c: any) => c.name);
    assert(columnNames.includes('id'), 'aggregator_outbox has column id');
    assert(columnNames.includes('platform'), 'aggregator_outbox has column platform');
    assert(columnNames.includes('external_order_id'), 'aggregator_outbox has column external_order_id');
    assert(columnNames.includes('action'), 'aggregator_outbox has column action');
    assert(columnNames.includes('payload_json'), 'aggregator_outbox has column payload_json');
    assert(columnNames.includes('status'), 'aggregator_outbox has column status');
    assert(columnNames.includes('attempts'), 'aggregator_outbox has column attempts');
    assert(columnNames.includes('last_error'), 'aggregator_outbox has column last_error');
    assert(columnNames.includes('created_at'), 'aggregator_outbox has column created_at');

    // 3. Indexes check
    const indexList = db.prepare('PRAGMA index_list(aggregator_outbox)').all() as any[];
    const indexNames = indexList.map((i: any) => i.name);
    assert(indexNames.includes('idx_aggregator_outbox_status_created'), 'index idx_aggregator_outbox_status_created exists');
    assert(indexNames.includes('idx_aggregator_outbox_platform_order'), 'index idx_aggregator_outbox_platform_order exists');

    // 4. Enqueue and process outbound message
    initAggregatorSimulators();
    swiggyMockAdapter.clearRecordedActions();

    const outboxId = enqueueAggregatorOutbox('swiggy', 'SW-MIG-001', 'accept', { prep_time_minutes: 25 });
    assert(typeof outboxId === 'string' && outboxId.startsWith('aout_'), 'enqueueAggregatorOutbox returns formatted id');

    const pendingRow = db.prepare('SELECT status, attempts FROM aggregator_outbox WHERE id = ?').get(outboxId) as any;
    assert(pendingRow.status === 'pending', 'initial status is pending');
    assert(pendingRow.attempts === 0, 'initial attempts is 0');

    // Process outbox
    const processResult = await processAggregatorOutbox();
    assert(processResult.succeeded >= 1, 'processAggregatorOutbox succeeded at least 1 item');

    const sentRow = db.prepare('SELECT status, attempts, last_error FROM aggregator_outbox WHERE id = ?').get(outboxId) as any;
    assert(sentRow.status === 'sent', 'processed item status transitioned to sent');
    assert(sentRow.last_error === null, 'sent item has no last_error');

    const recorded = swiggyMockAdapter.getRecordedActions();
    assert(recorded.length === 1, 'mock adapter recorded 1 action');
    assert(recorded[0].action === 'accept', 'recorded action is accept');
    assert(recorded[0].externalOrderId === 'SW-MIG-001', 'recorded externalOrderId matches');

    // 5. Simulated failure and retry increment
    swiggyMockAdapter.setSimulatedFailure('ready', 'Swiggy API Gateway Timeout 504');
    const failOutboxId = enqueueAggregatorOutbox('swiggy', 'SW-MIG-002', 'ready', {});

    const failProcess = await processAggregatorOutbox();
    assert(failProcess.failed >= 1, 'processAggregatorOutbox counted failed item');

    const failedRow = db.prepare('SELECT status, attempts, last_error FROM aggregator_outbox WHERE id = ?').get(failOutboxId) as any;
    assert(failedRow.attempts === 1, 'failed item attempts incremented to 1');
    assert(failedRow.status === 'pending', 'failed item remains pending for retry');
    assert(failedRow.last_error.includes('Gateway Timeout'), 'last_error captured failure message');

    // Clear failure and retry
    swiggyMockAdapter.setSimulatedFailure('ready', undefined);
    const retryProcess = await processAggregatorOutbox();
    assert(retryProcess.succeeded >= 1, 'retried item succeeded');

    const retriedRow = db.prepare('SELECT status, last_error FROM aggregator_outbox WHERE id = ?').get(failOutboxId) as any;
    assert(retriedRow.status === 'sent', 'retried item transitioned to sent');

  } catch (err: any) {
    console.error('Test execution exception:', err);
    failed++;
  } finally {
    closeDatabase();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed of ${total} assertions`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
