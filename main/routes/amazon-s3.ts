import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { amazonS3Service } from '../services/amazon-s3';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

// GET status & configuration info
router.get('/status', requireRole(...ROLE_ACCESS.ownerManager), (req: Request, res: Response) => {
  const config = amazonS3Service.getConfig();
  res.json({
    ok: true,
    status: {
      configured: !!(config.region && config.bucketName && config.accessKeyId && config.secretAccessKey),
      enabled: config.enabled,
      region: config.region,
      bucketName: config.bucketName,
      accessKeyId: config.accessKeyId ? `••••${config.accessKeyId.slice(-4)}` : '',
      retention: config.retention,
    },
  });
});

// GET list backups in S3
router.get('/backups', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const backups = await amazonS3Service.listBackups();
  res.json({ ok: true, backups });
}));

// POST save S3 configuration
router.post('/settings', requireRole(...ROLE_ACCESS.owner), (req: Request, res: Response) => {
  const { region, bucketName, accessKeyId, secretAccessKey, enabled, retention } = req.body;
  const updates: any = {};

  if (typeof region === 'string') updates.region = region.trim();
  if (typeof bucketName === 'string') updates.bucketName = bucketName.trim();
  if (typeof accessKeyId === 'string' && !accessKeyId.includes('••••')) updates.accessKeyId = accessKeyId.trim();
  if (typeof secretAccessKey === 'string' && secretAccessKey.trim()) updates.secretAccessKey = secretAccessKey.trim();
  if (typeof enabled === 'boolean') updates.enabled = enabled;
  if (typeof retention === 'number' && retention > 0) updates.retention = retention;

  amazonS3Service.saveConfig(updates);
  res.json({ ok: true });
});

// POST test S3 connection
router.post('/test-connection', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const result = await amazonS3Service.testConnection(req.body);
  res.json({ ok: true, ...result });
}));

// POST upload backup now
router.post('/backup-now', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const result = await amazonS3Service.uploadBackup();
  const backups = await amazonS3Service.listBackups();
  res.json({ ok: true, result, backups });
}));

export const amazonS3Routes = router;
