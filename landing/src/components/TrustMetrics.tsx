import React from "react";
import { TRUST_METRICS } from "@/lib/constants";

export default function TrustMetrics() {
  return (
    <section className="py-12 border-y border-slate-200 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {TRUST_METRICS.map((metric, index) => (
            <div
              key={index}
              className="relative p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-orange-300 hover:shadow-md transition-all duration-300 group"
            >
              <div className="flex flex-col">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors tabular-nums">
                  {metric.value}
                </span>
                <span className="text-base font-bold text-slate-800 mt-2">
                  {metric.label}
                </span>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-normal">
                  {metric.subtext}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

