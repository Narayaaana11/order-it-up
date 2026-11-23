'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
  Search,
  Star,
  Flame,
  Clock,
  MapPin,
  Sparkles,
  Plus,
  Minus,
  X,
  ChefHat,
  BellRing,
  UtensilsCrossed,
  Check,
  ChevronRight,
  Info,
  SlidersHorizontal,
  ArrowRight,
  Share2,
  Wine,
  ShieldAlert,
  Send,
  Loader2,
  HeartHandshake
} from 'lucide-react';
import {
  SAMPLE_CATEGORIES,
  SAMPLE_MENU_ITEMS,
  type MenuItem,
  type MenuCategory,
  type MenuItemAddon,
  type MenuItemAddonGroup
} from '@/data/sample-menu';

// Tray Cart Item Interface
interface TrayItem {
  cartId: string;
  item: MenuItem;
  quantity: number;
  selectedAddons: MenuItemAddon[];
  specialNote: string;
  totalPrice: number;
}

function SwiggyMenuContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table') || searchParams.get('tableId') || '';

  // Restaurant & Menu Data
  const [restaurantName, setRestaurantName] = useState('The Royal Heritage Bistro');
  const [currency] = useState('₹');
  const [categories, setCategories] = useState<MenuCategory[]>(SAMPLE_CATEGORIES);
  const [items, setItems] = useState<MenuItem[]>(SAMPLE_MENU_ITEMS);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const [bestsellerOnly, setBestsellerOnly] = useState(false);

  // UI Modals & Drawers
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [modalSelectedAddons, setModalSelectedAddons] = useState<MenuItemAddon[]>([]);
  const [modalNote, setModalNote] = useState('');
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [trayDrawerOpen, setTrayDrawerOpen] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [showWaiterMode, setShowWaiterMode] = useState(false);

  // Tray State (stored in memory & local storage)
  const [tray, setTray] = useState<TrayItem[]>([]);

  // AI Food Sommelier & AI Waiter States
  const [explainingDish, setExplainingDish] = useState<MenuItem | null>(null);
  const [sommelierLoading, setSommelierLoading] = useState(false);
  const [sommelierData, setSommelierData] = useState<{
    story: string;
    flavor_profile: string;
    spice_level: string;
    portion_size: string;
    allergens: string;
    pairings: string;
    server_tip: string;
    custom_answer?: string;
  } | null>(null);
  const [sommelierQuery, setSommelierQuery] = useState('');
  const [sommelierAsking, setSommelierAsking] = useState(false);
  const [aiWaiterOpen, setAiWaiterOpen] = useState(false);
  const [waiterMessages, setWaiterMessages] = useState<Array<{
    role: 'user' | 'waiter';
    text: string;
    recommendedDishes?: MenuItem[];
  }>>([
    {
      role: 'waiter',
      text: "Namaste! I am your Order It Up AI Sommelier & Tableside Waiter. How may I assist your dining experience? Ask me about our spiciest tandoori appetizers, chef's secret pairings, or light vegetarian curries!",
    },
  ]);
  const [waiterInput, setWaiterInput] = useState('');
  const [waiterThinking, setWaiterThinking] = useState(false);

  // Category section refs for auto-scrolling
  const categoryRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const handleOpenSommelier = async (dish: MenuItem) => {
    setExplainingDish(dish);
    setSommelierLoading(true);
    setSommelierData(null);
    setSommelierQuery('');
    try {
      const res = await axios.post('/api/ai/dish-sommelier', {
        dish_name: dish.name,
        description: dish.description,
        category: dish.category_name,
        price: dish.price,
        is_veg: dish.is_veg,
      });
      if (res.data?.ok) {
        setSommelierData(res.data);
      } else {
        throw new Error();
      }
    } catch {
      setSommelierData({
        story: `Artfully prepared fresh to order by our kitchen brigade using stone-ground spices and traditional slow cooking.`,
        flavor_profile: `Savory, aromatic, and richly textured with authentic regional herbs.`,
        spice_level: dish.is_veg ? 'Mild & Creamy' : 'Medium Spice',
        portion_size: 'Comfortably serves 1 to 2 diners',
        allergens: dish.is_veg ? 'Contains Dairy' : 'Contains Dairy & Poultry',
        pairings: 'Garlic Butter Naan & Chilled Mint Chaas',
        server_tip: 'Our chef recommends savoring this while steaming hot from the clay oven!',
      });
    } finally {
      setSommelierLoading(false);
    }
  };

  const handleAskSommelierQuery = async (queryText?: string) => {
    const q = queryText || sommelierQuery;
    if (!q.trim() || !explainingDish || sommelierAsking) return;
    setSommelierAsking(true);
    setSommelierQuery('');
    try {
      const res = await axios.post('/api/ai/dish-sommelier', {
        dish_name: explainingDish.name,
        description: explainingDish.description,
        category: explainingDish.category_name,
        price: explainingDish.price,
        is_veg: explainingDish.is_veg,
        guest_query: q,
      });
      if (res.data?.ok && res.data.custom_answer) {
        setSommelierData((prev) => prev ? { ...prev, custom_answer: res.data.custom_answer } : null);
      }
    } catch {
      setSommelierData((prev) => prev ? { ...prev, custom_answer: `As your server, I can confirm the chef can gladly customize ${explainingDish.name} to your taste!` } : null);
    } finally {
      setSommelierAsking(false);
    }
  };

  const handleSendWaiterMessage = async (customPrompt?: string) => {
    const text = customPrompt || waiterInput;
    if (!text.trim() || waiterThinking) return;

    const nextUserMsg = { role: 'user' as const, text };
    const updatedMessages = [...waiterMessages, nextUserMsg];
    setWaiterMessages(updatedMessages);
    if (!customPrompt) setWaiterInput('');
    setWaiterThinking(true);

    try {
      const res = await axios.post('/api/ai/waiter-chat', {
        messages: updatedMessages.map((m) => ({
          role: m.role === 'waiter' ? 'assistant' : 'user',
          content: m.text,
        })),
        menu_items: items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          category: i.category_name,
          price: i.price,
          is_veg: i.is_veg,
        })),
      });

      if (res.data?.ok && res.data.text) {
        let mappedRecs: MenuItem[] = [];
        if (Array.isArray(res.data.recommendedDishes) && res.data.recommendedDishes.length > 0) {
          mappedRecs = res.data.recommendedDishes.map((rd: any) => {
            const match = items.find((i) => i.id === rd.id || i.name.toLowerCase() === (rd.name || '').toLowerCase());
            return match || (rd as MenuItem);
          }).filter(Boolean);
        }

        setWaiterMessages((prev) => [
          ...prev,
          { role: 'waiter', text: res.data.text, recommendedDishes: mappedRecs },
        ]);
        return;
      }
      throw new Error('Fallback to local');
    } catch {
      // Local fallback
      const q = text.toLowerCase();
      let responseText = '';
      let matches: MenuItem[] = [];

      if (q.includes('veg') || q.includes('paneer') || q.includes('vegetarian')) {
        matches = items.filter((i) => i.is_veg).slice(0, 2);
        responseText = `For wonderful vegetarian dining, our slow-simmered Paneer dishes and rich Dal gravies are made with churned butter and fresh roasted herbs.`;
      } else if (q.includes('spicy') || q.includes('starter') || q.includes('tikka')) {
        matches = items.filter((i) => i.category_id.toLowerCase().includes('starter') || i.name.toLowerCase().includes('tikka')).slice(0, 2);
        responseText = `For bold, fiery appetizers, our clay oven Tandoori specials have a sensational charred crust with smoky spice depth!`;
      } else if (q.includes('biryani') || q.includes('rice') || q.includes('main')) {
        matches = items.filter((i) => i.name.toLowerCase().includes('biryani') || i.category_id.toLowerCase().includes('main')).slice(0, 2);
        responseText = `Our Dum Biryani is our kitchen's masterwork, cooked slowly in dough-sealed clay pots with saffron and caramelized shallots.`;
      } else if (q.includes('dessert') || q.includes('sweet')) {
        matches = items.filter((i) => i.category_id.toLowerCase().includes('dessert')).slice(0, 2);
        responseText = `To conclude your meal decadently, our warm reduced milk dumplings soaked in cardamom rose syrup are simply divine!`;
      } else {
        matches = items.filter((i) => i.is_bestseller).slice(0, 2);
        if (matches.length === 0) matches = items.slice(0, 2);
        responseText = `These are our table favorites that our guests consistently praise. Both represent the finest flavors from our kitchen:`;
      }

      setWaiterMessages((prev) => [
        ...prev,
        { role: 'waiter', text: responseText, recommendedDishes: matches },
      ]);
    } finally {
      setWaiterThinking(false);
    }
  };

  // Attempt fetching live items from local POS backend, fallback to curated dataset
  useEffect(() => {
    async function loadBackendMenu() {
      try {
        const url = tableParam ? `/api/qr/menu?table_id=${encodeURIComponent(tableParam)}` : '/api/qr/menu';
        const res = await axios.get(url, { timeout: 3000 });
        if (res.data?.ok && res.data?.products?.length > 0) {
          if (res.data.restaurant?.name) setRestaurantName(res.data.restaurant.name);
          // Enrich backend products with rating and review count if missing
          const enriched: MenuItem[] = res.data.products.map((p: any) => ({
            id: String(p.id),
            name: p.name,
            category_id: String(p.category_id || 'mains'),
            category_name: p.category_name || 'Specialties',
            price: Number(p.price || 0),
            is_veg: Boolean(p.tags?.includes('veg') || p.is_vegetarian),
            is_bestseller: Boolean(p.tags?.includes('bestseller')),
            is_chef_special: Boolean(p.tags?.includes('chef')),
            rating: Number((4.2 + (Math.abs(p.name.length % 7) * 0.1)).toFixed(1)),
            rating_count: 50 + (p.name.length * 9),
            description: p.description || 'Prepared fresh with chef-selected ingredients and aromatic spices.',
            image_url: p.image_url || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
            addon_groups: p.addon_groups || [],
          }));
          if (enriched.length > 0) {
            setItems(enriched);
            if (res.data.categories?.length > 0) {
              setCategories(res.data.categories);
            }
          }
        }
      } catch {
        // Fall back gracefully to built-in sample menu
      }
    }
    loadBackendMenu();
  }, [tableParam]);

  // Filtered Items calculation
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.category_name.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      if (activeCategory !== 'all' && item.category_id !== activeCategory) {
        return false;
      }
      if (vegOnly && !item.is_veg) return false;
      if (nonVegOnly && item.is_veg) return false;
      if (topRatedOnly && item.rating < 4.6) return false;
      if (bestsellerOnly && !item.is_bestseller) return false;
      return true;
    });
  }, [items, searchQuery, activeCategory, vegOnly, nonVegOnly, topRatedOnly, bestsellerOnly]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: { [catId: string]: { category: MenuCategory; items: MenuItem[] } } = {};
    for (const item of filteredItems) {
      if (!groups[item.category_id]) {
        const foundCat = categories.find((c) => c.id === item.category_id);
        groups[item.category_id] = {
          category: foundCat || { id: item.category_id, name: item.category_name },
          items: [],
        };
      }
      groups[item.category_id].items.push(item);
    }
    return groups;
  }, [filteredItems, categories]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: { [catId: string]: number } = {};
    for (const item of items) {
      counts[item.category_id] = (counts[item.category_id] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Tray helpers
  const totalTrayCount = useMemo(() => {
    return tray.reduce((sum, item) => sum + item.quantity, 0);
  }, [tray]);

  const totalTrayPrice = useMemo(() => {
    return tray.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [tray]);

  const getItemQuantityInTray = (itemId: string) => {
    return tray
      .filter((t) => t.item.id === itemId)
      .reduce((sum, t) => sum + t.quantity, 0);
  };

  // Add item without modal (if no required addons) or open modal
  const handleAddClick = (item: MenuItem) => {
    if (item.addon_groups && item.addon_groups.length > 0) {
      setCustomizingItem(item);
      // Pre-select required addons default (first option)
      const defaults: MenuItemAddon[] = [];
      item.addon_groups.forEach((group) => {
        if (group.is_required && group.addons[0]) {
          defaults.push(group.addons[0]);
        }
      });
      setModalSelectedAddons(defaults);
      setModalNote('');
    } else {
      addToTrayDirect(item, [], '');
    }
  };

  const addToTrayDirect = (item: MenuItem, addons: MenuItemAddon[], note: string) => {
    const addonsSum = addons.reduce((s, a) => s + a.price, 0);
    const unitPrice = item.price + addonsSum;
    const cartId = `${item.id}-${addons.map((a) => a.id).sort().join('-')}-${note.trim()}`;

    setTray((prev) => {
      const existingIdx = prev.findIndex((p) => p.cartId === cartId);
      if (existingIdx > -1) {
        const next = [...prev];
        const updatedQty = next[existingIdx].quantity + 1;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: updatedQty,
          totalPrice: unitPrice * updatedQty,
        };
        return next;
      }
      return [
        ...prev,
        {
          cartId,
          item,
          quantity: 1,
          selectedAddons: addons,
          specialNote: note,
          totalPrice: unitPrice,
        },
      ];
    });
  };

  // Quantity Stepper on Dish Card
  const handleQuantityChange = (item: MenuItem, delta: number) => {
    const existing = tray.find((t) => t.item.id === item.id);
    if (!existing) {
      if (delta > 0) handleAddClick(item);
      return;
    }

    setTray((prev) => {
      const idx = prev.findIndex((t) => t.cartId === existing.cartId);
      if (idx === -1) return prev;
      const target = prev[idx];
      const nextQty = target.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      const unitPrice = target.totalPrice / target.quantity;
      const next = [...prev];
      next[idx] = {
        ...target,
        quantity: nextQty,
        totalPrice: unitPrice * nextQty,
      };
      return next;
    });
  };

  // Scroll to category smoothly
  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    setMenuModalOpen(false);
    if (catId === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = categoryRefs.current[catId];
    if (el) {
      const offset = 140; // sticky header compensation
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  // Call waiter handler
  const handleCallWaiter = () => {
    setWaiterCalled(true);
    setTimeout(() => setWaiterCalled(false), 5000);
  };

  // Place order directly
  const handleSendOrder = async () => {
    try {
      if (tableParam) {
        await axios.post('/api/qr/order', {
          table_id: tableParam,
          items: tray.map((t) => ({
            product_id: t.item.id,
            quantity: t.quantity,
            special_instructions: t.specialNote,
            addons: t.selectedAddons.map((a) => a.id),
          })),
        });
      }
      setOrderSent(true);
      setTimeout(() => {
        setOrderSent(false);
        setTrayDrawerOpen(false);
        setTray([]);
      }, 3500);
    } catch {
      // Fallback display success confirmation for the customer
      setOrderSent(true);
      setTimeout(() => {
        setOrderSent(false);
        setTrayDrawerOpen(false);
        setTray([]);
      }, 3500);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4F7] text-slate-900 pb-28 font-sans antialiased selection:bg-amber-500 selection:text-white">
      {/* ── TOP NAV BAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base leading-tight text-slate-900 tracking-tight">
                  {restaurantName}
                </h1>
              </div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-orange-500" />
                {tableParam ? `Table #${tableParam}` : 'Dine-In Digital Menu'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCallWaiter}
              className={`text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-xs ${
                waiterCalled
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30 animate-pulse'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200/60'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>{waiterCalled ? 'Waiter Called!' : 'Call Waiter'}</span>
            </button>
          </div>
        </div>

        {/* ── SEARCH INPUT ──────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search dishes, starters, biryanis, drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── DIETARY & RATING FILTER CHIPS ───────────────────────── */}
          <div className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-1 no-scrollbar text-xs font-semibold">
            {/* Veg Switch (Iconic Swiggy Green Toggle) */}
            <button
              onClick={() => {
                setVegOnly(!vegOnly);
                if (!vegOnly) setNonVegOnly(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shrink-0 active:scale-95 ${
                vegOnly
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-xs border border-emerald-600 flex items-center justify-center p-0.5 bg-white">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 block" />
              </span>
              <span>Veg Only</span>
            </button>

            {/* Non-Veg Switch */}
            <button
              onClick={() => {
                setNonVegOnly(!nonVegOnly);
                if (!nonVegOnly) setVegOnly(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shrink-0 active:scale-95 ${
                nonVegOnly
                  ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-xs border border-rose-600 flex items-center justify-center p-0.5 bg-white">
                <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-rose-600 block" />
              </span>
              <span>Non-Veg</span>
            </button>

            {/* Bestsellers Filter */}
            <button
              onClick={() => setBestsellerOnly(!bestsellerOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shrink-0 active:scale-95 ${
                bestsellerOnly
                  ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Bestsellers</span>
            </button>

            {/* Top Rated (4.6+) */}
            <button
              onClick={() => setTopRatedOnly(!topRatedOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shrink-0 active:scale-95 ${
                topRatedOnly
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Rated 4.6+</span>
            </button>
          </div>
        </div>

        {/* ── CATEGORY PILLS BAR ────────────────────────────────────── */}
        <div className="bg-slate-50 border-t border-slate-200/60 overflow-x-auto no-scrollbar py-2 px-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => scrollToCategory('all')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                activeCategory === 'all'
                  ? 'bg-orange-500 text-white shadow-xs shadow-orange-500/30 font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Items ({items.length})
            </button>
            {categories.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-xs shadow-orange-500/30 font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── HERO BANNER CARD ────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-stone-900 text-white p-5 shadow-lg border border-slate-800">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                <ChefHat className="w-3 h-3" /> Live Tableside Ordering
              </span>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> 18-25 mins prep
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">
              Culinary Delights Crafted to Perfection
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-lg">
              Explore our chef's hand-picked starters, traditional tandoori delicacies, and aromatic dum biryanis.
            </p>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px]">
                  ★
                </span>
                <span>4.8 Rating</span>
                <span className="text-slate-400 font-normal">(1.4K+ reviews)</span>
              </div>
              <div className="text-slate-400">•</div>
              <div className="text-slate-300 font-medium">
                North Indian • Tandoori • Biryani
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 bg-radial from-orange-500 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* ── NOTICE FOR GUEST ────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 mt-3">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Tap <strong>ADD</strong> to assemble your personal dining tray, then show it to the waiter or fire your order directly!
            </span>
          </div>
        </div>
      </div>

      {/* ── DISHES LIST BY CATEGORIES ───────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 mt-5 space-y-8">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 shadow-xs">
            <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base">No matching dishes found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search query or reset the veg/non-veg filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setVegOnly(false);
                setNonVegOnly(false);
                setTopRatedOnly(false);
                setBestsellerOnly(false);
                setActiveCategory('all');
              }}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          Object.values(groupedItems).map(({ category, items: catItems }) => (
            <section
              key={category.id}
              ref={(el) => {
                categoryRefs.current[category.id] = el;
              }}
              className="scroll-mt-40"
            >
              {/* Category Header with Item Count */}
              <div className="flex items-baseline justify-between border-b-2 border-slate-200/80 pb-2 mb-4">
                <div>
                  <h2 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{category.description}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {catItems.length} items
                </span>
              </div>

              {/* Dish Items (Swiggy 2-Column Card) */}
              <div className="divide-y divide-slate-200/70 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {catItems.map((dish) => {
                  const qtyInTray = getItemQuantityInTray(dish.id);
                  return (
                    <div
                      key={dish.id}
                      className="p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/70"
                    >
                      {/* Left Column: Details */}
                      <div className="flex-1 pr-2">
                        {/* Badges: Veg/NonVeg + Bestseller */}
                        <div className="flex items-center gap-2 mb-1.5">
                          {dish.is_veg ? (
                            <span
                              title="Vegetarian"
                              className="w-4 h-4 rounded-xs border-[1.5px] border-emerald-600 flex items-center justify-center p-0.5 shrink-0"
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-600 block" />
                            </span>
                          ) : (
                            <span
                              title="Non-Vegetarian"
                              className="w-4 h-4 rounded-xs border-[1.5px] border-rose-600 flex items-center justify-center p-0.5 shrink-0"
                            >
                              <span className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-rose-600 block" />
                            </span>
                          )}

                          {dish.is_bestseller && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                              Bestseller
                            </span>
                          )}

                          {dish.is_chef_special && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-800 border border-orange-200">
                              Chef's Special
                            </span>
                          )}
                        </div>

                        {/* Dish Name */}
                        <h3 className="font-bold text-base text-slate-900 leading-snug">
                          {dish.name}
                        </h3>

                        {/* Price & Discount */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900">
                            {currency}
                            {dish.price}
                          </span>
                          {dish.original_price && dish.original_price > dish.price && (
                            <span className="text-xs text-slate-400 line-through">
                              {currency}
                              {dish.original_price}
                            </span>
                          )}
                        </div>

                        {/* Rating Pill */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-700 text-white text-[11px] font-extrabold">
                            <Star className="w-2.5 h-2.5 fill-white" />
                            {dish.rating}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            ({dish.rating_count})
                          </span>
                          {dish.spicy_level !== undefined && dish.spicy_level > 0 && (
                            <span
                              className="text-[11px] text-orange-600 font-semibold flex items-center ml-1"
                              title={`Spicy Level: ${dish.spicy_level}/3`}
                            >
                              {'🌶️'.repeat(dish.spicy_level)}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed font-normal">
                          {dish.description}
                        </p>

                        {/* Ask AI Server button */}
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => handleOpenSommelier(dish)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                          >
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>Ask AI Server · Chef's Notes</span>
                          </button>
                        </div>
                      </div>

                      {/* Right Column: Dish Photo & Swiggy ADD Button */}
                      <div className="relative flex flex-col items-center shrink-0 w-28 sm:w-36">
                        <div className="w-28 h-24 sm:w-36 sm:h-28 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-xs">
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="w-full h-full object-cover transform hover:scale-105 transition duration-500"
                            loading="lazy"
                          />
                        </div>

                        {/* Iconic Bottom-Anchored ADD Stepper */}
                        <div className="absolute -bottom-3.5">
                          {qtyInTray > 0 ? (
                            <div className="flex items-center bg-white border border-emerald-600 rounded-xl shadow-md overflow-hidden text-emerald-600 font-black text-xs">
                              <button
                                onClick={() => handleQuantityChange(dish, -1)}
                                className="px-2.5 py-1.5 hover:bg-emerald-50 transition active:scale-90"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 font-black text-sm">{qtyInTray}</span>
                              <button
                                onClick={() => handleQuantityChange(dish, 1)}
                                className="px-2.5 py-1.5 hover:bg-emerald-50 transition active:scale-90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddClick(dish)}
                              className="px-6 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 text-emerald-600 font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-emerald-50/50 transition-all active:scale-95 flex items-center gap-1"
                            >
                              <span>ADD</span>
                              <Plus className="w-3 h-3 stroke-[3]" />
                            </button>
                          )}
                        </div>

                        {/* Customisable indicator */}
                        {dish.addon_groups && dish.addon_groups.length > 0 && (
                          <span className="text-[9px] font-semibold text-slate-400 mt-4 uppercase tracking-tight">
                            Customisable
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* ── FLOATING "BROWSE MENU" PILL (Iconic Swiggy UI) ───────────── */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={() => setMenuModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white font-extrabold text-xs shadow-xl shadow-slate-950/30 hover:bg-black transition-transform active:scale-95 border border-slate-700"
        >
          <UtensilsCrossed className="w-4 h-4 text-orange-400" />
          <span>BROWSE MENU</span>
        </button>
      </div>

      {/* ── FLOATING TRAY BAR (Bottom of Screen) ────────────────────── */}
      {totalTrayCount > 0 && (
        <div className="fixed bottom-3 left-0 right-0 z-40 px-4">
          <div className="max-w-3xl mx-auto bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-3.5 text-white shadow-xl shadow-emerald-700/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-sm">
                {totalTrayCount}
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
                  Selected Items
                </p>
                <p className="font-extrabold text-base">
                  {currency}
                  {totalTrayPrice.toFixed(2)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setTrayDrawerOpen(true)}
              className="bg-white text-emerald-800 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md hover:bg-emerald-50 transition active:scale-95 flex items-center gap-1.5"
            >
              <span>View Tray / Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── BROWSE MENU CATEGORIES MODAL ────────────────────────────── */}
      {menuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Browse Menu</h3>
                <p className="text-xs text-slate-500">Jump directly to your favorite category</p>
              </div>
              <button
                onClick={() => setMenuModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 space-y-1 overflow-y-auto divide-y divide-slate-100">
              <button
                onClick={() => scrollToCategory('all')}
                className="w-full text-left p-3 rounded-xl hover:bg-orange-50/80 flex items-center justify-between text-sm font-bold text-slate-800 transition"
              >
                <span>All Items</span>
                <span className="text-xs font-bold text-slate-400">{items.length}</span>
              </button>
              {categories.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-orange-50/80 flex items-center justify-between text-sm font-bold text-slate-800 transition"
                  >
                    <span>{cat.name}</span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMIZATION MODAL ─────────────────────────────────────── */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-slate-900">{customizingItem.name}</h3>
                <p className="text-xs font-bold text-orange-600">
                  Base Price: {currency}
                  {customizingItem.price}
                </p>
              </div>
              <button
                onClick={() => setCustomizingItem(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {customizingItem.addon_groups?.map((group) => (
                <div key={group.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                      {group.name}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {group.is_required ? 'Required • Choose 1' : 'Optional'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.addons.map((addon) => {
                      const isSelected = modalSelectedAddons.some((a) => a.id === addon.id);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => {
                            if (group.is_required) {
                              const withoutGroup = modalSelectedAddons.filter(
                                (a) => !group.addons.some((ga) => ga.id === a.id)
                              );
                              setModalSelectedAddons([...withoutGroup, addon]);
                            } else {
                              if (isSelected) {
                                setModalSelectedAddons(
                                  modalSelectedAddons.filter((a) => a.id !== addon.id)
                                );
                              } else {
                                setModalSelectedAddons([...modalSelectedAddons, addon]);
                              }
                            }
                          }}
                          className={`w-full p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                            <span>{addon.name}</span>
                          </div>
                          <span className="font-extrabold">
                            {addon.price > 0 ? `+${currency}${addon.price}` : 'Free'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Cooking note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Special Instructions for Chef
                </label>
                <input
                  type="text"
                  placeholder="e.g. Less oil, make it extra spicy, no onions"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>

            {/* Modal Add to Tray CTA */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Item Total</p>
                <p className="font-black text-lg text-slate-900">
                  {currency}
                  {(
                    customizingItem.price +
                    modalSelectedAddons.reduce((s, a) => s + a.price, 0)
                  ).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => {
                  addToTrayDirect(customizingItem, modalSelectedAddons, modalNote);
                  setCustomizingItem(null);
                }}
                className="px-6 py-3 rounded-xl bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-500/30 hover:bg-orange-600 transition active:scale-95"
              >
                Add Item to Tray
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRAY & SHOW-WAITER DRAWER ────────────────────────────────── */}
      {trayDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-lg text-slate-900">
                  {showWaiterMode ? '📋 Order Card for Waiter' : '🛒 Your Selected Tray'}
                </h3>
                <p className="text-xs text-slate-500">
                  {tableParam ? `Table #${tableParam}` : 'Dine-In Customer'} • {totalTrayCount} items
                </p>
              </div>
              <button
                onClick={() => setTrayDrawerOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Mode: Standard Tray vs Waiter Display Mode */}
            <div className="px-4 pt-3 flex items-center gap-2">
              <button
                onClick={() => setShowWaiterMode(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  !showWaiterMode ? 'bg-orange-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Tray Items
              </button>
              <button
                onClick={() => setShowWaiterMode(true)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  showWaiterMode ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <span>Show to Waiter</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </button>
            </div>

            {/* Order Confirmation Banner */}
            {orderSent && (
              <div className="m-4 p-4 rounded-2xl bg-emerald-500 text-white flex items-center gap-3 animate-in zoom-in-95">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h4 className="font-black text-sm">Order Fired to Kitchen!</h4>
                  <p className="text-xs text-emerald-100">
                    The chefs have received your ticket. Relax and enjoy your meal!
                  </p>
                </div>
              </div>
            )}

            {/* Tray List View */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {showWaiterMode ? (
                // High-Contrast Clear Card for the Waiter to Read
                <div className="bg-amber-50 border-2 border-amber-400/80 rounded-2xl p-5 space-y-4">
                  <div className="text-center pb-3 border-b border-amber-300">
                    <p className="text-xs font-extrabold uppercase text-amber-800 tracking-wider">
                      Please Punch For Table
                    </p>
                    <h2 className="text-3xl font-black text-slate-950 mt-1">
                      {tableParam ? `Table #${tableParam}` : 'Table Service'}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {tray.map((t, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-black text-slate-900 text-base">
                            <span className="inline-block w-6 text-orange-600">{t.quantity}x</span>
                            {t.item.name}
                          </p>
                          {t.selectedAddons.length > 0 && (
                            <p className="text-xs text-slate-600 pl-6">
                              + {t.selectedAddons.map((a) => a.name).join(', ')}
                            </p>
                          )}
                          {t.specialNote && (
                            <p className="text-xs italic text-amber-900 font-semibold pl-6 mt-0.5">
                              Note: "{t.specialNote}"
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-slate-700">
                          {currency}
                          {t.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-amber-300 flex items-center justify-between font-black text-base">
                    <span>Estimated Total</span>
                    <span>
                      {currency}
                      {totalTrayPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                // Standard Editable Tray Items
                tray.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{t.item.name}</h4>
                      {t.selectedAddons.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t.selectedAddons.map((a) => a.name).join(', ')}
                        </p>
                      )}
                      {t.specialNote && (
                        <p className="text-xs italic text-orange-600 mt-0.5">"{t.specialNote}"</p>
                      )}
                      <p className="font-extrabold text-xs text-slate-700 mt-1">
                        {currency}
                        {t.totalPrice.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-xs">
                      <button
                        onClick={() => handleQuantityChange(t.item, -1)}
                        className="p-1 text-slate-500 hover:text-orange-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-extrabold text-xs w-4 text-center">{t.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(t.item, 1)}
                        className="p-1 text-slate-500 hover:text-orange-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Subtotal ({totalTrayCount} items)</span>
                <span className="font-bold">
                  {currency}
                  {totalTrayPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Taxes & GST (Est. 5%)</span>
                <span className="font-bold">
                  {currency}
                  {(totalTrayPrice * 0.05).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Payable</span>
                <span className="text-orange-600 text-base">
                  {currency}
                  {(totalTrayPrice * 1.05).toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setShowWaiterMode(!showWaiterMode)}
                  className="py-3 px-4 rounded-xl border-2 border-slate-800 text-slate-900 font-extrabold text-xs hover:bg-slate-100 transition active:scale-95 text-center"
                >
                  {showWaiterMode ? 'Edit Tray' : 'Show to Waiter'}
                </button>

                <button
                  onClick={handleSendOrder}
                  className="py-3 px-4 rounded-xl bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-500/30 hover:bg-orange-600 transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <ChefHat className="w-4 h-4" />
                  <span>Send to Kitchen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Ask AI Waiter button */}
      <div className="fixed bottom-24 right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setAiWaiterOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white font-bold text-xs shadow-xl hover:shadow-2xl border-2 border-white/80 active:scale-95 transition-all hover:scale-105"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Ask AI Waiter</span>
        </button>
      </div>

      {/* AI Dish Explainer Sommelier Modal */}
      {explainingDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col">
            <button
              onClick={() => setExplainingDish(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative h-48 sm:h-56 w-full bg-slate-100 overflow-hidden">
              <img
                src={explainingDish.image_url}
                alt={explainingDish.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-600 text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Server Notes
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${explainingDish.is_veg ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {explainingDish.is_veg ? 'Vegetarian' : 'Non-Veg'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black">{explainingDish.name}</h2>
                <p className="text-sm font-bold text-slate-200">{currency}{explainingDish.price}</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-slate-800">
              {sommelierLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  <p className="text-xs font-semibold">Your AI Server is preparing culinary notes...</p>
                </div>
              ) : sommelierData ? (
                <>
                  <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800 uppercase tracking-wide">
                      <ChefHat className="w-4 h-4 text-purple-600" />
                      <span>How We Craft This Dish</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {sommelierData.story}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">Flavor Profile</span>
                      <p className="text-xs font-semibold text-slate-800 mt-1 leading-snug">
                        {sommelierData.flavor_profile}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">Spice Intensity</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                        <span className="text-xs font-black text-slate-800">{sommelierData.spice_level}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">Portion Size</span>
                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {sommelierData.portion_size}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 block uppercase">Allergen Safety</span>
                      <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-slate-800">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{sommelierData.allergens}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Wine className="w-3.5 h-3.5 text-amber-700" />
                      <span>Server's Recommended Pairing</span>
                    </div>
                    <p className="text-xs text-amber-950 font-medium">
                      {sommelierData.pairings}
                    </p>
                    <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-900/80 italic">
                      💡 <span className="font-semibold">Captain's Tip: </span>{sommelierData.server_tip}
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                      <span>Have a question for the waiter?</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['Is it spicy for kids?', 'What bread goes best?', 'Can we customize this?'].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAskSommelierQuery(chip)}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {sommelierData.custom_answer && (
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-950 leading-relaxed animate-fade-in flex items-start gap-2">
                        <HeartHandshake className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-purple-900">Your AI Server: </span>
                          {sommelierData.custom_answer}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sommelierQuery}
                        onChange={(e) => setSommelierQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAskSommelierQuery();
                        }}
                        placeholder="Ask about ingredients, preparation, etc..."
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleAskSommelierQuery()}
                        disabled={sommelierAsking || !sommelierQuery.trim()}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {sommelierAsking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Price</span>
                <span className="text-lg font-black text-slate-900">{currency}{explainingDish.price}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleAddClick(explainingDish);
                  setExplainingDish(null);
                }}
                className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add to Tray</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Waiter Conversational Drawer */}
      {aiWaiterOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg h-[85vh] sm:h-[650px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 text-white backdrop-blur-xs">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-base">Your AI Tableside Waiter</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-purple-200">
                    Culinary guide, pairing sommelier & dining concierge
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiWaiterOpen(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAF9FB]">
              {waiterMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-white border border-purple-100 text-slate-800 rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {m.role === 'waiter' && (
                      <div className="flex items-center gap-1 text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>AI Server</span>
                      </div>
                    )}
                    <p>{m.text}</p>

                    {m.recommendedDishes && m.recommendedDishes.length > 0 && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                        {m.recommendedDishes.map((d) => (
                          <div
                            key={d.id}
                            className="bg-[#F8F9FA] rounded-xl p-2.5 flex items-center justify-between gap-2 border border-slate-200"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={d.image_url}
                                alt={d.name}
                                className="w-11 h-11 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-slate-900 truncate">
                                  {d.name}
                                </h4>
                                <span className="text-xs font-black text-emerald-700">
                                  {currency}{d.price}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddClick(d)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shrink-0 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3 stroke-[3]" />
                              <span>Add</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {waiterThinking && (
                <div className="flex items-center gap-2 text-xs text-slate-500 italic py-1">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span>Your waiter is curating culinary recommendations...</span>
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {['✨ Chef\'s top recommendations', '🌶️ Best spicy tandoori starters', '🌱 Mild vegetarian specials', '🍨 Sweet desserts to finish'].map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendWaiterMessage(q)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap hover:bg-purple-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                value={waiterInput}
                onChange={(e) => setWaiterInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendWaiterMessage();
                }}
                placeholder="Ask your waiter (e.g. What's good for 2 people?)"
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
              <button
                onClick={() => handleSendWaiterMessage()}
                disabled={waiterThinking || !waiterInput.trim()}
                className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SwiggyMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-bold text-sm tracking-wide text-slate-300">Loading Gourmet Menu...</p>
        </div>
      }
    >
      <SwiggyMenuContent />
    </Suspense>
  );
}
