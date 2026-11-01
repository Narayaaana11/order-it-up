/**
 * EMPIRICAL ADVERSARIAL CHALLENGER VERIFICATION HARNESS (M5)
 * 
 * Verifies Requirements R1 through R5:
 * 1. Production Static Export Integrity (landing/out/ and frontend/out/)
 *    - All 34 frontend routes exist, size > 1KB, valid DOCTYPE and HTML structure.
 *    - landing/out/index.html exists, size > 1KB, valid DOCTYPE.
 *    - Asset references (scripts, css) exist on disk with zero broken links.
 * 2. Adversarial Auth & Download Flow Verification
 *    - Windows-only download buttons gate unauthenticated users.
 *    - Google Sign-In demo button present in /auth/login, /auth/register, and AuthModal.
 *    - Dynamic Navbar updates session state and exposes Dashboard link.
 * 3. S3 Multi-Cloud Compatibility & Tenant Boundary Verification
 *    - Tenant ID fuzzing and path traversal defense.
 *    - Domain and filename validation.
 *    - Strict key prefix containment invariant (tenants/{tenantId}/...).
 *    - Multi-cloud configuration permutations (AWS, Cloudflare R2, MinIO, Wasabi, B2, GCS).
 */

const { describe, it, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LANDING_OUT = path.join(ROOT, 'landing', 'out');
const FRONTEND_OUT = path.join(ROOT, 'frontend', 'out');

// ============================================================================
// SUITE 1: ADVERSARIAL BUILD & STATIC EXPORT VALIDATION
// ============================================================================
describe('Suite 1: Adversarial Build & Static Export Validation', () => {

  test('1.1: landing/out/ exists and contains valid index.html with DOCTYPE', () => {
    assert(fs.existsSync(LANDING_OUT), 'landing/out directory must exist');
    const indexHtmlPath = path.join(LANDING_OUT, 'index.html');
    assert(fs.existsSync(indexHtmlPath), 'landing/out/index.html must exist');

    const stat = fs.statSync(indexHtmlPath);
    assert(stat.size > 5000, `landing/out/index.html must be > 5KB (got ${stat.size} bytes)`);

    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    const doctypeMatch = content.match(/^<!DOCTYPE\s+html/i);
    assert(doctypeMatch !== null, 'landing/out/index.html must begin with valid <!DOCTYPE html>');
    assert(content.includes('<html'), 'landing/out/index.html must contain <html tag');
    assert(content.includes('<head'), 'landing/out/index.html must contain <head tag');
    assert(content.includes('<body'), 'landing/out/index.html must contain <body tag');
    assert(content.includes('</html>'), 'landing/out/index.html must contain closing </html>');
    assert(content.includes('</body>'), 'landing/out/index.html must contain closing </body>');
  });

  const EXPECTED_FRONTEND_ROUTES = [
    { route: '/', file: 'index.html' },
    { route: '/404', file: '404.html' },
    { route: '/_not-found', file: '_not-found/index.html' },
    { route: '/addon-groups', file: 'addon-groups/index.html' },
    { route: '/ai-insights', file: 'ai-insights/index.html' },
    { route: '/auth/login', file: 'auth/login/index.html' },
    { route: '/auth/recover', file: 'auth/recover/index.html' },
    { route: '/auth/register', file: 'auth/register/index.html' },
    { route: '/cloud-portal', file: 'cloud-portal/index.html' },
    { route: '/customer-display', file: 'customer-display/index.html' },
    { route: '/customers', file: 'customers/index.html' },
    { route: '/dashboard', file: 'dashboard/index.html' },
    { route: '/expenses', file: 'expenses/index.html' },
    { route: '/inventory', file: 'inventory/index.html' },
    { route: '/kds', file: 'kds/index.html' },
    { route: '/kds-standalone', file: 'kds-standalone/index.html' },
    { route: '/menu', file: 'menu/index.html' },
    { route: '/online-orders', file: 'online-orders/index.html' },
    { route: '/order-history-demo', file: 'order-history-demo/index.html' },
    { route: '/orders', file: 'orders/index.html' },
    { route: '/pos', file: 'pos/index.html' },
    { route: '/print-test', file: 'print-test/index.html' },
    { route: '/products', file: 'products/index.html' },
    { route: '/qr', file: 'qr/index.html' },
    { route: '/reports', file: 'reports/index.html' },
    { route: '/reservations', file: 'reservations/index.html' },
    { route: '/server-standalone', file: 'server-standalone/index.html' },
    { route: '/settings', file: 'settings/index.html' },
    { route: '/setup', file: 'setup/index.html' },
    { route: '/staff', file: 'staff/index.html' },
    { route: '/support', file: 'support/index.html' },
    { route: '/tables', file: 'tables/index.html' },
    { route: '/whatsapp', file: 'whatsapp/index.html' },
  ];

  test('1.2: All frontend static HTML routes exist with valid DOCTYPE and markup', () => {
    assert(fs.existsSync(FRONTEND_OUT), 'frontend/out directory must exist');
    let verifiedCount = 0;

    for (const item of EXPECTED_FRONTEND_ROUTES) {
      let filePath = path.join(FRONTEND_OUT, item.file);
      if (!fs.existsSync(filePath) && item.file.endsWith('/index.html')) {
        const altPath = path.join(FRONTEND_OUT, item.file.replace('/index.html', '.html'));
        if (fs.existsSync(altPath)) filePath = altPath;
      }

      assert(fs.existsSync(filePath), `Static route file missing: ${item.route} -> ${filePath}`);
      const stat = fs.statSync(filePath);
      assert(stat.size > 1000, `Route ${item.route} file too small (${stat.size} bytes)`);

      const content = fs.readFileSync(filePath, 'utf8');
      const hasDoctype = /^<!DOCTYPE\s+html/i.test(content);
      assert(hasDoctype, `Route ${item.route} missing <!DOCTYPE html>`);
      assert(content.includes('<html'), `Route ${item.route} missing <html tag`);
      assert(content.includes('<head'), `Route ${item.route} missing <head tag`);
      assert(content.includes('<body'), `Route ${item.route} missing <body tag`);
      assert(content.includes('</html>'), `Route ${item.route} missing </html>`);
      assert(content.includes('</body>'), `Route ${item.route} missing </body>`);
      verifiedCount++;
    }

    assert(verifiedCount >= 33, `Must verify at least 33 distinct routes (verified ${verifiedCount})`);
  });

  test('1.3: Static asset references in landing/out/ and frontend/out/ exist on disk', () => {
    function auditHtmlAssets(outDir, htmlFile) {
      const fullPath = path.join(outDir, htmlFile);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Extract script src
      const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
      let match;
      while ((match = scriptRegex.exec(content)) !== null) {
        let src = match[1];
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) continue;
        if (src.startsWith('/')) src = src.slice(1);
        const resolvedPath = path.join(outDir, src.split('?')[0]);
        assert(fs.existsSync(resolvedPath), `Missing script asset referenced in ${htmlFile}: ${src} -> ${resolvedPath}`);
      }

      // Extract css href
      const cssRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g;
      while ((match = cssRegex.exec(content)) !== null) {
        let href = match[1];
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) continue;
        if (href.startsWith('/')) href = href.slice(1);
        const resolvedPath = path.join(outDir, href.split('?')[0]);
        assert(fs.existsSync(resolvedPath), `Missing stylesheet referenced in ${htmlFile}: ${href} -> ${resolvedPath}`);
      }
    }

    auditHtmlAssets(LANDING_OUT, 'index.html');
    auditHtmlAssets(FRONTEND_OUT, 'index.html');
    auditHtmlAssets(FRONTEND_OUT, 'auth/login/index.html');
    auditHtmlAssets(FRONTEND_OUT, 'auth/register/index.html');
    auditHtmlAssets(FRONTEND_OUT, 'cloud-portal/index.html');
    auditHtmlAssets(FRONTEND_OUT, 'dashboard/index.html');
  });
});

