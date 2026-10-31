# Milestone M1 Analysis Report: Hybrid Reactive Data Architecture & Operational Models

**Author**: Explorer 1 (`explorer_m1_1`)  
**Mission**: Milestone M1 - Data Architecture & Operational Models  
**Target Module**: `landing/src/lib/dashboard-models.ts`  
**Working Directory**: `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_1\`  
**Date**: 2026-10-31  

---

## 1. Executive Summary

This report establishes the complete, production-grade TypeScript domain model and type architecture for `landing/src/lib/dashboard-models.ts`. 

To fulfill Requirements **R1** (Operational Role Dashboards), **R2** (Platform Admin vs. Chain Owner Perspectives), and **R3** (Hybrid Data Architecture & Operational Realism), every entity across the 6 operational restaurant personas (Owner/Manager, Front Cashier, Kitchen Chef, Server/Waiter, Accountant, Delivery Driver) and 2 platform administrative viewpoints (Founder Platform Admin, Restaurant Chain Owner) is defined with **zero placeholder types** (`any`, `unknown` without guard, or dummy properties).

All data models are grounded directly in the verified runtime behaviors of Order It Up:
- SQLite persistence schemas and transaction boundaries (`main/db.ts`, `main/routes/cash-closures.ts`)
- ESC/POS 24V solenoid cash drawer kick pulse `0x1B, 0x70, 0x00, 0x19, 0xFA` (`main/printers/thermal.ts`)
- LAN WebSocket KDS engine running on `:3002` with 4-stage bumping and station routing (`main/services/kds.ts`)
- Mobile tableside ordering and course firing running on `:3003` (`frontend/src/app/server-standalone/page.tsx`)
- Indian GST calculation (CGST @ 2.5% + SGST @ 2.5% under SAC code `996331`) and FSSAI License `10019011000234`
- End-of-shift Z-Report balancing with expected vs. counted cash variance calculation
- Online delivery aggregators (Swiggy, Zomato, Direct) with Cash-on-Delivery (COD) reconciliation
- 16-character hardware-bound desktop POS license keys formatted as `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]`
- Multi-branch restaurant chains (Downtown Bistro, Cyber Hub Express, Airport Terminal 3) with central menu catalog price overrides and strictly isolated Amazon S3 customer bucket prefixes (`tenants/{tenantId}/`).

---

## 2. Codebase Investigation & Grounding Evidence

| Domain Area | Verified Files & Line References | Runtime Invariant / Operational Behavior |
| :--- | :--- | :--- |
| **Orders & Items** | `main/db.ts:4330-4410`<br>`main/routes/order-items.ts:1-120` | Items include `course` (starter, main, dessert, beverage), `station` (oven, tandoor, bar, grill, fryer), `status` (pending, preparing, ready, served, voided), modifiers, and HSN/SAC `996331`. |
| **Tables & Floor** | `frontend/src/app/server-standalone/page.tsx:1-421`<br>`main/routes/tables.ts:11-95` | Tables grouped by floor (`Indoor`, `Patio`, `Rooftop`, `Private Dining`), statuses (`available`, `occupied`, `billed`, `reserved`, `cleaning`), seating capacity/covers, and course firing state. |
| **Staff & PINs** | `main/routes/staff.ts:15-35`<br>`landing/src/lib/auth.ts:1-98` | 4-digit numeric PINs for POS authentication; scoped roles (`owner`, `manager`, `cashier`, `chef`, `waiter`, `accountant`, `driver`, `superadmin`). |
| **Indian GST & SAC** | `landing/src/components/BillTemplateModal.tsx:325-363`<br>`main/services/tax-engine.ts:1-180` | Food & beverage services taxed under SAC `996331`: CGST 2.5%, SGST 2.5% (Total 5.0%). State code `07` (Delhi), FSSAI `#10019011000234`. Rule 46 CGST tax invoice compliance. |
| **Cash Closures & Z-Report** | `main/routes/cash-closures.ts:1-60, 282-372`<br>`main/printers/thermal.ts:768-787` | Tracks `opening_float`, `gross_cash_sales`, `cash_refunds`, `expected_cash_in_drawer`, `actual_counted_cash`, `cash_variance`, and consecutive `z_number`. 24V solenoid pulse: `0x1B, 0x70, 0x00, 0x19, 0xFA`. |
| **Delivery & Dispatch** | `main/routes/aggregators.ts:87-106`<br>`main/services/aggregator-service.ts:23-88` | Aggregator channels (`swiggy`, `zomato`, `direct`), rider status (`unassigned`, `assigned`, `arrived`, `dispatched`, `delivered`), customer address with landmarks, and COD collection tracking. |
| **16-Char License Keys** | `ORIGINAL_REQUEST.md:20-24`<br>`main/services/license-verifier.ts:25-75` | 16-character alphanumeric key formatted as `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]` where PLAN is 4 chars (e.g. `ENT1`, `PRO1`, `STR1`), machine hash is 4 uppercase hex chars, and checksum is 4 uppercase alphanumeric chars. |
| **Tenants & Chain Outlets** | `main/routes/cloud-hq.ts:60-145, 252-306`<br>`main/services/amazon-s3.ts:128-173, 755-833` | Chain branches: Downtown Bistro (Connaught Place), Cyber Hub Express (Gurugram), Airport Terminal 3 (IGI). Catalog includes base price and branch price overrides. S3 isolation enforces `tenants/{tenantId}/` prefix across `backups`, `users`, `payments`, `media`. |
| **Backend Telemetry** | `main/backend-health.ts:8-23`<br>`main/kds-server.ts:25-50` | Probes local ports `:3001` (POS Engine), `:3002` (KDS Server), `:3003` (Waiter App). Fallback to Standalone Simulation mode on Cloudflare Pages. |

