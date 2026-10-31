# Comprehensive Technical Specification & Survey Analysis: R2, R3, & Cloudflare Static Export

**Author**: Explorer 3 (Specification Miner)  
**Date**: 2026-10-31  
**Target Path**: `landing/` web portal dashboards for Cloudflare Pages deployment  
**Authoritative References**:
- `ORIGINAL_REQUEST.md` (Requirements R2, R3, R4)
- `main/services/amazon-s3.ts` (Authoritative multi-tenant S3 isolation, domain prefixes, outbox queue)
- `main/services/license-verifier.ts` & `main/routes/subscription.ts` (Licensing tokens, verification rules)
- `main/routes/cloud-hq.ts` (Multi-branch overview, catalog overrides, stock transfers, terminal PIN pairing)
- `main/backend-health.ts`, `main/server.ts`, `main/kds-server.ts`, `main/server-app.ts` (Backend ports `:3001`, `:3002`, `:3003` & `/api/health`)
- `landing/next.config.ts` & `landing/package.json` (Next.js 16.3.4, React 19, `output: 'export'`, Cloudflare Pages)

---

## 1. Executive Summary

This survey defines the precise engineering blueprint for implementing Requirements **R2** (Founder Platform Admin vs. Restaurant Chain Owner Perspectives) and **R3** (Hybrid Data Architecture & Operational Realism) in the `landing/` web portal for deployment on Cloudflare Pages.

The existing implementation in `landing/src/app/dashboard/page.tsx` provides an initial skeleton with a high-level toggle between "Restaurant Chain Owner" and "Founder Admin", but relies on hardcoded static mock arrays without state mutability, dynamic 16-character license key generation, interactive S3 bucket inspection, branch catalog overrides, or live connectivity detection for Order It Up's local backend services (`:3001`, `:3002`, `:3003`).

