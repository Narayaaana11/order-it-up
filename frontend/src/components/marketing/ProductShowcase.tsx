'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Monitor,
  Flame,
  Cloud,
  LayoutGrid,
  Boxes,
  CheckCircle2,
  ArrowRight,
  Store,
  Truck,
} from 'lucide-react';

type ShowcaseTab = 'pos' | 'kds' | 'cloud' | 'tables' | 'inventory';

export default function MarketingProductShowcase() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('pos');

  return (
    <section id="showcase" className="py-20 lg:py-28 bg-slate-900/40 border-y border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <span>Verified System Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Designed for the Realities of High-Volume Hospitality
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Explore the core operational engines powering Order It Up across counter checkouts, busy kitchen lines, and franchise head offices.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex justify-center mb-10 overflow-x-auto pb-2 scrollbar-none">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'pos'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>1. Counter POS</span>
            </button>

            <button
              onClick={() => setActiveTab('kds')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'kds'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>2. Kitchen KDS</span>
            </button>

            <button
              onClick={() => setActiveTab('cloud')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'cloud'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>3. Cloud HQ</span>
            </button>

            <button
              onClick={() => setActiveTab('tables')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'tables'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>4. Tables & QR</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>5. Inventory & Transfers</span>
            </button>
          </div>
        </div>

        {/* Tab Content Cards */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* TAB 1: POS BILLING */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Sub-Second Counter Checkout</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Atomic SQLite Speed with Zero Cloud Latency
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Engineered specifically for peak dining hours. Cashiers can punch orders, customize modifiers (e.g. Extra Cheese, Less Spice), split tender across cash, UPI, and card, and kick open the cash drawer instantly.
                </p>

                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Direct ESC/POS Driver:</strong> Native ESC/POS USB, LAN, and Bluetooth 80mm/58mm thermal receipt printing.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Split Billing & Tenders:</strong> Divide orders by seat, item, or percentage with custom cash drawer variance logs.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Barcode & SKU Scanner:</strong> Instant SKU resolution for quick-service retail merchandise and packaged goods.</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Link
                    href="/pos"
                    className="inline-flex items-center gap-2 text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <span>Test Drive Live Web POS Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Visual Mockup for POS */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 text-xs">
                  <span className="font-mono text-slate-400">Order It Up • Quick Service POS</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    ESC/POS USB Ready
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">Active Register Float</div>
                    <div className="text-lg font-bold font-mono text-white mt-0.5">₹2,500.00</div>
                    <div className="text-[10px] text-emerald-400 mt-1">Shift Opened: 08:00 AM</div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">Shift Total Settled</div>
                    <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">₹34,890.00</div>
                    <div className="text-[10px] text-slate-400 mt-1">54 Transactions Completed</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex justify-between items-center text-slate-200">
                    <span>1× Wood-Fired Margherita (Truffle Oil)</span>
                    <span className="text-orange-400 font-bold">₹380.00</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex justify-between items-center text-slate-200">
                    <span>2× Double Espresso Cold Brew</span>
                    <span className="text-orange-400 font-bold">₹360.00</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex justify-between items-center text-slate-200">
                    <span>1× Peri-Peri Hand Cut Fries</span>
                    <span className="text-orange-400 font-bold">₹160.00</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">Tender: Split (UPI ₹500 + Cash ₹400)</span>
                  <span className="text-emerald-400 font-bold">Cash Drawer Pulsed ✓</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KITCHEN KDS */}
          {activeTab === 'kds' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Station-Based Routing</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Kitchen Display System: Eliminate Lost Paper Tickets
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Fire tickets directly from waitstaff handhelds or counter POS to dedicated kitchen screens (Grill, Bar, Salad, Bakery). Color-coded elapsed timers keep chefs aware of ticket velocity.
                </p>

                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Item-Level Station Splitting:</strong> Drinks route to Bar display while entrees route to hot grill stations.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>One-Tap Fulfillment:</strong> Chefs tap items or entire tickets to notify floor servers that orders are ready.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Local WebSocket Sync:</strong> Zero latency between cash counter and kitchen display.</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Link
                    href="/kds"
                    className="inline-flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <span>Inspect KDS Display Module</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Visual Mockup for KDS */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Ticket 1 */}
                <div className="p-4 rounded-xl border border-amber-500/40 bg-slate-900/90 shadow-xl">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2.5">
                    <span className="text-xs font-bold text-white">#108 • Table 12 (Dine-in)</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                      04:12 min
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-white font-medium">
                      <span>2× Signature Smash Burger</span>
                      <span className="text-amber-400">Grill</span>
                    </div>
                    <div className="text-[11px] text-amber-300/80 pl-3">↳ Modifier: Well Done, No Onion</div>
                    <div className="flex justify-between text-white font-medium">
                      <span>1× Truffle Parmesan Fries</span>
                      <span className="text-amber-400">Fryer</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Server: Priya</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-[11px]">
                      Preparing
                    </span>
                  </div>
                </div>

                {/* Ticket 2 */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2.5">
                    <span className="text-xs font-bold text-white">#109 • Takeaway Counter</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      01:30 min
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-white font-medium">
                      <span>2× Cold Brew Espresso</span>
                      <span className="text-sky-400">Bar</span>
                    </div>
                    <div className="flex justify-between text-white font-medium">
                      <span>1× Blueberry Cheesecake</span>
                      <span className="text-emerald-400">Pastry</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Cashier: Arjun</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                      Ready for Pack
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD HQ */}
          {activeTab === 'cloud' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold">
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Cloudflare Edge Multi-Tenant</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Franchise & Multi-Branch Real-Time HQ
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Monitor branch revenue, top-selling menu velocity, and staff performance from anywhere in the world on phone, tablet, or browser without installing desktop software.
                </p>

                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span><strong>Central Master Catalog:</strong> Maintain global recipes and push outlet-specific price overrides with a single click.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span><strong>Outlet Leaderboard:</strong> Live comparative metrics between company-owned and franchisee outlets.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span><strong>Statutory Tax Ledger:</strong> Export consolidated CGST/SGST/VAT audits directly into Tally XML formats.</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Link
                    href="/cloud-portal"
                    className="inline-flex items-center gap-2 text-sm font-bold text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <span>Access Cloud HQ Command Center</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Visual Mockup for Cloud HQ */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white">Culinary Arts Group (2 Outlets Active)</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    Live Edge Rollup
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">Total Consolidated Revenue</div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">₹1,84,350.00</div>
                    <div className="text-[10px] text-slate-400 mt-1">Today Across 2 Outlets</div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">Average Ticket Size</div>
                    <div className="text-xl font-bold font-mono text-white mt-0.5">₹642.00</div>
                    <div className="text-[10px] text-emerald-400 mt-1">287 Completed Tickets</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white">Connaught Place (Main Branch)</div>
                      <div className="text-slate-400 text-[11px]">172 Orders • ₹1,18,200 (64% share)</div>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold text-sm">₹1,18,200</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white">CyberHub Gurugram (Franchise)</div>
                      <div className="text-slate-400 text-[11px]">115 Orders • ₹66,150 (36% share)</div>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold text-sm">₹66,150</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TABLES & QR */}
          {activeTab === 'tables' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Interactive Floorplan & QR</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Visual Table Seating & Contactless QR Ordering
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Design dynamic floorplans matching your dining zones. Color-coded table states show dining progress in real time, while patrons scan table QR codes to browse the digital menu.
                </p>

                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Live State Colors:</strong> Green (Available), Amber (Dining / Course active), Blue (Bill printed).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Table Merging & Splitting:</strong> Accommodate large banquet groups or split tables with a simple drag.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Table-Specific QR Codes:</strong> Generates unique URLs for each table for mobile ordering.</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Link
                    href="/qr"
                    className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>View Contactless QR Menu Experience</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Visual Mockup for Tables */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 text-xs">
                  <span className="font-semibold text-white">Main Dining Hall (Zone A)</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Vacant
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Dining
                    </span>
                    <span className="flex items-center gap-1 text-sky-400">
                      <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Billed
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 text-center">
                    <div className="text-base font-bold text-white">T-01</div>
                    <div className="text-[10px] text-emerald-400 font-medium mt-1">4 Guests • Vacant</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-center shadow-md shadow-amber-500/5">
                    <div className="text-base font-bold text-white">T-02</div>
                    <div className="text-[10px] text-amber-400 font-medium mt-1">Dining • 32 min</div>
                    <div className="text-[10px] font-mono text-slate-300 mt-1">₹1,420</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 text-center shadow-md shadow-sky-500/5">
                    <div className="text-base font-bold text-white">T-03</div>
                    <div className="text-[10px] text-sky-400 font-medium mt-1">Billed • Awaiting</div>
                    <div className="text-[10px] font-mono text-slate-300 mt-1">₹890</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-center">
                    <div className="text-base font-bold text-white">T-04</div>
                    <div className="text-[10px] text-amber-400 font-medium mt-1">Dining • 14 min</div>
                    <div className="text-[10px] font-mono text-slate-300 mt-1">₹680</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 text-center">
                    <div className="text-base font-bold text-white">T-05</div>
                    <div className="text-[10px] text-emerald-400 font-medium mt-1">6 Guests • Vacant</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 text-center">
                    <div className="text-base font-bold text-white">T-06</div>
                    <div className="text-[10px] text-emerald-400 font-medium mt-1">2 Guests • Vacant</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INVENTORY & TRANSFERS */}
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold">
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Stock Control & Depletion</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Automated Ingredient Depletion & Inter-Branch Transfers
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Track stock at the raw ingredient level. Every settled pizza or cocktail automatically deducts cheese, flour, or liquor units. Transfer surplus stock between branches with full dispatch verification.
                </p>

                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>Bill-Level Auto-Depletion:</strong> Sub-recipe ingredients decrement automatically upon checkout.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>Reorder Threshold Alerts:</strong> Highlighting low coffee beans, milk crates, or packaging boxes before they run out.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>Outlet-to-Outlet Stock Transfers:</strong> Generate transfer notes with dispatched and received status tracking.</span>
                  </li>
                </ul>
              </div>

              {/* Visual Mockup for Inventory */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 text-xs">
                  <span className="font-semibold text-white">Central Warehouse & Transfer Manifest</span>
                  <span className="text-slate-400 font-mono">Transfer #TR-804</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 mb-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="font-semibold text-white">CP Warehouse → CyberHub Outlet</div>
                      <div className="text-slate-400 text-[11px]">Dispatched: Today 11:30 AM</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold text-[11px]">
                    In Transit
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                    <span className="text-slate-200">Arabica Espresso Beans (Whole)</span>
                    <span className="text-white font-bold">25.0 kg</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                    <span className="text-slate-200">Imported Mozzarella Blocks</span>
                    <span className="text-white font-bold">40.0 kg</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex justify-between items-center">
                    <span className="text-slate-200">Zero-Waste Takeaway Boxes (800ml)</span>
                    <span className="text-white font-bold">500 units</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
