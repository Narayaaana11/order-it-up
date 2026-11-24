const http = require('http');

async function testHqCrud() {
  const loginData = JSON.stringify({ email: 'admin@orderitup.com', password: 'Admin@1234' });
  const token = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
    }, (res) => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(JSON.parse(b).access_token));
    });
    req.write(loginData); req.end();
  });

  console.log('1. Auth Token obtained:', token ? 'YES' : 'NO');

  function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const headers = { Authorization: 'Bearer ' + token };
      if (data) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(data);
      }
      const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api' + path, method, headers }, (res) => {
        let b = ''; res.on('data', d => b += d); res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, text: b }); }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  // Check 1: Overview
  const overview = await request('GET', '/cloud/overview');
  console.log('2. GET /cloud/overview:', overview.status, 'Branches count:', overview.data.branches?.length);

  // Check 2: Catalog
  const catalog = await request('GET', '/cloud/catalog');
  console.log('3. GET /cloud/catalog:', catalog.status, 'Items count:', catalog.data.items?.length);

  // Check 3: Price & Availability Override (CRUD)
  const targetItem = catalog.data.items[0];
  const overrideRes = await request('POST', '/cloud/catalog/override', {
    product_id: targetItem.id,
    price_override: 399,
    is_available: false
  });
  console.log('4. POST /cloud/catalog/override (CRUD):', overrideRes.status, overrideRes.data);

  // Check 4: Stock Transfers List
  const transfers = await request('GET', '/cloud/transfers');
  console.log('5. GET /cloud/transfers:', transfers.status, 'Transfers count:', transfers.data.transfers?.length);

  // Check 5: Create Transfer (CRUD)
  const newTransfer = await request('POST', '/cloud/transfers', {
    source: 'Connaught Place (Main Outlet)',
    dest: 'Gurugram CyberHub (Franchise)',
    item: 'Alphonso Mango Puree (KG)',
    qty: 12,
    unit: 'kg'
  });
  console.log('6. POST /cloud/transfers (CRUD):', newTransfer.status, newTransfer.data);

  // Check 6: Update Transfer Status (CRUD)
  const transferId = newTransfer.data.transfer.id;
  const patchTransfer = await request('PATCH', `/cloud/transfers/${transferId}/status`, {
    status: 'dispatched'
  });
  console.log('7. PATCH /cloud/transfers/:id/status (CRUD):', patchTransfer.status, patchTransfer.data);

  // Check 7: Generate Terminal Pairing PIN (CRUD)
  const pairPin = await request('POST', '/cloud/pair/generate', {
    branch_id: 'br-01',
    terminal_name: 'Desktop POS Terminal 1'
  });
  console.log('8. POST /cloud/pair/generate (CRUD):', pairPin.status, 'Code:', pairPin.data.code);

  const allPassed = overview.status === 200 &&
    catalog.status === 200 &&
    overrideRes.status === 200 &&
    newTransfer.status === 200 &&
    patchTransfer.status === 200 &&
    pairPin.status === 200;

  console.log('\n=== ALL CLOUD HQ CRUD OPERATIONS VERIFIED ===', allPassed ? 'PASS' : 'FAIL');
  process.exit(allPassed ? 0 : 1);
}

testHqCrud();
