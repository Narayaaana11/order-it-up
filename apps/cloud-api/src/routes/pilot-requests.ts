import { hashString } from '../auth';
import { checkRateLimit, createRateLimitResponse, getClientIp, getEffectiveLimit } from '../rate-limit';
import type { Env } from './pairing';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_STATUSES = ['new', 'reviewing', 'contacted', 'approved', 'declined', 'closed'] as const;
type RequestStatus = typeof REQUEST_STATUSES[number];

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function acceptedResponse(status = 201, id?: string): Response {
  return Response.json({
    ok: true,
    ...(id ? { request: { id } } : {}),
    message: 'Your pilot access request has been received. The team will contact you about next steps.',
  }, { status });
}

export async function handleCreatePilotRequest(request: Request, env: Env): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 12_000) return Response.json({ error: 'Request is too large' }, { status: 413 });

  const ipLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'pilot_request_ip',
    identifier: await hashString(getClientIp(request)),
    limit: getEffectiveLimit(env.RATE_LIMIT_PILOT_REQUEST_IP, 5, 1, 100),
    windowSeconds: 60 * 60,
  });
  if (!ipLimit.allowed) return createRateLimitResponse(ipLimit);

  let body: any;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 12_000) return Response.json({ error: 'Request is too large' }, { status: 413 });
    body = JSON.parse(rawBody);
  }
  catch { return Response.json({ error: 'Enter your request details and try again.' }, { status: 400 }); }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Enter your request details and try again.' }, { status: 400 });
  }

  // Silently accept bots that fill the hidden honeypot without persisting their payload.
  if (typeof body.website === 'string' && body.website.trim()) return acceptedResponse();

  const contactName = text(body.contact_name, 120);
  const restaurantName = text(body.restaurant_name, 160);
  const email = text(body.email, 254)?.toLowerCase() || '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
  const restaurantType = typeof body.restaurant_type === 'string' ? body.restaurant_type.trim().toLowerCase() : '';
  const currentPos = typeof body.current_pos === 'string' ? body.current_pos.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const outletCount = Number(body.outlet_count);

  if (!contactName || !restaurantName || !EMAIL_REGEX.test(email) ||
      !/^[A-Z]{2}$/.test(country) ||
      !['restaurant', 'cafe', 'qsr', 'bar', 'other'].includes(restaurantType) ||
      !Number.isInteger(outletCount) || outletCount < 1 || outletCount > 10_000 ||
      phone.length > 40 || (phone && !/^[+0-9().\s-]+$/.test(phone)) ||
      city.length > 120 || currentPos.length > 160 || message.length > 1500 ||
      body.consent !== true) {
    return Response.json({ error: 'Check the required fields, contact details and privacy consent.' }, { status: 400 });
  }

  const emailLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'pilot_request_email',
    identifier: await hashString(email),
    limit: getEffectiveLimit(env.RATE_LIMIT_PILOT_REQUEST_EMAIL, 3, 1, 100),
    windowSeconds: 24 * 60 * 60,
  });
  if (!emailLimit.allowed) return createRateLimitResponse(emailLimit);

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || '';
  if (idempotencyKey && (idempotencyKey.length < 16 || idempotencyKey.length > 128)) {
    return Response.json({ error: 'Invalid request key. Please reload the form and try again.' }, { status: 400 });
  }

  const keyHash = idempotencyKey ? await hashString(idempotencyKey) : null;
  if (keyHash) {
    try {
      const prior = await env.DB.prepare(
        'SELECT id FROM pilot_access_requests WHERE submission_key_hash = ?'
      ).bind(keyHash).first<{ id: string }>();
      if (prior) return acceptedResponse(200, prior.id);
    } catch (error) {
      console.error('[PilotRequest] Idempotency lookup failed:', error);
      return Response.json({ error: 'Pilot requests are temporarily unavailable. Please try again later.' }, { status: 503 });
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`
      INSERT INTO pilot_access_requests
        (id, contact_name, restaurant_name, email, phone, city, country, restaurant_type,
         outlet_count, current_pos, message, consent_at, submission_key_hash, status,
         admin_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?)
    `).bind(
      id, contactName, restaurantName, email, phone || null, city || null, country,
      restaurantType, outletCount, currentPos || null, message || null, now,
      keyHash, now, now,
    ).run();
  } catch (error) {
    if (keyHash) {
      try {
        const prior = await env.DB.prepare(
          'SELECT id FROM pilot_access_requests WHERE submission_key_hash = ?'
        ).bind(keyHash).first<{ id: string }>();
        if (prior) return acceptedResponse(200, prior.id);
      } catch { /* Return the standard unavailable response below. */ }
    }
    console.error('[PilotRequest] Create failed:', error);
    return Response.json({ error: 'Pilot requests are temporarily unavailable. Please try again later.' }, { status: 503 });
  }

  return acceptedResponse(201, id);
}

