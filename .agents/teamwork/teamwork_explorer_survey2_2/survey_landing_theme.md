# Comprehensive Survey Report: Public Website Light Theme Visual Alignment

**Target Workspace**: `landing/`  
**Author**: Explorer 2 (`teamwork_explorer_survey2_2`)  
**Parent Orchestrator ID**: `eee03b4e-76cf-44b7-bbf2-e012731666be`  
**Timestamp**: 2026-10-30T20:12:00Z  
**Status**: Ready for Implementation  

---

## 1. Executive Summary

The public marketing website in `landing/` is a Next.js 16.3.4 (Turbopack) and React 19 static export application using **Tailwind CSS v4** (`@tailwindcss/postcss: ^4`, `tailwindcss: ^4`). Currently, it is rendered in an entirely dark-mode aesthetic dominated by:
- Deep zinc/black backgrounds (`#09090b`, `bg-zinc-950`, `bg-zinc-900`)
- Dark borders (`border-zinc-800`, `border-zinc-700`, `border-zinc-900`)
- White/light zinc typography (`text-white`, `text-zinc-100`, `text-zinc-200`, `text-zinc-300`, `text-zinc-400`)
- Dark status container backgrounds (`bg-emerald-950`, `bg-amber-950`, `bg-blue-950`, `bg-purple-950`)
- Dark mode root flags (`color-scheme: dark` in `globals.css` and `className="dark"` on `<html>` in `layout.tsx`).

To satisfy Requirement **R1 (Website Light Theme Visual Identity Alignment)** and **R3 (UI Component & Interactive Element Consistency)**, the website must be refactored into the desktop POS light theme:
- **Canvas / Background**: Light neutral (`#F8FAFC` / `#F9FAFB`) with alternating pure white (`#FFFFFF`) card surfaces and clean slate borders (`#E2E8F0` / `#E4E4E7`).
- **Primary Brand / Accent**: Warm vibrant reddish-orange / saffron (`#F07928` / `#EA580C`).
- **Active Navigation & Category Pills**: Solid bright red-orange rounded pills with crisp white text (`#F07928` / `#EA580C`), plus subtle warm peach tints (`#FFF2EA` / `#FFF7ED`) for selections and badges.
- **Typography & Contrast**: Crisp dark slate primary text (`#0F172A` / `#18181B`) with muted secondary gray (`#64748B` / `#71717A`).
- **Status Badges & Metrics**: Light pastel backgrounds with rich, high-contrast foreground text (e.g., `bg-emerald-50 text-emerald-700 border-emerald-200`).

---

## 2. Toolchain, Build, and Lint Verification

| Check | Command Executed | Result | Notes |
|---|---|---|---|
| **Build** | `npm run build` in `landing/` | **Success (Exit Code 0)** | Statically exported 3 routes (`/`, `/_not-found`, `404.html`) via Next.js Turbopack |
| **Lint** | `npm run lint` in `landing/` | **Success (Exit Code 0)** | ESLint 9 + TypeScript validation clean across all files |
| **Tailwind Engine** | `@tailwindcss/postcss` v4 | **Native CSS `@theme`** | No legacy `tailwind.config.js` exists; all theme extensions live in `src/app/globals.css` |

---

## 3. Global Styles & Tailwind Token Adjustments

### File: `landing/src/app/globals.css`

#### Observations
1. **Lines 3–14**: The `@theme` directive configures dark surface tokens:
   ```css
   @theme {
     --color-brand: #F07928;
     --color-brand-hover: #D96A1A;
     --color-brand-light: #FFF3E8;
     --color-brand-dark: #B8530B;
     --color-brand-ring: rgba(240, 121, 40, 0.25);
     --color-surface-dark: #09090B;
     --color-surface-elevated: #18181B;
     --color-surface-card: #121215;
     --color-surface-border: #27272A;
     --color-success: #00CC61;
   }
   ```
2. **Line 21–24**: `html` has `color-scheme: dark;`.
3. **Lines 26–32**: `body` sets dark background and white text:
   ```css
   body {
     font-family: var(--font-sans);
     background-color: #09090B;
     color: #FAFAFA;
     overflow-x: hidden;
     min-height: 100vh;
   }
   ```
4. **Lines 35–48**: Webkit scrollbar has dark track `#09090B` and thumb `#27272A`.
5. **Lines 51–55**: `.receipt-paper` has dark drop shadow (`rgba(0, 0, 0, 0.5)`).

#### Exact Modifications Required
- **Update `@theme` tokens** to light-first surface values:
  ```css
  @theme {
    --color-brand: #F07928;
    --color-brand-hover: #EA580C;
    --color-brand-light: #FFF2EA;
    --color-brand-dark: #C2410C;
    --color-brand-ring: rgba(240, 121, 40, 0.25);
    --color-surface-canvas: #F8FAFC;
    --color-surface-card: #FFFFFF;
    --color-surface-muted: #F1F5F9;
    --color-surface-border: #E2E8F0;
    --color-success: #00CC61;
    --color-success-light: #DCFCE7;
    --color-success-dark: #166534;
  }
  ```
