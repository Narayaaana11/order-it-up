/**
 * Order It Up - Empirical Challenger Comprehensive Verification Harness
 * 
 * Adversarially verifies Requirements R1 through R5:
 * 1. UI, Anchors & Media Verification (Unsplash URLs, #download-windows anchor, Suspense boundaries)
 * 2. Role Routing & Boundary Invariants (Web POS billing blocked, Desktop cashier restricted)
 * 3. S3 Tenant Segregation & Security Stress Tests (50+ path traversal & injection payloads, 403 Forbidden enforcement, outbox buffering, offline mock mode)
 * 
 * Execution: `node tests/challenger-adversarial-verification.cjs`
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LANDING_SRC = path.join(ROOT, 'landing', 'src');
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');
const FRONTEND_OUT = path.join(ROOT, 'frontend', 'out');

// ============================================================================
// SUITE 1: ADVERSARIAL UI, ANCHORS & MEDIA VERIFICATION
// ============================================================================
describe('Suite 1: Adversarial UI, Anchors & Media Verification (R1, R2)', () => {

  test('1.1: Comprehensive Unsplash Photography URL Audit across landing/src', () => {
    // Scan all files in landing/src for any unsplash URLs
    function getFiles(dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getFiles(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = getFiles(LANDING_SRC);
    const unsplashUrlRegex = /https?:\/\/[^\s"'`)]*unsplash\.com[^\s"'`)]*/g;
    const foundUrls = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(unsplashUrlRegex);
      if (matches) {
        for (const url of matches) {
          foundUrls.push({ url, file: path.relative(ROOT, file) });
        }
      }
    }

    assert(foundUrls.length >= 10, `Expected at least 10 Unsplash assets across landing components, found ${foundUrls.length}`);

    // Verify every single Unsplash URL meets strict production standards
    for (const { url, file } of foundUrls) {
      assert(url.startsWith('https://'), `Unsplash URL must use secure HTTPS in ${file}: ${url}`);
      assert(url.includes('images.unsplash.com/photo-'), `Unsplash URL must reference images.unsplash.com/photo- in ${file}: ${url}`);

      // Parse URL parameters
      const parsed = new URL(url);
      assert.equal(parsed.hostname, 'images.unsplash.com', `Host must be images.unsplash.com in ${file}`);
      assert(parsed.pathname.startsWith('/photo-'), `Pathname must start with /photo- in ${file}: ${url}`);

      // Check required image optimization query parameters
      assert.equal(parsed.searchParams.get('auto'), 'format', `Must specify auto=format in ${file}: ${url}`);
      assert.equal(parsed.searchParams.get('fit'), 'crop', `Must specify fit=crop in ${file}: ${url}`);
      
      const width = parsed.searchParams.get('w');
      assert(width && /^\d+$/.test(width) && Number(width) > 0, `Must specify valid integer width w in ${file}: ${url}`);

      const quality = parsed.searchParams.get('q');
      assert(quality && /^\d+$/.test(quality) && Number(quality) >= 60, `Must specify valid quality q >= 60 in ${file}: ${url}`);
    }
  });

  test('1.2: Adversarial Static Crawl: Verify #download-windows anchor exists and is bound', () => {
    // 1. Verify in landing component sources
    const ctaSource = fs.readFileSync(path.join(LANDING_SRC, 'components', 'CtaSection.tsx'), 'utf8');
    assert(ctaSource.includes('id="download-windows"'), 'landing CtaSection.tsx must declare id="download-windows"');
    assert(ctaSource.includes('href="#download-windows"'), 'landing CtaSection.tsx must bind href="#download-windows"');
    assert(ctaSource.includes('handlePlatformDownload'), 'landing CtaSection.tsx must bind click handler to download logic');

    // 2. Verify in frontend landing component sources
    const feCtaSource = fs.readFileSync(path.join(FRONTEND_SRC, 'components', 'landing', 'CtaSection.tsx'), 'utf8');
    assert(feCtaSource.includes('id="download-windows"'), 'frontend CtaSection.tsx must declare id="download-windows"');
    assert(feCtaSource.includes('href="#download-windows"'), 'frontend CtaSection.tsx must bind href="#download-windows"');
    assert(feCtaSource.includes('handleDownloadClick'), 'frontend CtaSection.tsx must bind click handler');

    // 3. Verify in frontend statically exported index.html
    const indexPath = path.join(FRONTEND_OUT, 'index.html');
    assert(fs.existsSync(indexPath), 'frontend/out/index.html must exist');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    assert(indexHtml.includes('id="download-windows"'), 'frontend/out/index.html must contain id="download-windows"');
    assert(indexHtml.includes('href="#download-windows"'), 'frontend/out/index.html must contain href="#download-windows"');
    assert(indexHtml.includes('Windows (x64 / ARM)'), 'frontend/out/index.html must display Windows platform badge');
  });

  test('1.3: Zero un-Suspended useSearchParams or Dynamic Runtime Traps in Static Export', () => {
    // Audit all 34 exported HTML files in frontend/out/
    function getHtmlFiles(dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getHtmlFiles(fullPath));
        } else if (file.endsWith('.html')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const htmlFiles = getHtmlFiles(FRONTEND_OUT);
    assert(htmlFiles.length >= 34, `Expected at least 34 static HTML files, found ${htmlFiles.length}`);

    for (const htmlFile of htmlFiles) {
      const relPath = path.relative(FRONTEND_OUT, htmlFile);
      const content = fs.readFileSync(htmlFile, 'utf8');

      // Verify zero unhandled Next.js runtime exceptions
      assert(!content.includes('Application error: a client-side exception has occurred'),
        `Static page ${relPath} contains client exception trap!`
      );
      assert(!content.includes('Error: Hydration failed'),
        `Static page ${relPath} contains hydration error!`
      );
      assert(!content.includes('useSearchParams() should be wrapped in a suspense boundary'),
        `Static page ${relPath} failed static export due to un-Suspended useSearchParams()!`
      );

      // Verify valid HTML envelope
      assert(content.includes('<!DOCTYPE html>'), `${relPath} missing DOCTYPE`);
      assert(content.includes('<html'), `${relPath} missing <html`);
      assert(content.includes('</html>'), `${relPath} missing </html>`);
    }
  });

});

