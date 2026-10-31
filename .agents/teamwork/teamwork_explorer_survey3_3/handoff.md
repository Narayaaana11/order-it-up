# Phase 0 Architecture & Codebase Survey: Requirements R4 & R5

**Agent**: `teamwork_explorer_survey3_3`  
**Working Directory**: `.agents/teamwork/teamwork_explorer_survey3_3/`  
**Parent Orchestrator ID**: `0f278f7c-ec06-48f6-9c2f-e89c1978e9bf`  
**Timestamp**: `2026-10-31T10:48:00Z`  
**Scope**: 
- **R4. Web Admin Dashboard & Separation of Concerns**
- **R5. Cloud Data Storage & S3 Bucket Management**

---

## 1. Observations

### 1.1 Architectural Boundary & User Role Specifications (`users.md`, `shared/role-permissions.ts`, `lib/role-routing.ts`)
- **`users.md` (§ 1 & § 2)** explicitly defines the POS vs. Web platform boundary:
  > *"Order It Up enforces a strict separation between Point of Sale (POS) Billing and Web SaaS & CRM Management... POS billing is strictly supported only on the Desktop App (Electron) and the Mobile POS App (Flutter). The Web Application (`orderitup.pages.dev` / `localhost:3000`) is dedicated exclusively to Landing, Registration, SaaS Control Plane, CRM & Customer Relationship Management, Owner/Manager Dashboards, Financial/Tax Auditing, and Staff Management. ⛔ NO WEB POS BILLING."*
- **Role Hierarchy**: 10 primary personas defined across Central SaaS Operators (`SUPER_ADMIN`, `ADMIN`, `FINANCE`, `SUPPORT`, `READ_ONLY`), Restaurant Enterprise Staff (`owner`, `manager`, `accountant`, `cashier`, `server`, `chef`, `delivery`), and `customer`.
- **`shared/role-permissions.ts`** specifies static role permissions:
  - Lines 25–35: Groups `OWNER`, `OWNER_MANAGER`, `OWNER_MANAGER_CASHIER`, `SALES`, `ALL_STAFF`.
  - Lines 76–121: `PERMISSION_CAPABILITIES` define capability gates (`pos`, `dashboard`, `reports`, `inventory`, `expenses`, `staff`, `settings`, `cloudDrive`, `cloudAccountData`).
  - Cashier is strictly restricted to `ROLE_ACCESS.ownerManagerCashier` (`pos`, `ordersReadCreate`, `billsPayments`, `printing`, `whatsappUse`, `support`). All dashboard, reporting, staff, settings, inventory, and financial audit capabilities require `ROLE_ACCESS.ownerManager` or `ROLE_ACCESS.owner`.
- **`frontend/src/lib/role-routing.ts`** resolves default routes:
  - Central SaaS operators & Owner: `/cloud-portal` (web HQ).
  - Branch Manager: `/dashboard`.
  - Head Accountant: `/reports`.
  - Cashier: `/pos` (desktop) vs. `/dashboard` (web landing guidance).
  - Server: `/tables` (desktop) vs. `/dashboard` (web).
  - Chef: `/kds` (desktop) vs. `/kds-standalone` (web).
  - Customer: `/menu`.

### 1.2 Separation of Concerns & Route Isolation in Runtime Code
- **Web-side POS Billing Guard** in `frontend/src/app/(dashboard)/pos/page.tsx`:
  - Lines 403–406:
    ```typescript
    useEffect(() => {
      if (!isElectronEnvironment()) {
        return;
      }
      // POS initialization code...
    ```
  - Lines 974–1003:
    ```tsx
    if (isClient && !isElectronEnvironment()) {
      return (
        <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mb-4">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Desktop & Mobile POS Only</h2>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">
            Point of Sale billing is exclusively supported on the Order It Up Desktop Application (Windows, macOS, Linux) with offline SQLite and thermal hardware, and the Flutter Mobile/Tablet Companion for waitstaff and kitchen.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The Web Portal is reserved for SaaS Management, CRM, and Restaurant Owner Dashboards.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-colors shadow-sm">
              Go to Owner Dashboard
            </Link>
            <Link href="/cloud-portal" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors border border-slate-700">
              Open Cloud HQ Portal
            </Link>
          </div>
        </div>
      );
    }
    ```
