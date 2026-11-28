import {
  startLocalPos,
  type LocalPosHarness,
  type LocalPosHarnessOptions,
} from '../lib/local-pos-harness';
import {
  assert,
  assertEqual,
  assertJson,
  assertStatus,
  registerTest,
} from '../lib/test-kit';

const PNG_1X1_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function withLocalPos(
  optsOrFn: LocalPosHarnessOptions | ((pos: LocalPosHarness) => Promise<void>),
  maybeFn?: (pos: LocalPosHarness) => Promise<void>,
): Promise<void> {
  const opts = typeof optsOrFn === 'function' ? {} : optsOrFn;
  const fn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn!;
  let pos: LocalPosHarness | undefined;
  try {
    pos = await startLocalPos(opts);
    await fn(pos);
  } finally {
    if (pos) {
      await pos.stop();
    }
  }
}

async function createStaffMember(
  pos: LocalPosHarness,
  ownerToken: string,
  input: {
    name: string;
    email: string;
    password: string;
    role: 'owner' | 'manager' | 'cashier' | 'server' | 'chef';
    pin?: string;
  },
): Promise<{ id: string; token: string; staff: Record<string, unknown> }> {
  const createRes = await pos.request('main', '/api/staff', {
    method: 'POST',
    token: ownerToken,
    body: input,
  });
  const created = assertJson<{ staff: { id: string } & Record<string, unknown> }>(
    createRes,
    201,
    (d) => typeof d.staff?.id === 'string',
  );
  const loginRes = await pos.login(input.email, input.password, 'main');
  return { id: created.staff.id, token: loginRes.token, staff: created.staff };
}

// ============================================================================
// F1: Local Startup, Health & Central Admin (5 Tier 1 + 5 Tier 2 = 10 tests)
// ============================================================================

registerTest({
  id: 'f1:t1:all-three-health-endpoints',
  tier: 1,
  feature: 'F1',
  title: 'All three local POS servers (main, kds, serverApp) respond 200 on /api/health',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const mainHealth = await pos.request('main', '/api/health');
      assertJson(
        mainHealth,
        200,
        (d) =>
          d.status === 'ok' &&
          d.db === 'ok' &&
          d.service === 'Order It Up Local API' &&
          typeof d.timestamp === 'string',
      );

      const kdsHealth = await pos.request('kds', '/api/health');
      assertJson(
        kdsHealth,
        200,
        (d) => d.status === 'ok' && d.service === 'Order It Up KDS Server',
      );

      const serverAppHealth = await pos.request('serverApp', '/api/health');
      assertJson(
        serverAppHealth,
        200,
        (d) => d.status === 'ok' && d.service === 'Order It Up Server App',
      );
    });
  },
});

registerTest({
  id: 'f1:t1:admin-login-and-me',
  tier: 1,
  feature: 'F1',
  title: 'Admin operator logs in and retrieves identity via GET /api/admin/me',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const loginRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: pos.adminCredentials,
      });
      const loginData = assertJson<{
        ok: boolean;
        token: string;
        operator: { id: string; email: string; role: string };
      }>(
        loginRes,
        200,
        (d) =>
          d.ok === true &&
          typeof d.token === 'string' &&
          d.token.length > 20 &&
          d.operator?.id === 'bootstrap-platform-admin' &&
          d.operator?.role === 'SUPER_ADMIN',
      );
      assertEqual(loginData.operator.email, pos.adminCredentials.email);

      const meRes = await pos.request('main', '/api/admin/me', {
        token: loginData.token,
      });
      const meData = assertJson<{
        ok: boolean;
        operator: { id: string; email: string; role: string };
      }>(meRes, 200, (d) => d.ok === true);
      assertEqual(meData.operator.email, pos.adminCredentials.email);
      assertEqual(meData.operator.role, 'SUPER_ADMIN');
    });
  },
});

registerTest({
  id: 'f1:t1:admin-metrics',
  tier: 1,
  feature: 'F1',
  title: 'GET /api/admin/metrics returns local SQLite health and non-fabricated global metrics',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const loginRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: pos.adminCredentials,
      });
      const { token } = assertJson<{ token: string }>(loginRes, 200);

      const metricsRes = await pos.request('main', '/api/admin/metrics', { token });
      assertJson(
        metricsRes,
        200,
        (d) =>
          d.ok === true &&
          d.metrics?.tenantMetricsAvailable === false &&
          d.metrics?.totalStores === null &&
          d.metrics?.localSystemHealth?.sqliteOk === true &&
          typeof d.metrics?.localSystemHealth?.localBillsCount === 'number' &&
          typeof d.metrics?.localSystemHealth?.localOrdersCount === 'number' &&
          typeof d.metrics?.cloudSync === 'object' &&
          typeof d.metrics?.s3Backup === 'object',
      );
    });
  },
});

registerTest({
  id: 'f1:t1:admin-tenants-fail-closed',
  tier: 1,
  feature: 'F1',
  title: 'Admin tenant directory and plan mutation endpoints fail closed with 503 locally',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const loginRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: pos.adminCredentials,
      });
      const { token } = assertJson<{ token: string }>(loginRes, 200);

      const tenantsRes = await pos.request('main', '/api/admin/tenants', { token });
      assertJson(
        tenantsRes,
        503,
        (d) =>
          d.ok === false &&
          d.availability === 'unavailable' &&
          Array.isArray(d.tenants) &&
          d.tenants.length === 0,
      );

      const planRes = await pos.request('main', '/api/admin/tenants/1/plan', {
        method: 'POST',
        token,
        body: { plan: 'pro' },
      });
      assertJson(
        planRes,
        503,
        (d) => d.ok === false && d.availability === 'unavailable',
      );
    });
  },
});

registerTest({
  id: 'f1:t1:admin-trigger-backup-mock',
  tier: 1,
  feature: 'F1',
  title: 'POST /api/admin/system/trigger-backup succeeds offline via local mock-s3 storage',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const loginRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: pos.adminCredentials,
      });
      const { token } = assertJson<{ token: string }>(loginRes, 200);

      const backupRes = await pos.request('main', '/api/admin/system/trigger-backup', {
        method: 'POST',
        token,
        body: {},
      });
      assertJson(
        backupRes,
        200,
        (d) =>
          d.ok === true &&
          d.result?.success === true &&
          typeof d.result?.key === 'string' &&
          d.result.key.length > 0 &&
          typeof d.result?.size === 'number' &&
          d.result.size > 0,
      );
    });
  },
});

registerTest({
  id: 'f1:t2:admin-login-unconfigured-503',
  tier: 2,
  feature: 'F1',
  title: 'POST /api/admin/login returns 503 when OIU_ADMIN_* bootstrap env vars are unset',
  async run(): Promise<void> {
    await withLocalPos(
      {
        env: {
          OIU_ADMIN_BOOTSTRAP_EMAIL: undefined,
          OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH: undefined,
        },
      },
      async (pos) => {
        const res = await pos.request('main', '/api/admin/login', {
          method: 'POST',
          body: { email: 'admin@e2e.local', password: 'AdminPass123!' },
        });
        assertJson(res, 503, (d) => d.ok === false && typeof d.error === 'string');
      },
    );
  },
});

registerTest({
  id: 'f1:t2:admin-login-bad-creds-401',
  tier: 2,
  feature: 'F1',
  title: 'POST /api/admin/login rejects missing fields with 400 and invalid credentials with 401',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const missingRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: { email: pos.adminCredentials.email },
      });
      assertJson(missingRes, 400, (d) => d.ok === false);

      const badPassRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: {
          email: pos.adminCredentials.email,
          password: 'WrongPassword999!',
        },
      });
      assertJson(badPassRes, 401, (d) => d.ok === false);

      const badEmailRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: {
          email: 'nobody@e2e.local',
          password: pos.adminCredentials.password,
        },
      });
      assertJson(badEmailRes, 401, (d) => d.ok === false);
    });
  },
});

registerTest({
  id: 'f1:t2:admin-routes-missing-bad-jwt-401',
  tier: 2,
  feature: 'F1',
  title: 'Protected admin routes reject missing or malformed JWTs with 401',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const noTokenMe = await pos.request('main', '/api/admin/me');
      assertStatus(noTokenMe, 401, 'admin/me without token');

      const badTokenMe = await pos.request('main', '/api/admin/me', {
        token: 'not.a.valid.jwt',
      });
      assertStatus(badTokenMe, 401, 'admin/me with malformed token');

      const noTokenMetrics = await pos.request('main', '/api/admin/metrics');
      assertStatus(noTokenMetrics, 401, 'admin/metrics without token');

      const badTokenMetrics = await pos.request('main', '/api/admin/metrics', {
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.invalid',
      });
      assertStatus(badTokenMetrics, 401, 'admin/metrics with bad signature');
    });
  },
});

