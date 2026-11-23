"use client";

import React, { useRef } from "react";
import { Printer, X, Download, Copy, Check } from "lucide-react";

export interface ReceiptOrderLine {
  product_name: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  modifiers?: { name: string; price?: number; quantity?: number }[];
}

export interface ReceiptOrder {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  payment_status: string;
  grand_total: number;
  ordered_at: string;
  table_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  items?: ReceiptOrderLine[];
  payments?: { method: string; amount: number; reference?: string }[];
}

interface ThermalReceiptModalProps {
  order: ReceiptOrder;
  branchName?: string;
  currencySymbol?: string;
  onClose: () => void;
}

export function ThermalReceiptModal({
  order,
  branchName = "Connaught Place Flagship",
  currencySymbol = "₹",
  onClose,
}: ThermalReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  const subtotal = order.items?.reduce((acc, item) => {
    const itemBase = item.total_price ?? (item.unit_price ? item.unit_price * item.quantity : 0);
    return acc + itemBase;
  }, 0) || (order.grand_total ? order.grand_total / 1.05 : 0);

  const cgst = subtotal * 0.025;
  const sgst = subtotal * 0.025;
  const grandTotal = order.grand_total || (subtotal + cgst + sgst);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!receiptRef.current) return;
    const text = receiptRef.current.innerText;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(order.ordered_at || Date.now()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Print-only CSS styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-thermal-receipt, #printable-thermal-receipt * {
              visibility: visible;
            }
            #printable-thermal-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm !important;
              max-width: 80mm !important;
              padding: 4mm !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: black !important;
            }
          }
        `,
      }} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header Actions Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-orange-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              80mm Thermal Receipt Preview
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors cursor-pointer"
              title="Copy receipt plain text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Realistic ESC/POS Thermal Paper Canvas */}
        <div className="p-6 bg-slate-100 flex justify-center">
          <div
            id="printable-thermal-receipt"
            ref={receiptRef}
            className="w-full max-w-[340px] bg-white p-5 rounded-sm shadow-md border border-dashed border-slate-300 font-mono text-[11px] leading-relaxed text-slate-900 select-text"
          >
            {/* Restaurant Header */}
            <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
              <h1 className="text-base font-black tracking-tight uppercase">Order It Up</h1>
              <p className="text-[10px] text-slate-600 font-sans mt-0.5">{branchName}</p>
              <p className="text-[9px] text-slate-500 font-sans">GSTIN: 07AAAAA0000A1Z5 • FSSAI: 10019011000000</p>
              <p className="text-[9px] text-slate-500 font-sans">Phone: +91 98765 43210</p>
            </div>

            {/* Order Metadata */}
            <div className="space-y-0.5 border-b border-dashed border-slate-400 pb-2.5 mb-2.5 text-[10px]">
              <div className="flex justify-between">
                <span>INVOICE #:</span>
                <span className="font-bold">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>TYPE / TABLE:</span>
                <span className="font-bold uppercase">
                  {order.order_type} {order.table_number ? `• Table ${order.table_number}` : ""}
                </span>
              </div>
              {order.customer_name && (
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span>{order.customer_name}</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="border-b border-dashed border-slate-400 pb-3 mb-3">
              <div className="flex justify-between font-bold border-b border-slate-300 pb-1 mb-1.5 text-[10px]">
                <span className="w-1/2">ITEM</span>
                <span className="w-1/6 text-center">QTY</span>
                <span className="w-1/3 text-right">AMT</span>
              </div>

              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={idx} className="mb-1">
                    <div className="flex justify-between items-start">
                      <span className="w-1/2 font-semibold truncate pr-1">{item.product_name}</span>
                      <span className="w-1/6 text-center">{item.quantity}</span>
                      <span className="w-1/3 text-right">
                        {currencySymbol}
                        {Number(item.total_price ?? (item.unit_price ? item.unit_price * item.quantity : 0)).toFixed(2)}
                      </span>
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="pl-2 text-[9px] text-slate-600">
                        {item.modifiers.map((mod, mIdx) => (
                          <div key={mIdx}>+ {mod.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex justify-between items-start">
                  <span className="w-1/2 font-semibold">Standard Bill Order</span>
                  <span className="w-1/6 text-center">1</span>
                  <span className="w-1/3 text-right">{currencySymbol}{grandTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Financial Totals */}
            <div className="space-y-1 border-b border-dashed border-slate-400 pb-3 mb-3 text-[10px]">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST (2.5%):</span>
                <span>{currencySymbol}{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST (2.5%):</span>
                <span>{currencySymbol}{sgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-xs pt-1.5 border-t border-slate-400 text-slate-900">
                <span>GRAND TOTAL:</span>
                <span>{currencySymbol}{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payments Tendered */}
            <div className="space-y-0.5 border-b border-dashed border-slate-400 pb-2.5 mb-3 text-[10px]">
              <div className="font-bold text-[9px] uppercase tracking-wider text-slate-700 mb-1">
                Payments Received
              </div>
              {order.payments && order.payments.length > 0 ? (
                order.payments.map((p, pIdx) => (
                  <div key={pIdx} className="flex justify-between">
                    <span className="uppercase">{p.method} {p.reference ? `(${p.reference})` : ""}:</span>
                    <span>{currencySymbol}{Number(p.amount).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span className="uppercase">{order.payment_status === "paid" ? "PAID (FULL)" : "UNPAID"}:</span>
                  <span>{currencySymbol}{grandTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-1 space-y-1.5">
              <div className="inline-block px-3 py-1 bg-slate-900 text-white font-mono text-[9px] tracking-widest uppercase rounded-xs">
                *{order.order_number}*
              </div>
              <p className="text-[9px] text-slate-600 font-sans font-medium">
                Thank you for dining with us! Please visit again.
              </p>
              <p className="text-[8px] text-slate-400 font-sans">
                Powered by Order It Up • Offline-First Restaurant POS
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-[#F07928] hover:bg-[#EA580C] rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print 80mm Bill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
