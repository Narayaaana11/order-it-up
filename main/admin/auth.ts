import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'FINANCE' | 'READ_ONLY';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

type ConfiguredAdminOperator = AdminUser & { passwordHash: string };

const ADMIN_JWT_SECRET = process.env.OIU_ADMIN_JWT_SECRET || '';

function loadAdminOperators(): ConfiguredAdminOperator[] {
  const source = process.env.OIU_ADMIN_OPERATORS_JSON;
  if (!source) return [];

  try {
    const parsed = JSON.parse(source) as unknown;
    if (!Array.isArray(parsed)) return [];

    const roles = new Set<AdminRole>(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE', 'READ_ONLY']);
    return parsed.filter((value): value is ConfiguredAdminOperator => {
      if (!value || typeof value !== 'object') return false;
      const candidate = value as Record<string, unknown>;
      return typeof candidate.id === 'string' && candidate.id.length > 0 &&
        typeof candidate.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email) &&
        typeof candidate.name === 'string' && candidate.name.length > 0 &&
        typeof candidate.role === 'string' && roles.has(candidate.role as AdminRole) &&
        typeof candidate.passwordHash === 'string' && ['$2a$', '$2b$', '$2y$'].some((prefix) => candidate.passwordHash.startsWith(prefix)) && candidate.passwordHash.length >= 50;
    });
  } catch {
    return [];
  }
}

/**
 * Central SaaS operators are provisioned explicitly by deployment configuration.
 * There are no hard-coded operator identities, default passwords or fallback JWT secrets.
 */
export const ADMIN_OPERATORS = loadAdminOperators();

export function isAdminAuthConfigured(): boolean {
  return ADMIN_JWT_SECRET.length >= 32 && ADMIN_OPERATORS.length > 0;
}

export function generateAdminToken(user: AdminUser): string {
  if (!isAdminAuthConfigured()) {
    throw new Error('Central admin authentication is not configured');
  }
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'OIU_ADMIN_OPERATOR',
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function verifyAdminToken(token: string): AdminUser | null {
  if (!isAdminAuthConfigured()) return null;
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    if (decoded.type !== 'OIU_ADMIN_OPERATOR') return null;
    const operator = ADMIN_OPERATORS.find((candidate) => candidate.id === decoded.sub);
    if (!operator || operator.email !== decoded.email || operator.role !== decoded.role) return null;
    return {
      id: operator.id,
      email: operator.email,
      name: operator.name,
      role: operator.role,
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate central SaaS admin operators.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminAuthConfigured()) {
    res.status(503).json({ ok: false, error: 'Central admin authentication is not configured.' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Unauthorized: Admin authorization header required.' });
    return;
  }

  const token = authHeader.substring('Bearer '.length).trim();
  const user = verifyAdminToken(token);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Unauthorized: Invalid or expired admin token.' });
    return;
  }

  (req as any).adminUser = user;
  next();
}

/**
 * Express middleware to restrict central endpoints by role.
 */
export function requireAdminRole(...allowedRoles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).adminUser as AdminUser | undefined;
    if (!user) {
      res.status(401).json({ ok: false, error: 'Unauthorized: Authentication required.' });
      return;
    }

    if (user.role === 'SUPER_ADMIN' || allowedRoles.includes(user.role)) {
      next();
      return;
    }

    res.status(403).json({ ok: false, error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role.` });
  };
}
