/**
 * Platform-level SaaS administration.
 *
 * This identity is intentionally separate from restaurant-owner accounts:
 * it uses a dedicated secret and an environment-provisioned scrypt password hash.
 * All tenant and billing metrics are read from the authoritative Cloudflare D1 database.
 */
import { Env } from './pairing';
import { createJWT, isSecretValid, verifyJWT, verifyPassword } from '../auth';
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
} from '../rate-limit';

const PLATFORM_ADMIN_SUBJECT = 'order-it-up-platform-admin';
const PLATFORM_ADMIN_ORG = '__platform_admin__';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLATFORM_ADMIN_TOKEN_TTL_SECONDS = 60 * 60;

function configuredAdmin(env: Env): { email: string; passwordHash: string; jwtSecret: string } | null {
  const email = typeof env.PLATFORM_ADMIN_EMAIL === 'string' ? env.PLATFORM_ADMIN_EMAIL.trim().toLowerCase() : '';
  const passwordHash = typeof env.PLATFORM_ADMIN_PASSWORD_HASH === 'string' ? env.PLATFORM_ADMIN_PASSWORD_HASH.trim() : '';
  const jwtSecret = env.PLATFORM_ADMIN_JWT_SECRET || '';

  if (
    !EMAIL_REGEX.test(email) ||
    !passwordHash.startsWith('scrypt$') ||
    !isSecretValid(jwtSecret) ||
    !isSecretValid(env.JWT_SECRET) ||
    jwtSecret === env.JWT_SECRET
  ) {
    return null;
  }

  return { email, passwordHash, jwtSecret };
}

async function handlePlatformAdminLogin(request: Request, env: Env): Promise<Response> {
  const admin = configuredAdmin(env);
  if (!admin) {
    return Response.json({
      error: 'Platform admin is not configured. Provision PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD_HASH and a dedicated PLATFORM_ADMIN_JWT_SECRET.',
      code: 'PLATFORM_ADMIN_NOT_CONFIGURED',
    }, { status: 503 });
  }

  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'platform_admin_login_ip',
    identifier: ip,
    limit: 20,
    windowSeconds: 15 * 60,
  });
  if (!ipLimit.allowed) return createRateLimitResponse(ipLimit);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid login payload' }, { status: 400 });
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password || password.length > 128) {
    return Response.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const accountLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'platform_admin_login_account',
    identifier: email,
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!accountLimit.allowed) return createRateLimitResponse(accountLimit);

  if (email !== admin.email) {
    // Perform a password derivation for unknown accounts as well, reducing timing-based enumeration.
    await verifyPassword(password, admin.passwordHash);
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const verification = await verifyPassword(password, admin.passwordHash);
  if (!verification.valid) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createJWT({
    sub: PLATFORM_ADMIN_SUBJECT,
    org: PLATFORM_ADMIN_ORG,
    email: admin.email,
    role: 'owner',
    branch: null,
    exp: Math.floor(Date.now() / 1000) + PLATFORM_ADMIN_TOKEN_TTL_SECONDS,
  }, admin.jwtSecret);

  return Response.json({
    token,
    token_type: 'Bearer',
    expires_in: PLATFORM_ADMIN_TOKEN_TTL_SECONDS,
    admin: { email: admin.email, role: 'platform_admin' },
  });
}

async function verifyPlatformAdmin(request: Request, env: Env): Promise<{ email: string } | null> {
  const admin = configuredAdmin(env);
  if (!admin) return null;

  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const claims = await verifyJWT(token, admin.jwtSecret);
  if (
    !claims ||
    claims.sub !== PLATFORM_ADMIN_SUBJECT ||
    claims.org !== PLATFORM_ADMIN_ORG ||
    claims.email !== admin.email ||
    claims.role !== 'owner'
  ) {
    return null;
  }

  return { email: admin.email };
}

function migrationRequired(): Response {
  return Response.json({
    error: 'Platform administration schema is not available. Apply D1 migration 0008 before enabling this API.',
    code: 'PLATFORM_ADMIN_SCHEMA_NOT_READY',
  }, { status: 503 });
}