registerTest({
  id: 'f1:t2:staff-jwt-rejected-on-admin-401',
  tier: 2,
  feature: 'F1',
  title: 'POS owner staff JWT is rejected with 401 on admin operator endpoints',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const meRes = await pos.request('main', '/api/admin/me', { token: owner.token });
      assertStatus(meRes, 401, 'staff JWT on /api/admin/me');

      const metricsRes = await pos.request('main', '/api/admin/metrics', { token: owner.token });
      assertStatus(metricsRes, 401, 'staff JWT on /api/admin/metrics');

      const backupRes = await pos.request('main', '/api/admin/system/trigger-backup', {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertStatus(backupRes, 401, 'staff JWT on /api/admin/system/trigger-backup');
    });
  },
});

registerTest({
  id: 'f1:t2:admin-jwt-rejected-on-pos-api-401',
  tier: 2,
  feature: 'F1',
  title: 'Admin operator JWT is rejected with 401 on POS operational endpoints',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      await pos.setupOwner({ setup_profile: 'empty' });

      const loginRes = await pos.request('main', '/api/admin/login', {
        method: 'POST',
        body: pos.adminCredentials,
      });
      const { token: adminToken } = assertJson<{ token: string }>(loginRes, 200);

      const catRes = await pos.request('main', '/api/categories', { token: adminToken });
      assertStatus(catRes, 401, 'admin JWT on /api/categories');

      const authMeRes = await pos.request('main', '/api/auth/me', { token: adminToken });
      assertStatus(authMeRes, 401, 'admin JWT on /api/auth/me');
    });
  },
});

// ============================================================================
// F2: Local Auth, RBAC, Revocation & Master PIN (6 Tier 1 + 7 Tier 2 = 13 tests)
// ============================================================================

registerTest({
  id: 'f2:t1:setup-status-and-initialize',
  tier: 1,
  feature: 'F2',
  title: 'Initial setup/status reports needsSetup=true and initialize transitions to owner session',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const beforeRes = await pos.request('main', '/api/auth/setup/status');
      assertJson(
        beforeRes,
        200,
        (d) =>
          d.needsSetup === true &&
          d.userCount === 0 &&
          d.initialRole === 'owner' &&
          typeof d.schemaVersion === 'number' &&
          d.masterPinAvailable === false,
      );

      const initRes = await pos.request('main', '/api/auth/setup/initialize', {
        method: 'POST',
        body: {
          name: 'First Owner',
          email: 'owner@e2e.local',
          password: 'OwnerPass123!',
          business_name: 'E2E Bistro',
          setup_profile: 'empty',
          service_model: 'qsr',
          country: 'IN',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          terms_accepted: true,
        },
      });
      assertJson(
        initRes,
        200,
        (d) =>
          typeof d.access_token === 'string' &&
          d.access_token.length > 20 &&
          d.token_type === 'bearer' &&
          d.user?.role === 'owner' &&
          d.user?.email === 'owner@e2e.local' &&
          typeof d.tenant === 'object' &&
          Array.isArray(d.tenants) &&
          d.tenants.length === 1,
      );

      const afterRes = await pos.request('main', '/api/auth/setup/status');
      assertJson(
        afterRes,
        200,
        (d) => d.needsSetup === false && d.userCount === 1,
      );
    });
  },
});

registerTest({
  id: 'f2:t1:login-me-refresh-tenant-select',
  tier: 1,
  feature: 'F2',
  title: 'Login normalizes email, /me returns profile, tenants/select and refresh issue valid JWTs',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const loginRes = await pos.request('main', '/api/auth/login', {
        method: 'POST',
        body: { email: `  ${owner.email.toUpperCase()}  `, password: owner.password },
      });
      const loginData = assertJson<{
        access_token: string;
        token_type: string;
        user: { id: string; email: string; role: string };
        tenants: unknown[];
      }>(
        loginRes,
        200,
        (d) =>
          typeof d.access_token === 'string' &&
          d.token_type === 'bearer' &&
          d.user?.email === owner.email &&
          d.user?.role === 'owner' &&
          Array.isArray(d.tenants),
      );

      const meRes = await pos.request('main', '/api/auth/me', {
        token: loginData.access_token,
      });
      assertJson(
        meRes,
        200,
        (d) => d.user?.id === owner.user.id && d.user?.role === 'owner' && Array.isArray(d.tenants),
      );

      const selectRes = await pos.request('main', '/api/auth/tenants/select', {
        method: 'POST',
        token: loginData.access_token,
        body: {},
      });
      const selectData = assertJson<{ access_token: string; tenant: { id: unknown } }>(
        selectRes,
        200,
        (d) => typeof d.access_token === 'string' && typeof d.tenant === 'object',
      );

      const refreshRes = await pos.request('main', '/api/auth/refresh', {
        method: 'POST',
        token: selectData.access_token,
        body: {},
      });
      const refreshData = assertJson<{ access_token: string; token_type: string; expires_in: number }>(
        refreshRes,
        200,
        (d) => typeof d.access_token === 'string' && d.token_type === 'bearer' && d.expires_in > 0,
      );

      const meAfterRefresh = await pos.request('main', '/api/auth/me', {
        token: refreshData.access_token,
      });
      assertJson(meAfterRefresh, 200, (d) => d.user?.id === owner.user.id);
    });
  },
});

registerTest({
  id: 'f2:t1:logout-revokes-token',
  tier: 1,
  feature: 'F2',
  title: 'POST /api/auth/logout revokes active JWT across /me, /refresh, and API routes and is idempotent',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const logout1 = await pos.request('main', '/api/auth/logout', {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertJson(logout1, 200, (d) => typeof d.message === 'string');

      const meAfter = await pos.request('main', '/api/auth/me', { token: owner.token });
      assertStatus(meAfter, 401, '/api/auth/me after logout');

      const refreshAfter = await pos.request('main', '/api/auth/refresh', {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertStatus(refreshAfter, 401, '/api/auth/refresh after logout');

      const categoriesAfter = await pos.request('main', '/api/categories', {
        token: owner.token,
      });
      assertStatus(categoriesAfter, 401, '/api/categories after logout');

      const logout2 = await pos.request('main', '/api/auth/logout', {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertJson(logout2, 200);
    });
  },
});

registerTest({
  id: 'f2:t1:password-change-invalidates-prior-jwt',
  tier: 1,
  feature: 'F2',
  title: 'POST /api/auth/password/change updates credentials and invalidates prior JWTs',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });
      const oldToken = owner.token;
      const newPassword = 'NewOwnerPass456!';

      // Cross the 1-second JWT `iat` boundary so `tokens_valid_after > iat`.
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));

      const changeRes = await pos.request('main', '/api/auth/password/change', {
        method: 'POST',
        token: oldToken,
        body: {
          current_password: owner.password,
          password: newPassword,
        },
      });
      assertJson(changeRes, 200, (d) => typeof d.message === 'string');

      const meOld = await pos.request('main', '/api/auth/me', { token: oldToken });
      assertStatus(meOld, 401, 'old token on /api/auth/me');

      const refreshOld = await pos.request('main', '/api/auth/refresh', {
        method: 'POST',
        token: oldToken,
        body: {},
      });
      assertStatus(refreshOld, 401, 'old token on /api/auth/refresh');

      const catOld = await pos.request('main', '/api/categories', { token: oldToken });
      assertStatus(catOld, 401, 'old token on /api/categories');

      const newLogin = await pos.login(owner.email, newPassword, 'main');
      const meNew = await pos.request('main', '/api/auth/me', { token: newLogin.token });
      assertJson(meNew, 200, (d) => d.user?.id === owner.user.id);
    });
  },
});

