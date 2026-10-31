## 2026-10-31T15:15:05Z
You are Worker M3 for Milestone M3: "Platform Admin vs Restaurant Chain Owner Perspectives".
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\worker_m3_dash\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Ownership:
You own exclusively the following 2 files:
1. `landing/src/components/dashboard/FounderAdminView.tsx`
2. `landing/src/components/dashboard/ChainOwnerView.tsx`

Inputs & Specifications:
Read:
- Original Request: d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Scope: d:\narayana\order-it-up\.agents\teamwork\orchestrator_1\PROJECT.md
- Explorer Survey Report 3: d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_3\analysis.md (Sections 2 and 3 detail R2 specifications)
- Model & Store exports: `landing/src/lib/dashboard-models.ts` and `landing/src/lib/dashboard-store.ts` (`useTenants`, `useOutlets`, `useCatalog`, `useOrders`, `useDashboardActions`)

Detailed Implementation Requirements:
Adhere strictly to the landing page UI design system: `#F8FAFC` slate-50 canvas, `#FFFFFF` cards with `border-slate-200/80`, vibrant orange `#F07928` / `#EA580C` brand accents, Geist typography, Lucide icons, and zero dummy/placeholder labels.

1. `FounderAdminView.tsx` ("For me - startup owner"):
   - Platform Overview: Platform-wide GMV metrics, total transactions, active tenant count, active licensed terminals, and S3 total storage volume.
   - Tenant Directory: Manage restaurant tenant accounts (Priya Sharma's Spice Route, Urban Bites, Milano Craft Pizza, Coastal Spice) with status, plan tier, outlet count, and onboarding date. Includes an interactive "Onboard New Tenant" modal.
   - 16-Character Hardware-Bound Desktop POS License Generator:
     - Form to select tenant, select plan tier (`Enterprise Tier` ENT1, `Professional Tier` PRO1, `Starter Tier` STR1), and machine hardware fingerprint (4 hex chars e.g. `M894` or auto-generate).
     - Generates key formatted as `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]` (e.g. `OIUP-ENT1-M894-K7Q2`) calling `actions.generateLicenseKey(...)`.
     - Displays formatted key with 1-click copy, QR code visual representation, and lists previously issued licenses.
   - Isolated Amazon S3 Customer Bucket Telemetry:
     - Dedicated cards for isolated tenant buckets (e.g. `orderitup-tenant-spiceroute`, `orderitup-tenant-urbanbites`).
     - Clear breakdown of storage domains: `backups`, `users`, `payments`, `media` with object counts and storage sizes.
     - Displays strict prefix path enforcement `tenants/{tenantId}/...` and "Zero Data Commingling Verified" security invariant badge.

2. `ChainOwnerView.tsx` ("For users - multi-outlet"):
   - Multi-Branch Live Sales: Compare performance metrics across connected branches (Downtown Bistro, Cyber Hub Express, Airport Terminal 3 Hub) showing today's sales, order volume, AOV, active tables, engine port status, and tender mix.
   - Central Menu Catalog with Branch Overrides:
     - Displays central catalog items (Paneer Tikka, Truffle Pizza, Dal Makhani, Cold Brew Latte, etc.) with SAC 996331 and base prices.
     - Interactive branch price override controls allowing selecting a branch (e.g. Airport Terminal 3 for +15% transit surcharge or Cyber Hub for lunch special) and editing price overrides or availability 86-ing via `actions.updateBranchPriceOverride(outletId, itemId, price)`.
   - Consolidated Chain Taxes:
     - Consolidates Indian GST (SAC 996331, CGST @ 2.5%, SGST @ 2.5%, 5.0% total) across all connected branches.
     - Inter-branch sales comparison and tax liability ledger summary.

Verification tasks:
1. Run `npm --prefix landing run lint` (must exit with code 0).
2. Run `npm --prefix landing run build` (Next.js 16.3 static export must succeed cleanly with code 0).
3. Create automated unit test in `tests/landing-dashboard-m3.test.cjs` verifying both views render, license generator produces valid 16-char keys, S3 isolation paths are verified, and branch overrides update correctly. Run `node --test tests/landing-dashboard-m3.test.cjs`.
4. Write your handoff report to `d:\narayana\order-it-up\.agents\teamwork\worker_m3_dash\handoff.md`.
5. Send completion message with verification outputs.
