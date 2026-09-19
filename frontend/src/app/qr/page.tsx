'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { 
  ShoppingBag, Search, Plus, Minus, Check, ChefHat, 
  Sparkles, AlertCircle, UtensilsCrossed, ChevronRight, X
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

function QROrderContent() {
  const searchParams = useSearchParams();
  const queryTableId = searchParams.get('tableId') || searchParams.get('table') || '';
  const [tableId] = useState(() => {
    if (queryTableId) return queryTableId;
    if (typeof window !== 'undefined') {
      return window.location.pathname.split('/qr/')[1]?.replace(/\/$/, '') || '';
    }
    return '';
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState('Order It Up Restaurant');
  const [, setCurrency] = useState('INR');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeModalProduct, setActiveModalProduct] = useState<Product | null>(null);
  const [modalSelectedAddons, setModalSelectedAddons] = useState<Addon[]>([]);
  const [modalInstructions, setModalInstructions] = useState('');

  // Placed Order State
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Menu on mount
  useEffect(() => {
    async function fetchMenu() {
      try {
        setLoading(true);
        const url = tableId 
          ? `/api/qr/menu?table_id=${encodeURIComponent(tableId)}`
          : '/api/qr/menu';
        const { data } = await axios.get(url);
        if (data.ok) {
          setRestaurantName(data.restaurant?.name || 'Order It Up Restaurant');
          setCurrency(data.restaurant?.currency || 'INR');
          if (data.table) {
            setTableNumber(String(data.table.number));
          }
          setCategories(data.categories || []);
          setProducts(data.products || []);
        } else {
          setError('Could not load menu.');
        }
      } catch (err: unknown) {
        const errorMsg = axios.isAxiosError(err)
          ? err.response?.data?.error || err.message
          : 'Failed to connect to restaurant server.';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [tableId]);

  // Poll order status if order was placed
  useEffect(() => {
    if (!placedOrderId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/qr/order/${placedOrderId}`);
        if (data.ok && data.order) {
          setOrderStatus(data.order.status);
        }
      } catch {
        // Quiet poll error
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [placedOrderId]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
      const matchesSearch = !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations
  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const addonsPrice = item.selectedAddons.reduce((aSum, a) => aSum + a.price, 0);
      return sum + ((item.product.price + addonsPrice) * item.quantity);
    }, 0);
  }, [cart]);

  const handleOpenAddModal = (product: Product) => {
    if (!product.addon_groups || product.addon_groups.length === 0) {
      // Direct add to cart
      addToCart(product, [], '');
    } else {
      setActiveModalProduct(product);
      setModalSelectedAddons([]);
      setModalInstructions('');
    }
  };

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
      const payload = {
        table_id: tableId || null,
        notes: 'Placed via Mobile QR',
        items: cart.map((ci) => ({
          product_id: ci.product.id,
          quantity: ci.quantity,
          addons: ci.selectedAddons.map((a) => a.id),
          special_instructions: ci.specialInstructions,
        })),
      };

      const { data } = await axios.post('/api/qr/order', payload);
      if (data.ok && data.order) {
        setPlacedOrderId(data.order.id);
        setPlacedOrderNumber(data.order.order_number);
        setOrderStatus(data.order.status);
        setCart([]);
        setCartOpen(false);
      } else {
        alert('Could not submit order. Please speak to staff.');
      }
    } catch (err: unknown) {
      const errorMsg = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to submit order.';
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Opening Table Menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Notice</h1>
        <p className="text-slate-400 text-sm max-w-sm mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Success / Tracking View if Order Placed ──────────────────────────────
  if (placedOrderId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <Check className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black mb-1">Order Received!</h2>
          <p className="text-slate-400 text-xs mb-6">
            Table #{tableNumber || tableId} • Order #{placedOrderNumber}
          </p>

          {/* Stepper */}
          <div className="space-y-4 text-left mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                ✓
              </div>
              <div>
                <p className="font-semibold text-sm">Order Sent to Kitchen</p>
                <p className="text-xs text-slate-400">Your order has been routed to the kitchen line</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                orderStatus === 'preparing' || orderStatus === 'completed' 
                  ? 'bg-amber-500 text-slate-950 animate-pulse' 
                  : 'bg-slate-800 text-slate-500'
              }`}>
                <ChefHat className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">Preparation</p>
                <p className="text-xs text-slate-400">
                  {orderStatus === 'preparing' ? 'Chefs are currently cooking your meal' : 'Waiting in kitchen queue'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                orderStatus === 'completed' 
                  ? 'bg-emerald-500 text-slate-950' 
                  : 'bg-slate-800 text-slate-500'
              }`}>
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">Ready & Served</p>
                <p className="text-xs text-slate-400">Server will bring dishes directly to your table</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setPlacedOrderId(null);
            }}
            className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition"
          >
            Order More Items
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h1 className="font-black text-lg tracking-tight">{restaurantName}</h1>
            </div>
            <p className="text-xs text-amber-400 font-medium">
              {tableNumber ? `Table #${tableNumber}` : 'Digital Self-Ordering'}
            </p>
          </div>

          {/* Cart trigger button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-200 hover:text-amber-400 transition"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, desserts..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>
      </header>

      {/* Category Pills */}
      <div className="sticky top-[109px] z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/50 py-2 px-4 overflow-x-auto no-scrollbar">
        <div className="max-w-xl mx-auto flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <main className="max-w-xl mx-auto p-4 space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No items found matching your selection.</p>
          </div>
        ) : (
          filteredProducts.map((prod) => (
            <div 
              key={prod.id}
              className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex gap-3.5 items-center justify-between hover:border-slate-700 transition"
            >
              <div className="flex-1 pr-2">
                <h3 className="font-bold text-sm text-slate-100">{prod.name}</h3>
                {prod.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {prod.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-black text-amber-400 text-sm">
                    ₹{prod.price.toFixed(2)}
                  </span>
                  {prod.addon_groups && prod.addon_groups.length > 0 && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-medium">
                      Customizable
                    </span>
                  )}
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={() => handleOpenAddModal(prod)}
                className="shrink-0 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs hover:bg-amber-500 hover:text-slate-950 active:scale-95 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                ADD
              </button>
            </div>
          ))
        )}
      </main>

      {/* Floating Bottom Bar if Cart Has Items */}
      {cartItemCount > 0 && !cartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-xl mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black py-3.5 px-5 rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-between active:scale-[0.98] transition"
          >
            <div className="flex items-center gap-2">
              <span className="bg-slate-950 text-amber-400 text-xs px-2.5 py-1 rounded-full font-bold">
                {cartItemCount}
              </span>
              <span className="text-sm">View Cart</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span>₹{cartTotal.toFixed(2)}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Addon / Customization Modal */}
      {activeModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-lg">{activeModalProduct.name}</h2>
                <p className="text-xs text-amber-400 font-bold">₹{activeModalProduct.price.toFixed(2)}</p>
              </div>
              <button 
                onClick={() => setActiveModalProduct(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Groups */}
            {activeModalProduct.addon_groups?.map((group) => (
              <div key={group.id} className="mb-5 pb-4 border-b border-slate-800">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  {group.name} {group.is_required && <span className="text-amber-400 font-normal normal-case">(Required)</span>}
                </p>
                <div className="space-y-2">
                  {group.addons.map((addon) => {
                    const isSelected = modalSelectedAddons.some((a) => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setModalSelectedAddons(modalSelectedAddons.filter((a) => a.id !== addon.id));
                          } else {
                            if (group.max_selection === 1) {
                              // Replace any existing from same group
                              const withoutGroup = modalSelectedAddons.filter(
                                (a) => !group.addons.some((ga) => ga.id === a.id)
                              );
                              setModalSelectedAddons([...withoutGroup, addon]);
                            } else {
                              setModalSelectedAddons([...modalSelectedAddons, addon]);
                            }
                          }
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>{addon.name}</span>
                        <span>+₹{addon.price.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Cooking note */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                Special Instructions
              </label>
              <input
                type="text"
                value={modalInstructions}
                onChange={(e) => setModalInstructions(e.target.value)}
                placeholder="e.g. Less spicy, no onions"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => addToCart(activeModalProduct, modalSelectedAddons, modalInstructions)}
              className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
            >
              Add to Order
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                <div>
                  <h2 className="font-bold text-lg">Your Order</h2>
                  <p className="text-xs text-slate-400">Table #{tableNumber || tableId}</p>
                </div>
                <button onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {cart.map((item, idx) => {
                  const addonsSum = item.selectedAddons.reduce((s, a) => s + a.price, 0);
                  const lineTotal = (item.product.price + addonsSum) * item.quantity;
                  return (
                    <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm">{item.product.name}</p>
                          {item.selectedAddons.length > 0 && (
                            <p className="text-xs text-amber-400/80 mt-0.5">
                              + {item.selectedAddons.map(a => a.name).join(', ')}
                            </p>
                          )}
                          {item.specialInstructions && (
                            <p className="text-xs text-slate-500 italic mt-0.5">&quot;{item.specialInstructions}&quot;</p>
                          )}
                          <p className="text-xs font-bold text-slate-300 mt-1">₹{lineTotal.toFixed(2)}</p>
                        </div>

                        {/* Qty Buttons */}
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1">
                          <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:text-amber-400">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(idx, 1)} className="p-1 hover:text-amber-400">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Confirmation CTA */}
            <div className="pt-4 border-t border-slate-800 mt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-400 text-sm">Total Amount</span>
                <span className="text-xl font-black text-amber-400">₹{cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ChefHat className="w-5 h-5" />
                    Place Order & Send to Kitchen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QROrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Opening Menu...</p>
      </div>
    }>
      <QROrderContent />
    </Suspense>
  );
}
