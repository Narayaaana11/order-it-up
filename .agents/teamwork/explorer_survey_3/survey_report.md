# Requirement R3 Survey Report: User Dashboards Showcase & Role-Based Routing

**Author**: Explorer 3 (Roles, Dashboards & Showcase Explorer)  
**Date**: 2026-10-30  
**Status**: Comprehensive Survey & Architecture Specification  
**Working Directory**: `.agents/teamwork/explorer_survey_3/`  
**Reference Documents**: `users.md`, `agents.md`, `docs/user-access-guide.md`, `shared/role-permissions.ts`

---

## 1. Executive Summary

Requirement R3 of the Order It Up project mandates:
1. Connecting the authentication and post-login navigation to role-based dashboards defined in `users.md`:
   - **Owner / Super Admin**: Cloud HQ Franchise Portal (`/cloud-portal`) & Store Management (`/dashboard`)
   - **Manager**: Store Dashboard & Operational Control (`/dashboard`, `/reports`)
   - **Accountant**: Financial & Tax Summaries (`/reports`)
   - **Cashier**: Counter POS Billing (`/pos`)
   - **Waiter / Server**: Table Floor Plan & Live Orders (`/tables`, `/orders`)
   - **Kitchen Chef**: Kitchen Display System (`/kds`, `/kds-standalone`)
   - **Guest / Customer**: Digital Menu & QR Dining (`/menu`, `/qr`)
2. Designing the optimal routing and handling for operational roles on the web platform (`orderitup.pages.dev`), respecting the architectural platform boundaries defined in `users.md` (no web POS billing; desktop/mobile POS only).
3. Designing an interactive dashboard showcase and role preview tabs selector on the landing page (`frontend/src/app/page.tsx` and `frontend/src/components/landing/`) allowing prospective restaurant operators to preview how each role experiences Order It Up with live metrics, mock screens, workflow steps, and deep links.

This report documents our codebase survey, audit of existing frontend routes, runtime compatibility analysis, and complete architectural recommendations for implementation.

---

## 2. In-Depth Analysis of User Roles & Permissions (`users.md`)

### 2.1 Architectural Boundary: POS Hardware vs. Web Platform
Per `users.md` Section 1:
- **Desktop POS Client (Electron / Node 22)**: Offline-first counter billing, local SQLite WAL database, direct ESC/POS thermal printing (USB/LAN), 24V cash drawer pulse, hardware barcode scanner & weighing scale support.
- **Mobile POS App (Flutter Android/iOS)**: Handheld waiter table ordering, real-time floor plan, chef KDS ticket bumping, mobile POS checkout.
- **Cloud Web Application (Next.js 16 / React 19 Static Export - `orderitup.pages.dev`)**: SaaS Control Plane, Owner & Manager Dashboards, CRM, Master Catalog Management, Staff Management, Financial & Tax Auditing (`/reports`), Franchise Multi-Location HQ (`/cloud-portal`). **Strictly no web-based POS billing.**

### 2.2 Operational Role Personas & Credential Reference

