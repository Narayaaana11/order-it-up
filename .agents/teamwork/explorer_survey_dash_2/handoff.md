# Handoff Report: Operational Restaurant Personas & Platform Dashboard Survey

**Agent ID**: `explorer_survey_dash_2`  
**Parent Agent**: `324a459d-4047-419c-8077-2f4966965e2f`  
**Milestone**: Survey Phase  
**Artifact Generated**: `d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_2\analysis.md`

---

## 1. Observation

Direct observations from codebase inspection across `main/`, `frontend/`, `tests/`, and `landing/`:

1. **Current Landing Dashboard Implementation**:
   - `landing/src/app/dashboard/page.tsx` (Lines 156–160):
     Currently implements only a binary perspective toggle:
     ```typescript
     const [perspective, setPerspective] = useState<"merchant" | "founder">("merchant");
     ```
     When `perspective === "merchant"`, it renders an overview of Priya Sharma's 3 outlets and high-level summaries. It does not yet provide interactive tabbed operational workflows for Cashier, Kitchen Chef, Server/Waiter, Accountant, and Delivery Driver.
   - `landing/src/lib/constants.ts` (Lines 158–243):
     `ROLE_PERSONAS` already specifies all 6 operational roles (`cashier`, `waiter`, `chef`, `manager`, `accountant`, `driver`) with titles, badges, and capability descriptions.
   - `landing/src/lib/auth.ts` (Lines 3–11, 13–98):
     `AuthUser['role']` contains `"SUPER_ADMIN" | "owner" | "manager" | "accountant" | "cashier" | "server" | "chef" | "delivery" | "customer"`, but `DEMO_USERS` currently omits a dedicated `delivery` rider preset.

2. **Cash Drawer Pulse & ESC/POS Hardware Logic**:
   - `main/printers/thermal.ts` (Lines 2393–2395):
     ```typescript
     export function appendCashDrawerPulse(data: Buffer): Buffer {
       return Buffer.concat([data, Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])]);
     }
     ```
     The 24V solenoid drawer kick pulse is ESC p 0 25 250 (`0x1B, 0x70, 0x00, 0x19, 0xFA`), appended to thermal bytes upon payment method matching `cash_drawer_pulse_methods`.

3. **Cash Closures & Shift Balancing**:
   - `main/db.ts` (Lines 4006–4028) & `main/routes/cash-closures.ts` (Lines 282–372):
     Tracks `opening_float_cents`, `expected_cash_cents`, `counted_cash_cents`, `variance_cents`, `gross_collected_cents`, `refunded_cents`, `z_number`, `closed_by`. Drawer-reality attribution accounts for cash leaving the drawer on refunds.

4. **KDS Server & WebSocket Protocol**:
   - `main/services/kds.ts` (Lines 25–455):
     Runs on port `:3002`. Order item statuses cycle through `['pending', 'preparing', 'ready', 'served']`. Station routing maps items to kitchen stations (`kitchen_stations`: Oven, Tandoor, Bar, Grill) based on `category_ids` and table assignments.

5. **Server / Waiter Tableside Ordering**:
   - `frontend/src/app/server-standalone/page.tsx` (Lines 1–421) & `main/routes/tables.ts` (Lines 61–95):
     Runs on port `:3003`. Maps tables across rooms/floors with statuses (`available`, `occupied`, `billed`, `reserved`). Supports course drafting and instant dispatch to kitchen.

6. **Indian GST & SAC Compliance**:
   - `landing/src/components/BillTemplateModal.tsx` (Lines 330–363):
     Itemizes SAC `996331` (restaurant catering service) with split CGST @ 2.5% and SGST @ 2.5% (total 5.0%), FSSAI license (`10019011000234`), and state codes.

7. **Tally XML Voucher Structure**:
   - `tests/comprehensive-e2e-audit.test.ts` (Lines 268–294):
     Authoritative XML structure:
     ```xml
     <ENVELOPE>
       <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
       <BODY><DATA><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
       <REQUESTDATA>
         <TALLYMESSAGE xmlns:UDF="TallyUDF">
           <VOUCHER VCHTYPE="Receipt" ACTION="Create">
             <DATE>YYYYMMDD</DATE>
             <NARRATION>Daily Register Cash Closure - ...</NARRATION>
             <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Cash in Hand</LEDGERNAME>
               <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
               <AMOUNT>-actualCash</AMOUNT>
             </ALLLEDGERENTRIES.LIST>
             <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Restaurant Sales Account</LEDGERNAME>
               <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
               <AMOUNT>sales</AMOUNT>
             </ALLLEDGERENTRIES.LIST>
             <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Cash Over/Short Expense</LEDGERNAME>
               <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
               <AMOUNT>variance</AMOUNT>
             </ALLLEDGERENTRIES.LIST>
           </VOUCHER>
         </TALLYMESSAGE>
       </REQUESTDATA></IMPORTDATA></DATA></BODY>
     </ENVELOPE>
     ```

8. **Delivery Driver & Aggregator Dispatches**:
   - `main/routes/aggregators.ts` (Lines 87–106, 502–523) & `main/services/aggregator-service.ts` (Lines 23–88, 356–375):
     Tracks `online_platform` (`swiggy` | `zomato` | `direct`), `rider_name`, `rider_phone`, `rider_status` (`unassigned`, `assigned`, `arrived`, `dispatched`, `delivered`), customer address, and COD reconciliation.

---

## 2. Logic Chain

