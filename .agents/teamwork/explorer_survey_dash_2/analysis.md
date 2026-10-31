# Comprehensive Architectural Analysis: Role-Based Restaurant & Platform Dashboards

## 1. Executive Summary

This report establishes the complete architectural blueprints, data models, and interactive workflow designs for implementing end-to-end role-based restaurant operational dashboards in the `landing/` web portal for production deployment on Cloudflare Pages.

The Order It Up system is an offline-first restaurant operating system designed around embedded SQLite transactional durability, local network (LAN) communication (Express on `:3001`, KDS WebSocket on `:3002`, Waiter Server App on `:3003`), ESC/POS thermal printing, and isolated cloud sync (Amazon S3 / Cloudflare D1).

To elevate the current `landing/` application from high-level platform previews to production-ready operational role dashboards, we map and synthesize the requirements across all **6 operational personas**:
1. **Owner / Manager**: Multi-unit chain telemetry, cross-outlet sales & orders, staff PIN & role assignment, shift closures, and S3 backup synchronization.
2. **Front Cashier**: Live counter billing status, 80mm ESC/POS thermal receipt rendering, 24V solenoid cash drawer pulse reconciliation (`0x1B, 0x70, 0x00, 0x19, 0xFA`), and multi-tender split settlement (UPI Dynamic QR, Cash, Card).
3. **Kitchen Chef**: LAN Kitchen Display System (KDS :3002) order queue, station routing (Oven, Tandoor, Bar, Grill, Fryer), 1-tap ticket bumping (`pending` → `preparing` → `ready` → `served`), and color-coded SLA countdown alerts (<8m green, 8-15m amber, >15m red).
4. **Server / Waiter**: Mobile tableside ordering (:3003), visual floor table map across restaurant zones (Indoor, Patio, Rooftop, Private Dining), live table states, and multi-course firing (Starters, Mains, Desserts, Beverages).
5. **Accountant / Tax Compliance**: Indian GST calculation (CGST @ 2.5%, SGST @ 2.5%, SAC 996331 Restaurant Service), FSSAI compliance audit, Z-Report shift closure balancing with expected vs counted cash variances, and one-click Tally XML voucher export.
6. **Delivery Driver**: Active dispatch queue across aggregator channels (Swiggy, Zomato, Direct In-House Delivery), customer delivery address verification, rider assignment status, and Cash-on-Delivery (COD) reconciliation.

In addition, the dashboards support the dual administrative perspectives:
- **Platform Founder Admin ("For Me")**: Tenant directory, 16-character hardware-bound desktop POS license generator, customer S3 bucket isolation monitoring, and platform-wide GMV metrics.
- **Restaurant Chain Owner ("For Users")**: Multi-branch live sales comparison, centralized menu catalog with branch price overrides, and consolidated chain GST tax reports.

The implementation adheres strictly to the landing page design language: `#F8FAFC` slate-50 background, white cards with `border-slate-200/80`, vibrant orange `#F07928` brand accents, Geist typography, and a hybrid runtime architecture that operates self-contained in static browser environments (Cloudflare Pages) while seamlessly binding to local backend services when available.

---

## 2. Codebase Investigation Matrix & Evidence Base

A comprehensive audit of `main/`, `frontend/`, `tests/`, and `landing/` reveals the exact runtime paths, schemas, and operational mechanisms implemented in the Order It Up core engine:

