"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Printer,
  Sparkles,
  Receipt,
} from "lucide-react";
import { HARDWARE_SPECS } from "@/lib/constants";
import Squares from "@/components/reactbits/Squares";
import Magnet from "@/components/reactbits/Magnet";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";
import { triggerOpenBillModal } from "@/lib/modalEvents";

export default function CtaSection() {
  return (
    <section id="download" className="py-20 lg:py-28 relative overflow-hidden bg-white">
      {/* Background Interactive Squares Canvas */}
      <div className="absolute inset-0 z-0 opacity-35 pointer-events-none">
        <Squares
          direction="diagonal"
          speed={0.35}
          squareSize={48}
          borderColor="rgba(226, 232, 240, 0.7)"
          hoverFillColor="rgba(240, 121, 40, 0.12)"
          backgroundColor="transparent"
        />
      </div>

      {/* Background Radial Glow */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-orange-500/12 blur-[140px] rounded-full z-1"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main CTA Banner Box */}
        <div className="p-8 sm:p-12 lg:p-16 rounded-3xl bg-gradient-to-b from-orange-50/80 via-white to-white border border-orange-200 shadow-2xl text-center relative overflow-hidden backdrop-blur-xs">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <ShinyText text="Early-access pilot • feedback welcome" speed={3.5} />
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            <BlurText
              text="Help Shape the Next Generation of Restaurant Workflows"
              delay={40}
              className="justify-center"
            />
          </h2>

          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Order It Up is currently being evaluated with pilot users. Contact the pilot team to discuss your restaurant workflows, supported setup and the features available in the current build.
          </p>

          {/* Pilot enquiry and sample receipt preview */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="mailto:narayaaana11@gmail.com?subject=Order%20It%20Up%20Pilot%20Access"
              className="inline-flex h-16 items-center justify-center rounded-xl bg-[#F07928] px-8 text-sm font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:bg-[#EA580C] active:scale-[0.98]"
            >
              Request Pilot Access
            </a>
            <Magnet padding={35} magnetStrength={3}>
              <button
                type="button"
                onClick={() => triggerOpenBillModal("standard")}
                className="h-16 px-6 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 font-bold text-sm active:scale-[0.98] transition-all flex items-center gap-2.5 shadow-xs cursor-pointer"
              >
                <Receipt className="w-5 h-5 text-orange-600" />
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider text-orange-600 font-semibold">
                    Thermal Output
                  </div>
                  <div className="text-sm font-extrabold">80mm Bill Template</div>
                </div>
              </button>
            </Magnet>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            No public installer is available from this website yet. Pilot access is arranged individually.
          </p>

          {/* Reassurance Checklist */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Local-first desktop architecture
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Pilot terms shared before access
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-4 h-4 text-orange-600" />
              Data handling depends on enabled features
            </span>
          </div>
        </div>

        {/* Hardware Compatibility Section with SpotlightCards */}
        <div id="specs" className="mt-16 pt-16 border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono mb-3">
              <Printer className="w-3.5 h-3.5 text-orange-600" />
              <span>Hardware Compatibility Under Evaluation</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Check Your Hardware Before Joining the Pilot
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Compatibility varies by model, firmware, operating system and connection. Ask the pilot team to confirm your setup before relying on a device.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {HARDWARE_SPECS.map((spec, i) => (
              <SpotlightCard
                key={i}
                spotlightColor="rgba(240, 121, 40, 0.14)"
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between"
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
              </SpotlightCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
