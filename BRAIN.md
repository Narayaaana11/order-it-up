# ORDER IT UP (OIU) — PROJECT BRAIN

## 1. Product Identity
- **Product Name**: Order It Up
- **Short Name**: OIU
- **Product Category**: Offline-First Commercial Restaurant Billing & Point of Sale (POS) with Multi-Tenant Cloud Control Plane
- **Target Market**: India (Restaurants, Cafes, Bakeries, QSRs, Cloud Kitchens, Bars, Food Outlets, Multi-Outlet F&B Chains)
- **Commercial Model**: Paid Commercial Subscription (Tiered per Outlet/Month or Outlet/Year)
- **Current Status**: Production Migration & Hardening (Version 1.0.0 Commercial Release)

## 2. Product Vision
Order It Up is engineered to be the most resilient, fast, and feature-complete restaurant management system in India. It guarantees zero-downtime operations by running 100% offline locally using embedded SQLite, while providing enterprise cloud synchronization to MongoDB, automated S3 disaster recovery backups, and a centralized administrative control plane for billing, subscriptions, and device licensing.

## 3. Target Customers
- Full-service Dine-In Restaurants & Fine Dining
- Cafes, Coffee Shops & Bakeries
- Quick Service Restaurants (QSR) & Food Court Stalls
- Cloud Kitchens & Takeaway Counters
- Multi-Terminal & Multi-Outlet Restaurant Enterprises

## 4. Core Features
- **Fast Touch POS**: Table orders, quick sales, split checks, discounts, item modifiers/addons, kitchen notes.
- **Visual Table & Floor Plan**: Dynamic table layouts, occupancy status, table transfers, bill settlement.
- **Kitchen Display System (KDS)**: Real-time ticket dispatch, multi-station routing (Kitchen, Bar, Bakery, Grill).
- **Thermal & Network Printing**: ESC/POS thermal receipts, KOT slips, barcode labels, Z-reports, cash drawer kicks.
- **Customer CRM & Loyalty**: Phone-indexed customer profiles, visit tracking, cashback loyalty points, credit ledger.
- **Cash Management & Shifts**: Cash drawer float recording, shift handovers, closure balancing, discrepancy audits.
- **Indian GST Engine**: CGST, SGST, IGST, UTGST, GST-inclusive/exclusive pricing, HSN/SAC codes, B2B tax invoices with GSTIN validation.
- **Offline-First Resilience**: Zero dependency on active internet connection for any core operational workflow.
- **Dual Cloud Sync & Backup**: Real-time event sync to MongoDB Atlas; scheduled encrypted snapshots to Amazon S3.
- **Central Admin Control Plane**: Dedicated SaaS operator portal for restaurant tenant onboarding, licensing, and monitoring.

## 5. System Architecture

```
                         ┌─────────────────────────────────┐
                         │      OIU ADMIN DASHBOARD        │
                         │    (SaaS Operations Portal)     │
                         └────────────────┬────────────────┘
                                          │
                                 OIU CLOUD API (Node/TS)
                                          │
                   ┌──────────────────────┼──────────────────────┐
                   │                      │                      │
             MongoDB Cloud          Amazon S3 Bucket       Services Layer
            (Atlas Replica Set)   (Encrypted Snapshots)   (Licensing/Auth)
                   │                      │                      │
                   └──────────────────────┼──────────────────────┘
                                          │
                                HTTPS / Secure WebSocket
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
   RESTAURANT OUTLET A             RESTAURANT OUTLET B             RESTAURANT OUTLET C
          │                               │                               │
    Order It Up POS                 Order It Up POS                 Order It Up POS
    (Local Electron App)            (Local Electron App)            (Local Electron App)
          │                               │                               │
   SQLite (flo.db)                 SQLite (flo.db)                 SQLite (flo.db)
   Fast, 0ms latency               Fast, 0ms latency               Fast, 0ms latency
          │                               │                               │
    ┌─────┼─────────┐               ┌─────┼─────────┐               ┌─────┼─────────┐
    │     │         │               │     │         │               │     │         │
   POS   KDS    Tableside          POS   KDS    Tableside          POS   KDS    Tableside
    │                               │                               │
 Printers                        Printers                        Printers
```

