import { Env } from './pairing';

function groupInput(body: any): { name: string; description: string | null; required: number; multiple: number; min: number; max: number; sort: number; active: number } | null {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const min = Number(body?.min_selection ?? (body?.is_required ? 1 : 0));
  const max = Number(body?.max_selection ?? 1);
  if (!name || name.length > 120 || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || max > 100) return null;
  return {
    name,
    description: typeof body.description === 'string' ? body.description.trim().slice(0, 500) || null : null,
    required: body.is_required ? 1 : 0,
    multiple: body.allow_multiple_quantities ? 1 : 0,
    min,
    max,
    sort: Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    active: body.is_active === false ? 0 : 1,
  };
}

function addonInput(body: any): { name: string; price: number; sort: number; active: number } | null {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const price = Number(body?.price ?? 0);
  if (!name || name.length > 120 || !Number.isFinite(price) || price < 0 || price > 1_000_000) return null;
  return {
    name,
    price: Math.round(price * 100) / 100,
    sort: Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    active: body.is_active === false ? 0 : 1,
  };
}

export async function handleListAddonGroups(env: Env, orgId: string): Promise<Response> {
  const groups = await env.DB.prepare(`
    SELECT id, name, description, is_required, allow_multiple_quantities,
           min_selection, max_selection, sort_order, is_active
    FROM master_addon_groups WHERE organization_id = ?
    ORDER BY sort_order, name
  `).bind(orgId).all<any>();
  const addons = await env.DB.prepare(`
    SELECT a.id, a.addon_group_id, a.name, a.price, a.is_active, a.sort_order
    FROM master_addons a
    JOIN master_addon_groups g ON g.id = a.addon_group_id AND g.organization_id = a.organization_id
    WHERE a.organization_id = ? ORDER BY a.sort_order, a.name
  `).bind(orgId).all<any>();
  const byGroup = new Map<string, any[]>();
  for (const addon of addons.results || []) {
    const list = byGroup.get(addon.addon_group_id) || [];
    list.push(addon);
    byGroup.set(addon.addon_group_id, list);
  }
  return Response.json({ addon_groups: (groups.results || []).map((group: any) => ({
    ...group,
    is_required: Boolean(group.is_required),
    allow_multiple_quantities: Boolean(group.allow_multiple_quantities),
    is_active: Boolean(group.is_active),
    addons: byGroup.get(group.id) || [],
  })) });
}

export async function loadProductAddonGroups(db: any, orgId: string, productIds: string[]): Promise<Map<string, any[]>> {
  const result = new Map<string, any[]>();
  if (productIds.length === 0) return result;
  const allRows: any[] = [];
  for (let offset = 0; offset < productIds.length; offset += 400) {
    const ids = productIds.slice(offset, offset + 400);
    const rows = await db.prepare(`
    SELECT l.product_id, g.id AS group_id, g.name AS group_name, g.description,
           g.is_required, g.allow_multiple_quantities, g.min_selection, g.max_selection,
           g.sort_order AS group_sort_order, a.id AS addon_id, a.name AS addon_name,
           a.price AS addon_price, a.sort_order AS addon_sort_order
    FROM master_product_addon_groups l
    JOIN master_addon_groups g ON g.id = l.addon_group_id AND g.organization_id = l.organization_id AND g.is_active = 1
    LEFT JOIN master_addons a ON a.addon_group_id = g.id AND a.organization_id = g.organization_id AND a.is_active = 1
    WHERE l.organization_id = ? AND l.product_id IN (${ids.map(() => '?').join(',')})
    ORDER BY l.sort_order, g.sort_order, a.sort_order, a.name
    `).bind(orgId, ...ids).all() as { results?: any[] };
    allRows.push(...(rows.results || []));
  }
  const groupsByProduct = new Map<string, Map<string, any>>();
  for (const row of allRows) {
    let groups = groupsByProduct.get(row.product_id);
    if (!groups) { groups = new Map(); groupsByProduct.set(row.product_id, groups); }
    let group = groups.get(row.group_id);
    if (!group) {
      group = {
        id: row.group_id, name: row.group_name, description: row.description,
        is_required: Boolean(row.is_required), allow_multiple_quantities: Boolean(row.allow_multiple_quantities),
        min_selection: row.min_selection, max_selection: row.max_selection, addons: [],
      };
      groups.set(row.group_id, group);
    }
    if (row.addon_id) group.addons.push({ id: row.addon_id, name: row.addon_name, price: Number(row.addon_price) });
  }
  for (const [productId, groups] of groupsByProduct) result.set(productId, Array.from(groups.values()));
  return result;
}

