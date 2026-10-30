/**
 * Shared Cloud API contracts and data models for Order It Up Multi-Branch Franchise Cloud.
 *
 * Used by Cloudflare Workers (apps/cloud-api), Next.js HQ Portal (apps/hq-portal),
 * and the Desktop POS engine (main/services/cloud-sync.ts).
 */

export type CloudRole = 'super_admin' | 'owner' | 'accountant' | 'branch_manager' | 'manager' | 'cashier' | 'kitchen' | 'waiter' | 'server' | 'chef';

export interface CloudOrganization {
  id: string;
  name: string;
  legal_name?: string | null;
  tax_number?: string | null;
  currency: string;
  country: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface CloudBranch {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  is_main_branch: boolean;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: 'active' | 'inactive';
  settings_json?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudUser {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: CloudRole;
  assigned_branch_id?: string | null;
  status: 'active' | 'inactive';
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudTerminal {
  id: string;
  organization_id: string;
  branch_id: string;
  terminal_name: string;
  last_seen_at?: string | null;
  app_version?: string | null;
  created_at: string;
}

export interface PairingTokenResponse {
  code: string;
  organization_id: string;
  branch_id: string;
  terminal_name: string;
  expires_at: string;
}

export interface PairingClaimRequest {
  code: string;
  device_fingerprint?: string;
  app_version?: string;
}

export interface PairingClaimResponse {
  success: boolean;
  terminal_id: string;
  terminal_token: string;
  organization_id: string;
  organization_name: string;
  branch_id: string;
  branch_name: string;
  currency: string;
  timezone: string;
}

export interface MasterCategory {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MasterProduct {
  id: string;
  organization_id: string;
  category_id?: string | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  base_price: number;
  tax_rate: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BranchProductOverride {
  branch_id: string;
  product_id: string;
  price_override?: number | null;
  is_available: boolean;
  updated_at: string;
}

export interface SyncedOrderPayload {
  id: string;
  order_number: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery' | 'quick_service';
  status: 'completed' | 'cancelled' | 'refunded';
  subtotal: number;
  tax_total: number;
  discount_total: number;
  grand_total: number;
  payment_method: string;
  ordered_at: string;
  items: Array<{
    id: string;
    product_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
  }>;
}

export interface SyncedCashClosurePayload {
  id: string;
  closure_date: string;
  opened_at: string;
  closed_at: string;
  opening_cash: number;
  cash_sales: number;
  card_sales: number;
  upi_sales: number;
  other_sales: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  notes?: string | null;
  closed_by: string;
}

export interface BatchSyncEvent {
  id: string;
  type: 'order.created' | 'order.updated' | 'order.completed' | 'order.cancelled' | 'closure.recorded' | 'inventory.updated' | 'payment.recorded' | 'payment.settled';
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface BatchSyncRequest {
  terminal_token: string;
  branch_id: string;
  events: BatchSyncEvent[];
  sent_at: string;
}

export interface BatchSyncResponse {
  success: boolean;
  processed_count: number;
  failed_count: number;
  synced_ids: string[];
  server_time: string;
}

export interface BranchSalesMetric {
  branch_id: string;
  branch_code: string;
  branch_name: string;
  is_main_branch: boolean;
  total_sales: number;
  order_count: number;
  average_ticket: number;
  cash_sales: number;
  digital_sales: number;
}

export interface TopSellingItemMetric {
  product_name: string;
  branch_id?: string;
  branch_name?: string;
  quantity_sold: number;
  total_revenue: number;
}

export interface BranchPerformanceSummary {
  organization_id: string;
  date_from: string;
  date_to: string;
  total_revenue: number;
  total_orders: number;
  branches: BranchSalesMetric[];
  top_items: TopSellingItemMetric[];
  item_velocity_by_branch: Record<string, TopSellingItemMetric[]>;
}

export interface InventoryTransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
}

export interface InventoryTransfer {
  id: string;
  organization_id: string;
  source_branch_id: string;
  dest_branch_id: string;
  source_branch_name?: string;
  dest_branch_name?: string;
  status: 'pending' | 'dispatched' | 'received' | 'rejected';
  items: InventoryTransferItem[];
  requested_by: string;
  approved_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
