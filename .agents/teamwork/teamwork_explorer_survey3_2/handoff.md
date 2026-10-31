# Phase 0 Survey Report: Requirement R2 (Download Flow, Redirection, & Authentication)

**Agent**: Explorer Survey 3_2 (`teamwork_explorer_survey3_2`)  
**Parent Orchestrator ID**: `0f278f7c-ec06-48f6-9c2f-e89c1978e9bf`  
**Date**: 2026-10-31T10:50:00Z  
**Target Requirement**: R2 — Download Flow, Windows Installer Configuration, Download Redirection & Gating, Google Sign-in Demo Element, Session Persistence, and Dynamic Navbar Auth Reflection & Admin Dashboard Navigation.

---

## 1. Observation

### 1.1 Dual-App Ecosystem & Component Mapping
Order It Up operates two web-facing Next.js applications:
1. `landing/`: Standalone marketing website and interactive prototype running on port 3004, exporting to `landing/out/` (verified by `tests/challenger-build-audit.test.cjs`).
2. `frontend/`: Statically exported Next.js 16 (App Router) + React 19 application (`orderitup.pages.dev` and Electron renderer) hosting the root landing page `frontend/src/app/page.tsx`, role dashboards (`/(dashboard)`), and authentication routes (`/auth/login`, `/auth/register`).

The table below maps the corresponding landing and authentication components across both codebases:

| Component / Function | `landing/` Path | `frontend/` Path | Current Alignment Status |
| :--- | :--- | :--- | :--- |
| **Top Navigation** | `landing/src/components/Navbar.tsx` (302 lines) | `frontend/src/components/landing/Navbar.tsx` (219 lines) | Divergent auth state rendering; `landing/` lacks Dashboard link; `frontend/` lacks distinct Login vs Signup buttons. |
| **Hero Section** | `landing/src/components/Hero.tsx` (328 lines) | `frontend/src/components/landing/Hero.tsx` (215 lines) | `landing/` has modal event triggers; `frontend/` links to dummy anchor `#download`. Both mention multi-OS instead of Windows-only. |
| **Download CTA Section** | `landing/src/components/CtaSection.tsx` (232 lines) | `frontend/src/components/landing/CtaSection.tsx` (193 lines) | Both render Windows, macOS, and Linux buttons. `frontend/` uses dummy `#download-windows` anchors without download triggers. |
| **Footer Section** | `landing/src/components/Footer.tsx` (298 lines) | `frontend/src/components/landing/Footer.tsx` (137 lines) | Neither currently exposes a direct Windows download link in the product column. |
| **Auth Modal / Flow** | `landing/src/components/AuthModal.tsx` (334 lines) | None (routes directly to `/auth/login` and `/auth/register`) | `landing/` has in-place modal with 1-click test credentials; `frontend/` uses dedicated multi-step pages. |
| **Modal Orchestrator** | `landing/src/components/ModalProvider.tsx` (203 lines) | None | Handles custom DOM events (`orderitup_open_auth_modal`, etc.) and mock blob download dispatch. |
| **Auth State Store** | `landing/src/lib/auth.ts` (`orderitup_demo_auth_user`) | `frontend/src/store/auth.ts` (`useAuthStore`) | Disjoint storage keys; `landing/` does not sync `token`/`user` to `frontend/` format. |

---

### 1.2 Inspection of Existing Download Triggers and Flows

#### A. In `landing/`
- **`landing/src/components/Navbar.tsx`** (Lines 45–57, 170–179, 284–289):
  ```tsx
  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) {
      triggerOpenAuthModal("login", "any");
    } else {
      window.dispatchEvent(
        new CustomEvent("orderitup_open_auth_modal", {
          detail: { mode: "login", downloadPendingPlatform: "any" },
        })
      );
    }
  };
  ```
  *Defect*: When authenticated (`currentUser !== null`), clicking download unnecessarily re-opens the `AuthModal` in login mode instead of directly initiating the download. When unauthenticated, it requests platform `"any"` instead of `"windows"`.
