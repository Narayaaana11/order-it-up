/** Cloud Worker pairing and Desktop POS outbox contract regression. */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-cloud-terminal-pairing-'));
let encryptionAvailable = true;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return {
    app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' },
    safeStorage: {
      isEncryptionAvailable: () => encryptionAvailable,
      encryptString: (value: string) => Buffer.from(`test-encrypted:${value}`),
      decryptString: (value: Buffer) => value.toString().replace(/^test-encrypted:/, ''),
    },
  };
  return originalLoad.apply(this, arguments as any);
};
const request = require('supertest');
const { initTestDb, seedOwnerUser, assert, assertEqual, getResults, getDatabase, now, createApp, closeDatabase } = require('./helpers/test-setup');
const { settingsRoutes } = require('../main/routes/settings');
const { databaseRoutes } = require('../main/routes/database');
const { orderRoutes } = require('../main/routes/orders');
const { cloudSync } = require('../main/services/cloud-sync');
const { importCloudQrOrder } = require('../main/services/cloud-qr-order-import');
const { importCloudCatalog } = require('../main/services/cloud-catalog-import');

async function run() {
  const originalFetch = globalThis.fetch;
  try {
    initTestDb();
    const db = getDatabase();
    const owner = seedOwnerUser(db);
    db.prepare("INSERT INTO tables (id, number, status, is_active) VALUES ('local-qr-table', '12', 'available', 1)").run();
    db.prepare("INSERT INTO categories (id, name, is_active) VALUES ('local-qr-category', 'Local Desserts', 1)").run();
    db.prepare("INSERT INTO products (id, name, category_id, price, cost, sku, is_active, track_inventory, stock_quantity) VALUES ('local-qr-product', 'Gulab Jamun', 'local-qr-category', 120, 40, 'SWEET-01', 1, 1, 7)").run();
    const remoteQrOrder = {
      id: 'remote-qr-order-1', order_number: 'QR-0001', order_type: 'dine_in', table_number: '12',
      customer_name: null, notes: null, subtotal: 140, tax_total: 7, grand_total: 147, ordered_at: now(),
      items: [{ id: 'remote-qr-item-1', product_name: 'Gulab Jamun', product_sku: 'SWEET-01', quantity: 1,
        unit_price: 120, subtotal: 140, tax_amount: 7, modifiers_json: JSON.stringify([{ name: 'Large', price: 20, quantity: 1 }]), special_instructions: null }],
    };
    const importedQr = importCloudQrOrder(remoteQrOrder);
    assert(!importedQr.replay, 'first Cloud QR import creates a local pending order');
    assert(importCloudQrOrder(remoteQrOrder).replay, 'retry returns the same local Cloud QR order');
    assertEqual(db.prepare('SELECT status FROM orders WHERE id = ?').get(importedQr.localOrderId).status, 'pending', 'Cloud QR import waits for local staff approval');
    assertEqual(db.prepare('SELECT table_id FROM orders WHERE id = ?').get(importedQr.localOrderId).table_id, 'local-qr-table', 'Cloud table maps by unique table number');
    assertEqual(db.prepare('SELECT inventory_deducted_quantity FROM order_items WHERE order_id = ?').get(importedQr.localOrderId).inventory_deducted_quantity, 0, 'Cloud QR import does not deduct inventory before approval');
    assertEqual(db.prepare('SELECT COUNT(*) AS count FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)').get(importedQr.localOrderId).count, 1, 'Cloud QR modifier snapshot is retained');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'local-qr-product'").get().stock_quantity, 7, 'Cloud QR import leaves local stock unchanged');
    const syncedSnapshot = (cloudSync as any).buildOrderSnapshot(importedQr.localOrderId);
    assertEqual(syncedSnapshot.id, 'remote-qr-order-1', 'later local updates retain the original Cloud QR order ID');
    assertEqual(syncedSnapshot.items[0].id, 'remote-qr-item-1', 'later local updates retain the original Cloud QR item ID');
    const beforeBadMapping = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
    let badMappingRejected = false;
    try { importCloudQrOrder({ ...remoteQrOrder, id: 'remote-qr-order-unmapped', items: [{ ...remoteQrOrder.items[0], product_sku: 'MISSING' }] }); }
    catch { badMappingRejected = true; }
    assert(badMappingRejected, 'unmapped Cloud product is not imported');
    assertEqual(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, beforeBadMapping, 'failed mapping leaves no partial local order');

    const catalogSnapshot = {
      branch_id: 'cloud-branch-1',
      categories: [{ id: 'cloud-category-1', name: 'Desserts', sort_order: 2, is_active: 1 }],
      products: [{ id: 'cloud-product-1', name: 'Gulab Jamun', category_id: 'cloud-category-1', sku: 'SWEET-01', barcode: 'BC-01',
        effective_price: 130, tax_rate: 5, master_is_active: 1, is_available: 1, version: 3, updated_at: now(),
        addon_groups: [{ id: 'cloud-group-1', name: 'Size', is_required: 1, allow_multiple_quantities: 0, min_selection: 1, max_selection: 1,
          addons: [{ id: 'cloud-addon-1', name: 'Large', price: 20, is_active: 1 }] }] }],
    };
    importCloudCatalog(catalogSnapshot, 'cloud-branch-1');
    assertEqual(db.prepare("SELECT id FROM products WHERE sku='SWEET-01'").get().id, 'local-qr-product', 'Cloud catalog maps a unique SKU to the existing local product ID');
    assertEqual(db.prepare("SELECT category_id FROM products WHERE id='local-qr-product'").get().category_id, db.prepare("SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type='category' AND remote_id='cloud-category-1'").get().local_id, 'Cloud category identity is mapped to a local category');
    assertEqual(db.prepare("SELECT price FROM products WHERE id='local-qr-product'").get().price, 130, 'branch-effective Cloud price is applied locally');
    assertEqual(db.prepare("SELECT cost FROM products WHERE id='local-qr-product'").get().cost, 40, 'Cloud catalog leaves local cost unchanged');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id='local-qr-product'").get().stock_quantity, 7, 'Cloud catalog leaves inventory unchanged');
    assertEqual(db.prepare("SELECT COUNT(*) AS count FROM addon_group_product WHERE product_id='local-qr-product'").get().count, 1, 'Cloud modifier groups are linked to the local product');
    assertEqual(db.prepare("SELECT COUNT(*) AS count FROM addons WHERE id=(SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type='addon' AND remote_id='cloud-addon-1')").get().count, 1, 'Cloud modifier choice is imported through a stable identity mapping');
    importCloudCatalog({ ...catalogSnapshot, products: [{ ...catalogSnapshot.products[0], effective_price: 135 }] }, 'cloud-branch-1');
    assertEqual(db.prepare("SELECT price FROM products WHERE id='local-qr-product'").get().price, 135, 'catalog refresh updates cloud-managed price in place');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id='local-qr-product'").get().stock_quantity, 7, 'catalog refresh still leaves stock unchanged');

    const staleProduct = {
      ...catalogSnapshot.products[0], id: 'cloud-product-stale', name: 'Seasonal Dessert', category_id: 'cloud-category-stale',
      sku: 'STALE-01', addon_groups: [{ id: 'cloud-group-stale', name: 'Serving', is_required: 0,
        allow_multiple_quantities: 0, min_selection: 0, max_selection: 1,
        addons: [{ id: 'cloud-addon-stale', name: 'Old topping', price: 3, is_active: 1 }] }],
    };
    importCloudCatalog({ ...catalogSnapshot,
      categories: [...catalogSnapshot.categories, { id: 'cloud-category-stale', name: 'Seasonal' }],
      products: [...catalogSnapshot.products, staleProduct],
    }, 'cloud-branch-1');
    const staleProductId = db.prepare("SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type='product' AND remote_id='cloud-product-stale'").get().local_id;
    const staleCategoryId = db.prepare("SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type='category' AND remote_id='cloud-category-stale'").get().local_id;
    const staleGroupId = db.prepare("SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type='addon_group' AND remote_id='cloud-group-stale'").get().local_id;
    const staleAddonId = db.prepare("SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type='addon' AND remote_id='cloud-addon-stale'").get().local_id;
    importCloudCatalog({ ...catalogSnapshot, products: [{ ...catalogSnapshot.products[0], addon_groups: [] }] }, 'cloud-branch-1');
    assertEqual(db.prepare('SELECT is_active FROM products WHERE id = ?').get(staleProductId).is_active, 0, 'removed Cloud product is disabled without deleting its local history');
    assertEqual(db.prepare('SELECT is_active FROM categories WHERE id = ?').get(staleCategoryId).is_active, 0, 'removed Cloud category is disabled without deleting it');
    assertEqual(db.prepare('SELECT is_active FROM addon_groups WHERE id = ?').get(staleGroupId).is_active, 0, 'removed Cloud modifier group is disabled');
    assertEqual(db.prepare('SELECT is_active FROM addons WHERE id = ?').get(staleAddonId).is_active, 0, 'removed Cloud modifier is disabled');
    assertEqual(db.prepare("SELECT is_active FROM addons WHERE id=(SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type='addon' AND remote_id='cloud-addon-1')").get().is_active, 0, 'modifier removed from a retained group is disabled');

    let crossBranchRejected = false;
    try { importCloudCatalog(catalogSnapshot, 'different-branch'); } catch { crossBranchRejected = true; }
    assert(crossBranchRejected, 'catalog snapshot for a different branch is rejected');
    const priceBeforeWrongBranch = db.prepare("SELECT price FROM products WHERE id='local-qr-product'").get().price;
    try {
      importCloudCatalog({ ...catalogSnapshot, products: [{ ...catalogSnapshot.products[0], effective_price: 999 }] }, 'different-branch');
    } catch { /* expected */ }
    assertEqual(db.prepare("SELECT price FROM products WHERE id='local-qr-product'").get().price, priceBeforeWrongBranch, 'cross-branch catalog cannot mutate the local catalog');

    db.prepare("INSERT INTO products (id, name, sku, price) VALUES ('duplicate-sku-1', 'One', 'DUP-01', 1), ('duplicate-sku-2', 'Two', 'DUP-01', 2)").run();
    const beforeCatalogFailure = db.prepare('SELECT COUNT(*) AS count FROM cloud_catalog_identity_mappings').get().count;
    let ambiguousCatalogRejected = false;
    try {
      importCloudCatalog({ ...catalogSnapshot, products: [{ ...catalogSnapshot.products[0], id: 'cloud-product-ambiguous', sku: 'DUP-01' }] }, 'cloud-branch-1');
    } catch { ambiguousCatalogRejected = true; }
    assert(ambiguousCatalogRejected, 'ambiguous Cloud SKU mapping is rejected rather than assigning the wrong local product');
    assertEqual(db.prepare('SELECT COUNT(*) AS count FROM cloud_catalog_identity_mappings').get().count, beforeCatalogFailure, 'ambiguous catalog sync rolls back all identity mappings');
    const app = createApp({ '/api/settings': settingsRoutes, '/api/database': databaseRoutes, '/api/orders': orderRoutes });
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('cloud_sync_enabled', '1', ?) ON CONFLICT(key) DO UPDATE SET value='1'`).run(now());
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('cloud_terminal_token', 'legacy-plaintext-token', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(now());
    const legacyStatus = cloudSync.getStatus();
    const migratedToken = db.prepare("SELECT value FROM settings WHERE key='cloud_terminal_token'").get().value as string;
    assert(legacyStatus.cloud_terminal_connected, 'legacy plaintext credential remains available after migration');
    assert(migratedToken.startsWith('safe-storage:v1:'), 'existing plaintext credentials are encrypted on read');
    assert(!migratedToken.includes('legacy-plaintext-token'), 'legacy plaintext is removed from persistent settings');
    db.prepare("UPDATE settings SET value='' WHERE key='cloud_terminal_token'").run();

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let catalogStatus = 200;
    let qrInboxStatus = 200;
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
      if (target.includes('/api/pos/qr-orders?')) return new Response(JSON.stringify({ orders: [] }), { status: qrInboxStatus, headers: { 'Content-Type': 'application/json' } });
      if (target.endsWith('/api/pos/catalog')) return new Response(JSON.stringify({ ...catalogSnapshot, branch_id: 'branch-1' }), { status: catalogStatus, headers: { 'Content-Type': 'application/json' } });
      throw new Error(`Unexpected Cloud API call: ${target}`);
    }) as typeof fetch;

    encryptionAvailable = false;
    let unsafePairingRejected = false;
    try { await cloudSync.claimTerminalPairingCode('654321'); } catch { unsafePairingRejected = true; }
    assert(unsafePairingRejected, 'pairing fails closed when OS-backed encryption is unavailable');
    assertEqual(calls.length, 0, 'unsafe pairing does not consume a Cloud pairing code');
    encryptionAvailable = true;

    const invalid = await request(app).post('/api/settings/cloud/terminal/pair').set(owner.authHeader).send({ code: '123' });
    assertEqual(invalid.status, 400, 'pairing rejects malformed PIN');
    assertEqual(calls.length, 0, 'malformed PIN does not reach Cloud API');

    const paired = await request(app).post('/api/settings/cloud/terminal/pair').set(owner.authHeader).send({ code: '123 456' });
    assertEqual(paired.status, 200, 'owner can claim a Cloud Worker terminal pairing code');
    assertEqual(paired.body.branch_name, 'Main', 'pair response includes the assigned branch name');
    assert(!JSON.stringify(paired.body).includes('secret-terminal-token'), 'terminal bearer token is never returned to renderer');
    const storedTerminalToken = db.prepare("SELECT value FROM settings WHERE key='cloud_terminal_token'").get().value as string;
    assert(storedTerminalToken.startsWith('safe-storage:v1:'), 'terminal bearer token is OS-encrypted before local persistence');
    assert(!storedTerminalToken.includes('secret-terminal-token'), 'plaintext terminal bearer token is absent from settings');
    assert(String(calls[0].url).startsWith('https://orderitup-cloud-api.narayaaana11.workers.dev/'), 'pair claim uses the deployed Worker API origin');
    assertEqual(JSON.parse(String(calls[0].init?.body)).code, '123456', 'pair claim sends normalized six-digit PIN');

    await (cloudSync as any).waitForBackgroundWork();
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('cloud_last_error', 'Cloud service request failed', ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(now());
    catalogStatus = 503;
    await (cloudSync as any).pollCloudCatalog();
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_last_error'").get().value, 'Cloud service request failed', 'catalog failure does not overwrite the shared Cloud service error');
    assertEqual(cloudSync.getStatus().cloud_catalog_sync_error, 'Cloud catalog sync needs attention', 'catalog failure is exposed as a separate sanitized status');
    const statusWithCatalogError = await request(app).get('/api/settings').set(owner.authHeader);
    assertEqual(statusWithCatalogError.body.settings.cloud_catalog_last_error, 'Cloud catalog sync needs attention', 'generic settings API masks the persisted catalog error flag');

    catalogStatus = 200;
    await (cloudSync as any).pollCloudCatalog();
    assertEqual(cloudSync.getStatus().cloud_catalog_sync_error, null, 'successful catalog sync clears its own error');
    assert(Boolean(cloudSync.getStatus().cloud_catalog_last_sync), 'catalog success timestamp is available to settings');
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_last_error'").get().value, 'Cloud service request failed', 'catalog success does not clear an unrelated shared Cloud service error');

    qrInboxStatus = 503;
    await (cloudSync as any).pollCloudQrOrders();
    assertEqual(cloudSync.getStatus().cloud_qr_sync_error, 'Cloud QR order delivery needs attention', 'QR inbox failures have a separate sanitized status');
    const statusWithQrError = await request(app).get('/api/settings').set(owner.authHeader);
    assertEqual(statusWithQrError.body.settings.cloud_qr_last_error, 'Cloud QR order delivery needs attention', 'generic settings API masks the persisted QR error flag');
    qrInboxStatus = 200;
    await (cloudSync as any).pollCloudQrOrders();
    assertEqual(cloudSync.getStatus().cloud_qr_sync_error, null, 'successful QR inbox poll clears its own error');
    assertEqual(db.prepare("SELECT value FROM settings WHERE key='cloud_last_error'").get().value, 'Cloud service request failed', 'QR sync does not mutate the shared Cloud service error');

    const insert = db.prepare(`INSERT INTO cloud_sync_outbox (id,event_type,entity_type,entity_id,payload,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,'{}','pending',0,?,?)`);
    for (const id of ['event-accepted', 'event-rejected']) insert.run(id, 'inventory.updated', 'inventory', id, now(), now());
    await cloudSync.flushOutbox();
    const batchCall = calls.find((call) => call.url.endsWith('/api/pos/events'))!;
    assert(Boolean(batchCall), 'desktop outbox sends a batch to Cloud Worker');
    assertEqual((batchCall.init?.headers as Record<string, string>).Authorization, 'Bearer secret-terminal-token', 'encrypted credential is decrypted only for authenticated requests');
    const body = JSON.parse(String(batchCall.init?.body));
    assertEqual(body.pos_hash, undefined, 'Cloud Worker terminal batches do not send legacy POS hashes');
    assertEqual(db.prepare("SELECT status FROM cloud_sync_outbox WHERE id='event-accepted'").get().status, 'delivered', 'Cloud accepted event is marked delivered');
    assertEqual(db.prepare("SELECT status FROM cloud_sync_outbox WHERE id='event-rejected'").get().status, 'failed', 'Cloud rejected event remains retryable');

    const publicSettings = await request(app).get('/api/settings').set(owner.authHeader);
    assert(!JSON.stringify(publicSettings.body).includes('secret-terminal-token'), 'generic settings API does not expose terminal bearer token');
    const exported = await request(app).get('/api/database/export').set(owner.authHeader);
    assertEqual(exported.status, 200, 'owner can export a data backup');
    assert(!exported.text.includes('secret-terminal-token'), 'database export redacts terminal bearer token');
    const exportedSettings = new Map((exported.body.data.settings as Array<{ key: string; value: string }>).map((setting) => [setting.key, setting.value]));
    assertEqual(exportedSettings.get('cloud_catalog_last_error'), '[REDACTED]', 'database export redacts the catalog sync error flag');
    assertEqual(exportedSettings.get('cloud_qr_last_error'), '[REDACTED]', 'database export redacts the QR sync error flag');
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

    const cloudQrAccepted = await request(app).patch(`/api/orders/${importedQr.localOrderId}/status`).set(owner.authHeader).send({ status: 'preparing' });
    assertEqual(cloudQrAccepted.status, 200, 'staff can accept a delivered Cloud QR order into preparation');
    assertEqual(db.prepare('SELECT status FROM orders WHERE id = ?').get(importedQr.localOrderId).status, 'preparing', 'Cloud QR order advances only after staff acceptance');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'local-qr-product'").get().stock_quantity, 6, 'Cloud QR acceptance deducts tracked local product stock');
    const cloudQrAcceptReplay = await request(app).patch(`/api/orders/${importedQr.localOrderId}/status`).set(owner.authHeader).send({ status: 'preparing' });
    assertEqual(cloudQrAcceptReplay.status, 200, 'replaying the same Cloud QR acceptance succeeds idempotently');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'local-qr-product'").get().stock_quantity, 6, 'replayed Cloud QR acceptance does not deduct product stock twice');
    const results = getResults();
    if (results.failed > 0) throw new Error(`Cloud terminal pairing suite had ${results.failed} failed assertion(s)`);
    console.log(`Cloud terminal pairing and outbox contract passed (${results.passed}/${results.total})`);
  } finally {
    globalThis.fetch = originalFetch;
    cloudSync.stop();
    try { closeDatabase(); } catch { }
    Module._load = originalLoad;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}
run().catch((error) => { try { closeDatabase(); } catch { } Module._load = originalLoad; fs.rmSync(testDir, { recursive: true, force: true }); console.error(error); process.exit(1); });
