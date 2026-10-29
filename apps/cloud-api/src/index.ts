/**
 * Order It Up Cloud Edge Worker - Serverless Multi-Branch Backend (Cloudflare Workers + D1)
 */

import { Env, handleGeneratePairing, handleClaimPairing } from './routes/pairing';
import { handleIngestSyncEvents } from './routes/sync';
import { handleAnalyticsOverview } from './routes/analytics';
import { handleAccountantClosures, handleAccountantTaxSummary, handleTallyExport } from './routes/accountant';
import { handleGetMasterCatalog, handleSaveMasterProduct, handleGetBranchCatalog, handleSetBranchOverride } from './routes/catalog';
import { handleListTransfers, handleCreateTransfer, handleUpdateTransferStatus } from './routes/transfers';
import { createJWT, verifyJWT, hashString } from './auth';

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      const response = await routeRequest(request, env, url, method);
      // Attach CORS
      const headers = new Headers(response.headers);
      for (const [key, val] of Object.entries(corsHeaders())) {
        headers.set(key, val);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err: any) {
      console.error('Unhandled worker error:', err);
      return Response.json(
        { error: 'Internal Server Error', details: err?.message || String(err) },
        { status: 500, headers: corsHeaders() }
      );
    }
  },
};

async function routeRequest(request: Request, env: Env, url: URL, method: string): Promise<Response> {
  const path = url.pathname;

  // 1. Health check
  if (path === '/' || path === '/health') {
    return Response.json({
      service: 'orderitup-cloud-api',
      version: '1.0.0',
      status: 'operational',
      engine: 'Cloudflare Workers + D1'
    });
  }

  // 2. Auth: Login
  if (path === '/api/auth/login' && method === 'POST') {
    const body = await request.json() as { email: string; password?: string };
    if (!body.email) return Response.json({ error: 'Email required' }, { status: 400 });

    const user = await env.DB.prepare(`
      SELECT u.*, o.name as organization_name, o.currency, o.timezone
      FROM cloud_users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = ? AND u.status = 'active'
    `).bind(body.email.trim().toLowerCase()).first<any>();

    if (!user) {
      return Response.json({ error: 'User not found or inactive' }, { status: 401 });
    }

    // Verify password if set
    if (user.password_hash && body.password) {
      const passHash = await hashString(body.password);
      if (passHash !== user.password_hash) {
        return Response.json({ error: 'Invalid password' }, { status: 401 });
      }
    }

    // Generate JWT
    const exp = Math.floor(Date.now() / 1000) + (7 * 86400); // 7 days
    const token = await createJWT({
      sub: user.id,
      org: user.organization_id,
      email: user.email,
      role: user.role,
      branch: user.assigned_branch_id,
      exp
    }, env.JWT_SECRET || 'orderitup-default-secret');

    return Response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        currency: user.currency,
        timezone: user.timezone,
        assigned_branch_id: user.assigned_branch_id
      }
    });
  }

  // 3. Demo / Initializer Setup Seed
  if (path === '/api/auth/setup-demo' && method === 'POST') {
    return handleSetupDemo(env);
  }

  // 4. POS Terminal Pairing (Claiming)
  if (path === '/api/pos/pair' && method === 'POST') {
    return handleClaimPairing(request, env);
  }

  // 5. POS Ingest Events
  if (path === '/api/pos/events' && method === 'POST') {
    return handleIngestSyncEvents(request, env);
  }

  // Authenticated Portal Endpoints (Require Bearer JWT)
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const claims = token ? await verifyJWT(token, env.JWT_SECRET || 'orderitup-default-secret') : null;

  if (!claims) {
    return Response.json({ error: 'Unauthorized: valid cloud user token required' }, { status: 401 });
  }

  const orgId = claims.org;

  // 6. Branches
  if (path === '/api/branches' && method === 'GET') {
    const branches = await env.DB.prepare('SELECT * FROM branches WHERE organization_id = ? ORDER BY is_main_branch DESC, name ASC')
      .bind(orgId).all();
    return Response.json({ branches: branches.results });
  }

  if (path === '/api/branches' && method === 'POST') {
    const body = await request.json() as any;
    const branchId = body.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO branches (id, organization_id, code, name, is_main_branch, address, phone, email, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(branchId, orgId, body.code || `BR-${Date.now().toString().slice(-4)}`, body.name, body.is_main_branch ? 1 : 0, body.address || null, body.phone || null, body.email || null, now, now).run();
    return Response.json({ success: true, branch_id: branchId });
  }

  // 7. Pairing Token Generation (Admin)
  if (path === '/api/pairing/generate' && method === 'POST') {
    return handleGeneratePairing(request, env, orgId);
  }

  // 8. Analytics Overview
  if (path === '/api/analytics/overview' && method === 'GET') {
    return handleAnalyticsOverview(request, env, orgId);
  }

  // 9. Accountant Hub
  if (path === '/api/accountant/closures' && method === 'GET') {
    return handleAccountantClosures(request, env, orgId);
  }
  if (path === '/api/accountant/tax-summary' && method === 'GET') {
    return handleAccountantTaxSummary(request, env, orgId);
  }
  if (path === '/api/accountant/export-tally' && method === 'GET') {
    return handleTallyExport(request, env, orgId);
  }

  // 10. Master Catalog & Overrides
  if (path === '/api/catalog/master' && method === 'GET') {
    return handleGetMasterCatalog(request, env, orgId);
  }
  if (path === '/api/catalog/product' && method === 'POST') {
    return handleSaveMasterProduct(request, env, orgId);
  }
  if (path.startsWith('/api/catalog/branch/') && path.endsWith('/override') && method === 'POST') {
    const parts = path.split('/');
    const branchId = parts[parts.length - 2];
    return handleSetBranchOverride(request, env, branchId);
  }
  if (path.startsWith('/api/catalog/branch/') && method === 'GET') {
    const branchId = path.split('/').pop() || '';
    return handleGetBranchCatalog(request, env, branchId);
  }

  // 11. Inventory Transfers
  if (path === '/api/transfers' && method === 'GET') {
    return handleListTransfers(request, env, orgId);
  }
  if (path === '/api/transfers' && method === 'POST') {
    return handleCreateTransfer(request, env, orgId);
  }
  if (path.startsWith('/api/transfers/') && path.endsWith('/status') && (method === 'PATCH' || method === 'PUT')) {
    const parts = path.split('/');
    const transferId = parts[parts.length - 2];
    return handleUpdateTransferStatus(request, env, transferId);
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}

async function handleSetupDemo(env: Env): Promise<Response> {
  const orgCount = await env.DB.prepare('SELECT COUNT(*) as count FROM organizations').first<{ count: number }>();
  if (orgCount && orgCount.count > 0) {
    return Response.json({ message: 'Database already initialized' });
  }

  const now = new Date().toISOString();
  const orgId = 'org-tastecraft-demo';
  const mainBranchId = 'br-main-connaught';
  const franchiseBranchId = 'br-franchise-gurugram';

  // 1. Organization
  await env.DB.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(orgId, 'TasteCraft Hospitality Group', 'TasteCraft F&B Pvt Ltd', '07AAAAA0000A1Z5', 'INR', 'IN', 'Asia/Kolkata', now, now).run();

  // 2. Branches
  await env.DB.prepare(`
    INSERT INTO branches (id, organization_id, code, name, is_main_branch, address, phone, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'Block C, Connaught Place, New Delhi', '+91 98765 43210', 'active', ?, ?),
           (?, ?, ?, ?, 0, 'Cyber Hub, DLF Phase 2, Gurugram', '+91 98765 12345', 'active', ?, ?)
  `).bind(
    mainBranchId, orgId, 'BR-01', 'Connaught Place (Main)', now, now,
    franchiseBranchId, orgId, 'BR-02', 'Gurugram CyberHub (Franchise)', now, now
  ).run();

  // 3. Demo Users
  const passHash = await hashString('admin123');
  await env.DB.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES (?, ?, 'owner@tastecraft.com', ?, 'Vikram Malhotra (Owner)', 'owner', 'active', ?, ?),
           (?, ?, 'accountant@tastecraft.com', ?, 'Pooja Sharma (Accountant)', 'accountant', 'active', ?, ?)
  `).bind(
    crypto.randomUUID(), orgId, passHash, now, now,
    crypto.randomUUID(), orgId, passHash, now, now
  ).run();

  // 4. Master Products
  const catMains = crypto.randomUUID();
  const catDrinks = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO master_categories (id, organization_id, name, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, 'Signature Mains', 1, 1, ?, ?),
           (?, ?, 'Artisanal Beverages', 2, 1, ?, ?)
  `).bind(catMains, orgId, now, now, catDrinks, orgId, now, now).run();

  const prod1 = crypto.randomUUID();
  const prod2 = crypto.randomUUID();
  const prod3 = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
    VALUES (?, ?, ?, 'Paneer Tikka Butter Masala', 'MAIN-01', 340, 5, 1, 1, ?, ?),
           (?, ?, ?, 'Woodfired Truffle Pizza', 'MAIN-02', 490, 5, 1, 1, ?, ?),
           (?, ?, ?, 'Iced Hazelnut Cold Brew', 'DRK-01', 220, 5, 1, 1, ?, ?)
  `).bind(
    prod1, orgId, catMains, now, now,
    prod2, orgId, catMains, now, now,
    prod3, orgId, catDrinks, now, now
  ).run();

  return Response.json({
    success: true,
    message: 'Demo franchise organization, branches, users, and catalog seeded successfully'
  });
}
