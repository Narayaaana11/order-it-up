import { Env } from './pairing';

export async function handleGetMasterCatalog(request: Request, env: Env, orgId: string): Promise<Response> {
  const categories = await env.DB.prepare(`
    SELECT * FROM master_categories WHERE organization_id = ? ORDER BY sort_order ASC, name ASC
  `).bind(orgId).all();

  const products = await env.DB.prepare(`
    SELECT p.*, c.name as category_name
    FROM master_products p
    LEFT JOIN master_categories c ON p.category_id = c.id
    WHERE p.organization_id = ?
    ORDER BY p.name ASC
  `).bind(orgId).all();

  return Response.json({
    categories: categories.results,
    products: products.results
  });
}

export async function handleSaveMasterProduct(request: Request, env: Env, orgId: string): Promise<Response> {
  const body = await request.json() as any;
  if (!body.name || body.base_price === undefined) {
    return Response.json({ error: 'name and base_price are required' }, { status: 400 });
  }

  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO master_products (
      id, organization_id, category_id, name, sku, barcode,
      base_price, tax_rate, is_active, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      name = excluded.name,
      sku = excluded.sku,
      barcode = excluded.barcode,
      base_price = excluded.base_price,
      tax_rate = excluded.tax_rate,
      is_active = excluded.is_active,
      version = master_products.version + 1,
      updated_at = excluded.updated_at
  `).bind(
    id,
    orgId,
    body.category_id || null,
    body.name,
    body.sku || null,
    body.barcode || null,
    Number(body.base_price),
    Number(body.tax_rate || 0),
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
    1,
    now,
    now
  ).run();

  return Response.json({ success: true, id });
}

export async function handleGetBranchCatalog(request: Request, env: Env, branchId: string, orgId?: string): Promise<Response> {
  const branchQuery = orgId
    ? 'SELECT organization_id, name FROM branches WHERE id = ? AND organization_id = ?'
    : 'SELECT organization_id, name FROM branches WHERE id = ?';
  const branchParams = orgId ? [branchId, orgId] : [branchId];

  const branch = await env.DB.prepare(branchQuery)
    .bind(...branchParams).first<{ organization_id: string; name: string }>();

  if (!branch) {
    return Response.json({ error: 'Branch not found or belongs to another organization' }, { status: 404 });
  }

  // Get master products joined with branch overrides
  const items = await env.DB.prepare(`
    SELECT
      p.id,
      p.name,
      p.category_id,
      p.sku,
      p.barcode,
      p.base_price,
      p.tax_rate,
      p.is_active as master_is_active,
      o.price_override,
      COALESCE(o.is_available, 1) as is_available,
      COALESCE(o.price_override, p.base_price) as effective_price
    FROM master_products p
    LEFT JOIN branch_product_overrides o ON (o.product_id = p.id AND o.branch_id = ?)
    WHERE p.organization_id = ? AND p.is_active = 1
    ORDER BY p.name ASC
  `).bind(branchId, branch.organization_id).all();

  return Response.json({
    branch_id: branchId,
    branch_name: branch.name,
    catalog: items.results
  });
}

export async function handleSetBranchOverride(request: Request, env: Env, branchId: string, orgId?: string): Promise<Response> {
  const body = await request.json() as {
    product_id: string;
    price_override?: number | null;
    is_available?: boolean;
  };

  if (!body.product_id) {
    return Response.json({ error: 'product_id is required' }, { status: 400 });
  }

  if (orgId) {
    const branch = await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND organization_id = ?')
      .bind(branchId, orgId).first();
    if (!branch) {
      return Response.json({ error: 'Branch not found or belongs to another organization' }, { status: 404 });
    }

    const product = await env.DB.prepare('SELECT id FROM master_products WHERE id = ? AND organization_id = ?')
      .bind(body.product_id, orgId).first();
    if (!product) {
      return Response.json({ error: 'Product not found or belongs to another organization' }, { status: 404 });
    }
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO branch_product_overrides (branch_id, product_id, price_override, is_available, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(branch_id, product_id) DO UPDATE SET
      price_override = excluded.price_override,
      is_available = excluded.is_available,
      updated_at = excluded.updated_at
  `).bind(
    branchId,
    body.product_id,
    body.price_override !== undefined ? body.price_override : null,
    body.is_available !== undefined ? (body.is_available ? 1 : 0) : 1,
    now
  ).run();

  return Response.json({ success: true, branch_id: branchId, product_id: body.product_id });
}
