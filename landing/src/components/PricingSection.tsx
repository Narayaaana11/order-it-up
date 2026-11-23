"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  Zap,
} from "lucide-react";
import { PRICING_PLANS } from "@/lib/constants";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";
import { triggerOpenAuthModal } from "@/lib/modalEvents";

export default function PricingSection() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const handleCtaClick = (planId: string) => {
    if (planId === "enterprise") {
      router.push("/request-access?plan=enterprise");
    } else {
      triggerOpenAuthModal("signup");
    }
  };

  return (
    <section id="pricing" className="py-20 lg:py-28 relative bg-white border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <ShinyText text="Transparent SaaS & Commercial Plans" speed={4} />
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            <BlurText
              text="Simple, Predictable Restaurant Pricing"
              delay={40}
              className="justify-center"
            />
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            No hidden transaction fees or surprise lock-ins. All plans include full offline-first resilience so your restaurant keeps serving even when the internet goes down.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-slate-100 border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                billingCycle === "yearly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Annual Billing
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full tracking-wide">
                SAVE 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {PRICING_PLANS.map((plan) => {
            const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
            const periodLabel = billingCycle === "yearly" ? "year" : "month";
            const effectiveMonthly = billingCycle === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl transition-all duration-300 ${
                  plan.popular
                    ? "ring-2 ring-orange-500 shadow-2xl md:-translate-y-2 bg-gradient-to-b from-orange-50/40 via-white to-white"
                    : "border border-slate-200/90 shadow-sm hover:shadow-md bg-white"
                }`}
              >
                {/* Popular Ribbon */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[11px] font-extrabold rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5">
                    <Zap className="w-3 h-3 fill-white" />
                    Most Popular
                  </div>
                )}

                <div className="p-7 sm:p-8 flex-1 flex flex-col">
                  {/* Plan Badge & Title */}
                  <div className="mb-4">
                    <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                      {plan.badge}
                    </span>
                    <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{plan.name}</h3>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-slate-600 min-h-[44px] leading-relaxed font-normal">
                    {plan.description}
                  </p>

                  {/* Price Tag */}
                  <div className="mt-6 mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                        ₹{price.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs sm:text-sm text-slate-500 font-medium">
                        /{periodLabel}
                      </span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                        Equivalent to ₹{effectiveMonthly.toLocaleString("en-IN")}/mo billed annually
                      </p>
                    )}
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 text-xs sm:text-sm flex-1 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        {feature.included ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? "text-slate-800 font-medium" : "text-slate-400 line-through"}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() => handleCtaClick(plan.id)}
                    className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      plan.popular
                        ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-orange-500/25 hover:shadow-orange-500/40"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Offline Commercial License Key Banner */}
        <div className="mt-16 rounded-3xl bg-slate-900 text-white p-7 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">
                <KeyRound className="w-3.5 h-3.5" />
                Air-Gapped & Offline Commercial Licensing
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                Operating high-security or air-gapped restaurants?
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                Order It Up features cryptographic asymmetric <strong>Ed25519</strong> digital license tokens (<code className="text-orange-300 font-mono text-xs">OIU2.*</code>). Activate unlimited terminals locally without connecting to the public internet or external cloud services.
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              <Link
                href="/request-access?type=airgapped"
                className="px-6 py-3 rounded-2xl bg-white text-slate-900 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Request Air-Gapped Key
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