By grounding the web portal directly in the backend patterns established in `main/services/amazon-s3.ts`, `main/routes/cloud-hq.ts`, and `main/services/license-verifier.ts`, the portal achieves full operational realism: operating 100% self-contained in standalone mode with rich interactive state in the browser by default, while seamlessly detecting and binding to live local desktop backend services whenever available.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R2: Platform Admin | Restaurant Tenant Directory | Searchable, filterable directory of all subscribed restaurant brands, plan tiers, POS fleet size, and isolated S3 bucket IDs. | Search query, Plan Tier filter (`all`, `enterprise`, `pro`, `single`) | Filtered tenant table with real-time stats and health status | Gracefully displays empty state if no matches found | `landing/src/app/dashboard/page.tsx:41-98`, `docs/user-access-guide.md` |
| 2 | R2: Platform Admin | New Tenant Registration Workflow | Interactive onboarding modal to register new restaurant customer organizations, set initial plan tier, and initialize isolated S3 prefix. | Tenant Name, Owner Name, Email, Plan Tier, Number of Outlets, City | Newly provisioned tenant record with active status and auto-assigned S3 bucket | Validates required fields and email regex; blocks duplicate slugs | `ORIGINAL_REQUEST.md:20-24`, `main/routes/subscription.ts` |
| 3 | R2: Platform Admin | 16-Character Hardware-Bound License Generator | Generates cryptographically deterministic, human-readable 16-character license keys formatted as `OIUP-XXXX-XXXX-XXXX` bound to desktop hardware IDs. | Target Tenant, Plan Tier (`starter`, `pro`, `enterprise`), Expiration Period, Machine/Hardware Fingerprint | Formatted 16-character key (e.g. `OIUP-ENT1-B892-4C7D`), instant copy-to-clipboard, QR code preview | Rejects empty hardware binding; displays tamper-evident error if checksum fails | `ORIGINAL_REQUEST.md:20-24`, `main/services/license-verifier.ts:25-75` |
| 4 | R2: Platform Admin | Isolated S3 Customer Bucket Tracking | Dedicated telemetry view tracking isolated S3 buckets (`orderitup-tenant-<slug>`) and strictly separated data domains (`backups`, `users`, `payments`, `media`). | Selected Tenant ID, Domain Filter | Object counts, storage sizes (MB/GB), latest backup timestamp, zero-commingling validation badge | Throws error if key violates `tenants/{tenantId}/` prefix enforcement | `main/services/amazon-s3.ts:128-173, 755-833` |
| 5 | R2: Platform Admin | Offline S3 Outbox Sync Monitor | Real-time queue inspector tracking store-and-forward outbox items awaiting cloud sync from local SQLite WAL (`s3_upload_outbox`). | Refresh trigger, retry failed action | Pending queue count, failed upload logs, sync progress status | Flags network drops; retains payloads until HTTP 200 upload | `main/services/amazon-s3.ts:181-206, 451-570` |
| 6 | R2: Platform Admin | Platform-Wide 30-Day GMV Aggregator | Consolidated platform metrics aggregating total billing volume across all active restaurant tenants in INR and USD equivalent. | Time interval (30-day default), tenant selection | Platform Gross GMV (₹ Cr), Active Terminals, Monthly Growth %, Tier Breakdown | Returns 0 for inactive/empty tenants | `landing/src/app/dashboard/page.tsx:710-721`, `ORIGINAL_REQUEST.md:22` |
| 7 | R2: Chain Owner | Connected Multi-Branch Overview | Live multi-outlet performance monitoring across Downtown Bistro (flagship), Cyber Hub Express (QSR), and Airport Terminal 3 (transit). | Branch Selector (`all` vs specific outlet id) | Aggregated sales, total orders, avg ticket size, table occupancy, tender splits | Outlets with disconnected engines show "Offline Cache" indicator | `landing/src/app/dashboard/page.tsx:100-150`, `main/routes/cloud-hq.ts:60-145` |
| 8 | R2: Chain Owner | Outlet Comparative Performance Grid | Side-by-side outlet comparison cards displaying sales velocity, order count, % share of chain total, top-selling dish, and hardware connectivity. | Outlet card selection click | Focused outlet metrics, tender breakdown (UPI QR vs 24V Cash Till vs Card POS) | Gracefully handles zero-sale new branches | `landing/src/app/dashboard/page.tsx:435-538`, `main/routes/cloud-hq.ts:107-124` |
| 9 | R2: Chain Owner | Central Menu Catalog & Branch Price Overrides | Centralized menu catalog management with inter-branch price override controls (e.g. Airport T3 transit tier +15%) and 86'd item locking. | Product ID, Branch ID, Price Override amount, Availability toggle | Updated product pricing per branch; instant sync status indicator | Validates numeric non-negative price overrides | `main/routes/cloud-hq.ts:252-306`, `ORIGINAL_REQUEST.md:23` |
| 10 | R2: Chain Owner | Inter-Branch Stock Transfer Ledger | Multi-branch inventory transfer tracking (source outlet, destination outlet, item, quantity, status: pending/dispatched/received). | Source Branch, Destination Branch, Item, Qty, Status | Transfer entry added to chain ledger with dispatch timestamp | Rejects transfers where source and destination are identical | `main/routes/cloud-hq.ts:15-28, 308-345` |
| 11 | R2: Chain Owner | Consolidated Indian GST Tax Ledger | Aggregated tax ledger calculating CGST @ 2.5% and SGST @ 2.5% (total 5%) under SAC code 996331 across all branches for GSTR-1 filing. | Date range, outlet filter | Itemized taxable turnover, CGST amount, SGST amount, Total Tax Collected | Displays tax exempt warning if SAC code differs | `landing/src/app/dashboard/page.tsx:588-636`, `ORIGINAL_REQUEST.md:17` |
| 12 | R2: Chain Owner | Consolidated Z-Report Shift Reconciliation | Multi-branch shift balancing consolidating opening cash floats, digital payments, expected drawer cash, and cash-in-till variances. | Shift date, branch filter | Consolidated Z-Report modal view, variance status (`balanced` vs `variance`) | Flags any cash discrepancy > ₹0 as an audit variance | `landing/src/app/dashboard/page.tsx:349-357`, `main/routes/cloud-hq.ts:219-250` |
| 13 | R3: Hybrid Arch | Standalone Browser Reactive State Store | Self-contained client store (Zustand / React Context) with realistic interconnected seed data and localStorage persistence. | Client user actions (orders, bumps, price edits, licenses) | Instant optimistic state updates; zero page reloads; survives refresh | Hydration-safe fallback if browser localStorage is disabled | `ORIGINAL_REQUEST.md:25-27`, `landing/src/lib/auth.ts:102-164` |
| 14 | R3: Hybrid Arch | Local Backend Auto-Detection Bridge | Background heartbeat probe querying `/api/health` across `:3001` (POS Engine), `:3002` (KDS), and `:3003` (Waiter App). | Auto-timer (every 12s) or manual retry button | Port connectivity status badges (`Online` / `Standalone Simulation`), latency ms, version | Silent timeout after 1500ms; falls back cleanly to simulation | `main/backend-health.ts:8-23`, `dev-server.js:142-146` |
| 15 | R3: Hybrid Arch | Live Data Fetch & Merge Protocol | When local backend (`:3001`) is online, pulls live SQLite data (`/api/cloud-hq/overview`, `/api/cloud-hq/catalog`) into dashboard view. | Backend reachable status | Live order counts, revenue, and active catalog merged seamlessly | If fetch fails (e.g. CORS or mixed content), retains simulated store | `main/routes/cloud-hq.ts:60-145`, `main/middleware/security.ts:362-379` |
| 16 | R3: Hybrid Arch | Cryptographic Terminal PIN Pairing | Generates single-use 6-digit PIN (`POST /api/cloud-hq/pair/generate`) with 15-minute TTL to bind mobile tablets to local branches. | Branch ID, Terminal Name | Formatted 6-digit pairing code (`XXX XXX`), expiration countdown | Automatically invalidates code after 5 failed claim attempts or TTL expiry | `main/routes/cloud-hq.ts:347-488` |
| 17 | Static Export | Cloudflare Pages Export Compatibility | Full compatibility with Next.js `output: 'export'` ensuring zero SSR dynamic runtime errors, prerendered static assets, and client-side routing. | `npm --prefix landing run build` | Static HTML/CSS/JS export in `landing/out/` with `trailingSlash: true` | Build fails if `headers()`, `cookies()`, or unsuspended `useSearchParams()` are used | `landing/next.config.ts:3-12`, Next.js 16.3 static export rules |

