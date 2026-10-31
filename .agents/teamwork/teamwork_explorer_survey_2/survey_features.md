# Order It Up — Core Features, Architecture & Marketing Copy Survey

**Document Target:** Marketing Landing Page Implementation (`landing/`)  
**Surveyed By:** `teamwork_explorer_survey_2`  
**Date:** October 30, 2026  
**Source Code References:** `frontend/`, `main/`, `docs/`, `users.md`, `README.md`, `AGENTS.md`  

---

## 1. Executive Summary & Brand Positioning

### 1.1 Brand Essence
* **Product Name:** Order It Up (🍽️)
* **Tagline:** The Modern, Offline-First Restaurant Operating System
* **Core Pitch:** Run lightning-fast counter billing and kitchen workflows with 100% offline local SQLite durability — backed by seamless multi-branch cloud sync, handheld waiter ordering, and direct ESC/POS hardware integration.
* **Engineering Philosophy:** Built by **IndentDev** for cafes, restaurants, bars, and food outlets where software downtime or network lag is intolerable. Core POS billing and kitchen operations run strictly on counter hardware with zero cloud latency.

### 1.2 Target Audience & Personas
1. **Quick-Service Restaurants (QSR) & Cafes:** High transaction velocity, counter queues, barcode scanning, instant receipt printing, cash drawer kick.
2. **Fine Dining & Casual Dining Restaurants:** Visual floor layout, table reservations, course management, server tableside handheld ordering, split checks.
3. **Bars & Nightclubs:** Rapid open tabs, speed screen ordering, category station routing (bar vs. food), high-volume drink modifiers.
4. **Multi-Branch Hospitality Chains:** Centralized cloud catalog control, cross-outlet performance analytics, regional tax compliance, unified staff onboarding.

---

## 2. Core Value Propositions & Brand Pillars

| Pillar | Merchant Pain Point | Order It Up Solution | Technical Evidence in Code |
| :--- | :--- | :--- | :--- |
| **1. 100% Offline Durability** | Cloud-only POS stalls or crashes when the internet fluctuates, halting billing during peak dinner rush. | Embedded local SQLite database with Write-Ahead Logging (WAL) and local Express API engine (`:3001`). Sub-10ms queries, zero reliance on external APIs for core billing. | `main/db.ts` (SQLite WAL mode, auto-recovery), `main/server.ts` (local engine on :3001), `frontend/src/components/layout/StatusBar.tsx`. |
| **2. Native ESC/POS Hardware Integration** | Browser print dialogs are slow, unreliable, and require clunky third-party print spooler drivers. | Direct ESC/POS thermal printing over USB raw endpoints, TCP/IP LAN, and Windows spooler. Standard 58mm/80mm roll support, auto-cutter, and 24V cash drawer pulse kick. | `main/printers/thermal.ts`, `main/printers/profiles.ts`, `main/printers/document-classic.ts`, `main/printers/document-kot.ts`. |
| **3. Real-Time Kitchen Orchestration (KDS)** | Paper kitchen tickets get wet, lost, or misplaced; chefs lose track of prep times and station priorities. | Dedicated local KDS server on `:3002/kds` with real-time WebSockets. Kanban drag-and-drop & Tab views, elapsed timers with SLA alert colors, and station routing (Bar, Grill, Dessert, Main Kitchen). | `main/kds-server.ts` (:3002), `frontend/src/app/(dashboard)/kds/page.tsx`, `frontend/src/components/kds/KdsKanbanBoard.tsx`. |
| **4. Unified Tri-Platform Ecosystem** | Juggling disparate tools for billing, handheld ordering, and HQ analytics creates sync lag and data fragmentation. | Tri-platform architecture: Desktop POS (Electron) for heavy-duty counter billing; Mobile POS (Flutter / Server `:3003`) for tableside waitstaff; Cloud HQ (Web) for multi-branch control. | `users.md` (3 client applications), `main/server-app.ts` (waiter app server :3003), `frontend/src/app/page.tsx`. |
| **5. Enterprise Compliance & Financial Safety** | Complex tax rules (CGST/SGST/IGST, VAT), unauthorized cashier discounts, and manual end-of-day cash reconciliation errors. | Automated split GST/VAT tax engine, Master Manager PIN authorization for voids/refunds/discounts, cash drawer shift closures (Z-reports), and Tally XML ledger export. | `main/services/tax-engine.ts`, `main/services/master-pin.ts`, `frontend/src/components/dashboard/CashCloseModal.tsx`. |

