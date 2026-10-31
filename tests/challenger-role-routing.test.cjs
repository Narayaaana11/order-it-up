/**
 * Challenger 2 (teamwork_challenger) Adversarial Role Matrix Test Harness
 * 
 * Target: `frontend/src/lib/role-routing.ts` and `AuthGuard.tsx`
 * 
 * Verifies:
 * 1. 100+ role permutations, casing variations (oWnEr, MANAGER, SuPeR_AdMiN, KITCHEN),
 *    null, undefined, empty strings, numbers, object injection, prototype pollution, XSS/SQL payloads.
 * 2. Multi-tenant role precedence (user.role vs user.tenantRole vs user.isOwner).
 * 3. Platform boundary verification: Cashier role on web is NEVER redirected to /pos (users.md invariant).
 * 4. Web platform access control via isRoleAllowedOnWeb.
 * 5. AuthGuard getLandingPage simulation with local storage variations.
 * 
 * Execution: `node tests/challenger-role-routing.test.cjs`
 */

const { describe, it, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const ROLE_ROUTING_FILE = path.join(ROOT, 'frontend', 'src', 'lib', 'role-routing.ts');
const AUTH_GUARD_FILE = path.join(ROOT, 'frontend', 'src', 'components', 'layout', 'AuthGuard.tsx');

// ============================================================================
// Compilation & Loading of Target TypeScript Modules
// ============================================================================
function loadRoleRoutingModule() {
  const code = fs.readFileSync(ROLE_ROUTING_FILE, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const modExports = {};
  const runner = new Function('exports', 'module', transpiled.outputText);
  runner(modExports, { exports: modExports });
  return modExports;
}

const { getRoleDefaultRoute, isRoleAllowedOnWeb } = loadRoleRoutingModule();

describe('Challenger 2: Adversarial Role Routing & Platform Invariants Test Harness', () => {

  // ==========================================================================
  // SUITE 1: Module Integrity & Interface Contracts
  // ==========================================================================
  describe('Suite 1: Interface Contracts & Function Signatures', () => {
    test('role-routing exports getRoleDefaultRoute and isRoleAllowedOnWeb as functions', () => {
      assert.equal(typeof getRoleDefaultRoute, 'function', 'getRoleDefaultRoute must be exported as a function');
      assert.equal(typeof isRoleAllowedOnWeb, 'function', 'isRoleAllowedOnWeb must be exported as a function');
    });

    test('AuthGuard source references getRoleDefaultRoute and isRoleAllowedOnWeb correctly', () => {
      const authGuardContent = fs.readFileSync(AUTH_GUARD_FILE, 'utf8');
      assert.ok(authGuardContent.includes('getRoleDefaultRoute'), 'AuthGuard must import and use getRoleDefaultRoute');
      assert.ok(authGuardContent.includes('role-routing'), 'AuthGuard must import from role-routing');
    });
  });

  // ==========================================================================
  // SUITE 2: 100+ Role Permutations, Weird Casing & Normalization
  // ==========================================================================
  describe('Suite 2: 100+ Role Permutations & Weird Casing Normalization', () => {
    // Canonical expected routes on Web vs Electron
    const baseRoles = [
      { key: 'super_admin', web: '/cloud-portal', electron: '/cloud-portal' },
      { key: 'superadmin', web: '/cloud-portal', electron: '/cloud-portal' },
      { key: 'admin', web: '/cloud-portal', electron: '/cloud-portal' },
      { key: 'finance', web: '/cloud-portal', electron: '/cloud-portal' },
      { key: 'support', web: '/cloud-portal', electron: '/cloud-portal' },
      { key: 'read_only', web: '/cloud-portal', electron: '/cloud-portal' },
      { key: 'owner', web: '/cloud-portal', electron: '/cloud-portal' },
      { key: 'manager', web: '/dashboard', electron: '/dashboard' },
      { key: 'branch_manager', web: '/dashboard', electron: '/dashboard' },
      { key: 'accountant', web: '/reports', electron: '/reports' },
      { key: 'cashier', web: '/dashboard', electron: '/pos' },
      { key: 'waiter', web: '/dashboard', electron: '/tables' },
      { key: 'server', web: '/dashboard', electron: '/tables' },
      { key: 'chef', web: '/kds-standalone', electron: '/kds' },
      { key: 'kitchen', web: '/kds-standalone', electron: '/kds' },
      { key: 'customer', web: '/menu', electron: '/menu' },
      { key: 'guest', web: '/menu', electron: '/menu' },
      { key: 'delivery', web: '/dashboard', electron: '/dashboard' },
      { key: 'driver', web: '/dashboard', electron: '/dashboard' },
    ];

    // Casing variations generator
    function generateCasingVariations(str) {
      return [
        str.toLowerCase(),
        str.toUpperCase(),
        str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(),
        str.split('').map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join(''),
        str.split('').map((c, i) => (i % 2 === 1 ? c.toUpperCase() : c.toLowerCase())).join(''),
        ` ${str} `,
        `\t${str.toUpperCase()}\n`,
        `  ${str}  `,
        `\r\n ${str} \t`,
      ];
    }

    let permutationCount = 0;

    for (const item of baseRoles) {
      const variations = generateCasingVariations(item.key);
      for (const variant of variations) {
        permutationCount++;
        test(`Permutation #${permutationCount}: role "${variant}" (${item.key})`, () => {
          const webResult = getRoleDefaultRoute({ role: variant }, false);
          const electronResult = getRoleDefaultRoute({ role: variant }, true);

          assert.equal(
            webResult,
            item.web,
            `Web route for role variation "${variant}" must be ${item.web}, got ${webResult}`
          );
          assert.equal(
            electronResult,
            item.electron,
            `Electron route for role variation "${variant}" must be ${item.electron}, got ${electronResult}`
          );
        });
      }
    }

    test(`Verified at least 100 casing and whitespace variations (actual: ${permutationCount})`, () => {
      assert.ok(permutationCount >= 100, `Expected >= 100 permutations, got ${permutationCount}`);
    });

    test('Special explicit targets: oWnEr,  MANAGER , SuPeR_AdMiN, KITCHEN', () => {
      assert.equal(getRoleDefaultRoute({ role: 'oWnEr' }, false), '/cloud-portal');
      assert.equal(getRoleDefaultRoute({ role: ' MANAGER ' }, false), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: 'SuPeR_AdMiN' }, false), '/cloud-portal');
      assert.equal(getRoleDefaultRoute({ role: 'KITCHEN' }, false), '/kds-standalone');
      assert.equal(getRoleDefaultRoute({ role: 'KITCHEN' }, true), '/kds');
    });
  });

  // ==========================================================================
  // SUITE 3: Adversarial Input Fuzzing, Injection & Type Boundary Defense
  // ==========================================================================
  describe('Suite 3: Adversarial Fuzzing, Malformed Payloads & Type Poisoning', () => {
    test('Null, undefined and empty user objects return safe unauthenticated landing routes', () => {
      assert.equal(getRoleDefaultRoute(null, false), '/auth/login', 'null user on web -> /auth/login');
      assert.equal(getRoleDefaultRoute(null, true), '/pos', 'null user on electron -> /pos');
      assert.equal(getRoleDefaultRoute(undefined, false), '/auth/login', 'undefined user on web -> /auth/login');
      assert.equal(getRoleDefaultRoute(undefined, true), '/pos', 'undefined user on electron -> /pos');
      assert.equal(getRoleDefaultRoute(false, false), '/auth/login', 'false user on web -> /auth/login');
      assert.equal(getRoleDefaultRoute(0, false), '/auth/login', '0 user on web -> /auth/login');
      assert.equal(getRoleDefaultRoute('', false), '/auth/login', 'empty string user on web -> /auth/login');
    });

    test('Empty user object {} falls back gracefully without throwing', () => {
      assert.equal(getRoleDefaultRoute({}, false), '/dashboard', 'Empty object on web -> fallback /dashboard');
      assert.equal(getRoleDefaultRoute({}, true), '/pos', 'Empty object on electron -> fallback /pos');
    });

    test('Non-object primitive user argument resilience (number, boolean)', () => {
      assert.equal(getRoleDefaultRoute(12345, false), '/dashboard', 'Number user on web -> /dashboard');
      assert.equal(getRoleDefaultRoute(true, false), '/dashboard', 'Boolean true user on web -> /dashboard');
      assert.equal(getRoleDefaultRoute([], false), '/dashboard', 'Array user on web -> /dashboard');
    });

    test('Null, undefined, empty, and whitespace role properties fall back safely', () => {
      const emptyRoleInputs = [
        { role: null },
        { role: undefined },
        { role: '' },
        { role: '   ' },
        { role: '\t\r\n' },
        { tenantRole: null },
        { tenantRole: undefined },
        { tenantRole: '' },
        { tenantRole: '   ' },
      ];

      for (const input of emptyRoleInputs) {
        assert.equal(getRoleDefaultRoute(input, false), '/dashboard', `Input ${JSON.stringify(input)} web fallback`);
        assert.equal(getRoleDefaultRoute(input, true), '/pos', `Input ${JSON.stringify(input)} electron fallback`);
      }
    });

    test('Numeric and boolean role properties are coerced without crashing', () => {
      const oddInputs = [
        { role: 0 },
        { role: 1 },
        { role: -1 },
        { role: 12345 },
        { role: NaN },
        { role: Infinity },
        { role: -Infinity },
        { role: true },
        { role: false },
      ];

      for (const input of oddInputs) {
        assert.equal(getRoleDefaultRoute(input, false), '/dashboard', `Numeric/bool input ${JSON.stringify(input)} web`);
        assert.equal(getRoleDefaultRoute(input, true), '/pos', `Numeric/bool input ${JSON.stringify(input)} electron`);
      }
    });

    test('Object and array injection into role property is neutralized', () => {
      const objInputs = [
        { role: {} },
        { role: { name: 'admin' } },
        { role: [] },
        { role: ['owner', 'admin'] },
        { role: { toString: () => 'malicious' } },
      ];

      for (const input of objInputs) {
        assert.doesNotThrow(() => {
          const webRes = getRoleDefaultRoute(input, false);
          assert.ok(webRes === '/dashboard' || webRes === '/cloud-portal');
        });
      }
    });

    test('Prototype pollution property names do not bypass role checks', () => {
      const protoPollutionNames = [
        'constructor',
        '__proto__',
        'prototype',
        'toString',
        'valueOf',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'toLocaleString',
      ];

      for (const prop of protoPollutionNames) {
        const webRes = getRoleDefaultRoute({ role: prop }, false);
        const elecRes = getRoleDefaultRoute({ role: prop }, true);
        assert.equal(webRes, '/dashboard', `Prototype payload "${prop}" must fall back safely on web`);
        assert.equal(elecRes, '/pos', `Prototype payload "${prop}" must fall back safely on electron`);
        assert.equal(isRoleAllowedOnWeb(prop), false, `Prototype payload "${prop}" must NOT be allowed on web`);
      }
    });

    test('SQL injection and XSS payloads do not trigger security faults or unintended routes', () => {
      const injectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '${7*7}',
        '{{7*7}}',
        'admin\x00super_admin',
        'cashier\r\nSet-Cookie: evil=true',
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
      ];

      for (const payload of injectionPayloads) {
        const webRes = getRoleDefaultRoute({ role: payload }, false);
        const elecRes = getRoleDefaultRoute({ role: payload }, true);
        assert.equal(webRes, '/dashboard', `Injection payload "${payload}" must fall back safely on web`);
        assert.equal(elecRes, '/pos', `Injection payload "${payload}" must fall back safely on electron`);
        assert.equal(isRoleAllowedOnWeb(payload), false, `Injection payload "${payload}" must NOT be allowed on web`);
      }
    });

    test('Unicode and international characters do not cause unhandled crashes', () => {
      const unicodeInputs = [
        '👑owner',
        'café',
        '🚀',
        'مستخدم',
        '管理员',
        'เจ้าหน้าที่',
        '👨‍🍳chef',
        'super admin',
      ];

      for (const input of unicodeInputs) {
        assert.doesNotThrow(() => {
          const webRes = getRoleDefaultRoute({ role: input }, false);
          assert.equal(webRes, '/dashboard', `Unicode "${input}" must route to safe fallback on web`);
          assert.equal(isRoleAllowedOnWeb(input), false, `Unicode "${input}" unrecognized must not be allowed`);
        });
      }
    });
  });

  // ==========================================================================
  // SUITE 4: Multi-Tenant Role Precedence & Hierarchy
  // ==========================================================================
  describe('Suite 4: Multi-Tenant Role Precedence & Hierarchy Matrix', () => {
    test('isOwner: true overrides operational role on both platforms', () => {
      const rolesToOverride = ['cashier', 'waiter', 'server', 'chef', 'kitchen', 'accountant', 'manager', 'customer'];
      for (const operationalRole of rolesToOverride) {
        const user = { role: operationalRole, isOwner: true };
        assert.equal(
          getRoleDefaultRoute(user, false),
          '/cloud-portal',
          `isOwner: true with role "${operationalRole}" on web must yield /cloud-portal`
        );
        assert.equal(
          getRoleDefaultRoute(user, true),
          '/cloud-portal',
          `isOwner: true with role "${operationalRole}" on electron must yield /cloud-portal`
        );
      }
    });

    test('isOwner: true without any role or tenantRole routes to /cloud-portal', () => {
      const user = { isOwner: true };
      assert.equal(getRoleDefaultRoute(user, false), '/cloud-portal');
      assert.equal(getRoleDefaultRoute(user, true), '/cloud-portal');
    });

    test('isOwner: false does NOT trigger owner escalation', () => {
      const cashierNotOwner = { role: 'cashier', isOwner: false };
      assert.equal(getRoleDefaultRoute(cashierNotOwner, false), '/dashboard');
      assert.equal(getRoleDefaultRoute(cashierNotOwner, true), '/pos');

      const chefNotOwner = { role: 'chef', isOwner: false };
      assert.equal(getRoleDefaultRoute(chefNotOwner, false), '/kds-standalone');
      assert.equal(getRoleDefaultRoute(chefNotOwner, true), '/kds');
    });

    test('Primary user.role takes precedence over user.tenantRole when both present', () => {
      // Role takes precedence
      assert.equal(
        getRoleDefaultRoute({ role: 'accountant', tenantRole: 'manager' }, false),
        '/reports',
        'user.role (accountant) takes precedence over tenantRole (manager)'
      );
      assert.equal(
        getRoleDefaultRoute({ role: 'manager', tenantRole: 'cashier' }, false),
        '/dashboard',
        'user.role (manager) takes precedence over tenantRole (cashier)'
      );
      assert.equal(
        getRoleDefaultRoute({ role: 'super_admin', tenantRole: 'server' }, false),
        '/cloud-portal',
        'user.role (super_admin) takes precedence over tenantRole (server)'
      );
    });

    test('user.tenantRole is utilized when user.role is missing or empty', () => {
      assert.equal(
        getRoleDefaultRoute({ tenantRole: 'manager' }, false),
        '/dashboard',
        'tenantRole used when role undefined'
      );
      assert.equal(
        getRoleDefaultRoute({ role: '', tenantRole: 'accountant' }, false),
        '/reports',
        'tenantRole used when role empty string'
      );
      assert.equal(
        getRoleDefaultRoute({ role: null, tenantRole: 'chef' }, false),
        '/kds-standalone',
        'tenantRole used when role null'
      );
      assert.equal(
        getRoleDefaultRoute({ role: undefined, tenantRole: 'cashier' }, true),
        '/pos',
        'tenantRole cashier used on electron'
      );
      assert.equal(
        getRoleDefaultRoute({ role: undefined, tenantRole: 'cashier' }, false),
        '/dashboard',
        'tenantRole cashier used on web'
      );
    });

    test('Both role and tenantRole missing falls back safely', () => {
      assert.equal(getRoleDefaultRoute({ role: '', tenantRole: '' }, false), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: null, tenantRole: null }, false), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: undefined, tenantRole: undefined }, false), '/dashboard');
    });
  });

  // ==========================================================================
  // SUITE 5: Platform Boundary Verification (Cashier Web Prohibition Invariant)
  // ==========================================================================
  describe('Suite 5: Platform Boundary Invariant (Cashier Web POS Prohibition)', () => {
    test('INVARIANT: Cashier on web is NEVER redirected to /pos', () => {
      const cashierPermutations = [
        { role: 'cashier' },
        { role: 'CASHIER' },
        { role: ' Cashier ' },
        { tenantRole: 'cashier' },
        { tenantRole: 'CASHIER' },
        { role: '', tenantRole: 'cashier' },
        { role: 'cashier', tenantRole: 'staff' },
      ];

      for (const p of cashierPermutations) {
        const route = getRoleDefaultRoute(p, false);
        assert.notEqual(
          route,
          '/pos',
          `VIOLATION OF users.md ARCHITECTURAL BOUNDARY: Cashier on Web received "/pos" for ${JSON.stringify(p)}`
        );
        assert.equal(
          route,
          '/dashboard',
          `Cashier on web must route to /dashboard guidance for ${JSON.stringify(p)}`
        );
      }
    });

    test('Cashier on desktop Electron DOES route to /pos billing', () => {
      const cashierPermutations = [
        { role: 'cashier' },
        { role: 'CASHIER' },
        { role: ' Cashier ' },
        { tenantRole: 'cashier' },
      ];

      for (const p of cashierPermutations) {
        assert.equal(
          getRoleDefaultRoute(p, true),
          '/pos',
          `Cashier on Electron must route to /pos billing for ${JSON.stringify(p)}`
        );
      }
    });

    test('Waiter on Web routes to /dashboard (NEVER /tables), Electron routes to /tables', () => {
      assert.equal(getRoleDefaultRoute({ role: 'waiter' }, false), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: 'server' }, false), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: 'waiter' }, true), '/tables');
      assert.equal(getRoleDefaultRoute({ role: 'server' }, true), '/tables');
    });

    test('Kitchen Chef on Web routes to /kds-standalone (NEVER desktop /kds), Electron routes to /kds', () => {
      assert.equal(getRoleDefaultRoute({ role: 'chef' }, false), '/kds-standalone');
      assert.equal(getRoleDefaultRoute({ role: 'kitchen' }, false), '/kds-standalone');
      assert.equal(getRoleDefaultRoute({ role: 'chef' }, true), '/kds');
      assert.equal(getRoleDefaultRoute({ role: 'kitchen' }, true), '/kds');
    });

    test('Super Admin and Owner route to /cloud-portal on both platforms', () => {
      assert.equal(getRoleDefaultRoute({ role: 'super_admin' }, false), '/cloud-portal');
      assert.equal(getRoleDefaultRoute({ role: 'super_admin' }, true), '/cloud-portal');
      assert.equal(getRoleDefaultRoute({ role: 'owner' }, false), '/cloud-portal');
      assert.equal(getRoleDefaultRoute({ role: 'owner' }, true), '/cloud-portal');
    });

    test('Accountant routes to /reports on both platforms', () => {
      assert.equal(getRoleDefaultRoute({ role: 'accountant' }, false), '/reports');
      assert.equal(getRoleDefaultRoute({ role: 'accountant' }, true), '/reports');
    });

    test('Manager routes to /dashboard on both platforms', () => {
      assert.equal(getRoleDefaultRoute({ role: 'manager' }, false), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: 'manager' }, true), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: 'branch_manager' }, false), '/dashboard');
      assert.equal(getRoleDefaultRoute({ role: 'branch_manager' }, true), '/dashboard');
    });

    test('Unauthenticated user routes to /auth/login on web, /pos on Electron', () => {
      assert.equal(getRoleDefaultRoute(null, false), '/auth/login');
      assert.equal(getRoleDefaultRoute(null, true), '/pos');
    });
  });

  // ==========================================================================
  // SUITE 6: Web Platform Access Control (isRoleAllowedOnWeb)
  // ==========================================================================
  describe('Suite 6: Web Platform Access Control via isRoleAllowedOnWeb', () => {
    test('All 10 canonical operational personas from users.md are authorized on web', () => {
      const canonicalRoles = [
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
        'cashier',
        'waiter',
        'server',
        'chef',
        'kitchen',
        'delivery',
        'driver',
        'customer',
        'guest',
      ];

      for (const role of canonicalRoles) {
        assert.equal(
          isRoleAllowedOnWeb(role),
          true,
          `Canonical role "${role}" must be authorized on web`
        );
      }
    });

    test('isRoleAllowedOnWeb handles case-insensitivity and trimming', () => {
      const testCases = [
        'SUPER_ADMIN',
        '  owner  ',
        'Manager',
        'cAsHiEr',
        '\tchef\n',
        'ACCOUNTANT',
        '  Server ',
        'READ_ONLY',
      ];

      for (const tc of testCases) {
        assert.equal(
          isRoleAllowedOnWeb(tc),
          true,
          `Normalized role check for "${tc}" must return true`
        );
      }
    });

    test('Invalid, empty, and malicious roles are rejected (return false)', () => {
      const invalidRoles = [
        '',
        '   ',
        null,
        undefined,
        'terminal',
        'pos_hardware',
        'device',
        'root',
        'hacker',
        'anonymous',
        'guest_unverified',
        '<script>',
        "' OR 1=1 --",
        '__proto__',
        'constructor',
      ];

      for (const ir of invalidRoles) {
        assert.equal(
          isRoleAllowedOnWeb(ir),
          false,
          `Unauthorized role "${ir}" must return false`
        );
      }
    });

    test('isRoleAllowedOnWeb strictly returns boolean primitive', () => {
      const sampleInputs = ['owner', 'cashier', '', null, undefined, 'bogus'];
      for (const inp of sampleInputs) {
        const res = isRoleAllowedOnWeb(inp);
        assert.equal(typeof res, 'boolean', `Result for "${inp}" must be boolean, got ${typeof res}`);
      }
    });
  });

  // ==========================================================================
  // SUITE 7: AuthGuard getLandingPage Simulation & LocalStorage Parsing
  // ==========================================================================
  describe('Suite 7: AuthGuard getLandingPage Simulation & LocalStorage Resilience', () => {
    // Exact logic from frontend/src/components/layout/AuthGuard.tsx:
    // export function getLandingPage(): string {
    //   const isElectron = isElectronEnvironment();
    //   if (typeof window !== 'undefined') {
    //     try {
    //       const storedUser = localStorage.getItem('user');
    //       if (storedUser) {
    //         const u: UserRoleInfo = JSON.parse(storedUser);
    //         return getRoleDefaultRoute(u, isElectron);
    //       }
    //     } catch {}
    //   }
    //   return getRoleDefaultRoute(null, isElectron);
    // }
    function simulateGetLandingPage(mockStorageValue, isElectron) {
      if (mockStorageValue !== null && mockStorageValue !== undefined) {
        try {
          const u = JSON.parse(mockStorageValue);
          return getRoleDefaultRoute(u, isElectron);
        } catch {
          // JSON parse failed
        }
      }
      return getRoleDefaultRoute(null, isElectron);
    }

    test('Valid stored owner user routes to /cloud-portal', () => {
      const rawJson = JSON.stringify({ role: 'owner', email: 'demo.owner@orderitup.in' });
      assert.equal(simulateGetLandingPage(rawJson, false), '/cloud-portal');
      assert.equal(simulateGetLandingPage(rawJson, true), '/cloud-portal');
    });

    test('Valid stored cashier user routes to /dashboard on web and /pos on Electron', () => {
      const rawJson = JSON.stringify({ role: 'cashier', email: 'demo.cashier@orderitup.in' });
      assert.equal(simulateGetLandingPage(rawJson, false), '/dashboard', 'Cashier on web must land on /dashboard');
      assert.equal(simulateGetLandingPage(rawJson, true), '/pos', 'Cashier on desktop must land on /pos');
    });

    test('Valid stored manager user routes to /dashboard on both platforms', () => {
      const rawJson = JSON.stringify({ role: 'manager', email: 'demo.manager@orderitup.in' });
      assert.equal(simulateGetLandingPage(rawJson, false), '/dashboard');
      assert.equal(simulateGetLandingPage(rawJson, true), '/dashboard');
    });

    test('Corrupted/broken JSON in localStorage fails gracefully to unauthenticated landing', () => {
      const brokenJsons = [
        '{broken json',
        'undefined',
        'NaN',
        '<<<not json>>>',
        '',
      ];

      for (const broken of brokenJsons) {
        assert.equal(
          simulateGetLandingPage(broken, false),
          '/auth/login',
          `Broken JSON "${broken}" on web must fallback to /auth/login`
        );
        assert.equal(
          simulateGetLandingPage(broken, true),
          '/pos',
          `Broken JSON "${broken}" on electron must fallback to /pos`
        );
      }
    });

    test('Primitive JSON stored values (e.g. "123", "true", "null") are handled cleanly', () => {
      assert.equal(simulateGetLandingPage('null', false), '/auth/login');
      assert.equal(simulateGetLandingPage('null', true), '/pos');
      assert.equal(simulateGetLandingPage('123', false), '/dashboard');
      assert.equal(simulateGetLandingPage('true', false), '/dashboard');
    });

    test('Missing localStorage user key defaults to unauthenticated landing', () => {
      assert.equal(simulateGetLandingPage(null, false), '/auth/login');
      assert.equal(simulateGetLandingPage(null, true), '/pos');
      assert.equal(simulateGetLandingPage(undefined, false), '/auth/login');
      assert.equal(simulateGetLandingPage(undefined, true), '/pos');
    });
  });

});
