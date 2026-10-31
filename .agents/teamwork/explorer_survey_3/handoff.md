# Handoff Report — Explorer 3 (Roles, Dashboards & Showcase)

## 1. Observation

1. **User Request & Requirement R3**:
   - In `ORIGINAL_REQUEST.md` (lines 24–35, 54–57), the user specifies:
     - Connect login flow and navigation to role-based dashboards defined in `users.md`:
       - Owner / Super Admin: Cloud HQ Portal (`/cloud-portal`) & Store Management (`/dashboard`)
       - Manager: Store Dashboard & Operations (`/dashboard`, `/reports`)
       - Accountant: Financial & Tax Summaries (`/reports`)
       - Cashier: Counter POS Billing (`/pos`)
       - Waiter / Server: Table Floor Plan & Live Orders (`/tables`, `/orders`)
       - Kitchen Chef: Kitchen Display System (`/kds`, `/kds-standalone`)
       - Guest / Customer: Digital Menu & QR Dining (`/menu`, `/qr`)
     - Optimal routing and handling for operational roles on web platform, balancing `users.md` boundaries and web preview usability.
     - Add an interactive dashboard showcase / preview tabs or selector on the landing page for prospective users.

2. **Role Definitions & Platform Invariants**:
   - `users.md` (lines 7–34): "POS billing is strictly supported only on the Desktop App (Electron) and the Mobile POS App (Flutter). The Web Application (`https://orderitup.pages.dev` / `localhost:3000`) is dedicated exclusively to Landing, Registration, SaaS Control Plane, CRM & Customer Relationship Management, Owner/Manager Dashboards, Financial/Tax Auditing, and Staff Management. NO WEB POS BILLING."
   - `users.md` (lines 41–56): Lists 10 operational roles: `SUPER_ADMIN`, `ADMIN`, `FINANCE`, `SUPPORT`, `READ_ONLY`, `owner`, `manager`, `accountant`, `cashier`, `server`, `chef`, `delivery`, `customer`.

3. **Current Routing Implementation**:
   - In `frontend/src/components/layout/AuthGuard.tsx` (lines 10–26):
     ```ts
     export function getLandingPage(): string {
       if (typeof window !== 'undefined') {
         try {
           const storedUser = localStorage.getItem('user');
           if (storedUser) {
             const u = JSON.parse(storedUser);
             if (u.role === 'owner' || u.role === 'super_admin') {
               return '/cloud-portal';
             }
           }
         } catch {}
         if (!isElectronEnvironment()) {
           return '/dashboard';
         }
       }
       return '/pos';
     }
     ```
     Observation: It only routes `owner` and `super_admin` to `/cloud-portal`, and all other roles default to `/dashboard` (on web) or `/pos` (on desktop). It lacks role-specific routing for `accountant` (`/reports`), `server` (`/tables`), `chef` (`/kds`), `manager`, and `customer`.

4. **Manager Dashboard Redirection Bug**:
   - In `frontend/src/app/(dashboard)/dashboard/page.tsx` (lines 188, 216–220):
     ```ts
     const isOwner = hasRole(currentTenant?.role, ROLE_ACCESS.owner);
     ...
     useEffect(() => {
       if (currentTenant && !isOwner) {
         router.replace('/pos');
       }
     }, [currentTenant, isOwner, router]);
     ```
     Observation: If a `manager` logs in on the Web, this redirects them to `/pos`. On the Web, `/pos` renders lines 974–1003 ("Desktop & Mobile POS Only"), resulting in an unwanted loop/dead end for managers.

5. **Landing Page Role Representation**:
   - In `frontend/src/components/landing/RolePersonas.tsx` (lines 16–122): Tab button selector exists for Cashier, Waiter, Chef, Manager, Accountant, Driver. However, it only displays static responsibility text bullets. There is no interactive preview canvas, no live metric counters, no workflow step sequence, and no deep links to live routes.
   - In `frontend/src/components/landing/Navbar.tsx` (lines 62–67) and `Hero.tsx` (lines 53–70): There is no Signup button (`/auth/register`) in the header or hero, only "Owner Login" and "Download POS".

6. **Static Export Build Configuration**:
   - In `frontend/next.config.ts` (lines 8–20): `output: isExport ? "export" : undefined` and `trailingSlash: isExport`.
   - In `package.json` (line 19): `"build:frontend": "cd frontend && npx cross-env NEXT_BUILD_MODE=desktop npm run build"`.

---

## 2. Logic Chain

