# Architectural Specification & Design Report: Reactive Client Store, Seed Models & Operational Mutations

**Author**: Explorer 2 (Reactive Data Architect & Operational Modeling)  
**Milestone**: M1 — Hybrid Reactive Data Architecture & Operational Models  
**Target Path**: `landing/src/lib/dashboard-store.ts`  
**Working Directory**: `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_2\`  
**Date**: 2026-10-31  

---

## 1. Executive Summary

This report establishes the complete architectural design, data structures, realistic initial seed datasets, and transactional mutation methods for the reactive browser store powering Order It Up's role-based dashboards in `landing/src/lib/dashboard-store.ts`.

To satisfy Requirement **R3** (Hybrid Data Architecture & Operational Realism) for deployment on Cloudflare Pages via Next.js 16 static HTML export (`output: 'export'`), the dashboard store must:
1. **Operate 100% self-contained in standard browser environments** without external backend dependencies, while maintaining readiness to bind to live local endpoints (`:3001`, `:3002`, `:3003`).
2. **Use standard React 19 APIs (`useSyncExternalStore`)** with zero external state libraries (avoiding unnecessary npm dependencies like Zustand, adhering strictly to Invariant 6: *Reuse before adding*).
3. **Guarantee complete SSR hydration safety**, eliminating React 19 hydration mismatches between static prerendered HTML and browser `localStorage`.
4. **Embody deep operational realism** through interconnected relational entities representing **Spice Route Hospitality Group** (3 outlets, SAC 996331 + GST menu items, multi-lifecycle live orders, zone tables, staff PINs, shift Z-Reports with cash variances, aggregator delivery queues, and multi-tenant S3 telemetry).
5. **Provide 8 concrete, validated operational mutation methods** (`bumpTicket`, `fireCourse`, `settlePayment`, `recordShiftClosure`, `assignStaffRole`, `updateBranchPriceOverride`, `generateLicenseKey`, and `updateDeliveryStatus`).

---

## 2. Reactive Store Architecture (`landing/src/lib/dashboard-store.ts`)

### 2.1 The Technical Challenge: SSR Hydration Safety in Next.js 16 App Router
In Next.js 16 with `output: 'export'`, all pages are pre-rendered during `npm --prefix landing run build` into static HTML in a Node.js worker. During build time:
- Neither `window` nor `localStorage` exists.
- The build engine generates HTML markup using initial default values.

When the user opens the exported dashboard in the browser:
- If a client component immediately reads from `localStorage` during its initial hydration pass, the client render tree will differ from the server HTML tree whenever the stored state differs from default seed data.
- React 19 strictly flags this with a hydration error:
  `Error: Hydration failed because the server-rendered HTML didn't match the client.`

### 2.2 The Solution: Two-Phase Hydration with `useSyncExternalStore`
React 19's native `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` provides the exact primitive needed:
- `getServerSnapshot()`: Always returns the pure, immutable `INITIAL_DASHBOARD_STATE`. This guarantees that server-side generation produces consistent, deterministic markup.
- `getSnapshot()`: Returns the current in-memory store reference.
- `isHydrated` lifecycle:
  1. The in-memory store initializes with `INITIAL_DASHBOARD_STATE` and `isHydrated: false`.
  2. On the client's first render, `getSnapshot()` and `getServerSnapshot()` yield the identical initial seed state, matching the SSR HTML with 0 hydration errors.
  3. A non-blocking client mount routine (via `requestAnimationFrame` or `useEffect`) reads `localStorage.getItem(STORAGE_KEY)`. If existing valid state is found, it hydrates the in-memory state, sets `isHydrated: true`, and notifies all subscribers.
  4. React smoothly transitions into the user's persisted session state without flashing or throwing exceptions.

```
+---------------------------------------------------------------------------------------------------+
|                                     REACT 19 HYDRATION TIMELINE                                   |
+---------------------------------------------------------------------------------------------------+
|  1. Next.js Build / SSR:                                                                          |
|     getServerSnapshot() ---> Returns INITIAL_DASHBOARD_STATE (isHydrated = false)                 |
|     Static HTML exported to out/dashboard/index.html with standard seed layout.                   |
|                                                                                                   |
|  2. Initial Client Hydration Pass:                                                                |
|     getSnapshot()        ---> Returns in-memory INITIAL_DASHBOARD_STATE (isHydrated = false)      |
|     Result: DOM matches HTML 100% -> Hydration succeeds without warnings.                         |
|                                                                                                   |
|  3. Client Mount & Hydration Event:                                                               |
|     useEffect() fires   ---> Reads localStorage("orderitup_dashboard_state_v1")                   |
|     hydrate()           ---> Merges persisted edits, sets isHydrated = true, calls notify()       |
|     Result: Active components re-render with persisted custom data smoothly.                      |
+---------------------------------------------------------------------------------------------------+
```

### 2.3 Store Architecture & Observable Container Pattern

The store is implemented as a lightweight, typed singleton observable container:

```typescript
// Conceptual Container Structure
type Listener = () => void;

class DashboardStoreContainer {
  private state: DashboardState;
  private listeners: Set<Listener> = new Set();
  private storageKey = "orderitup_dashboard_state_v1";

  constructor(initial: DashboardState) {
    this.state = initial;
  }

  public getSnapshot = (): DashboardState => this.state;
  public getServerSnapshot = (): DashboardState => INITIAL_DASHBOARD_STATE;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public setState(updater: (prev: DashboardState) => DashboardState): void {
    const nextState = updater(this.state);
    this.state = nextState;
    this.persist();
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (err) {
      console.warn("[DashboardStore] LocalStorage write failed:", err);
    }
  }

  public hydrate(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = { ...parsed, isHydrated: true };
      } else {
        this.state = { ...this.state, isHydrated: true };
        this.persist();
      }
      this.notify();
    } catch {
      this.state = { ...this.state, isHydrated: true };
      this.notify();
    }
  }
}
```

### 2.4 Ergonomic React Hooks API
To provide seamless developer experience for all role components without unnecessary full-tree re-renders, the store exports both a selector hook and targeted domain hooks:

1. **`useDashboardStore<T>(selector: (state: DashboardState) => T): T`**: Standard selector hook with subscription.
2. **`useDashboardActions()`**: Returns stable mutation methods (`bumpTicket`, `fireCourse`, `settlePayment`, etc.).
3. **Domain-Specific Convenience Hooks**:
   - `useActivePerspective()`: Current admin perspective (`'merchant' | 'founder'`).
   - `useActiveRole()`: Current operational persona (`'owner' | 'cashier' | 'chef' | 'server' | 'accountant' | 'driver'`).
   - `useSelectedOutlet()`: Current outlet filter (`'all' | 'outlet-1' | 'outlet-2' | 'outlet-3'`).
   - `useOutlets()`: Array of connected outlets.
   - `useOrders()`: Array of active restaurant orders.
   - `useTables()`: Array of room dining tables.
   - `useStaff()`: Team member directory with PINs.
   - `useCatalog()`: Master menu catalog with branch price overrides.
   - `useZReports()`: Shift closure reports.
   - `useDispatches()`: Delivery dispatch queue.
   - `useTenants()`: Platform customer accounts and S3 metrics.
   - `useActiveCashShift()`: Current cashier till drawer balances.

---

## 3. Comprehensive Realistic Initial Seed Dataset: "Spice Route Hospitality Group"

The dataset models **Spice Route Hospitality Group**, founded by Priya Sharma, operating 3 outlets across the National Capital Region (NCR) with centralized oversight, isolated Amazon S3 storage, and local POS hardware engines.

### 3.1 The 3 Connected Outlets
| Outlet ID | Name | City & Location | Concept & Hardware | Port Bindings | Today's Sales | Orders | Avg Ticket | Tenders (UPI / Cash / Card) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `outlet-1` | **Downtown Bistro (Flagship)** | Connaught Place, New Delhi (`07`) | Fine Dine & Craft Cocktail Bar; 12 Tables, 2x 80mm ESC/POS, 24V Solenoid Till | `:3001` POS<br>`:3002` KDS<br>`:3003` Waiter | ₹48,920.00 | 48 | ₹1,019.16 | UPI: ₹28,420<br>Cash: ₹14,200<br>Card: ₹6,300 |
| `outlet-2` | **Cyber Hub Express (QSR)** | DLF Cyber City, Gurugram (`06`) | High-Volume QSR & Delivery Hub; 12 Tables, 2x 80mm ESC/POS, Kitchen Bump Bar | `:3001` POS<br>`:3002` KDS | ₹64,150.00 | 112 | ₹572.76 | UPI: ₹49,200<br>Cash: ₹3,000<br>Card: ₹11,950 |
| `outlet-3` | **Airport Terminal 3 Hub** | IGI Airport T3 Departures (`07`) | 24/7 Transit Grab-and-Go; 8 Tables, 1x 80mm ESC/POS, Barcode Scanner | `:3001` POS<br>`:3002` KDS | ₹32,400.00 | 56 | ₹578.57 | UPI: ₹10,200<br>Cash: ₹2,400<br>Card: ₹19,800 |

### 3.2 Master Menu Catalog (SAC 996331, 5% GST & Branch Overrides)
Every item is categorized under Indian Service Accounting Code **`996331`** (Restaurant and Catering Services) with **CGST @ 2.5%** and **SGST @ 2.5%** (total 5.0% GST). Prices at Airport T3 include a +15% transit premium override.

| ID | Dish Name | Category | Station | Course | Dietary | Base Price | Cyber Hub Override | Airport T3 Override | Modifiers |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `prod-001` | **Truffle Mushroom Wood-Fired Pizza** | Pizzas | `oven` | `main` | `veg` | ₹540.00 | ₹520.00 | ₹620.00 (+15%) | Extra Mozzarella (+₹60), Truffle Shavings (+₹120) |
| `prod-002` | **Artisanal Paneer Tikka Platter** | Starters | `tandoor` | `starter` | `veg` | ₹380.00 | Standard | ₹420.00 (+10%) | Mint Chutney & Laccha Onion (₹0), Spiced Marinade (+₹20) |
| `prod-003` | **24-Hour Slow Cooked Dal Makhani** | Mains | `oven` | `main` | `veg` | ₹420.00 | Standard | ₹480.00 (+14%) | White Butter Dollop (+₹30), Garlic Tadka (+₹25) |
| `prod-004` | **Clay Oven Butter Naan** | Mains | `tandoor` | `main` | `veg` | ₹85.00 | Standard | ₹110.00 (+29%) | Garlic Glaze (+₹15), Green Chilli (+₹10) |
| `prod-005` | **Awadhi Murgh Dum Biryani** | Mains | `tandoor` | `main` | `non-veg` | ₹520.00 | Standard | ₹590.00 (+13%) | Burani Raita & Mirchi Salan (₹0), Extra Chicken (+₹100) |
| `prod-006` | **Classic Cold Brew Latte** | Beverages | `bar` | `beverage` | `veg` | ₹220.00 | Standard | ₹260.00 (+18%) | Oat Milk Sub (+₹40), Vanilla Shot (+₹30) |
| `prod-007` | **Butter Chicken Bao (x3)** | Starters | `grill` | `starter` | `non-veg` | ₹460.00 | Standard | ₹510.00 (+11%) | Pickled Cucumber & Sriracha Mayo (₹0) |
| `prod-008` | **Belgian Dark Chocolate Lava Cake** | Desserts | `bar` | `dessert` | `egg` | ₹280.00 | Standard | ₹320.00 (+14%) | Vanilla Bean Gelato (+₹50), Berry Coulis (+₹30) |

