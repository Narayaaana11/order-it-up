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
const crypto = require('crypto');
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

  // Configure explicit signing secrets for webhook integration tests.
  const webhookSecret = 'aggregator-test-secret-change-me';
  db.prepare("UPDATE aggregator_configs SET webhook_secret = ?, is_enabled = 1 WHERE platform = 'swiggy'").run(webhookSecret);
  db.prepare("UPDATE aggregator_configs SET webhook_secret = ?, is_enabled = 1 WHERE platform = 'zomato'").run(webhookSecret);
  const signedHeaders = (platform: 'swiggy' | 'zomato', payload: any) => ({
    [platform === 'swiggy' ? 'x-swiggy-signature' : 'x-zomato-signature']:
      crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex'),
  });

  // Seed Menu
  seedCategory(db, 'cat-biryani', 'Biryani');
  seedProduct(db, 'prod-chk-biryani', 'cat-biryani', 'Chicken Dum Biryani', 280, { track_inventory: true, stock_quantity: 20 });
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

    const missingSignature = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: swiggyPayload,
    });
    assertEqual(missingSignature.status, 401, 'Rejects unsigned Swiggy webhook');

    const invalidSignature = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: swiggyPayload,
      headers: { 'x-swiggy-signature': 'not-a-valid-signature' },
    });
    assertEqual(invalidSignature.status, 401, 'Rejects invalid Swiggy webhook signature');

    db.prepare("UPDATE aggregator_configs SET webhook_secret = NULL WHERE platform = 'swiggy'").run();
    const unconfiguredWebhook = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: swiggyPayload,
      headers: signedHeaders('swiggy', swiggyPayload),
    });
    assertEqual(unconfiguredWebhook.status, 503, 'Fails closed when Swiggy signing secret is missing');
    db.prepare("UPDATE aggregator_configs SET webhook_secret = ? WHERE platform = 'swiggy'").run(webhookSecret);

    const resSwiggy = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: swiggyPayload,
      headers: signedHeaders('swiggy', swiggyPayload),
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
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 18, 'Tracked menu stock is deducted for auto-accepted aggregator items');

    // 3. Duplicate Order Handling (Idempotency)
    console.log('\nStep 3: Webhook Idempotency Check');
    const resDup = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST',
      body: swiggyPayload,
      headers: signedHeaders('swiggy', swiggyPayload),
    });
    assertEqual(resDup.status, 200, 'Duplicate webhook returns 200 acknowledged');
    assertEqual(resDup.data.duplicate, true, 'Marked as duplicate');
    assertEqual(resDup.data.order_id, swiggyLocalOrderId, 'Returned original local order ID');

    // Stock should not be double-deducted
    const chickenStockAfterDup = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId) as any;
    assertEqual(chickenStockAfterDup.current_stock, 9.5, 'Stock not double deducted on duplicate webhook');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 18, 'Tracked menu stock is not double deducted on duplicate webhook');

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
      headers: signedHeaders('zomato', zomatoPayload),
    });
    assertEqual(resZomato.status, 200, 'Zomato webhook ingested successfully (200)');
    assertEqual(resZomato.data.zomato_order_id, 'ZM-445566', 'Returned zomato_order_id');
    const zomatoLocalOrderId = resZomato.data.order_id;
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 17, 'Zomato auto-accept deducts tracked menu stock');

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
      headers: signedHeaders('swiggy', {
        order_id: 'SW-987654',
        rider: {
          name: 'Deepak Kumar',
          phone: '+919988776655',
          status: 'arrived_at_store',
        },
      }),
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
      headers: signedHeaders('zomato', {
        order_id: 'ZM-445566',
        reason: 'Customer requested cancellation',
      }),
    });
    assertEqual(resCancel.status, 200, 'Cancellation processed (200)');
    assertEqual(resCancel.data.status, 'cancelled', 'Order marked cancelled');

    // Zomato had 1x Chicken Biryani (0.25kg). Total chicken was 10.0 - 0.5 (Swiggy) - 0.25 (Zomato) = 9.25kg.
    // Upon cancellation of Zomato, 0.25kg is restored -> 9.50kg!
    const chickenStockRestored = db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId) as any;
    assertEqual(chickenStockRestored.current_stock, 9.5, 'Raw chicken restocked on cancellation (9.5 kg)');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 18, 'Aggregator cancellation restores tracked menu stock');

    // Low stock must never leave an aggregator order marked as preparing while
    // the matching raw-ingredient deduction is missing.
    console.log('\nStep 8: Keep Auto-Accepted Orders Pending When Ingredient Stock Is Short');
    db.prepare('UPDATE raw_ingredients SET current_stock = 0.1 WHERE id = ?').run(chickenId);
    const shortagePayload = {
      order_id: 'SW-LOW-STOCK-001',
      items: [{ item_id: 'prod-chk-biryani', name: 'Chicken Dum Biryani', quantity: 1, price: 280 }],
      pricing: { subtotal: 280, total: 280 },
    };
    const shortageResponse = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST', body: shortagePayload, headers: signedHeaders('swiggy', shortagePayload),
    });
    assertEqual(shortageResponse.status, 200, 'Low-stock aggregator delivery is retained and acknowledged');
    assertEqual(shortageResponse.data.kitchen_status, 'pending', 'Low-stock auto-accept falls back to staff review');
    const shortageOrderId = shortageResponse.data.order_id;
    assertEqual(db.prepare('SELECT status FROM orders WHERE id = ?').get(shortageOrderId).status, 'pending', 'Low-stock order is persisted as pending');
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 0.1, 'Failed auto-accept does not partially deduct ingredients');

    const shortageAccept = await api(baseUrl, `/api/aggregators/orders/${shortageOrderId}/accept`, { method: 'POST', headers: authHeader });
    assertEqual(shortageAccept.status, 409, 'Manual acceptance rejects insufficient ingredient stock');
    assertEqual(db.prepare('SELECT status FROM orders WHERE id = ?').get(shortageOrderId).status, 'pending', 'Rejected acceptance leaves the order pending');
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 0.1, 'Rejected acceptance leaves ingredient stock unchanged');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 18, 'Low-stock pending order does not deduct tracked menu stock');

    db.prepare('UPDATE raw_ingredients SET current_stock = 1 WHERE id = ?').run(chickenId);
    const successfulAccept = await api(baseUrl, `/api/aggregators/orders/${shortageOrderId}/accept`, { method: 'POST', headers: authHeader });
    assertEqual(successfulAccept.status, 200, 'Staff can accept the order after stock is replenished');
    assertEqual(db.prepare('SELECT status FROM orders WHERE id = ?').get(shortageOrderId).status, 'preparing', 'Accepted order status advances with its stock deduction');
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 0.75, 'Successful acceptance deducts the recipe exactly once');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 17, 'Manual acceptance deducts tracked menu stock');

    const acceptedCancelPayload = { order_id: 'SW-LOW-STOCK-001', reason: 'Inventory lifecycle regression test' };
    const acceptedCancel = await api(baseUrl, '/api/webhooks/swiggy/cancel', {
      method: 'POST', body: acceptedCancelPayload, headers: signedHeaders('swiggy', acceptedCancelPayload),
    });
    assertEqual(acceptedCancel.status, 200, 'Signed provider cancellation succeeds after acceptance');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 18, 'Provider cancellation restores tracked menu stock exactly once');
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 1, 'Provider cancellation restores recipe ingredients');

    const unmappedPayload = {
      order_id: 'SW-UNMAPPED-001',
      items: [{ item_id: 'provider-only-item', name: 'Provider-only Dish', quantity: 1, price: 99 }],
      pricing: { subtotal: 99, total: 99 },
    };
    const unmappedResponse = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST', body: unmappedPayload, headers: signedHeaders('swiggy', unmappedPayload),
    });
    assertEqual(unmappedResponse.status, 200, 'Unmapped catalog order is retained from the provider');
    assertEqual(unmappedResponse.data.kitchen_status, 'pending', 'Unmapped catalog items require staff review before preparation');
    const unmappedOrderId = unmappedResponse.data.order_id;
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 1, 'Unmapped catalog order does not deduct recipe stock');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 18, 'Unmapped catalog order does not alter tracked product stock');
    const acceptUnmapped = await api(baseUrl, `/api/aggregators/orders/${unmappedOrderId}/accept`, { method: 'POST', headers: authHeader });
    assertEqual(acceptUnmapped.status, 409, 'Manual acceptance rejects unmapped provider items');
    assertEqual(db.prepare('SELECT status FROM orders WHERE id = ?').get(unmappedOrderId).status, 'pending', 'Unmapped items keep the order pending until catalog mapping is fixed');

    db.prepare("UPDATE products SET stock_quantity = 0.5 WHERE id = 'prod-chk-biryani'").run();
    const productShortagePayload = {
      order_id: 'SW-PRODUCT-STOCK-001',
      items: [{ item_id: 'prod-chk-biryani', name: 'Chicken Dum Biryani', quantity: 1, price: 280 }],
      pricing: { subtotal: 280, total: 280 },
    };
    const productShortage = await api(baseUrl, '/api/webhooks/swiggy/order', {
      method: 'POST', body: productShortagePayload, headers: signedHeaders('swiggy', productShortagePayload),
    });
    assertEqual(productShortage.data.kitchen_status, 'pending', 'Tracked product shortage prevents auto-accept');
    const productShortageOrderId = productShortage.data.order_id;
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 1, 'Product shortage does not deduct recipe ingredients');
    const productShortageAccept = await api(baseUrl, `/api/aggregators/orders/${productShortageOrderId}/accept`, { method: 'POST', headers: authHeader });
    assertEqual(productShortageAccept.status, 409, 'Manual acceptance rejects insufficient tracked product stock');
    assertEqual(db.prepare('SELECT status FROM orders WHERE id = ?').get(productShortageOrderId).status, 'pending', 'Product shortage leaves the order pending');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 0.5, 'Product shortage leaves sellable stock unchanged');
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 1, 'Failed product acceptance rolls back raw ingredient deduction');

    db.prepare("UPDATE products SET stock_quantity = 1 WHERE id = 'prod-chk-biryani'").run();
    const productRestockAccept = await api(baseUrl, `/api/aggregators/orders/${productShortageOrderId}/accept`, { method: 'POST', headers: authHeader });
    assertEqual(productRestockAccept.status, 200, 'Staff can accept after the tracked product is restocked');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 0, 'Acceptance consumes the final tracked product unit');
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 0.75, 'Acceptance deducts recipe stock only after all checks pass');
    const productCancelPayload = { order_id: 'SW-PRODUCT-STOCK-001', reason: 'Inventory lifecycle regression test' };
    const productCancel = await api(baseUrl, '/api/webhooks/swiggy/cancel', {
      method: 'POST', body: productCancelPayload, headers: signedHeaders('swiggy', productCancelPayload),
    });
    assertEqual(productCancel.status, 200, 'Provider can cancel the accepted order');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 1, 'Cancellation restores the tracked product quantity');
    assertEqual(db.prepare('SELECT current_stock FROM raw_ingredients WHERE id = ?').get(chickenId).current_stock, 1, 'Cancellation restores the recipe quantity');
    const repeatedProductCancel = await api(baseUrl, '/api/webhooks/swiggy/cancel', {
      method: 'POST', body: productCancelPayload, headers: signedHeaders('swiggy', productCancelPayload),
    });
    assertEqual(repeatedProductCancel.data.cancelled, false, 'Repeated provider cancellation is acknowledged without applying twice');
    assertEqual(db.prepare("SELECT stock_quantity FROM products WHERE id = 'prod-chk-biryani'").get().stock_quantity, 1, 'Repeated cancellation does not restore product stock twice');

    // 9. Aggregator Simulator Harness
    console.log('\nStep 9: Simulate Test Order via UI Harness');
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
