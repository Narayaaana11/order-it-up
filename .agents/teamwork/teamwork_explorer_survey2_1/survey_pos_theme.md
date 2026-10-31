# Desktop POS Light Theme Visual Identity & Token Survey

**Target Codebase:** `frontend/src/`  
**Author:** Explorer 1 (`teamwork_explorer_survey2_1`)  
**Date:** 2026-10-30  
**Status:** COMPLETED & VERIFIED  

---

## Executive Summary

Order It Up's desktop POS application features a crisp, modern, light-theme visual identity. It is built on **Tailwind CSS v4** (`@tailwindcss/postcss`, `shadcn/tailwind.css`) with **Geist** typography, an **OKLCH base color system**, and a signature **Warm Saffron Orange / Vermilion brand palette** anchored at `#F07928`. 

Surfaces are clean and layered: pure white (`#FFFFFF`) card surfaces sit on top of subtle neutral backgrounds (`bg-background`, `bg-muted/20`, or `#F8FAFC`/`#F9FAFB`), framed by hairline neutral borders (`border-border` / `border-border/60` / `#E2E8F0`/`#E4E4E7`). Active navigation elements and primary calls-to-action utilize solid reddish-orange rounded pills with white text (`bg-brand text-white`), paired with warm peach tints (`#FFF3E8` / `bg-brand-light` / `--sidebar-accent`) for selected navigation items, category indicators, and highlight containers.

This survey establishes the canonical light theme design tokens, utility classes, and UI component conventions across `frontend/src/` to serve as the single source of truth for standardizing the public landing site (`landing/`) and the cloud admin portal (`frontend/src/app/(dashboard)` & `frontend/src/app/cloud-portal`).

---

## 1. Architecture, Tailwind Configuration & CSS Variables

### 1.1 Tailwind CSS v4 Inline Theme Configuration

Order It Up uses Tailwind CSS v4 in `frontend/src/app/globals.css`. Configuration is declared directly in CSS using `@theme inline`:

```css
/* frontend/src/app/globals.css (lines 281-330) */
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);   /* 8px */
  --radius-md: calc(var(--radius) - 2px);   /* 10px */
  --radius-lg: var(--radius);               /* 12px / 0.75rem */
  --radius-xl: calc(var(--radius) + 4px);   /* 16px */
  --radius-2xl: calc(var(--radius) + 8px);  /* 20px */
  --radius-3xl: calc(var(--radius) + 12px); /* 24px */
  --radius-4xl: calc(var(--radius) + 16px); /* 28px */

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* Brand colors — Saffron Orange palette */
  --color-brand: #F07928;
  --color-brand-light: #FFF3E8;
  --color-brand-hover: #D96A1A;
  --color-brand-ring: #F0792840;
  --color-success: #00cc61;
  --color-success-light: #dcfce7;
  --color-success-hover: #00b355;
}
```

### 1.2 Root CSS Variables (`:root`) — Light Theme

```css
/* frontend/src/app/globals.css (lines 7-48) */
:root {
  --font-sans: "Geist", system-ui, sans-serif;
  --font-mono: "Geist Mono", monospace;
  --radius: 0.75rem;

  --background: oklch(1 0 0);          /* #FFFFFF Pure White */
  --foreground: oklch(0.145 0 0);      /* #18181B / #0F172A Crisp Dark Slate */
  --card: oklch(1 0 0);                /* #FFFFFF White Card Surface */
  --card-foreground: oklch(0.145 0 0); /* #18181B Dark Text */
  --popover: oklch(1 0 0);             /* #FFFFFF */
  --popover-foreground: oklch(0.145 0 0);

  --primary: oklch(0.205 0 0);         /* Deep Charcoal/Slate */
  --primary-foreground: oklch(0.985 0 0); /* Pure White */

  --secondary: oklch(0.97 0 0);        /* #F4F4F5 / Light Gray */
  --secondary-foreground: oklch(0.205 0 0);

  --muted: oklch(0.97 0 0);            /* #F4F4F5 / #F8FAFC */
  --muted-foreground: oklch(0.556 0 0); /* #71717A / #64748B Secondary Gray */

  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);

  --destructive: oklch(0.577 0.245 27.325); /* Crimson Red */
  --border: oklch(0.922 0 0);          /* #E4E4E7 / #E2E8F0 Subtle Neutral Border */
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Sidebar Tokens */
  --sidebar: oklch(0.985 0 0);         /* #FAFAFA / #F8FAFC Soft Off-White */
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: #F07928;          /* Brand Vermilion */
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: #FFF3E8;           /* Warm Peach Selection Background */
  --sidebar-accent-foreground: #D96A1A;/* Warm Deep Vermilion Selection Text */
  --sidebar-border: oklch(0.922 0 0);  /* Hairline Neutral Border */
  --sidebar-ring: #F07928;

  --flo-titlebar-height: 40px;
}
```

