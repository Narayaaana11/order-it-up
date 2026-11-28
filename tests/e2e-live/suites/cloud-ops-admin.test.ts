import crypto from 'node:crypto';
import {
  type UnifiedBackendHarness,
  type UnifiedBackendHarnessOptions,
  startUnifiedBackend,
} from '../lib/unified-backend-harness';
import {
  assert,
  assertEqual,
  assertJson,
  assertStatus,
  registerTest,
  signRazorpayWebhook,
} from '../lib/test-kit';

async function withBackend<T>(
  opts: UnifiedBackendHarnessOptions,
  fn: (harness: UnifiedBackendHarness) => Promise<T>,
): Promise<T> {
  const harness = await startUnifiedBackend(opts);
  try {
    return await fn(harness);
  } finally {
    await harness.stop();
  }
}

async function getFirstCatalogProduct(
  harness: UnifiedBackendHarness,
  token: string,
): Promise<{ id: string; name: string; base_price: number; tax_rate: number }> {
  const res = await harness.request('/api/catalog/master', { token });
  const data = assertJson(res, 200, (d) => Array.isArray(d.products) && d.products.length > 0);
  const p = data.products[0];
  return {
    id: String(p.id),
    name: String(p.name),
    base_price: Number(p.base_price),
    tax_rate: Number(p.tax_rate ?? 0),
  };
}

async function createStaffAndLogin(
  harness: UnifiedBackendHarness,
  ownerToken: string,
  role: 'manager' | 'cashier' | 'server' | 'waiter' | 'chef' | 'accountant',
  name: string,
): Promise<{ id: string; email: string; token: string }> {
  const email = `${role}-${crypto.randomBytes(4).toString('hex')}@e2e.local`;
  const password = 'StaffPass123!';
  const createRes = await harness.request('/api/staff', {
    method: 'POST',
    token: ownerToken,
    body: { name, email, password, role },
  });
  const created = assertJson(createRes, 201, (d) => typeof d.staff?.id === 'string');

  const loginRes = await harness.request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const loggedIn = assertJson(loginRes, 200, (d) => typeof d.token === 'string');
  return { id: String(created.staff.id), email, token: String(loggedIn.token) };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ============================================================================
// Feature F17: Cloud Orders, Kitchen, Tables & Guest Payments (6 T1, 7 T2)
// ============================================================================

registerTest({
  id: 'f17:t1:tables-crud-and-lifecycle',
  tier: 1,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Dining tables create, list, update, status transition, deactivate, and reactivate',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const createRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          table_number: 'T-10',
          capacity: 6,
          floor: 'Patio',
          section: 'Outdoor',
        },
      });
      const created = assertJson(
        createRes,
        201,
        (d) => d.success === true && d.table?.status === 'available' && d.table?.is_active === 1,
      );
      const tableId = created.table.id as string;

      const listActive1 = await harness.request(
        `/api/tables?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      const tables1 = assertJson(listActive1, 200, (d) => Array.isArray(d.tables));
      assert(tables1.tables.some((t: { id: string; table_number: string }) => t.id === tableId && t.table_number === 'T-10'));

      const updateRes = await harness.request(`/api/tables/${encodeURIComponent(tableId)}`, {
        method: 'PUT',
        token: org.token,
        body: { name: 'T-10A', capacity: 8 },
      });
      assertJson(
        updateRes,
        200,
        (d) => d.success === true && d.table?.table_number === 'T-10A' && d.table?.capacity === 8,
      );

      const statusRes = await harness.request(`/api/tables/${encodeURIComponent(tableId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'reserved' },
      });
      assertJson(statusRes, 200, (d) => d.success === true && d.table?.status === 'reserved');

      const deactRes = await harness.request(`/api/tables/${encodeURIComponent(tableId)}/deactivate`, {
        method: 'POST',
        token: org.token,
      });
      assertJson(deactRes, 200, (d) => d.success === true && d.table?.is_active === 0);

      const activeOnly = await harness.request(
        `/api/tables?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      const activeList = assertJson(activeOnly, 200).tables as Array<{ id: string }>;
      assert(!activeList.some((t) => t.id === tableId), 'Deactivated table should be excluded from default list');

      const withInactive = await harness.request(
        `/api/tables?branch_id=${encodeURIComponent(org.branch.id)}&include_inactive=1`,
        { token: org.token },
      );
      const allList = assertJson(withInactive, 200).tables as Array<{ id: string }>;
      assert(allList.some((t) => t.id === tableId), 'Deactivated table should appear with include_inactive=1');

      const reactRes = await harness.request(`/api/tables/${encodeURIComponent(tableId)}/reactivate`, {
        method: 'POST',
        token: org.token,
      });
      assertJson(reactRes, 200, (d) => d.success === true && d.table?.is_active === 1);
    });
  },
});

registerTest({
  id: 'f17:t1:orders-create-append-and-complete',
  tier: 1,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Orders create idempotently, occupy table, append items with version bump, and complete releasing table',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      const product = await getFirstCatalogProduct(harness, org.token);

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-1', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const orderUuid = crypto.randomUUID();
      const orderPayload = {
        id: orderUuid,
        branch_id: org.branch.id,
        order_type: 'dine_in',
        table_id: tableId,
        table_number: 'T-1',
        items: [{ product_id: product.id, quantity: 2 }],
      };

      const createRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: orderPayload,
      });
      const created = assertJson(
        createRes,
        201,
        (d) =>
          d.success === true &&
          d.order?.id === orderUuid &&
          d.order?.status === 'active' &&
          d.order?.version === 1 &&
          typeof d.order?.kitchen_ticket_id === 'string',
      );
      assertEqual(round2(created.order.subtotal), round2(product.base_price * 2), 'subtotal');
      assertEqual(
        round2(created.order.grand_total),
        round2(created.order.subtotal + created.order.tax_total),
        'grand_total',
      );

      const replayRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: orderPayload,
      });
      assertJson(replayRes, 200, (d) => d.success === true && d.idempotent === true && d.order?.id === orderUuid);

      const tablesMid = await harness.request(`/api/tables?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      const tMid = (assertJson(tablesMid, 200).tables as Array<{ id: string; status: string; current_order_id: string | null }>)
        .find((t) => t.id === tableId);
      assert(tMid, 'Expected T-1 in tables list');
      assertEqual(tMid.status, 'occupied');
      assertEqual(tMid.current_order_id, orderUuid);

      const appendRes = await harness.request(`/api/orders/${encodeURIComponent(orderUuid)}/items`, {
        method: 'POST',
        token: org.token,
        body: {
          expected_version: 1,
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const appended = assertJson(appendRes, 200, (d) => d.success === true && d.version === 2);
      assert(Number(appended.grand_total) > Number(created.order.grand_total), 'Expected grand_total to increase');

      const detailRes = await harness.request(`/api/orders/${encodeURIComponent(orderUuid)}`, {
        token: org.token,
      });
      const detail = assertJson(detailRes, 200);
      assertEqual(detail.order?.items?.length, 2, 'Expected 2 order item lines');
      assertEqual(detail.order?.kitchen_tickets?.length, 2, 'Expected 2 kitchen tickets (initial + amendment)');

      const completeRes = await harness.request(`/api/orders/${encodeURIComponent(orderUuid)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'completed', expected_version: 2 },
      });
      assertJson(completeRes, 200, (d) => d.success === true && d.version === 3);

      const tablesEnd = await harness.request(`/api/tables?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      const tEnd = (assertJson(tablesEnd, 200).tables as Array<{ id: string; status: string; current_order_id: string | null }>)
        .find((t) => t.id === tableId);
      assert(tEnd);
      assertEqual(tEnd.status, 'available');
      assertEqual(tEnd.current_order_id, null);
    });
  },
});

registerTest({
  id: 'f17:t1:kitchen-tickets-lifecycle-and-sync',
  tier: 1,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Kitchen tickets transition pending -> preparing -> ready -> served and sync parent order',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      const product = await getFirstCatalogProduct(harness, org.token);

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-2', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'dine_in',
          table_id: tableId,
          table_number: 'T-2',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const ticketId = order.kitchen_ticket_id as string;
      const orderId = order.id as string;

      const listRes = await harness.request(
        `/api/kitchen/tickets?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      const tickets = assertJson(listRes, 200, (d) => Array.isArray(d.tickets)).tickets as Array<{
        id: string;
        status: string;
      }>;
      const found = tickets.find((t) => t.id === ticketId);
      assert(found && found.status === 'pending', 'Expected pending ticket in kitchen queue');

      const prepRes = await harness.request(`/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'preparing' },
      });
      assertJson(
        prepRes,
        200,
        (d) =>
          d.success === true &&
          d.ticket?.status === 'preparing' &&
          Boolean(d.ticket?.started_at) &&
          d.parent_order_kitchen_status === 'preparing',
      );

      const readyRes = await harness.request(`/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'ready' },
      });
      assertJson(
        readyRes,
        200,
        (d) =>
          d.success === true &&
          d.ticket?.status === 'ready' &&
          Boolean(d.ticket?.ready_at) &&
          d.parent_order_kitchen_status === 'ready',
      );

      const servedRes = await harness.request(`/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'served' },
      });
      assertJson(
        servedRes,
        200,
        (d) =>
          d.success === true &&
          d.ticket?.status === 'completed' &&
          Boolean(d.ticket?.completed_at) &&
          d.parent_order_kitchen_status === 'served',
      );

      const orderDetail = await harness.request(`/api/orders/${encodeURIComponent(orderId)}`, {
        token: org.token,
      });
      assertJson(orderDetail, 200, (d) => d.order?.kitchen_status === 'served');
    });
  },
});

