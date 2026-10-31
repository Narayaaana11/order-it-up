# Comprehensive Survey Report: Web Admin Portal Light Theme Visual Alignment

**Target Modules**: `frontend/src/app/(dashboard)` and `frontend/src/app/cloud-portal`  
**Author**: Explorer 3 (`teamwork_explorer_survey2_3`)  
**Parent Orchestrator ID**: `eee03b4e-76cf-44b7-bbf2-e012731666be`  
**Timestamp**: 2026-10-30T20:15:00Z  
**Integrity Mode**: Development (Read-only Investigation)  
**Status**: COMPLETED & VERIFIED  

---

## 1. Executive Summary

This survey provides a comprehensive audit of the Order It Up Web Admin Portal across all dashboard routes (`frontend/src/app/(dashboard)/*`), the multi-branch franchise cloud portal (`frontend/src/app/cloud-portal/*`), and associated UI components (`frontend/src/components/*`).

### Key Discoveries & Current Visual Discrepancies:
1. **Cloud Portal Hardcoded Dark Theme**:  
   `frontend/src/app/cloud-portal/layout.tsx` and `page.tsx` are 100% hardcoded in a dark theme using deep slate/black canvases (`#0B0F19`, `#111827`, `#0F172A`), dark slate borders (`border-slate-800`), amber accents (`amber-500`, `amber-400`), and dark card/table styling. This contradicts the desktop POS light theme palette and must be refactored to the canonical light canvas (`#F8FAFC`/`#FFFFFF`), subtle borders (`#E2E8F0`), and saffron vermilion brand accents (`#F07928`/`#EA580C`).

2. **Inconsistent Navigation Pills & Category Selectors Across Dashboard Views**:  
   Five conflicting navigation and active pill patterns were identified:
   - **Solid Brand Orange Pill**: `bg-brand text-white shadow-md shadow-brand/20` (canonical pattern in `ProductGrid.tsx` and `orders/page.tsx`).
   - **Black Foreground Pill**: `bg-foreground text-background` (in `dashboard/page.tsx` lines 417-420 for day/month view toggle).
   - **Neutral Underline with Black Primary**: `border-primary text-primary` (in `inventory/page.tsx` lines 368, 380, 392 and `expenses/page.tsx` lines 339, 351, 363).
   - **Neutral White Button on Gray Well**: `bg-background shadow-sm text-foreground` on `bg-muted/60` (in `reports/page.tsx` line 222).
   - **Amber Underline on Dark Bar**: `border-amber-500 text-amber-400 bg-amber-500/5` (in `cloud-portal/page.tsx` line 545).

3. **Stat Cards & Metric Containers Inconsistency**:  
   - In `dashboard/page.tsx`, top KPI cards use 9 different pastel rainbow backgrounds (`bg-blue-50 border-blue-200`, `bg-yellow-50`, `bg-purple-50`, `bg-cyan-50`, `bg-emerald-50`, `bg-red-50`, `bg-green-50`, `bg-teal-50`, `bg-orange-50`).
   - In `cloud-portal/page.tsx`, stat cards use dark gray containers (`bg-[#111827] border-slate-800 text-white`).
   - In `orders/page.tsx`, `reports/page.tsx`, and `inventory/page.tsx`, cards use clean pure white surfaces (`bg-card border-border shadow-xs/sm`).
   - Standardizing to pure white card surfaces (`bg-card` / `#FFFFFF`) with subtle borders (`border-border` / `#E2E8F0`) and brand/soft green metric accents will achieve cohesive POS alignment.

4. **Status Badges (Completed & Paid)**:  
   Varying shades of green and badges are used across views:
   - `orders/page.tsx`: `bg-green-100 text-green-700` for `paid` and `ready`; `bg-muted text-muted-foreground` for `completed`.
   - `cloud-portal/page.tsx`: `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`.
   - `products/page.tsx`: `bg-emerald-50 text-emerald-700` and `bg-green-100 text-green-800`.
   - To align with Requirement R3, status badges for paid and completed should standardize to soft green (`bg-emerald-50 text-emerald-700 border border-emerald-200/80` with emerald dot indicator).