async function handleOverview(env: Env): Promise<Response> {
  try {
    const now = new Date();
    const dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [tenantTotals, branchTotals, terminalTotals, userTotals, orderTotals, gmvRows, mrrRows] = await Promise.all([
      env.DB.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN account_status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
          SUM(CASE WHEN account_status = 'closed' THEN 1 ELSE 0 END) AS closed
        FROM organizations
      `).first<any>(),
      env.DB.prepare('SELECT COUNT(*) AS total FROM branches').first<any>(),
      env.DB.prepare('SELECT COUNT(*) AS total FROM terminals').first<any>(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM cloud_users WHERE status = 'active'").first<any>(),
      env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM synced_orders
        WHERE ordered_at >= ? AND status != 'cancelled'
      `).bind(dateFrom).first<any>(),
      env.DB.prepare(`
        SELECT o.currency, COUNT(so.id) AS orders, COALESCE(SUM(so.grand_total), 0) AS gmv
        FROM synced_orders so
        JOIN organizations o ON o.id = so.organization_id
        WHERE so.ordered_at >= ? AND so.status != 'cancelled'
        GROUP BY o.currency
        ORDER BY o.currency
      `).bind(dateFrom).all<any>(),
      env.DB.prepare(`
        SELECT currency,
          ROUND(SUM(CASE WHEN status = 'active'
            THEN CASE WHEN billing_cycle = 'yearly' THEN amount_minor / 12.0 ELSE amount_minor END
            ELSE 0 END)) AS mrr_minor
        FROM organization_subscriptions
        GROUP BY currency
        ORDER BY currency
      `).all<any>(),
    ]);

    const trials = await env.DB.prepare("SELECT COUNT(*) AS total FROM organization_subscriptions WHERE status = 'trial'").first<any>();

    return Response.json({
      generated_at: now.toISOString(),
      tenants: {
        total: Number(tenantTotals?.total || 0),
        active: Number(tenantTotals?.active || 0),
        suspended: Number(tenantTotals?.suspended || 0),
        closed: Number(tenantTotals?.closed || 0),
        trial: Number(trials?.total || 0),
      },
      infrastructure: {
        branches: Number(branchTotals?.total || 0),
        terminals: Number(terminalTotals?.total || 0),
        active_users: Number(userTotals?.total || 0),
      },
      last_30_days: {
        orders: Number(orderTotals?.total || 0),
        gross_merchandise_value_by_currency: (gmvRows.results || []).map((row: any) => ({
          currency: row.currency,
          amount: Number(row.gmv || 0),
          orders: Number(row.orders || 0),
        })),
      },
      monthly_recurring_revenue_by_currency: (mrrRows.results || []).map((row: any) => ({
        currency: row.currency,
        amount_minor: Number(row.mrr_minor || 0),
        amount: Number(row.mrr_minor || 0) / 100,
      })),
      data_source: 'cloudflare_d1',
      currency_note: 'Amounts are grouped by currency. No cross-currency conversion is performed.',
    });
  } catch (error) {
    console.error('[PlatformAdmin] Overview query failed; apply/check migration 0008:', error);
    return migrationRequired();
  }
}

async function handleListPlans(env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(`
      SELECT code, name, currency, monthly_price_minor, yearly_price_minor,
             entitlements_json, is_active, sort_order
      FROM saas_plans
      ORDER BY sort_order ASC, code ASC
    `).all<any>();

    const plans = (result.results || []).map((row: any) => {
      let entitlements: Record<string, unknown> = {};
      try {
        entitlements = JSON.parse(row.entitlements_json || '{}');
      } catch {
        entitlements = {};
      }
      return {
        code: row.code,
        name: row.name,
        currency: row.currency,
        monthly_price_minor: Number(row.monthly_price_minor),
        yearly_price_minor: Number(row.yearly_price_minor),
        monthly_price: Number(row.monthly_price_minor) / 100,
        yearly_price: Number(row.yearly_price_minor) / 100,
        entitlements,
        active: Boolean(row.is_active),
      };
    });

    return Response.json({ plans, data_source: 'cloudflare_d1' });
  } catch (error) {
    console.error('[PlatformAdmin] Plan catalogue query failed:', error);
    return migrationRequired();
  }
}

