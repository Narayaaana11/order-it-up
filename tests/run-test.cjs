#!/usr/bin/env node
/**
 * Cross-platform test execution wrapper for Order It Up.
 * Replaces or accompanies tests/run-test.sh to run seamlessly on Windows, macOS, and Linux.
 *
 * Runs a test command and treats exit code 77 (ABI mismatch / GNU skip convention) as success (exit 0).
 *
 * Usage:
 *   node tests/run-test.cjs npm run test:smoke
 */

'use strict';

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node tests/run-test.cjs <test command> [args...]');
  process.exit(2);
}

const command = args[0];
const cmdArgs = args.slice(1);

const result = spawnSync(command, cmdArgs, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

// Exit code 77 is GNU standard for "skipped" test (e.g. ABI mismatch)
if (result.status === 77) {
  console.log('   Skipped (ABI mismatch)');
  process.exit(0);
}

process.exit(result.status ?? 1);
