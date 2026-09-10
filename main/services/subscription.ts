import log from 'electron-log';
import { getDatabase, now } from '../db';

export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'suspended'
  | 'cancelled'
  | 'expired';

export interface PlanEntitlements {
  maxTerminals: number;
  multiTerminal: boolean;
  kdsStations: boolean;
  cloudSync: boolean;
  whatsappReceipts: boolean;
  advancedReports: boolean;
  multiOutlet: boolean;
  inventoryTracking: boolean;
}

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  trialExpiresAt: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEnd: string | null;
  daysRemaining: number;
  isInGracePeriod: boolean;
  isOperational: boolean;
  licenseKey: string | null;
  entitlements: PlanEntitlements;
  storeName: string;
  storeId: string;
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanEntitlements> = {
  starter: {
    maxTerminals: 1,
    multiTerminal: false,
    kdsStations: false,
    cloudSync: false,
    whatsappReceipts: false,
    advancedReports: false,
    multiOutlet: false,
    inventoryTracking: false,
  },
  pro: {
    maxTerminals: 5,
    multiTerminal: true,
    kdsStations: true,
    cloudSync: true,
    whatsappReceipts: true,
    advancedReports: true,
    multiOutlet: false,
    inventoryTracking: true,
  },
  enterprise: {
    maxTerminals: 50,
    multiTerminal: true,
    kdsStations: true,
    cloudSync: true,
    whatsappReceipts: true,
    advancedReports: true,
    multiOutlet: true,
    inventoryTracking: true,
  },
};

const DEFAULT_TRIAL_DAYS = 14;
const DEFAULT_GRACE_DAYS = 7;

class SubscriptionService {
  /**
   * Fetch current subscription state and entitlements
   */
  public getSubscriptionInfo(): SubscriptionInfo {
    let sqlite;
    try {
      sqlite = getDatabase();
    } catch {
      return this.getDefaultTrialInfo();
    }

    const rows = sqlite.prepare(`
      SELECT key, value FROM settings 
      WHERE key IN (
        'subscription_status',
        'subscription_plan',
        'subscription_trial_expires_at',
        'subscription_period_end',
        'subscription_grace_period_end',
        'subscription_license_key',
        'store_name',
        'cloud_store_id'
      )
    `).all() as { key: string; value: string }[];

    const map = new Map(rows.map((r) => [r.key, r.value]));

    const plan = (map.get('subscription_plan') || 'pro') as SubscriptionPlan;
    const validatedPlan: SubscriptionPlan = PLAN_DEFINITIONS[plan] ? plan : 'pro';

    let status = (map.get('subscription_status') || 'trial') as SubscriptionStatus;
    const trialExpiresAt = map.get('subscription_trial_expires_at') || null;
    const currentPeriodEnd = map.get('subscription_period_end') || null;
    let gracePeriodEnd = map.get('subscription_grace_period_end') || null;

    const currentTime = new Date();

    // Auto-evaluate trial state if uninitialized
    if (!trialExpiresAt && status === 'trial') {
      const defaultExpiry = new Date(currentTime.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      try {
        sqlite.prepare(`
          INSERT INTO settings (key, value, updated_at)
          VALUES ('subscription_trial_expires_at', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).run(defaultExpiry, now());
      } catch {}
    }

    const effectiveTrialExpiry = trialExpiresAt || new Date(currentTime.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Check expiration and grace periods
    let isInGracePeriod = false;
    let isOperational = true;
    let daysRemaining = 0;

    if (status === 'trial') {
      const trialDate = new Date(effectiveTrialExpiry);
      const diffMs = trialDate.getTime() - currentTime.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      if (diffMs <= 0) {
        status = 'expired';
        isOperational = false;
      }
    } else if (status === 'active') {
      if (currentPeriodEnd) {
        const periodDate = new Date(currentPeriodEnd);
        const diffMs = periodDate.getTime() - currentTime.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if (diffMs <= 0) {
          // Enter grace period
          status = 'grace_period';
          isInGracePeriod = true;
          if (!gracePeriodEnd) {
            gracePeriodEnd = new Date(currentTime.getTime() + DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
            try {
              sqlite.prepare(`
                INSERT INTO settings (key, value, updated_at)
                VALUES ('subscription_grace_period_end', ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
              `).run(gracePeriodEnd, now());
            } catch {}
          }
        }
      }
    } else if (status === 'grace_period') {
      isInGracePeriod = true;
      if (gracePeriodEnd) {
        const graceDate = new Date(gracePeriodEnd);
        const diffMs = graceDate.getTime() - currentTime.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if (diffMs <= 0) {
          status = 'suspended';
          isOperational = false;
        }
      }
    } else if (status === 'suspended' || status === 'cancelled' || status === 'expired') {
      isOperational = false;
      daysRemaining = 0;
    }

    return {
      status,
      plan: validatedPlan,
      trialExpiresAt: effectiveTrialExpiry,
      currentPeriodEnd,
      gracePeriodEnd,
      daysRemaining,
      isInGracePeriod,
      isOperational,
      licenseKey: map.get('subscription_license_key') || null,
      entitlements: PLAN_DEFINITIONS[validatedPlan],
      storeName: map.get('store_name') || 'Order It Up Outlet',
      storeId: map.get('cloud_store_id') || 'local-store',
    };
  }

  /**
   * Check whether a specific feature is permitted for the active license
   */
  public hasFeature(feature: keyof PlanEntitlements): boolean {
    const info = this.getSubscriptionInfo();
    if (!info.isOperational) return false;
    return !!info.entitlements[feature];
  }

  /**
   * Update subscription state (e.g. from central API heartbeat or operator override)
   */
  public updateSubscription(updates: {
    status?: SubscriptionStatus;
    plan?: SubscriptionPlan;
    currentPeriodEnd?: string | null;
    licenseKey?: string | null;
  }): void {
    const sqlite = getDatabase();
    const timestamp = now();
    const upsert = sqlite.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    sqlite.transaction(() => {
      if (updates.status) upsert.run('subscription_status', updates.status, timestamp);
      if (updates.plan) upsert.run('subscription_plan', updates.plan, timestamp);
      if (updates.currentPeriodEnd !== undefined) {
        upsert.run('subscription_period_end', updates.currentPeriodEnd || '', timestamp);
      }
      if (updates.licenseKey !== undefined) {
        upsert.run('subscription_license_key', updates.licenseKey || '', timestamp);
      }
    })();

    log.info('[SubscriptionService] Updated subscription status:', updates);
  }

  private getDefaultTrialInfo(): SubscriptionInfo {
    return {
      status: 'trial',
      plan: 'pro',
      trialExpiresAt: null,
      currentPeriodEnd: null,
      gracePeriodEnd: null,
      daysRemaining: 14,
      isInGracePeriod: false,
      isOperational: true,
      licenseKey: null,
      entitlements: PLAN_DEFINITIONS.pro,
      storeName: 'Order It Up Outlet',
      storeId: 'local-store',
    };
  }
}

export const subscriptionService = new SubscriptionService();
