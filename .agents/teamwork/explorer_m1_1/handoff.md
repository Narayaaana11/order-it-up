# Milestone M1 Handoff Report: Hybrid Reactive Data Architecture & Operational Models

**Agent**: Explorer 1 (`explorer_m1_1`)  
**Working Directory**: `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_1\`  
**Milestone**: M1 - Hybrid Reactive Data Architecture & Operational Models  
**Target Specification**: Complete TypeScript type system for `landing/src/lib/dashboard-models.ts`  
**Date**: 2026-10-31  

---

## 1. Observation

Direct code observations from the repository:

1. **ESC/POS Solenoid Cash Drawer Pulse**:
   - In `main/printers/thermal.ts:770`:
     `Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])`
   - In `landing/src/components/BillTemplateModal.tsx:320`:
     `<p>24V Cash Drawer Pulse: Triggered (ESC p 0 25 250)</p>`

2. **Indian GST, SAC 996331 & FSSAI License**:
   - In `landing/src/components/BillTemplateModal.tsx:328, 351`:
     `TAX INVOICE (RULE 46 OF CGST RULES)`
     `<span>996331</span> <span>2,210.00</span> <span>55.25</span> <span>55.25</span> <span>2,320.50</span>` (CGST 2.5% + SGST 2.5% = 5.0% total GST)
   - In `ORIGINAL_REQUEST.md:17` and `docs/user-access-guide.md`:
     FSSAI License `10019011000234`, Delhi State Code `07`, SAC `996331`.

3. **Cash Closures & Shift Z-Reports**:
   - In `main/routes/cash-closures.ts:8-12, 282-372`:
     `expected_cash_cents`: raw pre-join `method = 'cash'` filter minus cash refunds.
     Z-Report columns: `z_number`, `business_date`, `opening_float_cents`, `gross_collected_cents`, `refunded_cents`, `expected_cash_cents`, `counted_cash_cents`, `variance_cents`.

4. **KDS WebSocket & Lifecycle**:
   - In `main/services/kds.ts:8-23, 50-60` and `main/kds-server.ts:25-50`:
     Server runs on `:3002`. Tickets track station routing (`kitchen_stations`), prep timers, and status lifecycle transitions: `pending` → `preparing` → `ready` → `served`.

5. **Tableside Ordering & Courses**:
   - In `frontend/src/app/server-standalone/page.tsx:1-421` and `main/routes/tables.ts:11-95`:
     Waiter server on `:3003`. Rooms/Floors include `Indoor`, `Patio`, `Rooftop`, `Private Dining`. Course management includes Starters, Mains, Desserts, Beverages.

6. **Aggregators & Delivery Dispatches**:
   - In `main/routes/aggregators.ts:87-106` and `main/services/aggregator-service.ts:23-88`:
     Delivery dispatches track channel (`swiggy`, `zomato`, `direct`), rider details, and COD amounts.

7. **Multi-Tenant S3 Isolation**:
   - In `main/services/amazon-s3.ts:162-173`:
     `buildTenantKey(tenantId, domain, filename, subfolder)` enforces `tenants/{cleanTenant}/` prefix across 4 strict domains: `backups`, `users`, `payments`, `media`.

8. **16-Character License Keys**:
   - In `ORIGINAL_REQUEST.md:22` and `orchestrator_1/PROJECT.md:54-56`:
     Format `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]` (e.g. `OIUP-ENT1-M894-K7Q2`).

9. **Multi-Outlet Chain Context**:
   - In `landing/src/app/dashboard/page.tsx:101-150` and `main/routes/cloud-hq.ts:60-145, 252-306`:
     Three connected branches for Spice Route Hospitality Group: Downtown Bistro (`outlet-1`), Cyber Hub Express (`outlet-2`), Airport Terminal 3 (`outlet-3`). Central catalog supports branch-specific price overrides and availability 86-ing.

10. **Static Export Environment**:
    - In `landing/next.config.ts:3-12`:
      `output: "export"`, `trailingSlash: true`. Zero Node.js native bindings allowed on client.

---

## 2. Logic Chain

1. **Step 1 (Grounding Requirements in Verified Code)**:
   By directly examining the actual implementations in `main/`, `frontend/`, and `landing/`, we identified the exact schemas and data contracts used by Order It Up (Observations 1-10).

2. **Step 2 (Eliminating Placeholder Types)**:
   Existing UI prototypes in `landing/src/app/dashboard/page.tsx` relied on ad-hoc objects and inline strings without TypeScript interfaces. To achieve production realism and prevent runtime errors, every field must be strongly typed with strict union literals (e.g. `OperationalRole`, `KitchenStationType`, `CourseType`, `TableStatus`, `S3StorageDomain`, `RiderStatus`), explicit numeric amounts, and ISO date strings. Zero `any` or loose index signatures (`Record<string, any>`) are permitted.

3. **Step 3 (Ensuring Single Source of Truth Across Roles)**:
   The 6 operational personas and 2 administrative perspectives share unified entities:
   - Cashier and Waiter share `RestaurantOrder` and `RestaurantTable`.
   - Kitchen Chef derives `KdsTicket` directly from `RestaurantOrder` items.
   - Accountant derives GSTR-1 and Tally XML from settled orders and `ShiftZReport`.
   - Delivery Driver operates on orders with `DeliveryDetails`.
   - Founder Admin and Chain Owner inspect `PlatformTenant`, `RestaurantOutlet`, `IssuedLicenseRecord`, and `TenantS3Metrics`.

4. **Step 4 (Static Export & Hybrid Browser Safety)**:
   Because `landing/` builds with Next.js `output: 'export'` (Observation 10), data models must be pure browser-safe TypeScript types with no Node.js runtime imports (`crypto`, `fs`, `electron`). The hybrid backend detection types (`BackendServiceProbe`, `BackendTelemetryState`) model non-blocking probe responses for ports `:3001`, `:3002`, `:3003` with a graceful fallback to `standalone-simulated` mode.

5. **Step 5 (Synthesis into Specification)**:
   The complete domain model has been formalized into `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_1\analysis.md` and is ready for direct implementation in `landing/src/lib/dashboard-models.ts`.

---

## 3. Caveats

1. **Read-Only Explorer Scope**: Explorer agents operate in read-only mode and do not modify project source files in `landing/`. The complete type system has been designed and written to `analysis.md` for the Milestone M1 builder agent to implement.
2. **Next.js Static Export Constraints**: Any future helper utility that generates or validates Ed25519 or HMAC signatures in the web portal must use Web Crypto APIs (`window.crypto.subtle`) rather than `node:crypto`.
3. **No Dynamic Server APIs**: All operational state in `landing/` must reside in client-side reactive storage (`localStorage` + React state) to satisfy Cloudflare Pages static export requirements.

---

## 4. Conclusion

The TypeScript type architecture for `landing/src/lib/dashboard-models.ts` is fully specified, verified against codebase invariants, and ready for immediate implementation. It provides:
- Complete coverage of all 6 operational restaurant personas and 2 administrative perspectives.
- 0 placeholder types (`any` or dummy fields).
- Precise typing for Indian GST (SAC 996331, CGST 2.5%, SGST 2.5%, FSSAI 10019011000234).
- Authentic ESC/POS 24V solenoid cash drawer kick pulse (`0x1B, 0x70, 0x00, 0x19, 0xFA`).
- Exact mathematical formulas and types for Shift Z-Reports and cash variance.
- 16-character license keys (`OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]`).
- Multi-branch restaurant chains with branch price overrides and isolated S3 customer bucket prefixes.

---

## 5. Verification Method

To independently verify this domain model specification:

1. **Inspect Analysis Report**:
   - View `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_1\analysis.md` Section 3.
   - Confirm all required interfaces and types are fully defined without any `any` types.

2. **Downstream Implementation Verification**:
   - Once implemented in `landing/src/lib/dashboard-models.ts`, execute:
     `npm --prefix landing run lint`
     `npm --prefix landing run build`
   - Both commands must compile with 0 TypeScript/ESLint errors and successfully export static pages into `landing/out/`.

3. **Invalidation Conditions**:
   - Any introduction of `any` or untyped properties in `dashboard-models.ts`.
   - Any import of Node.js-only modules (`node:crypto`, `node:fs`, `electron`) in `landing/src/lib/`.
   - Incompatibility with Next.js 16.3 static export on Cloudflare Pages.
