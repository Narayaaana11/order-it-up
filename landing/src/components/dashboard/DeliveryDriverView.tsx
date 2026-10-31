"use client";

import React, { useState, useMemo } from "react";
import {
  Bike,
  MapPin,
  Phone,
  PhoneCall,
  Navigation,
  Banknote,
  Filter,
} from "lucide-react";
import {
  useDispatches,
  useOrders,
  useActiveCashShift,
  useDashboardActions,
} from "@/lib/dashboard-store";
import type {
  DeliveryChannel,
  DeliveryRiderStatus,
} from "@/lib/dashboard-models";

export function DeliveryDriverView() {
  const dispatches = useDispatches();
  const orders = useOrders();
  const activeCashShift = useActiveCashShift();
  const actions = useDashboardActions();

  // Channel Filter: "all" | "direct" | "swiggy" | "zomato"
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  // Proxy Call Simulation Modal/State
  const [proxyCallInfo, setProxyCallInfo] = useState<string | null>(null);

  // Filtered Dispatches
  const filteredDispatches = useMemo(() => {
    if (selectedChannel === "all") return dispatches;
    return dispatches.filter((d) => d.channel === selectedChannel);
  }, [dispatches, selectedChannel]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = dispatches.length;
    const delivered = dispatches.filter((d) => d.riderStatus === "delivered").length;
    const active = total - delivered;
    const codTotal = dispatches
      .filter((d) => d.isCod && d.codCollected)
      .reduce((sum, d) => sum + d.codAmount, 0);
    const codPending = dispatches
      .filter((d) => d.isCod && !d.codCollected && d.riderStatus !== "delivered")
      .reduce((sum, d) => sum + d.codAmount, 0);

    return { total, delivered, active, codTotal, codPending };
  }, [dispatches]);

  // Update Status
  const handleUpdateStatus = (
    dispatchId: string,
    newStatus: DeliveryRiderStatus,
    collectCod?: boolean
  ) => {
    actions.updateDeliveryStatus(dispatchId, newStatus, collectCod);
  };

  // Channel Badge Helper
  const getChannelBadge = (channel: DeliveryChannel) => {
    switch (channel) {
      case "swiggy":
        return {
          bg: "bg-orange-50 text-orange-800 border-orange-200",
          label: "Swiggy Express",
        };
      case "zomato":
        return {
          bg: "bg-red-50 text-red-800 border-red-200",
          label: "Zomato Partner",
        };
      case "direct":
      default:
        return {
          bg: "bg-blue-50 text-blue-800 border-blue-200",
          label: "Direct In-House",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Dispatch Queue Live
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold">
              Driver: Ramesh V (PIN: 6120)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Downtown Bistro Hub • Active Shifts
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Bike className="w-6 h-6 text-[#F07928]" />
            Delivery Dispatch &amp; Cash-on-Delivery (COD)
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            Multi-aggregator dispatch queue (Swiggy, Zomato, Direct), privacy-preserving masked contact numbers, rider progression, and COD till reconciliation.
          </p>
        </div>

        {/* Till & COD Summary Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div className="text-slate-500 text-[11px]">Active Counter Till</div>
            <div className="text-sm font-bold text-slate-900 font-mono">
              ₹{activeCashShift.expectedCashInDrawer.toLocaleString("en-IN")}.00
            </div>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
            <div className="text-emerald-700 text-[11px]">COD Reconciled in Till</div>
            <div className="text-sm font-bold text-emerald-700 font-mono">
              ₹{stats.codTotal.toLocaleString("en-IN")}.00
            </div>
          </div>
          {stats.codPending > 0 && (
            <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-xs">
              <div className="text-amber-700 text-[11px]">COD Pending Collection</div>
              <div className="text-sm font-bold text-amber-900 font-mono">
                ₹{stats.codPending.toLocaleString("en-IN")}.00
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Masked Call Simulation Banner */}
      {proxyCallInfo && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-blue-600 animate-bounce" />
            <span className="font-bold">Privacy Masked Proxy Call Initiated:</span>
            <span>{proxyCallInfo}</span>
          </div>
          <button
            type="button"
            onClick={() => setProxyCallInfo(null)}
            className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs & Queue Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Channel:
          </span>

          <button
            type="button"
            onClick={() => setSelectedChannel("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedChannel === "all"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Channels ({dispatches.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedChannel("direct")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedChannel === "direct"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Direct In-House
          </button>

          <button
            type="button"
            onClick={() => setSelectedChannel("swiggy")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedChannel === "swiggy"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Swiggy Express
          </button>

          <button
            type="button"
            onClick={() => setSelectedChannel("zomato")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedChannel === "zomato"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Zomato Partner
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          {stats.active} Active Dispatches • {stats.delivered} Delivered
        </div>
      </div>

      {/* Dispatch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredDispatches.map((dispatch) => {
          const channelStyle = getChannelBadge(dispatch.channel);
          const order = orders.find((o) => o.id === dispatch.orderId);
          const isDelivered = dispatch.riderStatus === "delivered";
          const isAssigned = dispatch.riderStatus === "assigned";
          const isArrived = dispatch.riderStatus === "arrived";
          const isDispatched = dispatch.riderStatus === "dispatched";

          return (
            <div
              key={dispatch.id}
              className={`p-6 rounded-3xl bg-white border-2 flex flex-col justify-between shadow-xs transition-all ${
                isDelivered
                  ? "border-emerald-200 bg-emerald-50/20"
                  : "border-slate-200/90 hover:border-slate-300"
              }`}
            >
              <div className="space-y-4">
                {/* Dispatch Top Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-slate-900">{dispatch.orderNumber}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${channelStyle.bg}`}
                    >
                      {channelStyle.label}
                    </span>
                  </div>

                  {/* Payment Type Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      dispatch.isCod
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {dispatch.isCod ? `COD: ₹${dispatch.codAmount.toFixed(0)}` : "Prepaid Online"}
                  </span>
                </div>

                {/* Customer Verification & Masked Contact */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{dispatch.customerName}</span>
                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                      Est. {dispatch.estimatedMinutes || 25} mins
                    </span>
                  </div>

                  <div className="text-slate-600 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-[#F07928] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">{dispatch.deliveryAddress}</span>
                      {dispatch.landmark && (
                        <div className="text-[11px] text-slate-500">
                          Landmark: {dispatch.landmark}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Privacy Phone Masking Action */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                    <div className="flex items-center gap-1.5 font-mono text-slate-700 font-bold">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dispatch.maskedPhone}</span>
                      <span className="text-[10px] text-emerald-700 font-sans font-semibold">
                        (Masked)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setProxyCallInfo(
                            `Calling ${dispatch.customerName} via Virtual IVR Proxy (+91 80 4719 0000). Direct phone hidden for privacy.`
                          )
                        }
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PhoneCall className="w-3 h-3 text-blue-600" />
                        <span>Call Proxy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          alert(`Opening Google Maps navigation to: ${dispatch.deliveryAddress}`)
                        }
                        className="px-2.5 py-1 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#F07928] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Maps</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items in Order */}
                {order && (
                  <div className="space-y-1 text-xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Dishes in Package ({order.items.length})
                    </div>
                    <div className="text-slate-700 text-xs">
                      {order.items.map((i) => `${i.productName} (x${i.quantity})`).join(", ")}
                    </div>
                  </div>
                )}
              </div>

              {/* Rider Progression Stepper & COD Reconciliation */}
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
                {/* Stepper Status Buttons */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(dispatch.id, "assigned")}
                    className={`py-1.5 rounded-xl cursor-pointer transition-all ${
                      isAssigned ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Assigned
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(dispatch.id, "arrived")}
                    className={`py-1.5 rounded-xl cursor-pointer transition-all ${
                      isArrived ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    At Outlet
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(dispatch.id, "dispatched")}
                    className={`py-1.5 rounded-xl cursor-pointer transition-all ${
                      isDispatched ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Dispatched
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(dispatch.id, "delivered", dispatch.isCod)}
                    className={`py-1.5 rounded-xl cursor-pointer transition-all ${
                      isDelivered ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Delivered
                  </button>
                </div>

                {/* Cash-on-Delivery (COD) Reconciliation Action */}
                {dispatch.isCod && (
                  <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-amber-700" />
                      <div>
                        <div className="font-bold text-amber-950">
                          Cash-on-Delivery: ₹{dispatch.codAmount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-amber-800">
                          {dispatch.codCollected
                            ? "Cash collected & updated in counter till"
                            : "Collect cash from diner upon handoff"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(dispatch.id, "delivered", true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        dispatch.codCollected
                          ? "bg-emerald-600 text-white cursor-default"
                          : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                      }`}
                    >
                      {dispatch.codCollected ? "Reconciled" : "Collect & Reconcile"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default DeliveryDriverView;
