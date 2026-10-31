# Project: Order It Up Role-Based Dashboards & Platform Web Portal (Cloudflare Pages)

## Architecture
- **Web Portal Environment**: `landing/` — Next.js 16.3 (App Router) + React 19 + Tailwind CSS v4, statically exported (`output: 'export'`) to `landing/out/` for deployment on Cloudflare Pages.
- **Hybrid Data Architecture**:
  - **Standalone Mode (Default)**: Reactive browser store (`landing/src/lib/dashboard-store.ts`) with realistic, interconnected seed data for Spice Route Hospitality Group (3 outlets: Downtown Bistro, Cyber Hub Express, Airport Terminal 3) with `localStorage` persistence and rich mutation capabilities.
  - **Live Service Detection**: Non-blocking client-side probe hook querying local endpoints (`:3001` Express API, `:3002` KDS Server, `:3003` Waiter App) with a 1.5s timeout. Seamlessly elevates the dashboard to Live Sync mode when running locally, and falls back cleanly to Standalone Simulation mode on Cloudflare Pages without console errors or layout breaks.
- **Design System Consistency**:
  - Canvas background: `#F8FAFC` (slate-50)
  - Cards: `#FFFFFF` (white) with `border-slate-200/80` and subtle elevation shadows
  - Brand accents: `#F07928` / `#EA580C` (vibrant orange)
  - Typography: Geist Sans & Geist Mono
  - Standard Lucide icons across all views; zero raw emojis, zero dummy/placeholder labels.
- **Administrative Perspectives**:
  - **Founder Platform Admin**: Multi-tenant management, 16-character hardware-bound desktop POS license issuance (`OIUP-XXXX-XXXX-XXXX`), isolated S3 customer bucket telemetry (`tenants/{tenantId}/` across `backups`, `users`, `payments`, `media`), and platform-wide GMV tracking.
  - **Restaurant Chain Owner**: Multi-outlet live sales across connected branches, branch comparison metrics, central menu catalog with branch price override controls, and consolidated chain taxes.
- **Operational Personas (6 Roles)**:
  1. **Owner / Manager**: Multi-outlet live sales, staff PIN & role assignment, shift closures, S3 cloud backup outbox. [DONE]
  2. **Front Cashier**: Live billing status, 80mm ESC/POS thermal receipt formatting with SAC 996331 & GST, 24V solenoid cash drawer kick pulse (`0x1B, 0x70, 0x00, 0x19, 0xFA`), split tenders (UPI Dynamic QR, Cash with change calculation, Card). [DONE]
  3. **Kitchen Chef**: Real-time KDS (:3002) order queue, station routing (Oven, Tandoor, Bar), ticket bumping across lifecycle (pending -> preparing -> ready -> served), SLA prep timer countdown alerts. [DONE]
  4. **Server / Waiter**: Tableside ordering (:3003), visual floor table map across rooms (Indoor, Patio, Rooftop), occupancy statuses, course firing controls (Starters, Mains, Dessert). [DONE]
  5. **Accountant / Tax Compliance**: Indian GST breakdown (CGST @ 2.5%, SGST @ 2.5%, SAC 996331), FSSAI verification (`10019011000234`), Z-Report shift closure balancing with cash over/short variance, standard Tally XML export download. [DONE]
  6. **Delivery Driver**: Active dispatch queue (Swiggy, Zomato, Direct), customer address verification, rider status tracking, COD collection reconciliation. [DONE]

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Interconnected Operational Data Models | Types and seed models for Orders, OrderItems, Tables, KDS Tickets, Staff, Z-Reports, Taxes, and Dispatches | M1 | Survey |
| 2 | Hybrid Reactive Store & Backend Probes | Reactive client store with localStorage persistence and non-blocking probes to ports :3001, :3002, :3003 with graceful fallback | M1 | Survey |
| 3 | Front Cashier Counter Dashboard | Split tenders (UPI QR, Cash change, Card), 80mm ESC/POS thermal receipt preview, 24V drawer pulse simulation, drawer reconciliation | M2 | R1 |
| 4 | Kitchen Chef KDS Dashboard | Real-time KDS ticket queue, station filtering (Oven, Tandoor, Bar), ticket bumping across 4 statuses, SLA countdown alerts | M2 | R1 |
| 5 | Server / Waiter Tableside Dashboard | Visual floor table map (Indoor, Patio, Rooftop), occupancy states, tableside order drafting, and course firing (Starters, Mains, Dessert) | M2 | R1 |
| 6 | Accountant Tax Compliance Dashboard | Indian GST breakdown (CGST 2.5%, SGST 2.5%, SAC 996331), FSSAI verification, Z-report balancing, and 1-click Tally XML export | M2 | R1 |
| 7 | Delivery Driver Dispatch Dashboard | Active dispatch queue (Swiggy, Zomato, Direct), customer address verification, rider status tracking, and COD collection reconciliation | M2 | R1 |
| 8 | Owner / Manager Chain Dashboard | Cross-outlet live sales, staff PIN & role assignment modal, shift closures, S3 cloud backup outbox status | M2 | R1 |
| 9 | Founder Platform Admin Perspective | Tenant management & onboarding, 16-character hardware-bound license generator (OIUP-XXXX-XXXX-XXXX), S3 zero-commingling telemetry, platform GMV | M3 | R2 |
| 10 | Restaurant Chain Owner Perspective | Multi-branch live sales comparison, central menu catalog with branch price overrides, consolidated chain tax reporting | M3 | R2 |
| 11 | Unified Dashboard Shell & Navigation | Master dashboard coordinator with responsive role/perspective switcher, hybrid status badge, <Suspense> query param handling | M4 | R3/R4 |
| 12 | UI & Design System Consistency | Strict #F8FAFC canvas, white cards with border-slate-200/80, #F07928 accents, Geist typography, clean responsive layouts | M4 | R4 |
| 13 | Static Export & Cloudflare Pages Compliance | Ensure `output: 'export'` compiles cleanly with 0 errors in Next.js 16 App Router without dynamic SSR violations | M4 | AC |
| 14 | E2E Testing & Forensic Integrity Audit | Complete validation pass: `npm --prefix landing run lint`, `npm --prefix landing run build`, automated E2E tests, challenger stress tests, and auditor veto | M5 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Hybrid Reactive Data Architecture & Operational Models | `landing/src/lib/dashboard-models.ts`, `landing/src/lib/dashboard-store.ts`, `landing/src/lib/backend-detector.ts` | none | DONE |
| M2 | The 6 Operational Persona Dashboards | `landing/src/components/dashboard/CashierView.tsx`, `KitchenChefView.tsx`, `ServerWaiterView.tsx`, `AccountantView.tsx`, `DeliveryDriverView.tsx`, `OwnerManagerView.tsx` | M1 | DONE |
| M3 | Platform Admin vs Restaurant Chain Owner Perspectives | `landing/src/components/dashboard/FounderAdminView.tsx`, `landing/src/components/dashboard/ChainOwnerView.tsx` | M1 | DONE |
| M4 | Dashboard Shell, Unified Navigation & Cloudflare Pages Static Export | `landing/src/app/dashboard/page.tsx`, sub-routes, navigation tabs, design system polish | M2, M3 | DONE |
| M5 | Verification, Automated Tests, Challenger Stress Tests & Forensic Audit | Comprehensive E2E test suites, challenger stress tests, `teamwork_auditor` verification, build & lint verification | M4 | DONE |

