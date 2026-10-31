# Empirical Adversarial Challenge Report: Build, Export, Asset Integrity & Bundle Health

- **Auditor**: Challenger 1 (`teamwork_challenger_r2_1`)
- **Date**: 2026-10-30T20:46:00Z
- **Target**: `landing/` and `frontend/` (Desktop POS & Cloud Portal)
- **Overall Verdict**: **APPROVE** (Zero critical defects, clean builds, zero broken assets, zero leaking secrets)

---

## 1. Executive Summary

Empirical adversarial testing was conducted on the production build pipelines, static exports, asset resolution graphs, CSS/font deliverables, dependency trees, and bundle security for both the public marketing website (`landing/`) and the desktop POS / cloud portal (`frontend/`).

All verification checks were executed directly in the runtime environment. No claims or previous logs were trusted without direct reproduction.

| Verification Dimension | Scope | Expected | Actual Result | Status |
|---|---|---|---|---|
| Clean Build: Landing | `landing/` (`npm run build`) | Exit code 0, static export in `out/` | Exit 0, 3 static pages prerendered | **PASS** |
| Clean Lint: Landing | `landing/` (`npm run lint`) | Exit code 0, 0 ESLint errors | Exit 0, 0 errors | **PASS** |
| Clean Build: Frontend | Root (`npm run build:frontend`) | Exit code 0, all 34 routes exported | Exit 0, 34/34 routes prerendered | **PASS** |
| Clean Lint: Backend & Frontend | Root (`npm run lint`) | Exit code 0, 0 ESLint errors | Exit 0, 0 errors (131 warnings in frontend, 0 errors) | **PASS** |
| Prerendered Route Integrity | `frontend/out/` (34 routes) | Positive byte size index.html per route | 34/34 routes present and non-empty | **PASS** |
| Asset Path Resolution | HTML exports (both sites) | 0 broken `src` or `href` attributes | 1,127 assets checked, 0 broken links | **PASS** |
| Font Asset Integrity | `_next/static/media` | Self-hosted Geist woff2 files present | 11 woff2 files in landing, 18 in frontend | **PASS** |
| Lucide Icon Export Parity | Source code imports | 100% resolution against `lucide-react` | 336/336 icons resolved without error | **PASS** |
| Module Resolution & Imports | Source code imports | 0 broken relative/aliased paths | 0 broken imports across all directories | **PASS** |
| Circular Dependency Analysis | Graph cycle detection | No runtime breaking cycles | 0 cycles in landing, 0 runtime cycles in frontend | **PASS** |
| Dev Dependency Leakage | Static JS chunks | No build/test tooling bundled | 0 dev dependencies found in chunks | **PASS** |
| Secret & Credential Scan | All bundle chunks & HTML | 0 API keys, private keys, or passwords | 116 files scanned, 0 secrets detected | **PASS** |
| Existing Regression Suites | `test:static-routes`, theme suites | All existing tests pass | 8/8 static routes pass, 28/28 theme tests pass | **PASS** |

---

## 2. Test Execution Details & Evidence Chain

### Test 1: Clean Build Verification & Static Exports

#### 1.1 Landing Site (`landing/`)
- Command: `npm run build` inside `landing/`
- Output directory: `landing/out`
- Generated pages:
  - `/` -> `landing/out/index.html` (126,191 bytes / 123.23 KB)
  - `/_not-found` -> `landing/out/_not-found/index.html` (10,355 bytes / 10.11 KB)
  - `/404` -> `landing/out/404.html` (10,355 bytes / 10.11 KB)
- Prerendering status: `○ (Static) prerendered as static content`
- Compilation time: 2.7s compilation + 5.3s TypeScript check + 3.4s static generation. Total: ~11.4s.
- Clean lint: `npm run lint` exited with code 0 (0 errors).

