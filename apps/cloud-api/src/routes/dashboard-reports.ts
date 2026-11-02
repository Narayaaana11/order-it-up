import { Env } from './pairing';
import { isAuthorizedForBranch, isOrgAccountant, isOrgOwnerOrAdmin, UserMembership } from '../rbac';

type Branch = { id: string; organization_id: string; restaurant_id: string | null };
type DateRange = { start: string; end: string; startDate: string; endDate: string };

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localMidnightUtc(date: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    candidate += target - represented;
  }
  return new Date(candidate).toISOString();
}

async function getAuthorizedBranches(
  env: Env,
  orgId: string,
  memberships: UserMembership[],
  requestedBranchId?: string | null,
): Promise<Branch[] | null> {
  const rows = requestedBranchId
    ? await env.DB.prepare('SELECT id, organization_id, restaurant_id FROM branches WHERE id = ? AND organization_id = ?').bind(requestedBranchId, orgId).all<Branch>()
    : await env.DB.prepare('SELECT id, organization_id, restaurant_id FROM branches WHERE organization_id = ?').bind(orgId).all<Branch>();
  const allowed: Branch[] = [];
  const organizationWide = isOrgOwnerOrAdmin(memberships) || isOrgAccountant(memberships) || memberships.some((membership) =>
    membership.status === 'active' && membership.role === 'manager' && membership.restaurant_id === null && membership.branch_id === null
  );
  for (const branch of rows.results || []) {
    if (organizationWide) { allowed.push(branch); continue; }
    const access = await isAuthorizedForBranch(env.DB, orgId, memberships, branch.id, ['owner', 'manager', 'accountant']);
    if (access.authorized) allowed.push(branch);
  }
  if (requestedBranchId && allowed.length === 0) return null;
  return allowed;
}

function branchClause(branches: Branch[], alias = ''): { sql: string; values: string[] } {
  return { sql: `${alias ? `${alias}.` : ''}branch_id IN (${branches.map(() => '?').join(', ')})`, values: branches.map((branch) => branch.id) };
}

async function readTimeZone(env: Env, orgId: string): Promise<string> {
  const row = await env.DB.prepare('SELECT timezone FROM organizations WHERE id = ?').bind(orgId).first<{ timezone: string }>();
  const zone = row?.timezone || 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return zone; } catch { return 'UTC'; }
}

function parseRange(url: URL, zone: string): DateRange | null {
  const startDate = url.searchParams.get('start_date') || url.searchParams.get('date') || new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const endDate = url.searchParams.get('end_date') || startDate;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return null;
  return { startDate, endDate, start: localMidnightUtc(startDate, zone), end: localMidnightUtc(shiftDate(endDate, 1), zone) };
}

function boundedLimit(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : fallback;
}

function summarizeMethods(rows: Array<{ method: string; count: number; total: number }>) {
  return rows.map((row) => ({ method: row.method, count: Number(row.count), total: Number(row.total) }));
}

