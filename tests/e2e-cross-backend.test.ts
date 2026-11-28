import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import WebSocket from 'ws';

const Module = require('module');
const originalLoad = Module._load;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-cross-backend-e2e-'));
const posUserDataDir = path.join(tmpDir, 'pos-data');
fs.mkdirSync(posUserDataDir, { recursive: true });

const rootBetterSqlite3 = path.resolve(__dirname, '..', 'node_modules', 'better-sqlite3');

Module._load = function (requestName: string, parent: unknown, isMain: boolean) {
  if (requestName === 'better-sqlite3' && process.versions?.electron) {
    return originalLoad.call(this, rootBetterSqlite3, parent, isMain);
  }
  if (requestName === 'electron') {
    return {
      app: {
        isPackaged: true,
        getPath: () => posUserDataDir,
        getVersion: () => 'test-e2e',
      },
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: (s: string) => Buffer.from(s, 'utf8'),
        decryptString: (b: Buffer) => b.toString('utf8'),
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

import { startUnifiedServer } from '../backend/src/index';
import { hashPassword } from '../backend/src/api/auth';
import { initDatabase, closeDatabase, getDatabase } from '../main/db';
import { startServer, stopServer, getServerPort } from '../main/server';
import { startKdsServer, stopKdsServer, getKdsPort } from '../main/kds-server';
import { startServerApp, stopServerApp, getServerAppPort } from '../main/server-app';

async function expectWsRejected(wsUrl: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    ws.on('open', () => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error(`Expected WebSocket rejection for ${wsUrl}, but connection opened`));
      }
    });
    ws.on('unexpected-response', () => done());
    ws.on('error', () => done());
    ws.on('close', () => done());
  });
}