- **Change `html`**: Remove `color-scheme: dark;` or replace with `color-scheme: light;`.
- **Change `body`**:
  - `background-color: #F8FAFC;`
  - `color: #0F172A;`
- **Update scrollbar**:
  - Track: `background: #F1F5F9;` (or `transparent;`)
  - Thumb: `background: #CBD5E1;` (matching desktop POS in `frontend/src/app/globals.css`)
  - Thumb hover: `background: #94A3B8;`
- **Update `.receipt-paper`**:
  - Keep white background (`#ffffff`), soften shadow to `box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.05);`.

---

## 4. Root Layout & Page Shell

### File: `landing/src/app/layout.tsx`

| Line(s) | Current Dark Class / Prop | Replacement Light Theme Value | Rationale |
|---|---|---|---|
| **16** | `themeColor: "#09090b"` | `themeColor: "#F8FAFC"` | Matches light neutral canvas |
| **49** | `<html lang="en" className="dark">` | `<html lang="en">` | Removes global dark-mode trigger |
| **51** | `className="... bg-[#09090b] text-zinc-100 min-h-screen selection:bg-orange-500 selection:text-white"` | `className="... bg-[#F8FAFC] text-slate-900 min-h-screen selection:bg-orange-500 selection:text-white"` | Switches body to light background and dark slate text |

### File: `landing/src/app/page.tsx`

| Line(s) | Current Dark Class | Replacement Light Theme Value | Rationale |
|---|---|---|---|
| **14** | `<div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-orange-500 selection:text-white">` | `<div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">` | Eliminates page-level `#09090b` canvas |

---

## 5. Detailed Component Survey & Replacement Mappings

### 5.1 Component: `Navbar.tsx` (`landing/src/components/Navbar.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **11** | `bg-[#09090b]/85 border-b border-zinc-800/80` | `bg-white/90 border-b border-slate-200/80 shadow-xs` | Glassmorphic light navbar header |
| **24** | `text-white` | `text-slate-900` | Brand logo heading text |
| **27** | `bg-orange-500/15 text-orange-400 border border-orange-500/30` | `bg-orange-50 text-orange-600 border border-orange-200` | "POS" brand pill badge |
| **31** | `text-zinc-400` | `text-slate-500` | "By IndentDev" subtitle |
| **43** | `text-zinc-300 hover:text-orange-400` | `text-slate-600 hover:text-orange-600` | Desktop nav links hover color |
| **53** | `bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 shadow-inner` | `bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-xs` | "100% Offline Engine" status pill |
| **55, 56** | `bg-emerald-400` (ping), `bg-emerald-500` (solid) | `bg-emerald-500` (ping), `bg-emerald-600` (solid) | Pulsing indicator dot contrast |
| **64** | `bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 ... shadow-orange-500/25` | `bg-[#F07928] hover:bg-[#EA580C] text-white shadow-md shadow-orange-500/20` | Primary action button in solid reddish-orange |
| **76** | `text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800` | `text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-xs` | Mobile menu hamburger toggle button |
| **86** | `border-t border-zinc-800/80` | `border-t border-slate-200` | Mobile menu drawer divider |
| **89** | `bg-emerald-950/50 border border-emerald-500/30 text-emerald-400` | `bg-emerald-50 border border-emerald-200 text-emerald-700` | Mobile drawer status badge |
| **100** | `text-zinc-300 hover:text-orange-400 hover:bg-zinc-900` | `text-slate-700 hover:text-orange-600 hover:bg-orange-50/80` | Mobile drawer navigation links |
| **106** | `border-t border-zinc-800` | `border-t border-slate-200` | Mobile drawer footer divider |
| **115** | `text-zinc-400`, `text-emerald-400` | `text-slate-500`, `text-emerald-600` | Mobile reassurance note & icon |

---

