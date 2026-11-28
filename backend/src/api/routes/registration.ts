/**
 * Self-Service SaaS Tenant Registration & Onboarding for Order It Up Cloud Edge Worker.
 */

import { Env } from './pairing';
import { createJWT, hashPassword, hashString, isSecretValid } from '../auth';
import { checkRateLimit, createRateLimitResponse, getClientIp } from '../rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface StarterItem {
  name: string;
  sku: string;
  base_price: number;
  tax_rate: number;
}

interface StarterCategory {
  name: string;
  items: StarterItem[];
}

const STARTER_MENUS: Record<string, StarterCategory[]> = {
  qsr: [
    {
      name: 'Signature Burgers & Wraps',
      items: [
        { name: 'Crispy Veg Supreme Burger', sku: 'QSR-01', base_price: 180, tax_rate: 5 },
        { name: 'Smoky Grilled Chicken Burger', sku: 'QSR-02', base_price: 240, tax_rate: 5 },
        { name: 'Paneer Tikka Roll', sku: 'QSR-03', base_price: 160, tax_rate: 5 },
      ],
    },
    {
      name: 'Sides & Fries',
      items: [
        { name: 'Peri-Peri French Fries', sku: 'QSR-04', base_price: 120, tax_rate: 5 },
        { name: 'Cheese Jalapeno Poppers', sku: 'QSR-05', base_price: 150, tax_rate: 5 },
      ],
    },
    {
      name: 'Beverages & Shakes',
      items: [
        { name: 'Belgian Chocolate Shake', sku: 'QSR-06', base_price: 160, tax_rate: 5 },
        { name: 'Chilled Lemon Iced Tea', sku: 'QSR-07', base_price: 100, tax_rate: 5 },
      ],
    },
  ],
  cafe: [
    {
      name: 'Artisanal Coffee & Tea',
      items: [
        { name: 'Espresso Double Shot', sku: 'CAF-01', base_price: 140, tax_rate: 5 },
        { name: 'Classic Cappuccino', sku: 'CAF-02', base_price: 190, tax_rate: 5 },
        { name: 'Vanilla Caramel Latte', sku: 'CAF-03', base_price: 220, tax_rate: 5 },
        { name: 'Masala Chai Latte', sku: 'CAF-04', base_price: 120, tax_rate: 5 },
      ],
    },
    {
      name: 'Fresh Bakery & Pastries',
      items: [
        { name: 'Butter Croissant', sku: 'CAF-05', base_price: 150, tax_rate: 5 },
        { name: 'Blueberry Cheesecake Slice', sku: 'CAF-06', base_price: 240, tax_rate: 5 },
      ],
    },
    {
      name: 'Artisan Sandwiches',
      items: [
        { name: 'Pesto Grilled Mozzarella Panini', sku: 'CAF-07', base_price: 260, tax_rate: 5 },
      ],
    },
  ],
  finedine: [
    {
      name: 'Appetizers & Starters',
      items: [
        { name: 'Truffle Mushroom Bruschetta', sku: 'FD-01', base_price: 320, tax_rate: 5 },
        { name: 'Paneer Malai Tikka', sku: 'FD-02', base_price: 380, tax_rate: 5 },
      ],
    },
    {
      name: 'Signature Mains',
      items: [
        { name: 'Woodfired Margherita Pizza', sku: 'FD-03', base_price: 450, tax_rate: 5 },
        { name: 'Dal Makhani Bukhara', sku: 'FD-04', base_price: 380, tax_rate: 5 },
        { name: 'Butter Garlic Naan', sku: 'FD-05', base_price: 90, tax_rate: 5 },
      ],
    },
    {
      name: 'Desserts & Beverages',
      items: [
        { name: 'Warm Chocolate Lava Cake', sku: 'FD-06', base_price: 260, tax_rate: 5 },
        { name: 'Virgin Mojito Cooler', sku: 'FD-07', base_price: 180, tax_rate: 5 },
      ],
    },
  ],
};

interface PilotInvitationClaim {
  id: string;
  requestId: string;
  tokenHash: string;
  claimId: string;
}

