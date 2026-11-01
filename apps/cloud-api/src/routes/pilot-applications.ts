import { Env } from './pairing';
import { checkRateLimit, createRateLimitResponse, getClientIp } from '../rate-limit';
import type { JWTPayload } from '../auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUSINESS_TYPES = new Set(['restaurant', 'cafe', 'qsr', 'bakery', 'cloud-kitchen', 'hotel', 'other']);

function clean(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] || character);
}

export async function handleCreatePilotApplication(request: Request, env: Env): Promise<Response> {
  const limit = await checkRateLimit(env.DB, {
    keyPrefix: 'pilot_application_ip',
    identifier: getClientIp(request),
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limit.allowed) return createRateLimitResponse(limit);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Please submit a valid form.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Please submit a valid form.' }, { status: 400 });
  }

  // Honeypot: reply with success but do not store automated submissions.
  if (clean(body.website, 200)) {
    return Response.json({ success: true, notification_status: 'received' }, { status: 201 });
  }

  const contactName = clean(body.contact_name, 100);
  const restaurantName = clean(body.restaurant_name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 32);
  const city = clean(body.city, 100);
  const state = clean(body.state, 100);
  const businessType = clean(body.business_type, 32).toLowerCase();
  const existingPos = clean(body.existing_pos, 120);
  const hardware = clean(body.hardware, 700);
  const outlets = Number(body.outlets);
  const message = clean(body.message, 1500);
  const consent = body.consent === true;

  if (contactName.length < 2 || restaurantName.length < 2 ||
      !EMAIL_REGEX.test(email) || city.length < 2 ||
      !BUSINESS_TYPES.has(businessType) || !existingPos ||
      !hardware || !Number.isInteger(outlets) || outlets < 1 || outlets > 500 ||
      !consent || phone.length > 32) {
    return Response.json({ error: 'Please complete all required fields and agree to be contacted about this pilot.' }, { status: 400 });
  }

  const applicationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO pilot_applications (
      id, contact_name, restaurant_name, email, phone, city, state, business_type,
      existing_pos, hardware, outlets, message, consent_at, source, notification_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', 'pending', ?, ?)
  `).bind(
    applicationId, contactName, restaurantName, email, phone || null, city, state || null,
    businessType, existingPos, hardware, outlets, message || null, createdAt, createdAt, createdAt,
  ).run();

  let notificationStatus: 'sent' | 'pending' = 'pending';
  if (env.RESEND_API_KEY && env.PILOT_NOTIFICATION_EMAIL && env.PILOT_FROM_EMAIL) {
    const fields = [
      ['Contact', contactName], ['Restaurant', restaurantName], ['Email', email],
      ['Phone', phone || 'Not provided'], ['Location', [city, state].filter(Boolean).join(', ')],
      ['Business type', businessType], ['Existing POS', existingPos],
      ['Hardware', hardware], ['Outlets', String(outlets)], ['Notes', message || 'None'],
    ];
    const html = fields.map(([label, value]) =>
      '<p><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value) + '</p>'
    ).join('');
    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + env.RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.PILOT_FROM_EMAIL,
          to: env.PILOT_NOTIFICATION_EMAIL.split(',').map((value) => value.trim()).filter(Boolean),
          subject: 'New Order It Up pilot request — ' + restaurantName,
          html,
          text: fields.map(([label, value]) => label + ': ' + value).join('\n'),
        }),
      });
      if (emailResponse.ok) notificationStatus = 'sent';
    } catch {
      // The request stays safely stored in D1; the response tells the visitor notification is pending.
    }
    await env.DB.prepare('UPDATE pilot_applications SET notification_status = ?, updated_at = ? WHERE id = ?')
      .bind(notificationStatus, new Date().toISOString(), applicationId).run();
  }

  return Response.json({
    success: true,
    application_id: applicationId,
    notification_status: notificationStatus,
  }, { status: 201 });
}

export async function handleListPilotApplications(
  request: Request,
  env: Env,
  claims: JWTPayload,
): Promise<Response> {
  const allowedEmails = (env.PILOT_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!claims.email || !allowedEmails.includes(claims.email.toLowerCase())) {
    return Response.json({ error: 'Forbidden: pilot enquiry administrator access is required' }, { status: 403 });
  }
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const result = await env.DB.prepare(`
    SELECT id, contact_name, restaurant_name, email, phone, city, state, business_type,
      existing_pos, hardware, outlets, message, source, notification_status, created_at
    FROM pilot_applications ORDER BY created_at DESC LIMIT ?
  `).bind(limit).all();
  return Response.json({ applications: result.results || [] });
}