## Interface Contracts

### 1. License Key Contract
Format: `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]` (16 alphanumeric characters grouped in 4-character blocks)
Example: `OIUP-ENT1-M894-K7Q2`

### 2. ESC/POS Cash Drawer Pulse Contract
Kick code: `0x1B, 0x70, 0x00, 0x19, 0xFA` (ESC p 0 25 250)
Triggered on cash payments or manual drawer pulse.

### 3. Indian GST Tax Contract
- SAC Code: `996331` (Restaurant and catering service)
- CGST: 2.5%
- SGST: 2.5%
- Total GST: 5.0%
- FSSAI License: `10019011000234`

### 4. Tally XML Export Contract
Structure: Standard Tally XML Envelope with `<VOUCHER VCHTYPE="Receipt" ACTION="Create">` containing Cash Counter Drawer, Digital / UPI Clearing, and Restaurant Sales ledgers.

### 5. S3 Tenant Key Contract
Tenant isolation prefix: `tenants/{tenantId}/{domain}/...` where domain in `['backups', 'users', 'payments', 'media']`.

## Code Layout
- `landing/src/lib/dashboard-models.ts`: Core operational types and interfaces [DONE]
- `landing/src/lib/dashboard-store.ts`: Reactive state store with seed data & localStorage sync [DONE]
- `landing/src/lib/backend-detector.ts`: Local backend service auto-probe (:3001, :3002, :3003) [DONE]
- `landing/src/components/dashboard/CashierView.tsx`: Front counter cashier with split tender and thermal receipt [DONE]
- `landing/src/components/dashboard/KitchenChefView.tsx`: Real-time KDS order queue with station routing & bumping [DONE]
- `landing/src/components/dashboard/ServerWaiterView.tsx`: Table floor map and course firing [DONE]
- `landing/src/components/dashboard/AccountantView.tsx`: GST breakdown, Z-report balancing, Tally XML export [DONE]
- `landing/src/components/dashboard/DeliveryDriverView.tsx`: Delivery queue, address verification, COD reconciliation [DONE]
- `landing/src/components/dashboard/OwnerManagerView.tsx`: Multi-outlet sales, staff PINs, shift closures, S3 backup [DONE]
- `landing/src/components/dashboard/FounderAdminView.tsx`: Platform tenants, 16-char license generator, S3 isolation [DONE]
- `landing/src/components/dashboard/ChainOwnerView.tsx`: Multi-branch live sales, branch overrides, consolidated taxes [DONE]
- `landing/src/app/dashboard/page.tsx`: Unified dashboard entry point with role & perspective navigation [DONE]
