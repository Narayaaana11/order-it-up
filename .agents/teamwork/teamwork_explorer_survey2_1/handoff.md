# Handoff Report: Desktop POS Light Theme Visual Identity Survey

**Agent:** Explorer 1 (`teamwork_explorer_survey2_1`)  
**Parent Agent:** `eee03b4e-76cf-44b7-bbf2-e012731666be`  
**Handoff Type:** Hard (Task complete)  
**Deliverable Path:** `d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_1\survey_pos_theme.md`  

---

## 1. Observation

Direct code observations from the Order It Up frontend codebase (`frontend/src/`):

1. **Tailwind & Theme Setup (`frontend/src/app/globals.css:281-330`):**
   - Tailwind v4 is initialized with `@import "tailwindcss";` and `@theme inline`.
   - Core brand palette definition:
     ```css
     --color-brand: #F07928;
     --color-brand-light: #FFF3E8;
     --color-brand-hover: #D96A1A;
     --color-brand-ring: #F0792840;
     --color-success: #00cc61;
     --color-success-light: #dcfce7;
     --color-success-hover: #00b355;
     ```
2. **Light Theme Tokens (`frontend/src/app/globals.css:7-48`):**
   - `--font-sans`: `"Geist", system-ui, sans-serif`
   - `--font-mono`: `"Geist Mono", monospace`
   - `--radius`: `0.75rem` (12px)
   - `--background`: `oklch(1 0 0)` (Pure white / `#FFFFFF`)
   - `--foreground`: `oklch(0.145 0 0)` (Crisp dark slate / `#18181B`)
   - `--card`: `oklch(1 0 0)` (Pure white / `#FFFFFF`)
   - `--card-foreground`: `oklch(0.145 0 0)`
   - `--muted`: `oklch(0.97 0 0)` (`#F4F4F5` / `#F8FAFC`)
   - `--muted-foreground`: `oklch(0.556 0 0)` (Muted secondary gray / `#71717A` / `#64748B`)
   - `--border`: `oklch(0.922 0 0)` (Subtle neutral border / `#E4E4E7` / `#E2E8F0`)
   - Sidebar tokens:
     ```css
     --sidebar: oklch(0.985 0 0);
     --sidebar-foreground: oklch(0.145 0 0);
     --sidebar-primary: #F07928;
     --sidebar-accent: #FFF3E8;
     --sidebar-accent-foreground: #D96A1A;
     --sidebar-border: oklch(0.922 0 0);
     --sidebar-ring: #F07928;
     ```
3. **Sidebar Menu Item Selection (`frontend/src/components/ui/sidebar.tsx:603`):**
   - `data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground`
   - Yields `#FFF3E8` (warm peach tint) background with `#D96A1A` text.
4. **Category & Navigation Pills (`frontend/src/components/pos/ProductGrid.tsx:82-90`):**
   - Active: `bg-brand text-white shadow-md shadow-brand/20 rounded-xl px-3 py-3 text-sm font-semibold`
   - Inactive: `bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground`
5. **Product Cards (`frontend/src/components/pos/ProductGrid.tsx:132-151`):**
   - Container: `min-h-[140px] bg-card rounded-2xl p-3 border border-border/60 hover:border-brand/40 active:border-brand active:bg-brand/5 active:scale-[0.98] hover:shadow-lg hover:shadow-brand/5 transition-all`
   - Price: `text-brand font-bold text-base`
   - Cart Quantity badge: `bg-brand text-white text-xs w-7 h-7 rounded-es-2xl flex items-center justify-center font-bold`
6. **Payment Status & Badges (`frontend/src/app/(dashboard)/orders/page.tsx:71-75`, `frontend/src/components/pos/TableCheckoutModal.tsx:175-181`):**
   - Paid: `bg-green-100 text-green-700` (`#DCFCE7` / `#15803D`)
   - Unpaid / Balance due: `bg-orange-100 text-orange-700` (`#FFEDD5` / `#C2410C`)
   - Partially paid: `bg-amber-100 text-amber-700`
   - Dietary badges (`DietaryBadge.tsx:25-41`): veg `bg-green-100 text-green-700`, vegan `bg-emerald-100 text-emerald-700`, spicy `bg-orange-100 text-orange-700`, non-veg `bg-red-100 text-red-700`.
7. **Stat Cards & Metric Containers (`OrdersPage.tsx:1075-1106`, `reports/page.tsx:283-350`):**
   - Container: `bg-card border border-border/50 rounded-2xl p-5 shadow-xs relative overflow-hidden group hover:border-primary/40 transition-all`
   - Title: `text-xs font-medium uppercase tracking-wider text-muted-foreground`
   - Metric: `text-2xl sm:text-3xl font-black text-foreground mt-1 tracking-tight`
   - Icon badge: `p-2 rounded-xl bg-brand/10 text-brand` (or `bg-emerald-500/10 text-emerald-500`)
8. **Data Tables (`table.tsx`, `OrdersPage.tsx:1284-1360`, `customers/page.tsx:179-260`):**
   - Table container: `border border-border rounded-xl bg-card shadow-xs overflow-hidden`
   - Header: `border-b border-border bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider`
   - Dividers: `divide-y divide-border`
   - Rows: `hover:bg-muted/40 transition-colors`