registerTest({
  id: 'f17:t1:held-orders-crud',
  tier: 1,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Held orders create, list as array, upsert on same ID, and delete',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-3', capacity: 6 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const createRes = await harness.request('/api/held-orders', {
        method: 'POST',
        token: org.token,
        body: {
          table_id: tableId,
          guest_count: 4,
          order_notes: 'Allergy: nuts',
          items: [{ name: 'Burger', quantity: 2 }],
        },
      });
      const created = assertJson(
        createRes,
        201,
        (d) => d.success === true && d.held_order?.table_id === tableId && d.held_order?.guest_count === 4,
      );
      const heldId = created.held_order.id as string;

      const list1 = await harness.request(`/api/held-orders?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      assertStatus(list1, 200);
      assert(Array.isArray(list1.data), 'GET /api/held-orders must return a JSON array');
      assert(
        (list1.data as Array<{ id: string }>).some((h) => h.id === heldId),
        'Expected created held order in list',
      );

      const upsertRes = await harness.request('/api/held-orders', {
        method: 'POST',
        token: org.token,
        body: {
          id: heldId,
          table_id: tableId,
          guest_count: 5,
          items: [{ name: 'Burger', quantity: 3 }],
        },
      });
      assertJson(upsertRes, 200, (d) => d.success === true && d.held_order?.guest_count === 5);

      const delRes = await harness.request(`/api/held-orders/${encodeURIComponent(heldId)}`, {
        method: 'DELETE',
        token: org.token,
      });
      assertJson(delRes, 200, (d) => d.success === true && d.id === heldId);

      const list2 = await harness.request(`/api/held-orders?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      assertStatus(list2, 200);
      assert(
        !(list2.data as Array<{ id: string }>).some((h) => h.id === heldId),
        'Deleted held order should not remain in list',
      );
    });
  },
});

registerTest({
  id: 'f17:t1:guest-cash-and-split-payments-with-idempotency',
  tier: 1,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Capabilities report cash-only unconfigured; partial cash + split UPI settle order with idempotency',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const capRes = await harness.request('/api/payments/capabilities', { token: org.token });
      assertJson(
        capRes,
        200,
        (d) =>
          d.cash === true &&
          d.card === false &&
          d.upi === false &&
          d.configured === false &&
          d.provider === null,
      );

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 2 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const grandTotal = Number(order.grand_total);
      const firstHalf = Math.min(100, round2(grandTotal / 2));
      const remaining = round2(grandTotal - firstHalf);

      const cashRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        idempotencyKey: 'pay_cash_key_0001',
        body: { amount: firstHalf, payment_method: 'cash' },
      });
      assertJson(
        cashRes,
        201,
        (d) =>
          d.success === true &&
          d.order_payment_status === 'partially_paid' &&
          round2(d.total_paid) === firstHalf,
      );

      const replayRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        idempotencyKey: 'pay_cash_key_0001',
        body: { amount: firstHalf, payment_method: 'cash' },
      });
      assertJson(replayRes, 200, (d) => d.success === true && d.idempotent === true);

      const upiRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: {
          amount: remaining,
          payment_method: 'upi',
          external_reference_id: 'UTR9988776655',
        },
      });
      assertJson(
        upiRes,
        201,
        (d) =>
          d.success === true &&
          d.order_payment_status === 'paid' &&
          round2(d.outstanding_balance) === 0,
      );

      const ledgerRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        token: org.token,
      });
      assertJson(
        ledgerRes,
        200,
        (d) =>
          d.payments?.length === 2 &&
          round2(d.total_paid) === round2(grandTotal) &&
          d.payment_status === 'paid',
      );
    });
  },
});

registerTest({
  id: 'f17:t1:payment-refund-partial-and-full-with-idempotency',
  tier: 1,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Partial and full payment refunds update ledger and replay idempotently',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 2 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const grandTotal = Number(order.grand_total);
      const partialRefund = Math.min(50, round2(grandTotal / 2));
      const remainderRefund = round2(grandTotal - partialRefund);

      const payRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: grandTotal, payment_method: 'cash' },
      });
      const paymentId = assertJson(payRes, 201).payment.id as string;

      const ref1 = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          idempotencyKey: 'ref_key_0001',
          body: { amount: partialRefund, reason: 'Item unavailable' },
        },
      );
      assertJson(
        ref1,
        200,
        (d) =>
          d.success === true &&
          round2(d.refunded_amount) === partialRefund &&
          d.order_payment_status === 'partially_paid',
      );

      const refReplay = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          idempotencyKey: 'ref_key_0001',
          body: { amount: partialRefund, reason: 'Item unavailable' },
        },
      );
      assertJson(
        refReplay,
        200,
        (d) => d.success === true && d.idempotent === true && d.is_idempotent_replay === true,
      );

      const ref2 = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          idempotencyKey: 'ref_key_0002',
          body: { reason: 'Customer cancelled remainder' },
        },
      );
      assertJson(
        ref2,
        200,
        (d) =>
          d.success === true &&
          round2(d.refunded_amount) === remainderRefund &&
          d.order_payment_status === 'refunded',
      );

      const ledgerRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        token: org.token,
      });
      assertJson(
        ledgerRes,
        200,
        (d) =>
          round2(d.total_paid) === 0 &&
          round2(d.total_refunded) === round2(grandTotal) &&
          d.payment_status === 'refunded',
      );
    });
  },
});

registerTest({
  id: 'f17:t2:order-optimistic-concurrency-and-cancellation-guards',
  tier: 2,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Orders enforce expected_version CAS (409), settled-payment/completed cancellation guards, and waiter pricing bounds',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);
      const server = await createStaffAndLogin(harness, org.token, 'server', 'Floor Server');

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-CONC', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'dine_in',
          table_id: tableId,
          table_number: 'T-CONC',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const order = assertJson(orderRes, 201).order;

      const appendOk = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/items`, {
        method: 'POST',
        token: org.token,
        body: { expected_version: 1, items: [{ product_id: product.id, quantity: 1 }] },
      });
      const updated = assertJson(appendOk, 200, (d) => d.version === 2);

      const staleAppend = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/items`, {
        method: 'POST',
        token: org.token,
        body: { expected_version: 1, items: [{ product_id: product.id, quantity: 1 }] },
      });
      assertStatus(staleAppend, 409, 'stale expected_version on append items');

      const staleStatus = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'completed', expected_version: 1 },
      });
      assertStatus(staleStatus, 409, 'stale expected_version on status');

      const payRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: Number(updated.grand_total), payment_method: 'cash' },
      });
      const paymentId = assertJson(payRes, 201).payment.id as string;

      const cancelWhilePaid = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'cancelled', cancellation_reason: 'Attempt cancel with payment' },
      });
      assertStatus(cancelWhilePaid, 400, 'cannot cancel order with settled payments');

      const refundRes = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          body: { reason: 'Full refund before cancel' },
        },
      );
      assertStatus(refundRes, 200);

      const cancelAfterRefund = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'cancelled', cancellation_reason: 'Test void' },
      });
      assertStatus(cancelAfterRefund, 200, 'cancel after full refund');

      const order2Res = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const order2Id = assertJson(order2Res, 201).order.id as string;
      const complete2 = await harness.request(`/api/orders/${encodeURIComponent(order2Id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'completed' },
      });
      assertStatus(complete2, 200);

      const cancelCompleted = await harness.request(`/api/orders/${encodeURIComponent(order2Id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'cancelled' },
      });
      assertStatus(cancelCompleted, 400, 'cannot cancel completed order');

      const serverOverride = await harness.request('/api/orders', {
        method: 'POST',
        token: server.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 1, unit_price: 1 }],
        },
      });
      assertStatus(serverOverride, [400, 403], 'server price override rejected');

      const serverDiscount = await harness.request('/api/orders', {
        method: 'POST',
        token: server.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          order_discount: 10,
          discount_reason: 'Unauthorized discount',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      assertStatus(serverDiscount, [400, 403], 'server order discount rejected');
    });
  },
});

registerTest({
  id: 'f17:t2:table-occupied-deactivation-and-duplicate-bounds',
  tier: 2,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Tables reject duplicate names (409), invalid capacity (400), and deactivating occupied table (409)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const tRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-20', capacity: 4 },
      });
      const tableId = assertJson(tRes, 201).table.id as string;

      const dupRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-20', capacity: 4 },
      });
      assertStatus(dupRes, 409, 'duplicate table number');

      const capZero = await harness.request(`/api/tables/${encodeURIComponent(tableId)}`, {
        method: 'PUT',
        token: org.token,
        body: { capacity: 0 },
      });
      assertJson(capZero, 400, (d) => d.code === 'TABLE_CAPACITY_INVALID');

      const capOver = await harness.request(`/api/tables/${encodeURIComponent(tableId)}`, {
        method: 'PUT',
        token: org.token,
        body: { capacity: 101 },
      });
      assertJson(capOver, 400, (d) => d.code === 'TABLE_CAPACITY_INVALID');

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'dine_in',
          table_id: tableId,
          table_number: 'T-20',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const orderId = assertJson(orderRes, 201).order.id as string;

      const deactOcc = await harness.request(`/api/tables/${encodeURIComponent(tableId)}/deactivate`, {
        method: 'POST',
        token: org.token,
      });
      assertJson(deactOcc, 409, (d) => d.code === 'TABLE_OCCUPIED');

      const completeRes = await harness.request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'completed' },
      });
      assertStatus(completeRes, 200);

      const deactFree = await harness.request(`/api/tables/${encodeURIComponent(tableId)}/deactivate`, {
        method: 'POST',
        token: org.token,
      });
      assertStatus(deactFree, 200);
    });
  },
});

