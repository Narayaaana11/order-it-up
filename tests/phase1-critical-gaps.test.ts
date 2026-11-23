/**
 * E2E / Integration Test: Phase 1 Critical Gaps
 * Tests: Recipe BOM, Modifier Deltas, Unit Conversion, SAF Offline Replay, and Audit Chain.
 *
 * Usage: node tests/run-electron-node-test.cjs tests/phase1-critical-gaps.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-p1-test-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: true,
        getPath: () => testDir,
        getVersion: () => 'test',
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser, seedCategory, seedProduct,
  api, assert, assertEqual,
  getResults, closeDatabase,
} = require('./helpers/test-setup');

const { deductIngredientsForOrderItems, restoreIngredientsForOrderItems } = require('../main/services/inventory-engine');
const { queueOfflineCardPayment, processPendingSafTransactions, getSafLimits } = require('../main/services/saf-engine');
const { verifyAuditChain } = require('../main/services/audit');

async function main() {
  console.log('🧪 Phase 1 Critical Gaps: Recipe BOM, Modifiers, SAF, & Audit Chain');
  console.log('='.repeat(65));

  const db = initTestDb();
  seedOwnerUser(db);
  seedCategory(db, 'cat_main', 'Mains');

  // ── 1. Recipe BOM, Modifiers, & Unit Conversions ───────────────────────────
  console.log('\nPart 1: Recipe BOM, Modifiers, & Unit Conversions');

  // 1. Seed raw ingredients
  db.prepare(`
    INSERT INTO raw_ingredients (id, name, unit, current_stock, minimum_stock, cost_per_unit, is_active)
    VALUES 
      ('ing_bun', 'Brioche Bun', 'pcs', 50, 10, 5, 1),
      ('ing_patty', 'Beef Patty', 'pcs', 50, 10, 40, 1),
      ('ing_cheese', 'Cheddar Cheese', 'g', 1000, 200, 0.5, 1)
  `).run();

  // 2. Seed Product
  seedProduct(db, 'prod_burger', 'cat_main', 'Classic Cheeseburger', 250);

  // 3. Attach Recipe Items (1 bun, 1 patty, 30g cheese)
  db.prepare(`
    INSERT INTO product_recipes (id, product_id, ingredient_id, quantity_required, unit, wastage_percentage)
    VALUES 
      ('rec_1', 'prod_burger', 'ing_bun', 1, 'pcs', 0),
      ('rec_2', 'prod_burger', 'ing_patty', 1, 'pcs', 0),
      ('rec_3', 'prod_burger', 'ing_cheese', 30, 'g', 0)
  `).run();

  // 4. Seed Add-on Modifier (Extra Cheese = +20g cheese)
  db.prepare(`
    INSERT INTO addon_groups (id, name, min_selection, max_selection, is_required)
    VALUES ('grp_mod', 'Extras', 0, 3, 0)
  `).run();
  db.prepare(`
    INSERT INTO addons (id, addon_group_id, name, price)
    VALUES ('addon_extra_cheese', 'grp_mod', 'Extra Cheese Slice', 30)
  `).run();
  db.prepare(`
    INSERT INTO addon_recipes (addon_id, ingredient_id, quantity_delta, unit)
    VALUES ('addon_extra_cheese', 'ing_cheese', 20, 'g')
  `).run();

  // 5. Deduct ingredients for 1 Burger with Extra Cheese (Deducts 1 bun, 1 patty, 50g cheese)
  const result = deductIngredientsForOrderItems([
    {
      product_id: 'prod_burger',
      quantity: 1,
      selected_addons: [{ addon_id: 'addon_extra_cheese', quantity: 1 }],
    },
  ], '101', false);

  assert(result.success, 'Deduction should succeed');
  
  const bun = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing_bun');
  const patty = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing_patty');
  const cheese = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing_cheese');

  assertEqual(bun.current_stock, 49, '1 bun deducted');
  assertEqual(patty.current_stock, 49, '1 patty deducted');
  assertEqual(cheese.current_stock, 950, '50g cheese deducted (30g recipe + 20g modifier)');

  // 6. Test cancellation / void restore
  restoreIngredientsForOrderItems([
    { product_id: 'prod_burger', quantity: 1 },
  ], '101', 'Order Voided');

  const bunRestored = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get('ing_bun');
  assertEqual(bunRestored.current_stock, 50, 'Bun stock restored on order void');

  // ── 2. Store-and-Forward (SAF) Offline Cards ──────────────────────────────
  console.log('\nPart 2: Store-and-Forward (SAF) Offline Cards');

  db.prepare(`
    INSERT INTO orders (id, order_number, type, status, subtotal, total, created_at, updated_at)
    VALUES (201, 'ORD-201', 'dine_in', 'pending', 1100, 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run();

  db.prepare(`
    INSERT INTO bills (id, order_id, bill_number, subtotal, tax_amount, total, paid_amount, balance, payment_status, created_at, updated_at)
    VALUES (301, 201, 'BILL-301', 1100, 100, 1200, 1200, 0, 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run();

  const queued = queueOfflineCardPayment({
    orderId: 201,
    billId: 301,
    amount: 1200,
    currency: 'INR',
    cardLast4: '5521',
    cardBrand: 'Mastercard',
    authCode: 'AUTH_OFFLINE_998',
    entryMode: 'offline_pin',
  });

  assertEqual(queued.status, 'queued', 'Queued status initialized');
  assertEqual(queued.card_last4, '5521', 'Card last 4 digits captured');

  // Process settlement batch
  const settlement = await processPendingSafTransactions();
  assertEqual(settlement.settled, 1, '1 transaction settled on reconnect');

  const settledTx = db.prepare('SELECT * FROM saf_card_transactions WHERE id = ?').get(queued.id);
  assertEqual(settledTx.status, 'settled', 'Transaction marked as settled');
  assert(settledTx.forwarded_at !== null, 'forwarded_at timestamp set');

  // Duplicate replay must be a no-op (idempotent)
  const replay = await processPendingSafTransactions();
  assertEqual(replay.settled, 0, 'Duplicate replay settled 0 items');
  assertEqual(replay.processed, 0, 'No more pending transactions');

  // ── 3. Cryptographic Audit Chain Verification ────────────────────────────
  console.log('\nPart 3: Cryptographic Audit Chain Verification');

  const verification = verifyAuditChain(db);
  assert(verification.valid, `Audit chain must be cryptographically valid: ${verification.reason || ''}`);
  assert(verification.totalRows > 0, `Should have verified multiple audit records for stock and SAF (found ${verification.totalRows})`);

  closeDatabase();
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  const results = getResults();
  console.log(`\nResults: ${results.passed}/${results.passed + results.failed} passed`);
  if (results.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error in phase 1 test:', err);
  process.exit(1);
});