- **`landing/src/components/Hero.tsx`** (Lines 40–52, 134–142):
  ```tsx
  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const user = getStoredUser();
    if (!user) {
      triggerOpenAuthModal("signup", "windows");
    } else {
      window.dispatchEvent(
        new CustomEvent("orderitup_open_auth_modal", {
          detail: { mode: "login", downloadPendingPlatform: "windows" },
        })
      );
    }
  };
  ```
  *Defect*: Line 184 features subtext `Windows, macOS & Linux` under the CTAs, contradicting the Windows-only requirement.
- **`landing/src/components/CtaSection.tsx`** (Lines 26–37, 80–132):
  Renders three platform download buttons:
  - Windows: `handlePlatformDownload("windows")`
  - macOS: `handlePlatformDownload("mac")`
  - Linux: `handlePlatformDownload("linux")`
  *Defect*: Multi-OS options must be replaced by a single, prominent Windows desktop installer trigger.
- **`landing/src/components/ModalProvider.tsx`** (Lines 39–83):
  Contains mock file download dispatcher:
  ```ts
  const triggerFileDownload = (platform: DownloadPlatform) => {
    let filename = "OrderItUp-POS-Setup-1.2.0.exe";
    let platformLabel = "Windows (x64)";
    if (platform === "mac") {
      filename = "OrderItUp-POS-1.2.0-universal.dmg";
      platformLabel = "macOS (Apple Silicon & Intel)";
    } else if (platform === "linux") {
      filename = "OrderItUp-POS-1.2.0.AppImage";
      platformLabel = "Linux (Universal)";
    }
    // Dispatches Blob to anchor and triggers click
  ```
  Shows toast "Authorized Download Starting" with filename and platform.

#### B. In `frontend/src/components/landing/`
- **`frontend/src/components/landing/Navbar.tsx`** (Lines 110–116, 200–206):
  ```tsx
  <a
    href="#download"
    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 active:scale-[0.98] transition-all whitespace-nowrap"
  >
    <Download className="w-4 h-4 text-slate-600" />
    <span>Download</span>
  </a>
  ```
  *Defect*: Simply scrolls to anchor `#download`. Does not verify authentication, does not intercept unauthenticated users, and does not initiate any download file transfer.
- **`frontend/src/components/landing/Hero.tsx`** (Lines 73–80):
  ```tsx
  <a
    href="#download"
    className="h-14 px-6 rounded-xl bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border border-slate-300/80 font-semibold text-base shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
  >
    <Download className="w-4 h-4 text-slate-600" />
    <span>Download Desktop POS</span>
  </a>
  ```
  *Defect*: Anchor link to `#download` without auth checking. Line 107 displays `Windows, macOS & Linux`.
- **`frontend/src/components/landing/CtaSection.tsx`** (Lines 76–112):
  Renders three dummy anchor links:
  - `<a href="#download-windows">Download for Windows (x64 / ARM)</a>`
  - `<a href="#download-mac">Download for macOS (Universal DMG)</a>`
  - `<a href="#download-linux">Download for Linux (.AppImage / .deb)</a>`
  *Defect*: Anchors `#download-windows`, `#download-mac`, `#download-linux` perform no actual file download, perform zero session validation, and do not redirect unauthenticated users to login or signup.

---

### 1.3 Windows-Only Binary Configuration & Packaging Specs
Inspecting `package.json` (Lines 311–329):
```json
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": [
            "x64"
          ]
        },
        {
          "target": "appx",
          "arch": [
            "x64",
            "arm64"
          ]
        }
      ],
      "icon": "assets/icon.ico",
      "artifactName": "order-it-up-${version}-win-${arch}.${ext}"
    },
```
- Electron builder produces: `order-it-up-1.0.0-win-x64.exe` (or canonical setup alias `Order-It-Up-Setup.exe`).
- `scripts/assert-release-artifact-names.cjs` (Lines 12–21) enforces: `artifact filenames must match [a-z0-9.-]+`.
- Canonical Windows setup file alias: `Order-It-Up-Setup.exe` or `order-it-up-1.0.0-win-x64.exe`.
- OS Labeling: `Windows 10 / 11 (64-bit Installer) • Offline Standalone Desktop POS`.

