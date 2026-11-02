#!/usr/bin/env node
/**
 * Pre-deployment release-input check for the Order It Up Cloud API.
 *
 * Verifies the repository inputs that a Cloudflare release depends on:
 * migration numbering/completeness, readiness tables, Wrangler config safety,
 * and the presence of the verification scripts. It performs no network calls
 * and changes nothing. Live D1/Worker state still requires the reviewed
 * reconciliation and post-deploy checks in docs/PRODUCTION_RELEASE_RUNBOOK.md.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'apps', 'cloud-api', 'migrations');
const indexFile = path.join(root, 'apps', 'cloud-api', 'src', 'index.ts');
const wranglerFile = path.join(root, 'apps', 'cloud-api', 'wrangler.toml');
const rootPackage = path.join(root, 'package.json');

const failures = [];
const warnings = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function warn(message) {
  warnings.push(message);
}

// ── Migrations ──────────────────────────────────────────────────────────────
const migrationFiles = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const numbered = migrationFiles.filter((name) => /^\d{4}_.+\.sql$/.test(name));
check('Migration files follow NNNN_name.sql', numbered.length === migrationFiles.length,
  `${migrationFiles.length - numbered.length} malformed file(s)`);

const numbers = numbered.map((name) => Number(name.slice(0, 4)));
const unique = new Set(numbers);
check('Migration numbers are unique', unique.size === numbers.length);

numbers.forEach((value, index) => {
  check(`Migration ${String(value).padStart(4, '0')} is contiguous`, value === index + 1,
    `expected ${String(index + 1).padStart(4, '0')}`);
});

const sql = migrationFiles.map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8')).join('\n');
const createdTables = new Set([...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z0-9_]+)/gi)].map((match) => match[1].toLowerCase()));

const indexSource = fs.readFileSync(indexFile, 'utf8');
const readinessMatch = indexSource.match(/const REQUIRED_READINESS_TABLES = \[([\s\S]*?)\] as const;/);
check('REQUIRED_READINESS_TABLES is present', Boolean(readinessMatch));
const readinessTables = readinessMatch
  ? [...readinessMatch[1].matchAll(/'([a-z0-9_]+)'/gi)].map((match) => match[1].toLowerCase())
  : [];
const missingTables = readinessTables.filter((table) => !createdTables.has(table));
check('Every readiness table is created by a migration', missingTables.length === 0, missingTables.join(', '));

// ── Wrangler configuration ─────────────────────────────────────────────────
const wrangler = fs.readFileSync(wranglerFile, 'utf8');
const wranglerCode = wrangler.split('\n').map((line) => line.replace(/#.*/, '')).join('\n');
check('Worker name is configured', /^\s*name\s*=\s*"[^"]+"/m.test(wrangler));
check('Worker main entry exists', (() => {
  const main = wrangler.match(/^\s*main\s*=\s*"([^"]+)"/m)?.[1];
  return Boolean(main) && fs.existsSync(path.join(root, 'apps', 'cloud-api', main));
})());
check('D1 binding DB is configured', /\[\[d1_databases\]\][\s\S]*?binding\s*=\s*"DB"/m.test(wrangler));
check('Production environment is explicit', /ENVIRONMENT\s*=\s*"production"/.test(wrangler));
check('Self-service registration is closed', /ALLOW_SELF_SERVICE_REGISTRATION\s*=\s*"false"/.test(wrangler));
check('Production CORS allowlist has no wildcard', (() => {
  const origin = wrangler.match(/FRONTEND_ORIGIN\s*=\s*"([^"]*)"/)?.[1] || '';
  return origin.length > 0 && !origin.split(',').map((value) => value.trim()).includes('*');
})());
check('Staging environment is isolated', /\[env\.staging\]/.test(wrangler) && /orderitup-d1-staging/.test(wrangler));
check('No secrets committed in wrangler.toml', !/(JWT_SECRET|PLATFORM_ADMIN_PASSWORD_HASH|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET)\s*=/.test(wranglerCode));

// ── Repository safety ──────────────────────────────────────────────────────
const devVars = path.join(root, 'apps', 'cloud-api', '.dev.vars');
if (fs.existsSync(devVars)) warn('apps/cloud-api/.dev.vars exists; confirm it is ignored and never committed.');

const pkg = JSON.parse(fs.readFileSync(rootPackage, 'utf8'));
for (const script of ['verify:cloud', 'check:cloud-worker', 'build:web', 'check:cloud-release']) {
  check(`npm script ${script} is defined`, typeof pkg.scripts?.[script] === 'string');
}

// ── Report ─────────────────────────────────────────────────────────────────
for (const entry of checks) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? ` (${entry.detail})` : ''}`);
}
for (const message of warnings) console.log(`WARN  ${message}`);
console.log(`\n${checks.filter((entry) => entry.ok).length}/${checks.length} release-input checks passed.`);
if (failures.length > 0) {
  console.error(`\nRelease inputs are not ready:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Repository release inputs are consistent. Live D1/Worker/Pages checks still require docs/PRODUCTION_RELEASE_RUNBOOK.md.');
}
