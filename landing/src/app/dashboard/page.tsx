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
} from "lucide-react";
import { BRAND } from "@/lib/constants";
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/auth";
import {
  triggerOpenAuthModal,
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
    type: "Dine-In & Cocktail Bar",
    todaySales: 48920,
    ordersCount: 48,
    avgTicket: 1019.16,
    activeTables: "8 / 12",
    tenders: { upi: 28420, cash: 14200, card: 6300 },
    topDish: "Truffle Mushroom Pizza",
    posTerminals: 2,
    status: "Operational",
    enginePort: ":3001 (POS) • :3002 (KDS)",
  },
  {
    id: "outlet-2",
    name: "Cyber Hub Express (QSR)",
    location: "DLF Cyber City, Gurugram",
    type: "High-Volume Counter & Delivery",
    todaySales: 64150,
    ordersCount: 112,
    avgTicket: 572.76,
    activeTables: "10 / 12",
    tenders: { upi: 49200, cash: 3000, card: 11950 },
    topDish: "Artisanal Paneer Tikka Wrap",
    posTerminals: 2,
    status: "Operational",
    enginePort: ":3001 (POS) • :3002 (KDS)",
  },
  {
    id: "outlet-3",
    name: "Airport Terminal 3 Hub",
    location: "IGI Airport T3 Departures",
    type: "24/7 Transit Cafe & Bakery",
    todaySales: 32400,
    ordersCount: 56,
    avgTicket: 578.57,
    activeTables: "4 / 8",
    tenders: { upi: 10200, cash: 2400, card: 19800 },
    topDish: "Classic Cold Brew Latte",
    posTerminals: 2,
    status: "Operational",
    enginePort: ":3001 (POS) • :3002 (KDS)",
  },
];

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  
  // High-Level Perspective: "founder" (Startup Owner) vs "merchant" (Multi-Outlet Restaurant Chain Owner)
  const [perspective, setPerspective] = useState<"founder" | "merchant">("founder");

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/95 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
            {/* Logo & Platform Title */}
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
            </div>

            {/* Top Perspective Switcher (Founder vs Chain Owner) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPerspective("founder")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  perspective === "founder"
                    ? "bg-[#F07928] text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Founder Admin</span>
              </button>
              <button
                type="button"
                onClick={() => setPerspective("merchant")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  perspective === "merchant"
                    ? "bg-[#F07928] text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Restaurant Chain Owner</span>
              </button>
            </div>

            {/* Quick Tools & Auth */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerOpenBillModal("standard")}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span className="hidden md:inline">80mm Bill</span>
              </button>

              <button
                type="button"
                onClick={() => triggerOpenCredentialsModal()}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Roles</span>
              </button>

              {currentUser ? (
                <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800">
                  <div
                    className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                    title={`${currentUser.name} (${currentUser.role})`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                      {currentUser.name.charAt(0)}
                    </div>
                    <span className="font-bold hidden xl:inline text-white">{currentUser.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => triggerOpenAuthModal("signup")}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-[#F07928] hover:bg-[#EA580C] shadow-xs cursor-pointer"
                >
                  Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* ========================================================================= */}
        {/* PERSPECTIVE 1: STARTUP FOUNDER ADMIN ("For Me: Manage Customers & Platform") */}
        {/* ========================================================================= */}
        {perspective === "founder" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Founder Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Platform Founder &amp; Startup Admin</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Restaurant Customer Management &amp; S3 Telemetry
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                  Manage your restaurant subscribers, issue hardware-bound desktop POS licenses, inspect tenant S3 buckets, and track platform-wide billing volume.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleCopyLicenseKey("OIU-2026-WIN-8942-X7K9")}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  title="Generate 16-character hardware-bound Windows POS license"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
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
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">Total Restaurant Tenants</span>
                  <Store className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-3xl font-black text-white">104 Brands</div>
                <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+12 restaurants this month</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">Active POS Counters</span>
                  <Layers className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-3xl font-black text-white">268 Terminals</div>
                <div className="mt-2 text-xs text-slate-400">
                  <span>100% Offline SQLite Engine</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">Platform 30-Day GMV</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white">₹1.84 Cr</div>
                <div className="mt-2 text-xs text-emerald-400 font-semibold">
                  <span>~ $220,500 Gross Billed</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">S3 Customer Storage</span>
                  <Cloud className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-black text-white">104 Buckets</div>
                <div className="mt-2 text-xs text-slate-400">
                  <span>Isolated tenant storage</span>
                </div>
              </div>
            </div>

            {/* Tenant Directory & Customer Management */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-400" />
                    <span>Restaurant Customers Directory</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
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
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500 w-48 sm:w-60"
                    />
                  </div>

                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-orange-500"
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
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-3 px-4 font-semibold">RESTAURANT BRAND</th>
                      <th className="py-3 px-4 font-semibold">OWNER / EMAIL</th>
                      <th className="py-3 px-4 font-semibold">PLAN TIER</th>
                      <th className="py-3 px-4 font-semibold">OUTLETS / POS</th>
                      <th className="py-3 px-4 font-semibold">30-DAY GMV</th>
                      <th className="py-3 px-4 font-semibold">S3 BUCKET ID</th>
                      <th className="py-3 px-4 font-semibold">SYNC STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-orange-400 shrink-0" />
                            <div>
                              <span>{tenant.businessName}</span>
                              <span className="block text-[10px] text-slate-400 font-mono font-normal">
                                {tenant.city}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="font-semibold block">{tenant.ownerName}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{tenant.ownerEmail}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            {tenant.tier}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          <span className="font-bold">{tenant.outletsCount} Outlets</span>
                          <span className="text-slate-500 block text-[10px]">
                            {tenant.activeTerminals} POS Terminals
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {tenant.monthGmv}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                          {tenant.s3Bucket}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
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
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                  <Database className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    S3 Bucket Multi-Tenant Isolation &amp; Zero Commingling Protocol
                  </h3>
                  <p className="text-xs text-slate-400">
                    How Order It Up keeps each restaurant customer&apos;s data strictly separated and privacy-compliant.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Local SQLite Sovereignty</span>
                  </span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    All transactions, billing tables, cash drawer solenoid signals, and KDS tickets reside in the local encrypted SQLite WAL on the merchant counter machine. Zero cloud latency.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-cyan-400" />
                    <span>Dedicated S3 Buckets</span>
                  </span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Each restaurant tenant receives their own dedicated, isolated Amazon S3 bucket prefix for dish photography, digital menus, and encrypted daily accounting rollups.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Network className="w-4 h-4 text-amber-400" />
                    <span>Inter-Store Mesh Sync</span>
                  </span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Chain owners can view sales from each and every connected restaurant without exposing sensitive financial records to third parties.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PERSPECTIVE 2: RESTAURANT CHAIN OWNER ("For Users: Connected Outlets")    */}
        {/* ========================================================================= */}
        {perspective === "merchant" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Merchant Chain Header */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <Network className="w-3.5 h-3.5" />
                  <span>Connected Restaurant Chain View</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Spice Route Hospitality Group • 3 Connected Outlets
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                  Real-time sales, order throughput, and live counter telemetry across all your restaurant branches. Connected in real-time.
                </p>
              </div>

              {/* Outlet Selector Dropdown */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <select
                    value={selectedOutlet}
                    onChange={(e) => setSelectedOutlet(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2.5 rounded-xl bg-slate-950 border border-orange-500/40 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs cursor-pointer"
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
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-orange-400" />
                  <span>Consolidated Z-Report</span>
                </button>
              </div>
            </div>

            {/* Aggregated Chain Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">
                    {selectedOutlet === "all" ? "Total Chain Sales Today" : "Outlet Sales Today"}
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white">
                  ₹{selectedOutlet === "all"
                    ? totalChainSales.toLocaleString("en-IN")
                    : CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.todaySales.toLocaleString("en-IN")}
                  .00
                </div>
                <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+22.8% vs last week across branches</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">
                    {selectedOutlet === "all" ? "Chain Orders Processed" : "Outlet Orders"}
                  </span>
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-3xl font-black text-white">
                  {selectedOutlet === "all"
                    ? `${totalChainOrders} Orders`
                    : `${CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.ordersCount} Orders`}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  <span>100% Settled • 0 Payment Drops</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">Average Order Ticket</span>
                  <Receipt className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-black text-white">
                  ₹{selectedOutlet === "all"
                    ? avgChainTicket
                    : CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.avgTicket}
                </div>
                <div className="mt-2 text-xs text-amber-400 font-medium">
                  <span>Across all dining &amp; QSR formats</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="font-semibold uppercase tracking-wider">Active Floor Tables</span>
                  <Users className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-3xl font-black text-white">
                  {selectedOutlet === "all" ? "22 / 32 Tables" : CHAIN_OUTLETS.find((o) => o.id === selectedOutlet)?.activeTables}
                </div>
                <div className="mt-2 text-xs text-cyan-400 font-medium">
                  <span>Real-time tableside seating (:3003)</span>
                </div>
              </div>
            </div>

            {/* Per-Restaurant Sales Cards: "How much sales has been done in each and every restaurant" */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Store className="w-4 h-4 text-orange-400" />
                    <span>Live Sales By Restaurant Outlet (Connected Network)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Compare performance, order velocity, and counter hardware status across every restaurant location.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  Auto-refreshing via LAN/S3 mesh
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {CHAIN_OUTLETS.map((outlet, index) => {
                  const percentageOfChain = Math.round((outlet.todaySales / totalChainSales) * 100);
                  const isSelected = selectedOutlet === "all" || selectedOutlet === outlet.id;

                  return (
                    <div
                      key={outlet.id}
                      onClick={() => setSelectedOutlet(outlet.id)}
                      className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-slate-900/90 border-orange-500/50 shadow-lg shadow-orange-500/5"
                          : "bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-90"
                      }`}
                    >
                      <div>
                        {/* Header badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider font-mono">
                            Outlet #{index + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{outlet.status}</span>
                          </span>
                        </div>

                        <h4 className="text-lg font-black text-white">{outlet.name}</h4>
                        <p className="text-xs text-slate-400 mb-4">{outlet.location}</p>

                        {/* Today Sales Callout */}
                        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 mb-4">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-0.5 font-semibold">
                            Today&apos;s Gross Sales
                          </span>
                          <div className="text-2xl font-black text-white">
                            ₹{outlet.todaySales.toLocaleString("en-IN")}.00
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-400 font-mono">
                            <span>{outlet.ordersCount} orders</span>
                            <span className="text-orange-400 font-bold">{percentageOfChain}% of chain</span>
                          </div>
                        </div>

                        {/* Tenders Breakdown */}
                        <div className="space-y-1.5 text-xs font-mono text-slate-300 mb-4">
                          <div className="flex justify-between">
                            <span className="text-slate-400">UPI Dynamic QR:</span>
                            <span className="text-emerald-400 font-bold">₹{outlet.tenders.upi.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cash (24V Till):</span>
                            <span>₹{outlet.tenders.cash.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Card POS Machine:</span>
                            <span>₹{outlet.tenders.card.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer & Deep Link */}
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-mono">
                          Top: {outlet.topDish}
                        </span>
                        <span className="text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Inspect</span>
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
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                      <Share2 className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        Connected Central Menu Catalog
                      </h4>
                      <p className="text-xs text-slate-400">
                        Unified recipes synced across all 3 outlets with branch price overrides.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Truffle Mushroom Pizza</span>
                      <span className="text-[10px] text-slate-500">Live across Downtown Bistro &amp; Cyber Hub</span>
                    </div>
                    <span className="font-bold text-white">₹540.00</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Artisanal Paneer Tikka</span>
                      <span className="text-[10px] text-slate-500">Synced to Tandoor Station KDS</span>
                    </div>
                    <span className="font-bold text-white">₹380.00</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Classic Cold Brew Latte</span>
                      <span className="text-[10px] text-slate-500">Airport T3 (+15% transit tier)</span>
                    </div>
                    <span className="font-bold text-white">₹220.00</span>
                  </div>
                </div>
              </div>

              {/* Consolidated Chain Tax & GST Report */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        Consolidated Indian GST &amp; Compliance
                      </h4>
                      <p className="text-xs text-slate-400">
                        Aggregated CGST &amp; SGST ledger across all 3 outlets for GSTR-1 filing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block mb-1">CGST @ 2.5%</span>
                    <span className="text-lg font-black text-white">₹3,523.35</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block mb-1">SGST @ 2.5%</span>
                    <span className="text-lg font-black text-white">₹3,523.35</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">Total Chain Tax Collected:</span>
                    <span className="text-[10px] text-slate-500">SAC 996331 Restaurant Catering</span>
                  </div>
                  <span className="text-lg font-black text-emerald-400 font-mono">₹7,046.70</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => triggerOpenBillModal("gst")}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5 text-orange-400" />
                    <span>View B2B GST Invoice Format</span>
                  </button>
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
            &copy; {new Date().getFullYear()} {BRAND.name}. Offline-First Multi-Unit Operating System.
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