---

## 2. Canonical Color Codes & Tailwind Utility Mapping

The following matrix maps the POS application's canonical light palette to exact hex codes, Tailwind classes, and UI contexts:

| Design Role | Canonical Hex | Tailwind Utility Class | Concrete Context & Examples |
|---|---|---|---|
| **App Canvas / Page Background** | `#F8FAFC` (slate-50) / `#F9FAFB` (gray-50) / `oklch(1 0 0)` | `bg-background`, `bg-muted/20`, `bg-slate-50` | POS product grid backdrop (`ProductGrid.tsx:117`), dashboard canvas, app viewport |
| **Card / Container Surfaces** | `#FFFFFF` | `bg-card`, `bg-white` | Product cards (`ProductGrid.tsx:132`), Cart panel (`CartPanel.tsx:72`), Metric cards (`OrdersPage.tsx:1077`, `reports/page.tsx:285`), Modals (`TablePickerModal.tsx:56`, `PaymentModal.tsx:468`) |
| **Borders & Dividers** | `#E2E8F0` (slate-200) / `#E4E4E7` (zinc-200) / `oklch(0.922 0 0)` | `border-border`, `border-border/60`, `border-border/50`, `divide-border` | Card borders, topbar separator (`PosTopbar.tsx:39`), table row dividers (`customers/page.tsx:203`), inputs |
| **Primary Brand Accent (Vermilion)** | `#F07928` | `bg-brand`, `text-brand`, `border-brand` | Active category pill (`ProductGrid.tsx:85`), table selection (`PosTopbar.tsx:74`), price tags (`ProductGrid.tsx:188`), total due (`PaymentModal.tsx:678`), active payment pill (`PaymentModal.tsx:665`) |
| **Brand Hover / Active** | `#D96A1A` | `hover:bg-brand-hover`, `active:bg-brand-hover` | Primary button hover (`pos/page.tsx:1112`, `CustomerSearch.tsx:314`) |
| **Warm Peach Tint (Selection)** | `#FFF3E8` / `#FFF7ED` / `#FFF2EA` | `bg-brand-light`, `bg-brand/10`, `bg-sidebar-accent` | Active sidebar nav items (`sidebar.tsx:603`), selected table in modal (`TablePickerModal.tsx:78`), selected addons (`AddonModal.tsx:214`), customer highlight (`tables/page.tsx:121`) |
| **Primary Text** | `#0F172A` (slate-900) / `#18181B` (zinc-900) / `oklch(0.145 0 0)` | `text-foreground` | Product names, page titles, table headers, invoice totals, metrics |
| **Secondary / Muted Text** | `#64748B` (slate-500) / `#71717A` (zinc-500) / `oklch(0.556 0 0)` | `text-muted-foreground` | Timestamps, subtitle captions, metric labels, placeholder hints, order notes |
| **Tertiary / Subdued Text** | `#94A3B8` (slate-400) / `#A1A1AA` (zinc-400) | `text-gray-400` / `text-slate-400` | Counter hints (`cart.orderNotes.length/200`), search icons, inactive icons |
| **Status Badge: Paid / Completed** | `#DCFCE7` (bg) / `#15803D` (text) | `bg-green-100 text-green-700` | Paid bill badge (`TableCheckoutModal.tsx:177`, `orders/page.tsx:72`), vegetarian tag (`DietaryBadge.tsx:27`) |
| **Status Badge: Active / Fresh** | `#ECFDF5` (bg) / `#047857` (text) | `bg-emerald-100 text-emerald-700` | Fresh turnover badge (`table-timing.ts:20`), vegan tag (`DietaryBadge.tsx:28`), gross revenue indicators |
| **Status Badge: Unpaid / Balance Due** | `#FFEDD5` (bg) / `#C2410C` (text) | `bg-orange-100 text-orange-700` | Unpaid order badge (`orders/page.tsx:74`), balance due callout (`TableCheckoutModal.tsx:230`) |
| **Status Badge: Pending / Reserved** | `#FEF3C7` (bg) / `#B45309` (text) | `bg-yellow-100 text-yellow-700` / `bg-amber-100 text-amber-700` | Pending order (`orders/page.tsx:63`), partial payment badge, reserved table badge (`TablePickerModal.tsx:25`) |
| **Status Badge: Kitchen / Active / Dining** | `#DBEAFE` (bg) / `#1D4ED8` (text) | `bg-blue-100 text-blue-700` | Active kitchen order (`orders/page.tsx:64`), held order badge (`orders/page.tsx:1225`), visits count pill (`customers/page.tsx:235`) |
| **Status Badge: Void / Cancelled / Error** | `#FEE2E2` (bg) / `#B91C1C` (text) | `bg-red-100 text-red-700` | Cancelled order (`orders/page.tsx:68`), out of stock badge (`ProductGrid.tsx:137`), non-veg tag (`DietaryBadge.tsx:30`) |
| **Specialty / Loyalty Points** | `#F3E8FF` (bg) / `#7E22CE` (text) | `bg-purple-50 text-purple-700` | Customer loyalty wallet badge (`customers/page.tsx:242`), discount box (`PaymentModal.tsx:579`) |