### 3.3 Live Orders Representing Lifecycle Stages
The initial store state includes live orders actively demonstrating every stage of the restaurant operating cycle:

```
+---------------------------------------------------------------------------------------------------------+
|                                    LIVE RESTAURANT ORDER LIFECYCLE                                      |
+---------------------------------------------------------------------------------------------------------+
|  ORDER #104 (Tableside Dining)    ORDER #101 (Preparing in Oven)     ORDER #102 (Ready at Bar)          |
|  - Table: T-04 (Indoor, 4 Pax)    - Table: T-02 (Indoor, 3 Pax)      - Table: P-02 (Patio, 2 Pax)       |
|  - Server: Aman Kapoor            - Chef: Marco Rossi                - Bartender: Marco Rossi           |
|  - Starters: Served               - Items: Truffle Pizza (prep)      - Items: Cold Brew Latte (ready)   |
|  - Mains: Preparing (Course Fired)         Dal Makhani (prep)                 Lava Cake (ready)         |
|  - Desserts: Held                 - SLA Timer: 9m (Amber Alert)      - SLA Timer: 4m (Green On-Time)    |
|  - Total: ₹2,027.00 (Unpaid)      - Total: ₹1,520.00 (Unpaid)        - Total: ₹590.00 (Unpaid)          |
+---------------------------------------------------------------------------------------------------------+
|  ORDER #103 (Billed at Counter)   ORDER #105 (Delivery - Swiggy)     ORDER #108 (Direct In-House)       |
|  - Table: T-05 (Indoor, 6 Pax)    - Channel: Swiggy Dispatch D-801   - Channel: Direct Dispatch D-803   |
|  - Status: All Items Served       - Rider: Sumit Kumar (Dispatched)  - Driver: Ramesh V (Arrived)       |
|  - Bill Printed: Awaiting Cashier - COD: ₹840.00 (Pending Coll.)     - COD: ₹1,450.00 (Pending Coll.)   |
|  - Total: ₹2,431.00               - Destination: DLF Phase 5         - Destination: Tolstoy Marg CP     |
+---------------------------------------------------------------------------------------------------------+
```

1. **Order #101** (`ord-101`):
   - Scope: Kitchen KDS demonstration (Oven & Tandoor).
   - Table: `tbl-indoor-02` (Table T-02, 3 Pax).
   - Items: Truffle Mushroom Pizza (x1, `preparing`), Dal Makhani (x1, `preparing`), Butter Naan (x3, `preparing`).
   - Elapsed Time: 9 minutes (`prepStartedAt` stamped 9 mins ago). Displays **Amber SLA Alert** (8-15 min range).
   - Financials: Subtotal ₹1,445.00, Taxable ₹1,445.00, CGST ₹36.13, SGST ₹36.13, Round-off +₹0.74, Total: ₹1,518.00. Payment: `unpaid`.

2. **Order #102** (`ord-102`):
   - Scope: Kitchen KDS Craft Bar demonstration.
   - Table: `tbl-patio-02` (Table P-02, 2 Pax).
   - Items: Classic Cold Brew Latte (x2, `ready`), Belgian Dark Chocolate Lava Cake (x1, `ready`).
   - Elapsed Time: 4 minutes (`readyAt` stamped 1 min ago). Displays **Green SLA Badge** (< 8 mins).
   - Financials: Subtotal ₹720.00, Taxable ₹720.00, CGST ₹18.00, SGST ₹18.00, Total: ₹756.00. Payment: `unpaid`.

3. **Order #103** (`ord-103`):
   - Scope: Front Cashier Split Tender demonstration.
   - Table: `tbl-indoor-05` (Table T-05, 6 Pax). Table status: `billed`.
   - Items: All items `served`. Bill generated, awaiting checkout.
   - Financials: Subtotal ₹2,315.00, Net Taxable ₹2,315.00, CGST ₹57.88, SGST ₹57.88, Round-off +₹0.24, Total: **₹2,431.00**.
   - Cashier Split Scenario: Supports settling via ₹1,000.00 Cash + ₹1,431.00 UPI Dynamic QR.

4. **Order #104** (`ord-104`):
   - Scope: Tableside Handheld Ordering & Multi-Course Firing demonstration (:3003).
   - Table: `tbl-indoor-04` (Table T-04, 4 Pax). Waiter: Aman Kapoor (`usr_server_01`).
   - Course States:
     - `starter`: Artisanal Paneer Tikka Platter (x2, `served`) — Fired at 19:20, finished.
     - `main`: Truffle Mushroom Wood-Fired Pizza (x1, `preparing`) — Fired at 19:42, cooking in oven!
     - `dessert`: Belgian Dark Chocolate Lava Cake (x1, `pending`) — Held until guest signals dessert call.
     - `beverage`: Classic Cold Brew Latte (x2, `served`).
   - Financials: Subtotal ₹1,740.00, Modifiers ₹190.00, Net Taxable ₹1,930.00, CGST ₹48.25, SGST ₹48.25, Round-off +₹0.50, Total: **₹2,027.00**.

