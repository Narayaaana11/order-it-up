import { Router, Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { amazonS3Service } from '../services/amazon-s3';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

function handleTenantErrors(err: any, res: Response, next: NextFunction): void {
  if (err?.message?.includes('Tenant isolation violation')) {
    res.status(403).json({ ok: false, error: err.message });
    return;
  }
  if (err?.message?.includes('Invalid') || err?.message?.includes('required')) {
    res.status(400).json({ ok: false, error: err.message });
    return;
  }
  next(err);
}

// GET status & configuration info
router.get('/status', requireRole(...ROLE_ACCESS.ownerManager), (req: Request, res: Response) => {
  const config = amazonS3Service.getConfig();
  const configured = Boolean(
    config.mockMode || (config.region && config.bucketName && config.accessKeyId && config.secretAccessKey)
  );

  res.json({
    ok: true,
    status: {
      configured,
      enabled: config.enabled,
      region: config.region,
      bucketName: config.bucketName,
      accessKeyId: config.accessKeyId ? `••••${config.accessKeyId.slice(-4)}` : '',
      retention: config.retentionDays,
      retentionDays: config.retentionDays,
      endpoint: config.endpoint || '',
      forcePathStyle: Boolean(config.forcePathStyle),
      mockMode: Boolean(config.mockMode),
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
  const {
    region,
    bucketName,
    accessKeyId,
    secretAccessKey,
    enabled,
    retention,
    retentionDays,
    endpoint,
    forcePathStyle,
    mockMode,
  } = req.body;

  const updates: any = {};

  if (typeof region === 'string') updates.region = region.trim();
  if (typeof bucketName === 'string') updates.bucketName = bucketName.trim();
  if (typeof accessKeyId === 'string' && !accessKeyId.includes('••••')) updates.accessKeyId = accessKeyId.trim();
  if (typeof secretAccessKey === 'string' && secretAccessKey.trim()) updates.secretAccessKey = secretAccessKey.trim();
  if (typeof enabled === 'boolean') updates.enabled = enabled;
  if (typeof retention === 'number' && retention > 0) updates.retentionDays = retention;
  if (typeof retentionDays === 'number' && retentionDays > 0) updates.retentionDays = retentionDays;
  if (typeof endpoint === 'string') updates.endpoint = endpoint.trim();
  if (typeof forcePathStyle === 'boolean') updates.forcePathStyle = forcePathStyle;
  if (typeof mockMode === 'boolean') updates.mockMode = mockMode;

  amazonS3Service.saveConfig(updates);
  const updated = amazonS3Service.getConfig();

  res.json({
    ok: true,
    status: {
      configured: Boolean(
        updated.mockMode || (updated.region && updated.bucketName && updated.accessKeyId && updated.secretAccessKey)
      ),
      enabled: updated.enabled,
      region: updated.region,
      bucketName: updated.bucketName,
      retention: updated.retentionDays,
      retentionDays: updated.retentionDays,
      endpoint: updated.endpoint || '',
      forcePathStyle: Boolean(updated.forcePathStyle),
      mockMode: Boolean(updated.mockMode),
    },
  });
});

// POST test S3 connection
router.post('/test-connection', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const result = await amazonS3Service.testConnection(req.body);
  res.json({ ok: true, ...result });
}));

// POST upload backup now
router.post('/backup-now', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : undefined;
  const result = await amazonS3Service.uploadBackup(tenantId);
  const backups = await amazonS3Service.listBackups();
  res.json({ ok: true, result, backups });
}));

// POST upload platform release
router.post('/platform/release', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { version, filename, content, contentType, isBase64 } = req.body;
    if (!version || !filename || content === undefined) {
      return res.status(400).json({ ok: false, error: 'version, filename, and content are required' });
    }
    const buffer = isBase64 ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
    const result = await amazonS3Service.uploadPlatformRelease(version, filename, buffer, contentType);
    res.json({ ok: true, result });
  } catch (err) {
    handleTenantErrors(err, res, next);
  }
}));

// POST upload user accounts archive for a tenant
router.post('/tenants/:tenantId/users', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = String(req.params.tenantId);
    const { filename, data } = req.body;
    if (!filename || data === undefined) {
      return res.status(400).json({ ok: false, error: 'filename and data are required' });
    }
    const result = await amazonS3Service.uploadUserAccountArchive(tenantId, filename, data);
    res.json({ ok: true, result });
  } catch (err) {
    handleTenantErrors(err, res, next);
  }
}));

// POST upload payment record for a tenant
router.post('/tenants/:tenantId/payments', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = String(req.params.tenantId);
    const { filename, data } = req.body;
    if (!filename || data === undefined) {
      return res.status(400).json({ ok: false, error: 'filename and data are required' });
    }
    const result = await amazonS3Service.uploadPaymentRecord(tenantId, filename, data);
    res.json({ ok: true, result });
  } catch (err) {
    handleTenantErrors(err, res, next);
  }
}));

// POST upload media asset for a tenant
router.post('/tenants/:tenantId/media', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = String(req.params.tenantId);
    const { category, filename, content, contentType, isBase64 } = req.body;
    if (!category || !filename || content === undefined) {
      return res.status(400).json({ ok: false, error: 'category, filename, and content are required' });
    }
    const buffer = isBase64 !== false ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
    const result = await amazonS3Service.uploadMediaAsset(tenantId, category, filename, buffer, contentType);
    res.json({ ok: true, result });
  } catch (err) {
    handleTenantErrors(err, res, next);
  }
}));

// GET list objects for a tenant
router.get('/tenants/:tenantId/objects', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = String(req.params.tenantId);
    const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
    const objects = await amazonS3Service.listTenantObjects(tenantId, domain);
    res.json({ ok: true, objects });
  } catch (err) {
    handleTenantErrors(err, res, next);
  }
}));

// GET tenant storage metrics
router.get('/tenants/:tenantId/metrics', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = String(req.params.tenantId);
    const metrics = await amazonS3Service.getTenantStorageMetrics(tenantId);
    res.json({ ok: true, metrics });
  } catch (err) {
    handleTenantErrors(err, res, next);
  }
}));

// GET outbox status and pending items
router.get('/outbox', requireRole(...ROLE_ACCESS.ownerManager), (_req: Request, res: Response) => {
  const outbox = amazonS3Service.getOutboxStatus();
  res.json({ ok: true, outbox });
});

// POST manually process pending outbox queue
router.post('/outbox/process', requireRole(...ROLE_ACCESS.owner), asyncHandler(async (_req: Request, res: Response) => {
  const result = await amazonS3Service.processOutbox();
  res.json({ ok: true, result });
}));

export const amazonS3Routes = router;
