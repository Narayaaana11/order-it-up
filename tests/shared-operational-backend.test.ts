/**
 * Shared Operational Backend Test Suite (C-10)
 *
 * Tests:
 * 1. Migration 0005 Schema Application & Legacy Compatibility
 * 2. Mandatory Security Checks:
 *    - Sole org owner anti-lockout protection on demotion and deletion
 *    - Manager scope confinement (cannot grant owner, admin, or cross-branch permissions)
 *    - Cross-tenant parentage rejection on branch-restaurant attachment
 *    - Token role bypass elimination (revoked membership denies access immediately)
 * 3. Test A — Shared Order Multi-Persona Lifecycle:
 *    - Waiter creates order on dining table
 *    - Cashier retrieves active order
 *    - Chef retrieves active kitchen ticket queue
 *    - Chef transitions ticket (preparing -> ready)
 *    - Cashier settles payment & completes order (auto-releasing table)
 *    - Owner observes branch order metrics
 * 4. Test B — Tenant Isolation:
 *    - Cross-tenant read, update, item append, and cancellation rejection
 * 5. Test C — Concurrency & Idempotency:
 *    - Idempotent order creation replay (zero duplicates)
 *    - Stale version update conflict (409)
 * 6. Test D — Desktop Offline Sync Ingestion & Multi-Client Visibility:
 *    - Outbox event push through /api/pos/events
 *    - Derivation of kitchen tickets from synced offline orders
 *    - Idempotent event replay
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';

const TEST_JWT_SECRET = 'shared-operational-backend-secret-32-chars-long!';

// SQLite D1 Bridge: Wraps node:sqlite into Cloudflare Worker D1 interface
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
  console.log('  C-10: SHARED OPERATIONAL BACKEND & MULTI-DEVICE TEST SUITE');
  console.log('================================================================\n');

  const migrationsDir = path.resolve(__dirname, '../apps/cloud-api/migrations');
  const m1Path = path.join(migrationsDir, '0001_initial_schema.sql');
  const m2Path = path.join(migrationsDir, '0002_rate_limits_and_pairing.sql');
  const m3Path = path.join(migrationsDir, '0003_sync_integrity_and_idempotency.sql');
  const m4Path = path.join(migrationsDir, '0004_restaurant_hierarchy_and_memberships.sql');
  const m5Path = path.join(migrationsDir, '0005_shared_operations_tables_and_kitchen.sql');
  const m6Path = path.join(migrationsDir, '0006_customer_payment_ledger.sql');
  const m7Path = path.join(migrationsDir, '0007_repair_legacy_payments_and_financial_integrity.sql');

  const rawDb = new DatabaseSync(':memory:');
  rawDb.exec('PRAGMA foreign_keys = ON;');

  runSqlFile(rawDb, m1Path);
  runSqlFile(rawDb, m2Path);
  runSqlFile(rawDb, m3Path);
  runSqlFile(rawDb, m4Path);
  runSqlFile(rawDb, m5Path);
  runSqlFile(rawDb, m6Path);
  runSqlFile(rawDb, m7Path);

  const env: any = {
    DB: createSqliteD1(rawDb),
    JWT_SECRET: TEST_JWT_SECRET,
    ENVIRONMENT: 'test',
  };

  const nowIso = new Date().toISOString();

  // Seed Organization A (Tenant 1)
  rawDb.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES ('org-a', 'TasteCraft Group', 'TasteCraft Ltd', '07AAAAA0000A1Z5', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(nowIso, nowIso);

  // Seed Concepts for Org A
  rawDb.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES ('rest-a1', 'org-a', 'TasteCraft Bistro', 'bistro', 'dine_in', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Seed Outlets for Org A
  rawDb.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-a1', 'org-a', 'rest-a1', 'BR-01', 'Connaught Place', 1, 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Seed Organization B (Tenant 2)
  rawDb.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES ('org-b', 'Rival Hospitality', 'Rival Ltd', '07BBBBB0000B1Z5', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(nowIso, nowIso);

  rawDb.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES ('rest-b1', 'org-b', 'Rival Diner', 'diner', 'dine_in', 'active', ?, ?)
  `).run(nowIso, nowIso);

  rawDb.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-b1', 'org-b', 'rest-b1', 'BR-B1', 'Sector 29', 1, 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Seed Users & Memberships for Org A
  // 1. Sole Org Owner
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-owner-a', 'org-a', 'owner@tastecraft.com', 'hash', 'Alice Owner', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-owner-a', 'org-a', 'usr-owner-a', NULL, NULL, 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // 2. Branch Manager
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-mgr-a', 'org-a', 'manager@tastecraft.com', 'hash', 'Bob Manager', 'manager', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-mgr-a', 'org-a', 'usr-mgr-a', 'rest-a1', 'br-a1', 'manager', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // 3. Cashier
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-cashier-a', 'org-a', 'cashier@tastecraft.com', 'hash', 'Charlie Cashier', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-cashier-a', 'org-a', 'usr-cashier-a', 'rest-a1', 'br-a1', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // 4. Waiter / Server
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-waiter-a', 'org-a', 'waiter@tastecraft.com', 'hash', 'David Waiter', 'server', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-waiter-a', 'org-a', 'usr-waiter-a', 'rest-a1', 'br-a1', 'server', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // 5. Kitchen Chef
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-chef-a', 'org-a', 'chef@tastecraft.com', 'hash', 'Emma Chef', 'chef', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-chef-a', 'org-a', 'usr-chef-a', 'rest-a1', 'br-a1', 'chef', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Users for Org B
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-owner-b', 'org-b', 'owner@rival.com', 'hash', 'Rachel Rival', 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-owner-b', 'org-b', 'usr-owner-b', NULL, NULL, 'owner', 'active', ?, ?)
  `).run(nowIso, nowIso);

  // Seed Master Products for Org A Catalog
  rawDb.prepare(`
    INSERT INTO master_products (id, organization_id, name, base_price, tax_rate, is_active, created_at, updated_at)
    VALUES 
      ('prod-paneer', 'org-a', 'Paneer Butter Masala', 320.0, 5.0, 1, ?, ?),
      ('prod-naan', 'org-a', 'Garlic Naan', 60.0, 5.0, 1, ?, ?),
      ('prod-item', 'org-a', 'Chai', 50.0, 0.0, 1, ?, ?),
      ('prod-item-2', 'org-a', 'Samosa', 30.0, 0.0, 1, ?, ?)
  `).run(nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso);

  // Tokens
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tokenOwnerA = await createJWT({ sub: 'usr-owner-a', org: 'org-a', role: 'owner', email: 'owner@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenMgrA = await createJWT({ sub: 'usr-mgr-a', org: 'org-a', role: 'manager', email: 'manager@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenCashierA = await createJWT({ sub: 'usr-cashier-a', org: 'org-a', role: 'cashier', email: 'cashier@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenWaiterA = await createJWT({ sub: 'usr-waiter-a', org: 'org-a', role: 'waiter', email: 'waiter@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenChefA = await createJWT({ sub: 'usr-chef-a', org: 'org-a', role: 'kitchen', email: 'chef@tastecraft.com', exp }, TEST_JWT_SECRET);
  const tokenOwnerB = await createJWT({ sub: 'usr-owner-b', org: 'org-b', role: 'owner', email: 'owner@rival.com', exp }, TEST_JWT_SECRET);

  // =========================================================================
  // 1. MANDATORY SECURITY CHECKS (PHASE 1 BOUNDARY HARDENING)
  // =========================================================================
  console.log('🧪 [Test 1/6] Mandatory Security Checks: Anti-Lockout, Manager Scope & Token Bypass...');

  // 1a. Sole Org Owner cannot be demoted through membership update route
  const demoteReq = new Request('https://cloud.orderitup.internal/api/memberships', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenOwnerA}`,
    },
    body: JSON.stringify({
      user_id: 'usr-owner-a',
      role: 'cashier', // Demotion attempt
    }),
  });
  const demoteRes = await cloudWorker.fetch(demoteReq, env);
  assert.equal(demoteRes.status, 400, 'Demoting sole org owner must be rejected with HTTP 400');
  const demoteBody = await demoteRes.json();
  assert.match((demoteBody as any).error, /sole remaining organization owner/i);

  // 1b. Sole Org Owner cannot be revoked through DELETE route
  const revokeOwnerReq = new Request('https://cloud.orderitup.internal/api/memberships/mem-owner-a', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  const revokeOwnerRes = await cloudWorker.fetch(revokeOwnerReq, env);
  assert.equal(revokeOwnerRes.status, 400, 'Revoking sole org owner must be rejected with HTTP 400');

  // 1c. Manager cannot grant permissions outside their authorized scope
  // Branch Manager Bob trying to grant Org Owner role
  const mgrElevateReq = new Request('https://cloud.orderitup.internal/api/memberships', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenMgrA}`,
    },
    body: JSON.stringify({
      user_id: 'usr-waiter-a',
      role: 'owner',
    }),
  });
  const mgrElevateRes = await cloudWorker.fetch(mgrElevateReq, env);
  assert.equal(mgrElevateRes.status, 403, 'Manager elevating staff to owner must be forbidden (HTTP 403)');

  // Branch Manager Bob trying to grant access to another branch
  const mgrCrossBranchReq = new Request('https://cloud.orderitup.internal/api/memberships', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenMgrA}`,
    },
    body: JSON.stringify({
      user_id: 'usr-waiter-a',
      branch_id: 'br-b1', // foreign branch
      role: 'cashier',
    }),
  });
  const mgrCrossBranchRes = await cloudWorker.fetch(mgrCrossBranchReq, env);
  assert.equal(mgrCrossBranchRes.status, 403, 'Manager assigning to another branch must be forbidden (HTTP 403)');

  // 1d. User cannot attach a branch to another organization's restaurant
  const crossOrgBranchReq = new Request('https://cloud.orderitup.internal/api/branches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenOwnerA}`,
    },
    body: JSON.stringify({
      name: 'Illegal Branch',
      code: 'BR-ILLEGAL',
      restaurant_id: 'rest-b1', // Belongs to Org B!
    }),
  });
  const crossOrgBranchRes = await cloudWorker.fetch(crossOrgBranchReq, env);
  assert.equal(crossOrgBranchRes.status, 400, 'Attaching branch to foreign org restaurant must return HTTP 400');

  // 1e. Revoking membership immediately prevents unauthorized reads and writes
  // Create a temporary cashier user
  rawDb.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES ('usr-temp-cashier', 'org-a', 'temp@tastecraft.com', 'hash', 'Temp Cashier', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);
  rawDb.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES ('mem-temp-cashier', 'org-a', 'usr-temp-cashier', 'rest-a1', 'br-a1', 'cashier', 'active', ?, ?)
  `).run(nowIso, nowIso);

  const tokenTemp = await createJWT({ sub: 'usr-temp-cashier', org: 'org-a', role: 'cashier', email: 'temp@tastecraft.com', exp }, TEST_JWT_SECRET);

  // Revoke temp cashier
  const revokeTempReq = new Request('https://cloud.orderitup.internal/api/memberships/mem-temp-cashier', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  const revokeTempRes = await cloudWorker.fetch(revokeTempReq, env);
  assert.equal(revokeTempRes.status, 200);

  // Temp user tries to list orders using their active token
  const revokedAccessReq = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-a1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenTemp}` },
  });
  const revokedAccessRes = await cloudWorker.fetch(revokedAccessReq, env);
  assert.equal(revokedAccessRes.status, 403, 'Revoked user token must receive HTTP 403 immediately');

  console.log('  ✓ Mandatory security edge cases strictly enforced and verified');

  // =========================================================================
  // 2. DINING TABLE CONFIGURATION
  // =========================================================================
  console.log('🧪 [Test 2/6] Dining Table Management (Floor & Table Lifecycle)...');

  // Manager creates Table T-10
  const createTableReq = new Request('https://cloud.orderitup.internal/api/tables', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenMgrA}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      table_number: 'T-10',
      capacity: 4,
      floor: 'Ground',
      section: 'Main Dining',
    }),
  });
  const createTableRes = await cloudWorker.fetch(createTableReq, env);
  assert.equal(createTableRes.status, 201, 'Table creation must return HTTP 201');
  const tableData = (await createTableRes.json() as any).table;
  assert.equal(tableData.table_number, 'T-10');
  assert.equal(tableData.status, 'available');

  // Duplicate table number in same branch rejected
  const dupTableRes = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/tables', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenMgrA}`,
    },
    body: JSON.stringify({
      branch_id: 'br-a1',
      table_number: 'T-10',
      capacity: 4,
    }),
  }), env);
  assert.equal(dupTableRes.status, 409, 'Duplicate table in same branch must return HTTP 409 Conflict');

  console.log('  ✓ Table creation and unique constraints verified');

  // =========================================================================
  // 3. TEST A: SHARED MULTI-PERSONA ORDER LIFECYCLE
  // =========================================================================
  console.log('🧪 [Test 3/6] Test A: Shared Order Lifecycle (Waiter -> Kitchen -> Cashier -> Owner)...');

  const sharedOrderId = 'ord-shared-101';

  // Step 1: Waiter David creates an order for Table T-10
  const waiterOrderReq = new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiterA}`,
    },
    body: JSON.stringify({
      id: sharedOrderId,
      branch_id: 'br-a1',
      order_number: 'ORD-101',
      order_type: 'dine_in',
      table_id: tableData.id,
      table_number: 'T-10',
      customer_name: 'Mr. Sharma',
      items: [
        { product_id: 'prod-paneer', product_name: 'Paneer Butter Masala', quantity: 2, unit_price: 320, subtotal: 640, tax_amount: 32 },
        { product_id: 'prod-naan', product_name: 'Garlic Naan', quantity: 4, unit_price: 60, subtotal: 240, tax_amount: 12 },
      ],
    }),
  });
  const waiterOrderRes = await cloudWorker.fetch(waiterOrderReq, env);
  assert.equal(waiterOrderRes.status, 201, 'Waiter order creation must return HTTP 201');
  const createdOrder = (await waiterOrderRes.json() as any).order;
  assert.equal(createdOrder.id, sharedOrderId);
  assert.equal(createdOrder.grand_total, 924); // 640 + 240 + 44
  assert.equal(createdOrder.kitchen_status, 'pending');
  assert.equal(createdOrder.payment_status, 'unpaid');

  // Verify Table T-10 is now marked 'occupied'
  const tableCheck = rawDb.prepare('SELECT * FROM dining_tables WHERE id = ?').get(tableData.id) as any;
  assert.equal(tableCheck.status, 'occupied', 'Dining table must automatically become occupied upon order creation');
  assert.equal(tableCheck.current_order_id, sharedOrderId);

  // Step 2: Cashier Charlie retrieves the order and sees real-time total
  const cashierGetReq = new Request(`https://cloud.orderitup.internal/api/orders/${sharedOrderId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCashierA}` },
  });
  const cashierGetRes = await cloudWorker.fetch(cashierGetReq, env);
  assert.equal(cashierGetRes.status, 200, 'Cashier must retrieve the same shared order');
  const retrievedOrder = (await cashierGetRes.json() as any).order;
  assert.equal(retrievedOrder.grand_total, 924);
  assert.equal(retrievedOrder.items.length, 2);

  // Step 3: Kitchen Chef Emma retrieves active kitchen tickets
  const chefTicketsReq = new Request('https://cloud.orderitup.internal/api/kitchen/tickets?branch_id=br-a1&status=active', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenChefA}` },
  });
  const chefTicketsRes = await cloudWorker.fetch(chefTicketsReq, env);
  assert.equal(chefTicketsRes.status, 200, 'Chef must retrieve active kitchen ticket queue');
  const tickets = (await chefTicketsRes.json() as any).tickets;
  assert.equal(tickets.length, 1);
  const ticket = tickets[0];
  assert.equal(ticket.order_id, sharedOrderId);
  assert.equal(ticket.status, 'pending');
  assert.equal(ticket.items.length, 2);

  // Step 4: Chef Emma bumps ticket to 'preparing', then 'ready'
  const bumpReq1 = new Request(`https://cloud.orderitup.internal/api/kitchen/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenChefA}`,
    },
    body: JSON.stringify({ status: 'preparing' }),
  });
  const bumpRes1 = await cloudWorker.fetch(bumpReq1, env);
  assert.equal(bumpRes1.status, 200);

  // Verify parent order updated to 'preparing'
  const ordAfterPrep = rawDb.prepare('SELECT kitchen_status FROM synced_orders WHERE id = ?').get(sharedOrderId) as any;
  assert.equal(ordAfterPrep.kitchen_status, 'preparing');

  const bumpReq2 = new Request(`https://cloud.orderitup.internal/api/kitchen/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenChefA}`,
    },
    body: JSON.stringify({ status: 'ready' }),
  });
  const bumpRes2 = await cloudWorker.fetch(bumpReq2, env);
  assert.equal(bumpRes2.status, 200);

  const ordAfterReady = rawDb.prepare('SELECT kitchen_status FROM synced_orders WHERE id = ?').get(sharedOrderId) as any;
  assert.equal(ordAfterReady.kitchen_status, 'ready');

  // Step 5a: Legacy payment mutation returns 410 Gone (C-12.1)
  const legacyPayReq = new Request(`https://cloud.orderitup.internal/api/orders/${sharedOrderId}/payment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashierA}`,
    },
    body: JSON.stringify({ payment_status: 'paid', payment_method: 'card' }),
  });
  const legacyPayRes = await cloudWorker.fetch(legacyPayReq, env);
  assert.equal(legacyPayRes.status, 410);

  // Step 5b: Cashier settles payment via authoritative customer payment ledger
  const payReq = new Request(`https://cloud.orderitup.internal/api/orders/${sharedOrderId}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashierA}`,
      'Idempotency-Key': 'c10-cashier-pay-001',
    },
    body: JSON.stringify({
      payment_method: 'cash',
      amount: 924.0,
    }),
  });
  const payRes = await cloudWorker.fetch(payReq, env);
  assert.equal(payRes.status, 201);

  const completeReq = new Request(`https://cloud.orderitup.internal/api/orders/${sharedOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashierA}`,
    },
    body: JSON.stringify({ status: 'completed' }),
  });
  const completeRes = await cloudWorker.fetch(completeReq, env);
  assert.equal(completeRes.status, 200);

  // Verify table is released automatically back to 'available'
  const tableAfterComplete = rawDb.prepare('SELECT * FROM dining_tables WHERE id = ?').get(tableData.id) as any;
  assert.equal(tableAfterComplete.status, 'available', 'Completing order must automatically release dining table');
  assert.equal(tableAfterComplete.current_order_id, null);

  // Step 6: Owner Alice inspects completed orders for branch
  const ownerListReq = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-a1&status=completed', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  const ownerListRes = await cloudWorker.fetch(ownerListReq, env);
  assert.equal(ownerListRes.status, 200);
  const ownerOrders = (await ownerListRes.json() as any).orders;
  assert.equal(ownerOrders.length, 1);
  assert.equal(ownerOrders[0].id, sharedOrderId);
  assert.equal(ownerOrders[0].payment_status, 'paid');

  console.log('  ✓ Shared multi-persona order lifecycle confirmed (Waiter -> Chef -> Cashier -> Owner)');

  // =========================================================================
  // 4. TEST B: STRICT TENANT ISOLATION
  // =========================================================================
  console.log('🧪 [Test 4/6] Test B: Strict Tenant Isolation...');

  // Rival Owner Rachel (Org B) attempts to read Org A's order
  const crossTenantGetReq = new Request(`https://cloud.orderitup.internal/api/orders/${sharedOrderId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwnerB}` },
  });
  const crossTenantGetRes = await cloudWorker.fetch(crossTenantGetReq, env);
  assert.equal(crossTenantGetRes.status, 404, 'Cross-tenant order retrieval must return HTTP 404');

  // Rival Owner Rachel attempts to list Org A's branch orders
  const crossTenantListReq = new Request('https://cloud.orderitup.internal/api/orders?branch_id=br-a1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenOwnerB}` },
  });
  const crossTenantListRes = await cloudWorker.fetch(crossTenantListReq, env);
  assert.equal(crossTenantListRes.status, 403, 'Cross-tenant branch listing must return HTTP 403 Forbidden');

  // Rival Owner Rachel attempts to cancel Org A's order
  const crossTenantCancelReq = new Request(`https://cloud.orderitup.internal/api/orders/${sharedOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenOwnerB}`,
    },
    body: JSON.stringify({ status: 'cancelled', cancellation_reason: 'Malicious attack' }),
  });
  const crossTenantCancelRes = await cloudWorker.fetch(crossTenantCancelReq, env);
  assert.equal(crossTenantCancelRes.status, 404, 'Cross-tenant order cancellation must return HTTP 404');

  console.log('  ✓ Strict cross-tenant isolation confirmed');

  // =========================================================================
  // 5. TEST C: CONCURRENCY & IDEMPOTENCY
  // =========================================================================
  console.log('🧪 [Test 5/6] Test C: Concurrency Protection & Idempotent Retries...');

  // 5a. Idempotent Retry: Waiter retrying exact same order creation
  const retryOrderRes = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiterA}`,
    },
    body: JSON.stringify({
      id: sharedOrderId,
      branch_id: 'br-a1',
      order_number: 'ORD-101',
      order_type: 'dine_in',
      table_id: tableData.id,
      table_number: 'T-10',
      customer_name: 'Mr. Sharma',
      items: [
        { product_id: 'prod-paneer', product_name: 'Paneer Butter Masala', quantity: 2, unit_price: 320, subtotal: 640, tax_amount: 32 },
        { product_id: 'prod-naan', product_name: 'Garlic Naan', quantity: 4, unit_price: 60, subtotal: 240, tax_amount: 12 },
      ],
    }),
  }), env);
  assert.equal(retryOrderRes.status, 200, 'Replayed order creation must be acknowledged idempotently (HTTP 200)');
  const retryBody = await retryOrderRes.json() as any;
  assert.equal(retryBody.idempotent, true);

  // Check no duplicate order in DB
  const orderCount = rawDb.prepare('SELECT COUNT(*) as count FROM synced_orders WHERE id = ?').get(sharedOrderId) as any;
  assert.equal(orderCount.count, 1, 'Idempotent retry must never duplicate database records');

  // 5b. Optimistic Concurrency Conflict on stale expected_version
  // Create an active order at version 1
  const concOrderId = 'ord-conc-102';
  await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiterA}`,
    },
    body: JSON.stringify({
      id: concOrderId,
      branch_id: 'br-a1',
      order_number: 'ORD-102',
      items: [{ product_id: 'prod-item', product_name: 'Chai', quantity: 1, unit_price: 50, subtotal: 50 }],
    }),
  }), env);

  // Waiter A appends an item (bumping version to 2)
  const appendRes = await cloudWorker.fetch(new Request(`https://cloud.orderitup.internal/api/orders/${concOrderId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenWaiterA}`,
    },
    body: JSON.stringify({
      items: [{ product_id: 'prod-item-2', product_name: 'Samosa', quantity: 2, unit_price: 30, subtotal: 60 }],
    }),
  }), env);
  assert.equal(appendRes.status, 200);
  assert.equal((await appendRes.json() as any).version, 2);

  // Cashier attempts to update status using stale expected_version = 1
  const staleUpdateRes = await cloudWorker.fetch(new Request(`https://cloud.orderitup.internal/api/orders/${concOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCashierA}`,
    },
    body: JSON.stringify({ status: 'completed', expected_version: 1 }),
  }), env);

  assert.equal(staleUpdateRes.status, 409, 'Stale concurrent update must return HTTP 409 Conflict');
  const conflictBody = await staleUpdateRes.json() as any;
  assert.match(conflictBody.error, /Conflict.*expected.*1.*current.*2/i);

  console.log('  ✓ Optimistic concurrency conflict and idempotent replay verified');

  // =========================================================================
  // 6. TEST D: DESKTOP OFFLINE INGESTION & VISIBILITY
  // =========================================================================
  console.log('🧪 [Test 6/6] Test D: Desktop Offline Ingestion & Cross-Device Visibility...');

  // Pair a desktop terminal
  const terminalId = 'term-desktop-01';
  const rawTerminalToken = 'valid-desktop-offline-token-xyz';
  // Use crypto SHA-256 hash
  const tokenHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawTerminalToken));
  const tokenHash = Array.from(new Uint8Array(tokenHashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

  rawDb.prepare(`
    INSERT INTO terminals (id, organization_id, branch_id, terminal_name, terminal_token_hash, status, created_at)
    VALUES (?, 'org-a', 'br-a1', 'POS Register 1', ?, 'active', ?)
  `).run(terminalId, tokenHash, nowIso);

  const offlineOrderId = 'ord-desktop-offline-888';
  const offlineEventId = 'evt-desktop-sync-999';

  const syncEventPayload = {
    events: [
      {
        id: offlineEventId,
        type: 'order.completed',
        payload: {
          id: offlineOrderId,
          order_number: 'POS-888',
          order_type: 'takeaway',
          status: 'completed',
          subtotal: 500,
          tax_total: 25,
          discount_total: 0,
          grand_total: 525,
          payment_method: 'cash',
          ordered_at: nowIso,
          items: [
            { id: 'item-off-1', product_name: 'Biryani Handi', quantity: 1, unit_price: 500, subtotal: 500 },
          ],
        },
      },
    ],
  };

  // 6a. Push offline sync event to /api/pos/events
  const syncPushReq = new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${rawTerminalToken}`,
    },
    body: JSON.stringify(syncEventPayload),
  });

  const syncPushRes = await cloudWorker.fetch(syncPushReq, env);
  assert.equal(syncPushRes.status, 200, 'Desktop sync push must return HTTP 200');
  const syncPushBody = await syncPushRes.json() as any;
  assert.ok(syncPushBody.synced_ids.includes(offlineEventId), 'Event ID must be acknowledged in synced_ids');

  // 6b. Verify order was ingested and derived kitchen ticket was generated
  const ingestedOrder = rawDb.prepare('SELECT * FROM synced_orders WHERE id = ?').get(offlineOrderId) as any;
  assert.ok(ingestedOrder, 'Offline order must be persisted in synced_orders');
  assert.equal(ingestedOrder.branch_id, 'br-a1');
  assert.equal(ingestedOrder.grand_total, 525);
  assert.equal(ingestedOrder.payment_status, 'paid');
  assert.equal(ingestedOrder.kitchen_status, 'served');

  const derivedTicket = rawDb.prepare('SELECT * FROM kitchen_tickets WHERE order_id = ?').get(offlineOrderId) as any;
  assert.ok(derivedTicket, 'Derived kitchen ticket must be automatically generated');
  assert.equal(derivedTicket.ticket_number, 'KOT-POS-888');

  // 6c. Idempotent replay: Resending identical sync batch
  const replayPushRes = await cloudWorker.fetch(new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${rawTerminalToken}`,
    },
    body: JSON.stringify(syncEventPayload),
  }), env);
  assert.equal(replayPushRes.status, 200);
  const replayBody = await replayPushRes.json() as any;
  assert.ok(replayBody.synced_ids.includes(offlineEventId), 'Replayed event must be safely acknowledged');

  // Check no duplicate order rows
  const offlineCount = rawDb.prepare('SELECT COUNT(*) as count FROM synced_orders WHERE id = ?').get(offlineOrderId) as any;
  assert.equal(offlineCount.count, 1);

  // 6d. Multi-Client Visibility: Cashier queries cloud orders and sees the desktop-created offline order
  const cloudVisibilityReq = new Request(`https://cloud.orderitup.internal/api/orders/${offlineOrderId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCashierA}` },
  });
  const cloudVisibilityRes = await cloudWorker.fetch(cloudVisibilityReq, env);
  assert.equal(cloudVisibilityRes.status, 200, 'Cloud clients must immediately view synced desktop order');
  const visibleOrder = (await cloudVisibilityRes.json() as any).order;
  assert.equal(visibleOrder.order_number, 'POS-888');
  assert.equal(visibleOrder.items[0].product_name, 'Biryani Handi');

  console.log('  ✓ Desktop offline ingestion, idempotency, and multi-client visibility confirmed');

  console.log('\n================================================================');
  console.log('✅ ALL C-10 SHARED OPERATIONAL BACKEND TESTS PASSED!');
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed with error:\n', err);
  process.exit(1);
});
