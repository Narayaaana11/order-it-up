'use client';

import React from 'react';
import {
  Printer,
  CreditCard,
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';

export default function MarketingIntegrationsHub() {
  return (
    <section id="hardware" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span>Ecosystem & Interoperability</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Hardware Native. Accounting Ready.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-400">
          Order It Up connects cleanly to the industry-standard POS hardware, payment methods, and accounting suites used by restaurants daily.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Column 1: Hardware Interfacing (Verified) */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Printer className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Direct Driver Ready
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Thermal Printers & Drawers</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
              Native ESC/POS command generation without relying on clumsy Windows print spoolers or third-party print servers.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="font-semibold text-white">ESC/POS 80mm & 58mm Receipts</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  USB, Ethernet LAN, and Bluetooth thermal printers (Epson, TVS, Star, Rongta, Xprinter).
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="font-semibold text-white">Cash Drawer RJ11 / RJ12 Solenoid</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Sends hardware pulse signal to kick open standard cash registers automatically on cash tender.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="font-semibold text-white">Barcode & SKU Handheld Readers</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Instant keyboard wedge scanner inputs for packaged items, merchandise, and retail stock.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Payment Workflows & Transparent Gateway Status */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Multi-Tender
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Payments & Tender Settlement</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
              Flexible payment acceptance designed to prevent checkout gridlock, with explicit status disclosure for payment gateways.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">Cash & Split Settlements</div>
                  <span className="text-[10px] text-emerald-400 font-bold">Active</span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Exact change calculation, petty cash tracking, and split tender between Cash, Card, and UPI.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">External Card & UPI QR Codes</div>
                  <span className="text-[10px] text-emerald-400 font-bold">Active</span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Confirm swiped EDC cards with authorization codes, and display restaurant UPI QR for instant scan.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">Online Payment Gateway (Razorpay)</div>
                  <span className="text-[10px] text-amber-400 font-bold">In Configuration</span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Direct online gateway APIs integrated; live merchant activation requires merchant credentials.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Accounting, Taxes & Tally (Verified) */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Accounting Ready
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Tally XML & Tax Compliance</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
              Eliminate double-entry ledger bookkeeping with automated tax splitting and standard financial exports.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="font-semibold text-white">Tally Prime & ERP 9 XML Export</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Generate standard XML journal vouchers with separate Ledger Accounts for Cash, Card, and Tax.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="font-semibold text-white">Statutory Tax Splitting</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Calculates CGST (2.5%), SGST (2.5%), IGST (5%), VAT, or custom regional tax models automatically.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <div className="font-semibold text-white">Shift Cash Audits & Variance Logs</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Compare declared cash at register close with system expected tender to detect drawer shortages.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
