/**
 * Order It Up Cloud Edge Worker - Serverless Multi-Branch Backend (Cloudflare Workers + D1)
 */

import { Env, handleGeneratePairing, handleClaimPairing } from './routes/pairing';
import { handleRegisterTenant } from './routes/registration';
import { handleIngestSyncEvents } from './routes/sync';
import { handleAnalyticsOverview } from './routes/analytics';
import { handleAccountantClosures, handleAccountantTaxSummary, handleTallyExport } from './routes/accountant';
import { handleGetMasterCatalog, handleSaveMasterProduct, handleGetBranchCatalog, handleSetBranchOverride } from './routes/catalog';
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
  handleListKitchenTickets,
  handleUpdateKitchenTicketStatus,
} from './routes/operations';
import { getUserMemberships, isOrgOwnerOrAdmin, isOrgAccountant } from './rbac';
import { createJWT, verifyJWT, hashPassword, verifyPassword, isSecretValid } from './auth';
import { checkRateLimit, createRateLimitResponse, getClientIp, DEFAULT_RATE_LIMITS, getEffectiveLimit } from './rate-limit';

function corsHeaders(request?: Request, env?: Env): Record<string, string> {
  const requestOrigin = request?.headers.get('Origin');
  let allowOrigin = '*';

  if (requestOrigin) {
    if (env?.FRONTEND_ORIGIN) {
      const allowed = env.FRONTEND_ORIGIN.split(',').map((o) => o.trim());
      if (allowed.includes(requestOrigin) || allowed.includes('*')) {
        allowOrigin = requestOrigin;
      } else {
        allowOrigin = allowed[0];
      }
    } else if (env?.ENVIRONMENT === 'staging') {
      // Avoid blanket wildcard for staging browser requests
      allowOrigin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
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

  // 1b. Setup status check (Cloud SaaS is always initialized; no desktop wizard needed)
  if (path === '/api/auth/setup/status' && method === 'GET') {
    return Response.json({
      needsSetup: false,
      masterPinAvailable: false,
      mode: 'cloud_saas',
      status: 'operational'
    });
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
      SELECT u.*, o.name as organization_name, o.currency, o.timezone
      FROM cloud_users u
      JOIN organizations o ON u.organization_id = o.id
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
      plan: 'saas_production',
      status: 'active',
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

  // 5. POS Ingest Events
  if (path === '/api/pos/events' && method === 'POST') {
    return handleIngestSyncEvents(request, env);
  }

  // Authenticated Portal Endpoints (Require Bearer JWT)
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const claims = token && isSecretValid(env.JWT_SECRET) ? await verifyJWT(token, env.JWT_SECRET) : null;

  if (!claims) {
    return Response.json({ error: 'Unauthorized: valid cloud user token required' }, { status: 401 });
  }

  const orgId = claims.org;
  const userId = claims.sub;
  let memberships = await getUserMemberships(env.DB, orgId, userId);

  // Backward-compatible fallback for owner/admin JWT claims if mock DB or legacy tenant lacks memberships row
  if (memberships.length === 0 && (claims.role === 'owner' || (claims.role as string) === 'admin' || claims.role === 'super_admin')) {
    memberships = [{
      id: `fallback-${userId}`,
      organization_id: orgId,
      user_id: userId,
      restaurant_id: null,
      branch_id: null,
      role: (claims.role as any) === 'admin' ? 'super_admin' : claims.role,
      status: 'active'
    }];
  }

  if (memberships.length === 0) {
    return Response.json({ error: 'Forbidden: No active organization memberships' }, { status: 403 });
  }

  // 5b. Auth: Current User & Session Validation (/api/auth/me)
  if (path === '/api/auth/me' && method === 'GET') {
    const user = await env.DB.prepare(`
      SELECT u.*, o.name as organization_name, o.currency, o.timezone, o.country
      FROM cloud_users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = ? AND u.status = 'active'
    `).bind(userId).first<any>();

    if (!user) {
      return Response.json({ error: 'User account not found' }, { status: 404 });
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
      plan: 'saas_production',
      status: 'active',
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

  // 5c. Auth: Logout
  if (path === '/api/auth/logout' && method === 'POST') {
    return Response.json({ success: true, message: 'Logged out successfully' });
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
