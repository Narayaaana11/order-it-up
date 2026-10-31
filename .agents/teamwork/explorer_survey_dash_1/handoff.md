# Handoff Report — Explorer 1 (Survey Phase)

**Task**: Thoroughly investigate the `landing/` directory structure, Next.js 16 configuration, App Router setup, static export requirements for Cloudflare Pages, existing dashboard patterns in `frontend/`, and role-based architecture.

---

## 1. Observation

1. **`landing/package.json`**:
   - `next`: `16.3.4` (lines 16)
   - `react`: `19.2.8` (lines 17)
   - `react-dom`: `19.2.8` (lines 18)
   - `tailwindcss`: `^4` with `@tailwindcss/postcss` (lines 22, 29)
   - `lucide-react`: `^1.40.0` (line 15)
   - `clsx`: `^2.1.1` and `tailwind-merge`: `^3.6.0` (lines 14, 19)

2. **`landing/next.config.ts`**:
   - Lines 3-12:
     ```typescript
     const nextConfig: NextConfig = {
       output: "export",
       trailingSlash: true,
       images: {
         unoptimized: true,
       },
       turbopack: {
         root: __dirname,
       },
     };
     ```
   - Build output generates static directory structure in `landing/out/` with `trailingSlash: true`.

3. **`landing/public/_headers`**:
   - Lines 4-9 configure Cloudflare Pages caching:
     ```http
     /*
       Cache-Control: public, max-age=0, must-revalidate

     /_next/static/*
       Cache-Control: public, max-age=31536000, immutable
     ```

4. **`landing/src/app/globals.css`**:
   - Uses Tailwind CSS v4 `@import "tailwindcss";` and `@theme` block.
   - Core palette tokens: `--color-brand: #F07928`, `--color-surface-canvas: #F8FAFC`, `--color-surface-card: #FFFFFF`, `--color-surface-border: #E2E8F0`, `--color-success: #00CC61`.

5. **`landing/src/app/dashboard/page.tsx`**:
   - Currently 919 lines. Implements a prototype with two views switched via `perspective`: `"merchant"` (Restaurant Chain Owner with 3 outlets: Downtown Bistro, Cyber Hub Express, Airport Terminal 3) and `"founder"` (Founder Platform Admin with tenant table, 16-character license generator `OIU-2026-WIN-8942-X7K9`, S3 storage telemetry).
   - Lacks dedicated, operational role views for Front Cashier, Kitchen Chef (KDS), Server/Waiter (Floor Map), Accountant (GST & Tally XML), and Delivery Driver (Dispatch & COD).

6. **Existing Codebase Patterns in `frontend/src/` & `landing/`**:
   - **Tally XML**: `frontend/src/app/cloud-portal/page.tsx:533-579` contains complete `downloadTallyXml` implementation generating standard Tally ERP 9 / Prime XML receipt vouchers with `Cash Counter Drawer`, `Digital / UPI Clearing Account`, and `Restaurant F&B Food Sales` ledgers.
   - **80mm Thermal Receipt**: `landing/src/components/BillTemplateModal.tsx` implements ESC/POS monospace receipt rendering with GST breakdown (CGST 2.5%, SGST 2.5%), SAC `996331`, FSSAI license `10019011000234`, and solenoid cash drawer kick formatting.
   - **Split Tenders & 24V Drawer**: `frontend/src/components/pos/PaymentModal.tsx` handles cash, card, and UPI QR split settlements with cash drawer pulse triggers.
   - **KDS Kanban & SLA Timers**: `frontend/src/components/kds/KdsKanbanBoard.tsx` contains Kanban columns for `pending`, `preparing`, `ready`, and `served`, with station filtering and color-coded SLA timers.
   - **Table Floor Map**: `frontend/src/app/(dashboard)/tables/page.tsx` manages rooms (Indoor, Patio, Rooftop), table occupancy states (`available`, `occupied`, `reserved`, `cleaning`, `held`), and turnover duration timers.
   - **Online & Delivery Dispatch**: `frontend/src/app/(dashboard)/online-orders/page.tsx` implements rider dispatch queues, customer address verification, and COD tally.

7. **Local Service Topology**:
   - `dev-server.js:142-146`: Main API runs on `:3001` (`/api/health`), KDS on `:3002`, Server App on `:3003`.
   - `main/kds-server.ts:24`: Standalone KDS HTTP & WebSocket on `:3002`.
   - `main/server-app.ts:23`: Standalone Server App on `:3003`.

