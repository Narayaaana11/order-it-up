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
  Receipt,
} from "lucide-react";
import { BRAND } from "@/lib/constants";
import Squares from "@/components/reactbits/Squares";
import Particles from "@/components/reactbits/Particles";
import ShinyText from "@/components/reactbits/ShinyText";
import BlurText from "@/components/reactbits/BlurText";
import RotatingText from "@/components/reactbits/RotatingText";
import StarBorder from "@/components/reactbits/StarBorder";
import Magnet from "@/components/reactbits/Magnet";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import TiltedCard from "@/components/reactbits/TiltedCard";
import DecryptedText from "@/components/reactbits/DecryptedText";
import { getStoredUser } from "@/lib/auth";
import { triggerOpenAuthModal, triggerOpenBillModal } from "@/lib/modalEvents";

export default function Hero() {
  const rotatingHighlights = [
    "100% Offline-First",
    "Zero Cloud Dependency",
    "Sub-Second Billing",
    "Local LAN Kitchen Mesh",
    "Direct ESC/POS Thermal",
  ];

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const user = getStoredUser();
    if (!user) {
      triggerOpenAuthModal("signup", "windows");
    } else {
      window.dispatchEvent(
        new CustomEvent("orderitup_open_auth_modal", {
          detail: { mode: "login", downloadPendingPlatform: "windows" },
        })
      );
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 min-h-[90vh] flex flex-col justify-center">
      {/* React Bits Interactive Squares Canvas Background */}
      <div className="absolute inset-0 z-0 opacity-40">
        <Squares
          direction="diagonal"
          speed={0.4}
          squareSize={42}
          borderColor="rgba(226, 232, 240, 0.75)"
          hoverFillColor="rgba(240, 121, 40, 0.14)"
          backgroundColor="transparent"
        />
      </div>

      {/* React Bits Ambient Floating Particles */}
      <Particles
        quantity={30}
        color="#F07928"
        className="z-1 opacity-50"
      />

      {/* Ambient Radial Orange Lighting */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] sm:w-[900px] sm:h-[450px] bg-orange-500/12 blur-[140px] rounded-full z-1"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow Badge with React Bits ShinyText */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50/90 border border-orange-200/90 text-xs sm:text-sm font-semibold text-orange-700 shadow-xs mb-6 backdrop-blur-xs">
            <Zap className="w-3.5 h-3.5 text-orange-600 fill-orange-500 animate-bounce" />
            <ShinyText
              text={BRAND.eyebrow}
              speed={3.5}
              className="font-bold tracking-tight"
            />
          </div>

          {/* Main Headline with React Bits BlurText */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 max-w-5xl leading-[1.12]">
            <BlurText
              text="The Offline-First Operating System for Modern Restaurants"
              delay={45}
              animateBy="words"
              direction="top"
              className="justify-center"
            />
          </h1>

          {/* Dynamic Value Prop Rotating Highlight */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-base sm:text-xl font-bold text-slate-700">
            <span>Engineered for</span>
            <span className="px-3 py-1 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#EA580C]">
              <RotatingText
                texts={rotatingHighlights}
                interval={2800}
                className="font-extrabold"
              />
            </span>
            <span>with zero downtime risk.</span>
          </div>

          {/* Subheading */}
          <p className="mt-6 text-lg sm:text-xl lg:text-2xl text-slate-600 max-w-3xl leading-relaxed font-normal">
            Run sub-second counter billing offline with instant ESC/POS thermal printing,
            orchestrate live kitchen screens over your local LAN, and eliminate cloud dependency
            risks forever.
          </p>

          {/* CTAs with StarBorder & Magnet micro-interactions */}
          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto">
            {/* Primary Download CTA with StarBorder & Magnet */}
            <Magnet padding={50} magnetStrength={3}>
              <StarBorder
                color="#F07928"
                speed="4s"
                thickness={2}
                className="w-full sm:w-auto"
              >
                <button
                  type="button"
                  onClick={handleDownloadClick}
                  className="w-full sm:w-auto h-14 px-8 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-base shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>Download Desktop POS</span>
                </button>
              </StarBorder>
            </Magnet>

            {/* 80mm Bill Template Direct CTA with Magnet */}
            <Magnet padding={40} magnetStrength={3}>
              <button
                type="button"
                onClick={() => triggerOpenBillModal("standard")}
                className="h-14 px-6 rounded-xl bg-orange-50/90 hover:bg-orange-100/90 text-orange-800 border border-orange-200 font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
              >
                <Receipt className="w-5 h-5 text-orange-600" />
                <span>80mm Bill Template</span>
              </button>
            </Magnet>

            {/* Secondary Interactive Demo CTA with Magnet */}
            <Magnet padding={40} magnetStrength={3}>
              <a
                href="#ui-preview"
                className="h-14 px-6 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-xs"
              >
                <Play className="w-4 h-4 text-orange-600 fill-orange-500" />
                <span>Live POS Demo</span>
              </a>
            </Magnet>
          </div>

          {/* Sub-CTA Reassurance Note */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
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

          {/* Core Trust Badges 4-Grid with React Bits SpotlightCards */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl">
            <SpotlightCard
              spotlightColor="rgba(16, 185, 129, 0.2)"
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Zero Cloud Lock-In</p>
                  <p className="text-[11px] text-slate-500">SQLite WAL on disk</p>
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard
              spotlightColor="rgba(240, 121, 40, 0.2)"
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-orange-300 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">&lt; 10ms Transaction</p>
                  <p className="text-[11px] text-slate-500">Sub-second cart speed</p>
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard
              spotlightColor="rgba(14, 165, 233, 0.2)"
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-sky-300 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 shrink-0">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">24V Solenoid Drawer</p>
                  <p className="text-[11px] text-slate-500">Direct ESC/POS bytecode</p>
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard
              spotlightColor="rgba(168, 85, 247, 0.2)"
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-purple-300 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 shrink-0">
                  <Network className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Local LAN Mesh</p>
                  <p className="text-[11px] text-slate-500">KDS :3002 &amp; Waiter :3003</p>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Desktop Application Window Mockup Chrome with React Bits TiltedCard */}
          <div className="mt-14 w-full max-w-5xl">
            <TiltedCard
              maxAngle={7}
              perspective={1200}
              scaleOnHover={1.015}
              showGlare={true}
              className="w-full text-left"
            >
              <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden backdrop-blur-sm">
                {/* Title Bar */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-100/95 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                    <span className="ml-3 text-xs font-mono text-slate-600 hidden sm:inline flex items-center gap-1.5">
                      <span>Order It Up POS Desktop — v1.2.0 • </span>
                      <DecryptedText
                        text="SQLite Connected (flo.db) • WAL Engine Active"
                        speed={35}
                        maxIterations={12}
                        animateOnHover={true}
                        className="text-emerald-700 font-semibold"
                      />
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
                      <p className="text-xs text-slate-500 font-medium">Active Dining Tables</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">14 / 18</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Avg Turn: 34 mins</p>
                    </div>
                    <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
                      <Flame className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">KDS Active Tickets</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">6 In-Flight</p>
                      <p className="text-[11px] text-amber-600 mt-0.5 font-medium">Avg Prep SLA: 7m 40s</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                      <Zap className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Hardware Status</p>
                      <p className="text-lg font-bold text-slate-900 mt-1">80mm Thermal</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">USB &amp; DK Solenoid Ready</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                      <Printer className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>
            </TiltedCard>
          </div>
        </div>
      </div>
    </section>
  );
}
