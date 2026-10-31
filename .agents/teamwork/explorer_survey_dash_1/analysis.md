# Technical Survey & Architecture Analysis: Role-Based Restaurant & Platform Dashboards in `landing/` for Cloudflare Pages

**Author**: Explorer 1 (Survey Phase)  
**Date**: 2026-10-31  
**Project**: Order It Up — Offline-First Restaurant POS & Billing  
**Scope**: Full architectural survey of `landing/`, Next.js 16 static export environment, role dashboard mounting strategy, existing component patterns in `frontend/`, and hybrid backend connectivity.

---

## 1. Executive Summary

This survey analyzes the technical foundation and concrete implementation strategy for deploying complete, end-to-end role-based restaurant and platform dashboards in `landing/` targeting production deployment on Cloudflare Pages.

### Key Survey Findings:
1. **Next.js 16 & Static Export Setup**: `landing/` is powered by Next.js 16.3.4 (with Turbopack), React 19.2.8, Tailwind CSS v4, and TypeScript 5.9.3. It is strictly configured with `output: "export"`, `trailingSlash: true`, and `images: { unoptimized: true }`. Both `npm --prefix landing run lint` and `npm --prefix landing run build` currently pass with 0 errors, generating static HTML files into `landing/out/`.
2. **Current Dashboard Route**: `landing/src/app/dashboard/page.tsx` exists as an initial prototype covering two high-level perspectives (Founder Admin and Restaurant Chain Owner), but lacks the 6 detailed operational persona dashboards (Front Cashier, Kitchen Chef KDS, Server/Waiter Floor Map, Accountant GST/Tally, Delivery Driver Dispatch, and Owner Shift Closures).
3. **Rich Reusable Assets in `frontend/`**: The desktop Next.js app (`frontend/src/`) and existing `landing/` components contain mature, tested patterns:
   - Authentic 80mm ESC/POS thermal receipt formatting with GST breakdown (`landing/src/components/BillTemplateModal.tsx`).
   - Tally XML voucher export structure (`frontend/src/app/cloud-portal/page.tsx:533-579`).
   - Split tenders (Cash, Card, UPI Dynamic QR) and 24V solenoid cash drawer pulse triggers (`frontend/src/components/pos/PaymentModal.tsx`).
   - Kitchen Display System Kanban board with SLA elapsed timers and station filtering (`frontend/src/components/kds/KdsKanbanBoard.tsx`).
   - Tableside dining floor map with room switching and turnover badges (`frontend/src/app/(dashboard)/tables/page.tsx`).
   - Online and courier delivery order dispatch queue (`frontend/src/app/(dashboard)/online-orders/page.tsx`).
4. **Cloudflare Pages Compatibility**: Because Cloudflare Pages static export serves pre-rendered HTML/JS from `landing/out/`, all interactive state, role switching, and local backend probing must be client-side safe (`"use client"`), with query-parameter access safely wrapped in `<Suspense>` boundaries to avoid de-optimizing static generation.
5. **Hybrid Architecture**: Dashboards must operate self-contained in the browser by default using an interconnected operational state model (changes in one role immediately reflect across KDS, Tables, Cashier, and Accountant), while seamlessly probing and binding to local backend services (Express `:3001`, KDS `:3002`, Server App `:3003`) when available.

---

## 2. Directory Structure & Configuration Review

