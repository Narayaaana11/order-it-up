# Central Admin Bootstrap and Webhook Security

## Central SaaS admin authentication

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