---

### 1.4 Authentication Modals and Pages Inspection

#### A. `landing/src/components/AuthModal.tsx`
- Lines 42–54: `handleQuickLogin(roleKey)` supports instant 1-click test credentials for `owner`, `manager`, `cashier`.
- Lines 56–95: `handleSubmit` handles custom email/password with simulated user session.
- Lines 104–130: Header with logo and subtitle.
- Lines 132–137: Download banner: `Sign in to unlock the {downloadPendingPlatform.toUpperCase()} Desktop POS installer`.
- Lines 141–170: Login vs Signup toggle tabs.
- Lines 184–211: Quick-fill seed credentials grid.
- *Defect*: No Google sign-in element anywhere in the modal.

#### B. `frontend/src/app/auth/login/page.tsx`
- Lines 86–128: `handleLogin` invokes `useAuthStore.getState().login(email, password, rememberMe)`.
- Lines 132–166: Multi-tenant business selector when user belongs to multiple organizations.
- Lines 168–243: Login form with email, password, remember me, error alerts, and link to `/auth/register`.
- *Defect*: No Google sign-in demo placeholder button. No handling for `?redirect=download` query param.

#### C. `frontend/src/app/auth/register/page.tsx`
- Lines 43–76: Step 1 (Restaurant Name, Owner Name, Work Email, Password).
- Lines 78–120: Step 2 (Country, Currency, Service Model: QSR, Cafe, Fine Dine) calling `/api/auth/register`.
- Lines 96–105: Writes `token`, `cloud_token`, `user`, and `tenant` to `localStorage`.
- *Defect*: No Google sign-in demo placeholder button.

---

### 1.5 Navbar Dynamic Authentication Reflection & Admin Dashboard Navigation

#### A. In `landing/src/components/Navbar.tsx`
- Lines 26–43: Tracks `currentUser` via `getStoredUser()` and listens for `orderitup_auth_change` custom events.
- Lines 133–156: When `currentUser` is present:
  - Renders user initial avatar and name with role pill (`currentUser.name`, `currentUser.role`).
  - Renders Logout icon button calling `setStoredUser(null)`.
  - *Critical Defect*: **Does NOT render any Dashboard navigation button!** Authenticated users cannot navigate to `/dashboard` or `/cloud-portal`.
- Lines 157–167: When unauthenticated:
  - Renders only `<button onClick={() => triggerOpenAuthModal("signup")}>Sign Up</button>`.
  - *Defect*: **Lacks a distinct "Login" button** in the header.

#### B. In `frontend/src/components/landing/Navbar.tsx`
- Lines 21–29:
  ```tsx
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { user, logout } = useAuthStore();
  const isAuthenticated = mounted && Boolean(user);
  const dashboardHref = mounted ? getLandingPage() : "/cloud-portal";
  ```
- Lines 64–97: When authenticated:
  - Renders user pill (`user?.name || user?.email`, role badge).
  - Renders `<Link href={dashboardHref} ...><LayoutDashboard /><span>Dashboard</span></Link>`.
  - Renders `<button onClick={() => logout()}><LogOut /></button>`.
- Lines 99–118: When unauthenticated:
  - Combines login/signup into a single `<Link href="/auth/login"><span>Login / Signup</span></Link>`.
- *Automated Test Failure*:
  Running `node tests/landing-page-e2e.test.cjs` yielded:
  ```text
  # Subtest: T1.5: Navbar Authentication Links and Accessibility
  not ok 5 - T1.5: Navbar Authentication Links and Accessibility
    error: 'Navbar must render brand name'
    expected: true, actual: false
    assert(navbarContent.includes('BRAND.name'), 'Navbar must render brand name');
  ```
  `frontend/src/components/landing/Navbar.tsx` line 45 hardcodes `<span ...>Order It Up</span>` instead of referencing `{BRAND.name}`. Also line 219 expects `'100% Offline Engine'`.

