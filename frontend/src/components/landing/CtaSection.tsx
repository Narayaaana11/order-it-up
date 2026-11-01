"use client";

import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Printer,
  Sparkles,
  ArrowRight,
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
        {/* Main CTA Banner Box with Glassmorphism */}
        <div className="p-8 sm:p-12 lg:p-16 rounded-3xl bg-gradient-to-b from-orange-50/80 via-white/90 to-white/95 backdrop-blur-xl border border-orange-200/90 shadow-2xl shadow-orange-500/10 text-center relative overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Early-access pilot • request a product walkthrough</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Explore Order It Up with an Early-Access Pilot
          </h2>

          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Tell us about your restaurant, current POS and hardware. The pilot team will review your requirements and contact you about fit and next steps.
          </p>

          {/* SaaS Onboarding Action CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 max-w-xl mx-auto">
            {/* Primary SaaS Onboarding */}
            <Link
              href="https://orderitup.pages.dev/pilot/"
              className="h-14 px-8 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:via-amber-600 hover:to-orange-600 text-white font-bold text-base shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>Request Pilot Access</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

          </div>

          <p className="mt-5 text-xs text-slate-500">
            Pilot access is arranged individually. Submitting a request does not create an account or take payment.
          </p>

          {/* Reassurance Checklist */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Pilot build and hardware fit reviewed individually
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              No payment is taken with a pilot request
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-orange-600" />
              See privacy and data handling details before access
            </span>
          </div>
        </div>

        {/* Hardware Compatibility Section */}
        <div id="specs" className="mt-16 pt-16 border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono mb-2">
              <Printer className="w-3.5 h-3.5 text-orange-600" />
              <span>Hardware compatibility under evaluation</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Check Your Hardware Before Joining the Pilot
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Compatibility depends on the exact model, firmware, operating system and connection.
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
