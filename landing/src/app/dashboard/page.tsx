"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Store,
  Building2,
  Receipt,
  ChefHat,
  UtensilsCrossed,
  FileSpreadsheet,
  Bike,
  CheckCircle2,
  Printer,
  Key,
  LogOut,
  ArrowLeft,
  Cloud,
  Zap,
  RefreshCw,
  ChevronDown,
  Layers,
  X,
  Activity,
} from "lucide-react";
import { BRAND } from "@/lib/constants";
import ModalProvider from "@/components/ModalProvider";
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/auth";
import {
  triggerOpenBillModal,
  triggerOpenCredentialsModal,
} from "@/lib/modalEvents";
import {
  useDashboardActions,
  useActivePerspective,
  useActiveRole,
  useSelectedOutletId,
  useOutlets,
} from "@/lib/dashboard-store";
import {
  useBackendDetector,
  getBackendStatusLabel,
} from "@/lib/backend-detector";
import type {
  OperationalRole,
  DashboardPerspective,
} from "@/lib/dashboard-models";

// Import all 8 verified dashboard perspective & persona components
import { CashierView } from "@/components/dashboard/CashierView";
import { KitchenChefView } from "@/components/dashboard/KitchenChefView";
import { ServerWaiterView } from "@/components/dashboard/ServerWaiterView";
import { AccountantView } from "@/components/dashboard/AccountantView";
import { DeliveryDriverView } from "@/components/dashboard/DeliveryDriverView";
import { OwnerManagerView } from "@/components/dashboard/OwnerManagerView";
import { FounderAdminView } from "@/components/dashboard/FounderAdminView";
import { ChainOwnerView } from "@/components/dashboard/ChainOwnerView";

// Tab configuration for Merchant perspective
interface PersonaTabConfig {
  id: string;
  role: OperationalRole | "overview";
  label: string;
  badge: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PERSONA_TABS: PersonaTabConfig[] = [
  {
    id: "overview",
    role: "overview",
    label: "Multi-Outlet Overview",
    badge: "Chain Central",
    shortDesc: "Cross-branch live sales, catalog pricing & consolidated taxes",
    icon: Layers,
  },
  {
    id: "owner",
    role: "owner",
    label: "Owner / Manager",
    badge: "Operations",
    shortDesc: "Branch performance, staff PIN assignment & S3 backup outbox",
    icon: Store,
  },
  {
    id: "cashier",
    role: "cashier",
    label: "Front Cashier",
    badge: "Counter POS",
    shortDesc: "Split tenders, 24V cash drawer pulse & 80mm thermal receipts",
    icon: Receipt,
  },
  {
    id: "chef",
    role: "chef",
    label: "Kitchen Chef",
    badge: "KDS :3002",
    shortDesc: "Live order bump bar, prep station routing & SLA timers",
    icon: ChefHat,
  },
  {
    id: "waiter",
    role: "waiter",
    label: "Server / Waiter",
    badge: "Tableside",
    shortDesc: "Visual floor map, table occupancy & tableside course firing",
    icon: UtensilsCrossed,
  },
  {
    id: "accountant",
    role: "accountant",
    label: "Accountant / Tax",
    badge: "SAC 996331",
    shortDesc: "GST breakdown, Z-report balancing & Tally XML export",
    icon: FileSpreadsheet,
  },
  {
    id: "driver",
    role: "driver",
    label: "Delivery Driver",
    badge: "Dispatch",
    shortDesc: "Swiggy/Zomato dispatch, masked calls & COD cash settlement",
    icon: Bike,
  },
];

/**
 * Inner Dashboard Component that uses useSearchParams inside Suspense
 */
function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Store state and actions
  const activePerspective = useActivePerspective();
  const activeRole = useActiveRole();
  const selectedOutletId = useSelectedOutletId();
  const outlets = useOutlets();
  const actions = useDashboardActions();

  // Local active tab fallback for merchant perspective
  const [localTab, setLocalTab] = useState<string>("overview");

  // User session state (populated safely via async timer to prevent SSR mismatch)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Status Popover state
  const [statusPopoverOpen, setStatusPopoverOpen] = useState<boolean>(false);
  const statusPopoverRef = useRef<HTMLDivElement>(null);
  const statusButtonRef = useRef<HTMLButtonElement>(null);

  // Live Backend Telemetry Hook
  const {
    status: detectorStatus,
    isChecking,
    recheck,
    details,
  } = useBackendDetector({
    intervalMs: 30000,
    timeoutMs: 1500,
    autoCheck: true,
  });

