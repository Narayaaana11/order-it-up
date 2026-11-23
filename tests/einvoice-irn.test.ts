/**
 * Integration Test: Indian GST E-Invoicing (IRN) & Signed QR Generation
 *
 * Usage: node tests/run-electron-node-test.cjs tests/einvoice-irn.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-irn-test-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  return originalLoad.apply(this, arguments as any);
};

const {
  initTestDb, createApp, startServer,
  seedOwnerUser, seedCategory, seedProduct,
  api, assert, assertEqual,
  getResults, closeDatabase,
} = require('./helpers/test-setup');

const { registerRoutes } = require('../main/routes/index');

async function main() {
  console.log('Integration Test: Indian GST E-Invoicing (IRN) & Signed QR Generation');
  console.log('='.repeat(65));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  // Configure Store GSTIN and Business details
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES ('tax_registration_number', '29AABCC1332M1ZQ', datetime('now')),
           ('business_name', 'Grand Hyderabadi Spice Bistro', datetime('now')),
           ('business_address', '100 Road, Indiranagar, Bengaluru', datetime('now')),
           ('postal_code', '560038', datetime('now')),
           ('state_code', '29', datetime('now'))
  `).run();

  seedCategory(db, 'cat-food', 'Food');
  seedProduct(db, 'prod-biryani-b2b', 'cat-food', 'Royal Mutton Biryani', 400);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    console.log('\nStep 1: Place Order and Generate Bill for B2B Corporate Client');
    const orderRes = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: {
        type: 'takeaway',
        customer_gstin: '29AAACH7409R1ZZ',
        items: [{ product_id: 'prod-biryani-b2b', quantity: 5 }],
      },
      headers: authHeader,
    });
    assertEqual(orderRes.status, 201, 'B2B order created (201)');
    const orderId = orderRes.data.order.id;

    const billRes = await api(baseUrl, '/api/bills/generate', {
      method: 'POST',
      body: {
        order_id: orderId,
        customer_gstin: '29AAACH7409R1ZZ',
        customer_legal_name: 'Infosys Limited',
      },
      headers: authHeader,
    });
    assertEqual(billRes.status, 201, 'B2B Bill generated (201)');
    const billId = billRes.data.bill.id;

    console.log('\nStep 2: Export IRP Standard E-Invoice JSON Schema');
    const exportRes = await api(baseUrl, `/api/bills/${billId}/einvoice`, {
      headers: authHeader,
    });
    assertEqual(exportRes.status, 200, 'IRP schema exported (200)');
    assertEqual(exportRes.data.Version, '1.1', 'IRP Schema version is 1.1');
    assertEqual(exportRes.data.TranDtls.SupTyp, 'B2B', 'Supply type is B2B');
    assertEqual(exportRes.data.SellerDtls.Gstin, '29AABCC1332M1ZQ', 'Seller GSTIN matches store settings');
    assertEqual(exportRes.data.BuyerDtls.Gstin, '29AAACH7409R1ZZ', 'Buyer GSTIN matches customer');
    assertEqual(exportRes.data.BuyerDtls.LglNm, 'Infosys Limited', 'Buyer legal name matches customer');
    assert(exportRes.data.ItemList.length > 0, 'Item list contains bill line items');
    assert(exportRes.data.ValDtls.TotInvVal >= 2000, 'Total invoice value is computed');

    console.log('\nStep 3: Register E-Invoice & Generate 64-char IRN Hash and Signed QR');
    const registerRes = await api(baseUrl, `/api/bills/${billId}/einvoice/register`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(registerRes.status, 200, 'IRN registered (200)');
    const { irn, ackNo, ackDate, signedQr, einvoiceStatus } = registerRes.data;

    assertEqual(einvoiceStatus, 'generated', 'Status is generated');
    assertEqual(typeof irn, 'string', 'IRN is a string');
    assertEqual(irn.length, 64, 'IRN hash is exactly 64 hexadecimal characters');
    assert(/^[0-9A-F]{64}$/.test(irn), 'IRN is uppercase hexadecimal SHA-256 hash');
    assert(ackNo.startsWith('11'), 'Ack No starts with 11 (NIC standard)');
    assertEqual(ackNo.length, 15, 'Ack No is 15 digits');
    assert(Boolean(ackDate), 'Ack Date timestamp is present');

    const qrData = JSON.parse(signedQr);
    assertEqual(qrData.irn, irn, 'Signed QR payload contains matching IRN');
    assertEqual(qrData.sellerGstin, '29AABCC1332M1ZQ', 'Signed QR payload contains Seller GSTIN');
    assertEqual(qrData.buyerGstin, '29AAACH7409R1ZZ', 'Signed QR payload contains Buyer GSTIN');

    // Verify stored on bills row in SQLite
    const updatedBill = db.prepare('SELECT einvoice_status, einvoice_irn, einvoice_ack_no FROM bills WHERE id = ?').get(billId) as any;
    assertEqual(updatedBill.einvoice_status, 'generated', 'DB einvoice_status updated');
    assertEqual(updatedBill.einvoice_irn, irn, 'DB einvoice_irn matches returned IRN');

    console.log('\nStep 4: Idempotent Re-registration Check');
    const reRegRes = await api(baseUrl, `/api/bills/${billId}/einvoice/register`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(reRegRes.status, 200, 'Re-registration returns 200');
    assertEqual(reRegRes.data.irn, irn, 'Idempotent call returns identical IRN');

    console.log('\nStep 5: Reject Non-B2B Bills without GSTIN');
    const b2cOrder = await api(baseUrl, '/api/orders', {
      method: 'POST',
      body: { type: 'takeaway', items: [{ product_id: 'prod-biryani-b2b', quantity: 1 }] },
      headers: authHeader,
    });
    const b2cBill = await api(baseUrl, '/api/bills/generate', {
      method: 'POST',
      body: { order_id: b2cOrder.data.order.id },
      headers: authHeader,
    });
    const b2cRegister = await api(baseUrl, `/api/bills/${b2cBill.data.bill.id}/einvoice/register`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(b2cRegister.status, 400, 'Registration on bill without GSTIN is rejected (400)');

    console.log('\nAll E-Invoicing (IRN) & Signed QR tests passed successfully!');
  } finally {
    server.close();
    closeDatabase();
  }

  const { total, passed, failed } = getResults();
  console.log(`\nResults: ${passed}/${total} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