#### 1.2 Frontend Application (`frontend/`)
- Command: `npm run build:frontend` in project root (`cd frontend && npx cross-env NEXT_BUILD_MODE=desktop npm run build`)
- Output directory: `frontend/out`
- Verified routes (all 34 static routes generated with non-zero size):
  1. `/` (`frontend/out/index.html` - 33,953 bytes)
  2. `/404` (`frontend/out/404/index.html` - 13,024 bytes)
  3. `/_not-found` (`frontend/out/_not-found/index.html` - 13,024 bytes)
  4. `/addon-groups` (`frontend/out/addon-groups/index.html` - 18,018 bytes)
  5. `/ai-insights` (`frontend/out/ai-insights/index.html` - 18,039 bytes)
  6. `/auth/login` (`frontend/out/auth/login/index.html` - 14,128 bytes)
  7. `/auth/recover` (`frontend/out/auth/recover/index.html` - 15,598 bytes)
  8. `/auth/register` (`frontend/out/auth/register/index.html` - 22,492 bytes)
  9. `/cloud-portal` (`frontend/out/cloud-portal/index.html` - 28,133 bytes)
  10. `/customer-display` (`frontend/out/customer-display/index.html` - 13,683 bytes)
  11. `/customers` (`frontend/out/customers/index.html` - 18,213 bytes)
  12. `/dashboard` (`frontend/out/dashboard/index.html` - 18,188 bytes)
  13. `/expenses` (`frontend/out/expenses/index.html` - 18,080 bytes)
  14. `/inventory` (`frontend/out/inventory/index.html` - 18,084 bytes)
  15. `/kds` (`frontend/out/kds/index.html` - 34,218 bytes)
  16. `/kds-standalone` (`frontend/out/kds-standalone/index.html` - 14,381 bytes)
  17. `/menu` (`frontend/out/menu/index.html` - 13,533 bytes)
  18. `/online-orders` (`frontend/out/online-orders/index.html` - 18,204 bytes)
  19. `/order-history-demo` (`frontend/out/order-history-demo/index.html` - 17,678 bytes)
  20. `/orders` (`frontend/out/orders/index.html` - 18,540 bytes)
  21. `/pos` (`frontend/out/pos/index.html` - 18,736 bytes)
  22. `/print-test` (`frontend/out/print-test/index.html` - 18,374 bytes)
  23. `/products` (`frontend/out/products/index.html` - 18,132 bytes)
  24. `/qr` (`frontend/out/qr/index.html` - 13,487 bytes)
  25. `/reports` (`frontend/out/reports/index.html` - 18,074 bytes)
  26. `/reservations` (`frontend/out/reservations/index.html` - 18,095 bytes)
  27. `/server-standalone` (`frontend/out/server-standalone/index.html` - 14,989 bytes)
  28. `/settings` (`frontend/out/settings/index.html` - 18,652 bytes)
  29. `/setup` (`frontend/out/setup/index.html` - 84,659 bytes)
  30. `/staff` (`frontend/out/staff/index.html` - 18,039 bytes)
  31. `/support` (`frontend/out/support/index.html` - 18,075 bytes)
  32. `/tables` (`frontend/out/tables/index.html` - 18,202 bytes)
  33. `/whatsapp` (`frontend/out/whatsapp/index.html` - 18,236 bytes)
  34. `404.html` (`frontend/out/404.html` - 13,024 bytes)

---

### Test 2: Asset Integrity, Fonts, Icons & CSS Tokens

#### 2.1 Asset Integrity Crawler
- An automated crawler parsed every `src` and `href` across all generated `.html` pages in both exports.
- **Results**:
  - Total local asset references evaluated: **1,127**
  - Broken or missing target assets: **0**
  - Relative links, script chunks, CSS chunks, favicon images, Apple touch icons, and web manifests all resolve to valid on-disk files.

#### 2.2 CSS Deliverables & Design Tokens
- **Landing Site**:
  - CSS chunk: `landing/out/_next/static/chunks/2bu2ykw_k9gtx.css` (46.1 KB).
  - Verified compiled rules: contains `#f07928` / `rgb(240, 121, 40)` brand orange, `#ea580c` hover vermilion, and `#f8fafc` light neutral canvas.
- **Frontend Application**:
  - CSS chunks: 3 files in `frontend/out/_next/static/css/` (total ~212 KB).
  - Verified compiled rules: contains canonical `--brand` tokens, light neutral background canvas (`#f8fafc`), card borders (`#e2e8f0`), and soft status badges.

#### 2.3 Font Integrity
- Google Fonts (`Geist` and `Geist Mono`) are configured via `next/font/google` and statically exported:
  - `landing/out/_next/static/media/`: 11 `.woff2` font files.
  - `frontend/out/_next/static/media/`: 18 `.woff2` font files.
  - Zero external HTTP network dependencies for typography at runtime (fully self-contained for offline POS operation).

