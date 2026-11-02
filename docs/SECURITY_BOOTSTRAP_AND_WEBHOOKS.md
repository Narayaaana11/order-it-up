# Central Admin Bootstrap and Webhook Security

## Local POS central admin authentication

Central admin login is intentionally unavailable until an operator provisions the bootstrap identity through the deployment secret manager.

Required environment variables:

| Variable | Requirement |
| --- | --- |
| `OIU_ADMIN_JWT_SECRET` | Random secret, at least 32 characters. Keep it private. |
| `OIU_ADMIN_BOOTSTRAP_EMAIL` | Email address of the initial platform administrator. |
| `OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH` | bcrypt hash of the bootstrap password. Never put the plaintext password in source control. |
| `OIU_ADMIN_BOOTSTRAP_NAME` | Optional display name. |

Generate a bcrypt hash out of band using the repository's installed bcryptjs package:

```sh
node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync(process.env.ADMIN_BOOTSTRAP_PASSWORD, 12))"
```

Set `ADMIN_BOOTSTRAP_PASSWORD` only in a secure local shell session; do not put it in a committed .env file or paste it into an issue or chat. Copy the resulting hash into the deployment secret manager as `OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH`, then unset the temporary shell variable.

Generate the JWT secret with a cryptographically secure generator, for example:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The admin login endpoint returns HTTP 503 if any required setting is absent or malformed. Incorrect credentials return HTTP 401. Login attempts are rate-limited to five attempts per 15-minute window in production. Admin tokens expire after eight hours.

### Current limitation

The bootstrap implementation provisions one SUPER_ADMIN identity from environment configuration. It is a safe first-run gate, not a complete multi-operator identity-management system. Persistent operator invitations, individual roles, MFA, session revocation and audit history must be implemented before operating a large support/finance team.

Rotating `OIU_ADMIN_JWT_SECRET` invalidates all previously issued central admin tokens. Rotate the bootstrap password hash separately. If a previous password or secret has ever been committed or shared, treat it as compromised and rotate it; deleting the visible string does not erase it from Git history.

## Cloud Worker platform admin authentication

The Cloud Worker platform dashboard uses a separate bootstrap identity. These are Cloudflare Worker secrets, not the local POS `OIU_ADMIN_*` variables above:

| Worker secret | Requirement |
| --- | --- |
| `PLATFORM_ADMIN_EMAIL` | Provisioned platform operator email. |
| `PLATFORM_ADMIN_PASSWORD_HASH` | Password encoded in the Cloud API's scrypt format. |
| `PLATFORM_ADMIN_JWT_SECRET` | Random secret of at least 32 characters; it must differ from `JWT_SECRET`. |

The Worker `/ready` probe fails until the tenant `JWT_SECRET` and all three platform-admin settings are valid. The pilot-request inbox, tenant controls and SaaS billing-event review use this Cloud Worker identity. Do not copy `OIU_ADMIN_*` values into these bindings; the local POS central admin and Cloud Worker admin have separate token verification and user stores.

## Desktop Cloud terminal credential storage

Cloud Worker terminal bearer credentials are stored in desktop SQLite only after encryption through Electron `safeStorage`. Existing plaintext terminal credentials are migrated to the encrypted representation when cloud settings are loaded. If OS-backed encryption is unavailable, new pairing fails closed; an unreadable saved credential is disabled and must be paired again. Terminal credentials remain excluded from database exports and restore snapshots.

## SaaS subscription billing credentials

The Cloud API uses `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` only for SaaS subscription checkout, and `RAZORPAY_WEBHOOK_SECRET` for webhook HMAC validation. Store all three in Cloudflare's environment-specific secret manager, never in Git, the landing bundle, or tenant configuration. Production rejects any key ID that is not in Razorpay live mode (`rzp_live_...`); staging should use isolated test credentials. The checkout response exposes the public key ID only. Payment activation requires a valid callback/webhook signature and an independent provider API lookup that matches the payment, order, captured state, amount and currency. Order creation is rate limited per organization; inactive organizations cannot manage billing.

The webhook endpoint is `POST /api/webhooks/razorpay`. Configure it in Razorpay with `payment.captured` and migration `0016_saas_payment_webhook_inbox.sql` applied. The receiver verifies the signature on the original raw bytes before parsing and deduplicates the provider event ID. Platform admins can inspect failed/received events and retry eligible payment verification with an audited reason. Current limitations: automatic recurring collection, cancellation/refunds, failure alerts, and settlement reconciliation are not implemented. Do not launch broad paid billing until those controls are operational.

## Aggregator webhook authentication

Every Swiggy/Zomato webhook endpoint (order ingestion, rider update and cancellation) requires:

1. An enabled integration row in `aggregator_configs`.
2. A non-empty platform-specific `webhook_secret`.
3. A valid HMAC-SHA256 signature over the exact raw HTTP request body.
4. The platform's expected signature header.

The Express JSON parser preserves the exact request bytes before parsing. Do not recreate the signed body with `JSON.stringify(req.body)`; whitespace and property ordering can change the signature input.

An absent or disabled integration, or a missing signing secret, returns HTTP 503. A missing or invalid signature returns HTTP 401. This is intentional fail-closed behavior: webhook traffic must remain disabled until the restaurant has configured the real partner secret.

The current implementation supports `x-swiggy-signature`, and `x-zomato-signature` / `x-zomato-auth`. Confirm the exact header, digest encoding and signing contract with each approved integration partner before production onboarding. Never assume that a local simulation route demonstrates a live partner integration.

## Validation

Run the focused checks from the repository root:

```sh
npm run test:security
node tests/run-electron-node-test.cjs tests/aggregator-webhooks.test.ts
npm run lint:backend
npm run build
```

Also run the full CI workflow before merging. Tests in a local harness do not replace validation against the actual partner's signed webhook examples or a deployed staging environment.


## Cloud API CORS

Production and staging must set `FRONTEND_ORIGIN` to a comma-separated list of exact trusted browser origins, for example `https://app.orderitup.in,https://orderitup.pages.dev`. The Worker does not reflect arbitrary origins in production/staging and does not accept wildcard entries in those environments. An origin not on the allowlist receives no `Access-Control-Allow-Origin` header. Keep this list synchronized with the actual deployed frontend origins.
