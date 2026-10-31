import React from "react";
import { UtensilsCrossed, ShieldCheck } from "lucide-react";
import { BRAND } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Order It Up Logo"
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-black tracking-tight text-slate-900 whitespace-nowrap">
                {BRAND.name}
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed font-normal max-w-sm">
              The high-speed, offline-first operating system designed to keep restaurants, cafes,
              and bars billing at full speed — even during total internet blackouts.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>All Local Subsystems Operational</span>
            </div>
          </div>

          {/* Column 1: Product */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#features" className="hover:text-orange-600 transition-colors">
                  Counter POS Billing
                </a>
              </li>
              <li>
                <a href="#ui-preview" className="hover:text-orange-600 transition-colors">
                  Kitchen Display (KDS :3002)
                </a>
              </li>
              <li>
                <a href="#roles" className="hover:text-orange-600 transition-colors">
                  Mobile Waiter Server (:3003)
                </a>
              </li>
              <li>
                <a href="#specs" className="hover:text-orange-600 transition-colors">
                  ESC/POS Thermal Drivers
                </a>
              </li>
              <li>
                <a href="#specs" className="hover:text-orange-600 transition-colors">
                  24V Cash Drawer Pulse
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Compliance & Accounting */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Compliance &amp; Tax
            </h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-slate-600">Indian GST (CGST &amp; SGST)</span>
              </li>
              <li>
                <span className="text-slate-600">Global VAT Rate Packs</span>
              </li>
              <li>
                <span className="text-slate-600">FSSAI License Receipts</span>
              </li>
              <li>
                <span className="text-slate-600">Z-Report Cash Closures</span>
              </li>
              <li>
                <span className="text-slate-600">Tally XML Ledger Export</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Architecture & Developers */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Architecture
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#architecture" className="hover:text-orange-600 transition-colors">
                  SQLite WAL (`flo.db`)
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-orange-600 transition-colors">
                  Local Express Engine (:3001)
                </a>
              </li>
              <li>
                <a href="#specs" className="hover:text-orange-600 transition-colors">
                  Hardware Bytecode Specs
                </a>
              </li>
              <li>
                <span className="text-slate-600">MIT Open Source License</span>
              </li>
              <li>
                <span className="text-slate-600">Zero Cloud Vendor Lock-in</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-center sm:text-left">
            &copy; {new Date().getFullYear()} {BRAND.name}. Engineered by{" "}
            <span className="text-slate-800 font-semibold">{BRAND.company}</span>. All rights reserved.
          </p>

          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Built with industrial offline resilience</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
