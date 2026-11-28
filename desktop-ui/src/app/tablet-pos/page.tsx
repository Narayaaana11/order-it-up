'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, LoaderCircle, Printer, RefreshCw, Split, Store, Wifi, WifiOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AddonModal from '@/components/pos/AddonModal';
import CartPanel from '@/components/pos/CartPanel';
import ProductGrid from '@/components/pos/ProductGrid';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import api from '@/lib/api';
import { mapCloudCategory as mapCategory, mapCloudProduct as mapProduct, mapCloudTable as mapTable } from '@/lib/cloud-pos-mappers';
import { readOfflineValue, writeOfflineValue } from '@/lib/tablet-offline-db';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import type { Addon, Category, Order, Product, Table } from '@/lib/types';

type Branch = { id: string; name: string; restaurant_name?: string; status?: string };
type CloudOrder = Order & { branch_id?: string; order_type?: string; grand_total?: number; table_number?: string | null; version?: number; payment_status?: 'unpaid' | 'partially_paid' | 'paid' | 'voided' };
type CatalogResponse = { categories?: Record<string, unknown>[]; products?: Record<string, unknown>[] };
type BranchCatalogResponse = { catalog?: Record<string, unknown>[] };
type OrderAttempt = { id: string; createdAt: string; payload: Record<string, unknown> };

function messageFrom(error: unknown): string {
  const value = error as { response?: { data?: { error?: string } }; message?: string };
  return value?.response?.data?.error || value?.message || 'The request could not be completed.';
}

type PaymentCapabilities = { cash: boolean; card: boolean; upi: boolean; provider: string | null; configured: boolean; reason: string | null };
type RazorpayInstance = { open: () => void };

function loadRazorpayCheckout(): Promise<void> {
  const scope = window as unknown as { Razorpay?: unknown };
  if (scope.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('The payment provider checkout could not be loaded. No payment was recorded.'));
    document.body.appendChild(script);
  });
}