#### 2.4 Lucide-React Icon Parity
- Adversarial test harness extracted all named icon imports from `lucide-react`:
  - `landing/src/`: 62 icon imports checked against `landing/node_modules/lucide-react` -> **0 missing**.
  - `frontend/src/app/(dashboard)/`: 251 icon imports checked against `frontend/node_modules/lucide-react` -> **0 missing**.
  - `frontend/src/app/cloud-portal/`: 23 icon imports checked against `frontend/node_modules/lucide-react` -> **0 missing**.
  - **Total**: 336 icon imports verified; all resolve cleanly to valid SVG component exports.

---

### Test 3: Module Resolution & Circular Dependency Analysis

#### 3.1 Relative Import Resolution
- All relative import paths (`./`, `../`) across all TS/TSX source files in `landing/src`, `frontend/src/app/(dashboard)`, and `frontend/src/app/cloud-portal` were validated against physical filesystem entries.
- **Result**: 0 broken imports.

#### 3.2 Circular Dependency Graph Analysis
- Directed graph DFS traversal over source dependency trees:
  - `landing/src`: **0 circular dependencies**.
  - `frontend/src`: 0 runtime-breaking circular dependencies (3 type-only cycles identified in `lib/types.ts` <-> `lib/i18n.ts`, standard for TypeScript definitions, causing zero issues with Webpack or Next.js compilation).

---

### Test 4: Bundle Health, Chunk Distribution & Development Dependency Scan

#### 4.1 Bundle Sizing
- **Landing**:
  - Total chunks: 8 files.
  - Total raw size: 0.65 MB.
  - Top chunk: `1mh6a-0e61pyc.js` (223.8 KB - Next.js/React framework runtime).
  - CSS bundle: 46.1 KB.
  - No anomalous or bloated chunks detected.
- **Frontend**:
  - Total chunks: 60 files across 34 routes.
  - Total raw size: 3.01 MB.
  - Top chunk: `3794-331ba2827e07a35b.js` (236.2 KB).
  - Framework chunk: `framework-666c53740fc261c8.js` (185.2 KB).
  - No chunk exceeds 250 KB; zero chunks exceed the 2.5 MB stress threshold.

#### 4.2 Dev Dependency Intrusion Scan
- Tested client production chunks for build/dev-only libraries:
  - `eslint`, `typescript`, `playwright`, `@playwright/test`, `ts-node`, `electron-builder`
- **Result**: 0 instances found in either `landing/out` or `frontend/out`.

---

### Test 5: Secret Exposure & Sensitive Data Scan

- Pattern scanning across all 10 files in `landing/out` and all 106 files in `frontend/out` for:
  - Private keys (`BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE KEY`)
  - API secrets, AWS tokens, GitHub personal access tokens (`ghp_`)
  - OpenAI API keys (`sk-`), Google API keys (`AIza`)
  - Embedded passwords and hardcoded secrets
- **Result**: **0 secret matches detected across all client bundles**.

---

### Test 6: Existing Test Suite Regressions

1. `npm run test:static-routes`:
   - `resolveContainedPath`: 8/8 tests passed.
   - `static-route-resolution.test.ts`: Electron resolution test passed.
2. `npm run test:theme-mode-settings`:
   - 7/7 settings and IPC theme mode invariant tests passed.
3. `npm run test:theme-fouc-script`:
   - 21/21 FOUC and theme hydration tests passed.

---

## 3. Findings & Observations

1. **Clean Builds**: Both `landing/` and `frontend/` compile cleanly in production mode with zero errors under Node 22.
2. **Offline-First Resilience**: All fonts (Geist), icons (Lucide), and CSS are completely bundled and self-hosted. There are no runtime CDN calls or external CSS/font requests that would violate offline-first POS invariants.
3. **Consistent Theme Artifacts**: Compiled CSS bundles confirm that brand saffron orange (`#f07928`) and light canvas (`#f8fafc`) are present and active in the generated stylesheets.
4. **No Regressions**: Existing core suites (`test:static-routes`, `test:theme-mode-settings`, `test:theme-fouc-script`, `npm run lint`) pass without failure.

---

## 4. Final Verdict

**Verdict: APPROVE**

The build outputs, static exports, asset graphs, CSS tokens, fonts, icons, bundle distributions, and security postures across both `landing/` and `frontend/` have been empirically challenged, stress-tested, and verified to meet all production criteria.