### 5.2 Component: `Hero.tsx` (`landing/src/components/Hero.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **23** | `bg-orange-500/15 blur-[130px]` | `bg-orange-500/10 blur-[140px]` | Soft ambient warm glow behind hero headline |
| **30** | `bg-zinc-900/90 border border-orange-500/30 text-orange-300` | `bg-orange-50 border border-orange-200 text-orange-700 shadow-xs` | Eyebrow badge container and text |
| **31** | `text-orange-400 fill-orange-400` | `text-orange-600 fill-orange-500` | Eyebrow lightning icon |
| **36** | `text-white` | `text-slate-900` | Main headline text |
| **38** | `from-orange-400 via-amber-300 to-orange-500` | `from-orange-600 via-amber-600 to-orange-600` | High-contrast gradient text for "Offline-First Operating System" |
| **45** | `text-zinc-400` | `text-slate-600` | Subheading paragraph text |
| **65** | `bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80` | `bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs` | Secondary CTA button "Explore Interactive Demo" |
| **67** | `text-orange-400 fill-orange-400` | `text-orange-600 fill-orange-500` | Play icon inside secondary CTA |
| **73, 78, 83** | `text-zinc-400`, `text-zinc-600`, `text-emerald-400`, `text-orange-400` | `text-slate-500`, `text-slate-300`, `text-emerald-600`, `text-orange-600` | Reassurance checkmarks & bullet separators |
| **92, 102, 112, 122** | `bg-zinc-900/60 border border-zinc-800/80` | `bg-white border border-slate-200 shadow-xs hover:border-slate-300` | 4-Grid Trust Badges container |
| **93, 103, 113, 123** | `bg-emerald-500/10 text-emerald-400`, `bg-orange-500/10 text-orange-400`, `bg-sky-500/10 text-sky-400`, `bg-purple-500/10 text-purple-400` | `bg-emerald-50 text-emerald-600 border border-emerald-200`, `bg-orange-50 text-orange-600 border border-orange-200`, `bg-sky-50 text-sky-600 border border-sky-200`, `bg-purple-50 text-purple-600 border border-purple-200` | Trust badge icon containers |
| **97, 107, 117, 127** | `text-zinc-200` | `text-slate-900 font-semibold` | Trust badge titles |
| **98, 108, 118, 128** | `text-[11px] text-zinc-400` | `text-[11px] text-slate-500` | Trust badge subtext |
| **134** | `bg-zinc-950 border border-zinc-800 shadow-2xl` | `bg-slate-50 border border-slate-200 shadow-xl` | Desktop App Mockup Window Frame |
| **136** | `bg-zinc-900/90 border-b border-zinc-800` | `bg-slate-100/90 border-b border-slate-200` | Mockup title bar chrome |
| **141** | `text-zinc-400` | `text-slate-600` | Mockup title text ("Order It Up POS Desktop") |
| **146** | `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20` | `bg-emerald-50 text-emerald-700 border border-emerald-200` | Engine status pill in title bar |
| **154** | `bg-gradient-to-b from-zinc-900/50 to-zinc-950` | `bg-slate-50/70` | Mockup window interior background |
| **155, 166, 177** | `bg-zinc-900/80 border border-zinc-800` | `bg-white border border-slate-200 shadow-xs` | Metric cards inside mockup |
| **157, 168, 179** | `text-zinc-400` | `text-slate-500` | Metric card labels |
| **158, 169, 180** | `text-white` | `text-slate-900 font-bold` | Metric card numerical values |
| **159, 170, 181** | `text-emerald-400`, `text-amber-400` | `text-emerald-600`, `text-amber-600` | Metric card sub-status tags |
| **161, 172, 183** | `bg-orange-500/10 text-orange-400`, `bg-amber-500/10 text-amber-400`, `bg-emerald-500/10 text-emerald-400` | `bg-orange-50 text-orange-600`, `bg-amber-50 text-amber-600`, `bg-emerald-50 text-emerald-600` | Metric card icon containers |

---

### 5.3 Component: `TrustMetrics.tsx` (`landing/src/components/TrustMetrics.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **6** | `border-y border-zinc-800/80 bg-zinc-950/60` | `border-y border-slate-200 bg-white` | Metrics ribbon background & borders |
| **12** | `bg-zinc-900/40 border border-zinc-800/80 hover:border-orange-500/30` | `bg-slate-50/80 border border-slate-200 hover:border-orange-300 hover:bg-white hover:shadow-xs` | Metric card container |
| **15** | `text-white group-hover:text-orange-400` | `text-slate-900 group-hover:text-orange-600` | Large numerical statistic value |
| **18** | `text-zinc-200` | `text-slate-800 font-bold` | Metric title label |
| **21** | `text-zinc-400` | `text-slate-600` | Metric subtext explanation |

---

