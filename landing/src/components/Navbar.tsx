"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Download,
  ShieldCheck,
  Receipt,
  LogOut,
  Key,
  UserPlus,
  LayoutDashboard,
} from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import Magnet from "@/components/reactbits/Magnet";
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/auth";
import {
  triggerOpenAuthModal,
  triggerOpenBillModal,
  triggerOpenCredentialsModal,
} from "@/lib/modalEvents";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Read on client mount without triggering synchronous effect render warning
    const timer = setTimeout(() => {
      setCurrentUser(getStoredUser());
    }, 0);

    const handleAuthChange = () => {
      setCurrentUser(getStoredUser());
    };

    window.addEventListener("orderitup_auth_change", handleAuthChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("orderitup_auth_change", handleAuthChange);
    };
  }, []);

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) {
      triggerOpenAuthModal("login", "windows");
    } else {
      // User is logged in, trigger download directly
      window.dispatchEvent(
        new CustomEvent("orderitup_trigger_download", {
          detail: { platform: "windows" },
        })
      );
    }
  };

  const handleSignOut = () => {
    setStoredUser(null);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          {/* Brand Logo & Title */}
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

          {/* Desktop Navigation Text Links (Visible on xl+ screens) */}
          <nav className="hidden 2xl:flex items-center gap-4 shrink-0">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-semibold text-slate-600 hover:text-orange-600 transition-colors focus:outline-none focus:text-orange-600 whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Primary Action Buttons (Desktop): The 4 Core Items */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {/* 1. 80mm Bill Template */}
            <button
              type="button"
              onClick={() => triggerOpenBillModal("standard")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-orange-700 bg-orange-50/90 hover:bg-orange-100 border border-orange-200 shadow-xs active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
              title="View authentic 80mm ESC/POS thermal receipt template"
            >
              <Receipt className="w-3.5 h-3.5 text-orange-600" />
              <span>80mm Bill Template</span>
            </button>

            {/* 2. Roles & Logins */}
            <button
              type="button"
              onClick={() => triggerOpenCredentialsModal()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
              title="View all operational roles credentials & PINs"
            >
              <Key className="w-3.5 h-3.5 text-slate-600" />
              <span>Roles &amp; Logins</span>
            </button>

            {/* 3. Dashboard (Links to /dashboard) */}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-slate-800 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 border border-slate-200 shadow-xs active:scale-[0.98] transition-all whitespace-nowrap"
              title="Open Executive Dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-orange-600" />
              <span>Dashboard</span>
            </Link>

            {/* User Session Pill or Sign Up */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-800"
                  title={`${currentUser.name} (${currentUser.role})`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                    {currentUser.name.charAt(0)}
                  </div>
                  <span className="font-bold hidden xl:inline text-xs">{currentUser.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => triggerOpenAuthModal("signup")}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold text-xs text-orange-600 hover:text-orange-700 bg-orange-50/60 hover:bg-orange-50 border border-orange-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </button>
            )}

            {/* 4. Download Desktop POS (Primary Gated CTA) */}
            <Magnet padding={20} magnetStrength={3}>
              <button
                type="button"
                onClick={handleDownloadClick}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Desktop POS</span>
              </button>
            </Magnet>
          </div>

          {/* Medium Screens (Tablet md to lg): Compact Essential Bar */}
          <div className="hidden md:flex lg:hidden items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-xs text-slate-800 bg-slate-100 hover:bg-orange-50 border border-slate-200"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-orange-600" />
              <span>Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={handleDownloadClick}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download POS</span>
            </button>
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500 active:scale-[0.98] cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-2.5">
              {/* User Session Bar in Mobile */}
              {currentUser ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-xs">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                      <p className="text-[10px] text-orange-600 font-mono uppercase">
                        {currentUser.role} • {currentUser.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-white transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="pb-2 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      triggerOpenAuthModal("signup");
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#F07928] hover:bg-[#EA580C] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Sign Up</span>
                  </button>
                </div>
              )}

              {/* The 4 Core Actions in Mobile Drawer */}
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-xs active:scale-[0.98] transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Executive Dashboard</span>
              </Link>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    triggerOpenBillModal("standard");
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>80mm Bill Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    triggerOpenCredentialsModal();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Roles &amp; Logins</span>
                </button>
              </div>

              {/* Page Section Navigation Links */}
              <div className="py-2 border-y border-slate-100 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-orange-600 hover:bg-orange-50/80 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              {/* Download Desktop POS Action */}
              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleDownloadClick(e);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Desktop POS</span>
                </button>
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 py-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{currentUser ? "Ready to Download (Windows x64)" : "Sign Up Required"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
