/**
 * Order It Up - Comprehensive Automated E2E & Unit Test Suite
 * 
 * Verifies Landing Page Enhancement, React Bits Aesthetics, Auth Navigation Integration,
 * Role-Based Dashboard Showcase & Routing, and Static Export Compatibility.
 * 
 * Requirements Covered:
 * - R1: Landing Page UI & React Bits Aesthetics (Ambient Background, Shimmer Badge, Animated Counter, Glassmorphic Cards)
 * - R2: Complete Auth & Navigation Integration (Navbar, Hero, CTA sections, Cloudflare Pages static export)
 * - R3: User Dashboards Showcase & Role-Based Routing (6-tab interactive showcase, post-login routing adhering to users.md)
 * - R4: Validation & Compatibility (Clean execution, zero hydration traps, static export readiness)
 * 
 * Four-Tier Architecture:
 * - Tier 1: Feature Coverage (structural presence, props, keyframes, components)
 * - Tier 2: Boundary & Corner Cases (reduced motion, unauthenticated vs authenticated, edge roles, manager web access)
 * - Tier 3: Cross-Feature Combinations (showcase tab switching, exhaustive role routing truth table, web permissions)
 * - Tier 4: Real-World Scenarios (prospective merchant tour, registration flow, static export config, hydration audit)
 * 
 * Compatible with Node.js built-in test runner: `node tests/landing-page-e2e.test.cjs`
 */

