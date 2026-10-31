"use client";

import React, { useState } from "react";
import {
  Server,
  Database,
  Wifi,
  WifiOff,
  Printer,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Radio,
  Zap,
} from "lucide-react";
import { ARCHITECTURE_LAYERS } from "@/lib/constants";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import TiltedCard from "@/components/reactbits/TiltedCard";
import DecryptedText from "@/components/reactbits/DecryptedText";
import Magnet from "@/components/reactbits/Magnet";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";

export default function OfflineArchitecture() {
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [pulseCount, setPulseCount] = useState(1482);

  const toggleSimulation = () => {
    setIsSimulatedOffline(!isSimulatedOffline);
    setPulseCount((prev) => prev + 1);
  };

  const layerSpotlights = [
    "rgba(240, 121, 40, 0.16)",
    "rgba(16, 185, 129, 0.16)",
    "rgba(14, 165, 233, 0.16)",
    "rgba(168, 85, 247, 0.16)",
  ];

  return (
    <section id="architecture" className="py-20 lg:py-28 bg-slate-50 border-t border-slate-200 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <ShinyText text="Offline-First Topology" speed={3.5} />
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            <BlurText
              text="How Order It Up Guarantees Zero Downtime"
              delay={40}
              className="justify-center"
            />
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Unlike cloud-only POS systems that freeze when the internet flickers, Order It Up executes
            every single order, modification, and payment on local counter hardware.
          </p>
        </div>

        {/* Two-Column Architecture Showcase */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Architectural Layers with React Bits SpotlightCards */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {ARCHITECTURE_LAYERS.map((layer, index) => (
              <SpotlightCard
                key={index}
                spotlightColor={layerSpotlights[index % layerSpotlights.length]}
                className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    {index === 0 && <Database className="w-5 h-5 text-orange-600" />}
                    {index === 1 && <Radio className="w-5 h-5 text-emerald-600" />}
                    {index === 2 && <Printer className="w-5 h-5 text-sky-600" />}
                    {index === 3 && <Server className="w-5 h-5 text-purple-600" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{layer.level}</h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {layer.port}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-orange-600 font-medium mt-1">{layer.tech}</p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-normal">
                      {layer.description}
                    </p>
                  </div>
                </div>

                <span className="self-end sm:self-center text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                  {layer.status}
                </span>
              </SpotlightCard>
            ))}
          </div>

          {/* Right Column: Live Simulated Telemetry Card in TiltedCard */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <TiltedCard
              maxAngle={6}
              perspective={1100}
              scaleOnHover={1.015}
              showGlare={true}
              className="w-full"
            >
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xl relative overflow-hidden">
                {/* Telemetry Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-5 h-5 text-orange-600 animate-spin-slow" />
                    <span className="text-sm font-bold text-slate-900">Live Engine Telemetry</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                    </span>
                    <span>ONLINE (WAL)</span>
                  </div>
                </div>

                {/* Status Metric Rows */}
                <div className="mt-5 space-y-3 text-xs font-mono">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-medium">Local POS Engine</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      ● Port 3001 (Active)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-medium">Database Engine</span>
                    <span className="text-slate-800 font-semibold">
                      <DecryptedText
                        text="SQLite WAL (flo.db)"
                        speed={35}
                        animateOnHover={true}
                        className="text-slate-900 font-bold"
                      />
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-medium">Transaction Latency</span>
                    <span className="text-orange-600 font-semibold">&lt; 3.2 ms (Zero WAN wait)</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-medium">KDS WebSockets</span>
                    <span className="text-emerald-700 font-semibold">Port 3002 (3 Stations)</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-medium">ESC/POS Thermal Bus</span>
                    <span className="text-sky-700 font-semibold">Raw USB (80mm Ready)</span>
                  </div>

                  {/* Simulated WAN Status */}
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      isSimulatedOffline
                        ? "bg-amber-50 border-amber-300 text-amber-800"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className="text-slate-500 font-medium">Simulated WAN / ISP</span>
                    <span className="font-semibold flex items-center gap-1.5">
                      {isSimulatedOffline ? (
                        <>
                          <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          <span>DISCONNECTED (Outage)</span>
                        </>
                      ) : (
                        <>
                          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                          <span>CONNECTED (Cloud Sync Idle)</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-medium">Local Outbox Buffer</span>
                    <span className="text-slate-800 font-semibold">
                      {isSimulatedOffline ? "4 Events Queued in WAL" : "0 Pending (Synced)"}
                    </span>
                  </div>
                </div>

                {/* Interactive Simulation Switch with React Bits Magnet */}
                <div className="mt-6 pt-5 border-t border-slate-200">
                  <Magnet padding={35} magnetStrength={3} className="w-full">
                    <button
                      type="button"
                      onClick={toggleSimulation}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
                        isSimulatedOffline
                          ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-sm"
                          : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-xs"
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        {isSimulatedOffline
                          ? "Restore Internet Connection"
                          : "Simulate Cable Cut / ISP Outage"}
                      </span>
                    </button>
                  </Magnet>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Transactions logged: {pulseCount}</span>
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Billing never halts
                    </span>
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
