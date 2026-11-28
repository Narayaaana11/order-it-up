import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { handleGetInvoice, handleListInvoices } from '../apps/cloud-api/src/routes/invoices';

class InvoiceTestD1 {
  private db = new Database(':memory:');

  constructor() {
    this.db.pragma('foreign_keys = ON');
    const migrationDir = path.resolve(__dirname, '../apps/cloud-api/migrations');
    const migrations = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
    for (const m of migrations) {
      this.db.exec(fs.readFileSync(path.join(migrationDir, m), 'utf8'));
    }
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO organizations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('org-1', 'Spice Route Bistro', now, now);
    this.db.prepare(`
      INSERT INTO saas_subscription_payment_orders (
        id, organization_id, plan_code, billing_cycle, amount_minor, currency,
        provider, provider_order_id, provider_payment_id, receipt, idempotency_key_hash,
        status, expires_at, captured_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'INR', 'razorpay', ?, ?, ?, ?, 'captured', ?, ?, ?, ?)
    `).run(
      'po-1', 'org-1', 'pro', 'monthly', 149900,
      'order_test123', 'pay_test123', 'sub_po1', 'hash_po1',
      now, now, now, now,
    );
  }

  prepare(sql: string) {
    let params: any[] = [];
    const db = this.db;
    return {
      bind(...args: any[]) {
        params = args;
        return this;
      },
      async first<T = any>(): Promise<T | null> {
        return (db.prepare(sql).get(...params) as T | undefined) ?? null;
      },
      async all<T = any>(): Promise<{ results: T[] }> {
        return { results: db.prepare(sql).all(...params) as T[] };
      },
      async run() {
        const info = db.prepare(sql).run(...params);
        return { meta: { changes: info.changes } };
      },
    };
  }
}

async function run(): Promise<void> {
  const db = new InvoiceTestD1();
  const env = { DB: db } as any;
  const ownerMembership = [{
    id: 'm-1', user_id: 'u-1', organization_id: 'org-1',
    restaurant_id: null, branch_id: null, role: 'owner', status: 'active',
  }] as any;
  const cashierMembership = [{
    id: 'm-2', user_id: 'u-2', organization_id: 'org-1',
    restaurant_id: null, branch_id: null, role: 'cashier', status: 'active',
  }] as any;

  // 1. Non-owner is rejected
  const denied = await handleListInvoices(
    new Request('https://api.example.com/api/subscription/invoices'),
    env,
    'org-1',
    cashierMembership,
  );
  assert.equal(denied.status, 403);

  // 2. Owner sees captured order in invoice list even before first download
  const listRes = await handleListInvoices(
    new Request('https://api.example.com/api/subscription/invoices'),
    env,
    'org-1',
    ownerMembership,
  );
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json() as any;
  assert.equal(listJson.total, 1);
  assert.equal(listJson.invoices[0].payment_order_id, 'po-1');
  assert.equal(listJson.invoices[0].total_amount_minor, 149900);

  // 3. Downloading invoice generates GST-compliant HTML (18% GST extracted from ₹1,499)
  const invRes = await handleGetInvoice(
    new Request('https://api.example.com/api/subscription/invoices/po-1'),
    env,
    'org-1',
    ownerMembership,
    'po-1',
  );
  assert.equal(invRes.status, 200);
  assert.ok(invRes.headers.get('content-disposition')?.includes('OIU-INV-'));
  const html = await invRes.text();
  assert.ok(html.includes('Tax Invoice'), 'Should contain Tax Invoice badge');
  assert.ok(html.includes('Spice Route Bistro'), 'Should contain buyer org name');
  assert.ok(html.includes('IGST (18%)'), 'Default unregistered buyer should use IGST');
  assert.ok(html.includes('1,499.00'), 'Should include total ₹1,499.00');
  assert.ok(html.includes('1,270.34'), 'Should include extracted base ₹1,270.34');

  // 4. Subsequent list returns persisted invoice number
  const listRes2 = await handleListInvoices(
    new Request('https://api.example.com/api/subscription/invoices'),
    env,
    'org-1',
    ownerMembership,
  );
  const listJson2 = await listRes2.json() as any;
  assert.match(listJson2.invoices[0].invoice_number, /^OIU-INV-\d{4}-000001$/);

  console.log('gst-invoice-generation.test.ts PASSED');
}

void run();