| Role / Persona | Internal Role Key | Primary Client App | Target Dashboard Route(s) | Operational Scope & Authority | Demo / Seed Credential |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Administrator** | `SUPER_ADMIN` / `super_admin` | Web Cloud HQ Portal | `/cloud-portal` | Global tenant lifecycle, platform health, database audits | `admin@orderitup.in` / `AdminPass123!` |
| **Central Admin** | `ADMIN` / `admin` | Web Cloud HQ Portal | `/cloud-portal` | Platform ops, tenant support escalation | `admin@orderitup.local` / `AdminPass123!` |
| **Finance Operator** | `FINANCE` | Web Cloud HQ Portal | `/cloud-portal` (Tab: Accountant) | SaaS subscription billing, franchise royalty audits | `finance@orderitup.in` / `AdminPass123!` |
| **Support Operator** | `SUPPORT` | Web Cloud HQ Portal | `/cloud-portal` | Pairing token regeneration, diagnostics | `support@orderitup.in` / `AdminPass123!` |
| **Compliance Auditor** | `READ_ONLY` | Web Cloud HQ Portal | `/cloud-portal` | Read-only inspection of tenant metrics and logs | `readonly@orderitup.in` / `AdminPass123!` |
| **Restaurant Owner** | `owner` | Web Dashboard & Desktop App | `/cloud-portal` & `/dashboard` | Root authority over branches, menus, taxes, staff, finances | `demo.owner@orderitup.in` / `DemoOwner2026!` |
| **Branch Manager** | `manager` / `branch_manager` | Web Dashboard & Desktop App | `/dashboard`, `/reports`, `/orders`, `/tables` | Operational supervisor: staff shifts, refunds, discounts, tables | `demo.manager@orderitup.in` / `DemoManager2026!` |
| **Head Accountant** | `accountant` | Web Cloud Dashboard | `/reports` | GST/tax summaries (CGST, SGST, IGST), ledger audits, Tally XML | `demo.accountant@orderitup.in` / `DemoAccountant2026!` |
| **Counter Cashier** | `cashier` | Desktop POS App (& Flutter) | `/pos` (Desktop) / Web guidance card | Counter billing, split tenders, cash drawer, shift closures | `demo.cashier@orderitup.in` / `DemoCashier2026!` |
| **Floor Waiter / Server** | `server` / `waiter` | Flutter Mobile App / Web | `/tables`, `/orders` (Web: `/server-standalone`) | Table ordering, course firing, spice/allergy notes, floor map | `demo.server@orderitup.in` / `DemoServer2026!` |
| **Kitchen Station Chef** | `chef` / `kitchen` | Flutter KDS / Desktop KDS | `/kds`, `/kds-standalone` | Order ticket queue, ticket bumping, station routing | `demo.chef@orderitup.in` / `DemoChef2026!` |
| **Delivery Driver** | `delivery` | Mobile Driver App | Mobile / Dispatch | Package pickup verification, COD tally, customer privacy | Native App |
| **Customer / Guest** | `customer` | Mobile Browser | `/menu`, `/qr` | Contactless digital menu, table self-ordering, UPI QR | Public / Anonymous |

---

## 3. Frontend Route Survey & Compatibility Audit

We conducted a line-by-line inspection of each target route in `frontend/src/app/`:

### 3.1 Route-by-Route Findings

#### 1. Cloud HQ Portal (`/cloud-portal`)
- **File**: `frontend/src/app/cloud-portal/page.tsx` (1,160 lines)
- **Layout**: `frontend/src/app/cloud-portal/layout.tsx` (dedicated full-screen layout, independent of POS sidebar)
- **Status**: **Fully functional on web**. Already in `PUBLIC_PATHS` of `AuthGuard.tsx`.
- **Features**: Multi-branch overview, cross-store revenue metrics, item velocity rank, cash closure reconciliation, catalog price override matrix, stock transfer logs, and 6-digit hardware pairing PIN generator with countdown timer.
- **Graceful Fallback**: If backend edge worker API is unreachable, automatically activates realistic demo state (`isDemoMode`).

#### 2. Store Dashboard (`/dashboard`)
- **File**: `frontend/src/app/(dashboard)/dashboard/page.tsx` (774 lines)
- **Layout**: `(dashboard)/layout.tsx` (enclosed in `AuthGuard`, `AppSidebar`, `TitleBar`, `StatusBar`)
- **Current Issue Discovered**: Lines 216–220 enforce:
  ```ts
  useEffect(() => {
    if (currentTenant && !isOwner) {
      router.replace('/pos');
    }
  }, [currentTenant, isOwner, router]);
  ```
  `isOwner` is strictly `hasRole(currentTenant?.role, ROLE_ACCESS.owner)` (`['owner']`).
  When a **Manager** logs in on Web and navigates to `/dashboard`, they get redirected to `/pos`, which on Web displays the "Desktop & Mobile POS Only" screen!
- **Fix Recommendation**: Update `isOwner` or create `canViewDashboard = hasRole(currentTenant?.role, ROLE_ACCESS.ownerManager)` (`['owner', 'manager']`) so Branch Managers have full operational access to `/dashboard`.

