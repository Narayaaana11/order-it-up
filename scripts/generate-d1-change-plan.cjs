#!/usr/bin/env node
/**
 * Generates a DRAFT production D1 change plan from the checked-in migrations.
 *
 * The output is a review artifact, not an executable release. It contains the
 * exact ledger names, read-only verification queries and rollback placeholders
 * that must be filled in and approved before any authorized production run.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'apps', 'cloud-api', 'migrations');
const outputPath = path.join(root, 'docs', 'D1_CHANGE_PLAN_DRAFT.md');

const migrations = fs.readdirSync(migrationsDir)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const baseline = migrations.filter((name) => Number(name.slice(0, 4)) <= 7);
const remaining = migrations.filter((name) => Number(name.slice(0, 4)) > 7);

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch { /* not a git checkout */ }

const readinessTables = [
  'organizations', 'branches', 'cloud_users', 'terminals', 'pairing_tokens', 'master_categories',
  'master_products', 'branch_product_overrides', 'synced_orders', 'synced_order_items',
  'synced_cash_closures', 'inventory_transfers', 'rate_limits', 'sync_events', 'restaurants',
  'memberships', 'dining_tables', 'kitchen_tickets', 'customer_payments', 'saas_plans',
  'organization_subscriptions', 'subscription_events', 'platform_admin_audit_log',
  'cloud_token_revocations', 'qr_table_tokens', 'qr_order_tracking_tokens', 'master_addon_groups',
  'master_addons', 'master_product_addon_groups', 'qr_order_idempotency', 'pilot_access_requests',
  'saas_subscription_payment_orders', 'saas_payment_webhook_events', 'qr_order_pos_deliveries',
  'pilot_access_invitations', 'restaurant_vendors', 'expense_categories', 'expenses',
  'reservations', 'ingredients', 'inventory_transactions', 'recipes', 'delivery_jobs',
  'customers', 'held_orders', 'payment_intents', 'payment_webhook_events',
];

const ledgerLines = baseline.map((name) => `INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${name}');`).join('\n');
const tableList = readinessTables.map((name) => `'${name}'`).join(', ');
const remainingList = remaining.map((name) => `- \`${name}\``).join('\n');

const document = `# D1 production change plan — DRAFT (not authorized)

**Generated:** ${new Date().toISOString()}  
**Source commit:** \`${commit}\`  
**Status:** PREPARED ONLY. Do not run any statement below against production until this plan is filled in, reviewed by a second person, and explicitly authorized.  
**Companion:** [PRODUCTION_RELEASE_RUNBOOK.md](./PRODUCTION_RELEASE_RUNBOOK.md), [CLOUD_D1_BASELINE_RECONCILIATION.md](./CLOUD_D1_BASELINE_RECONCILIATION.md)

## 1. Release identity (fill in)

| Field | Value |
|---|---|
| Release owner | ____________________ |
| Second reviewer | ____________________ |
| Target database | \`orderitup-d1-prod\` / id \`145d0618-ed44-42ce-8209-658ad2bcc2fd\` |
| Worker version to deploy after migration | ____________________ |
| Backup / Time Travel bookmark ID | ____________________ |
| Restore verified on isolated copy | ☐ yes — by ____________________ |
| Staging migration completed | ☐ yes — date ____________________ |
| Go/no-go decision | ☐ approved / ☐ rejected |

## 2. Baseline evidence (review every row)

The audit found a schema at roughly 0001–0007 with an **empty ledger**. Each row must be evidenced against the restored copy before its ledger entry is inserted; a table existing is not proof that a migration's data backfill ran.

| Migration | Evidence reviewed | Decision |
|---|---|---|
${baseline.map((name) => `| \`${name}\` | ____________________ | ☐ baseline / ☐ apply |`).join('\n')}

Run \`npm run check:d1-rehearsal\` before this table is signed. It proves the procedure on a synthetic legacy database and proves a naive replay fails on duplicate columns.

## 3. Proposed ledger baseline (review only)

Only for migrations proven to have run. Adjust the list to match the evidence table.

\`\`\`sql
${ledgerLines}
\`\`\`

## 4. Membership repair evidence (read-only first)

The audit reports four users without the organization-level membership expected from migration 0004.

\`\`\`sql
SELECT u.id, u.email, u.role, u.created_at
FROM cloud_users u
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m
  WHERE m.organization_id = u.organization_id
    AND m.user_id = u.id
    AND m.status = 'active'
);
\`\`\`

Do not blindly insert memberships. Record the role decision for each account with the product owner, then write explicit inserts like the commented example below.

\`\`\`sql
-- INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
-- SELECT 'reconcile-' || id, organization_id, id, NULL, NULL, '<approved-role>', 'active', datetime('now'), datetime('now')
-- FROM cloud_users WHERE id = '<approved-user-id>';
\`\`\`

## 5. Apply remaining migrations (staging first)

After the ledger baseline and repair are applied to the restored staging copy:

\`\`\`powershell
npx wrangler d1 migrations list orderitup-d1-prod --remote
npx wrangler d1 migrations apply orderitup-d1-prod --remote
\`\`\`

Remaining migrations in this release:

${remainingList}

## 6. Verification queries (run after migration, before Worker deploy)

\`\`\`sql
-- Ledger reaches the release head
SELECT COUNT(*) AS applied, MAX(name) AS latest FROM d1_migrations;

-- Every readiness table exists
SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${tableList})
ORDER BY name;
-- Expect ${readinessTables.length} rows.

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
\`\`\`

Then deploy the Worker and require \`GET /ready\` to return 200 \`{"status":"ready"}\`.

## 7. Rollback

- **D1:** restore the Time Travel bookmark \`____________________\` or the exported backup \`____________________\`. A schema rollback is a reviewed migration, never an ad-hoc \`DROP\`.
- **Worker:** \`npx wrangler rollback <deployment-id>\` to the recorded previous version \`____________________\`.
- **Pages:** re-publish the previous successful deployment.
- **Stop condition:** any verification query failing, any unexpected duplicate-column error, or a membership decision that cannot be approved.

## 8. Post-change evidence (attach)

- [ ] Backup ID and restore verification
- [ ] Staging migration log and verification output
- [ ] Production migration output
- [ ] \`/ready\` response
- [ ] Post-deploy acceptance checklist from the release runbook
`;

fs.writeFileSync(outputPath, document, 'utf8');
console.log(`Draft change plan written to ${path.relative(root, outputPath)} (${migrations.length} migrations, ${readinessTables.length} readiness tables).`);
console.log('This is a review artifact; nothing was executed against production.');
