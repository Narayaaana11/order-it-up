"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { triggerOpenAuthModal } from "@/lib/modalEvents";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4 sm:h-20">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-xl p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <img src="/logo.png" alt="Order It Up Logo" className="h-9 w-9 object-contain" />
            <span className="whitespace-nowrap text-xl font-black tracking-tight text-slate-900">
              Order It Up
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden shrink-0 items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-xs font-semibold text-slate-600 transition-colors hover:text-orange-600 focus:outline-none focus:text-orange-600"
              >
                {link.label}
              </a>
            ))}
            <Link href="/dashboard?perspective=founder" className="whitespace-nowrap text-xs font-semibold text-slate-600 transition-colors hover:text-orange-600 focus:outline-none focus:text-orange-600">
              Platform Admin
            </Link>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <button
              type="button"
              onClick={() => triggerOpenAuthModal("login")}
              className="whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              Log in
            </button>
            <a
              href="#ui-preview"
              className="whitespace-nowrap rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:border-orange-300 hover:bg-orange-50"
            >
              Explore Demo
            </a>
            <a
              href="/request-access"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-[#F07928] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-[#EA580C]"
            >
              Request Pilot Access
            </a>
          </div>

          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-xs hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="animate-in slide-in-from-top-2 border-t border-slate-200 py-4 fade-in duration-200 md:hidden">
            <div className="flex flex-col gap-2">
              <a
                href="#ui-preview"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600"
              >
                Explore Demo
              </a>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600"
              >
                Dashboard Sandbox
              </Link>
              <Link
                href="/dashboard?perspective=founder"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600"
              >
                Platform Admin
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  triggerOpenAuthModal("login");
                }}
                className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  triggerOpenAuthModal("signup");
                }}
                className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600"
              >
                Create account
              </button>
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-600"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/request-access"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 rounded-xl bg-[#F07928] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#EA580C]"
              >
                Request Pilot Access
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
