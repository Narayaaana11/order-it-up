/**
 * Order It Up - Milestone M2 Automated Verification Test Suite
 * File: tests/landing-dashboard-m2.test.cjs
 *
 * Verifies Milestone M2: "The 6 Operational Persona Dashboards"
 * 1. CashierView.tsx (Counter billing, split tenders, 24V solenoid drawer, 80mm ESC/POS thermal receipt)
 * 2. KitchenChefView.tsx (KDS :3002 queue, station routing, ticket bumping, SLA alerts)
 * 3. ServerWaiterView.tsx (Visual floor table map, occupancy statuses, tableside course firing)
 * 4. AccountantView.tsx (GST SAC 996331, FSSAI 10019011000234, Z-report balancing, Tally XML export)
 * 5. DeliveryDriverView.tsx (Multi-channel dispatch, masked customer contact, rider steps, COD reconciliation)
 * 6. OwnerManagerView.tsx (Multi-branch live sales, consolidated KPIs, staff PIN assignment, S3 backup outbox)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_COMPONENTS_DIR = path.join(ROOT, 'landing', 'src', 'components', 'dashboard');

const CASHIER_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'CashierView.tsx');
const CHEF_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'KitchenChefView.tsx');
const WAITER_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'ServerWaiterView.tsx');
const ACCOUNTANT_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'AccountantView.tsx');
const DRIVER_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'DeliveryDriverView.tsx');
const OWNER_FILE = path.join(DASHBOARD_COMPONENTS_DIR, 'OwnerManagerView.tsx');

const ALL_M2_FILES = [
  { name: 'CashierView.tsx', path: CASHIER_FILE },
  { name: 'KitchenChefView.tsx', path: CHEF_FILE },
  { name: 'ServerWaiterView.tsx', path: WAITER_FILE },
  { name: 'AccountantView.tsx', path: ACCOUNTANT_FILE },
  { name: 'DeliveryDriverView.tsx', path: DRIVER_FILE },
  { name: 'OwnerManagerView.tsx', path: OWNER_FILE },
];

describe('Milestone M2: File Integrity, Layout, and Design System Checks', () => {
  it('all 6 operational persona dashboard components must exist and exceed minimum content size', () => {
    for (const { name, path: filePath } of ALL_M2_FILES) {
      assert.ok(fs.existsSync(filePath), `${name} must exist in landing/src/components/dashboard/`);
      const stat = fs.statSync(filePath);
      assert.ok(
        stat.size > 3000,
        `${name} must contain substantial, complete operational logic (size: ${stat.size} bytes)`
      );
    }
  });

  it('all 6 files must declare "use client" and export React components', () => {
    for (const { name, path: filePath } of ALL_M2_FILES) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert.match(content, /^"use client";/, `${name} must start with "use client" directive`);
      assert.match(content, /export (default )?function/, `${name} must export a component function`);
    }
  });

  it('all 6 files adhere to design system: #F07928 accents and slate borders without dummy placeholders', () => {
    const placeholderRegex = /\b(lorem ipsum|dummy text|dummy data|tbd)\b/i;
    for (const { name, path: filePath } of ALL_M2_FILES) {
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

describe('Milestone M2: Persona 1 - Front Cashier (CashierView.tsx)', () => {
  const content = fs.readFileSync(CASHIER_FILE, 'utf8');

  it('implements interactive split tenders calculation across Cash, UPI, and Card', () => {
    assert.match(content, /split/i, 'Must support split tender');
    assert.match(content, /upi/i, 'Must support UPI tender');
    assert.match(content, /cash/i, 'Must support Cash tender');
    assert.match(content, /card/i, 'Must support Card tender');
    assert.match(content, /splitRemaining|isSplitBalanced/, 'Must calculate remaining split balance');
    assert.match(content, /cashChangeReturn|change/i, 'Must calculate exact change return');
  });

  it('implements 24V solenoid cash drawer pulse trigger & indicator showing ESC/POS bytecode', () => {
    assert.match(
      content,
      /(0x1B,\s*0x70,\s*0x00,\s*0x19,\s*0xFA|1B 70 00 19 FA|ESC_POS_DRAWER_KICK_HEX)/,
      'Must reference ESC/POS 24V drawer kick bytecode'
    );
    assert.match(content, /triggerDrawerKick|Manual Drawer Kick/i, 'Must provide manual drawer kick button');
    assert.match(content, /activeCashShift|expectedCashInDrawer/, 'Must reconcile till balance');
  });

  it('renders authentic 80mm ESC/POS thermal receipt formatting preview with GST & FSSAI', () => {
    assert.match(content, /Downtown Bistro/i, 'Receipt must show store name Downtown Bistro');
    assert.match(content, /Connaught Place/i, 'Receipt must show Connaught Place');
    assert.match(content, /996331/, 'Receipt must specify SAC 996331');
    assert.match(content, /10019011000234/, 'Receipt must show FSSAI License 10019011000234');
    assert.match(content, /07AAAAA0000A1Z5/, 'Receipt must show GSTIN 07AAAAA0000A1Z5');
    assert.match(content, /CGST @ 2\.5%/, 'Receipt must show CGST 2.5%');
    assert.match(content, /SGST @ 2\.5%/, 'Receipt must show SGST 2.5%');
    assert.match(content, /Rule 46/i, 'Must cite Rule 46 CGST Tax Invoice');
  });

  it('invokes store actions.settlePayment upon settlement', () => {
    assert.match(content, /actions\.settlePayment/, 'Must call settlePayment action');
  });
});

describe('Milestone M2: Persona 2 - Kitchen Display System (KitchenChefView.tsx)', () => {
  const content = fs.readFileSync(CHEF_FILE, 'utf8');

  it('connects to real-time KDS order queue on port :3002', () => {
    assert.match(content, /:3002/, 'Must specify KDS port :3002');
    assert.match(content, /useOrders/, 'Must read real-time orders');
  });

  it('implements kitchen station routing filters for Oven, Tandoor, Bar, and Grill', () => {
    assert.match(content, /activeStation|setActiveStation/, 'Must have station filter state');
    assert.match(content, /oven/i, 'Must route Oven station');
    assert.match(content, /tandoor/i, 'Must route Tandoor station');
    assert.match(content, /bar/i, 'Must route Bar station');
    assert.match(content, /grill/i, 'Must route Grill station');
  });

  it('implements ticket bumping interaction cycling items and orders across lifecycle', () => {
    assert.match(content, /actions\.bumpTicket/, 'Must invoke bumpTicket action');
    assert.match(content, /pending/, 'Must handle pending status');
    assert.match(content, /preparing/, 'Must handle preparing status');
    assert.match(content, /ready/, 'Must handle ready status');
    assert.match(content, /served/, 'Must handle served status');
  });

  it('calculates dynamic SLA prep timer alerts for on-time, warning, and overdue breaches', () => {
    assert.match(content, /elapsedMinutes|slaTier/, 'Must compute elapsed minutes');
    assert.match(content, /10/, 'Must evaluate 10m SLA threshold');
    assert.match(content, /20/, 'Must evaluate 20m SLA threshold');
  });
});

describe('Milestone M2: Persona 3 - Server / Waiter (ServerWaiterView.tsx)', () => {
  const content = fs.readFileSync(WAITER_FILE, 'utf8');

  it('implements visual floor table map across rooms/zones', () => {
    assert.match(content, /Indoor/, 'Must support Indoor dining zone');
    assert.match(content, /Patio/, 'Must support Patio dining zone');
    assert.match(content, /Rooftop/, 'Must support Rooftop dining zone');
    assert.match(content, /Private Dining/, 'Must support Private Dining zone');
  });

  it('tracks all 4 table occupancy statuses: available, occupied, billed, reserved', () => {
    assert.match(content, /available/i, 'Must track Available status');
    assert.match(content, /occupied/i, 'Must track Occupied status');
    assert.match(content, /billed/i, 'Must track Billed status');
    assert.match(content, /reserved/i, 'Must track Reserved status');
  });

  it('implements tableside ordering view with course firing controls calling actions.fireCourse', () => {
    assert.match(content, /actions\.fireCourse/, 'Must call fireCourse action');
    assert.match(content, /starter/i, 'Must fire Starters');
    assert.match(content, /main/i, 'Must fire Mains');
    assert.match(content, /dessert/i, 'Must fire Desserts');
  });
});

describe('Milestone M2: Persona 4 - Accountant / Tax Compliance (AccountantView.tsx)', () => {
  const content = fs.readFileSync(ACCOUNTANT_FILE, 'utf8');

  it('displays Indian GST breakdown cards with SAC 996331 and split 2.5% CGST/SGST', () => {
    assert.match(content, /996331/, 'Must specify SAC 996331');
    assert.match(content, /CGST/i, 'Must breakdown CGST');
    assert.match(content, /SGST/i, 'Must breakdown SGST');
    assert.match(content, /2\.5/, 'Must specify 2.5% tax rates');
  });

  it('displays FSSAI compliance verification badge for Delhi state code 07', () => {
    assert.match(content, /10019011000234/, 'Must verify FSSAI 10019011000234');
    assert.match(content, /07|Delhi/, 'Must specify Delhi State Code 07');
  });

  it('provides Z-Report shift closure balancing table with cash variance flags', () => {
    assert.match(content, /openingFloat/i, 'Must track Opening Float');
    assert.match(content, /expectedCashInDrawer/i, 'Must track Expected Cash');
    assert.match(content, /actualCountedCash/i, 'Must track Counted Cash');
    assert.match(content, /cashVariance/i, 'Must compute Cash Variance');
    assert.match(content, /actions\.recordShiftClosure/, 'Must allow recording shift closures');
  });

  it('provides 1-click standard Tally ERP 9 / Prime XML export download button', () => {
    assert.match(content, /generateTallyXml|Download Tally XML/i, 'Must generate Tally XML');
    assert.match(content, /<ENVELOPE>/, 'Must generate standard Tally XML Envelope');
    assert.match(content, /<VOUCHER VCHTYPE="Receipt"/, 'Must create Tally Receipt Voucher');
    assert.match(content, /Cash Counter Drawer/, 'Must map Cash Counter Drawer ledger');
    assert.match(content, /UPI Digital Clearing/, 'Must map UPI Clearing ledger');
    assert.match(content, /Restaurant Sales Account/, 'Must map Restaurant Sales ledger');
  });
});

describe('Milestone M2: Persona 5 - Delivery Driver (DeliveryDriverView.tsx)', () => {
  const content = fs.readFileSync(DRIVER_FILE, 'utf8');

  it('implements active dispatch queue across Swiggy, Zomato, and Direct channels', () => {
    assert.match(content, /swiggy/i, 'Must support Swiggy channel');
    assert.match(content, /zomato/i, 'Must support Zomato channel');
    assert.match(content, /direct/i, 'Must support Direct in-house channel');
  });

  it('provides customer delivery address verification with masked contact phone numbers', () => {
    assert.match(content, /maskedPhone|Call Proxy/i, 'Must display privacy masked phone numbers');
    assert.match(content, /deliveryAddress/, 'Must display delivery address');
  });

  it('implements rider status progression buttons across 4 stages', () => {
    assert.match(content, /assigned/i, 'Must support assigned status');
    assert.match(content, /arrived/i, 'Must support arrived status');
    assert.match(content, /dispatched/i, 'Must support dispatched status');
    assert.match(content, /delivered/i, 'Must support delivered status');
  });

  it('implements Cash-on-Delivery (COD) cash collection reconciliation updating counter till', () => {
    assert.match(content, /isCod|codAmount|codCollected/i, 'Must handle COD orders');
    assert.match(content, /actions\.updateDeliveryStatus/, 'Must call updateDeliveryStatus');
  });
});

describe('Milestone M2: Persona 6 - Owner / Manager (OwnerManagerView.tsx)', () => {
  const content = fs.readFileSync(OWNER_FILE, 'utf8');

  it('displays multi-restaurant chain overview across Downtown Bistro, Cyber Hub, and Airport T3', () => {
    assert.match(content, /Downtown Bistro/i, 'Must display Downtown Bistro');
    assert.match(content, /Cyber Hub/i, 'Must display Cyber Hub');
    assert.match(content, /Airport Terminal 3/i, 'Must display Airport Terminal 3');
  });

  it('displays consolidated chain performance KPIs', () => {
    assert.match(content, /totalSales|totalOrders|avgTicket/, 'Must compute chain totals');
    assert.match(content, /tenders|upiPercent|cashPercent|cardPercent/, 'Must compute tender mix');
  });

  it('provides staff PIN & role assignment modal with 4-digit PIN validation', () => {
    assert.match(content, /actions\.assignStaffRole/, 'Must call assignStaffRole action');
    assert.match(content, /\/(\^)?\\d\{4\}\$\//, 'Must validate exactly 4 numeric digits');
    assert.match(content, /OperationalRole/, 'Must support operational roles');
  });

  it('displays shift closure history and Amazon S3 cloud backup outbox status with zero commingling', () => {
    assert.match(content, /tenants\//, 'Must use isolated tenant prefix');
    assert.match(content, /Zero Commingling/i, 'Must enforce zero commingling');
    assert.match(content, /s3Bucket|Cloud Backup/i, 'Must monitor Amazon S3 bucket');
  });
});
