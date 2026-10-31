# Handoff Report: Auth & Static Export Survey (Requirement R2)

**Agent**: Explorer 2 (`explorer_survey_2`)  
**Parent Orchestrator**: `c5185715-12e5-4384-b47b-41fec48f176a`  
**Date**: 2026-10-30T22:00:00Z  
**Type**: Hard Handoff  

---

## 1. Observation

1. **Existing Authentication Pages**:
   - `frontend/src/app/auth/login/page.tsx`:
     - Line 4: `import { useRouter, useSearchParams } from 'next/navigation';`
     - Line 28: `const { login, selectTenant, user, tenants, currentTenant, loadFromStorage } = useAuthStore();`
     - Line 80-82: `if (user && currentTenant) { router.push(getLandingPage()); }`
     - Line 233-239: Wraps `LoginContent` in `<Suspense>` boundary, ensuring Next.js static prerender (`next build`) does not fail on `useSearchParams()`.
     - Line 215-221: Links to `/auth/recover`, but lacks any link to `/auth/register`.
   - `frontend/src/app/auth/register/page.tsx`:
     - Line 28: `import { cloudApi } from '@/lib/api';`
     - Line 82: Submits onboarding payload to `/api/auth/register` via `cloudApi.post('/api/auth/register', ...)`.
     - Lines 96-105: Stores `token`, `cloud_token`, `user`, and `tenant` in `localStorage`.
     - Line 109: Navigates via `router.push('/cloud-portal?onboarded=true')`.
     - Line 401-403: Links to `/auth/login` ("Sign in to Cloud HQ").
   - `frontend/src/app/auth/recover/page.tsx`:
     - Line 6: `import api from '@/lib/api';`
     - Validates and resets passwords using local 4-digit Master PIN via `api.post('/auth/recover-password', ...)`.

2. **Existing Landing Page Components**:
   - `frontend/src/components/landing/Navbar.tsx`:
     - Line 62-67:
       ```tsx
       <Link
         href="/auth/login"
         className="text-sm font-semibold text-slate-700 hover:text-orange-600 px-3 py-2 rounded-lg transition-colors"
       >
         Owner Login
       </Link>
       ```
     - Line 70-76: Renders `<a href="#download">Download POS</a>`.
     - Line 103-110: Mobile menu renders `<Link href="/auth/login">Owner Login / Cloud Portal</Link>`.
     - Missing: Neither desktop header nor mobile drawer includes a "Sign Up" or "Register" button (`/auth/register`).
     - Missing: Not auth-state aware; does not read `useAuthStore` or display "Dashboard" when a user is already authenticated.
   - `frontend/src/components/landing/Hero.tsx`:
     - Lines 54-69: Only provides `<a href="#download">Download Desktop POS</a>` and `<a href="#ui-preview">Explore Interactive Demo</a>`. No button for `/auth/login` or `/auth/register`.
   - `frontend/src/components/landing/CtaSection.tsx`:
     - Lines 44-78: Only provides desktop binary download buttons for Windows, macOS, and Linux. No button for `/auth/register` or `/auth/login`.

3. **Static Export Configuration**:
   - `frontend/next.config.ts`:
     - Line 8: `const isExport = process.env.NEXT_BUILD_MODE === "desktop" || process.env.NEXT_BUILD_MODE === "web" || process.env.NEXT_BUILD_MODE === "export";`
     - Line 12: `output: isExport ? "export" : undefined`
     - Line 15: `trailingSlash: isExport`
     - Line 19: `images: { unoptimized: isExport }`
   - `package.json`:
     - Line 19: `"build:frontend": "cd frontend && npx cross-env NEXT_BUILD_MODE=desktop npm run build"`
   - `tests/challenger-build-audit.test.cjs`:
     - Lines 41-75: Enumerates all 34 required static routes in `frontend/out/`, explicitly asserting the presence of `index.html` in `/auth/login`, `/auth/register`, `/auth/recover`, and `/cloud-portal`.

4. **API and Environment Branching**:
   - `frontend/src/lib/api.ts`:
     - Line 7: `CLOUD_API_BASE = 'https://orderitup-cloud-api.narayaaana11.workers.dev'`
     - Line 26-32: `getApiBaseUrl()` resolves to `window.location.origin/api` inside Electron, and `CLOUD_API_BASE` in standard browsers.
     - Line 52-65: Automatically injects `Authorization: Bearer <token>` from `localStorage.getItem('token') || localStorage.getItem('cloud_token')`.

