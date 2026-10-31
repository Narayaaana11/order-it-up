# Project: Order It Up Production Web Platform & Landing Page Upgrade

## Architecture
- **Dual-App Ecosystem**:
  1. `landing/`: Standalone Next.js 16 (App Router) + React 19 + Tailwind CSS v4 marketing application statically exported (`output: 'export'`) on `:3004`.
  2. `frontend/`: Statically exported Next.js 16 + React 19 application hosting root landing mirror, web admin dashboards (`/cloud-portal`, `/dashboard`, `/reports`), and auth pages (`/auth/login`, `/auth/register`).
  3. `main/`: Electron main process, Express backend (`:3001`), SQLite WAL (`flo.db`), and cloud services (`amazon-s3.ts`).
- **Separation of Concerns**:
  - Web platform is strictly dedicated to SaaS onboarding, restaurant admin dashboards, financial reports, and cloud data management. POS billing is strictly prohibited on web and blocked via `isElectronEnvironment()` guards.
  - Desktop POS is dedicated strictly to cashier counter billing, table orders, and ESC/POS thermal printing.
- **Visuals & Identity**:
  - Crisp light theme palette (`#F8FAFC` canvas, `#FFFFFF` cards, `#E2E8F0` borders, `#F07928`/`#EA580C` accents).
  - Authentic high-resolution Unsplash photography for real-world restaurant POS, KDS kitchen line, table floor plan, mobile ordering, and food dish previews.
  - Clean, standard Lucide SVG icons across all controls, eliminating raw emojis.
- **Windows-Only Download & Gated Redirection**:
  - Desktop downloads provide Windows setup installer only (`Order-It-Up-Setup.exe` / `order-it-up-1.0.0-win-x64.exe`).
  - Unauthenticated download attempts intercept to signup/login interface (`AuthModal` or `/auth/login?redirect=download`).
  - Interactive Google Sign-In demo placeholder button with official 4-color branding and demo session initialization.
  - Navbar dynamically reflects active authentication state (user pill, avatar, logout) and exposes the Admin Dashboard link.
- **Startup Terms & Conditions**:
  - Professional 5-tab startup policy architecture: SaaS Terms & Scope, SLA & Offline Invariants, Merchant Data Sovereignty & S3 Segregation, Acceptable Use & Merchant Obligations, and Subscription Billing & Zero-Lock-In Cancellation.
- **Cloud Data Storage & S3 Bucket Management**:
  - Multi-tenant S3-compatible data management service with bucket configuration (`endpoint`, `forcePathStyle`, `retentionDays`, `mockMode`).
  - Segregated customer operational data (`tenants/{tenantId}/...`) for backups, user account archives, payment records, and media assets.
  - Non-blocking offline outbox queue and local mock driver for offline-first resilience.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Authentic Unsplash Photography | Restaurant counter POS in Hero, dish thumbnails in UiPreviews cart, and contextual photos for all 6 Role Personas | M1 | R1 |
