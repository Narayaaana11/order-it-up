'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChefHat,
  Monitor,
  Cloud,
  Smartphone,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react';

export default function MarketingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-xl bg-slate-950/90 border-b border-slate-800/90 shadow-2xl shadow-black/50'
          : 'backdrop-blur-md bg-slate-950/70 border-b border-slate-800/50'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shadow-lg shadow-orange-500/10 group-hover:scale-105 group-hover:border-orange-500/50 transition-all duration-300">
            <img src="/logo.png" alt="Order It Up" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white group-hover:text-orange-400 transition-colors">
                Order It Up
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 uppercase tracking-wider">
                Cloud POS
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-tight">
              Restaurant Operating System
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1 xl:space-x-2 text-sm font-medium text-slate-300">
          {/* Product Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setProductDropdownOpen(true)}
            onMouseLeave={() => setProductDropdownOpen(false)}
          >
            <button
              onClick={() => setProductDropdownOpen(!productDropdownOpen)}
              className="px-3.5 py-2 rounded-lg hover:text-white hover:bg-slate-900/60 transition-all flex items-center gap-1.5 focus:outline-none"
              aria-expanded={productDropdownOpen}
            >
              <span>Product</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  productDropdownOpen ? 'rotate-180 text-orange-400' : 'text-slate-500'
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {productDropdownOpen && (
              <div className="absolute top-full left-0 w-80 pt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-2xl p-3 shadow-2xl shadow-black/80 space-y-1">
                  <a
                    href="#platforms"
                    onClick={() => setProductDropdownOpen(false)}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-all">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-orange-400 transition-colors">
                        Offline Desktop POS
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        Local SQLite atomic billing & ESC/POS hardware printing.
                      </div>
                    </div>
                  </a>

                  <a
                    href="#platforms"
                    onClick={() => setProductDropdownOpen(false)}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-all">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-sky-400 transition-colors">
                        Multi-Branch Cloud HQ
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        Real-time sales rollup, catalog overrides & analytics.
                      </div>
                    </div>
                  </a>

                  <a
                    href="#showcase"
                    onClick={() => setProductDropdownOpen(false)}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all">
                      <ChefHat className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                        Kitchen Display (KDS)
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        Station routing for Bar, Grill, and Prep lines.
                      </div>
                    </div>
                  </a>

                  <a
                    href="#platforms"
                    onClick={() => setProductDropdownOpen(false)}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        Mobile Waiter Companion
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        6-digit PIN zero-config table-side ordering.
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            )}
          </div>

          <a
            href="#features"
            className="px-3.5 py-2 rounded-lg hover:text-white hover:bg-slate-900/60 transition-all"
          >
            Features
          </a>

          <a
            href="#roles"
            className="px-3.5 py-2 rounded-lg hover:text-white hover:bg-slate-900/60 transition-all"
          >
            Roles
          </a>

          <a
            href="#hardware"
            className="px-3.5 py-2 rounded-lg hover:text-white hover:bg-slate-900/60 transition-all"
          >
            Hardware
          </a>

          <a
            href="#how-it-works"
            className="px-3.5 py-2 rounded-lg hover:text-white hover:bg-slate-900/60 transition-all"
          >
            How It Works
          </a>

          <a
            href="#faq"
            className="px-3.5 py-2 rounded-lg hover:text-white hover:bg-slate-900/60 transition-all"
          >
            FAQ
          </a>

          {/* Quick Browser POS Link */}
          <Link
            href="/pos"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Monitor className="w-3.5 h-3.5 text-orange-400" />
            <span>Web POS Demo</span>
          </Link>
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden sm:flex items-center space-x-3">
          <Link
            href="/auth/login"
            className="px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-900/80 rounded-xl transition-all border border-transparent hover:border-slate-800"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/auth/register"
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg shadow-md shadow-orange-500/20 sm:hidden"
          >
            Free Trial
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-orange-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-800 bg-slate-950/98 backdrop-blur-2xl px-4 pt-4 pb-6 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <Link
              href="/pos"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-center gap-2 hover:border-orange-500/40"
            >
              <Monitor className="w-4 h-4 text-orange-400" />
              <span>Web POS Terminal</span>
            </Link>
            <Link
              href="/cloud-portal"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-center gap-2 hover:border-sky-500/40"
            >
              <Cloud className="w-4 h-4 text-sky-400" />
              <span>Cloud HQ Portal</span>
            </Link>
          </div>

          <div className="space-y-1 text-sm font-medium text-slate-300 border-t border-slate-800/80 pt-3">
            <a
              href="#platforms"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white"
            >
              Platform Overview
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white"
            >
              Enterprise Capabilities
            </a>
            <a
              href="#roles"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white"
            >
              Role-Based Workflows
            </a>
            <a
              href="#hardware"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white"
            >
              Hardware & Printers
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white"
            >
              Onboarding Process
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white"
            >
              Frequently Asked Questions
            </a>
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <Link
              href="/auth/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 text-center text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
            >
              <span>Register Restaurant Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-sm font-semibold text-slate-300 bg-slate-900 hover:text-white rounded-xl border border-slate-800"
            >
              Existing Merchant Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
