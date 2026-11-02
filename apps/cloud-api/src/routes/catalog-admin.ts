/**
 * Cloud Menu Management Parity
 *
 * Serves the same `/products` and `/categories` contract the desktop POS
 * screens already use, backed by the Cloud master catalog. This lets the web
 * and tablet dashboards manage the menu instead of failing on routes that only
 * existed in the local Express server.
 */

import { Env } from './pairing';
import { UserMembership, isOrgOwnerOrAdmin } from '../rbac';
import { loadProductAddonGroups } from './addons';

const SALE_UNITS = ['each', 'kg', 'g', 'lb'];
const TAX_BEHAVIORS = ['country_default', 'inclusive', 'exclusive', 'exempt'];

function text(value: unknown, maximum = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function bool(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function numberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function canManageMenu(memberships: UserMembership[]): boolean {
  return isOrgOwnerOrAdmin(memberships) || memberships.some((membership) => (
    membership.status === 'active' && ['admin', 'manager', 'branch_manager'].includes(membership.role)
  ));
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'category';
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function forbidden(): Response {
  return Response.json({ error: 'Forbidden: insufficient privileges to manage the menu' }, { status: 403 });
}

function categoryView(row: any) {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: row.slug || slugify(String(row.name)),
    description: row.description ?? null,
    parent_id: null,
    sort_order: Number(row.sort_order || 0),
    is_active: Number(row.is_active) !== 0,
    color: row.color ?? null,
    icon: null,
    product_count: row.product_count === undefined ? undefined : Number(row.product_count),
  };
}

function productView(row: any, addonGroups: any[] = []) {
  let tags: string[] | null = null;
  if (row.tags_json) {
    try {
      const parsed = JSON.parse(row.tags_json);
      if (Array.isArray(parsed)) tags = parsed.map(String);
    } catch { tags = null; }
  }
  const behavior = TAX_BEHAVIORS.includes(String(row.tax_behavior)) ? String(row.tax_behavior) : 'country_default';
  return {
    id: String(row.id),
    category_id: row.category_id ?? null,
    category_name: row.category_name ?? undefined,
    name: String(row.name),
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    sale_unit: SALE_UNITS.includes(String(row.sale_unit)) ? String(row.sale_unit) : 'each',
    allow_fractional_quantity: Number(row.allow_fractional_quantity) === 1,
    weight_precision: Number(row.weight_precision ?? 3),
    description: row.description ?? null,
    price: Number(row.base_price),
    cost_price: row.cost_price === null || row.cost_price === undefined ? null : Number(row.cost_price),
    cb_percent: row.cb_percent === null || row.cb_percent === undefined ? null : Number(row.cb_percent),
    tax_type: behavior === 'exclusive' ? 'exclusive' : behavior === 'exempt' ? 'none' : 'inclusive',
    tax_rate: Number(row.tax_rate || 0),
    tax_category_id: row.tax_category_id ?? null,
    tax_behavior: behavior,
    track_inventory: Number(row.track_inventory) === 1,
    stock_quantity: Number(row.stock_quantity || 0),
    low_stock_threshold: row.low_stock_threshold === null || row.low_stock_threshold === undefined ? null : Number(row.low_stock_threshold),
    is_active: Number(row.is_active) !== 0,
    available_online: true,
    has_image: Boolean(row.image_url),
    image_url: row.image_url ?? null,
    updated_at: row.updated_at,
    tags,
    variants: null,
    modifiers: null,
    sort_order: 0,
    addon_groups: addonGroups,
  };
}

async function listCategories(env: Env, orgId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM master_products p WHERE p.organization_id = c.organization_id AND p.category_id = c.id) AS product_count
    FROM master_categories c
    WHERE c.organization_id = ?
    ORDER BY c.sort_order ASC, c.name ASC
  `).bind(orgId).all<any>();
  return Response.json({ categories: (rows.results || []).map(categoryView) });
}

async function createCategory(request: Request, env: Env, orgId: string): Promise<Response> {
  const body = await readJson(request);
  if (!body) return badRequest('Invalid JSON payload');
  const name = text(body.name, 120);
  if (!name) return badRequest('name is required');
  const duplicate = await env.DB.prepare(`
    SELECT id FROM master_categories WHERE organization_id = ? AND lower(name) = lower(?)
  `).bind(orgId, name).first<any>();
  if (duplicate) return Response.json({ error: 'A category with this name already exists' }, { status: 409 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO master_categories (id, organization_id, name, slug, description, color, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, orgId, name, slugify(name), text(body.description, 500) || null,
    text(body.color, 40) || null, Number(body.sort_order || 0),
    bool(body.is_active, true) ? 1 : 0, now, now,
  ).run();

  return Response.json({ success: true, category: categoryView({ id, name, slug: slugify(name), description: body.description, color: body.color, is_active: 1, sort_order: body.sort_order || 0 }) }, { status: 201 });
}

async function updateCategory(request: Request, env: Env, orgId: string, categoryId: string): Promise<Response> {
  const body = await readJson(request);
  if (!body) return badRequest('Invalid JSON payload');
  const existing = await env.DB.prepare(`
    SELECT * FROM master_categories WHERE id = ? AND organization_id = ?
  `).bind(categoryId, orgId).first<any>();
  if (!existing) return Response.json({ error: 'Category not found' }, { status: 404 });

  const name = body.name === undefined ? existing.name : text(body.name, 120);
  if (!name) return badRequest('name is required');
  if (name.toLowerCase() !== String(existing.name).toLowerCase()) {
    const duplicate = await env.DB.prepare(`
      SELECT id FROM master_categories WHERE organization_id = ? AND lower(name) = lower(?) AND id != ?
    `).bind(orgId, name, categoryId).first<any>();
    if (duplicate) return Response.json({ error: 'A category with this name already exists' }, { status: 409 });
  }

  const isActive = body.is_active === undefined ? Number(existing.is_active) : (bool(body.is_active) ? 1 : 0);
  await env.DB.prepare(`
    UPDATE master_categories SET
      name = ?, slug = COALESCE(?, slug), description = ?, color = ?, sort_order = ?, is_active = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(
    name,
    body.slug === undefined ? null : text(body.slug, 80) || slugify(name),
    body.description === undefined ? existing.description : text(body.description, 500) || null,
    body.color === undefined ? existing.color : text(body.color, 40) || null,
    body.sort_order === undefined ? Number(existing.sort_order || 0) : Number(body.sort_order || 0),
    isActive,
    new Date().toISOString(), categoryId, orgId,
  ).run();

  return Response.json({ success: true, id: categoryId });
}

async function deleteCategory(request: Request, env: Env, orgId: string, categoryId: string): Promise<Response> {
  const url = new URL(request.url);
  const category = await env.DB.prepare(`
    SELECT id, name FROM master_categories WHERE id = ? AND organization_id = ?
  `).bind(categoryId, orgId).first<any>();
  if (!category) return Response.json({ error: 'Category not found' }, { status: 404 });

  const countRow = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM master_products WHERE organization_id = ? AND category_id = ?
  `).bind(orgId, categoryId).first<{ count: number }>();
  const productCount = Number(countRow?.count || 0);
  const action = text(url.searchParams.get('action'), 30);

  if (productCount > 0 && !action) {
    return Response.json({ error: 'Category contains products', productCount }, { status: 400 });
  }

  if (action === 'reassign') {
    const reassignTo = text(url.searchParams.get('reassign_to'), 100);
    if (!reassignTo) return badRequest('reassign_to is required for reassign');
    if (reassignTo === categoryId) return badRequest('Choose a different category to reassign products to');
    const target = await env.DB.prepare(`
      SELECT id FROM master_categories WHERE id = ? AND organization_id = ?
    `).bind(reassignTo, orgId).first<any>();
    if (!target) return badRequest('reassign_to category does not belong to this organization');
    await env.DB.batch([
      env.DB.prepare('UPDATE master_products SET category_id = ?, updated_at = ? WHERE organization_id = ? AND category_id = ?')
        .bind(reassignTo, new Date().toISOString(), orgId, categoryId),
      env.DB.prepare('DELETE FROM master_categories WHERE id = ? AND organization_id = ?').bind(categoryId, orgId),
    ]);
    return Response.json({ success: true, reassigned: productCount });
  }

  if (action === 'delete_all') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM master_products WHERE organization_id = ? AND category_id = ?').bind(orgId, categoryId),
      env.DB.prepare('DELETE FROM master_categories WHERE id = ? AND organization_id = ?').bind(categoryId, orgId),
    ]);
    return Response.json({ success: true, deletedProducts: productCount });
  }

  await env.DB.prepare('DELETE FROM master_categories WHERE id = ? AND organization_id = ?')
    .bind(categoryId, orgId).run();
  return Response.json({ success: true });
}

async function listProducts(env: Env, orgId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT p.*, c.name AS category_name
    FROM master_products p
    LEFT JOIN master_categories c ON c.id = p.category_id
    WHERE p.organization_id = ?
    ORDER BY p.name ASC
  `).bind(orgId).all<any>();
  const productRows = rows.results || [];
  const addonGroups = await loadProductAddonGroups(env.DB, orgId, productRows.map((row: any) => row.id));
  return Response.json({
    products: productRows.map((row: any) => productView(row, addonGroups.get(row.id) || [])),
  });
}