| 2 | Standardized UI Icons | Replace all raw emojis (👑, 👔, 💳) with standard Lucide icons; clean icon alignment across all landing sections | M1 | R1 |
| 3 | Redesigned Startup Terms & Conditions | 5-tab startup legal policy suite: SaaS Terms, SLA & Uptime, Data Sovereignty & S3, Acceptable Use, Subscription Cancellation | M1 | R3 |
| 4 | Windows-Only Desktop Download | Configure download flow to serve `Order-It-Up-Setup.exe`; remove macOS/Linux buttons; maintain `#download-windows` anchors | M2 | R2 |
| 5 | Download Gating & Auth Redirection | Intercept unauthenticated download clicks to AuthModal or `/auth/login?redirect=download`; auto-trigger download upon sign-in | M2 | R2 |
| 6 | Google Sign-in Demo Placeholder | Official 4-color Google 'G' button with demo sign-in feedback, demo owner session creation, and pending download resolution | M2 | R2 |
| 7 | Dynamic Navbar Auth State & Dashboard Link | Navbar dynamically renders user avatar/role pill and "Dashboard" link when authed; distinct Login/Signup when unauthed | M2 | R2 |
| 8 | E2E Brand Name & Status Chip Fix | Fix `frontend/src/components/landing/Navbar.tsx` to render `{BRAND.name}` and `'100% Offline Engine'` passing test T1.5 | M2 | R2 |
| 9 | Web Admin Dashboard Operational Reports | Render 16 operational metrics (gross revenue, refunds, net sales, orders, AOV, Cash/Card/UPI split, top items, low stock) on web | M3 | R4 |
| 10 | Strict Desktop POS Billing Separation | Verify web POS blocking screen and ensure desktop cashier operates strictly for billing without management dashboard panels | M3 | R4 |
| 11 | S3 Bucket Data Management Service | S3-compatible client service managing platform data, user archives, payment records, and media with tenant prefix segregation | M4 | R5 |
| 12 | S3 Tenant Segregation & Offline Mock Mode | Enforce `tenants/{tenantId}/...` hierarchy, IAM policy isolation, and local filesystem mock adapter with outbox queue | M4 | R5 |
| 13 | Final Verification & Forensic Integrity Audit | Complete validation pass: `npm run lint`, `npm run build:frontend`, automated E2E tests, challenger stress tests, and auditor veto | M5 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Landing Page Visuals, Unsplash Media, Lucide Icons & Terms Redesign | `landing/src/components/Hero.tsx`, `UiPreviews.tsx`, `RolePersonas.tsx`, `AuthModal.tsx`, `TermsModal.tsx`, `constants.ts` | none | DONE |
| M2 | Download Flow, Windows Installer, Auth Redirection, Google Demo & Dynamic Navbar | `landing/src/components/Navbar.tsx`, `CtaSection.tsx`, `ModalProvider.tsx`, `frontend/src/components/landing/Navbar.tsx`, `frontend/src/components/landing/CtaSection.tsx`, `frontend/src/app/auth/login/page.tsx` | M1 | DONE |
| M3 | Web Admin Dashboard Operational Reports & POS Separation | `frontend/src/app/cloud-portal/page.tsx`, `frontend/src/app/(dashboard)/dashboard/page.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/app/(dashboard)/pos/page.tsx` | M2 | DONE |
| M4 | Cloud Data Storage & S3 Bucket Management Service | `main/services/amazon-s3.ts`, `main/routes/amazon-s3.ts`, `frontend/src/components/settings/AmazonS3Settings.tsx`, S3 mock driver | none | DONE |
| M5 | Final Verification & Forensic Integrity Audit | E2E test runner, `landing-page-e2e.test.cjs`, `challenger-ui-stress.test.cjs`, `teamwork_auditor` forensic audit | M1, M2, M3, M4 | DONE |

## Interface Contracts

### `UNSPLASH_ASSETS` Contract
```typescript
export const UNSPLASH_ASSETS = {
  posTerminalCounter: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80",
  kitchenChefPrep: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1200&q=80",
  restaurantFloorTables: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  waiterMobileTablet: "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=1200&q=80",
  accountingLedger: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80",
  dishes: {
    trufflePizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=160&q=80",
    paneerTikka: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=160&q=80",
    coldBrewLatte: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=160&q=80",
    chocolateLavaCake: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=160&q=80",
  }
};
```

### `S3ServiceConfig` & Data Management Contract
```typescript
export interface S3ServiceConfig {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  enabled: boolean;
  retentionDays: number;
  mockMode?: boolean;
}

export interface S3StorageObject {
  key: string;
  tenantId?: string;
  domain: 'platform' | 'backups' | 'users' | 'payments' | 'media';
  contentType: string;
  body: Buffer | Uint8Array | string;
}
```

## Code Layout
- `landing/src/components/Hero.tsx`: Desktop POS window preview with Unsplash photography and live glass telemetry chips
- `landing/src/components/UiPreviews.tsx`: POS cart simulator with authentic dish photography thumbnails
- `landing/src/components/RolePersonas.tsx`: 6-persona interactive showcase with authentic role photography
- `landing/src/components/AuthModal.tsx`: Lucide icons, Google Sign-in demo button, demo quick login
- `landing/src/components/TermsModal.tsx`: Redesigned 5-tab startup legal policy suite
- `landing/src/components/Navbar.tsx`: Navbar with dynamic user pill, Dashboard link, separate Login/Signup, and Windows download trigger
- `landing/src/components/CtaSection.tsx`: Windows-only installer button with OS badge and specs
- `landing/src/components/ModalProvider.tsx`: Scoped Windows-only binary download dispatcher
- `frontend/src/components/landing/Navbar.tsx`: Fixed `{BRAND.name}`, offline status chip, auth session state, Dashboard link
- `frontend/src/components/landing/CtaSection.tsx`: Windows-only download button with auth redirection
- `frontend/src/app/auth/login/page.tsx`: Google Sign-in demo button and `?redirect=download` handling
- `frontend/src/app/auth/register/page.tsx`: Google Sign-in demo button
- `frontend/src/app/cloud-portal/page.tsx`: Web Admin Dashboard with complete operational reports derived from schemas
- `frontend/src/app/(dashboard)/pos/page.tsx`: Strict web POS billing block screen
- `main/services/amazon-s3.ts`: S3 data management service with multi-tenant prefix hierarchy and mock fallback
