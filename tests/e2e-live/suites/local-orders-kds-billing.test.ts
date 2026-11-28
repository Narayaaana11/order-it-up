import crypto from 'node:crypto';
import path from 'node:path';
import WebSocket from 'ws';
import {
  type LocalPosHarness,
  type LocalPosHarnessOptions,
  startLocalPos,
} from '../lib/local-pos-harness';
import {
  assert,
  assertEqual,
  assertJson,
  assertStatus,
  createWsFrameQueue,
  registerTest,
  removeTempDirWithRetry,
} from '../lib/test-kit';

const MANAGER_PIN = '2468';

async function withLocalPos<T>(
  opts: LocalPosHarnessOptions,
  fn: (pos: LocalPosHarness) => Promise<T>,
): Promise<T> {
  let pos: LocalPosHarness | undefined;
  try {
    pos = await startLocalPos(opts);
    return await fn(pos);
  } finally {
    if (pos) {
      await pos.stop();
    }
  }
}

async function createStaffUser(
  pos: LocalPosHarness,
  ownerToken: string,
  input: { name: string; email: string; password: string; role: string; pin?: string },
): Promise<{ id: string; email: string; password: string; role: string }> {
  const res = await pos.request('main', '/api/staff', {
    method: 'POST',
    token: ownerToken,
    body: input,
  });
  const data = assertJson<{ staff: { id: string; email: string; role: string } }>(res, 201);
  return {
    id: data.staff.id,
    email: data.staff.email,
    password: input.password,
    role: data.staff.role,
  };
}

async function createOrder(
  pos: LocalPosHarness,
  token: string,
  body: Record<string, unknown>,
  expectedStatus: number | number[] = 201,
  idempotencyKey?: string,
) {
  const res = await pos.request('main', '/api/orders', {
    method: 'POST',
    token,
    body,
    idempotencyKey,
  });
  return assertJson<{ order: any }>(res, expectedStatus).order;
}

async function generateBill(
  pos: LocalPosHarness,
  token: string,
  orderId: number | string,
  extra: Record<string, unknown> = {},
  expectedStatus: number | number[] = [200, 201],
) {
  const res = await pos.request('main', '/api/bills/generate', {
    method: 'POST',
    token,
    body: { order_id: orderId, ...extra },
  });
  return assertJson<{ bill: any }>(res, expectedStatus).bill;
}

async function configureIndiaGstPack(pos: LocalPosHarness, ownerToken: string) {
  const res = await pos.request('main', '/api/tax-packs/manual-config', {
    method: 'POST',
    token: ownerToken,
    body: {
      inclusive: false,
      categories: [
        {
          tempId: 'gst5',
          label: 'GST 5%',
          components: [
            { label: 'CGST', type: 'percent', value: 2.5 },
            { label: 'SGST', type: 'percent', value: 2.5 },
          ],
        },
        {
          tempId: 'gst18',
          label: 'GST 18%',
          components: [
            { label: 'CGST', type: 'percent', value: 9 },
            { label: 'SGST', type: 'percent', value: 9 },
          ],
        },
      ],
      defaultProductCategoryTempId: 'gst5',
      packagingCategoryTempId: 'gst5',
      deliveryCategoryTempId: 'gst5',
      serviceChargeCategoryTempId: 'gst5',
    },
  });
  const cfg = assertJson<{ pack_id: string; version_id: string; version: string }>(res, 200);
  const catsRes = await pos.request('main', '/api/tax/categories', { token: ownerToken });
  const catsData = assertJson<{ categories: Array<{ id: string; label: string; rate_percent: number }> }>(
    catsRes,
    200,
  );
  const gst5Cat = catsData.categories.find((c) => c.label === 'GST 5%');
  const gst18Cat = catsData.categories.find((c) => c.label === 'GST 18%');
  assert(gst5Cat && gst18Cat, 'Expected GST 5% and GST 18% categories after manual-config');
  return { cfg, gst5Cat, gst18Cat };
}

function getTodayInKolkata(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getTomorrowInKolkata(): string {
  const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrow);
}

function openRawKdsWs(wsUrl: string): Promise<{
  ws: WebSocket;
  queue: ReturnType<typeof createWsFrameQueue>;
  waitForClose: (timeoutMs?: number) => Promise<{ code: number; reason: string }>;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const queue = createWsFrameQueue(ws);
    let closeInfo: { code: number; reason: string } | null = null;
    const closeWaiters: Array<(info: { code: number; reason: string }) => void> = [];

    ws.on('close', (code, reasonBuf) => {
      closeInfo = { code, reason: reasonBuf.toString('utf8') };
      while (closeWaiters.length > 0) {
        closeWaiters.shift()!(closeInfo);
      }
    });

    const waitForClose = (timeoutMs = 8000): Promise<{ code: number; reason: string }> => {
      if (closeInfo) return Promise.resolve(closeInfo);
      return new Promise((resClose, rejClose) => {
        const timer = setTimeout(() => {
          rejClose(new Error(`Timed out after ${timeoutMs}ms waiting for WS close`));
        }, timeoutMs);
        closeWaiters.push((info) => {
          clearTimeout(timer);
          resClose(info);
        });
      });
    };

    const timer = setTimeout(() => {
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      reject(new Error(`Timed out connecting WS to ${wsUrl}`));
    }, 5000);

    ws.once('open', () => {
      clearTimeout(timer);
      resolve({ ws, queue, waitForClose });
    });

    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function expectWsUpgradeRejected(wsUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      reject(new Error(`Timed out waiting for WS upgrade rejection on ${wsUrl}`));
    }, 5000);

    ws.once('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      reject(new Error(`Expected WS upgrade rejection on ${wsUrl}, but socket opened`));
    });

    ws.once('unexpected-response', (_req, res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const code = res.statusCode ?? 0;
      res.resume();
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      resolve(code);
    });

    ws.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ============================================================================
// F5 — Local Orders, Held Orders, Item Void & Firing (7 Tier 1 + 8 Tier 2)
// ============================================================================

registerTest({
  id: 'f5-t1-order-crud-lifecycle',
  tier: 1,
  feature: 'F5',
  title: 'Dine-in order CRUD with addons/charges, item append, status progression, and table release',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });

      const agRes = await pos.request('main', '/api/addon-groups', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Toppings',
          min_selection: 0,
          max_selection: 2,
          addons: [{ name: 'Extra Cheese', price: 20 }],
        },
      });
      const agData = assertJson<{ addon_group: { id: string; addons: Array<{ id: string }> } }>(agRes, 201);
      const addonId = agData.addon_group.addons[0].id;

      const prodRes = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: {
          category_id: 'cat-express-food',
          name: 'Artisan Pizza',
          price: 200,
          addon_group_ids: [agData.addon_group.id],
        },
      });
      const prod = assertJson<{ product: { id: string } }>(prodRes, 201).product;

      const order = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        guest_count: 3,
        packaging_charge: 10,
        service_charge: 15,
        items: [{ product_id: prod.id, quantity: 1, addons: [{ id: addonId, quantity: 1 }] }],
      });
      assertEqual(order.type, 'dine_in');
      assertEqual(order.table_id, 'tbl-express-1');
      assertEqual(order.subtotal, 220, 'Expected product 200 + addon 20');
      assertEqual(order.total, 245, 'Expected subtotal 220 + pkg 10 + svc 15');

      const tblOccupied = await pos.request('main', '/api/tables/tbl-express-1', { token: owner.token });
      assertJson(tblOccupied, 200, (d) => d.table?.status === 'occupied');

      const listRes = await pos.request('main', '/api/orders?today=true', { token: owner.token });
      assertJson(listRes, 200, (d) => Array.isArray(d.orders) && d.orders.some((o: any) => o.id === order.id));

      const getRes = await pos.request('main', `/api/orders/${order.id}`, { token: owner.token });
      assertJson(getRes, 200, (d) => d.order?.id === order.id && d.order?.items?.length === 1);

      const appendRes = await pos.request('main', `/api/orders/${order.id}/items`, {
        method: 'POST',
        token: owner.token,
        body: { items: [{ product_id: 'prod-express-tea', quantity: 2 }] },
      });
      const appended = assertJson<{ order: any }>(appendRes, 200).order;
      assertEqual(appended.items.length, 2);
      assertEqual(appended.subtotal, 270, 'Expected 220 + 50');
      assertEqual(appended.total, 295, 'Expected 270 + 10 + 15');

      for (const status of ['preparing', 'ready', 'served', 'completed']) {
        const patchRes = await pos.request('main', `/api/orders/${order.id}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status },
        });
        assertJson(patchRes, 200, (d) => d.order?.status === status);
      }

      const tblAvailable = await pos.request('main', '/api/tables/tbl-express-1', { token: owner.token });
      assertJson(tblAvailable, 200, (d) => d.table?.status === 'available');
    });
  },
});

registerTest({
  id: 'f5-t1-idempotency-replay',
  tier: 1,
  feature: 'F5',
  title: 'Idempotency-Key replays POST /api/orders and POST /api/orders/:id/items without duplicating items',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const createKey = `idem-order-${crypto.randomUUID()}`;
      const payload = {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      };

      const res1 = await pos.request('main', '/api/orders', {
        method: 'POST',
        token: owner.token,
        body: payload,
        idempotencyKey: createKey,
      });
      const order1 = assertJson<{ order: any }>(res1, 201).order;

      const res2 = await pos.request('main', '/api/orders', {
        method: 'POST',
        token: owner.token,
        body: payload,
        idempotencyKey: createKey,
      });
      const order2 = assertJson<{ order: any }>(res2, 200).order;
      assertEqual(order2.id, order1.id);
      assertEqual(order2.order_number, order1.order_number);

      const appendKey = `idem-append-${crypto.randomUUID()}`;
      const appendBody = { items: [{ product_id: 'prod-express-snack', quantity: 1 }] };
      const add1 = await pos.request('main', `/api/orders/${order1.id}/items`, {
        method: 'POST',
        token: owner.token,
        body: appendBody,
        idempotencyKey: appendKey,
      });
      const addOrder1 = assertJson<{ order: any }>(add1, 200).order;
      assertEqual(addOrder1.items.length, 2);

      const add2 = await pos.request('main', `/api/orders/${order1.id}/items`, {
        method: 'POST',
        token: owner.token,
        body: appendBody,
        idempotencyKey: appendKey,
      });
      const addOrder2 = assertJson<{ order: any }>(add2, 200).order;
      assertEqual(addOrder2.items.length, 2, 'Expected idempotent append replay not to duplicate items');
      assertEqual(addOrder2.total, addOrder1.total);
    });
  },
});

registerTest({
  id: 'f5-t1-course-and-item-fire',
  tier: 1,
  feature: 'F5',
  title: 'Course firing and single-item firing update firing_status and record item_fire audit entries',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const order = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [
          { product_id: 'prod-express-meal', quantity: 1, course: 'main', firing_status: 'held' },
          { product_id: 'prod-express-snack', quantity: 1, course: 'dessert', firing_status: 'held' },
        ],
      });
      const dessertItem = order.items.find((i: any) => i.course === 'dessert');
      assert(dessertItem, 'Expected dessert item in created order');

      const fireCourseRes = await pos.request('main', `/api/orders/${order.id}/fire-course`, {
        method: 'POST',
        token: owner.token,
        body: { course: 'main' },
      });
      assertJson(
        fireCourseRes,
        200,
        (d) => d.ok === true && d.firedCount === 1 && d.firedItems?.[0]?.course === 'main',
      );

      const fireItemRes = await pos.request('main', `/api/orders/${order.id}/items/${dessertItem.id}/fire`, {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertJson(
        fireItemRes,
        200,
        (d) => d.ok === true && d.item?.id === dessertItem.id && d.item?.firing_status === 'fired',
      );

      // True target spec (B-F5-2): audit log records action='item_fire'
      const auditRes = await pos.request('main', '/api/audit-log?action=item_fire', { token: owner.token });
      const auditData = assertJson<{ data: Array<{ action: string }> }>(auditRes, 200);
      assert(
        auditData.data.length >= 2,
        `Expected >=2 audit_log entries with action='item_fire', got ${auditData.data.length}`,
      );
    });
  },
});

registerTest({
  id: 'f5-t1-item-cancel-and-restore',
  tier: 1,
  feature: 'F5',
  title: 'Cancelling pending item restores tracked inventory and restoring re-deducts stock and syncs totals',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const prodRes = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: {
          category_id: 'cat-express-food',
          name: 'Limited Burger',
          price: 120,
          track_inventory: true,
          stock_quantity: 5,
        },
      });
      const prod = assertJson<{ product: { id: string } }>(prodRes, 201).product;

      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: prod.id, quantity: 2 },
          { product_id: 'prod-express-tea', quantity: 1 },
        ],
      });
      const burgerItem = order.items.find((i: any) => i.product_id === prod.id);
      assert(burgerItem, 'Expected tracked burger item');

      const stockAfterCreate = await pos.request('main', `/api/products/${prod.id}`, { token: owner.token });
      assertJson(stockAfterCreate, 200, (d) => d.product?.stock_quantity === 3);

      const cancelRes = await pos.request('main', `/api/orders/${order.id}/items/${burgerItem.id}/cancel`, {
        method: 'PATCH',
        token: owner.token,
        body: { reason: 'Customer changed mind' },
      });
      const cancelledOrder = assertJson<{ order: any }>(cancelRes, 200).order;
      const cancelledItem = cancelledOrder.items.find((i: any) => i.id === burgerItem.id);
      assertEqual(cancelledItem.status, 'cancelled');
      assertEqual(cancelledOrder.total, 25);

      const stockAfterCancel = await pos.request('main', `/api/products/${prod.id}`, { token: owner.token });
      assertJson(stockAfterCancel, 200, (d) => d.product?.stock_quantity === 5);

      const restoreRes = await pos.request('main', `/api/orders/${order.id}/items/${burgerItem.id}/restore`, {
        method: 'PATCH',
        token: owner.token,
        body: {},
      });
      const restoredOrder = assertJson<{ order: any }>(restoreRes, 200).order;
      const restoredItem = restoredOrder.items.find((i: any) => i.id === burgerItem.id);
      assertEqual(restoredItem.status, 'pending');
      assertEqual(restoredOrder.total, 265);

      const stockAfterRestore = await pos.request('main', `/api/products/${prod.id}`, { token: owner.token });
      assertJson(stockAfterRestore, 200, (d) => d.product?.stock_quantity === 3);
    });
  },
});

registerTest({
  id: 'f5-t1-cashier-item-void-override',
  tier: 1,
  feature: 'F5',
  title: 'Cashier voids preparing item with manager override_pin, creating mirrored void_adjustment',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager One',
        email: 'manager@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier One',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const cashierLogin = await pos.login(cashier.email, cashier.password, 'main');

      const order = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const itemId = order.items[0].id;

      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'preparing' },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', `/api/kds/items/${itemId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'preparing', expected_status: 'pending' },
        }),
        200,
      );

      // True target spec (B-F5-1): cashier with valid manager override_pin can void preparing item
      const voidRes = await pos.request('main', `/api/orders/${order.id}/items/${itemId}/cancel`, {
        method: 'PATCH',
        token: cashierLogin.token,
        body: { override_pin: MANAGER_PIN, reason: 'Dropped plate' },
      });
      const voidData = assertJson<{ order: any }>(voidRes, 200);
      const voidedItem = voidData.order.items.find((i: any) => i.id === itemId);
      const voidAdj = voidData.order.items.find((i: any) => i.status === 'void_adjustment');
      assertEqual(voidedItem?.status, 'voided');
      assert(voidAdj && voidAdj.total < 0, 'Expected negative void_adjustment line');
      assertEqual(voidData.order.total, 0);
      assertEqual(voidData.order.status, 'cancelled');
    });
  },
});

