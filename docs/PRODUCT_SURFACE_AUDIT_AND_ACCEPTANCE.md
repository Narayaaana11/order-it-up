# Order It Up product surface audit and acceptance plan

**Audit date:** 2026-11-03  
**Repository:** `Narayaaana11/order-it-up`  
**Audit base:** `origin/main` at `07f6d3f` (includes the changes previously on `feat/pilot-access-and-admin-inbox`)  
**Scope:** desktop POS, public QR, cloud and landing dashboards, Android/mobile, restaurant roles, integrations, security, and the requested React tablet POS.  
**Deployment:** intentionally out of scope for this work phase; production deployment follows product completion and verification.

## Product surfaces found in the repository

| Surface | Current implementation | Evidence and gap |
|---|---|---|
| Desktop POS | Electron + Express + SQLite backend in `main/`; Next.js/React renderer in `frontend/`. This is the offline-first system of record for the desktop installation. | Real local order, billing, inventory, printing, users, KDS, and reporting routes exist. The Electron renderer also contains native-only behavior, so a WebView cannot be assumed to have printer, cash drawer, backup, or updater capabilities. |
| QR customer ordering | Static Next.js route in `frontend/src/app/qr`; Cloud Worker and D1 routes implement public menu/order/tracking and delivery to paired POS terminals. | Source and focused integration tests exist. Live Pages QR route and live Worker readiness were unavailable in the last network audit; this document does not treat source as a deployed system. |
| Landing site and merchant role dashboards | Next.js/React app in `landing/`. The public preview uses `dashboard-store.ts` with seeded demo data. Authenticated restaurant users now enter a separate Cloud-backed workspace for waiter/cashier order creation, kitchen tickets, cash settlement, owner/manager order metrics, and accountant tax summary. | The preview is explicitly labeled demo-only. The authenticated workspace uses branch-scoped Cloud routes and server-side permissions; delivery dispatch, inventory, reservations, expenses, advanced analytics, receipts, and provider-backed tenders still need implementation. |
| Cloud SaaS API | Cloudflare Worker/D1 routes cover authentication, tenant/branch membership, orders, customer payment ledger, tables, kitchen tickets, analytics overview, catalog/modifiers, accountant summaries/exports, inventory transfers, QR, and platform administration. | This is a substantial API baseline, but it is not a complete Cloud mirror of the local POS domain. No verified Cloud equivalents were found for the full desktop staff, guest/bill, stock ledger, reservations, expenses, delivery-dispatch, and device/hardware workflows. |
| Existing mobile app | Flutter app in `mobile/`, responsive breakpoints, role screens for waiter, cashier, chef/KDS, manager, inventory, CRM, reporting, and other operations. The normal app connects to the restaurant server; demo mode uses `MockDataService`. | Do not infer production parity from screen count. Verify each action against its API provider. Mock credentials/data must remain isolated to explicit demo mode. The user additionally requests a React-based Android tablet POS that reuses the desktop UI. |
| Requested Android tablet POS | A React tablet route and Capacitor Android project now reuse the existing POS product grid, cart, and modifier picker. The route loads Cloud branches/catalog/tables, submits priced orders, queues takeaway orders in local storage while offline, and can record auditable cash payments for authorized cashiers. | The static export succeeds. The Android Gradle project was generated and synced, but a local APK build could not run because this machine has no Android SDK (`ANDROID_HOME`/`sdk.dir` missing). CI now has a dedicated Android debug-build job. The localStorage outbox is not a durable database; secure native session storage, conflict recovery, device tests, peripherals, partial tender UX, and wider role parity remain open. |

## Product workflows and completion criteria

### Cashier and counter POS

1. Authenticate as a cashier and load the authorized branch, live catalog, modifiers, prices, tax policy, tables, and payment methods.
2. Build a cart, scan a barcode, attach a table/customer, apply authorized discounts, and preserve the draft across navigation/retry.
3. Submit once with an idempotency key; the server calculates totals and inventory movements.
4. Record cash, card, UPI, split tender, or provider-backed payment. External methods require authoritative provider/terminal evidence; the UI must not mark a payment paid from a client checkbox or fabricated reference.
5. Print the correct receipt/KOT where hardware is available; show a truthful fallback otherwise.
6. Reconcile bills, refunds, cash closure, and inventory with an auditable timeline.

### Waiter and floor operations

1. Sign in under a waiter/server role and load only assigned/authorized branches and tables.
2. View live table state, seat guests, create or add to an order, select modifiers, and send the request to kitchen.
3. Track preparation and ready/served state; request bill and hand off to cashier.
4. Handle duplicate submissions and network loss without duplicate orders or lost drafts.
5. Verify a second device sees the same order and table transitions.