1. **Premise**: The acceptance criteria require that all 6 operational persona dashboards (Owner/Manager, Cashier, Kitchen Chef, Server/Waiter, Accountant, Delivery Driver) and both administrative perspectives (Founder Admin and Chain Owner) be fully rendered and interactive in `landing/` with realistic interconnected operational data, and deployable on Cloudflare Pages without build errors or external cloud dependencies.
2. **Finding from Observation 1**: `landing/src/app/dashboard/page.tsx` currently only contains the top-level switch between "Founder Admin" and "Restaurant Chain Owner". While the Chain Owner view contains multi-outlet summaries, it lacks dedicated operational views for Cashier, Chef, Waiter, Accountant, and Driver.
3. **Finding from Observations 2–8**: The backend in `main/` and existing test suites already have well-defined, robust models for:
   - Cashier: split tenders (UPI QR, Cash, Card), 24V solenoid pulse bytecode, 80mm ESC/POS format.
   - Chef: KDS ticket bumping across 4 statuses, station routing (Oven, Tandoor, Bar), SLA countdowns.
   - Waiter: Table floor map, covers/pax, course firing (Starters, Mains, Desserts).
   - Accountant: CGST 2.5%, SGST 2.5%, SAC 996331, Z-report balancing, Tally XML vouchers.
   - Driver: Dispatch queue (Swiggy, Zomato, Direct), address verification, COD reconciliation.
   - Owner / Founder: Multi-outlet sales, staff PIN assignment, S3 tenant isolation, platform GMV.
4. **Deduction**: We must expand `landing/src/app/dashboard/page.tsx` to include an operational role navigation bar allowing instant switching between the 6 operational personas (in addition to the Founder/Chain perspective switcher). Each persona must have its own dedicated view component with rich interactivity and shared reactive state representing the interconnected lifecycle of orders (such as Order #104).
5. **Deduction on Data & Hybrid Mode**: To ensure Cloudflare Pages static export passes (`npm --prefix landing run build`), the operational models must be bundled into realistic, self-contained client-side state. A background probe to `localhost:3001` / `localhost:3002` / `localhost:3003` will dynamically elevate the dashboard to hybrid live mode when the local Order It Up backend is running.

---

## 3. Caveats

- **No Caveats**: All required subsystems across all 6 operational personas and 2 administrative perspectives were directly located and verified against active runtime code and test suites.
- Assumptions made: The landing page remains a client-side Next.js statically exported site (`output: 'export'`), meaning any backend calls to localhost are performed purely via client-side `fetch` or WebSocket probes that gracefully fall back to local simulated state if the user visits the deployed Cloudflare Pages URL without running the local desktop engine.

---

## 4. Conclusion

The operational persona requirements are completely understood, ground-truthed against the core codebase, and mathematically defined. 

Implementing the complete solution in `landing/` requires:
1. Extending `landing/src/lib/auth.ts` to add a delivery driver preset to `DEMO_USERS`.
2. Implementing the operational data models (`Order`, `OrderItem`, `Table`, `ShiftZReport`, `StaffUser`, `DeliveryDispatch`) in a dedicated module `landing/src/lib/operationalModels.ts` with interconnected sample data for Spice Route Hospitality Group.
3. Building dedicated interactive UI components for each of the 6 roles matching the `#F8FAFC`, `border-slate-200/80`, `#F07928`, and Geist/mono design system:
   - `OwnerManagerView`: Multi-branch sales, staff PIN assignment modal, shift closures, S3 backup outbox.
   - `CashierCounterView`: Interactive product catalog, split tender calculator (UPI QR, Cash change, Card), 24V drawer pulse trigger, 80mm receipt preview.
   - `KitchenChefKdsView`: Station routing filter (Oven, Tandoor, Bar, Fryer), color-coded SLA countdowns, 1-tap ticket bumping.
   - `ServerWaiterView`: Room table layout (Indoor, Patio, Rooftop), visual table statuses, course firing controls (Fire Starters, Fire Mains, Fire Dessert).
   - `AccountantView`: Indian GST breakdown (CGST/SGST 2.5%, SAC 996331), Z-Report cash balancing table, one-click Tally XML export download.
   - `DeliveryDriverView`: Dispatch queue (Swiggy, Zomato, Direct), customer address verification, status tracker, COD collection reconciliation.
4. Integrating these views seamlessly into `landing/src/app/dashboard/page.tsx` with a responsive role selector.
5. Verifying with `npm --prefix landing run lint` and `npm --prefix landing run build`.

Detailed architectural schemas, full TypeScript interfaces, and component wireframes are preserved in `analysis.md`.

---

## 5. Verification Method

To independently verify the findings and preparation:
1. **Inspect Analysis Report**:
   `view_file` on `d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_2\analysis.md`.
2. **Verify Codebase Invariants & References Cited**:
   - Inspect cash drawer pulse command: `d:\narayana\order-it-up\main\printers\thermal.ts` at line 2393.
   - Inspect cash closure schema: `d:\narayana\order-it-up\main\db.ts` at line 4006.
   - Inspect Tally XML voucher generation: `d:\narayana\order-it-up\tests\comprehensive-e2e-audit.test.ts` at line 268.
   - Inspect KDS WebSocket message handler: `d:\narayana\order-it-up\main\services\kds.ts` at lines 250–385.
   - Inspect Waiter standalone app: `d:\narayana\order-it-up\frontend\src\app\server-standalone\page.tsx`.
3. **Verify Baseline Landing Build**:
   ```powershell
   npm --prefix landing run lint
   npm --prefix landing run build
   ```
   Both must exit with code 0.
