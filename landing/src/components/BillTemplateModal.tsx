"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Printer,
  QrCode,
  CheckCircle2,
  ZoomIn,
  Maximize2,
} from "lucide-react";
import { MOCK_ORDER } from "@/lib/constants";

interface BillTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat?: "standard" | "gst" | "zreport" | "kot";
}

export default function BillTemplateModal({
  isOpen,
  onClose,
  initialFormat = "standard",
}: BillTemplateModalProps) {
  const [format, setFormat] = useState<"standard" | "gst" | "zreport" | "kot">(initialFormat);
  const [prevInitial, setPrevInitial] = useState(initialFormat);
  const [isPrinting, setIsPrinting] = useState(false);
  const [scaleMode, setScaleMode] = useState<"fit" | "full">("fit");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync format if initialFormat changes during render (standard React 19 pattern)
  if (initialFormat !== prevInitial) {
    setPrevInitial(initialFormat);
    setFormat(initialFormat);
  }

  // Reset scroll to top whenever modal opens or format changes
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen, format, scaleMode]);

  if (!isOpen) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      setIsPrinting(false);
      window.print();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[94vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-orange-200 shadow-xs">
              <Printer className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                Authentic 80mm ESC/POS Thermal Bill Template
              </h3>
              <p className="text-[11px] text-slate-600">
                Official Indian GST, FSSAI &amp; Monospace Solenoid Receipt Format
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrinting ? "Printing..." : "Print Bill"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Format Selector Bar & View Toggle */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setFormat("standard")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                format === "standard"
                  ? "bg-[#F07928] text-white shadow-xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
              }`}
            >
              Standard Dine-in (80mm)
            </button>
            <button
              type="button"
              onClick={() => setFormat("gst")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                format === "gst"
                  ? "bg-[#F07928] text-white shadow-xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
              }`}
            >
              GST Tax Invoice
            </button>
            <button
              type="button"
              onClick={() => setFormat("zreport")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                format === "zreport"
                  ? "bg-[#F07928] text-white shadow-xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
              }`}
            >
              Z-Report Cash Closure
            </button>
            <button
              type="button"
              onClick={() => setFormat("kot")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                format === "kot"
                  ? "bg-[#F07928] text-white shadow-xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
              }`}
            >
              Kitchen KOT Slip
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View Scale Toggle */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => setScaleMode("fit")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  scaleMode === "fit" ? "bg-orange-100 text-orange-800 font-bold" : "hover:text-slate-900"
                }`}
                title="Fit full receipt in window"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fit View</span>
              </button>
              <button
                type="button"
                onClick={() => setScaleMode("full")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  scaleMode === "full" ? "bg-orange-100 text-orange-800 font-bold" : "hover:text-slate-900"
                }`}
                title="100% full thermal scale"
              >
                <ZoomIn className="w-3 h-3" />
                <span>100% Scale</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-emerald-700 font-semibold hidden sm:flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ESC/POS Verified
            </span>
          </div>
        </div>

        {/* Scrollable Receipt Body with guaranteed top visibility & bottom margin */}
        <div
          ref={scrollContainerRef}
          className="p-4 sm:p-6 pb-20 overflow-y-auto bg-slate-100/90 flex flex-col items-center min-h-0"
        >
          <div
            className={`w-full max-w-md receipt-paper rounded-lg font-mono text-slate-900 select-all border border-slate-300 relative shadow-xl transition-all duration-300 ${
              scaleMode === "fit" ? "p-4 sm:p-6 text-[11px] origin-top scale-[0.94] sm:scale-100" : "p-6 sm:p-8 text-xs scale-100"
            } ${isPrinting ? "translate-y-1 scale-[0.98] opacity-95" : ""}`}
          >
            {/* Receipt Header - Guaranteed visible at the top */}
            <div className="text-center font-bold pb-2 border-b-2 border-dashed border-zinc-400">
              <p className="text-base font-extrabold tracking-wide uppercase">
                {MOCK_ORDER.restaurant}
              </p>
              <p className="text-[11px] font-medium text-zinc-600 mt-0.5">
                Authentic Bistro &amp; Cafe (Pilot Store)
              </p>
              <p className="text-[11px] text-zinc-600">{MOCK_ORDER.address}</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                GSTIN: {MOCK_ORDER.gstin} | FSSAI: {MOCK_ORDER.fssai}
              </p>
            </div>

            {format === "standard" && (
              <>
                {/* Meta */}
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

                {/* Line Items */}
                <div className="py-1.5 border-b-2 border-zinc-900 flex justify-between font-bold text-[11px]">
                  <span>QTY ITEM</span>
                  <span>AMOUNT (INR)</span>
                </div>

                <div className="py-2 space-y-2 border-b border-dashed border-zinc-400 text-[11px]">
                  <div>
                    <div className="flex justify-between font-semibold">
                      <span>1 Truffle Mushroom Pizza</span>
                      <span>540.00</span>
                    </div>
                    <div className="text-[10px] text-zinc-600 pl-2">+ Extra Mozzarella (60.00)</div>
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
                    <div className="text-[10px] text-zinc-600 pl-2">+ Oat Milk Sub (x2) (80.00)</div>
                  </div>
                  <div>
                    <div className="flex justify-between font-semibold">
                      <span>1 Belgian Choc Lava Cake</span>
                      <span>280.00</span>
                    </div>
                    <div className="text-[10px] text-zinc-600 pl-2">+ Vanilla Bean Gelato (50.00)</div>
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
              </>
            )}

            {format === "gst" && (
              <>
                <div className="py-2 border-b border-dashed border-zinc-400 text-center font-bold text-xs bg-zinc-50 my-1">
                  TAX INVOICE (RULE 46 OF CGST RULES)
                </div>
                <div className="py-2 border-b border-dashed border-zinc-400 text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span>Invoice No: INV-2026-0892</span>
                    <span>Date: 31-Oct-2026</span>
                  </div>
                  <div className="flex justify-between">
                    <span>State: Delhi (07)</span>
                    <span>Place of Supply: Delhi (07)</span>
                  </div>
                  <div>Customer GSTIN: 07BAPPT1234F1Z6 (Corporate Catering)</div>
                </div>

                <div className="py-2 border-b-2 border-zinc-900 text-[10px]">
                  <div className="flex justify-between font-bold border-b border-zinc-300 pb-1">
                    <span>HSN/SAC</span>
                    <span>TAXABLE</span>
                    <span>CGST</span>
                    <span>SGST</span>
                    <span>TOTAL</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>996331</span>
                    <span>2,210.00</span>
                    <span>55.25</span>
                    <span>55.25</span>
                    <span>2,320.50</span>
                  </div>
                </div>

                <div className="py-2 border-b-2 border-zinc-900 flex justify-between font-extrabold text-sm">
                  <span>TOTAL INVOICE VALUE:</span>
                  <span>₹2,431.00</span>
                </div>
              </>
            )}

            {format === "zreport" && (
              <>
                <div className="py-2 border-b border-dashed border-zinc-400 text-center font-bold text-xs bg-zinc-50 my-1">
                  Z-REPORT SHIFT CASH CLOSURE (TERMINAL #01)
                </div>
                <div className="py-2 border-b border-dashed border-zinc-400 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span>Shift Date: 31-Oct-2026</span>
                    <span>Closed: 23:45</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier: Rohit S.</span>
                    <span>Supervisor: Arjun V.</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opening Float:</span>
                    <span>₹2,000.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>Net Sales (48 Orders):</span>
                    <span>₹48,920.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Collected:</span>
                    <span>₹14,200.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>UPI / QR Collected:</span>
                    <span>₹28,420.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Card / POS Machine:</span>
                    <span>₹6,300.00</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-zinc-300 pt-1">
                    <span>Cash Discrepancy:</span>
                    <span>₹0.00 (Balanced)</span>
                  </div>
                </div>
              </>
            )}

            {format === "kot" && (
              <>
                <div className="py-2 border-b-2 border-zinc-900 text-center font-black text-sm bg-zinc-100 my-1">
                  KOT #104 — TABLE T-04 (DINE-IN)
                </div>
                <div className="py-1 text-[11px] flex justify-between border-b border-zinc-400">
                  <span>Time: 19:42:10</span>
                  <span>Captain: Priya K.</span>
                </div>
                <div className="py-2 space-y-2 text-xs font-bold border-b-2 border-zinc-900">
                  <div className="flex justify-between text-sm">
                    <span>1x Truffle Mushroom Pizza</span>
                    <span>OVEN</span>
                  </div>
                  <div className="text-[10px] font-normal pl-3 italic text-zinc-700">
                    * Extra Mozzarella, Well done crust
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>2x Artisanal Paneer Tikka</span>
                    <span>TANDOOR</span>
                  </div>
                  <div className="text-[10px] font-normal pl-3 italic text-zinc-700">
                    * Medium spicy, mint chutney
                  </div>
                </div>
              </>
            )}

            {/* Footer QR - Fully padded & guaranteed not clipped */}
            <div className="pt-3 text-center text-[10px] space-y-1">
              <p className="font-semibold">Thank you for dining with us!</p>
              <div className="w-16 h-16 mx-auto my-2 border border-zinc-400 rounded flex items-center justify-center bg-zinc-100">
                <QrCode className="w-12 h-12 text-zinc-800" />
              </div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
                Scan for E-Invoice &amp; Review
              </p>
              <p className="text-[9px] text-zinc-500">
                Powered by Order It Up POS
              </p>
            </div>
          </div>

          {/* Gentle scroll indicator if in full scale mode */}
          {scaleMode === "full" && (
            <div className="mt-3 text-center text-[11px] text-slate-500 font-sans">
              ↕ Scroll down to view full thermal receipt &amp; QR code
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