| Operational Subsystem | Core Files Inspected | Line References | Verified Mechanism / Runtime Behavior |
| :--- | :--- | :--- | :--- |
| **SQLite Schema & Master Tables** | `main/db.ts` | Lines 4330–4850 | Master tables: `categories`, `products`, `addon_groups`, `addons`, `kitchen_stations`, `station_users`, `tables`, `customers`, `users`, `orders`, `order_items`, `bills`, `cash_closures`, `printers`, `aggregator_configs`, `raw_ingredients`, `product_recipes`. |
| **Cash Drawer Solenoid & ESC/POS** | `main/printers/thermal.ts` | Lines 768–787, 2393–2395 | ESC/POS 24V solenoid drawer kick pulse: `Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])` (ESC p 0 25 250). Appended to thermal bytes upon cash or configured split-tender settlement. |
| **Cash Closures & Shift Balancing** | `main/routes/cash-closures.ts`<br>`main/db.ts` | Lines 4006–4028 (schema)<br>Lines 282–372 (routes) | Z-Report ledger tracks: `business_date`, `scope` ('day'/'session'), `opening_float_cents`, `expected_cash_cents`, `counted_cash_cents`, `variance_cents`, `gross_collected_cents`, `refunded_cents`, `z_number`. Distinguishes drawer reality (cash left on refund) from order accounting. |
| **KDS Server & WebSocket Protocol** | `main/services/kds.ts`<br>`main/kds-server.ts` | Lines 25–455 (:3002) | WebSocket engine on port :3002. Handles JWT `auth`, `status_update`, station routing via `kitchen_stations.category_ids`, and ticket status transitions: `pending` → `preparing` → `ready` → `served`. |
| **Tableside Ordering (:3003)** | `frontend/src/app/server-standalone/page.tsx`<br>`main/routes/tables.ts` | Lines 1–421 (server)<br>Lines 11–95 (tables) | Waiter tablet portal on port :3003. Visual floor table selection, live order polling, item drafting with modifiers/notes, and immediate KOT routing to kitchen stations. |
| **Indian GST & SAC Compliance** | `landing/src/components/BillTemplateModal.tsx`<br>`main/services/tax-engine.ts` | Lines 330–363 (modal)<br>Lines 1–180 (engine) | Split GST calculation: CGST @ 2.5% + SGST @ 2.5% on food & beverage services under SAC code `996331` (restaurant catering service). FSSAI License validation (#10019011000234). |
| **Tally XML Voucher Export** | `tests/comprehensive-e2e-audit.test.ts`<br>`apps/cloud-api/src/routes/accountant.ts` | Lines 268–294 (tests)<br>Lines 89–120 (api) | Tally-compliant XML voucher generation: `<ENVELOPE>`, `<TALLYMESSAGE>`, `<VOUCHER VCHTYPE="Receipt" ACTION="Create">`, with `<LEDGERNAME>Cash in Hand</LEDGERNAME>`, `<LEDGERNAME>Restaurant Sales Account</LEDGERNAME>`, `<LEDGERNAME>Cash Over/Short Expense</LEDGERNAME>`, and tax ledgers. |
| **Delivery & Aggregator Dispatch** | `main/routes/aggregators.ts`<br>`main/services/aggregator-service.ts` | Lines 87–106, 502–523 (routes)<br>Lines 23–88, 356–375 (service) | Order dispatch schema includes: `online_platform` ('swiggy'/'zomato'/'direct'), `rider_name`, `rider_phone`, `rider_status` ('unassigned'/'assigned'/'arrived'/'dispatched'), customer address, and COD reconciliation. |
| **Staff PIN & Master Security** | `main/routes/staff.ts`<br>`main/services/master-pin.ts` | Lines 15–35, 95–130 (staff)<br>Lines 1–80 (pin) | 4-to-6 digit staff PINs (`pin_hash` via bcrypt). Master Manager PIN gates sensitive actions (refunds, voids, cash drawer kicks, discount overrides). Scoped role permissions. |
| **S3 Tenant Isolation & Outbox** | `main/services/amazon-s3.ts` | Lines 47–67, 189–210 | Isolated S3 bucket prefixes per tenant (`s3_upload_outbox` table). Tracks daily encrypted database rollups, menu image assets, and audit logs with zero tenant data commingling. |

---

## 3. Detailed Persona Architecture & Interactive Workflows

### 3.1 Owner / Manager Dashboard
- **Persona Context**: Restaurant chain executives, general managers, and multi-unit operators overseeing multiple restaurant locations.
- **Key Workflows**:
  1. *Multi-Outlet Performance Comparison*: View live metrics across connected branches (e.g. Downtown Bistro, Cyber Hub Express, Airport Terminal 3). Toggle between "All Outlets (Consolidated Chain)" and branch-specific drilldowns.
  2. *Live GMV & Tender Distribution*: Real-time aggregation of today's gross revenue, completed order counts, average ticket size, and payment method distribution (UPI QR vs Cash vs Card).
  3. *Staff PIN & Role Management*: Interactive team directory displaying employees across 6 operational roles, active status, last shift activity, and an interactive modal to assign/update 4-digit staff PINs with manager override verification.
  4. *Shift Closure Audit*: Review end-of-day Z-Reports across branches, verify closed registers, inspect over/short cash variances, and confirm supervisor sign-offs.
  5. *Cloud Backup & S3 Telemetry*: Monitor the isolated S3 bucket status (e.g. `orderitup-tenant-spiceroute`), inspect the S3 background sync outbox, and trigger manual encrypted database snapshots.

### 3.2 Front Cashier Dashboard
- **Persona Context**: Counter operators, head cashiers, and checkout attendants executing high-volume customer billing.
- **Key Workflows**:
  1. *Sub-Second Counter Billing*: Interactive cart and product selector with speed-category tabs (Pizzas, Starters, Beverages, Desserts), real-time tax computation, and fractional/quantity controls.
  2. *Split Tender Settlement*: Dedicated payment settlement modal supporting single or split tenders:
     - **UPI Dynamic QR**: Generates simulated BharatPe/Paytm/NPCI QR with intent string and real-time payment simulated hook.
     - **Cash (24V Till)**: Tendered cash calculator computing exact change return and triggering the 24V solenoid pulse.
     - **Card POS**: External EDC card terminal transaction reference entry.
     - **Split Tender Math**: Ability to split arbitrary bills (e.g., ₹1,000 Cash + ₹1,431 UPI on a ₹2,431 bill) with auto-balancing remaining balance indicators.
  3. *80mm ESC/POS Thermal Receipt Preview*: Full-fidelity preview drawer rendering monospaced 80mm thermal receipts with restaurant header, GSTIN, FSSAI number, itemized pricing, CGST/SGST breakdown, and tender details.
  4. *24V Cash Drawer Pulse & Till Reconciliation*: Interactive till drawer tool triggering the `0x1B, 0x70, 0x00, 0x19, 0xFA` solenoid command, with daily drawer cash counting (Opening Float + Cash Sales - Cash Refunds = Expected vs Actual Counted).

### 3.3 Kitchen Chef Dashboard (KDS :3002)
- **Persona Context**: Head chefs, station cooks, and kitchen brigade lines managing food preparation throughput.
- **Key Workflows**:
  1. *Real-Time Ticket Queue*: Responsive Kanban and ticket stream displaying incoming orders pushed via LAN WebSocket from the counter or waiter handhelds.
  2. *Station Routing Tabs*: Multi-station filtering allowing chefs to isolate items routed to specific prep stations:
     - **All Stations**: Master kitchen view.
     - **Oven Station**: Wood-fired pizzas, baked pastas, calzones.
     - **Tandoor Station**: Paneer tikka, kebabs, tandoori rotis/naans.
     - **Craft Bar**: Cold brew lattes, artisan mocktails, shakes.
     - **Fryer & Grill Station**: Crispy appetizers, sliders, fries.
  3. *One-Tap Ticket Bumping*: Fast touch-optimized buttons allowing cooks to bump item or order status sequentially:
     - `Pending` (amber border) → `Preparing` (in-cook flame icon) → `Ready` (green bell alert) → `Served` (archived).
  4. *Color-Coded SLA Countdown Alerts*: Dynamic timers calculating elapsed preparation time:
     - `< 8 minutes`: Normal / On-time (green badge).
     - `8 – 15 minutes`: Attention needed / Medium wait (amber pulsing badge).
     - `> 15 minutes`: Delayed / High SLA breach risk (red urgent alert).

### 3.4 Server / Waiter Dashboard (:3003)
- **Persona Context**: Floor captains, waitstaff, and bussers servicing dining tables on mobile handheld devices.
- **Key Workflows**:
  1. *Visual Floor Table Map*: Grid and canvas representation of restaurant dining sections:
     - **Indoor Dining** (Tables T-01 to T-06)
     - **Patio Garden** (Tables P-01 to P-04)
     - **Rooftop Lounge** (Tables R-01 to R-04)
     - **Private Dining Room** (Table PDR-01)
  2. *Real-Time Table State Badges*:
     - **Available** (emerald green): Ready for seating.
     - **Occupied** (crimson red): Seated diners with active order in progress.
     - **Billed** (amber): Bill printed, awaiting customer settlement.
     - **Reserved** (blue): Reserved for upcoming guest booking.
  3. *Course Firing Workflow*:
     - Dynamic item sequencing: Diners can order complete meals while waitstaff hold and release specific courses:
       - `Fire Starters`: Immediately sends appetizers to Tandoor/Fryer.
       - `Hold Mains`: Retains main courses in holding state.
       - `Fire Mains`: Dishes sent to kitchen once starters are cleared.
       - `Fire Desserts & Beverages`: Notifies pastry/bar station upon customer request.
  4. *Quick Handheld Bill Additions*: 1-tap item incrementing with modifier notes (e.g., "Crispy thin crust", "Extra spicy", "No ice").

### 3.5 Accountant / Tax Compliance Dashboard
- **Persona Context**: Financial controllers, auditors, and certified tax accountants managing store ledgers.
- **Key Workflows**:
  1. *Indian GST Compliance Ledger*:
     - Automatic separation of Taxable Value, CGST @ 2.5%, SGST @ 2.5%, and Total Invoice Value.
     - Official Harmonized System of Nomenclature / Service Accounting Code (SAC `996331` - Restaurant & Catering Services).
     - FSSAI License compliance badge and state code validation (e.g., Delhi State Code `07`).
  2. *Z-Report Shift Closure Balancing*:
     - Detailed shift register reconciliation cards:
       - `Opening Float`: e.g. ₹5,000.00
       - `Gross Cash Collected`: e.g. ₹14,200.00
       - `Cash Refunds Issued`: e.g. ₹0.00
       - `Net Expected Cash`: ₹19,200.00
       - `Physical Cash Counted`: ₹19,150.00
       - `Variance`: -₹50.00 (Shortage Alert flag)
  3. *One-Click Tally XML Export*:
     - Live generator producing authentic Tally XML voucher code containing `<TALLYMESSAGE>`, `<VOUCHER VCHTYPE="Receipt">`, Cash in Hand ledger, Sales Account ledger, and Tax Accounts. Downloadable as a `.xml` file ready for Tally Prime import.

### 3.6 Delivery Driver Dashboard
- **Persona Context**: In-house delivery riders and aggregator courier partners fulfilling out-of-store orders.
- **Key Workflows**:
  1. *Active Dispatch Queue*: Real-time stream of delivery orders categorized by dispatch source:
     - **Direct Call / In-House Delivery**
     - **Swiggy Integration**
     - **Zomato Integration**
  2. *Customer Address Verification*:
     - Verified customer drop-off address card with prominent landmark, gate instructions, and distance estimation.
     - Privacy-preserving masked phone number action ("Call Customer via Proxy").
     - 1-click Google Maps navigation deep-link.
  3. *Rider Assignment & Status Tracking*:
     - Lifecycle transitions: `Assigned` → `Arrived at Outlet` → `Out for Delivery / Dispatched` → `Delivered`.
  4. *Cash-on-Delivery (COD) Reconciliation*:
     - Clear breakdown of prepaid vs COD orders.
     - For COD orders: Expected cash collection field, physical cash received toggle, and electronic handoff receipt voucher generation.

---

## 4. Operational Data Models

To ensure strict operational realism and seamless inter-role connectivity, the data structures share unified reference IDs (`orderId`, `tableId`, `userId`, `billId`, `stationId`).

```typescript
// ============================================================================
// CORE ENUMS & PRIMITIVES
// ============================================================================

export type OperationalRole =
  | 'owner'
  | 'manager'
  | 'cashier'
  | 'chef'
  | 'server'
  | 'accountant'
  | 'driver'
  | 'superadmin';

export type KitchenStationType = 'all' | 'oven' | 'tandoor' | 'bar' | 'grill' | 'fryer';

export type TicketItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'voided';

export type TableStatus = 'available' | 'occupied' | 'billed' | 'reserved' | 'cleaning';

export type PaymentMethodType = 'cash' | 'card' | 'upi' | 'split';

export type DeliveryRiderStatus = 'unassigned' | 'assigned' | 'arrived' | 'dispatched' | 'delivered';

export type AggregatorChannel = 'direct' | 'swiggy' | 'zomato';

export type CourseType = 'starter' | 'main' | 'dessert' | 'beverage';

// ============================================================================
// RESTAURANT BRANCH & CHAIN
// ============================================================================

export interface RestaurantOutlet {
  id: string;
  name: string;
  code: string;
  location: string;
  city: string;
  stateCode: string; // e.g. "07" for Delhi
  gstin: string;     // e.g. "07AAAAA0000A1Z5"
  fssaiNumber: string; // e.g. "10019011000234"
  todaySales: number;
  ordersCount: number;
  avgTicket: number;
  activeTables: string;
  tenders: {
    upi: number;
    cash: number;
    card: number;
  };
  posTerminals: number;
  status: 'Operational' | 'Degraded' | 'Offline';
  enginePort: string;
  hardware: string;
  s3Bucket: string;
}

// ============================================================================
// STAFF & SECURITY PIN MODEL
// ============================================================================

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: OperationalRole;
  pin: string; // 4-digit PIN for terminal authorization
  activeOutletId: string;
  isActive: boolean;
  assignedStation?: KitchenStationType;
  lastActive: string;
}

// ============================================================================
// MENU & ORDER ITEMS
// ============================================================================

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  modifiers: OrderItemModifier[];
  course: CourseType;
  station: KitchenStationType;
  status: TicketItemStatus;
  specialInstructions?: string;
  hsnSac: string; // "996331"
  dietaryTag: 'veg' | 'non-veg' | 'vegan' | 'egg';
}

// ============================================================================
// TABLE MODEL
// ============================================================================

export interface RestaurantTable {
  id: string;
  number: string; // e.g. "T-04"
  floor: 'Indoor' | 'Patio' | 'Rooftop' | 'Private Dining';
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
  seatedAt?: string;
  waiterId?: string;
  guestCount?: number;
}

// ============================================================================
// TRANSACTIONAL ORDER MODEL (Interconnected across all roles)
// ============================================================================

export interface RestaurantOrder {
  id: string;
  orderNumber: string; // e.g. "#104"
  outletId: string;
  outletName: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableId?: string;
  tableName?: string;
  pax?: number;
  cashierId: string;
  cashierName: string;
  waiterId?: string;
  waiterName?: string;
  items: OrderItem[];
  subtotal: number;
  packagingCharge: number;
  deliveryCharge: number;
  discountAmount: number;
  cgst: number; // 2.5%
  sgst: number; // 2.5%
  taxTotal: number;
  roundOff: number;
  total: number;
  paymentStatus: 'unpaid' | 'paid' | 'partially_paid';
  settlement?: {
    method: PaymentMethodType;
    splitBreakdown?: {
      cash?: number;
      card?: number;
      upi?: number;
    };
    cashDrawerPulsed: boolean;
    paidAt: string;
    receiptPrinted: boolean;
  };
  deliveryDetails?: {
    channel: AggregatorChannel;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    landmark?: string;
    riderName?: string;
    riderPhone?: string;
    riderStatus: DeliveryRiderStatus;
    isCod: boolean;
    codAmount: number;
    codCollected: boolean;
  };
  prepStartedAt?: string;
  readyAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SHIFT CASH CLOSURE & Z-REPORT MODEL
// ============================================================================

export interface ShiftZReport {
  id: string;
  zNumber: number;
  outletId: string;
  terminalId: string;
  businessDate: string; // YYYY-MM-DD
  openedAt: string;
  closedAt: string;
  cashierName: string;
  supervisorName: string;
  openingFloat: number;
  grossCashSales: number;
  cashRefunds: number;
  expectedCashInDrawer: number;
  actualCountedCash: number;
  cashVariance: number; // actual - expected (negative = shortage)
  cardTotal: number;
  upiTotal: number;
  grossSalesTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  totalTaxCollected: number;
  totalBillsIssued: number;
  status: 'balanced' | 'variance_flagged';
  notes?: string;
}
```

---

## 5. Interconnected Real-World Dataset: "Spice Route Hospitality Group"

The realistic dataset revolves around Priya Sharma’s **Spice Route Hospitality Group** (3 outlets) and traces **Order #104** across all 6 personas:

### 5.1 Outlets Context
1. **Downtown Bistro (Flagship)**: Connaught Place, New Delhi. Fine Dine & Craft Cocktail Bar (12 Tables, 2 POS, :3001/:3002/:3003 active). GSTIN: `07AAAAA0000A1Z5`, FSSAI: `10019011000234`.
2. **Cyber Hub Express (QSR)**: DLF Cyber City, Gurugram. Fast casual & delivery hubs (High volume Swiggy/Zomato, 2 POS).
3. **Airport Terminal 3 Hub**: IGI Airport T3 Departures. 24/7 Transit Grab-and-Go.

### 5.2 Interconnected Transaction Lifecycle (Order #104)
- **Table**: T-04 (Indoor Dining, 4 Pax)
- **Waiter**: Aman Kapoor (`usr_server_01`, PIN: `2481`) seats guests at 19:15, takes order on mobile handheld (:3003). Fires Starters first, holds Mains.
- **Kitchen Chef**: Marco Rossi (`usr_chef_01`, PIN: `7732`) receives tickets on KDS (:3002).
  - Tandoor station prepares: *Artisanal Paneer Tikka Platter (x2)* (bumped: 4 min).
  - Oven station prepares: *Truffle Mushroom Wood-Fired Pizza* (bumped: 11 min).
  - Bar station prepares: *Classic Cold Brew Latte (x2)*.
- **Delivery Companion Dispatch**: Simultaneously, Delivery Driver Ramesh V (`usr_driver_01`) picks up Delivery Order #108 (Butter Chicken Bao + Truffle Pizza) for DLF Phase 2 with COD reconciliation.
- **Front Cashier**: Rohit Singh (`usr_cashier_01`, PIN: `1044`) pulls up Table T-04 upon bill request:
  - Subtotal: ₹1,740.00
  - Add-on modifiers: ₹190.00
  - Net Taxable: ₹1,930.00
  - CGST @ 2.5%: ₹48.25
  - SGST @ 2.5%: ₹48.25
  - Round off: +₹0.50
  - **Total**: ₹2,027.00
  - **Split Tender**: ₹1,000.00 Cash (Drawer kick pulse `0x1B, 0x70, 0x00, 0x19, 0xFA` activated) + ₹1,027.00 UPI Dynamic QR (Instant scan settlement).
  - Prints 80mm ESC/POS thermal receipt.
- **Accountant**: Kavita Rao (`usr_acc_01`, PIN: `3391`) audits end-of-shift Z-Report #42:
  - Cash variance verified (-₹50.00 shortage flagged).
  - GST SAC 996331 ledger verified.
  - 1-click downloads `tally_export_20261031.xml` with `<VOUCHER VCHTYPE="Receipt">`.
- **Chain Owner**: Priya Sharma logs into Owner Dashboard, views real-time sales uptick (+₹2,027.00) in Downtown Bistro, watches platform S3 cloud backup outbox green checkmark.

---

## 6. Interactive UI Component Specifications & Layouts

### 6.1 Top Navigation & Role Switcher
- Consistent sticky header with return arrow, Order It Up logo, and brand name.
- **Role Switcher Navigation**: A responsive selector supporting the 6 operational personas plus the 2 administrative perspectives:
  - `[Owner / Manager]` | `[Front Cashier]` | `[Kitchen Chef]` | `[Server / Waiter]` | `[Accountant]` | `[Delivery Driver]`
  - Switcher for Administrative views: `[Multi-Outlet Chain Owner]` vs `[Platform Founder Admin]`.
- **Quick Global Actions**: 
  - `[80mm Bill Preview]` button (triggers `BillTemplateModal`).
  - `[Roles & 1-Click Login]` button (triggers `CredentialsModal`).
  - Active logged-in user avatar and role badge with sign-out action.

### 6.2 Front Cashier UI View
- **Left Panel (Cart & Item Catalog)**: Category pills (Pizza, Tandoor, Beverages, Desserts) with dish cards. Active cart summary with item quantities, modifier badges, and pricing.
- **Right Panel (Settlement & Drawer)**:
  - Total display in prominent Geist/mono font (e.g. `₹2,431.00`).
  - Tender Selection: `[UPI Dynamic QR]`, `[Cash (24V Solenoid)]`, `[Card POS]`, `[Split Tender]`.
  - When UPI selected: Live simulated QR code preview with timer.
  - When Split Tender selected: Split input fields calculating remainder automatically.
  - Action buttons: `[Settle Order & Kick Drawer]` (animates drawer kick pulse notification) and `[Preview 80mm Receipt]`.
  - Quick Till Drawer Balance widget displaying current shift cash float.

### 6.3 Kitchen Chef UI View (KDS :3002)
- **Station Filter Bar**: `[All Stations (6)]`, `[Oven Station (2)]`, `[Tandoor Station (2)]`, `[Craft Bar (1)]`, `[Fryer & Grill (1)]`.
- **Kanban Board or Ticket Stream**:
  - Cards grouped by status: `Pending` | `Preparing` | `Ready` | `Served`.
  - Order card headers: Table number / Order #, order type (Dine-in vs Delivery), and elapsed timer badge (`<8m` green, `8-15m` amber, `>15m` red).
  - Item list with checkboxes and special instructions ("Well done crust", "Extra spicy").
  - 1-Tap Bump action: Advances item to next stage immediately with visual feedback.

### 6.4 Server / Waiter UI View (:3003)
- **Floor Navigation Tabs**: `[Indoor Dining]`, `[Patio Garden]`, `[Rooftop Lounge]`, `[Private Dining]`.
- **Visual Table Map**: Responsive table cards displaying table number, seating pax, current dining duration (e.g. "42m"), and color-coded status badge (`Available`, `Occupied`, `Billed`, `Reserved`).
- **Table Detail Drawer**: Clicking any occupied table reveals active items, order total, and **Course Firing Controls**:
  - `[🔥 Fire Starters]` (active)
  - `[⏳ Hold Mains]` / `[🔥 Fire Mains]` (one-tap toggle)
  - `[🍰 Fire Desserts]`
  - `[+ Add Item]` quick-search drawer.

### 6.5 Accountant / Tax Compliance UI View
- **GST Compliance Card**:
  - SAC 996331 catering service classification.
  - Metric blocks: Total Taxable Turnout, CGST @ 2.5%, SGST @ 2.5%, and Gross Tax Collected.
  - FSSAI License verification verification badge.
- **Z-Report Shift Reconciliation Table**:
  - Detailed rows: Date, Terminal, Cashier, Opening Float, Gross Cash, Refunds, Expected Cash, Counted Cash, Over/Short Variance, Status.
- **Tally XML Ledger Export Action**:
  - Dedicated export card with XML snippet preview and `[Download Tally XML]` button that triggers client-side generation of a valid `.xml` voucher file.

### 6.6 Delivery Driver UI View
- **Dispatch Queue Selector**: `[All Dispatches]`, `[Direct In-House]`, `[Swiggy]`, `[Zomato]`.
- **Delivery Cards**:
  - Order ID, aggregator tag, and prep completion status.
  - Customer Name, masked telephone number (`+91 98*** **421`), and complete delivery address with landmark.
  - Payment status badge: `Prepaid Online` vs `COD (Cash on Delivery: ₹840.00)`.
  - Step tracker: `[Assigned]` → `[Arrived at Outlet]` → `[Dispatched]` → `[Delivered]`.
  - COD reconciliation toggle: `[Collect Cash & Reconcile Till]`.

---

## 7. Hybrid Local-Connection Engine

To fulfill Requirement R3 (Hybrid Data Architecture) for deployment on Cloudflare Pages:
1. **Self-Contained Client State by Default**:
   - The dashboards run 100% in the browser using React state and LocalStorage without any external cloud or server dependencies.
   - All interactive actions (bumping tickets, firing courses, splitting tenders, resetting PINs, reconciling drawer cash, exporting Tally XML) operate smoothly on mock data.
2. **Local Engine Auto-Probing**:
   - A lightweight client-side hook (`useLocalBackendProbe`) periodically probes local ports:
     - Express API: `http://localhost:3001/api/health`
     - KDS Server: `http://localhost:3002`
     - Waiter Server: `http://localhost:3003`
   - If reachable, the dashboard displays a "⚡ Connected to Local POS Hardware (:3001/:3002)" badge in the status bar and synchronizes live local data.
   - If unreachable (as on a remote mobile device or demo visitor), the dashboard cleanly remains in "Simulated Offline Mode" with zero console errors or failed network popups.

---

## 8. Verification Strategy & Acceptance Mapping

| Requirement / AC Item | Verification Method | Pass Criteria |
| :--- | :--- | :--- |
| **All 6 Personas Rendered & Interactive** | Code inspection of tab state and component trees in `landing/src/app/dashboard/page.tsx` | All 6 personas (Owner, Cashier, Chef, Waiter, Accountant, Driver) have dedicated interactive views. |
| **Cashier Split Tenders & 24V Drawer** | Test split tender calculator and drawer pulse button | Calculates split balance; displays 24V solenoid pulse feedback and 80mm preview. |
| **Kitchen KDS Station Routing & Bumping** | Filter by station (Oven, Tandoor, Bar); click bump button | Filters items by station; bumps status from pending → preparing → ready → served with SLA timers. |
| **Waiter Floor Map & Course Firing** | Click table card; toggle course fire buttons | Displays visual room tables; toggles course firing states (Starters, Mains, Desserts). |
| **Accountant GST & Tally XML Export** | Click "Download Tally XML" | Generates compliant XML blob with `<ENVELOPE>`, `<VOUCHER>`, and CGST/SGST ledgers. |
| **Delivery Driver Queue & COD** | Toggle rider dispatch steps and COD collection | Dispatches orders; reconciles cash-on-delivery amounts. |
| **Design Consistency** | Visual audit of styles | Background `#F8FAFC`, cards `border-slate-200/80`, orange `#F07928` accents, Geist/mono typography. |
| **Linter & Build Integrity** | Run `npm --prefix landing run lint`<br>Run `npm --prefix landing run build` | 0 ESLint errors; successful Next.js static HTML export into `landing/out/`. |
