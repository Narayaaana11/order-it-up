const http = require('http');

function checkUrl(url, name) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        console.log(`[${name}] ${url} -> Status: ${res.statusCode}, Body length: ${body.length}`);
        if (body.startsWith('{')) {
          console.log(`  Preview: ${body.slice(0, 120)}`);
        } else {
          console.log(`  Snippet: ${body.slice(0, 80).replace(/\r?\n/g, ' ')}`);
        }
        resolve(res.statusCode < 400);
      });
    }).on('error', (err) => {
      console.error(`[${name}] ${url} -> ERROR: ${err.message}`);
      resolve(false);
    });
  });
}

(async () => {
  const checks = [
    { url: 'http://127.0.0.1:3001/api/health', name: 'API Health Check' },
    { url: 'http://127.0.0.1:3001/', name: 'Main POS UI' },
    { url: 'http://127.0.0.1:3001/pos/', name: 'POS Cashier Register' },
    { url: 'http://127.0.0.1:3001/dashboard/', name: 'Manager / Analytics Dashboard' },
    { url: 'http://127.0.0.1:3001/inventory/', name: 'Recipe & Ingredient Inventory' },
    { url: 'http://127.0.0.1:3001/audit-logs/', name: 'Tamper-Evident Audit Logs' },
    { url: 'http://127.0.0.1:3001/orders/', name: 'Order Management' },
    { url: 'http://127.0.0.1:3001/tables/', name: 'Floor & Table Management' },
    { url: 'http://127.0.0.1:3001/settings/', name: 'Store Settings' },
    { url: 'http://127.0.0.1:3002/', name: 'Standalone KDS Service' },
    { url: 'http://127.0.0.1:3003/', name: 'Server / Waiter Tablet Service' },
    { url: 'http://127.0.0.1:3004/', name: 'Customer Web Landing' },
    { url: 'http://127.0.0.1:3004/demo/table-1/', name: 'Customer QR Table Menu' },
  ];

  let passed = 0;
  for (const c of checks) {
    const ok = await checkUrl(c.url, c.name);
    if (ok) passed++;
  }

  console.log(`\n=== Verification Results: ${passed}/${checks.length} OK ===`);
  process.exit(passed === checks.length ? 0 : 1);
})();