registerTest({
  id: 'f5-t1-convert-takeaway-and-discount',
  tier: 1,
  feature: 'F5',
  title: 'Convert dine-in order to takeaway frees table and order/item discounts recalculate totals',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const order = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [
          { product_id: 'prod-express-meal', quantity: 1 },
          { product_id: 'prod-express-snack', quantity: 1 },
        ],
      });

      const convertRes = await pos.request('main', `/api/orders/${order.id}/convert-to-takeaway`, {
        method: 'PATCH',
        token: owner.token,
      });
      const converted = assertJson<{ order: any }>(convertRes, 200).order;
      assertEqual(converted.type, 'takeaway');
      assertEqual(converted.table_id, null);

      const tblRes = await pos.request('main', '/api/tables/tbl-express-1', { token: owner.token });
      assertJson(tblRes, 200, (d) => d.table?.status === 'available');

      const orderDiscRes = await pos.request('main', `/api/orders/${order.id}/discount`, {
        method: 'PATCH',
        token: owner.token,
        body: { discount_type: 'percentage', discount_value: 10, discount_reason: 'Promo' },
      });
      const afterOrderDisc = assertJson<{ order: any }>(orderDiscRes, 200).order;
      assertEqual(afterOrderDisc.discount_amount, 23);
      assertEqual(afterOrderDisc.total, 207);

      assertStatus(
        await pos.request('main', '/api/settings/discount', {
          method: 'PUT',
          token: owner.token,
          body: { discount_mode: 'both' },
        }),
        200,
      );

      const itemId = order.items[0].id;
      const itemDiscRes = await pos.request('main', `/api/orders/${order.id}/items/${itemId}/discount`, {
        method: 'PATCH',
        token: owner.token,
        body: { discount_type: 'amount', discount_value: 10 },
      });
      assertJson(itemDiscRes, 200, (d) => d.item?.discount_amount === 10);
    });
  },
});

registerTest({
  id: 'f5-t1-held-orders-crud',
  tier: 1,
  feature: 'F5',
  title: 'Held orders create sets table held, GET lists it, and DELETE restores table available',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const createRes = await pos.request('main', '/api/held-orders', {
        method: 'POST',
        token: owner.token,
        body: {
          tableId: 'tbl-express-2',
          guestCount: 2,
          orderNotes: 'Waiting for party',
          items: [
            {
              id: 'ho-item-1',
              product: { id: 'prod-express-meal' },
              quantity: 2,
              addons: [],
              special_instructions: 'No onions',
            },
          ],
        },
      });
      const created = assertJson<{ success: boolean; id: string }>(createRes, 200);
      assertEqual(created.success, true);
      assert(created.id.length > 0, 'Expected held order id');

      const tblHeld = await pos.request('main', '/api/tables/tbl-express-2', { token: owner.token });
      assertJson(tblHeld, 200, (d) => d.table?.status === 'held');

      const listRes = await pos.request('main', '/api/held-orders', { token: owner.token });
      assertJson(
        listRes,
        200,
        (d) =>
          Array.isArray(d.orders) &&
          d.orders.some((o: any) => o.id === created.id && o.tableId === 'tbl-express-2'),
      );

      const delRes = await pos.request(
        'main',
        `/api/held-orders/tbl-express-2?heldOrderId=${encodeURIComponent(created.id)}`,
        {
          method: 'DELETE',
          token: owner.token,
        },
      );
      assertJson(delRes, 200, (d) => d.success === true && d.deleted === true);

      const tblAvail = await pos.request('main', '/api/tables/tbl-express-2', { token: owner.token });
      assertJson(tblAvail, 200, (d) => d.table?.status === 'available');
    });
  },
});

registerTest({
  id: 'f5-t2-idempotency-body-mismatch-409',
  tier: 2,
  feature: 'F5',
  title: 'Reusing Idempotency-Key with a different order or append payload returns 409',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const key = `mismatch-${crypto.randomUUID()}`;
      const order = await createOrder(
        pos,
        owner.token,
        { type: 'takeaway', items: [{ product_id: 'prod-express-meal', quantity: 1 }] },
        201,
        key,
      );

      const mismatchCreate = await pos.request('main', '/api/orders', {
        method: 'POST',
        token: owner.token,
        body: { type: 'takeaway', items: [{ product_id: 'prod-express-snack', quantity: 1 }] },
        idempotencyKey: key,
      });
      assertStatus(mismatchCreate, 409);

      const appendKey = `mismatch-append-${crypto.randomUUID()}`;
      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/items`, {
          method: 'POST',
          token: owner.token,
          body: { items: [{ product_id: 'prod-express-tea', quantity: 1 }] },
          idempotencyKey: appendKey,
        }),
        200,
      );
      const mismatchAppend = await pos.request('main', `/api/orders/${order.id}/items`, {
        method: 'POST',
        token: owner.token,
        body: { items: [{ product_id: 'prod-express-coffee', quantity: 2 }] },
        idempotencyKey: appendKey,
      });
      assertStatus(mismatchAppend, 409);
    });
  },
});

registerTest({
  id: 'f5-t2-server-ownership-and-cancel-pin',
  tier: 2,
  feature: 'F5',
  title: 'Server sees/modifies only own orders (403 on others) and in-progress cancel enforces override_pin',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Server One',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const srvToken = (await pos.login(server.email, server.password, 'main')).token;

      const ownerOrder = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const srvOrder = await createOrder(pos, srvToken, {
        type: 'dine_in',
        table_id: 'tbl-express-2',
        items: [{ product_id: 'prod-express-snack', quantity: 1 }],
      });

      assertStatus(await pos.request('main', `/api/orders/${ownerOrder.id}`, { token: srvToken }), 403);
      assertStatus(
        await pos.request('main', `/api/orders/${ownerOrder.id}/items`, {
          method: 'POST',
          token: srvToken,
          body: { items: [{ product_id: 'prod-express-tea', quantity: 1 }] },
        }),
        403,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${ownerOrder.id}/status`, {
          method: 'PATCH',
          token: srvToken,
          body: { status: 'preparing' },
        }),
        403,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${ownerOrder.id}/items/${ownerOrder.items[0].id}/cancel`, {
          method: 'PATCH',
          token: srvToken,
          body: { override_pin: MANAGER_PIN },
        }),
        403,
      );

      assertStatus(
        await pos.request('main', `/api/orders/${srvOrder.id}/status`, {
          method: 'PATCH',
          token: srvToken,
          body: { status: 'preparing' },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${srvOrder.id}/status`, {
          method: 'PATCH',
          token: srvToken,
          body: { status: 'cancelled' },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${srvOrder.id}/status`, {
          method: 'PATCH',
          token: srvToken,
          body: { status: 'cancelled', override_pin: '9999' },
        }),
        403,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${srvOrder.id}/status`, {
          method: 'PATCH',
          token: srvToken,
          body: { status: 'cancelled', override_pin: MANAGER_PIN },
        }),
        200,
      );
    });
  },
});

registerTest({
  id: 'f5-t2-item-void-pin-rate-limit-429',
  tier: 2,
  feature: 'F5',
  title: 'Cashier item-void wrong override_pin triggers shared IP 429 rate limit after 5 attempts',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier RL',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;

      const pairs: Array<{ orderId: number; itemId: number }> = [];
      for (let i = 0; i < 6; i += 1) {
        const ord = await createOrder(pos, owner.token, {
          type: 'takeaway',
          items: [{ product_id: 'prod-express-meal', quantity: 1 }],
        });
        const itemId = ord.items[0].id;
        assertStatus(
          await pos.request('main', `/api/kds/items/${itemId}/status`, {
            method: 'PATCH',
            token: owner.token,
            body: { status: 'preparing' },
          }),
          200,
        );
        pairs.push({ orderId: ord.id, itemId });
      }

      // True target spec (B-F5-1): attempts 1..5 return 403 'Invalid manager PIN', attempt 6 returns 429
      for (let i = 0; i < 5; i += 1) {
        const res = await pos.request(
          'main',
          `/api/orders/${pairs[i].orderId}/items/${pairs[i].itemId}/cancel`,
          {
            method: 'PATCH',
            token: cashierToken,
            body: { override_pin: `900${i}` },
          },
        );
        assertJson(res, 403, (d) => typeof d.error === 'string' && /invalid manager pin/i.test(d.error));
      }

      const sixth = await pos.request(
        'main',
        `/api/orders/${pairs[5].orderId}/items/${pairs[5].itemId}/cancel`,
        {
          method: 'PATCH',
          token: cashierToken,
          body: { override_pin: MANAGER_PIN },
        },
      );
      assertStatus(sixth, 429);
    });
  },
});

registerTest({
  id: 'f5-t2-cancel-order-unrefunded-payment-409',
  tier: 2,
  feature: 'F5',
  title: 'Cancelling an order with unrefunded partial or full payments returns 409',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, order.id);

      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: 50 },
        }),
        200,
      );

      const cancelRes = await pos.request('main', `/api/orders/${order.id}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'cancelled' },
      });
      assertStatus(cancelRes, 409);
    });
  },
});

registerTest({
  id: 'f5-t2-fire-terminal-guard',
  tier: 2,
  feature: 'F5',
  title: 'Firing a cancelled item or an item on a completed order is rejected with 400 or 409',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: 'prod-express-meal', quantity: 1, course: 'main', firing_status: 'held' },
          { product_id: 'prod-express-snack', quantity: 1, course: 'main', firing_status: 'held' },
        ],
      });
      const item1 = order.items[0];
      const item2 = order.items[1];

      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/items/${item1.id}/cancel`, {
          method: 'PATCH',
          token: owner.token,
          body: {},
        }),
        200,
      );

      // True target spec (B-F5-2): terminal item cannot be fired
      const fireCancelledItem = await pos.request('main', `/api/orders/${order.id}/items/${item1.id}/fire`, {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertStatus(fireCancelledItem, [400, 409]);

      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'completed' },
        }),
        200,
      );

      const fireCompletedOrderItem = await pos.request(
        'main',
        `/api/orders/${order.id}/items/${item2.id}/fire`,
        {
          method: 'POST',
          token: owner.token,
          body: {},
        },
      );
      assertStatus(fireCompletedOrderItem, [400, 409]);
    });
  },
});

registerTest({
  id: 'f5-t2-restore-insufficient-stock-and-rbac',
  tier: 2,
  feature: 'F5',
  title: 'Restoring item fails 400 on insufficient stock and cashier gets 403 on restore',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;

      const prodRes = await pos.request('main', '/api/products', {
        method: 'POST',
        token: owner.token,
        body: {
          category_id: 'cat-express-food',
          name: 'Rare Steak',
          price: 300,
          track_inventory: true,
          stock_quantity: 2,
        },
      });
      const prod = assertJson<{ product: { id: string } }>(prodRes, 201).product;

      const ord1 = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: prod.id, quantity: 2 },
          { product_id: 'prod-express-tea', quantity: 1 },
        ],
      });
      const steakItem = ord1.items.find((i: any) => i.product_id === prod.id);

      assertStatus(
        await pos.request('main', `/api/orders/${ord1.id}/items/${steakItem.id}/cancel`, {
          method: 'PATCH',
          token: owner.token,
          body: {},
        }),
        200,
      );

      await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: prod.id, quantity: 2 }],
      });

      const restoreCashier = await pos.request(
        'main',
        `/api/orders/${ord1.id}/items/${steakItem.id}/restore`,
        {
          method: 'PATCH',
          token: cashierToken,
          body: {},
        },
      );
      assertStatus(restoreCashier, 403);

      const restoreInsufficient = await pos.request(
        'main',
        `/api/orders/${ord1.id}/items/${steakItem.id}/restore`,
        {
          method: 'PATCH',
          token: owner.token,
          body: {},
        },
      );
      assertJson(
        restoreInsufficient,
        400,
        (d) => typeof d.error === 'string' && /insufficient stock/i.test(d.error),
      );
    });
  },
});

registerTest({
  id: 'f5-t2-discount-limits-and-pin-approval',
  tier: 2,
  feature: 'F5',
  title: 'Order discount enforces discount_max_percentage (400) and discount_requires_approval PIN (403 -> 200)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });

      assertStatus(
        await pos.request('main', '/api/settings/discount', {
          method: 'PUT',
          token: owner.token,
          body: {
            discount_max_percentage: 15,
            discount_mode: 'percentage',
            discount_requires_approval: true,
          },
        }),
        200,
      );

      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });

      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/discount`, {
          method: 'PATCH',
          token: owner.token,
          body: { discount_type: 'percentage', discount_value: 10 },
        }),
        403,
      );

      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/discount`, {
          method: 'PATCH',
          token: owner.token,
          body: { discount_type: 'percentage', discount_value: 20, override_pin: MANAGER_PIN },
        }),
        400,
      );

      const okRes = await pos.request('main', `/api/orders/${order.id}/discount`, {
        method: 'PATCH',
        token: owner.token,
        body: { discount_type: 'percentage', discount_value: 10, override_pin: MANAGER_PIN },
      });
      assertJson(okRes, 200, (d) => d.order?.discount_amount === 15 && d.order?.total === 135);
    });
  },
});