export async function handleRegisterPilotInvitation(request: Request, env: Env): Promise<Response> {
  if (!isSecretValid(env.JWT_SECRET)) {
    return Response.json({ error: 'Server authentication service is misconfigured' }, { status: 500 });
  }
  if (!env.DB.batch) {
    return Response.json({ error: 'Pilot account setup is temporarily unavailable.' }, { status: 503 });
  }
  if (Number(request.headers.get('content-length') || 0) > 4_000) {
    return Response.json({ error: 'Setup request is too large.' }, { status: 413 });
  }

  const redeemLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'pilot_invitation_redeem_ip',
    identifier: getClientIp(request),
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!redeemLimit.allowed) return createRateLimitResponse(redeemLimit);

  let body: any;
  try {
    const raw = await request.text();
    if (raw.length > 4_000) return Response.json({ error: 'Setup request is too large.' }, { status: 413 });
    body = JSON.parse(raw);
  }
  catch { return Response.json({ error: 'Enter a valid setup link and password.' }, { status: 400 }); }
  const token = typeof body?.token === 'string' ? body.token.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[a-f0-9]{64}$/.test(token) || password.length < 8 || password.length > 128) {
    return Response.json({ error: 'This setup link is invalid or expired, or the password does not meet the requirements.' }, { status: 400 });
  }

  const tokenHash = await hashString(token);
  const now = new Date().toISOString();
  let invitation: any;
  try {
    invitation = await env.DB.prepare(`
      SELECT i.id, i.request_id, i.token_hash, r.contact_name, r.restaurant_name, r.email,
             r.phone, r.country, r.restaurant_type
      FROM pilot_access_invitations i
      JOIN pilot_access_requests r ON r.id = i.request_id
      WHERE i.token_hash = ? AND i.expires_at > ? AND i.redeemed_at IS NULL
        AND i.revoked_at IS NULL AND r.status = 'approved'
    `).bind(tokenHash, now).first<any>();
  } catch (error) {
    console.error('[PilotInvitation] Lookup failed:', error);
    return Response.json({ error: 'Pilot account setup is temporarily unavailable. Apply the current Cloud D1 migrations.' }, { status: 503 });
  }
  if (!invitation) {
    return Response.json({ error: 'This setup link is invalid, expired, already used, or no longer approved.' }, { status: 410 });
  }

  const serviceModel = invitation.restaurant_type === 'cafe'
    ? 'cafe'
    : invitation.restaurant_type === 'restaurant' ? 'finedine' : 'qsr';
  const registrationBody = {
    restaurant_name: invitation.restaurant_name,
    owner_name: invitation.contact_name,
    email: invitation.email,
    phone: invitation.phone || undefined,
    password,
    country: invitation.country,
    currency: invitation.country === 'IN' ? 'INR' : 'USD',
    timezone: invitation.country === 'IN' ? 'Asia/Kolkata' : 'UTC',
    service_model: serviceModel,
  };
  const registrationRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(registrationBody),
  });
  return handleRegisterTenant(registrationRequest, env, {
    id: invitation.id,
    requestId: invitation.request_id,
    tokenHash,
    claimId: crypto.randomUUID(),
  });
}