### 2.1 File Tree of `landing/`
```text
landing/
├── eslint.config.mjs         # ESLint 9 configuration with core-web-vitals & typescript
├── next.config.ts            # Next.js 16 config with output: 'export' & trailingSlash: true
├── package.json              # Next 16.3.4, React 19.2.8, Tailwind v4, Lucide 1.40.0
├── postcss.config.mjs        # PostCSS 8 with @tailwindcss/postcss
├── tsconfig.json             # ES2022 target, bundler module resolution, path alias @/* -> ./src/*
├── public/
│   ├── _headers              # Cloudflare Pages HTTP cache headers (immutable chunks, revalidated HTML)
│   ├── logo.png              # High-res brand logo
│   └── logo.svg              # Vector brand logo
└── src/
    ├── app/
    │   ├── globals.css       # Tailwind v4 @import "tailwindcss", @theme design tokens
    │   ├── layout.tsx        # Root layout with Geist Sans & Geist Mono font variables
    │   ├── page.tsx          # Marketing home page
    │   └── dashboard/
    │       └── page.tsx      # Current dashboard prototype (perspective switcher)
    ├── components/
    │   ├── AuthModal.tsx
    │   ├── BillTemplateModal.tsx   # 80mm ESC/POS thermal receipt modal (Standard, GST, Z-Report, KOT)
    │   ├── CredentialsModal.tsx    # Role sandbox credentials & 1-click authentication
    │   ├── CtaSection.tsx
    │   ├── FeaturesGrid.tsx
    │   ├── Footer.tsx
    │   ├── HardwareMarquee.tsx
    │   ├── Hero.tsx
    │   ├── ModalProvider.tsx
    │   ├── Navbar.tsx              # Sticky nav with session badge & dashboard link
    │   ├── OfflineArchitecture.tsx # Architecture visualization (:3001, :3002, :3003)
    │   ├── RolePersonas.tsx        # Interactive persona showcase
    │   ├── TermsModal.tsx
    │   ├── TrustMetrics.tsx
    │   ├── UiPreviews.tsx          # Cart, KDS ticket, and Receipt interactive simulator
    │   └── reactbits/              # React Bits motion/visual primitives
    └── lib/
        ├── auth.ts                 # Demo users (owner, manager, cashier, server, chef, accountant, superadmin)
        ├── constants.ts            # BRAND, ROLE_PERSONAS, MOCK_ORDER, HARDWARE_SPECS
        ├── modalEvents.ts          # CustomEvent bus for cross-component modal triggers
        └── utils.ts                # cn() className merger (clsx + tailwind-merge)
```

### 2.2 Next.js 16 Static Export Configuration (`next.config.ts`)
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
- `output: "export"`: Compiles the application into a pure static bundle in `landing/out/`, ready for Cloudflare Pages, AWS S3, or Nginx. No Node.js server runtime required.
- `trailingSlash: true`: Generates clean directory-based HTML files (`/dashboard/index.html` instead of `/dashboard.html`). This is essential for Cloudflare Pages so direct navigation and browser refreshes work cleanly without rewrite rule workarounds.
- `images: { unoptimized: true }`: Ensures Next.js `<Image>` tags do not attempt server-side sharp image optimization during runtime on static edge.

### 2.3 Cloudflare Pages Caching (`public/_headers`)
```http
/*
  Cache-Control: public, max-age=0, must-revalidate

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/logo.png
  Cache-Control: public, max-age=86400
```
This guarantees instant cache invalidation of HTML documents upon new Git commits / Cloudflare deployments, while permanently caching content-hashed static JavaScript chunks.

### 2.4 Styling & Design System (`globals.css`)
Tailwind CSS v4 is configured with `@import "tailwindcss";` and custom `@theme` variables:
- **Canvas background**: `#F8FAFC` (`bg-[#F8FAFC]` / `--color-surface-canvas`)
- **Card surface**: `#FFFFFF` with border `border-slate-200/80` and subtle shadow (`shadow-xs` / `shadow-sm`)
- **Brand accent**: Vibrant Orange `#F07928` (`--color-brand`), hover `#EA580C`, light tint `#FFF2EA`
- **Success emerald**: `#00CC61` / `#10B981` (`--color-success`), light tint `#DCFCE7`
- **Typography**: Geist Sans (`var(--font-geist-sans)`) for UI text; Geist Mono (`var(--font-geist-mono)`) for numbers, currency, thermal receipts, timestamps, and licenses.

---

## 3. Mounting Strategy for Role-Based Dashboards & Admin Views

### 3.1 Recommended Routing Architecture

To satisfy both clean direct URLs and instant client-side role switching without page reloads, the optimal structure combines:
1. **Unified Hub Route**: `landing/src/app/dashboard/page.tsx`
   - Master dashboard coordinator that hosts an intuitive **Role & Perspective Bar**.
   - Syncs active view bidirectionally with URL query params (e.g. `/dashboard?role=cashier`, `/dashboard?role=chef`, `/dashboard?perspective=founder`).
   - Automatically initializes to the authenticated user's assigned role stored in `localStorage` via `getStoredUser()`, or defaults to `merchant` / `owner` for anonymous visitors.
2. **Dedicated Static Subroutes**:
   - `landing/src/app/dashboard/owner/page.tsx` -> builds to `out/dashboard/owner/index.html`
   - `landing/src/app/dashboard/cashier/page.tsx` -> builds to `out/dashboard/cashier/index.html`
   - `landing/src/app/dashboard/kitchen/page.tsx` -> builds to `out/dashboard/kitchen/index.html`
   - `landing/src/app/dashboard/waiter/page.tsx` -> builds to `out/dashboard/waiter/index.html`
   - `landing/src/app/dashboard/accountant/page.tsx` -> builds to `out/dashboard/accountant/index.html`
   - `landing/src/app/dashboard/delivery/page.tsx` -> builds to `out/dashboard/delivery/index.html`
   - `landing/src/app/dashboard/chain-owner/page.tsx` -> builds to `out/dashboard/chain-owner/index.html`
   - `landing/src/app/dashboard/platform-admin/page.tsx` -> builds to `out/dashboard/platform-admin/index.html`

