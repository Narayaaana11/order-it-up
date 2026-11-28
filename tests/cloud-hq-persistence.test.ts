/**
 * Test Suite: Cloud Portal Persistence & Dynamic Calculations
 * Verifies real SQLite persistence, dynamic SQL aggregations, persistent transfers/overrides,
 * and honest dual-mode WAL checkpointing.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-cloud-hq-persistence-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') {
    return {
      app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(`test-encrypted:${value}`),
        decryptString: (value: Buffer) => value.toString().replace(/^test-encrypted:/, ''),
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

import assert from 'node:assert/strict';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { getDatabase, initDatabase } from '../main/db';
import { cloudHqRoutes } from '../main/routes/cloud-hq';

function createApp() {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { role: 'owner', userId: 'usr-owner-test', id: 'usr-owner-test' };
    next();
  });

  app.use('/cloud', cloudHqRoutes);
  return app;
}

async function runTests() {
  console.log('--- Running Cloud Portal Real Persistence & Calculations Tests ---');
  initDatabase();
  const db = getDatabase();
  const app = createApp();

  // 1. Verify schema tables and indexes exist from migration 96
  console.log('1. Verifying schema tables: inventory_transfers and product_branch_overrides');
  const transferTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_transfers'").get();
  assert.ok(transferTable, 'inventory_transfers table must exist');

  const overrideTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_branch_overrides'").get();
  assert.ok(overrideTable, 'product_branch_overrides table must exist');

  // 2. Inter-branch inventory transfer persistence
  console.log('2. Verifying inter-branch inventory transfer persistence across SQLite');
  const createRes = await request(app)
    .post('/cloud/transfers')
    .send({
      source: 'Connaught Place (Main Outlet)',
      dest: 'Gurugram CyberHub (Franchise)',
      item: 'Organic Arabica Dark Roast',
      qty: 12.5,
      unit: 'kg',
    });
  assert.equal(createRes.status, 200);
  assert.equal(createRes.body.success, true);
  const transferId = createRes.body.transfer.id;
  assert.ok(transferId, 'Transfer ID must be generated');

  // Verify it exists in SQLite database table
  const dbTransfer = db.prepare('SELECT * FROM inventory_transfers WHERE id = ?').get(transferId) as any;
  assert.ok(dbTransfer, 'Transfer must be persisted in SQLite table');
  assert.equal(dbTransfer.item_name, 'Organic Arabica Dark Roast');
  assert.equal(dbTransfer.quantity, 12.5);
  assert.equal(dbTransfer.status, 'pending');

  // Verify status update persists
  const patchRes = await request(app)
    .patch(`/cloud/transfers/${transferId}/status`)
    .send({ status: 'dispatched' });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.transfer.status, 'dispatched');

  const updatedDbTransfer = db.prepare('SELECT status FROM inventory_transfers WHERE id = ?').get(transferId) as any;
  assert.equal(updatedDbTransfer.status, 'dispatched', 'Updated status must be in SQLite');

  // Verify GET /cloud/transfers returns persisted transfers
  const listRes = await request(app).get('/cloud/transfers');
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.transfers.some((t: any) => t.id === transferId));

  // 3. Product Branch Price Override Persistence
  console.log('3. Verifying product branch price override persistence in SQLite');
  let activeBranch = db.prepare('SELECT id FROM branches LIMIT 1').get() as any;
  assert.ok(activeBranch, 'At least one branch must exist in branches table');

  // Insert a test product if none exists
  let testProduct = db.prepare('SELECT id FROM products LIMIT 1').get() as any;
  if (!testProduct) {
    db.prepare("INSERT INTO products (id, name, price, tax_rate, is_active) VALUES ('prod-test-01', 'Test Espresso', 150, 5, 1)").run();
    testProduct = { id: 'prod-test-01' };
  }

  const overrideRes = await request(app)
    .post('/cloud/catalog/override')
    .send({
      product_id: testProduct.id,
      branch_id: activeBranch.id,
      price_override: 185,
      is_available: true,
    });
  assert.equal(overrideRes.status, 200);
  assert.equal(overrideRes.body.success, true);

  const dbOverride = db.prepare('SELECT * FROM product_branch_overrides WHERE product_id = ? AND branch_id = ?').get(testProduct.id, activeBranch.id) as any;
  assert.ok(dbOverride, 'Override must be saved in product_branch_overrides table');
  assert.equal(dbOverride.override_price, 185);

  const catalogRes = await request(app).get(`/cloud/catalog?branch_id=${activeBranch.id}`);
  assert.equal(catalogRes.status, 200);
  const matchedProd = catalogRes.body.items.find((p: any) => p.id === testProduct.id);
  assert.ok(matchedProd, 'Product must appear in catalog');
  assert.equal(matchedProd.overridePrice, 185, 'Catalog must return persistent override price');

  // 4. Dynamic Tender & Payment Calculations
  console.log('4. Verifying dynamic tender & payment calculations from bills table');
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO orders (id, order_number, total, status, created_at, updated_at)
    VALUES (99991, 'ORD-PERSIST-1', 1000, 'completed', ?, ?)
  `).run(nowIso, nowIso);

  db.prepare(`
    INSERT INTO bills (id, bill_number, order_id, total, paid_amount, balance, payment_status, payment_details, created_at, paid_at)
    VALUES (99991, 'BILL-PERSIST-1', 99991, 1000, 1000, 0, 'paid', ?, ?, ?)
  `).run(
    JSON.stringify([
      { method: 'upi', amount: 600 },
      { method: 'cash', amount: 400 },
    ]),
    nowIso,
    nowIso
  );

  const overviewRes = await request(app).get('/cloud/overview');
  assert.equal(overviewRes.status, 200);
  assert.ok(overviewRes.body.payment_tenders, 'payment_tenders must be returned');

  const upiTender = overviewRes.body.payment_tenders.find((t: any) => t.method === 'upi');
  const cashTender = overviewRes.body.payment_tenders.find((t: any) => t.method === 'cash');
  assert.ok(upiTender, 'UPI tender must be present');
  assert.ok(cashTender, 'Cash tender must be present');
  assert.ok(upiTender.amount >= 600, 'UPI amount must aggregate bill payments');
  assert.ok(cashTender.amount >= 400, 'Cash amount must aggregate bill payments');

  // 5. Dynamic Rolling 7-Day Revenue Trajectory
  console.log('5. Verifying dynamic rolling 7-day revenue trajectory');
  assert.ok(Array.isArray(overviewRes.body.weekly_trends), 'weekly_trends must be an array');
  assert.equal(overviewRes.body.weekly_trends.length, 7, 'weekly_trends must have 7 days');
  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const lastTrend = overviewRes.body.weekly_trends[6];
  assert.equal(lastTrend.date, todayLabel, `Last trend day must be today (${todayLabel}), got ${lastTrend.date}`);

  // 6. Dual-Mode SQLite WAL Checkpoint Sync
  console.log('6. Verifying dual-mode sync checkpointing SQLite WAL');
  const syncRes = await request(app).post('/cloud/sync');
  assert.equal(syncRes.status, 200);
  assert.equal(syncRes.body.success, true);
  assert.equal(syncRes.body.wal_checkpoint, 'clean');
  assert.equal(syncRes.body.mode, 'local_authoritative');

  // 7. Zero-State Clean Behavior (No Mock / Seed Data)
  console.log('7. Verifying zero-state clean behavior (no mock fallbacks)');
  const closureNotFoundRes = await request(app).get('/cloud/closures/non-existent-closure-id');
  assert.equal(closureNotFoundRes.status, 404, 'Non-existent closure must return 404');

  const lowStockRes = await request(app).get('/cloud/inventory/low-stock');
  assert.equal(lowStockRes.status, 200);
  assert.ok(Array.isArray(lowStockRes.body.items), 'low-stock items must be an array');
  // Confirm no mock hardcoded "Specialty Arabica Coffee Beans" fallback
  assert.ok(!lowStockRes.body.items.some((i: any) => i.id === 'ing-1'), 'No seeded mock ing-1 should exist');

  const branchesRes = await request(app).get('/cloud/branches');
  assert.equal(branchesRes.status, 200);
  assert.ok(Array.isArray(branchesRes.body.branches), 'branches must be an array');
  assert.ok(!branchesRes.body.branches.some((b: any) => b.id === 'br-02' || b.name.includes('CyberHub')), 'No seeded mock CyberHub in branches');

  // 8. Period & Branch Filtering on Overview & Velocity
  console.log('8. Verifying real SQL period & branch filtering');
  const todayOverviewRes = await request(app).get('/cloud/overview?period=today&branch_id=all');
  assert.equal(todayOverviewRes.status, 200);
  assert.ok(todayOverviewRes.body.total_revenue >= 1000, 'Today overview must include today order');

  const otherBranchOverviewRes = await request(app).get('/cloud/overview?period=today&branch_id=non-existent-branch');
  assert.equal(otherBranchOverviewRes.status, 200);
  assert.equal(otherBranchOverviewRes.body.total_orders, 0, 'Non-local branch without remote orders must return 0 orders');

  const velocityRes = await request(app).get('/cloud/velocity?period=today&branch_id=all');
  assert.equal(velocityRes.status, 200);
  assert.ok(velocityRes.body.operational, 'Velocity operational metrics must be returned');

  // 9. Dynamic Tally XML Export (No Hardcoded Values)
  console.log('9. Verifying dynamic Tally XML export reflects SQLite orders');
  const tallyRes = await request(app).get('/cloud/export/tally-xml?period=today');
  assert.equal(tallyRes.status, 200);
  assert.ok(!tallyRes.text.includes('68232.00'), 'Tally XML must not contain hardcoded 68232.00');
  assert.ok(tallyRes.text.includes('1000.00'), 'Tally XML must reflect real order total (1000.00)');

  // 10. Real Ingredient Supplier Persistence
  console.log('10. Verifying raw_ingredients.supplier persistence');
  const ingRes = await request(app)
    .post('/cloud/inventory/ingredients')
    .send({
      name: 'Test Supplier Beans',
      unit: 'kg',
      current_stock: 1,
      minimum_stock: 5,
      cost_per_unit: 500,
      supplier: 'RoastWorks Direct',
    });
  assert.equal(ingRes.status, 201);
  const createdIngId = ingRes.body.ingredient.id;
  const lowAfterIngRes = await request(app).get('/cloud/inventory/low-stock');
  assert.equal(lowAfterIngRes.status, 200);
  const foundIng = lowAfterIngRes.body.items.find((i: any) => i.id === createdIngId);
  assert.ok(foundIng, 'Low-stock ingredient must appear in feed');
  assert.equal(foundIng.supplier, 'RoastWorks Direct', 'Real supplier must persist in SQLite');

  // 11. Persistent Paired Terminals via Pairing Handshake
  console.log('11. Verifying paired_terminals persistence on /pair/claim');
  const genRes = await request(app)
    .post('/cloud/pair/generate')
    .send({ branch_id: activeBranch.id, terminal_name: 'KDS Station 1' });
  assert.equal(genRes.status, 200);
  const claimRes = await request(app)
    .post('/cloud/pair/claim')
    .send({ code: genRes.body.code, branch_id: activeBranch.id });
  assert.equal(claimRes.status, 200);
  assert.ok(claimRes.body.terminal_id, 'Claim must return persisted terminal_id');

  const branchesWithTermRes = await request(app).get('/cloud/branches');
  assert.equal(branchesWithTermRes.status, 200);
  const matchedBranch = branchesWithTermRes.body.branches.find((b: any) => b.id === activeBranch.id);
  assert.ok(matchedBranch.terminals.some((t: any) => t.id === claimRes.body.terminal_id && t.device_type === 'kds'), 'Paired KDS terminal must persist in branches response');

  // Clean up test records
  db.prepare('DELETE FROM paired_terminals WHERE id = ?').run(claimRes.body.terminal_id);
  db.prepare('DELETE FROM raw_ingredients WHERE id = ?').run(createdIngId);
  db.prepare('DELETE FROM bills WHERE id = 99991').run();
  db.prepare('DELETE FROM orders WHERE id = 99991').run();
  db.prepare('DELETE FROM inventory_transfers WHERE id = ?').run(transferId);
  db.prepare('DELETE FROM product_branch_overrides WHERE product_id = ? AND branch_id = ?').run(testProduct.id, activeBranch.id);

  console.log('✅ All Cloud Portal persistence and dynamic calculation tests passed!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