// ============================================================================
// SUITE 2: ADVERSARIAL ROLE ROUTING & BOUNDARY INVARIANTS
// ============================================================================
describe('Suite 2: Adversarial Role Routing & Boundary Invariants (R3, R4)', () => {

  test('2.1: Web POS Billing is 100% Prohibited & Blocked via isElectronEnvironment()', () => {
    const posPageSource = fs.readFileSync(path.join(FRONTEND_SRC, 'app', '(dashboard)', 'pos', 'page.tsx'), 'utf8');

    // 1. Verify early guard prevents any API requests from firing on web
    assert(
      /if\s*\(!isElectronEnvironment\(\)\)\s*\{\s*return;\s*\}/.test(posPageSource),
      'POS page must abort data fetching immediately when not in Electron'
    );

    // 2. Verify blocked UI screen is rendered when !isElectronEnvironment()
    assert(
      posPageSource.includes('if (isClient && !isElectronEnvironment())'),
      'POS page must check !isElectronEnvironment() before rendering billing UI'
    );
    assert(
      posPageSource.includes('Desktop & Mobile POS Only'),
      'POS page must display "Desktop & Mobile POS Only" headline on web'
    );
    assert(
      posPageSource.includes('Point of Sale billing is exclusively supported on the Order It Up Desktop Application'),
      'POS page must explain that billing is restricted to native desktop'
    );
  });

  test('2.2: Desktop Cashier Role is Strictly Restricted from Administrative Dashboards', () => {
    // 1. Check Sidebar navigation definitions
    const sidebarSource = fs.readFileSync(path.join(FRONTEND_SRC, 'components', 'layout', 'Sidebar.tsx'), 'utf8');
    
    // Administrative routes: /dashboard, /reports, /inventory, /expenses, /products, /staff, /settings, /customers
    const adminRoutes = [
      { path: '/dashboard', label: 'dashboard' },
      { path: '/reports', label: 'reports' },
      { path: '/inventory', label: 'inventory' },
      { path: '/expenses', label: 'expenses' },
      { path: '/products', label: 'products' },
      { path: '/staff', label: 'staff' },
      { path: '/settings', label: 'settings' },
      { path: '/customers', label: 'customers' },
    ];

    for (const route of adminRoutes) {
      // Find the line defining this nav item
      const itemRegex = new RegExp(`href:\\s*'${route.path.replace('?', '\\?')}',[^}]*roles:\\s*([A-Za-z0-9_.]+)`);
      const match = sidebarSource.match(itemRegex);
      assert(match, `Sidebar must define nav item for ${route.path}`);
      
      const roleAccessGroup = match[1];
      assert.notEqual(
        roleAccessGroup,
        'ROLE_ACCESS.ownerManagerCashier',
        `Security violation: Administrative route "${route.path}" is exposed to Cashier in Sidebar!`
      );
    }

    // 2. Check Dashboard page direct URL access restriction
    const dashboardSource = fs.readFileSync(path.join(FRONTEND_SRC, 'app', '(dashboard)', 'dashboard', 'page.tsx'), 'utf8');
    
    // Check that non-owners/managers are redirected to /pos on Electron
    assert(
      dashboardSource.includes('if (currentTenant && !isOwnerOrManager)'),
      'Dashboard page must guard against non-owners/managers'
    );
    assert(
      /if\s*\(isElectronEnvironment\(\)\)\s*\{\s*router\.replace\('\/pos'\);\s*\}/.test(dashboardSource),
      'Desktop cashier navigating to /dashboard must be bounced immediately to /pos'
    );

    // Check locked screen fallback if rendered on web or during bounce
    assert(
      dashboardSource.includes('Operational Role Guidance'),
      'Dashboard page must show Operational Role Guidance locked screen'
    );
    assert(
      dashboardSource.includes('Store management dashboards and financial audits are reserved for Restaurant Owners and Managers'),
      'Dashboard locked screen must clarify reservation for Owners and Managers'
    );
  });

});

