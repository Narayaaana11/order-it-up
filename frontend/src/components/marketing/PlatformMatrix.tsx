'use client';

import React from 'react';
import Link from 'next/link';
import {
  Monitor,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  WifiOff,
  KeyRound,
} from 'lucide-react';

export default function MarketingPlatformMatrix() {
  return (
    <section id="platforms" className="py-20 lg:py-28 bg-slate-900/30 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Monitor className="w-3.5 h-3.5 text-orange-400" />
            <span>Tri-Platform Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            One Cohesive System Across Three Form Factors
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Deploy Order It Up on the devices you already own. From heavy-duty cashier counter PCs to mobile waiter tablets and cloud browsers.
          </p>
        </div>

        {/* 3 Platforms Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 1. Web Browser Application */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 sm:p-8 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Monitor className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ● Instant Access
                </span>
              </div>

              <h3 className="text-xl font-bold text-white">1. Web Browser Cloud POS</h3>
              <p className="text-xs font-medium text-orange-400 mt-1 mb-4">
                Zero-Install Hospitality Console
              </p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                Run checkout directly inside Google Chrome, Safari, or Microsoft Edge on any laptop, desktop, or iPad. Perfect for quick billing without software installation.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <span>Interactive touch catalog & order creation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <span>Browser printer dialog integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <span>Instant demo trial without sign-up barrier</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-800/80">
              <Link
                href="/pos"
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <span>Launch Browser Web POS</span>
                <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
              </Link>
            </div>
          </div>

          {/* 2. Desktop POS Terminal */}
          <div className="rounded-3xl border border-orange-500/30 bg-slate-950 p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-orange-500/5 relative">
            <div className="absolute -top-3 right-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              Cashier Workhorse
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <WifiOff className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  SQLite Offline-First
                </span>
              </div>

              <h3 className="text-xl font-bold text-white">2. Dedicated Desktop POS</h3>
              <p className="text-xs font-medium text-sky-400 mt-1 mb-4">
                Hardware-Accelerated Counter Terminal
              </p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                Engineered in Electron with native SQLite persistence for busy cash desks. Never stalls, never drops sales during network failure, and triggers physical cash drawers.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Direct USB & LAN ESC/POS thermal printing</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Sub-second barcode and SKU scanner support</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Local SQLite atomic database durability</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-800/80">
              <Link
                href="/auth/register"
                className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <span>Register to Setup Station</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* 3. Mobile Waitstaff Companion */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 sm:p-8 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  PIN Enrollment
                </span>
              </div>

              <h3 className="text-xl font-bold text-white">3. Mobile Waiter Companion</h3>
              <p className="text-xs font-medium text-amber-400 mt-1 mb-4">
                Table-Side Ordering for Floor Servers
              </p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                Equip waitstaff with handheld smartphones or tablets. Servers pair instantly by entering a 6-digit PIN to punch table orders, customize notes, and fire kitchen courses.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>6-Digit cryptographic PIN server pairing</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Instant modifier & allergy notes selector</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Cuts dining turn cycle by up to 18 minutes</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-800/80">
              <Link
                href="/cloud-portal"
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Pair Handheld via Cloud HQ</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
