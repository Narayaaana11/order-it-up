# Codebase Survey & Technical Report: Auth & Static Export Architecture (Requirement R2)

**Explorer**: Explorer 2 (`explorer_survey_2`)  
**Target Milestone**: Requirement R2 (Complete Auth & Navigation Integration) & Static Export Compatibility  
**Date / Timestamp**: 2026-10-30T21:59:00Z  
**Target URL**: `https://orderitup.pages.dev` / `frontend/src/app/page.tsx`  

---

## Executive Summary

This investigation provides a comprehensive survey of the authentication subsystem, static export mechanisms, client-side routing, and landing page integration for Order It Up (`frontend/`).

### Key Findings at a Glance:
1. **Existing Authentication Routes**:
   - `/auth/login` (`frontend/src/app/auth/login/page.tsx`): Active, uses `useAuthStore` (`api.post('/auth/login')`), handles credentials, tenant selection, password recovery link (`/auth/recover`), and redirects authenticated users via `getLandingPage()`.
   - `/auth/register` (`frontend/src/app/auth/register/page.tsx`): Active 2-step onboarding wizard for SaaS restaurant creation (`cloudApi.post('/api/auth/register')`), stores tokens and tenant info in `localStorage`, and redirects to `/cloud-portal?onboarded=true`.
   - `/auth/recover` (`frontend/src/app/auth/recover/page.tsx`): Master PIN recovery for offline local setups.
2. **Current Landing Page Navigation Gaps**:
   - `Navbar.tsx` (`frontend/src/components/landing/Navbar.tsx`): Only renders an unstyled text link for "Owner Login" (`/auth/login`). It completely lacks a "Sign Up" or "Register" button (`/auth/register`) in both desktop and mobile views. It is not auth-state aware (does not show "Dashboard" or user status when logged in).
   - `Hero.tsx` (`frontend/src/components/landing/Hero.tsx`): Only renders "Download Desktop POS" (`#download`) and "Explore Interactive Demo" (`#ui-preview`). Lacks any direct action button for registration or login.
   - `CtaSection.tsx` (`frontend/src/components/landing/CtaSection.tsx`): Only contains platform download buttons (`#download-windows`, `#download-mac`, `#download-linux`). Contains no direct action buttons for registration or login.
3. **Static Export & Cloudflare Pages Configuration**:
   - Next.js is configured with `output: 'export'` when `NEXT_BUILD_MODE=desktop` or `NEXT_BUILD_MODE=web` (`frontend/next.config.ts`).
   - `trailingSlash: true` ensures every static route emits a directory with `index.html` (e.g. `frontend/out/auth/login/index.html`), which is 100% compatible with Cloudflare Pages and local file systems.
   - Any client hook using `useSearchParams()` must be wrapped in a `<Suspense>` boundary to prevent static prerender build failure (as already properly done in `auth/login/page.tsx`). Landing page components currently avoid `useSearchParams()` entirely, ensuring zero prerender risk.
4. **Auth State & Role Routing Architecture**:
   - Frontend authentication is backed by Zustand (`frontend/src/store/auth.ts`) persisting session tokens in `localStorage` under both `'token'` and `'cloud_token'`.
   - In web mode (`orderitup.pages.dev`), `api` dynamically adapts to `CLOUD_API_BASE` (`https://orderitup-cloud-api.narayaaana11.workers.dev`), whereas in Electron it targets `window.location.origin/api` (`http://localhost:3001/api`).
   - `getLandingPage()` in `frontend/src/components/layout/AuthGuard.tsx` can be enhanced to route users directly to their designated dashboard according to the role definitions in `users.md`.

---

## 1. Detailed Investigation of Authentication Surfaces

### 1.1 Existing Pages and Routes
The active authentication surfaces are housed under `frontend/src/app/auth/`:

| Route | File Path | Component Name | Behavior & Features |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `frontend/src/app/auth/login/page.tsx` | `LoginPage` / `LoginContent` | • Email & password input with reveal toggle.<br>• Tenant picker when multiple organizations exist.<br>• Calls `useAuthStore.getState().login()`.<br>• Redirects via `router.push(getLandingPage())`.<br>• Link to `/auth/recover`.<br>• Wrapped in `<Suspense>` for `useSearchParams()` export safety.<br>• *Gap*: Missing direct link to `/auth/register`. |
| `/auth/register` | `frontend/src/app/auth/register/page.tsx` | `SaaSQuickRegisterPage` | • 2-step onboarding: Step 1 (Brand, Owner, Email, Password, Country/Currency), Step 2 (Concept style: QSR, Cafe, Fine Dine).<br>• Calls `cloudApi.post('/api/auth/register')`.<br>• Persists JWT & tenant into `localStorage`.<br>• Redirects to `/cloud-portal?onboarded=true`.<br>• Has footer link back to `/auth/login`. |
| `/auth/recover` | `frontend/src/app/auth/recover/page.tsx` | `RecoverAccessPage` | • Local desktop Master PIN access recovery.<br>• Validates 4-digit PIN against local database. |

### 1.2 Auth State Management (`frontend/src/store/auth.ts`)
- **Store Implementation**: Zustand store `useAuthStore` with interface:
  ```typescript
  interface AuthState {
    user: User | null;
    token: string | null;
    tenants: Tenant[];
    currentTenant: Tenant | null;
    loading: boolean;
    login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    selectTenant: (tenantId: number | string) => Promise<void>;
    logout: () => void;
    loadFromStorage: () => Promise<void>;
    updateCurrentTenant: (updates: Partial<Tenant>) => void;
  }
  ```
- **Token Persistence**:
  ```typescript
  function persistSession(token: string, tenant: Tenant | null): void {
    localStorage.setItem('token', token);
    localStorage.setItem('cloud_token', token);
    if (tenant) localStorage.setItem('tenant', JSON.stringify(tenant));
  }
  ```
- **Storage Availability**: Defensive error handling using custom `StorageUnavailableError` when browser storage is blocked.
- **Rehydration**: `loadFromStorage()` reads `localStorage.getItem('token')` and `localStorage.getItem('user')`, then validates session with `api.get('/auth/me')`.

### 1.3 Dual-Environment API Client (`frontend/src/lib/api.ts`)
The API layer automatically branches based on runtime environment:
```typescript
export const CLOUD_API_BASE =
  process.env.NEXT_PUBLIC_OIU_CLOUD_API_URL ||
  'https://orderitup-cloud-api.narayaaana11.workers.dev';

export function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).electronAPI ||
    (window as any).process?.versions?.electron ||
    navigator.userAgent.toLowerCase().includes('electron')
  );
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api';
  if (isElectronEnvironment()) {
    return `${window.location.origin}/api`;
  }
  return CLOUD_API_BASE;
}
```
- On Cloudflare Pages (`orderitup.pages.dev`), `isElectronEnvironment()` returns `false`, resolving all API calls to the Cloudflare Workers edge backend (`CLOUD_API_BASE`).
- Request interceptors automatically inject `Authorization: Bearer <token>` from `localStorage`.
- Response interceptors catch 401s without infinite redirect loops on public/auth routes.

---

## 2. Static Export & Cloudflare Pages Configuration

### 2.1 Next.js Configuration (`frontend/next.config.ts`)
```typescript
const isExport = process.env.NEXT_BUILD_MODE === "desktop" || 
                 process.env.NEXT_BUILD_MODE === "web" || 
                 process.env.NEXT_BUILD_MODE === "export";

const nextConfig: NextConfig = {
  output: isExport ? "export" : undefined,
  trailingSlash: isExport,
  images: {
    unoptimized: isExport,
  },
  turbopack: {
    root: path.resolve(process.cwd(), '..'),
    resolveAlias: {
      '@countries': '../main/countries.ts',
    },
  },
};
```

