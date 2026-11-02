const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('../frontend/node_modules/playwright');

const repoRoot = path.resolve(__dirname, '..');
const landingRoot = path.join(repoRoot, 'landing');
const staticRoot = path.join(landingRoot, 'out');
const cloudOrigin = 'https://orderitup-cloud-api.narayaaana11.workers.dev';
const requests = [];
const orders = [{
  id: 'order-100', order_number: 'C-100', order_type: 'takeaway', status: 'active', version: 2,
  kitchen_status: 'pending', payment_status: 'unpaid', grand_total: 12.6, ordered_at: new Date().toISOString(),
  items: [{ product_name: 'Test Pizza', quantity: 1 }],
}];
const ticket = { id: 'ticket-100', order_id: 'order-100', order_number: 'C-100', status: 'pending', station: 'oven', created_at: new Date().toISOString(), items: [{ name: 'Test Pizza', quantity: 1 }] };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function startApiServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    requests.push({ method: req.method, path: url.pathname + url.search, auth: req.headers.authorization });
    if (req.headers.authorization !== 'Bearer e2e-cloud-token-with-enough-length') { json(res, 401, { error: 'Unauthorized' }); return; }
    const bodyPromise = new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    });

    if (req.method === 'GET' && url.pathname === '/api/branches') return json(res, 200, { branches: [{ id: 'branch-1', name: 'E2E Branch', status: 'active' }] });
    if (req.method === 'GET' && url.pathname === '/api/catalog/master') return json(res, 200, { categories: [], products: [{
      id: 'product-1', name: 'Test Pizza', category_id: 'cat-1', base_price: 12, tax_rate: 5, is_active: 1,
      addon_groups: [{ id: 'group-1', name: 'Toppings', is_required: 0, min_selection: 0, max_selection: 2, addons: [{ id: 'addon-1', name: 'Cheese', price: 2, is_active: 1 }] }],
    }] });
    if (req.method === 'GET' && url.pathname === '/api/catalog/branch/branch-1') return json(res, 200, { catalog: [{ id: 'product-1', effective_price: 12, is_available: 1 }] });
    if (req.method === 'GET' && url.pathname === '/api/tables') return json(res, 200, { tables: [{ id: 'table-1', table_number: 'T-1', status: 'available', capacity: 4 }] });
    if (req.method === 'GET' && url.pathname === '/api/orders') return json(res, 200, { orders: [...orders], total: orders.length });
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      return bodyPromise.then((body) => {
        const order = { id: body.id, order_number: 'C-101', order_type: body.order_type, status: 'active', version: 1, kitchen_status: 'pending', payment_status: 'unpaid', grand_total: 12.6, ordered_at: new Date().toISOString(), items: [{ product_name: 'Test Pizza', quantity: 1 }] };
        orders.unshift(order);
        json(res, 201, { success: true, order });
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/kitchen/tickets') return json(res, 200, { tickets: [{ ...ticket }] });
    if (req.method === 'PATCH' && url.pathname === '/api/kitchen/tickets/ticket-100/status') {
      return bodyPromise.then((body) => { ticket.status = body.status; json(res, 200, { success: true, ticket }); });
    }
    if (req.method === 'GET' && url.pathname.endsWith('/payments')) return json(res, 200, { outstanding_balance: 12.6 });
    if (req.method === 'POST' && /\/api\/orders\/[^/]+\/payments$/.test(url.pathname)) {
      return bodyPromise.then((body) => { assert.equal(body.payment_method, 'cash'); assert.equal(body.amount, 12.6); json(res, 201, { success: true, outstanding_balance: 0, order_version: 3 }); });
    }
    if (req.method === 'PATCH' && /\/api\/orders\/[^/]+\/status$/.test(url.pathname)) return json(res, 200, { success: true, version: 4 });
    if (req.method === 'GET' && url.pathname === '/api/accountant/tax-summary') return json(res, 200, { tax_by_branch: [{ branch_id: 'branch-1', branch_name: 'E2E Branch', total_bills: 1, taxable_amount: 12, tax_collected: 0.6, gross_turnover: 12.6 }] });
    json(res, 404, { error: `Unexpected test API route: ${req.method} ${url.pathname}` });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

function contentType(filePath) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' })[path.extname(filePath)] || 'application/octet-stream';
}

async function startStaticServer() {
  assert.ok(fs.existsSync(path.join(staticRoot, 'dashboard', 'index.html')), 'build the landing static export before running this E2E test');
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    let filePath = path.resolve(staticRoot, `.${pathname}`);
    if (!filePath.startsWith(`${staticRoot}${path.sep}`)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath) && !path.extname(filePath)) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

async function main() {
  const { server: apiServer, port: apiPort } = await startApiServer();
  const { server: staticServer, port: appPort } = await startStaticServer();
  const appUrl = `http://127.0.0.1:${appPort}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route(`${cloudOrigin}/**`, async (route) => {
      const request = route.request();
      const targetUrl = new URL(request.url());
      const headers = { ...request.headers() };
      delete headers.host;
      const response = await fetch(`http://127.0.0.1:${apiPort}${targetUrl.pathname}${targetUrl.search}`, {
        method: request.method(),
        headers,
        body: ['GET', 'HEAD', 'OPTIONS'].includes(request.method()) ? undefined : request.postData() || undefined,
      });
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers.entries()), body: Buffer.from(await response.arrayBuffer()) });
    });
    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (msg) => { if (msg.type() === 'error' || msg.text().includes('Dashboard]')) console.error('Browser console:', msg.type(), msg.text()); });
    page.on('requestfailed', (request) => console.error('Browser request failed:', request.url(), request.failure()?.errorText));

    await page.goto(`${appUrl}/dashboard`);
    await page.evaluate(() => localStorage.setItem('orderitup_auth_user', JSON.stringify({
      id: 'e2e-user', name: 'E2E Cashier', email: 'cashier@example.test', role: 'server',
      organizationId: 'org-e2e', organizationName: 'E2E Restaurant', token: 'e2e-cloud-token-with-enough-length',
    })));
    await page.reload();
    try {
      await page.getByRole('heading', { name: 'Live restaurant operations' }).waitFor();
    } catch (error) {
      console.error('E2E page diagnostic:', { url: page.url(), title: await page.title(), text: (await page.locator('body').innerText()).slice(0, 1200), scripts: await page.locator('script').evaluateAll((scripts) => scripts.map((script) => script.src).filter(Boolean)), storage: await page.evaluate(() => localStorage.getItem('orderitup_auth_user')), pageErrors });
      throw error;
    }
    await page.getByRole('heading', { name: 'Create waiter order' }).waitFor();
    await page.getByLabel('Item').selectOption('product-1');
    await page.getByRole('button', { name: 'Add item to order' }).click();
    await page.getByRole('button', { name: 'Send order to kitchen' }).click();
    await page.getByText(/Order C-101 was accepted by Cloud/).waitFor();
    const createRequest = requests.find((request) => request.method === 'POST' && request.path === '/api/orders');
    assert.ok(createRequest, 'waiter order must be sent to the Cloud order endpoint');
    assert.equal(createRequest.auth, 'Bearer e2e-cloud-token-with-enough-length');
    const sentOrder = await page.evaluate(() => window.localStorage.getItem('orderitup.pending-order:e2e-user:branch-1'));
    assert.equal(sentOrder, null, 'confirmed orders must clear the pending retry record');

    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('orderitup_auth_user'));
      localStorage.setItem('orderitup_auth_user', JSON.stringify({ ...user, role: 'chef' }));
    });
    await page.reload();
    await page.getByRole('heading', { name: 'Kitchen queue' }).waitFor();
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByText(/Ticket for C-100 moved to preparing/).waitFor();
    assert.ok(requests.some((request) => request.method === 'PATCH' && request.path === '/api/kitchen/tickets/ticket-100/status'));

    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('orderitup_auth_user'));
      localStorage.setItem('orderitup_auth_user', JSON.stringify({ ...user, role: 'cashier' }));
    });
    await page.reload();
    await page.getByRole('heading', { name: 'Cashier payment queue' }).waitFor();
    await page.getByRole('button', { name: 'Collect cash' }).first().click();
    await page.getByText(/Cash transaction recorded for/).waitFor();
    assert.ok(requests.some((request) => request.method === 'POST' && /\/api\/orders\/[^/]+\/payments$/.test(request.path)));
    assert.ok(requests.some((request) => request.method === 'PATCH' && /\/api\/orders\/[^/]+\/status$/.test(request.path)));

    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('orderitup_auth_user'));
      localStorage.setItem('orderitup_auth_user', JSON.stringify({ ...user, role: 'accountant' }));
    });
    const accountantCallStart = requests.length;
    await page.reload();
    await page.getByRole('heading', { name: 'Tax summary from Cloud' }).waitFor();
    await page.getByRole('cell', { name: 'E2E Branch' }).waitFor();
    assert.ok(requests.slice(accountantCallStart).some((request) => request.path === '/api/accountant/tax-summary'));
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log('Landing Cloud workspace E2E passed: waiter → kitchen → cashier → accountant.');
  } finally {
    if (browser) await browser.close();
    apiServer.close();
    staticServer.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