## 6. Local POS Architecture
- **Engine**: Electron v43+, Node.js runtime, Chromium rendering engine.
- **Database Engine**: Embedded `better-sqlite3` compiled natively against Electron's ABI with Write-Ahead Logging (WAL) enabled.
- **Frontend Stack**: Next.js 16 (App Router) exported as a static optimized bundle, React 19, Zustand state management, Tailwind CSS, Lucide icons.
- **Local HTTP & IPC**: Embedded Express HTTP server (`main/server.ts`) running locally on loopback (`http://localhost:3001` or next free port), secured with strict CORS and origin verification.

## 7. Cloud Architecture
- **Primary Data Layer**: MongoDB (Cloud Atlas) utilizing multi-tenant documents indexed by `tenant_id` and `outlet_id`.
- **Backup & Disaster Recovery**: Amazon S3 private bucket utilizing server-side AES-256 encryption.
- **API Boundary**: First-party OIU Cloud API. No dependencies on legacy or external third-party servers.

## 8. Admin Dashboard Architecture
- **Portal**: Dedicated Administrative Control Plane (`admin-dashboard/`) exclusively for Order It Up SaaS operators.
- **Role Hierarchy**: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `FINANCE`, `READ_ONLY`.
- **Capabilities**: Tenant lifecycle management, subscription enforcement, remote sync monitoring, device revocation, feature flags, system health telemetry.

## 9. Database Architecture
- **Source of Truth for Transactions**: Local SQLite database (`flo.db`).
- **Cloud Replication**: Incremental event-sourcing and document replication to MongoDB collections.
- **Retention & Integrity**: Strict foreign key enforcement (`PRAGMA foreign_keys = ON;`), WAL mode, automated corruption detection on boot.

## 10. SQLite Schema Overview
- Core tables: `users`, `tenants`, `categories`, `products`, `product_addon_links`, `addon_groups`, `orders`, `order_items`, `order_item_addons`, `bills`, `transactions`, `customers`, `tables`, `kds_stations`, `settings`, `cash_closures`, `held_orders`, `tax_packs`, `print_templates`, `support_ticket_outbox`, `cloud_sync_outbox`.

## 11. MongoDB Collections
- `oiu_tenants`: Restaurant business profiles, legal entity names, GSTIN, primary contact.
- `oiu_subscriptions`: Plan details, billing cycles, start/end dates, grace periods, payment status.
- `oiu_devices`: Registered hardware IDs, MAC/UUID hashes, app versions, activation states.
- `oiu_sync_orders`: Asynchronously replicated order summaries and item logs.
- `oiu_sync_customers`: Aggregated customer CRM profiles.
- `oiu_audit_logs`: Immutable audit trails for admin and security events.

## 12. S3 Backup Architecture
- Encrypted compressed database snapshots stored under `backups/{tenant_id}/{outlet_id}/{timestamp}.sqlite.gz`.
- Checksums (SHA-256) calculated prior to upload and validated upon download.
- Retention lifecycle policy: Daily snapshots retained for 30 days, monthly snapshots retained for 1 year.

## 13. Synchronization Architecture
- **Strategy**: Asynchronous outbox pattern with deterministic UUIDs and idempotent upserts.
- **Fault Tolerance**: Network failures trigger exponential backoff retry. Local transactions commit unconditionally.

## 14. Authentication Architecture
- **Password Security**: Bcrypt with salt rounds = 10.
- **Staff Quick-Login**: 4-to-6 digit numeric PINs hashed with bcrypt (`pin_hash`).
- **Session Tokens**: Cryptographically signed JSON Web Tokens (JWT) with per-device secret and token revocation table (`users.tokens_valid_after`).

