"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Smartphone,
  ChefHat,
  Store,
  FileSpreadsheet,
  Bike,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";
import { ROLE_PERSONAS } from "@/lib/constants";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import Magnet from "@/components/reactbits/Magnet";
import BlurText from "@/components/reactbits/BlurText";
import ShinyText from "@/components/reactbits/ShinyText";

export default function RolePersonas() {
  const [selectedRole, setSelectedRole] = useState(ROLE_PERSONAS[0].id);

  const activePersona =
    ROLE_PERSONAS.find((r) => r.id === selectedRole) || ROLE_PERSONAS[0];

  const getRoleIcon = (iconName: string) => {
    switch (iconName) {
      case "CreditCard":
        return <CreditCard className="w-5 h-5" />;
      case "Smartphone":
        return <Smartphone className="w-5 h-5" />;
      case "ChefHat":
        return <ChefHat className="w-5 h-5" />;
      case "Store":
        return <Store className="w-5 h-5" />;
      case "FileSpreadsheet":
        return <FileSpreadsheet className="w-5 h-5" />;
      case "Bike":
        return <Bike className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  return (
    <section id="roles" className="py-20 lg:py-28 bg-slate-50 border-t border-slate-200 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <ShinyText text="Multi-Role Operations" speed={3.5} />
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            <BlurText
              text="Tailored Workflows for Every Restaurant Role"
              delay={40}
              className="justify-center"
            />
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            From high-speed counter checkout to tableside ordering and back-of-house accounting,
            Order It Up provides tailored interfaces for your entire team.
          </p>
        </div>

        {/* Persona Selectors Tabs with React Bits Magnet */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {ROLE_PERSONAS.map((role) => (
            <Magnet key={role.id} padding={25} magnetStrength={3}>
              <button
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                  selectedRole === role.id
                    ? "bg-[#F07928] text-white shadow-md shadow-orange-500/20"
                    : "bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs"
                }`}
              >
                {getRoleIcon(role.icon)}
                <span>{role.title}</span>
              </button>
            </Magnet>
          ))}
        </div>

        {/* Active Selected Role Details Card with React Bits SpotlightCard */}
        <div className="mt-10 max-w-4xl mx-auto">
          <SpotlightCard
            spotlightColor="rgba(240, 121, 40, 0.16)"
            className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-xl transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900">
                    {activePersona.title}
                  </span>
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-semibold">
                    {activePersona.badge}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{activePersona.subtitle}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5 text-orange-600" />
                <span>Role-Scoped Security Token</span>
              </div>
            </div>

            {/* Persona Capabilities Grid */}
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                Core Operational Capabilities
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activePersona.responsibilities.map((resp, idx) => (
                  <SpotlightCard
                    key={idx}
                    spotlightColor="rgba(16, 185, 129, 0.12)"
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                      {resp}
                    </span>
                  </SpotlightCard>
                ))}
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
