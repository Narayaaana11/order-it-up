# Cloud Platform Administration and SaaS Subscriptions

## What is implemented

The Cloudflare Worker exposes a separate platform-administrator namespace:

- `POST /api/platform-admin/login`
- `GET /api/platform-admin/me`
- `GET /api/platform-admin/overview`
- `GET /api/platform-admin/tenants`
- `GET /api/platform-admin/tenants/:organizationId`
- `GET /api/platform-admin/plans`

The API reads organizations, branches, terminals, users, synced orders, subscription records and plan definitions from Cloudflare D1. It does not read the local desktop SQLite database and does not synthesize demo tenant records.

GMV and recurring revenue are grouped by currency. No implicit INR/USD/EUR conversion is performed. MRR is calculated from active subscription price snapshots: monthly amounts are used directly and yearly amounts are divided by twelve. Trials, suspended subscriptions and cancelled subscriptions are not included in MRR.

The Starter, Professional and Enterprise prices in migration 0008 preserve the currently configured local subscription prices (₹499 / ₹1,299 / ₹2,999 per month). The yearly snapshots are ₹4,999 / ₹12,999 / ₹29,999. Changes to the plan catalogue do not rewrite prices already stored in an organization subscription.

New self-service registrations receive a 14-day Starter trial and an audit event. Existing organizations are intentionally not backfilled or downgraded by migration 0008; they remain on their existing access state until explicitly migrated. They appear in the platform directory with no subscription row until that migration is performed.

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

Do not deploy a Worker build that queries migration 0008 before the D1 migration has been applied.

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

Migration 0008 establishes the plan catalogue, per-organization subscription snapshot and subscription event ledger. New tenants receive a recorded trial. It does **not** yet create a live paid subscription, collect recurring fees, verify payment provider callbacks, or automatically renew/cancel subscriptions. Those state transitions must be wired to a verified SaaS billing provider before paid entitlements are enforced.

Do not mark an organization as paid based on a browser redirect, screenshot, UTR or client-supplied payment flag. Only authoritative provider verification and an idempotent signed webhook should activate a paid subscription.