registerTest({
  id: 'f5-t2-convert-split-or-non-dinein-rejects',
  tier: 2,
  feature: 'F5',
  title: 'Takeaway /convert-to-takeaway returns 400 and split-check order rejects /convert-to-takeaway & /items with 409',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      assertStatus(
        await pos.request('main', '/api/settings/split_checks_enabled', {
          method: 'PUT',
          token: owner.token,
          body: { value: 'true' },
        }),
        200,
      );

      const takeawayOrder = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      assertStatus(
        await pos.request('main', `/api/orders/${takeawayOrder.id}/convert-to-takeaway`, {
          method: 'PATCH',
          token: owner.token,
        }),
        400,
      );

      const dineInOrder = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });
      const bill = await generateBill(pos, owner.token, dineInOrder.id);
      const itemId = dineInOrder.items[0].id;

      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: {
            checks: [
              { label: 'Guest 1', items: [{ order_item_id: itemId, quantity: 1 }] },
              { label: 'Guest 2', items: [{ order_item_id: itemId, quantity: 1 }] },
            ],
          },
        }),
        201,
      );

      assertStatus(
        await pos.request('main', `/api/orders/${dineInOrder.id}/convert-to-takeaway`, {
          method: 'PATCH',
          token: owner.token,
        }),
        409,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${dineInOrder.id}/items`, {
          method: 'POST',
          token: owner.token,
          body: { items: [{ product_id: 'prod-express-tea', quantity: 1 }] },
        }),
        409,
      );
    });
  },
});

// ============================================================================
// F6 — Local Kitchen, Stations, KDS :3002 & /kds WS (6 Tier 1 + 7 Tier 2)
// ============================================================================

registerTest({
  id: 'f6-t1-station-crud-and-user-assignment',
  tier: 1,
  feature: 'F6',
  title: 'Kitchen stations CRUD, chef user assignment, and soft-delete succeed',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const chef = await createStaffUser(pos, owner.token, {
        name: 'Chef Station',
        email: 'chef@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });

      const createRes = await pos.request('main', '/api/kitchen-stations', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Grill Station',
          description: 'Hot grill line',
          category_ids: ['cat-express-food'],
        },
      });
      const station = assertJson<{ kitchenStation: any }>(createRes, 201).kitchenStation;

      const listRes = await pos.request('main', '/api/kitchen-stations', { token: owner.token });
      assertJson(
        listRes,
        200,
        (d) =>
          Array.isArray(d.kitchenStations) &&
          d.kitchenStations.some((s: any) => s.id === station.id && s.name === 'Grill Station'),
      );

      const putRes = await pos.request('main', `/api/kitchen-stations/${station.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { name: 'Main Grill', sort_order: 2 },
      });
      assertJson(putRes, 200, (d) => d.kitchenStation?.name === 'Main Grill');

      const assignRes = await pos.request('main', `/api/kitchen-stations/${station.id}/users`, {
        method: 'PUT',
        token: owner.token,
        body: { user_ids: [chef.id] },
      });
      assertJson(assignRes, 200, (d) => Array.isArray(d.users) && d.users.some((u: any) => u.id === chef.id));

      const detailRes = await pos.request('main', `/api/kitchen-stations/${station.id}`, { token: owner.token });
      assertJson(
        detailRes,
        200,
        (d) => Array.isArray(d.kitchenStation?.users) && d.kitchenStation.users.some((u: any) => u.id === chef.id),
      );

      const delRes = await pos.request('main', `/api/kitchen-stations/${station.id}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertStatus(delRes, 200);
    });
  },
});

registerTest({
  id: 'f6-t1-kds-pairing-and-rest-views',
  tier: 1,
  feature: 'F6',
  title: 'KDS pairing, /api/kds/orders, /api/kds/display, /api/kitchen/orders, and /api/kds-info return active orders',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const stationRes = await pos.request('main', '/api/kitchen-stations', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Hot Line', category_ids: ['cat-express-food'] },
      });
      const station = assertJson<{ kitchenStation: { id: string } }>(stationRes, 201).kitchenStation;

      assertStatus(
        await pos.request('main', '/api/tables/tbl-express-1', {
          method: 'PUT',
          token: owner.token,
          body: { kitchen_station_id: station.id },
        }),
        200,
      );

      const order = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });

      const pairPost = await pos.request('main', '/api/kds/pairing', {
        method: 'POST',
        token: owner.token,
        body: { station_id: station.id },
      });
      assertJson(
        pairPost,
        201,
        (d) =>
          typeof d.pairingToken?.token === 'string' &&
          d.pairingToken.token.length >= 32 &&
          d.pairingToken.station_id === station.id,
      );

      const pairGet = await pos.request('main', '/api/kds/pairing', { token: owner.token });
      assertJson(pairGet, 200, (d) => Array.isArray(d.stations) && d.stations.some((s: any) => s.id === station.id));

      const kdsOrders = await pos.request('main', `/api/kds/orders?station_id=${encodeURIComponent(station.id)}`, {
        token: owner.token,
      });
      assertJson(kdsOrders, 200, (d) => d.orders.some((o: any) => o.id === order.id) && d.counts?.pending >= 1);

      const display = await pos.request('main', `/api/kds/display?station_id=${encodeURIComponent(station.id)}`, {
        token: owner.token,
      });
      assertJson(
        display,
        200,
        (d) =>
          d.station?.id === station.id &&
          d.orders.some((o: any) => o.order_id === order.id || o.id === order.id),
      );

      const kitchenOrders = await pos.request('main', '/api/kitchen/orders', { token: owner.token });
      assertJson(kitchenOrders, 200, (d) => d.orders.some((o: any) => o.id === order.id));

      const kdsInfo = await pos.request('main', '/api/kds-info', { token: owner.token });
      assertJson(kdsInfo, 200, (d) => typeof d.ip_url === 'string' && typeof d.qr_data_url === 'string');
    });
  },
});

registerTest({
  id: 'f6-t1-kds-item-status-cas-and-order-items',
  tier: 1,
  feature: 'F6',
  title: 'KDS item status CAS and /api/order-items/:id/status transition pending -> preparing -> ready',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const itemId = order.items[0].id;

      const step1 = await pos.request('main', `/api/kds/items/${itemId}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'preparing', expected_status: 'pending' },
      });
      assertJson(step1, 200, (d) => d.item?.status === 'preparing');

      const step2 = await pos.request('main', `/api/order-items/${itemId}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'ready', expected_status: 'preparing' },
      });
      assertJson(
        step2,
        200,
        (d) => d.order?.items?.find((i: any) => i.id === itemId)?.status === 'ready',
      );
    });
  },
});

registerTest({
  id: 'f6-t1-kds3002-login-and-rest',
  tier: 1,
  feature: 'F6',
  title: 'Standalone KDS :3002 serves info, normalizes login email, reads orders/categories, updates status & fires item',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const chef = await createStaffUser(pos, owner.token, {
        name: 'Chef ThreeOhTwo',
        email: 'chef@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });
      const stationRes = await pos.request('main', '/api/kitchen-stations', {
        method: 'POST',
        token: owner.token,
        body: { name: 'KDS Main Station', category_ids: ['cat-express-food'] },
      });
      const stationId = assertJson<{ kitchenStation: { id: string } }>(stationRes, 201).kitchenStation.id;
      assertStatus(
        await pos.request('main', `/api/kitchen-stations/${stationId}/users`, {
          method: 'PUT',
          token: owner.token,
          body: { user_ids: [chef.id] },
        }),
        200,
      );

      const order = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 1, course: 'main', firing_status: 'held' }],
      });
      const itemId = order.items[0].id;

      const infoRes = await pos.request('kds', '/api/kds/info');
      assertJson(infoRes, 200, (d) => typeof d.kds_default_view === 'string');

      // True target spec (B-F6-1): :3002 login normalizes email (trim + lowercase)
      const loginRes = await pos.request('kds', '/api/auth/login', {
        method: 'POST',
        body: { email: '  Chef@E2E.Local  ', password: chef.password },
      });
      const loginData = assertJson<{ access_token: string; user: any }>(
        loginRes,
        200,
        (d) => typeof d.access_token === 'string' && d.user?.role === 'chef',
      );
      const kdsToken = loginData.access_token;

      assertJson(await pos.request('kds', '/api/auth/me', { token: kdsToken }), 200, (d) => d.user?.id === chef.id);
      assertJson(
        await pos.request('kds', '/api/kds/orders', { token: kdsToken }),
        200,
        (d) => Array.isArray(d.orders) && d.orders.some((o: any) => o.id === order.id),
      );
      assertJson(
        await pos.request('kds', '/api/categories', { token: kdsToken }),
        200,
        (d) => Array.isArray(d.categories) && d.categories.length > 0,
      );
      assertJson(
        await pos.request('kds', `/api/kds/items/${itemId}/status`, {
          method: 'PATCH',
          token: kdsToken,
          body: { status: 'preparing', expected_status: 'pending' },
        }),
        200,
        (d) => d.success === true,
      );
      assertJson(
        await pos.request('kds', `/api/items/${itemId}/fire`, {
          method: 'PATCH',
          token: kdsToken,
          body: {},
        }),
        200,
        (d) => d.success === true && d.firing_status === 'fired',
      );
    });
  },
});

registerTest({
  id: 'f6-t1-kds-ws-auth-initial-and-status-broadcast',
  tier: 1,
  feature: 'F6',
  title: 'KDS WS authenticates, answers ping/pong, updates item status, and broadcasts initial_data across :3001 & :3002',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const chef = await createStaffUser(pos, owner.token, {
        name: 'WS Chef',
        email: 'chef@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });
      const chefToken = (await pos.login(chef.email, chef.password, 'kds')).token;

      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const itemId = order.items[0].id;

      const wsChef = await pos.wsKds(chefToken, 'kds');
      const wsOwner = await pos.wsKds(owner.token, 'main');
      try {
        assertEqual(wsChef.connected?.type, 'connected');
        assertEqual(wsChef.authSuccess?.type, 'auth_success');
        assertEqual(wsChef.initialData?.type, 'initial_data');

        wsChef.send({ type: 'ping' });
        const pong = await wsChef.waitForMessage((m) => m?.type === 'pong', 5000);
        assertEqual(pong.type, 'pong');

        wsChef.send({
          type: 'status_update',
          order_item_id: itemId,
          status: 'preparing',
          expected_status: 'pending',
        });

        const updated = await wsChef.waitForMessage(
          (m) => m?.type === 'status_updated' && m?.order_item_id === itemId,
          5000,
        );
        assertEqual(updated.status, 'preparing');

        const broadcast = await wsOwner.waitForMessage(
          (m) =>
            m?.type === 'initial_data' &&
            Array.isArray(m.orders) &&
            m.orders.some(
              (o: any) =>
                o.id === order.id &&
                o.items?.some((i: any) => i.id === itemId && i.status === 'preparing'),
            ),
          5000,
        );
        assert(broadcast, 'Expected :3001 WS client to receive updated initial_data broadcast');
      } finally {
        await wsChef.close();
        await wsOwner.close();
      }
    });
  },
});

registerTest({
  id: 'f6-t1-kds-ws-revocation-disconnect-1008',
  tier: 1,
  feature: 'F6',
  title: 'Revoked KDS token triggers auth_error and closes WS with code 1008 on status_update',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const chef = await createStaffUser(pos, owner.token, {
        name: 'WS Revoke Chef',
        email: 'chef@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });
      const chefToken = (await pos.login(chef.email, chef.password, 'kds')).token;
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const itemId = order.items[0].id;

      const wsChef = await pos.wsKds(chefToken, 'kds');
      try {
        const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
          wsChef.ws.once('close', (code, reasonBuf) => {
            resolve({ code, reason: reasonBuf.toString('utf8') });
          });
        });

        assertStatus(await pos.request('kds', '/api/auth/logout', { method: 'POST', token: chefToken }), 200);

        wsChef.send({
          type: 'status_update',
          order_item_id: itemId,
          status: 'preparing',
        });

        const errFrame = await wsChef.waitForMessage((m) => m?.type === 'auth_error', 5000);
        assertEqual(errFrame.type, 'auth_error');
        const closed = await closePromise;
        assertEqual(closed.code, 1008);
      } finally {
        await wsChef.close();
      }
    });
  },
});

registerTest({
  id: 'f6-t2-kds-cas-conflict-409',
  tier: 2,
  feature: 'F6',
  title: 'Stale expected_status returns 409 on :3001 & :3002 HTTP and error frame on WS',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const itemId = order.items[0].id;

      assertStatus(
        await pos.request('main', `/api/kds/items/${itemId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'preparing', expected_status: 'pending' },
        }),
        200,
      );

      assertStatus(
        await pos.request('main', `/api/kds/items/${itemId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'ready', expected_status: 'pending' },
        }),
        409,
      );

      assertStatus(
        await pos.request('kds', `/api/kds/items/${itemId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'ready', expected_status: 'pending' },
        }),
        409,
      );

      const wsOwner = await pos.wsKds(owner.token, 'kds');
      try {
        wsOwner.send({
          type: 'status_update',
          order_item_id: itemId,
          status: 'ready',
          expected_status: 'pending',
        });
        const errMsg = await wsOwner.waitForMessage((m) => m?.type === 'error', 5000);
        assert(typeof errMsg.message === 'string' && errMsg.message.length > 0);
      } finally {
        await wsOwner.close();
      }
    });
  },
});

registerTest({
  id: 'f6-t2-kds3002-role-and-station-scope-403',
  tier: 2,
  feature: 'F6',
  title: 'KDS :3002 rejects non-kitchen/unassigned roles on login and blocks cross-station status & fire updates with 403',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Server',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const chefA = await createStaffUser(pos, owner.token, {
        name: 'Chef A',
        email: 'chefa@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });
      const chefUnassigned = await createStaffUser(pos, owner.token, {
        name: 'Chef Unassigned',
        email: 'chefu@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });

      assertStatus(
        await pos.request('kds', '/api/auth/login', {
          method: 'POST',
          body: { email: cashier.email, password: cashier.password },
        }),
        403,
      );
      assertStatus(
        await pos.request('kds', '/api/auth/login', {
          method: 'POST',
          body: { email: server.email, password: server.password },
        }),
        403,
      );

      const stationA = assertJson<{ kitchenStation: { id: string } }>(
        await pos.request('main', '/api/kitchen-stations', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Station A' },
        }),
        201,
      ).kitchenStation;
      const stationB = assertJson<{ kitchenStation: { id: string } }>(
        await pos.request('main', '/api/kitchen-stations', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Station B' },
        }),
        201,
      ).kitchenStation;

      assertStatus(
        await pos.request('main', '/api/tables/tbl-express-1', {
          method: 'PUT',
          token: owner.token,
          body: { kitchen_station_id: stationA.id },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', '/api/tables/tbl-express-2', {
          method: 'PUT',
          token: owner.token,
          body: { kitchen_station_id: stationB.id },
        }),
        200,
      );

      assertStatus(
        await pos.request('main', `/api/kitchen-stations/${stationA.id}/users`, {
          method: 'PUT',
          token: owner.token,
          body: { user_ids: [chefA.id, chefUnassigned.id] },
        }),
        200,
      );
      // Remove chefUnassigned so station_assignments_configured=1 with 0 active stations
      assertStatus(
        await pos.request('main', `/api/kitchen-stations/${stationA.id}/users`, {
          method: 'PUT',
          token: owner.token,
          body: { user_ids: [chefA.id] },
        }),
        200,
      );

      assertStatus(
        await pos.request('kds', '/api/auth/login', {
          method: 'POST',
          body: { email: chefUnassigned.email, password: chefUnassigned.password },
        }),
        403,
      );

      const chefAToken = (await pos.login(chefA.email, chefA.password, 'kds')).token;
      const orderB = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-2',
        items: [{ product_id: 'prod-express-meal', quantity: 1, course: 'main', firing_status: 'held' }],
      });
      const itemBId = orderB.items[0].id;

      assertStatus(
        await pos.request('kds', `/api/kds/items/${itemBId}/status`, {
          method: 'PATCH',
          token: chefAToken,
          body: { status: 'preparing' },
        }),
        403,
      );

      // True target spec (B-F6-2): :3002 PATCH /api/items/:id/fire must enforce station scope
      assertStatus(
        await pos.request('kds', `/api/items/${itemBId}/fire`, {
          method: 'PATCH',
          token: chefAToken,
          body: {},
        }),
        403,
      );
    });
  },
});