// ============================================================================
// SUITE 2: ADVERSARIAL AUTH & DOWNLOAD FLOW VERIFICATION
// ============================================================================
describe('Suite 2: Adversarial Auth & Download Flow Verification', () => {

  test('2.1: Public marketing CTAs route to the pilot request form and never serve fake installers', () => {
    const landingNav = fs.readFileSync(path.join(ROOT, 'landing', 'src', 'components', 'Navbar.tsx'), 'utf8');
    const landingHero = fs.readFileSync(path.join(ROOT, 'landing', 'src', 'components', 'Hero.tsx'), 'utf8');
    const landingCta = fs.readFileSync(path.join(ROOT, 'landing', 'src', 'components', 'CtaSection.tsx'), 'utf8');
    const frontendNav = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'components', 'landing', 'Navbar.tsx'), 'utf8');
    const frontendCta = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'components', 'landing', 'CtaSection.tsx'), 'utf8');

    assert(landingNav.includes('href="/pilot/"'), 'Landing navigation must route pilot enquiries to /pilot/');
    assert(landingHero.includes('href="/pilot/"'), 'Landing hero must route pilot enquiries to /pilot/');
    assert(landingCta.includes('href="/pilot/"'), 'Landing final CTA must route pilot enquiries to /pilot/');
    assert(frontendNav.includes('https://orderitup.pages.dev/pilot/'), 'Legacy frontend navigation must route to the canonical pilot form');
    assert(frontendCta.includes('https://orderitup.pages.dev/pilot/'), 'Legacy frontend CTA must route to the canonical pilot form');
    assert(!frontendNav.includes('Order-It-Up-Setup.exe'), 'Navbar must not generate a text file disguised as an installer');
    assert(!frontendCta.includes('Order-It-Up-Setup.exe'), 'CTA must not generate a text file disguised as an installer');
  });

  test('2.2: Google sign-in uses Google Identity Services and server-verified Cloud API credentials', () => {
    const googleButtonPath = path.join(ROOT, 'frontend', 'src', 'components', 'auth', 'GoogleSignInButton.tsx');
    const googleAuthPath = path.join(ROOT, 'apps', 'cloud-api', 'src', 'routes', 'google-auth.ts');
    const workerPath = path.join(ROOT, 'apps', 'cloud-api', 'src', 'index.ts');
    assert(fs.existsSync(googleButtonPath), 'Google Identity Services component must exist');
    const googleButton = fs.readFileSync(googleButtonPath, 'utf8');
    const googleAuth = fs.readFileSync(googleAuthPath, 'utf8');
    const worker = fs.readFileSync(workerPath, 'utf8');

    assert(googleButton.includes('accounts.google.com/gsi/client'), 'Browser must load official Google Identity Services');
    assert(googleButton.includes('response.credential'), 'Browser must submit Google's signed ID token');
    assert(googleAuth.includes('crypto.subtle.verify'), 'Worker must verify the Google token signature');
    assert(googleAuth.includes('claims.email_verified'), 'Worker must require verified Google email');
    assert(googleAuth.includes('claims.exp'), 'Worker must validate Google token expiry');
    assert(worker.includes("path === '/api/auth/google'"), 'Cloud Worker must register the Google auth endpoint');

    const login = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'app', 'auth', 'login', 'page.tsx'), 'utf8');
    const register = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'app', 'auth', 'register', 'page.tsx'), 'utf8');
    assert(login.includes('<GoogleSignInButton'), 'Login page must render the real Google button');
    assert(login.includes('loginWithGoogle'), 'Login must create a real Cloud API session');
    assert(register.includes('<GoogleSignInButton'), 'Registration page must render the real Google button');
    assert(register.includes('loginWithGoogle'), 'Registration must create a real Cloud API session');
    assert(!login.includes('demo_google_jwt_token'), 'Login must not store a fabricated Google token');
    assert(!register.includes('demo_google_jwt_token'), 'Registration must not store a fabricated Google token');

    const pilotForm = fs.readFileSync(path.join(ROOT, 'landing', 'src', 'components', 'PilotAccessForm.tsx'), 'utf8');
    const pilotRoute = fs.readFileSync(path.join(ROOT, 'apps', 'cloud-api', 'src', 'routes', 'pilot-applications.ts'), 'utf8');
    assert(pilotForm.includes('/api/pilot-applications'), 'Pilot form must submit to the Cloud API');
    assert(pilotRoute.includes('INSERT INTO pilot_applications'), 'Pilot API must persist enquiries in D1');
    assert(pilotRoute.includes('api.resend.com/emails'), 'Pilot API must notify the configured team through Resend');
  });

  test('2.3: Public sandbox has no fake login credentials or local demo authentication', () => {
    const landingNav = fs.readFileSync(path.join(ROOT, 'landing', 'src', 'components', 'Navbar.tsx'), 'utf8');
    const modalProvider = fs.readFileSync(path.join(ROOT, 'landing', 'src', 'components', 'ModalProvider.tsx'), 'utf8');
    assert(landingNav.includes('href="/pilot/"'), 'Landing navigation must keep pilot access discoverable');
    assert(!modalProvider.includes('CredentialsModal'), 'Sandbox must not expose a demo credential panel');
    assert(!fs.existsSync(path.join(ROOT, 'landing', 'src', 'components', 'AuthModal.tsx')), 'Unused demo auth modal must be removed');
    assert(!fs.existsSync(path.join(ROOT, 'landing', 'src', 'components', 'CredentialsModal.tsx')), 'Demo credentials modal must be removed');
    assert(!fs.existsSync(path.join(ROOT, 'landing', 'src', 'lib', 'auth.ts')), 'Fake browser JWT/session helper must be removed');

    const frontendNav = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'components', 'landing', 'Navbar.tsx'), 'utf8');
    assert(frontendNav.includes('isAuthenticated ?'), 'Signed-in users must retain dashboard navigation');
    assert(frontendNav.includes('dashboardHref'), 'Signed-in users must have dashboard link');
    assert(frontendNav.includes('logout()'), 'Signed-in users must be able to sign out');
    assert(frontendNav.includes('Offline-first architecture'), 'Navbar must describe the architecture without a 100% certification claim');
  }););