async function handleListTenants(url: URL, env: Env): Promise<Response> {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const status = (url.searchParams.get('status') || '').trim().toLowerCase();
  const plan = (url.searchParams.get('plan') || '').trim().toLowerCase();
  const rawLimit = Number(url.searchParams.get('limit') || 25);
  const rawOffset = Number(url.searchParams.get('offset') || 0);

  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100 ||
      !Number.isInteger(rawOffset) || rawOffset < 0 ||
      (status && !['active', 'suspended', 'closed'].includes(status)) ||
      (plan && !['starter', 'pro', 'enterprise'].includes(plan))) {
    return Response.json({ error: 'Invalid tenant list filters or pagination values' }, { status: 400 });
  }

  const conditions: string[] = [];
  const binds: any[] = [];
  if (query) {
    conditions.push('(o.id LIKE ? OR o.name LIKE ? OR COALESCE(o.legal_name, \'\') LIKE ?)');
    binds.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (status) {
    conditions.push('o.account_status = ?');
    binds.push(status);
  }
  if (plan) {
    conditions.push('s.plan_code = ?');
    binds.push(plan);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [count, rows] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS total FROM organizations o LEFT JOIN organization_subscriptions s ON s.organization_id = o.id ${where}`)
        .bind(...binds).first<any>(),
      env.DB.prepare(`
        SELECT o.id, o.name, o.legal_name, o.country, o.currency, o.timezone,
               o.account_status, o.created_at, o.updated_at,
               s.plan_code, s.status AS subscription_status, s.billing_cycle,
               s.currency AS subscription_currency, s.amount_minor, s.trial_ends_at,
               s.current_period_start, s.current_period_end, s.cancel_at_period_end,
               (SELECT COUNT(*) FROM branches b WHERE b.organization_id = o.id) AS branch_count,
               (SELECT COUNT(*) FROM terminals t WHERE t.organization_id = o.id) AS terminal_count,
               (SELECT COUNT(*) FROM cloud_users u WHERE u.organization_id = o.id AND u.status = 'active') AS active_user_count,
               (SELECT MAX(t.last_seen_at) FROM terminals t WHERE t.organization_id = o.id) AS last_terminal_seen_at
        FROM organizations o
        LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
        ${where}
        ORDER BY o.created_at DESC, o.id ASC
        LIMIT ? OFFSET ?
      `).bind(...binds, rawLimit, rawOffset).all<any>(),
    ]);

    return Response.json({
      tenants: rows.results || [],
      pagination: {
        limit: rawLimit,
        offset: rawOffset,
        total: Number(count?.total || 0),
      },
      data_source: 'cloudflare_d1',
    });
  } catch (error) {
    console.error('[PlatformAdmin] Tenant directory query failed:', error);
    return migrationRequired();
  }
}

async function handleTenantDetail(tenantId: string, env: Env): Promise<Response> {
  if (!tenantId || tenantId.length > 128) {
    return Response.json({ error: 'Invalid tenant identifier' }, { status: 400 });
  }

  try {
    const [tenant, branches, terminals, users] = await Promise.all([
      env.DB.prepare(`
        SELECT o.id, o.name, o.legal_name, o.tax_number, o.country, o.currency, o.timezone,
               o.account_status, o.created_at, o.updated_at,
               s.plan_code, s.status AS subscription_status, s.billing_cycle,
               s.currency AS subscription_currency, s.amount_minor, s.trial_ends_at,
               s.current_period_start, s.current_period_end, s.provider,
               s.provider_subscription_id, s.cancel_at_period_end
        FROM organizations o
        LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
        WHERE o.id = ?
      `).bind(tenantId).first<any>(),
      env.DB.prepare('SELECT id, code, name, status, address, phone, email, created_at FROM branches WHERE organization_id = ? ORDER BY created_at')
        .bind(tenantId).all<any>(),
      env.DB.prepare('SELECT id, branch_id, terminal_name, last_seen_at, app_version, created_at FROM terminals WHERE organization_id = ? ORDER BY created_at')
        .bind(tenantId).all<any>(),
      env.DB.prepare("SELECT id, email, name, role, assigned_branch_id, status, last_login_at, created_at FROM cloud_users WHERE organization_id = ? ORDER BY created_at")
        .bind(tenantId).all<any>(),
    ]);

    if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 });

    return Response.json({
      tenant,
      branches: branches.results || [],
      terminals: terminals.results || [],
      users: users.results || [],
      data_source: 'cloudflare_d1',
    });
  } catch (error) {
    console.error('[PlatformAdmin] Tenant detail query failed:', error);
    return migrationRequired();
  }
}


async function parseAdminJson(request: Request): Promise<any> {
  try { return await request.json(); }
  catch { return null; }
}

function validReason(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 10 && value.trim().length <= 500;
}

async function handleUpdateTenantAccountStatus(
  request: Request,
  env: Env,
  actorEmail: string,
  organizationId: string,
): Promise<Response> {
  const body = await parseAdminJson(request);
  const nextStatus = typeof body?.account_status === 'string' ? body.account_status : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!['active', 'suspended', 'closed'].includes(nextStatus) || !validReason(reason)) {
    return Response.json({
      error: 'account_status must be active, suspended or closed, and a reason of at least 10 characters is required.',
    }, { status: 400 });
  }

  const current = await env.DB.prepare(
    'SELECT id, name, account_status FROM organizations WHERE id = ?'
  ).bind(organizationId).first<any>();
  if (!current) return Response.json({ error: 'Tenant not found' }, { status: 404 });

  if (current.account_status === nextStatus) {
    return Response.json({ ok: true, changed: false, tenant: current, message: 'Account status is already set to this value.' });
  }

  const now = new Date().toISOString();
  const auditId = crypto.randomUUID();
  const before = { account_status: current.account_status };
  const after = { account_status: nextStatus };
  await env.DB.batch([
    env.DB.prepare('UPDATE organizations SET account_status = ?, updated_at = ? WHERE id = ?')
      .bind(nextStatus, now, organizationId),
    env.DB.prepare(`
      INSERT INTO platform_admin_audit_log
        (id, actor_email, action, organization_id, reason, before_json, after_json, created_at)
      VALUES (?, ?, 'tenant.account_status.changed', ?, ?, ?, ?, ?)
    `).bind(auditId, actorEmail, organizationId, reason, JSON.stringify(before), JSON.stringify(after), now),
  ]);

  return Response.json({
    ok: true,
    changed: true,
    tenant: { id: current.id, name: current.name, account_status: nextStatus },
    audit_id: auditId,
  });
}

async function handleUpdateTenantSubscription(
  request: Request,
  env: Env,
  actorEmail: string,
  organizationId: string,
): Promise<Response> {
  const body = await parseAdminJson(request);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const planCode = typeof body?.plan_code === 'string' ? body.plan_code.trim().toLowerCase() : '';
  const billingCycle = body?.billing_cycle === 'yearly' ? 'yearly' : body?.billing_cycle === 'monthly' ? 'monthly' : '';
  const requestedStatus = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : '';

  if (!planCode || !validReason(reason) ||
      (requestedStatus && !['trial', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired'].includes(requestedStatus))) {
    return Response.json({
      error: 'A valid plan_code and a reason of at least 10 characters are required. Subscription status must be a supported lifecycle state.',
    }, { status: 400 });
  }

  const [organization, plan] = await Promise.all([
    env.DB.prepare('SELECT id, name, account_status FROM organizations WHERE id = ?')
      .bind(organizationId).first<any>(),
    env.DB.prepare('SELECT code, name, currency, monthly_price_minor, yearly_price_minor, is_active FROM saas_plans WHERE code = ?')
      .bind(planCode).first<any>(),
  ]);
  if (!organization) return Response.json({ error: 'Tenant not found' }, { status: 404 });
  if (!plan || Number(plan.is_active) !== 1) return Response.json({ error: 'Subscription plan not found or inactive' }, { status: 404 });

  const current = await env.DB.prepare(
    'SELECT * FROM organization_subscriptions WHERE organization_id = ?'
  ).bind(organizationId).first<any>();

  const cycle = billingCycle || current?.billing_cycle || 'monthly';
  const amountMinor = Number(cycle === 'yearly' ? plan.yearly_price_minor : plan.monthly_price_minor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    return Response.json({ error: 'The selected plan has an invalid stored price.' }, { status: 500 });
  }

  const nextStatus = requestedStatus || current?.status || 'trial';
  // A platform-admin override must never impersonate a provider-confirmed payment.
  // Only a payment verification/webhook may transition a non-active subscription to active.
  if (nextStatus === 'active' && current?.status !== 'active') {
    return Response.json({
      error: 'Paid subscription activation requires verified billing-provider settlement. This admin endpoint cannot mark an unpaid subscription as active.',
      code: 'PAYMENT_VERIFICATION_REQUIRED',
    }, { status: 409 });
  }

  const now = new Date().toISOString();
  const subscriptionId = current?.id || crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const trialEndsAt = nextStatus === 'trial'
    ? (current?.status === 'trial' && current?.trial_ends_at
      ? current.trial_ends_at
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
    : (current?.trial_ends_at || null);

  const before = current ? {
    plan_code: current.plan_code,
    status: current.status,
    billing_cycle: current.billing_cycle,
    currency: current.currency,
    amount_minor: current.amount_minor,
  } : null;
  const after = {
    plan_code: planCode,
    status: nextStatus,
    billing_cycle: cycle,
    currency: plan.currency,
    amount_minor: amountMinor,
  };

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO organization_subscriptions
        (id, organization_id, plan_code, status, billing_cycle, currency, amount_minor,
         trial_ends_at, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        plan_code = excluded.plan_code,
        status = excluded.status,
        billing_cycle = excluded.billing_cycle,
        currency = excluded.currency,
        amount_minor = excluded.amount_minor,
        trial_ends_at = excluded.trial_ends_at,
        updated_at = excluded.updated_at
    `).bind(
      subscriptionId, organizationId, planCode, nextStatus, cycle, plan.currency,
      amountMinor, trialEndsAt, current?.current_period_start || null,
      current?.current_period_end || null, current?.created_at || now, now,
    ),
    env.DB.prepare(`
      INSERT INTO subscription_events
        (id, organization_id, subscription_id, event_type, source, event_json, created_at)
      VALUES (?, ?, ?, ?, 'platform_admin_manual_override', ?, ?)
    `).bind(
      eventId, organizationId, subscriptionId,
      current ? 'admin_subscription_changed' : 'admin_trial_created',
      JSON.stringify({ before, after, reason }), now,
    ),
    env.DB.prepare(`
      INSERT INTO platform_admin_audit_log
        (id, actor_email, action, organization_id, reason, before_json, after_json, created_at)
      VALUES (?, ?, 'tenant.subscription.changed', ?, ?, ?, ?, ?)
    `).bind(auditId, actorEmail, organizationId, reason, JSON.stringify(before), JSON.stringify(after), now),
  ]);

  return Response.json({
    ok: true,
    tenant: { id: organization.id, name: organization.name, subscription: after },
    audit_id: auditId,
    event_id: eventId,
    note: nextStatus === 'active'
      ? 'Existing provider-confirmed active subscription retained; plan price snapshot updated.'
      : 'No payment was recorded or verified by this administrative change.',
  });
}

