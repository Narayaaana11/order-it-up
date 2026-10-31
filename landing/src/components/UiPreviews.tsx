"use client";

import React, { useState } from "react";
import {
  ShoppingCart,
  ChefHat,
  Receipt,
  Plus,
  Minus,
  Check,
  CheckCircle2,
  Clock,
  QrCode,
  Sparkles,
  Zap,
  Printer,
  RotateCcw,
} from "lucide-react";
import { MOCK_ORDER } from "@/lib/constants";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";
import Magnet from "@/components/reactbits/Magnet";
import TiltedCard from "@/components/reactbits/TiltedCard";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { triggerOpenBillModal } from "@/lib/modalEvents";

export default function UiPreviews() {
  const [activeTab, setActiveTab] = useState<"cart" | "kds" | "receipt">("cart");

  // Cart state
  const [cartItems, setCartItems] = useState(MOCK_ORDER.items);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [isPaid, setIsPaid] = useState(false);

  // KDS bump state: item stage map: 'pending' | 'preparing' | 'ready' | 'served'
  const [kdsStages, setKdsStages] = useState<{ [id: string]: "pending" | "preparing" | "ready" | "served" }>({
    "item-1": "preparing",
    "item-2": "ready",
    "item-3": "ready",
    "item-4": "pending",
  });

  // Receipt printed animation state
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);

  // Cart math calculations
  const updateQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = Math.max(0, item.qty + delta);
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter((item) => item.qty > 0)
    );
  };

  const resetCart = () => {
    setCartItems(MOCK_ORDER.items);
    setIsPaid(false);
  };

  const itemSubtotal = cartItems.reduce(
    (acc, item) => acc + (item.price + item.modPrice) * item.qty,
    0
  );
  const cgst = itemSubtotal * 0.025;
  const sgst = itemSubtotal * 0.025;
  const serviceCharge = orderType === "dine_in" ? itemSubtotal * 0.05 : 0;
  const grandTotal = Math.round(itemSubtotal + cgst + sgst + serviceCharge);

  // KDS bump handler
  const advanceKdsStage = (id: string) => {
    setKdsStages((prev) => {
      const current = prev[id] || "pending";
      let next: "pending" | "preparing" | "ready" | "served" = "preparing";
      if (current === "pending") next = "preparing";
      else if (current === "preparing") next = "ready";
      else if (current === "ready") next = "served";
      else next = "pending";
      return { ...prev, [id]: next };
    });
  };

  const bumpAllKds = () => {
    setKdsStages({
      "item-1": "ready",
      "item-2": "ready",
      "item-3": "ready",
      "item-4": "ready",
    });
  };

  const triggerPrintReceipt = () => {
    setIsPrintingReceipt(true);
    setTimeout(() => {
      setIsPrintingReceipt(false);
    }, 1500);
  };

  return (
    <section id="ui-preview" className="py-20 lg:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <ShinyText text="Real Interactive Simulations" speed={3.5} />
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            <BlurText
              text="Experience the Desktop POS in Action"
              delay={40}
              className="justify-center"
            />
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Interact with live, authentic representations of the counter billing simulator,
            local KDS kitchen ticket, and monospace 80mm ESC/POS thermal receipt.
          </p>
        </div>

        {/* Tab Navigation Pill Selector with React Bits Magnet */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200 shadow-inner max-w-full overflow-x-auto gap-1">
            <Magnet padding={25} magnetStrength={3}>
              <button
                type="button"
                onClick={() => setActiveTab("cart")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                  activeTab === "cart"
                    ? "bg-[#F07928] text-white shadow-md shadow-orange-500/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>1. POS Order Cart</span>
              </button>
            </Magnet>

            <Magnet padding={25} magnetStrength={3}>
              <button
                type="button"
                onClick={() => setActiveTab("kds")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                  activeTab === "kds"
                    ? "bg-[#F07928] text-white shadow-md shadow-orange-500/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ChefHat className="w-4 h-4" />
                <span>2. Live KDS Kitchen Ticket</span>
              </button>
            </Magnet>

            <Magnet padding={25} magnetStrength={3}>
              <button
                type="button"
                onClick={() => setActiveTab("receipt")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                  activeTab === "receipt"
                    ? "bg-[#F07928] text-white shadow-md shadow-orange-500/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>3. 80mm Thermal Slip</span>
              </button>
            </Magnet>
          </div>
        </div>

        {/* Dynamic Interactive Tab Container */}
        <div className="mt-10 max-w-4xl mx-auto">
          {/* TAB 1: POS ORDER CART */}
          {activeTab === "cart" && (
            <TiltedCard maxAngle={4} perspective={1400} scaleOnHover={1.01} showGlare={true} className="w-full">
              <div className="rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-300">
              {/* Window Header */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                  <span className="ml-2 text-xs font-semibold text-slate-800">
                    {MOCK_ORDER.restaurant} • Counter #01
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetCart}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs rounded-md transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-orange-50 text-orange-700 border border-orange-200">
                    Table {MOCK_ORDER.table} • {MOCK_ORDER.pax} Pax
                  </span>
                </div>
              </div>

              {/* Service Type Switcher */}
              <div className="p-4 sm:p-6 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType("dine_in")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      orderType === "dine_in"
                        ? "bg-[#F07928] text-white shadow-xs"
                        : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
                    }`}
                  >
                    Dine-in (Table T-04)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("takeaway")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      orderType === "takeaway"
                        ? "bg-[#F07928] text-white shadow-xs"
                        : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
                    }`}
                  >
                    Takeaway / Pick-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("delivery")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      orderType === "delivery"
                        ? "bg-[#F07928] text-white shadow-xs"
                        : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
                    }`}
                  >
                    Delivery Dispatch
                  </button>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  Cashier: {MOCK_ORDER.cashier}
                </span>
              </div>

              {/* Cart Items List */}
              <div className="p-4 sm:p-6 divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Cart is empty. Click Reset to reload sample gourmet dishes.
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.tag === "veg"
                                ? "bg-emerald-500"
                                : item.tag === "vegan"
                                ? "bg-teal-500"
                                : "bg-amber-500"
                            }`}
                          />
                          <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.modifier}</p>
                        <p className="text-[11px] text-slate-500 font-mono italic mt-0.5">Note: {item.note}</p>
                      </div>

                      {/* Quantity Controls & Line Total */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-slate-50 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, -1)}
                            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                            aria-label={`Decrease ${item.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-mono font-bold text-slate-900 px-1.5 min-w-[20px] text-center">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1)}
                            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                            aria-label={`Increase ${item.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-bold font-mono text-slate-900 min-w-[70px] text-right">
                          ₹{((item.price + item.modPrice) * item.qty).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Financial Breakdown & Settle Button */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200">
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono text-slate-800 font-medium">₹{itemSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST (2.5%):</span>
                    <span className="font-mono text-slate-800 font-medium">₹{cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST (2.5%):</span>
                    <span className="font-mono text-slate-800 font-medium">₹{sgst.toFixed(2)}</span>
                  </div>
                  {orderType === "dine_in" && (
                    <div className="flex justify-between">
                      <span>Service Charge (5.0%):</span>
                      <span className="font-mono text-slate-800 font-medium">₹{serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-[#F07928] font-mono text-base font-extrabold">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Settle Action Button */}
                <div className="mt-5">
                  {isPaid ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Order #104 Settled! 24V Drawer Ejected &amp; KOT Fired.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPaid(false)}
                        className="text-xs underline hover:text-emerald-950 font-medium"
                      >
                        New Bill
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsPaid(true)}
                      className="w-full h-12 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Settle &amp; Print Thermal Receipt (₹{grandTotal.toFixed(2)})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </TiltedCard>
        )}

        {/* TAB 2: LIVE KDS KITCHEN TICKET */}
        {activeTab === "kds" && (
          <TiltedCard maxAngle={4} perspective={1400} scaleOnHover={1.01} showGlare={true} className="w-full">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-300">
              {/* Ticket Topbar */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-black font-mono px-3 py-1 rounded-lg bg-[#F07928] text-white">
                    #104
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Table T-04 (Indoor)</h3>
                    <p className="text-xs text-slate-500 font-mono">Dine-in • 4 Guests • Captain: Priya K.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono text-xs">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>08:42 elapsed (SLA: 12m)</span>
                  </div>
                  <button
                    type="button"
                    onClick={bumpAllKds}
                    className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 shadow-xs transition-colors"
                  >
                    Bump All to Ready
                  </button>
                </div>
              </div>

              {/* Station Routing Banner */}
              <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs font-mono text-slate-600">
                <span>Station: Main Kitchen &amp; Wood-Fire Oven</span>
                <span className="text-emerald-700 font-semibold">WebSocket LAN :3002 (Connected)</span>
              </div>

              {/* Ticket Course Items with Bump Actions */}
              <div className="p-5 sm:p-6 space-y-4">
                {MOCK_ORDER.items.map((item) => {
                  const stage = kdsStages[item.id] || "pending";
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-black font-mono text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                            {item.qty}x
                          </span>
                          <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-amber-800 font-medium">{item.modifier}</span>
                          <span className="text-[11px] text-slate-500 font-mono italic">
                            • Special: {item.note}
                          </span>
                        </div>
                      </div>

                      {/* Stage Badge & Bump Action Button */}
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span
                          className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md uppercase border ${
                            stage === "ready"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : stage === "preparing"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : stage === "served"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {stage}
                        </span>

                        <button
                          type="button"
                          onClick={() => advanceKdsStage(item.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#F07928] hover:text-white text-slate-700 border border-slate-200 shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Bump</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* KDS Footer Stats */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 text-emerald-700 font-mono font-semibold">
                  <Zap className="w-3.5 h-3.5" />
                  0.0s sync lag over LAN Wi-Fi
                </span>
                <span>Tap &ldquo;Bump&rdquo; to cycle: Pending &rarr; Preparing &rarr; Ready &rarr; Served</span>
              </div>
            </div>
          </TiltedCard>
        )}

        {/* TAB 3: AUTHENTIC 80MM ESC/POS THERMAL RECEIPT */}
        {activeTab === "receipt" && (
          <div className="flex flex-col items-center">
            {/* Receipt Control Bar */}
            <div className="w-full max-w-md mb-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => triggerOpenBillModal("standard")}
                className="flex items-center gap-2 text-xs font-mono text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-lg transition-colors"
                title="Open interactive 80mm bill templates modal"
              >
                <Printer className="w-4 h-4 text-orange-600" />
                <span>80mm Template (GST/Z-Report)</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerOpenBillModal("gst")}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200"
                >
                  GST Invoice
                </button>
                <Magnet padding={20} magnetStrength={3}>
                  <button
                    type="button"
                    onClick={triggerPrintReceipt}
                    className="px-3.5 py-1.5 rounded-lg bg-[#F07928] hover:bg-[#EA580C] text-white font-semibold text-xs active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isPrintingReceipt ? "Printing..." : "Simulate Print"}</span>
                  </button>
                </Magnet>
              </div>
            </div>

            {/* Physical Monospace Thermal Receipt Mockup with Spotlight */}
            <SpotlightCard
              spotlightColor="rgba(240, 121, 40, 0.15)"
              className={`w-full max-w-md receipt-paper rounded-lg p-6 sm:p-8 font-mono text-xs text-slate-900 select-all border border-slate-300 relative transition-all duration-300 shadow-xl ${
                isPrintingReceipt ? "translate-y-2 opacity-95 scale-[0.99]" : ""
              }`}
            >
                {/* Paper Tear Zig-Zag Top Indicator */}
                <div className="text-center font-bold pb-2 border-b-2 border-dashed border-zinc-400">
                  <p className="text-base font-extrabold tracking-wide uppercase">
                    {MOCK_ORDER.restaurant}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-600 mt-0.5">
                    IndentDev Hospitality Pvt Ltd
                  </p>
                  <p className="text-[11px] text-zinc-600">{MOCK_ORDER.address}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    GSTIN: {MOCK_ORDER.gstin} | FSSAI: {MOCK_ORDER.fssai}
                  </p>
                </div>

                {/* Bill Meta */}
                <div className="py-2.5 border-b border-dashed border-zinc-400 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Bill No: BILL-2026-0892</span>
                    <span>Order: {MOCK_ORDER.orderNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Table: {MOCK_ORDER.table}</span>
                    <span>Pax: {MOCK_ORDER.pax}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date: {MOCK_ORDER.date}</span>
                    <span>Cashier: {MOCK_ORDER.cashier}</span>
                  </div>
                </div>

                {/* Column Headers */}
                <div className="py-1.5 border-b-2 border-zinc-900 flex justify-between font-bold text-[11px]">
                  <span>QTY ITEM</span>
                  <span>AMOUNT (INR)</span>
                </div>

                {/* Line Items */}
                <div className="py-2 space-y-2 border-b border-dashed border-zinc-400 text-[11px]">
                  <div>
                    <div className="flex justify-between font-semibold">
                      <span>1 Truffle Mushroom Pizza</span>
                      <span>540.00</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-600 pl-3">
                      <span>+ Extra Mozzarella</span>
                      <span>60.00</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold">
                      <span>2 Artisanal Paneer Tikka</span>
                      <span>760.00</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold">
                      <span>2 Classic Cold Brew Latte</span>
                      <span>440.00</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-600 pl-3">
                      <span>+ Oat Milk Sub (x2)</span>
                      <span>80.00</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold">
                      <span>1 Belgian Choc Lava Cake</span>
                      <span>280.00</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-600 pl-3">
                      <span>+ Vanilla Bean Gelato</span>
                      <span>50.00</span>
                    </div>
                  </div>
                </div>

                {/* Tax Breakdown */}
                <div className="py-2 space-y-1 border-b border-dashed border-zinc-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>2,210.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST @ 2.5%:</span>
                    <span>55.25</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST @ 2.5%:</span>
                    <span>55.25</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge @ 5.0%:</span>
                    <span>110.50</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Round Off:</span>
                    <span>0.00</span>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="py-2 border-b-2 border-zinc-900 flex justify-between font-extrabold text-sm">
                  <span>GRAND TOTAL:</span>
                  <span>₹2,431.00</span>
                </div>

                {/* Payment Tender */}
                <div className="py-2 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
                  <p className="font-bold">PAYMENT DETAILS:</p>
                  <p>Mode: UPI Dynamic QR (Settled)</p>
                  <p>Txn ID: UPI/20261030/982144</p>
                  <p>24V Cash Drawer Pulse: Triggered (ESC p 0 25 250)</p>
                </div>

                {/* Loyalty & Footer */}
                <div className="pt-3 text-center text-[10px] space-y-1">
                  <p className="font-semibold">Thank you for dining with us!</p>
                  <div className="w-16 h-16 mx-auto my-2 border border-zinc-400 rounded flex items-center justify-center bg-zinc-100">
                    <QrCode className="w-12 h-12 text-zinc-800" />
                  </div>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
                    Scan for E-Invoice &amp; Review
                  </p>
                  <p className="text-[9px] text-zinc-500">
                    Powered by Order It Up (IndentDev)
                  </p>
                </div>
              </SpotlightCard>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