async function listPilotRequests(url: URL, env: Env): Promise<Response> {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const status = (url.searchParams.get('status') || '').trim().toLowerCase();
  const limit = Number(url.searchParams.get('limit') || 25);
  const offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 ||
      (status && !REQUEST_STATUSES.includes(status as RequestStatus))) {
    return Response.json({ error: 'Invalid request filters or pagination values' }, { status: 400 });
  }

  const clauses: string[] = [];
  const values: unknown[] = [];
  if (query) {
    clauses.push('(contact_name LIKE ? OR restaurant_name LIKE ? OR email LIKE ? OR city LIKE ?)');
    values.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (status) {
    clauses.push('status = ?');
    values.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const [count, rows] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS total FROM pilot_access_requests ${where}`)
        .bind(...values).first<any>(),
      env.DB.prepare(`
        SELECT id, contact_name, restaurant_name, email, phone, city, country,
               restaurant_type, outlet_count, status, created_at, updated_at
        FROM pilot_access_requests ${where}
        ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                 created_at DESC, id ASC
        LIMIT ? OFFSET ?
      `).bind(...values, limit, offset).all<any>(),
    ]);
    return Response.json({
      requests: rows.results || [],
      pagination: { limit, offset, total: Number(count?.total || 0) },
      data_source: 'cloudflare_d1',
    });
  } catch (error) {
    console.error('[PilotRequest] Admin list query failed:', error);
    return Response.json({ error: 'Pilot request storage is not available. Apply D1 migration 0014.' }, { status: 503 });
  }
}

async function getPilotRequest(id: string, env: Env): Promise<Response> {
  if (!id || id.length > 128) return Response.json({ error: 'Invalid request identifier' }, { status: 400 });
  try {
    const item = await env.DB.prepare(`
      SELECT id, contact_name, restaurant_name, email, phone, city, country,
             restaurant_type, outlet_count, current_pos, message, consent_at,
             status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at
      FROM pilot_access_requests WHERE id = ?
    `).bind(id).first<any>();
    return item
      ? Response.json({ request: item, data_source: 'cloudflare_d1' })
      : Response.json({ error: 'Pilot request not found' }, { status: 404 });
  } catch (error) {
    console.error('[PilotRequest] Admin detail query failed:', error);
    return Response.json({ error: 'Pilot request storage is not available. Apply D1 migration 0014.' }, { status: 503 });
  }
}

function validReason(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 10 && value.trim().length <= 500;
}

async function updatePilotRequest(request: Request, env: Env, actorEmail: string, id: string): Promise<Response> {
  if (!id || id.length > 128) return Response.json({ error: 'Invalid request identifier' }, { status: 400 });
  let body: any;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid update payload' }, { status: 400 }); }

  const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : '';
  const adminNotes = typeof body?.admin_notes === 'string' ? body.admin_notes.trim() : '';
  if (!REQUEST_STATUSES.includes(status as RequestStatus) || adminNotes.length > 2000 || !validReason(body?.reason)) {
    return Response.json({ error: 'Choose a valid request status, keep notes under 2000 characters, and provide an audit reason of 10–500 characters.' }, { status: 400 });
  }

  try {
    const current = await env.DB.prepare(
      'SELECT id, status, admin_notes FROM pilot_access_requests WHERE id = ?'
    ).bind(id).first<any>();
    if (!current) return Response.json({ error: 'Pilot request not found' }, { status: 404 });
    const now = new Date().toISOString();
    const auditId = crypto.randomUUID();
    const before = { status: current.status };
    const after = { status, notes_updated: adminNotes !== current.admin_notes };
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE pilot_access_requests
        SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(status, adminNotes, actorEmail, now, now, id),
      env.DB.prepare(`
        INSERT INTO platform_admin_audit_log
          (id, actor_email, action, organization_id, reason, before_json, after_json, created_at)
        VALUES (?, ?, 'pilot_access_request.updated', NULL, ?, ?, ?, ?)
      `).bind(auditId, actorEmail, body.reason.trim(), JSON.stringify(before), JSON.stringify(after), now),
    ]);
    return Response.json({
      ok: true,
      request: { id, status, admin_notes: adminNotes, reviewed_by: actorEmail, reviewed_at: now, updated_at: now },
      audit_id: auditId,
    });
  } catch (error) {
    console.error('[PilotRequest] Admin update failed:', error);
    return Response.json({ error: 'Pilot request could not be updated. Apply D1 migration 0014 and try again.' }, { status: 503 });
  }
}

export async function handleAdminPilotRequests(
  request: Request,
  env: Env,
  path: string,
  method: string,
  actorEmail: string,
): Promise<Response> {
  if (path === '/api/platform-admin/pilot-requests' && method === 'GET') {
    return listPilotRequests(new URL(request.url), env);
  }
  if (path.startsWith('/api/platform-admin/pilot-requests/')) {
    let id: string;
    try { id = decodeURIComponent(path.slice('/api/platform-admin/pilot-requests/'.length)); }
    catch { return Response.json({ error: 'Invalid request identifier' }, { status: 400 }); }
    if (id.includes('/')) return Response.json({ error: 'Invalid request identifier' }, { status: 400 });
    if (method === 'GET') return getPilotRequest(id, env);
    if (method === 'PATCH') return updatePilotRequest(request, env, actorEmail, id);
  }
  return Response.json({ error: 'Pilot request endpoint not found' }, { status: 404 });
}
