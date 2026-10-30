/**
 * Multi-Restaurant Hierarchy, Branch Ownership & Scoped Membership Handlers
 * for Order It Up Cloud Edge Worker.
 */

import { Env } from './pairing';
import {
  getUserMemberships,
  isOrgOwnerOrAdmin,
  isAuthorizedForRestaurant,
  isAuthorizedForBranch,
  UserMembership,
} from '../rbac';

export async function handleListRestaurants(
  request: Request,
  env: Env,
  claims: any
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const memberships = await getUserMemberships(env.DB, orgId, userId);

  // If organization owner or admin, return all restaurants in tenant
  if (isOrgOwnerOrAdmin(memberships)) {
    const result = await env.DB.prepare(`
      SELECT * FROM restaurants 
      WHERE organization_id = ? AND status = 'active'
      ORDER BY name ASC
    `).bind(orgId).all();

    return Response.json({ restaurants: result.results || [] });
  }

  // Non-owners: return distinct restaurants where user has active restaurant or branch membership
  const result = await env.DB.prepare(`
    SELECT DISTINCT r.* FROM restaurants r
    LEFT JOIN branches b ON b.restaurant_id = r.id
    JOIN memberships m ON (m.restaurant_id = r.id OR m.branch_id = b.id)
    WHERE r.organization_id = ? AND m.user_id = ? AND m.status = 'active' AND r.status = 'active'
    ORDER BY r.name ASC
  `).bind(orgId, userId).all();

  return Response.json({ restaurants: result.results || [] });
}