8. **Build and Lint Verification**:
   - Command: `npm --prefix landing run lint` -> Exited with code 0 (clean, no errors or warnings).
   - Command: `npm --prefix landing run build` -> Exited with code 0. Compiled successfully with Turbopack in 1566ms, generated static pages in `landing/out/`.

---

## 2. Logic Chain

1. **Static Export Constraint**:
   - Based on Observation 2 (`next.config.ts` specifying `output: "export"`), Next.js 16 compiles all routes during build into static files.
   - Any dynamic route parameter (`[param]`) would require `generateStaticParams()` at build time.
   - Calling `useSearchParams()` directly in a page without a `<Suspense>` boundary causes static generation to fail.
   - Therefore, the most robust architecture for Cloudflare Pages is a unified master coordinator at `landing/src/app/dashboard/page.tsx` (wrapped in `<Suspense>`) that handles query-string role switching (`?role=...`), coupled with explicit static sub-routes (`/dashboard/cashier/page.tsx`, `/dashboard/kitchen/page.tsx`, etc.) to provide canonical index files in `landing/out/dashboard/*/index.html`.

2. **Hybrid Offline & Live Backend Operation**:
   - Observation 7 proves that local background servers run on `:3001` (Main Express POS), `:3002` (KDS), and `:3003` (Waiter Server App).
   - When deployed statically on Cloudflare Pages over HTTPS, the browser client cannot rely on local servers existing, and direct fetches to `http://localhost:...` will either be blocked (Mixed Content) or fail if the desktop app is not running.
   - Therefore, the dashboard state must be self-contained by default with realistic interconnected mock models (R3), while a non-blocking probe hook detects local backend availability when running in a local environment.

3. **Design System Consistency**:
   - Observation 4 details the Tailwind CSS v4 design tokens in `landing/src/app/globals.css`.
   - All role views must use `#F8FAFC` background, white cards with `border-slate-200/80`, `#F07928` brand accents, and Geist typography to match the rest of the landing page seamlessly.

---

## 3. Caveats

1. **Browser Mixed-Content Policy**:
   - When hosted on an `https://...` Cloudflare Pages domain, connecting to `http://localhost:3001` will be blocked by modern browser Mixed Content security unless the local server is exposed via HTTPS or proxy. The standalone interactive simulator must always be the active default so the production Cloudflare Pages deployment remains 100% functional.
2. **Bundle Size**:
   - Inlining realistic demo data for 6 personas and 3 outlets must be organized in dedicated data files (`landing/src/lib/dashboard-store.ts`) rather than duplicating mock data across multiple components.

---

## 4. Conclusion

1. The `landing/` app is fully healthy, builds without errors, and is perfectly positioned for role-based dashboard expansion.
2. The recommended routing and mounting structure is:
   - Root `/dashboard` coordinator with `<Suspense>` boundary and 8-tab Role & Perspective Bar.
   - 6 Operational Persona Views: Owner/Manager, Cashier, Kitchen Chef, Server/Waiter, Accountant, Delivery Driver.
   - 2 Administrative Perspective Views: Founder Platform Admin and Restaurant Chain Owner.
   - Dedicated static sub-routes under `landing/src/app/dashboard/<role>/page.tsx`.
3. All required business logic (Tally XML export, 80mm ESC/POS receipts, Indian GST SAC 996331, KDS ticket bumping, table floor layouts, COD reconciliation, and license generator) has verified implementation patterns ready to be adapted.

---

## 5. Verification Method

To independently verify the survey observations and findings:

1. **Verify Static Build**:
   ```sh
   npm --prefix landing run build
   ```
   *Expected outcome*: Exits with code 0. Confirms static compilation and generation of `landing/out/`.

2. **Verify ESLint Validation**:
   ```sh
   npm --prefix landing run lint
   ```
   *Expected outcome*: Exits with code 0 with zero lint errors.

3. **Inspect Key Reference Files**:
   - `landing/next.config.ts`: Verify `output: "export"` and `trailingSlash: true`.
   - `frontend/src/app/cloud-portal/page.tsx:533-579`: Verify Tally XML generation routine.
   - `landing/src/components/BillTemplateModal.tsx`: Verify ESC/POS 80mm GST thermal bill formatting.
   - `dev-server.js:142-146`: Verify local ports `:3001`, `:3002`, `:3003`.

4. **Invalidation Conditions**:
   - If `npm --prefix landing run build` fails or warns about dynamic server usage, the `<Suspense>` boundary or static export configuration is invalid.
