import { Router, Request, Response } from 'express';
import { authenticateAdmin, isAdminAuthConfigured, generateAdminToken, requireAdminAuth, requireAdminRole } from './auth';
import { mongoSyncService } from '../services/mongodb-sync';
import { amazonS3Service } from '../services/amazon-s3';
import { getDatabase } from '../db';
import { asyncHandler } from '../middleware/async-handler';
import { authRateLimit } from '../middleware/security';

const router = Router();

/**
 * POST /api/admin/login
 * Operator login endpoint
 */
router.post('/login', authRateLimit({ max: 5 }), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password required.' });
  }

  if (!isAdminAuthConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Central admin authentication is not configured. Set the required OIU_ADMIN_* environment variables.',
    });
  }

  const operator = authenticateAdmin(String(email), String(password));
  if (!operator) {
    return res.status(401).json({ ok: false, error: 'Invalid operator credentials.' });
  }

  const token = generateAdminToken(operator);
  res.json({
    ok: true,
    token,
    operator,
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
      // This process owns one local SQLite database, not the global SaaS tenant registry.
      // Never present local/demo values as platform-wide subscription or revenue metrics.
      tenantMetricsAvailable: false,
      tenantMetricsUnavailableReason: 'Global tenant and subscription aggregates are not connected to this local POS API.',
      totalStores: null,
      activeStores: null,
      trialStores: null,
      totalTerminals: null,
      estimatedMrrInr: null,
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
        localOrdersCount,
      },
    },
  });
}));

/**
 * GET /api/admin/tenants
 * The local POS process is not the authoritative global SaaS tenant directory.
 */
router.get('/tenants', requireAdminAuth, asyncHandler(async (_req: Request, res: Response) => {
  res.status(503).json({
    ok: false,
    availability: 'unavailable',
    error: 'Global tenant directory is not configured for this local POS API.',
    tenants: [],
  });
}));

/**
 * POST /api/admin/tenants/:id/plan
 * Global subscription changes must be performed by the authoritative cloud control plane.
 */
router.post('/tenants/:id/plan', requireAdminAuth, requireAdminRole('SUPER_ADMIN', 'FINANCE', 'ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  res.status(503).json({
    ok: false,
    availability: 'unavailable',
    error: 'Global subscription management is not configured for this local POS API.',
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