export default function TabletPosPage() {
  const { currentTenant, user } = useAuthStore();
  const cart = useCartStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [outbox, setOutbox] = useState<OrderAttempt[]>([]);
  const [openOrders, setOpenOrders] = useState<CloudOrder[]>([]);
  const [capabilities, setCapabilities] = useState<PaymentCapabilities | null>(null);
  const [splitOrder, setSplitOrder] = useState<CloudOrder | null>(null);
  const [splitCash, setSplitCash] = useState('0');
  const [splitCard, setSplitCard] = useState('0');
  const [receiptOrder, setReceiptOrder] = useState<CloudOrder | null>(null);
  const lastAutoSyncKey = useRef('');

  const namespace = useMemo(() => {
    const orgId = String(currentTenant?.id || 'unknown');
    const userId = String(user?.id || 'unknown');
    return `oiu.tablet.v1:${orgId}:${userId}`;
  }, [currentTenant?.id, user?.id]);
  const queueKey = `${namespace}:outbox`;
  const cartStorageKey = `${namespace}:${branchId}:cart`;
  const currentBranch = branches.find((branch) => branch.id === branchId);

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

  const saveOutbox = useCallback((items: OrderAttempt[]) => {
    setOutbox(items);
    void writeOfflineValue(queueKey, items).then((ok) => {
      if (!ok) {
        setError('This device cannot safely save pending orders. Keep the app open and reconnect before leaving.');
      }
    });
  }, [queueKey]);

  const refreshOpenOrders = useCallback(async (forBranchId: string) => {
    const response = await api.get(`/orders?branch_id=${encodeURIComponent(forBranchId)}&status=active&limit=30`);
    const rows = Array.isArray(response.data?.orders) ? response.data.orders : [];
    setOpenOrders(rows as CloudOrder[]);
  }, []);

  const loadBranchData = useCallback(async (forBranchId: string) => {
    setLoading(true);
    setError('');
    try {
      const [masterResult, branchResult, tableResult] = await Promise.all([
        api.get('/catalog/master'),
        api.get(`/catalog/branch/${encodeURIComponent(forBranchId)}`),
        api.get(`/tables?branch_id=${encodeURIComponent(forBranchId)}`),
      ]);
      const master = masterResult.data as CatalogResponse;
      const branchCatalog = branchResult.data as BranchCatalogResponse;
      const effectiveById = new Map((branchCatalog.catalog || []).map((item) => [String(item.id), item]));
      const mappedProducts = (master.products || []).map((item) => mapProduct(item, effectiveById.get(String(item.id))))
        .filter((item) => item.is_active);
      setCategories((master.categories || []).map(mapCategory).filter((item) => item.is_active));
      setProducts(mappedProducts);
      const tableRows: Record<string, unknown>[] = Array.isArray(tableResult.data?.tables) ? tableResult.data.tables as Record<string, unknown>[] : [];
      setTables(tableRows.map(mapTable).filter((item) => item.is_active));
      void writeOfflineValue(`${namespace}:${forBranchId}:catalog`, {
        categories: master.categories,
        products: master.products,
        branchCatalog: branchCatalog.catalog,
        savedAt: new Date().toISOString(),
      });
      await refreshOpenOrders(forBranchId);
      try {
        const capabilityResponse = await api.get('/payments/capabilities');
        setCapabilities(capabilityResponse.data as PaymentCapabilities);
      } catch {
        // Capability discovery is optional; cash stays available when it fails.
        setCapabilities(null);
      }
    } catch (loadError) {
      const parsed = await readOfflineValue<{
        categories?: Record<string, unknown>[];
        products?: Record<string, unknown>[];
        branchCatalog?: Record<string, unknown>[];
        savedAt?: string;
      }>(`${namespace}:${forBranchId}:catalog`);
      if (parsed) {
        try {
          const effectiveById = new Map((parsed.branchCatalog || []).map((item) => [String(item.id), item]));
          setCategories((parsed.categories || []).map(mapCategory).filter((item) => item.is_active));
          setProducts((parsed.products || []).map((item) => mapProduct(item, effectiveById.get(String(item.id)))).filter((item) => item.is_active));
          setError(`Showing the last saved menu (${parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : 'date unavailable'}). Reconnect before sending orders.`);
        } catch { setError(messageFrom(loadError)); }
      } else {
        setError(messageFrom(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [namespace, refreshOpenOrders]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/branches')
      .then((response) => {
        if (cancelled) return;
      const rows: Branch[] = Array.isArray(response.data?.branches) ? response.data.branches as Branch[] : [];
        const available = rows.filter((item: Branch) => item.status === undefined || item.status === 'active');
        setBranches(available);
        const preferred = available[0]?.id || '';
        setBranchId((current) => current && available.some((item: Branch) => item.id === current) ? current : preferred);
      })
      .catch((loadError) => { if (!cancelled) setError(messageFrom(loadError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!branchId) return;
    void readOfflineValue<OrderAttempt[]>(queueKey).then((storedQueue) => {
      if (Array.isArray(storedQueue)) setOutbox(storedQueue);
    });
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
  // Cart is intentionally hydrated once per branch after auth has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, cartStorageKey, loadBranchData, queueKey]);

  useEffect(() => {
    if (!branchId) return;
    const unsubscribe = useCartStore.subscribe((state) => {
      const snapshot = { items: state.items, tableId: state.tableId, guestCount: state.guestCount, orderNotes: state.orderNotes };
      try { localStorage.setItem(cartStorageKey, JSON.stringify(snapshot)); } catch { /* Show the persistence limit when submitting. */ }
    });
    return unsubscribe;
  }, [branchId, cartStorageKey]);

  const sendAttempt = useCallback(async (attempt: OrderAttempt) => {
    try {
      const response = await api.post('/orders', attempt.payload);
      const order = response.data?.order as CloudOrder | undefined;
      if (!order?.id) throw new Error('The server did not confirm the order. It remains queued for a safe retry.');
      setOutbox((current) => {
        const next = current.filter((item) => item.id !== attempt.id);
        void writeOfflineValue(queueKey, next);
        return next;
      });
      setOpenOrders((current) => [order, ...current.filter((item) => String(item.id) !== String(order.id))]);
      setError('');
      toast.success(`Order ${order.order_number || ''} sent to the kitchen.`);
      return true;
    } catch (sendError) {
      setError(messageFrom(sendError));
      return false;
    }
  }, [queueKey]);

  useEffect(() => {
    if (!online) {
      lastAutoSyncKey.current = '';
      return;
    }
    if (outbox.length === 0 || submitting) return;
    const attemptKey = outbox.map((attempt) => attempt.id).join(':');
    if (lastAutoSyncKey.current === attemptKey) return;
    lastAutoSyncKey.current = attemptKey;
    const attempt = outbox[0];
    const timer = window.setTimeout(() => { setSubmitting(true); void sendAttempt(attempt).finally(() => setSubmitting(false)); }, 300);
    return () => window.clearTimeout(timer);
  }, [online, outbox, sendAttempt, submitting]);

  const handlePlaceOrder = async () => {
    if (!branchId || cart.items.length === 0) return;
    if (cart.orderType === 'dine_in' && !cart.tableId) {
      setTablePickerOpen(true);
      return;
    }
    if (!online && cart.orderType === 'dine_in') {
      setError('Dine-in orders need a live table check. Switch to takeaway to queue this order while offline.');
      return;
    }
    const id = crypto.randomUUID();
    const payload = {
      id,
      branch_id: branchId,
      order_type: cart.orderType,
      table_id: cart.tableId || undefined,
      table_number: tables.find((table) => table.id === cart.tableId)?.name,
      customer_name: cart.customer?.name,
      customer_phone: cart.customer?.phone,
      notes: cart.orderNotes || undefined,
      items: cart.items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        modifiers: item.addons.map((addon) => ({ id: addon.id, quantity: addon.quantity || 1 })),
        special_instructions: item.special_instructions || undefined,
      })),
    };
    const attempt: OrderAttempt = { id, createdAt: new Date().toISOString(), payload };
    const next = [...outbox, attempt];
    saveOutbox(next);
    cart.clearCart();
    setDrawerOpen(false);
    if (!online) {
      toast('Order saved on this tablet and will send when the connection returns.', { icon: '☁️' });
      return;
    }
    setSubmitting(true);
    await sendAttempt(attempt);
    setSubmitting(false);
  };

  const retryOutbox = async () => {
    if (!online || outbox.length === 0 || submitting) return;
    lastAutoSyncKey.current = '';
    setSubmitting(true);
    for (const attempt of [...outbox]) {
      if (!await sendAttempt(attempt)) break;
    }
    setSubmitting(false);
  };

  const collectCash = async (order: CloudOrder) => {
    setSubmitting(true);
    try {
      const summary = await api.get(`/orders/${encodeURIComponent(String(order.id))}/payments`);
      const balance = Number(summary.data?.outstanding_balance);
      if (!Number.isFinite(balance) || balance <= 0) {
        await refreshOpenOrders(branchId);
        return;
      }
      if (!window.confirm(`Record ${currency} ${balance.toFixed(2)} cash for order ${order.order_number}?`)) return;
      const keyName = `${namespace}:payment:${order.id}`;
      let idempotencyKey = localStorage.getItem(keyName);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        localStorage.setItem(keyName, idempotencyKey);
      }
      const response = await api.post(`/orders/${encodeURIComponent(String(order.id))}/payments`, {
        amount: balance,
        payment_method: 'cash',
        idempotency_key: idempotencyKey,
      });
      if (Number(response.data?.outstanding_balance) <= 0.05) {
        await api.patch(`/orders/${encodeURIComponent(String(order.id))}/status`, {
          status: 'completed',
          expected_version: response.data?.order_version,
        });
      }
      localStorage.removeItem(keyName);
      await refreshOpenOrders(branchId);
      toast.success(`Cash payment recorded for ${order.order_number}.`);
      setError('');
    } catch (paymentError) {
      await refreshOpenOrders(branchId).catch(() => undefined);
      setError(messageFrom(paymentError));
    } finally {
      setSubmitting(false);
    }
  };

  const finalizePaidOrder = async (order: CloudOrder) => {
    setSubmitting(true);
    try {
      await api.patch(`/orders/${encodeURIComponent(String(order.id))}/status`, {
        status: 'completed',
        ...(typeof order.version === 'number' ? { expected_version: order.version } : {}),
      });
      localStorage.removeItem(`${namespace}:payment:${order.id}`);
      await refreshOpenOrders(branchId);
      toast.success(`Order ${order.order_number} closed.`);
      setError('');
    } catch (finalizeError) {
      setError(messageFrom(finalizeError));
    } finally {
      setSubmitting(false);
    }
  };

  const collectProvider = async (order: CloudOrder) => {
    setSubmitting(true);
    setError('');
    try {
      if (!capabilities?.configured) {
        throw new Error(capabilities?.reason || 'The payment provider is not configured for this environment.');
      }
      const summary = await api.get(`/orders/${encodeURIComponent(String(order.id))}/payments`);
      const balance = Number(summary.data?.outstanding_balance);
      if (!Number.isFinite(balance) || balance <= 0) {
        await refreshOpenOrders(branchId);
        return;
      }

      const keyName = `${namespace}:intent:${order.id}`;
      let idempotencyKey = localStorage.getItem(keyName);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        localStorage.setItem(keyName, idempotencyKey);
      }
      const created = await api.post(`/orders/${encodeURIComponent(String(order.id))}/payment-intent`, {
        amount: balance,
        idempotency_key: idempotencyKey,
      });
      const intent = created.data?.intent as { id: string; provider_order_id: string; amount: number; currency: string } | undefined;
      const keyId = created.data?.provider?.key_id as string | undefined;
      if (!intent?.id || !keyId) throw new Error('The payment provider did not create an intent. No payment was recorded.');

      await loadRazorpayCheckout();
      const scope = window as unknown as { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance };
      if (!scope.Razorpay) throw new Error('The payment provider checkout is unavailable. No payment was recorded.');

      const checkout = new scope.Razorpay({
        key: keyId,
        amount: Math.round(intent.amount * 100),
        currency: intent.currency,
        name: 'Order It Up',
        description: `Bill ${order.order_number}`,
        order_id: intent.provider_order_id,
        handler: (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          void (async () => {
            try {
              await api.post('/payments/verify', {
                intent_id: intent.id,
                provider_payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              localStorage.removeItem(keyName);
              toast.success(`Card/UPI payment verified for ${order.order_number}.`);
              await refreshOpenOrders(branchId);
              setError('');
            } catch (verifyError) {
              setError(messageFrom(verifyError));
            } finally {
              setSubmitting(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            toast('Provider checkout dismissed. No non-cash payment was recorded.', { icon: 'ℹ️' });
            setSubmitting(false);
          },
        },
      });
      checkout.open();
    } catch (providerError) {
      setError(messageFrom(providerError));
      setSubmitting(false);
    }
  };

  const openSplitTender = (order: CloudOrder) => {
    const total = Number(order.grand_total ?? order.total ?? 0);
    const half = (total / 2).toFixed(2);
    setSplitOrder(order);
    setSplitCash(half);
    setSplitCard((total - Number(half)).toFixed(2));
  };

  const executeSplitTender = async () => {
    if (!splitOrder) return;
    const cashAmt = Number(splitCash);
    const cardAmt = Number(splitCard);
    if (!Number.isFinite(cashAmt) || !Number.isFinite(cardAmt) || cashAmt < 0 || cardAmt < 0) {
      setError('Tender amounts cannot be negative.');
      return;
    }
    if (cardAmt > 0 && !capabilities?.configured) {
      setError(capabilities?.reason || 'Card/UPI provider is not configured for split tender.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const summary = await api.get(`/orders/${encodeURIComponent(String(splitOrder.id))}/payments`);
      const balance = Number(summary.data?.outstanding_balance);
      if (!Number.isFinite(balance) || Math.abs(cashAmt + cardAmt - balance) > 0.05) {
        throw new Error(`Split amounts must equal the outstanding balance (${currency} ${balance.toFixed(2)}).`);
      }

      if (cashAmt > 0) {
        await api.post(`/orders/${encodeURIComponent(String(splitOrder.id))}/payments`, {
          amount: cashAmt,
          payment_method: 'cash',
          idempotency_key: `${namespace}:split-cash:${splitOrder.id}:${Date.now()}`,
        });
      }

      if (cardAmt > 0) {
        const created = await api.post(`/orders/${encodeURIComponent(String(splitOrder.id))}/payment-intent`, {
          amount: cardAmt,
          idempotency_key: `${namespace}:split-intent:${splitOrder.id}:${Date.now()}`,
        });
        const intent = created.data?.intent as { id: string; provider_order_id: string; amount: number; currency: string } | undefined;
        const keyId = created.data?.provider?.key_id as string | undefined;
        if (!intent?.id || !keyId) throw new Error('The payment provider did not create an intent.');

        await loadRazorpayCheckout();
        const scope = window as unknown as { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance };
        if (!scope.Razorpay) throw new Error('The payment provider checkout is unavailable.');

        await new Promise<void>((resolve, reject) => {
          const checkout = new scope.Razorpay!({
            key: keyId,
            amount: Math.round(intent.amount * 100),
            currency: intent.currency,
            name: 'Order It Up',
            description: `Split Bill ${splitOrder.order_number}`,
            order_id: intent.provider_order_id,
            handler: (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
              void api.post('/payments/verify', {
                intent_id: intent.id,
                provider_payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }).then(() => resolve(), reject);
            },
            modal: {
              ondismiss: () => reject(new Error('Provider checkout dismissed. Cash portion (if any) was recorded; card/UPI remains unpaid.')),
            },
          });
          checkout.open();
        });
      }

      await api.patch(`/orders/${encodeURIComponent(String(splitOrder.id))}/status`, { status: 'completed' });
      toast.success(`Split payment recorded for ${splitOrder.order_number}.`);
      setSplitOrder(null);
      await refreshOpenOrders(branchId);
    } catch (splitError) {
      setError(messageFrom(splitError));
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
  const currency = currentTenant?.currency || 'INR';

  if (loading && branches.length === 0) {
    return <div className="flex min-h-[70vh] items-center justify-center gap-3 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Connecting to your restaurant…</div>;
  }

  if (!branches.length && !loading) {
    return <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-border bg-card p-8 text-center"><Store className="mx-auto h-10 w-10 text-brand" /><h1 className="mt-4 text-xl font-bold">No restaurant branch is available</h1><p className="mt-2 text-sm text-muted-foreground">Ask an owner or manager to assign this account to an active branch.</p>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="tablet-pos">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border bg-card px-3 py-2 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Store size={19} /></div><div className="min-w-0"><p className="truncate text-sm font-bold">{currentBranch?.name || 'Order It Up POS'}</p><p className="truncate text-[11px] text-muted-foreground">{currentTenant?.business_name || currentTenant?.name || 'Restaurant'}</p></div></div>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs font-medium"><span className="sr-only">Branch</span><Store size={14} /><select aria-label="Branch" className="max-w-40 bg-transparent outline-none" value={branchId} onChange={(event) => { cart.clearCart(); setBranchId(event.target.value); }}><option value="">Choose branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <div className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`} aria-live="polite">{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Online' : 'Offline'}</div>
      </header>
      {error && <div role="status" className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"><span className="min-w-0">{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss message"><X size={16} /></button></div>}
      {outbox.length > 0 && <div className="flex items-center justify-between gap-3 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950"><span>{outbox.length} order{outbox.length === 1 ? '' : 's'} waiting to sync. These are stored on this tablet and have not reached the kitchen yet.</span><button type="button" disabled={!online || submitting} onClick={() => void retryOutbox()} className="flex min-h-9 shrink-0 items-center gap-2 rounded-lg bg-sky-800 px-3 text-xs font-bold text-white disabled:opacity-50"><RefreshCw size={14} className={submitting ? 'animate-spin' : ''} />{submitting ? 'Sending…' : 'Sync now'}</button></div>}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-12 items-center gap-2 border-b border-border bg-card px-3">
            <button type="button" onClick={() => { cart.setOrderType('dine_in'); setTablePickerOpen(true); }} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${cart.orderType === 'dine_in' ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-muted'}`}>Dine in{cart.tableId ? ` · ${tables.find((item) => item.id === cart.tableId)?.name || cart.tableId}` : ''}</button>
            <button type="button" onClick={() => { cart.setOrderType('takeaway'); cart.setTableId(null); }} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${cart.orderType === 'takeaway' ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-muted'}`}>Takeaway</button>
            <span className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Cloud size={14} />Prices and tax confirmed by Cloud</span>
          </div>
          {loading ? <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Loading branch menu…</div> : products.length ? <ProductGrid categories={categories} products={products} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} search={search} setSearch={setSearch} currency={currency} onProductClick={handleProductClick} /> : <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"><Store className="h-10 w-10 text-muted-foreground" /><p className="font-semibold">No active menu items at this branch</p><button type="button" onClick={() => branchId && void loadBranchData(branchId)} className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold"><RefreshCw size={14} className="me-2 inline" />Refresh menu</button></div>}
        </div>
        <aside className="hidden h-full w-[min(38vw,390px)] shrink-0 border-s border-border bg-card lg:flex"><CartPanel tables={tables} currency={currency} submitting={submitting} onPlaceOrder={handlePlaceOrder} onShowTablePicker={() => setTablePickerOpen(true)} enableHold={false} /></aside>
      </div>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild><button type="button" className="fixed bottom-5 end-5 z-40 flex min-h-14 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-white shadow-xl lg:hidden"><span className="relative"><span aria-hidden="true">🛒</span>{cartCount > 0 && <span className="absolute -end-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px]">{cartCount}</span>}</span>Cart</button></DrawerTrigger>
        <DrawerContent className="max-h-[88vh]"><div className="max-h-[82vh] overflow-y-auto px-2 pb-4"><CartPanel tables={tables} currency={currency} submitting={submitting} onPlaceOrder={handlePlaceOrder} onShowTablePicker={() => setTablePickerOpen(true)} enableHold={false} variant="drawer" /></div></DrawerContent>
      </Drawer>
      {addonProduct && <AddonModal product={addonProduct} currency={currency} onAdd={handleAddons} onClose={() => setAddonProduct(null)} />}
      {tablePickerOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTablePickerOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="tablet-table-picker-title" className="w-full max-w-xl rounded-2xl bg-card p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">Dine in</p><h2 id="tablet-table-picker-title" className="mt-1 text-lg font-bold">Choose an available table</h2></div><button type="button" aria-label="Close table picker" onClick={() => setTablePickerOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X size={18} /></button></div><div className="mt-4 grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">{tables.map((table) => <button key={table.id} type="button" disabled={table.status !== 'available'} onClick={() => { cart.setTableId(table.id); cart.setOrderType('dine_in'); setTablePickerOpen(false); }} className={`min-h-20 rounded-xl border p-3 text-start ${table.status === 'available' ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400' : 'cursor-not-allowed border-border bg-muted/50 opacity-60'}`}><span className="block font-bold">{table.name}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{table.status} · {table.capacity} seats</span></button>)}</div>{tables.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No active tables found.</p>}<button type="button" onClick={() => setTablePickerOpen(false)} className="mt-4 min-h-11 w-full rounded-xl border border-border text-sm font-semibold">Cancel</button></section></div>}
      {openOrders.length > 0 && <div className="fixed bottom-4 start-4 z-30 hidden max-h-[40vh] w-80 overflow-auto rounded-xl border border-border bg-card p-3 shadow-lg xl:block">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Open Cloud orders</p>
        {capabilities && !capabilities.configured && <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950">Card/UPI unavailable: {capabilities.reason}</p>}
        {openOrders.slice(0, 6).map((order) => (
          <div key={String(order.id)} className="border-t border-border py-2">
            <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{order.order_number} · {order.payment_status}</span><span className="shrink-0 font-semibold">{currency} {Number(order.grand_total ?? order.total ?? 0).toFixed(2)}</span></div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {order.payment_status === 'paid'
                ? <button type="button" disabled={submitting || !online} onClick={() => void finalizePaidOrder(order)} className="min-h-8 rounded-md border border-border px-2.5 text-xs font-bold disabled:opacity-50">Close paid order</button>
                : <>
                    <button type="button" disabled={submitting || !online} onClick={() => void collectCash(order)} className="min-h-8 rounded-md bg-brand px-2.5 text-xs font-bold text-white disabled:opacity-50">Record cash payment</button>
                    {capabilities?.configured && <button type="button" disabled={submitting || !online} onClick={() => void collectProvider(order)} className="min-h-8 rounded-md bg-slate-900 px-2.5 text-xs font-bold text-white disabled:opacity-50">Card / UPI</button>}
                    <button type="button" disabled={submitting || !online} onClick={() => openSplitTender(order)} className="min-h-8 rounded-md border border-border px-2 text-xs font-bold disabled:opacity-50"><Split size={12} className="inline me-1" />Split</button>
                  </>}
              <button type="button" onClick={() => setReceiptOrder(order)} className="min-h-8 rounded-md border border-border px-2 text-xs font-semibold" title="Print / Preview Receipt"><Printer size={12} className="inline" /></button>
            </div>
          </div>
        ))}
      </div>}
      {splitOrder && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Split Tender · {splitOrder.order_number}</h2>
              <button type="button" onClick={() => setSplitOrder(null)} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total: {currency} {Number(splitOrder.grand_total ?? splitOrder.total ?? 0).toFixed(2)}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold">Cash ({currency})<input type="number" min={0} step="0.01" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="block text-xs font-semibold">Card / UPI ({currency})<input type="number" min={0} step="0.01" value={splitCard} onChange={(e) => setSplitCard(e.target.value)} disabled={!capabilities?.configured} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50" /></label>
              {!capabilities?.configured && <p className="text-[11px] text-amber-800">Card/UPI requires configured provider credentials.</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setSplitOrder(null)} className="min-h-10 flex-1 rounded-xl border border-border text-xs font-semibold">Cancel</button>
              <button type="button" disabled={submitting} onClick={() => void executeSplitTender()} className="min-h-10 flex-1 rounded-xl bg-brand text-xs font-bold text-white disabled:opacity-50">Settle</button>
            </div>
          </section>
        </div>
      )}
      {receiptOrder && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-4 print:bg-white print:p-0">
          <section role="dialog" aria-modal="true" className="w-full max-w-xs rounded-2xl bg-white p-5 font-mono text-xs text-slate-900 shadow-2xl print:shadow-none">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <p className="text-sm font-bold">{currentBranch?.name || 'Order It Up'}</p>
              <p className="text-[11px] text-slate-500">Order {receiptOrder.order_number} · {receiptOrder.order_type}</p>
            </div>
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1">
              <div className="flex justify-between font-bold"><span>Total</span><span>{currency} {Number(receiptOrder.grand_total ?? receiptOrder.total ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-[11px] text-slate-600"><span>Status</span><span className="uppercase">{receiptOrder.payment_status}</span></div>
            </div>
            <div className="mt-4 flex gap-2 print:hidden">
              <button type="button" onClick={() => setReceiptOrder(null)} className="min-h-9 flex-1 rounded-lg border border-slate-200 font-sans font-semibold">Close</button>
              <button type="button" onClick={() => window.print()} className="min-h-9 flex-1 rounded-lg bg-slate-900 font-sans font-bold text-white"><Printer size={13} className="inline me-1" />Print</button>
            </div>
          </section>
        </div>
      )}
      {outbox.length === 0 && <div className="sr-only" role="status">{online ? 'Cloud is connected' : 'Cloud is offline'}</div>}
    </div>
  );
}
