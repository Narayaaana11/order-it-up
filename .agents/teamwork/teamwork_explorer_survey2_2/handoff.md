# Handoff Report: Public Website Light Theme Visual Alignment Survey

**Agent**: Explorer 2 (`teamwork_explorer_survey2_2`)  
**Parent Agent**: `eee03b4e-76cf-44b7-bbf2-e012731666be`  
**Date**: 2026-10-30T20:15:00Z  
**Survey Report Location**: `d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_2\survey_landing_theme.md`  

---

## 1. Observation

1. **Project Tooling & Architecture**:
   - `landing/package.json` specifies `"tailwindcss": "^4"`, `"@tailwindcss/postcss": "^4"`, `"next": "16.3.4"`, and `"react": "19.2.8"`.
   - Running `Set-Location landing; npm run build` completed successfully with code 0:
     ```text
     ▲ Next.js 16.3.4 (Turbopack)
     ✓ Compiled successfully in 2.7s
     ✓ Generating static pages using 4 workers (3/3) in 7.3s
     Route (app)
     ┌ ○ /
     └ ○ /_not-found
     ```
   - Running `Set-Location landing; npm run lint` completed successfully with code 0 (`eslint .` clean).

2. **Tailwind Tokens & Global Styling**:
   - In `landing/src/app/globals.css`:
     - Line 3–14: `@theme` configures `--color-surface-dark: #09090B;`, `--color-surface-elevated: #18181B;`, `--color-surface-card: #121215;`, `--color-surface-border: #27272A;`.
     - Line 23: `color-scheme: dark;` inside `html`.
     - Line 28–29: `background-color: #09090B; color: #FAFAFA;` inside `body`.
     - Line 40, 43: Dark scrollbar track (`#09090B`) and thumb (`#27272A`).
   - In `landing/src/app/layout.tsx`:
     - Line 16: `themeColor: "#09090b"` in `viewport`.
     - Line 49: `<html lang="en" className="dark">`.
     - Line 51: `<body className="... bg-[#09090b] text-zinc-100 min-h-screen selection:bg-orange-500 selection:text-white">`.
   - In `landing/src/app/page.tsx`:
     - Line 14: `<div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-orange-500 selection:text-white">`.

3. **Component Dark Class Densities**:
   - Grep search across `landing/src/` revealed 149 instances of `zinc` classes (e.g., `bg-zinc-900`, `bg-zinc-950`, `text-zinc-400`, `border-zinc-800`), 20+ instances of deep dark status backgrounds (`bg-emerald-950`, `bg-amber-950`, `bg-blue-950`, `bg-purple-950`), and over 30 instances of `text-white` on primary headings and containers.
   - All 9 components in `landing/src/components/` (`Navbar.tsx`, `Hero.tsx`, `TrustMetrics.tsx`, `FeaturesGrid.tsx`, `OfflineArchitecture.tsx`, `UiPreviews.tsx`, `RolePersonas.tsx`, `CtaSection.tsx`, `Footer.tsx`) currently render hardcoded dark styles.

4. **Desktop POS Baseline Alignment**:
   - `frontend/src/app/globals.css` defines the light theme baseline:
     - Root background: `oklch(1 0 0)` / `#FFFFFF` / `#F8FAFC`.
     - Root foreground: `oklch(0.145 0 0)` / `#0F172A`.
     - Card background: `#FFFFFF` with border `oklch(0.922 0 0)` / `#E2E8F0`.
     - Brand primary: `--color-brand: #F07928;` with light accent `--color-brand-light: #FFF3E8;` and hover `--color-brand-hover: #D96A1A;`.
     - Scrollbar: thumb `#cbd5e1` hovering to `#94a3b8`.

---

## 2. Logic Chain

1. From Observation 1, the landing site compiles cleanly with Next.js Turbopack and Tailwind CSS v4 without any custom Babel or Webpack plugins. The static export succeeds out of the box.
2. From Observation 2, dark mode is triggered at the root by three factors: the `className="dark"` on `<html>`, `color-scheme: dark` in `globals.css`, and the hardcoded body background `#09090B`. Removing `className="dark"` and setting `background-color: #F8FAFC; color: #0F172A;` will immediately switch the page foundation to the light theme.
3. From Observation 3, all components contain hardcoded dark utility classes (`bg-zinc-900`, `bg-zinc-950`, `border-zinc-800`, `text-zinc-400`, `text-white`). Replacing these with light equivalents (`bg-white`, `bg-slate-50`, `border-slate-200`, `text-slate-600`, `text-slate-900`) will convert all card surfaces, wells, and typography without breaking any component layout or logic.
4. From Observation 3 and 4, interactive badges and status pills use dark saturated backgrounds (`bg-emerald-950`, `bg-amber-950`, etc.). Converting them to soft pastel backgrounds with rich dark text (`bg-emerald-50 text-emerald-700 border-emerald-200`) adheres to requirement R1 and R3.
5. All interactive features (Cart simulator quantity adjustment, KDS ticket stage bumping, simulated WAN toggling, and thermal receipt printing) operate purely in local React state and will remain 100% intact after styling classes are replaced.

---

## 3. Caveats

- **No Caveats on Implementation Feasibility**: The scope is entirely contained within 11 files (`globals.css`, `layout.tsx`, `page.tsx`, and 8 component files in `components/`).
- **Tailwind v4 `@theme`**: Because Tailwind CSS v4 is used rather than Tailwind v3 `tailwind.config.js`, any custom color tokens must be registered in `landing/src/app/globals.css` under `@theme`.
- **Receipt Paper (`UiPreviews.tsx`)**: The receipt slip already has a white background (`receipt-paper` in `globals.css`); only its box-shadow and border need softening on a light background.

---

## 4. Conclusion

The website in `landing/` is thoroughly surveyed and completely mapped. The path to achieving full visual alignment with the desktop POS light theme is clear, bounded, and low-risk:
- **Scope**: 11 target files in `landing/src/`.
- **Palette**: `#F8FAFC` (Canvas), `#FFFFFF` (Card surfaces), `#E2E8F0` (Borders), `#0F172A` (Primary text), `#64748B` (Secondary text), and `#F07928` / `#EA580C` (Brand vermilion orange).
- **Survey Artifact**: All exact line numbers, current dark classes, and precise replacement mappings are documented in:
  `d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_2\survey_landing_theme.md`.

---

## 5. Verification Method

To verify the survey and subsequent implementation:
1. **Compilation Check**:
   ```powershell
   Set-Location landing; npm run build
   ```
   *Expected result*: Exit code 0, 3 static pages generated into `landing/out/`.
2. **Lint Validation**:
   ```powershell
   Set-Location landing; npm run lint
   ```
   *Expected result*: Exit code 0, zero lint errors across all files.
3. **Visual & Class Spot Checks**:
   - Inspect `landing/src/app/layout.tsx` to verify absence of `className="dark"`.
   - Inspect `landing/src/app/globals.css` to verify light `@theme` tokens and light scrollbar.
   - Inspect `landing/src/components/Navbar.tsx` and `landing/src/components/Hero.tsx` to verify replacement of `bg-[#09090b]` and `text-white` with `bg-white`/`bg-slate-50` and `text-slate-900`.
