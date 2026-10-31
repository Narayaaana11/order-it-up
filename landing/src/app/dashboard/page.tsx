"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Store,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  ShieldCheck,
  Receipt,
  Printer,
  Key,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  FileSpreadsheet,
  Download,
  CreditCard,
} from "lucide-react";
import { BRAND, ROLE_PERSONAS } from "@/lib/constants";
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/auth";
import {
  triggerOpenAuthModal,
  triggerOpenBillModal,
  triggerOpenTermsModal,
  triggerOpenCredentialsModal,
} from "@/lib/modalEvents";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<"sales" | "orders" | "roles" | "compliance" | "s3sync">("sales");

  useEffect(() => {
    // Read stored user safely without triggering synchronous cascading renders
    const timer = setTimeout(() => {
      setCurrentUser(getStoredUser());
    }, 0);

    const handleAuthChange = () => {
      setCurrentUser(getStoredUser());
    };

    window.addEventListener("orderitup_auth_change", handleAuthChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("orderitup_auth_change", handleAuthChange);
    };
  }, []);

  const handleSignOut = () => {
    setStoredUser(null);
  };

  const handleDownloadPos = () => {
    if (!currentUser) {
      triggerOpenAuthModal("login", "windows");
    } else {
      window.dispatchEvent(
        new CustomEvent("orderitup_trigger_download", {
          detail: { platform: "windows" },
        })
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/90 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
            {/* Logo & Breadcrumb */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 group p-1 rounded-xl text-slate-400 hover:text-white transition-colors"
                title="Return to Home"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </Link>
              <div className="h-6 w-px bg-slate-800" />
              <Link href="/" className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="Order It Up Logo"
                  className="h-8 w-8 object-contain"
                />
                <span className="text-lg font-black tracking-tight text-white whitespace-nowrap">
                  {BRAND.name}
                </span>
              </Link>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-bold uppercase tracking-wider">
                <Store className="w-3 h-3" />
                <span>Executive Owner Portal</span>
              </span>
            </div>

            {/* Quick Actions & Auth Controls */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => triggerOpenBillModal("zreport")}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-orange-400" />
                <span>Z-Report Audit</span>
              </button>

              <button
                type="button"
                onClick={() => triggerOpenCredentialsModal()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Role Logins</span>
              </button>

              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-bold text-xs">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="text-left hidden sm:block">
                      <span className="font-bold block leading-tight text-white">
                        {currentUser.name}
                      </span>
                      <span className="text-[10px] text-orange-400 font-mono uppercase block leading-none">
                        {currentUser.role}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerOpenAuthModal("login")}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerOpenAuthModal("signup")}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#F07928] hover:bg-[#EA580C] shadow-xs transition-colors cursor-pointer"
                  >
                    Sign Up
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleDownloadPos}
                className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Windows POS</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Subsystem Topology Status Bar */}
        <div className="mb-8 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-2">
                <span>LAN Operational Topology: 100% Offline-First Engine Active</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Desktop POS: Dedicated Cashier Billing • Web Portal: Executive Reports &amp; S3 Telemetry
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-300">
              API Engine :3001
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-300">
              KDS WebSocket :3002
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-300">
              Waiter Server :3003
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              SQLite WAL Active
            </span>
          </div>
        </div>

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 relative overflow-hidden group hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-semibold uppercase tracking-wider">Today&apos;s Gross Sales</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">₹48,920.00</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% vs previous shift</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 relative overflow-hidden group hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-semibold uppercase tracking-wider">Settled Orders</span>
              <ShoppingBag className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">48 Orders</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>0 voided / 0 chargebacks</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 relative overflow-hidden group hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-semibold uppercase tracking-wider">Average Order Value</span>
              <Receipt className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">₹1,019.16</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 font-medium">
              <span>Includes 5% Service Charge</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 relative overflow-hidden group hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
              <span className="font-semibold uppercase tracking-wider">Floor &amp; Table Occupancy</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">8 / 12 Tables</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
              <span>Table T-04 Active (Pax 4)</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "sales"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Shift Sales &amp; Cash Closures</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "orders"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Live Table Orders</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "roles"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multi-Agent Role Workflows</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("compliance")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "compliance"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Tax &amp; Compliance Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("s3sync")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "s3sync"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>S3 Media &amp; Cloud Telemetry</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        {activeTab === "sales" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tender Breakdown */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-950/70 border border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-400" />
                <span>Shift Payment Tender Audit</span>
              </h3>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">UPI Dynamic QR (Settled via NPCI)</span>
                    <span className="text-xs text-slate-400">28 Transactions • Instant Webhook Settlement</span>
                  </div>
                  <span className="text-lg font-black text-emerald-400">₹28,420.00</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Cash Tendered (Till #01)</span>
                    <span className="text-xs text-slate-400">14 Transactions • Solenoid 24V Drawer Pulses</span>
                  </div>
                  <span className="text-lg font-black text-white">₹14,200.00</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Credit &amp; Debit Card POS Machine</span>
                    <span className="text-xs text-slate-400">6 Transactions • Batch #8921</span>
                  </div>
                  <span className="text-lg font-black text-cyan-400">₹6,300.00</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-300">Total Shift Net Inflow:</span>
                <span className="text-xl font-black text-white">₹48,920.00</span>
              </div>
            </div>

            {/* Quick Z-Report Actions */}
            <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-orange-400" />
                  <span>Thermal Z-Report Slip</span>
                </h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Generate official shift end closure slips with automatic cash drawer reconciliation and unalterable serial counters.
                </p>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs space-y-2 mb-6">
                  <div className="flex justify-between text-slate-300">
                    <span>Shift Status:</span>
                    <span className="text-emerald-400 font-bold">BALANCED</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Opening Float:</span>
                    <span>₹2,000.00</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Cash Discrepancy:</span>
                    <span className="text-emerald-400">₹0.00</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => triggerOpenBillModal("zreport")}
                className="w-full py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View Authentic 80mm Z-Report</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-orange-400" />
              <span>Real-Time Table Orders &amp; Kitchen Status</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-4 font-semibold">ORDER #</th>
                    <th className="py-3 px-4 font-semibold">TABLE</th>
                    <th className="py-3 px-4 font-semibold">ITEMS SUMMARY</th>
                    <th className="py-3 px-4 font-semibold">TOTAL</th>
                    <th className="py-3 px-4 font-semibold">PAYMENT</th>
                    <th className="py-3 px-4 font-semibold">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">#104</td>
                    <td className="py-3.5 px-4 text-orange-400 font-bold">Table T-04</td>
                    <td className="py-3.5 px-4 text-slate-300">
                      Truffle Pizza, Paneer Tikka (x2), Cold Brew (x2), Choc Lava Cake
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">₹2,431.00</td>
                    <td className="py-3.5 px-4 text-emerald-400">UPI Settled</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        Billed &amp; Printed
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">#103</td>
                    <td className="py-3.5 px-4 text-slate-400">Table T-01</td>
                    <td className="py-3.5 px-4 text-slate-300">
                      Classic Cold Brew Latte (x3), Truffle Fries
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">₹890.00</td>
                    <td className="py-3.5 px-4 text-slate-300">Cash</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                        Closed
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">#102</td>
                    <td className="py-3.5 px-4 text-slate-400">Takeaway #12</td>
                    <td className="py-3.5 px-4 text-slate-300">
                      Artisanal Paneer Tikka (x1), Garlic Naan (x2)
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">₹540.00</td>
                    <td className="py-3.5 px-4 text-cyan-400">Card</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                        Dispatched
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "roles" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ROLE_PERSONAS.map((role) => (
              <div
                key={role.id}
                className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between hover:border-orange-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                      {role.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                      {role.badge}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-white mb-1">{role.subtitle}</h4>
                  <ul className="text-xs text-slate-400 mb-4 space-y-1">
                    {role.responsibilities.slice(0, 2).map((resp, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Role ID: {role.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => triggerOpenCredentialsModal()}
                    className="text-xs text-orange-400 hover:text-orange-300 font-bold cursor-pointer"
                  >
                    View PIN →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "compliance" && (
          <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-orange-400" />
              <span>Tax, FSSAI &amp; Accounting Export (India / Global)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">CGST @ 2.5%</span>
                <span className="text-xl font-black text-white">₹1,180.20</span>
                <span className="text-[10px] text-slate-500 block mt-1">SAC 996331 Restaurant Service</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">SGST @ 2.5%</span>
                <span className="text-xl font-black text-white">₹1,180.20</span>
                <span className="text-[10px] text-slate-500 block mt-1">State Jurisdiction Delhi (07)</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Total Tax Collected</span>
                <span className="text-xl font-black text-emerald-400">₹2,360.40</span>
                <span className="text-[10px] text-emerald-400/80 block mt-1">Ready for GSTR-1 Ledger Export</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => triggerOpenBillModal("gst")}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-orange-400" />
                <span>View GST B2B/B2C Tax Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => triggerOpenTermsModal("tax")}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tax Authority Invariants</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "s3sync" && (
          <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>S3 Bucket Media Storage &amp; Separation Protocol</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <p className="font-bold text-white mb-1">
                  Offline-First Data Isolation Principle
                </p>
                All sensitive customer data, orders, and payment records remain strictly stored in local SQLite WAL (`flo.db`) on the restaurant counter machine. S3 storage is reserved exclusively for restaurant branding assets, dish imagery, and opt-in encrypted telemetry backups.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>S3 Region:</span>
                  <span className="text-white">ap-south-1 (Mumbai)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Bucket Name:</span>
                  <span className="text-white">orderitup-media-assets</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Dish Images Stored:</span>
                  <span className="text-white">4 items (Unsplash CDN)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Sync Policy:</span>
                  <span className="text-emerald-400">Non-blocking background</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Local SQLite Size:</span>
                  <span className="text-white">4.8 MB (flo.db)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>WAL Journal Size:</span>
                  <span className="text-white">32 KB</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Offline Uptime:</span>
                  <span className="text-emerald-400">100% Uninterrupted</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Local Billing Latency:</span>
                  <span className="text-emerald-400">&lt; 10ms</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-slate-950 border-t border-slate-800 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            &copy; {new Date().getFullYear()} {BRAND.name}. Early-Stage Restaurant Technology Startup (Pre-Registration Pilot).
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition-colors">
              Landing Page
            </Link>
            <button
              type="button"
              onClick={() => triggerOpenTermsModal("terms")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Startup Terms
            </button>
            <button
              type="button"
              onClick={() => triggerOpenBillModal("standard")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              80mm Bill
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
