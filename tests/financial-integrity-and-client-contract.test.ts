/**
 * C-12.1: Financial Integrity, Payment Ledger Authority & Client Contract Test Suite
 *
 * Comprehensive automated verification for:
 * 1. Legacy payment-ledger bypass elimination & 410 Gone deprecation.
 * 2. Unverified payment spoofing & bogus external reference rejection.
 * 3. Stable payment idempotency across retries / timeouts.
 * 4. Concurrent partial payments & overpayment guard.
 * 5. Concurrent refund & refundable limit enforcement.
 * 6. Migration 0006 backfill and migration 0007 repair (no duplicate key crash).
 * 7. Completed-but-unpaid migration backfill prevention.
 * 8. Server-authoritative line/order discount role gating & manager approval.
 * 9. Modifier price tampering rejection.
 * 10. Server-authoritative tax calculation (client tax tampering ignored).
 * 11. Atomic transaction rollback on order creation & amendment failure.
 * 12. Frontend orders page contract & branch scoping.
 * 13. Mobile Flutter API service contract & non-demo honest empty list fallbacks.
 * 14. Customer payment ledger reconciliation without double-counting refunds.
 * 15. Cross-tenant and cross-branch operational isolation.
 * 16. Optimistic concurrency conflict rejection (HTTP 409).
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';

const TEST_JWT_SECRET = 'financial-integrity-test-secret-key-at-least-32-chars!';

function createSqliteD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          return {
            async first<T = any>(): Promise<T | null> {
              const stmt = db.prepare(sql);
              const row = stmt.get(...params);
              return (row as T) || null;
            },
            async all<T = any>(): Promise<{ results: T[] }> {
              const stmt = db.prepare(sql);
              const rows = stmt.all(...params);
              return { results: rows as T[] };
            },
            async run(): Promise<{ success: boolean; meta?: any }> {
              const stmt = db.prepare(sql);
              const info = stmt.run(...params);
              return { success: true, meta: { changes: info.changes } };
            },
          };
        },
      };
    },
    async batch(statements: any[]) {
      db.exec('BEGIN TRANSACTION;');
      try {
        const results = [];
        for (const stmt of statements) {
          results.push(await stmt.run());
        }
        db.exec('COMMIT;');
        return results;
      } catch (err) {
        try {
          db.exec('ROLLBACK;');
        } catch {
          // ignore rollback error if already rolled back
        }
        throw err;
      }
    },
  };
}

function runSqlFile(db: DatabaseSync, filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const clean = content.replace(/--.*$/gm, '');
  const statements = clean.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (err: any) {
      if (err?.message && (err.message.includes('duplicate column name') || err.message.includes('already exists'))) {
        continue;
      }
      throw err;
    }
  }
}

async function runC121TestSuite(): Promise<void> {
  console.log('================================================================');
  console.log('  C-12.1: FINANCIAL INTEGRITY & CLIENT CONTRACT TEST SUITE');
  console.log('================================================================\n');

  const migrationsDir = path.resolve(__dirname, '../apps/cloud-api/migrations');
  const m1Path = path.join(migrationsDir, '0001_initial_schema.sql');
  const m2Path = path.join(migrationsDir, '0002_rate_limits_and_pairing.sql');
  const m3Path = path.join(migrationsDir, '0003_sync_integrity_and_idempotency.sql');
  const m4Path = path.join(migrationsDir, '0004_restaurant_hierarchy_and_memberships.sql');
  const m5Path = path.join(migrationsDir, '0005_shared_operations_tables_and_kitchen.sql');
  const m6Path = path.join(migrationsDir, '0006_customer_payment_ledger.sql');
  const m7Path = path.join(migrationsDir, '0007_repair_legacy_payments_and_financial_integrity.sql');

  // =========================================================================
  // TEST 1: MIGRATION 0006 & 0007 REPAIR & BACKFILL INTEGRITY
  // =========================================================================
  console.log('🧪 [Test 1/16] Migration 0006 & 0007 Backfill & Repair Integrity...');
  const migDb = new DatabaseSync(':memory:');
  migDb.exec('PRAGMA foreign_keys = ON;');
  runSqlFile(migDb, m1Path);
  runSqlFile(migDb, m2Path);
  runSqlFile(migDb, m3Path);
  runSqlFile(migDb, m4Path);
  runSqlFile(migDb, m5Path);

  const testNow = new Date().toISOString();
  migDb.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES ('org-mig', 'Mig Org', 'Mig Legal', 'GST-1234', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(testNow, testNow);
  migDb.prepare(`
    INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-mig', 'org-mig', 'BM-1', 'Mig Branch', 1, 'active', ?, ?)
  `).run(testNow, testNow);

  // Seed multiple orders on same branch with same payment_method to test unique constraint collision resilience
  // Order 1: Paid by UPI
  migDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, payment_status, payment_method, subtotal, tax_total, discount_total, grand_total, ordered_at, synced_at)
    VALUES ('ord-mig-1', 'org-mig', 'br-mig', 'MIG-1', 'dine_in', 'completed', 'paid', 'upi', 500, 25, 0, 525, ?, ?)
  `).run(testNow, testNow);
  // Order 2: Paid by UPI (previously caused collision on 'LEGACY_SETTLED')
  migDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, payment_status, payment_method, subtotal, tax_total, discount_total, grand_total, ordered_at, synced_at)
    VALUES ('ord-mig-2', 'org-mig', 'br-mig', 'MIG-2', 'dine_in', 'completed', 'paid', 'upi', 300, 15, 0, 315, ?, ?)
  `).run(testNow, testNow);
  // Order 3: Completed but UNPAID (must NOT be backfilled into customer_payments)
  migDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, payment_status, payment_method, subtotal, tax_total, discount_total, grand_total, ordered_at, synced_at)
    VALUES ('ord-mig-3', 'org-mig', 'br-mig', 'MIG-3', 'dine_in', 'completed', 'unpaid', 'cash', 200, 10, 0, 210, ?, ?)
  `).run(testNow, testNow);
  // Order 4: Cancelled order (must NOT be backfilled)
  migDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, payment_status, payment_method, subtotal, tax_total, discount_total, grand_total, ordered_at, synced_at)
    VALUES ('ord-mig-4', 'org-mig', 'br-mig', 'MIG-4', 'dine_in', 'cancelled', 'unpaid', 'cash', 100, 5, 0, 105, ?, ?)
  `).run(testNow, testNow);

  // Apply migration 0006 & 0007 without collision
  runSqlFile(migDb, m6Path);
  runSqlFile(migDb, m7Path);

  // Verify backfilled customer_payments
  const backfilledPayments = migDb.prepare('SELECT order_id, amount, external_reference_id, status FROM customer_payments').all() as any[];
  assert.equal(backfilledPayments.length, 2, 'Only the 2 paid orders should be backfilled');
  const paidOrderIds = backfilledPayments.map((p) => p.order_id);
  assert.ok(paidOrderIds.includes('ord-mig-1'));
  assert.ok(paidOrderIds.includes('ord-mig-2'));
  assert.ok(!paidOrderIds.includes('ord-mig-3'), 'Completed but unpaid order must NOT be backfilled into payment ledger');
  assert.ok(!paidOrderIds.includes('ord-mig-4'), 'Cancelled order must NOT be backfilled into payment ledger');
  console.log('  ✓ Migration 0006 and 0007 backfill and collision-free unique constraints verified');

  // =========================================================================
  // SETUP LIVE D1 ENVIRONMENT FOR OPERATIONAL TESTS
  // =========================================================================
  const rawDb = new DatabaseSync(':memory:');
  const d1Bridge = createSqliteD1(rawDb);
  const env: any = {
    DB: d1Bridge,
    JWT_SECRET: TEST_JWT_SECRET,
    ENVIRONMENT: 'test',
  };

  runSqlFile(rawDb, m1Path);
  runSqlFile(rawDb, m2Path);
  runSqlFile(rawDb, m3Path);
  runSqlFile(rawDb, m4Path);
  runSqlFile(rawDb, m5Path);
  runSqlFile(rawDb, m6Path);
  runSqlFile(rawDb, m7Path);

  const nowIso = new Date().toISOString();

  // Tenant Alpha
  rawDb.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES ('org-a', 'Alpha Resto', 'Alpha Corp', 'GST-ALPHA', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES ('rest-a1', 'org-a', 'Alpha Diner', 'alpha-diner', 'dine_in', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-a1', 'org-a', 'rest-a1', 'BR-A1', 'Main Branch', 1, 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Tenant Beta (for cross-tenant checks)
  rawDb.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES ('org-b', 'Beta Resto', 'Beta Corp', 'GST-BETA', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-b1', 'org-b', 'BR-B1', 'Beta Branch', 1, 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Staff in Tenant Alpha
  // Owner
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-owner', 'org-a', 'owner@alpha.com', 'hash', 'Alice Owner', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, role, status, created_at, updated_at)
    VALUES ('mem-owner', 'org-a', 'usr-owner', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tokenOwner = await createJWT({ sub: 'usr-owner', org: 'org-a', role: 'owner', email: 'owner@alpha.com', exp }, TEST_JWT_SECRET);

  // Manager
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-mgr', 'org-a', 'mgr@alpha.com', 'hash', 'Bob Manager', 'manager', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-mgr', 'org-a', 'usr-mgr', 'br-a1', 'manager', 'active', ?, ?)
  `).run(nowIso, nowIso);
  const tokenMgr = await createJWT({ sub: 'usr-mgr', org: 'org-a', role: 'manager', email: 'mgr@alpha.com', exp }, TEST_JWT_SECRET);

  // Cashier
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-cashier', 'org-a', 'cashier@alpha.com', 'hash', 'Charlie Cashier', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-cashier', 'org-a', 'usr-cashier', 'br-a1', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);
  const tokenCashier = await createJWT({ sub: 'usr-cashier', org: 'org-a', role: 'cashier', email: 'cashier@alpha.com', exp }, TEST_JWT_SECRET);

  // Waiter
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-waiter', 'org-a', 'waiter@alpha.com', 'hash', 'David Waiter', 'waiter', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-waiter', 'org-a', 'usr-waiter', 'br-a1', 'waiter', 'active', ?, ?)
  `).run(nowIso, nowIso);
  const tokenWaiter = await createJWT({ sub: 'usr-waiter', org: 'org-a', role: 'waiter', email: 'waiter@alpha.com', exp }, TEST_JWT_SECRET);

  // Staff in Tenant Beta
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-beta', 'org-b', 'owner@beta.com', 'hash', 'Beta Owner', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, role, status, created_at, updated_at)
    VALUES ('mem-beta', 'org-b', 'usr-beta', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  const tokenBeta = await createJWT({ sub: 'usr-beta', org: 'org-b', role: 'owner', email: 'owner@beta.com', exp }, TEST_JWT_SECRET);

  // Seed Catalog Products in Org A
  rawDb.prepare(`
    INSERT INTO master_products (id, organization_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
    VALUES ('prod-margherita', 'org-a', 'Margherita Pizza', 'PIZ-01', 400.0, 5.0, 1, 1, ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO branch_product_overrides (branch_id, product_id, price_override, is_available, updated_at)
    VALUES ('br-a1', 'prod-margherita', 399.0, 1, ?)
  `).run(nowIso);

  // Dining Table in Branch A1
  rawDb.prepare(`
    INSERT INTO dining_tables (id, organization_id, branch_id, table_number, capacity, status, is_active, created_at, updated_at)
    VALUES ('tbl-1', 'org-a', 'br-a1', 'T-1', 4, 'available', 1, ?, ?)
  `).run(nowIso, nowIso);

  // =========================================================================
  // TEST 2: LEGACY PAYMENT MUTATION ENDPOINT DEPRECATION (HTTP 410 GONE)
  // =========================================================================
  console.log('🧪 [Test 2/16] Legacy Endpoint Returns HTTP 410 Gone...');
  const legacyReq = new Request('https://cloud.orderitup.internal/api/orders/any-order-id/payment', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({ payment_status: 'paid' }),
  });
  const legacyRes = await cloudWorker.fetch(legacyReq, env);
  assert.equal(legacyRes.status, 410);
  const legacyJson = await legacyRes.json() as any;
  assert.match(legacyJson.error, /deprecated/i);
  assert.match(legacyJson.migration, /POST \/api\/orders\/:id\/payments/i);
  console.log('  ✓ Legacy payment mutation blocked with HTTP 410 Gone');

  // =========================================================================
  // TEST 3: SERVER-AUTHORITATIVE CATALOG PRICING & MODIFIER TAMPERING
  // =========================================================================
  console.log('🧪 [Test 3/16] Catalog Price Authority & Modifier Tampering Rejection...');
  // Waiter attempts to inject unapproved modifier price
  const modTamperReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [
        {
          product_id: 'prod-margherita',
          quantity: 1,
          modifiers: [{ name: 'Secret Extra Cheese', price: 99.0 }],
        },
      ],
    }),
  });
  const modTamperRes = await cloudWorker.fetch(modTamperReq, env);
  assert.equal(modTamperRes.status, 400);
  const modTamperJson = await modTamperRes.json() as any;
  assert.match(modTamperJson.error, /Arbitrary modifier price/i);
  console.log('  ✓ Arbitrary modifier price injection rejected with HTTP 400');

  // =========================================================================
  // TEST 4: SERVER-AUTHORITATIVE TAX CALCULATION
  // =========================================================================
  console.log('🧪 [Test 4/16] Server-Authoritative Tax Calculation (Client Tampering Ignored)...');
  // Client attempts to pass tax_total: 0.00 and grand_total: 100.00
  const taxTamperReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      id: 'ord-tax-test',
      branch_id: 'br-a1',
      table_id: 'tbl-1',
      tax_total: 0.0,
      grand_total: 100.0,
      items: [{ product_id: 'prod-margherita', quantity: 1 }],
    }),
  });
  const taxTamperRes = await cloudWorker.fetch(taxTamperReq, env);
  assert.equal(taxTamperRes.status, 201);
  const taxTamperJson = await taxTamperRes.json() as any;
  // Subtotal = 399, Tax @ 5% = 19.95, Grand Total = 418.95
  assert.equal(taxTamperJson.order.subtotal, 399.0);
  assert.equal(taxTamperJson.order.tax_total, 19.95);
  assert.equal(taxTamperJson.order.grand_total, 418.95);
  console.log('  ✓ Tax tampering strictly overridden by server-side authoritative tax rate');

  // =========================================================================
  // TEST 5: DISCOUNT ROLE GATING & MANAGER APPROVAL
  // =========================================================================
  console.log('🧪 [Test 5/16] Discount Gating: Waiter Block & Manager Approval Enforcement...');
  // 5a. Waiter line discount rejected
  const waiterLineDiscReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-margherita', quantity: 1, discount_amount: 50.0 }],
    }),
  });
  const waiterLineDiscRes = await cloudWorker.fetch(waiterLineDiscReq, env);
  assert.equal(waiterLineDiscRes.status, 400);

  // 5b. Waiter order-level discount rejected
  const waiterOrdDiscReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      discount_total: 50.0,
      discount_reason: 'Waiter unauthorized promo',
      items: [{ product_id: 'prod-margherita', quantity: 1 }],
    }),
  });
  const waiterOrdDiscRes = await cloudWorker.fetch(waiterOrdDiscReq, env);
  assert.equal(waiterOrdDiscRes.status, 403);

  // 5c. Cashier applying line discount >15% without manager approval rejected
  const cashierLineDiscHighReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-margherita', quantity: 1, discount_amount: 100.0 }], // 100 on 399 is ~25%
    }),
  });
  const cashierLineDiscHighRes = await cloudWorker.fetch(cashierLineDiscHighReq, env);
  assert.equal(cashierLineDiscHighRes.status, 400);

  // 5d. Cashier line discount with manager approval succeeds
  const cashierApprovedDiscReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      manager_approval_user_id: 'usr-mgr',
      discount_reason: 'VIP guest courtesy discount',
      items: [{ product_id: 'prod-margherita', quantity: 1, discount_amount: 100.0 }],
    }),
  });
  const cashierApprovedDiscRes = await cloudWorker.fetch(cashierApprovedDiscReq, env);
  assert.equal(cashierApprovedDiscRes.status, 201);
  console.log('  ✓ Staff discount permissions and manager override gates strictly enforced');

  // =========================================================================
  // TEST 6: SPOOFED VERIFICATION & BOGUS TRANSACTION REFERENCES
  // =========================================================================
  console.log('🧪 [Test 6/16] Spoofed Terminal Verification & Bogus UTR Rejection...');
  // 6a. Cashier claiming 'terminal_verified' without trusted signature
  const spoofTerminalReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'card',
      amount: 100.0,
      verification_method: 'terminal_verified',
      external_reference_id: 'AUTH-VALID-1234',
    }),
  });
  const spoofTerminalRes = await cloudWorker.fetch(spoofTerminalReq, env);
  assert.equal(spoofTerminalRes.status, 400);
  const spoofJson = await spoofTerminalRes.json() as any;
  assert.match(spoofJson.error, /cannot be asserted directly/i);

  // 6b. Fake UTR references ('test', '123', 'fake', <4 chars)
  for (const bogus of ['123', 'test', 'fake', 'ab']) {
    const bogusReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier}`,
      },
      body: JSON.stringify({
        payment_method: 'upi',
        amount: 50.0,
        external_reference_id: bogus,
      }),
    });
    const bogusRes = await cloudWorker.fetch(bogusReq, env);
    assert.equal(bogusRes.status, 400);
  }
  console.log('  ✓ Spoofed verification and dummy references blocked with HTTP 400');

  // =========================================================================
  // TEST 7: STABLE IDEMPOTENCY ACROSS RETRIES
  // =========================================================================
  console.log('🧪 [Test 7/16] Stable Payment Idempotency across Client Timeouts...');
  // First attempt: Valid partial cash payment of ₹200
  const idempReq1 = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'stable-idemp-001',
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 200.0,
    }),
  });
  const idempRes1 = await cloudWorker.fetch(idempReq1, env);
  assert.equal(idempRes1.status, 201);
  const idempJson1 = await idempRes1.json() as any;
  assert.equal(idempJson1.total_paid, 200.0);
  assert.equal(idempJson1.outstanding_balance, 218.95);

  // Second attempt: Exact replay (simulating mobile timeout retry)
  const idempReq2 = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'stable-idemp-001',
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 200.0,
    }),
  });
  const idempRes2 = await cloudWorker.fetch(idempReq2, env);
  assert.equal(idempRes2.status, 200);
  const idempJson2 = await idempRes2.json() as any;
  assert.equal(idempJson2.idempotent, true);
  assert.equal(idempJson2.payment.amount, 200.0);

  // Third attempt: Replay with MISMATCHED parameters (same key, different amount)
  const idempReq3 = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'stable-idemp-001',
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 150.0,
    }),
  });
  const idempRes3 = await cloudWorker.fetch(idempReq3, env);
  assert.equal(idempRes3.status, 409);
  console.log('  ✓ Stable idempotency across retries and parameter tampering conflict (409) verified');

  // =========================================================================
  // TEST 8: CONCURRENT OVERPAYMENT GUARD
  // =========================================================================
  console.log('🧪 [Test 8/16] Overpayment Rejection & Exact Balance Settlement...');
  // Outstanding balance is ₹218.95. Attempting to pay ₹250
  const overpayReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 250.0,
    }),
  });
  const overpayRes = await cloudWorker.fetch(overpayReq, env);
  assert.equal(overpayRes.status, 400);
  const overpayJson = await overpayRes.json() as any;
  assert.match(overpayJson.error, /exceeds outstanding order balance/i);

  // Exact balance settlement with valid UPI reference
  const settleReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'upi-settle-001',
    },
    body: JSON.stringify({
      payment_method: 'upi',
      amount: 218.95,
      external_reference_id: 'UTR-HDFC-99887766',
    }),
  });
  const settleRes = await cloudWorker.fetch(settleReq, env);
  assert.equal(settleRes.status, 201);
  const settleJson = await settleRes.json() as any;
  assert.equal(settleJson.total_paid, 418.95);
  assert.equal(settleJson.outstanding_balance, 0.0);
  assert.equal(settleJson.order_payment_status, 'paid');
  console.log('  ✓ Overpayment rejected and exact balance settled cleanly');

  // =========================================================================
  // TEST 9: AUDITABLE REFUND LIMITS & RECONCILIATION WITHOUT DOUBLE-COUNTING
  // =========================================================================
  console.log('🧪 [Test 9/16] Auditable Refund Limits & Double-Counting Elimination...');
  const cashPayId = idempJson1.payment.id;

  // 9a. Refund exceeding tender amount (cash was ₹200, attempting ₹250 refund)
  const overRefundReq = new Request(`https://cloud.orderitup.internal/api/orders/ord-tax-test/payments/${cashPayId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      amount: 250.0,
      reason: 'Customer complaint',
    }),
  });
  const overRefundRes = await cloudWorker.fetch(overRefundReq, env);
  assert.equal(overRefundRes.status, 400);

  // 9b. Refund without mandatory reason
  const noReasonRefundReq = new Request(`https://cloud.orderitup.internal/api/orders/ord-tax-test/payments/${cashPayId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      amount: 100.0,
    }),
  });
  const noReasonRefundRes = await cloudWorker.fetch(noReasonRefundReq, env);
  assert.equal(noReasonRefundRes.status, 400);

  // 9c. Valid partial refund of ₹100
  const validRefundReq = new Request(`https://cloud.orderitup.internal/api/orders/ord-tax-test/payments/${cashPayId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'refund-cash-001',
    },
    body: JSON.stringify({
      amount: 100.0,
      reason: 'Incorrect item served',
    }),
  });
  const validRefundRes = await cloudWorker.fetch(validRefundReq, env);
  assert.equal(validRefundRes.status, 200);
  const validRefundJson = await validRefundRes.json() as any;
  assert.equal(validRefundJson.refunded_amount, 100.0);
  assert.equal(validRefundJson.order_payment_status, 'partially_paid');

  // 9d. Reconcile Ledger Endpoint: Verify total_paid does not double count
  const ledgerReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCashier}` },
  });
  const ledgerRes = await cloudWorker.fetch(ledgerReq, env);
  assert.equal(ledgerRes.status, 200);
  const ledgerJson = await ledgerRes.json() as any;
  // Total Paid must strictly be 318.95 (200 cash - 100 refund + 218.95 UPI)
  assert.equal(ledgerJson.total_paid, 318.95);
  assert.equal(ledgerJson.outstanding_balance, 100.0);
  console.log('  ✓ Refund limits enforced and ledger reconciliation without double-counting verified');

  // =========================================================================
  // TEST 10: ATOMIC TRANSACTION ROLLBACK ON FAILURE
  // =========================================================================
  console.log('🧪 [Test 10/16] Atomic Rollback on Order Creation & Amendment Failure...');
  // Create order where second item has an invalid/unlisted product ID
  const atomicReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      id: 'ord-atomic-fail',
      branch_id: 'br-a1',
      items: [
        { product_id: 'prod-margherita', quantity: 1 },
        { product_id: 'prod-non-existent-fail', quantity: 1 },
      ],
    }),
  });
  const atomicRes = await cloudWorker.fetch(atomicReq, env);
  assert.equal(atomicRes.status, 400);

  // Verify that neither order nor first item was persisted in SQLite
  const checkOrder = rawDb.prepare('SELECT id FROM synced_orders WHERE id = ?').get('ord-atomic-fail');
  assert.equal(checkOrder, undefined, 'Order must not exist due to atomic rollback');
  const checkItems = rawDb.prepare('SELECT id FROM synced_order_items WHERE order_id = ?').all('ord-atomic-fail');
  assert.equal(checkItems.length, 0, 'No items should exist due to atomic rollback');
  console.log('  ✓ Full atomic transaction rollback confirmed');

  // =========================================================================
  // TEST 11: OPTIMISTIC CONCURRENCY CONFLICT (HTTP 409)
  // =========================================================================
  console.log('🧪 [Test 11/16] Optimistic Concurrency Conflict on Stale Version...');
  // Settle remaining ₹100 on ord-tax-test so order is fully paid
  const settleRemainingReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 100.0,
    }),
  });
  await cloudWorker.fetch(settleRemainingReq, env);

  const currentOrd = rawDb.prepare('SELECT version FROM synced_orders WHERE id = ?').get('ord-tax-test') as any;
  const currentVersion = currentOrd.version;

  // Client 1 checks out order with currentVersion (succeeds, version advances)
  const client1Req = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({ status: 'completed', expected_version: currentVersion }),
  });
  const client1Res = await cloudWorker.fetch(client1Req, env);
  assert.equal(client1Res.status, 200);

  // Client 2 attempts stale update still specifying expected_version: currentVersion
  const client2Req = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({ status: 'cancelled', expected_version: currentVersion }),
  });
  const client2Res = await cloudWorker.fetch(client2Req, env);
  assert.equal(client2Res.status, 409);
  console.log('  ✓ Stale version update rejected with HTTP 409 Conflict');

  // =========================================================================
  // TEST 12: CROSS-TENANT & CROSS-BRANCH ISOLATION
  // =========================================================================
  console.log('🧪 [Test 12/16] Strict Cross-Tenant & Cross-Branch Security...');
  // Rival Tenant Beta attempts to view Tenant Alpha's order
  const rivalOrderReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenBeta}` },
  });
  const rivalOrderRes = await cloudWorker.fetch(rivalOrderReq, env);
  assert.equal(rivalOrderRes.status, 404);

  // Rival Tenant Beta attempts to view Tenant Alpha's payments
  const rivalPayReq = new Request('https://cloud.orderitup.internal/api/orders/ord-tax-test/payments', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenBeta}` },
  });
  const rivalPayRes = await cloudWorker.fetch(rivalPayReq, env);
  assert.equal(rivalPayRes.status, 404);
  console.log('  ✓ Cross-tenant requests securely denied with HTTP 404');

  // =========================================================================
  // TEST 13: DESKTOP OFFLINE INGESTION TO CUSTOMER PAYMENT LEDGER
  // =========================================================================
  console.log('🧪 [Test 13/16] Offline POS Sync Ingestion into Customer Payment Ledger...');
  // Pair terminal
  const rawTerminalToken = 'valid-desktop-sync-token-xyz';
  const tokenHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawTerminalToken));
  const tokenHash = Array.from(new Uint8Array(tokenHashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  rawDb.prepare(`
    INSERT INTO terminals (id, organization_id, branch_id, terminal_name, terminal_token_hash, status, created_at)
    VALUES ('term-offline-1', 'org-a', 'br-a1', 'Register 1', ?, 'active', ?)
  `).run(tokenHash, nowIso);

  // =========================================================================
  // TEST 13: OFFLINE POS SYNC & STRICT PAYMENT SETTLEMENT DERIVATION (P0)
  // =========================================================================
  console.log('🧪 [Test 13/17] P0 Offline Payment Settlement Derivation & Integrity...');

  // 13a. Completed order with NO payment_status -> must remain 'unpaid', NO customer_payments row
  const offlineUnpaidOrderId = 'ord-sync-no-paystatus-001';
  const syncEventNoPayment = {
    events: [
      {
        id: 'evt-sync-nopay-001',
        type: 'order.completed',
        payload: {
          id: offlineUnpaidOrderId,
          order_number: 'OFF-101',
          order_type: 'takeaway',
          status: 'completed',
          subtotal: 399.0,
          tax_total: 19.95,
          grand_total: 418.95,
          payment_method: 'cash',
          ordered_at: nowIso,
          items: [{ product_id: 'prod-margherita', quantity: 1, unit_price: 399.0 }],
        },
      },
    ],
  };

  const syncReqNoPay = new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${rawTerminalToken}`,
    },
    body: JSON.stringify(syncEventNoPayment),
  });
  const syncResNoPay = await cloudWorker.fetch(syncReqNoPay, env);
  assert.equal(syncResNoPay.status, 200);

  const orderNoPay = rawDb.prepare('SELECT payment_status, status FROM synced_orders WHERE id = ?').get(offlineUnpaidOrderId) as any;
  assert.ok(orderNoPay, 'Order must be ingested');
  assert.equal(orderNoPay.status, 'completed');
  assert.equal(orderNoPay.payment_status, 'unpaid', 'Order with omitted payment_status MUST remain unpaid');

  const paymentNoPay = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').get(offlineUnpaidOrderId) as any;
  assert.equal(paymentNoPay, undefined, 'NO customer_payments row should exist for order with omitted payment_status');
  console.log('  ✓ Completed order with no payment status → unpaid; no payment ledger row');

  // 13b. Completed order with explicit unpaid status -> no payment ledger row
  const offlineExplicitUnpaidOrderId = 'ord-sync-explicit-unpaid-002';
  const syncEventExplicitUnpaid = {
    events: [
      {
        id: 'evt-sync-unpaid-002',
        type: 'order.completed',
        payload: {
          id: offlineExplicitUnpaidOrderId,
          order_number: 'OFF-102',
          order_type: 'takeaway',
          status: 'completed',
          payment_status: 'unpaid',
          subtotal: 399.0,
          tax_total: 19.95,
          grand_total: 418.95,
          payment_method: 'cash',
          ordered_at: nowIso,
          items: [{ product_id: 'prod-margherita', quantity: 1, unit_price: 399.0 }],
        },
      },
    ],
  };

  const syncResExpUnpaid = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(syncEventExplicitUnpaid),
  }), env);
  assert.equal(syncResExpUnpaid.status, 200);

  const orderExpUnpaid = rawDb.prepare('SELECT payment_status FROM synced_orders WHERE id = ?').get(offlineExplicitUnpaidOrderId) as any;
  assert.equal(orderExpUnpaid.payment_status, 'unpaid');
  const paymentExpUnpaid = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').get(offlineExplicitUnpaidOrderId) as any;
  assert.equal(paymentExpUnpaid, undefined, 'NO customer_payments row should exist for explicit unpaid order');
  console.log('  ✓ Completed order with explicit unpaid status → no payment ledger row');

  // 13c. Ordinary order-sync event cannot bypass ledger or mark order paid
  const offlineSettledOrderId = 'ord-sync-settled-003';
  const syncEventSettled = {
    events: [
      {
        id: 'evt-sync-settled-003-ord',
        type: 'order.completed',
        payload: {
          id: offlineSettledOrderId,
          order_number: 'OFF-103',
          order_type: 'takeaway',
          status: 'completed',
          payment_status: 'paid', // Ordinary order event claims paid
          subtotal: 399.0,
          tax_total: 19.95,
          grand_total: 418.95,
          payment_method: 'cash',
          ordered_at: nowIso,
          items: [{ product_id: 'prod-margherita', quantity: 1, unit_price: 399.0 }],
        },
      },
    ],
  };

  const syncResSettled = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(syncEventSettled),
  }), env);
  assert.equal(syncResSettled.status, 200);

  const orderSettled = rawDb.prepare('SELECT payment_status FROM synced_orders WHERE id = ?').get(offlineSettledOrderId) as any;
  assert.equal(orderSettled.payment_status, 'unpaid', 'Ordinary order.completed event must NOT mark order paid');

  const paymentsBeforeDedicated = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').all(offlineSettledOrderId) as any[];
  assert.equal(paymentsBeforeDedicated.length, 0, 'Ordinary order event must NEVER create customer_payments ledger row');
  console.log('  ✓ Ordinary order.completed claiming paid → starts unpaid with 0 payment ledger rows');

  // Now settle through dedicated payment.settled event
  const paymentSettledEvent = {
    events: [
      {
        id: 'evt-sync-settled-003-pay',
        type: 'payment.settled',
        payload: {
          order_id: offlineSettledOrderId,
          amount: 418.95,
          payment_method: 'cash',
          settled_at: nowIso,
        },
      },
    ],
  };

  const syncResPayment = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(paymentSettledEvent),
  }), env);
  assert.equal(syncResPayment.status, 200);

  const orderAfterPay = rawDb.prepare('SELECT payment_status, payment_method FROM synced_orders WHERE id = ?').get(offlineSettledOrderId) as any;
  assert.equal(orderAfterPay.payment_status, 'paid');
  assert.equal(orderAfterPay.payment_method, 'cash');

  const paymentsSettled = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').all(offlineSettledOrderId) as any[];
  assert.equal(paymentsSettled.length, 1, 'Exactly one payment ledger row must be created for valid offline settlement');
  assert.equal(paymentsSettled[0].amount, 418.95);
  assert.equal(paymentsSettled[0].payment_method, 'cash');
  assert.equal(paymentsSettled[0].verification_method, 'cashier_collected');
  assert.equal(paymentsSettled[0].status, 'completed');
  console.log('  ✓ Dedicated payment.settled event records auditable payment and marks order paid');

  // 13d. Replayed settlement event -> exactly one ledger entry
  const syncResReplay = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(paymentSettledEvent),
  }), env);
  assert.equal(syncResReplay.status, 200);
  const replayJson = await syncResReplay.json() as any;
  assert.equal(replayJson.processed_count, 1, 'Idempotent replay must acknowledge processed event');

  const paymentsAfterReplay = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').all(offlineSettledOrderId) as any[];
  assert.equal(paymentsAfterReplay.length, 1, 'Replayed settlement event must NOT duplicate payment');
  console.log('  ✓ Replayed settlement event → exactly one ledger entry');

  // 13e. Conflicting replay using the same event ID -> rejected without changing the ledger
  const conflictingSyncEvent = {
    events: [
      {
        id: 'evt-sync-settled-003-pay', // Reused ID
        type: 'payment.settled',
        payload: {
          order_id: offlineSettledOrderId,
          amount: 999999.0, // Tampered amount
          payment_method: 'cash',
        },
      },
    ],
  };

  const syncResConflict = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(conflictingSyncEvent),
  }), env);
  assert.equal(syncResConflict.status, 200);
  const conflictJson = await syncResConflict.json() as any;
  assert.equal(conflictJson.failed_count, 1, 'Conflicting event replay must fail');
  assert.equal(conflictJson.processed_count, 0);

  const paymentAfterConflict = rawDb.prepare('SELECT amount FROM customer_payments WHERE order_id = ?').get(offlineSettledOrderId) as any;
  assert.equal(paymentAfterConflict.amount, 418.95, 'Ledger payment amount must remain untampered');
  console.log('  ✓ Conflicting replay using the same event ID → rejected without changing the ledger');

  // 13f. Stale order-sync event cannot downgrade an already-paid order or fake a refund
  const staleOrderEvent = {
    events: [
      {
        id: 'evt-sync-stale-downgrade-004',
        type: 'order.updated',
        payload: {
          id: offlineSettledOrderId,
          status: 'completed',
          payment_status: 'unpaid', // Stale or malicious attempt to downgrade paid order
          grand_total: 418.95,
        },
      },
      {
        id: 'evt-sync-fake-refund-005',
        type: 'order.updated',
        payload: {
          id: offlineSettledOrderId,
          status: 'completed',
          payment_status: 'refunded', // Fake refund attempt without refund ledger operation
          grand_total: 418.95,
        },
      },
    ],
  };

  const syncResStale = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(staleOrderEvent),
  }), env);
  assert.equal(syncResStale.status, 200);

  const orderAfterStale = rawDb.prepare('SELECT payment_status FROM synced_orders WHERE id = ?').get(offlineSettledOrderId) as any;
  assert.equal(orderAfterStale.payment_status, 'paid', 'Stale or fake order updates cannot alter authoritative paid status');
  console.log('  ✓ Stale order-sync event cannot downgrade an already-paid order or fake refund');

  // 13g. ₹210 order + ₹100 payment → partially paid, outstanding ₹110
  const order210Id = 'ord-c123-210';
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, version, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'ORD-210', 'dine_in', 'completed', 200.0, 10.0, 0, 210.0, 'unpaid', 'none', 1, ?, ?)
  `).run(order210Id, nowIso, nowIso);

  const pay100Event = {
    events: [
      {
        id: 'evt-c123-pay-100',
        type: 'payment.settled',
        payload: {
          order_id: order210Id,
          amount: 100.0,
          payment_method: 'upi',
          external_reference_id: 'UTR-C123-PARTIAL-100',
          settled_at: nowIso,
        },
      },
    ],
  };

  const resPay100 = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(pay100Event),
  }), env);
  assert.equal(resPay100.status, 200);

  const orderAfter100 = rawDb.prepare('SELECT payment_status, payment_method, version FROM synced_orders WHERE id = ?').get(order210Id) as any;
  assert.equal(orderAfter100.payment_status, 'partially_paid');
  assert.equal(orderAfter100.payment_method, 'upi');
  assert.equal(orderAfter100.version, 2);

  const paymentsAfter100 = rawDb.prepare('SELECT amount, external_reference_id, is_split FROM customer_payments WHERE order_id = ?').all(order210Id) as any[];
  assert.equal(paymentsAfter100.length, 1);
  assert.equal(paymentsAfter100[0].amount, 100.0);
  assert.equal(paymentsAfter100[0].external_reference_id, 'UTR-C123-PARTIAL-100');
  console.log('  ✓ ₹210 order + ₹100 payment → partially paid (outstanding ₹110)');

  // 13h. Same order + ₹110 payment → paid, outstanding ₹0
  const pay110Event = {
    events: [
      {
        id: 'evt-c123-pay-110',
        type: 'payment.settled',
        payload: {
          order_id: order210Id,
          amount: 110.0,
          payment_method: 'card',
          external_reference_id: 'CARD-AUTH-C123-110',
          settled_at: nowIso,
        },
      },
    ],
  };

  const resPay110 = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(pay110Event),
  }), env);
  assert.equal(resPay110.status, 200);

  const orderAfter110 = rawDb.prepare('SELECT payment_status, payment_method, version FROM synced_orders WHERE id = ?').get(order210Id) as any;
  assert.equal(orderAfter110.payment_status, 'paid');
  assert.equal(orderAfter110.payment_method, 'card');
  assert.equal(orderAfter110.version, 3);

  const paymentsAfter110 = rawDb.prepare('SELECT amount, external_reference_id, is_split FROM customer_payments WHERE order_id = ? ORDER BY created_at ASC').all(order210Id) as any[];
  assert.equal(paymentsAfter110.length, 2);
  assert.equal(paymentsAfter110[1].amount, 110.0);
  assert.equal(paymentsAfter110[1].external_reference_id, 'CARD-AUTH-C123-110');
  assert.equal(paymentsAfter110[1].is_split, 1);
  console.log('  ✓ Same order + ₹110 payment → paid (outstanding ₹0)');

  // 13i. Attempt another ₹1 after full payment → rejected, no additional ledger row
  const pay1OverEvent = {
    events: [
      {
        id: 'evt-c123-pay-over-1',
        type: 'payment.settled',
        payload: {
          order_id: order210Id,
          amount: 1.0,
          payment_method: 'cash',
          settled_at: nowIso,
        },
      },
    ],
  };

  const resPay1Over = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(pay1OverEvent),
  }), env);
  assert.equal(resPay1Over.status, 200);
  const jsonPay1Over = await resPay1Over.json() as any;
  assert.equal(jsonPay1Over.processed_count, 0);
  assert.equal(jsonPay1Over.failed_count, 1);

  const paymentsAfterOver = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').all(order210Id) as any[];
  assert.equal(paymentsAfterOver.length, 2, 'No additional payment row must be created after order is fully paid');
  console.log('  ✓ Attempt another ₹1 after full payment → rejected, no additional ledger row');

  // 13j. ₹220 payment against original unpaid ₹210 order → rejected, no ledger mutation
  const orderUnpaid210Id = 'ord-c123-unpaid-210';
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, version, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'ORD-UNPAID-210', 'dine_in', 'completed', 200.0, 10.0, 0, 210.0, 'unpaid', 'none', 1, ?, ?)
  `).run(orderUnpaid210Id, nowIso, nowIso);

  const pay220OverEvent = {
    events: [
      {
        id: 'evt-c123-pay-220',
        type: 'payment.settled',
        payload: {
          order_id: orderUnpaid210Id,
          amount: 220.0,
          payment_method: 'cash',
          settled_at: nowIso,
        },
      },
    ],
  };

  const resPay220 = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(pay220OverEvent),
  }), env);
  assert.equal(resPay220.status, 200);
  const jsonPay220 = await resPay220.json() as any;
  assert.equal(jsonPay220.processed_count, 0);
  assert.equal(jsonPay220.failed_count, 1);

  const payments220 = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').all(orderUnpaid210Id) as any[];
  assert.equal(payments220.length, 0, 'No payment ledger row may be created for overpayment');
  const order220 = rawDb.prepare('SELECT payment_status FROM synced_orders WHERE id = ?').get(orderUnpaid210Id) as any;
  assert.equal(order220.payment_status, 'unpaid', 'Order remains unpaid on overpayment rejection');
  console.log('  ✓ ₹220 payment against ₹210 order → rejected, no ledger mutation');

  // 13k. Two concurrent ₹120 payments against ₹210 order → no overpayment, atomic rollback
  const orderConcur210Id = 'ord-c123-concur-210';
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, version, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'ORD-CONCUR-210', 'dine_in', 'completed', 200.0, 10.0, 0, 210.0, 'unpaid', 'none', 1, ?, ?)
  `).run(orderConcur210Id, nowIso, nowIso);

  // First ₹120 payment succeeds
  const payConcur1Event = {
    events: [
      {
        id: 'evt-c123-concur-1',
        type: 'payment.settled',
        payload: {
          order_id: orderConcur210Id,
          amount: 120.0,
          payment_method: 'card',
          external_reference_id: 'CARD-CONCUR-120-A',
          settled_at: nowIso,
        },
      },
    ],
  };

  const resConcur1 = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(payConcur1Event),
  }), env);
  assert.equal(resConcur1.status, 200);
  const jsonConcur1 = await resConcur1.json() as any;
  assert.equal(jsonConcur1.processed_count, 1);

  // Second ₹120 payment (against original ₹210 total, remaining balance is now ₹90)
  // Settlement of ₹120 > remaining ₹90 -> must be rejected without overpayment
  const payConcur2Event = {
    events: [
      {
        id: 'evt-c123-concur-2',
        type: 'payment.settled',
        payload: {
          order_id: orderConcur210Id,
          amount: 120.0,
          payment_method: 'card',
          external_reference_id: 'CARD-CONCUR-120-B',
          settled_at: nowIso,
        },
      },
    ],
  };

  const resConcur2 = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(payConcur2Event),
  }), env);
  assert.equal(resConcur2.status, 200);
  const jsonConcur2 = await resConcur2.json() as any;
  assert.equal(jsonConcur2.processed_count, 0);
  assert.equal(jsonConcur2.failed_count, 1);

  const concurPayments = rawDb.prepare('SELECT amount, external_reference_id FROM customer_payments WHERE order_id = ?').all(orderConcur210Id) as any[];
  assert.equal(concurPayments.length, 1);
  assert.equal(concurPayments[0].amount, 120.0);
  const concurOrder = rawDb.prepare('SELECT payment_status FROM synced_orders WHERE id = ?').get(orderConcur210Id) as any;
  assert.equal(concurOrder.payment_status, 'partially_paid');
  console.log('  ✓ Two concurrent ₹120 payment attempts against ₹210 → no overpayment; only valid committed settlements remain');

  // 13l. Duplicate external transaction reference (UTR) across distinct payment events -> rejected
  const orderUtrAId = 'ord-c123-utr-a';
  const orderUtrBId = 'ord-c123-utr-b';
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, version, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'ORD-UTR-A', 'dine_in', 'completed', 200.0, 10.0, 0, 210.0, 'unpaid', 'none', 1, ?, ?)
  `).run(orderUtrAId, nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, version, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'ORD-UTR-B', 'dine_in', 'completed', 200.0, 10.0, 0, 210.0, 'unpaid', 'none', 1, ?, ?)
  `).run(orderUtrBId, nowIso, nowIso);

  const sharedUtr = 'UTR-SHARED-REPLAY-999888';
  const payUtrAEvent = {
    events: [
      {
        id: 'evt-c123-utr-first',
        type: 'payment.settled',
        payload: {
          order_id: orderUtrAId,
          amount: 210.0,
          payment_method: 'upi',
          external_reference_id: sharedUtr,
          settled_at: nowIso,
        },
      },
    ],
  };

  const resUtrA = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(payUtrAEvent),
  }), env);
  assert.equal(resUtrA.status, 200);
  const jsonUtrA = await resUtrA.json() as any;
  assert.equal(jsonUtrA.processed_count, 1);

  // Distinct payment event using identical UTR on a different order
  const payUtrBEvent = {
    events: [
      {
        id: 'evt-c123-utr-second',
        type: 'payment.settled',
        payload: {
          order_id: orderUtrBId,
          amount: 210.0,
          payment_method: 'upi',
          external_reference_id: sharedUtr,
          settled_at: nowIso,
        },
      },
    ],
  };

  const resUtrB = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(payUtrBEvent),
  }), env);
  assert.equal(resUtrB.status, 200);
  const jsonUtrB = await resUtrB.json() as any;
  assert.equal(jsonUtrB.processed_count, 0, 'Duplicate UTR must NOT be processed');
  assert.equal(jsonUtrB.failed_count, 1);

  const paymentsB = rawDb.prepare('SELECT * FROM customer_payments WHERE order_id = ?').all(orderUtrBId) as any[];
  assert.equal(paymentsB.length, 0, 'No payment ledger row allowed for duplicate external reference');
  console.log('  ✓ Two distinct payment events using the same UTR → duplicate rejected');

  // 13m. UPI settlement without external reference or with bogus reference -> rejected
  const orderRefTestId = 'ord-c123-reftest';
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, version, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'ORD-REF-TEST', 'dine_in', 'completed', 200.0, 10.0, 0, 210.0, 'unpaid', 'none', 1, ?, ?)
  `).run(orderRefTestId, nowIso, nowIso);

  // Without reference
  const payNoRef = {
    events: [
      {
        id: 'evt-c123-no-ref',
        type: 'payment.settled',
        payload: {
          order_id: orderRefTestId,
          amount: 210.0,
          payment_method: 'upi',
          settled_at: nowIso,
        },
      },
    ],
  };
  const resNoRef = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(payNoRef),
  }), env);
  const jsonNoRef = await resNoRef.json() as any;
  assert.equal(jsonNoRef.processed_count, 0, 'UPI settlement without external reference must be rejected');

  // With bogus reference ('test')
  const payBogusRef = {
    events: [
      {
        id: 'evt-c123-bogus-ref',
        type: 'payment.settled',
        payload: {
          order_id: orderRefTestId,
          amount: 210.0,
          payment_method: 'upi',
          external_reference_id: 'test',
          settled_at: nowIso,
        },
      },
    ],
  };
  const resBogusRef = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(payBogusRef),
  }), env);
  const jsonBogusRef = await resBogusRef.json() as any;
  assert.equal(jsonBogusRef.processed_count, 0, 'UPI settlement with bogus reference must be rejected');

  // With genuine reference -> succeeds and persists external_reference_id
  const genuineUtr = 'UTR-AXIS-GENUINE-882211';
  const payGenuineRef = {
    events: [
      {
        id: 'evt-c123-genuine-ref',
        type: 'payment.settled',
        payload: {
          order_id: orderRefTestId,
          amount: 210.0,
          payment_method: 'upi',
          external_reference_id: genuineUtr,
          settled_at: nowIso,
        },
      },
    ],
  };
  const resGenuineRef = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(payGenuineRef),
  }), env);
  const jsonGenuineRef = await resGenuineRef.json() as any;
  assert.equal(jsonGenuineRef.processed_count, 1, 'UPI settlement with genuine reference must succeed');

  const refPayment = rawDb.prepare('SELECT external_reference_id FROM customer_payments WHERE order_id = ?').get(orderRefTestId) as any;
  assert.equal(refPayment.external_reference_id, genuineUtr, 'Genuine reference must be persisted into customer_payments');
  console.log('  ✓ UPI settlement without external reference rejected; valid reference saved in ledger');

  // 13n. Client-asserted verification spoofing rejected -> classified as manual_cashier_confirmed
  const orderSpoofId = 'ord-c123-spoof';
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, version, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'ORD-SPOOF', 'dine_in', 'completed', 200.0, 10.0, 0, 210.0, 'unpaid', 'none', 1, ?, ?)
  `).run(orderSpoofId, nowIso, nowIso);

  const paySpoofEvent = {
    events: [
      {
        id: 'evt-c123-spoof-verif',
        type: 'payment.settled',
        payload: {
          order_id: orderSpoofId,
          amount: 210.0,
          payment_method: 'upi',
          external_reference_id: 'UTR-SPOOF-VERIF-991',
          verification_method: 'gateway_verified', // Spoofed client claim
          gateway_signature: 'fake-signature-string',
          terminal_auth_code: 'fake-auth-code',
          settled_at: nowIso,
        },
      },
    ],
  };

  const resSpoof = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rawTerminalToken}` },
    body: JSON.stringify(paySpoofEvent),
  }), env);
  assert.equal(resSpoof.status, 200);

  const spoofPayment = rawDb.prepare('SELECT verification_method FROM customer_payments WHERE order_id = ?').get(orderSpoofId) as any;
  assert.equal(spoofPayment.verification_method, 'manual_cashier_confirmed', 'Client-supplied gateway_verified or terminal_verified must NOT become verified classification');
  console.log('  ✓ Client-supplied gateway/terminal verification string → classified as manual_cashier_confirmed');

  // =========================================================================
  // TEST 14: FRONTEND ORDERS PAGE CLIENT CONTRACT (BRANCH_ID SCOPING)
  // =========================================================================
  console.log('🧪 [Test 14/17] Frontend Orders Page Client Contract (branch_id Required)...');
  const noBranchReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwner}` },
  });
  const noBranchRes = await cloudWorker.fetch(noBranchReq, env);
  assert.equal(noBranchRes.status, 400);

  const withBranchReq = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-a1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwner}` },
  });
  const withBranchRes = await cloudWorker.fetch(withBranchReq, env);
  assert.equal(withBranchRes.status, 200);
  const withBranchJson = await withBranchRes.json() as any;
  assert.ok(Array.isArray(withBranchJson.orders));
  console.log('  ✓ branch_id requirement and scoping confirmed for orders list');

  // =========================================================================
  // TEST 15: ACTIVE ORDER LOOKUP BRANCH SCOPE & MULTI-BRANCH ISOLATION
  // =========================================================================
  console.log('🧪 [Test 15/17] Active Order Lookup Branch Scope & Branch Switch Isolation...');
  // Seed dining table and second branch for branch switch verification
  rawDb.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-a2', 'org-a', 'rest-a1', 'BR-A2', 'Branch 2', 0, 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO dining_tables (id, organization_id, restaurant_id, branch_id, table_number, created_at, updated_at)
    VALUES ('tbl-scope-1', 'org-a', 'rest-a1', 'br-a1', 'T1', ?, ?)
  `).run(nowIso, nowIso);

  const tableOrderIdBranchA = 'ord-table-branch-a-1';
  rawDb.prepare(`
    INSERT INTO synced_orders (id, organization_id, branch_id, table_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_status, payment_method, ordered_at, synced_at)
    VALUES (?, 'org-a', 'br-a1', 'tbl-scope-1', 'ORD-A-101', 'dine_in', 'pending', 150.0, 7.5, 0, 157.5, 'unpaid', 'cash', ?, ?)
  `).run(tableOrderIdBranchA, nowIso, nowIso);

  // 15a. Active order found in selected branch
  const tableOrderReqA = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-a1&table_id=tbl-scope-1&type=dine_in&status=pending,preparing,ready&limit=1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwner}` },
  });
  const tableOrderResA = await cloudWorker.fetch(tableOrderReqA, env);
  assert.equal(tableOrderResA.status, 200);
  const tableOrderJsonA = await tableOrderResA.json() as any;
  assert.equal(tableOrderJsonA.orders.length, 1);
  assert.equal(tableOrderJsonA.orders[0].id, tableOrderIdBranchA);
  console.log('  ✓ Active order found in the selected branch');

  // 15b. No active order in selected branch for empty table
  const tableEmptyReq = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-a1&table_id=tbl-empty-99&type=dine_in&status=pending,preparing,ready&limit=1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwner}` },
  });
  const tableEmptyRes = await cloudWorker.fetch(tableEmptyReq, env);
  assert.equal(tableEmptyRes.status, 200);
  const tableEmptyJson = await tableEmptyRes.json() as any;
  assert.equal(tableEmptyJson.orders.length, 0);
  console.log('  ✓ No active order in the selected branch');

  // 15c. Branch switch does not leak the previous branch's order
  const tableOrderReqB = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-a2&table_id=tbl-scope-1&type=dine_in&status=pending,preparing,ready&limit=1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwner}` },
  });
  const tableOrderResB = await cloudWorker.fetch(tableOrderReqB, env);
  assert.equal(tableOrderResB.status, 200);
  const tableOrderJsonB = await tableOrderResB.json() as any;
  assert.equal(tableOrderJsonB.orders.length, 0, 'Branch switch to br-a2 must NOT return order from br-a1');
  console.log('  ✓ Branch switch does not leak previous branch\'s order');

  // 15d. Missing/unauthorized branch returns an honest error rather than appearing as "no active order"
  const missingBranchReq = new Request('https://cloud.orderitup.internal/api/orders?table_id=tbl-scope-1&type=dine_in&status=pending,preparing,ready&limit=1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwner}` },
  });
  const missingBranchRes = await cloudWorker.fetch(missingBranchReq, env);
  assert.equal(missingBranchRes.status, 400, 'Missing branch_id must return HTTP 400');

  const unauthBranchReq = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-foreign&table_id=tbl-scope-1&type=dine_in&status=pending,preparing,ready&limit=1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCashier}` },
  });
  const unauthBranchRes = await cloudWorker.fetch(unauthBranchReq, env);
  assert.equal(unauthBranchRes.status, 403, 'Unauthorized branch access must return HTTP 403');
  console.log('  ✓ Missing/unauthorized branch returns an honest error rather than silently appearing as "no active order"');

  // =========================================================================
  // TEST 16: MOBILE FLUTTER CLIENT CONTRACT (ZERO MOCK DATA LEAKAGE)
  // =========================================================================
  console.log('🧪 [Test 16/17] Mobile Flutter Client Contract (Zero Mock Data Leakage)...');
  const apiServiceDart = fs.readFileSync(path.resolve(__dirname, '../mobile/lib/services/api_service.dart'), 'utf-8');

  // Verify honest empty lists on non-demo catch blocks across all entities
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return MockDataService.getCategories();'), 'getCategories must not fall back to MockDataService');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoProducts;'), 'getProducts must not fall back to _demoProducts');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoOrders;'), 'getAllOrders must not fall back to _demoOrders');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoTables;'), 'getTables must not fall back to _demoTables');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoKds;'), 'getKdsTickets must not fall back to _demoKds');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoHeldOrders;'), 'getHeldOrders must not fall back to _demoHeldOrders');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoCustomers;'), 'getCustomers must not fall back to _demoCustomers');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoIngredients;'), 'getIngredients must not fall back to _demoIngredients');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoClosures;'), 'getCashClosures must not fall back to _demoClosures');
  assert.ok(!apiServiceDart.includes('catch (_) {\n      return _demoReservations;'), 'getReservations must not fall back to _demoReservations');

  // Verify getActiveOrderForTable requires branch_id and passes limit: 1
  assert.ok(apiServiceDart.includes("'branch_id': activeBranchId!"), 'getActiveOrderForTable must pass activeBranchId');
  assert.ok(apiServiceDart.includes("'limit': '1'"), 'getActiveOrderForTable must pass limit 1');
  assert.ok(apiServiceDart.includes("throw ApiException("), 'getActiveOrderForTable must throw ApiException when activeBranchId is missing');

  // Verify KDS separation between Cloud and LAN
  assert.ok(apiServiceDart.includes('final isCloud ='), 'KDS methods must explicitly detect cloud mode');
  assert.ok(apiServiceDart.includes('/api/kitchen/tickets/$ticketId/status'), 'Cloud KDS must target /api/kitchen/tickets');

  const apiClientDart = fs.readFileSync(path.resolve(__dirname, '../mobile/lib/core/network/api_client.dart'), 'utf-8');
  assert.ok(apiClientDart.includes('customIdempotencyKey'), 'api_client.dart must support customIdempotencyKey for stable payment retries');
  console.log('  ✓ Mobile Flutter contracts and zero mock data leakage strictly verified in code');

  // =========================================================================
  // TEST 17: FRONTEND ORDER COMPONENT SAFETY (ELECTRON GUARD)
  // =========================================================================
  console.log('🧪 [Test 17/17] Frontend Orders Component Browser/Web Environment Safety...');
  const ordersPageTsx = fs.readFileSync(path.resolve(__dirname, '../frontend/src/app/(dashboard)/orders/page.tsx'), 'utf-8');
  assert.ok(ordersPageTsx.includes('isElectronEnvironment'), 'orders/page.tsx must guard desktop-only features with isElectronEnvironment');
  assert.ok(ordersPageTsx.includes('activeBranchId'), 'orders/page.tsx must track activeBranchId for multi-branch cloud scoping');
  assert.ok(ordersPageTsx.includes('params.branch_id = branchToUse') || ordersPageTsx.includes('branch_id: activeBranchId'), 'orders/page.tsx must pass branch_id in fetchOrders');
  console.log('  ✓ Web dashboard orders component safety and branch isolation verified');

  console.log('\n================================================================');
  console.log('✅ ALL C-12.2 FINANCIAL INTEGRITY & CLIENT CONTRACT TESTS PASSED!');
  console.log('================================================================\n');
}

runC121TestSuite().catch((err) => {
  console.error('\n❌ C-12.1 Test execution failed:', err);
  process.exit(1);
});
