# Order It Up — Production Readiness Master Plan

**Status:** Working plan  
**Repository:** `Narayaaana11/order-it-up`  
**Planning baseline:** Repository inspection on 2026-11-02  
**Branch:** `production-readiness/phase-1-hardening`

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

## Verified findings from the inspected source

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

## Implementation status — 2026-11-02

### Phase 1 security hardening — implemented on `security/phase-1-hardening`, pending CI review

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
- [ ] CI, lint and build results still need to be confirmed.
- [ ] Production deployment secrets must be provisioned and any previously exposed credentials rotated before enabling central admin or aggregator webhooks.
- [ ] Demo authentication in the separate marketing landing app still requires a production-mode review; it must not be treated as a real identity provider.

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