### Kitchen / KDS

1. Show only accepted kitchen tickets and the correct station items.
2. Update pending → preparing → ready → served with role and branch authorization, timestamps, and idempotent retries.
3. Refresh/poll or receive push updates without losing a ticket during temporary connectivity loss.
4. Keep kitchen display legible and usable on large touch screens; keyboard/bump input is optional but supported where available.

### Owner and manager

1. Read real branch-scoped sales, outstanding payments, order throughput, and inventory metrics from persisted data.
2. Manage staff roles, branch membership, catalog, modifiers, availability, tables, discounts, stock policy, and settings through audited server APIs.
3. Distinguish unavailable data from zero values; never substitute seeded/sample sales in a live account.
4. Generate backups, close shifts, reconcile transfers, and review access/security events.

### Accountant

1. Read cash closures, tax summaries, refunds, payment ledger, and reconciliation by branch/business date/timezone.
2. Export tax/Tally data from server-authoritative persisted values, with stable repeatable exports.
3. See source, totals, and unresolved discrepancies; do not synthesize GST or financial totals from demo constants.

### Delivery and online order operations

1. Ingest orders from a provider only after signature, tenant/branch, and duplicate validation.
2. Show dispatch/rider status and order address only to authorized roles.
3. Record handoff, delivery, cancellation, COD collection, and settlement as auditable transitions.
4. Keep integrations explicitly “not connected” until partner credentials, certification, and signed live callbacks are verified.

### Customer QR ordering

1. Resolve a revocable per-table capability server-side; never trust a table ID supplied by the browser.
2. Fetch live branch catalog and modifiers/prices, submit an idempotent request, and show only scoped order tracking.
3. Wait for staff approval before kitchen acceptance, occupancy, and stock movement.
4. Validate cross-network flow from a phone, retry behavior, rate limits, privacy, and recovery if the restaurant is offline.

### Platform admin and pilot onboarding

1. Keep platform admin authentication and tenant data separate from restaurant identities.
2. Review pilot access requests, issue expiring single-use setup links, provision accounts atomically, and capture an audit event.
3. Operate SaaS subscriptions from persisted plans and payment webhook records; distinguish event receipt from provider settlement.
4. Verify all of this against the deployed Worker and reconciled D1 schema before live onboarding.

## Specific gaps to close before claiming all dashboards work end to end

1. **Authenticated landing operations are now role-aware, but not complete.** `landing/src/components/dashboard/CloudOperationsWorkspace.tsx` now renders role-scoped tabs for the floor and table state, reservations, kitchen tickets, cashier settlement plus shift close, inventory with an audited stock ledger, expenses, delivery dispatch, and owner/accountant reports, all through dated Cloud APIs. Receipt printing, provider-verified card/UPI tenders, split payments, vendor statements, and a few owner workflows (purchase orders, stock counts, staff scheduling) remain open.
2. **Cloud API coverage now includes the restaurant operations suite and menu management.** Migration `0020_restaurant_operations_suite.sql` adds vendors, expense categories and expenses, reservations, ingredients, inventory transactions, recipes, and delivery jobs. Migration `0021_cloud_menu_management_parity.sql` extends the master catalog with the desktop product fields (description, cost, sale unit, tax metadata, cashback, stock, tags, image), and `apps/cloud-api/src/routes/catalog-admin.ts` serves the desktop-compatible `/products` and `/categories` CRUD contract, including modifier links and category delete/reassign rules. Routes enforce active memberships and organization scope; stock adjustments, reservations, and delivery transitions enforce role permissions and state machines. Staff scheduling, purchase orders, and provider-backed payments still have no Cloud model.
3. **The main Next.js dashboard uses Cloud-backed report routes.** The Worker now serves daily stats, date summaries, ledger-backed financial summaries, top products, recent orders, and owner insights. Requests are gated by `advancedReports` and branch memberships, and date windows use the organization's IANA timezone. Cloud now persists order completion timestamps for direct status changes and sync events, so average table-turn time can be calculated from completed dine-in orders. New-customer acquisition now comes from the Cloud customer registry, scoped to customers with orders in the caller's authorized branches; it is not estimated from order names. The retryable unavailable state remains for API errors.
4. **React tablet POS routing and packaging were corrected, and a waiter station was added.** The cashier POS now lives at `/tablet-pos` with a dedicated full-screen layout, matching the path the Capacitor app already redirects to. `/tablet-waiter` is a floor-first waiter app that reuses the same Cloud catalog, cart, modifier picker and table model; it opens an order on a table and appends rounds through the versioned `/api/orders/:id/items` endpoint. After login the shared Android shell routes cashier/owner/manager sessions to the POS and server/waiter/host sessions to the waiter station. `tablet-android/capacitor.config.ts` pins `server.appStartPath` to `/tablet-pos/index.html`; previously the packaged WebView opened the marketing landing page because Capacitor serves `index.html` for extension-less paths. `npm run build:web` now fails closed when either exported route is missing. The APK still needs an Android SDK build and real tablet verification. Secure native session storage, release signing, and hardware support remain open.
5. **Tablet POS is not yet an offline-first peer.** Browser-mode `frontend/src/lib/api.ts` targets Cloud API; Electron-mode targets the local Express API. The tablet has an explicitly labeled localStorage outbox for takeaway orders and idempotent Cloud submission, but lacks a durable database, safe multi-device conflict resolution, and verified restart/recovery semantics.
6. **Native tablet peripherals need adapters.** Electron printing, cash drawer, backup/restore, and update controls are not automatically available to Capacitor. Specify and implement supported Bluetooth/network/USB printer and barcode paths; gate unsupported hardware actions rather than showing a false success.
7. **Role coverage exists in Flutter but parity is unproven.** Compare every Flutter provider method with its live API implementation. Remove any implicit demo authentication fallback in non-demo mode and test waiter, cashier, chef, owner, inventory, reports, reservations, online orders, and CRM workflows against a real local API fixture.
8. **Cross-app data ownership needs one contract.** Desktop SQLite is the offline POS authority; Cloud D1 is the coordination/control plane. Define IDs, branch scope, versions, idempotency, deleted/disabled semantics, conflict policy, and sync acknowledgements before adding two-way catalog or order flows.
9. **Repository docs are stale/inconsistent.** The production readiness plan baseline was refreshed to reflect PR #35 being merged. Its historical deployment and readiness claims still require a current environment and D1 check before a release decision.

