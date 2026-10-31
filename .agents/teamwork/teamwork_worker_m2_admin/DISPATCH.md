## 2026-10-30T20:15:32Z

You are Worker M2 (teamwork_worker).
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m2_admin\

You MUST read the original user request and project scope before starting work:
- Original request path: d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
- Scope document: d:\narayana\order-it-up\.agents\teamwork\orchestrator\PROJECT.md
- Explorer 3 survey report: d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_3\survey_admin_portal.md
- Explorer 1 POS tokens: d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_1\survey_pos_theme.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You have exclusive write ownership of:
- `frontend/src/app/cloud-portal/layout.tsx`
- `frontend/src/app/cloud-portal/page.tsx`
- `frontend/src/app/(dashboard)/dashboard/page.tsx`
- `frontend/src/app/(dashboard)/orders/page.tsx`
- `frontend/src/app/(dashboard)/inventory/page.tsx`
- `frontend/src/app/(dashboard)/expenses/page.tsx`
- `frontend/src/app/(dashboard)/reports/page.tsx`
- `frontend/src/app/(dashboard)/tables/page.tsx`
You MUST NOT edit or write to any files in `landing/` or anywhere else outside your assigned scope.

Tasks:
1. Implement the light theme visual alignment across the web admin portal (`frontend/src/app/(dashboard)` and `frontend/src/app/cloud-portal`):
   - In `frontend/src/app/cloud-portal/layout.tsx`: Replace `#0B0F19` canvas and dark selection with `bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#F07928] selection:text-white`.
   - In `frontend/src/app/cloud-portal/page.tsx`:
     - Header: Light background `bg-white/90 border-b border-slate-200 backdrop-blur-md`, brand icon with vermilion accent (`bg-[#F07928] text-white`), role switcher in clean white `bg-white border-slate-200 text-slate-700`.
     - Primary buttons: Solid brand vermilion `bg-[#F07928] hover:bg-[#EA580C] text-white shadow-sm`.
     - Tabs: Active tab with solid brand / warm peach underline `border-[#F07928] text-[#F07928] bg-[#FFF2EA] font-semibold`.
     - Stat cards: Pure white card surfaces `bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900`, muted subtitles `text-slate-500`.
     - Tables: White container `bg-white border border-slate-200 rounded-xl shadow-xs`, thead `bg-slate-50 text-slate-600 border-b border-slate-200 font-medium`, tbody `divide-slate-200 text-slate-800`.
     - Status badges: Soft green for active/connected `bg-emerald-50 text-emerald-700 border border-emerald-200`.
     - Device pairing modal: Soft neutral backdrop `bg-black/30 backdrop-blur-sm`, white modal card `bg-white border border-slate-200 rounded-2xl shadow-xl`, PIN box `bg-slate-50 border-2 border-[#F07928]/40 text-[#F07928]`.
   - In `frontend/src/app/(dashboard)/dashboard/page.tsx`:
     - Stat cards: Replace rainbow pastel cards with desktop POS white card surfaces (`bg-card border border-border shadow-xs`) with colored icon badges (`bg-blue-50 text-blue-700`, `bg-emerald-50 text-emerald-700`, `bg-brand-light text-brand`, etc.).
     - View mode pills (`day`/`month`): Replace dark black pill (`bg-foreground text-background`) with desktop POS brand vermilion pill (`bg-brand text-white shadow-xs`) or warm peach selection.
   - In `frontend/src/app/(dashboard)` subpages (`orders`, `inventory`, `expenses`, `reports`, `tables`):
     - Unify active category/filter pills and tab indicators to solid brand vermilion (`bg-brand text-white shadow-xs rounded-xl`) and warm peach tints (`bg-sidebar-accent text-sidebar-accent-foreground` / `#FFF3E8`).
     - Ensure consistent status badges (soft green `bg-emerald-50 text-emerald-700 border-emerald-200` for paid/completed).
2. Verify:
   - Run `npm run lint` in project root
   - Run `npm run build:frontend` in project root
   Ensure both pass with exit code 0.
3. Write your handoff report to `d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m2_admin\handoff.md` and message the parent when done.


## 2026-10-30T20:26:16Z
**Context**: Web Admin Portal Visual Alignment (`frontend/`)
**Content**: Checking in on implementation progress for Milestone 2.
**Action**: Please report your current progress, files edited, and verification status.
