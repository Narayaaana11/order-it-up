"use client";

import React from "react";
import { X, FileText, CheckCircle2 } from "lucide-react";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-orange-200 shadow-xs">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">MIT Open Source License</h3>
              <p className="text-xs text-slate-600">Free, Permissive &amp; Offline Forever</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] text-xs font-mono text-slate-700 space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <p className="font-bold text-slate-900">Copyright &copy; 2026 IndentDev / Order It Up</p>
            <p className="text-[11px] text-slate-600">
              Permission is hereby granted, free of charge, to any person obtaining a copy of this
              software and associated documentation files (the &quot;Software&quot;), to deal in the Software
              without restriction, including without limitation the rights to use, copy, modify, merge,
              publish, distribute, sublicense, and/or sell copies.
            </p>
          </div>

          <div className="space-y-2 text-slate-700 font-sans">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Core Principles Guarantees:
            </h4>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>100% Offline Durability:</strong> You own your data. Database files (`flo.db`) are saved locally on your hardware.
                </span>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Telemetry Lock-In:</strong> No compulsory cloud pings or account lockouts if your internet drops.
                </span>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Open Standard ESC/POS:</strong> Compatible with any standard thermal printer over USB, Serial, or LAN.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