- **Navigation Isolation** in `frontend/src/components/layout/Sidebar.tsx`:
  - Line 120:
    ```typescript
    // POS billing is exclusive to Desktop Electron App and Flutter Mobile; hide from web portal navigation
    if (item.href === '/pos' && !isElectron) return false;
    ```
  - Lines 126–127: Filters navigation items using `hasRole(role, item.roles)`. For a Cashier, all administrative tabs (`/dashboard`, `/reports`, `/inventory`, `/expenses`, `/products`, `/tables`, `/settings`, `/customers`, `/staff`, `/ai-insights`) are hidden from view.
- **Desktop Dashboard Role Guard** in `frontend/src/app/(dashboard)/dashboard/page.tsx`:
  - Lines 216–220:
    ```typescript
    useEffect(() => {
      if (currentTenant && !isOwnerOrManager) {
        router.replace('/pos');
      }
    }, [currentTenant, isOwnerOrManager, router]);
    ```
  - When logged into the Desktop App as Cashier, navigating to `/dashboard` immediately redirects to `/pos`.
- **Landing Page Navigation** in `frontend/src/components/landing/Navbar.tsx`:
  - Line 28: Computes `dashboardHref = mounted ? getLandingPage() : "/cloud-portal"`.
  - Lines 77–86: When authenticated, displays a dedicated user/role badge and a single "Dashboard" button routing to the user's role-appropriate destination.
  - Lines 100–118: When unauthenticated, displays "Login / Signup" (`/auth/login`) and "Download Desktop POS" (`#download`).

### 1.3 Repository Data Schemas & Report Derivations
The system features 62 SQLite tables in `main/db.ts` and 8 primary cloud entity tables in `apps/cloud-api/migrations/0001_initial_schema.sql`.

#### Schema Matrix & Report Invariants:
| Report / Metric Domain | Primary Database Tables | Key Schema Columns & Aggregations | Backend Service / Route Handler |
| :--- | :--- | :--- | :--- |
| **Gross Revenue** | `bills`, `synced_orders` | `SUM(b.paid_amount)`, `SUM(o.grand_total)` | `main/routes/reports.ts:83`, `reports.ts:197`, `cloud-api/routes/analytics.ts:19` |
| **Refunds & Adjustments** | `refunds` | `SUM(CAST(r.amount_cents AS REAL)) / minorFactor` | `main/routes/reports.ts:84`, `reports.ts:201` |
| **Net Collected Sales** | `bills`, `refunds` | `grossCollected - refunded` | `main/routes/reports.ts:227`, `reports.ts:757` |
| **Order Volume & Ticket Counts** | `orders`, `bills`, `synced_orders` | `COUNT(o.id)`, `COUNT(b.id)` | `main/routes/reports.ts:89`, `reports.ts:144`, `reports.ts:228` |
| **Average Order Value (AOV)** | `bills`, `orders` | `(grossCollected - refunded) / billCount` | `main/routes/reports.ts:230`, `reports.ts:521`, `reports.ts:760` |
| **Payment Breakdown (Cash/Card/UPI)** | `bills.payment_details`, `synced_cash_closures` | JSON parse of payment methods, `cash_sales`, `card_sales`, `upi_sales` | `main/routes/cash-closures.ts`, `reports.ts:86`, `cloud-api/routes/analytics.ts:20` |
| **Top-Selling Menu Items** | `order_items`, `products`, `synced_order_items` | `SUM(oi.quantity) as total_quantity`, `SUM(oi.subtotal) as total_revenue` | `main/routes/reports.ts:365`, `reports.ts:791`, `cloud-api/routes/analytics.ts:66` |
| **Category Performance** | `order_items`, `products`, `categories` | `SUM(oi.quantity)`, `SUM(oi.subtotal)` grouped by `categories.id` | `main/routes/reports.ts:551–562` |
| **Staff Sales & Shift Performance** | `orders`, `users`, `cash_closures` | `SUM(o.total) as revenue`, `COUNT(o.id) as orderCount` grouped by `users.id` | `main/routes/reports.ts:538–547`, `reports.ts:823–833` |
| **Low-Stock Inventory Alerts** | `raw_ingredients` | `SELECT * FROM raw_ingredients WHERE current_stock <= minimum_stock` | `main/services/inventory-engine.ts:202` (`getLowStockIngredients()`), `main/routes/inventory.ts:188` |
| **Recipe COGS & BOM Margin** | `product_recipes`, `raw_ingredients` | `quantity_required * (1 + wastage_pct/100) * cost_per_unit` | `main/services/inventory-engine.ts:46` (`calculateProductRecipeCost()`) |
| **Table Turnaround & Current Occupancy** | `tables`, `orders` | `AVG((julianday(completed_at) - julianday(created_at)) * 24 * 60)` | `main/routes/reports.ts:102–117` |
| **Kitchen Velocity (Prep Time)** | `orders` | `AVG((julianday(ready_at) - julianday(cooking_started_at)) * 24 * 60)` | `main/routes/reports.ts:528–533` |
| **Timezone-Aware Peak Traffic** | `orders.created_at` | Bucketing order timestamps into 24 hours & 7 weekdays using `tenantTimezone()` | `main/routes/reports.ts:44–61`, `reports.ts:565–580` |
| **X-Report (Live Intra-Day Snapshot)** | `bills`, `refunds`, `cash_closures` | Live drawer cash, gross, net, refund attribution, expected cash without float | `main/routes/reports.ts:620–675` |
| **Z-Report (Immutable End-of-Day Closure)** | `cash_closures` | Stored day closure: `opening_float_cents`, `expected_cash_cents`, `counted_cash_cents`, `variance_cents` | `main/routes/reports.ts:686–725` |
| **Tax Liabilities (CGST/SGST/IGST/VAT)** | `bills`, `tax_rules`, `country_packs` | Aggregate tax components across bills and items; Tally XML export | `main/services/tax-components.ts`, `reports.ts:244`, `cloud-api/routes/accountant.ts:69` |

