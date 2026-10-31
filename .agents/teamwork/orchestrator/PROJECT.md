# Project: Order It Up Website & Web Admin Portal Light Theme Alignment

## Architecture
- **Desktop POS Visual Identity Authority**: Order It Up's desktop POS application in `frontend/src/` defines the canonical design system:
  - Base Canvas: Light neutral `#F8FAFC` (slate-50) / `#F9FAFB` (gray-50) / `oklch(1 0 0)`.
  - Surfaces: Pure white `#FFFFFF` (`bg-card`) with 16px/20px radius and hairline neutral borders (`#E2E8F0` / `border-border`).
  - Primary Accent: Warm Saffron Orange / Vermilion `#F07928` (`bg-brand`, `text-brand`, `border-brand`), hover `#EA580C` / `#D96A1A`.
  - Selection Tint: Warm Peach `#FFF2EA` / `#FFF3E8` (`bg-brand-light`, `--sidebar-accent`).
  - Typography: Geist Sans & Geist Mono, dark slate primary text `#0F172A` / `#18181B` (`text-foreground`), muted secondary gray `#64748B` / `#71717A` (`text-muted-foreground`).
  - Status Badges: Soft green `#DCFCE7`/`#15803D` for paid/completed, soft orange `#FFEDD5`/`#C2410C` for balance due, soft blue `#DBEAFE`/`#1D4ED8` for active kitchen/dining.
- **Subsystem 1: Public Marketing Website (`landing/`)**:
  - Independent Next.js 16 (Static Export) + React 19 + Tailwind CSS v4 application.
  - Own `package.json`, isolated from `frontend/`.
- **Subsystem 2: Web Admin Portal (`frontend/src/app/(dashboard)` & `frontend/src/app/cloud-portal`)**:
  - Electron POS & Web dashboard application using Next.js 16 + React 19 + Tailwind CSS v4 (`@tailwindcss/postcss`).
  - Shares root design tokens from `frontend/src/app/globals.css`.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:---:|
| 1 | Website Theme Tokens & Globals | Update `@theme` in `landing/src/app/globals.css` with light surface tokens (`#F8FAFC`, `#FFFFFF`, `#E2E8F0`), brand palette, light scrollbars | M1 | survey_landing | DONE |
| 2 | Website Shell & Layout | Remove `dark` class from `landing/src/app/layout.tsx`, set canvas `#F8FAFC` and slate-900 text in `layout.tsx` & `page.tsx` | M1 | survey_landing | DONE |
| 3 | Navbar Light Theme | Glassmorphic light navbar, slate logo/links, solid brand CTA button, soft emerald offline status badge | M1 | survey_landing | DONE |
| 4 | Hero Section Light Theme | Light canvas, warm peach trust badges, crisp slate headings/subtitles, solid brand primary action button | M1 | survey_landing | DONE |
| 5 | Trust Metrics Ribbon Light Theme | Pure white metric cards with hairline `#E2E8F0` borders, subtle drop shadows, high-contrast metrics | M1 | survey_landing | DONE |
| 6 | Offline Architecture Light Theme | Clean light architecture diagram, white cards, warm peach and soft emerald indicator badges | M1 | survey_landing | DONE |
| 7 | Core Features Grid Light Theme | Pure white feature cards, subtle borders, warm vermilion icon containers, crisp slate typography | M1 | survey_landing | DONE |
| 8 | POS & KDS Previews Light Theme | Realistic light theme POS cart simulator, table headers, and KDS tickets with proper status colors | M1 | survey_landing | DONE |
| 9 | Thermal Receipt & Personas Light Theme | Authentic 80mm ESC/POS paper slip with subtle shadow on light neutral canvas, clean persona tabs | M1 | survey_landing | DONE |
| 10 | Pricing & Footer Light Theme | Light pricing tier cards, solid brand action buttons, crisp slate footer with clean dividers | M1 | survey_landing | DONE |
| 11 | Cloud Portal Layout Light Theme | Replace `#0B0F19` canvas and dark selection with `#F8FAFC` light canvas and slate-900 text in `cloud-portal/layout.tsx` | M2 | survey_admin | DONE |
| 12 | Cloud Portal Page & Components Light Theme | Convert header, role switcher, tabs, stat cards, data tables, and device pairing modal from `#0F172A`/`#111827` to `#FFFFFF` cards, `#E2E8F0` borders, `#F07928` brand accents, and soft status badges | M2 | survey_admin | DONE |
| 13 | Dashboard Overview Cards & Filter Pills | Align `(dashboard)/dashboard/page.tsx` stat cards to white card surfaces with colored icon badges; unify view mode pills (`day`/`month`) to solid brand/warm peach pills | M2 | survey_admin | DONE |
| 14 | Dashboard Pages Navigation & Badge Consistency | Unify category pills, active filter tabs, and status badges across `orders`, `inventory`, `expenses`, `reports`, `tables` to desktop POS brand vermilion and warm peach tints | M2 | survey_admin | DONE |
| 15 | Website Build & Lint Verification | Ensure `npm run build` and `npm run lint` in `landing/` complete with zero errors | M1 | ORIGINAL_REQUEST | DONE |
| 16 | Admin Portal Build & Lint Verification | Ensure `npm run lint` and `npm run build:frontend` in project root complete with zero errors | M2 | ORIGINAL_REQUEST | DONE |
| 17 | Independent Multi-Reviewer Verification | 2 Reviewers independently verify visual styling, color palette, typography, and component consistency across landing and admin portals | M3 | ORIGINAL_REQUEST | DONE |
| 18 | Adversarial Challenge & Stress Verification | 2 Challengers stress test responsive layouts, build reproducibility, interactive states, and theme contrast | M3 | ORIGINAL_REQUEST | DONE |
| 19 | Forensic Integrity & Regression Audit | Forensic integrity auditor verifies authentic implementations, zero dummy facades, zero cheat strings, zero functional regressions | M3 | ORIGINAL_REQUEST | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:---:|
| M1 | Website Light Theme Visual Identity Alignment | Full light theme refactoring of `landing/` (globals.css, layout.tsx, page.tsx, all 9 components) and zero-error verification on build & lint | none | **DONE** |
| M2 | Web Admin Portal Visual Alignment & Consistency | Full light theme refactoring of `frontend/src/app/cloud-portal/` and visual consistency improvements in `frontend/src/app/(dashboard)/` and zero-error verification on lint & build:frontend | none | **DONE** |
| M3 | Multi-Agent Verification Gate & Forensic Audit | Independent review (2 Reviewers), empirical stress testing (2 Challengers), and forensic integrity audit (1 Forensic Auditor) | M1, M2 | **DONE** |

