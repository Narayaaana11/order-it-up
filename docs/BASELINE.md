# Phase 0 Baseline Audit Report

Generated: 2026-11-23

## Environment
- **Node.js:** `v22.13.1` (Requirement: >= 22.12.0) — **PASS**
- **Operating System:** Windows 11 / PowerShell

## Code Quality & Types
- **Backend TypeScript Compilation:** `npx tsc --noEmit -p tsconfig.json` — **PASS (0 errors)**
- **Frontend TypeScript Compilation:** `cd frontend && npx tsc --noEmit` — **PASS (0 errors)**
- **Backend & Shared ESLint:** `npx eslint main/ shared/` — **PASS (0 errors, 1,178 warnings)**
- **Frontend ESLint:** `npm --prefix frontend run lint` — **PASS (0 errors, 150 warnings)**
- **Dependency Vulnerabilities:** `npm audit --omit=dev` — **PASS (0 vulnerabilities found)**

## Existing Test Suites
- **Pretest Suite (`test:payment-methods-split` & `test:release-regressions`):**
  - `tests/payment-methods-split-checks.test.ts`: **188 / 188 passed**
  - `tests/browser-receipts.test.ts`: **56 / 56 passed**
  - `tests/i18n-audit-remediations.test.ts`: **26 / 26 passed**
  - `tests/i18n-ssr-timezone.test.ts`: **8 / 8 passed**
  - `tests/issue-241-localized-errors.test.ts`: **PASS**
  - `tests/printer-fallback-and-popup-verification.test.ts`: **33 / 33 passed**
  - `tests/kot-locale-cold-start.test.ts`: **8 / 8 passed**
  - `tests/phase6-locale-loading.test.ts`: **PASS**
  - `tests/auth-print-bootstrap-race.test.ts`: **PASS**

## Defect D12 Diagnosis (`test:raster`)
- Root cause:
  1. `package.json` had `"electron --no-sandbox"`, which causes Windows Electron to reject `--no-sandbox` as a bad option.
  2. Ambient `ELECTRON_RUN_AS_NODE: 1` in environment causes Electron to boot as Node.js, leaving Electron's `app` and `BrowserWindow` undefined.
  3. Linux CI requires `xvfb-run -a` for headless display.
- Verification: Executed without `ELECTRON_RUN_AS_NODE`, the raster test rendered RTL Hebrew font output and warm singleton lifecycle passed completely. A unified runner script `tests/run-raster-test.cjs` will be added to wrap Electron cleanly cross-platform.
