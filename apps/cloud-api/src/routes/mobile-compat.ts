/**
 * Mobile compatibility routes.
 *
 * The Flutter app uses a slightly different contract than the desktop/Cloud
 * dashboard for session refresh and cash closures. These adapters keep the
 * mobile screens working without changing the mobile client.
 */

import { Env } from './pairing';
import { UserMembership } from '../rbac';
import { createJWT } from '../auth';
import { closeShift, listShiftClosures } from './restaurant-ops';

type Claims = { sub: string; org: string; email: string; role: string; branch?: string | null; exp: number };

/** POST /api/auth/refresh — rotates a valid staff token for another 7 days. */
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
  return null;
}