registerTest({
  id: 'f2:t1:create-all-five-roles-and-dual-mount',
  tier: 1,
  feature: 'F2',
  title: 'Owner creates manager/cashier/server/chef, all 5 roles log in, and /api/users mirrors /api/staff',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const manager = await createStaffMember(pos, owner.token, {
        name: 'Alice Manager',
        email: 'manager@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: '2468',
      });
      assertEqual(Boolean(manager.staff.has_pin), true);

      await createStaffMember(pos, owner.token, {
        name: 'Bob Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      await createStaffMember(pos, owner.token, {
        name: 'Cara Server',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      await createStaffMember(pos, owner.token, {
        name: 'Dan Chef',
        email: 'chef@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });

      const usersRes = await pos.request('main', '/api/users', { token: owner.token });
      const usersData = assertJson<{ staff: Array<{ role: string }> }>(
        usersRes,
        200,
        (d) => Array.isArray(d.staff) && d.staff.length === 5,
      );
      const roles = new Set(usersData.staff.map((s) => s.role));
      for (const expectedRole of ['owner', 'manager', 'cashier', 'server', 'chef']) {
        assert(roles.has(expectedRole), `Expected role ${expectedRole} in /api/users`);
      }

      const filteredRes = await pos.request('main', '/api/staff?role=manager', {
        token: owner.token,
      });
      assertJson(
        filteredRes,
        200,
        (d) => Array.isArray(d.staff) && d.staff.length === 1 && d.staff[0].id === manager.id,
      );

      const singleRes = await pos.request('main', `/api/staff/${manager.id}`, {
        token: owner.token,
      });
      assertJson(
        singleRes,
        200,
        (d) => d.staff?.id === manager.id && typeof d.staff?.performance === 'object',
      );
    });
  },
});

registerTest({
  id: 'f2:t1:staff-update-deactivate-reactivate',
  tier: 1,
  feature: 'F2',
  title: 'Staff update, deactivation revoking active sessions, and reactivation work end-to-end',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });
      const cashier = await createStaffMember(pos, owner.token, {
        name: 'Original Cashier',
        email: 'cashier1@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });

      const updateRes = await pos.request('main', `/api/staff/${cashier.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { name: 'Updated Cashier' },
      });
      assertJson(updateRes, 200, (d) => d.staff?.name === 'Updated Cashier');

      const deactivateRes = await pos.request('main', `/api/staff/${cashier.id}/deactivate`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(deactivateRes, 200, (d) => d.staff?.is_active === 0);

      const rejectedApi = await pos.request('main', '/api/categories', {
        token: cashier.token,
      });
      assertStatus(rejectedApi, 401, 'deactivated staff token on /api/categories');

      const rejectedLogin = await pos.request('main', '/api/auth/login', {
        method: 'POST',
        body: { email: 'cashier1@e2e.local', password: 'StaffPass123!' },
      });
      assertStatus(rejectedLogin, 401, 'deactivated staff login');

      const reactivateRes = await pos.request('main', `/api/staff/${cashier.id}/reactivate`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(reactivateRes, 200, (d) => d.staff?.is_active === 1);

      const newLogin = await pos.login('cashier1@e2e.local', 'StaffPass123!', 'main');
      assert(newLogin.token.length > 20, 'Expected reactivated staff login to succeed');
    });
  },
});

registerTest({
  id: 'f2:t2:duplicate-initialize-403-and-seed-410',
  tier: 2,
  feature: 'F2',
  title: 'Second /api/auth/setup/initialize returns 403 and legacy /setup/seed returns 410',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      await pos.setupOwner({ setup_profile: 'empty' });

      const dupRes = await pos.request('main', '/api/auth/setup/initialize', {
        method: 'POST',
        body: {
          name: 'Second Owner',
          email: 'owner2@e2e.local',
          password: 'OwnerPass123!',
          business_name: 'Dup Bistro',
          setup_profile: 'empty',
          service_model: 'qsr',
          country: 'IN',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          terms_accepted: true,
        },
      });
      assertStatus(dupRes, 403, 'duplicate setup/initialize');

      const seedRes = await pos.request('main', '/api/auth/setup/seed', {
        method: 'POST',
        body: {},
      });
      assertStatus(seedRes, 410, 'legacy setup/seed');
    });
  },
});

registerTest({
  id: 'f2:t2:weak-password-rejected-400',
  tier: 2,
  feature: 'F2',
  title: 'Weak passwords are rejected with 400 on setup/initialize, password/change, and staff creation',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      for (const weak of ['short', 'alllowercase1', 'NoDigitsHere']) {
        const initWeak = await pos.request('main', '/api/auth/setup/initialize', {
          method: 'POST',
          body: {
            name: 'Owner',
            email: 'owner@e2e.local',
            password: weak,
            business_name: 'Weak Test',
            setup_profile: 'empty',
            service_model: 'qsr',
            country: 'IN',
            currency: 'INR',
            timezone: 'Asia/Kolkata',
            terms_accepted: true,
          },
        });
        assertStatus(initWeak, 400, `weak password on initialize: ${weak}`);
      }

      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const changeWeak = await pos.request('main', '/api/auth/password/change', {
        method: 'POST',
        token: owner.token,
        body: { current_password: owner.password, password: 'alllowercase1' },
      });
      assertStatus(changeWeak, 400, 'weak password on password/change');

      const staffWeak = await pos.request('main', '/api/staff', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Weak Staff',
          email: 'weak@e2e.local',
          password: 'NoDigitsHere',
          role: 'cashier',
        },
      });
      assertStatus(staffWeak, 400, 'weak password on POST /api/staff');
    });
  },
});

registerTest({
  id: 'f2:t2:operational-role-pin-rejected-400',
  tier: 2,
  feature: 'F2',
  title: 'Operational roles cannot be assigned a PIN and invalid manager PIN formats return 400',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      for (const role of ['cashier', 'server', 'chef'] as const) {
        const res = await pos.request('main', '/api/staff', {
          method: 'POST',
          token: owner.token,
          body: {
            name: `Bad Pin ${role}`,
            email: `${role}-pin@e2e.local`,
            password: 'StaffPass123!',
            role,
            pin: '1234',
          },
        });
        assertStatus(res, 400, `PIN rejected for ${role}`);
      }

      const cashier = await createStaffMember(pos, owner.token, {
        name: 'Clean Cashier',
        email: 'clean-cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const putPin = await pos.request('main', `/api/staff/${cashier.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { pin: '5678' },
      });
      assertStatus(putPin, 400, 'PUT PIN onto cashier');

      const badMgrPin = await pos.request('main', '/api/staff', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Bad Mgr Pin',
          email: 'badmgr@e2e.local',
          password: 'StaffPass123!',
          role: 'manager',
          pin: '12a4',
        },
      });
      assertStatus(badMgrPin, 400, 'non-numeric manager PIN');
    });
  },
});

registerTest({
  id: 'f2:t2:manager-privilege-escalation-403',
  tier: 2,
  feature: 'F2',
  title: 'Managers cannot create owner/manager accounts, modify owners, or change staff roles',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });
      const manager = await createStaffMember(pos, owner.token, {
        name: 'Manager',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: '1111',
      });

      const createOwner = await pos.request('main', '/api/staff', {
        method: 'POST',
        token: manager.token,
        body: {
          name: 'Rogue Owner',
          email: 'rogue@e2e.local',
          password: 'StaffPass123!',
          role: 'owner',
        },
      });
      assertStatus(createOwner, 403, 'manager creating owner');

      const createManager = await pos.request('main', '/api/staff', {
        method: 'POST',
        token: manager.token,
        body: {
          name: 'Peer Manager',
          email: 'peer@e2e.local',
          password: 'StaffPass123!',
          role: 'manager',
        },
      });
      assertStatus(createManager, 403, 'manager creating manager');

      const editOwner = await pos.request('main', `/api/staff/${owner.user.id}`, {
        method: 'PUT',
        token: manager.token,
        body: { name: 'Hacked Owner' },
      });
      assertStatus(editOwner, 403, 'manager editing owner');

      const deactivateOwner = await pos.request(
        'main',
        `/api/staff/${owner.user.id}/deactivate`,
        { method: 'POST', token: manager.token },
      );
      assertStatus(deactivateOwner, 403, 'manager deactivating owner');

      const cashier = await createStaffMember(pos, owner.token, {
        name: 'Target Cashier',
        email: 'target-cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const promoteCashier = await pos.request('main', `/api/staff/${cashier.id}`, {
        method: 'PUT',
        token: manager.token,
        body: { role: 'server' },
      });
      assertStatus(promoteCashier, 403, 'manager changing role');
    });
  },
});

