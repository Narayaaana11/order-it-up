import { createJWT, isSecretValid } from '../auth';
import { STARTER_MENUS } from './registration';
import { Env } from './pairing';
import { checkRateLimit, createRateLimitResponse, getClientIp } from '../rate-limit';

type GoogleClaims = {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  exp?: number;
  iat?: number;
};

type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

let cachedGoogleKeys: { keys: GoogleJwk[]; expiresAt: number } | null = null;

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid token encoding');
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = base64.length % 4;
  if (remainder === 2) base64 += '==';
  else if (remainder === 3) base64 += '=';
  else if (remainder !== 0) throw new Error('Invalid token encoding');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

async function getGoogleKey(kid: string): Promise<GoogleJwk | null> {
  const now = Date.now();
  if (!cachedGoogleKeys || cachedGoogleKeys.expiresAt <= now) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Google signing keys are unavailable');
    const data = await response.json() as { keys?: GoogleJwk[] };
    if (!Array.isArray(data.keys)) throw new Error('Google signing keys are invalid');
    cachedGoogleKeys = { keys: data.keys, expiresAt: now + 60 * 60 * 1000 };
  }
  return cachedGoogleKeys.keys.find((key) => key.kid === kid && key.alg === 'RS256' && key.use === 'sig') || null;
}

/** Verify Google's signed ID token; never trust profile fields supplied separately by the browser. */
export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleClaims> {
  if (!idToken || idToken.length > 12000) throw new Error('Invalid Google credential');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid Google credential');

  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Google credential');
  const claims = decodeJson<GoogleClaims>(parts[1]);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (!audiences.includes(clientId) ||
      (claims.azp && claims.azp !== clientId) ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss || '') ||
      !claims.sub ||
      !claims.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) ||
      !(claims.email_verified === true || claims.email_verified === 'true') ||
      typeof claims.exp !== 'number' ||
      claims.exp <= nowSeconds ||
      (typeof claims.iat === 'number' && claims.iat > nowSeconds + 60)) {
    throw new Error('Google credential claims are invalid');
  }

  const jwk = await getGoogleKey(header.kid);
  if (!jwk) throw new Error('Google signing key was not found');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]),
  );
  if (!valid) throw new Error('Google credential signature is invalid');
  return claims;
}

function tenantFromUser(user: any) {
  return {
    id: user.organization_id,
    name: user.organization_name,
    business_name: user.organization_name,
    slug: (user.organization_name || 'store').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/(^-|-$)+/g, '') || 'store',
    database_name: 'cloud_d1',
    business_type: 'restaurant',
    country: user.country || 'IN',
    currency: user.currency || 'INR',
    timezone: user.timezone || 'Asia/Kolkata',
    plan: 'saas_production',
    status: 'active',
    role: user.role,
  };
}

