/**
 * Automated Test: D1 Schema Reconciliation Verification
 *
 * Usage: node --experimental-sqlite tests/d1-schema-reconciliation-verification.test.ts
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function main() {
  console.log('Test: Cloud D1 Production Schema Reconciliation Drill');
  console.log('='.repeat(55));

  // 1. Run D1 Rehearsal script and verify zero failures
  const rehearsalOutput = execSync('npm run check:d1-rehearsal', { encoding: 'utf8' });
  assert.match(rehearsalOutput, /A naive replay of 0001–0025 fails closed/);
  assert.match(rehearsalOutput, /Ledger records the proven 0001–0007 baseline/);
  assert.match(rehearsalOutput, /Migrations 0008–0025 apply cleanly on the reconciled baseline/);
  assert.match(rehearsalOutput, /Organization-level membership repair covers every user/);
  assert.match(rehearsalOutput, /D1 reconciliation rehearsal passed/);
  console.log('  ✓ Rehearsal script successfully proved reconciliation strategy');

  // 2. Generate D1 Change Plan and verify output draft artifact
  const planOutput = execSync('npm run plan:d1', { encoding: 'utf8' });
  assert.match(planOutput, /Draft change plan written to docs/);
  console.log('  ✓ D1 Change Plan generator successfully wrote review artifact');

  // 3. Verify D1 draft change plan contains all migrations and verification queries
  const draftPath = path.join(__dirname, '..', 'docs', 'D1_CHANGE_PLAN_DRAFT.md');
  assert(fs.existsSync(draftPath), 'docs/D1_CHANGE_PLAN_DRAFT.md must exist');
  const draftContent = fs.readFileSync(draftPath, 'utf8');
  assert.match(draftContent, /0001_initial_schema\.sql/);
  assert.match(draftContent, /0025_payment_webhook_events\.sql/);
  assert.match(draftContent, /INSERT OR IGNORE INTO d1_migrations/);
  console.log('  ✓ D1 Change plan contains full 0001–0025 migration chain');

  console.log('\nAll D1 Schema Reconciliation verification checks passed!');
}

main();
