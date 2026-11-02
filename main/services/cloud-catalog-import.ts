import * as crypto from 'crypto';
import { getDatabase, now } from '../db';

export type CloudCatalogAddon = { id: string; name: string; price: number; sort_order?: number; is_active?: boolean | number };
export type CloudCatalogAddonGroup = {
  id: string; name: string; description?: string | null; is_required: boolean | number;
  allow_multiple_quantities: boolean | number; min_selection: number; max_selection: number;
  sort_order?: number; addons: CloudCatalogAddon[];
};
export type CloudCatalogCategory = { id: string; name: string; sort_order?: number; is_active?: boolean | number };
export type CloudCatalogProduct = {
  id: string; name: string; category_id: string | null; sku: string | null; barcode: string | null;
  effective_price: number; tax_rate: number; master_is_active: boolean | number;
  is_available: boolean | number; version: number; updated_at: string; addon_groups: CloudCatalogAddonGroup[];
};
export type CloudCatalogSnapshot = {
  branch_id: string; categories: CloudCatalogCategory[]; products: CloudCatalogProduct[];
};

function enabled(value: unknown): number {
  return value === true || value === 1 ? 1 : 0;
}

function safeArray(value: unknown, max: number, label: string): any[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Cloud catalog ${label} is invalid or too large`);
  return value;
}

/** Applies a full branch catalog while preserving local inventory, cost, and order history. */
export function importCloudCatalog(snapshot: CloudCatalogSnapshot, expectedBranchId: string): { categories: number; products: number; modifiers: number } {
  if (!snapshot || typeof snapshot.branch_id !== 'string' || !snapshot.branch_id) throw new Error('Cloud catalog branch is missing');
  if (!expectedBranchId || snapshot.branch_id !== expectedBranchId) throw new Error('Cloud catalog belongs to a different terminal branch');
  const categories = safeArray(snapshot.categories, 1_000, 'categories') as CloudCatalogCategory[];
  const products = safeArray(snapshot.products, 5_000, 'products') as CloudCatalogProduct[];
  const categoryIds = new Map<string, string>();
  const seenCategoryIds = new Set<string>();
  const seenProductIds = new Set<string>();
  const seenAddonGroupIds = new Set<string>();
  const seenAddonIds = new Set<string>();
  const timestamp = now();
  const db = getDatabase();
  const importAll = db.transaction(() => {
    const lookupMapping = db.prepare('SELECT local_id FROM cloud_catalog_identity_mappings WHERE entity_type = ? AND remote_id = ?');
    const saveMapping = db.prepare(`
      INSERT INTO cloud_catalog_identity_mappings (entity_type, remote_id, local_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_type, remote_id) DO UPDATE SET local_id = excluded.local_id, updated_at = excluded.updated_at
    `);
    for (const category of categories) {
      if (!category || typeof category.id !== 'string' || !category.id || typeof category.name !== 'string' || !category.name.trim()) {
        throw new Error('Cloud catalog category is invalid');
      }
      seenCategoryIds.add(category.id);
      const mapped = lookupMapping.get('category', category.id) as { local_id: string } | undefined;
      const collision = !mapped ? db.prepare('SELECT id, name FROM categories WHERE id = ?').get(category.id) as { id: string; name: string } | undefined : undefined;
      const localId = mapped?.local_id || (collision && collision.name.trim().toLowerCase() !== category.name.trim().toLowerCase()
        ? crypto.randomUUID() : category.id);
      const active = enabled(category.is_active ?? 1);
      db.prepare(`
        INSERT INTO categories (id, name, sort_order, is_active, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, sort_order = excluded.sort_order,
          is_active = excluded.is_active, deleted_at = NULL, updated_at = excluded.updated_at
      `).run(localId, category.name.trim(), Number.isInteger(category.sort_order) ? category.sort_order : 0, active, timestamp, timestamp);
      saveMapping.run('category', category.id, localId, timestamp, timestamp);
      categoryIds.set(category.id, localId);
    }

    let importedModifiers = 0;
    for (const product of products) {
      if (!product || typeof product.id !== 'string' || !product.id || typeof product.name !== 'string' || !product.name.trim() ||
        !Number.isFinite(product.effective_price) || product.effective_price < 0 || !Number.isFinite(product.tax_rate) || product.tax_rate < 0 || product.tax_rate > 100 ||
        !Number.isInteger(product.version) || product.version < 1 || typeof product.updated_at !== 'string') {
        throw new Error('Cloud catalog product is invalid');
      }
      seenProductIds.add(product.id);
      let categoryId: string | null = null;
      if (product.category_id) {
        categoryId = categoryIds.get(product.category_id) || (lookupMapping.get('category', product.category_id) as { local_id: string } | undefined)?.local_id || null;
        if (!categoryId) throw new Error(`Cloud catalog product references an unknown category: ${product.id}`);
      }

      const mapped = lookupMapping.get('product', product.id) as { local_id: string } | undefined;
      let localId = mapped?.local_id;
      if (!localId && typeof product.sku === 'string' && product.sku.trim()) {
        const skuMatches = db.prepare('SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL').all(product.sku.trim()) as { id: string }[];
        if (skuMatches.length > 1) throw new Error(`Cloud catalog SKU is ambiguous locally: ${product.sku}`);
        if (skuMatches.length === 1) localId = skuMatches[0].id;
      }
      if (!localId) {
        const collision = db.prepare('SELECT id, name, sku FROM products WHERE id = ?').get(product.id) as { id: string; name: string; sku: string | null } | undefined;
        localId = collision && (collision.name.trim().toLowerCase() !== product.name.trim().toLowerCase() ||
          (collision.sku || null) !== (product.sku || null)) ? crypto.randomUUID() : product.id;
      }

      db.prepare(`
        INSERT INTO products (id, category_id, name, price, sku, barcode, is_active, tax_rate, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category_id = excluded.category_id, name = excluded.name, price = excluded.price,
          sku = excluded.sku, barcode = excluded.barcode, is_active = excluded.is_active,
          tax_rate = excluded.tax_rate, deleted_at = NULL, updated_at = excluded.updated_at
      `).run(localId, categoryId, product.name.trim(), product.effective_price, product.sku || null, product.barcode || null,
        enabled(product.master_is_active) && enabled(product.is_available) ? 1 : 0, product.tax_rate, timestamp, timestamp);
      saveMapping.run('product', product.id, localId, timestamp, timestamp);

      const groups = safeArray(product.addon_groups, 50, `modifier groups for ${product.id}`) as CloudCatalogAddonGroup[];
      const localGroupIds: string[] = [];
      for (const group of groups) {
        if (!group || typeof group.id !== 'string' || !group.id || typeof group.name !== 'string' || !group.name.trim() ||
          !Number.isInteger(group.min_selection) || !Number.isInteger(group.max_selection) || group.min_selection < 0 ||
          group.max_selection < group.min_selection || group.max_selection > 100) {
          throw new Error(`Cloud catalog modifier group is invalid for product ${product.id}`);
        }
        seenAddonGroupIds.add(group.id);
        const groupMap = lookupMapping.get('addon_group', group.id) as { local_id: string } | undefined;
        const groupCollision = !groupMap ? db.prepare('SELECT id, name FROM addon_groups WHERE id = ?').get(group.id) as { id: string; name: string } | undefined : undefined;
        const localGroupId = groupMap?.local_id || (groupCollision && groupCollision.name.trim().toLowerCase() !== group.name.trim().toLowerCase()
          ? crypto.randomUUID() : group.id);
        db.prepare(`
          INSERT INTO addon_groups (id, name, description, is_required, min_selection, max_selection,
            allow_multiple_quantities, is_active, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description,
            is_required=excluded.is_required, min_selection=excluded.min_selection, max_selection=excluded.max_selection,
            allow_multiple_quantities=excluded.allow_multiple_quantities, is_active=1,
            sort_order=excluded.sort_order, updated_at=excluded.updated_at
        `).run(localGroupId, group.name.trim(), group.description || null, enabled(group.is_required), group.min_selection,
          group.max_selection, enabled(group.allow_multiple_quantities), Number.isInteger(group.sort_order) ? group.sort_order : 0, timestamp, timestamp);
        saveMapping.run('addon_group', group.id, localGroupId, timestamp, timestamp);
        localGroupIds.push(localGroupId);

        const addons = safeArray(group.addons, 200, `modifiers in ${group.id}`) as CloudCatalogAddon[];
        for (const [index, addon] of addons.entries()) {
          if (!addon || typeof addon.id !== 'string' || !addon.id || typeof addon.name !== 'string' || !addon.name.trim() ||
            !Number.isFinite(addon.price) || addon.price < 0) throw new Error(`Cloud catalog modifier is invalid in group ${group.id}`);
          seenAddonIds.add(addon.id);
          const addonMap = lookupMapping.get('addon', addon.id) as { local_id: string } | undefined;
          const addonCollision = !addonMap ? db.prepare('SELECT id, name, addon_group_id FROM addons WHERE id = ?').get(addon.id) as { id: string; name: string; addon_group_id: string } | undefined : undefined;
          const localAddonId = addonMap?.local_id || (addonCollision && (addonCollision.name.trim().toLowerCase() !== addon.name.trim().toLowerCase() || addonCollision.addon_group_id !== localGroupId)
            ? crypto.randomUUID() : addon.id);
          db.prepare(`
            INSERT INTO addons (id, addon_group_id, name, price, is_active, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET addon_group_id=excluded.addon_group_id, name=excluded.name,
              price=excluded.price, is_active=excluded.is_active, sort_order=excluded.sort_order, updated_at=excluded.updated_at
          `).run(localAddonId, localGroupId, addon.name.trim(), addon.price, enabled(addon.is_active ?? 1),
            Number.isInteger(addon.sort_order) ? addon.sort_order : index, timestamp, timestamp);
          saveMapping.run('addon', addon.id, localAddonId, timestamp, timestamp);
          importedModifiers += 1;
        }
      }

      // This product is cloud-managed, so its modifier links follow the current branch catalog snapshot.
      db.prepare('DELETE FROM addon_group_product WHERE product_id = ?').run(localId);
      const link = db.prepare('INSERT INTO addon_group_product (product_id, addon_group_id) VALUES (?, ?)');
      for (const groupId of localGroupIds) link.run(localId, groupId);
    }

    const managedEntities = [
      { type: 'category', seen: seenCategoryIds, table: 'categories' },
      { type: 'product', seen: seenProductIds, table: 'products' },
      { type: 'addon_group', seen: seenAddonGroupIds, table: 'addon_groups' },
      { type: 'addon', seen: seenAddonIds, table: 'addons' },
    ] as const;
    for (const entity of managedEntities) {
      const mappings = db.prepare('SELECT remote_id, local_id FROM cloud_catalog_identity_mappings WHERE entity_type = ?')
        .all(entity.type) as { remote_id: string; local_id: string }[];
      const deactivate = db.prepare(`UPDATE ${entity.table} SET is_active = 0, updated_at = ? WHERE id = ?`);
      for (const mapping of mappings) {
        if (!entity.seen.has(mapping.remote_id)) deactivate.run(timestamp, mapping.local_id);
      }
    }
    return { categories: categories.length, products: products.length, modifiers: importedModifiers };
  });
  return importAll();
}