---

## 3. Exhaustive Feature Catalog

### 3.1 Point of Sale (POS) & Counter Billing
* **Multi-Service Modes:** Counter / QSR Quick Bill, Dine-in (with table assignment and pax count), Takeaway / Pick-up, and Delivery (with customer address and driver dispatch).
* **Speed Cart Mechanics:** Instant product grid search, category filter pills, barcode scanner support (`useBarcodeScanner`), and fractional scale weighing (`sale_unit: kg, g, lb`).
* **Order Holding & Recall:** Park active carts (`useHeldOrdersStore`) when customers need extra time; instant recall by table or customer name.
* **Append & Course Firing:** Append items to active dine-in orders without duplicating previous items; separate KOT tickets generated for subsequent rounds.
* **Customer Facing Display:** Dedicated dual-screen customer display route (`/customer-display`) showing running totals, itemized lists, and payment QR codes.

### 3.2 Table & Floor Management
* **Interactive Floorplan Canvas:** Visual room designer (`FloorplanEditor.tsx`) supporting multiple floors/sections (Indoor, Rooftop, Patio, Private Dining).
* **Real-Time Table State Badges:**
  - **Available (Green):** Vacant and ready for seating.
  - **Occupied (Red):** Active seated guests with running orders.
  - **Reserved (Yellow):** Pre-booked for upcoming dining time.
  - **Held (Blue):** Order held pending confirmation.
  - **Cleaning (Gray):** Table awaiting turnaround.
* **Table Turnover Tracking:** Live duration timers (`splitHoursMinutes`) and turnover badges alerting staff when a table exceeds the target dining window.

### 3.3 Kitchen Display System (KDS) & Ticket Routing
* **Standalone LAN Access:** Accessible from any standard Android/iOS tablet or smart TV browser via `http://<pos-ip>:3002/kds`.
* **Category Station Routing:** Route items dynamically based on prep station: Bar (drinks), Grill, Fryer, Dessert, and Main Kitchen.
* **Kanban & Tab Views:** Visual kanban board with 4 draggable stages (`pending` → `preparing` → `ready` → `served`), plus read-only manager-voided items.
* **Modifier & Allergy Highlighting:** Add-on notes, spice levels (Mild, Medium, Fiery), and allergy warnings prominently tagged with contrasting chips.
* **Preparation Timers:** Dynamic elapsed timers with green (<8 min), amber (8–15 min), and pulsing red (>15 min) SLA warnings.

### 3.4 Hardware Integration & Thermal Printing
* **Direct Hardware Drivers:** Zero-middleware printing over USB Raw, Ethernet / Wi-Fi TCP/IP sockets, and Windows Print Spooler.
* **Roll Sizes:** Precision formatting for standard 58mm (compact receipt) and 80mm (full receipt) thermal rolls.
* **Kitchen Order Tickets (KOT):** Large-format font, order type badge, table identifier, waiter name, and modifier breakdown.
* **Cash Drawer Pulse:** Automated 24V solenoid drawer kick pulse (`ESC p m t1 t2`) triggered upon cash payment.
* **Barcode & Weighing Scales:** Integrated EAN-13 / Code-128 barcode scanning and weight-embedded barcodes for deli/meat items.

