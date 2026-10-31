/**
 * Order It Up - Milestone M1 Empirical Adversarial Stress Test Suite
 * File: tests/landing-dashboard-m1-stress.test.mjs
 *
 * Direct runtime execution & stress-testing of:
 * - landing/src/lib/dashboard-store.ts
 * - landing/src/lib/dashboard-models.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Dynamically import the store
const storeModule = await import('../landing/src/lib/dashboard-store.ts');
const {
  dashboardActions,
  getDashboardSnapshot,
  subscribeDashboard,
  INITIAL_DASHBOARD_STATE,
} = storeModule;

describe('M1 Empirical Challenge: Store Lifecycle & Reactivity', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('resetToSeedData correctly resets store to initial seed state', () => {
    const snap = getDashboardSnapshot();
    assert.equal(snap.outlets.length, 3);
    assert.equal(snap.orders.length, 7);
    assert.equal(snap.tables.length, 15);
    assert.equal(snap.staff.length, 7);
  });

  it('subscribeDashboard triggers listener synchronously on mutation', () => {
    let callCount = 0;
    const unsubscribe = subscribeDashboard(() => {
      callCount++;
    });

    dashboardActions.setActiveRole('cashier');
    assert.equal(callCount, 1);
    assert.equal(getDashboardSnapshot().activeRole, 'cashier');

    dashboardActions.setSelectedOutletId('outlet-2');
    assert.equal(callCount, 2);
    assert.equal(getDashboardSnapshot().selectedOutletId, 'outlet-2');

    unsubscribe();
    dashboardActions.setActiveRole('chef');
    assert.equal(callCount, 2, 'Unsubscribed listener should not fire');
  });
});

describe('M1 Empirical Challenge: bumpTicket 4-Stage Lifecycle', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('progresses pending -> preparing -> ready -> served for a single item', () => {
    // ord-104 item-104-4 is in pending state ("Hold for dessert call")
    const order104 = getDashboardSnapshot().orders.find((o) => o.id === 'ord-104');
    assert.ok(order104, 'ord-104 must exist');
    const pendingItem = order104.items.find((i) => i.id === 'item-104-4');
    assert.equal(pendingItem.status, 'pending', 'item-104-4 should start as pending');

    // Stage 1: pending -> preparing
    dashboardActions.bumpTicket('ord-104', pendingItem.id);
    let currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-104');
    let item = currentOrder.items.find((i) => i.id === pendingItem.id);
    assert.equal(item.status, 'preparing');
    assert.ok(item.prepStartedAt, 'prepStartedAt must be set');
    assert.ok(currentOrder.prepStartedAt, 'order prepStartedAt must be set');

    // Stage 2: preparing -> ready
    dashboardActions.bumpTicket('ord-104', pendingItem.id);
    currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-104');
    item = currentOrder.items.find((i) => i.id === pendingItem.id);
    assert.equal(item.status, 'ready');
    assert.ok(item.readyAt, 'readyAt must be set');

    // Stage 3: ready -> served
    dashboardActions.bumpTicket('ord-104', pendingItem.id);
    currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-104');
    item = currentOrder.items.find((i) => i.id === pendingItem.id);
    assert.equal(item.status, 'served');
    assert.ok(item.servedAt, 'servedAt must be set');

    // Stage 4: served -> served (terminal state, should not crash or regress)
    dashboardActions.bumpTicket('ord-104', pendingItem.id);
    currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-104');
    item = currentOrder.items.find((i) => i.id === pendingItem.id);
    assert.equal(item.status, 'served');
  });

  it('bumps all items simultaneously through full lifecycle when itemId is omitted or "all"', () => {
    // Set all items in ord-101 to pending
    dashboardActions.bumpTicket('ord-101', 'all', 'pending');
    let currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-101');
    assert.ok(currentOrder.items.every((i) => i.status === 'pending'));

    // Stage 1: all pending -> preparing
    dashboardActions.bumpTicket('ord-101', 'all');
    currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-101');
    assert.ok(currentOrder.items.every((i) => i.status === 'preparing'));
    assert.ok(currentOrder.prepStartedAt);

    // Stage 2: all preparing -> ready
    dashboardActions.bumpTicket('ord-101'); // omitted itemId
    currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-101');
    assert.ok(currentOrder.items.every((i) => i.status === 'ready'));
    assert.ok(currentOrder.readyAt, 'order readyAt must be stamped when all items ready');

    // Stage 3: all ready -> served
    dashboardActions.bumpTicket('ord-101', 'all');
    currentOrder = getDashboardSnapshot().orders.find((o) => o.id === 'ord-101');
    assert.ok(currentOrder.items.every((i) => i.status === 'served'));
  });

  it('safely handles non-existent orderId without error', () => {
    assert.doesNotThrow(() => {
      dashboardActions.bumpTicket('non-existent-order-id', 'all');
    });
  });
});

describe('M1 Empirical Challenge: settlePayment & 24V Solenoid Pulse Oracle', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('cash settlement logs 24V drawer pulse, updates shift till, and frees table', () => {
    const snapBefore = getDashboardSnapshot();
    const order101 = snapBefore.orders.find((o) => o.id === 'ord-101');
    const tableId = order101.tableId;
    const orderTotal = order101.total; // 1371
    const pulsesBefore = snapBefore.drawerPulseHistory.length;
    const tillCashBefore = snapBefore.activeCashShift.grossCashSales;

    // Settle with Cash
    dashboardActions.settlePayment('ord-101', 'cash');

    const snapAfter = getDashboardSnapshot();
    const settledOrder = snapAfter.orders.find((o) => o.id === 'ord-101');
    assert.equal(settledOrder.paymentStatus, 'paid');
    assert.equal(settledOrder.settlement.method, 'cash');
    assert.equal(settledOrder.settlement.cashDrawerPulsed, true);

    // Verify 24V Drawer Pulse Kick was logged
    assert.equal(snapAfter.drawerPulseHistory.length, pulsesBefore + 1);
    const latestPulse = snapAfter.drawerPulseHistory[0];
    assert.equal(latestPulse.orderId, '#101');
    assert.equal(latestPulse.amount, orderTotal);
    assert.match(latestPulse.reason, /0x1B,\s*0x70,\s*0x00,\s*0x19,\s*0xFA/);

    // Verify Shift Till Incremented
    assert.equal(snapAfter.activeCashShift.grossCashSales, tillCashBefore + orderTotal);
    assert.equal(
      snapAfter.activeCashShift.expectedCashInDrawer,
      snapBefore.activeCashShift.expectedCashInDrawer + orderTotal
    );

    // Verify Linked Dining Table is freed to 'available'
    const table = snapAfter.tables.find((t) => t.id === tableId);
    assert.equal(table.status, 'available');
    assert.equal(table.currentOrderId, undefined);
  });

  it('UPI settlement does NOT log drawer pulse and does NOT increment cash till', () => {
    const snapBefore = getDashboardSnapshot();
    const order102 = snapBefore.orders.find((o) => o.id === 'ord-102');
    const pulsesBefore = snapBefore.drawerPulseHistory.length;
    const tillCashBefore = snapBefore.activeCashShift.grossCashSales;
    const outletUpiBefore = snapBefore.outlets.find((o) => o.id === order102.outletId).tenders.upi;

    dashboardActions.settlePayment('ord-102', 'upi');

    const snapAfter = getDashboardSnapshot();
    const settledOrder = snapAfter.orders.find((o) => o.id === 'ord-102');
    assert.equal(settledOrder.paymentStatus, 'paid');
    assert.equal(settledOrder.settlement.cashDrawerPulsed, false);

    // Zero drawer pulses for digital UPI
    assert.equal(snapAfter.drawerPulseHistory.length, pulsesBefore);
    assert.equal(snapAfter.activeCashShift.grossCashSales, tillCashBefore);

    // Outlet UPI tender increased
    const outlet = snapAfter.outlets.find((o) => o.id === order102.outletId);
    assert.equal(outlet.tenders.upi, outletUpiBefore + order102.total);
  });

  it('Split settlement reconciles partial cash, card, and UPI accurately', () => {
    const snapBefore = getDashboardSnapshot();
    const order103 = snapBefore.orders.find((o) => o.id === 'ord-103');
    const total = order103.total; // e.g. 2583
    const splitDetails = {
      cash: 1000,
      upi: 1000,
      card: total - 2000,
      changeGiven: 0,
    };

    const pulsesBefore = snapBefore.drawerPulseHistory.length;
    const tillCashBefore = snapBefore.activeCashShift.grossCashSales;

    dashboardActions.settlePayment('ord-103', 'split', splitDetails);

    const snapAfter = getDashboardSnapshot();
    const settledOrder = snapAfter.orders.find((o) => o.id === 'ord-103');
    assert.equal(settledOrder.paymentStatus, 'paid');
    assert.equal(settledOrder.settlement.cashDrawerPulsed, true);

    // Drawer pulse kicked with cash amount exactly
    assert.equal(snapAfter.drawerPulseHistory.length, pulsesBefore + 1);
    assert.equal(snapAfter.drawerPulseHistory[0].amount, 1000);

    // Cash till increased only by cash portion
    assert.equal(snapAfter.activeCashShift.grossCashSales, tillCashBefore + 1000);

    // Table freed
    const table = snapAfter.tables.find((t) => t.id === order103.tableId);
    assert.equal(table.status, 'available');
  });

  it('Payment settlement is idempotent (cannot double-settle paid order)', () => {
    dashboardActions.settlePayment('ord-101', 'cash');
    const snap1 = getDashboardSnapshot();
    const pulsesAfterFirst = snap1.drawerPulseHistory.length;
    const cashAfterFirst = snap1.activeCashShift.grossCashSales;

    // Attempt second settlement
    dashboardActions.settlePayment('ord-101', 'cash');
    const snap2 = getDashboardSnapshot();

    assert.equal(snap2.drawerPulseHistory.length, pulsesAfterFirst, 'No additional pulse');
    assert.equal(snap2.activeCashShift.grossCashSales, cashAfterFirst, 'No double count');
  });
});

describe('M1 Empirical Challenge: Shift Closure & Z-Report Variances', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('generates balanced Z-report when actual cash equals expected cash', () => {
    const snap = getDashboardSnapshot();
    const expected = snap.activeCashShift.expectedCashInDrawer;

    const report = dashboardActions.recordShiftClosure({
      outletId: 'outlet-1',
      cashierName: 'Rohit Singh',
      supervisorName: 'Priya Sharma',
      actualCountedCash: expected,
    });

    assert.equal(report.status, 'balanced');
    assert.equal(report.cashVariance, 0);
    assert.match(report.notes, /zero cash variance/);

    const afterSnap = getDashboardSnapshot();
    assert.equal(afterSnap.zReports[0].id, report.id);
    assert.equal(afterSnap.activeCashShift.openingFloat, 5000, 'Resets till with 5000 default float');
    assert.equal(afterSnap.activeCashShift.grossCashSales, 0, 'Resets gross cash sales to 0');
  });

  it('flags variance on cash shortage (negative variance)', () => {
    const snap = getDashboardSnapshot();
    const expected = snap.activeCashShift.expectedCashInDrawer;
    const shortageAmount = 150;

    const report = dashboardActions.recordShiftClosure({
      outletId: 'outlet-1',
      cashierName: 'Rohit Singh',
      supervisorName: 'Priya Sharma',
      actualCountedCash: expected - shortageAmount,
    });

    assert.equal(report.status, 'variance_flagged');
    assert.equal(report.cashVariance, -shortageAmount);
    assert.match(report.notes, /shortage of ₹150\.00/);
  });

  it('flags variance on cash overage (positive variance)', () => {
    const snap = getDashboardSnapshot();
    const expected = snap.activeCashShift.expectedCashInDrawer;
    const overageAmount = 75.5;

    const report = dashboardActions.recordShiftClosure({
      outletId: 'outlet-1',
      cashierName: 'Rohit Singh',
      supervisorName: 'Priya Sharma',
      actualCountedCash: expected + overageAmount,
    });

    assert.equal(report.status, 'variance_flagged');
    assert.equal(report.cashVariance, overageAmount);
    assert.match(report.notes, /overage of ₹75\.50/);
  });

  it('increments Z-report number monotonically', () => {
    const snap = getDashboardSnapshot();
    const initialMaxZ = Math.max(...snap.zReports.map((z) => z.zNumber));

    const rep1 = dashboardActions.recordShiftClosure({
      outletId: 'outlet-1',
      cashierName: 'Rohit Singh',
      supervisorName: 'Priya Sharma',
      actualCountedCash: 5000,
    });
    assert.equal(rep1.zNumber, initialMaxZ + 1);

    const rep2 = dashboardActions.recordShiftClosure({
      outletId: 'outlet-1',
      cashierName: 'Rohit Singh',
      supervisorName: 'Priya Sharma',
      actualCountedCash: 5000,
    });
    assert.equal(rep2.zNumber, initialMaxZ + 2);
  });
});

describe('M1 Empirical Challenge: fireCourse Tableside Waiter Mutations', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('fires courses for tables and transitions pending course items to preparing', () => {
    // ord-104 is at tbl-indoor-04 with course items
    const tableId = 'tbl-indoor-04';
    const snap = getDashboardSnapshot();
    const orderBefore = snap.orders.find((o) => o.id === 'ord-104');
    const dessertsBefore = orderBefore.items.filter((i) => i.course === 'dessert');
    assert.ok(dessertsBefore.length > 0, 'ord-104 has dessert course items');
    assert.ok(dessertsBefore.every((i) => i.status === 'pending'));

    dashboardActions.fireCourse(tableId, 'dessert');

    const snapAfter = getDashboardSnapshot();
    const orderAfter = snapAfter.orders.find((o) => o.id === 'ord-104');
    const dessertsAfter = orderAfter.items.filter((i) => i.course === 'dessert');
    assert.ok(dessertsAfter.every((i) => i.status === 'preparing'));
    assert.ok(dessertsAfter.every((i) => i.specialInstructions.includes('Course Fired')));

    const tableAfter = snapAfter.tables.find((t) => t.id === tableId);
    assert.equal(tableAfter.courseFiring.dessert, true);
  });

  it('safely ignores fireCourse calls on unoccupied or invalid tables', () => {
    assert.doesNotThrow(() => {
      dashboardActions.fireCourse('tbl-indoor-01', 'starter'); // available table, no currentOrderId
      dashboardActions.fireCourse('non-existent-table', 'main');
    });
  });
});

describe('M1 Empirical Challenge: assignStaffRole Security PIN Oracle', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('accepts valid 4-digit numeric PINs and updates staff', () => {
    dashboardActions.assignStaffRole('usr_cashier_01', 'manager', '4821');
    const staff = getDashboardSnapshot().staff.find((s) => s.id === 'usr_cashier_01');
    assert.equal(staff.role, 'manager');
    assert.equal(staff.pin, '4821');
  });

  it('strictly rejects non-4-digit PINs with descriptive errors', () => {
    const invalidPins = [
      '123',        // 3 digits
      '12345',      // 5 digits
      'abcd',       // alphabetic
      '12a4',       // alphanumeric
      '12 4',       // spaces
      '',           // empty
      '9021\n',     // newline injection
      ' 9021',      // leading space
      '9021 ',      // trailing space
      '-123',       // negative
      '3.14',       // decimal
    ];

    for (const badPin of invalidPins) {
      assert.throws(
        () => {
          dashboardActions.assignStaffRole('usr_cashier_01', 'cashier', badPin);
        },
        /Staff PIN must be exactly 4 numeric digits/,
        `Should have rejected bad PIN "${badPin}"`
      );
    }
  });
});

describe('M1 Empirical Challenge: License Key Generator Oracle', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  const LICENSE_REGEX = /^OIUP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  it('strictly matches regex /^OIUP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/ across tiers', () => {
    const tiers = ['enterprise', 'pro', 'starter'];
    const hashes = ['8F42', 'A1B2', 'ZZ99', '1234', '', 'short', 'very-long-machine-hash-1234!@#'];

    for (const plan of tiers) {
      for (const machineHash of hashes) {
        const key = dashboardActions.generateLicenseKey('tenant-0892', plan, machineHash);
        assert.match(
          key,
          LICENSE_REGEX,
          `Key "${key}" for plan "${plan}" and hash "${machineHash}" must match regex`
        );
        assert.equal(key.length, 19, `Key "${key}" must be exactly 19 chars`);
      }
    }
  });

  it('generates correct plan prefix: ENT1, PRO1, STR1', () => {
    const entKey = dashboardActions.generateLicenseKey('tenant-0892', 'enterprise', '8F42');
    const proKey = dashboardActions.generateLicenseKey('tenant-0892', 'pro', '8F42');
    const strKey = dashboardActions.generateLicenseKey('tenant-0892', 'starter', '8F42');

    assert.ok(entKey.startsWith('OIUP-ENT1-'));
    assert.ok(proKey.startsWith('OIUP-PRO1-'));
    assert.ok(strKey.startsWith('OIUP-STR1-'));
  });

  it('records generated license under tenant entity', () => {
    const initialLicenses = getDashboardSnapshot().tenants.find((t) => t.id === 'tenant-0892').licenseKeys.length;
    const key = dashboardActions.generateLicenseKey('tenant-0892', 'pro', '8F42');

    const updatedTenant = getDashboardSnapshot().tenants.find((t) => t.id === 'tenant-0892');
    assert.equal(updatedTenant.licenseKeys.length, initialLicenses + 1);
    assert.equal(updatedTenant.licenseKeys[0].key, key);
    assert.equal(updatedTenant.licenseKeys[0].isValid, true);
  });
});

describe('M1 Empirical Challenge: High-Volume Sequential Mutation Stress Harness', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('survives 100 rapid sequential mixed mutations maintaining integrity and zero NaN', () => {
    for (let i = 0; i < 25; i++) {
      dashboardActions.bumpTicket('ord-104', 'item-104-1');
      dashboardActions.updateBranchPriceOverride('outlet-1', 'prod-001', 500 + i);
      dashboardActions.assignStaffRole('usr_server_01', 'server', `${1000 + i}`);
      dashboardActions.generateLicenseKey('tenant-0892', 'starter', `M${i}`);
    }

    const state = getDashboardSnapshot();
    assert.equal(typeof state.activeCashShift.grossCashSales, 'number');
    assert.ok(!isNaN(state.activeCashShift.grossCashSales));
    assert.ok(!isNaN(state.activeCashShift.expectedCashInDrawer));
    assert.equal(state.staff.find((s) => s.id === 'usr_server_01').pin, '1024');
    assert.equal(
      state.catalog.find((c) => c.id === 'prod-001').branchOverrides['outlet-1'].priceOverride,
      524
    );
  });

  it('strictly rejects negative price overrides', () => {
    assert.throws(() => {
      dashboardActions.updateBranchPriceOverride('outlet-1', 'prod-001', -50);
    }, /Price override cannot be negative/);
  });
});

describe('M1 Empirical Challenge: Multi-Table Course Firing & Concurrency', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('fires courses across multiple tables independently without cross-talk', () => {
    // Fire course on Table T-04 (ord-104)
    dashboardActions.fireCourse('tbl-indoor-04', 'dessert');

    // Attach an order to Table T-02 (ord-101) and set an item as starter pending
    dashboardActions.bumpTicket('ord-101', 'item-101-1', 'pending');
    dashboardActions.fireCourse('tbl-indoor-02', 'main');

    const snap = getDashboardSnapshot();
    const t04 = snap.tables.find((t) => t.id === 'tbl-indoor-04');
    const t02 = snap.tables.find((t) => t.id === 'tbl-indoor-02');

    assert.equal(t04.courseFiring.dessert, true);
    assert.equal(t04.courseFiring.starter, true); // initial seed was true
    assert.equal(t02.courseFiring.main, true);
  });
});

describe('M1 Empirical Challenge: Delivery Status & COD Collection Reconciliation', () => {
  beforeEach(() => {
    dashboardActions.resetToSeedData();
  });

  it('reconciles COD cash into drawer till and settles order upon delivery', () => {
    const snapBefore = getDashboardSnapshot();
    const tillBefore = snapBefore.activeCashShift.grossCashSales;
    const expectedBefore = snapBefore.activeCashShift.expectedCashInDrawer;
    const orderBefore = snapBefore.orders.find((o) => o.id === 'ord-105');
    assert.equal(orderBefore.paymentStatus, 'unpaid');

    // Sumit delivers Swiggy COD order D-801
    dashboardActions.updateDeliveryStatus('disp-001', 'delivered', true);

    const snapAfter = getDashboardSnapshot();
    const dispAfter = snapAfter.dispatches.find((d) => d.id === 'disp-001');
    assert.equal(dispAfter.riderStatus, 'delivered');
    assert.equal(dispAfter.codCollected, true);
    assert.ok(dispAfter.deliveredAt);

    // Cash till increased by COD amount (₹840)
    assert.equal(snapAfter.activeCashShift.grossCashSales, tillBefore + 840);
    assert.equal(snapAfter.activeCashShift.expectedCashInDrawer, expectedBefore + 840);

    // Order marked paid via cash without drawer kick (collected outside by rider)
    const orderAfter = snapAfter.orders.find((o) => o.id === 'ord-105');
    assert.equal(orderAfter.paymentStatus, 'paid');
    assert.equal(orderAfter.settlement.cashDrawerPulsed, false);
    assert.equal(orderAfter.settlement.tenderedAmount, 840);
  });
});

describe('M1 Empirical Challenge: Indian GST & S3 Architecture Invariants', () => {
  it('all central menu items enforce SAC 996331 and 5% GST', () => {
    const snap = getDashboardSnapshot();
    for (const item of snap.catalog) {
      assert.equal(item.sacCode, '996331', `Item ${item.name} must have SAC 996331`);
      assert.equal(item.taxRatePercent, 5, `Item ${item.name} must have 5% GST`);
    }
  });

  it('all tenants enforce isolated S3 prefix with zeroComminglingVerified', () => {
    const snap = getDashboardSnapshot();
    for (const tenant of snap.tenants) {
      assert.match(
        tenant.s3Metrics.prefix,
        new RegExp(`^tenants/${tenant.id}/`),
        `Tenant ${tenant.id} must have isolated storagePrefix in s3Metrics`
      );
      assert.equal(
        tenant.s3Metrics.zeroComminglingVerified,
        true,
        `Tenant ${tenant.id} must have zeroComminglingVerified=true`
      );
    }
  });

  it('all order taxes strictly balance CGST (2.5%) + SGST (2.5%) === taxTotal', () => {
    const snap = getDashboardSnapshot();
    for (const order of snap.orders) {
      assert.equal(
        Math.round((order.cgst + order.sgst) * 100) / 100,
        Math.round(order.taxTotal * 100) / 100,
        `Order ${order.orderNumber} CGST + SGST must equal taxTotal`
      );
      assert.equal(
        order.cgst,
        order.sgst,
        `Order ${order.orderNumber} CGST must equal SGST`
      );
    }
  });
});