## Tablet architecture research and decision

- The existing UI is already React 19 in a Next.js static-export-capable frontend. Reusing its components is the most direct way to keep the tablet POS visually and behaviorally aligned with desktop.
- Capacitor documents that it can be added to an existing modern JavaScript app and packages web code for Android while exposing native device APIs through plugins. A thin container is appropriate; app behavior should remain in the shared React product code.
- The existing Next config uses `output: 'export'` for web/desktop. Next's static export supports client-side data fetching but excludes server-only runtime features and API routes; the tablet must call authenticated APIs directly and cannot rely on a Next server running inside the APK.
- Android adaptive guidance expects layouts to respond to window size/orientation and large-screen interaction. The tablet UI should support portrait/landscape, resized windows, touch targets, keyboard/mouse/stylus, and multi-window behavior rather than merely scaling a phone view.
- Capacitor wrapper alone does not provide database/offline parity, secure token storage, receipt printing, cash drawer control, or scanner support. Each requires an explicit supported implementation and device-level verification.

### Technical references

- [React components and reuse](https://react.dev/learn/your-first-component)
- [Capacitor overview](https://capacitorjs.com/docs)
- [Capacitor installation for existing web apps](https://capacitorjs.com/docs/getting-started)
- [Capacitor native plugins](https://capacitorjs.com/docs/plugins)
- [Next.js static export: supported and unsupported features](https://nextjs.org/docs/app/guides/static-exports)
- [Android adaptive app quality guidelines](https://developer.android.com/docs/quality-guidelines/adaptive-app-quality)
- [Android adaptive app guidance](https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps)

## Recommended implementation sequence (before production work)

1. Establish live-vs-demo contracts and remove all sample-data fallbacks from signed-in production screens.
2. Expand Cloud operational schema/routes to cover the role workflows that do not yet exist remotely; test authorization, branch isolation, idempotency, and transaction rollback at the Worker boundary.
3. Wire landing merchant dashboards to those live APIs, keeping a visibly labeled, isolated preview mode for prospective customers.
4. Extend the React tablet POS scaffold with secure session storage, durable offline data, complete tender/split-payment UI, kitchen lifecycle, native peripherals, and device verification.
5. Add native peripheral adapters and complete the Flutter/API parity audit; add cross-device end-to-end tests for waiter → POS → kitchen → cashier → accounting.
6. Only after all role acceptance tests pass, reconcile remote D1, provision production credentials/domains, deploy, and verify the real pilot flow.

## Audit limits

This is a source/configuration and documentation audit, supported by code-path inspection and primary platform documentation. It does not certify every screen, provider integration, legal obligation, security control, Android device, or remote deployment. Automated tests and live device/backend runs must be tied to each acceptance criterion before calling a workflow complete.

## Work completed in this pass

- Added the shared React tablet route and Capacitor Android wrapper; static export, Capacitor add/sync, frontend TypeScript check, Cloud API TypeScript check, and the focused transaction/payment integration suite passed.
- Added catalog modifier validation for both initial orders and added order items; server catalog prices and required/quantity rules remain authoritative.
- Added cash payment capture in the tablet open-order panel with a persisted idempotency key, server balance lookup, and completion transition after full payment.
- Added an Android debug build job to CI. A local APK build was attempted but stopped because no Android SDK is installed; CI/device verification has not yet run.
- Added an authenticated landing Cloud workspace for waiter/cashier order entry, kitchen ticket transitions, auditable cash settlement, owner/manager live order metrics, and accountant tax data. The M3 landing dashboard regression suite passed after updating two stale assertions to match current audited platform-admin controls.
- Removed fabricated sales, product, staff, and recent-order figures from the main React dashboard; report failures now clear the view and expose a retry action. Frontend production export passed; the repo-wide ESLint command exits successfully with existing warnings, and the focused dashboard file lint has no errors (one existing React effect warning remains).
- Added Cloud report endpoints consumed by the React owner dashboard, with role checks, authorized branch filtering, organization-timezone day windows, ledger-based payment/refund reporting, and subscription feature gating. The focused report test runs the complete Cloud migration chain in SQLite and invokes both the report handler and authenticated Worker route; it verifies real SQL results, date bounds, invalid dates, and cross-branch denial.
- Added Cloud order completion timestamps through migration 0019, direct order completion, and terminal sync. The API readiness check now requires the new column, and the owner dashboard derives table-turn time only from this authoritative completion event.
- Added Cloud D1 migration `0020_restaurant_operations_suite.sql` and `apps/cloud-api/src/routes/restaurant-ops.ts`: vendors, expense categories/expenses with void-not-delete auditing, reservations with a state machine and table occupancy, raw-ingredient inventory with an idempotent movement ledger, recipe costing, shift cash closure with persisted variance, and delivery dispatch with assignment/handoff and COD collection confirmation.
- The new `tests/cloud-restaurant-ops.test.ts` suite runs the full migration chain and verifies role denial, branch isolation, reservation overlap/capacity, stock idempotency and non-negative stock, recipe COGS, shift window/variance math, and delivery transitions. It passes, along with Cloud API TypeScript, the cloud auth suite, the 9-part Cloud E2E audit, and the migration compatibility suite.
- Added a provider-neutral guest payment flow (migration 0024 + `routes/guest-payments.ts`): capability discovery, server-created provider intents, signature verification, provider-side capture/amount/currency/order checks, idempotency, and a `gateway_verified` ledger write. A signed `POST /api/webhooks/razorpay-payments` callback (migration 0025) settles the intent even if the client disconnects, with event dedupe and provider re-verification. It fails closed with `PAYMENT_PROVIDER_NOT_CONFIGURED` without live keys. `tests/cloud-guest-payments.test.ts` covers capabilities, denial, idempotency, captured/signature/amount failures, webhook settlement/replay, and that failed verifications never write the ledger.
- Added a production non-cash tender guard: when `REQUIRE_PROVIDER_VERIFIED_NONCASH=true` (set for production/staging in `wrangler.toml`), `POST /api/orders/:id/payments` rejects card/UPI recorded by a cashier with `PROVIDER_VERIFICATION_REQUIRED`; cash remains recordable. This closes the fabricated-reference path until a server-verified guest payment provider flow exists. Covered in the restaurant-ops suite.
- Desktop release path verified locally: backend TypeScript build, desktop renderer export, Electron runtime verification, release-artifact naming, and `electron-builder --dir` packaging all pass (Electron 43.4.1, unpacked Windows app produced). The GitHub release workflow family is missing from this checkout, so `test:release-config` fails and signed installers/auto-update must not be claimed until those workflows are re-authored.
- Web navigation now hides desktop/LAN-only surfaces (`/settings`, `/whatsapp`, `/ai-insights`, `/online-orders`) in Cloud mode via `frontend/src/lib/cloud-surface.ts`, so signed-in web users no longer land on dashboards that call missing local endpoints. The desktop shell keeps them. Covered by `tests/cloud-surface-navigation.test.ts`; the order table was also switched to logical direction utilities, fixing a pre-existing RTL regression.
- Added mobile compatibility routes (`apps/cloud-api/src/routes/mobile-compat.ts`): `POST /api/auth/refresh` rotates a valid staff session for seven days after revocation/inactive checks, `/api/cash-closures` maps the Flutter cashier contract (counted cents, mobile closure shape) onto the Cloud shift closure, migration 0023 adds branch-scoped held orders with `GET/POST/DELETE /api/held-orders`, `/api/crm/lookup` resolves customers by phone, and `/api/reports` returns the mobile financial summary plus top products. Kitchen ticket status accepts the mobile/KDS vocabulary (`waiting` → `pending`, `served` → `completed`), and the Flutter client maps Cloud states back for display. `npm run check:mobile-cloud` statically classifies all 35 mobile endpoints as Cloud, local-only or partner-gated (see `MOBILE_CLOUD_SURFACE_MATRIX.md`) and fails on unclassified drift. `tests/cloud-mobile-compat.test.ts` verifies refresh, revoked/inactive rejection, permissions, variance, mapping, KDS aliases, held-order lifecycle, CRM lookup and reports.
- Added Cloud menu CSV support (`apps/cloud-api/src/routes/menu-csv.ts`): templates, category/product/modifier exports and imports for the product dashboard, with quoted-cell parsing, row limits, per-row errors, formula-injection escaping, and owner/manager-only access. `tests/cloud-menu-csv.test.ts` verifies templates, round-trip export, category/product/modifier imports, and validation failures.
- Added Cloud staff management (`apps/cloud-api/src/routes/staff.ts`): the desktop `/staff` contract now lists, creates, edits, password-resets and deactivates restaurant users against `cloud_users` + `memberships`. Owner protections block self-deactivation, last-owner demotion, manager-owned edits, and manager-granted owner access; role changes rewrite the membership Cloud authorization reads. `tests/cloud-staff.test.ts` exercises a real password login before/after reset and deactivation.
- Owner reporting now derives new-customer acquisition from the Cloud customer registry, scoped to customers with orders in the caller's authorized branches, instead of returning a permanent em dash. The report regression suite seeds a customer and asserts the count.
- Added Cloud D1 migration `0022_cloud_customer_registry.sql` and `apps/cloud-api/src/routes/customers.ts`: organization-scoped customer CRUD, phone search, spend/visit aggregates derived from persisted orders, and a wallet endpoint whose spend/bill history is real while loyalty points remain explicitly zero because Cloud has no accrual engine. `tests/cloud-customers.test.ts` verifies duplicates, search, partial updates, aggregates, and tenant isolation.
- Extended Cloud table management to the desktop contract: `PUT /api/tables/:id`, `POST /api/tables/:id/deactivate|reactivate`, and `include_inactive=1` for the management screen, with occupied-table protection and branch authorization. The web `/tables` dashboard now lists inactive tables so they can be reactivated. Covered in the restaurant-ops suite.
- Added Cloud D1 migration `0021_cloud_menu_management_parity.sql` and `apps/cloud-api/src/routes/catalog-admin.ts`, so the existing product/category dashboard screens run against D1: desktop-compatible product fields, category CRUD with reassign/delete-all rules, modifier-group links, tenant isolation, and owner/manager-only writes. `tests/cloud-catalog-admin.test.ts` verifies the contract and passes.
- Rebuilt the authenticated landing workspace as role-scoped tabs (floor, reservations, kitchen, cashier + shift close, inventory, expenses, delivery, reports) backed only by persisted Cloud data. The existing browser E2E now passes for waiter → kitchen → cashier → accountant, and the production landing build succeeds.
- Moved the React tablet POS to `/tablet-pos` with a dedicated full-screen layout, added it to web navigation, pinned the Capacitor start path to the exported POS document, and made the web export fail closed if that route is missing. `npm run build:web` and the frontend TypeScript check pass.
- Added `/tablet-waiter`, a floor-first React waiter station that shares the Cloud catalog, cart, modifier picker and table model with the POS, opens an order on a selected table, and appends rounds through the versioned order-items endpoint. Extracted the Cloud row mappers into `frontend/src/lib/cloud-pos-mappers.ts`, routed the Android shell by role, and extended the Cloud integration test to cover the waiter round and stale-version conflict. Both routes are present in the static export.
- Extended `CloudRole` and JWT validation to `delivery` and `host` so those operational roles can authenticate instead of being rejected at token creation.
- The landing delivery, receipt printing, provider-backed tender verification, and the remaining Flutter/API parity auditing are still incomplete; the rest of the audit gaps above remain outstanding. This pass does not complete the full product or authorize production deployment.