---

## 3. Concrete POS UI Component Patterns

### 3.1 Navigation & Category Pills

The POS uses two complementary pill patterns:
1. **Solid Vermilion Pill (`bg-brand text-white`)**: Used for the primary active state in category selectors and view mode toggles.
   - Example in `ProductGrid.tsx:82-90`:
     ```tsx
     <button
       onClick={() => setSelectedCategory(null)}
       className={cn(
         "w-full px-3 py-3 rounded-xl text-sm font-semibold transition-all text-start leading-tight",
         !selectedCategory 
           ? "bg-brand text-white shadow-md shadow-brand/20" 
           : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
       )}
     >
       {t('allCategories')}
     </button>
     ```
   - Example in `OrdersPage.tsx:1063-1070`:
     ```tsx
     <button
       className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
         tabFilter === f
           ? 'bg-brand text-white'
           : 'bg-card text-muted-foreground border border-border hover:border-gray-400'
       }`}
     >
       {tOrders(tabLabelKey[f])}
     </button>
     ```

2. **Peach Tint Pill (`bg-sidebar-accent` / `bg-brand-light`)**: Used for persistent sidebar navigation item selection and secondary highlights.
   - Declared in `frontend/src/components/ui/sidebar.tsx:603`:
     ```css
     data-[active=true]:bg-sidebar-accent 
     data-[active=true]:font-medium 
     data-[active=true]:text-sidebar-accent-foreground
     ```
     Where `--sidebar-accent` = `#FFF3E8` and `--sidebar-accent-foreground` = `#D96A1A`.
   - Settings nav items in `settings/page.tsx:173`:
     ```tsx
     isActive
       ? 'bg-brand/10 text-brand font-bold' + (indent ? ' border-brand' : '')
       : 'text-muted-foreground hover:bg-muted hover:text-foreground'
     ```

### 3.2 Product Cards & Interactive Tiles

Product cards and catalog items in the POS light theme follow a distinctive tactile card standard:
- **Card surface:** Pure white `bg-card` with 16px corner radius (`rounded-2xl`).
- **Border:** Subtle hairline border `border border-border/60` (or `border-border/50`).
- **Interactive transitions:** `hover:border-brand/40 active:border-brand active:bg-brand/5 active:scale-[0.98] hover:shadow-lg hover:shadow-brand/5 transition-all`.
- **Price typography:** `text-brand font-bold text-base`.
- **Top-right badge / quantity indicator:** Solid vermilion quarter-circle badge: `absolute top-0 end-0 bg-brand text-white text-xs w-7 h-7 rounded-es-2xl flex items-center justify-center font-bold`.
- **Touch target discipline:** All interactive items adhere to `.touch-target` (minimum 44x44px hit-box).