## 15. Authorization / RBAC
- Roles:
  - `owner`: Full operational, financial, and configuration authority.
  - `manager`: Void approvals, refunds, discount overrides, cash closure.
  - `cashier`: Billing, payment collection, table assignments.
  - `server`: Tableside ordering, KOT printing, bill viewing.
  - `chef`: Kitchen display operations, ticket status transitions.

## 16. Subscription Architecture
- Tiers: `TRIAL`, `STARTER`, `PRO`, `ENTERPRISE`.
- Subscription Lifecycle: `active` -> `past_due` -> `grace_period` (7 days) -> `suspended` -> `cancelled`.
- Server-side entitlement validation: Paid feature restrictions enforced in backend API routes.

## 17. Device Licensing
- Device fingerprinting based on system UUID, CPU ID, and MAC address.
- Maximum device limits enforced per subscription tier.
- Device revocation from Admin Dashboard terminates device session on next sync checkpoint.

## 18. Indian GST Architecture
- Currencies: Indian Rupee (`INR`, symbol `₹`).
- Timezone: Indian Standard Time (`Asia/Kolkata`, UTC+05:30).
- GST Tax Slabs: 0%, 5%, 12%, 18%, 28%.
- Automatic split:
  - Intra-state supply: CGST (50%) + SGST (50%).
  - Inter-state supply: IGST (100%).
