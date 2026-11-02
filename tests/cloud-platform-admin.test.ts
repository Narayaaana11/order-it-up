import assert from 'node:assert/strict';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT, hashPassword } from '../apps/cloud-api/src/auth';

const JWT_SECRET = 'ordinary-restaurant-jwt-secret-32-characters-minimum';
const PLATFORM_SECRET = 'separate-platform-admin-jwt-secret-32-characters-minimum';

class MockPlatformAdminD1 {
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    return {
      bind: (...params: any[]) => ({
        first: async <T = any>(): Promise<T | null> => {
          if (normalized.includes('INSERT INTO rate_limits')) return null;
          if (normalized.includes('SUM(CASE WHEN account_status')) {
            return { total: 2, active: 1, suspended: 1, closed: 0 } as T;
          }
          if (normalized.includes('SELECT COUNT(*) AS total FROM branches')) return { total: 3 } as T;
          if (normalized.includes('SELECT COUNT(*) AS total FROM terminals')) return { total: 5 } as T;
          if (normalized.includes("SELECT COUNT(*) AS total FROM cloud_users WHERE status = 'active'")) return { total: 7 } as T;
          if (normalized.includes('SELECT COUNT(*) AS total FROM synced_orders')) return { total: 25 } as T;
          if (normalized.includes("FROM organization_subscriptions WHERE status = 'trial'")) return { total: 1 } as T;
          if (normalized.includes('SELECT COUNT(*) AS total FROM organizations o')) return { total: 2 } as T;
          return null;
        },
        all: async <T = any>(): Promise<{ results: T[] }> => {
          if (normalized.includes('FROM synced_orders so') && normalized.includes('GROUP BY o.currency')) {
            return { results: [{ currency: 'INR', orders: 20, gmv: 85000 }, { currency: 'USD', orders: 5, gmv: 400 }] as T[] };
          }
          if (normalized.includes('FROM organization_subscriptions') && normalized.includes('GROUP BY currency')) {
            return { results: [{ currency: 'INR', mrr_minor: 129900 }, { currency: 'USD', mrr_minor: 0 }] as T[] };
          }
          if (normalized.includes('FROM saas_plans')) {
            return { results: [{
              code: 'starter', name: 'Starter', currency: 'INR',
              monthly_price_minor: 49900, yearly_price_minor: 499900,
              entitlements_json: '{"maxTerminals":1}', is_active: 1,
            }] as T[] };
          }
          if (normalized.includes('FROM organizations o') && normalized.includes('LEFT JOIN organization_subscriptions s')) {
            return { results: [{
              id: 'org-real-1', name: 'Real Restaurant', account_status: 'active',
              plan_code: 'pro', subscription_status: 'active', branch_count: 2,
              terminal_count: 4, active_user_count: 5,
            }] as T[] };
          }
          return { results: [] as T[] };
        },
        run: async () => ({ success: true, meta: { changes: 1 } }),
      }),
    };
  }
}

function request(path: string, method = 'GET', body?: unknown, token?: string) {
  return new Request(`https://api.orderitup.in${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'CF-Connecting-IP': '198.51.100.44',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function run() {
  const password = 'Platform-Admin-Only-Password-2026!';
  const passwordHash = await hashPassword(password);
  const env: any = {
    DB: new MockPlatformAdminD1(),
    JWT_SECRET,
    PLATFORM_ADMIN_EMAIL: 'platform-admin@orderitup.in',
    PLATFORM_ADMIN_PASSWORD_HASH: passwordHash,
    PLATFORM_ADMIN_JWT_SECRET: PLATFORM_SECRET,
    ENVIRONMENT: 'staging',
    FRONTEND_ORIGIN: 'https://app.orderitup.in',
  };

  // Platform admin is configured separately from tenant-owner identities.
  const missing = await cloudWorker.fetch(request('/api/platform-admin/login', 'POST', {
    email: 'platform-admin@orderitup.in', password,
  }), { ...env, PLATFORM_ADMIN_JWT_SECRET: undefined } as any);
  assert.equal(missing.status, 503, 'Missing isolated admin secret fails closed');

  const invalid = await cloudWorker.fetch(request('/api/platform-admin/login', 'POST', {
    email: 'platform-admin@orderitup.in', password: 'wrong-password',
  }), env);
  assert.equal(invalid.status, 401, 'Invalid platform admin password is rejected');

  const login = await cloudWorker.fetch(request('/api/platform-admin/login', 'POST', {
    email: 'PLATFORM-ADMIN@ORDERITUP.IN', password,
  }), env);
  assert.equal(login.status, 200, 'Provisioned platform admin can log in');
  const loginData = await login.json() as any;
  assert.ok(loginData.token, 'Platform admin receives a bearer token');
  assert.equal(loginData.admin.role, 'platform_admin');

  const normalTenantToken = await createJWT({
    sub: 'restaurant-owner-1', org: 'org-real-1', email: 'owner@realrestaurant.in',
    role: 'owner', branch: null, exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  const wrongNamespace = await cloudWorker.fetch(request('/api/platform-admin/overview', 'GET', undefined, normalTenantToken), env);
  assert.equal(wrongNamespace.status, 401, 'Restaurant owner token cannot access platform admin');

  const unauthorized = await cloudWorker.fetch(request('/api/platform-admin/overview'), env);
  assert.equal(unauthorized.status, 401, 'Platform admin endpoints require an admin token');

  const whoAmI = await cloudWorker.fetch(request('/api/platform-admin/me', 'GET', undefined, loginData.token), env);
  assert.equal(whoAmI.status, 200, 'Platform admin token identifies the operator');

  const overview = await cloudWorker.fetch(request('/api/platform-admin/overview', 'GET', undefined, loginData.token), env);
  assert.equal(overview.status, 200, 'Platform overview loads from D1 data');
  const metrics = await overview.json() as any;
  assert.equal(metrics.data_source, 'cloudflare_d1');
  assert.equal(metrics.tenants.total, 2);
  assert.equal(metrics.tenants.active, 1);
  assert.equal(metrics.tenants.suspended, 1);
  assert.equal(metrics.infrastructure.terminals, 5);
  assert.equal(metrics.last_30_days.orders, 25);
  assert.equal(metrics.last_30_days.gross_merchandise_value_by_currency.length, 2);
  assert.equal(metrics.monthly_recurring_revenue_by_currency.find((x: any) => x.currency === 'INR').amount, 1299);

  const tenants = await cloudWorker.fetch(request('/api/platform-admin/tenants?limit=10&offset=0', 'GET', undefined, loginData.token), env);
  assert.equal(tenants.status, 200, 'Platform tenant directory loads');
  const tenantData = await tenants.json() as any;
  assert.equal(tenantData.pagination.total, 2);
  assert.equal(tenantData.tenants[0].id, 'org-real-1');

  const invalidFilters = await cloudWorker.fetch(request('/api/platform-admin/tenants?limit=1000', 'GET', undefined, loginData.token), env);
  assert.equal(invalidFilters.status, 400, 'Tenant pagination is bounded');

  const plans = await cloudWorker.fetch(request('/api/platform-admin/plans', 'GET', undefined, loginData.token), env);
  assert.equal(plans.status, 200, 'Plan catalogue loads');
  const planData = await plans.json() as any;
  assert.equal(planData.plans[0].monthly_price, 499);
  assert.equal(planData.plans[0].entitlements.maxTerminals, 1);

  console.log('Cloud platform admin tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
