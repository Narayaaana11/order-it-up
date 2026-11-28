import {
  startLocalPos,
  type LocalPosHarness,
  type LocalPosHarnessOptions,
  type SetupOwnerResult,
} from '../lib/local-pos-harness';
import {
  assert,
  assertEqual,
  assertJson,
  assertStatus,
  registerTest,
  signRazorpayWebhook,
  signSwiggyWebhook,
  signZomatoWebhook,
} from '../lib/test-kit';

async function withLocalPos(
  optsOrFn: LocalPosHarnessOptions | ((pos: LocalPosHarness) => Promise<void>),
  maybeFn?: (pos: LocalPosHarness) => Promise<void>,
): Promise<void> {
  const opts = typeof optsOrFn === 'function' ? {} : optsOrFn;
  const fn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn!;
  let pos: LocalPosHarness | undefined;
  try {
    pos = await startLocalPos(opts);
    await fn(pos);
  } finally {
    if (pos) {
      await pos.stop();
    }
  }
}

async function createStaffMember(
  pos: LocalPosHarness,
  ownerToken: string,
  input: {
    name: string;
    email: string;
    password: string;
    role: 'manager' | 'cashier' | 'server' | 'chef';
    pin?: string;
  },
): Promise<{ id: string; token: string }> {
  const res = await pos.request('main', '/api/staff', {
    method: 'POST',
    token: ownerToken,
    body: input,
  });
  const data = assertJson(res, 201, (d) => Boolean(d?.staff?.id));
  const login = await pos.login(input.email, input.password, 'main');
  return { id: String(data.staff.id), token: login.token };
}

async function createProduct(
  pos: LocalPosHarness,
  ownerToken: string,
  opts: {
    categoryName?: string;
    productName?: string;
    price?: number;
  } = {},
): Promise<{ categoryId: string; productId: string; price: number; name: string }> {
  const catRes = await pos.request('main', '/api/categories', {
    method: 'POST',
    token: ownerToken,
    body: { name: opts.categoryName ?? 'Main Course' },
  });
  const catData = assertJson(catRes, 201, (d) => Boolean(d?.category?.id));
  const categoryId = String(catData.category.id);

  const productName = opts.productName ?? 'Paneer Butter Masala';
  const price = opts.price ?? 200;
  const prodRes = await pos.request('main', '/api/products', {
    method: 'POST',
    token: ownerToken,
    body: {
      name: productName,
      price,
      category_id: categoryId,
    },
  });
  const prodData = assertJson(prodRes, 201, (d) => Boolean(d?.product?.id));
  return {
    categoryId,
    productId: String(prodData.product.id),
    price,
    name: productName,
  };
}

async function createAndPayOrder(
  pos: LocalPosHarness,
  token: string,
  productId: string,
  opts: {
    quantity?: number;
    method?: string;
    customerId?: string;
    type?: 'takeaway' | 'dine_in';
    tableId?: string;
  } = {},
): Promise<{ order: any; bill: any }> {
  const orderRes = await pos.request('main', '/api/orders', {
    method: 'POST',
    token,
    body: {
      type: opts.type ?? 'takeaway',
      ...(opts.tableId ? { table_id: opts.tableId } : {}),
      ...(opts.customerId ? { customer_id: opts.customerId } : {}),
      items: [{ product_id: productId, quantity: opts.quantity ?? 1 }],
    },
  });
  const orderData = assertJson(orderRes, 201, (d) => Boolean(d?.order?.id));
  const order = orderData.order;

  const billRes = await pos.request('main', '/api/bills/generate', {
    method: 'POST',
    token,
    body: { order_id: order.id },
  });
  assertStatus(billRes, [200, 201], 'bills/generate');
  assert(billRes.data?.bill?.id, 'Expected generated bill id');
  const bill = billRes.data.bill;

  const payRes = await pos.request('main', `/api/bills/${bill.id}/payment`, {
    method: 'POST',
    token,
    body: {
      method: opts.method ?? 'cash',
      amount: bill.total,
      ...(opts.customerId ? { customer_id: opts.customerId } : {}),
    },
  });
  const payData = assertJson(payRes, 200, (d) => d?.bill?.payment_status === 'paid');

  return { order, bill: payData.bill };
}

async function createTable(
  pos: LocalPosHarness,
  ownerToken: string,
  number = 'T-101',
): Promise<{ id: string; number: string }> {
  const res = await pos.request('main', '/api/tables', {
    method: 'POST',
    token: ownerToken,
    body: { number, capacity: 4 },
  });
  const data = assertJson(res, 201, (d) => Boolean(d?.table?.id));
  return { id: String(data.table.id), number: String(data.table.number) };
}

function validMerchantTemplatePayload() {
  return {
    format: 'orderitup-merchant-print-template',
    documentType: 'receipt',
    schemaVersion: 1,
    blocks: [
      { kind: 'business-header', visible: true },
      { kind: 'item-table', visible: true },
      { kind: 'totals', visible: true },
    ],
  };
}

// ============================================================================
// F10: Local Printers, Inventory, Vendors & Expenses (6 Tier 1 + 6 Tier 2)
// ============================================================================

registerTest({
  id: 'f10:t1:printers-crud-and-default',
  tier: 1,
  feature: 'F10',
  title: 'Printers supported profiles, CRUD, default switching, and non-default delete',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner: SetupOwnerResult = await pos.setupOwner();

      const supRes = await pos.request('main', '/api/printers/supported', { token: owner.token });
      assertJson(supRes, 200, (d) => Array.isArray(d?.printers) && d.printers.length > 0);

      const p1Res = await pos.request('main', '/api/printers', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Front Counter',
          connection_type: 'network',
          ip_address: '192.168.1.50',
          port: 9100,
          paper_width: 'cols-42',
        },
      });
      const p1 = assertJson(p1Res, 201, (d) => d?.printer?.is_default === 1).printer;

      const p2Res = await pos.request('main', '/api/printers', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Bar Printer',
          connection_type: 'usb',
          paper_width: 'cols-48',
        },
      });
      const p2 = assertJson(p2Res, 201, (d) => d?.printer?.is_default === 0).printer;

      const listRes = await pos.request('main', '/api/printers', { token: owner.token });
      assertJson(listRes, 200, (d) => Array.isArray(d?.printers) && d.printers.length === 2);

      const getRes = await pos.request('main', `/api/printers/${p2.id}`, { token: owner.token });
      assertJson(getRes, 200, (d) => d?.printer?.id === p2.id);

      const updRes = await pos.request('main', `/api/printers/${p2.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { name: 'Bar Thermal', cash_drawer_pulse_enabled: true },
      });
      assertJson(
        updRes,
        200,
        (d) => d?.printer?.name === 'Bar Thermal' && d?.printer?.cash_drawer_pulse_enabled === 1,
      );

      const defRes = await pos.request('main', `/api/printers/${p2.id}/set-default`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(defRes, 200, (d) => d?.message === 'Default printer set');

      const afterDefList = await pos.request('main', '/api/printers', { token: owner.token });
      assertJson(afterDefList, 200, (d) => {
        const first = d.printers.find((p: any) => p.id === p1.id);
        const second = d.printers.find((p: any) => p.id === p2.id);
        return first?.is_default === 0 && second?.is_default === 1;
      });

      const delRes = await pos.request('main', `/api/printers/${p1.id}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertJson(delRes, 200, (d) => d?.message === 'Printer deleted');
    });
  },
});

registerTest({
  id: 'f10:t1:print-bill-preview-escpos',
  tier: 1,
  feature: 'F10',
  title: 'Bill preview generates ESC/POS base64 and rendered receipt text without hardware',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const { productId } = await createProduct(pos, owner.token, {
        productName: 'Masala Dosa',
        price: 150,
      });

      const orderRes = await pos.request('main', '/api/orders', {
        method: 'POST',
        token: owner.token,
        body: {
          type: 'takeaway',
          items: [{ product_id: productId, quantity: 2 }],
        },
      });
      const order = assertJson(orderRes, 201, (d) => Boolean(d?.order?.id)).order;

      const billRes = await pos.request('main', '/api/bills/generate', {
        method: 'POST',
        token: owner.token,
        body: { order_id: order.id },
      });
      assertStatus(billRes, [200, 201], 'bills/generate');
      const bill = billRes.data.bill;

      const prevRes = await pos.request('main', '/api/printers/print-bill', {
        method: 'POST',
        token: owner.token,
        body: { billId: bill.id, preview: true },
      });
      const prev = assertJson(
        prevRes,
        200,
        (d) =>
          d?.success === true &&
          d?.preview === true &&
          typeof d?.columns === 'number' &&
          typeof d?.text === 'string' &&
          d.text.includes('Masala Dosa') &&
          typeof d?.escpos_base64 === 'string' &&
          d.escpos_base64.length > 0,
      );

      const rawBytes = Buffer.from(prev.escpos_base64, 'base64');
      assert(rawBytes.length > 20, 'Expected non-trivial ESC/POS byte buffer');
      const escInitIndex = rawBytes.indexOf(Buffer.from([0x1b, 0x40]));
      assert(escInitIndex >= 0, 'Expected ESC @ (0x1B 0x40) printer initialization bytes');
    });
  },
});

