/**
 * Self-Service SaaS Registration & Onboarding Test Suite
 */

import assert from 'node:assert/strict';
import cloudWorker from '../apps/cloud-api/src/index';
import { verifyJWT } from '../apps/cloud-api/src/auth';

const TEST_JWT_SECRET = 'cloud-registration-test-secret-256bits-key-32chars!';

class MockD1RegistrationDB {
  public users = new Map<string, any>();
  public organizations = new Map<string, any>();
  public branches = new Map<string, any>();
  public categories = new Map<string, any>();
  public products = new Map<string, any>();
  public rateLimits = new Map<string, { count: number; reset_at: number; updated_at: string }>();

  prepare(sql: string) {
    const db = this;
    const normalized = sql.replace(/\s+/g, ' ').trim();

    return {
      bind(...params: any[]) {
        return {
          async first<T = any>(): Promise<T | null> {
            // Check existing user by email
            if (normalized.includes('SELECT id FROM cloud_users WHERE email = ?')) {
              const email = params[0]?.toLowerCase();
              for (const u of db.users.values()) {
                if (u.email.toLowerCase() === email) {
                  return { id: u.id } as any;
                }
              }
              return null;
            }

            // Rate limit check / upsert with RETURNING
            if (normalized.includes('INSERT INTO rate_limits')) {
              const key = params[0];
              const resetAt = params[1];
              const updatedAt = params[2];
              const now = params[3];
              const existing = db.rateLimits.get(key);
              if (existing && existing.reset_at > now) {
                existing.count += 1;
                existing.updated_at = updatedAt;
                return { count: existing.count, reset_at: existing.reset_at } as any;
              } else {
                db.rateLimits.set(key, { count: 1, reset_at: resetAt, updated_at: updatedAt });
                return { count: 1, reset_at: resetAt } as any;
              }
            }

            return null;
          },

          async all<T = any>(): Promise<{ results: T[] }> {
            return { results: [] };
          },

          async run(): Promise<{ success: boolean }> {
            // Rate limit upsert
            if (normalized.includes('INSERT INTO rate_limits')) {
              const [key, count, resetAt, updatedAt] = params;
              const existing = db.rateLimits.get(key);
              if (existing && existing.reset_at > Math.floor(Date.now() / 1000)) {
                existing.count += 1;
                existing.updated_at = updatedAt;
              } else {
                db.rateLimits.set(key, { count: count || 1, reset_at: resetAt, updated_at: updatedAt });
              }
              return { success: true };
            }

            // Organization insert
            if (normalized.includes('INSERT INTO organizations')) {
              const [id, name, legalName, taxNum, currency, country, timezone, created, updated] = params;
              db.organizations.set(id, { id, name, legalName, taxNum, currency, country, timezone, created, updated });
              return { success: true };
            }

            // Branch insert
            if (normalized.includes('INSERT INTO branches')) {
              const [id, orgId, code, name, isMain, address, phone, email, status, created, updated] = params;
              db.branches.set(id, { id, orgId, code, name, isMain, address, phone, email, status, created, updated });
              return { success: true };
            }

            // User insert
            if (normalized.includes('INSERT INTO cloud_users')) {
              const [id, orgId, email, passwordHash, name, role, branchId, status, lastLogin, created, updated] = params;
              db.users.set(id, { id, orgId, email, passwordHash, name, role, branchId, status, lastLogin, created, updated });
              return { success: true };
            }

            // Category insert
            if (normalized.includes('INSERT INTO master_categories')) {
              const [id, orgId, name, sortOrder, isActive, created, updated] = params;
              db.categories.set(id, { id, orgId, name, sortOrder, isActive, created, updated });
              return { success: true };
            }

            // Product insert
            if (normalized.includes('INSERT INTO master_products')) {
              const [id, orgId, categoryId, name, sku, basePrice, taxRate, isActive, version, created, updated] = params;
              db.products.set(id, { id, orgId, categoryId, name, sku, basePrice, taxRate, isActive, version, created, updated });
              return { success: true };
            }

            return { success: true };
          },
        };
      },
    };
  }

  async batch(statements: any[]): Promise<any[]> {
    for (const stmt of statements) {
      await stmt.run();
    }
    return statements.map(() => ({ success: true }));
  }
}