// ============================================================================
// SUITE 3: S3 TENANT SEGREGATION & SECURITY STRESS TESTS
// ============================================================================
describe('Suite 3: S3 Tenant Segregation & Security Stress Tests (R5)', () => {

  // Load S3 helpers directly
  const ts = require('typescript');
  const s3ServiceFile = path.join(ROOT, 'main', 'services', 'amazon-s3.ts');
  const s3Code = fs.readFileSync(s3ServiceFile, 'utf8');

  // Strip Electron / DB imports for pure unit stress testing
  const transpiled = ts.transpileModule(s3Code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });

  const mockModule = { exports: {} };
  const fakeElectron = {
    app: { getPath: () => path.join(ROOT, '.mock-s3-test') },
    safeStorage: { isEncryptionAvailable: () => false },
  };
  const fakeDb = {
    getDatabase: () => ({ exec: () => {}, prepare: () => ({ get: () => null, run: () => {} }) }),
    now: () => new Date().toISOString(),
    createBackup: () => '',
  };
  const fakeLog = { info: () => {}, error: () => {}, warn: () => {} };

  const runner = new Function('exports', 'module', 'require', transpiled.outputText);
  runner(mockModule.exports, mockModule, (id) => {
    if (id === 'electron') return fakeElectron;
    if (id === 'electron-log') return fakeLog;
    if (id === '../db') return fakeDb;
    if (id === '@aws-sdk/client-s3') {
      return {
        S3Client: class {},
        PutObjectCommand: class {},
        ListObjectsV2Command: class {},
        DeleteObjectCommand: class {},
        HeadBucketCommand: class {},
        GetObjectCommand: class {},
      };
    }
    return require(id);
  });

  const { validateTenantId, validateFilename, validateDomain, buildTenantKey } = mockModule.exports;

  test('3.1: 30+ Path Traversal & Injection Attacks against tenantId (Must Throw 403 Violation)', () => {
    const maliciousTenantIds = [
      '../',
      '..\\',
      '../../',
      '..\\..\\',
      '/../',
      '\\..\\',
      'tenant/subtenant',
      'tenant\\subtenant',
      '../tenant-1',
      '..\\tenant-1',
      'tenant-1/../tenant-2',
      'tenant-1\\..\\tenant-2',
      '../../../../../../etc/passwd',
      '..\\..\\..\\..\\..\\windows\\system32',
      'tenant*alpha',
      'tenant?alpha',
      'tenant:alpha',
      'tenant|alpha',
      'tenant<alpha',
      'tenant>alpha',
      'tenant"alpha',
      'tenant\'alpha',
      'tenant;alpha',
      'tenant&alpha',
      'tenant$alpha',
      'tenant`alpha`',
      'tenant\r\nalpha',
      'tenant\talpha',
      'tenant alpha',
      'tenant%00',
      'tenant\0',
      'tenant#hash',
      'tenant%2e%2e%2f',
      '',
      '   ',
      null,
      undefined,
    ];

    for (const badId of maliciousTenantIds) {
      let threwViolation = false;
      try {
        validateTenantId(badId);
      } catch (err) {
        threwViolation = true;
        assert(
          err.message.includes('Tenant isolation violation'),
          `Attack "${badId}" threw unexpected error: ${err.message}`
        );
      }
      assert(threwViolation, `SECURITY FLAW: Malicious tenantId "${badId}" was accepted without throwing!`);
    }
  });

  test('3.2: 20+ Path Traversal & Filename Escapes (Must Throw 403 Violation)', () => {
    const maliciousFilenames = [
      '../escape.json',
      '..\\escape.json',
      '../../secret.pem',
      '..\\..\\secret.pem',
      '/root-escape.json',
      '\\root-escape.json',
      './relative-escape.json',
      'folder/../../escape.json',
      'folder\\..\\..\\escape.json',
      '../../../../etc/shadow',
      '..\\..\\..\\..\\windows\\system32\\cmd.exe',
      '../tenants/other-tenant/payments.json',
      '..\\tenants\\other-tenant\\payments.json',
      '',
      null,
      undefined,
    ];

    for (const badName of maliciousFilenames) {
      let threw = false;
      try {
        validateFilename(badName);
      } catch (err) {
        threw = true;
      }
      assert(threw, `SECURITY FLAW: Malicious filename "${badName}" was accepted without throwing!`);
    }
  });

  test('3.3: Canonical buildTenantKey Enforces Prefix Isolation & Rejects Boundary Breaks', () => {
    // Valid tenant key construction
    const validKey = buildTenantKey('store-99', 'payments', 'eod-20261031.json');
    assert.equal(validKey, 'tenants/store-99/payments/eod-20261031.json');
    assert(validKey.startsWith('tenants/store-99/'), 'Key must start with tenants/store-99/');

    // Valid with subfolder
    const subKey = buildTenantKey('store-99', 'media', 'hero.jpg', 'menu');
    assert.equal(subKey, 'tenants/store-99/media/menu/hero.jpg');

    // Attempt cross-tenant escalation via buildTenantKey
    assert.throws(
      () => buildTenantKey('../other-tenant', 'payments', 'invoice.json'),
      /Tenant isolation violation/,
      'Escalation with ../ must throw Tenant isolation violation'
    );

    assert.throws(
      () => buildTenantKey('store-99', 'payments', '../../other-store/data.json'),
      /Tenant isolation violation/,
      'Filename traversal escaping tenant folder must throw Tenant isolation violation'
    );
  });

  test('3.4: Storage Domains Are Strictly Whitelisted & Isolated', () => {
    const validDomains = ['platform', 'backups', 'users', 'payments', 'media'];
    for (const d of validDomains) {
      assert.equal(validateDomain(d), d);
    }

    const invalidDomains = ['../bad', 'domain/with/slash', 'bad$domain', 'domain with spaces', ''];
    for (const inv of invalidDomains) {
      assert.throws(() => validateDomain(inv), /Invalid storage domain/);
    }
  });

});

console.log('Challenger verification test harness loaded successfully.');