registerTest({
  id: 'f6-t2-kds-fire-and-status-terminal-guards',
  tier: 2,
  feature: 'F6',
  title: 'Cancelled/voided items cannot be updated via :3001/:3002 KDS status or fired via :3002 /api/items/:id/fire',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: 'prod-express-meal', quantity: 1, course: 'main', firing_status: 'held' },
          { product_id: 'prod-express-snack', quantity: 1, course: 'main', firing_status: 'held' },
        ],
      });
      const cancelledId = order.items[0].id;
      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/items/${cancelledId}/cancel`, {
          method: 'PATCH',
          token: owner.token,
          body: {},
        }),
        200,
      );

      assertStatus(
        await pos.request('main', `/api/kds/items/${cancelledId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'preparing' },
        }),
        400,
      );
      assertStatus(
        await pos.request('kds', `/api/kds/items/${cancelledId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'preparing' },
        }),
        400,
      );

      // True target spec (B-F6-2): :3002 PATCH /api/items/:id/fire rejects terminal items
      assertStatus(
        await pos.request('kds', `/api/items/${cancelledId}/fire`, {
          method: 'PATCH',
          token: owner.token,
          body: {},
        }),
        [400, 409],
      );
    });
  },
});

registerTest({
  id: 'f6-t2-kds-ws-5s-auth-timeout-1008',
  tier: 2,
  feature: 'F6',
  title: 'Unauthenticated KDS WS times out in ~5s with auth_error + 1008 and rejects pre-auth status_update',
  async run() {
    await withLocalPos({}, async (pos) => {
      await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const wsUrl = `ws://127.0.0.1:${pos.portsBound.kds}/kds`;

      // 1. Pre-auth status_update rejected immediately
      const early = await openRawKdsWs(wsUrl);
      try {
        await early.queue.waitFor((m) => m?.type === 'connected', 5000);
        early.ws.send(JSON.stringify({ type: 'status_update', order_item_id: 1, status: 'preparing' }));
        const errFrame = await early.queue.waitFor((m) => m?.type === 'auth_error', 5000);
        assertEqual(errFrame.message, 'Authentication required');
        const closed = await early.waitForClose(5000);
        assertEqual(closed.code, 1008);
      } finally {
        if (early.ws.readyState !== WebSocket.CLOSED) early.ws.terminate();
      }

      // 2. Idle 5s auth timeout
      const idle = await openRawKdsWs(wsUrl);
      try {
        await idle.queue.waitFor((m) => m?.type === 'connected', 5000);
        const errFrame = await idle.queue.waitFor((m) => m?.type === 'auth_error', 8000);
        assertEqual(errFrame.message, 'Authentication required');
        const closed = await idle.waitForClose(5000);
        assertEqual(closed.code, 1008);
      } finally {
        if (idle.ws.readyState !== WebSocket.CLOSED) idle.ws.terminate();
      }
    });
  },
});

registerTest({
  id: 'f6-t2-kds-starter-plan-403-parity',
  tier: 2,
  feature: 'F6',
  title: 'Starter plan returns 403 FEATURE_NOT_ENTITLED on both :3001 and :3002 KDS endpoints',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const itemId = order.items[0].id;

      await pos.activatePlan('DEV-STARTER', owner.token);

      const mainStations = await pos.request('main', '/api/kitchen-stations', { token: owner.token });
      assertJson(mainStations, 403, (d) => d.code === 'FEATURE_NOT_ENTITLED');

      const mainOrders = await pos.request('main', '/api/kds/orders', { token: owner.token });
      assertJson(mainOrders, 403, (d) => d.code === 'FEATURE_NOT_ENTITLED');

      // True target spec (B-F6-3): :3002 enforces kdsStations parity
      const kdsOrders = await pos.request('kds', '/api/kds/orders', { token: owner.token });
      assertJson(kdsOrders, 403, (d) => d.code === 'FEATURE_NOT_ENTITLED');

      const kdsStatus = await pos.request('kds', `/api/kds/items/${itemId}/status`, {
        method: 'PATCH',
        token: owner.token,
        body: { status: 'preparing' },
      });
      assertJson(kdsStatus, 403, (d) => d.code === 'FEATURE_NOT_ENTITLED');
    });
  },
});

registerTest({
  id: 'f6-t2-kds-disabled-setting',
  tier: 2,
  feature: 'F6',
  title: 'Setting kds_enabled=false returns 404 on pairing/info & WS upgrade and 403 on KDS orders',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      assertStatus(
        await pos.request('main', '/api/settings/kds_enabled', {
          method: 'PUT',
          token: owner.token,
          body: { value: 'false' },
        }),
        200,
      );

      assertStatus(await pos.request('main', '/api/kds/pairing', { token: owner.token }), 404);
      assertStatus(await pos.request('kds', '/api/kds/info'), 404);
      assertStatus(await pos.request('main', '/api/kds/orders', { token: owner.token }), 403);
      assertStatus(await pos.request('kds', '/api/kds/orders', { token: owner.token }), 403);

      const wsCode = await expectWsUpgradeRejected(`ws://127.0.0.1:${pos.portsBound.kds}/kds`);
      assertEqual(wsCode, 404);
    });
  },
});

registerTest({
  id: 'f6-t2-station-delete-assigned-table-400',
  tier: 2,
  feature: 'F6',
  title: 'Deleting a kitchen station with an assigned table returns 400',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const station = assertJson<{ kitchenStation: { id: string } }>(
        await pos.request('main', '/api/kitchen-stations', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Assigned Station' },
        }),
        201,
      ).kitchenStation;

      assertStatus(
        await pos.request('main', '/api/tables/tbl-express-1', {
          method: 'PUT',
          token: owner.token,
          body: { kitchen_station_id: station.id },
        }),
        200,
      );

      assertStatus(
        await pos.request('main', `/api/kitchen-stations/${station.id}`, {
          method: 'DELETE',
          token: owner.token,
        }),
        400,
      );
    });
  },
});

// ============================================================================
// F7 — Local Server App :3003 Proxy & Auth (5 Tier 1 + 5 Tier 2)
// ============================================================================

registerTest({
  id: 'f7-t1-health-info-login-me',
  tier: 1,
  feature: 'F7',
  title: 'Server App :3003 serves health, info, normalized login for server/manager/owner, and /api/auth/me',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const manager = await createStaffUser(pos, owner.token, {
        name: 'Manager SA',
        email: 'manager@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
      });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Server SA',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });

      assertJson(
        await pos.request('serverApp', '/api/health'),
        200,
        (d) => d.status === 'ok' && d.service === 'Order It Up Server App',
      );
      assertJson(
        await pos.request('serverApp', '/api/server-app/info'),
        200,
        (d) => d.country === 'IN' && d.kds_enabled === true,
      );

      for (const account of [
        { email: `  ${server.email.toUpperCase()}  `, password: server.password, role: 'server', id: server.id },
        { email: manager.email, password: manager.password, role: 'manager', id: manager.id },
        { email: owner.email, password: owner.password, role: 'owner', id: owner.user.id },
      ]) {
        const loginRes = await pos.request('serverApp', '/api/auth/login', {
          method: 'POST',
          body: { email: account.email, password: account.password },
        });
        const login = assertJson<{ access_token: string; user: { id: string; role: string } }>(
          loginRes,
          200,
          (d) => typeof d.access_token === 'string' && d.user?.role === account.role,
        );
        assertJson(
          await pos.request('serverApp', '/api/auth/me', { token: login.access_token }),
          200,
          (d) => d.user?.id === account.id && d.user?.role === account.role,
        );
      }
    });
  },
});

registerTest({
  id: 'f7-t1-proxy-catalog-tables-orders',
  tier: 1,
  feature: 'F7',
  title: 'Server token on :3003 proxies categories, products, tables, order creation, listing, and item append',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Waiter',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const srvToken = (await pos.login(server.email, server.password, 'serverApp')).token;

      assertJson(
        await pos.request('serverApp', '/api/categories', { token: srvToken }),
        200,
        (d) => Array.isArray(d.categories) && d.categories.length >= 2,
      );
      assertJson(
        await pos.request('serverApp', '/api/products', { token: srvToken }),
        200,
        (d) => Array.isArray(d.products) && d.products.length >= 4,
      );
      assertJson(
        await pos.request('serverApp', '/api/tables', { token: srvToken }),
        200,
        (d) => Array.isArray(d.tables) && d.tables.length >= 3,
      );

      const orderRes = await pos.request('serverApp', '/api/orders', {
        method: 'POST',
        token: srvToken,
        idempotencyKey: `srv-ord-${crypto.randomUUID()}`,
        body: {
          type: 'dine_in',
          table_id: 'tbl-express-1',
          items: [{ product_id: 'prod-express-meal', quantity: 1 }],
        },
      });
      const order = assertJson<{ order: any }>(orderRes, 201).order;

      assertJson(
        await pos.request('serverApp', '/api/orders?today=true', { token: srvToken }),
        200,
        (d) => Array.isArray(d.orders) && d.orders.some((o: any) => o.id === order.id),
      );

      const appendRes = await pos.request('serverApp', `/api/orders/${order.id}/items`, {
        method: 'POST',
        token: srvToken,
        body: { items: [{ product_id: 'prod-express-tea', quantity: 2 }] },
      });
      assertJson(appendRes, 200, (d) => d.order?.items?.length === 2 && d.order?.total === 200);
    });
  },
});

registerTest({
  id: 'f7-t1-proxy-customers-and-crm',
  tier: 1,
  feature: 'F7',
  title: 'Server token on :3003 creates customer and queries /api/customers-search and /api/crm/lookup',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Waiter CRM',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const srvToken = (await pos.login(server.email, server.password, 'serverApp')).token;

      const createCust = await pos.request('serverApp', '/api/customers', {
        method: 'POST',
        token: srvToken,
        body: { name: 'Riya Sharma', phone: '+919876543210' },
      });
      assertStatus(createCust, 201);

      // True target spec (B-F5-1): /api/customers-search and /api/crm/lookup allow sales roles including server
      const searchRes = await pos.request('serverApp', '/api/customers-search?q=Riya', { token: srvToken });
      assertJson(
        searchRes,
        200,
        (d) => Array.isArray(d) && d.some((c: any) => c.name === 'Riya Sharma'),
      );

      const lookupRes = await pos.request(
        'serverApp',
        '/api/crm/lookup?phone=%2B919876543210',
        { token: srvToken },
      );
      assertJson(lookupRes, 200, (d) => d.found === true && d.customer?.name === 'Riya Sharma');
    });
  },
});

registerTest({
  id: 'f7-t1-proxy-idempotency-replay',
  tier: 1,
  feature: 'F7',
  title: 'Server App :3003 forwards Idempotency-Key across :3003/:3001 replays and rejects body mismatch with 409',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Waiter Idem',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const srvToken = (await pos.login(server.email, server.password, 'serverApp')).token;
      const key = `sa-idem-${crypto.randomUUID()}`;
      const body = { type: 'takeaway', items: [{ product_id: 'prod-express-meal', quantity: 1 }] };

      const r1 = await pos.request('serverApp', '/api/orders', {
        method: 'POST',
        token: srvToken,
        idempotencyKey: key,
        body,
      });
      const o1 = assertJson<{ order: any }>(r1, 201).order;

      const r2 = await pos.request('serverApp', '/api/orders', {
        method: 'POST',
        token: srvToken,
        idempotencyKey: key,
        body,
      });
      const o2 = assertJson<{ order: any }>(r2, 200).order;
      assertEqual(o2.id, o1.id);

      const r3 = await pos.request('main', '/api/orders', {
        method: 'POST',
        token: srvToken,
        idempotencyKey: key,
        body,
      });
      const o3 = assertJson<{ order: any }>(r3, 200).order;
      assertEqual(o3.id, o1.id);

      const mismatch = await pos.request('serverApp', '/api/orders', {
        method: 'POST',
        token: srvToken,
        idempotencyKey: key,
        body: { type: 'takeaway', items: [{ product_id: 'prod-express-snack', quantity: 1 }] },
      });
      assertStatus(mismatch, 409);
    });
  },
});

registerTest({
  id: 'f7-t1-logout-revokes-token',
  tier: 1,
  feature: 'F7',
  title: 'POST /api/auth/logout on :3003 revokes token across both :3003 and :3001',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Waiter Logout',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const srvToken = (await pos.login(server.email, server.password, 'serverApp')).token;

      assertJson(
        await pos.request('serverApp', '/api/auth/logout', { method: 'POST', token: srvToken }),
        200,
        (d) => d.success === true,
      );

      assertStatus(await pos.request('serverApp', '/api/auth/me', { token: srvToken }), 401);
      assertStatus(await pos.request('serverApp', '/api/orders', { token: srvToken }), 401);
      assertStatus(await pos.request('main', '/api/orders', { token: srvToken }), 401);
    });
  },
});

registerTest({
  id: 'f7-t2-non-serverapp-roles-403',
  tier: 2,
  feature: 'F7',
  title: 'Server App :3003 rejects chef and cashier on login and rejects cashier JWT from :3001 with 403',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const chef = await createStaffUser(pos, owner.token, {
        name: 'Chef',
        email: 'chef@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });

      assertStatus(
        await pos.request('serverApp', '/api/auth/login', {
          method: 'POST',
          body: { email: chef.email, password: chef.password },
        }),
        403,
      );
      assertStatus(
        await pos.request('serverApp', '/api/auth/login', {
          method: 'POST',
          body: { email: cashier.email, password: cashier.password },
        }),
        403,
      );

      const cashierMainToken = (await pos.login(cashier.email, cashier.password, 'main')).token;
      assertStatus(await pos.request('serverApp', '/api/auth/me', { token: cashierMainToken }), 403);
      assertStatus(await pos.request('serverApp', '/api/orders', { token: cashierMainToken }), 403);
    });
  },
});

registerTest({
  id: 'f7-t2-disabled-server-app-404',
  tier: 2,
  feature: 'F7',
  title: 'Setting server_app_enabled=false returns 404 on :3003 info/auth/proxy routes while /api/health stays 200',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Server Disabled',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const srvToken = (await pos.login(server.email, server.password, 'serverApp')).token;

      assertStatus(
        await pos.request('main', '/api/settings/server_app_enabled', {
          method: 'PUT',
          token: owner.token,
          body: { value: 'false' },
        }),
        200,
      );

      assertStatus(await pos.request('serverApp', '/api/health'), 200);
      assertStatus(await pos.request('serverApp', '/api/server-app/info'), 404);
      assertStatus(
        await pos.request('serverApp', '/api/auth/login', {
          method: 'POST',
          body: { email: server.email, password: server.password },
        }),
        404,
      );
      assertStatus(await pos.request('serverApp', '/api/auth/me', { token: srvToken }), 404);
      assertStatus(await pos.request('serverApp', '/api/orders', { token: srvToken }), 404);
    });
  },
});