### 2.2 Static Export Guarantees & Constraints
1. **Trailing Slashes (`trailingSlash: true`)**:
   - Compiles routes to static directory trees: `out/auth/login/index.html`, `out/auth/register/index.html`, `out/cloud-portal/index.html`.
   - On Cloudflare Pages, requests to `/auth/login` and `/auth/login/` cleanly map to `out/auth/login/index.html` without 404s.
2. **Dynamic Client Navigation**:
   - `next/link` and `useRouter` perform client-side transitions after initial page hydration.
   - All links to internal auth routes must use `next/link` (`<Link href="/auth/login">`, `<Link href="/auth/register">`) rather than raw `<a>` tags to preserve client-side Single Page Application (SPA) state and prevent full document reloads.
3. **Suspense Boundaries for Prerender Safety**:
   - In Next.js App Router static export, calling `useSearchParams()` outside a `<Suspense>` boundary causes `next build` export errors (`Error: useSearchParams() should be wrapped in a suspense boundary`).
   - The landing page (`frontend/src/app/page.tsx` and all components in `frontend/src/components/landing/`) currently does not use `useSearchParams()`.
   - Any state needed for interactive role preview tabs should be managed cleanly with local React state (`useState`) to guarantee zero build-time export risk.
4. **Hydration Mismatch Prevention**:
   - During static export, HTML is prerendered on Node where `localStorage` is undefined.
   - If the Navbar renders conditionally based on `useAuthStore` immediately on first render pass, React 19 will throw hydration warnings/mismatches if `localStorage` contains a logged-in user.
   - **Recommended Pattern**:
     ```tsx
     const [mounted, setMounted] = useState(false);
     const { user } = useAuthStore();
     useEffect(() => setMounted(true), []);
     const isAuthenticated = mounted && Boolean(user);
     ```

---

## 3. Integration Blueprint for Requirement R2

### 3.1 Landing Page Navbar (`frontend/src/components/landing/Navbar.tsx`)
Currently, `Navbar.tsx` contains:
```tsx
<div className="hidden md:flex items-center gap-4">
  <div className="inline-flex items-center gap-2 ...">100% Offline Engine</div>
  <Link href="/auth/login" className="...">Owner Login</Link>
  <a href="#download" className="...">Download POS</a>
</div>
```

**Proposed Integration**:
1. **Unauthenticated State**:
   - Retain the engine status badge or modern subtle shimmer badge.
   - **Login Button**: `<Link href="/auth/login">` styled as clean, accessible text/ghost button (`Sign In` or `Owner Login`).
   - **Signup Button**: `<Link href="/auth/register">` styled as prominent primary action button (`Get Started Free` or `Sign Up`) with React Bits shimmer/shiny badge and tactile hover state.
   - **Download Button**: Accessible desktop POS download action or secondary icon.
2. **Authenticated State** (when `mounted && user`):
   - Render user greeting / role pill (e.g. `Owner`, `Manager`, `Accountant`).
   - Primary Action: `<Link href={getLandingPage()}>Dashboard / Cloud HQ →</Link>`.
   - Accessible dropdown or quick action with `Logout` (`logout()`).
3. **Mobile Drawer Navigation**:
   - Include both `Sign In` (`/auth/login`) and `Create Restaurant Account` (`/auth/register`) buttons in the mobile navigation drawer so mobile users on `orderitup.pages.dev` have immediate access.

### 3.2 Hero Section (`frontend/src/components/landing/Hero.tsx`)
Currently, `Hero.tsx` only has:
- `<a href="#download">Download Desktop POS</a>`
- `<a href="#ui-preview">Explore Interactive Demo</a>`

