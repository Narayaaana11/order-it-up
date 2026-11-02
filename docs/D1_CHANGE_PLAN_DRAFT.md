# D1 production change plan — DRAFT (not authorized)

**Generated:** 2026-11-02T21:50:49.404Z  
**Source commit:** `c379408`  
**Status:** PREPARED ONLY. Do not run any statement below against production until this plan is filled in, reviewed by a second person, and explicitly authorized.  
**Companion:** [PRODUCTION_RELEASE_RUNBOOK.md](./PRODUCTION_RELEASE_RUNBOOK.md), [CLOUD_D1_BASELINE_RECONCILIATION.md](./CLOUD_D1_BASELINE_RECONCILIATION.md)

## 1. Release identity (fill in)

| Field | Value |
|---|---|
| Release owner | ____________________ |
| Second reviewer | ____________________ |
| Target database | `orderitup-d1-prod` / id `145d0618-ed44-42ce-8209-658ad2bcc2fd` |
| Worker version to deploy after migration | ____________________ |
| Backup / Time Travel bookmark ID | ____________________ |
| Restore verified on isolated copy | ☐ yes — by ____________________ |
| Staging migration completed | ☐ yes — date ____________________ |
| Go/no-go decision | ☐ approved / ☐ rejected |

## 2. Baseline evidence (review every row)

The audit found a schema at roughly 0001–0007 with an **empty ledger**. Each row must be evidenced against the restored copy before its ledger entry is inserted; a table existing is not proof that a migration's data backfill ran.

| Migration | Evidence reviewed | Decision |
|---|---|---|
| `0001_initial_schema.sql` | ____________________ | ☐ baseline / ☐ apply |
| `0002_rate_limits_and_pairing.sql` | ____________________ | ☐ baseline / ☐ apply |
| `0003_sync_integrity_and_idempotency.sql` | ____________________ | ☐ baseline / ☐ apply |
| `0004_restaurant_hierarchy_and_memberships.sql` | ____________________ | ☐ baseline / ☐ apply |
| `0005_shared_operations_tables_and_kitchen.sql` | ____________________ | ☐ baseline / ☐ apply |
| `0006_customer_payment_ledger.sql` | ____________________ | ☐ baseline / ☐ apply |
| `0007_repair_legacy_payments_and_financial_integrity.sql` | ____________________ | ☐ baseline / ☐ apply |

Run `npm run check:d1-rehearsal` before this table is signed. It proves the procedure on a synthetic legacy database and proves a naive replay fails on duplicate columns.

## 3. Proposed ledger baseline (review only)

Only for migrations proven to have run. Adjust the list to match the evidence table.

```sql
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_initial_schema.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_rate_limits_and_pairing.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0003_sync_integrity_and_idempotency.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0004_restaurant_hierarchy_and_memberships.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_shared_operations_tables_and_kitchen.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0006_customer_payment_ledger.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0007_repair_legacy_payments_and_financial_integrity.sql');
```

## 4. Membership repair evidence (read-only first)

The audit reports four users without the organization-level membership expected from migration 0004.

```sql
SELECT u.id, u.email, u.role, u.created_at
FROM cloud_users u
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m
  WHERE m.organization_id = u.organization_id
    AND m.user_id = u.id
    AND m.status = 'active'
);
```

Do not blindly insert memberships. Record the role decision for each account with the product owner, then write explicit inserts like the commented example below.

```sql
-- INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
-- SELECT 'reconcile-' || id, organization_id, id, NULL, NULL, '<approved-role>', 'active', datetime('now'), datetime('now')
-- FROM cloud_users WHERE id = '<approved-user-id>';
```

## 5. Apply remaining migrations (staging first)

After the ledger baseline and repair are applied to the restored staging copy:

```powershell
npx wrangler d1 migrations list orderitup-d1-prod --remote
npx wrangler d1 migrations apply orderitup-d1-prod --remote
```

Remaining migrations in this release:

- `0008_saas_subscription_and_platform_admin.sql`
- `0009_subscription_grace_periods.sql`
- `0010_cloud_token_revocations.sql`
- `0011_public_qr_ordering.sql`
- `0012_cloud_catalog_modifiers.sql`
- `0013_qr_order_idempotency.sql`
- `0014_pilot_access_requests.sql`
- `0015_saas_subscription_payment_orders.sql`
- `0016_saas_payment_webhook_inbox.sql`
- `0017_cloud_qr_pos_delivery.sql`
- `0018_pilot_access_invitations.sql`
- `0019_synced_order_completion_time.sql`
- `0020_restaurant_operations_suite.sql`
- `0021_cloud_menu_management_parity.sql`
- `0022_cloud_customer_registry.sql`
- `0023_held_orders.sql`
- `0024_guest_payment_intents.sql`
- `0025_payment_webhook_events.sql`

## 6. Verification queries (run after migration, before Worker deploy)

```sql
-- Ledger reaches the release head
SELECT COUNT(*) AS applied, MAX(name) AS latest FROM d1_migrations;

-- Every readiness table exists
SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('organizations', 'branches', 'cloud_users', 'terminals', 'pairing_tokens', 'master_categories', 'master_products', 'branch_product_overrides', 'synced_orders', 'synced_order_items', 'synced_cash_closures', 'inventory_transfers', 'rate_limits', 'sync_events', 'restaurants', 'memberships', 'dining_tables', 'kitchen_tickets', 'customer_payments', 'saas_plans', 'organization_subscriptions', 'subscription_events', 'platform_admin_audit_log', 'cloud_token_revocations', 'qr_table_tokens', 'qr_order_tracking_tokens', 'master_addon_groups', 'master_addons', 'master_product_addon_groups', 'qr_order_idempotency', 'pilot_access_requests', 'saas_subscription_payment_orders', 'saas_payment_webhook_events', 'qr_order_pos_deliveries', 'pilot_access_invitations', 'restaurant_vendors', 'expense_categories', 'expenses', 'reservations', 'ingredients', 'inventory_transactions', 'recipes', 'delivery_jobs', 'customers', 'held_orders', 'payment_intents', 'payment_webhook_events')
ORDER BY name;
-- Expect 47 rows.

-- Required columns
SELECT account_status FROM organizations LIMIT 0;
SELECT product_sku FROM synced_order_items LIMIT 0;
SELECT completed_at FROM synced_orders LIMIT 0;

-- No orphaned users remain
SELECT COUNT(*) AS orphaned FROM cloud_users u
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m
  WHERE m.organization_id = u.organization_id AND m.user_id = u.id AND m.status = 'active'
);
```

Then deploy the Worker and require `GET /ready` to return 200 `{"status":"ready"}`.

## 7. Rollback

- **D1:** restore the Time Travel bookmark `____________________` or the exported backup `____________________`. A schema rollback is a reviewed migration, never an ad-hoc `DROP`.
- **Worker:** `npx wrangler rollback <deployment-id>` to the recorded previous version `____________________`.
- **Pages:** re-publish the previous successful deployment.
- **Stop condition:** any verification query failing, any unexpected duplicate-column error, or a membership decision that cannot be approved.

## 8. Post-change evidence (attach)

- [ ] Backup ID and restore verification
- [ ] Staging migration log and verification output
- [ ] Production migration output
- [ ] `/ready` response
- [ ] Post-deploy acceptance checklist from the release runbook