registerTest({
  id: 'f17:t2:kitchen-tickets-plan-gate-and-invalid-transitions',
  tier: 2,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Kitchen tickets enforce kdsStations plan gate (403), branch_id query (400), waiter RBAC (403), and cancelled order guard (409)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);
      const server = await createStaffAndLogin(harness, org.token, 'server', 'Kitchen Blocked Server');

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const ticketId = order.kitchen_ticket_id as string;

      const starterList = await harness.request(
        `/api/kitchen/tickets?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      assertJson(starterList, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'kdsStations');

      const starterPatch = await harness.request(
        `/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`,
        {
          method: 'PATCH',
          token: org.token,
          body: { status: 'preparing' },
        },
      );
      assertJson(starterPatch, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'kdsStations');

      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const missingBranch = await harness.request('/api/kitchen/tickets', { token: org.token });
      assertStatus(missingBranch, 400, 'GET /api/kitchen/tickets without branch_id');

      const invalidState = await harness.request(
        `/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`,
        {
          method: 'PATCH',
          token: org.token,
          body: { status: 'invalid_state' },
        },
      );
      assertStatus(invalidState, 400, 'invalid ticket status');

      const serverPatch = await harness.request(
        `/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`,
        {
          method: 'PATCH',
          token: server.token,
          body: { status: 'preparing' },
        },
      );
      assertStatus(serverPatch, 403, 'server cannot mutate kitchen ticket status');

      const cancelOrder = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'cancelled' },
      });
      assertStatus(cancelOrder, 200);

      const prepCancelled = await harness.request(
        `/api/kitchen/tickets/${encodeURIComponent(ticketId)}/status`,
        {
          method: 'PATCH',
          token: org.token,
          body: { status: 'preparing' },
        },
      );
      assertStatus(prepCancelled, 409, 'cannot start cancelled order in kitchen');
    });
  },
});

registerTest({
  id: 'f17:t2:require-provider-verified-noncash-true-and-legacy-patch-410',
  tier: 2,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'REQUIRE_PROVIDER_VERIFIED_NONCASH=true rejects direct upi/card (400), allows cash (201), and PATCH payment returns 410',
  async run(): Promise<void> {
    await withBackend({ env: { REQUIRE_PROVIDER_VERIFIED_NONCASH: 'true' } }, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 2 }],
        },
      });
      const orderId = assertJson(orderRes, 201).order.id as string;

      const upiRes = await harness.request(`/api/orders/${encodeURIComponent(orderId)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: 50, payment_method: 'upi', external_reference_id: 'UTR12345678' },
      });
      assertJson(upiRes, 400, (d) => d.code === 'PROVIDER_VERIFICATION_REQUIRED');

      const cardRes = await harness.request(`/api/orders/${encodeURIComponent(orderId)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: 50, payment_method: 'card', external_reference_id: 'AUTH998877' },
      });
      assertJson(cardRes, 400, (d) => d.code === 'PROVIDER_VERIFICATION_REQUIRED');

      const cashRes = await harness.request(`/api/orders/${encodeURIComponent(orderId)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: 50, payment_method: 'cash' },
      });
      assertStatus(cashRes, 201);

      const legacyPatch = await harness.request(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
        method: 'PATCH',
        token: org.token,
        body: { payment_method: 'cash' },
      });
      assertJson(legacyPatch, 410, (d) => d.migration === 'POST /api/orders/:id/payments');
    });
  },
});

registerTest({
  id: 'f17:t2:payment-validation-overpay-bogus-ref-and-spoofed-verification',
  tier: 2,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Payments reject spoofed verification_method, bogus/duplicate external_reference_id, overpayment, and idempotency conflict',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const mkOrder = async (): Promise<{ id: string; grand_total: number }> => {
        const r = await harness.request('/api/orders', {
          method: 'POST',
          token: org.token,
          body: {
            branch_id: org.branch.id,
            order_type: 'takeaway',
            items: [{ product_id: product.id, quantity: 1 }],
          },
        });
        const d = assertJson(r, 201).order;
        return { id: String(d.id), grand_total: Number(d.grand_total) };
      };

      const order1 = await mkOrder();
      const order2 = await mkOrder();

      const spoof = await harness.request(`/api/orders/${encodeURIComponent(order1.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: 50, payment_method: 'cash', verification_method: 'gateway_verified' },
      });
      assertStatus(spoof, 400, 'spoofed verification_method');

      const bogus1 = await harness.request(`/api/orders/${encodeURIComponent(order1.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: 50, payment_method: 'upi', external_reference_id: 'test' },
      });
      assertStatus(bogus1, 400, 'bogus ref test');

      const bogus2 = await harness.request(`/api/orders/${encodeURIComponent(order1.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: 50, payment_method: 'upi', external_reference_id: '123' },
      });
      assertStatus(bogus2, 400, 'bogus ref 123');

      const overpay = await harness.request(`/api/orders/${encodeURIComponent(order1.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: order1.grand_total + 50, payment_method: 'cash' },
      });
      assertStatus(overpay, 400, 'overpayment rejected');

      const idemAmt = Math.min(50, round2(order1.grand_total / 2));
      const upiOk = await harness.request(`/api/orders/${encodeURIComponent(order1.id)}/payments`, {
        method: 'POST',
        token: org.token,
        idempotencyKey: 'pay_idem_conflict_1',
        body: { amount: idemAmt, payment_method: 'upi', external_reference_id: 'UTR_UNIQ_001' },
      });
      assertStatus(upiOk, 201);

      const idemConflict = await harness.request(`/api/orders/${encodeURIComponent(order1.id)}/payments`, {
        method: 'POST',
        token: org.token,
        idempotencyKey: 'pay_idem_conflict_1',
        body: { amount: idemAmt + 1, payment_method: 'upi', external_reference_id: 'UTR_UNIQ_002' },
      });
      assertStatus(idemConflict, 409, 'idempotency key reused with different amount');

      const dupExtRef = await harness.request(`/api/orders/${encodeURIComponent(order2.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: 50, payment_method: 'upi', external_reference_id: 'UTR_UNIQ_001' },
      });
      assertStatus(dupExtRef, 409, 'duplicate external_reference_id on same branch');
    });
  },
});

registerTest({
  id: 'f17:t2:refund-over-refund-missing-reason-and-idempotency-conflict',
  tier: 2,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Refunds reject missing reason (400), over-refund (400), and idempotency conflict (409)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 2 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const grandTotal = Number(order.grand_total);

      const payRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: grandTotal, payment_method: 'cash' },
      });
      const paymentId = assertJson(payRes, 201).payment.id as string;

      const missingReason = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          body: { amount: 10 },
        },
      );
      assertStatus(missingReason, 400, 'refund without reason');

      const overRefund = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          body: { amount: grandTotal + 50, reason: 'Too much' },
        },
      );
      assertStatus(overRefund, 400, 'over-refund > payment.amount');

      const partialAmt = Math.min(50, round2(grandTotal / 2));
      const ref1 = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          idempotencyKey: 'ref_conflict_1',
          body: { amount: partialAmt, reason: 'Partial void' },
        },
      );
      assertStatus(ref1, 200);

      const refConflict = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          idempotencyKey: 'ref_conflict_1',
          body: { amount: partialAmt + 10, reason: 'Partial void' },
        },
      );
      assertStatus(refConflict, 409, 'refund idempotency conflict');

      const exceedRemaining = await harness.request(
        `/api/orders/${encodeURIComponent(order.id)}/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: 'POST',
          token: org.token,
          body: { amount: grandTotal, reason: 'Exceeds remaining refundable' },
        },
      );
      assertStatus(exceedRemaining, 400, 'second refund exceeding remaining balance');
    });
  },
});

