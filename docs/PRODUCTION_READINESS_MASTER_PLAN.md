# Order It Up — Production Readiness Master Plan

**Status:** Working plan  
**Repository:** `Narayaaana11/order-it-up`  
**Planning baseline:** Repository inspection on 2026-11-03
**Current source baseline:** `origin/main` at `07f6d3f` (PR #35 merged the pilot access, admin inbox, migration, CI, and multi-platform changes)
**Current local work branch:** `feat/tablet-pos-and-role-dashboard-foundation`

## Current verified source state — 2026-11-03

This section supersedes the initial inspection notes below wherever they conflict. Source status is based on the merged `origin/main` baseline. Runtime and D1 observations below are still the read-only 2026-11-02 audit snapshot; they are not proof of current deployment state.

Current local work also adds Cloud D1 migration 0019 for authoritative order completion timestamps. The remote D1 baseline has not been re-audited for this migration; it must be included in the reviewed reconciliation before deployment.

### Latest verified increment — Cloud restaurant operations suite (2026-11-03)

- **Migration 0020** adds `restaurant_vendors`, `expense_categories`, `expenses`, `reservations`, `ingredients`, `inventory_transactions`, `recipes`, and `delivery_jobs`.
- **Migration 0021 + `apps/cloud-api/src/routes/catalog-admin.ts`** close the menu-management gap: the desktop-compatible `/products` and `/categories` CRUD contract now runs on D1 with the richer product fields, modifier-group links, category reassign/delete-all rules, and owner/manager-only writes.
- **Cloud menu CSV** (`routes/menu-csv.ts`) serves the product dashboard's templates, exports and imports with quoted-cell parsing, per-row validation, and owner/manager-only access.
- **Mobile compatibility** (`routes/mobile-compat.ts`, migration 0023) adds session refresh, the Flutter cash-closure contract, branch-scoped held orders (`/api/held-orders`), and CRM phone lookup; kitchen ticket status accepts the mobile/KDS vocabulary (`waiting`/`served`).
- **Cloud staff management** (`routes/staff.ts`) serves the desktop `/staff` directory against `cloud_users` + `memberships`, with password login/reset, role changes that rewrite memberships, and protections for self-deactivation and the last active owner.
- **Guest payment intents** (migration 0024 + `routes/guest-payments.ts`) add capability discovery, server-created provider intents, signature and provider-capture verification, and a `gateway_verified` ledger write; without live keys it fails closed.
- **Non-cash tender guard:** production/staging set `REQUIRE_PROVIDER_VERIFIED_NONCASH=true`, so a cashier cannot mark card/UPI paid from a typed reference. Only cash (or the verified intent flow) is recordable.
- **Cloud customer registry** (migration 0022 + `routes/customers.ts`) provides tenant-scoped customer CRUD, phone search, and order-derived spend/visit aggregates for the CRM screen and waiter seating; loyalty balances are reported as zero rather than fabricated. Owner reports now count new customers from this registry for the caller's authorized branches.
- **Cloud table management** now supports create, configuration updates, deactivate/reactivate, and inactive-table listing with occupied-table protection, so the web `/tables` dashboard works against D1.
- **`apps/cloud-api/src/routes/restaurant-ops.ts`** implements branch-scoped, role-checked expenses (void-not-delete), vendor/category management, reservations with a state machine and table occupancy, inventory adjustments with an idempotent ledger and recipe costing, shift cash closure with persisted variance in `synced_cash_closures`, and delivery dispatch with assignment/handoff and explicit COD collection.
- **Landing live workspace** now exposes role-scoped tabs for floor, reservations, kitchen, cashier + shift close, inventory, expenses, delivery, and reports using only persisted Cloud data.
- **Tablet POS** now resolves at `/tablet-pos` (matching the Capacitor redirect), runs in a dedicated full-screen layout, and the Android wrapper starts at `/tablet-pos/index.html`. The web export gate verifies the route exists.
- **Verification:** `tests/cloud-restaurant-ops.test.ts`, `tests/cloud-catalog-admin.test.ts`, Cloud auth suite, 9-part Cloud E2E audit, migration compatibility suite, Cloud API TypeScript check, frontend TypeScript, `npm run build:web`, landing production build, and the landing Cloud workspace browser E2E all pass locally.
- **Still open:** remote D1 reconciliation/deployment, provider-verified card/UPI and refund settlement, receipt printing from the tablet, durable tablet offline storage, Flutter/Cloud parity, and the remaining SaaS/onboarding production checks. No deployment or push was performed for this increment.

### Verification matrix — 2026-11-03

`npm run verify:cloud` runs the Cloud contracts end to end. The following all passed locally after migrations 0020–0022:

| Suite | Scope |
|---|---|
| `cloud-auth-hardening` | JWT/RBAC, revocation and rate-limit boundaries |
| `comprehensive-e2e-audit` | 9-part multi-branch, catalog, transfers, mobile parity |
| `cloud-restaurant-ops` | expenses, reservations, inventory, recipes, shift close, delivery, waiter rounds, table management |
| `cloud-catalog-admin` | product/category CRUD, modifier links, tenant isolation, delete rules |
| `cloud-customers` | registry, search, aggregates, wallet, tenant isolation |
| `cloud-staff` | create, login, reset, role changes, owner protections, deactivation |
| `cloud-menu-csv` | templates, exports, imports, row validation, role denial |
| `cloud-dashboard-reports` | live totals, timezone bounds, branch isolation, new-customer count |
| `cloud-saas-migrations` | full migration chain 0001–0022 |
| `cloud-public-qr` | public QR ordering, staff approval, tracking, pilot setup |
| `cloud-terminal-pairing` | 76 checks: pairing, catalog/QR import, outbox, replay |
| `cloud-saas-subscription-payments` | Razorpay order/capture/webhook/replay |
| `landing-cloud-workspace` (browser) | waiter → kitchen → cashier → accountant against the live workspace |
| `cloud-mobile-compat` | Flutter session refresh, cash-closure contract, held orders, CRM lookup and reports against the Worker |
| `cloud-guest-payments` | Payment capabilities, provider intent creation, signature/capture/amount verification, idempotency, fail-closed behaviour |
| `npm run check:mobile-cloud` | Static parity: 35 mobile endpoints classified as Cloud/local-only/partner-gated |
| `npm run test:cloud-surface` | Web navigation hides desktop-only settings/WhatsApp/AI/aggregator pages in Cloud mode |
| `npm run check:cloud-worker` | Wrangler dry-run production bundle (477.58 KiB upload / 92.05 KiB gzip) with the real D1 binding |
| `npm run check:cloud-release` | 38 release-input checks: migration continuity, readiness tables, CORS/secrets safety, staging isolation, script presence |

These verify repository contracts, not a deployment. Live D1 schema, Worker secrets, payment credentials, Pages hosting, Android packaging and external-network QR still require the separate production phase.

| Area | Current evidence | Status |
|---|---|---|
| Central admin authentication | Environment-provisioned bootstrap identity, bcrypt hash validation, fail-closed JWT configuration and rate-limited login in `main/admin/auth.ts` and `main/admin/routes.ts`. Admin dashboard reports global tenant/MRR metrics as unavailable instead of synthesizing them. | Implemented in source; deployment secrets and live admin provisioning not verified. |
| Cloud API authentication | Tenant/branch authorization hardening and durable hash-based logout revocation. Cloud auth tests passed during this work. | Locally verified; latest source/migration not deployed. |
| Aggregator webhooks | Enabled integrations require configured secrets and signed raw request bodies. | Local tests exist; partner certification and live credentials are unverified. |
| Inventory reservations and order edits | POS creation and open-order item additions aggregate tracked-product demand across duplicate cart lines and atomically deduct product and recipe stock; insufficiency returns 409 and rolls back order and stock writes. Pending local/Cloud QR additions defer stock movements until staff acceptance. QR acceptance checks/debits recipes and tracked products atomically, and retries do not double-deduct. Aggregator auto-accept uses the same all-or-pending rule for stock shortages or unmapped products; cancellation restores stock transactionally and is replay-safe. Cancelling an order with collected bill payments now returns 409 until those amounts are fully refunded and recorded, preventing cancelled orders from retaining unreconciled sales. | Locally verified by `tests/inventory-recipe-deduction.test.ts` (26/26), `tests/qr-order-and-reservations.test.ts` (67/67), `tests/aggregator-webhooks.test.ts` (77/77), and `test:cloud-terminal-pairing` (76/76). A configurable per-restaurant negative-stock policy remains unimplemented; the current policy is strict for tracked product and recipe stock in these order paths. |
| Refund timing and inventory disposition | Refund eligibility is measured from the bill's actual payment time, or latest recorded installment when payment is partial, rather than order creation; legacy records without payment timestamps retain the order-time fallback. Cancelling an order with collected money is blocked until all collected amounts are refunded and recorded. Item refunds mark the source item refunded and do not restore tracked stock or recipe ingredients, preventing refunding a consumed meal from silently increasing stock. | Refund suite passed 54/54, including old-order/recent-payment acceptance and expired-payment rejection. No explicit returned/resellable disposition exists for tracked goods. POS refund records document cash movement but are not connected to a payment processor's refund API; provider-side refund confirmation and settlement reconciliation remain unverified. |
| Local QR ordering | Staff approval precedes table occupancy and stock deduction; tracking uses an expiring 256-bit capability stored as a hash. Table-scoped menus and order submissions require a separate 256-bit per-table capability, stored hashed, emitted in the QR URL fragment, issued only to owner/manager roles, and invalidated on reissue or database restore. QR orders now share catalog add-on validation, enforce required/linked/active modifier groups and bounded whole-number quantities, and persist modifier quantity snapshots. QR integration suite passed 61/61, add-on regression suites passed 16/16 and 9/9, and restore invalidation is covered by the production restore suite. | Locally verified. Cloud access and local POS delivery are now implemented in source with focused API/import tests; live Cloud D1 migration and external phone verification remain outstanding. Existing printed table QR codes must be regenerated after this migration. |
| Cloud QR ordering | Cloud Pages QR calls the Worker API; owner/manager issuance stores a per-table capability hash, public menu access is capability-gated, order lines and catalog modifier prices are server-validated, required/min/max modifier selection is enforced, tracking is private and expiring, and QR orders enter pending kitchen approval without occupying a table. Owner/manager modifier CRUD and product-to-group links are scoped to the organization. Submission uses an idempotency key persisted for retry, binds it to a request hash, and converges concurrent retries on one order. Dedicated Cloud D1 migrations and integration tests cover issuance, menu, pricing, modifier rules, idempotency, role permissions, approval, tracking and token rotation. | Locally verified (`test:cloud-public-qr`, Cloud API TypeScript check, frontend production export); production Worker migrations/deployment and phone-on-external-network verification remain outstanding. The currently deployed Pages QR route returns 404. |
| Subscription payments | D1-backed idempotent Razorpay order creation uses server-side plan prices; checkout callback and raw-body signed webhook independently confirm captured state, order, amount and currency before activation. Event IDs are durably deduplicated. Production rejects test-mode key IDs; inactive organizations are blocked and order creation is rate-limited. Captured payment renewal periods are now extended from the subscription row inside the atomic D1 write, so concurrent distinct successful checkouts do not both start from a stale period end; the focused suite now exercises that race. | Locally verified with the Cloud API TypeScript check and `tests/cloud-saas-subscription-payments.test.ts`. Live merchant onboarding, configured webhook delivery, failure alerts, automatic recurring collection, refunds/cancellation, settlement reconciliation, and production credentials remain unverified/incomplete. |
| Cloud deployment and D1 migration baseline | Read-only audits at 2026-11-02 18:09 UTC compared production and staging against the 18 migrations that existed at that time; the checkout now contains 22 and none of 0019–0022 has been re-audited remotely. Production `orderitup-d1-prod` has an empty `d1_migrations` ledger, 16 missing tables, two missing columns, 19 missing indexes and 29 duplicate-column hazards; four users lack the organization-level membership expected by migration 0004. Staging records 0001–0007; migrations 0008–0018, 16 tables, two columns and 19 indexes are absent. Staging's sole paid order without a ledger row is `ord-smoke-1793335935435`, an order-only 340 INR cash smoke fixture dated 2026-10-30 04:52Z; it has one processed `order.created` event and no payment event. The smoke fixture now sends pending/unpaid orders, but the historical row still requires a reviewed data decision. Both environments expose only `JWT_SECRET`; platform-admin bootstrap and Razorpay billing secrets are absent. The current `/ready` source checks every migration table, required columns and isolated platform-admin configuration. Live `/ready` still returns 401 from the old Worker. | **Critical release blocker:** production's baseline and historical backfills remain unreconciled; staging is also behind and has the identified smoke-test financial artifact. Do not apply migrations or deploy the Worker until data effects, the staging row and backup/rollback are reviewed. |
| Dependencies and desktop build | `npm audit --omit=dev` reported zero vulnerabilities after updating `@googleapis/drive` to 27.0.0. Google Drive regression suite and desktop build passed. | Locally verified; development dependency advisories remain. |
| Frontend | Next.js is pinned to 16.4.4; production-only frontend audit reported zero vulnerabilities. `npm run build:web` verifies `frontend/out/qr/index.html` and every referenced local Next.js asset; this gate runs in CI. A manual, main-only Cloudflare Pages deployment workflow requires a ready production Worker and verifies the public QR route after publishing. Local POS, Cloud dashboard, and landing defaults now target the reachable `orderitup-cloud-api.narayaaana11.workers.dev`; environment overrides remain supported. | Local export verified with 18 QR-route assets. Live Pages `/qr/` returned 404. Worker `/health` returned 200 but `/ready` returned 401, so the deployed Worker does not expose the readiness contract in this source and the guarded deployment was not run. |
| Mobile authentication lifecycle | Existing access token is refreshed on startup, `/api/auth/me` restores the real server identity and role, the cached user profile excludes the bearer token, revoked sessions clear local state, and logout calls the server revocation route before clearing local credentials. Bearer tokens now use OS secure storage (Android Keystore-backed encryption, Apple Keychain); the previous SharedPreferences token is migrated then removed, and storage failures clear the in-memory session instead of reverting to plaintext. Android app backups are disabled so device-bound encrypted credentials are not restored without their keys. | Source and regression cases are updated for token migration, secure-store failure, login failure cleanup and logout. Flutter/Dart are not installed in this work environment, so the updated mobile suite and native build remain unverified here. CI now runs an Android debug APK build in addition to Flutter analysis/tests. |
| Android release artifact integrity | Release packaging scripts call the Flutter APK builder, validate application contents, and verify the APK signature. Release Gradle builds fail unless a dedicated keystore is configured; signing with Android's debug key was removed. The GitHub release workflow requires four protected signing secrets and only stages the keystore in the runner. | Script and workflow source updated, but Flutter, Gradle and Android build-tools are unavailable in this environment, and protected signing secrets are not configured here. The existing local APK is unverified and is not evidence of a production release. The CI release build must still run with the dedicated keystore. |
| Mobile counter PIN flow | PIN input is constrained to exactly six digits. The local POS endpoint verifies the one-time PIN but does not persist a device enrollment or issue a device credential; the screen describes PIN acceptance followed by staff sign-in. | Source updated; the local PIN flow remains distinct from cloud terminal pairing. Flutter tests cover malformed/unavailable pairing cases; persistent device enrollment is not implemented. |
| Public deployment | On 2026-11-02 the production `workers.dev` Worker `/health` returned operational HTTP 200; `/ready` and a no-data `{}` POST to `/api/pilot-requests` both returned 401. The configured `api.orderitup.in` hostname failed DNS resolution. Pages `/qr/` returned HTTP 404. | Worker health does not identify deployed commit or prove schema, secrets, payments, or end-to-end behavior. The live Worker is not serving the readiness and public pilot-request routes present in this checkout; Pages QR is unavailable. No deployment was performed for this work. |
| Desktop-to-cloud terminal sync | Desktop Settings claims Worker-generated pairing codes at `/api/pos/pair`, stores the high-entropy bearer credential with Electron `safeStorage`, and sends outbox events to `/api/pos/events`. Legacy plaintext credentials are encrypted on read; pairing fails closed when OS encryption is unavailable. Worker responses are applied per `synced_ids`, leaving rejected events retryable. Terminals can revoke their own token through `/api/pos/disconnect`; backup restore deliberately clears the token and pauses Worker sync. Pairing, storage migration, request authentication, disconnect and restore tests pass; desktop build passes. | The terminal claim/outbox contract is locally verified. The `workers.dev` hostname responds to `/health`, but `/ready` returns 401, so route-level production compatibility is unverified. Live pairing, a real terminal batch and device acceptance still need the current Worker deployment, a real tenant and production credentials. Existing local installs migrate only the previous default hostname; explicitly configured custom endpoints are preserved. |
| Cloud QR and catalog synchronization | Cloud QR now writes a branch-scoped D1 delivery record. Active paired terminals with `cloudSync` entitlement can claim orders through `/api/pos/qr-orders`; acknowledgements are terminal-scoped and replay-safe. The desktop polls that inbox, maps table numbers and products by unique SKU (or unique name when SKU is absent), writes a pending local order with an idempotent receipt, leaves table occupancy/inventory untouched pending staff approval, then acknowledges. Staff acceptance moves both local and Cloud QR orders into preparation and atomically deducts mapped recipe and tracked-product stock; replaying the transition does not deduct twice. Subsequent order events map the local order and item IDs back to the existing cloud order. Paired terminals also download the branch-effective Cloud catalog every five minutes; mapped categories, products, and modifiers update in local SQLite while stock/cost are preserved and ambiguous SKU matches fail the transaction. Local Cloud QR receipt/catalog mapping migrations are v87/v88; Cloud D1 migration 0017 adds item SKU snapshots and delivery queue. | Locally verified: `test:cloud-public-qr` covers terminal catalog output plus QR claim/auth/ack; `test:cloud-terminal-pairing` covers local catalog/QR import, staff acceptance, stock reservation, SKU/table mapping, modifier snapshots, replay deduplication, preservation of stock/cost, and fail-closed unknown/ambiguous mapping. Both TypeScript checks pass. Cloud-to-desktop catalog pull is implemented; desktop catalog edits are not yet synchronized back to the Cloud master. Unknown QR mappings stay unacknowledged for staff repair. QR receipt deduplication is per local POS database; separate local databases could duplicate after an expired claim if import succeeded but its acknowledgement did not. |
| Pilot onboarding data retention | Pilot access requests are stored separately from tenants, reviewed by the platform admin and now have a daily 180-day inactive-record purge with a system audit event. | Source and focused test verified locally; production cron activation and D1 migration/deployment remain unverified. |
| Pilot account provisioning | Public self-registration is closed by default. A platform admin must approve a request, then issue a seven-day, 256-bit, one-time setup link. D1 stores only the token hash; changing the request out of approved revokes outstanding links. Redemption atomically creates the owner, organization, branch, membership, trial, starter catalog, audit entry and invitation-to-organization link. The new owner can log in with the password they set. Raw tokens and registration JWT responses are `no-store`; concurrent redemptions have one winner. Resend delivery is now optional; the admin inbox reports delivery status and preserves the one-time copy-link fallback. | Verified locally with the pilot admin suite, registration gate/invitation tests, and a real SQLite-backed Worker flow covering issue, password setup, login, replay and concurrent claim; pilot test mocks successful Resend delivery. `ALLOW_SELF_SERVICE_REGISTRATION=false` is explicit in Wrangler production/staging config. Automated email requires configured Resend credentials and a verified sender; migration 0018 and current Worker source are not deployed. |

The production D1 schema audit and reviewed recovery sequence are recorded in [CLOUD_D1_BASELINE_RECONCILIATION.md](./CLOUD_D1_BASELINE_RECONCILIATION.md). The audit is read-only; it does not authorize or perform a production migration.

PR #35 merged the latest source changes into `main` on 2026-11-03. The source has not thereby been deployed: repository tests, merge status, and public health checks do not establish that production matches `origin/main`. Recheck live service state and rerun the read-only D1 audit before any release decision.

This document separates verified repository observations from planned work. A feature is not considered production-ready merely because a UI, route, mock response, demo mode, or unit test exists.

## Product objective

Build Order It Up into a reliable, multi-tenant restaurant operating platform that independent restaurants can pay for monthly and that can later support restaurant groups and chains.

The product should preserve the offline-first desktop POS while adding dependable cloud coordination for customer QR ordering, waiter workflows, kitchen operations, mobile access, payments, inventory, reporting, and SaaS administration.

## Architecture principles

1. **One order domain:** POS, waiter, QR, website, and approved aggregator channels must create/update the same canonical order model.
2. **Cloud coordination, local resilience:** cloud services coordinate branches and remote channels; the desktop POS remains usable during internet outages and syncs safely when connectivity returns.
3. **Server-authoritative money and catalog:** clients never decide final prices, taxes, discounts, payment success, or stock movements.
4. **Tenant and branch isolation:** every request and data query must be scoped to an authenticated organization and authorized branch.
5. **Auditable state transitions:** order, payment, inventory, refund, and subscription transitions must be idempotent and traceable.
6. **No fake production states:** demo data and simulated integrations must be visibly marked and disabled in production.
7. **Incremental delivery:** implement in small, tested changes on feature branches; do not replace the existing POS wholesale.

## Historical findings from the initial inspection (2026-11-02; recheck against current state)

### Security and SaaS administration

- `main/admin/auth.ts` contains a hardcoded fallback JWT secret and statically seeded central admin operators using a shared default password hash.
- `main/admin/routes.ts` contains an in-memory mock tenant list and a hardcoded estimated MRR value. Those values must not be represented as live SaaS metrics.
- `landing/src/lib/auth.ts` contains demo identities, demo passwords, and demo-token/local-storage behavior. This must be gated to an explicit demo environment and must never authenticate production users.
- `main/routes/aggregators.ts` verifies webhook signatures only when a secret is configured. Production webhook endpoints must fail closed when secrets or signature headers are missing/invalid.
- `apps/cloud-api/src/index.ts` exposes broad CORS behavior in some configuration paths. Production origins must be explicitly allowlisted; no wildcard fallback for authenticated production APIs.
- The cloud API contains order, table, kitchen and payment operations, but the inspected route dispatcher does not establish that the desktop public QR endpoints are available through the cloud API.

### QR ordering and operations

- `main/routes/qr-order.ts` provides public menu, order submission, order tracking and waiter-call routes.
- The QR order handler currently inserts an order as pending, marks the table occupied, deducts ingredients with negative stock allowed, and notifies KDS immediately.
- `frontend/src/app/qr/page.tsx` calls relative `/api/qr/...` endpoints. A customer scanning a QR code outside the restaurant's local network needs a stable public cloud endpoint and tenant/branch/table binding.
- The Flutter application contains a waiter screen and API service. The existence of these screens does not by itself prove that QR approval, remote live updates, offline conflict handling, or production authentication are complete.
- QR code generation in the desktop route derives its URL from request host/protocol. Production QR codes should use a configured canonical public URL and an unguessable, revocable table token rather than trusting a client-supplied table ID.

### Inventory, payments and integrations

- `main/services/inventory-engine.ts` supports recipe costing, stock deduction and restoration. Its deduction function defaults to allowing negative stock.
- `main/routes/subscription.ts` implements SaaS subscription payment creation/verification. This is not equivalent to collecting and verifying a restaurant guest's bill payment.
- `main/routes/aggregators.ts` contains normalizers/webhook handlers and a test-order route. A local test harness is not proof of a live, partner-approved Swiggy/Zomato integration.
- Cloud operations include customer-payment ledger endpoints. Recording a payment row is not proof that a payment provider settled the transaction.
- No customer-review/Google-review workflow was confirmed in the files inspected so far.

## Initial implementation status — historical snapshot

### Phase 1 security hardening — source changes are present on the current implementation branch; CI and deployment remain pending

- [x] Removed the source-code JWT fallback and hardcoded central admin operator/password seeds.
- [x] Added environment-provisioned bootstrap admin credentials with bcrypt hash validation.
- [x] Central admin authentication fails closed when required environment settings are missing.
- [x] Central admin login attempts use the production authentication rate limiter.
- [x] Cloud API CORS requires exact allowlisted origins in production and staging; missing allowlists deny browser origins.
- [x] Preserved exact raw HTTP request bytes for webhook HMAC validation.
- [x] Swiggy/Zomato order, rider and cancellation webhook routes require an enabled integration and a valid platform signature.
- [x] Missing webhook secrets fail closed with HTTP 503; invalid/missing signatures fail with HTTP 401.
- [x] Removed default central admin passwords and documented local default PINs from `users.md`.
- [x] Added regression coverage for central admin bootstrap, unsigned/invalid/unconfigured webhooks and signed webhook workflows.
- [x] Desktop build, cloud API auth tests, payment security tests, Cloud E2E tests, QR approval tests, Google Drive tests and the frontend production build have passed locally in this work session.
- [ ] The complete CI workflow has not been run for this checkout; CI will run on the configured main/release pull-request workflow.
- [ ] Production deployment secrets must be provisioned and any previously exposed credentials rotated before enabling central admin or aggregator webhooks.
- [x] Landing app demo profiles use `example.invalid`, are preview-only in `sessionStorage`, and do not create API tokens; cloud login/registration uses the Cloud API.

See [SECURITY_BOOTSTRAP_AND_WEBHOOKS.md](./SECURITY_BOOTSTRAP_AND_WEBHOOKS.md) for required environment variables and validation commands.

## Delivery roadmap and acceptance criteria

### Phase 0 — Baseline and safeguards

- Record the exact base commit and create a feature branch.
- Run repository-wide lint, type checks, unit/integration tests, and production builds for each independently deployable app.
- Inventory environment variables, secrets, demo switches, migrations, API routes, and deployment targets.
- Confirm which CI workflows run for desktop, frontend, landing, mobile and cloud API.
- Establish a release checklist and rollback procedure.

**Exit criteria:** reproducible baseline results, no secrets committed, and a documented deployment/rollback path.

### Phase 1 — Production security

- Remove hardcoded JWT fallbacks and seeded production admin credentials.
- Define a secure bootstrap/provisioning path for central operators; store password hashes securely and support rotation/revocation.
- Gate all demo identities and fake tokens behind explicit development/demo configuration; reject them in production builds and production APIs.
- Require webhook secrets and signature verification for enabled aggregator endpoints; preserve raw request bytes for HMAC verification.
- Enforce explicit production CORS allowlists, rate limits, request-size limits and safe error responses.
- Review authentication, authorization, tenant/branch scoping, object-level access, token expiry, refresh/revocation and audit logging.
- Remove or label mock tenant/MRR metrics; live dashboards must query authoritative persisted data.
- Audit repository history and deployment secrets for exposed credentials; rotate any credential that may have been used.

**Exit criteria:** negative security tests prove that missing secrets, demo tokens, invalid signatures, cross-tenant requests and unauthorized roles are rejected.

### Phase 2 — Canonical cloud order lifecycle

Define one canonical order aggregate shared by all channels. Minimum fields:

- organization, branch, table and channel identifiers
- internal order ID plus external channel reference where applicable
- items, modifiers, authoritative prices, tax and discount breakdown
- customer details with privacy controls
- order status, kitchen status, payment status and fulfillment type
- idempotency key, version, timestamps and actor
- append-only order event/audit history

Recommended dine-in lifecycle:

`customer_submitted → awaiting_staff → accepted → preparing → ready → served → bill_requested → awaiting_payment → paid → closed`

Support rejection/cancellation and explicit transition rules. Do not let customer submission automatically imply kitchen acceptance.

**Exit criteria:** the same order created from desktop, waiter, QR and cloud test clients is visible consistently; duplicate submissions do not create duplicate orders; invalid transitions and stale versions are rejected.

### Phase 3 — Customer QR and waiter approval

- Generate QR links using a configured canonical public URL and signed/unguessable table token.
- Resolve token to organization, branch and table server-side; support token rotation/revocation.
- Serve public menu data from the cloud API with tenant isolation, availability and server-authoritative prices.
- Customer can submit a request and see `awaiting_staff`; the request appears in waiter and POS inboxes.
- Waiter can accept, reject, edit/confirm items, add instructions, and hand the accepted order to the kitchen.
- KDS receives only accepted orders.
- Customer tracking uses scoped, non-guessable access tokens and does not expose arbitrary order IDs or personal details.
- Add rate limits, abuse protection, duplicate-submit protection and operational fallback when cloud connectivity is lost.

**Exit criteria:** end-to-end test from a phone on a different network through QR, waiter approval, POS, KDS and customer tracking.

### Phase 4 — Inventory and purchasing correctness

- Separate stock reservation from actual consumption; define when ingredients are deducted (for example, accepted/preparing) and how cancellation/refund restores stock.
- Make negative stock a per-tenant policy with clear warnings and audit records; never silently permit it by default.
- Validate recipe units and conversions; track batch/expiry where needed.
- Add purchase orders, goods received, supplier invoices/payments, wastage, stock counts and adjustment approvals.
- Ensure every stock movement is idempotent, attributable and auditable.
- Add low-stock and reorder recommendations based on sales velocity, lead time and safety stock.

**Exit criteria:** test scenarios cover concurrent orders, cancellation, partial fulfillment, wastage, receiving stock, unit conversions and offline sync without double deduction.

### Phase 5 — Guest payments and reconciliation

- Keep SaaS subscription billing separate from restaurant guest checkout.
- Select supported payment providers and confirm merchant onboarding, settlement and webhook capabilities.
- Create server-side payment intents/orders bound to tenant, branch, bill and amount.
- Verify signatures against raw payloads; fetch provider-side payment state where required; enforce amount/currency/order matching and idempotency.
- Support UPI, card, cash and split tender according to provider capabilities.
- Reconcile refunds, partial payments, chargebacks and settlement reports.
- Never mark a bill paid from a screenshot, client redirect, or unverified UPI reference.

**Exit criteria:** provider sandbox tests plus controlled live pilot prove success, failure, pending, duplicate webhook, wrong amount, refund and timeout paths.

### Phase 6 — Feedback, reviews and customer experience

- Collect structured feedback on food, ambience, cleanliness and service.
- Generate optional AI-assisted review wording only from the customer's own feedback; customer must review/edit and explicitly choose whether to copy it.
- Offer the same neutral Google review invitation regardless of rating; do not gate, filter or incentivize public reviews.
- Store consent and minimize personal data.
- Add customer history/CRM and loyalty only with clear consent and configurable retention.

**Exit criteria:** consent, privacy, negative feedback, AI failure and customer-edit flows are tested.

### Phase 7 — Aggregator integrations

- Confirm partner eligibility and commercial/technical access before promising live integrations.
- Prefer an approved integration partner or official partner APIs; document certification and operational responsibilities.
- Implement adapters behind a common channel contract, with idempotent ingestion, menu/catalog mapping, accept/reject, prep-time, cancellation and rider updates where supported.
- Keep credentials encrypted and scoped; verify all webhook signatures.
- Make simulated orders visibly test-only.

**Exit criteria:** partner-approved certification or a clearly labelled unavailable/not-yet-connected state; no claims of live integration based only on local test routes.

### Phase 8 — SaaS billing, packaging and scale

- Use one authoritative plan/entitlement catalog for pricing display, billing and runtime feature gates.
- Resolve the current discrepancy between the subscription service's existing plan prices and the proposed commercial launch tiers.
- Model cost per active outlet: infrastructure, storage, messaging, AI, support, onboarding, payment fees and partner fees.
- Track MRR, ARR, churn, activation, retention, failed payments, support load and gross margin from persisted data.
- Add tenant lifecycle, branch provisioning, plan changes, grace periods, cancellation and audit history.
- Start with a small pilot cohort; validate onboarding, support burden and willingness to pay before broad marketing.

**Exit criteria:** a new restaurant can onboard, configure a branch, invite staff, receive a real payment, use core POS offline, sync safely, and be billed with correct entitlements.

## Initial commercial hypothesis (not final pricing)

The working pricing hypothesis discussed separately is monthly per branch, with entry, growth, professional and multi-branch tiers. These are hypotheses to validate with pilot customers, not prices to hard-code before unit economics and feature entitlements are agreed.

Keep hardware, payment-provider fees, aggregator commissions, messaging overages, custom integration and exceptional onsite support separately priced or explicitly passed through.

## Operating rules for implementation

- Never commit production credentials or real customer data.
- Never make changes directly on the default branch.
- Keep each pull request narrowly scoped and include tests and migration/rollback notes.
- Do not silently change existing POS billing, tax, printing or offline behavior.
- Do not claim production readiness until a real end-to-end test has been run in the target deployment.
- Mark each feature as **verified**, **in progress**, **demo-only**, **blocked by partner**, or **not implemented**.

## Decisions required from the product owner

1. **Initial customer segment:** independent restaurants/cafes in Hyderabad and Andhra Pradesh, or restaurant chains from the first release?
2. **QR approval policy:** should every QR order require waiter approval, or can a restaurant enable automatic acceptance?
3. **Guest payment policy:** should QR checkout initially support UPI only, or UPI plus cards and cash recording?
4. **Launch packaging:** should the first 5–10 pilot outlets receive a discounted founding plan in exchange for structured feedback?
5. **Repository execution:** confirm whether implementation may proceed on this feature branch with pull requests, leaving all merges and production deployments for explicit approval.

Until these are answered, use safe defaults: waiter approval required, no automatic stock deduction on an unapproved request, no payment marked successful without provider verification, and no live aggregator claims without partner approval.
