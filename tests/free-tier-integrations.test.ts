import assert from 'node:assert/strict';
import { getEmailProvider } from '../main/services/email-provider';
import {
  parseSentryDsn,
  captureSentryException,
  pingHeartbeat,
  trackAptabaseEvent,
  trackPostHogEvent,
  getFeatureFlags,
  recordLangfuseTrace,
} from '../main/services/free-tier-observability';

async function run(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const savedEnv = { ...process.env };

  try {
    // 1. Sentry DSN parsing
    const parsed = parseSentryDsn('https://abc123@o123.ingest.sentry.io/456789');
    assert.deepEqual(parsed, {
      endpoint: 'https://o123.ingest.sentry.io/api/456789/envelope/',
      publicKey: 'abc123',
      projectId: '456789',
    });
    assert.equal(parseSentryDsn('not-a-dsn'), null);

    // 2. Unconfigured providers no-op gracefully
    delete process.env.OIU_SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    delete process.env.OIU_APTABASE_APP_KEY;
    delete process.env.OIU_POSTHOG_API_KEY;
    delete process.env.OIU_GROWTHBOOK_CLIENT_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;

    assert.equal(await captureSentryException(new Error('test')), false);
    assert.equal(await pingHeartbeat(undefined), false);
    assert.equal(await trackAptabaseEvent('test_event'), false);
    assert.equal(await trackPostHogEvent('user_1', 'test_event'), false);
    assert.equal(await recordLangfuseTrace({ name: 'test', model: 'm', latencyMs: 10 }), false);
    assert.deepEqual(await getFeatureFlags({ beta_kds: false }), { beta_kds: false });

    // 3. Mock fetch to verify outgoing requests for Resend, Brevo, Sentry, Heartbeat, Aptabase, PostHog, GrowthBook, Langfuse
    const calls: Array<{ url: string; method?: string; headers?: Record<string, string>; body?: string }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method,
        headers: (init?.headers as Record<string, string>) || {},
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      if (String(input).includes('cdn.growthbook.io')) {
        return new Response(JSON.stringify({ features: { beta_kds: { defaultValue: true } } }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'ok_123', messageId: 'brevo_123' }), { status: 200 });
    }) as typeof fetch;

    // Resend email provider
    process.env.RESEND_API_KEY = 're_test_key';
    delete process.env.BREVO_API_KEY;
    const resendResult = await getEmailProvider().sendEmail({
      to: 'owner@example.com',
      subject: 'Test Bill',
      text: 'Hello',
    });
    assert.equal(resendResult.success, true);
    assert.equal(resendResult.messageId, 'ok_123');
    assert.equal(calls.at(-1)?.url, 'https://api.resend.com/emails');

    // Brevo email provider
    delete process.env.RESEND_API_KEY;
    process.env.BREVO_API_KEY = 'xkeysib_test_key';
    const brevoResult = await getEmailProvider().sendEmail({
      to: 'owner@example.com',
      subject: 'Test Bill',
      text: 'Hello',
    });
    assert.equal(brevoResult.success, true);
    assert.equal(brevoResult.messageId, 'brevo_123');
    assert.equal(calls.at(-1)?.url, 'https://api.brevo.com/v3/smtp/email');

    // Sentry envelope
    const sentSentry = await captureSentryException(new Error('Boom'), {
      dsn: 'https://pub@glitchtip.example.com/42',
    });
    assert.equal(sentSentry, true);
    assert.equal(calls.at(-1)?.url, 'https://glitchtip.example.com/api/42/envelope/');

    // Healthchecks.io ok & fail
    assert.equal(await pingHeartbeat('https://hc-ping.com/uuid-1/', 'ok'), true);
    assert.equal(calls.at(-1)?.url, 'https://hc-ping.com/uuid-1');
    assert.equal(await pingHeartbeat('https://hc-ping.com/uuid-1/', 'fail'), true);
    assert.equal(calls.at(-1)?.url, 'https://hc-ping.com/uuid-1/fail');

    // Aptabase EU region routing
    assert.equal(await trackAptabaseEvent('pos_order_paid', { amount: 500 }, { appKey: 'A-EU-12345' }), true);
    assert.equal(calls.at(-1)?.url, 'https://eu.aptabase.com/api/v0/event');

    // PostHog capture
    assert.equal(await trackPostHogEvent('org_1', 'qr_order_placed', { total: 350 }, { apiKey: 'phc_123' }), true);
    assert.equal(calls.at(-1)?.url, 'https://us.i.posthog.com/capture/');

    // GrowthBook flags
    const flags = await getFeatureFlags({ beta_kds: false, timeout: 30 }, { clientKey: 'sdk_123' });
    assert.deepEqual(flags, { beta_kds: true, timeout: 30 });

    // Langfuse ingestion
    assert.equal(
      await recordLangfuseTrace({
        name: 'sommelier',
        model: 'llama-3.3',
        latencyMs: 120,
        publicKey: 'pk_1',
        secretKey: 'sk_1',
      }),
      true
    );
    assert.equal(calls.at(-1)?.url, 'https://cloud.langfuse.com/api/public/ingestion');

    // 4. Offline mode blocks all network calls
    process.env.FLO_MATRIX_OFFLINE = '1';
    const prevCallCount = calls.length;
    assert.equal(await pingHeartbeat('https://hc-ping.com/uuid-1', 'ok'), false);
    assert.equal(await captureSentryException(new Error('offline'), { dsn: 'https://pub@host/1' }), false);
    assert.equal(calls.length, prevCallCount);

    console.log('All free-tier integration tests passed.');
  } finally {
    globalThis.fetch = originalFetch;
    process.env = savedEnv;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