- B2B Tax Invoices: Mandatory 15-character Indian GSTIN validation regex (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`).

## 19. Printing Architecture
- Raw thermal ESC/POS generation for 80mm (48 column) and 58mm (32/36 column) paper widths.
- Windows native driver printing (`win32` print spooler API), IPP network thermal printing, USB direct transfer.
- Non-Latin & Indic character rendering via canvas rasterization.

## 20. KDS Architecture
- WebSockets on loopback/LAN (`ws://localhost:3001/kds`).
- Statuses: `received` -> `preparing` -> `ready` -> `served`.
- Auto-routing based on category station mapping.

## 21. Tableside Architecture
- Lightweight mobile responsive interface accessible over local WiFi.
- Waiters take orders directly on tablets/phones without accessing full POS cash functions.

## 22. WhatsApp Architecture
- Order receipts, digital bill links, and payment confirmations dispatched directly to customer phone numbers via official WhatsApp Business API provider abstraction.

## 23. Email Architecture
- Pluggable provider abstraction (`main/services/email/`).
- Transactional templates: Setup welcome, monthly financial statements, subscription invoices.

## 24. Support Architecture
- Local `support_ticket_outbox` table retains all submitted tickets offline.
- Dispatches directly to first-party OIU Support API with sanitized diagnostics (no customer PII).

## 25. Admin Architecture
- Standalone administrative application running on separate port/domain.
- Zero client-side access to admin features from the local restaurant POS.

## 26. Security Model
- Least privilege principle across all service layers.
- SQLite queries strictly parameterized using prepared statements.
- Passwords, secrets, and AWS/Mongo credentials never exposed in client bundles.

## 27. Electron Security Model
- `contextIsolation: true` on all BrowserWindows.
- `nodeIntegration: false` in renderers.
- Strict Content Security Policy (CSP) blocking external scripts and eval.
- Preload scripts expose only explicit whitelist of IPC bridges.

## 28. API Architecture
- RESTful HTTP endpoints with JSON payloads.
- Structured error handling with standardized error formats.
- Rate limiting on authentication routes (10 attempts per minute).

## 29. Environment Variables
- `NODE_ENV`: `production` or `development`
- `PORT`: POS local backend port (default 3001)
- `OIU_CLOUD_API_URL`: First-party cloud backend URL
- `MONGODB_URI`: MongoDB connection string
- `AWS_REGION`: Amazon AWS region (e.g. `ap-south-1` for Mumbai)
- `AWS_S3_BUCKET`: Private S3 bucket name
- `AWS_ACCESS_KEY_ID`: AWS IAM access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS IAM secret key
- `JWT_SECRET`: Signing secret for authentication tokens
- `ENCRYPTION_KEY`: 32-byte master encryption key

## 30. External Services
- MongoDB Atlas: Cloud database replica set.
- Amazon Web Services: S3 cloud storage for backups.
- WhatsApp Cloud API: Customer digital receipts.
- Payment Gateway (Razorpay/Cashfree): Subscription checkout and recurring billing.

## 31. Infrastructure Ownership
- All production infrastructure is owned and managed exclusively by Order It Up (Narayana Thota).
- Zero reliance on upstream repositories or third-party servers.

## 32. Deployment
- Desktop installers built using `electron-builder` for Windows (NSIS, portable) and Linux (AppImage, deb).
- Cloud backend deployed on containerized Node.js runtime (Docker / AWS ECS / DigitalOcean).

## 33. Windows Build
- Targets: NSIS installer (`.exe`) with desktop & Start Menu shortcuts.
- Executable Name: `order-it-up.exe`.

## 34. Linux Build
- Targets: AppImage, Debian package (`.deb`).
- Icon: `order-it-up.png` under `/usr/share/icons/hicolor`.

## 35. macOS Build
- macOS signing identities left intentionally blank/placeholder until Apple Developer Program enrollment.

## 36. CI/CD
- GitHub Actions pipeline runs lint, TypeScript verification, unit tests, and production build checks.

## 37. Update System
- Configured for first-party update releases via private S3 or GitHub Releases under Order It Up repository.

## 38. Backup Strategy
- Automatic daily local backups (`backups/local/`).
- Real-time cloud sync to MongoDB.
- S3 daily snapshots with 30-day rolling expiration.

## 39. Disaster Recovery
- Point-in-time recovery from latest verified S3 snapshot.
- Single-command restore utility with automated checksum verification.

## 40. Testing Strategy
- Dual-server smoke tests (`test:smoke`).
- Database migration audit (`audit:db`).
- Print engine verification (`test:print-kernel`).
- Auth & RBAC regression suite (`test:staff-authz`).

## 41. Important Commands
- `npm run dev`: Start local POS in development mode.
- `npm run build`: Compile TypeScript backend and copy assets.
- `npm run build:frontend`: Compile Next.js frontend production bundle.
- `npm run test:smoke`: Execute core smoke test suite.
- `npm run release:win`: Package Windows production installer.

## 42. Development Workflow
- Follow branch-based development with local test verification before every merge.

## 43. Production Workflow
- Staged release rollouts with canary validation on test outlets.

## 44. Migration Strategy
- In-place preservation of `flo.db` SQLite data files to guarantee zero data loss for existing outlets.

## 45. Legacy Compatibility
- Backward-compatible SQLite migration functions maintained.

## 46. Known Limitations
- macOS DMG builds require Apple Developer certificate to bypass Gatekeeper.

## 47. Open Decisions
- Selection of primary Indian SMS gateway provider (DLT-registered) for SMS e-bills.

## 48. Credentials Still Required From Owner
- Production AWS IAM credentials for S3 bucket (`ap-south-1`).
- Production MongoDB Atlas connection URI.
- Apple Developer Team ID and Developer ID certificate (when releasing on macOS).
- Razorpay / Cashfree Merchant API Keys.

## 49. Future Roadmap
- Direct UPI QR Dynamic Display on Customer-Facing Displays (CFD).
- Swiggy / Zomato order aggregator webhooks integration.
- Inventory barcode scanner integration for packaged retail items.

## 50. Change Log
- **1.0.0 (2026-09-09)**: Official commercial ownership migration to Order It Up (OIU). Decoupled previous owner cloud endpoints, integrated MongoDB cloud sync, AWS S3 automated backup, first-party Admin Dashboard architecture, and Indian GST/INR defaults.
