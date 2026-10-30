/**
 * TASK C-01: Comprehensive Cloud Authentication & JWT Hardening Test Suite
 * 
 * Verifies:
 * 1. Modern scrypt password hashing with cryptographic salt & parameter validation.
 * 2. Legacy SHA-256 password hash verification and transparent rehash migration.
 * 3. Fail-closed behavior on null, empty, missing, or malformed credentials/hashes.
 * 4. Strict Web Crypto JWT signing: 32+ char secret requirement, no fallback secrets.
 * 5. Strict JWT verification: header alg ('HS256' only), signature, expiry, claim schema.
 * 6. Cloud API Login route (/api/auth/login) end-to-end simulation.
 * 7. Tenant isolation: token claims are sole authority, cross-org attacks rejected.
 * 8. Role-Based Access Control (RBAC): unauthorized roles rejected (403).
 * 9. Information disclosure prevention: zero leakage of secrets, hashes, or stack traces.
 */

import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  hashString,
  createJWT,
  verifyJWT,
  isSecretValid,
  MIN_SECRET_LENGTH,
  JWTPayload,
} from '../apps/cloud-api/src/auth';
import cloudWorker from '../apps/cloud-api/src/index';

const STRONG_TEST_SECRET = 'cloud-auth-hardening-test-secret-256bits-key-32chars!';
const WEAK_TEST_SECRET = 'short-secret';

// ============================================================================
// 1. In-Memory D1 Mock Engine for Cloudflare Worker Testing
// ============================================================================
class MockD1Database {
  public users: Map<string, any> = new Map();
  public organizations: Map<string, any> = new Map();
  public branches: Map<string, any> = new Map();
  public pairingTokens: Map<string, any> = new Map();
  public masterProducts: Map<string, any> = new Map();
  public branchOverrides: Map<string, any> = new Map();
  public transfers: Map<string, any> = new Map();

