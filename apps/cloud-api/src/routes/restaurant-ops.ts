/**
 * Cloud Restaurant Operations Suite
 *
 * Adds the missing Cloud-native operational domains required by the signed-in
 * role dashboards: expenses and vendors, reservations, raw-ingredient inventory
 * with recipes, shift/cash closure, and delivery dispatch.
 *
 * Every read and write is authorized against active organization memberships and
 * scoped to a branch the caller is actually assigned to. Tenant isolation is
 * enforced in SQL (organization_id) plus the branch authorization check.
 */

import { Env } from './pairing';
import { UserMembership, isOrgOwnerOrAdmin } from '../rbac';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const READ_ROLES = ['owner', 'admin', 'manager', 'cashier', 'accountant', 'server', 'waiter', 'host', 'delivery', 'driver'];
const FLOOR_ROLES = ['owner', 'admin', 'manager', 'cashier', 'server', 'waiter', 'host'];
const MANAGEMENT_ROLES = ['owner', 'admin', 'manager', 'cashier'];
const OWNER_MANAGER_ROLES = ['owner', 'admin', 'manager'];
const ACCOUNTING_ROLES = ['owner', 'admin', 'manager', 'accountant', 'cashier'];

type Branch = { id: string; restaurant_id: string | null; status: string; timezone?: string };

type Authorized = {
  branch: Branch;
  role: string;
  roles: string[];
};

type Denied = { error: Response };

type Actor = { id: string; name: string };

function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Shifts a wall-clock reservation time without introducing a device timezone. */
function wallClock(date: string, time: string, deltaMinutes: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute) + deltaMinutes * 60000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:00`;
}

function clampLimit(value: string | null, fallback = 100, maximum = 500): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), maximum);
}

function text(value: unknown, maximum = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function forbidden(message = 'Forbidden: insufficient privileges for this branch operation'): Response {
  return Response.json({ error: message }, { status: 403 });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

async function loadActor(env: Env, userId: string): Promise<Actor> {
  const row = await env.DB.prepare('SELECT id, name, email FROM cloud_users WHERE id = ?')
    .bind(userId).first<{ id: string; name: string | null; email: string | null }>();
  return { id: userId, name: row?.name || row?.email || 'Staff' };
}

async function loadBranch(env: Env, orgId: string, branchId: string): Promise<Branch | null> {
  const row = await env.DB.prepare(`
    SELECT id, restaurant_id, status FROM branches WHERE id = ? AND organization_id = ?
  `).bind(branchId, orgId).first<Branch>();
  return row || null;
}

async function defaultBranch(env: Env, orgId: string, memberships: UserMembership[]): Promise<Branch | null> {
  const branchMembership = memberships.find((membership) => membership.branch_id);
  if (branchMembership?.branch_id) {
    const branch = await loadBranch(env, orgId, branchMembership.branch_id);
    if (branch && branch.status === 'active') return branch;
  }

  const restaurantMembership = memberships.find((membership) => !membership.branch_id && membership.restaurant_id);
  if (restaurantMembership?.restaurant_id) {
    const row = await env.DB.prepare(`
      SELECT id, restaurant_id, status FROM branches
      WHERE organization_id = ? AND restaurant_id = ? AND status = 'active'
      ORDER BY is_main_branch DESC, created_at ASC LIMIT 1
    `).bind(orgId, restaurantMembership.restaurant_id).first<Branch>();
    if (row) return row;
  }

  const row = await env.DB.prepare(`
    SELECT id, restaurant_id, status FROM branches
    WHERE organization_id = ? AND status = 'active'
    ORDER BY is_main_branch DESC, created_at ASC LIMIT 1
  `).bind(orgId).first<Branch>();
  return row || null;
}

function rolesForBranch(memberships: UserMembership[], branch: Branch): string[] {
  const roles = new Set<string>();
  for (const membership of memberships) {
    if (membership.status !== 'active') continue;
    const orgLevel = membership.restaurant_id === null && membership.branch_id === null;
    const branchLevel = membership.branch_id === branch.id;
    const restaurantLevel = membership.branch_id === null
      && membership.restaurant_id !== null
      && membership.restaurant_id === branch.restaurant_id;
    if (orgLevel || branchLevel || restaurantLevel) roles.add(membership.role);
  }
  return [...roles];
}

/**
 * Resolves the requested (or default) branch and verifies the caller holds one
 * of the allowed roles there. Returns either the authorization context or a
 * ready-to-return error Response.
 */
async function authorizeBranch(
  env: Env,
  orgId: string,
  memberships: UserMembership[],
  requestedBranchId: string | null,
  allowedRoles: string[],
): Promise<Authorized | Denied> {
  const branch = requestedBranchId
    ? await loadBranch(env, orgId, requestedBranchId)
    : await defaultBranch(env, orgId, memberships);

  if (!branch) {
    return { error: Response.json({ error: 'Branch not found for this organization' }, { status: 404 }) };
  }
  if (branch.status !== 'active') {
    return { error: Response.json({ error: 'This branch is not active' }, { status: 409 }) };
  }

  const roles = rolesForBranch(memberships, branch);
  const role = roles.find((candidate) => allowedRoles.includes(candidate));
  if (!role) return { error: forbidden() };

  return { branch, role, roles };
}

function hasOrganizationManagement(memberships: UserMembership[]): boolean {
  return isOrgOwnerOrAdmin(memberships) || memberships.some((membership) => membership.role === 'admin');
}

function hasAnyRole(memberships: UserMembership[], roles: string[]): boolean {
  return memberships.some((membership) => membership.status === 'active' && roles.includes(membership.role));
}

// ── Expenses and vendors ────────────────────────────────────────────────────

async function listExpenses(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), READ_ROLES);
  if ('error' in auth) return auth.error;

  const endDate = url.searchParams.get('end_date') || todayIn('UTC');
  const startDate = url.searchParams.get('start_date') || endDate;
  if (!validDate(startDate) || !validDate(endDate)) return badRequest('start_date and end_date must be YYYY-MM-DD dates');
  if (startDate > endDate) return badRequest('start_date must be on or before end_date');

  const rows = await ctx.env.DB.prepare(`
    SELECT e.id, e.branch_id, e.category_id, c.name AS category_name,
           e.vendor_id, v.name AS vendor_name, e.amount, e.payment_method,
           e.description, e.expense_date, e.status, e.recorded_by_name, e.created_at
    FROM expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    LEFT JOIN restaurant_vendors v ON v.id = e.vendor_id
    WHERE e.organization_id = ? AND e.branch_id = ?
      AND e.expense_date >= ? AND e.expense_date <= ?
      AND e.status = 'recorded'
    ORDER BY e.expense_date DESC, e.created_at DESC
    LIMIT 500
  `).bind(ctx.orgId, auth.branch.id, startDate, endDate).all<any>();

  return Response.json({ expenses: rows.results || [], date_from: startDate, date_to: endDate, branch_id: auth.branch.id });
}

async function createExpense(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor }): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, text(body.branch_id) || null, MANAGEMENT_ROLES);
  if ('error' in auth) return auth.error;

  const amount = Number(body.amount);
  const description = text(body.description, 500);
  if (!Number.isFinite(amount) || amount <= 0) return badRequest('amount must be a positive number');
  if (!description) return badRequest('description is required');

  const paymentMethod = text(body.payment_method, 40) || 'cash';
  if (!['cash', 'upi', 'card', 'bank_transfer'].includes(paymentMethod)) {
    return badRequest('payment_method must be cash, upi, card, or bank_transfer');
  }

  const expenseDate = text(body.expense_date) || todayIn('UTC');
  if (!validDate(expenseDate)) return badRequest('expense_date must be a YYYY-MM-DD date');

  const categoryId = text(body.category_id) || null;
  if (categoryId) {
    const category = await ctx.env.DB.prepare(`
      SELECT id FROM expense_categories WHERE id = ? AND organization_id = ? AND is_active = 1
    `).bind(categoryId, ctx.orgId).first<any>();
    if (!category) return badRequest('category_id does not belong to this organization');
  }

  const vendorId = text(body.vendor_id) || null;
  if (vendorId) {
    const vendor = await ctx.env.DB.prepare(`
      SELECT id FROM restaurant_vendors WHERE id = ? AND organization_id = ? AND status = 'active'
    `).bind(vendorId, ctx.orgId).first<any>();
    if (!vendor) return badRequest('vendor_id does not belong to this organization');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await ctx.env.DB.prepare(`
    INSERT INTO expenses (
      id, organization_id, branch_id, category_id, vendor_id, amount, payment_method,
      description, expense_date, status, recorded_by_user_id, recorded_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?, ?)
  `).bind(
    id, ctx.orgId, auth.branch.id, categoryId, vendorId, round2(amount), paymentMethod,
    description, expenseDate, ctx.actor.id, ctx.actor.name, now, now,
  ).run();

  return Response.json({
    expense: {
      id, branch_id: auth.branch.id, category_id: categoryId, vendor_id: vendorId,
      amount: round2(amount), payment_method: paymentMethod, description,
      expense_date: expenseDate, status: 'recorded', created_at: now,
    },
  }, { status: 201 });
}

async function voidExpense(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor; expenseId: string }): Promise<Response> {
  const body = await readJson(ctx.request) || {};
  const expense = await ctx.env.DB.prepare(`
    SELECT id, branch_id, status FROM expenses WHERE id = ? AND organization_id = ?
  `).bind(ctx.expenseId, ctx.orgId).first<{ id: string; branch_id: string; status: string }>();
  if (!expense) return Response.json({ error: 'Expense not found' }, { status: 404 });
  if (expense.status === 'voided') return Response.json({ success: true, already_voided: true });

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, expense.branch_id, OWNER_MANAGER_ROLES);
  if ('error' in auth) return auth.error;

  await ctx.env.DB.prepare(`
    UPDATE expenses SET status = 'voided', voided_reason = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(text(body.reason, 300) || `Voided by ${ctx.actor.name}`, new Date().toISOString(), expense.id, ctx.orgId).run();

  return Response.json({ success: true, id: expense.id, status: 'voided' });
}

