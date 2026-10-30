'use client';

import React from 'react';
import Link from 'next/link';
import {
  UserPlus,
  BookOpen,
  Monitor,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const STEPS = [
  {
    step: '01',
    icon: UserPlus,
    title: 'Register Organization & Store Details',
    duration: 'Under 60 seconds',
    description:
      'Sign up with your restaurant name and owner credentials. Select your country, operational currency (₹ INR, $ USD, AED, £ GBP), business timezone, and service model (QSR, Café, or Fine Dining).',
    badge: 'Self-Serve SaaS',
    color: 'text-orange-400',
    border: 'border-orange-500/20',
  },
  {
    step: '02',
    icon: BookOpen,
    title: 'Configure Menu & Statutory Taxes',
    duration: 'Self-guided',
    description:
      'Organize your catalog into categories, create dishes with dietary tags, and configure tax rules (CGST/SGST 5%, VAT, or Service Charges). Customize modifiers and spice levels.',
    badge: 'Central Catalog',
    color: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  {
    step: '03',
    icon: Monitor,
    title: 'Launch Counter Stations & Connect Hardware',
    duration: 'Instant',
    description:
      'Open the Web POS immediately in any modern browser, or run the native desktop terminal on your counter PC. Plug in your USB or LAN 80mm ESC/POS thermal printer and cash drawer.',
    badge: 'Zero Hardware Lock-In',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
  },
  {
    step: '04',
    icon: Rocket,
    title: 'Fire Kitchen Orders & Monitor Cloud HQ',
    duration: 'Live Operations',
    description:
      'Punch orders at the counter or tables. Tickets instantly dispatch to kitchen display screens (KDS), bills print with thermal speed, and transactions synchronize to Cloud HQ in real time.',
    badge: 'Offline Durability',
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
];

export default function MarketingHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-slate-950 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Frictionless Onboarding</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            From Sign-Up to First Bill in 4 Simple Steps
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            No mandatory 4-week sales cycles, no proprietary tablet leases. Start running your restaurant operations on your own terms.
          </p>
        </div>

        {/* 4 Steps Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl border border-slate-800/90 bg-slate-900/60 p-6 sm:p-7 flex flex-col justify-between hover:border-slate-700 transition-all duration-300 shadow-lg relative"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-2xl font-black font-mono text-slate-700">
                      {s.step}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                      {s.duration}
                    </span>
                  </div>

                  <div
                    className={`w-11 h-11 rounded-2xl bg-slate-950 border ${s.border} flex items-center justify-center ${s.color} mb-4`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="text-base font-bold text-white mb-2 leading-snug">
                    {s.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {s.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-orange-400 font-semibold">
                    {s.badge}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Action Prompt */}
        <div className="mt-12 text-center">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/25 transition-all transform hover:-translate-y-0.5"
          >
            <span>Start Step 1: Create Organization Free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
