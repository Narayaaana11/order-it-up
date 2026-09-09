#!/usr/bin/env node
const { execSync } = require('node:child_process');

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