**Proposed Integration**:
- Replace or complement with prominent SaaS direct action buttons:
  - **Primary CTA**: `<Link href="/auth/register" className="...">Get Started Free / Launch Restaurant →</Link>`
  - **Secondary CTA**: `<Link href="/auth/login" className="...">Sign In to Cloud HQ</Link>` or `<a href="#roles" className="...">Preview Role Dashboards</a>`
  - Reassurance subtext retains: "Zero credit card required • Instant cloud setup • 100% offline desktop option available".

### 3.3 CTA Section (`frontend/src/components/landing/CtaSection.tsx`)
Currently, `CtaSection.tsx` only offers platform desktop installer downloads (`#download-windows`, `#download-mac`, `#download-linux`).

**Proposed Integration**:
- Add a prominent primary web onboarding banner above or integrated into the platform download section:
  - **Headline**: "Start Running Order It Up in Minutes"
  - **Action Button 1**: `<Link href="/auth/register">Create Free Restaurant Account →</Link>` (Primary)
  - **Action Button 2**: `<Link href="/auth/login">Already a Merchant? Sign In</Link>` (Secondary / Outline)
  - Maintain the native desktop downloads below for merchants deploying offline counter hardware.

---

## 4. Role Dashboards & Role-Based Routing Matrix

### 4.1 Architectural Boundary: Web Platform vs Desktop POS
According to Section 1 of `users.md`:
- **Desktop POS Client (Electron)**: Counter POS Billing (`/pos`), Local SQLite, ESC/POS Thermal Printing, 24V Solenoid Cash Drawer Pulse.
- **Web Application (`orderitup.pages.dev`)**: Public Landing (`/`), Registration (`/auth/register`), SaaS Control Plane (`/cloud-portal`), CRM (`/customers`), Owner/Manager Dashboards (`/dashboard`), Financial/Tax Auditing (`/reports`), Menu & Catalog (`/products`), Staff Onboarding (`/staff`).
- **Strict Boundary**: *No Web-Based POS Billing* (`/pos` is hidden on web unless running inside Electron).

### 4.2 Role-to-Route Mapping (`users.md` vs Codebase)

| Persona | Internal Role Key | Target Route | Secondary Routes | Environment & Boundary |
| :--- | :--- | :--- | :--- | :--- |
| **Super Administrator** | `SUPER_ADMIN` / `super_admin` | `/cloud-portal` | `/dashboard`, `/staff` | Web Cloud HQ Portal |
| **Central Admin** | `ADMIN` / `admin` | `/cloud-portal` | `/dashboard` | Web Cloud HQ Portal |
| **Restaurant Owner** | `owner` | `/cloud-portal` (Web) / `/dashboard` (Desktop) | `/dashboard`, `/reports`, `/products`, `/settings` | Full Organization Authority |
| **Branch Manager** | `manager` / `branch_manager` | `/dashboard` | `/reports`, `/orders`, `/tables` | Branch Operations |
| **Head Accountant** | `accountant` | `/reports` | `/reports` (GST / CGST / SGST / Tally export) | Financial Audits only |
| **Front Cashier** | `cashier` | `/pos` (Desktop) / `/orders` (Web) | `/orders` | Counter Billing (Desktop primary) |
| **Server / Waiter** | `server` / `waiter` | `/tables` | `/orders` | Mobile Floor Plan & Tables |
| **Kitchen Chef** | `chef` / `kitchen` | `/kds` | `/kds-standalone` | KDS Kanban & Ticket Bumping |
| **Guest / Customer** | `customer` | `/menu` | `/qr` | Contactless Menu & QR Ordering |

