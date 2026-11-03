const endpoint = process.env.CLOUD_PILOT_PREFLIGHT_URL ||
  'https://orderitup-cloud-api.narayaaana11.workers.dev/api/pilot-requests';
const origin = process.env.CLOUD_FRONTEND_ORIGIN || 'https://orderitup.pages.dev';

async function main() {
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,idempotency-key',
      },
    });
  } catch (error) {
    throw new Error(`Cloud API CORS preflight request failed: ${error instanceof Error ? error.message : 'network error'}`);
  }

  const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
  const allowMethods = (response.headers.get('Access-Control-Allow-Methods') || '')
    .split(',').map((value) => value.trim().toUpperCase());
  const allowHeaders = (response.headers.get('Access-Control-Allow-Headers') || '')
    .split(',').map((value) => value.trim().toLowerCase());

  if (!response.ok) {
    throw new Error(`Cloud API CORS preflight returned HTTP ${response.status}`);
  }
  if (allowOrigin !== origin) {
    throw new Error(`Cloud API CORS allowed origin mismatch (received ${allowOrigin || 'none'})`);
  }
  if (!allowMethods.includes('POST')) {
    throw new Error('Cloud API CORS preflight does not allow POST');
  }
  for (const required of ['content-type', 'idempotency-key']) {
    if (!allowHeaders.includes(required)) {
      throw new Error(`Cloud API CORS preflight does not allow required header: ${required}`);
    }
  }

  console.log(`Cloud API CORS preflight confirmed for ${origin}; POST permits Content-Type and Idempotency-Key.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