5. **Delivery Orders (#105, #106, #108)**:
   - Order #105: Swiggy Dispatch `D-801`, Rider Sumit Kumar, `dispatched`, COD ₹840.00.
   - Order #106: Zomato Dispatch `D-802`, Rider Rahul Yadav, `assigned`, Prepaid (COD ₹0.00).
   - Order #108: Direct In-House Dispatch `D-803`, Driver Ramesh V, `arrived`, COD ₹1,450.00.

### 3.4 Table Layout Across Zones
15 dining tables across 4 distinct architectural dining zones:
- **Indoor Dining (6 Tables)**:
  - `tbl-indoor-01`: Table T-01, 2 Pax, `available`.
  - `tbl-indoor-02`: Table T-02, 4 Pax, `occupied` (Linked to Order #101, seated 28m ago).
  - `tbl-indoor-03`: Table T-03, 4 Pax, `reserved` (Guest: Dr. Verma, 20:30 booking).
  - `tbl-indoor-04`: Table T-04, 4 Pax, `occupied` (Linked to Order #104, seated 42m ago, Waiter: Aman Kapoor).
  - `tbl-indoor-05`: Table T-05, 6 Pax, `billed` (Linked to Order #103, seated 65m ago).
  - `tbl-indoor-06`: Table T-06, 2 Pax, `available`.
- **Patio Garden (4 Tables)**:
  - `tbl-patio-01`: Table P-01, 4 Pax, `available`.
  - `tbl-patio-02`: Table P-02, 2 Pax, `occupied` (Linked to Order #102, seated 14m ago).
  - `tbl-patio-03`: Table P-03, 4 Pax, `cleaning` (Bussed at 19:40).
  - `tbl-patio-04`: Table P-04, 6 Pax, `available`.
- **Rooftop Lounge (4 Tables)**:
  - `tbl-roof-01`: Table R-01, 2 Pax, `available`.
  - `tbl-roof-02`: Table R-02, 4 Pax, `occupied` (Seated 35m ago).
  - `tbl-roof-03`: Table R-03, 6 Pax, `reserved` (Corporate Party reservation).
  - `tbl-roof-04`: Table R-04, 4 Pax, `available`.
- **Private Dining Room (1 Table)**:
  - `tbl-pdr-01`: Table PDR-01, 10 Pax, `available` (Presidential Chamber).

### 3.5 Staff Directory with Real Names and 4-Digit Security PINs
| User ID | Full Name | Operational Role | 4-Digit PIN | Active Outlet | Primary Responsibility | Email |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `usr_owner_01` | **Priya Sharma** | `owner` | `9021` | `outlet-1` | Executive Chain Oversight & Cloud S3 | `priya@spiceroute.in` |
| `usr_manager_01` | **Arjun Verma** | `manager` | `5512` | `outlet-1` | General Manager & Supervisor Overrides | `arjun@spiceroute.in` |
| `usr_cashier_01` | **Rohit Singh** | `cashier` | `1044` | `outlet-1` | Counter Checkout, Till & 80mm Printing | `rohit.singh@spiceroute.in` |
| `usr_chef_01` | **Marco Rossi** | `chef` | `7732` | `outlet-1` | Head Chef & Station KDS Routing | `marco.rossi@spiceroute.in` |
| `usr_server_01` | **Aman Kapoor** | `server` | `2481` | `outlet-1` | Floor Captain, Handheld & Course Firing | `aman.kapoor@spiceroute.in` |
| `usr_acc_01` | **Kavita Rao** | `accountant` | `3391` | `outlet-1` | GST Compliance & Tally XML Export | `kavita.rao@spiceroute.in` |
| `usr_driver_01` | **Ramesh V** | `driver` | `6120` | `outlet-1` | In-House Fulfillment & COD Reconciliation | `ramesh.v@spiceroute.in` |

### 3.6 Completed Shift Z-Reports with Cash Over/Short Variance
Grounded in `main/routes/cash-closures.ts` and `main/db.ts`:
- **Z-Report #41 (Yesterday - Balanced Register)**:
  - Date: `2026-10-30`, Downtown Bistro (Flagship). Cashier: Rohit Singh, Supervisor: Arjun Verma.
  - Opening Float: ₹5,000.00 | Gross Cash Sales: ₹18,400.00 | Cash Refunds: ₹0.00.
  - Expected Drawer Cash: ₹23,400.00 | Counted Physical Cash: ₹23,400.00.
  - **Cash Variance**: **₹0.00** (`status: 'balanced'`).
  - Total Gross Billing: ₹62,400.00 (UPI: ₹31,200, Card: ₹12,800). Total Bills: 58. Total Tax (CGST+SGST): ₹2,971.42.
- **Z-Report #42 (Today Shift 1 - Shortage Variance Alert)**:
  - Date: `2026-10-31`, Downtown Bistro (Flagship). Cashier: Rohit Singh, Supervisor: Arjun Verma.
  - Opening Float: ₹5,000.00 | Gross Cash Sales: ₹14,200.00 | Cash Refunds: ₹0.00.
  - Expected Drawer Cash: ₹19,200.00 | Counted Physical Cash: ₹19,150.00.
  - **Cash Variance**: **-₹50.00 (Shortage Flagged)** (`status: 'variance_flagged'`).
  - Total Gross Billing: ₹48,920.00 (UPI: ₹28,420, Card: ₹6,300). Total Bills: 48. Total Tax: ₹2,329.52.
- **Z-Report #43 (Cyber Hub Express Shift 1 - Small Overage)**:
  - Date: `2026-10-31`, Cyber Hub Express (QSR). Cashier: Vikas Gupta.
  - Opening Float: ₹3,000.00 | Gross Cash Sales: ₹8,200.00 | Refunds: ₹200.00.
  - Expected Cash: ₹11,000.00 | Counted Cash: ₹11,020.00.
  - **Cash Variance**: **+₹20.00 (Overage Flagged)** (`status: 'variance_flagged'`).

### 3.7 Delivery Queue with Aggregator Channels & COD Amounts
- **Dispatch #D-801** (`disp-001`):
  - Order: `#105` | Channel: `swiggy` | ETA: 18 mins.
  - Customer: Vikram Malhotra (`+91 98111 22334`, masked: `+91 98*** **334`).
  - Address: *Apt 1402, Tower 4, The Magnolias, DLF Phase 5, Gurugram* (Landmark: *Club House Gate 2*).
  - Rider: Sumit Kumar (`+91 99887 76655`) | Status: `dispatched`.
  - Payment: **COD Amount: ₹840.00** (`codCollected: false`).
- **Dispatch #D-802** (`disp-002`):
  - Order: `#106` | Channel: `zomato` | ETA: 25 mins.
  - Customer: Ananya Sen (`+91 98222 33445`, masked: `+91 98*** **445`).
  - Address: *Villa 28, Silver Oaks, Golf Course Road, Gurugram* (Landmark: *Opposite Central Plaza*).
  - Rider: Rahul Yadav (`+91 99112 23344`) | Status: `assigned`.
  - Payment: **Prepaid Online** (`codAmount: ₹0.00`, `codCollected: true`).
- **Dispatch #D-803** (`disp-003`):
  - Order: `#108` | Channel: `direct` (In-House Delivery) | ETA: 12 mins.
  - Customer: Rajesh Gupta (`+91 98333 44556`, masked: `+91 98*** **556`).
  - Address: *Flat 4B, Rohit House, 3 Tolstoy Marg, Connaught Place, New Delhi* (Landmark: *Next to British Council*).
  - Rider: Ramesh V (In-House Driver, `+91 98110 55443`) | Status: `arrived`.
  - Payment: **COD Amount: ₹1,450.00** (`codCollected: false`).

### 3.8 Platform Tenants & Isolated Amazon S3 Telemetry
Grounded in `main/services/amazon-s3.ts` (enforcing zero tenant commingling):
1. **Spice Route Hospitality Group** (`tenant-0892`):
   - Owner: Priya Sharma (`priya@spiceroute.in`) | Tier: Enterprise Chain (`enterprise`).
   - Outlets: 3 | Terminals: 6 | 30-Day GMV: ₹14,85,200 ($17,894).
   - Dedicated S3 Bucket: `orderitup-tenant-spiceroute` (Prefix: `tenants/tenant-0892/`).
   - S3 Storage Metrics:
     - `backups/`: 14 SQLite snapshots, 428 MB (Last snapshot: today 03:00 UTC).
     - `payments/`: 3,420 settled records, 18.4 MB.
     - `users/`: 12 archived role profiles, 1.2 MB.
     - `media/`: 68 dish images & logos, 142 MB.
     - Total: 589.6 MB across 3,514 objects.
     - Zero Commingling Invariant: `Verified Isolated (Prefix Strict)`.
   - Active Desktop POS Hardware Licenses:
     - `OIUP-ENT1-8F42-K9L2` (Counter POS 1 - Downtown Bistro)
     - `OIUP-ENT1-8F43-M3P1` (Counter POS 2 - Downtown Bistro)
     - `OIUP-ENT1-B892-4C7D` (Cyber Hub POS 1)
2. **Urban Bites Fast-Casual Co.** (`tenant-0441`):
   - Owner: Amit Verma (`amit@urbanbites.co`) | Tier: Pro Multi-Outlet (`pro`).
   - Outlets: 2 | Terminals: 4 | 30-Day GMV: ₹8,92,400 ($10,751).
   - S3 Bucket: `orderitup-tenant-urbanbites` (Total: 242.4 MB, 1,912 objects).
   - License: `OIUP-PRO1-7A11-X8Y4`.
3. **Cafe Milano Roasters** (`tenant-0129`):
   - Owner: Marco Rossi (`marco@cafemilano.com`) | Tier: Single Store Pilot (`starter`).
   - Outlets: 1 | Terminals: 2 | 30-Day GMV: ₹4,20,100 ($5,061).
   - S3 Bucket: `orderitup-tenant-milano` (Total: 112.8 MB, 924 objects).
   - License: `OIUP-STR1-9C33-R2T5`.
4. **The Coastal Catch Bistro** (`tenant-0773`):
   - Owner: Sunita Rao (`sunita@coastalcatch.in`) | Tier: Enterprise Chain (`enterprise`).
   - Outlets: 4 | Terminals: 8 | 30-Day GMV: ₹21,40,900 ($25,793).
   - S3 Bucket: `orderitup-tenant-coastal` (Total: 642.5 MB, 4,982 objects).
   - License: `OIUP-ENT1-6D99-W1Q8`.

---

## 4. Design of the 8 Operational Mutation Methods

Each mutation is designed with complete input validation, state transformation, cross-entity relational updates, and immediate persistence.

### 4.1 `bumpTicket(orderId: string, itemId?: string, newStatus?: TicketItemStatus): void`
- **Purpose**: Touch-optimized Kitchen Display System bumping. Advances ticket/item through the preparation line (`pending` → `preparing` → `ready` → `served`).
- **Signature**:
  ```typescript
  bumpTicket: (orderId: string, itemId?: string, newStatus?: TicketItemStatus) => void;
  ```
- **Validation**:
  - Validates `orderId` exists in state. If not found, logs a warning and aborts without mutating.
  - If `newStatus` is provided, ensures it is a valid `TicketItemStatus` (`'pending' | 'preparing' | 'ready' | 'served' | 'voided'`).
- **State Transformations**:
  - Determines transition sequence: `pending` → `preparing` → `ready` → `served`.
  - If `itemId` is provided (and not `'all'`), only updates the matching item in `order.items`.
  - If `itemId` is omitted or `'all'`, updates all items in `order.items`.
  - **Timestamp updates**:
    - When transitioning to `preparing`: sets `prepStartedAt = Date.now()` (if not already set).
    - When transitioning to `ready`: sets `readyAt = Date.now()`.
    - If all items in the order become `ready`, sets `order.readyAt = Date.now()`.
    - If all items in the order reach `served`, updates order kitchen completion state.
    - Updates `order.updatedAt = new Date().toISOString()`.
- **Side Effects**: Automatically calls `persist()` and triggers subscriber re-renders.

### 4.2 `fireCourse(tableId: string, course: CourseType): void`
- **Purpose**: Mobile tableside waiter action (:3003). Releases held courses (Starters, Mains, Desserts, Beverages) to the kitchen brigade.
- **Signature**:
  ```typescript
  fireCourse: (tableId: string, course: CourseType) => void;
  ```
- **Validation**:
  - Validates `tableId` exists and has `table.status === 'occupied'`.
  - Validates `table.currentOrderId` exists and corresponds to an active order.
- **State Transformations**:
  - Locates the active order.
  - Identifies all items where `item.course === course`.
  - For each matching item currently in `pending` status:
    - Transitions `item.status = 'preparing'`.
    - Sets `item.specialInstructions = (item.specialInstructions ? item.specialInstructions + ' | ' : '') + 'Course Fired'`.
  - Updates `order.updatedAt = new Date().toISOString()`.
- **Side Effects**: Kitchen KDS screens immediately reflect the fired items in their preparation queue.

### 4.3 `settlePayment(orderId: string, paymentMethod: PaymentMethodType, splitDetails?: SplitSettlementDetails): void`
- **Purpose**: Front counter cashier checkout. Finalizes billing, pulses the cash drawer solenoid, recalculates outlet revenue, and clears dining tables.
- **Signature**:
  ```typescript
  settlePayment: (orderId: string, paymentMethod: PaymentMethodType, splitDetails?: SplitSettlementDetails) => void;
  ```
- **Validation**:
  - Order must exist and have `paymentStatus !== 'paid'`.
  - If `paymentMethod === 'split'`, validates:
    `Math.round((splitDetails?.cash || 0) + (splitDetails?.card || 0) + (splitDetails?.upi || 0)) === Math.round(order.total)`.
    Throws an error if split total does not equal order total.
- **State Transformations**:
  - Marks `order.paymentStatus = 'paid'`.
  - Determines tender breakdown:
    - `cashAmount = (paymentMethod === 'cash') ? order.total : (paymentMethod === 'split' ? (splitDetails?.cash || 0) : 0)`.
    - `upiAmount = (paymentMethod === 'upi') ? order.total : (paymentMethod === 'split' ? (splitDetails?.upi || 0) : 0)`.
    - `cardAmount = (paymentMethod === 'card') ? order.total : (paymentMethod === 'split' ? (splitDetails?.card || 0) : 0)`.
  - Stamps `order.settlement`:
    ```typescript
    {
      method: paymentMethod,
      splitBreakdown: splitDetails,
      paidAt: new Date().toISOString(),
      receiptPrinted: true,
      cashDrawerPulsed: cashAmount > 0
    }
    ```
  - **Cash Drawer Solenoid & Shift Till**:
    - If `cashAmount > 0`:
      - Appends record to `drawerPulseHistory`:
        `{ id: 'pulse-' + Date.now(), timestamp: new Date().toISOString(), orderId, amount: cashAmount, reason: 'Cash Settlement Kick (0x1B, 0x70, 0x00, 0x19, 0xFA)' }`.
      - Increments `activeCashShift.grossCashSales += cashAmount`.
      - Increments `activeCashShift.expectedCashInDrawer += cashAmount`.
  - **Table Turnover**:
    - If `order.tableId` exists:
      - Finds table in `tables`.
      - Transitions status: `occupied` | `billed` → `available`.
      - Clears `currentOrderId`, `guestCount`, and `seatedAt`.
  - **Outlet Sales Aggregation**:
    - Finds outlet matching `order.outletId`.
    - `outlet.todaySales += order.total`.
    - `outlet.ordersCount += 1`.
    - `outlet.avgTicket = Math.round(outlet.todaySales / outlet.ordersCount)`.
    - `outlet.tenders.cash += cashAmount`.
    - `outlet.tenders.upi += upiAmount`.
    - `outlet.tenders.card += cardAmount`.

### 4.4 `recordShiftClosure(shiftData: ShiftClosureInput): ShiftZReport`
- **Purpose**: Daily financial closure by cashier and supervisor. Calculates expected cash vs actual physical count, audits over/short variances, and creates an official Z-Report.
- **Signature**:
  ```typescript
  recordShiftClosure: (shiftData: ShiftClosureInput) => ShiftZReport;
  ```
- **Validation**:
  - Validates `actualCountedCash >= 0`.
  - Validates `cashierName` and `supervisorName` are non-empty strings.
- **State Transformations**:
  - Reads active shift metrics:
    - `openingFloat = activeCashShift.openingFloat`.
    - `grossCashSales = activeCashShift.grossCashSales`.
    - `cashRefunds = activeCashShift.cashRefunds`.
    - `expectedCash = openingFloat + grossCashSales - cashRefunds`.
    - `countedCash = shiftData.actualCountedCash`.
    - `cashVariance = countedCash - expectedCash`.
  - Generates next `zNumber` (increments highest existing `zNumber`).
  - Creates new `ShiftZReport`:
    - `id = 'zreport-' + Date.now()`.
    - `businessDate = new Date().toISOString().split('T')[0]`.
    - `openedAt = activeCashShift.openedAt`.
    - `closedAt = new Date().toISOString()`.
    - `status = Math.abs(cashVariance) < 0.01 ? 'balanced' : 'variance_flagged'`.
    - `notes = shiftData.notes || (cashVariance < 0 ? 'Cash shortage of ₹' + Math.abs(cashVariance).toFixed(2) : cashVariance > 0 ? 'Cash overage of ₹' + cashVariance.toFixed(2) : 'Drawer balanced perfectly')`.
  - Appends new report to `zReports`.
  - Resets `activeCashShift` for the upcoming shift:
    - `openedAt = new Date().toISOString()`.
    - `openingFloat = shiftData.nextOpeningFloat ?? 5000`.
    - `grossCashSales = 0`.
    - `cashRefunds = 0`.
    - `expectedCashInDrawer = shiftData.nextOpeningFloat ?? 5000`.
- **Return**: Returns the freshly generated `ShiftZReport`.

### 4.5 `assignStaffRole(staffId: string, role: OperationalRole, pin: string): void`
- **Purpose**: Owner/Manager security control. Updates employee operational roles and 4-digit terminal authorization PINs.
- **Signature**:
  ```typescript
  assignStaffRole: (staffId: string, role: OperationalRole, pin: string) => void;
  ```
- **Validation**:
  - PIN validation: Must match `/^\d{4}$/` exactly (4 numeric digits). Throws error if non-numeric or length != 4.
  - Role validation: Must be one of `['owner', 'manager', 'cashier', 'chef', 'server', 'accountant', 'driver', 'superadmin']`.
  - Staff existence: Throws error if `staffId` is not found.
- **State Transformations**:
  - Updates `staff.role = role`.
  - Updates `staff.pin = pin`.
  - Sets `staff.lastActive = 'Just now'`.

### 4.6 `updateBranchPriceOverride(outletId: string, itemId: string, price: number | null): void`
- **Purpose**: Restaurant Chain Owner menu control. Overrides centralized item prices for specific outlets (e.g. transit hubs) or resets them to default base pricing.
- **Signature**:
  ```typescript
  updateBranchPriceOverride: (outletId: string, itemId: string, price: number | null) => void;
  ```
- **Validation**:
  - Target product must exist in `catalog`.
  - Price must be `null` (to clear override) or a non-negative number (`price >= 0`). Rejects negative values.
- **State Transformations**:
  - If `price === null`: sets `item.branchOverrides[outletId].priceOverride = null`.
  - If `price !== null`: sets `item.branchOverrides[outletId] = { ...(item.branchOverrides[outletId] || { isAvailable: true }), priceOverride: price }`.

### 4.7 `generateLicenseKey(tenantId: string, plan: 'enterprise' | 'pro' | 'starter', machineHash: string): string`
- **Purpose**: Founder Platform Admin tool. Generates 16-character hardware-bound desktop POS license keys adhering to the contract: `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]`.
- **Signature**:
  ```typescript
  generateLicenseKey: (tenantId: string, plan: 'enterprise' | 'pro' | 'starter', machineHash: string) => string;
  ```
- **Validation**:
  - Target tenant must exist in `tenants`.
  - `machineHash` must be non-empty (cleans special characters, normalizes to 4 uppercase alphanumeric characters).
- **Algorithm**:
  1. `Block 1 (Prefix)`: Always `OIUP`.
  2. `Block 2 (Plan)`: `ENT1` (Enterprise), `PRO1` (Pro), or `STR1` (Starter).
  3. `Block 3 (Machine Fingerprint)`: Cleaned 4-character hex/alphanumeric machine hash (e.g. `8F42`).
  4. `Block 4 (Checksum)`: Deterministic 4-character checksum computed from `Block 1 + Block 2 + Block 3 + tenantId`:
     ```typescript
     let hash = 0x811c9dc5;
     const seed = `OIUP${planCode}${cleanHash}${tenantId}`;
     for (let i = 0; i < seed.length; i++) {
       hash ^= seed.charCodeAt(i);
       hash = Math.imul(hash, 0x01000193);
     }
     const checksum = Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(-4);
     ```
  5. Formatted Key: `OIUP-${planCode}-${cleanHash}-${checksum}` (e.g. `OIUP-ENT1-8F42-K9L2`).
- **State Transformations**:
  - Appends new `IssuedLicenseRecord` to target tenant's `licenseKeys` array:
    ```typescript
    {
      key: formattedKey,
      planTier: plan,
      machineHash: cleanHash,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Active'
    }
    ```
- **Return**: Returns the formatted 16-character license key string.

### 4.8 `updateDeliveryStatus(dispatchId: string, status: DeliveryRiderStatus, codCollected?: boolean): void`
- **Purpose**: Delivery driver & aggregator dispatch fulfillment. Tracks rider lifecycle transitions (`assigned` → `arrived` → `dispatched` → `delivered`) and reconciles Cash-on-Delivery cash.
- **Signature**:
  ```typescript
  updateDeliveryStatus: (dispatchId: string, status: DeliveryRiderStatus, codCollected?: boolean) => void;
  ```
- **Validation**:
  - Validates `dispatchId` exists in `dispatches`.
  - Validates `status` is a member of `DeliveryRiderStatus`.
- **State Transformations**:
  - Updates `dispatch.riderStatus = status`.
  - If `status === 'delivered'`:
    - Stamps `dispatch.deliveredAt = new Date().toISOString()`.
  - **COD Reconciliation**:
    - If `codCollected !== undefined`:
      - Sets `dispatch.codCollected = codCollected`.
      - If `codCollected === true && dispatch.isCod`:
        - Finds associated order in `orders`.
        - Marks `order.paymentStatus = 'paid'`.
        - Sets `order.settlement = { method: 'cash', paidAt: new Date().toISOString(), receiptPrinted: true, cashDrawerPulsed: false }`.
        - Increments cash drawer till: `activeCashShift.grossCashSales += dispatch.codAmount` and `activeCashShift.expectedCashInDrawer += dispatch.codAmount`.

---

## 5. Complete Implementation Blueprint for `landing/src/lib/dashboard-store.ts`

The complete, copy-pasteable TypeScript blueprint below integrates all requirements, types, seed data, and mutation actions.

```typescript
"use client";

import { useSyncExternalStore, useEffect, useState } from "react";
import type {
  OperationalRole,
  KitchenStationType,
  TicketItemStatus,
  TableStatus,
  PaymentMethodType,
  DeliveryRiderStatus,
  AggregatorChannel,
  CourseType,
  RestaurantOutlet,
  StaffUser,
  OrderItem,
  RestaurantTable,
  RestaurantOrder,
  ShiftZReport,
  DeliveryDispatch,
  PlatformTenant,
  CentralMenuItem,
  SplitSettlementDetails,
  ShiftClosureInput,
  DrawerPulseEvent,
  ActiveShiftTill,
  PlanTier,
} from "./dashboard-models";

// ============================================================================
// STORE STATE INTERFACE
// ============================================================================

export interface DashboardState {
  // Navigation & Perspective
  activePerspective: "merchant" | "founder";
  activeRole: OperationalRole;
  selectedOutletId: string; // "all" or specific outlet id
  isHydrated: boolean;

  // Multi-Outlet Restaurant Chain
  outlets: RestaurantOutlet[];
  catalog: CentralMenuItem[];
  tables: RestaurantTable[];
  orders: RestaurantOrder[];
  staff: StaffUser[];
  zReports: ShiftZReport[];
  dispatches: DeliveryDispatch[];

  // Active Cash Drawer & Session State
  activeCashShift: ActiveShiftTill;
  drawerPulseHistory: DrawerPulseEvent[];

  // Platform Founder Entities
  tenants: PlatformTenant[];
}

// ============================================================================
// INITIAL SEED DATA: SPICE ROUTE HOSPITALITY GROUP
// ============================================================================

export const INITIAL_DASHBOARD_STATE: DashboardState = {
  activePerspective: "merchant",
  activeRole: "owner",
  selectedOutletId: "all",
  isHydrated: false,

  outlets: [
    {
      id: "outlet-1",
      name: "Downtown Bistro (Flagship)",
      code: "DEL-CP-01",
      location: "42 Connaught Place, New Delhi",
      city: "New Delhi",
      stateCode: "07",
      gstin: "07AAAAA0000A1Z5",
      fssaiNumber: "10019011000234",
      todaySales: 48920,
      ordersCount: 48,
      avgTicket: 1019.16,
      activeTables: "8 / 12",
      tenders: { upi: 28420, cash: 14200, card: 6300 },
      posTerminals: 2,
      status: "Operational",
      enginePort: ":3001 (POS Engine) • :3002 (KDS) • :3003 (Waiter)",
      hardware: "2x 80mm ESC/POS Printers • 24V Solenoid Till Active",
      s3Bucket: "orderitup-tenant-spiceroute",
    },
    {
      id: "outlet-2",
      name: "Cyber Hub Express (QSR)",
      code: "HR-GGN-02",
      location: "Building 10B, DLF Cyber Hub, Gurugram",
      city: "Gurugram",
      stateCode: "06",
      gstin: "06AAAAA0000A1Z2",
      fssaiNumber: "10019011000235",
      todaySales: 64150,
      ordersCount: 112,
      avgTicket: 572.76,
      activeTables: "10 / 12",
      tenders: { upi: 49200, cash: 3000, card: 11950 },
      posTerminals: 2,
      status: "Operational",
      enginePort: ":3001 (POS Engine) • :3002 (KDS)",
      hardware: "2x 80mm ESC/POS Printers • Kitchen Bump Bar Active",
      s3Bucket: "orderitup-tenant-spiceroute",
    },
    {
      id: "outlet-3",
      name: "Airport Terminal 3 Hub",
      code: "DEL-IGI-03",
      location: "Departures Gate 41, IGI Airport T3, New Delhi",
      city: "New Delhi",
      stateCode: "07",
      gstin: "07AAAAA0000A1Z6",
      fssaiNumber: "10019011000236",
      todaySales: 32400,
      ordersCount: 56,
      avgTicket: 578.57,
      activeTables: "4 / 8",
      tenders: { upi: 10200, cash: 2400, card: 19800 },
      posTerminals: 2,
      status: "Operational",
      enginePort: ":3001 (POS Engine) • :3002 (KDS)",
      hardware: "1x 80mm ESC/POS Printer • Standalone Barcode Terminal",
      s3Bucket: "orderitup-tenant-spiceroute",
    },
  ],

  catalog: [
    {
      id: "prod-001",
      name: "Truffle Mushroom Wood-Fired Pizza",
      category: "Pizzas",
      basePrice: 540,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "oven",
      course: "main",
      dietaryTag: "veg",
      branchOverrides: {
        "outlet-2": { priceOverride: 520, isAvailable: true },
        "outlet-3": { priceOverride: 620, isAvailable: true },
      },
    },
    {
      id: "prod-002",
      name: "Artisanal Paneer Tikka Platter",
      category: "Starters",
      basePrice: 380,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "tandoor",
      course: "starter",
      dietaryTag: "veg",
      branchOverrides: {
        "outlet-3": { priceOverride: 420, isAvailable: true },
      },
    },
    {
      id: "prod-003",
      name: "24-Hour Slow Cooked Dal Makhani",
      category: "Mains",
      basePrice: 420,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "oven",
      course: "main",
      dietaryTag: "veg",
      branchOverrides: {
        "outlet-3": { priceOverride: 480, isAvailable: true },
      },
    },
    {
      id: "prod-004",
      name: "Clay Oven Butter Naan",
      category: "Mains",
      basePrice: 85,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "tandoor",
      course: "main",
      dietaryTag: "veg",
      branchOverrides: {
        "outlet-3": { priceOverride: 110, isAvailable: true },
      },
    },
    {
      id: "prod-005",
      name: "Awadhi Murgh Dum Biryani",
      category: "Mains",
      basePrice: 520,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "tandoor",
      course: "main",
      dietaryTag: "non-veg",
      branchOverrides: {
        "outlet-3": { priceOverride: 590, isAvailable: true },
      },
    },
    {
      id: "prod-006",
      name: "Classic Cold Brew Latte",
      category: "Beverages",
      basePrice: 220,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "bar",
      course: "beverage",
      dietaryTag: "veg",
      branchOverrides: {
        "outlet-3": { priceOverride: 260, isAvailable: true },
      },
    },
    {
      id: "prod-007",
      name: "Butter Chicken Bao (x3)",
      category: "Starters",
      basePrice: 460,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "grill",
      course: "starter",
      dietaryTag: "non-veg",
      branchOverrides: {
        "outlet-3": { priceOverride: 510, isAvailable: true },
      },
    },
    {
      id: "prod-008",
      name: "Belgian Dark Chocolate Lava Cake",
      category: "Desserts",
      basePrice: 280,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "bar",
      course: "dessert",
      dietaryTag: "egg",
      branchOverrides: {
        "outlet-3": { priceOverride: 320, isAvailable: true },
      },
    },
  ],

  tables: [
    // Indoor Dining
    { id: "tbl-indoor-01", number: "T-01", floor: "Indoor", capacity: 2, status: "available" },
    {
      id: "tbl-indoor-02",
      number: "T-02",
      floor: "Indoor",
      capacity: 4,
      status: "occupied",
      currentOrderId: "ord-101",
      seatedAt: "28 mins ago",
      waiterId: "usr_server_01",
      guestCount: 3,
    },
    { id: "tbl-indoor-03", number: "T-03", floor: "Indoor", capacity: 4, status: "reserved" },
    {
      id: "tbl-indoor-04",
      number: "T-04",
      floor: "Indoor",
      capacity: 4,
      status: "occupied",
      currentOrderId: "ord-104",
      seatedAt: "42 mins ago",
      waiterId: "usr_server_01",
      guestCount: 4,
    },
    {
      id: "tbl-indoor-05",
      number: "T-05",
      floor: "Indoor",
      capacity: 6,
      status: "billed",
      currentOrderId: "ord-103",
      seatedAt: "65 mins ago",
      waiterId: "usr_server_01",
      guestCount: 6,
    },
    { id: "tbl-indoor-06", number: "T-06", floor: "Indoor", capacity: 2, status: "available" },

    // Patio Garden
    { id: "tbl-patio-01", number: "P-01", floor: "Patio", capacity: 4, status: "available" },
    {
      id: "tbl-patio-02",
      number: "P-02",
      floor: "Patio",
      capacity: 2,
      status: "occupied",
      currentOrderId: "ord-102",
      seatedAt: "14 mins ago",
      guestCount: 2,
    },
    { id: "tbl-patio-03", number: "P-03", floor: "Patio", capacity: 4, status: "cleaning" },
    { id: "tbl-patio-04", number: "P-04", floor: "Patio", capacity: 6, status: "available" },

    // Rooftop Lounge
    { id: "tbl-roof-01", number: "R-01", floor: "Rooftop", capacity: 2, status: "available" },
    { id: "tbl-roof-02", number: "R-02", floor: "Rooftop", capacity: 4, status: "occupied", seatedAt: "35 mins ago" },
    { id: "tbl-roof-03", number: "R-03", floor: "Rooftop", capacity: 6, status: "reserved" },
    { id: "tbl-roof-04", number: "R-04", floor: "Rooftop", capacity: 4, status: "available" },

    // Private Dining Room
    { id: "tbl-pdr-01", number: "PDR-01", floor: "Private Dining", capacity: 10, status: "available" },
  ],

  orders: [
    // Order #101: Preparing in oven (Amber SLA Alert)
    {
      id: "ord-101",
      orderNumber: "#101",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-indoor-02",
      tableName: "T-02",
      pax: 3,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      items: [
        {
          id: "item-101-1",
          productId: "prod-001",
          productName: "Truffle Mushroom Wood-Fired Pizza",
          quantity: 1,
          unitPrice: 540,
          modifiers: [{ id: "mod-1", name: "Extra Mozzarella", price: 60 }],
          course: "main",
          station: "oven",
          status: "preparing",
          specialInstructions: "Crispy thin crust, well done",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
        {
          id: "item-101-2",
          productId: "prod-003",
          productName: "24-Hour Slow Cooked Dal Makhani",
          quantity: 1,
          unitPrice: 420,
          modifiers: [{ id: "mod-2", name: "White Butter", price: 30 }],
          course: "main",
          station: "oven",
          status: "preparing",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
        {
          id: "item-101-3",
          productId: "prod-004",
          productName: "Clay Oven Butter Naan",
          quantity: 3,
          unitPrice: 85,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "preparing",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
      ],
      subtotal: 1215,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 0,
      cgst: 36.13,
      sgst: 36.13,
      taxTotal: 72.26,
      roundOff: 0.74,
      total: 1518,
      paymentStatus: "unpaid",
      prepStartedAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(), // 9 mins ago
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },

    // Order #102: Ready at bar (Green SLA badge)
    {
      id: "ord-102",
      orderNumber: "#102",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-patio-02",
      tableName: "P-02",
      pax: 2,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      items: [
        {
          id: "item-102-1",
          productId: "prod-006",
          productName: "Classic Cold Brew Latte",
          quantity: 2,
          unitPrice: 220,
          modifiers: [{ id: "mod-3", name: "Oat Milk Sub (x2)", price: 80 }],
          course: "beverage",
          station: "bar",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
        {
          id: "item-102-2",
          productId: "prod-008",
          productName: "Belgian Dark Chocolate Lava Cake",
          quantity: 1,
          unitPrice: 280,
          modifiers: [],
          course: "dessert",
          station: "bar",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "egg",
        },
      ],
      subtotal: 720,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 0,
      cgst: 18,
      sgst: 18,
      taxTotal: 36,
      roundOff: 0,
      total: 756,
      paymentStatus: "unpaid",
      prepStartedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      readyAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },

    // Order #103: Billed at counter (Awaiting Split Settlement)
    {
      id: "ord-103",
      orderNumber: "#103",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-indoor-05",
      tableName: "T-05",
      pax: 6,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      items: [
        {
          id: "item-103-1",
          productId: "prod-001",
          productName: "Truffle Mushroom Wood-Fired Pizza",
          quantity: 2,
          unitPrice: 540,
          modifiers: [],
          course: "main",
          station: "oven",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
        {
          id: "item-103-2",
          productId: "prod-005",
          productName: "Awadhi Murgh Dum Biryani",
          quantity: 2,
          unitPrice: 520,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "non-veg",
        },
        {
          id: "item-103-3",
          productId: "prod-004",
          productName: "Clay Oven Butter Naan",
          quantity: 4,
          unitPrice: 85,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
      ],
      subtotal: 2315,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 0,
      cgst: 57.88,
      sgst: 57.88,
      taxTotal: 115.76,
      roundOff: 0.24,
      total: 2431,
      paymentStatus: "unpaid",
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },

    // Order #104: Tableside dining (Multi-Course Progression)
    {
      id: "ord-104",
      orderNumber: "#104",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-indoor-04",
      tableName: "T-04",
      pax: 4,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      items: [
        {
          id: "item-104-1",
          productId: "prod-002",
          productName: "Artisanal Paneer Tikka Platter",
          quantity: 2,
          unitPrice: 380,
          modifiers: [{ id: "mod-4", name: "Mint Chutney", price: 0 }],
          course: "starter",
          station: "tandoor",
          status: "served",
          specialInstructions: "Chef special spice blend",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
        {
          id: "item-104-2",
          productId: "prod-001",
          productName: "Truffle Mushroom Wood-Fired Pizza",
          quantity: 1,
          unitPrice: 540,
          modifiers: [{ id: "mod-5", name: "Extra Mozzarella", price: 60 }],
          course: "main",
          station: "oven",
          status: "preparing",
          specialInstructions: "Course Fired | Crispy crust",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
        {
          id: "item-104-3",
          productId: "prod-006",
          productName: "Classic Cold Brew Latte",
          quantity: 2,
          unitPrice: 220,
          modifiers: [{ id: "mod-6", name: "Oat Milk Sub", price: 80 }],
          course: "beverage",
          station: "bar",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
        {
          id: "item-104-4",
          productId: "prod-008",
          productName: "Belgian Dark Chocolate Lava Cake",
          quantity: 1,
          unitPrice: 280,
          modifiers: [{ id: "mod-7", name: "Vanilla Bean Gelato", price: 50 }],
          course: "dessert",
          station: "bar",
          status: "pending",
          specialInstructions: "Hold for dessert call",
          hsnSac: "996331",
          dietaryTag: "egg",
        },
      ],
      subtotal: 1740,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 0,
      cgst: 48.25,
      sgst: 48.25,
      taxTotal: 96.5,
      roundOff: 0.5,
      total: 2027,
      paymentStatus: "unpaid",
      createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],

  staff: [
    {
      id: "usr_owner_01",
      name: "Priya Sharma",
      email: "priya@spiceroute.in",
      role: "owner",
      pin: "9021",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Just now",
    },
    {
      id: "usr_manager_01",
      name: "Arjun Verma",
      email: "arjun@spiceroute.in",
      role: "manager",
      pin: "5512",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "3 mins ago",
    },
    {
      id: "usr_cashier_01",
      name: "Rohit Singh",
      email: "rohit.singh@spiceroute.in",
      role: "cashier",
      pin: "1044",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Active now",
    },
    {
      id: "usr_chef_01",
      name: "Marco Rossi",
      email: "marco.rossi@spiceroute.in",
      role: "chef",
      pin: "7732",
      activeOutletId: "outlet-1",
      assignedStation: "all",
      isActive: true,
      lastActive: "Active on KDS",
    },
    {
      id: "usr_server_01",
      name: "Aman Kapoor",
      email: "aman.kapoor@spiceroute.in",
      role: "server",
      pin: "2481",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Active on Floor",
    },
    {
      id: "usr_acc_01",
      name: "Kavita Rao",
      email: "kavita.rao@spiceroute.in",
      role: "accountant",
      pin: "3391",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Auditing shift",
    },
    {
      id: "usr_driver_01",
      name: "Ramesh V",
      email: "ramesh.v@spiceroute.in",
      role: "driver",
      pin: "6120",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Out for delivery",
    },
  ],

  zReports: [
    {
      id: "zreport-41",
      zNumber: 41,
      outletId: "outlet-1",
      terminalId: "POS-01",
      businessDate: "2026-10-30",
      openedAt: "2026-10-30T10:00:00Z",
      closedAt: "2026-10-30T23:30:00Z",
      cashierName: "Rohit Singh",
      supervisorName: "Arjun Verma",
      openingFloat: 5000,
      grossCashSales: 18400,
      cashRefunds: 0,
      expectedCashInDrawer: 23400,
      actualCountedCash: 23400,
      cashVariance: 0,
      cardTotal: 12800,
      upiTotal: 31200,
      grossSalesTotal: 62400,
      cgstTotal: 1485.71,
      sgstTotal: 1485.71,
      totalTaxCollected: 2971.42,
      totalBillsIssued: 58,
      status: "balanced",
      notes: "Shift closed with perfect register balance. Cash dropped to safe.",
    },
    {
      id: "zreport-42",
      zNumber: 42,
      outletId: "outlet-1",
      terminalId: "POS-01",
      businessDate: "2026-10-31",
      openedAt: "2026-10-31T09:30:00Z",
      closedAt: "2026-10-31T16:00:00Z",
      cashierName: "Rohit Singh",
      supervisorName: "Arjun Verma",
      openingFloat: 5000,
      grossCashSales: 14200,
      cashRefunds: 0,
      expectedCashInDrawer: 19200,
      actualCountedCash: 19150,
      cashVariance: -50,
      cardTotal: 6300,
      upiTotal: 28420,
      grossSalesTotal: 48920,
      cgstTotal: 1164.76,
      sgstTotal: 1164.76,
      totalTaxCollected: 2329.52,
      totalBillsIssued: 48,
      status: "variance_flagged",
      notes: "Shortage alert: ₹50.00 discrepancy on cash drawer till. Under audit by Kavita Rao.",
    },
    {
      id: "zreport-43",
      zNumber: 43,
      outletId: "outlet-2",
      terminalId: "POS-02",
      businessDate: "2026-10-31",
      openedAt: "2026-10-31T08:00:00Z",
      closedAt: "2026-10-31T15:30:00Z",
      cashierName: "Vikas Gupta",
      supervisorName: "Arjun Verma",
      openingFloat: 3000,
      grossCashSales: 8200,
      cashRefunds: 200,
      expectedCashInDrawer: 11000,
      actualCountedCash: 11020,
      cashVariance: 20,
      cardTotal: 11950,
      upiTotal: 49200,
      grossSalesTotal: 69350,
      cgstTotal: 1651.19,
      sgstTotal: 1651.19,
      totalTaxCollected: 3302.38,
      totalBillsIssued: 74,
      status: "variance_flagged",
      notes: "Overage of ₹20.00 due to uncollected small change.",
    },
  ],

  dispatches: [
    {
      id: "disp-001",
      dispatchNo: "D-801",
      orderId: "ord-105",
      orderNumber: "#105",
      channel: "swiggy",
      customerName: "Vikram Malhotra",
      customerPhone: "+91 98111 22334",
      maskedPhone: "+91 98*** **334",
      deliveryAddress: "Apt 1402, Tower 4, The Magnolias, DLF Phase 5, Gurugram",
      landmark: "Near Club House Gate 2",
      riderName: "Sumit Kumar",
      riderPhone: "+91 99887 76655",
      riderStatus: "dispatched",
      isCod: true,
      codAmount: 840,
      codCollected: false,
      estimatedMinutes: 18,
      dispatchedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: "disp-002",
      dispatchNo: "D-802",
      orderId: "ord-106",
      orderNumber: "#106",
      channel: "zomato",
      customerName: "Ananya Sen",
      customerPhone: "+91 98222 33445",
      maskedPhone: "+91 98*** **445",
      deliveryAddress: "Villa 28, Silver Oaks, Golf Course Road, Gurugram",
      landmark: "Opposite Central Plaza",
      riderName: "Rahul Yadav",
      riderPhone: "+91 99112 23344",
      riderStatus: "assigned",
      isCod: false,
      codAmount: 0,
      codCollected: true,
      estimatedMinutes: 25,
      dispatchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "disp-003",
      dispatchNo: "D-803",
      orderId: "ord-108",
      orderNumber: "#108",
      channel: "direct",
      customerName: "Rajesh Gupta",
      customerPhone: "+91 98333 44556",
      maskedPhone: "+91 98*** **556",
      deliveryAddress: "Flat 4B, Rohit House, 3 Tolstoy Marg, Connaught Place, New Delhi",
      landmark: "Next to British Council Library",
      riderName: "Ramesh V (In-House Driver)",
      riderPhone: "+91 98110 55443",
      riderStatus: "arrived",
      isCod: true,
      codAmount: 1450,
      codCollected: false,
      estimatedMinutes: 12,
      dispatchedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    },
  ],

  activeCashShift: {
    openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    openingFloat: 5000,
    grossCashSales: 14200,
    cashRefunds: 0,
    expectedCashInDrawer: 19200,
  },

  drawerPulseHistory: [
    {
      id: "pulse-01",
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      orderId: "ord-098",
      amount: 1200,
      reason: "Cash Settlement Kick (0x1B, 0x70, 0x00, 0x19, 0xFA)",
    },
    {
      id: "pulse-02",
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      amount: 0,
      reason: "Manual Cashier Drawer Audit Pulse",
    },
  ],

  tenants: [
    {
      id: "tenant-0892",
      businessName: "Spice Route Hospitality Group",
      ownerName: "Priya Sharma",
      ownerEmail: "priya@spiceroute.in",
      ownerPhone: "+91 98110 23456",
      tier: "Enterprise Chain",
      tierCode: "enterprise",
      outletsCount: 3,
      activeTerminals: 6,
      s3Bucket: "orderitup-tenant-spiceroute",
      monthGmv: 1485200,
      lastSync: "2 mins ago",
      status: "Active",
      city: "New Delhi & Gurugram",
      licenseKeys: [
        {
          key: "OIUP-ENT1-8F42-K9L2",
          planTier: "enterprise",
          machineHash: "8F42",
          issuedAt: "2026-01-15T10:00:00Z",
          expiresAt: "2027-01-15T10:00:00Z",
          status: "Active",
        },
        {
          key: "OIUP-ENT1-8F43-M3P1",
          planTier: "enterprise",
          machineHash: "8F43",
          issuedAt: "2026-01-15T10:00:00Z",
          expiresAt: "2027-01-15T10:00:00Z",
          status: "Active",
        },
        {
          key: "OIUP-ENT1-B892-4C7D",
          planTier: "enterprise",
          machineHash: "B892",
          issuedAt: "2026-02-01T10:00:00Z",
          expiresAt: "2027-02-01T10:00:00Z",
          status: "Active",
        },
      ],
      s3Metrics: {
        totalSizeMb: 589.6,
        objectCount: 3514,
        backupsCount: 14,
        lastBackupIso: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
      },
    },
    {
      id: "tenant-0441",
      businessName: "Urban Bites Fast-Casual Co.",
      ownerName: "Amit Verma",
      ownerEmail: "amit@urbanbites.co",
      ownerPhone: "+91 98220 34567",
      tier: "Pro Multi-Outlet",
      tierCode: "pro",
      outletsCount: 2,
      activeTerminals: 4,
      s3Bucket: "orderitup-tenant-urbanbites",
      monthGmv: 892400,
      lastSync: "5 mins ago",
      status: "Active",
      city: "Bengaluru",
      licenseKeys: [
        {
          key: "OIUP-PRO1-7A11-X8Y4",
          planTier: "pro",
          machineHash: "7A11",
          issuedAt: "2026-03-01T10:00:00Z",
          expiresAt: "2027-03-01T10:00:00Z",
          status: "Active",
        },
      ],
      s3Metrics: {
        totalSizeMb: 242.4,
        objectCount: 1912,
        backupsCount: 8,
        lastBackupIso: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
      },
    },
    {
      id: "tenant-0129",
      businessName: "Cafe Milano Roasters",
      ownerName: "Marco Rossi",
      ownerEmail: "marco@cafemilano.com",
      ownerPhone: "+91 98330 45678",
      tier: "Single Store Pilot",
      tierCode: "starter",
      outletsCount: 1,
      activeTerminals: 2,
      s3Bucket: "orderitup-tenant-milano",
      monthGmv: 420100,
      lastSync: "1 min ago",
      status: "Active",
      city: "Mumbai",
      licenseKeys: [
        {
          key: "OIUP-STR1-9C33-R2T5",
          planTier: "starter",
          machineHash: "9C33",
          issuedAt: "2026-05-10T10:00:00Z",
          expiresAt: "2027-05-10T10:00:00Z",
          status: "Active",
        },
      ],
      s3Metrics: {
        totalSizeMb: 112.8,
        objectCount: 924,
        backupsCount: 4,
        lastBackupIso: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      },
    },
    {
      id: "tenant-0773",
      businessName: "The Coastal Catch Bistro",
      ownerName: "Sunita Rao",
      ownerEmail: "sunita@coastalcatch.in",
      ownerPhone: "+91 98440 56789",
      tier: "Enterprise Chain",
      tierCode: "enterprise",
      outletsCount: 4,
      activeTerminals: 8,
      s3Bucket: "orderitup-tenant-coastal",
      monthGmv: 2140900,
      lastSync: "4 mins ago",
      status: "Active",
      city: "Goa & Kochi",
      licenseKeys: [
        {
          key: "OIUP-ENT1-6D99-W1Q8",
          planTier: "enterprise",
          machineHash: "6D99",
          issuedAt: "2026-04-12T10:00:00Z",
          expiresAt: "2027-04-12T10:00:00Z",
          status: "Active",
        },
      ],
      s3Metrics: {
        totalSizeMb: 642.5,
        objectCount: 4982,
        backupsCount: 19,
        lastBackupIso: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
    },
  ],
};

// ============================================================================
// SINGLETON OBSERVABLE STORE WITH LOCALSTORAGE SYNC
// ============================================================================

const STORAGE_KEY = "orderitup_dashboard_state_v1";

let currentState: DashboardState = INITIAL_DASHBOARD_STATE;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function persistState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  } catch (err) {
    console.warn("[DashboardStore] LocalStorage write failed:", err);
  }
}

export function getDashboardSnapshot(): DashboardState {
  return currentState;
}

export function getDashboardServerSnapshot(): DashboardState {
  return INITIAL_DASHBOARD_STATE;
}

export function subscribeDashboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateDashboardState(updater: (prev: DashboardState) => DashboardState): void {
  currentState = updater(currentState);
  persistState();
  notifyListeners();
}

// Client-side hydration runner
export function hydrateDashboardStore(): void {
  if (typeof window === "undefined" || currentState.isHydrated) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      currentState = { ...parsed, isHydrated: true };
    } else {
      currentState = { ...currentState, isHydrated: true };
      persistState();
    }
  } catch {
    currentState = { ...currentState, isHydrated: true };
  }
  notifyListeners();
}

// Cross-tab synchronization
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        currentState = { ...JSON.parse(e.newValue), isHydrated: true };
        notifyListeners();
      } catch {
        // ignore invalid payload
      }
    }
  });
}

// ============================================================================
// MUTATION ACTIONS
// ============================================================================

export const dashboardActions = {
  // 1. Bump Kitchen Ticket
  bumpTicket(orderId: string, itemId?: string, newStatus?: TicketItemStatus): void {
    updateDashboardState((state) => {
      const orders = state.orders.map((order) => {
        if (order.id !== orderId) return order;

        const updatedItems = order.items.map((item) => {
          if (itemId && itemId !== "all" && item.id !== itemId) return item;

          let targetStatus = newStatus;
          if (!targetStatus) {
            if (item.status === "pending") targetStatus = "preparing";
            else if (item.status === "preparing") targetStatus = "ready";
            else if (item.status === "ready") targetStatus = "served";
            else targetStatus = item.status;
          }

          return { ...item, status: targetStatus };
        });

        const allReady = updatedItems.length > 0 && updatedItems.every((i) => i.status === "ready" || i.status === "served");
        const hasPreparing = updatedItems.some((i) => i.status === "preparing");

        return {
          ...order,
          items: updatedItems,
          prepStartedAt: hasPreparing && !order.prepStartedAt ? new Date().toISOString() : order.prepStartedAt,
          readyAt: allReady && !order.readyAt ? new Date().toISOString() : order.readyAt,
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...state, orders };
    });
  },

  // 2. Fire Course (Tableside Waiter Handheld)
  fireCourse(tableId: string, course: CourseType): void {
    updateDashboardState((state) => {
      const table = state.tables.find((t) => t.id === tableId);
      if (!table || !table.currentOrderId) return state;

      const orders = state.orders.map((order) => {
        if (order.id !== table.currentOrderId) return order;

        const updatedItems = order.items.map((item) => {
          if (item.course === course && item.status === "pending") {
            return {
              ...item,
              status: "preparing" as TicketItemStatus,
              specialInstructions: (item.specialInstructions ? item.specialInstructions + " | " : "") + "Course Fired",
            };
          }
          return item;
        });

        return {
          ...order,
          items: updatedItems,
          prepStartedAt: order.prepStartedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...state, orders };
    });
  },

  // 3. Settle Counter Payment (Split Tenders + 24V Drawer Solenoid + Table Freeing)
  settlePayment(orderId: string, paymentMethod: PaymentMethodType, splitDetails?: SplitSettlementDetails): void {
    updateDashboardState((state) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || order.paymentStatus === "paid") return state;

      const cashAmount = paymentMethod === "cash" ? order.total : paymentMethod === "split" ? (splitDetails?.cash || 0) : 0;
      const upiAmount = paymentMethod === "upi" ? order.total : paymentMethod === "split" ? (splitDetails?.upi || 0) : 0;
      const cardAmount = paymentMethod === "card" ? order.total : paymentMethod === "split" ? (splitDetails?.card || 0) : 0;

      // Update Order
      const updatedOrders = state.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentStatus: "paid" as const,
          settlement: {
            method: paymentMethod,
            splitBreakdown: splitDetails,
            paidAt: new Date().toISOString(),
            receiptPrinted: true,
            cashDrawerPulsed: cashAmount > 0,
          },
          updatedAt: new Date().toISOString(),
        };
      });

      // Free Linked Dining Table
      let updatedTables = state.tables;
      if (order.tableId) {
        updatedTables = state.tables.map((t) => {
          if (t.id !== order.tableId) return t;
          return {
            ...t,
            status: "available" as TableStatus,
            currentOrderId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
          };
        });
      }

      // Update Cash Drawer Pulse History & Shift Till
      const updatedPulseHistory = [...state.drawerPulseHistory];
      const updatedShift = { ...state.activeCashShift };
      if (cashAmount > 0) {
        updatedPulseHistory.unshift({
          id: `pulse-${Date.now()}`,
          timestamp: new Date().toISOString(),
          orderId: order.orderNumber,
          amount: cashAmount,
          reason: "Cash Settlement Kick (0x1B, 0x70, 0x00, 0x19, 0xFA)",
        });
        updatedShift.grossCashSales += cashAmount;
        updatedShift.expectedCashInDrawer += cashAmount;
      }

      // Update Outlet Sales Aggregates
      const updatedOutlets = state.outlets.map((outlet) => {
        if (outlet.id !== order.outletId) return outlet;
        const newSales = outlet.todaySales + order.total;
        const newCount = outlet.ordersCount + 1;
        return {
          ...outlet,
          todaySales: newSales,
          ordersCount: newCount,
          avgTicket: Math.round(newSales / newCount),
          tenders: {
            cash: outlet.tenders.cash + cashAmount,
            upi: outlet.tenders.upi + upiAmount,
            card: outlet.tenders.card + cardAmount,
          },
        };
      });

      return {
        ...state,
        orders: updatedOrders,
        tables: updatedTables,
        outlets: updatedOutlets,
        activeCashShift: updatedShift,
        drawerPulseHistory: updatedPulseHistory,
      };
    });
  },

  // 4. Record Shift Closure & Generate Z-Report
  recordShiftClosure(shiftData: ShiftClosureInput): ShiftZReport {
    let generatedReport: ShiftZReport | null = null;

    updateDashboardState((state) => {
      const opening = state.activeCashShift.openingFloat;
      const grossCash = state.activeCashShift.grossCashSales;
      const refunds = state.activeCashShift.cashRefunds;
      const expected = opening + grossCash - refunds;
      const variance = shiftData.actualCountedCash - expected;

      const nextZNumber = state.zReports.length > 0 ? Math.max(...state.zReports.map((z) => z.zNumber)) + 1 : 44;

      generatedReport = {
        id: `zreport-${nextZNumber}`,
        zNumber: nextZNumber,
        outletId: shiftData.outletId,
        terminalId: "POS-01",
        businessDate: new Date().toISOString().split("T")[0],
        openedAt: state.activeCashShift.openedAt,
        closedAt: new Date().toISOString(),
        cashierName: shiftData.cashierName,
        supervisorName: shiftData.supervisorName,
        openingFloat: opening,
        grossCashSales: grossCash,
        cashRefunds: refunds,
        expectedCashInDrawer: expected,
        actualCountedCash: shiftData.actualCountedCash,
        cashVariance: variance,
        cardTotal: 6300,
        upiTotal: 28420,
        grossSalesTotal: grossCash + 6300 + 28420,
        cgstTotal: Math.round(((grossCash + 6300 + 28420) * 0.025) * 100) / 100,
        sgstTotal: Math.round(((grossCash + 6300 + 28420) * 0.025) * 100) / 100,
        totalTaxCollected: Math.round(((grossCash + 6300 + 28420) * 0.05) * 100) / 100,
        totalBillsIssued: 48,
        status: Math.abs(variance) < 0.01 ? "balanced" : "variance_flagged",
        notes:
          shiftData.notes ||
          (variance < 0
            ? `Cash shortage of ₹${Math.abs(variance).toFixed(2)} flagged on closing register.`
            : variance > 0
            ? `Cash overage of ₹${variance.toFixed(2)} recorded.`
            : "Register closed with zero cash variance."),
      };

      const nextFloat = shiftData.nextOpeningFloat ?? 5000;
      const nextShift: ActiveShiftTill = {
        openedAt: new Date().toISOString(),
        openingFloat: nextFloat,
        grossCashSales: 0,
        cashRefunds: 0,
        expectedCashInDrawer: nextFloat,
      };

      return {
        ...state,
        zReports: [generatedReport, ...state.zReports],
        activeCashShift: nextShift,
      };
    });

    return generatedReport!;
  },

  // 5. Assign Staff Role & 4-Digit Security PIN
  assignStaffRole(staffId: string, role: OperationalRole, pin: string): void {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Staff PIN must be exactly 4 numeric digits");
    }

    updateDashboardState((state) => {
      const updatedStaff = state.staff.map((user) => {
        if (user.id !== staffId) return user;
        return {
          ...user,
          role,
          pin,
          lastActive: "Just now",
        };
      });

      return { ...state, staff: updatedStaff };
    });
  },

  // 6. Update Branch Menu Price Override
  updateBranchPriceOverride(outletId: string, itemId: string, price: number | null): void {
    if (price !== null && price < 0) {
      throw new Error("Price override cannot be negative");
    }

    updateDashboardState((state) => {
      const updatedCatalog = state.catalog.map((item) => {
        if (item.id !== itemId) return item;

        const currentOverrides = item.branchOverrides || {};
        const outletOverride = currentOverrides[outletId] || { isAvailable: true };

        return {
          ...item,
          branchOverrides: {
            ...currentOverrides,
            [outletId]: {
              ...outletOverride,
              priceOverride: price,
            },
          },
        };
      });

      return { ...state, catalog: updatedCatalog };
    });
  },

  // 7. Generate 16-Character Hardware-Bound License Key
  generateLicenseKey(tenantId: string, plan: PlanTier, machineHash: string): string {
    const cleanHash = (machineHash || "8F42").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().padEnd(4, "0").slice(0, 4);

    const planCode = plan === "enterprise" ? "ENT1" : plan === "pro" ? "PRO1" : "STR1";

    // Deterministic 4-character checksum
    let hash = 0x811c9dc5;
    const seed = `OIUP${planCode}${cleanHash}${tenantId}`;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const checksum = Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(-4);
    const key = `OIUP-${planCode}-${cleanHash}-${checksum}`;

    updateDashboardState((state) => {
      const updatedTenants = state.tenants.map((tenant) => {
        if (tenant.id !== tenantId) return tenant;

        const newLicense = {
          key,
          planTier: plan,
          machineHash: cleanHash,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: "Active" as const,
        };

        return {
          ...tenant,
          licenseKeys: [newLicense, ...(tenant.licenseKeys || [])],
        };
      });

      return { ...state, tenants: updatedTenants };
    });

    return key;
  },

  // 8. Update Delivery Status & Reconcile COD
  updateDeliveryStatus(dispatchId: string, status: DeliveryRiderStatus, codCollected?: boolean): void {
    updateDashboardState((state) => {
      const dispatch = state.dispatches.find((d) => d.id === dispatchId);
      if (!dispatch) return state;

      const isDelivered = status === "delivered";
      const isCodSettled = codCollected === true && dispatch.isCod;

      const updatedDispatches = state.dispatches.map((d) => {
        if (d.id !== dispatchId) return d;
        return {
          ...d,
          riderStatus: status,
          codCollected: codCollected !== undefined ? codCollected : d.codCollected,
          deliveredAt: isDelivered ? new Date().toISOString() : d.deliveredAt,
        };
      });

      // If COD cash was collected, update drawer till and mark associated order paid
      let updatedOrders = state.orders;
      let updatedShift = state.activeCashShift;

      if (isCodSettled) {
        updatedShift = {
          ...state.activeCashShift,
          grossCashSales: state.activeCashShift.grossCashSales + dispatch.codAmount,
          expectedCashInDrawer: state.activeCashShift.expectedCashInDrawer + dispatch.codAmount,
        };

        updatedOrders = state.orders.map((o) => {
          if (o.id !== dispatch.orderId) return o;
          return {
            ...o,
            paymentStatus: "paid" as const,
            settlement: {
              method: "cash" as const,
              paidAt: new Date().toISOString(),
              receiptPrinted: true,
              cashDrawerPulsed: false,
            },
            updatedAt: new Date().toISOString(),
          };
        });
      }

      return {
        ...state,
        dispatches: updatedDispatches,
        orders: updatedOrders,
        activeCashShift: updatedShift,
      };
    });
  },

  // Global Navigation Mutators
  setActivePerspective(perspective: "merchant" | "founder"): void {
    updateDashboardState((state) => ({ ...state, activePerspective: perspective }));
  },

  setActiveRole(role: OperationalRole): void {
    updateDashboardState((state) => ({ ...state, activeRole: role }));
  },

  setSelectedOutletId(outletId: string): void {
    updateDashboardState((state) => ({ ...state, selectedOutletId: outletId }));
  },

  resetToSeedData(): void {
    currentState = { ...INITIAL_DASHBOARD_STATE, isHydrated: true };
    persistState();
    notifyListeners();
  },
};

// ============================================================================
// REACT HOOKS
// ============================================================================

export function useDashboardStore<T>(selector: (state: DashboardState) => T): T {
  // Safe client hydration trigger
  useEffect(() => {
    hydrateDashboardStore();
  }, []);

  const state = useSyncExternalStore(subscribeDashboard, getDashboardSnapshot, getDashboardServerSnapshot);
  return selector(state);
}

export function useDashboardActions() {
  return dashboardActions;
}

// Domain-Specific Hooks
export function useActivePerspective() {
  return useDashboardStore((s) => s.activePerspective);
}

export function useActiveRole() {
  return useDashboardStore((s) => s.activeRole);
}

export function useSelectedOutletId() {
  return useDashboardStore((s) => s.selectedOutletId);
}

export function useOutlets() {
  return useDashboardStore((s) => s.outlets);
}

export function useOrders() {
  return useDashboardStore((s) => s.orders);
}

export function useTables() {
  return useDashboardStore((s) => s.tables);
}

export function useStaff() {
  return useDashboardStore((s) => s.staff);
}

export function useCatalog() {
  return useDashboardStore((s) => s.catalog);
}

export function useZReports() {
  return useDashboardStore((s) => s.zReports);
}

export function useDispatches() {
  return useDashboardStore((s) => s.dispatches);
}

export function useTenants() {
  return useDashboardStore((s) => s.tenants);
}

export function useActiveCashShift() {
  return useDashboardStore((s) => s.activeCashShift);
}

export function useDrawerPulseHistory() {
  return useDashboardStore((s) => s.drawerPulseHistory);
}

export function useIsStoreHydrated() {
  return useDashboardStore((s) => s.isHydrated);
}
```

---

## 6. Verification and Acceptance Matrix

| Verification Target | Test Method | Pass Criteria | Invalidation Condition |
| :--- | :--- | :--- | :--- |
| **SSR Static Export Safety** | Run `npm --prefix landing run build` | Builds `out/` with zero hydration mismatch warnings or SSG prerender errors. | Any server/client mismatch warning on initial render. |
| **Standard React 19 Compliance** | Review `package.json` & imports in `dashboard-store.ts` | Uses `react` 19's native `useSyncExternalStore`; 0 new packages installed. | Introducing Zustand, Redux, or heavy external state libraries. |
| **LocalStorage Persistence** | Perform mutation, trigger window refresh, inspect state | Persisted state survives reload and restores seamlessly without flicker. | State reverts to seed data upon page refresh. |
| **Cross-Tab Reactivity** | Dispatch `storage` event from parallel browser window | State in all open tabs updates reactively in real time. | Desynchronized state across tabs. |
| **KDS Ticket Bumping** | Call `bumpTicket("ord-101", "item-101-1")` | Advances item status from `preparing` to `ready`; stamps `readyAt`. | Fails to advance status or corrupts item array. |
| **Tableside Course Firing** | Call `fireCourse("tbl-indoor-04", "main")` | Finds Table T-04; changes Truffle Pizza from `pending` to `preparing`. | Fails to find table or leaves items in pending state. |
| **Cash Settlement & Drawer Pulse** | Call `settlePayment("ord-103", "cash")` | Sets order to `paid`, appends to `drawerPulseHistory`, frees Table T-05 to `available`. | Table remains billed/occupied or drawer pulse is missed. |
| **Shift Z-Report Balancing** | Call `recordShiftClosure(...)` with ₹19,150 count | Generates Z-Report with -₹50 variance; sets status `variance_flagged`; resets float. | Misses variance flag or drops opening float balance. |
| **16-Character License Generator** | Call `generateLicenseKey("tenant-0892", "enterprise", "8F42")` | Returns key matching format `OIUP-ENT1-8F42-[CHECKSUM]`; appends to tenant history. | License length != 19 (including hyphens) or invalid checksum. |
| **Delivery Dispatch & COD** | Call `updateDeliveryStatus("disp-001", "delivered", true)` | Sets rider `delivered`; marks Order #105 `paid`; adds ₹840 to drawer cash. | COD amount not added to till balance. |
| **ESLint & TypeScript** | Run `npm --prefix landing run lint` | 0 ESLint errors, zero `any` types. | Any TypeScript diagnostic error. |

---

## 7. Logic Chain & Synthesis

1. **Premise 1**: The web portal (`landing/`) is statically exported to Cloudflare Pages via Next.js 16 (`output: 'export'`), meaning zero Node.js server runtime exists in production.
2. **Premise 2**: User rules mandate offline-first operation, backend authority, zero ungrounded placeholders, and reuse of existing dependencies before adding new ones.
3. **Inference 1**: A client-side store is required that operates fully in-memory with `localStorage` persistence, zero third-party dependencies, and zero SSR hydration mismatches.
4. **Inference 2**: React 19's `useSyncExternalStore` with an observable singleton container provides the exact capabilities needed: tear-free concurrent reads, selective subscriptions, built-in server/client snapshot separation, and cross-tab storage sync.
5. **Inference 3**: Grounding the seed dataset in Priya Sharma's **Spice Route Hospitality Group** across 3 NCR branches, linking Order #104 across all 6 personas, enforcing SAC 996331 + 5% GST, and modeling isolated Amazon S3 buckets establishes end-to-end operational realism matching the core Order It Up engine.
6. **Inference 4**: Implementing the 8 validated mutation methods equips all subsequent milestone builders (M2: Personas, M3: Perspectives, M4: Shell) with a complete, turn-key API to interact with the operational state.
