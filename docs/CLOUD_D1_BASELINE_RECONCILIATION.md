# Cloud D1 baseline reconciliation

**Target:** production database `orderitup-d1-prod`  
**Last read-only audit:** 2026-11-02 18:09 UTC  
**Status:** Do not apply the checked-in migration chain to production until this reconciliation is reviewed and staged.

**Execution procedure:** [PRODUCTION_RELEASE_RUNBOOK.md](./PRODUCTION_RELEASE_RUNBOOK.md)

## Source change since the audit

The read-only audit below is a **historical snapshot** taken when the checkout contained migrations 0001–0018. The checkout now contains migrations 0019–0025, and neither production nor staging has been re-inspected for them.

- **0019** adds `synced_orders.completed_at` and its branch index for table-turn reporting.
- **0020** creates the restaurant operations tables (vendors, expenses, reservations, ingredients, inventory transactions, recipes, delivery jobs).
- **0021** adds the desktop menu-management columns to the master catalog and category tables.
- **0022** creates the organization customer registry.
- **0023** creates branch-scoped held table orders.

Migrations 0020, 0022 and 0023 are additive tables. 0021 is additive columns. None of them repairs the historical ledger/backfill problems described below, and none should be applied to production until the baseline reconciliation is reviewed. `/ready` now checks the expanded readiness table set (including 0020–0023), so any environment missing them correctly remains not ready for the current source.

Note: the 2026-11-02 audit compared the remote databases against the 18 migrations that existed then. The drift counts below (missing tables/indexes, duplicate-column hazards) are therefore a baseline for the historical schema, not a statement about 0019–0023.

## Current evidence

Run `npm run audit:cloud-d1-schema` with authorized Wrangler access. The command reads SQLite schema metadata plus aggregate counts used to check migration backfills. It does not return row-level business records or write to D1. It exits nonzero when it detects drift.

The 2026-11-02 18:09 UTC audit compared production and staging against the 18 migrations that existed in the checkout at that time and found:

- The remote `d1_migrations` ledger is empty, although the database contains four organizations and multiple later-schema objects.
- The then-current 18-migration schema is missing 16 tables in both production and staging, including subscriptions, pilot requests and invitations, QR capabilities/idempotency, token revocations, payment webhooks, and QR POS delivery.
- `organizations.account_status` and `synced_order_items.product_sku` are absent.
- Nineteen expected indexes are absent.
- Migrations 0002–0005 contain 29 `ADD COLUMN` statements whose target columns already exist remotely. A normal replay will stop at a duplicate-column error.
- The migration 0004 membership backfill is incomplete: four cloud users lack the organization-level membership that migration should have created.
- Staging D1 is readable and its migration ledger records 0001–0007 applied between 2026-10-29 and 2026-10-30. It is missing the schema from 0008–0018. This is a reference point for the historical schema, not proof that production has the same data state.
- Production aggregate checks reported zero rows matching the migration 0005 restaurant/timestamp/completed-order backfill, zero paid orders without a ledger row, and zero migration-0007 cleanup candidates. Production still has four users missing the organization-level membership expected from migration 0004.
- Staging aggregate checks reported three completed orders that are unpaid or unserved and one paid order without a ledger entry. The completed-order predicate reflects a historical migration assumption; order completion and payment are separate states in the current application, so it is informational and is not treated as a missing migration backfill. A targeted read-only check identified the missing-ledger row as `ord-smoke-1793335935435`, a 340 INR cash order dated 2026-10-30 04:52Z. Its only event is a processed `order.created`; there is no payment event or ledger row. This matches the staging smoke test fixture, which had sent a `completed` order for an order-ingestion-only check. The fixture now explicitly sends a pending, unpaid order and must be used on the next staging smoke run. Do not delete or manufacture a financial ledger entry for the existing row without reconciling the smoke-test run and deployed Worker version. Independently, terminal sync now acknowledges exact payment ID/idempotency replays without applying money again, rejects conflicting replays, and lets D1 roll back ledger and order updates together on uniqueness races. Regression coverage verifies replay and collision behavior. The schema audit itself returns only aggregate counts; this one row was inspected separately with a narrowly scoped read-only query.

Migration 0018 adds hashed, expiring pilot account setup invitations. Approved pilot onboarding is verified locally through atomic redemption, owner login, replay rejection and concurrent redemption tests. The production and staging databases do not yet contain this table or its indexes, so the pilot account setup API remains unavailable in either remote environment until the baseline is reconciled and migration 0018 is applied there. Migrations 0019–0025 are likewise unaudited remotely and must be included in the same reconciliation before any deploy.

The current Worker source queries `organizations.account_status` during subscription access resolution. Deploying that source against this schema would fail authenticated organization access unless the schema is repaired first.

The Worker exposes `/ready` as a schema-aware readiness probe. `/health` remains a process liveness check; monitoring should use `/ready` when it needs to know whether the deployed API can serve current database-backed features. The readiness endpoint returns only a generic `DATABASE_SCHEMA_INCOMPLETE` or `DATABASE_UNAVAILABLE` code, not SQL details. The readiness table list now includes migrations 0020–0025, so the probe also proves the operations, menu-parity, customer-registry, held-order, payment-intent and webhook-event tables exist.

## Reconciliation procedure

1. **Keep production writes and deploys paused.** Do not run `wrangler d1 migrations apply` against this database. Do not treat an empty ledger as proof that none of the migrations were applied.
2. **Create and verify a recoverable production backup.** Preserve the backup in the approved secure location and verify it can be restored to an isolated database.
   Before touching production, run `npm run check:d1-rehearsal`. It builds a throwaway database with the audited 0001–0007 baseline, proves a naive replay fails on duplicate columns, then exercises the ledger-baseline + 0008–0025 path and the membership repair. This validates the procedure, not the production data.
3. **Restore production data into an isolated staging D1** or an equivalent test database. Resolve the staging Cloudflare authorization failure and confirm the target database ID before any staging write.
4. **Review every migration from 0001 to 0025 against the restored schema and data.** Start with 0001–0007, which contain the historical schema and data backfills. Check all schema objects, foreign keys, indexes, defaults, and each migration's data effects. In particular, explain the four missing organization memberships and test the migration 0004 repair against the restored copy. Then review the additive migrations 0008–0025 to confirm which objects already exist remotely and which still need to be created.
5. **Prepare an explicit baseline reconciliation for the proven-applied operations only.** Existing columns/tables are not sufficient evidence when a migration has data backfills. Preserve missing operations as pending work. Have a second reviewer check the exact SQL and the `d1_migrations` names that Wrangler will use.
6. **Apply the reconciliation and remaining migrations 0008–0025 only in staging.** Run the schema audit and full Cloud API integration suite against that database. Exercise registration/login, entitlement checks, existing payment/order reads, QR menu/order/approval/tracking, webhook event handling, pilot admin, terminal QR delivery, the restaurant operations suite, menu management/CSV, customers, staff, held orders, mobile session refresh and guest payment intents.
7. **Review a production change plan and rollback.** The plan must state backup ID, schema deltas, data backfills, migration ledger changes, downtime/compatibility behavior, and verification queries. Only then schedule the production write/deploy as a separate, explicitly authorized operation.

## Why no automatic fixer is provided

The checked-in migrations mix schema changes with membership creation, order-state backfills, payment-ledger creation/repair, and platform entitlement initialization. Blindly marking migrations applied could leave authorization or financial history incomplete; replaying them can fail on duplicate columns or repeat data transformations. The audit is intentionally read-only and reports evidence for a reviewed reconciliation rather than guessing which historical operations happened.
