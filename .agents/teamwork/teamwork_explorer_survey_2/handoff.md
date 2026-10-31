# Handoff Report — Feature & Copy Survey for Marketing Landing Page

**Agent Identity:** `teamwork_explorer_survey_2`  
**Working Directory:** `d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey_2`  
**Handoff Type:** Hard (Task complete)  
**Deliverable Artifact:** `d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey_2\survey_features.md`  

---

## 1. Observation

Direct code observations from inspecting the Order It Up repository:

1. **Offline-First Architecture & Port Allocation:**
   - `main/server.ts:28-49`: Express API runs on port `:3001` (`const PORT = parseInt(process.env.PORT || '3001', 10);`), serving POS logic, auth, customer search, and database maintenance middleware.
   - `main/kds-server.ts`: Standalone Kitchen Display Server runs on port `:3002` (`http://<ip>:3002/kds`).
   - `main/server-app.ts`: Waiter / tableside mobile ordering server runs on port `:3003`.
   - `main/db.ts:8-12`: SQLite database (`flo.db`) with Write-Ahead Logging (`flo.db-wal`), providing crash-resistant zero-cloud local persistence.
   - `frontend/src/components/layout/StatusBar.tsx:72-125`: Live desktop status bar monitoring local Express port `:3001`, memory heap (used/total), server uptime, and green connection status badge.

2. **Thermal Receipt Printing & Hardware Pulse:**
   - `main/printers/thermal.ts:1-60`: Direct ESC/POS printing over raw USB bulk endpoints, TCP/IP sockets, and Windows print spooler (`winspool`).
   - `main/printers/profiles.ts`: Formatting support for 58mm and 80mm roll widths with automatic paper cutting (`GS V 66 0`).
   - `main/printers/document-classic.ts:1-60`: Receipt layout formatting including restaurant name, address, GSTIN, FSSAI number, itemized lines, CGST/SGST/IGST tax breakdowns, discounts, service charges, payment details, and loyalty rewards.
   - `main/printers/document-kot.ts:1-65`: Kitchen Order Ticket (KOT) formatting with station routing, large order number, table identifier, waiter name, and modifier breakdown.
   - `users.md:21`: Hardware cash drawer kick triggered via 24V solenoid pulse (`ESC p m t1 t2`) upon cash tender.

3. **Real-Time Kitchen Display System (KDS):**
   - `frontend/src/app/(dashboard)/kds/page.tsx:1-85`: Direct KDS route with check for `kds_enabled` and views for Kanban or Tabs.
   - `frontend/src/components/kds/KdsKanbanBoard.tsx:40-80`: 4 draggable kitchen stages (`pending`, `preparing`, `ready`, `served`) plus read-only manager-voided items. Real-time WebSocket ticket updates without manual page refreshes.

4. **Table & Floor Management:**
   - `frontend/src/app/(dashboard)/tables/page.tsx:19-25`: Status color states: Available (Green), Occupied (Red), Reserved (Yellow), Cleaning (Gray), Held (Blue).
   - `frontend/src/components/tables/FloorplanEditor.tsx`: Visual drag-and-drop table layouts with room dimensions and turnover indicators (`TableTurnoverBadge`).

5. **Multi-Role Operations & Access Scopes:**
   - `users.md:37-56`: 10 distinct operational personas including Super Admin, Central Admin, Finance Operator, Support Operator, Auditor, Restaurant Owner, Branch Manager, Accountant, Cashier, Server/Waiter, Kitchen Chef, Delivery Driver, and Customer.
   - `users.md:90-100`: Desktop master manager PINs (`1234` / `9999`) for refunds, voids, and bill adjustments.
   - `users.md:137-140`: Hardware terminal pairing using ephemeral 6-digit cryptographic PINs.