async function listExpenseCategories(ctx: { env: Env; orgId: string }): Promise<Response> {
  const rows = await ctx.env.DB.prepare(`
    SELECT id, name, description, is_active FROM expense_categories
    WHERE organization_id = ? AND is_active = 1 ORDER BY name ASC
  `).bind(ctx.orgId).all<any>();
  return Response.json({ categories: rows.results || [] });
}

async function createExpenseCategory(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  if (!hasAnyRole(ctx.memberships, [...OWNER_MANAGER_ROLES, 'cashier'])) return forbidden();
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');
  const name = text(body.name, 120);
  if (!name) return badRequest('name is required');

  const existing = await ctx.env.DB.prepare(`
    SELECT id FROM expense_categories WHERE organization_id = ? AND lower(name) = lower(?)
  `).bind(ctx.orgId, name).first<any>();
  if (existing) return Response.json({ error: 'An expense category with this name already exists' }, { status: 409 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await ctx.env.DB.prepare(`
    INSERT INTO expense_categories (id, organization_id, name, description, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).bind(id, ctx.orgId, name, text(body.description, 300) || null, now, now).run();

  return Response.json({ category: { id, name, description: text(body.description, 300) || null, is_active: 1 } }, { status: 201 });
}

async function listVendors(ctx: { env: Env; orgId: string }): Promise<Response> {
  const rows = await ctx.env.DB.prepare(`
    SELECT id, name, contact_person, phone, email, gstin, address, balance, status
    FROM restaurant_vendors WHERE organization_id = ? AND status = 'active'
    ORDER BY name ASC
  `).bind(ctx.orgId).all<any>();
  return Response.json({ vendors: rows.results || [] });
}

async function createVendor(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  if (!hasAnyRole(ctx.memberships, OWNER_MANAGER_ROLES)) return forbidden();
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');
  const name = text(body.name, 160);
  if (!name) return badRequest('name is required');

  const existing = await ctx.env.DB.prepare(`
    SELECT id FROM restaurant_vendors WHERE organization_id = ? AND lower(name) = lower(?)
  `).bind(ctx.orgId, name).first<any>();
  if (existing) return Response.json({ error: 'A vendor with this name already exists' }, { status: 409 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const vendor = {
    id,
    name,
    contact_person: text(body.contact_person, 120) || null,
    phone: text(body.phone, 40) || null,
    email: text(body.email, 160) || null,
    gstin: text(body.gstin, 30) || null,
    address: text(body.address, 300) || null,
    balance: 0,
    status: 'active',
  };
  await ctx.env.DB.prepare(`
    INSERT INTO restaurant_vendors (
      id, organization_id, name, contact_person, phone, email, gstin, address, balance, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)
  `).bind(id, ctx.orgId, vendor.name, vendor.contact_person, vendor.phone, vendor.email, vendor.gstin, vendor.address, now, now).run();

  return Response.json({ vendor }, { status: 201 });
}

// ── Reservations ───────────────────────────────────────────────────────────

async function listReservations(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), READ_ROLES);
  if ('error' in auth) return auth.error;

  const date = url.searchParams.get('date') || todayIn('UTC');
  if (!validDate(date)) return badRequest('date must be a YYYY-MM-DD date');

  const rows = await ctx.env.DB.prepare(`
    SELECT r.*, t.table_number
    FROM reservations r
    LEFT JOIN dining_tables t ON t.id = r.table_id
    WHERE r.organization_id = ? AND r.branch_id = ? AND r.reservation_date = ?
    ORDER BY r.reserved_at ASC
  `).bind(ctx.orgId, auth.branch.id, date).all<any>();

  return Response.json({ reservations: rows.results || [], date, branch_id: auth.branch.id });
}

async function createReservation(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor }): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, text(body.branch_id) || null, FLOOR_ROLES);
  if ('error' in auth) return auth.error;

  const customerName = text(body.customer_name, 160);
  if (!customerName) return badRequest('customer_name is required');

  const guestCount = Number(body.guest_count ?? 2);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100) {
    return badRequest('guest_count must be a whole number between 1 and 100');
  }

  const reservationDate = text(body.reservation_date) || todayIn('UTC');
  if (!validDate(reservationDate)) return badRequest('reservation_date must be a YYYY-MM-DD date');

  const reservationTime = text(body.reservation_time) || '19:00';
  if (!TIME_PATTERN.test(reservationTime)) return badRequest('reservation_time must be HH:MM in 24-hour time');

  const tableId = text(body.table_id) || null;
  if (tableId) {
    const table = await ctx.env.DB.prepare(`
      SELECT id, capacity FROM dining_tables
      WHERE id = ? AND branch_id = ? AND organization_id = ? AND is_active = 1
    `).bind(tableId, auth.branch.id, ctx.orgId).first<{ id: string; capacity: number }>();
    if (!table) return badRequest('table_id does not belong to this branch');
    if (Number(table.capacity) > 0 && guestCount > Number(table.capacity)) {
      return badRequest(`This table seats ${table.capacity}; choose a larger table for ${guestCount} guests`);
    }
  }

  const reservedAt = `${reservationDate}T${reservationTime}:00`;

  if (tableId) {
    const overlap = await ctx.env.DB.prepare(`
      SELECT id FROM reservations
      WHERE organization_id = ? AND branch_id = ? AND table_id = ?
        AND status IN ('confirmed', 'seated')
        AND reserved_at >= ?
        AND reserved_at <= ?
      LIMIT 1
    `).bind(
      ctx.orgId, auth.branch.id, tableId,
      wallClock(reservationDate, reservationTime, -90),
      wallClock(reservationDate, reservationTime, 90),
    ).first<any>();
    if (overlap) {
      return Response.json({ error: 'That table already has a reservation within 90 minutes of this time' }, { status: 409 });
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await ctx.env.DB.prepare(`
    INSERT INTO reservations (
      id, organization_id, restaurant_id, branch_id, table_id, customer_name, customer_phone,
      guest_count, reservation_date, reservation_time, reserved_at, status, notes,
      created_by_user_id, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)
  `).bind(
    id, ctx.orgId, auth.branch.restaurant_id, auth.branch.id, tableId, customerName,
    text(body.customer_phone, 40) || null, guestCount, reservationDate, reservationTime,
    reservedAt, text(body.notes, 500) || null, ctx.actor.id, ctx.actor.name, now, now,
  ).run();

  return Response.json({
    reservation: {
      id, branch_id: auth.branch.id, table_id: tableId, customer_name: customerName,
      customer_phone: text(body.customer_phone, 40) || null, guest_count: guestCount,
      reservation_date: reservationDate, reservation_time: reservationTime,
      reserved_at: reservedAt, status: 'confirmed', notes: text(body.notes, 500) || null,
      created_at: now,
    },
  }, { status: 201 });
}

const RESERVATION_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

async function updateReservationStatus(ctx: {
  request: Request; env: Env; orgId: string; memberships: UserMembership[];
  actor: Actor; reservationId: string;
}): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');
  const nextStatus = text(body.status);
  if (!['seated', 'completed', 'cancelled', 'no_show'].includes(nextStatus)) {
    return badRequest('status must be seated, completed, cancelled, or no_show');
  }

  const reservation = await ctx.env.DB.prepare(`
    SELECT * FROM reservations WHERE id = ? AND organization_id = ?
  `).bind(ctx.reservationId, ctx.orgId).first<any>();
  if (!reservation) return Response.json({ error: 'Reservation not found' }, { status: 404 });

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, reservation.branch_id, FLOOR_ROLES);
  if ('error' in auth) return auth.error;

  const allowed = RESERVATION_TRANSITIONS[String(reservation.status)] || [];
  if (!allowed.includes(nextStatus)) {
    return Response.json({
      error: `Cannot move a ${reservation.status} reservation to ${nextStatus}`,
    }, { status: 409 });
  }

  const now = new Date().toISOString();
  const statements: any[] = [];
  const cancellationReason = text(body.cancellation_reason, 300) || null;
  statements.push(
    ctx.env.DB.prepare(`
      UPDATE reservations
      SET status = ?,
          seated_at = CASE WHEN ? = 'seated' THEN ? ELSE seated_at END,
          cancelled_at = CASE WHEN ? IN ('cancelled', 'no_show') THEN ? ELSE cancelled_at END,
          cancellation_reason = CASE WHEN ? IN ('cancelled', 'no_show') THEN ? ELSE cancellation_reason END,
          updated_at = ?
      WHERE id = ? AND organization_id = ? AND status = ?
    `).bind(
      nextStatus, nextStatus, now, nextStatus, now, nextStatus, cancellationReason,
      now, reservation.id, ctx.orgId, reservation.status,
    ),
  );

  if (nextStatus === 'seated' && reservation.table_id) {
    statements.push(
      ctx.env.DB.prepare(`
        UPDATE dining_tables SET status = 'occupied', updated_at = ?
        WHERE id = ? AND branch_id = ? AND status IN ('available', 'reserved')
      `).bind(now, reservation.table_id, auth.branch.id),
    );
  }

  if (['completed', 'cancelled', 'no_show'].includes(nextStatus) && reservation.table_id) {
    statements.push(
      ctx.env.DB.prepare(`
        UPDATE dining_tables SET status = 'available', current_order_id = NULL, updated_at = ?
        WHERE id = ? AND branch_id = ? AND status = 'occupied' AND current_order_id IS NULL
      `).bind(now, reservation.table_id, auth.branch.id),
    );
  }

  const results = await ctx.env.DB.batch(statements);
  const changed = Number((results?.[0] as any)?.meta?.changes ?? 0);
  if (changed === 0) {
    return Response.json({ error: 'This reservation changed on another device. Reload and try again.' }, { status: 409 });
  }

  return Response.json({ success: true, id: reservation.id, status: nextStatus });
}

// ── Inventory ──────────────────────────────────────────────────────────────

async function listIngredients(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), READ_ROLES);
  if ('error' in auth) return auth.error;

  const rows = await ctx.env.DB.prepare(`
    SELECT id, branch_id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active, created_at, updated_at
    FROM ingredients WHERE organization_id = ? AND branch_id = ?
    ORDER BY is_active DESC, name ASC
  `).bind(ctx.orgId, auth.branch.id).all<any>();

  return Response.json({ ingredients: rows.results || [], branch_id: auth.branch.id });
}

async function listLowStock(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), READ_ROLES);
  if ('error' in auth) return auth.error;

  const rows = await ctx.env.DB.prepare(`
    SELECT id, branch_id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active
    FROM ingredients
    WHERE organization_id = ? AND branch_id = ? AND is_active = 1 AND current_stock <= minimum_stock
    ORDER BY (minimum_stock - current_stock) DESC, name ASC
  `).bind(ctx.orgId, auth.branch.id).all<any>();

  return Response.json({ low_stock: rows.results || [], branch_id: auth.branch.id });
}

async function createIngredient(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor }): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, text(body.branch_id) || null, OWNER_MANAGER_ROLES);
  if ('error' in auth) return auth.error;

  const name = text(body.name, 160);
  if (!name) return badRequest('name is required');
  const unit = text(body.unit, 20) || 'kg';
  const currentStock = Number(body.current_stock ?? 0);
  const minimumStock = Number(body.minimum_stock ?? 0);
  const costPerUnit = Number(body.cost_per_unit ?? 0);
  if (!Number.isFinite(currentStock) || currentStock < 0) return badRequest('current_stock must be zero or greater');
  if (!Number.isFinite(minimumStock) || minimumStock < 0) return badRequest('minimum_stock must be zero or greater');
  if (!Number.isFinite(costPerUnit) || costPerUnit < 0) return badRequest('cost_per_unit must be zero or greater');

  const existing = await ctx.env.DB.prepare(`
    SELECT id FROM ingredients WHERE branch_id = ? AND lower(name) = lower(?)
  `).bind(auth.branch.id, name).first<any>();
  if (existing) return Response.json({ error: 'An ingredient with this name already exists at this branch' }, { status: 409 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    ctx.env.DB.prepare(`
      INSERT INTO ingredients (
        id, organization_id, branch_id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(id, ctx.orgId, auth.branch.id, name, unit, currentStock, minimumStock, costPerUnit, now, now),
  ];
  if (currentStock > 0) {
    statements.push(ctx.env.DB.prepare(`
      INSERT INTO inventory_transactions (
        id, organization_id, branch_id, ingredient_id, type, quantity, balance_after,
        reason, created_by_user_id, created_by_name, created_at
      ) VALUES (?, ?, ?, ?, 'initial', ?, ?, 'Opening stock', ?, ?, ?)
    `).bind(crypto.randomUUID(), ctx.orgId, auth.branch.id, id, currentStock, currentStock, ctx.actor.id, ctx.actor.name, now));
  }
  await ctx.env.DB.batch(statements);

  return Response.json({
    ingredient: {
      id, branch_id: auth.branch.id, name, unit, current_stock: currentStock,
      minimum_stock: minimumStock, cost_per_unit: costPerUnit, is_active: 1, created_at: now, updated_at: now,
    },
  }, { status: 201 });
}

async function updateIngredient(ctx: {
  request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor; ingredientId: string;
}): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const ingredient = await ctx.env.DB.prepare(`
    SELECT id, branch_id FROM ingredients WHERE id = ? AND organization_id = ?
  `).bind(ctx.ingredientId, ctx.orgId).first<any>();
  if (!ingredient) return Response.json({ error: 'Ingredient not found' }, { status: 404 });

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, ingredient.branch_id, OWNER_MANAGER_ROLES);
  if ('error' in auth) return auth.error;

  const name = text(body.name, 160) || null;
  const unit = text(body.unit, 20) || null;
  const minimumStock = body.minimum_stock === undefined ? null : Number(body.minimum_stock);
  const costPerUnit = body.cost_per_unit === undefined ? null : Number(body.cost_per_unit);
  if (minimumStock !== null && (!Number.isFinite(minimumStock) || minimumStock < 0)) return badRequest('minimum_stock must be zero or greater');
  if (costPerUnit !== null && (!Number.isFinite(costPerUnit) || costPerUnit < 0)) return badRequest('cost_per_unit must be zero or greater');

  if (name) {
    const duplicate = await ctx.env.DB.prepare(`
      SELECT id FROM ingredients WHERE branch_id = ? AND lower(name) = lower(?) AND id != ?
    `).bind(auth.branch.id, name, ingredient.id).first<any>();
    if (duplicate) return Response.json({ error: 'An ingredient with this name already exists at this branch' }, { status: 409 });
  }

  await ctx.env.DB.prepare(`
    UPDATE ingredients SET
      name = COALESCE(?, name),
      unit = COALESCE(?, unit),
      minimum_stock = COALESCE(?, minimum_stock),
      cost_per_unit = COALESCE(?, cost_per_unit),
      updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(name, unit, minimumStock, costPerUnit, new Date().toISOString(), ingredient.id, ctx.orgId).run();

  const updated = await ctx.env.DB.prepare(`
    SELECT id, branch_id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active, created_at, updated_at
    FROM ingredients WHERE id = ?
  `).bind(ingredient.id).first<any>();
  return Response.json({ ingredient: updated });
}

async function deactivateIngredient(ctx: {
  env: Env; orgId: string; memberships: UserMembership[]; ingredientId: string;
}): Promise<Response> {
  const ingredient = await ctx.env.DB.prepare(`
    SELECT id, branch_id FROM ingredients WHERE id = ? AND organization_id = ?
  `).bind(ctx.ingredientId, ctx.orgId).first<any>();
  if (!ingredient) return Response.json({ error: 'Ingredient not found' }, { status: 404 });

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, ingredient.branch_id, OWNER_MANAGER_ROLES);
  if ('error' in auth) return auth.error;

  await ctx.env.DB.prepare(`
    UPDATE ingredients SET is_active = 0, updated_at = ? WHERE id = ? AND organization_id = ?
  `).bind(new Date().toISOString(), ingredient.id, ctx.orgId).run();

  return Response.json({ success: true, id: ingredient.id, is_active: 0 });
}

async function adjustIngredientStock(ctx: {
  request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor;
}): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const ingredientId = text(body.ingredient_id);
  if (!ingredientId) return badRequest('ingredient_id is required');

  const ingredient = await ctx.env.DB.prepare(`
    SELECT id, branch_id, name, current_stock FROM ingredients
    WHERE id = ? AND organization_id = ? AND is_active = 1
  `).bind(ingredientId, ctx.orgId).first<any>();
  if (!ingredient) return Response.json({ error: 'Ingredient not found' }, { status: 404 });

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, ingredient.branch_id, OWNER_MANAGER_ROLES);
  if ('error' in auth) return auth.error;

  const adjustmentType = text(body.adjustment_type, 20);
  if (!['increase', 'decrease', 'set'].includes(adjustmentType)) {
    return badRequest('adjustment_type must be increase, decrease, or set');
  }
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) return badRequest('quantity must be zero or greater');
  if (adjustmentType !== 'set' && quantity === 0) return badRequest('quantity must be greater than zero for an increase or decrease');

  const before = Number(ingredient.current_stock);
  const nextStock = adjustmentType === 'increase' ? round2(before + quantity)
    : adjustmentType === 'decrease' ? round2(before - quantity)
    : round2(quantity);
  if (nextStock < 0) return badRequest('This decrease is larger than the stock on hand');

  const now = new Date().toISOString();
  const idempotencyKey = text(body.idempotency_key, 120) || null;

  if (idempotencyKey) {
    const previous = await ctx.env.DB.prepare(`
      SELECT id, balance_after FROM inventory_transactions
      WHERE ingredient_id = ? AND idempotency_key = ?
    `).bind(ingredient.id, idempotencyKey).first<any>();
    if (previous) {
      return Response.json({
        idempotent: true, ingredient_id: ingredient.id, balance_after: previous.balance_after,
      });
    }
  }

  const updated = await ctx.env.DB.prepare(`
    UPDATE ingredients SET current_stock = ?, updated_at = ?
    WHERE id = ? AND organization_id = ? AND branch_id = ? AND current_stock = ?
  `).bind(nextStock, now, ingredient.id, ctx.orgId, auth.branch.id, before).run();

  if (Number((updated as any)?.meta?.changes ?? 0) === 0) {
    return Response.json({
      error: 'Stock changed on another device. Reload the ingredient before adjusting again.',
    }, { status: 409 });
  }

  const signedQuantity = round2(nextStock - before);
  await ctx.env.DB.prepare(`
    INSERT INTO inventory_transactions (
      id, organization_id, branch_id, ingredient_id, type, quantity, balance_after,
      reason, idempotency_key, created_by_user_id, created_by_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), ctx.orgId, auth.branch.id, ingredient.id,
    adjustmentType === 'set' ? 'adjustment_set' : `adjustment_${adjustmentType}`,
    signedQuantity, nextStock, text(body.reason, 300) || null, idempotencyKey,
    ctx.actor.id, ctx.actor.name, now,
  ).run();

  return Response.json({
    success: true, ingredient_id: ingredient.id, previous_stock: before,
    current_stock: nextStock, balance_after: nextStock, change: signedQuantity,
  });
}

async function listInventoryTransactions(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), READ_ROLES);
  if ('error' in auth) return auth.error;

  const limit = clampLimit(url.searchParams.get('limit'), 50, 200);
  const rows = await ctx.env.DB.prepare(`
    SELECT t.id, t.ingredient_id, i.name AS ingredient_name, i.unit AS ingredient_unit,
           t.type, t.quantity, t.balance_after, t.reason, t.reference_id, t.created_by_name, t.created_at
    FROM inventory_transactions t
    JOIN ingredients i ON i.id = t.ingredient_id
    WHERE t.organization_id = ? AND t.branch_id = ?
    ORDER BY t.created_at DESC LIMIT ?
  `).bind(ctx.orgId, auth.branch.id, limit).all<any>();

  return Response.json({ transactions: rows.results || [], branch_id: auth.branch.id });
}