registerTest({
  id: 'f2:t2:cannot-deactivate-or-demote-last-owner-400',
  tier: 2,
  feature: 'F2',
  title: 'System refuses to deactivate or demote the sole active owner (400)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const deactivateRes = await pos.request(
        'main',
        `/api/staff/${owner.user.id}/deactivate`,
        { method: 'POST', token: owner.token },
      );
      assertStatus(deactivateRes, 400, 'deactivate last owner');

      const demoteRes = await pos.request('main', `/api/staff/${owner.user.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { role: 'manager' },
      });
      assertStatus(demoteRes, 400, 'demote last owner');
    });
  },
});

registerTest({
  id: 'f2:t2:recover-password-safestorage-unavailable-503',
  tier: 2,
  feature: 'F2',
  title: 'POST /api/auth/recover-password returns 409 before setup and 503 when safeStorage is unavailable',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const beforeSetup = await pos.request('main', '/api/auth/recover-password', {
        method: 'POST',
        body: {
          email: 'owner@e2e.local',
          master_pin: '1234',
          new_password: 'RecoveredPass123!',
        },
      });
      assertStatus(beforeSetup, 409, 'recover-password with 0 users');

      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const afterSetup = await pos.request('main', '/api/auth/recover-password', {
        method: 'POST',
        body: {
          email: owner.email,
          master_pin: '1234',
          new_password: 'RecoveredPass123!',
        },
      });
      assertStatus(afterSetup, 503, 'recover-password without OS safeStorage');
    });
  },
});

registerTest({
  id: 'f2:t2:bad-credentials-and-unauthenticated-api-401',
  tier: 2,
  feature: 'F2',
  title: 'Wrong password returns 401, unauthenticated /api/staff returns 401, operational roles get 403',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const badLogin = await pos.request('main', '/api/auth/login', {
        method: 'POST',
        body: { email: owner.email, password: 'WrongPassword123!' },
      });
      assertStatus(badLogin, 401, 'wrong login password');

      const unauthStaff = await pos.request('main', '/api/staff');
      assertStatus(unauthStaff, 401, 'unauthenticated GET /api/staff');

      for (const role of ['cashier', 'server', 'chef'] as const) {
        const staff = await createStaffMember(pos, owner.token, {
          name: `Op ${role}`,
          email: `${role}-rbac@e2e.local`,
          password: 'StaffPass123!',
          role,
        });
        const forbiddenRes = await pos.request('main', '/api/staff', { token: staff.token });
        assertStatus(forbiddenRes, 403, `${role} on GET /api/staff`);
      }
    });
  },
});

// ============================================================================
// F3: Local Catalog, Menu, Addons & CSV (6 Tier 1 + 6 Tier 2 = 12 tests)
// ============================================================================

registerTest({
  id: 'f3:t1:categories-crud-and-hierarchy',
  tier: 1,
  feature: 'F3',
  title: 'Categories CRUD, parent/child hierarchy filtering, update, and deletion work end-to-end',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const parentRes = await pos.request('main', '/api/categories', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Drinks', description: 'All beverages', sort_order: 1 },
      });
      const parentId = assertJson<{ category: { id: string; name: string } }>(
        parentRes,
        201,
        (d) => d.category?.name === 'Drinks',
      ).category.id;

      const childRes = await pos.request('main', '/api/categories', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Hot Coffee', parent_id: parentId, sort_order: 2 },
      });
      const childId = assertJson<{ category: { id: string; parent_id: string } }>(
        childRes,
        201,
        (d) => d.category?.parent_id === parentId,
      ).category.id;

      const rootsRes = await pos.request('main', '/api/categories?root=true', {
        token: owner.token,
      });
      assertJson(
        rootsRes,
        200,
        (d) =>
          Array.isArray(d.categories) &&
          d.categories.some((c: { id: string }) => c.id === parentId) &&
          !d.categories.some((c: { id: string }) => c.id === childId),
      );

      const childrenList = await pos.request('main', `/api/categories?parent_id=${parentId}`, {
        token: owner.token,
      });
      assertJson(
        childrenList,
        200,
        (d) => d.categories.length === 1 && d.categories[0].id === childId,
      );

      const getParent = await pos.request('main', `/api/categories/${parentId}`, {
        token: owner.token,
      });
      assertJson(
        getParent,
        200,
        (d) =>
          d.category?.id === parentId &&
          Array.isArray(d.category?.children) &&
          d.category.children.length === 1,
      );

      const updateChild = await pos.request('main', `/api/categories/${childId}`, {
        method: 'PUT',
        token: owner.token,
        body: { name: 'Specialty Coffee', color: 'amber' },
      });
      assertJson(
        updateChild,
        200,
        (d) => d.category?.name === 'Specialty Coffee' && d.category?.color === 'amber',
      );

      const delChild = await pos.request('main', `/api/categories/${childId}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertStatus(delChild, 200, 'delete child category');

      const delParent = await pos.request('main', `/api/categories/${parentId}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertStatus(delParent, 200, 'delete empty parent category');
    });
  },
});

registerTest({
  id: 'f3:t1:products-crud-weighted-stock-and-image',
  tier: 1,
  feature: 'F3',
  title: 'Weighted product CRUD, public image endpoint + ETag, barcode lookup, and stock mutations',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const catRes = await pos.request('main', '/api/categories', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Deli' },
      });
      const categoryId = assertJson<{ category: { id: string } }>(catRes, 201).category.id;

      const createRes = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Artisan Cheese',
          category_id: categoryId,
          price: 450,
          sale_unit: 'kg',
          allow_fractional_quantity: true,
          weight_precision: 3,
          barcode: '1234567890123',
          track_inventory: true,
          stock_quantity: 10,
          low_stock_threshold: 3,
          image_url: PNG_1X1_DATA_URI,
        },
      });
      const productId = assertJson<{
        product: {
          id: string;
          sale_unit: string;
          allow_fractional_quantity: boolean;
          weight_precision: number;
          stock_quantity: number;
        };
      }>(
        createRes,
        201,
        (d) =>
          d.product?.sale_unit === 'kg' &&
          d.product?.allow_fractional_quantity === true &&
          d.product?.weight_precision === 3,
      ).product.id;

      // Public image endpoint (no JWT)
      const imgRes = await pos.request('main', `/api/products/${productId}/image`);
      assertStatus(imgRes, 200, 'public product image');
      const contentType = imgRes.headers.get('content-type') ?? '';
      assert(contentType.includes('image/png'), `Expected image/png, got ${contentType}`);
      const etag = imgRes.headers.get('etag');
      assert(Boolean(etag), 'Expected ETag header on product image');

      const barcodeRes = await pos.request('main', '/api/products?barcode=1234567890123', {
        token: owner.token,
      });
      assertJson(
        barcodeRes,
        200,
        (d) => d.products?.length === 1 && d.products[0].id === productId,
      );

      const setStock = await pos.request('main', `/api/products/${productId}/stock`, {
        method: 'POST',
        token: owner.token,
        body: { action: 'set', quantity: 15 },
      });
      assertJson(setStock, 200, (d) => d.product?.stock_quantity === 15);

      const incStock = await pos.request('main', `/api/products/${productId}/stock`, {
        method: 'POST',
        token: owner.token,
        body: { action: 'increase', quantity: 5 },
      });
      assertJson(incStock, 200, (d) => d.product?.stock_quantity === 20);

      const decStock = await pos.request('main', `/api/products/${productId}/stock`, {
        method: 'POST',
        token: owner.token,
        body: { action: 'decrease', quantity: 18 },
      });
      assertJson(decStock, 200, (d) => d.product?.stock_quantity === 2);

      const lowStockRes = await pos.request('main', '/api/products?low_stock=true', {
        token: owner.token,
      });
      assertJson(
        lowStockRes,
        200,
        (d) => d.products.some((p: { id: string }) => p.id === productId),
      );

      const updateRes = await pos.request('main', `/api/products/${productId}`, {
        method: 'PUT',
        token: owner.token,
        body: { price: 480 },
      });
      assertJson(updateRes, 200, (d) => d.product?.price === 480);

      const delRes = await pos.request('main', `/api/products/${productId}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertStatus(delRes, 200, 'delete product');

      const afterDel = await pos.request('main', `/api/products/${productId}`, {
        token: owner.token,
      });
      assertStatus(afterDel, 404, 'get deleted product');
    });
  },
});

registerTest({
  id: 'f3:t1:toggle-86-across-roles',
  tier: 1,
  feature: 'F3',
  title: 'Chef and cashier can toggle product 86 out-of-stock state and restore availability',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });
      const chef = await createStaffMember(pos, owner.token, {
        name: 'Chef 86',
        email: 'chef86@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });
      const cashier = await createStaffMember(pos, owner.token, {
        name: 'Cashier 86',
        email: 'cashier86@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });

      const prodRes = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Truffle Pasta', price: 320 },
      });
      const productId = assertJson<{ product: { id: string } }>(prodRes, 201).product.id;

      const outRes = await pos.request('main', `/api/products/${productId}/toggle-86`, {
        method: 'POST',
        token: chef.token,
        body: {},
      });
      assertJson(
        outRes,
        200,
        (d) =>
          d.is_86 === true &&
          d.status === '86_out_of_stock' &&
          d.product?.is_active === false,
      );

      const backRes = await pos.request('main', `/api/products/${productId}/toggle-86`, {
        method: 'POST',
        token: cashier.token,
        body: {},
      });
      assertJson(
        backRes,
        200,
        (d) =>
          d.is_86 === false &&
          d.status === 'available' &&
          d.product?.is_active === true,
      );
    });
  },
});

