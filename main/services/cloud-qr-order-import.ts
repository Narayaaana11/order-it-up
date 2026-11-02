import { getDatabase, generateOrderNumber, now } from '../db';

type CloudQrItem = {
  id: string; product_name: string; product_sku: string | null; quantity: number;
  unit_price: number; subtotal: number; tax_amount: number; modifiers_json: string | null;
  special_instructions: string | null;
};
export type CloudQrOrder = {
  id: string; order_number: string; order_type: string; table_number: string;
  customer_name: string | null; notes: string | null; subtotal: number; tax_total: number;
  grand_total: number; ordered_at: string; items: CloudQrItem[];
};

/** Imports a cloud QR order as a pending, unaccepted local dine-in order. */
export function importCloudQrOrder(remote: CloudQrOrder): { localOrderId: number; replay: boolean } {
  const db = getDatabase();
  if (!remote || typeof remote.id !== 'string' || !remote.id || !Array.isArray(remote.items) || remote.items.length === 0) {
    throw new Error('Invalid cloud QR order snapshot');
  }
  const existing = db.prepare('SELECT local_order_id FROM cloud_qr_order_receipts WHERE remote_order_id = ?')
    .get(remote.id) as { local_order_id: number } | undefined;
  if (existing) return { localOrderId: existing.local_order_id, replay: true };
  const tableRows = db.prepare('SELECT id FROM tables WHERE number = ? AND is_active = 1').all(String(remote.table_number)) as { id: string }[];
  if (tableRows.length !== 1) throw new Error('Cloud QR table does not map to one active local table');
  const mappedItems = remote.items.map((item) => {
    if (!item || !item.id || !item.product_name || !Number.isInteger(item.quantity) || item.quantity < 1 ||
      ![item.unit_price, item.subtotal, item.tax_amount].every((n) => Number.isFinite(n) && n >= 0)) {
      throw new Error('Cloud QR item snapshot is invalid');
    }
    const products = item.product_sku
      ? db.prepare('SELECT id FROM products WHERE sku = ? AND is_active = 1 AND deleted_at IS NULL').all(item.product_sku)
      : db.prepare('SELECT id FROM products WHERE name = ? COLLATE NOCASE AND is_active = 1 AND deleted_at IS NULL').all(item.product_name);
    if (products.length !== 1) throw new Error(`Cloud QR product cannot be mapped unambiguously: ${item.product_name}`);
    let modifiers: unknown = [];
    try { modifiers = item.modifiers_json ? JSON.parse(item.modifiers_json) : []; } catch { throw new Error('Cloud QR modifiers are invalid'); }
    if (!Array.isArray(modifiers)) throw new Error('Cloud QR modifiers are invalid');
    return { ...item, product_id: (products[0] as { id: string }).id, modifiers };
  });
  const totals = [remote.subtotal, remote.tax_total, remote.grand_total];
  if (!totals.every((n) => Number.isFinite(n) && n >= 0)) throw new Error('Cloud QR totals are invalid');
  const createdAt = remote.ordered_at || now();
  const localOrderId: number = db.transaction((): number => {
    const insertedOrderId = db.prepare(`INSERT INTO orders (
      order_number, table_id, type, guest_count, special_instructions, status, subtotal,
      tax_amount, tax_breakdown, tax_snapshot, total, online_platform, external_order_id,
      customer_name, created_at, updated_at
    ) VALUES (?, ?, 'dine_in', 1, ?, 'pending', ?, ?, '{}', NULL, ?, 'cloud_qr', ?, ?, ?, ?)`)
      .run(generateOrderNumber(), tableRows[0].id, remote.notes || null, remote.subtotal,
        remote.tax_total, remote.grand_total, remote.id, remote.customer_name || 'QR Guest', createdAt, createdAt).lastInsertRowid as number;
    const itemMap: Record<string, number> = {};
    for (const item of mappedItems) {
      const itemId = db.prepare(`INSERT INTO order_items (
        order_id, product_id, product_name, product_sku, unit_price, quantity,
        inventory_deducted_quantity, subtotal, tax_amount, tax_breakdown, tax_snapshot,
        total, modifier_selection, special_instructions, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, '{}', NULL, ?, ?, ?, 'pending', ?, ?)`)
        .run(insertedOrderId, item.product_id, item.product_name, item.product_sku, item.unit_price,
          item.quantity, item.subtotal, item.tax_amount, item.subtotal + item.tax_amount,
          JSON.stringify(item.modifiers), item.special_instructions, createdAt, createdAt).lastInsertRowid as number;
      itemMap[item.id] = itemId;
      for (const modifier of item.modifiers as Record<string, unknown>[]) {
        const name = typeof modifier.name === 'string' ? modifier.name : typeof modifier.addon_name === 'string' ? modifier.addon_name : '';
        if (!name) continue;
        const price = Number(modifier.price ?? modifier.unit_price ?? 0);
        const quantity = Number(modifier.quantity ?? 1);
        if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) throw new Error('Cloud QR modifier values are invalid');
        db.prepare('INSERT INTO order_item_addons (order_item_id, addon_id, addon_name, price, quantity, created_at) VALUES (?, NULL, ?, ?, ?, ?)')
          .run(itemId, name, price, quantity, createdAt);
      }
    }
    db.prepare('INSERT INTO cloud_qr_order_receipts (remote_order_id, local_order_id, remote_order_number, item_map_json, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(remote.id, insertedOrderId, remote.order_number, JSON.stringify(itemMap), now());
    return insertedOrderId;
  })();
  return { localOrderId, replay: false };
}