registerTest({
  id: 'f17:t2:razorpay-payment-intent-unconfigured-configured-and-webhook-hmac',
  tier: 2,
  feature: 'F17: Cloud Orders, Kitchen, Tables & Guest Payments',
  title: 'Razorpay guest payment capabilities, 503 unconfigured guard, webhook HMAC 401/200/replay, and verify 404',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);
      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const orderId = assertJson(orderRes, 201).order.id as string;

      const capUnconf = await harness.request('/api/payments/capabilities', { token: org.token });
      assertJson(capUnconf, 200, (d) => d.configured === false);

      const intentUnconf = await harness.request(`/api/orders/${encodeURIComponent(orderId)}/payment-intent`, {
        method: 'POST',
        token: org.token,
        body: {},
      });
      assertJson(intentUnconf, 503, (d) => d.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED');

      const whUnconf = await harness.request('/api/webhooks/razorpay-payments', {
        method: 'POST',
        body: { event: 'payment.captured' },
      });
      assertStatus(whUnconf, 503, 'unconfigured webhook');
    });

    await withBackend(
      {
        env: {
          RAZORPAY_KEY_ID: 'rzp_test_e2e123',
          RAZORPAY_KEY_SECRET: 'e2e_key_secret',
          RAZORPAY_WEBHOOK_SECRET: 'e2e_wh_secret',
        },
      },
      async (harness) => {
        const org = await harness.registerOrg();
        const capConf = await harness.request('/api/payments/capabilities', { token: org.token });
        assertJson(
          capConf,
          200,
          (d) =>
            d.configured === true &&
            d.card === true &&
            d.upi === true &&
            d.provider === 'razorpay',
        );

        const rawPayload = JSON.stringify({
          event: 'payment.captured',
          payload: { payment: { entity: { id: 'pay_unknown999', order_id: 'order_unknown999', status: 'captured' } } },
        });

        const badSig = await harness.request('/api/webhooks/razorpay-payments', {
          method: 'POST',
          rawBody: rawPayload,
          headers: {
            'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000',
            'x-razorpay-event-id': 'evt_e2e_bad',
          },
        });
        assertStatus(badSig, 401, 'invalid HMAC on /api/webhooks/razorpay-payments');

        const validHeaders = {
          ...signRazorpayWebhook('e2e_wh_secret', rawPayload),
          'x-razorpay-event-id': 'evt_e2e_1',
        };
        const whOk = await harness.request('/api/webhooks/razorpay-payments', {
          method: 'POST',
          rawBody: rawPayload,
          headers: validHeaders,
        });
        assertJson(whOk, 200, (d) => d.received === true && d.ignored === true);

        const whReplay = await harness.request('/api/webhooks/razorpay-payments', {
          method: 'POST',
          rawBody: rawPayload,
          headers: validHeaders,
        });
        assertJson(whReplay, 200, (d) => d.received === true && d.duplicate === true);

        const verifyMissing = await harness.request('/api/payments/verify', {
          method: 'POST',
          token: org.token,
          body: {
            intent_id: 'nonexistent-intent-id',
            provider_payment_id: 'pay_123',
            signature: 'sig_123',
          },
        });
        assertStatus(verifyMissing, 404, 'verify nonexistent intent_id');
      },
    );
  },
});

// ============================================================================
// Feature F18: Cloud Catalog/CSV, Ops, Reports & Admin (7 T1, 7 T2)
// ============================================================================

