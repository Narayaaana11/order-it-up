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
  const parts = trimmed.split('-');

  // Production requires structured, cryptographically validated commercial licenses
  if (process.env.NODE_ENV === 'production') {
    if (parts.length < 4 || parts[0].toUpperCase() !== 'OIU') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid license format. Commercial licenses must be in OIU-<PLAN>-<EXPIRY>-<SIG> format.'
      });
    }

    const planCode = parts[1].toLowerCase() as SubscriptionPlan;
    if (!['starter', 'pro', 'enterprise'].includes(planCode)) {
      return res.status(400).json({ ok: false, error: 'Unknown plan specified in license key.' });
    }

    const crypto = await import('node:crypto');
    const licenseSecret = process.env.OIU_LICENSE_SECRET || process.env.JWT_SECRET;
    if (!licenseSecret) {
      return res.status(500).json({ ok: false, error: 'Server license verification service is misconfigured.' });
    }

    const payload = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const expectedSig = crypto.createHmac('sha256', licenseSecret).update(payload).digest('hex').slice(0, parts[3].length);

    const sigBuf = Buffer.from(parts[3].toLowerCase(), 'utf8');
    const expBuf = Buffer.from(expectedSig.toLowerCase(), 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ ok: false, error: 'Invalid or counterfeit license key signature.' });
    }

    // Verify expiry timestamp
    const expiryTimestamp = parseInt(parts[2], 16) * 1000;
    if (isNaN(expiryTimestamp) || expiryTimestamp < Date.now()) {
      return res.status(400).json({ ok: false, error: 'This license key has expired.' });
    }

    const expiryIso = new Date(expiryTimestamp).toISOString();
    subscriptionService.updateSubscription({
      status: 'active',
      plan: planCode,
      currentPeriodEnd: expiryIso,
      licenseKey: trimmed,
    });

    const updated = subscriptionService.getSubscriptionInfo();
    return res.json({
      ok: true,
      message: `License successfully activated for Order It Up (${planCode.toUpperCase()} Plan).`,
      subscription: updated,
    });
  }

  // Development / Testing fallback
  let plan: SubscriptionPlan = 'pro';
  if (trimmed.toUpperCase().includes('STARTER')) {
    plan = 'starter';
  } else if (trimmed.toUpperCase().includes('ENTERPRISE')) {
    plan = 'enterprise';
  }

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
