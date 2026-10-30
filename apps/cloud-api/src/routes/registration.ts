/**
 * Self-Service SaaS Tenant Registration & Onboarding for Order It Up Cloud Edge Worker.
 */

import { Env } from './pairing';
import { createJWT, hashPassword, isSecretValid } from '../auth';
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

  return Response.json({
    success: true,
    message: 'Restaurant organization registered successfully',
    token,
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
