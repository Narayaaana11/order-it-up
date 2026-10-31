## 2026-10-31T14:44:00Z
You are Worker M2 for Milestone M2: "The 6 Operational Persona Dashboards".
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\worker_m2_dash\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Ownership:
You own exclusively the following 6 files:
1. `landing/src/components/dashboard/CashierView.tsx`
2. `landing/src/components/dashboard/KitchenChefView.tsx`
3. `landing/src/components/dashboard/ServerWaiterView.tsx`
4. `landing/src/components/dashboard/AccountantView.tsx`
5. `landing/src/components/dashboard/DeliveryDriverView.tsx`
6. `landing/src/components/dashboard/OwnerManagerView.tsx`

Inputs & Specifications:
Read:
- Original Request: d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Scope: d:\narayana\order-it-up\.agents\teamwork\orchestrator_1\PROJECT.md
- Explorer Survey Report 2: d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_2\analysis.md (Section 5 contains full component specifications for each persona)
- Model & Store exports: `landing/src/lib/dashboard-models.ts` and `landing/src/lib/dashboard-store.ts` (14 React hooks and 8 mutation actions ready to use)

Detailed Implementation Requirements:
Follow the landing page UI design system across all views: `#F8FAFC` slate-50 canvas, `#FFFFFF` cards with `border-slate-200/80`, vibrant orange `#F07928` / `#EA580C` brand accents, Geist font typography, Lucide icons, and zero dummy/placeholder labels.

1. `CashierView.tsx`:
   - Live counter billing status for active and queued counter bills.
   - Interactive split tenders calculation (UPI Dynamic QR code, Cash with exact tendered & change calculation, Card swipe).
   - 24V solenoid cash drawer pulse trigger & indicator showing ESC/POS bytecode (`0x1B, 0x70, 0x00, 0x19, 0xFA`), manual drawer kick button, and active till balance reconciliation.
   - Authentic 80mm ESC/POS thermal receipt formatting preview showing store details (Downtown Bistro, Connaught Place), SAC `996331`, CGST @ 2.5%, SGST @ 2.5%, FSSAI License `10019011000234`, itemized dishes, and payment barcode.

2. `KitchenChefView.tsx`:
   - Real-time Kitchen Display System (KDS :3002) order queue.
   - Station routing filters: All, Oven, Tandoor, Bar, Grill.
   - Ticket bumping interaction cycling items/orders from pending -> preparing -> ready -> served using `actions.bumpTicket(...)`.
   - Dynamic SLA prep timer countdown alerts (green < 10m, amber 10-20m, red > 20m overdue).

3. `ServerWaiterView.tsx`:
   - Visual floor table map across rooms/zones (Indoor, Patio, Rooftop, Private Dining).
   - Table occupancy statuses (Available in green, Occupied in amber, Billed in purple, Reserved in blue).
   - Tableside ordering view with course firing controls ("Fire Starters", "Fire Mains", "Fire Desserts") calling `actions.fireCourse(...)`.

4. `AccountantView.tsx`:
   - Indian GST tax breakdown cards: SAC `996331` (Restaurant and catering service), Taxable Value, CGST @ 2.5%, SGST @ 2.5%, Total GST (5.0%).
   - FSSAI compliance verification badge (`#10019011000234`, state code `07` Delhi).
   - Z-Report shift closure balancing table with opening float, gross collections, refunds, expected cash, counted cash, and cash over/short variance flags.
   - 1-click standard Tally XML export download button (generates standard Tally ERP 9 / Prime XML receipt voucher blob with Cash Counter Drawer, UPI Clearing, and Sales ledgers).

5. `DeliveryDriverView.tsx`:
   - Active dispatch queue showing orders across channels (Swiggy, Zomato, Direct In-House).
   - Customer delivery address verification with masked contact phone numbers.
   - Rider status progression buttons (`assigned` -> `arrived` -> `dispatched` -> `delivered`).
   - Cash-on-Delivery (COD) cash collection reconciliation updating counter till.

6. `OwnerManagerView.tsx`:
   - Multi-restaurant chain overview with live sales across connected branches (Downtown Bistro, Cyber Hub Express, Airport Terminal 3).
   - Consolidated chain performance KPIs (total revenue, order volume, average order value, tender mix).
   - Staff PIN & role assignment modal (allows assigning role and 4-digit PIN to team members).
   - Shift closure history and Amazon S3 cloud backup outbox status (`tenants/{tenantId}/` with zero commingling).

Verification tasks:
1. Run `npm --prefix landing run lint` (must pass with 0 errors).
2. Run `npm --prefix landing run build` (Next.js 16.3 static export must succeed cleanly with 0 errors).
3. Create automated unit test in `tests/landing-dashboard-m2.test.cjs` verifying all 6 components render without errors and adhere to design and operational requirements. Run `node --test tests/landing-dashboard-m2.test.cjs`.
4. Write your handoff report to `d:\narayana\order-it-up\.agents\teamwork\worker_m2_dash\handoff.md`.
5. Send completion message with verification outputs.
