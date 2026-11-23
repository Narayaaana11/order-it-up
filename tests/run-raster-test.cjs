const { spawnSync } = require('node:child_process');
const path = require('node:path');
const electronPath = require('electron');

const isLinux = process.platform === 'linux';
const hasDisplay = Boolean(process.env.DISPLAY);
const needsXvfb = isLinux && !hasDisplay;

const testScript = path.resolve(__dirname, 'raster-renderer-electron.test.cjs');

const env = { ...process.env };
// Ensure Electron runs as GUI app, not plain Node.js
delete env.ELECTRON_RUN_AS_NODE;

let command = electronPath;
let args = [testScript];

if (needsXvfb) {
  command = 'xvfb-run';
  args = ['-a', electronPath, '--no-sandbox', testScript];
}

console.log(`[run-raster-test] Executing ${command} with script: ${testScript}`);
const res = spawnSync(command, args, {
  stdio: 'inherit',
  env,
  timeout: 120_000,
});

if (res.error) {
  console.error('[run-raster-test] Spawn error:', res.error);
  process.exit(1);
}

process.exit(res.status ?? 0);