#### 3. Financial & Tax Reports (`/reports`)
- **File**: `frontend/src/app/(dashboard)/reports/page.tsx` (518 lines)
- **Status**: **Clean & Web Compatible**.
- **Features**: Financial Stats (Gross collected, refunds, net collected, AOV), Payment Method breakdown, Tax Liability breakdown (CGST, SGST, IGST), Top Products, Top Staff, and 1-click CSV export.
- **Access**: Ideal landing route for the `accountant` role and accessible to `owner` and `manager`.

#### 4. Counter POS Billing (`/pos`)
- **File**: `frontend/src/app/(dashboard)/pos/page.tsx` (1,215 lines)
- **Status**: **Dual Behavior Implemented**:
  - In Electron Desktop (`isElectronEnvironment()` is true): full POS grid, barcode scan, scale weight, thermal print integration.
  - In Web Browser (`!isElectronEnvironment()`, lines 974–1003): Renders a dedicated "Desktop & Mobile POS Only" informational card explaining that POS billing requires hardware drivers, with CTA buttons linking to `/dashboard` and `/cloud-portal`.
- **Recommendation**: Maintain this invariant. For landing page visitors, provide an interactive cart simulator in the showcase preview instead of sending them to an empty POS screen.

#### 5. Table Floor Plan & Reservations (`/tables`)
- **File**: `frontend/src/app/(dashboard)/tables/page.tsx` (710 lines)
- **Status**: **Clean & Web Compatible**.
- **Features**: Room floor plan editor (`FloorplanEditor.tsx`), visual status pills (Available, Occupied, Reserved, Held, Cleaning), table capacity, dining duration alerts (`TableTurnoverBadge`), and reservation modal.
- **Access**: Ideal landing route for `server` / `waiter` and `manager`.

#### 6. Live Orders Queue (`/orders`)
- **File**: `frontend/src/app/(dashboard)/orders/page.tsx` (2,272 lines)
- **Status**: **Dual Environment Support**.
- **Features**: Displays active tickets, order status progression, item modifier flags, invoice reprint, WhatsApp bill sharing, and branch switching.
- **Access**: Accessible by `owner`, `manager`, `cashier`, `server`.

#### 7. Kitchen Display System (`/kds` and `/kds-standalone`)
- **Files**: `frontend/src/app/(dashboard)/kds/page.tsx` (85 lines) and `frontend/src/app/kds-standalone/page.tsx` (89 lines)
- **Status**: Standalone KDS is in `PUBLIC_PATHS` of `AuthGuard.tsx`.
- **Features**: Real-time kitchen tickets, Kanban and Tab views, SLA timers (<8m green, 8–15m amber, >15m red), station routing (Bar, Grill, Fryer, Main Kitchen).
- **Access**: Primary interface for `chef` / `kitchen`.

#### 8. Digital Menu & QR Dining (`/menu` and `/qr`)
- **Files**: `frontend/src/app/menu/page.tsx` (1,616 lines) and `frontend/src/app/qr/page.tsx` (640 lines)
- **Status**: Standalone mobile-optimized interfaces. `/qr` is in `PUBLIC_PATHS`.
- **Note**: `/menu` should also be added to `PUBLIC_PATHS` in `AuthGuard.tsx` so prospective merchants and customers can explore the digital menu without an auth barrier.
- **Features**: Swiggy/Zomato style food menu, dietary tags (Veg, Vegan, Non-Veg, Egg), search, allergen chips, add-on customization modal, and interactive ordering tray.

---

## 4. Current Landing Page Component Audit

In `frontend/src/components/landing/`:
1. `Navbar.tsx`:
   - Contains a link for "Owner Login" (`/auth/login`), but **lacks a Signup button** (`/auth/register`).
   - Lacks direct links to the new Role Showcase section.
2. `Hero.tsx`:
   - Contains CTAs: "Download Desktop POS" (`#download`) and "Explore Interactive Demo" (`#ui-preview`).
   - Lacks prominent direct action buttons for "Sign Up Free" (`/auth/register`) and "Sign In" (`/auth/login`).