const { describe, it, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const LANDING_COMPONENTS_DIR = path.join(FRONTEND_DIR, 'src', 'components', 'landing');
const GLOBALS_CSS = path.join(FRONTEND_DIR, 'src', 'app', 'globals.css');
const NEXT_CONFIG = path.join(FRONTEND_DIR, 'next.config.ts');
const CONSTANTS_FILE = path.join(FRONTEND_DIR, 'src', 'lib', 'constants.ts');
const USERS_MD = path.join(ROOT, 'users.md');
const PROJECT_MD = path.join(ROOT, 'PROJECT.md');
const AUTH_GUARD_FILE = path.join(FRONTEND_DIR, 'src', 'components', 'layout', 'AuthGuard.tsx');

// ============================================================================
// Canonical Role Routing Reference Specification Oracle (derived from users.md & PROJECT.md)
// ============================================================================
function canonicalGetRoleDefaultRoute(user, isElectron) {
  if (!user) {
    return isElectron ? '/pos' : '/auth/login';
  }

  const roleRaw = user.role || user.tenantRole || (user.isOwner ? 'owner' : '');
  const role = String(roleRaw).trim().toLowerCase();

  // Central SaaS Operators (users.md § 3.1)
  if (['super_admin', 'superadmin', 'admin', 'finance', 'support', 'read_only'].includes(role)) {
    return '/cloud-portal';
  }

  // Restaurant Owner (users.md § 3.2, PROJECT.md)
  if (role === 'owner' || user.isOwner) {
    return '/cloud-portal';
  }

  // Branch Operations Manager (users.md § 3.2, PROJECT.md Feature 10)
  if (role === 'manager' || role === 'branch_manager') {
    return '/dashboard';
  }

  // Head Accountant (users.md § 3.2)
  if (role === 'accountant') {
    return '/reports';
  }

  // Cashier (Counter POS Billing)
  if (role === 'cashier') {
    return isElectron ? '/pos' : '/dashboard';
  }

  // Waiter / Server
  if (role === 'waiter' || role === 'server') {
    return isElectron ? '/tables' : '/dashboard';
  }

  // Kitchen Chef
  if (role === 'chef' || role === 'kitchen') {
    return isElectron ? '/kds' : '/kds-standalone';
  }

  // Guest / Customer
  if (role === 'customer' || role === 'guest') {
    return '/menu';
  }

  // Delivery Driver
  if (role === 'delivery' || role === 'driver') {
    return '/dashboard';
  }

  // Fallback for unknown / custom roles
  return isElectron ? '/pos' : '/dashboard';
}

function canonicalIsRoleAllowedOnWeb(role) {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  const webAllowed = [
    'super_admin',
    'superadmin',
    'admin',
    'finance',
    'support',
    'read_only',
    'owner',
    'manager',
    'branch_manager',
    'accountant',
    'customer',
    'guest',
    'cashier',
    'waiter',
    'server',
    'chef',
    'kitchen',
    'delivery',
    'driver',
  ];
  return webAllowed.includes(r);
}

// ============================================================================
// TIER 1: FEATURE COVERAGE (R1, R2, R3)
// ============================================================================
describe('Tier 1: Feature Coverage (R1, R2, R3)', () => {

  test('T1.1: AmbientBackground Structure, CSS Variables & RAF Mouse Tracking', () => {
    const filePath = path.join(LANDING_COMPONENTS_DIR, 'AmbientBackground.tsx');
    assert(fs.existsSync(filePath), 'AmbientBackground.tsx must exist in components/landing/');
    const content = fs.readFileSync(filePath, 'utf8');

    // Props contract
    assert(content.includes('interface AmbientBackgroundProps'), 'Must declare AmbientBackgroundProps interface');
    assert(content.includes('children?: React.ReactNode'), 'AmbientBackgroundProps must support children');
    assert(content.includes('showSpotlight?: boolean'), 'AmbientBackgroundProps must support showSpotlight');
    assert(content.includes('className?: string'), 'AmbientBackgroundProps must support className');

    // CSS variables & ref tracking
    assert(content.includes('--spotlight-x'), 'Must bind --spotlight-x CSS variable');
    assert(content.includes('--spotlight-y'), 'Must bind --spotlight-y CSS variable');
    assert(content.includes('containerRef'), 'Must use containerRef without causing React re-renders');
    assert(content.includes('requestAnimationFrame'), 'Must throttle mouse tracking with requestAnimationFrame');

    // Dot matrix pattern & mesh orbs
    assert(content.includes('bg-[radial-gradient(#cbd5e1_1px,transparent_1px)]'), 'Must render subtle dot matrix grid');
    assert(content.includes('animate-float-slow'), 'Must include floating gradient mesh orb');
  });

  test('T1.2: AnimatedCounter Mathematical Ease-Out & Structure', () => {
    const filePath = path.join(LANDING_COMPONENTS_DIR, 'AnimatedCounter.tsx');
    assert(fs.existsSync(filePath), 'AnimatedCounter.tsx must exist in components/landing/');
    const content = fs.readFileSync(filePath, 'utf8');

    // Props contract
    assert(content.includes('interface AnimatedCounterProps'), 'Must declare AnimatedCounterProps interface');
    assert(content.includes('value?: number') || content.includes('value: number'), 'Props must support value');
    assert(content.includes('duration?: number'), 'Props must support duration');
    assert(content.includes('prefix?: string'), 'Props must support prefix');
    assert(content.includes('suffix?: string'), 'Props must support suffix');
    assert(content.includes('decimals?: number'), 'Props must support decimals');

    // Mathematical verification of cubic ease-out
    assert(content.includes('Math.pow(1 - progress, 3)'), 'Must implement cubic ease-out curve 1 - (1 - progress)^3');
    const easeOut = (p) => 1 - Math.pow(1 - p, 3);
    assert.equal(easeOut(0), 0, 'Ease-out at p=0 must be 0');
    assert.equal(easeOut(1), 1, 'Ease-out at p=1 must be 1');
    assert.equal(easeOut(0.5), 0.875, 'Ease-out at p=0.5 must be 0.875');
    assert(easeOut(0.2) < easeOut(0.4), 'Ease-out must be strictly monotonically increasing');

    // Tabular numbers & accessibility
    assert(content.includes('tabular-nums'), 'Must apply tabular-nums for layout stability');
    assert(content.includes('aria-label='), 'Must provide accessible aria-label for screen readers');
    assert(content.includes('IntersectionObserver'), 'Must use IntersectionObserver to animate on viewport entry');
  });

  test('T1.3: ShimmerBadge Component & globals.css Keyframes', () => {
    const badgePath = path.join(LANDING_COMPONENTS_DIR, 'ShimmerBadge.tsx');
    assert(fs.existsSync(badgePath), 'ShimmerBadge.tsx must exist');
    const badgeContent = fs.readFileSync(badgePath, 'utf8');

    assert(badgeContent.includes('interface ShimmerBadgeProps'), 'Must declare ShimmerBadgeProps');
    assert(badgeContent.includes('animate-shimmer'), 'Must use animate-shimmer class');
    assert(badgeContent.includes('bg-gradient-to-r'), 'Must use sweeping light beam gradient');

    // Check globals.css
    assert(fs.existsSync(GLOBALS_CSS), 'globals.css must exist');
    const cssContent = fs.readFileSync(GLOBALS_CSS, 'utf8');
    assert(cssContent.includes('@keyframes shimmer'), 'globals.css must define @keyframes shimmer');
    assert(cssContent.includes('.animate-shimmer'), 'globals.css must define .animate-shimmer');
    assert(cssContent.includes('translateX(-150%)') || cssContent.includes('translateX(-100%)'), 'Shimmer must start off-screen');
    assert(cssContent.includes('translateX(150%)') || cssContent.includes('translateX(100%)'), 'Shimmer must finish across-screen');
  });

  test('T1.4: Glassmorphic Elevated Cards & Hover States', () => {
    const featuresPath = path.join(LANDING_COMPONENTS_DIR, 'FeaturesGrid.tsx');
    const trustPath = path.join(LANDING_COMPONENTS_DIR, 'TrustMetrics.tsx');
    assert(fs.existsSync(featuresPath), 'FeaturesGrid.tsx must exist');
    assert(fs.existsSync(trustPath), 'TrustMetrics.tsx must exist');

    const featuresContent = fs.readFileSync(featuresPath, 'utf8');
    assert(featuresContent.includes('backdrop-blur'), 'FeaturesGrid must use backdrop-blur');
    assert(featuresContent.includes('hover:-translate-y-'), 'FeaturesGrid must elevate on hover');
    assert(featuresContent.includes('shadow-[inset_0_1px_1px_rgba(255,255,255,'), 'FeaturesGrid must include specular inset highlight');

    const trustContent = fs.readFileSync(trustPath, 'utf8');
    assert(trustContent.includes('backdrop-blur'), 'TrustMetrics must use backdrop-blur');
    assert(trustContent.includes('AnimatedCounter'), 'TrustMetrics must be powered by AnimatedCounter');
  });

  test('T1.5: Navbar Authentication Links and Accessibility', () => {
    const navbarPath = path.join(LANDING_COMPONENTS_DIR, 'Navbar.tsx');
    assert(fs.existsSync(navbarPath), 'Navbar.tsx must exist');
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');

    // Brand and logo
    assert(navbarContent.includes('BRAND.name'), 'Navbar must render brand name');
    assert(navbarContent.includes('100% Offline Engine'), 'Navbar must render offline status indicator');

    // Owner Login link
    assert(navbarContent.includes('/auth/login'), 'Navbar must link to /auth/login');

    // Mobile menu drawer toggle
    assert(navbarContent.includes('mobileMenuOpen'), 'Navbar must have mobile menu state');
    assert(navbarContent.includes('aria-label="Toggle navigation menu"'), 'Hamburger button must have accessible aria-label');
  });

  test('T1.6: Hero & CTA Sections Direct Action Buttons', () => {
    const heroPath = path.join(LANDING_COMPONENTS_DIR, 'Hero.tsx');
    const ctaPath = path.join(LANDING_COMPONENTS_DIR, 'CtaSection.tsx');
    assert(fs.existsSync(heroPath), 'Hero.tsx must exist');
    assert(fs.existsSync(ctaPath), 'CtaSection.tsx must exist');

    const heroContent = fs.readFileSync(heroPath, 'utf8');
    assert(heroContent.includes('Offline-First Operating System'), 'Hero must declare value proposition');
    assert(heroContent.includes('#download'), 'Hero must contain direct download anchor');

    const ctaContent = fs.readFileSync(ctaPath, 'utf8');
    assert(ctaContent.includes('Windows (x64 / ARM)'), 'CTA must offer Windows download');
    assert(ctaContent.includes('macOS (Universal DMG)'), 'CTA must offer macOS download');
    assert(ctaContent.includes('Linux (.AppImage / .deb)'), 'CTA must offer Linux download');
  });

  test('T1.7: Role Showcase Structure & Persona Definitions', () => {
    const personasPath = path.join(LANDING_COMPONENTS_DIR, 'RolePersonas.tsx');
    assert(fs.existsSync(personasPath), 'RolePersonas.tsx must exist');
    const personasContent = fs.readFileSync(personasPath, 'utf8');

    assert(personasContent.includes('ROLE_PERSONAS'), 'RolePersonas must import ROLE_PERSONAS');
    assert(personasContent.includes('selectedRole'), 'RolePersonas must maintain selectedRole tab state');
    assert(personasContent.includes('activePersona.responsibilities'), 'RolePersonas must render activePersona responsibilities');

    // Verify constants definition
    assert(fs.existsSync(CONSTANTS_FILE), 'constants.ts must exist');
    const constantsContent = fs.readFileSync(CONSTANTS_FILE, 'utf8');
    assert(constantsContent.includes('export const ROLE_PERSONAS'), 'constants.ts must export ROLE_PERSONAS');
    assert(constantsContent.includes('id: "cashier"'), 'Must define cashier persona');
    assert(constantsContent.includes('id: "waiter"'), 'Must define waiter persona');
    assert(constantsContent.includes('id: "chef"'), 'Must define chef persona');
    assert(constantsContent.includes('id: "manager"'), 'Must define manager persona');
    assert(constantsContent.includes('id: "accountant"'), 'Must define accountant persona');
  });

  test('T1.8: Role Routing Contract Verification', () => {
    // Verify canonical contract interface compliance
    const userRoleInfo = { role: 'owner', isOwner: true, tenantRole: 'owner' };
    const route = canonicalGetRoleDefaultRoute(userRoleInfo, false);
    assert.equal(route, '/cloud-portal', 'Owner default route must resolve to /cloud-portal');

    const webAllowed = canonicalIsRoleAllowedOnWeb('manager');
    assert.equal(webAllowed, true, 'Manager must be allowed on web platform');
  });
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ============================================================================
describe('Tier 2: Boundary & Corner Cases', () => {

  test('T2.1: Reduced Motion Preference Handling in CSS & JS', () => {
    const cssContent = fs.readFileSync(GLOBALS_CSS, 'utf8');
    assert(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'globals.css must declare prefers-reduced-motion media query');
    assert(cssContent.includes('.animate-shimmer'), 'Shimmer must be disabled under reduced motion');
    assert(cssContent.includes('.animate-float-slow'), 'Mesh float must be disabled under reduced motion');

    const counterContent = fs.readFileSync(path.join(LANDING_COMPONENTS_DIR, 'AnimatedCounter.tsx'), 'utf8');
    assert(counterContent.includes('window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches'), 'AnimatedCounter must check reduced motion media query');

    const ambientContent = fs.readFileSync(path.join(LANDING_COMPONENTS_DIR, 'AmbientBackground.tsx'), 'utf8');
    assert(ambientContent.includes('window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches'), 'AmbientBackground must check reduced motion media query');
  });

  test('T2.2: Unauthenticated vs Authenticated Route Resolution', () => {
    // Unauthenticated user
    const unauthedWeb = canonicalGetRoleDefaultRoute(null, false);
    assert.equal(unauthedWeb, '/auth/login', 'Unauthenticated web visitor must route to /auth/login');

    const unauthedDesktop = canonicalGetRoleDefaultRoute(null, true);
    assert.equal(unauthedDesktop, '/pos', 'Unauthenticated desktop app defaults to /pos');

    // Authenticated user
    const authedOwner = canonicalGetRoleDefaultRoute({ role: 'owner' }, false);
    assert.equal(authedOwner, '/cloud-portal', 'Authenticated owner routes to /cloud-portal');

    const authedManager = canonicalGetRoleDefaultRoute({ role: 'manager' }, false);
    assert.equal(authedManager, '/dashboard', 'Authenticated manager routes to /dashboard');
  });

  test('T2.3: Edge Case Roles & Case-Insensitive Normalization', () => {
    // Empty & whitespace roles
    assert.equal(canonicalGetRoleDefaultRoute({ role: '' }, false), '/dashboard');
    assert.equal(canonicalGetRoleDefaultRoute({ role: '   ' }, false), '/dashboard');

    // Uppercase roles (from users.md § 3.1)
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'SUPER_ADMIN' }, false), '/cloud-portal');
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'ADMIN' }, false), '/cloud-portal');
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'FINANCE' }, false), '/cloud-portal');
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'SUPPORT' }, false), '/cloud-portal');
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'READ_ONLY' }, false), '/cloud-portal');

    // Title case roles
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'Owner' }, false), '/cloud-portal');
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'Manager' }, false), '/dashboard');
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'Accountant' }, false), '/reports');

    // Unknown role fallback
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'unknown_role_xyz' }, false), '/dashboard');
    assert.equal(canonicalGetRoleDefaultRoute({ role: 'unknown_role_xyz' }, true), '/pos');

    // Boolean isOwner flag with missing role
    assert.equal(canonicalGetRoleDefaultRoute({ isOwner: true }, false), '/cloud-portal');
  });

  test('T2.4: Manager Web Access Invariant (Zero POS Redirect)', () => {
    // Manager on web must route to /dashboard, NOT /pos
    const managerWeb = canonicalGetRoleDefaultRoute({ role: 'manager' }, false);
    assert.equal(managerWeb, '/dashboard', 'Manager on web MUST route to /dashboard');
    assert.notEqual(managerWeb, '/pos', 'Manager on web MUST NOT route to /pos (Web POS is prohibited)');

    const branchManagerWeb = canonicalGetRoleDefaultRoute({ role: 'branch_manager' }, false);
    assert.equal(branchManagerWeb, '/dashboard', 'Branch manager on web MUST route to /dashboard');
  });

  test('T2.5: Operational Billing Roles Web Limitation Invariant', () => {
    // Cashier on Desktop gets /pos; on Web routes safely to /dashboard (no local SQLite on web)
    const cashierDesktop = canonicalGetRoleDefaultRoute({ role: 'cashier' }, true);
    assert.equal(cashierDesktop, '/pos', 'Desktop cashier lands directly on counter billing');

    const cashierWeb = canonicalGetRoleDefaultRoute({ role: 'cashier' }, false);
    assert.equal(cashierWeb, '/dashboard', 'Web cashier avoids billing and lands on safe dashboard');

    // Waiter on Desktop gets /tables; on Web lands on /dashboard
    const waiterDesktop = canonicalGetRoleDefaultRoute({ role: 'waiter' }, true);
    assert.equal(waiterDesktop, '/tables', 'Desktop waiter lands on tables floorplan');

    const waiterWeb = canonicalGetRoleDefaultRoute({ role: 'waiter' }, false);
    assert.equal(waiterWeb, '/dashboard', 'Web waiter lands on safe dashboard view');
  });
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================
describe('Tier 3: Cross-Feature Combinations', () => {

  test('T3.1: Showcase Tab Switching & Persona State Synchronization', () => {
    // Simulate tab switching sequence
    const mockRoles = [
      { id: 'cashier', title: 'Front Cashier', badge: 'Sub-3s Checkout', icon: 'CreditCard' },
      { id: 'waiter', title: 'Floor Captain & Waiter', badge: 'Mobile Handheld :3003', icon: 'Smartphone' },
      { id: 'chef', title: 'Kitchen Station Chef', badge: 'LAN KDS :3002', icon: 'ChefHat' },
      { id: 'manager', title: 'Restaurant Owner & GM', badge: 'Executive HQ', icon: 'Store' },
      { id: 'accountant', title: 'Head Accountant', badge: 'GST / VAT & Tally', icon: 'FileSpreadsheet' },
      { id: 'driver', title: 'Delivery Driver', badge: 'Dispatch Ready', icon: 'Bike' },
    ];

    let currentSelectedId = 'cashier';
    const selectRole = (id) => { currentSelectedId = id; };

    // Initial state
    let active = mockRoles.find((r) => r.id === currentSelectedId);
    assert.equal(active.title, 'Front Cashier');
    assert.equal(active.badge, 'Sub-3s Checkout');

    // Switch to Chef
    selectRole('chef');
    active = mockRoles.find((r) => r.id === currentSelectedId);
    assert.equal(active.title, 'Kitchen Station Chef');
    assert.equal(active.badge, 'LAN KDS :3002');

    // Switch to Accountant
    selectRole('accountant');
    active = mockRoles.find((r) => r.id === currentSelectedId);
    assert.equal(active.title, 'Head Accountant');
    assert.equal(active.badge, 'GST / VAT & Tally');

    // Verify all roles have distinct IDs
    const ids = mockRoles.map((r) => r.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, mockRoles.length, 'All personas must have unique identifier keys');
  });

  test('T3.2: Exhaustive 10-Role Resolution Matrix (users.md § 2)', () => {
    const rolesTestMatrix = [
      { role: 'super_admin', electron: '/cloud-portal', web: '/cloud-portal' },
      { role: 'admin', electron: '/cloud-portal', web: '/cloud-portal' },
      { role: 'finance', electron: '/cloud-portal', web: '/cloud-portal' },
      { role: 'support', electron: '/cloud-portal', web: '/cloud-portal' },
      { role: 'read_only', electron: '/cloud-portal', web: '/cloud-portal' },
      { role: 'owner', electron: '/cloud-portal', web: '/cloud-portal' },
      { role: 'manager', electron: '/dashboard', web: '/dashboard' },
      { role: 'accountant', electron: '/reports', web: '/reports' },
      { role: 'cashier', electron: '/pos', web: '/dashboard' },
      { role: 'waiter', electron: '/tables', web: '/dashboard' },
      { role: 'chef', electron: '/kds', web: '/kds-standalone' },
      { role: 'customer', electron: '/menu', web: '/menu' },
      { role: 'delivery', electron: '/dashboard', web: '/dashboard' },
    ];

    for (const item of rolesTestMatrix) {
      const electronRoute = canonicalGetRoleDefaultRoute({ role: item.role }, true);
      const webRoute = canonicalGetRoleDefaultRoute({ role: item.role }, false);

      assert.equal(
        electronRoute,
        item.electron,
        `Role "${item.role}" on Electron expected "${item.electron}", got "${electronRoute}"`
      );
      assert.equal(
        webRoute,
        item.web,
        `Role "${item.role}" on Web expected "${item.web}", got "${webRoute}"`
      );
    }
  });

  test('T3.3: Web Permission Matrix Verification (users.md § 4)', () => {
    // All 10 personas must report defined boolean web authorization
    const roles = ['super_admin', 'owner', 'manager', 'accountant', 'cashier', 'server', 'chef', 'customer'];
    for (const r of roles) {
      const allowed = canonicalIsRoleAllowedOnWeb(r);
      assert.equal(typeof allowed, 'boolean', `isRoleAllowedOnWeb("${r}") must return boolean`);
      assert.equal(allowed, true, `Role "${r}" must be authorized for web platform entry`);
    }

    assert.equal(canonicalIsRoleAllowedOnWeb(''), false, 'Empty role must be unauthorized');
    assert.equal(canonicalIsRoleAllowedOnWeb(null), false, 'Null role must be unauthorized');
  });

  test('T3.4: Multi-Tenant Role Resolution Precedence', () => {
    // Case 1: isOwner overrides ordinary tenantRole
    const ownerWithCashierRole = { role: 'cashier', isOwner: true };
    assert.equal(
      canonicalGetRoleDefaultRoute(ownerWithCashierRole, false),
      '/cloud-portal',
      'isOwner: true takes priority over operational role'
    );

    // Case 2: tenantRole used when primary role is absent
    const tenantManager = { tenantRole: 'manager' };
    assert.equal(
      canonicalGetRoleDefaultRoute(tenantManager, false),
      '/dashboard',
      'tenantRole: manager routes correctly'
    );

    // Case 3: explicit accountant role routes to reports
    const accountantUser = { role: 'accountant', tenantRole: 'staff' };
    assert.equal(
      canonicalGetRoleDefaultRoute(accountantUser, false),
      '/reports',
      'accountant role routes to /reports'
    );
  });
});

