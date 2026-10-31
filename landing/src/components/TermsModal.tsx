"use client";

import React, { useState } from "react";
import {
  X,
  Shield,
  AlertTriangle,
  Scale,
  CheckCircle2,
  Building,
} from "lucide-react";
import { LegalTab } from "@/lib/modalEvents";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

export default function TermsModal({
  isOpen,
  onClose,
  initialTab = "terms",
}: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="p-5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white border border-orange-200 shadow-xs">
              <Scale className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Legal Policies &amp; Terms of Service
              </h3>
              <p className="text-xs text-slate-600">
                Early-Stage Startup Beta Notice • 100% Offline Data Protection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "terms"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            Terms &amp; Conditions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("privacy")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "privacy"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            Privacy Policy (Offline Data)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("disclaimer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "disclaimer"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            Startup &amp; Beta Disclaimer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tax")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "tax"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            Tax &amp; Compliance Policy
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed font-sans">
          {/* TAB 1: TERMS & CONDITIONS */}
          {activeTab === "terms" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-950">
                <p className="font-bold">Effective Date: October 31, 2026</p>
                <p className="text-[11px] text-orange-800 mt-0.5">
                  Order It Up is an early-stage restaurant technology startup currently providing software in pre-incorporation beta release.
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. Acceptance of Terms</h4>
                <p>
                  By accessing, downloading, or running the Order It Up desktop point-of-sale software, kitchen display system (KDS :3002), or mobile waiter app (:3003), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not install or operate the software.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. Startup Status &amp; Beta Evaluation</h4>
                <p>
                  Order It Up is developed by an independent early-stage founding team. The software is provided as a public preview and pilot system for restaurants, cafes, food trucks, and bars. We are actively refining capabilities, hardware spoolers, and multi-station sync.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Grant of License</h4>
                <p>
                  You are granted a non-exclusive, revocable, non-transferable license to operate Order It Up on your restaurant counter devices. Single-counter usage is free forever. You may not resell, rent, lease, or sub-license the binary packages without prior written consent from the founders.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Hardware &amp; Peripheral Compatibility</h4>
                <p>
                  Order It Up provides direct raw bytecode spooling for standard 80mm/58mm ESC/POS thermal receipt printers and 24V solenoid pulse drivers via RJ11/RJ12 drawer interfaces. You are responsible for ensuring your hardware ports (USB, Serial COM, TCP/IP LAN) and voltage matches your equipment specifications.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">5. Modifications to Service</h4>
                <p>
                  As an evolving product, we may periodically introduce updates, feature enhancements, or bug fixes. Critical offline counter functionality will always remain operable without internet connectivity.
                </p>
              </section>
            </div>
          )}

          {/* TAB 2: PRIVACY POLICY */}
          {activeTab === "privacy" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <div className="flex items-center gap-2 font-bold">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>100% Offline-First Data Sovereign Guarantee</span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Your business data, customer numbers, menu pricing, and financial ledgers stay strictly on your local computer hard drive.
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. Zero Cloud Database Storage</h4>
                <p>
                  Unlike traditional cloud POS vendors that stream all your patron orders, sales metrics, and phone numbers to remote third-party databases, Order It Up persists transactions directly in a local, encrypted SQLite WAL database (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">flo.db</code>) on your counter machine.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. No Telemetry or Patron Profiling</h4>
                <p>
                  We do not collect, monetize, track, or sell your diner contact details, phone numbers, average ticket sizes, or billing volume. Your customer relationships remain 100% confidential to your establishment.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Local Area Network (LAN) Operations</h4>
                <p>
                  Communication between your main billing terminal, kitchen displays (port :3002), and waiter devices (port :3003) occurs strictly across your local restaurant Wi-Fi router via local WebSockets. No order tickets or KOT slips transit over the public internet.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Optional User-Initiated Integrations</h4>
                <p>
                  If you choose to enable optional integrations (such as local Google Drive database backups or merchant WhatsApp receipts), credentials and tokens are stored in your local configuration and communicate solely with those services with your direct authorization.
                </p>
              </section>
            </div>
          )}

          {/* TAB 3: STARTUP & BETA DISCLAIMER */}
          {activeTab === "disclaimer" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Early-Stage Startup &amp; Beta Evaluation Notice</span>
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Order It Up is an early-stage, bootstrapped startup software project in pre-registration beta testing.
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. Software Provided &ldquo;As Is&rdquo;</h4>
                <p>
                  The software is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, whether express, statutory, or implied, including but not limited to warranties of merchantability, fitness for a particular business purpose, or non-infringement.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. Limitation of Liability</h4>
                <p>
                  To the maximum extent permitted by applicable law, the founders, authors, and contributors of Order It Up shall not be held liable for any direct, indirect, incidental, special, consequential, or punitive damages, including loss of profits, data corruption, hardware solenoid burnouts, paper spools, or business interruption resulting from the use or inability to use the software.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Data Backup Responsibility</h4>
                <p>
                  Because Order It Up is an offline-first system that stores data on your local hard drive, you are encouraged to maintain regular offline backups of your database file (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">flo.db</code>) using a USB flash drive or local external storage.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Community Feedback &amp; Roadmaps</h4>
                <p>
                  We actively welcome bug reports, hardware feedback, thermal printer driver models, and feature requests from restaurant owners to help refine our formal commercial release.
                </p>
              </section>
            </div>
          )}

          {/* TAB 4: TAX & COMPLIANCE POLICY */}
          {activeTab === "tax" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
                <div className="flex items-center gap-2 font-bold">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Statutory Tax &amp; Merchant Responsibility Notice</span>
                </div>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Order It Up provides calculation engines and thermal templates for Indian GST, Global VAT, and FSSAI receipt formats.
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. Mathematical &amp; Formatting Tools Only</h4>
                <p>
                  The tax calculations (CGST 2.5%, SGST 2.5%, IGST 5.0%, HSN/SAC breakdown, and Global VAT rate packs) and receipt layouts are calculation and formatting utilities provided to assist counter speed.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. No Accounting or Legal Tax Advice</h4>
                <p>
                  Order It Up and its founders do not provide chartered accounting, financial auditing, or legal tax advisory services. Restaurant owners and business operators are solely responsible for ensuring that their tax rates, GSTIN numbers, FSSAI licenses, invoice numbering series, and statutory monthly/quarterly filings (GSTR-1, GSTR-3B) comply with applicable government regulations.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Z-Report &amp; Cash Closures</h4>
                <p>
                  Daily Z-Report shift tallies, cash drawer opening float reconciliations, and payment tender summaries are generated based on local terminal transactions punched by your cashier. Merchants must perform physical cash counts to verify drawer balancing.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Order It Up • Early-Stage Restaurant POS Startup</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
}
