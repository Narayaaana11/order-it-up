/**
 * Cloud Customer Registry
 *
 * Serves the customer directory the POS/customers screen and waiter seating use.
 * Spend, visit count and last-visit are derived from persisted Cloud orders;
 * loyalty points stay at zero because Cloud has no loyalty accrual engine yet.
 */

import { Env } from './pairing';
import { UserMembership } from '../rbac';

const WRITE_ROLES = ['owner', 'admin', 'manager', 'cashier', 'server', 'waiter', 'host'];
const SORT_FIELDS: Record<string, string> = {
  name: 'c.name',
  total_spent: 'total_spent',
  last_visit_at: 'last_visit_at',
  visits_count: 'visits_count',
  created_at: 'c.created_at',
};

function text(value: unknown, maximum = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function digits(value: string): string {
  return value.replace(/\D+/g, '');
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function canWrite(memberships: UserMembership[]): boolean {
  return memberships.some((membership) => membership.status === 'active' && WRITE_ROLES.includes(membership.role));
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

const CUSTOMER_SELECT = `
  SELECT c.*,
    (SELECT COUNT(*) FROM synced_orders o
      WHERE o.organization_id = c.organization_id AND o.customer_phone = c.phone AND o.status = 'completed') AS visits_count,
    (SELECT COALESCE(SUM(o.grand_total), 0) FROM synced_orders o
      WHERE o.organization_id = c.organization_id AND o.customer_phone = c.phone AND o.status != 'cancelled') AS total_spent,
    (SELECT MAX(o.ordered_at) FROM synced_orders o
      WHERE o.organization_id = c.organization_id AND o.customer_phone = c.phone) AS last_visit_at
  FROM customers c
`;

function customerView(row: any) {
  const parseList = (raw: unknown): string[] | null => {
    if (!raw) return null;
    try { const parsed = JSON.parse(String(raw)); return Array.isArray(parsed) ? parsed.map(String) : null; } catch { return null; }
  };
  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone ?? '',
    phone_digits: row.phone_digits ?? null,
    country_code: row.country_code ?? '',
    email: row.email ?? null,
    visits_count: Number(row.visits_count || 0),
    total_spent: Number(row.total_spent || 0),
    last_visit_at: row.last_visit_at ?? null,
    wallet_balance: 0,
    global_customer_id: null,
    dietary_preferences: parseList(row.dietary_preferences_json),
    favourite_dishes: parseList(row.favourite_dishes_json),
    tag_counts: null,
    address: null,
    notes: row.notes ?? null,
    is_active: Number(row.is_active) !== 0,
  };
}

async function listCustomers(request: Request, env: Env, orgId: string): Promise<Response> {
  const url = new URL(request.url);
  const search = text(url.searchParams.get('search'), 80);
  const filter = text(url.searchParams.get('filter'), 30);
  const sortField = SORT_FIELDS[text(url.searchParams.get('sort'), 30)] || SORT_FIELDS.name;
  const order = text(url.searchParams.get('order'), 4).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 500)));

  const conditions = ['c.organization_id = ?', 'c.is_active = 1'];
  const params: any[] = [orgId];
  if (search) {
    conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (filter === 'vip') conditions.push('total_spent >= 5000');
  if (filter === 'returning') conditions.push('visits_count > 1');
  if (filter === 'new') conditions.push('visits_count <= 1');

  const where = conditions.join(' AND ');
  const rows = await env.DB.prepare(`
    ${CUSTOMER_SELECT}
    WHERE ${where}
    ORDER BY ${sortField} ${order}
    LIMIT ? OFFSET ?
  `).bind(...params, limit, (page - 1) * limit).all<any>();
  const totalRow = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM (${CUSTOMER_SELECT} WHERE ${where}) x
  `).bind(...params).first<{ count: number }>();

  const customers = (rows.results || []).map(customerView);
  return Response.json({
    data: customers,
    customers,
    total: Number(totalRow?.count || 0),
    page,
    limit,
  });
}

async function searchCustomers(request: Request, env: Env, orgId: string): Promise<Response> {
  const url = new URL(request.url);
  const q = text(url.searchParams.get('q'), 80);
  if (q.length < 2) return Response.json({ customers: [] });
  const rows = await env.DB.prepare(`
    ${CUSTOMER_SELECT}
    WHERE c.organization_id = ? AND c.is_active = 1 AND (c.name LIKE ? OR c.phone LIKE ? OR c.phone_digits LIKE ?)
    ORDER BY c.name ASC LIMIT 20
  `).bind(orgId, `%${q}%`, `%${q}%`, `%${digits(q)}%`).all<any>();
  return Response.json({ customers: (rows.results || []).map(customerView) });
}

async function createCustomer(request: Request, env: Env, orgId: string): Promise<Response> {
  const body = await readJson(request);
  if (!body) return badRequest('Invalid JSON payload');
  const name = text(body.name, 160);
  if (!name) return badRequest('name is required');

  const phone = text(body.phone, 40);
  const phoneDigits = digits(phone);
  if (phone && phoneDigits.length < 6) return badRequest('phone is not a valid number');
  if (phone) {
    const duplicate = await env.DB.prepare(`
      SELECT id FROM customers WHERE organization_id = ? AND phone = ?
    `).bind(orgId, phone).first<any>();
    if (duplicate) return Response.json({ error: 'A customer with this phone already exists' }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO customers (
      id, organization_id, name, phone, phone_digits, country_code, email, notes,
      dietary_preferences_json, favourite_dishes_json, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(
    id, orgId, name, phone || null, phoneDigits || null, text(body.country_code, 10) || null,
    text(body.email, 160) || null, text(body.notes, 500) || null,
    Array.isArray(body.dietary_preferences) ? JSON.stringify(body.dietary_preferences.map(String).slice(0, 20)) : null,
    Array.isArray(body.favourite_dishes) ? JSON.stringify(body.favourite_dishes.map(String).slice(0, 20)) : null,
    now, now,
  ).run();

  const row = await env.DB.prepare(`${CUSTOMER_SELECT} WHERE c.id = ? AND c.organization_id = ?`)
    .bind(id, orgId).first<any>();
  return Response.json({ customer: customerView(row) }, { status: 201 });
}

async function updateCustomer(request: Request, env: Env, orgId: string, customerId: string): Promise<Response> {
  const body = await readJson(request);
  if (!body) return badRequest('Invalid JSON payload');
  const existing = await env.DB.prepare(`
    SELECT * FROM customers WHERE id = ? AND organization_id = ?
  `).bind(customerId, orgId).first<any>();
  if (!existing) return Response.json({ error: 'Customer not found' }, { status: 404 });

  const name = body.name === undefined ? existing.name : text(body.name, 160);
  if (!name) return badRequest('name is required');
  const phone = body.phone === undefined ? (existing.phone || '') : text(body.phone, 40);
  if (phone && phone !== existing.phone) {
    const duplicate = await env.DB.prepare(`
      SELECT id FROM customers WHERE organization_id = ? AND phone = ? AND id != ?
    `).bind(orgId, phone, customerId).first<any>();
    if (duplicate) return Response.json({ error: 'A customer with this phone already exists' }, { status: 409 });
  }

  await env.DB.prepare(`
    UPDATE customers SET
      name = ?, phone = ?, phone_digits = ?, country_code = ?, email = ?, notes = ?,
      dietary_preferences_json = ?, favourite_dishes_json = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(
    name,
    phone || null,
    phone ? digits(phone) : null,
    body.country_code === undefined ? existing.country_code : (text(body.country_code, 10) || null),
    body.email === undefined ? existing.email : (text(body.email, 160) || null),
    body.notes === undefined ? existing.notes : (text(body.notes, 500) || null),
    Array.isArray(body.dietary_preferences) ? JSON.stringify(body.dietary_preferences.map(String).slice(0, 20)) : existing.dietary_preferences_json,
    Array.isArray(body.favourite_dishes) ? JSON.stringify(body.favourite_dishes.map(String).slice(0, 20)) : existing.favourite_dishes_json,
    new Date().toISOString(), customerId, orgId,
  ).run();

  const row = await env.DB.prepare(`${CUSTOMER_SELECT} WHERE c.id = ? AND c.organization_id = ?`)
    .bind(customerId, orgId).first<any>();
  return Response.json({ success: true, customer: customerView(row) });
}

