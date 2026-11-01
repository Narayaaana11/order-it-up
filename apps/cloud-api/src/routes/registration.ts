/**
 * Self-Service SaaS Tenant Registration & Onboarding for Order It Up Cloud Edge Worker.
 */

import { Env } from './pairing';
import { createJWT, hashPassword, isSecretValid } from '../auth';
import { checkRateLimit, createRateLimitResponse, getClientIp } from '../rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SERVICE_MODELS = new Set(['qsr', 'cafe', 'finedine']);

export async function handleRegisterTenant(request: Request, env: Env): Promise<Response> {
  if (!isSecretValid(env.JWT_SECRET)) {
    return Response.json(
      { error: 'Server authentication service is misconfigured' },
      { status: 500 }
    );
  }

  // 1. IP Rate Limiting: Max 10 registration attempts per hour per IP to prevent spamming
  const clientIp = getClientIp(request);
  const regLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'register_ip',
    identifier: clientIp,
    limit: 10,
    windowSeconds: 3600,
  });
  if (!regLimit.allowed) {
    return createRateLimitResponse(regLimit);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const restaurantName = typeof body.restaurant_name === 'string' ? body.restaurant_name.trim() : '';
  const ownerName = typeof body.owner_name === 'string' && body.owner_name.trim() 
    ? body.owner_name.trim() 
    : (typeof body.full_name === 'string' ? body.full_name.trim() : '');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim().toUpperCase() : 'IN';
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'INR';
  const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'Asia/Kolkata';
  const requestedServiceModel = typeof body.service_model === 'string' ? body.service_model.toLowerCase() : '';
  const serviceModel = SERVICE_MODELS.has(requestedServiceModel) ? requestedServiceModel : 'qsr';

  // 2. Input validation
  if (!restaurantName || restaurantName.length < 2 || restaurantName.length > 100) {
    return Response.json({ error: 'Restaurant name must be between 2 and 100 characters' }, { status: 400 });
  }
  if (!ownerName || ownerName.length < 2 || ownerName.length > 100) {
    return Response.json({ error: 'Owner name must be between 2 and 100 characters' }, { status: 400 });
  }
  if (!email || !EMAIL_REGEX.test(email) || email.length > 120) {
    return Response.json({ error: 'A valid email address is required' }, { status: 400 });
  }
  if (!password || password.length < 8 || password.length > 128) {
    return Response.json({ error: 'Password must be between 8 and 128 characters' }, { status: 400 });
  }

  // 3. Unique email check
  const existingUser = await env.DB.prepare('SELECT id FROM cloud_users WHERE email = ?')
    .bind(email).first<{ id: string }>();
  if (existingUser) {
    return Response.json({ error: 'An account with this email address already exists' }, { status: 409 });
  }

  // 4. Secure password derivation
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const orgId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  // 5. Atomic D1 Batch Transaction
  const statements: any[] = [];
  const restaurantId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const restaurantSlug = restaurantName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/(^-|-$)+/g, '') || 'main';

  // 5a. Organization
  statements.push(env.DB.prepare(`
    INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(orgId, restaurantName, body.legal_name || restaurantName, body.tax_number || null, currency, country, timezone, now, now));

  // 5b. Default Restaurant Concept
  statements.push(env.DB.prepare(`
    INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(restaurantId, orgId, restaurantName, restaurantSlug, serviceModel, now, now));

  // 5c. Default Primary Branch
  statements.push(env.DB.prepare(`
    INSERT INTO branches (id, organization_id, restaurant_id, code, name, is_main_branch, address, phone, email, status, created_at, updated_at)
    VALUES (?, ?, ?, 'BR-01', 'Main Outlet', 1, ?, ?, ?, 'active', ?, ?)
  `).bind(branchId, orgId, restaurantId, body.address || null, body.phone || null, email, now, now));

  // 5d. Cloud User (Owner)
  statements.push(env.DB.prepare(`
    INSERT INTO cloud_users (id, organization_id, email, password_hash, name, role, assigned_branch_id, status, last_login_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'owner', ?, 'active', ?, ?, ?)
  `).bind(userId, orgId, email, passwordHash, ownerName, branchId, now, now, now));

  // 5e. Location-Scoped Membership (Organization Owner)
  statements.push(env.DB.prepare(`
    INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
    VALUES (?, ?, ?, NULL, NULL, 'owner', 'active', ?, ?)
  `).bind(membershipId, orgId, userId, now, now));


  // Execute all atomic statements
  if (typeof env.DB.batch === 'function') {
    await env.DB.batch(statements);
  } else {
    for (const stmt of statements) {
      await stmt.run();
    }
  }

  // 6. Generate 7-day JWT Token
  const exp = Math.floor(Date.now() / 1000) + (7 * 86400);
  const token = await createJWT({
    sub: userId,
    org: orgId,
    email,
    role: 'owner',
    branch: branchId,
    exp,
  }, env.JWT_SECRET);

  const tenantObj = {
    id: orgId,
    name: restaurantName,
    business_name: restaurantName,
    slug: restaurantSlug,
    database_name: 'cloud_d1',
    business_type: 'restaurant',
    country,
    currency,
    timezone,
    plan: 'saas_production',
    status: 'active',
    role: 'owner',
  };

  return Response.json({
    success: true,
    message: 'Restaurant organization registered successfully. Your product catalogue starts empty so you can add your own menu and prices.',
    token,
    access_token: token,
    user: {
      id: userId,
      email,
      name: ownerName,
      role: 'owner',
      organization_id: orgId,
      organization_name: restaurantName,
      currency,
      timezone,
      country,
      assigned_branch_id: branchId,
    },
    tenants: [tenantObj],
    tenant: tenantObj,
    restaurant: {
      id: restaurantId,
      name: restaurantName,
      slug: restaurantSlug,
    },
    branch: {
      id: branchId,
      restaurant_id: restaurantId,
      code: 'BR-01',
      name: 'Main Outlet',
    },
  }, { status: 201 });
}
