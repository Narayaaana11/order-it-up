import React from "react";
import {
  ShoppingCart,
  Printer,
  ChefHat,
  LayoutGrid,
  Sliders,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { CORE_FEATURES } from "@/lib/constants";
import ShimmerBadge from "./ShimmerBadge";

export default function FeaturesGrid() {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "ShoppingCart":
        return <ShoppingCart className="w-6 h-6 text-orange-600" />;
      case "Printer":
        return <Printer className="w-6 h-6 text-orange-600" />;
      case "ChefHat":
        return <ChefHat className="w-6 h-6 text-orange-600" />;
      case "LayoutGrid":
        return <LayoutGrid className="w-6 h-6 text-orange-600" />;
      case "Sliders":
        return <Sliders className="w-6 h-6 text-orange-600" />;
      case "ShieldCheck":
        return <ShieldCheck className="w-6 h-6 text-orange-600" />;
      default:
        return <ShoppingCart className="w-6 h-6 text-orange-600" />;
    }
  };

  return (
    <section id="features" className="py-20 lg:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="flex justify-center mb-3">
            <ShimmerBadge className="uppercase tracking-widest text-xs font-bold px-3 py-1 text-orange-600">
              Core POS Capabilities
            </ShimmerBadge>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Built for High-Velocity Food &amp; Beverage Operations
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Every feature is engineered for high peak throughput. Zero cloud spinners, zero network lag,
            and complete hardware integration from day one.
          </p>
        </div>

        {/* 6 Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {CORE_FEATURES.map((feature) => (
            <div
              key={feature.id}
              className="p-7 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_3px_rgba(0,0,0,0.04)] hover:border-orange-400/60 hover:shadow-[0_20px_35px_-10px_rgba(240,121,40,0.14),0_1px_3px_0_rgba(0,0,0,0.05)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Subtle radial inner glow on hover */}
              <div
                className="pointer-events-none absolute -right-12 -top-12 w-36 h-36 bg-orange-400/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                aria-hidden="true"
              />

              <div className="relative z-10">
                {/* Header: Icon + Badge */}
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-orange-50/90 border border-orange-200/80 flex items-center justify-center group-hover:scale-105 group-hover:bg-orange-100 group-hover:border-orange-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all duration-300">
                    {getIcon(feature.icon)}
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100/90 backdrop-blur-xs text-slate-700 border border-slate-200/80">
                    {feature.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed font-normal">
                  {feature.description}
                </p>
              </div>

              {/* Highlights List */}
              <div className="mt-6 pt-5 border-t border-slate-100/80 flex flex-col gap-2 relative z-10">
                {feature.highlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
