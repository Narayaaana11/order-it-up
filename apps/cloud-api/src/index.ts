/**
 * Order It Up Cloud Edge Worker - Serverless Multi-Branch Backend (Cloudflare Workers + D1)
 */

import { Env, handleGeneratePairing, handleClaimPairing, handleDisconnectTerminal } from './routes/pairing';
import { handleRegisterPilotInvitation, handleRegisterTenant } from './routes/registration';
import { handleIngestSyncEvents } from './routes/sync';
import { handleAnalyticsOverview } from './routes/analytics';
import { handleDashboardReport } from './routes/dashboard-reports';
import { handleAccountantClosures, handleAccountantTaxSummary, handleTallyExport } from './routes/accountant';
import { handleGetMasterCatalog, handleSaveMasterProduct, handleGetBranchCatalog, handleSetBranchOverride } from './routes/catalog';
import { handleDeleteAddon, handleDeleteAddonGroup, handleListAddonGroups, handleSaveAddon, handleSaveAddonGroup } from './routes/addons';
import { handleListTransfers, handleCreateTransfer, handleUpdateTransferStatus } from './routes/transfers';
import {
  handleListRestaurants,
  handleCreateRestaurant,
  handleListBranches,
  handleCreateBranch,
  handleListMemberships,
  handleCreateOrUpdateMembership,
  handleRevokeMembership,
} from './routes/hierarchy';
import {
  handleListOrders,
  handleGetOrder,
  handleCreateOrder,
  handleAddOrderItems,
  handleUpdateOrderStatus,
  handleUpdateOrderPayment,
  handleGetOrderPayments,
  handleRecordCustomerPayment,
  handleRefundCustomerPayment,
  handleListTables,
  handleCreateTable,
  handleUpdateTableStatus,
  handleUpdateTable,
  handleSetTableActive,
  handleListKitchenTickets,
  handleUpdateKitchenTicketStatus,
} from './routes/operations';
import { getUserMemberships, isOrgOwnerOrAdmin, isOrgAccountant } from './rbac';
import { createJWT, verifyJWT, hashPassword, verifyPassword, hashString, isSecretValid } from './auth';
import { checkRateLimit, createRateLimitResponse, getClientIp, DEFAULT_RATE_LIMITS, getEffectiveLimit } from './rate-limit';
import { handlePlatformAdminRequest } from './routes/platform-admin';
import { handleCreatePilotRequest, purgeExpiredPilotRequests } from './routes/pilot-requests';
import { handleCreateSaasSubscriptionOrder, handleVerifySaasSubscriptionPayment, handleRazorpaySubscriptionWebhook } from './routes/subscription-payments';
import { resolveOrganizationAccess, requiredPlanFeature } from './subscriptions';
import {
  handleCreatePublicQrOrder,
  handleGenerateTableQrCode,
  handleGetPublicQrMenu,
  handleGetPublicQrOrder,
} from './routes/public-qr';
import { handleQrPosDelivery } from './routes/qr-pos-delivery';
import { handleRestaurantOpsRequest } from './routes/restaurant-ops';
import { handleCatalogAdminRequest } from './routes/catalog-admin';
import { handleCustomersRequest } from './routes/customers';
import { handleStaffRequest } from './routes/staff';
import { handleMenuCsvRequest } from './routes/menu-csv';
import { handleMobileCompatRequest, handleRefreshSession } from './routes/mobile-compat';
import { handleGuestPaymentsRequest } from './routes/guest-payments';

function corsHeaders(request?: Request, env?: Env): Record<string, string> {
  const requestOrigin = request?.headers.get('Origin');
  const allowedOrigins = (env?.FRONTEND_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const restrictedEnvironment = env?.ENVIRONMENT === 'production' || env?.ENVIRONMENT === 'staging';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Idempotency-Key, X-Razorpay-Signature, X-Razorpay-Event-Id',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (restrictedEnvironment) {
    // Production and staging require an explicit exact-origin allowlist.
    // Wildcard entries are deliberately not accepted in restricted environments.
    if (requestOrigin && allowedOrigins.includes(requestOrigin) && !allowedOrigins.includes('*')) {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
    }
  } else if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }

  return headers;
}

const REQUIRED_READINESS_TABLES = [
  'organizations', 'branches', 'cloud_users', 'terminals', 'pairing_tokens', 'master_categories',
  'master_products', 'branch_product_overrides', 'synced_orders', 'synced_order_items',
  'synced_cash_closures', 'inventory_transfers', 'rate_limits', 'sync_events', 'restaurants',
  'memberships', 'dining_tables', 'kitchen_tickets', 'customer_payments', 'saas_plans',
  'organization_subscriptions', 'subscription_events', 'platform_admin_audit_log',
  'cloud_token_revocations', 'qr_table_tokens', 'qr_order_tracking_tokens', 'master_addon_groups',
  'master_addons', 'master_product_addon_groups', 'qr_order_idempotency', 'pilot_access_requests',
  'saas_subscription_payment_orders', 'saas_payment_webhook_events', 'qr_order_pos_deliveries',
  'pilot_access_invitations', 'restaurant_vendors', 'expense_categories', 'expenses',
  'reservations', 'ingredients', 'inventory_transactions', 'recipes', 'delivery_jobs',
  'customers', 'held_orders', 'payment_intents',
] as const;

