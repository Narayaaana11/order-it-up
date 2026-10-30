# Order It Up: Staging Deployment & Controlled Validation Checklist

> **Target Environment:** Controlled Staging Sandbox  
> **Release Branch:** `release/order-it-up-c12-staging`  
> **Pull Request:** [GitHub PR #11](https://github.com/Narayaaana11/order-it-up/pull/11)  
> **Staging Worker URL:** `https://orderitup-cloud-api-staging.narayaaana11.workers.dev`  
> **Staging D1 Identifier:** `931431cc-45d5-47c9-bed9-37f903cdacd4` (Migrations 0001–0006 Applied)  
> **Status:** Staging Deployed & Verified Live (39/39 C-12 Smoke Tests Passed; 16/16 Baseline Tests Passed)  
> **Rule:** Never commit credentials, API keys, or production data.  
> **CRITICAL INVARIANT:** Staging credentials (e.g. `rzp_test_*`, staging D1 IDs, staging JWT secrets) and staging data MUST NEVER be mixed with or reused in production environments. Production and staging environments must maintain strictly separate infrastructure, secrets, and database stores.

---

## 1. Confirmed Resource Names & Configuration Locations

### Cloudflare Worker & D1 Database Resources (`apps/cloud-api/wrangler.toml`)

| Resource | Environment | Identifier / Resource Name | Configuration Location | Status |
| :--- | :--- | :--- | :--- | :--- |
| Cloudflare Worker | Production | `orderitup-cloud-api` | `apps/cloud-api/wrangler.toml` [root] | Defined (Unmodified) |
| D1 Database | Production | `orderitup-d1-prod` | `apps/cloud-api/wrangler.toml` [root] | Placeholder ID (`orderitup-d1-prod-db-id`) |
| Cloudflare Worker | Staging | `orderitup-cloud-api-staging` | `apps/cloud-api/wrangler.toml` `[env.staging]` | **Deployed & Verified:** `https://orderitup-cloud-api-staging.narayaaana11.workers.dev` |
| D1 Database | Staging | `orderitup-d1-staging` | `apps/cloud-api/wrangler.toml` `[env.staging]` | **Provisioned & Migrated:** `931431cc-45d5-47c9-bed9-37f903cdacd4` (APAC / SIN) |

---

## 2. Required Environment Variables & Secrets Matrix

All secrets must be injected into the staging environment using secure vault mechanisms or `wrangler secret put`. **Do NOT commit `.env` files or secret values into git.**

| Variable Name | Component | Staging Target | Purpose / Value Format | Provisioning Command |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Worker & POS Backend | Staging | Environment mode (`staging`) | `wrangler.toml` `[env.staging.vars]` |
| `ENVIRONMENT` | Cloud API Worker | Staging | Internal environment flag (`staging`) | `wrangler.toml` `[env.staging.vars]` |
| `JWT_SECRET` | Cloud API Worker | Staging | High-entropy signing secret (32+ chars) | `wrangler secret put JWT_SECRET --env staging` |
| `RAZORPAY_KEY_ID` | Desktop Backend / UI | Staging | Test mode key (`rzp_test_...`) | Local uncommitted `.env.staging` |
| `RAZORPAY_KEY_SECRET` | Desktop Backend | Staging | Test mode secret (`...`) | Local uncommitted `.env.staging` |
| `RAZORPAY_WEBHOOK_SECRET`| Desktop Backend | Staging | Webhook HMAC secret (32+ chars) | Local uncommitted `.env.staging` |
| `OIU_LICENSE_PUBLIC_KEY` | Desktop & Cloud API | Staging | Official Ed25519 SPKI Public Key | Embedded default / environment override |
| `OIU_ALLOW_LEGACY_HMAC` | Desktop Backend | Staging | Deprecated legacy HMAC backward compatibility | Set `false` (or omit) |

---

## 3. Pre-Deployment Verification Steps (Local Verification Gate)

Before applying migrations or deploying to the staging environment, run the following automated verification suites locally:

```bash
# 1. Terminal Pairing Security & Adversarial Suite
npm run test:pairing-security

# 2. Payment Gateway Hardening & Asymmetric Ed25519 Suite
npm run test:payment-security

# 3. Enterprise Multi-Branch Cloud E2E & Mobile Model Audit
npm run test:cloud-e2e

# 4. Backend TypeScript Compilation
npm run build

# 5. Backend ESLint Verification
npm run lint:backend

# 6. Frontend ESLint & Static Type Check
npm --prefix frontend run lint
npx tsc --noEmit -p frontend/tsconfig.json

# 7. Frontend Next.js Production Static Export
npm run build:frontend

# 8. Cloudflare Worker TypeScript Type Check
npx tsc -p apps/cloud-api/tsconfig.json --noEmit

# 9. SQLite Database Schema & PRAGMA user_version 83 Integrity Audit
npm run audit:db

# 10. Security URL Allowlist
npm run test:url-allowlist
```

---

## 4. Staging Migration & Deployment Sequence (Instructions Only)

> [!CAUTION]
> The following commands are documented for operational execution by authorized deployment personnel. **Do NOT execute remote deployments or migrations during automated verification passes.**

### Step 1: Create Staging Cloudflare D1 Database
```bash
cd apps/cloud-api
npx wrangler d1 create orderitup-d1-staging
```
*(Copy the generated `database_id` UUID and update `database_id = "<STAGING_D1_UUID>"` under `[env.staging]` in `apps/cloud-api/wrangler.toml`)*

### Step 2: Provision Staging Worker Secrets
```bash
npx wrangler secret put JWT_SECRET --env staging
```
*(Enter high-entropy 256-bit secret when prompted)*

### Step 3: Apply Database Migrations Sequentially to Staging
```bash
# Executes migrations:
#   0001_initial_schema.sql
#   0002_rate_limits_and_pairing.sql
#   0003_sync_integrity_and_idempotency.sql
#   0004_restaurant_hierarchy_and_memberships.sql
#   0005_shared_operations_tables_and_kitchen.sql
#   0006_customer_payment_ledger.sql
npx wrangler d1 migrations apply orderitup-d1-staging --remote --env staging
```

### Step 4: Deploy Worker to Staging Environment
```bash
npx wrangler deploy --env staging
```
*(Confirms deployment URL: e.g. `https://orderitup-cloud-api-staging.<subdomain>.workers.dev`)*

---

## 5. Razorpay Sandbox Checkout & Webhook Test Scenarios

### Payment Lifecycle Scenarios
- [ ] **Authoritative Pricing Test:**
  - Request order creation for Pro Monthly (`POST /api/subscription/create-order` with `{ plan: 'pro', billingCycle: 'monthly' }`).
  - Verify returned amount is exactly ₹1,299 ( paise = `129900` ), irrespective of any client tampering.
- [ ] **Standard Sandbox Checkout:**
  - Open POS Settings > Subscription.
  - Initiate checkout for Professional Plan (Yearly) (₹12,999/yr).
  - Complete payment in Razorpay Checkout modal using test card `4111 1111 1111 1111` (or test UPI ID `success@razorpay`).
  - Verify `/api/subscription/verify-payment` receives valid HMAC signature and activates entitlement (`status: 'active'`).
- [ ] **Replay Defense Check:**
  - Resubmit identical `paymentId` and `orderId` to `/api/subscription/verify-payment`.
  - Expected: HTTP `409 Conflict` ("Payment transaction has already been processed and activated").
- [ ] **Cross-Order Signature Tampering:**
  - Submit signature generated for Order A against Order B.
  - Expected: HTTP `400 Bad Request` ("Payment signature verification failed").
- [ ] **Webhook Idempotency & Duplicate Delivery:**
  - Deliver webhook `payment.captured` with event ID `evt_test_01`.
  - Expected: First delivery returns HTTP `200 OK` (`status: 'processed'`).
  - Redeliver identical payload with event ID `evt_test_01`.
  - Expected: Second delivery returns HTTP `200 OK` (`status: 'already_processed'`), preserving original expiration date without double extension.
- [ ] **Refund & Dispute Revocation:**
  - Deliver `refund.processed` or `payment.dispute.created` webhook for an active subscription.
  - Expected: Immediate revocation, setting subscription status to `suspended` and blocking operational POS features.
- [ ] **Out-of-Order Webhook Delivery:**
  - Deliver `refund.processed` before `payment.captured`.
  - Expected: Entitlement remains revoked; subsequent captured event does not reactivate suspended disputed payment.

---

## 6. Pairing, Tenant Isolation & Licensing Regression Tests

- [ ] **Terminal PIN Enrollment:**
  1. Generate 6-digit PIN via Owner Cloud HQ (`POST /api/cloud/pair/generate` with `{ branch_id: 'br-02', terminal_name: 'Patio Tablet' }`).
  2. Verify PIN TTL is 15 minutes and format is 6 digits.
  3. Claim from mobile device (`POST /api/cloud/pair/claim` with `{ code: '<PIN>' }`).
  4. Verify terminal receives scoped JWT bound to branch `br-02`.
- [ ] **Single-Use Burning Check:**
  - Resubmit the claimed PIN from another client.
  - Expected: HTTP `404 Not Found` (code burned).
- [ ] **Simultaneous Claim Race Condition:**
  - Dispatch concurrent claims for the same PIN from two clients.
  - Expected: Exactly one succeeds (HTTP 200); competing request receives HTTP 404/410.
- [ ] **Cross-Branch Claim Rejection:**
  - Submit claim specifying `branch_id: 'br-01'` for a PIN generated for `br-02`.
  - Expected: HTTP `403 Forbidden` ("Pairing code does not belong to the requested branch").
- [ ] **Brute-Force Rate Limiting & Header Evasion:**
  - Submit 11 incorrect 6-digit guesses from the same IP with forged `X-Forwarded-For` headers.
  - Expected: 10th request returns 404; 11th request returns HTTP `429 Too Many Requests` with `Retry-After: 300`.
- [ ] **Asymmetric Ed25519 Commercial License Activation:**
  - Activate valid license: `OIU2.PRO.<EXPIRY_HEX>.STORE-CP-01.<VALID_SIG>`.
  - Verify `/api/subscription/activate` returns HTTP 200 with Pro entitlement.
  - Tamper with plan (e.g. modify PRO to ENTERPRISE).
  - Expected: HTTP `400 Bad Request` ("Cryptographic license verification failed").
- [ ] **Public-Key Rotation & Legacy Migration:**
  - Set `OIU_LICENSE_PUBLIC_KEY` in environment to new public key.
  - Verify licenses signed with previous private key are rejected; licenses signed with new private key verify.
  - Submit legacy `OIU-...` HMAC license.
  - Expected: HTTP 400 rejection by default; when `OIU_ALLOW_LEGACY_HMAC=true` is set, legacy verification passes.

---

## 7. Rollback & Recovery Procedures

### Database Rollback Strategy
1. **Pre-Migration Snapshot Export:**
   Prior to applying any new migration to staging, export a full SQL snapshot:
   ```bash
   npx wrangler d1 export orderitup-d1-staging --output ./backups/staging-backup-$(date +%s).sql --env staging
   ```
2. **Migration Failure Recovery:**
   If a migration fails halfway:
   - Inspect the failed migration state:
     ```bash
     npx wrangler d1 execute orderitup-d1-staging --command "SELECT * FROM d1_migrations" --env staging
     ```
   - If corrupted, drop and recreate the staging database:
     ```bash
     npx wrangler d1 delete orderitup-d1-staging
     npx wrangler d1 create orderitup-d1-staging
     npx wrangler d1 migrations apply orderitup-d1-staging --env staging
     ```

### Worker Deployment Rollback Strategy
1. **Rollback to Previous Worker Deployment:**
   ```bash
   npx wrangler rollback --env staging
   ```
2. **Verify Restored Worker Version:**
   ```bash
   npx wrangler deployments list --env staging
   ```

---

## 8. Post-Deployment Smoke Tests (Verified Live on Staging)

Automated smoke tests executed directly against `https://orderitup-cloud-api-staging.narayaaana11.workers.dev` via `node tests/deployed-staging-smoke.mjs`:

| # | Endpoint / Test Scenario | Method / Route | Verification Condition | Result |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Service Health & D1 Engine | `GET /health` | HTTP 200, `{ status: "operational", engine: "Cloudflare Workers + D1" }` | ✅ **PASS** |
| 2 | CORS Allowed Origin | `OPTIONS /api/branches` | `Origin: https://staging.orderitup.in` -> `Access-Control-Allow-Origin: https://staging.orderitup.in` | ✅ **PASS** |
| 3 | CORS Disallowed Origin Fallback | `OPTIONS /api/branches` | `Origin: https://malicious-site.example.com` -> Restricted fallback (no origin reflection) | ✅ **PASS** |
| 4 | Missing Token Rejection | `GET /api/branches` | No Authorization header -> HTTP 401 `Unauthorized: valid cloud user token required` | ✅ **PASS** |
| 5 | Invalid Token Rejection | `GET /api/branches` | `Bearer invalid.jwt.token` -> HTTP 401 | ✅ **PASS** |
| 6 | Demo Organization Seed Setup | `POST /api/auth/setup-demo` | Seeds demo org, branches, users & catalog (idempotent second call) | ✅ **PASS** |
| 7 | User Authentication & JWT | `POST /api/auth/login` | Valid credentials -> HTTP 200 with JWT (scrypt verified, `owner` role) | ✅ **PASS** |
| 8 | Multi-Branch Scoping | `GET /api/branches` | Bearer JWT -> HTTP 200 with 2 active tenant branches | ✅ **PASS** |
| 9 | Cross-Branch Analytics Overview | `GET /api/analytics/overview` | Bearer JWT -> HTTP 200 with aggregate branch sales & velocity metrics | ✅ **PASS** |
| 10 | Cryptographic PIN Generation | `POST /api/pairing/generate` | Scoped to branch -> HTTP 200 with 6-digit random code (15-min expiry) | ✅ **PASS** |
| 11 | Zero-Config Terminal Claim | `POST /api/pos/pair` | Valid code -> HTTP 200 with `terminal_id` & device token | ✅ **PASS** |
| 12 | Single-Use PIN Consumption | `POST /api/pos/pair` | Replayed code -> HTTP 409 `Pairing code has already been redeemed` | ✅ **PASS** |
| 13 | POS Sync Event Ingestion | `POST /api/pos/events` | Terminal auth -> HTTP 200 with `synced_ids` | ✅ **PASS** |
| 14 | POS Sync Idempotent Replay | `POST /api/pos/events` | Resending identical payload acknowledged idempotently without duplicate rows | ✅ **PASS** |
| 15 | POS Sync Conflict Prevention | `POST /api/pos/events` | Conflicting payload with reused event ID omitted from `synced_ids` | ✅ **PASS** |
| 16 | Distributed Rate Limiting | `POST /api/auth/login` | 5 failed login attempts trigger HTTP 429 with `Retry-After` header | ✅ **PASS** |

**Baseline Smoke Tests Summary:** 16 / 16 Deployed Staging Smoke Tests Passed.

### C-12 Multi-Location Operations & Transaction Integrity Live Smoke Tests
Automated operational smoke tests executed directly against `https://orderitup-cloud-api-staging.narayaaana11.workers.dev` via `node tests/live-staging-smoke-c12.mjs`:

| # | Operational Workflow Test | Method / Route | Verification Condition | Result |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Service Health & D1 Engine | `GET /health` | HTTP 200, `{ status: "operational", engine: "Cloudflare Workers + D1" }` | ✅ **PASS** |
| 2 | CORS Policy Verification | `OPTIONS /api/branches` | `Origin: https://staging.orderitup.in` allowed; unlisted origins rejected | ✅ **PASS** |
| 3 | Authentication Enforcement | `GET /api/branches` | Missing and malformed tokens return HTTP 401 | ✅ **PASS** |
| 4 | Self-Service SaaS Registration | `POST /api/auth/register` | Provisions tenant organization, restaurant, default branch, starter menu & owner JWT | ✅ **PASS** |
| 5 | Restaurant & Branch Hierarchy | `POST /api/branches` | Owner provisions second branch bound to same restaurant | ✅ **PASS** |
| 6 | Tenant Isolation & Cross-Tenant Defense | `GET /api/orders?branch_id=...` | Cross-tenant access between Tenant B and Tenant A rejected with HTTP 403 | ✅ **PASS** |
| 7 | Server Catalog Price Authority | `POST /api/orders` | Cloud order creation rejects unlisted products with HTTP 400 | ✅ **PASS** |
| 8 | Server-Authoritative Totals | `POST /api/orders` | Overrides client-submitted item prices with authoritative catalog base prices | ✅ **PASS** |
| 9 | Dine-In Table & Kitchen Ticket Queue | `POST /api/tables`, `GET /api/kitchen/tickets` | Table created; automatic kitchen ticket bumped to `preparing` via PATCH | ✅ **PASS** |
| 10 | Split Payments & Verification Ledger | `POST /api/orders/:id/payments` | Split cash (`cashier_collected`) + UPI (`manual_cashier_confirmed`) -> status `paid` | ✅ **PASS** |
| 11 | Refund Limits & Idempotency | `POST /api/orders/:id/payments/:pid/refund` | Over-refund rejected (400); partial refund recorded as `manual_manager_refund`; idempotent replay returns 200 | ✅ **PASS** |
| 12 | Optimistic Concurrency Control | `POST /api/orders/:id/items` | Outdated `expected_version` rejected with HTTP 409 Conflict | ✅ **PASS** |
| 13 | Cross-Device Order Visibility | `GET /api/orders` | Polling endpoint reflects real-time payment status and ledger changes | ✅ **PASS** |

**C-12 Live Smoke Tests Summary:** 39 / 39 Deployed Staging Verifications Passed (0 Failures).

---

## 9. Eventual Production Release Checklist

Before promoting any build from staging to production, the following production-specific gates must be satisfied:

- [ ] **Live Razorpay Credentials Provisioning:**
  - `RAZORPAY_KEY_ID`: Dedicated production live key (`rzp_live_...`).
  - `RAZORPAY_KEY_SECRET`: Production secret stored in encrypted secrets manager.
  - `RAZORPAY_WEBHOOK_SECRET`: Production webhook secret configured on Razorpay Live Dashboard.
  - **Invariant:** Test keys (`rzp_test_*`) are rejected in production mode by `payment-provider.ts`.
- [ ] **Production Cloudflare D1 Database:**
  - Create production database `orderitup-d1-prod`.
  - Update root `database_id` in `apps/cloud-api/wrangler.toml`.
  - Apply migrations `0001` through `0006` to production D1 database.
  - Verify production snapshot export routine is active.
- [ ] **Production JWT Secret:**
  - Provision high-entropy production secret: `wrangler secret put JWT_SECRET`.
- [ ] **Custom Domain & TLS Ingress:**
  - Route worker to custom production domain (e.g. `api.orderitup.in`).
  - Verify HSTS, CSP, and TLS 1.3 enforcement.
- [ ] **Asymmetric Commercial Licensing Authority:**
  - Embed official `DEFAULT_OIU_LICENSE_PUBLIC_KEY` in desktop builds.
  - Ensure private signing key is stored strictly on isolated licensing authority hardware security module / key vault.
  - Ensure `OIU_ALLOW_LEGACY_HMAC` is `false` or unconfigured.
- [ ] **Automated CI/CD Sign-Off:**
  - All GitHub Actions jobs (Backend, Frontend, i18n, DB Audit, Security Suites, Mobile Companion) pass on `main`.
- [ ] **Final Security & Accounting Audit Sign-Off:**
  - Financial reports, Tally XML vouchers, GST tax summaries, and cash drawer reconciliations audited against staging trial run.