registerTest({
  id: 'f10:t1:print-templates-crud-lifecycle',
  tier: 1,
  feature: 'F10',
  title: 'Merchant print templates CRUD, activate, export, import, rollback, and archive',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const basePayload = validMerchantTemplatePayload();

      const createRes = await pos.request('main', '/api/print-templates', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Bistro Receipt', payload: basePayload },
      });
      const tpl = assertJson(
        createRes,
        201,
        (d) => d?.template?.status === 'draft' && d?.template?.name === 'Bistro Receipt',
      ).template;

      const listRes = await pos.request('main', '/api/print-templates', { token: owner.token });
      assertJson(listRes, 200, (d) => d?.templates?.some((t: any) => t.id === tpl.id));

      const payloadRes = await pos.request('main', `/api/print-templates/${tpl.id}/payload`, {
        token: owner.token,
      });
      assertJson(payloadRes, 200, (d) => d?.payload?.blocks?.length === 3);

      const actRes = await pos.request('main', `/api/print-templates/${tpl.id}/activate`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(actRes, 200, (d) => d?.template?.status === 'active');

      const updatedPayload = {
        ...basePayload,
        blocks: [
          ...basePayload.blocks,
          { kind: 'message', visible: true, labels: { thankYou: 'Visit again!' } },
        ],
      };
      const putRes = await pos.request('main', `/api/print-templates/${tpl.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { name: 'Bistro Receipt v2', payload: updatedPayload },
      });
      assertJson(
        putRes,
        200,
        (d) => d?.template?.name === 'Bistro Receipt v2' && d?.template?.hasPreviousPayload === true,
      );

      const expRes = await pos.request('main', `/api/print-templates/${tpl.id}/export`, {
        token: owner.token,
      });
      assertJson(
        expRes,
        200,
        (d) => Boolean(d?.template) && typeof d?.checksum === 'string',
      );

      const impRes = await pos.request('main', '/api/print-templates/import', {
        method: 'POST',
        token: owner.token,
        body: { file: expRes.rawText, name: 'Imported Receipt' },
      });
      assertJson(
        impRes,
        201,
        (d) => d?.template?.origin === 'imported' && d?.template?.status === 'draft',
      );

      const rbRes = await pos.request('main', `/api/print-templates/${tpl.id}/rollback`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(rbRes, 200, (d) => d?.template?.id === tpl.id);

      const afterRbPayload = await pos.request('main', `/api/print-templates/${tpl.id}/payload`, {
        token: owner.token,
      });
      assertJson(afterRbPayload, 200, (d) => d?.payload?.blocks?.length === 3);

      const archRes = await pos.request('main', `/api/print-templates/${tpl.id}/archive`, {
        method: 'POST',
        token: owner.token,
      });
      assertJson(archRes, 200, (d) => d?.template?.status === 'archived');
    });
  },
});

registerTest({
  id: 'f10:t1:inventory-ingredients-recipes-adjust-waste',
  tier: 1,
  feature: 'F10',
  title: 'Inventory ingredients, BOM recipes, stock adjustment, low-stock, waste, and ledger',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await pos.activatePlan('DEV-PRO', owner.token);
      const { productId } = await createProduct(pos, owner.token, {
        productName: 'Jeera Rice',
        price: 180,
      });

      const ingRes = await pos.request('main', '/api/inventory/ingredients', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Basmati Rice',
          unit: 'kg',
          current_stock: 10,
          minimum_stock: 5,
          cost_per_unit: 80,
        },
      });
      const ing = assertJson(ingRes, 201, (d) => d?.ok === true && Boolean(d?.ingredient?.id)).ingredient;

      const recPost = await pos.request('main', `/api/inventory/recipes/${productId}`, {
        method: 'POST',
        token: owner.token,
        body: {
          items: [
            {
              ingredient_id: ing.id,
              quantity_required: 0.25,
              unit: 'kg',
              wastage_percentage: 10,
            },
          ],
        },
      });
      assertJson(recPost, 200, (d) => d?.ok === true && Number(d?.recipe_cogs) > 0);

      const recGet = await pos.request('main', `/api/inventory/recipes/${productId}`, {
        token: owner.token,
      });
      assertJson(recGet, 200, (d) => d?.ok === true && d?.recipes?.length === 1);

      const adjRes = await pos.request('main', '/api/inventory/adjust', {
        method: 'POST',
        token: owner.token,
        body: {
          ingredient_id: ing.id,
          adjustment_type: 'decrease',
          quantity: 6,
          reason: 'Prep count',
        },
      });
      assertJson(
        adjRes,
        200,
        (d) => d?.ok === true && d?.previous_stock === 10 && d?.current_stock === 4,
      );

      const lowRes = await pos.request('main', '/api/inventory/low-stock', { token: owner.token });
      assertJson(
        lowRes,
        200,
        (d) => d?.ok === true && d?.low_stock?.some((item: any) => item.id === ing.id),
      );

      const wasteRes = await pos.request('main', '/api/inventory/waste', {
        method: 'POST',
        token: owner.token,
        body: {
          ingredient_id: ing.id,
          quantity: 1,
          reason: 'spoilage',
          notes: 'Damaged sack',
        },
      });
      assertJson(
        wasteRes,
        201,
        (d) => d?.ok === true && d?.wastage?.remainingStock === 3 && d?.wastage?.costLoss === 80,
      );

      const txRes = await pos.request('main', '/api/inventory/transactions', { token: owner.token });
      assertJson(txRes, 200, (d) => d?.ok === true && d?.transactions?.length >= 2);

      const sumRes = await pos.request('main', '/api/inventory/waste-summary', { token: owner.token });
      assertJson(sumRes, 200, (d) => d?.ok === true && d?.summary !== undefined);
    });
  },
});

registerTest({
  id: 'f10:t1:vendors-and-purchase-orders-grn',
  tier: 1,
  feature: 'F10',
  title: 'Vendors CRUD, GRN purchase order stock increment, partial payment, and settlement',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await pos.activatePlan('DEV-PRO', owner.token);

      const ingRes = await pos.request('main', '/api/inventory/ingredients', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Tomatoes', unit: 'kg', current_stock: 2, minimum_stock: 1, cost_per_unit: 40 },
      });
      const ing = assertJson(ingRes, 201).ingredient;

      const venRes = await pos.request('main', '/api/vendors', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Fresh Farms', contact_person: 'Ravi', phone: '+919811122233' },
      });
      const vendor = assertJson(venRes, 201, (d) => d?.ok === true && Boolean(d?.vendor?.id)).vendor;

      const venPut = await pos.request('main', `/api/vendors/${vendor.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { address: 'KR Market' },
      });
      assertJson(venPut, 200, (d) => d?.vendor?.address === 'KR Market');

      const poRes = await pos.request('main', '/api/vendors/purchases', {
        method: 'POST',
        token: owner.token,
        body: {
          vendor_id: vendor.id,
          invoice_number: 'INV-101',
          items: [{ ingredient_id: ing.id, quantity: 10, unit_price: 45, tax_rate: 0 }],
          paid_amount: 200,
          payment_method: 'cash',
        },
      });
      const po = assertJson(
        poRes,
        201,
        (d) =>
          d?.ok === true &&
          d?.total_amount === 450 &&
          d?.paid_amount === 200 &&
          d?.payment_status === 'partial',
      );

      const ingList = await pos.request('main', '/api/inventory/ingredients', { token: owner.token });
      assertJson(ingList, 200, (d) => {
        const row = d.ingredients.find((x: any) => x.id === ing.id);
        return row?.current_stock === 12 && row?.cost_per_unit === 45;
      });

      const poGet = await pos.request('main', `/api/vendors/purchases/${po.purchase_id}`, {
        token: owner.token,
      });
      assertJson(
        poGet,
        200,
        (d) => d?.purchase?.payment_status === 'partial' && d?.items?.length === 1,
      );

      const payRemRes = await pos.request('main', `/api/vendors/purchases/${po.purchase_id}/payment`, {
        method: 'POST',
        token: owner.token,
        body: { amount: 250, payment_method: 'upi' },
      });
      assertJson(
        payRemRes,
        200,
        (d) =>
          d?.ok === true &&
          d?.paid_amount === 450 &&
          d?.remaining_due === 0 &&
          d?.payment_status === 'paid',
      );
    });
  },
});

