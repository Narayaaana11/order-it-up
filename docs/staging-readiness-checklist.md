# Order It Up: Staging Deployment & Controlled Validation Checklist

> **Target Environment:** Controlled Staging Sandbox  
> **Status:** Pre-Staging Verification Complete (No production deployment permitted)  
> **Rule:** Never commit credentials, API keys, or production data.

---

## 1. Staging Credentials & Payment Gateway Configuration

### Razorpay Test-Mode Gateway
- [ ] **Test Key Pair Generation:** Generate a dedicated **Test Mode** API Key from the Razorpay Dashboard (`Settings > API Keys`).
  - Expected Prefix: `rzp_test_...`
  - **Do NOT use Live Mode (`rzp_live_...`) keys.**
- [ ] **Staging Webhook Endpoint Configuration:**
  - In Razorpay Dashboard (`Settings > Webhooks`), create a staging webhook URL pointing to your staging ingress (e.g. `https://staging-api.yourdomain.com/api/subscription/webhooks/razorpay` or ngrok tunnel).
  - Secret: Generate a high-entropy staging secret string (e.g., 32+ characters) for `RAZORPAY_WEBHOOK_SECRET`.
  - Active Webhook Events to Subscribe:
    - `payment.captured`
    - `order.paid`
    - `payment.failed`
    - `payment.dispute.created`
    - `refund.processed`
    - `subscription.cancelled`

---

## 2. Cloudflare Staging Infrastructure & D1 Database

### Dedicated Staging Resources
- [ ] **Staging D1 Database Creation:**
  ```bash
  wrangler d1 create order-it-up-staging-db
  ```
  *(Note the returned `database_id` and assign it exclusively to `wrangler.toml` under `[env.staging]`)*
- [ ] **Isolate Staging Environment from Production in `wrangler.toml`:**
  ```toml
  [env.staging]
  name = "order-it-up-cloud-api-staging"
  d1_databases = [
    { binding = "DB", database_name = "order-it-up-staging-db", database_id = "<STAGING_D1_UUID>" }
  ]
  ```
- [ ] **Provision Staging Secrets via Wrangler CLI (Never commit plain text):**
  ```bash
  wrangler secret put JWT_SECRET --env staging
  wrangler secret put OIU_LICENSE_PUBLIC_KEY --env staging
  wrangler secret put RAZORPAY_WEBHOOK_SECRET --env staging
  ```

---

## 3. Database Migration Order & Rollback Strategy

### Sequential Migration Order
1. `0001_initial_schema.sql` (Creates core multi-branch tables: organizations, branches, terminals, catalog, orders, closures)
2. `0002_rate_limits_and_pairing.sql` (Creates distributed rate limits, adds attempts & claimed columns to pairing tokens)
3. `0003_sync_integrity_and_idempotency.sql` (Creates sync_events table, adds terminal status, creates tenant isolation indexes)

### Execution Command:
```bash
wrangler d1 migrations apply order-it-up-staging-db --env staging
```

### Pre-Migration Backup & Rollback Plan:
- [ ] Export staging snapshot prior to running incremental migrations:
  ```bash
  wrangler d1 export order-it-up-staging-db --output ./staging-backup-$(date +%s).sql --env staging
  ```
- [ ] In case of migration interruption or failure:
  1. Inspect the last applied migration version in `d1_migrations`.
  2. Restore from snapshot or drop the failed staging database and re-apply from migration 0001 clean baseline.
  3. Never alter historical migrations in-place.

---

## 4. End-to-End Staging Test Scenarios

### Payment & Subscription Scenarios
- [ ] **Standard Checkout Flow:**
  1. Login as store Owner/Manager in POS Settings.
  2. Select "Professional Plan (Yearly)" (₹12,999/yr).
  3. Trigger order creation (`POST /api/subscription/create-order`). Verify order amount equals ₹12,999.
  4. Complete sandbox payment using Razorpay test card / test UPI ID (`success@razorpay`).
  5. Verify `/api/subscription/verify-payment` completes, recording transaction in `payment_transaction_refs`.
  6. Confirm POS terminal status transitions to `active` with 365 days period.
- [ ] **Replay Defense Test:**
  - Submit the identical `payment_id` to `/api/subscription/verify-payment`.
  - Expected: HTTP `409 Conflict` ("Payment transaction has already been processed").
- [ ] **Duplicate Webhook Delivery Test:**
  - Deliver identical `payment.captured` webhook payload twice.
  - Expected: First delivery returns `200 OK` (`status: 'processed'`); second delivery returns `200 OK` (`status: 'already_processed'`) without extending subscription expiration a second time.
- [ ] **Refund / Dispute Revocation:**
  - Deliver `refund.processed` webhook event for an active subscription payment.
  - Expected: Terminal status transitions to `suspended` and operational access is revoked.
- [ ] **Expiration & Grace Period Simulation:**
  - Set `subscription_period_end` to 1 hour in the past in the database.
  - Verify terminal enters `grace_period` (7 days countdown displayed in UI).
  - Set `subscription_grace_period_end` to 1 hour in the past.
  - Verify terminal enters `suspended` and blocks new order generation until renewed.

---

## 5. Pairing Abuse & Tenant Boundary Scenarios

- [ ] **Valid PIN Enrollment:**
  1. Generate 6-digit pairing PIN via Owner Cloud HQ (`POST /api/cloud/pair/generate`).
  2. Claim from mobile companion tablet (`POST /api/cloud/pair/claim`).
  3. Verify tablet receives scoped JWT bound to target branch and organization.
- [ ] **Single-Use Burning Check:**
  - Re-submit claimed PIN from a second tablet.
  - Expected: HTTP `404 Not Found` (code burned).
- [ ] **Brute-Force Rate Limiting Test:**
  - Submit 11 incorrect 6-digit guesses from the same IP.
  - Expected: 10th request returns `404`; 11th request returns `429 Too Many Requests` with `Retry-After: 300`.
- [ ] **Cross-Tenant Isolation Test:**
  - Attempt to claim a PIN or ingest sync orders into Org A using credentials issued for Org B.
  - Expected: HTTP `403 Forbidden` / `404 Not Found`.

---

## 6. Staging Sign-Off Matrix

| Checkpoint | Owner | Status | Date Verified |
| :--- | :--- | :--- | :--- |
| Razorpay Test Keys Configured | QA / DevOps | [ ] Pending | — |
| Staging Cloudflare D1 Initialized | DevOps | [ ] Pending | — |
| Migrations Applied (0001 -> 0003) | Database Admin | [ ] Pending | — |
| Asymmetric Ed25519 Public Key Set | Security Lead | [ ] Verified locally | 2026-10-30 |
| Automated E2E & Security Suites Passing | CI / Automated | [x] PASSED (100%) | 2026-10-30 |