async function getRecipe(ctx: { env: Env; orgId: string; memberships: UserMembership[]; productId: string }): Promise<Response> {
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, null, READ_ROLES);
  if ('error' in auth) return auth.error;

  const product = await ctx.env.DB.prepare(`
    SELECT id, name FROM master_products WHERE id = ? AND organization_id = ?
  `).bind(ctx.productId, ctx.orgId).first<any>();
  if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });

  const rows = await ctx.env.DB.prepare(`
    SELECT r.id, r.ingredient_id, i.name AS ingredient_name, r.quantity_required,
           COALESCE(r.unit, i.unit) AS unit, r.wastage_percentage, i.cost_per_unit, i.current_stock
    FROM recipes r
    JOIN ingredients i ON i.id = r.ingredient_id
    WHERE r.organization_id = ? AND r.product_id = ? AND i.branch_id = ?
    ORDER BY i.name ASC
  `).bind(ctx.orgId, product.id, auth.branch.id).all<any>();

  const recipes = rows.results || [];
  const recipeCogs = round2(recipes.reduce((total: number, row: any) => {
    const wastage = 1 + Number(row.wastage_percentage || 0) / 100;
    return total + Number(row.quantity_required || 0) * wastage * Number(row.cost_per_unit || 0);
  }, 0));

  return Response.json({ product_id: product.id, recipes, recipe_cogs: recipeCogs, branch_id: auth.branch.id });
}

