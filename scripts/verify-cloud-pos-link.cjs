const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  try {
    const home = await get('http://127.0.0.1:3004/');
    console.log('Homepage status:', home.status);
    console.log('Homepage contains "Cloud POS":', home.body.includes('Cloud POS'));
    console.log('Homepage contains "http://localhost:3001/":', home.body.includes('http://localhost:3001/'));

    const redirectPage = await get('http://127.0.0.1:3004/cloud-pos/');
    console.log('/cloud-pos/ status:', redirectPage.status);
    console.log('/cloud-pos/ contains "Redirecting to Order It Up Cloud POS":', redirectPage.body.includes('Redirecting to Order It Up Cloud POS'));
    console.log('/cloud-pos/ contains "http://localhost:3001/":', redirectPage.body.includes('http://localhost:3001/'));

    const allOk = home.body.includes('Cloud POS') && home.body.includes('http://localhost:3001/') && redirectPage.status === 200;
    console.log('All link checks passed:', allOk);
    process.exit(allOk ? 0 : 1);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
})();
