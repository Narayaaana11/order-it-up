"use client";

import React from "react";
import {
  Download,
  Play,
  WifiOff,
  Printer,
  Zap,
  Network,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Flame,
} from "lucide-react";
import { BRAND } from "@/lib/constants";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
      {/* Ambient Radial Orange Lighting */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] sm:w-[900px] sm:h-[450px] bg-orange-500/10 blur-[140px] rounded-full"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs sm:text-sm font-semibold text-orange-700 shadow-xs mb-6 animate-pulse-subtle">
            <Zap className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />
            <span>{BRAND.eyebrow}</span>
          </div>

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
            Run sub-second counter billing offline with instant ESC/POS thermal printing,
            orchestrate live kitchen screens over your local LAN, and eliminate cloud dependency
            risks forever.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            {/* Primary Download CTA */}
            <a
              href="#download"
              className="h-14 px-8 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-base shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <Download className="w-5 h-5" />
              <span>Download Desktop POS</span>
            </a>

            {/* Secondary Interactive Demo CTA */}
            <a
              href="#ui-preview"
              className="h-14 px-7 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-xs"
            >
              <Play className="w-4 h-4 text-orange-600 fill-orange-500" />
              <span>Explore Interactive Demo</span>
            </a>
          </div>

          {/* Sub-CTA Reassurance Note */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Free for single counters
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Zero cloud lock-in
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-orange-600" />
              Windows, macOS & Linux
            </span>
          </div>

          {/* Core Trust Badges 4-Grid */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Zero Cloud Lock-In</p>
                <p className="text-[11px] text-slate-500">SQLite WAL on disk</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">&lt; 10ms Transaction</p>
                <p className="text-[11px] text-slate-500">Sub-second cart speed</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-200">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">24V Solenoid Drawer</p>
                <p className="text-[11px] text-slate-500">Direct ESC/POS bytecode</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all text-left">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Local LAN Mesh</p>
                <p className="text-[11px] text-slate-500">KDS :3002 & Waiter :3003</p>
              </div>
            </div>
          </div>

          {/* Desktop Application Window Mockup Chrome */}
          <div className="mt-14 w-full max-w-5xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden text-left">
            {/* Title Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100/90 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                <span className="ml-3 text-xs font-mono text-slate-600 hidden sm:inline">
                  Order It Up POS Desktop — v1.2.0 • SQLite Connected (flo.db)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Local Engine :3001
                </span>
              </div>
            </div>

            {/* Teaser Content inside Mock Window */}
            <div className="p-4 sm:p-6 bg-slate-50/70 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Active Dining Tables</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">14 / 18</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Avg Turn: 34 mins</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
                  <Flame className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">KDS Active Tickets</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">6 In-Flight</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Avg Prep SLA: 7m 40s</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                  <Zap className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Hardware Status</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">80mm Thermal</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">USB & DK Solenoid Ready</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                  <Printer className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