registerTest({
  id: 'f3:t1:addon-groups-and-addons-crud',
  tier: 1,
  feature: 'F3',
  title: 'Addon groups and nested addons CRUD plus product linkage work end-to-end',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const groupRes = await pos.request('main', '/api/addon-groups', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Toppings',
          is_required: false,
          min_selection: 0,
          max_selection: 3,
          allow_multiple_quantities: true,
          addons: [
            { name: 'Extra Cheese', price: 35 },
            { name: 'Jalapenos', price: 20 },
          ],
        },
      });
      const group = assertJson<{
        addon_group: { id: string; addons: Array<{ id: string; name: string }> };
      }>(
        groupRes,
        201,
        (d) => d.addon_group?.addons?.length === 2,
      ).addon_group;

      const addAddonRes = await pos.request('main', `/api/addon-groups/${group.id}/addons`, {
        method: 'POST',
        token: owner.token,
        body: { name: 'Olives', price: 25 },
      });
      const newAddonId = assertJson<{ addon: { id: string; name: string } }>(
        addAddonRes,
        201,
        (d) => d.addon?.name === 'Olives',
      ).addon.id;

      const updAddonRes = await pos.request(
        'main',
        `/api/addon-groups/${group.id}/addons/${newAddonId}`,
        {
          method: 'PUT',
          token: owner.token,
          body: { price: 30 },
        },
      );
      assertJson(updAddonRes, 200, (d) => d.addon?.price === 30);

      const prodRes = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Margherita Pizza',
          price: 299,
          addon_group_ids: [group.id],
        },
      });
      const productId = assertJson<{ product: { id: string } }>(prodRes, 201).product.id;

      const getProdRes = await pos.request('main', `/api/products/${productId}`, {
        token: owner.token,
      });
      assertJson(
        getProdRes,
        200,
        (d) =>
          Array.isArray(d.product?.addon_groups) &&
          d.product.addon_groups.length === 1 &&
          d.product.addon_groups[0].id === group.id,
      );

      const delAddonRes = await pos.request(
        'main',
        `/api/addon-groups/${group.id}/addons/${newAddonId}`,
        { method: 'DELETE', token: owner.token },
      );
      assertStatus(delAddonRes, 200, 'delete addon');

      const delGroupRes = await pos.request('main', `/api/addon-groups/${group.id}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertStatus(delGroupRes, 200, 'delete addon group');
    });
  },
});

registerTest({
  id: 'f3:t1:csv-templates-and-export',
  tier: 1,
  feature: 'F3',
  title: 'Menu CSV template and export endpoints return valid text/csv payloads',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      for (const [type, expectedHeader] of [
        ['categories', 'name,description,color,icon,sort_order'],
        ['products', 'id,sku,name,category,price,description,cost'],
        ['addons', 'group_name,addon_name,price,group_required'],
      ] as const) {
        const tplRes = await pos.request('main', `/api/menu-csv/template/${type}`, {
          token: owner.token,
        });
        assertStatus(tplRes, 200, `template/${type}`);
        const ct = tplRes.headers.get('content-type') ?? '';
        assert(ct.includes('text/csv'), `Expected text/csv for ${type}, got ${ct}`);
        assert(
          tplRes.rawText.startsWith(expectedHeader),
          `Unexpected CSV template header for ${type}: ${tplRes.rawText.slice(0, 80)}`,
        );
      }

      const catRes = await pos.request('main', '/api/categories', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Bakery' },
      });
      const catId = assertJson<{ category: { id: string } }>(catRes, 201).category.id;

      await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Croissant', category_id: catId, price: 95 },
      });

      await pos.request('main', '/api/addon-groups', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Spread',
          addons: [{ name: 'Butter', price: 15 }],
        },
      });

      const expCat = await pos.request('main', '/api/menu-csv/export/categories', {
        token: owner.token,
      });
      assertStatus(expCat, 200, 'export/categories');
      assert(expCat.rawText.includes('Bakery'), 'Expected exported categories CSV to contain Bakery');

      const expProd = await pos.request('main', '/api/menu-csv/export/products', {
        token: owner.token,
      });
      assertStatus(expProd, 200, 'export/products');
      assert(expProd.rawText.includes('Croissant'), 'Expected exported products CSV to contain Croissant');

      const expAddons = await pos.request('main', '/api/menu-csv/export/addons', {
        token: owner.token,
      });
      assertStatus(expAddons, 200, 'export/addons');
      assert(expAddons.rawText.includes('Butter'), 'Expected exported addons CSV to contain Butter');
    });
  },
});

registerTest({
  id: 'f3:t1:csv-import-categories-products-addons',
  tier: 1,
  feature: 'F3',
  title: 'Menu CSV import creates categories, products, and addons with accurate counts and deduplication',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const catCsv = [
        'name,description,color,icon,sort_order',
        'CsvBeverages,Drinks,blue,,1',
        'CsvSnacks,Light bites,green,,2',
      ].join('\n');

      const catImport1 = await pos.request('main', '/api/menu-csv/import/categories', {
        method: 'POST',
        token: owner.token,
        body: { csv: catCsv },
      });
      assertJson(
        catImport1,
        200,
        (d) => d.created === 2 && d.skipped === 0 && d.failed === 0,
      );

      const catImport2 = await pos.request('main', '/api/menu-csv/import/categories', {
        method: 'POST',
        token: owner.token,
        body: { csv: catCsv },
      });
      assertJson(
        catImport2,
        200,
        (d) => d.created === 0 && d.skipped === 2 && d.failed === 0,
      );

      const prodCsv = [
        'id,sku,name,category,price,description,cost,tax_category,tax_behavior,cashback_percent,tags,is_active',
        ',SKU-1,Filter Coffee,CsvBeverages,80,South Indian coffee,25,,,,veg,yes',
        ',SKU-2,Masala Fries,CsvSnacks,110,Spiced fries,35,,,,veg,yes',
      ].join('\n');

      const prodImport = await pos.request('main', '/api/menu-csv/import/products', {
        method: 'POST',
        token: owner.token,
        body: { csv: prodCsv },
      });
      assertJson(
        prodImport,
        200,
        (d) => d.created === 2 && d.failed === 0,
      );

      const addonCsv = [
        'group_name,addon_name,price,group_required,group_min_select,group_max_select',
        'CupSize,Regular,0,no,1,1',
        'CupSize,Large,30,no,1,1',
      ].join('\n');

      const addonImport = await pos.request('main', '/api/menu-csv/import/addons', {
        method: 'POST',
        token: owner.token,
        body: { csv: addonCsv },
      });
      assertJson(
        addonImport,
        200,
        (d) => d.groups_created === 1 && d.addons_created === 2 && d.failed === 0,
      );

      const expProd = await pos.request('main', '/api/menu-csv/export/products', {
        token: owner.token,
      });
      assertStatus(expProd, 200);
      assert(expProd.rawText.includes('Filter Coffee'));
      assert(expProd.rawText.includes('Masala Fries'));
    });
  },
});

registerTest({
  id: 'f3:t2:category-cycle-and-nonempty-delete-400',
  tier: 2,
  feature: 'F3',
  title: 'Category parent cycles return 400 and non-empty delete requires ?action=reassign/delete_all',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const parentId = assertJson<{ category: { id: string } }>(
        await pos.request('main', '/api/categories', {
          method: 'POST',
          token: owner.token,
          body: { name: 'ParentCat' },
        }),
        201,
      ).category.id;

      const childId = assertJson<{ category: { id: string } }>(
        await pos.request('main', '/api/categories', {
          method: 'POST',
          token: owner.token,
          body: { name: 'ChildCat', parent_id: parentId },
        }),
        201,
      ).category.id;

      const targetId = assertJson<{ category: { id: string } }>(
        await pos.request('main', '/api/categories', {
          method: 'POST',
          token: owner.token,
          body: { name: 'TargetCat' },
        }),
        201,
      ).category.id;

      const selfCycle = await pos.request('main', `/api/categories/${parentId}`, {
        method: 'PUT',
        token: owner.token,
        body: { parent_id: parentId },
      });
      assertStatus(selfCycle, 400, 'category self-parent');

      const descCycle = await pos.request('main', `/api/categories/${parentId}`, {
        method: 'PUT',
        token: owner.token,
        body: { parent_id: childId },
      });
      assertStatus(descCycle, 400, 'category descendant cycle');

      const prodId = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: { name: 'ItemInParent', category_id: parentId, price: 100 },
        }),
        201,
      ).product.id;

      const bareDelete = await pos.request('main', `/api/categories/${parentId}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertStatus(bareDelete, 400, 'delete non-empty category without action');

      const reassignDelete = await pos.request(
        'main',
        `/api/categories/${parentId}?action=reassign&reassign_to=${targetId}`,
        { method: 'DELETE', token: owner.token },
      );
      assertStatus(reassignDelete, 200, 'delete category with reassign');

      const movedProd = await pos.request('main', `/api/products/${prodId}`, {
        token: owner.token,
      });
      assertJson(movedProd, 200, (d) => d.product?.category_id === targetId);
    });
  },
});

registerTest({
  id: 'f3:t2:product-validation-and-duplicate-barcode-400',
  tier: 2,
  feature: 'F3',
  title: 'Product validation rejects fractional each, negative price, invalid image_url, duplicate barcode, and stock underflow',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const fracEach = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: { name: 'BadUnit', price: 50, sale_unit: 'each', allow_fractional_quantity: true },
      });
      assertStatus(fracEach, 400, 'fractional with sale_unit=each');

      const negPrice = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: { name: 'NegPrice', price: -10 },
      });
      assertStatus(negPrice, 400, 'negative product price');

      const badImg = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: { name: 'BadImg', price: 50, image_url: 'http://example.com/a.png' },
      });
      assertStatus(badImg, 400, 'http image_url');

      const p1 = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'BarcodeItem1',
          price: 100,
          barcode: '9988776655',
          track_inventory: true,
          stock_quantity: 5,
        },
      });
      const p1Id = assertJson<{ product: { id: string } }>(p1, 201).product.id;

      const dupBarcode = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: { name: 'BarcodeItem2', price: 120, barcode: '9988776655' },
      });
      assertStatus(dupBarcode, 400, 'duplicate barcode');

      const underflow = await pos.request('main', `/api/products/${p1Id}/stock`, {
        method: 'POST',
        token: owner.token,
        body: { action: 'decrease', quantity: 50 },
      });
      assertStatus(underflow, 400, 'insufficient stock decrease');
    });
  },
});

registerTest({
  id: 'f3:t2:fetch-url-ssrf-blocked-400',
  tier: 2,
  feature: 'F3',
  title: 'POST /api/products/fetch-url blocks non-HTTPS, credentials, custom ports, and private/metadata SSRF IPs',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const blockedUrls = [
        'http://example.com/a.png',
        'https://127.0.0.1/a.png',
        'https://169.254.169.254/latest/meta-data',
        'https://10.0.0.1/a.png',
        'https://user:pass@example.com/a.png',
        'https://example.com:8443/a.png',
      ];

      for (const url of blockedUrls) {
        const res = await pos.request('main', '/api/products/fetch-url', {
          method: 'POST',
          token: owner.token,
          body: { url },
        });
        assertStatus(res, 400, `SSRF/scheme block for ${url}`);
      }
    });
  },
});