registerTest({
  id: 'f7-t2-logout-durable-across-restart',
  tier: 2,
  feature: 'F7',
  title: 'Server App :3003 logout token revocation persists in SQLite across POS restart',
  async run() {
    const sharedJwtSecret = crypto.randomBytes(32).toString('hex');
    let persistedTmpDir = '';
    let persistedDbPath = '';
    let revokedToken = '';

    try {
      await withLocalPos({ keepTempDir: true, jwtSecret: sharedJwtSecret }, async (pos1) => {
        persistedTmpDir = pos1.tmpDir;
        persistedDbPath = pos1.dbPath;
        const owner = await pos1.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
        const server = await createStaffUser(pos1, owner.token, {
          name: 'Waiter Restart',
          email: 'server@e2e.local',
          password: 'StaffPass123!',
          role: 'server',
        });
        revokedToken = (await pos1.login(server.email, server.password, 'serverApp')).token;
        assertStatus(
          await pos1.request('serverApp', '/api/auth/logout', { method: 'POST', token: revokedToken }),
          200,
        );
      });

      await withLocalPos(
        {
          jwtSecret: sharedJwtSecret,
          env: {
            OIU_DEV_USER_DATA: persistedTmpDir,
            OIU_E2E_DB_PATH: persistedDbPath,
          },
        },
        async (pos2) => {
          // True target spec (B-F7-1): revoked token remains 401 across restart
          assertStatus(await pos2.request('serverApp', '/api/auth/me', { token: revokedToken }), 401);
          assertStatus(await pos2.request('main', '/api/orders', { token: revokedToken }), 401);
        },
      );
    } finally {
      if (persistedTmpDir) {
        await removeTempDirWithRetry(persistedTmpDir).catch(() => undefined);
      }
    }
  },
});

registerTest({
  id: 'f7-t2-invalid-credentials-and-missing-token',
  tier: 2,
  feature: 'F7',
  title: 'Server App :3003 returns 401 on wrong password, 400 on missing fields, and 401 without token',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Server Creds',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });

      assertStatus(
        await pos.request('serverApp', '/api/auth/login', {
          method: 'POST',
          body: { email: server.email, password: 'WrongPassword1!' },
        }),
        401,
      );
      assertStatus(
        await pos.request('serverApp', '/api/auth/login', {
          method: 'POST',
          body: { email: server.email },
        }),
        400,
      );
      assertStatus(await pos.request('serverApp', '/api/auth/me'), 401);
      assertStatus(await pos.request('serverApp', '/api/orders'), 401);
    });
  },
});

registerTest({
  id: 'f7-t2-proxy-preserves-server-ownership-403',
  tier: 2,
  feature: 'F7',
  title: 'Server App :3003 proxy preserves server ownership: 403 on appending to owner order and excludes from GET /api/orders',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Server Scope',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const srvToken = (await pos.login(server.email, server.password, 'serverApp')).token;

      const ownerOrder = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });

      assertStatus(
        await pos.request('serverApp', `/api/orders/${ownerOrder.id}/items`, {
          method: 'POST',
          token: srvToken,
          body: { items: [{ product_id: 'prod-express-tea', quantity: 1 }] },
        }),
        403,
      );

      const srvOrders = await pos.request('serverApp', '/api/orders?today=true', { token: srvToken });
      assertJson(
        srvOrders,
        200,
        (d) => Array.isArray(d.orders) && !d.orders.some((o: any) => o.id === ownerOrder.id),
      );
    });
  },
});

// ============================================================================
// F8 — Local Billing, Split, Payments, Refunds & Closures (7 Tier 1 + 8 Tier 2)
// ============================================================================

registerTest({
  id: 'f8-t1-bill-generate-resync-and-discount',
  tier: 1,
  feature: 'F8',
  title: 'Bill generation, applyDiscount, re-sync via /generate, and GET bill endpoints work cleanly',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });

      const gen1 = await pos.request('main', '/api/bills/generate', {
        method: 'POST',
        token: owner.token,
        body: { order_id: order.id },
      });
      const bill1 = assertJson<{ bill: any }>(gen1, 201).bill;
      assertEqual(bill1.total, 300);

      const discRes = await pos.request('main', `/api/bills/${bill1.id}/applyDiscount`, {
        method: 'POST',
        token: owner.token,
        body: { type: 'percentage', value: 10, reason: 'VIP' },
      });
      const discBill = assertJson<{ bill: any }>(discRes, 200).bill;
      assertEqual(discBill.discount_amount, 30);
      assertEqual(discBill.total, 270);

      // Append item to order and re-sync via /generate (returns 200)
      assertStatus(
        await pos.request('main', `/api/orders/${order.id}/items`, {
          method: 'POST',
          token: owner.token,
          body: { items: [{ product_id: 'prod-express-tea', quantity: 2 }] },
        }),
        200,
      );

      const gen2 = await pos.request('main', '/api/bills/generate', {
        method: 'POST',
        token: owner.token,
        body: { order_id: order.id },
      });
      const bill2 = assertJson<{ bill: any }>(gen2, 200).bill;
      assertEqual(bill2.id, bill1.id);
      assertEqual(bill2.subtotal, 350);

      assertJson(
        await pos.request('main', '/api/bills?today=true', { token: owner.token }),
        200,
        (d) => Array.isArray(d.bills) && d.bills.some((b: any) => b.id === bill1.id),
      );
      assertJson(
        await pos.request('main', `/api/bills/${bill1.id}`, { token: owner.token }),
        200,
        (d) => d.bill?.id === bill1.id && d.bill?.order?.id === order.id,
      );
      assertJson(
        await pos.request('main', `/api/bills/order/${order.id}`, { token: owner.token }),
        200,
        (d) => d.bill?.id === bill1.id,
      );
    });
  },
});

registerTest({
  id: 'f8-t1-split-check-and-independent-settlement',
  tier: 1,
  feature: 'F8',
  title: 'Split check creates 2 independent checks and completes order + frees table only when last check is paid',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      assertStatus(
        await pos.request('main', '/api/settings/split_checks_enabled', {
          method: 'PUT',
          token: owner.token,
          body: { value: 'true' },
        }),
        200,
      );

      const order = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [
          { product_id: 'prod-express-meal', quantity: 2 },
          { product_id: 'prod-express-snack', quantity: 2 },
        ],
      });
      const bill = await generateBill(pos, owner.token, order.id);
      const item1 = order.items[0];
      const item2 = order.items[1];

      const splitRes = await pos.request('main', `/api/bills/${bill.id}/split-check`, {
        method: 'POST',
        token: owner.token,
        body: {
          checks: [
            {
              label: 'Guest A',
              items: [
                { order_item_id: item1.id, quantity: 1 },
                { order_item_id: item2.id, quantity: 1 },
              ],
            },
            {
              label: 'Guest B',
              items: [
                { order_item_id: item1.id, quantity: 1 },
                { order_item_id: item2.id, quantity: 1 },
              ],
            },
          ],
        },
      });
      const splitData = assertJson<{ bills: any[] }>(splitRes, 201);
      assertEqual(splitData.bills.length, 2);
      const sumTotal = splitData.bills[0].total + splitData.bills[1].total;
      assertEqual(sumTotal, bill.total);

      assertJson(
        await pos.request('main', `/api/bills/${splitData.bills[0].id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'card', amount: splitData.bills[0].total },
        }),
        200,
        (d) => d.bill?.payment_status === 'paid',
      );

      const midOrder = await pos.request('main', `/api/orders/${order.id}`, { token: owner.token });
      assertJson(midOrder, 200, (d) => d.order?.status !== 'completed');

      assertJson(
        await pos.request('main', `/api/bills/${splitData.bills[1].id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: splitData.bills[1].total },
        }),
        200,
        (d) => d.bill?.payment_status === 'paid',
      );

      const finalOrder = await pos.request('main', `/api/orders/${order.id}`, { token: owner.token });
      assertJson(finalOrder, 200, (d) => d.order?.status === 'completed');

      const tbl = await pos.request('main', '/api/tables/tbl-express-1', { token: owner.token });
      assertJson(tbl, 200, (d) => d.table?.status === 'available');
    });
  },
});

registerTest({
  id: 'f8-t1-single-and-multi-tender-payments',
  tier: 1,
  feature: 'F8',
  title: 'Partial single payment followed by multi-tender batch payment settles bill and computes cash change',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });
      const bill = await generateBill(pos, owner.token, order.id);
      assertEqual(bill.total, 300);

      const part1 = await pos.request('main', `/api/bills/${bill.id}/payment`, {
        method: 'POST',
        token: owner.token,
        body: { method: 'card', amount: 100 },
      });
      assertJson(
        part1,
        200,
        (d) => d.bill?.paid_amount === 100 && d.bill?.balance === 200 && d.bill?.payment_status === 'partial',
      );

      const part2 = await pos.request('main', `/api/bills/${bill.id}/payments`, {
        method: 'POST',
        token: owner.token,
        body: {
          payments: [
            { method: 'card', amount: 50 },
            { method: 'cash', amount: 200 },
          ],
        },
      });
      const settled = assertJson<{ bill: any }>(part2, 200).bill;
      assertEqual(settled.paid_amount, 300);
      assertEqual(settled.balance, 0);
      assertEqual(settled.payment_status, 'paid');
      const details = Array.isArray(settled.payment_details)
        ? settled.payment_details
        : JSON.parse(settled.payment_details);
      const cashLine = details.find((p: any) => p.method === 'cash');
      assertEqual(cashLine?.change_amount, 50);
    });
  },
});

registerTest({
  id: 'f8-t1-atomic-tip-and-idempotent-replay',
  tier: 1,
  feature: 'F8',
  title: 'Payment tip_amount is returned atomically on bill and idempotent replay does not double-count tips',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });

      const ord1 = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill1 = await generateBill(pos, owner.token, ord1.id);
      const key1 = `tip-single-${crypto.randomUUID()}`;
      const payBody1 = { method: 'card', amount: bill1.total, tip_amount: 25 };

      // True target spec (B-F8-1): returned bill includes tip_amount=25 and replay keeps tip_amount=25
      const p1a = await pos.request('main', `/api/bills/${bill1.id}/payment`, {
        method: 'POST',
        token: owner.token,
        idempotencyKey: key1,
        body: payBody1,
      });
      assertJson(p1a, 200, (d) => d.bill?.tip_amount === 25);

      const p1b = await pos.request('main', `/api/bills/${bill1.id}/payment`, {
        method: 'POST',
        token: owner.token,
        idempotencyKey: key1,
        body: payBody1,
      });
      assertJson(p1b, 200, (d) => d.bill?.tip_amount === 25);

      const fresh1 = await pos.request('main', `/api/bills/${bill1.id}`, { token: owner.token });
      assertJson(fresh1, 200, (d) => d.bill?.tip_amount === 25);

      // Verify /payments batch endpoint too
      const ord2 = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-snack', quantity: 1 }],
      });
      const bill2 = await generateBill(pos, owner.token, ord2.id);
      const key2 = `tip-batch-${crypto.randomUUID()}`;
      const payBody2 = { payments: [{ method: 'cash', amount: bill2.total }], tip_amount: 30 };

      const p2a = await pos.request('main', `/api/bills/${bill2.id}/payments`, {
        method: 'POST',
        token: owner.token,
        idempotencyKey: key2,
        body: payBody2,
      });
      assertJson(p2a, 200, (d) => d.bill?.tip_amount === 30);

      const p2b = await pos.request('main', `/api/bills/${bill2.id}/payments`, {
        method: 'POST',
        token: owner.token,
        idempotencyKey: key2,
        body: payBody2,
      });
      assertJson(p2b, 200, (d) => d.bill?.tip_amount === 30);

      const fresh2 = await pos.request('main', `/api/bills/${bill2.id}`, { token: owner.token });
      assertJson(fresh2, 200, (d) => d.bill?.tip_amount === 30);
    });
  },
});

registerTest({
  id: 'f8-t1-payment-methods-crud-and-merge',
  tier: 1,
  feature: 'F8',
  title: 'Custom payment methods CRUD, bill settlement via payment_method_id, merge, and merge-history',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });

      const sodexo = assertJson<{ payment_method: { id: number; name: string } }>(
        await pos.request('main', '/api/payment-methods', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Sodexo' },
        }),
        201,
      ).payment_method;
      const voucher = assertJson<{ payment_method: { id: number; name: string } }>(
        await pos.request('main', '/api/payment-methods', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Voucher' },
        }),
        201,
      ).payment_method;

      const renamed = assertJson<{ payment_method: { id: number; name: string } }>(
        await pos.request('main', `/api/payment-methods/${sodexo.id}`, {
          method: 'PUT',
          token: owner.token,
          body: { name: 'Pluxee' },
        }),
        200,
      ).payment_method;
      assertEqual(renamed.name, 'Pluxee');

      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, order.id);

      assertJson(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'custom', payment_method_id: sodexo.id, amount: bill.total },
        }),
        200,
        (d) => d.bill?.payment_status === 'paid',
      );

      const mergeRes = await pos.request('main', `/api/payment-methods/${sodexo.id}/merge`, {
        method: 'POST',
        token: owner.token,
        body: { target_type: 'custom', target_id: voucher.id },
      });
      assertJson(
        mergeRes,
        200,
        (d) =>
          d.merge?.source_name === 'Pluxee' &&
          d.merge?.target_name === 'Voucher' &&
          d.merge?.affected_payments === 1,
      );

      const historyRes = await pos.request('main', '/api/payment-methods/merge-history', { token: owner.token });
      assertJson(
        historyRes,
        200,
        (d) =>
          Array.isArray(d.merges) &&
          d.merges.some((m: any) => m.source_name === 'Pluxee' && m.target_name === 'Voucher'),
      );
    });
  },
});

