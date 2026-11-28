const { spawn } = require('child_process');
const electronPath = require('electron');

const child = spawn(electronPath, ['dev-server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  console.log(`[dev-daemon] Process exited with code ${code}, signal ${signal}`);
  process.exit(code ?? (signal ? 1 : 0));
});

child.on('error', (err) => {
  console.error('[dev-daemon] Spawn error:', err);
  process.exit(1);
});
