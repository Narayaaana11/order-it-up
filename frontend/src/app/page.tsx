'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isElectronEnvironment } from '@/lib/api';

import MarketingNavbar from '@/components/marketing/Navbar';
import MarketingHeroSection from '@/components/marketing/HeroSection';
import MarketingProductShowcase from '@/components/marketing/ProductShowcase';
import MarketingFeaturesGrid from '@/components/marketing/FeaturesGrid';
import MarketingRoleWorkflows from '@/components/marketing/RoleWorkflows';
import MarketingHowItWorks from '@/components/marketing/HowItWorks';
import MarketingPlatformMatrix from '@/components/marketing/PlatformMatrix';
import MarketingIntegrationsHub from '@/components/marketing/IntegrationsHub';
import MarketingProductBenefits from '@/components/marketing/ProductBenefits';
import MarketingPricingSection from '@/components/marketing/PricingSection';
import MarketingProductFAQ from '@/components/marketing/ProductFAQ';
import MarketingCtaSection from '@/components/marketing/CtaSection';
import MarketingFooter from '@/components/marketing/Footer';

export default function SaaSMainPage() {
  const router = useRouter();

  useEffect(() => {
    // When loaded inside the Electron desktop application, automatically direct to POS dashboard
    if (isElectronEnvironment()) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white flex flex-col font-sans">
      {/* 1. Header / Navigation */}
      <MarketingNavbar />

      {/* 2. Main Page Content */}
      <main className="flex-1">
        {/* Hero Section with Interactive POS Terminal & KDS Simulator */}
        <MarketingHeroSection />

        {/* 3. Product Showcase (5 Deep Verified Interactive Tabs) */}
        <MarketingProductShowcase />

        {/* 4. Core Features Grid (Offline Durability, ESC/POS, Central Catalog, etc.) */}
        <MarketingFeaturesGrid />

        {/* 5. Role-Based Workflow Matrix (Owner, Manager, Accountant, Cashier, Server, Chef) */}
        <MarketingRoleWorkflows />

        {/* 6. How It Works (4-Step Onboarding Walkthrough) */}
        <MarketingHowItWorks />

        {/* 7. Platform & Device Experience (Web, Desktop, Mobile) */}
        <MarketingPlatformMatrix />

        {/* 8. Integrations & Hardware Ecosystem */}
        <MarketingIntegrationsHub />

        {/* 9. Product Benefits & Architectural Integrity */}
        <MarketingProductBenefits />

        {/* 10. Transparent SaaS Pricing & Trial */}
        <MarketingPricingSection />

        {/* 11. Frequently Asked Questions Accordion */}
        <MarketingProductFAQ />

        {/* 12. Final High-Conversion Call to Action */}
        <MarketingCtaSection />
      </main>

      {/* 13. Comprehensive Marketing Footer */}
      <MarketingFooter />
    </div>
  );
}