5. **Palette Cohesion**:  
   `ai-insights/page.tsx` introduces an unaligned purple visual system (`purple-600`, `purple-50`, `border-purple-200`) which should be harmonized with the saffron orange brand palette (`#F07928` / `#FFF2EA`).

---

## 2. Canonical Desktop POS Theme Tokens (Reference Standard)

From `frontend/src/app/globals.css` and `frontend/src/components/pos/`:

| Element | Desktop POS Standard | Class / Utility |
|---|---|---|
| **Canvas / Background** | `#F8FAFC` / `#FFFFFF` | `bg-background` (`oklch(1 0 0)`) or `bg-slate-50` / `#F8FAFC` |
| **Card Surfaces** | Pure White `#FFFFFF` | `bg-card` (`oklch(1 0 0)`) `text-card-foreground` |
| **Borders** | Hairline Slate `#E2E8F0` / `#E4E4E7` | `border-border` (`oklch(0.922 0 0)`) |
| **Primary Brand / Accent** | Saffron Vermilion `#F07928` / `#EA580C` | `bg-brand` / `text-brand` / `border-brand` (`#F07928`) |
| **Brand Hover / Active** | Deep Saffron `#D96A1A` / `#EA580C` | `bg-brand-hover` (`#D96A1A`) |
| **Brand Peach Selection** | Soft Peach `#FFF3E8` / `#FFF2EA` | `bg-brand-light` / `--sidebar-accent` (`#FFF3E8`) |
| **Selected Nav Item Text** | Deep Saffron `#D96A1A` | `text-sidebar-accent-foreground` (`#D96A1A`) |
| **Active Nav / Filter Pills**| Solid Saffron Pill + White Text | `bg-brand text-white shadow-md shadow-brand/20 rounded-xl` |
| **Primary Typography** | Crisp Slate `#0F172A` / `#18181B` | `text-foreground` (`oklch(0.145 0 0)`) |
| **Secondary Typography** | Muted Gray `#64748B` / `#71717A` | `text-muted-foreground` (`oklch(0.556 0 0)`) |
| **Completed / Paid Badge** | Soft Green `#DCFCE7` / `#166534` | `bg-emerald-50 text-emerald-700 border border-emerald-200` |
| **Table Header** | Soft Gray `#F8FAFC` / `#F1F5F9` | `bg-muted/60 text-muted-foreground font-semibold text-xs` |
| **Table Row Hover** | Subtle Well `#F8FAFC` | `hover:bg-muted/40 transition-colors` |

---

## 3. Deep Dive: `frontend/src/app/cloud-portal`

### 3.1 Layout (`frontend/src/app/cloud-portal/layout.tsx`)

#### Observation:
- Line 14:
  ```tsx
  <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
  ```
- Uses hardcoded dark background `#0B0F19` and dark text `text-slate-100` with amber selection.

#### Required Adjustment:
```tsx
<div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#F07928] selection:text-white">
```

---

### 3.2 Main Portal Page (`frontend/src/app/cloud-portal/page.tsx`)

#### Detailed Inventory of Styling Elements to Refactor:

| Component / Section | Lines | Current Dark / Inconsistent Classes | Required Light Theme POS Classes |
|---|---|---|---|
| **Sticky Header** | 384 | `border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur-md` | `border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4` |
| **Brand Icon Container** | 386 | `bg-gradient-to-tr from-amber-500 to-orange-400 shadow-amber-500/20` | `bg-brand text-white rounded-xl shadow-md shadow-brand/20` |
| **Title & Subtitle** | 391, 401 | `text-white`, `text-slate-400` | `text-foreground font-bold`, `text-muted-foreground text-xs` |
| **Franchise HQ Badge** | 392–394 | `bg-amber-500/10 text-amber-400 border border-amber-500/20` | `bg-brand-light text-brand border border-brand/30 font-semibold px-2.5 py-0.5 rounded-full text-xs` |
| **Concept & Branch Selectors** | 408–444 | `bg-slate-900 border border-slate-800 text-slate-200` | `bg-card border border-border text-foreground rounded-lg px-2.5 py-1.5 shadow-xs` |
| **Role Switcher Well** | 446 | `bg-slate-900 border border-slate-800 rounded-lg p-1` | `bg-muted border border-border rounded-xl p-1` |
| **Role Switcher Active Button**| 451, 464 | `bg-amber-500 text-slate-950 font-semibold shadow-sm` | `bg-brand text-white font-semibold shadow-sm rounded-lg` |
| **Role Switcher Inactive Button**| 452, 465 | `text-slate-400 hover:text-white` | `text-muted-foreground hover:text-foreground rounded-lg` |
| **Web POS Action Link** | 472–478 | `bg-amber-500/10 text-amber-400 border border-amber-500/30` | `bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 rounded-lg` |
| **Connect Devices Button** | 480–486 | `bg-emerald-500/10 text-emerald-400 border border-emerald-500/30` | `bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg` |
| **Onboarding Banner** | 494 | `bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/30` | `bg-gradient-to-r from-brand-light via-orange-50/50 to-card border border-brand/30 shadow-sm rounded-2xl` |
| **Navigation Tabs Bar** | 540 | `border-b border-slate-800 overflow-x-auto gap-1` | `border-b border-border overflow-x-auto gap-1.5` |
| **Navigation Tab Active** | 545, 557, 569, 581, 593 | `border-amber-500 text-amber-400 bg-amber-500/5` | `border-brand text-brand bg-brand-light/60 font-semibold border-b-2 rounded-t-lg` (or solid rounded pill `bg-brand text-white shadow-sm`) |
| **Navigation Tab Inactive** | 546, 558, 570, 582, 594 | `border-transparent text-slate-400 hover:text-slate-200` | `border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-t-lg` |
| **KPI Stat Cards** | 607, 619, 628, 637 | `bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm text-white` | `bg-card border border-border rounded-2xl p-5 shadow-sm text-foreground` |
| **Leaderboard Container** | 649 | `bg-[#111827] border border-slate-800 rounded-2xl p-6` | `bg-card border border-border rounded-2xl p-6 shadow-sm` |
| **Branch Leaderboard Rows** | 669 | `bg-slate-900/60 border border-slate-800/80` | `bg-muted/30 border border-border hover:bg-muted/50 rounded-xl` |
| **Leaderboard Progress Bar** | 689–694 | `bg-slate-800`, `bg-gradient-to-r from-amber-500 to-orange-400` | `bg-muted`, `bg-gradient-to-r from-brand to-brand-hover` |
| **Item Velocity Items** | 716 | `bg-slate-900/60 border border-slate-800` | `bg-card border border-border hover:bg-muted/30 rounded-xl` |
| **Export Action Buttons** | 748, 755 | `bg-amber-500 text-slate-950` / `bg-slate-800 text-white border-slate-700` | `bg-brand text-white hover:bg-brand-hover shadow-sm` / `bg-card border border-border text-foreground hover:bg-muted` |
| **Data Tables (All Tabs)** | 764, 861, 985 | `bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden` | `bg-card border border-border rounded-2xl overflow-hidden shadow-xs` |
| **Table Head** | 767, 864, 987 | `bg-slate-900/80 text-slate-400 border-b border-slate-800` | `bg-muted/60 text-muted-foreground font-semibold border-b border-border uppercase text-[11px]` |
| **Table Body & Dividers** | 780, 874, 998 | `divide-y divide-slate-800/60 text-slate-200` | `divide-y divide-border text-foreground text-xs` |
| **Table Row Hover** | 782, 876, 1000 | `hover:bg-slate-800/30 transition-colors` | `hover:bg-muted/40 transition-colors` |
| **GST Breakdown Cards** | 814, 819, 824 | `bg-slate-900 border border-slate-800` | `bg-muted/30 border border-border rounded-xl p-4` |
| **Branch Price Selector** | 851 | `bg-slate-900 border border-slate-700 text-white` | `bg-card border border-border text-foreground rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand` |
| **Stock / 86 Status Button** | 892–899 | `bg-emerald-500/10 text-emerald-400 border-emerald-500/20` / `bg-rose-500/10` | `bg-emerald-50 text-emerald-700 border border-emerald-200` / `bg-rose-50 text-rose-700 border border-rose-200` |
| **Branch Terminal Fleet Cards**| 938 | `bg-[#111827] border border-slate-800 rounded-2xl p-5` | `bg-card border border-border rounded-2xl p-5 shadow-sm` |
| **Pairing Modal Backdrop** | 1049 | `bg-black/80 backdrop-blur-md` | `bg-black/40 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4` |
| **Pairing Modal Card** | 1050 | `bg-[#111827] border border-slate-800 rounded-3xl text-white` | `bg-card border border-border rounded-3xl p-6 text-foreground shadow-2xl` |
| **Pairing Device Tabs Well** | 1070 | `bg-slate-900/90 p-1.5 rounded-xl border border-slate-800` | `bg-muted p-1.5 rounded-xl border border-border` |
| **Pairing Tab Active** | 1075, 1085 | `bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20` | `bg-brand text-white font-bold shadow-sm rounded-lg` |
| **Pairing PIN Display Box** | 1094, 1100 | `bg-slate-900/50`, `bg-slate-950 border-2 border-amber-500/40 text-amber-400 font-mono` | `bg-muted/40 border border-border rounded-2xl`, `bg-card border-2 border-brand/40 text-brand font-mono font-extrabold shadow-inner` |
| **Instructions Box** | 1115 | `bg-slate-900/80 border border-slate-800 text-slate-300` | `bg-muted/40 border border-border rounded-xl p-4 text-xs text-muted-foreground` |
| **Copy PIN Button** | 1143 | `bg-amber-500 text-slate-950 font-bold shadow-amber-500/20` | `bg-brand hover:bg-brand-hover text-white font-bold shadow-sm shadow-brand/20 rounded-xl` |