registerTest({
  id: 'f10:t1:expenses-and-pnl-report',
  tier: 1,
  feature: 'F10',
  title: 'Expense categories, expense logging, and owner P&L report reconciliation',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const { productId } = await createProduct(pos, owner.token, {
        productName: 'Thali',
        price: 500,
      });
      const { bill } = await createAndPayOrder(pos, owner.token, productId, { method: 'cash' });

      const catRes = await pos.request('main', '/api/expenses/categories', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Utilities', description: 'Electricity and water' },
      });
      const expCat = assertJson(catRes, 201, (d) => d?.ok === true && Boolean(d?.category?.id)).category;

      const catsGet = await pos.request('main', '/api/expenses/categories', { token: owner.token });
      assertJson(catsGet, 200, (d) => d?.categories?.some((c: any) => c.id === expCat.id));

      const expRes = await pos.request('main', '/api/expenses', {
        method: 'POST',
        token: owner.token,
        body: {
          category_id: expCat.id,
          amount: 120,
          payment_method: 'cash',
          paid_to: 'BESCOM',
        },
      });
      assertJson(expRes, 201, (d) => d?.ok === true && d?.expense?.amount === 120);

      const expList = await pos.request('main', '/api/expenses', { token: owner.token });
      assertJson(expList, 200, (d) => d?.ok === true && d?.total === 120 && d?.expenses?.length === 1);

      const pnlRes = await pos.request('main', '/api/expenses/pnl', { token: owner.token });
      assertJson(
        pnlRes,
        200,
        (d) =>
          d?.ok === true &&
          d?.revenue?.gross >= Number(bill.total) &&
          d?.expenses?.total === 120 &&
          Math.abs(d.net_profit - (d.gross_profit - 120)) < 0.01,
      );
    });
  },
});

registerTest({
  id: 'f10:t2:printer-validation-and-delete-last-default-409',
  tier: 2,
  feature: 'F10',
  title: 'Printer rejects missing network ip, invalid paper width, and deleting sole default printer',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const noIpRes = await pos.request('main', '/api/printers', {
        method: 'POST',
        token: owner.token,
        body: { name: 'NetNoIp', connection_type: 'network' },
      });
      assertStatus(noIpRes, 400, 'network printer without ip');

      const badWidthRes = await pos.request('main', '/api/printers', {
        method: 'POST',
        token: owner.token,
        body: { name: 'BadWidth', connection_type: 'usb', paper_width: 'cols-99' },
      });
      assertStatus(badWidthRes, 400, 'invalid paper_width');

      const pRes = await pos.request('main', '/api/printers', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Sole Default', connection_type: 'usb' },
      });
      const printer = assertJson(pRes, 201).printer;

      const delSoleRes = await pos.request('main', `/api/printers/${printer.id}`, {
        method: 'DELETE',
        token: owner.token,
      });
      assertStatus(delSoleRes, 409, 'delete sole default printer');
    });
  },
});

registerTest({
  id: 'f10:t2:open-drawer-requires-printer-transport',
  tier: 2,
  feature: 'F10',
  title: 'POST /api/printers/open-drawer fails closed when no printer transport is configured (Target M2)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const res = await pos.request('main', '/api/printers/open-drawer', {
        method: 'POST',
        token: owner.token,
        body: { reason: 'No-sale test' },
      });
      assertStatus(res, [400, 404, 502], 'open-drawer without configured printer transport');
    });
  },
});

registerTest({
  id: 'f10:t2:print-templates-owner-only-and-invalid-payload',
  tier: 2,
  feature: 'F10',
  title: 'Print templates block manager writes (403) and reject invalid schemaVersion/block kind (400)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const manager = await createStaffMember(pos, owner.token, {
        name: 'Mgr One',
        email: 'mgr@e2e.local',
        password: 'MgrPass123!',
        role: 'manager',
        pin: '2345',
      });

      const mgrRes = await pos.request('main', '/api/print-templates', {
        method: 'POST',
        token: manager.token,
        body: { name: 'Mgr Template', payload: validMerchantTemplatePayload() },
      });
      assertStatus(mgrRes, 403, 'manager print-template create');

      const badVerRes = await pos.request('main', '/api/print-templates', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Bad Version',
          payload: { ...validMerchantTemplatePayload(), schemaVersion: 99 },
        },
      });
      assertStatus(badVerRes, 400, 'invalid schemaVersion');

      const badKindRes = await pos.request('main', '/api/print-templates', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Bad Block',
          payload: {
            ...validMerchantTemplatePayload(),
            blocks: [{ kind: 'unknown-block', visible: true }],
          },
        },
      });
      assertStatus(badKindRes, 400, 'unknown block kind');
    });
  },
});

registerTest({
  id: 'f10:t2:inventory-starter-plan-gated-403',
  tier: 2,
  feature: 'F10',
  title: 'Inventory endpoints return 403 FEATURE_NOT_ENTITLED on starter plan',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await pos.activatePlan('DEV-STARTER', owner.token);

      const listRes = await pos.request('main', '/api/inventory/ingredients', {
        token: owner.token,
      });
      assertJson(listRes, 403, (d) => d?.code === 'FEATURE_NOT_ENTITLED');

      const adjRes = await pos.request('main', '/api/inventory/adjust', {
        method: 'POST',
        token: owner.token,
        body: { ingredient_id: 'ing_any', adjustment_type: 'increase', quantity: 5 },
      });
      assertJson(adjRes, 403, (d) => d?.code === 'FEATURE_NOT_ENTITLED');
    });
  },
});

registerTest({
  id: 'f10:t2:inventory-and-vendor-boundary-400-404',
  tier: 2,
  feature: 'F10',
  title: 'Inventory and vendor endpoints enforce 400/404 validation and overpayment rejection',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await pos.activatePlan('DEV-PRO', owner.token);

      const ing = assertJson(
        await pos.request('main', '/api/inventory/ingredients', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Oil', unit: 'L', current_stock: 5, minimum_stock: 2, cost_per_unit: 100 },
        }),
        201,
      ).ingredient;

      const badAdj = await pos.request('main', '/api/inventory/adjust', {
        method: 'POST',
        token: owner.token,
        body: { ingredient_id: ing.id, adjustment_type: 'bogus', quantity: 2 },
      });
      assertStatus(badAdj, 400, 'invalid adjustment_type');

      const badWaste = await pos.request('main', '/api/inventory/waste', {
        method: 'POST',
        token: owner.token,
        body: { ingredient_id: ing.id, quantity: 0 },
      });
      assertStatus(badWaste, 400, 'zero waste quantity');

      const missingPo = await pos.request('main', '/api/vendors/purchases/po_does_not_exist', {
        token: owner.token,
      });
      assertStatus(missingPo, 404, 'missing purchase order');

      const missingVenPo = await pos.request('main', '/api/vendors/purchases', {
        method: 'POST',
        token: owner.token,
        body: {
          vendor_id: 'ven_missing',
          items: [{ ingredient_id: ing.id, quantity: 1, unit_price: 100 }],
        },
      });
      assertStatus(missingVenPo, 404, 'missing vendor for PO');

      const vendor = assertJson(
        await pos.request('main', '/api/vendors', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Oil Supplier' },
        }),
        201,
      ).vendor;

      const paidPo = assertJson(
        await pos.request('main', '/api/vendors/purchases', {
          method: 'POST',
          token: owner.token,
          body: {
            vendor_id: vendor.id,
            items: [{ ingredient_id: ing.id, quantity: 1, unit_price: 100, tax_rate: 0 }],
            paid_amount: 100,
          },
        }),
        201,
      );

      const extraPay = await pos.request('main', `/api/vendors/purchases/${paidPo.purchase_id}/payment`, {
        method: 'POST',
        token: owner.token,
        body: { amount: 10 },
      });
      assertStatus(extraPay, 400, 'payment on already paid PO');
    });
  },
});

registerTest({
  id: 'f10:t2:expenses-pnl-owner-only-403',
  tier: 2,
  feature: 'F10',
  title: 'Expenses P&L and delete require owner (403 for manager/cashier) and reject negative amounts',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const manager = await createStaffMember(pos, owner.token, {
        name: 'Mgr Exp',
        email: 'mgrexp@e2e.local',
        password: 'MgrPass123!',
        role: 'manager',
        pin: '3456',
      });
      const cashier = await createStaffMember(pos, owner.token, {
        name: 'Cash Exp',
        email: 'cashexp@e2e.local',
        password: 'CashPass123!',
        role: 'cashier',
      });

      const cat = assertJson(
        await pos.request('main', '/api/expenses/categories', {
          method: 'POST',
          token: owner.token,
          body: { name: 'Supplies' },
        }),
        201,
      ).category;

      const exp = assertJson(
        await pos.request('main', '/api/expenses', {
          method: 'POST',
          token: owner.token,
          body: { category_id: cat.id, amount: 75 },
        }),
        201,
      ).expense;

      assertStatus(
        await pos.request('main', '/api/expenses/pnl', { token: manager.token }),
        403,
        'manager GET /expenses/pnl',
      );
      assertStatus(
        await pos.request('main', '/api/expenses/pnl', { token: cashier.token }),
        403,
        'cashier GET /expenses/pnl',
      );
      assertStatus(
        await pos.request('main', `/api/expenses/${exp.id}`, {
          method: 'DELETE',
          token: manager.token,
        }),
        403,
        'manager DELETE /expenses/:id',
      );

      const negExp = await pos.request('main', '/api/expenses', {
        method: 'POST',
        token: owner.token,
        body: { category_id: cat.id, amount: -50 },
      });
      assertStatus(negExp, 400, 'negative expense amount');
    });
  },
});

// ============================================================================
// F11: Local Customers, Reports & Audit Log (6 Tier 1 + 6 Tier 2)
// ============================================================================