### 1.4 Existing Cloud Storage, Sync, and Backup Mechanisms
- **Existing Amazon S3 Service** (`main/services/amazon-s3.ts`):
  - Uses `@aws-sdk/client-s3` (`S3Client`, `PutObjectCommand`, `ListObjectsV2Command`, `DeleteObjectCommand`, `HeadBucketCommand`).
  - Implements daily automated SQLite database snapshots (`backups/order-it-up-${dateStr}.db`) with configurable retention pruning (`pruneOldBackups`).
  - Stores credentials in SQLite `settings` table with Electron `safeStorage` encryption.
  - Has Express routes in `main/routes/amazon-s3.ts` (`/api/s3/status`, `/api/s3/settings`, `/api/s3/test-connection`, `/api/s3/backups`, `/api/s3/backup-now`).
  - Has settings UI in `frontend/src/components/settings/AmazonS3Settings.tsx` rendered at `/settings?tab=s3`.
- **Existing Google Drive Service** (`main/services/google-drive.ts`):
  - Provides OAuth loopback authentication and encrypted DB snapshot uploads to Google Drive folder `"Order It Up Backups"`.
- **Existing Outbound Sync Bridge** (`main/services/cloud-sync.ts` & `apps/cloud-api/src/routes/sync.ts`):
  - Buffers local offline sales events in `cloud_sync_outbox`, `support_ticket_outbox`, and `store_diagnostics_outbox`.
  - Ingests events to Cloudflare D1 (`synced_orders`, `synced_order_items`, `synced_cash_closures`) via `POST /api/pos/events`.
- **Cloud Portal Interface** (`frontend/src/app/cloud-portal/page.tsx`):
  - Provides cloud-based multi-location sales overview, branch comparison, item velocity, cash closures, Tally XML export, and catalog management.

---

## 2. Logic Chain