### 3.5 Payments, Splitting & Shift Reconciliations
* **Payment Tenders:** Cash (with change calculation), Dynamic UPI QR Code, Credit/Debit Cards, Customer Loyalty Points, and Custom Tenders.
* **Split Check Options:** Split evenly across guests, split by specific items, or custom balance splitting.
* **Auditable Discounts & Overrides:** Item-level or bill-level percentage/flat discounts requiring Master Manager PIN authorization.
* **Cash Drawer Shift Closures (Z-Reports):** Track opening float, expected cash vs. counted cash, manual cash drops, and printable end-of-day Z-reports.

### 3.6 Menu, Modifiers & Add-on Groups
* **Hierarchical Catalog:** Multi-level categories with custom color badges and icons.
* **Add-on Groups & Modifiers:** Required vs. optional rules, minimum/maximum selection bounds, and multi-quantity add-ons (e.g. Extra Cheese x2).
* **Dietary Badges:** Vegetarian, Vegan, Non-Veg, Egg, Gluten-Free indicators (`DietaryBadge.tsx`).
* **Inventory Depletion:** Real-time recipe and stock tracking with low-stock warnings and automatic out-of-stock lockouts.

### 3.7 Customer CRM, Loyalty & WhatsApp E-Receipts
* **Rich Customer Profiles:** Automatic customer history indexing by phone number; track total visits, lifetime value, favorite dishes, and dietary restrictions.
* **Loyalty Ledger:** Built-in earn-and-burn point redemption directly during checkout.
* **Direct WhatsApp Integration:** Connects directly to merchant WhatsApp via Baileys (QR code linking) without third-party SMS/WhatsApp gateway fees.
* **Automated E-Receipts:** Dispatches branded digital receipts and PDF invoices directly to customer WhatsApp chats.

### 3.8 AI Restaurant Intelligence
* **Prep Item Recommendations:** Machine learning forecasts recommended batch preparations per station based on day-of-week trends and weather.
* **Menu Engineering Matrix:** Categorizes catalog dishes into Stars (high profit, high volume), Plowhorses (low profit, high volume), Puzzles, and Dogs.
* **Smart Operations Assistant:** Natural language insights for restaurant owners regarding sales trends and peak hours.

### 3.9 Multi-Role Permissions & Security
* **10 Operational Personas:** Scoped capabilities across Super Admin, Owner, Branch Manager, Cashier, Waiter, Chef, Accountant, and Delivery.
* **Master Manager PIN:** Configurable 4-digit PIN (`1234` / `9999`) preventing cashier fraud during voids, refunds, and bill adjustments.
* **Ephemeral Device Pairing:** 6-digit cryptographic PINs pairing mobile tablets to the local POS securely without sharing master credentials.

---

## 4. Technical Architecture Highlights

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ORDER IT UP LOCAL HARDWARE ENGINE                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │               Electron Shell (Node.js 22 + Chromium)               │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────┐        ┌───────────────────────────┐  │  │
│  │  │   Next.js 16 UI         │        │    Express API (:3001)    │  │  │
│  │  │   React 19 + Zustand    │◄──────►│    WebSockets & Logic     │  │  │
│  │  │   Tailwind CSS Aesthetic│  HTTP  │    JWT Scoped Auth        │  │  │
│  │  └─────────────────────────┘        └─────────────┬─────────────┘  │  │
│  │                                                   │                │  │
│  │  ┌─────────────────────────┐                      │                │  │
│  │  │   Embedded SQLite DB    │◄─────────────────────┘                │  │
│  │  │   WAL Mode Enabled      │   Zero Network Latency                │  │
│  │  │   flo.db (ACID Safe)    │   Sub-10ms Counter Transactions       │  │
│  │  └─────────────────────────┘                                       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────┬─────────────────────────────────┬─────────────────────┘
                   │ LAN WebSockets                  │ Hardware Ports
                   ▼                                 ▼