### 3.3 Buttons & Interactive Controls

Component source: `frontend/src/components/ui/button.tsx`
- **Primary Action Button:**
  ```tsx
  <Button size="lg" className="bg-brand text-white hover:bg-brand-hover active:bg-brand-hover shadow-sm">
    Place Order
  </Button>
  ```
  Sizes:
  - `default`: `h-11 px-5 py-2 rounded-md text-sm font-medium`
  - `sm`: `h-9 rounded-md px-4 text-xs font-medium`
  - `lg`: `h-14 rounded-xl px-8 text-base font-semibold`
  - `icon`: `size-11` (or `icon-sm`: `size-9`, `icon-lg`: `size-14 rounded-xl`)
- **Secondary / Outline Button:**
  `border border-border bg-card shadow-xs hover:bg-accent hover:text-accent-foreground`
- **Ghost / Subtle Button:**
  `hover:bg-accent hover:text-accent-foreground text-muted-foreground`
- **Destructive Button:**
  `bg-destructive text-white hover:bg-destructive/90` or `text-red-600 hover:text-red-700 hover:bg-red-50`

### 3.4 Stat Cards & Metric Containers

Seen in `OrdersPage.tsx:1075-1106`, `reports/page.tsx:283-350`, and `dashboard/page.tsx:486-505`:
- **Card container:**
  ```tsx
  <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs relative overflow-hidden group hover:border-primary/40 transition-all">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Day Revenue</span>
      <div className="p-2 rounded-xl bg-brand/10 text-brand">
        <DollarSign className="w-5 h-5" />
      </div>
    </div>
    <div className="mt-3">
      <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">₹48,250.00</div>
      <div className="text-xs text-muted-foreground mt-1">Gross Invoiced</div>
    </div>
  </div>
  ```

### 3.5 Data Tables

Standardized in `frontend/src/components/ui/table.tsx` and demonstrated in `OrdersPage.tsx:1284-1360`, `customers/page.tsx:179-260`, and `products/page.tsx:530-580`:
- **Table container:**
  `border border-border rounded-xl bg-card shadow-xs overflow-hidden`
- **Header row:**
  `border-b border-border bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider`
- **Header cells (`<th>`):**
  `py-3.5 px-4 text-start font-medium`
- **Table body dividers:**
  `divide-y divide-border`
- **Body rows (`<tr>`):**
  `hover:bg-muted/40 transition-colors`
- **Data cells (`<td>`):**
  `py-3 px-4 text-sm text-foreground`

### 3.6 Form Inputs, Selects & Date Pickers

- Standard single-line input (`input.tsx` and `PosTopbar.tsx:96`, `OrdersPage.tsx:1134`):
  `w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all h-10`
- Search bar with icon:
  `relative w-full max-w-sm` with `<Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />` and `ps-9 pe-4`.

### 3.7 Touch Number Pad (`TouchNumberPad.tsx`)

- Pad container: `rounded-xl border border-border bg-muted/40 p-2`
- Numeric keys: `touch-target rounded-lg border border-border bg-card text-lg font-bold tabular-nums text-foreground transition-colors active:bg-muted`
- Action keys (Delete / Clear): `touch-target rounded-lg border border-border bg-card text-sm font-semibold text-muted-foreground transition-colors active:bg-muted`

---

## 4. Comparative Gap Analysis: Desktop POS vs Landing & Cloud Portal

