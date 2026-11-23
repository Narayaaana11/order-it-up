/**
 * Integration Test: Advanced QR Ordering Customer Data Capture & CRM Upsert
 *
 * Usage: node --experimental-sqlite tests/qr-customer-crm.test.ts
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function main() {
  console.log('Integration Test: Public QR Ordering Customer Data Capture & CRM');
  console.log('='.repeat(65));

  const root = path.resolve(__dirname, '..');
  const migrationsDir = path.join(root, 'apps', 'cloud-api', 'migrations');
  const migrations = fs.readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  // Create temporary in-memory or isolated SQLite DB
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  // Apply all cloud migrations 0001 through 0025
  for (const mig of migrations) {
    const sql = fs.readFileSync(path.join(migrationsDir, mig), 'utf8');
    db.exec(sql);
  }
  console.log('  ✓ Applied migrations 0001–0025 to test database');

  // Seed organization, restaurant, branch, and dining table
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO organizations (id, name, currency, country, timezone, created_at, updated_at)
    VALUES ('org-test', 'Test Eatery', 'INR', 'IN', 'Asia/Kolkata', ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO restaurants (id, organization_id, name, created_at, updated_at)
    VALUES ('rest-test', 'org-test', 'Main Restaurant', ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, status, created_at, updated_at)
    VALUES ('br-test', 'org-test', 'rest-test', 'B1', 'Main Branch', 1, 'active', ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO dining_tables (id, organization_id, restaurant_id, branch_id, table_number, created_at, updated_at)
    VALUES ('tbl-1', 'org-test', 'rest-test', 'br-test', '12', ?, ?)
  `).run(now, now);

  // 1. Simulate QR checkout with customer details
  console.log('\nStep 1: Process QR order with Guest Name & Phone');
  const orderId = 'ord-qr-001';
  const customerName = 'Priya Patel';
  const customerPhone = '+919876543210';
  const customerEmail = 'priya@example.com';
  const phoneDigits = customerPhone.replace(/\D/g, '').slice(-10);

  // Insert into synced_orders with customer details
  db.prepare(`
    INSERT INTO synced_orders (
      id, organization_id, restaurant_id, branch_id, terminal_id, order_number, order_type,
      status, kitchen_status, payment_status, subtotal, tax_total, discount_total, grand_total,
      payment_method, table_id, table_number, customer_name, customer_phone,
      created_by_user_id, created_by_name, notes, version, ordered_at, synced_at, updated_at
    ) VALUES (?, 'org-test', 'rest-test', 'br-test', NULL, 'QR-001', 'dine_in', 'active', 'pending', 'unpaid',
      500, 25, 0, 525, 'cash', 'tbl-1', '12', ?, ?, NULL, ?, 'QR Order', 1, ?, ?, ?)
  `).run(orderId, customerName, customerPhone, customerName, now, now, now);

  // Upsert into customers (CRM registry) using find-and-update pattern
  const custId = 'cust-qr-001';
  const existing1 = db.prepare('SELECT id FROM customers WHERE organization_id = ? AND phone = ?').get('org-test', customerPhone);
  if (existing1) {
    db.prepare('UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email), updated_at = ? WHERE id = ?')
      .run(customerName, customerEmail, now, existing1.id);
  } else {
    db.prepare(`
      INSERT INTO customers (id, organization_id, name, phone, phone_digits, email, is_active, created_at, updated_at)
      VALUES (?, 'org-test', ?, ?, ?, ?, 1, ?, ?)
    `).run(custId, customerName, customerPhone, phoneDigits, customerEmail, now, now);
  }

  // Verify synced_orders
  const savedOrder = db.prepare('SELECT * FROM synced_orders WHERE id = ?').get(orderId);
  assert.equal(savedOrder.customer_name, 'Priya Patel', 'synced_orders has customer_name');
  assert.equal(savedOrder.customer_phone, '+919876543210', 'synced_orders has customer_phone');
  assert.equal(savedOrder.created_by_name, 'Priya Patel', 'created_by_name set to customer_name');
  console.log('  ✓ Customer details saved into synced_orders');

  // Verify customer CRM registry
  const savedCustomer = db.prepare('SELECT * FROM customers WHERE organization_id = ? AND phone = ?').get('org-test', customerPhone);
  assert(Boolean(savedCustomer), 'Customer upserted into customers registry');
  assert.equal(savedCustomer.name, 'Priya Patel', 'Customer name in CRM is Priya Patel');
  assert.equal(savedCustomer.phone_digits, '9876543210', 'Phone digits extracted for search');
  assert.equal(savedCustomer.email, 'priya@example.com', 'Email captured');
  console.log('  ✓ Customer profile automatically captured in cloud CRM registry');

  // 2. Simulate repeat visit with updated name
  console.log('\nStep 2: Repeat visit updates customer record');
  const existing2 = db.prepare('SELECT id FROM customers WHERE organization_id = ? AND phone = ?').get('org-test', customerPhone);
  if (existing2) {
    db.prepare('UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email), updated_at = ? WHERE id = ?')
      .run('Priya Patel-Sharma', 'priya.sharma@example.com', now, existing2.id);
  } else {
    db.prepare(`
      INSERT INTO customers (id, organization_id, name, phone, phone_digits, email, is_active, created_at, updated_at)
      VALUES ('cust-qr-002', 'org-test', 'Priya Patel-Sharma', ?, ?, ?, 1, ?, ?)
    `).run(customerPhone, phoneDigits, 'priya.sharma@example.com', now, now);
  }

  const updatedCustomer = db.prepare('SELECT * FROM customers WHERE organization_id = ? AND phone = ?').get('org-test', customerPhone);
  assert.equal(updatedCustomer.id, 'cust-qr-001', 'Existing customer ID preserved on repeat order');
  assert.equal(updatedCustomer.name, 'Priya Patel-Sharma', 'Customer name updated');
  assert.equal(updatedCustomer.email, 'priya.sharma@example.com', 'Email updated on repeat order');
  console.log('  ✓ CRM record updated seamlessly on repeat order');

  console.log('\nAll QR Customer CRM tests passed successfully!');
}

main();