registerTest({
  id: 'f18:t1:catalog-addons-branch-override-and-menu-csv-roundtrip',
  tier: 1,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Categories, addon groups, products, branch overrides, and Menu CSV template/export/import roundtrip',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();

      const catRes = await harness.request('/api/categories', {
        method: 'POST',
        token: org.token,
        body: { name: 'Artisan Pizza', description: 'Wood fired' },
      });
      const catId = assertJson(catRes, 201).category.id as string;

      const addonRes = await harness.request('/api/addon-groups', {
        method: 'POST',
        token: org.token,
        body: {
          name: 'Crust',
          is_required: false,
          min_selection: 0,
          max_selection: 1,
          addons: [{ name: 'Cheese Burst', price: 60 }],
        },
      });
      const groupId = assertJson(addonRes, 201).id as string;

      const prodRes = await harness.request('/api/products', {
        method: 'POST',
        token: org.token,
        body: {
          name: 'Truffle Pie',
          price: 400,
          category_id: catId,
          tax_rate: 5,
          addon_group_ids: [groupId],
        },
      });
      const prodId = assertJson(prodRes, 201).id as string;

      const overrideRes = await harness.request(
        `/api/catalog/branch/${encodeURIComponent(org.branch.id)}/override`,
        {
          method: 'POST',
          token: org.token,
          body: { product_id: prodId, price_override: 450, is_available: true },
        },
      );
      assertJson(overrideRes, 200, (d) => d.success === true);

      const branchCatRes = await harness.request(
        `/api/catalog/branch/${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      const branchCat = assertJson(branchCatRes, 200, (d) => Array.isArray(d.catalog));
      const overridden = branchCat.catalog.find((p: { id: string }) => p.id === prodId);
      assert(overridden, 'Expected Truffle Pie in branch catalog');
      assertEqual(Number(overridden.effective_price), 450);

      const tmplRes = await harness.request('/api/menu-csv/template/products', { token: org.token });
      assertStatus(tmplRes, 200);
      assert((tmplRes.headers.get('content-type') ?? '').includes('text/csv'));

      const expRes = await harness.request('/api/menu-csv/export/products', { token: org.token });
      assertStatus(expRes, 200);
      assert((expRes.headers.get('content-type') ?? '').includes('text/csv'));
      assert(expRes.rawText.includes('Truffle Pie'), 'Expected Truffle Pie in exported CSV');

      const impCatRes = await harness.request('/api/menu-csv/import/categories', {
        method: 'POST',
        token: org.token,
        body: { csv: 'name,description,color,icon,sort_order\nCSV Drinks,Cold drinks,blue,,9' },
      });
      assertJson(
        impCatRes,
        200,
        (d) => d.created === 1 && Array.isArray(d.errors) && d.errors.length === 0,
      );

      const impProdRes = await harness.request('/api/menu-csv/import/products', {
        method: 'POST',
        token: org.token,
        body: {
          csv: 'id,sku,name,category,price,description,cost,tax_category,tax_behavior,cashback_percent,tags,is_active\n,SKU-CSV-1,Iced Latte,CSV Drinks,180,Chilled espresso,60,,,,"veg",yes',
        },
      });
      assertJson(
        impProdRes,
        200,
        (d) => d.created === 1 && Array.isArray(d.errors) && d.errors.length === 0,
      );

      const prodsList = await harness.request('/api/products', { token: org.token });
      const prodsData = assertJson(prodsList, 200, (d) => Array.isArray(d.products));
      assert(
        prodsData.products.some((p: { name: string }) => p.name === 'Iced Latte'),
        'Expected CSV-imported product Iced Latte in GET /api/products',
      );
    });
  },
});

registerTest({
  id: 'f18:t1:expenses-vendors-and-reservations-lifecycle',
  tier: 1,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Expenses, vendors, and reservations create, list, seat, complete, and void',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();

      const expCatRes = await harness.request('/api/expenses/categories', {
        method: 'POST',
        token: org.token,
        body: { name: 'Utilities' },
      });
      const expCatId = assertJson(expCatRes, 201).category.id as string;

      const vendorRes = await harness.request('/api/vendors', {
        method: 'POST',
        token: org.token,
        body: { name: 'Fresh Farms', gstin: '07AAAAA0000A1Z5' },
      });
      const vendorId = assertJson(vendorRes, 201).vendor.id as string;

      const expRes = await harness.request('/api/expenses', {
        method: 'POST',
        token: org.token,
        body: {
          amount: 1250,
          description: 'Milk & Veg',
          payment_method: 'upi',
          category_id: expCatId,
          vendor_id: vendorId,
        },
      });
      const expData = assertJson(expRes, 201, (d) => d.expense?.status === 'recorded');
      const expenseId = expData.expense.id as string;

      const listExp = await harness.request(`/api/expenses?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      const expList = assertJson(listExp, 200, (d) => Array.isArray(d.expenses)).expenses as Array<{ id: string }>;
      assert(expList.some((e) => e.id === expenseId));

      const voidExp = await harness.request(`/api/expenses/${encodeURIComponent(expenseId)}`, {
        method: 'DELETE',
        token: org.token,
      });
      assertJson(voidExp, 200, (d) => d.success === true && d.status === 'voided');

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'RES-1', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const today = new Date().toISOString().slice(0, 10);
      const resvRes = await harness.request('/api/reservations', {
        method: 'POST',
        token: org.token,
        body: {
          customer_name: 'Asha',
          guest_count: 4,
          reservation_date: today,
          reservation_time: '19:30',
          table_id: tableId,
        },
      });
      const resv = assertJson(resvRes, 201, (d) => d.reservation?.status === 'confirmed').reservation;

      const seatRes = await harness.request(`/api/reservations/${encodeURIComponent(resv.id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'seated' },
      });
      assertJson(seatRes, 200, (d) => d.status === 'seated');

      const tablesMid = await harness.request(`/api/tables?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      const tMid = (assertJson(tablesMid, 200).tables as Array<{ id: string; status: string }>).find((t) => t.id === tableId);
      assertEqual(tMid?.status, 'occupied');

      const compRes = await harness.request(`/api/reservations/${encodeURIComponent(resv.id)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'completed' },
      });
      assertJson(compRes, 200, (d) => d.status === 'completed');

      const tablesEnd = await harness.request(`/api/tables?branch_id=${encodeURIComponent(org.branch.id)}`, {
        token: org.token,
      });
      const tEnd = (assertJson(tablesEnd, 200).tables as Array<{ id: string; status: string }>).find((t) => t.id === tableId);
      assertEqual(tEnd?.status, 'available');
    });
  },
});

registerTest({
  id: 'f18:t1:inventory-recipes-and-interbranch-transfers',
  tier: 1,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Inventory ingredients, low-stock, idempotent adjustments, recipe COGS, and inter-branch transfers',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'enterprise');
      const product = await getFirstCatalogProduct(harness, org.token);

      const branch2Res = await harness.request('/api/branches', {
        method: 'POST',
        token: org.token,
        body: { name: 'Branch Two', code: 'BR-02' },
      });
      const branch2Id = assertJson(branch2Res, 201).branch_id as string;

      const ingRes = await harness.request('/api/inventory/ingredients', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          name: 'Mozzarella',
          unit: 'kg',
          current_stock: 2,
          minimum_stock: 5,
          cost_per_unit: 400,
        },
      });
      const ingId = assertJson(ingRes, 201).ingredient.id as string;

      const lowRes = await harness.request(
        `/api/inventory/low-stock?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      const lowList = assertJson(lowRes, 200, (d) => Array.isArray(d.low_stock)).low_stock as Array<{
        id: string;
        name: string;
      }>;
      assert(lowList.some((i) => i.id === ingId && i.name === 'Mozzarella'));

      const adjRes = await harness.request('/api/inventory/adjust', {
        method: 'POST',
        token: org.token,
        body: {
          ingredient_id: ingId,
          adjustment_type: 'increase',
          quantity: 8,
          idempotency_key: 'adj_1',
        },
      });
      assertJson(adjRes, 200, (d) => d.success === true && d.current_stock === 10);

      const adjReplay = await harness.request('/api/inventory/adjust', {
        method: 'POST',
        token: org.token,
        body: {
          ingredient_id: ingId,
          adjustment_type: 'increase',
          quantity: 8,
          idempotency_key: 'adj_1',
        },
      });
      assertJson(adjReplay, 200, (d) => d.idempotent === true && d.balance_after === 10);

      const txRes = await harness.request(
        `/api/inventory/transactions?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      const txList = assertJson(txRes, 200, (d) => Array.isArray(d.transactions)).transactions as Array<{
        type: string;
      }>;
      assert(txList.some((t) => t.type === 'initial'));
      assert(txList.some((t) => t.type === 'adjustment_increase'));

      const recipeRes = await harness.request(
        `/api/inventory/recipes/${encodeURIComponent(product.id)}`,
        {
          method: 'POST',
          token: org.token,
          body: {
            items: [{ ingredient_id: ingId, quantity_required: 0.25, wastage_percentage: 10 }],
          },
        },
      );
      assertJson(recipeRes, 200, (d) => Number(d.recipe_cogs) === 110);

      const trRes = await harness.request('/api/transfers', {
        method: 'POST',
        token: org.token,
        body: {
          source_branch_id: org.branch.id,
          dest_branch_id: branch2Id,
          items: [{ name: 'Mozzarella', quantity: 3 }],
        },
      });
      const transferId = assertJson(trRes, 200, (d) => d.success === true && d.status === 'pending').id as string;

      const dispRes = await harness.request(`/api/transfers/${encodeURIComponent(transferId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'dispatched' },
      });
      assertJson(dispRes, 200, (d) => d.status === 'dispatched');

      const recRes = await harness.request(`/api/transfers/${encodeURIComponent(transferId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'received' },
      });
      assertJson(recRes, 200, (d) => d.status === 'received');

      const listTr = await harness.request('/api/cloud/transfers', { token: org.token });
      const transfers = assertJson(listTr, 200, (d) => Array.isArray(d.transfers)).transfers as Array<{
        id: string;
        status: string;
      }>;
      assert(transfers.some((t) => t.id === transferId && t.status === 'received'));
    });
  },
});

registerTest({
  id: 'f18:t1:shifts-cash-closures-and-delivery-dispatch',
  tier: 1,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Shift summary, balanced cash closure, and delivery job assign -> picked_up -> delivered COD flow',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'delivery',
          items: [{ product_id: product.id, quantity: 2 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const grandTotal = Number(order.grand_total);

      const payRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: grandTotal, payment_method: 'cash' },
      });
      assertStatus(payRes, 201);

      const sumRes = await harness.request(
        `/api/shifts/summary?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      const summary = assertJson(sumRes, 200, (d) => Number(d.summary?.cash_sales) >= grandTotal).summary;

      const closeRes = await harness.request('/api/shifts/close', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          actual_cash: summary.expected_cash,
          notes: 'Balanced',
        },
      });
      assertJson(closeRes, 201, (d) => Number(d.closure?.variance) === 0);

      const closuresRes = await harness.request(
        `/api/cash-closures?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: org.token },
      );
      assertJson(closuresRes, 200, (d) => Array.isArray(d.closures) && d.closures.length >= 1);

      const jobRes = await harness.request('/api/delivery/jobs', {
        method: 'POST',
        token: org.token,
        body: { order_id: order.id, address: '42 MG Road', cod_amount: 250 },
      });
      const jobId = assertJson(jobRes, 201, (d) => d.job?.status === 'pending').job.id as string;

      const assignRes = await harness.request(`/api/delivery/jobs/${encodeURIComponent(jobId)}/assign`, {
        method: 'PATCH',
        token: org.token,
        body: { driver_name: 'Ravi', eta_minutes: 25 },
      });
      assertJson(assignRes, 200, (d) => d.status === 'assigned' && d.driver_name === 'Ravi');

      const pickupRes = await harness.request(`/api/delivery/jobs/${encodeURIComponent(jobId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'picked_up' },
      });
      assertJson(pickupRes, 200, (d) => d.status === 'picked_up');

      const deliverRes = await harness.request(`/api/delivery/jobs/${encodeURIComponent(jobId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'delivered', cod_collected: true },
      });
      assertJson(deliverRes, 200, (d) => d.status === 'delivered');
    });
  },
});

registerTest({
  id: 'f18:t1:staff-customers-and-crm-wallet',
  tier: 1,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Staff CRUD/deactivate/reactivate and customer CRM search, lookup, and order wallet spend',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);
      const staffEmail = `cashier-${crypto.randomBytes(4).toString('hex')}@e2e.local`;

      const staffCreate = await harness.request('/api/staff', {
        method: 'POST',
        token: org.token,
        body: { name: 'Cashier One', email: staffEmail, password: 'Password123!', role: 'cashier' },
      });
      const staffId = assertJson(staffCreate, 201, (d) => d.staff?.is_active === 1).staff.id as string;

      const staffLogin = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: staffEmail, password: 'Password123!' },
      });
      assertStatus(staffLogin, 200);

      const staffPut = await harness.request(`/api/staff/${encodeURIComponent(staffId)}`, {
        method: 'PUT',
        token: org.token,
        body: { name: 'Cashier Updated' },
      });
      assertJson(staffPut, 200, (d) => d.success === true && d.staff?.name === 'Cashier Updated');

      const deact = await harness.request(`/api/staff/${encodeURIComponent(staffId)}/deactivate`, {
        method: 'POST',
        token: org.token,
      });
      assertJson(deact, 200, (d) => d.staff?.is_active === 0);

      const react = await harness.request(`/api/staff/${encodeURIComponent(staffId)}/reactivate`, {
        method: 'POST',
        token: org.token,
      });
      assertJson(react, 200, (d) => d.staff?.is_active === 1);

      const custPhone = '+91 9876500001';
      const custRes = await harness.request('/api/customers', {
        method: 'POST',
        token: org.token,
        body: { name: 'Priya', phone: custPhone },
      });
      const customerId = assertJson(custRes, 201).customer.id as string;

      const searchRes = await harness.request('/api/customers-search?q=Priya', { token: org.token });
      const searchData = assertJson(searchRes, 200, (d) => Array.isArray(d.customers));
      assert(searchData.customers.some((c: { id: string }) => c.id === customerId));

      const lookupRes = await harness.request(
        `/api/crm/lookup?phone=${encodeURIComponent(custPhone)}`,
        { token: org.token },
      );
      assertJson(lookupRes, 200, (d) => d.customer?.name === 'Priya');

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          customer_name: 'Priya',
          customer_phone: custPhone,
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const payRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: Number(order.grand_total), payment_method: 'cash' },
      });
      assertStatus(payRes, 201);

      const walletRes = await harness.request(`/api/customers/${encodeURIComponent(customerId)}/wallet`, {
        token: org.token,
      });
      assertJson(
        walletRes,
        200,
        (d) => Array.isArray(d.bills) && d.bills.length >= 1 && Number(d.summary?.totalSpent) > 0,
      );
    });
  },
});

registerTest({
  id: 'f18:t1:reporting-analytics-and-accountant-tally',
  tier: 1,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Accountant & owner access analytics overview, dashboard reports, tax summary, and Tally XML export',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      await harness.upgradeOrgPlan(org.tenant.id, 'pro');
      const product = await getFirstCatalogProduct(harness, org.token);
      const accountant = await createStaffAndLogin(harness, org.token, 'accountant', 'Org Accountant');

      const orderRes = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'takeaway',
          items: [{ product_id: product.id, quantity: 2 }],
        },
      });
      const order = assertJson(orderRes, 201).order;
      const payRes = await harness.request(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: 'POST',
        token: org.token,
        body: { amount: Number(order.grand_total), payment_method: 'cash' },
      });
      assertStatus(payRes, 201);

      const closeRes = await harness.request('/api/shifts/close', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, actual_cash: Number(order.grand_total), notes: 'EOD' },
      });
      assertStatus(closeRes, 201);

      for (const p of ['/api/analytics/overview', '/api/cloud/overview']) {
        const res = await harness.request(p, { token: accountant.token });
        assertJson(
          res,
          200,
          (d) => Number(d.total_orders) >= 1 && Number(d.total_revenue) > 0,
        );
      }

      for (const r of [
        '/api/reports/daily-stats',
        '/api/reports/summary',
        '/api/reports/financial-summary',
        '/api/reports/topProducts',
        '/api/reports/recentOrders',
        '/api/reports/insights',
      ]) {
        const res = await harness.request(r, { token: accountant.token });
        assertStatus(res, 200, r);
      }

      const closuresRes = await harness.request('/api/accountant/closures', { token: accountant.token });
      assertJson(closuresRes, 200, (d) => Array.isArray(d.closures) && d.closures.length >= 1);

      const taxRes = await harness.request('/api/accountant/tax-summary', { token: accountant.token });
      assertJson(taxRes, 200, (d) => Array.isArray(d.tax_by_branch) && d.tax_by_branch.length >= 1);

      const tallyRes = await harness.request('/api/accountant/export-tally', { token: accountant.token });
      assertStatus(tallyRes, 200, '/api/accountant/export-tally');
      assert((tallyRes.headers.get('content-type') ?? '').includes('application/xml'));
      assert(tallyRes.rawText.includes('<ENVELOPE>') && tallyRes.rawText.includes('<VOUCHER'));
    });
  },
});

registerTest({
  id: 'f18:t1:platform-admin-tenants-pilots-and-saas-billing-read',
  tier: 1,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Platform admin inspects tenants, suspends/restores account status, approves/invites pilot, and reads SaaS plans',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const adminToken = await harness.platformAdminLogin();

      const meRes = await harness.request('/api/platform-admin/me', { token: adminToken });
      assertJson(meRes, 200, (d) => d.admin?.role === 'platform_admin');

      const overviewRes = await harness.request('/api/platform-admin/overview', { token: adminToken });
      assertStatus(overviewRes, 200);

      const plansRes = await harness.request('/api/platform-admin/plans', { token: adminToken });
      assertJson(plansRes, 200, (d) => Array.isArray(d.plans) && d.plans.length >= 3);

      const tenantsRes = await harness.request('/api/platform-admin/tenants', { token: adminToken });
      assertJson(tenantsRes, 200, (d) => Array.isArray(d.tenants));

      const detailRes = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}`,
        { token: adminToken },
      );
      assertJson(detailRes, 200, (d) => d.tenant?.id === org.tenant.id);

      const suspendRes = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/account-status`,
        {
          method: 'PATCH',
          token: adminToken,
          body: { account_status: 'suspended', reason: 'E2E compliance review suspension' },
        },
      );
      assertJson(suspendRes, 200, (d) => d.changed === true);

      const blockedApi = await harness.request('/api/orders', { token: org.token });
      assertStatus(blockedApi, 403, 'suspended org API blocked');
      const blockedLogin = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: org.email, password: org.password },
      });
      assertStatus(blockedLogin, 403, 'suspended org login blocked');

      const restoreRes = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/account-status`,
        {
          method: 'PATCH',
          token: adminToken,
          body: { account_status: 'active', reason: 'E2E compliance review cleared' },
        },
      );
      assertJson(restoreRes, 200, (d) => d.changed === true);

      const pilotEmail = `f18-pilot-${crypto.randomBytes(4).toString('hex')}@e2e.local`;
      const pilotReq = await harness.request('/api/pilot-requests', {
        method: 'POST',
        body: {
          contact_name: 'Admin Pilot',
          restaurant_name: 'Admin Pilot Bistro',
          email: pilotEmail,
          country: 'IN',
          restaurant_type: 'restaurant',
          outlet_count: 1,
          consent: true,
        },
      });
      const reqId = assertJson(pilotReq, 201).request.id as string;

      const listPilots = await harness.request('/api/platform-admin/pilot-requests', { token: adminToken });
      const pilotItems = assertJson(listPilots, 200).requests as Array<{ id: string }>;
      assert(pilotItems.some((r) => r.id === reqId));

      const approvePilot = await harness.request(
        `/api/platform-admin/pilot-requests/${encodeURIComponent(reqId)}`,
        {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'approved', reason: 'Approved for E2E pilot verification' },
        },
      );
      assertStatus(approvePilot, 200);

      const inviteRes = await harness.request(
        `/api/platform-admin/pilot-requests/${encodeURIComponent(reqId)}/invitation`,
        { method: 'POST', token: adminToken },
      );
      const inviteToken = assertJson(
        inviteRes,
        201,
        (d) => /^[a-f0-9]{64}$/.test(String(d.invitation?.token)),
      ).invitation.token as string;

      const redeemRes = await harness.request('/api/pilot-invitations/redeem', {
        method: 'POST',
        body: { token: inviteToken, password: 'PilotPass123!' },
      });
      assertStatus(redeemRes, 201);

      const subRes = await harness.request('/api/subscription', { token: org.token });
      assertStatus(subRes, 200);
      const subPlansRes = await harness.request('/api/subscription/plans', { token: org.token });
      assertJson(subPlansRes, 200, (d) => Array.isArray(d.plans) && d.plans.length >= 3);
    });
  },
});

