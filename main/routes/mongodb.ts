import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { mongoSyncService } from '../services/mongodb-sync';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

// GET status
router.get('/status', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const status = await mongoSyncService.getStatus();
  res.json({ ok: true, status });
}));

// GET current settings (redacted)
router.get('/settings', requireRole(...ROLE_ACCESS.owner), (req: Request, res: Response) => {
  const config = mongoSyncService.getConfig();
  res.json({
    ok: true,
    settings: {
      uri: config.uri ? '••••••••' : '',
      dbName: config.dbName,
      enabled: config.enabled,
      lastSyncedAt: config.lastSyncedAt,
    },
  });
});

// POST save settings
router.post('/settings', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const { uri, dbName, enabled } = req.body;
  const updates: any = {};
  if (typeof enabled === 'boolean') updates.enabled = enabled;
  if (typeof dbName === 'string' && dbName.trim()) updates.dbName = dbName.trim();
  if (typeof uri === 'string' && uri.trim() && uri !== '••••••••') updates.uri = uri.trim();

  mongoSyncService.saveConfig(updates);
  const status = await mongoSyncService.getStatus();
  res.json({ ok: true, status });
}));

// POST test connection
router.post('/test-connection', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const { uri, dbName } = req.body;
  const result = await mongoSyncService.testConnection(uri, dbName);
  res.json({ ok: true, ...result });
}));

// POST manual trigger full sync
router.post('/sync-now', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const result = await mongoSyncService.syncAll();
  const status = await mongoSyncService.getStatus();
  res.json({ ok: true, result, status });
}));

export const mongodbRoutes = router;
