'use client';

import React from 'react';
import Link from 'next/link';
import { UtensilsCrossed } from 'lucide-react';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand & Description Column */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-white">Order It Up</span>
                <span className="text-[10px] text-orange-400 font-semibold tracking-wider uppercase">
                  Restaurant Operating System
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              An offline-first restaurant management platform engineered for sub-second counter billing, kitchen order routing (KDS), table management, and multi-branch cloud reporting.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono text-emerald-400 font-medium">
                Cloudflare Edge & Serverless D1: Operational
              </span>
            </div>
          </div>

          {/* Product Navigation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/pos" className="hover:text-orange-400 transition-colors">
                  Web POS Terminal
                </Link>
              </li>
              <li>
                <Link href="/kds" className="hover:text-orange-400 transition-colors">
                  Kitchen Display (KDS)
                </Link>
              </li>
              <li>
                <Link href="/cloud-portal" className="hover:text-orange-400 transition-colors">
                  Multi-Branch Cloud HQ
                </Link>
              </li>
              <li>
                <Link href="/qr" className="hover:text-orange-400 transition-colors">
                  Contactless QR Ordering
                </Link>
              </li>
              <li>
                <a href="#platforms" className="hover:text-orange-400 transition-colors">
                  Desktop SQLite Terminal
                </a>
              </li>
            </ul>
          </div>

          {/* Roles & Features */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Capabilities & Roles
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#features" className="hover:text-orange-400 transition-colors">
                  Offline Durability
                </a>
              </li>
              <li>
                <a href="#hardware" className="hover:text-orange-400 transition-colors">
                  ESC/POS Thermal Printing
                </a>
              </li>
              <li>
                <a href="#hardware" className="hover:text-orange-400 transition-colors">
                  Tally XML Ledger Export
                </a>
              </li>
              <li>
                <a href="#roles" className="hover:text-orange-400 transition-colors">
                  Store Manager Approvals
                </a>
              </li>
              <li>
                <a href="#roles" className="hover:text-orange-400 transition-colors">
                  Cashier & Waitstaff Workflows
                </a>
              </li>
            </ul>
          </div>

          {/* Account & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Account & Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/auth/login" className="hover:text-orange-400 transition-colors">
                  Merchant Sign In
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-orange-400 transition-colors">
                  Start Free Trial
                </Link>
              </li>
              <li>
                <Link href="/auth/recover" className="hover:text-orange-400 transition-colors">
                  Account Recovery
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-orange-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-orange-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} Order It Up POS Inc. All rights reserved.
          </div>
          <div>
            <span>Desktop Electron POS • Cloudflare Edge • Flutter Mobile Companion</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