registerTest({
  id: 'f18:t2:catalog-category-delete-guard-and-csv-validation-bounds',
  tier: 2,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Category delete blocks non-empty categories unless reassigned, cashier blocked 403, and CSV rejects invalid rows',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const cashier = await createStaffAndLogin(harness, org.token, 'cashier', 'Catalog Cashier');

      const cat1Res = await harness.request('/api/categories', {
        method: 'POST',
        token: org.token,
        body: { name: 'Cat One' },
      });
      const cat1Id = assertJson(cat1Res, 201).category.id as string;

      const cat2Res = await harness.request('/api/categories', {
        method: 'POST',
        token: org.token,
        body: { name: 'Cat Two' },
      });
      const cat2Id = assertJson(cat2Res, 201).category.id as string;

      const prodRes = await harness.request('/api/products', {
        method: 'POST',
        token: org.token,
        body: { name: 'Reassign Item', price: 100, category_id: cat1Id },
      });
      assertStatus(prodRes, 201);

      const delGuard = await harness.request(`/api/categories/${encodeURIComponent(cat1Id)}`, {
        method: 'DELETE',
        token: org.token,
      });
      assertJson(delGuard, 400, (d) => d.productCount === 1);

      const delReassign = await harness.request(
        `/api/categories/${encodeURIComponent(cat1Id)}?action=reassign&reassign_to=${encodeURIComponent(cat2Id)}`,
        { method: 'DELETE', token: org.token },
      );
      assertJson(delReassign, 200, (d) => d.reassigned === 1);

      const cashierProd = await harness.request('/api/products', {
        method: 'POST',
        token: cashier.token,
        body: { name: 'Forbidden', price: 10 },
      });
      assertStatus(cashierProd, 403);

      const cashierAddon = await harness.request('/api/addon-groups', {
        method: 'POST',
        token: cashier.token,
        body: { name: 'Forbidden Group' },
      });
      assertStatus(cashierAddon, 403);

      const cashierCsv = await harness.request('/api/menu-csv/import/categories', {
        method: 'POST',
        token: cashier.token,
        body: { csv: 'name\nForbidden' },
      });
      assertStatus(cashierCsv, 403);

      const headerOnly = await harness.request('/api/menu-csv/import/products', {
        method: 'POST',
        token: org.token,
        body: { csv: 'id,sku,name,category,price' },
      });
      assertStatus(headerOnly, 400, 'header-only CSV');

      const badRows = await harness.request('/api/menu-csv/import/products', {
        method: 'POST',
        token: org.token,
        body: {
          csv: 'name,category,price\nNegative Item,Cat Two,-50\nUnknown Cat Item,NoSuchCat,100',
        },
      });
      assertJson(
        badRows,
        200,
        (d) => d.created === 0 && d.skipped === 2 && Array.isArray(d.errors) && d.errors.length === 2,
      );
    });
  },
});

