'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isElectronEnvironment } from '@/lib/api';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import TrustMetrics from '@/components/landing/TrustMetrics';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import OfflineArchitecture from '@/components/landing/OfflineArchitecture';
import UiPreviews from '@/components/landing/UiPreviews';
import RolePersonas from '@/components/landing/RolePersonas';
import CtaSection from '@/components/landing/CtaSection';
import Footer from '@/components/landing/Footer';

export default function SaaSMainPage() {
  const router = useRouter();

  useEffect(() => {
    // When loaded inside the Electron desktop application, automatically direct to POS dashboard
    if (isElectronEnvironment()) {
      router.replace('/dashboard');
    }
  }, [router]);

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