┌──────────────────────────────────┐   ┌───────────────────────────────────┐
│     LOCAL NETWORK SERVICES       │   │     COUNTER HARDWARE PERIPHERALS  │
│ • Standalone KDS (:3002/kds)     │   │ • 80mm/58mm Thermal Printers      │
│ • Waiter Mobile Server (:3003)   │   │ • 24V Cash Drawer Kick Pulse      │
│ • Zero Cloud Dependency on LAN   │   │ • USB / Serial Weighing Scales    │
│ • Instant Kitchen Ticket Firing  │   │ • 1D/2D Barcode Scanners          │
└──────────────────┬───────────────┘   └───────────────────────────────────┘
                   │
                   │ Background Outbox Sync (When Internet is Present)
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE EDGE & D1 CLOUD HQ                       │
│  • Multi-Location Chain Reporting    • Central Master Catalog Push       │
│  • Web Owner & Accountant Dashboard  • Zero-Touch Pairing Tokens         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Technical Talking Points for Marketing
1. **Zero Cloud Latency:** All cart operations, order submissions, and table statuses resolve locally in single-digit milliseconds.
2. **Crash-Proof SQLite WAL:** Uses SQLite Write-Ahead Logging mode (`flo.db-wal`), allowing concurrent reads while orders write atomically.
3. **Outbox Synchronization Pattern:** Offline orders queue into an encrypted local outbox; the moment Wi-Fi reconnects, events stream smoothly to Cloudflare D1 without human intervention.
4. **Private Specs & Security Compliance:** Passwords salted with cryptographic `scrypt` / `bcrypt`, LAN API routes protected by scoped JWT bearer tokens.

---

## 5. Realistic Mock Data & UI Preview Components

These four realistic UI previews should be rendered as interactive, ultra-authentic preview cards on the marketing landing page.

### 5.1 Preview 1: Interactive Order View / POS Cart
* **Restaurant Concept:** The Rustic Olive Bistro & Bar (New Delhi)
* **Active Station:** Counter Station #01 | **Operator:** Rohit Sharma (Cashier)
* **Order Context:** Dine-in • Table T-04 (Indoor Main Floor) • Pax: 4 Guests
* **Cart Line Items:**
  1. **Truffle Mushroom Wood-Fired Pizza** — 1 × ₹540.00
     - *Add-ons:* Extra Mozzarella (+₹60.00)
     - *Kitchen Note:* Crispy thin crust, well done
  2. **Artisanal Paneer Tikka Platter** — 2 × ₹380.00 = ₹760.00
     - *Add-ons:* Mint Chutney & Laccha Onion (Included)
     - *Kitchen Note:* Chef special spice blend
  3. **Classic Cold Brew Latte** — 2 × ₹220.00 = ₹440.00
     - *Add-ons:* Oat Milk Sub (+₹40.00 ea = +₹80.00)
  4. **Belgian Dark Chocolate Lava Cake** — 1 × ₹280.00
     - *Add-ons:* Vanilla Bean Gelato Scoop (+₹50.00)
     - *Kitchen Note:* Hold for dessert call
* **Financial Summary:**
  - Item Subtotal: ₹2,210.00
  - CGST (2.5%): ₹55.25
  - SGST (2.5%): ₹55.25
  - Service Charge (5%): ₹110.50
  - Round Off: -₹0.00
  - **Grand Total:** ₹2,431.00
* **Interactive UI Controls:**
  - Hold Order (`Pause` icon)
  - Fire KOT (`ChefHat` icon)
  - Split Check (`Split` icon)
  - Settle & Print (`Receipt` icon, primary orange gradient button)

---

