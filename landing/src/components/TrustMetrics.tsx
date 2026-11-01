"use client";

import React from "react";
import { TRUST_METRICS } from "@/lib/constants";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { Database, Network, TestTube2, Workflow } from "lucide-react";

const ICONS = [Workflow, Database, Network, TestTube2];
const SPOTLIGHTS = [
  "rgba(16, 185, 129, 0.18)",
  "rgba(240, 121, 40, 0.18)",
  "rgba(14, 165, 233, 0.18)",
  "rgba(168, 85, 247, 0.18)",
];

export default function TrustMetrics() {
  return (
    <section className="py-16 border-y border-slate-200 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center mb-10">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-3">
            Product approach
          </p>
          <p className="max-w-2xl text-sm sm:text-base text-slate-600">
            Order It Up is an early-stage product. The capabilities below describe
            its intended architecture and current evaluation focus, not independent
            performance certifications.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {TRUST_METRICS.map((metric, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <SpotlightCard
                key={metric.label}
                spotlightColor={SPOTLIGHTS[index % SPOTLIGHTS.length]}
                className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-orange-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-600">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                    {metric.value}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-800 mt-4">
                  {metric.label}
                </h3>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  {metric.subtext}
                </p>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
