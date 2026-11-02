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

const ADMIN_ROLES = new Set<AdminRole>(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE', 'READ_ONLY']);

export function isAdminAuthConfigured(): boolean {
  const secret = process.env.OIU_ADMIN_JWT_SECRET;
  const email = process.env.OIU_ADMIN_BOOTSTRAP_EMAIL?.trim();
  const passwordHash = process.env.OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim();
  return Boolean(
    secret && secret.length >= 32 &&
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    passwordHash && /^\$2[aby]\$\d\d\$/.test(passwordHash),
  );
}

export function getAdminJwtSecret(): string {
  const secret = process.env.OIU_ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[FATAL SECURITY] OIU_ADMIN_JWT_SECRET must be provisioned with at least 32 characters.');
  }
  return secret;
}

export function authenticateAdmin(emailInput: string, password: string): AdminUser | null {
  if (!isAdminAuthConfigured() || typeof emailInput !== 'string' || typeof password !== 'string') return null;
  const email = emailInput.trim().toLowerCase();
  const configuredEmail = process.env.OIU_ADMIN_BOOTSTRAP_EMAIL!.trim().toLowerCase();
  if (!email || email !== configuredEmail || !password) return null;

  try {
    if (!bcrypt.compareSync(password, process.env.OIU_ADMIN_BOOTSTRAP_PASSWORD_HASH!)) return null;
  } catch {
    return null;
  }

  return {
    id: 'bootstrap-platform-admin',
    email: configuredEmail,
    name: process.env.OIU_ADMIN_BOOTSTRAP_NAME?.trim() || 'Platform Administrator',
    role: 'SUPER_ADMIN',
  };
}

export function generateAdminToken(user: AdminUser): string {
  if (!ADMIN_ROLES.has(user.role)) throw new Error('Invalid platform admin role');
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'OIU_ADMIN_OPERATOR',
    },
    getAdminJwtSecret(),
    { expiresIn: '8h' },
  );
}

export function verifyAdminToken(token: string): AdminUser | null {
  try {
    if (!token || !isAdminAuthConfigured()) return null;
    const decoded = jwt.verify(token, getAdminJwtSecret()) as jwt.JwtPayload;
    const role = decoded.role as AdminRole;
    if (decoded.type !== 'OIU_ADMIN_OPERATOR' || typeof decoded.sub !== 'string' ||
        typeof decoded.email !== 'string' || typeof decoded.name !== 'string' || !ADMIN_ROLES.has(role)) {
      return null;
    }
    return { id: decoded.sub, email: decoded.email, name: decoded.name, role };
  } catch {
    return null;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Unauthorized: Admin authorization header required.' });
    return;
  }

  const user = verifyAdminToken(authHeader.substring('Bearer '.length).trim());
  if (!user) {
    res.status(401).json({ ok: false, error: 'Unauthorized: Invalid or expired admin token.' });
    return;
  }

  (req as any).adminUser = user;
  next();
}

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
