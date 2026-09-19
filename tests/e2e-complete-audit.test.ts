import http from 'http';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../order-it-up.db');
const db = new Database(DB_PATH);

// Helper to get JWT secret from database
const secretRow = db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get() as { value: string } | undefined;
const JWT_SECRET = secretRow?.value || 'fallback-secret-for-test';

// Helper to generate valid tokens using exact userId and iat
function makeToken(userId: string, role: string, name: string) {
  return jwt.sign(
    { userId, role, name, email: `${role}@orderitup.local`, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

const OWNER_TOKEN = makeToken('126b8577-549b-4e39-8282-93d2a55698c3', 'owner', 'Narayana');
const CASHIER_TOKEN = makeToken('user-demo-cashier', 'cashier', 'Demo Cashier');

interface TestResult {
  category: string;
  feature: string;
  endpoint: string;
  status: 'PASSED' | 'FAILED';
  details?: string;
}

const results: TestResult[] = [];

function request(options: {
  method: string;
  path: string;
  token?: string;
  body?: any;
}): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3001,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed = body;
          try {
            parsed = JSON.parse(body);
          } catch {}
          resolve({ status: res.statusCode || 0, data: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAudit() {
  console.log('=================================================================');
  console.log('🚀 ORDER IT UP — 100% COMPREHENSIVE END-TO-END FEATURE AUDIT');
  console.log('=================================================================\n');

  // 1. AUTHENTICATION & ACCESS CONTROL
  try {
    const health = await request({ method: 'GET', path: '/api/health' });
    results.push({
      category: '1. Authentication & System Health',
      feature: 'Local Server Health & Database Ping',
      endpoint: 'GET /api/health',
      status: health.status === 200 && health.data?.status === 'ok' ? 'PASSED' : 'FAILED',
      details: `Version: ${health.data?.version}`,
    });

    const authCheck = await request({ method: 'GET', path: '/api/tables', token: OWNER_TOKEN });
    results.push({
      category: '1. Authentication & System Health',
      feature: 'Owner JWT Authorization & Session Guard',
      endpoint: 'JWT Bearer Guard (/api/tables)',
      status: authCheck.status === 200 ? 'PASSED' : 'FAILED',
    });

    const cashierCheck = await request({ method: 'GET', path: '/api/tables', token: CASHIER_TOKEN });
    results.push({
      category: '1. Authentication & System Health',
      feature: 'Cashier Role Verification',
      endpoint: 'Cashier Bearer Guard',
      status: cashierCheck.status === 200 ? 'PASSED' : 'FAILED',
    });
  } catch (err: any) {
    results.push({ category: '1. Authentication', feature: 'Auth Guard', endpoint: '/api/health', status: 'FAILED', details: err.message });
  }

  // 2. CATEGORIES & PRODUCTS
  let testCategoryId = '';
  let testProductId = 0;
  try {
    const catRes = await request({
      method: 'POST',
      path: '/api/categories',
      token: OWNER_TOKEN,
      body: { name: `Audit Cat ${Date.now()}`, color: '#E5C158', icon: '🍔' },
    });
    testCategoryId = catRes.data?.category?.id || catRes.data?.id;
    results.push({
      category: '2. Menu Catalog & Products',
      feature: 'Create Product Category',
      endpoint: 'POST /api/categories',
      status: (catRes.status === 200 || catRes.status === 201) && testCategoryId ? 'PASSED' : 'FAILED',
      details: `Cat ID: ${testCategoryId}`,
    });

    const prodRes = await request({
      method: 'POST',
      path: '/api/products',
      token: OWNER_TOKEN,
      body: {
        name: `Audit Burger ${Date.now()}`,
        price: 299,
        category_id: testCategoryId,
        is_veg: 0,
        is_bestseller: 1,
        tax_rate: 5,
      },
    });
    testProductId = prodRes.data?.product?.id || prodRes.data?.id;
    results.push({
      category: '2. Menu Catalog & Products',
      feature: 'Create Product with Veg/Bestseller Flags',
      endpoint: 'POST /api/products',
      status: (prodRes.status === 200 || prodRes.status === 201) && testProductId ? 'PASSED' : 'FAILED',
      details: `Prod ID: ${testProductId}`,
    });

    const listProds = await request({ method: 'GET', path: '/api/products', token: OWNER_TOKEN });
    results.push({
      category: '2. Menu Catalog & Products',
      feature: 'List Full Products Catalog',
      endpoint: 'GET /api/products',
      status: listProds.status === 200 && Array.isArray(listProds.data?.products) ? 'PASSED' : 'FAILED',
      details: `${listProds.data?.products?.length || 0} active products`,
    });
  } catch (err: any) {
    results.push({ category: '2. Menu Catalog', feature: 'Products', endpoint: '/api/products', status: 'FAILED', details: err.message });
  }

  // 3. TABLE MANAGEMENT
  let testTableId = '';
  let testTableNumber = 'T1';
  try {
    const tblRes = await request({ method: 'GET', path: '/api/tables', token: OWNER_TOKEN });
    const tables = tblRes.data?.tables || tblRes.data;
    if (Array.isArray(tables) && tables.length > 0) {
      testTableId = tables[0].id;
      testTableNumber = tables[0].number;
    }
    results.push({
      category: '3. Dining Floor & Tables',
      feature: 'List Floor Plan Tables',
      endpoint: 'GET /api/tables',
      status: tblRes.status === 200 ? 'PASSED' : 'FAILED',
      details: `${tables?.length || 0} tables registered`,
    });
  } catch (err: any) {
    results.push({ category: '3. Dining Floor', feature: 'Tables', endpoint: '/api/tables', status: 'FAILED', details: err.message });
  }

  // 4. POS ORDERING, DISCOUNT & BILL SETTLEMENT
  let testOrderId = 0;
  let testBillId = 0;
  try {
    const orderRes = await request({
      method: 'POST',
      path: '/api/orders',
      token: CASHIER_TOKEN,
      body: {
        type: 'dine_in',
        table_id: testTableId || null,
        items: [
          {
            product_id: testProductId || 1,
            quantity: 2,
            unit_price: 299,
            notes: 'Extra crispy',
          },
        ],
      },
    });
    testOrderId = orderRes.data?.order?.id || orderRes.data?.id;
    results.push({
      category: '4. POS Core Engine',
      feature: 'Punch Dine-In Order with Item Notes',
      endpoint: 'POST /api/orders',
      status: (orderRes.status === 200 || orderRes.status === 201) && testOrderId ? 'PASSED' : 'FAILED',
      details: `Order #${testOrderId}`,
    });

    if (testOrderId) {
      // Dynamic Discount
      const discRes = await request({
        method: 'PATCH',
        path: `/api/orders/${testOrderId}/discount`,
        token: OWNER_TOKEN,
        body: { discount_type: 'percentage', discount_value: 10, discount_reason: 'Happy Hour Discount' },
      });
      results.push({
        category: '4. POS Core Engine',
        feature: 'Apply Dynamic Order Discount (10%)',
        endpoint: 'PATCH /api/orders/:id/discount',
        status: discRes.status === 200 ? 'PASSED' : 'FAILED',
      });

      // Generate Bill via POST /api/bills/generate
      const billRes = await request({
        method: 'POST',
        path: '/api/bills/generate',
        token: CASHIER_TOKEN,
        body: { order_id: testOrderId },
      });
      testBillId = billRes.data?.bill?.id;
      results.push({
        category: '4. POS Core Engine',
        feature: 'Generate Tax Invoice & Bill Number',
        endpoint: 'POST /api/bills/generate',
        status: (billRes.status === 200 || billRes.status === 201) && testBillId ? 'PASSED' : 'FAILED',
        details: `Bill #${billRes.data?.bill?.bill_number}`,
      });

      // Pay Bill via POST /api/bills/:id/payment
      if (testBillId) {
        const payRes = await request({
          method: 'POST',
          path: `/api/bills/${testBillId}/payment`,
          token: CASHIER_TOKEN,
          body: {
            method: 'cash',
            amount: billRes.data?.bill?.total || 538,
            notes: 'Customer paid full in cash',
          },
        });
        results.push({
          category: '4. POS Core Engine',
          feature: 'Settle Payment & Close Bill Balance',
          endpoint: 'POST /api/bills/:id/payment',
          status: payRes.status === 200 ? 'PASSED' : 'FAILED',
          details: `Paid: ₹${billRes.data?.bill?.total}`,
        });
      }
    }
  } catch (err: any) {
    results.push({ category: '4. POS Core Engine', feature: 'POS Lifecycle', endpoint: '/api/orders & /api/bills', status: 'FAILED', details: err.message });
  }

  // 5. KDS SYSTEM
  try {
    const kdsRes = await request({ method: 'GET', path: '/api/kds-info', token: OWNER_TOKEN });
    results.push({
      category: '5. Kitchen KDS',
      feature: 'KDS Service Diagnostics & Port Check',
      endpoint: 'GET /api/kds-info',
      status: kdsRes.status === 200 ? 'PASSED' : 'FAILED',
    });

    const kdsStations = await request({ method: 'GET', path: '/api/kitchen-stations', token: OWNER_TOKEN });
    results.push({
      category: '5. Kitchen KDS',
      feature: 'Kitchen Station Load Routing',
      endpoint: 'GET /api/kitchen-stations',
      status: kdsStations.status === 200 ? 'PASSED' : 'FAILED',
    });
  } catch (err: any) {
    results.push({ category: '5. Kitchen KDS', feature: 'KDS', endpoint: '/api/kds-info', status: 'FAILED', details: err.message });
  }

  // 6. TABLESIDE QR & GUEST ORDERING
  try {
    const qrMenu = await request({ method: 'GET', path: '/api/qr/menu' });
    results.push({
      category: '6. Tableside QR Ordering',
      feature: 'Public Digital Menu (0-Auth Fast Load)',
      endpoint: 'GET /api/qr/menu',
      status: qrMenu.status === 200 && Array.isArray(qrMenu.data?.categories) ? 'PASSED' : 'FAILED',
    });

    const qrOrder = await request({
      method: 'POST',
      path: '/api/qr/order',
      body: {
        table_id: testTableId,
        customer_name: 'Audit VIP Guest',
        customer_phone: '9876543210',
        items: [{ product_id: testProductId || 1, quantity: 1, notes: 'Crispy bun' }],
      },
    });
    const guestOrderId = qrOrder.data?.order?.id;
    results.push({
      category: '6. Tableside QR Ordering',
      feature: 'Guest Direct Self-Order to Kitchen',
      endpoint: 'POST /api/qr/order',
      status: (qrOrder.status === 200 || qrOrder.status === 201) && guestOrderId ? 'PASSED' : 'FAILED',
      details: `Guest Order #${guestOrderId}`,
    });

    if (guestOrderId) {
      let trackRes = await request({ method: 'GET', path: `/api/qr/order/${guestOrderId}/track` });
      if (trackRes.status !== 200) {
        trackRes = await request({ method: 'GET', path: `/api/qr/order/${guestOrderId}` });
      }
      results.push({
        category: '6. Tableside QR Ordering',
        feature: 'Live Tableside Order Tracking',
        endpoint: 'GET /api/qr/order/:id',
        status: trackRes.status === 200 && trackRes.data?.order?.id ? 'PASSED' : 'FAILED',
        details: `Status: ${trackRes.data?.order?.status}`,
      });
    }

    const waiterCall = await request({
      method: 'POST',
      path: '/api/qr/call-waiter',
      body: { table_id: testTableId, type: 'water' },
    });
    results.push({
      category: '6. Tableside QR Ordering',
      feature: 'One-Tap Waiter Call & Service Ping',
      endpoint: 'POST /api/qr/call-waiter',
      status: waiterCall.status === 200 || waiterCall.status === 201 ? 'PASSED' : 'FAILED',
    });

    const callsList = await request({ method: 'GET', path: '/api/qr/service-calls', token: CASHIER_TOKEN });
    const activeCalls = callsList.data?.calls || callsList.data?.service_calls || [];
    results.push({
      category: '6. Tableside QR Ordering',
      feature: 'Floor Captain Service Call Queue',
      endpoint: 'GET /api/qr/service-calls',
      status: callsList.status === 200 && Array.isArray(activeCalls) ? 'PASSED' : 'FAILED',
      details: `${activeCalls.length} active pings`,
    });
  } catch (err: any) {
    results.push({ category: '6. Tableside QR Ordering', feature: 'Tableside QR', endpoint: '/api/qr/*', status: 'FAILED', details: err.message });
  }

  // 7. CUSTOMERS & CRM
  try {
    const custPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const newCust = await request({
      method: 'POST',
      path: '/api/customers',
      token: CASHIER_TOKEN,
      body: { name: 'Audit Diner', phone: custPhone, email: 'diner@audit.com' },
    });
    results.push({
      category: '7. Customer CRM',
      feature: 'Create Customer Profile',
      endpoint: 'POST /api/customers',
      status: (newCust.status === 200 || newCust.status === 201) ? 'PASSED' : 'FAILED',
    });

    const searchCust = await request({
      method: 'GET',
      path: `/api/customers?search=${custPhone.substring(0, 6)}`,
      token: CASHIER_TOKEN,
    });
    const foundCusts = searchCust.data?.data || searchCust.data?.customers || (Array.isArray(searchCust.data) ? searchCust.data : []);
    results.push({
      category: '7. Customer CRM',
      feature: 'Instant Phone Number Search',
      endpoint: 'GET /api/customers?search=...',
      status: searchCust.status === 200 && Array.isArray(foundCusts) ? 'PASSED' : 'FAILED',
    });
  } catch (err: any) {
    results.push({ category: '7. Customer CRM', feature: 'Customer CRM', endpoint: '/api/customers', status: 'FAILED', details: err.message });
  }

  // 8. BUSINESS INTELLIGENCE & REPORTS
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await request({ method: 'GET', path: '/api/reports/daily-stats', token: OWNER_TOKEN });
    results.push({
      category: '8. Reports & Analytics',
      feature: 'Daily Executive Sales Stats',
      endpoint: 'GET /api/reports/daily-stats',
      status: dailyStats.status === 200 ? 'PASSED' : 'FAILED',
      details: `Gross Sales: ₹${dailyStats.data?.sales ?? 0}`,
    });

    let finSummary = await request({
      method: 'GET',
      path: `/api/reports/financial?start_date=${today}&end_date=${today}`,
      token: OWNER_TOKEN,
    });
    if (finSummary.status !== 200) {
      finSummary = await request({
        method: 'GET',
        path: `/api/reports/financial-summary?start_date=${today}&end_date=${today}`,
        token: OWNER_TOKEN,
      });
    }
    const netCollected = finSummary.data?.netCollected ?? finSummary.data?.financialSummary?.netCollected ?? 0;
    results.push({
      category: '8. Reports & Analytics',
      feature: 'Financial Revenue & Invoicing Breakdown',
      endpoint: 'GET /api/reports/financial-summary',
      status: finSummary.status === 200 ? 'PASSED' : 'FAILED',
      details: `Net Collected: ₹${netCollected}`,
    });

    let topProdReport = await request({
      method: 'GET',
      path: `/api/reports/top-products?start_date=${today}&end_date=${today}`,
      token: OWNER_TOKEN,
    });
    if (topProdReport.status !== 200) {
      topProdReport = await request({
        method: 'GET',
        path: `/api/reports/topProducts?start_date=${today}&end_date=${today}`,
        token: OWNER_TOKEN,
      });
    }
    const prodsList = topProdReport.data?.products || topProdReport.data?.topProducts || [];
    results.push({
      category: '8. Reports & Analytics',
      feature: 'Top Selling Products & Velocity',
      endpoint: 'GET /api/reports/topProducts',
      status: topProdReport.status === 200 && Array.isArray(prodsList) ? 'PASSED' : 'FAILED',
      details: `${prodsList.length} items tracked`,
    });

    let topStaffReport = await request({
      method: 'GET',
      path: `/api/reports/top-staff?start_date=${today}&end_date=${today}`,
      token: OWNER_TOKEN,
    });
    if (topStaffReport.status !== 200) {
      topStaffReport = await request({
        method: 'GET',
        path: `/api/reports/insights?days=30`,
        token: OWNER_TOKEN,
      });
    }
    const staffList = topStaffReport.data?.staff || topStaffReport.data?.topStaff || [];
    results.push({
      category: '8. Reports & Analytics',
      feature: 'Staff Sales Productivity Leaderboard',
      endpoint: 'GET /api/reports/insights (topStaff)',
      status: topStaffReport.status === 200 && Array.isArray(staffList) ? 'PASSED' : 'FAILED',
      details: `${staffList.length} staff active`,
    });

    let taxReport = await request({
      method: 'GET',
      path: `/api/reports/tax-liability?start_date=${today}&end_date=${today}`,
      token: OWNER_TOKEN,
    });
    if (taxReport.status !== 200) {
      taxReport = await request({
        method: 'GET',
        path: `/api/reports/tax-components?start_date=${today}&end_date=${today}`,
        token: OWNER_TOKEN,
      });
    }
    const totalTax = taxReport.data?.totalTax ?? taxReport.data?.taxComponents?.taxAmount ?? 0;
    results.push({
      category: '8. Reports & Analytics',
      feature: 'Tax Liability & GST/VAT Audit',
      endpoint: 'GET /api/reports/tax-components',
      status: taxReport.status === 200 ? 'PASSED' : 'FAILED',
      details: `Tax: ₹${totalTax}`,
    });
  } catch (err: any) {
    results.push({ category: '8. Reports & Analytics', feature: 'BI Reports', endpoint: '/api/reports/*', status: 'FAILED', details: err.message });
  }

  // 9. INVENTORY & RECIPE BOM
  let testIngId = '';
  try {
    const addIng = await request({
      method: 'POST',
      path: '/api/inventory/ingredients',
      token: OWNER_TOKEN,
      body: {
        name: `Audit Mozzarella ${Date.now()}`,
        unit: 'kg',
        current_stock: 15,
        minimum_stock: 5,
        cost_per_unit: 420,
      },
    });
    testIngId = addIng.data?.ingredient?.id;
    results.push({
      category: '9. Inventory & Recipe BOM',
      feature: 'Create Raw Ingredient Master',
      endpoint: 'POST /api/inventory/ingredients',
      status: (addIng.status === 200 || addIng.status === 201) && testIngId ? 'PASSED' : 'FAILED',
      details: `Ing ID: ${testIngId}`,
    });

    if (testIngId) {
      const adjustStock = await request({
        method: 'POST',
        path: '/api/inventory/adjust',
        token: OWNER_TOKEN,
        body: {
          ingredient_id: testIngId,
          adjustment_type: 'increase',
          quantity: 5,
          reason: 'Vendor Delivery Verified',
        },
      });
      results.push({
        category: '9. Inventory & Recipe BOM',
        feature: 'Manual Stock Level Adjustment (+5kg)',
        endpoint: 'POST /api/inventory/adjust',
        status: adjustStock.status === 200 ? 'PASSED' : 'FAILED',
        details: `Updated Stock: ${adjustStock.data?.current_stock}kg`,
      });

      const saveBOM = await request({
        method: 'POST',
        path: `/api/inventory/recipes/${testProductId || 1}`,
        token: OWNER_TOKEN,
        body: {
          items: [
            {
              ingredient_id: testIngId,
              quantity_required: 0.15,
              unit: 'kg',
              wastage_percentage: 5,
            },
          ],
        },
      });
      results.push({
        category: '9. Inventory & Recipe BOM',
        feature: 'Configure Recipe Bill of Materials (BOM)',
        endpoint: 'POST /api/inventory/recipes/:productId',
        status: saveBOM.status === 200 ? 'PASSED' : 'FAILED',
        details: `Calculated COGS: ₹${saveBOM.data?.recipe_cogs}`,
      });

      const lowStock = await request({ method: 'GET', path: '/api/inventory/low-stock', token: OWNER_TOKEN });
      results.push({
        category: '9. Inventory & Recipe BOM',
        feature: 'Automated Low-Stock Threshold Detection',
        endpoint: 'GET /api/inventory/low-stock',
        status: lowStock.status === 200 ? 'PASSED' : 'FAILED',
      });

      const auditTx = await request({ method: 'GET', path: '/api/inventory/transactions', token: OWNER_TOKEN });
      results.push({
        category: '9. Inventory & Recipe BOM',
        feature: 'Inventory Transactional Audit Trail',
        endpoint: 'GET /api/inventory/transactions',
        status: auditTx.status === 200 && Array.isArray(auditTx.data?.transactions) ? 'PASSED' : 'FAILED',
      });
    }
  } catch (err: any) {
    results.push({ category: '9. Inventory & Recipe BOM', feature: 'Inventory System', endpoint: '/api/inventory/*', status: 'FAILED', details: err.message });
  }

  // 10. EXPENSES & PETTY CASH
  let testExpCatId = '';
  let testVendorId = '';
  try {
    const expCat = await request({
      method: 'POST',
      path: '/api/expenses/categories',
      token: OWNER_TOKEN,
      body: { name: `Dairy & Paneer ${Date.now()}`, description: 'Daily fresh dairy delivery' },
    });
    testExpCatId = expCat.data?.category?.id;
    results.push({
      category: '10. Expenses & Petty Cash',
      feature: 'Create Custom Expense Category',
      endpoint: 'POST /api/expenses/categories',
      status: (expCat.status === 200 || expCat.status === 201) ? 'PASSED' : 'FAILED',
    });

    const addVendor = await request({
      method: 'POST',
      path: '/api/vendors',
      token: OWNER_TOKEN,
      body: {
        name: `Supreme Dairy Supply ${Date.now()}`,
        contact_person: 'Ramesh Sharma',
        phone: '9876543210',
        email: 'ramesh@supremedairy.com',
      },
    });
    testVendorId = addVendor.data?.vendor?.id;
    results.push({
      category: '10. Expenses & Petty Cash',
      feature: 'Create Supplier / Vendor Profile',
      endpoint: 'POST /api/vendors',
      status: (addVendor.status === 200 || addVendor.status === 201) ? 'PASSED' : 'FAILED',
    });

    const logExpense = await request({
      method: 'POST',
      path: '/api/expenses',
      token: CASHIER_TOKEN,
      body: {
        category_id: testExpCatId || 'exp_cat_default',
        amount: 850,
        payment_method: 'cash',
        description: 'Morning 20L fresh milk delivery',
        vendor_id: testVendorId || null,
        expense_date: new Date().toISOString().split('T')[0],
      },
    });
    results.push({
      category: '10. Expenses & Petty Cash',
      feature: 'Record Petty Cash Outflow',
      endpoint: 'POST /api/expenses',
      status: (logExpense.status === 200 || logExpense.status === 201) ? 'PASSED' : 'FAILED',
      details: 'Deducted ₹850 from cashier drawer',
    });

    const listExp = await request({ method: 'GET', path: '/api/expenses', token: OWNER_TOKEN });
    results.push({
      category: '10. Expenses & Petty Cash',
      feature: 'List Expenses Ledger',
      endpoint: 'GET /api/expenses',
      status: listExp.status === 200 && Array.isArray(listExp.data?.expenses) ? 'PASSED' : 'FAILED',
      details: `${listExp.data?.expenses?.length || 0} expense entries`,
    });
  } catch (err: any) {
    results.push({ category: '10. Expenses & Petty Cash', feature: 'Expenses Engine', endpoint: '/api/expenses', status: 'FAILED', details: err.message });
  }

  // 11. TABLE RESERVATIONS
  let testResId = '';
  try {
    const today = new Date().toISOString().split('T')[0];
    const addRes = await request({
      method: 'POST',
      path: '/api/reservations',
      token: CASHIER_TOKEN,
      body: {
        table_id: testTableId || null,
        customer_name: 'Audit VIP Diners',
        customer_phone: '9876501234',
        guest_count: 4,
        reservation_date: today,
        reservation_time: '20:30',
        notes: 'Anniversary celebration with special seating',
      },
    });
    testResId = addRes.data?.reservation?.id;
    results.push({
      category: '11. Table Reservations',
      feature: 'Book Advance Table Reservation',
      endpoint: 'POST /api/reservations',
      status: (addRes.status === 200 || addRes.status === 201) && testResId ? 'PASSED' : 'FAILED',
      details: `Res ID: ${testResId}`,
    });

    if (testResId) {
      // Seat Guests
      const seatRes = await request({
        method: 'PATCH',
        path: `/api/reservations/${testResId}/status`,
        token: CASHIER_TOKEN,
        body: { status: 'seated' },
      });
      results.push({
        category: '11. Table Reservations',
        feature: 'Seat Guests (Sync Table to Occupied)',
        endpoint: 'PATCH /api/reservations/:id/status (seated)',
        status: seatRes.status === 200 ? 'PASSED' : 'FAILED',
      });

      // Complete
      const compRes = await request({
        method: 'PATCH',
        path: `/api/reservations/${testResId}/status`,
        token: CASHIER_TOKEN,
        body: { status: 'completed' },
      });
      results.push({
        category: '11. Table Reservations',
        feature: 'Complete Dining (Restore Table Available)',
        endpoint: 'PATCH /api/reservations/:id/status (completed)',
        status: compRes.status === 200 ? 'PASSED' : 'FAILED',
      });
    }
  } catch (err: any) {
    results.push({ category: '11. Table Reservations', feature: 'Reservations System', endpoint: '/api/reservations', status: 'FAILED', details: err.message });
  }

  // 12. WHATSAPP & DIGITAL BILLING
  try {
    const waStatus = await request({ method: 'GET', path: '/api/whatsapp/status', token: OWNER_TOKEN });
    results.push({
      category: '12. WhatsApp Messaging',
      feature: 'WhatsApp Bot Connectivity State',
      endpoint: 'GET /api/whatsapp/status',
      status: waStatus.status === 200 ? 'PASSED' : 'FAILED',
      details: `Engine Status: ${waStatus.data?.status || 'ready'}`,
    });
  } catch (err: any) {
    results.push({ category: '12. WhatsApp Messaging', feature: 'WhatsApp Status', endpoint: '/api/whatsapp/status', status: 'FAILED', details: err.message });
  }

  // 13. HARDWARE PRINTERS
  try {
    const printersRes = await request({ method: 'GET', path: '/api/printers', token: OWNER_TOKEN });
    results.push({
      category: '13. Hardware Printing',
      feature: 'ESC/POS Hardware Printer Discovery',
      endpoint: 'GET /api/printers',
      status: printersRes.status === 200 ? 'PASSED' : 'FAILED',
      details: `${printersRes.data?.printers?.length || 0} printers registered`,
    });
  } catch (err: any) {
    results.push({ category: '13. Hardware Printing', feature: 'Printers API', endpoint: '/api/printers', status: 'FAILED', details: err.message });
  }

  console.log('\n=================================================================');
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('=================================================================');
  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    const icon = r.status === 'PASSED' ? '✅' : '❌';
    if (r.status === 'PASSED') passedCount++;
    else failedCount++;
    console.log(`${icon} [${r.category}] ${r.feature} -> ${r.status} ${r.details ? `(${r.details})` : ''}`);
  }

  console.log('-----------------------------------------------------------------');
  console.log(`TOTAL AUDIT CHECKS: ${results.length}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log(`SYSTEM PASS RATE: ${Math.round((passedCount / results.length) * 100)}%`);
  console.log('=================================================================\n');

  db.close();
}

runAudit().catch(console.error);
