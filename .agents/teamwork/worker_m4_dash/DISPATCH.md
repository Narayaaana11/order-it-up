## 2026-10-31T15:27:24Z

You are Worker M4 for Milestone M4: "Dashboard Shell, Unified Navigation & Cloudflare Pages Static Export".
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\worker_m4_dash\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Ownership:
You own exclusively:
`landing/src/app/dashboard/page.tsx`

Inputs & Components Available:
All 8 role and perspective views are fully implemented and tested in `landing/src/components/dashboard/`:
- `landing/src/components/dashboard/CashierView.tsx`
- `landing/src/components/dashboard/KitchenChefView.tsx`
- `landing/src/components/dashboard/ServerWaiterView.tsx`
- `landing/src/components/dashboard/AccountantView.tsx`
- `landing/src/components/dashboard/DeliveryDriverView.tsx`
- `landing/src/components/dashboard/OwnerManagerView.tsx`
- `landing/src/components/dashboard/FounderAdminView.tsx`
- `landing/src/components/dashboard/ChainOwnerView.tsx`
Store and detector hooks available in:
- `landing/src/lib/dashboard-store.ts` (`useDashboardStore`, `useDashboardActions`, `useActivePerspective`, `useActiveRole`, `useSelectedOutletId`, `useOutlets`, etc.)
- `landing/src/lib/backend-detector.ts` (`useBackendDetector`)

Detailed Implementation Tasks for `landing/src/app/dashboard/page.tsx`:
1. Master Dashboard Shell:
   - Header with Order It Up brand logo, outlet selector dropdown (Downtown Bistro, Cyber Hub Express, Airport Terminal 3), and Hybrid Connection Status Pill:
     - Shows live telemetry status from `useBackendDetector()`: Green badge "Live Sync (:3001, :3002, :3003)" when local services are detected, or slate badge "Standalone Simulation (Cloudflare Pages)" with popover explaining zero-commingling hybrid operation and manual "Re-check Services" button.
   - Perspective & Role Navigation Switcher:
     - Top toggle to switch between Administrative Perspectives: "Restaurant Chain Owner" (`merchant`) and "Founder Platform Admin" (`founder`).
     - When `merchant` is active, show the 6 operational restaurant persona tabs:
       1. Owner / Manager (`owner`)
       2. Front Cashier (`cashier`)
       3. Kitchen Chef (`chef`)
       4. Server / Waiter (`waiter` or `server`)
       5. Accountant / Tax Compliance (`accountant`)
       6. Delivery Driver (`driver` or `delivery`)
     - When `founder` is active, render `FounderAdminView`.
     - When `merchant` is active and no sub-persona is selected (or when "Multi-Outlet Overview" is active), render `ChainOwnerView`.
     - When a persona tab is selected, render the corresponding view (`CashierView`, `KitchenChefView`, `ServerWaiterView`, `AccountantView`, `DeliveryDriverView`, `OwnerManagerView`).
   - URL Sync & Static Export Safety:
     - Sync active role / perspective with URL query params (`?role=...`, `?perspective=...`).
     - Wrap any component using `useSearchParams()` in a `<Suspense fallback={...}>` boundary to strictly preserve Next.js 16 static export (`output: 'export'`).
   - Design System Consistency:
     - Strict adherence to `#F8FAFC` slate-50 background, `#FFFFFF` cards with `border-slate-200/80`, vibrant orange `#F07928` / `#EA580C` brand accents, Geist typography, standard Lucide icons, and zero dummy/placeholder text.
2. Verification:
   - Run `npm --prefix landing run lint` (must pass with 0 errors).
   - Run `npm --prefix landing run build` (Next.js 16 static export must succeed cleanly with code 0).
   - Create automated test in `tests/landing-dashboard-shell.test.cjs` validating navigation switching, query param handling, all 8 view mounts, and hybrid status pill.
   - Run all test suites: `node --test tests/landing-dashboard-m1.test.cjs tests/landing-dashboard-m2.test.cjs tests/landing-dashboard-m3.test.cjs tests/landing-dashboard-shell.test.cjs`.
3. Write your handoff report to `d:\narayana\order-it-up\.agents\teamwork\worker_m4_dash\handoff.md`.
4. Send completion message with verification outputs.