registerTest({
  id: 'f11:t1:customers-crud-and-e164-search',
  tier: 1,
  feature: 'F11',
  title: 'Customers create/update with E.164 normalization, list search, customers-search, and CRM lookup',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const createRes = await pos.request('main', '/api/customers', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Ananya Rao', phone: '+919876543210', email: 'ananya@e2e.local' },
      });
      const customer = assertJson(
        createRes,
        201,
        (d) => Boolean(d?.customer?.id) && d?.customer?.phone === '+919876543210',
      ).customer;

      const putRes = await pos.request('main', `/api/customers/${customer.id}`, {
        method: 'PUT',
        token: owner.token,
        body: { name: 'Ananya R', notes: 'VIP Guest' },
      });
      assertJson(putRes, 200, (d) => d?.customer?.name === 'Ananya R');

      const listRes = await pos.request('main', '/api/customers?search=98765', {
        token: owner.token,
      });
      assertJson(listRes, 200, (d) => d?.data?.some((c: any) => c.id === customer.id));

      const quickRes = await pos.request('main', '/api/customers-search?q=98765', {
        token: owner.token,
      });
      assertJson(
        quickRes,
        200,
        (d) => Array.isArray(d) && d.some((c: any) => c.id === customer.id),
      );

      const crmRes = await pos.request('main', '/api/crm/lookup?phone=9876543210', {
        token: owner.token,
      });
      assertJson(crmRes, 200, (d) => d?.found === true && d?.customer?.id === customer.id);
    });
  },
});

registerTest({
  id: 'f11:t1:customer-wallet-and-loyalty-summary',
  tier: 1,
  feature: 'F11',
  title: 'Customer detail and wallet endpoints reflect linked orders, paid bills, and summary',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const custRes = await pos.request('main', '/api/customers', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Loyalty Guest', phone: '+919876500001' },
      });
      const customer = assertJson(custRes, 201).customer;

      const { productId } = await createProduct(pos, owner.token, { price: 300 });
      const { bill } = await createAndPayOrder(pos, owner.token, productId, {
        customerId: customer.id,
        method: 'cash',
      });

      const detailRes = await pos.request('main', `/api/customers/${customer.id}`, {
        token: owner.token,
      });
      assertJson(
        detailRes,
        200,
        (d) =>
          typeof d?.customer?.walletBalance === 'number' &&
          Array.isArray(d?.customer?.loyaltyHistory) &&
          d?.customer?.recentOrders?.length === 1,
      );

      const walletRes = await pos.request('main', `/api/customers/${customer.id}/wallet`, {
        token: owner.token,
      });
      assertJson(
        walletRes,
        200,
        (d) =>
          typeof d?.balance === 'number' &&
          Array.isArray(d?.transactions) &&
          d?.bills?.length === 1 &&
          d?.summary?.totalSpent >= Number(bill.total),
      );
    });
  },
});

registerTest({
  id: 'f11:t1:x-report-and-z-report-cash-closure',
  tier: 1,
  feature: 'F11',
  title: 'X-report live totals, Z-report cash closure snapshot, and alreadyClosed transition',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const { productId } = await createProduct(pos, owner.token, { price: 250 });
      await createAndPayOrder(pos, owner.token, productId, { method: 'cash' });

      const xBeforeRes = await pos.request('main', '/api/reports/x-report', {
        token: owner.token,
      });
      const xBefore = assertJson(
        xBeforeRes,
        200,
        (d) =>
          d?.xReport?.alreadyClosed === false &&
          d?.xReport?.billCount === 1 &&
          d?.xReport?.grossCollected > 0 &&
          d?.xReport?.expectedCashCents > 0,
      ).xReport;

      const closeRes = await pos.request('main', '/api/cash-closures', {
        method: 'POST',
        token: owner.token,
        body: {
          business_date: xBefore.businessDate,
          opening_float_cents: 0,
          counted_cash_cents: xBefore.expectedCashCents,
          notes: 'E2E clean close',
        },
      });
      assertJson(
        closeRes,
        201,
        (d) => d?.zReport?.variance_cents === 0 && d?.zReport?.bill_count === 1,
      );

      const zRes = await pos.request(
        'main',
        `/api/reports/z-report?date=${encodeURIComponent(xBefore.businessDate)}`,
        { token: owner.token },
      );
      assertJson(
        zRes,
        200,
        (d) =>
          d?.zReport?.business_date === xBefore.businessDate &&
          d?.zReport?.variance_cents === 0 &&
          d?.zReport?.bill_count === 1,
      );

      const xAfterRes = await pos.request(
        'main',
        `/api/reports/x-report?date=${encodeURIComponent(xBefore.businessDate)}`,
        { token: owner.token },
      );
      assertJson(xAfterRes, 200, (d) => d?.xReport?.alreadyClosed === true);
    });
  },
});

registerTest({
  id: 'f11:t1:financial-daily-summary-and-sales-reports',
  tier: 1,
  feature: 'F11',
  title: 'Daily stats, summary, financial, financial-summary, sales, tax-components, and staff-performance',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const { productId } = await createProduct(pos, owner.token, { price: 400 });
      const { bill } = await createAndPayOrder(pos, owner.token, productId, { method: 'cash' });

      const dailyRes = await pos.request('main', '/api/reports/daily-stats', { token: owner.token });
      assertJson(dailyRes, 200, (d) => d?.sales >= Number(bill.total));

      const summaryRes = await pos.request('main', '/api/reports/summary', { token: owner.token });
      assertJson(
        summaryRes,
        200,
        (d) => d?.summary?.orders?.count === 1 && d?.summary?.bills?.collected >= Number(bill.total),
      );

      const finRes = await pos.request('main', '/api/reports/financial', { token: owner.token });
      assertJson(
        finRes,
        200,
        (d) => d?.billCount === 1 && d?.grossCollected >= Number(bill.total),
      );

      const finSumRes = await pos.request('main', '/api/reports/financial-summary', {
        token: owner.token,
      });
      assertJson(
        finSumRes,
        200,
        (d) =>
          d?.financialSummary?.billCount === 1 &&
          d?.financialSummary?.netCollected >= Number(bill.total),
      );

      const salesRes = await pos.request('main', '/api/reports/sales', { token: owner.token });
      assertJson(salesRes, 200, (d) => Array.isArray(d?.sales?.dailySales) && d.sales.dailySales.length >= 1);

      const taxRes = await pos.request('main', '/api/reports/tax-components', { token: owner.token });
      assertJson(taxRes, 200, (d) => d?.taxComponents?.billCount === 1);

      const staffPerfRes = await pos.request('main', '/api/reports/staff-performance', {
        token: owner.token,
      });
      assertJson(staffPerfRes, 200, (d) => d !== null);
    });
  },
});

registerTest({
  id: 'f11:t1:audit-log-query-and-csv-export',
  tier: 1,
  feature: 'F11',
  title: 'Audit log queries filtered records as JSON and exports RFC-4180 CSV',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      await pos.request('main', '/api/printers/open-drawer', {
        method: 'POST',
        token: owner.token,
        body: { reason: 'Audit trail test' },
      });

      const listRes = await pos.request('main', '/api/audit-log?action=cash_drawer_open', {
        token: owner.token,
      });
      assertJson(
        listRes,
        200,
        (d) =>
          d?.ok === true &&
          d?.total >= 1 &&
          Array.isArray(d?.data) &&
          d.data.some((row: any) => row.action === 'cash_drawer_open'),
      );

      const csvRes = await pos.request('main', '/api/audit-log?format=csv', {
        token: owner.token,
      });
      assertStatus(csvRes, 200, 'audit-log csv export');
      const contentType = csvRes.headers.get('content-type') || '';
      assert(contentType.includes('text/csv'), `Expected text/csv, got ${contentType}`);
      assert(
        csvRes.rawText.includes('id,ts,actor_user_id') && csvRes.rawText.includes('cash_drawer_open'),
        'Expected audit CSV header and cash_drawer_open row',
      );
    });
  },
});

registerTest({
  id: 'f11:t1:audit-log-verify-hash-chain-and-anomalies',
  tier: 1,
  feature: 'F11',
  title: 'Audit log hash chain verifies intact and detects excessive drawer opens anomaly',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      for (let i = 0; i < 3; i += 1) {
        await pos.request('main', '/api/printers/open-drawer', {
          method: 'POST',
          token: owner.token,
          body: { reason: `No sale #${i + 1}` },
        });
      }

      const verifyRes = await pos.request('main', '/api/audit-log/verify', { token: owner.token });
      assertJson(
        verifyRes,
        200,
        (d) => d?.ok === true && d?.valid === true && Number(d?.totalRows) >= 3,
      );

      const anomRes = await pos.request('main', '/api/audit-log/anomalies?days=7', {
        token: owner.token,
      });
      assertJson(
        anomRes,
        200,
        (d) =>
          d?.ok === true &&
          Array.isArray(d?.anomalies) &&
          d.anomalies.some((a: any) => a.type === 'excessive_drawer_opens'),
      );
    });
  },
});

