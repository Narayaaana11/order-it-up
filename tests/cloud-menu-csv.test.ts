import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';

class SqliteD1 {
  constructor(readonly db: DatabaseSync) {}
  prepare(sql: string) {
    const record: { sql: string; params: unknown[] } = { sql: sql.replace(/\s+/g, ' ').trim(), params: [] };
    const statement: any = {
      bind: (...params: unknown[]) => { record.params = params; return statement; },
      first: async () => this.db.prepare(record.sql).get(...record.params) || null,
      all: async () => ({ results: this.db.prepare(record.sql).all(...record.params) }),
      run: async () => {
        const result = this.db.prepare(record.sql).run(...record.params);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
    return statement;
  }
  async batch(statements: any[]) {
    const results: any[] = [];
    this.db.exec('BEGIN');
    try { for (const statement of statements) results.push(await statement.run()); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return results;
  }
}

const SECRET = 'menu-csv-integration-secret-32-bytes-minimum';
const ORG = 'org-csv';
const NOW = new Date().toISOString();

function seed(rawDb: DatabaseSync) {
  const migrations = path.resolve(__dirname, '../apps/cloud-api/migrations');
  for (const migration of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    rawDb.exec(fs.readFileSync(path.join(migrations, migration), 'utf8'));
  }
  rawDb.prepare(`INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at) VALUES (?, 'CSV Restaurant', 'INR', 'IN', 'Asia/Kolkata', ?, ?)`).run(ORG, NOW, NOW);
  rawDb.prepare(`INSERT INTO branches (id, organization_id, code, name, is_main_branch, status, created_at, updated_at) VALUES ('branch-csv', ?, 'B1', 'Main', 1, 'active', ?, ?)`).run(ORG, NOW, NOW);
  const insertUser = rawDb.prepare(`INSERT INTO cloud_users (id, organization_id, email, name, role, assigned_branch_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`);
  insertUser.run('user-csv-owner', ORG, 'owner@csv.test', 'CSV Owner', 'owner', null, NOW, NOW);
  insertUser.run('user-csv-waiter', ORG, 'waiter@csv.test', 'CSV Waiter', 'server', 'branch-csv', NOW, NOW);
  const insertMembership = rawDb.prepare(`INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)`);
  insertMembership.run('m-csv-owner', ORG, 'user-csv-owner', null, 'owner', NOW, NOW);
  insertMembership.run('m-csv-waiter', ORG, 'user-csv-waiter', 'branch-csv', 'server', NOW, NOW);
}

async function run() {
  const rawDb = new DatabaseSync(':memory:');
  seed(rawDb);
  const env = { DB: new SqliteD1(rawDb), JWT_SECRET: SECRET, ENVIRONMENT: 'test' } as any;
  const tokens = new Map<string, string>();
  for (const [userId, role] of [['user-csv-owner', 'owner'], ['user-csv-waiter', 'server']] as const) {
    tokens.set(userId, await createJWT({ sub: userId, org: ORG, email: `${userId}@csv.test`, role, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET));
  }
  const call = (userId: string, pathname: string, init: RequestInit = {}) => cloudWorker.fetch(
    new Request(`https://cloud.test${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${tokens.get(userId)}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    }), env,
  );
  const importCsv = (type: string, csv: string) => call('user-csv-owner', `/api/menu-csv/import/${type}`, { method: 'POST', body: JSON.stringify({ csv }) });

  const template = await call('user-csv-owner', '/api/menu-csv/template/categories');
  assert.equal(template.status, 200);
  assert.match(template.headers.get('content-type') || '', /text\/csv/);
  assert.match(await template.text(), /^name,description,color,icon,sort_order/);

  const forbidden = await call('user-csv-waiter', '/api/menu-csv/template/products');
  assert.equal(forbidden.status, 403, 'waiters cannot export the menu');

  const categories = await importCsv('categories', 'name,description,color,icon,sort_order\nBeverages,"Hot, cold",blue,,1\nFood,Meals,green,,2\nBeverages,Updated drinks,red,,3');
  assert.equal(categories.status, 200);
  const categoryResult = await categories.json() as any;
  assert.equal(categoryResult.created, 2);
  assert.equal(categoryResult.updated, 1, 'a repeated category name updates instead of duplicating');
  assert.equal(rawDb.prepare('SELECT COUNT(*) AS count FROM master_categories WHERE organization_id = ?').get(ORG).count, 2);

  const products = await importCsv('products', 'id,sku,name,category,price,description,cost,tax_category,tax_behavior,cashback_percent,tags,is_active\n,,Cappuccino,Beverages,150,Rich espresso,50,,,,"veg,bestseller",yes\n,,Bad Row,Missing,10,,0,,,,no\n,,Negative,MISSING,-5,,,,,,yes');
  assert.equal(products.status, 200);
  const productResult = await products.json() as any;
  assert.equal(productResult.created, 1, 'valid rows import');
  assert.equal(productResult.skipped, 2, 'missing category and negative price are reported, not written');
  assert.equal(productResult.errors.length, 2);

  const beverageId = (rawDb.prepare("SELECT id FROM master_categories WHERE organization_id = ? AND name = 'Beverages'").get(ORG) as any).id;
  const productRow = rawDb.prepare('SELECT * FROM master_products WHERE organization_id = ?').get(ORG) as any;
  assert.equal(productRow.category_id, beverageId);
  assert.equal(Number(productRow.base_price), 150);
  assert.equal(Number(productRow.cost_price), 50);
  assert.equal(productRow.tags_json, JSON.stringify(['veg', 'bestseller']));
  assert.equal(Number(productRow.is_active), 1);

  const addons = await importCsv('addons', 'group_name,addon_name,price,group_required,group_min_select,group_max_select\nSize,Regular,20,yes,1,1\nSize,Large,40,yes,1,1\nExtras,Extra Shot,30,no,0,3');
  assert.equal(addons.status, 200);
  const addonResult = await addons.json() as any;
  assert.equal(addonResult.groups_created, 2);
  assert.equal(addonResult.addons_created, 3);
  assert.equal(rawDb.prepare('SELECT COUNT(*) AS count FROM master_addons WHERE organization_id = ?').get(ORG).count, 3);

  const exportProducts = await call('user-csv-owner', '/api/menu-csv/export/products');
  assert.equal(exportProducts.status, 200);
  const exported = await exportProducts.text();
  assert.match(exported, /^id,sku,name,category,price/);
  assert.ok(exported.includes('Cappuccino'));
  assert.ok(exported.includes('Beverages'));
  assert.ok(exported.includes('"veg,bestseller"'));

  const smallFile = await call('user-csv-owner', '/api/menu-csv/import/products', { method: 'POST', body: JSON.stringify({ csv: '' }) });
  assert.equal(smallFile.status, 400, 'an empty CSV is rejected');

  console.log('Cloud menu CSV passed: templates, exports, category/product/modifier imports, row validation, and role denial.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