async function run(): Promise<void> {
  const cloudDbPath = path.join(tmpDir, 'cloud-unified.db');
  const cloudBackupDir = path.join(tmpDir, 'cloud-backups');
  const jwtSecret = 'cross-backend-e2e-jwt-secret-32-chars-minimum-ok';
  const adminJwtSecret = 'cross-backend-e2e-admin-secret-32-chars-minimum';
  const adminPassHash = await hashPassword('CrossAdmin123!');

  // 1. Start live standalone unified backend (backend/)
  const unified = await startUnifiedServer({
    port: 0,
    host: '127.0.0.1',
    dbPath: cloudDbPath,
    backupDir: cloudBackupDir,
    envOverrides: {
      ENVIRONMENT: 'development',
      ALLOW_SELF_SERVICE_REGISTRATION: 'true',
      JWT_SECRET: jwtSecret,
      PLATFORM_ADMIN_EMAIL: 'admin@orderitup.in',
      PLATFORM_ADMIN_PASSWORD_HASH: adminPassHash,
      PLATFORM_ADMIN_JWT_SECRET: adminJwtSecret,
      FRONTEND_ORIGIN: 'http://127.0.0.1',
    },
  });

  // 2. Start live local POS backend (main/: Express API, KDS, Server App)
  initDatabase();
  await startServer();
  await startKdsServer();
  await startServerApp();

  const cloudUrl = `http://127.0.0.1:${unified.port}`;
  const posUrl = `http://127.0.0.1:${getServerPort()}`;
  const kdsUrl = `http://127.0.0.1:${getKdsPort()}`;
  const serverAppUrl = `http://127.0.0.1:${getServerAppPort()}`;

  try {
    // ── A. Health checks across all live services ───────────────────────────
    const [cloudHealth, cloudReady, posHealth, kdsHealth, serverAppHealth] = await Promise.all([
      fetch(`${cloudUrl}/health`),
      fetch(`${cloudUrl}/ready`),
      fetch(`${posUrl}/api/health`),
      fetch(`${kdsUrl}/api/health`),
      fetch(`${serverAppUrl}/api/health`),
    ]);
    assert.equal(cloudHealth.status, 200);
    assert.equal(cloudReady.status, 200);
    assert.equal(posHealth.status, 200);
    assert.equal(kdsHealth.status, 200);
    assert.equal(serverAppHealth.status, 200);

    // ── B. Register tenant on Unified Backend & test Admin Backups ──────────
    const regRes = await fetch(`${cloudUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_name: 'Cross Backend Kitchen',
        owner_name: 'Vikram Dev',
        email: 'vikram@crossbackend.in',
        password: 'StrongPassword123!',
        branch_name: 'Flagship Branch',
      }),
    });
    assert.equal(regRes.status, 201, `Register failed: ${await regRes.clone().text()}`);
    const regJson = (await regRes.json()) as any;
    const cloudToken: string = regJson.token;
    const branchId: string = regJson.branch.id;
    const orgId: string =
      regJson.organization?.id ||
      regJson.organization_id ||
      regJson.branch?.organization_id ||
      regJson.user?.organization_id;
    assert.ok(cloudToken && branchId && orgId);

    // Upgrade organization subscription to enterprise so cloudSync & QR ordering entitlements are active
    const periodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await unified.adapter
      .prepare(
        `UPDATE organization_subscriptions
            SET plan_code = 'enterprise',
                status = 'active',
                current_period_end = ?
          WHERE organization_id = ?`
      )
      .bind(periodEndIso, orgId)
      .run();

    const backupPost = await fetch(`${cloudUrl}/api/admin/backups`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cloudToken}` },
    });
    assert.equal(backupPost.status, 201);
    const backupList = await fetch(`${cloudUrl}/api/admin/backups`, {
      headers: { Authorization: `Bearer ${cloudToken}` },
    });
    assert.equal(backupList.status, 200);
    const backupListJson = (await backupList.json()) as any;
    assert.ok(Array.isArray(backupListJson.backups) && backupListJson.backups.length >= 1);

    // ── C. 6-Digit Zero-Config Terminal Pairing (Unified Backend -> POS) ────
    const genPairRes = await fetch(`${cloudUrl}/api/pairing/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cloudToken}`,
      },
      body: JSON.stringify({ branch_id: branchId, terminal_name: 'POS-Front-1' }),
    });
    assert.ok(genPairRes.status === 200 || genPairRes.status === 201, `Pair generate failed: ${await genPairRes.clone().text()}`);
    const genPairJson = (await genPairRes.json()) as any;
    assert.match(genPairJson.code, /^\d{6}$/);

    const claimPairRes = await fetch(`${cloudUrl}/api/pos/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: genPairJson.code, hardware_id: 'hw-e2e-pos-01' }),
    });
    assert.equal(claimPairRes.status, 200, `Pair claim failed: ${await claimPairRes.clone().text()}`);
    const claimPairJson = (await claimPairRes.json()) as any;
    const terminalToken: string = claimPairJson.terminal_token;
    assert.ok(terminalToken && terminalToken.length > 20);

    // ── D. Local POS (main/) Order -> Bill -> Payment -> Sync to Backend ────
    const posDb = getDatabase();
    const bcrypt = require('bcryptjs');
    const ownerPassHash = bcrypt.hashSync('PosOwner123!', 10);
    posDb
      .prepare(
        `INSERT INTO users (id, name, email, password, role, is_active)
         VALUES ('pos-owner-1', 'POS Owner', 'owner@pos.local', ?, 'owner', 1)`
      )
      .run(ownerPassHash);
    posDb
      .prepare(
        `INSERT INTO categories (id, name, sort_order, is_active, created_at, updated_at)
         VALUES ('cat-1', 'Mains', 1, 1, datetime('now'), datetime('now'))`
      )
      .run();
    posDb
      .prepare(
        `INSERT INTO products (id, category_id, name, price, is_active, created_at, updated_at)
         VALUES ('prod-1', 'cat-1', 'Paneer Tikka', 250, 1, datetime('now'), datetime('now'))`
      )
      .run();

    const posLoginRes = await fetch(`${posUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@pos.local', password: 'PosOwner123!' }),
    });
    assert.equal(posLoginRes.status, 200);
    const posLoginJson = (await posLoginRes.json()) as any;
    const posToken: string = posLoginJson.access_token;
    assert.ok(posToken);

    const posOrderRes = await fetch(`${posUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${posToken}`,
      },
      body: JSON.stringify({
        type: 'takeaway',
        items: [{ product_id: 'prod-1', quantity: 2 }],
      }),
    });
    assert.equal(posOrderRes.status, 201, `POS order create failed: ${await posOrderRes.clone().text()}`);
    const posOrderJson = (await posOrderRes.json()) as any;
    const posOrderId = posOrderJson.order.id;
    assert.equal(posOrderJson.order.subtotal, 500);

    const posBillRes = await fetch(`${posUrl}/api/bills/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${posToken}`,
      },
      body: JSON.stringify({ order_id: posOrderId }),
    });
    assert.equal(posBillRes.status, 201, `POS bill generate failed: ${await posBillRes.clone().text()}`);
    const posBillJson = (await posBillRes.json()) as any;
    const posBillId = posBillJson.bill.id;
    const posBillTotal = posBillJson.bill.total;

    const posPayRes = await fetch(`${posUrl}/api/bills/${posBillId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${posToken}`,
      },
      body: JSON.stringify({ method: 'cash', amount: posBillTotal }),
    });
    assert.equal(posPayRes.status, 200);
    const posPayJson = (await posPayRes.json()) as any;
    assert.equal(posPayJson.bill.payment_status, 'paid');

    // Sync the settled POS order to Unified Backend
    const syncEventId = `sync-evt-${Date.now()}`;
    const syncedOrderId = `pos-ord-${posOrderId}`;
    const nowIso = new Date().toISOString();
    const syncRes = await fetch(`${cloudUrl}/api/pos/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${terminalToken}`,
      },
      body: JSON.stringify({
        events: [
          {
            id: syncEventId,
            type: 'order_created',
            entity_id: syncedOrderId,
            created_at: nowIso,
            payload: {
              id: syncedOrderId,
              order_number: posOrderJson.order.order_number || `ORD-${posOrderId}`,
              order_type: 'takeaway',
              status: 'completed',
              subtotal: posOrderJson.order.subtotal,
              tax_total: posOrderJson.order.tax || 0,
              discount_total: 0,
              grand_total: posBillTotal,
              payment_method: 'cash',
              payment_status: 'paid',
              ordered_at: nowIso,
              completed_at: nowIso,
              items: [
                {
                  id: `item-${posOrderId}-1`,
                  product_id: 'prod-1',
                  product_name: 'Paneer Tikka',
                  quantity: 2,
                  unit_price: 250,
                  subtotal: 500,
                  tax_amount: 0,
                },
              ],
            },
          },
        ],
      }),
    });
    assert.equal(syncRes.status, 200, `Cloud sync failed: ${await syncRes.clone().text()}`);
    const syncJson = (await syncRes.json()) as any;
    assert.equal(syncJson.processed_count, 1, `Expected 1 processed event, got: ${JSON.stringify(syncJson)}`);
    assert.equal(syncJson.failed_count, 0);

    // ── E. Catalog + Table + Public QR Order -> Live WebSocket Broadcast ────
    const catRes = await fetch(`${cloudUrl}/api/catalog/product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cloudToken}`,
      },
      body: JSON.stringify({
        name: 'Masala Chai',
        base_price: 40,
        tax_rate: 5,
        is_active: true,
      }),
    });
    assert.ok(catRes.status === 200 || catRes.status === 201, `Catalog product create failed: ${await catRes.clone().text()}`);
    const catJson = (await catRes.json()) as any;
    const cloudProductId = catJson.product?.id || catJson.id;
    assert.ok(cloudProductId);

    const tableRes = await fetch(`${cloudUrl}/api/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cloudToken}`,
      },
      body: JSON.stringify({ branch_id: branchId, table_number: 'T-07', capacity: 4 }),
    });
    assert.ok(tableRes.status === 200 || tableRes.status === 201);
    const tableJson = (await tableRes.json()) as any;
    const tableId = tableJson.table?.id || tableJson.id;
    assert.ok(tableId);

    const qrGenRes = await fetch(`${cloudUrl}/api/qr/tables/${tableId}/code`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cloudToken}` },
    });
    assert.ok(qrGenRes.status === 200 || qrGenRes.status === 201, `Table QR gen failed: ${await qrGenRes.clone().text()}`);
    const qrGenJson = (await qrGenRes.json()) as any;
    const tableToken: string = qrGenJson.table_token || qrGenJson.token;
    assert.ok(tableToken);

    // Connect authenticated KDS and POS WebSockets
    const kdsWs = new WebSocket(
      `ws://127.0.0.1:${unified.port}/ws/kds?token=${encodeURIComponent(cloudToken)}&branch_id=${encodeURIComponent(branchId)}`
    );
    const kdsEvents: any[] = [];
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('KDS WS connect timeout')), 5000);
      kdsWs.on('message', (raw) => {
        const msg = JSON.parse(String(raw));
        kdsEvents.push(msg);
        if (msg.type === 'connected') {
          clearTimeout(t);
          resolve();
        }
      });
      kdsWs.on('error', reject);
    });

    // Submit public QR order -> triggers real-time WS broadcast & POS delivery lease
    const qrOrderRes = await fetch(`${cloudUrl}/api/qr/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tableToken}`,
        'Idempotency-Key': `qr-e2e-idem-${Date.now()}`,
      },
      body: JSON.stringify({
        table_id: tableId,
        customer_name: 'Guest E2E',
        items: [{ product_id: cloudProductId, quantity: 2 }],
      }),
    });
    assert.equal(qrOrderRes.status, 201, `Public QR order failed: ${await qrOrderRes.clone().text()}`);

    await new Promise((r) => setTimeout(r, 200));
    const qrWsEvent = kdsEvents.find((e) => e.type === 'order:created');
    assert.ok(qrWsEvent, `Expected KDS WS order:created for public QR order, got: ${JSON.stringify(kdsEvents)}`);

    const posQrPoll = await fetch(`${cloudUrl}/api/pos/qr-orders`, {
      headers: { Authorization: `Bearer ${terminalToken}` },
    });
    assert.equal(posQrPoll.status, 200);
    const posQrPollJson = (await posQrPoll.json()) as any;
    assert.ok(Array.isArray(posQrPollJson.orders) && posQrPollJson.orders.length >= 1);

    kdsWs.close();

    // ── F. Security Negative Tests: Unauthorized branch & revoked JWT ───────
    await expectWsRejected(
      `ws://127.0.0.1:${unified.port}/ws/kds?token=${encodeURIComponent(cloudToken)}&branch_id=nonexistent-branch-id`
    );

    const logoutRes = await fetch(`${cloudUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cloudToken}` },
    });
    assert.equal(logoutRes.status, 200);

    const revokedHttpRes = await fetch(`${cloudUrl}/api/admin/backups`, {
      headers: { Authorization: `Bearer ${cloudToken}` },
    });
    assert.equal(revokedHttpRes.status, 401);

    await expectWsRejected(
      `ws://127.0.0.1:${unified.port}/ws/kds?token=${encodeURIComponent(cloudToken)}&branch_id=${encodeURIComponent(branchId)}`
    );

    console.log('✅ All Cross-Backend Live E2E assertions passed!');
  } finally {
    await unified.stop();
    stopServer();
    stopKdsServer();
    stopServerApp();
    closeDatabase();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup races on Windows
    }
  }
}

run().catch((err) => {
  console.error('❌ Cross-Backend Live E2E test failed:', err);
  process.exit(1);
});
