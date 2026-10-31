"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Download,
  ShieldCheck,
} from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import Magnet from "@/components/reactbits/Magnet";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Brand Logo & Title — Single line with official logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl p-1 shrink-0"
          >
            <img
              src="/logo.png"
              alt="Order It Up Logo"
              className="h-9 w-9 object-contain group-hover:scale-105 transition-transform duration-200"
            />
            <span className="text-xl font-black tracking-tight text-slate-900 whitespace-nowrap">
              Order It Up
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-7 shrink-0">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors focus:outline-none focus:text-orange-600 whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Header Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <a
              href="#ui-preview"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <span>Live Demo</span>
            </a>

            <Magnet padding={25} magnetStrength={3}>
              <a
                href="#download"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Download Desktop POS</span>
              </a>
            </Magnet>
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500 active:scale-[0.98]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-3">
              {/* Links */}
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:text-orange-600 hover:bg-orange-50/80 transition-colors"
                >
                  {link.label}
                </a>
              ))}

              <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                <a
                  href="#download"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-xs active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Desktop POS</span>
                </a>
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 py-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>100% Free Forever for Single Counters</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