async function saveRecipe(ctx: {
  request: Request; env: Env; orgId: string; memberships: UserMembership[]; productId: string;
}): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, null, OWNER_MANAGER_ROLES);
  if ('error' in auth) return auth.error;

  const product = await ctx.env.DB.prepare(`
    SELECT id FROM master_products WHERE id = ? AND organization_id = ?
  `).bind(ctx.productId, ctx.orgId).first<any>();
  if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });

  const items = Array.isArray(body.items) ? body.items : [];
  const seen = new Set<string>();
  const rows: Array<{ ingredientId: string; quantity: number; unit: string | null; wastage: number }> = [];

  for (const item of items) {
    const ingredientId = text(item?.ingredient_id);
    const quantity = Number(item?.quantity_required);
    const wastage = Number(item?.wastage_percentage ?? 0);
    if (!ingredientId) return badRequest('Every recipe row needs an ingredient_id');
    if (seen.has(ingredientId)) return badRequest('Duplicate ingredient in recipe');
    if (!Number.isFinite(quantity) || quantity <= 0) return badRequest('quantity_required must be greater than zero');
    if (!Number.isFinite(wastage) || wastage < 0 || wastage > 100) return badRequest('wastage_percentage must be between 0 and 100');
    const ingredient = await ctx.env.DB.prepare(`
      SELECT id FROM ingredients WHERE id = ? AND organization_id = ? AND branch_id = ?
    `).bind(ingredientId, ctx.orgId, auth.branch.id).first<any>();
    if (!ingredient) return badRequest('Recipe ingredients must belong to this branch');
    seen.add(ingredientId);
    rows.push({ ingredientId, quantity: round2(quantity), unit: text(item?.unit, 20) || null, wastage: round2(wastage) });
  }

  const now = new Date().toISOString();
  const statements = [
    ctx.env.DB.prepare('DELETE FROM recipes WHERE organization_id = ? AND product_id = ?')
      .bind(ctx.orgId, product.id),
  ];
  for (const row of rows) {
    statements.push(ctx.env.DB.prepare(`
      INSERT INTO recipes (
        id, organization_id, product_id, ingredient_id, quantity_required, unit, wastage_percentage, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), ctx.orgId, product.id, row.ingredientId, row.quantity, row.unit, row.wastage, now, now));
  }
  await ctx.env.DB.batch(statements);

  return getRecipe({ env: ctx.env, orgId: ctx.orgId, memberships: ctx.memberships, productId: product.id });
}

// ── Shift / cash closure ───────────────────────────────────────────────────

function localBusinessDate(instant: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

function localMidnightIso(timeZone: string): string {
  const now = new Date();
  let offsetMinutes = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(now);
    const lookup = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const asUtc = Date.UTC(lookup('year'), lookup('month') - 1, lookup('day'), lookup('hour'), lookup('minute'), lookup('second'));
    offsetMinutes = (asUtc - now.getTime()) / 60000;
  } catch {
    offsetMinutes = 0;
  }
  const local = new Date(now.getTime() + offsetMinutes * 60000);
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocal - offsetMinutes * 60000).toISOString();
}

async function buildShiftSummary(env: Env, orgId: string, branchId: string): Promise<{
  branch_id: string; opened_at: string; closed_at: string; business_date: string;
  opening_cash: number; cash_sales: number; card_sales: number; upi_sales: number; other_sales: number;
  expected_cash: number; order_count: number; payment_count: number; time_zone: string;
}> {
  const organization = await env.DB.prepare('SELECT timezone FROM organizations WHERE id = ?')
    .bind(orgId).first<{ timezone: string }>();
  let timeZone = organization?.timezone || 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone }); } catch { timeZone = 'UTC'; }

  const lastClosure = await env.DB.prepare(`
    SELECT closed_at, actual_cash FROM synced_cash_closures
    WHERE organization_id = ? AND branch_id = ?
    ORDER BY closed_at DESC LIMIT 1
  `).bind(orgId, branchId).first<{ closed_at: string; actual_cash: number }>();

  const closedAt = new Date();
  const openedAt = lastClosure?.closed_at || localMidnightIso(timeZone);

  const totals = await env.DB.prepare(`
    SELECT payment_method, COUNT(*) AS payment_count, COALESCE(SUM(amount), 0) AS total
    FROM customer_payments
    WHERE organization_id = ? AND branch_id = ?
      AND created_at > ? AND created_at <= ?
      AND status IN ('completed', 'refunded')
    GROUP BY payment_method
  `).bind(orgId, branchId, openedAt, closedAt.toISOString()).all<any>();

  const byMethod = new Map<string, { total: number; count: number }>();
  for (const row of totals.results || []) {
    byMethod.set(String(row.payment_method), {
      total: round2(Number(row.total || 0)),
      count: Number(row.payment_count || 0),
    });
  }

  const cashSales = byMethod.get('cash')?.total || 0;
  const cardSales = byMethod.get('card')?.total || 0;
  const upiSales = byMethod.get('upi')?.total || 0;
  const otherSales = round2([...byMethod.entries()]
    .filter(([method]) => !['cash', 'card', 'upi'].includes(method))
    .reduce((total, [, value]) => total + value.total, 0));

  const orderCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM synced_orders
    WHERE organization_id = ? AND branch_id = ? AND ordered_at > ? AND ordered_at <= ?
  `).bind(orgId, branchId, openedAt, closedAt.toISOString()).first<{ count: number }>();

  return {
    branch_id: branchId,
    opened_at: openedAt,
    closed_at: closedAt.toISOString(),
    business_date: localBusinessDate(closedAt, timeZone),
    opening_cash: round2(Number(lastClosure?.actual_cash || 0)),
    cash_sales: cashSales,
    card_sales: cardSales,
    upi_sales: upiSales,
    other_sales: otherSales,
    expected_cash: round2(Number(lastClosure?.actual_cash || 0) + cashSales),
    order_count: Number(orderCount?.count || 0),
    payment_count: [...byMethod.values()].reduce((total, value) => total + value.count, 0),
    time_zone: timeZone,
  };
}

async function shiftSummary(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), ACCOUNTING_ROLES);
  if ('error' in auth) return auth.error;

  const summary = await buildShiftSummary(ctx.env, ctx.orgId, auth.branch.id);
  return Response.json({ summary });
}