  prepare(sql: string) {
    const db = this;
    return {
      bind(...params: any[]) {
        return {
          async first<T = any>(): Promise<T | null> {
            const normalized = sql.replace(/\s+/g, ' ').trim();

            // 1. User login query
            if (normalized.includes('FROM cloud_users u') && normalized.includes('WHERE u.email = ?')) {
              const email = params[0]?.toLowerCase();
              for (const u of db.users.values()) {
                if (u.email.toLowerCase() === email && u.status === 'active') {
                  const org = db.organizations.get(u.organization_id);
                  return {
                    ...u,
                    organization_name: org?.name || 'Test Org',
                    currency: org?.currency || 'INR',
                    timezone: org?.timezone || 'Asia/Kolkata',
                  } as T;
                }
              }
              return null;
            }

            // 2. Branch query
            if (normalized.includes('FROM branches WHERE id = ? AND organization_id = ?')) {
              const [branchId, orgId] = params;
              const b = db.branches.get(branchId);
              if (b && b.organization_id === orgId) return b as T;
              return null;
            }
            if (normalized.includes('FROM branches WHERE id = ?')) {
              const [branchId] = params;
              return (db.branches.get(branchId) || null) as T;
            }

            // 3. Master product query
            if (normalized.includes('FROM master_products WHERE id = ? AND organization_id = ?')) {
              const [prodId, orgId] = params;
              const p = db.masterProducts.get(prodId);
              if (p && p.organization_id === orgId) return p as T;
              return null;
            }

            // 4. Inventory transfer query
            if (normalized.includes('FROM inventory_transfers WHERE id = ? AND organization_id = ?')) {
              const [trId, orgId] = params;
              const t = db.transfers.get(trId);
              if (t && t.organization_id === orgId) return t as T;
              return null;
            }

            return null;
          },

          async all<T = any>(): Promise<{ results: T[] }> {
            const normalized = sql.replace(/\s+/g, ' ').trim();

            if (normalized.includes('FROM branches') && (normalized.includes('organization_id = ?') || normalized.includes('b.organization_id = ?'))) {
              const orgId = params[0];
              const list: any[] = [];
              for (const b of db.branches.values()) {
                if (b.organization_id === orgId) list.push(b);
              }
              return { results: list as T[] };
            }

            if (normalized.includes('FROM branches WHERE id IN (?, ?) AND organization_id = ?')) {
              const [b1, b2, orgId] = params;
              const list: any[] = [];
              const br1 = db.branches.get(b1);
              const br2 = db.branches.get(b2);
              if (br1 && br1.organization_id === orgId) list.push(br1);
              if (br2 && br2.organization_id === orgId && b1 !== b2) list.push(br2);
              return { results: list as T[] };
            }

            return { results: [] };
          },

          async run(): Promise<{ success: boolean }> {
            const normalized = sql.replace(/\s+/g, ' ').trim();

            // Update user password_hash (rehash)
            if (normalized.includes('UPDATE cloud_users SET password_hash = ?')) {
              const [newHash, _updatedAt, userId] = params;
              const u = db.users.get(userId);
              if (u) {
                u.password_hash = newHash;
                u.rehashCount = (u.rehashCount || 0) + 1;
              }
              return { success: true };
            }

            // Update last_login_at
            if (normalized.includes('UPDATE cloud_users SET last_login_at = ?')) {
              const [_lastLogin, userId] = params;
              const u = db.users.get(userId);
              if (u) u.last_login_at = _lastLogin;
              return { success: true };
            }

            // Insert pairing token
            if (normalized.includes('INSERT INTO pairing_tokens')) {
              const [code, orgId, branchId, terminalName, expiresAt, createdAt] = params;
              db.pairingTokens.set(code, { code, orgId, branchId, terminalName, expiresAt, createdAt });
              return { success: true };
            }

            // Insert branch
            if (normalized.includes('INSERT INTO branches')) {
              const [id, orgId, code, name, isMain, address, phone, email, now1, now2] = params;
              db.branches.set(id, { id, organization_id: orgId, code, name, is_main_branch: isMain, address, phone, email });
              return { success: true };
            }

            // Insert master product
            if (normalized.includes('INSERT INTO master_products')) {
              const [id, orgId, catId, name, sku, barcode, basePrice, taxRate, isActive] = params;
              db.masterProducts.set(id, { id, organization_id: orgId, category_id: catId, name, sku, barcode, base_price: basePrice, tax_rate: taxRate, is_active: isActive });
              return { success: true };
            }

            // Insert transfer
            if (normalized.includes('INSERT INTO inventory_transfers')) {
              const [id, orgId, sBranch, dBranch, status, itemsJson, reqBy, notes] = params;
              db.transfers.set(id, { id, organization_id: orgId, source_branch_id: sBranch, dest_branch_id: dBranch, status, items_json: itemsJson, requested_by: reqBy, notes });
              return { success: true };
            }

            // Update transfer
            if (normalized.includes('UPDATE inventory_transfers')) {
              const [status, approvedBy, _now, id] = params;
              const tr = db.transfers.get(id);
              if (tr) {
                tr.status = status;
                tr.approved_by = approvedBy;
              }
              return { success: true };
            }

            return { success: true };
          },
        };
      },
    };
  }
}

function createTestDatabase(): MockD1Database {
  const db = new MockD1Database();

  // Organizations
  db.organizations.set('org-alpha', {
    id: 'org-alpha',
    name: 'Alpha Hospitality',
    currency: 'USD',
    timezone: 'America/New_York',
  });
  db.organizations.set('org-beta', {
    id: 'org-beta',
    name: 'Beta Franchise',
    currency: 'EUR',
    timezone: 'Europe/Paris',
  });

  // Branches
  db.branches.set('br-alpha-main', {
    id: 'br-alpha-main',
    organization_id: 'org-alpha',
    name: 'Alpha Downtown',
    code: 'ALP-01',
    is_main_branch: 1,
  });
  db.branches.set('br-alpha-sub', {
    id: 'br-alpha-sub',
    organization_id: 'org-alpha',
    name: 'Alpha Uptown',
    code: 'ALP-02',
    is_main_branch: 0,
  });
  db.branches.set('br-beta-main', {
    id: 'br-beta-main',
    organization_id: 'org-beta',
    name: 'Beta Champs-Elysees',
    code: 'BET-01',
    is_main_branch: 1,
  });

  return db;
}