3. `TrustMetrics.tsx`:
   - Renders 4 metric cards (`100% Offline Durability`, `0.0s Cloud Risk`, `< 10ms Latency`, `100+ Installs`), but currently uses static text without animated number counters or hover elevation.
4. `FeaturesGrid.tsx` & `OfflineArchitecture.tsx`:
   - Clean architecture, but can benefit from React Bits ambient spotlighting and glassmorphic hover effects.
5. `RolePersonas.tsx`:
   - Currently renders a simple tab selector with 6 roles, but only displays a list of textual responsibilities.
   - **Does not provide an interactive dashboard preview, mock screens, live metrics, workflow steps, or deep links.**
6. `UiPreviews.tsx`:
   - Contains a 3-tab simulator (Cart, KDS, Thermal Receipt) with good interactive logic.
7. `CtaSection.tsx`:
   - Only displays desktop download links (Windows, macOS, Linux). Lacks web registration CTA.

---

## 5. Architectural Design: Interactive Dashboard Showcase (Requirement R3)

To fulfill Requirement R3 and Acceptance Criteria 3, we recommend upgrading the Role section into an **Interactive Role Dashboard Showcase** (`DashboardShowcase.tsx` or an expanded `RolePersonas.tsx`).

### 5.1 Component Structure

```
DashboardShowcase
├── Section Header (Shiny Badge, High-Impact Title, Subtitle)
├── Role Selector Tab Bar
│   ├── [Owner / Super Admin] (Icon: Store/Building2, Badge: Franchise HQ)
│   ├── [Branch Manager]     (Icon: UserCog, Badge: Operations)
│   ├── [Counter Cashier]    (Icon: CreditCard, Badge: Sub-3s Billing)
│   ├── [Floor Waiter]       (Icon: Smartphone, Badge: Tableside POS)
│   ├── [Kitchen Chef]       (Icon: ChefHat, Badge: Zero-Lag KDS)
│   └── [Head Accountant]    (Icon: FileSpreadsheet, Badge: GST & Tally)
├── Active Role Experience Stage (Glassmorphic Elevated Card)
│   ├── Role Meta Bar: Title, Scope, Platform Boundary Pill, Deep Link CTA
│   ├── Interactive Live Mock Canvas (Role-specific interactive widget)
│   │   ├── Owner: Multi-Branch Rollup, Live Sales Ticker, 6-digit Device Pairing PIN Simulator
│   │   ├── Manager: Live Table Turnover, Shift Reconciliation, Staff Audit Log
│   │   ├── Cashier: Instant Split Tender Calculator (Cash + UPI QR + Card) & Thermal Slip Preview
│   │   ├── Waiter: Interactive Floor Plan with toggleable Table States (Vacant → Occupied → Billed)
│   │   ├── Chef: Real-Time KDS Ticket with 1-tap Status Bumping (<8m SLA Timer)
│   │   └── Accountant: Split GST Summary (CGST 2.5% + SGST 2.5%) & 1-Click Tally XML Export
│   ├── Operational Metrics Ribbon (3 role-specific KPIs with animated counters)
│   └── Workflow Step Progression (4 sequential steps of how this role operates during peak hours)
└── Platform Boundary Reassurance Box (Explains Electron vs Mobile vs Web SaaS scope)
```

### 5.2 Role-Specific Interactive Mock Canvases

1. **Owner / Super Admin Mock Canvas**:
   - Shows 3 branch cards (Connaught Place Main, Gurugram CyberHub, Indiranagar 100ft).
   - Live revenue sum (₹2,84,500) and branch sales percentage distribution.
   - Interactive "Generate Terminal PIN" button that generates a temporary 6-digit cryptographic pairing code with a countdown bar.
   - Primary Deep Link: `Open Cloud HQ Portal` (`/cloud-portal`).

2. **Branch Manager Mock Canvas**:
   - Live shift overview: Active Staff (8/8), Void Approval Requests (1 pending), Discounts Applied (₹1,450).
   - Quick action: "Approve Bill Refund" simulation with Manager PIN verification indicator.
   - Primary Deep Link: `View Store Dashboard` (`/dashboard`).

