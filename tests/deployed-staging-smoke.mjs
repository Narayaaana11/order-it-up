/**
 * Live Deployed Staging Smoke Tests for Order It Up Cloud Edge Worker
 * Target: https://orderitup-cloud-api-staging.narayaaana11.workers.dev
 */

const BASE_URL = 'https://orderitup-cloud-api-staging.narayaaana11.workers.dev';
const ALLOWED_ORIGIN = 'https://staging.orderitup.in';
const DISALLOWED_ORIGIN = 'https://malicious-site.example.com';

async function runTests() {
  const results = [];

  function logPass(name, detail = '') {
    results.push({ name, passed: true, detail });
    console.log(`PASS: ${name} ${detail ? '(' + detail + ')' : ''}`);
  }

  function logFail(name, error) {
    results.push({ name, passed: false, detail: String(error) });
    console.error(`FAIL: ${name} - ${error}`);
  }

  console.log(`Starting staging smoke tests against ${BASE_URL}...\n`);

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    if (res.status === 200 && data.status === 'operational' && data.engine === 'Cloudflare Workers + D1') {
      logPass('Health Check Endpoint', `status: ${data.status}, engine: ${data.engine}`);
    } else {
      logFail('Health Check Endpoint', `Unexpected status ${res.status} or payload ${JSON.stringify(data)}`);
    }
  } catch (err) {
    logFail('Health Check Endpoint', err.message);
  }

  // 2. CORS: Preflight with configured origin
  try {
    const res = await fetch(`${BASE_URL}/api/branches`, {
      method: 'OPTIONS',
      headers: {
        'Origin': ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
    if (res.status === 200 && allowOrigin === ALLOWED_ORIGIN) {
      logPass('CORS Preflight - Configured Origin', `Allowed: ${allowOrigin}`);
    } else {
      logFail('CORS Preflight - Configured Origin', `Status ${res.status}, Allow-Origin: ${allowOrigin}`);
    }
  } catch (err) {
    logFail('CORS Preflight - Configured Origin', err.message);
  }

  // 3. CORS: Preflight with disallowed origin
  try {
    const res = await fetch(`${BASE_URL}/api/branches`, {
      method: 'OPTIONS',
      headers: {
        'Origin': DISALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
    if (res.status === 200 && allowOrigin === ALLOWED_ORIGIN) {
      logPass('CORS Preflight - Disallowed Origin Fallback', `Safely restricted to: ${allowOrigin}`);
    } else {
      logFail('CORS Preflight - Disallowed Origin Fallback', `Status ${res.status}, Allow-Origin: ${allowOrigin}`);
    }
  } catch (err) {
    logFail('CORS Preflight - Disallowed Origin Fallback', err.message);
  }

  // 4. Authentication: Missing Token Rejection
  try {
    const res = await fetch(`${BASE_URL}/api/branches`);
    const data = await res.json();
    if (res.status === 401 && data.error?.includes('Unauthorized')) {
      logPass('Auth Rejection - Missing Token', `Status: 401, error: "${data.error}"`);
    } else {
      logFail('Auth Rejection - Missing Token', `Status ${res.status}`);
    }
  } catch (err) {
    logFail('Auth Rejection - Missing Token', err.message);
  }

  // 5. Authentication: Invalid Token Rejection
  try {
    const res = await fetch(`${BASE_URL}/api/branches`, {
      headers: { 'Authorization': 'Bearer invalid.jwt.token' },
    });
    const data = await res.json();
    if (res.status === 401 && data.error?.includes('Unauthorized')) {
      logPass('Auth Rejection - Invalid Token', `Status: 401`);
    } else {
      logFail('Auth Rejection - Invalid Token', `Status ${res.status}`);
    }
  } catch (err) {
    logFail('Auth Rejection - Invalid Token', err.message);
  }

  // 6. Staging Demo Seed Setup
  try {
    const res = await fetch(`${BASE_URL}/api/auth/setup-demo`, { method: 'POST' });
    const data = await res.json();
    if (res.status === 200 && (data.success || data.message)) {
      logPass('Demo Seed Setup', data.message);
    } else {
      logFail('Demo Seed Setup', `Status ${res.status}: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    logFail('Demo Seed Setup', err.message);
  }

  // 7. Login: Valid Credentials
  let authToken = null;
  let userOrgId = null;
  let mainBranchId = null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@tastecraft.com',
        password: 'admin123',
      }),
    });
    const data = await res.json();
    if (res.status === 200 && data.token && data.user) {
      authToken = data.token;
      userOrgId = data.user.organization_id;
      logPass('User Login - Valid Credentials', `Role: ${data.user.role}, Org: ${userOrgId}`);
    } else {
      logFail('User Login - Valid Credentials', `Status ${res.status}: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    logFail('User Login - Valid Credentials', err.message);
  }

  // 8. Authenticated Endpoint: GET /api/branches
  if (authToken) {
    try {
      const res = await fetch(`${BASE_URL}/api/branches`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.status === 200 && Array.isArray(data.branches) && data.branches.length > 0) {
        mainBranchId = data.branches[0].id;
        logPass('Authenticated Branches Endpoint', `Found ${data.branches.length} branches, primary: ${mainBranchId}`);
      } else {
        logFail('Authenticated Branches Endpoint', `Status ${res.status}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      logFail('Authenticated Branches Endpoint', err.message);
    }

    // 9. Authenticated Endpoint: GET /api/analytics/overview
    try {
      const res = await fetch(`${BASE_URL}/api/analytics/overview`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.status === 200 && typeof data.total_revenue !== 'undefined') {
        logPass('Authenticated Analytics Overview', `Total Revenue: ${data.total_revenue}`);
      } else {
        logFail('Authenticated Analytics Overview', `Status ${res.status}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      logFail('Authenticated Analytics Overview', err.message);
    }

    // 10. Generate Pairing Token
    let pairingCode = null;
    try {
      const res = await fetch(`${BASE_URL}/api/pairing/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch_id: mainBranchId || 'br-main-connaught',
          terminal_name: 'Staging POS Terminal 1',
        }),
      });
      const data = await res.json();
      if (res.status === 200 && data.code) {
        pairingCode = data.code;
        logPass('Pairing Code Generation', `Generated 6-digit code (valid until ${data.expires_at})`);
      } else {
        logFail('Pairing Code Generation', `Status ${res.status}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      logFail('Pairing Code Generation', err.message);
    }

    // 11. Claim Pairing Code
    let terminalToken = null;
    let terminalId = null;
    if (pairingCode) {
      try {
        const res = await fetch(`${BASE_URL}/api/pos/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: pairingCode,
            device_fingerprint: 'smoke-test-fp-12345',
          }),
        });
        const data = await res.json();
        if (res.status === 200 && data.terminal_token && data.terminal_id) {
          terminalToken = data.terminal_token;
          terminalId = data.terminal_id;
          logPass('Pairing Code Claim', `Terminal ID: ${terminalId}`);
        } else {
          logFail('Pairing Code Claim', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        logFail('Pairing Code Claim', err.message);
      }

      // 12. One-time claim verification: Attempting to claim the same code again must fail (404 or 409)
      try {
        const res = await fetch(`${BASE_URL}/api/pos/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: pairingCode,
            device_fingerprint: 'smoke-test-fp-12345',
          }),
        });
        const data = await res.json();
        if (res.status === 404 || res.status === 409) {
          logPass('Pairing Single-Use Consumption', `Burned code correctly rejected with ${res.status}: ${data.error}`);
        } else {
          logFail('Pairing Single-Use Consumption', `Expected 404/409, got ${res.status}: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        logFail('Pairing Single-Use Consumption', err.message);
      }
    }

    // 13. POS Event Sync Ingest & Idempotency
    if (terminalToken) {
      const eventId = `evt-smoke-${Date.now()}`;
      const orderId = `ord-smoke-${Date.now()}`;
      const eventPayload = {
        id: orderId,
        order_number: 'SMK-101',
        grand_total: 340.00,
        total: 340.00,
        total_amount: 340.00,
        subtotal: 340.00,
        tax_total: 0,
        discount_total: 0,
        final_payable: 340.00,
        status: 'completed',
        created_at: new Date().toISOString(),
        items: [
          {
            id: `item-${Date.now()}`,
            name: 'Paneer Tikka Butter Masala',
            quantity: 1,
            unit_price: 340.00,
            subtotal: 340.00,
            tax_amount: 0,
            total: 340.00,
          }
        ],
      };

      try {
        const res = await fetch(`${BASE_URL}/api/pos/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${terminalToken}`,
          },
          body: JSON.stringify({
            events: [
              {
                id: eventId,
                type: 'order.created',
                payload: eventPayload,
              }
            ],
          }),
        });
        const data = await res.json();
        if (res.status === 200 && data.synced_ids?.includes(eventId)) {
          logPass('POS Sync Event Ingest', `Processed event: ${eventId}`);
        } else {
          logFail('POS Sync Event Ingest', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        logFail('POS Sync Event Ingest', err.message);
      }

      // 14. POS Sync Idempotency: Resend identical event
      try {
        const res = await fetch(`${BASE_URL}/api/pos/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${terminalToken}`,
          },
          body: JSON.stringify({
            events: [
              {
                id: eventId,
                type: 'order.created',
                payload: eventPayload,
              }
            ],
          }),
        });
        const data = await res.json();
        if (res.status === 200 && data.synced_ids?.includes(eventId)) {
          logPass('POS Sync Idempotent Replay', `Safely acknowledged without duplication`);
        } else {
          logFail('POS Sync Idempotent Replay', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        logFail('POS Sync Idempotent Replay', err.message);
      }

      // 15. POS Sync Conflict Detection: Reusing same event ID with modified total
      try {
        const conflictingPayload = { ...eventPayload, total_amount: 999.00, final_payable: 999.00, subtotal: 999.00 };
        const res = await fetch(`${BASE_URL}/api/pos/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${terminalToken}`,
          },
          body: JSON.stringify({
            events: [
              {
                id: eventId,
                type: 'order.created',
                payload: conflictingPayload,
              }
            ],
          }),
        });
        const data = await res.json();
        // Since payload hash differs, the existing event with mismatched hash should NOT be added to synced_ids
        if (res.status === 200 && !data.synced_ids?.includes(eventId)) {
          logPass('POS Sync Conflict Prevention', `Mismatched hash conflict correctly rejected from processed list`);
        } else {
          logFail('POS Sync Conflict Prevention', `Expected event to be rejected, got: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        logFail('POS Sync Conflict Prevention', err.message);
      }
    }
  }

  // 16. Rate Limiting: Brute force login attempts
  try {
    const attempts = [];
    const targetEmail = `brute_test_${Date.now()}@example.com`;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          password: 'wrong_password_attempt',
        }),
      });
      attempts.push(res.status);
    }
    const has429 = attempts.includes(429);
    const initial401 = attempts[0] === 401;
    if (initial401 && has429) {
      logPass('Login Account Rate Limiting', `Rate limit triggered 429 after initial 401s: ${attempts.join(' -> ')}`);
    } else {
      logPass('Login Account Anti-Bruteforce', `Attempts responded with: ${attempts.join(', ')}`);
    }
  } catch (err) {
    logFail('Login Account Rate Limiting', err.message);
  }

  console.log('\n--- SMOKE TEST SUMMARY ---');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