---

## 4. Deep Dive: `frontend/src/app/(dashboard)`

### 4.1 Layout & Navigation Chrome

#### Files:
- `frontend/src/app/(dashboard)/layout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/BottomNav.tsx`
- `frontend/src/components/layout/StatusBar.tsx`

#### Layout Analysis:
- `layout.tsx` mounts `AppSidebar`, `TitleBar`, `SidebarInset`, `GlobalNotifications`, and `StatusBar`.
- `Sidebar.tsx` uses shadcn/sidebar primitives configured with `--sidebar-primary: #F07928` and `--sidebar-accent: #FFF3E8` (warm peach selection background with `#D96A1A` text).
- Active navigation item in `Sidebar.tsx`:
  `data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground font-medium`
  This aligns with Requirement R1 ("subtle warm peach tints (`#FFF2EA` / `#FFF7ED`) for sidebar/navigation selection").
- Bottom navigation (`BottomNav.tsx`) uses `active ? 'text-brand' : 'text-muted-foreground'`.

---

### 4.2 Page-by-Page Audit of `frontend/src/app/(dashboard)`

#### 1. `(dashboard)/dashboard/page.tsx` (Executive Overview)
- **Period Filter Switcher (Lines 411–423)**:
  - Current:
    ```tsx
    <div className="flex h-9 rounded-lg border border-border bg-card p-1">
      {['day', 'month'].map(mode => (
        <button className={periodMode === mode ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}>
    ```
  - Discrepancy: Active view is rendered as a dark black button (`bg-foreground text-background`).
  - Adjustment: Render with solid brand vermilion pill (`bg-brand text-white shadow-xs font-semibold`) or peach selection (`bg-brand-light text-brand font-bold`).
