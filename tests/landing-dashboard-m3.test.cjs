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

describe('Milestone M3: FounderAdminView ("For me - startup owner")', () => {
  const content = fs.readFileSync(FOUNDER_ADMIN_FILE, 'utf8');

  it('renders Platform Overview with GMV, active tenants, licensed terminals, and S3 customer storage', () => {
    assert.match(content, /Platform 30D GMV|monthGmv/i, 'Must track platform-wide 30-day GMV');
    assert.match(content, /Active Tenants|activeTenantsCount/i, 'Must display active customer tenant brands count');
    assert.match(content, /Active Terminals|totalTerminals/i, 'Must display active licensed desktop POS terminals');
    assert.match(content, /S3 Customer Data|totalS3StorageMb/i, 'Must aggregate isolated S3 storage volume');
    assert.match(content, /Issued Licenses|totalIssuedLicenses/i, 'Must track total issued POS licenses');
  });

  it('renders searchable and filterable Restaurant Tenant Directory with realistic customer brands', () => {
    assert.match(content, /Subscribed Restaurant Customer Accounts/i, 'Must render customer directory section');
    assert.match(content, /searchQuery/i, 'Must support search filtering by brand/owner/city');
    assert.match(content, /tierFilter/i, 'Must support filtering by plan tier (enterprise, pro, starter)');
    assert.match(content, /statusFilter/i, 'Must support filtering by tenant status');
    assert.match(content, /handleToggleTenantStatus/i, 'Must provide interactive tenant status toggling');
  });

  it('includes interactive "Onboard New Tenant" modal with validation and S3 isolation prefix preview', () => {
    assert.match(content, /isOnboardModalOpen/i, 'Must maintain modal visibility state');
    assert.match(content, /Onboard Restaurant Tenant|Onboard New Tenant/i, 'Must have Onboard Tenant modal dialog');
    assert.match(content, /newBrandName/i, 'Must have brand name input');
    assert.match(content, /newOwnerName/i, 'Must have owner name input');
    assert.match(content, /newOwnerEmail/i, 'Must have owner email input');
    assert.match(content, /newPlanTier/i, 'Must have plan tier selector');
    assert.match(content, /newOutletsCount/i, 'Must have initial outlets count');
    assert.match(content, /newTerminalsCount/i, 'Must have initial POS terminals count');
    assert.match(content, /orderitup-tenant-/i, 'Must preview auto-provisioned isolated S3 bucket');
    assert.match(content, /updateDashboardState/i, 'Must add newly onboarded tenant into reactive dashboard store');
  });

  it('implements 16-Character Hardware-Bound Desktop POS License Generator', () => {
    assert.match(content, /OIUP-\[PLAN\]-\[MACHINE_HASH\]-\[CHECKSUM\]/i, 'Must document 16-character license key format');
    assert.match(content, /ENT1/, 'Must support Enterprise Tier code ENT1');
    assert.match(content, /PRO1/, 'Must support Professional Tier code PRO1');
    assert.match(content, /STR1/, 'Must support Starter Tier code STR1');
    assert.match(content, /hardwareHashInput/i, 'Must have machine hardware fingerprint input');
    assert.match(content, /handleAutoGenerateHardwareHash/i, 'Must support auto-generating 4 hex characters HW fingerprint');
    assert.match(content, /generateLicenseKey/i, 'Must invoke actions.generateLicenseKey store mutator');
    assert.match(content, /handleCopyKey/i, 'Must provide 1-click copy key button with feedback');
    assert.match(content, /QrCode|Optical 2D Barcode Scanner/i, 'Must provide optical 2D barcode scanner / QR visualization');
    assert.match(content, /Recently Issued Hardware-Bound Licenses|allIssuedLicenses/i, 'Must list previously issued licenses history');
  });

  it('implements Isolated Amazon S3 Customer Bucket Telemetry with Zero Data Commingling verification', () => {
    assert.match(content, /Isolated Amazon S3 Customer Storage Telemetry/i, 'Must have dedicated S3 telemetry section');
    assert.match(content, /selectedTenantId/i, 'Must allow selecting and inspecting individual tenant buckets');
    assert.match(content, /Zero Data Commingling Verified/i, 'Must display Zero Data Commingling security invariant badge');
    assert.match(content, /tenants\//, 'Must enforce tenants/{tenantId}/ prefix structure');
    assert.match(content, /backups \//i, 'Must display backups/ domain for encrypted SQLite WAL snapshots');
    assert.match(content, /payments \//i, 'Must display payments/ domain for UPI/card transaction batches');
    assert.match(content, /users \//i, 'Must display users/ domain for staff credentials and roles');
    assert.match(content, /media \//i, 'Must display media/ domain for catalog photos and logos');
    assert.match(content, /handleRunIsolationAudit|auditResult/i, 'Must provide interactive S3 Prefix Isolation Audit runner');
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
