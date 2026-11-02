/**
 * Mobile compatibility routes.
 *
 * The Flutter app uses a slightly different contract than the desktop/Cloud
 * dashboard for session refresh and cash closures. These adapters keep the
 * mobile screens working without changing the mobile client.
 */

import { Env } from './pairing';
import { UserMembership, isAuthorizedForBranch } from '../rbac';
import { createJWT } from '../auth';
import { closeShift, listShiftClosures } from './restaurant-ops';
import { handleDashboardReport } from './dashboard-reports';

const FLOOR_ROLES = ['owner', 'admin', 'manager', 'cashier', 'server', 'waiter', 'host'];

type Claims = { sub: string; org: string; email: string; role: string; branch?: string | null; exp: number };

function text(value: unknown, maximum = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

async function defaultBranchId(env: Env, orgId: string, memberships: UserMembership[]): Promise<string | null> {
  const branchMembership = memberships.find((membership) => membership.branch_id);
  if (branchMembership?.branch_id) return branchMembership.branch_id;
  const row = await env.DB.prepare(`
    SELECT id FROM branches WHERE organization_id = ? AND status = 'active'
    ORDER BY is_main_branch DESC, created_at ASC LIMIT 1
  `).bind(orgId).first<{ id: string }>();
  return row?.id || null;
}

async function canUseBranch(env: Env, orgId: string, memberships: UserMembership[], branchId: string): Promise<boolean> {
  const auth = await isAuthorizedForBranch(env.DB, orgId, memberships, branchId, FLOOR_ROLES);
  return auth.authorized;
}

function heldOrderView(row: any) {
  let items: unknown[] = [];
  if (row.items_json) {
    try { const parsed = JSON.parse(row.items_json); if (Array.isArray(parsed)) items = parsed; } catch { items = []; }
  }
  return {
    id: String(row.id),
    table_id: row.table_id ?? '',
    table_name: row.table_name ?? 'Table',
    customer_id: row.customer_id ?? null,
    customer_name: row.customer_name ?? null,
    customer_phone: row.customer_phone ?? null,
    guest_count: Number(row.guest_count || 2),
    order_notes: row.order_notes ?? null,
    items,
    created_at: row.created_at,
  };
}

async function listHeldOrders(request: Request, env: Env, orgId: string, memberships: UserMembership[]): Promise<Response> {
  const url = new URL(request.url);
  const branchId = text(url.searchParams.get('branch_id'), 100) || await defaultBranchId(env, orgId, memberships);
  if (!branchId) return Response.json({ error: 'No active branch is available' }, { status: 409 });
  if (!await canUseBranch(env, orgId, memberships, branchId)) {
    return Response.json({ error: 'Forbidden: insufficient privileges for this branch' }, { status: 403 });
  }
  const rows = await env.DB.prepare(`
    SELECT * FROM held_orders WHERE organization_id = ? AND branch_id = ?
    ORDER BY created_at DESC LIMIT 100
  `).bind(orgId, branchId).all<any>();
  return Response.json((rows.results || []).map(heldOrderView));
}

async function createHeldOrder(request: Request, env: Env, orgId: string, memberships: UserMembership[], userId: string): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON payload' }, { status: 400 }); }

  const tableId = text(body?.table_id, 100) || null;
  let branchId = text(body?.branch_id, 100) || null;
  let tableName = text(body?.table_name, 80) || null;

  if (tableId) {
    const table = await env.DB.prepare(`
      SELECT id, branch_id, table_number FROM dining_tables WHERE id = ? AND organization_id = ?
    `).bind(tableId, orgId).first<any>();
    if (!table) return Response.json({ error: 'table_id does not belong to this organization' }, { status: 400 });
    branchId = table.branch_id;
    tableName = tableName || table.table_number;
  }
  branchId = branchId || await defaultBranchId(env, orgId, memberships);
  if (!branchId) return Response.json({ error: 'No active branch is available' }, { status: 409 });
  if (!await canUseBranch(env, orgId, memberships, branchId)) {
    return Response.json({ error: 'Forbidden: insufficient privileges for this branch' }, { status: 403 });
  }

  const guestCount = Number(body?.guest_count ?? 2);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100) {
    return Response.json({ error: 'guest_count must be between 1 and 100' }, { status: 400 });
  }

  const id = text(body?.id, 120) || crypto.randomUUID();
  const existing = await env.DB.prepare('SELECT organization_id, branch_id FROM held_orders WHERE id = ?').bind(id).first<any>();
  if (existing && (existing.organization_id !== orgId || existing.branch_id !== branchId)) {
    return Response.json({ error: 'A held order with this ID already exists elsewhere' }, { status: 409 });
  }

  const createdAt = (() => {
    const raw = text(body?.created_at, 40);
    const parsed = raw ? Date.parse(raw) : NaN;
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  })();
  const now = new Date().toISOString();
  const itemsJson = Array.isArray(body?.items) ? JSON.stringify(body.items.slice(0, 200)) : null;

  await env.DB.prepare(`
    INSERT INTO held_orders (
      id, organization_id, branch_id, table_id, table_name, customer_id, customer_name,
      customer_phone, guest_count, order_notes, items_json, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      table_id = excluded.table_id, table_name = excluded.table_name,
      customer_id = excluded.customer_id, customer_name = excluded.customer_name,
      customer_phone = excluded.customer_phone, guest_count = excluded.guest_count,
      order_notes = excluded.order_notes, items_json = excluded.items_json, updated_at = excluded.updated_at
  `).bind(
    id, orgId, branchId, tableId, tableName, text(body?.customer_id, 100) || null,
    text(body?.customer_name, 160) || null, text(body?.customer_phone, 40) || null,
    guestCount, text(body?.order_notes, 500) || null, itemsJson, userId, createdAt, now,
  ).run();

  const row = await env.DB.prepare('SELECT * FROM held_orders WHERE id = ?').bind(id).first<any>();
  return Response.json({ success: true, held_order: heldOrderView(row) }, { status: existing ? 200 : 201 });
}

