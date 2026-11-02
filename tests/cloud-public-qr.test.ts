import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import worker from '../apps/cloud-api/src/index';
import { createJWT, hashString } from '../apps/cloud-api/src/auth';

class D1SqliteAdapter {
  constructor(private readonly sqlite: Database.Database) {}

  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql);
    let args: unknown[] = [];
    const adapter: any = {
      bind: (...values: unknown[]) => { args = values; return adapter; },
      first: async (column?: string) => {
        const row = statement.get(...args) as Record<string, unknown> | undefined;
        return column ? row?.[column] ?? null : row ?? null;
      },
      all: async () => ({ success: true, results: statement.all(...args) }),
      run: async () => {
        const result = statement.run(...args);
        return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
      },
      __run: () => statement.run(...args),
    };
    return adapter;
  }

  async batch(statements: any[]) {
    const execute = this.sqlite.transaction(() => statements.map((statement) => statement.__run()));
    return execute();
  }
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-cloud-qr-'));
  const sqlite = new Database(path.join(tempDir, 'cloud.db'));
  sqlite.pragma('foreign_keys = ON');
  const migrationsDir = path.join(process.cwd(), 'apps', 'cloud-api', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
  for (const file of migrationFiles) sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));

  const now = new Date().toISOString();
  sqlite.prepare('INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('org-qr', 'QR Restaurant', 'INR', 'IN', 'Asia/Kolkata', now, now);
  sqlite.prepare('INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('rest-qr', 'org-qr', 'QR Restaurant', 'main', 'dine_in', 'active', now, now);
  sqlite.prepare('INSERT INTO branches (id, organization_id, restaurant_id, code, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('branch-qr', 'org-qr', 'rest-qr', 'MAIN', 'Main Branch', 'active', now, now);
  sqlite.prepare('INSERT INTO cloud_users (id, organization_id, email, name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('owner-qr', 'org-qr', 'owner@example.test', 'Owner', 'owner', 'active', now, now);
  sqlite.prepare('INSERT INTO memberships (id, organization_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('membership-qr', 'org-qr', 'owner-qr', 'owner', 'active', now, now);
  sqlite.prepare('INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('server-qr', 'org-qr', 'server@example.test', 'Server', 'server', 'branch-qr', 'active', now, now);
  sqlite.prepare('INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('membership-server-qr', 'org-qr', 'server-qr', 'rest-qr', 'branch-qr', 'server', 'active', now, now);
  sqlite.prepare('INSERT INTO dining_tables (id, organization_id, restaurant_id, branch_id, table_number, capacity, status, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('table-qr', 'org-qr', 'rest-qr', 'branch-qr', '12', 4, 'available', 1, now, now);
  sqlite.prepare('INSERT INTO master_categories (id, organization_id, name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('category-qr', 'org-qr', 'Desserts', 1, 1, now, now);
  sqlite.prepare('INSERT INTO master_products (id, organization_id, category_id, name, base_price, tax_rate, is_active, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('product-qr', 'org-qr', 'category-qr', 'Gulab Jamun', 100, 5, 1, 1, now, now);
  sqlite.prepare('INSERT INTO branch_product_overrides (branch_id, product_id, price_override, is_available, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('branch-qr', 'product-qr', 120, 1, now);
  sqlite.prepare(`INSERT INTO master_addon_groups (id, organization_id, name, description, is_required, allow_multiple_quantities, min_selection, max_selection, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, NULL, 1, 0, 1, 1, 0, 1, ?, ?)`)
    .run('group-size', 'org-qr', 'Size', now, now);
  sqlite.prepare(`INSERT INTO master_addons (id, organization_id, addon_group_id, name, price, is_active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`)
    .run('addon-large', 'org-qr', 'group-size', 'Large', 20, now, now);
  sqlite.prepare('INSERT INTO master_product_addon_groups (organization_id, product_id, addon_group_id, sort_order, created_at) VALUES (?, ?, ?, 0, ?)')
    .run('org-qr', 'product-qr', 'group-size', now);
  sqlite.prepare('INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('org-other', 'Other Tenant', 'INR', 'IN', 'Asia/Kolkata', now, now);
  sqlite.prepare(`INSERT INTO master_addon_groups (id, organization_id, name, is_required, min_selection, max_selection, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, 1, ?, ?)`)
    .run('foreign-group', 'org-other', 'Foreign Group', now, now);
  assert.throws(() => sqlite.prepare('INSERT INTO master_product_addon_groups (organization_id, product_id, addon_group_id, sort_order, created_at) VALUES (?, ?, ?, 0, ?)')
    .run('org-qr', 'product-qr', 'foreign-group', now), /different organization/, 'D1 schema prevents cross-tenant modifier links');

  const env: any = {
    DB: new D1SqliteAdapter(sqlite),
    JWT_SECRET: 'test-cloud-secret-with-more-than-32-bytes-123456',
    ENVIRONMENT: 'test',
    FRONTEND_ORIGIN: 'https://app.orderitup.in,https://orderitup.pages.dev',
  };
  const ownerToken = await createJWT({
    sub: 'owner-qr', org: 'org-qr', email: 'owner@example.test', role: 'owner', exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const serverToken = await createJWT({
    sub: 'server-qr', org: 'org-qr', email: 'server@example.test', role: 'server', exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);

  const call = (url: string, init: RequestInit = {}) => worker.fetch(new Request(`https://api.orderitup.in${url}`, init), env);
  try {
    const issued = await call('/api/qr/tables/table-qr/code', {
      method: 'GET', headers: { Authorization: `Bearer ${ownerToken}`, Origin: 'https://app.orderitup.in' },
    });
    assert.equal(issued.status, 200);
    const qr = await issued.json() as any;
    assert.match(qr.table_token, /^[a-f0-9]{64}$/);
    assert.match(qr.qr_url, /^https:\/\/app\.orderitup\.in\/qr\/?\?tableId=table-qr#token=[a-f0-9]{64}$/);
    const storedHash = sqlite.prepare('SELECT token_hash FROM qr_table_tokens WHERE table_id = ?').get('table-qr') as { token_hash: string };
    assert.equal(storedHash.token_hash, await hashString(qr.table_token));
    assert.notEqual(storedHash.token_hash, qr.table_token);

    const noCapability = await call('/api/qr/menu?table_id=table-qr');
    assert.equal(noCapability.status, 404);
    const menuResponse = await call('/api/qr/menu?table_id=table-qr', {
      headers: { Authorization: `Bearer ${qr.table_token}` },
    });
    assert.equal(menuResponse.status, 200);
    const menu = await menuResponse.json() as any;
    assert.equal(menu.table.number, '12');
    assert.equal(menu.products[0].price, 120, 'Branch override, not client price, is the menu price');
    assert.equal(menu.products[0].addon_groups[0].addons[0].id, 'addon-large');
    assert.equal(Object.hasOwn(menu.products[0], 'stock_quantity'), false);

    const qrPreflight = await call('/api/qr/order', {
      method: 'OPTIONS', headers: {
        Origin: 'https://orderitup.pages.dev',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type,idempotency-key',
      },
    });
    assert.equal(qrPreflight.status, 200);
    assert.match(qrPreflight.headers.get('Access-Control-Allow-Headers') || '', /idempotency-key/i);

    const modifierGroups = await call('/api/addon-groups', { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(modifierGroups.status, 200);
    assert.equal((await modifierGroups.json() as any).addon_groups[0].name, 'Size');
    const serverCannotEditGroups = await call('/api/addon-groups', {
      method: 'POST', headers: { Authorization: `Bearer ${serverToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized group' }),
    });
    assert.equal(serverCannotEditGroups.status, 403, 'Branch staff cannot mutate organization-wide modifier configuration');
    const createdGroup = await call('/api/addon-groups', {
      method: 'POST', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Temperature', is_required: false, min_selection: 0, max_selection: 2 }),
    });
    assert.equal(createdGroup.status, 201);
    const createdGroupId = (await createdGroup.json() as any).id;
    const createdAddon = await call(`/api/addon-groups/${createdGroupId}/addons`, {
      method: 'POST', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Extra hot', price: 0 }),
    });
    assert.equal(createdAddon.status, 201);
    const untrustedCatalogPrice = await call(`/api/addon-groups/${createdGroupId}/addons`, {
      method: 'POST', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Forged price', price: -1 }),
    });
    assert.equal(untrustedCatalogPrice.status, 400);
    const linkedProduct = await call('/api/catalog/product', {
      method: 'POST', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'product-qr', name: 'Gulab Jamun', base_price: 100, tax_rate: 5, category_id: 'category-qr', addon_group_ids: ['group-size'] }),
    });
    assert.equal(linkedProduct.status, 200, 'Owner can attach an active organization modifier group to a catalog product');
    const catalog = await call('/api/catalog/master', { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal((await catalog.json() as any).products[0].addon_groups[0].id, 'group-size');

    const forgedOrder = await call('/api/qr/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: 'table-qr', items: [{ product_id: 'product-qr', quantity: 2 }] }),
    });
    assert.equal(forgedOrder.status, 404);

    const missingRequiredModifier = await call('/api/qr/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qr.table_token}`, 'Idempotency-Key': 'qr-required-missing-0001' },
      body: JSON.stringify({ table_id: 'table-qr', items: [{ product_id: 'product-qr', quantity: 1, addons: [] }] }),
    });
    assert.equal(missingRequiredModifier.status, 400, 'Required catalog modifier groups cannot be skipped');

    const forgedModifier = await call('/api/qr/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qr.table_token}`, 'Idempotency-Key': 'qr-forged-modifier-0001' },
      body: JSON.stringify({ table_id: 'table-qr', items: [{ product_id: 'product-qr', quantity: 1, addons: ['forged-addon'] }] }),
    });
    assert.equal(forgedModifier.status, 400, 'Unknown modifier IDs are rejected');

    const orderPayload = { table_id: 'table-qr', items: [{ product_id: 'product-qr', quantity: 2, addons: ['addon-large'], special_instructions: 'Warm' }] };
    const orderResponse = await call('/api/qr/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qr.table_token}`, 'Idempotency-Key': 'qr-order-success-0001' },
      body: JSON.stringify(orderPayload),
    });
    assert.equal(orderResponse.status, 201);
    const created = await orderResponse.json() as any;
    assert.equal(created.order.total, 294, 'Server prices branch override plus authoritative modifier price and tax');
    assert.match(created.order.tracking_token, /^[a-f0-9]{64}$/);
    const order = sqlite.prepare('SELECT * FROM synced_orders WHERE id = ?').get(created.order.id) as any;
    assert.equal(order.status, 'active');
    assert.equal(order.kitchen_status, 'pending');
    const tableBeforeAcceptance = sqlite.prepare('SELECT status FROM dining_tables WHERE id = ?').get('table-qr') as { status: string };
    assert.equal(tableBeforeAcceptance.status, 'available', 'Public request does not occupy the table before staff acceptance');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM kitchen_tickets WHERE order_id = ?').get(created.order.id).count, 1);
    const savedItem = sqlite.prepare('SELECT subtotal, modifiers_json FROM synced_order_items WHERE order_id = ?').get(created.order.id) as any;
    assert.equal(savedItem.subtotal, 280);
    assert.equal(JSON.parse(savedItem.modifiers_json)[0].price, 20);

    const replayedOrderResponse = await call('/api/qr/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qr.table_token}`, 'Idempotency-Key': 'qr-order-success-0001' },
      body: JSON.stringify(orderPayload),
    });
    assert.equal(replayedOrderResponse.status, 200, 'Same key and payload returns the saved result');
    const replayedOrder = await replayedOrderResponse.json() as any;
    assert.equal(replayedOrder.order.id, created.order.id);
    assert.equal(replayedOrder.order.tracking_token, created.order.tracking_token);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM synced_orders WHERE table_id = ?').get('table-qr').count, 1, 'Idempotent replay does not create another order');
    const conflictingReplay = await call('/api/qr/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qr.table_token}`, 'Idempotency-Key': 'qr-order-success-0001' },
      body: JSON.stringify({ table_id: 'table-qr', items: [{ product_id: 'product-qr', quantity: 3, addons: ['addon-large'], special_instructions: 'Warm' }] }),
    });
    assert.equal(conflictingReplay.status, 409, 'Same idempotency key cannot silently bind to a different payload');
    const storedKey = sqlite.prepare('SELECT idempotency_key_hash FROM qr_order_idempotency WHERE order_id = ?').get(created.order.id) as { idempotency_key_hash: string };
    assert.equal(storedKey.idempotency_key_hash.length, 64);
    assert.notEqual(storedKey.idempotency_key_hash, 'qr-order-success-0001', 'Raw idempotency key is not stored');

    const noTrackingToken = await call(`/api/qr/order/${created.order.id}`);
    assert.equal(noTrackingToken.status, 404);
    const tracked = await call(`/api/qr/order/${created.order.id}`, {
      headers: { Authorization: `Bearer ${created.order.tracking_token}` },
    });
    assert.equal(tracked.status, 200);
    assert.equal((await tracked.json() as any).order.status, 'pending');

    const ticket = sqlite.prepare('SELECT id FROM kitchen_tickets WHERE order_id = ?').get(created.order.id) as { id: string };
    const accepted = await call(`/api/kitchen/tickets/${ticket.id}/status`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing' }),
    });
    assert.equal(accepted.status, 200);
    const tableAfterAcceptance = sqlite.prepare('SELECT status, current_order_id FROM dining_tables WHERE id = ?').get('table-qr') as any;
    assert.equal(tableAfterAcceptance.status, 'occupied');
    assert.equal(tableAfterAcceptance.current_order_id, created.order.id);
    const trackedPreparing = await call(`/api/qr/order/${created.order.id}`, {
      headers: { Authorization: `Bearer ${created.order.tracking_token}` },
    });
    assert.equal((await trackedPreparing.json() as any).order.status, 'preparing');

    const portalTables = await call('/api/tables', { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(portalTables.status, 200, 'Cloud portal can load tables across authorized branches without a branch query');
    assert.equal((await portalTables.json() as any).tables.length, 1);
    const portalOrders = await call('/api/orders?status=active&per_page=20', { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(portalOrders.status, 200);
    const listedOrders = (await portalOrders.json() as any).orders;
    assert.equal(listedOrders.length, 1, 'Cloud portal order query includes QR-created active orders');
    assert.equal(listedOrders[0].kitchen_status, 'preparing');
    const createdTable = await call('/api/tables', {
      method: 'POST', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '13', capacity: 2 }),
    });
    assert.equal(createdTable.status, 201, 'Owner can create a table in their first authorized active branch');

    const concurrentPayload = { table_id: 'table-qr', items: [{ product_id: 'product-qr', quantity: 1, addons: ['addon-large'] }] };
    const concurrentRequests = await Promise.all([1, 2].map(() => call('/api/qr/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qr.table_token}`, 'Idempotency-Key': 'qr-order-race-0001' },
      body: JSON.stringify(concurrentPayload),
    })));
    assert.deepEqual(concurrentRequests.map((response) => response.status).sort(), [200, 201]);
    const concurrentResults = await Promise.all(concurrentRequests.map((response) => response.json() as Promise<any>));
    assert.equal(concurrentResults[0].order.id, concurrentResults[1].order.id, 'Concurrent retries converge on one order');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM qr_order_idempotency').get().count, 2);

    const replacement = await call('/api/qr/tables/table-qr/code', {
      headers: { Authorization: `Bearer ${ownerToken}`, Origin: 'https://app.orderitup.in' },
    });
    assert.equal(replacement.status, 200);
    const revokedMenu = await call('/api/qr/menu?table_id=table-qr', {
      headers: { Authorization: `Bearer ${qr.table_token}` },
    });
    assert.equal(revokedMenu.status, 404, 'Reissuing a table QR code revokes the previous bearer capability');

    console.log('✅ Cloud public QR ordering, pricing, table approval, tracking, and token rotation passed');
  } finally {
    sqlite.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
