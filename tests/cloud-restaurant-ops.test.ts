import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';

type QueryRecord = { sql: string; params: unknown[] };

class SqliteD1 {
  queries: QueryRecord[] = [];
  constructor(readonly db: DatabaseSync) {}

  prepare(sql: string) {
    const record: QueryRecord = { sql: sql.replace(/\s+/g, ' ').trim(), params: [] };
    this.queries.push(record);
    const statement: any = {
      bind: (...params: unknown[]) => { record.params = params; return statement; },
      first: async () => this.db.prepare(record.sql).get(...record.params) || null,
      all: async () => ({ results: this.db.prepare(record.sql).all(...record.params) }),
      run: async () => {
        const result = this.db.prepare(record.sql).run(...record.params);
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
      },
    };
    return statement;
  }

  async batch(statements: any[]) {
    const results: any[] = [];
    this.db.exec('BEGIN');
    try {
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return results;
  }
}

const SECRET = 'restaurant-ops-integration-secret-32-bytes-minimum';
const ORG = 'org-ops';
const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }

  const now = new Date().toISOString();
  rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, 'Ops Restaurant', 'INR', 'IN', 'Asia/Kolkata', ?, ?)`)
    .run(ORG, now, now);
  rawDb.prepare(`INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at) VALUES ('rest-a', ?, 'Ops Diner', 'ops-diner', 'finedine', 'active', ?, ?)`)
    .run(ORG, now, now);
  const insertBranch = rawDb.prepare(`INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at) VALUES (?, ?, 'rest-a', ?, ?, ?, 'active', ?, ?)`);
  insertBranch.run(BRANCH_A, ORG, 'A', 'Main Branch', 1, now, now);
  insertBranch.run(BRANCH_B, ORG, 'B', 'Second Branch', 0, now, now);

  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insertUser.run('user-owner', ORG, 'owner@ops.test', 'Owner One', 'owner', null, now, now);
  insertUser.run('user-waiter', ORG, 'waiter@ops.test', 'Waiter One', 'server', BRANCH_A, now, now);
  insertUser.run('user-accountant', ORG, 'accountant@ops.test', 'Accountant One', 'accountant', null, now, now);
  insertUser.run('user-driver', ORG, 'driver@ops.test', 'Driver One', 'delivery', BRANCH_A, now, now);
  insertUser.run('user-manager-b', ORG, 'managerb@ops.test', 'Manager B', 'manager', BRANCH_B, now, now);

  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-owner', ORG, 'user-owner', null, null, 'owner', now, now);
  insertMembership.run('m-waiter', ORG, 'user-waiter', null, BRANCH_A, 'server', now, now);
  insertMembership.run('m-accountant', ORG, 'user-accountant', null, null, 'accountant', now, now);
  insertMembership.run('m-driver', ORG, 'user-driver', null, BRANCH_A, 'delivery', now, now);
  insertMembership.run('m-manager-b', ORG, 'user-manager-b', null, BRANCH_B, 'manager', now, now);

  rawDb.prepare(`INSERT INTO master_categories (id, organization_id, name, created_at, updated_at) VALUES ('cat-a', ?, 'Mains', ?, ?)`).run(ORG, now, now);
  rawDb.prepare(`INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, created_at, updated_at) VALUES ('product-a', ?, 'cat-a', 'Ops Burger', 'BURGER-1', 200, 5, 1, ?, ?)`)
    .run(ORG, now, now);

  rawDb.prepare(`INSERT INTO dining_tables (id, organization_id, restaurant_id, branch_id, table_number, capacity, status, is_active, created_at, updated_at) VALUES ('table-a1', ?, 'rest-a', ?, 'T-1', 4, 'available', 1, ?, ?)`)
    .run(ORG, BRANCH_A, now, now);

  rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES ('org-other', 'Other Tenant', 'INR', 'IN', 'Asia/Kolkata', ?, ?)`)
    .run(now, now);
  rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES ('branch-other', 'org-other', 'X', 'Other Branch', 1, 'active', ?, ?)`)
    .run(now, now);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const db = new SqliteD1(rawDb);
  const env = { DB: db, JWT_SECRET: SECRET, ENVIRONMENT: 'test' } as any;

  const tokens = new Map<string, string>();
  for (const [userId, role, branch] of [
    ['user-owner', 'owner', null],
    ['user-waiter', 'server', BRANCH_A],
    ['user-accountant', 'accountant', null],
    ['user-driver', 'delivery', BRANCH_A],
    ['user-manager-b', 'manager', BRANCH_B],
  ] as const) {
    tokens.set(userId, await createJWT({
      sub: userId, org: ORG, email: `${userId}@ops.test`, role, branch,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, SECRET));
  }

  const call = async (userId: string, pathname: string, init: RequestInit = {}) => {
    const token = tokens.get(userId);
    assert.ok(token, `missing token for ${userId}`);
    return cloudWorker.fetch(new Request(`https://cloud.test${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    }), env);
  };

  // ── Expenses, categories, vendors ────────────────────────────────────────
  const categoryResponse = await call('user-owner', '/api/expenses/categories', {
    method: 'POST', body: JSON.stringify({ name: 'Dairy', description: 'Milk and butter' }),
  });
  assert.equal(categoryResponse.status, 201);
  const category = (await categoryResponse.json() as any).category;

  const vendorResponse = await call('user-owner', '/api/vendors', {
    method: 'POST', body: JSON.stringify({ name: 'Amul Supply', phone: '5550100', gstin: '07AAAAA0000A1Z5' }),
  });
  assert.equal(vendorResponse.status, 201);
  const vendor = (await vendorResponse.json() as any).vendor;

  const expenseResponse = await call('user-waiter', '/api/expenses', {
    method: 'POST', body: JSON.stringify({ amount: 500, description: 'Milk delivery', category_id: category.id }),
  });
  assert.equal(expenseResponse.status, 403, 'waiters cannot record expenses');

  const createdExpense = await call('user-owner', '/api/expenses', {
    method: 'POST',
    body: JSON.stringify({
      amount: 1250.5, description: 'Weekly dairy delivery', category_id: category.id,
      vendor_id: vendor.id, payment_method: 'cash', expense_date: new Date().toISOString().slice(0, 10),
    }),
  });
  assert.equal(createdExpense.status, 201);
  const expense = (await createdExpense.json() as any).expense;
  assert.equal(expense.amount, 1250.5);

  const listExpenses = await call('user-accountant', '/api/expenses');
  assert.equal(listExpenses.status, 200);
  const expenseRows = (await listExpenses.json() as any).expenses;
  assert.equal(expenseRows.length, 1);
  assert.equal(expenseRows[0].category_name, 'Dairy');
  assert.equal(expenseRows[0].vendor_name, 'Amul Supply');

  const crossBranch = await call('user-waiter', `/api/expenses?branch_id=${BRANCH_B}`);
  assert.equal(crossBranch.status, 403, 'branch-scoped staff cannot read another branch');
  const managerB = await call('user-manager-b', `/api/expenses?branch_id=${BRANCH_A}`);
  assert.equal(managerB.status, 403, 'a manager of branch B cannot read branch A');

  const voided = await call('user-owner', `/api/expenses/${expense.id}`, {
    method: 'DELETE', body: JSON.stringify({ reason: 'Duplicate entry' }),
  });
  assert.equal(voided.status, 200);
  const afterVoid = (await (await call('user-owner', '/api/expenses')).json() as any).expenses;
  assert.equal(afterVoid.length, 0, 'voided expenses leave the active ledger');

  // ── Reservations ────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const reservationResponse = await call('user-waiter', '/api/reservations', {
    method: 'POST',
    body: JSON.stringify({
      table_id: 'table-a1', customer_name: 'Asha Rao', customer_phone: '5550111',
      guest_count: 4, reservation_date: today, reservation_time: '19:30',
    }),
  });
  assert.equal(reservationResponse.status, 201);
  const reservation = (await reservationResponse.json() as any).reservation;

  const overlapping = await call('user-waiter', '/api/reservations', {
    method: 'POST',
    body: JSON.stringify({
      table_id: 'table-a1', customer_name: 'Overlap Guest', guest_count: 2,
      reservation_date: today, reservation_time: '20:00',
    }),
  });
  assert.equal(overlapping.status, 409, 'overlapping table reservations are rejected');

  const tooMany = await call('user-waiter', '/api/reservations', {
    method: 'POST',
    body: JSON.stringify({ customer_name: 'Big Party', guest_count: 9, reservation_date: today, reservation_time: '21:00', table_id: 'table-a1' }),
  });
  assert.equal(tooMany.status, 400, 'guest_count cannot exceed table capacity');

  const seated = await call('user-waiter', `/api/reservations/${reservation.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'seated' }),
  });
  assert.equal(seated.status, 200);
  const occupiedTable = rawDb.prepare('SELECT status FROM dining_tables WHERE id = ?').get('table-a1') as any;
  assert.equal(occupiedTable.status, 'occupied', 'seating a reservation occupies the table');

  const invalidTransition = await call('user-waiter', `/api/reservations/${reservation.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'no_show' }),
  });
  assert.equal(invalidTransition.status, 409, 'a seated reservation cannot be marked no-show');

  const completed = await call('user-waiter', `/api/reservations/${reservation.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(completed.status, 200);
  const freedTable = rawDb.prepare('SELECT status FROM dining_tables WHERE id = ?').get('table-a1') as any;
  assert.equal(freedTable.status, 'available', 'completing the reservation releases the table');

  const reservationList = await call('user-owner', `/api/reservations?date=${today}`);
  assert.equal((await reservationList.json() as any).reservations.length, 1);

  // ── Inventory and recipes ───────────────────────────────────────────────
  const ingredientResponse = await call('user-owner', '/api/inventory/ingredients', {
    method: 'POST', body: JSON.stringify({ name: 'Paneer', unit: 'kg', current_stock: 10, minimum_stock: 4, cost_per_unit: 50 }),
  });
  assert.equal(ingredientResponse.status, 201);
  const ingredient = (await ingredientResponse.json() as any).ingredient;

  const guardedAdjust = await call('user-waiter', '/api/inventory/adjust', {
    method: 'POST', body: JSON.stringify({ ingredient_id: ingredient.id, adjustment_type: 'decrease', quantity: 1 }),
  });
  assert.equal(guardedAdjust.status, 403, 'waiters cannot adjust stock');

  const overDraw = await call('user-owner', '/api/inventory/adjust', {
    method: 'POST', body: JSON.stringify({ ingredient_id: ingredient.id, adjustment_type: 'decrease', quantity: 12 }),
  });
  assert.equal(overDraw.status, 400, 'stock cannot go negative');

  const adjusted = await call('user-owner', '/api/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify({
      ingredient_id: ingredient.id, adjustment_type: 'decrease', quantity: 4,
      reason: 'Kitchen prep', idempotency_key: 'adjust-prep-1',
    }),
  });
  assert.equal(adjusted.status, 200);
  assert.equal((await adjusted.json() as any).current_stock, 6);

  const replayed = await call('user-owner', '/api/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify({
      ingredient_id: ingredient.id, adjustment_type: 'decrease', quantity: 4,
      reason: 'Kitchen prep', idempotency_key: 'adjust-prep-1',
    }),
  });
  assert.equal(replayed.status, 200);
  assert.equal((await replayed.json() as any).idempotent, true, 'a retried adjustment is not applied twice');
  assert.equal((rawDb.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(ingredient.id) as any).current_stock, 6);

  const lowStockBefore = await call('user-owner', '/api/inventory/low-stock');
  assert.equal((await lowStockBefore.json() as any).low_stock.length, 0, 'stock above the threshold is not low');

  const updatedIngredient = await call('user-owner', `/api/inventory/ingredients/${ingredient.id}`, {
    method: 'PUT', body: JSON.stringify({ minimum_stock: 6, cost_per_unit: 55 }),
  });
  assert.equal(updatedIngredient.status, 200);

  const lowStock = await call('user-owner', '/api/inventory/low-stock');
  assert.equal((await lowStock.json() as any).low_stock.length, 1, 'stock at or below the threshold is low');

  const transactions = await call('user-owner', '/api/inventory/transactions?limit=50');
  const txRows = (await transactions.json() as any).transactions;
  assert.equal(txRows.length, 2, 'opening stock and the adjustment are both audited');
  assert.ok(txRows.some((row: any) => row.type === 'adjustment_decrease'));

  const recipe = await call('user-owner', '/api/inventory/recipes/product-a', {
    method: 'POST',
    body: JSON.stringify({ items: [{ ingredient_id: ingredient.id, quantity_required: 2, unit: 'kg', wastage_percentage: 10 }] }),
  });
  assert.equal(recipe.status, 200);
  const recipeData = await recipe.json() as any;
  assert.equal(recipeData.recipes.length, 1);
  assert.equal(recipeData.recipe_cogs, 121, 'recipe COGS includes wastage and the updated unit cost');

  const recipeForOtherTenant = await call('user-owner', '/api/inventory/recipes/product-missing');
  assert.equal(recipeForOtherTenant.status, 404);

  // ── Shift summary and cash closure ──────────────────────────────────────
  const now = new Date().toISOString();
  const insertPayment = rawDb.prepare(`INSERT INTO customer_payments (id, organization_id, branch_id, order_id, payment_method, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  rawDb.prepare(`INSERT INTO synced_orders (id, organization_id, branch_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, payment_method, ordered_at, synced_at, updated_at) VALUES ('order-shift', ?, ?, 'S-1', 'dine_in', 'completed', 200, 10, 0, 210, 'cash', ?, ?, ?)`)
    .run(ORG, BRANCH_A, now, now, now);
  insertPayment.run('pay-cash', ORG, BRANCH_A, 'order-shift', 'cash', 100, 'completed', now, now);
  insertPayment.run('pay-card', ORG, BRANCH_A, 'order-shift', 'card', 50, 'completed', now, now);
  insertPayment.run('pay-refund', ORG, BRANCH_A, 'order-shift', 'cash', -10, 'refunded', now, now);

  const summaryResponse = await call('user-owner', '/api/shifts/summary');
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json() as any).summary;
  assert.equal(summary.cash_sales, 90, 'cash refunds reduce cash sales');
  assert.equal(summary.card_sales, 50);
  assert.equal(summary.expected_cash, 90);

  const waiterClose = await call('user-waiter', '/api/shifts/close', {
    method: 'POST', body: JSON.stringify({ actual_cash: 90 }),
  });
  assert.equal(waiterClose.status, 403, 'waiters cannot close a shift');

  const closeResponse = await call('user-owner', '/api/shifts/close', {
    method: 'POST', body: JSON.stringify({ actual_cash: 88.5, opening_cash: 0, notes: 'Evening shift' }),
  });
  assert.equal(closeResponse.status, 201);
  const closure = (await closeResponse.json() as any).closure;
  assert.equal(closure.expected_cash, 90);
  assert.equal(closure.variance, -1.5, 'shortage is persisted as a negative variance');

  const afterClosure = (await (await call('user-owner', '/api/shifts/summary')).json() as any).summary;
  assert.equal(afterClosure.cash_sales, 0, 'a new shift window starts at the last closure');
  assert.equal(afterClosure.opening_cash, 88.5, 'the counted cash carries forward as the next opening float');

  const closures = (await (await call('user-owner', '/api/shifts/closures')).json() as any).closures;
  assert.equal(closures.length, 1);
  assert.equal(closures[0].closed_by, 'Owner One');

  // ── Delivery dispatch ───────────────────────────────────────────────────
  const orderResponse = await call('user-owner', '/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      id: 'order-delivery', branch_id: BRANCH_A, order_type: 'delivery',
      customer_name: 'Ravi Kumar', customer_phone: '5550199',
      items: [{ product_id: 'product-a', quantity: 1 }],
    }),
  });
  assert.equal(orderResponse.status, 201, JSON.stringify(await orderResponse.clone().json()));

  const jobResponse = await call('user-owner', '/api/delivery/jobs', {
    method: 'POST',
    body: JSON.stringify({ order_id: 'order-delivery', address: '12 Market Road', cod_amount: 50 }),
  });
  assert.equal(jobResponse.status, 201);
  const job = (await jobResponse.json() as any).job;

  const duplicateJob = await call('user-owner', '/api/delivery/jobs', {
    method: 'POST', body: JSON.stringify({ order_id: 'order-delivery', address: '12 Market Road' }),
  });
  assert.equal(duplicateJob.status, 200);
  assert.equal((await duplicateJob.json() as any).idempotent, true);

  const driverAssignAttempt = await call('user-driver', `/api/delivery/jobs/${job.id}/assign`, {
    method: 'PATCH', body: JSON.stringify({ driver_name: 'Driver One' }),
  });
  assert.equal(driverAssignAttempt.status, 403, 'drivers cannot assign themselves');

  const assigned = await call('user-owner', `/api/delivery/jobs/${job.id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ driver_name: 'Driver One', driver_phone: '5550198', driver_user_id: 'user-driver', eta_minutes: 25 }),
  });
  assert.equal(assigned.status, 200);

  const pickedUp = await call('user-driver', `/api/delivery/jobs/${job.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'picked_up' }),
  });
  assert.equal(pickedUp.status, 200, 'the assigned driver can move the job forward');

  const deliveredWithoutCod = await call('user-driver', `/api/delivery/jobs/${job.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'delivered' }),
  });
  assert.equal(deliveredWithoutCod.status, 400, 'cash-on-delivery requires an explicit collection confirmation');

  const delivered = await call('user-driver', `/api/delivery/jobs/${job.id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status: 'delivered', cod_collected: true }),
  });
  assert.equal(delivered.status, 200);
  assert.equal((rawDb.prepare('SELECT status, cod_collected FROM delivery_jobs WHERE id = ?').get(job.id) as any).cod_collected, 1);

  const jobs = (await (await call('user-owner', '/api/delivery/jobs')).json() as any).jobs;
  assert.equal(jobs.length, 1);
  assert.match(String(jobs[0].order_number), /^ORD-\d{6}$/);

  console.log('Cloud restaurant operations passed: expenses, reservations, inventory, recipes, shift closure, and delivery dispatch.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
