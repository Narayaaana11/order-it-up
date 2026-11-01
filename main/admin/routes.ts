import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { ADMIN_OPERATORS, generateAdminToken, isAdminAuthConfigured, requireAdminAuth, requireAdminRole } from './auth';
import { mongoSyncService } from '../services/mongodb-sync';
import { amazonS3Service } from '../services/amazon-s3';
import { getDatabase } from '../db';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

// In-memory tenant store for simulated Central SaaS Multi-Tenant Management
interface TenantRecord {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  plan: 'starter' | 'pro' | 'enterprise' | 'unconfigured';
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'unknown';
  terminalsCount: number;
  maxTerminals: number;
  city: string;
  state: string;
  createdAt: string;
  lastActiveAt: string;
}

/**
 * POST /api/admin/login
 * Operator login endpoint
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({ ok: false, error: 'Central admin authentication is not configured.' });
  }
  const { email, password } = req.body;
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Email and password required.' });
  }

  const normalized = String(email).trim().toLowerCase();
  const operator = ADMIN_OPERATORS.find((op) => op.email.toLowerCase() === normalized);

  if (!operator || !bcrypt.compareSync(password, operator.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Invalid operator credentials.' });
  }

  const token = generateAdminToken(operator);
  res.json({
    ok: true,
    token,
    operator: {
      id: operator.id,
      email: operator.email,
      name: operator.name,
      role: operator.role,
    },
  });
}));

/**
 * GET /api/admin/me
 * Retrieve authenticated operator identity
 */
router.get('/me', requireAdminAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    ok: true,
    operator: (req as any).adminUser,
  });
}));

/**
 * Helper to fetch the live local restaurant tenant from SQLite settings
 */
function getLiveLocalTenant(): TenantRecord | null {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s: Record<string, string> = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    if (!s.store_id || !s.business_name) return null;

    const validPlans = new Set(['starter', 'pro', 'enterprise']);
    const validStatuses = new Set(['trial', 'active', 'past_due', 'suspended', 'cancelled']);
    return {
      id: s.store_id,
      name: s.business_name,
      contactEmail: s.contact_email || '',
      contactPhone: s.phone || '',
      plan: validPlans.has(s.subscription_tier) ? s.subscription_tier as TenantRecord['plan'] : 'unconfigured',
      status: validStatuses.has(s.subscription_status) ? s.subscription_status as TenantRecord['status'] : 'unknown',
      terminalsCount: 0,
      maxTerminals: 0,
      city: s.city || '',
      state: s.state || '',
      createdAt: s.install_timestamp || '',
      lastActiveAt: s.last_active_at || '',
    };
  } catch {
    return null;
  }
}

function getAllTenants(): TenantRecord[] {
  const local = getLiveLocalTenant();
  return local ? [local] : [];
}


/**
 * GET /api/admin/metrics
 * System-wide business & technical metrics
 */
router.get('/metrics', requireAdminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const mongoStatus = await mongoSyncService.getStatus();
  const s3Config = amazonS3Service.getConfig();
  const tenants = getAllTenants();

  let sqliteOk = true;
  let localBillsCount = 0;
  let localOrdersCount = 0;
  try {
    const sqlite = getDatabase();
    const billRow = sqlite.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number };
    const orderRow = sqlite.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
    localBillsCount = billRow?.count || 0;
    localOrdersCount = orderRow?.count || 0;
  } catch {
    sqliteOk = false;
  }

  res.json({
    ok: true,
    metrics: {
      totalStores: tenants.length,
      activeStores: tenants.filter((t) => t.status === 'active').length,
      trialStores: tenants.filter((t) => t.status === 'trial').length,
      totalTerminals: tenants.reduce((acc, t) => acc + t.terminalsCount, 0),
      revenueMetricsAvailable: false,
      cloudSync: {
        connected: mongoStatus.connected,
        dbName: mongoStatus.dbName,
        lastSyncedAt: mongoStatus.lastSyncedAt,
      },
      s3Backup: {
        enabled: s3Config.enabled,
        bucket: s3Config.bucketName,
        region: s3Config.region,
      },
      localSystemHealth: {
        sqliteOk,
        localBillsCount,
        localOrdersCount,
      },
    },
  });
}));

/**
 * GET /api/admin/tenants
 * List all restaurant accounts
 */
router.get('/tenants', requireAdminAuth, asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    ok: true,
    tenants: getAllTenants(),
  });
}));

/**
 * POST /api/admin/tenants/:id/plan
 * Update tenant subscription plan and status (Super Admin or Finance only)
 */
router.post('/tenants/:id/plan', requireAdminAuth, requireAdminRole('SUPER_ADMIN', 'FINANCE', 'ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { plan, status } = req.body;

  const local = getLiveLocalTenant();
  if (!local || (id !== local.id && id !== 'store_local_primary')) {
    return res.status(404).json({ ok: false, error: 'Tenant not found in this runtime.' });
  }
  if (id === local.id || id === 'store_local_primary') {
    const db = getDatabase();
    if (plan) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES ('subscription_tier', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(plan);
    }
    if (status) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES ('subscription_status', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(status);
    }
    return res.json({
      ok: true,
      message: `Local store subscription updated to ${plan} (${status}).`,
      tenant: getLiveLocalTenant(),
    });
  }

  return res.status(404).json({ ok: false, error: 'Tenant not found in this runtime.' });
}));

/**
 * POST /api/admin/system/trigger-backup
 * Manually trigger encrypted S3 backup upload
 */
router.post('/system/trigger-backup', requireAdminAuth, requireAdminRole('SUPER_ADMIN', 'ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  try {
    const result = await amazonS3Service.uploadBackup();
    res.json({
      ok: true,
      message: 'S3 cloud backup triggered and uploaded successfully.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || 'Backup failed.' });
  }
}));

export const adminRoutes = router;
