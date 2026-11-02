-- D1 Migration 0009: Subscription grace-period lifecycle support.
-- Seven-day grace is stored on the subscription row so every Worker instance
-- applies the same expiry decision.

ALTER TABLE organization_subscriptions
  ADD COLUMN grace_period_end TEXT;

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_grace_end
  ON organization_subscriptions(status, grace_period_end);
