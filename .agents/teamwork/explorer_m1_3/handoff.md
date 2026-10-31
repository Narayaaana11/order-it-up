# Milestone M1 Hard Handoff Report: Client-Side Backend Detector

**Agent**: Explorer 3 (`explorer_m1_3`)  
**Milestone**: M1 — Hybrid Reactive Data Architecture & Operational Models  
**Working Directory**: `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\`  
**Target Proposal**: `landing/src/lib/backend-detector.ts`  
**Artifacts Produced**:
- Analysis Report: `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\analysis.md`
- Proposed Implementation: `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\proposed_backend-detector.ts`
- Briefing & Heartbeat: `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\BRIEFING.md`, `progress.md`

---

## 1. Observation

1. **Local Health Endpoints in Backend**:
   - `main/server.ts:36, 201-210`:
     ```typescript
     // Health check — unauthenticated
     if (req.path === '/api/health') { next(); return; }
     ...
     app.get('/api/health', (_req: Request, res: Response) => {
       const db = getDbHealth();
       res.status(db.ok ? 200 : 503).json({
         status: db.ok ? 'ok' : 'error',
         db: db.ok ? 'ok' : db.error,
         service: 'Order It Up Local API',
         version: process.env.npm_package_version || '2.4.7',
         timestamp: new Date().toISOString(),
       });
     });
     ```
   - `main/kds-server.ts:148-155`:
     ```typescript
     app.get('/api/health', (_req: Request, res: Response) => {
       res.json({
         status: 'ok',
         service: 'Order It Up KDS Server',
         version: '1.0.0',
         timestamp: new Date().toISOString(),
       });
     });
     ```
   - `main/server-app.ts:171-178`:
     ```typescript
     app.get('/api/health', (_req: Request, res: Response) => {
       res.json({
         status: 'ok',
         service: 'Order It Up Server App',
         version: '1.0.0',
         timestamp: new Date().toISOString(),
       });
     });
     ```
   - `main/backend-health.ts:8-23`:
     Demonstrates the canonical health check pattern for all three owned services using `127.0.0.1`:
     `http://127.0.0.1:${ports.server}/api/health`, `http://127.0.0.1:${ports.kds}/api/health`, `http://127.0.0.1:${ports.serverApp}/api/health`.

2. **CORS Restrictions**:
   - `main/middleware/security.ts:362-379`:
     ```typescript
     export const corsOptions = {
       origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
         if (!origin) return callback(null, true);
         try {
           const parsedOrigin = new URL(origin);
           const hostname = parsedOrigin.hostname;
           if (hostname === 'localhost' || hostname.endsWith('.local') || isAllowedPrivateIp(hostname)) {
             return callback(null, true);
           }
           callback(new Error('Not allowed by CORS'));
         } catch (err) {
           callback(new Error('Invalid origin format'));
         }
       }
     };
     ```
     When running in local dev (`http://localhost:3004`), `hostname === 'localhost'` matches and CORS passes. When deployed to Cloudflare Pages (`https://orderitup.pages.dev`), the origin does not match and fails CORS with `Not allowed by CORS`.

3. **Cloudflare Pages Static Export Baseline**:
   - `landing/package.json`: Contains `"next": "16.3.4"`, `"react": "19.2.8"`, `"tailwindcss": "^4"`.
   - `landing/next.config.ts`: Configured with `output: 'export'` and `trailingSlash: true`.
   - Executing `npm --prefix landing run lint` passed with 0 errors.
   - Executing `npm --prefix landing run build` compiled 4 static routes (`/`, `/_not-found`, `/dashboard`) to `landing/out/` in 8 seconds with 0 errors.

---

## 2. Logic Chain

1. **From Observation 1 (Health Endpoints)**:
   Order It Up exposes unauthenticated `/api/health` endpoints across ports 3001, 3002, and 3003 returning `{ status: 'ok' }`. By pinging `http://127.0.0.1:3001/api/health`, `http://127.0.0.1:3002/api/health`, and `http://127.0.0.1:3003/api/health`, a client can definitively verify whether each service is alive and healthy.
