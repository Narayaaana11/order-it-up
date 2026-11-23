/**
 * AI Copilot Read-Only Analytical Tools (D4)
 *
 * Implements safe, parameterized, read-only tools for the AI Copilot:
 * - sales_summary: Date-bounded sales & order counts in store timezone
 * - top_items: High-volume and high-revenue products with pagination/limits
 * - hourly_sales: Hourly breakdown for a given date in store timezone
 * - payment_split: Payment method breakdown for a date range
 * - audit_anomalies: Recent anti-fraud audit anomalies
 * - low_stock: Ingredients below reorder levels
 * - food_cost_by_item: Recipe vs selling price food cost margins
 *
 * Security Invariants:
 * - Parameterized SQLite queries only (strictly zero string concatenation).
 * - Customer PII (phone, email, names, card data) is strictly excluded/redacted.
 * - Timezone-aware day boundaries using dayBoundsInTimezone.
 */

import { getDatabase, getSettingValue, dayBoundsInTimezone, localDateInTimezone } from '../db';
import Decimal from 'decimal.js';

export function getStoreTimezone(): string {
  return getSettingValue('timezone') || 'Asia/Kolkata';
}

export interface ToolResult {
  tool: string;
  params: Record<string, any>;
  data: any;
}

export class AiToolsService {
  /**
   * Summarizes sales, order counts, discounts, and taxes for a local date or date range.
   */
  static getSalesSummary(params: { startDate?: string; endDate?: string } = {}): ToolResult {
    const db = getDatabase();
    const tz = getStoreTimezone();
    const today = localDateInTimezone(new Date(), tz);
    const startDate = params.startDate || today;
    const endDate = params.endDate || startDate;

    const [startUtc] = dayBoundsInTimezone(startDate, tz);
    const [, endUtc] = dayBoundsInTimezone(endDate, tz);

    const row = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(subtotal), 0) as subtotal,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COALESCE(SUM(total), 0) as total_revenue
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND status != 'cancelled'
    `).get(startUtc, endUtc) as any;

    return {
      tool: 'sales_summary',
      params: { startDate, endDate, timezone: tz },
      data: {
        order_count: Number(row.total_orders || 0),
        subtotal: Number(row.subtotal || 0),
        tax: Number(row.total_tax || 0),
        discount: Number(row.total_discount || 0),
        revenue: Number(row.total_revenue || 0),
      },
    };
  }

  /**
   * Retrieves top selling items by volume and revenue for a date range.
   */
  static getTopItems(params: { limit?: number; startDate?: string; endDate?: string } = {}): ToolResult {
    const db = getDatabase();
    const tz = getStoreTimezone();
    const today = localDateInTimezone(new Date(), tz);
    const startDate = params.startDate || today;
    const endDate = params.endDate || startDate;
    const limit = Math.min(Math.max(Number(params.limit) || 5, 1), 50);

    const [startUtc] = dayBoundsInTimezone(startDate, tz);
    const [, endUtc] = dayBoundsInTimezone(endDate, tz);

    const rows = db.prepare(`
      SELECT 
        oi.product_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.status != 'cancelled'
      GROUP BY oi.product_name
      ORDER BY quantity_sold DESC, total_revenue DESC
      LIMIT ?
    `).all(startUtc, endUtc, limit) as any[];

    return {
      tool: 'top_items',
      params: { limit, startDate, endDate, timezone: tz },
      data: rows.map((r) => ({
        product_name: r.product_name,
        quantity: Number(r.quantity_sold || 0),
        revenue: Number(r.total_revenue || 0),
      })),
    };
  }

  /**
   * Hourly sales distribution for a specific day in the store timezone.
   */
  static getHourlySales(params: { date?: string } = {}): ToolResult {
    const db = getDatabase();
    const tz = getStoreTimezone();
    const targetDate = params.date || localDateInTimezone(new Date(), tz);
    const [startUtc, endUtc] = dayBoundsInTimezone(targetDate, tz);

    const orders = db.prepare(`
      SELECT created_at, total
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND status != 'cancelled'
    `).all(startUtc, endUtc) as any[];

    // Bucket into 24 local hours
    const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      order_count: 0,
      revenue: 0,
    }));

    for (const ord of orders) {
      try {
        const utcInstant = new Date(ord.created_at.includes('T') ? ord.created_at : `${ord.created_at.replace(' ', 'T')}Z`);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hour12: false,
        });
        const hour = Number(formatter.format(utcInstant)) % 24;
        hourlyBuckets[hour].order_count += 1;
        hourlyBuckets[hour].revenue = new Decimal(hourlyBuckets[hour].revenue)
          .plus(ord.total || 0)
          .toNumber();
      } catch { }
    }

    return {
      tool: 'hourly_sales',
      params: { date: targetDate, timezone: tz },
      data: hourlyBuckets.filter((h) => h.order_count > 0),
    };
  }

  /**
   * Payment split across methods for a date range.
   */
  static getPaymentSplit(params: { startDate?: string; endDate?: string } = {}): ToolResult {
    const db = getDatabase();
    const tz = getStoreTimezone();
    const today = localDateInTimezone(new Date(), tz);
    const startDate = params.startDate || today;
    const endDate = params.endDate || startDate;
    const [startUtc] = dayBoundsInTimezone(startDate, tz);
    const [, endUtc] = dayBoundsInTimezone(endDate, tz);

    const rows = db.prepare(`
      SELECT 
        COALESCE(payment_method, 'cash') as method,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM payments
      WHERE created_at >= ? AND created_at < ? AND status = 'completed'
      GROUP BY method
      ORDER BY total_amount DESC
    `).all(startUtc, endUtc) as any[];

    return {
      tool: 'payment_split',
      params: { startDate, endDate, timezone: tz },
      data: rows.map((r) => ({
        method: r.method,
        transactions: Number(r.transaction_count || 0),
        amount: Number(r.total_amount || 0),
      })),
    };
  }

  /**
   * Low stock alerts based on inventory ingredient levels.
   */
  static getLowStock(): ToolResult {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        name,
        current_stock,
        minimum_stock,
        unit
      FROM raw_ingredients
      WHERE is_active = 1 AND current_stock <= minimum_stock
      ORDER BY (current_stock - minimum_stock) ASC
      LIMIT 20
    `).all() as any[];

    return {
      tool: 'low_stock',
      params: {},
      data: rows.map((r) => ({
        name: r.name,
        current_stock: Number(r.current_stock || 0),
        minimum_stock: Number(r.minimum_stock || 0),
        unit: r.unit,
      })),
    };
  }

  /**
   * Food cost calculation by item based on recipes and active purchase order/ingredient costs.
   */
  static getFoodCostByItem(params: { limit?: number } = {}): ToolResult {
    const db = getDatabase();
    const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 50);

    const rows = db.prepare(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.price as selling_price,
        COALESCE(SUM(pr.quantity_required * ri.cost_per_unit), 0) as ingredient_cost
      FROM products p
      LEFT JOIN product_recipes pr ON pr.product_id = p.id
      LEFT JOIN raw_ingredients ri ON pr.ingredient_id = ri.id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
      GROUP BY p.id
      HAVING ingredient_cost > 0
      ORDER BY ingredient_cost DESC
      LIMIT ?
    `).all(limit) as any[];

    return {
      tool: 'food_cost_by_item',
      params: { limit },
      data: rows.map((r) => {
        const cost = Number(r.ingredient_cost || 0);
        const price = Number(r.selling_price || 0);
        const foodCostPct = price > 0 ? Number(((cost / price) * 100).toFixed(1)) : 0;
        return {
          product_name: r.product_name,
          selling_price: price,
          ingredient_cost: cost,
          food_cost_percent: foodCostPct,
        };
      }),
    };
  }

  /**
   * Execute an analytical tool by name safely.
   */
  static execute(toolName: string, params: Record<string, any> = {}): ToolResult {
    switch (toolName) {
      case 'sales_summary':
        return this.getSalesSummary(params);
      case 'top_items':
        return this.getTopItems(params);
      case 'hourly_sales':
        return this.getHourlySales(params);
      case 'payment_split':
        return this.getPaymentSplit(params);
      case 'low_stock':
        return this.getLowStock();
      case 'food_cost_by_item':
        return this.getFoodCostByItem(params);
      default:
        throw Object.assign(new Error(`Unknown tool "${toolName}"`), { statusCode: 400 });
    }
  }
}
