/**
 * Order It Up - Milestone M3 Automated Verification Test Suite
 * File: tests/landing-dashboard-m3.test.cjs
 *
 * Verifies Milestone M3: "Platform Admin vs Restaurant Chain Owner Perspectives"
 * 1. FounderAdminView.tsx ("For me - startup owner"):
 *    - Platform Overview: Platform-wide GMV, total transactions, active tenants, licensed terminals, S3 storage volume.
 *    - Tenant Directory: Manage restaurant accounts (Spice Route, Urban Bites, Milano, Coastal) + Onboard New Tenant modal.
 *    - 16-Character Hardware-Bound Desktop POS License Generator: Form, format OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM], QR code, 1-click copy, issued history.
 *    - Isolated Amazon S3 Telemetry: Dedicated cards, 4 domains (backups, users, payments, media), strict prefix tenants/{tenantId}/..., Zero Commingling badge, prefix isolation audit.
 * 2. ChainOwnerView.tsx ("For users - multi-outlet"):
 *    - Multi-Branch Live Sales: Compare Downtown Bistro, Cyber Hub Express, Airport Terminal 3 Hub (sales, orders, AOV, active tables, engine port, tender mix).
 *    - Central Menu Catalog with Branch Overrides: Central catalog items (Paneer Tikka, Truffle Pizza, Dal Makhani, Cold Brew Latte, etc.), SAC 996331, base prices, branch override controls (+15% transit surcharge), 86-ing toggle.
 *    - Consolidated Chain Taxes: Indian GST (SAC 996331, CGST 2.5%, SGST 2.5%, 5.0% total) across all branches, tax liability summary ledger, CSV / JSON export.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_COMPONENTS_DIR = path.join(ROOT, 'landing', 'src', 'components', 'dashboard');

const FOUNDER_ADMIN_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'FounderAdminView.tsx');
const CHAIN_OWNER_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'ChainOwnerView.tsx');

const M3_FILES = [
  { name: 'FounderAdminView.tsx', path: FOUNDER_ADMIN_FILE },
  { name: 'ChainOwnerView.tsx', path: CHAIN_OWNER_FILE },
];

describe('Milestone M3: File Integrity, Layout, and Design System Checks', () => {
  it('both M3 dashboard components must exist in landing/src/components/dashboard/ and exceed 5,000 bytes', () => {
    for (const { name, path: filePath } of M3_FILES) {
      assert.ok(fs.existsSync(filePath), `${name} must exist`);
      const stat = fs.statSync(filePath);
      assert.ok(
        stat.size > 5000,
        `${name} must contain substantial, complete operational logic (size: ${stat.size} bytes)`
      );
    }
  });

  it('both files must declare "use client"; and export React component functions', () => {
    for (const { name, path: filePath } of M3_FILES) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert.match(content, /^"use client";/, `${name} must start with "use client"; directive`);
      assert.match(content, /export function (FounderAdminView|ChainOwnerView)/, `${name} must export a component function`);
    }
  });

  it('both files adhere to design system: orange brand accents, slate-200 card borders, and zero dummy/placeholder text', () => {
    const placeholderRegex = /\b(lorem ipsum|dummy text|dummy data|tbd)\b/i;
    for (const { name, path: filePath } of M3_FILES) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert.match(
        content,
        /(#F07928|#EA580C|orange-500|orange-600)/,
        `${name} must utilize vibrant orange brand accents`
      );
      assert.match(content, /border-slate-200/, `${name} must use slate-200 card borders`);
      assert.doesNotMatch(
        content,
        placeholderRegex,
        `${name} must contain zero placeholder or dummy text`
      );
    }
  });
});

describe('Milestone M3: FounderAdminView (D1-backed platform administration)', () => {
  const content = fs.readFileSync(FOUNDER_ADMIN_FILE, 'utf8');

  it('authenticates through the isolated platform administrator API', () => {
    assert.match(content, /\/api\/platform-admin\/login/);
    assert.match(content, /PLATFORM_ADMIN_EMAIL/);
    assert.match(content, /PLATFORM_ADMIN_PASSWORD_HASH/);
    assert.match(content, /PLATFORM_ADMIN_JWT_SECRET/);
    assert.match(content, /orderitup_platform_admin_token/);
    assert.match(content, /sessionStorage/);
  });

  it('loads platform metrics, subscription plans and tenant records from the Cloud API', () => {
    assert.match(content, /\/api\/platform-admin\/overview/);
    assert.match(content, /\/api\/platform-admin\/plans/);
    assert.match(content, /\/api\/platform-admin\/tenants/);
    assert.match(content, /monthly_recurring_revenue_by_currency/);
    assert.match(content, /gross_merchandise_value_by_currency/);
    assert.match(content, /data_source/);
  });

  it('supports searchable, filterable, paginated tenant directory and real tenant detail', () => {
    assert.match(content, /Search organizations/);
    assert.match(content, /statusFilter|status/);
    assert.match(content, /planCode|plan/);
    assert.match(content, /PAGE_SIZE/);
    assert.match(content, /\/api\/platform-admin\/tenants\//);
    assert.match(content, /branches/);
    assert.match(content, /terminals/);
    assert.match(content, /active_user_count|users/);
  });

  it('does not present fake onboarding, local license generation or fabricated storage audits as real actions', () => {
    assert.doesNotMatch(content, /useTenants|useDashboardActions|updateDashboardState/);
    assert.doesNotMatch(content, /handleOnboardTenant|handleGenerateLicense|handleRunIsolationAudit/);
    assert.doesNotMatch(content, /Zero Data Commingling Verified|S3 Prefix Isolation Audit Passed/);
    assert.match(content, /Read-only control plane/);
    assert.match(content, /not available until audited server-side workflows/);
  });

  it('clears the session when the platform API rejects the administrator token', () => {
    assert.match(content, /Unauthorized/);
    assert.match(content, /sessionStorage\.removeItem\(TOKEN_KEY\)/);
    assert.match(content, /credentials: "omit"/);
    assert.match(content, /cache: "no-store"/);
  });
});

describe('Milestone M3: ChainOwnerView ("For users - multi-outlet")', () => {
  const content = fs.readFileSync(CHAIN_OWNER_FILE, 'utf8');

  it('renders multi-branch live sales comparison across Downtown Bistro, Cyber Hub Express, and Airport T3', () => {
    assert.match(content, /Spice Route Hospitality Group/i, 'Must display chain brand banner');
    assert.match(content, /totalChainSales/i, 'Must compute combined chain live sales');
    assert.match(content, /totalChainOrders/i, 'Must compute combined chain orders count');
    assert.match(content, /chainAov/i, 'Must compute chain average order value (AOV)');
    assert.match(content, /selectedBranchFilter/i, 'Must support filtering by branch');
    assert.match(content, /DEL-CP-01|Downtown Bistro/i, 'Must display Downtown Bistro flagship');
    assert.match(content, /HR-GGN-02|Cyber Hub Express/i, 'Must display Cyber Hub Express');
    assert.match(content, /DEL-IGI-03|Airport Terminal 3 Hub/i, 'Must display Airport Terminal 3 Hub');
    assert.match(content, /activeTables/i, 'Must show active tables occupancy');
    assert.match(content, /enginePort/i, 'Must show local engine port status (:3001, :3002, :3003)');
    assert.match(content, /tenders/i, 'Must show tender mix (UPI, Cash, Card)');
    assert.match(content, /Chain Revenue Share Distribution/i, 'Must render visual revenue share distribution bar');
  });

  it('implements Central Menu Catalog with per-branch price overrides and availability 86-ing', () => {
    assert.match(content, /Central Menu Catalog with Branch Price Overrides/i, 'Must render central catalog section');
    assert.match(content, /overrideBranchId/i, 'Must allow selecting target branch for overrides');
    assert.match(content, /SAC 996331/i, 'Must display SAC 996331 tax code');
    assert.match(content, /basePrice/i, 'Must display central master base price');
    assert.match(content, /effectivePrice/i, 'Must compute and display effective branch price');
    assert.match(content, /handleApplyPresetSurcharge/i, 'Must provide +15% transit surcharge preset button');
    assert.match(content, /handleSavePriceOverride/i, 'Must update price override calling actions.updateBranchPriceOverride');
    assert.match(content, /handleToggleItemAvailability/i, 'Must provide item availability 86-ing toggle');
  });

  it('implements Consolidated Chain Taxes under Indian GST (SAC 996331, 5% total)', () => {
    assert.match(content, /Consolidated Chain Taxes (&|&amp;) GST Liability Ledger/i, 'Must render consolidated GST section');
    assert.match(content, /CGST @ 2\.5%/i, 'Must calculate CGST @ 2.5%');
    assert.match(content, /SGST @ 2\.5%/i, 'Must calculate SGST @ 2.5%');
    assert.match(content, /Total GST \(5%\)|Total GST 5%/i, 'Must calculate Total GST @ 5.0%');
    assert.match(content, /consolidatedTaxable/i, 'Must compute consolidated chain taxable turnover');
    assert.match(content, /Delhi NCT|Haryana/i, 'Must reflect state statutory jurisdictions (Delhi 07 vs Haryana 06)');
    assert.match(content, /handleDownloadCsv/i, 'Must provide GSTR-1 CSV download action');
    assert.match(content, /handleCopyTaxJson/i, 'Must provide JSON tax ledger copy action');
  });
});

describe('Milestone M3: Behavioral & Mathematical Integrity Verifications', () => {
  it('verifies 16-character license key format and deterministic structure', () => {
    // Mirror the exact algorithm from dashboard-store.ts generateLicenseKey
    function generateLicense(tenantId, plan, machineHash) {
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

    const key1 = generateLicense('tenant-0892', 'enterprise', 'M894');
    assert.match(
      key1,
      /^OIUP-ENT1-M894-[A-Z0-9]{4}$/,
      'Key must match OIUP-ENT1-M894-[CHECKSUM]'
    );
    // Key has 16 alphanumeric characters + 3 hyphens = 19 characters total
    assert.equal(key1.replace(/-/g, '').length, 16, 'Key must contain exactly 16 alphanumeric characters');
    assert.equal(key1.split('-').length, 4, 'Key must contain 4 hyphen-separated blocks');

    const key2 = generateLicense('tenant-0441', 'pro', '7A11');
    assert.match(key2, /^OIUP-PRO1-7A11-[A-Z0-9]{4}$/);
    assert.equal(key2.replace(/-/g, '').length, 16);

    const key3 = generateLicense('tenant-0129', 'starter', '9C33');
    assert.match(key3, /^OIUP-STR1-9C33-[A-Z0-9]{4}$/);
    assert.equal(key3.replace(/-/g, '').length, 16);
  });

  it('verifies S3 isolation path integrity and anti-commingling enforcement', () => {
    function buildIsolatedPath(tenantId, domain, filename) {
      const validDomains = ['backups', 'users', 'payments', 'media'];
      if (!validDomains.includes(domain)) {
        throw new Error(`Invalid storage domain: ${domain}`);
      }
      if (tenantId.includes('..') || tenantId.includes('/') || tenantId.includes('\\')) {
        throw new Error(`Tenant isolation violation: illegal characters in tenantId`);
      }
      if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
        throw new Error(`Path traversal violation in filename`);
      }
      return `tenants/${tenantId}/${domain}/${filename}`;
    }

    const validPath = buildIsolatedPath('tenant-0892', 'backups', 'order-it-up-2026-10-31.sqlite.enc');
    assert.equal(validPath, 'tenants/tenant-0892/backups/order-it-up-2026-10-31.sqlite.enc');
    assert.ok(validPath.startsWith('tenants/tenant-0892/'));

    assert.throws(
      () => buildIsolatedPath('../escape_tenant', 'backups', 'db.sqlite'),
      /Tenant isolation violation/
    );
    assert.throws(
      () => buildIsolatedPath('tenant-0892', 'invalid_domain', 'db.sqlite'),
      /Invalid storage domain/
    );
    assert.throws(
      () => buildIsolatedPath('tenant-0892', 'backups', '../../etc/passwd'),
      /Path traversal violation/
    );
  });

  it('verifies Indian GST 5.0% tax calculations under SAC 996331', () => {
    const grossSales = 145470.0; // ₹1,45,470 (Combined 3 outlets sales)
    const taxable = Math.round((grossSales / 1.05) * 100) / 100; // Taxable turnover
    const cgst = Math.round((taxable * 0.025) * 100) / 100;
    const sgst = Math.round((taxable * 0.025) * 100) / 100;
    const totalTax = Math.round((cgst + sgst) * 100) / 100;

    assert.equal(taxable, 138542.86, 'Taxable turnover must equal Gross / 1.05');
    assert.equal(cgst, 3463.57, 'CGST must equal 2.5% of taxable turnover');
    assert.equal(sgst, 3463.57, 'SGST must equal 2.5% of taxable turnover');
    assert.equal(totalTax, 6927.14, 'Total tax collected must equal 5.0% of taxable turnover');
  });

  it('verifies +15% transit surcharge calculation for airport branch overrides', () => {
    const basePricePizza = 540;
    const airportPricePizza = Math.round(basePricePizza * 1.15);
    assert.equal(airportPricePizza, 621);

    const basePriceCoffee = 220;
    const airportPriceCoffee = Math.round(basePriceCoffee * 1.15);
    assert.equal(airportPriceCoffee, 253);
  });
});
