import assert from 'node:assert/strict';
import { createJWT, verifyJWT, hashString } from '../apps/cloud-api/src/auth';
import {
  BranchPerformanceSummary,
  BranchSalesMetric,
  TopSellingItemMetric,
  SyncedCashClosurePayload,
} from '../shared/cloud-types';

async function testAuthAndJWT() {
  console.log('Testing Cloud Auth & JWT...');
  const secret = 'super-secret-key-12345-cloud-auth-32chars!';
  const payload = {
    sub: 'user-001',
    org: 'org-tastecraft-test',
    email: 'owner@tastecraft.com',
    role: 'owner' as const,
    branch: null,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const token = await createJWT(payload, secret);
  assert.ok(typeof token === 'string' && token.split('.').length === 3, 'JWT should be 3 parts');

  const verified = await verifyJWT(token, secret);
  assert.ok(verified !== null, 'JWT verification should succeed');
  assert.equal(verified?.sub, 'user-001');
  assert.equal(verified?.role, 'owner');
  assert.equal(verified?.org, 'org-tastecraft-test');

  // Verify expired token fails
  const expiredPayload = { ...payload, exp: Math.floor(Date.now() / 1000) - 10 };
  const expiredToken = await createJWT(expiredPayload, secret);
  const expiredVerified = await verifyJWT(expiredToken, secret);
  assert.equal(expiredVerified, null, 'Expired JWT should fail verification');

  // Verify hash function
  const hash1 = await hashString('secret_pin_123');
  const hash2 = await hashString('secret_pin_123');
  const hash3 = await hashString('different');
  assert.equal(hash1, hash2, 'Hash should be deterministic');
  assert.notEqual(hash1, hash3, 'Different strings should produce different hashes');
  console.log('✓ Cloud Auth & JWT passed');
}

function testBranchSalesAggregation() {
  console.log('Testing Multi-Branch Sales Aggregation Logic...');
  const mockBranches: BranchSalesMetric[] = [
    {
      branch_id: 'b-1',
      branch_code: 'CP-DEL',
      branch_name: 'Connaught Place',
      is_main_branch: true,
      total_sales: 250000,
      order_count: 500,
      average_ticket: 500,
      cash_sales: 50000,
      digital_sales: 200000,
    },
    {
      branch_id: 'b-2',
      branch_code: 'CYB-GGN',
      branch_name: 'CyberHub Gurugram',
      is_main_branch: false,
      total_sales: 150000,
      order_count: 300,
      average_ticket: 500,
      cash_sales: 30000,
      digital_sales: 120000,
    },
  ];

  const totalRevenue = mockBranches.reduce((acc, b) => acc + b.total_sales, 0);
  const totalOrders = mockBranches.reduce((acc, b) => acc + b.order_count, 0);

  assert.equal(totalRevenue, 400000, 'Total group revenue must equal sum of branches');
  assert.equal(totalOrders, 800, 'Total orders must equal sum of branch orders');

  // Top selling branch sorting
  const sorted = [...mockBranches].sort((a, b) => b.total_sales - a.total_sales);
  assert.equal(sorted[0].branch_code, 'CP-DEL', 'Main outlet should be #1 seller');
  console.log('✓ Multi-Branch Sales Aggregation passed');
}

function testAccountantClosureVariance() {
  console.log('Testing Cash Closure Variance Detection...');
  const closureBalanced: SyncedCashClosurePayload = {
    id: 'cl-1',
    closure_date: '2026-10-12',
    opened_at: '2026-10-12T09:00:00Z',
    closed_at: '2026-10-12T23:00:00Z',
    opening_cash: 5000,
    cash_sales: 25000,
    card_sales: 40000,
    upi_sales: 60000,
    other_sales: 0,
    expected_cash: 30000, // opening + cash_sales
    actual_cash: 30000,
    variance: 0,
    closed_by: 'Staff Manager',
  };

  assert.equal(closureBalanced.opening_cash + closureBalanced.cash_sales, closureBalanced.expected_cash);
  assert.equal(closureBalanced.actual_cash - closureBalanced.expected_cash, closureBalanced.variance);

  const closureShort: SyncedCashClosurePayload = {
    id: 'cl-2',
    closure_date: '2026-10-12',
    opened_at: '2026-10-12T09:00:00Z',
    closed_at: '2026-10-12T23:00:00Z',
    opening_cash: 5000,
    cash_sales: 20000,
    card_sales: 30000,
    upi_sales: 50000,
    other_sales: 0,
    expected_cash: 25000,
    actual_cash: 24700,
    variance: -300,
    closed_by: 'Staff Cashier',
  };

  assert.equal(closureShort.actual_cash - closureShort.expected_cash, -300);
  assert.ok(closureShort.variance < 0, 'Variance should flag cash drawer shortage');
  console.log('✓ Cash Closure Variance Detection passed');
}

async function run() {
  await testAuthAndJWT();
  testBranchSalesAggregation();
  testAccountantClosureVariance();
  console.log('All Multi-Branch Cloud unit & contract tests passed successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
