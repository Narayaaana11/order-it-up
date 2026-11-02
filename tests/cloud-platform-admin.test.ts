import assert from 'node:assert/strict';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT, hashPassword } from '../apps/cloud-api/src/auth';

const JWT_SECRET = 'ordinary-restaurant-jwt-secret-32-characters-minimum';
const PLATFORM_SECRET = 'separate-platform-admin-jwt-secret-32-characters-minimum';

class MockPlatformAdminD1 {
  organizationStatus = 'active';
  subscription: any = null;
  auditRecords: any[] = [];
  webhookEvents: any[] = [];

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let params: any[] = [];
    const statement: any = {
      bind: (...values: any[]) => { params = values; return statement; },
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
        if (normalized.includes('SELECT id, name, account_status FROM organizations WHERE id = ?')) {
          return { id: 'org-real-1', name: 'Real Restaurant', account_status: this.organizationStatus } as T;
        }
        if (normalized.includes('SELECT code, name, currency, monthly_price_minor, yearly_price_minor, is_active FROM saas_plans')) {
          return { code: 'pro', name: 'Professional', currency: 'INR', monthly_price_minor: 129900, yearly_price_minor: 1299900, is_active: 1 } as T;
        }
        if (normalized.includes('SELECT * FROM organization_subscriptions WHERE organization_id = ?')) return this.subscription as T || null;
        if (normalized.includes('SELECT COUNT(*) AS total FROM organizations o')) return { total: 2 } as T;
        if (normalized.includes('SELECT COUNT(*) AS total FROM saas_payment_webhook_events')) return { total: this.webhookEvents.length } as T;
        if (normalized.includes('FROM saas_payment_webhook_events WHERE id = ?')) {
          return this.webhookEvents.find((event) => event.id === params[0]) as T || null;
        }
        if (normalized.includes('SELECT account_status FROM organizations WHERE id = ?')) return { account_status: this.organizationStatus } as T;
        if (normalized.includes('FROM saas_subscription_payment_orders') && normalized.includes('WHERE provider_order_id = ? AND provider =')) {
          return { organization_id: 'org-real-1' } as T;
        }
        if (normalized.includes('FROM saas_subscription_payment_orders') && normalized.includes('WHERE provider_order_id = ? AND organization_id = ?')) {
          return { id: 'order-row-1', organization_id: 'org-real-1', plan_code: 'pro', billing_cycle: 'monthly', amount_minor: 129900,
            currency: 'INR', provider_order_id: 'order_recovery123', provider_payment_id: 'pay_recovery123', status: 'captured',
            expires_at: new Date(Date.now() + 60000).toISOString() } as T;
        }
        if (normalized.includes('FROM organization_subscriptions s LEFT JOIN saas_plans')) {
          return this.subscription ? { ...this.subscription, plan_name: 'Professional', entitlements_json: '{}' } as T : null;
        }
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
        if (normalized.includes('FROM saas_payment_webhook_events')) {
          const hasStatus = normalized.includes('WHERE status = ?');
          const matching = hasStatus ? this.webhookEvents.filter((event) => event.status === params[0]) : this.webhookEvents;
          const offset = hasStatus ? 2 : 1;
          const limit = Number(params[offset - 1] ?? matching.length);
          const skip = Number(params[offset] ?? 0);
          return { results: matching.slice(skip, skip + limit) as T[] };
        }
        return { results: [] as T[] };
      },
      run: async () => {
        if (normalized.includes('UPDATE organizations SET account_status')) this.organizationStatus = params[0];
        if (normalized.includes('INSERT INTO organization_subscriptions')) {
          this.subscription = {
            id: params[0], organization_id: params[1], plan_code: params[2], status: params[3],
            billing_cycle: params[4], currency: params[5], amount_minor: params[6],
            trial_ends_at: params[7], current_period_start: params[8], current_period_end: params[9],
            created_at: params[10], updated_at: params[11],
          };
        }
        if (normalized.includes('INSERT INTO platform_admin_audit_log')) {
          const action = normalized.match(/VALUES\s*\(.*?'([^']+)'/i)?.[1] || '';
          this.auditRecords.push({ action, organization_id: params[2], reason: params[3] });
        }
        if (normalized.includes('UPDATE saas_payment_webhook_events SET status')) {
          const row = this.webhookEvents.find((event) => event.id === params[params.length - 1]);
          if (row) {
            row.status = normalized.match(/SET status = '([^']+)'/)?.[1] || row.status;
            if (normalized.includes('processed_at = ?')) row.processed_at = params[0];
          }
        }
        if (normalized.includes('UPDATE platform_admin_audit_log SET after_json')) {
          const record = this.auditRecords.at(-1);
          if (record) record.after_json = params[0];
        }
        return { success: true, meta: { changes: 1 }, params };
      },
    };
    return statement;
  }

  async batch(statements: any[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
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
    RAZORPAY_KEY_ID: 'rzp_test_platformtest1',
    RAZORPAY_KEY_SECRET: 'platform-admin-test-provider-secret',
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

  env.DB.subscription = {
    id: 'sub-real-1', organization_id: 'org-real-1', plan_code: 'pro', status: 'active',
    billing_cycle: 'monthly', currency: 'INR', amount_minor: 129900,
    current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 86400000).toISOString(),
  };
  env.DB.webhookEvents.push({
    id: 'webhook-row-1', provider_event_id: 'evt_recovery_001', event_type: 'payment.captured',
    payload_hash: 'trusted-payload-hash', provider_order_id: 'order_recovery123', provider_payment_id: 'pay_recovery123',
    status: 'failed', error_code: 'payment_reconciliation_pending', received_at: new Date().toISOString(), processed_at: null,
  });
  const webhookInbox = await cloudWorker.fetch(request('/api/platform-admin/billing/webhook-events?status=failed', 'GET', undefined, loginData.token), env);
  assert.equal(webhookInbox.status, 200, 'Platform admin can inspect the durable failed-payment inbox');
  assert.equal((await webhookInbox.json() as any).events[0].provider_event_id, 'evt_recovery_001');
  const retryMissingReason = await cloudWorker.fetch(request('/api/platform-admin/billing/webhook-events/webhook-row-1/retry', 'POST', { reason: 'too short' }, loginData.token), env);
  assert.equal(retryMissingReason.status, 400, 'Manual payment reconciliation requires an audit reason');
  const retryWebhook = await cloudWorker.fetch(request('/api/platform-admin/billing/webhook-events/webhook-row-1/retry', 'POST', {
    reason: 'Retry after verifying the provider settlement record with support.',
  }, loginData.token), env);
  assert.equal(retryWebhook.status, 200, 'Platform admin can retry a previously verified webhook event');
  assert.equal(env.DB.webhookEvents[0].status, 'processed');
  assert.ok(env.DB.auditRecords.some((entry: any) => entry.action === 'billing.webhook.retry.requested'));
  env.DB.subscription = null;

  const accountChange = await cloudWorker.fetch(request('/api/platform-admin/tenants/org-real-1/account-status', 'PATCH', {
    account_status: 'suspended',
    reason: 'Temporary suspension requested for account review.',
  }, loginData.token), env);
  assert.equal(accountChange.status, 200, 'Platform admin can update tenant account status');
  assert.equal(env.DB.organizationStatus, 'suspended');
  assert.ok(env.DB.auditRecords.some((entry: any) => entry.action === 'tenant.account_status.changed'));

  const invalidReason = await cloudWorker.fetch(request('/api/platform-admin/tenants/org-real-1/account-status', 'PATCH', {
    account_status: 'active',
    reason: 'no',
  }, loginData.token), env);
  assert.equal(invalidReason.status, 400, 'Account status updates require an audit reason');

  const trialChange = await cloudWorker.fetch(request('/api/platform-admin/tenants/org-real-1/subscription', 'PATCH', {
    plan_code: 'pro',
    billing_cycle: 'monthly',
    reason: 'Approved trial plan change by the support team.',
  }, loginData.token), env);
  assert.equal(trialChange.status, 200, 'Platform admin can assign a subscription trial');
  assert.equal(env.DB.subscription.plan_code, 'pro');
  assert.equal(env.DB.subscription.status, 'trial');
  assert.equal(env.DB.subscription.amount_minor, 129900);
  assert.ok(env.DB.auditRecords.some((entry: any) => entry.action === 'tenant.subscription.changed'));

  const blockedActivation = await cloudWorker.fetch(request('/api/platform-admin/tenants/org-real-1/subscription', 'PATCH', {
    plan_code: 'pro',
    status: 'active',
    reason: 'Paid activation requested without provider settlement.',
  }, loginData.token), env);
  assert.equal(blockedActivation.status, 409, 'Admin cannot activate unpaid subscription without verified provider settlement');

  console.log('Cloud platform admin tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