async function validateAddonGroups(env: Env, orgId: string, raw: unknown): Promise<{ ids: string[] } | { error: Response }> {
  if (!Array.isArray(raw)) return { error: badRequest('addon_group_ids must be an array') };
  if (raw.length > 50) return { error: badRequest('Too many modifier groups on one product') };
  const ids = [...new Set(raw.map((value) => text(value, 100)).filter(Boolean))];
  if (ids.length !== raw.length) return { error: badRequest('Modifier group IDs cannot be duplicated or empty') };
  if (ids.length === 0) return { ids: [] };
  const placeholders = ids.map(() => '?').join(',');
  const groups = await env.DB.prepare(`
    SELECT id FROM master_addon_groups
    WHERE organization_id = ? AND is_active = 1 AND id IN (${placeholders})
  `).bind(orgId, ...ids).all<any>();
  if ((groups.results || []).length !== ids.length) {
    return { error: badRequest('One or more modifier groups are unavailable to this organization') };
  }
  return { ids };
}

async function saveProduct(request: Request, env: Env, orgId: string, productId: string | null): Promise<Response> {
  const body = await readJson(request);
  if (!body) return badRequest('Invalid JSON payload');

  const existing = productId
    ? await env.DB.prepare('SELECT * FROM master_products WHERE id = ? AND organization_id = ?').bind(productId, orgId).first<any>()
    : null;
  if (productId && !existing) return Response.json({ error: 'Product not found' }, { status: 404 });

  const name = body.name === undefined ? existing?.name : text(body.name, 200);
  if (!name) return badRequest('name is required');

  const price = numberOrNull(body.price ?? body.base_price) ?? (existing ? Number(existing.base_price) : null);
  if (price === null || price < 0) return badRequest('price must be zero or greater');

  const taxRate = numberOrNull(body.tax_rate) ?? (existing ? Number(existing.tax_rate || 0) : 0);
  if (taxRate < 0 || taxRate > 100) return badRequest('tax_rate must be between 0 and 100');

  const categoryId = body.category_id === undefined ? (existing?.category_id ?? null) : (text(body.category_id, 100) || null);
  if (categoryId) {
    const category = await env.DB.prepare(`
      SELECT id FROM master_categories WHERE id = ? AND organization_id = ?
    `).bind(categoryId, orgId).first<any>();
    if (!category) return badRequest('category_id does not belong to this organization');
  }

  const costPrice = body.cost_price === undefined ? (existing?.cost_price ?? null) : numberOrNull(body.cost_price);
  if (costPrice !== null && costPrice < 0) return badRequest('cost_price must be zero or greater');
  const cashback = body.cb_percent === undefined ? (existing?.cb_percent ?? null) : numberOrNull(body.cb_percent);
  if (cashback !== null && (cashback < 0 || cashback > 100)) return badRequest('cb_percent must be between 0 and 100');
  const stockQuantity = body.stock_quantity === undefined ? Number(existing?.stock_quantity || 0) : Number(body.stock_quantity);
  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) return badRequest('stock_quantity must be zero or greater');
  const lowStock = body.low_stock_threshold === undefined
    ? (existing?.low_stock_threshold ?? null)
    : numberOrNull(body.low_stock_threshold);
  if (lowStock !== null && lowStock < 0) return badRequest('low_stock_threshold must be zero or greater');

  const saleUnit = body.sale_unit === undefined ? (existing?.sale_unit || 'each') : text(body.sale_unit, 10);
  if (!SALE_UNITS.includes(saleUnit)) return badRequest('sale_unit must be each, kg, g, or lb');
  const weightPrecision = body.weight_precision === undefined ? Number(existing?.weight_precision ?? 3) : Number(body.weight_precision);
  if (!Number.isInteger(weightPrecision) || weightPrecision < 0 || weightPrecision > 6) {
    return badRequest('weight_precision must be a whole number between 0 and 6');
  }
  const taxBehavior = body.tax_behavior === undefined ? (existing?.tax_behavior || 'country_default') : text(body.tax_behavior, 30);
  if (!TAX_BEHAVIORS.includes(taxBehavior)) return badRequest('tax_behavior is not supported');

  const tags = body.tags === undefined
    ? (existing?.tags_json ?? null)
    : (Array.isArray(body.tags) ? JSON.stringify(body.tags.map((tag: unknown) => text(tag, 40)).filter(Boolean).slice(0, 30)) : null);
  const imageUrl = body.image_url === undefined ? (existing?.image_url ?? null) : (text(body.image_url, 1_500_000) || null);

  let addonIds: string[] | null = null;
  if (body.addon_group_ids !== undefined) {
    const validated = await validateAddonGroups(env, orgId, body.addon_group_ids);
    if ('error' in validated) return validated.error;
    addonIds = validated.ids;
  }

  const id = productId || crypto.randomUUID();
  const now = new Date().toISOString();
  const isActive = body.is_active === undefined
    ? (existing ? Number(existing.is_active) : 1)
    : (bool(body.is_active) ? 1 : 0);

  const statement = env.DB.prepare(`
    INSERT INTO master_products (
      id, organization_id, category_id, name, sku, barcode, base_price, tax_rate, is_active, version,
      description, cost_price, sale_unit, allow_fractional_quantity, weight_precision, tax_category_id,
      tax_behavior, cb_percent, track_inventory, stock_quantity, low_stock_threshold, tags_json, image_url,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      name = excluded.name,
      sku = excluded.sku,
      barcode = excluded.barcode,
      base_price = excluded.base_price,
      tax_rate = excluded.tax_rate,
      is_active = excluded.is_active,
      version = master_products.version + 1,
      description = excluded.description,
      cost_price = excluded.cost_price,
      sale_unit = excluded.sale_unit,
      allow_fractional_quantity = excluded.allow_fractional_quantity,
      weight_precision = excluded.weight_precision,
      tax_category_id = excluded.tax_category_id,
      tax_behavior = excluded.tax_behavior,
      cb_percent = excluded.cb_percent,
      track_inventory = excluded.track_inventory,
      stock_quantity = excluded.stock_quantity,
      low_stock_threshold = excluded.low_stock_threshold,
      tags_json = excluded.tags_json,
      image_url = excluded.image_url,
      updated_at = excluded.updated_at
  `).bind(
    id, orgId, categoryId, name,
    body.sku === undefined ? (existing?.sku ?? null) : (text(body.sku, 80) || null),
    body.barcode === undefined ? (existing?.barcode ?? null) : (text(body.barcode, 80) || null),
    price, taxRate, isActive,
    body.description === undefined ? (existing?.description ?? null) : (text(body.description, 1000) || null),
    costPrice, saleUnit, bool(body.allow_fractional_quantity, Number(existing?.allow_fractional_quantity) === 1) ? 1 : 0,
    weightPrecision,
    body.tax_category_id === undefined ? (existing?.tax_category_id ?? null) : (text(body.tax_category_id, 100) || null),
    taxBehavior, cashback,
    bool(body.track_inventory, Number(existing?.track_inventory) === 1) ? 1 : 0,
    stockQuantity, lowStock, tags, imageUrl, now, now,
  );

  const statements = [statement];
  if (addonIds !== null) {
    statements.push(env.DB.prepare('DELETE FROM master_product_addon_groups WHERE organization_id = ? AND product_id = ?').bind(orgId, id));
    addonIds.forEach((groupId, index) => {
      statements.push(env.DB.prepare(`
        INSERT INTO master_product_addon_groups (organization_id, product_id, addon_group_id, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(orgId, id, groupId, index, now));
    });
  }
  await env.DB.batch(statements);

  return Response.json({ success: true, id }, { status: productId ? 200 : 201 });
}

async function deleteProduct(env: Env, orgId: string, productId: string): Promise<Response> {
  const product = await env.DB.prepare(`
    SELECT id FROM master_products WHERE id = ? AND organization_id = ?
  `).bind(productId, orgId).first<any>();
  if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });
  await env.DB.prepare('DELETE FROM master_products WHERE id = ? AND organization_id = ?')
    .bind(productId, orgId).run();
  return Response.json({ success: true });
}

/**
 * Handles the desktop-compatible menu management contract. Returns null when
 * the path is not owned by this module.
 */
export async function handleCatalogAdminRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  claims: any,
  memberships: UserMembership[],
): Promise<Response | null> {
  const orgId = claims.org;
  const isMenuPath = path === '/api/products'
    || path.startsWith('/api/products/')
    || path === '/api/categories'
    || path.startsWith('/api/categories/');
  if (!isMenuPath) return null;

  const readOnly = method === 'GET';
  if (!readOnly && !canManageMenu(memberships)) return forbidden();

  if (path === '/api/categories' && method === 'GET') return listCategories(env, orgId);
  if (path === '/api/categories' && method === 'POST') return createCategory(request, env, orgId);
  const categoryMatch = path.match(/^\/api\/categories\/([^/]+)$/);
  if (categoryMatch && method === 'PUT') return updateCategory(request, env, orgId, decodeURIComponent(categoryMatch[1]));
  if (categoryMatch && method === 'DELETE') return deleteCategory(request, env, orgId, decodeURIComponent(categoryMatch[1]));

  if (path === '/api/products' && method === 'GET') return listProducts(env, orgId);
  if (path === '/api/products' && method === 'POST') return saveProduct(request, env, orgId, null);
  const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && method === 'PUT') return saveProduct(request, env, orgId, decodeURIComponent(productMatch[1]));
  if (productMatch && method === 'DELETE') return deleteProduct(env, orgId, decodeURIComponent(productMatch[1]));

  return null;
}
