# Cloud Platform Administration and SaaS Subscriptions

## What is implemented

The Cloudflare Worker exposes a separate platform-administrator namespace:

- `POST /api/platform-admin/login`
- `GET /api/platform-admin/me`
- `GET /api/platform-admin/overview`
- `GET /api/platform-admin/tenants`
- `GET /api/platform-admin/tenants/:organizationId`
- `GET /api/platform-admin/plans`
- `GET /api/platform-admin/pilot-requests` (authenticated search, status filtering and pagination)
- `GET /api/platform-admin/pilot-requests/:requestId` (authenticated request details)
- `PATCH /api/platform-admin/pilot-requests/:requestId` (status and internal notes; audited reason required)
- `POST /api/pilot-requests` (public, validated and rate-limited pilot access application)
- `PATCH /api/platform-admin/tenants/:organizationId/account-status` (reason required; writes an audit record)
- `PATCH /api/platform-admin/tenants/:organizationId/subscription` (reason required; writes an audit record and subscription event)
- `GET /api/platform-admin/billing/webhook-events` (authenticated, filtered and paginated payment-event inbox)
- `POST /api/platform-admin/billing/webhook-events/:eventId/retry` (reason required; retries provider verification and writes an admin audit record)
- `GET /api/subscription` (tenant-scoped subscription status, trial/period/grace information and entitlements)
- `GET /api/subscription/plans` (active plan catalogue)
- `POST /api/subscription/create-order` (owner/admin only; idempotent, server-priced Razorpay order creation)
- `POST /api/subscription/verify-payment` (owner/admin only; signed callback plus provider-side captured-payment lookup before activation)

The API reads organizations, branches, terminals, users, synced orders, subscription records and plan definitions from Cloudflare D1. It does not read the local desktop SQLite database and does not synthesize demo tenant records.

Pilot access applications are stored separately from restaurant organizations in `pilot_access_requests` (migration 0014). The public form validates and rate-limits submissions; an idempotency key prevents network retries from creating duplicate records. Only the separate platform-admin identity can search, inspect, or update those requests. Request status changes and internal-note updates are written to `platform_admin_audit_log`. An approval records the decision only: no restaurant account is created and no invitation email is sent automatically.

The Worker runs a daily scheduled retention job at 03:17 UTC. Requests with no update for 180 days are deleted, including contact fields and internal notes; each non-empty purge writes a system audit entry with the deleted count and cutoff. Updating a request restarts its retention period. Deployments must retain the configured Cron Trigger for this guarantee to apply.

GMV and recurring revenue are grouped by currency. No implicit INR/USD/EUR conversion is performed. MRR is calculated from active subscription price snapshots: monthly amounts are used directly and yearly amounts are divided by twelve. Trials, suspended subscriptions and cancelled subscriptions are not included in MRR.

The Starter, Professional and Enterprise prices in migration 0008 preserve the currently configured local subscription prices (₹499 / ₹1,299 / ₹2,999 per month). The yearly snapshots are ₹4,999 / ₹12,999 / ₹29,999. Changes to the plan catalogue do not rewrite prices already stored in an organization subscription.

New self-service registrations receive a 14-day Starter trial and a `trial_started` event. Existing organizations are intentionally not backfilled or downgraded by migrations 0008/0009; organizations without a subscription row preserve legacy access until explicitly migrated and appear with no subscription assigned.

The Worker now checks the D1 organization and subscription record before protected tenant operations. It expires trials, starts a persisted seven-day grace period after paid-period expiry or past-due status, and suspends access when that grace period ends. Platform-suspended or closed organizations are blocked. The session-inspection and subscription-status routes remain available so owners can understand the restriction.

Plan entitlements are checked server-side for multi-outlet branch creation, KDS tickets, advanced reports and inventory transfers. A Starter plan does not acquire those features just because a client changes a UI flag. Legacy organizations without a subscription record retain legacy entitlements until a controlled migration is performed.

Platform administrators may suspend/reactivate/close organizations and change a plan snapshot with a reason. These operations are recorded in `platform_admin_audit_log` and `subscription_events`. The API refuses to transition an unpaid or non-active subscription to `active`: paid activation remains reserved for provider-verified billing settlement. A plan change to an already active subscription retains its existing billing period and payment provider reference.

## Required rollout order

**Migration-history safety note (verified 2026-11-02):** production `d1_migrations` is empty although the database already has four organizations and tables/columns created by migrations 0002, 0003 and 0004. Wrangler therefore reports all migrations as pending, and directly applying them would attempt duplicate `ALTER TABLE` statements (starting with the pairing-token columns). Do not run the generic migration command against production until the schema and data have been backed up, fully diffed against all migration files, and a reviewed baseline/reconciliation plan has been applied in staging. Staging D1 inspection currently fails with Cloudflare authorization error 7403.

