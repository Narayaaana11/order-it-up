"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  UtensilsCrossed,
  Flame,
  Clock,
  Coffee,
  MapPin,
} from "lucide-react";
import {
  useTables,
  useOrders,
  useCatalog,
  useDashboardActions,
} from "@/lib/dashboard-store";
import type {
  RoomFloor,
  TableStatus,
  CourseType,
} from "@/lib/dashboard-models";

export function ServerWaiterView() {
  const tables = useTables();
  const orders = useOrders();
  const catalog = useCatalog();
  const actions = useDashboardActions();

  // Active Floor Selection
  const [activeFloor, setActiveFloor] = useState<RoomFloor>("Indoor");

  // Selected Table for Tableside Order Drawer
  const [selectedTableId, setSelectedTableId] = useState<string>("tbl-indoor-04");

  // Firing action feedback toast
  const [firingToast, setFiringToast] = useState<string | null>(null);

  // Available floors
  const floors: RoomFloor[] = ["Indoor", "Patio", "Rooftop", "Private Dining"];

  // Filter tables by floor
  const floorTables = useMemo(() => {
    return tables.filter((t) => t.floor === activeFloor);
  }, [tables, activeFloor]);

  // Find currently selected table
  const selectedTable = useMemo(() => {
    return tables.find((t) => t.id === selectedTableId) || floorTables[0] || tables[0];
  }, [tables, selectedTableId, floorTables]);

  // Find order associated with selected table
  const tableOrder = useMemo(() => {
    if (!selectedTable?.currentOrderId) return null;
    return orders.find((o) => o.id === selectedTable.currentOrderId);
  }, [orders, selectedTable]);

  // Overall Table Statistics
  const tableStats = useMemo(() => {
    const total = tables.length;
    const occupied = tables.filter((t) => t.status === "occupied").length;
    const available = tables.filter((t) => t.status === "available").length;
    const billed = tables.filter((t) => t.status === "billed").length;
    const reserved = tables.filter((t) => t.status === "reserved").length;
    return { total, occupied, available, billed, reserved };
  }, [tables]);

  // Fire course handler
  const handleFireCourse = (course: CourseType) => {
    if (!selectedTable) return;
    actions.fireCourse(selectedTable.id, course);
    setFiringToast(`🔥 Course Fired: ${course.toUpperCase()} sent to Kitchen KDS (:3002)`);
    setTimeout(() => setFiringToast(null), 3000);
  };

  // Status Color Helpers
  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case "available":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          dot: "bg-emerald-500",
          label: "Available",
        };
      case "occupied":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          dot: "bg-amber-500",
          label: "Occupied",
        };
      case "billed":
        return {
          bg: "bg-purple-50 text-purple-800 border-purple-200",
          dot: "bg-purple-500",
          label: "Billed",
        };
      case "reserved":
        return {
          bg: "bg-blue-50 text-blue-800 border-blue-200",
          dot: "bg-blue-500",
          label: "Reserved",
        };
      default:
        return {
          bg: "bg-slate-50 text-slate-800 border-slate-200",
          dot: "bg-slate-400",
          label: status,
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
              Waiter App :3003 Live
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold">
              Captain: Aman Kapoor (PIN: 2481)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Downtown Bistro • Handheld Tableside Mode
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-[#F07928]" />
            Floor Table Map &amp; Tableside Course Firing
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            Visual restaurant floor maps across dining zones, real-time occupancy status tracking, and tableside course firing (Starters, Mains, Desserts).
          </p>
        </div>

        {/* Occupancy Summary Counters */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Available ({tableStats.available})</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Occupied ({tableStats.occupied})</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Billed ({tableStats.billed})</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Reserved ({tableStats.reserved})</span>
          </div>
        </div>
      </div>

      {/* Course Firing Notification Feedback Toast */}
      {firingToast && (
        <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-300 text-[#EA580C] text-xs font-mono font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#F07928] animate-bounce" />
            <span>{firingToast}</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400">WebSocket Push :3002</span>
        </div>
      )}

      {/* Room / Floor Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
        {floors.map((flr) => {
          const count = tables.filter((t) => t.floor === flr).length;
          return (
            <button
              key={flr}
              type="button"
              onClick={() => setActiveFloor(flr)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFloor === flr
                  ? "bg-[#F07928] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{flr} Dining</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeFloor === flr ? "bg-white/30 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Visual Floor Canvas on Left (7 cols), Selected Table & Course Firing on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Interactive Visual Table Map */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  {activeFloor} Dining Floor Layout
                </h3>
                <p className="text-xs text-slate-500">
                  Click a table to inspect live items and manage tableside course sequencing.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {floorTables.length} Tables Registered
              </span>
            </div>

            {/* Visual Floor Grid Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {floorTables.map((tbl) => {
                const isSelected = tbl.id === selectedTableId;
                const statusStyle = getStatusBadge(tbl.status);
                const order = orders.find((o) => o.id === tbl.currentOrderId);

                return (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() => setSelectedTableId(tbl.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between h-36 cursor-pointer ${
                      isSelected
                        ? "border-[#F07928] bg-orange-50/50 shadow-md ring-2 ring-orange-400/20"
                        : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    {/* Table Card Top Row */}
                    <div className="flex items-center justify-between w-full">
                      <span className="text-lg font-black text-slate-900 tracking-tight font-mono">
                        {tbl.number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${statusStyle.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        <span>{statusStyle.label}</span>
                      </span>
                    </div>

                    {/* Table Details Middle */}
                    <div className="space-y-1 text-xs">
                      <div className="text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>{tbl.guestCount ? `${tbl.guestCount} / ${tbl.capacity} Pax` : `${tbl.capacity} Covers`}</span>
                      </div>
                      {tbl.seatedAt && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Seated {tbl.seatedAt}</span>
                        </div>
                      )}
                    </div>

                    {/* Table Footer with Bill Amount */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs w-full">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {tbl.waiterName ? tbl.waiterName.split(" ")[0] : "Unassigned"}
                      </span>
                      {order ? (
                        <span className="font-mono font-bold text-slate-900">
                          ₹{order.total.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">Free</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Tableside Order & Course Firing Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
            {/* Selected Table Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-900 font-mono">
                    Table {selectedTable?.number}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      getStatusBadge(selectedTable?.status || "available").bg
                    }`}
                  >
                    {getStatusBadge(selectedTable?.status || "available").label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Floor: {selectedTable?.floor} • Capacity: {selectedTable?.capacity} Covers
                </p>
              </div>

              {tableOrder && (
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Bill Total</div>
                  <div className="text-lg font-black text-[#F07928] font-mono">
                    ₹{tableOrder.total.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* COURSE FIRING CONTROLS (Core Operational Requirement) */}
            {tableOrder ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-[#F07928]" />
                    <span>Kitchen Course Firing Sequencing</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Release held dishes course-by-course to the kitchen brigade on KDS :3002.
                  </p>
                </div>

                {/* 3 Course Firing Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Starters */}
                  <button
                    type="button"
                    onClick={() => handleFireCourse("starter")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      selectedTable?.courseFiring?.starter
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 hover:border-orange-300 text-slate-700"
                    }`}
                  >
                    <Flame
                      className={`w-4 h-4 ${
                        selectedTable?.courseFiring?.starter ? "text-emerald-600 animate-pulse" : "text-orange-500"
                      }`}
                    />
                    <span className="text-xs font-bold">Starters</span>
                    <span className="text-[10px] font-mono">
                      {selectedTable?.courseFiring?.starter ? "Fired (In Prep)" : "Fire Now"}
                    </span>
                  </button>

                  {/* Mains */}
                  <button
                    type="button"
                    onClick={() => handleFireCourse("main")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      selectedTable?.courseFiring?.main
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 hover:border-orange-300 text-slate-700"
                    }`}
                  >
                    <UtensilsCrossed
                      className={`w-4 h-4 ${
                        selectedTable?.courseFiring?.main ? "text-emerald-600 animate-pulse" : "text-slate-500"
                      }`}
                    />
                    <span className="text-xs font-bold">Mains</span>
                    <span className="text-[10px] font-mono">
                      {selectedTable?.courseFiring?.main ? "Fired (In Prep)" : "Fire Mains"}
                    </span>
                  </button>

                  {/* Desserts */}
                  <button
                    type="button"
                    onClick={() => handleFireCourse("dessert")}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      selectedTable?.courseFiring?.dessert
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 hover:border-orange-300 text-slate-700"
                    }`}
                  >
                    <Coffee
                      className={`w-4 h-4 ${
                        selectedTable?.courseFiring?.dessert ? "text-emerald-600 animate-pulse" : "text-amber-500"
                      }`}
                    />
                    <span className="text-xs font-bold">Desserts</span>
                    <span className="text-[10px] font-mono">
                      {selectedTable?.courseFiring?.dessert ? "Fired (In Prep)" : "Fire Desserts"}
                    </span>
                  </button>
                </div>

                {/* Active Ordered Dishes Grouped by Course */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Active Dishes on Table ({tableOrder.items.length})
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {tableOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{item.quantity}x</span>
                            <span>{item.productName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            Course: {item.course} • Station: {item.station}
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              item.status === "ready"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "preparing"
                                ? "bg-amber-100 text-amber-800"
                                : item.status === "served"
                                ? "bg-slate-200 text-slate-600"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {item.status}
                          </span>
                          <div className="font-mono text-slate-600 font-bold mt-1 text-[11px]">
                            ₹{(item.unitPrice * item.quantity).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
                <div className="p-8 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <Users className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-700">Table is Currently Available</div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Seat guests at Table {selectedTable?.number} to open a new handheld order on port :3003.
                  </p>
                </div>
              )}

              {/* Quick Add Tableside Dish Bar */}
              <div className="pt-2 space-y-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Quick Add Add-on:</span>
                  <span className="text-[11px] text-slate-400">Direct KOT Routing</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {catalog.slice(0, 4).map((dish) => (
                    <div
                      key={dish.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-orange-300 transition-colors text-left text-xs space-y-1"
                    >
                      <div className="font-bold text-slate-900 truncate" title={dish.name}>
                        {dish.name}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-600 font-bold">₹{dish.basePrice}</span>
                        <span className="text-[9px] text-slate-400 font-mono capitalize">{dish.course}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ServerWaiterView;
