#!/usr/bin/env node
/**
 * Tablet/Android wrapper hardening checks.
 *
 * The Capacitor APK keeps its Cloud session token in WebView storage, so device
 * backups and cleartext traffic must stay disabled. It must also open the
 * exported tablet POS route rather than the marketing landing page.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'tablet-android', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const capacitorPath = path.join(root, 'tablet-android', 'capacitor.config.ts');

const failures = [];
function check(name, condition, detail = '') {
  if (condition) console.log(`PASS  ${name}`);
  else {
    console.error(`FAIL  ${name}${detail ? ` (${detail})` : ''}`);
    failures.push(name);
  }
}

const manifest = fs.readFileSync(manifestPath, 'utf8');
check('INTERNET permission is declared', /android\.permission\.INTERNET/.test(manifest));
check('app data backup is disabled', /android:allowBackup="false"/.test(manifest), 'allowBackup must be false');
check('full backup content is disabled', /android:fullBackupContent="false"/.test(manifest));
check('cleartext traffic is disabled', /android:usesCleartextTraffic="false"/.test(manifest), 'Cloud and checkout are HTTPS-only');
check('launcher activity is exported', /android:exported="true"/.test(manifest));

const capacitor = fs.readFileSync(capacitorPath, 'utf8');
check('app id is the tablet POS package', /appId:\s*'com\.orderitup\.tabletpos'/.test(capacitor));
check('web assets point at the frontend export', /webDir:\s*'\.\.\/frontend\/out'/.test(capacitor));
check('start path targets the exported POS document', /appStartPath:\s*'\/tablet-pos\/index\.html'/.test(capacitor));
check('Android scheme is https', /androidScheme:\s*'https'/.test(capacitor));

if (failures.length > 0) {
  console.error(`\nTablet Android hardening is incomplete: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('\nTablet Android wrapper hardening passed.');
}
