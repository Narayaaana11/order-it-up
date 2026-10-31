## 2026-10-30T23:22:00Z
You are Worker 3 (teamwork_worker) implementing Milestone 3: Role Dashboards Showcase & Post-Login Routing.
Your working directory is: `d:\narayana\order-it-up\.agents\teamwork\worker_m3\`

MANDATORY FIRST STEP:
Read the authoritative user request at:
`d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md`
Also read:
`d:\narayana\order-it-up\PROJECT.md`
And consult the technical survey findings in:
`d:\narayana\order-it-up\.agents\teamwork\explorer_survey_3\survey_report.md`
`d:\narayana\order-it-up\.agents\teamwork\explorer_survey_3\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP FOR MILESTONE 3:
- `frontend/src/lib/role-routing.ts` (new canonical role-to-route utility)
- `frontend/src/components/landing/RolePersonas.tsx` (interactive 6-tab Role Dashboard Showcase)
- `frontend/src/components/layout/AuthGuard.tsx` (update getLandingPage & public paths)
- `frontend/src/app/(dashboard)/dashboard/page.tsx` (fix manager role check)
Do NOT modify files outside your ownership scope.

TASKS FOR MILESTONE 3:
1. `frontend/src/lib/role-routing.ts`:
   - Implement canonical routing utility:
     ```typescript
     export interface UserRoleInfo {
       role?: string;
       isOwner?: boolean;
       tenantRole?: string;
     }

     export function getRoleDefaultRoute(user: UserRoleInfo | null, isElectron: boolean): string;
     export function isRoleAllowedOnWeb(role: string): boolean;
     ```
   - Route mappings per `users.md`:
     - Central SaaS / Super Admin / Admin / Finance / Support / Read-Only -> `/cloud-portal`
     - Owner -> `/cloud-portal` (web) or `/dashboard` (desktop)
     - Manager / Branch Manager -> `/dashboard`
     - Accountant -> `/reports`
     - Cashier -> `/pos` (desktop) / `/pos` (web notice)
     - Server / Waiter -> `/tables`
     - Chef -> `/kds`
     - Customer / Guest -> `/menu`
     - Unauthenticated -> `/pos` (desktop) or `/auth/login` (web)
   - Ensure case-insensitivity, whitespace trimming, and alias handling (`superadmin`, `branch_manager`, `waiter`).
2. `frontend/src/components/layout/AuthGuard.tsx`:
   - Refactor `getLandingPage()` to use `getRoleDefaultRoute(user, isElectronEnvironment())`.
   - Add `'/menu'` and `'/qr'` to `PUBLIC_PATHS`.
3. `frontend/src/app/(dashboard)/dashboard/page.tsx`:
   - Update line 188 / 218: Change `const isOwner = hasRole(currentTenant?.role, ROLE_ACCESS.owner);` check to include managers: `const isOwnerOrManager = hasRole(currentTenant?.role, ROLE_ACCESS.ownerManager);` so managers navigating on the web stay on `/dashboard` and are not redirected to `/pos`.
4. `frontend/src/components/landing/RolePersonas.tsx`:
   - Upgrade the component into a high-engagement **Interactive Role Dashboard Showcase**:
     - 6 Interactive Tabs:
       1. **Restaurant Owner** (Multi-branch revenue rollup, 6-digit PIN device pairing simulator, deep link to `/cloud-portal`).
       2. **Branch Manager** (Shift table turnover rate, active staff on shift, refund approval gate simulator, deep link to `/dashboard`).
       3. **Counter Cashier** (Split-tender payment simulator: Cash + UPI QR, animated 80mm receipt preview, deep link to `/pos`).
       4. **Floor Waiter / Server** (Interactive floor plan with clickable table status toggles: Vacant / Occupied / Billed, deep link to `/tables`).
       5. **Kitchen Station Chef** (Live KDS ticket queue with SLA timer badges and 1-tap ticket bumping from "Preparing" to "Ready", deep link to `/kds`).
       6. **Head Accountant** (Split GST tax breakdown: 2.5% CGST + 2.5% SGST, cash drawer variance reconciliation, Tally XML export simulation, deep link to `/reports`).
     - Pure React 19 + Tailwind CSS v4, zero external dependencies.
     - Glassmorphic card styling, smooth tab transitions, live interactive actions, direct deep link buttons.
5. Verification Requirements:
   - Run `node tests/landing-page-e2e.test.cjs` and verify all 21 tests pass.
   - Run `npm run lint` and verify 0 errors.
   - Run `npm run build:frontend` and verify clean static export with 0 errors.


## 2026-10-30T23:32:57Z
**Context**: Milestone 3 Status Check
**Content**: We observed that `role-routing.ts`, `AuthGuard.tsx`, `dashboard/page.tsx`, and `RolePersonas.tsx` have been implemented. Have you finished running the lint and build validations?
**Action**: Please complete verification, write `handoff.md`, and reply with your completion report.
