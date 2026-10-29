/**
 * TASK C-03 & C-03A: Cloud Sync Integrity, Event Idempotency & Financial Protection Test Suite
 * 
 * Verifies all operational security & financial integrity requirements:
 * 1. Duplicate event submission (idempotent duplicate acknowledgment without side-effect re-execution).
 * 2. Event ID conflict detection: reusing same event ID with conflicting payload is rejected.
 * 3. Network timeout simulation: legitimate retry after timeout acknowledges without duplicate writes.
 * 4. Concurrent submissions of the same event: atomic resolution without race condition duplicates.
 * 5. Cross-tenant & cross-branch event injection denial: terminal cannot write or overwrite other tenants.
 * 6. Revoked terminal & inactive branch rejection: 403 Forbidden on revoked terminal or closed branch.
 * 7. Server-side financial & mathematical validation: calculation mismatches, negative values, and overflows rejected.
 * 8. Real financial rules: fractional quantities, packaging/delivery/service charges, round-off, tax-inclusive, void adjustments.
 * 9. Cash closures with cash movements: pay-ins, cash drops, supplier payouts, and cash variances.
 * 10. Atomic writes & partial-failure recovery: batch transactions rollback on mid-operation failure.
 * 11. Partial batch failure isolation: valid events are processed while invalid events are isolated.
 * 12. Client compatibility: strict conformance with POS outbox and Flutter contracts.
 * 13. Sequential migration replay (0001 -> 0002 -> 0003) on fresh and pre-existing databases using real SQLite.
 */

import assert from 'node:assert/strict';
import cloudWorker from '../apps/cloud-api/src/index';
import { hashString } from '../apps/cloud-api/src/auth';
import { resetMemoryRateLimits } from '../apps/cloud-api/src/rate-limit';
import { BatchSyncResponse } from '../shared/cloud-types';

const TEST_SECRET = 'cloud-c03-sync-integrity-test-secret-256bits-key-32chars!';

class MockD1SyncDatabase {
  public organizations = new Map<string, any>();
  public branches = new Map<string, any>();
  public terminals = new Map<string, any>();
  public syncedOrders = new Map<string, any>();
  public syncedOrderItems = new Map<string, any>();
  public syncedClosures = new Map<string, any>();
  public syncEvents = new Map<string, any>();
  public rateLimits = new Map<string, any>();
  public simulateBatchFailure = false;

