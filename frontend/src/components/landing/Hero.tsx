"use client";

import React from "react";
import Link from "next/link";
import {
  Play,
  WifiOff,
  Printer,
  Zap,
  Network,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Flame,
  ArrowRight,
  LogIn,
} from "lucide-react";
import { BRAND } from "@/lib/constants";
import ShimmerBadge from "./ShimmerBadge";
import AmbientBackground from "./AmbientBackground";

export default function Hero() {
  return (
    <AmbientBackground className="pt-12 pb-16 lg:pt-20 lg:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow Shimmer Badge */}
          <ShimmerBadge
            icon={<Zap className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />}
            className="mb-6 shadow-xs hover:shadow-md"
          >
            <span>{BRAND.eyebrow}</span>
          </ShimmerBadge>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 max-w-5xl leading-[1.12]">
            The{" "}
            <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 bg-clip-text text-transparent">
              Offline-First Operating System
            </span>{" "}
            for Modern Restaurants
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-lg sm:text-xl lg:text-2xl text-slate-600 max-w-3xl leading-relaxed font-normal">
            Explore an offline-first approach to restaurant billing, local kitchen workflows and thermal printing. Order It Up is being evaluated with pilot users; features and hardware compatibility vary by build.
          </p>

          {/* SaaS & Desktop Action CTAs with tactile transitions */}
          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 w-full sm:w-auto">
            {/* Primary SaaS Registration CTA */}
            <Link
              href="https://orderitup.pages.dev/pilot/"
              className="h-14 px-8 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:via-amber-600 hover:to-orange-600 text-white font-bold text-base shadow-[0_4px_16px_0_rgba(240,121,40,0.38)] hover:shadow-lg hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>Request Pilot Access</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            {/* Secondary SaaS Login CTA */}
            <Link
              href="/auth/login"
              className="h-14 px-6 rounded-xl bg-white/95 backdrop-blur-sm hover:bg-white text-slate-800 border border-slate-300/90 hover:border-orange-400 font-semibold text-base shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-orange-600" />
              <span>Owner / Staff Login</span>
            </Link>

            {/* Harmonized Desktop POS Download CTA */}
            <a
              href="#ui-preview"
              className="h-14 px-6 rounded-xl bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border border-slate-300/80 font-semibold text-base shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Play className="w-4 h-4 text-orange-600" />
              <span>Interactive POS Preview</span>
            </a>
          </div>

          {/* Interactive Role Demo Link */}
          <div className="mt-3.5 flex items-center justify-center">
            <a
              href="#ui-preview"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline underline-offset-4 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-orange-500" />
              <span>Or explore interactive role dashboards demo</span>
            </a>
          </div>

          {/* Sub-CTA Reassurance Note */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Pilot access arranged individually
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Zero cloud lock-in
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-orange-600" />
              Hardware compatibility reviewed during pilot
            </span>
          </div>

          {/* Core Trust Badges 4-Grid with glassmorphism */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/85 backdrop-blur-md border border-slate-200/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.03)] hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Zero Cloud Lock-In</p>
                <p className="text-[11px] text-slate-500">SQLite WAL on disk</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/85 backdrop-blur-md border border-slate-200/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.03)] hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Performance under evaluation</p>
                <p className="text-[11px] text-slate-500">No public benchmark published</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/85 backdrop-blur-md border border-slate-200/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.03)] hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 shadow-xs">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Cash drawer evaluation</p>
                <p className="text-[11px] text-slate-500">Confirm model compatibility first</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/85 backdrop-blur-md border border-slate-200/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.03)] hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 shadow-xs">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Local network preview</p>
                <p className="text-[11px] text-slate-500">Illustrative workflow only</p>
              </div>
            </div>
          </div>

          {/* Illustrative sample interface — not a live product connection */}
          <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-900">Illustrative interface preview only. It is not connected to a live restaurant, POS device, KDS or printer. All counts and statuses are examples.</p>
          {/* Desktop Application Window Mockup Chrome with Glassmorphism */}
          <div className="mt-14 w-full max-w-5xl rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-2xl shadow-slate-900/10 overflow-hidden text-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
            {/* Title Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100/90 backdrop-blur-sm border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                <span className="ml-3 text-xs font-mono text-slate-600 hidden sm:inline">
                  Order It Up POS Desktop — v1.2.0 • Illustrative preview — not connected to a live POS
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sample interface
                </span>
              </div>
            </div>

            {/* Teaser Content inside Mock Window */}
            <div className="p-4 sm:p-6 bg-slate-50/60 backdrop-blur-xs grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.04)] hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Sample table view</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">Illustrative</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Not connected to live data</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-50 text-orange-600 shadow-xs">
                  <Flame className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.04)] hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Sample KDS view</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">Illustrative</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">No live ticket data</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600 shadow-xs">
                  <Zap className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.04)] hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Hardware preview</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">Model under evaluation</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Compatibility not confirmed</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 shadow-xs">
                  <Printer className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AmbientBackground>
  );
}