async function closeShift(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor }): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, text(body.branch_id) || null, MANAGEMENT_ROLES);
  if ('error' in auth) return auth.error;

  const actualCash = Number(body.actual_cash);
  if (!Number.isFinite(actualCash) || actualCash < 0) return badRequest('actual_cash must be zero or greater');
  const openingCash = body.opening_cash === undefined ? null : Number(body.opening_cash);
  if (openingCash !== null && (!Number.isFinite(openingCash) || openingCash < 0)) {
    return badRequest('opening_cash must be zero or greater');
  }

  const summary = await buildShiftSummary(ctx.env, ctx.orgId, auth.branch.id);
  const opening = openingCash === null ? summary.opening_cash : round2(openingCash);
  const expectedCash = round2(opening + summary.cash_sales);
  const variance = round2(actualCash - expectedCash);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await ctx.env.DB.prepare(`
    INSERT INTO synced_cash_closures (
      id, organization_id, branch_id, closure_date, opened_at, closed_at, opening_cash,
      cash_sales, card_sales, upi_sales, other_sales, expected_cash, actual_cash, variance,
      notes, closed_by, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, ctx.orgId, auth.branch.id, summary.business_date, summary.opened_at, now, opening,
    summary.cash_sales, summary.card_sales, summary.upi_sales, summary.other_sales,
    expectedCash, round2(actualCash), variance, text(body.notes, 500) || null,
    ctx.actor.name, now,
  ).run();

  return Response.json({
    closure: {
      id,
      branch_id: auth.branch.id,
      closure_date: summary.business_date,
      opened_at: summary.opened_at,
      closed_at: now,
      opening_cash: opening,
      cash_sales: summary.cash_sales,
      card_sales: summary.card_sales,
      upi_sales: summary.upi_sales,
      other_sales: summary.other_sales,
      expected_cash: expectedCash,
      actual_cash: round2(actualCash),
      variance,
      notes: text(body.notes, 500) || null,
      closed_by: ctx.actor.name,
    },
    summary: { ...summary, opening_cash: opening, expected_cash: expectedCash, variance },
  }, { status: 201 });
}

async function listShiftClosures(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), ACCOUNTING_ROLES);
  if ('error' in auth) return auth.error;

  const rows = await ctx.env.DB.prepare(`
    SELECT id, branch_id, closure_date, opened_at, closed_at, opening_cash, cash_sales,
           card_sales, upi_sales, other_sales, expected_cash, actual_cash, variance, notes, closed_by
    FROM synced_cash_closures
    WHERE organization_id = ? AND branch_id = ?
    ORDER BY closed_at DESC LIMIT 50
  `).bind(ctx.orgId, auth.branch.id).all<any>();

  return Response.json({ closures: rows.results || [], branch_id: auth.branch.id });
}

// ── Delivery dispatch ──────────────────────────────────────────────────────

async function listDeliveryJobs(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const url = new URL(ctx.request.url);
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, url.searchParams.get('branch_id'), READ_ROLES);
  if ('error' in auth) return auth.error;

  const status = text(url.searchParams.get('status'), 30);
  const params: any[] = [ctx.orgId, auth.branch.id];
  let statusClause = '';
  if (status && ['pending', 'assigned', 'picked_up', 'delivered', 'cancelled'].includes(status)) {
    statusClause = 'AND j.status = ?';
    params.push(status);
  }

  const rows = await ctx.env.DB.prepare(`
    SELECT j.*, o.order_number, o.grand_total, o.payment_status, o.customer_name, o.ordered_at
    FROM delivery_jobs j
    JOIN synced_orders o ON o.id = j.order_id
    WHERE j.organization_id = ? AND j.branch_id = ? ${statusClause}
    ORDER BY j.created_at DESC LIMIT 200
  `).bind(...params).all<any>();

  return Response.json({ jobs: rows.results || [], branch_id: auth.branch.id });
}

async function createDeliveryJob(ctx: { request: Request; env: Env; orgId: string; memberships: UserMembership[] }): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const orderId = text(body.order_id);
  if (!orderId) return badRequest('order_id is required');

  const order = await ctx.env.DB.prepare(`
    SELECT id, branch_id, order_type, customer_name, customer_phone, grand_total
    FROM synced_orders WHERE id = ? AND organization_id = ?
  `).bind(orderId, ctx.orgId).first<any>();
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, text(body.branch_id) || order.branch_id, MANAGEMENT_ROLES);
  if ('error' in auth) return auth.error;
  if (order.branch_id !== auth.branch.id) {
    return Response.json({ error: 'Order does not belong to this branch' }, { status: 400 });
  }
  if (!['delivery', 'takeaway'].includes(String(order.order_type))) {
    return badRequest('Delivery jobs require a delivery or takeaway order');
  }

  const existing = await ctx.env.DB.prepare('SELECT * FROM delivery_jobs WHERE order_id = ?')
    .bind(order.id).first<any>();
  if (existing) return Response.json({ job: existing, idempotent: true });

  const address = text(body.address, 500);
  if (!address) return badRequest('address is required');

  const codAmount = Number(body.cod_amount ?? 0);
  if (!Number.isFinite(codAmount) || codAmount < 0) return badRequest('cod_amount must be zero or greater');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job = {
    id,
    branch_id: auth.branch.id,
    order_id: order.id,
    status: 'pending',
    address,
    landmark: text(body.landmark, 200) || null,
    customer_phone: text(body.customer_phone, 40) || order.customer_phone || null,
    eta_minutes: null,
    cod_amount: round2(codAmount),
    cod_collected: 0,
    created_at: now,
  };

  await ctx.env.DB.prepare(`
    INSERT INTO delivery_jobs (
      id, organization_id, branch_id, order_id, status, address, landmark, customer_phone,
      cod_amount, cod_collected, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    id, ctx.orgId, auth.branch.id, order.id, address, job.landmark,
    job.customer_phone, job.cod_amount, now, now,
  ).run();

  return Response.json({ job, order_number: order.order_number }, { status: 201 });
}