export async function handleDashboardReport(
  request: Request,
  env: Env,
  orgId: string,
  memberships: UserMembership[],
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/reports\/)/, '');
  const owner = isOrgOwnerOrAdmin(memberships) || memberships.some((membership) => membership.role === 'owner' && membership.status === 'active');
  const manager = memberships.some((membership) => membership.role === 'manager');
  const accountant = memberships.some((membership) => membership.role === 'accountant' && membership.status === 'active');
  if (!owner && !manager && !accountant) {
    return Response.json({ error: 'Forbidden: owner, manager, or accountant membership required' }, { status: 403 });
  }

  const branches = await getAuthorizedBranches(env, orgId, memberships, url.searchParams.get('branch_id'));
  if (branches === null) return Response.json({ error: 'Forbidden: branch is outside your authorized scope' }, { status: 403 });
  if (branches.length === 0) return Response.json({ error: 'No authorized branches are available for reporting' }, { status: 403 });
  const scope = branchClause(branches);
  const zone = await readTimeZone(env, orgId);
  const range = parseRange(url, zone);
  if (!range) return Response.json({ error: 'Invalid date range; use YYYY-MM-DD with start_date on or before end_date' }, { status: 400 });
  const orderFilter = `organization_id = ? AND ${scope.sql} AND ordered_at >= ? AND ordered_at < ? AND status != 'cancelled'`;
  const orderParams = [orgId, ...scope.values, range.start, range.end];

  if (path === '/reports/daily-stats' || path === '/reports/summary') {
    const [sales, activity, tables, turns, methods] = await Promise.all([
      env.DB.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM customer_payments WHERE organization_id = ? AND ${scope.sql} AND created_at >= ? AND created_at < ? AND status IN ('completed', 'refunded')`)
        .bind(orgId, ...scope.values, range.start, range.end).first<{ total: number }>(),
      env.DB.prepare(`SELECT SUM(CASE WHEN status IN ('pending','preparing','active') THEN 1 ELSE 0 END) AS running, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, COUNT(*) AS total FROM synced_orders WHERE ${orderFilter} AND status IN ('pending','preparing','active')`)
        .bind(...orderParams).first<{ running: number; pending: number; total: number }>(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM dining_tables WHERE organization_id = ? AND ${scope.sql} AND status = 'occupied' AND is_active = 1`)
        .bind(orgId, ...scope.values).first<{ count: number }>(),
      env.DB.prepare(`SELECT AVG((julianday(completed_at) - julianday(ordered_at)) * 1440) AS avg_minutes, COUNT(*) AS count FROM synced_orders WHERE ${orderFilter} AND order_type = 'dine_in' AND status = 'completed' AND completed_at IS NOT NULL AND completed_at >= ordered_at`)
        .bind(...orderParams).first<{ avg_minutes: number | null; count: number }>(),
      env.DB.prepare(`SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM customer_payments WHERE organization_id = ? AND ${scope.sql} AND created_at >= ? AND created_at < ? AND status IN ('completed','refunded') AND amount > 0 GROUP BY payment_method ORDER BY total DESC`)
        .bind(orgId, ...scope.values, range.start, range.end).all<{ method: string; count: number; total: number }>(),
    ]);
    const paymentMethods = summarizeMethods(methods.results || []);
    if (path.endsWith('/daily-stats')) {
      return Response.json({
        sales: Number(sales?.total || 0),
        runningOrders: Number(activity?.running || 0),
        pendingOrders: Number(activity?.pending || 0),
        tablesOccupied: Number(tables?.count || 0),
        avgTableTurnMinutes: turns?.count && turns.avg_minutes != null ? Math.round(turns.avg_minutes) : null,
        paymentMethods,
      });
    }
    const [orders, bills] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS total FROM synced_orders WHERE organization_id = ? AND ${scope.sql} AND ordered_at >= ? AND ordered_at < ?`)
        .bind(orgId, ...scope.values, range.start, range.end).first<{ count: number; total: number }>(),
      env.DB.prepare(`SELECT COUNT(DISTINCT order_id) AS count, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total, COALESCE(SUM(amount), 0) AS collected FROM customer_payments WHERE organization_id = ? AND ${scope.sql} AND created_at >= ? AND created_at < ? AND status IN ('completed','refunded')`)
        .bind(orgId, ...scope.values, range.start, range.end).first<{ count: number; total: number; collected: number }>(),
    ]);
    return Response.json({ summary: { date: range.startDate, orders: { count: Number(orders?.count || 0), total: Number(orders?.total || 0) }, bills: { count: Number(bills?.count || 0), total: Number(bills?.total || 0), collected: Number(bills?.collected || 0) }, customers: { new: null }, paymentMethods } });
  }

  if (path === '/reports/financial-summary') {
    const refundScope = branchClause(branches, 'p');
    const [collections, methodRows, refundRows] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(DISTINCT CASE WHEN amount > 0 AND parent_payment_id IS NULL THEN order_id END) AS bill_count, COUNT(CASE WHEN amount < 0 AND parent_payment_id IS NOT NULL THEN 1 END) AS refund_count, COALESCE(SUM(CASE WHEN amount > 0 AND parent_payment_id IS NULL THEN amount ELSE 0 END), 0) AS gross_collected, COALESCE(SUM(CASE WHEN amount < 0 AND parent_payment_id IS NOT NULL THEN -amount ELSE 0 END), 0) AS refunded FROM customer_payments WHERE organization_id = ? AND ${scope.sql} AND created_at >= ? AND created_at < ? AND status IN ('completed','refunded')`)
        .bind(orgId, ...scope.values, range.start, range.end).first<{ bill_count: number; refund_count: number; gross_collected: number; refunded: number }>(),
      env.DB.prepare(`SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM customer_payments WHERE organization_id = ? AND ${scope.sql} AND created_at >= ? AND created_at < ? AND amount > 0 AND parent_payment_id IS NULL AND status IN ('completed','refunded') GROUP BY payment_method ORDER BY total DESC`)
        .bind(orgId, ...scope.values, range.start, range.end).all<{ method: string; count: number; total: number }>(),
      env.DB.prepare(`SELECT p.id, p.amount, p.payment_method AS method, p.refund_reason AS reason, p.created_at, p.parent_payment_id, p.order_id, p.cashier_name, o.order_number, original.created_at AS paid_at FROM customer_payments p JOIN synced_orders o ON o.id = p.order_id LEFT JOIN customer_payments original ON original.id = p.parent_payment_id WHERE p.organization_id = ? AND ${refundScope.sql} AND p.created_at >= ? AND p.created_at < ? AND p.amount < 0 AND p.parent_payment_id IS NOT NULL ORDER BY p.created_at DESC LIMIT 50`)
        .bind(orgId, ...refundScope.values, range.start, range.end).all<any>(),
    ]);
    const gross = Number(collections?.gross_collected || 0);
    const refunded = Number(collections?.refunded || 0);
    const billCount = Number(collections?.bill_count || 0);
    const refunds = (refundRows.results || []).map((row) => ({ id: row.id, amount: Math.abs(Number(row.amount)), method: row.method, reason: row.reason, created_at: row.created_at, bill_number: `PAY-${row.parent_payment_id || row.id}`, paid_at: row.paid_at || '', order_number: row.order_number, approved_by_name: row.cashier_name || 'Unknown' }));
    return Response.json({ financialSummary: { startDate: range.startDate, endDate: range.endDate, grossCollected: gross, refunded, netCollected: gross - refunded, billCount, refundCount: Number(collections?.refund_count || 0), averageOrderValue: billCount ? (gross - refunded) / billCount : 0, paymentMethods: summarizeMethods(methodRows.results || []), refunds } });
  }

  if (path === '/reports/topProducts') {
    const limit = boundedLimit(url.searchParams.get('limit'), 10);
    const rows = await env.DB.prepare(`SELECT i.product_id, i.product_name, SUM(i.quantity) AS total_quantity, SUM(i.subtotal) AS total_revenue, COUNT(DISTINCT i.order_id) AS order_count FROM synced_order_items i JOIN synced_orders o ON o.id = i.order_id WHERE o.organization_id = ? AND o.${scope.sql} AND o.ordered_at >= ? AND o.ordered_at < ? AND o.status != 'cancelled' GROUP BY i.product_id, i.product_name ORDER BY total_quantity DESC LIMIT ?`)
      .bind(orgId, ...scope.values, range.start, range.end, limit).all();
    return Response.json({ topProducts: rows.results || [] });
  }

  if (path === '/reports/recentOrders') {
    const limit = boundedLimit(url.searchParams.get('limit'), 20);
    const rows = await env.DB.prepare(`SELECT id, order_number, status, grand_total AS total, customer_name, table_number AS table_name, ordered_at AS created_at FROM synced_orders WHERE ${orderFilter} ORDER BY ordered_at DESC LIMIT ?`)
      .bind(...orderParams, limit).all();
    return Response.json({ recentOrders: rows.results || [] });
  }

  if (path === '/reports/insights') {
    const requestedDays = Number(url.searchParams.get('days'));
    const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 1), 365) : 30;
    const insightsStart = localMidnightUtc(shiftDate(range.endDate, -days), zone);
    const [staffRows, categoryRows, prep, timeRows, revenue] = await Promise.all([
      env.DB.prepare(`SELECT created_by_user_id AS user_id, COALESCE(created_by_name, 'Staff') AS name, 'staff' AS role, SUM(grand_total) AS revenue, COUNT(*) AS orderCount FROM synced_orders WHERE organization_id = ? AND ${scope.sql} AND ordered_at >= ? AND status != 'cancelled' AND created_by_user_id IS NOT NULL GROUP BY created_by_user_id, created_by_name ORDER BY revenue DESC LIMIT 5`)
        .bind(orgId, ...scope.values, insightsStart).all(),
      env.DB.prepare(`SELECT c.id AS category_id, COALESCE(c.name, 'Uncategorized') AS name, SUM(i.quantity) AS quantity, SUM(i.subtotal) AS revenue FROM synced_order_items i JOIN synced_orders o ON o.id = i.order_id LEFT JOIN master_products p ON p.id = i.product_id LEFT JOIN master_categories c ON c.id = p.category_id WHERE o.organization_id = ? AND o.${scope.sql} AND o.ordered_at >= ? AND o.status != 'cancelled' GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 5`)
        .bind(orgId, ...scope.values, insightsStart).all(),
      env.DB.prepare(`SELECT AVG((julianday(ready_at) - julianday(started_at)) * 1440) AS avg_minutes, COUNT(*) AS count FROM kitchen_tickets WHERE organization_id = ? AND ${scope.sql} AND created_at >= ? AND started_at IS NOT NULL AND ready_at IS NOT NULL AND status != 'cancelled'`)
        .bind(orgId, ...scope.values, insightsStart).first<{ avg_minutes: number | null; count: number }>(),
      env.DB.prepare(`SELECT ordered_at FROM synced_orders WHERE organization_id = ? AND ${scope.sql} AND ordered_at >= ? AND status != 'cancelled'`)
        .bind(orgId, ...scope.values, insightsStart).all<{ ordered_at: string }>(),
      env.DB.prepare(`SELECT COUNT(DISTINCT CASE WHEN amount > 0 AND parent_payment_id IS NULL THEN order_id END) AS bills, COALESCE(SUM(amount), 0) AS net FROM customer_payments WHERE organization_id = ? AND ${scope.sql} AND created_at >= ? AND status IN ('completed','refunded')`)
        .bind(orgId, ...scope.values, insightsStart).first<{ bills: number; net: number }>(),
    ]);
    const hours = Array.from({ length: 24 }, () => 0);
    const weekdays = Array.from({ length: 7 }, () => 0);
    for (const row of timeRows.results || []) {
      const instant = new Date(row.ordered_at);
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(values.weekday);
      const hour = Number(values.hour);
      if (weekdayIndex >= 0) weekdays[weekdayIndex] += 1;
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) hours[hour] += 1;
    }
    const extreme = (values: number[], max: boolean, nonZeroOnly: boolean) => {
      let index = -1;
      values.forEach((count, current) => { if ((!nonZeroOnly || count > 0) && (index < 0 || (max ? count > values[index] : count < values[index]))) index = current; });
      return index < 0 ? null : { index, count: values[index] };
    };
    const bills = Number(revenue?.bills || 0);
    return Response.json({ windowDays: days, aov: bills ? Number(revenue?.net || 0) / bills : 0, avgPrepTimeMinutes: prep?.count && prep.avg_minutes != null ? Math.round(prep.avg_minutes) : null, topStaff: staffRows.results || [], topCategories: categoryRows.results || [], busiestHour: extreme(hours, true, true) && { hour: extreme(hours, true, true)!.index, orderCount: extreme(hours, true, true)!.count }, idlestHour: extreme(hours, false, true) && { hour: extreme(hours, false, true)!.index, orderCount: extreme(hours, false, true)!.count }, busiestDayOfWeek: extreme(weekdays, true, false) && { dayIndex: extreme(weekdays, true, false)!.index, orderCount: extreme(weekdays, true, false)!.count }, idlestDayOfWeek: extreme(weekdays, false, false) && { dayIndex: extreme(weekdays, false, false)!.index, orderCount: extreme(weekdays, false, false)!.count } });
  }

  return Response.json({ error: 'Report not found' }, { status: 404 });
}