async function removeHeldOrder(env: Env, orgId: string, memberships: UserMembership[], heldOrderId: string): Promise<Response> {
  const row = await env.DB.prepare(`
    SELECT id, branch_id FROM held_orders WHERE id = ? AND organization_id = ?
  `).bind(heldOrderId, orgId).first<any>();
  if (!row) return Response.json({ error: 'Held order not found' }, { status: 404 });
  if (!await canUseBranch(env, orgId, memberships, row.branch_id)) {
    return Response.json({ error: 'Forbidden: insufficient privileges for this branch' }, { status: 403 });
  }
  await env.DB.prepare('DELETE FROM held_orders WHERE id = ? AND organization_id = ?').bind(heldOrderId, orgId).run();
  return Response.json({ success: true, id: heldOrderId });
}

async function lookupCustomer(request: Request, env: Env, orgId: string): Promise<Response> {
  const url = new URL(request.url);
  const phone = text(url.searchParams.get('phone'), 40);
  if (!phone) return Response.json({ error: 'phone is required' }, { status: 400 });
  const digits = phone.replace(/\D+/g, '');
  const row = await env.DB.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM synced_orders o WHERE o.organization_id = c.organization_id AND o.customer_phone = c.phone AND o.status = 'completed') AS visits_count,
      (SELECT COALESCE(SUM(o.grand_total), 0) FROM synced_orders o WHERE o.organization_id = c.organization_id AND o.customer_phone = c.phone AND o.status != 'cancelled') AS total_spent
    FROM customers c
    WHERE c.organization_id = ? AND c.is_active = 1
      AND (c.phone = ? OR c.phone_digits = ?)
    LIMIT 1
  `).bind(orgId, phone, digits).first<any>();
  if (!row) return Response.json({ customer: null });
  return Response.json({
    customer: {
      id: String(row.id),
      name: row.name,
      phone: row.phone || '',
      phone_digits: row.phone_digits || null,
      country_code: row.country_code || '',
      email: row.email || null,
      visits_count: Number(row.visits_count || 0),
      total_spent: Number(row.total_spent || 0),
      last_visit_at: null,
      wallet_balance: 0,
    },
  });
}

/**
 * POST /api/auth/refresh — rotates a valid staff token for another 7 days.
 */
export async function handleRefreshSession(env: Env, claims: Claims): Promise<Response> {
  const user = await env.DB.prepare(`
    SELECT id, email, name, role, status, assigned_branch_id FROM cloud_users
    WHERE id = ? AND organization_id = ?
  `).bind(claims.sub, claims.org).first<any>();
  if (!user || user.status !== 'active') {
    return Response.json({ error: 'This account is not active' }, { status: 401 });
  }
  const organization = await env.DB.prepare('SELECT account_status FROM organizations WHERE id = ?')
    .bind(claims.org).first<{ account_status: string | null }>();
  if (organization?.account_status && organization.account_status !== 'active') {
    return Response.json({ error: 'This organization is currently unavailable' }, { status: 403 });
  }

  const expiresIn = 7 * 86400;
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const accessToken = await createJWT({
    sub: user.id,
    org: claims.org,
    email: user.email,
    role: user.role,
    branch: claims.branch || user.assigned_branch_id || null,
    exp,
  }, env.JWT_SECRET);

  return Response.json({
    access_token: accessToken,
    token: accessToken,
    expires_in: expiresIn,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: claims.org,
      assigned_branch_id: user.assigned_branch_id || null,
    },
  });
}

function mobileClosure(closure: any, index: number) {
  return {
    id: String(closure.id),
    z_number: Number(closure.z_number || 0) || index + 1,
    business_date: closure.closure_date,
    opening_float: Number(closure.opening_cash || 0),
    expected_cash: Number(closure.expected_cash || 0),
    counted_cash: Number(closure.actual_cash || 0),
    card_total: Number(closure.card_sales || 0),
    upi_total: Number(closure.upi_sales || 0),
    gross_sales: Math.round((
      Number(closure.cash_sales || 0) + Number(closure.card_sales || 0)
      + Number(closure.upi_sales || 0) + Number(closure.other_sales || 0)
    ) * 100) / 100,
    closed_at: closure.closed_at,
    closed_by: closure.closed_by || 'Manager',
    notes: closure.notes ?? null,
    variance: Number(closure.variance || 0),
  };
}

async function listMobileClosures(request: Request, env: Env, orgId: string, memberships: UserMembership[]): Promise<Response> {
  const response = await listShiftClosures({ request, env, orgId, memberships });
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) return Response.json(data, { status: response.status });
  const closures = (data.closures || []).map(mobileClosure);
  return Response.json({ closures, count: closures.length });
}

async function createMobileClosure(
  request: Request,
  env: Env,
  orgId: string,
  memberships: UserMembership[],
  userId: string,
): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON payload' }, { status: 400 }); }

  const cents = Number(body?.counted_cash_cents);
  const actualCash = Number.isFinite(cents) && body?.counted_cash_cents !== undefined
    ? Math.round(cents) / 100
    : Number(body?.actual_cash);
  if (!Number.isFinite(actualCash) || actualCash < 0) {
    return Response.json({ error: 'counted_cash_cents or actual_cash is required' }, { status: 400 });
  }

  const actorRow = await env.DB.prepare('SELECT name, email FROM cloud_users WHERE id = ?')
    .bind(userId).first<{ name: string | null; email: string | null }>();

  const normalized = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: body?.branch_id,
      actual_cash: actualCash,
      opening_cash: body?.opening_cash,
      notes: body?.notes,
    }),
  });

  const response = await closeShift({
    request: normalized,
    env,
    orgId,
    memberships,
    actor: { id: userId, name: actorRow?.name || actorRow?.email || 'Manager' },
  });
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) return Response.json(data, { status: response.status });
  return Response.json({ closure: mobileClosure(data.closure, 0), summary: data.summary }, { status: 201 });
}

async function mobileReports(request: Request, env: Env, orgId: string, memberships: UserMembership[]): Promise<Response> {
  const url = new URL(request.url);
  const startDate = text(url.searchParams.get('start_date'), 20);
  const endDate = text(url.searchParams.get('end_date'), 20);
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const financialUrl = `https://internal/reports/financial-summary${params.size ? `?${params}` : ''}`;
  const productsUrl = `https://internal/reports/topProducts${params.size ? `?${params}&limit=5` : '?limit=5'}`;

  const [financialResponse, productsResponse] = await Promise.all([
    handleDashboardReport(new Request(financialUrl), env, orgId, memberships),
    handleDashboardReport(new Request(productsUrl), env, orgId, memberships),
  ]);
  const financialData = await financialResponse.json().catch(() => ({})) as any;
  if (!financialResponse.ok) return Response.json(financialData, { status: financialResponse.status });
  const productsData = await productsResponse.json().catch(() => ({})) as any;
  const summary = financialData.financialSummary || {};

  return Response.json({
    grossCollected: Number(summary.grossCollected || 0),
    netCollected: Number(summary.netCollected || 0),
    refunded: Number(summary.refunded || 0),
    billCount: Number(summary.billCount || 0),
    avgOrderValue: Number(summary.averageOrderValue || 0),
    paymentMethods: summary.paymentMethods || [],
    topProducts: (productsData.topProducts || []).map((row: any) => ({
      name: row.product_name,
      qty: Number(row.total_quantity || 0),
      revenue: Number(row.total_revenue || 0),
    })),
  });
}

/**
 * Handles mobile compatibility paths. Returns null when the path is not owned.
 */
export async function handleMobileCompatRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  claims: any,
  memberships: UserMembership[],
): Promise<Response | null> {
  if (path === '/api/cash-closures' && method === 'GET') {
    return listMobileClosures(request, env, claims.org, memberships);
  }
  if (path === '/api/cash-closures' && method === 'POST') {
    return createMobileClosure(request, env, claims.org, memberships, claims.sub);
  }
  if (path === '/api/held-orders' && method === 'GET') {
    return listHeldOrders(request, env, claims.org, memberships);
  }
  if (path === '/api/held-orders' && method === 'POST') {
    return createHeldOrder(request, env, claims.org, memberships, claims.sub);
  }
  const heldMatch = path.match(/^\/api\/held-orders\/([^/]+)$/);
  if (heldMatch && method === 'DELETE') {
    return removeHeldOrder(env, claims.org, memberships, decodeURIComponent(heldMatch[1]));
  }
  if (path === '/api/crm/lookup' && method === 'GET') {
    return lookupCustomer(request, env, claims.org);
  }
  if (path === '/api/reports' && method === 'GET') {
    return mobileReports(request, env, claims.org, memberships);
  }
  return null;
}