5. **Landing Page Redirection & Role Boundaries**:
   - `frontend/src/components/layout/AuthGuard.tsx`:
     - Line 10-26:
       ```typescript
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
     - Line 28-39: `PUBLIC_PATHS` includes `'/'`, `'/auth/login'`, `'/auth/register'`, `'/auth/recover'`, `'/cloud-portal'`, `'/kds'`, `'/setup'`, and `'/qr'`.
   - `users.md` Section 1: Explicit boundary: POS counter billing is desktop/mobile only (`/pos` hidden on web). Web platform is dedicated to SaaS control plane, owner/manager dashboard, financial auditing, staff onboarding, and QR dining.

---

## 2. Logic Chain

1. **Requirement R2 Compliance**:
   - Observation 2 reveals that `Navbar.tsx` only links to `/auth/login` with label "Owner Login", completely omitting `/auth/register`, and that neither `Hero.tsx` nor `CtaSection.tsx` links to auth routes.
   - Acceptance criteria require prominent Login and Signup buttons in the navbar, hero section, and CTA section.
   - Therefore, implementers must add accessible `<Link href="/auth/register">` and `<Link href="/auth/login">` actions across `Navbar.tsx`, `Hero.tsx`, and `CtaSection.tsx`.

2. **Static Export Integrity**:
   - Observation 3 shows `output: 'export'` and `trailingSlash: true`.
   - In Next.js static export, navigation using `<Link href="/auth/login">` and `<Link href="/auth/register">` routes purely on the client side without contacting a Node server.
   - Because `trailingSlash: true` is configured, Cloudflare Pages resolves `/auth/login/` directly to `auth/login/index.html`.
   - To avoid React 19 hydration mismatch when reading auth state from `localStorage` in `Navbar.tsx`, the component must use a client-mounted guard (`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`).
   - The landing page must avoid `useSearchParams()` or wrap any query reader in `<Suspense>`.

3. **Requirement R3 Role-Based Routing Alignment**:
   - Observation 1 and 5 show `getLandingPage()` in `AuthGuard.tsx` currently only checks `owner` and `super_admin` vs desktop `/pos`.
   - `users.md` defines distinct destinations for operational roles: `manager` (`/dashboard`), `accountant` (`/reports`), `chef` (`/kds`), `server` (`/tables`), `customer` (`/menu`).
   - Expanding `getLandingPage()` to handle all roles defined in `users.md` ensures that post-login navigation seamlessly routes every persona to their proper web dashboard.

---

## 3. Caveats

1. **Offline POS Billing Boundary**: Per `users.md`, `/pos` billing requires local desktop SQLite and hardware peripherals (thermal printer, cash drawer). Operational roles logging in via `orderitup.pages.dev` should either view web dashboards/readouts (`/dashboard`, `/reports`, `/orders`, `/tables`, `/kds`) or receive a friendly platform notice advising that counter POS checkout is handled via the desktop client.
2. **Interactive Role Showcase**: Requirement R3 requires interactive role showcase/preview tabs on the landing page. In `frontend/src/components/landing/RolePersonas.tsx`, tab selection currently updates informational cards. Adding interactive dashboard previews and direct route demo buttons in `RolePersonas.tsx` or `UiPreviews.tsx` fulfills this requirement cleanly without adding external dependencies.

---

## 4. Conclusion

- The auth subsystem (`/auth/login`, `/auth/register`, `useAuthStore`, `cloudApi`) is fully functional, supports dual-environment dispatch, and generates valid static HTML under `frontend/out/`.
- Requirement R2 can be completely fulfilled with zero new dependencies by:
  1. Adding accessible, styled Login and Signup buttons in `Navbar.tsx` (with mounted-guarded auth state displaying "Dashboard" when logged in).
  2. Adding primary and secondary SaaS direct action buttons in `Hero.tsx` linking to `/auth/register` and `/auth/login`.
  3. Adding primary and secondary action buttons in `CtaSection.tsx` linking to `/auth/register` and `/auth/login`.
  4. Adding a reciprocal signup link in `frontend/src/app/auth/login/page.tsx`.
  5. Expanding `getLandingPage()` in `frontend/src/components/layout/AuthGuard.tsx` to handle all user roles from `users.md`.
- All routes comply with Next.js 16 App Router static export rules and Cloudflare Pages hosting at `orderitup.pages.dev`.

---

## 5. Verification Method

To independently verify the survey findings:

1. **Verify Static Route Generation**:
   ```sh
   npm run build:frontend
   node tests/challenger-build-audit.test.cjs
   ```
   Confirm that `frontend/out/auth/login/index.html` and `frontend/out/auth/register/index.html` are generated and pass assertions.

2. **Verify Deterministic Auth Login**:
   ```sh
   npm run test:auth-ui-deterministic
   ```

3. **Verify Static Route Resolution**:
   ```sh
   npm run test:static-routes
   ```

4. **Verify Frontend & Backend Lint**:
   ```sh
   npm run lint
   ```
