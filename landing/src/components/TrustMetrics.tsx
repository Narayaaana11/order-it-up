"use client";

import React from "react";
import { TRUST_METRICS } from "@/lib/constants";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import CountUp from "@/components/reactbits/CountUp";
import { ShieldCheck, Zap, Database } from "lucide-react";

export default function TrustMetrics() {
  const parseMetric = (val: string) => {
    if (val === "100%") {
      return { to: 100, suffix: "%", decimals: 0 };
    }
    if (val === "0.0s") {
      return { to: 0.0, suffix: "s", decimals: 1 };
    }
    if (val === "< 10ms") {
      return { to: 10, prefix: "< ", suffix: "ms", decimals: 0 };
    }
    if (val === "100+") {
      return { to: 100, suffix: "+", decimals: 0 };
    }
    return { to: 100, suffix: "", decimals: 0 };
  };

  const spotlights = [
    "rgba(16, 185, 129, 0.22)",
    "rgba(240, 121, 40, 0.22)",
    "rgba(14, 165, 233, 0.22)",
    "rgba(168, 85, 247, 0.22)",
  ];

  return (
    <section className="py-16 border-y border-slate-200 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Core Invariants Header - Crisp, clean, perfectly readable typography */}
        <div className="flex flex-col items-center justify-center text-center mb-10">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-3">
            Local Counter Performance Invariants
          </p>
          <div className="inline-flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-slate-800">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero Cloud Risk</span>
            </span>
            <span className="text-slate-300 font-black">•</span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-900 font-bold text-xs sm:text-sm shadow-xs">
              <Zap className="w-4 h-4 text-orange-600" />
              <span>Sub-Second Latency</span>
            </span>
            <span className="text-slate-300 font-black">•</span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-900 font-bold text-xs sm:text-sm shadow-xs">
              <Database className="w-4 h-4 text-sky-600" />
              <span>Local SQLite Reliability</span>
            </span>
          </div>
        </div>

        {/* 4 Spotlight Metric Cards with Animated CountUp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {TRUST_METRICS.map((metric, index) => {
            const parsed = parseMetric(metric.value);
            return (
              <SpotlightCard
                key={index}
                spotlightColor={spotlights[index % spotlights.length]}
                className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-orange-300 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex flex-col justify-between h-full">
                  <div>
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors tabular-nums flex items-baseline">
                      <CountUp
                        from={0}
                        to={parsed.to}
                        duration={2}
                        delay={0.1 * index}
                        decimals={parsed.decimals}
                        prefix={parsed.prefix || ""}
                        suffix={parsed.suffix || ""}
                      />
                    </span>
                    <span className="text-base font-bold text-slate-800 mt-2 block">
                      {metric.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed font-normal">
                    {metric.subtext}
                  </p>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
