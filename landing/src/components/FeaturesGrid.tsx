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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">
            Core POS Capabilities
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
              className="p-7 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300 shadow-xs flex flex-col justify-between group"
            >
              <div>
                {/* Header: Icon + Badge */}
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center group-hover:scale-105 group-hover:bg-orange-100 transition-all">
                    {getIcon(feature.icon)}
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
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
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-2">
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

