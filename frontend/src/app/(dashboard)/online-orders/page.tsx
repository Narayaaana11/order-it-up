'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import {
  Bike,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  User,
  Search,
  Calendar,
  Printer,
  RefreshCw,
  PlusCircle,
  ChevronDown,
  ChefHat,
  PackageCheck,
  XCircle,
  ExternalLink,
  Flame,
  ShoppingBag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useFormatDate } from '@/hooks/useFormatDate';
import { useConfirm } from '@/hooks/use-confirm';
import { printWebBill } from '@/lib/printer/web-print';
import type { Bill } from '@/lib/types';

interface AggregatorOrder {
  id: number;
  tenant_id: string;
  order_number: string;
  external_order_id?: string;
  online_platform?: 'zomato' | 'swiggy' | 'magicpin' | 'direct';
  type: 'online' | 'delivery' | 'takeaway' | 'dine_in';
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  rider_name?: string;
  rider_phone?: string;
  rider_status?: 'assigned' | 'at_store' | 'picked_up' | 'dispatched' | 'delivered';
  prep_time_minutes?: number;
  created_at: string;
  items?: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    special_instructions?: string;
    status: string;
  }>;
  bill?: Bill;
}

interface OnlineStats {
  total_orders: number;
  total_revenue: number;
  zomato_orders: number;
  zomato_revenue: number;
  swiggy_orders: number;
  swiggy_revenue: number;
  active_orders: number;
}

