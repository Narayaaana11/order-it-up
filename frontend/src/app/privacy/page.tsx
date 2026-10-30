'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Database, Globe, FileText, CheckCircle2 } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <Shield className="w-3.5 h-3.5" />
            <span>Commercial Privacy Standards</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-400">
            Last Updated: October 30, 2026 • Effective Date: January 1, 2026
          </p>
        </div>

        <div className="space-y-10 text-sm sm:text-base text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">1. Offline-First Data Architecture & Local Storage</h2>
            </div>
            <p className="mb-3 text-slate-400">
              Order It Up operates on an offline-first architectural paradigm. When deployed on local terminals (Electron desktop runtime), all transaction data, orders, customer contact numbers, inventory records, and table states are stored locally within an encrypted or protected SQLite database on your hardware.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Your point-of-sale terminal maintains independent operation and data authority during internet outages.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>We never read or access unencrypted local payment card numbers. Card data is processed directly via certified external card terminals or banking gateways.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">2. Cloud Synchronization & Multi-Branch Aggregation</h2>
            </div>
            <p className="mb-3 text-slate-400">
              When cloud sync is active, Order It Up transmits business metrics to our Cloudflare Edge infrastructure and Serverless D1 databases over TLS 1.3 encrypted channels. Synchronized information includes:
            </p>
            <ul className="space-y-2 text-sm text-slate-300 list-disc list-inside ml-2">
              <li>Organization profile, branch IDs, and user account metadata (email, role, hashed passwords).</li>
              <li>Item catalog, master pricing, and branch-level inventory balance snapshots.</li>
              <li>Completed ticket totals, tax breakdown (CGST/SGST/VAT), and payment method tokens (Cash, UPI reference, Card swipe ID).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">3. Merchant Data Ownership & Export Rights</h2>
            </div>
            <p className="mb-3 text-slate-400">
              Your business data is strictly yours. Order It Up does not sell, license, or monetize your restaurant sales records, customer lists, or proprietary pricing models to third-party aggregators or advertisers.
            </p>
            <p className="text-slate-400">
              At any point, administrators may export their entire ledger and transaction history directly into standard CSV formats or Tally-compliant XML accounting formats without vendor lock-in.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">4. Contact & Compliance Inquiries</h2>
            </div>
            <p className="text-slate-400">
              For privacy compliance inquiries, GDPR data deletion requests, or data porting assistance, please reach out to our dedicated technical team via your registered Cloud Portal account or email us at{' '}
              <span className="text-orange-400 font-medium">privacy@orderitup.com</span>.
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
