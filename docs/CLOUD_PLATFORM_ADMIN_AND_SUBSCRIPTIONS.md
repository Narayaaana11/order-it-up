# Cloud Platform Administration and SaaS Subscriptions

## What is implemented

The Cloudflare Worker exposes a separate platform-administrator namespace:

- `POST /api/platform-admin/login`
- `GET /api/platform-admin/me`
- `GET /api/platform-admin/overview`
- `GET /api/platform-admin/tenants`
- `GET /api/platform-admin/tenants/:organizationId`
- `GET /api/platform-admin/plans`
- `PATCH /api/platform-admin/tenants/:organizationId/account-status` (reason required; writes an audit record)
- `PATCH /api/platform-admin/tenants/:organizationId/subscription` (reason required; writes an audit record and subscription event)
- `GET /api/subscription` (tenant-scoped subscription status, trial/period/grace information and entitlements)
- `GET /api/subscription/plans` (active plan catalogue)

The API reads organizations, branches, terminals, users, synced orders, subscription records and plan definitions from Cloudflare D1. It does not read the local desktop SQLite database and does not synthesize demo tenant records.

GMV and recurring revenue are grouped by currency. No implicit INR/USD/EUR conversion is performed. MRR is calculated from active subscription price snapshots: monthly amounts are used directly and yearly amounts are divided by twelve. Trials, suspended subscriptions and cancelled subscriptions are not included in MRR.

The Starter, Professional and Enterprise prices in migration 0008 preserve the currently configured local subscription prices (₹499 / ₹1,299 / ₹2,999 per month). The yearly snapshots are ₹4,999 / ₹12,999 / ₹29,999. Changes to the plan catalogue do not rewrite prices already stored in an organization subscription.

New self-service registrations receive a 14-day Starter trial and a `trial_started` event. Existing organizations are intentionally not backfilled or downgraded by migrations 0008/0009; organizations without a subscription row preserve legacy access until explicitly migrated and appear with no subscription assigned.

The Worker now checks the D1 organization and subscription record before protected tenant operations. It expires trials, starts a persisted seven-day grace period after paid-period expiry or past-due status, and suspends access when that grace period ends. Platform-suspended or closed organizations are blocked. The session-inspection and subscription-status routes remain available so owners can understand the restriction.

Plan entitlements are checked server-side for multi-outlet branch creation, KDS tickets, advanced reports and inventory transfers. A Starter plan does not acquire those features just because a client changes a UI flag. Legacy organizations without a subscription record retain legacy entitlements until a controlled migration is performed.

Platform administrators may suspend/reactivate/close organizations and change a plan snapshot with a reason. These operations are recorded in `platform_admin_audit_log` and `subscription_events`. The API refuses to transition an unpaid or non-active subscription to `active`: paid activation remains reserved for provider-verified billing settlement. A plan change to an already active subscription retains its existing billing period and payment provider reference.

## Required rollout order

1. Back up the production D1 database.
2. Apply the migration in staging first:
   ```sh
   cd apps/cloud-api
   npx wrangler d1 migrations apply orderitup-d1-staging --env staging --remote
   ```
3. Run registration, auth, cloud API and platform-admin tests against staging.
4. Apply the migration to production:
   ```sh
   npx wrangler d1 migrations apply orderitup-d1-prod --remote
   ```
5. Provision the platform-admin environment values in the Cloudflare Worker secret store.
6. Deploy the Worker only after the migration and secrets are verified.

Wrangler applies all pending migrations in filename order, including `0008_saas_subscription_and_platform_admin.sql` and `0009_subscription_grace_periods.sql`. Do not deploy a Worker build that queries these tables/columns until both migrations have been applied in the target environment.

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

## Current billing boundary

Migrations 0008 and 0009 establish the plan catalogue, per-organization subscription snapshot, subscription event/audit ledgers, and persisted grace-period dates. The Worker can read plan state and enforce trial/renewal expiry. It does **not** yet create live paid billing orders, collect recurring fees, verify provider callbacks, automatically renew/cancel subscriptions, issue refunds, or reconcile settlements. The subscription create-order and verify-payment endpoints intentionally return HTTP 503 until a dedicated SaaS billing provider implementation is configured and tested.

Do not mark an organization as paid based on a browser redirect, screenshot, UTR or client-supplied payment flag. Only authoritative provider verification and an idempotent signed webhook should activate a paid subscription.
