"use client";

import React, { useState, useMemo } from "react";
import {
  Receipt,
  Printer,
  QrCode,
  CreditCard,
  Banknote,
  Split,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Plus,
  X,
  Zap,
} from "lucide-react";
import {
  useOrders,
  useActiveCashShift,
  useDrawerPulseHistory,
  useCatalog,
  useOutlets,
  useDashboardActions,
} from "@/lib/dashboard-store";
import type {
  PaymentMethodType,
  SplitSettlementDetails,
} from "@/lib/dashboard-models";
import { ESC_POS_DRAWER_KICK_HEX } from "@/lib/dashboard-models";

export function CashierView() {
  const orders = useOrders();
  const activeCashShift = useActiveCashShift();
  const pulseHistory = useDrawerPulseHistory();
  const catalog = useCatalog();
  const outlets = useOutlets();
  const actions = useDashboardActions();

  // Outlet Info
  const currentOutlet = outlets.find((o) => o.id === "outlet-1") || outlets[0];

  // Active Selected Order
  const [selectedOrderId, setSelectedOrderId] = useState<string>("ord-104");
  const [catalogCategory, setCatalogCategory] = useState<string>("All");

  // Tender Selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("split");

  // Cash Tender State
  const [cashTenderedInput, setCashTenderedInput] = useState<string>("2500");

  // Split Tender State
  const [splitCash, setSplitCash] = useState<string>("1000");
  const [splitUpi, setSplitUpi] = useState<string>("1027");
  const [splitCard, setSplitCard] = useState<string>("0");

  // Card reference & UPI simulation
  const [cardAuthRef, setCardAuthRef] = useState<string>("AUTH-88219");
  const [upiPaymentSimulated, setUpiPaymentSimulated] = useState<boolean>(true);

  // Solenoid Kick Pulse Visual Notification
  const [solenoidPulsing, setSolenoidPulsing] = useState<boolean>(false);
  const [pulseMessage, setPulseMessage] = useState<string | null>(null);

  // 80mm ESC/POS Thermal Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Settlement Success Banner
  const [lastSettledOrderNumber, setLastSettledOrderNumber] = useState<string | null>(null);

  // Find currently selected order
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0];
  }, [orders, selectedOrderId]);

  // Derived calculations for selected order
  const orderTotal = selectedOrder ? selectedOrder.total : 0;
  const orderSubtotal = selectedOrder ? selectedOrder.subtotal : 0;
  const orderCgst = selectedOrder ? selectedOrder.cgst : 0;
  const orderSgst = selectedOrder ? selectedOrder.sgst : 0;
  const orderRoundOff = selectedOrder ? selectedOrder.roundOff : 0;

  // Exact change calculation for Cash tender
  const cashTenderedVal = parseFloat(cashTenderedInput) || 0;
  const cashChangeReturn = Math.max(0, cashTenderedVal - orderTotal);

  // Split tender math
  const splitCashVal = parseFloat(splitCash) || 0;
  const splitUpiVal = parseFloat(splitUpi) || 0;
  const splitCardVal = parseFloat(splitCard) || 0;
  const splitSum = splitCashVal + splitUpiVal + splitCardVal;
  const splitRemaining = Math.round((orderTotal - splitSum) * 100) / 100;
  const isSplitBalanced = Math.abs(splitRemaining) < 0.01;

  // Filter categories
  const categories = ["All", "Pizzas", "Starters", "Mains", "Beverages", "Desserts"];
  const filteredCatalog = useMemo(() => {
    if (catalogCategory === "All") return catalog;
    return catalog.filter((c) => c.category === catalogCategory);
  }, [catalog, catalogCategory]);

  // Trigger Solenoid Drawer Pulse
  const triggerDrawerKick = (reason: string = "Manual Cash Drawer Kick") => {
    setSolenoidPulsing(true);
    setPulseMessage(`24V Solenoid Pulse Bytecode Sent: [${ESC_POS_DRAWER_KICK_HEX}] (${reason})`);
    setTimeout(() => {
      setSolenoidPulsing(false);
    }, 2400);
  };

  // Execute Order Settlement
  const handleSettlePayment = () => {
    if (!selectedOrder) return;
    if (selectedOrder.paymentStatus === "paid") {
      alert("This order is already settled and marked paid.");
      return;
    }

    if (paymentMethod === "split" && !isSplitBalanced) {
      alert(`Split tenders must sum to exactly ₹${orderTotal.toFixed(2)}. Remaining: ₹${splitRemaining.toFixed(2)}`);
      return;
    }

    let splitDetails: SplitSettlementDetails | undefined = undefined;

    if (paymentMethod === "cash") {
      splitDetails = {
        cash: orderTotal,
        changeGiven: cashChangeReturn,
        cashDrawerPulsed: true,
      };
      triggerDrawerKick("Cash Settlement Settle");
    } else if (paymentMethod === "upi") {
      splitDetails = {
        upi: orderTotal,
        upiTransactionRef: `UPI-${Date.now().toString().slice(-6)}`,
        cashDrawerPulsed: false,
      };
    } else if (paymentMethod === "card") {
      splitDetails = {
        card: orderTotal,
        cardAuthCode: cardAuthRef,
        cashDrawerPulsed: false,
      };
    } else if (paymentMethod === "split") {
      splitDetails = {
        cash: splitCashVal,
        upi: splitUpiVal,
        card: splitCardVal,
        changeGiven: 0,
        upiTransactionRef: splitUpiVal > 0 ? `UPI-${Date.now().toString().slice(-6)}` : undefined,
        cardAuthCode: splitCardVal > 0 ? cardAuthRef : undefined,
        cashDrawerPulsed: splitCashVal > 0,
      };
      if (splitCashVal > 0) {
        triggerDrawerKick(`Split Cash Tender Settle: ₹${splitCashVal}`);
      }
    }

    actions.settlePayment(selectedOrder.id, paymentMethod, splitDetails);
    setLastSettledOrderNumber(selectedOrder.orderNumber);
    setShowReceiptModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Solenoid Alert */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Counter POS :3001 Live
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold">
              Cashier: Rohit Singh (PIN: 1044)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Terminal: POS-01 • {currentOutlet.name}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#F07928]" />
            Front Counter Billing &amp; Multi-Tender Settlement
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            Live counter billing status, split tenders calculation (UPI Dynamic QR, Cash, Card), 24V solenoid cash drawer kick, and authentic 80mm ESC/POS thermal receipts.
          </p>
        </div>

        {/* Till Balance & Solenoid Drawer Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div className="text-slate-500 text-[11px] font-medium">Active Till Balance</div>
            <div className="text-sm font-black text-slate-900 font-mono">
              ₹{activeCashShift.expectedCashInDrawer.toLocaleString("en-IN")}.00
            </div>
          </div>

          <button
            type="button"
            onClick={() => triggerDrawerKick("Manual Till Opening")}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              solenoidPulsing
                ? "bg-emerald-600 text-white animate-pulse"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
            title="Sends 24V solenoid bytecode 0x1B, 0x70, 0x00, 0x19, 0xFA to kick cash drawer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{solenoidPulsing ? "Solenoid Fired!" : "Manual Drawer Kick"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReceiptModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#F07928] font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>80mm Thermal Receipt</span>
          </button>
        </div>
      </div>

      {/* Solenoid Pulse Feedback Toast */}
      {pulseMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-mono flex items-center justify-between border transition-all ${
            solenoidPulsing
              ? "bg-amber-50 border-amber-300 text-amber-900 shadow-md"
              : "bg-slate-50 border-slate-200 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F07928] animate-bounce" />
            <span className="font-bold">ESC/POS 24V Cash Drawer Pulse:</span>
            <span>{pulseMessage}</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400">Bytecode: 1B 70 00 19 FA</span>
        </div>
      )}

      {/* Settled Order Success Banner */}
      {lastSettledOrderNumber && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Order {lastSettledOrderNumber} settled successfully. Receipt ready for print.</span>
          </div>
          <button
            type="button"
            onClick={() => setLastSettledOrderNumber(null)}
            className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Orders & Item Catalog on Left, Split Tender & Till on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Order Queue & Bill Items */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Orders Horizontal Queue */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                Active Counter &amp; Dine-In Orders ({orders.length})
              </h3>
              <span className="text-xs text-slate-500 font-medium">Select order to tender bill</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {orders.map((ord) => {
                const isSelected = ord.id === selectedOrderId;
                const isPaid = ord.paymentStatus === "paid";
                return (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#F07928] bg-orange-50/60 shadow-xs ring-2 ring-orange-400/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{ord.orderNumber}</span>
                        {ord.tableName && (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {ord.tableName}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 line-clamp-1">
                      {ord.items.map((i) => `${i.productName} (x${i.quantity})`).join(", ")}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 capitalize">{ord.orderType.replace("_", " ")}</span>
                      <span className="font-mono font-black text-slate-900">₹{ord.total.toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Order Detailed Bill Breakdown */}
          {selectedOrder && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900">{selectedOrder.orderNumber}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      {selectedOrder.tableName || "Counter Takeaway"}
                    </span>
                    {selectedOrder.pax && (
                      <span className="text-xs text-slate-500 font-medium">{selectedOrder.pax} Guests</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Server: {selectedOrder.waiterName || "Counter"} • Created {new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Invoice Total</div>
                  <div className="text-2xl font-black text-[#F07928] font-mono">
                    ₹{selectedOrder.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-2">Item Description</th>
                      <th className="pb-2 text-center">Qty</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="text-[11px] text-slate-500">
                              + {item.modifiers.map((m) => `${m.name} (₹${m.price})`).join(", ")}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 font-mono">
                            SAC {item.hsnSac || "996331"} • {item.station} station
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-bold text-slate-900">{item.quantity}</td>
                        <td className="py-2.5 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{((item.unitPrice + (item.modifiers?.reduce((s, m) => s + m.price, 0) || 0)) * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Indian GST Breakdown Card (SAC 996331) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Net Taxable Value (Subtotal)</span>
                  <span className="font-mono">₹{orderSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span>CGST @ 2.5%</span>
                    <span className="text-[10px] text-slate-400 font-mono">(SAC 996331)</span>
                  </span>
                  <span className="font-mono">₹{orderCgst.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span>SGST @ 2.5%</span>
                    <span className="text-[10px] text-slate-400 font-mono">(SAC 996331)</span>
                  </span>
                  <span className="font-mono">₹{orderSgst.toFixed(2)}</span>
                </div>
                {orderRoundOff !== 0 && (
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Round Off</span>
                    <span className="font-mono">{orderRoundOff > 0 ? `+₹${orderRoundOff.toFixed(2)}` : `-₹${Math.abs(orderRoundOff).toFixed(2)}`}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-black text-sm text-slate-900">
                  <span>Gross Invoice Total (5.0% GST Inc.)</span>
                  <span className="font-mono text-[#F07928] text-base">₹{orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Speed Catalog Quick Add Bar */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-orange-600" />
                    Quick Add Add-on to Current Bill:
                  </span>
                  <div className="flex gap-1 overflow-x-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCatalogCategory(cat)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                          catalogCategory === cat
                            ? "bg-[#F07928] text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {filteredCatalog.slice(0, 4).map((dish) => (
                    <div
                      key={dish.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-orange-300 transition-colors text-left text-xs space-y-1"
                    >
                      <div className="font-bold text-slate-900 truncate" title={dish.name}>
                        {dish.name}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-600 font-bold">₹{dish.basePrice}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[9px] font-bold text-slate-500 capitalize">
                          {dish.station}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Multi-Tender Settlement & 24V Till Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Settlement Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                Settle Payment
              </h3>
              <p className="text-xs text-slate-500">
                Choose single or split tender to settle and close order.
              </p>
            </div>

            {/* Total Display */}
            <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/80 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-800">Total Payable</div>
                <div className="text-xs text-orange-700">Including 5% GST (SAC 996331)</div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#F07928] font-mono">
                ₹{orderTotal.toFixed(2)}
              </div>
            </div>

            {/* Tender Selection Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/70 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaymentMethod("split")}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  paymentMethod === "split"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Split className="w-4 h-4 text-orange-600" />
                <span className="text-[11px]">Split</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  paymentMethod === "upi"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <QrCode className="w-4 h-4 text-blue-600" />
                <span className="text-[11px]">UPI QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  paymentMethod === "cash"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px]">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  paymentMethod === "card"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span className="text-[11px]">Card</span>
              </button>
            </div>

            {/* TAB 1: SPLIT TENDERS */}
            {paymentMethod === "split" && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                <div className="text-xs text-slate-600 font-medium">
                  Allocate payment amounts across Cash, UPI, and Card:
                </div>

                <div className="space-y-3">
                  {/* Split Cash Input */}
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cash (Till):</span>
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {/* Split UPI Input */}
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-blue-600" />
                      <span>UPI QR:</span>
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={splitUpi}
                        onChange={(e) => setSplitUpi(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {/* Split Card Input */}
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                      <span>Card Swipe:</span>
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={splitCard}
                        onChange={(e) => setSplitCard(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Split Remaining Calculator Indicator */}
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-center justify-between font-mono ${
                    isSplitBalanced
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-amber-50 border-amber-300 text-amber-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isSplitBalanced ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>
                      {isSplitBalanced ? "Balanced Exactly (100% Covered)" : "Remaining Unallocated Balance:"}
                    </span>
                  </div>
                  <span className="font-bold font-mono">
                    ₹{Math.abs(splitRemaining).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: UPI DYNAMIC QR */}
            {paymentMethod === "upi" && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-blue-600" />
                    BharatPe / NPCI Dynamic UPI QR
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    Active • Expires in 04:30
                  </span>
                </div>

                {/* Simulated QR Code Canvas Graphic */}
                <div className="mx-auto w-40 h-40 bg-white p-2 rounded-2xl border-2 border-slate-300 shadow-inner flex flex-col items-center justify-center relative">
                  <div className="w-32 h-32 bg-slate-900 p-2 rounded-xl flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-7 h-7 bg-white rounded-xs p-1">
                        <div className="w-full h-full bg-slate-900" />
                      </div>
                      <div className="w-7 h-7 bg-white rounded-xs p-1">
                        <div className="w-full h-full bg-slate-900" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center text-[10px] text-white font-mono font-bold tracking-widest">
                      UPI PAY
                    </div>
                    <div className="flex justify-between">
                      <div className="w-7 h-7 bg-white rounded-xs p-1">
                        <div className="w-full h-full bg-slate-900" />
                      </div>
                      <div className="w-4 h-4 bg-emerald-400 rounded-full animate-ping" />
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="px-2 py-0.5 rounded-md bg-[#F07928] text-white text-[9px] font-black shadow-xs">
                      ₹{orderTotal.toFixed(0)}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500 break-all px-2">
                  upi://pay?pa=spiceroute@icici&amp;pn=Downtown%20Bistro&amp;am={orderTotal.toFixed(2)}&amp;cu=INR
                </div>

                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUpiPaymentSimulated(!upiPaymentSimulated)}
                    className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{upiPaymentSimulated ? "Simulate New Scan" : "Customer Scanned (Verified)"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: CASH & 24V SOLENOID TILL */}
            {paymentMethod === "cash" && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Cash Tendered by Customer:</span>
                    <span className="text-[11px] text-slate-500 font-mono">Bill: ₹{orderTotal.toFixed(2)}</span>
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={cashTenderedInput}
                      onChange={(e) => setCashTenderedInput(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 rounded-2xl bg-slate-50 border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* Quick Cash Presets */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[orderTotal, 500, 1000, 2000, 2500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTenderedInput(amt.toString())}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold cursor-pointer"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change Due Card */}
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Change Due</div>
                    <div className="text-xs text-emerald-700 font-medium">Return to diner immediately</div>
                  </div>
                  <div className="text-2xl font-black text-emerald-800 font-mono">
                    ₹{cashChangeReturn.toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Settling in Cash will send <strong>0x1B, 0x70, 0x00, 0x19, 0xFA</strong> to kick the 24V solenoid cash drawer.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 4: CARD POS */}
            {paymentMethod === "card" && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">
                    EDC Card Machine Approval Code / RRN:
                  </label>
                  <input
                    type="text"
                    value={cardAuthRef}
                    onChange={(e) => setCardAuthRef(e.target.value)}
                    placeholder="e.g. AUTH-88219"
                    className="w-full px-4 py-2 rounded-2xl bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Supports Visa, Mastercard, RuPay card debit/credit swipe transactions.
                  </p>
                </div>
              </div>
            )}

            {/* Final Action Button: Settle Bill */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSettlePayment}
                disabled={selectedOrder?.paymentStatus === "paid" || (paymentMethod === "split" && !isSplitBalanced)}
                className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                  selectedOrder?.paymentStatus === "paid"
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : paymentMethod === "split" && !isSplitBalanced
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-[#F07928] hover:bg-[#EA580C] text-white shadow-orange-500/20 hover:shadow-md"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {selectedOrder?.paymentStatus === "paid"
                    ? "Order Already Settled & Paid"
                    : `Settle ₹${orderTotal.toFixed(2)} & Kick Drawer`}
                </span>
              </button>
            </div>
          </div>

          {/* Drawer Reconciliation & Hardware Solenoid Status */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                24V Till &amp; Shift Reconciliation
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Bytecode: {ESC_POS_DRAWER_KICK_HEX}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500 text-[11px]">Opening Float</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  ₹{activeCashShift.openingFloat.toLocaleString("en-IN")}.00
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500 text-[11px]">Gross Cash Sales</div>
                <div className="text-sm font-bold text-emerald-700 font-mono">
                  +₹{activeCashShift.grossCashSales.toLocaleString("en-IN")}.00
                </div>
              </div>
            </div>

            {/* Recent Drawer Pulse History Feed */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Recent Solenoid Kick Logs ({pulseHistory.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {pulseHistory.slice(0, 4).map((pulse) => (
                  <div
                    key={pulse.id}
                    className="p-2 rounded-xl bg-slate-50 text-[10px] flex items-center justify-between border border-slate-100"
                  >
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span className="font-bold text-slate-800">{pulse.orderId || "Manual"}</span>
                      <span className="text-slate-500 truncate max-w-[130px]">{pulse.reason}</span>
                    </div>
                    <span className="font-mono text-slate-400">
                      {new Date(pulse.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AUTHENTIC 80MM ESC/POS THERMAL RECEIPT MODAL PREVIEW                      */}
      {/* ========================================================================= */}
      {showReceiptModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-black text-slate-900">80mm ESC/POS Thermal Receipt Preview</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Paper Monospaced Layout (Simulates Real ESC/POS Printout) */}
            <div className="p-6 overflow-y-auto bg-white font-mono text-[11px] text-slate-900 leading-tight space-y-3">
              {/* Restaurant Header */}
              <div className="text-center space-y-1">
                <div className="font-black text-base tracking-wider uppercase">
                  {currentOutlet.name || "Downtown Bistro"}
                </div>
                <div>{currentOutlet.location || "Connaught Place, New Delhi"}</div>
                <div>Ph: +91 11 4321 0000 • Connaught Place</div>
                <div className="pt-1 text-[10px] text-slate-600">
                  GSTIN: {currentOutlet.gstin || "07AAAAA0000A1Z5"}
                </div>
                <div className="text-[10px] text-slate-600">
                  FSSAI Lic No: {currentOutlet.fssaiNumber || "10019011000234"}
                </div>
                <div className="text-[10px] font-bold text-slate-800 uppercase pt-1">
                  TAX INVOICE (Rule 46 CGST Rules) • SAC 996331
                </div>
              </div>

              {/* Dashed Line */}
              <div className="border-t border-dashed border-slate-400 my-2" />

              {/* Metadata */}
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Bill No: {selectedOrder.orderNumber}</span>
                  <span>Table: {selectedOrder.tableName || "Counter"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date: {new Date().toISOString().split("T")[0]}</span>
                  <span>Time: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier: Rohit Singh</span>
                  <span>Terminal: POS-01</span>
                </div>
              </div>

              {/* Dashed Line */}
              <div className="border-t border-dashed border-slate-400 my-2" />

              {/* Items Table */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-bold text-[10px] uppercase">
                  <span className="w-36">Item</span>
                  <span className="w-8 text-center">Qty</span>
                  <span className="w-12 text-right">Rate</span>
                  <span className="w-14 text-right">Amt</span>
                </div>
                <div className="border-t border-slate-300" />
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="w-36 truncate">{item.productName}</span>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <span className="w-12 text-right">{item.unitPrice.toFixed(0)}</span>
                      <span className="w-14 text-right font-bold">
                        {(item.unitPrice * item.quantity).toFixed(0)}
                      </span>
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-[9px] text-slate-500 pl-2">
                        {item.modifiers.map((m) => `+ ${m.name}`).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Dashed Line */}
              <div className="border-t border-dashed border-slate-400 my-2" />

              {/* Tax & Total */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal (Net Taxable):</span>
                  <span>₹{orderSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST @ 2.5% (SAC 996331):</span>
                  <span>₹{orderCgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST @ 2.5% (SAC 996331):</span>
                  <span>₹{orderSgst.toFixed(2)}</span>
                </div>
                {orderRoundOff !== 0 && (
                  <div className="flex justify-between">
                    <span>Round Off:</span>
                    <span>{orderRoundOff > 0 ? `+₹${orderRoundOff.toFixed(2)}` : `-₹${Math.abs(orderRoundOff).toFixed(2)}`}</span>
                  </div>
                )}
                <div className="border-t border-slate-400 pt-1 flex justify-between font-black text-xs">
                  <span>NET TOTAL PAYABLE:</span>
                  <span>₹{orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Dashed Line */}
              <div className="border-t border-dashed border-slate-400 my-2" />

              {/* Payment Details */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="uppercase font-bold">{selectedOrder.settlement?.method || paymentMethod}</span>
                </div>
                {paymentMethod === "split" ? (
                  <div className="text-[9px] text-slate-600 pl-2 space-y-0.5">
                    {splitCashVal > 0 && <div>• Cash Tender: ₹{splitCashVal.toFixed(2)} (Drawer Kick Pulse)</div>}
                    {splitUpiVal > 0 && <div>• UPI Dynamic QR: ₹{splitUpiVal.toFixed(2)}</div>}
                    {splitCardVal > 0 && <div>• Card Swipe: ₹{splitCardVal.toFixed(2)}</div>}
                  </div>
                ) : paymentMethod === "cash" ? (
                  <div className="flex justify-between">
                    <span>Change Returned:</span>
                    <span>₹{cashChangeReturn.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>

              {/* Simulated 80mm Barcode Graphic */}
              <div className="pt-2 text-center space-y-1">
                <div className="h-9 w-full flex items-center justify-center gap-0.5 px-6">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full ${
                        i % 3 === 0 ? "w-1 bg-slate-900" : i % 2 === 0 ? "w-0.5 bg-slate-900" : "w-0.5 bg-transparent"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-[9px] text-slate-500 tracking-widest">{selectedOrder.id}-996331-GST</div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2 text-[10px] space-y-0.5 text-slate-600">
                <div>*** THANK YOU FOR DINING WITH US! ***</div>
                <div>GST Composition / Non-Composition: Regular</div>
                <div className="text-[9px] text-slate-400">Powered by Order It Up Offline POS</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerDrawerKick("Thermal Receipt Print");
                  alert("Printing 80mm ESC/POS thermal receipt to default LAN printer (:9100 / USB)...");
                }}
                className="px-4 py-2 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Send to 80mm ESC/POS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CashierView;
