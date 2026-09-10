import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { ADMIN_OPERATORS, generateAdminToken, requireAdminAuth, requireAdminRole, AdminUser } from './auth';
import { subscriptionService } from '../services/subscription';
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
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  terminalsCount: number;
  maxTerminals: number;
  city: string;
  state: string;
  createdAt: string;
  lastActiveAt: string;
}

const MOCK_TENANTS: TenantRecord[] = [
  {
    id: 'store_bengaluru_01',
    name: 'Brew & Byte Cafe',
    contactEmail: 'manager@brewbyte.in',
    contactPhone: '+919876543210',
    plan: 'pro',
    status: 'active',
    terminalsCount: 2,
    maxTerminals: 5,
    city: 'Bengaluru',
    state: 'Karnataka',
    createdAt: '2026-01-15T10:00:00.000Z',
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'store_mumbai_02',
    name: 'Masala Street Kitchen',
    contactEmail: 'billing@masalastreet.in',
    contactPhone: '+919812345678',
    plan: 'enterprise',
    status: 'active',
    terminalsCount: 6,
    maxTerminals: 50,
    city: 'Mumbai',
    state: 'Maharashtra',
    createdAt: '2026-02-01T12:30:00.000Z',
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'store_delhi_03',
    name: 'Crust & Crumbs Bakery',
    contactEmail: 'contact@crustcrumbs.in',
    contactPhone: '+919988776655',
    plan: 'starter',
    status: 'trial',
    terminalsCount: 1,
    maxTerminals: 1,
    city: 'New Delhi',
    state: 'Delhi',
    createdAt: '2026-03-01T08:00:00.000Z',
    lastActiveAt: new Date().toISOString(),
  },
];

/**
 * POST /api/admin/login
 * Operator login endpoint
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
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
 * GET /api/admin/metrics
 * System-wide business & technical metrics
 */
router.get('/metrics', requireAdminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const mongoStatus = await mongoSyncService.getStatus();
  const s3Config = amazonS3Service.getConfig();

  let sqliteOk = true;
  let localBillsCount = 0;
  try {
    const sqlite = getDatabase();
    const row = sqlite.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number };
    localBillsCount = row?.count || 0;
  } catch {
    sqliteOk = false;
  }

  res.json({
    ok: true,
    metrics: {
      totalStores: MOCK_TENANTS.length,
      activeStores: MOCK_TENANTS.filter((t) => t.status === 'active').length,
      trialStores: MOCK_TENANTS.filter((t) => t.status === 'trial').length,
      totalTerminals: MOCK_TENANTS.reduce((acc, t) => acc + t.terminalsCount, 0),
      estimatedMrrInr: 45000,
      currency: 'INR',
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
    tenants: MOCK_TENANTS,
  });
}));

/**
 * POST /api/admin/tenants/:id/plan
 * Update tenant subscription plan and status (Super Admin or Finance only)
 */
router.post('/tenants/:id/plan', requireAdminAuth, requireAdminRole('SUPER_ADMIN', 'FINANCE', 'ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { plan, status } = req.body;

  const tenant = MOCK_TENANTS.find((t) => t.id === id);
  if (!tenant) {
    return res.status(404).json({ ok: false, error: 'Tenant not found.' });
  }

  if (plan) tenant.plan = plan;
  if (status) tenant.status = status;

  res.json({
    ok: true,
    message: `Tenant ${tenant.name} updated successfully.`,
    tenant,
  });
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