1. Back up the production D1 database.
2. Apply pending migrations in staging first (including migration 0014 for the pilot inbox):
   ```sh
   cd apps/cloud-api
   npx wrangler d1 migrations apply orderitup-d1-staging --env staging --remote
   ```
3. Run registration, auth, cloud API and platform-admin tests against staging.
4. Apply the migration to production:
   ```sh
   npx wrangler d1 migrations apply orderitup-d1-prod --remote
   ```
5. Provision platform-admin settings and staging Razorpay test credentials in their respective Cloudflare Worker environments. Provision live Razorpay credentials only in production after merchant onboarding and a reviewed live-payment runbook.
6. Deploy the Worker only after migrations, exact frontend origins, and environment-specific secrets are verified.

The production and staging Wrangler environments each schedule the pilot-request retention trigger. Verify the Cron Trigger is active after deploying Worker configuration; without scheduled-event delivery, the privacy notice's automated deletion promise is not met.

Wrangler applies all pending migrations in filename order, including `0008_saas_subscription_and_platform_admin.sql`, `0009_subscription_grace_periods.sql`, `0014_pilot_access_requests.sql`, `0015_saas_subscription_payment_orders.sql` and `0016_saas_payment_webhook_inbox.sql`. Do not deploy a Worker build that queries these tables until the migrations have been applied in the target environment.

## Platform administrator credentials

The platform administrator is deliberately separate from restaurant owner accounts. The bootstrap accepts one environment-provisioned operator until persistent operator management, MFA, session revocation and multi-operator audit workflows are added.

Required values:

- `PLATFORM_ADMIN_EMAIL`: the platform administrator email.
- `PLATFORM_ADMIN_PASSWORD_HASH`: a scrypt hash in the format emitted by the Cloud API `hashPassword()` helper. Do not store plaintext passwords in Git.
- `PLATFORM_ADMIN_JWT_SECRET`: a random secret of at least 32 characters. It **must differ** from the tenant `JWT_SECRET`.

Generate a password hash in a trusted local shell using a secure temporary password variable and the Cloud API helper. Do not pass the plaintext password as a command-line argument or commit it to a file. One supported approach is to use a short local Node script that imports `hashPassword` from `apps/cloud-api/src/auth.ts`, reads the password from a hidden prompt, prints only the resulting hash, and clears the variable after use.

Generate the dedicated JWT secret with a cryptographically secure generator, for example:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Store the three values in Cloudflare's encrypted secret/variable configuration. The platform-admin API returns HTTP 503 until its credentials are fully configured. Platform-admin tokens expire after one hour and are signed with the dedicated platform secret, not the tenant JWT secret.

## SaaS subscription checkout

Migration `0015_saas_subscription_payment_orders.sql` adds an idempotency-scoped payment-order ledger. The Worker reads the active plan price from D1, reserves the order before contacting Razorpay, and refuses mismatched provider order details. Verification checks Razorpay's callback HMAC, independently retrieves the payment from Razorpay, and validates captured state, order, amount, and currency before recording the payment and activating the subscription. Retries return the existing order or subscription result. Order creation is limited to ten attempts per organization per hour. Suspended and closed organizations cannot start or verify billing.

Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in each Cloudflare Worker environment's secret store. Production accepts only `rzp_live_...` key IDs; staging/local can use test keys. Never reuse a production key in staging. These provider secrets are separate from both tenant and platform-admin JWT secrets. The browser checkout must send the returned order ID, payment ID and signature to `/api/subscription/verify-payment`; a redirect or browser-provided success flag cannot activate a plan.

The webhook receiver at `POST /api/webhooks/razorpay` verifies `X-Razorpay-Signature` against the exact raw body using the separate `RAZORPAY_WEBHOOK_SECRET`. It durably deduplicates `X-Razorpay-Event-Id`, processes `payment.captured`, and independently fetches the provider payment before activation. Other signed events are durably marked ignored. Configure the webhook URL in Razorpay and subscribe to `payment.captured`; migration `0016_saas_payment_webhook_inbox.sql` must be applied first.

The platform-admin dashboard includes a failed/received event queue and an audited manual retry action for events with a linked order and payment. The retry still performs an independent provider fetch; it cannot mark a payment active by itself. Events that were malformed or have no captured-payment references stay visible for investigation but cannot be retried from this control. Automatic recurring collection, subscription cancellation/refunds, alerts for failed events, and provider settlement reconciliation remain incomplete. Complete those controls before broad paid rollout. Run `npm run test:cloud-saas-subscription-payments` and the platform-admin test before rollout, then exercise the provider's staging flow after applying migrations 0015 and 0016.

Do not mark an organization as paid based on a screenshot, UTR or client-supplied payment flag. Only the server's signed callback and provider-side payment lookup can activate this checkout flow.