registerTest({
  id: 'f18:t2:inventory-over-decrease-reservation-overlap-and-cod-delivery-guard',
  tier: 2,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Inventory blocks over-decrease (400), reservations block overlaps/capacity (409/400), delivery enforces dine-in/COD guards (400)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const product = await getFirstCatalogProduct(harness, org.token);

      const ingRes = await harness.request('/api/inventory/ingredients', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, name: 'Flour', unit: 'kg', current_stock: 5 },
      });
      const ingId = assertJson(ingRes, 201).ingredient.id as string;

      const overDec = await harness.request('/api/inventory/adjust', {
        method: 'POST',
        token: org.token,
        body: { ingredient_id: ingId, adjustment_type: 'decrease', quantity: 9999 },
      });
      assertStatus(overDec, 400, 'over-decrease inventory stock');

      const tableRes = await harness.request('/api/tables', {
        method: 'POST',
        token: org.token,
        body: { branch_id: org.branch.id, table_number: 'T-RES-BND', capacity: 4 },
      });
      const tableId = assertJson(tableRes, 201).table.id as string;

      const today = new Date().toISOString().slice(0, 10);
      const res1 = await harness.request('/api/reservations', {
        method: 'POST',
        token: org.token,
        body: {
          customer_name: 'Guest 1',
          guest_count: 2,
          reservation_date: today,
          reservation_time: '19:00',
          table_id: tableId,
        },
      });
      const resvId = assertJson(res1, 201).reservation.id as string;

      const overlap = await harness.request('/api/reservations', {
        method: 'POST',
        token: org.token,
        body: {
          customer_name: 'Guest 2',
          guest_count: 2,
          reservation_date: today,
          reservation_time: '19:45',
          table_id: tableId,
        },
      });
      assertStatus(overlap, 409, 'overlapping reservation within 90m window');

      const overCap = await harness.request('/api/reservations', {
        method: 'POST',
        token: org.token,
        body: {
          customer_name: 'Big Party',
          guest_count: 8,
          reservation_date: today,
          reservation_time: '22:00',
          table_id: tableId,
        },
      });
      assertStatus(overCap, 400, 'guest_count > table.capacity');

      const seatResv = await harness.request(`/api/reservations/${encodeURIComponent(resvId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'seated' },
      });
      assertStatus(seatResv, 200);

      const compResv = await harness.request(`/api/reservations/${encodeURIComponent(resvId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'completed' },
      });
      assertStatus(compResv, 200);

      const invalidTrans = await harness.request(`/api/reservations/${encodeURIComponent(resvId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'seated' },
      });
      assertStatus(invalidTrans, 409, 'completed -> seated invalid reservation transition');

      const dineInOrder = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'dine_in',
          table_id: tableId,
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const dineInId = assertJson(dineInOrder, 201).order.id as string;

      const jobOnDineIn = await harness.request('/api/delivery/jobs', {
        method: 'POST',
        token: org.token,
        body: { order_id: dineInId, address: '123 Street' },
      });
      assertStatus(jobOnDineIn, 400, 'delivery job on dine_in order');

      const delOrder = await harness.request('/api/orders', {
        method: 'POST',
        token: org.token,
        body: {
          branch_id: org.branch.id,
          order_type: 'delivery',
          items: [{ product_id: product.id, quantity: 1 }],
        },
      });
      const delOrderId = assertJson(delOrder, 201).order.id as string;

      const jobRes = await harness.request('/api/delivery/jobs', {
        method: 'POST',
        token: org.token,
        body: { order_id: delOrderId, address: '456 Avenue', cod_amount: 100 },
      });
      const jobId = assertJson(jobRes, 201).job.id as string;

      const assignRes = await harness.request(`/api/delivery/jobs/${encodeURIComponent(jobId)}/assign`, {
        method: 'PATCH',
        token: org.token,
        body: { driver_name: 'Suresh' },
      });
      assertStatus(assignRes, 200);

      const pickRes = await harness.request(`/api/delivery/jobs/${encodeURIComponent(jobId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'picked_up' },
      });
      assertStatus(pickRes, 200);

      const uncollectedCod = await harness.request(`/api/delivery/jobs/${encodeURIComponent(jobId)}/status`, {
        method: 'PATCH',
        token: org.token,
        body: { status: 'delivered', cod_collected: false },
      });
      assertStatus(uncollectedCod, 400, 'COD delivery requires cod_collected: true');
    });
  },
});

registerTest({
  id: 'f18:t2:starter-gating-transfers-and-reporting-rbac-boundaries',
  tier: 2,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'starter gates transfers/inventory/reports (403 PLAN_FEATURE_REQUIRED), pro gates multiOutlet, and reporting enforces RBAC',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();

      for (const req of [
        { path: '/api/transfers', method: 'GET' },
        { path: '/api/transfers', method: 'POST', body: { source_branch_id: org.branch.id, dest_branch_id: org.branch.id, items: [] } },
        { path: '/api/transfers/nonexistent-transfer/status', method: 'PATCH', body: { status: 'dispatched' } },
        { path: `/api/inventory/ingredients?branch_id=${encodeURIComponent(org.branch.id)}`, method: 'GET' },
        { path: '/api/analytics/overview', method: 'GET' },
        { path: '/api/reports/daily-stats', method: 'GET' },
        { path: '/api/accountant/closures', method: 'GET' },
      ]) {
        const res = await harness.request(req.path, {
          method: req.method,
          token: org.token,
          ...(req.body ? { body: req.body } : {}),
        });
        assertJson(
          res,
          403,
          (d) => d.code === 'PLAN_FEATURE_REQUIRED',
        );
      }

      await harness.upgradeOrgPlan(org.tenant.id, 'pro');

      const proBranch = await harness.request('/api/branches', {
        method: 'POST',
        token: org.token,
        body: { name: 'Pro Blocked Branch' },
      });
      assertJson(proBranch, 403, (d) => d.code === 'PLAN_FEATURE_REQUIRED' && d.feature === 'multiOutlet');

      const manager = await createStaffAndLogin(harness, org.token, 'manager', 'Pro Manager');
      const cashier = await createStaffAndLogin(harness, org.token, 'cashier', 'Pro Cashier');
      const server = await createStaffAndLogin(harness, org.token, 'server', 'Pro Server');

      for (const staff of [cashier, server]) {
        for (const p of [
          '/api/analytics/overview',
          '/api/reports/daily-stats',
          '/api/accountant/tax-summary',
          '/api/accountant/export-tally',
        ]) {
          const r = await harness.request(p, { token: staff.token });
          assertStatus(r, 403, `${staff.email} accessing ${p}`);
        }
      }

      for (const p of [
        '/api/accountant/closures',
        '/api/accountant/tax-summary',
        '/api/accountant/export-tally',
      ]) {
        const r = await harness.request(p, { token: manager.token });
        assertStatus(r, 403, `manager accessing accountant route ${p}`);
      }
    });
  },
});

registerTest({
  id: 'f18:t2:staff-and-customer-protection-invariants',
  tier: 2,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Staff enforces manager/owner invariants, deactivation revokes access, manager branch access works, and customer phone bounds',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const manager = await createStaffAndLogin(harness, org.token, 'manager', 'Branch Manager');
      const cashier = await createStaffAndLogin(harness, org.token, 'cashier', 'Target Cashier');

      // B4: Manager created via POST /api/staff must be authorized for org's branches
      const managerTables = await harness.request(
        `/api/tables?branch_id=${encodeURIComponent(org.branch.id)}`,
        { token: manager.token },
      );
      assertStatus(managerTables, 200, 'manager created via POST /api/staff should access branch tables');

      const managerCreateOwner = await harness.request('/api/staff', {
        method: 'POST',
        token: manager.token,
        body: {
          name: 'Illegal Owner',
          email: `illegal-${crypto.randomBytes(3).toString('hex')}@e2e.local`,
          password: 'Password123!',
          role: 'owner',
        },
      });
      assertStatus(managerCreateOwner, 403, 'manager cannot create owner');

      const selfDeact = await harness.request(
        `/api/staff/${encodeURIComponent(org.user.id)}/deactivate`,
        { method: 'POST', token: org.token },
      );
      assertStatus(selfDeact, 409, 'owner cannot self-deactivate');

      const selfRole = await harness.request(`/api/staff/${encodeURIComponent(org.user.id)}`, {
        method: 'PUT',
        token: org.token,
        body: { role: 'cashier' },
      });
      assertStatus(selfRole, 409, 'owner cannot change own role');

      const deactCashier = await harness.request(
        `/api/staff/${encodeURIComponent(cashier.id)}/deactivate`,
        { method: 'POST', token: org.token },
      );
      assertStatus(deactCashier, 200);

      const deactivatedLogin = await harness.request('/api/auth/login', {
        method: 'POST',
        body: { email: cashier.email, password: 'StaffPass123!' },
      });
      assertStatus(deactivatedLogin, 401, 'deactivated staff login rejected');

      const deactivatedOrders = await harness.request('/api/orders', { token: cashier.token });
      assertStatus(deactivatedOrders, [401, 403], 'deactivated staff prior JWT rejected');

      const shortPhone = await harness.request('/api/customers', {
        method: 'POST',
        token: org.token,
        body: { name: 'Short Phone', phone: '123' },
      });
      assertStatus(shortPhone, 400, 'customer phone < 6 digits');

      const custOk = await harness.request('/api/customers', {
        method: 'POST',
        token: org.token,
        body: { name: 'Unique Guest', phone: '+91 9876543210' },
      });
      assertStatus(custOk, 201);

      const dupPhone = await harness.request('/api/customers', {
        method: 'POST',
        token: org.token,
        body: { name: 'Dup Guest', phone: '+91 9876543210' },
      });
      assertStatus(dupPhone, 409, 'duplicate customer phone');
    });
  },
});

