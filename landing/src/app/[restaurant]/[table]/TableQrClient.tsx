'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { 
  ShoppingBag, Search, Plus, Minus, Check, ChefHat, 
  Sparkles, AlertCircle, UtensilsCrossed, ChevronRight, X, Clock, CheckCircle
} from 'lucide-react';

interface Addon {
  id: string;
  name: string;
  price: number;
}

interface AddonGroup {
  id: string;
  name: string;
  is_required: boolean;
  min_selection: number;
  max_selection: number;
  addons: Addon[];
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string;
  is_vegetarian: boolean;
  addon_groups?: AddonGroup[];
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  selectedAddons: Addon[];
  specialInstructions: string;
}

const CLOUD_API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || 'https://orderitup-cloud-api.narayaaana11.workers.dev';

export default function RestaurantTableQrClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 font-medium">Opening Table Menu...</p>
      </div>
    }>
      <RestaurantTableQrContent />
    </Suspense>
  );
}

function RestaurantTableQrContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  // Dynamic parameters from route: /[restaurant]/[table]
  const restaurantParam = (params?.restaurant as string) || '';
  const tableParam = (params?.table as string) || '';

  const [tableToken, setTableToken] = useState(() => searchParams.get('token') || '');
  const [tableId, setTableId] = useState<string>(() => searchParams.get('tableId') || '');
  const [qrTokenReady, setQrTokenReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState(restaurantParam ? decodeURIComponent(restaurantParam).replace(/-/g, ' ').toUpperCase() : 'Order It Up Restaurant');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [tableNumber, setTableNumber] = useState<string>(tableParam || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Customer CRM
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeModalProduct, setActiveModalProduct] = useState<Product | null>(null);
  const [modalSelectedAddons, setModalSelectedAddons] = useState<Addon[]>([]);
  const [modalInstructions, setModalInstructions] = useState('');

  const [customerName, setCustomerName] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('qr_guest_name') || ''; } catch {}
    }
    return '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('qr_guest_phone') || ''; } catch {}
    }
    return '';
  });

  // Placed Order State
  const [placedOrderId, setPlacedOrderId] = useState<string | number | null>(null);
  const [placedOrderTrackingToken, setPlacedOrderTrackingToken] = useState<string | null>(null);
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  useEffect(() => {
    // Extract token from hash (#token=...) or query parameter
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      const fragmentToken = new URLSearchParams(hash).get('token');
      if (fragmentToken) setTableToken(fragmentToken);
      const fragmentTableId = new URLSearchParams(hash).get('tableId');
      if (fragmentTableId) setTableId(fragmentTableId);
    }
    setQrTokenReady(true);
  }, []);

  useEffect(() => {
    if (!qrTokenReady) return;

    let isMounted = true;
    async function loadMenu() {
      try {
        setLoading(true);
        setError(null);

        // Fetch public QR menu from Cloud API or local fallback
        const headers: Record<string, string> = {};
        if (tableToken) {
          headers['Authorization'] = `Bearer ${tableToken}`;
        }

        const queryParams = new URLSearchParams();
        if (tableId) queryParams.set('table_id', tableId);

        const response = await fetch(`${CLOUD_API_BASE}/api/qr/menu?${queryParams.toString()}`, {
          headers,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load menu (HTTP ${response.status})`);
        }

        const data = await response.json();
        if (isMounted) {
          if (data.restaurant?.name) setRestaurantName(data.restaurant.name);
          if (data.restaurant?.currency) setCurrencyCode(data.restaurant.currency);
          if (data.table?.number) setTableNumber(String(data.table.number));
          if (data.table?.id) setTableId(String(data.table.id));

          setCategories(data.categories || []);
          setProducts(data.products || []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[QR] Failed to load table menu:', err);
          setError(err.message || 'Unable to load menu. Please ask staff for assistance.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMenu();
    return () => { isMounted = false; };
  }, [qrTokenReady, tableToken, tableId]);

  // Live order status polling
  useEffect(() => {
    if (!placedOrderId || !placedOrderTrackingToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${CLOUD_API_BASE}/api/qr/order/${placedOrderId}`, {
          headers: {
            'Authorization': `Bearer ${placedOrderTrackingToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const liveStatus = data.order?.status || data.order?.kitchen_status;
          if (liveStatus) setOrderStatus(liveStatus);
        }
      } catch (e) {
        console.warn('[QR] Status poll failed:', e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [placedOrderId, placedOrderTrackingToken]);

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesCategory = selectedCategory === 'all' || prod.category_id === selectedCategory;
      const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const addonsPrice = item.selectedAddons.reduce((aSum, a) => aSum + Number(a.price), 0);
      return sum + (item.product.price + addonsPrice) * item.quantity;
    }, 0);
  }, [cart]);

  const addToCart = (product: Product, addons: Addon[], instructions: string) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.product.id === product.id && 
                JSON.stringify(ci.selectedAddons.map(a => a.id).sort()) === JSON.stringify(addons.map(a => a.id).sort()) &&
                ci.specialInstructions === instructions
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }
      return [...prev, { product, quantity: 1, selectedAddons: addons, specialInstructions: instructions }];
    });
    setActiveModalProduct(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index].quantity = newQty;
      return next;
    });
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    try {
      setIsSubmitting(true);
      if (typeof window !== 'undefined') {
        try {
          if (customerName) localStorage.setItem('qr_guest_name', customerName);
          if (customerPhone) localStorage.setItem('qr_guest_phone', customerPhone);
        } catch {}
      }

      const payload = {
        table_id: tableId || null,
        table_number: tableNumber || tableParam || null,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        notes: 'Placed via Mobile QR',
        items: cart.map((ci) => ({
          product_id: ci.product.id,
          quantity: ci.quantity,
          addons: ci.selectedAddons.map((a) => a.id),
          special_instructions: ci.specialInstructions || undefined,
        })),
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (tableToken) headers['Authorization'] = `Bearer ${tableToken}`;

      const res = await fetch(`${CLOUD_API_BASE}/api/qr/order`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Order submission failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      setPlacedOrderId(data.order?.id);
      setPlacedOrderTrackingToken(data.order?.tracking_token || null);
      setPlacedOrderNumber(data.order?.order_number || 'Confirmed');
      setOrderStatus('pending');
      setCart([]);
      setCartOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to place order. Please check with your server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">Connecting to Table {tableNumber || tableParam}...</h2>
        <p className="text-zinc-400 text-sm mt-1">Loading {restaurantName} digital menu</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Table Session Expired or Not Found</h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-6">{error}</p>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-zinc-400 max-w-sm">
          Please scan the QR sticker placed on your dining table or request assistance from the server.
        </div>
      </div>
    );
  }

  if (placedOrderId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 animate-pulse">
          <Check className="w-10 h-10 stroke-[3]" />
        </div>
        <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400 mb-1">Order Sent to Kitchen</span>
        <h1 className="text-3xl font-extrabold text-white mb-2">Order #{placedOrderNumber}</h1>
        <p className="text-zinc-400 text-sm mb-8">Table {tableNumber} • {restaurantName}</p>

        {/* Live Status Tracker */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mb-8 text-left backdrop-blur-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Live Kitchen Status
          </h3>
          <div className="flex items-center justify-between relative mb-2">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -translate-y-1/2 z-0" />
            <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
              orderStatus === 'pending' ? 'bg-amber-500 text-black ring-4 ring-amber-500/20' : 'bg-emerald-500 text-black'
            }`}>1</div>
            <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
              orderStatus === 'preparing' ? 'bg-amber-500 text-black ring-4 ring-amber-500/20' :
              orderStatus === 'ready' || orderStatus === 'completed' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-zinc-500'
            }`}>2</div>
            <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
              orderStatus === 'ready' || orderStatus === 'completed' ? 'bg-emerald-500 text-black ring-4 ring-emerald-500/20' : 'bg-slate-800 text-zinc-500'
            }`}>3</div>
          </div>
          <div className="flex justify-between text-[11px] font-medium text-zinc-400 px-1 mt-3">
            <span>Received</span>
            <span>Preparing</span>
            <span>Serving</span>
          </div>
        </div>

        <button
          onClick={() => { setPlacedOrderId(null); setCart([]); }}
          className="w-full max-w-md py-3.5 px-4 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold rounded-xl shadow-lg transition-all"
        >
          Add More Items to Table {tableNumber}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Dine-in Menu</span>
            <h1 className="text-lg font-bold text-white leading-tight">{restaurantName}</h1>
          </div>
          <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
            Table {tableNumber || tableParam}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-4 pt-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search appetizers, mains, beverages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-zinc-400 hover:text-white'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-zinc-400 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="space-y-3">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${prod.is_vegetarian ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <h3 className="font-semibold text-white text-base truncate">{prod.name}</h3>
                </div>
                {prod.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{prod.description}</p>
                )}
                <div className="text-amber-400 font-bold text-sm">
                  {formatCurrency(prod.price)}
                </div>
              </div>

              <button
                onClick={() => {
                  if (prod.addon_groups && prod.addon_groups.length > 0) {
                    setActiveModalProduct(prod);
                    setModalSelectedAddons([]);
                    setModalInstructions('');
                  } else {
                    addToCart(prod, [], '');
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No dishes found matching your selection.
            </div>
          )}
        </div>
      </main>

      {/* Floating View Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-xl mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold p-4 rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-between transform active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-slate-950 text-amber-400 text-xs flex items-center justify-center font-extrabold">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
              <span>View Cart & Guest Info</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">{formatCurrency(cartTotal)}</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Cart & Customer CRM Checkout Modal */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 max-h-[85vh] flex flex-col max-w-xl mx-auto w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Your Table Order</h2>
                <p className="text-xs text-zinc-400">Table {tableNumber || tableParam} • {restaurantName}</p>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                  <div className="flex-1 min-w-0 pr-3">
                    <h4 className="font-semibold text-sm text-white truncate">{item.product.name}</h4>
                    <span className="text-xs text-amber-400">{formatCurrency(item.product.price)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Guest CRM Data Capture */}
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Guest Information (Optional)</span>
                <input
                  type="text"
                  placeholder="Your Name (e.g. Priya Patel)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="tel"
                  placeholder="Phone Number for Bill & Order Updates"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Total & Submit Button */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-zinc-400">Total Payable</span>
                <span className="text-xl font-black text-amber-400">{formatCurrency(cartTotal)}</span>
              </div>
              <button
                disabled={isSubmitting}
                onClick={handlePlaceOrder}
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-450 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-all"
              >
                {isSubmitting ? 'Sending Order...' : `Confirm & Place Order (${formatCurrency(cartTotal)})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
