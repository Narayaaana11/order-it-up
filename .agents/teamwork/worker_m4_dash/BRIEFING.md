# BRIEFING — 2026-10-31T15:38:30Z

## Mission
Implement the Master Dashboard Shell in `landing/src/app/dashboard/page.tsx` with unified navigation, outlet selector, live telemetry status pill, view switching for all 8 perspectives/roles, URL sync, and Cloudflare Pages static export compatibility.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa
- Working directory: d:\narayana\order-it-up\.agents\teamwork\worker_m4_dash
- Original parent: 324a459d-4047-419c-8077-2f4966965e2f
- Milestone: M4 - Dashboard Shell, Unified Navigation & Cloudflare Pages Static Export

## 🔒 Key Constraints
- Own exclusively `landing/src/app/dashboard/page.tsx` and test suite `tests/landing-dashboard-shell.test.cjs`.
- Wrap `useSearchParams()` components in `<Suspense>` for Next.js 16 static export (`output: 'export'`).
- Strictly adhere to `#F8FAFC` slate-50 background, `#FFFFFF` cards, `#F07928` / `#EA580C` orange accents, Geist typography, Lucide icons.
- Zero dummy/placeholder text.
- Must pass `npm --prefix landing run lint` with 0 errors.
- Must pass `npm --prefix landing run build` with clean exit code 0.
- All tests must pass: `tests/landing-dashboard-m1.test.cjs`, `tests/landing-dashboard-m2.test.cjs`, `tests/landing-dashboard-m3.test.cjs`, `tests/landing-dashboard-shell.test.cjs`.

## Current Parent
- Conversation ID: 324a459d-4047-419c-8077-2f4966965e2f
- Updated: 2026-10-31T15:38:30Z

## Task Summary
- **What to build**: Full dashboard shell in `landing/src/app/dashboard/page.tsx` integrating all 8 views, store sync, detector hook, outlet switching, URL query param syncing with Suspense, and popover for hybrid connection status.
- **Success criteria**: Lint clean (0 errors), build static export succeeds (code 0), unit/integration tests pass (70/70 passing across M1-M4).
- **Interface contracts**: `landing/src/lib/dashboard-store.ts`, `landing/src/lib/backend-detector.ts`, components in `landing/src/components/dashboard/`.

## Key Decisions Made
- Wrapped inner `DashboardShell` in `<Suspense fallback={<DashboardLoadingFallback />}>` ensuring `output: 'export'` never bails out during Next.js 16 static export.
- Integrated all 8 views: `FounderAdminView` (founder perspective), `ChainOwnerView` (merchant overview), and 6 operational persona views (`OwnerManagerView`, `CashierView`, `KitchenChefView`, `ServerWaiterView`, `AccountantView`, `DeliveryDriverView`).
- Derived `selectedTab` and `effectivePerspective` to prevent synchronous `setState` within `useEffect`, ensuring React 19 compliance and clean ESLint.
- Implemented interactive hybrid telemetry status pill with dropdown popover detailing port status (:3001, :3002, :3003) and manual "Re-check Services" trigger.
- Supported outlet switching via `useOutlets()` and `useSelectedOutletId()` across Downtown Bistro, Cyber Hub Express, Airport Terminal 3, and Consolidated Chain.

## Artifact Index
- `landing/src/app/dashboard/page.tsx` — Main dashboard page and shell
- `tests/landing-dashboard-shell.test.cjs` — Comprehensive test suite for dashboard shell (18 tests)

## Change Tracker
- **Files modified**: `landing/src/app/dashboard/page.tsx`
- **Files created**: `tests/landing-dashboard-shell.test.cjs`
- **Build status**: PASS (`npm --prefix landing run build` exited 0, static export verified)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (70/70 passing across M1, M2, M3, M4)
- **Lint status**: PASS (0 errors, 0 warnings)
- **Tests added/modified**: 18 tests in `tests/landing-dashboard-shell.test.cjs`