registerTest({
  id: 'f11:t2:customer-duplicate-phone-409-and-invalid-400',
  tier: 2,
  feature: 'F11',
  title: 'Customer creation rejects invalid phone (400 {message}), duplicate E.164 phone (409), and bad per_page',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const badPhone = await pos.request('main', '/api/customers', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Bad Phone', phone: '123' },
      });
      assertJson(badPhone, 400, (d) => typeof d?.message === 'string' && d.message.length > 0);

      await assertJson(
        await pos.request('main', '/api/customers', {
          method: 'POST',
          token: owner.token,
          body: { name: 'First Guest', phone: '+919876543210' },
        }),
        201,
      );

      const dupRes = await pos.request('main', '/api/customers', {
        method: 'POST',
        token: owner.token,
        body: { name: 'Dup Guest', phone: '9876543210' },
      });
      assertJson(dupRes, 409, (d) => typeof d?.message === 'string' && d.message.length > 0);

      const badPerPage = await pos.request('main', '/api/customers?per_page=abc', {
        token: owner.token,
      });
      assertStatus(badPerPage, 400, 'invalid per_page');
    });
  },
});

registerTest({
  id: 'f11:t2:crm-lookup-missing-and-short-search',
  tier: 2,
  feature: 'F11',
  title: 'CRM lookup missing phone returns 400, short search returns [], unknown lookup returns found=false',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      assertStatus(
        await pos.request('main', '/api/crm/lookup', { token: owner.token }),
        400,
        'crm/lookup missing phone',
      );

      const shortRes = await pos.request('main', '/api/customers-search?q=a', {
        token: owner.token,
      });
      assertJson(shortRes, 200, (d) => Array.isArray(d) && d.length === 0);

      const unknownRes = await pos.request('main', '/api/crm/lookup?phone=%2B919999900000', {
        token: owner.token,
      });
      assertJson(unknownRes, 200, (d) => d?.found === false && d?.customer === null);
    });
  },
});

registerTest({
  id: 'f11:t2:z-report-404-before-close-and-duplicate-closure-409',
  tier: 2,
  feature: 'F11',
  title: 'Z-report returns 404 before close and duplicate cash closure on same business_date returns 409',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const zBefore = await pos.request('main', '/api/reports/z-report', { token: owner.token });
      assertJson(zBefore, 404, (d) => d?.alreadyClosed === false);

      const xRes = await pos.request('main', '/api/reports/x-report', { token: owner.token });
      const businessDate = assertJson(xRes, 200).xReport.businessDate;

      const firstClose = await pos.request('main', '/api/cash-closures', {
        method: 'POST',
        token: owner.token,
        body: { business_date: businessDate, opening_float_cents: 0, counted_cash_cents: 0 },
      });
      assertStatus(firstClose, 201, 'first cash closure');

      const dupClose = await pos.request('main', '/api/cash-closures', {
        method: 'POST',
        token: owner.token,
        body: { business_date: businessDate, opening_float_cents: 0, counted_cash_cents: 0 },
      });
      assertStatus(dupClose, 409, 'duplicate cash closure');
    });
  },
});

registerTest({
  id: 'f11:t2:financial-summary-owner-only-and-bad-dates',
  tier: 2,
  feature: 'F11',
  title: 'Financial summary rejects manager (403), inverted date range (400), and malformed dates (400)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const manager = await createStaffMember(pos, owner.token, {
        name: 'Mgr Fin',
        email: 'mgrfin@e2e.local',
        password: 'MgrPass123!',
        role: 'manager',
        pin: '4567',
      });

      assertStatus(
        await pos.request('main', '/api/reports/financial-summary', { token: manager.token }),
        403,
        'manager financial-summary',
      );

      assertStatus(
        await pos.request(
          'main',
          '/api/reports/financial-summary?start_date=2026-11-10&end_date=2026-11-01',
          { token: owner.token },
        ),
        400,
        'inverted start_date > end_date',
      );

      assertStatus(
        await pos.request('main', '/api/reports/financial-summary?start_date=bad-date', {
          token: owner.token,
        }),
        400,
        'malformed start_date',
      );
    });
  },
});

registerTest({
  id: 'f11:t2:reports-and-audit-rbac-403',
  tier: 2,
  feature: 'F11',
  title: 'Cashier, server, and chef receive 403 on reports and audit-log endpoints',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const cashier = await createStaffMember(pos, owner.token, {
        name: 'Cashier R',
        email: 'cashr@e2e.local',
        password: 'CashPass123!',
        role: 'cashier',
      });
      const server = await createStaffMember(pos, owner.token, {
        name: 'Server R',
        email: 'servr@e2e.local',
        password: 'ServPass123!',
        role: 'server',
      });
      const chef = await createStaffMember(pos, owner.token, {
        name: 'Chef R',
        email: 'chefr@e2e.local',
        password: 'ChefPass123!',
        role: 'chef',
      });

      const protectedPaths = [
        '/api/reports/x-report',
        '/api/reports/daily-stats',
        '/api/audit-log',
        '/api/audit-log/verify',
        '/api/audit-log/anomalies',
      ];

      for (const actor of [cashier, server, chef]) {
        for (const p of protectedPaths) {
          assertStatus(
            await pos.request('main', p, { token: actor.token }),
            403,
            `RBAC check for ${p}`,
          );
        }
      }
    });
  },
});

registerTest({
  id: 'f11:t2:customer-unauthenticated-and-delete-cleanup-rbac',
  tier: 2,
  feature: 'F11',
  title: 'Unauthenticated /api/customers returns 401 and manager DELETE /customers/admin/cleanup returns 403',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const manager = await createStaffMember(pos, owner.token, {
        name: 'Mgr Cust',
        email: 'mgrcust@e2e.local',
        password: 'MgrPass123!',
        role: 'manager',
        pin: '5678',
      });

      assertStatus(await pos.request('main', '/api/customers'), 401, 'unauthenticated /api/customers');
      assertStatus(
        await pos.request('main', '/api/customers/admin/cleanup', {
          method: 'DELETE',
          token: manager.token,
        }),
        403,
        'manager DELETE /api/customers/admin/cleanup',
      );
    });
  },
});

// ============================================================================
// F12: Local QR, Aggregators, AI, DB/Backup, Integrations, Cloud HQ & Licensing
// ============================================================================

registerTest({
  id: 'f12:t1:qr-code-menu-order-and-track',
  tier: 1,
  feature: 'F12',
  title: 'QR capability code issuance, table-scoped menu, self-order submit, and order tracking',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const table = await createTable(pos, owner.token, 'QR-1');
      const { productId } = await createProduct(pos, owner.token, {
        productName: 'Veg Pulao',
        price: 180,
      });

      const codeRes = await pos.request('main', `/api/qr/tables/${table.id}/code`, {
        token: owner.token,
      });
      const codeData = assertJson(
        codeRes,
        200,
        (d) =>
          d?.ok === true &&
          typeof d?.table_token === 'string' &&
          d.table_token.length === 43 &&
          String(d?.qr_url || '').includes('#token=') &&
          String(d?.qr_data_url || '').startsWith('data:image/png;base64,'),
      );

      const menuRes = await pos.request('main', `/api/qr/menu?table_id=${table.id}`, {
        token: codeData.table_token,
      });
      assertJson(
        menuRes,
        200,
        (d) =>
          d?.ok === true &&
          d?.table?.id === table.id &&
          d?.products?.some((p: any) => p.id === productId),
      );

      const orderRes = await pos.request('main', '/api/qr/order', {
        method: 'POST',
        token: codeData.table_token,
        body: {
          table_id: table.id,
          items: [{ product_id: productId, quantity: 2 }],
          special_instructions: 'Less spicy',
        },
      });
      const order = assertJson(
        orderRes,
        201,
        (d) =>
          d?.ok === true &&
          d?.order?.status === 'pending' &&
          typeof d?.order?.tracking_token === 'string' &&
          d.order.tracking_token.length === 43,
      ).order;

      const trackRes = await pos.request('main', `/api/qr/order/${order.id}/track`, {
        token: order.tracking_token,
      });
      assertJson(
        trackRes,
        200,
        (d) => d?.ok === true && d?.order?.id === order.id && d?.items?.length === 1,
      );
    });
  },
});

