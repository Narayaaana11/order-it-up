
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

type PersonaMedia = {
  image: string;
  tag: string;
  metric: string;
};

const PERSONA_MEDIA: Record<string, PersonaMedia> = {
  cashier: {
    image:
      "https://images.unsplash.com/photo-1778792263655-e0e564f3327d?auto=format&fit=crop&w=1400&q=85",
    tag: "Restaurant POS & Counter Billing",
    metric: "Fast Checkout • Payment Processing",
  },

  waiter: {
    image:
      "https://images.unsplash.com/photo-1753351057596-505f35c31012?auto=format&fit=crop&w=1400&q=85",
    tag: "Tableside Guest Service",
    metric: "Order Taking • Table Service",
  },

  chef: {
    image:
      "https://images.unsplash.com/photo-1757770331497-5bedc6cff62b?auto=format&fit=crop&w=1400&q=85",
    tag: "Professional Kitchen Operations",
    metric: "Kitchen Display • Live Order Preparation",
  },

  manager: {
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85",
    tag: "Restaurant Floor Management",
    metric: "Staff Supervision • Table Turnover",
  },

  accountant: {
    image:
      "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1400&q=85",
    tag: "Financial & Reporting Workflows",
    metric: "Tax Summaries • Revenue Reconciliation",
  },

  driver: {
    image:
      "https://images.unsplash.com/photo-1617194191528-9a50cf609304?auto=format&fit=crop&w=1400&q=85",
    tag: "Last-Mile Food Delivery",
    metric: "Order Dispatch • Delivery Tracking",
  },
};

export default function RolePersonas() {
  const [selectedRole, setSelectedRole] = useState(
    ROLE_PERSONAS[0].id
  );

  const activePersona =
    ROLE_PERSONAS.find((role) => role.id === selectedRole) ||
    ROLE_PERSONAS[0];

  const activeMedia = PERSONA_MEDIA[selectedRole];

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
    <section
      id="roles"
      className="relative scroll-mt-16 border-t border-slate-200 bg-slate-50 py-20 lg:py-28"
    >
      <span id="dashboard" className="absolute -top-24 block" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-orange-700">
            <Sparkles className="h-3.5 w-3.5 text-orange-600" />
            <ShinyText text="Multi-Role Operations" speed={3.5} />
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            <BlurText
              text="Tailored Workflows for Every Restaurant Role"
              delay={40}
              className="justify-center"
            />
          </h2>

          <p className="mt-4 text-base font-normal leading-relaxed text-slate-600 sm:text-lg">
            These cards illustrate the types of restaurant workflows being explored. They are not a statement that every capability is available in the current pilot build; confirm your required workflow during onboarding.
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {ROLE_PERSONAS.map((role) => (
            <Magnet
              key={role.id}
              padding={25}
              magnetStrength={3}
            >
              <button
                type="button"
                onClick={() => setSelectedRole(role.id)}
                aria-pressed={selectedRole === role.id}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-[0.98] sm:text-sm ${
                  selectedRole === role.id
                    ? "bg-[#F07928] text-white shadow-md shadow-orange-500/20"
                    : "border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {getRoleIcon(role.icon)}
                <span>{role.title}</span>
              </button>
            </Magnet>
          ))}
        </div>

        {/* Active Role Details */}
        <div className="mx-auto mt-10 max-w-4xl">
          <SpotlightCard
            spotlightColor="rgba(240, 121, 40, 0.16)"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl transition-all sm:p-8"
          >

            {/* Role Header */}
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xl font-bold text-slate-900 sm:text-2xl">
                    {activePersona.title}
                  </span>

                  <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 font-mono text-xs font-semibold text-orange-700">
                    {activePersona.badge}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {activePersona.subtitle}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5 text-orange-600" />
                <span>Role-specific workflow preview</span>
              </div>
            </div>

            {/* Role Image */}
            {activeMedia && (
              <div
                key={selectedRole}
                className="group relative mt-6 mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900"
              >
                <img
                  src={activeMedia.image}
                  alt={`${activePersona.title} operational environment`}
                  className="h-64 w-full object-cover object-center opacity-95 transition-transform duration-700 group-hover:scale-105 sm:h-80"
                  loading="lazy"
                  decoding="async"
                />

                {/* Image Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

                {/* Image Information */}
                <div className="absolute right-4 bottom-4 left-4 flex flex-wrap items-end justify-between gap-3 text-white sm:right-5 sm:bottom-5 sm:left-5">

                  <div>
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-orange-400">
                      Operational Environment
                    </span>

                    <p className="mt-1 text-sm font-bold text-white sm:text-base">
                      {activeMedia.tag}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/20 bg-white/20 px-3 py-1.5 font-mono text-xs font-medium text-white shadow-xs backdrop-blur-md">
                    {activeMedia.metric}
                  </div>
                </div>
              </div>
            )}

            {/* Role Capabilities */}
            <div className="mt-2">

              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Core Operational Capabilities
              </h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activePersona.responsibilities.map((responsibility, index) => (
                  <SpotlightCard
                    key={`${activePersona.id}-${index}`}
                    spotlightColor="rgba(16, 185, 129, 0.12)"
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                    <span className="text-xs font-medium leading-relaxed text-slate-700 sm:text-sm">
                      {responsibility}
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