registerTest({
  id: 'f3:t2:addon-min-selection-bounds-400',
  tier: 2,
  feature: 'F3',
  title: 'Addon groups enforce min_selection <= max_selection <= activeAddonCount on create, update, and delete',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const minExceedsMax = await pos.request('main', '/api/addon-groups', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'BadBounds1',
          min_selection: 3,
          max_selection: 1,
          addons: [{ name: 'A', price: 10 }],
        },
      });
      assertJson(minExceedsMax, 400, (d) => typeof d.errors === 'object');

      const minExceedsCount = await pos.request('main', '/api/addon-groups', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'BadBounds2',
          min_selection: 2,
          max_selection: 3,
          addons: [{ name: 'A', price: 10 }],
        },
      });
      assertJson(minExceedsCount, 400, (d) => typeof d.errors === 'object');

      const validGroupRes = await pos.request('main', '/api/addon-groups', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'RequiredSingle',
          is_required: true,
          min_selection: 1,
          max_selection: 2,
          addons: [{ name: 'SoleOption', price: 0 }],
        },
      });
      const group = assertJson<{
        addon_group: { id: string; addons: Array<{ id: string }> };
      }>(validGroupRes, 201).addon_group;
      const addonId = group.addons[0].id;

      const delBreak = await pos.request(
        'main',
        `/api/addon-groups/${group.id}/addons/${addonId}`,
        { method: 'DELETE', token: owner.token },
      );
      assertJson(delBreak, 400, (d) => typeof d.errors === 'object');

      const deactivateBreak = await pos.request(
        'main',
        `/api/addon-groups/${group.id}/addons/${addonId}`,
        {
          method: 'PUT',
          token: owner.token,
          body: { is_active: false },
        },
      );
      assertJson(deactivateBreak, 400, (d) => typeof d.errors === 'object');
    });
  },
});

registerTest({
  id: 'f3:t2:csv-invalid-payloads-400',
  tier: 2,
  feature: 'F3',
  title: 'Menu CSV rejects empty/malformed CSVs (400), unknown templates (404), and reports missing product categories',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const emptyCsv = await pos.request('main', '/api/menu-csv/import/categories', {
        method: 'POST',
        token: owner.token,
        body: { csv: '' },
      });
      assertStatus(emptyCsv, 400, 'empty CSV');

      const unterminated = await pos.request('main', '/api/menu-csv/import/categories', {
        method: 'POST',
        token: owner.token,
        body: { csv: 'name,description\n"unterminated,desc' },
      });
      assertStatus(unterminated, 400, 'unterminated quote CSV');

      const extraCells = await pos.request('main', '/api/menu-csv/import/categories', {
        method: 'POST',
        token: owner.token,
        body: { csv: 'name\nCatA,unexpected_extra_cell' },
      });
      assertStatus(extraCells, 400, 'extra cells CSV');

      const missingCat = await pos.request('main', '/api/menu-csv/import/products', {
        method: 'POST',
        token: owner.token,
        body: {
          csv: 'id,sku,name,category,price\n,,OrphanDish,NonExistentCat,100',
        },
      });
      assertJson(
        missingCat,
        200,
        (d) =>
          d.created === 0 &&
          d.failed === 1 &&
          Array.isArray(d.errors) &&
          d.errors.length === 1,
      );

      const unknownTpl = await pos.request('main', '/api/menu-csv/template/unknown', {
        token: owner.token,
      });
      assertStatus(unknownTpl, 404, 'unknown CSV template');
    });
  },
});

registerTest({
  id: 'f3:t2:catalog-and-csv-rbac-403',
  tier: 2,
  feature: 'F3',
  title: 'Cashier, server, and chef receive 403 on owner/manager catalog writes, fetch-url, and menu-csv routes',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });
      const staffList = await Promise.all([
        createStaffMember(pos, owner.token, {
          name: 'C',
          email: 'c@e2e.local',
          password: 'StaffPass123!',
          role: 'cashier',
        }),
        createStaffMember(pos, owner.token, {
          name: 'S',
          email: 's@e2e.local',
          password: 'StaffPass123!',
          role: 'server',
        }),
        createStaffMember(pos, owner.token, {
          name: 'K',
          email: 'k@e2e.local',
          password: 'StaffPass123!',
          role: 'chef',
        }),
      ]);

      for (const s of staffList) {
        assertStatus(
          await pos.request('main', '/api/categories', {
            method: 'POST',
            token: s.token,
            body: { name: 'ForbiddenCat' },
          }),
          403,
          'POST /api/categories',
        );
        assertStatus(
          await pos.request('main', '/api/products', {
            method: 'POST',
            token: s.token,
            body: { name: 'ForbiddenProd', price: 10 },
          }),
          403,
          'POST /api/products',
        );
        assertStatus(
          await pos.request('main', '/api/products/fetch-url', {
            method: 'POST',
            token: s.token,
            body: { url: 'https://example.com/a.png' },
          }),
          403,
          'POST /api/products/fetch-url',
        );
        assertStatus(
          await pos.request('main', '/api/addon-groups', {
            method: 'POST',
            token: s.token,
            body: { name: 'ForbiddenGroup' },
          }),
          403,
          'POST /api/addon-groups',
        );
        assertStatus(
          await pos.request('main', '/api/menu-csv/template/categories', {
            token: s.token,
          }),
          403,
          'GET /api/menu-csv/template/categories',
        );
        assertStatus(
          await pos.request('main', '/api/menu-csv/export/products', {
            token: s.token,
          }),
          403,
          'GET /api/menu-csv/export/products',
        );
        assertStatus(
          await pos.request('main', '/api/menu-csv/import/categories', {
            method: 'POST',
            token: s.token,
            body: { csv: 'name\nX' },
          }),
          403,
          'POST /api/menu-csv/import/categories',
        );
      }
    });
  },
});

// ============================================================================
// F4: Local Floor, Tables & Reservations (6 Tier 1 + 6 Tier 2 = 12 tests)
// ============================================================================

registerTest({
  id: 'f4:t1:tables-crud-and-status',
  tier: 1,
  feature: 'F4',
  title: 'Tables CRUD, floor filtering, and status transitions (cleaning -> available) succeed',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const createRes = await pos.request('main', '/api/tables', {
        method: 'POST',
        token: owner.token,
        body: { number: 'T1', capacity: 4, floor: 'Main', section: 'Window' },
      });
      const tableId = assertJson<{ table: { id: string; number: string; floor: string } }>(
        createRes,
        201,
        (d) => d.table?.number === 'T1' && d.table?.floor === 'Main',
      ).table.id;

      const listRes = await pos.request('main', '/api/tables?floor=Main', {
        token: owner.token,
      });
      assertJson(
        listRes,
        200,
        (d) => Array.isArray(d.tables) && d.tables.some((t: { id: string }) => t.id === tableId),
      );

      const getRes = await pos.request('main', `/api/tables/${tableId}`, {
        token: owner.token,
      });
      assertJson(getRes, 200, (d) => d.table?.id === tableId && d.table?.name === 'T1');

      const putRes = await pos.request('main', `/api/tables/${tableId}`, {
        method: 'PUT',
        token: owner.token,
        body: { capacity: 6, section: 'Corner' },
      });
      assertJson(
        putRes,
        200,
        (d) => d.table?.capacity === 6 && d.table?.section === 'Corner',
      );

      const cleaningRes = await pos.request('main', `/api/tables/${tableId}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'cleaning' },
      });
      assertJson(cleaningRes, 200, (d) => d.table?.status === 'cleaning');

      const availRes = await pos.request('main', `/api/tables/${tableId}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'available' },
      });
      assertJson(availRes, 200, (d) => d.table?.status === 'available');
    });
  },
});

registerTest({
  id: 'f4:t1:floor-rename-delete-and-positions',
  tier: 1,
  feature: 'F4',
  title: 'Table canvas positions, floor rename, and floor delete update affected tables',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const t1 = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'P1', floor: 'Patio', capacity: 2 },
        }),
        201,
      ).table.id;

      const t2 = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'P2', floor: 'Patio', capacity: 4 },
        }),
        201,
      ).table.id;

      const posRes = await pos.request('main', '/api/tables/positions', {
        method: 'PATCH',
        token: owner.token,
        body: {
          positions: [
            { id: t1, position_x: 15, position_y: 25 },
            { id: t2, position_x: 60, position_y: 75 },
          ],
        },
      });
      assertJson(posRes, 200, (d) => d.success === true && d.count === 2);

      const renameRes = await pos.request('main', '/api/tables/floors/Patio', {
        method: 'PATCH',
        token: owner.token,
        body: { newName: 'Terrace' },
      });
      assertJson(
        renameRes,
        200,
        (d) =>
          d.floor === 'Terrace' &&
          d.previousFloor === 'Patio' &&
          d.affected === 2,
      );

      const terraceRes = await pos.request('main', '/api/tables?floor=Terrace', {
        token: owner.token,
      });
      assertJson(terraceRes, 200, (d) => d.tables?.length === 2);

      const delFloorRes = await pos.request('main', '/api/tables/floors/Terrace', {
        method: 'DELETE',
        token: owner.token,
      });
      assertJson(
        delFloorRes,
        200,
        (d) =>
          d.floor === null &&
          d.removedFloor === 'Terrace' &&
          d.affected === 2,
      );

      const t1After = await pos.request('main', `/api/tables/${t1}`, { token: owner.token });
      assertJson(
        t1After,
        200,
        (d) => d.table?.floor === null && d.table?.position_x === 15 && d.table?.position_y === 25,
      );
    });
  },
});

