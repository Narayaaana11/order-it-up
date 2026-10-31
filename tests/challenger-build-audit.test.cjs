/**
 * Empirical Adversarial Test Harness for Build Outputs, Static Exports, Assets, and Bundle Health
 * Challenger 1 (teamwork_challenger_r2_1)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;

const ROOT = path.resolve(__dirname, '..');
const LANDING_OUT = path.join(ROOT, 'landing', 'out');
const FRONTEND_OUT = path.join(ROOT, 'frontend', 'out');

console.log('=== STARTING CHALLENGER BUILD AUDIT ===\n');

const auditResults = {
  landing: {},
  frontend: {},
  assets: { missing: [], valid: 0 },
  bundleSize: {},
  secrets: [],
  circularDeps: [],
  issues: []
};

// -------------------------------------------------------------
// Test 1: Verify Prerendered Static Exports
// -------------------------------------------------------------
console.log('--- Test 1: Static Route Verification ---');

// Landing pages
assert(fs.existsSync(LANDING_OUT), 'landing/out does not exist!');
const landingIndex = path.join(LANDING_OUT, 'index.html');
assert(fs.existsSync(landingIndex), 'landing/out/index.html is missing!');
const landingIndexSize = fs.statSync(landingIndex).size;
console.log(`Landing index.html size: ${(landingIndexSize / 1024).toFixed(2)} KB`);
assert(landingIndexSize > 1000, 'landing/out/index.html is unexpectedly small / empty');

// Frontend 34 routes
assert(fs.existsSync(FRONTEND_OUT), 'frontend/out does not exist!');
const expectedFrontendRoutes = [
  '/',
  '/404',
  '/_not-found',
  '/addon-groups',
  '/ai-insights',
  '/auth/login',
  '/auth/recover',
  '/auth/register',
  '/cloud-portal',
  '/customer-display',
  '/customers',
  '/dashboard',
  '/expenses',
  '/inventory',
  '/kds',
  '/kds-standalone',
  '/menu',
  '/online-orders',
  '/order-history-demo',
  '/orders',
  '/pos',
  '/print-test',
  '/products',
  '/qr',
  '/reports',
  '/reservations',
  '/server-standalone',
  '/settings',
  '/setup',
  '/staff',
  '/support',
  '/tables',
  '/whatsapp'
];

let validRouteCount = 0;
for (const r of expectedFrontendRoutes) {
  let target;
  if (r === '/') {
    target = path.join(FRONTEND_OUT, 'index.html');
  } else if (r === '/404') {
    target = path.join(FRONTEND_OUT, '404', 'index.html');
    if (!fs.existsSync(target)) target = path.join(FRONTEND_OUT, '404.html');
  } else {
    target = path.join(FRONTEND_OUT, r.slice(1), 'index.html');
  }

  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    validRouteCount++;
  } else {
    auditResults.issues.push(`Frontend route ${r} missing target file ${target}`);
  }
}
console.log(`Frontend routes verified: ${validRouteCount}/${expectedFrontendRoutes.length}`);
assert.equal(validRouteCount, expectedFrontendRoutes.length, 'Not all expected frontend routes were found in frontend/out');

// -------------------------------------------------------------
// Test 2: Asset Integrity (Scripts, CSS, Images, Fonts)
// -------------------------------------------------------------
console.log('\n--- Test 2: Asset Integrity in HTML Outputs ---');

function checkAssetsInDirectory(outDir, dirLabel) {
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(currentDir, ent.name);
      if (ent.isDirectory()) {
        walk(fullPath);
      } else if (ent.name.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Extract href and src attributes
        const regex = /(?:src|href)=["']([^"']+)["']/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          const rawUrl = match[1];
          if (
            rawUrl.startsWith('http://') ||
            rawUrl.startsWith('https://') ||
            rawUrl.startsWith('#') ||
            rawUrl.startsWith('mailto:') ||
            rawUrl.startsWith('tel:') ||
            rawUrl.startsWith('data:') ||
            rawUrl === '/' ||
            rawUrl === ''
          ) {
            continue;
          }

          const cleanUrl = rawUrl.split('?')[0].split('#')[0];
          let candidate;
          if (cleanUrl.startsWith('/')) {
            candidate = path.join(outDir, cleanUrl.slice(1));
          } else {
            candidate = path.resolve(currentDir, cleanUrl);
          }

          if (fs.existsSync(candidate)) {
            auditResults.assets.valid++;
          } else {
            // Check if it's an internal route link like /orders/
            const asIndex = path.join(candidate, 'index.html');
            const asHtml = candidate.endsWith('.html') ? candidate : candidate + '.html';
            if (fs.existsSync(asIndex) || fs.existsSync(asHtml)) {
              auditResults.assets.valid++;
            } else {
              auditResults.assets.missing.push({
                sourceHtml: path.relative(ROOT, fullPath),
                url: rawUrl,
                resolvedPath: path.relative(ROOT, candidate)
              });
            }
          }
        }
      }
    }
  }
  walk(outDir);
}

checkAssetsInDirectory(LANDING_OUT, 'Landing');
checkAssetsInDirectory(FRONTEND_OUT, 'Frontend');

console.log(`Assets checked: Valid references: ${auditResults.assets.valid}, Missing: ${auditResults.assets.missing.length}`);
if (auditResults.assets.missing.length > 0) {
  console.error('Broken asset references found:', auditResults.assets.missing);
}

// -------------------------------------------------------------
// Test 3: CSS and Fonts Integrity
// -------------------------------------------------------------
console.log('\n--- Test 3: CSS & Theme Integrity ---');

function findCssFiles(baseDir) {
  const cssFiles = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.css')) cssFiles.push({ name: ent.name, path: full, size: ent.size || fs.statSync(full).size });
    }
  }
  walk(baseDir);
  return cssFiles;
}

const landingCssFiles = findCssFiles(path.join(LANDING_OUT, '_next', 'static'));
console.log(`Landing static CSS files: ${landingCssFiles.length} (${landingCssFiles.map(f => f.name).join(', ')})`);
assert(landingCssFiles.length > 0, 'No CSS chunks generated in landing export!');

const frontendCssFiles = findCssFiles(path.join(FRONTEND_OUT, '_next', 'static'));
console.log(`Frontend static CSS files: ${frontendCssFiles.length} (${frontendCssFiles.map(f => f.name).join(', ')})`);
assert(frontendCssFiles.length > 0, 'No CSS chunks generated in frontend export!');

// Verify light theme colors present in compiled landing CSS
let landingHasBrand = false;
let landingHasLightBg = false;
for (const cssFile of landingCssFiles) {
  const css = fs.readFileSync(cssFile.path, 'utf8');
  if (css.includes('240, 121, 40') || css.includes('#f07928') || css.includes('ea580c') || css.includes('f07928')) {
    landingHasBrand = true;
  }
  if (css.includes('248, 250, 252') || css.includes('#f8fafc') || css.includes('f8fafc')) {
    landingHasLightBg = true;
  }
}
console.log(`Landing compiled CSS contains brand orange (#f07928/rgba): ${landingHasBrand}`);
console.log(`Landing compiled CSS contains light neutral canvas (#f8fafc/rgba): ${landingHasLightBg}`);

let frontendHasBrand = false;
let frontendHasLightCanvas = false;
for (const cssFile of frontendCssFiles) {
  const css = fs.readFileSync(cssFile.path, 'utf8');
  if (css.includes('240, 121, 40') || css.includes('#f07928') || css.includes('ea580c') || css.includes('f07928') || css.includes('brand')) {
    frontendHasBrand = true;
  }
  if (css.includes('248, 250, 252') || css.includes('#f8fafc') || css.includes('f8fafc')) {
    frontendHasLightCanvas = true;
  }
}
console.log(`Frontend compiled CSS contains brand tokens: ${frontendHasBrand}`);
console.log(`Frontend compiled CSS contains light neutral canvas: ${frontendHasLightCanvas}`);

// -------------------------------------------------------------
// Test 4: Bundle Health and Chunk Sizes
// -------------------------------------------------------------
console.log('\n--- Test 4: Bundle Size & Chunk Distribution ---');

function analyzeBundle(outDir, name) {
  const chunksDir = path.join(outDir, '_next', 'static', 'chunks');
  const files = fs.readdirSync(chunksDir);
  let totalBytes = 0;
  const chunkDetails = [];

  for (const f of files) {
    const p = path.join(chunksDir, f);
    const stat = fs.statSync(p);
    if (stat.isFile()) {
      totalBytes += stat.size;
      chunkDetails.push({ name: f, sizeKB: (stat.size / 1024).toFixed(1) });
    }
  }

  chunkDetails.sort((a, b) => parseFloat(b.sizeKB) - parseFloat(a.sizeKB));
  console.log(`[${name}] Total chunks: ${chunkDetails.length}, Total raw size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[${name}] Top 5 largest chunks:`);
  for (const c of chunkDetails.slice(0, 5)) {
    console.log(`  - ${c.name}: ${c.sizeKB} KB`);
  }

  // Check for abnormally large individual chunks (>2.5 MB)
  const hugeChunks = chunkDetails.filter(c => parseFloat(c.sizeKB) > 2500);
  if (hugeChunks.length > 0) {
    console.warn(`[${name}] Warning: Found chunks > 2.5MB:`, hugeChunks);
  }
}

analyzeBundle(LANDING_OUT, 'Landing');
analyzeBundle(FRONTEND_OUT, 'Frontend');

// -------------------------------------------------------------
// Test 5: Secret Leak Detection & Sensitive Data Scan
// -------------------------------------------------------------
console.log('\n--- Test 5: Secret Leak and Environment Variable Scan ---');

const sensitivePatterns = [
  /(?:private_key|api[_-]?secret|password|db_pass|aws_secret|token_secret)\s*[:=]\s*["'][A-Za-z0-9_\-+/]{10,}["']/i,
  /BEGIN (?:RSA |EC )?PRIVATE KEY/,
  /ghp_[A-Za-z0-9]{36}/,
  /AIza[0-9A-Za-z-_]{35}/, // Google API Key
  /sk-[A-Za-z0-9]{32,}/    // OpenAI style API Key
];

function scanDirectoryForSecrets(dir, label) {
  let scannedFiles = 0;
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(current, ent.name);
      if (ent.isDirectory()) {
        walk(fullPath);
      } else if (ent.name.endsWith('.js') || ent.name.endsWith('.json') || ent.name.endsWith('.html')) {
        scannedFiles++;
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of sensitivePatterns) {
          const match = content.match(pattern);
          if (match) {
            auditResults.secrets.push({
              bundle: label,
              file: path.relative(ROOT, fullPath),
              matched: match[0].slice(0, 25) + '...'
            });
          }
        }
      }
    }
  }
  walk(dir);
  console.log(`[${label}] Scanned ${scannedFiles} static export files for secrets.`);
}

scanDirectoryForSecrets(path.join(LANDING_OUT, '_next'), 'Landing');
scanDirectoryForSecrets(path.join(FRONTEND_OUT, '_next'), 'Frontend');

console.log(`Secret leak matches: ${auditResults.secrets.length}`);
if (auditResults.secrets.length > 0) {
  console.error('CRITICAL: Possible secret leaks detected in client bundles:', auditResults.secrets);
} else {
  console.log('✅ No secret leaks detected in client bundles.');
}

// -------------------------------------------------------------
// Test 6: Circular Dependencies and Import Validation
// -------------------------------------------------------------
console.log('\n--- Test 6: Import and Module Resolution Validation ---');

// Check landing/src components imports
function checkSourceImports(srcDir, label) {
  let brokenImports = 0;
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(current, ent.name);
      if (ent.isDirectory()) {
        walk(fullPath);
      } else if (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const importMatches = content.matchAll(/import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]/g);
        for (const m of importMatches) {
          const imp = m[1];
          // Check relative imports
          if (imp.startsWith('.')) {
            const resolvedBase = path.resolve(current, imp);
            const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
            const exists = possibleExtensions.some(ext => fs.existsSync(resolvedBase + ext));
            if (!exists) {
              auditResults.issues.push(`[${label}] Broken relative import "${imp}" in ${path.relative(ROOT, fullPath)}`);
              brokenImports++;
            }
          }
        }
      }
    }
  }
  walk(srcDir);
  console.log(`[${label}] Verified all relative imports in ${srcDir}. Broken: ${brokenImports}`);
}

checkSourceImports(path.join(ROOT, 'landing', 'src'), 'Landing');
checkSourceImports(path.join(ROOT, 'frontend', 'src', 'app', '(dashboard)'), 'Dashboard');
checkSourceImports(path.join(ROOT, 'frontend', 'src', 'app', 'cloud-portal'), 'CloudPortal');

console.log('\n=== AUDIT SUMMARY ===');
console.log(`Total Issues Found: ${auditResults.issues.length}`);
if (auditResults.issues.length > 0) {
  console.log('Issues list:', auditResults.issues);
}
console.log('=== TEST HARNESS COMPLETE ===');