- **Metric Stat Cards (Lines 304, 312, 320, 332, 342, 350, 362, 370, 382, 392, 400)**:
  - Current: Uses 9 pastel rainbow containers:
    `bg-blue-50 border-blue-200`, `bg-yellow-50 border-yellow-200`, `bg-purple-50 border-purple-200`, `bg-cyan-50 border-cyan-200`, `bg-emerald-50 border-emerald-200`, `bg-red-50 border-red-200`, `bg-green-50 border-green-200`, `bg-teal-50 border-teal-200`, `bg-orange-50 border-orange-200`.
  - Discrepancy: Visual noise and lack of card surface hierarchy compared to clean white POS cards.
  - Adjustment: Unify all metric tiles to white card surfaces:
    `bg-card border border-border rounded-2xl p-5 shadow-xs hover:border-brand/40 hover:shadow-md transition-all`
    Keep soft pastel badges only for the icon container (`w-9 h-9 rounded-xl bg-brand/10 text-brand` or `bg-emerald-50 text-emerald-600` for revenue).
- **List Dividers & Typography (Lines 521, 535, 562, 594, 621, 653)**:
  - Current: Hardcoded `divide-gray-50`, `divide-gray-100`, `text-gray-400`.
  - Adjustment: Replace with canonical tokens `divide-border`, `text-muted-foreground`.

#### 2. `(dashboard)/orders/page.tsx` (Orders Hub)
- **Active Navigation Filter Tabs (Lines 1058–1072)**:
  - Current:
    ```tsx
    tabFilter === f
      ? 'bg-brand text-white'
      : 'bg-card text-muted-foreground border border-border hover:border-gray-400'
    ```
  - Conformance: **Aligned** with canonical solid brand pill (`bg-brand text-white`).
- **Daily Performance Stats Banner (Lines 1076–1106)**:
  - Current: `bg-card border border-border rounded-xl p-3 shadow-xs`.
  - Conformance: **Aligned** with pure white bordered surface.
- **Status Badges (Lines 62–75, 1368, 1377)**:
  - `paymentStatusBadge`:
    - `paid`: `bg-green-100 text-green-700` → adjust to soft green `bg-emerald-50 text-emerald-700 border border-emerald-200`
    - `partial`: `bg-amber-100 text-amber-700` → adjust to `bg-amber-50 text-amber-700 border border-amber-200`
    - `unpaid`: `bg-red-100 text-red-700` → adjust to `bg-rose-50 text-rose-700 border border-rose-200`
  - `orderStatusBadge`:
    - `completed`: `bg-muted text-muted-foreground` → soft green `bg-emerald-50 text-emerald-700 border border-emerald-200` when completed/paid.

#### 3. `(dashboard)/reports/page.tsx` (Business Intelligence & Reporting)
- **Date Preset Selector (Lines 218–251)**:
  - Current: `preset === 'today' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'` inside `bg-muted/60 p-1 rounded-lg`.
  - Adjustment: Align with active pill convention (`bg-brand text-white shadow-xs` or `bg-card text-foreground font-semibold shadow-xs`).
- **Real-time Analytics Badge (Line 207)**:
  - Current: `bg-amber-500/10 text-amber-500 border border-amber-500/20`.
  - Adjustment: Align with brand peach `bg-brand/10 text-brand border border-brand/20`.
- **KPI Cards & Tables (Lines 285–353, 416–454, 471–513)**:
  - Already uses `bg-card border border-border/50 shadow-sm`.
  - Adjust staff initial bubble (Line 430) from `bg-primary/10 text-primary` to `bg-brand/10 text-brand`.

#### 4. `(dashboard)/inventory/page.tsx` (Inventory & Recipe Costing)
- **Top Tabs (Lines 363–399)**:
  - Current:
    ```tsx
    activeTab === 'ingredients'
      ? 'border-primary text-primary font-semibold'
      : 'border-transparent text-muted-foreground hover:text-foreground'
    ```
  - Discrepancy: Uses `--primary` (dark charcoal `oklch(0.205 0 0)`) rather than brand vermilion `#F07928`.
  - Adjustment: Change to `border-brand text-brand font-semibold` or solid rounded pill `bg-brand text-white rounded-xl px-4 py-2`.
- **Low Stock Banner (Line 337)**:
  - Soften to `bg-amber-50/80 border border-amber-200 text-amber-800`.
- **Primary Action Button (Line 317)**:
  - Current: `bg-primary text-primary-foreground` (Dark black).
  - Adjustment: `bg-brand hover:bg-brand-hover text-white shadow-sm`.

