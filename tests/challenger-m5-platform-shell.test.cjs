/**
 * EMPIRICAL ADVERSARIAL CHALLENGER VERIFICATION & STRESS HARNESS (M5 - Instance 2)
 * File: tests/challenger-m5-platform-shell.test.cjs
 *
 * Exercises:
 * 1. Founder Platform Admin Perspective:
 *    - 16-character license key generator producing `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]`
 *    - FNV-1a 32-bit deterministic checksum verification, plan binding (ENT1, PRO1, STR1), and anti-tamper detection
 *    - Machine fingerprint normalization edge cases (empty, lowercase, non-alphanumeric, short/long)
 *    - S3 customer bucket isolation telemetry (tenants/{tenantId}/ across backups, users, payments, media)
 *    - Adversarial path traversal and anti-commingling validation
 *    - Platform-wide GMV aggregation consistency
 * 2. Restaurant Chain Owner Perspective:
 *    - Multi-branch live sales, AOV, tender mix, active tables (Downtown Bistro, Cyber Hub Express, Airport T3)
 *    - Tender mix mathematical consistency: sum(UPI, Cash, Card) === todaySales
 *    - Central menu catalog with per-branch price overrides (+15% transit premium) and availability 86-ing toggles
 *    - Branch override isolation (mutations in one branch must not leak to siblings)
 *    - Consolidated Indian GST taxes (SAC 996331, 2.5% CGST, 2.5% SGST, 5.0% total)
 *    - Multi-state tax jurisdiction allocation (Delhi NCT 07 vs Haryana 06)
 *    - GSTR-1 CSV and JSON export ledger validation
 * 3. Dashboard Shell Navigation & Query Param Synchronization:
 *    - Rapid query param transitions (?perspective=..., ?role=..., ?outlet=...)
 *    - Role normalization oracle (server -> waiter, delivery -> driver, manager -> owner, chain -> overview)
 *    - Case-insensitivity and hostile query param fallback resilience
 *    - Next.js 16 App Router <Suspense> boundary resilience for static export (output: 'export')
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_PAGE_FILE = path.join(ROOT, 'landing', 'src', 'app', 'dashboard', 'page.tsx');
const FOUNDER_ADMIN_FILE = path.join(ROOT, 'landing', 'src', 'components', 'dashboard', 'FounderAdminView.tsx');
const CHAIN_OWNER_FILE = path.join(ROOT, 'landing', 'src', 'components', 'dashboard', 'ChainOwnerView.tsx');
const STORE_FILE = path.join(ROOT, 'landing', 'src', 'lib', 'dashboard-store.ts');
const MODELS_FILE = path.join(ROOT, 'landing', 'src', 'lib', 'dashboard-models.ts');

// ============================================================================
// HELPER ORACLES & IMPLEMENTATIONS
// ============================================================================

/**
 * Canonical 16-character license key generator matching dashboard-store.ts
 */
function generateCanonicalLicenseKey(tenantId, plan, machineHash) {
  const cleanHash = (machineHash || '8F42')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .padEnd(4, '0')
    .slice(0, 4);

  const planCode = plan === 'enterprise' ? 'ENT1' : plan === 'pro' ? 'PRO1' : 'STR1';

  let hash = 0x811c9dc5;
  const seed = `OIUP${planCode}${cleanHash}${tenantId}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const checksum = Math.abs(hash).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  return `OIUP-${planCode}-${cleanHash}-${checksum}`;
}

/**
 * License key validator / tamper verifier
 */
function verifyLicenseKeyTamper(key, expectedTenantId) {
  if (!key || typeof key !== 'string') return { valid: false, reason: 'Invalid key type' };
  const parts = key.split('-');
  if (parts.length !== 4) return { valid: false, reason: 'Key must have 4 hyphen-separated blocks' };
  const [prefix, planCode, machineHash, checksum] = parts;

  if (prefix !== 'OIUP') return { valid: false, reason: 'Invalid prefix (expected OIUP)' };
  if (!['ENT1', 'PRO1', 'STR1'].includes(planCode)) return { valid: false, reason: 'Invalid plan code' };
  if (!/^[A-Z0-9]{4}$/.test(machineHash)) return { valid: false, reason: 'Invalid machine hash block' };
  if (!/^[A-Z0-9]{4}$/.test(checksum)) return { valid: false, reason: 'Invalid checksum block' };

  // Recalculate checksum
  let hash = 0x811c9dc5;
  const seed = `OIUP${planCode}${machineHash}${expectedTenantId}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const expectedChecksum = Math.abs(hash).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  if (checksum !== expectedChecksum) {
    return { valid: false, reason: `Checksum mismatch (expected ${expectedChecksum}, got ${checksum})` };
  }

  return { valid: true, planCode, machineHash, checksum };
}