registerTest({
  id: 'f4:t1:table-deactivate-and-reactivate',
  tier: 1,
  feature: 'F4',
  title: 'Tables can be deactivated, excluded from active=true filter, and reactivated',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const tableId = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'D1', capacity: 4 },
        }),
        201,
      ).table.id;

      const deactRes = await pos.request('main', `/api/tables/${tableId}/deactivate`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(deactRes, 200, (d) => d.table?.is_active === 0);

      const activeList = await pos.request('main', '/api/tables?active=true', {
        token: owner.token,
      });
      assertJson(
        activeList,
        200,
        (d) => !d.tables.some((t: { id: string }) => t.id === tableId),
      );

      const reactRes = await pos.request('main', `/api/tables/${tableId}/reactivate`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(reactRes, 200, (d) => d.table?.is_active === 1);
    });
  },
});

registerTest({
  id: 'f4:t1:move-order-between-tables',
  tier: 1,
  feature: 'F4',
  title: 'POST /api/tables/:id/move-order transfers active order and swaps table statuses',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const prodId = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Burger', price: 150 },
        }),
        201,
      ).product.id;

      const tableA = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'T-A', capacity: 4 },
        }),
        201,
      ).table.id;

      const tableB = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'T-B', capacity: 4 },
        }),
        201,
      ).table.id;

      const orderRes = await pos.request('main', '/api/orders', {
        method: 'POST',
        token: owner.token,
        body: {
          type: 'dine_in',
          table_id: tableA,
          items: [{ product_id: prodId, quantity: 1 }],
        },
      });
      const orderId = assertJson<{ order: { id: number } }>(orderRes, 201).order.id;

      const moveRes = await pos.request('main', `/api/tables/${tableA}/move-order`, {
        method: 'POST',
        token: owner.token,
        body: { target_table_id: tableB },
      });
      assertJson(
        moveRes,
        200,
        (d) =>
          d.order?.id === orderId &&
          d.order?.table_id === tableB &&
          d.sourceTable?.status === 'available' &&
          d.targetTable?.status === 'occupied',
      );
    });
  },
});

registerTest({
  id: 'f4:t1:merge-tables-combines-orders',
  tier: 1,
  feature: 'F4',
  title: 'POST /api/tables/:id/merge combines two occupied tables into target order and frees source table',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const prodId = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Pasta', price: 100 },
        }),
        201,
      ).product.id;

      const tableA = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'M-A', capacity: 4 },
        }),
        201,
      ).table.id;

      const tableB = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'M-B', capacity: 6 },
        }),
        201,
      ).table.id;

      const orderA = assertJson<{ order: { id: number; total: number } }>(
        await pos.request('main', '/api/orders', {
          method: 'POST',
          token: owner.token,
          body: {
            type: 'dine_in',
            table_id: tableA,
            items: [{ product_id: prodId, quantity: 1 }],
          },
        }),
        201,
      ).order;

      const orderB = assertJson<{ order: { id: number; total: number } }>(
        await pos.request('main', '/api/orders', {
          method: 'POST',
          token: owner.token,
          body: {
            type: 'dine_in',
            table_id: tableB,
            items: [{ product_id: prodId, quantity: 2 }],
          },
        }),
        201,
      ).order;

      const mergeRes = await pos.request('main', `/api/tables/${tableA}/merge`, {
        method: 'POST',
        token: owner.token,
        body: { target_table_id: tableB },
      });
      assertJson(
        mergeRes,
        200,
        (d) =>
          d.merged === true &&
          d.type === 'orders_combined' &&
          d.cancelledSourceOrderId === orderA.id &&
          d.targetOrder?.id === orderB.id &&
          Math.abs(Number(d.targetOrder?.total) - (Number(orderA.total) + Number(orderB.total))) <
            0.05 &&
          d.sourceTable?.status === 'available' &&
          d.targetTable?.status === 'occupied',
      );
    });
  },
});

registerTest({
  id: 'f4:t1:reservations-and-waitlist-lifecycle',
  tier: 1,
  feature: 'F4',
  title: 'Reservations and walk-in waitlist lifecycles synchronize linked table statuses',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const resTableId = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'R1', capacity: 4 },
        }),
        201,
      ).table.id;

      const waitTableId = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'W1', capacity: 2 },
        }),
        201,
      ).table.id;

      const createRes = await pos.request('main', '/api/reservations', {
        method: 'POST',
        token: owner.token,
        body: {
          customer_name: 'Alice',
          customer_phone: '+919876543210',
          reservation_time: '19:30',
          table_id: resTableId,
          guest_count: 4,
        },
      });
      const reservationId = assertJson<{ ok: boolean; reservation: { id: string; status: string } }>(
        createRes,
        201,
        (d) => d.ok === true && d.reservation?.status === 'confirmed',
      ).reservation.id;

      const r1Reserved = await pos.request('main', `/api/tables/${resTableId}`, {
        token: owner.token,
      });
      assertJson(r1Reserved, 200, (d) => d.table?.status === 'reserved');

      const listRes = await pos.request('main', '/api/reservations', { token: owner.token });
      assertJson(
        listRes,
        200,
        (d) =>
          d.ok === true &&
          d.reservations.some((r: { id: string }) => r.id === reservationId),
      );

      await pos.request('main', `/api/reservations/${reservationId}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'seated' },
      });
      const r1Occupied = await pos.request('main', `/api/tables/${resTableId}`, {
        token: owner.token,
      });
      assertJson(r1Occupied, 200, (d) => d.table?.status === 'occupied');

      await pos.request('main', `/api/reservations/${reservationId}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'completed' },
      });
      const r1Avail = await pos.request('main', `/api/tables/${resTableId}`, {
        token: owner.token,
      });
      assertJson(r1Avail, 200, (d) => d.table?.status === 'available');

      const waitCreate = await pos.request('main', '/api/reservations/waitlist', {
        method: 'POST',
        token: owner.token,
        body: {
          customer_name: 'Bob',
          customer_phone: '+919876543211',
          party_size: 2,
          estimated_wait_minutes: 10,
        },
      });
      const entryId = assertJson<{ ok: boolean; entry: { id: string; status: string } }>(
        waitCreate,
        201,
        (d) => d.ok === true && d.entry?.status === 'waiting',
      ).entry.id;

      const waitList = await pos.request('main', '/api/reservations/waitlist', {
        token: owner.token,
      });
      assertJson(
        waitList,
        200,
        (d) => d.ok === true && d.waitlist.some((w: { id: string }) => w.id === entryId),
      );

      const notified = await pos.request(
        'main',
        `/api/reservations/waitlist/${entryId}/status`,
        {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'notified' },
        },
      );
      assertJson(notified, 200, (d) => d.entry?.status === 'notified');

      const seated = await pos.request(
        'main',
        `/api/reservations/waitlist/${entryId}/status`,
        {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'seated', table_id: waitTableId },
        },
      );
      assertJson(
        seated,
        200,
        (d) => d.entry?.status === 'seated' && d.entry?.seated_table_id === waitTableId,
      );

      const w1Occupied = await pos.request('main', `/api/tables/${waitTableId}`, {
        token: owner.token,
      });
      assertJson(w1Occupied, 200, (d) => d.table?.status === 'occupied');
    });
  },
});

