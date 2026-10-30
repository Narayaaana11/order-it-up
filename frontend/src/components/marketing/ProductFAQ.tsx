'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'What is Order It Up?',
    a: 'Order It Up is a modern, offline-first operating system designed specifically for food, beverage, and hospitality businesses. It unifies high-speed counter POS billing, kitchen order routing (KDS), floor table management, waitstaff mobile ordering, and multi-branch cloud reporting into one connected platform.',
  },
  {
    q: 'Does billing stop if our restaurant internet connection drops?',
    a: 'No. When running the native desktop terminal, Order It Up utilizes an embedded local SQLite architecture. Every bill, item modification, and cash settlement is committed locally with atomic durability. You can continue taking orders and printing thermal receipts indefinitely during network blackouts. When connectivity is restored, data synchronizes automatically to the cloud.',
  },
  {
    q: 'Which thermal printers and hardware are compatible?',
    a: 'Order It Up features direct driver support for standard ESC/POS 80mm and 58mm thermal receipt printers over USB, Ethernet LAN, and Bluetooth (including models from Epson, TVS, Star Micronics, Rongta, and Xprinter). It also triggers RJ11/RJ12 cash drawer pulse signals on cash payment settlement and works with standard USB barcode scanners.',
  },
  {
    q: 'What employee roles and permissions are supported?',
    a: 'Order It Up implements strict Role-Based Access Control (RBAC) across 6 authentic roles: Owner (multi-branch strategy, organization settings), Manager (shift opening/float declarations, void approvals, table floorplan), Accountant (cash variance reconciliation, Tally XML export), Cashier (rapid counter billing, receipt printing), Server (table-side mobile ordering), and Chef (station-specific KDS tickets and prep status).',
  },
  {
    q: 'How does multi-branch management and menu pricing work?',
    a: 'From Cloud HQ, owners can curate a centralized Master Catalog with global recipes and categories. You can selectively override dish pricing or toggle item availability for specific branches to account for local market dynamics and footfall.',
  },
  {
    q: 'Can we export data directly to accounting software like Tally?',
    a: 'Yes. Order It Up provides native 1-click Tally XML ledger exports compatible with Tally Prime and Tally.ERP 9. It creates structured accounting vouchers with separate ledger accounts for Sales, Cash Tender, Card Payments, and statutory taxes (CGST, SGST, IGST, or VAT). Full CSV and Excel exports are also available.',
  },
  {
    q: 'How does mobile waitstaff ordering work?',
    a: 'Waiters can pair any standard Android or iOS smartphone or tablet with the restaurant station in seconds by scanning a QR code or entering a 6-digit cryptographic PIN generated in Cloud HQ. Servers take orders table-side, customize customer modifiers, and fire courses straight to kitchen printers and screens.',
  },
  {
    q: 'How can our restaurant get started?',
    a: 'You can begin immediately by clicking "Start Free Trial" and registering your organization in under 60 seconds. You receive an unrestricted 14-day trial with full access to the Web POS terminal, KDS module, and Cloud HQ. No credit card is required to begin.',
  },
];

export default function MarketingProductFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 lg:py-28 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
          <span>Frequently Answered Questions</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Answers Grounded in Actual Architecture
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-400">
          Everything you need to know about our offline durability, hardware compatibility, roles, and cloud synchronization.
        </p>
      </div>

      {/* Accordion List */}
      <div className="space-y-3.5">
        {FAQS.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'border-orange-500/40 bg-slate-900/80 shadow-lg shadow-orange-500/5'
                  : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/50'
              }`}
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                aria-expanded={isOpen}
              >
                <span className="text-base sm:text-lg font-bold text-white">
                  {faq.q}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 bg-orange-500 text-white' : 'text-slate-400'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