async function runRegistrationTests() {
  console.log('Running SaaS Tenant Registration Test Suite...\n');

  // Test 1: Successful Registration & Starter Menu Seeding (QSR)
  {
    const db = new MockD1RegistrationDB();
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging' };

    const req = new Request('https://api.orderitup.in/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
      body: JSON.stringify({
        restaurant_name: 'Burger & Co',
        owner_name: 'Rahul Sharma',
        email: 'rahul@burgerco.com',
        password: 'secure_password_123',
        country: 'IN',
        currency: 'INR',
        service_model: 'qsr',
      }),
    });

    const res = await cloudWorker.fetch(req, env);
    assert.equal(res.status, 201, 'Registration should return HTTP 201');
    const data = await res.json() as any;

    assert.equal(data.success, true);
    assert.ok(data.token, 'Should return a JWT token');
    assert.equal(data.user.email, 'rahul@burgerco.com');
    assert.equal(data.user.role, 'owner');
    assert.equal(data.user.organization_name, 'Burger & Co');
    assert.equal(data.branch.code, 'BR-01');

    // Verify claims in returned JWT
    const claims = await verifyJWT(data.token, TEST_JWT_SECRET);
    assert.ok(claims);
    assert.equal(claims.email, 'rahul@burgerco.com');
    assert.equal(claims.role, 'owner');
    assert.equal(claims.org, data.user.organization_id);

    // Verify starter menu categories & products seeded
    assert.ok(db.categories.size >= 2, 'Should seed starter categories');
    assert.ok(db.products.size >= 5, 'Should seed starter products');

    console.log('✓ Test 1 Passed: Successful Registration & Starter Catalog Seeding');
  }

  // Test 2: Reject Duplicate Email Registration
  {
    const db = new MockD1RegistrationDB();
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging' };

    // Register first user
    db.users.set('u1', { id: 'u1', email: 'owner@existing.com', status: 'active' });

    const req = new Request('https://api.orderitup.in/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.2' },
      body: JSON.stringify({
        restaurant_name: 'Another Cafe',
        owner_name: 'John Doe',
        email: 'owner@existing.com',
        password: 'password123',
      }),
    });

    const res = await cloudWorker.fetch(req, env);
    assert.equal(res.status, 409, 'Duplicate email must return HTTP 409');
    const data = await res.json() as any;
    assert.ok(data.error?.includes('already exists'));

    console.log('✓ Test 2 Passed: Reject Duplicate Email Registration');
  }

  // Test 3: Reject Invalid Inputs (short password, bad email, empty name)
  {
    const db = new MockD1RegistrationDB();
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging' };

    // Short password (< 8 chars)
    const req1 = new Request('https://api.orderitup.in/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_name: 'Cafe',
        owner_name: 'John',
        email: 'john@cafe.com',
        password: 'short',
      }),
    });
    const res1 = await cloudWorker.fetch(req1, env);
    assert.equal(res1.status, 400);

    // Invalid email format
    const req2 = new Request('https://api.orderitup.in/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_name: 'Cafe',
        owner_name: 'John',
        email: 'not-an-email',
        password: 'validpassword123',
      }),
    });
    const res2 = await cloudWorker.fetch(req2, env);
    assert.equal(res2.status, 400);

    console.log('✓ Test 3 Passed: Reject Invalid Registration Inputs');
  }

  // Test 4: Rate Limiting Registration per IP
  {
    const db = new MockD1RegistrationDB();
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging' };

    // Simulate 10 registrations already done in the current hour from this IP
    db.rateLimits.set('register_ip:192.168.1.100', {
      count: 10,
      reset_at: Math.floor(Date.now() / 1000) + 1800,
      updated_at: new Date().toISOString(),
    });

    const req = new Request('https://api.orderitup.in/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.168.1.100' },
      body: JSON.stringify({
        restaurant_name: 'Cafe 11',
        owner_name: 'Tester',
        email: 'tester11@test.com',
        password: 'password1234',
      }),
    });

    const res = await cloudWorker.fetch(req, env);
    assert.equal(res.status, 429, 'Excessive registrations must be rate limited (429)');
    assert.ok(res.headers.get('Retry-After'));

    console.log('✓ Test 4 Passed: IP Rate Limiting Enforced on Registration');
  }

  console.log('\nAll SaaS Tenant Registration Tests Passed Successfully!\n');
}

runRegistrationTests();
