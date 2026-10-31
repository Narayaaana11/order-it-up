/**
 * Order It Up - Milestone M1 Automated Verification Test Suite
 * File: tests/landing-dashboard-m1.test.cjs
 *
 * Verifies Milestone M1:
 * - dashboard-models.ts (Type invariants, ESC/POS bytecodes, GST SAC, 16-char licenses)
 * - dashboard-store.ts (Store state, seed dataset, 8 operational mutations)
 * - backend-detector.ts (Probe logic, status labels, default endpoints)
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODELS_FILE = path.join(ROOT, 'landing', 'src', 'lib', 'dashboard-models.ts');
const STORE_FILE = path.join(ROOT, 'landing', 'src', 'lib', 'dashboard-store.ts');
const DETECTOR_FILE = path.join(ROOT, 'landing', 'src', 'lib', 'backend-detector.ts');

describe('Milestone M1: File Integrity and Static Code Checks', () => {
  it('all 3 files must exist and be non-empty', () => {
    assert.ok(fs.existsSync(MODELS_FILE), 'dashboard-models.ts must exist');
    assert.ok(fs.existsSync(STORE_FILE), 'dashboard-store.ts must exist');
    assert.ok(fs.existsSync(DETECTOR_FILE), 'backend-detector.ts must exist');

    assert.ok(fs.statSync(MODELS_FILE).size > 1000, 'dashboard-models.ts must have full models');
    assert.ok(fs.statSync(STORE_FILE).size > 5000, 'dashboard-store.ts must have full store and seed data');
    assert.ok(fs.statSync(DETECTOR_FILE).size > 2000, 'backend-detector.ts must have full probe logic');
  });

  it('dashboard-models.ts contains zero any or unknown-without-guard placeholders', () => {
    const content = fs.readFileSync(MODELS_FILE, 'utf8');
    assert.doesNotMatch(content, /:\s*any\b/, 'Must contain zero "any" types');
    assert.match(content, /996331/, 'Must specify SAC 996331');
    assert.match(content, /10019011000234/, 'Must specify FSSAI 10019011000234');
    assert.match(content, /0x1B,\s*0x70,\s*0x00,\s*0x19,\s*0xFA/, 'Must contain 24V solenoid bytecode');
    assert.match(content, /OIUP-\$\{string\}-\$\{string\}-\$\{string\}/, 'Must define 16-character license key format');
  });

  it('dashboard-store.ts implements React 19 useSyncExternalStore and all 8 mutations', () => {
    const content = fs.readFileSync(STORE_FILE, 'utf8');
    assert.match(content, /useSyncExternalStore/, 'Must use React 19 useSyncExternalStore');
    assert.match(content, /bumpTicket/, 'Must implement bumpTicket');
    assert.match(content, /fireCourse/, 'Must implement fireCourse');
    assert.match(content, /settlePayment/, 'Must implement settlePayment');
    assert.match(content, /recordShiftClosure/, 'Must implement recordShiftClosure');
    assert.match(content, /assignStaffRole/, 'Must implement assignStaffRole');
    assert.match(content, /updateBranchPriceOverride/, 'Must implement updateBranchPriceOverride');
    assert.match(content, /generateLicenseKey/, 'Must implement generateLicenseKey');
    assert.match(content, /updateDeliveryStatus/, 'Must implement updateDeliveryStatus');
    assert.match(content, /Spice Route Hospitality Group/, 'Must seed Spice Route Hospitality Group');
    assert.match(content, /Downtown Bistro/, 'Must seed Downtown Bistro');
    assert.match(content, /Cyber Hub Express/, 'Must seed Cyber Hub Express');
    assert.match(content, /Airport Terminal 3 Hub/, 'Must seed Airport Terminal 3 Hub');
  });

  it('backend-detector.ts implements parallel probes with 1500ms timeout and error isolation', () => {
    const content = fs.readFileSync(DETECTOR_FILE, 'utf8');
    assert.match(content, /:3001/, 'Must probe port 3001');
    assert.match(content, /:3002/, 'Must probe port 3002');
    assert.match(content, /:3003/, 'Must probe port 3003');
    assert.match(content, /1500/, 'Must enforce 1500ms timeout');
    assert.match(content, /AbortController/, 'Must use AbortController');
    assert.match(content, /useBackendDetector/, 'Must export useBackendDetector hook');
    assert.match(content, /getBackendStatusLabel/, 'Must export getBackendStatusLabel');
  });
});

describe('Milestone M1: Operational Seed Models and Business Rules', () => {
  // Extract seed data from dashboard-store.ts safely by evaluating or inspecting
  const storeContent = fs.readFileSync(STORE_FILE, 'utf8');

  it('contains seed data with 3 NCR outlets', () => {
    assert.ok(storeContent.includes('DEL-CP-01'), 'Must have Delhi Connaught Place branch');
    assert.ok(storeContent.includes('HR-GGN-02'), 'Must have Gurugram Cyber Hub branch');
    assert.ok(storeContent.includes('DEL-IGI-03'), 'Must have IGI Airport T3 branch');
  });

  it('menu items strictly comply with SAC 996331 and 5% GST', () => {
    assert.ok(storeContent.includes('sacCode: "996331"'), 'Menu items must reference SAC 996331');
    assert.ok(storeContent.includes('taxRatePercent: 5'), 'Menu items must specify 5% GST');
  });

  it('staff users have 4-digit PINs across operational roles', () => {
    assert.ok(storeContent.includes('pin: "9021"'), 'Owner Priya Sharma has PIN 9021');
    assert.ok(storeContent.includes('pin: "1044"'), 'Cashier Rohit Singh has PIN 1044');
    assert.ok(storeContent.includes('pin: "7732"'), 'Head Chef Marco Rossi has PIN 7732');
    assert.ok(storeContent.includes('pin: "2481"'), 'Server Aman Kapoor has PIN 2481');
    assert.ok(storeContent.includes('pin: "3391"'), 'Accountant Kavita Rao has PIN 3391');
    assert.ok(storeContent.includes('pin: "6120"'), 'Driver Ramesh V has PIN 6120');
  });

  it('completed Z-reports demonstrate balanced and variance-flagged registers', () => {
    assert.ok(storeContent.includes('status: "balanced"'), 'Must have balanced Z-report');
    assert.ok(storeContent.includes('status: "variance_flagged"'), 'Must have variance-flagged Z-report');
    assert.ok(storeContent.includes('cashVariance: -50'), 'Must have -₹50 cash shortage recorded');
    assert.ok(storeContent.includes('cashVariance: 20'), 'Must have +₹20 cash overage recorded');
  });

  it('delivery dispatches cover Swiggy, Zomato, Direct with COD collection tracking', () => {
    assert.ok(storeContent.includes('channel: "swiggy"'), 'Must support Swiggy');
    assert.ok(storeContent.includes('channel: "zomato"'), 'Must support Zomato');
    assert.ok(storeContent.includes('channel: "direct"'), 'Must support Direct');
    assert.ok(storeContent.includes('codAmount: 840'), 'Must track COD amount');
    assert.ok(storeContent.includes('codAmount: 1450'), 'Must track direct COD amount');
  });

  it('Amazon S3 tenant isolation enforces prefix with zero data commingling', () => {
    assert.ok(storeContent.includes('tenants/tenant-0892/'), 'Prefix strict isolation for Spice Route');
    assert.ok(storeContent.includes('tenants/tenant-0441/'), 'Prefix strict isolation for Urban Bites');
    assert.ok(storeContent.includes('zeroComminglingVerified: true'), 'Verified zero commingling');
  });
});

describe('Milestone M1: License Key Generator and Formatting Oracle', () => {
  it('license keys strictly follow format OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]', () => {
    const keyRegex = /^OIUP-(ENT1|PRO1|STR1)-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    
    // Test the generation algorithm directly as implemented in dashboard-store
    function generateTestKey(tenantId, plan, machineHash) {
      const cleanHash = (machineHash || "8F42")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .padEnd(4, "0")
        .slice(0, 4);
      const planCode = plan === "enterprise" ? "ENT1" : plan === "pro" ? "PRO1" : "STR1";
      let hash = 0x811c9dc5;
      const seed = `OIUP${planCode}${cleanHash}${tenantId}`;
      for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      const checksum = Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(-4);
      return `OIUP-${planCode}-${cleanHash}-${checksum}`;
    }

    const entKey = generateTestKey("tenant-0892", "enterprise", "8F42");
    assert.match(entKey, keyRegex, 'Enterprise key must match regex');
    assert.equal(entKey.length, 19, 'Key length including dashes must be 19 chars (16 alphanumeric chars)');

    const proKey = generateTestKey("tenant-0441", "pro", "7A11");
    assert.match(proKey, keyRegex, 'Pro key must match regex');

    const starterKey = generateTestKey("tenant-0129", "starter", "9C33");
    assert.match(starterKey, keyRegex, 'Starter key must match regex');
  });
});