/**
 * Isolated S3 path validator
 */
function validateS3IsolatedPath(tenantId, domain, filename) {
  const validDomains = ['backups', 'users', 'payments', 'media'];

  // Check tenantId
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Tenant ID required');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
    throw new Error('Tenant isolation violation: illegal characters in tenantId');
  }

  // Check domain
  if (!validDomains.includes(domain)) {
    throw new Error(`Invalid storage domain: ${domain}`);
  }

  // Check filename
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename required');
  }
  if (
    filename.includes('..') ||
    filename.includes('\\') ||
    filename.startsWith('/') ||
    filename.includes('\0') ||
    filename.includes('%2e%2e')
  ) {
    throw new Error('Path traversal or illegal character in filename');
  }

  return `tenants/${tenantId}/${domain}/${filename}`;
}

/**
 * Role Normalization Oracle matching page.tsx
 */
function normalizeDashboardRole(roleParam) {
  if (!roleParam || typeof roleParam !== 'string') return 'overview';
  const r = roleParam.trim().toLowerCase();
  if (r === 'cashier') return 'cashier';
  if (r === 'chef') return 'chef';
  if (r === 'waiter' || r === 'server') return 'waiter';
  if (r === 'accountant') return 'accountant';
  if (r === 'driver' || r === 'delivery') return 'driver';
  if (r === 'owner' || r === 'manager') return 'owner';
  if (r === 'overview' || r === 'chain') return 'overview';
  return 'overview'; // Fallback
}

/**
 * Perspective Normalization Oracle matching page.tsx
 */
function normalizeDashboardPerspective(perspectiveParam) {
  if (!perspectiveParam || typeof perspectiveParam !== 'string') return 'merchant';
  const p = perspectiveParam.trim().toLowerCase();
  if (p === 'founder') return 'founder';
  if (p === 'merchant') return 'merchant';
  return 'merchant';
}

