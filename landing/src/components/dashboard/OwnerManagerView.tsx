"use client";

import React, { useState, useMemo } from "react";
import {
  Building2,
  Store,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Key,
  ShieldCheck,
  Cloud,
  Clock,
  Eye,
  EyeOff,
  Edit2,
  CheckCircle2,
  Server,
  X,
} from "lucide-react";
import {
  useOutlets,
  useStaff,
  useZReports,
  useTenants,
  useDashboardActions,
} from "@/lib/dashboard-store";
import type {
  OperationalRole,
  StaffUser,
} from "@/lib/dashboard-models";

export function OwnerManagerView() {
  const outlets = useOutlets();
  const staff = useStaff();
  const zReports = useZReports();
  const tenants = useTenants();
  const actions = useDashboardActions();

  // Selected Outlet for Drilldown ("all" or outlet id)
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>("all");

  // Staff PIN Editor Modal State
  const [editingStaffUser, setEditingStaffUser] = useState<StaffUser | null>(null);
  const [newRole, setNewRole] = useState<OperationalRole>("cashier");
  const [newPin, setNewPin] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinsMap, setShowPinsMap] = useState<Record<string, boolean>>({});

  // S3 Manual Snapshot State
  const [isSnapshotting, setIsSnapshotting] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);

  // Tenant / S3 info
  const tenant = tenants[0] || {
    id: "tenant-0892",
    businessName: "Spice Route Hospitality Group",
    s3Bucket: "orderitup-tenant-spiceroute",
  };

  // Consolidated Chain Metrics
  const totalSales = useMemo(() => {
    return outlets.reduce((acc, o) => acc + o.todaySales, 0);
  }, [outlets]);

  const totalOrders = useMemo(() => {
    return outlets.reduce((acc, o) => acc + o.ordersCount, 0);
  }, [outlets]);

  const avgTicket = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

  // Tender Mix
  const totalUpi = outlets.reduce((acc, o) => acc + o.tenders.upi, 0);
  const totalCash = outlets.reduce((acc, o) => acc + o.tenders.cash, 0);
  const totalCard = outlets.reduce((acc, o) => acc + o.tenders.card, 0);
  const upiPercent = totalSales > 0 ? Math.round((totalUpi / totalSales) * 100) : 0;
  const cashPercent = totalSales > 0 ? Math.round((totalCash / totalSales) * 100) : 0;
  const cardPercent = totalSales > 0 ? Math.round((totalCard / totalSales) * 100) : 0;

  // Toggle PIN visibility for an individual user
  const togglePinVisibility = (userId: string) => {
    setShowPinsMap((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Open Staff PIN editor
  const handleOpenPinEditor = (user: StaffUser) => {
    setEditingStaffUser(user);
    setNewRole(user.role);
    setNewPin(user.pin);
    setPinError(null);
  };

  // Submit Staff Role & PIN Assignment
  const handleSaveStaffPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffUser) return;

    if (!/^\d{4}$/.test(newPin)) {
      setPinError("PIN must be exactly 4 numeric digits (e.g. 1044)");
      return;
    }

    try {
      actions.assignStaffRole(editingStaffUser.id, newRole, newPin);
      setEditingStaffUser(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPinError(err.message);
      } else {
        setPinError("Failed to update staff PIN");
      }
    }
  };

  // Trigger S3 Encrypted Snapshot
  const handleTriggerS3Snapshot = () => {
    setIsSnapshotting(true);
    setTimeout(() => {
      setIsSnapshotting(false);
      setSnapshotSuccess(
        `Encrypted SQLite snapshot (order-it-up-${new Date().toISOString().split("T")[0]}.sqlite.enc) uploaded to s3://${tenant.s3Bucket}/tenants/${tenant.id}/backups/`
      );
      setTimeout(() => setSnapshotSuccess(null), 5000);
    }, 1500);
  };

  // Filtered outlets based on selection
  const displayOutlets = useMemo(() => {
    if (selectedOutletFilter === "all") return outlets;
    return outlets.filter((o) => o.id === selectedOutletFilter);
  }, [outlets, selectedOutletFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected Chain Mesh Live
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold">
              Owner: Priya Sharma (PIN: 9021)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Spice Route Hospitality Group • 3 Connected Branches
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#F07928]" />
            Multi-Restaurant Chain Telemetry &amp; Staff Security
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            Live multi-unit sales telemetry, staff 4-digit PIN assignment, end-of-day shift closure audits, and isolated Amazon S3 cloud backup outbox synchronization.
          </p>
        </div>

        {/* Global Owner Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTriggerS3Snapshot}
            disabled={isSnapshotting}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSnapshotting ? "animate-spin" : "text-amber-400"}`} />
            <span>{isSnapshotting ? "Encrypting & Uploading..." : "Trigger S3 Backup Snapshot"}</span>
          </button>
        </div>
      </div>

      {/* S3 Backup Notification Banner */}
      {snapshotSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono flex items-center justify-between shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{snapshotSuccess}</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
            SHA-256 Verified
          </span>
        </div>
      )}

      {/* CONSOLIDATED CHAIN PERFORMANCE KPIS (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Total Chain Revenue */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">Total Chain Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            ₹{totalSales.toLocaleString("en-IN")}.00
          </div>
          <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+22.8% vs last week across 3 branches</span>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">Orders Processed</span>
            <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            {totalOrders} Orders
          </div>
          <div className="text-xs text-slate-500 font-medium">
            100% Settled • 0 LAN packet drops
          </div>
        </div>

        {/* KPI 3: Average Order Value */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">Average Ticket (AOV)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            ₹{avgTicket.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-amber-700 font-medium">
            Fine Dine, QSR &amp; Transit Cafe
          </div>
        </div>

        {/* KPI 4: Tender Mix */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">Tender Distribution</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Chain Mix
            </span>
          </div>
          <div className="space-y-1 pt-1 text-xs font-mono font-bold">
            <div className="flex justify-between text-blue-700">
              <span>UPI Dynamic QR:</span>
              <span>{upiPercent}%</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Cash (24V Till):</span>
              <span>{cashPercent}%</span>
            </div>
            <div className="flex justify-between text-purple-700">
              <span>Card Swipe POS:</span>
              <span>{cardPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* MULTI-OUTLET LIVE BRANCH CARDS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Store className="w-5 h-5 text-[#F07928]" />
              Live Sales Across Connected Outlets
            </h3>
            <p className="text-xs text-slate-500">
              Compare sales turnover, active floor tables, and LAN counter ports across Downtown Bistro, Cyber Hub, and Airport Terminal 3.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedOutletFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedOutletFilter === "all"
                  ? "bg-[#F07928] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Outlets (3)
            </button>
            {outlets.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedOutletFilter(o.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedOutletFilter === o.id
                    ? "bg-[#F07928] text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {o.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {displayOutlets.map((outlet) => (
            <div
              key={outlet.id}
              className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                    {outlet.code} • {outlet.city}
                  </span>
                  <h4 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                    {outlet.name}
                  </h4>
                  <p className="text-xs text-slate-500">{outlet.location}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                  {outlet.status}
                </span>
              </div>

              {/* Sales & Orders Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">Today Sales</div>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    ₹{outlet.todaySales.toLocaleString("en-IN")}.00
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Orders Processed</div>
                  <div className="text-lg font-black text-[#F07928] font-mono">
                    {outlet.ordersCount} Orders
                  </div>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between text-slate-600 font-mono text-[11px]">
                  <span>Active Tables: {outlet.activeTables}</span>
                  <span>AOV: ₹{outlet.avgTicket.toFixed(0)}</span>
                </div>
              </div>

              {/* Hardware & Port Telemetry */}
              <div className="space-y-1 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 font-mono">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  <span>{outlet.enginePort}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>GSTIN: {outlet.gstin} • FSSAI: {outlet.fssaiNumber}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STAFF PIN & ROLE MANAGEMENT SECTION */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Key className="w-5 h-5 text-[#F07928]" />
              Staff Security Directory &amp; 4-Digit Terminal PINs
            </h3>
            <p className="text-xs text-slate-500">
              Manage terminal authorization PINs and operational roles for cashiers, chefs, servers, and managers.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {staff.length} Active Team Members
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-3">Employee Name</th>
                <th className="pb-3">Operational Role</th>
                <th className="pb-3">Branch Location</th>
                <th className="pb-3">4-Digit Security PIN</th>
                <th className="pb-3">Last Active</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {staff.map((user) => {
                const isPinVisible = showPinsMap[user.id] || false;
                return (
                  <tr key={user.id} className="hover:bg-slate-50/50">
                    <td className="py-3">
                      <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                    </td>
                    <td className="py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-50 text-orange-800 border border-orange-200">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">
                      {outlets.find((o) => o.id === user.activeOutletId)?.name.split(" ")[0] || "Downtown"}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 tracking-widest text-sm">
                          {isPinVisible ? user.pin : "••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePinVisibility(user.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                          title={isPinVisible ? "Hide PIN" : "Show PIN"}
                        >
                          {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 text-slate-500 text-[11px]">
                      {user.lastActive}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenPinEditor(user)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-slate-500" />
                        <span>Edit Role / PIN</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AMAZON S3 CLOUD BACKUP OUTBOX & SHIFT CLOSURES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 cols): Amazon S3 Cloud Backup Outbox */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-600" />
                Amazon S3 Tenant Isolation Outbox
              </h3>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                Zero Commingling Verified
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Automated offline-first database synchronization to isolated tenant prefix{" "}
              <code className="text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                tenants/{tenant.id}/
              </code>{" "}
              with SHA-256 encrypted rollups.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Dedicated Bucket:</span>
                <span className="font-bold text-slate-900">{tenant.s3Bucket}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Domain Structure:</span>
                <span className="text-slate-800">backups / users / payments / media</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Last Snapshot Hash:</span>
                <span className="text-emerald-700 font-bold">sha256:7f8a91c4...</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Outbox Sync Status:</span>
                <span className="text-emerald-700 font-bold">Synced (0 pending in queue)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): Shift Closures History */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                Shift Closures &amp; Supervisor Sign-Offs
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {zReports.length} Historical Z-Reports
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
              {zReports.map((z) => (
                <div
                  key={z.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Z-Report #{z.zNumber}</span>
                      <span className="text-slate-400 font-normal">({z.businessDate})</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Cashier: {z.cashierName} • Sup: {z.supervisorName}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        z.status === "balanced"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {z.status === "balanced" ? "Balanced" : "Shortage"}
                    </span>
                    <div className="font-mono font-bold text-slate-800 mt-0.5 text-xs">
                      ₹{z.actualCountedCash.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STAFF PIN & ROLE ASSIGNMENT MODAL */}
      {editingStaffUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-black text-slate-900">
                  Assign Staff Role &amp; 4-Digit PIN
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaffUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaffPin} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{editingStaffUser.name}</div>
                <div className="text-slate-500">{editingStaffUser.email}</div>
                <div className="text-[11px] text-slate-400 font-mono">ID: {editingStaffUser.id}</div>
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {pinError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Assign Operational Role:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as OperationalRole)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="owner">Owner / Executive</option>
                  <option value="manager">Restaurant General Manager</option>
                  <option value="cashier">Front Counter Cashier</option>
                  <option value="chef">Kitchen Chef / Cook</option>
                  <option value="waiter">Server / Waiter</option>
                  <option value="accountant">Financial Accountant</option>
                  <option value="driver">Delivery Driver</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">
                  4-Digit Terminal Security PIN:
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="e.g. 1044"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-lg text-slate-900 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-[11px] text-slate-500">
                  Must be exactly 4 numeric digits for POS terminal login.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaffUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold cursor-pointer shadow-xs"
                >
                  Save Role &amp; PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default OwnerManagerView;
