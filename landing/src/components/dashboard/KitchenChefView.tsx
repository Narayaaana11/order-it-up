"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Flame,
  Clock,
  CheckCircle2,
  ChefHat,
  Filter,
  Bell,
  Volume2,
  VolumeX,
  Play,
  Check,
} from "lucide-react";
import {
  useOrders,
  useDashboardActions,
} from "@/lib/dashboard-store";
import type {
  KitchenStationType,
  TicketItemStatus,
} from "@/lib/dashboard-models";

export function KitchenChefView() {
  const orders = useOrders();
  const actions = useDashboardActions();

  // Active Station Filter
  const [activeStation, setActiveStation] = useState<KitchenStationType>("all");

  // Status Filter Tab (or "all")
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // Audio / Chime state
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Live timer tick for realistic SLA updates
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 10000); // 10-second tick
    return () => clearInterval(timer);
  }, []);

  // Filter orders by active station items and status
  const kdsTickets = useMemo(() => {
    const referenceTime = currentTimestamp || 1730386800000;
    return orders
      .filter((order) => {
        // Exclude completely served orders unless viewing archive
        const allItemsServed = order.items.every((i) => i.status === "served");
        if (statusFilter === "active" && allItemsServed) return false;
        if (statusFilter === "served" && !allItemsServed) return false;

        // If station filter is not "all", must have at least one item for this station
        if (activeStation !== "all") {
          return order.items.some((i) => i.station === activeStation);
        }
        return true;
      })
      .map((order) => {
        // Calculate items applicable to this station view
        const stationItems =
          activeStation === "all"
            ? order.items
            : order.items.filter((i) => i.station === activeStation);

        // Calculate elapsed minutes (mocked realistic baseline + tick)
        const baseCreatedAt = new Date(order.createdAt).getTime();
        const diffMinutes = Math.max(1, Math.round((referenceTime - baseCreatedAt) / 60000));

        // SLA threshold: <10m green, 10-20m amber, >20m red
        let slaTier: "normal" | "warning" | "breached" = "normal";
        if (diffMinutes >= 20) {
          slaTier = "breached";
        } else if (diffMinutes >= 10) {
          slaTier = "warning";
        }

        return {
          order,
          stationItems,
          elapsedMinutes: diffMinutes,
          slaTier,
        };
      });
  }, [orders, activeStation, statusFilter, currentTimestamp]);

  // Station counts
  const stationCounts = useMemo(() => {
    const counts: Record<KitchenStationType, number> = {
      all: 0,
      oven: 0,
      tandoor: 0,
      bar: 0,
      grill: 0,
      fryer: 0,
    };

    orders.forEach((ord) => {
      ord.items.forEach((item) => {
        if (item.status !== "served") {
          counts.all++;
          if (counts[item.station] !== undefined) {
            counts[item.station]++;
          }
        }
      });
    });

    return counts;
  }, [orders]);

  // Bump individual item: pending -> preparing -> ready -> served
  const handleBumpItem = (orderId: string, itemId: string, currentStatus: TicketItemStatus) => {
    let nextStatus: TicketItemStatus = "preparing";
    if (currentStatus === "pending") nextStatus = "preparing";
    else if (currentStatus === "preparing") nextStatus = "ready";
    else if (currentStatus === "ready") nextStatus = "served";
    else return;

    actions.bumpTicket(orderId, itemId, nextStatus);
  };

  // Bump entire ticket across station items
  const handleBumpEntireTicket = (orderId: string) => {
    actions.bumpTicket(orderId, "all");
  };

  return (
    <div className="space-y-6">
      {/* KDS Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              KDS Engine :3002 Active
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold">
              Chef Station: Marco Rossi (PIN: 7732)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Downtown Bistro Kitchen Brigade • LAN WebSocket
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-[#F07928]" />
            Kitchen Display System (KDS :3002)
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            Real-time kitchen order queue, station routing (Oven, Tandoor, Bar, Grill), touch-optimized ticket bumping, and dynamic SLA prep timer alerts.
          </p>
        </div>

        {/* Quick KDS Tools & Chime Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                statusFilter === "active"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active Queue ({kdsTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("served")}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                statusFilter === "served"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Archived / Served
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2.5 rounded-2xl border transition-colors cursor-pointer ${
              audioEnabled
                ? "bg-orange-50 border-orange-200 text-orange-700"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
            title={audioEnabled ? "Order Alert Chime ON" : "Order Alert Chime MUTED"}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Station Routing Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Station:
          </span>

          <button
            type="button"
            onClick={() => setActiveStation("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeStation === "all"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Stations ({stationCounts.all})
          </button>

          <button
            type="button"
            onClick={() => setActiveStation("oven")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeStation === "oven"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Oven &amp; Pizza ({stationCounts.oven})
          </button>

          <button
            type="button"
            onClick={() => setActiveStation("tandoor")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeStation === "tandoor"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Tandoor &amp; Kebabs ({stationCounts.tandoor})
          </button>

          <button
            type="button"
            onClick={() => setActiveStation("bar")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeStation === "bar"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Craft Bar &amp; Cafe ({stationCounts.bar})
          </button>

          <button
            type="button"
            onClick={() => setActiveStation("grill")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeStation === "grill"
                ? "bg-[#F07928] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Grill &amp; Fryer ({stationCounts.grill})
          </button>
        </div>

        {/* SLA Legend Indicator */}
        <div className="flex items-center gap-3 text-[11px] font-bold px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
          <span className="text-slate-400">SLA:</span>
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            &lt; 10m Normal
          </span>
          <span className="flex items-center gap-1 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            10-20m Warning
          </span>
          <span className="flex items-center gap-1 text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            &gt; 20m Overdue
          </span>
        </div>
      </div>

      {/* Ticket Grid Stream */}
      {kdsTickets.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-black text-slate-900">Kitchen Display Queue Clear</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All kitchen tickets for {activeStation === "all" ? "all stations" : `${activeStation} station`} have been prepared and served.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {kdsTickets.map(({ order, stationItems, elapsedMinutes, slaTier }) => {
            const hasPreparing = stationItems.some((i) => i.status === "preparing");
            const isAllReady = stationItems.every((i) => i.status === "ready" || i.status === "served");

            return (
              <div
                key={order.id}
                className={`rounded-3xl bg-white border-2 flex flex-col justify-between shadow-xs hover:shadow-md transition-all overflow-hidden ${
                  slaTier === "breached"
                    ? "border-red-400/90 ring-2 ring-red-400/20"
                    : slaTier === "warning"
                    ? "border-amber-300"
                    : "border-slate-200/90"
                }`}
              >
                {/* Ticket Top Card Bar */}
                <div
                  className={`p-4 border-b flex items-center justify-between ${
                    slaTier === "breached"
                      ? "bg-red-50/80 border-red-200"
                      : slaTier === "warning"
                      ? "bg-amber-50/70 border-amber-200"
                      : "bg-slate-50/80 border-slate-200/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">{order.orderNumber}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-black">
                        {order.tableName || order.orderType.toUpperCase()}
                      </span>
                      {order.pax && (
                        <span className="text-[11px] text-slate-500 font-medium">{order.pax} Pax</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Server: {order.waiterName || "Counter"} • {order.orderType.replace("_", " ")}
                    </div>
                  </div>

                  {/* SLA Countdown Badge */}
                  <div
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black flex items-center gap-1.5 shadow-xs ${
                      slaTier === "breached"
                        ? "bg-red-600 text-white animate-pulse"
                        : slaTier === "warning"
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsedMinutes}m elapsed</span>
                  </div>
                </div>

                {/* Ticket Items List */}
                <div className="p-4 space-y-3 flex-1">
                  {stationItems.map((item) => {
                    const isItemPending = item.status === "pending";
                    const isItemPreparing = item.status === "preparing";
                    const isItemReady = item.status === "ready";
                    const isItemServed = item.status === "served";

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isItemReady
                            ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                            : isItemPreparing
                            ? "bg-amber-50/40 border-amber-200 text-slate-900"
                            : isItemServed
                            ? "bg-slate-50 border-slate-200 text-slate-400 line-through"
                            : "bg-white border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-[#F07928]">
                                {item.quantity}x
                              </span>
                              <span className="font-bold text-xs text-slate-900">{item.productName}</span>
                              <span
                                className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                  item.dietaryTag === "veg"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {item.dietaryTag}
                              </span>
                            </div>

                            {/* Modifiers & Special Instructions */}
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="text-[11px] text-slate-500 pl-6">
                                {item.modifiers.map((m) => `+ ${m.name}`).join(", ")}
                              </div>
                            )}

                            {item.specialInstructions && (
                              <div className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                Note: {item.specialInstructions}
                              </div>
                            )}

                            <div className="text-[10px] text-slate-400 font-mono pl-6 capitalize">
                              Course: {item.course} • Station: {item.station}
                            </div>
                          </div>

                          {/* 1-Tap Bump Item Button */}
                          <button
                            type="button"
                            onClick={() => handleBumpItem(order.id, item.id, item.status)}
                            disabled={isItemServed}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              isItemPending
                                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                                : isItemPreparing
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                : isItemReady
                                ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                            title={`Click to bump from ${item.status}`}
                          >
                            {isItemPending && (
                              <>
                                <Play className="w-3 h-3" />
                                <span>Prep</span>
                              </>
                            )}
                            {isItemPreparing && (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Ready</span>
                              </>
                            )}
                            {isItemReady && (
                              <>
                                <Bell className="w-3 h-3" />
                                <span>Serve</span>
                              </>
                            )}
                            {isItemServed && <span>Done</span>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Ticket Bump Bar */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Status:{" "}
                    <span className="font-bold text-slate-800 capitalize">
                      {isAllReady ? "Ready to Deliver" : hasPreparing ? "Cooking" : "Pending Order"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBumpEntireTicket(order.id)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bump Ticket</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default KitchenChefView;
