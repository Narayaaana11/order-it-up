import React from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustMetrics from "@/components/TrustMetrics";
import FeaturesGrid from "@/components/FeaturesGrid";
import OfflineArchitecture from "@/components/OfflineArchitecture";
import UiPreviews from "@/components/UiPreviews";
import RolePersonas from "@/components/RolePersonas";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Hero Section with Value Proposition and Ambient Lighting */}
        <Hero />

        {/* High-Contrast Trust & Performance Metrics Ribbon */}
        <TrustMetrics />

        {/* 6-Card POS Feature Grid */}
        <FeaturesGrid />

        {/* Offline-First Architecture Breakdown & Live Telemetry Simulator */}
        <OfflineArchitecture />

        {/* Realistic Interactive UI Previews: Cart Simulator, KDS Ticket, Thermal Receipt */}
        <UiPreviews />

        {/* Multi-Role Operational Personas */}
        <RolePersonas />

        {/* Call to Action & Download Platforms */}
        <CtaSection />
      </main>

      {/* Complete Footer */}
      <Footer />
    </div>
  );
}