async function assignDeliveryDriver(ctx: {
  request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor; jobId: string;
}): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');

  const job = await ctx.env.DB.prepare(`
    SELECT * FROM delivery_jobs WHERE id = ? AND organization_id = ?
  `).bind(ctx.jobId, ctx.orgId).first<any>();
  if (!job) return Response.json({ error: 'Delivery job not found' }, { status: 404 });

  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, job.branch_id, MANAGEMENT_ROLES);
  if ('error' in auth) return auth.error;
  if (['delivered', 'cancelled'].includes(String(job.status))) {
    return Response.json({ error: 'This delivery is already closed' }, { status: 409 });
  }

  const driverName = text(body.driver_name, 160);
  if (!driverName) return badRequest('driver_name is required');
  const etaMinutes = body.eta_minutes === undefined ? null : Number(body.eta_minutes);
  if (etaMinutes !== null && (!Number.isFinite(etaMinutes) || etaMinutes <= 0 || etaMinutes > 600)) {
    return badRequest('eta_minutes must be between 1 and 600');
  }

  const now = new Date().toISOString();
  await ctx.env.DB.prepare(`
    UPDATE delivery_jobs SET
      status = 'assigned', driver_name = ?, driver_phone = ?, driver_user_id = ?,
      eta_minutes = ?, assigned_at = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(
    driverName, text(body.driver_phone, 40) || null, text(body.driver_user_id, 100) || null,
    etaMinutes, now, now, job.id, ctx.orgId,
  ).run();

  return Response.json({
    success: true, id: job.id, status: 'assigned', driver_name: driverName,
    driver_phone: text(body.driver_phone, 40) || null, eta_minutes: etaMinutes,
  });
}

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  pending: ['cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

async function updateDeliveryStatus(ctx: {
  request: Request; env: Env; orgId: string; memberships: UserMembership[]; actor: Actor; jobId: string;
}): Promise<Response> {
  const body = await readJson(ctx.request);
  if (!body) return badRequest('Invalid JSON payload');
  const nextStatus = text(body.status);
  if (!['picked_up', 'delivered', 'cancelled'].includes(nextStatus)) {
    return badRequest('status must be picked_up, delivered, or cancelled');
  }

  const job = await ctx.env.DB.prepare(`
    SELECT * FROM delivery_jobs WHERE id = ? AND organization_id = ?
  `).bind(ctx.jobId, ctx.orgId).first<any>();
  if (!job) return Response.json({ error: 'Delivery job not found' }, { status: 404 });

  const allowedRoles = String(job.driver_user_id) === ctx.actor.id
    ? [...MANAGEMENT_ROLES, 'delivery', 'driver']
    : MANAGEMENT_ROLES;
  const auth = await authorizeBranch(ctx.env, ctx.orgId, ctx.memberships, job.branch_id, allowedRoles);
  if ('error' in auth) return auth.error;

  const allowed = DELIVERY_TRANSITIONS[String(job.status)] || [];
  if (!allowed.includes(nextStatus)) {
    return Response.json({ error: `Cannot move a ${job.status} delivery to ${nextStatus}` }, { status: 409 });
  }

  const codAmount = Number(job.cod_amount || 0);
  if (nextStatus === 'delivered' && codAmount > 0 && body.cod_collected !== true) {
    return badRequest('cod_collected must be true before closing a cash-on-delivery job');
  }

  const now = new Date().toISOString();
  await ctx.env.DB.prepare(`
    UPDATE delivery_jobs SET
      status = ?,
      cod_collected = CASE WHEN ? = 1 THEN 1 ELSE cod_collected END,
      picked_up_at = CASE WHEN ? = 'picked_up' THEN ? ELSE picked_up_at END,
      delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE delivered_at END,
      cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END,
      cancellation_reason = CASE WHEN ? = 'cancelled' THEN ? ELSE cancellation_reason END,
      updated_at = ?
    WHERE id = ? AND organization_id = ? AND status = ?
  `).bind(
    nextStatus, nextStatus === 'delivered' && codAmount > 0 ? 1 : 0,
    nextStatus, now, nextStatus, now, nextStatus, now, nextStatus,
    text(body.cancellation_reason, 300) || null, now, job.id, ctx.orgId, job.status,
  ).run();

  return Response.json({ success: true, id: job.id, status: nextStatus });
}

/**
 * Routes the restaurant operations suite. Returns null when the path is not
 * owned by this module so the caller can continue routing.
 */
export async function handleRestaurantOpsRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  claims: any,
  memberships: UserMembership[],
): Promise<Response | null> {
  const orgId = claims.org;
  const url = new URL(request.url);
  const base = { request, env, orgId, memberships };
  const needsActor = () => loadActor(env, claims.sub);

  // Expenses
  if (path === '/api/expenses' && method === 'GET') return listExpenses(base);
  if (path === '/api/expenses' && method === 'POST') return createExpense({ ...base, actor: await needsActor() });
  if (path === '/api/expenses/categories' && method === 'GET') return listExpenseCategories(base);
  if (path === '/api/expenses/categories' && method === 'POST') return createExpenseCategory(base);
  const expenseMatch = path.match(/^\/api\/expenses\/([^/]+)$/);
  if (expenseMatch && method === 'DELETE') {
    return voidExpense({ ...base, actor: await needsActor(), expenseId: decodeURIComponent(expenseMatch[1]) });
  }

  // Vendors
  if (path === '/api/vendors' && method === 'GET') return listVendors(base);
  if (path === '/api/vendors' && method === 'POST') return createVendor(base);

  // Reservations
  if (path === '/api/reservations' && method === 'GET') return listReservations(base);
  if (path === '/api/reservations' && method === 'POST') return createReservation({ ...base, actor: await needsActor() });
  const reservationMatch = path.match(/^\/api\/reservations\/([^/]+)\/status$/);
  if (reservationMatch && method === 'PATCH') {
    return updateReservationStatus({
      ...base, actor: await needsActor(), reservationId: decodeURIComponent(reservationMatch[1]),
    });
  }

  // Inventory
  if (path === '/api/inventory/ingredients' && method === 'GET') return listIngredients(base);
  if (path === '/api/inventory/ingredients' && method === 'POST') return createIngredient({ ...base, actor: await needsActor() });
  if (path === '/api/inventory/low-stock' && method === 'GET') return listLowStock(base);
  if (path === '/api/inventory/adjust' && method === 'POST') return adjustIngredientStock({ ...base, actor: await needsActor() });
  if (path === '/api/inventory/transactions' && method === 'GET') return listInventoryTransactions(base);
  const ingredientMatch = path.match(/^\/api\/inventory\/ingredients\/([^/]+)$/);
  if (ingredientMatch && method === 'PUT') {
    return updateIngredient({
      ...base, actor: await needsActor(), ingredientId: decodeURIComponent(ingredientMatch[1]),
    });
  }
  if (ingredientMatch && method === 'DELETE') {
    return deactivateIngredient({ ...base, ingredientId: decodeURIComponent(ingredientMatch[1]) });
  }
  const recipeMatch = path.match(/^\/api\/inventory\/recipes\/([^/]+)$/);
  if (recipeMatch && method === 'GET') {
    return getRecipe({ env, orgId, memberships, productId: decodeURIComponent(recipeMatch[1]) });
  }
  if (recipeMatch && method === 'POST') {
    return saveRecipe({ ...base, productId: decodeURIComponent(recipeMatch[1]) });
  }

  // Shift / cash closure
  if (path === '/api/shifts/summary' && method === 'GET') return shiftSummary(base);
  if (path === '/api/shifts/close' && method === 'POST') return closeShift({ ...base, actor: await needsActor() });
  if (path === '/api/shifts/closures' && method === 'GET') return listShiftClosures(base);

  // Delivery dispatch
  if (path === '/api/delivery/jobs' && method === 'GET') return listDeliveryJobs(base);
  if (path === '/api/delivery/jobs' && method === 'POST') return createDeliveryJob(base);
  const assignMatch = path.match(/^\/api\/delivery\/jobs\/([^/]+)\/assign$/);
  if (assignMatch && method === 'PATCH') {
    return assignDeliveryDriver({ ...base, actor: await needsActor(), jobId: decodeURIComponent(assignMatch[1]) });
  }
  const jobStatusMatch = path.match(/^\/api\/delivery\/jobs\/([^/]+)\/status$/);
  if (jobStatusMatch && method === 'PATCH') {
    return updateDeliveryStatus({ ...base, actor: await needsActor(), jobId: decodeURIComponent(jobStatusMatch[1]) });
  }

  return null;
}