---

### 1.6 Session Persistence & Store Alignment
- `frontend/src/store/auth.ts`:
  - Storage keys: `'token'`, `'cloud_token'`, `'tenant'`, `'user'`.
  - `persistSession` (Lines 49–64) writes tokens and tenant, then dispatches `THEME_REHYDRATION_EVENT`.
  - `loadFromStorage` (Lines 162–232) validates token against `/auth/me` and refreshes user profile.
- `landing/src/lib/auth.ts`:
  - Storage key: `'orderitup_demo_auth_user'`.
  - Event: `orderitup_auth_change`.
  - *Divergence*: `landing/` and `frontend/` use different storage keys. If a user logs in on `landing/`, `frontend/` does not recognize the session unless `token` and `user` are also populated in `localStorage`.

---

## 2. Logic Chain

1. **Windows-Only Restriction**:
   - *From Observation 1.2 & 1.3*: `landing/` and `frontend/` offer macOS DMG and Linux AppImage buttons, but the approved requirement explicitly mandates: *"Configure the desktop application download flow to provide the Windows version only"*.
   - *Inference*: macOS and Linux download buttons should be removed from `CtaSection.tsx` and `ModalProvider.tsx`. The CTA must feature a dedicated Windows installer button: `Download for Windows (x64 / ARM64)` providing `Order-It-Up-Setup.exe` (or `order-it-up-1.0.0-win-x64.exe`). Platform detection (`navigator.userAgent`) can display an informative note when viewed on macOS/Linux/Mobile: *"Order It Up Desktop POS is tailored for Windows counter terminals. Download on your Windows 10/11 PC."*
   - *Test Compatibility Note*: In `tests/challenger-ui-stress.test.cjs` (Lines 664–669), the adversarial test asserts `inPageAnchors.filter((a) => a.startsWith('#download-')).length > 0`. Retaining `id="download-windows"` (and providing `#download-windows` compatibility) ensures tests pass while scoping the offering to Windows only.

2. **Download Redirection & Gating**:
   - *From Observation 1.2*: In `frontend/src/components/landing/Navbar.tsx` and `Hero.tsx`, download buttons currently jump to anchor `#download` without verifying whether the user is logged in. In `CtaSection.tsx`, buttons link to `#download-windows` without triggering an actual download.
   - *Inference*:
     - When an **authenticated user** clicks Download: Initiate the direct download of `Order-It-Up-Setup.exe` immediately and show the authorized download toast.
     - When an **unauthenticated user** clicks Download: Direct the user to the authentication interface before/while downloading. In `landing/`, this is achieved by opening `AuthModal` with `downloadPendingPlatform: "windows"`. In `frontend/`, this can be achieved by navigating to `/auth/login?redirect=download` (or displaying a quick auth modal). Upon successful sign-in or demo sign-in, the system automatically triggers the download of `Order-It-Up-Setup.exe` and navigates to the user's role dashboard (`/dashboard` or `/cloud-portal`).

3. **Google Sign-In Demo Placeholder**:
   - *From Observation 1.4*: Currently, neither `landing/src/components/AuthModal.tsx` nor `frontend/src/app/auth/login/page.tsx` nor `frontend/src/app/auth/register/page.tsx` contains a Google sign-in button.
   - *Inference*: A clean, branded Google Sign-In element must be introduced:
     - Vector: Multi-color Google 'G' SVG icon (Blue `#4285F4`, Green `#34A853`, Yellow `#FBBC05`, Red `#EA4335`).
     - Styling: White pill button with `border-slate-300`, `text-slate-700`, subtle hover elevation, Google Roboto/Sans typography, and accessible label `"Continue with Google"`.
     - Demo Feedback: When clicked, the button shows a momentary connecting animation (`"Signing in with Google..."`), sets the demo owner session (`demo.owner@orderitup.in` / Priya Sharma), triggers any pending download, and displays a success toast: `"Signed in with Google (Demo Mode)"`.

