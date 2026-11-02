'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Plus, RefreshCw, Store, Utensils, Wifi, WifiOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AddonModal from '@/components/pos/AddonModal';
import CartPanel from '@/components/pos/CartPanel';
import ProductGrid from '@/components/pos/ProductGrid';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import api from '@/lib/api';
import { mapCloudCategory, mapCloudProduct, mapCloudTable, type CloudBranch, type CloudOrderRow } from '@/lib/cloud-pos-mappers';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import type { Addon, Category, Product, Table } from '@/lib/types';

type CatalogResponse = { categories?: Record<string, unknown>[]; products?: Record<string, unknown>[] };
type BranchCatalogResponse = { catalog?: Record<string, unknown>[] };

function messageFrom(error: unknown): string {
  const value = error as { response?: { data?: { error?: string } }; message?: string };
  return value?.response?.data?.error || value?.message || 'The request could not be completed.';
}

/**
 * Waiter floor-station app.
 *
 * Reuses the same Cloud catalog, cart, modifier picker and table model as the
 * cashier tablet POS, but leads with the floor: pick a table, add rounds to its
 * open order, and send the round to the kitchen.
 */
export default function TabletWaiterPage() {
  const { currentTenant, user } = useAuthStore();
  const cart = useCartStore();

  const [branches, setBranches] = useState<CloudBranch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<CloudOrderRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);

  const namespace = useMemo(() => {
    const orgId = String(currentTenant?.id || 'unknown');
    const userId = String(user?.id || 'unknown');
    return `oiu.waiter.v1:${orgId}:${userId}`;
  }, [currentTenant?.id, user?.id]);
  const cartStorageKey = `${namespace}:${branchId}:cart`;
  const currentBranch = branches.find((branch) => branch.id === branchId);
  const currency = currentTenant?.currency || 'INR';

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const loadBranchData = useCallback(async (forBranchId: string) => {
    setLoading(true);
    setError('');
    try {
      const [masterResult, branchResult, tableResult, orderResult] = await Promise.all([
        api.get('/catalog/master'),
        api.get(`/catalog/branch/${encodeURIComponent(forBranchId)}`),
        api.get(`/tables?branch_id=${encodeURIComponent(forBranchId)}`),
        api.get(`/orders?branch_id=${encodeURIComponent(forBranchId)}&status=active&limit=50`),
      ]);
      const master = masterResult.data as CatalogResponse;
      const branchCatalog = branchResult.data as BranchCatalogResponse;
      const effectiveById = new Map((branchCatalog.catalog || []).map((item) => [String(item.id), item]));
      const mappedProducts = (master.products || [])
        .map((item) => mapCloudProduct(item, effectiveById.get(String(item.id))))
        .filter((item) => item.is_active);
      setCategories((master.categories || []).map(mapCloudCategory).filter((item) => item.is_active));
      setProducts(mappedProducts);
      const tableRows: Record<string, unknown>[] = Array.isArray(tableResult.data?.tables) ? tableResult.data.tables as Record<string, unknown>[] : [];
      setTables(tableRows.map(mapCloudTable).filter((item) => item.is_active));
      setOrders(Array.isArray(orderResult.data?.orders) ? orderResult.data.orders as CloudOrderRow[] : []);
    } catch (loadError) {
      setError(messageFrom(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/branches')
      .then((response) => {
        if (cancelled) return;
        const rows: CloudBranch[] = Array.isArray(response.data?.branches) ? response.data.branches as CloudBranch[] : [];
        const available = rows.filter((item) => item.status === undefined || item.status === 'active');
        setBranches(available);
        const preferred = available[0]?.id || '';
        setBranchId((current) => current && available.some((item) => item.id === current) ? current : preferred);
      })
      .catch((loadError) => { if (!cancelled) setError(messageFrom(loadError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!branchId) return;
    const savedCart = localStorage.getItem(cartStorageKey);
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart) as { items?: import('@/lib/types').CartItem[]; tableId?: string | null; guestCount?: number; orderNotes?: string };
        if (Array.isArray(parsed.items) && parsed.items.length > 0 && cart.items.length === 0) {
          cart.loadItems(parsed.items, parsed.tableId || null, null, parsed.guestCount || 1, parsed.orderNotes || '');
        }
      } catch { localStorage.removeItem(cartStorageKey); }
    }
    void loadBranchData(branchId);
  // Cart hydration is intentionally scoped to a branch change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, cartStorageKey, loadBranchData]);

  useEffect(() => {
    if (!branchId) return;
    const unsubscribe = useCartStore.subscribe((state) => {
      const snapshot = { items: state.items, tableId: state.tableId, guestCount: state.guestCount, orderNotes: state.orderNotes };
      try { localStorage.setItem(cartStorageKey, JSON.stringify(snapshot)); } catch { /* Persistence limits surface on submit. */ }
    });
    return unsubscribe;
  }, [branchId, cartStorageKey]);

  const orderForTable = useCallback((tableId: string) => (
    orders.find((order) => order.table_id === tableId && order.status !== 'completed' && order.status !== 'cancelled')
  ), [orders]);

  const selectTable = (table: Table) => {
    const existing = orderForTable(table.id);
    cart.setOrderType('dine_in');
    if (existing) {
      cart.setTableId(table.id);
      setAppendOrderId(existing.id);
      toast(`Adding a round to ${existing.order_number}`, { icon: '🧾' });
    } else {
      cart.clearCart();
      cart.setOrderType('dine_in');
      cart.setTableId(table.id);
      setAppendOrderId(null);
    }
    setTablePickerOpen(false);
  };

  const handlePlaceOrder = async () => {
    if (!branchId || cart.items.length === 0) return;
    if (!cart.tableId) {
      setTablePickerOpen(true);
      return;
    }
    if (!online) {
      setError('Sending an order needs a live Cloud connection. The draft stays on this device.');
      return;
    }
    setSubmitting(true);
    setError('');
    const items = cart.items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      modifiers: item.addons.map((addon) => ({ id: addon.id, quantity: addon.quantity || 1 })),
      special_instructions: item.special_instructions || undefined,
    }));
    try {
      if (appendOrderId) {
        const existing = orders.find((order) => order.id === appendOrderId);
        const response = await api.post(`/orders/${encodeURIComponent(appendOrderId)}/items`, {
          items,
          ...(typeof existing?.version === 'number' ? { expected_version: existing.version } : {}),
        });
        if (!response.data?.success && !response.data?.order && !Array.isArray(response.data?.items)) {
          throw new Error('Cloud did not confirm the added items. The draft was kept for a safe retry.');
        }
        toast.success(`Added ${items.length} line${items.length === 1 ? '' : 's'} to ${existing?.order_number || 'the order'}.`);
      } else {
        const id = crypto.randomUUID();
        const response = await api.post('/orders', {
          id,
          branch_id: branchId,
          order_type: 'dine_in',
          table_id: cart.tableId,
          table_number: tables.find((table) => table.id === cart.tableId)?.name,
          guest_count: cart.guestCount,
          notes: cart.orderNotes || undefined,
          items,
        });
        if (!response.data?.order?.id) throw new Error('Cloud did not confirm the order. The draft was kept for a safe retry.');
        toast.success(`Order ${response.data.order.order_number} sent to the kitchen.`);
      }
      const tableId = cart.tableId;
      cart.clearCart();
      cart.setOrderType('dine_in');
      setAppendOrderId(null);
      if (tableId) cart.setTableId(tableId);
      setDrawerOpen(false);
      await loadBranchData(branchId);
    } catch (orderError) {
      setError(messageFrom(orderError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.addon_groups?.length) setAddonProduct(product);
    else cart.addItem(product, 1);
  };

  const handleAddons = (product: Product, quantity: number, addons: Addon[], notes: string) => {
    cart.addItem(product, quantity, addons, notes);
    setAddonProduct(null);
  };

  const cartCount = cart.itemCount();
  const appendOrder = appendOrderId ? orders.find((order) => order.id === appendOrderId) : null;

  if (loading && branches.length === 0) {
    return <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Connecting to your restaurant…</div>;
  }

  if (!branches.length && !loading) {
    return <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-border bg-card p-8 text-center"><Store className="mx-auto h-10 w-10 text-brand" /><h1 className="mt-4 text-xl font-bold">No restaurant branch is available</h1><p className="mt-2 text-sm text-muted-foreground">Ask an owner or manager to assign this account to an active branch.</p>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="tablet-waiter">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border bg-card px-3 py-2 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Utensils size={19} /></div>
          <div className="min-w-0"><p className="truncate text-sm font-bold">Waiter station · {currentBranch?.name || 'Order It Up'}</p><p className="truncate text-[11px] text-muted-foreground">{currentTenant?.business_name || currentTenant?.name || 'Restaurant'}</p></div>
        </div>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs font-medium">
          <span className="sr-only">Branch</span><Store size={14} />
          <select aria-label="Branch" className="max-w-40 bg-transparent outline-none" value={branchId} onChange={(event) => { cart.clearCart(); setAppendOrderId(null); setBranchId(event.target.value); }}>
            <option value="">Choose branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => branchId && void loadBranchData(branchId)} aria-label="Refresh floor" className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-border hover:bg-muted"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
        <div className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`} aria-live="polite">{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Online' : 'Offline'}</div>
      </header>

      {error && <div role="alert" className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"><span className="min-w-0">{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss message"><X size={16} /></button></div>}

      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <section aria-label="Floor plan" className="border-b border-border bg-card px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Floor · tap a table to start or add a round</h2>
              <button type="button" onClick={() => setTablePickerOpen(true)} className="min-h-8 rounded-lg border border-border px-2.5 text-xs font-bold"><Plus size={13} className="me-1 inline" />Table</button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {tables.map((table) => {
                const active = orderForTable(table.id);
                const selected = cart.tableId === table.id;
                return (
                  <button key={table.id} type="button" onClick={() => selectTable(table)} aria-pressed={selected} className={`min-w-32 shrink-0 rounded-xl border p-3 text-start ${selected ? 'border-brand bg-brand/5 ring-2 ring-brand/30' : active ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50 hover:border-emerald-400'}`}>
                    <span className="flex items-center justify-between gap-2"><span className="font-bold">{table.name}</span><span className="text-[10px] uppercase text-muted-foreground">{active ? 'open' : table.status}</span></span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{active ? `${active.order_number} · ${currency} ${Number(active.total ?? active.grand_total ?? 0).toFixed(2)}` : `${table.capacity || 4} seats`}</span>
                  </button>
                );
              })}
              {tables.length === 0 && <p className="py-4 text-sm text-muted-foreground">No active tables configured for this branch.</p>}
            </div>
          </section>

          {appendOrder && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950"><span>Adding items to <strong>{appendOrder.order_number}</strong> · table {appendOrder.table_number || "—"} · {appendOrder.kitchen_status || "pending"}</span><button type="button" onClick={() => { setAppendOrderId(null); cart.clearCart(); }} className="min-h-8 rounded-lg border border-sky-300 px-2.5 text-xs font-bold">Start a new order instead</button></div>}

          {loading
            ? <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Loading branch menu…</div>
            : products.length
              ? <ProductGrid categories={categories} products={products} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} search={search} setSearch={setSearch} currency={currency} onProductClick={handleProductClick} />
              : <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"><Store className="h-10 w-10 text-muted-foreground" /><p className="font-semibold">No active menu items at this branch</p><button type="button" onClick={() => branchId && void loadBranchData(branchId)} className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold"><RefreshCw size={14} className="me-2 inline" />Refresh menu</button></div>}
        </div>

        <aside className="hidden h-full w-[min(38vw,390px)] shrink-0 border-s border-border bg-card lg:flex">
          <CartPanel tables={tables} currency={currency} submitting={submitting} onPlaceOrder={handlePlaceOrder} onShowTablePicker={() => setTablePickerOpen(true)} enableHold={false} />
        </aside>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <button type="button" className="fixed bottom-5 end-5 z-40 flex min-h-14 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-white shadow-xl lg:hidden">
            <span className="relative"><span aria-hidden="true">🧾</span>{cartCount > 0 && <span className="absolute -end-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px]">{cartCount}</span>}</span>
            Table order
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[88vh]"><div className="max-h-[82vh] overflow-y-auto px-2 pb-4"><CartPanel tables={tables} currency={currency} submitting={submitting} onPlaceOrder={handlePlaceOrder} onShowTablePicker={() => setTablePickerOpen(true)} enableHold={false} variant="drawer" /></div></DrawerContent>
      </Drawer>

      {addonProduct && <AddonModal product={addonProduct} currency={currency} onAdd={handleAddons} onClose={() => setAddonProduct(null)} />}

      {tablePickerOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTablePickerOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="waiter-table-picker-title" className="w-full max-w-xl rounded-2xl bg-card p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">Dine in</p><h2 id="waiter-table-picker-title" className="mt-1 text-lg font-bold">Choose a table</h2></div><button type="button" aria-label="Close table picker" onClick={() => setTablePickerOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X size={18} /></button></div>
          <div className="mt-4 grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {tables.map((table) => {
              const active = orderForTable(table.id);
              return <button key={table.id} type="button" onClick={() => selectTable(table)} className="min-h-20 rounded-xl border border-border p-3 text-start hover:border-brand">
                <span className="block font-bold">{table.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{active ? `Open · ${active.order_number}` : `${table.status} · ${table.capacity || 4} seats`}</span>
              </button>;
            })}
          </div>
          {tables.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No active tables found.</p>}
          <button type="button" onClick={() => setTablePickerOpen(false)} className="mt-4 min-h-11 w-full rounded-xl border border-border text-sm font-semibold">Cancel</button>
        </section>
      </div>}
    </div>
  );
}
