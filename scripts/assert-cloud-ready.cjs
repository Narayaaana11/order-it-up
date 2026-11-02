const url = process.env.CLOUD_READY_URL || 'https://orderitup-cloud-api.narayaaana11.workers.dev/ready';

async function main() {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new Error(`Cloud readiness request failed: ${error instanceof Error ? error.message : 'network error'}`);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status !== 'ready') {
    const state = typeof body?.status === 'string' ? body.status : 'unknown';
    throw new Error(`Cloud API is not ready (${response.status}, status=${state}); Pages deployment was stopped`);
  }

  console.log(`Cloud API readiness confirmed at ${url}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
