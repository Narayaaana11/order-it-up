'use client';

import React from "react";
import { TRUST_METRICS } from "@/lib/constants";
import AnimatedCounter from "./AnimatedCounter";

interface MetricCounterConfig {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const parseMetricValue = (valStr: string): MetricCounterConfig => {
  if (valStr === "100%") return { value: 100, suffix: "%", decimals: 0 };
  if (valStr === "0.0s") return { value: 0.0, suffix: "s", decimals: 1 };
  if (valStr.includes("< 10ms") || valStr === "< 10ms")
    return { value: 10, prefix: "< ", suffix: "ms", decimals: 0 };
  if (valStr === "100+") return { value: 100, suffix: "+", decimals: 0 };

  // Fallback regex parser
  const prefixMatch = valStr.match(/^([^\d.]+)/);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const suffixMatch = valStr.match(/([^\d.]+)$/);
  const suffix = suffixMatch ? suffixMatch[1] : "";
  const numMatch = valStr.match(/(\d+(\.\d+)?)/);
  const num = numMatch ? parseFloat(numMatch[1]) : 0;
  const decimals = numMatch && numMatch[2] ? numMatch[2].length - 1 : 0;

  return { value: num, prefix, suffix, decimals };
};

export default function TrustMetrics() {
  return (
    <section className="py-12 border-y border-slate-200 bg-white/80 backdrop-blur-sm relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {TRUST_METRICS.map((metric, index) => {
            const config = parseMetricValue(metric.value);
            return (
              <div
                key={index}
                className="relative p-6 rounded-2xl bg-white/90 border border-slate-200/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_3px_rgba(0,0,0,0.05)] hover:border-orange-300 hover:shadow-[0_15px_30px_-10px_rgba(240,121,40,0.15)] hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="flex flex-col">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors">
                    <AnimatedCounter
                      value={config.value}
                      prefix={config.prefix}
                      suffix={config.suffix}
                      decimals={config.decimals}
                      duration={1600}
                    />
                  </span>
                  <span className="text-base font-bold text-slate-800 mt-2">
                    {metric.label}
                  </span>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-normal">
                    {metric.subtext}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
