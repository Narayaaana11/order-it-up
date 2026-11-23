#!/usr/bin/env node
/**
 * d1:verify - CI / pre-flight verifier
 * Ensures that the production D1 reconciliation requirements are satisfied
 * and that forward migrations 0008-0025 apply cleanly without schema drift.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

console.log('🔍 Running D1 production schema & migration ledger verification...');

// 1. Verify that the reconciliation report and draft plan exist
const docPath = path.join(__dirname, '../docs/D1_CHANGE_PLAN_DRAFT.md');
if (!fs.existsSync(docPath)) {
  console.error('❌ docs/D1_CHANGE_PLAN_DRAFT.md missing');
  process.exit(1);
}

// 2. Run the isolated reconciliation rehearsal
try {
  const output = execSync('node scripts/rehearse-d1-reconciliation.cjs', { encoding: 'utf8' });
  if (!output.includes('D1 reconciliation rehearsal passed.')) {
    console.error('❌ D1 rehearsal did not produce expected success marker.');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Failed executing rehearse-d1-reconciliation.cjs:', err.message);
  process.exit(1);
}

// 3. Verify D1 health test harness
try {
  execSync('node tests/run-electron-node-test.cjs tests/d1-schema-reconciliation-verification.test.ts', { stdio: 'inherit' });
} catch (err) {
  console.error('❌ d1-schema-reconciliation-verification.test.ts failed');
  process.exit(1);
}

console.log('✅ d1:verify passed: D1 schema migrations are verified on an isolated baseline.');