registerTest({
  id: 'f8-t1-refunds-bill-and-item-level',
  tier: 1,
  feature: 'F8',
  title: 'Bill-level partial refund and item-level refund (preparing item) update payment_status and list in GET /api/refunds',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });

      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: 'prod-express-meal', quantity: 1 }, // 150
          { product_id: 'prod-express-snack', quantity: 1 }, // 80
        ],
      });
      const snackItem = order.items.find((i: any) => i.product_id === 'prod-express-snack');
      assertStatus(
        await pos.request('main', `/api/kds/items/${snackItem.id}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'preparing' },
        }),
        200,
      );

      const bill = await generateBill(pos, owner.token, order.id);
      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: bill.total },
        }),
        200,
      );

      const partialRef = await pos.request('main', '/api/refunds', {
        method: 'POST',
        token: owner.token,
        body: {
          bill_id: bill.id,
          amount: 150,
          method: 'cash',
          reason: 'Meal quality',
          override_pin: MANAGER_PIN,
        },
      });
      assertJson(partialRef, 201, (d) => d.bill?.payment_status === 'partially_refunded');

      const itemRef = await pos.request('main', '/api/refunds', {
        method: 'POST',
        token: owner.token,
        body: {
          bill_id: bill.id,
          order_item_id: snackItem.id,
          method: 'cash',
          reason: 'Snack cold',
          override_pin: MANAGER_PIN,
        },
      });
      assertJson(
        itemRef,
        201,
        (d) => d.bill?.payment_status === 'refunded' && d.refund?.order_item_id === snackItem.id,
      );

      const listRes = await pos.request('main', `/api/refunds?bill_id=${bill.id}`, { token: owner.token });
      assertJson(listRes, 200, (d) => Array.isArray(d.refunds) && d.refunds.length === 2);
    });
  },
});

registerTest({
  id: 'f8-t1-cash-closure-z-report',
  tier: 1,
  feature: 'F8',
  title: 'Owner posts day cash closure Z-report reconciling cash sales, cash refunds, float, and variance',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });

      const order = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }], // 150
      });
      const bill = await generateBill(pos, owner.token, order.id);
      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: 150 },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', '/api/refunds', {
          method: 'POST',
          token: owner.token,
          body: { bill_id: bill.id, amount: 50, method: 'cash', reason: 'Partial', override_pin: MANAGER_PIN },
        }),
        201,
      );

      // Opening float 100.00 (10000 cents) + 150.00 cash - 50.00 cash refund = 200.00 (20000 cents)
      const todayLocal = getTodayInKolkata();
      const closeRes = await pos.request('main', '/api/cash-closures', {
        method: 'POST',
        token: owner.token,
        body: {
          business_date: todayLocal,
          opening_float_cents: 10000,
          counted_cash_cents: 20000,
          notes: 'Clean drawer',
        },
      });
      const z = assertJson<{ zReport: any }>(closeRes, 201).zReport;
      assertEqual(z.business_date, todayLocal);
      assertEqual(z.expected_cash_cents, 20000);
      assertEqual(z.variance_cents, 0);
      assertEqual(z.gross_collected_cents, 15000);
      assertEqual(z.refunded_cents, 5000);
      assertEqual(z.net_collected_cents, 10000);
      assertEqual(z.bill_count, 1);
      assertEqual(z.refund_count, 1);
      assert(typeof z.z_number === 'number' && z.z_number >= 1, 'Expected positive z_number');
    });
  },
});

registerTest({
  id: 'f8-t2-split-check-validation-boundaries',
  tier: 2,
  feature: 'F8',
  title: 'Split check rejects disabled setting (403), <2/>20 checks (400), incomplete allocation (400), takeaway (400), and already-split/paid (409)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      const dineIn = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });
      const dineBill = await generateBill(pos, owner.token, dineIn.id);
      const dineItemId = dineIn.items[0].id;

      // Disabled by default -> 403
      assertStatus(
        await pos.request('main', `/api/bills/${dineBill.id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: {
            checks: [
              { items: [{ order_item_id: dineItemId, quantity: 1 }] },
              { items: [{ order_item_id: dineItemId, quantity: 1 }] },
            ],
          },
        }),
        403,
      );

      assertStatus(
        await pos.request('main', '/api/settings/split_checks_enabled', {
          method: 'PUT',
          token: owner.token,
          body: { value: 'true' },
        }),
        200,
      );

      // < 2 checks -> 400
      assertStatus(
        await pos.request('main', `/api/bills/${dineBill.id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: { checks: [{ items: [{ order_item_id: dineItemId, quantity: 2 }] }] },
        }),
        400,
      );

      // > 20 checks -> 400
      const twentyOne = Array.from({ length: 21 }, (_, idx) => ({
        label: `G${idx + 1}`,
        items: [{ order_item_id: dineItemId, quantity: 1 }],
      }));
      assertStatus(
        await pos.request('main', `/api/bills/${dineBill.id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: { checks: twentyOne },
        }),
        400,
      );

      // Incomplete item allocation (only 1 of 2) -> 400
      assertStatus(
        await pos.request('main', `/api/bills/${dineBill.id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: {
            checks: [
              { items: [{ order_item_id: dineItemId, quantity: 1 }] },
              { items: [] },
            ],
          },
        }),
        400,
      );

      // Takeaway -> 400
      const takeaway = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });
      const takeawayBill = await generateBill(pos, owner.token, takeaway.id);
      assertStatus(
        await pos.request('main', `/api/bills/${takeawayBill.id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: {
            checks: [
              { items: [{ order_item_id: takeaway.items[0].id, quantity: 1 }] },
              { items: [{ order_item_id: takeaway.items[0].id, quantity: 1 }] },
            ],
          },
        }),
        400,
      );

      // Valid split then re-split -> 409
      const splitOk = await pos.request('main', `/api/bills/${dineBill.id}/split-check`, {
        method: 'POST',
        token: owner.token,
        body: {
          checks: [
            { items: [{ order_item_id: dineItemId, quantity: 1 }] },
            { items: [{ order_item_id: dineItemId, quantity: 1 }] },
          ],
        },
      });
      const splitBills = assertJson<{ bills: any[] }>(splitOk, 201).bills;
      assertStatus(
        await pos.request('main', `/api/bills/${splitBills[0].id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: {
            checks: [
              { items: [{ order_item_id: dineItemId, quantity: 1 }] },
              { items: [{ order_item_id: dineItemId, quantity: 1 }] },
            ],
          },
        }),
        409,
      );

      // Paid bill -> 409
      const dineIn2 = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-2',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });
      const paidBill = await generateBill(pos, owner.token, dineIn2.id);
      assertStatus(
        await pos.request('main', `/api/bills/${paidBill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: paidBill.total },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', `/api/bills/${paidBill.id}/split-check`, {
          method: 'POST',
          token: owner.token,
          body: {
            checks: [
              { items: [{ order_item_id: dineIn2.items[0].id, quantity: 1 }] },
              { items: [{ order_item_id: dineIn2.items[0].id, quantity: 1 }] },
            ],
          },
        }),
        409,
      );
    });
  },
});

registerTest({
  id: 'f8-t2-payment-idempotency-mismatch-and-txn-ref',
  tier: 2,
  feature: 'F8',
  title: 'Payment rejects Idempotency-Key body mismatch (409), duplicate transaction_id across bills (409), and card overpay (400)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const ord1 = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill1 = await generateBill(pos, owner.token, ord1.id);

      const ord2 = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-snack', quantity: 1 }],
      });
      const bill2 = await generateBill(pos, owner.token, ord2.id);

      // Card overpay -> 400
      assertStatus(
        await pos.request('main', `/api/bills/${bill1.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'card', amount: bill1.total + 50 },
        }),
        400,
      );

      const key = `pay-mismatch-${crypto.randomUUID()}`;
      assertStatus(
        await pos.request('main', `/api/bills/${bill1.id}/payment`, {
          method: 'POST',
          token: owner.token,
          idempotencyKey: key,
          body: { method: 'card', amount: 150, transaction_id: 'TXN-UNIQUE-1' },
        }),
        200,
      );

      assertStatus(
        await pos.request('main', `/api/bills/${bill1.id}/payment`, {
          method: 'POST',
          token: owner.token,
          idempotencyKey: key,
          body: { method: 'cash', amount: 150 },
        }),
        409,
      );

      // Reusing same transaction_id on bill2 -> 409
      assertStatus(
        await pos.request('main', `/api/bills/${bill2.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'card', amount: 80, transaction_id: 'TXN-UNIQUE-1' },
        }),
        409,
      );
    });
  },
});

registerTest({
  id: 'f8-t2-payment-methods-reserved-and-in-use-409',
  tier: 2,
  feature: 'F8',
  title: 'Payment methods reject reserved names (409), delete when referenced by bill (409), and cashier creation (403)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;

      assertStatus(
        await pos.request('main', '/api/payment-methods', {
          method: 'POST',
          token: cashierToken,
          body: { name: 'MealPass' },
        }),
        403,
      );
      assertStatus(
        await pos.request('main', '/api/payment-methods', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Cash' },
        }),
        409,
      );
      assertStatus(
        await pos.request('main', '/api/payment-methods', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Wallet' },
        }),
        409,
      );

      const pm = assertJson<{ payment_method: { id: number } }>(
        await pos.request('main', '/api/payment-methods', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Corporate Card' },
        }),
        201,
      ).payment_method;

      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, ord.id);
      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'custom', payment_method_id: pm.id, amount: bill.total },
        }),
        200,
      );

      assertStatus(
        await pos.request('main', `/api/payment-methods/${pm.id}`, {
          method: 'DELETE',
          token: owner.token,
        }),
        409,
      );
    });
  },
});

registerTest({
  id: 'f8-t2-refund-pin-rate-limit-and-over-refund',
  tier: 2,
  feature: 'F8',
  title: 'Refund enforces RBAC (403), unpaid/over-refund (400), missing PIN (400), and PIN 429 rate limit',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;

      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, ord.id);

      assertStatus(
        await pos.request('main', '/api/refunds', {
          method: 'POST',
          token: cashierToken,
          body: { bill_id: bill.id, amount: 50, method: 'cash', override_pin: MANAGER_PIN },
        }),
        403,
      );

      // Unpaid bill -> 400
      assertStatus(
        await pos.request('main', '/api/refunds', {
          method: 'POST',
          token: owner.token,
          body: { bill_id: bill.id, amount: 50, method: 'cash', override_pin: MANAGER_PIN },
        }),
        400,
      );

      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: bill.total },
        }),
        200,
      );

      // Over-refund -> 400
      assertStatus(
        await pos.request('main', '/api/refunds', {
          method: 'POST',
          token: owner.token,
          body: { bill_id: bill.id, amount: bill.total + 10, method: 'cash', override_pin: MANAGER_PIN },
        }),
        400,
      );

      // Missing PIN -> 400
      assertStatus(
        await pos.request('main', '/api/refunds', {
          method: 'POST',
          token: owner.token,
          body: { bill_id: bill.id, amount: 50, method: 'cash' },
        }),
        400,
      );

      // 5 wrong PINs -> 403, 6th -> 429
      for (let i = 0; i < 5; i += 1) {
        assertStatus(
          await pos.request('main', '/api/refunds', {
            method: 'POST',
            token: owner.token,
            body: { bill_id: bill.id, amount: 10, method: 'cash', override_pin: `888${i}` },
          }),
          403,
        );
      }
      assertStatus(
        await pos.request('main', '/api/refunds', {
          method: 'POST',
          token: owner.token,
          body: { bill_id: bill.id, amount: 10, method: 'cash', override_pin: MANAGER_PIN },
        }),
        429,
      );
    });
  },
});

registerTest({
  id: 'f8-t2-refund-idempotency-and-item-eligibility',
  tier: 2,
  feature: 'F8',
  title: 'Refund Idempotency-Key replays 201 / rejects mismatch 409 and rejects pending/served/cancelled items with 409',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });

      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: 'prod-express-meal', quantity: 1 },
          { product_id: 'prod-express-snack', quantity: 1 },
          { product_id: 'prod-express-tea', quantity: 1 },
        ],
      });
      const pendingItem = ord.items[0];
      const servedItem = ord.items[1];
      const cancelledItem = ord.items[2];

      assertStatus(
        await pos.request('main', `/api/kds/items/${servedItem.id}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'served' },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${ord.id}/items/${cancelledItem.id}/cancel`, {
          method: 'PATCH',
          token: owner.token,
          body: {},
        }),
        200,
      );

      const bill = await generateBill(pos, owner.token, ord.id);
      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: bill.total },
        }),
        200,
      );

      for (const badItem of [pendingItem, servedItem, cancelledItem]) {
        assertStatus(
          await pos.request('main', '/api/refunds', {
            method: 'POST',
            token: owner.token,
            body: {
              bill_id: bill.id,
              order_item_id: badItem.id,
              method: 'cash',
              override_pin: MANAGER_PIN,
            },
          }),
          409,
        );
      }

      const key = `ref-idem-${crypto.randomUUID()}`;
      const body = { bill_id: bill.id, amount: 50, method: 'cash', reason: 'Goodwill', override_pin: MANAGER_PIN };
      const r1 = await pos.request('main', '/api/refunds', {
        method: 'POST',
        token: owner.token,
        idempotencyKey: key,
        body,
      });
      const ref1 = assertJson<{ refund: { id: number } }>(r1, 201).refund;

      const r2 = await pos.request('main', '/api/refunds', {
        method: 'POST',
        token: owner.token,
        idempotencyKey: key,
        body,
      });
      const ref2 = assertJson<{ refund: { id: number } }>(r2, 201).refund;
      assertEqual(ref2.id, ref1.id);

      assertStatus(
        await pos.request('main', '/api/refunds', {
          method: 'POST',
          token: owner.token,
          idempotencyKey: key,
          body: { ...body, amount: 40 },
        }),
        409,
      );
    });
  },
});

registerTest({
  id: 'f8-t2-cash-closure-duplicate-409-and-future-400',
  tier: 2,
  feature: 'F8',
  title: 'Cash closure rejects duplicate business_date (409), future date (400), and negative/float cents (400)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const todayLocal = getTodayInKolkata();
      const futureLocal = getTomorrowInKolkata();

      assertStatus(
        await pos.request('main', '/api/cash-closures', {
          method: 'POST',
          token: owner.token,
          body: { business_date: futureLocal, opening_float_cents: 0, counted_cash_cents: 0 },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', '/api/cash-closures', {
          method: 'POST',
          token: owner.token,
          body: { business_date: todayLocal, opening_float_cents: -1, counted_cash_cents: 0 },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', '/api/cash-closures', {
          method: 'POST',
          token: owner.token,
          body: { business_date: todayLocal, opening_float_cents: 10.5, counted_cash_cents: 0 },
        }),
        400,
      );

      assertStatus(
        await pos.request('main', '/api/cash-closures', {
          method: 'POST',
          token: owner.token,
          body: { business_date: todayLocal, opening_float_cents: 5000, counted_cash_cents: 5000 },
        }),
        201,
      );

      assertStatus(
        await pos.request('main', '/api/cash-closures', {
          method: 'POST',
          token: owner.token,
          body: { business_date: todayLocal, opening_float_cents: 5000, counted_cash_cents: 5000 },
        }),
        409,
      );
    });
  },
});

registerTest({
  id: 'f8-t2-cash-closure-rbac-and-print-no-printer',
  tier: 2,
  feature: 'F8',
  title: 'Cash closure rejects manager/cashier (403) and /:id/print returns 409 when no default printer configured',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const manager = await createStaffUser(pos, owner.token, {
        name: 'Manager',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const mgrToken = (await pos.login(manager.email, manager.password, 'main')).token;
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;
      const todayLocal = getTodayInKolkata();

      assertStatus(
        await pos.request('main', '/api/cash-closures', {
          method: 'POST',
          token: mgrToken,
          body: { business_date: todayLocal, opening_float_cents: 0, counted_cash_cents: 0 },
        }),
        403,
      );
      assertStatus(
        await pos.request('main', '/api/cash-closures', {
          method: 'POST',
          token: cashierToken,
          body: { business_date: todayLocal, opening_float_cents: 0, counted_cash_cents: 0 },
        }),
        403,
      );

      const closeRes = await pos.request('main', '/api/cash-closures', {
        method: 'POST',
        token: owner.token,
        body: { business_date: todayLocal, opening_float_cents: 0, counted_cash_cents: 0 },
      });
      const zId = assertJson<{ zReport: { id: number } }>(closeRes, 201).zReport.id;

      assertStatus(
        await pos.request('main', `/api/cash-closures/${zId}/print`, {
          method: 'POST',
          token: owner.token,
          body: {},
        }),
        409,
      );
    });
  },
});

