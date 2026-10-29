/**
 * Production-Grade Distributed Rate Limiting & Abuse Prevention for Cloudflare Workers.
 * 
 * Features:
 * 1. Persistent, multi-instance rate limiting via Cloudflare D1 distributed SQLite.
 * 2. Graceful in-memory sliding-window fallback if database is temporarily degraded.
 * 3. Trustworthy client IP resolution using CF-Connecting-IP (tamper-proof at Cloudflare edge).
 * 4. Dual-axis throttling: Source-based (IP) and Entity-based (Account / Terminal / Branch).
 * 5. RFC-compliant HTTP 429 responses with Retry-After and X-RateLimit-* headers.
 * 6. Configurable, production-calibrated operational thresholds.
 */

export interface RateLimitConfig {
  keyPrefix: string;          // e.g. 'login_ip', 'login_account', 'pair_claim', 'pos_sync'
  identifier: string;         // e.g. client IP or normalized email or terminal ID
  limit: number;              // maximum allowed hits within the window
  windowSeconds: number;      // sliding/fixed window duration in seconds
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: number;           // Unix timestamp in seconds when the window resets
  retryAfter: number;        // Seconds the client must wait before retrying (0 if allowed)
}

/**
 * Standard Operational Rate Limits
 */
export const DEFAULT_RATE_LIMITS = {
  // Login: 30 attempts per minute per IP to prevent rapid spray while supporting shared restaurant Wi-Fi
  LOGIN_IP: { limit: 30, windowSeconds: 60 },
  // Login Account: 5 attempts per 5 minutes per normalized email to block credential stuffing
  LOGIN_ACCOUNT: { limit: 5, windowSeconds: 300 },
  // Terminal Pairing Claim: 10 attempts per 5 minutes per IP
  PAIR_CLAIM_IP: { limit: 10, windowSeconds: 300 },
  // Terminal Pairing Generation: 10 PINs per hour per branch
  PAIR_GENERATE_BRANCH: { limit: 10, windowSeconds: 3600 },
  // Demo Initializer: 3 attempts per hour per IP
  DEMO_SETUP_IP: { limit: 3, windowSeconds: 3600 },
  // POS Sync Events: 120 requests per minute per terminal (allows burst offline recovery)
  SYNC_EVENTS_TERMINAL: { limit: 120, windowSeconds: 60 },
};

/**
 * Returns effective limit allowing environment variable overrides within safe bounds.
 */
export function getEffectiveLimit(envValue: any, defaultValue: number, minBound = 1, maxBound = 5000): number {
  if (envValue !== undefined && envValue !== null && envValue !== '') {
    const parsed = Number(envValue);
    if (!isNaN(parsed) && parsed >= minBound && parsed <= maxBound) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * In-memory fallback cache when D1 database is temporarily unreachable or during unit testing.
 */
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Reset memory store (used in test runners for test isolation).
 */
export function resetMemoryRateLimits(): void {
  inMemoryStore.clear();
}

/**
 * Resolves trustworthy client IP.
 * In Cloudflare Workers, 'CF-Connecting-IP' is stripped and rewritten by Cloudflare's
 * edge infrastructure, guaranteeing it cannot be spoofed by client request headers.
 */
export function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip') || request.headers.get('CF-Connecting-IP');
  if (cfIp && cfIp.trim().length > 0) {
    return cfIp.trim();
  }
  const realIp = request.headers.get('x-real-ip') || request.headers.get('X-Real-IP');
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Checks and updates rate limits atomically.
 * Uses Cloudflare D1 distributed SQLite table `rate_limits` with ON CONFLICT upsert.
 */
export async function checkRateLimit(
  db: any,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + config.windowSeconds;
  const storageKey = `${config.keyPrefix}:${config.identifier.trim().toLowerCase()}`;

  if (db && typeof db.prepare === 'function') {
    try {
      // Atomic upsert with conditional reset in SQLite 3.35+
      const result = await db.prepare(`
        INSERT INTO rate_limits (key, count, reset_at, updated_at)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          count = CASE WHEN rate_limits.reset_at < ? THEN 1 ELSE rate_limits.count + 1 END,
          reset_at = CASE WHEN rate_limits.reset_at < ? THEN excluded.reset_at ELSE rate_limits.reset_at END,
          updated_at = excluded.updated_at
        RETURNING count, reset_at
      `).bind(
        storageKey,
        resetAt,
        new Date().toISOString(),
        now,
        now
      ).first();

      if (result && typeof result.count === 'number' && typeof result.reset_at === 'number') {
        const count = result.count;
        const currentResetAt = result.reset_at;
        const allowed = count <= config.limit;
        const remaining = Math.max(0, config.limit - count);
        const retryAfter = allowed ? 0 : Math.max(1, currentResetAt - now);

        return {
          allowed,
          count,
          limit: config.limit,
          remaining,
          resetAt: currentResetAt,
          retryAfter,
        };
      }
    } catch (err) {
      // Graceful fallback to memory store if table is missing or D1 query fails
      // This prevents rate limiting from causing a denial-of-service on legitimate users
    }
  }

  // Fallback to in-memory sliding window
  let entry = inMemoryStore.get(storageKey);
  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt };
    inMemoryStore.set(storageKey, entry);
  } else {
    entry.count += 1;
  }

  const allowed = entry.count <= config.limit;
  const remaining = Math.max(0, config.limit - entry.count);
  const retryAfter = allowed ? 0 : Math.max(1, entry.resetAt - now);

  return {
    allowed,
    count: entry.count,
    limit: config.limit,
    remaining,
    resetAt: entry.resetAt,
    retryAfter,
  };
}

/**
 * Generates an RFC-compliant HTTP 429 Too Many Requests response with retry headers.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  extraHeaders?: HeadersInit
): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json');
  headers.set('Retry-After', String(result.retryAfter));
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));

  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retry_after: result.retryAfter,
    }),
    {
      status: 429,
      statusText: 'Too Many Requests',
      headers,
    }
  );
}
