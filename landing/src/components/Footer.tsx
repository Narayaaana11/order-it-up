"use client";

import React from "react";
import {
  ShieldCheck,
  Receipt,
  Key,
  ExternalLink,
  Printer,
} from "lucide-react";
import { BRAND } from "@/lib/constants";
import {
  triggerOpenBillModal,
  triggerOpenLicenseModal,
  triggerOpenCredentialsModal,
} from "@/lib/modalEvents";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
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

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>All Local Subsystems Operational</span>
              </div>

              <button
                type="button"
                onClick={() => triggerOpenCredentialsModal()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[11px] font-semibold text-orange-800 transition-colors"
              >
                <Key className="w-3 h-3 text-orange-600" />
                <span>Test Role Credentials</span>
              </button>
            </div>
          </div>

          {/* Column 1: Product */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Product &amp; POS
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="#features"
                  className="hover:text-orange-600 transition-colors flex items-center gap-1.5"
                >
                  <span>Counter POS Billing</span>
                </a>
              </li>
              <li>
                <a
                  href="#ui-preview"
                  className="hover:text-orange-600 transition-colors flex items-center gap-1.5"
                >
                  <span>Kitchen Display (KDS :3002)</span>
                </a>
              </li>
              <li>
                <a
                  href="#roles"
                  className="hover:text-orange-600 transition-colors flex items-center gap-1.5"
                >
                  <span>Mobile Waiter Server (:3003)</span>
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("standard")}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1.5 group"
                >
                  <span>ESC/POS Thermal Drivers</span>
                  <Receipt className="w-3 h-3 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("standard")}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1.5 group"
                >
                  <span>24V Cash Drawer Pulse</span>
                  <Receipt className="w-3 h-3 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Compliance & Accounting (Interactive Bill Templates) */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Compliance &amp; Tax
            </h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("gst")}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1.5 group text-slate-700"
                >
                  <span>Indian GST (CGST &amp; SGST)</span>
                  <Receipt className="w-3 h-3 text-orange-600 opacity-80" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("gst")}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1.5 group text-slate-700"
                >
                  <span>Global VAT Rate Packs</span>
                  <Receipt className="w-3 h-3 text-orange-600 opacity-80" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("standard")}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1.5 group text-slate-700"
                >
                  <span>FSSAI License Receipts</span>
                  <Receipt className="w-3 h-3 text-orange-600 opacity-80" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("zreport")}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1.5 group text-slate-700"
                >
                  <span>Z-Report Cash Closures</span>
                  <Receipt className="w-3 h-3 text-orange-600 opacity-80" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("zreport")}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1.5 group text-slate-700"
                >
                  <span>Tally XML Ledger Export</span>
                  <Receipt className="w-3 h-3 text-orange-600 opacity-80" />
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Architecture & Security */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Architecture &amp; Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#architecture" className="hover:text-orange-600 transition-colors block">
                  SQLite WAL (`flo.db`)
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-orange-600 transition-colors block">
                  Local Express Engine (:3001)
                </a>
              </li>
              <li>
                <a href="#specs" className="hover:text-orange-600 transition-colors block">
                  Hardware Bytecode Specs
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => triggerOpenLicenseModal()}
                  className="hover:text-orange-600 transition-colors text-left flex items-center gap-1 text-slate-700 font-medium"
                >
                  <span>MIT Open Source License</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
              </li>
              <li>
                <a href="#architecture" className="hover:text-orange-600 transition-colors block">
                  Zero Cloud Vendor Lock-in
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Quick Role Buttons & Copyright */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-center sm:text-left">
            &copy; {new Date().getFullYear()} {BRAND.name}. Engineered by{" "}
            <span className="text-slate-800 font-semibold">{BRAND.company}</span>. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <button
              type="button"
              onClick={() => triggerOpenBillModal("standard")}
              className="hover:text-orange-600 font-semibold transition-colors flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5 text-orange-600" />
              <span>80mm Bill Template</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => triggerOpenCredentialsModal()}
              className="hover:text-orange-600 font-semibold transition-colors flex items-center gap-1"
            >
              <Key className="w-3.5 h-3.5 text-slate-600" />
              <span>Test Credentials</span>
            </button>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Offline Resilience Verified</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