9. **Discrepancy in `landing/src/app/globals.css:21-32` and `landing/src/app/page.tsx`:**
   - `landing/` is hardcoded to dark mode: `color-scheme: dark;` and `body { background-color: #09090B; color: #FAFAFA; }`, with dark card surfaces `#121215` and `#18181B`.
10. **Discrepancy in `frontend/src/app/cloud-portal/page.tsx:384-488`:**
    - `cloud-portal` uses dark slate headers (`bg-[#0F172A] border-slate-800 text-white`), dark inputs (`bg-slate-900 border-slate-800 text-slate-200`), and amber gradients (`from-amber-500 to-orange-400`).

---

## 2. Logic Chain

1. **Premise 1:** The user request specifies updating `landing/` and the web admin portal (`frontend/src/app/(dashboard)` & `frontend/src/app/cloud-portal`) to match the desktop POS light theme aesthetic.
2. **Premise 2:** As evidenced by `frontend/src/app/globals.css` and the core POS components (`ProductGrid.tsx`, `PosTopbar.tsx`, `CartPanel.tsx`, `PaymentModal.tsx`, `TablePickerModal.tsx`), the canonical desktop POS uses:
   - Base canvas: `#F8FAFC` / `#FFFFFF` / `bg-background`
   - Card surfaces: `#FFFFFF` (`bg-card`)
   - Hairline borders: `border-border` (`oklch(0.922 0 0)` / `#E2E8F0` / `#E4E4E7`)
   - Brand color: Warm saffron vermilion `#F07928` (`--color-brand`), with `#D96A1A` hover and `#F0792840` focus rings
   - Active navigation pills: Solid vermilion rounded pills (`bg-brand text-white`)
   - Navigation selection tints: Warm peach `#FFF3E8` (`--sidebar-accent`, `bg-brand-light`)
   - Text contrast: Dark slate primary `#0F172A` / `#18181B` (`text-foreground`) with secondary `#64748B` / `#71717A` (`text-muted-foreground`)
   - Status badges: Soft pastel backgrounds with dark text (e.g. `bg-green-100 text-green-700` for paid/completed)
3. **Premise 3:** Inspecting `landing/` and `cloud-portal/` reveals both currently diverge into dark-only styling (`#09090B`, `#0F172A`, `#18181B`).
4. **Conclusion:** All token mappings, exact Tailwind utility classes, component layouts, and transition behaviors have been extracted and documented in `survey_pos_theme.md` to guide the implementation agents in realigning `landing/` and `cloud-portal/`.

---

## 3. Caveats

1. **Dark Mode Support:** The desktop POS includes an optional dark mode toggle (stored in `localStorage` as `flo-theme-resolved` and toggled via `ThemeSync.tsx`), but the primary and default theme is the light theme aesthetic requested by the user. The survey specifically documents the light theme tokens as requested.
2. **KDS Standalone Window:** The standalone kitchen display (`/kds` and `/kds-standalone`) uses high-contrast kitchen status columns (amber/orange for waiting, blue for preparing, green for ready); its styling is specialized for kitchen hardware monitors and should not be confused with the customer/billing POS light theme.
3. **No Code Modifications:** As per explorer role instructions, no source code was altered during this investigation.

---

## 4. Conclusion

The canonical POS design tokens and component patterns have been fully cataloged and documented in:
`d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey2_1\survey_pos_theme.md`

Key canonical tokens for implementers:
- **Canvas / Background:** `#F8FAFC` (or `bg-background` / `bg-muted/20`)
- **Card Surfaces:** `#FFFFFF` (`bg-card`) with `border-border/50` or `border-border/60`
- **Brand Vermilion:** `#F07928` (`bg-brand`, `text-brand`, `border-brand`) with hover `#D96A1A` (`bg-brand-hover`)
- **Peach Selection Tint:** `#FFF3E8` (`bg-brand-light`, `--sidebar-accent`)
- **Primary Text:** `#0F172A` / `#18181B` (`text-foreground`)
- **Secondary Text:** `#64748B` / `#71717A` (`text-muted-foreground`)
- **Completed / Paid Badge:** Soft green `bg-green-100 text-green-700` (`#DCFCE7` / `#15803D`)
- **Unpaid / Pending Badge:** Soft orange `bg-orange-100 text-orange-700` (`#FFEDD5` / `#C2410C`)
- **Corner Radius Standards:** `rounded-xl` (12px) for cards/nav pills, `rounded-2xl` (16px) for modals and stat containers.

---

## 5. Verification Method

To verify these observations and conclusions independently:
1. **Inspect CSS Variables:**
   `view_file` on `frontend/src/app/globals.css` (lines 7-48 and lines 281-330).
2. **Inspect POS Component Implementations:**
   - `frontend/src/components/pos/ProductGrid.tsx` (lines 80-155) for active category pill and product card styling.
   - `frontend/src/components/layout/Sidebar.tsx` and `frontend/src/components/ui/sidebar.tsx` (line 603) for peach tint active state.
   - `frontend/src/components/pos/TableCheckoutModal.tsx` (lines 175-181) for soft green paid status badge.
   - `frontend/src/app/(dashboard)/orders/page.tsx` (lines 1040-1106, 1284-1360) for stat cards, tab filters, and data tables.
3. **Inspect Landing Discrepancy:**
   `view_file` on `landing/src/app/globals.css` (lines 20-33) to verify hardcoded dark mode `body { background-color: #09090B; }`.
