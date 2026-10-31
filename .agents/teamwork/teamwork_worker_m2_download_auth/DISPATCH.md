## 2026-10-31T10:56:45Z
You are a versatile implementation worker (teamwork_worker).
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m2_download_auth
Your parent orchestrator conversation ID is: 0f278f7c-ec06-48f6-9c2f-e89c1978e9bf

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read the user request at:
d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the survey report at:
- d:\narayana\order-it-up\PROJECT.md
- d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey3_2\handoff.md

Your mission is Milestone M2: Download Flow, Windows Installer Configuration, Download Gating & Auth Redirection, Google Sign-in Demo Placeholder in Auth Pages, Dynamic Navbar Auth State with Dashboard Navigation, and E2E Test T1.5 Fix.

Exclusive File Ownership:
You own exclusively:
- `landing/src/components/Navbar.tsx`
- `landing/src/components/CtaSection.tsx`
- `landing/src/components/ModalProvider.tsx`
- `landing/src/lib/auth.ts`
- `frontend/src/components/landing/Navbar.tsx`
- `frontend/src/components/landing/CtaSection.tsx`
- `frontend/src/app/auth/login/page.tsx`
- `frontend/src/app/auth/register/page.tsx`
Do NOT modify files outside this set.

Tasks:
1. Windows-Only Desktop Download Configuration:
   - In `landing/src/components/CtaSection.tsx`: Replace multi-OS (macOS DMG / Linux AppImage) download buttons with a single prominent Windows setup button delivering `Order-It-Up-Setup.exe` (or `order-it-up-1.0.0-win-x64.exe`). Keep `id="download-windows"` / `href="#download-windows"` anchor to satisfy adversarial test suites (`tests/challenger-ui-stress.test.cjs`).
   - In `landing/src/components/ModalProvider.tsx`: Scope download triggers to Windows (`Order-It-Up-Setup.exe`).
   - In `frontend/src/components/landing/CtaSection.tsx`: Replace multi-OS buttons with dedicated Windows download card with `#download-windows` anchor.
2. Download Gating & Auth Redirection:
   - If an unauthenticated user clicks any Download button (Navbar, Hero CTA, CtaSection), intercept the click and direct them to signup/login interface (`AuthModal` in `landing/`, or `/auth/login?redirect=download` in `frontend/`).
   - In `frontend/src/app/auth/login/page.tsx`: Handle `redirect === 'download'`. Upon login or demo Google sign-in, trigger the download of `Order-It-Up-Setup.exe` and navigate to the user's role dashboard (`/dashboard` or `/cloud-portal`).
3. Google Sign-In Demo Placeholder in `frontend/`:
   - In `frontend/src/app/auth/login/page.tsx`: Add the branded 4-color Google 'G' SVG button ("Continue with Google", "Demo" pill badge). On click, simulate a brief connection state, log in as demo owner (Priya Sharma, `demo.owner@orderitup.in`), resolve any pending download redirect, and navigate to `/dashboard` or `/cloud-portal`.
   - In `frontend/src/app/auth/register/page.tsx`: Add the same Google Sign-in demo placeholder button in Step 1.
4. Dynamic Navbar Auth State & Dashboard Navigation:
   - In `landing/src/components/Navbar.tsx`:
     - When authenticated (`currentUser` exists): Render user pill (avatar, name, role badge), a prominent "Dashboard" button (`/dashboard` or `/cloud-portal`), and Logout button.
     - When unauthenticated: Render distinct "Login" and "Sign Up" buttons.
   - In `frontend/src/components/landing/Navbar.tsx`:
     - Replace hardcoded brand name with `{BRAND.name}`.
     - Ensure `'100% Offline Engine'` status chip is rendered. This is CRITICAL to fix test failure `T1.5` in `tests/landing-page-e2e.test.cjs`!
     - When authenticated: Render user profile pill, prominent "Dashboard" button (`dashboardHref = getLandingPage()`), and Logout button.
     - When unauthenticated: Render distinct Login and Signup links and Windows download trigger.
5. Unified Session Storage:
   - In `landing/src/lib/auth.ts`: Dual-write session keys (`'user'`, `'token'`, `'orderitup_demo_auth_user'`) to `localStorage` so signing in on `landing/` immediately establishes the session for `frontend/` dashboards.
6. Build & Test Verification:
   - Run `npm --prefix landing run lint`
   - Run `npm --prefix landing run build`
   - Run `npm run lint`
   - Run `npm run build:frontend`
   - Run `node tests/landing-page-e2e.test.cjs`
   - Document commands, terminal output, and test results in your handoff.
