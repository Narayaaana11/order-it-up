/**
 * Server-side SaaS subscription lifecycle and plan entitlement enforcement.
 * The D1 subscription row is authoritative; JWT claims are never used as a plan source.
 */
export type PlanFeature =
  | 'multiTerminal'
  | 'kdsStations'
  | 'cloudSync'
  | 'advancedReports'
  | 'multiOutlet'
  | 'inventoryTracking';

export interface SubscriptionEntitlements {
  maxTerminals: number;
  multiTerminal: boolean;
  kdsStations: boolean;
  cloudSync: boolean;
  whatsappReceipts: boolean;
  advancedReports: boolean;
  multiOutlet: boolean;
  inventoryTracking: boolean;
}

export interface OrganizationAccess {
  allowed: boolean;
  organizationStatus: string;
  subscriptionStatus: string;
  planCode: string;
  entitlements: SubscriptionEntitlements;
  reason?: string;
}

const LEGACY_ENTITLEMENTS: SubscriptionEntitlements = {
  maxTerminals: 9999,
  multiTerminal: true,
  kdsStations: true,
  cloudSync: true,
  whatsappReceipts: true,
  advancedReports: true,
  multiOutlet: true,
  inventoryTracking: true,
};

const RESTRICTIVE_ENTITLEMENTS: SubscriptionEntitlements = {
  maxTerminals: 1,
  multiTerminal: false,
  kdsStations: false,
  cloudSync: false,
  whatsappReceipts: false,
  advancedReports: false,
  multiOutlet: false,
  inventoryTracking: false,
};

const GRACE_DAYS = 7;

async function transitionSubscription(
  db: any,
  row: any,
  nextStatus: string,
  eventType: string,
  gracePeriodEnd: string | null,
  nowIso: string,
): Promise<void> {
  const eventId = crypto.randomUUID();
  const externalEventId = `${eventType}:${row.id}:${gracePeriodEnd || 'none'}`;
  await db.batch([
    db.prepare(`
      UPDATE organization_subscriptions
      SET status = ?, grace_period_end = ?, updated_at = ?
      WHERE id = ? AND status = ?
    `).bind(nextStatus, gracePeriodEnd, nowIso, row.id, row.status),
    db.prepare(`
      INSERT OR IGNORE INTO subscription_events
        (id, organization_id, subscription_id, event_type, source, external_event_id, event_json, created_at)
      SELECT ?, organization_id, id, ?, 'system_lifecycle', ?, ?, ?
      FROM organization_subscriptions
      WHERE id = ? AND status = ?
    `).bind(
      eventId, eventType, externalEventId,
      JSON.stringify({ from: row.status, to: nextStatus, grace_period_end: gracePeriodEnd }),
      nowIso, row.id, nextStatus,
    ),
  ]);
}

function parseEntitlements(raw: unknown): SubscriptionEntitlements {
  try {
    const value = JSON.parse(String(raw || '{}')) as Partial<SubscriptionEntitlements>;
    if (!value || typeof value !== 'object' || !Number.isFinite(Number(value.maxTerminals))) {
      return RESTRICTIVE_ENTITLEMENTS;
    }
    return {
      maxTerminals: Math.max(1, Number(value.maxTerminals)),
      multiTerminal: value.multiTerminal === true,
      kdsStations: value.kdsStations === true,
      cloudSync: value.cloudSync === true,
      whatsappReceipts: value.whatsappReceipts === true,
      advancedReports: value.advancedReports === true,
      multiOutlet: value.multiOutlet === true,
      inventoryTracking: value.inventoryTracking === true,
    };
  } catch {
    return RESTRICTIVE_ENTITLEMENTS;
  }
}

/**
 * Resolve and persist lifecycle transitions for an organization.
 * Organizations with no subscription row are legacy tenants: their existing
 * entitlements are preserved until the owner intentionally migrates them.
 */