### 5.2 Preview 2: Live Kitchen Display System (KDS) Ticket
* **Ticket Identifier:** #104 | **Table:** Table 4 (Indoor) | **Order Type:** Dine-In (Blue Badge)
* **Prep Station:** Main Kitchen & Grill Station
* **Elapsed Timer:** `08:42` (Amber SLA Alert — Target: 12:00)
* **Ticket Items & Status Hierarchy:**
  1. `[COMPLETED / READY]` **2x Artisanal Paneer Tikka Platter**
     - Status: Green Badge (`Ready`)
     - Modifiers: *Medium Spice • Extra Mint Dip*
  2. `[IN PREPARATION]` **1x Truffle Mushroom Wood-Fired Pizza**
     - Status: Amber Badge (`Preparing - Station: Oven 2`)
     - Modifiers: *Crispy Crust • Extra Mozzarella*
  3. `[QUEUED]` **1x Belgian Dark Chocolate Lava Cake**
     - Status: Slate Badge (`Pending - Hold for Course 2`)
     - Modifiers: *+ Vanilla Bean Gelato*
* **Chef Actions:** One-tap ticket bumping (`Bump to Ready`), recall ticket, station filter dropdown.

---

### 5.3 Preview 3: Authentic Thermal Receipt (80mm ESC/POS)
Authentic monospace layout styled as a realistic paper thermal receipt with dotted dividers:

```text
================================================
           THE RUSTIC OLIVE BISTRO
        IndentDev Hospitality Pvt Ltd
      42 Connaught Place, New Delhi 110001
      GSTIN: 07AAAAA0000A1Z5 | FSSAI: 10019011000234
            Phone: +91 98765 43210
================================================
Bill No: BILL-2026-0892          Order: #104
Table: T-04 (Indoor)             Pax: 4
Date: 30-Oct-2026 19:42          Cashier: Rohit S.
------------------------------------------------
QTY  ITEM                             AMOUNT(INR)
------------------------------------------------
1    Truffle Mushroom Pizza               540.00
     + Extra Mozzarella                    60.00
2    Artisanal Paneer Tikka               760.00
2    Classic Cold Brew Latte              440.00
     + Oat Milk Sub (x2)                   80.00
1    Belgian Choc Lava Cake               280.00
     + Vanilla Bean Gelato                 50.00
------------------------------------------------
Subtotal:                               2,210.00
CGST @ 2.5%:                               55.25
SGST @ 2.5%:                               55.25
Service Charge @ 5.0%:                    110.50
Round Off:                                  0.00
------------------------------------------------
GRAND TOTAL:                           ₹2,431.00
------------------------------------------------
PAYMENT DETAILS:
Payment Mode: UPI Dynamic QR (Settled)
Transaction ID: UPI/20261030/982144
Amount Paid: ₹2,431.00 | Change Due: ₹0.00
------------------------------------------------
LOYALTY REWARDS:
Customer: Priya Sharma (+91 98*** **321)
Points Earned: +24 pts | New Balance: 384 pts
------------------------------------------------
      Thank you for dining with us!
       Please visit again soon.
    [QR Code: Scan for E-Invoice & Review]
         Powered by Order It Up (IndentDev)
================================================
```

---

### 5.4 Preview 4: Offline Resilience & Engine Health Bar
A live telemetry widget demonstrating the local architecture running smoothly:
* **Server Status:** `● Local Engine: Running (Port 3001)` (Emerald Green Glow)
* **Database State:** `● SQLite WAL Mode: Connected` (`flo.db` • 0ms LAN latency)
* **Outbox Buffer:** `0 Pending Sync Events` (Clean state, all transactions persisted)
* **Internet Status:** `● Simulated Offline Mode: Active (Zero Degradation)`
* **Hardware Status:** `80mm USB Thermal Printer: Online • 24V Cash Drawer: Ready`
* **System Footprint:** `Heap: 84 / 128 MB • Uptime: 14h 22m`

---

## 6. Comprehensive Marketing Landing Page Copy Deck

