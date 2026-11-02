# Order It Up — Production Release Runbook

**Status:** Prepared, not executed. This runbook does not authorize a production change by itself.
**Scope:** Cloudflare Worker + D1, Cloudflare Pages (web dashboard/QR), and post-deploy verification for the desktop/tablet clients.
**Related:** [D1 baseline reconciliation](./CLOUD_D1_BASELINE_RECONCILIATION.md), [security bootstrap](./SECURITY_BOOTSTRAP_AND_WEBHOOKS.md), [deployment guide](../DEPLOYMENT.md), [master plan](./PRODUCTION_READINESS_MASTER_PLAN.md).

## 0. Non-negotiable preconditions

Do not apply migrations or deploy until all of these are true:

1. The D1 reconciliation in `CLOUD_D1_BASELINE_RECONCILIATION.md` has been reviewed and its data decisions accepted.
2. A fresh production backup/bookmark exists and a restore has been exercised on an isolated copy.
3. The full local matrix passes: `npm run verify:cloud`, `npm run check:cloud-worker`, `npm run check:cloud-release`, `npm run build:web`, `npm run build:frontend`, landing build and its browser E2E.
4. Staging has been migrated and exercised with the same Worker commit and the same Pages build.
5. Every secret in §3 exists in Cloudflare's secret manager for the target environment — never in `wrangler.toml`, `.dev.vars`, git history or chat.
6. A named person owns the release, the rollback decision and the go/no-go call.

## 1. Release inputs (repository)

```powershell
npm run verify:cloud          # Cloud auth, E2E, operations, catalog, customers, staff, CSV
npm run check:cloud-worker    # Wrangler dry-run bundle with the real D1 binding
npm run check:cloud-release   # migrations, readiness tables, Wrangler safety, script presence
npm run build:web             # static export incl. /qr, /tablet-pos, /tablet-waiter
npm run build:frontend        # desktop renderer export
```

`check:cloud-release` verifies migration numbering is contiguous, every table in `REQUIRED_READINESS_TABLES` is created by a migration, production CORS has no wildcard, self-service registration is closed, staging is isolated, and no secret is committed in `wrangler.toml`.

## 2. Database release (D1)

Run from `apps/cloud-api` against the target environment only after §0:

```powershell
npx wrangler d1 migrations list orderitup-d1-prod --remote
npx wrangler d1 migrations apply orderitup-d1-prod --remote
npx wrangler d1 execute orderitup-d1-prod --remote --command "SELECT COUNT(*) FROM d1_migrations"
```

Expected: the ledger reaches the highest checked-in migration (currently `0024_guest_payment_intents.sql`) and the new tables exist. The Worker `/ready` endpoint independently verifies every readiness table and required column.

Order matters: **D1 migrations before the Worker deploy**, because the new Worker expects the new schema. The old Worker tolerates the added tables/columns.

## 3. Secrets

| Secret | Purpose | Notes |
|---|---|---|
| `JWT_SECRET` | Tenant/user bearer tokens | ≥32 chars, unique per environment, rotate on exposure |
| `PLATFORM_ADMIN_EMAIL` | Platform admin login | Valid email |
| `PLATFORM_ADMIN_PASSWORD_HASH` | Platform admin password | scrypt format `scrypt$N=...,r=...,p=...$salt$hash` |
| `PLATFORM_ADMIN_JWT_SECRET` | Separate platform-admin tokens | Must differ from `JWT_SECRET` |
| `RAZORPAY_KEY_ID` | Subscription checkout | Live key, not `rzp_test_*` |
| `RAZORPAY_KEY_SECRET` | Razorpay API auth | Live secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC | Must match the dashboard webhook config |

`REQUIRE_PROVIDER_VERIFIED_NONCASH` is set to `true` in production/staging `wrangler.toml`. With no guest-payment provider flow configured, the Cloud API records cash only and rejects client-entered card/UPI tenders with `PROVIDER_VERIFICATION_REQUIRED`. Do not disable this flag to make a demo work; implement and verify the provider flow instead.

The guest provider flow now exists in source: `GET /api/payments/capabilities`, `POST /api/orders/:id/payment-intent`, and `POST /api/payments/verify`. It creates a provider order, verifies the client signature, fetches the captured payment from Razorpay, checks the amount/currency/order binding, and only then writes a `gateway_verified` ledger row. It fails closed with `PAYMENT_PROVIDER_NOT_CONFIGURED` until live keys are provided. Keep `REQUIRE_PROVIDER_VERIFIED_NONCASH=true` even after enabling the flow: card/UPI must only enter through `/api/payments/verify`, never through the cashier payment endpoint.

