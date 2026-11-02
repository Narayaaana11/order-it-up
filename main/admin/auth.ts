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

function getAdminJwtSecret(): string | null {
  const secret = process.env.OIU_ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

/**
 * Central admin authentication is intentionally disabled unless an operator
 * provisions all three environment values. No source-code credentials or
 * development fallback are accepted by this production-facing route.
 *
 * OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH must be a bcrypt hash generated out of band.
 * Rotating the password hash changes the accepted password; rotating the JWT
 * secret invalidates every previously issued admin token.
 */
export function isAdminAuthConfigured(): boolean {
  const email = process.env.OIU_ADMIN_BOOTSTRAP_EMAIL?.trim();
  const passwordHash = process.env.OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim();
  return Boolean(
    getAdminJwtSecret()
    && email
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && passwordHash
    && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)
  );
}

export function authenticateAdmin(email: string, password: string): AdminUser | null {
  if (!isAdminAuthConfigured() || typeof password !== 'string' || password.length === 0) return null;

  const configuredEmail = process.env.OIU_ADMIN_BOOTSTRAP_EMAIL!.trim().toLowerCase();
  const passwordHash = process.env.OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH!;
  if (String(email).trim().toLowerCase() !== configuredEmail) return null;

  try {
    if (!bcrypt.compareSync(password, passwordHash)) return null;
  } catch {
    return null;
  }

  return {
    id: 'env-bootstrap-admin',
    email: configuredEmail,
    name: process.env.OIU_ADMIN_BOOTSTRAP_NAME?.trim() || 'Platform Administrator',
    role: 'SUPER_ADMIN',
  };
}

export function generateAdminToken(user: AdminUser): string {
  const secret = getAdminJwtSecret();
  if (!secret) throw new Error('Central admin authentication is not configured.');
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'OIU_ADMIN_OPERATOR',
    },
    secret,
    { expiresIn: '8h' }
  );
}

export function verifyAdminToken(token: string): AdminUser | null {
  const secret = getAdminJwtSecret();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as any;
    if (decoded.type !== 'OIU_ADMIN_OPERATOR' || decoded.sub !== 'env-bootstrap-admin') return null;
    if (decoded.role !== 'SUPER_ADMIN') return null;
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

/** Express middleware to authenticate central SaaS admin operators. */
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

/** Express middleware to restrict central endpoints by role. */
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