export async function handleRegisterTenant(
  request: Request,
  env: Env,
  pilotInvitation?: PilotInvitationClaim,
): Promise<Response> {
  if (!pilotInvitation && env.ALLOW_SELF_SERVICE_REGISTRATION !== 'true') {
    return Response.json({
      error: 'Restaurant accounts are currently created by invitation. Submit a pilot access request to get started.',
      code: 'PILOT_ACCESS_REQUIRED',
    }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

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
  const serviceModel = typeof body.service_model === 'string' && STARTER_MENUS[body.service_model.toLowerCase()]
    ? body.service_model.toLowerCase()
    : 'qsr';

  // 2. Input validation
  if (!restaurantName || restaurantName.length < 2 || restaurantName.length > 100) {
    return Response.json({ error: 'Restaurant name must be between 2 and 100 characters' }, { status: 400 });
  }
  if (!ownerName || ownerName.length < 2 || ownerName.length > 100) {
    return Response.json({ error: 'Owner name must be between 2 and 100 characters' }, { status: 400 });
  }
  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
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
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const orgId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();
  const subscriptionEventId = crypto.randomUUID();

  // 5. Atomic D1 Batch Transaction
  const statements: any[] = [];
  const restaurantId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const restaurantSlug = restaurantName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/(^-|-$)+/g, '') || 'main';

  if (pilotInvitation) {
    statements.push(env.DB.prepare(`
      UPDATE pilot_access_invitations
      SET redeemed_at = ?, redemption_claim_id = ?
      WHERE id = ? AND request_id = ? AND token_hash = ? AND redeemed_at IS NULL
        AND revoked_at IS NULL AND expires_at > ?
        AND EXISTS (SELECT 1 FROM pilot_access_requests WHERE id = ? AND status = 'approved')
    `).bind(now, pilotInvitation.claimId, pilotInvitation.id, pilotInvitation.requestId, pilotInvitation.tokenHash, now, pilotInvitation.requestId));
  }

  // 5a. Organization. Invitation claims gate this root row inside the same D1
  // batch; dependent rows fail their foreign key checks if a claim is replayed.
  const organizationInsert = pilotInvitation
    ? env.DB.prepare(`
        INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM pilot_access_invitations WHERE id = ? AND redemption_claim_id = ? AND token_hash = ?)
      `).bind(orgId, restaurantName, body.legal_name || restaurantName, body.tax_number || null, currency, country, timezone, now, now,
        pilotInvitation.id, pilotInvitation.claimId, pilotInvitation.tokenHash)
    : env.DB.prepare(`
        INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(orgId, restaurantName, body.legal_name || restaurantName, body.tax_number || null, currency, country, timezone, now, now);
  statements.push(organizationInsert);

  // 5a. New organizations receive a 14-day Starter trial with a price snapshot.
  // The catalog remains the source of future pricing; this snapshot never changes retroactively.
  statements.push(env.DB.prepare(`
    INSERT INTO organization_subscriptions
      (id, organization_id, plan_code, status, billing_cycle, currency, amount_minor, trial_ends_at, created_at, updated_at)
    VALUES (?, ?, 'starter', 'trial', 'monthly', 'INR', 49900, ?, ?, ?)
  `).bind(subscriptionId, orgId, trialEndsAt, now, now));
  statements.push(env.DB.prepare(`
    INSERT INTO subscription_events
      (id, organization_id, subscription_id, event_type, source, event_json, created_at)
    VALUES (?, ?, ?, 'trial_started', 'self_service_registration', '{}', ?)
  `).bind(subscriptionEventId, orgId, subscriptionId, now));

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

  // 5d. Seed Starter Menu Categories and Products
  const starterCategories = STARTER_MENUS[serviceModel] || STARTER_MENUS.qsr;
  let sortOrder = 1;

  for (const cat of starterCategories) {
    const categoryId = crypto.randomUUID();
    statements.push(env.DB.prepare(`
      INSERT INTO master_categories (id, organization_id, name, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).bind(categoryId, orgId, cat.name, sortOrder++, now, now));

    for (const prod of cat.items) {
      const prodId = crypto.randomUUID();
      statements.push(env.DB.prepare(`
        INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
      `).bind(prodId, orgId, categoryId, prod.name, prod.sku, prod.base_price, prod.tax_rate, now, now));
    }
  }

  if (pilotInvitation) {
    statements.push(env.DB.prepare(`
      UPDATE pilot_access_invitations SET organization_id = ?
      WHERE id = ? AND redemption_claim_id = ? AND token_hash = ?
    `).bind(orgId, pilotInvitation.id, pilotInvitation.claimId, pilotInvitation.tokenHash));
    statements.push(env.DB.prepare(`
      INSERT INTO platform_admin_audit_log
        (id, actor_email, action, organization_id, reason, before_json, after_json, created_at)
      VALUES (?, 'system:pilot-invitation', 'pilot_access_request.account_created', ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), orgId,
      'Approved pilot invitation redeemed by the applicant.',
      JSON.stringify({ request_id: pilotInvitation.requestId, status: 'approved' }),
      JSON.stringify({ organization_id: orgId, email }), now,
    ));
  }

  // Execute all atomic statements
  if (typeof env.DB.batch === 'function') {
    try {
      const results = await env.DB.batch(statements);
      if (pilotInvitation && Number((results[0] as any)?.meta?.changes ?? (results[0] as any)?.changes ?? 0) !== 1) {
        return Response.json({ error: 'This setup link has already been used or is no longer approved.' }, { status: 410 });
      }
    } catch (error) {
      if (pilotInvitation) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/FOREIGN KEY constraint failed/i.test(message)) {
          console.error('[PilotInvitation] Atomic account creation failed:', error);
        }
        return Response.json({ error: 'This setup link could not be used. It may have expired or already been redeemed.' }, { status: 410 });
      }
      throw error;
    }
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
    plan: 'starter',
    status: 'trial',
    trial_expires_at: trialEndsAt,
    role: 'owner',
  };

  return Response.json({
    success: true,
    message: 'Restaurant organization registered successfully',
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