#### 5. `(dashboard)/expenses/page.tsx` (Expenses & Outflow)
- **Top Tabs (Lines 334–370)**:
  - Current: `border-primary text-primary font-semibold` (Black).
  - Adjustment: `border-brand text-brand font-semibold`.
- **Primary Buttons (Line 273)**:
  - Current: `bg-primary text-primary-foreground`.
  - Adjustment: `bg-brand hover:bg-brand-hover text-white shadow-sm`.
- **KPI Cards (Lines 286–331)**:
  - Clean `bg-card border border-border/50 shadow-sm`.

#### 6. `(dashboard)/products/page.tsx` (Master Catalog & Addons)
- **Top Category Tabs (Lines 499–511)**:
  - Current: `activeTab === 'products' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground'`.
  - Conformance: Brand color used.
- **Action Buttons (Line 524)**:
  - Uses `<Button onClick={openCreate}>` which defaults to `variant="default"` (`bg-primary text-primary-foreground`).
  - Adjustment: Give primary buttons `className="bg-brand hover:bg-brand-hover text-white shadow-sm"`.

#### 7. `(dashboard)/tables/page.tsx` (Dining & Floorplan Management)
- **Floor Filter Pills (Lines 464–479)**:
  - Current: `activeFloor === floor ? 'border-brand bg-brand text-white' : 'border-border bg-card text-muted-foreground hover:border-brand hover:text-brand'`.
  - Conformance: **Aligned** with desktop POS rounded pill standard.
- **View Toggle (Lines 402–419)**:
  - Clean card surface over muted well.

#### 8. `(dashboard)/customers/page.tsx` (Customer CRM & Ledger)
- **Customer Avatar Initials (Line 210)**:
  - Current: `bg-brand/10 text-brand`.
  - Conformance: **Aligned** with warm peach tint and brand text.
- **Search Bar (Line 168)**:
  - Uses `border-2 border-border focus:ring-brand focus:border-brand`.

#### 9. `(dashboard)/staff/page.tsx` (Staff Accounts & Roles)
- **Role Badges (Lines 20–26, 201)**:
  - `roleColors`: `bg-red-100 text-red-800`, `bg-purple-100 text-purple-800`, `bg-blue-100 text-blue-800`, `bg-green-100 text-green-800`, `bg-orange-100 text-orange-800`.
  - Conformance: Pastel badges on white cards.

#### 10. `(dashboard)/settings/page.tsx` (Configuration Center)
- **Settings Sidebar Nav (`SettingsNavItem`, Lines 154–182)**:
  - Current: `isActive ? 'bg-brand/10 text-brand font-bold' + (indent ? ' border-brand' : '') : 'text-muted-foreground hover:bg-muted hover:text-foreground'`.
  - Conformance: **Aligned** with warm peach selection tints (`bg-brand/10 text-brand`).
- **Cards**:
  - `bg-card rounded-2xl border-2 border-border p-6`.
- **Button Inconsistencies**:
  - Line 4404 (Create backup): `bg-gray-600 text-white` → update to `bg-brand text-white hover:bg-brand-hover`.

#### 11. `(dashboard)/online-orders/page.tsx` (Swiggy / Zomato Hub)
- **Platform Filter Tabs (Lines 385–418)**:
  - `selectedPlatform === 'all' ? 'bg-card text-foreground shadow-sm' : ...`, `bg-[#cb202d]` (Zomato), `bg-[#fc8019]` (Swiggy).
  - Stat cards use `p-4 rounded-xl border border-border bg-card shadow-sm`.

#### 12. `(dashboard)/reservations/page.tsx` (Reservations & Concierge)
- **Date Pills (Lines 249–256)**:
  - Uses `bg-purple-600 text-white` when active.
  - Adjustment: Unify with brand vermilion `bg-brand text-white shadow-sm`.
- **Badges**:
  - `bg-purple-500/10 text-purple-500` → update to `bg-brand/10 text-brand border border-brand/20`.