3. **Counter Cashier Mock Canvas**:
   - Mini speed-billing cart: Order #104 (₹1,040.00).
   - Interactive Split Tender buttons: `[Cash: ₹500]` + `[UPI QR: ₹540]`.
   - Click "Settle & Print" -> triggers simulated 80mm thermal receipt animation with 24V drawer pulse sound/badge.
   - Primary Deep Link: `Explore Billing Flow` (Deep link to demo / download).

4. **Floor Waiter / Server Mock Canvas**:
   - 6-table floor canvas: T-01 (Vacant), T-02 (Occupied, 42 min), T-03 (Billed), T-04 (Occupied, 18 min), T-05 (Vacant), T-06 (Cleaning).
   - Clicking a table toggles its state and shows tableside order details (Pax: 4, Courses: 3).
   - Primary Deep Link: `Explore Table Floorplan` (`/tables`).

5. **Kitchen Station Chef Mock Canvas**:
   - Live ticket #104 with 3 items:
     - Truffle Pizza (`preparing`, 4 min elapsed - Green)
     - Paneer Tikka (`ready`, 11 min elapsed - Amber)
     - Cold Brew (`served`, Ready for dispatch)
   - Click item or "Bump Ticket" -> progresses stage immediately with visual feedback.
   - Primary Deep Link: `Open Live KDS` (`/kds`).

6. **Head Accountant Mock Canvas**:
   - Live GST Breakdown: Taxable Value ₹1,24,000, CGST 2.5% (₹3,100), SGST 2.5% (₹3,100), Total Tax ₹6,200.
   - Cash Float Reconciliation: Expected ₹42,500, Counted ₹42,500 (Variance: ₹0.00 Balanced).
   - Interactive "Export Tally XML" button: generates simulated download toast with zero latency.
   - Primary Deep Link: `Open Financial Reports` (`/reports`).

---

## 6. Architectural Design: Post-Login Role-Based Routing

### 6.1 Role Discovery Mechanism
When a user logs in via `/auth/login` (or `/auth/register`):
1. The backend API returns `{ user, tenant, access_token }`.
2. `user.role` contains the operational role key (`super_admin`, `admin`, `owner`, `manager`, `accountant`, `cashier`, `server`, `chef`).
3. `tenant.role` contains the tenant-scoped role (defaults to `owner` or assigned staff role).
4. `useAuthStore` stores `user` and `currentTenant` in Zustand and `localStorage`.

### 6.2 Proposed Central Routing Engine (`lib/role-routing.ts`)

We specify a dedicated helper function: `getRoleDefaultRoute(user: User | null, tenant: Tenant | null, isElectron: boolean): string`:

```ts
export function getRoleDefaultRoute(
  user: { role?: string } | null,
  tenant: { role?: string } | null,
  isElectron: boolean
): string {
  const role = (tenant?.role || user?.role || '').toLowerCase();

  switch (role) {
    case 'super_admin':
    case 'admin':
    case 'finance':
    case 'support':
    case 'read_only':
      return '/cloud-portal';

    case 'owner':
      // In Electron Desktop, default to store dashboard; on Web, default to Cloud HQ
      return isElectron ? '/dashboard' : '/cloud-portal';

    case 'manager':
    case 'branch_manager':
      return '/dashboard';

    case 'accountant':
      return '/reports';

    case 'cashier':
      // Cashier on desktop goes to POS; on web, go to /orders or /pos (with guidance)
      return isElectron ? '/pos' : '/pos';

    case 'server':
    case 'waiter':
      return '/tables';

    case 'chef':
    case 'kitchen':
      return '/kds';

    case 'customer':
      return '/menu';

    default:
      return isElectron ? '/pos' : '/dashboard';
  }
}
```

### 6.3 Update to `AuthGuard.tsx` & `getLandingPage()`
In `frontend/src/components/layout/AuthGuard.tsx`:
1. Update `getLandingPage()` to call `getRoleDefaultRoute()`.
2. Add `/menu` to `PUBLIC_PATHS`:
   ```ts
   const PUBLIC_PATHS = [
     '/',
     '/kds',
     '/kds-standalone',
     '/server-standalone',
     '/auth/login',
     '/auth/register',
     '/auth/recover',
     '/setup',
     '/qr',
     '/menu',          // Added for public digital menu preview
     '/cloud-portal',
   ];
   ```

