/**
 * Order It Up - Milestone M4 Automated Verification Test Suite
 * File: tests/landing-dashboard-shell.test.cjs
 *
 * Verifies Milestone M4: "Dashboard Shell, Unified Navigation & Cloudflare Pages Static Export"
 * 1. Master Dashboard Shell:
 *    - Header with Order It Up brand logo, outlet selector dropdown (Downtown Bistro, Cyber Hub Express, Airport Terminal 3), and Hybrid Connection Status Pill.
 *    - Shows live telemetry status from useBackendDetector(): Green badge "Live Sync (:3001, :3002, :3003)" when local services detected, or slate badge "Standalone Simulation (Cloudflare Pages)" with popover explaining zero-commingling hybrid operation and manual "Re-check Services" button.
 * 2. Perspective & Role Navigation Switcher:
 *    - Top toggle to switch between Administrative Perspectives: "Restaurant Chain Owner" (merchant) and "Founder Platform Admin" (founder).
 *    - When merchant is active, show the 6 operational restaurant persona tabs:
 *      1. Owner / Manager (owner)
 *      2. Front Cashier (cashier)
 *      3. Kitchen Chef (chef)
 *      4. Server / Waiter (waiter or server)
 *      5. Accountant / Tax Compliance (accountant)
 *      6. Delivery Driver (driver or delivery)
 *    - When founder is active, render FounderAdminView.
 *    - When merchant is active and no sub-persona is selected (or when Multi-Outlet Overview is active), render ChainOwnerView.
 *    - When a persona tab is selected, render the corresponding view (CashierView, KitchenChefView, ServerWaiterView, AccountantView, DeliveryDriverView, OwnerManagerView).
 * 3. URL Sync & Static Export Safety:
 *    - Sync active role / perspective with URL query params (?role=..., ?perspective=...).
 *    - Wrap useSearchParams() in <Suspense fallback={...}> boundary to strictly preserve Next.js 16 static export (output: 'export').
 * 4. Design System Consistency:
 *    - Strict adherence to #F8FAFC slate-50 background, #FFFFFF cards with border-slate-200/80, vibrant orange #F07928 / #EA580C brand accents, Geist typography, standard Lucide icons, and zero dummy/placeholder text.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_PAGE_FILE = path.join(ROOT, 'landing', 'src', 'app', 'dashboard', 'page.tsx');
const NEXT_CONFIG_FILE = path.join(ROOT, 'landing', 'next.config.ts');
const COMPONENTS_DIR = path.join(ROOT, 'landing', 'src', 'components', 'dashboard');

describe('Milestone M4: Dashboard Shell File Integrity and Static Code Checks', () => {
  it('landing/src/app/dashboard/page.tsx must exist and exceed minimum content size', () => {
    assert.ok(fs.existsSync(DASHBOARD_PAGE_FILE), 'page.tsx must exist in landing/src/app/dashboard/');
    const stat = fs.statSync(DASHBOARD_PAGE_FILE);
    assert.ok(stat.size > 5000, `page.tsx must contain substantial dashboard shell logic (size: ${stat.size} bytes)`);
  });

  it('declares "use client"; and exports default function DashboardPage', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /^"use client";/, 'Must start with "use client"; directive');
    assert.match(content, /export default function DashboardPage\s*\(/, 'Must export default function DashboardPage');
  });

  it('strictly wraps useSearchParams in a <Suspense fallback={...}> boundary for Next.js static export', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /import\s+React,\s*\{[\s\S]*?Suspense[\s\S]*?\}\s*from\s*["']react["']|import\s*\{[\s\S]*?Suspense[\s\S]*?\}\s*from\s*["']react["']/, 'Must import Suspense from react');
    assert.match(content, /useSearchParams\s*\(/, 'Must use useSearchParams');
    assert.match(content, /<Suspense\s+fallback=\{[\s\S]*?\}>/, 'Must wrap dashboard shell in Suspense boundary');
    assert.match(content, /DashboardLoadingFallback/, 'Must implement a graceful loading fallback component');
  });

  it('next.config.ts enforces output: "export" for Cloudflare Pages static hosting', () => {
    assert.ok(fs.existsSync(NEXT_CONFIG_FILE), 'next.config.ts must exist');
    const content = fs.readFileSync(NEXT_CONFIG_FILE, 'utf8');
    assert.match(content, /output:\s*["']export["']/, 'Must declare output: "export"');
  });

  it('adheres to design system: #F8FAFC canvas, #F07928 brand accents, and zero dummy/placeholder text', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /#F8FAFC/, 'Must use #F8FAFC background canvas');
    assert.match(content, /(#F07928|#EA580C)/, 'Must use vibrant orange #F07928 or #EA580C brand accents');
    assert.match(content, /border-slate-200/, 'Must use standard slate-200 card borders');

    const placeholderRegex = /\b(lorem ipsum|dummy text|dummy data|tbd)\b/i;
    assert.doesNotMatch(content, placeholderRegex, 'Must contain zero dummy placeholder text');
  });
});

describe('Milestone M4: Navigation, Persona Tabs, and View Mount Integration', () => {
  it('imports and integrates all 8 verified perspective and persona view components', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    const requiredViews = [
      'CashierView',
      'KitchenChefView',
      'ServerWaiterView',
      'AccountantView',
      'DeliveryDriverView',
      'OwnerManagerView',
      'FounderAdminView',
      'ChainOwnerView',
    ];

    for (const view of requiredViews) {
      const importRegex = new RegExp(`import\\s*\\{[^}]*\\b${view}\\b[^}]*\\}\\s*from\\s*["']@/components/dashboard/${view}["']`);
      assert.match(content, importRegex, `Must import ${view} from @/components/dashboard/${view}`);

      const jsxRegex = new RegExp(`<${view}\\s*/>`);
      assert.match(content, jsxRegex, `Must render <${view} /> in view renderer`);

      // Verify the component file itself exists
      const componentPath = path.join(COMPONENTS_DIR, `${view}.tsx`);
      assert.ok(fs.existsSync(componentPath), `${view}.tsx must exist in components directory`);
    }
  });

  it('implements perspective switcher between "Restaurant Chain Owner" (merchant) and "Founder Platform Admin" (founder)', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /Restaurant Chain Owner/, 'Must label merchant perspective');
    assert.match(content, /Founder Platform Admin/, 'Must label founder perspective');
    assert.match(content, /handlePerspectiveChange\s*\(\s*["']merchant["']\s*\)/, 'Must handle switch to merchant');
    assert.match(content, /handlePerspectiveChange\s*\(\s*["']founder["']\s*\)/, 'Must handle switch to founder');
    assert.match(content, /actions\.setActivePerspective/, 'Must synchronize active perspective to dashboard store');
  });

  it('provides all 6 operational restaurant persona tabs plus Multi-Outlet Overview when merchant is active', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');

    // Multi-Outlet Overview
    assert.match(content, /Multi-Outlet Overview/, 'Must include Multi-Outlet Overview tab');
    // 1. Owner / Manager
    assert.match(content, /Owner \/ Manager/, 'Must include Owner / Manager tab');
    // 2. Front Cashier
    assert.match(content, /Front Cashier/, 'Must include Front Cashier tab');
    // 3. Kitchen Chef
    assert.match(content, /Kitchen Chef/, 'Must include Kitchen Chef tab');
    // 4. Server / Waiter
    assert.match(content, /Server \/ Waiter/, 'Must include Server / Waiter tab');
    // 5. Accountant / Tax Compliance
    assert.match(content, /Accountant \/ Tax/, 'Must include Accountant / Tax tab');
    // 6. Delivery Driver
    assert.match(content, /Delivery Driver/, 'Must include Delivery Driver tab');

    assert.match(content, /actions\.setActiveRole/, 'Must synchronize active role to dashboard store');
  });

  it('renders FounderAdminView when founder perspective is active', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(
      content,
      /effectivePerspective\s*===\s*["']founder["']\s*\)\s*\{\s*return\s*<FounderAdminView\s*\/>;/,
      'Must return <FounderAdminView /> when founder perspective is active'
    );
  });

  it('renders ChainOwnerView when Multi-Outlet Overview is active or default', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(
      content,
      /case\s*["']overview["']:\s*(default:\s*)?return\s*<ChainOwnerView\s*\/>;/,
      'Must render <ChainOwnerView /> for overview or default merchant state'
    );
  });
});

describe('Milestone M4: Hybrid Connection Status Pill & Telemetry Popover', () => {
  it('connects to useBackendDetector() hook for live local service telemetry', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /useBackendDetector\s*\(/, 'Must invoke useBackendDetector hook');
    assert.match(content, /detectorStatus\.mode\s*===\s*["']live["']/, 'Must check live mode status');
  });

  it('displays Green badge "Live Sync (:3001, :3002, :3003)" when local services detected', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /Live Sync \(:3001, :3002, :3003\)/, 'Must display Live Sync badge text');
    assert.match(content, /bg-emerald-50 text-emerald-800 border-emerald-200/, 'Must use emerald green badge styling for live mode');
  });

  it('displays Slate badge "Standalone Simulation (Cloudflare Pages)" when in edge standalone mode', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /Standalone Simulation \(Cloudflare Pages\)/, 'Must display Standalone Simulation badge text');
    assert.match(content, /bg-slate-100 text-slate-700 border-slate-200/, 'Must use slate badge styling for standalone mode');
  });

  it('includes interactive Popover explaining zero-commingling hybrid operation with manual "Re-check Services" button', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /statusPopoverOpen/, 'Must track status popover open state');
    assert.match(content, /Zero-Commingling Hybrid Architecture/, 'Must explain zero-commingling hybrid architecture');
    assert.match(content, /POS Engine API \(:3001\)/, 'Must display port 3001 status in popover');
    assert.match(content, /Kitchen Display System \(:3002\)/, 'Must display port 3002 status in popover');
    assert.match(content, /Server \/ Waiter App \(:3003\)/, 'Must display port 3003 status in popover');
    assert.match(content, /Re-check Services/, 'Must provide manual "Re-check Services" button');
    assert.match(content, /await recheck\(\)/, 'Must call recheck() when clicked');
  });
});

describe('Milestone M4: Outlet Selector Dropdown & Store State Coupling', () => {
  it('connects outlet selector to dashboard-store outlets and selectedOutletId', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /useOutlets\s*\(/, 'Must read outlets from dashboard store');
    assert.match(content, /useSelectedOutletId\s*\(/, 'Must read selectedOutletId from dashboard store');
    assert.match(content, /actions\.setSelectedOutletId/, 'Must update selectedOutletId via dashboard actions');
    assert.match(content, /All Outlets \(Consolidated Chain\)/, 'Must support consolidated All Outlets option');
  });

  it('supports selecting NCR restaurant branches: Downtown Bistro, Cyber Hub Express, Airport Terminal 3 Hub', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /outlet\.name/, 'Must dynamically render branch outlet names in dropdown options');
    assert.match(content, /handleOutletChange/, 'Must provide handleOutletChange handler');
  });
});

describe('Milestone M4: URL Synchronization & Static Export Resilience', () => {
  it('synchronizes active perspective, persona role, and outlet with URL query parameters', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /searchParams\.get\(\s*["']perspective["']\s*\)/, 'Must parse ?perspective query param');
    assert.match(content, /searchParams\.get\(\s*["']role["']\s*\)/, 'Must parse ?role query param');
    assert.match(content, /searchParams\.get\(\s*["']outlet["']\s*\)/, 'Must parse ?outlet query param');
    assert.match(content, /window\.history\.replaceState/, 'Must update browser URL without full reload');
  });

  it('handles persona role aliases gracefully (server -> waiter, delivery -> driver, manager -> owner)', () => {
    const content = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');
    assert.match(content, /r === ["']waiter["'] \|\| r === ["']server["']/, 'Must map server alias to waiter');
    assert.match(content, /r === ["']driver["'] \|\| r === ["']delivery["']/, 'Must map delivery alias to driver');
    assert.match(content, /r === ["']owner["'] \|\| r === ["']manager["']/, 'Must map manager alias to owner');
  });
});
