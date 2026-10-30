'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileCheck, CheckCircle2, AlertCircle, RefreshCw, Cpu, ShieldCheck } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/85 border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shadow-lg shadow-orange-500/10 group-hover:scale-105 group-hover:border-orange-500/50 transition-transform">
              <img src="/logo.png" alt="Order It Up" className="w-full h-full object-contain rounded-lg" />
            </div>
            <span className="text-lg font-black tracking-tight text-white">Order It Up</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-10 text-center sm:text-left border-b border-slate-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-3">
            <FileCheck className="w-3.5 h-3.5" />
            <span>Commercial Terms of Service</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-400">
            Last Updated: October 30, 2026 • Commercial SaaS Terms
          </p>
        </div>

        <div className="space-y-10 text-sm sm:text-base text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">1. Service Scope & Platform Access</h2>
            </div>
            <p className="mb-3 text-slate-400">
              Order It Up provides restaurant point of sale software across native desktop applications (Windows, macOS, Linux), edge-hosted cloud portals, and mobile companions. By enrolling an organization or station, you agree to comply with these terms.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>You are granted a non-exclusive, revocable license to utilize Order It Up for food, beverage, hospitality, and retail operations.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>You maintain administrative control over user accounts and assigned roles (Owner, Manager, Cashier, Server, Chef, Accountant).</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">2. Offline Durability & Hardware Interfacing</h2>
            </div>
            <p className="mb-3 text-slate-400">
              Order It Up is engineered to permit unabated checkout operations during network disruption through local SQLite transaction storage. While the platform interfaces with standard ESC/POS thermal printers and cash drawers, the merchant is responsible for hardware maintenance, power backup, and local operating system stability.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">3. Tax Calculation & Compliance Disclaimer</h2>
            </div>
            <p className="mb-3 text-slate-400">
              Order It Up provides configurable tax calculation engines supporting regional tax regimes (such as India GST CGST/SGST/IGST, VAT, and Sales Tax). Configuration of statutory rates, HSN/SAC codes, and fiscal invoice numbering remains the responsibility of the merchant and authorized accountants.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">4. Account Security & Contact</h2>
            </div>
            <p className="text-slate-400">
              Merchants are responsible for maintaining confidentiality of PINs and master credentials. In case of suspected unauthorized access, immediately rotate passwords via your Cloud Portal or notify{' '}
              <span className="text-orange-400 font-medium">security@orderitup.com</span>.
            </p>
          </section>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Order It Up POS Inc. All rights reserved.
        </div>
      </main>
    </div>
  );
}