### 5.4 Component: `FeaturesGrid.tsx` (`landing/src/components/FeaturesGrid.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **17–29** | `text-orange-400` | `text-orange-600` | Lucide icon color in feature cards |
| **38** | `bg-orange-500/10 border border-orange-500/20 text-orange-400` | `bg-orange-50 border border-orange-200 text-orange-600 font-bold` | Section eyebrow pill |
| **41** | `text-white` | `text-slate-900` | Section heading |
| **44** | `text-zinc-400` | `text-slate-600` | Section description |
| **55** | `bg-zinc-900/50 border border-zinc-800/80 hover:border-orange-500/40 hover:-translate-y-1 shadow-sm` | `bg-white border border-slate-200 hover:border-orange-300 hover:shadow-md hover:-translate-y-1 shadow-xs` | 6 Feature cards container |
| **60** | `bg-orange-500/10 border border-orange-500/20 group-hover:bg-orange-500/15` | `bg-orange-50 border border-orange-200 group-hover:bg-orange-100` | Feature icon container |
| **63** | `bg-zinc-800 text-zinc-300 border border-zinc-700` | `bg-slate-100 text-slate-700 border border-slate-200` | Feature category badge pill |
| **69** | `text-white group-hover:text-orange-400` | `text-slate-900 group-hover:text-orange-600` | Feature card title |
| **72** | `text-zinc-400` | `text-slate-600` | Feature card description |
| **78** | `border-t border-zinc-800/80` | `border-t border-slate-100` | Highlights bottom divider |
| **80** | `text-zinc-300` | `text-slate-700` | Highlight bullet text |
| **81** | `text-emerald-400` | `text-emerald-600` | Highlight checkmark icon |

---

### 5.5 Component: `OfflineArchitecture.tsx` (`landing/src/components/OfflineArchitecture.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **27** | `bg-zinc-950/70 border-t border-zinc-800/80` | `bg-slate-50 border-t border-slate-200` | Section background & top border |
| **31** | `bg-emerald-500/10 border border-emerald-500/20 text-emerald-400` | `bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold` | Section eyebrow badge |
| **34** | `text-white` | `text-slate-900` | Section heading |
| **37** | `text-zinc-400` | `text-slate-600` | Section description |
| **50** | `bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700` | `bg-white border border-slate-200 hover:border-slate-300 shadow-xs` | Architectural layer cards |
| **53** | `bg-zinc-800 border border-zinc-700` | `bg-slate-100 border border-slate-200` | Layer icon box |
| **54–57** | `text-orange-400`, `text-emerald-400`, `text-sky-400`, `text-purple-400` | `text-orange-600`, `text-emerald-600`, `text-sky-600`, `text-purple-600` | Layer icons |
| **61** | `text-white` | `text-slate-900` | Layer name |
| **62** | `bg-zinc-800 text-zinc-300 border border-zinc-700` | `bg-slate-100 text-slate-700 border border-slate-200` | Port badge pill |
| **66** | `text-orange-400/90` | `text-orange-600 font-medium` | Technology stack description |
| **67** | `text-zinc-400` | `text-slate-600` | Layer detail paragraph |
| **73** | `bg-zinc-800/80 text-emerald-400 border border-emerald-500/30` | `bg-emerald-50 text-emerald-700 border border-emerald-200` | Layer operational status pill |
| **82** | `bg-zinc-950 border border-zinc-800 shadow-xl` | `bg-white border border-slate-200 shadow-md` | Live Telemetry Card container |
| **84** | `border-b border-zinc-800/80` | `border-b border-slate-200` | Telemetry card header divider |
| **86** | `text-orange-400` | `text-orange-600` | Cpu telemetry icon |
| **87** | `text-white` | `text-slate-900` | Telemetry card title |
| **89** | `text-emerald-400` | `text-emerald-700` | ONLINE (WAL) status badge |
| **100, 107, 112, 117, 122, 151** | `bg-zinc-900/80 border border-zinc-800/80` | `bg-slate-50 border border-slate-200` | Status metric rows in telemetry card |
| **101, 108, 113, 118, 123, 135, 152** | `text-zinc-400` | `text-slate-500 font-medium` | Metric row labels |
| **103** | `text-emerald-400` | `text-emerald-700` | Port 3001 status |
| **109** | `text-zinc-200` | `text-slate-800 font-semibold` | Database engine |
| **114** | `text-orange-400` | `text-orange-600 font-semibold` | Transaction latency value |
| **119** | `text-emerald-400` | `text-emerald-700 font-semibold` | KDS WebSockets status |
| **124** | `text-sky-400` | `text-sky-700 font-semibold` | Thermal bus status |
| **131** | `bg-amber-950/30 border-amber-500/40 text-amber-300` | `bg-amber-50 border-amber-300 text-amber-800` | Simulated WAN outage status |
| **133** | `bg-zinc-900/80 border-zinc-800/80 text-zinc-300` | `bg-slate-50 border-slate-200 text-slate-700` | Simulated WAN online status |
| **139** | `text-amber-400` | `text-amber-600` | WifiOff icon |
| **144** | `text-emerald-400` | `text-emerald-600` | Wifi icon |
| **153** | `text-zinc-300` | `text-slate-800 font-semibold` | Outbox buffer status |
| **160** | `border-t border-zinc-800/80` | `border-t border-slate-200` | Simulation switch footer divider |
| **167** | `bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700` | `bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-xs` | Default simulation toggle button |
| **166** | `bg-amber-600 hover:bg-amber-500 text-white border-amber-400` | `bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-sm` | Outage active button |
| **178** | `text-zinc-400` | `text-slate-500` | Bottom transactions logged text |
| **180** | `text-emerald-400` | `text-emerald-700 font-medium` | "Billing never halts" status |