async function getCustomerWallet(env: Env, orgId: string, customerId: string): Promise<Response> {
  const customer = await env.DB.prepare(`
    SELECT id, phone FROM customers WHERE id = ? AND organization_id = ?
  `).bind(customerId, orgId).first<any>();
  if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

  const bills = customer.phone
    ? await env.DB.prepare(`
        SELECT id, order_number AS bill_number, grand_total AS total, ordered_at AS paid_at,
               ordered_at AS created_at, 0 AS points_earned, 0 AS points_redeemed
        FROM synced_orders
        WHERE organization_id = ? AND customer_phone = ? AND status != 'cancelled'
        ORDER BY ordered_at DESC LIMIT 100
      `).bind(orgId, customer.phone).all<any>()
    : { results: [] };
  const billRows = bills.results || [];
  const totalSpent = Math.round(billRows.reduce((total: number, bill: any) => total + Number(bill.total || 0), 0) * 100) / 100;

  return Response.json({
    balance: 0,
    transactions: [],
    bills: billRows,
    summary: {
      totalSpent,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0,
    },
  });
}

/**
 * Routes customer registry paths. Returns null when the path is not owned here.
 */
export async function handleCustomersRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  claims: any,
  memberships: UserMembership[],
): Promise<Response | null> {
  const orgId = claims.org;

  if (path === '/api/customers-search' && method === 'GET') {
    return searchCustomers(request, env, orgId);
  }
  if (path === '/api/customers' && method === 'GET') {
    return listCustomers(request, env, orgId);
  }
  if (path === '/api/customers' && method === 'POST') {
    if (!canWrite(memberships)) return Response.json({ error: 'Forbidden: insufficient privileges to create customers' }, { status: 403 });
    return createCustomer(request, env, orgId);
  }
  const walletMatch = path.match(/^\/api\/customers\/([^/]+)\/wallet$/);
  if (walletMatch && method === 'GET') {
    return getCustomerWallet(env, orgId, decodeURIComponent(walletMatch[1]));
  }
  const customerMatch = path.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch && method === 'PUT') {
    if (!canWrite(memberships)) return Response.json({ error: 'Forbidden: insufficient privileges to update customers' }, { status: 403 });
    return updateCustomer(request, env, orgId, decodeURIComponent(customerMatch[1]));
  }

  return null;
}