1. **Premise 1: Strict Separation of Concerns (R4)**
   - The user request and `users.md` mandate that POS billing must never be permitted in the web browser, and desktop POS must remain focused on fast billing without clutter from central administrative dashboards.
   - Code verification in `frontend/src/app/(dashboard)/pos/page.tsx` (lines 404, 974) and `frontend/src/components/layout/Sidebar.tsx` (line 120) proves that POS billing is already strictly isolated:
     - On the web, visiting `/pos` blocks the POS engine and renders an informative "Desktop & Mobile POS Only" panel pointing users to the Owner Dashboard and Cloud HQ Portal.
     - In the desktop app, Cashier accounts are restricted by `ROLE_ACCESS.ownerManagerCashier` and `dashboard/page.tsx:218`, redirecting them immediately to `/pos`.
   - *Identified Discrepancy / Area for Alignment*: When an Owner logs into the desktop Electron app, `/dashboard` is currently available in the desktop sidebar. If "The desktop POS must remain dedicated exclusively to cashier billing operations... without an embedded admin management dashboard" is enforced unconditionally for all desktop roles, desktop Electron should either boot straight into `/pos` for cashier operations, or provide a clean kiosk toggle where billing terminals run purely in POS mode while admin management is directed to the Web Platform (`/cloud-portal`).

2. **Premise 2: Web Admin Dashboard Availability (R4)**
   - The web platform currently features two dashboard surfaces:
     - `/cloud-portal`: Multi-tenant, franchise-level cloud HQ with branch sales comparisons, item velocities, accountant closures, and Tally export (backed by Cloudflare D1).
     - `/dashboard` & `/reports`: Store-level operations and financial summaries (backed by SQLite Express API).
   - In Cloudflare Pages static export, client API calls point to `CLOUD_API_BASE` (`orderitup-cloud-api.narayaaana11.workers.dev`).
   - *Identified Discrepancy / Area for Alignment*: The Web Admin Dashboard on the landing page navbar directs authenticated owners to `dashboardHref` (`/cloud-portal`). To ensure web visitors see complete restaurant operational reports matching repository schemas (gross revenue, net sales, order volume, payment breakdown [Cash/Card/UPI], top-selling items, inventory reorders, staff summaries), the Web Dashboard must render these metrics from Cloudflare D1 via `apps/cloud-api` (or demo fixtures in demo mode).

3. **Premise 3: S3 Bucket Data Management Service Design (R5)**
   - The current `main/services/amazon-s3.ts` was originally written as a simple desktop DB backup utility.
   - Requirement R5 requires an expanded S3 data management service capable of:
     - Supporting S3-compatible providers (AWS S3, MinIO, Cloudflare R2, Wasabi, LocalStack) via configurable `endpoint` and `forcePathStyle`.
     - Managing multiple data domains: (a) software platform data, (b) user accounts & compliance audits, (c) payment records & receipts, (d) media assets.
     - Strictly isolating customer operational data across tenants via namespace prefixing (`tenants/{tenantId}/...`) and bucket policies.
     - Supporting a secure mock/fallback mode so offline desktop operations, development environments, and CI tests remain resilient without live AWS credentials.

---

## 3. Caveats

1. **Offline-First Isolation**: S3 uploads must remain non-blocking. If a terminal is offline, network failures must never block order placement, ticket generation, or receipt printing. Pending S3 sync events must queue in a local outbox.
2. **SafeStorage Availability**: Electron's `safeStorage` is available only in packaged desktop builds on Windows/macOS/Linux. In web environments (`apps/cloud-api`), secrets must use Cloudflare Worker environment variables or encrypted KV storage.
3. **No Web POS Billing Invariant**: This survey strictly respects the core project rule: web POS billing must not be implemented. All billing remains on Electron Desktop and Flutter Mobile.

---

## 4. Conclusion & Architectural Designs

### 4.1 R4 Web Admin Dashboard Architecture
- **Web Admin Landing Route**: Accessible via `/cloud-portal` (Franchise HQ) and `/dashboard` (Store Operations).
- **Navbar Integration**: The landing page navbar dynamically checks session state; authenticated users see their name, role badge, and a direct "Dashboard" link (`/cloud-portal` for Owners/Super Admins, `/reports` for Accountants).
- **Core Dashboard Metrics Derived from Schemas**:
  1. *Executive Financial Summary*: Gross Revenue, Refunds, Net Sales, Total Orders, Average Ticket Size (AOV).
  2. *Tender & Payment Split*: Breakdown across Cash, Card, UPI, Wallets, and Custom payment methods with variance tracking.
  3. *Menu & Category Velocity*: Top 10 items by sales volume and revenue; category performance distribution.
  4. *Staff & Operational Velocity*: Staff sales contribution, kitchen average prep time (minutes), table turnaround velocity.
  5. *Inventory Reorder Feed*: Low-stock raw ingredients (`current_stock <= minimum_stock`) with reorder quantities.
  6. *Tax & Accounting Summaries*: CGST/SGST/IGST breakdown and one-click Tally XML voucher export.