---

### 5.6 Component: `UiPreviews.tsx` (`landing/src/components/UiPreviews.tsx`)

This is the largest interactive component in `landing/` (612 lines).

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **106** | `text-white` | `text-slate-900` | Section heading |
| **109** | `text-zinc-400` | `text-slate-600` | Section subtitle |
| **117** | `bg-zinc-900 border border-zinc-800` | `bg-slate-100 border border-slate-200 shadow-inner` | Tab selection bar container |
| **122, 135, 148** | `bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/20` | `bg-[#F07928] text-white shadow-md shadow-orange-500/20` | Active tab pill (Cart / KDS / Receipt) |
| **124, 137, 150** | `text-zinc-400 hover:text-white` | `text-slate-600 hover:text-slate-900` | Inactive tab pill text |
| **163** | `rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl` | `rounded-2xl bg-white border border-slate-200 shadow-xl` | Cart Simulator Window Frame |
| **165** | `bg-zinc-900 border-b border-zinc-800` | `bg-slate-50 border-b border-slate-200` | Cart Simulator Window Header |
| **170** | `text-zinc-200` | `text-slate-800 font-semibold` | Restaurant name in window header |
| **178** | `text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700` | `text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs` | Cart Reset button |
| **183** | `bg-zinc-800 text-orange-400 border border-zinc-700` | `bg-orange-50 text-orange-700 border border-orange-200` | Table / Pax status badge |
| **190** | `bg-zinc-950 border-b border-zinc-800/80` | `bg-slate-50/60 border-b border-slate-200` | Service type switcher container |
| **197, 208, 219** | `bg-orange-500 text-white` | `bg-[#F07928] text-white shadow-xs` | Active service type button |
| **198, 209, 220** | `bg-zinc-900 text-zinc-400 hover:text-white` | `bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs` | Inactive service type buttons |
| **226** | `text-zinc-400` | `text-slate-500` | Cashier info label |
| **232** | `divide-y divide-zinc-800/80` | `divide-y divide-slate-100` | Cart items list divider |
| **234** | `text-zinc-500` | `text-slate-400` | Empty cart message |
| **251** | `text-white` | `text-slate-900 font-semibold` | Dish item name |
| **253** | `text-zinc-400` | `text-slate-500` | Dish modifier description |
| **254** | `text-zinc-400` | `text-slate-400` | Dish chef note |
| **259** | `bg-zinc-900 border border-zinc-800` | `bg-slate-50 border border-slate-200` | Quantity counter pill |
| **263, 274** | `text-zinc-400 hover:text-white hover:bg-zinc-800` | `text-slate-600 hover:text-slate-900 hover:bg-slate-200` | Quantity +/- buttons |
| **268** | `text-white` | `text-slate-900` | Quantity number |
| **280** | `text-zinc-200` | `text-slate-900 font-bold` | Line total price |
| **290** | `bg-zinc-900/70 border-t border-zinc-800` | `bg-slate-50 border-t border-slate-200` | Bill calculation summary container |
| **291** | `text-zinc-400` | `text-slate-600` | Bill calculation labels |
| **295, 299, 303, 307** | `text-zinc-200` | `text-slate-800 font-medium` | Bill calculation values (CGST, SGST, etc.) |
| **310** | `border-t border-zinc-800 text-white` | `border-t border-slate-200 text-slate-900` | Grand total row |
| **312** | `text-orange-400` | `text-orange-600 font-extrabold` (or `text-[#F07928]`) | Grand total amount |
| **319** | `bg-emerald-950/60 border border-emerald-500/40 text-emerald-300` | `bg-emerald-50 border border-emerald-300 text-emerald-800` | Order settled notification banner |
| **336** | `bg-gradient-to-r from-orange-500 to-amber-500 ...` | `bg-[#F07928] hover:bg-[#EA580C] text-white shadow-md shadow-orange-500/20` | "Settle & Print Thermal Receipt" button |
| **349** | `rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl` | `rounded-2xl bg-white border border-slate-200 shadow-xl` | KDS Ticket Window Frame |
| **351** | `bg-zinc-900 border-b border-zinc-800` | `bg-slate-50 border-b border-slate-200` | KDS Ticket Topbar |
| **353** | `bg-orange-500 text-white` | `bg-[#F07928] text-white` | Ticket #104 number badge |
| **357** | `text-white` | `text-slate-900 font-bold` | KDS Table name |
| **358** | `text-zinc-400` | `text-slate-500` | KDS Table metadata |
| **363** | `bg-amber-500/10 border border-amber-500/30 text-amber-400` | `bg-amber-50 border border-amber-200 text-amber-800` | KDS SLA elapsed timer pill |
| **370** | `text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/50` | `text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 shadow-xs` | "Bump All to Ready" button |
| **378** | `bg-zinc-900/40 border-b border-zinc-800/80 text-zinc-400` | `bg-slate-100/60 border-b border-slate-200 text-slate-600` | KDS Station routing bar |
| **380** | `text-emerald-400` | `text-emerald-700 font-semibold` | WebSocket LAN connection status |
| **390** | `bg-zinc-900/70 border border-zinc-800` | `bg-slate-50 border border-slate-200` | KDS Item rows |
| **394** | `text-orange-400 bg-orange-500/10` | `text-orange-700 bg-orange-100` | Item quantity multiplier pill |
| **397** | `text-white` | `text-slate-900 font-semibold` | KDS item dish title |
| **400** | `text-amber-300` | `text-amber-800 font-semibold` | KDS modifier chip text |
| **402** | `text-zinc-400` | `text-slate-500` | KDS special note |
| **412** | `bg-emerald-950 text-emerald-400 border-emerald-500/40` | `bg-emerald-50 text-emerald-700 border-emerald-200` | Stage badge: "READY" |
| **414** | `bg-blue-950 text-blue-400 border-blue-500/40` | `bg-blue-50 text-blue-700 border-blue-200` | Stage badge: "PREPARING" |
| **416** | `bg-purple-950 text-purple-400 border-purple-500/40` | `bg-purple-50 text-purple-700 border-purple-200` | Stage badge: "SERVED" |
| **417** | `bg-zinc-800 text-zinc-300 border-zinc-700` | `bg-slate-100 text-slate-700 border border-slate-200` | Stage badge: "PENDING" |
| **426** | `bg-zinc-800 hover:bg-orange-500 hover:text-white text-zinc-200 border border-zinc-700` | `bg-white hover:bg-orange-500 hover:text-white text-slate-700 border border-slate-200 shadow-xs` | Item "Bump" button |
| **438** | `bg-zinc-900/60 border-t border-zinc-800 text-zinc-400` | `bg-slate-50 border-t border-slate-200 text-slate-500` | KDS footer stats |
| **439** | `text-emerald-400` | `text-emerald-700 font-semibold` | KDS footer sync lag badge |
| **453** | `text-zinc-400` | `text-slate-600` | ESC/POS 80mm Direct Spooler label |
| **460** | `bg-orange-500 hover:bg-orange-600 text-white ... shadow-orange-500/20` | `bg-[#F07928] hover:bg-[#EA580C] text-white shadow-md shadow-orange-500/20` | "Simulate Thermal Print" action button |
| **469** | `receipt-paper ... border-zinc-300` | `receipt-paper ... border-slate-300 shadow-xl` | Thermal receipt paper styling |

