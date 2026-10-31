"use client";

import React, { useState, useMemo } from "react";
import {
  Store,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Receipt,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  ShieldCheck,
  SlidersHorizontal,
  CheckCircle2,
  Server,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import {
  useOutlets,
  useCatalog,
  useDashboardActions,
  updateDashboardState,
} from "@/lib/dashboard-store";

export function ChainOwnerView() {
  const outlets = useOutlets();
  const catalog = useCatalog();
  const actions = useDashboardActions();

  // Branch Selector Filter ("all" or outlet id)
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");

  // Selected Branch for Catalog Overrides
  const [overrideBranchId, setOverrideBranchId] = useState<string>("outlet-3"); // Default to Airport T3 (famous for transit surcharges)

  // Custom Inline Price Override Inputs: Record<itemId, string>
  const [customPriceInputs, setCustomPriceInputs] = useState<Record<string, string>>({});
  const [overrideFeedback, setOverrideFeedback] = useState<string | null>(null);

  // CSV / JSON Export Feedback
  const [copiedTaxJson, setCopiedTaxJson] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Consolidated Chain Metrics
  const totalChainSales = useMemo(() => {
    return outlets.reduce((acc, o) => acc + o.todaySales, 0);
  }, [outlets]);

  const totalChainOrders = useMemo(() => {
    return outlets.reduce((acc, o) => acc + o.ordersCount, 0);
  }, [outlets]);

  const chainAov = totalChainOrders > 0 ? Math.round((totalChainSales / totalChainOrders) * 100) / 100 : 0;

  // Tender Totals across all branches
  const totalUpi = outlets.reduce((acc, o) => acc + o.tenders.upi, 0);
  const totalCash = outlets.reduce((acc, o) => acc + o.tenders.cash, 0);
  const totalCard = outlets.reduce((acc, o) => acc + o.tenders.card, 0);

  const upiSharePercent = totalChainSales > 0 ? Math.round((totalUpi / totalChainSales) * 100) : 0;
  const cashSharePercent = totalChainSales > 0 ? Math.round((totalCash / totalChainSales) * 100) : 0;
  const cardSharePercent = totalChainSales > 0 ? Math.round((totalCard / totalChainSales) * 100) : 0;

  // Consolidated Indian GST Computations (5.0% GST: 2.5% CGST + 2.5% SGST under SAC 996331)
  const taxMetricsByOutlet = useMemo(() => {
    return outlets.map((outlet) => {
      // Gross sales is tax-inclusive in Indian restaurant POS bills
      const taxable = Math.round((outlet.todaySales / 1.05) * 100) / 100;
      const cgst = Math.round((taxable * 0.025) * 100) / 100;
      const sgst = Math.round((taxable * 0.025) * 100) / 100;
      const totalTax = Math.round((cgst + sgst) * 100) / 100;
      return {
        ...outlet,
        taxable,
        cgst,
        sgst,
        totalTax,
      };
    });
  }, [outlets]);

  const consolidatedTaxable = taxMetricsByOutlet.reduce((acc, o) => acc + o.taxable, 0);
  const consolidatedCgst = taxMetricsByOutlet.reduce((acc, o) => acc + o.cgst, 0);
  const consolidatedSgst = taxMetricsByOutlet.reduce((acc, o) => acc + o.sgst, 0);
  const consolidatedTotalTax = consolidatedCgst + consolidatedSgst;

  // Active Outlet for catalog override view
  const currentOverrideOutlet = useMemo(() => {
    return outlets.find((o) => o.id === overrideBranchId) || outlets[0];
  }, [outlets, overrideBranchId]);

  // Handle Price Override update
  const handleSavePriceOverride = (itemId: string, newPrice: number | null) => {
    try {
      actions.updateBranchPriceOverride(overrideBranchId, itemId, newPrice);
      const item = catalog.find((i) => i.id === itemId);
      const itemName = item?.name || "Item";
      const branchName = currentOverrideOutlet.name.split(" (")[0];

      if (newPrice === null) {
        setOverrideFeedback(`Reset ${itemName} to central base price for ${branchName}.`);
      } else {
        setOverrideFeedback(
          `Updated ${itemName} price to ₹${newPrice} at ${branchName}.`
        );
      }
      setTimeout(() => setOverrideFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Failed to update override:", err);
      setOverrideFeedback("Failed to update price override");
    }
  };

  // Preset surcharge shortcut: e.g. +15% airport transit surcharge
  const handleApplyPresetSurcharge = (itemId: string, basePrice: number, percent: number) => {
    const surchargeAmount = Math.round(basePrice * (1 + percent / 100));
    handleSavePriceOverride(itemId, surchargeAmount);
  };

  // Toggle item 86-ing availability for the selected branch
  const handleToggleItemAvailability = (itemId: string) => {
    updateDashboardState((state) => {
      const updatedCatalog = state.catalog.map((item) => {
        if (item.id !== itemId) return item;
        const currentOverrides = item.branchOverrides || {};
        const outletOverride = currentOverrides[overrideBranchId] || {
          isAvailable: true,
          priceOverride: null,
        };
        const nextAvailable = !outletOverride.isAvailable;

        return {
          ...item,
          branchOverrides: {
            ...currentOverrides,
            [overrideBranchId]: {
              ...outletOverride,
              isAvailable: nextAvailable,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });

      return { ...state, catalog: updatedCatalog };
    });

    const item = catalog.find((i) => i.id === itemId);
    const branchName = currentOverrideOutlet.name.split(" (")[0];
    setOverrideFeedback(`Toggled ${item?.name || "Item"} availability at ${branchName}.`);
    setTimeout(() => setOverrideFeedback(null), 4000);
  };

  // Copy Consolidated Tax Summary as JSON
  const handleCopyTaxJson = () => {
    const payload = {
      chainBrand: "Spice Route Hospitality Group",
      fssaiLicense: "10019011000234",
      hsnSacCode: "996331",
      businessDate: new Date().toISOString().split("T")[0],
      consolidatedGrossSales: totalChainSales,
      consolidatedTaxableTurnover: consolidatedTaxable,
      cgstTotal: consolidatedCgst,
      sgstTotal: consolidatedSgst,
      grandTotalGstCollected: consolidatedTotalTax,
      outlets: taxMetricsByOutlet.map((o) => ({
        outletId: o.id,
        outletName: o.name,
        code: o.code,
        gstin: o.gstin,
        stateCode: o.stateCode,
        grossSales: o.todaySales,
        taxable: o.taxable,
        cgst: o.cgst,
        sgst: o.sgst,
        totalTax: o.totalTax,
      })),
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedTaxJson(true);
    setTimeout(() => setCopiedTaxJson(false), 2000);
  };

  // Download Consolidated CSV Report
  const handleDownloadCsv = () => {
    const headers = [
      "Outlet Code",
      "Outlet Name",
      "Location",
      "GSTIN",
      "State Code",
      "Gross Sales (INR)",
      "Taxable Turnover (INR)",
      "CGST 2.5% (INR)",
      "SGST 2.5% (INR)",
      "Total GST 5% (INR)",
      "SAC Code",
    ];

    const rows = taxMetricsByOutlet.map((o) => [
      o.code,
      `"${o.name}"`,
      `"${o.location}"`,
      o.gstin,
      o.stateCode,
      o.todaySales.toFixed(2),
      o.taxable.toFixed(2),
      o.cgst.toFixed(2),
      o.sgst.toFixed(2),
      o.totalTax.toFixed(2),
      "996331",
    ]);

    // Totals row
    rows.push([
      "CHAIN TOTAL",
      '"All 3 Connected Outlets"',
      '"New Delhi & Gurugram"',
      "CONSOLIDATED",
      "MULTI-STATE",
      totalChainSales.toFixed(2),
      consolidatedTaxable.toFixed(2),
      consolidatedCgst.toFixed(2),
      consolidatedSgst.toFixed(2),
      consolidatedTotalTax.toFixed(2),
      "996331",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `spice-route-consolidated-gst-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess("Downloaded spice-route-consolidated-gst.csv successfully!");
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // Filtered outlets for live display
  const displayOutlets = useMemo(() => {
    if (selectedBranchFilter === "all") return outlets;
    return outlets.filter((o) => o.id === selectedBranchFilter);
  }, [outlets, selectedBranchFilter]);

  return (
    <div className="space-y-8 text-slate-900">
      {/* 1. Chain Brand Banner & High-Level Summary */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Connected Multi-Outlet Mesh
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              FSSAI: 10019011000234 Verified
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
              SAC 996331 • 5.0% GST
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Spice Route Hospitality Group
          </h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            Multi-branch executive command center: live sales performance comparison across connected branches, central master catalog synchronization with per-branch price overrides, and consolidated Indian GST compliance.
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export GSTR-1 CSV
          </button>
          <button
            onClick={handleCopyTaxJson}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            {copiedTaxJson ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Copied Tax Ledger!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy Tax JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 text-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
          <button
            onClick={() => setDownloadSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {overrideFeedback && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 flex items-center justify-between gap-3 text-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{overrideFeedback}</span>
          </div>
          <button
            onClick={() => setOverrideFeedback(null)}
            className="text-blue-700 hover:text-blue-900 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Chain High-Level Performance KPIs (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Combined Chain Today's Sales */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-orange-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Combined Live Sales</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            ₹{totalChainSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            UPI: {upiSharePercent}% • Card: {cardSharePercent}% • Cash: {cashSharePercent}%
          </div>
        </div>

        {/* Card 2: Total Orders & Volume */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-orange-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Chain Orders</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {totalChainOrders} <span className="text-sm font-normal text-slate-500">Tickets</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Peak velocity: 112 at Cyber Hub
          </div>
        </div>

        {/* Card 3: Chain Average Order Value (AOV) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-orange-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Order Value</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            ₹{chainAov.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Downtown: ₹1,019.16 • T3: ₹578.57
          </div>
        </div>

        {/* Card 4: Consolidated GST Collected */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-orange-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Consolidated GST (5%)</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            ₹{consolidatedTotalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            CGST: ₹{consolidatedCgst.toFixed(2)} • SGST: ₹{consolidatedSgst.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 3. Multi-Branch Live Sales & Performance Grid */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold uppercase tracking-wider">
                Live Branch Mesh
              </span>
              <span className="text-xs text-slate-500">
                Express API :3001 • KDS :3002 • Waiter :3003
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Store className="w-5 h-5 text-orange-600" />
              Connected Multi-Branch Live Sales &amp; Performance
            </h2>
            <p className="text-sm text-slate-500">
              Side-by-side comparative operational status across all 3 active restaurant locations in Delhi NCR.
            </p>
          </div>

          {/* Branch Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
            <button
              onClick={() => setSelectedBranchFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedBranchFilter === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Branches ({outlets.length})
            </button>
            {outlets.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedBranchFilter(o.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedBranchFilter === o.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {o.name.split(" (")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Detailed Branch Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayOutlets.map((outlet) => {
            const sharePercent =
              totalChainSales > 0
                ? Math.round((outlet.todaySales / totalChainSales) * 100)
                : 0;

            const upiBranchPct =
              outlet.todaySales > 0
                ? Math.round((outlet.tenders.upi / outlet.todaySales) * 100)
                : 0;
            const cashBranchPct =
              outlet.todaySales > 0
                ? Math.round((outlet.tenders.cash / outlet.todaySales) * 100)
                : 0;
            const cardBranchPct =
              outlet.todaySales > 0
                ? Math.round((outlet.tenders.card / outlet.todaySales) * 100)
                : 0;

            return (
              <div
                key={outlet.id}
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-orange-300 shadow-xs transition-all flex flex-col justify-between space-y-4"
              >
                {/* Branch Header */}
                <div className="space-y-1.5 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-mono font-bold">
                      {outlet.code}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {outlet.status}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {outlet.name}
                  </h3>
                  <div className="text-xs text-slate-500 truncate">
                    {outlet.location}
                  </div>
                  <div className="text-[11px] text-orange-600 font-medium">
                    {outlet.type || "Restaurant"}
                  </div>
                </div>

                {/* Main Metrics: Sales & Orders */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Today&apos;s Sales
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      ₹{outlet.todaySales.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600">
                      {sharePercent}% of chain revenue
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Order Volume
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {outlet.ordersCount} <span className="text-xs font-normal text-slate-500">bills</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      AOV: ₹{outlet.avgTicket.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Tables & Top Dish */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Floor Table Occupancy:</span>
                    <span className="font-bold text-slate-800">
                      {outlet.activeTables} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Top-Selling Item:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[170px]" title={outlet.topDish}>
                      {outlet.topDish || "Truffle Pizza"}
                    </span>
                  </div>
                </div>

                {/* Tender Mix Breakdown */}
                <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Tender Mix</span>
                    <span>₹{outlet.todaySales.toLocaleString("en-IN")} Total</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      style={{ width: `${upiBranchPct}%` }}
                      className="bg-orange-500"
                      title={`UPI: ₹${outlet.tenders.upi} (${upiBranchPct}%)`}
                    />
                    <div
                      style={{ width: `${cardBranchPct}%` }}
                      className="bg-indigo-500"
                      title={`Card: ₹${outlet.tenders.card} (${cardBranchPct}%)`}
                    />
                    <div
                      style={{ width: `${cashBranchPct}%` }}
                      className="bg-emerald-500"
                      title={`Cash: ₹${outlet.tenders.cash} (${cashBranchPct}%)`}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-600 pt-1">
                    <div>
                      <span className="font-semibold text-slate-900">UPI:</span> {upiBranchPct}%
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Card:</span> {cardBranchPct}%
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Cash:</span> {cashBranchPct}%
                    </div>
                  </div>
                </div>

                {/* Engine Port & Hardware Connectivity */}
                <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono text-slate-700">
                    <Server className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span className="truncate">{outlet.enginePort}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {outlet.hardware}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chain Revenue Distribution Visualization Bar */}
        <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Chain Revenue Share Distribution (Today)
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Total Today: ₹{totalChainSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
            {outlets.map((outlet, idx) => {
              const colors = ["bg-orange-500", "bg-indigo-500", "bg-emerald-500"];
              const pct = totalChainSales > 0 ? (outlet.todaySales / totalChainSales) * 100 : 33.3;
              return (
                <div
                  key={outlet.id}
                  style={{ width: `${pct}%` }}
                  className={`${colors[idx % colors.length]}`}
                  title={`${outlet.name}: ₹${outlet.todaySales} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            {outlets.map((outlet, idx) => {
              const dots = ["bg-orange-500", "bg-indigo-500", "bg-emerald-500"];
              const pct = totalChainSales > 0 ? ((outlet.todaySales / totalChainSales) * 100).toFixed(1) : "0";
              return (
                <div key={outlet.id} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dots[idx % dots.length]}`} />
                  <span className="font-medium text-slate-700">{outlet.name.split(" (")[0]}:</span>
                  <span className="font-bold text-slate-900">
                    ₹{outlet.todaySales.toLocaleString("en-IN")} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Central Menu Catalog with Branch Overrides */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold uppercase tracking-wider">
                Menu Architecture
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono">
                SAC 996331 • 5.0% Tax Included
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-orange-600" />
              Central Menu Catalog with Branch Price Overrides
            </h2>
            <p className="text-sm text-slate-500">
              Manage master pricing centrally and customize prices or 86-ing availability per branch (e.g. Airport T3 transit surcharge or Cyber Hub lunch special).
            </p>
          </div>

          {/* Branch Selector for Catalog Overrides */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Managing Overrides for:</span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              {outlets.map((outlet) => (
                <button
                  key={outlet.id}
                  onClick={() => setOverrideBranchId(outlet.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    overrideBranchId === outlet.id
                      ? "bg-white text-orange-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {outlet.name.split(" (")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Outlet Context Notice */}
        <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200/80 flex items-center justify-between gap-3 text-xs text-orange-950">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-orange-600 shrink-0" />
            <span>
              Currently editing overrides for <strong>{currentOverrideOutlet.name}</strong> ({currentOverrideOutlet.code}). Items with no override automatically inherit the central base price.
            </span>
          </div>
          <span className="font-mono text-[11px] text-orange-700 font-semibold shrink-0">
            {catalog.length} Master Menu Items
          </span>
        </div>

        {/* Catalog Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Menu Item &amp; Details</th>
                <th className="py-3.5 px-4">Category / Station</th>
                <th className="py-3.5 px-4">Central Base Price</th>
                <th className="py-3.5 px-4">{currentOverrideOutlet.name.split(" (")[0]} Effective Price</th>
                <th className="py-3.5 px-4">Branch Availability</th>
                <th className="py-3.5 px-4 text-right">Override Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catalog.map((item) => {
                const branchOverride = item.branchOverrides?.[overrideBranchId];
                const hasOverride =
                  branchOverride &&
                  branchOverride.priceOverride !== undefined &&
                  branchOverride.priceOverride !== null;
                const effectivePrice = hasOverride ? branchOverride.priceOverride! : item.basePrice;
                const isAvailable = branchOverride ? branchOverride.isAvailable : true;
                const priceDiff = effectivePrice - item.basePrice;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Item Name & Dietary Tag */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            item.dietaryTag === "veg"
                              ? "bg-emerald-500"
                              : item.dietaryTag === "non-veg"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                          title={item.dietaryTag}
                        />
                        <span className="font-bold text-slate-900">{item.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1 max-w-sm mt-0.5">
                        {item.description || "Authentic culinary preparation with fresh ingredients."}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        SAC {item.sacCode} • {item.taxRatePercent}% GST
                      </div>
                    </td>

                    {/* Category & Station */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{item.category}</div>
                      <div className="text-xs text-slate-500 capitalize">
                        Station: <span className="font-semibold text-slate-700">{item.station}</span>
                      </div>
                    </td>

                    {/* Central Base Price */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-700 text-base">
                        ₹{item.basePrice.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-400">Standard Master</div>
                    </td>

                    {/* Effective Price for This Branch */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-slate-900 text-base">
                          ₹{effectivePrice.toFixed(2)}
                        </span>
                        {hasOverride && priceDiff > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold">
                            +₹{priceDiff} (+{((priceDiff / item.basePrice) * 100).toFixed(1)}%)
                          </span>
                        )}
                        {hasOverride && priceDiff < 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                            -₹{Math.abs(priceDiff)} ({((priceDiff / item.basePrice) * 100).toFixed(1)}%)
                          </span>
                        )}
                        {!hasOverride && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            (Base)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Availability / 86-ing */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleItemAvailability(item.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          isAvailable
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isAvailable ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        {isAvailable ? "In Stock" : "86'd Out"}
                      </button>
                    </td>

                    {/* Quick Override Controls */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {/* Preset +15% Transit Surcharge */}
                        <button
                          onClick={() => handleApplyPresetSurcharge(item.id, item.basePrice, 15)}
                          title="Apply +15% transit/concession premium"
                          className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold border border-orange-200 transition-colors cursor-pointer"
                        >
                          +15% Transit
                        </button>

                        {/* Reset to Base */}
                        {hasOverride && (
                          <button
                            onClick={() => handleSavePriceOverride(item.id, null)}
                            title="Reset to central master price"
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                          >
                            Reset
                          </button>
                        )}

                        {/* Custom Price Input & Save */}
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="₹ Custom"
                            value={customPriceInputs[item.id] ?? ""}
                            onChange={(e) =>
                              setCustomPriceInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="w-20 px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                          <button
                            onClick={() => {
                              const val = customPriceInputs[item.id];
                              if (val && !isNaN(Number(val))) {
                                handleSavePriceOverride(item.id, Number(val));
                                setCustomPriceInputs((prev) => ({ ...prev, [item.id]: "" }));
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Consolidated Chain Taxes & Indian GST Compliance */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
                Indian GST Compliance
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold">
                Rule 46 CGST Tax Invoice
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Consolidated Chain Taxes &amp; GST Liability Ledger
            </h2>
            <p className="text-sm text-slate-500">
              Aggregated Indian GST reporting under SAC 996331 across all connected branches: Central GST (CGST 2.5%) and State GST (SGST 2.5%) for monthly GSTR-1 tax returns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
              Export CSV Ledger
            </button>
            <button
              onClick={handleCopyTaxJson}
              className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-orange-600" />
              Copy Tax Summary
            </button>
          </div>
        </div>

        {/* GST Invariant Breakdown Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Branch &amp; Code</th>
                <th className="py-3.5 px-4">State Jurisdiction</th>
                <th className="py-3.5 px-4">GSTIN &amp; SAC</th>
                <th className="py-3.5 px-4 text-right">Gross Sales (INR)</th>
                <th className="py-3.5 px-4 text-right">Taxable Turnover (INR)</th>
                <th className="py-3.5 px-4 text-right">CGST @ 2.5%</th>
                <th className="py-3.5 px-4 text-right">SGST @ 2.5%</th>
                <th className="py-3.5 px-4 text-right">Total GST (5%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxMetricsByOutlet.map((outlet) => (
                <tr key={outlet.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Outlet */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{outlet.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{outlet.code}</div>
                  </td>

                  {/* Jurisdiction */}
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-800">
                      {outlet.stateCode === "07" ? "Delhi NCT" : "Haryana"}
                    </div>
                    <div className="text-xs text-slate-500">
                      State Code: <span className="font-mono">{outlet.stateCode}</span>
                    </div>
                  </td>

                  {/* GSTIN & SAC */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono text-xs text-slate-800">{outlet.gstin}</div>
                    <div className="text-[11px] text-slate-400 font-mono">SAC 996331</div>
                  </td>

                  {/* Gross Sales */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{outlet.todaySales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>

                  {/* Taxable */}
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    ₹{outlet.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>

                  {/* CGST */}
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    ₹{outlet.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>

                  {/* SGST */}
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    ₹{outlet.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>

                  {/* Total Tax */}
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-orange-600">
                    ₹{outlet.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {/* Consolidated Summary Row */}
              <tr className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-4 px-4 font-extrabold" colSpan={3}>
                  <div className="flex items-center gap-2">
                    <span>CONSOLIDATED CHAIN TOTAL (3 BRANCHES)</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      GSTR-1 BALANCED
                    </span>
                  </div>
                  <div className="text-xs font-normal text-slate-500">
                    SAC 996331 • FSSAI 10019011000234
                  </div>
                </td>
                <td className="py-4 px-4 text-right font-mono text-base font-black">
                  ₹{totalChainSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-4 text-right font-mono text-base font-bold">
                  ₹{consolidatedTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-4 text-right font-mono text-base font-bold text-slate-800">
                  ₹{consolidatedCgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-4 text-right font-mono text-base font-bold text-slate-800">
                  ₹{consolidatedSgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-4 text-right font-mono text-lg font-black text-orange-600">
                  ₹{consolidatedTotalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* GST Statutory Remittance Notice */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Statutory Jurisdictions:</strong> Delhi branches (DEL-CP-01 &amp; DEL-IGI-03) remit SGST to Delhi NCT (07); Cyber Hub Express (HR-GGN-02) remits SGST to Haryana state (06). Central GST (CGST) remitted to Center.
            </span>
          </div>
          <span className="font-mono text-emerald-700 font-bold shrink-0">
            FSSAI Reg: 10019011000234 Verified
          </span>
        </div>
      </div>
    </div>
  );
}
