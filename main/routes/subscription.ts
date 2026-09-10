import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { subscriptionService, SubscriptionPlan, SubscriptionStatus } from '../services/subscription';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

/**
 * GET /api/subscription
 * Read-only status endpoint for POS terminal users to check plan, expiration, and feature entitlements.
 */
router.get('/', requireRole(...ROLE_ACCESS.allStaff), asyncHandler(async (_req: Request, res: Response) => {
  const info = subscriptionService.getSubscriptionInfo();
  res.json({
    ok: true,
    subscription: info,
  });
}));

/**
 * POST /api/subscription/activate
 * Activate a license key on this terminal (Owner/Manager role required)
 */
router.post('/activate', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body;
  if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.trim()) {
    return res.status(400).json({ ok: false, error: 'A valid license key is required.' });
  }

  const trimmed = licenseKey.trim();
  // Decode or map mock commercial license key format OIU-<PLAN>-<HEX>
  let plan: SubscriptionPlan = 'pro';
  if (trimmed.toUpperCase().includes('STARTER')) {
    plan = 'starter';
  } else if (trimmed.toUpperCase().includes('ENTERPRISE')) {
    plan = 'enterprise';
  }

  // 1 year from now
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  subscriptionService.updateSubscription({
    status: 'active',
    plan,
    currentPeriodEnd: oneYearFromNow,
    licenseKey: trimmed,
  });

  const updated = subscriptionService.getSubscriptionInfo();
  res.json({
    ok: true,
    message: `License successfully activated for Order It Up (${plan.toUpperCase()} Plan).`,
    subscription: updated,
  });
}));

export const subscriptionRoutes = router;
