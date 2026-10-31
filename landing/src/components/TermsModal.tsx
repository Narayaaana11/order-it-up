"use client";

import React, { useState } from "react";
import {
  X,
  Shield,
  Scale,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  CreditCard,
} from "lucide-react";
import { LegalTab } from "@/lib/modalEvents";

export type StartupTermsTab =
  | "terms"
  | "sla"
  | "privacy"
  | "acceptable-use"
  | "billing";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab | StartupTermsTab | string;
}

function normalizeTab(tab?: string): StartupTermsTab {
  if (tab === "sla") return "sla";
  if (tab === "privacy") return "privacy";
  if (tab === "acceptable-use" || tab === "tax") return "acceptable-use";
  if (tab === "billing" || tab === "disclaimer") return "billing";
  return "terms";
}

export default function TermsModal({
  isOpen,
  onClose,
  initialTab = "terms",
}: TermsModalProps) {
  const [userSelectedTab, setUserSelectedTab] = useState<StartupTermsTab | null>(null);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);

  if (prevInitialTab !== initialTab) {
    setPrevInitialTab(initialTab);
    setUserSelectedTab(null);
  }

  const activeTab = userSelectedTab ?? normalizeTab(initialTab);
  const setActiveTab = (tab: StartupTermsTab) => setUserSelectedTab(tab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
      >
        {/* Modal Top Header */}
        <div className="p-5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white border border-orange-200 shadow-xs">
              <Scale className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 id="terms-modal-title" className="text-base font-extrabold text-slate-900">
                Startup Terms &amp; Operational Policies
              </h3>
              <p className="text-xs text-slate-600">
                IndentDev Early-Stage SaaS Architecture • 100% Offline Durability Invariant
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

        {/* 5-Tab Navigation Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "terms"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. SaaS Terms &amp; Scope</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sla")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "sla"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>2. SLA &amp; Uptime</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("privacy")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "privacy"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>3. Data Sovereignty &amp; S3</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("acceptable-use")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "acceptable-use"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>4. Acceptable Use &amp; Responsibilities</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("billing")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "billing"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>5. Billing, Liability &amp; Cancellation</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed font-sans">
          {/* TAB 1: SAAS TERMS & MULTI-TIER LICENSING */}
          {activeTab === "terms" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-950">
                <div className="flex items-center gap-2 font-bold">
                  <Scale className="w-4 h-4 text-orange-600" />
                  <span>SaaS Terms of Service &amp; Multi-Tier Licensing Framework</span>
                </div>
                <p className="text-[11px] text-orange-800 mt-0.5">
                  Effective Date: October 31, 2026 • Published by IndentDev for the Order It Up Operating System
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. SaaS Preamble &amp; Contracting Parties</h4>
                <p>
                  These Terms of Service govern access to and use of the Order It Up restaurant operating platform, including the Electron desktop counter application, local WebSocket kitchen display system (KDS :3002), tableside ordering server (:3003), and central cloud management services, provided by IndentDev (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By installing, downloading, or running any component of the system, the restaurant entity (&ldquo;Merchant&rdquo;, &ldquo;you&rdquo;) agrees to these terms.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. Architectural Scope &amp; Device Boundary</h4>
                <p>
                  Order It Up enforces strict architectural separation of concerns between operational billing and central business management:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                  <li>
                    <strong className="text-slate-800">Point of Sale (POS) Billing Boundary:</strong> Order creation, live table cart tenders, split billing, 24V solenoid cash drawer kicks, and ESC/POS thermal printing are strictly licensed and authorized to run on local Desktop and Mobile counter clients. Point-of-sale billing is intentionally blocked on the public web browser platform to guarantee transactional integrity.
                  </li>
                  <li>
                    <strong className="text-slate-800">Web Platform Boundary:</strong> The public web platform (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">orderitup.pages.dev</code>) is exclusively dedicated to merchant onboarding, cloud admin dashboards, multi-store franchise oversight, sales analytics, employee credential administration, and cloud S3 data storage management.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Multi-Tier License Grant</h4>
                <p>
                  Subject to compliance with these Terms, IndentDev grants the Merchant a non-exclusive, non-transferable, revocable license to operate Order It Up under the following tier structures:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                  <li>
                    <strong className="text-slate-800">Community Single-Counter Tier:</strong> Free perpetual license for single-terminal standalone counter billing, thermal printing, and local SQLite data persistence. Requires no payment method and incurs zero ongoing license fee.
                  </li>
                  <li>
                    <strong className="text-slate-800">Multi-Station &amp; Cloud SaaS Tier:</strong> Billed on a recurring subscription basis to unlock multi-device local LAN mesh synchronization (KDS bump screens, mobile waiter tableside ordering), automated background cloud sync outbox, multi-location franchise consolidation, and encrypted S3 backup storage.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Intellectual Property Rights</h4>
                <p>
                  All proprietary source code, binary executables, raw ESC/POS device drivers, UI components, database schemas, and documentation remain the exclusive intellectual property of IndentDev and its licensors. Except for the rights explicitly granted herein, no title or ownership of the software is transferred to the Merchant.
                </p>
              </section>
            </div>
          )}

          {/* TAB 2: SLA & UPTIME EXPECTATIONS */}
          {activeTab === "sla" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <div className="flex items-center gap-2 font-bold">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Service Level Agreement (SLA) &amp; Operational Invariants</span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  100% Offline-First Durability Invariant vs. Early Startup Public Cloud Beta Availability
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. The 100% Offline Resilience Invariant</h4>
                <p>
                  Order It Up is engineered from first principles with an immutable offline invariant:
                </p>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
                  <p className="font-bold text-emerald-700">✓ Core Invariant: Local Counter Operations Never Block on Cloud Connectivity</p>
                  <p>• Atomic SQLite Write-Ahead Logging (WAL) commits to local disk in &lt; 3ms.</p>
                  <p>• Thermal printer spooling executes direct ESC/POS bytecode over USB and LAN without OS dialog lag.</p>
                  <p>• Kitchen Display System (:3002) and Captain handhelds (:3003) communicate across internal Wi-Fi with zero WAN dependency.</p>
                </div>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. Early-Stage Cloud Edge &amp; Web Services SLA</h4>
                <p>
                  Central SaaS services — including Cloudflare Pages web hosting, optional S3 synchronization outbox, and web analytics portals — are delivered on a &ldquo;best-effort&rdquo; commercial availability basis during our early-stage evaluation and beta rollout. While we target 99.9% availability for central cloud ingestion, transient public network or ISP disruptions will not impede local billing.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. No Monetary SLA Penalties or Liquidated Damages</h4>
                <p>
                  Because Order It Up operates with local offline resilience and is currently in early-stage pre-incorporation beta release, IndentDev does not provide financially-backed uptime credits, service level fee rebates, or liquidated damages for intermittent central cloud reachability interruptions.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Scheduled Cloud Maintenance Windows</h4>
                <p>
                  Routine infrastructure upgrades, cloud migrations, and schema index adjustments are announced via web portal notices. During scheduled cloud maintenance windows, local counter checkout, kitchen tickets, and cash settlement continue uninterrupted.
                </p>
              </section>
            </div>
          )}

          {/* TAB 3: DATA SOVEREIGNTY & S3 CLOUD PRIVACY */}
          {activeTab === "privacy" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950">
                <div className="flex items-center gap-2 font-bold">
                  <Database className="w-4 h-4 text-sky-600" />
                  <span>Merchant Data Sovereignty, S3 Cloud Storage &amp; Privacy Policy</span>
                </div>
                <p className="text-[11px] text-sky-800 mt-0.5">
                  100% Merchant Ownership Guarantee • SQLite WAL Boundary • Segregated Tenant S3 Buckets
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. Exclusive Merchant Data Ownership</h4>
                <p>
                  The Merchant retains 100% exclusive intellectual property, legal title, and ownership of all restaurant customer contact lists, menu recipes, pricing structures, order histories, table notes, employee timecards, and fiscal ledger records. IndentDev does not claim any ownership over Merchant operational data and will never sell, broker, or monetize patron contact information.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. Local SQLite Data Sovereign Boundary</h4>
                <p>
                  All transactional counter operations are written directly to a local, encrypted SQLite WAL database (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">flo.db</code>) residing on your physical counter computer. No operational dining tickets, credit card tokens, or diner mobile numbers are transmitted over public third-party telemetry streams without explicit merchant configuration.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Multi-Tenant S3 Bucket Storage Segregation</h4>
                <p>
                  When cloud synchronization and S3 bucket archival are enabled, records are transmitted via TLS 1.3 to Amazon S3 / S3-compatible cloud storage under strict organizational prefix isolation:
                </p>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                  <p className="text-slate-900 font-semibold mb-1">Tenant Bucket Hierarchy Contract:</p>
                  <p>s3://order-it-up-platform/tenants/&#123;tenantId&#125;/backups/flo-2026-10-31.wal.gz</p>
                  <p>s3://order-it-up-platform/tenants/&#123;tenantId&#125;/users/credentials-archive.json</p>
                  <p>s3://order-it-up-platform/tenants/&#123;tenantId&#125;/payments/settlements-2026-10.csv</p>
                  <p>s3://order-it-up-platform/tenants/&#123;tenantId&#125;/media/menu-dishes/</p>
                </div>
                <p className="text-slate-600 mt-1">
                  Tenant data is cryptographically segregated by Tenant ID and IAM access policy, strictly preventing cross-tenant access between independent restaurant entities.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Zero Vendor Lock-In &amp; One-Click Export</h4>
                <p>
                  Merchants possess the permanent right to export their complete historical SQLite database file, sales CSVs, and Tally XML ledger files at any time without fees, technical obstruction, or artificial export throttles.
                </p>
              </section>
            </div>
          )}

          {/* TAB 4: ACCEPTABLE USE & OPERATIONAL RESPONSIBILITIES */}
          {activeTab === "acceptable-use" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950">
                <div className="flex items-center gap-2 font-bold">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span>Acceptable Use Policy (AUP) &amp; Merchant Operational Responsibilities</span>
                </div>
                <p className="text-[11px] text-purple-800 mt-0.5">
                  Hardware Specifications • Solenoid Voltage Compliance • LAN Security • Statutory Tax Filings
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. Acceptable Use Policy (AUP)</h4>
                <p>
                  Merchants and their designated staff agree not to use the Order It Up software or cloud services to:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                  <li>Decompile, disassemble, or reverse-engineer proprietary ESC/POS printer driver bytecode or license validation algorithms.</li>
                  <li>Perform unauthorized penetration testing, automated API fuzzing, or denial-of-service tests against Cloudflare Edge or S3 endpoints.</li>
                  <li>Fabricate, alter, or backdate fiscal billing records to unlawfully evade statutory sales tax or GST/VAT liabilities.</li>
                  <li>Transmit harmful malicious payloads or unauthorized scripts over local WebSocket ports (:3002/:3003).</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. Hardware Electrical Specifications &amp; Solenoid Compatibility</h4>
                <p>
                  The Merchant is solely responsible for verifying hardware electrical characteristics prior to connecting peripheral devices:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                  <li>
                    <strong className="text-slate-800">24V Solenoid Cash Drawer Pulse:</strong> Cash drawer RJ11/RJ12 drawer kick interfaces operate with standard 24V DC solenoid pulse signals (pin 2 / pin 5). The Merchant must ensure drawers are rated for 24V DC to prevent coil overheating or driver damage.
                  </li>
                  <li>
                    <strong className="text-slate-800">Thermal Roll Sizing:</strong> Verify thermal printer model compatibility (58mm vs. 80mm roll width) and baud rates for serial/USB configurations.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Local Network (LAN) Security Responsibility</h4>
                <p>
                  Because the in-restaurant KDS (:3002) and Waiter tableside app (:3003) operate over local in-house Wi-Fi, the Merchant is responsible for securing the restaurant router with strong WPA2/WPA3 encryption, isolating operational devices from public guest Wi-Fi networks, and maintaining router administrative passwords.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Statutory Tax Filings &amp; Legal Compliance</h4>
                <p>
                  Order It Up provides mathematical calculation utilities for Indian GST (CGST/SGST), Global VAT rates, and FSSAI invoice footers. These calculation utilities are provided as operational tools and do not constitute chartered accounting or legal tax advice. The Merchant remains solely responsible for verifying tax rates and submitting statutory returns (GSTR-1, GSTR-3B) with governmental tax authorities.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">5. Local Offline Backup Mandate</h4>
                <p>
                  Because operational transactions reside in the local SQLite database (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">flo.db</code>), the Merchant must establish regular backup procedures (e.g., daily copying to an external USB flash drive or secondary on-premise workstation) to prevent data loss resulting from local physical disk hardware failure.
                </p>
              </section>
            </div>
          )}

          {/* TAB 5: BILLING, LIABILITY & ZERO-LOCK-IN CANCELLATION */}
          {activeTab === "billing" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                <div className="flex items-center gap-2 font-bold">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>Limitation of Liability, Subscription Billing &amp; Zero-Lock-In Cancellation</span>
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Transparent Subscription Cycles • 30-Day Cancellation • 60-Day Data Grace Period • Strict Liability Cap
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">1. Free Community License &amp; Paid Subscription Tiers</h4>
                <p>
                  Standalone single-counter desktop POS operations are free without credit card entry. Paid subscriptions for multi-station LAN mesh, cloud analytics sync, and franchise headquarters oversight are billed on recurring 30-day or annual intervals. Billing begins on the date of subscription activation.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">2. Zero-Lock-In Cancellation Policy</h4>
                <p>
                  Merchants may cancel cloud subscriptions at any time with 30 days notice directly through the cloud web portal. There are zero cancellation penalties, hidden termination fees, or equipment return charges.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">3. Post-Cancellation Grace Period &amp; Offline Continuity</h4>
                <p>
                  Following cancellation of a paid cloud subscription:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                  <li>The Merchant receives <strong className="text-slate-800">60 days of complimentary read-only cloud dashboard access</strong> to download and export all historical sales reports, tax invoices, and S3 data archives.</li>
                  <li>Local Desktop Single-Counter POS billing functionality <strong className="text-slate-800">remains functional indefinitely</strong>, ensuring uninterrupted counter service even after cloud subscription termination.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">4. Limitation of Liability</h4>
                <p>
                  To the maximum extent permitted by applicable law, in no event shall IndentDev, its founders, officers, employees, or contractors be liable for any indirect, incidental, consequential, special, or punitive damages, including loss of business profits, spoiled restaurant inventory, customer walkouts, or hardware solenoid burnouts arising from use or inability to use the platform.
                </p>
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 font-mono text-[11px] text-slate-900">
                  <p className="font-bold uppercase tracking-wider text-slate-800">Statutory Liability Cap:</p>
                  <p className="mt-0.5">
                    IndentDev&apos;s aggregate cumulative liability for any and all claims under these terms shall be strictly limited to the greater of (a) the total fees paid by the Merchant to IndentDev in the three (3) months preceding the incident, or (b) USD $100.00.
                  </p>
                </div>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-slate-900">5. Early-Stage Feedback &amp; Continuous Improvements</h4>
                <p>
                  We actively collaborate with pilot restaurant operators, cashiers, and kitchen brigades. Feedback on thermal printer models, cash drawer kick timing, or KDS routing can be submitted directly to our engineering team to accelerate platform hardening.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Order It Up • Early-Stage SaaS Startup Legal Policy Suite • IndentDev</span>
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