---

### 5.7 Component: `RolePersonas.tsx` (`landing/src/components/RolePersonas.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **42** | `bg-zinc-950/60 border-t border-zinc-800/80` | `bg-slate-50 border-t border-slate-200` | Section background & divider |
| **46** | `bg-orange-500/10 border border-orange-500/20 text-orange-400` | `bg-orange-50 border border-orange-200 text-orange-600 font-bold` | Section eyebrow pill |
| **49** | `text-white` | `text-slate-900` | Section heading |
| **52** | `text-zinc-400` | `text-slate-600` | Section description |
| **67** | `bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20` | `bg-[#F07928] text-white shadow-md shadow-orange-500/20` | Selected role navigation pill |
| **68** | `bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800` | `bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs` | Unselected role buttons |
| **78** | `bg-zinc-900/60 border border-zinc-800 shadow-xl` | `bg-white border border-slate-200 shadow-md` | Selected persona details card |
| **79** | `border-b border-zinc-800` | `border-b border-slate-200` | Card header divider |
| **82** | `text-white` | `text-slate-900 font-bold` | Persona title |
| **85** | `bg-orange-500/15 text-orange-400 border border-orange-500/30` | `bg-orange-50 text-orange-700 border border-orange-200` | Persona badge pill |
| **89** | `text-zinc-400` | `text-slate-500` | Persona subtitle |
| **92** | `text-zinc-400` | `text-slate-500` | Scoped token explanation |
| **93** | `text-orange-400` | `text-orange-600` | Lock icon |
| **100** | `text-zinc-400` | `text-slate-500 font-bold` | Capabilities sub-heading |
| **107** | `bg-zinc-950/70 border border-zinc-800/80` | `bg-slate-50 border border-slate-200` | Responsibility card containers |
| **109** | `text-emerald-400` | `text-emerald-600` | Responsibility checkmark |
| **110** | `text-zinc-300` | `text-slate-700` | Responsibility description text |

