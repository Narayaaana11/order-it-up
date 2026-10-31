# Order It Up (OIU) — Test Infrastructure & Testing Architecture

## 1. Overview & Testing Philosophy

Order It Up employs a dual-runtime architecture balancing an **offline-first Electron desktop POS** with a **cloud-hosted multi-tenant web application** deployed on Cloudflare Pages (`orderitup.pages.dev`). 

Our testing philosophy enforces four strict invariants:
1. **Architectural Separation**: Strict boundary between counter POS billing (Electron desktop client with SQLite WAL & ESC/POS bytecode) and SaaS management/CRM on the web (`users.md § 1`).
2. **Deterministic Offline Autonomy**: Core POS functionality, table ordering, KDS ticket bumping, and billing must execute without cloud dependencies.
3. **Progressive Testability**: Automated test suites are designed to independently verify milestones, validating interface contracts and mathematical derivations without artificial mock coupling.
4. **Zero-Facade Integrity**: Tests must exercise authentic business logic, actual filesystem artifacts, AST structures, and real runtime transitions rather than synthetic pass-through facades.

---

## 2. Test Architecture & Runner Ecosystem

The project runs on **Node.js 22.12.0+** using native standard libraries and dedicated test harnesses:

| Test Harness / Runner | Technology | Purpose & Scope | Execution Command |
| :--- | :--- | :--- | :--- |
| **Node.js Built-In Test Runner** | `node:test`, `node:assert/strict` | E2E feature verification, component AST audits, mathematical easing, static export routes, and role matrix | `node tests/landing-page-e2e.test.cjs` or `node --test tests/landing-page-e2e.test.cjs` |
| **TypeScript Test Harness** | `ts-node` + `tests/tsconfig.json` | Backend Express APIs, SQLite migrations, auth state recovery, tax engine, loyalty, print drivers | `npm test` or `ts-node tests/<file>.test.ts` |
| **Electron Node Child Process** | `tests/run-electron-node-test.cjs` | Electron IPC contracts, multi-window readiness, native thermal printer drivers, SQLite WAL locks | `node tests/run-electron-node-test.cjs tests/<file>.test.ts` |
| **Static Export & Build Auditor** | Node.js file system & AST scanner | Cloudflare Pages static export completeness (`output: 'export'`), bundle leak scan, hydration audit | `node tests/challenger-build-audit.test.cjs` |

---

## 3. Four-Tier Testing Methodology

To guarantee exhaustive verification across aesthetics, navigation, role routing, and static export safety, the E2E test suite (`tests/landing-page-e2e.test.cjs`) implements a 4-tier testing hierarchy:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      FOUR-TIER TESTING HIERARCHY                       │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 1: FEATURE COVERAGE                                               │
│ • React Bits ambient background, dot pattern, and spotlight variables  │
│ • Animated number counter cubic ease-out mathematics (1 - (1-p)^3)    │
│ • Shimmer badge specular light beam overlay and @keyframes shimmer     │
│ • Glassmorphic cards, specular inset reflections, and elevation hover  │
│ • Navbar auth links (/auth/login & /auth/register) and mobile drawer   │
│ • Hero and CTA sections direct registration/download action links      │
│ • Role personas data structure (Owner, Manager, Cashier, Waiter, Chef) │
│ • Role routing interface contracts (getRoleDefaultRoute, isRoleAllowed)│
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: BOUNDARY & CORNER CASES                                        │
│ • Accessibility: prefers-reduced-motion media query handling in CSS/JS │
│ • Unauthenticated vs Authenticated session route resolution            │
│ • Edge case role normalization: casing, whitespace, and unknown roles  │
│ • Manager Web Access invariant: direct to /dashboard (zero POS redirect)│
│ • Web POS billing prohibition: operational cashier blocked from web POS│
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: CROSS-FEATURE COMBINATIONS                                     │
│ • Interactive showcase tab state switching & persona synchronization   │
│ • Exhaustive 10-role truth table across Electron and Web platforms    │
│ • Multi-tenant role precedence (isOwner vs role vs tenantRole)         │
│ • Web platform authorization matrix verification (users.md § 4)        │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 4: REAL-WORLD SCENARIOS                                           │
│ • Prospective merchant tour: 100% static route existence (zero 404s)   │
│ • Registration onboarding flow to /cloud-portal?onboarded=true         │
│ • Cloudflare Pages static export configuration in next.config.ts       │
│ • Zero hydration trap audit (no unsuspended useSearchParams or window) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Test Suite Reference & Commands

### 4.1 Running the Landing Page & Role Routing E2E Test Suite
The landing page and role routing suite is located at `tests/landing-page-e2e.test.cjs`. It requires no external test runners or dev dependencies:

```bash
# Direct Node.js execution
node tests/landing-page-e2e.test.cjs

# Or using the built-in Node test runner
node --test tests/landing-page-e2e.test.cjs
```

### 4.2 Core Verification Commands

| Command | Subsystem Covered | Expected Result |
| :--- | :--- | :--- |
| `node tests/landing-page-e2e.test.cjs` | Landing page UI, aesthetics, auth navigation, role matrix | 21/21 tests pass, 0 failures, exit 0 |
| `npm --prefix frontend run lint` | Frontend Next.js / TypeScript lint rules | 0 errors, 0 warnings |
| `npm run build:frontend` | Next.js static export build (`output: 'export'`) | Clean prerender of all 34+ static routes |
| `npm test` | Full backend & integration test suite | All unit, integration, and release gates pass |

---

## 5. Authoritative Specifications & Expected Output Derivation

All expected values across our test suites are derived from authoritative specification documents:
- **`users.md`**: Defines all 10 operational personas, credentials, internal role keys, client app boundaries, and platform access matrices.
- **`PROJECT.md`**: Defines interface contracts (`role-routing.ts`, `AmbientBackgroundProps`, `AnimatedCounterProps`), component layouts, and design tokens.
- **`ORIGINAL_REQUEST.md`**: Defines feature requirements R1 (React Bits UI), R2 (Auth Navigation), R3 (Role Dashboards Showcase), and R4 (Validation).
- **`frontend/next.config.ts`**: Defines static export rules (`output: 'export'`, `trailingSlash: true`, `images: { unoptimized: true }`).