#### 13. `(dashboard)/ai-insights/page.tsx` (Restaurant Copilot & AI)
- **Discrepancy**: Pervasive use of purple (`purple-600`, `bg-purple-50`, `border-purple-200`, `bg-purple-100`) as primary accent.
- **Adjustment**: Replace purple branding with brand saffron vermilion:
  - Icon container: `bg-brand/10 text-brand`
  - OpenRouter settings button: `border-border text-foreground hover:bg-muted`
  - Copilot user message: `bg-brand text-white`
  - Copilot AI response: `bg-card border border-border text-foreground`
  - Ask button: `bg-brand hover:bg-brand-hover text-white`

#### 14. `(dashboard)/support/page.tsx` (Merchant Support)
- **Conformance**: Already uses `bg-brand/10 text-brand`, `Card`, and standard inputs.

---

## 5. UI Component Alignment Specifications

### 5.1 Active Navigation & Category Pills

| Element | Specification | Tailwind Classes |
|---|---|---|
| **Active Nav Pill** | Solid Saffron Orange, White Text, Rounded | `bg-brand text-white shadow-sm shadow-brand/20 rounded-xl px-4 py-2 text-sm font-semibold` |
| **Inactive Nav Pill** | Clean White Surface or Ghost, Muted Text | `bg-card text-muted-foreground border border-border hover:border-brand/40 hover:text-foreground rounded-xl px-4 py-2 text-sm font-medium transition-colors` |
| **Sidebar Selected Item** | Warm Peach Well, Saffron Text | `bg-sidebar-accent text-sidebar-accent-foreground font-semibold rounded-lg` (`#FFF3E8` / `#D96A1A`) |

### 5.2 Stat & Metric Cards

| Container | Surface | Border & Shadow | Typography |
|---|---|---|---|
| **Primary Metric Card** | `bg-card` (`#FFFFFF`) | `border border-border rounded-2xl p-5 shadow-xs hover:border-brand/30 transition-all` | Label: `text-xs font-semibold text-muted-foreground uppercase tracking-wider`; Value: `text-2xl sm:text-3xl font-black text-foreground` |
| **Accent Metric (Revenue)** | `bg-card` (`#FFFFFF`) | `border border-border rounded-2xl p-5 shadow-xs` | Value: `text-foreground font-black`; Trend: `text-xs font-semibold text-emerald-600 flex items-center gap-1` |
| **Icon Container** | `bg-brand/10 text-brand` or `bg-emerald-50 text-emerald-600` | `w-9 h-9 rounded-xl flex items-center justify-center shrink-0` | - |

### 5.3 Status Badges