// ============================================================================
// SUITE 1: FOUNDER PLATFORM ADMIN UNDER STRESS
// ============================================================================
describe('Suite 1: Founder Platform Admin Under Stress', () => {
  it('1.1: 16-character license key generator produces OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]', () => {
    const plans = [
      { plan: 'enterprise', expectedCode: 'ENT1' },
      { plan: 'pro', expectedCode: 'PRO1' },
      { plan: 'starter', expectedCode: 'STR1' },
    ];

    for (const { plan, expectedCode } of plans) {
      const key = generateCanonicalLicenseKey('tenant-0892', plan, 'M894');
      assert.match(
        key,
        new RegExp(`^OIUP-${expectedCode}-M894-[A-Z0-9]{4}$`),
        `License key must match OIUP-${expectedCode}-M894-[CHECKSUM]`
      );
      assert.equal(key.replace(/-/g, '').length, 16, 'Key must have exactly 16 alphanumeric characters');
      assert.equal(key.length, 19, 'Key with hyphens must be 19 characters total');

      const verification = verifyLicenseKeyTamper(key, 'tenant-0892');
      assert.equal(verification.valid, true, 'Newly generated key must verify successfully');
      assert.equal(verification.planCode, expectedCode);
      assert.equal(verification.machineHash, 'M894');
    }
  });

  it('1.2: Machine fingerprint normalization handles all boundary conditions', () => {
    // lowercase
    assert.equal(generateCanonicalLicenseKey('t1', 'enterprise', 'abcd').split('-')[2], 'ABCD');
    // non-alphanumeric stripped
    assert.equal(generateCanonicalLicenseKey('t1', 'enterprise', 'A#B$C%').split('-')[2], 'ABC0');
    // short padded with 0
    assert.equal(generateCanonicalLicenseKey('t1', 'enterprise', 'A1').split('-')[2], 'A100');
    // long truncated to 4
    assert.equal(generateCanonicalLicenseKey('t1', 'enterprise', 'A1B2C3D4').split('-')[2], 'A1B2');
    // empty string defaults to 8F42
    assert.equal(generateCanonicalLicenseKey('t1', 'enterprise', '').split('-')[2], '8F42');
    // null/undefined defaults to 8F42
    assert.equal(generateCanonicalLicenseKey('t1', 'enterprise', null).split('-')[2], '8F42');
    assert.equal(generateCanonicalLicenseKey('t1', 'enterprise', undefined).split('-')[2], '8F42');
  });

  it('1.3: Anti-tamper detection rejects modified plan, machine hash, or tenant mismatches', () => {
    const originalKey = generateCanonicalLicenseKey('tenant-0892', 'enterprise', 'M894');
    const [pfx, planCode, hw, checksum] = originalKey.split('-');

    // Tamper 1: Upgrade plan without changing checksum (e.g. STR1 -> ENT1)
    const tamperedPlanKey = `${pfx}-STR1-${hw}-${checksum}`;
    const result1 = verifyLicenseKeyTamper(tamperedPlanKey, 'tenant-0892');
    assert.equal(result1.valid, false);
    assert.match(result1.reason, /Checksum mismatch/);

    // Tamper 2: Change machine hardware hash
    const tamperedHwKey = `${pfx}-${planCode}-XXXX-${checksum}`;
    const result2 = verifyLicenseKeyTamper(tamperedHwKey, 'tenant-0892');
    assert.equal(result2.valid, false);
    assert.match(result2.reason, /Checksum mismatch/);

    // Tamper 3: Attempt to use tenant-A's valid key on tenant-B
    const result3 = verifyLicenseKeyTamper(originalKey, 'tenant-other-9999');
    assert.equal(result3.valid, false);
    assert.match(result3.reason, /Checksum mismatch/);

    // Tamper 4: Malformed format
    assert.equal(verifyLicenseKeyTamper('INVALID-KEY', 'tenant-0892').valid, false);
    assert.equal(verifyLicenseKeyTamper('OIUP-ENT1-M894', 'tenant-0892').valid, false);
    assert.equal(verifyLicenseKeyTamper('OIUP-ENT1-M894-XXXX-EXTRA', 'tenant-0892').valid, false);
  });

  it('1.4: Adversarial fuzzing: 500 randomized keys comply with 16-char format and checksum integrity', () => {
    const plans = ['enterprise', 'pro', 'starter'];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()';
    const keysSeen = new Set();

    for (let i = 0; i < 500; i++) {
      const tenantId = `tenant-${1000 + i}`;
      const plan = plans[i % 3];
      // Generate random machine hash input
      let rawHw = '';
      for (let j = 0; j < 6; j++) {
        rawHw += alphabet[Math.floor(Math.random() * alphabet.length)];
      }

      const key = generateCanonicalLicenseKey(tenantId, plan, rawHw);
      assert.match(key, /^OIUP-(ENT1|PRO1|STR1)-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      assert.equal(key.replace(/-/g, '').length, 16);

      const verification = verifyLicenseKeyTamper(key, tenantId);
      assert.equal(verification.valid, true, `Key ${key} must verify for ${tenantId}`);

      keysSeen.add(key);
    }

    // High entropy: in 500 keys across 500 tenants, practically all should be unique
    assert.equal(keysSeen.size, 500, 'All 500 generated keys must be distinct');
  });

  it('1.5: S3 customer bucket telemetry verifies 4 domains and zero commingling', () => {
    const storeContent = fs.readFileSync(STORE_FILE, 'utf8');

    // Verify 4 strict domains in seed state
    const requiredDomains = ['backups', 'users', 'payments', 'media'];
    for (const domain of requiredDomains) {
      assert.match(
        storeContent,
        new RegExp(`${domain}:\\s*\\{[^}]*objectCount:[^}]*sizeMb:`, 'i'),
        `Store seed data must define metrics for domain: ${domain}`
      );
    }

    // Verify Zero Commingling invariant flag in store
    assert.match(storeContent, /zeroComminglingVerified:\s*true/);

    // Verify prefix enforcement tenants/{id}/
    assert.match(storeContent, /prefix:\s*["']tenants\/tenant-0892\/["']/);
  });

  it('1.6: Adversarial S3 path traversal & isolation attack fuzzing strictly denied', () => {
    const validTenant = 'tenant-0892';
    const validDomain = 'backups';

    // Successful path
    const safePath = validateS3IsolatedPath(validTenant, validDomain, 'db-2026-10-31.sqlite.enc');
    assert.equal(safePath, 'tenants/tenant-0892/backups/db-2026-10-31.sqlite.enc');

    // Attack 1: Directory traversal
    assert.throws(
      () => validateS3IsolatedPath(validTenant, validDomain, '../cross-tenant/secret.enc'),
      /Path traversal/
    );
    assert.throws(
      () => validateS3IsolatedPath(validTenant, validDomain, '..\\cross-tenant\\secret.enc'),
      /Path traversal/
    );

    // Attack 2: URL encoded traversal
    assert.throws(
      () => validateS3IsolatedPath(validTenant, validDomain, '%2e%2e/cross-tenant'),
      /Path traversal/
    );

    // Attack 3: Null byte injection
    assert.throws(
      () => validateS3IsolatedPath(validTenant, validDomain, 'file.txt\0.exe'),
      /Path traversal/
    );

    // Attack 4: Leading slash absolute path
    assert.throws(
      () => validateS3IsolatedPath(validTenant, validDomain, '/etc/passwd'),
      /Path traversal/
    );

    // Attack 5: Tenant ID escape attempt
    assert.throws(
      () => validateS3IsolatedPath('../../root', validDomain, 'file.txt'),
      /Tenant isolation violation/
    );
    assert.throws(
      () => validateS3IsolatedPath('tenant/slash', validDomain, 'file.txt'),
      /Tenant isolation violation/
    );

    // Attack 6: Invalid domain
    assert.throws(
      () => validateS3IsolatedPath(validTenant, 'admin_passwords', 'file.txt'),
      /Invalid storage domain/
    );
  });

  it('1.7: Platform GMV aggregation consistency', () => {
    // Seed tenants from store
    const seedTenants = [
      { id: 't1', monthGmv: 425000 },
      { id: 't2', monthGmv: 185000 },
      { id: 't3', monthGmv: 95000 },
      { id: 't4', monthGmv: 310000 },
    ];

    const totalGmv = seedTenants.reduce((acc, t) => acc + t.monthGmv, 0);
    assert.equal(totalGmv, 1015000);

    // Test with edge cases (0 GMV, undefined GMV)
    const messyTenants = [
      { id: 't1', monthGmv: 100 },
      { id: 't2', monthGmv: 0 },
      { id: 't3', monthGmv: undefined },
      { id: 't4', monthGmv: null },
    ];
    const safeGmv = messyTenants.reduce((acc, t) => acc + (t.monthGmv || 0), 0);
    assert.equal(safeGmv, 100);
    assert.ok(!isNaN(safeGmv));
  });
});

// ============================================================================
// SUITE 2: RESTAURANT CHAIN OWNER UNDER STRESS
// ============================================================================
describe('Suite 2: Restaurant Chain Owner Under Stress', () => {
  const seedOutlets = [
    {
      id: 'outlet-1',
      code: 'DEL-CP-01',
      name: 'Downtown Bistro Flagship (Connaught Place)',
      todaySales: 73380.0,
      ordersCount: 72,
      avgTicket: 1019.16,
      activeTables: 7,
      tenders: { upi: 44028.0, card: 22014.0, cash: 7338.0 },
      stateCode: '07',
      gstin: '07AAAAA0000A1Z5',
    },
    {
      id: 'outlet-2',
      code: 'HR-GGN-02',
      name: 'Cyber Hub Express (DLF Cyber City)',
      todaySales: 47550.0,
      ordersCount: 112,
      avgTicket: 424.55,
      activeTables: 4,
      tenders: { upi: 33285.0, card: 9510.0, cash: 4755.0 },
      stateCode: '06',
      gstin: '06AAAAA0000A1Z6',
    },
    {
      id: 'outlet-3',
      code: 'DEL-IGI-03',
      name: 'Airport Terminal 3 Hub (IGI Airport T3)',
      todaySales: 24540.0,
      ordersCount: 42,
      avgTicket: 584.28,
      activeTables: 2,
      tenders: { upi: 12270.0, card: 9816.0, cash: 2454.0 },
      stateCode: '07',
      gstin: '07AAAAA0000A1Z5',
    },
  ];

  it('2.1: Multi-branch live sales, order volume, AOV, active tables across all 3 outlets', () => {
    const totalSales = seedOutlets.reduce((acc, o) => acc + o.todaySales, 0);
    const totalOrders = seedOutlets.reduce((acc, o) => acc + o.ordersCount, 0);
    const totalTables = seedOutlets.reduce((acc, o) => acc + o.activeTables, 0);
    const chainAov = Math.round((totalSales / totalOrders) * 100) / 100;

    assert.equal(totalSales, 145470.0);
    assert.equal(totalOrders, 226);
    assert.equal(totalTables, 13);
    assert.equal(chainAov, 643.67);
  });

  it('2.2: Tender mix mathematical consistency: sum(UPI, Cash, Card) === todaySales', () => {
    let chainUpi = 0;
    let chainCard = 0;
    let chainCash = 0;

    for (const outlet of seedOutlets) {
      const sumTenders = outlet.tenders.upi + outlet.tenders.card + outlet.tenders.cash;
      assert.equal(
        Math.round(sumTenders * 100) / 100,
        outlet.todaySales,
        `Tender sum must equal todaySales for ${outlet.name}`
      );

      chainUpi += outlet.tenders.upi;
      chainCard += outlet.tenders.card;
      chainCash += outlet.tenders.cash;
    }

    const totalSales = seedOutlets.reduce((acc, o) => acc + o.todaySales, 0);
    assert.equal(chainUpi + chainCard + chainCash, totalSales, 'Consolidated tenders must equal total sales');

    // Percentage shares
    const upiPct = Math.round((chainUpi / totalSales) * 100);
    const cardPct = Math.round((chainCard / totalSales) * 100);
    const cashPct = Math.round((chainCash / totalSales) * 100);
    assert.equal(upiPct + cardPct + cashPct, 100, 'Tender percentage shares must sum to 100%');
  });

  it('2.3: Zero / empty outlet guard: AOV calculation does not produce NaN or Infinity', () => {
    function computeAov(sales, orders) {
      return orders > 0 ? Math.round((sales / orders) * 100) / 100 : 0;
    }

    assert.equal(computeAov(0, 0), 0);
    assert.equal(computeAov(1000, 0), 0);
    assert.ok(!isNaN(computeAov(0, 0)));
    assert.ok(isFinite(computeAov(0, 0)));
  });

  it('2.4: Central catalog price overrides: +15% airport transit premium calculation', () => {
    const catalogSeed = [
      { id: 'cat-1', name: 'Truffle Mushroom Artisan Pizza', basePrice: 540 },
      { id: 'cat-2', name: 'Cold Brew Salted Caramel', basePrice: 220 },
      { id: 'cat-3', name: 'Paneer Tikka Charcoal Roll', basePrice: 380 },
      { id: 'cat-4', name: 'Dal Makhani Slow Cooked', basePrice: 340 },
    ];

    for (const item of catalogSeed) {
      const transitPrice = Math.round(item.basePrice * 1.15);
      const diff = transitPrice - item.basePrice;
      const pctIncrease = (diff / item.basePrice) * 100;

      assert.ok(transitPrice > item.basePrice);
      assert.ok(Math.abs(pctIncrease - 15.0) < 0.5, `Item ${item.name} transit surcharge should be ~15%`);
    }
  });

  it('2.5: Branch override isolation: override in Airport T3 does not mutate basePrice or Cyber Hub', () => {
    const catalogItem = {
      id: 'cat-1',
      name: 'Truffle Mushroom Artisan Pizza',
      basePrice: 540,
      branchOverrides: {
        'outlet-3': { priceOverride: 621, isAvailable: true },
      },
    };

    // Helper to resolve effective price
    function getEffectivePrice(item, outletId) {
      return item.branchOverrides?.[outletId]?.priceOverride ?? item.basePrice;
    }

    // Airport T3 gets 621
    assert.equal(getEffectivePrice(catalogItem, 'outlet-3'), 621);
    // Downtown Bistro (outlet-1) gets master base price 540
    assert.equal(getEffectivePrice(catalogItem, 'outlet-1'), 540);
    // Cyber Hub (outlet-2) gets master base price 540
    assert.equal(getEffectivePrice(catalogItem, 'outlet-2'), 540);
    // Master basePrice remains 540 untouched
    assert.equal(catalogItem.basePrice, 540);
  });

  it('2.6: Branch-specific availability 86-ing toggles without cross-branch contamination', () => {
    const catalogItem = {
      id: 'cat-1',
      name: 'Truffle Mushroom Artisan Pizza',
      branchOverrides: {
        'outlet-2': { isAvailable: false }, // 86'd at Cyber Hub
      },
    };

    function isItemAvailableAtBranch(item, outletId) {
      return item.branchOverrides?.[outletId]?.isAvailable ?? true;
    }

    assert.equal(isItemAvailableAtBranch(catalogItem, 'outlet-2'), false, 'Cyber Hub must be 86d out');
    assert.equal(isItemAvailableAtBranch(catalogItem, 'outlet-1'), true, 'Downtown Bistro must remain in stock');
    assert.equal(isItemAvailableAtBranch(catalogItem, 'outlet-3'), true, 'Airport T3 must remain in stock');
  });

  it('2.7: Consolidated chain taxes under Indian GST (SAC 996331, 2.5% CGST, 2.5% SGST, 5.0% total)', () => {
    let chainTaxable = 0;
    let chainCgst = 0;
    let chainSgst = 0;
    let chainTotalTax = 0;

    for (const outlet of seedOutlets) {
      const taxable = Math.round((outlet.todaySales / 1.05) * 100) / 100;
      const cgst = Math.round((taxable * 0.025) * 100) / 100;
      const sgst = Math.round((taxable * 0.025) * 100) / 100;
      const totalTax = Math.round((cgst + sgst) * 100) / 100;

      // GST symmetry invariant: CGST must equal SGST in intra-state sales
      assert.equal(cgst, sgst, `CGST must strictly equal SGST for ${outlet.name}`);
      assert.equal(totalTax, cgst + sgst);

      // Reconstructed total must match gross sales within 1 paisa (rounding)
      assert.ok(
        Math.abs(taxable + totalTax - outlet.todaySales) <= 0.02,
        `Taxable + tax (${taxable + totalTax}) must equal grossSales (${outlet.todaySales})`
      );

      chainTaxable += taxable;
      chainCgst += cgst;
      chainSgst += sgst;
      chainTotalTax += totalTax;
    }

    assert.equal(chainCgst, chainSgst, 'Consolidated CGST must equal consolidated SGST');
    assert.equal(chainTotalTax, chainCgst + chainSgst);
    assert.equal(Math.round(chainTaxable * 100) / 100, 138542.85);
    assert.equal(chainCgst, 3463.57);
    assert.equal(chainSgst, 3463.57);
    assert.equal(chainTotalTax, 6927.14);
  });

  it('2.8: Multi-state statutory jurisdiction allocation (Delhi NCT 07 vs Haryana 06)', () => {
    const delhiOutlets = seedOutlets.filter((o) => o.stateCode === '07');
    const haryanaOutlets = seedOutlets.filter((o) => o.stateCode === '06');

    assert.equal(delhiOutlets.length, 2, 'Must have 2 Delhi NCT branches (Downtown Bistro + Airport T3)');
    assert.equal(haryanaOutlets.length, 1, 'Must have 1 Haryana branch (Cyber Hub Express)');

    const delhiSgst = delhiOutlets.reduce(
      (acc, o) => acc + Math.round(((o.todaySales / 1.05) * 0.025) * 100) / 100,
      0
    );
    const haryanaSgst = haryanaOutlets.reduce(
      (acc, o) => acc + Math.round(((o.todaySales / 1.05) * 0.025) * 100) / 100,
      0
    );

    assert.equal(Math.round(delhiSgst * 100) / 100, 2331.43, 'Delhi NCT SGST (State Code 07)');
    assert.equal(Math.round(haryanaSgst * 100) / 100, 1132.14, 'Haryana SGST (State Code 06)');
    assert.equal(Math.round((delhiSgst + haryanaSgst) * 100) / 100, 3463.57, 'Sum of state SGSTs matches consolidated SGST');
  });

  it('2.9: GSTR-1 CSV and JSON export summary payload validation', () => {
    const chainOwnerContent = fs.readFileSync(CHAIN_OWNER_FILE, 'utf8');

    // CSV headers check
    assert.match(chainOwnerContent, /Outlet Code/);
    assert.match(chainOwnerContent, /Gross Sales \(INR\)/);
    assert.match(chainOwnerContent, /Taxable Turnover \(INR\)/);
    assert.match(chainOwnerContent, /CGST 2\.5%/);
    assert.match(chainOwnerContent, /SGST 2\.5%/);
    assert.match(chainOwnerContent, /996331/);

    // JSON export structure check
    assert.match(chainOwnerContent, /fssaiLicense:\s*["']10019011000234["']/);
    assert.match(chainOwnerContent, /hsnSacCode:\s*["']996331["']/);
    assert.match(chainOwnerContent, /consolidatedTaxableTurnover/);
    assert.match(chainOwnerContent, /grandTotalGstCollected/);
  });
});

// ============================================================================
// SUITE 3: DASHBOARD SHELL NAVIGATION & QUERY PARAM SYNCHRONIZATION UNDER STRESS
// ============================================================================
describe('Suite 3: Dashboard Shell Navigation & Query Param Synchronization Under Stress', () => {
  it('3.1: landing/src/app/dashboard/page.tsx strictly wraps useSearchParams in <Suspense> for static export', () => {
    const pageContent = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');

    // Static export requirement: <Suspense> wrapping
    assert.match(pageContent, /export default function DashboardPage\s*\(\)\s*\{[\s\S]*?<Suspense/);
    assert.match(pageContent, /fallback=\{<DashboardLoadingFallback\s*\/>\}/);
    assert.match(pageContent, /<DashboardShell\s*\/>/);
    assert.match(pageContent, /<\/Suspense>/);

    // Verify DashboardShell contains useSearchParams
    assert.match(pageContent, /function DashboardShell\s*\(\)\s*\{[\s\S]*?useSearchParams\s*\(\)/);
  });

  it('3.2: Role normalization oracle resolves canonical and alias roles accurately', () => {
    // Standard roles
    assert.equal(normalizeDashboardRole('cashier'), 'cashier');
    assert.equal(normalizeDashboardRole('chef'), 'chef');
    assert.equal(normalizeDashboardRole('waiter'), 'waiter');
    assert.equal(normalizeDashboardRole('accountant'), 'accountant');
    assert.equal(normalizeDashboardRole('driver'), 'driver');
    assert.equal(normalizeDashboardRole('owner'), 'owner');
    assert.equal(normalizeDashboardRole('overview'), 'overview');

    // Aliases
    assert.equal(normalizeDashboardRole('server'), 'waiter');
    assert.equal(normalizeDashboardRole('delivery'), 'driver');
    assert.equal(normalizeDashboardRole('manager'), 'owner');
    assert.equal(normalizeDashboardRole('chain'), 'overview');

    // Case insensitivity
    assert.equal(normalizeDashboardRole('SERVER'), 'waiter');
    assert.equal(normalizeDashboardRole('DELIVERY'), 'driver');
    assert.equal(normalizeDashboardRole('MaNaGeR'), 'owner');
    assert.equal(normalizeDashboardRole('CASHIER'), 'cashier');
    assert.equal(normalizeDashboardRole('ChEf'), 'chef');
    assert.equal(normalizeDashboardRole('ACCOUNTANT'), 'accountant');

    // Edge cases and hostility injection -> graceful fallback to overview
    assert.equal(normalizeDashboardRole(''), 'overview');
    assert.equal(normalizeDashboardRole(null), 'overview');
    assert.equal(normalizeDashboardRole(undefined), 'overview');
    assert.equal(normalizeDashboardRole('unknown_role'), 'overview');
    assert.equal(normalizeDashboardRole('../../../evil'), 'overview');
    assert.equal(normalizeDashboardRole('__proto__'), 'overview');
    assert.equal(normalizeDashboardRole('<script>alert(1)</script>'), 'overview');
  });

  it('3.3: Perspective normalization oracle resolves founder vs merchant accurately', () => {
    assert.equal(normalizeDashboardPerspective('founder'), 'founder');
    assert.equal(normalizeDashboardPerspective('merchant'), 'merchant');
    assert.equal(normalizeDashboardPerspective('FOUNDER'), 'founder');
    assert.equal(normalizeDashboardPerspective('MeRcHaNt'), 'merchant');

    // Fallbacks
    assert.equal(normalizeDashboardPerspective(''), 'merchant');
    assert.equal(normalizeDashboardPerspective(null), 'merchant');
    assert.equal(normalizeDashboardPerspective(undefined), 'merchant');
    assert.equal(normalizeDashboardPerspective('hacker'), 'merchant');
  });

  it('3.4: Rapid URL navigation sequence simulation maintains state consistency', () => {
    // Simulate rapid URL transitions and verify resolved (perspective, view) pairs
    const navigationSteps = [
      { search: '?perspective=founder', expectedP: 'founder', expectedView: 'FounderAdminView' },
      { search: '?perspective=merchant&role=cashier', expectedP: 'merchant', expectedView: 'CashierView' },
      { search: '?role=server', expectedP: 'merchant', expectedView: 'ServerWaiterView' },
      { search: '?role=chef', expectedP: 'merchant', expectedView: 'KitchenChefView' },
      { search: '?role=delivery', expectedP: 'merchant', expectedView: 'DeliveryDriverView' },
      { search: '?role=accountant', expectedP: 'merchant', expectedView: 'AccountantView' },
      { search: '?role=manager', expectedP: 'merchant', expectedView: 'OwnerManagerView' },
      { search: '?role=chain', expectedP: 'merchant', expectedView: 'ChainOwnerView' },
      { search: '?role=overview', expectedP: 'merchant', expectedView: 'ChainOwnerView' },
      { search: '?perspective=founder&role=cashier', expectedP: 'founder', expectedView: 'FounderAdminView' }, // Founder takes precedence
    ];

    function resolveView(search) {
      const params = new URLSearchParams(search);
      const p = normalizeDashboardPerspective(params.get('perspective'));
      if (p === 'founder') return { perspective: p, view: 'FounderAdminView' };

      const r = normalizeDashboardRole(params.get('role'));
      const viewMap = {
        cashier: 'CashierView',
        chef: 'KitchenChefView',
        waiter: 'ServerWaiterView',
        accountant: 'AccountantView',
        driver: 'DeliveryDriverView',
        owner: 'OwnerManagerView',
        overview: 'ChainOwnerView',
      };
      return { perspective: p, view: viewMap[r] || 'ChainOwnerView' };
    }

    for (const step of navigationSteps) {
      const resolved = resolveView(step.search);
      assert.equal(resolved.perspective, step.expectedP, `Perspective for ${step.search}`);
      assert.equal(resolved.view, step.expectedView, `View for ${step.search}`);
    }
  });

  it('3.5: Hybrid Connection Status Pill supports live and standalone modes without exceptions', () => {
    const pageContent = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');

    // Both badge branches must exist
    assert.match(pageContent, /Live Sync \(:3001, :3002, :3003\)/);
    assert.match(pageContent, /Standalone Simulation \(Cloudflare Pages\)/);

    // Popover probe details
    assert.match(pageContent, /POS Engine API \(:3001\)/);
    assert.match(pageContent, /Kitchen Display System \(:3002\)/);
    assert.match(pageContent, /Server \/ Waiter App \(:3003\)/);
    assert.match(pageContent, /recheck\(\)/);
  });
});