registerTest({
  id: 'f12:t1:aggregators-swiggy-zomato-webhooks-and-lifecycle',
  tier: 1,
  feature: 'F12',
  title: 'Swiggy/Zomato HMAC webhooks, deduplication, rider update, accept->ready->dispatch, and outbox',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const { productId, name: productName, price } = await createProduct(pos, owner.token, {
        productName: 'Chicken Biryani',
        price: 260,
      });

      const swSecret = 'sw-secret-e2e';
      const zmSecret = 'zm-secret-e2e';

      assertJson(
        await pos.request('main', '/api/aggregators/settings', {
          method: 'PUT',
          token: owner.token,
          body: {
            platform: 'swiggy',
            is_enabled: true,
            auto_accept: false,
            default_prep_time_minutes: 20,
            webhook_secret: swSecret,
          },
        }),
        200,
        (d) => d?.ok === true,
      );

      assertJson(
        await pos.request('main', '/api/aggregators/settings', {
          method: 'PUT',
          token: owner.token,
          body: {
            platform: 'zomato',
            is_enabled: true,
            auto_accept: false,
            default_prep_time_minutes: 25,
            webhook_secret: zmSecret,
          },
        }),
        200,
        (d) => d?.ok === true,
      );

      const swPayload = JSON.stringify({
        order_id: 'SW-E2E-101',
        customer: { name: 'Swiggy Guest', phone: '+919800011122' },
        delivery_address: '100ft Rd, Indiranagar',
        items: [{ item_id: productId, name: productName, quantity: 1, price }],
        bill_details: { subtotal: price, taxes: 13, total: price + 13 },
      });

      const swOrderRes = await pos.request('main', '/api/webhooks/swiggy/order', {
        method: 'POST',
        rawBody: swPayload,
        headers: signSwiggyWebhook(swSecret, swPayload),
      });
      const swData = assertJson(
        swOrderRes,
        200,
        (d) => d?.ok === true && d?.kitchen_status === 'pending' && d?.duplicate === false,
      );

      const swDupRes = await pos.request('main', '/api/webhooks/swiggy/order', {
        method: 'POST',
        rawBody: swPayload,
        headers: signSwiggyWebhook(swSecret, swPayload),
      });
      assertJson(swDupRes, 200, (d) => d?.duplicate === true && d?.order_id === swData.order_id);

      const zmPayload = JSON.stringify({
        order_id: 'ZM-E2E-202',
        customer_details: { name: 'Zomato Guest', phone: '+919800033344' },
        order_items: [{ id: productId, name: productName, quantity: 1, price }],
        payment: { subtotal: price, taxes: 13, total: price + 13 },
      });
      const zmOrderRes = await pos.request('main', '/api/webhooks/zomato/order', {
        method: 'POST',
        rawBody: zmPayload,
        headers: signZomatoWebhook(zmSecret, zmPayload, 'x-zomato-auth'),
      });
      assertJson(zmOrderRes, 200, (d) => d?.ok === true && d?.kitchen_status === 'pending');

      const riderPayload = JSON.stringify({
        order_id: 'SW-E2E-101',
        status: 'arrived',
        rider: { name: 'Raju', phone: '+919900112233' },
      });
      const riderRes = await pos.request('main', '/api/webhooks/swiggy/rider', {
        method: 'POST',
        rawBody: riderPayload,
        headers: signSwiggyWebhook(swSecret, riderPayload),
      });
      assertJson(riderRes, 200, (d) => d?.ok === true && d?.rider_status === 'arrived');

      assertJson(
        await pos.request('main', `/api/aggregators/orders/${swData.order_id}/accept`, {
          method: 'POST',
          token: owner.token,
          body: { prep_time_minutes: 15 },
        }),
        200,
        (d) => d?.ok === true && d?.status === 'preparing',
      );

      assertJson(
        await pos.request('main', `/api/aggregators/orders/${swData.order_id}/ready`, {
          method: 'POST',
          token: owner.token,
        }),
        200,
        (d) => d?.ok === true && d?.status === 'ready',
      );

      assertJson(
        await pos.request('main', `/api/aggregators/orders/${swData.order_id}/dispatch`, {
          method: 'POST',
          token: owner.token,
        }),
        200,
        (d) => d?.ok === true && d?.status === 'completed' && d?.rider_status === 'dispatched',
      );

      const listRes = await pos.request('main', '/api/aggregators/orders', { token: owner.token });
      assertJson(listRes, 200, (d) => d?.ok === true && d?.orders?.length >= 2);

      const outboxRes = await pos.request('main', '/api/aggregators/outbox', { token: owner.token });
      assertJson(outboxRes, 200, (d) => d?.ok === true && Array.isArray(d?.outbox));

      const retryRes = await pos.request('main', '/api/aggregators/outbox/retry', {
        method: 'POST',
        token: owner.token,
      });
      assertJson(retryRes, 200, (d) => d?.ok === true);
    });
  },
});

registerTest({
  id: 'f12:t1:ai-config-insights-ask-and-guest-sommelier',
  tier: 1,
  feature: 'F12',
  title: 'AI config, insights, ask copilot, and QR-token authenticated sommelier + waiter chat',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await createProduct(pos, owner.token, { productName: 'Hyderabadi Dum Biryani', price: 320 });
      const table = await createTable(pos, owner.token, 'AI-1');

      const cfgGet = await pos.request('main', '/api/ai/config', { token: owner.token });
      assertJson(cfgGet, 200, (d) => d?.ok === true && Array.isArray(d?.popular_models));

      const cfgPost = await pos.request('main', '/api/ai/config', {
        method: 'POST',
        token: owner.token,
        body: { enabled: false },
      });
      assertJson(cfgPost, 200, (d) => d?.ok === true && d?.enabled === false);

      const insightsRes = await pos.request('main', '/api/ai/insights', { token: owner.token });
      assertJson(
        insightsRes,
        200,
        (d) => d?.ok === true && Boolean(d?.bcg_matrix) && Array.isArray(d?.prep_forecast),
      );

      const askRes = await pos.request('main', '/api/ai/ask', {
        method: 'POST',
        token: owner.token,
        body: { question: 'How are sales performing today?' },
      });
      assertJson(
        askRes,
        200,
        (d) => d?.ok === true && typeof d?.answer === 'string' && d.answer.length > 0,
      );

      const sommelierRes = await pos.request('main', '/api/ai/dish-sommelier', {
        method: 'POST',
        token: owner.token,
        body: { dish_name: 'Hyderabadi Dum Biryani', table_id: table.id },
      });
      assertJson(sommelierRes, 200, (d) => d !== null);

      const chatRes = await pos.request('main', '/api/ai/waiter-chat', {
        method: 'POST',
        token: owner.token,
        body: {
          table_id: table.id,
          messages: [{ role: 'user', content: 'What biryani do you recommend?' }],
        },
      });
      assertJson(
        chatRes,
        200,
        (d) => d?.ok === true && typeof d?.text === 'string' && d.text.length > 0,
      );
    });
  },
});

registerTest({
  id: 'f12:t1:db-health-wal-checkpoint-and-redacted-export',
  tier: 1,
  feature: 'F12',
  title: 'DB health-check, safe-fixes, system health, WAL checkpoint, and redacted DB export',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const hcRes = await pos.request('main', '/api/db-tools/health-check', { token: owner.token });
      assertJson(hcRes, 200, (d) => d !== null);

      const fixRes = await pos.request('main', '/api/db-tools/apply-safe-fixes', {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertJson(fixRes, 200, (d) => d !== null);

      const sysHealth = await pos.request('main', '/api/system/health', { token: owner.token });
      assertJson(
        sysHealth,
        200,
        (d) => d?.status === 'ok' && d?.database?.ok === true && d?.database?.integrity === 'ok',
      );

      const walRes = await pos.request('main', '/api/system/wal-checkpoint', {
        method: 'POST',
        token: owner.token,
      });
      assertJson(walRes, 200, (d) => d?.ok === true && d?.checkpoint !== undefined);

      const expRes = await pos.request('main', '/api/db/export', { token: owner.token });
      assertJson(expRes, 200, (d) => {
        if (d?.version !== 1 || !Array.isArray(d?.redacted_fields)) return false;
        const usersClean =
          Array.isArray(d?.data?.users) &&
          d.data.users.every(
            (u: any) => u.password === undefined && u.pin === undefined && u.pin_hash === undefined,
          );
        const jwtRow = d?.data?.settings?.find((s: any) => s.key === 'jwt_secret');
        return usersClean && (!jwtRow || jwtRow.value === '[REDACTED]');
      });
    });
  },
});

registerTest({
  id: 'f12:t1:offline-resilience-s3-mongodb-gdrive-whatsapp',
  tier: 1,
  feature: 'F12',
  title: 'Offline resilience across S3 mock backup, MongoDB, Google Drive, and WhatsApp status',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const s3Status = await pos.request('main', '/api/s3/status', { token: owner.token });
      assertJson(
        s3Status,
        200,
        (d) => d?.ok === true && typeof d?.status?.enabled === 'boolean' && d?.status?.configured === false,
      );

      const s3Backup = await pos.request('main', '/api/s3/backup-now', {
        method: 'POST',
        token: owner.token,
        body: {},
      });
      assertJson(s3Backup, 200, (d) => d?.ok === true && d?.result?.success === true);

      const mongoStatus = await pos.request('main', '/api/mongodb/status', { token: owner.token });
      assertJson(mongoStatus, 200, (d) => d?.ok === true && d?.status?.connected === false);

      const gdriveStatus = await pos.request('main', '/api/settings/google-drive', {
        token: owner.token,
      });
      assertJson(
        gdriveStatus,
        200,
        (d) => d?.secure_storage_available === false && d?.connected === false,
      );

      const waStatus = await pos.request('main', '/api/whatsapp/status', { token: owner.token });
      assertJson(waStatus, 200, (d) => d?.enabled === false && typeof d?.state === 'string');
    });
  },
});

