import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'FINANCE' | 'READ_ONLY';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

const ADMIN_JWT_SECRET = process.env.OIU_ADMIN_JWT_SECRET || 'oiu-central-admin-super-secret-key-2026';

// In-memory / seed admin operators for Central SaaS control plane
// Operator password defaults to 'AdminPass123!'
const SEED_PASSWORD_HASH = bcrypt.hashSync('AdminPass123!', 10);

export const ADMIN_OPERATORS: (AdminUser & { passwordHash: string })[] = [
  {
    id: 'op-super-1',
    email: 'admin@orderitup.in',
    name: 'Super Administrator',
    role: 'SUPER_ADMIN',
    passwordHash: SEED_PASSWORD_HASH,
  },
  {
    id: 'op-support-1',
    email: 'support@orderitup.in',
    name: 'Technical Support Lead',
    role: 'SUPPORT',
    passwordHash: SEED_PASSWORD_HASH,
  },
  {
    id: 'op-finance-1',
    email: 'finance@orderitup.in',
    name: 'Finance & Billing Lead',
    role: 'FINANCE',
    passwordHash: SEED_PASSWORD_HASH,
  },
];

export function generateAdminToken(user: AdminUser): string {
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
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    if (decoded.type !== 'OIU_ADMIN_OPERATOR') return null;
    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate central SaaS admin operators
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
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
 * Express middleware to restrict central endpoints by role
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
