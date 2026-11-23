"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Smartphone,
  ChefHat,
  Store,
  FileSpreadsheet,
  UserCog,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Receipt,
  Check,
  X,
  Download,
  Sparkles,
} from "lucide-react";
import { ROLE_PERSONAS } from "@/lib/constants";

interface PersonaConfig {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  iconName: string;
  accentColor: string;
  deepLink: string;
  deepLinkLabel: string;
  platformScope: string;
  kpis: { label: string; value: string; hint: string }[];
  responsibilities: string[];
}

const SHOWCASE_PERSONAS: PersonaConfig[] = [
  {
    id: "owner",
    title: "Restaurant Owner",
    subtitle: "Multi-Branch Franchise & Executive Cloud HQ",
    badge: "Cloud HQ :443",
    iconName: "Store",
    accentColor: "from-orange-500 to-amber-500",
    deepLink: "/cloud-portal",
    deepLinkLabel: "Launch Cloud HQ Portal",
    platformScope: "Web SaaS & Desktop Executive View",
    kpis: [
      { label: "Chain Gross Sales", value: "₹3,42,850", hint: "+18.4% vs last week" },
      { label: "Active Outlets", value: "3 / 3 Online", hint: "Connaught, CyberHub, 100ft" },
      { label: "Blended Food Cost", value: "28.4%", hint: "Target < 30%" },
    ],
    responsibilities: [
      "Real-time franchise revenue rollup across all physical locations",
      "Cryptographic 6-digit PIN device pairing for counter terminals",
      "Global catalog price overrides and master recipe synchronization",
      "Multi-tenant staff role governance and branch audit logs",
    ],
  },
  {
    id: "manager",
    title: "Branch Manager",
    subtitle: "Store Operations, Table Turnover & Shift Control",
    badge: "Operations GM",
    iconName: "UserCog",
    accentColor: "from-sky-500 to-blue-600",
    deepLink: "/dashboard",
    deepLinkLabel: "Open Store Dashboard",
    platformScope: "Web Dashboard & Desktop Operations",
    kpis: [
      { label: "Avg Table Turnover", value: "42 min", hint: "Target: < 45m" },
      { label: "Active Floor Staff", value: "8 / 8 On Duty", hint: "Zero absenteeism" },
      { label: "Shift Voids / Refunds", value: "₹1,450", hint: "Master PIN Protected" },
    ],
    responsibilities: [
      "Master Manager PIN overrides for bill cancellations, voids, and discounts",
      "Live table turnover velocity, seating capacity, and floor bottleneck alerts",
      "Shift opening float authorization and cashier variance balancing",
      "Detailed staff audit logs tracking every tender modification",
    ],
  },
  {
    id: "cashier",
    title: "Counter Cashier",
    subtitle: "Sub-3-Second Checkout & Offline Billing",
    badge: "Sub-3s Billing",
    iconName: "CreditCard",
    accentColor: "from-emerald-500 to-teal-600",
    deepLink: "/pos",
    deepLinkLabel: "Explore Counter POS",
    platformScope: "Electron Desktop & Flutter Mobile POS",
    kpis: [
      { label: "Bills Settled", value: "142 Bills", hint: "Shift volume" },
      { label: "Avg Settlement Speed", value: "2.4s", hint: "Sub-3s benchmark" },
      { label: "Drawer Cash Float", value: "₹18,450", hint: "Balanced to zero variance" },
    ],
    responsibilities: [
      "Lightning-fast barcode scanning and product search",
      "Dynamic split billing (Cash, Cards, UPI QR, Split Tenders)",
      "Instant 80mm thermal receipt printing & 24V drawer kick",
      "Shift opening float management and daily cash reconciliation",
    ],
  },
  {
    id: "waiter",
    title: "Floor Captain & Server",
    subtitle: "Tableside Handheld Ordering & Course Firing",
    badge: "Mobile Handheld :3003",
    iconName: "Smartphone",
    accentColor: "from-amber-500 to-orange-600",
    deepLink: "/tables",
    deepLinkLabel: "Explore Table Floorplan",
    platformScope: "Flutter Mobile & Standalone Server Web",
    kpis: [
      { label: "Active Tables", value: "4 / 6 Occupied", hint: "16 Dining Guests" },
      { label: "Pending Course Fires", value: "2 Mains", hint: "Ready for Kitchen" },
      { label: "Avg Order Entry", value: "38s", hint: "Tableside handheld" },
    ],
    responsibilities: [
      "Real-time table status monitoring (Available, Occupied, Billed)",
      "Tableside order taking and course firing from mobile phones",
      "Item modifier selection (Spice level, cooking temperature, allergies)",
      "Zero-config 6-digit ephemeral PIN device pairing",
    ],
  },
  {
    id: "chef",
    title: "Kitchen Station Chef",
    subtitle: "Zero-Lag Touch KDS & Station Routing",
    badge: "LAN KDS :3002",
    iconName: "ChefHat",
    accentColor: "from-rose-500 to-red-600",
    deepLink: "/kds",
    deepLinkLabel: "Open Kitchen Display System",
    platformScope: "LAN KDS Screen & Kitchen Tablet",
    kpis: [
      { label: "Active Kitchen Tickets", value: "3 Tickets", hint: "Across Bar & Grill" },
      { label: "SLA On-Time Rate", value: "96.4%", hint: "Completed < 12m" },
      { label: "Avg Prep Velocity", value: "7.2 min", hint: "Peak hour pace" },
    ],
    responsibilities: [
      "Dedicated touch-friendly KDS screen with zero browser lag",
      "One-tap ticket bumping from Pending to Preparing to Ready",
      "Color-coded SLA alert timers (<8m green, 8-15m amber, >15m red)",
      "Station routing: Bar, Oven, Grill, Fryer, Main Kitchen",
    ],
  },
  {
    id: "accountant",
    title: "Head Accountant",
    subtitle: "Automated Tax Audit, Cash Reconciliation & Tally XML",
    badge: "GST / VAT & Tally",
    iconName: "FileSpreadsheet",
    accentColor: "from-purple-500 to-indigo-600",
    deepLink: "/reports",
    deepLinkLabel: "View Financial Reports",
    platformScope: "Web SaaS Financial Portal",
    kpis: [
      { label: "Gross Taxable Value", value: "₹2,48,000", hint: "Current month" },
      { label: "Total Split GST", value: "₹12,400", hint: "2.5% CGST + 2.5% SGST" },
      { label: "Cash Variance", value: "₹0.00", hint: "Perfect match" },
    ],
    responsibilities: [
      "Automated split GST tax calculations (CGST 2.5%, SGST 2.5%)",
      "Daily Z-report cash closures with expected vs counted balances",
      "One-click Tally XML export for external accounting systems",
      "Archival tax audit reports with tamper-evident serial numbers",
    ],
  },
];