  // Safe user profile initialization
  useEffect(() => {
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

  // Sync external store from URL query parameters (external mutator, no internal setState)
  useEffect(() => {
    if (!searchParams) return;

    const pParam = searchParams.get("perspective")?.toLowerCase();
    if (pParam === "founder" && activePerspective !== "founder") {
      actions.setActivePerspective("founder");
    } else if (pParam === "merchant" && activePerspective !== "merchant") {
      actions.setActivePerspective("merchant");
    }

    const rParam = searchParams.get("role")?.toLowerCase();
    if (rParam && rParam !== "overview" && rParam !== "chain") {
      const roleMap: Record<string, OperationalRole> = {
        cashier: "cashier",
        chef: "chef",
        waiter: "waiter",
        server: "waiter",
        accountant: "accountant",
        driver: "driver",
        delivery: "driver",
        owner: "owner",
        manager: "owner",
      };
      const mapped = roleMap[rParam];
      if (mapped && mapped !== activeRole) {
        actions.setActiveRole(mapped);
      }
    }

    const oParam = searchParams.get("outlet");
    if (oParam && oParam !== selectedOutletId) {
      actions.setSelectedOutletId(oParam);
    }
  }, [searchParams, actions, activePerspective, activeRole, selectedOutletId]);

  // Derive effective perspective
  const effectivePerspective: DashboardPerspective = useMemo(() => {
    const p = searchParams?.get("perspective")?.toLowerCase();
    if (p === "founder") return "founder";
    if (p === "merchant") return "merchant";
    return activePerspective;
  }, [searchParams, activePerspective]);

  // Derive effective tab
  const selectedTab: string = useMemo(() => {
    const r = searchParams?.get("role")?.toLowerCase();
    if (r === "cashier") return "cashier";
    if (r === "chef") return "chef";
    if (r === "waiter" || r === "server") return "waiter";
    if (r === "accountant") return "accountant";
    if (r === "driver" || r === "delivery") return "driver";
    if (r === "owner" || r === "manager") return "owner";
    if (r === "overview" || r === "chain") return "overview";
    return localTab;
  }, [searchParams, localTab]);

  // URL updater with query parameter synchronization
  const updateUrlParams = useCallback(
    (updates: { perspective?: string; role?: string; outlet?: string }) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);

      if (updates.perspective !== undefined) {
        url.searchParams.set("perspective", updates.perspective);
      }
      if (updates.role !== undefined) {
        url.searchParams.set("role", updates.role);
      }
      if (updates.outlet !== undefined) {
        url.searchParams.set("outlet", updates.outlet);
      }

      window.history.replaceState(null, "", url.toString());
    },
    []
  );

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusPopoverRef.current &&
        !statusPopoverRef.current.contains(event.target as Node) &&
        statusButtonRef.current &&
        !statusButtonRef.current.contains(event.target as Node)
      ) {
        setStatusPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Perspective handler
  const handlePerspectiveChange = (newPerspective: DashboardPerspective) => {
    actions.setActivePerspective(newPerspective);
    updateUrlParams({
      perspective: newPerspective,
      role: newPerspective === "founder" ? "superadmin" : selectedTab,
    });
  };

  // Tab switch handler
  const handleTabChange = (tabId: string) => {
    setLocalTab(tabId);
    if (tabId === "overview") {
      updateUrlParams({ perspective: "merchant", role: "overview" });
    } else {
      const targetRole = tabId as OperationalRole;
      actions.setActiveRole(targetRole);
      updateUrlParams({ perspective: "merchant", role: tabId });
    }
  };

  // Outlet switch handler
  const handleOutletChange = (outletId: string) => {
    actions.setSelectedOutletId(outletId);
    updateUrlParams({ outlet: outletId });
  };

  // Session sign out
  const handleSignOut = () => {
    setStoredUser(null);
    router.push("/");
  };

  // Determine active outlet entity
  const currentOutlet = outlets.find((o) => o.id === selectedOutletId) || outlets[0];

  // Active view renderer for all 8 views
  const renderActiveView = () => {
    if (effectivePerspective === "founder") {
      return <FounderAdminView />;
    }

    switch (selectedTab) {
      case "owner":
        return <OwnerManagerView />;
      case "cashier":
        return <CashierView />;
      case "chef":
        return <KitchenChefView />;
      case "waiter":
        return <ServerWaiterView />;
      case "accountant":
        return <AccountantView />;
      case "driver":
        return <DeliveryDriverView />;
      case "overview":
      default:
        return <ChainOwnerView />;
    }
  };

  const isLive = detectorStatus.mode === "live";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      <ModalProvider />
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs leading-5 text-amber-900 sm:text-sm">
        <strong>Demo sandbox — sample data only.</strong> This browser view is for product evaluation and does not represent a live restaurant account, production authentication or live system telemetry. Do not enter real customer, employee or financial information.
        <Link href="/legal/pilot-disclaimer" className="ml-2 font-bold underline">Pilot disclaimer</Link>
      </div>
      {/* ===================================================================== */}
      {/* MASTER HEADER                                                         */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
            {/* Left: Brand Logo & Back to Home */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-1.5 p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                title="Return to Home"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <Link href="/" className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="Order It Up Logo"
                  className="h-9 w-9 object-contain"
                />
                <div className="flex flex-col">
                  <span className="text-xl font-black tracking-tight text-slate-900 leading-none">
                    {BRAND.name}
                  </span>
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-0.5">
                    DEMO SANDBOX
                  </span>
                </div>
              </Link>
            </div>

            {/* Center: Perspective Switcher & Outlet Selector */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Perspective Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 shadow-xs">
                <button
                  type="button"
                  onClick={() => handlePerspectiveChange("merchant")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    effectivePerspective === "merchant"
                      ? "bg-[#F07928] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Restaurant Chain Owner</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePerspectiveChange("founder")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    effectivePerspective === "founder"
                      ? "bg-[#F07928] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Founder Platform Admin</span>
                </button>
              </div>

              {/* Outlet Selector Dropdown (When in Merchant View) */}
              {effectivePerspective === "merchant" && (
                <div className="relative">
                  <select
                    id="outlet-selector"
                    value={selectedOutletId}
                    onChange={(e) => handleOutletChange(e.target.value)}
                    className="h-9 px-3 pr-8 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-xs cursor-pointer appearance-none"
                    title="Filter active restaurant branch"
                  >
                    <option value="all">🌐 All Outlets (Consolidated Chain)</option>
                    {outlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        📍 {outlet.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Right: Hybrid Telemetry Pill, Quick Tools & Auth */}
            <div className="flex items-center gap-2.5">
              {/* Hybrid Connection Status Pill */}
              <div className="relative">
                <button
                  ref={statusButtonRef}
                  type="button"
                  onClick={() => setStatusPopoverOpen(!statusPopoverOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                    isLive
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80"
                  }`}
                  title={getBackendStatusLabel(detectorStatus)}
                >
                  {isLive ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full h-2 w-2 bg-slate-400" />
                  )}

                  <span className="truncate max-w-[170px] sm:max-w-none">
                    {isLive
                      ? "Live Sync (:3001, :3002, :3003)"
                      : "Standalone Simulation (Cloudflare Pages)"}
                  </span>

                  <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:inline" />
                </button>

                {/* Status Telemetry Popover */}
                {statusPopoverOpen && (
                  <div
                    ref={statusPopoverRef}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            isLive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Hybrid Runtime Telemetry
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusPopoverOpen(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Service Probes Grid */}
                    <div className="py-3 space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-orange-600" />
                          <span className="font-semibold text-slate-800">
                            POS Engine API (:3001)
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            details.api.connected
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {details.api.connected ? "Connected" : "Offline"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <ChefHat className="w-3.5 h-3.5 text-amber-600" />
                          <span className="font-semibold text-slate-800">
                            Kitchen Display System (:3002)
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            details.kds.connected
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {details.kds.connected ? "Connected" : "Offline"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-semibold text-slate-800">
                            Server / Waiter App (:3003)
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            details.waiter.connected
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {details.waiter.connected ? "Connected" : "Offline"}
                        </span>
                      </div>
                    </div>

                    {/* Architecture Explanatory Note */}
                    <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-100 text-[11px] text-slate-600 leading-relaxed">
                      <div className="flex items-center gap-1.5 font-semibold text-orange-950 mb-0.5">
                        {isLive ? (
                          <Zap className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Cloud className="w-3.5 h-3.5 text-slate-600" />
                        )}
                        <span>Zero-Commingling Hybrid Architecture</span>
                      </div>
                      Order It Up runs as an offline-first desktop POS. On
                      Cloudflare Pages, this interactive sandbox operates in complete
                      browser isolation with zero database commingling across
                      restaurant tenants.
                    </div>

                    {/* Popover Footer: Manual Recheck & Timestamp */}
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {detectorStatus.checkedAt
                          ? `Checked: ${new Date(
                              detectorStatus.checkedAt
                            ).toLocaleTimeString()}`
                          : "Probing services..."}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await recheck();
                        }}
                        disabled={isChecking}
                        className="px-2.5 py-1 rounded-lg bg-[#F07928] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`}
                        />
                        <span>{isChecking ? "Checking..." : "Re-check Services"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Tools: 80mm Bill, Z-Report & Role Credentials Modal Triggers */}
              <button
                type="button"
                onClick={() => triggerOpenBillModal("standard")}
                className="hidden xl:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer"
                title="Preview standard 80mm ESC/POS thermal receipt"
              >
                <Receipt className="w-3.5 h-3.5 text-orange-600" />
                <span>80mm Bill</span>
              </button>

              <button
                type="button"
                onClick={() => triggerOpenBillModal("zreport")}
                className="hidden xl:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                title="Preview daily Z-report receipt"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Z-Report</span>
              </button>

              <button
                type="button"
                onClick={() => triggerOpenCredentialsModal()}
                className="hidden xl:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                title="View role demo credentials"
              >
                <Key className="w-3.5 h-3.5 text-slate-600" />
                <span>Roles</span>
              </button>

              {/* Authenticated User & Sign Out */}
              {currentUser && (
                <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800"
                    title={`${currentUser.name} (${currentUser.role})`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                      {currentUser.name.charAt(0)}
                    </div>
                    <span className="font-bold hidden 2xl:inline text-xs">
                      {currentUser.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile / Tablet Perspective & Outlet Controls Bar */}
          <div className="flex lg:hidden items-center justify-between py-2.5 border-t border-slate-100 gap-2 overflow-x-auto">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => handlePerspectiveChange("merchant")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  effectivePerspective === "merchant"
                    ? "bg-[#F07928] text-white shadow-xs"
                    : "text-slate-600"
                }`}
              >
                Chain Owner
              </button>
              <button
                type="button"
                onClick={() => handlePerspectiveChange("founder")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  effectivePerspective === "founder"
                    ? "bg-[#F07928] text-white shadow-xs"
                    : "text-slate-600"
                }`}
              >
                Founder Admin
              </button>
            </div>

            {effectivePerspective === "merchant" && (
              <select
                value={selectedOutletId}
                onChange={(e) => handleOutletChange(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none shrink-0"
              >
                <option value="all">🌐 All Outlets</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    📍 {outlet.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* PERSPECTIVE SUB-NAV: 6 OPERATIONAL PERSONAS (WHEN IN MERCHANT MODE)   */}
      {/* ===================================================================== */}
      {effectivePerspective === "merchant" && (
        <section className="bg-white border-b border-slate-200/80 sticky top-16 sm:top-20 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Persona Navigation Tabs */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 w-full">
                {PERSONA_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = selectedTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border cursor-pointer ${
                        isActive
                          ? "bg-[#F07928] text-white border-orange-600 shadow-sm"
                          : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200/80 shadow-xs"
                      }`}
                      title={tab.shortDesc}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          isActive ? "text-white" : "text-slate-500"
                        }`}
                      />
                      <span>{tab.label}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Outlet Context Badge */}
              <div className="hidden xl:flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200/80 text-xs font-bold text-orange-950">
                <Store className="w-3.5 h-3.5 text-orange-600" />
                <span className="truncate max-w-[200px]">
                  {selectedOutletId === "all"
                    ? "Consolidated 3 Outlets"
                    : currentOutlet.name}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Founder Administrative Banner Indicator */}
      {effectivePerspective === "founder" && (
        <section className="bg-slate-900 text-white border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold text-[10px] uppercase tracking-wider">
                Founder Mode
              </span>
              <span className="font-semibold text-slate-200">
                Prototype administration view — demo only
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-slate-400">
              <span>Illustrative settings</span>
              <span>•</span>
              <span>Not connected to production licensing</span>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* MAIN VIEWPORT CANVAS: RENDERS ONE OF 8 DEDICATED PERSPECTIVE VIEWS    */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="animate-in fade-in duration-200">
          {renderActiveView()}
        </div>
      </main>

      {/* ===================================================================== */}
      {/* PERSISTENT FOOTER                                                     */}
      {/* ===================================================================== */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/80 backdrop-blur-xs py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">{BRAND.name}</span>
            <span>•</span>
            <span>Interactive dashboard preview • sample data</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Offline-first design under evaluation</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] text-slate-400">
              Tax and food-business fields are examples only
            </span>
            <Link
              href="/"
              className="font-bold text-orange-600 hover:text-orange-700 transition-colors"
            >
              Back to Overview →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Fallback Component during SSR / Prerendering
 */
function DashboardLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-500 font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">
          Loading Order It Up Unified Command...
        </p>
      </div>
    </div>
  );
}

/**
 * Master Dashboard Entry Point with Suspense Boundary for Static Export
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardShell />
    </Suspense>
  );
}
