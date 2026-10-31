"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  UserPlus,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/auth";
import { triggerOpenAuthModal } from "@/lib/modalEvents";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Read on client mount without triggering synchronous cascading render warning
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

  const handleSignOut = () => {
    setStoredUser(null);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
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

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 shrink-0">
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

          {/* Right Header Action: Strictly "Sign Up" (or User Profile if logged in) */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-slate-800 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 border border-slate-200 transition-all shadow-xs"
                  title="Open Dashboard"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-orange-600" />
                  <span>Dashboard</span>
                </Link>

                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800"
                  title={`${currentUser.name} (${currentUser.role})`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                    {currentUser.name.charAt(0)}
                  </div>
                  <span className="font-bold text-xs">{currentUser.name}</span>
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
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#F07928] hover:bg-[#EA580C] shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Sign Up</span>
              </button>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
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
          <div className="md:hidden py-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-3">
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
                        {currentUser.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#F07928] text-white text-xs font-bold"
                    >
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    triggerOpenAuthModal("signup");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-[#F07928] hover:bg-[#EA580C] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </button>
              )}

              {/* Page Section Navigation Links */}
              <div className="py-2 border-t border-slate-100 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-orange-600 hover:bg-orange-50/80 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