function hasRequiredAuthenticationConfiguration(env: Env): boolean {
  const adminEmail = typeof env.PLATFORM_ADMIN_EMAIL === 'string' ? env.PLATFORM_ADMIN_EMAIL.trim() : '';
  const adminPasswordHash = typeof env.PLATFORM_ADMIN_PASSWORD_HASH === 'string' ? env.PLATFORM_ADMIN_PASSWORD_HASH.trim() : '';
  return isSecretValid(env.JWT_SECRET) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) &&
    /^scrypt\$N=\d+,r=\d+,p=\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/i.test(adminPasswordHash) &&
    isSecretValid(env.PLATFORM_ADMIN_JWT_SECRET) &&
    env.PLATFORM_ADMIN_JWT_SECRET !== env.JWT_SECRET;
}

async function handleReadiness(env: Env): Promise<Response> {
  if (!hasRequiredAuthenticationConfiguration(env)) {
    return Response.json({
      service: 'orderitup-cloud-api', status: 'not_ready', code: 'SERVICE_CONFIGURATION_INCOMPLETE',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const placeholders = REQUIRED_READINESS_TABLES.map(() => '?').join(', ');
    const tables = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})
    `).bind(...REQUIRED_READINESS_TABLES).all<{ name: string }>();
    const present = new Set((tables.results || []).map((row) => row.name));
    if (REQUIRED_READINESS_TABLES.some((name) => !present.has(name))) {
      return Response.json({
        service: 'orderitup-cloud-api', status: 'not_ready', code: 'DATABASE_SCHEMA_INCOMPLETE',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    await env.DB.prepare('SELECT account_status FROM organizations LIMIT 0').all();
    await env.DB.prepare('SELECT product_sku FROM synced_order_items LIMIT 0').all();
    await env.DB.prepare('SELECT completed_at FROM synced_orders LIMIT 0').all();
    return Response.json({ service: 'orderitup-cloud-api', status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const errorText = String((error as Error)?.message || error);
    const schemaIssue = /no such (table|column)|schema/i.test(errorText);
    return Response.json({
      service: 'orderitup-cloud-api', status: 'not_ready',
      code: schemaIssue ? 'DATABASE_SCHEMA_INCOMPLETE' : 'DATABASE_UNAVAILABLE',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request, env) });
    }

    try {
      const response = await routeRequest(request, env, url, method);
      // Attach CORS
      const headers = new Headers(response.headers);
      for (const [key, val] of Object.entries(corsHeaders(request, env))) {
        headers.set(key, val);
      }
      if (url.pathname === '/api/pilot-requests' ||
          url.pathname.startsWith('/api/platform-admin/') ||
          url.pathname.startsWith('/api/auth/') ||
          url.pathname === '/api/pilot-invitations/redeem') {
        headers.set('Cache-Control', 'no-store');
      }
      if (url.pathname === '/api/webhooks/razorpay') headers.set('Cache-Control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err: any) {
      console.error('Unhandled worker error:', err);
      return Response.json(
        { error: 'Internal Server Error' },
        { status: 500, headers: corsHeaders(request, env) }
      );
    }
  },
  scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext): void {
    context.waitUntil(purgeExpiredPilotRequests(env).catch((error) => {
      console.error('[PilotRequest] Scheduled retention purge failed:', error);
      throw error;
    }));
  },
};

async function routeRequest(request: Request, env: Env, url: URL, method: string): Promise<Response> {
  const rawPath = url.pathname;
  // Normalize path to always begin with /api/ for uniform routing
  const path = rawPath.startsWith('/api') ? rawPath : `/api${rawPath === '/' ? '' : rawPath}`;

  // 1. Health check
  if (rawPath === '/' || rawPath === '/health' || path === '/api/health') {
    return Response.json({
      service: 'orderitup-cloud-api',
      version: '1.0.0',
      status: 'operational',
      engine: 'Cloudflare Workers + D1'
    });
  }

  if ((rawPath === '/ready' || path === '/api/ready') && method === 'GET') {
    return handleReadiness(env);
  }

  // 1b. Setup status check (Cloud SaaS is always initialized; no desktop wizard needed)
  if (path === '/api/auth/setup/status' && method === 'GET') {
    return Response.json({
      needsSetup: false,
      masterPinAvailable: false,
      mode: 'cloud_saas',
      status: 'operational'
    });
  }

  if (path === '/api/pilot-requests' && method === 'POST') {
    return handleCreatePilotRequest(request, env);
  }

  if (path === '/api/pilot-invitations/redeem' && method === 'POST') {
    return handleRegisterPilotInvitation(request, env);
  }

  // Razorpay server-to-server delivery uses its own HMAC over the raw body.
  if (path === '/api/webhooks/razorpay' && method === 'POST') {
    return handleRazorpaySubscriptionWebhook(request, env);
  }

  // 2. Auth: Login
  if (path === '/api/auth/login' && method === 'POST') {
    if (!isSecretValid(env.JWT_SECRET)) {
      return Response.json(
        { error: 'Server authentication service is misconfigured' },
        { status: 500 }
      );
    }

    // 2a. IP-based rate limiting (configurable via RATE_LIMIT_LOGIN_IP, default 30 attempts/min)
    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit(env.DB, {
      keyPrefix: 'login_ip',
      identifier: clientIp,
      limit: getEffectiveLimit(env.RATE_LIMIT_LOGIN_IP, DEFAULT_RATE_LIMITS.LOGIN_IP.limit),
      windowSeconds: DEFAULT_RATE_LIMITS.LOGIN_IP.windowSeconds,
    });
    if (!ipLimit.allowed) {
      return createRateLimitResponse(ipLimit);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return Response.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    // 2b. Account-based rate limiting (5 attempts per 5 minutes per normalized email)
    const accountLimit = await checkRateLimit(env.DB, {
      keyPrefix: 'login_account',
      identifier: email,
      limit: getEffectiveLimit(env.RATE_LIMIT_LOGIN_ACCOUNT, DEFAULT_RATE_LIMITS.LOGIN_ACCOUNT.limit),
      windowSeconds: DEFAULT_RATE_LIMITS.LOGIN_ACCOUNT.windowSeconds,
    });
    if (!accountLimit.allowed) {
      return createRateLimitResponse(accountLimit);
    }

    const user = await env.DB.prepare(`
      SELECT u.*, o.name as organization_name, o.currency, o.timezone,
             o.account_status, s.plan_code AS subscription_plan,
             s.status AS subscription_status, s.trial_ends_at, s.current_period_end
      FROM cloud_users u
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
      WHERE u.email = ? AND u.status = 'active'
    `).bind(email).first<any>();

    // Fail closed on user not found, inactive, or null/empty password hash
    if (!user || !user.password_hash || typeof user.password_hash !== 'string' || user.password_hash.trim() === '') {
      // Run dummy verification with fixed parameters to mitigate timing-based account enumeration
      await verifyPassword(password, 'scrypt$N=16384,r=8,p=1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000');
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // The platform operator can suspend an organization or subscription centrally.
    // Check this server-side after verifying the password to avoid leaking account state.
    if (user.account_status && user.account_status !== 'active') {
      return Response.json({ error: 'This organization is currently unavailable. Contact platform support.' }, { status: 403 });
    }
    if (['suspended', 'cancelled', 'expired'].includes(user.subscription_status)) {
      return Response.json({ error: 'This subscription is not active. Contact the organization owner or platform support.' }, { status: 402 });
    }

    // Rehash legacy hash (e.g. SHA-256) to modern scrypt on successful login
    if (needsRehash) {
      try {
        const modernHash = await hashPassword(password);
        await env.DB.prepare(`
          UPDATE cloud_users SET password_hash = ?, updated_at = ? WHERE id = ?
        `).bind(modernHash, new Date().toISOString(), user.id).run();
      } catch (err) {
        console.error('Failed to rehash legacy password:', err);
      }
    }

    // Update last_login_at
    const nowIso = new Date().toISOString();
    await env.DB.prepare('UPDATE cloud_users SET last_login_at = ? WHERE id = ?')
      .bind(nowIso, user.id).run();

    // Generate JWT (7 days expiration)
    const exp = Math.floor(Date.now() / 1000) + (7 * 86400);
    const token = await createJWT({
      sub: user.id,
      org: user.organization_id,
      email: user.email,
      role: user.role,
      branch: user.assigned_branch_id || null,
      exp
    }, env.JWT_SECRET);

    const tenantObj = {
      id: user.organization_id,
      name: user.organization_name,
      business_name: user.organization_name,
      slug: (user.organization_name || 'store').toLowerCase().replace(/\s+/g, '-'),
      database_name: 'cloud_d1',
      business_type: 'restaurant',
      country: user.country || 'IN',
      currency: user.currency || 'INR',
      timezone: user.timezone || 'Asia/Kolkata',
      plan: user.subscription_plan || 'saas_production',
      status: user.subscription_status || 'active',
      trial_expires_at: user.trial_ends_at || null,
      current_period_end: user.current_period_end || null,
      role: user.role,
    };

    return Response.json({
      token,
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        currency: user.currency,
        timezone: user.timezone,
        assigned_branch_id: user.assigned_branch_id || null
      },
      tenants: [tenantObj],
      tenant: tenantObj,
    });
  }

  // 2b. Auth: Self-Service Tenant Registration
  if ((path === '/api/auth/register' || path === '/api/auth/register-saas') && method === 'POST') {
    return handleRegisterTenant(request, env);
  }

  // 3. Demo / Initializer Setup Seed
  if (path === '/api/auth/setup-demo' && method === 'POST') {
    return handleSetupDemo(request, env);
  }

  // 4. POS Terminal Pairing (Claiming)
  if (path === '/api/pos/pair' && method === 'POST') {
    return handleClaimPairing(request, env);
  }
  if (path === '/api/pos/disconnect' && method === 'POST') {
    return handleDisconnectTerminal(request, env);
  }

  // 5. POS Ingest Events
  if (path === '/api/pos/events' && method === 'POST') {
    return handleIngestSyncEvents(request, env);
  }

  // Customer QR routes authenticate using per-table/order bearer capabilities,
  // not a Cloud Portal staff JWT. Table QR issuance remains staff-authenticated below.
  if (path === '/api/qr/menu' && method === 'GET') {
    return handleGetPublicQrMenu(env, request, url);
  }
  if (path === '/api/qr/order' && method === 'POST') {
    return handleCreatePublicQrOrder(env, request);
  }
  if (path.startsWith('/api/qr/order/') && method === 'GET') {
    const orderId = path.slice('/api/qr/order/'.length);
    if (!orderId || orderId.includes('/')) return Response.json({ error: 'Order not found' }, { status: 404 });
    return handleGetPublicQrOrder(env, request, orderId);
  }

  // Terminal-authenticated Cloud QR inbox, isolated from Cloud Portal user JWTs.
  if (path === '/api/pos/qr-orders' || path === '/api/pos/catalog' || /^\/api\/pos\/qr-orders\/[^/]+\/ack$/.test(path)) {
    return handleQrPosDelivery(request, env, path);
  }

  // 5a. Isolated platform-level admin API; this auth namespace never falls through to restaurant JWT auth.
  if (path === '/api/platform-admin' || path.startsWith('/api/platform-admin/')) {
    return handlePlatformAdminRequest(request, env, path, method);
  }

  // Authenticated Portal Endpoints (Require Bearer JWT)
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const claims = token && isSecretValid(env.JWT_SECRET) ? await verifyJWT(token, env.JWT_SECRET) : null;

  if (!claims) {
    return Response.json({ error: 'Unauthorized: valid cloud user token required' }, { status: 401 });
  }

  const tokenHash = await hashString(token);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const revokedToken = await env.DB.prepare(`
    SELECT 1 AS revoked FROM cloud_token_revocations
    WHERE token_hash = ? AND expires_at > ?
  `).bind(tokenHash, nowSeconds).first<any>();
  if (revokedToken) {
    return Response.json({ error: 'Unauthorized: cloud user session has been revoked' }, { status: 401 });
  }

  // Mobile clients refresh a valid session without re-entering credentials.
  if (path === '/api/auth/refresh' && method === 'POST') {
    return handleRefreshSession(env, claims as any);
  }

  // Logout must remain available after membership or subscription revocation.
  // The verified bearer token itself is the session identifier.
  if (path === '/api/auth/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM cloud_token_revocations WHERE expires_at <= ?')
      .bind(nowSeconds).run();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO cloud_token_revocations (token_hash, expires_at, revoked_at)
      VALUES (?, ?, ?)
    `).bind(tokenHash, claims.exp, new Date().toISOString()).run();
    return Response.json({ success: true, message: 'Logged out successfully' });
  }

  const orgId = claims.org;
  const userId = claims.sub;
  const memberships = await getUserMemberships(env.DB, orgId, userId);

  // The D1 subscription row, not JWT role claims, is the source of plan access.
  // Auth session inspection and logout remain available so an expired owner can
  // see the reason and leave the session; ordinary operations are gated below.
  const subscriptionAccess = await resolveOrganizationAccess(env.DB, orgId);
  const subscriptionManagementPath =
    path === '/api/auth/me' ||
    path === '/api/auth/logout' ||
    path === '/api/subscription' ||
    path === '/api/subscription/plans' ||
    path === '/api/subscription/create-order' ||
    path === '/api/subscription/verify-payment';
  if (!subscriptionAccess.allowed && !subscriptionManagementPath) {
    const statusCode = subscriptionAccess.organizationStatus !== 'active' ? 403 : 402;
    return Response.json({
      error: subscriptionAccess.reason || 'Subscription access is unavailable.',
      code: statusCode === 402 ? 'SUBSCRIPTION_REQUIRED' : 'ORGANIZATION_UNAVAILABLE',
      subscription_status: subscriptionAccess.subscriptionStatus,
      plan: subscriptionAccess.planCode,
    }, { status: statusCode });
  }

  if (subscriptionAccess.allowed) {
    const requiredFeature = requiredPlanFeature(path, method);
    if (requiredFeature && subscriptionAccess.entitlements[requiredFeature] !== true) {
      return Response.json({
        error: 'This feature is not included in the current subscription plan.',
        code: 'PLAN_FEATURE_REQUIRED',
        feature: requiredFeature,
        plan: subscriptionAccess.planCode,
      }, { status: 403 });
    }
  }

  if (memberships.length === 0) {
    return Response.json({ error: 'Forbidden: No active organization memberships' }, { status: 403 });
  }

  // Guest payment intents: provider-created, capture-verified, fail-closed.
  const guestPaymentsResponse = await handleGuestPaymentsRequest(request, env, path, method, claims, memberships);
  if (guestPaymentsResponse) return guestPaymentsResponse;

  // Mobile compatibility adapters (session refresh is handled above).
  const mobileCompatResponse = await handleMobileCompatRequest(request, env, path, method, claims, memberships);
  if (mobileCompatResponse) return mobileCompatResponse;

  // Organization customer registry used by the CRM screen and waiter seating.
  const customersResponse = await handleCustomersRequest(request, env, path, method, claims, memberships);
  if (customersResponse) return customersResponse;

  // Staff directory backed by cloud_users + memberships.
  const staffResponse = await handleStaffRequest(request, env, path, method, claims, memberships);
  if (staffResponse) return staffResponse;

  // Menu CSV templates, exports and imports for the product dashboard.
  const menuCsvResponse = await handleMenuCsvRequest(request, env, path, method, claims, memberships);
  if (menuCsvResponse) return menuCsvResponse;

  // Desktop-compatible menu management (/products, /categories) backed by the
  // Cloud master catalog, so the web and tablet dashboards can edit the menu.
  const catalogAdminResponse = await handleCatalogAdminRequest(request, env, path, method, claims, memberships);
  if (catalogAdminResponse) return catalogAdminResponse;

  // Cloud restaurant operations suite (expenses, reservations, inventory,
  // shift closures, delivery dispatch). Branch authorization is enforced inside.
  const restaurantOpsResponse = await handleRestaurantOpsRequest(request, env, path, method, claims, memberships);
  if (restaurantOpsResponse) return restaurantOpsResponse;

  if (method === 'GET' && (path.startsWith('/reports/') || path.startsWith('/api/reports/'))) {
    return handleDashboardReport(request, env, orgId, memberships);
  }

  const qrCodeMatch = path.match(/^\/api\/qr\/tables\/([^/]+)\/code$/);
  if (qrCodeMatch && method === 'GET') {
    return handleGenerateTableQrCode(request, env, claims, decodeURIComponent(qrCodeMatch[1]));
  }

  // 5b. Auth: Current User & Session Validation (/api/auth/me)
  if (path === '/api/auth/me' && method === 'GET') {
    const user = await env.DB.prepare(`
      SELECT u.*, o.name as organization_name, o.currency, o.timezone, o.country,
             o.account_status, s.plan_code AS subscription_plan,
             s.status AS subscription_status, s.trial_ends_at, s.current_period_end
      FROM cloud_users u
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
      WHERE u.id = ? AND u.status = 'active'
    `).bind(userId).first<any>();

    if (!user) {
      return Response.json({ error: 'User account not found' }, { status: 404 });
    }
    if (user.account_status && user.account_status !== 'active') {
      return Response.json({ error: 'This organization is currently unavailable. Contact platform support.' }, { status: 403 });
    }
    if (['suspended', 'cancelled', 'expired'].includes(user.subscription_status)) {
      return Response.json({ error: 'This subscription is not active. Contact the organization owner or platform support.' }, { status: 402 });
    }

    const tenantObj = {
      id: user.organization_id,
      name: user.organization_name,
      business_name: user.organization_name,
      slug: (user.organization_name || 'store').toLowerCase().replace(/\s+/g, '-'),
      database_name: 'cloud_d1',
      business_type: 'restaurant',
      country: user.country || 'IN',
      currency: user.currency || 'INR',
      timezone: user.timezone || 'Asia/Kolkata',
      plan: user.subscription_plan || 'saas_production',
      status: user.subscription_status || 'active',
      trial_expires_at: user.trial_ends_at || null,
      current_period_end: user.current_period_end || null,
      role: claims.role,
    };

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: claims.role,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        currency: user.currency,
        timezone: user.timezone,
        assigned_branch_id: claims.branch || user.assigned_branch_id || null,
      },
      tenants: [tenantObj],
      tenant: tenantObj,
    });
  }

  // 5c. SaaS subscription status and catalogue (available even when a plan has expired).
  if (path === '/api/subscription' && method === 'GET') {
    const subscription = await env.DB.prepare(`
      SELECT s.id, s.plan_code, s.status, s.billing_cycle, s.currency, s.amount_minor,
             s.trial_ends_at, s.current_period_start, s.current_period_end,
             s.grace_period_end, s.cancel_at_period_end, p.name AS plan_name,
             p.entitlements_json
      FROM organization_subscriptions s
      LEFT JOIN saas_plans p ON p.code = s.plan_code
      WHERE s.organization_id = ?
    `).bind(orgId).first<any>();

    if (!subscription) {
      return Response.json({
        subscription: {
          plan: 'legacy',
          status: 'active',
          current_period_end: null,
          entitlements: null,
          legacy_access: true,
        },
        access: subscriptionAccess,
      });
    }

    let entitlements: Record<string, unknown> = {};
    try { entitlements = JSON.parse(subscription.entitlements_json || '{}'); } catch { entitlements = {}; }
    return Response.json({
      subscription: {
        plan: subscription.plan_code,
        plan_name: subscription.plan_name,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
        currency: subscription.currency,
        amount_minor: Number(subscription.amount_minor || 0),
        trial_ends_at: subscription.trial_ends_at,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        grace_period_end: subscription.grace_period_end,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        entitlements,
      },
      access: subscriptionAccess,
    });
  }
  if (path === '/api/subscription/plans' && method === 'GET') {
    const plans = await env.DB.prepare(`
      SELECT code, name, currency, monthly_price_minor, yearly_price_minor, entitlements_json
      FROM saas_plans WHERE is_active = 1 ORDER BY sort_order, code
    `).all<any>();
    return Response.json({ plans: plans.results || [] });
  }
  if (path === '/api/subscription/create-order' && method === 'POST') {
    return handleCreateSaasSubscriptionOrder(request, env, orgId, memberships);
  }
  if (path === '/api/subscription/verify-payment' && method === 'POST') {
    return handleVerifySaasSubscriptionPayment(request, env, orgId, memberships);
  }

  // 6. Restaurants & Concepts
  if ((path === '/api/restaurants' || path === '/api/cloud/restaurants') && method === 'GET') {
    return handleListRestaurants(request, env, claims);
  }
  if (path === '/api/restaurants' && method === 'POST') {
    return handleCreateRestaurant(request, env, claims);
  }

  // 7. Branches (Multi-Restaurant & Location Scoped)
  if (path === '/api/branches' && method === 'GET') {
    return handleListBranches(request, env, claims, url);
  }
  if (path === '/api/branches' && method === 'POST') {
    return handleCreateBranch(request, env, claims);
  }

  // 8. Location-Scoped Memberships & RBAC
  if (path === '/api/memberships' && method === 'GET') {
    return handleListMemberships(request, env, claims, url);
  }
  if (path === '/api/memberships' && method === 'POST') {
    return handleCreateOrUpdateMembership(request, env, claims);
  }
  if (path.startsWith('/api/memberships/') && method === 'DELETE') {
    const membershipId = path.split('/').pop() || '';
    return handleRevokeMembership(request, env, claims, membershipId);
  }

  // 9. Shared Real-Time Orders
  if (path === '/api/orders' && method === 'GET') {
    return handleListOrders(request, env, claims, url);
  }
  if (path === '/api/orders' && method === 'POST') {
    return handleCreateOrder(request, env, claims);
  }
  if (path.startsWith('/api/orders/') && path.endsWith('/items') && method === 'POST') {
    const parts = path.split('/');
    const orderId = parts[parts.length - 2];
    return handleAddOrderItems(request, env, claims, orderId);
  }
  if (path.startsWith('/api/orders/') && path.endsWith('/status') && method === 'PATCH') {
    const parts = path.split('/');
    const orderId = parts[parts.length - 2];
    return handleUpdateOrderStatus(request, env, claims, orderId);
  }
  if (path.startsWith('/api/orders/') && path.endsWith('/payment') && method === 'PATCH') {
    const parts = path.split('/');
    const orderId = parts[parts.length - 2];
    return handleUpdateOrderPayment(request, env, claims, orderId);
  }
  if (path.startsWith('/api/orders/') && path.includes('/payments/') && path.endsWith('/refund') && method === 'POST') {
    const parts = path.split('/');
    // /api/orders/:orderId/payments/:paymentId/refund
    const orderId = parts[3];
    const paymentId = parts[5];
    return handleRefundCustomerPayment(request, env, claims, orderId, paymentId);
  }
  if (path.startsWith('/api/orders/') && path.endsWith('/payments') && method === 'GET') {
    const parts = path.split('/');
    const orderId = parts[parts.length - 2];
    return handleGetOrderPayments(request, env, claims, orderId);
  }
  if (path.startsWith('/api/orders/') && path.endsWith('/payments') && method === 'POST') {
    const parts = path.split('/');
    const orderId = parts[parts.length - 2];
    return handleRecordCustomerPayment(request, env, claims, orderId);
  }
  if (path.startsWith('/api/orders/') && method === 'GET') {
    const orderId = path.split('/').pop() || '';
    return handleGetOrder(request, env, claims, orderId);
  }

  // 10. Dining Tables
  if (path === '/api/tables' && method === 'GET') {
    return handleListTables(request, env, claims, url);
  }
  if (path === '/api/tables' && method === 'POST') {
    return handleCreateTable(request, env, claims);
  }
  if (path.startsWith('/api/tables/') && path.endsWith('/status') && method === 'PATCH') {
    const parts = path.split('/');
    const tableId = parts[parts.length - 2];
    return handleUpdateTableStatus(request, env, claims, tableId);
  }
  const tableActiveMatch = path.match(/^\/api\/tables\/([^/]+)\/(deactivate|reactivate)$/);
  if (tableActiveMatch && method === 'POST') {
    return handleSetTableActive(request, env, claims, decodeURIComponent(tableActiveMatch[1]), tableActiveMatch[2] === 'reactivate');
  }
  if (path.startsWith('/api/tables/') && method === 'PUT') {
    const tableId = path.split('/').pop() || '';
    return handleUpdateTable(request, env, claims, decodeURIComponent(tableId));
  }

  // 11. Kitchen Display Tickets
  if (path === '/api/kitchen/tickets' && method === 'GET') {
    return handleListKitchenTickets(request, env, claims, url);
  }
  if (path.startsWith('/api/kitchen/tickets/') && path.endsWith('/status') && method === 'PATCH') {
    const parts = path.split('/');
    const ticketId = parts[parts.length - 2];
    return handleUpdateKitchenTicketStatus(request, env, claims, ticketId);
  }

  // 12. Pairing Token Generation (Owner / Manager)
  if (path === '/api/pairing/generate' && method === 'POST') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to generate pairing tokens' }, { status: 403 });
    }
    return handleGeneratePairing(request, env, orgId);
  }

  // 13. Analytics Overview
  if ((path === '/api/analytics/overview' || path === '/api/cloud/overview') && method === 'GET') {
    if (!isOrgOwnerOrAdmin(memberships) && !isOrgAccountant(memberships) && !memberships.some((m) => m.role === 'manager')) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to view analytics' }, { status: 403 });
    }
    return handleAnalyticsOverview(request, env, orgId);
  }

  // 14. Accountant Hub
  if ((path === '/api/accountant/closures' || path === '/api/cloud/closures') && method === 'GET') {
    if (!isOrgOwnerOrAdmin(memberships) && !isOrgAccountant(memberships)) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to access accounting data' }, { status: 403 });
    }
    return handleAccountantClosures(request, env, orgId);
  }
  if (path === '/api/accountant/tax-summary' && method === 'GET') {
    if (!isOrgOwnerOrAdmin(memberships) && !isOrgAccountant(memberships)) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to access accounting data' }, { status: 403 });
    }
    return handleAccountantTaxSummary(request, env, orgId);
  }
  if (path === '/api/accountant/export-tally' && method === 'GET') {
    if (!isOrgOwnerOrAdmin(memberships) && !isOrgAccountant(memberships)) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to access accounting data' }, { status: 403 });
    }
    return handleTallyExport(request, env, orgId);
  }

  // 15. Master Catalog & Overrides
  if (path === '/api/addon-groups' && method === 'GET') {
    return handleListAddonGroups(env, orgId);
  }
  if (path === '/api/addon-groups' && method === 'POST') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) return Response.json({ error: 'Forbidden: only owners and managers can modify modifiers' }, { status: 403 });
    return handleSaveAddonGroup(request, env, orgId);
  }
  const groupMatch = path.match(/^\/api\/addon-groups\/([^/]+)$/);
  if (groupMatch && method === 'PUT') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) return Response.json({ error: 'Forbidden: only owners and managers can modify modifiers' }, { status: 403 });
    return handleSaveAddonGroup(request, env, orgId, groupMatch[1]);
  }
  if (groupMatch && method === 'DELETE') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) return Response.json({ error: 'Forbidden: only owners and managers can modify modifiers' }, { status: 403 });
    return handleDeleteAddonGroup(env, orgId, groupMatch[1]);
  }
  const groupAddonsMatch = path.match(/^\/api\/addon-groups\/([^/]+)\/addons$/);
  if (groupAddonsMatch && method === 'POST') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) return Response.json({ error: 'Forbidden: only owners and managers can modify modifiers' }, { status: 403 });
    return handleSaveAddon(request, env, orgId, groupAddonsMatch[1]);
  }
  const addonMatch = path.match(/^\/api\/addon-groups\/([^/]+)\/addons\/([^/]+)$/);
  if (addonMatch && method === 'PUT') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) return Response.json({ error: 'Forbidden: only owners and managers can modify modifiers' }, { status: 403 });
    return handleSaveAddon(request, env, orgId, addonMatch[1], addonMatch[2]);
  }
  if (addonMatch && method === 'DELETE') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) return Response.json({ error: 'Forbidden: only owners and managers can modify modifiers' }, { status: 403 });
    return handleDeleteAddon(env, orgId, addonMatch[1], addonMatch[2]);
  }
  if ((path === '/api/catalog/master' || path === '/api/cloud/catalog') && method === 'GET') {
    return handleGetMasterCatalog(request, env, orgId);
  }
  if (path === '/api/catalog/product' && method === 'POST') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to modify master catalog' }, { status: 403 });
    }
    return handleSaveMasterProduct(request, env, orgId);
  }
  if (path === '/api/cloud/catalog/override' && method === 'POST') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to modify branch catalog' }, { status: 403 });
    }
    const branch = await env.DB.prepare('SELECT id FROM branches WHERE organization_id = ? LIMIT 1').bind(orgId).first<{ id: string }>();
    if (!branch) {
      return Response.json({ error: 'No branch found' }, { status: 404 });
    }
    return handleSetBranchOverride(request, env, branch.id, orgId);
  }
  if (path.startsWith('/api/catalog/branch/') && path.endsWith('/override') && method === 'POST') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to modify branch catalog' }, { status: 403 });
    }
    const parts = path.split('/');
    const branchId = parts[parts.length - 2];
    return handleSetBranchOverride(request, env, branchId, orgId);
  }
  if (path.startsWith('/api/catalog/branch/') && method === 'GET') {
    const branchId = path.split('/').pop() || '';
    return handleGetBranchCatalog(request, env, branchId, orgId);
  }

  // 16. Inventory Transfers
  if ((path === '/api/transfers' || path === '/api/cloud/transfers') && method === 'GET') {
    return handleListTransfers(request, env, orgId);
  }
  if ((path === '/api/transfers' || path === '/api/cloud/transfers') && method === 'POST') {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to create stock transfers' }, { status: 403 });
    }
    return handleCreateTransfer(request, env, orgId);
  }
  if ((path.startsWith('/api/transfers/') || path.startsWith('/api/cloud/transfers/')) && path.endsWith('/status') && (method === 'PATCH' || method === 'PUT')) {
    if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) {
      return Response.json({ error: 'Forbidden: Insufficient privileges to update stock transfers' }, { status: 403 });
    }
    const parts = path.split('/');
    const transferId = parts[parts.length - 2];
    return handleUpdateTransferStatus(request, env, transferId, orgId);
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}

