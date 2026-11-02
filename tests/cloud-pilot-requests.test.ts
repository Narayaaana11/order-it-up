import assert from 'node:assert/strict';
import cloudWorker from '../apps/cloud-api/src/index';
import { createJWT } from '../apps/cloud-api/src/auth';
import { resetMemoryRateLimits } from '../apps/cloud-api/src/rate-limit';

const JWT_SECRET = 'ordinary-restaurant-jwt-secret-32-characters-minimum';
const PLATFORM_SECRET = 'pilot-admin-jwt-secret-separate-from-tenant-secret';
const ADMIN_EMAIL = 'platform-admin@example.test';

class PilotRequestsD1 {
  requests: any[] = [];
  audits: any[] = [];

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
        } else if (normalized.startsWith('INSERT INTO platform_admin_audit_log')) {
          this.audits.push({ id: params[0], actor_email: params[1], action: 'pilot_access_request.updated', reason: params[2] });
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
    FRONTEND_ORIGIN: 'https://orderitup.in',
  };
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

  const invalidFilter = await cloudWorker.fetch(request('/api/platform-admin/pilot-requests?status=unknown', 'GET', undefined, adminToken), env);
  assert.equal(invalidFilter.status, 400, 'Invalid request inbox filters are rejected');

  console.log('Cloud pilot request tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