export async function resolvePublicQrModifiers(
  db: any,
  orgId: string,
  productId: string,
  selectedIds: unknown,
): Promise<{ modifiers?: Array<{ id: string; name: string; price: number; quantity: number }>; error?: string }> {
  if (!Array.isArray(selectedIds) || selectedIds.length > 100 || selectedIds.some((id) => typeof id !== 'string')) {
    return { error: 'Invalid modifier selection' };
  }
  const uniqueIds = [...new Set(selectedIds as string[])];
  if (uniqueIds.length !== selectedIds.length) return { error: 'A modifier cannot be selected more than once' };
  const groupsByProduct = await loadProductAddonGroups(db, orgId, [productId]);
  const groups = groupsByProduct.get(productId) || [];
  const owned = new Map<string, any>();
  for (const group of groups) for (const addon of group.addons) owned.set(addon.id, { ...addon, groupId: group.id });
  for (const id of uniqueIds) if (!owned.has(id)) return { error: 'Selected modifier is unavailable for this item' };
  const selectedByGroup = new Map<string, number>();
  for (const id of uniqueIds) {
    const addon = owned.get(id);
    selectedByGroup.set(addon.groupId, (selectedByGroup.get(addon.groupId) || 0) + 1);
  }
  for (const group of groups) {
    const count = selectedByGroup.get(group.id) || 0;
    const min = Math.max(Number(group.min_selection) || 0, group.is_required ? 1 : 0);
    const max = Number(group.max_selection);
    if (count < min) return { error: `Choose at least ${min} option${min === 1 ? '' : 's'} from ${group.name}` };
    if (count > max) return { error: `Choose no more than ${max} option${max === 1 ? '' : 's'} from ${group.name}` };
  }
  return { modifiers: uniqueIds.map((id) => {
    const addon = owned.get(id);
    return { id, name: addon.name, price: Number(addon.price), quantity: 1 };
  }) };
}

export async function handleSaveAddonGroup(request: Request, env: Env, orgId: string, groupId?: string): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON payload' }, { status: 400 }); }
  const input = groupInput(body);
  if (!input) return Response.json({ error: 'Invalid modifier group name or selection bounds' }, { status: 400 });
  const requestedId = typeof body.id === 'string' ? body.id : '';
  const id = groupId || requestedId || crypto.randomUUID();
  const now = new Date().toISOString();
  const existing = (groupId || requestedId)
    ? await env.DB.prepare(`
        SELECT g.id,
          EXISTS (SELECT 1 FROM master_product_addon_groups l WHERE l.addon_group_id = g.id AND l.organization_id = g.organization_id) AS is_linked,
          (SELECT COUNT(*) FROM master_addons a WHERE a.addon_group_id = g.id AND a.organization_id = g.organization_id AND a.is_active = 1) AS active_addon_count
        FROM master_addon_groups g WHERE g.id = ? AND g.organization_id = ?
      `).bind(groupId || requestedId, orgId).first<{ id: string; is_linked: number; active_addon_count: number }>()
    : null;
  if ((groupId || requestedId) && !existing) return Response.json({ error: 'Modifier group not found' }, { status: 404 });
  const nestedAddons = Array.isArray(body.addons) ? body.addons.map((addon: any, index: number) => ({ ...addon, sort_order: addon.sort_order ?? index })) : null;
  if (nestedAddons) {
    const ids = nestedAddons.map((addon: any) => addon.id).filter((addonId: unknown) => typeof addonId === 'string');
    if (new Set(ids).size !== ids.length || nestedAddons.some((addon: any) => !addonInput(addon))) {
      return Response.json({ error: 'Invalid or duplicate modifier in group' }, { status: 400 });
    }
    for (const addonId of ids) {
      const addonOwner = await env.DB.prepare('SELECT addon_group_id FROM master_addons WHERE id = ? AND organization_id = ?').bind(addonId, orgId).first<{ addon_group_id: string }>();
      if (addonOwner && addonOwner.addon_group_id !== id) return Response.json({ error: 'Modifier belongs to a different group' }, { status: 409 });
    }
  }
  if (existing?.is_linked) {
    const availableCount = nestedAddons
      ? nestedAddons.filter((addon: any) => addon.is_active !== false).length
      : existing.active_addon_count;
    if (availableCount < Math.max(input.min, input.required ? 1 : 0)) {
      return Response.json({ error: 'Linked products would not have enough active modifiers to satisfy this group minimum' }, { status: 409 });
    }
  }
  const saveGroup = env.DB.prepare(`
    INSERT INTO master_addon_groups (
      id, organization_id, name, description, is_required, allow_multiple_quantities,
      min_selection, max_selection, sort_order, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, description = excluded.description,
      is_required = excluded.is_required, allow_multiple_quantities = excluded.allow_multiple_quantities,
      min_selection = excluded.min_selection, max_selection = excluded.max_selection,
      sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = excluded.updated_at
    WHERE master_addon_groups.organization_id = excluded.organization_id
  `).bind(id, orgId, input.name, input.description, input.required, input.multiple, input.min, input.max, input.sort, input.active, now, now);

  if (nestedAddons) {
    const rows = nestedAddons;
    const ids = rows.filter((addon: any) => typeof addon.id === 'string').map((addon: any) => addon.id);
    const statements: any[] = [env.DB.prepare(`
      UPDATE master_addons SET is_active = 0, updated_at = ?
      WHERE organization_id = ? AND addon_group_id = ?${ids.length ? ` AND id NOT IN (${ids.map(() => '?').join(',')})` : ''}
    `).bind(now, orgId, id, ...ids)];
    for (const addon of rows) {
      const value = addonInput(addon)!;
      statements.push(env.DB.prepare(`
        INSERT INTO master_addons (id, organization_id, addon_group_id, name, price, is_active, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, price = excluded.price,
          is_active = excluded.is_active, sort_order = excluded.sort_order, updated_at = excluded.updated_at
        WHERE master_addons.organization_id = excluded.organization_id AND master_addons.addon_group_id = excluded.addon_group_id
      `).bind(typeof addon.id === 'string' ? addon.id : crypto.randomUUID(), orgId, id, value.name, value.price, value.active, value.sort, now, now));
    }
    await env.DB.batch([saveGroup, ...statements]);
  } else {
    await saveGroup.run();
  }
  return Response.json({ success: true, id }, { status: groupId ? 200 : 201 });
}