async function createGoogleTenant(
  requestBody: any,
  env: Env,
  claims: GoogleClaims,
): Promise<any> {
  const restaurantName = typeof requestBody.restaurant_name === 'string' ? requestBody.restaurant_name.trim() : '';
  const ownerName = typeof requestBody.owner_name === 'string' && requestBody.owner_name.trim()
    ? requestBody.owner_name.trim()
    : (claims.name || claims.email || '').trim();
  if (restaurantName.length < 2 || restaurantName.length > 100) {
    throw new Error('A restaurant name between 2 and 100 characters is required to create a new account');
  }
  if (ownerName.length < 2 || ownerName.length > 100) {
    throw new Error('A valid owner or manager name is required');
  }

  const serviceModel = typeof requestBody.service_model === 'string' && STARTER_MENUS[requestBody.service_model.toLowerCase()]
    ? requestBody.service_model.toLowerCase()
    : 'qsr';
  const country = typeof requestBody.country === 'string' && /^[A-Z]{2}$/.test(requestBody.country.toUpperCase())
    ? requestBody.country.toUpperCase()
    : 'IN';
  const currency = typeof requestBody.currency === 'string' && /^[A-Z]{3}$/.test(requestBody.currency.toUpperCase())
    ? requestBody.currency.toUpperCase()
    : 'INR';
  const timezone = typeof requestBody.timezone === 'string' && requestBody.timezone.length <= 80
    ? requestBody.timezone
    : 'Asia/Kolkata';

  const now = new Date().toISOString();
  const orgId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const restaurantSlug = restaurantName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/(^-|-$)+/g, '') || 'main';
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO organizations (id, name, legal_name, tax_number, currency, country, timezone, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
    `).bind(orgId, restaurantName, restaurantName, currency, country, timezone, now, now),
    env.DB.prepare(`
      INSERT INTO restaurants (id, organization_id, name, slug, concept_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(restaurantId, orgId, restaurantName, restaurantSlug, serviceModel, now, now),
    env.DB.prepare(`
      INSERT INTO branches (id, organization_id, code, name, is_main_branch, address, phone, email, status, created_at, updated_at)
      VALUES (?, ?, 'BR-01', 'Main Outlet', 1, NULL, NULL, ?, 'active', ?, ?)
    `).bind(branchId, orgId, claims.email!.toLowerCase(), now, now),
    env.DB.prepare(`
      INSERT INTO cloud_users (id, organization_id, email, password_hash, google_sub, name, role, assigned_branch_id, status, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?, 'owner', ?, 'active', ?, ?, ?)
    `).bind(userId, orgId, claims.email!.toLowerCase(), claims.sub!, ownerName, branchId, now, now, now),
    env.DB.prepare(`
      INSERT INTO memberships (id, organization_id, user_id, restaurant_id, branch_id, role, status, created_at, updated_at)
      VALUES (?, ?, ?, NULL, NULL, 'owner', 'active', ?, ?)
    `).bind(membershipId, orgId, userId, now, now),
  ];

  for (const category of STARTER_MENUS[serviceModel] || STARTER_MENUS.qsr) {
    const categoryId = crypto.randomUUID();
    statements.push(env.DB.prepare(`
      INSERT INTO master_categories (id, organization_id, name, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).bind(categoryId, orgId, category.name, statements.length, now, now));
    for (const product of category.items) {
      statements.push(env.DB.prepare(`
        INSERT INTO master_products (id, organization_id, category_id, name, sku, base_price, tax_rate, is_active, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
      `).bind(crypto.randomUUID(), orgId, categoryId, product.name, product.sku, product.base_price, product.tax_rate, now, now));
    }
  }

  await env.DB.batch(statements);
  return env.DB.prepare(`
    SELECT u.id, u.organization_id, u.email, u.name, u.role, u.assigned_branch_id,
      o.name AS organization_name, o.currency, o.timezone, o.country
    FROM cloud_users u JOIN organizations o ON u.organization_id = o.id
    WHERE u.id = ?
  `).bind(userId).first<any>();
}

export async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  if (!isSecretValid(env.JWT_SECRET)) {
    return Response.json({ error: 'Server authentication service is misconfigured' }, { status: 500 });
  }
  if (!env.GOOGLE_CLIENT_ID) {
    return Response.json({ error: 'Google sign-in is not configured on the server yet' }, { status: 503 });
  }

  const rateLimit = await checkRateLimit(env.DB, {
    keyPrefix: 'google_auth_ip',
    identifier: getClientIp(request),
    limit: 20,
    windowSeconds: 900,
  });
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'A Google credential is required' }, { status: 400 });
  }
  const credential = typeof body?.credential === 'string' ? body.credential : '';
  let googleClaims: GoogleClaims;
  try {
    googleClaims = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
  } catch {
    return Response.json({ error: 'Google sign-in could not verify your account. Please try again.' }, { status: 401 });
  }

  const email = googleClaims.email!.toLowerCase();
  let user = await env.DB.prepare(`
    SELECT u.id, u.organization_id, u.email, u.google_sub, u.name, u.role, u.assigned_branch_id, u.status,
      o.name AS organization_name, o.currency, o.timezone, o.country
    FROM cloud_users u JOIN organizations o ON u.organization_id = o.id
    WHERE u.google_sub = ?
  `).bind(googleClaims.sub!).first<any>();

  if (!user) {
    user = await env.DB.prepare(`
      SELECT u.id, u.organization_id, u.email, u.google_sub, u.name, u.role, u.assigned_branch_id, u.status,
        o.name AS organization_name, o.currency, o.timezone, o.country
      FROM cloud_users u JOIN organizations o ON u.organization_id = o.id
      WHERE lower(u.email) = ?
    `).bind(email).first<any>();
  }

  if (user && user.status !== 'active') {
    return Response.json({ error: 'This account is not active. Contact the Order It Up team.' }, { status: 403 });
  }
  if (user?.google_sub && user.google_sub !== googleClaims.sub) {
    return Response.json({ error: 'This email is already linked to a different Google account.' }, { status: 409 });
  }

  if (!user) {
    const restaurantName = typeof body.restaurant_name === 'string' ? body.restaurant_name.trim() : '';
    if (!restaurantName) {
      return Response.json({
        error: 'No Order It Up account was found. Start registration with your restaurant details.',
        code: 'GOOGLE_REGISTRATION_REQUIRED',
      }, { status: 409 });
    }
    try {
      user = await createGoogleTenant(body, env, googleClaims);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google registration could not be completed';
      return Response.json({ error: message }, { status: 400 });
    }
  } else if (!user.google_sub) {
    try {
      await env.DB.prepare(`
        UPDATE cloud_users SET google_sub = ?, last_login_at = ?, updated_at = ?
        WHERE id = ? AND (google_sub IS NULL OR google_sub = ?)
      `).bind(googleClaims.sub!, new Date().toISOString(), new Date().toISOString(), user.id, googleClaims.sub!).run();
      user.google_sub = googleClaims.sub;
    } catch {
      return Response.json({ error: 'This account could not be linked to Google. Contact support.' }, { status: 409 });
    }
  }

  if (!user) return Response.json({ error: 'Unable to load the account after sign-in' }, { status: 500 });
  if (user.status && user.status !== 'active') {
    return Response.json({ error: 'This account is not active' }, { status: 403 });
  }

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE cloud_users SET last_login_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, user.id).run();

  const token = await createJWT({
    sub: user.id,
    org: user.organization_id,
    email: user.email,
    role: user.role,
    branch: user.assigned_branch_id || null,
    exp: Math.floor(Date.now() / 1000) + (7 * 86400),
  }, env.JWT_SECRET);

  const tenant = tenantFromUser(user);
  return Response.json({
    success: true,
    token,
    access_token: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
      currency: user.currency,
      timezone: user.timezone,
      country: user.country,
      assigned_branch_id: user.assigned_branch_id || null,
    },
    tenants: [tenant],
    tenant,
  });
}