// ============================================================================
// 2. Password Hashing Unit Tests
// ============================================================================
async function testPasswordHashing(): Promise<void> {
  console.log('🧪 [Test Suite 1/5] Password Hashing & Migration...');

  // 1. Modern scrypt format and random salt validation
  const pass = 'CorrectHorseBatteryStaple#2026';
  const hash1 = await hashPassword(pass);
  const hash2 = await hashPassword(pass);

  assert(hash1.startsWith('scrypt$N=16384,r=8,p=1$'), 'Hash must have scrypt prefix and parameters');
  assert.notEqual(hash1, hash2, 'Salts must be cryptographically random and unique per hash');

  // 2. Correct password verification
  const resValid = await verifyPassword(pass, hash1);
  assert.equal(resValid.valid, true, 'Valid password must verify true');
  assert.equal(resValid.needsRehash, false, 'Modern scrypt hash does not need rehash');

  // 3. Incorrect password rejection
  const resInvalid = await verifyPassword('WrongPassword123!', hash1);
  assert.equal(resInvalid.valid, false, 'Wrong password must be rejected');
  assert.equal(resInvalid.needsRehash, false);

  // 4. Missing/empty password rejection
  assert.equal((await verifyPassword('', hash1)).valid, false, 'Empty password rejected');
  assert.equal((await verifyPassword(null as any, hash1)).valid, false, 'Null password rejected');
  assert.equal((await verifyPassword(undefined as any, hash1)).valid, false, 'Undefined password rejected');

  // 5. Missing/null/empty stored hash rejection (Fail closed)
  assert.equal((await verifyPassword(pass, null)).valid, false, 'Null stored hash must fail closed');
  assert.equal((await verifyPassword(pass, undefined)).valid, false, 'Undefined stored hash must fail closed');
  assert.equal((await verifyPassword(pass, '')).valid, false, 'Empty stored hash must fail closed');
  assert.equal((await verifyPassword(pass, '   ')).valid, false, 'Whitespace stored hash must fail closed');

  // 6. Malformed scrypt string rejection
  assert.equal((await verifyPassword(pass, 'scrypt$corrupted_payload')).valid, false, 'Malformed scrypt hash rejected');
  assert.equal((await verifyPassword(pass, 'scrypt$N=0,r=0,p=0$$')).valid, false, 'Zero parameter scrypt rejected');
  assert.equal((await verifyPassword(pass, 'plain_text_password')).valid, false, 'Plaintext stored hash rejected');

  // 7. Legacy SHA-256 backward compatibility & rehash signaling
  const legacyPass = 'legacyPassword2024';
  const legacyHash = await hashString(legacyPass); // 64 hex characters
  assert.equal(legacyHash.length, 64, 'Legacy SHA-256 hash must be 64 characters');

  // Correct password on legacy hash: valid=true, needsRehash=true
  const legacyResValid = await verifyPassword(legacyPass, legacyHash);
  assert.equal(legacyResValid.valid, true, 'Correct password on legacy hash must verify');
  assert.equal(legacyResValid.needsRehash, true, 'Legacy hash must be flagged for rehash');

  // Incorrect password on legacy hash: valid=false, needsRehash=false
  const legacyResInvalid = await verifyPassword('wrongLegacyPass', legacyHash);
  assert.equal(legacyResInvalid.valid, false, 'Wrong password on legacy hash must be rejected');
  assert.equal(legacyResInvalid.needsRehash, false);

  console.log('  ✓ Password hashing, verification, and legacy rehash signaling verified');
}

