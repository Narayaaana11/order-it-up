'use client';

import React from 'react';
import Link from 'next/link';
import {
  WifiOff,
  Printer,
  Cloud,
  Flame,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Database,
  Layers,
  Zap,
  Globe2,
  FileSpreadsheet,
  Receipt,
  Cpu,
} from 'lucide-react';

const FEATURES = [
  {
    icon: WifiOff,
    tag: 'Fault-Tolerant Engine',
    title: 'Atomic Offline Durability',
    headline: 'Never lose a bill when your internet or Wi-Fi drops.',
    description:
      'Every order, item customization, and payment settlement writes directly to a high-speed local SQLite database before any network call. Your cashier stations stay 100% operational during telecom outages.',
    whoBenefits: 'Cashiers & Store Managers during peak rush hours',
    benefitStats: '0ms network delay on bill settlement',
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Printer,
    tag: 'Hardware Drivers',
    title: 'ESC/POS Thermal Printing & Drawer Pulse',
    headline: 'Direct hardware connection without third-party printer spoolers.',
    description:
      'Built-in raw ESC/POS command generator supporting 80mm and 58mm thermal paper printers over USB, Ethernet LAN, and Bluetooth. Automatically triggers cash drawer solenoid pulse upon cash tender.',
    whoBenefits: 'Front Desk Cashiers & Fast-Casual Counters',
    benefitStats: 'Sub-second receipt feed & automatic cut',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/10',
  },
  {
    icon: Cloud,
    tag: 'Cloudflare Edge',
    title: 'Central Master Catalog & Multi-Branch Overrides',
    headline: 'Manage 5 or 50 outlets without spreadsheet chaos.',
    description:
      'Author dishes, categories, and tax rates once at headquarters. Selectively override pricing or toggle dish availability for specific branches to account for local ingredient costs and footfall.',
    whoBenefits: 'Franchise Directors & Operations Heads',
    benefitStats: '1-click global menu sync to all stations',
    color: 'text-orange-400',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Flame,
    tag: 'Kitchen Efficiency',
    title: 'Station-Specific Kitchen Display (KDS)',
    headline: 'Route courses directly to Bar, Grill, or Salad lines.',
    description:
      'Ditch paper tickets for clean high-contrast kitchen displays. Items route to appropriate prep stations with color-coded preparation timers, eliminating verbal order shouting and ticket loss.',
    whoBenefits: 'Head Chefs, Line Cooks & Food Runners',
    benefitStats: 'Up to 14 minutes saved per dinner table turn',
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Smartphone,
    tag: 'Floor Mobility',
    title: 'Mobile Waiter Ordering with 6-Digit PIN Pairing',
    headline: 'Turn any Android or iOS device into a waiter terminal.',
    description:
      'Waitstaff enroll handhelds in seconds by entering a 6-digit PIN. Take orders at the guest table, select complex modifiers (e.g., extra crispy, almond milk), and fire directly to the kitchen.',
    whoBenefits: 'Floor Waitstaff & Dining Room Captains',
    benefitStats: 'Zero-configuration pairing in under 10 seconds',
    color: 'text-indigo-400',
    border: 'border-indigo-500/20',
    bg: 'bg-indigo-500/10',
  },
  {
    icon: FileSpreadsheet,
    tag: 'Statutory Compliance',
    title: 'Statutory Tax Engine & Tally XML Export',
    headline: 'Audit-ready financial ledgers with zero manual bookkeeping.',
    description:
      'Automatic calculation of regional taxes (India GST CGST/SGST/IGST, VAT, and Sales Tax). At the end of each shift or month, generate compliant Tally XML files for instant import into accounting software.',
    whoBenefits: 'Accountants & Financial Controllers',
    benefitStats: '1-click export of verified cash and tax ledgers',
    color: 'text-rose-400',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/10',
  },
];

export default function MarketingFeaturesGrid() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span>Core Engineered Pillars</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Engineered for Reliability. Built for High Velocity.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Order It Up solves the real operational bottlenecks that cost restaurants revenue: frozen registers, lost kitchen slips, and end-of-day register discrepancies.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 sm:p-8 flex flex-col justify-between hover:border-slate-700 hover:bg-slate-900/80 transition-all duration-300 group shadow-lg shadow-black/40"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`w-12 h-12 rounded-2xl ${feature.bg} ${feature.border} border flex items-center justify-center ${feature.color} group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                      {feature.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    {feature.title}
                  </h3>

                  <p className="text-xs font-semibold text-slate-300 mt-1.5 mb-3">
                    {feature.headline}
                  </p>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Target Role:</span>
                    <span className="text-slate-200 font-medium">{feature.whoBenefits}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Impact:</span>
                    <span className="text-emerald-400 font-bold">{feature.benefitStats}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