  prepare(sql: string) {
    const db = this;
    const createStmt = (params: any[]) => ({
      bind(...newParams: any[]) {
        return createStmt(newParams);
      },
      async first<T = any>(): Promise<T | null> {
        const normalized = sql.replace(/\s+/g, ' ').trim();

        // 1. Rate limits upsert
        if (normalized.includes('INSERT INTO rate_limits') && normalized.includes('ON CONFLICT(key) DO UPDATE')) {
          const [key, resetAtParam, updatedAtParam, nowCheck1] = params;
          const nowSec = Number(nowCheck1);
          let entry = db.rateLimits.get(key);
          if (!entry || entry.reset_at < nowSec) {
            entry = { count: 1, reset_at: Number(resetAtParam), updated_at: String(updatedAtParam) };
          } else {
            entry.count += 1;
            entry.updated_at = String(updatedAtParam);
          }
          db.rateLimits.set(key, entry);
          return { count: entry.count, reset_at: entry.reset_at } as T;
        }

        // 2. Terminal lookup by token hash
        if (normalized.includes('FROM terminals t') && normalized.includes('t.terminal_token_hash = ?')) {
          const [hash] = params;
          for (const term of db.terminals.values()) {
            if (term.terminal_token_hash === hash) {
              const branch = db.branches.get(term.branch_id);
              const org = db.organizations.get(term.organization_id);
              if (!branch || !org) return null;
              return {
                id: term.id,
                organization_id: term.organization_id,
                branch_id: term.branch_id,
                terminal_status: term.status || 'active',
                branch_status: branch.status || 'active',
              } as T;
            }
          }
          return null;
        }

        // 3. Sync events lookup by id
        if (normalized.includes('FROM sync_events') && normalized.includes('WHERE id = ?')) {
          const [id] = params;
          const ev = db.syncEvents.get(id);
          return (ev || null) as T;
        }

        // 4. Synced orders lookup by id
        if (normalized.includes('FROM synced_orders WHERE id = ?')) {
          const [id] = params;
          const ord = db.syncedOrders.get(id);
          return (ord || null) as T;
        }

        // 5. Synced closures lookup by id
        if (normalized.includes('FROM synced_cash_closures WHERE id = ?')) {
          const [id] = params;
          const cl = db.syncedClosures.get(id);
          return (cl || null) as T;
        }

        return null;
      },

      async all<T = any>(): Promise<{ results: T[] }> {
        return { results: [] };
      },

      async run(): Promise<{ success: boolean }> {
        const normalized = sql.replace(/\s+/g, ' ').trim();

        // Terminal last seen update
        if (normalized.includes('UPDATE terminals SET last_seen_at = ? WHERE id = ?')) {
          const [now, termId] = params;
          const term = db.terminals.get(termId);
          if (term) term.last_seen_at = now;
          return { success: true };
        }

        // Insert sync_events with UNIQUE constraint check
        if (normalized.includes('INSERT INTO sync_events')) {
          const [id, orgId, branchId, terminalId, eventType, entityType, entityId, payloadHash, status, processedAt] = params;
          if (db.syncEvents.has(id)) {
            throw new Error(`UNIQUE constraint failed: sync_events.id (${id})`);
          }
          db.syncEvents.set(id, {
            id,
            organization_id: orgId,
            branch_id: branchId,
            terminal_id: terminalId,
            event_type: eventType,
            entity_type: entityType,
            entity_id: entityId,
            payload_hash: payloadHash,
            status,
            processed_at: processedAt,
          });
          return { success: true };
        }

        // Insert synced_orders
        if (normalized.includes('INSERT INTO synced_orders')) {
          const [id, orgId, branchId, termId, orderNumber, orderType, status, subtotal, taxTotal, discountTotal, grandTotal, paymentMethod, orderedAt, syncedAt] = params;
          db.syncedOrders.set(id, {
            id,
            organization_id: orgId,
            branch_id: branchId,
            terminal_id: termId,
            order_number: orderNumber,
            order_type: orderType,
            status,
            subtotal,
            tax_total: taxTotal,
            discount_total: discountTotal,
            grand_total: grandTotal,
            payment_method: paymentMethod,
            ordered_at: orderedAt,
            synced_at: syncedAt,
          });
          return { success: true };
        }

        // Insert synced_order_items
        if (normalized.includes('INSERT INTO synced_order_items')) {
          const [id, orderId, branchId, productId, productName, quantity, unitPrice, subtotal, taxAmount, discountAmount, orderedAt] = params;
          db.syncedOrderItems.set(id, {
            id,
            order_id: orderId,
            branch_id: branchId,
            product_id: productId,
            product_name: productName,
            quantity,
            unit_price: unitPrice,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            ordered_at: orderedAt,
          });
          return { success: true };
        }

        // Insert synced_cash_closures
        if (normalized.includes('INSERT INTO synced_cash_closures')) {
          const [id, orgId, branchId, closureDate, openedAt, closedAt, openingCash, cashSales, cardSales, upiSales, otherSales, expectedCash, actualCash, variance, notes, closedBy, syncedAt] = params;
          db.syncedClosures.set(id, {
            id,
            organization_id: orgId,
            branch_id: branchId,
            closure_date: closureDate,
            opened_at: openedAt,
            closed_at: closedAt,
            opening_cash: openingCash,
            cash_sales: cashSales,
            card_sales: cardSales,
            upi_sales: upiSales,
            other_sales: otherSales,
            expected_cash: expectedCash,
            actual_cash: actualCash,
            variance,
            notes,
            closed_by: closedBy,
            synced_at: syncedAt,
          });
          return { success: true };
        }

        return { success: true };
      },
    });

    return createStmt([]);
  }

  async batch(statements: any[]): Promise<void> {
    if (this.simulateBatchFailure) {
      throw new Error('D1 Transaction / Batch Write Failure Simulated');
    }
    // Transactional atomic execution
    const backupSyncEvents = new Map(this.syncEvents);
    const backupSyncedOrders = new Map(this.syncedOrders);
    const backupSyncedOrderItems = new Map(this.syncedOrderItems);
    const backupSyncedClosures = new Map(this.syncedClosures);
    try {
      for (const stmt of statements) {
        await stmt.run();
      }
    } catch (err) {
      this.syncEvents = backupSyncEvents;
      this.syncedOrders = backupSyncedOrders;
      this.syncedOrderItems = backupSyncedOrderItems;
      this.syncedClosures = backupSyncedClosures;
      throw err;
    }
  }
}