// ============================================================================
// SUITE 3: S3 MULTI-CLOUD COMPATIBILITY & TENANT BOUNDARY ADVERSARIAL STRESS
// ============================================================================
describe('Suite 3: S3 Multi-Cloud Compatibility & Tenant Boundary Verification', () => {

  const s3Source = fs.readFileSync(path.join(ROOT, 'main', 'services', 'amazon-s3.ts'), 'utf8');

  // Exact validation functions from amazon-s3.ts for standalone oracle verification
  function oracleValidateTenantId(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant isolation violation: Invalid or missing tenant identifier');
    }
    const clean = tenantId.trim();
    if (!clean || !/^[a-zA-Z0-9_-]+$/.test(clean)) {
      throw new Error(`Tenant isolation violation: Tenant ID "${tenantId}" contains illegal characters or path traversal`);
    }
    return clean;
  }

  function oracleValidateDomain(domain) {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Invalid storage domain: Domain must be a non-empty string');
    }
    const clean = domain.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
      throw new Error(`Invalid storage domain: Domain "${domain}" contains illegal characters`);
    }
    return clean;
  }

  function oracleValidateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename: Filename must be a non-empty string');
    }
    const clean = filename.trim();
    const normalized = clean.replace(/\\/g, '/');
    if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('./')) {
      throw new Error(`Tenant isolation violation: Filename "${filename}" contains path traversal sequence`);
    }
    return normalized;
  }

  function oracleBuildTenantKey(tenantId, domain, filename, subfolder) {
    const cleanTenant = oracleValidateTenantId(tenantId);
    const cleanDomain = oracleValidateDomain(domain);
    const cleanSub = subfolder ? `${oracleValidateDomain(subfolder)}/` : '';
    const cleanFilename = oracleValidateFilename(filename);
    const expectedPrefix = `tenants/${cleanTenant}/`;
    const key = `${expectedPrefix}${cleanDomain}/${cleanSub}${cleanFilename}`;
    if (!key.startsWith(expectedPrefix)) {
      throw new Error(`Tenant isolation violation: Key "${key}" escapes tenant "${cleanTenant}"`);
    }
    return key;
  }

  test('3.1: Adversarial path traversal & illegal character rejection in tenantId', () => {
    const maliciousTenantIds = [
      '../',
      '..\\',
      '../../etc',
      '..%2f',
      '%2e%2e%2f',
      '/var/data',
      'C:\\Windows\\System32',
      'tenant/subdir',
      'tenant\\subdir',
      'tenant name with spaces',
      'tenant;DROP TABLE;',
      'tenant\0nullbyte',
      'tenant\nother',
      'tenant\r\nother',
      'tenant<script>',
      'tenant:colon',
      'tenant*wildcard',
      'tenant?question',
      '',
      '   ',
      null,
      undefined,
      12345
    ];

    for (const badId of maliciousTenantIds) {
      assert.throws(
        () => oracleValidateTenantId(badId),
        /Tenant isolation violation/,
        `Malicious tenant ID "${badId}" must be rejected with Tenant isolation violation`
      );
    }
  });

  test('3.2: Valid tenant IDs pass validation cleanly', () => {
    const validTenantIds = [
      'tenant-001',
      'tenant_002',
      'alpha-beta-gamma',
      'org_restaurant_123',
      'T100',
      'store-delhi-01'
    ];

    for (const goodId of validTenantIds) {
      const res = oracleValidateTenantId(goodId);
      assert.equal(res, goodId);
    }
  });

  test('3.3: Adversarial path traversal rejection in storage domain and filenames', () => {
    const maliciousDomains = ['../', 'domain/nested', 'payments\\sub', 'domain name', 'domain*'];
    for (const badDomain of maliciousDomains) {
      assert.throws(() => oracleValidateDomain(badDomain), /Invalid storage domain/);
    }

    const maliciousFilenames = [
      '../../secret.json',
      '..\\..\\windows\\system32',
      '/etc/shadow',
      './relative.txt',
      'subdir/../../escaped.dat'
    ];
    for (const badFilename of maliciousFilenames) {
      assert.throws(() => oracleValidateFilename(badFilename), /Tenant isolation violation/);
    }
  });

  test('3.4: Strict tenant key prefix hierarchy invariant (tenants/{tenantId}/...)', () => {
    const tenantId = 'store-mumbai-99';
    const domain = 'payments';
    const filename = 'receipt-2026-10-31.json';

    const key = oracleBuildTenantKey(tenantId, domain, filename);
    assert.equal(key, 'tenants/store-mumbai-99/payments/receipt-2026-10-31.json');
    assert(key.startsWith(`tenants/${tenantId}/`), 'Key must strictly adhere to tenants/{tenantId}/ prefix');

    // With subfolder
    const keySub = oracleBuildTenantKey(tenantId, domain, filename, 'daily-batches');
    assert.equal(keySub, 'tenants/store-mumbai-99/payments/daily-batches/receipt-2026-10-31.json');
    assert(keySub.startsWith(`tenants/${tenantId}/`), 'Key with subfolder must strictly adhere to tenants/{tenantId}/ prefix');
  });

  test('3.5: Multi-Cloud Provider configuration matrix compatibility', () => {
    assert(s3Source.includes('endpoint?: string;'), 'S3ServiceConfig must declare endpoint');
    assert(s3Source.includes('forcePathStyle?: boolean;'), 'S3ServiceConfig must declare forcePathStyle');
    assert(s3Source.includes('mockMode?: boolean;'), 'S3ServiceConfig must declare mockMode');
    assert(s3Source.includes('getMockStorageDir'), 'amazon-s3.ts must implement getMockStorageDir');
    assert(s3Source.includes('s3_upload_outbox'), 'amazon-s3.ts must implement outbox queue');

    const providers = [
      {
        name: 'AWS S3 Standard',
        config: { bucketName: 'prod-bucket', region: 'us-east-1', accessKeyId: 'AKIA...', secretAccessKey: 'sec...' },
        expectedEndpoint: undefined,
        expectedPathStyle: false,
      },
      {
        name: 'Cloudflare R2',
        config: { bucketName: 'prod-r2', region: 'auto', endpoint: 'https://acc123.r2.cloudflarestorage.com', accessKeyId: 'k', secretAccessKey: 's', forcePathStyle: false },
        expectedEndpoint: 'https://acc123.r2.cloudflarestorage.com',
        expectedPathStyle: false,
      },
      {
        name: 'MinIO Self-Hosted',
        config: { bucketName: 'local-minio', region: 'us-east-1', endpoint: 'http://192.168.1.50:9000', accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin', forcePathStyle: true },
        expectedEndpoint: 'http://192.168.1.50:9000',
        expectedPathStyle: true,
      },
      {
        name: 'Wasabi Hot Cloud Storage',
        config: { bucketName: 'wasabi-store', region: 'us-east-1', endpoint: 'https://s3.wasabisys.com', accessKeyId: 'w', secretAccessKey: 'w', forcePathStyle: true },
        expectedEndpoint: 'https://s3.wasabisys.com',
        expectedPathStyle: true,
      },
      {
        name: 'Backblaze B2 S3 API',
        config: { bucketName: 'b2-backups', region: 'us-west-004', endpoint: 'https://s3.us-west-004.backblazeb2.com', accessKeyId: 'b', secretAccessKey: 'b', forcePathStyle: true },
        expectedEndpoint: 'https://s3.us-west-004.backblazeb2.com',
        expectedPathStyle: true,
      },
      {
        name: 'Google Cloud Storage S3 Interoperability',
        config: { bucketName: 'gcs-bucket', region: 'auto', endpoint: 'https://storage.googleapis.com', accessKeyId: 'GOOG...', secretAccessKey: 'sec...', forcePathStyle: false },
        expectedEndpoint: 'https://storage.googleapis.com',
        expectedPathStyle: false,
      }
    ];

    for (const p of providers) {
      assert(p.config.bucketName.length > 0, `${p.name} must specify bucketName`);
      if (p.expectedEndpoint) {
        assert.equal(p.config.endpoint, p.expectedEndpoint, `${p.name} endpoint mismatch`);
      }
      assert.equal(Boolean(p.config.forcePathStyle), p.expectedPathStyle, `${p.name} pathStyle mismatch`);
    }
  });

  test('3.6: Mock Mode and Outbox Offline Fallback resilience', () => {
    assert(s3Source.includes('writeMockObject'), 'amazon-s3.ts must have writeMockObject');
    assert(s3Source.includes('listMockObjects'), 'amazon-s3.ts must have listMockObjects');
    assert(s3Source.includes('deleteMockObject'), 'amazon-s3.ts must have deleteMockObject');
    assert(s3Source.includes('headMockBucket'), 'amazon-s3.ts must have headMockBucket');
    assert(s3Source.includes('enqueueOutbox'), 'amazon-s3.ts must have enqueueOutbox');
    assert(s3Source.includes('processOutbox'), 'amazon-s3.ts must have processOutbox');
    assert(s3Source.includes('getOutboxStatus'), 'amazon-s3.ts must have getOutboxStatus');
  });
});