registerTest({
  id: 'f12:t1:cloud-hq-overview-branches-and-pos-pair',
  tier: 1,
  feature: 'F12',
  title: 'Cloud HQ overview reflects cash/UPI bills, creates branch, and generates/claims terminal pairing PIN',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await pos.activatePlan('DEV-PRO', owner.token);

      const upiMethodRes = await pos.request('main', '/api/payment-methods', {
        method: 'POST',
        token: owner.token,
        body: { name: 'UPI' },
      });
      assertStatus(upiMethodRes, [201, 409], 'create UPI payment method');

      const { productId } = await createProduct(pos, owner.token, {
        productName: 'Cloud Pasta',
        price: 200,
      });
      const cashSale = await createAndPayOrder(pos, owner.token, productId, { method: 'cash' });
      const upiSale = await createAndPayOrder(pos, owner.token, productId, { method: 'UPI' });

      const expectedCash = Math.round(Number(cashSale.bill.total));
      const expectedUpi = Math.round(Number(upiSale.bill.total));

      const branchRes = await pos.request('main', '/api/cloud/branches', {
        method: 'POST',
        token: owner.token,
        body: {
          name: 'Indiranagar Outlet',
          code: 'IND02',
          email: 'ind02@e2e.local',
          password: 'BranchPass123!',
          pin: '4321',
        },
      });
      const branch = assertJson(
        branchRes,
        201,
        (d) => d?.success === true && d?.branch?.code === 'IND02',
      ).branch;

      const brLogin = await pos.login('ind02@e2e.local', 'BranchPass123!', 'main');
      await createAndPayOrder(pos, brLogin.token, productId, { method: 'cash' });

      const ovAll = await pos.request('main', '/api/cloud/overview', { token: owner.token });
      assertJson(ovAll, 200, (d) => {
        if (d?.success !== true || d?.total_orders < 3 || d?.total_revenue < 600) return false;
        const cashTender = d?.payment_tenders?.find((t: any) => t.method === 'cash');
        const upiTender = d?.payment_tenders?.find((t: any) => t.method === 'upi');
        const mainBr = d?.branches?.find((b: any) => b.isMain);
        return (
          cashTender?.amount >= expectedCash &&
          upiTender?.amount >= expectedUpi &&
          mainBr?.cashSales >= expectedCash &&
          mainBr?.digitalSales >= expectedUpi
        );
      });

      const ovBranch = await pos.request('main', `/api/cloud/overview?branch_id=${branch.id}`, {
        token: owner.token,
      });
      assertJson(ovBranch, 200, (d) => {
        const b = d?.branches?.find((x: any) => x.id === branch.id);
        return Boolean(b) && b.orders >= 1 && b.cashSales > 0;
      });

      const pairGen = await pos.request('main', '/api/cloud/pair/generate', {
        method: 'POST',
        token: owner.token,
        body: { terminal_name: 'KDS Tablet 1' },
      });
      const code = assertJson(
        pairGen,
        200,
        (d) => d?.success === true && typeof d?.code === 'string',
      ).code;

      const pairClaim = await pos.request('main', '/api/pos/pair', {
        method: 'POST',
        body: { code },
      });
      assertJson(pairClaim, 200, (d) => d?.success === true && typeof d?.terminal_id === 'string');
    });
  },
});

registerTest({
  id: 'f12:t1:subscription-plans-create-verify-and-dev-keys',
  tier: 1,
  feature: 'F12',
  title: 'Subscription status, dev-key plan transitions, create-order, and mock payment verification',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const getRes = await pos.request('main', '/api/subscription', { token: owner.token });
      assertJson(getRes, 200, (d) => d?.ok === true && Boolean(d?.subscription) && Boolean(d?.pricing));

      const starter = await pos.activatePlan('DEV-STARTER', owner.token);
      assertEqual(starter?.subscription?.plan, 'starter', 'starter plan');

      const pro = await pos.activatePlan('DEV-PRO', owner.token);
      assertEqual(pro?.subscription?.plan, 'pro', 'pro plan');

      const ent = await pos.activatePlan('DEV-ENTERPRISE', owner.token);
      assertEqual(ent?.subscription?.plan, 'enterprise', 'enterprise plan');

      const orderRes = await pos.request('main', '/api/subscription/create-order', {
        method: 'POST',
        token: owner.token,
        body: { plan: 'pro', billingCycle: 'yearly' },
      });
      const orderData = assertJson(
        orderRes,
        200,
        (d) => d?.ok === true && Boolean(d?.order?.orderId) && d?.order?.provider === 'mock',
      );

      const verRes = await pos.request('main', '/api/subscription/verify-payment', {
        method: 'POST',
        token: owner.token,
        body: {
          orderId: orderData.order.orderId,
          paymentId: 'pay_mock_e2e_1',
          signature: 'sig_mock_valid',
        },
      });
      assertJson(
        verRes,
        200,
        (d) =>
          d?.ok === true &&
          d?.subscription?.plan === 'pro' &&
          d?.subscription?.status === 'active',
      );
    });
  },
});

registerTest({
  id: 'f12:t1:subscription-razorpay-webhook-hmac-and-dedup',
  tier: 1,
  feature: 'F12',
  title: 'Razorpay subscription webhook verifies HMAC-SHA256 and deduplicates replays',
  async run(): Promise<void> {
    const secret = 'rzp_e2e_secret_123';
    await withLocalPos({ env: { RAZORPAY_WEBHOOK_SECRET: secret } }, async (pos) => {
      const owner = await pos.setupOwner();

      const orderRes = await pos.request('main', '/api/subscription/create-order', {
        method: 'POST',
        token: owner.token,
        body: { plan: 'pro', billingCycle: 'monthly' },
      });
      const orderId = assertJson(orderRes, 200).order.orderId;

      const rawBody = JSON.stringify({
        id: 'evt_e2e_1001',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_e2e_1001',
              order_id: orderId,
              amount: 129900,
              currency: 'INR',
              status: 'captured',
              captured: true,
            },
          },
        },
      });

      const firstRes = await pos.request('main', '/api/subscription/webhooks/razorpay', {
        method: 'POST',
        rawBody,
        headers: signRazorpayWebhook(secret, rawBody),
      });
      assertJson(firstRes, 200, (d) => d?.ok === true && d?.status === 'processed');

      const replayRes = await pos.request('main', '/api/subscription/webhooks/razorpay', {
        method: 'POST',
        rawBody,
        headers: signRazorpayWebhook(secret, rawBody),
      });
      assertJson(replayRes, 200, (d) => d?.ok === true && d?.status === 'already_processed');
    });
  },
});

registerTest({
  id: 'f12:t2:qr-token-rotation-invalidates-old-and-missing-token-404',
  tier: 2,
  feature: 'F12',
  title: 'QR table token rotation revokes prior token (404) and invalid tracking token returns 404',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const table = await createTable(pos, owner.token, 'QR-ROT');
      const { productId } = await createProduct(pos, owner.token, { price: 120 });

      const c1 = assertJson(
        await pos.request('main', `/api/qr/tables/${table.id}/code`, { token: owner.token }),
        200,
      );
      const c2 = assertJson(
        await pos.request('main', `/api/qr/tables/${table.id}/code`, { token: owner.token }),
        200,
      );
      assert(c1.table_token !== c2.table_token, 'Expected rotated token to differ');

      assertStatus(
        await pos.request('main', `/api/qr/menu?table_id=${table.id}`, { token: c1.table_token }),
        404,
        'revoked QR token on /qr/menu',
      );
      assertStatus(
        await pos.request('main', '/api/qr/order', {
          method: 'POST',
          token: c1.table_token,
          body: { table_id: table.id, items: [{ product_id: productId, quantity: 1 }] },
        }),
        404,
        'revoked QR token on /qr/order',
      );

      const orderRes = await pos.request('main', '/api/qr/order', {
        method: 'POST',
        token: c2.table_token,
        body: { table_id: table.id, items: [{ product_id: productId, quantity: 1 }] },
      });
      const order = assertJson(orderRes, 201).order;

      const wrongTrackToken = 'A'.repeat(43);
      assertStatus(
        await pos.request('main', `/api/qr/order/${order.id}/track`, { token: wrongTrackToken }),
        404,
        'wrong tracking token',
      );
    });
  },
});

registerTest({
  id: 'f12:t2:qr-call-waiter-and-service-calls-require-auth',
  tier: 2,
  feature: 'F12',
  title: 'QR call-waiter requires table token/staff auth and service-calls requires staff auth (Target M2)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const table = await createTable(pos, owner.token, 'QR-AUTH');

      const callRes = await pos.request('main', '/api/qr/call-waiter', {
        method: 'POST',
        body: { table_id: table.id, type: 'waiter', notes: 'Water please' },
      });
      assertStatus(callRes, [401, 404], 'unauthenticated POST /api/qr/call-waiter');

      const listRes = await pos.request('main', '/api/qr/service-calls');
      assertStatus(listRes, 401, 'unauthenticated GET /api/qr/service-calls');
    });
  },
});