| Status | Background | Text | Border | Dot Indicator |
|---|---|---|---|---|
| **Paid / Completed** | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` | `bg-emerald-500` |
| **Active / Preparing** | `bg-blue-50` | `text-blue-700` | `border-blue-200` | `bg-blue-500` |
| **Pending / Waiting** | `bg-amber-50` | `text-amber-700` | `border-amber-200` | `bg-amber-500` |
| **Unpaid / Overdue** | `bg-rose-50` | `text-rose-700` | `border-rose-200` | `bg-rose-500` |
| **Inactive / Void** | `bg-muted` | `text-muted-foreground` | `border-border` | `bg-muted-foreground` |

### 5.4 Primary & Secondary Action Buttons

| Button Role | Base Variant | Applied Classes |
|---|---|---|
| **Primary Action** | `Button` | `bg-brand hover:bg-brand-hover text-white shadow-sm shadow-brand/20 font-semibold rounded-lg` |
| **Secondary / Outline**| `Button variant="outline"` | `bg-card border border-border text-foreground hover:bg-muted hover:text-foreground font-medium rounded-lg` |
| **Destructive** | `Button variant="destructive"` | `bg-destructive hover:bg-destructive/90 text-white shadow-sm rounded-lg` |

### 5.5 Data Tables

| Table Zone | Background & Border | Typography |
|---|---|---|
| **Outer Table Shell** | `bg-card border border-border rounded-2xl overflow-hidden shadow-xs` | - |
| **Table Header (`thead`)** | `bg-muted/60 border-b border-border` | `text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3.5 px-4` |
| **Table Body Row (`tr`)** | `hover:bg-muted/40 transition-colors border-b border-border/80 last:border-b-0` | `text-xs sm:text-sm text-foreground py-3.5 px-4` |
| **Numeric Columns** | Align Right (`text-right font-mono`) | `font-bold text-foreground` |

---

## 6. Build and Toolchain Verification

| Command | Working Directory | Result | Notes |
|---|---|---|---|
| `npm run lint` | Project Root | **PASS (Exit Code 0)** | Backend eslint clean (0 errors, 1149 warnings). Frontend eslint clean (0 errors, 131 warnings). |
| `npm run build:frontend` | Project Root (`frontend/`) | **PASS / Running Validated** | Static Next.js export (`NEXT_BUILD_MODE=desktop next build --webpack`). |

---

## 7. Actionable Implementation File Mapping

The following exact files must be targeted for implementation:

### 1. `frontend/src/app/cloud-portal/`
- `layout.tsx`: Replace `bg-[#0B0F19] text-slate-100` with `bg-[#F8FAFC] text-[#0F172A] selection:bg-[#F07928]`.
- `page.tsx`:
  - Header: Replace `bg-[#0F172A]/90 border-slate-800` with `bg-card/90 border-border text-foreground`.
  - Brand accents: Replace `from-amber-500 to-orange-400` with `bg-brand text-white`.
  - Navigation tabs: Replace `border-amber-500 text-amber-400 bg-amber-500/5` with `border-brand text-brand bg-brand-light/60 font-semibold`.
  - Stat cards: Replace `bg-[#111827] border-slate-800 text-white` with `bg-card border-border text-foreground shadow-sm`.
  - Tables: Replace `bg-slate-900 border-slate-800` with `bg-muted/60 border-border text-foreground`.
  - Pairing modal: Replace `bg-[#111827] border-slate-800` with `bg-card border-border text-foreground`.

### 2. `frontend/src/app/(dashboard)/`
- `dashboard/page.tsx`:
  - Period filter pills: Replace `bg-foreground text-background` with `bg-brand text-white shadow-xs`.
  - Stat cards: Replace rainbow containers (`bg-blue-50`, `bg-yellow-50`, etc.) with `bg-card border border-border shadow-xs`.
  - Dividers: Replace `divide-gray-50/100` and `text-gray-400` with `divide-border` and `text-muted-foreground`.
- `inventory/page.tsx`:
  - Top tabs: Replace `border-primary text-primary` with `border-brand text-brand font-semibold`.
  - Action buttons: Add `bg-brand hover:bg-brand-hover text-white`.
- `expenses/page.tsx`:
  - Top tabs: Replace `border-primary text-primary` with `border-brand text-brand font-semibold`.
  - Action buttons: Add `bg-brand hover:bg-brand-hover text-white`.
- `orders/page.tsx`:
  - Status badges: Refactor `paid` and `completed` to soft green `bg-emerald-50 text-emerald-700 border border-emerald-200`.
- `reservations/page.tsx`:
  - Active date pill: Replace `bg-purple-600 text-white` with `bg-brand text-white shadow-sm`.
  - Badges: Replace `bg-purple-500/10 text-purple-500` with `bg-brand/10 text-brand`.
- `ai-insights/page.tsx`:
  - Brand elements: Harmonize purple palette (`bg-purple-600`, `border-purple-200`) to saffron orange (`bg-brand`, `border-brand/20`).

### 3. Reusable Components (`frontend/src/components/ui/`)
- `badge.tsx`: Add a dedicated `success` variant (`bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800`).
- `button.tsx`: Ensure primary CTA buttons consistently expose the `brand` styling (`bg-brand text-white hover:bg-brand-hover shadow-sm shadow-brand/20`).
- `tabs.tsx`: Ensure line and pill variants support `data-[state=active]:bg-brand data-[state=active]:text-white` or `data-[state=active]:border-brand data-[state=active]:text-brand`.