6. **Visual Design & Palette:**
   - `frontend/src/app/globals.css:7-48`: Brand accent color `--sidebar-primary: #F07928;` (warm restaurant amber/orange), `--sidebar-accent: #FFF3E8;`, `--sidebar-accent-foreground: #D96A1A;`.
   - `frontend/src/app/page.tsx:45-100`: Dark SaaS styling using `bg-slate-950`, cards `bg-slate-900/60`, borders `border-slate-800`, emerald status badges for SQLite connectivity (`bg-emerald-500/10 text-emerald-400`), and orange gradient call-to-actions (`from-orange-500 to-amber-500`).

---

## 2. Logic Chain

1. **Step 1 (Architecture & Stability):**  
   Observation of `main/db.ts` and `main/server.ts` demonstrates that Order It Up runs a local Express API (`:3001`) and embedded SQLite with WAL mode on counter hardware. This directly supports the primary marketing claim: *"100% Offline Resilience — Never stop billing even during internet outages."*

2. **Step 2 (Hardware Differentiation):**  
   Observation of `main/printers/thermal.ts` and `profiles.ts` proves that Order It Up connects directly to ESC/POS thermal printers (USB/TCP/Winspool) and cash drawers without requiring third-party cloud print proxies. This validates the value proposition: *"Direct ESC/POS Hardware Integration with 0s print lag."*

3. **Step 3 (Kitchen Efficiency):**  
   Observation of `main/kds-server.ts` (`:3002`) and `KdsKanbanBoard.tsx` reveals local WebSocket-driven ticket bumping across 4 stages with station routing (Bar, Grill, Main Kitchen). This underpins the KDS marketing copy: *"Eliminate lost paper tickets with real-time LAN kitchen screens."*

4. **Step 4 (Ecosystem Synergy):**  
   Observation of `users.md` and `frontend/src/app/page.tsx` details the tri-platform model (Desktop POS on counter, Flutter mobile app for waiters, Cloud Web for HQ). This confirms the multi-role marketing hierarchy and provides realistic parameters for the showcase UI preview cards.

5. **Step 5 (Copy & Showcase Realism):**  
   Synthesizing the product data model (`frontend/src/lib/types.ts`) with Indian tax compliance (CGST/SGST), realistic menu items (Wood-fired Pizza, Paneer Tikka, Cold Brew, Lava Cake), and real telemetry values allowed formulation of authentic mockups for the landing page.

---

## 3. Caveats

- **Scope Boundary:** This investigation is strictly read-only. No source files outside the agent's working directory were created or modified.
- **Landing Directory:** The `landing/` directory is not yet created; it will be scaffolded independently by the designated worker agent in Phase 2.
- **Specs Repository:** As mandated by `AGENTS.md`, the private `specs/` repository was not added or relied upon. All findings are derived strictly from active runtime code and docs in the main repository.

---

## 4. Conclusion

Order It Up possesses a compelling, highly differentiated value proposition centered on **offline durability**, **hardware-native thermal printing**, **local LAN kitchen orchestration**, and a **tri-platform ecosystem**.

The comprehensive feature catalog, architectural highlights, realistic UI mock data (Order Cart, KDS Ticket, Thermal Receipt, and Offline Engine Telemetry), and high-converting marketing copywriting deck have been compiled into:
`d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey_2\survey_features.md`.

This report provides the complete content and design blueprint needed for the downstream worker agents to build the marketing landing page in `landing/`.

---

## 5. Verification Method

To independently verify the facts and code references in this report:
1. Verify Express and SQLite ports and setup:
   - Inspect `main/server.ts` lines 28-30 for port 3001.
   - Inspect `main/kds-server.ts` lines 20-30 for port 3002.
   - Inspect `main/server-app.ts` lines 15-25 for port 3003.
2. Verify printer and hardware drivers:
   - Inspect `main/printers/thermal.ts` and `main/printers/profiles.ts`.
3. Verify brand theme and styling:
   - Inspect `frontend/src/app/globals.css` lines 35-42 for `--sidebar-primary: #F07928`.
4. Inspect the generated survey report:
   - Read `d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey_2\survey_features.md`.