export async function handleCreateRestaurant(
  request: Request,
  env: Env,
  claims: any
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  if (!isOrgOwnerOrAdmin(memberships)) {
    return Response.json(
      { error: 'Forbidden: Only organization owners can create restaurant concepts' },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const slug = typeof body?.slug === 'string' && body.slug.trim()
    ? body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    : name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const conceptType = typeof body?.concept_type === 'string' && body.concept_type.trim()
    ? body.concept_type.trim()
    : 'dine_in';

  if (!name || name.length < 2 || name.length > 100) {
    return Response.json({ error: 'Restaurant name must be between 2 and 100 characters' }, { status: 400 });
  }

  const restId = body?.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(restId, orgId, name, slug, conceptType, now, now).run();

  return Response.json(
    {
      success: true,
      restaurant: {
        id: restId,
        organization_id: orgId,
        name,
        slug,
        concept_type: conceptType,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    },
    { status: 201 }
  );
}

export async function handleListBranches(
  request: Request,
  env: Env,
  claims: any,
  url: URL
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;
  const restaurantIdFilter = url.searchParams.get('restaurant_id');

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  const isOwner = isOrgOwnerOrAdmin(memberships);

  // If filtered by restaurant, verify ownership and user permission
  if (restaurantIdFilter) {
    const rest = await env.DB.prepare('SELECT id FROM restaurants WHERE id = ? AND organization_id = ?')
      .bind(restaurantIdFilter, orgId).first();
    if (!rest) {
      return Response.json({ error: 'Restaurant not found in organization' }, { status: 404 });
    }

    if (!isOwner && !isAuthorizedForRestaurant(memberships, restaurantIdFilter)) {
      return Response.json({ error: 'Forbidden: Insufficient privileges for this restaurant' }, { status: 403 });
    }

    const branches = await env.DB.prepare(`
      SELECT b.*, r.name as restaurant_name 
      FROM branches b
      LEFT JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.organization_id = ? AND b.restaurant_id = ? AND b.status = 'active'
      ORDER BY b.is_main_branch DESC, b.name ASC
    `).bind(orgId, restaurantIdFilter).all();

    return Response.json({ branches: branches.results || [] });
  }

  // Consolidated listing:
  if (isOwner) {
    const branches = await env.DB.prepare(`
      SELECT b.*, r.name as restaurant_name 
      FROM branches b
      LEFT JOIN restaurants r ON b.restaurant_id = r.id
      WHERE b.organization_id = ? AND b.status = 'active'
      ORDER BY b.is_main_branch DESC, b.name ASC
    `).bind(orgId).all();

    return Response.json({ branches: branches.results || [] });
  }

  // Non-owner: only return branches where user has membership
  const branches = await env.DB.prepare(`
    SELECT DISTINCT b.*, r.name as restaurant_name 
    FROM branches b
    LEFT JOIN restaurants r ON b.restaurant_id = r.id
    JOIN memberships m ON (m.branch_id = b.id OR (m.restaurant_id = b.restaurant_id AND m.branch_id IS NULL))
    WHERE b.organization_id = ? AND m.user_id = ? AND m.status = 'active' AND b.status = 'active'
    ORDER BY b.is_main_branch DESC, b.name ASC
  `).bind(orgId, userId).all();

  return Response.json({ branches: branches.results || [] });
}

export async function handleCreateBranch(
  request: Request,
  env: Env,
  claims: any
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const memberships = await getUserMemberships(env.DB, orgId, userId);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const code = typeof body?.code === 'string' && body.code.trim() ? body.code.trim().toUpperCase() : `BR-${Date.now().toString().slice(-4)}`;
  const restaurantId = typeof body?.restaurant_id === 'string' ? body.restaurant_id.trim() : null;

  if (!name || name.length < 2 || name.length > 100) {
    return Response.json({ error: 'Branch name must be between 2 and 100 characters' }, { status: 400 });
  }

  // Verify restaurant concept exists and belongs to the organization
  let validRestaurantId = restaurantId;
  if (validRestaurantId) {
    const rest = await env.DB.prepare('SELECT id FROM restaurants WHERE id = ? AND organization_id = ?')
      .bind(validRestaurantId, orgId).first();
    if (!rest) {
      return Response.json({ error: 'Invalid restaurant_id: Concept not found in this organization' }, { status: 400 });
    }

    // Permission check for target restaurant
    if (!isOrgOwnerOrAdmin(memberships) && !isAuthorizedForRestaurant(memberships, validRestaurantId)) {
      return Response.json({ error: 'Forbidden: Insufficient privileges for this restaurant' }, { status: 403 });
    }
  } else {
    // If restaurant_id not provided, resolve or create default restaurant for organization
    let defaultRest = await env.DB.prepare('SELECT id FROM restaurants WHERE organization_id = ? ORDER BY created_at ASC')
      .bind(orgId).first<{ id: string }>();

    if (!defaultRest) {
      const newRestId = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
        VALUES (?, ?, 'Main Concept', 'main', 'dine_in', 'active', ?, ?)
      `).bind(newRestId, orgId, now, now).run();
      validRestaurantId = newRestId;
    } else {
      validRestaurantId = defaultRest.id;
    }
  }

  const branchId = body?.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, address, phone, email, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(
    branchId,
    orgId,
    validRestaurantId,
    code,
    name,
    body.is_main_branch ? 1 : 0,
    body.address || null,
    body.phone || null,
    body.email || null,
    now,
    now
  ).run();

  return Response.json(
    {
      success: true,
      branch_id: branchId,
      branch: {
        id: branchId,
        organization_id: orgId,
        restaurant_id: validRestaurantId,
        code,
        name,
        is_main_branch: body.is_main_branch ? 1 : 0,
      },
    },
    { status: 201 }
  );
}

export async function handleListMemberships(
  request: Request,
  env: Env,
  claims: any,
  url: URL
): Promise<Response> {
  const orgId = claims.org;
  const userId = claims.sub;

  const memberships = await getUserMemberships(env.DB, orgId, userId);
  if (!isOrgOwnerOrAdmin(memberships) && !memberships.some((m) => m.role === 'manager')) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to view memberships' }, { status: 403 });
  }

  const restaurantIdFilter = url.searchParams.get('restaurant_id');
  const branchIdFilter = url.searchParams.get('branch_id');

  let query = `
    SELECT m.*, u.name as user_name, u.email as user_email,
           r.name as restaurant_name, b.name as branch_name, b.code as branch_code
    FROM memberships m
    JOIN cloud_users u ON m.user_id = u.id
    LEFT JOIN restaurants r ON m.restaurant_id = r.id
    LEFT JOIN branches b ON m.branch_id = b.id
    WHERE m.organization_id = ?
  `;
  const binds: any[] = [orgId];

  if (restaurantIdFilter) {
    query += ` AND (m.restaurant_id = ? OR (m.restaurant_id IS NULL AND m.branch_id IS NULL))`;
    binds.push(restaurantIdFilter);
  }
  if (branchIdFilter) {
    query += ` AND (m.branch_id = ? OR (m.restaurant_id IS NULL AND m.branch_id IS NULL))`;
    binds.push(branchIdFilter);
  }

  query += ` ORDER BY m.created_at DESC`;

  const result = await env.DB.prepare(query).bind(...binds).all();
  return Response.json({ memberships: result.results || [] });
}

export async function handleCreateOrUpdateMembership(
  request: Request,
  env: Env,
  claims: any
): Promise<Response> {
  const orgId = claims.org;
  const callerId = claims.sub;

  const callerMemberships = await getUserMemberships(env.DB, orgId, callerId);
  const isOwnerAdmin = isOrgOwnerOrAdmin(callerMemberships);
  const isRestManager = callerMemberships.some((m) => m.role === 'manager' && m.restaurant_id !== null && m.branch_id === null);
  const isBranchManager = callerMemberships.some((m) => m.role === 'manager' && m.branch_id !== null);

  if (!isOwnerAdmin && !isRestManager && !isBranchManager) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to assign staff memberships' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const targetUserId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : '';
  const restaurantId = typeof body?.restaurant_id === 'string' && body.restaurant_id.trim() ? body.restaurant_id.trim() : null;
  const branchId = typeof body?.branch_id === 'string' && body.branch_id.trim() ? body.branch_id.trim() : null;

  const ALLOWED_ROLES = ['owner', 'manager', 'accountant', 'cashier', 'server', 'chef'];
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return Response.json({ error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` }, { status: 400 });
  }

  // Managers cannot grant owner or admin roles
  if (!isOwnerAdmin && (role === 'owner' || role === 'admin')) {
    return Response.json({ error: 'Forbidden: Cannot grant owner or admin permissions' }, { status: 403 });
  }

  // Managers cannot grant organization-level memberships
  if (!isOwnerAdmin && !restaurantId && !branchId) {
    return Response.json({ error: 'Forbidden: Cannot grant organization-level memberships' }, { status: 403 });
  }

  // If Restaurant Manager: target must belong to caller's assigned restaurant
  if (!isOwnerAdmin && isRestManager && !isBranchManager) {
    const callerRestIds = callerMemberships
      .filter((m) => m.role === 'manager' && m.restaurant_id !== null)
      .map((m) => m.restaurant_id);
    if (!restaurantId || !callerRestIds.includes(restaurantId)) {
      return Response.json({ error: 'Forbidden: Cannot grant permissions outside your authorized restaurant concept' }, { status: 403 });
    }
  }

  // If Branch Manager: target must specify branch_id and it must belong to caller's assigned branch
  if (!isOwnerAdmin && isBranchManager) {
    const callerBranchIds = callerMemberships
      .filter((m) => m.role === 'manager' && m.branch_id !== null)
      .map((m) => m.branch_id);
    if (!branchId || !callerBranchIds.includes(branchId)) {
      return Response.json({ error: 'Forbidden: Cannot grant permissions outside your authorized branch' }, { status: 403 });
    }
    // Branch manager cannot grant manager roles
    if (role === 'manager') {
      return Response.json({ error: 'Forbidden: Branch managers cannot grant manager roles' }, { status: 403 });
    }
  }

  // Resolve target user
  let resolvedUserId = targetUserId;
  if (!resolvedUserId && email) {
    const userRow = await env.DB.prepare('SELECT id FROM cloud_users WHERE email = ? AND organization_id = ?')
      .bind(email, orgId).first<{ id: string }>();
    if (userRow) {
      resolvedUserId = userRow.id;
    } else {
      return Response.json({ error: 'User with provided email does not exist in this organization' }, { status: 404 });
    }
  }

  if (!resolvedUserId) {
    return Response.json({ error: 'user_id or existing user email is required' }, { status: 400 });
  }

  // Validate restaurant and branch ownership if specified
  if (restaurantId) {
    const rest = await env.DB.prepare('SELECT id FROM restaurants WHERE id = ? AND organization_id = ?')
      .bind(restaurantId, orgId).first();
    if (!rest) {
      return Response.json({ error: 'Invalid restaurant_id for this organization' }, { status: 400 });
    }
  }

  if (branchId) {
    const branch = await env.DB.prepare('SELECT id, restaurant_id FROM branches WHERE id = ? AND organization_id = ?')
      .bind(branchId, orgId).first<{ id: string; restaurant_id: string | null }>();
    if (!branch) {
      return Response.json({ error: 'Invalid branch_id for this organization' }, { status: 400 });
    }
  }

  const now = new Date().toISOString();

  // Check if existing membership exists at this exact scope
  let existingQuery = `
    SELECT id FROM memberships 
    WHERE organization_id = ? AND user_id = ?
  `;
  const existingBinds: any[] = [orgId, resolvedUserId];

  if (branchId) {
    existingQuery += ` AND branch_id = ?`;
    existingBinds.push(branchId);
  } else if (restaurantId) {
    existingQuery += ` AND restaurant_id = ? AND branch_id IS NULL`;
    existingBinds.push(restaurantId);
  } else {
    existingQuery += ` AND restaurant_id IS NULL AND branch_id IS NULL`;
  }

  const existingM = await env.DB.prepare(existingQuery).bind(...existingBinds).first<{ id: string }>();

  if (existingM) {
    // Anti-lockout: verify we are not demoting the sole remaining active org owner
    const existingRow = await env.DB.prepare('SELECT role, restaurant_id, branch_id FROM memberships WHERE id = ?')
      .bind(existingM.id).first<{ role: string; restaurant_id: string | null; branch_id: string | null }>();

    if (existingRow && existingRow.role === 'owner' && existingRow.restaurant_id === null && existingRow.branch_id === null && role !== 'owner') {
      const activeOwners = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM memberships 
        WHERE organization_id = ? AND role = 'owner' AND restaurant_id IS NULL AND branch_id IS NULL AND status = 'active'
      `).bind(orgId).first<{ count: number }>();
      if ((activeOwners?.count ?? 0) <= 1) {
        return Response.json(
          { error: 'Cannot demote or revoke the sole remaining organization owner account' },
          { status: 400 }
        );
      }
    }

    // Update role and status
    await env.DB.prepare(`
      UPDATE memberships 
      SET role = ?, status = 'active', updated_at = ?
      WHERE id = ?
    `).bind(role, now, existingM.id).run();

    return Response.json({
      success: true,
      message: 'Membership updated successfully',
      membership_id: existingM.id,
    });
  }

  // Create new membership
  const membershipId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(membershipId, orgId, resolvedUserId, restaurantId, branchId, role, now, now).run();

  return Response.json(
    {
      success: true,
      message: 'Membership granted successfully',
      membership_id: membershipId,
    },
    { status: 201 }
  );
}

export async function handleRevokeMembership(
  request: Request,
  env: Env,
  claims: any,
  membershipId: string
): Promise<Response> {
  const orgId = claims.org;
  const callerId = claims.sub;

  const callerMemberships = await getUserMemberships(env.DB, orgId, callerId);
  const isOwnerAdmin = isOrgOwnerOrAdmin(callerMemberships);
  const isRestManager = callerMemberships.some((m) => m.role === 'manager' && m.restaurant_id !== null && m.branch_id === null);
  const isBranchManager = callerMemberships.some((m) => m.role === 'manager' && m.branch_id !== null);

  if (!isOwnerAdmin && !isRestManager && !isBranchManager) {
    return Response.json({ error: 'Forbidden: Insufficient privileges to revoke memberships' }, { status: 403 });
  }

  const targetM = await env.DB.prepare('SELECT * FROM memberships WHERE id = ? AND organization_id = ?')
    .bind(membershipId, orgId).first<UserMembership>();

  if (!targetM) {
    return Response.json({ error: 'Membership record not found' }, { status: 404 });
  }

  // Managers cannot revoke outside their scope or revoke owners/admins
  if (!isOwnerAdmin) {
    if (targetM.role === 'owner' || targetM.role === 'admin') {
      return Response.json({ error: 'Forbidden: Cannot revoke owner or admin memberships' }, { status: 403 });
    }
    if (isBranchManager) {
      const callerBranchIds = callerMemberships.filter((m) => m.role === 'manager' && m.branch_id !== null).map((m) => m.branch_id);
      if (!targetM.branch_id || !callerBranchIds.includes(targetM.branch_id)) {
        return Response.json({ error: 'Forbidden: Cannot revoke membership outside your branch' }, { status: 403 });
      }
    } else if (isRestManager) {
      const callerRestIds = callerMemberships.filter((m) => m.role === 'manager' && m.restaurant_id !== null).map((m) => m.restaurant_id);
      if (!targetM.restaurant_id || !callerRestIds.includes(targetM.restaurant_id)) {
        return Response.json({ error: 'Forbidden: Cannot revoke membership outside your restaurant' }, { status: 403 });
      }
    }
  }

  // Anti-lockout: prevent revoking the sole remaining organization owner account
  if (targetM.role === 'owner' && targetM.restaurant_id === null && targetM.branch_id === null) {
    const ownerCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM memberships 
      WHERE organization_id = ? AND role = 'owner' AND restaurant_id IS NULL AND branch_id IS NULL AND status = 'active'
    `).bind(orgId).first<{ count: number }>();

    if ((ownerCount?.count ?? 0) <= 1) {
      return Response.json(
        { error: 'Cannot revoke the sole remaining organization owner account' },
        { status: 400 }
      );
    }
  }

  await env.DB.prepare(`
    UPDATE memberships 
    SET status = 'revoked', updated_at = ? 
    WHERE id = ?
  `).bind(new Date().toISOString(), membershipId).run();

  return Response.json({ success: true, message: 'Membership revoked successfully' });
}