export async function handleDeleteAddonGroup(env: Env, orgId: string, groupId: string): Promise<Response> {
  const result = await env.DB.prepare('UPDATE master_addon_groups SET is_active = 0, updated_at = ? WHERE id = ? AND organization_id = ?')
    .bind(new Date().toISOString(), groupId, orgId).run();
  const changes = (result as any)?.meta?.changes ?? (result as any)?.changes ?? 0;
  return changes ? Response.json({ success: true }) : Response.json({ error: 'Modifier group not found' }, { status: 404 });
}

export async function handleSaveAddon(request: Request, env: Env, orgId: string, groupId: string, addonId?: string): Promise<Response> {
  const group = await env.DB.prepare('SELECT id FROM master_addon_groups WHERE id = ? AND organization_id = ?')
    .bind(groupId, orgId).first();
  if (!group) return Response.json({ error: 'Modifier group not found' }, { status: 404 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON payload' }, { status: 400 }); }
  const input = addonInput(body);
  if (!input) return Response.json({ error: 'Invalid modifier name or price' }, { status: 400 });
  const id = addonId || (typeof body.id === 'string' ? body.id : crypto.randomUUID());
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`
    INSERT INTO master_addons (id, organization_id, addon_group_id, name, price, is_active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, price = excluded.price,
      is_active = excluded.is_active, updated_at = excluded.updated_at
    WHERE master_addons.organization_id = excluded.organization_id AND master_addons.addon_group_id = excluded.addon_group_id
  `).bind(id, orgId, groupId, input.name, input.price, input.active, input.sort, now, now).run();
  if (addonId && !((result as any)?.meta?.changes ?? (result as any)?.changes)) return Response.json({ error: 'Modifier not found' }, { status: 404 });
  return Response.json({ success: true, id }, { status: addonId ? 200 : 201 });
}

export async function handleDeleteAddon(env: Env, orgId: string, groupId: string, addonId: string): Promise<Response> {
  const group = await env.DB.prepare(`
    SELECT g.min_selection, g.is_required,
      (SELECT COUNT(*) FROM master_addons a WHERE a.addon_group_id = g.id AND a.organization_id = g.organization_id AND a.is_active = 1) AS active_count,
      EXISTS (SELECT 1 FROM master_product_addon_groups l WHERE l.addon_group_id = g.id AND l.organization_id = g.organization_id) AS is_linked
    FROM master_addon_groups g WHERE g.id = ? AND g.organization_id = ?
  `).bind(groupId, orgId).first<{ min_selection: number; is_required: number; active_count: number; is_linked: number }>();
  if (!group) return Response.json({ error: 'Modifier group not found' }, { status: 404 });
  if (group.is_linked && group.active_count <= Math.max(group.min_selection, group.is_required ? 1 : 0)) {
    return Response.json({ error: 'Cannot remove this modifier because linked products would no longer satisfy the required selection' }, { status: 409 });
  }
  const result = await env.DB.prepare(`
    UPDATE master_addons SET is_active = 0, updated_at = ?
    WHERE id = ? AND addon_group_id = ? AND organization_id = ?
  `).bind(new Date().toISOString(), addonId, groupId, orgId).run();
  const changes = (result as any)?.meta?.changes ?? (result as any)?.changes ?? 0;
  return changes ? Response.json({ success: true }) : Response.json({ error: 'Modifier not found' }, { status: 404 });
}
