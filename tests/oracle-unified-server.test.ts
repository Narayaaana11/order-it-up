import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import WebSocket from 'ws';
import { D1SqliteAdapter } from '../backend/src/db/d1-sqlite-adapter';
import { startUnifiedServer } from '../backend/src/index';
import { hashPassword } from '../backend/src/api/auth';

async function run(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-oracle-test-'));
  const dbPath = path.join(tmpDir, 'test-oiu.db');
  const backupDir = path.join(tmpDir, 'backups');
  const staticDir = path.join(tmpDir, 'static');
  fs.mkdirSync(staticDir, { recursive: true });
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<html><body>OIU Oracle Static OK</body></html>');

  // 1. Test D1SqliteAdapter batch atomicity
  {
    const adapter = new D1SqliteAdapter(':memory:');
    await adapter.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    await adapter.batch([
      adapter.prepare('INSERT INTO items (id, name) VALUES (?, ?)').bind(1, 'Dosa'),
      adapter.prepare('INSERT INTO items (id, name) VALUES (?, ?)').bind(2, 'Idli'),
    ]);
    const rows = await adapter.prepare('SELECT * FROM items ORDER BY id').all<{ id: number; name: string }>();
    assert.equal(rows.results.length, 2);
    assert.equal(rows.results[0].name, 'Dosa');
    adapter.close();
  }

  const adminPassHash = await hashPassword('OracleAdmin123!');
  const jwtSecret = 'oracle-unified-server-jwt-secret-32-chars-minimum-ok';
  const adminJwtSecret = 'oracle-unified-admin-jwt-secret-32-chars-minimum-diff';

  const running = await startUnifiedServer({
    port: 0,
    host: '127.0.0.1',
    dbPath,
    backupDir,
    staticDirs: [staticDir],
    envOverrides: {
      ENVIRONMENT: 'development',
      ALLOW_SELF_SERVICE_REGISTRATION: 'true',
      JWT_SECRET: jwtSecret,
      PLATFORM_ADMIN_EMAIL: 'platform-admin@orderitup.in',
      PLATFORM_ADMIN_PASSWORD_HASH: adminPassHash,
      PLATFORM_ADMIN_JWT_SECRET: adminJwtSecret,
      FRONTEND_ORIGIN: 'http://127.0.0.1',
    },
  });

  const baseUrl = `http://127.0.0.1:${running.port}`;

  try {
    // 2. Health & Readiness
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as any;
    assert.equal(healthJson.status, 'operational');
    assert.match(healthJson.engine, /Oracle Cloud/);

    const readyRes = await fetch(`${baseUrl}/ready`);
    assert.equal(readyRes.status, 200);
    const readyJson = (await readyRes.json()) as any;
    assert.equal(readyJson.status, 'ready');

    // 3. Static web serving & path traversal protection
    const staticRes = await fetch(`${baseUrl}/`);
    assert.equal(staticRes.status, 200);
    const staticHtml = await staticRes.text();
    assert.match(staticHtml, /OIU Oracle Static OK/);

    const traversalRes = await fetch(`${baseUrl}/../../package.json`);
    assert.notEqual(traversalRes.status, 200);

    // 4. Tenant registration & login
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_name: 'Oracle Bistro',
        owner_name: 'Asha Rao',
        email: 'asha@oraclebistro.in',
        password: 'StrongPassword123!',
        branch_name: 'Main Kitchen',
      }),
    });
    assert.equal(regRes.status, 201, `Expected 201 on register, got ${regRes.status}: ${await regRes.clone().text()}`);
    const regJson = (await regRes.json()) as any;
    const token: string = regJson.token;
    const branchId: string = regJson.branch.id;
    assert.ok(token && token.length > 20);
    assert.ok(branchId);

    // 5. Connect WebSocket client to /ws/kds and verify real-time order broadcast
    const wsUrl = `ws://127.0.0.1:${running.port}/ws/kds?token=${encodeURIComponent(token)}&branch_id=${encodeURIComponent(branchId)}`;
    const ws = new WebSocket(wsUrl);

    const receivedEvents: any[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connect timeout')), 5000);
      ws.on('message', (raw) => {
        const msg = JSON.parse(String(raw));
        receivedEvents.push(msg);
        if (msg.type === 'connected') {
          clearTimeout(timeout);
          resolve();
        }
      });
      ws.on('error', reject);
    });

    // Unauthorized WS connection must fail
    const badWs = new WebSocket(`ws://127.0.0.1:${running.port}/ws/kds?token=invalid-token`);
    await new Promise<void>((resolve) => {
      badWs.on('error', () => resolve());
      badWs.on('unexpected-response', () => resolve());
      badWs.on('close', () => resolve());
    });

    // Create a table & product, then create an order
    const tableRes = await fetch(`${baseUrl}/api/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        branch_id: branchId,
        table_number: 'T-01',
        capacity: 4,
      }),
    });
    assert.ok(tableRes.status === 200 || tableRes.status === 201, `Table create status: ${tableRes.status}`);

    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        branch_id: branchId,
        order_type: 'dine_in',
        table_number: 'T-01',
        items: [
          {
            product_name: 'Masala Dosa',
            quantity: 2,
            unit_price: 150,
            tax_rate: 5,
          },
        ],
      }),
    });
    assert.ok(orderRes.status === 200 || orderRes.status === 201, `Order create status: ${orderRes.status}: ${await orderRes.clone().text()}`);

    // Wait briefly for WS event
    await new Promise((r) => setTimeout(r, 150));
    const orderEvent = receivedEvents.find((e) => e.type === 'order:created');
    assert.ok(orderEvent, `Expected order:created WS event, got: ${JSON.stringify(receivedEvents)}`);

    ws.close();

    // 6. Manual SQLite online backup endpoint
    const backupPostRes = await fetch(`${baseUrl}/api/admin/backups`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(backupPostRes.status, 201);
    const backupPostJson = (await backupPostRes.json()) as any;
    assert.equal(backupPostJson.success, true);
    assert.ok(backupPostJson.backup.sizeBytes > 0);

    const backupListRes = await fetch(`${baseUrl}/api/admin/backups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(backupListRes.status, 200);
    const backupListJson = (await backupListRes.json()) as any;
    assert.ok(backupListJson.backups.length >= 1);

    console.log('✅ All Oracle Unified Server E2E assertions passed!');
  } finally {
    await running.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('❌ Oracle Unified Server E2E test failed:', err);
  process.exit(1);
});
