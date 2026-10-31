## 2026-10-31T13:27:07Z
You are Explorer 3 for Milestone M1: "Hybrid Reactive Data Architecture & Operational Models".
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\

Read:
- Original Request: d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Scope: d:\narayana\order-it-up\.agents\teamwork\orchestrator_1\PROJECT.md
- Prior Explorer Survey: d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_1\analysis.md and d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_3\analysis.md

Task:
1. Design the client-side backend probe hook in `landing/src/lib/backend-detector.ts`.
2. Must test local endpoints:
   - Express POS API: `http://127.0.0.1:3001/api/health`
   - Standalone KDS: `http://127.0.0.1:3002/api/health`
   - Waiter Server App: `http://127.0.0.1:3003/api/health`
3. Safety and browser resilience:
   - Must use `AbortController` with a 1500ms timeout per check.
   - Must catch Mixed Content / CORS errors cleanly without unhandled rejections or browser console crashes when running over HTTPS on Cloudflare Pages.
   - Return clean state:
     ```typescript
     interface BackendHealthStatus {
       mode: 'live' | 'standalone';
       checkedAt: string;
       apiConnected: boolean;
       kdsConnected: boolean;
       waiterConnected: boolean;
       latencyMs?: number;
     }
     ```
   - Provide manual `recheck()` trigger and periodic background check interval (e.g. every 30 seconds, disabled or paused when page is hidden).
4. Write your analysis report to `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\analysis.md`.
5. Write handoff report to `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_3\handoff.md`.
6. Message orchestrator when complete.