Each subroute wraps the corresponding modular persona component in the shared dashboard layout, allowing users to bookmark or share direct links (`/dashboard/kitchen/` or `/dashboard/cashier/`), while the root `/dashboard` provides seamless, instantaneous tab-switching.

### 3.2 Suspense Boundary Requirement for Static Export
In Next.js 16 App Router with `output: "export"`, any component calling `useSearchParams()` must be wrapped in a `<Suspense>` boundary. If not wrapped, Next.js aborts static page pre-rendering at build time.

**Pattern for `landing/src/app/dashboard/page.tsx`**:
```typescript
import { Suspense } from "react";
import DashboardContent from "./DashboardContent";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
```

---

## 4. Existing Assets & Component Patterns in `frontend/` and `main/`

### 4.1 80mm ESC/POS Thermal Receipt & Solenoid Drawer
- **Location**: `landing/src/components/BillTemplateModal.tsx` & `frontend/src/components/pos/PaymentModal.tsx`
- **Features**:
  - Authentic monospace receipt rendering matching standard 80mm paper width (48 characters/line).
  - Indian GST breakdown with CGST (2.5%) and SGST (2.5%), SAC code `996331` (Restaurant Service).
  - FSSAI License Number display (e.g. `10019011000234`).
  - Cash Drawer Kick instruction (ESC/POS `0x1B 0x70 0x00 0x19 0xFA` for 24V solenoid).
  - Dynamic UPI QR Code payload rendering (`upi://pay?pa=...&pn=...&am=...&cu=INR`).

### 4.2 Tally XML Export Generation
- **Location**: `frontend/src/app/cloud-portal/page.tsx:533-579`
- **Implementation Pattern**:
  Generates standard Tally ERP 9 / Tally Prime XML import envelopes for automated journal/receipt voucher creation:
  - Header: `<TALLYREQUEST>Import Data</TALLYREQUEST>`
  - Body: `<IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>`
  - Ledger Entries:
    - `Cash Counter Drawer` (Positive credit)
    - `Digital / UPI Clearing Account` (Positive credit)
    - `Restaurant F&B Food Sales` (Negative sales income)
    - `Output CGST 2.5%` & `Output SGST 2.5%` ledgers.
  - Generates downloadable `.xml` blob file with standard date naming (`Tally_POS_Export_YYYY-MM-DD.xml`).

### 4.3 Kitchen Display System (KDS) & SLA Timers
- **Location**: `frontend/src/components/kds/KdsKanbanBoard.tsx` & `main/kds-server.ts`
- **Features**:
  - Drag-and-drop or one-tap ticket bumping across 4 operational states: `pending` -> `preparing` -> `ready` -> `served`.
  - Color-coded SLA alerts: `< 8 min` (green), `8 - 15 min` (amber), `> 15 min` (urgent red pulse).
  - Station routing tags: `Oven / Pizza`, `Tandoor / Grill`, `Bar / Beverage`, `Main Kitchen`.
  - Item modifiers, allergy alerts, and special instructions highlighted as high-contrast chips.

### 4.4 Tableside Floor Plan & Course Firing
- **Location**: `frontend/src/app/(dashboard)/tables/page.tsx` & `main/server-app.ts`
- **Features**:
  - Floor section tabs: `Main Dining (Indoor)`, `Patio Garden`, `Rooftop Terrace`, `Private Dining Room`.
  - Interactive table cards showing Table Number, Pax Capacity, Current Status (`Available`, `Occupied`, `Billed`, `Reserved`, `Cleaning`).
  - Active dining duration timer with table turnover velocity.
  - Course firing actions: "Fire Starters", "Fire Mains", "Fire Desserts" with visual notification badges.

### 4.5 Delivery Driver Dispatch & COD Reconciliation
- **Location**: `frontend/src/app/(dashboard)/online-orders/page.tsx`
- **Features**:
  - Dispatch queue: Order number, customer name, delivery address, phone verification / privacy masking.
  - Dispatch timeline: `Assigned` -> `At Store / Packing` -> `Out for Delivery` -> `Delivered`.
  - Payment mode indicators: `Prepaid (UPI / Card)` vs `Cash on Delivery (COD)`.
  - Driver COD cash collection reconciliation ledger tracking total cash collected on the road.