export default function RolePersonas() {
  const [selectedRole, setSelectedRole] = useState<string>("owner");

  // Interactive state for Owner simulator
  const [pairingPin, setPairingPin] = useState<string>("849 201");
  const [pairingCopied, setPairingCopied] = useState<boolean>(false);

  // Interactive state for Manager simulator
  const [refundStatus, setRefundStatus] = useState<"pending" | "approved" | "rejected">("pending");

  // Interactive state for Cashier simulator
  const [tenderMethod, setTenderMethod] = useState<"split" | "upi" | "cash">("split");
  const [receiptPrinted, setReceiptPrinted] = useState<boolean>(false);

  // Interactive state for Waiter simulator
  const [tables, setTables] = useState<
    { id: string; name: string; pax: number; status: "vacant" | "occupied" | "billed"; time: string }[]
  >([
    { id: "T1", name: "Table 1", pax: 2, status: "occupied", time: "38m" },
    { id: "T2", name: "Table 2", pax: 4, status: "billed", time: "52m" },
    { id: "T3", name: "Table 3", pax: 6, status: "vacant", time: "-" },
    { id: "T4", name: "Table 4", pax: 2, status: "occupied", time: "14m" },
    { id: "T5", name: "Table 5", pax: 4, status: "vacant", time: "-" },
    { id: "T6", name: "Table 6", pax: 8, status: "occupied", time: "44m" },
  ]);

  // Interactive state for Chef simulator
  const [kdsTickets, setKdsTickets] = useState<
    { id: number; table: string; items: string[]; status: "Preparing" | "Ready" | "Served"; elapsed: string; sla: "green" | "amber" | "gray" }[]
  >([
    { id: 108, table: "Table 3", items: ["1x Truffle Pizza", "1x Garlic Bread"], status: "Preparing", elapsed: "4m 12s", sla: "green" },
    { id: 107, table: "Table 1", items: ["2x Butter Chicken", "4x Garlic Naan"], status: "Ready", elapsed: "10m 45s", sla: "amber" },
    { id: 106, table: "Takeaway #12", items: ["1x Hyderabadi Biryani"], status: "Served", elapsed: "16m 02s", sla: "gray" },
  ]);

  // Interactive state for Accountant simulator
  const [exportingTally, setExportingTally] = useState<boolean>(false);
  const [exportComplete, setExportComplete] = useState<boolean>(false);

  // Look up active persona with fallback
  const activePersona =
    SHOWCASE_PERSONAS.find((r) => r.id === selectedRole) ||
    SHOWCASE_PERSONAS.find((r) => r.id === ROLE_PERSONAS[0].id) ||
    SHOWCASE_PERSONAS[0];

  const renderRoleIcon = (iconName: string) => {
    switch (iconName) {
      case "Store":
        return <Store className="w-5 h-5" />;
      case "UserCog":
        return <UserCog className="w-5 h-5" />;
      case "CreditCard":
        return <CreditCard className="w-5 h-5" />;
      case "Smartphone":
        return <Smartphone className="w-5 h-5" />;
      case "ChefHat":
        return <ChefHat className="w-5 h-5" />;
      case "FileSpreadsheet":
        return <FileSpreadsheet className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  const handleGeneratePin = () => {
    const random1 = Math.floor(100 + Math.random() * 900);
    const random2 = Math.floor(100 + Math.random() * 900);
    setPairingPin(`${random1} ${random2}`);
    setPairingCopied(true);
    setTimeout(() => setPairingCopied(false), 2000);
  };

  const handleToggleTable = (tableId: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        if (t.status === "vacant") return { ...t, status: "occupied", time: "1m" };
        if (t.status === "occupied") return { ...t, status: "billed", time: "45m" };
        return { ...t, status: "vacant", time: "-" };
      })
    );
  };

  const handleBumpTicket = (ticketId: number) => {
    setKdsTickets((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== ticketId) return ticket;
        if (ticket.status === "Preparing") {
          return { ...ticket, status: "Ready", sla: "amber" };
        }
        if (ticket.status === "Ready") {
          return { ...ticket, status: "Served", sla: "gray" };
        }
        return { ...ticket, status: "Preparing", sla: "green" };
      })
    );
  };

  const handleExportTally = () => {
    setExportingTally(true);
    setExportComplete(false);
    setTimeout(() => {
      setExportingTally(false);
      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 4000);
    }, 1200);
  };

  return (
    <section id="roles" className="py-20 lg:py-28 bg-slate-50 border-t border-slate-200 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-orange-200/30 via-sky-200/20 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100/80 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-widest mb-3 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Interactive Role Showcase</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Tailored Experiences for Every Restaurant Role
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Switch between the 6 operational personas below to preview live role workflows,
            hardware gates, and deep links into Order It Up&apos;s modular operating system.
          </p>
        </div>

        {/* 6 Interactive Role Tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-2 sm:gap-3">
          {SHOWCASE_PERSONAS.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 ring-2 ring-orange-500/80"
                    : "bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-xs"
                }`}
              >
                <span className={isSelected ? "text-orange-400" : "text-slate-500"}>
                  {renderRoleIcon(role.iconName)}
                </span>
                <span>{role.title}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-white/10 text-orange-200" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {role.badge.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Selected Role Card Showcase Stage */}
        <div className="mt-8 max-w-5xl mx-auto rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl shadow-slate-200/50 overflow-hidden transition-all duration-300">
          {/* Stage Top Meta Ribbon */}
          <div className="p-6 sm:p-8 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {activePersona.title}
                </span>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 font-semibold">
                  {activePersona.badge}
                </span>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {activePersona.platformScope}
                </span>
              </div>
              <p className="text-sm sm:text-base text-slate-600 mt-1.5 font-normal">
                {activePersona.subtitle}
              </p>
            </div>

            {/* Direct Deep Link Button */}
            <div className="shrink-0 flex items-center gap-3">
              <Link
                href={activePersona.deepLink}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all hover:gap-3 active:scale-[0.98]"
              >
                <span>{activePersona.deepLinkLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Interactive Live Simulator Stage */}
          <div className="p-6 sm:p-8 bg-slate-900 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="uppercase tracking-wider font-semibold">
                  Interactive Simulator Canvas • {activePersona.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Cloud Dependency</span>
              </div>
            </div>

            {/* TAB 1: RESTAURANT OWNER SIMULATOR */}
            {activePersona.id === "owner" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Outlet 1 */}
                  <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Connaught Place (HQ)</span>
                      <span className="text-emerald-400 font-mono">● Online</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white">₹1,48,200</div>
                    <div className="text-[11px] text-slate-400 mt-2 flex justify-between">
                      <span>3 Terminals</span>
                      <span className="text-orange-400">43% Chain Vol</span>
                    </div>
                  </div>

                  {/* Outlet 2 */}
                  <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>CyberHub Gurugram</span>
                      <span className="text-emerald-400 font-mono">● Online</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white">₹1,12,450</div>
                    <div className="text-[11px] text-slate-400 mt-2 flex justify-between">
                      <span>2 Terminals</span>
                      <span className="text-orange-400">33% Chain Vol</span>
                    </div>
                  </div>

                  {/* Outlet 3 */}
                  <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Indiranagar 100ft</span>
                      <span className="text-emerald-400 font-mono">● Online</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white">₹82,200</div>
                    <div className="text-[11px] text-slate-400 mt-2 flex justify-between">
                      <span>2 Terminals</span>
                      <span className="text-orange-400">24% Chain Vol</span>
                    </div>
                  </div>
                </div>

                {/* Hardware Pairing PIN Simulator */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-800/90 to-slate-800/50 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
                      <Lock className="w-3.5 h-3.5" />
                      <span>6-Digit Terminal Pairing Gate</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-md">
                      Pair handheld waiter tablets or counter POS terminals securely to your franchise cluster without sharing owner passwords.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xl sm:text-2xl font-bold text-orange-400 tracking-wider">
                      {pairingPin}
                    </div>
                    <button
                      type="button"
                      onClick={handleGeneratePin}
                      className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{pairingCopied ? "Generated!" : "Regenerate"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BRANCH MANAGER SIMULATOR */}
            {activePersona.id === "manager" && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Refund Request #B-1049
                      </span>
                      <span className="text-xs text-slate-400">Table 4 • 2 min ago</span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Paneer Butter Masala (₹380.00) — Void Request
                    </div>
                    <div className="text-xs text-slate-400">
                      Reason: <span className="text-slate-300">Customer altered order before kitchen fire</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {refundStatus === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRefundStatus("approved")}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-emerald-600/30"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve with PIN (8821)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundStatus("rejected")}
                          className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </>
                    )}

                    {refundStatus === "approved" && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Refund Approved • Audit Logged</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setRefundStatus("pending")}
                          className="text-xs text-slate-400 underline hover:text-white"
                        >
                          Reset
                        </button>
                      </div>
                    )}

                    {refundStatus === "rejected" && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                          <X className="w-4 h-4 text-rose-400" />
                          <span>Declined by Manager</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setRefundStatus("pending")}
                          className="text-xs text-slate-400 underline hover:text-white"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                    <span className="text-slate-400 block mb-1">Shift Table Turnover</span>
                    <span className="text-base font-bold text-white font-mono">42 min</span>
                    <span className="text-emerald-400 block text-[11px] mt-0.5">3 min faster than avg</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                    <span className="text-slate-400 block mb-1">Active Floor Staff</span>
                    <span className="text-base font-bold text-white font-mono">8 / 8 Active</span>
                    <span className="text-slate-400 block text-[11px] mt-0.5">3 Waiters, 3 Kitchen, 2 POS</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                    <span className="text-slate-400 block mb-1">Cash Drawer Audit</span>
                    <span className="text-base font-bold text-white font-mono">Balanced</span>
                    <span className="text-emerald-400 block text-[11px] mt-0.5">₹0.00 Float Variance</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: COUNTER CASHIER SIMULATOR */}
            {activePersona.id === "cashier" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Cart & Split Tender Selector */}
                  <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700">
                      <span>Active Bill: Order #104</span>
                      <span className="font-mono text-emerald-400">Total: ₹840.00</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>2x Wood-Fired Margherita</span>
                        <span className="font-mono">₹600.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2x Iced Peach Tea</span>
                        <span className="font-mono">₹240.00</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-700 space-y-2">
                      <span className="text-xs text-slate-400 block font-semibold">
                        Split-Tender Settlement Method:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setTenderMethod("split")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            tenderMethod === "split"
                              ? "bg-orange-500 text-white font-bold"
                              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          }`}
                        >
                          Cash + UPI
                        </button>
                        <button
                          type="button"
                          onClick={() => setTenderMethod("upi")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            tenderMethod === "upi"
                              ? "bg-orange-500 text-white font-bold"
                              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          }`}
                        >
                          100% UPI QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setTenderMethod("cash")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            tenderMethod === "cash"
                              ? "bg-orange-500 text-white font-bold"
                              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          }`}
                        >
                          100% Cash
                        </button>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-mono space-y-1">
                        {tenderMethod === "split" && (
                          <>
                            <div className="flex justify-between text-slate-300">
                              <span>Cash Tendered:</span>
                              <span className="text-emerald-400">₹400.00</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                              <span>UPI QR Collected:</span>
                              <span className="text-sky-400">₹440.00</span>
                            </div>
                          </>
                        )}
                        {tenderMethod === "upi" && (
                          <div className="flex justify-between text-slate-300">
                            <span>Dynamic UPI QR:</span>
                            <span className="text-sky-400">₹840.00 (Paid)</span>
                          </div>
                        )}
                        {tenderMethod === "cash" && (
                          <div className="flex justify-between text-slate-300">
                            <span>Cash Received:</span>
                            <span className="text-emerald-400">₹1,000 (Change: ₹160)</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold pt-1 border-t border-slate-800 text-white">
                          <span>Balance Due:</span>
                          <span className="text-emerald-400">₹0.00 (Ready to Cut)</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setReceiptPrinted(true)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition-all active:scale-[0.98]"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>Settle & Cut Thermal Receipt (Sub-3s)</span>
                      </button>
                    </div>
                  </div>

                  {/* 80mm Receipt Preview */}
                  <div className="p-5 rounded-2xl bg-slate-100 text-slate-900 font-mono text-[11px] space-y-2 border border-slate-300 shadow-md relative">
                    <div className="text-center pb-2 border-b border-dashed border-slate-400">
                      <div className="font-extrabold text-xs">ORDER IT UP BISTRO</div>
                      <div className="text-slate-500 text-[10px]">Connaught Place, New Delhi</div>
                      <div className="text-slate-500 text-[10px]">GSTIN: 07AAAAA0000A1Z5</div>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Invoice: #INV-1049</span>
                      <span>Table: 4 • Cashier: Rahul</span>
                    </div>
                    <div className="py-2 border-y border-dashed border-slate-300 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>2x Margherita Pizza</span>
                        <span>₹600.00</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>2x Iced Peach Tea</span>
                        <span>₹240.00</span>
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right font-bold text-xs pt-1">
                      <div className="flex justify-between text-slate-600">
                        <span>CGST 2.5%:</span>
                        <span>₹20.00</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST 2.5%:</span>
                        <span>₹20.00</span>
                      </div>
                      <div className="flex justify-between text-slate-900 text-sm font-extrabold pt-1 border-t border-slate-400">
                        <span>TOTAL PAID:</span>
                        <span>₹840.00</span>
                      </div>
                    </div>
                    {receiptPrinted && (
                      <div className="mt-3 p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-center font-sans text-xs font-bold flex items-center justify-center gap-1.5 animate-bounce">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>⚡ 24V Drawer Ejected & Slip Cut!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: FLOOR WAITER SIMULATOR */}
            {activePersona.id === "waiter" && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span>Interactive Tableside Floor Canvas (Click any table to toggle state)</span>
                    <span className="text-orange-400 font-mono">LAN Port :3003 Active</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tables.map((table) => {
                      const isVacant = table.status === "vacant";
                      const isOccupied = table.status === "occupied";

                      return (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => handleToggleTable(table.id)}
                          className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95 ${
                            isVacant
                              ? "bg-slate-800/60 border-slate-700 hover:border-emerald-500/50"
                              : isOccupied
                              ? "bg-amber-950/30 border-amber-600/60 shadow-xs shadow-amber-500/20"
                              : "bg-sky-950/30 border-sky-600/60 shadow-xs shadow-sky-500/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm">{table.name}</span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                                isVacant
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : isOccupied
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              }`}
                            >
                              {table.status}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                            <span>{table.pax} Pax Capacity</span>
                            <span className="font-mono text-slate-300">{table.time}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Vacant
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> Occupied
                    </span>
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <span className="w-2 h-2 rounded-full bg-sky-400" /> Billed
                    </span>
                  </div>
                  <span className="text-slate-400">
                    Handheld sync latency: <span className="text-emerald-400 font-mono font-bold">&lt; 15ms</span> over local Wi-Fi
                  </span>
                </div>
              </div>
            )}

            {/* TAB 5: KITCHEN CHEF SIMULATOR */}
            {activePersona.id === "chef" && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span>Live Ticket Queue (Click &apos;Bump&apos; to advance ticket stage)</span>
                    <span className="text-emerald-400 font-mono">LAN Port :3002 KDS Screen</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {kdsTickets.map((ticket) => {
                      const isPrep = ticket.status === "Preparing";
                      const isReady = ticket.status === "Ready";

                      return (
                        <div
                          key={ticket.id}
                          className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-col justify-between space-y-4"
                        >
                          <div>
                            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                              <span className="font-bold text-white font-mono">#{ticket.id}</span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                  ticket.sla === "green"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : ticket.sla === "amber"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-slate-700 text-slate-400"
                                }`}
                              >
                                {ticket.elapsed}
                              </span>
                            </div>

                            <div className="text-xs text-orange-400 font-semibold mt-2">
                              {ticket.table}
                            </div>

                            <div className="mt-2 space-y-1 text-xs text-slate-200">
                              {ticket.items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleBumpTicket(ticket.id)}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                              isPrep
                                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-xs shadow-amber-600/30"
                                : isReady
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/30"
                                : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {isPrep ? "Bump: Mark Ready" : isReady ? "Bump: Mark Served" : "Reopen Ticket"}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300 flex items-center justify-between">
                  <span>Station Filters: [Bar] [Grill] [Fryer] [Oven]</span>
                  <span className="font-mono text-emerald-400 font-semibold">Touchscreen Ready</span>
                </div>
              </div>
            )}

            {/* TAB 6: HEAD ACCOUNTANT SIMULATOR */}
            {activePersona.id === "accountant" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Split GST Tax Breakdown */}
                  <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block">
                      Automated Split GST Tax Audit
                    </span>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>Taxable Food & Beverage:</span>
                        <span className="font-bold text-white">₹2,48,000.00</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>CGST @ 2.5%:</span>
                        <span className="font-bold text-purple-300">₹6,200.00</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>SGST @ 2.5%:</span>
                        <span className="font-bold text-purple-300">₹6,200.00</span>
                      </div>
                      <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-700 font-bold">
                        <span>Total Tax Liability:</span>
                        <span className="text-emerald-400 font-bold">₹12,400.00</span>
                      </div>
                    </div>
                  </div>

                  {/* Cash Float Reconciliation */}
                  <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block">
                      Cash Float & Variance Reconciliation
                    </span>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>System Expected Cash:</span>
                        <span className="font-bold text-white">₹48,250.00</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Drawer Physical Count:</span>
                        <span className="font-bold text-white">₹48,250.00</span>
                      </div>
                      <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-700 font-bold">
                        <span>Closure Variance:</span>
                        <span className="text-emerald-400 font-bold">₹0.00 (Balanced ✓)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tally XML Export Action */}
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs">
                    <span className="font-bold text-purple-300 block">Tally Prime XML Integration</span>
                    <span className="text-slate-400">Export audited sales vouchers directly formatted for external chartered accountants.</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportTally}
                    disabled={exportingTally}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-purple-600/30 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {exportingTally
                        ? "Generating XML..."
                        : exportComplete
                        ? "✓ Tally_Sales_2026.xml Exported!"
                        : "Export Tally XML (1-Click)"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Operational Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-t border-b border-slate-200 bg-slate-50/70">
            {activePersona.kpis.map((kpi, idx) => (
              <div key={idx} className="p-5 text-center">
                <span className="text-xs font-medium text-slate-500 block">{kpi.label}</span>
                <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                  {kpi.value}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 mt-0.5 block">
                  {kpi.hint}
                </span>
              </div>
            ))}
          </div>

          {/* Active Persona Responsibilities Grid */}
          <div className="p-6 sm:p-8 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-orange-600" />
              <span>Core Operational Capabilities & Workflow</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activePersona.responsibilities.map((resp, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                    {resp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