4. **Navbar Auth State & Dashboard Navigation**:
   - *From Observation 1.5*:
     - In `landing/src/components/Navbar.tsx`: Authenticated users see their name and role, but there is no link or button to access the Admin Dashboard. Adding a prominent `<Link href="/dashboard" ...><LayoutDashboard /><span>Dashboard</span></Link>` resolves this requirement. Furthermore, adding a distinct `Login` button alongside `Sign Up` when unauthenticated satisfies requirement R2.
     - In `frontend/src/components/landing/Navbar.tsx`: Replace hardcoded `"Order It Up"` with `{BRAND.name}` and ensure the `'100% Offline Engine'` status chip is rendered to resolve the test failure in `tests/landing-page-e2e.test.cjs` (T1.5). Add distinct `Login` and `Signup` links.

5. **Storage Unification**:
   - *From Observation 1.6*: When a user authenticates in `landing/` (`AuthModal.tsx` / `setStoredUser`), also write `localStorage.setItem('user', JSON.stringify(authUser))` and `localStorage.setItem('token', 'demo_session_token')`. This ensures that when the user clicks the "Dashboard" button from `landing/`, `AuthGuard.tsx` in `frontend/` reads `localStorage.getItem('user')` via `getLandingPage()` and smoothly grants access to `/dashboard` or `/cloud-portal` without a redundant login prompt.

---

## 3. Caveats

1. **No External OAuth Dependencies**: Per project instructions and integrity mode, Google Sign-In is strictly a client-side demo placeholder. It must not attempt real network requests to `accounts.google.com` or include heavy Google GSI scripts.
2. **Offline-First Invariant**: The desktop POS binary (`Order-It-Up-Setup.exe`) runs standalone on local SQLite (`flo.db`) and Express (`:3001`). Web downloads must serve a valid mock installer file or direct static binary link without crashing when the internet is disconnected.
3. **Existing Challenger Test Invariants**: `tests/challenger-ui-stress.test.cjs` checks that `#download-` anchors exist in `frontend/out/index.html`. The Windows download button must retain `href="#download-windows"` (or include `#download-windows` in its DOM structure) while executing the download click handler.
4. **Desktop vs Web Cashier Boundary**: As verified in `tests/challenger-role-routing.test.cjs`, Cashier on web must route to `/dashboard` (or web operational preview) and never to `/pos` (which is restricted to Electron desktop).

---

## 4. Conclusion & Proposed Implementation Specifications

### 4.1 Target Files & Architectural Scope

The implementation for Requirement R2 is localized to the following 8 files:

```text
landing/
├── src/components/Navbar.tsx         # Add Dashboard button when authed; add separate Login button; Windows download trigger
├── src/components/Hero.tsx           # Windows-only subtext; Windows download trigger
├── src/components/CtaSection.tsx     # Replace multi-OS buttons with dedicated Windows (x64/ARM64) installer card & specs
├── src/components/AuthModal.tsx      # Add authentic Google Sign-in demo button & interactive feedback
├── src/components/ModalProvider.tsx  # Scope download to Windows-only (Order-It-Up-Setup.exe)
└── src/lib/auth.ts                  # Dual-write session keys ('user', 'token', 'orderitup_demo_auth_user')

frontend/
├── src/components/landing/Navbar.tsx # Fix BRAND.name & offline badge (T1.5 fix); separate Login/Signup; download auth gate
├── src/components/landing/CtaSection.tsx # Windows-only installer button with download trigger and auth redirection
├── src/app/auth/login/page.tsx      # Add Google Sign-in demo placeholder button with demo feedback
└── src/app/auth/register/page.tsx   # Add Google Sign-in demo placeholder in Step 1
```

---

### 4.2 Exact Proposed Changes

#### Proposed Change 1: Google Sign-in Demo Component Specification
Embed this standard component or inline element across `landing/src/components/AuthModal.tsx`, `frontend/src/app/auth/login/page.tsx`, and `frontend/src/app/auth/register/page.tsx`:

```tsx
{/* Google Sign-in Demo Placeholder */}
<button
  type="button"
  onClick={handleGoogleDemoSignIn}
  disabled={isGoogleLoading}
  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
  aria-label="Continue with Google"
>
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
  <span>{isGoogleLoading ? "Connecting with Google..." : "Continue with Google"}</span>
  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wide">
    Demo
  </span>
</button>
```

#### Proposed Change 2: Windows-Only Download Flow & Platform Labeling
In `landing/src/components/CtaSection.tsx` & `ModalProvider.tsx`:
- Configure direct filename: `Order-It-Up-Setup.exe` (or `order-it-up-1.0.0-win-x64.exe`).
- Display platform badge: `Windows 10 / 11 (64-bit / ARM64 Installer)`.
- Client-side OS detection:
  ```ts
  const isWindows = typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent || '');
  ```
  If `!isWindows`, display hint: `"Order It Up Desktop POS runs on Windows counter hardware. Download to deploy on your Windows POS PC."`

#### Proposed Change 3: Gated Download Redirection Handling
- Unauthenticated user clicks Download in `frontend/src/components/landing/`:
  - Intercept click: redirect to `/auth/login?redirect=download` (or open auth modal).
  - On `/auth/login`, upon successful authentication or Google Demo sign-in, detect `redirect === 'download'`, trigger the Windows setup installer download, and redirect to `getLandingPage()` (`/dashboard` or `/cloud-portal`).

#### Proposed Change 4: Dynamic Navbar Auth Reflection & Admin Dashboard Link
- In `landing/src/components/Navbar.tsx`:
  - When `currentUser` exists:
    ```tsx
    <a
      href="/dashboard"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-xs active:scale-[0.98] transition-all whitespace-nowrap"
    >
      <LayoutDashboard className="w-3.5 h-3.5" />
      <span>Dashboard</span>
    </a>
    ```
  - When unauthenticated:
    Render separate `Sign In` (`triggerOpenAuthModal("login")`) and `Sign Up` (`triggerOpenAuthModal("signup")`) buttons.
- In `frontend/src/components/landing/Navbar.tsx`:
  - Update line 45 to render `{BRAND.name}`.
  - Ensure the `'100% Offline Engine'` status chip is present to satisfy test `T1.5`.

---

## 5. Verification Method

To verify the surveyed requirements and subsequent implementation:

1. **Landing Page Automated E2E Suite**:
   ```powershell
   node tests/landing-page-e2e.test.cjs
   ```
   *Expected Result*: All 21 tests pass, including `T1.5: Navbar Authentication Links and Accessibility`.

2. **Challenger UI Stress & Static Export Audit**:
   ```powershell
   node tests/challenger-ui-stress.test.cjs
   ```
   *Expected Result*: All 25 tests pass, confirming static export HTML integrity, zero broken routes, and valid `#download-windows` anchors.

3. **Challenger Role-Routing & Platform Invariants Test**:
   ```powershell
   node tests/challenger-role-routing.test.cjs
   ```
   *Expected Result*: All 208 role permutation tests pass, verifying web vs desktop route boundaries.

4. **Frontend Code Quality & Static Export Build**:
   ```powershell
   npm run lint
   npm run build:frontend
   ```
   *Expected Result*: Zero ESLint errors and zero TypeScript errors; Next.js static export generates 34 clean static pages in `frontend/out/`.

5. **Manual Verification Procedure**:
   - Open landing page in browser (`http://localhost:3000` or `landing/` on `:3004`).
   - Click "Download Desktop POS" while unauthenticated: observe immediate prompt/redirection to signup/login interface.
   - Click "Continue with Google" in the auth modal/page: observe simulated loading, toast feedback ("Signed in with Google as Demo Owner"), dynamic update of Navbar showing user avatar, role, and "Dashboard" button, followed by automatic download initiation of `Order-It-Up-Setup.exe`.
   - Click "Dashboard" in Navbar: observe direct navigation to `/dashboard` or `/cloud-portal`.
   - Click "Sign Out": observe session cleared and Navbar immediately returning to unauthenticated state with prominent Login and Signup buttons.
