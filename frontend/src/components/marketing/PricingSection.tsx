'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Mail,
  Store,
  Building2,
} from 'lucide-react';

export default function MarketingPricingSection() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-slate-950 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Transparent SaaS Model</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Start Free. Scale as Your Outlets Expand.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Every new restaurant organization receives an unrestricted 14-day trial with full access to POS billing, kitchen KDS, and Cloud HQ.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: 14-Day Full Access Free Trial */}
          <div className="rounded-3xl border border-orange-500/40 bg-slate-900/60 p-6 sm:p-10 flex flex-col justify-between shadow-2xl shadow-orange-500/5 relative">
            <div className="absolute -top-3.5 right-8 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Full-Featured Free Trial</h3>
                  <p className="text-xs text-slate-400">For single cafés, bars, and fast-casual outlets</p>
                </div>
              </div>

              <div className="mt-4 mb-6 pb-6 border-b border-slate-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">14 Days Free</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  No credit card required upfront. Instant activation upon registration.
                </p>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Full access to Web POS terminal and offline desktop billing</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Kitchen Display System (KDS) with station routing</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>ESC/POS thermal receipt printing & cash drawer pulse</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Table floorplan editor and contactless QR table codes</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Statutory tax splitting and Tally XML ledger export</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <Link
                href="/auth/register"
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
              >
                <span>Start Free 14-Day Trial</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Enterprise & Multi-Branch Franchises */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-10 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Enterprise & Multi-Branch</h3>
                  <p className="text-xs text-slate-400">For franchise groups, cloud kitchens, and chains</p>
                </div>
              </div>

              <div className="mt-4 mb-6 pb-6 border-b border-slate-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">Custom Rollout</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Tailored onboarding, volume licensing, and dedicated deployment support.
                </p>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Multi-outlet franchise leaderboard and centralized cloud analytics</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Inter-branch inventory transfer and warehouse dispatch routing</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Branch-specific menu pricing overrides and seasonal catalogs</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Custom hardware audit (printers, barcode scanners, cash drawers)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Assisted legacy database migration and accountant onboarding</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <a
                href="mailto:commercial@orderitup.com?subject=Enterprise%20Restaurant%20Inquiry"
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold border border-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4 text-sky-400" />
                <span>Contact Commercial Team</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
