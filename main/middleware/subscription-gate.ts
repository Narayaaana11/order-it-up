import { Request, Response, NextFunction } from 'express';
import { subscriptionService, PlanEntitlements } from '../services/subscription';

/**
 * Middleware that verifies whether the local POS installation has an active entitlement
 * for a specific feature according to its subscription plan.
 *
 * If the feature is missing or the subscription is expired/suspended past the grace period,
 * returns HTTP 403 Forbidden with an explanatory payload.
 */
export function requireSubscriptionFeature(feature: keyof PlanEntitlements) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const info = subscriptionService.getSubscriptionInfo();

    if (!info.isOperational) {
      res.status(403).json({
        ok: false,
        code: 'SUBSCRIPTION_NOT_OPERATIONAL',
        error: `Your subscription is currently ${info.status}. Please renew your plan or activate a commercial license.`,
        feature,
        status: info.status,
        plan: info.plan,
        daysRemaining: info.daysRemaining,
        isInGracePeriod: info.isInGracePeriod,
      });
      return;
    }

    if (!subscriptionService.hasFeature(feature)) {
      res.status(403).json({
        ok: false,
        code: 'FEATURE_NOT_ENTITLED',
        error: `Feature '${feature}' requires a plan upgrade. Current plan: ${info.plan}.`,
        feature,
        currentPlan: info.plan,
        status: info.status,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware ensuring the subscription is operational (active, trial, or grace period).
 * NOTE: As an offline-first POS invariant, core billing (/api/bills, /api/orders) and local
 * receipt printing must NEVER be guarded by this middleware.
 */
export function requireOperationalSubscription(_req: Request, res: Response, next: NextFunction): void {
  const info = subscriptionService.getSubscriptionInfo();

  if (!info.isOperational) {
    res.status(403).json({
      ok: false,
      code: 'SUBSCRIPTION_NOT_OPERATIONAL',
      error: `Your subscription is currently ${info.status}. Please renew your plan or activate a commercial license.`,
      status: info.status,
      plan: info.plan,
      daysRemaining: info.daysRemaining,
      isInGracePeriod: info.isInGracePeriod,
    });
    return;
  }

  next();
}
