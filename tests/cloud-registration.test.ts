/**
 * Self-Service SaaS Registration & Onboarding Test Suite
 */

import assert from 'node:assert/strict';
import cloudWorker from '../apps/cloud-api/src/index';
import { hashString, verifyJWT } from '../apps/cloud-api/src/auth';

const TEST_JWT_SECRET = 'cloud-registration-test-secret-256bits-key-32chars!';

class MockD1RegistrationDB {
  public users = new Map<string, any>();
  public organizations = new Map<string, any>();
  public branches = new Map<string, any>();
  public categories = new Map<string, any>();
  public products = new Map<string, any>();
  public rateLimits = new Map<string, { count: number; reset_at: number; updated_at: string }>();
  public subscriptions = new Map<string, any>();
  public subscriptionEvents = new Map<string, any>();
  public pilotRequests = new Map<string, any>();
  public pilotInvitations = new Map<string, any>();

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

            if (normalized.includes('FROM pilot_access_invitations i') && normalized.includes('JOIN pilot_access_requests')) {
              const invitation = Array.from(db.pilotInvitations.values()).find((item) =>
                item.token_hash === params[0] && item.expires_at > params[1] && !item.redeemed_at && !item.revoked_at);
              const pilotRequest = invitation && db.pilotRequests.get(invitation.request_id);
              if (!invitation || !pilotRequest || pilotRequest.status !== 'approved') return null;
              return {
                id: invitation.id,
                request_id: invitation.request_id,
                token_hash: invitation.token_hash,
                contact_name: pilotRequest.contact_name,
                restaurant_name: pilotRequest.restaurant_name,
                email: pilotRequest.email,
                phone: pilotRequest.phone,
                country: pilotRequest.country,
                restaurant_type: pilotRequest.restaurant_type,
              } as T;
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
              return { success: true, meta: { changes: 1 } } as any;
            }

            if (normalized.startsWith('UPDATE pilot_access_invitations SET redeemed_at')) {
              const [redeemedAt, claimId, id, requestId, tokenHash, now, approvedRequestId] = params;
              const invitation = db.pilotInvitations.get(id);
              const pilotRequest = db.pilotRequests.get(requestId);
              if (invitation && invitation.request_id === requestId && invitation.token_hash === tokenHash &&
                  !invitation.redeemed_at && !invitation.revoked_at && invitation.expires_at > now &&
                  approvedRequestId === requestId && pilotRequest?.status === 'approved') {
                invitation.redeemed_at = redeemedAt;
                invitation.redemption_claim_id = claimId;
                return { success: true, meta: { changes: 1 } } as any;
              }
              return { success: true, meta: { changes: 0 } } as any;
            }

            if (normalized.startsWith('UPDATE pilot_access_invitations SET organization_id')) {
              const [organizationId, id, claimId, tokenHash] = params;
              const invitation = db.pilotInvitations.get(id);
              if (invitation?.redemption_claim_id === claimId && invitation.token_hash === tokenHash) {
                invitation.organization_id = organizationId;
                return { success: true, meta: { changes: 1 } } as any;
              }
              return { success: true, meta: { changes: 0 } } as any;
            }

            // Organization insert
            if (normalized.includes('INSERT INTO organizations')) {
              const [id, name, legalName, taxNum, currency, country, timezone, created, updated] = params;
              if (normalized.includes('WHERE EXISTS (SELECT 1 FROM pilot_access_invitations')) {
                const invitation = db.pilotInvitations.get(params[9]);
                if (!invitation || invitation.redemption_claim_id !== params[10] || invitation.token_hash !== params[11]) {
                  return { success: true, meta: { changes: 0 } } as any;
                }
              }
              db.organizations.set(id, { id, name, legalName, taxNum, currency, country, timezone, created, updated });
              return { success: true, meta: { changes: 1 } } as any;
            }

            // Branch insert
            if (normalized.includes('INSERT INTO branches')) {
              const [id, orgId, code, name, isMain, address, phone, email, status, created, updated] = params;
              db.branches.set(id, { id, orgId, code, name, isMain, address, phone, email, status, created, updated });
              return { success: true, meta: { changes: 1 } } as any;
            }

            // User insert
            if (normalized.includes('INSERT INTO cloud_users')) {
              const [id, orgId, email, passwordHash, name, role, branchId, status, lastLogin, created, updated] = params;
              db.users.set(id, { id, orgId, email, passwordHash, name, role, branchId, status, lastLogin, created, updated });
              return { success: true, meta: { changes: 1 } } as any;
            }

            // Category insert
            if (normalized.includes('INSERT INTO master_categories')) {
              const [id, orgId, name, sortOrder, isActive, created, updated] = params;
              db.categories.set(id, { id, orgId, name, sortOrder, isActive, created, updated });
              return { success: true, meta: { changes: 1 } } as any;
            }

            // Initial organization subscription snapshot (14-day Starter trial).
            if (normalized.includes('INSERT INTO organization_subscriptions')) {
              const [id, organizationId, trialEndsAt, createdAt, updatedAt] = params;
              db.subscriptions.set(id, {
                id, organization_id: organizationId, plan_code: 'starter', status: 'trial',
                billing_cycle: 'monthly', currency: 'INR', amount_minor: 49900,
                trial_ends_at: trialEndsAt, created_at: createdAt, updated_at: updatedAt,
              });
              return { success: true, meta: { changes: 1 } } as any;
            }