```powershell
cd apps/cloud-api
npx wrangler secret put JWT_SECRET
npx wrangler secret put PLATFORM_ADMIN_EMAIL
npx wrangler secret put PLATFORM_ADMIN_PASSWORD_HASH
npx wrangler secret put PLATFORM_ADMIN_JWT_SECRET
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
```

`/ready` fails closed when the JWT/admin secrets are missing or malformed. `/health` only proves the Worker is running.

## 4. Deploy order

1. **D1** — apply reviewed migrations (§2).
2. **Worker** — `npx wrangler deploy` from `apps/cloud-api`, then verify:
   - `GET /health` → 200 operational
   - `GET /ready` → 200 `{"status":"ready"}`
   - a known tenant login returns a token and `/api/auth/me`
3. **Pages** — run the manually dispatched **Deploy Cloudflare Pages** workflow on `main`; it requires `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, a ready Worker, and verifies the published `/qr/` route.
4. **Web/QR smoke** — open `/dashboard` (live workspace), `/products`, `/staff`, `/customers`, `/tables`, `/tablet-pos`, `/tablet-waiter`, and a real customer QR scan from a phone on a different network.
5. **Desktop** — install the built Windows artifact, pair a terminal, confirm sync and QR inbox delivery.
6. **Android** — install the Capacitor APK built by CI (`tablet-android-verify`), sign in as cashier and as waiter, confirm the role routing and one order round trip.

## 5. Post-deploy acceptance checklist

- [ ] `/ready` returns ready and does not expose schema or secret details in errors.
- [ ] Login, logout and token revocation work; a revoked token is rejected immediately.
- [ ] Owner dashboard shows live sales/orders/tables, not sample data.
- [ ] Menu product/category create, edit and CSV round-trip persist in D1.
- [ ] Staff create → login → password reset → deactivate → reactivate works.
- [ ] Customer create/search and wallet history show persisted orders.
- [ ] Waiter opens a table order and appends a round; kitchen sees two tickets.
- [ ] Cashier records cash, closes the shift, and the variance persists.
- [ ] Reservation seats and releases a table.
- [ ] Delivery job assigns a driver and enforces COD collection.
- [ ] QR order from an external phone requires staff approval and tracks privately.
- [ ] Subscription checkout uses live keys and a signed webhook activates the plan once under replay.
- [ ] Platform admin pilot invite issues a one-time link and redemption provisions a tenant.
- [ ] No CORS wildcard and no test-mode payment key in production responses/logs.

## 6. Rollback

- **Worker:** `npx wrangler deployments list`, then roll back to the previous version (`npx wrangler rollback [deployment-id]`). Do not redeploy an old bundle against a newer schema without checking compatibility.
- **D1:** Cloudflare Time Travel bookmark/restore. A schema rollback is a reviewed migration, never an ad-hoc `DROP`; restore from the pre-release backup if data was corrupted.
- **Pages:** re-publish the previous successful deployment from the Cloudflare dashboard.
- **Feature containment:** if one workflow regresses, prefer disabling that surface (for example closing QR ordering or hiding the tablet route) over rolling back the whole platform.

## 7. Known deployment gaps

### Desktop release pipeline — locally verified, GitHub workflow missing

- `npm run build`, `npm run build:frontend`, and `npm run pack` pass; electron-builder 26.15.3 produces `release/win-unpacked` with the Electron 43.4.1 runtime.
- `npm run verify:electron` and `npm run verify:release-artifacts` pass.
- `npm run test:release-config` currently fails because `.github/workflows/release.yml` — plus `publish-mas.yml`, `release-candidate-gate.yml`, `nightly-release.yml` and `upgrade-matrix.yml` — are absent from this checkout. They were deleted earlier in the repository history, and some scripts they referenced are also gone.
- Recovery path (investigated 2026-11-03): the last complete release-workflow family exists at commit `50be6aa`, and the release-gate scripts/assets it references are still present in the current tree. A restore attempt reached the draft-notes assertion but then required the older CI architecture (`changes`, `e2e-playwright` with `Run renderer and printer regression suites`, native Electron E2E) that the current `ci.yml` no longer contains. Restoring only the workflows is therefore not sufficient; the release pipeline must be re-authored or the historical CI reconciled as a dedicated change, with the POSIX-only fake-command assumptions in `tests/release-config.test.ts` verified on the Linux runner.
- Therefore **do not claim signed installers, macOS/MAS builds, the upgrade matrix or electron-updater publishing**. Signing identities/notarization secrets and the GitHub release environment also remain unprovisioned.

- Remote D1 schema drift and historical backfills are not reconciled yet.
- No production credentials, domains or DNS are configured in this repository.
- Provider-backed card/UPI settlement, receipt printing from Android, durable tablet offline storage and Flutter/Cloud parity are not release-verified.
- Wrangler is pinned to 3.114.x; upgrading to 4.x should be tested before the release window.