---

## 3. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | S3 Tenant Isolation | `tenantId: "../escape_tenant"` | `validateTenantId()` throws: `Tenant isolation violation: Tenant ID contains illegal characters or path traversal`. Path traversal is rejected. |
| 2 | S3 Domain Isolation | `domain: "system/config"` | `validateDomain()` throws: `Invalid storage domain: Domain contains illegal characters`. Only alphanumeric, hyphens, underscores permitted. |
| 3 | S3 Filename Path Traversal | `filename: "../../etc/passwd"` | `validateFilename()` detects `..` or leading `/` and throws: `Tenant isolation violation: Filename contains path traversal sequence`. |
| 4 | S3 Key Prefix Enforcement | Object key `other-tenant/backups/db.sqlite` | `buildTenantKey()` strictly prepends `tenants/{cleanTenant}/` and asserts `key.startsWith(expectedPrefix)`. Mismatches throw immediately. |
| 5 | License Format Validation | Input: `INVALID-KEY-123` | `verifyAsymmetricLicense()` parses segments; detects missing prefix or invalid plan tier; returns `{ valid: false, error: 'Invalid license format...' }`. |
| 6 | License Expiration | Input with expired hex timestamp | `verifyAsymmetricLicense()` decodes timestamp; detects `expiryMs < Date.now()`; returns `{ valid: false, error: 'Commercial license expired on YYYY-MM-DD.' }`. |
| 7 | Legacy HMAC License Key | Input: `OIU-ENTERPRISE-67c13400-abcd1234ef567890` | Detected as legacy format; by default in production returns `{ valid: false, isLegacyHmac: true, error: 'Legacy HMAC license keys are deprecated...' }`. |
| 8 | Next.js Static Export Search Params | Using `useSearchParams()` directly in page without `<Suspense>` | Build errors out with `Entire page deopted into client-side rendering... useSearchParams() should be wrapped in a suspense boundary`. |
| 9 | Mixed Content in HTTPS Web Portal | Browser on `https://orderitup.pages.dev` attempts `fetch('http://127.0.0.1:3001/api/health')` | Modern browsers block HTTP fetch from HTTPS origin (Mixed Content error). Probe catches error smoothly within 1.5s timeout and toggles to `Standalone Simulation` mode without crashing. |
| 10 | CORS Rejection on Local Backend | Origin `https://orderitup.pages.dev` calls local Express `:3001` | In `main/middleware/security.ts:370`, origins not matching `localhost`, `.local`, or private IPs receive CORS error `Not allowed by CORS`. Client gracefully falls back to local simulated store. |
| 11 | Outbox Offline Queue Resiliency | S3 upload fails due to network outage (ECONNREFUSED / ENOTFOUND) | `dispatchUpload()` catches `isNetworkError()`, enqueues payload to `s3_upload_outbox` with status `pending`, returns `{ success: true, queued: true }`. Zero data lost. |
| 12 | Terminal PIN Rate Limiting | More than 10 pairing attempts from single IP within 5 minutes | `pairClaimAttempts` tracker trips; returns HTTP 429 `Too many pairing attempts. Please wait 5 minutes.` with `Retry-After: 300` header. |
| 13 | Single-Use PIN Invalidation | Claiming already-claimed 6-digit PIN | Session marked `claimed = true` and deleted from `activePairingSessions`. Subsequent claim returns HTTP 410 `Pairing code has already been claimed`. |
| 14 | Negative or Zero Price Overrides | User enters `₹ -50` or `₹ 0` for menu item override | Validation guard blocks negative values; sets floor at minimum base price or alerts merchant of zero-price anomaly. |

