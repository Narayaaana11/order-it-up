/**
 * Aggregator & Dynamic UPI Integration Test Suite
 *
 * Covers:
 * 1. Webhook HMAC-SHA256 signature verification.
 * 2. Auto-accept outbound status synchronization.
 * 3. Kitchen status transitions (accept, ready, dispatch, reject) syncing to aggregator adapter.
 * 4. Outbox persistence, error handling, and retry mechanics.
 * 5. Dynamic NPCI UPI QR code generation & VPA validation.
 * 6. UPI payment reconciliation (soundbox / webhook / direct UTR matching).
 *
 * Usage: node tests/run-electron-node-test.cjs tests/aggregators-upi.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-agg-upi-test-'));
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser, seedCategory, seedProduct,
  api, assert, assertEqual,
  closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');
const {
  swiggyMockAdapter,
  zomatoMockAdapter,
  initAggregatorSimulators,
} = require('../main/services/aggregator-simulator');
const { isValidVpa, generateUpiUri } = require('../main/services/upi');

async function main() {
  console.log('=== Aggregator Outbound Sync & Dynamic UPI Test Suite ===\n');

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  // Initialize and clear mock adapters
  initAggregatorSimulators();
  swiggyMockAdapter.clearRecordedActions();
  zomatoMockAdapter.clearRecordedActions();

  // Configure webhook signing secrets
  const webhookSecret = 'test-secret-12345';
  db.prepare("UPDATE aggregator_configs SET webhook_secret = ?, is_enabled = 1, auto_accept = 1 WHERE platform = 'swiggy'").run(webhookSecret);
  db.prepare("UPDATE aggregator_configs SET webhook_secret = ?, is_enabled = 1, auto_accept = 0 WHERE platform = 'zomato'").run(webhookSecret);

  // Configure restaurant UPI settings
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('upi_id', 'tandoornights@icici')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_name', 'Tandoor Nights')").run();

  // Seed Menu
  seedCategory(db, 'cat-main', 'Mains');
  seedProduct(db, 'prod-butter-chicken', 'cat-main', 'Butter Chicken', 350, { track_inventory: true, stock_quantity: 50 });
  seedProduct(db, 'prod-naan', 'cat-main', 'Butter Naan', 40, { track_inventory: true, stock_quantity: 100 });

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  const signedHeaders = (platform: 'swiggy' | 'zomato', payload: any) => ({
    [platform === 'swiggy' ? 'x-swiggy-signature' : 'x-zomato-signature']:
      crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex'),
  });

  try {
    // ── 1. Webhook HMAC Validation ─────────────────────────────────────────
    console.log('\n--- 1. Webhook HMAC Security ---');
    const orderPayload = {
      order_id: 'SW-ORD-101',
      customer: { name: 'Rahul Dravid', phone: '+919876500001' },
      items: [{ item_id: 'prod-butter-chicken', name: 'Butter Chicken', quantity: 1, price: 350 }],
      bill_details: { subtotal: 350, packaging_charge: 20, taxes: 17.5, total: 387.5 },
      prep_time: 25,
    };

    // Unsigned or bad signature should be rejected (401)
    const badSigRes = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: orderPayload,
      headers: { 'x-swiggy-signature': 'invalid_signature_hex' },
    });
    assertEqual(badSigRes.status, 401, 'Invalid signature rejected with 401');

    // Valid signature should be accepted (200)
    const validSigRes = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: orderPayload,
      headers: signedHeaders('swiggy', orderPayload),
    });
    assertEqual(validSigRes.status, 200, 'Valid signature accepted with 200');
    assertEqual(validSigRes.data.swiggy_order_id, 'SW-ORD-101', 'Order ingested');
    const swiggyOrderId = validSigRes.data.order_id;

    // Verify auto-accept triggered outbound adapter
    const swiggyActions = swiggyMockAdapter.getRecordedActions();
    assert(swiggyActions.length >= 1, 'Auto-accept dispatched to Swiggy adapter');
    const autoAcceptAction = swiggyActions.find((a: any) => a.action === 'accept' && a.externalOrderId === 'SW-ORD-101');
    assert(Boolean(autoAcceptAction), 'Found recorded accept action for SW-ORD-101');

    // ── 2. Manual Kitchen Actions & Outbound Sync ───────────────────────────
    console.log('\n--- 2. Manual Kitchen Status Transitions ---');

    // Zomato order with auto_accept = 0 (manual accept required)
    const zmPayload = {
      order_id: 'ZM-ORD-202',
      customer: { name: 'Anushka Sharma', phone: '+919876500002' },
      items: [{ item_id: 'prod-naan', name: 'Butter Naan', quantity: 2, price: 40 }],
      bill: { subtotal: 80, taxes: 4, total: 84 },
    };

    const zmIngestRes = await api(baseUrl, '/api/webhooks/zomato/order', {
      method: 'POST',
      body: zmPayload,
      headers: signedHeaders('zomato', zmPayload),
    });
    assertEqual(zmIngestRes.status, 200, 'Zomato order ingested');
    assertEqual(zmIngestRes.data.kitchen_status, 'pending', 'Order is pending manual accept');
    const zmOrderId = zmIngestRes.data.order_id;

    // Staff accepts Zomato order
    zomatoMockAdapter.clearRecordedActions();
    const acceptRes = await api(baseUrl, `/api/aggregators/orders/${zmOrderId}/accept`, {
      method: 'POST',
      body: { prep_time_minutes: 15 },
      headers: authHeader,
    });
    assertEqual(acceptRes.status, 200, 'Staff accepted Zomato order');
    assertEqual(acceptRes.data.outbound?.status, 'sent', 'Outbound accept sent immediately');

    const zmRecordedAccept = zomatoMockAdapter.getRecordedActions();
    assertEqual(zmRecordedAccept.length, 1, 'Zomato adapter received 1 action');
    assertEqual(zmRecordedAccept[0].action, 'accept', 'Action is accept');
    assertEqual(zmRecordedAccept[0].externalOrderId, 'ZM-ORD-202', 'External order id matches');
    assertEqual(zmRecordedAccept[0].payload.prep_time_minutes, 15, 'Prep time passed to adapter');

    // Staff marks ready
    const readyRes = await api(baseUrl, `/api/aggregators/orders/${zmOrderId}/ready`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(readyRes.status, 200, 'Staff marked food ready');
    assertEqual(readyRes.data.outbound?.status, 'sent', 'Outbound ready sent');

    // Staff dispatches order
    const dispatchRes = await api(baseUrl, `/api/aggregators/orders/${zmOrderId}/dispatch`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(dispatchRes.status, 200, 'Staff marked order dispatched');
    assertEqual(dispatchRes.data.outbound?.status, 'sent', 'Outbound dispatch sent');

    // Staff rejects an order
    const zmRejectPayload = {
      order_id: 'ZM-ORD-203',
      items: [{ item_id: 'prod-naan', name: 'Butter Naan', quantity: 1, price: 40 }],
      bill: { total: 40 },
    };
    const zmRejectIngest = await api(baseUrl, '/api/webhooks/zomato/order', {
      method: 'POST',
      body: zmRejectPayload,
      headers: signedHeaders('zomato', zmRejectPayload),
    });
    const zmRejectOrderId = zmRejectIngest.data.order_id;

    const rejectRes = await api(baseUrl, `/api/aggregators/orders/${zmRejectOrderId}/reject`, {
      method: 'POST',
      body: { reason: 'Kitchen oven maintenance' },
      headers: authHeader,
    });
    assertEqual(rejectRes.status, 200, 'Order rejected');
    assertEqual(rejectRes.data.outbound?.status, 'sent', 'Outbound reject sent');

    // ── 3. Outbox Failure & Retry Mechanics ─────────────────────────────────
    console.log('\n--- 3. Outbox Failure & Retry Mechanics ---');
    swiggyMockAdapter.setSimulatedFailure('ready', 'Connection timeout to Swiggy gateway');

    const swiggyReadyRes = await api(baseUrl, `/api/aggregators/orders/${swiggyOrderId}/ready`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(swiggyReadyRes.status, 200, 'Ready marked locally despite external network fault');
    assertEqual(swiggyReadyRes.data.outbound?.status, 'pending', 'Outbound status remains pending on error');
    assert(swiggyReadyRes.data.outbound?.error?.includes('timeout'), 'Captured network error in outbox');

    // Inspect Outbox via API
    const outboxListRes = await api(baseUrl, '/api/aggregators/outbox?status=pending', {
      headers: authHeader,
    });
    assertEqual(outboxListRes.status, 200, 'Fetched outbox items');
    const pendingItem = outboxListRes.data.outbox.find((i: any) => i.external_order_id === 'SW-ORD-101' && i.action === 'ready');
    assert(Boolean(pendingItem), 'Pending outbox item visible in management endpoint');
    assertEqual(pendingItem.attempts, 1, 'Attempt counter incremented');

    // Clear network failure and retry outbox
    swiggyMockAdapter.setSimulatedFailure('ready', undefined);
    const retryRes = await api(baseUrl, '/api/aggregators/outbox/retry', {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(retryRes.status, 200, 'Outbox retry endpoint returned 200');
    assert(retryRes.data.succeeded >= 1, 'Retried pending items successfully');

    // Verify row transitioned to sent
    const checkDb = db.prepare('SELECT status, last_error FROM aggregator_outbox WHERE id = ?').get(pendingItem.id) as any;
    assertEqual(checkDb.status, 'sent', 'Outbox row status updated to sent in SQLite');
    assertEqual(checkDb.last_error, null, 'Error cleared on successful retry');

    // ── 4. Dynamic UPI QR Code & VPA Validation ─────────────────────────────
    console.log('\n--- 4. Dynamic UPI QR Code & VPA Validation ---');
    assert(isValidVpa('restaurant@icici'), 'Valid VPA restaurant@icici accepted');
    assert(isValidVpa('merchant.store-1@oksbi'), 'Valid VPA with dots and hyphens accepted');
    assert(!isValidVpa('invalid_vpa_without_domain'), 'Invalid VPA rejected');
    assert(!isValidVpa(''), 'Empty VPA rejected');

    const uri = generateUpiUri({
      vpa: 'tandoornights@icici',
      merchantName: 'Tandoor Nights',
      amount: 420.50,
      billNumber: 'INV-2026-001',
      tr: 'INV-2026-001',
    });
    assert(uri.startsWith('upi://pay?'), 'URI starts with upi://pay?');
    assert(uri.includes('pa=tandoornights%40icici'), 'URI includes encoded VPA');
    assert(uri.includes('am=420.50'), 'URI includes formatted amount');
    assert(uri.includes('cu=INR'), 'URI includes INR currency');
    assert(uri.includes('tr=INV-2026-001'), 'URI includes transaction reference');

    // Create a local dine-in order and bill
    const orderRes = db.prepare(`
      INSERT INTO orders (order_number, type, status, subtotal, tax_amount, total)
      VALUES ('ORD-DINE-001', 'dine_in', 'served', 400, 20, 420)
    `).run();
    const dineOrderId = Number(orderRes.lastInsertRowid);

    const billRes = db.prepare(`
      INSERT INTO bills (order_id, bill_number, subtotal, tax_amount, total, payment_status)
      VALUES (?, 'INV-DINE-001', 400, 20, 420, 'unpaid')
    `).run(dineOrderId);
    const dineBillId = Number(billRes.lastInsertRowid);

    // Call dynamic UPI QR endpoint
    const upiQrRes = await api(baseUrl, `/api/bills/${dineBillId}/upi-qr`, {
      headers: authHeader,
    });
    assertEqual(upiQrRes.status, 200, 'UPI QR endpoint returned 200');
    assertEqual(upiQrRes.data.bill_id, dineBillId, 'Returned bill_id');
    assertEqual(upiQrRes.data.amount, 420, 'Returned amount');
    assertEqual(upiQrRes.data.vpa, 'tandoornights@icici', 'Returned configured VPA');
    assertEqual(upiQrRes.data.vpa_valid, true, 'VPA is marked valid');
    assert(upiQrRes.data.qr_data_url.startsWith('data:image/png;base64,'), 'Generated base64 QR PNG');
    assertEqual(upiQrRes.data.is_paid, false, 'Bill is initially unpaid');

    // ── 5. UPI Payment Reconciliation ───────────────────────────────────────
    console.log('\n--- 5. UPI Payment Reconciliation ---');

    // Check status before payment
    const statusBefore = await api(baseUrl, `/api/bills/${dineBillId}/upi-status`, {
      headers: authHeader,
    });
    assertEqual(statusBefore.status, 200, 'UPI status endpoint returned 200');
    assertEqual(statusBefore.data.is_paid, false, 'is_paid is false before reconciliation');

    // Simulate soundbox / webhook reconciliation
    const reconcileRes = await api(baseUrl, `/api/bills/${dineBillId}/upi-reconcile`, {
      method: 'POST',
      body: {
        utr: '612345678901',
        amount: 420,
        payer_vpa: 'customer99@okhdfcbank',
        status: 'SUCCESS',
        soundbox_id: 'SBX-IND-042',
      },
      headers: authHeader,
    });
    assertEqual(reconcileRes.status, 200, 'Reconciliation endpoint returned 200');
    assertEqual(reconcileRes.data.success, true, 'Payment reconciled successfully');
    assertEqual(reconcileRes.data.utr, '612345678901', 'UTR returned');

    // Verify bill is now paid
    const statusAfter = await api(baseUrl, `/api/bills/${dineBillId}/upi-status`, {
      headers: authHeader,
    });
    assertEqual(statusAfter.data.is_paid, true, 'is_paid is true after reconciliation');
    assertEqual(statusAfter.data.upi_details.method, 'upi', 'Payment method in upi_details is upi');
    assertEqual(statusAfter.data.upi_details.utr, '612345678901', 'Stored UTR in payment details');

    // Idempotent reconciliation
    const idempotencyRes = await api(baseUrl, `/api/bills/${dineBillId}/upi-reconcile`, {
      method: 'POST',
      body: {
        utr: '612345678901',
        amount: 420,
        status: 'SUCCESS',
      },
      headers: authHeader,
    });
    assertEqual(idempotencyRes.status, 200, 'Idempotent call succeeds');
    assertEqual(idempotencyRes.data.alreadyPaid, true, 'alreadyPaid flagged on repeat reconciliation');

    // Webhook reconciliation by bill_number
    const bill2Res = db.prepare(`
      INSERT INTO bills (order_id, bill_number, subtotal, tax_amount, total, payment_status)
      VALUES (?, 'INV-DINE-002', 200, 10, 210, 'unpaid')
    `).run(dineOrderId);
    const bill2Id = Number(bill2Res.lastInsertRowid);

    const webhookRes = await api(baseUrl, '/api/webhooks/upi', {
      method: 'POST',
      body: {
        bill_number: 'INV-DINE-002',
        amount: 210,
        utr: '612345678902',
        status: 'SUCCESS',
      },
    });
    assertEqual(webhookRes.status, 200, 'UPI Webhook reconciled payment by bill_number');
    assertEqual(webhookRes.data.billId, bill2Id, 'Matched correct bill ID');

    const bill2Row = db.prepare('SELECT payment_status FROM bills WHERE id = ?').get(bill2Id) as any;
    assertEqual(bill2Row.payment_status, 'paid', 'Bill 2 marked paid in SQLite');

    // Audit trail verification
    const auditRow = db.prepare("SELECT * FROM audit_log WHERE action = 'BILL_PAYMENT' AND entity_id = ?").get(String(dineBillId)) as any;
    assert(Boolean(auditRow), 'Audit log entry created for reconciled UPI bill payment');
    assertEqual(auditRow.actor_user_id, 'SYSTEM_UPI', 'Actor recorded as SYSTEM_UPI');

    console.log('\nAll Aggregator & Dynamic UPI tests completed successfully!');
  } finally {
    server.close();
    closeDatabase();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