/**
 * Dispatch all /api/platform-admin/* paths. Returns 401 rather than falling through
 * to normal restaurant-owner authentication when a platform token is missing/invalid.
 */
export async function handlePlatformAdminRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  if (path === '/api/platform-admin/login' && method === 'POST') {
    return handlePlatformAdminLogin(request, env);
  }

  const admin = await verifyPlatformAdmin(request, env);
  if (!admin) {
    const config = configuredAdmin(env);
    if (!config) return Response.json({ error: 'Platform admin is not configured', code: 'PLATFORM_ADMIN_NOT_CONFIGURED' }, { status: 503 });
    return Response.json({ error: 'Unauthorized: valid platform administrator token required' }, { status: 401 });
  }

  if (path === '/api/platform-admin/me' && method === 'GET') {
    return Response.json({ admin: { email: admin.email, role: 'platform_admin' } });
  }
  if (path === '/api/platform-admin/overview' && method === 'GET') {
    return handleOverview(env);
  }
  if (path === '/api/platform-admin/plans' && method === 'GET') {
    return handleListPlans(env);
  }
  if (path === '/api/platform-admin/tenants' && method === 'GET') {
    return handleListTenants(new URL(request.url), env);
  }
  const accountStatusMatch = path.match(/^\/api\/platform-admin\/tenants\/([^/]+)\/account-status$/);
  if (accountStatusMatch && method === 'PATCH') {
    return handleUpdateTenantAccountStatus(request, env, admin.email, decodeURIComponent(accountStatusMatch[1]));
  }
  const subscriptionMatch = path.match(/^\/api\/platform-admin\/tenants\/([^/]+)\/subscription$/);
  if (subscriptionMatch && method === 'PATCH') {
    return handleUpdateTenantSubscription(request, env, admin.email, decodeURIComponent(subscriptionMatch[1]));
  }
  if (path.startsWith('/api/platform-admin/tenants/') && method === 'GET') {
    const tenantId = decodeURIComponent(path.slice('/api/platform-admin/tenants/'.length));
    return handleTenantDetail(tenantId, env);
  }

  return Response.json({ error: 'Platform admin endpoint not found' }, { status: 404 });
}
