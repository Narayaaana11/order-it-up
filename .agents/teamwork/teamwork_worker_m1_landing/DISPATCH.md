## 2026-10-30T20:15:21Z
You are Worker M1 (teamwork_worker).
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m1_landing\

You MUST read the original user request and project scope before starting work:
- Original request path: d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
- Scope document: d:\narayana\order-it-up\.agents\teamwork\orchestrator\PROJECT.md
- Explorer 2 survey report: d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_2\survey_landing_theme.md
- Explorer 1 POS tokens: d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_1\survey_pos_theme.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You have exclusive write ownership of files in `landing/`:
- `landing/src/app/globals.css`
- `landing/src/app/layout.tsx`
- `landing/src/app/page.tsx`
- `landing/src/components/Navbar.tsx`
- `landing/src/components/Hero.tsx`
- `landing/src/components/TrustMetrics.tsx`
- `landing/src/components/OfflineArchitecture.tsx`
- `landing/src/components/Features.tsx`
- `landing/src/components/InteractiveKds.tsx`
- `landing/src/components/PosDemo.tsx`
- `landing/src/components/ReceiptPreview.tsx`
- `landing/src/components/Pricing.tsx`
- `landing/src/components/Footer.tsx`
You MUST NOT edit or write to any files in `frontend/` or anywhere else outside `landing/`.

Tasks:
1. Refactor `landing/` to the crisp desktop POS light theme visual identity:
   - In `globals.css`: Update `@theme` with `--color-surface-canvas: #F8FAFC`, `--color-surface-card: #FFFFFF`, `--color-surface-border: #E2E8F0`, `--color-surface-muted: #F1F5F9`, `--color-brand: #F07928`, `--color-brand-hover: #EA580C`, `--color-brand-light: #FFF2EA`, `--color-brand-dark: #C2410C`. Set body `background-color: #F8FAFC; color: #0F172A;`. Update scrollbar to light track `#F1F5F9` and thumb `#CBD5E1`. Update `.receipt-paper` box-shadow.
   - In `layout.tsx`: Remove `className="dark"` from `<html>`. Update `themeColor` to `#F8FAFC`. Update body class to `bg-[#F8FAFC] text-slate-900`.
   - In `page.tsx`: Update canvas container to `bg-[#F8FAFC] text-slate-900`.
   - In `Navbar.tsx`: Light glassmorphic header `bg-white/90 border-slate-200/80`, slate-900 logo/text, solid brand CTA `bg-[#F07928] hover:bg-[#EA580C] text-white shadow-md shadow-orange-500/20`, soft emerald status badge `bg-emerald-50 border-emerald-200 text-emerald-700`.
   - In `Hero.tsx`: Light hero canvas, warm peach badges, crisp slate headings/subtitles, solid brand primary action button.
   - In `TrustMetrics.tsx`: Pure white cards `bg-white border border-slate-200 shadow-xs`, crisp slate text.
   - In `OfflineArchitecture.tsx`: Clean light architecture container, white cards, warm peach and soft emerald indicator badges.
   - In `Features.tsx`: White feature cards `bg-white border-slate-200 shadow-xs`, warm vermilion icon containers, crisp slate typography.
   - In `PosDemo.tsx` and `InteractiveKds.tsx`: Light theme POS and KDS simulators with authentic light ticket and cart surfaces.
   - In `ReceiptPreview.tsx`: Realistic 80mm ESC/POS paper slip with subtle shadow on light neutral canvas.
   - In `Pricing.tsx` and `Footer.tsx`: Light pricing cards, solid brand buttons, crisp slate footer with clean borders.
2. Verify:
   - Run `npm run lint` in `landing/`
   - Run `npm run build` in `landing/`
   Ensure both pass with exit code 0.
3. Write your handoff report to `d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m1_landing\handoff.md` and message the parent when done.

## 2026-10-30T20:26:00Z
**Context**: Landing Light Theme Refactor (`landing/`)
**Content**: Checking in on implementation progress for Milestone 1.
**Action**: Please report your current progress, files edited, and verification status.