export async function resolveOrganizationAccess(
  db: any,
  organizationId: string,
  nowDate: Date = new Date(),
): Promise<OrganizationAccess> {
  const organization = await db.prepare(`
    SELECT o.account_status,
           s.id, s.plan_code, s.status, s.trial_ends_at, s.current_period_end,
           s.cancel_at_period_end, s.grace_period_end,
           p.entitlements_json
    FROM organizations o
    LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
    LEFT JOIN saas_plans p ON p.code = s.plan_code
    WHERE o.id = ?
  `).bind(organizationId).first<any>();

  if (!organization) {
    return {
      allowed: false,
      organizationStatus: 'missing',
      subscriptionStatus: 'missing',
      planCode: 'unknown',
      entitlements: RESTRICTIVE_ENTITLEMENTS,
      reason: 'Organization not found.',
    };
  }

  const organizationStatus = organization.account_status || 'active';
  if (organizationStatus !== 'active') {
    return {
      allowed: false,
      organizationStatus,
      subscriptionStatus: organization.status || 'unassigned',
      planCode: organization.plan_code || 'legacy',
      entitlements: organization.id ? parseEntitlements(organization.entitlements_json) : LEGACY_ENTITLEMENTS,
      reason: 'Organization access is suspended or closed by platform administration.',
    };
  }

  if (!organization.id) {
    return {
      allowed: true,
      organizationStatus,
      subscriptionStatus: 'legacy',
      planCode: 'legacy',
      entitlements: LEGACY_ENTITLEMENTS,
    };
  }

  const nowIso = nowDate.toISOString();
  const currentStatus = String(organization.status || '');
  const planCode = String(organization.plan_code || 'unknown');
  const entitlements = parseEntitlements(organization.entitlements_json);

  if (currentStatus === 'trial') {
    const trialEnd = organization.trial_ends_at ? new Date(organization.trial_ends_at) : null;
    if (!trialEnd || Number.isNaN(trialEnd.getTime()) || trialEnd.getTime() <= nowDate.getTime()) {
      await transitionSubscription(db, organization, 'expired', 'trial_expired', null, nowIso);
      return {
        allowed: false, organizationStatus, subscriptionStatus: 'expired', planCode, entitlements,
        reason: 'The trial period has ended. Renew or upgrade the subscription to continue.',
      };
    }
    return { allowed: true, organizationStatus, subscriptionStatus: currentStatus, planCode, entitlements };
  }

  if (currentStatus === 'active' && organization.current_period_end) {
    const periodEnd = new Date(organization.current_period_end);
    if (!Number.isNaN(periodEnd.getTime()) && periodEnd.getTime() <= nowDate.getTime()) {
      if (Number(organization.cancel_at_period_end) === 1) {
        await transitionSubscription(db, organization, 'cancelled', 'subscription_cancelled', null, nowIso);
        return {
          allowed: false, organizationStatus, subscriptionStatus: 'cancelled', planCode, entitlements,
          reason: 'The subscription was cancelled at the end of its billing period.',
        };
      }
      const graceEnd = new Date(periodEnd.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await transitionSubscription(db, organization, 'grace_period', 'subscription_grace_period_started', graceEnd, nowIso);
      const graceEndTime = new Date(graceEnd).getTime();
      if (!Number.isFinite(graceEndTime) || graceEndTime <= nowDate.getTime()) {
        await transitionSubscription(
          db,
          { ...organization, status: 'grace_period' },
          'suspended',
          'subscription_grace_period_expired',
          graceEnd,
          nowIso,
        );
        return {
          allowed: false, organizationStatus, subscriptionStatus: 'suspended', planCode, entitlements,
          reason: 'The subscription grace period has ended. Update billing to restore access.',
        };
      }
      return { allowed: true, organizationStatus, subscriptionStatus: 'grace_period', planCode, entitlements };
    }
  }

  if (currentStatus === 'past_due') {
    const graceEnd = organization.grace_period_end
      || new Date(nowDate.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await transitionSubscription(db, organization, 'grace_period', 'subscription_grace_period_started', graceEnd, nowIso);
    if (new Date(graceEnd).getTime() <= nowDate.getTime()) {
      await transitionSubscription(
        db,
        { ...organization, status: 'grace_period' },
        'suspended',
        'subscription_grace_period_expired',
        graceEnd,
        nowIso,
      );
      return {
        allowed: false, organizationStatus, subscriptionStatus: 'suspended', planCode, entitlements,
        reason: 'The subscription grace period has ended. Update billing to restore access.',
      };
    }
    return { allowed: true, organizationStatus, subscriptionStatus: 'grace_period', planCode, entitlements };
  }

  if (currentStatus === 'grace_period') {
    const graceEnd = organization.grace_period_end ? new Date(organization.grace_period_end) : null;
    if (!graceEnd || !Number.isFinite(graceEnd.getTime()) || graceEnd.getTime() <= nowDate.getTime()) {
      await transitionSubscription(db, organization, 'suspended', 'subscription_grace_period_expired', organization.grace_period_end || null, nowIso);
      return {
        allowed: false, organizationStatus, subscriptionStatus: 'suspended', planCode, entitlements,
        reason: 'The subscription grace period has ended. Update billing to restore access.',
      };
    }
    return { allowed: true, organizationStatus, subscriptionStatus: currentStatus, planCode, entitlements };
  }

  if (['suspended', 'cancelled', 'expired'].includes(currentStatus)) {
    return {
      allowed: false, organizationStatus, subscriptionStatus: currentStatus, planCode, entitlements,
      reason: 'The subscription is not currently operational. Update billing or contact platform support.',
    };
  }

  return {
    allowed: false, organizationStatus, subscriptionStatus: currentStatus || 'unassigned', planCode, entitlements,
    reason: 'The subscription lifecycle state is not recognized.',
  };
}

/** Return the paid feature gate required by a cloud route, if any. */
export function requiredPlanFeature(path: string, method: string): PlanFeature | null {
  if (path === '/api/branches' && method === 'POST') return 'multiOutlet';
  if (path === '/api/restaurants' && method === 'POST') return 'multiOutlet';
  if (path === '/api/pairing/generate') return 'cloudSync';
  if (path.startsWith('/api/kitchen/tickets')) return 'kdsStations';
  if (path.startsWith('/api/analytics/') || path === '/api/cloud/overview' || path.startsWith('/api/accountant/')) {
    return 'advancedReports';
  }
  if (path === '/api/transfers' || path === '/api/cloud/transfers') return 'inventoryTracking';
  return null;
}