registerTest({
  id: 'f12:t2:aggregator-zomato-cancel-x-zomato-auth-and-bad-hmac',
  tier: 2,
  feature: 'F12',
  title: 'Aggregators reject unconfigured (503) & bad HMAC (401), and accept x-zomato-auth on cancel (Target M2)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const { productId, name: productName, price } = await createProduct(pos, owner.token, {
        price: 210,
      });

      const unconfRes = await pos.request('main', '/api/webhooks/swiggy/order', {
        method: 'POST',
        rawBody: JSON.stringify({ order_id: 'SW-UNCONF' }),
      });
      assertStatus(unconfRes, 503, 'unconfigured aggregator webhook');

      const zmSecret = 'zm-cancel-secret';
      await assertJson(
        await pos.request('main', '/api/aggregators/settings', {
          method: 'PUT',
          token: owner.token,
          body: {
            platform: 'zomato',
            is_enabled: true,
            auto_accept: false,
            default_prep_time_minutes: 20,
            webhook_secret: zmSecret,
          },
        }),
        200,
      );

      const orderRaw = JSON.stringify({
        order_id: 'ZM-CANCEL-1',
        order_items: [{ id: productId, name: productName, quantity: 1, price }],
        payment: { subtotal: price, taxes: 0, total: price },
      });

      const badHmacRes = await pos.request('main', '/api/webhooks/zomato/order', {
        method: 'POST',
        rawBody: orderRaw,
        headers: { 'x-zomato-auth': 'deadbeef' },
      });
      assertStatus(badHmacRes, 401, 'bad HMAC on zomato order');

      assertJson(
        await pos.request('main', '/api/webhooks/zomato/order', {
          method: 'POST',
          rawBody: orderRaw,
          headers: signZomatoWebhook(zmSecret, orderRaw, 'x-zomato-auth'),
        }),
        200,
      );

      const cancelRaw = JSON.stringify({
        order_id: 'ZM-CANCEL-1',
        reason: 'Customer cancelled order',
      });
      const cancelRes = await pos.request('main', '/api/webhooks/zomato/cancel', {
        method: 'POST',
        rawBody: cancelRaw,
        headers: signZomatoWebhook(zmSecret, cancelRaw, 'x-zomato-auth'),
      });
      assertJson(cancelRes, 200, (d) => d?.ok === true && d?.status === 'cancelled');
    });
  },
});

registerTest({
  id: 'f12:t2:ai-unauthenticated-401-and-oversized-payload-413',
  tier: 2,
  feature: 'F12',
  title: 'AI guest endpoints reject unauthenticated calls (401), >8KB bodies (413), and >12 turns (400)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const unauthRes = await pos.request('main', '/api/ai/dish-sommelier', {
        method: 'POST',
        body: { dish_name: 'Biryani' },
      });
      assertStatus(unauthRes, 401, 'unauthenticated /api/ai/dish-sommelier');

      const hugeRes = await pos.request('main', '/api/ai/dish-sommelier', {
        method: 'POST',
        token: owner.token,
        body: { dish_name: 'Biryani', guest_query: 'x'.repeat(9000) },
      });
      assertStatus(hugeRes, 413, 'oversized >8KB AI payload');

      const turns = Array.from({ length: 13 }, (_, idx) => ({
        role: idx % 2 === 0 ? 'user' : 'assistant',
        content: `Turn ${idx + 1}`,
      }));
      const tooManyRes = await pos.request('main', '/api/ai/waiter-chat', {
        method: 'POST',
        token: owner.token,
        body: { messages: turns },
      });
      assertStatus(tooManyRes, 400, '>12 message turns on waiter-chat');
    });
  },
});

registerTest({
  id: 'f12:t2:db-master-pin-safestorage-and-owner-rbac',
  tier: 2,
  feature: 'F12',
  title: 'Master PIN reports safeStorage unavailable in dev-server, fails closed, and enforces owner RBAC',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      const manager = await createStaffMember(pos, owner.token, {
        name: 'Mgr DB',
        email: 'mgrdb@e2e.local',
        password: 'MgrPass123!',
        role: 'manager',
        pin: '6789',
      });

      const statusRes = await pos.request('main', '/api/db-tools/master-pin/status', {
        token: owner.token,
      });
      assertJson(statusRes, 200, (d) => d?.available === false && d?.isSet === false);

      const resetRes = await pos.request('main', '/api/db-tools/master-pin/reset', {
        method: 'POST',
        token: owner.token,
        body: { pin: '1234', confirm_pin: '1234' },
      });
      assertStatus(resetRes, 409, 'master-pin/reset when safeStorage unavailable');

      const initRes = await pos.request('main', '/api/db-tools/initialize', {
        method: 'POST',
        token: owner.token,
        body: { confirmation_phrase: 'INITIALIZE' },
      });
      assertStatus(initRes, 503, 'db-tools/initialize when safeStorage unavailable');

      assertStatus(
        await pos.request('main', '/api/db/export', { token: manager.token }),
        403,
        'manager /api/db/export',
      );
      assertStatus(
        await pos.request('main', '/api/db-tools/health-check', { token: manager.token }),
        403,
        'manager /api/db-tools/health-check',
      );
    });
  },
});

registerTest({
  id: 'f12:t2:whatsapp-and-cloud-starter-gating-403',
  tier: 2,
  feature: 'F12',
  title: 'Starter plan gates WhatsApp & Cloud HQ (403 FEATURE_NOT_ENTITLED); Pro offline WhatsApp returns 503',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await pos.activatePlan('DEV-STARTER', owner.token);

      const waStarter = await pos.request('main', '/api/whatsapp/send', {
        method: 'POST',
        token: owner.token,
        body: { phone_e164: '+919876543210', body: 'Receipt' },
      });
      assertJson(waStarter, 403, (d) => d?.code === 'FEATURE_NOT_ENTITLED');

      const cloudOvStarter = await pos.request('main', '/api/cloud/overview', {
        token: owner.token,
      });
      assertJson(cloudOvStarter, 403, (d) => d?.code === 'FEATURE_NOT_ENTITLED');

      const cloudPairStarter = await pos.request('main', '/api/cloud/pair/generate', {
        method: 'POST',
        token: owner.token,
        body: { terminal_name: 'POS-1' },
      });
      assertJson(cloudPairStarter, 403, (d) => d?.code === 'FEATURE_NOT_ENTITLED');

      await pos.activatePlan('DEV-PRO', owner.token);

      const waEnable = await pos.request('main', '/api/whatsapp/enable', {
        method: 'POST',
        token: owner.token,
      });
      assertStatus(waEnable, 200, 'enable whatsapp on pro plan');

      const waProOffline = await pos.request('main', '/api/whatsapp/send', {
        method: 'POST',
        token: owner.token,
        body: { phone_e164: '+919876543210', body: 'Receipt' },
      });
      assertJson(waProOffline, 503, (d) => d?.reason === 'not_connected');
    });
  },
});

registerTest({
  id: 'f12:t2:pos-pair-replay-and-cross-branch-403-410',
  tier: 2,
  feature: 'F12',
  title: 'POS terminal pairing rejects cross-branch claim (403) and single-use replay (404/410)',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();
      await pos.activatePlan('DEV-PRO', owner.token);

      const genRes = await pos.request('main', '/api/cloud/pair/generate', {
        method: 'POST',
        token: owner.token,
        body: { branch_id: 'br-01', terminal_name: 'POS-1' },
      });
      const code = assertJson(genRes, 200, (d) => Boolean(d?.code)).code;

      const crossBranch = await pos.request('main', '/api/pos/pair', {
        method: 'POST',
        body: { code, branch_id: 'br-other-99' },
      });
      assertStatus(crossBranch, 403, 'cross-branch pairing claim');

      const validClaim = await pos.request('main', '/api/pos/pair', {
        method: 'POST',
        body: { code, branch_id: 'br-01' },
      });
      assertJson(validClaim, 200, (d) => d?.success === true);

      const replayClaim = await pos.request('main', '/api/pos/pair', {
        method: 'POST',
        body: { code, branch_id: 'br-01' },
      });
      assertStatus(replayClaim, [404, 410], 'replayed pairing PIN');
    });
  },
});

registerTest({
  id: 'f12:t2:razorpay-webhook-bad-hmac-401-and-invalid-license-400',
  tier: 2,
  feature: 'F12',
  title: 'Razorpay webhook rejects unconfigured (500) & bad/missing HMAC (401); invalid license returns 400',
  async run(): Promise<void> {
    await withLocalPos(async (pos) => {
      const owner = await pos.setupOwner();

      const unconfWebhook = await pos.request('main', '/api/subscription/webhooks/razorpay', {
        method: 'POST',
        rawBody: JSON.stringify({ id: 'evt_no_sec', event: 'payment.captured' }),
      });
      assertStatus(unconfWebhook, 500, 'razorpay webhook without RAZORPAY_WEBHOOK_SECRET');

      const badLicense = await pos.request('main', '/api/subscription/activate', {
        method: 'POST',
        token: owner.token,
        body: { licenseKey: 'INVALID-KEY-999' },
      });
      assertJson(badLicense, 400, (d) => d?.ok === false);
    });

    await withLocalPos({ env: { RAZORPAY_WEBHOOK_SECRET: 'rzp_sec_valid' } }, async (pos) => {
      const rawBody = JSON.stringify({ id: 'evt_bad_sig', event: 'payment.captured' });

      const missingSig = await pos.request('main', '/api/subscription/webhooks/razorpay', {
        method: 'POST',
        rawBody,
      });
      assertStatus(missingSig, 401, 'razorpay webhook missing signature');

      const badSig = await pos.request('main', '/api/subscription/webhooks/razorpay', {
        method: 'POST',
        rawBody,
        headers: { 'x-razorpay-signature': 'deadbeef' },
      });
      assertStatus(badSig, 401, 'razorpay webhook invalid signature');
    });
  },
});