export default function OnlineOrdersPage() {
  const { currentTenant } = useAuthStore();
  const fmt = useFormatCurrency();
  const { formatTime, formatDateTime } = useFormatDate();
  const { confirm, ConfirmDialog } = useConfirm();

  const [orders, setOrders] = useState<AggregatorOrder[]>([]);
  const [stats, setStats] = useState<OnlineStats>({
    total_orders: 0,
    total_revenue: 0,
    zomato_orders: 0,
    zomato_revenue: 0,
    swiggy_orders: 0,
    swiggy_revenue: 0,
    active_orders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'zomato' | 'swiggy'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [simulating, setSimulating] = useState<'zomato' | 'swiggy' | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchOnlineOrders = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const params: Record<string, string> = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedPlatform !== 'all') params.platform = selectedPlatform;
      if (statusFilter !== 'all') params.status = statusFilter;

      const { data } = await api.get('/aggregators/orders', { params });
      setOrders(data.orders || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch {
      toast.error('Failed to load online orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, selectedPlatform, statusFilter]);

  useEffect(() => {
    fetchOnlineOrders();
    const interval = setInterval(() => fetchOnlineOrders(false), 8000); // 8s live polling
    return () => clearInterval(interval);
  }, [fetchOnlineOrders]);

  const handleSimulateOrder = async (platform: 'zomato' | 'swiggy') => {
    setSimulating(platform);
    try {
      const { data } = await api.post('/aggregators/test-order', { platform });
      toast.success(
        `Incoming ${platform.toUpperCase()} Order #${data.external_order_id} simulated!`,
        { icon: platform === 'zomato' ? '🔴' : '🟠' }
      );
      await fetchOnlineOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to simulate ${platform} order`);
    } finally {
      setSimulating(null);
    }
  };

  const handleUpdateStatus = async (orderId: number, status: string, riderStatus?: string) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      if (riderStatus) {
        await api.post(`/aggregators/orders/${orderId}/dispatch`, { rider_status: riderStatus });
      }
      toast.success(`Order status updated to ${status}`);
      await fetchOnlineOrders();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDispatch = async (orderId: number) => {
    setUpdatingId(orderId);
    try {
      await api.post(`/aggregators/orders/${orderId}/dispatch`, {
        rider_status: 'dispatched',
      });
      toast.success('Order handed over to delivery rider!');
      await fetchOnlineOrders();
    } catch {
      toast.error('Failed to dispatch order');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePrintOrder = async (order: AggregatorOrder) => {
    try {
      let billData = order.bill;
      if (!billData) {
        // Generate or fetch bill
        try {
          const { data } = await api.post('/bills/generate', { order_id: order.id });
          billData = data.bill;
        } catch {
          // Construct fallback printable receipt from order
          billData = {
            id: order.id,
            tenant_id: order.tenant_id,
            order_id: order.id,
            bill_number: order.order_number,
            subtotal: order.subtotal,
            tax_amount: order.tax_amount,
            discount_amount: order.discount_amount,
            service_charge: 0,
            delivery_charge: 0,
            total: order.total,
            paid_amount: order.total,
            balance: 0,
            payment_status: 'paid',
            payment_method: 'upi',
            created_at: order.created_at,
            order: {
              ...order,
              items: (order.items || []).map((i) => ({
                id: i.id,
                order_id: order.id,
                product_id: 0,
                product_name: i.product_name,
                unit_price: i.unit_price,
                quantity: i.quantity,
                total_price: i.total_price,
                status: (i.status as any) || 'served',
                special_instructions: i.special_instructions,
              })),
            },
          } as unknown as Bill;
        }
      }

      await printWebBill(
        billData!,
        {
          business_name: currentTenant?.business_name || 'Order It Up Restaurant',
          currency: currentTenant?.currency || 'INR',
          country: currentTenant?.country || 'IN',
          timezone: currentTenant?.timezone || 'Asia/Kolkata',
        },
        { showUpiQr: true }
      );
      toast.success('Bill sent to printer');
    } catch {
      toast.error('Failed to print receipt');
    }
  };

  // Filter orders locally by search query
  const filteredOrders = orders.filter((order) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(q) ||
      (order.external_order_id && order.external_order_id.toLowerCase().includes(q)) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(q)) ||
      (order.customer_phone && order.customer_phone.includes(q)) ||
      (order.rider_name && order.rider_name.toLowerCase().includes(q)) ||
      (order.items && order.items.some((i) => i.product_name.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 overflow-y-auto bg-background space-y-6">
      {ConfirmDialog}

      {/* Header Bar with Simulation Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Bike className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Online Orders Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                Live Swiggy & Zomato Aggregator Direct Integration with Automated KDS & Dispatch
              </p>
            </div>
          </div>
        </div>

        {/* Quick Simulation Actions for Owners */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOnlineOrders(true)}
            disabled={refreshing}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 me-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => handleSimulateOrder('zomato')}
            disabled={simulating !== null}
            className="bg-[#cb202d] hover:bg-[#b01c27] text-white shadow-sm font-semibold"
          >
            <Flame className="size-3.5 me-1.5" />
            {simulating === 'zomato' ? 'Simulating...' : '+ Test Zomato'}
          </Button>

          <Button
            size="sm"
            onClick={() => handleSimulateOrder('swiggy')}
            disabled={simulating !== null}
            className="bg-[#fc8019] hover:bg-[#e07115] text-white shadow-sm font-semibold"
          >
            <ShoppingBag className="size-3.5 me-1.5" />
            {simulating === 'swiggy' ? 'Simulating...' : '+ Test Swiggy'}
          </Button>
        </div>
      </div>

      {/* Daily Performance KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Total Online Orders</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">{stats.total_orders}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {stats.active_orders} Active
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Day: {selectedDate || 'All Time'}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Online Revenue</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground">{fmt(stats.total_revenue)}</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            Direct Merchant Settlements
          </span>
        </div>

        <div className="p-4 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/40 dark:bg-red-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#cb202d]">Zomato Orders</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#cb202d]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">{stats.zomato_orders}</span>
            <span className="text-xs font-bold text-[#cb202d]">{fmt(stats.zomato_revenue)}</span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Zomato Food Delivery</span>
        </div>

        <div className="p-4 rounded-xl border border-orange-100 dark:border-orange-950/40 bg-orange-50/40 dark:bg-orange-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#fc8019]">Swiggy Orders</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#fc8019]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">{stats.swiggy_orders}</span>
            <span className="text-xs font-bold text-[#fc8019]">{fmt(stats.swiggy_revenue)}</span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Swiggy Cloud Kitchen</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm col-span-2 md:col-span-4 lg:col-span-1">
          <span className="text-xs font-medium text-muted-foreground">Avg Ticket Size</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground">
              {stats.total_orders > 0 ? fmt(stats.total_revenue / stats.total_orders) : fmt(0)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Per Online Basket</span>
        </div>
      </div>

      {/* Filter Toolbar: Search, Platform Tabs, Status & Date Filter */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order #, External ID, Customer, Rider, Item..."
            className="w-full ps-9 pe-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg border border-border self-start lg:self-auto">
          <button
            onClick={() => setSelectedPlatform('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              selectedPlatform === 'all'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Platforms
          </button>
          <button
            onClick={() => setSelectedPlatform('zomato')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              selectedPlatform === 'zomato'
                ? 'bg-[#cb202d] text-white shadow-sm'
                : 'text-muted-foreground hover:text-[#cb202d]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            Zomato
          </button>
          <button
            onClick={() => setSelectedPlatform('swiggy')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              selectedPlatform === 'swiggy'
                ? 'bg-[#fc8019] text-white shadow-sm'
                : 'text-muted-foreground hover:text-[#fc8019]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            Swiggy
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active (Pending/Prep/Ready)</option>
            <option value="completed">Completed / Dispatched</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Date Picker */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="ms-1.5 text-xs text-muted-foreground hover:text-foreground underline"
                title="View All Dates"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabular Orders Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground">
          <RefreshCw className="size-8 animate-spin mb-2 text-brand" />
          <p className="text-sm font-medium">Syncing with Swiggy & Zomato API gateways...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 border-2 border-dashed border-border rounded-2xl bg-card text-center p-6">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <Bike className="size-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No online orders for this filter</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
            Incoming orders from Swiggy and Zomato will trigger automatically with live sound and popups.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleSimulateOrder('zomato')}
              className="bg-[#cb202d] hover:bg-[#b01c27] text-white"
            >
              Simulate Zomato Order
            </Button>
            <Button
              size="sm"
              onClick={() => handleSimulateOrder('swiggy')}
              className="bg-[#fc8019] hover:bg-[#e07115] text-white"
            >
              Simulate Swiggy Order
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3.5 px-4">Order & Platform</th>
                  <th className="py-3.5 px-4">Customer & Delivery</th>
                  <th className="py-3.5 px-4">Items Summary</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status & Rider</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => {
                  const isZomato = order.online_platform === 'zomato';
                  const isSwiggy = order.online_platform === 'swiggy';
                  const isPending = order.status === 'pending';
                  const isPreparing = order.status === 'preparing';
                  const isReady = order.status === 'ready';
                  const isCompleted = order.status === 'completed';

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isPending ? 'bg-amber-50/20 dark:bg-amber-950/10 font-medium' : ''
                      }`}
                    >
                      {/* Order & Platform */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-center gap-2 mb-1">
                          {isZomato ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#cb202d] text-white tracking-wider">
                              ZOMATO
                            </span>
                          ) : isSwiggy ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#fc8019] text-white tracking-wider">
                              SWIGGY
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                              ONLINE
                            </span>
                          )}
                          <span className="font-mono text-xs font-bold text-foreground">
                            #{order.order_number}
                          </span>
                        </div>
                        {order.external_order_id && (
                          <div className="text-xs font-semibold text-muted-foreground font-mono">
                            Ref: {order.external_order_id}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDateTime(order.created_at)}
                        </div>
                      </td>

                      {/* Customer & Address */}
                      <td className="py-4 px-4 align-top max-w-[220px]">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <User className="size-3 text-muted-foreground" />
                          {order.customer_name || 'Valued Guest'}
                        </div>
                        {order.customer_phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                            <Phone className="size-3" />
                            {order.customer_phone}
                          </div>
                        )}
                        {order.delivery_address && (
                          <div className="text-xs text-muted-foreground/80 flex items-start gap-1 mt-1 truncate max-w-[200px]" title={order.delivery_address}>
                            <MapPin className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
                            <span className="truncate">{order.delivery_address}</span>
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 align-top max-w-[280px]">
                        <div className="space-y-1">
                          {(order.items || []).map((item, idx) => (
                            <div key={idx} className="text-xs text-foreground flex items-center justify-between gap-2">
                              <span className="truncate">
                                <span className="font-bold text-brand">{item.quantity}x</span> {item.product_name}
                              </span>
                              <span className="text-muted-foreground font-mono text-[11px]">
                                {fmt(item.total_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Bill Amount */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-black text-base text-foreground font-mono">
                          {fmt(order.total)}
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                          Prepaid (Aggregator)
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Subtotal: {fmt(order.subtotal)}
                        </div>
                      </td>

                      {/* Status & Rider */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          {/* Order Status Badge */}
                          <div>
                            {order.status === 'pending' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 inline-flex items-center gap-1">
                                <AlertCircle className="size-3" /> New Order
                              </span>
                            )}
                            {order.status === 'preparing' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 inline-flex items-center gap-1">
                                <ChefHat className="size-3" /> In Kitchen ({order.prep_time_minutes || 20}m)
                              </span>
                            )}
                            {order.status === 'ready' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 inline-flex items-center gap-1">
                                <PackageCheck className="size-3" /> Food Ready
                              </span>
                            )}
                            {order.status === 'completed' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> Dispatched
                              </span>
                            )}
                            {order.status === 'cancelled' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 inline-flex items-center gap-1">
                                <XCircle className="size-3" /> Cancelled
                              </span>
                            )}
                          </div>

                          {/* Rider Info */}
                          {order.rider_name ? (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Bike className="size-3 text-orange-500" />
                              <span className="font-medium text-foreground">{order.rider_name}</span>
                              <span className="text-[10px] text-muted-foreground">({order.rider_status || 'Assigned'})</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground italic">
                              Rider assigning...
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right space-y-1.5">
                        {isPending && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              disabled={updatingId === order.id}
                              onClick={() => handleUpdateStatus(order.id, 'preparing')}
                              className="bg-brand hover:bg-brand/90 text-white text-xs h-8"
                            >
                              <ChefHat className="size-3.5 me-1" />
                              Accept (20m)
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingId === order.id}
                              onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                              className="text-red-600 hover:bg-red-50 text-xs h-8"
                            >
                              Reject
                            </Button>
                          </div>
                        )}

                        {isPreparing && (
                          <Button
                            size="sm"
                            disabled={updatingId === order.id}
                            onClick={() => handleUpdateStatus(order.id, 'ready')}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
                          >
                            <PackageCheck className="size-3.5 me-1" />
                            Mark Ready
                          </Button>
                        )}

                        {isReady && (
                          <Button
                            size="sm"
                            disabled={updatingId === order.id}
                            onClick={() => handleDispatch(order.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                          >
                            <Bike className="size-3.5 me-1" />
                            Handover to Rider
                          </Button>
                        )}

                        {/* Print Bill / KOT */}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintOrder(order)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title="Print KOT / Receipt"
                          >
                            <Printer className="size-3.5 me-1" />
                            Print Bill
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