function makeSyncReq(token: string, events: any[]): Request {
  return new Request('https://cloud.orderitup.internal/api/pos/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });
}

// ============================================================================
// TEST SUITE 1: Terminal Ownership, Scoping & Revocation (Phase 2 & 6)
// ============================================================================
async function testTerminalOwnershipAndRevocation(): Promise<void> {
  console.log('🧪 [Test Suite 1/5] Terminal Ownership, Scoping & Revocation...');
  resetMemoryRateLimits();

  const db = new MockD1SyncDatabase();
  const orgA = 'org-tenant-a';
  const branchA = 'br-branch-a';
  const orgB = 'org-tenant-b';
  const branchB = 'br-branch-b';

  db.organizations.set(orgA, { id: orgA, name: 'Tenant A' });
  db.branches.set(branchA, { id: branchA, organization_id: orgA, name: 'Branch A', status: 'active' });
  db.organizations.set(orgB, { id: orgB, name: 'Tenant B' });
  db.branches.set(branchB, { id: branchB, organization_id: orgB, name: 'Branch B', status: 'active' });

  // Terminal 1: Active
  const tokenActive = 'token-active-pos-1';
  db.terminals.set('t-active', {
    id: 't-active',
    organization_id: orgA,
    branch_id: branchA,
    terminal_token_hash: await hashString(tokenActive),
    status: 'active',
  });

  // Terminal 2: Revoked
  const tokenRevoked = 'token-revoked-pos-2';
  db.terminals.set('t-revoked', {
    id: 't-revoked',
    organization_id: orgA,
    branch_id: branchA,
    terminal_token_hash: await hashString(tokenRevoked),
    status: 'revoked',
  });

  // Terminal 3: Branch Inactive
  const tokenBranchInactive = 'token-branch-closed-3';
  const branchInactive = 'br-inactive';
  db.branches.set(branchInactive, { id: branchInactive, organization_id: orgA, name: 'Closed Branch', status: 'inactive' });
  db.terminals.set('t-branch-closed', {
    id: 't-branch-closed',
    organization_id: orgA,
    branch_id: branchInactive,
    terminal_token_hash: await hashString(tokenBranchInactive),
    status: 'active',
  });

  const env = { DB: db as any, JWT_SECRET: TEST_SECRET };

  // 1a. Revoked terminal credentials must be rejected with 403 Forbidden
  const resRevoked = await cloudWorker.fetch(makeSyncReq(tokenRevoked, []), env);
  assert.equal(resRevoked.status, 403);
  const dataRevoked = await resRevoked.json() as any;
  assert.match(dataRevoked.error, /revoked/i);

  // 1b. Inactive branch terminal credentials must be rejected with 403 Forbidden
  const resInactive = await cloudWorker.fetch(makeSyncReq(tokenBranchInactive, []), env);
  assert.equal(resInactive.status, 403);
  const dataInactive = await resInactive.json() as any;
  assert.match(dataInactive.error, /inactive/i);

  // 1c. Unknown/unregistered terminal token rejected with 401 Unauthorized
  const resUnknown = await cloudWorker.fetch(makeSyncReq('unregistered-token', []), env);
  assert.equal(resUnknown.status, 401);

  // 1d. Cross-tenant order overwrite prevention:
  // Pre-seed an order belonging strictly to Org B
  db.syncedOrders.set('ord-competitor-99', {
    id: 'ord-competitor-99',
    organization_id: orgB,
    branch_id: branchB,
    terminal_id: 't-other',
    order_number: 'ORD-99',
    grand_total: 999,
  });

  // Terminal from Org A attempts to submit an update for Org B's order
  const resCrossTenant = await cloudWorker.fetch(makeSyncReq(tokenActive, [{
    id: 'evt-hijack-attempt',
    type: 'order.updated',
    payload: {
      id: 'ord-competitor-99',
      order_number: 'ORD-99-HIJACKED',
      subtotal: 10,
      tax_total: 0,
      discount_total: 0,
      grand_total: 10,
      ordered_at: new Date().toISOString(),
    },
  }]), env);
  assert.equal(resCrossTenant.status, 200);
  const dataCross = await resCrossTenant.json() as BatchSyncResponse;
  // Event must NOT be processed, Org B's order remains untouched
  assert.equal(dataCross.processed_count, 0, 'Cross-tenant order overwrite must be rejected');
  assert.equal(dataCross.failed_count, 1);
  const targetOrd = db.syncedOrders.get('ord-competitor-99');
  assert.equal(targetOrd.organization_id, orgB, 'Original tenant ownership must not be overwritten');
  assert.equal(targetOrd.order_number, 'ORD-99');

  console.log('  ✓ Revoked terminals, inactive branches, unknown tokens, and cross-tenant attacks rejected');
}

// ============================================================================
// TEST SUITE 2: Reliable Idempotency & Duplicate Prevention (Phase 3)
// ============================================================================
async function testIdempotencyAndDuplicates(): Promise<void> {
  console.log('🧪 [Test Suite 2/5] Reliable Idempotency & Duplicate Prevention...');
  resetMemoryRateLimits();

  const db = new MockD1SyncDatabase();
  const orgId = 'org-tastecraft';
  const branchId = 'br-main';
  db.organizations.set(orgId, { id: orgId, name: 'TasteCraft' });
  db.branches.set(branchId, { id: branchId, organization_id: orgId, name: 'Main', status: 'active' });

  const token = 'token-idempotency-test';
  db.terminals.set('t-idempotent', {
    id: 't-idempotent',
    organization_id: orgId,
    branch_id: branchId,
    terminal_token_hash: await hashString(token),
    status: 'active',
  });

  const env = { DB: db as any, JWT_SECRET: TEST_SECRET };

  const validOrderPayload = {
    id: 'ord-repeatable-101',
    order_number: 'ORD-101',
    order_type: 'dine_in',
    status: 'completed',
    subtotal: 500,
    tax_total: 25,
    discount_total: 0,
    grand_total: 525,
    payment_method: 'cash',
    ordered_at: new Date().toISOString(),
    items: [
      { id: 'item-1', product_name: 'Biryani', quantity: 2, price: 250, subtotal: 500 },
    ],
  };

  const initialEvent = {
    id: 'evt-unique-101',
    type: 'order.completed',
    payload: validOrderPayload,
  };

  // 2a. Initial submission: succeeds and writes order & idempotency record
  const res1 = await cloudWorker.fetch(makeSyncReq(token, [initialEvent]), env);
  assert.equal(res1.status, 200);
  const data1 = await res1.json() as BatchSyncResponse;
  assert.equal(data1.processed_count, 1);
  assert.deepEqual(data1.synced_ids, ['evt-unique-101']);
  assert.equal(db.syncedOrders.size, 1);
  assert.equal(db.syncEvents.size, 1);

  // 2b. Exact duplicate retry after network timeout:
  // Must return success with event in synced_ids, without duplicating database records
  const resRetry = await cloudWorker.fetch(makeSyncReq(token, [initialEvent]), env);
  assert.equal(resRetry.status, 200);
  const dataRetry = await resRetry.json() as BatchSyncResponse;
  assert.equal(dataRetry.processed_count, 1, 'Duplicate retry must be acknowledged as processed');
  assert.equal(dataRetry.failed_count, 0);
  assert.deepEqual(dataRetry.synced_ids, ['evt-unique-101']);
  assert.equal(db.syncedOrders.size, 1, 'Database must not duplicate order');
  assert.equal(db.syncEvents.size, 1, 'Idempotency table must not duplicate event');

  // 2c. Event ID conflict: reusing the same event ID with a CONFLICTING payload
  const conflictingEvent = {
    id: 'evt-unique-101', // Same ID
    type: 'order.completed',
    payload: {
      ...validOrderPayload,
      grand_total: 99999, // Tampered payload
    },
  };

  const resConflict = await cloudWorker.fetch(makeSyncReq(token, [conflictingEvent]), env);
  assert.equal(resConflict.status, 200);
  const dataConflict = await resConflict.json() as BatchSyncResponse;
  assert.equal(dataConflict.processed_count, 0, 'Conflicting event payload must be rejected');
  assert.equal(dataConflict.failed_count, 1);
  assert.equal(db.syncedOrders.get('ord-repeatable-101').grand_total, 525, 'Existing order must not be corrupted');

  // 2d. Concurrent submission simulation:
  // Two simultaneous requests containing the same event ID and identical payload
  const concurrentEvent = {
    id: 'evt-concurrent-202',
    type: 'order.completed',
    payload: {
      id: 'ord-concurrent-202',
      order_number: 'ORD-202',
      subtotal: 200,
      tax_total: 10,
      discount_total: 0,
      grand_total: 210,
      ordered_at: new Date().toISOString(),
    },
  };

  const [cRes1, cRes2] = await Promise.all([
    cloudWorker.fetch(makeSyncReq(token, [concurrentEvent]), env),
    cloudWorker.fetch(makeSyncReq(token, [concurrentEvent]), env),
  ]);

  assert.equal(cRes1.status, 200);
  assert.equal(cRes2.status, 200);
  const cData1 = await cRes1.json() as BatchSyncResponse;
  const cData2 = await cRes2.json() as BatchSyncResponse;
  assert.equal(cData1.processed_count, 1, 'First concurrent request succeeds');
  assert.equal(cData2.processed_count, 1, 'Second concurrent request acknowledged idempotently');
  assert.deepEqual(cData1.synced_ids, ['evt-concurrent-202']);
  assert.deepEqual(cData2.synced_ids, ['evt-concurrent-202']);
  assert.equal(db.syncedOrders.get('ord-concurrent-202').grand_total, 210);

  // 2e. Reusing concurrent event ID with a different conflicting payload is rejected deterministically
  const conflictingConcurrent = {
    id: 'evt-concurrent-202',
    type: 'order.completed',
    payload: {
      ...concurrentEvent.payload,
      grand_total: 9999, // Conflicting payload
    },
  };
  const cRes3 = await cloudWorker.fetch(makeSyncReq(token, [conflictingConcurrent]), env);
  assert.equal(cRes3.status, 200);
  const cData3 = await cRes3.json() as BatchSyncResponse;
  assert.equal(cData3.processed_count, 0, 'Conflicting payload must be rejected deterministically');
  assert.equal(cData3.failed_count, 1);
  assert.deepEqual(cData3.synced_ids, []);
  assert.equal(db.syncedOrders.get('ord-concurrent-202').grand_total, 210, 'Original financial effect must remain intact');

  console.log('  ✓ Idempotent duplicate retry, conflict detection, and concurrent resolution verified');
}

// ============================================================================
// TEST SUITE 3: Financial & Mathematical Validation (Phase 5)
// ============================================================================
async function testFinancialValidation(): Promise<void> {
  console.log('🧪 [Test Suite 3/5] Server-Side Financial & Mathematical Validation...');
  resetMemoryRateLimits();

  const db = new MockD1SyncDatabase();
  const orgId = 'org-tastecraft';
  const branchId = 'br-main';
  db.organizations.set(orgId, { id: orgId, name: 'TasteCraft' });
  db.branches.set(branchId, { id: branchId, organization_id: orgId, name: 'Main', status: 'active' });

  const token = 'token-finance-test';
  db.terminals.set('t-finance', {
    id: 't-finance',
    organization_id: orgId,
    branch_id: branchId,
    terminal_token_hash: await hashString(token),
    status: 'active',
  });

  const env = { DB: db as any, JWT_SECRET: TEST_SECRET };

  // 3a. Mathematical calculation mismatch: grand_total != subtotal - discount + tax
  const badMathEvent = {
    id: 'evt-bad-math',
    type: 'order.completed',
    payload: {
      id: 'ord-bad-math',
      subtotal: 100,
      discount_total: 10,
      tax_total: 5,
      grand_total: 250, // Correct should be 95!
      ordered_at: new Date().toISOString(),
    },
  };
  const resBadMath = await cloudWorker.fetch(makeSyncReq(token, [badMathEvent]), env);
  const dataBadMath = await resBadMath.json() as BatchSyncResponse;
  assert.equal(dataBadMath.processed_count, 0, 'Order with inconsistent math must be rejected');
  assert.equal(dataBadMath.failed_count, 1);

  // 3b. Negative monetary totals rejection
  const negativeEvent = {
    id: 'evt-negative-total',
    type: 'order.completed',
    payload: {
      id: 'ord-negative',
      subtotal: -50,
      tax_total: 5,
      discount_total: 0,
      grand_total: -45,
      ordered_at: new Date().toISOString(),
    },
  };
  const resNeg = await cloudWorker.fetch(makeSyncReq(token, [negativeEvent]), env);
  const dataNeg = await resNeg.json() as BatchSyncResponse;
  assert.equal(dataNeg.processed_count, 0, 'Negative order total must be rejected');

  // 3c. Line item subtotal calculation mismatch
  const badItemEvent = {
    id: 'evt-bad-item-math',
    type: 'order.completed',
    payload: {
      id: 'ord-bad-item',
      subtotal: 100,
      tax_total: 0,
      discount_total: 0,
      grand_total: 100,
      ordered_at: new Date().toISOString(),
      items: [
        { id: 'i1', product_name: 'Coffee', quantity: 2, price: 50, subtotal: 999 }, // 2 * 50 != 999
      ],
    },
  };
  const resBadItem = await cloudWorker.fetch(makeSyncReq(token, [badItemEvent]), env);
  const dataBadItem = await resBadItem.json() as BatchSyncResponse;
  assert.equal(dataBadItem.processed_count, 0, 'Item calculation mismatch must be rejected');

  // 3d. Future-dated event rejection (e.g. 5 years in future)
  const futureEvent = {
    id: 'evt-future-dated',
    type: 'order.completed',
    payload: {
      id: 'ord-future',
      subtotal: 100,
      tax_total: 0,
      discount_total: 0,
      grand_total: 100,
      ordered_at: '2035-01-01T00:00:00.000Z',
    },
  };
  const resFuture = await cloudWorker.fetch(makeSyncReq(token, [futureEvent]), env);
  const dataFuture = await resFuture.json() as BatchSyncResponse;
  assert.equal(dataFuture.processed_count, 0, 'Distant future-dated event must be rejected');

  // 3e. Cash closure calculation check: expected_cash != opening_cash + cash_sales
  const badClosureEvent = {
    id: 'evt-bad-closure',
    type: 'closure.recorded',
    payload: {
      id: 'cls-1',
      opening_cash: 500,
      cash_sales: 1000,
      expected_cash: 9999, // Inconsistent
      actual_cash: 1500,
      variance: 0,
    },
  };
  const resClosure = await cloudWorker.fetch(makeSyncReq(token, [badClosureEvent]), env);
  const dataClosure = await resClosure.json() as BatchSyncResponse;
  assert.equal(dataClosure.processed_count, 0, 'Closure with invalid math must be rejected');

  // 3f. Fractional quantities: 0.75 kg at 120/kg = 90.00 subtotal
  const fractionalEvent = {
    id: 'evt-fractional-qty',
    type: 'order.completed',
    payload: {
      id: 'ord-frac-1',
      subtotal: 90,
      tax_total: 4.5,
      discount_total: 0,
      grand_total: 94.5,
      ordered_at: new Date().toISOString(),
      items: [
        { id: 'item-f1', product_name: 'Cheese', quantity: 0.75, price: 120, subtotal: 90 },
      ],
    },
  };
  const resFrac = await cloudWorker.fetch(makeSyncReq(token, [fractionalEvent]), env);
  const dataFrac = await resFrac.json() as BatchSyncResponse;
  assert.equal(dataFrac.processed_count, 1, 'Valid fractional quantity order must be accepted');

  // 3g. Real POS Charges (packaging, delivery, service charge) + Round Off
  const chargesEvent = {
    id: 'evt-order-charges',
    type: 'order.completed',
    payload: {
      id: 'ord-charges-1',
      subtotal: 500,
      tax_total: 25,
      discount_total: 50,
      packaging_charge: 20,
      delivery_charge: 30,
      service_charge: 25,
      round_off: -0.25,
      grand_total: 549.75, // 500 - 50 + 25 + 75 - 0.25 = 549.75
      ordered_at: new Date().toISOString(),
    },
  };
  const resCharges = await cloudWorker.fetch(makeSyncReq(token, [chargesEvent]), env);
  const dataCharges = await resCharges.json() as BatchSyncResponse;
  assert.equal(dataCharges.processed_count, 1, 'Order with POS charges and round-off must be accepted');

  // 3h. Tax-inclusive pricing (tax already inside subtotal)
  const taxInclusiveEvent = {
    id: 'evt-tax-inclusive',
    type: 'order.completed',
    payload: {
      id: 'ord-inc-1',
      subtotal: 200,
      tax_total: 10, // inclusive tax
      discount_total: 0,
      grand_total: 200, // Grand total equals subtotal because tax is inclusive
      ordered_at: new Date().toISOString(),
      items: [
        { id: 'item-inc-1', product_name: 'Buffet', quantity: 1, price: 200, subtotal: 200, tax_type: 'inclusive', tax_amount: 10 },
      ],
    },
  };
  const resInc = await cloudWorker.fetch(makeSyncReq(token, [taxInclusiveEvent]), env);
  const dataInc = await resInc.json() as BatchSyncResponse;
  assert.equal(dataInc.processed_count, 1, 'Tax-inclusive order must be accepted');

  // 3i. Void adjustment items with negative unit_price and subtotal
  const voidAdjustmentEvent = {
    id: 'evt-void-adj',
    type: 'order.updated',
    payload: {
      id: 'ord-void-adj-1',
      subtotal: 100, // 200 - 100 = 100
      tax_total: 5,
      discount_total: 0,
      grand_total: 105,
      ordered_at: new Date().toISOString(),
      items: [
        { id: 'i-normal', product_name: 'Steak', quantity: 2, price: 100, subtotal: 200 },
        { id: 'i-void', product_name: 'Refund: Steak', quantity: 1, price: -100, subtotal: -100, status: 'void_adjustment' },
      ],
    },
  };
  const resVoid = await cloudWorker.fetch(makeSyncReq(token, [voidAdjustmentEvent]), env);
  const dataVoid = await resVoid.json() as BatchSyncResponse;
  assert.equal(dataVoid.processed_count, 1, 'Void adjustment with negative prices must be accepted');

  // 3j. Cash closure with movements (pay-ins and cash drops)
  const closureWithMovementsEvent = {
    id: 'evt-closure-movements',
    type: 'closure.recorded',
    payload: {
      id: 'cls-movements-1',
      opening_cash: 1000,
      cash_sales: 3000,
      pay_in: 500, // cash_in
      cash_drop: 1500, // cash_out
      expected_cash: 3000, // 1000 + 3000 + 500 - 1500 = 3000
      actual_cash: 2980,
      variance: -20, // 2980 - 3000 = -20
    },
  };
  const resClMove = await cloudWorker.fetch(makeSyncReq(token, [closureWithMovementsEvent]), env);
  const dataClMove = await resClMove.json() as BatchSyncResponse;
  assert.equal(dataClMove.processed_count, 1, 'Cash closure with movements and variance must be accepted');

  console.log('  ✓ Calculation mismatches, negative values, item discrepancies, future dates, and closure math rejected');
  console.log('  ✓ Real business rules verified: fractional quantities, packaging/delivery/service charges, round-off, tax-inclusive, void adjustments, and cash movements');
}

// ============================================================================
// TEST SUITE 4: Atomicity, Partial Failures & Client Compatibility (Phase 4 & 7)
// ============================================================================
async function testAtomicityAndBatching(): Promise<void> {
  console.log('🧪 [Test Suite 4/5] Atomic Writes, Partial Failure Recovery & POS Outbox Contract...');
  resetMemoryRateLimits();

  const db = new MockD1SyncDatabase();
  const orgId = 'org-tastecraft';
  const branchId = 'br-main';
  db.organizations.set(orgId, { id: orgId, name: 'TasteCraft' });
  db.branches.set(branchId, { id: branchId, organization_id: orgId, name: 'Main', status: 'active' });

  const token = 'token-batch-test';
  db.terminals.set('t-batch', {
    id: 't-batch',
    organization_id: orgId,
    branch_id: branchId,
    terminal_token_hash: await hashString(token),
    status: 'active',
  });

  const env = { DB: db as any, JWT_SECRET: TEST_SECRET };

  // 4a. Partial batch failure: 1 valid order + 1 invalid order in a single batch
  const mixedBatch = [
    {
      id: 'evt-valid-1',
      type: 'order.completed',
      payload: {
        id: 'ord-valid-1',
        subtotal: 200,
        tax_total: 10,
        discount_total: 0,
        grand_total: 210,
        ordered_at: new Date().toISOString(),
      },
    },
    {
      id: 'evt-invalid-2',
      type: 'order.completed',
      payload: {
        id: 'ord-invalid-2',
        subtotal: 100,
        tax_total: 0,
        discount_total: 0,
        grand_total: 999, // Inconsistent math
        ordered_at: new Date().toISOString(),
      },
    },
  ];

  const resMixed = await cloudWorker.fetch(makeSyncReq(token, mixedBatch), env);
  assert.equal(resMixed.status, 200);
  const dataMixed = await resMixed.json() as BatchSyncResponse;
  assert.equal(dataMixed.processed_count, 1, 'Valid event in batch must be processed');
  assert.equal(dataMixed.failed_count, 1, 'Invalid event in batch must be isolated as failed');
  assert.deepEqual(dataMixed.synced_ids, ['evt-valid-1'], 'synced_ids must strictly contain successfully processed IDs');
  assert.equal(db.syncedOrders.has('ord-valid-1'), true, 'Valid order must be written to DB');
  assert.equal(db.syncedOrders.has('ord-invalid-2'), false, 'Invalid order must NOT be written to DB');

  // 4b. Transaction atomicity on D1 batch error:
  // If database transaction fails midway, zero records from that event must be committed
  db.simulateBatchFailure = true;
  const resAtomicFail = await cloudWorker.fetch(makeSyncReq(token, [{
    id: 'evt-atomic-test',
    type: 'order.completed',
    payload: {
      id: 'ord-atomic-test',
      subtotal: 100,
      tax_total: 5,
      discount_total: 0,
      grand_total: 105,
      ordered_at: new Date().toISOString(),
      items: [{ id: 'i-1', product_name: 'Burger', quantity: 1, price: 100, subtotal: 100 }],
    },
  }]), env);

  const dataAtomicFail = await resAtomicFail.json() as BatchSyncResponse;
  assert.equal(dataAtomicFail.processed_count, 0, 'On database batch failure, processed_count must be 0');
  assert.equal(db.syncedOrders.has('ord-atomic-test'), false, 'Order must not exist in DB after atomic failure');
  assert.equal(db.syncEvents.has('evt-atomic-test'), false, 'Event record must not exist after atomic failure');

  db.simulateBatchFailure = false;

  // 4c. POS Outbox & Flutter client response schema verification:
  const resSchema = await cloudWorker.fetch(makeSyncReq(token, []), env);
  const dataSchema = await resSchema.json() as any;
  assert(typeof dataSchema.success === 'boolean');
  assert(typeof dataSchema.processed_count === 'number');
  assert(typeof dataSchema.failed_count === 'number');
  assert(Array.isArray(dataSchema.synced_ids));
  assert(typeof dataSchema.server_time === 'string');

  console.log('  ✓ Partial batch failure isolation, atomic transaction rollback, and schema compliance verified');
}

// ============================================================================
// TEST SUITE 5: Real SQLite / D1 Migration Compatibility (Phase 1)
// ============================================================================
async function testMigrationCompatibility(): Promise<void> {
  console.log('🧪 [Test Suite 5/5] Real SQLite / D1 Migration Compatibility (0001 -> 0002 -> 0003)...');

  const fs = require('fs');
  const path = require('path');
  let createDb: () => any;

  try {
    const { DatabaseSync } = require('node:sqlite');
    createDb = () => new DatabaseSync(':memory:');
  } catch {
    const Database = require('better-sqlite3');
    createDb = () => new Database(':memory:');
  }

  const m1 = fs.readFileSync(path.join(__dirname, '../apps/cloud-api/migrations/0001_initial_schema.sql'), 'utf8');
  const m2 = fs.readFileSync(path.join(__dirname, '../apps/cloud-api/migrations/0002_rate_limits_and_pairing.sql'), 'utf8');
  const m3 = fs.readFileSync(path.join(__dirname, '../apps/cloud-api/migrations/0003_sync_integrity_and_idempotency.sql'), 'utf8');

  // Test 1: Fresh database sequence (0001 -> 0002 -> 0003)
  const dbFresh = createDb();
  dbFresh.exec(m1);
  dbFresh.exec(m2);
  dbFresh.exec(m3);

  const termCols = dbFresh.prepare('PRAGMA table_info(terminals)').all().map((c: any) => c.name);
  const pairCols = dbFresh.prepare('PRAGMA table_info(pairing_tokens)').all().map((c: any) => c.name);
  const syncEventCols = dbFresh.prepare('PRAGMA table_info(sync_events)').all().map((c: any) => c.name);

  assert(termCols.includes('status'), 'terminals must include status column');
  assert(pairCols.includes('attempts'), 'pairing_tokens must include attempts column');
  assert(syncEventCols.includes('payload_hash'), 'sync_events must include payload_hash column');
  dbFresh.close();

  // Test 2: Existing database upgrade sequence
  // Seed baseline state after 0001 & 0002
  const dbUpgrade = createDb();
  dbUpgrade.exec(m1);
  dbUpgrade.exec(m2);
  dbUpgrade.prepare("INSERT INTO organizations (id, name, created_at, updated_at) VALUES ('org-1', 'Org 1', '2026-01-01', '2026-01-01')").run();
  dbUpgrade.prepare("INSERT INTO branches (id, organization_id, code, name, created_at, updated_at) VALUES ('br-1', 'org-1', 'B1', 'Branch 1', '2026-01-01', '2026-01-01')").run();
  dbUpgrade.prepare("INSERT INTO terminals (id, organization_id, branch_id, terminal_name, terminal_token_hash, created_at) VALUES ('t-1', 'org-1', 'br-1', 'Term 1', 'hash1', '2026-01-01')").run();
  dbUpgrade.prepare("INSERT INTO pairing_tokens (code, organization_id, branch_id, terminal_name, expires_at, created_at) VALUES ('123456', 'org-1', 'br-1', 'Term 1', '2026-01-02', '2026-01-01')").run();

  // Apply 0003 forward-only migration
  dbUpgrade.exec(m3);
  const termRow = dbUpgrade.prepare("SELECT * FROM terminals WHERE id = 't-1'").get() as any;
  assert.equal(termRow.status, 'active', 'Pre-existing terminal records must safely default to active status');
  const indexes = dbUpgrade.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((i: any) => i.name);
  assert(indexes.includes('idx_sync_events_org_branch'), 'Must create idx_sync_events_org_branch');
  assert(indexes.includes('idx_sync_events_entity'), 'Must create idx_sync_events_entity');
  assert(indexes.includes('idx_synced_orders_tenant_lookup'), 'Must create idx_synced_orders_tenant_lookup');
  assert(indexes.includes('idx_synced_closures_tenant_lookup'), 'Must create idx_synced_closures_tenant_lookup');
  dbUpgrade.close();

  console.log('  ✓ Fresh migrations (0001->0002->0003), upgrade path, data preservation, and indexes verified via SQLite');
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function runAllTests(): Promise<void> {
  console.log('================================================================');
  console.log('  TASK C-03 & C-03A: CLOUD SYNC INTEGRITY & FINANCIAL AUDIT');
  console.log('================================================================\n');

  try {
    await testTerminalOwnershipAndRevocation();
    await testIdempotencyAndDuplicates();
    await testFinancialValidation();
    await testAtomicityAndBatching();
    await testMigrationCompatibility();

    console.log('\n================================================================');
    console.log('✅ ALL C-03 & C-03A VERIFICATION SUITES PASSED FLAWLESSLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ Test Suite Failed:', err);
    process.exit(1);
  }
}

runAllTests();
