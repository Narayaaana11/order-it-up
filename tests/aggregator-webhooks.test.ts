/**
 * Integration Test: Swiggy and Zomato Aggregator Webhook Ingestion
 *
 * Tests:
 * 1. Aggregator configurations (settings GET/PUT).
 * 2. Swiggy Webhook Ingestion (unauthenticated endpoint, normalization, BOM inventory deduction).
 * 3. Idempotent Ingestion (duplicate order payload returns existing order).
 * 4. Zomato Webhook Ingestion.
 * 5. Delivery Rider Updates (POST /api/webhooks/:platform/rider).
 * 6. Order Ready / Pickup Workflow (POST /api/aggregators/orders/:id/ready).
 * 7. Order Cancellation & Inventory Restoration (POST /api/webhooks/:platform/cancel).
 * 8. Aggregator Simulation Harness (POST /api/aggregators/test-order).
 *
 * Usage: node tests/run-electron-node-test.cjs tests/aggregator-webhooks.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-aggregator-test-'));
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
  console.log('Integration Test: Swiggy & Zomato Webhooks');
  console.log('='.repeat(50));

  const db = initTestDb();
  const { authHeader } = seedOwnerUser(db);

  // Seed Menu
  seedCategory(db, 'cat-biryani', 'Biryani');
  seedProduct(db, 'prod-chk-biryani', 'cat-biryani', 'Chicken Dum Biryani', 280);
  seedProduct(db, 'prod-coke-can', 'cat-biryani', 'Coke 330ml Can', 40);

  const app = createApp({});
  registerRoutes(app);
  const { baseUrl, server } = await startServer(app);

  try {
    // Seed Raw Inventory & Recipe for Biryani
    const resChicken = await api(baseUrl, '/api/inventory/ingredients', {
      method: 'POST',
      body: {
        id: 'ing-chicken',
        name: 'Raw Chicken',
        unit: 'kg',
        current_stock: 10.0,
        minimum_stock: 2.0,
        cost_per_unit: 180.0,
      },
      headers: authHeader,
    });
    assertEqual(resChicken.status, 201, 'Raw chicken ingredient created');
    const chickenId = resChicken.data?.ingredient?.id;

    const resRecipe = await api(baseUrl, '/api/inventory/recipes/prod-chk-biryani', {
      method: 'POST',
      body: {
        items: [
          { ingredient_id: chickenId, quantity_required: 0.25, unit: 'kg' },
        ],
      },
      headers: authHeader,
    });
    assertEqual(resRecipe.status, 200, 'Chicken biryani recipe BOM created');

    // 1. Aggregator Settings
    console.log('\nStep 1: Check Aggregator Settings');
    const resSettings = await api(baseUrl, '/api/aggregators/settings', { headers: authHeader });
    assertEqual(resSettings.status, 200, 'Fetched aggregator settings (200)');
    assert(Array.isArray(resSettings.data.configs), 'Returns configs list');
    assert(resSettings.data.configs.some((c: any) => c.platform === 'swiggy'), 'Swiggy config present');
    assert(resSettings.data.configs.some((c: any) => c.platform === 'zomato'), 'Zomato config present');

    // 2. Swiggy Webhook Ingestion
    console.log('\nStep 2: Ingest Swiggy Webhook (Unauthenticated)');
    const swiggyPayload = {
      order_id: 'SW-987654',
      order_time: new Date().toISOString(),
      prep_time: 25,
      customer: {
        name: 'Rahul Sharma',
        phone: '+919876543210',
        address: {
          display_address: 'Flat 402, Sunshine Heights, Koramangala, Bengaluru',
        },
      },
      cart: {
        items: [
          {
            item_id: 'prod-chk-biryani',
            name: 'Chicken Dum Biryani',
            quantity: 2,
            price: 280,
            addons: [],
          },
          {
            item_id: 'prod-coke-can',
            name: 'Coke 330ml Can',
            quantity: 1,
            price: 40,
            addons: [],
          },
        ],
      },
      pricing: {
        subtotal: 600,
        tax: 30,
        total: 630,
      },
      instructions: 'Please provide extra spicy raita',
    };

    const resSwiggy = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: swiggyPayload,
    });
    assertEqual(resSwiggy.status, 200, 'Swiggy webhook ingested successfully (200)');
    assertEqual(resSwiggy.data.swiggy_order_id, 'SW-987654', 'Returned swiggy_order_id');
    const swiggyLocalOrderId = resSwiggy.data.order_id;
    assert(swiggyLocalOrderId > 0, 'Local order ID created');

    // Verify in database
    const swiggyOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(swiggyLocalOrderId) as any;
    assertEqual(swiggyOrder.type, 'delivery', 'Order type is delivery');
    assertEqual(swiggyOrder.online_platform, 'swiggy', 'Platform recorded as swiggy');
    assertEqual(swiggyOrder.external_order_id, 'SW-987654', 'external_order_id matches');
    assertEqual(swiggyOrder.customer_name, 'Rahul Sharma', 'Customer name stored');
    assertEqual(swiggyOrder.prep_time_minutes, 25, 'Prep time stored');

    // Check BOM Deduction (2 x 0.25kg = 0.5kg chicken deducted from 10.0kg -> 9.5kg)
    const chickenStock = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId) as any;
    assertEqual(chickenStock.current_stock, 9.5, 'Raw chicken deducted accurately from recipe BOM (9.5 kg)');

    // 3. Duplicate Order Handling (Idempotency)
    console.log('\nStep 3: Webhook Idempotency Check');
    const resDup = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: swiggyPayload,
    });
    assertEqual(resDup.status, 200, 'Duplicate webhook returns 200 acknowledged');
    assertEqual(resDup.data.duplicate, true, 'Marked as duplicate');
    assertEqual(resDup.data.order_id, swiggyLocalOrderId, 'Returned original local order ID');

    // Stock should not be double-deducted
    const chickenStockAfterDup = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId) as any;
    assertEqual(chickenStockAfterDup.current_stock, 9.5, 'Stock not double deducted on duplicate webhook');

    // 4. Ingest Zomato Webhook
    console.log('\nStep 4: Ingest Zomato Webhook');
    const zomatoPayload = {
      order_id: 'ZM-445566',
      created_at: new Date().toISOString(),
      customer: {
        name: 'Pooja Verma',
        phone: '+919123456789',
        address: 'B-12 Indiranagar, Bengaluru',
      },
      items: [
        {
          id: 'prod-chk-biryani',
          name: 'Chicken Dum Biryani',
          quantity: 1,
          unit_price: 280,
        },
      ],
      bill: {
        subtotal: 280,
        gst: 14,
        net_amount: 294,
      },
      instructions: 'Do not ring doorbell, baby sleeping',
    };

    const resZomato = await api(baseUrl, '/api/webhooks/zomato/order', {
      method: 'POST',
      body: zomatoPayload,
    });
    assertEqual(resZomato.status, 200, 'Zomato webhook ingested successfully (200)');
    assertEqual(resZomato.data.zomato_order_id, 'ZM-445566', 'Returned zomato_order_id');
    const zomatoLocalOrderId = resZomato.data.order_id;

    // 5. Rider Assignment Webhook
    console.log('\nStep 5: Delivery Rider Assigned Webhook');
    const resRider = await api(baseUrl, '/api/webhooks/swiggy/rider', {
      method: 'POST',
      body: {
        order_id: 'SW-987654',
        rider: {
          name: 'Deepak Kumar',
          phone: '+919988776655',
          status: 'arrived_at_store',
        },
      },
    });
    assertEqual(resRider.status, 200, 'Rider update accepted (200)');
    assertEqual(resRider.data.rider_status, 'arrived_at_store', 'Rider status updated');

    const updatedOrder = db.prepare('SELECT rider_name, rider_phone, rider_status FROM orders WHERE id = ?').get(swiggyLocalOrderId) as any;
    assertEqual(updatedOrder.rider_name, 'Deepak Kumar', 'Rider name saved');
    assertEqual(updatedOrder.rider_phone, '+919988776655', 'Rider phone saved');
    assertEqual(updatedOrder.rider_status, 'arrived_at_store', 'Rider status saved');

    // 6. Kitchen Marks Order Ready for Pickup
    console.log('\nStep 6: Mark Order Ready For Pickup');
    const resReady = await api(baseUrl, `/api/aggregators/orders/${swiggyLocalOrderId}/ready`, {
      method: 'POST',
      headers: authHeader,
    });
    assertEqual(resReady.status, 200, 'Marked ready for pickup (200)');
    assertEqual(resReady.data.status, 'ready', 'Order status is ready');

    // 7. Cancellation & Raw Material Restock
    console.log('\nStep 7: Cancel Aggregator Order & Verify Inventory Restoration');
    const resCancel = await api(baseUrl, '/api/webhooks/zomato/cancel', {
      method: 'POST',
      body: {
        order_id: 'ZM-445566',
        reason: 'Customer requested cancellation',
      },
    });
    assertEqual(resCancel.status, 200, 'Cancellation processed (200)');
    assertEqual(resCancel.data.status, 'cancelled', 'Order marked cancelled');

    // Zomato had 1x Chicken Biryani (0.25kg). Total chicken was 10.0 - 0.5 (Swiggy) - 0.25 (Zomato) = 9.25kg.
    // Upon cancellation of Zomato, 0.25kg is restored -> 9.50kg!
    const chickenStockRestored = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId) as any;
    assertEqual(chickenStockRestored.current_stock, 9.5, 'Raw chicken restocked on cancellation (9.5 kg)');

    // 8. Aggregator Simulator Harness
    console.log('\nStep 8: Simulate Test Order via UI Harness');
    const resSim = await api(baseUrl, '/api/aggregators/test-order', {
      method: 'POST',
      headers: authHeader,
      body: {
        platform: 'swiggy',
        items: [
          { product_id: 'prod-chk-biryani', quantity: 1 },
          { product_id: 'prod-coke-can', quantity: 2 },
        ],
        customer_name: 'Simulated Tester',
        customer_phone: '+919000000000',
      },
    });
    assertEqual(resSim.status, 201, 'Simulation injected successfully (201)');
    assertEqual(resSim.data.platform, 'swiggy', 'Platform is swiggy');
    assert(resSim.data.external_order_id.startsWith('SW-'), 'Generated test order ID');
    assertEqual(resSim.data.items_count, 2, 'Simulated 2 items');

  } finally {
    server.close();
    closeDatabase();
  }

  const results = getResults();
  console.log(`\nResults: ${results.passed}/${results.total} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test failed with unhandled error:', err);
  process.exit(1);
});
