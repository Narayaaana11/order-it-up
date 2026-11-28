/**
 * Cloud Menu CSV Import/Export
 *
 * Implements the desktop `/menu-csv` contract for the product dashboard:
 * downloadable templates, category/product/modifier exports, and safe imports
 * with per-row validation errors instead of partial silent writes.
 */

import { Env } from './pairing';
import { UserMembership, isOrgOwnerOrAdmin } from '../rbac';

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;

const TEMPLATES: Record<string, string> = {
  categories: [
    'name,description,color,icon,sort_order',
    'Beverages,Hot and cold drinks,blue,,1',
    'Food,Snacks and meals,green,,2',
    'Desserts,Sweet treats,pink,,3',
  ].join('\n'),
  products: [
    'id,sku,name,category,price,description,cost,tax_category,tax_behavior,cashback_percent,tags,is_active',
    ',,Cappuccino,Beverages,150,Rich espresso with steamed milk,50,,,,"veg,bestseller",yes',
    ',,Classic Burger,Food,250,Juicy patty,100,,,,non_veg,yes',
  ].join('\n'),
  addons: [
    'group_name,addon_name,price,group_required,group_min_select,group_max_select',
    'Size,Regular,20,no,1,1',
    'Milk Type,Oat Milk,30,yes,1,1',
  ].join('\n'),
};

type CsvRow = string[];

/** Minimal RFC4180 parser: quoted cells, escaped quotes, embedded newlines. */
function parseCsv(input: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"' && cell === '') { quoted = true; continue; }
    if (char === ',') { row.push(cell); cell = ''; continue; }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (char === '\r') continue;
    cell += char;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((line) => line.some((value) => value.trim() !== ''));
}