---

## 4. Deep Dive Specification: Requirement R2 (Perspectives)

### 4.1 Founder Platform Admin ("For me - startup owner")

The Founder Platform Admin view caters to the SaaS software creator managing multiple independent restaurant customer organizations.

```
+----------------------------------------------------------------------------------------------------+
|                                    FOUNDER PLATFORM ADMIN VIEW                                      |
+----------------------------------------------------------------------------------------------------+
|  [Platform KPIs]                                                                                   |
|  - Total Tenants: 104 Brands       - Active Terminals: 268 Terminals                               |
|  - Platform 30-Day GMV: ₹1.84 Cr   - Isolated S3 Buckets: 104 Buckets                              |
|                                                                                                    |
|  [Actions Bar]                                                                                     |
|  - [ + Register Restaurant Tenant ]   - [ Generate 16-Char License ]   - [ SaaS Master Agreement ] |
|                                                                                                    |
|  [Search & Tier Filter]                                                                            |
|  [ Search brand, owner, city... ]  [ Filter: All Tiers | Enterprise | Pro | Single Store ]           |
|                                                                                                    |
|  [Restaurant Customer Accounts Table]                                                              |
|  +-----------------------------+--------------------+------------+-----------+------------+-------+
|  | BRAND / OUTLETS             | OWNER / EMAIL      | TIER       | 30D GMV   | S3 BUCKET  | SYNC  |
|  +-----------------------------+--------------------+------------+-----------+------------+-------+
|  | Spice Route Hospitality (3) | Priya Sharma       | Enterprise | ₹14.85 L  | [Inspect]  | Live  |
|  | Urban Bites Fast-Casual (2) | Amit Verma         | Pro        | ₹8.92 L   | [Inspect]  | Live  |
|  | The Coastal Catch (4)       | Sunita Rao         | Enterprise | ₹21.40 L  | [Inspect]  | Live  |
|  | Cafe Milano Roasters (1)    | Marco Rossi        | Single     | ₹4.20 L   | [Inspect]  | Live  |
|  +-----------------------------+--------------------+------------+-----------+------------+-------+
|                                                                                                    |
|  [Interactive Sub-Panels]                                                                          |
|  1. 16-Char License Issuance Modal (Brand, Plan, Hardware Fingerprint, Checksum)                   |
|  2. Amazon S3 Isolated Bucket Inspector (Backups, Users, Payments, Media, Zero Commingling Audit)  |
|  3. Platform GMV Tier Distribution & Revenue Trends Chart                                          |
+----------------------------------------------------------------------------------------------------+
```

