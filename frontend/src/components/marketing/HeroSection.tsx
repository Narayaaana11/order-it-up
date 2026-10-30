'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Monitor,
  Cloud,
  ChevronRight,
  WifiOff,
  Printer,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  Clock,
  Flame,
  Check,
  CheckCircle2,
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
  const [activeView, setActiveView] = useState<'pos' | 'kds'>('pos');
  const [fired, setFired] = useState(false);

  const addItem = (id: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
    setFired(false);
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
  };

  const resetCart = () => {
    setCart({
      'item-1': 1,
      'item-2': 1,
    });
    setFired(false);
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
    setTimeout(() => {
      setActiveView('kds');
    }, 600);
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
      {/* Background Ambience & Grid Patterns */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[380px] bg-gradient-to-tr from-orange-600/20 via-amber-500/15 to-rose-500/10 blur-[140px] rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[300px] bg-sky-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Announcement Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-orange-500/30 text-xs font-semibold text-orange-300 backdrop-blur-md shadow-inner hover:border-orange-500/60 transition-colors">
            <span className="flex h-2 w-2 rounded-full bg-orange-400 animate-ping" />
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Next-Gen Restaurant OS: Offline Desktop • Cloud HQ • Mobile Companion</span>
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

        {/* Realistic Interactive POS / KDS Terminal Simulation */}
        <div className="mt-12 max-w-5xl mx-auto">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl shadow-black/80 backdrop-blur-2xl overflow-hidden">
            {/* Terminal Top Window Bar */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800/90 bg-slate-900/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <div className="h-4 w-px bg-slate-800 mx-1" />
                <span className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-orange-400" />
                  <span>Order It Up Station Terminal • Table 04</span>
                </span>
              </div>

              {/* View Toggle (POS vs KDS) */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveView('pos')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeView === 'pos'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Counter POS</span>
                </button>
                <button
                  onClick={() => setActiveView('kds')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeView === 'kds'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Kitchen KDS</span>
                  {fired && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block ml-0.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Interactive Terminal Body */}
            {activeView === 'pos' ? (
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
                {/* Left: Quick Tap Menu Catalog */}
                <div className="p-4 sm:p-6 md:col-span-7 border-b md:border-b-0 md:border-r border-slate-800/80">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Tap Items To Build Live Bill
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
                        <span className="text-xs font-bold text-white">Active Ticket #1042</span>
                        <div className="text-[11px] text-slate-400">Server: Ravi K. • Dine-in</div>
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
                            <span>Order Fired! Routing to KDS...</span>
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
            ) : (
              /* KDS View Simulation */
              <div className="p-4 sm:p-6 min-h-[380px] bg-slate-950 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Kitchen Display System (KDS) • Station: Main Line
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      WebSocket Live Feed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Active Fired Ticket */}
                    <div className="p-3.5 rounded-xl border border-amber-500/40 bg-slate-900/90 shadow-lg shadow-amber-500/5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                        <span className="text-xs font-bold text-white">#1042 • Table 04</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>01:14 min</span>
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(cart).map(([id, qty]) => {
                          const item = SAMPLE_MENU.find((m) => m.id === id);
                          if (!item) return null;
                          return (
                            <div key={id} className="flex justify-between items-center text-slate-200">
                              <span className="font-medium">
                                <span className="font-bold text-amber-400 mr-1.5">{qty}×</span>
                                {item.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.station}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Course: All Items</span>
                        <span className="text-emerald-400 font-bold">In Prep</span>
                      </div>
                    </div>

                    {/* Older Prior Ticket */}
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 opacity-70">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                        <span className="text-xs font-bold text-slate-300">#1041 • Table 09</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ready</span>
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-400">
                        <div>2× Classic Citrus Mocktail</div>
                        <div>1× Truffle Margherita Pizza</div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                        Server: Anita • Picked Up
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Live tickets automatically route to dedicated Bar or Grill kitchen displays.
                  </span>
                  <button
                    onClick={() => setActiveView('pos')}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1"
                  >
                    <span>Switch Back to Counter POS</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
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
