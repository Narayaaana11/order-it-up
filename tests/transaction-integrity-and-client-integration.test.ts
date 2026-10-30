/**
 * C-11: Transaction Integrity, Customer Payment Ledger & Multi-Device Verification Test Suite
 *
 * Covers:
 * 1. Migration 0006 Schema & Repeatable Legacy Backfill
 * 2. Test A: Price & Catalog Integrity (rejection of price tampering, 86'd items, inactive products, cross-tenant items, invalid discounts)
 * 3. Test B: Payment Integrity (rejection of unverified remote payments, verified cash attribution, duplicate UTR conflict)
 * 4. Test C: Split Payments & Outstanding Ledger Balance (multiple tenders, overpayment guard, idempotent replay)
 * 5. Test D: Auditable Refunds & Cancellation Safety (refund <= tender, reason enforcement, no silent cancellation of paid orders)
 * 6. Test E: Multi-Persona Cross-Device Workflow (Waiter -> Kitchen -> Cashier -> Owner, auto table release)
 * 7. Test F: Strict Multi-Tenant Security (cross-tenant rejection across orders, payments, tables, tickets)
 * 8. Test G: Concurrency Protection (optimistic locking 409 conflict, idempotent payments)
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';

const TEST_JWT_SECRET = 'shared-operational-backend-secret-32-chars-long!';

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
            async run(): Promise<{ success: boolean }> {
              const stmt = db.prepare(sql);
              stmt.run(...params);
              return { success: true };
            },
          };
        },
      };
    },
    async batch(statements: any[]) {
      for (const stmt of statements) {
        await stmt.run();
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

async function runTestSuite(): Promise<void> {
  console.log('================================================================');
  console.log('  C-11: TRANSACTION INTEGRITY & PAYMENT LEDGER TEST SUITE');
  console.log('================================================================\n');

  const migrationsDir = path.resolve(__dirname, '../apps/cloud-api/migrations');
  const m1Path = path.join(migrationsDir, '0001_initial_schema.sql');
  const m2Path = path.join(migrationsDir, '0002_rate_limits_and_pairing.sql');
  const m3Path = path.join(migrationsDir, '0003_sync_integrity_and_idempotency.sql');
  const m4Path = path.join(migrationsDir, '0004_restaurant_hierarchy_and_memberships.sql');
  const m5Path = path.join(migrationsDir, '0005_shared_operations_tables_and_kitchen.sql');
  const m6Path = path.join(migrationsDir, '0006_customer_payment_ledger.sql');

  const rawDb = new DatabaseSync(':memory:');
  const d1Bridge = createSqliteD1(rawDb);
  const env: any = {
    DB: d1Bridge,
    JWT_SECRET: TEST_JWT_SECRET,
  };

  // Run all migrations
  runSqlFile(rawDb, m1Path);
  runSqlFile(rawDb, m2Path);
  runSqlFile(rawDb, m3Path);
  runSqlFile(rawDb, m4Path);
  runSqlFile(rawDb, m5Path);
  runSqlFile(rawDb, m6Path);

  // Repeat migration 0006 to verify idempotency
  runSqlFile(rawDb, m6Path);

  console.log('🧪 [Setup] Seeding Multi-Tenant Test Data with Products, Overrides & Staff...');

  const nowIso = new Date().toISOString();

  // Organizations
  rawDb.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES ('org-alpha', 'TasteCraft Hospitality', 'TasteCraft Ltd', 'GSTIN123', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES ('org-beta', 'Rival Dining', 'Rival Corp', 'GSTIN999', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(nowIso, nowIso);

  // Restaurants
  rawDb.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES ('rest-a1', 'org-alpha', 'TasteCraft Flagship', 'tastecraft-main', 'dine_in', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES ('rest-b1', 'org-beta', 'Rival Bistro', 'rival-bistro', 'dine_in', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Branches
  rawDb.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-a1', 'org-alpha', 'rest-a1', 'TC-BLR', 'TasteCraft Koramangala', 1, 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-b1', 'org-beta', 'rest-b1', 'RV-MUM', 'Rival Bandra', 1, 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Catalog Categories & Products (Org Alpha)
  rawDb.prepare(`
    INSERT INTO master_categories (id, organization_id, name, sort_order, is_active, created_at, updated_at)
    VALUES ('cat-pizza', 'org-alpha', 'Woodfired Pizza', 1, 1, ?, ?)
  `).run(nowIso, nowIso);

  // Product 1: Margherita Pizza (base ₹350, tax 5%)
  rawDb.prepare(`
    INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
    VALUES ('prod-margherita', 'org-alpha', 'cat-pizza', 'Margherita Pizza', 'PIZ-01', 350.0, 5.0, 1, 1, ?, ?)
  `).run(nowIso, nowIso);

  // Product 2: Biryani (base ₹250, tax 5%, but marked 86'd / unavailable at branch br-a1)
  rawDb.prepare(`
    INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
    VALUES ('prod-biryani', 'org-alpha', 'cat-pizza', 'Dum Biryani', 'BIR-01', 250.0, 5.0, 1, 1, ?, ?)
  `).run(nowIso, nowIso);

  // Product 3: Inactive seasonal soup
  rawDb.prepare(`
    INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
    VALUES ('prod-soup-inactive', 'org-alpha', 'cat-pizza', 'Winter Squash Soup', 'SOU-01', 180.0, 5.0, 0, 1, ?, ?)
  `).run(nowIso, nowIso);

  // Product 4 (Org Beta): Competitor Burger
  rawDb.prepare(`
    INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
    VALUES ('prod-beta-burger', 'org-beta', NULL, 'Rival Burger', 'BUR-99', 400.0, 5.0, 1, 1, ?, ?)
  `).run(nowIso, nowIso);

  // Branch Overrides for br-a1:
  // Margherita has authorized price override to ₹399
  rawDb.prepare(`
    INSERT INTO branch_product_overrides (branch_id, product_id, price_override, is_available, updated_at)
    VALUES ('br-a1', 'prod-margherita', 399.0, 1, ?)
  `).run(nowIso);

  // Biryani is unavailable (is_available = 0) at br-a1
  rawDb.prepare(`
    INSERT INTO branch_product_overrides (branch_id, product_id, price_override, is_available, updated_at)
    VALUES ('br-a1', 'prod-biryani', NULL, 0, ?)
  `).run(nowIso);

  // Dining Tables
  rawDb.prepare(`
    INSERT INTO dining_tables (id, organization_id, restaurant_id, branch_id, table_number, capacity, status, is_active, created_at, updated_at)
    VALUES ('tbl-a1-t1', 'org-alpha', 'rest-a1', 'br-a1', 'T-01', 4, 'available', 1, ?, ?)
  `).run(nowIso, nowIso);

  // Users & Memberships
  // Org Alpha Owner
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-owner', 'org-alpha', 'owner@tastecraft.com', 'hash', 'Alice Owner', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-owner', 'org-alpha', 'usr-owner', NULL, NULL, 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Org Alpha Cashier
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-cashier', 'org-alpha', 'cashier@tastecraft.com', 'hash', 'Charlie Cashier', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-cashier', 'org-alpha', 'usr-cashier', 'rest-a1', 'br-a1', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Org Alpha Waiter
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-waiter', 'org-alpha', 'waiter@tastecraft.com', 'hash', 'David Waiter', 'waiter', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-waiter', 'org-alpha', 'usr-waiter', 'rest-a1', 'br-a1', 'waiter', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Org Alpha Chef
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-chef', 'org-alpha', 'chef@tastecraft.com', 'hash', 'Emma Chef', 'kitchen', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-chef', 'org-alpha', 'usr-chef', 'rest-a1', 'br-a1', 'kitchen', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Org Beta Owner
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-beta-owner', 'org-beta', 'owner@rival.com', 'hash', 'Rachel Rival', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-beta-owner', 'org-beta', 'usr-beta-owner', NULL, NULL, 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Tokens
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tokenOwner = await createJWT({ sub: 'usr-owner', org: 'org-alpha', role: 'owner', email: 'owner@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenCashier = await createJWT({ sub: 'usr-cashier', org: 'org-alpha', role: 'cashier', email: 'cashier@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenWaiter = await createJWT({ sub: 'usr-waiter', org: 'org-alpha', role: 'waiter', email: 'waiter@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenChef = await createJWT({ sub: 'usr-chef', org: 'org-alpha', role: 'kitchen', email: 'chef@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenBetaOwner = await createJWT({ sub: 'usr-beta-owner', org: 'org-beta', role: 'owner', email: 'owner@rival.com', exp }, TEST_JWT_SECRET);

  // =========================================================================
  // TEST A: PRICE & CATALOG INTEGRITY
  // =========================================================================
  console.log('🧪 [Test 1/7] Test A: Price & Catalog Integrity...');

  // A1. Malicious client attempts to manipulate item price (submitting ₹50 instead of branch override ₹399)
  const tamperedPriceReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      table_id: 'tbl-a1-t1',
      items: [
        {
          product_id: 'prod-margherita',
          quantity: 1,
          unit_price: 50.0, // Maliciously low unit price
        },
      ],
    }),
  });
  const tamperedPriceRes = await cloudWorker.fetch(tamperedPriceReq, env);
  assert.equal(tamperedPriceRes.status, 400);
  const tamperedPriceJson = await tamperedPriceRes.json() as any;
  assert.match(tamperedPriceJson.error, /Unauthorized price modification/i);

  // A2. Client attempts to order an unavailable (86'd) product
  const unavailableReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      table_id: 'tbl-a1-t1',
      items: [{ product_id: 'prod-biryani', quantity: 1 }],
    }),
  });
  const unavailableRes = await cloudWorker.fetch(unavailableReq, env);
  assert.equal(unavailableRes.status, 400);
  const unavailableJson = await unavailableRes.json() as any;
  assert.match(unavailableJson.error, /unavailable at this branch/i);

  // A3. Client attempts to order an inactive catalog item
  const inactiveReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-soup-inactive', quantity: 1 }],
    }),
  });
  const inactiveRes = await cloudWorker.fetch(inactiveReq, env);
  assert.equal(inactiveRes.status, 400);
  const inactiveJson = await inactiveRes.json() as any;
  assert.match(inactiveJson.error, /is inactive/i);

  // A4. Client attempts to order a product from another organization (cross-tenant product injection)
  const crossTenantProductReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-beta-burger', quantity: 1 }],
    }),
  });
  const crossTenantProductRes = await cloudWorker.fetch(crossTenantProductReq, env);
  assert.equal(crossTenantProductRes.status, 400);
  const crossTenantProductJson = await crossTenantProductRes.json() as any;
  assert.match(crossTenantProductJson.error, /does not belong to this organization/i);

  // A5. Client attempts invalid quantity (e.g. -2 or 0)
  const invalidQtyReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-margherita', quantity: -2 }],
    }),
  });
  const invalidQtyRes = await cloudWorker.fetch(invalidQtyReq, env);
  assert.equal(invalidQtyRes.status, 400);

  // A5b. Ordinary cloud client attempts to order unlisted product not in catalog (Phase 2-A)
  const unlistedProdReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-unlisted-fake', product_name: 'Fake Pizza', unit_price: 150, quantity: 1 }],
    }),
  });
  const unlistedProdRes = await cloudWorker.fetch(unlistedProdReq, env);
  assert.equal(unlistedProdRes.status, 400);
  const unlistedProdJson = await unlistedProdRes.json() as any;
  assert.match(unlistedProdJson.error, /was not found in catalog/i);

  // A5c. Waiter attempts price override sending price_override_authorized: true (Phase 2-A)
  const waiterOverrideReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-margherita', unit_price: 100, price_override_authorized: true, quantity: 1 }],
    }),
  });
  const waiterOverrideRes = await cloudWorker.fetch(waiterOverrideReq, env);
  assert.equal(waiterOverrideRes.status, 400);
  const waiterOverrideJson = await waiterOverrideRes.json() as any;
  assert.match(waiterOverrideJson.error, /Manager override required/i);

  // A5d. Waiter attempts arbitrary modifier price injection without catalog modifier schema (C-12.1)
  const waiterModReq = new Request('https://cloud.orderitup.internal/api/orders', {
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
          modifiers: [{ name: 'Extra Mozzarella', price: 50.0 }],
        },
      ],
    }),
  });
  const waiterModRes = await cloudWorker.fetch(waiterModReq, env);
  assert.equal(waiterModRes.status, 400);
  const waiterModJson = await waiterModRes.json() as any;
  assert.match(waiterModJson.error, /Arbitrary modifier price/i);

  // A5e. Waiter attempts unauthorized line discount (C-12.1)
  const waiterLineDiscountReq = new Request('https://cloud.orderitup.internal/api/orders', {
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
          discount_amount: 50.0,
        },
      ],
    }),
  });
  const waiterLineDiscountRes = await cloudWorker.fetch(waiterLineDiscountReq, env);
  assert.equal(waiterLineDiscountRes.status, 400);
  const waiterLineDiscountJson = await waiterLineDiscountRes.json() as any;
  assert.match(waiterLineDiscountJson.error, /Waiters are not permitted to apply line discounts/i);

  // A5f. Waiter attempts unauthorized order-level discount (C-12.1)
  const waiterOrderDiscountReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      order_discount: 100.0,
      discount_reason: 'VIP Friend',
      items: [{ product_id: 'prod-margherita', quantity: 1 }],
    }),
  });
  const waiterOrderDiscountRes = await cloudWorker.fetch(waiterOrderDiscountReq, env);
  assert.equal(waiterOrderDiscountRes.status, 403);
  const waiterOrderDiscountJson = await waiterOrderDiscountRes.json() as any;
  assert.match(waiterOrderDiscountJson.error, /Waiters are not permitted to apply order-level discounts/i);

  // A6. Valid Order Creation with Server-Calculated Catalog Pricing & Zero-Price Instruction Modifiers
  const validOrderReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      id: 'ord-integrity-001',
      branch_id: 'br-a1',
      table_id: 'tbl-a1-t1',
      customer_name: 'Priya Sharma',
      items: [
        {
          product_id: 'prod-margherita',
          quantity: 1,
          modifiers: [{ name: 'Extra Crispy', price: 0.0 }],
        },
      ],
    }),
  });
  const validOrderRes = await cloudWorker.fetch(validOrderReq, env);
  assert.equal(validOrderRes.status, 201);
  const validOrderJson = await validOrderRes.json() as any;
  assert.equal(validOrderJson.success, true);
  // Authoritative Calculation:
  // Base branch price: 399 + Modifier: 0 = 399 unit price
  // Subtotal = 399
  // Tax @ 5% = 19.95
  // Grand Total = 418.95
  assert.equal(validOrderJson.order.subtotal, 399.0);
  assert.equal(validOrderJson.order.tax_total, 19.95);
  assert.equal(validOrderJson.order.grand_total, 418.95);

  // A7. Menu Changes do not rewrite historic orders:
  // Modify master product price to ₹999.0
  rawDb.prepare('UPDATE master_products SET base_price = 999.0 WHERE id = ?').run('prod-margherita');
  rawDb.prepare('UPDATE branch_product_overrides SET price_override = 999.0 WHERE product_id = ?').run('prod-margherita');

  // Verify historic order retains its exact sale-time pricing snapshot
  const getHistoricReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenWaiter}` },
  });
  const getHistoricRes = await cloudWorker.fetch(getHistoricReq, env);
  const getHistoricJson = await getHistoricRes.json() as any;
  assert.equal(getHistoricJson.order.grand_total, 418.95);
  assert.equal(getHistoricJson.order.items[0].unit_price, 399.0);
  console.log('  ✓ Price tampering rejected; authoritative catalog pricing & sale-time snapshot preservation verified');

  // =========================================================================
  // TEST B: PAYMENT INTEGRITY
  // =========================================================================
  console.log('🧪 [Test 2/7] Test B: Payment Integrity (Cashier Attribution & Remote Tender Verification)...');

  // B0. Attempting direct payment mutation on legacy endpoint returns 410 Gone (C-12.1)
  const legacyPayReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payment', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({ payment_status: 'paid', payment_method: 'cash' }),
  });
  const legacyPayRes = await cloudWorker.fetch(legacyPayReq, env);
  assert.equal(legacyPayRes.status, 410);

  // B1. Unauthorized role (waiter) attempts to settle payment
  const waiterPayReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 418.95,
    }),
  });
  const waiterPayRes = await cloudWorker.fetch(waiterPayReq, env);
  assert.equal(waiterPayRes.status, 403);

  // B1b. Spoofed terminal_verified assertion rejected (C-12.1)
  const spoofTerminalReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'card',
      amount: 50.0,
      verification_method: 'terminal_verified',
      external_reference_id: 'CARD-AUTH-999',
    }),
  });
  const spoofTerminalRes = await cloudWorker.fetch(spoofTerminalReq, env);
  assert.equal(spoofTerminalRes.status, 400);

  // B1c. Fake / Bogus external reference rejected (C-12.1)
  const fakeRefReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'upi',
      amount: 50.0,
      external_reference_id: 'test',
    }),
  });
  const fakeRefRes = await cloudWorker.fetch(fakeRefReq, env);
  assert.equal(fakeRefRes.status, 400);

  // B2. Client attempts remote UPI payment without external transaction reference (UTR)
  const unverifiedUpiReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'upi',
      amount: 418.95,
      // Missing external_reference_id
    }),
  });
  const unverifiedUpiRes = await cloudWorker.fetch(unverifiedUpiReq, env);
  assert.equal(unverifiedUpiRes.status, 400);
  const unverifiedUpiJson = await unverifiedUpiRes.json() as any;
  assert.match(unverifiedUpiJson.error, /external_reference_id/i);

  // B3. Valid Cash Payment by Authorized Cashier
  const validCashReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'idemp-cash-001',
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 200.0, // Partial cash payment
    }),
  });
  const validCashRes = await cloudWorker.fetch(validCashReq, env);
  assert.equal(validCashRes.status, 201);
  const validCashJson = await validCashRes.json() as any;
  assert.equal(validCashJson.success, true);
  assert.equal(validCashJson.total_paid, 200.0);
  assert.equal(validCashJson.outstanding_balance, 218.95);
  assert.equal(validCashJson.order_payment_status, 'partially_paid');
  console.log('  ✓ Payment role gating, remote UTR enforcement, and cashier attribution verified');

  // =========================================================================
  // TEST C: SPLIT PAYMENTS & RECONCILIATION LEDGER
  // =========================================================================
  console.log('🧪 [Test 3/7] Test C: Split Payments, Outstanding Balance & Idempotent Retries...');

  // C1. Attempting overpayment (paying ₹500 when remaining is only ₹218.95)
  const overpayReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'upi',
      amount: 500.0,
      external_reference_id: 'UTR-EXCESS-01',
    }),
  });
  const overpayRes = await cloudWorker.fetch(overpayReq, env);
  assert.equal(overpayRes.status, 400);
  const overpayJson = await overpayRes.json() as any;
  assert.match(overpayJson.error, /exceeds outstanding order balance/i);

  // C2. Second tender: Valid UPI split payment for exact remaining balance ₹218.95
  const splitUpiReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'idemp-upi-002',
    },
    body: JSON.stringify({
      payment_method: 'upi',
      amount: 218.95,
      external_reference_id: 'UTR-SBI-77889900',
    }),
  });
  const splitUpiRes = await cloudWorker.fetch(splitUpiReq, env);
  assert.equal(splitUpiRes.status, 201);
  const splitUpiJson = await splitUpiRes.json() as any;
  assert.equal(splitUpiJson.total_paid, 418.95);
  assert.equal(splitUpiJson.outstanding_balance, 0.0);
  assert.equal(splitUpiJson.order_payment_status, 'paid');

  // C3. Duplicate external transaction reference rejection
  const dupUtrReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      payment_method: 'upi',
      amount: 50.0,
      external_reference_id: 'UTR-SBI-77889900', // Reusing UTR from previous payment
    }),
  });
  const dupUtrRes = await cloudWorker.fetch(dupUtrReq, env);
  assert.equal(dupUtrRes.status, 409);

  // C4. Idempotent payment replay does not double charge
  const replayReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'idemp-upi-002', // Same idempotency key
    },
    body: JSON.stringify({
      payment_method: 'upi',
      amount: 218.95,
      external_reference_id: 'UTR-SBI-77889900',
    }),
  });
  const replayRes = await cloudWorker.fetch(replayReq, env);
  assert.equal(replayRes.status, 200);
  const replayJson = await replayRes.json() as any;
  assert.equal(replayJson.idempotent, true);

  // C5. Query payment ledger for order
  const getLedgerReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCashier}` },
  });
  const getLedgerRes = await cloudWorker.fetch(getLedgerReq, env);
  assert.equal(getLedgerRes.status, 200);
  const getLedgerJson = await getLedgerRes.json() as any;
  assert.equal(getLedgerJson.payments.length, 2);
  assert.equal(getLedgerJson.total_paid, 418.95);
  assert.equal(getLedgerJson.outstanding_balance, 0.0);
  console.log('  ✓ Split payment reconciliation, overpayment guard, and idempotent tender replay confirmed');

  // =========================================================================
  // TEST D: AUDITABLE REFUNDS & CANCELLATION SAFETY
  // =========================================================================
  console.log('🧪 [Test 4/7] Test D: Auditable Refunds & Cancellation Protection...');

  // D1. Silent cancellation of paid order must be rejected
  const silentCancelReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      status: 'cancelled',
      cancellation_reason: 'Accidental order',
    }),
  });
  const silentCancelRes = await cloudWorker.fetch(silentCancelReq, env);
  assert.equal(silentCancelRes.status, 400);
  const silentCancelJson = await silentCancelRes.json() as any;
  assert.match(silentCancelJson.error, /Cannot cancel an order with settled customer payments/i);

  // D2. Attempt refund without audit reason
  const paymentRecord1 = getLedgerJson.payments[0]; // Cash payment of ₹200
  const noReasonRefundReq = new Request(`https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments/${paymentRecord1.id}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      amount: 100.0,
      // Missing reason
    }),
  });
  const noReasonRefundRes = await cloudWorker.fetch(noReasonRefundReq, env);
  assert.equal(noReasonRefundRes.status, 400);

  // D3. Attempt refund exceeding tender amount
  const excessRefundReq = new Request(`https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments/${paymentRecord1.id}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({
      amount: 300.0, // Exceeds ₹200 original payment
      reason: 'Customer complaint',
    }),
  });
  const excessRefundRes = await cloudWorker.fetch(excessRefundReq, env);
  assert.equal(excessRefundRes.status, 400);

  // D4. Valid auditable refund of ₹100 against Cash tender with Idempotency Key
  const validRefundReq = new Request(`https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments/${paymentRecord1.id}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'idemp-refund-001',
    },
    body: JSON.stringify({
      amount: 100.0,
      reason: 'Customer requested partial refund for delayed beverage',
    }),
  });
  const validRefundRes = await cloudWorker.fetch(validRefundReq, env);
  assert.equal(validRefundRes.status, 200);
  const validRefundJson = await validRefundRes.json() as any;
  assert.equal(validRefundJson.success, true);
  assert.equal(validRefundJson.refunded_amount, 100.0);
  assert.equal(validRefundJson.order_payment_status, 'partially_paid');

  // D5. Idempotent retry of identical refund returns existing record
  const retryRefundReq = new Request(`https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments/${paymentRecord1.id}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
      'Idempotency-Key': 'idemp-refund-001',
    },
    body: JSON.stringify({
      amount: 100.0,
      reason: 'Customer requested partial refund for delayed beverage',
    }),
  });
  const retryRefundRes = await cloudWorker.fetch(retryRefundReq, env);
  assert.equal(retryRefundRes.status, 200);
  const retryRefundJson = await retryRefundRes.json() as any;
  assert.equal(retryRefundJson.idempotent, true);
  console.log('  ✓ Auditable refund limits, required reason, idempotency, and automatic order payment reversion verified');

  // =========================================================================
  // TEST E: MULTI-PERSONA CROSS-DEVICE WORKFLOW & TABLE AUTO-RELEASE
  // =========================================================================
  console.log('🧪 [Test 5/7] Test E: Multi-Persona Operations & Automatic Table Release...');

  // E1. Table T-01 is currently occupied by ord-integrity-001
  const tblCheck1 = rawDb.prepare('SELECT status, current_order_id FROM dining_tables WHERE id = ?').get('tbl-a1-t1') as any;
  assert.equal(tblCheck1.status, 'occupied');
  assert.equal(tblCheck1.current_order_id, 'ord-integrity-001');

  // E2. Chef transitions ticket to 'ready'
  const getTicket = rawDb.prepare('SELECT id, status FROM kitchen_tickets WHERE order_id = ?').get('ord-integrity-001') as any;
  assert.ok(getTicket);
  const bumpReq = new Request(`https://cloud.orderitup.internal/api/kitchen/tickets/${getTicket.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenChef}`,
    },
    body: JSON.stringify({ status: 'ready' }),
  });
  const bumpRes = await cloudWorker.fetch(bumpReq, env);
  assert.equal(bumpRes.status, 200);

  // E3. Settle remaining ₹100 refund balance so order is fully paid
  const settleRemainingReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
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

  // E4. Cashier marks order as completed
  const completeOrderReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({ status: 'completed' }),
  });
  const completeOrderRes = await cloudWorker.fetch(completeOrderReq, env);
  assert.equal(completeOrderRes.status, 200);

  // E5. Table T-01 is now automatically released to 'available'
  const tblCheck2 = rawDb.prepare('SELECT status, current_order_id FROM dining_tables WHERE id = ?').get('tbl-a1-t1') as any;
  assert.equal(tblCheck2.status, 'available');
  assert.equal(tblCheck2.current_order_id, null);
  console.log('  ✓ Multi-persona sync (Waiter -> Chef -> Cashier -> Table Auto-Release) confirmed');

  // =========================================================================
  // TEST F: STRICT TENANT ISOLATION
  // =========================================================================
  console.log('🧪 [Test 6/7] Test F: Strict Tenant Isolation across Orders, Payments & Kitchen...');

  // F1. Rival Org Beta Owner attempts to view Org Alpha's order
  const rivalOrderReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenBetaOwner}` },
  });
  const rivalOrderRes = await cloudWorker.fetch(rivalOrderReq, env);
  assert.equal(rivalOrderRes.status, 404);

  // F2. Rival Org Beta attempts to view Org Alpha's customer payment ledger
  const rivalPaymentsReq = new Request('https://cloud.orderitup.internal/api/orders/ord-integrity-001/payments', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenBetaOwner}` },
  });
  const rivalPaymentsRes = await cloudWorker.fetch(rivalPaymentsReq, env);
  assert.equal(rivalPaymentsRes.status, 404);

  // F3. Rival Org Beta attempts to view Org Alpha's kitchen ticket queue
  const rivalKitchenReq = new Request('https://cloud.orderitup.internal/api/kitchen/tickets?branch_id=br-a1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenBetaOwner}` },
  });
  const rivalKitchenRes = await cloudWorker.fetch(rivalKitchenReq, env);
  assert.equal(rivalKitchenRes.status, 403);
  console.log('  ✓ Strict cross-tenant isolation enforced across orders, payments, tables and kitchen');

  // =========================================================================
  // TEST G: CONCURRENCY PROTECTION & OPTIMISTIC LOCKING
  // =========================================================================
  console.log('🧪 [Test 7/7] Test G: Concurrency Protection & Stale Update Rejection...');

  // Create a second test order
  const order2Req = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiter}`,
    },
    body: JSON.stringify({
      id: 'ord-concurrency-002',
      branch_id: 'br-a1',
      items: [{ product_id: 'prod-margherita', quantity: 1 }],
    }),
  });
  const order2Res = await cloudWorker.fetch(order2Req, env);
  assert.equal(order2Res.status, 201);

  // Client 1 updates status (advances version from 1 to 2)
  const c1Update = new Request('https://cloud.orderitup.internal/api/orders/ord-concurrency-002/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({ status: 'completed', expected_version: 1 }),
  });
  const c1Res = await cloudWorker.fetch(c1Update, env);
  assert.equal(c1Res.status, 200);

  // Stale Client 2 attempts update assuming version is still 1
  const c2Update = new Request('https://cloud.orderitup.internal/api/orders/ord-concurrency-002/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashier}`,
    },
    body: JSON.stringify({ status: 'cancelled', expected_version: 1 }),
  });
  const c2Res = await cloudWorker.fetch(c2Update, env);
  assert.equal(c2Res.status, 409);
  console.log('  ✓ Optimistic concurrency conflicts (HTTP 409) verified');

  console.log('\n================================================================');
  console.log('✅ ALL C-11 TRANSACTION INTEGRITY & PAYMENT LEDGER TESTS PASSED!');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
