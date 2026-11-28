import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { PRICING_PLANS as LANDING_PLANS } from '../landing/src/lib/constants';
import { PRICING_PLANS as SERVER_PLANS } from '../main/routes/subscription';
import { PLAN_DEFINITIONS } from '../main/services/subscription';

function run(): void {
  // 1. Apply all D1 migrations in-memory and verify saas_plans rows
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const migrationDir = path.resolve(__dirname, '../apps/cloud-api/migrations');
  const migrations = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
  for (const m of migrations) {
    db.exec(fs.readFileSync(path.join(migrationDir, m), 'utf8'));
  }

  const rows = db.prepare(
    'SELECT code, monthly_price_minor, yearly_price_minor, entitlements_json FROM saas_plans ORDER BY sort_order'
  ).all() as Array<{
    code: string;
    monthly_price_minor: number;
    yearly_price_minor: number;
    entitlements_json: string;
  }>;

  const byCode = new Map(rows.map((r) => [r.code, r]));

  const expected = {
    starter: { monthly: 499, yearly: 4990, maxTerminals: 1 },
    pro: { monthly: 1499, yearly: 14990, maxTerminals: 3 },
    enterprise: { monthly: 3999, yearly: 39990, maxTerminals: 9999 },
  } as const;

  for (const [code, exp] of Object.entries(expected)) {
    const d1Row = byCode.get(code);
    assert.ok(d1Row, `D1 saas_plans missing ${code}`);
    assert.equal(d1Row.monthly_price_minor, exp.monthly * 100, `D1 ${code} monthly_price_minor mismatch`);
    assert.equal(d1Row.yearly_price_minor, exp.yearly * 100, `D1 ${code} yearly_price_minor mismatch`);
    const entitlements = JSON.parse(d1Row.entitlements_json);
    assert.equal(entitlements.maxTerminals, exp.maxTerminals, `D1 ${code} maxTerminals mismatch`);

    // Landing constants parity
    const landingPlan = LANDING_PLANS.find((p) => p.id === code);
    assert.ok(landingPlan, `Landing PRICING_PLANS missing ${code}`);
    assert.equal(landingPlan.monthlyPrice, exp.monthly, `Landing ${code} monthlyPrice mismatch`);
    assert.equal(landingPlan.yearlyPrice, exp.yearly, `Landing ${code} yearlyPrice mismatch`);

    // Local Express subscription route parity
    const serverPlan = SERVER_PLANS[code as keyof typeof SERVER_PLANS];
    assert.equal(serverPlan.monthly, exp.monthly, `Server ${code} monthly mismatch`);
    assert.equal(serverPlan.yearly, exp.yearly, `Server ${code} yearly mismatch`);

    // Local SubscriptionService entitlements parity
    const servicePlan = PLAN_DEFINITIONS[code as keyof typeof PLAN_DEFINITIONS];
    assert.equal(servicePlan.maxTerminals, exp.maxTerminals, `SubscriptionService ${code} maxTerminals mismatch`);
  }

  console.log('cloud-saas-plan-prices.test.ts PASSED');
}

run();