2. **From Observation 2 (CORS & HTTPS Mixed Content)**:
   When running on Cloudflare Pages over HTTPS, two browser security rules activate:
   - W3C Mixed Content rules block HTTP fetches from HTTPS origins before network dispatch, causing `fetch()` to reject with `TypeError: Failed to fetch`.
   - The backend's `corsOptions` rejects cross-origin requests from non-localhost/non-private origins.
   Therefore, every probe must wrap `fetch()` in an isolated `try...catch` block. Catching this rejection ensures zero unhandled promise rejections, zero React error boundary crashes, and zero layout breaks, allowing the client to safely return `connected: false` and set `mode: 'standalone'`.
3. **From Observation 3 (Next.js Static Export)**:
   Because `landing/` is statically exported without a Node.js SSR runtime, the probe must execute strictly client-side (`"use client"`). All window/document references must be guarded (`typeof window !== 'undefined'`) and deferred to `useEffect`, initializing with a deterministic `INITIAL_HEALTH_STATUS` (`mode: 'standalone'`, `apiConnected: false`, `kdsConnected: false`, `waiterConnected: false`) so SSR hydration succeeds identically.
4. **From Timeout & Concurrency Requirements**:
   Network hangs are prevented by pairing `AbortController` with `setTimeout(() => controller.abort(), 1500)` and clearing timers in `finally` blocks. Overlapping probes and post-unmount state updates are guarded via `activeControllerRef` and `isMountedRef`.
5. **From Visibility Requirements**:
   Listening to `document.visibilitychange` allows the 30-second interval timer to pause when the tab is hidden, eliminating battery/CPU waste, while triggering an immediate check upon returning to the tab.

---

## 3. Caveats

1. **Mixed Content Console Warning**: While catching `TypeError: Failed to fetch` prevents any JavaScript exception from crashing the app, Chromium-based browsers may still log an internal network warning to the browser DevTools console when an HTTPS page requests an HTTP resource. This is an immutable browser engine security logging behavior and cannot be suppressed by JavaScript, but it has zero runtime impact on page execution.
2. **Local Machine Ports**: The default endpoints assume standard Order It Up desktop ports (3001, 3002, 3003). The probe hook supports an `endpoints` option to override ports or URLs if a developer runs services on alternate ports.

---

## 4. Conclusion

The client-side backend probe hook and pure utility function designed in `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\proposed_backend-detector.ts` fully satisfy all requirements:
1. Probes `:3001`, `:3002`, and `:3003` `/api/health` in parallel.
2. Uses `AbortController` with a strict 1500ms timeout per check.
3. Catches Mixed Content and CORS errors cleanly with zero unhandled rejections.
4. Returns the exact required `BackendHealthStatus` interface (`mode`, `checkedAt`, `apiConnected`, `kdsConnected`, `waiterConnected`, `latencyMs`).
5. Provides a manual `recheck()` trigger and visibility-aware 30-second background polling.
6. Is 100% compliant with Next.js 16.3 static export and React 19.

The file is ready for direct drop-in by the implementer into `landing/src/lib/backend-detector.ts`.

---

## 5. Verification Method

To independently verify this design:

1. **Source Inspection**:
   - Inspect proposed implementation: `view_file` on `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\proposed_backend-detector.ts`.
   - Verify interface compliance with `ORIGINAL_REQUEST.md` and `PROJECT.md`.
2. **Build & Lint Verification**:
   - Verify `landing/` lint baseline:
     ```sh
     npm --prefix landing run lint
     ```
   - Verify static export build:
     ```sh
     npm --prefix landing run build
     ```
3. **Invalidation Conditions**:
   - If `main/server.ts` or `kds-server.ts` changes the `/api/health` route path or requires authentication.
   - If modern browsers allow mixed content active fetches from HTTPS without TLS.
