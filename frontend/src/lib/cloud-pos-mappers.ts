import type { Category, Product, Table } from '@/lib/types';

/**
 * Maps Cloud catalog/table rows onto the shared POS view models.
 *
 * Both the cashier tablet POS and the waiter tablet app read the same Cloud
 * endpoints, so the mapping lives in one place to keep prices, availability and
 * table state consistent across the two surfaces.
 */

export function mapCloudProduct(row: Record<string, unknown>, effective: Record<string, unknown> | undefined): Product {
  const groups = Array.isArray(row.addon_groups) ? row.addon_groups : [];
  return {
    id: String(row.id),
    category_id: row.category_id == null ? null : String(row.category_id),
    name: String(row.name || 'Unnamed product'),
    sku: typeof row.sku === 'string' ? row.sku : null,
    barcode: typeof row.barcode === 'string' ? row.barcode : null,
    sale_unit: 'each',
    allow_fractional_quantity: false,
    weight_precision: 3,
    description: typeof row.description === 'string' ? row.description : null,
    price: Number(effective?.effective_price ?? row.base_price ?? 0),
    cost_price: null,
    tax_type: 'inclusive',
    tax_rate: Number(row.tax_rate || 0),
    track_inventory: false,
    stock_quantity: 0,
    low_stock_threshold: null,
    is_active: Number(row.is_active ?? 1) === 1 && Number(effective?.is_available ?? 1) === 1,
    available_online: true,
    has_image: false,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    tags: null,
    variants: null,
    modifiers: null,
    sort_order: Number(row.sort_order || 0),
    addon_groups: groups as Product['addon_groups'],
  };
}

export function mapCloudCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name || 'Category'),
    slug: String(row.slug || row.name || row.id),
    description: typeof row.description === 'string' ? row.description : null,
    parent_id: typeof row.parent_id === 'string' ? row.parent_id : null,
    sort_order: Number(row.sort_order || 0),
    is_active: Number(row.is_active ?? 1) === 1,
    color: typeof row.color === 'string' ? row.color : null,
    icon: typeof row.icon === 'string' ? row.icon : null,
  };
}

export function mapCloudTable(row: Record<string, unknown>): Table {
  return {
    id: String(row.id),
    name: String(row.table_number || row.name || row.id),
    capacity: Number(row.capacity || 4),
    status: String(row.status || 'available') as Table['status'],
    kitchen_station_id: null,
    floor: typeof row.floor === 'string' ? row.floor : null,
    section: typeof row.section === 'string' ? row.section : null,
    position_x: null,
    position_y: null,
    is_active: Number(row.is_active ?? 1) === 1,
  };
}

export type CloudBranch = { id: string; name: string; restaurant_name?: string; status?: string };
export type CloudOrderRow = {
  id: string;
  order_number: string;
  branch_id?: string;
  table_id?: string | null;
  table_number?: string | null;
  order_type?: string;
  status?: string;
  version?: number;
  kitchen_status?: string;
  payment_status?: string;
  grand_total?: number;
  total?: number;
  ordered_at?: string;
  items?: { product_name?: string; quantity?: number }[];
};
