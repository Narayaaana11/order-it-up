import { BranchPerformanceSummary, BranchSalesMetric, TopSellingItemMetric } from '../../../../shared/cloud-types';
import { Env } from './pairing';

export async function handleAnalyticsOverview(request: Request, env: Env, orgId: string): Promise<Response> {
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString();
  const dateTo = url.searchParams.get('to') || new Date().toISOString();

  // 1. Fetch all branches of this organization
  const branches = await env.DB.prepare(`
    SELECT id, code, name, is_main_branch FROM branches WHERE organization_id = ?
  `).bind(orgId).all<{ id: string; code: string; name: string; is_main_branch: number }>();

  // 2. Aggregate sales per branch
  const branchSalesRows = await env.DB.prepare(`
    SELECT
      branch_id,
      COUNT(id) as order_count,
      COALESCE(SUM(grand_total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN grand_total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN grand_total ELSE 0 END), 0) as digital_sales
    FROM synced_orders
    WHERE organization_id = ?
      AND ordered_at >= ? AND ordered_at <= ?
      AND status != 'cancelled'
    GROUP BY branch_id
  `).bind(orgId, dateFrom, dateTo).all<{
    branch_id: string;
    order_count: number;
    total_sales: number;
    cash_sales: number;
    digital_sales: number;
  }>();

  const salesMap = new Map(branchSalesRows.results.map(r => [r.branch_id, r]));

  let totalOrgRevenue = 0;
  let totalOrgOrders = 0;

  const branchMetrics: BranchSalesMetric[] = branches.results.map(b => {
    const sale = salesMap.get(b.id);
    const total_sales = sale?.total_sales || 0;
    const order_count = sale?.order_count || 0;
    totalOrgRevenue += total_sales;
    totalOrgOrders += order_count;

    return {
      branch_id: b.id,
      branch_code: b.code,
      branch_name: b.name,
      is_main_branch: Boolean(b.is_main_branch),
      total_sales,
      order_count,
      average_ticket: order_count > 0 ? Math.round((total_sales / order_count) * 100) / 100 : 0,
      cash_sales: sale?.cash_sales || 0,
      digital_sales: sale?.digital_sales || 0,
    };
  });

  // Sort branches by total sales descending (Top selling branch first)
  branchMetrics.sort((a, b) => b.total_sales - a.total_sales);

  // 3. Overall Top 10 Selling Items across all branches
  const topItemsRows = await env.DB.prepare(`
    SELECT
      product_name,
      SUM(quantity) as quantity_sold,
      SUM(subtotal) as total_revenue
    FROM synced_order_items i
    JOIN synced_orders o ON i.order_id = o.id
    WHERE o.organization_id = ?
      AND o.ordered_at >= ? AND o.ordered_at <= ?
      AND o.status != 'cancelled'
    GROUP BY product_name
    ORDER BY quantity_sold DESC
    LIMIT 10
  `).bind(orgId, dateFrom, dateTo).all<{
    product_name: string;
    quantity_sold: number;
    total_revenue: number;
  }>();

  const topItems: TopSellingItemMetric[] = topItemsRows.results.map(r => ({
    product_name: r.product_name,
    quantity_sold: r.quantity_sold,
    total_revenue: r.total_revenue
  }));

  // 4. Top Selling Items per Branch
  const velocityByBranchRows = await env.DB.prepare(`
    SELECT
      i.branch_id,
      b.name as branch_name,
      i.product_name,
      SUM(i.quantity) as quantity_sold,
      SUM(i.subtotal) as total_revenue
    FROM synced_order_items i
    JOIN branches b ON i.branch_id = b.id
    JOIN synced_orders o ON i.order_id = o.id
    WHERE o.organization_id = ?
      AND o.ordered_at >= ? AND o.ordered_at <= ?
      AND o.status != 'cancelled'
    GROUP BY i.branch_id, i.product_name
    ORDER BY quantity_sold DESC
  `).bind(orgId, dateFrom, dateTo).all<{
    branch_id: string;
    branch_name: string;
    product_name: string;
    quantity_sold: number;
    total_revenue: number;
  }>();

  const itemVelocityByBranch: Record<string, TopSellingItemMetric[]> = {};
  for (const b of branches.results) {
    itemVelocityByBranch[b.id] = [];
  }

  for (const row of velocityByBranchRows.results) {
    if (!itemVelocityByBranch[row.branch_id]) {
      itemVelocityByBranch[row.branch_id] = [];
    }
    if (itemVelocityByBranch[row.branch_id].length < 5) {
      itemVelocityByBranch[row.branch_id].push({
        product_name: row.product_name,
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        quantity_sold: row.quantity_sold,
        total_revenue: row.total_revenue
      });
    }
  }

  const summary: BranchPerformanceSummary = {
    organization_id: orgId,
    date_from: dateFrom,
    date_to: dateTo,
    total_revenue: totalOrgRevenue,
    total_orders: totalOrgOrders,
    branches: branchMetrics,
    top_items: topItems,
    item_velocity_by_branch: itemVelocityByBranch,
  };

  return Response.json(summary);
}
