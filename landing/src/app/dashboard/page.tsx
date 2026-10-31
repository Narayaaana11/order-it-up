"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Cloud,
  FileSpreadsheet,
  Building2,
  Network,
  Share2,
  Layers,
  Search,
  ChevronRight,
  Database,
  Copy,
  Check,
  Sparkles,
  Cpu,
} from "lucide-react";
import { BRAND } from "@/lib/constants";
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/auth";
import {
  triggerOpenBillModal,
  triggerOpenTermsModal,
  triggerOpenCredentialsModal,
} from "@/lib/modalEvents";

// Mock Data: Platform Tenants (For Startup Founder Perspective)
const PLATFORM_TENANTS = [
  {
    id: "tenant-0892",
    businessName: "Spice Route Hospitality Group",
    ownerName: "Priya Sharma",
    ownerEmail: "priya@spiceroute.in",
    tier: "Enterprise Chain",
    outletsCount: 3,
    activeTerminals: 6,
    s3Bucket: "orderitup-tenant-spiceroute",
    monthGmv: "₹14,85,200",
    lastSync: "2 mins ago",
    status: "Active",
    city: "New Delhi & Gurugram",
  },
  {
    id: "tenant-0441",
    businessName: "Urban Bites Fast-Casual Co.",
    ownerName: "Amit Verma",
    ownerEmail: "amit@urbanbites.co",
    tier: "Pro Multi-Outlet",
    outletsCount: 2,
    activeTerminals: 4,
    s3Bucket: "orderitup-tenant-urbanbites",
    monthGmv: "₹8,92,400",
    lastSync: "5 mins ago",
    status: "Active",
    city: "Bengaluru",
  },
  {
    id: "tenant-0129",
    businessName: "Cafe Milano Roasters",
    ownerName: "Marco Rossi",
    ownerEmail: "marco@cafemilano.com",
    tier: "Single Store Pilot",
    outletsCount: 1,
    activeTerminals: 2,
    s3Bucket: "orderitup-tenant-milano",
    monthGmv: "₹4,20,100",
    lastSync: "1 min ago",
    status: "Active",
    city: "Mumbai",
  },
  {
    id: "tenant-0773",
    businessName: "The Coastal Catch Bistro",
    ownerName: "Sunita Rao",
    ownerEmail: "sunita@coastalcatch.in",
    tier: "Enterprise Chain",
    outletsCount: 4,
    activeTerminals: 8,
    s3Bucket: "orderitup-tenant-coastal",
    monthGmv: "₹21,40,900",
    lastSync: "4 mins ago",
    status: "Active",
    city: "Goa & Kochi",
  },
];

