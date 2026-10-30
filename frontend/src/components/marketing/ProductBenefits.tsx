'use client';

import React from 'react';
import {
  ShieldCheck,
  Zap,
  Lock,
  Cpu,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: WifiOff,
    title: 'Offline Resilient by Architecture',
    subtitle: 'Zero reliance on 100% ISP uptime',
    description:
      'Unlike cloud-only POS systems that stall the moment an internet cable is cut, Order It Up persists transactions locally with ACID atomic safety. Continue billing and printing receipts unabated.',
    tag: 'Architectural Guarantee',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  {
    icon: Zap,
    title: 'Sub-Second Line Checkout Velocity',
    subtitle: 'Engineered for high-volume counter queues',
    description:
      'Every fraction of a second matters when 30 guests are waiting in line. With keyboard shortcuts, instant barcode scanning, and direct printer bytecode generation, checkout feels instantaneous.',
    tag: 'Performance Focused',
    color: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  {
    icon: Lock,
    title: '100% Merchant Data Ownership',
    subtitle: 'Your customer data is never monetized',
    description:
      'We do not sell your sales data, patron telephone numbers, or secret menu pricing to delivery aggregators or third-party advertisers. At any moment, export your complete ledger in standard CSV and Tally XML.',
    tag: 'Privacy Commitment',
    color: 'text-sky-400',
    border: 'border-sky-500/30',
  },
  {
    icon: Cpu,
    title: 'Hardware Freedom & Zero Lock-in',
    subtitle: 'No forced proprietary hardware leases',
    description:
      'Run Order It Up on the Windows PCs, MacBooks, Linux kiosks, or iPads you already own. Plug in standard ESC/POS 80mm thermal receipt printers without proprietary vendor markups.',
    tag: 'Commercial Integrity',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
  },
];

export default function MarketingProductBenefits() {
  return (
    <section className="py-20 lg:py-28 bg-slate-900/40 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
            <span>Built on Commercial Integrity</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Why Modern Restaurants Choose Order It Up
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Transparent architecture, verifiable performance, and zero artificial software constraints.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {BENEFITS.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-slate-900 border ${b.border} flex items-center justify-center ${b.color}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                      {b.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">
                    {b.title}
                  </h3>

                  <p className="text-xs font-semibold text-orange-400 mb-3">
                    {b.subtitle}
                  </p>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {b.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Verifiable in live production testing</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