#### A. Core Data Fields for Platform Tenants:
```typescript
export interface PlatformTenant {
  id: string;               // e.g. "tenant-0892"
  businessName: string;     // e.g. "Spice Route Hospitality Group"
  ownerName: string;        // e.g. "Priya Sharma"
  ownerEmail: string;       // e.g. "priya@spiceroute.in"
  ownerPhone: string;       // e.g. "+91 98110 23456"
  tier: "Enterprise Chain" | "Pro Multi-Outlet" | "Single Store Pilot";
  tierCode: "enterprise" | "pro" | "starter";
  outletsCount: number;     // e.g. 3
  activeTerminals: number;  // e.g. 6
  s3Bucket: string;         // e.g. "orderitup-tenant-spiceroute"
  monthGmv: number;         // e.g. 1485200 (₹14,85,200)
  lastSync: string;         // e.g. "2 mins ago"
  status: "Active" | "Suspended" | "Pending Provisioning";
  city: string;             // e.g. "New Delhi & Gurugram"
  licenseKeys: IssuedLicenseRecord[];
  s3Metrics: {
    totalSizeMb: number;
    objectCount: number;
    backupsCount: number;
    lastBackupIso: string;
  };
}
```

#### B. 16-Character License Generation Specification:
- **Length & Structure**: Exactly 16 alphanumeric characters grouped into 4 hyphenated blocks of 4 (`OIUP-XXXX-XXXX-XXXX`):
  1. `Block 1: Prefix`: `OIUP` (Order It Up Platform identifier, constant).
  2. `Block 2: Plan & Platform`:
     - `ENT1` / `ENT2` (Enterprise Plan, Windows/Linux/Mac)
     - `PRO1` / `PRO2` (Professional Plan)
     - `STR1` / `STR2` (Starter Plan)
  3. `Block 3: Hardware Fingerprint`: 4 uppercase hex characters derived from SHA-256 of target terminal hardware string (e.g. `8F42` from `MAC:00-1B-44-11-3A-B7 + CPU-ID`).
  4. `Block 4: Cryptographic Checksum`: 4 uppercase characters calculated via Luhn-36 or truncated HMAC algorithm across Blocks 1..3.
- **Workflow in Dashboard**:
  - Founder clicks "Generate License Key" button.
  - Modal opens with:
    - Tenant Organization selector (dropdown of registered tenants).
    - Plan Tier (`Enterprise`, `Pro`, `Starter`).
    - Validity Duration (`30 Days Trial`, `1 Year Standard`, `3 Years Long-term`, `Perpetual Lifetime`).
    - Hardware Fingerprint input (autofilled or manual counter machine ID).
  - Generates key instantly in `OIUP-XXXX-XXXX-XXXX` format.
  - Provides "Copy Key" button with visual confirmation checkmark, and a QR code preview for optical barcode scanner scanning at the counter terminal.
  - Appends record to tenant's persistent license history.

#### C. Amazon S3 Multi-Tenant Isolation & Zero Commingling Specification:
Grounded in `main/services/amazon-s3.ts`:
- Each customer organization is assigned a dedicated S3 bucket or strictly enforced tenant prefix: `tenants/{tenantId}/`.
- **4 Strict Data Domains**:
  1. `backups/`: Encrypted SQLite database snapshots (`order-it-up-YYYY-MM-DD.db`), schema version metadata.
  2. `users/`: Encrypted staff credentials, role-permission profiles, audit access logs.
  3. `payments/`: Settled payment transaction receipts, reconciliation batches, dispute logs.
  4. `media/`: Food photos, receipt logos, brand assets.