### 4.3 Proposed Enhanced `getLandingPage()` Logic
In `frontend/src/components/layout/AuthGuard.tsx`:
```typescript
export function getLandingPage(): string {
  if (typeof window !== 'undefined') {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        const role = (u.role || '').toLowerCase();

        // 1. Central SaaS & Enterprise Owners
        if (role === 'owner' || role === 'super_admin' || role === 'admin') {
          return isElectronEnvironment() ? '/dashboard' : '/cloud-portal';
        }
        // 2. Branch Managers
        if (role === 'manager' || role === 'branch_manager') {
          return '/dashboard';
        }
        // 3. Financial Accountants
        if (role === 'accountant') {
          return '/reports';
        }
        // 4. Kitchen Chefs
        if (role === 'chef' || role === 'kitchen') {
          return '/kds';
        }
        // 5. Floor Waiters & Captains
        if (role === 'server' || role === 'waiter') {
          return '/tables';
        }
        // 6. Customers / Digital Menu
        if (role === 'customer') {
          return '/menu';
        }
        // 7. Cashiers
        if (role === 'cashier') {
          return isElectronEnvironment() ? '/pos' : '/dashboard';
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

---

## 5. Test Suite & Validation Matrix

### 5.1 Relevant Test Suites in `tests/`
The repository contains robust test coverage guarding auth, static exports, and runtime security:

| Test Script | Command | Area Covered |
| :--- | :--- | :--- |
| `tests/auth-ui-deterministic.test.ts` | `npm run test:auth-ui-deterministic` | Login error parsing, lockout handling, `StorageUnavailableError` verification. |
| `tests/challenger-build-audit.test.cjs` | `node tests/challenger-build-audit.test.cjs` | Prerendered static export verification: validates all 34 routes in `frontend/out` including `/auth/login`, `/auth/register`, `/cloud-portal`. |
| `tests/cloud-auth-hardening.test.ts` | `npm run test:cloud-auth` | Web Crypto JWT verification, scrypt password hashing, tenant isolation, role verification. |
| `tests/static-route-resolution.test.ts` | `npm run test:static-routes` | Static page path resolution and directory fallback index.html handling. |
| `tests/locale-chunk-splitting.test.ts` | `npm run test:locale-chunks` | Verifies chunk splitting and prerendered static assets in `frontend/out`. |
| `tests/cors-security.test.ts` | `npm run test:cors` | CORS headers allowlisting `https://orderitup.pages.dev`. |

### 5.2 Build & Lint Validation Requirements
- `npm run lint`: Runs `eslint main/ shared/` and `npm --prefix frontend run lint`.
- `npm run build:frontend`: Executes `cd frontend && npx cross-env NEXT_BUILD_MODE=desktop npm run build`, compiling Next.js statically to `frontend/out/`.

---

## 6. Implementation Action Plan for Downstream Agents

| Step | Target File | Proposed Modification | Rationale |
| :--- | :--- | :--- | :--- |
| **1** | `frontend/src/components/landing/Navbar.tsx` | Add accessible `<Link href="/auth/login">Sign In</Link>` and `<Link href="/auth/register">Sign Up Free</Link>` buttons. Add auth-aware state rendering "Dashboard" when logged in. | Fulfills Acceptance Criterion 1 for R2. |
| **2** | `frontend/src/components/landing/Hero.tsx` | Add direct action buttons to `/auth/register` and `/auth/login` alongside demo/download triggers. | Fulfills Acceptance Criterion 2 for R2. |
| **3** | `frontend/src/components/landing/CtaSection.tsx` | Add direct onboarding action buttons to `/auth/register` and `/auth/login` alongside desktop download cards. | Fulfills Acceptance Criterion 2 for R2. |
| **4** | `frontend/src/app/auth/login/page.tsx` | Add explicit link to `/auth/register` ("Don't have an account? Sign up"). | Improves navigation loop between auth pages. |
| **5** | `frontend/src/components/layout/AuthGuard.tsx` | Update `getLandingPage()` with full role-to-route resolution as specified in `users.md`. | Fulfills Acceptance Criteria for R3. |
| **6** | `frontend/src/components/landing/RolePersonas.tsx` | Enhance role selector tabs with interactive preview triggers linking to role-specific dashboard views. | Fulfills Requirement R3 showcase tabs. |
| **7** | `frontend/src/app/page.tsx` | Verify clean client rendering with React 19 without hydration mismatches. | Fulfills R4 static export validation. |