registerTest({
  id: 'f8-t2-bill-discount-validation-boundaries',
  tier: 2,
  feature: 'F8',
  title: 'Bill applyDiscount rejects exceeding max percentage (400), paid bill (400), and split bill (409)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'finedine' });
      assertStatus(
        await pos.request('main', '/api/settings/split_checks_enabled', {
          method: 'PUT',
          token: owner.token,
          body: { value: 'true' },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', '/api/settings/discount', {
          method: 'PUT',
          token: owner.token,
          body: { discount_max_percentage: 20, discount_mode: 'percentage', discount_requires_approval: false },
        }),
        200,
      );

      const ord1 = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-1',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });
      const bill1 = await generateBill(pos, owner.token, ord1.id);

      assertStatus(
        await pos.request('main', `/api/bills/${bill1.id}/applyDiscount`, {
          method: 'POST',
          token: owner.token,
          body: { type: 'percentage', value: 30 },
        }),
        400,
      );

      assertStatus(
        await pos.request('main', `/api/bills/${bill1.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'cash', amount: bill1.total },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', `/api/bills/${bill1.id}/applyDiscount`, {
          method: 'POST',
          token: owner.token,
          body: { type: 'percentage', value: 10 },
        }),
        400,
      );

      const ord2 = await createOrder(pos, owner.token, {
        type: 'dine_in',
        table_id: 'tbl-express-2',
        items: [{ product_id: 'prod-express-meal', quantity: 2 }],
      });
      const bill2 = await generateBill(pos, owner.token, ord2.id);
      const splitRes = await pos.request('main', `/api/bills/${bill2.id}/split-check`, {
        method: 'POST',
        token: owner.token,
        body: {
          checks: [
            { items: [{ order_item_id: ord2.items[0].id, quantity: 1 }] },
            { items: [{ order_item_id: ord2.items[0].id, quantity: 1 }] },
          ],
        },
      });
      const splitBills = assertJson<{ bills: any[] }>(splitRes, 201).bills;
      assertStatus(
        await pos.request('main', `/api/bills/${splitBills[0].id}/applyDiscount`, {
          method: 'POST',
          token: owner.token,
          body: { type: 'percentage', value: 10 },
        }),
        409,
      );
    });
  },
});

// ============================================================================
// F9 — Local UPI, SAF, Tips, Tax/GST & E-Invoice (6 Tier 1 + 7 Tier 2)
// ============================================================================

registerTest({
  id: 'f9-t1-upi-qr-reconcile-and-status',
  tier: 1,
  feature: 'F9',
  title: 'UPI QR generation, authenticated upi-reconcile, and upi-status reflect settled UTR',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, ord.id);

      const qrRes = await pos.request('main', `/api/bills/${bill.id}/upi-qr`, { token: owner.token });
      assertJson(
        qrRes,
        200,
        (d) =>
          d.ok === true &&
          d.bill_id === bill.id &&
          d.vpa_valid === true &&
          typeof d.upi_uri === 'string' &&
          d.upi_uri.startsWith('upi://pay?') &&
          d.upi_uri.includes(`tr=${bill.bill_number}`) &&
          typeof d.qr_data_url === 'string' &&
          d.qr_data_url.startsWith('data:image/png;base64,') &&
          d.is_paid === false,
      );

      const recRes = await pos.request('main', `/api/bills/${bill.id}/upi-reconcile`, {
        method: 'POST',
        token: owner.token,
        body: {
          utr: 'UTR123456789012',
          amount: bill.total,
          payer_vpa: 'guest@upi',
          status: 'SUCCESS',
        },
      });
      assertJson(
        recRes,
        200,
        (d) => d.ok === true && d.success === true && d.billId === bill.id && d.utr === 'UTR123456789012',
      );

      const statusRes = await pos.request('main', `/api/bills/${bill.id}/upi-status`, { token: owner.token });
      assertJson(
        statusRes,
        200,
        (d) =>
          d.ok === true &&
          d.is_paid === true &&
          d.payment_status === 'paid' &&
          d.upi_details?.utr === 'UTR123456789012',
      );
    });
  },
});

registerTest({
  id: 'f9-t1-saf-queue-status-and-forward-batch',
  tier: 1,
  feature: 'F9',
  title: 'SAF status, queue offline card tx, list queued txs, and forward-batch settle',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, ord.id);

      assertJson(
        await pos.request('main', '/api/saf/status', { token: owner.token }),
        200,
        (d) => d.ok === true && d.limits?.enabled === true && d.limits?.floorLimit === 5000,
      );

      const qRes = await pos.request('main', '/api/saf/queue', {
        method: 'POST',
        token: owner.token,
        body: {
          order_id: ord.id,
          bill_id: bill.id,
          amount: 150,
          card_last4: '4242',
          card_brand: 'Visa',
          auth_code: 'AUTH123',
        },
      });
      const txId = assertJson<{ ok: boolean; transaction: { id: string; status: string } }>(qRes, 201).transaction.id;

      assertJson(
        await pos.request('main', '/api/saf/transactions?status=queued', { token: owner.token }),
        200,
        (d) => d.ok === true && d.transactions.some((t: any) => t.id === txId && t.status === 'queued'),
      );

      const fwdRes = await pos.request('main', '/api/saf/forward-batch', {
        method: 'POST',
        token: owner.token,
      });
      assertJson(
        fwdRes,
        200,
        (d) => d.ok === true && d.result?.processed === 1 && d.result?.settled === 1,
      );
    });
  },
});

registerTest({
  id: 'f9-t1-tips-distribute-and-summary',
  tier: 1,
  feature: 'F9',
  title: 'Tips collected on paid bills distribute equally across staff and reconcile in /api/bills/tips/summary',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'Tip Server',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Tip Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });

      const ord1 = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill1 = await generateBill(pos, owner.token, ord1.id);
      const ord2 = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-snack', quantity: 1 }],
      });
      const bill2 = await generateBill(pos, owner.token, ord2.id);

      // True target spec (depends on B-F8-1 atomic tip persistence)
      assertJson(
        await pos.request('main', `/api/bills/${bill1.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'card', amount: bill1.total, tip_amount: 60 },
        }),
        200,
        (d) => d.bill?.tip_amount === 60,
      );
      assertJson(
        await pos.request('main', `/api/bills/${bill2.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'card', amount: bill2.total, tip_amount: 40 },
        }),
        200,
        (d) => d.bill?.tip_amount === 40,
      );

      const distRes = await pos.request('main', '/api/bills/tips/distribute', {
        method: 'POST',
        token: owner.token,
        body: { distribution_rule: 'equal_split', staff_ids: [server.id, cashier.id] },
      });
      const dist = assertJson<{ ok: boolean; distribution: any }>(distRes, 201).distribution;
      assertEqual(dist.total_tips, 100);
      assertEqual(dist.allocations.length, 2);
      const allocSum = dist.allocations.reduce((s: number, a: any) => s + a.allocatedAmount, 0);
      assertEqual(allocSum, 100);

      const sumRes = await pos.request('main', '/api/bills/tips/summary', { token: owner.token });
      assertJson(
        sumRes,
        200,
        (d) =>
          d.ok === true &&
          d.summary?.totalTipsCollected === 100 &&
          d.summary?.totalTipsDistributed === 100 &&
          d.summary?.pendingTips === 0,
      );
    });
  },
});

registerTest({
  id: 'f9-t1-tax-pack-manual-config-and-preview',
  tier: 1,
  feature: 'F9',
  title: 'Manual 5%/18% GST pack configures /api/tax/categories, /test-calculation, and /api/tax/preview with discount scaling',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const { gst5Cat, gst18Cat } = await configureIndiaGstPack(pos, owner.token);

      const p5 = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: {
            category_id: 'cat-express-food',
            name: 'GST5 Dish',
            price: 100,
            tax_category_id: gst5Cat!.id,
            tax_behavior: 'exclusive',
          },
        }),
        201,
      ).product;

      const p18 = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: {
            category_id: 'cat-express-beverages',
            name: 'GST18 Drink',
            price: 200,
            tax_category_id: gst18Cat!.id,
            tax_behavior: 'exclusive',
          },
        }),
        201,
      ).product;

      const calcRes = await pos.request('main', '/api/tax-packs/test-calculation', {
        method: 'POST',
        token: owner.token,
        body: { category_id: gst18Cat!.id, amount: 200, tax_behavior: 'exclusive' },
      });
      assertJson(calcRes, 200, (d) => Number(d.calculation?.payableTotal) === 236);

      // Subtotal = 100 + 200 = 300; taxes = 5 + 36 = 41 -> total 341
      const previewRes = await pos.request('main', '/api/tax/preview', {
        method: 'POST',
        token: owner.token,
        body: {
          items: [
            { product_id: p5.id, quantity: 1 },
            { product_id: p18.id, quantity: 1 },
          ],
        },
      });
      assertJson(
        previewRes,
        200,
        (d) => d.summary?.subtotal === 300 && d.summary?.tax_amount === 41 && d.summary?.total === 341,
      );

      // 10% discount scales subtotal to 270 and tax to 36.90 -> total 306.90
      const discPreview = await pos.request('main', '/api/tax/preview', {
        method: 'POST',
        token: owner.token,
        body: {
          items: [
            { product_id: p5.id, quantity: 1 },
            { product_id: p18.id, quantity: 1 },
          ],
          discount_type: 'percentage',
          discount_value: 10,
        },
      });
      assertJson(
        discPreview,
        200,
        (d) =>
          d.summary?.discounted_subtotal === 270 &&
          d.summary?.tax_amount === 36.9 &&
          d.summary?.total === 306.9,
      );
    });
  },
});

registerTest({
  id: 'f9-t1-tax-pack-overrides-and-rollback',
  tier: 1,
  feature: 'F9',
  title: 'Tax pack overrides create/update/delete, version rollback, and audit trail work end-to-end',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const { cfg: v1, gst5Cat, gst18Cat } = await configureIndiaGstPack(pos, owner.token);

      const ovCreate = await pos.request('main', '/api/tax-packs/overrides', {
        method: 'POST',
        token: owner.token,
        body: {
          entity_type: 'product',
          entity_id: 'prod-express-meal', // price 150
          category_id: gst18Cat!.id,
        },
      });
      const ovId = assertJson<{ override: { id: string } }>(ovCreate, 201).override.id;

      const preview18 = await pos.request('main', '/api/tax/preview', {
        method: 'POST',
        token: owner.token,
        body: { items: [{ product_id: 'prod-express-meal', quantity: 1 }] },
      });
      assertJson(preview18, 200, (d) => d.summary?.tax_amount === 27 && d.summary?.total === 177);

      assertStatus(
        await pos.request('main', `/api/tax-packs/overrides/${ovId}`, {
          method: 'PUT',
          token: owner.token,
          body: { category_id: gst5Cat!.id },
        }),
        200,
      );

      assertStatus(
        await pos.request('main', `/api/tax-packs/overrides/${ovId}`, {
          method: 'DELETE',
          token: owner.token,
        }),
        200,
      );

      // Save a second manual-config version, then roll back to v1
      const v2Res = await pos.request('main', '/api/tax-packs/manual-config', {
        method: 'POST',
        token: owner.token,
        body: {
          inclusive: false,
          categories: [{ tempId: 'gst12', label: 'GST 12%', components: [{ label: 'GST', type: 'percent', value: 12 }] }],
          defaultProductCategoryTempId: 'gst12',
          packagingCategoryTempId: 'gst12',
          deliveryCategoryTempId: 'gst12',
          serviceChargeCategoryTempId: 'gst12',
        },
      });
      const v2 = assertJson<{ pack_id: string; version_id: string }>(v2Res, 200);
      assert(v2.version_id !== v1.version_id, 'Expected second version_id');

      const rollbackRes = await pos.request('main', `/api/tax-packs/${v1.pack_id}/rollback`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(rollbackRes, 200, (d) => d.active_version_id === v1.version_id);

      const auditRes = await pos.request('main', '/api/tax-packs/audit', { token: owner.token });
      assertJson(auditRes, 200, (d) => Array.isArray(d.audit) && d.audit.length >= 4);
    });
  },
});

registerTest({
  id: 'f9-t1-einvoice-dynamic-gst-and-irn-register',
  tier: 1,
  feature: 'F9',
  title: 'E-Invoice IRP JSON computes dynamic 18% CGST/SGST and registerIrn sets multi-item signedQr.itemCnt',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      assertStatus(
        await pos.request('main', '/api/settings/tax', {
          method: 'PUT',
          token: owner.token,
          body: {
            tax_registered: true,
            tax_registration_number: '29ABCDE1234F1Z5',
            state_code: '29',
            country: 'IN',
          },
        }),
        200,
      );
      const { gst18Cat } = await configureIndiaGstPack(pos, owner.token);

      const p1 = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: {
            category_id: 'cat-express-food',
            name: 'Item One 18%',
            price: 100,
            tax_category_id: gst18Cat!.id,
            tax_behavior: 'exclusive',
          },
        }),
        201,
      ).product;
      const p2 = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: {
            category_id: 'cat-express-food',
            name: 'Item Two 18%',
            price: 200,
            tax_category_id: gst18Cat!.id,
            tax_behavior: 'exclusive',
          },
        }),
        201,
      ).product;

      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: p1.id, quantity: 1 },
          { product_id: p2.id, quantity: 1 },
        ],
      });
      const bill = await generateBill(pos, owner.token, ord.id, {
        customer_gstin: '29AABCU9603R1ZM',
        customer_legal_name: 'Buyer Corp',
      });

      // True target spec (B-F9-2): dynamic 18% GstRt + 9%/9% CGST/SGST matching bill.tax_amount (54)
      const irpRes = await pos.request('main', `/api/bills/${bill.id}/einvoice`, { token: owner.token });
      const irp = assertJson<any>(irpRes, 200);
      assertEqual(irp.Version, '1.1');
      assertEqual(irp.ItemList.length, 2);
      assertEqual(irp.ItemList[0].GstRt, 18);
      assertEqual(irp.ItemList[0].CgstAmt, 9);
      assertEqual(irp.ItemList[0].SgstAmt, 9);
      assertEqual(irp.ItemList[1].GstRt, 18);
      assertEqual(irp.ItemList[1].CgstAmt, 18);
      assertEqual(irp.ItemList[1].SgstAmt, 18);
      assertEqual(irp.ValDtls.CgstVal + irp.ValDtls.SgstVal, bill.tax_amount);

      const jsonDl = await pos.request('main', `/api/bills/${bill.id}/einvoice/json`, { token: owner.token });
      assertStatus(jsonDl, 200);
      const disp = jsonDl.headers.get('content-disposition') ?? '';
      assert(disp.includes(`IRP-INV-${bill.id}.json`), `Expected IRP-INV-${bill.id}.json Content-Disposition`);

      const regRes = await pos.request('main', `/api/bills/${bill.id}/einvoice/register`, {
        method: 'POST',
        token: owner.token,
      });
      const reg = assertJson<any>(regRes, 200);
      assert(reg.ok === true && /^[0-9A-F]{64}$/.test(reg.irn), 'Expected 64-hex IRN');
      const qrPayload = JSON.parse(reg.signedQr);
      assertEqual(qrPayload.itemCnt, 2, 'Expected signedQr.itemCnt to equal active item count (2)');
    });
  },
});

registerTest({
  id: 'f9-t2-upi-webhook-unsigned-rejected',
  tier: 2,
  feature: 'F9',
  title: 'Unsigned/unauthenticated UPI webhooks on /api/webhooks/upi and /api/bills/upi-webhook must reject without paying bill',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, ord.id);

      // True target spec (B-F9-1): unsigned/unauthenticated requests rejected (401/403/503)
      const w1 = await pos.request('main', '/api/webhooks/upi', {
        method: 'POST',
        body: { bill_id: bill.id, amount: bill.total, utr: 'FAKEUTR001', status: 'SUCCESS' },
      });
      assertStatus(w1, [401, 403, 503]);

      const w2 = await pos.request('main', '/api/bills/upi-webhook', {
        method: 'POST',
        body: { bill_id: bill.id, amount: bill.total, utr: 'FAKEUTR002', status: 'SUCCESS' },
      });
      assertStatus(w2, [401, 403, 503]);

      const checkBill = await pos.request('main', `/api/bills/${bill.id}`, { token: owner.token });
      assertJson(checkBill, 200, (d) => d.bill?.payment_status === 'unpaid');
    });
  },
});

registerTest({
  id: 'f9-t2-upi-reconcile-underpayment-and-failure',
  tier: 2,
  feature: 'F9',
  title: 'UPI reconcile rejects FAILURE (400), underpayment (400), missing utr (400), and marks paid replay alreadyPaid=true',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }], // 150
      });
      const bill = await generateBill(pos, owner.token, ord.id);

      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/upi-reconcile`, {
          method: 'POST',
          token: owner.token,
          body: { utr: 'UTR-FAIL-1', amount: bill.total, status: 'FAILURE' },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/upi-reconcile`, {
          method: 'POST',
          token: owner.token,
          body: { utr: 'UTR-LOW-1', amount: bill.total - 5, status: 'SUCCESS' },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', `/api/bills/${bill.id}/upi-reconcile`, {
          method: 'POST',
          token: owner.token,
          body: { amount: bill.total, status: 'SUCCESS' },
        }),
        400,
      );

      assertJson(
        await pos.request('main', `/api/bills/${bill.id}/upi-reconcile`, {
          method: 'POST',
          token: owner.token,
          body: { utr: 'UTR-OK-1', amount: bill.total, status: 'SUCCESS' },
        }),
        200,
        (d) => d.ok === true && !d.alreadyPaid,
      );

      assertJson(
        await pos.request('main', `/api/bills/${bill.id}/upi-reconcile`, {
          method: 'POST',
          token: owner.token,
          body: { utr: 'UTR-OK-1', amount: bill.total, status: 'SUCCESS' },
        }),
        200,
        (d) => d.ok === true && d.alreadyPaid === true,
      );
    });
  },
});

registerTest({
  id: 'f9-t2-saf-limits-and-disabled-boundaries',
  tier: 2,
  feature: 'F9',
  title: 'SAF enforces floorLimit (5000), maxCumulative (50000), card_last4/auth_code (400), and RBAC (403)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'SAF Server',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'SAF Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const srvToken = (await pos.login(server.email, server.password, 'main')).token;
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;

      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, ord.id);

      assertStatus(
        await pos.request('main', '/api/saf/queue', {
          method: 'POST',
          token: srvToken,
          body: { order_id: ord.id, bill_id: bill.id, amount: 100, card_last4: '4242', auth_code: 'A1' },
        }),
        403,
      );
      assertStatus(
        await pos.request('main', '/api/saf/forward-batch', {
          method: 'POST',
          token: cashierToken,
        }),
        403,
      );

      // Invalid card_last4 / missing auth_code / exceeding floorLimit (5000) -> 400
      assertStatus(
        await pos.request('main', '/api/saf/queue', {
          method: 'POST',
          token: owner.token,
          body: { order_id: ord.id, bill_id: bill.id, amount: 100, card_last4: '42', auth_code: 'A1' },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', '/api/saf/queue', {
          method: 'POST',
          token: owner.token,
          body: { order_id: ord.id, bill_id: bill.id, amount: 100, card_last4: '4242' },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', '/api/saf/queue', {
          method: 'POST',
          token: owner.token,
          body: { order_id: ord.id, bill_id: bill.id, amount: 5001, card_last4: '4242', auth_code: 'A1' },
        }),
        400,
      );

      // Queue 10 x 5000 = 50000 maxCumulative, then 11th x 100 -> 400
      for (let i = 0; i < 10; i += 1) {
        assertStatus(
          await pos.request('main', '/api/saf/queue', {
            method: 'POST',
            token: owner.token,
            body: { order_id: ord.id, bill_id: bill.id, amount: 5000, card_last4: '4242', auth_code: `AUTH${i}` },
          }),
          201,
        );
      }
      assertStatus(
        await pos.request('main', '/api/saf/queue', {
          method: 'POST',
          token: owner.token,
          body: { order_id: ord.id, bill_id: bill.id, amount: 100, card_last4: '4242', auth_code: 'OVER' },
        }),
        400,
      );
    });
  },
});

registerTest({
  id: 'f9-t2-tips-no-pool-400-and-points-split',
  tier: 2,
  feature: 'F9',
  title: 'Tips distribute rejects empty pool (400), cashier RBAC (403), and splits 60/40 under points_percentage',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const server = await createStaffUser(pos, owner.token, {
        name: 'FOH Server',
        email: 'server@e2e.local',
        password: 'StaffPass123!',
        role: 'server',
      });
      const chef = await createStaffUser(pos, owner.token, {
        name: 'BOH Chef',
        email: 'chef@e2e.local',
        password: 'StaffPass123!',
        role: 'chef',
      });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'BOH Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;

      assertStatus(
        await pos.request('main', '/api/bills/tips/distribute', {
          method: 'POST',
          token: owner.token,
          body: { distribution_rule: 'equal_split' },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', '/api/bills/tips/distribute', {
          method: 'POST',
          token: cashierToken,
          body: { distribution_rule: 'equal_split' },
        }),
        403,
      );

      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: 'prod-express-meal', quantity: 1 }],
      });
      const bill = await generateBill(pos, owner.token, ord.id);

      // True target spec (B-F8-1): tip_amount saved atomically so points_percentage pool has 100
      assertJson(
        await pos.request('main', `/api/bills/${bill.id}/payment`, {
          method: 'POST',
          token: owner.token,
          body: { method: 'card', amount: bill.total, tip_amount: 100 },
        }),
        200,
        (d) => d.bill?.tip_amount === 100,
      );

      const distRes = await pos.request('main', '/api/bills/tips/distribute', {
        method: 'POST',
        token: owner.token,
        body: {
          distribution_rule: 'points_percentage',
          staff_ids: [server.id, chef.id, cashier.id],
        },
      });
      const dist = assertJson<{ distribution: any }>(distRes, 201).distribution;
      const foh = dist.allocations.find((a: any) => a.userId === server.id);
      const bohChef = dist.allocations.find((a: any) => a.userId === chef.id);
      const bohCashier = dist.allocations.find((a: any) => a.userId === cashier.id);
      assertEqual(foh?.allocatedAmount, 60);
      assertEqual(bohChef?.allocatedAmount, 20);
      assertEqual(bohCashier?.allocatedAmount, 20);
    });
  },
});

registerTest({
  id: 'f9-t2-tax-preview-invalid-inputs-and-rbac',
  tier: 2,
  feature: 'F9',
  title: 'Tax preview validates inputs (400), allows cashier (200), and blocks cashier from manual-config (403)',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const cashier = await createStaffUser(pos, owner.token, {
        name: 'Tax Cashier',
        email: 'cashier@e2e.local',
        password: 'StaffPass123!',
        role: 'cashier',
      });
      const cashierToken = (await pos.login(cashier.email, cashier.password, 'main')).token;

      assertStatus(
        await pos.request('main', '/api/tax/preview', {
          method: 'POST',
          token: owner.token,
          body: { items: [] },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', '/api/tax/preview', {
          method: 'POST',
          token: owner.token,
          body: {
            items: [{ product_id: 'prod-express-meal', quantity: 1 }],
            discount_type: 'percentage',
            discount_value: 150,
          },
        }),
        400,
      );
      assertStatus(
        await pos.request('main', '/api/tax/preview', {
          method: 'POST',
          token: owner.token,
          body: {
            items: [{ product_id: 'prod-express-meal', quantity: 1 }],
            packaging_charge: -5,
          },
        }),
        400,
      );

      // True target spec (B-F5-1): cashier can call POST /api/tax/preview
      assertStatus(
        await pos.request('main', '/api/tax/preview', {
          method: 'POST',
          token: cashierToken,
          body: { items: [{ product_id: 'prod-express-meal', quantity: 1 }] },
        }),
        200,
      );

      assertStatus(
        await pos.request('main', '/api/tax-packs/manual-config', {
          method: 'POST',
          token: cashierToken,
          body: {},
        }),
        403,
      );
    });
  },
});

registerTest({
  id: 'f9-t2-einvoice-interstate-igst-and-missing-gstin',
  tier: 2,
  feature: 'F9',
  title: 'E-Invoice rejects missing store/customer GSTIN (400), computes inter-state IGST, and register is idempotent',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      const { gst18Cat } = await configureIndiaGstPack(pos, owner.token);

      const p18 = assertJson<{ product: { id: string } }>(
        await pos.request('main', '/api/products', {
          method: 'POST',
          token: owner.token,
          body: {
            category_id: 'cat-express-food',
            name: 'Interstate Item 18%',
            price: 100,
            tax_category_id: gst18Cat!.id,
            tax_behavior: 'exclusive',
          },
        }),
        201,
      ).product;

      const ordNoGstin = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: p18.id, quantity: 1 }],
      });
      const billNoCust = await generateBill(pos, owner.token, ordNoGstin.id);
      assertStatus(await pos.request('main', `/api/bills/${billNoCust.id}/einvoice`, { token: owner.token }), 400);
      assertStatus(
        await pos.request('main', `/api/bills/${billNoCust.id}/einvoice/register`, {
          method: 'POST',
          token: owner.token,
        }),
        400,
      );

      const ordWithCust = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [{ product_id: p18.id, quantity: 1 }],
      });
      const billNoStore = await generateBill(pos, owner.token, ordWithCust.id, {
        customer_gstin: '27AABCU9603R1ZM',
      });
      // Store GSTIN not configured yet -> 400
      assertStatus(await pos.request('main', `/api/bills/${billNoStore.id}/einvoice`, { token: owner.token }), 400);

      assertStatus(
        await pos.request('main', '/api/settings/tax', {
          method: 'PUT',
          token: owner.token,
          body: {
            tax_registered: true,
            tax_registration_number: '29ABCDE1234F1Z5',
            state_code: '29',
            country: 'IN',
          },
        }),
        200,
      );

      // True target spec (B-F9-2): inter-state 29 vs 27 yields IgstAmt=18, CgstAmt=0, SgstAmt=0
      const irpRes = await pos.request('main', `/api/bills/${billNoStore.id}/einvoice`, { token: owner.token });
      const irp = assertJson<any>(irpRes, 200);
      assertEqual(irp.ItemList[0].GstRt, 18);
      assertEqual(irp.ItemList[0].IgstAmt, 18);
      assertEqual(irp.ItemList[0].CgstAmt, 0);
      assertEqual(irp.ItemList[0].SgstAmt, 0);

      const reg1 = assertJson<any>(
        await pos.request('main', `/api/bills/${billNoStore.id}/einvoice/register`, {
          method: 'POST',
          token: owner.token,
        }),
        200,
      );
      const reg2 = assertJson<any>(
        await pos.request('main', `/api/bills/${billNoStore.id}/einvoice/register`, {
          method: 'POST',
          token: owner.token,
        }),
        200,
      );
      assertEqual(reg2.irn, reg1.irn);
    });
  },
});

registerTest({
  id: 'f9-t2-einvoice-excludes-voided-items',
  tier: 2,
  feature: 'F9',
  title: 'E-Invoice ItemList and signedQr.itemCnt exclude voided items and void_adjustment negative lines',
  async run() {
    await withLocalPos({}, async (pos) => {
      const owner = await pos.setupOwner({ setup_profile: 'express', service_model: 'qsr' });
      await createStaffUser(pos, owner.token, {
        name: 'Manager PIN',
        email: 'mgr@e2e.local',
        password: 'StaffPass123!',
        role: 'manager',
        pin: MANAGER_PIN,
      });
      assertStatus(
        await pos.request('main', '/api/settings/tax', {
          method: 'PUT',
          token: owner.token,
          body: {
            tax_registered: true,
            tax_registration_number: '29ABCDE1234F1Z5',
            state_code: '29',
            country: 'IN',
          },
        }),
        200,
      );

      const ord = await createOrder(pos, owner.token, {
        type: 'takeaway',
        items: [
          { product_id: 'prod-express-meal', quantity: 1 },
          { product_id: 'prod-express-snack', quantity: 1 },
        ],
      });
      const snackId = ord.items.find((i: any) => i.product_id === 'prod-express-snack').id;
      assertStatus(
        await pos.request('main', `/api/kds/items/${snackId}/status`, {
          method: 'PATCH',
          token: owner.token,
          body: { status: 'preparing' },
        }),
        200,
      );
      assertStatus(
        await pos.request('main', `/api/orders/${ord.id}/items/${snackId}/cancel`, {
          method: 'PATCH',
          token: owner.token,
          body: { override_pin: MANAGER_PIN, reason: 'Out of stock' },
        }),
        200,
      );

      const bill = await generateBill(pos, owner.token, ord.id, {
        customer_gstin: '29AABCU9603R1ZM',
      });

      // True target spec (B-F9-2): ItemList excludes voided item and void_adjustment line
      const irp = assertJson<any>(
        await pos.request('main', `/api/bills/${bill.id}/einvoice`, { token: owner.token }),
        200,
      );
      assertEqual(irp.ItemList.length, 1);
      assert(irp.ItemList[0].UnitRate > 0, 'Expected only positive active item in ItemList');

      const reg = assertJson<any>(
        await pos.request('main', `/api/bills/${bill.id}/einvoice/register`, {
          method: 'POST',
          token: owner.token,
        }),
        200,
      );
      const qrPayload = JSON.parse(reg.signedQr);
      assertEqual(qrPayload.itemCnt, 1);
    });
  },
});