### 4.6 Multi-Branch Chain Management & Platform Admin
- **Location**: `landing/src/app/dashboard/page.tsx` & `frontend/src/app/cloud-portal/page.tsx`
- **Features**:
  - Multi-outlet comparison across 3 branches: Downtown Bistro, Cyber Hub Express, Airport Terminal 3.
  - Centralized catalog with per-branch price overrides.
  - 16-character hardware-bound desktop POS license key generator (`OIU-2026-WIN-XXXX-XXXX`).
  - Isolated Amazon S3 tenant storage buckets (`orderitup-tenant-...`) ensuring zero multi-tenant data commingling.

---

## 5. Local Backend Services & Hybrid Connectivity

### 5.1 Service Topology
When running locally with Order It Up's desktop/dev server, three background services run on standard ports:

| Service | Port | Protocol | Authority | Key Endpoints / Health |
|---|---|---|---|---|
| **Main POS API** | `:3001` | HTTP / REST | Express + SQLite WAL | `GET /api/health`<br>`GET /settings`<br>`GET /orders`<br>`GET /bills` |
| **Kitchen Server** | `:3002` | HTTP + WebSocket | Standalone KDS | `GET /api/auth/me`<br>`GET /api/orders`<br>`PATCH /api/orders/:id/items/:item/status`<br>`ws://localhost:3002` |
| **Server App** | `:3003` | HTTP / Micro-REST | Tableside Waiter | `GET /api/server-app/info`<br>`GET /api/tables`<br>`POST /api/orders` |

### 5.2 Hybrid Synchronization Mechanism
To guarantee the dashboard is 100% functional both when deployed statically on Cloudflare Pages and when used locally on a restaurant counter machine:

1. **Automatic Probe on Mount**:
   A lightweight client-side hook (`useBackendConnection`) attempts a short-timeout (1000ms) health probe against `http://localhost:3001/api/health`, `http://localhost:3002`, and `http://localhost:3003`.
