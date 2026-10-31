/**
 * Order It Up - Milestone M2 Operational Dashboards Empirical Challenger Test Suite
 * File: tests/challenger-m2-operational-dashboards.test.mjs
 *
 * Adversarial and empirical stress-tests for:
 * 1. Front Cashier: Split tender calculations, exact cash change, UPI dynamic QR URI generation, partial split balances.
 * 2. 24V Solenoid Cash Drawer Pulse: Bytecode [0x1B, 0x70, 0x00, 0x19, 0xFA], pulse triggers, till balance reconciliation.
 * 3. Kitchen Chef KDS (:3002): Station routing, 4-stage ticket bumping lifecycle (pending -> preparing -> ready -> served), SLA timer alerts.
 * 4. Server Waiter Handheld (:3003): Floor map zone rendering (Indoor, Patio, Rooftop, Private Dining), course firing triggers, table freeing.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const modelsModulePath = path.join(ROOT, 'landing', 'src', 'lib', 'dashboard-models.ts');
const storeModulePath = path.join(ROOT, 'landing', 'src', 'lib', 'dashboard-store.ts');

const {
  ESC_POS_DRAWER_KICK_BYTES,
  ESC_POS_DRAWER_KICK_HEX,
} = await import(`file://${modelsModulePath.replace(/\\/g, '/')}`);

const {
  INITIAL_DASHBOARD_STATE,
  getDashboardSnapshot,
  updateDashboardState,
  dashboardActions,
} = await import(`file://${storeModulePath.replace(/\\/g, '/')}`);

// Helper to reset store to fresh deep copy of INITIAL_DASHBOARD_STATE before tests
function resetStore() {
  updateDashboardState(() => JSON.parse(JSON.stringify(INITIAL_DASHBOARD_STATE)));
}

// Emulate CashierView calculations directly as implemented in CashierView.tsx
function calculateCashChange(tenderedInput, orderTotal) {
  const cashTenderedVal = parseFloat(tenderedInput) || 0;
  return Math.max(0, cashTenderedVal - orderTotal);
}

function calculateSplitBalance(orderTotal, splitCash, splitUpi, splitCard) {
  const splitCashVal = parseFloat(splitCash) || 0;
  const splitUpiVal = parseFloat(splitUpi) || 0;
  const splitCardVal = parseFloat(splitCard) || 0;
  const splitSum = splitCashVal + splitUpiVal + splitCardVal;
  const splitRemaining = Math.round((orderTotal - splitSum) * 100) / 100;
  const isSplitBalanced = Math.abs(splitRemaining) < 0.01;
  return {
    splitCashVal,
    splitUpiVal,
    splitCardVal,
    splitSum,
    splitRemaining,
    isSplitBalanced,
  };
}

function generateDynamicUpiUri(payeeVpa, payeeName, orderTotal) {
  return `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${orderTotal.toFixed(2)}&cu=INR`;
}

// Emulate KitchenChefView station filtering & SLA tier calculations
function filterKdsTickets(orders, activeStation, statusFilter, referenceTime) {
  return orders
    .filter((order) => {
      const allItemsServed = order.items.every((i) => i.status === 'served');
      if (statusFilter === 'active' && allItemsServed) return false;
      if (statusFilter === 'served' && !allItemsServed) return false;

      if (activeStation !== 'all') {
        return order.items.some((i) => i.station === activeStation);
      }
      return true;
    })
    .map((order) => {
      const stationItems =
        activeStation === 'all'
          ? order.items
          : order.items.filter((i) => i.station === activeStation);

      const baseCreatedAt = new Date(order.createdAt).getTime();
      const diffMinutes = Math.max(1, Math.round((referenceTime - baseCreatedAt) / 60000));

      let slaTier = 'normal';
      if (diffMinutes >= 20) {
        slaTier = 'breached';
      } else if (diffMinutes >= 10) {
        slaTier = 'warning';
      }

      return {
        order,
        stationItems,
        elapsedMinutes: diffMinutes,
        slaTier,
      };
    });
}

describe('Challenger M2: 1. Front Cashier Split Tenders & Calculations', () => {
  beforeEach(() => {
    resetStore();
  });

  it('calculates exact cash change return correctly across standard, excess, and under-tendered amounts', () => {
    const orderTotal = 2027.00;

    // Exact tender -> 0 change
    assert.equal(calculateCashChange('2027.00', orderTotal), 0);

    // Excess tender: e.g. paid ₹2500 on ₹2027 bill -> ₹473 change
    assert.equal(calculateCashChange('2500', orderTotal), 473.00);

    // Excess tender: paid ₹3000 -> ₹973 change
    assert.equal(calculateCashChange('3000', orderTotal), 973.00);

    // Under-tendered: paid ₹1500 -> change should be 0, never negative
    assert.equal(calculateCashChange('1500', orderTotal), 0);

    // Zero tendered
    assert.equal(calculateCashChange('0', orderTotal), 0);

    // Negative string input -> clamped to 0
    assert.equal(calculateCashChange('-500', orderTotal), 0);

    // Malformed input (empty or garbage string) -> 0 change
    assert.equal(calculateCashChange('', orderTotal), 0);
    assert.equal(calculateCashChange('abc', orderTotal), 0);

    // Fractional paise: e.g. paid ₹2030.50 on ₹2027.25
    const fractionalChange = calculateCashChange('2030.50', 2027.25);
    assert.ok(Math.abs(fractionalChange - 3.25) < 0.0001);
  });

  it('generates compliant BharatPe/NPCI Dynamic UPI QR URI with exact parameters and decimal formatting', () => {
    const uri = generateDynamicUpiUri('spiceroute@icici', 'Downtown Bistro', 2027.00);
    assert.equal(
      uri,
      'upi://pay?pa=spiceroute%40icici&pn=Downtown%20Bistro&am=2027.00&cu=INR'
    );

    // Test with integer total: must format with 2 decimals
    const uriInt = generateDynamicUpiUri('pos@upi', 'Spice Route CP', 1500);
    assert.ok(uriInt.includes('am=1500.00'));
    assert.ok(uriInt.includes('cu=INR'));
    assert.ok(uriInt.startsWith('upi://pay?'));

    // URL parameter parsing test
    const parsedUrl = new URL(uriInt);
    assert.equal(parsedUrl.protocol, 'upi:');
    assert.equal(parsedUrl.searchParams.get('pa'), 'pos@upi');
    assert.equal(parsedUrl.searchParams.get('pn'), 'Spice Route CP');
    assert.equal(parsedUrl.searchParams.get('am'), '1500.00');
    assert.equal(parsedUrl.searchParams.get('cu'), 'INR');
  });

  it('evaluates split tender allocations and detects exact, partial, and over-tender balances', () => {
    const orderTotal = 2027.00;

    // Case 1: Seed default split (Cash: 1000, UPI: 1027, Card: 0) -> Exact balance
    const exactSplit = calculateSplitBalance(orderTotal, '1000', '1027', '0');
    assert.equal(exactSplit.splitSum, 2027.00);
    assert.equal(exactSplit.splitRemaining, 0);
    assert.equal(exactSplit.isSplitBalanced, true);

    // Case 2: Under-allocated split (Cash: 500, UPI: 1000, Card: 0) -> Remaining 527
    const underSplit = calculateSplitBalance(orderTotal, '500', '1000', '0');
    assert.equal(underSplit.splitSum, 1500.00);
    assert.equal(underSplit.splitRemaining, 527.00);
    assert.equal(underSplit.isSplitBalanced, false);

    // Case 3: Over-allocated split (Cash: 1500, UPI: 1000, Card: 0) -> Negative remaining -473
    const overSplit = calculateSplitBalance(orderTotal, '1500', '1000', '0');
    assert.equal(overSplit.splitSum, 2500.00);
    assert.equal(overSplit.splitRemaining, -473.00);
    assert.equal(overSplit.isSplitBalanced, false);

    // Case 4: 3-way split with decimal precision (Cash: 500.25, UPI: 1026.75, Card: 500.00)
    const threeWay = calculateSplitBalance(orderTotal, '500.25', '1026.75', '500.00');
    assert.equal(threeWay.splitSum, 2027.00);
    assert.equal(threeWay.splitRemaining, 0);
    assert.equal(threeWay.isSplitBalanced, true);

    // Case 5: IEEE 754 floating point drift stress test (e.g. 100.33 total, split 33.44 + 33.44 + 33.45)
    const floatDrift = calculateSplitBalance(100.33, '33.44', '33.44', '33.45');
    assert.equal(floatDrift.isSplitBalanced, true);
    assert.equal(floatDrift.splitRemaining, 0);
  });

  it('executes split settlement in store and properly distributes revenue across tender buckets', () => {
    const snapBefore = getDashboardSnapshot();
    const order = snapBefore.orders.find((o) => o.id === 'ord-104');
    assert.ok(order, 'Order ord-104 must exist');
    assert.equal(order.paymentStatus, 'unpaid');

    const outletBefore = snapBefore.outlets.find((o) => o.id === order.outletId);
    const initialCashTender = outletBefore.tenders.cash;
    const initialUpiTender = outletBefore.tenders.upi;
    const initialCardTender = outletBefore.tenders.card;

    // Settle with split: ₹1000 Cash, ₹1027 UPI, ₹0 Card
    dashboardActions.settlePayment('ord-104', 'split', {
      cash: 1000,
      upi: 1027,
      card: 0,
      changeGiven: 0,
      cashDrawerPulsed: true,
      upiTransactionRef: 'UPI-TEST-123456',
    });

    const snapAfter = getDashboardSnapshot();
    const settledOrder = snapAfter.orders.find((o) => o.id === 'ord-104');
    assert.equal(settledOrder.paymentStatus, 'paid');
    assert.equal(settledOrder.settlement.method, 'split');
    assert.equal(settledOrder.settlement.splitBreakdown.cash, 1000);
    assert.equal(settledOrder.settlement.splitBreakdown.upi, 1027);

    // Outlet tenders incremented correctly
    const outletAfter = snapAfter.outlets.find((o) => o.id === order.outletId);
    assert.equal(outletAfter.tenders.cash, initialCashTender + 1000);
    assert.equal(outletAfter.tenders.upi, initialUpiTender + 1027);
    assert.equal(outletAfter.tenders.card, initialCardTender + 0);
    assert.equal(outletAfter.todaySales, outletBefore.todaySales + order.total);
  });

  it('rejects double-settling an already paid order', () => {
    // Settle once
    dashboardActions.settlePayment('ord-104', 'cash');
    const snap1 = getDashboardSnapshot();
    const sales1 = snap1.outlets.find((o) => o.id === 'outlet-1').todaySales;

    // Attempt second settlement
    dashboardActions.settlePayment('ord-104', 'upi');
    const snap2 = getDashboardSnapshot();
    const sales2 = snap2.outlets.find((o) => o.id === 'outlet-1').todaySales;

    // Sales and tender should remain unchanged
    assert.equal(sales1, sales2, 'Double settlement must not double-count sales');
  });
});

describe('Challenger M2: 2. 24V Solenoid Cash Drawer Pulse & Till Reconciliation', () => {
  beforeEach(() => {
    resetStore();
  });

  it('verifies ESC/POS 24V cash drawer kick pulse bytecode byte-for-byte', () => {
    // Standard: ESC p 0 25 250 -> 0x1B, 0x70, 0x00, 0x19, 0xFA
    assert.deepEqual(
      Array.from(ESC_POS_DRAWER_KICK_BYTES),
      [0x1B, 0x70, 0x00, 0x19, 0xFA],
      'Drawer kick bytes must be exactly [0x1B, 0x70, 0x00, 0x19, 0xFA]'
    );

    // Verify decimal values: 27, 112, 0, 25, 250
    assert.deepEqual(
      Array.from(ESC_POS_DRAWER_KICK_BYTES),
      [27, 112, 0, 25, 250],
      'Decimal values must match ESC p m t1 t2'
    );

    // Verify Hex constant
    assert.equal(ESC_POS_DRAWER_KICK_HEX, '1B 70 00 19 FA');

    // Verify Buffer creation from bytecode
    const buf = Buffer.from(ESC_POS_DRAWER_KICK_BYTES);
    assert.equal(buf.length, 5);
    assert.equal(buf[0], 0x1b);
    assert.equal(buf[1], 0x70);
    assert.equal(buf[2], 0x00);
    assert.equal(buf[3], 0x19);
    assert.equal(buf[4], 0xfa);
  });

  it('pure Cash settlement pulses drawer, logs pulse event, and increments till cash', () => {
    const snapBefore = getDashboardSnapshot();
    const initialExpectedCash = snapBefore.activeCashShift.expectedCashInDrawer;
    const initialGrossCash = snapBefore.activeCashShift.grossCashSales;
    const initialPulseCount = snapBefore.drawerPulseHistory.length;

    const order = snapBefore.orders.find((o) => o.id === 'ord-101');
    const orderTotal = order.total; // 1371

    dashboardActions.settlePayment('ord-101', 'cash');

    const snapAfter = getDashboardSnapshot();
    assert.equal(snapAfter.activeCashShift.grossCashSales, initialGrossCash + orderTotal);
    assert.equal(snapAfter.activeCashShift.expectedCashInDrawer, initialExpectedCash + orderTotal);
    assert.equal(snapAfter.drawerPulseHistory.length, initialPulseCount + 1);

    const latestPulse = snapAfter.drawerPulseHistory[0];
    assert.equal(latestPulse.orderId, order.orderNumber);
    assert.equal(latestPulse.amount, orderTotal);
    assert.ok(latestPulse.reason.includes('0x1B, 0x70, 0x00, 0x19, 0xFA'));
  });

  it('pure UPI and Card settlements DO NOT pulse drawer or alter expected till cash', () => {
    const snapBefore = getDashboardSnapshot();
    const initialExpectedCash = snapBefore.activeCashShift.expectedCashInDrawer;
    const initialPulseCount = snapBefore.drawerPulseHistory.length;

    // Settle #101 with pure UPI
    dashboardActions.settlePayment('ord-101', 'upi');
    const snapUpi = getDashboardSnapshot();
    assert.equal(
      snapUpi.activeCashShift.expectedCashInDrawer,
      initialExpectedCash,
      'UPI payment must not change cash till'
    );
    assert.equal(
      snapUpi.drawerPulseHistory.length,
      initialPulseCount,
      'UPI payment must not log drawer pulse'
    );
    assert.equal(snapUpi.orders.find((o) => o.id === 'ord-101').settlement.cashDrawerPulsed, false);

    // Settle #103 with pure Card
    dashboardActions.settlePayment('ord-103', 'card');
    const snapCard = getDashboardSnapshot();
    assert.equal(
      snapCard.activeCashShift.expectedCashInDrawer,
      initialExpectedCash,
      'Card payment must not change cash till'
    );
    assert.equal(
      snapCard.drawerPulseHistory.length,
      initialPulseCount,
      'Card payment must not log drawer pulse'
    );
    assert.equal(snapCard.orders.find((o) => o.id === 'ord-103').settlement.cashDrawerPulsed, false);
  });

  it('split payment with cash > 0 pulses drawer and increments till by cash portion ONLY', () => {
    const snapBefore = getDashboardSnapshot();
    const initialExpectedCash = snapBefore.activeCashShift.expectedCashInDrawer;
    const initialPulseCount = snapBefore.drawerPulseHistory.length;

    // Order 104 is 2027 total; split: 600 cash, 1427 upi
    dashboardActions.settlePayment('ord-104', 'split', {
      cash: 600,
      upi: 1427,
      card: 0,
      cashDrawerPulsed: true,
    });

    const snapAfter = getDashboardSnapshot();
    assert.equal(
      snapAfter.activeCashShift.expectedCashInDrawer,
      initialExpectedCash + 600,
      'Till must only increase by the ₹600 cash portion, not ₹2027'
    );
    assert.equal(snapAfter.drawerPulseHistory.length, initialPulseCount + 1);
    assert.equal(snapAfter.drawerPulseHistory[0].amount, 600);
  });

  it('split payment with cash == 0 (UPI + Card) DOES NOT pulse drawer or alter till', () => {
    const snapBefore = getDashboardSnapshot();
    const initialExpectedCash = snapBefore.activeCashShift.expectedCashInDrawer;
    const initialPulseCount = snapBefore.drawerPulseHistory.length;

    // Order 104 is 2027 total; split: 0 cash, 1027 upi, 1000 card
    dashboardActions.settlePayment('ord-104', 'split', {
      cash: 0,
      upi: 1027,
      card: 1000,
      cashDrawerPulsed: false,
    });

    const snapAfter = getDashboardSnapshot();
    assert.equal(snapAfter.activeCashShift.expectedCashInDrawer, initialExpectedCash);
    assert.equal(snapAfter.drawerPulseHistory.length, initialPulseCount);
    assert.equal(snapAfter.orders.find((o) => o.id === 'ord-104').settlement.cashDrawerPulsed, false);
  });
});

describe('Challenger M2: 3. Kitchen Chef KDS (:3002) Station Routing & Ticket Bumping', () => {
  beforeEach(() => {
    resetStore();
  });

  it('station routing filters cleanly isolate kitchen brigade queues without cross-station contamination', () => {
    const snap = getDashboardSnapshot();
    const refTime = 1730386800000;

    // Filter by 'oven'
    const ovenTickets = filterKdsTickets(snap.orders, 'oven', 'active', refTime);
    assert.ok(ovenTickets.length > 0, 'Must have orders containing oven items');
    for (const t of ovenTickets) {
      assert.ok(
        t.stationItems.every((item) => item.station === 'oven'),
        'All stationItems in oven view must belong strictly to oven station'
      );
    }

    // Filter by 'tandoor'
    const tandoorTickets = filterKdsTickets(snap.orders, 'tandoor', 'active', refTime);
    assert.ok(tandoorTickets.length > 0, 'Must have orders containing tandoor items');
    for (const t of tandoorTickets) {
      assert.ok(
        t.stationItems.every((item) => item.station === 'tandoor'),
        'All stationItems in tandoor view must belong strictly to tandoor station'
      );
    }

    // Filter by 'bar'
    const barTickets = filterKdsTickets(snap.orders, 'bar', 'active', refTime);
    assert.ok(barTickets.length > 0, 'Must have orders containing bar items');
    for (const t of barTickets) {
      assert.ok(
        t.stationItems.every((item) => item.station === 'bar'),
        'All stationItems in bar view must belong strictly to bar station'
      );
    }

    // Verify order without 'bar' items does not appear in bar tickets
    // ord-101 has items for oven (pizza, dal) and tandoor (naan) -> NO bar items
    const ord101InBar = barTickets.find((t) => t.order.id === 'ord-101');
    assert.equal(ord101InBar, undefined, 'ord-101 must not appear in bar station view');
  });

  it('cycles an item through all 4 stages: pending -> preparing -> ready -> served', () => {
    // Pick ord-104 item-104-4 which starts in 'pending' (Belgian Lava Cake)
    const snap0 = getDashboardSnapshot();
    const item0 = snap0.orders.find((o) => o.id === 'ord-104').items.find((i) => i.id === 'item-104-4');
    assert.equal(item0.status, 'pending');

    // Stage 1: Bump from pending -> preparing
    dashboardActions.bumpTicket('ord-104', 'item-104-4', 'preparing');
    const snap1 = getDashboardSnapshot();
    const item1 = snap1.orders.find((o) => o.id === 'ord-104').items.find((i) => i.id === 'item-104-4');
    assert.equal(item1.status, 'preparing');
    assert.ok(item1.prepStartedAt, 'prepStartedAt must be recorded');

    // Stage 2: Bump from preparing -> ready
    dashboardActions.bumpTicket('ord-104', 'item-104-4', 'ready');
    const snap2 = getDashboardSnapshot();
    const item2 = snap2.orders.find((o) => o.id === 'ord-104').items.find((i) => i.id === 'item-104-4');
    assert.equal(item2.status, 'ready');
    assert.ok(item2.readyAt, 'readyAt must be recorded');

    // Stage 3: Bump from ready -> served
    dashboardActions.bumpTicket('ord-104', 'item-104-4', 'served');
    const snap3 = getDashboardSnapshot();
    const item3 = snap3.orders.find((o) => o.id === 'ord-104').items.find((i) => i.id === 'item-104-4');
    assert.equal(item3.status, 'served');
    assert.ok(item3.servedAt, 'servedAt must be recorded');

    // Stage 4: Terminal state check - bumping an already served item remains served
    dashboardActions.bumpTicket('ord-104', 'item-104-4');
    const snap4 = getDashboardSnapshot();
    const item4 = snap4.orders.find((o) => o.id === 'ord-104').items.find((i) => i.id === 'item-104-4');
    assert.equal(item4.status, 'served', 'Item in served state must remain served');
  });

  it('bumps all items across entire ticket concurrently when itemId is "all"', () => {
    // In ord-101: items are preparing
    dashboardActions.bumpTicket('ord-101', 'all');

    const snap = getDashboardSnapshot();
    const ord101 = snap.orders.find((o) => o.id === 'ord-101');
    for (const item of ord101.items) {
      assert.equal(item.status, 'ready', 'All items in ord-101 should advance from preparing to ready');
      assert.ok(item.readyAt, 'readyAt must be set for each item');
    }
    assert.ok(ord101.readyAt, 'Entire order readyAt must be populated when all items are ready');
  });

  it('segregates active vs archived/served tickets once all items are served', () => {
    // ord-103 in seed data is already fully served; verify it starts in served archive
    const snap0 = getDashboardSnapshot();
    const servedBefore = filterKdsTickets(snap0.orders, 'all', 'served', 1730386800000);
    assert.ok(servedBefore.some((t) => t.order.id === 'ord-103'), 'ord-103 must initially be in served archive');

    // ord-102 has item-102-1 in 'ready'; verify it starts in active queue
    const activeBefore = filterKdsTickets(snap0.orders, 'all', 'active', 1730386800000);
    assert.ok(activeBefore.some((t) => t.order.id === 'ord-102'), 'ord-102 must initially be active');
    assert.ok(!servedBefore.some((t) => t.order.id === 'ord-102'), 'ord-102 must not be in served archive yet');

    // Bump both items in ord-102 to 'served'
    dashboardActions.bumpTicket('ord-102', 'item-102-1', 'served');
    dashboardActions.bumpTicket('ord-102', 'item-102-2', 'served');

    const snap1 = getDashboardSnapshot();
    const activeAfter = filterKdsTickets(snap1.orders, 'all', 'active', 1730386800000);
    const servedAfter = filterKdsTickets(snap1.orders, 'all', 'served', 1730386800000);

    assert.ok(
      !activeAfter.some((t) => t.order.id === 'ord-102'),
      'ord-102 must drop out of active queue once all items are served'
    );
    assert.ok(
      servedAfter.some((t) => t.order.id === 'ord-102'),
      'ord-102 must now appear in served archive'
    );
  });

  it('calculates dynamic SLA prep timer tiers (<10m green, 10-20m warning, >=20m breached)', () => {
    const orders = [
      { id: 'o-new', createdAt: new Date(Date.now() - 5 * 60000).toISOString(), items: [{ status: 'pending', station: 'oven' }] },
      { id: 'o-warn', createdAt: new Date(Date.now() - 14 * 60000).toISOString(), items: [{ status: 'pending', station: 'oven' }] },
      { id: 'o-breach', createdAt: new Date(Date.now() - 25 * 60000).toISOString(), items: [{ status: 'pending', station: 'oven' }] },
    ];

    const refTime = Date.now();
    const tickets = filterKdsTickets(orders, 'all', 'active', refTime);

    const newTicket = tickets.find((t) => t.order.id === 'o-new');
    const warnTicket = tickets.find((t) => t.order.id === 'o-warn');
    const breachTicket = tickets.find((t) => t.order.id === 'o-breach');

    assert.equal(newTicket.slaTier, 'normal', '5m must be normal SLA');
    assert.equal(warnTicket.slaTier, 'warning', '14m must be warning SLA');
    assert.equal(breachTicket.slaTier, 'breached', '25m must be breached SLA');
  });
});

describe('Challenger M2: 4. Server / Waiter Tableside Floor Map & Course Firing', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders visual floor map across all 4 dining zones with 100% table coverage', () => {
    const snap = getDashboardSnapshot();
    const requiredFloors = ['Indoor', 'Patio', 'Rooftop', 'Private Dining'];

    for (const flr of requiredFloors) {
      const floorTables = snap.tables.filter((t) => t.floor === flr);
      assert.ok(floorTables.length > 0, `Floor ${flr} must contain registered tables`);
    }

    // Verify all 15 tables belong strictly to one of the 4 valid floors
    for (const tbl of snap.tables) {
      assert.ok(
        requiredFloors.includes(tbl.floor),
        `Table ${tbl.id} has invalid floor: ${tbl.floor}`
      );
      assert.ok(tbl.capacity > 0, `Table ${tbl.id} must have capacity > 0`);
      assert.ok(tbl.number, `Table ${tbl.id} must have a table number`);
    }

    // Table counts check
    assert.equal(snap.tables.filter((t) => t.floor === 'Indoor').length, 6);
    assert.equal(snap.tables.filter((t) => t.floor === 'Patio').length, 4);
    assert.equal(snap.tables.filter((t) => t.floor === 'Rooftop').length, 4);
    assert.equal(snap.tables.filter((t) => t.floor === 'Private Dining').length, 1);
  });

  it('tracks all 4 table occupancy statuses: available, occupied, billed, reserved', () => {
    const snap = getDashboardSnapshot();
    const statuses = new Set(snap.tables.map((t) => t.status));

    assert.ok(statuses.has('available'), 'Must have available tables');
    assert.ok(statuses.has('occupied'), 'Must have occupied tables');
    assert.ok(statuses.has('billed'), 'Must have billed tables');
    assert.ok(statuses.has('reserved'), 'Must have reserved tables');
  });

  it('fires individual courses sequentially without contaminating other held courses', () => {
    const snap0 = getDashboardSnapshot();
    const table0 = snap0.tables.find((t) => t.id === 'tbl-indoor-04');
    assert.ok(table0, 'Table tbl-indoor-04 must exist');
    assert.equal(table0.currentOrderId, 'ord-104');

    const ord0 = snap0.orders.find((o) => o.id === 'ord-104');
    const dessertItem0 = ord0.items.find((i) => i.course === 'dessert');
    assert.equal(dessertItem0.status, 'pending', 'Dessert must initially be pending');
    assert.equal(table0.courseFiring?.dessert, false, 'Dessert firing must initially be false');

    // Waiter triggers Course Firing for "dessert"
    dashboardActions.fireCourse('tbl-indoor-04', 'dessert');

    const snap1 = getDashboardSnapshot();
    const table1 = snap1.tables.find((t) => t.id === 'tbl-indoor-04');
    const ord1 = snap1.orders.find((o) => o.id === 'ord-104');
    const dessertItem1 = ord1.items.find((i) => i.course === 'dessert');

    // Dessert is now preparing and flagged
    assert.equal(dessertItem1.status, 'preparing');
    assert.ok(dessertItem1.specialInstructions.includes('Course Fired'));
    assert.equal(table1.courseFiring.dessert, true, 'table.courseFiring.dessert must be true');

    // Existing starter item (item-104-1) was already 'served'; it must not be mutated
    const starterItem1 = ord1.items.find((i) => i.course === 'starter');
    assert.equal(starterItem1.status, 'served');
  });

  it('course firing is idempotent and safe against repeated clicks', () => {
    dashboardActions.fireCourse('tbl-indoor-04', 'dessert');
    const snap1 = getDashboardSnapshot();
    const dessert1 = snap1.orders.find((o) => o.id === 'ord-104').items.find((i) => i.course === 'dessert');

    // Fire again
    dashboardActions.fireCourse('tbl-indoor-04', 'dessert');
    const snap2 = getDashboardSnapshot();
    const dessert2 = snap2.orders.find((o) => o.id === 'ord-104').items.find((i) => i.course === 'dessert');

    // Status remains preparing; instructions should not stack duplicates infinitely
    assert.equal(dessert2.status, 'preparing');
    assert.equal(dessert1.specialInstructions, dessert2.specialInstructions);
  });

  it('settling payment frees linked table, clears currentOrderId, and resets courseFiring', () => {
    const snapBefore = getDashboardSnapshot();
    const tableBefore = snapBefore.tables.find((t) => t.id === 'tbl-indoor-04');
    assert.equal(tableBefore.status, 'occupied');
    assert.equal(tableBefore.currentOrderId, 'ord-104');

    // Cashier settles the bill
    dashboardActions.settlePayment('ord-104', 'cash');

    const snapAfter = getDashboardSnapshot();
    const tableAfter = snapAfter.tables.find((t) => t.id === 'tbl-indoor-04');
    assert.equal(tableAfter.status, 'available', 'Table must revert to available');
    assert.equal(tableAfter.currentOrderId, undefined, 'currentOrderId must be cleared');
    assert.equal(tableAfter.courseFiring, undefined, 'courseFiring state must be cleared');
    assert.equal(tableAfter.guestCount, undefined, 'guestCount must be reset');
  });
});

describe('Challenger M2: 5. Adversarial Concurrency & Edge Case Stress Testing', () => {
  beforeEach(() => {
    resetStore();
  });

  it('survives rapid consecutive bumps without race conditions or order data loss', () => {
    // Perform 20 rapid mutations
    for (let i = 0; i < 20; i++) {
      dashboardActions.bumpTicket('ord-101', 'item-101-1');
    }

    const snap = getDashboardSnapshot();
    const item = snap.orders.find((o) => o.id === 'ord-101').items.find((i) => i.id === 'item-101-1');
    assert.equal(item.status, 'served', 'Item must gracefully cap at terminal state served');
  });

  it('course firing on Table A never affects items or orders on Table B', () => {
    // ord-101 is on tbl-indoor-02 (main course items in preparing)
    // ord-102 is on tbl-patio-02 (beverage items in ready)
    const snapBefore = getDashboardSnapshot();
    const ord102Before = snapBefore.orders.find((o) => o.id === 'ord-102');

    // Fire main on tbl-indoor-02
    dashboardActions.fireCourse('tbl-indoor-02', 'main');

    const snapAfter = getDashboardSnapshot();
    const ord102After = snapAfter.orders.find((o) => o.id === 'ord-102');

    assert.deepEqual(ord102Before.items, ord102After.items, 'ord-102 items must not be affected');
  });

  it('retains till reconciliation integrity after interleaved settlements of different payment methods', () => {
    const snap0 = getDashboardSnapshot();
    const initialExpected = snap0.activeCashShift.expectedCashInDrawer;

    // Settle ord-101 (1371) in pure Cash (+1371 to till)
    dashboardActions.settlePayment('ord-101', 'cash');

    // Settle ord-102 (546) in pure UPI (+0 to till)
    dashboardActions.settlePayment('ord-102', 'upi');

    // Settle ord-103 (2678) in pure Card (+0 to till)
    dashboardActions.settlePayment('ord-103', 'card');

    // Settle ord-104 (2027) with split: 1000 cash, 1027 upi (+1000 to till)
    dashboardActions.settlePayment('ord-104', 'split', {
      cash: 1000,
      upi: 1027,
      card: 0,
      cashDrawerPulsed: true,
    });

    const snapFinal = getDashboardSnapshot();
    const expectedFinal = initialExpected + 1371 + 1000; // 2371 added to cash till
    assert.equal(
      snapFinal.activeCashShift.expectedCashInDrawer,
      expectedFinal,
      'Till balance must reflect exact cash inflows without contamination from UPI/Card'
    );
  });
});
