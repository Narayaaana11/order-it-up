import { hashString } from '../auth';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export async function handleGeneratePairing(request: Request, env: Env, orgId: string): Promise<Response> {
  const body = await request.json() as { branch_id: string; terminal_name: string };
  if (!body.branch_id || !body.terminal_name) {
    return Response.json({ error: 'branch_id and terminal_name are required' }, { status: 400 });
  }

  // Verify branch belongs to organization
  const branch = await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND organization_id = ?')
    .bind(body.branch_id, orgId).first();
  if (!branch) {
    return Response.json({ error: 'Branch not found or belongs to another organization' }, { status: 404 });
  }

  // Generate cryptographically secure 6-digit code
  const randomBuf = new Uint32Array(1);
  crypto.getRandomValues(randomBuf);
  const code = (100000 + (randomBuf[0] % 900000)).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO pairing_tokens (code, organization_id, branch_id, terminal_name, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(code, orgId, body.branch_id, body.terminal_name, expiresAt, now).run();

  return Response.json({
    code,
    branch_id: body.branch_id,
    terminal_name: body.terminal_name,
    expires_at: expiresAt
  });
}

export async function handleClaimPairing(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { code: string; app_version?: string; device_fingerprint?: string };
  if (!body.code) {
    return Response.json({ error: 'Pairing code is required' }, { status: 400 });
  }

  const tokenRow = await env.DB.prepare(`
    SELECT * FROM pairing_tokens WHERE code = ? AND expires_at > ?
  `).bind(body.code.trim(), new Date().toISOString()).first<{
    code: string;
    organization_id: string;
    branch_id: string;
    terminal_name: string;
  }>();

  if (!tokenRow) {
    return Response.json({ error: 'Invalid or expired pairing code' }, { status: 404 });
  }

  // Generate permanent terminal device token
  const terminalId = crypto.randomUUID();
  const rawTerminalToken = `pos_${crypto.randomUUID().replace(/-/g, '')}_${Date.now()}`;
  const tokenHash = await hashString(rawTerminalToken);
  const now = new Date().toISOString();

  // Create terminal
  await env.DB.prepare(`
    INSERT INTO terminals (id, organization_id, branch_id, terminal_name, terminal_token_hash, last_seen_at, app_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    terminalId,
    tokenRow.organization_id,
    tokenRow.branch_id,
    tokenRow.terminal_name,
    tokenHash,
    now,
    body.app_version || '1.0.0',
    now
  ).run();

  // Clean up pairing token
  await env.DB.prepare('DELETE FROM pairing_tokens WHERE code = ?').bind(body.code).run();

  // Retrieve org & branch details
  const org = await env.DB.prepare('SELECT name, currency, timezone FROM organizations WHERE id = ?')
    .bind(tokenRow.organization_id).first<{ name: string; currency: string; timezone: string }>();
  const branch = await env.DB.prepare('SELECT name FROM branches WHERE id = ?')
    .bind(tokenRow.branch_id).first<{ name: string }>();

  return Response.json({
    success: true,
    terminal_id: terminalId,
    terminal_token: rawTerminalToken,
    organization_id: tokenRow.organization_id,
    organization_name: org?.name || 'Order It Up',
    branch_id: tokenRow.branch_id,
    branch_name: branch?.name || 'Main Branch',
    currency: org?.currency || 'INR',
    timezone: org?.timezone || 'Asia/Kolkata'
  });
}