2. **Safe Error Handling**:
   Browser security (e.g. Mixed Content or CORS when browsing https://... on Cloudflare Pages) is caught in `try...catch`. If unreachable, the dashboard seamlessly activates **Standalone Realistic State Engine**.
3. **Reactive Standalone State Engine**:
   - An interconnected client-side store maintaining state across tables, orders, KDS tickets, cashier bills, and shift closures.
   - For example:
     - When a waiter marks Table T-04 as ordered with 2x Paneer Tikka, Table T-04 transitions to "Occupied".
     - Ticket #105 instantly appears in Kitchen Chef's KDS queue under "Tandoor Station".
     - Cashier sees Order #105 ready for counter settlement.
     - Settle with UPI QR -> Accountant Z-Report ledger updates CGST/SGST amounts and Tally XML ledger in real time.
4. **Live Status Indicator Component**:
   A clean badge in the dashboard header clearly informs the user:
   - 🟢 `Connected: Local POS (:3001) • KDS (:3002) • Waiter (:3003)` (when running locally)
   - ⚡ `Edge Simulation Mode • Offline Durable • Zero Cloud Lag` (when running on Cloudflare Pages)

---

## 6. Proposed Component Hierarchy & Modular Architecture

```text
landing/src/
├── app/
│   └── dashboard/
│       ├── page.tsx                    # Master coordinator (with Suspense boundary)
│       ├── owner/page.tsx              # Direct route for Owner / Manager
│       ├── cashier/page.tsx            # Direct route for Front Cashier
│       ├── kitchen/page.tsx            # Direct route for Kitchen Chef (KDS)
│       ├── waiter/page.tsx             # Direct route for Server / Waiter
│       ├── accountant/page.tsx         # Direct route for Accountant & Tax
│       ├── delivery/page.tsx           # Direct route for Delivery Driver
│       ├── chain-owner/page.tsx        # Direct route for Restaurant Chain Owner
│       └── platform-admin/page.tsx     # Direct route for Founder Platform Admin
├── components/
│   └── dashboard/
│       ├── DashboardHeader.tsx         # Persistent top bar (logo, role selector, connectivity badge, quick tools)
│       ├── RoleNavigation.tsx          # 8-tab role & perspective pill switcher
│       ├── ConnectionStatusBadge.tsx   # Local backend probe & status chip
│       ├── views/
│       │   ├── OwnerDashboardView.tsx        # Persona 1: Multi-outlet summary, staff PINs, shift closures, S3
│       │   ├── CashierDashboardView.tsx      # Persona 2: Split tender, 80mm ESC/POS preview, 24V drawer pulse
│       │   ├── KitchenDashboardView.tsx      # Persona 3: KDS Kanban ticket queue, station filters, bumping
│       │   ├── WaiterDashboardView.tsx        # Persona 4: Table floor map, turnover timers, course firing
│       │   ├── AccountantDashboardView.tsx    # Persona 5: Indian GST (CGST/SGST 2.5%), FSSAI, Z-Report, Tally XML
│       │   ├── DeliveryDashboardView.tsx      # Persona 6: Dispatch queue, address verification, COD tally
│       │   ├── ChainOwnerDashboardView.tsx    # Admin 1: Multi-branch sales, menu catalog overrides, consolidated GST
│       │   └── PlatformAdminDashboardView.tsx # Admin 2: Tenant directory, 16-char license generator, S3 isolation
│       └── modals/
│           ├── StaffPinModal.tsx             # Staff PIN management & role assignment
│           ├── S3BackupModal.tsx             # S3 tenant backup manual trigger
│           ├── TallyExportModal.tsx          # Tally XML preview and direct download
│           └── CashDrawerReconciliationModal.tsx # Drawer balance & count sheet
└── lib/
    ├── dashboard-store.ts              # Interconnected reactive state store (React context / hooks)
    ├── backend-probe.ts                # Auto-discovery for :3001, :3002, :3003
    ├── tally-xml.ts                    # Tally ERP 9 / Prime XML voucher generator
    └── receipt-escpos.ts               # ESC/POS 80mm receipt bytecode / preview formatter
```

---

## 7. Acceptance Criteria Mapping

| Requirement | Acceptance Criteria | Proposed Implementation Reference |
|---|---|---|
| **R1.1 Owner / Manager** | Multi-restaurant chain overview, live sales, staff PINs, shift closures, S3 backup status | `OwnerDashboardView.tsx` with branch rollups, staff role matrix, shift closure history, S3 backup trigger |
| **R1.2 Front Cashier** | Split tenders (UPI Dynamic QR, Cash, Card), 80mm ESC/POS receipt preview, 24V drawer pulse | `CashierDashboardView.tsx` with live cart, split tender calculator, drawer pulse simulation, receipt modal |
| **R1.3 Kitchen Chef** | KDS order queue, station routing (Oven, Tandoor, Bar), ticket bumping, prep timers | `KitchenDashboardView.tsx` with Kanban columns, station pills, color-coded SLA timers, bump animations |
| **R1.4 Server / Waiter** | Visual floor table map, occupancy states, turnover duration, course firing | `WaiterDashboardView.tsx` with room layouts, table occupancy colors, course firing buttons (Starters/Mains/Desserts) |
| **R1.5 Accountant** | Indian GST (CGST 2.5%, SGST 2.5%), SAC 996331, FSSAI verification, Z-Report, Tally XML | `AccountantDashboardView.tsx` with tax ledger, FSSAI display, Z-Report balancing, one-click Tally XML download |
| **R1.6 Delivery Driver** | Dispatch queue, customer address verification, COD reconciliation | `DeliveryDashboardView.tsx` with rider dispatch cards, address verification badge, COD cash collection tally |
| **R2.1 Founder Admin** | Tenant directory, 16-char hardware POS licenses, S3 customer bucket tracking, platform GMV | `PlatformAdminDashboardView.tsx` with tenant table, license key generator with copy, S3 bucket telemetry |
| **R2.2 Chain Owner** | Multi-branch live sales, branch comparison metrics, central menu sync with overrides, consolidated GST | `ChainOwnerDashboardView.tsx` with 3 branch cards, price override editor, consolidated chain GST rollup |
| **R3 Hybrid State** | Self-contained in browser by default, connects to local backend (:3001, :3002, :3003) when present | `backend-probe.ts` + `dashboard-store.ts` with interconnected realistic mock models & live fallback |
| **R4 Design System** | `#F8FAFC` canvas, `border-slate-200/80` white cards, `#F07928` brand accents, Geist font | Adheres strictly to Tailwind tokens in `globals.css` and Geist fonts |
| **Verification** | `npm --prefix landing run lint` & `npm --prefix landing run build` pass with 0 errors | Verified: build succeeds, exports clean static HTML files to `landing/out/` |

---

## 8. Conclusion

The `landing/` directory is clean, modern, and in full working order. Next.js 16 static export is already configured with `output: "export"` and `trailingSlash: true`. The existing codebase in `frontend/` and `landing/` contains all the domain logic, styling tokens, and export structures needed to implement complete, authentic, role-based dashboards.

Following this survey, the implementers can proceed with building the modular dashboard components, interconnected state store, and route mounts with total confidence in Cloudflare Pages static export compatibility.