### 6.1 Top Navigation Bar
* **Brand Logo:** `Order It Up` with vibrant orange restaurant icon (`UtensilsCrossed`).
* **Sub-Badge:** `Offline-First Desktop POS`
* **Nav Links:**
  - `Features` (Scroll to Key Features)
  - `Architecture` (Scroll to Offline-First Deep Dive)
  - `KDS & Floor` (Scroll to Kitchen & Table Management)
  - `Hardware` (Scroll to ESC/POS Printers & Cash Drawers)
  - `Multi-Role` (Scroll to Waiter, Cashier, Chef, Owner personas)
* **Action Buttons:**
  - Secondary: `View Interactive Demo`
  - Primary (Accent Gradient): `Download Free Desktop POS`

---

### 6.2 Hero Section
* **Pre-Header Pill:**
  `⚡ 100% Offline-First POS Engine • Zero Cloud Lag • Hardware Native`
* **Main Headline:**
  **The High-Speed Restaurant POS Engineered to Never Go Down.**
* **Sub-Headline:**
  Run lightning-fast counter billing in milliseconds, orchestrate live kitchen screens over your local Wi-Fi, and print thermal receipts directly over USB and LAN — completely offline with embedded SQLite reliability.
* **Call to Actions:**
  - Primary CTA Button: `Download Order It Up for Desktop` (Windows / macOS / Linux)
  - Secondary CTA Button: `Launch Live POS Demo` (Instant browser preview)
* **Sub-CTA Reassurance:**
  *Free forever for single counters • No credit card required • Instant 2-minute setup*
* **Metrics / Social Proof Badges (Hero Footer):**
  - `< 10ms` Sub-second cart & bill calculation
  - `100%` Offline transaction continuity
  - `0s` Print lag with direct ESC/POS thermal drivers
  - `10` Unified operational roles from Waiter to Owner

---

### 6.3 Feature Showcase Grid (6 Core Cards)

#### Card 1: Sub-Second Counter Billing
* **Headline:** Speed designed for high-velocity QSR lines.
* **Body:** Keep queues moving with instant barcode scanning, keyboard accelerators, fractional weight scale parsing, and touch-optimized numpads. Settle bills in under 3 seconds.
* **Badge:** `QSR & Counter Ready`

#### Card 2: 100% Offline SQLite Durability
* **Headline:** Zero cloud dependency. Zero frozen screens.
* **Body:** Your menu, orders, customer tabs, and financial records reside in an embedded SQLite database with Write-Ahead Logging (WAL). Even if your ISP cuts out, your restaurant never stops.
* **Badge:** `ACID Safe`

#### Card 3: Real-Time Kitchen Display System (KDS)
* **Headline:** Eliminate lost paper tickets forever.
* **Body:** Live WebSocket kitchen queue accessible from any browser on your local network (`:3002/kds`). Drag-and-drop Kanban tickets, color-coded SLA timers, and automatic category station routing.
* **Badge:** `Zero Cloud Wi-Fi Mesh`

#### Card 4: Native Thermal Printing & Cash Drawer Pulse
* **Headline:** Plug-and-play ESC/POS hardware integration.
* **Body:** Direct hardware output for 58mm & 80mm thermal rolls over USB, TCP/IP, and Windows spooler. Automatic receipt cutting and 24V cash drawer kick pulse triggered instantly on payment.
* **Badge:** `USB • LAN • Bluetooth`

#### Card 5: Interactive Floor & Table Management
* **Headline:** Turn tables faster with visual floor intelligence.
* **Body:** Design custom dining rooms with drag-and-drop tables. Track live table states (Available, Occupied, Billed, Held, Cleaning) and monitor seated durations to maximize dining room turnover.
* **Badge:** `Visual Floorplan`

#### Card 6: Multi-Role Security & Shift Reconciliation
* **Headline:** Enterprise role control with anti-theft safeguards.
* **Body:** 10 scoped user personas from Waiter to Head Accountant. Master Manager PIN protection on voids, refunds, and discounts, paired with automated end-of-day Z-report cash balancing.
* **Badge:** `Anti-Fraud Protection`

---

