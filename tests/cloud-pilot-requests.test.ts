import assert from 'node:assert/strict';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT, hashString } from '../apps/cloud-api/src/auth';
import { resetMemoryRateLimits } from '../apps/cloud-api/src/rate-limit';
import { PILOT_REQUEST_RETENTION_DAYS, purgeExpiredPilotRequests } from '../apps/cloud-api/src/routes/pilot-requests';

const JWT_SECRET = 'ordinary-restaurant-jwt-secret-32-characters-minimum';
const PLATFORM_SECRET = 'pilot-admin-jwt-secret-separate-from-tenant-secret';
const ADMIN_EMAIL = 'platform-admin@example.test';

class PilotRequestsD1 {
  requests: any[] = [];
  audits: any[] = [];
  invitations: any[] = [];

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let params: any[] = [];
    const statement: any = {
      bind: (...values: any[]) => { params = values; return statement; },
      first: async <T = any>(): Promise<T | null> => {
        if (normalized.includes('INSERT INTO rate_limits')) return null;
        if (normalized.includes('SELECT id FROM pilot_access_requests WHERE submission_key_hash')) {
          return (this.requests.find((item) => item.submission_key_hash === params[0]) as T) || null;
        }
        if (normalized.startsWith('SELECT COUNT(*) AS total FROM pilot_access_requests')) {
          return { total: this.filterRequests(normalized, params).length } as T;
        }
        if (normalized.includes('FROM pilot_access_requests WHERE id = ?')) {
          return (this.requests.find((item) => item.id === params[0]) as T) || null;
        }
        return null;
      },
      all: async <T = any>(): Promise<{ results: T[] }> => {
        if (!normalized.includes('FROM pilot_access_requests')) return { results: [] as T[] };
        const filtered = this.filterRequests(normalized, params);
        const limit = Number(params[params.length - 2]);
        const offset = Number(params[params.length - 1]);
        const results = filtered.slice(offset, offset + limit).map((item) => ({
          id: item.id,
          contact_name: item.contact_name,
          restaurant_name: item.restaurant_name,
          email: item.email,
          phone: item.phone,
          city: item.city,
          country: item.country,
          restaurant_type: item.restaurant_type,
          outlet_count: item.outlet_count,
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        return { results: results as T[] };
      },
      run: async () => {
        if (normalized.startsWith('INSERT INTO pilot_access_requests')) {
          this.requests.push({
            id: params[0], contact_name: params[1], restaurant_name: params[2], email: params[3],
            phone: params[4], city: params[5], country: params[6], restaurant_type: params[7],
            outlet_count: params[8], current_pos: params[9], message: params[10], consent_at: params[11],
            submission_key_hash: params[12], status: 'new', admin_notes: '', reviewed_by: null,
            reviewed_at: null, created_at: params[13], updated_at: params[14],
          });
        } else if (normalized.startsWith('UPDATE pilot_access_requests')) {
          const item = this.requests.find((entry) => entry.id === params[5]);
          if (item) Object.assign(item, {
            status: params[0], admin_notes: params[1], reviewed_by: params[2],
            reviewed_at: params[3], updated_at: params[4],
          });
        } else if (normalized.startsWith('UPDATE pilot_access_invitations SET revoked_at')) {
          for (const invite of this.invitations) {
            if (invite.request_id === params[1] && !invite.redeemed_at && !invite.revoked_at) invite.revoked_at = params[0];
          }
          return { success: true, meta: { changes: 1 } };
        } else if (normalized.startsWith('INSERT INTO pilot_access_invitations')) {
          const [id, tokenHash, createdBy, expiresAt, createdAt, selectedRequestId] = params;
          const pilotRequest = this.requests.find((entry) => entry.id === selectedRequestId && entry.status === 'approved');
          if (pilotRequest) {
            this.invitations.push({ id, request_id: selectedRequestId, token_hash: tokenHash, created_by: createdBy, expires_at: expiresAt, created_at: createdAt, redeemed_at: null, revoked_at: null, organization_id: null });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        } else if (normalized.startsWith('INSERT INTO platform_admin_audit_log')) {
          const isRetention = normalized.includes("'system:retention'");
          const isInvitation = normalized.includes('pilot_access_request.invitation_created');
          this.audits.push({
            id: params[0], actor_email: isRetention ? 'system:retention' : params[1],
            action: isRetention ? 'pilot_access_request.retention_purged' : isInvitation ? 'pilot_access_request.invitation_created' : 'pilot_access_request.updated',
            reason: isRetention ? params[1] : params[2],
          });
        } else if (normalized.startsWith('DELETE FROM pilot_access_requests WHERE updated_at < ?')) {
          const before = this.requests.length;
          this.requests = this.requests.filter((item) => item.updated_at >= params[0]);
          return { success: true, meta: { changes: before - this.requests.length } };
        }
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }

  async batch(statements: any[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  private filterRequests(sql: string, params: any[]) {
    let filtered = [...this.requests];
    let paramIndex = 0;
    if (sql.includes('contact_name LIKE')) {
      const query = String(params[paramIndex] || '').replaceAll('%', '').toLowerCase();
      paramIndex += 4;
      filtered = filtered.filter((item) => [item.contact_name, item.restaurant_name, item.email, item.city]
        .some((value) => String(value || '').toLowerCase().includes(query)));
    }
    const statusClause = sql.includes("status = ?") || sql.includes("status = ? ORDER");
    if (statusClause) {
      const statusIndex = sql.includes('contact_name LIKE') ? 4 : paramIndex;
      filtered = filtered.filter((item) => item.status === params[statusIndex]);
    }
    return filtered.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
}

function request(path: string, method = 'GET', body?: unknown, token?: string, ip = '198.51.100.82', idempotencyKey?: string) {
  return new Request(`https://api.orderitup.in${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      'CF-Connecting-IP': ip,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function run() {
  resetMemoryRateLimits();
  const db = new PilotRequestsD1();
  const env: any = {
    DB: db,
    JWT_SECRET,
    PLATFORM_ADMIN_EMAIL: ADMIN_EMAIL,
    PLATFORM_ADMIN_PASSWORD_HASH: 'scrypt$test-hash-not-used-by-verifier',
    PLATFORM_ADMIN_JWT_SECRET: PLATFORM_SECRET,
    ENVIRONMENT: 'staging',
    FRONTEND_ORIGIN: 'https://orderitup.in, https://orderitup.pages.dev',
  };
  const preflight = await cloudWorker.fetch(new Request('https://api.orderitup.in/api/pilot-requests', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://orderitup.pages.dev',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,idempotency-key',
    },
  }), env);
  assert.equal(preflight.status, 200, 'Pilot request CORS preflight is accepted');
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://orderitup.pages.dev');
  assert.match(preflight.headers.get('Access-Control-Allow-Headers') || '', /Idempotency-Key/i,
    'CORS preflight explicitly permits the Idempotency-Key request header');

  const adminToken = await createJWT({
    sub: 'order-it-up-platform-admin', org: '__platform_admin__', email: ADMIN_EMAIL,
    role: 'owner', branch: null, exp: Math.floor(Date.now() / 1000) + 3600,
  }, PLATFORM_SECRET);
  const payload = {
    contact_name: 'Sravani Rao', restaurant_name: 'Sample Cafe', email: 'owner@sample-cafe.example',
    phone: '+91 98765 43210', city: 'Hyderabad', country: 'IN', restaurant_type: 'cafe',
    outlet_count: 2, current_pos: 'Paper and spreadsheets', message: 'We want to evaluate counter billing and kitchen tickets.', consent: true,
  };

  const missingConsent = await cloudWorker.fetch(request('/api/pilot-requests', 'POST', { ...payload, consent: false }, undefined, '198.51.100.83'), env);
  assert.equal(missingConsent.status, 400, 'Public pilot requests require explicit contact consent');

  const trap = await cloudWorker.fetch(request('/api/pilot-requests', 'POST', { ...payload, website: 'spam' }, undefined, '198.51.100.84'), env);
  assert.equal(trap.status, 201, 'The public honeypot returns a non-revealing success response');
  assert.equal(db.requests.length, 0, 'Honeypot submissions are not stored');

  const key = 'e56f4da0-e542-4dfc-8c58-1d0fb01e9785';
  const created = await cloudWorker.fetch(request('/api/pilot-requests', 'POST', payload, undefined, '198.51.100.82', key), env);
  assert.equal(created.status, 201, 'A valid public pilot request is stored');
  const createdData = await created.json() as any;
  const id = createdData.request.id as string;
  assert.ok(id);
  assert.equal(db.requests[0].email, payload.email);

  const retried = await cloudWorker.fetch(request('/api/pilot-requests', 'POST', payload, undefined, '198.51.100.82', key), env);
  assert.equal(retried.status, 200, 'An idempotent retry returns the existing request');
  assert.equal(db.requests.length, 1, 'Retries do not create duplicate pilot requests');

  const unauthorized = await cloudWorker.fetch(request('/api/platform-admin/pilot-requests'), env);
  assert.equal(unauthorized.status, 401, 'Pilot request records are private to platform admins');

  const list = await cloudWorker.fetch(request('/api/platform-admin/pilot-requests?q=sample&status=new', 'GET', undefined, adminToken), env);
  assert.equal(list.status, 200, 'A platform admin can search and filter the D1 request inbox');
  const listData = await list.json() as any;
  assert.equal(listData.data_source, 'cloudflare_d1');
  assert.equal(listData.pagination.total, 1);
  assert.equal(listData.requests[0].id, id);
  assert.equal('message' in listData.requests[0], false, 'List results do not return full request messages');

  const detail = await cloudWorker.fetch(request(`/api/platform-admin/pilot-requests/${id}`, 'GET', undefined, adminToken), env);
  assert.equal(detail.status, 200, 'An admin can inspect the full request');
  const detailData = await detail.json() as any;
  assert.equal(detailData.request.message, payload.message);
  assert.equal(detailData.request.consent_at.length > 0, true);

  const invalidUpdate = await cloudWorker.fetch(request(`/api/platform-admin/pilot-requests/${id}`, 'PATCH', {
    status: 'approved', admin_notes: 'Reviewed and approved.', reason: 'ok',
  }, adminToken), env);
  assert.equal(invalidUpdate.status, 400, 'Admin review updates require a meaningful audit reason');

  const updated = await cloudWorker.fetch(request(`/api/platform-admin/pilot-requests/${id}`, 'PATCH', {
    status: 'contacted', admin_notes: 'Sent a pilot overview and requested a device list.',
    reason: 'Contacted the owner to confirm current printer and workflow requirements.',
  }, adminToken), env);
  assert.equal(updated.status, 200, 'A platform admin can update status and private notes');
  assert.equal(db.requests[0].status, 'contacted');
  assert.equal(db.audits.length, 1, 'Admin request updates create an audit record');

  const prematureInvitation = await cloudWorker.fetch(request(`/api/platform-admin/pilot-requests/${id}/invitation`, 'POST', {}, adminToken), env);
  assert.equal(prematureInvitation.status, 409, 'Only approved requests can receive account setup links');

  const approved = await cloudWorker.fetch(request(`/api/platform-admin/pilot-requests/${id}`, 'PATCH', {
    status: 'approved', admin_notes: 'Pilot fit confirmed.',
    reason: 'The owner confirmed a supported pilot setup and onboarding schedule.',
  }, adminToken), env);
  assert.equal(approved.status, 200);

  const originalFetch = globalThis.fetch;
  let emailPayload: any = null;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    emailPayload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'email_test_001' }), { status: 200 });
  }) as typeof fetch;
  Object.assign(env, {
    RESEND_API_KEY: 're_test_key',
    PILOT_INVITATION_FROM: 'Order It Up <pilot@example.com>',
    PILOT_INVITATION_BASE_URL: 'https://orderitup.in',
  });
  const invitationResponse = await cloudWorker.fetch(request(`/api/platform-admin/pilot-requests/${id}/invitation`, 'POST', {}, adminToken), env);
  globalThis.fetch = originalFetch;
  assert.equal(invitationResponse.status, 201, 'Approved pilot request can receive a one-time setup link');
  const invitationData = await invitationResponse.json() as any;
  assert.match(invitationData.invitation.token, /^[a-f0-9]{64}$/);
  assert.equal(invitationData.invitation.path, '/pilot-invitation');
  assert.equal(invitationData.invitation.delivery, 'sent');
  assert.match(invitationData.invitation.url, /^https:\/\/orderitup\.in\/pilot-invitation#token=[a-f0-9]{64}$/);
  assert.equal(emailPayload.to[0], payload.email);
  assert.match(emailPayload.text, /https:\/\/orderitup\.in\/pilot-invitation#token=/);
  assert.equal(db.invitations.length, 1);
  assert.equal(db.invitations[0].token_hash, await hashString(invitationData.invitation.token));
  assert.equal(db.invitations[0].token_hash.includes(invitationData.invitation.token), false, 'Only the token hash is stored');
  assert.equal(db.audits.filter((entry) => entry.action === 'pilot_access_request.invitation_created').length, 1);

  const revoked = await cloudWorker.fetch(request(`/api/platform-admin/pilot-requests/${id}`, 'PATCH', {
    status: 'contacted', admin_notes: 'Hold account setup until contract review.',
    reason: 'The business requested that account setup wait for their pending review.',
  }, adminToken), env);
  assert.equal(revoked.status, 200);
  assert.ok(db.invitations[0].revoked_at, 'Moving out of approved status revokes active setup links');

  db.requests[0].updated_at = '2025-01-01T00:00:00.000Z';
  const retentionNow = new Date('2026-11-02T00:00:00.000Z');
  const purgedCount = await purgeExpiredPilotRequests(env, retentionNow);
  assert.equal(PILOT_REQUEST_RETENTION_DAYS, 180);
  assert.equal(purgedCount, 1, 'Requests inactive beyond the documented retention period are deleted');
  assert.equal(db.requests.length, 0, 'Expired contact details and internal notes are removed');
  const retentionAudit = db.audits.find((entry) => entry.actor_email === 'system:retention');
  assert.ok(retentionAudit, 'Scheduled purge writes a system audit entry');
  assert.match(retentionAudit.action, /retention_purged/);

  const auditCountBeforeNoOp = db.audits.length;
  const noOpPurge = await purgeExpiredPilotRequests(env, retentionNow);
  assert.equal(noOpPurge, 0, 'A repeated scheduled purge is idempotent');
  assert.equal(db.audits.length, auditCountBeforeNoOp, 'No audit entry is written when no records are deleted');

  let scheduledWork: Promise<unknown> | null = null;
  cloudWorker.scheduled({} as any, env, { waitUntil: (promise: Promise<unknown>) => { scheduledWork = promise; } } as any);
  assert.ok(scheduledWork, 'The Worker cron handler registers the retention purge with waitUntil');
  await scheduledWork;

  const invalidFilter = await cloudWorker.fetch(request('/api/platform-admin/pilot-requests?status=unknown', 'GET', undefined, adminToken), env);
  assert.equal(invalidFilter.status, 400, 'Invalid request inbox filters are rejected');

  console.log('Cloud pilot request tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
