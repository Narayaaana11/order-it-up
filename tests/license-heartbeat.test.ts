import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-heartbeat-'));
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: true,
        getPath: () => testDir,
        getVersion: () => '1.0.0',
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const { initDatabase, closeDatabase, getDatabase, now } = require('../main/db');
const { licenseHeartbeat } = require('../main/services/license-heartbeat');
const { subscriptionService } = require('../main/services/subscription');

async function run(): Promise<void> {
  initDatabase(':memory:');
  const db = getDatabase();

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    // Configure cloud credentials + stale timestamp (> 24h ago)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    upsert.run('cloud_base_url', 'https://cloud.example.invalid', now());
    upsert.run('cloud_auth_token', 'test-token-123', now());
    upsert.run('subscription_last_checked_at', twoDaysAgo, now());

    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          status: 'active',
          plan: 'pro',
          current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          license_key: 'CLOUD-PRO-TEST',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    await licenseHeartbeat.forceCheck();
    assert.equal(fetchCalls, 1, 'Should fetch from cloud when last check > 24h');

    const info = subscriptionService.getSubscriptionInfo();
    assert.equal(info.status, 'active');
    assert.equal(info.plan, 'pro');
    assert.equal(info.licenseKey, 'CLOUD-PRO-TEST');

    // Second check immediately should be skipped (< 23.5h since last check)
    await licenseHeartbeat.forceCheck();
    assert.equal(fetchCalls, 1, 'Should skip fetch when checked recently');

    // Simulate offline failure with stale cache — must remain operational (no hard brick)
    upsert.run('subscription_last_checked_at', twoDaysAgo, now());
    globalThis.fetch = (async () => {
      throw new Error('ENOTFOUND');
    }) as typeof fetch;
    await licenseHeartbeat.forceCheck();
    const offlineInfo = subscriptionService.getSubscriptionInfo();
    assert.equal(offlineInfo.isOperational, true, 'Offline POS must stay operational during network outage');

    console.log('license-heartbeat.test.ts PASSED');
  } finally {
    licenseHeartbeat.stop();
    globalThis.fetch = originalFetch;
    closeDatabase();
    Module._load = originalLoad;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

void run();
