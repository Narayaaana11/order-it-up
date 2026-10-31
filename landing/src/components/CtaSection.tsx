"use client";

import React from "react";
import {
  Laptop,
  Apple,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Printer,
  Sparkles,
} from "lucide-react";
import { HARDWARE_SPECS } from "@/lib/constants";

export default function CtaSection() {
  return (
    <section id="download" className="py-20 lg:py-28 relative overflow-hidden">
      {/* Background Glow */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-orange-500/10 blur-[140px] rounded-full"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main CTA Banner Box */}
        <div className="p-8 sm:p-12 lg:p-16 rounded-3xl bg-gradient-to-b from-orange-50/70 via-white to-white border border-orange-200/80 shadow-xl text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready for Immediate Deployment</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Ready to Eliminate Restaurant POS Downtime Forever?
          </h2>

          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Download Order It Up today. Start billing in minutes on any Windows, macOS, or Linux
            counter terminal — 100% offline with zero cloud lock-in.
          </p>

          {/* Download Platforms Buttons Grid */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {/* Windows */}
            <a
              href="#download-windows"
              className="h-14 px-6 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-sm shadow-xl shadow-orange-500/25 active:scale-[0.98] transition-all flex items-center gap-3"
            >
              <Laptop className="w-5 h-5" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-orange-100">Download for</div>
                <div className="text-sm font-extrabold">Windows (x64 / ARM)</div>
              </div>
            </a>

            {/* macOS */}
            <a
              href="#download-mac"
              className="h-14 px-6 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm active:scale-[0.98] transition-all flex items-center gap-3 shadow-xs"
            >
              <Apple className="w-5 h-5 text-slate-700" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Download for</div>
                <div className="text-sm font-extrabold">macOS (Universal DMG)</div>
              </div>
            </a>

            {/* Linux */}
            <a
              href="#download-linux"
              className="h-14 px-6 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm active:scale-[0.98] transition-all flex items-center gap-3 shadow-xs"
            >
              <Terminal className="w-5 h-5 text-slate-700" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Download for</div>
                <div className="text-sm font-extrabold">Linux (.AppImage / .deb)</div>
              </div>
            </a>
          </div>

          {/* Reassurance Checklist */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Open-source MIT Core
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              No Credit Card or Subscription
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-orange-600" />
              Your Data Stays on Your Hardware
            </span>
          </div>
        </div>

        {/* Hardware Compatibility Section */}
        <div id="specs" className="mt-16 pt-16 border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono mb-2">
              <Printer className="w-3.5 h-3.5 text-orange-600" />
              <span>Plug-and-Play Hardware Specifications</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Runs on the Hardware You Already Own
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              No proprietary terminals or expensive locked hardware required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {HARDWARE_SPECS.map((spec, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 flex flex-col justify-between"
              >
                <div>
                  <h4 className="text-sm font-bold text-orange-600">{spec.category}</h4>
                  <p className="text-xs font-semibold text-slate-900 mt-1">{spec.supported}</p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    <span className="text-slate-400 font-mono">Ports: </span>
                    {spec.connectivity}
                  </p>
                </div>
                {spec.brands && (
                  <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                    Brands: {spec.brands}
                  </p>
                )}
                {spec.behavior && (
                  <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                    Mode: {spec.behavior}
                  </p>
                )}
                {spec.standards && (
                  <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                    Symbologies: {spec.standards}
                  </p>
                )}
                {spec.units && (
                  <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                    Units: {spec.units}
                  </p>
                )}
                {spec.runtime && (
                  <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                    Runtime: {spec.runtime}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