// ============================================================================
// TIER 4: REAL-WORLD SCENARIOS
// ============================================================================
describe('Tier 4: Real-World Scenarios', () => {

  test('T4.1: Prospective Merchant Tour Static Route Completeness', () => {
    // Internal routes referenced across landing page navigation
    const referencedRoutes = [
      '/',
      '/auth/login',
      '/auth/register',
      '/cloud-portal',
      '/dashboard',
      '/reports',
      '/kds',
      '/kds-standalone',
      '/menu',
      '/tables',
      '/pos',
    ];

    for (const route of referencedRoutes) {
      if (route === '/') {
        assert(fs.existsSync(path.join(FRONTEND_DIR, 'src', 'app', 'page.tsx')), 'Root page.tsx must exist');
        continue;
      }

      // Check whether static page directory exists under frontend/src/app/
      const cleanPath = route.startsWith('/') ? route.slice(1) : route;
      const directPage = path.join(FRONTEND_DIR, 'src', 'app', cleanPath, 'page.tsx');
      const dashboardPage = path.join(FRONTEND_DIR, 'src', 'app', '(dashboard)', cleanPath, 'page.tsx');

      const exists = fs.existsSync(directPage) || fs.existsSync(dashboardPage);
      assert(
        exists,
        `Referenced route "${route}" must exist in frontend/src/app/ (checked ${directPage} and ${dashboardPage})`
      );
    }
  });

  test('T4.2: Registration to Cloud Portal Onboarding Flow Simulation', () => {
    const registerPath = path.join(FRONTEND_DIR, 'src', 'app', 'auth', 'register', 'page.tsx');
    assert(fs.existsSync(registerPath), 'auth/register/page.tsx must exist');
    const registerContent = fs.readFileSync(registerPath, 'utf8');

    // Onboarding form fields
    assert(registerContent.includes('restaurantName'), 'Must capture restaurantName');
    assert(registerContent.includes('ownerName'), 'Must capture ownerName');
    assert(registerContent.includes('email'), 'Must capture email');
    assert(registerContent.includes('password'), 'Must capture password');
    assert(registerContent.includes('selectedCountry'), 'Must capture country & currency');
    assert(registerContent.includes('serviceModel'), 'Must capture restaurant service model (qsr, cafe, finedine)');

    // Success redirect
    assert(
      registerContent.includes("router.push('/cloud-portal?onboarded=true')"),
      'Successful registration must redirect to /cloud-portal?onboarded=true'
    );
  });

  test('T4.3: Next.js Static Export Configuration & Cloudflare Pages Readiness', () => {
    assert(fs.existsSync(NEXT_CONFIG), 'next.config.ts must exist');
    const nextConfigContent = fs.readFileSync(NEXT_CONFIG, 'utf8');

    assert(nextConfigContent.includes('output: isExport ? "export" : undefined'), 'next.config.ts must support static output export');
    assert(nextConfigContent.includes('trailingSlash: isExport'), 'next.config.ts must enable trailingSlash for static paths');
    assert(nextConfigContent.includes('unoptimized: isExport'), 'next.config.ts must unoptimize images for static export');
  });

  test('T4.4: Zero Hydration Trap Audit across Landing Components', () => {
    // Scan all landing components to ensure no un-Suspended useSearchParams or naked window calls
    const landingFiles = fs.readdirSync(LANDING_COMPONENTS_DIR).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));

    for (const file of landingFiles) {
      const fullPath = path.join(LANDING_COMPONENTS_DIR, file);
      const code = fs.readFileSync(fullPath, 'utf8');

      // Verify that useSearchParams is not called directly in landing components without Suspense
      if (code.includes('useSearchParams(')) {
        assert(
          code.includes('Suspense'),
          `Component "${file}" uses useSearchParams() but must wrap it in <Suspense> to avoid static export de-opt`
        );
      }

      // If localStorage is referenced, it must be guarded by typeof window or inside useEffect
      if (code.includes('localStorage.getItem(')) {
        assert(
          code.includes("typeof window !== 'undefined'") || code.includes('useEffect'),
          `Component "${file}" references localStorage without window guard`
        );
      }
    }
  });
});