- **Interactive Bucket Telemetry Inspector**:
  - Clicking on a tenant's S3 Bucket opens a drawer/modal displaying:
    - Verified Bucket ID (e.g. `orderitup-tenant-spiceroute`)
    - Storage breakdown by domain:
      - Backups: 14 snapshots (428 MB)
      - Payments: 3,420 settled records (18.4 MB)
      - Users & Roles: 12 archived accounts (1.2 MB)
      - Media Assets: 68 dish images (142 MB)
    - Zero Commingling Invariant Status: `Verified Isolated (Prefix Strict)`
    - Offline Outbox Status: `0 Pending / 100% Processed`

---

### 4.2 Restaurant Chain Owner ("For users - multi-outlet")

The Restaurant Chain Owner view is designed for the merchant proprietor (e.g., Priya Sharma of Spice Route Hospitality Group) who oversees multiple restaurant locations.

```
+----------------------------------------------------------------------------------------------------+
|                                    RESTAURANT CHAIN OWNER VIEW                                      |
+----------------------------------------------------------------------------------------------------+
|  [Chain Brand Banner: Spice Route Hospitality Group]                                               |
|  - Outlets: 3 Connected Branches | Live Sales: ₹1,45,470.00 | Orders: 216 | Avg Ticket: ₹673.47    |
|  - Active Context: [ All Outlets (Consolidated) v ]   [ Print Consolidated Z-Report ]              |
|                                                                                                    |
|  [Connected Outlets Performance Grid]                                                              |
|  +--------------------------------+-------------------------------+--------------------------------+
|  | OUTLET 1: DOWNTOWN BISTRO      | OUTLET 2: CYBER HUB EXPRESS   | OUTLET 3: AIRPORT TERMINAL 3   |
|  | Connaught Place, New Delhi     | DLF Cyber City, Gurugram      | IGI Airport T3 Departures      |
|  | Sales: ₹48,920.00 (48 orders)  | Sales: ₹64,150.00 (112 orders)| Sales: ₹32,400.00 (56 orders)  |
|  | Avg Ticket: ₹1,019.16          | Avg Ticket: ₹572.76           | Avg Ticket: ₹578.57            |
|  | Tables: 8 / 12 Active          | Tables: 10 / 12 Active        | Tables: 4 / 8 Active           |
|  | UPI: ₹28,420 | Cash: ₹14,200   | UPI: ₹49,200 | Cash: ₹3,000   | UPI: ₹10,200 | Cash: ₹2,400    |
|  | Engine: :3001 POS • :3002 KDS  | Engine: :3001 POS • :3002 KDS | Engine: :3001 POS • :3002 KDS  |
|  | Hardware: 2x 80mm • 24V Drawer | Hardware: 2x 80mm • Bump Bar  | Hardware: 1x 80mm • Barcode    |
|  +--------------------------------+-------------------------------+--------------------------------+
|                                                                                                    |
|  [Connected Workflows: Central Catalog & Tax Ledger]                                               |
|  +--------------------------------------------+----------------------------------------------------+
|  | CENTRAL MENU CATALOG WITH BRANCH OVERRIDES | CONSOLIDATED GST & COMPLIANCE LEDGER               |
|  | - Truffle Mushroom Pizza: ₹540.00          | - CGST @ 2.5%: ₹3,523.35                           |
|  |   [Downtown Bistro: ₹540] [Cyber Hub: ₹520]| - SGST @ 2.5%: ₹3,523.35                           |
|  |   [Airport T3: ₹620 (+15% transit)]        | - Total GST Collected: ₹7,046.70                   |
|  | - Artisanal Paneer Tikka: ₹380.00          | - SAC Code: 996331 (Restaurant Catering)           |
|  | - Classic Cold Brew Latte: ₹220.00         | - FSSAI License: 10019011000234 (Verified)         |
|  | [ + Add Menu Item ] [ Save Overrides ]     | [ View Official GST Invoice ] [ Export Tally XML ] |
|  +--------------------------------------------+----------------------------------------------------+
+----------------------------------------------------------------------------------------------------+
```

