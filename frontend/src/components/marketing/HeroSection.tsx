'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Monitor,
  Cloud,
  ChevronRight,
  WifiOff,
  Printer,
  ShieldCheck,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  Check,
  CheckCircle2,
  BarChart3,
  ChefHat,
  LayoutGrid,
  TrendingUp,
  Banknote,
  Bell,
  Volume2,
} from 'lucide-react';

interface DemoItem {
  id: string;
  name: string;
  price: number;
  category: string;
  station: 'Grill' | 'Bar' | 'Pantry';
}

const SAMPLE_MENU: DemoItem[] = [
  { id: 'item-1', name: 'Truffle Margherita Pizza', price: 340, category: 'Main', station: 'Grill' },
  { id: 'item-2', name: 'Cold Brew Espresso', price: 180, category: 'Beverage', station: 'Bar' },
  { id: 'item-3', name: 'Avocado Sourdough Toast', price: 260, category: 'Main', station: 'Pantry' },
  { id: 'item-4', name: 'Smoked Cottage Cheese Taco', price: 290, category: 'Main', station: 'Grill' },
  { id: 'item-5', name: 'Citrus Mint Refresher', price: 160, category: 'Beverage', station: 'Bar' },
];

export default function MarketingHeroSection() {
  const [cart, setCart] = useState<{ [id: string]: number }>({
    'item-1': 1,
    'item-2': 2,
  });
  const [activeView, setActiveView] = useState<'pos' | 'kds' | 'display' | 'dashboard'>('pos');
  const [fired, setFired] = useState(false);
  const [kdsBumped, setKdsBumped] = useState(false);
  const [dashboardPeriod, setDashboardPeriod] = useState<'day' | 'month'>('day');

  const addItem = (id: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
    setFired(false);
    setKdsBumped(false);
  };

  const removeItem = (id: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) {
        next[id] -= 1;
      } else {
        delete next[id];
      }
      return next;
    });
    setFired(false);
    setKdsBumped(false);
  };

  const resetCart = () => {
    setCart({
      'item-1': 1,
      'item-2': 1,
    });
    setFired(false);
    setKdsBumped(false);
  };

  // Calculations
  const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = SAMPLE_MENU.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const tax = Math.round(subtotal * 0.05); // 5% GST
  const total = subtotal + tax;

  const totalItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleFireOrder = () => {
    setFired(true);
    setKdsBumped(false);
    setTimeout(() => {
      setActiveView('kds');
    }, 600);
  };

  const handleBumpTicket = () => {
    setKdsBumped(true);
    setTimeout(() => {
      setActiveView('display');
    }, 700);
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
      {/* Background Ambience & Grid Patterns */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[380px] bg-gradient-to-tr from-orange-600/20 via-amber-500/15 to-rose-500/10 blur-[140px] rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[300px] bg-sky-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Announcement Pill with Brand Emblem */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-orange-500/30 text-xs font-semibold text-orange-300 backdrop-blur-md shadow-inner hover:border-orange-500/60 transition-colors">
            <img src="/logo.png" alt="Order It Up" className="w-4 h-4 object-contain rounded" />
            <span className="flex h-2 w-2 rounded-full bg-orange-400 animate-ping" />
            <span>Tri-Platform Operating System: Desktop POS • Cloud HQ • Mobile Companion</span>
          </div>
        </div>

        {/* Hero Heading */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
            Run Your Restaurant.{' '}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              Not Your Paperwork.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Manage orders, billing, kitchen tickets, and your staff from one connected platform. 
            Sub-second offline POS checkout with zero internet dependency, backed by real-time multi-branch cloud sync.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start Free 14-Day Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/pos"
              className="w-full sm:w-auto px-7 py-4 text-base font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Monitor className="w-5 h-5 text-orange-400" />
              <span>Launch Live Web POS</span>
            </Link>

            <Link
              href="/cloud-portal"
              className="w-full sm:w-auto px-6 py-4 text-base font-semibold text-slate-300 hover:text-white bg-slate-950/60 hover:bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Cloud className="w-5 h-5 text-sky-400" />
              <span>Cloud HQ Portal</span>
            </Link>
          </div>
        </div>

        {/* Realistic Interactive Restaurant Viewers & Dashboard Simulation */}
        <div className="mt-12 max-w-5xl mx-auto">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-black/80 backdrop-blur-2xl overflow-hidden">
            {/* Terminal Top Window Bar with Official Logo */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800/90 bg-slate-900/80 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <div className="h-4 w-px bg-slate-800 mx-1" />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-slate-800 p-0.5 flex items-center justify-center">
                    <img src="/logo.png" alt="Order It Up" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-300">
                    Order It Up • The Grand Bistro (Main Branch)
                  </span>
                </div>
              </div>

              {/* 4-Mode Restaurant Operations & Viewers Suite */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
                <button
                  onClick={() => setActiveView('pos')}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeView === 'pos'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>1. POS Terminal</span>
                </button>

                <button
                  onClick={() => setActiveView('kds')}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeView === 'kds'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>2. Kitchen KDS</span>
                  {fired && !kdsBumped && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => setActiveView('display')}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeView === 'display'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>3. Token Display</span>
                  {kdsBumped && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeView === 'dashboard'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>4. Live Dashboard</span>
                </button>
              </div>
            </div>

            {/* VIEW 1: COUNTER POS BILLING */}
            {activeView === 'pos' && (
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[400px]">
                {/* Left: Quick Tap Menu Catalog */}
                <div className="p-4 sm:p-6 md:col-span-7 border-b md:border-b-0 md:border-r border-slate-800/80">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Tap Dishes To Build Live Ticket
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ● Offline SQLite Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SAMPLE_MENU.map((item) => {
                      const qty = cart[item.id] || 0;
                      return (
                        <div
                          key={item.id}
                          onClick={() => addItem(item.id)}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                            qty > 0
                              ? 'bg-slate-900 border-orange-500/40 shadow-sm shadow-orange-500/10'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {item.station}
                              </span>
                              <span className="text-xs font-mono font-bold text-orange-400">
                                ₹{item.price}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold text-white mt-1.5 leading-snug">
                              {item.name}
                            </h4>
                          </div>

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                            <span className="text-[11px] text-slate-400">
                              {qty > 0 ? `${qty} in cart` : 'Tap to add'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem(item.id);
                              }}
                              className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white flex items-center justify-center transition-colors"
                              aria-label={`Add ${item.name}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Live Cart & Print Drawer Engine */}
                <div className="p-4 sm:p-6 md:col-span-5 bg-slate-950 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <div>
                        <span className="text-xs font-bold text-white">Active Bill #1042</span>
                        <div className="text-[11px] text-slate-400">Server: Ravi K. • Dine-in Table 04</div>
                      </div>
                      <button
                        onClick={resetCart}
                        className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                        title="Reset demo cart"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>

                    {/* Cart Items List */}
                    <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                      {totalItemsCount === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          Cart is empty. Tap any menu item on the left to start billing.
                        </div>
                      ) : (
                        Object.entries(cart).map(([id, qty]) => {
                          const item = SAMPLE_MENU.find((m) => m.id === id);
                          if (!item) return null;
                          return (
                            <div
                              key={id}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-medium text-white truncate">{item.name}</div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  ₹{item.price} × {qty} = ₹{item.price * qty}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => removeItem(id)}
                                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-5 text-center font-mono font-bold text-white text-xs">
                                  {qty}
                                </span>
                                <button
                                  onClick={() => addItem(id)}
                                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Cart Totals & Checkout Button */}
                  <div className="pt-3 border-t border-slate-800 mt-3 space-y-2">
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Items Subtotal</span>
                        <span>₹{subtotal}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>GST Tax (CGST+SGST 5%)</span>
                        <span>₹{tax}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800/60">
                        <span>Net Payable</span>
                        <span className="text-orange-400">₹{total}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={handleFireOrder}
                        disabled={totalItemsCount === 0}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          totalItemsCount === 0
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : fired
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 active:scale-[0.98]'
                        }`}
                      >
                        {fired ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Order Fired! Routing to Kitchen KDS...</span>
                          </>
                        ) : (
                          <>
                            <Printer className="w-4 h-4" />
                            <span>Fire to Kitchen & Print (ESC/POS 80mm)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: KITCHEN DISPLAY SYSTEM (Matches /kds) */}
            {activeView === 'kds' && (
              <div className="p-4 sm:p-6 min-h-[400px] bg-slate-950 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Kitchen Display System (KDS) • Station Line
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs">
                        Station: Grill & Bar
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        WebSocket: 0ms
                      </span>
                    </div>
                  </div>

                  {/* KDS Active Tickets Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Ticket 1: Active bill #1042 */}
                    <div className="p-4 rounded-xl border border-amber-500/50 bg-slate-900/90 shadow-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2.5">
                          <div>
                            <span className="text-xs font-bold text-white">#1042 • Table 04</span>
                            <div className="text-[10px] text-slate-400 font-mono">Dine-in • Server: Ravi</div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse">
                            01:14 min
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          {Object.entries(cart).map(([id, qty]) => {
                            const item = SAMPLE_MENU.find((m) => m.id === id);
                            if (!item) return null;
                            return (
                              <div key={id} className="text-slate-200">
                                <div className="flex justify-between font-medium">
                                  <span>{qty}× {item.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">
                                    {item.station}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 pl-2">↳ Modifier: Standard Prep</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800">
                        {!kdsBumped ? (
                          <button
                            onClick={handleBumpTicket}
                            className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/25 transition-all active:scale-[0.98]"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Ready (Bump to Display)</span>
                          </button>
                        ) : (
                          <div className="w-full py-2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Ready! Token Bumped</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ticket 2 */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2.5">
                          <div>
                            <span className="text-xs font-bold text-white">#1041 • Table 09</span>
                            <div className="text-[10px] text-slate-400 font-mono">Takeaway • Cashier: Anita</div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                            05:32 min
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="text-slate-200">
                            <div className="flex justify-between font-medium">
                              <span>2× Truffle Margherita Pizza</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">Grill</span>
                            </div>
                            <div className="text-[10px] text-amber-300/80 pl-2">↳ Extra Basil, Crispy</div>
                          </div>
                          <div className="text-slate-200">
                            <div className="flex justify-between font-medium">
                              <span>1× Citrus Mint Refresher</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-400">Bar</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <button
                          onClick={() => setActiveView('display')}
                          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Bump to Counter</span>
                        </button>
                      </div>
                    </div>

                    {/* Ticket 3 */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2.5">
                          <div>
                            <span className="text-xs font-bold text-white">#1040 • Table 02</span>
                            <div className="text-[10px] text-slate-400 font-mono">Dine-in • Server: Vikram</div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            02:18 min
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="text-slate-200">
                            <div className="flex justify-between font-medium">
                              <span>1× Smoked Cheese Taco</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">Grill</span>
                            </div>
                          </div>
                          <div className="text-slate-200">
                            <div className="flex justify-between font-medium">
                              <span>2× Cold Brew Espresso</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-400">Bar</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <button
                          onClick={() => setActiveView('display')}
                          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Bump to Counter</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Matches the kitchen station screen running in restaurant kitchens at /kds.
                  </span>
                  <button
                    onClick={() => setActiveView('display')}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <span>View Customer Token Board</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 3: RESTAURANT CUSTOMER DISPLAY BOARD (Matches /customer-display) */}
            {activeView === 'display' && (
              <div className="p-4 sm:p-6 min-h-[400px] bg-slate-950 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Customer Token Queue Viewer • Counter Display
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium flex items-center gap-1">
                        <Volume2 className="w-3 h-3" /> Chime ON
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium">
                        Voice Calling Active
                      </span>
                    </div>
                  </div>

                  {/* Dual Column Token Board (matching /customer-display layout) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PREPARING COLUMN */}
                    <div className="rounded-2xl bg-blue-950/30 border border-blue-900/50 p-4">
                      <div className="flex items-center justify-between pb-3 border-b border-blue-800/40 mb-3">
                        <div>
                          <div className="text-sm font-bold tracking-wide text-blue-200">PREPARING</div>
                          <div className="text-[11px] text-blue-300/70">Chef is preparing your meal</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-xs">
                          {fired && !kdsBumped ? 3 : 2}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {fired && !kdsBumped && (
                          <div className="rounded-xl bg-slate-900/90 border border-blue-500/50 p-3 text-center shadow-lg animate-in zoom-in-95">
                            <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">In Cooking</div>
                            <div className="text-2xl font-black text-white">#1042</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Table 04</div>
                          </div>
                        )}
                        <div className="rounded-xl bg-slate-900/80 border border-blue-900/40 p-3 text-center">
                          <div className="text-[10px] uppercase tracking-wider text-blue-400/70 font-semibold">Token</div>
                          <div className="text-2xl font-black text-white">#1043</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Takeaway</div>
                        </div>
                        <div className="rounded-xl bg-slate-900/80 border border-blue-900/40 p-3 text-center">
                          <div className="text-[10px] uppercase tracking-wider text-blue-400/70 font-semibold">Token</div>
                          <div className="text-2xl font-black text-white">#1045</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Table 08</div>
                        </div>
                      </div>
                    </div>

                    {/* READY FOR PICKUP COLUMN */}
                    <div className="rounded-2xl bg-emerald-950/30 border border-emerald-900/50 p-4">
                      <div className="flex items-center justify-between pb-3 border-b border-emerald-800/40 mb-3">
                        <div>
                          <div className="text-sm font-bold tracking-wide text-emerald-200">READY FOR PICKUP</div>
                          <div className="text-[11px] text-emerald-300/70">Please collect at the counter</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                          {kdsBumped ? 4 : 3}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {kdsBumped && (
                          <div className="rounded-xl bg-gradient-to-b from-emerald-950/90 to-slate-900 border-2 border-emerald-400 p-3 text-center shadow-lg shadow-emerald-500/20 animate-bounce">
                            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Just Called 🔔</div>
                            <div className="text-2xl font-black text-white">#1042</div>
                            <div className="text-[10px] text-emerald-300 mt-0.5 font-mono">Table 04</div>
                          </div>
                        )}
                        <div className="rounded-xl bg-gradient-to-b from-emerald-950/90 to-slate-900 border-2 border-emerald-500/80 p-3 text-center shadow-lg shadow-emerald-950/50">
                          <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Ready</div>
                          <div className="text-2xl font-black text-emerald-300">#1039</div>
                          <div className="text-[10px] text-emerald-400/80 mt-0.5 font-mono">Table 02</div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-b from-emerald-950/90 to-slate-900 border-2 border-emerald-500/80 p-3 text-center shadow-lg shadow-emerald-950/50">
                          <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Ready</div>
                          <div className="text-2xl font-black text-emerald-300">#1040</div>
                          <div className="text-[10px] text-emerald-400/80 mt-0.5 font-mono">Takeaway</div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-b from-emerald-950/90 to-slate-900 border border-emerald-600/60 p-3 text-center">
                          <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Ready</div>
                          <div className="text-2xl font-black text-emerald-300">#1041</div>
                          <div className="text-[10px] text-emerald-400/80 mt-0.5 font-mono">Table 09</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Matches the live customer display screen running in restaurants at /customer-display.
                  </span>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <span>View Operations Dashboard</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 4: REAL RESTAURANT OPERATIONS DASHBOARD (Matches /dashboard) */}
            {activeView === 'dashboard' && (
              <div className="p-4 sm:p-6 min-h-[400px] bg-slate-950 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Operational Dashboard • The Grand Bistro
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex h-7 rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs">
                        <button
                          onClick={() => setDashboardPeriod('day')}
                          className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                            dashboardPeriod === 'day' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => setDashboardPeriod('month')}
                          className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                            dashboardPeriod === 'month' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          This Month
                        </button>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Live Sync: Active
                      </span>
                    </div>
                  </div>

                  {/* 4 Dashboard Metric Tiles (matching real dashboard stats) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Net Sales</span>
                        <Banknote className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        {dashboardPeriod === 'day' ? (fired ? `₹${48920 + total}.00` : '₹48,920.00') : '₹12,48,600.00'}
                      </div>
                      <div className="text-[10px] text-emerald-300/80 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> +14.2% vs yesterday
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-blue-500/30">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Running Orders</span>
                        <ChefHat className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-xl font-bold font-mono text-white">
                        {dashboardPeriod === 'day' ? (fired ? '15 Active' : '14 Active') : '482 Orders'}
                      </div>
                      <div className="text-[10px] text-blue-300/80 mt-1">4 pending kitchen tickets</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-500/30">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Tables Occupied</span>
                        <LayoutGrid className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="text-xl font-bold font-mono text-white">8 / 14 (57%)</div>
                      <div className="text-[10px] text-purple-300/80 mt-1">Avg turn: 28 min</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-teal-500/30">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Average Ticket (AOV)</span>
                        <TrendingUp className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="text-xl font-bold font-mono text-white">₹612.00</div>
                      <div className="text-[10px] text-teal-300/80 mt-1">78 Completed Bills</div>
                    </div>
                  </div>

                  {/* Operational Recent Feed & Top Moving Items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-slate-400 font-bold mb-2 flex items-center justify-between">
                        <span>RECENT LIVE ORDERS</span>
                        <span className="text-[10px] text-orange-400">Real-Time</span>
                      </div>
                      <div className="space-y-2">
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                          <span>#1042 • Table 04 (Dine-in)</span>
                          <span className="text-emerald-400 font-bold">₹{total} • {kdsBumped ? 'Ready' : 'In Prep'}</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                          <span>#1041 • Table 09 (Takeaway)</span>
                          <span className="text-sky-400 font-bold">₹890 • Ready</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                          <span>#1040 • Table 02 (Dine-in)</span>
                          <span className="text-slate-400">₹1,420 • Settled (UPI)</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-slate-400 font-bold mb-2 flex items-center justify-between">
                        <span>TOP MOVING DISHES TODAY</span>
                        <span className="text-[10px] text-emerald-400">High Velocity</span>
                      </div>
                      <div className="space-y-2">
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                          <span className="text-slate-200">Wood-Fired Margherita</span>
                          <span className="text-orange-400 font-bold">34 sold • ₹11,560</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                          <span className="text-slate-200">Cold Brew Double Espresso</span>
                          <span className="text-orange-400 font-bold">28 sold • ₹5,040</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                          <span className="text-slate-200">Truffle Hand-Cut Fries</span>
                          <span className="text-orange-400 font-bold">22 sold • ₹3,520</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Matches the exact live reporting view in Order It Up /dashboard.
                  </span>
                  <Link
                    href="/dashboard"
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <span>View Authenticated Dashboard</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Core Capability Pillars */}
        <div className="mt-12 pt-8 border-t border-slate-800/60 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-400">
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <WifiOff className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>100% Offline Durability</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <Printer className="w-4 h-4 text-sky-400 shrink-0" />
            <span>ESC/POS Thermal Printing</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <Cloud className="w-4 h-4 text-orange-400 shrink-0" />
            <span>Cloudflare Edge Sync</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Statutory Tax & Tally Export</span>
          </div>
        </div>
      </div>
    </section>
  );
}