---

## 3. Complete Canonical TypeScript Type System for `dashboard-models.ts`

The following TypeScript code constitutes the exact, authoritative content to be implemented in `landing/src/lib/dashboard-models.ts`:

```typescript
/**
 * Order It Up - Operational Dashboard Models & Domain Types
 * File: landing/src/lib/dashboard-models.ts
 *
 * Authoritative TypeScript type system supporting:
 * - 6 Operational Personas: Owner/Manager, Cashier, Kitchen Chef, Server/Waiter, Accountant, Delivery Driver
 * - 2 Administrative Perspectives: Founder Platform Admin & Restaurant Chain Owner
 * - Hybrid Data Architecture: 100% Standalone Browser Simulation + Non-blocking Local Backend Detection
 *
 * Compliant with:
 * - Next.js 16.3 App Router (output: 'export' for Cloudflare Pages)
 * - Indian GST (SAC 996331, CGST 2.5%, SGST 2.5%, FSSAI 10019011000234)
 * - ESC/POS 24V Cash Drawer Pulse (0x1B, 0x70, 0x00, 0x19, 0xFA)
 * - 16-Character License Keys (OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM])
 * - Multi-tenant Amazon S3 isolation (tenants/{tenantId}/{domain}/...)
 */

// ============================================================================
// 1. CORE ENUMS & SCALAR PRIMITIVES
// ============================================================================

export type OperationalRole =
  | 'owner'
  | 'manager'
  | 'cashier'
  | 'chef'
  | 'waiter'
  | 'accountant'
  | 'driver'
  | 'superadmin';

export type KitchenStationType =
  | 'all'
  | 'oven'
  | 'tandoor'
  | 'bar'
  | 'grill'
  | 'fryer';

export type TicketItemStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'voided';

export type CourseType =
  | 'starter'
  | 'main'
  | 'dessert'
  | 'beverage';

export type RoomFloor =
  | 'Indoor'
  | 'Patio'
  | 'Rooftop'
  | 'Private Dining';

export type TableStatus =
  | 'available'
  | 'occupied'
  | 'billed'
  | 'reserved'
  | 'cleaning';

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'upi'
  | 'split';

export type DeliveryChannel =
  | 'direct'
  | 'swiggy'
  | 'zomato';

export type RiderStatus =
  | 'unassigned'
  | 'assigned'
  | 'arrived'
  | 'dispatched'
  | 'delivered';

export type LicensePlanTier =
  | 'enterprise'
  | 'pro'
  | 'starter';

export type TenantSubscriptionStatus =
  | 'Active'
  | 'Suspended'
  | 'Pending Provisioning';

export type ShiftZReportStatus =
  | 'balanced'
  | 'variance_flagged';

export type S3StorageDomain =
  | 'backups'
  | 'users'
  | 'payments'
  | 'media';

export type S3OutboxStatus =
  | 'pending'
  | 'processing'
  | 'failed'
  | 'uploaded';

export type DietaryTag =
  | 'veg'
  | 'non-veg'
  | 'vegan'
  | 'egg';

export type CurrencyCode = 'INR' | 'USD';

// ============================================================================
// 2. ORDERS & LINE ITEMS
// ============================================================================

export interface OrderItemModifier {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export interface OrderItem {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly subtotal: number; // (unitPrice * quantity) + modifiers
  readonly modifiers: readonly OrderItemModifier[];
  readonly course: CourseType;
  readonly station: KitchenStationType;
  readonly status: TicketItemStatus;
  readonly specialInstructions?: string;
  readonly hsnSac: string; // e.g. "996331"
  readonly dietaryTag: DietaryTag;
  readonly prepStartedAt?: string;
  readonly prepCompletedAt?: string;
  readonly servedAt?: string;
}

export interface SplitTenderBreakdown {
  readonly cash?: number;
  readonly card?: number;
  readonly upi?: number;
  readonly changeGiven?: number;
  readonly cashDrawerPulsed: boolean;
  readonly upiTransactionRef?: string;
  readonly cardAuthCode?: string;
}

export interface OrderSettlement {
  readonly method: PaymentMethod;
  readonly tenderedAmount: number;
  readonly changeReturned: number;
  readonly splitBreakdown?: SplitTenderBreakdown;
  readonly cashDrawerPulsed: boolean;
  readonly paidAt: string;
  readonly receiptPrinted: boolean;
}

export interface DeliveryDetails {
  readonly channel: DeliveryChannel;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly customerPhoneMasked: string; // e.g. "+91 98*** **421"
  readonly deliveryAddress: string;
  readonly landmark?: string;
  readonly distanceKm?: number;
  readonly riderName?: string;
  readonly riderPhone?: string;
  readonly riderStatus: RiderStatus;
  readonly isCod: boolean;
  readonly codAmount: number;
  readonly codCollected: boolean;
  readonly dispatchedAt?: string;
  readonly deliveredAt?: string;
}

export interface RestaurantOrder {
  readonly id: string;
  readonly orderNumber: string; // e.g. "#104"
  readonly outletId: string;
  readonly outletName: string;
  readonly orderType: 'dine_in' | 'takeaway' | 'delivery';
  readonly tableId?: string;
  readonly tableName?: string;
  readonly guestCount?: number;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly waiterId?: string;
  readonly waiterName?: string;
  readonly items: readonly OrderItem[];
  readonly subtotal: number;
  readonly packagingCharge: number;
  readonly deliveryCharge: number;
  readonly discountAmount: number;
  readonly taxableAmount: number;
  readonly cgst: number; // 2.5%
  readonly sgst: number; // 2.5%
  readonly taxTotal: number; // 5.0%
  readonly roundOff: number;
  readonly total: number;
  readonly paymentStatus: 'unpaid' | 'paid' | 'partially_paid';
  readonly settlement?: OrderSettlement;
  readonly deliveryDetails?: DeliveryDetails;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ============================================================================
// 3. TABLES, ROOMS & FLOOR MAP
// ============================================================================

export interface CourseFiringState {
  readonly starter: boolean;
  readonly main: boolean;
  readonly dessert: boolean;
}

export interface RestaurantTable {
  readonly id: string;
  readonly number: string; // e.g. "T-01", "P-02", "R-04"
  readonly floor: RoomFloor;
  readonly capacity: number; // Seating covers
  readonly status: TableStatus;
  readonly currentOrderId?: string;
  readonly seatedAt?: string;
  readonly waiterId?: string;
  readonly waiterName?: string;
  readonly guestCount?: number;
  readonly courseFiring?: CourseFiringState;
}

// ============================================================================
// 4. STAFF & 4-DIGIT SECURITY PIN
// ============================================================================

export interface StaffUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: OperationalRole;
  readonly pin: string; // 4-digit PIN for counter authorization (e.g. "2481")
  readonly activeOutletId: string;
  readonly isActive: boolean;
  readonly assignedStation?: KitchenStationType;
  readonly lastActive: string;
  readonly phoneNumber?: string;
}

// ============================================================================
// 5. INDIAN GST & TAX COMPLIANCE
// ============================================================================

export interface IndianGstBreakdown {
  readonly sacCode: '996331';
  readonly sacDescription: 'Restaurant and catering service';
  readonly taxableAmount: number;
  readonly cgstRatePercent: 2.5;
  readonly cgstAmount: number;
  readonly sgstRatePercent: 2.5;
  readonly sgstAmount: number;
  readonly totalGstAmount: number;
  readonly fssaiNumber: '10019011000234';
  readonly gstin: string; // e.g. "07AAAAA0000A1Z5"
  readonly stateCode: string; // e.g. "07"
  readonly stateName: string; // e.g. "Delhi"
  readonly ruleReference: 'Rule 46 of CGST Rules';
}

export interface TallyVoucherLedgerLine {
  readonly ledgerName: string;
  readonly isDeemedPositive: boolean; // Yes = Debit, No = Credit
  readonly amount: number;
}

export interface TallyXmlExportEnvelope {
  readonly voucherType: 'Receipt';
  readonly dateIso: string;
  readonly voucherNumber: string;
  readonly partyLedgerName: string;
  readonly totalAmount: number;
  readonly lines: readonly TallyVoucherLedgerLine[];
  readonly rawXmlSnippet: string;
}

// ============================================================================
// 6. CASH REGISTERS, 24V DRAWER & SHIFT Z-REPORTS
// ============================================================================

export interface EscPosDrawerPulseCommand {
  readonly commandBytes: readonly [0x1B, 0x70, 0x00, 0x19, 0xFA];
  readonly commandHex: '1B 70 00 19 FA';
  readonly standardDescription: 'ESC p 0 25 250 - 24V Solenoid Cash Drawer Kick';
}

export interface ShiftZReport {
  readonly id: string;
  readonly zNumber: number; // Consecutive sequential Z-Number
  readonly outletId: string;
  readonly terminalId: string;
  readonly businessDate: string; // YYYY-MM-DD
  readonly openedAt: string;
  readonly closedAt: string;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly supervisorId: string;
  readonly supervisorName: string;
  readonly openingFloat: number;
  readonly grossCashSales: number;
  readonly cashRefunds: number;
  readonly expectedCashInDrawer: number; // openingFloat + grossCashSales - cashRefunds
  readonly actualCountedCash: number;
  readonly cashVariance: number; // actualCountedCash - expectedCashInDrawer (negative = shortage)
  readonly cardTotal: number;
  readonly upiTotal: number;
  readonly grossSalesTotal: number;
  readonly cgstTotal: number;
  readonly sgstTotal: number;
  readonly totalTaxCollected: number;
  readonly totalBillsIssued: number;
  readonly status: ShiftZReportStatus;
  readonly notes?: string;
}

// ============================================================================
// 7. 16-CHARACTER HARDWARE-BOUND LICENSE KEYS
// ============================================================================

/**
 * Format: OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]
 * Example: OIUP-ENT1-M894-K7Q2
 * - Block 1: "OIUP" (4 characters constant)
 * - Block 2: 4 chars plan & platform code (e.g. "ENT1", "PRO1", "STR1")
 * - Block 3: 4 uppercase hex characters derived from hardware hash (e.g. "M894")
 * - Block 4: 4 uppercase alphanumeric checksum characters (e.g. "K7Q2")
 */
export type LicenseKeyString = `OIUP-${string}-${string}-${string}`;

export interface IssuedLicenseRecord {
  readonly id: string;
  readonly licenseKey: LicenseKeyString;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly planTier: LicensePlanTier;
  readonly hardwareFingerprint: string;
  readonly machineHash: string; // 4 hex chars
  readonly checksum: string; // 4 chars
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly isValid: boolean;
  readonly durationDays: number;
  readonly qrCodeDataUrl?: string;
}

// ============================================================================
// 8. PLATFORM TENANTS & MULTI-BRANCH OUTLETS
// ============================================================================

export interface TenantS3DomainMetrics {
  readonly objectCount: number;
  readonly sizeMb: number;
}

export interface TenantS3Metrics {
  readonly bucketName: string;
  readonly prefix: `tenants/${string}/`;
  readonly totalSizeMb: number;
  readonly objectCount: number;
  readonly domainBreakdown: Record<S3StorageDomain, TenantS3DomainMetrics>;
  readonly lastBackupIso: string;
  readonly zeroComminglingVerified: boolean;
  readonly outboxPendingCount: number;
}

export interface PlatformTenant {
  readonly id: string; // e.g. "tenant-0892"
  readonly businessName: string; // e.g. "Spice Route Hospitality Group"
  readonly ownerName: string; // e.g. "Priya Sharma"
  readonly ownerEmail: string; // e.g. "priya@spiceroute.in"
  readonly ownerPhone: string; // e.g. "+91 98110 23456"
  readonly tier: 'Enterprise Chain' | 'Pro Multi-Outlet' | 'Single Store Pilot';
  readonly tierCode: LicensePlanTier;
  readonly outletsCount: number;
  readonly activeTerminals: number;
  readonly s3Bucket: string; // e.g. "orderitup-tenant-spiceroute"
  readonly monthGmv: number; // e.g. 1485200 (₹14,85,200)
  readonly monthGmvFormatted: string;
  readonly lastSync: string;
  readonly status: TenantSubscriptionStatus;
  readonly city: string;
  readonly licenseKeys: readonly IssuedLicenseRecord[];
  readonly s3Metrics: TenantS3Metrics;
  readonly createdAt: string;
}

export interface S3OutboxRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly key: string; // e.g. "tenants/tenant-0892/backups/order-it-up-2026-10-31.sqlite.enc"
  readonly domain: S3StorageDomain;
  readonly payloadBase64Summary: string;
  readonly status: S3OutboxStatus;
  readonly attempts: number;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChainOutletTenders {
  readonly upi: number;
  readonly cash: number;
  readonly card: number;
}

export interface RestaurantOutlet {
  readonly id: string; // e.g. "outlet-1", "outlet-2", "outlet-3"
  readonly name: string; // e.g. "Downtown Bistro (Flagship)"
  readonly code: string; // e.g. "DTB", "CHX", "AT3"
  readonly location: string; // e.g. "Connaught Place, New Delhi"
  readonly city: string;
  readonly type: string; // e.g. "Fine Dine & Craft Cocktail Bar"
  readonly stateCode: string; // "07"
  readonly gstin: string; // e.g. "07AAAAA0000A1Z5"
  readonly fssaiNumber: string; // "10019011000234"
  readonly todaySales: number;
  readonly ordersCount: number;
  readonly avgTicket: number;
  readonly activeTables: string; // e.g. "8 / 12"
  readonly tenders: ChainOutletTenders;
  readonly topDish: string;
  readonly posTerminals: number;
  readonly status: 'Operational' | 'Peak Rush' | 'Closing Shift' | 'Offline Cache';
  readonly enginePort: string;
  readonly hardware: string;
  readonly s3Bucket: string;
}

export interface BranchPriceOverride {
  readonly priceOverride: number | null; // null represents base price
  readonly isAvailable: boolean; // 86-ing control
  readonly updatedAt: string;
  readonly reason?: string;
}

export interface CentralMenuItem {
  readonly id: string;
  readonly name: string;
  readonly category: 'Pizzas' | 'Starters' | 'Beverages' | 'Mains' | 'Desserts';
  readonly basePrice: number;
  readonly taxRatePercent: 5; // 5% GST (2.5% CGST + 2.5% SGST)
  readonly sacCode: '996331';
  readonly station: KitchenStationType;
  readonly course: CourseType;
  readonly dietaryTag: DietaryTag;
  readonly imageUrl?: string;
  readonly description: string;
  readonly branchOverrides: Record<string, BranchPriceOverride>;
}

// ============================================================================
// 9. KITCHEN DISPLAY SYSTEM (KDS) CANONICAL PROJECTION
// ============================================================================

export interface KdsTicket {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly tableNumber?: string;
  readonly orderType: 'dine_in' | 'takeaway' | 'delivery';
  readonly items: readonly OrderItem[];
  readonly status: TicketItemStatus;
  readonly createdAt: string;
  readonly elapsedMinutes: number;
  readonly slaStatus: 'normal' | 'warning' | 'breached'; // <8m green, 8-15m amber, >15m red
  readonly serverName?: string;
}

// ============================================================================
// 10. HYBRID BACKEND TELEMETRY & AUTO-PROBE
// ============================================================================

export interface BackendServiceProbe {
  readonly serviceName: 'POS Engine' | 'KDS Server' | 'Server App';
  readonly port: 3001 | 3002 | 3003;
  readonly endpoint: string;
  readonly online: boolean;
  readonly latencyMs: number;
  readonly version?: string;
  readonly lastChecked: string;
}

export interface BackendTelemetryState {
  readonly posEngine: BackendServiceProbe; // :3001
  readonly kdsServer: BackendServiceProbe; // :3002
  readonly serverApp: BackendServiceProbe; // :3003
  readonly mode: 'hybrid-live' | 'standalone-simulated';
  readonly lastChecked: string;
}
```

