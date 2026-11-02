import assert from 'node:assert/strict';
import { resolveOrganizationAccess, requiredPlanFeature } from '../apps/cloud-api/src/subscriptions';

class AccessDb {
  row: any;
  events: any[] = [];
  constructor(row: any) { this.row = { ...row }; }

  prepare(sql: string) {
    let params: any[] = [];
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const statement: any = {
      bind: (...values: any[]) => { params = values; return statement; },
      first: async () => ({ ...this.row }),
      run: async () => {
        if (normalized.includes('UPDATE organization_subscriptions')) {
          if (this.row.status === params[3] || this.row.status === params[4]) {
            this.row.status = params[0];
            this.row.grace_period_end = params[1];
            this.row.updated_at = params[2];
          }
        }
        if (normalized.includes('INSERT OR IGNORE INTO subscription_events')) {
          this.events.push({ id: params[0], event_type: params[1], external_event_id: params[2] });
        }
        return { success: true };
      },
    };
    return statement;
  }

  async batch(statements: any[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

const entitlements = JSON.stringify({
  maxTerminals: 1,
  multiTerminal: false,
  kdsStations: false,
  cloudSync: false,
  whatsappReceipts: false,
  advancedReports: false,
  multiOutlet: false,
  inventoryTracking: false,
});
const NOW = new Date('2026-11-02T12:00:00.000Z');

function subscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    account_status: 'active',
    id: 'sub-1',
    plan_code: 'starter',
    status: 'trial',
    trial_ends_at: '2026-11-10T00:00:00.000Z',
    current_period_end: null,
    cancel_at_period_end: 0,
    grace_period_end: null,
    entitlements_json: entitlements,
    ...overrides,
  };
}

async function run() {
  const trialDb = new AccessDb(subscriptionRow());
  const trial = await resolveOrganizationAccess(trialDb, 'org-1', NOW);
  assert.equal(trial.allowed, true, 'Active Starter trial permits use before expiry');
  assert.equal(trial.planCode, 'starter');
  assert.equal(trial.entitlements.maxTerminals, 1);
  assert.equal(trial.entitlements.kdsStations, false);

  const expiredTrialDb = new AccessDb(subscriptionRow({ trial_ends_at: '2026-10-30T00:00:00.000Z' }));
  const expiredTrial = await resolveOrganizationAccess(expiredTrialDb, 'org-1', NOW);
  assert.equal(expiredTrial.allowed, false, 'Expired trial blocks operational API access');
  assert.equal(expiredTrial.subscriptionStatus, 'expired');
  assert.equal(expiredTrialDb.row.status, 'expired');
  assert.equal(expiredTrialDb.events.length, 1, 'Trial expiry is recorded once');

  const graceDb = new AccessDb(subscriptionRow({
    status: 'active',
    trial_ends_at: null,
    current_period_end: '2026-11-01T12:00:00.000Z',
  }));
  const grace = await resolveOrganizationAccess(graceDb, 'org-1', NOW);
  assert.equal(grace.allowed, true, 'Recently expired paid period enters grace');
  assert.equal(grace.subscriptionStatus, 'grace_period');
  assert.equal(graceDb.row.status, 'grace_period');
  assert.equal(graceDb.row.grace_period_end, '2026-11-08T12:00:00.000Z');

  const oldPeriodDb = new AccessDb(subscriptionRow({
    status: 'active',
    trial_ends_at: null,
    current_period_end: '2026-10-20T12:00:00.000Z',
  }));
  const oldPeriod = await resolveOrganizationAccess(oldPeriodDb, 'org-1', NOW);
  assert.equal(oldPeriod.allowed, false, 'Paid period expired beyond grace is blocked');
  assert.equal(oldPeriod.subscriptionStatus, 'suspended');
  assert.equal(oldPeriodDb.row.status, 'suspended');

  const pastDueDb = new AccessDb(subscriptionRow({
    status: 'past_due',
    trial_ends_at: null,
    grace_period_end: '2026-11-01T00:00:00.000Z',
  }));
  const pastDue = await resolveOrganizationAccess(pastDueDb, 'org-1', NOW);
  assert.equal(pastDue.allowed, false, 'Past-due account after grace is blocked');
  assert.equal(pastDueDb.row.status, 'suspended');

  const suspendedDb = new AccessDb(subscriptionRow({ account_status: 'suspended' }));
  const suspended = await resolveOrganizationAccess(suspendedDb, 'org-1', NOW);
  assert.equal(suspended.allowed, false, 'Platform-suspended organization is blocked');

  const legacyDb = new AccessDb({
    account_status: 'active', id: null, plan_code: null, status: null, entitlements_json: null,
  });
  const legacy = await resolveOrganizationAccess(legacyDb, 'legacy-org', NOW);
  assert.equal(legacy.allowed, true, 'Legacy tenants without a subscription row preserve existing access');
  assert.equal(legacy.planCode, 'legacy');
  assert.equal(legacy.entitlements.multiOutlet, true);

  assert.equal(requiredPlanFeature('/api/branches', 'POST'), 'multiOutlet');
  assert.equal(requiredPlanFeature('/api/kitchen/tickets', 'GET'), 'kdsStations');
  assert.equal(requiredPlanFeature('/api/analytics/overview', 'GET'), 'advancedReports');
  assert.equal(requiredPlanFeature('/api/transfers', 'POST'), 'inventoryTracking');
  assert.equal(requiredPlanFeature('/api/orders', 'POST'), null);

  console.log('Cloud subscription entitlement and lifecycle tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
