# Original User Request

## Initial Request — 2026-10-31T13:14:11Z

Implement the complete end-to-end role-based restaurant and platform dashboards in the web portal (`landing/`) for production deployment on Cloudflare Pages. Replace dummy data with interconnected, realistic operational data models supporting hybrid operation with local backend services.

Integrity mode: development

## Requirements

### R1. Operational Role Dashboards
Implement end-to-end, fully functional dashboards in `landing/` for all 6 operational restaurant personas:
- Owner / Manager: Multi-restaurant chain overview, cross-outlet live sales, consolidated chain performance, staff PIN & role assignment, shift closures, S3 cloud backup.
- Front Cashier: Live counter billing status, 80mm ESC/POS thermal receipt formatting, 24V solenoid cash drawer pulse reconciliation, split tenders (UPI Dynamic QR, Cash, Card).
- Kitchen Chef: Real-time Kitchen Display System (KDS :3002) order queue, station routing (Oven, Tandoor, Bar), ticket bumping, prep timer alerts.
- Server / Waiter: Tableside ordering (:3003), visual floor table map & course firing.
- Accountant / Tax Compliance: Indian GST (CGST @ 2.5%, SGST @ 2.5%, SAC 996331), FSSAI compliance verification, Z-Report shift closure balancing, Tally XML export.
- Delivery Driver: Dispatch queue, customer delivery address verification, Cash-on-Delivery (COD) reconciliation.

### R2. Platform Admin vs Restaurant Chain Owner Perspectives
Provide distinct administrative views and workflows:
- Founder Platform Admin ("For me - startup owner"): Manage restaurant tenant accounts, issue 16-character hardware-bound desktop POS licenses, track isolated Amazon S3 customer buckets (zero data commingling), and monitor platform-wide GMV.
- Restaurant Chain Owner ("For users - multi-outlet"): Manage multiple connected restaurant branches (e.g. Downtown Bistro, Cyber Hub Express, Airport Terminal 3), view live sales across branches, compare performance, sync centralized menus with branch overrides, and consolidate chain taxes.

### R3. Hybrid Data Architecture & Operational Realism
Eliminate ungrounded placeholder data by integrating realistic, interconnected operational data models reflecting real-world restaurant transactions. The dashboard must operate self-contained in the browser by default with rich interactive state, and seamlessly connect to live local backend services (Express `:3001`, KDS `:3002`, Waiter `:3003`) when available.

### R4. UI & Design System Consistency
Follow the landing page UI design system across all views: `#F8FAFC` slate-50 background, white cards with `border-slate-200/80`, vibrant orange `#F07928` brand accents, Geist typography, clean responsive layout, and zero dummy/placeholder labels.

## Verification Resources
Standard repository scripts:
- `npm --prefix landing run lint`
- `npm --prefix landing run build`
- `npm test`

## Acceptance Criteria

### Operational Role Functionality
- [ ] All 6 operational persona dashboards (Owner/Manager, Cashier, Kitchen Chef, Server/Waiter, Accountant, Delivery Driver) are fully rendered and interactive with realistic operational data.
- [ ] Front Cashier view supports split tender calculations, 80mm ESC/POS thermal receipt preview, and drawer reconciliation.
- [ ] Kitchen Display view displays real-time ticket queues, station filtering (Oven, Tandoor, Bar), and ticket bumping.
- [ ] Server / Waiter view displays table floor layout and course firing interactions.
- [ ] Accountant view displays Indian GST breakdown (CGST 2.5%, SGST 2.5%), FSSAI compliance info, Z-report shift balancing, and Tally XML export generation.
- [ ] Delivery Driver view displays active dispatch queue, customer address verification, and COD collection reconciliation.

### Platform and Chain Admin Functionality
- [ ] Founder Platform Admin view provides tenant management, 16-character license generation, S3 bucket status, and platform GMV metrics.
- [ ] Restaurant Chain Owner view provides multi-branch live sales, branch comparison metrics, menu override controls, and consolidated chain tax reporting.

### Hybrid Architecture and UI Polish
- [ ] Dashboard functions seamlessly in standalone mode with realistic interconnected state, and automatically connects to local backend endpoints when available.
- [ ] Design adheres strictly to `#F8FAFC` background, `border-slate-200/80` white cards, `#F07928` accents, and Geist typography without broken layouts.

### Build and Verification
- [ ] `npm --prefix landing run lint` passes with 0 errors.
- [ ] `npm --prefix landing run build` succeeds without build or static export failures.