#### A. Outlet Data Model:
```typescript
export interface ChainOutlet {
  id: string;               // e.g. "outlet-1"
  name: string;             // e.g. "Downtown Bistro (Flagship)"
  location: string;         // e.g. "Connaught Place, New Delhi"
  type: string;             // e.g. "Fine Dine & Craft Cocktail Bar"
  todaySales: number;       // e.g. 48920
  ordersCount: number;      // e.g. 48
  avgTicket: number;        // e.g. 1019.16
  activeTables: string;     // e.g. "8 / 12"
  tenders: {
    upi: number;            // e.g. 28420
    cash: number;           // e.g. 14200
    card: number;           // e.g. 6300
  };
  topDish: string;          // e.g. "Truffle Mushroom Pizza"
  posTerminals: number;     // e.g. 2
  status: "Operational" | "Peak Rush" | "Closing Shift" | "Offline Cache";
  enginePort: string;       // e.g. ":3001 (POS Engine) • :3002 (KDS)"
  hardware: string;         // e.g. "2x 80mm ESC/POS Printers • 24V Solenoid Till Active"
}
```

#### B. Central Catalog & Branch Overrides Model:
```typescript
export interface CentralMenuItem {
  id: string;
  name: string;
  category: "Pizzas" | "Starters" | "Beverages" | "Mains" | "Desserts";
  basePrice: number;
  taxRatePercent: number;   // 5% (CGST 2.5% + SGST 2.5%)
  sacCode: string;          // "996331"
  branchOverrides: Record<string, {
    priceOverride?: number | null;
    isAvailable: boolean;
  }>;
}
```

---

## 5. Deep Dive Specification: Requirement R3 (Hybrid Architecture)

### 5.1 Standalone Browser Operation (Default Mode)

To deploy seamlessly on Cloudflare Pages without server-side dependencies:
1. **Zustand or Centralized Unified Store**:
   - A single unified client store (`useDashboardStore`) maintains all interconnected entities.
   - Initialized with realistic seed data mirroring a live Indian restaurant chain with 3 connected outlets and multi-tenant SaaS accounts.
   - Backed by browser `localStorage` persistence with hydration guards (`hasHydrated` boolean flag) to prevent SSR mismatch errors.
2. **Rich Client Mutations**:
   - Issue/revoke licenses.
   - Adjust branch price overrides and toggle 86'd item availability.
   - Simulate live order creation (auto-incrementing sales, updating tender splits, firing tickets to KDS).
   - Advance KDS kitchen prep stages (`pending` → `preparing` → `ready` → `served`).
   - Trigger shift closure balancing (opening float, digital settlement, cash drawer reconciliation).

### 5.2 Local Backend Auto-Detection Bridge

When a merchant or developer opens the web portal on a machine running Order It Up desktop services:
- **Service Endpoints**:
  - Express Local API: `http://127.0.0.1:3001/api/health`
  - Standalone KDS Server: `http://127.0.0.1:3002/api/health`
  - Tableside Server App: `http://127.0.0.1:3003/api/health`
- **Probe Logic (`useBackendTelemetry`)**:
  ```typescript
  export interface BackendTelemetryState {
    posEngine: { online: boolean; port: number; latencyMs: number; version?: string };
    kdsServer: { online: boolean; port: number; latencyMs: number; version?: string };
    serverApp: { online: boolean; port: number; latencyMs: number; version?: string };
    mode: "hybrid-live" | "standalone-simulated";
    lastChecked: string;
  }
  ```
- **Probing Rules**:
  - Periodically probes all 3 services via `fetch(url, { signal: AbortSignal.timeout(1500) })`.
  - If a service answers with HTTP 200 and `{ status: 'ok' }`, marks that specific service as `online`.
  - If all services fail, timeout, or throw CORS/Mixed-Content errors (standard when running from HTTPS `pages.dev`), the dashboard silently and instantly sets `mode = "standalone-simulated"`.
  - Never blocks the UI, never throws uncaught exceptions, and never shows broken spinners.
- **Visual Status Pill**:
  - Displays a subtle, clean hardware status badge in the header:
    `🟢 Local POS Engine :3001 Active` or `⚪ Standalone Simulation Mode (Offline Sandbox)`.

---

## 6. Cloudflare Pages Static Export Requirements

### 6.1 Configuration Review
In `landing/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
```