---

### 5.8 Component: `CtaSection.tsx` (`landing/src/components/CtaSection.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **21** | `bg-orange-500/15 blur-[140px]` | `bg-orange-500/10 blur-[140px]` | Ambient warm bottom glow |
| **27** | `bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 shadow-2xl` | `bg-gradient-to-b from-orange-50/70 via-white to-white border border-orange-200/80 shadow-xl` | Main CTA Banner Box |
| **28** | `bg-orange-500/15 border border-orange-500/30 text-orange-400` | `bg-orange-50 border border-orange-200 text-orange-700 font-semibold` | Banner eyebrow pill |
| **33** | `text-white` | `text-slate-900` | Banner headline |
| **37** | `text-zinc-400` | `text-slate-600` | Banner description text |
| **47** | `bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 text-white` | `bg-[#F07928] hover:bg-[#EA580C] text-white shadow-lg shadow-orange-500/25` | Windows download primary button |
| **59, 71** | `bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700` | `bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs` | macOS and Linux download buttons |
| **61, 73** | `text-zinc-300` | `text-slate-700` | Apple & Terminal icons |
| **63, 75** | `text-zinc-400` | `text-slate-500` | "Download for" micro-label |
| **64, 76** | `text-sm font-extrabold` (with `text-zinc-200`) | `text-sm font-extrabold text-slate-800` | OS version text |
| **82** | `text-zinc-400` | `text-slate-600` | Reassurance check items |
| **84, 88** | `text-emerald-400` | `text-emerald-600` | Check & Shield icons |
| **92** | `text-orange-400` | `text-orange-600` | HardDrive icon |
| **99** | `border-t border-zinc-800/80` | `border-t border-slate-200` | Hardware specifications divider |
| **101** | `bg-zinc-800 border border-zinc-700 text-zinc-300` | `bg-slate-100 border border-slate-200 text-slate-700` | Hardware specs eyebrow badge |
| **105** | `text-white` | `text-slate-900` | Hardware section heading |
| **108** | `text-zinc-400` | `text-slate-600` | Hardware section description |
| **117** | `bg-zinc-900/40 border border-zinc-800/80` | `bg-white border border-slate-200 shadow-xs hover:border-slate-300` | Hardware spec cards |
| **120** | `text-orange-400` | `text-orange-600 font-bold` | Category title |
| **121** | `text-white` | `text-slate-900 font-semibold` | Supported hardware model list |
| **122** | `text-zinc-400`, `text-zinc-500` | `text-slate-600`, `text-slate-400` | Connectivity specs |
| **128, 133, 138, 143, 148** | `border-t border-zinc-800/80 text-zinc-500` | `border-t border-slate-100 text-slate-500` | Bottom details divider and metadata |

---

### 5.9 Component: `Footer.tsx` (`landing/src/components/Footer.tsx`)

| Line(s) | Current Dark Code | Replacement Light Theme Code | Description |
|---|---|---|---|
| **7** | `bg-zinc-950 border-t border-zinc-800 text-zinc-400` | `bg-white border-t border-slate-200 text-slate-600` | Footer container & border |
| **16** | `text-white` | `text-slate-900` | Brand name in footer |
| **19** | `bg-orange-500/10 text-orange-400 border border-orange-500/20` | `bg-orange-50 text-orange-600 border border-orange-200` | "POS" badge pill |
| **24** | `text-zinc-400` | `text-slate-500` | Mission statement paragraph |
| **29** | `bg-zinc-900 border border-zinc-800 text-zinc-300` | `bg-slate-100 border border-slate-200 text-slate-700` | Local subsystems status pill |
| **37, 69, 93** | `text-white` | `text-slate-900 font-bold` | Footer navigation column headings |
| **40, 45, 50, etc.** | `hover:text-orange-400` | `hover:text-orange-600` | Footer link hover state |
| **74, 77, 80, 83, 86, 113, 116** | `text-zinc-300` | `text-slate-600` | Non-link footer text items |
| **123** | `border-t border-zinc-900` | `border-t border-slate-200` | Footer bottom bar divider |
| **124** | `text-zinc-500` | `text-slate-500` | Copyright notice |
| **126** | `text-zinc-300` | `text-slate-800 font-semibold` | Company name link ("IndentDev") |
| **129** | `text-zinc-500`, `text-emerald-500` | `text-slate-500`, `text-emerald-600` | Bottom security reassurance note |

---

## 6. Color Token Reference Table

This lookup table defines the exact 1-to-1 mapping between dark classes and their light theme replacements:

| Semantic Purpose | Dark Mode Class | Light Mode Replacement | Hex Equivalent |
|---|---|---|---|
| **App Canvas / Shell** | `bg-[#09090b]`, `bg-zinc-950` | `bg-[#F8FAFC]` or `bg-slate-50` | `#F8FAFC` |
| **Card Surface** | `bg-zinc-900`, `bg-zinc-950`, `bg-zinc-900/60` | `bg-white` | `#FFFFFF` |
| **Subtle Card / Inner Wells**| `bg-zinc-900/80`, `bg-zinc-900/40` | `bg-slate-50` or `bg-slate-100/60`| `#F1F5F9` / `#F8FAFC` |
| **Card Borders** | `border-zinc-800`, `border-zinc-800/80`| `border-slate-200` | `#E2E8F0` |
| **Inner Card Dividers** | `divide-zinc-800/80`, `border-zinc-800` | `divide-slate-100`, `border-slate-100`| `#F1F5F9` |
| **Primary Headings** | `text-white` | `text-slate-900` | `#0F172A` |
| **Secondary Text** | `text-zinc-400`, `text-zinc-500` | `text-slate-600`, `text-slate-500` | `#64748B` |
| **Muted Meta / Subtext** | `text-zinc-500` | `text-slate-400` | `#94A3B8` |
| **Primary Brand Accent** | `from-orange-500 to-amber-500` | `bg-[#F07928] hover:bg-[#EA580C]` | `#F07928` / `#EA580C` |
| **Active Nav / Tab Pill**| `bg-gradient-to-r from-orange-500 ...`| `bg-[#F07928] text-white` | `#F07928` |
| **Inactive Nav / Tab Pill**| `bg-zinc-900 text-zinc-400 hover:text-white`| `bg-white text-slate-600 hover:text-slate-900 border border-slate-200` | `#FFFFFF` / `#475569` |
| **Warm Peach Badge Tint** | `bg-orange-500/10 text-orange-400 border-orange-500/20` | `bg-orange-50 text-orange-700 border-orange-200` | `#FFF2EA` / `#C2410C` |
| **Success / Online Badge**| `bg-emerald-950 text-emerald-400 border-emerald-500/30` | `bg-emerald-50 text-emerald-700 border-emerald-200` | `#DCFCE7` / `#15803D` |
| **Warning / SLA Timer** | `bg-amber-950/30 text-amber-400 border-amber-500/30` | `bg-amber-50 text-amber-800 border-amber-200` | `#FEF3C7` / `#92400E` |
| **Info / Tech Badge** | `bg-sky-500/10 text-sky-400 border-sky-500/20` | `bg-sky-50 text-sky-700 border-sky-200` | `#E0F2FE` / `#0369A1` |

---

## 7. Phased Implementation Plan for Downstream Agents

### Phase 1: CSS Foundation & Layout Shell
1. Edit `landing/src/app/globals.css`:
   - Adjust `@theme` surface tokens to light values.
   - Set `body` background `#F8FAFC` and text `#0F172A`.
   - Update scrollbar track/thumb to light slate.
   - Adjust `.receipt-paper` shadow for light canvas.
2. Edit `landing/src/app/layout.tsx`:
   - Remove `className="dark"` from `<html>`.
   - Update `themeColor` to `#F8FAFC`.
   - Update `body` className to `bg-[#F8FAFC] text-slate-900`.
3. Edit `landing/src/app/page.tsx`:
   - Replace `bg-[#09090b] text-zinc-100` with `bg-[#F8FAFC] text-slate-900`.

### Phase 2: Navigation & Hero
1. Edit `landing/src/components/Navbar.tsx`:
   - Glassmorphic header `bg-white/90 border-slate-200/80`.
   - Update desktop & mobile navigation links and status pill.
2. Edit `landing/src/components/Hero.tsx`:
   - Update eyebrow pill, heading contrast, CTA buttons, trust badges, and the interactive app mockup chrome.

### Phase 3: Content Sections & Previews
1. Edit `landing/src/components/TrustMetrics.tsx`:
   - Light ribbon background and bordered stat cards.
2. Edit `landing/src/components/FeaturesGrid.tsx`:
   - Pure white feature cards, slate badges, and high-contrast orange icons.
3. Edit `landing/src/components/OfflineArchitecture.tsx`:
   - Light architecture cards and live telemetry simulator styling.
4. Edit `landing/src/components/UiPreviews.tsx`:
   - Update tab selector, Cart simulator, KDS ticket, and 80mm thermal receipt.
5. Edit `landing/src/components/RolePersonas.tsx`:
   - Update role pill buttons and selected persona details card.

### Phase 4: CTA, Footer & Verification
1. Edit `landing/src/components/CtaSection.tsx`:
   - Light gradient CTA banner and hardware specification cards.
2. Edit `landing/src/components/Footer.tsx`:
   - Pure white/slate footer with clear navigation columns.
3. Run `npm run build` in `landing/` to confirm zero compilation errors.
4. Run `npm run lint` in `landing/` to confirm zero lint issues.
