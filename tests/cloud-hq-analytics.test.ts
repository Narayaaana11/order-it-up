/**
 * Test Suite: Cloud Portal 4-Pillar Analytics
 * Verifies /overview (channel_mix, anomaly_alerts, previous_period),
 * /finance-pnl (waterfall, theoretical COGS, expenses, vendors, tax components),
 * /inventory/analytics (valuation, wastage, days-of-cover), and
 * /menu-engineering (quadrants, peak hours) against an isolated SQLite DB.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-cloud-hq-analytics-'));
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
  console.log('--- Running Cloud Portal 4-Pillar Analytics Tests ---');
  initDatabase();
  const db = getDatabase();
  const app = createApp();

  // Ensure a category and product exist
  const catId = 'cat-analytics-test';
  const prodId = 'prod-analytics-test';
  const ingId = 'ing-analytics-test';
  const expCatId = 'exp-cat-analytics-test';
  const vendorId = 'ven-analytics-test';

  db.prepare(`INSERT OR IGNORE INTO categories (id, name, is_active) VALUES (?, 'Mains', 1)`).run(catId);
  db.prepare(`
    INSERT OR IGNORE INTO products (id, name, category_id, price, is_active)
    VALUES (?, 'Test Butter Chicken', ?, 400, 1)
  `).run(prodId, catId);

  db.prepare(`
    INSERT OR REPLACE INTO raw_ingredients (id, name, unit, current_stock, minimum_stock, cost_per_unit, supplier, is_active)
    VALUES (?, 'Test Chicken', 'kg', 10, 5, 200, 'Fresh Farms', 1)
  `).run(ingId);

  db.prepare(`
    INSERT OR REPLACE INTO product_recipes (id, product_id, ingredient_id, quantity_required, unit, wastage_percentage)
    VALUES ('rec-analytics-test', ?, ?, 0.5, 'kg', 0)
  `).run(prodId, ingId); // Unit COGS = 0.5 * 200 = 100

  db.prepare(`
    INSERT OR REPLACE INTO expense_categories (id, name, is_active)
    VALUES (?, 'Utilities', 1)
  `).run(expCatId);

  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT OR REPLACE INTO expenses (id, expense_date, category_id, amount, payment_method, paid_to)
    VALUES ('exp-analytics-test', ?, ?, 150, 'cash', 'Power Co')
  `).run(today, expCatId);

  db.prepare(`
    INSERT OR REPLACE INTO vendors (id, name, phone, balance, is_active)
    VALUES (?, 'Fresh Farms', '9999999999', 1200, 1)
  `).run(vendorId);

  // Insert completed dine_in order + order_item + bill with tax_breakdown
  db.prepare(`
    INSERT OR REPLACE INTO orders (id, order_number, type, status, subtotal, tax_amount, discount_amount, total, created_at)
    VALUES (99801, 'ORD-ANL-1', 'dine_in', 'completed', 800, 40, 0, 840, CURRENT_TIMESTAMP)
  `).run();

  db.prepare(`
    INSERT OR REPLACE INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal, total)
    VALUES (99801, 99801, ?, 'Test Butter Chicken', 2, 400, 800, 800)
  `).run(prodId);

  db.prepare(`
    INSERT OR REPLACE INTO bills (id, bill_number, order_id, subtotal, tax_amount, tax_breakdown, total, paid_amount, payment_status, created_at)
    VALUES (99801, 'BILL-ANL-1', 99801, 800, 40, ?, 840, 840, 'paid', CURRENT_TIMESTAMP)
  `).run(JSON.stringify([{ title: 'CGST', rate: 2.5, amount: 20 }, { title: 'SGST', rate: 2.5, amount: 20 }]));

  // 1. Overview channel_mix
  const overviewRes = await request(app).get('/cloud/overview?period=today');
  assert.equal(overviewRes.status, 200);
  assert.equal(overviewRes.body.success, true);
  assert.ok(Array.isArray(overviewRes.body.channel_mix), 'channel_mix must be an array');
  assert.ok(overviewRes.body.channel_mix.some((c: any) => c.channel === 'dine_in' && c.revenue >= 840), 'dine_in channel revenue must include test order');
  assert.ok(Array.isArray(overviewRes.body.anomaly_alerts), 'anomaly_alerts must be an array');
  assert.ok(overviewRes.body.previous_period !== null, 'previous_period must be returned for today');

  // 2. Finance & P&L
  const pnlRes = await request(app).get('/cloud/finance-pnl?period=today');
  assert.equal(pnlRes.status, 200);
  assert.equal(pnlRes.body.success, true);
  assert.ok(pnlRes.body.pnl.net_sales >= 840, 'net_sales must include test order');
  assert.ok(pnlRes.body.pnl.theoretical_cogs >= 200, 'theoretical_cogs must include 2 * 100 = 200');
  assert.ok(pnlRes.body.pnl.operating_expenses >= 150, 'operating_expenses must include 150');
  assert.ok(pnlRes.body.vendors.total_payable >= 1200, 'vendors.total_payable must include 1200');
  assert.ok(pnlRes.body.tax_summary.total_tax >= 40, 'tax_summary.total_tax must include 40');

  // 3. Inventory Analytics
  const invRes = await request(app).get('/cloud/inventory/analytics?period=30d');
  assert.equal(invRes.status, 200);
  assert.equal(invRes.body.success, true);
  assert.ok(invRes.body.valuation.total_stock_value >= 2000, 'total_stock_value must include 10 * 200 = 2000');
  assert.ok(invRes.body.items.some((i: any) => i.id === ingId && i.status === 'healthy'), 'test ingredient must be healthy');

  // 4. Menu Engineering
  const menuRes = await request(app).get('/cloud/menu-engineering?period=today');
  assert.equal(menuRes.status, 200);
  assert.equal(menuRes.body.success, true);
  const testMenuItem = menuRes.body.items.find((i: any) => i.product_id === prodId);
  assert.ok(testMenuItem, 'test product must appear in menu-engineering items');
  assert.equal(testMenuItem.unit_cogs, 100);
  assert.equal(testMenuItem.unit_margin, 300);
  assert.equal(menuRes.body.peak_hours.length, 24);

  // 5. Custom Date-Range & Branch Isolation
  const customOverview = await request(app).get(`/cloud/overview?period=custom&start_date=${today}&end_date=${today}&branch_id=br-01`);
  assert.equal(customOverview.status, 200);
  assert.ok(customOverview.body.total_revenue >= 840);
  const otherBranchOverview = await request(app).get(`/cloud/overview?period=today&branch_id=br-nonexistent`);
  assert.equal(otherBranchOverview.status, 200);
  assert.equal(otherBranchOverview.body.total_orders, 0);

  // 6. In-Portal Expense Entry & Labor Shifts (Prime Cost + SPLH)
  const expRes = await request(app).post('/cloud/expenses').send({
    category_name: 'Marketing',
    amount: 250,
    payment_method: 'upi',
    paid_to: 'Ads Co',
  });
  assert.equal(expRes.status, 201);
  assert.equal(expRes.body.success, true);

  const shiftRes = await request(app).post('/cloud/labor-shifts').send({
    staff_name: 'Chef Arjun',
    hours_worked: 8,
    hourly_rate: 100,
  });
  assert.equal(shiftRes.status, 201);
  assert.equal(shiftRes.body.shift.labor_cost, 800);

  const pnlAfterLabor = await request(app).get('/cloud/finance-pnl?period=today');
  assert.equal(pnlAfterLabor.status, 200);
  assert.ok(pnlAfterLabor.body.pnl.labor_cost >= 800);
  assert.ok(pnlAfterLabor.body.pnl.prime_cost >= 1000); // 200 COGS + 800 Labor
  assert.ok(pnlAfterLabor.body.pnl.splh > 0);

  // 7. Wastage Logging, Physical Stock Count Variance & Purchase Orders
  const wasteRes = await request(app).post('/cloud/inventory/wastage').send({
    ingredient_id: ingId,
    quantity: 1,
    reason: 'spoilage',
  });
  assert.equal(wasteRes.status, 201);
  assert.equal(wasteRes.body.success, true);

  const countRes = await request(app).post('/cloud/inventory/stock-count').send({
    ingredient_id: ingId,
    counted_qty: 8,
    notes: 'Evening spot check',
  });
  assert.equal(countRes.status, 201);
  assert.equal(countRes.body.stock_count.variance_qty, -1); // 8 - 9 = -1

  const poRes = await request(app).get('/cloud/purchases');
  assert.equal(poRes.status, 200);
  assert.ok(Array.isArray(poRes.body.purchases));

  // 8. Operations Intelligence (Aggregators, CRM, Reservations)
  db.prepare(`
    INSERT OR REPLACE INTO orders (id, order_number, type, online_platform, status, subtotal, tax_amount, discount_amount, total, created_at)
    VALUES (99802, 'ORD-SWG-1', 'delivery', 'swiggy', 'completed', 500, 25, 0, 525, CURRENT_TIMESTAMP)
  `).run();
  const opsRes = await request(app).get('/cloud/operations-intelligence?period=today');
  assert.equal(opsRes.status, 200);
  assert.ok(opsRes.body.aggregators.some((a: any) => a.platform === 'swiggy' && a.gross_sales >= 525));
  assert.ok(opsRes.body.crm && typeof opsRes.body.crm.repeat_rate_pct === 'number');
  assert.ok(opsRes.body.reservations && typeof opsRes.body.reservations.conversion_rate_pct === 'number');

  console.log('✅ All Cloud Portal 4-Pillar Analytics tests passed!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