registerTest({
  id: 'f18:t2:platform-admin-auth-isolation-reason-bounds-and-active-409',
  tier: 2,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'Platform admin isolates tenant JWTs (401), bounds reason 10..500 chars (400), blocks unverified active (409)',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();
      const adminToken = await harness.platformAdminLogin();

      const tenantOnAdmin = await harness.request('/api/platform-admin/overview', {
        token: org.token,
      });
      assertStatus(tenantOnAdmin, 401, 'org JWT rejected on platform admin endpoint');

      const shortReasonStatus = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/account-status`,
        {
          method: 'PATCH',
          token: adminToken,
          body: { account_status: 'suspended', reason: 'too short' },
        },
      );
      assertStatus(shortReasonStatus, 400, 'reason < 10 chars on account-status');

      const longReasonStatus = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/account-status`,
        {
          method: 'PATCH',
          token: adminToken,
          body: { account_status: 'suspended', reason: 'x'.repeat(501) },
        },
      );
      assertStatus(longReasonStatus, 400, 'reason > 500 chars on account-status');

      const shortReasonSub = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/subscription`,
        {
          method: 'PATCH',
          token: adminToken,
          body: { plan_code: 'pro', reason: 'short' },
        },
      );
      assertStatus(shortReasonSub, 400, 'reason < 10 chars on subscription');

      const bypassPayment = await harness.request(
        `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/subscription`,
        {
          method: 'PATCH',
          token: adminToken,
          body: {
            plan_code: 'pro',
            status: 'active',
            reason: 'Attempt bypass payment verification',
          },
        },
      );
      assertJson(bypassPayment, 409, (d) => d.code === 'PAYMENT_VERIFICATION_REQUIRED');

      const pilotReq = await harness.request('/api/pilot-requests', {
        method: 'POST',
        body: {
          contact_name: 'Unapproved Pilot',
          restaurant_name: 'Unapproved Cafe',
          email: `unapproved-${crypto.randomBytes(3).toString('hex')}@e2e.local`,
          country: 'IN',
          restaurant_type: 'cafe',
          outlet_count: 1,
          consent: true,
        },
      });
      const reqId = assertJson(pilotReq, 201).request.id as string;

      const inviteBeforeApprove = await harness.request(
        `/api/platform-admin/pilot-requests/${encodeURIComponent(reqId)}/invitation`,
        { method: 'POST', token: adminToken },
      );
      assertStatus(inviteBeforeApprove, 409, 'cannot issue invitation before pilot request is approved');
    });
  },
});

registerTest({
  id: 'f18:t2:saas-billing-unconfigured-503-idempotency-regex-and-expired-access',
  tier: 2,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'SaaS billing enforces unconfigured 503, owner RBAC 403, Idempotency-Key regex 400, and expired subscription 402 vs 200',
  async run(): Promise<void> {
    await withBackend({}, async (harness) => {
      const org = await harness.registerOrg();

      const createUnconf = await harness.request('/api/subscription/create-order', {
        method: 'POST',
        token: org.token,
        idempotencyKey: 'sub_idemp_key_0001',
        body: { plan_code: 'pro', billing_cycle: 'monthly' },
      });
      assertJson(createUnconf, 503, (d) => d.code === 'SAAS_BILLING_PROVIDER_NOT_CONFIGURED');

      const verifyUnconf = await harness.request('/api/subscription/verify-payment', {
        method: 'POST',
        token: org.token,
        body: { order_id: 'order_123', payment_id: 'pay_123', signature: 'sig' },
      });
      assertStatus(verifyUnconf, 503, 'verify-payment unconfigured');

      const whUnconf = await harness.request('/api/webhooks/razorpay', {
        method: 'POST',
        body: { event: 'payment.captured' },
      });
      assertStatus(whUnconf, 503, 'webhooks/razorpay unconfigured');
    });

    await withBackend(
      {
        env: {
          RAZORPAY_KEY_ID: 'rzp_test_e2e123',
          RAZORPAY_KEY_SECRET: 'e2e_secret',
        },
      },
      async (harness) => {
        const org = await harness.registerOrg();
        const cashier = await createStaffAndLogin(harness, org.token, 'cashier', 'Billing Cashier');

        const cashierCreate = await harness.request('/api/subscription/create-order', {
          method: 'POST',
          token: cashier.token,
          idempotencyKey: 'sub_idemp_key_0002',
          body: { plan_code: 'pro', billing_cycle: 'monthly' },
        });
        assertStatus(cashierCreate, 403, 'cashier cannot create subscription order');

        const badIdem = await harness.request('/api/subscription/create-order', {
          method: 'POST',
          token: org.token,
          idempotencyKey: 'short',
          body: { plan_code: 'pro', billing_cycle: 'monthly' },
        });
        assertStatus(badIdem, 400, 'Idempotency-Key < 16 chars');

        const adminToken = await harness.platformAdminLogin();
        const expireRes = await harness.request(
          `/api/platform-admin/tenants/${encodeURIComponent(org.tenant.id)}/subscription`,
          {
            method: 'PATCH',
            token: adminToken,
            body: {
              plan_code: 'starter',
              status: 'expired',
              reason: 'Expire subscription for E2E 402 check',
            },
          },
        );
        assertStatus(expireRes, 200);

        const ordersBlocked = await harness.request('/api/orders', { token: org.token });
        assertJson(ordersBlocked, 402, (d) => d.code === 'SUBSCRIPTION_REQUIRED');

        const subAllowed = await harness.request('/api/subscription', { token: org.token });
        assertStatus(subAllowed, 200, '/api/subscription remains accessible when expired');

        const plansAllowed = await harness.request('/api/subscription/plans', { token: org.token });
        assertStatus(plansAllowed, 200, '/api/subscription/plans remains accessible when expired');
      },
    );
  },
});

registerTest({
  id: 'f18:t2:saas-webhook-hmac-replay-and-admin-retry',
  tier: 2,
  feature: 'F18: Cloud Catalog, Ops, Reports & Admin',
  title: 'SaaS Razorpay webhook rejects bad HMAC (401), bad content-type (415), replays ignored events, and records failed order for admin retry',
  async run(): Promise<void> {
    await withBackend({ env: { RAZORPAY_WEBHOOK_SECRET: 'e2e_saas_wh_secret' } }, async (harness) => {
      const ignoredBody = JSON.stringify({ event: 'subscription.charged', payload: {} });

      // B1: Invalid HMAC on /api/webhooks/razorpay must return 401 Unauthorized
      const badHmac = await harness.request('/api/webhooks/razorpay', {
        method: 'POST',
        rawBody: ignoredBody,
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': 'deadbeef',
          'x-razorpay-event-id': 'evt_saas_bad',
        },
      });
      assertStatus(badHmac, 401, 'invalid HMAC on /api/webhooks/razorpay must return 401');

      const badContentType = await harness.request('/api/webhooks/razorpay', {
        method: 'POST',
        rawBody: ignoredBody,
        headers: {
          'content-type': 'text/plain',
          ...signRazorpayWebhook('e2e_saas_wh_secret', ignoredBody),
          'x-razorpay-event-id': 'evt_saas_ct',
        },
      });
      assertStatus(badContentType, 415, 'non-JSON Content-Type on /api/webhooks/razorpay');

      const missingEvtId = await harness.request('/api/webhooks/razorpay', {
        method: 'POST',
        rawBody: ignoredBody,
        headers: {
          'content-type': 'application/json',
          ...signRazorpayWebhook('e2e_saas_wh_secret', ignoredBody),
        },
      });
      assertStatus(missingEvtId, 400, 'missing X-Razorpay-Event-Id');

      const whIgnored = await harness.request('/api/webhooks/razorpay', {
        method: 'POST',
        rawBody: ignoredBody,
        headers: {
          'content-type': 'application/json',
          ...signRazorpayWebhook('e2e_saas_wh_secret', ignoredBody),
          'x-razorpay-event-id': 'evt_saas_1',
        },
      });
      assertJson(whIgnored, 200, (d) => d.ok === true && d.ignored === true);

      const whReplay = await harness.request('/api/webhooks/razorpay', {
        method: 'POST',
        rawBody: ignoredBody,
        headers: {
          'content-type': 'application/json',
          ...signRazorpayWebhook('e2e_saas_wh_secret', ignoredBody),
          'x-razorpay-event-id': 'evt_saas_1',
        },
      });
      assertJson(whReplay, 200, (d) => d.ok === true && d.idempotent_replay === true);

      const failedBody = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_missing123',
              order_id: 'order_missing123',
              status: 'captured',
              amount: 99900,
              currency: 'INR',
            },
          },
        },
      });
      const whFailed = await harness.request('/api/webhooks/razorpay', {
        method: 'POST',
        rawBody: failedBody,
        headers: {
          'content-type': 'application/json',
          ...signRazorpayWebhook('e2e_saas_wh_secret', failedBody),
          'x-razorpay-event-id': 'evt_saas_fail_1',
        },
      });
      assertStatus(whFailed, 503, 'payment.captured for unknown order_id returns 503 and logs failed event');

      const adminToken = await harness.platformAdminLogin();
      const eventsRes = await harness.request('/api/platform-admin/billing/webhook-events?status=failed', {
        token: adminToken,
      });
      const eventsList = assertJson(eventsRes, 200, (d) => Array.isArray(d.events)).events as Array<{
        id: string;
        provider_event_id: string;
      }>;
      const failedRow = eventsList.find((e) => e.provider_event_id === 'evt_saas_fail_1');
      assert(failedRow, 'Expected evt_saas_fail_1 in failed webhook events list');

      const shortRetry = await harness.request(
        `/api/platform-admin/billing/webhook-events/${encodeURIComponent(failedRow.id)}/retry`,
        {
          method: 'POST',
          token: adminToken,
          body: { reason: 'short' },
        },
      );
      assertStatus(shortRetry, 400, 'retry with short reason');

      const validRetry = await harness.request(
        `/api/platform-admin/billing/webhook-events/${encodeURIComponent(failedRow.id)}/retry`,
        {
          method: 'POST',
          token: adminToken,
          body: { reason: 'Retrying missing subscription order webhook after sync check' },
        },
      );
      assertStatus(validRetry, 503, 'retry with missing linked order returns 503');
    });
  },
});
