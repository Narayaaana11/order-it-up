'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Monitor, CheckCircle2 } from 'lucide-react';

export default function MarketingCtaSection() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-orange-600/20 via-amber-500/15 to-transparent blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-orange-500/30 text-xs font-semibold text-orange-300 mb-6 backdrop-blur-md">
          <img src="/logo.png" alt="Order It Up" className="w-4 h-4 object-contain rounded" />
          <span>Start Your Free 14-Day Restaurant Trial Today</span>
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
          Run Your Restaurant With{' '}
          <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
            Unstoppable Speed.
          </span>
        </h2>

        <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          Say goodbye to checkout freezes, lost order tickets, and manual accounting headaches. Experience unified offline POS, kitchen KDS, and multi-branch cloud reporting.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Register Restaurant Organization Free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/pos"
            className="w-full sm:w-auto px-7 py-4 text-base font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Monitor className="w-5 h-5 text-orange-400" />
            <span>Launch Web POS Live</span>
          </Link>
        </div>

        {/* Guarantees Row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>No Credit Card Required</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Setup in Under 60 Seconds</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>100% Offline SQLite Resilience</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Pure Merchant Data Ownership</span>
          </span>
        </div>
      </div>
    </section>
  );
}