// ============================================================================
// 3. JWT Signing & Verification Unit Tests
// ============================================================================
async function testJWTSecurity(): Promise<void> {
  console.log('🧪 [Test Suite 2/5] Cryptographic JWT Integrity & Claim Schema...');

  const validPayload: JWTPayload = {
    sub: 'usr-001',
    org: 'org-alpha',
    email: 'admin@alpha.com',
    role: 'owner',
    branch: null,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  // 1. Weak / missing signing secret rejected
  assert.equal(isSecretValid(''), false, 'Empty secret is invalid');
  assert.equal(isSecretValid(WEAK_TEST_SECRET), false, `Secret < ${MIN_SECRET_LENGTH} chars is invalid`);
  assert.equal(isSecretValid(STRONG_TEST_SECRET), true, '32+ char secret is valid');

  await assert.rejects(
    async () => await createJWT(validPayload, WEAK_TEST_SECRET),
    /JWT secret must be a configured string of at least 32 characters/,
    'createJWT must fail closed when secret is weak'
  );

  // 2. Valid token creation and verification
  const token = await createJWT(validPayload, STRONG_TEST_SECRET);
  assert(typeof token === 'string' && token.split('.').length === 3, 'Token structure must be header.payload.sig');

  const verified = await verifyJWT(token, STRONG_TEST_SECRET);
  assert.ok(verified !== null, 'Valid token must verify');
  assert.equal(verified?.sub, validPayload.sub);
  assert.equal(verified?.org, validPayload.org);
  assert.equal(verified?.email, validPayload.email);
  assert.equal(verified?.role, validPayload.role);

  // 3. Reject verification with weak / missing secret
  assert.equal(await verifyJWT(token, WEAK_TEST_SECRET), null, 'Verification with weak secret must fail closed');
  assert.equal(await verifyJWT(token, ''), null, 'Verification with empty secret must fail closed');

  // 4. Reject verification with wrong secret
  const wrongSecret = 'another-completely-different-32char-secret-key!!';
  assert.equal(await verifyJWT(token, wrongSecret), null, 'Wrong secret must be rejected');

  // 5. Reject tampered signature
  const parts = token.split('.');
  const tamperedSigToken = `${parts[0]}.${parts[1]}.badSig1234567890`;
  assert.equal(await verifyJWT(tamperedSigToken, STRONG_TEST_SECRET), null, 'Tampered signature must be rejected');

  // 6. Reject expired token
  const expiredPayload = { ...validPayload, exp: Math.floor(Date.now() / 1000) - 30 };
  const expiredToken = await createJWT(expiredPayload, STRONG_TEST_SECRET);
  assert.equal(await verifyJWT(expiredToken, STRONG_TEST_SECRET), null, 'Expired token must be rejected');

  // 7. Reject unsupported algorithm in header ('none' attack)
  const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const noneToken = `${noneHeader}.${parts[1]}.${parts[2]}`;
  assert.equal(await verifyJWT(noneToken, STRONG_TEST_SECRET), null, 'alg: none must be rejected');

  // Reject 'RS256' algorithm mismatch
  const rsHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const rsToken = `${rsHeader}.${parts[1]}.${parts[2]}`;
  assert.equal(await verifyJWT(rsToken, STRONG_TEST_SECRET), null, 'alg: RS256 must be rejected');

  // 8. Reject malformed tokens
  assert.equal(await verifyJWT('', STRONG_TEST_SECRET), null, 'Empty string rejected');
  assert.equal(await verifyJWT('not.a.token.extra.part', STRONG_TEST_SECRET), null, '5-part token rejected');
  assert.equal(await verifyJWT('single_part_string', STRONG_TEST_SECRET), null, '1-part token rejected');
  assert.equal(await verifyJWT('part1.part2', STRONG_TEST_SECRET), null, '2-part token rejected');
  assert.equal(await verifyJWT('invalid@chars!.payload.sig', STRONG_TEST_SECRET), null, 'Non-base64url rejected');

  // 9. Reject missing or incorrectly typed claims in payload
  const testClaimForgery = async (badClaims: any) => {
    const pB64 = Buffer.from(JSON.stringify(badClaims)).toString('base64url');
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const signingInput = `${headerB64}.${pB64}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(STRONG_TEST_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
    const sB64 = Buffer.from(new Uint8Array(sig)).toString('base64url');
    return await verifyJWT(`${signingInput}.${sB64}`, STRONG_TEST_SECRET);
  };

  assert.equal(await testClaimForgery({ ...validPayload, sub: '' }), null, 'Empty sub rejected');
  assert.equal(await testClaimForgery({ ...validPayload, sub: 12345 }), null, 'Numeric sub rejected');
  assert.equal(await testClaimForgery({ ...validPayload, org: '' }), null, 'Empty org rejected');
  assert.equal(await testClaimForgery({ ...validPayload, org: 999 }), null, 'Numeric org rejected');
  assert.equal(await testClaimForgery({ ...validPayload, role: 'superadmin_escalation' }), null, 'Illegal role rejected');
  assert.equal(await testClaimForgery({ ...validPayload, role: 0 }), null, 'Numeric role rejected');
  assert.equal(await testClaimForgery({ ...validPayload, email: 'notanemail' }), null, 'Invalid email rejected');
  assert.equal(await testClaimForgery({ ...validPayload, exp: 'never' }), null, 'String exp rejected');

  console.log('  ✓ JWT creation, verification, algorithm pinning, and strict claim schema passed');
}

// ============================================================================
// 4. Cloud API Login Endpoint Integration Tests (/api/auth/login)
// ============================================================================
async function testLoginEndpoint(): Promise<void> {
  console.log('🧪 [Test Suite 3/5] Cloud API Login Endpoint Hardening...');

  const db = createTestDatabase();
  const modernPass = 'P@sswordScrypt123!';
  const modernHash = await hashPassword(modernPass);

  const legacyPass = 'LegacyPass123!';
  const legacyHash = await hashString(legacyPass);

  // Seed Users
  db.users.set('usr-owner', {
    id: 'usr-owner',
    organization_id: 'org-alpha',
    email: 'owner@alpha.com',
    password_hash: modernHash,
    name: 'Owner Alice',
    role: 'owner',
    status: 'active',
  });

  db.users.set('usr-legacy', {
    id: 'usr-legacy',
    organization_id: 'org-alpha',
    email: 'legacy@alpha.com',
    password_hash: legacyHash,
    name: 'Legacy User Bob',
    role: 'manager',
    status: 'active',
  });

  db.users.set('usr-nopass', {
    id: 'usr-nopass',
    organization_id: 'org-alpha',
    email: 'nopass@alpha.com',
    password_hash: null, // Nullable password hash in database
    name: 'No Password User',
    role: 'owner',
    status: 'active',
  });

  db.users.set('usr-inactive', {
    id: 'usr-inactive',
    organization_id: 'org-alpha',
    email: 'inactive@alpha.com',
    password_hash: modernHash,
    name: 'Inactive User',
    role: 'manager',
    status: 'inactive',
  });

  const env = { DB: db as any, JWT_SECRET: STRONG_TEST_SECRET };

  // Helper to create fresh Request instances
  const makeLoginReq = (bodyObj: any) => new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj),
  });

  // 1. Correct password -> 200 OK, valid JWT, sanitized user
  const resSuccess = await cloudWorker.fetch(makeLoginReq({ email: 'Owner@Alpha.com ', password: modernPass }), env);
  assert.equal(resSuccess.status, 200, 'Successful login must return 200');
  const bodySuccess = await resSuccess.json() as any;
  assert.ok(bodySuccess.token, 'Response must contain token');
  assert.equal(bodySuccess.user.email, 'owner@alpha.com');
  assert.equal(bodySuccess.user.role, 'owner');
  assert.equal(bodySuccess.user.password, undefined, 'Must not return password');
  assert.equal(bodySuccess.user.password_hash, undefined, 'Must not return password_hash');

  const verified = await verifyJWT(bodySuccess.token, STRONG_TEST_SECRET);
  assert.equal(verified?.sub, 'usr-owner');

  // 2. Missing email -> 400 Bad Request, generic error
  const resNoEmail = await cloudWorker.fetch(makeLoginReq({ password: modernPass }), env);
  assert.equal(resNoEmail.status, 400);
  assert.equal((await resNoEmail.json() as any).error, 'Invalid credentials');

  // 3. Missing password -> 400 Bad Request, generic error
  const resNoPass = await cloudWorker.fetch(makeLoginReq({ email: 'owner@alpha.com' }), env);
  assert.equal(resNoPass.status, 400);
  assert.equal((await resNoPass.json() as any).error, 'Invalid credentials');

  // 4. Empty password -> 400 Bad Request, generic error
  const resEmptyPass = await cloudWorker.fetch(makeLoginReq({ email: 'owner@alpha.com', password: '' }), env);
  assert.equal(resEmptyPass.status, 400);
  assert.equal((await resEmptyPass.json() as any).error, 'Invalid credentials');

  // 5. Incorrect password -> 401 Unauthorized, generic error (no enumeration)
  const resWrongPass = await cloudWorker.fetch(makeLoginReq({ email: 'owner@alpha.com', password: 'WrongPassword999!' }), env);
  assert.equal(resWrongPass.status, 401);
  assert.equal((await resWrongPass.json() as any).error, 'Invalid credentials');

  // 6. Non-existent user -> 401 Unauthorized, identical generic error
  const resUnknown = await cloudWorker.fetch(makeLoginReq({ email: 'nonexistent@alpha.com', password: 'SomePassword123!' }), env);
  assert.equal(resUnknown.status, 401);
  assert.equal((await resUnknown.json() as any).error, 'Invalid credentials');

  // 7. Inactive user -> 401 Unauthorized, identical generic error
  const resInactive = await cloudWorker.fetch(makeLoginReq({ email: 'inactive@alpha.com', password: modernPass }), env);
  assert.equal(resInactive.status, 401);
  assert.equal((await resInactive.json() as any).error, 'Invalid credentials');

  // 8. User with NULL password_hash in DB -> Fail closed, 401 Unauthorized
  const resNullHash = await cloudWorker.fetch(makeLoginReq({ email: 'nopass@alpha.com', password: 'AnyPasswordAttempt' }), env);
  assert.equal(resNullHash.status, 401, 'User with null password_hash must fail closed');
  assert.equal((await resNullHash.json() as any).error, 'Invalid credentials');

  // 9. Legacy SHA-256 password migration & transparent rehash
  const userLegacyBefore = db.users.get('usr-legacy');
  assert(userLegacyBefore.password_hash.length === 64, 'Starts as 64-char legacy SHA-256');

  const resLegacy = await cloudWorker.fetch(makeLoginReq({ email: 'legacy@alpha.com', password: legacyPass }), env);
  assert.equal(resLegacy.status, 200, 'Legacy user with correct password must log in');

  const userLegacyAfter = db.users.get('usr-legacy');
  assert(userLegacyAfter.password_hash.startsWith('scrypt$'), 'Legacy hash must be transparently upgraded to scrypt');

  // Subsequent login with new scrypt hash
  const resLegacySubsequent = await cloudWorker.fetch(makeLoginReq({ email: 'legacy@alpha.com', password: legacyPass }), env);
  assert.equal(resLegacySubsequent.status, 200, 'Subsequent login with rehashed record must succeed');

  // 10. Missing / Weak server JWT_SECRET configuration -> 500 Server Misconfiguration (Fail Closed)
  const envWeakSecret = { DB: db as any, JWT_SECRET: WEAK_TEST_SECRET };
  const resWeakConfig = await cloudWorker.fetch(makeLoginReq({ email: 'owner@alpha.com', password: modernPass }), envWeakSecret);
  assert.equal(resWeakConfig.status, 500);
  assert.equal((await resWeakConfig.json() as any).error, 'Server authentication service is misconfigured');

  const envMissingSecret = { DB: db as any, JWT_SECRET: '' };
  const resMissingConfig = await cloudWorker.fetch(makeLoginReq({ email: 'owner@alpha.com', password: modernPass }), envMissingSecret);
  assert.equal(resMissingConfig.status, 500);
  assert.equal((await resMissingConfig.json() as any).error, 'Server authentication service is misconfigured');

  console.log('  ✓ Login endpoint hardening, generic error masking, and automatic rehash verified');
}

// ============================================================================
// 5. Tenant Boundary & Authorization Tests
// ============================================================================
async function testTenantBoundariesAndRBAC(): Promise<void> {
  console.log('🧪 [Test Suite 4/5] Tenant Boundary Scoping & Cross-Org Isolation...');

  const db = createTestDatabase();
  const env = { DB: db as any, JWT_SECRET: STRONG_TEST_SECRET };

  // Create tokens for Org Alpha (Owner) and Org Beta (Owner)
  const tokenAlphaOwner = await createJWT({
    sub: 'usr-alpha-owner',
    org: 'org-alpha',
    email: 'owner@alpha.com',
    role: 'owner',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, STRONG_TEST_SECRET);

  const tokenBetaOwner = await createJWT({
    sub: 'usr-beta-owner',
    org: 'org-beta',
    email: 'owner@beta.com',
    role: 'owner',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, STRONG_TEST_SECRET);

  // 1. Tenant Scoping: Alpha owner only sees Alpha branches
  const reqAlphaBranches = new Request('http://localhost/api/branches', {
    headers: { Authorization: `Bearer ${tokenAlphaOwner}` },
  });
  const resAlphaBranches = await cloudWorker.fetch(reqAlphaBranches, env);
  assert.equal(resAlphaBranches.status, 200);
  const dataAlphaBranches = await resAlphaBranches.json() as any;
  assert.equal(dataAlphaBranches.branches.length, 2);
  for (const b of dataAlphaBranches.branches) {
    assert.equal(b.organization_id, 'org-alpha', 'Must only return branches for org-alpha');
  }

  // 2. Cross-Org Branch Creation: Passing organization_id in request body is ignored
  const reqCreateBranch = new Request('http://localhost/api/branches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenAlphaOwner}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 'br-alpha-injected',
      organization_id: 'org-beta', // Malicious attempt to inject into org-beta
      name: 'Malicious Injected Branch',
    }),
  });
  const resCreateBranch = await cloudWorker.fetch(reqCreateBranch, env);
  assert([200, 201].includes(resCreateBranch.status), `Branch creation must return 200 or 201 (got ${resCreateBranch.status})`);
  const injectedBranch = db.branches.get('br-alpha-injected');
  assert.equal(injectedBranch.organization_id, 'org-alpha', 'Branch must be bound to org from JWT, not request body');

  // 3. Cross-Org Pairing Code Generation: Alpha user cannot pair Beta branch
  const reqCrossPair = new Request('http://localhost/api/pairing/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenAlphaOwner}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch_id: 'br-beta-main', // Branch belongs to org-beta
      terminal_name: 'Stolen POS Terminal',
    }),
  });
  const resCrossPair = await cloudWorker.fetch(reqCrossPair, env);
  assert.equal(resCrossPair.status, 404, 'Attempt to generate pairing for foreign branch must be rejected with 404');

  // 4. Cross-Org Catalog Overrides: Alpha user cannot override Beta branch
  const reqCrossOverride = new Request('http://localhost/api/catalog/branch/br-beta-main/override', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenAlphaOwner}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: 'prod-001',
      price_override: 10,
    }),
  });
  const resCrossOverride = await cloudWorker.fetch(reqCrossOverride, env);
  assert.equal(resCrossOverride.status, 404, 'Attempt to override foreign branch catalog must be 404');

  // 5. Cross-Org Inventory Transfers: Alpha user cannot create transfer with foreign branches
  const reqCrossTransfer = new Request('http://localhost/api/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenAlphaOwner}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_branch_id: 'br-alpha-main',
      dest_branch_id: 'br-beta-main', // Belongs to org-beta
      items: [{ item_id: 'beans', qty: 10 }],
    }),
  });
  const resCrossTransfer = await cloudWorker.fetch(reqCrossTransfer, env);
  assert.equal(resCrossTransfer.status, 404, 'Cross-org stock transfer must be rejected with 404');

  console.log('  ✓ Strict tenant isolation and cross-organization boundary protections verified');
}

// ============================================================================
// 6. Role-Based Access Control (RBAC) & Privilege Separation Tests
// ============================================================================
async function testRBACPrivilegeSeparation(): Promise<void> {
  console.log('🧪 [Test Suite 5/5] Role-Based Access Control (RBAC) Enforcement...');

  const db = createTestDatabase();
  const env = { DB: db as any, JWT_SECRET: STRONG_TEST_SECRET };

  const tokenWaiter = await createJWT({
    sub: 'usr-waiter-01',
    org: 'org-alpha',
    email: 'waiter@alpha.com',
    role: 'waiter',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, STRONG_TEST_SECRET);

  const tokenCashier = await createJWT({
    sub: 'usr-cashier-01',
    org: 'org-alpha',
    email: 'cashier@alpha.com',
    role: 'cashier',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, STRONG_TEST_SECRET);

  const tokenAccountant = await createJWT({
    sub: 'usr-accountant-01',
    org: 'org-alpha',
    email: 'accountant@alpha.com',
    role: 'accountant',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, STRONG_TEST_SECRET);

  // 1. Waiter cannot create branches
  const resWBranch = await cloudWorker.fetch(new Request('http://localhost/api/branches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenWaiter}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Waiter Branch' }),
  }), env);
  assert.equal(resWBranch.status, 403, 'Waiter must be forbidden from creating branches');

  // 2. Waiter cannot generate pairing tokens
  const resWPair = await cloudWorker.fetch(new Request('http://localhost/api/pairing/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenWaiter}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch_id: 'br-alpha-main', terminal_name: 'POS-01' }),
  }), env);
  assert.equal(resWPair.status, 403, 'Waiter must be forbidden from generating pairing tokens');

  // 3. Waiter cannot view financial analytics overview
  const resWAnalytics = await cloudWorker.fetch(new Request('http://localhost/api/analytics/overview', {
    headers: { Authorization: `Bearer ${tokenWaiter}` },
  }), env);
  assert.equal(resWAnalytics.status, 403, 'Waiter must be forbidden from viewing financial analytics');

  // 4. Cashier cannot access accountant export
  const resCExport = await cloudWorker.fetch(new Request('http://localhost/api/accountant/export-tally', {
    headers: { Authorization: `Bearer ${tokenCashier}` },
  }), env);
  assert.equal(resCExport.status, 403, 'Cashier must be forbidden from exporting accounting tally');

  // 5. Accountant cannot modify master catalog
  const resAMaster = await cloudWorker.fetch(new Request('http://localhost/api/catalog/product', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenAccountant}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Accountant Item', base_price: 100 }),
  }), env);
  assert.equal(resAMaster.status, 403, 'Accountant must be forbidden from modifying master catalog');

  // 6. Accountant cannot create branches
  const resABranch = await cloudWorker.fetch(new Request('http://localhost/api/branches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenAccountant}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Accountant Branch' }),
  }), env);
  assert.equal(resABranch.status, 403, 'Accountant must be forbidden from creating branches');

  console.log('  ✓ RBAC role boundaries (Owner, Accountant, Cashier, Waiter) strictly enforced');
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function runAllTests(): Promise<void> {
  console.log('================================================================');
  console.log('  TASK C-01: CLOUD AUTHENTICATION & JWT HARDENING AUDIT');
  console.log('================================================================\n');

  try {
    await testPasswordHashing();
    await testJWTSecurity();
    await testLoginEndpoint();
    await testTenantBoundariesAndRBAC();
    await testRBACPrivilegeSeparation();

    console.log('\n================================================================');
    console.log('✅ ALL CLOUD AUTH HARDENING REGRESSION TESTS PASSED!');
    console.log('================================================================');
  } catch (err: any) {
    console.error('\n❌ Test Suite Failed:', err);
    process.exit(1);
  }
}

runAllTests();