1. From **Observation 1 & 2**, Order It Up has a strict architectural boundary where POS billing is desktop/mobile only, while Web SaaS is for management, analytics, audit, and customer menus.
2. From **Observation 3**, the current post-login redirect (`getLandingPage()`) is primitive and fails to distinguish between operational roles (Accountant, Server, Chef, Manager, Customer). Creating a centralized routing utility (`getRoleDefaultRoute()`) will satisfy Acceptance Criterion 3 while respecting the platform boundary.
3. From **Observation 4**, the route guard inside `dashboard/page.tsx` checks only `ROLE_ACCESS.owner`. By widening this check to `ROLE_ACCESS.ownerManager`, branch managers can freely access the store operations dashboard on Web and Desktop as specified in `users.md`.
4. From **Observation 5**, prospective merchants landing on `orderitup.pages.dev` cannot currently experience the power of the platform without logging in. Replacing or enhancing `RolePersonas.tsx` with an interactive 6-tab **Role Dashboard Showcase** (interactive canvas, live mock actions, SLA bumping, split tender calculator, table status toggle, Tally XML export simulation, and deep links) directly fulfills Requirement R3 and Acceptance Criteria 3.
5. From **Observation 6**, all landing page additions and role showcase widgets must be client components (`'use client'`) using lightweight React 19 state and Tailwind CSS, guaranteeing 100% static export compatibility on Cloudflare Pages without runtime SSR dependencies.

---

## 3. Caveats

- **Native Hardware Drivers**: ESC/POS thermal printing over USB/raw socket and 24V cash drawer pulses cannot run inside standard browser security sandboxes on `orderitup.pages.dev`. The showcase simulator models these interactions with visual feedback and simulated receipts without requiring native drivers.
- **Backend API Availability**: When hosted statically on Cloudflare Pages, `http://localhost:3001` will not respond unless a local development server is running. Therefore, all interactive showcase tabs must maintain zero external network dependencies and initialize with rich default mock data.
- **Mobile Persona Scope**: Waiter and Chef primary operational clients are Flutter Mobile applications, but both have active web endpoints (`/tables`, `/orders`, `/kds`, `/kds-standalone`, `/server-standalone`). Linking to these web views provides full previewability on desktop browsers.

---

## 4. Conclusion

1. **Role Showcase Architecture**:
   - Transform `frontend/src/components/landing/RolePersonas.tsx` into a high-engagement **Role Dashboard Showcase** with 6 operational tabs:
     - **Owner / Super Admin**: Multi-branch overview, live revenue counter, 6-digit PIN device pairing simulator, deep link to `/cloud-portal`.
     - **Branch Manager**: Store KPIs, shift table turnover, refund approval gate, deep link to `/dashboard`.
     - **Counter Cashier**: Split tender calculator (Cash + UPI QR), animated 80mm thermal slip preview, sub-second settlement demo.
     - **Floor Waiter / Server**: Interactive floor plan with toggleable table states (Vacant/Occupied/Billed), deep link to `/tables`.
     - **Kitchen Station Chef**: Real-time KDS ticket queue, color-coded SLA timers, 1-tap ticket bumping (`preparing` → `ready`), deep link to `/kds`.
     - **Head Accountant**: Split GST breakdown (CGST/SGST), cash drawer balance reconciliation, 1-click Tally XML export simulation, deep link to `/reports`.
2. **Post-Login Routing Architecture**:
   - Implement `getRoleDefaultRoute(user, tenant, isElectron)` in `frontend/src/lib/role-routing.ts`.
   - Update `AuthGuard.tsx` (`getLandingPage()`) to redirect:
     - `owner` / `super_admin` → `/cloud-portal` (web) or `/dashboard` (desktop)
     - `manager` → `/dashboard`
     - `accountant` → `/reports`
     - `cashier` → `/pos` (desktop) / `/pos` (web guidance)
     - `server` / `waiter` → `/tables`
     - `chef` → `/kds`
     - `customer` → `/menu`
   - Update `frontend/src/app/(dashboard)/dashboard/page.tsx` line 188 to allow `manager` access (`ROLE_ACCESS.ownerManager`).
   - Add `/menu` to `PUBLIC_PATHS` in `AuthGuard.tsx`.
3. **Auth & Landing Page Integration**:
   - Add Signup (`/auth/register`) and Login (`/auth/login`) buttons in `Navbar.tsx`, `Hero.tsx`, and `CtaSection.tsx` with tactile button styling.

---

## 5. Verification Method

1. **Static Export Build Validation**:
   ```sh
   npm run build:frontend
   ```
   *Expected outcome*: Next.js App Router static compilation succeeds with 0 errors and generates static HTML files in `frontend/out/`.
2. **Linting Verification**:
   ```sh
   npm --prefix frontend run lint
   ```
   *Expected outcome*: ESLint passes cleanly with 0 errors.
3. **Smoke & Dual-Server Test**:
   ```sh
   node tests/run-electron-node-test.cjs tests/smoke-test.test.ts
   ```
   *Expected outcome*: Dual-server health checks (:3001, :3002) and owner login authentication pass without regression.
4. **Invalidation Conditions**:
   - If `npm run build:frontend` throws dynamic rendering or SSR prerender errors.
   - If any role route triggers an unhandled HTTP 401/403 or redirect loop when accessed on web.