### 6.4 Role / Context Switcher for Multi-Permission Users
When an `owner` or `manager` logs in, they have cross-functional authority.
To avoid trapping them in a single view:
1. In `frontend/src/components/layout/Sidebar.tsx` and `frontend/src/app/cloud-portal/page.tsx`:
   - Include a prominent **"View As / Switch Role Context"** dropdown or header pill:
     - `Cloud HQ (Owner)` -> `/cloud-portal`
     - `Store Operations (Manager)` -> `/dashboard`
     - `Floor & Tables (Waiter)` -> `/tables`
     - `Kitchen Queue (Chef)` -> `/kds`
     - `Tax & Reports (Accountant)` -> `/reports`
2. This allows owners, franchise operators, and demo testers to instantly switch between operational personas without re-authenticating.

---

## 7. Cloudflare Pages (`orderitup.pages.dev`) Compatibility Analysis

1. **Static Export Mode**:
   - `next.config.ts` enforces `output: 'export'` when `NEXT_BUILD_MODE=web` or `NEXT_BUILD_MODE=desktop`.
   - Every page in `frontend/src/app/` must be a client component (`'use client'`) or statically prerenderable.
   - Any dynamic route parameters (like `searchParams`) must be wrapped in `<Suspense>`.
2. **Network Resilience**:
   - On `orderitup.pages.dev`, the desktop backend (`http://localhost:3001`) is NOT running locally in the user's browser.
   - Any call to `api.get()` or `cloudApi.get()` must have `catch()` handlers that fallback to rich mock data instead of crashing or showing blank screens.
   - All role previews on the landing page MUST be 100% self-contained in React state, requiring zero network calls to render and interact.

---

## 8. Verification & Validation Protocol

To satisfy Requirement R4 and acceptance criteria:
1. **Frontend Linting**:
   ```sh
   npm --prefix frontend run lint
   ```
   Must pass with 0 errors and 0 warnings.
2. **Static Export Build**:
   ```sh
   npm run build:frontend
   ```
   Must compile Next.js 16 and export static HTML/JS bundles to `frontend/out/` with zero missing exports or unhandled `useSearchParams` boundaries.
3. **Smoke & Dual-Server Test**:
   ```sh
   node tests/run-electron-node-test.cjs tests/smoke-test.test.ts
   ```
   Ensures port `:3001` (Main API) and port `:3002` (KDS) dual-server architecture and owner authentication remain regression-free.

---

## 9. Summary Table: Requirement R3 Implementation Blueprint

| Subsystem | Target Files | Key Proposed Changes |
| :--- | :--- | :--- |
| **Landing Page Showcase** | `frontend/src/components/landing/RolePersonas.tsx` (or `DashboardShowcase.tsx`), `page.tsx`, `constants.ts` | Replace static text with 6-tab interactive dashboard preview, live counters, mock action canvases, and role deep links |
| **Post-Login Role Routing** | `frontend/src/lib/role-routing.ts`, `components/layout/AuthGuard.tsx`, `app/auth/login/page.tsx` | Centralize role route resolution; map `owner`, `manager`, `accountant`, `cashier`, `server`, `chef`, `customer` to appropriate dashboard routes |
| **Manager Dashboard Gate** | `frontend/src/app/(dashboard)/dashboard/page.tsx` | Allow `manager` role access to `/dashboard` alongside `owner` to eliminate unwanted `/pos` redirect on web |
| **Public Menu Path** | `frontend/src/components/layout/AuthGuard.tsx` | Add `/menu` to `PUBLIC_PATHS` for seamless customer dining and prospective merchant exploration |
| **Navbar & Hero CTA** | `frontend/src/components/landing/Navbar.tsx`, `Hero.tsx`, `CtaSection.tsx` | Add prominent Login (`/auth/login`) and Signup (`/auth/register`) buttons with React Bits tactile styling |

---

*Report prepared and submitted by Explorer 3.*
