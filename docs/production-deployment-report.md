# Order It Up — Production Deployment & Cloudflare Release Report

**Release Cycle:** C-13 Complete Cloudflare Production Launch  
**Environment:** Production (`ENVIRONMENT=production`)  
**Deployment Date:** October 30, 2026  
**Deployed Git SHA (Main Branch):** `bdc5abdb630ceff5c734d7065db705eecb49b6d4` (merged PR #11) / `3c435d07fe08eec914baef48ae66dbff1f8f3c73`  
**Cloudflare Account ID:** `b970a9d64087c51de42c12abb3f45e0a`  

---

## 1. System Architecture & Component Inventory

Order It Up is architected as an offline-first multi-branch restaurant Point of Sale and management platform:

```
                                  +---------------------------------------+
                                  |   Cloudflare Pages (Frontend Web App) |
                                  |   https://orderitup.pages.dev         |
                                  |   (Target: https://app.orderitup.in)  |
                                  +-------------------+-------------------+
                                                      |
                                           HTTPS / JSON REST API
                                                      v
                                  +---------------------------------------+
                                  |   Cloudflare Edge Worker (Cloud API)  |
                                  |   orderitup-cloud-api                 |
                                  |   https://orderitup-cloud-api...      |
                                  |   (Target: https://api.orderitup.in)  |
                                  +-------------------+-------------------+
                                                      |
                                              Binding: "DB"
                                                      v
                                  +---------------------------------------+
                                  |   Cloudflare D1 Serverless SQL        |
                                  |   orderitup-d1-prod (APAC Singapore)  |
                                  +---------------------------------------+
                                                      ^
                                                      | POS Sync Events & Pairing
                             +------------------------+------------------------+
                             |                                                 |
             +---------------+---------------+                 +---------------+---------------+
             |  Electron Desktop Client      |                 |  Flutter Mobile POS Client    |
             |  - Offline-first SQLite       |                 |  - Direct Cloud Edge REST API |
             |  - Local Express (:3001-3003) |                 |  - Android APK & iOS Client   |
             |  - ESC/POS Thermal Printing   |                 |  - Waiter / KDS / Cashier     |
             +-------------------------------+                 +-------------------------------+
```

### Component Distribution

| Component | Target Platform | Hosting / Distribution | Status |
| :--- | :--- | :--- | :--- |
| **Cloud API Edge Worker** | Cloudflare Workers | Cloudflare Global Anycast Edge (`APAC / SIN`) | **LIVE / Operational** |
| **Cloud D1 Database** | Cloudflare D1 | Serverless SQLite Distributed Database | **LIVE / Migrated (0001-0007)** |
| **Cloud Web Dashboard** | Cloudflare Pages | Cloudflare Edge CDN (`orderitup.pages.dev`) | **LIVE / Operational** |
| **Electron Desktop POS** | Windows, macOS, Linux | Local Executable / GitHub Releases | Client (Offline-first) |
| **Flutter Mobile POS** | Android, iOS | Mobile Client Artifacts / GitHub Releases | Client (Edge-connected) |
| **Razorpay Payment Gateway**| External Payment Provider | Merchant Account Integration | Pending Live Key Config |

---

## 2. Cloudflare Production Resources

| Resource Type | Resource Name | Identifier / UUID | Configuration / Binding | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Worker (Production)** | `orderitup-cloud-api` | Version `389030d5-e018-43f8-9579-192fec597898` | Node.js Compat, `ENVIRONMENT=production` | **Active / Verified** |
| **Worker (Staging)** | `orderitup-cloud-api-staging` | Version `8a05b52d-53c8-4b3d-bc9c-7dce4c0ef6bd` | Isolated staging environment & DB | **Active / Isolated** |
| **D1 DB (Production)** | `orderitup-d1-prod` | `145d0618-ed44-42ce-8209-658ad2bcc2fd` | APAC Region, 19 tables | **Active / Clean** |
| **D1 DB (Staging)** | `orderitup-d1-staging` | `931431cc-45d5-47c9-bed9-37f903cdacd4` | APAC Region, Isolated staging DB | **Active / Isolated** |
| **Pages Project** | `orderitup` | Deployment `11535e24-4f01-4993-9c59-bf55b9a4736f` | Branch `main`, 34 static routes | **Active / Verified** |

### Worker Secrets Configured
- `JWT_SECRET`: Encrypted 256-bit cryptographically secure secret provisioned via Cloudflare Worker encrypted storage (`wrangler secret put JWT_SECRET`). Staging and production have independent, non-overlapping secrets.
- *Zero plaintext secrets are committed to Git, stored in `.toml`, or exposed in bundles.*

---

## 3. Domain & DNS Verification Status

During the production launch audit, Cloudflare DNS zones were queried directly via the Cloudflare Client v4 API:
- **Cloudflare Account Zones:** 0 active zones found.
- **`orderitup.in` Status:** The custom domain is currently registered outside Cloudflare or has nameserver delegation pending.
- **Active Cloudflare URLs Configured:**
  - Production Web Dashboard: `https://orderitup.pages.dev`
  - Production API: `https://orderitup-cloud-api.narayaaana11.workers.dev`
- **CORS Allowed Origins:** `FRONTEND_ORIGIN = "https://app.orderitup.in, https://orderitup.in, https://orderitup.pages.dev"`.
  When DNS delegation to Cloudflare nameservers is completed, custom domains (`app.orderitup.in` and `api.orderitup.in`) will activate immediately without requiring code modifications.

---

## 4. Production D1 Database & Migration Verification

The production database `orderitup-d1-prod` (`145d0618-ed44-42ce-8209-658ad2bcc2fd`) was initialized and migrated sequentially through all repository migrations:
1. `0001_initial_schema.sql` (Organizations, terminals, categories, sync events)
2. `0002_rate_limits_and_pairing.sql` (D1 persistent rate limiting & terminal pairing tokens)
3. `0003_sync_integrity_and_idempotency.sql` (Synced orders, items, cash closures, unique indexes)
4. `0004_restaurant_hierarchy_and_memberships.sql` (Multi-restaurant concepts, branches, memberships)
5. `0005_shared_operations_tables_and_kitchen.sql` (Dining tables, kitchen display tickets)
6. `0006_customer_payment_ledger.sql` (Customer payment ledger, external references, settlement integrity)
7. `0007_repair_legacy_payments_and_financial_integrity.sql` (Foreign key indexes, payment reconciliation constraints)

### Verified Production Tables (19 Tables)
`branch_product_overrides`, `branches`, `cloud_users`, `customer_payments`, `dining_tables`, `inventory_transfers`, `kitchen_tickets`, `master_categories`, `master_products`, `memberships`, `organizations`, `pairing_tokens`, `rate_limits`, `restaurants`, `sync_events`, `synced_cash_closures`, `synced_order_items`, `synced_orders`, `terminals`.

*Zero test/smoke records from staging were imported into the real production database.*

---

## 5. Verification Test Matrix & Release Gates

All pre-release gates and live verification suites were executed against the live environments:

| Suite Name | Scope | Result | Details |
| :--- | :--- | :--- | :--- |
| **Financial Integrity Suite** | Ledger correctness, overpayment guard, UTR uniqueness | **17 / 17 Passed** | Full math reconciliation |
| **Shared Operational Backend** | Multi-persona workflow (Waiter -> Kitchen -> Cashier) | **6 / 6 Passed** | Table auto-release verified |
| **Transaction Integrity** | Payment replay, split payment, auditable refund limits | **7 / 7 Passed** | Idempotency confirmed |
| **Cloud Auth Hardening** | Scrypt hashing, JWT schema, login rate limiting | **5 / 5 Passed** | Anti-enumeration verified |
| **Pairing & Rate Limiting** | Dual-axis throttling, PIN single-use, 2MB payload cap | **11 / 11 Passed** | Brute-force defense active |
| **Staging Smoke Suite** | Live Cloudflare staging Worker verification | **70 / 70 Passed** | 0 failures |
| **Production RBAC Verification** | Live production Worker with all 6 operational roles | **10 / 10 Passed** | Cross-tenant isolation verified |

---

## 6. Role & Permission Matrix (Live Production Enforced)

| User Role | Hierarchy Scope | Order Creation | Table Ops | Kitchen Display | Billing & Tender | Financial Reports | Staff Management |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Owner** | Organization-wide | Allowed | Allowed | Allowed | Allowed | Allowed | **Full Authority** |
| **Manager** | Restaurant / Branch | Allowed | Allowed | Allowed | Allowed | Branch-scoped | Branch Staff |
| **Accountant** | Organization-wide | Denied | Denied | Denied | Denied | **Full Authority** | Denied |
| **Cashier** | Assigned Branch | Allowed | Allowed | Read-only | **Full Authority** | Denied (403) | Denied |
| **Server** | Assigned Branch | **Allowed** | **Allowed** | Read-only | Denied | Denied (403) | Denied |
| **Chef** | Assigned Branch | Denied | Denied | **Full Authority** | Denied | Denied (403) | Denied |

---

## 7. Operational Monitoring & Disaster Recovery

### Cloudflare Worker Live Logs & Metrics
- Monitor production logs in real time:
  ```sh
  npx wrangler tail orderitup-cloud-api
  ```
- Worker Analytics and Error Rates: Accessible via Cloudflare Dashboard under Workers & Pages > `orderitup-cloud-api` > Metrics.

### Database Backups & Export
- Perform an on-demand SQL dump of production D1:
  ```sh
  npx wrangler d1 export orderitup-d1-prod --remote --output=./backups/prod-backup-$(date +%F).sql
  ```
- Cloudflare D1 automatically retains point-in-time state and geographical replication across APAC regions.

### Instant Rollback Procedure
If a critical regression is detected:
1. **Worker Rollback:**
   ```sh
   npx wrangler rollback orderitup-cloud-api
   ```
   Or select previous version ID `1d99033c-e17b-40b3-be58-7f892a9204d3` in the Cloudflare dashboard.
2. **Pages Rollback:** In the Cloudflare Pages dashboard under `orderitup`, rollback to deployment `91ca0188-aacb-464f-b2cb-bd8c225bff0e`.

---

## 8. Complete Links Directory

| Service / Resource | URL | Environment / Type | Live Verification Status |
| :--- | :--- | :--- | :--- |
| **Public Web Dashboard** | [https://orderitup.pages.dev](https://orderitup.pages.dev) | Production | **HTTP 200 OK** |
| **Owner Login Page** | [https://orderitup.pages.dev/auth/login/](https://orderitup.pages.dev/auth/login/) | Production | **HTTP 200 OK** |
| **Owner Registration** | [https://orderitup.pages.dev/auth/register/](https://orderitup.pages.dev/auth/register/) | Production | **HTTP 200 OK** |
| **Cloud HQ Portal** | [https://orderitup.pages.dev/cloud-portal/](https://orderitup.pages.dev/cloud-portal/) | Production | **HTTP 200 OK** |
| **Production Cloud API** | [https://orderitup-cloud-api.narayaaana11.workers.dev](https://orderitup-cloud-api.narayaaana11.workers.dev) | Production | **HTTP 200 OK** |
| **API Health Endpoint** | [https://orderitup-cloud-api.narayaaana11.workers.dev/health](https://orderitup-cloud-api.narayaaana11.workers.dev/health) | Production | **HTTP 200 (operational)** |
| **Staging Web Frontend** | [https://staging.orderitup.in](https://staging.orderitup.in) | Staging | Target Domain |
| **Staging Cloud API** | [https://orderitup-cloud-api-staging.narayaaana11.workers.dev](https://orderitup-cloud-api-staging.narayaaana11.workers.dev) | Staging | **HTTP 200 (operational)** |
| **Cloudflare Worker Dashboard** | [https://dash.cloudflare.com/b970a9d64087c51de42c12abb3f45e0a/workers/services/view/orderitup-cloud-api](https://dash.cloudflare.com/b970a9d64087c51de42c12abb3f45e0a/workers/services/view/orderitup-cloud-api) | Cloudflare Dashboard | Authenticated Admin |
| **Cloudflare D1 Dashboard** | [https://dash.cloudflare.com/b970a9d64087c51de42c12abb3f45e0a/d1/databases/145d0618-ed44-42ce-8209-658ad2bcc2fd](https://dash.cloudflare.com/b970a9d64087c51de42c12abb3f45e0a/d1/databases/145d0618-ed44-42ce-8209-658ad2bcc2fd) | Cloudflare Dashboard | Authenticated Admin |
| **Cloudflare Pages Dashboard** | [https://dash.cloudflare.com/b970a9d64087c51de42c12abb3f45e0a/pages/view/orderitup](https://dash.cloudflare.com/b970a9d64087c51de42c12abb3f45e0a/pages/view/orderitup) | Cloudflare Dashboard | Authenticated Admin |
| **GitHub Repository** | [https://github.com/Narayaaana11/order-it-up](https://github.com/Narayaaana11/order-it-up) | Developer / Repo | Active Source |
| **GitHub Main Branch** | [https://github.com/Narayaaana11/order-it-up/tree/main](https://github.com/Narayaaana11/order-it-up/tree/main) | Developer / Repo | SHA: `bdc5abd` / `3c435d0` |
| **GitHub Merged PR #11** | [https://github.com/Narayaaana11/order-it-up/pull/11](https://github.com/Narayaaana11/order-it-up/pull/11) | Developer / Repo | **Merged to Main** |
| **Target Custom API** | `https://api.orderitup.in` | Custom Domain | *Pending DNS Zone delegation* |
| **Target Custom App** | `https://app.orderitup.in` | Custom Domain | *Pending DNS Zone delegation* |
| **Target Main Website** | `https://orderitup.in` | Custom Domain | *Pending DNS Zone delegation* |
| **Mobile Android APK** | GitHub Actions Workflow Artifacts (`.github/workflows/mobile-release.yml`) | Mobile Client | Build Pipeline Configured |

---

## 9. Known Limitations & Next Actions

1. **Custom Domains (`orderitup.in`):** The domain nameservers must be pointed to Cloudflare to enable automatic SSL provisioning for `app.orderitup.in` and `api.orderitup.in`. The platform currently operates seamlessly on `https://orderitup.pages.dev` and `https://orderitup-cloud-api.narayaaana11.workers.dev`.
2. **Razorpay Production Activation:** Live merchant API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) and a dedicated `RAZORPAY_WEBHOOK_SECRET` must be configured once the merchant payment account is activated. In-store cash, manual card, and UPI QR settlements remain fully operational.
3. **Private Credentials Bundle:** All temporary login credentials have been saved exclusively in the encrypted file `deployment-private/orderitup-production-credentials.enc` and delivered privately.
