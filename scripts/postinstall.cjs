#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// 1. Run install-electron
try {
  execSync('npx install-electron', { stdio: 'inherit' });
} catch (err) {
  console.warn('[postinstall] install-electron skipped or completed with warnings.');
}

// 2. Attempt electron-builder install-app-deps (best-effort; fallback to bundled prebuilds)
try {
  execSync('npx electron-builder install-app-deps', { stdio: 'inherit' });
} catch (err) {
  console.log('[postinstall] Note: Native rebuild skipped (using prebuilt better-sqlite3 binaries).');
}

// 3. Verify electron runtime
try {
  execSync('node scripts/verify-electron-runtime.cjs', { stdio: 'inherit' });
} catch (err) {
  console.warn('[postinstall] verify-electron-runtime warning:', err.message);
}

// 4. Ensure isolated standalone backend dependencies are installed with Node.js ABI
const backendSqliteDir = path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3');
if (!fs.existsSync(backendSqliteDir)) {
  try {
    execSync('npm --prefix backend install --no-audit --no-fund', { stdio: 'inherit' });
  } catch (err) {
    console.warn('[postinstall] backend dependency install warning:', err.message);
  }
}
