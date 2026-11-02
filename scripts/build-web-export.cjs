const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const frontendDirectory = path.join(repositoryRoot, 'frontend');
const nextCli = require.resolve('next/dist/bin/next', { paths: [frontendDirectory] });

const result = spawnSync(process.execPath, [nextCli, 'build', '--webpack'], {
  cwd: frontendDirectory,
  env: { ...process.env, NEXT_BUILD_MODE: 'web' },
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const qrPage = path.join(frontendDirectory, 'out', 'qr', 'index.html');
if (!fs.existsSync(qrPage)) {
  console.error(`Cloud web export is missing the customer QR route: ${qrPage}`);
  process.exit(1);
}

const html = fs.readFileSync(qrPage, 'utf8');
if (!html.includes('<html') || !html.includes('__next')) {
  console.error(`Cloud web export contains an invalid customer QR document: ${qrPage}`);
  process.exit(1);
}

const outputDirectory = path.join(frontendDirectory, 'out');
const assetReferences = [...html.matchAll(/(?:src|href)="([^"]*?_next\/static\/[^"]+)"/g)]
  .map((match) => match[1]);
if (assetReferences.length === 0) {
  console.error(`Cloud web export has no Next.js assets for the customer QR route: ${qrPage}`);
  process.exit(1);
}

for (const reference of assetReferences) {
  const assetPath = new URL(reference, 'https://static-export.invalid');
  const localAsset = path.resolve(outputDirectory, `.${decodeURIComponent(assetPath.pathname)}`);
  if (!localAsset.startsWith(`${outputDirectory}${path.sep}`) || !fs.existsSync(localAsset)) {
    console.error(`Cloud web export is missing QR page asset ${reference}: ${localAsset}`);
    process.exit(1);
  }
}

console.log(`Cloud web export includes ${path.relative(repositoryRoot, qrPage)} and ${assetReferences.length} local assets`);