function toObjects(rows: CsvRow[]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { record[header] = (row[index] ?? '').trim(); });
    return record;
  });
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value !== 'number' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvDocument(header: string, rows: unknown[][]): string {
  return [header, ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

function truthy(value: string | undefined): boolean {
  if (value === undefined || value === '') return true;
  return ['yes', 'true', '1'].includes(value.toLowerCase());
}

function canManage(memberships: UserMembership[]): boolean {
  return isOrgOwnerOrAdmin(memberships) || memberships.some((membership) => (
    membership.status === 'active' && ['admin', 'manager', 'branch_manager'].includes(membership.role)
  ));
}

async function readBody(request: Request): Promise<{ csv?: string; error?: string }> {
  try {
    const body = await request.json() as { csv?: unknown };
    if (typeof body?.csv !== 'string' || !body.csv.trim()) return { error: 'No CSV data provided' };
    if (body.csv.length > MAX_CSV_BYTES) return { error: 'CSV file is too large (2 MB limit)' };
    return { csv: body.csv };
  } catch {
    return { error: 'Invalid JSON payload' };
  }
}

async function exportCsv(env: Env, orgId: string, type: string): Promise<Response> {
  if (type === 'categories') {
    const rows = await env.DB.prepare(`
      SELECT name, description, color, sort_order FROM master_categories
      WHERE organization_id = ? ORDER BY sort_order ASC, name ASC
    `).bind(orgId).all<any>();
    const document = csvDocument('name,description,color,icon,sort_order',
      (rows.results || []).map((row: any) => [row.name, row.description, row.color, '', row.sort_order]));
    return new Response(document, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="categories-export.csv"' } });
  }
  if (type === 'products') {
    const rows = await env.DB.prepare(`
      SELECT p.*, c.name AS category_name FROM master_products p
      LEFT JOIN master_categories c ON c.id = p.category_id
      WHERE p.organization_id = ? ORDER BY c.sort_order ASC, p.name ASC
    `).bind(orgId).all<any>();
    const document = csvDocument('id,sku,name,category,price,description,cost,tax_category,tax_behavior,cashback_percent,tags,is_active',
      (rows.results || []).map((row: any) => {
        let tags = '';
        if (row.tags_json) { try { const parsed = JSON.parse(row.tags_json); tags = Array.isArray(parsed) ? parsed.join(',') : ''; } catch { tags = ''; } }
        return [row.id, row.sku, row.name, row.category_name, row.base_price, row.description, row.cost_price,
          row.tax_category_id || '', row.tax_behavior || '', row.cb_percent ?? '', tags, Number(row.is_active) ? 'yes' : 'no'];
      }));
    return new Response(document, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="products-export.csv"' } });
  }
  if (type === 'addons') {
    const rows = await env.DB.prepare(`
      SELECT g.name AS group_name, a.name AS addon_name, a.price,
             g.is_required, g.min_selection, g.max_selection
      FROM master_addon_groups g
      JOIN master_addons a ON a.addon_group_id = g.id AND a.organization_id = g.organization_id AND a.is_active = 1
      WHERE g.organization_id = ? AND g.is_active = 1
      ORDER BY g.sort_order ASC, g.name ASC, a.sort_order ASC, a.name ASC
    `).bind(orgId).all<any>();
    const document = csvDocument('group_name,addon_name,price,group_required,group_min_select,group_max_select',
      (rows.results || []).map((row: any) => [row.group_name, row.addon_name, row.price,
        Number(row.is_required) ? 'yes' : 'no', row.min_selection, row.max_selection]));
    return new Response(document, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="addons-export.csv"' } });
  }
  return Response.json({ error: 'Unknown export type' }, { status: 404 });
}

async function importCategories(env: Env, orgId: string, records: Record<string, string>[]) {
  let created = 0; let updated = 0; let skipped = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const name = (record.name || '').slice(0, 120);
    if (!name) { skipped += 1; errors.push(`Row ${index + 2}: missing name`); continue; }
    const sortOrder = Number(record.sort_order || 0);
    const existing = record.id
      ? await env.DB.prepare('SELECT id FROM master_categories WHERE id = ? AND organization_id = ?').bind(record.id, orgId).first<any>()
      : await env.DB.prepare('SELECT id FROM master_categories WHERE organization_id = ? AND lower(name) = lower(?)').bind(orgId, name).first<any>();
    if (existing) {
      await env.DB.prepare(`
        UPDATE master_categories SET name = ?, description = ?, color = ?, sort_order = ?, updated_at = ? WHERE id = ?
      `).bind(name, record.description || null, record.color || null, Number.isFinite(sortOrder) ? sortOrder : 0, now, existing.id).run();
      updated += 1;
    } else {
      await env.DB.prepare(`
        INSERT INTO master_categories (id, organization_id, name, slug, description, color, sort_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).bind(crypto.randomUUID(), orgId, name, name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'category',
        record.description || null, record.color || null, Number.isFinite(sortOrder) ? sortOrder : 0, now, now).run();
      created += 1;
    }
  }
  return { created, updated, skipped, failed: 0, groups_created: 0, addons_created: 0, errors, warnings: [] };
}

async function importProducts(env: Env, orgId: string, records: Record<string, string>[]) {
  let created = 0; let updated = 0; let skipped = 0;
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const categories = await env.DB.prepare('SELECT id, name FROM master_categories WHERE organization_id = ?').bind(orgId).all<any>();
  const categoryByName = new Map((categories.results || []).map((row: any) => [String(row.name).toLowerCase(), row.id]));
  let warnedTax = false;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const name = (record.name || '').slice(0, 200);
    if (!name) { skipped += 1; errors.push(`Row ${index + 2}: missing name`); continue; }
    const price = Number(record.price);
    if (!Number.isFinite(price) || price < 0) { skipped += 1; errors.push(`Row ${index + 2} (${name}): price must be zero or greater`); continue; }
    const categoryId = record.category ? categoryByName.get(record.category.toLowerCase()) : null;
    if (record.category && !categoryId) {
      skipped += 1; errors.push(`Row ${index + 2} (${name}): category "${record.category}" not found — import categories first`); continue;
    }
    const cost = record.cost === '' ? null : Number(record.cost);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) { skipped += 1; errors.push(`Row ${index + 2} (${name}): cost must be zero or greater`); continue; }
    const cashback = record.cashback_percent === '' ? null : Number(record.cashback_percent);
    if (cashback !== null && (!Number.isFinite(cashback) || cashback < 0 || cashback > 100)) {
      skipped += 1; errors.push(`Row ${index + 2} (${name}): cashback_percent must be between 0 and 100`); continue;
    }
    const tags = record.tags ? JSON.stringify(record.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 30)) : null;
    const isActive = truthy(record.is_active) ? 1 : 0;
    if (record.tax_category && !warnedTax) {
      warnedTax = true;
      warnings.push('Tax category IDs are stored as supplied; Cloud tax-rule validation is not implemented yet.');
    }

    const existing = record.id
      ? await env.DB.prepare('SELECT id FROM master_products WHERE id = ? AND organization_id = ?').bind(record.id, orgId).first<any>()
      : await env.DB.prepare('SELECT id FROM master_products WHERE organization_id = ? AND lower(name) = lower(?)').bind(orgId, name).first<any>();

    if (existing) {
      await env.DB.prepare(`
        UPDATE master_products SET name = ?, category_id = ?, sku = ?, base_price = ?, tax_category_id = ?,
          tax_behavior = ?, cost_price = ?, cb_percent = ?, tags_json = ?, is_active = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).bind(name, categoryId, record.sku || null, price, record.tax_category || null,
        record.tax_behavior || 'country_default', cost, cashback, tags, isActive, now, existing.id, orgId).run();
      updated += 1;
    } else {
      await env.DB.prepare(`
        INSERT INTO master_products (
          id, organization_id, category_id, name, sku, barcode, base_price, tax_rate, is_active, version,
          description, cost_price, sale_unit, allow_fractional_quantity, weight_precision, tax_category_id,
          tax_behavior, cb_percent, track_inventory, stock_quantity, low_stock_threshold, tags_json, image_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, 1, ?, ?, 'each', 0, 3, ?, ?, ?, 0, 0, NULL, ?, NULL, ?, ?)
      `).bind(crypto.randomUUID(), orgId, categoryId, name, record.sku || null, price, isActive,
        record.description || null, cost, record.tax_category || null, record.tax_behavior || 'country_default',
        cashback, tags, now, now).run();
      created += 1;
    }
  }
  return { created, updated, skipped, failed: 0, groups_created: 0, addons_created: 0, errors, warnings };
}

async function importAddons(env: Env, orgId: string, records: Record<string, string>[]) {
  let groupsCreated = 0; let addonsCreated = 0; let updatedAddons = 0; let skipped = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();
  const groupIds = new Map<string, string>();
  const groups = await env.DB.prepare('SELECT id, name FROM master_addon_groups WHERE organization_id = ?').bind(orgId).all<any>();
  for (const group of groups.results || []) groupIds.set(String(group.name).toLowerCase(), group.id);

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const groupName = (record.group_name || '').slice(0, 120);
    const addonName = (record.addon_name || '').slice(0, 120);
    if (!groupName || !addonName) { skipped += 1; errors.push(`Row ${index + 2}: group_name and addon_name are required`); continue; }
    const price = Number(record.price || 0);
    if (!Number.isFinite(price) || price < 0) { skipped += 1; errors.push(`Row ${index + 2} (${addonName}): price must be zero or greater`); continue; }
    const min = Math.max(0, Number(record.group_min_select || 0) || 0);
    const max = Math.max(min, Number(record.group_max_select || 1) || 1);

    let groupId = groupIds.get(groupName.toLowerCase());
    if (!groupId) {
      groupId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO master_addon_groups (id, organization_id, name, description, is_required, allow_multiple_quantities, min_selection, max_selection, sort_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, 0, ?, ?, 0, 1, ?, ?)
      `).bind(groupId, orgId, groupName, truthy(record.group_required) ? 1 : 0, min, max, now, now).run();
      groupIds.set(groupName.toLowerCase(), groupId);
      groupsCreated += 1;
    }

    const existing = await env.DB.prepare(`
      SELECT id FROM master_addons WHERE organization_id = ? AND addon_group_id = ? AND lower(name) = lower(?)
    `).bind(orgId, groupId, addonName).first<any>();
    if (existing) {
      await env.DB.prepare('UPDATE master_addons SET price = ?, is_active = 1, updated_at = ? WHERE id = ?')
        .bind(price, now, existing.id).run();
      updatedAddons += 1;
    } else {
      await env.DB.prepare(`
        INSERT INTO master_addons (id, organization_id, addon_group_id, name, price, is_active, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
      `).bind(crypto.randomUUID(), orgId, groupId, addonName, price, now, now).run();
      addonsCreated += 1;
    }
  }
  return { created: 0, updated: updatedAddons, skipped, failed: 0, groups_created: groupsCreated, addons_created: addonsCreated, errors, warnings: [] };
}

/**
 * Routes `/api/menu-csv/*`. Returns null when the path is not owned here.
 */
export async function handleMenuCsvRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  claims: any,
  memberships: UserMembership[],
): Promise<Response | null> {
  if (!path.startsWith('/api/menu-csv/')) return null;
  if (!canManage(memberships)) {
    return Response.json({ error: 'Forbidden: only owners and managers can import or export menus' }, { status: 403 });
  }

  const templateMatch = path.match(/^\/api\/menu-csv\/template\/([a-z]+)$/);
  if (templateMatch && method === 'GET') {
    const template = TEMPLATES[templateMatch[1]];
    if (!template) return Response.json({ error: 'Unknown template type' }, { status: 404 });
    return new Response(template, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${templateMatch[1]}-template.csv"` } });
  }

  const exportMatch = path.match(/^\/api\/menu-csv\/export\/([a-z]+)$/);
  if (exportMatch && method === 'GET') return exportCsv(env, claims.org, exportMatch[1]);

  const importMatch = path.match(/^\/api\/menu-csv\/import\/([a-z]+)$/);
  if (importMatch && method === 'POST') {
    const type = importMatch[1];
    if (!['categories', 'products', 'addons'].includes(type)) return Response.json({ error: 'Unknown import type' }, { status: 404 });
    const body = await readBody(request);
    if (body.error || !body.csv) return Response.json({ error: body.error }, { status: 400 });
    const parsed = parseCsv(body.csv);
    if (parsed.length < 2) return Response.json({ error: 'CSV has no data rows' }, { status: 400 });
    if (parsed.length - 1 > MAX_ROWS) return Response.json({ error: `CSV has more than ${MAX_ROWS} data rows` }, { status: 400 });
    const records = toObjects(parsed);
    const result = type === 'categories'
      ? await importCategories(env, claims.org, records)
      : type === 'products'
        ? await importProducts(env, claims.org, records)
        : await importAddons(env, claims.org, records);
    return Response.json(result);
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