---

## 4. Verification & Invariant Checking

Each model contract in this specification was verified against the repository's active code and test paths:

1. **ESC/POS Solenoid Kick Pulse**:
   - Matches byte sequence in `main/printers/thermal.ts:770`: `Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])`.
   - Verified hex representation: `1B 70 00 19 FA`.
2. **Indian GST Rules**:
   - SAC `996331` (restaurant catering) and split 2.5% CGST + 2.5% SGST matches `landing/src/components/BillTemplateModal.tsx:351` and `main/services/tax-engine.ts`.
   - FSSAI License `10019011000234` matches modal header and legal requirements.
3. **Z-Report Shift Balancing Math**:
   - `expectedCashInDrawer = openingFloat + grossCashSales - cashRefunds`.
   - `cashVariance = actualCountedCash - expectedCashInDrawer`.
   - Matches SQLite aggregates computed in `main/routes/cash-closures.ts:282-372`.
4. **S3 Tenant Path Isolation**:
   - Path structure matches `buildTenantKey()` in `main/services/amazon-s3.ts:162-173`: `tenants/{tenantId}/{domain}/{subfolder}{filename}` with domains `backups`, `users`, `payments`, `media`. Zero data commingling.
5. **Static Export Compatibility**:
   - Zero imports from Node.js native libraries (`node:fs`, `node:crypto`, `electron`).
   - 100% compliant with Next.js 16.3 static browser export (`output: 'export'`) on Cloudflare Pages.

---

## 5. Synthesis & Downstream Implementation Guide

This type specification directly unblocks the subsequent components of Milestone M1 and M2:
- `landing/src/lib/dashboard-models.ts`: Pure export of these exact types.
- `landing/src/lib/dashboard-store.ts`: Reactive client store utilizing these types with seed records for Priya Sharma's "Spice Route Hospitality Group" (Downtown Bistro, Cyber Hub Express, Airport Terminal 3).
- `landing/src/lib/backend-detector.ts`: Non-blocking probe hook outputting `BackendTelemetryState`.
- Milestone M2 Persona Views: Front Cashier, Kitchen Chef, Server/Waiter, Accountant, Delivery Driver, and Owner/Manager views consume typed props without type assertions or `any` casts.
