/**
 * Role-Based Access Control (RBAC) & Multi-Location Scope Enforcement
 * for Order It Up Cloud Edge Worker.
 */

export interface UserMembership {
  id: string;
  organization_id: string;
  user_id: string;
  restaurant_id: string | null;
  branch_id: string | null;
  role: string; // 'owner' | 'manager' | 'accountant' | 'cashier' | 'server' | 'chef'
  status: string; // 'active' | 'suspended' | 'revoked'
}

/**
 * Retrieves all active memberships for a user in an organization.
 */
export async function getUserMemberships(
  db: any,
  orgId: string,
  userId: string
): Promise<UserMembership[]> {
  const result = await db.prepare(`
    SELECT * FROM memberships 
    WHERE organization_id = ? AND user_id = ? AND status = 'active'
  `).bind(orgId, userId).all();

  return (result.results || []) as UserMembership[];
}

/**
 * Checks if the user holds organization-level owner or admin access.
 */
export function isOrgOwnerOrAdmin(memberships: UserMembership[]): boolean {
  return memberships.some(
    (m) => (m.role === 'owner' || m.role === 'admin') && m.restaurant_id === null && m.branch_id === null
  );
}

/**
 * Checks if the user is an accountant at the organization level.
 */
export function isOrgAccountant(memberships: UserMembership[]): boolean {
  return memberships.some(
    (m) => (m.role === 'accountant' || m.role === 'owner') && m.restaurant_id === null && m.branch_id === null
  );
}

/**
 * Verifies if user is authorized to access or manage a specific restaurant concept.
 * Returns true if:
 * 1. User is an organization-level owner/admin
 * 2. User has an active membership for that specific restaurant
 */
export function isAuthorizedForRestaurant(
  memberships: UserMembership[],
  restaurantId: string,
  requiredRoles: string[] = ['owner', 'manager']
): boolean {
  if (isOrgOwnerOrAdmin(memberships)) return true;

  return memberships.some(
    (m) => m.restaurant_id === restaurantId && m.branch_id === null && requiredRoles.includes(m.role)
  );
}

/**
 * Verifies if user is authorized to access or manage a specific physical branch.
 * Returns true if:
 * 1. User is an organization-level owner/admin
 * 2. User has restaurant-level manager access for the branch's parent restaurant
 * 3. User has direct branch-level membership for this branch
 */
export async function isAuthorizedForBranch(
  db: any,
  orgId: string,
  memberships: UserMembership[],
  branchId: string,
  requiredRoles: string[] = ['owner', 'manager', 'cashier', 'server', 'chef']
): Promise<{ authorized: boolean; role?: string }> {
  // 1. Fetch branch to determine its parent restaurant and strictly verify tenant ownership
  const branch = (await db.prepare(`
    SELECT id, organization_id, restaurant_id FROM branches 
    WHERE id = ? AND organization_id = ?
  `).bind(branchId, orgId).first()) as { id: string; organization_id: string; restaurant_id: string | null } | null;

  if (!branch) {
    return { authorized: false };
  }

  // 2. Org owners/admins have full access to branches within their verified tenant
  const ownerM = memberships.find((m) => (m.role === 'owner' || m.role === 'admin') && m.restaurant_id === null && m.branch_id === null);
  if (ownerM) {
    return { authorized: true, role: ownerM.role };
  }

  // Check restaurant-level membership
  if (branch.restaurant_id) {
    const restM = memberships.find(
      (m) => m.restaurant_id === branch.restaurant_id && m.branch_id === null && requiredRoles.includes(m.role)
    );
    if (restM) {
      return { authorized: true, role: restM.role };
    }
  }

  // Check branch-specific membership
  const branchM = memberships.find(
    (m) => m.branch_id === branchId && requiredRoles.includes(m.role)
  );
  if (branchM) {
    return { authorized: true, role: branchM.role };
  }

  return { authorized: false };
}
