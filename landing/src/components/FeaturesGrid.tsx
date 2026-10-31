"use client";

import React from "react";
import {
  ShoppingCart,
  Printer,
  ChefHat,
  LayoutGrid,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { CORE_FEATURES } from "@/lib/constants";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";

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

  const featureSpotlights = [
    "rgba(240, 121, 40, 0.16)",
    "rgba(14, 165, 233, 0.16)",
    "rgba(16, 185, 129, 0.16)",
    "rgba(168, 85, 247, 0.16)",
    "rgba(245, 158, 11, 0.16)",
    "rgba(239, 68, 68, 0.16)",
  ];

  return (
    <section id="features" className="py-20 lg:py-28 relative bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <ShinyText text="Core POS Capabilities" speed={4} />
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            <BlurText
              text="Built for High-Velocity Food & Beverage Operations"
              delay={40}
              className="justify-center"
            />
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Every feature is engineered for high peak throughput. Zero cloud spinners, zero network lag,
            and complete hardware integration from day one.
          </p>
        </div>

        {/* 6 Feature Cards Grid wrapped in React Bits SpotlightCards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {CORE_FEATURES.map((feature, index) => (
            <SpotlightCard
              key={feature.id}
              spotlightColor={featureSpotlights[index % featureSpotlights.length]}
              className="p-7 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 shadow-xs flex flex-col justify-between group"
            >
              <div>
                {/* Header: Icon + Badge */}
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center group-hover:scale-110 group-hover:bg-orange-100 transition-all">
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
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}
