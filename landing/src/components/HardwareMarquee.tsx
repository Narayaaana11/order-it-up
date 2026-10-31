"use client";

import React from "react";
import {
  Database,
  Printer,
  Radio,
  Cpu,
  Laptop,
  Apple,
  Terminal,
  Zap,
} from "lucide-react";
import InfiniteScroll from "@/components/reactbits/InfiniteScroll";

const HARDWARE_INTEGRATIONS = [
  {
    name: "SQLite 3 WAL Engine",
    desc: "ACID Local Counter Storage",
    icon: Database,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    name: "ESC/POS Thermal 80mm / 58mm",
    desc: "Direct Raw USB & Serial Bytecode",
    icon: Printer,
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  {
    name: "24V Solenoid RJ11 Drawer",
    desc: "Pin 2 / Pin 5 Cash Drawer Pulse",
    icon: Zap,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    name: "Local LAN WebSocket Mesh",
    desc: "Port :3002 KDS & :3003 Waiter App",
    icon: Radio,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    name: "Star Micronics TSP100 & TSP650",
    desc: "Line Mode Thermal Certified",
    icon: Printer,
    color: "text-sky-600 bg-sky-50 border-sky-200",
  },
  {
    name: "Epson TM-T88 & TM-T20",
    desc: "Native GS V 0 Raster Cut",
    icon: Printer,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    name: "Sunmi POS & Android Tablets",
    desc: "LAN Browser Waiter Station",
    icon: Cpu,
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    name: "Windows 10 / 11 (x64 & ARM)",
    desc: "Zero-Dependency Native Desktop",
    icon: Laptop,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    name: "macOS (Apple Silicon & Intel)",
    desc: "Universal POS Desktop Binary",
    icon: Apple,
    color: "text-slate-800 bg-slate-100 border-slate-300",
  },
  {
    name: "Linux (Ubuntu & Debian)",
    desc: "Lightweight Counter Terminal",
    icon: Terminal,
    color: "text-teal-600 bg-teal-50 border-teal-200",
  },
];

export default function HardwareMarquee() {
  return (
    <div className="py-8 bg-slate-900 border-y border-slate-800 relative overflow-hidden">
      {/* Edge Blur Gradients */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 sm:w-32 bg-gradient-to-r from-slate-900 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 sm:w-32 bg-gradient-to-l from-slate-900 to-transparent z-10" />

      <div className="max-w-7xl mx-auto px-4 mb-3 text-center">
        <span className="text-[11px] font-mono tracking-widest uppercase text-slate-400 font-semibold">
          Certified Hardware &amp; Local Protocol Stack • 100% Offline Compatible
        </span>
      </div>

      <InfiniteScroll speed={32} direction="left" pauseOnHover={true}>
        {HARDWARE_INTEGRATIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-orange-500/50 hover:bg-slate-800 transition-all text-slate-200 whitespace-nowrap shadow-xs"
            >
              <div
                className={`p-2 rounded-lg border ${item.color} shrink-0`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-100">{item.name}</p>
                <p className="text-[10px] text-slate-400">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </InfiniteScroll>
    </div>
  );
}