## Interface Contracts
### Design Token Contract (Desktop POS Authority)
- **Background Canvas**: `#F8FAFC` (slate-50) / `#F9FAFB` (gray-50)
- **Card Surfaces**: Pure White `#FFFFFF` (`bg-card`)
- **Borders & Dividers**: Hairline Neutral `#E2E8F0` / `#E4E4E7` (`border-border`)
- **Primary Brand**: `#F07928` (`bg-brand`, `text-brand`, `border-brand`)
- **Brand Hover**: `#EA580C` / `#D96A1A` (`hover:bg-brand-hover`)
- **Warm Peach Tint**: `#FFF2EA` / `#FFF3E8` (`bg-brand-light`, `--sidebar-accent`)
- **Headings & Primary Text**: `#0F172A` / `#18181B` (`text-foreground`)
- **Secondary / Muted Text**: `#64748B` / `#71717A` (`text-muted-foreground`)
- **Paid / Completed Status**: `#DCFCE7` (bg) / `#15803D` (text)
- **Pending / Balance Due Status**: `#FFEDD5` (bg) / `#C2410C` (text)

## Code Layout
```text
landing/
├── src/
│   ├── app/
│   │   ├── globals.css      # Refactored to light theme tokens
│   │   ├── layout.tsx       # Refactored to light theme shell
│   │   └── page.tsx         # Refactored to light theme container
│   └── components/          # All 9 components aligned to desktop POS light theme
│       ├── Navbar.tsx
│       ├── Hero.tsx
│       ├── TrustMetrics.tsx
│       ├── OfflineArchitecture.tsx
│       ├── FeaturesGrid.tsx
│       ├── UiPreviews.tsx
│       ├── RolePersonas.tsx
│       ├── CtaSection.tsx
│       └── Footer.tsx

frontend/src/app/
├── cloud-portal/            # Aligned to light theme (layout.tsx & page.tsx)
└── (dashboard)/             # Aligned stat cards, pills, badges, tabs
    ├── dashboard/page.tsx
    ├── orders/page.tsx
    ├── inventory/page.tsx
    ├── expenses/page.tsx
    ├── reports/page.tsx
    └── tables/page.tsx
```
