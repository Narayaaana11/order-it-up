#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = new Set(process.argv.slice(2));
const failFast = args.has('--fail-fast');

const rootDir = path.resolve(__dirname, '..');
const suitesPath = path.join(rootDir, 'scripts', 'test-suites.json');
const pkgPath = path.join(rootDir, 'package.json');

const suites = JSON.parse(fs.readFileSync(suitesPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!Array.isArray(suites) || suites.length === 0) {
  console.error('[test-runner] scripts/test-suites.json must be a non-empty array of suite names.');
  process.exit(2);
}

const scripts = pkg.scripts || {};
const missing = suites.filter((suite) => typeof suite !== 'string' || !(suite in scripts));
if (missing.length > 0) {
  console.error(`[test-runner] Unknown suite(s) in scripts/test-suites.json: ${missing.join(', ')}`);
  process.exit(2);
}

const runTestScript = path.join(rootDir, 'tests', 'run-test.cjs');
let passed = 0;
const failed = [];

for (let i = 0; i < suites.length; i++) {
  const suite = suites[i];
  console.log(`\n=== [${i + 1}/${suites.length}] ${suite} ===`);
  const result = spawnSync(process.execPath, [runTestScript, 'npm', 'run', suite], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error || result.signal || result.status !== 0) {
    console.error(`[${i + 1}/${suites.length}] FAIL ${suite}`);
    failed.push(suite);
    if (failFast) break;
  } else {
    console.log(`[${i + 1}/${suites.length}] PASS ${suite}`);
    passed++;
  }
}

console.log(`\n[test-runner] Summary: ${passed}/${suites.length} passed, ${failed.length} failed`);
if (failed.length > 0) {
  console.error(`[test-runner] Failed suites (${failed.length}): ${failed.join(', ')}`);
  process.exit(1);
}

process.exit(0);
