import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';

type QueryRecord = { sql: string; params: unknown[] };

class SqliteD1 {
  constructor(readonly db: DatabaseSync) {}

  prepare(sql: string) {
    const record: QueryRecord = { sql: sql.replace(/\s+/g, ' ').trim(), params: [] };
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

const SECRET = 'catalog-admin-integration-secret-32-bytes-minimum';
const ORG = 'org-menu';
const NOW = new Date().toISOString();

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }

  for (const [orgId, orgName] of [[ORG, 'Menu Restaurant'], ['org-menu-other', 'Other Restaurant']] as const) {
    rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, ?, 'INR', 'IN', 'Asia/Kolkata', ?, ?)`)
      .run(orgId, orgName, NOW, NOW);
    rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES (?, ?, 'B1', 'Main', 1, 'active', ?, ?)`)
      .run(`${orgId}-branch`, orgId, NOW, NOW);
  }

  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insertUser.run('user-menu-owner', ORG, 'owner@menu.test', 'Menu Owner', 'owner', null, NOW, NOW);
  insertUser.run('user-menu-manager', ORG, 'manager@menu.test', 'Menu Manager', 'manager', `${ORG}-branch`, NOW, NOW);
  insertUser.run('user-menu-waiter', ORG, 'waiter@menu.test', 'Menu Waiter', 'server', `${ORG}-branch`, NOW, NOW);
  insertUser.run('user-menu-other', 'org-menu-other', 'other@menu.test', 'Other Owner', 'owner', null, NOW, NOW);

  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-menu-owner', ORG, 'user-menu-owner', null, 'owner', NOW, NOW);
  insertMembership.run('m-menu-manager', ORG, 'user-menu-manager', `${ORG}-branch`, 'manager', NOW, NOW);
  insertMembership.run('m-menu-waiter', ORG, 'user-menu-waiter', `${ORG}-branch`, 'server', NOW, NOW);
  insertMembership.run('m-menu-other', 'org-menu-other', 'user-menu-other', null, 'owner', NOW, NOW);

  rawDb.prepare(`INSERT INTO master_addon_groups (id, organization_id, name, is_required, min_selection, max_selection, sort_order, is_active, created_at, updated_at) VALUES ('group-1', ?, 'Toppings', 0, 0, 2, 1, 1, ?, ?)`)
    .run(ORG, NOW, NOW);
  rawDb.prepare(`INSERT INTO master_addons (id, organization_id, addon_group_id, name, price, is_active, sort_order, created_at, updated_at) VALUES ('addon-1', ?, 'group-1', 'Extra cheese', 25, 1, 1, ?, ?)`)
    .run(ORG, NOW, NOW);
  rawDb.prepare(`INSERT INTO master_categories (id, organization_id, name, sort_order, is_active, created_at, updated_at) VALUES ('cat-other', 'org-menu-other', 'Other Mains', 1, 1, ?, ?)`)
    .run(NOW, NOW);
  rawDb.prepare(`INSERT INTO master_products (id, organization_id, category_id, name, base_price, tax_rate, is_active, version, created_at, updated_at) VALUES ('product-other', 'org-menu-other', 'cat-other', 'Other Dish', 999, 5, 1, 1, ?, ?)`)
    .run(NOW, NOW);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const db = new SqliteD1(rawDb);
  const env = { DB: db, JWT_SECRET: SECRET, ENVIRONMENT: 'test' } as any;

  const tokens = new Map<string, string>();
  for (const [userId, role, orgId] of [
    ['user-menu-owner', 'owner', ORG],
    ['user-menu-manager', 'manager', ORG],
    ['user-menu-waiter', 'server', ORG],
    ['user-menu-other', 'owner', 'org-menu-other'],
  ] as const) {
    tokens.set(userId, await createJWT({
      sub: userId, org: orgId, email: `${userId}@menu.test`, role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, SECRET));
  }

  const call = async (userId: string, pathname: string, init: RequestInit = {}) => cloudWorker.fetch(
    new Request(`https://cloud.test${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.get(userId)}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    }),
    env,
  );

  // ── Categories ──────────────────────────────────────────────────────────
  const empty = await call('user-menu-owner', '/api/categories');
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json() as any).categories, []);

  const createdCategory = await call('user-menu-owner', '/api/categories', {
    method: 'POST', body: JSON.stringify({ name: 'Mains', description: 'Main courses', color: 'orange' }),
  });
  assert.equal(createdCategory.status, 201);
  const category = (await createdCategory.json() as any).category;
  assert.equal(category.slug, 'mains');
  assert.equal(category.color, 'orange');

  const duplicateCategory = await call('user-menu-owner', '/api/categories', {
    method: 'POST', body: JSON.stringify({ name: 'mains' }),
  });
  assert.equal(duplicateCategory.status, 409);

  const waiterCategory = await call('user-menu-waiter', '/api/categories', {
    method: 'POST', body: JSON.stringify({ name: 'Waiter Specials' }),
  });
  assert.equal(waiterCategory.status, 403, 'waiters cannot change the menu');

  // ── Product create + mapping ────────────────────────────────────────────
  const createdProduct = await call('user-menu-manager', '/api/products', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Paneer Tikka', category_id: category.id, price: 199.5, cost_price: 70,
      sku: 'PT-1', barcode: '890000000001', sale_unit: 'each', description: 'Charred paneer',
      tax_category_id: null, tax_behavior: 'inclusive', track_inventory: true,
      stock_quantity: 12, low_stock_threshold: 4, tags: ['veg', 'bestseller'],
      addon_group_ids: ['group-1'],
    }),
  });
  assert.equal(createdProduct.status, 201, JSON.stringify(await createdProduct.clone().json()));
  const productId = (await createdProduct.json() as any).id;

  const productList = await call('user-menu-waiter', '/api/products');
  assert.equal(productList.status, 200, 'staff can read the menu');
  const products = (await productList.json() as any).products;
  assert.equal(products.length, 1);
  const product = products[0];
  assert.equal(product.price, 199.5, 'price is exposed in the desktop contract');
  assert.equal(product.base_price, undefined);
  assert.equal(product.is_active, true);
  assert.deepEqual(product.tags, ['veg', 'bestseller']);
  assert.equal(product.track_inventory, true);
  assert.equal(product.stock_quantity, 12);
  assert.equal(product.addon_groups.length, 1);
  assert.equal(product.addon_groups[0].name, 'Toppings');
  assert.equal(product.addon_groups[0].addons[0].name, 'Extra cheese');

  const crossTenantUpdate = await call('user-menu-owner', '/api/products/product-other', {
    method: 'PUT', body: JSON.stringify({ name: 'Hijacked' }),
  });
  assert.equal(crossTenantUpdate.status, 404, 'another tenant cannot edit this product');

  const crossTenantCategory = await call('user-menu-owner', '/api/products', {
    method: 'POST', body: JSON.stringify({ name: 'Bad Category Product', category_id: 'cat-other', price: 10 }),
  });
  assert.equal(crossTenantCategory.status, 400, 'a product cannot reference another tenant category');

  const badAddonGroup = await call('user-menu-owner', '/api/products', {
    method: 'POST', body: JSON.stringify({ name: 'Bad Addons', price: 10, addon_group_ids: ['missing-group'] }),
  });
  assert.equal(badAddonGroup.status, 400);

  // ── Update ──────────────────────────────────────────────────────────────
  const updated = await call('user-menu-manager', `/api/products/${productId}`, {
    method: 'PUT', body: JSON.stringify({ price: 249.25, is_active: false }),
  });
  assert.equal(updated.status, 200);
  const updatedList = (await (await call('user-menu-owner', '/api/products')).json() as any).products;
  assert.equal(updatedList[0].price, 249.25);
  assert.equal(updatedList[0].is_active, false, 'inactive products stay listed for reactivation');
  assert.equal(updatedList[0].name, 'Paneer Tikka', 'a partial update preserves other fields');

  // ── Category deletion rules ─────────────────────────────────────────────
  const blockedDelete = await call('user-menu-owner', `/api/categories/${category.id}`, { method: 'DELETE' });
  assert.equal(blockedDelete.status, 400);
  assert.equal((await blockedDelete.json() as any).productCount, 1);

  const secondCategory = await call('user-menu-owner', '/api/categories', {
    method: 'POST', body: JSON.stringify({ name: 'Chef Specials' }),
  });
  const secondId = (await secondCategory.json() as any).category.id;

  const reassigned = await call('user-menu-owner', `/api/categories/${category.id}?action=reassign&reassign_to=${secondId}`, { method: 'DELETE' });
  assert.equal(reassigned.status, 200);
  const movedProduct = rawDb.prepare('SELECT category_id FROM master_products WHERE id = ?').get(productId) as any;
  assert.equal(movedProduct.category_id, secondId);

  const forceDelete = await call('user-menu-owner', `/api/categories/${secondId}?action=delete_all`, { method: 'DELETE' });
  assert.equal(forceDelete.status, 200);
  assert.equal(rawDb.prepare('SELECT COUNT(*) AS count FROM master_products WHERE id = ?').get(productId).count, 0);
  assert.equal(rawDb.prepare('SELECT COUNT(*) AS count FROM master_categories WHERE organization_id = ?').get(ORG).count, 0);

  // ── Product delete ──────────────────────────────────────────────────────
  const otherProductDelete = await call('user-menu-other', '/api/products/product-other', { method: 'DELETE' });
  assert.equal(otherProductDelete.status, 200, 'the other tenant can delete its own product');
  assert.equal(rawDb.prepare("SELECT COUNT(*) AS count FROM master_products WHERE id = 'product-other'").get().count, 0);

  console.log('Cloud menu management passed: category CRUD, product parity, addon links, tenant isolation, and delete rules.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