### 6.4 Deep Dive: The Tri-Platform Ecosystem
* **Headline:** Three Form Factors. One Unbroken Workflow.
* **Tab 1: Desktop POS Client (Electron & Node 22)**
  - *Focus:* Counter Billing, Thermal Receipt Printing, Local SQLite DB, Cash Drawer Pulse.
  - *Ideal for:* Front-desk cashiers, bartenders, counter supervisors.
* **Tab 2: Mobile POS App (Flutter / LAN Server :3003)**
  - *Focus:* Tableside Order Taking, Course Firing, Live Modifiers, 6-Digit PIN Device Pairing.
  - *Ideal for:* Floor captains, waiters, roving servers.
* **Tab 3: Cloud HQ Web Portal (Next.js & Cloudflare Edge)**
  - *Focus:* Multi-Branch Franchise Analytics, Central Menu Management, Tax Reports, CRM & Loyalty.
  - *Ideal for:* Restaurant owners, franchise executives, head accountants.

---

### 6.5 Offline Architecture Breakdown (Visual Explainer)
* **Headline:** How Order It Up Guarantees Zero Downtime
* **Step 1 — Local Execution First:**
  Every touch, order modification, and payment executes against the local Express engine on `:3001` and writes atomically to `flo.db`.
* **Step 2 — In-House LAN Broadcast:**
  Tickets broadcast over local WebSockets directly to kitchen screens (`:3002`) and waiter tablets (`:3003`). Not a single packet leaves your restaurant premises.
* **Step 3 — Automatic Cloud Outbox Sync:**
  When internet connectivity is present, the outbound sync bridge pushes transactional batches to the Cloudflare Edge database silently in the background. If internet drops, records buffer safely locally until reconnection.

---

### 6.6 Bottom Call to Action (CTA)
* **Headline:** Ready to eliminate restaurant POS downtime forever?
* **Sub-Headline:** Download Order It Up today. Start billing in minutes on any Windows, macOS, or Linux counter terminal.
* **Primary Button:** `Download Order It Up (Free Edition)`
* **Secondary Button:** `Explore Interactive Cloud HQ Demo`
* **Guarantee Note:**
  *Open-source MIT licensed core • No vendor lock-in • 100% data privacy on your hardware.*

---

### 6.7 Footer
* **Colophon:** Order It Up — Modern Restaurant Operating System engineered by **IndentDev**.
* **Navigation Columns:**
  - *Product:* Desktop POS, Kitchen Display (KDS), Waiter Mobile App, Cloud HQ, Thermal Printing.
  - *Compliance:* Indian GST (CGST/SGST), Global VAT, Tally XML Export, FSSAI Licensing.
  - *Developers:* MIT License, Offline Architecture, Local API Specs, GitHub Repo.
* **Copyright Notice:** © 2026 Order It Up. All rights reserved. Offline-first by design.

---

## 7. Implementation Recommendations for Landing Page Builder

1. **Self-Contained Architecture:** Build completely in `landing/` with its own `package.json`, Next.js 16, Tailwind CSS, and Lucide React icons. Never import from or modify `frontend/`.
2. **Design Language Alignment:**
   - Backgrounds: Dark slate aesthetic (`bg-slate-950`, `bg-slate-900/60`, borders `border-slate-800`).
   - Brand Accent: Warm vibrant restaurant orange/amber (`#F07928` / `from-orange-500 to-amber-500`).
   - Status Accents: Emerald (`#10B981`) for SQLite/Offline reliability, Sky (`#0284C7`) for KDS/Cloud, Amber (`#F59E0B`) for SLA warnings.
   - Typography: Clean modern sans-serif (`font-sans`) and tabular monospace (`font-mono`) for prices, receipt tokens, and port numbers.
3. **Interactive UI Mockups:** Use the specifications in Section 5 to build rich, clickable, high-fidelity mockups for the Order View, KDS Ticket, Thermal Receipt, and Offline Engine Telemetry.
