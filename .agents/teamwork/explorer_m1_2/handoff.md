# Handoff Report: Explorer 2 (Milestone M1 — Reactive Store Architecture & Operational Models)

## 1. Observation
- `landing/package.json` (lines 13-20): Dependencies include `clsx (^2.1.1)`, `lucide-react (^1.40.0)`, `next (16.3.4)`, `react (19.2.8)`, `react-dom (19.2.8)`, and `tailwind-merge (^3.6.0)`. Neither `zustand` nor external state libraries are installed. React 19 is natively installed.
- `landing/next.config.ts` (lines 3-12): `output: "export"`, `trailingSlash: true`, and `images: { unoptimized: true }`. Prerenders all pages to static HTML for Cloudflare Pages. Any direct client-side read of `localStorage` during initial hydration throws a Next.js SSR hydration mismatch error.
- `landing/src/app/dashboard/page.tsx` (lines 40-150): Contains static, unmutated mock arrays `PLATFORM_TENANTS` and `CHAIN_OUTLETS`. There are no dynamic mutation methods, no kitchen ticket bumping, no tableside course firing, and no cash drawer till reconciliation.
- `landing/src/lib/constants.ts` (lines 245-297): Defines `MOCK_ORDER` with items: *Truffle Mushroom Wood-Fired Pizza*, *Artisanal Paneer Tikka Platter*, *Classic Cold Brew Latte*, and *Belgian Dark Chocolate Lava Cake*.
- `main/printers/thermal.ts` (lines 768-787, 2393-2395): Authoritative ESC/POS 24V cash drawer solenoid kick pulse is `Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])`.
- `main/services/amazon-s3.ts` (lines 47-67, 189-210, 755-833): Tenant data isolation invariant enforces strict prefixing `tenants/{tenantId}/` across 4 domains: `backups`, `users`, `payments`, `media`, with zero tenant data commingling.
- `main/routes/cash-closures.ts` (lines 282-372) & `main/db.ts` (lines 4006-4028): Z-Report schema tracks `opening_float_cents`, `gross_collected_cents`, `refunded_cents`, `expected_cash_cents`, `counted_cash_cents`, and `variance_cents`.

## 2. Logic Chain
1. *From Observation 1 & 2*: Next.js 16 with static export on React 19 requires that initial server markup and client hydration markup match exactly. React 19 provides `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`, where `getServerSnapshot` guarantees deterministic SSR rendering and `getSnapshot` returns in-memory state.
2. *From Observation 1 & Invariant 6 ("Reuse before adding")*: Building an observable singleton store container around `useSyncExternalStore` avoids introducing external dependencies like Zustand, while providing instant reactivity, selective subscriptions, and cross-tab storage synchronization.
3. *From Observation 2*: By deferring `localStorage` hydration to a client mount effect (`hydrateDashboardStore()`) while serving `INITIAL_DASHBOARD_STATE` on initial render, hydration mismatches are completely eliminated.
4. *From Observation 3, 4, 5, 6, 7*: Designing the seed dataset around Priya Sharma's **Spice Route Hospitality Group** (3 outlets: Downtown Bistro, Cyber Hub Express, Airport Terminal 3) with SAC 996331, 5% GST, real multi-course live orders (Order #101, #102, #103, #104), zone tables, staff PINs, shift Z-reports with cash variance (-₹50 shortage in Z-Report #42), and isolated Amazon S3 telemetry creates a unified relational operational graph.
5. *From Requirements & Observations 5, 6*: Designing the 8 mutation methods (`bumpTicket`, `fireCourse`, `settlePayment`, `recordShiftClosure`, `assignStaffRole`, `updateBranchPriceOverride`, `generateLicenseKey`, `updateDeliveryStatus`) with explicit validations, 24V drawer pulses, table freeing, and outlet sales recalculations delivers a complete, turn-key reactive operational store for Milestone M1 implementation.

## 3. Caveats
- No caveats regarding store architecture or seed data requirements. All 8 requested mutation methods, 3 branches, live order lifecycles, table zones, staff PINs, Z-reports, and S3 telemetry are fully specified with complete TypeScript models and logic.
- Assumption: The worker implementing `landing/src/lib/dashboard-store.ts` will co-import the TypeScript models from `landing/src/lib/dashboard-models.ts` (designed by Explorer 1) to ensure zero type duplication.

## 4. Conclusion
The reactive client-side store architecture for `landing/src/lib/dashboard-store.ts` is fully designed with:
- Standard React 19 `useSyncExternalStore` architecture requiring zero external packages.
- Complete SSR hydration safety eliminating Next.js 16 static export mismatch errors.
- Comprehensive realistic initial seed data for Spice Route Hospitality Group (3 outlets, 8 menu items with SAC 996331, 4 live orders, 15 tables across 4 zones, 7 staff members with PINs, 3 Z-Reports, 3 delivery dispatches, 4 platform tenants with S3 metrics).
- 8 validated operational mutation methods with cross-entity side effects.
The full specification and implementation code are documented in `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_2\analysis.md`.

## 5. Verification Method
1. **Static Build Verification**:
   ```sh
   npm --prefix landing run build
   ```
   Must succeed with 0 errors, generating static HTML in `landing/out/` without dynamic SSR bailouts or prerender failures.
2. **ESLint Verification**:
   ```sh
   npm --prefix landing run lint
   ```
   Must pass with 0 ESLint warnings or errors.
3. **Hydration & State Inspection**:
   Inspect browser console on `/dashboard/` in Chrome DevTools to ensure zero `Hydration failed` warnings.
4. **Mutation Method Unit Checks**:
   - `bumpTicket('ord-101', 'item-101-1')`: Advances item status from `preparing` to `ready`.
   - `fireCourse('tbl-indoor-04', 'main')`: Transitions Table T-04 mains to `preparing`.
   - `settlePayment('ord-103', 'cash')`: Marks Order #103 paid, frees Table T-05, records drawer pulse.
   - `recordShiftClosure(...)`: Balances drawer, flags variance, resets float.
   - `assignStaffRole(...)`: Validates 4-digit PIN regex (`/^\d{4}$/`).
   - `generateLicenseKey(...)`: Formats 16-character key `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]`.
   - `updateDeliveryStatus(...)`: Reconciles COD collection and drawer till.
