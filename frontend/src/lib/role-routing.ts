/**
 * Canonical Role-Based Routing & Permission Resolution Utility
 *
 * Implements role-to-route mappings according to users.md and PROJECT.md:
 * - Central SaaS Operators (super_admin, admin, finance, support, read_only) -> /cloud-portal
 * - Restaurant Owner -> /cloud-portal (web SaaS HQ) / /cloud-portal (or desktop)
 * - Branch Operations Manager -> /dashboard
 * - Head Accountant -> /reports
 * - Counter Cashier -> /pos (desktop) / /dashboard (web limitation guidance)
 * - Floor Waiter / Server -> /tables (desktop) / /dashboard (web)
 * - Kitchen Station Chef -> /kds (desktop) / /kds-standalone (web)
 * - Guest / Customer -> /menu
 * - Delivery Driver -> /dashboard
 * - Unauthenticated -> /pos (desktop) / /auth/login (web)
 */

export interface UserRoleInfo {
  role?: string;
  isOwner?: boolean;
  tenantRole?: string;
}

/**
 * Returns the canonical landing route for a given user role and client platform.
 * Normalizes roles with trimming and case-insensitivity.
 */
export function getRoleDefaultRoute(user: UserRoleInfo | null, isElectron: boolean): string {
  if (!user) {
    return isElectron ? '/pos' : '/auth/login';
  }

  const roleRaw = user.role || user.tenantRole || (user.isOwner ? 'owner' : '');
  const role = String(roleRaw || '').trim().toLowerCase();

  // Central SaaS Operators (users.md § 3.1)
  if (['super_admin', 'superadmin', 'admin', 'finance', 'support', 'read_only'].includes(role)) {
    return '/cloud-portal';
  }

  // Restaurant Owner (users.md § 3.2, PROJECT.md)
  if (role === 'owner' || user.isOwner) {
    return '/cloud-portal';
  }

  // Branch Operations Manager (users.md § 3.2, PROJECT.md Feature 10)
  if (role === 'manager' || role === 'branch_manager') {
    return '/dashboard';
  }

  // Head Accountant (users.md § 3.2)
  if (role === 'accountant') {
    return '/reports';
  }

  // Cashier (Counter POS Billing)
  if (role === 'cashier') {
    return isElectron ? '/pos' : '/dashboard';
  }

  // Waiter / Server
  if (role === 'waiter' || role === 'server') {
    return isElectron ? '/tables' : '/dashboard';
  }

  // Kitchen Chef
  if (role === 'chef' || role === 'kitchen') {
    return isElectron ? '/kds' : '/kds-standalone';
  }

  // Guest / Customer
  if (role === 'customer' || role === 'guest') {
    return '/menu';
  }

  // Delivery Driver
  if (role === 'delivery' || role === 'driver') {
    return '/dashboard';
  }

  // Fallback for unknown / custom roles
  return isElectron ? '/pos' : '/dashboard';
}

/**
 * Validates whether a specific role is recognized for entry into the web platform.
 */
export function isRoleAllowedOnWeb(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  const webAllowed = [
    'super_admin',
    'superadmin',
    'admin',
    'finance',
    'support',
    'read_only',
    'owner',
    'manager',
    'branch_manager',
    'accountant',
    'customer',
    'guest',
    'cashier',
    'waiter',
    'server',
    'chef',
    'kitchen',
    'delivery',
    'driver',
  ];
  return webAllowed.includes(r);
}