### 6.2 Key Constraints for Static Export:
1. **Zero Server Runtime Features**:
   - No `getServerSideProps`, `cookies()`, `headers()`, or dynamic server APIs.
   - All interactive pages and components must begin with `"use client"`.
2. **Suspense Boundaries for Search Parameters**:
   - Any component utilizing `useSearchParams()` (e.g. for reading `?role=cashier` or `?perspective=founder`) MUST be wrapped in a React `<Suspense fallback={...}>` boundary. Failure to do so causes `next build` to abort during static page generation.
3. **Trailing Slashes**:
   - With `trailingSlash: true`, Next.js creates directories with `index.html` (e.g. `out/dashboard/index.html`), ensuring Cloudflare Pages serves paths cleanly without `.html` extension redirects.
4. **No Native Node.js Modules**:
   - Client-side code must NOT import `node:crypto`, `node:fs`, `node:path`, or `electron`.
   - Use standard browser Web Crypto APIs (`window.crypto.subtle`) or pure TypeScript algorithms for hashing and formatting.
5. **Lint and Typecheck Cleanliness**:
   - `npm --prefix landing run lint` and `npm --prefix landing run build` must pass with 0 errors.

---

## 7. Recommended Data Interfaces & Contracts

### 7.1 Unified Dashboard Store Contract:
```typescript
export interface DashboardStoreState {
  // Navigation & Perspective
  perspective: "merchant" | "founder";
  setPerspective: (perspective: "merchant" | "founder") => void;
  selectedOutletId: string; // "all" or specific outlet id
  setSelectedOutletId: (outletId: string) => void;
  activeRolePersona: "cashier" | "waiter" | "chef" | "manager" | "accountant" | "driver";
  setActiveRolePersona: (role: "cashier" | "waiter" | "chef" | "manager" | "accountant" | "driver") => void;

  // Founder Admin Entities
  tenants: PlatformTenant[];
  addTenant: (tenant: Omit<PlatformTenant, "id" | "monthGmv" | "lastSync" | "status" | "licenseKeys" | "s3Metrics">) => void;
  updateTenantStatus: (tenantId: string, status: "Active" | "Suspended") => void;
  issueLicense: (params: { tenantId: string; planTier: "enterprise" | "pro" | "starter"; durationDays: number; hardwareId: string }) => string;

  // Restaurant Chain Entities
  outlets: ChainOutlet[];
  catalog: CentralMenuItem[];
  updatePriceOverride: (productId: string, outletId: string, price: number | null) => void;
  toggleItemAvailability: (productId: string, outletId: string, isAvailable: boolean) => void;

  // Operational Role State
  cartItems: CartItem[];
  updateCartItemQty: (itemId: string, delta: number) => void;
  clearCart: () => void;
  kdsTickets: KdsTicket[];
  bumpKdsTicket: (ticketId: string) => void;
  cashShift: CashShiftState;
  reconcileCashShift: (countedCents: number) => void;

  // Hybrid Telemetry Bridge
  backendTelemetry: BackendTelemetryState;
  refreshBackendTelemetry: () => Promise<void>;
}
```

---

## 8. Verification and Acceptance Plan

| Check | Tool / Command | Success Criteria |
|---|---|---|
| Static Build Verification | `npm --prefix landing run build` | Compiles with Turbopack, creates static export `out/` with 0 errors. |
| Lint Verification | `npm --prefix landing run lint` | ESLint passes with 0 warnings/errors. |
| Role Navigation | Browser test on `/dashboard/` | Switches cleanly between Chain Owner, Founder Admin, and 6 role dashboards. |
| Standalone Store Mutability | Browser test on `/dashboard/` | Generating a license, updating a menu price, or bumping a KDS ticket immediately mutates UI and persists to localStorage. |
| Hybrid Telemetry Fail-Safe | Browser test with backend down | Telemetry badge gracefully indicates "Standalone Simulation" without console errors. |
| License Format Compliance | Key Generator modal | Generates valid 16-character keys formatted as `OIUP-XXXX-XXXX-XXXX`. |
| S3 Bucket Isolation Preview | S3 Telemetry modal | Displays verified prefix `tenants/{tenantId}/` and isolated domain breakdown. |
