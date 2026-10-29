import { hashString } from '../auth';
import { checkRateLimit, createRateLimitResponse, getClientIp, DEFAULT_RATE_LIMITS, getEffectiveLimit } from '../rate-limit';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
  RATE_LIMIT_LOGIN_IP?: string | number;
  RATE_LIMIT_LOGIN_ACCOUNT?: string | number;
  RATE_LIMIT_PAIR_CLAIM_IP?: string | number;
  RATE_LIMIT_PAIR_GENERATE_BRANCH?: string | number;
  RATE_LIMIT_DEMO_SETUP_IP?: string | number;
  RATE_LIMIT_SYNC_EVENTS_TERMINAL?: string | number;
  FRONTEND_ORIGIN?: string;
}

export const MAX_PAIRING_CODE_ATTEMPTS = 5;

export async function handleGeneratePairing(request: Request, env: Env, orgId: string): Promise<Response> {
  const clientIp = getClientIp(request);
  const body = await request.json() as { branch_id: string; terminal_name: string };
  if (!body.branch_id || !body.terminal_name) {
    return Response.json({ error: 'branch_id and terminal_name are required' }, { status: 400 });
  }

  // 1. Rate Limit PIN Generation by Branch (max 10 per hour) to prevent code exhaustion
  const branchLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'pair_generate_branch',
    identifier: `${orgId}:${body.branch_id}`,
    limit: getEffectiveLimit(env.RATE_LIMIT_PAIR_GENERATE_BRANCH, DEFAULT_RATE_LIMITS.PAIR_GENERATE_BRANCH.limit),
    windowSeconds: DEFAULT_RATE_LIMITS.PAIR_GENERATE_BRANCH.windowSeconds,
  });
  if (!branchLimit.allowed) {
    return createRateLimitResponse(branchLimit);
  }

  // Rate Limit by IP (max 30 per hour)
  const ipLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'pair_generate_ip',
    identifier: clientIp,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!ipLimit.allowed) {
    return createRateLimitResponse(ipLimit);
  }

  // 2. Verify branch belongs strictly to requesting organization
  const branch = await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND organization_id = ?')
    .bind(body.branch_id, orgId).first<{ id: string }>();
  if (!branch) {
    return Response.json({ error: 'Branch not found or belongs to another organization' }, { status: 404 });
  }

  // 3. Generate cryptographically secure 6-digit PIN
  const randomBuf = new Uint32Array(1);
  crypto.getRandomValues(randomBuf);
  const code = (100000 + (randomBuf[0] % 900000)).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes TTL
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO pairing_tokens (code, organization_id, branch_id, terminal_name, attempts, claimed, expires_at, created_at)
    VALUES (?, ?, ?, ?, 0, 0, ?, ?)
  `).bind(code, orgId, body.branch_id, body.terminal_name.trim(), expiresAt, now).run();

  return Response.json({
    code,
    branch_id: body.branch_id,
    terminal_name: body.terminal_name.trim(),
    expires_at: expiresAt,
  });
}

export async function handleClaimPairing(request: Request, env: Env): Promise<Response> {
  const clientIp = getClientIp(request);

  // 1. Rate Limit Verification Attempts by IP (max 10 attempts per 5 minutes)
  const ipLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'pair_claim_ip',
    identifier: clientIp,
    limit: getEffectiveLimit(env.RATE_LIMIT_PAIR_CLAIM_IP, DEFAULT_RATE_LIMITS.PAIR_CLAIM_IP.limit),
    windowSeconds: DEFAULT_RATE_LIMITS.PAIR_CLAIM_IP.windowSeconds,
  });
  if (!ipLimit.allowed) {
    return createRateLimitResponse(ipLimit);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Pairing code is required' }, { status: 400 });
  }

  const rawCode = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!rawCode || !/^\d{6}$/.test(rawCode)) {
    return Response.json({ error: 'Pairing code must be a valid 6-digit numeric code' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // 2. Check token record status (expired, burned, or max attempts exceeded)
  const existingToken = await env.DB.prepare(`
    SELECT * FROM pairing_tokens WHERE code = ?
  `).bind(rawCode).first<{
    code: string;
    organization_id: string;
    branch_id: string;
    terminal_name: string;
    attempts: number;
    claimed: number;
    expires_at: string;
  }>();

  if (!existingToken) {
    return Response.json({ error: 'Invalid or expired pairing code' }, { status: 404 });
  }

  // Check if token has expired
  if (existingToken.expires_at <= nowIso) {
    await env.DB.prepare('DELETE FROM pairing_tokens WHERE code = ?').bind(rawCode).run();
    return Response.json({ error: 'Invalid or expired pairing code' }, { status: 404 });
  }

  // Check if already claimed
  if (existingToken.claimed === 1) {
    return Response.json({ error: 'Pairing code has already been redeemed' }, { status: 409 });
  }

  // Check if maximum brute-force attempts exceeded (burn code)
  if (existingToken.attempts >= MAX_PAIRING_CODE_ATTEMPTS) {
    await env.DB.prepare('DELETE FROM pairing_tokens WHERE code = ?').bind(rawCode).run();
    return Response.json({ error: 'Pairing code has exceeded maximum verification attempts' }, { status: 404 });
  }

  // 3. Atomic Single-Use Claim:
  // Simultaneously increments attempts and sets claimed = 1 under condition claimed = 0
  const claimResult = await env.DB.prepare(`
    UPDATE pairing_tokens
    SET claimed = 1, attempts = attempts + 1
    WHERE code = ? AND expires_at > ? AND claimed = 0 AND attempts < ?
  `).bind(rawCode, nowIso, MAX_PAIRING_CODE_ATTEMPTS).run();

  const changes = (claimResult as any)?.meta?.changes ?? (claimResult as any)?.changes ?? 1;
  if (changes === 0) {
    // Another concurrent request redeemed or burned this code in race condition
    return Response.json({ error: 'Pairing code has already been redeemed or invalidated' }, { status: 409 });
  }

  // 4. Generate permanent high-entropy terminal device token
  const terminalId = crypto.randomUUID();
  const rawTerminalToken = `pos_${crypto.randomUUID().replace(/-/g, '')}_${Date.now()}`;
  const tokenHash = await hashString(rawTerminalToken);

  // 5. Create terminal bound strictly to token's organization and branch
  await env.DB.prepare(`
    INSERT INTO terminals (id, organization_id, branch_id, terminal_name, terminal_token_hash, last_seen_at, app_version, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).bind(
    terminalId,
    existingToken.organization_id,
    existingToken.branch_id,
    existingToken.terminal_name,
    tokenHash,
    nowIso,
    body.app_version ? String(body.app_version).slice(0, 32) : '1.0.0',
    nowIso
  ).run();

  // 6. Token is marked claimed=1 atomically above to prevent replay attacks

  // 7. Retrieve org & branch details strictly scoped to token's organization
  const org = await env.DB.prepare('SELECT name, currency, timezone FROM organizations WHERE id = ?')
    .bind(existingToken.organization_id).first<{ name: string; currency: string; timezone: string }>();
  const branch = await env.DB.prepare('SELECT name FROM branches WHERE id = ? AND organization_id = ?')
    .bind(existingToken.branch_id, existingToken.organization_id).first<{ name: string }>();

  return Response.json({
    success: true,
    terminal_id: terminalId,
    terminal_token: rawTerminalToken,
    organization_id: existingToken.organization_id,
    organization_name: org?.name || 'Order It Up',
    branch_id: existingToken.branch_id,
    branch_name: branch?.name || 'Main Branch',
    currency: org?.currency || 'INR',
    timezone: org?.timezone || 'Asia/Kolkata',
  });
}