async function handleSetupDemo(request: Request, env: Env): Promise<Response> {
  // Prevent demo setup in production environments
  if (env.ENVIRONMENT === 'production') {
    return Response.json(
      { error: 'Demo setup is disabled in production environment' },
      { status: 403 }
    );
  }

  // Rate limit demo initialization attempts per IP (3 per hour)
  const clientIp = getClientIp(request);
  const demoLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'demo_setup_ip',
    identifier: clientIp,
    limit: DEFAULT_RATE_LIMITS.DEMO_SETUP_IP.limit,
    windowSeconds: DEFAULT_RATE_LIMITS.DEMO_SETUP_IP.windowSeconds,
  });
  if (!demoLimit.allowed) {
    return createRateLimitResponse(demoLimit);
  }

  const orgCount = await env.DB.prepare('SELECT COUNT(*) as count FROM organizations').first<{ count: number }>();
  if (orgCount && orgCount.count > 0) {
    return Response.json({ message: 'Database already initialized' });
  }

  const now = new Date().toISOString();
  const orgId = 'org-tastecraft-demo';
  const restId = 'rest-tastecraft-flagship';
  const mainBranchId = 'br-main-connaught';
  const franchiseBranchId = 'br-franchise-gurugram';
  const ownerUserId = crypto.randomUUID();
  const accountantUserId = crypto.randomUUID();

  // 1. Organization
  await env.DB.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(orgId, 'TasteCraft Hospitality Group', 'TasteCraft F&B Pvt Ltd', '07AAAAA0000A1Z5', 'INR', 'IN', 'Asia/Kolkata', now, now).run();

  // 1b. Restaurant Brand Concept
  await env.DB.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES (?, ?, 'TasteCraft Dining', 'tastecraft-dining', 'finedine', 'active', ?, ?)
  `).bind(restId, orgId, now, now).run();

  // 2. Branches
  await env.DB.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, address, phone, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'Block C, Connaught Place, New Delhi', '+91 98765 43210', 'active', ?, ?),
           (?, ?, ?, ?, 0, 'Cyber Hub, DLF Phase 2, Gurugram', '+91 98765 12345', 'active', ?, ?)
  `).bind(
    mainBranchId, orgId, restId, 'BR-01', 'Connaught Place (Main)', now, now,
    franchiseBranchId, orgId, restId, 'BR-02', 'Gurugram CyberHub (Franchise)', now, now
  ).run();

  // 3. Demo Users
  const passHash = await hashPassword('admin123');
  await env.DB.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES (?, ?, 'owner@tastecraft.com', ?, 'Vikram Malhotra (Owner)', 'owner', 'active', ?, ?),
           (?, ?, 'accountant@tastecraft.com', ?, 'Pooja Sharma (Accountant)', 'accountant', 'active', ?, ?)
  `).bind(
    ownerUserId, orgId, passHash, now, now,
    accountantUserId, orgId, passHash, now, now
  ).run();

  // 3b. Location-Scoped Memberships
  await env.DB.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES (?, ?, ?, NULL, NULL, 'owner', 'active', ?, ?),
           (?, ?, ?, NULL, NULL, 'accountant', 'active', ?, ?)
  `).bind(
    crypto.randomUUID(), orgId, ownerUserId, now, now,
    crypto.randomUUID(), orgId, accountantUserId, now, now
  ).run();

  // 4. Master Products
  const catMains = crypto.randomUUID();
  const catDrinks = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO master_categories (id, organization_id, name, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, 'Signature Mains', 1, 1, ?, ?),
           (?, ?, 'Artisanal Beverages', 2, 1, ?, ?)
  `).bind(catMains, orgId, now, now, catDrinks, orgId, now, now).run();

  const prod1 = crypto.randomUUID();
  const prod2 = crypto.randomUUID();
  const prod3 = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
    VALUES (?, ?, ?, 'Paneer Tikka Butter Masala', 'MAIN-01', 340, 5, 1, 1, ?, ?),
           (?, ?, ?, 'Woodfired Truffle Pizza', 'MAIN-02', 490, 5, 1, 1, ?, ?),
           (?, ?, ?, 'Iced Hazelnut Cold Brew', 'DRK-01', 220, 5, 1, 1, ?, ?)
  `).bind(
    prod1, orgId, catMains, now, now,
    prod2, orgId, catMains, now, now,
    prod3, orgId, catDrinks, now, now
  ).run();

  return Response.json({
    success: true,
    message: 'Demo franchise organization, branches, users, and catalog seeded successfully'
  });
}