registerTest({
  id: 'f4:t2:duplicate-table-and-invalid-coords-400',
  tier: 2,
  feature: 'F4',
  title: 'Tables reject duplicate numbers, invalid capacity, out-of-range coords, and invalid status with 400',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const t1Id = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'T1', capacity: 4 },
        }),
        201,
      ).table.id;

      const dup = await pos.request('main', '/api/tables', {
        method: 'POST',
        token: owner.token,
        body: { number: 'T1', capacity: 2 },
      });
      assertStatus(dup, 400, 'duplicate table number');

      const badCap = await pos.request('main', '/api/tables', {
        method: 'POST',
        token: owner.token,
        body: { number: 'T2', capacity: 0 },
      });
      assertStatus(badCap, 400, 'zero table capacity');

      const badCoord = await pos.request('main', '/api/tables', {
        method: 'POST',
        token: owner.token,
        body: { number: 'T3', position_x: 150 },
      });
      assertStatus(badCoord, 400, 'out-of-range position_x');

      const badBatchPos = await pos.request('main', '/api/tables/positions', {
        method: 'PATCH',
        token: owner.token,
        body: { positions: [{ id: t1Id, position_x: 10, position_y: -5 }] },
      });
      assertStatus(badBatchPos, 400, 'negative position_y in batch');

      const badStatus = await pos.request('main', `/api/tables/${t1Id}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'invalid_state' },
      });
      assertStatus(badStatus, 400, 'invalid table status');
    });
  },
});

registerTest({
  id: 'f4:t2:deactivate-occupied-table-400',
  tier: 2,
  feature: 'F4',
  title: 'POST /api/tables/:id/deactivate rejects tables with active orders (400)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const prodId = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Soup', price: 90 },
        }),
        201,
      ).product.id;

      const tableId = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'Occ1', capacity: 4 },
        }),
        201,
      ).table.id;

      await pos.request('main', '/api/orders', {
        method: 'POST',
        token: owner.token,
        body: {
          type: 'dine_in',
          table_id: tableId,
          items: [{ product_id: prodId, quantity: 1 }],
        },
      });

      const deactRes = await pos.request('main', `/api/tables/${tableId}/deactivate`, {
        method: 'POST',
        token: owner.token,
      });
      assertStatus(deactRes, 400, 'deactivate table with active order');
    });
  },
});

registerTest({
  id: 'f4:t2:move-order-target-occupied-409',
  tier: 2,
  feature: 'F4',
  title: 'move-order rejects occupied target (409), self move (400), and empty source table (404)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const prodId = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Salad', price: 120 },
        }),
        201,
      ).product.id;

      const [tA, tB, tC] = await Promise.all(
        ['MA', 'MB', 'MC'].map(async (num) =>
          assertJson<{ table: { id: string } }>(
            await pos.request('main', '/api/tables', {
              method: 'POST',
              token: owner.token,
              body: { number: num, capacity: 4 },
            }),
            201,
          ).table.id,
        ),
      );

      for (const tid of [tA, tB]) {
        assertStatus(
          await pos.request('main', '/api/orders', {
            method: 'POST',
            token: owner.token,
            body: {
              type: 'dine_in',
              table_id: tid,
              items: [{ product_id: prodId, quantity: 1 }],
            },
          }),
          201,
        );
      }

      const conflict = await pos.request('main', `/api/tables/${tA}/move-order`, {
        method: 'POST',
        token: owner.token,
        body: { target_table_id: tB },
      });
      assertStatus(conflict, 409, 'move-order into occupied target');

      const selfMove = await pos.request('main', `/api/tables/${tA}/move-order`, {
        method: 'POST',
        token: owner.token,
        body: { target_table_id: tA },
      });
      assertStatus(selfMove, 400, 'move-order to self');

      const emptySrc = await pos.request('main', `/api/tables/${tC}/move-order`, {
        method: 'POST',
        token: owner.token,
        body: { target_table_id: tB },
      });
      assertStatus(emptySrc, 404, 'move-order from empty source table');
    });
  },
});

registerTest({
  id: 'f4:t2:merge-partial-payment-409',
  tier: 2,
  feature: 'F4',
  title: 'POST /api/tables/:id/merge rejects orders with partial recorded payments (409)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      const prodId = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Steak', price: 400 },
        }),
        201,
      ).product.id;

      const tA = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'PayA', capacity: 4 },
        }),
        201,
      ).table.id;

      const tB = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'PayB', capacity: 4 },
        }),
        201,
      ).table.id;

      const orderAId = assertJson<{ order: { id: number } }>(
        await pos.request('main', '/api/orders', {
          method: 'POST',
          token: owner.token,
          body: {
            type: 'dine_in',
            table_id: tA,
            items: [{ product_id: prodId, quantity: 1 }],
          },
        }),
        201,
      ).order.id;

      assertStatus(
        await pos.request('main', '/api/orders', {
          method: 'POST',
          token: owner.token,
          body: {
            type: 'dine_in',
            table_id: tB,
            items: [{ product_id: prodId, quantity: 1 }],
          },
        }),
        201,
      );

      const billRes = await pos.request('main', '/api/bills/generate', {
        method: 'POST',
        token: owner.token,
        body: { order_id: orderAId },
      });
      const billId = assertJson<{ bill: { id: number } }>(billRes, [200, 201]).bill.id;

      const payRes = await pos.request('main', `/api/bills/${billId}/payment`, {
        method: 'POST',
        token: owner.token,
        body: { method: 'cash', amount: 50 },
      });
      assertStatus(payRes, [200, 201], 'partial payment on source bill');

      const mergeRes = await pos.request('main', `/api/tables/${tA}/merge`, {
        method: 'POST',
        token: owner.token,
        body: { target_table_id: tB },
      });
      assertStatus(mergeRes, 409, 'merge with partial payment');
    });
  },
});

registerTest({
  id: 'f4:t2:reservation-and-waitlist-invalid-input-400-404',
  tier: 2,
  feature: 'F4',
  title: 'Reservations and waitlist validate required fields (400), statuses (400), and unknown IDs (404)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });

      assertStatus(
        await pos.request('main', '/api/reservations', {
          method: 'POST',
          token: owner.token,
          body: { customer_name: 'Missing Phone' },
        }),
        400,
        'reservation missing required fields',
      );

      assertStatus(
        await pos.request('main', '/api/reservations/nonexistent-id/status', {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'seated' },
        }),
        404,
        'unknown reservation ID',
      );

      const resId = assertJson<{ reservation: { id: string } }>(
        await pos.request('main', '/api/reservations', {
          method: 'POST',
          token: owner.token,
          body: {
            customer_name: 'Valid Guest',
            customer_phone: '+919876543212',
            reservation_time: '20:00',
          },
        }),
        201,
      ).reservation.id;

      assertStatus(
        await pos.request('main', `/api/reservations/${resId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'bogus_status' },
        }),
        400,
        'invalid reservation status',
      );

      assertStatus(
        await pos.request('main', '/api/reservations/waitlist', {
          method: 'POST',
          token: owner.token,
          body: { customer_name: 'NoPhone' },
        }),
        400,
        'waitlist missing phone',
      );

      assertStatus(
        await pos.request('main', '/api/reservations/waitlist/nonexistent-wl/status', {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'notified' },
        }),
        404,
        'unknown waitlist ID',
      );

      const wlId = assertJson<{ entry: { id: string } }>(
        await pos.request('main', '/api/reservations/waitlist', {
          method: 'POST',
          token: owner.token,
          body: { customer_name: 'WalkIn', customer_phone: '+919876543213' },
        }),
        201,
      ).entry.id;

      assertStatus(
        await pos.request('main', `/api/reservations/waitlist/${wlId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'invalid_wl_status' },
        }),
        400,
        'invalid waitlist status',
      );
    });
  },
});

registerTest({
  id: 'f4:t2:tables-and-reservations-rbac-403',
  tier: 2,
  feature: 'F4',
  title: 'Server and chef get 403 on table admin and reservation endpoints; chef gets 403 on move/merge',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'empty' });
      const server = await createStaffMember(pos, owner.token, {
        name: 'Server RBAC',
        email: 'server-f4@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const chef = await createStaffMember(pos, owner.token, {
        name: 'Chef RBAC',
        email: 'chef-f4@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });

      const tableId = assertJson<{ table: { id: string } }>(
        await pos.request('main', '/api/tables', {
          method: 'POST',
          token: owner.token,
          body: { number: 'RBAC1', capacity: 4 },
        }),
        201,
      ).table.id;

      for (const s of [server, chef]) {
        assertStatus(
          await pos.request('main', '/api/tables', {
            method: 'POST',
            token: s.token,
            body: { number: 'ForbiddenT', capacity: 4 },
          }),
          403,
          `${s.staff.role} POST /api/tables`,
        );
        assertStatus(
          await pos.request('main', '/api/tables/floors/Main', {
            method: 'PATCH',
            token: s.token,
            body: { newName: 'Floor2' },
          }),
          403,
          `${s.staff.role} PATCH /api/tables/floors`,
        );
        assertStatus(
          await pos.request('main', '/api/reservations', { token: s.token }),
          403,
          `${s.staff.role} GET /api/reservations`,
        );
        assertStatus(
          await pos.request('main', '/api/reservations', {
            method: 'POST',
            token: s.token,
            body: {
              customer_name: 'X',
              customer_phone: '+919876543214',
              reservation_time: '18:00',
            },
          }),
          403,
          `${s.staff.role} POST /api/reservations`,
        );
        assertStatus(
          await pos.request('main', '/api/reservations/waitlist', {
            method: 'POST',
            token: s.token,
            body: { customer_name: 'X', customer_phone: '+919876543214' },
          }),
          403,
          `${s.staff.role} POST /api/reservations/waitlist`,
        );
      }

      assertStatus(
        await pos.request('main', `/api/tables/${tableId}/move-order`, {
          method: 'POST',
          token: chef.token,
          body: { target_table_id: 'other' },
        }),
        403,
        'chef POST move-order',
      );
      assertStatus(
        await pos.request('main', `/api/tables/${tableId}/merge`, {
          method: 'POST',
          token: chef.token,
          body: { target_table_id: 'other' },
        }),
        403,
        'chef POST merge',
      );
    });
  },
});