            if (normalized.includes('INSERT INTO subscription_events')) {
              const [id, organizationId, subscriptionId, createdAt] = params;
              db.subscriptionEvents.set(id, {
                id, organization_id: organizationId, subscription_id: subscriptionId,
                event_type: 'trial_started', source: 'self_service_registration', created_at: createdAt,
              });
              return { success: true, meta: { changes: 1 } } as any;
            }

            // Product insert
            if (normalized.includes('INSERT INTO master_products')) {
              const [id, orgId, categoryId, name, sku, basePrice, taxRate, isActive, version, created, updated] = params;
              db.products.set(id, { id, orgId, categoryId, name, sku, basePrice, taxRate, isActive, version, created, updated });
              return { success: true, meta: { changes: 1 } } as any;
            }

            if (normalized.includes('INSERT INTO platform_admin_audit_log')) {
              return { success: true, meta: { changes: 1 } } as any;
            }
            return { success: true, meta: { changes: 1 } } as any;
          },
        };
      },
    };
  }

  async batch(statements: any[]): Promise<any[]> {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }
}

async function runRegistrationTests() {
  console.log('Running SaaS Tenant Registration Test Suite...\n');

  // Public signup stays closed by default; pilot-approved invitations are the controlled path.
  {
    const db = new MockD1RegistrationDB();
    const req = new Request('https://api.orderitup.in/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_name: 'Unapproved Cafe', owner_name: 'Test Owner', email: 'unapproved@example.test', password: 'password123' }),
    });
    const response = await cloudWorker.fetch(req, { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging' });
    assert.equal(response.status, 403, 'Unauthenticated direct registration is closed by default');
    assert.equal((await response.json() as any).code, 'PILOT_ACCESS_REQUIRED');
    assert.equal(db.organizations.size, 0);
    console.log('✓ Pilot approval is required for public account creation');
  }

  // Test 1: Successful Registration & Starter Menu Seeding (QSR)
  {
    const db = new MockD1RegistrationDB();
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging', ALLOW_SELF_SERVICE_REGISTRATION: 'true' };

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
    assert.equal(db.subscriptions.size, 1, 'Registration should create one persisted subscription');
    const subscription = Array.from(db.subscriptions.values())[0] as any;
    assert.equal(subscription.plan_code, 'starter', 'New tenant starts on the Starter plan');
    assert.equal(subscription.status, 'trial', 'New tenant receives trial status');
    assert.ok(subscription.trial_ends_at, 'Starter trial has an explicit end timestamp');
    assert.equal(db.subscriptionEvents.size, 1, 'Registration should record an auditable trial-start event');

    console.log('✓ Test 1 Passed: Successful Registration, Starter Catalog & Trial Subscription');
  }

  // Test 2: Reject Duplicate Email Registration
  {
    const db = new MockD1RegistrationDB();
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging', ALLOW_SELF_SERVICE_REGISTRATION: 'true' };

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
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging', ALLOW_SELF_SERVICE_REGISTRATION: 'true' };

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
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging', ALLOW_SELF_SERVICE_REGISTRATION: 'true' };

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

  // Test 5: Approved pilot invitation creates a real tenant account once.
  {
    const db = new MockD1RegistrationDB();
    const env = { DB: db as any, JWT_SECRET: TEST_JWT_SECRET, ENVIRONMENT: 'staging', ALLOW_SELF_SERVICE_REGISTRATION: 'true' };
    const token = 'ab'.repeat(32);
    const tokenHash = await hashString(token);
    const requestId = 'pilot-request-approved';
    const invitationId = 'pilot-invitation-one-time';
    db.pilotRequests.set(requestId, {
      id: requestId,
      contact_name: 'Asha Rao',
      restaurant_name: 'Asha Cafe',
      email: 'asha@example.com',
      phone: '+919876543210',
      country: 'IN',
      restaurant_type: 'cafe',
      status: 'approved',
    });
    db.pilotInvitations.set(invitationId, {
      id: invitationId,
      request_id: requestId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      redeemed_at: null,
      revoked_at: null,
    });

    const request = () => new Request('https://api.orderitup.in/api/pilot-invitations/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.55' },
      body: JSON.stringify({ token, password: 'pilot-password-123' }),
    });
    const response = await cloudWorker.fetch(request(), env);
    assert.equal(response.status, 201, 'Approved invitation creates the restaurant account');
    const account = await response.json() as any;
    assert.equal(account.user.email, 'asha@example.com', 'Account email is bound to the approved request');
    assert.equal(account.user.name, 'Asha Rao');
    assert.equal(account.user.organization_name, 'Asha Cafe');
    assert.equal(db.pilotInvitations.get(invitationId).redeemed_at !== null, true);
    assert.equal(db.pilotInvitations.get(invitationId).organization_id, account.user.organization_id);
    assert.equal(db.users.size, 1);
    assert.equal(db.subscriptions.size, 1);
    assert.equal(db.categories.size >= 2, true);

    const replay = await cloudWorker.fetch(request(), env);
    assert.equal(replay.status, 410, 'A redeemed setup link cannot provision a second account');
    assert.equal(db.organizations.size, 1, 'Replay does not create a duplicate organization');
    console.log('✓ Test 5 Passed: Approved Pilot Invitation Provisioning & Single-Use Redemption');
  }

  console.log('\nAll SaaS Tenant Registration Tests Passed Successfully!\n');
}

runRegistrationTests();
