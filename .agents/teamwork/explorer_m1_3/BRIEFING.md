# BRIEFING — 2026-10-31T13:34:00Z

## Mission
Design the client-side backend probe hook in `landing/src/lib/backend-detector.ts` for probing local POS endpoints (3001, 3002, 3003) with safety, Mixed Content / CORS resilience, AbortController timeouts, manual recheck, and visibility-aware periodic background polling.

## 🔒 My Identity
- Archetype: explorer
- Roles: Explorer, Systems Analyst, Protocol & Web Security Specialist
- Working directory: d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\
- Original parent: 324a459d-4047-419c-8077-2f4966965e2f
- Milestone: M1: "Hybrid Reactive Data Architecture & Operational Models"

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in source repository
- Target proposal file: `landing/src/lib/backend-detector.ts`
- Must probe: Express POS API (:3001), Standalone KDS (:3002), Waiter Server App (:3003)
- Safety: AbortController with 1500ms timeout per check
- Resilience: mixed content / CORS handled cleanly without console crashes or unhandled rejections
- Periodic background check (30s) paused on hidden document
- Output analysis.md and handoff.md in working directory

## Current Parent
- Conversation ID: 324a459d-4047-419c-8077-2f4966965e2f
- Updated: 2026-10-31T13:28:00Z

## Investigation State
- **Explored paths**:
  - `main/server.ts`, `main/kds-server.ts`, `main/server-app.ts`, `main/backend-health.ts`, `main/middleware/security.ts`
  - `landing/next.config.ts`, `landing/package.json`, `landing/src/lib/`, `landing/src/app/dashboard/page.tsx`
  - Prior survey analyses: `explorer_survey_dash_1\analysis.md` and `explorer_survey_dash_3\analysis.md`
- **Key findings**:
  - All 3 local services support unauthenticated `GET /api/health` returning JSON `{ status: 'ok', service: '...', version: '...' }`.
  - CORS in `main/middleware/security.ts:370` allows `localhost` and private IPs, but blocks Cloudflare Pages origin (`https://orderitup.pages.dev`).
  - Active Mixed Content prevents HTTP calls from HTTPS origins. Total isolation in per-endpoint `try...catch` is necessary to prevent unhandled promise rejections and console crashes.
  - Strict 1500ms timeout using `AbortController` and `setTimeout` prevents latency lag if local services are stopped.
  - Periodic 30s background polling with `document.visibilitychange` pausing satisfies battery and resource efficiency.
- **Unexplored areas**: None. Design is complete and verified against static build and linting.

## Key Decisions Made
- Provided both a pure async function (`checkBackendHealth`) and a React hook (`useBackendDetector`) for maximum flexibility across UI components and non-React state stores.
- Used `127.0.0.1` rather than `localhost` to avoid IPv6 loopback binding mismatches on Windows.
- Implemented chained `AbortController` cancellation for in-flight requests on recheck or hook unmount.
- Delivered ready-to-use proposed code file: `proposed_backend-detector.ts`.

## Artifact Index
- DISPATCH.md — Parent dispatch instruction
- BRIEFING.md — Persistent context & state
- progress.md — Liveness heartbeat
- analysis.md — Detailed architectural & implementation analysis
- handoff.md — 5-component hard handoff report
- proposed_backend-detector.ts — Production-ready source code for `landing/src/lib/backend-detector.ts`
