/** Cloud Worker pairing and Desktop POS outbox contract regression. */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-cloud-terminal-pairing-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};
const request = require('supertest');
const { initTestDb, seedOwnerUser, assert, assertEqual, getDatabase, now, createApp, closeDatabase } = require('./helpers/test-setup');
const { settingsRoutes } = require('../main/routes/settings');
const { databaseRoutes } = require('../main/routes/database');
const { cloudSync } = require('../main/services/cloud-sync');

async function run() {
  const originalFetch = globalThis.fetch;
  try {
    initTestDb();
    const db = getDatabase();
    const owner = seedOwnerUser(db);
    const app = createApp({ '/api/settings': settingsRoutes, '/api/database': databaseRoutes });
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('cloud_sync_enabled', '1', ?) ON CONFLICT(key) DO UPDATE SET value='1'`).run(now());
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      calls.push({ url: target, init });
      if (target.endsWith('/api/pos/pair')) {
        return new Response(JSON.stringify({
          success: true, terminal_id: 'terminal-1', terminal_token: 'secret-terminal-token',
          organization_id: 'org-1', organization_name: 'Restaurant', branch_id: 'branch-1', branch_name: 'Main',
          currency: 'INR', timezone: 'Asia/Kolkata',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (target.endsWith('/api/pos/disconnect')) return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (target.endsWith('/api/pos/events')) {
        return new Response(JSON.stringify({ success: true, processed_count: 1, failed_count: 1, synced_ids: ['event-accepted'], server_time: new Date().toISOString() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected Cloud API call: ${target}`);
    }) as typeof fetch;

    const invalid = await request(app).post('/api/settings/cloud/terminal/pair').set(owner.authHeader).send({ code: '123' });
    assertEqual(invalid.status, 400, 'pairing rejects malformed PIN');
    assertEqual(calls.length, 0, 'malformed PIN does not reach Cloud API');

    const paired = await request(app).post('/api/settings/cloud/terminal/pair').set(owner.authHeader).send({ code: '123 456' });
    assertEqual(paired.status, 200, 'owner can claim a Cloud Worker terminal pairing code');
    assertEqual(paired.body.branch_name, 'Main', 'pair response includes the assigned branch name');
    assert(!JSON.stringify(paired.body).includes('secret-terminal-token'), 'terminal bearer token is never returned to renderer');
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_terminal_token'").get().value, 'secret-terminal-token', 'terminal bearer token is stored locally');
    assert(String(calls[0].url).startsWith('https://orderitup-cloud-api.narayaaana11.workers.dev/'), 'pair claim uses the deployed Worker API origin');
    assertEqual(JSON.parse(String(calls[0].init?.body)).code, '123456', 'pair claim sends normalized six-digit PIN');

    const insert = db.prepare(`INSERT INTO cloud_sync_outbox (id,event_type,entity_type,entity_id,payload,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,'{}','pending',0,?,?)`);
    for (const id of ['event-accepted', 'event-rejected']) insert.run(id, 'inventory.updated', 'inventory', id, now(), now());
    await cloudSync.flushOutbox();
    const batchCall = calls.find((call) => call.url.endsWith('/api/pos/events'))!;
    assert(Boolean(batchCall), 'desktop outbox sends a batch to Cloud Worker');
    assertEqual((batchCall.init?.headers as Record<string, string>).Authorization, 'Bearer secret-terminal-token', 'outbox authenticates with terminal bearer credential');
    const body = JSON.parse(String(batchCall.init?.body));
    assertEqual(body.pos_hash, undefined, 'Cloud Worker terminal batches do not send legacy POS hashes');
    assertEqual(db.prepare("SELECT status FROM cloud_sync_outbox WHERE id='event-accepted'").get().status, 'delivered', 'Cloud accepted event is marked delivered');
    assertEqual(db.prepare("SELECT status FROM cloud_sync_outbox WHERE id='event-rejected'").get().status, 'failed', 'Cloud rejected event remains retryable');

    const publicSettings = await request(app).get('/api/settings').set(owner.authHeader);
    assert(!JSON.stringify(publicSettings.body).includes('secret-terminal-token'), 'generic settings API does not expose terminal bearer token');
    const exported = await request(app).get('/api/database/export').set(owner.authHeader);
    assertEqual(exported.status, 200, 'owner can export a data backup');
    assert(!exported.text.includes('secret-terminal-token'), 'database export redacts terminal bearer token');
    const disconnected = await request(app).post('/api/settings/cloud/terminal/disconnect').set(owner.authHeader).send({});
    assertEqual(disconnected.status, 200, 'owner can revoke and disconnect the paired POS terminal');
    const revokeCall = calls.find((call) => call.url.endsWith('/api/pos/disconnect'))!;
    assertEqual((revokeCall.init?.headers as Record<string, string>).Authorization, 'Bearer secret-terminal-token', 'disconnect is authenticated with this terminal credential');
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_terminal_token'").get().value, '', 'disconnected terminal credential is cleared locally');
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_sync_enabled'").get().value, '0', 'terminal disconnect stops outbox sync');
    db.prepare("UPDATE settings SET value='test-restored-token' WHERE key='cloud_terminal_token'").run();
    db.prepare("UPDATE settings SET value='1' WHERE key IN ('cloud_sync_enabled','cloud_orders_enabled')").run();
    const { captureRestoreProtectedSettings, mergeRestoreProtectedSettings } = require('../main/db');
    const protectedSettings = captureRestoreProtectedSettings(db);
    assertEqual(protectedSettings.find((entry: any) => entry.key === 'cloud_terminal_token')?.present, false, 'terminal token is excluded from restore snapshots');
    assertEqual(protectedSettings.find((entry: any) => entry.key === 'cloud_terminal_token')?.value, null, 'terminal token value is omitted from restore snapshots');
    mergeRestoreProtectedSettings(db, protectedSettings);
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_terminal_token'").get().value, '', 'restore leaves the Worker credential unpaired');
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_sync_enabled'").get().value, '0', 'restore pauses Worker sync until terminal re-pairing');
    console.log('Cloud terminal pairing and outbox contract passed');
  } finally {
    globalThis.fetch = originalFetch;
    cloudSync.stop();
    try { closeDatabase(); } catch { }
    Module._load = originalLoad;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}
run().catch((error) => { try { closeDatabase(); } catch { } Module._load = originalLoad; fs.rmSync(testDir, { recursive: true, force: true }); console.error(error); process.exit(1); });