| Area / Feature | Canonical Desktop POS Light Aesthetic | Current Landing (`landing/`) | Current Cloud Portal (`cloud-portal/`) | Action Required for Parity |
|---|---|---|---|---|
| **Root Palette** | Crisp light theme: `bg-background` (`oklch(1 0 0)`), `--foreground` (`oklch(0.145 0 0)`), `--border` (`oklch(0.922 0 0)`) | Hardcoded dark: `background-color: #09090B; color: #FAFAFA;` in `globals.css` | Hardcoded dark: `bg-slate-950`, `bg-[#0F172A]`, `text-slate-100`, `border-slate-800` | Replace dark-only backgrounds with `#F8FAFC`/`#FFFFFF`, dark text `#0F172A`, and light borders `#E2E8F0` |
| **Card Surfaces** | Pure white `#FFFFFF` (`bg-card`), rounded-xl/2xl, subtle borders | Dark `#121215` / `#18181B` with border `#27272A` | Dark slate `#0F172A` / `#1E293B` with border `border-slate-800` | Switch cards to `bg-card` / `#FFFFFF` with `border-border` (`#E2E8F0`/`#E4E4E7`) |
| **Brand Accent** | Saffron Vermilion `#F07928` with hover `#D96A1A` | Declared `#F07928` in `@theme` but paired with dark glow/borders | Amber gradients (`from-amber-500 to-orange-400`, `text-amber-400`, `bg-amber-500/10`) | Standardize primary buttons, icons, highlights to solid `#F07928` with `#FFF3E8` / `#FFF7ED` tints |
| **Active Nav Pills** | Solid `#F07928` with white text, or `#FFF3E8` peach tint | Inverted dark nav items with orange hover | Inverted dark selects (`bg-slate-900 border-slate-800`) | Implement solid vermilion pills (`bg-brand text-white`) and warm peach tints (`bg-brand-light`) |
| **Status Badges** | Soft pastels: Soft green `#DCFCE7`/`#15803D`, Soft amber `#FEF3C7`/`#B45309`, Soft blue `#DBEAFE`/`#1D4ED8` | N/A | Dark badges: `bg-amber-500/10 text-amber-400 border-amber-500/20` | Align all badges to soft pastel backgrounds with high-contrast text |
| **Data Tables** | Clean bordered white cards with `bg-muted/60` headers, `divide-border`, `hover:bg-muted/40` | N/A (Marketing layout) | Dark tables with slate headers and borders | Align to standard POS table structure and styling |
| **Typography** | Geist Sans / Mono with crisp high contrast (`#0F172A` / `#64748B`) | Geist Sans with light-on-dark contrast | Default Next font with slate text | Standardize typography and heading/body contrast ratios |

---

## 5. Implementation Recommendations for Landing & Web Admin Portal

1. **In `landing/src/app/globals.css`:**
   - Remove `color-scheme: dark;` and hardcoded `body { background-color: #09090B; color: #FAFAFA; }`.
   - Configure `--background: #F8FAFC;` (or `#F9FAFB`), `--foreground: #0F172A;`, `--card: #FFFFFF;`, `--border: #E2E8F0;`, `--muted: #F1F5F9;`, `--muted-foreground: #64748B;`.
   - Retain brand colors `--color-brand: #F07928;`, `--color-brand-light: #FFF3E8;`, `--color-brand-hover: #D96A1A;`.
   - Update thermal receipt paper container to sit on the clean light canvas.

2. **In `landing/src/app/page.tsx` & components:**
   - Convert hero, feature cards, platform tabs, CTA blocks, and navigation header from `bg-slate-950`/`bg-slate-900` to pure white card surfaces (`bg-white`) and light slate backdrops (`bg-slate-50`).
   - Replace amber gradients (`from-amber-500 to-orange-400`) with canonical `#F07928` brand vermilion.
   - Use active navigation pills in `bg-brand text-white` with peach hover/selection tints (`#FFF3E8`).

3. **In `frontend/src/app/cloud-portal/page.tsx` & `frontend/src/app/(dashboard)`:**
   - Replace dark header (`bg-[#0F172A] border-slate-800 text-white`) with clean light header (`bg-card border-b border-border text-foreground`).
   - Replace dark select pickers (`bg-slate-900 border-slate-800 text-slate-200`) with POS standard inputs (`bg-card border-border text-foreground focus:ring-brand/20`).
   - Standardize franchise/branch metrics to match POS stat cards (`bg-card border border-border/50 rounded-2xl p-5`).
   - Update demo/simulation badges from dark amber to soft amber (`bg-amber-100 text-amber-800 border-amber-200`).
   - Update branch sales and item velocity tables to match the POS data table pattern.