### 4.2 R5 S3 Bucket Data Management Architecture

#### S3 Client Configuration Specification:
```typescript
export interface S3ServiceConfig {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;        // Optional: Custom endpoint for Cloudflare R2, MinIO, Wasabi, LocalStack
  forcePathStyle?: boolean; // Set true for MinIO and local testing
  enabled: boolean;
  retentionDays: number;
  mockMode?: boolean;       // Set true for offline dev/testing integrity
}
```

#### Strict Multi-Tenant Directory Hierarchy:
```text
<s3-bucket-name>/
├── platform/
│   ├── releases/           # Windows desktop installers (NSIS, APPX), checksums
│   ├── tax-packs/          # Versioned country tax packages (IN, US, UK, etc.)
│   └── templates/          # Standard receipt and KOT thermal print templates
└── tenants/
    └── {organization_id}/
        ├── backups/        # Encrypted SQLite database snapshots (.db.enc)
        │   └── 2026/10/order-it-up-2026-10-31T10-00-00.db
        ├── users/          # Anonymized user account archives & audit exports
        │   └── users-audit-20261031.json
        ├── payments/       # Signed payment records, transaction batches, Z-reports
        │   ├── z-reports/z-closure-20261031.json
        │   └── receipts/inv-20261031-0042.pdf
        └── media/          # Customer-owned assets
            ├── products/   # Menu item photos
            └── branding/   # Restaurant logos and receipt header graphics
```

#### Tenant Segregation & Security Policy:
- **Prefix Isolation**: All customer data operations enforce `{organization_id}` prefixing. Any request attempting to traverse outside `tenants/{organization_id}/` is rejected with `AccessDenied`.
- **IAM Condition Policy**:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        "Resource": "arn:aws:s3:::order-it-up-storage/tenants/${aws:PrincipalTag/TenantId}/*"
      }
    ]
  }
  ```

#### Secure Mock & Fallback Mode:
- **Local Filesystem Mock Adapter**: When `mockMode === true` or AWS credentials are omitted, the service switches to a local mock driver writing to `userData/mock-s3/` with identical hierarchy and response contracts.
- **In-Memory Mock for Automated Tests**: Integrated into `tests/` without requiring external network connections or AWS credentials.
- **Offline Outbox Queue**: Upload failures while offline do not throw; they persist to `s3_upload_outbox` and retry automatically upon network reconnection.

---

## 5. Verification Method

To verify these findings and implementations:

1. **Inspect Separation of Concerns**:
   - Verify POS blocking screen in browser: Inspect `frontend/src/app/(dashboard)/pos/page.tsx:974–1003`.
   - Verify sidebar hiding `/pos` on web: Inspect `frontend/src/components/layout/Sidebar.tsx:120`.
   - Verify role check for dashboard: Inspect `frontend/src/app/(dashboard)/dashboard/page.tsx:216–220`.

2. **Inspect S3 Service & Endpoints**:
   - Verify existing S3 service: `main/services/amazon-s3.ts`.
   - Verify existing S3 routes: `main/routes/amazon-s3.ts`.
   - Verify existing S3 settings UI: `frontend/src/components/settings/AmazonS3Settings.tsx`.
   - Run S3 & MongoDB integration test:
     ```sh
     npx ts-node --transpile-only -P tests/tsconfig.json tests/mongodb-s3-integration.test.ts
     ```

3. **Inspect Repository Schemas & Reports**:
   - Verify report queries: `main/routes/reports.ts`.
   - Verify inventory low-stock alerts: `main/services/inventory-engine.ts`.
   - Run report tests:
     ```sh
     node tests/run-electron-node-test.cjs tests/reports-insights.test.ts
     node tests/run-electron-node-test.cjs tests/reports-daily-stats-table-turn.test.ts
     ```

4. **Lint and Build Verification**:
   ```sh
   npm run lint
   npm run build:frontend
   ```

5. **Conditions that Invalidate Conclusions**:
   - If a new requirement requests browser-based POS billing (violating `users.md` invariant).
   - If S3 bucket credentials are required to be hardcoded in the frontend bundle (violating security invariant).