// Mock Data: Connected Outlets for Chain Owner (Priya Sharma's 3 branches)
const CHAIN_OUTLETS = [
  {
    id: "outlet-1",
    name: "Downtown Bistro (Flagship)",
    location: "Connaught Place, New Delhi",
    type: "Fine Dine & Craft Cocktail Bar",
    todaySales: 48920,
    ordersCount: 48,
    avgTicket: 1019.16,
    activeTables: "8 / 12",
    tenders: { upi: 28420, cash: 14200, card: 6300 },
    topDish: "Truffle Mushroom Pizza",
    posTerminals: 2,
    status: "Operational",
    enginePort: ":3001 (POS Engine) • :3002 (KDS)",
    hardware: "2x 80mm ESC/POS Printers • 24V Solenoid Till Active",
  },
  {
    id: "outlet-2",
    name: "Cyber Hub Express (QSR)",
    location: "DLF Cyber City, Gurugram",
    type: "High-Volume Counter & Online Aggregators",
    todaySales: 64150,
    ordersCount: 112,
    avgTicket: 572.76,
    activeTables: "10 / 12",
    tenders: { upi: 49200, cash: 3000, card: 11950 },
    topDish: "Artisanal Paneer Tikka Wrap",
    posTerminals: 2,
    status: "Operational",
    enginePort: ":3001 (POS Engine) • :3002 (KDS)",
    hardware: "2x 80mm ESC/POS Printers • Kitchen Bump Bar Active",
  },
  {
    id: "outlet-3",
    name: "Airport Terminal 3 Hub",
    location: "IGI Airport T3 Departures",
    type: "24/7 Transit Cafe & Grab-and-Go",
    todaySales: 32400,
    ordersCount: 56,
    avgTicket: 578.57,
    activeTables: "4 / 8",
    tenders: { upi: 10200, cash: 2400, card: 19800 },
    topDish: "Classic Cold Brew Latte",
    posTerminals: 2,
    status: "Operational",
    enginePort: ":3001 (POS Engine) • :3002 (KDS)",
    hardware: "1x 80mm ESC/POS Printer • Standalone Barcode Terminal",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // High-Level Perspective: "merchant" (Multi-Restaurant Chain Owner) vs "founder" (Startup Founder Admin)
  const [perspective, setPerspective] = useState<"merchant" | "founder">("merchant");

  // Merchant Perspective States: Selected Outlet ("all" or outlet id)
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all");

  // Founder Perspective States: Search term & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
    router.push("/");
  };

  const handleCopyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Calculations for Multi-Outlet Chain Owner
  const totalChainSales = CHAIN_OUTLETS.reduce((acc, o) => acc + o.todaySales, 0);
  const totalChainOrders = CHAIN_OUTLETS.reduce((acc, o) => acc + o.ordersCount, 0);
  const avgChainTicket = Math.round(totalChainSales / totalChainOrders);

  // Filtered tenants for Founder view
  const filteredTenants = PLATFORM_TENANTS.filter((t) => {
    const matchesSearch =
      t.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === "all" || t.tier.toLowerCase().includes(tierFilter.toLowerCase());
    return matchesSearch && matchesTier;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Header (Matching Landing Page Style) */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
            {/* Logo & Return to Home */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 group p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
                title="Return to Landing Page"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <Link href="/" className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="Order It Up Logo"
                  className="h-9 w-9 object-contain"
                />
                <span className="text-xl font-black tracking-tight text-slate-900 whitespace-nowrap">
                  {BRAND.name}
                </span>
              </Link>
            </div>

            {/* Perspective Switcher (Founder vs Multi-Restaurant Chain) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setPerspective("merchant")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  perspective === "merchant"
                    ? "bg-[#F07928] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Restaurant Chain Owner</span>
              </button>
              <button
                type="button"
                onClick={() => setPerspective("founder")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  perspective === "founder"
                    ? "bg-[#F07928] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Founder Admin</span>
              </button>
            </div>

            {/* Quick Tools & Session Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerOpenBillModal("standard")}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-orange-600" />
                <span className="hidden md:inline">80mm Bill</span>
              </button>

              <button
                type="button"
                onClick={() => triggerOpenCredentialsModal()}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden md:inline">Roles</span>
              </button>

              {currentUser && (
                <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800"
                    title={`${currentUser.name} (${currentUser.role})`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                      {currentUser.name.charAt(0)}
                    </div>
                    <span className="font-bold hidden xl:inline text-xs">{currentUser.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* ========================================================================= */}
        {/* PERSPECTIVE 1: RESTAURANT CHAIN OWNER ("For Users: Connected Outlets")    */}
        {/* ========================================================================= */}
        {perspective === "merchant" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Merchant Chain Hero Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold uppercase tracking-wider">
                  <Network className="w-3.5 h-3.5 text-orange-600" />
                  <span>Connected Restaurant Chain View</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Spice Route Hospitality Group • 3 Connected Outlets
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  Real-time sales, order throughput, and live LAN counter telemetry across all your restaurant branches. Connected in real-time with isolated offline durability.
                </p>
              </div>

              {/* Outlet Selector Dropdown */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
                <div className="relative">
                  <select
                    value={selectedOutlet}
                    onChange={(e) => setSelectedOutlet(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2.5 rounded-xl bg-slate-50 border border-orange-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs cursor-pointer"
                  >
                    <option value="all">🌐 All Outlets (Consolidated Chain)</option>
                    <option value="outlet-1">📍 Outlet 1: Downtown Bistro</option>
                    <option value="outlet-2">📍 Outlet 2: Cyber Hub Express</option>
                    <option value="outlet-3">📍 Outlet 3: Airport Terminal 3</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("zreport")}
                  className="px-4 py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-xs font-bold text-white flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Consolidated Z-Report</span>
                </button>
              </div>
            </div>

            {/* Aggregated Chain Metric Cards (Landing Page White Card Style) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">
                    {selectedOutlet === "all" ? "Total Chain Sales Today" : "Outlet Sales Today"}
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">
                  ₹{selectedOutlet === "all"
                    ? totalChainSales.toLocaleString("en-IN")
                    : CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.todaySales.toLocaleString("en-IN")}
                  .00
                </div>
                <div className="mt-2 text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+22.8% vs last week across branches</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">
                    {selectedOutlet === "all" ? "Chain Orders Processed" : "Outlet Orders"}
                  </span>
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {selectedOutlet === "all"
                    ? `${totalChainOrders} Orders`
                    : `${CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.ordersCount} Orders`}
                </div>
                <div className="mt-2 text-xs text-slate-500 font-medium">
                  <span>100% Settled • 0 Payment Drops</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">Average Order Ticket</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">
                  ₹{selectedOutlet === "all"
                    ? avgChainTicket
                    : CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.avgTicket}
                </div>
                <div className="mt-2 text-xs text-amber-700 font-medium">
                  <span>Across dining, QSR, &amp; grab-and-go</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">Active Floor Tables</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {selectedOutlet === "all" ? "22 / 32 Tables" : CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.activeTables}
                </div>
                <div className="mt-2 text-xs text-blue-700 font-medium">
                  <span>Real-time tableside seating (:3003)</span>
                </div>
              </div>
            </div>

            {/* Per-Restaurant Sales Cards: "How much sales has been done in each and every restaurant" */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Store className="w-5 h-5 text-orange-600" />
                    <span>Live Sales By Restaurant Outlet (Connected Network)</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Compare performance, order velocity, and counter hardware status across every restaurant location.
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                  Syncing via Local LAN + S3 Mesh
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {CHAIN_OUTLETS.map((outlet, index) => {
                  const percentageOfChain = Math.round((outlet.todaySales / totalChainSales) * 100);
                  const isSelected = selectedOutlet === "all" || selectedOutlet === outlet.id;

                  return (
                    <div
                      key={outlet.id}
                      onClick={() => setSelectedOutlet(outlet.id)}
                      className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-white border-orange-400 shadow-md ring-2 ring-orange-500/20"
                          : "bg-white/80 border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      <div>
                        {/* Header badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider font-mono">
                            Outlet #{index + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{outlet.status}</span>
                          </span>
                        </div>

                        <h4 className="text-lg font-black text-slate-900">{outlet.name}</h4>
                        <p className="text-xs text-slate-500 mb-4">{outlet.location}</p>

                        {/* Today Sales Callout */}
                        <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200/80 mb-4">
                          <span className="text-[10px] text-orange-800 uppercase tracking-wider block mb-0.5 font-bold">
                            Today&apos;s Gross Sales
                          </span>
                          <div className="text-2xl font-black text-slate-900">
                            ₹{outlet.todaySales.toLocaleString("en-IN")}.00
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-600 font-mono">
                            <span>{outlet.ordersCount} orders</span>
                            <span className="text-orange-700 font-bold">{percentageOfChain}% of chain</span>
                          </div>
                        </div>

                        {/* Tenders Breakdown */}
                        <div className="space-y-1.5 text-xs font-mono text-slate-700 mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                          <div className="flex justify-between">
                            <span className="text-slate-500">UPI Dynamic QR:</span>
                            <span className="text-emerald-700 font-bold">₹{outlet.tenders.upi.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Cash (24V Till):</span>
                            <span>₹{outlet.tenders.cash.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Card POS Machine:</span>
                            <span>₹{outlet.tenders.card.toLocaleString("en-IN")}</span>
                          </div>
                        </div>

                        {/* Hardware Connectivity Status */}
                        <div className="text-[11px] text-slate-600 space-y-1 mb-4">
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                            <Cpu className="w-3.5 h-3.5 text-slate-400" />
                            <span>{outlet.enginePort}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                            <Printer className="w-3.5 h-3.5 text-slate-400" />
                            <span>{outlet.hardware}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer & Deep Link */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-mono">
                          Top: {outlet.topDish}
                        </span>
                        <span className="text-orange-600 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Inspect Outlet</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Connected Workflows: Cross-Outlet Central Menu & Tax Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Centralized Menu & Inter-Branch Sync */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Connected Central Menu Catalog
                      </h4>
                      <p className="text-xs text-slate-500">
                        Unified recipes synced across all 3 outlets with branch price overrides.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Truffle Mushroom Pizza</span>
                      <span className="text-[11px] text-slate-500 font-sans">Synced across Downtown Bistro &amp; Cyber Hub</span>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">₹540.00</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Artisanal Paneer Tikka</span>
                      <span className="text-[11px] text-slate-500 font-sans">Synced to Tandoor Station KDS (:3002)</span>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">₹380.00</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Classic Cold Brew Latte</span>
                      <span className="text-[11px] text-slate-500 font-sans">Airport T3 Hub (+15% transit tier)</span>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">₹220.00</span>
                  </div>
                </div>
              </div>

              {/* Consolidated Chain Tax & GST Report */}
              <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Consolidated Indian GST &amp; Compliance
                      </h4>
                      <p className="text-xs text-slate-500">
                        Aggregated CGST &amp; SGST ledger across all 3 outlets for GSTR-1 filing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-slate-500 block mb-1 font-sans">CGST @ 2.5%</span>
                    <span className="text-xl font-black text-slate-900">₹3,523.35</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-slate-500 block mb-1 font-sans">SGST @ 2.5%</span>
                    <span className="text-xl font-black text-slate-900">₹3,523.35</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-950 block">Total Chain Tax Collected:</span>
                    <span className="text-[11px] text-emerald-800">SAC 996331 Restaurant Catering</span>
                  </div>
                  <span className="text-xl font-black text-emerald-800 font-mono">₹7,046.70</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => triggerOpenBillModal("gst")}
                    className="w-full py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>View Official GST Tax Invoice Format</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PERSPECTIVE 2: STARTUP FOUNDER ADMIN ("For Me: Manage Customers & S3")    */}
        {/* ========================================================================= */}
        {perspective === "founder" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Founder Hero Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <span>Platform Founder &amp; Startup Admin</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Restaurant Customer Management &amp; S3 Telemetry
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  Manage your restaurant subscribers, issue hardware-bound desktop POS licenses, inspect tenant S3 buckets, and track platform-wide billing volume.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 relative z-10">
                <button
                  type="button"
                  onClick={() => handleCopyLicenseKey("OIU-2026-WIN-8942-X7K9")}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  title="Generate 16-character hardware-bound Windows POS license"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-orange-600" />}
                  <span>{copiedKey ? "License Key Copied!" : "Generate License Key"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerOpenTermsModal("terms")}
                  className="px-4 py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  SaaS Master Agreement
                </button>
              </div>
            </div>

            {/* Founder Global KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">Total Restaurant Tenants</span>
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                    <Store className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">104 Brands</div>
                <div className="mt-2 text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+12 restaurants this month</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">Active POS Counters</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">268 Terminals</div>
                <div className="mt-2 text-xs text-slate-500">
                  <span>100% Offline SQLite Engine</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">Platform 30-Day GMV</span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">₹1.84 Cr</div>
                <div className="mt-2 text-xs text-emerald-700 font-semibold">
                  <span>~ $220,500 Gross Billed</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider">S3 Customer Storage</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Cloud className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900">104 Buckets</div>
                <div className="mt-2 text-xs text-slate-500">
                  <span>Isolated tenant storage</span>
                </div>
              </div>
            </div>

            {/* Tenant Directory & Customer Management */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-600" />
                    <span>Restaurant Customers Directory</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Search and manage your registered restaurant brands, outlets, and POS counter nodes.
                  </p>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search restaurant, owner, city..."
                      className="pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 w-48 sm:w-64"
                    />
                  </div>

                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-orange-500"
                  >
                    <option value="all">All Plan Tiers</option>
                    <option value="enterprise">Enterprise Chain</option>
                    <option value="pro">Pro Multi-Outlet</option>
                    <option value="single">Single Store Pilot</option>
                  </select>
                </div>
              </div>

              {/* Customers Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-3 px-4 font-bold">RESTAURANT BRAND</th>
                      <th className="py-3 px-4 font-bold">OWNER / EMAIL</th>
                      <th className="py-3 px-4 font-bold">PLAN TIER</th>
                      <th className="py-3 px-4 font-bold">OUTLETS / POS</th>
                      <th className="py-3 px-4 font-bold">30-DAY GMV</th>
                      <th className="py-3 px-4 font-bold">S3 BUCKET ID</th>
                      <th className="py-3 px-4 font-bold">SYNC STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <Store className="w-4 h-4 text-orange-600 shrink-0" />
                            <div>
                              <span>{tenant.businessName}</span>
                              <span className="block text-[11px] text-slate-500 font-mono font-normal">
                                {tenant.city}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-700">
                          <span className="font-semibold block">{tenant.ownerName}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{tenant.ownerEmail}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            {tenant.tier}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-800">
                          <span className="font-bold">{tenant.outletsCount} Outlets</span>
                          <span className="text-slate-500 block text-[10px]">
                            {tenant.activeTerminals} POS Terminals
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-emerald-700">
                          {tenant.monthGmv}
                        </td>
                        <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                          {tenant.s3Bucket}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{tenant.lastSync}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* S3 Architecture & Data Isolation Invariant */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    S3 Bucket Multi-Tenant Isolation &amp; Zero Commingling Protocol
                  </h3>
                  <p className="text-xs text-slate-500">
                    How Order It Up keeps each restaurant customer&apos;s data strictly separated and privacy-compliant.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Local SQLite Sovereignty</span>
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    All transactions, billing tables, cash drawer solenoid signals, and KDS tickets reside in the local encrypted SQLite WAL on the merchant counter machine. Zero cloud latency.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    <span>Dedicated S3 Buckets</span>
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Each restaurant tenant receives their own dedicated, isolated Amazon S3 bucket prefix for dish photography, digital menus, and encrypted daily accounting rollups.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Network className="w-4 h-4 text-orange-600" />
                    <span>Inter-Store Mesh Sync</span>
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Chain owners can view sales from each and every connected restaurant without exposing sensitive financial records to third parties.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            &copy; {new Date().getFullYear()} {BRAND.name}. Offline-First Multi-Unit Operating System.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Landing Page
            </Link>
            <button
              type="button"
              onClick={() => triggerOpenTermsModal("terms")}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Startup Terms
            </button>
            <button
              type="button"
              onClick={() => triggerOpenBillModal("standard")}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              80mm Bill
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
