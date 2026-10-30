// tests/live-staging-smoke-c12.mjs
// Real deployed smoke test suite executing against https://orderitup-cloud-api-staging.narayaaana11.workers.dev

const STAGING_URL = 'https://orderitup-cloud-api-staging.narayaaana11.workers.dev';
const ALLOWED_ORIGIN = 'https://staging.orderitup.in';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runSmokeTests() {
  console.log(`\n===============================================================`);
  console.log(`STARTING LIVE STAGING SMOKE TEST SUITE`);
  console.log(`Target: ${STAGING_URL}`);
  console.log(`===============================================================\n`);

  const runId = Date.now().toString(36);

  // 1. Health endpoint
  console.log(`[Test 1] Health Endpoint`);
  const healthRes = await fetch(`${STAGING_URL}/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200, `Health endpoint returns 200 (got ${healthRes.status})`);
  assert(healthData.status === 'operational', `Health reports operational`);

  // 2. CORS handling
  console.log(`\n[Test 2] CORS Policy Verification`);
  const corsValidRes = await fetch(`${STAGING_URL}/api/branches`, {
    method: 'OPTIONS',
    headers: { 'Origin': ALLOWED_ORIGIN }
  });
  assert(corsValidRes.headers.get('access-control-allow-origin') === ALLOWED_ORIGIN, `Allowed origin reflected in CORS header`);

  const corsInvalidRes = await fetch(`${STAGING_URL}/api/branches`, {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://evil-hacker-site.com' }
  });
  assert(corsInvalidRes.headers.get('access-control-allow-origin') !== 'https://evil-hacker-site.com', `Malicious origin disallowed / not reflected`);

  // 3. Missing and invalid authentication
  console.log(`\n[Test 3] Authentication Enforcement`);
  const noAuthRes = await fetch(`${STAGING_URL}/api/branches`);
  assert(noAuthRes.status === 401, `Missing auth returns 401 (got ${noAuthRes.status})`);

  const badAuthRes = await fetch(`${STAGING_URL}/api/branches`, {
    headers: { 'Authorization': 'Bearer bad.token.here' }
  });
  assert(badAuthRes.status === 401, `Invalid auth returns 401 (got ${badAuthRes.status})`);

  // 4. SaaS Registration (Tenant A)
  console.log(`\n[Test 4] SaaS Registration (Tenant A)`);
  const regEmail = `owner_${runId}@staging-smoke.com`;
  const regRes = await fetch(`${STAGING_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: regEmail,
      password: 'StagingSecurePassword123!',
      owner_name: 'Staging Owner A',
      restaurant_name: `Smoke Bistro ${runId}`,
      currency: 'INR'
    })
  });
  const regData = await regRes.json();
  assert(regRes.status === 201, `SaaS registration succeeds with 201 (got ${regRes.status})`);
  assert(!!regData.token, `Registration returns JWT token`);
  assert(!!regData.user?.organization_id, `Returns organization ID`);
  assert(!!regData.restaurant?.id, `Returns restaurant ID`);
  assert(!!regData.branch?.id, `Returns default branch ID`);

  const tokenA = regData.token;
  const orgIdA = regData.user.organization_id;
  const restIdA = regData.restaurant.id;
  const branchIdA = regData.branch.id;

  // 5. Restaurant and Branch Selection
  console.log(`\n[Test 5] Restaurant & Branch Management`);
  const restListRes = await fetch(`${STAGING_URL}/api/restaurants`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const restListData = await restListRes.json();
  assert(restListRes.status === 200, `List restaurants returns 200`);
  assert(restListData.restaurants.some(r => r.id === restIdA), `Lists created restaurant`);

  // Create second branch for tenant A
  const branchCreateRes = await fetch(`${STAGING_URL}/api/branches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      restaurant_id: restIdA,
      name: `Smoke Bistro Uptown ${runId}`,
      currency: 'INR'
    })
  });
  const branchCreateData = await branchCreateRes.json();
  assert(branchCreateRes.status === 201, `Creates second branch with 201`);
  const branchIdA2 = branchCreateData.branch.id;

  // 6. Cross-Tenant Rejection (Tenant B)
  console.log(`\n[Test 6] Tenant Isolation & Cross-Tenant Rejection`);
  const regEmailB = `owner_b_${runId}@staging-smoke.com`;
  const regBRes = await fetch(`${STAGING_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: regEmailB,
      password: 'StagingSecurePassword123!',
      owner_name: 'Staging Owner B',
      restaurant_name: `Smoke Competitor Diner ${runId}`
    })
  });
  const regBData = await regBRes.json();
  const tokenB = regBData.token;

  // Tenant B attempts to access Tenant A's branch
  const crossTenantRes = await fetch(`${STAGING_URL}/api/orders?branch_id=${branchIdA}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(crossTenantRes.status === 403, `Cross-tenant branch access rejected with 403 (got ${crossTenantRes.status})`);

  // 7. Catalog Price Authority & Order Creation
  console.log(`\n[Test 7] Catalog Price Authority`);
  // First, seed a master product for Org A
  const catRes = await fetch(`${STAGING_URL}/api/branches/${branchIdA}/catalog`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const catData = await catRes.json();
  // Check if seeded catalog has items or use one from default starter
  let masterProduct = catData.products?.[0];
  if (!masterProduct) {
    // If not in catalog route, get products from demo catalog or create one
    console.log(`  Seeded products in branch catalog: ${catData.products?.length || 0}`);
  }

  // Ordinary order with unlisted product ID must be rejected!
  const unlistedOrderRes = await fetch(`${STAGING_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      branch_id: branchIdA,
      order_type: 'dine_in',
      items: [
        {
          product_id: 'totally-fake-unlisted-id-999',
          name: 'Hacked Cheap Steak',
          price: 1.00,
          quantity: 1
        }
      ]
    })
  });
  assert(unlistedOrderRes.status === 400, `Unlisted item rejected for ordinary cloud order with 400 (got ${unlistedOrderRes.status})`);
  const unlistedErr = await unlistedOrderRes.json();
  assert(unlistedErr.error.includes('Catalog verification failed') || unlistedErr.error.includes('not found'), `Error mentions catalog rejection`);

  // Create valid master product via demo seed or branch catalog
  // Let's create an order using one of the starter seeded products
  const starterRes = await fetch(`${STAGING_URL}/api/catalog/master`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const starterCat = await starterRes.json();
  const validProduct = starterCat.products?.[0];
  assert(!!validProduct, `Tenant has starter catalog product: ${validProduct?.name} (₹${validProduct?.base_price})`);

  // 8. Order Creation with Authoritative Price
  console.log(`\n[Test 8] Server-Authoritative Order Creation`);
  const orderRes = await fetch(`${STAGING_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      branch_id: branchIdA,
      order_type: 'dine_in',
      items: [
        {
          product_id: validProduct.id,
          name: validProduct.name,
          price: 0.01, // Client tries to pay 1 paisa instead of base price!
          quantity: 2
        }
      ]
    })
  });
  const orderData = await orderRes.json();
  assert(orderRes.status === 201, `Order created with 201`);
  const orderId = orderData.order.id;
  const expectedSubtotal = validProduct.base_price * 2;
  assert(Math.abs(orderData.order.subtotal - expectedSubtotal) < 0.01, `Server enforced catalog price (subtotal=${orderData.order.subtotal}, expected=${expectedSubtotal})`);

  // 9. Dine-In Tables & Kitchen Ticket Bump Workflow
  console.log(`\n[Test 9] Dine-in Tables & Kitchen Tickets`);
  const tableRes = await fetch(`${STAGING_URL}/api/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      branch_id: branchIdA,
      table_number: `T-${runId}`,
      capacity: 4
    })
  });
  const tableData = await tableRes.json();
  assert(tableRes.status === 201, `Table created with 201`);
  const tableId = tableData.table.id;

  // Retrieve kitchen ticket from order or kitchen queue
  const kdsRes = await fetch(`${STAGING_URL}/api/kitchen/tickets?branch_id=${branchIdA}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const kdsData = await kdsRes.json();
  assert(kdsRes.status === 200, `List kitchen tickets returns 200`);
  const ticket = kdsData.tickets?.find(t => t.order_id === orderId) || { id: orderData.order.kitchen_ticket_id, status: 'pending' };
  assert(!!ticket?.id, `Kitchen ticket exists for order`);
  const ticketId = ticket.id;

  // Bump kitchen ticket to preparing
  const bumpRes = await fetch(`${STAGING_URL}/api/kitchen/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'preparing' })
  });
  const bumpData = await bumpRes.json();
  assert(bumpRes.status === 200, `Ticket bumped to preparing with 200`);
  assert(bumpData.ticket.status === 'preparing', `Ticket status is preparing`);

  // 10. Split Customer Payments & Verification Method Ledger
  console.log(`\n[Test 10] Split Payments & Payment Verification Ledger`);
  const totalAmount = orderData.order.grand_total;
  const split1 = Math.floor(totalAmount / 2);
  const split2 = totalAmount - split1;

  // Payment 1: Cash
  const pay1Res = await fetch(`${STAGING_URL}/api/orders/${orderId}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: split1,
      payment_method: 'cash'
    })
  });
  const pay1Data = await pay1Res.json();
  assert(pay1Res.status === 201, `Payment 1 (Cash) created with 201`);
  assert(pay1Data.payment.verification_method === 'cashier_collected', `Cash verified as cashier_collected`);
  assert(pay1Data.order_payment_status === 'partially_paid', `Order payment status is partially_paid`);

  // Payment 2: Manual UPI
  const pay2Res = await fetch(`${STAGING_URL}/api/orders/${orderId}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: split2,
      payment_method: 'upi',
      external_reference_id: `UPI-UTR-${runId}`,
      verification_method: 'manual_cashier_confirmed'
    })
  });
  const pay2Data = await pay2Res.json();
  assert(pay2Res.status === 201, `Payment 2 (UPI) created with 201`);
  assert(pay2Data.payment.verification_method === 'manual_cashier_confirmed', `UPI verified as manual_cashier_confirmed`);
  assert(pay2Data.order_payment_status === 'paid', `Order payment status transitioned to paid`);

  const payment1Id = pay1Data.payment.id;

  // 11. Refund Limits & Idempotency
  console.log(`\n[Test 11] Refund Correctness & Idempotency`);
  const refundKey = `ref-idem-${runId}`;
  
  // Excessive refund rejected
  const badRefundRes = await fetch(`${STAGING_URL}/api/orders/${orderId}/payments/${payment1Id}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: split1 + 500, // Exceeds paid amount
      reason: 'Over-refund test'
    })
  });
  assert(badRefundRes.status === 400, `Excessive refund rejected with 400 (got ${badRefundRes.status})`);

  // Valid partial refund
  const refundAmt = Math.min(split1, 20);
  const goodRefundRes = await fetch(`${STAGING_URL}/api/orders/${orderId}/payments/${payment1Id}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: refundAmt,
      reason: 'Customer requested discount post-billing',
      idempotency_key: refundKey,
      refund_type: 'manual_cashier_refund'
    })
  });
  const goodRefundData = await goodRefundRes.json();
  assert(goodRefundRes.status === 200, `Refund succeeds with 200`);
  assert(goodRefundData.refund.refund_type === 'manual_manager_refund' || goodRefundData.refund.refund_type === 'manual_cashier_refund', `Refund type recorded (${goodRefundData.refund.refund_type})`);

  // Replay identical idempotency key
  const replayRefundRes = await fetch(`${STAGING_URL}/api/orders/${orderId}/payments/${payment1Id}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: refundAmt,
      idempotency_key: refundKey
    })
  });
  const replayRefundData = await replayRefundRes.json();
  assert(replayRefundRes.status === 200, `Replayed refund returns 200`);
  assert(replayRefundData.is_idempotent_replay === true || replayRefundData.refund?.id === goodRefundData.refund?.id, `Idempotent replay detected`);

  // 12. Optimistic Concurrency & Stale Version Rejection
  console.log(`\n[Test 12] Optimistic Concurrency Control`);
  // Try to update order with stale expected_version = 1
  const staleRes = await fetch(`${STAGING_URL}/api/orders/${orderId}/items`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      expected_version: 1, // Current version is already 3+ after payments
      items: [
        { product_id: validProduct.id, name: validProduct.name, price: validProduct.base_price, quantity: 1 }
      ]
    })
  });
  assert(staleRes.status === 409 || staleRes.status === 400, `Stale/conflict modification rejected (got ${staleRes.status})`);

  // 13. Cross-Device Visibility & Polling
  console.log(`\n[Test 13] Cross-Device Operational State Visibility`);
  const finalOrdersRes = await fetch(`${STAGING_URL}/api/orders?branch_id=${branchIdA}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const finalOrdersData = await finalOrdersRes.json();
  const fetchedOrder = finalOrdersData.orders?.find(o => o.id === orderId);
  assert(!!fetchedOrder, `Order visible in branch active orders list`);
  assert(fetchedOrder.payment_status === 'partially_paid' || fetchedOrder.payment_status === 'paid', `Order status reflects payment ledger (${fetchedOrder.payment_status})`);

  // 14. P0 Offline Payment Settlement Derivation & Integrity
  console.log(`\n[Test 14] P0 Offline Payment Settlement Derivation & Integrity`);
  // Generate pairing code & pair terminal
  const pairCodeRes = await fetch(`${STAGING_URL}/api/pairing/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      branch_id: branchIdA,
      terminal_name: `Smoke Terminal ${runId}`
    })
  });
  const pairCodeData = await pairCodeRes.json();
  assert(pairCodeRes.status === 200 && !!pairCodeData.code, `Pairing code generated`);

  const claimPairRes = await fetch(`${STAGING_URL}/api/pos/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: pairCodeData.code,
      device_fingerprint: `smoke-fp-${runId}`
    })
  });
  const claimPairData = await claimPairRes.json();
  assert(claimPairRes.status === 200 && !!claimPairData.terminal_token, `Terminal paired successfully`);
  const terminalToken = claimPairData.terminal_token;

  // 14a. Completed order with no payment status → unpaid; no payment ledger row
  const offlineUnpaidId = `ord-smoke-unpaid-${runId}`;
  const syncUnpaidRes = await fetch(`${STAGING_URL}/api/pos/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${terminalToken}`
    },
    body: JSON.stringify({
      events: [
        {
          id: `evt-unpaid-${runId}`,
          type: 'order.created',
          payload: {
            id: offlineUnpaidId,
            order_number: 'OFF-UNPAID',
            status: 'completed',
            // payment_status omitted
            subtotal: 100,
            tax_total: 0,
            discount_total: 0,
            grand_total: 100,
            ordered_at: new Date().toISOString(),
            items: [{ product_name: 'Test Unpaid Item', quantity: 1, unit_price: 100, subtotal: 100 }]
          }
        }
      ]
    })
  });
  assert(syncUnpaidRes.status === 200, `Sync unpaid order event ingested with 200`);

  const getUnpaidOrderRes = await fetch(`${STAGING_URL}/api/orders/${offlineUnpaidId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const unpaidOrderData = await getUnpaidOrderRes.json();
  assert(unpaidOrderData.order?.payment_status === 'unpaid', `Completed order with missing payment status remains unpaid (got ${unpaidOrderData.order?.payment_status})`);

  const getUnpaidPaymentsRes = await fetch(`${STAGING_URL}/api/orders/${offlineUnpaidId}/payments`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const unpaidPaymentsData = await getUnpaidPaymentsRes.json();
  assert(Array.isArray(unpaidPaymentsData.payments) && unpaidPaymentsData.payments.length === 0, `No payment ledger row created for completed order without payment status`);

  // 14b. Completed order with explicit valid offline settlement
  const offlineSettledId = `ord-smoke-settled-${runId}`;
  const syncSettledRes = await fetch(`${STAGING_URL}/api/pos/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${terminalToken}`
    },
    body: JSON.stringify({
      events: [
        {
          id: `evt-settled-${runId}`,
          type: 'order.created',
          payload: {
            id: offlineSettledId,
            order_number: 'OFF-SETTLED',
            status: 'completed',
            payment_status: 'paid',
            payment_method: 'cash',
            subtotal: 150,
            tax_total: 0,
            discount_total: 0,
            grand_total: 150,
            ordered_at: new Date().toISOString(),
            items: [{ product_name: 'Test Settled Item', quantity: 1, unit_price: 150, subtotal: 150 }]
          }
        }
      ]
    })
  });
  assert(syncSettledRes.status === 200, `Sync settled order event ingested with 200`);

  const getSettledOrderRes = await fetch(`${STAGING_URL}/api/orders/${offlineSettledId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const settledOrderData = await getSettledOrderRes.json();
  assert(settledOrderData.order?.payment_status === 'paid', `Settled order marked paid`);

  const getSettledPaymentsRes = await fetch(`${STAGING_URL}/api/orders/${offlineSettledId}/payments`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const settledPaymentsData = await getSettledPaymentsRes.json();
  assert(settledPaymentsData.payments?.length === 1, `Exactly one payment ledger row created for offline settlement`);
  assert(settledPaymentsData.payments[0].verification_method === 'cashier_collected', `Offline cash verified as cashier_collected`);

  // 14c. Dedicated payment.settled event
  const syncDedRes = await fetch(`${STAGING_URL}/api/pos/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${terminalToken}`
    },
    body: JSON.stringify({
      events: [
        {
          id: `evt-ded-${runId}`,
          type: 'payment.settled',
          payload: {
            order_id: offlineUnpaidId,
            amount: 100,
            payment_method: 'upi'
          }
        }
      ]
    })
  });
  assert(syncDedRes.status === 200, `Dedicated payment.settled event ingested with 200`);

  const getDedOrderRes = await fetch(`${STAGING_URL}/api/orders/${offlineUnpaidId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const dedOrderData = await getDedOrderRes.json();
  assert(dedOrderData.order?.payment_status === 'paid', `Order transitioned to paid after dedicated payment.settled event`);

  // 15. Active Order Lookup Branch Scope & Isolation
  console.log(`\n[Test 15] Active Order Lookup Branch Scope & Branch Isolation`);
  // Active order lookup with branchIdA and tableId
  const activeOrderResA = await fetch(`${STAGING_URL}/api/orders?branch_id=${branchIdA}&table_id=${tableId}&type=dine_in&status=pending,preparing,ready&limit=1`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(activeOrderResA.status === 200, `Active order lookup for branch A returns 200`);

  // Branch switch isolation: same tableId on branchIdA2 must NOT return branch A's order
  const activeOrderResB = await fetch(`${STAGING_URL}/api/orders?branch_id=${branchIdA2}&table_id=${tableId}&type=dine_in&status=pending,preparing,ready&limit=1`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const activeOrderDataB = await activeOrderResB.json();
  assert(activeOrderResB.status === 200, `Active order lookup for branch B returns 200`);
  assert(Array.isArray(activeOrderDataB.orders) && activeOrderDataB.orders.length === 0, `Branch switch does not leak previous branch's order`);

  // Missing branch_id returns honest error HTTP 400
  const missingBranchRes = await fetch(`${STAGING_URL}/api/orders?table_id=${tableId}&type=dine_in&status=pending,preparing,ready&limit=1`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(missingBranchRes.status === 400, `Missing branch_id returns HTTP 400 (got ${missingBranchRes.status})`);

  console.log(`\n===============================================================`);
  console.log(`LIVE STAGING SMOKE TEST SUITE COMPLETED`);
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch(err => {
  console.error('\n❌ Unhandled error in live smoke test suite:\n', err);
  process.exit(1);
});
