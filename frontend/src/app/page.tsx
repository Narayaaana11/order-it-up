'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UtensilsCrossed,
  Monitor,
  Cloud,
  Smartphone,
  ShieldCheck,
  Zap,
  Printer,
  ChevronRight,
  TrendingUp,
  Store,
  Layers,
  ArrowRight,
  Sparkles,
  WifiOff,
  CheckCircle2,
  Lock,
  Globe2,
  Download,
  ExternalLink,
  Users
} from 'lucide-react';
import { isElectronEnvironment } from '@/lib/api';

export default function SaaSMainPage() {
  const router = useRouter();
  const [activePlatformTab, setActivePlatformTab] = useState<'desktop' | 'cloud' | 'mobile'>('desktop');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // When loaded inside the Electron desktop application, automatically direct to POS dashboard
    if (isElectronEnvironment()) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">Order It Up</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">SaaS Cloud</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <a href="#platforms" className="hover:text-orange-400 transition-colors">3 Platforms</a>
            <a href="#features" className="hover:text-orange-400 transition-colors">Enterprise Features</a>
            <a href="#cloud-portal" className="hover:text-orange-400 transition-colors">Cloud HQ</a>
            <Link href="/pos" className="hover:text-orange-400 transition-colors flex items-center gap-1.5">
              <span>Web POS</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">Browser</span>
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
            >
              Owner Login
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-orange-500/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[250px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-orange-500/30 text-xs font-medium text-orange-300 mb-8 backdrop-blur-sm shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span>Tri-Platform Restaurant POS: Desktop • Cloud • Mobile</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight max-w-5xl mx-auto">
            The Modern <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">Offline-First</span> Operating System for Restaurants
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto font-normal leading-relaxed">
            Run lightning-fast counter billing offline with hardware thermal printing, orchestrate multi-branch menus and live analytics in the cloud, and empower captains with mobile order-taking.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 rounded-xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>Register Restaurant Free</span>
              <ChevronRight className="w-5 h-5" />
            </Link>

            <Link
              href="/pos"
              className="w-full sm:w-auto px-7 py-4 text-base font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Monitor className="w-5 h-5 text-orange-400" />
              <span>Launch Browser Web POS</span>
            </Link>

            <Link
              href="/cloud-portal"
              className="w-full sm:w-auto px-7 py-4 text-base font-semibold text-slate-300 hover:text-white bg-slate-950/60 hover:bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Cloud className="w-5 h-5 text-sky-400" />
              <span>Cloud HQ Demo</span>
            </Link>
          </div>

          {/* Social Proof / Key Capabilities Pills */}
          <div className="mt-14 pt-8 border-t border-slate-800/60 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-400">
            <div className="flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4 text-emerald-400" />
              <span>100% Offline Durability</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Printer className="w-4 h-4 text-sky-400" />
              <span>ESC/POS Thermal Printing</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Cloud className="w-4 h-4 text-orange-400" />
              <span>Multi-Branch Cloud Sync</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Flutter Handheld Ordering</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Tri-Platform Interactive Showcase */}
      <section id="platforms" className="py-20 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs uppercase font-bold tracking-widest text-orange-400 mb-2">Three Form Factors • One Cohesive System</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">Choose How Your Team Works</h3>
            <p className="mt-3 text-slate-400">
              Counter terminals, cloud managers, and mobile waitstaff communicate in real-time with automated edge synchronization.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
              <button
                onClick={() => setActivePlatformTab('desktop')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activePlatformTab === 'desktop'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>1. Desktop POS App</span>
              </button>

              <button
                onClick={() => setActivePlatformTab('cloud')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activePlatformTab === 'cloud'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>2. Cloud Application</span>
              </button>

              <button
                onClick={() => setActivePlatformTab('mobile')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activePlatformTab === 'mobile'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>3. Mobile Companion</span>
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
            {activePlatformTab === 'desktop' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold mb-4">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Offline-First Counter Billing</span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
                    Desktop POS: Uncompromising Speed & Hardware Integration
                  </h4>
                  <p className="mt-4 text-slate-400 leading-relaxed">
                    Designed for heavy-traffic cash counters, bar checkouts, and main cashier stations. Never freezes, never stalls during internet outages.
                  </p>

                  <ul className="mt-6 space-y-3.5 text-sm text-slate-300">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Local SQLite Architecture:</strong> All bills, orders, and customer records persist locally with atomic ACID safety.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>ESC/POS Hardware Integration:</strong> Native direct print drivers for 80mm/58mm USB, LAN, and Bluetooth thermal printers with automated cash drawer pulse.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Kitchen Station KDS Routing:</strong> Direct local WebSocket broadcast to bar and grill kitchen screens.</span>
                    </li>
                  </ul>

                  <div className="mt-8 flex items-center gap-4">
                    <Link
                      href="/auth/register"
                      className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/20 transition-colors flex items-center gap-2"
                    >
                      <span>Install on Windows, Mac, or Linux</span>
                      <Download className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="ml-2 text-xs font-mono text-slate-400">Order It Up Desktop v1.0.0</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">SQLite Connected</span>
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-slate-300 flex justify-between items-center">
                      <span>Order #104 (Dine-in • Table 4)</span>
                      <span className="text-emerald-400 font-bold">₹1,250.00</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-slate-300 flex justify-between items-center">
                      <span>Thermal Printer 80mm</span>
                      <span className="text-sky-400">Ready (USB)</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-slate-300 flex justify-between items-center">
                      <span>Cash Drawer Pulse</span>
                      <span className="text-amber-400">Triggered on Cash Tender</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePlatformTab === 'cloud' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold mb-4">
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Cloudflare Edge & Serverless D1</span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
                    Cloud Application: Real-Time Multi-Branch Command Center
                  </h4>
                  <p className="mt-4 text-slate-400 leading-relaxed">
                    Access your entire hospitality chain from any smartphone, tablet, or browser. Review live sales, push menu updates, and manage tax summaries.
                  </p>

                  <ul className="mt-6 space-y-3.5 text-sm text-slate-300">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Multi-Outlet Analytics:</strong> Compare branch performance, average tickets, and top-selling velocity across outlets.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Central Master Catalog:</strong> Maintain signature dishes globally while setting branch-specific pricing overrides.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Browser Cloud POS:</strong> Take orders and bill directly in Google Chrome without downloading native software.</span>
                    </li>
                  </ul>

                  <div className="mt-8 flex items-center gap-4">
                    <Link
                      href="/cloud-portal"
                      className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition-colors flex items-center gap-2"
                    >
                      <span>Explore Cloud HQ</span>
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold text-white">TasteCraft Group (2 Outlets Active)</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">Cloudflare D1</span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-white">Connaught Place (Main)</div>
                        <div className="text-slate-400 text-[11px]">42 Orders • 78% Share</div>
                      </div>
                      <span className="text-emerald-400 font-bold text-sm">₹38,420</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-white">CyberHub Gurugram (Franchise)</div>
                        <div className="text-slate-400 text-[11px]">28 Orders • 22% Share</div>
                      </div>
                      <span className="text-emerald-400 font-bold text-sm">₹19,850</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePlatformTab === 'mobile' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold mb-4">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Flutter Android & iOS Companion</span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
                    Mobile Companion: Table-Side Ordering for Waitstaff & Captains
                  </h4>
                  <p className="mt-4 text-slate-400 leading-relaxed">
                    Equip floor waiters with handheld devices. Take guest orders directly at the table, fire courses straight to kitchen printers, and collect digital tips.
                  </p>

                  <ul className="mt-6 space-y-3.5 text-sm text-slate-300">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Zero-Config 6-Digit Pairing:</strong> Waiters enroll mobile devices in seconds by scanning a QR code or entering a 6-digit PIN.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Modifier & Add-on Selector:</strong> Custom spice levels, dietary preferences, and drink mixers configured on the fly.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Table Turn Velocity:</strong> Instant kitchen ticket firing reduces dining cycle time by up to 18 minutes per table.</span>
                    </li>
                  </ul>

                  <div className="mt-8 flex items-center gap-4">
                    <Link
                      href="/cloud-portal"
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-amber-500/20 transition-colors flex items-center gap-2"
                    >
                      <span>Generate Waiter Pairing PIN</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                    <Smartphone className="w-8 h-8" />
                  </div>
                  <h5 className="font-bold text-white text-base">Flutter Companion Handheld</h5>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Pair any Android phone or tablet instantly using zero-config cryptographic code enrollment.
                  </p>
                  <div className="mt-6 p-4 bg-slate-900/90 rounded-xl border border-slate-800 inline-block font-mono text-sm tracking-widest text-amber-400 font-bold">
                    PIN: 849 201
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Feature Highlights Grid */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs uppercase font-bold tracking-widest text-orange-400 mb-2">Engineered for Reliability</h2>
          <h3 className="text-3xl font-extrabold text-white">Built for High-Volume Food & Beverage Operations</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-5 border border-orange-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Sub-Second Counter Billing</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Keyboard shortcuts, barcode scanning, custom modifier grids, and lightning fast touch cart mechanics designed for QSR lines.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-5 border border-sky-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Asymmetric Security & Anti-Fraud</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ed25519 commercial licensing, scrypt edge credentials, tamper-resistant sync signatures, and cash drawer variance tracking.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 border border-emerald-500/20">
              <Globe2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Global Compliance & Regional Tax</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Out-of-the-box support for GST India (CGST/SGST/IGST), VAT, Sales Tax, multi-currency formatting, and Tally XML ledger exports.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Bottom Call to Action */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to upgrade your restaurant operations?
          </h2>
          <p className="mt-4 text-base text-slate-400 max-w-xl mx-auto">
            Create your restaurant organization in under 60 seconds. Free trial included with full multi-branch cloud sync.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-base font-bold shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 transition-all transform hover:-translate-y-0.5"
            >
              Start Your Free Restaurant Trial
            </Link>
            <Link
              href="/pos"
              className="w-full sm:w-auto px-7 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-base font-semibold text-slate-200 transition-colors"
            >
              Try Web POS Directly
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="py-12 border-t border-slate-900 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
              O
            </div>
            <span className="text-slate-400 font-medium">Order It Up • Restaurant Operating System</span>
          </div>
          <div>
            <span>Desktop POS • Cloudflare Edge • Flutter Mobile Companion</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
