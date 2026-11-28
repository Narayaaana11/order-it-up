/**
 * Zero-dependency, offline-first adapters for free-tier observability,
 * heartbeat monitoring, product analytics, feature flags, and LLM tracing.
 * All helpers no-op gracefully when unconfigured or offline.
 */

const DEFAULT_TIMEOUT_MS = 5000;

function isOfflineMode(): boolean {
  return process.env.FLO_MATRIX_OFFLINE === '1';
}

export interface ParsedSentryDsn {
  endpoint: string;
  publicKey: string;
  projectId: string;
}

/** Parse a Sentry/GlitchTip/Bugsink DSN into its HTTP envelope endpoint. */
export function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
  if (!dsn || typeof dsn !== 'string') return null;
  try {
    const url = new URL(dsn.trim());
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, '').split('/')[0];
    if (!publicKey || !projectId || !url.host) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey,
      projectId,
    };
  } catch {
    return null;
  }
}

/** Send an exception event to Sentry/GlitchTip/Bugsink via the HTTP Envelope API. */
export async function captureSentryException(
  error: unknown,
  context?: { dsn?: string; environment?: string; release?: string; tags?: Record<string, string> }
): Promise<boolean> {
  if (isOfflineMode()) return false;
  const rawDsn = context?.dsn ?? process.env.OIU_SENTRY_DSN ?? process.env.SENTRY_DSN ?? '';
  const parsed = parseSentryDsn(rawDsn);
  if (!parsed) return false;

  const errObj = error instanceof Error ? error : new Error(String(error));
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const sentAt = new Date().toISOString();

  const header = JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn: rawDsn });
  const itemHeader = JSON.stringify({ type: 'event' });
  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: Math.floor(Date.now() / 1000),
    platform: 'node',
    level: 'error',
    environment: context?.environment || process.env.NODE_ENV || 'production',
    ...(context?.release ? { release: context.release } : {}),
    ...(context?.tags ? { tags: context.tags } : {}),
    exception: {
      values: [
        {
          type: errObj.name || 'Error',
          value: errObj.message || 'Unknown error',
        },
      ],
    },
  });

  try {
    const res = await fetch(parsed.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=oiu-fetch/1.0`,
      },
      body: `${header}\n${itemHeader}\n${payload}\n`,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => {});
    return res.ok;
  } catch {
    return false;
  }
}

/** Ping a Healthchecks.io or Watchgoose heartbeat URL (appends /fail on failure). */
export async function pingHeartbeat(url: string | undefined, status: 'ok' | 'fail' = 'ok'): Promise<boolean> {
  if (isOfflineMode() || !url) return false;
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return false;
  const target = status === 'fail' ? `${trimmed}/fail` : trimmed;
  try {
    const res = await fetch(target, {
      method: 'GET',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => {});
    return res.ok;
  } catch {
    return false;
  }
}

/** Send an anonymous product analytics event to Aptabase (Electron/Desktop/Mobile). */
export async function trackAptabaseEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>,
  options?: { appKey?: string; host?: string; sessionId?: string; appVersion?: string }
): Promise<boolean> {
  if (isOfflineMode()) return false;
  const appKey = options?.appKey ?? process.env.OIU_APTABASE_APP_KEY ?? '';
  if (!appKey) return false;

  const region = appKey.split('-')[1]?.toLowerCase();
  const defaultHost = region === 'eu' ? 'https://eu.aptabase.com' : 'https://us.aptabase.com';
  const host = (options?.host ?? process.env.OIU_APTABASE_HOST ?? defaultHost).replace(/\/+$/, '');

  try {
    const res = await fetch(`${host}/api/v0/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Key': appKey,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: options?.sessionId || crypto.randomUUID(),
        eventName,
        systemProps: {
          osName: process.platform,
          appVersion: options?.appVersion || '1.0.0',
          isDebug: process.env.NODE_ENV !== 'production',
        },
        props: props || {},
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => {});
    return res.ok;
  } catch {
    return false;
  }
}

/** Send a product analytics event to PostHog. */
export async function trackPostHogEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
  options?: { apiKey?: string; host?: string }
): Promise<boolean> {
  if (isOfflineMode()) return false;
  const apiKey = options?.apiKey ?? process.env.OIU_POSTHOG_API_KEY ?? '';
  if (!apiKey) return false;
  const host = (options?.host ?? process.env.OIU_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/+$/, '');

  try {
    const res = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: properties || {},
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => {});
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch GrowthBook feature flags with offline-safe default fallback. */
export async function getFeatureFlags(
  defaults: Record<string, boolean | string | number> = {},
  options?: { clientKey?: string; apiHost?: string }
): Promise<Record<string, boolean | string | number>> {
  if (isOfflineMode()) return { ...defaults };
  const clientKey = options?.clientKey ?? process.env.OIU_GROWTHBOOK_CLIENT_KEY ?? '';
  if (!clientKey) return { ...defaults };
  const host = (options?.apiHost ?? process.env.OIU_GROWTHBOOK_HOST ?? 'https://cdn.growthbook.io').replace(/\/+$/, '');

  try {
    const res = await fetch(`${host}/api/features/${encodeURIComponent(clientKey)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return { ...defaults };
    const data = (await res.json()) as { features?: Record<string, { defaultValue?: boolean | string | number }> };
    const resolved = { ...defaults };
    if (data?.features && typeof data.features === 'object') {
      for (const [key, def] of Object.entries(data.features)) {
        if (def && def.defaultValue !== undefined) {
          resolved[key] = def.defaultValue;
        }
      }
    }
    return resolved;
  } catch {
    return { ...defaults };
  }
}

/** Record an LLM generation trace in Langfuse when configured. */
export async function recordLangfuseTrace(params: {
  name: string;
  model: string;
  latencyMs: number;
  input?: unknown;
  output?: string;
  publicKey?: string;
  secretKey?: string;
  host?: string;
}): Promise<boolean> {
  if (isOfflineMode()) return false;
  const publicKey = params.publicKey ?? process.env.LANGFUSE_PUBLIC_KEY ?? '';
  const secretKey = params.secretKey ?? process.env.LANGFUSE_SECRET_KEY ?? '';
  if (!publicKey || !secretKey) return false;

  const host = (params.host ?? process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com').replace(/\/+$/, '');
  const nowIso = new Date().toISOString();
  const startIso = new Date(Date.now() - Math.max(0, params.latencyMs)).toISOString();
  const traceId = crypto.randomUUID();
  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

  try {
    const res = await fetch(`${host}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        batch: [
          {
            id: crypto.randomUUID(),
            type: 'trace-create',
            timestamp: nowIso,
            body: { id: traceId, name: params.name },
          },
          {
            id: crypto.randomUUID(),
            type: 'generation-create',
            timestamp: nowIso,
            body: {
              id: crypto.randomUUID(),
              traceId,
              name: params.name,
              model: params.model,
              startTime: startIso,
              endTime: nowIso,
              input: params.input,
              output: params.output,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => {});
    return res.ok;
  } catch {
    return false;
  }
}
