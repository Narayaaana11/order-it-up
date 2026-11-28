/**
 * Cloud Staff Management
 *
 * Serves the desktop `/staff` contract backed by cloud_users + memberships.
 * Staff sign in with a password (Cloud has no PIN login), and role changes keep
 * the membership source of truth that Cloud authorization reads.
 */

import { Env } from './pairing';
import { UserMembership } from '../rbac';
import { hashPassword } from '../auth';

const MANAGE_ROLES = ['owner', 'admin', 'manager'];
const ASSIGNABLE_ROLES = ['owner', 'manager', 'cashier', 'server', 'chef', 'accountant', 'kitchen', 'delivery', 'host'];
const ORG_LEVEL_ROLES = ['owner', 'manager', 'accountant'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, maximum = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function badRequest(message: string, code?: string): Response {
  return Response.json({ error: message, ...(code ? { code } : {}) }, { status: 400 });
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function isManagerOnly(memberships: UserMembership[]): boolean {
  const owner = memberships.some((membership) => membership.role === 'owner' || membership.role === 'admin');
  return !owner && memberships.some((membership) => ['manager', 'branch_manager'].includes(membership.role));
}

function staffView(row: any) {
  return {
    id: String(row.id),
    name: String(row.name),
    email: row.email ?? null,
    role: String(row.role),
    has_pin: false,
    is_active: row.status === 'active' ? 1 : 0,
    branch_id: row.assigned_branch_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function defaultBranchId(env: Env, orgId: string): Promise<string | null> {
  const row = await env.DB.prepare(`
    SELECT id FROM branches WHERE organization_id = ? AND status = 'active'
    ORDER BY is_main_branch DESC, created_at ASC LIMIT 1
  `).bind(orgId).first<{ id: string }>();
  return row?.id || null;
}

async function activeOwnerCount(env: Env, orgId: string, excludeUserId?: string): Promise<number> {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM cloud_users
    WHERE organization_id = ? AND status = 'active' AND role = 'owner' AND id != ?
  `).bind(orgId, excludeUserId || '').first<{ count: number }>();
  return Number(row?.count || 0);
}

async function listStaff(env: Env, orgId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT u.*, (SELECT m.branch_id FROM memberships m
                 WHERE m.organization_id = u.organization_id AND m.user_id = u.id AND m.status = 'active'
                 ORDER BY m.branch_id IS NULL ASC LIMIT 1) AS assigned_branch_id
    FROM cloud_users u
    WHERE u.organization_id = ?
    ORDER BY u.name ASC
  `).bind(orgId).all<any>();
  return Response.json({ staff: (rows.results || []).map(staffView) });
}

async function createStaff(request: Request, env: Env, orgId: string, memberships: UserMembership[]): Promise<Response> {
  const body = await readJson(request);
  if (!body) return badRequest('Invalid JSON payload');

  const name = text(body.name, 160);
  const email = text(body.email, 160).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const role = text(body.role, 30) || 'server';

  if (!name) return badRequest('name is required');
  if (!EMAIL_PATTERN.test(email)) return badRequest('A valid email is required');
  if (password.length < 8) return badRequest('Password must be at least 8 characters');
  if (!ASSIGNABLE_ROLES.includes(role)) return badRequest('This role cannot be assigned');

  if (role === 'owner' && isManagerOnly(memberships)) {
    return Response.json({ error: 'Only an owner can create another owner' }, { status: 403 });
  }

  const existing = await env.DB.prepare('SELECT id FROM cloud_users WHERE email = ?').bind(email).first<any>();
  if (existing) return Response.json({ error: 'A user with this email already exists' }, { status: 409 });

  const branchId = ORG_LEVEL_ROLES.includes(role) ? null : await defaultBranchId(env, orgId);
  if (!ORG_LEVEL_ROLES.includes(role) && !branchId) {
    return Response.json({ error: 'No active branch is available for this staff role' }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, assigned_branch_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(id, orgId, email, passwordHash, name, role, branchId, now, now),
    env.DB.prepare(`
      INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)
    `).bind(crypto.randomUUID(), orgId, id, branchId, role, now, now),
  ]);

  const row = await env.DB.prepare('SELECT * FROM cloud_users WHERE id = ?').bind(id).first<any>();
  return Response.json({ staff: staffView(row) }, { status: 201 });
}

async function updateStaff(request: Request, env: Env, orgId: string, staffId: string, callerId: string, memberships: UserMembership[]): Promise<Response> {
  const body = await readJson(request);
  if (!body) return badRequest('Invalid JSON payload');

  const existing = await env.DB.prepare(`
    SELECT * FROM cloud_users WHERE id = ? AND organization_id = ?
  `).bind(staffId, orgId).first<any>();
  if (!existing) return Response.json({ error: 'Staff member not found' }, { status: 404 });

  if ((existing.role === 'owner' || existing.role === 'admin') && isManagerOnly(memberships)) {
    return Response.json({ error: 'Only an owner can modify an owner account' }, { status: 403 });
  }

  const name = body.name === undefined ? existing.name : text(body.name, 160);
  if (!name) return badRequest('name is required');
  const email = body.email === undefined ? existing.email : text(body.email, 160).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return badRequest('A valid email is required');
  if (email !== existing.email) {
    const duplicate = await env.DB.prepare('SELECT id FROM cloud_users WHERE email = ? AND id != ?').bind(email, staffId).first<any>();
    if (duplicate) return Response.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  const role = body.role === undefined ? existing.role : text(body.role, 30);
  if (!ASSIGNABLE_ROLES.includes(role)) return badRequest('This role cannot be assigned');
  if (role === 'owner' && existing.role !== 'owner' && isManagerOnly(memberships)) {
    return Response.json({ error: 'Only an owner can grant owner access' }, { status: 403 });
  }
  if (staffId === callerId && role !== existing.role) {
    return Response.json({ error: 'You cannot change your own role' }, { status: 409 });
  }
  if (existing.role === 'owner' && role !== 'owner' && await activeOwnerCount(env, orgId, staffId) === 0) {
    return Response.json({ error: 'The last active owner cannot be demoted' }, { status: 409 });
  }

  const password = typeof body.password === 'string' && body.password ? body.password : null;
  if (password !== null && password.length < 8) return badRequest('Password must be at least 8 characters');

  const now = new Date().toISOString();
  const passwordHash = password ? await hashPassword(password) : existing.password_hash;
  const branchId = ORG_LEVEL_ROLES.includes(role)
    ? null
    : (existing.assigned_branch_id || await defaultBranchId(env, orgId));
  if (!ORG_LEVEL_ROLES.includes(role) && !branchId) {
    return Response.json({ error: 'No active branch is available for this staff role' }, { status: 409 });
  }

  const statements = [
    env.DB.prepare(`
      UPDATE cloud_users SET name = ?, email = ?, password_hash = ?, role = ?, assigned_branch_id = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).bind(name, email, passwordHash, role, branchId, now, staffId, orgId),
  ];

  if (role !== existing.role || branchId !== existing.assigned_branch_id) {
    statements.push(env.DB.prepare('DELETE FROM memberships WHERE organization_id = ? AND user_id = ?').bind(orgId, staffId));
    statements.push(env.DB.prepare(`
      INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)
    `).bind(crypto.randomUUID(), orgId, staffId, branchId, role, now, now));
  }

  await env.DB.batch(statements);
  const row = await env.DB.prepare('SELECT * FROM cloud_users WHERE id = ?').bind(staffId).first<any>();
  return Response.json({ success: true, staff: staffView(row) });
}

async function setStaffActive(env: Env, orgId: string, staffId: string, callerId: string, active: boolean, memberships: UserMembership[]): Promise<Response> {
  const existing = await env.DB.prepare(`
    SELECT * FROM cloud_users WHERE id = ? AND organization_id = ?
  `).bind(staffId, orgId).first<any>();
  if (!existing) return Response.json({ error: 'Staff member not found' }, { status: 404 });
  if (staffId === callerId) return Response.json({ error: 'You cannot deactivate your own account' }, { status: 409 });
  if (existing.role === 'owner' && isManagerOnly(memberships)) {
    return Response.json({ error: 'Only an owner can modify an owner account' }, { status: 403 });
  }
  if (!active && existing.role === 'owner' && await activeOwnerCount(env, orgId, staffId) === 0) {
    return Response.json({ error: 'The last active owner cannot be deactivated' }, { status: 409 });
  }

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE cloud_users SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?')
      .bind(active ? 'active' : 'inactive', now, staffId, orgId),
    env.DB.prepare('UPDATE memberships SET status = ?, updated_at = ? WHERE organization_id = ? AND user_id = ?')
      .bind(active ? 'active' : 'revoked', now, orgId, staffId),
  ]);

  const row = await env.DB.prepare('SELECT * FROM cloud_users WHERE id = ?').bind(staffId).first<any>();
  return Response.json({ success: true, staff: staffView(row) });
}

/**
 * Routes staff management paths. Returns null when the path is not owned here.
 */
export async function handleStaffRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  claims: any,
  memberships: UserMembership[],
): Promise<Response | null> {
  if (path !== '/api/staff' && !path.startsWith('/api/staff/')) return null;

  const orgId = claims.org;
  if (!memberships.some((membership) => membership.status === 'active' && MANAGE_ROLES.includes(membership.role))) {
    return Response.json({ error: 'Forbidden: only owners and managers can manage staff' }, { status: 403 });
  }

  if (path === '/api/staff' && method === 'GET') return listStaff(env, orgId);
  if (path === '/api/staff' && method === 'POST') return createStaff(request, env, orgId, memberships);

  const activeMatch = path.match(/^\/api\/staff\/([^/]+)\/(deactivate|reactivate)$/);
  if (activeMatch && method === 'POST') {
    return setStaffActive(env, orgId, decodeURIComponent(activeMatch[1]), claims.sub, activeMatch[2] === 'reactivate', memberships);
  }
  const staffMatch = path.match(/^\/api\/staff\/([^/]+)$/);
  if (staffMatch && method === 'PUT') {
    return updateStaff(request, env, orgId, decodeURIComponent(staffMatch[1]), claims.sub, memberships);
  }

  return null;
}
