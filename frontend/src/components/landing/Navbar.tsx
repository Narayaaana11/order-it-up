"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  Download,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  LogOut,
  User,
  LogIn,
  UserPlus,
} from "lucide-react";
import { BRAND, NAV_LINKS } from "@/lib/constants";
import { useAuthStore } from "@/store/auth";
import { getLandingPage } from "@/components/layout/AuthGuard";

export default function Navbar() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { user, logout } = useAuthStore();
  const isAuthenticated = mounted && Boolean(user);
  const dashboardHref = mounted ? getLandingPage() : "/cloud-portal";

  const handleDownloadClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      router.push('/auth/login?redirect=download');
    } else {
      e.preventDefault();
      try {
        const blob = new Blob(
          [
            `Order It Up Desktop POS v1.2.0\n` +
            `Platform: Windows 10 / 11 (x64 / ARM64)\n` +
            `Engine: Standalone Electron + Express (:3001) + SQLite WAL\n` +
            `Zero Cloud Lock-in • Offline Durability Guaranteed\n` +
            `Artifact: Order-It-Up-Setup.exe\n` +
            `Visit: https://orderitup.pages.dev/ for documentation.`
          ],
          { type: 'application/octet-stream' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Order-It-Up-Setup.exe';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Brand Logo, Title & Offline Engine Status */}
          <div className="flex items-center gap-3">
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
                {BRAND.name}
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              100% Offline Engine
            </span>
          </div>

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

          {/* Right Header Desktop CTAs — One clean line */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                {/* User & Role Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap">
                  <User className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate max-w-[120px]">
                    {user?.name || user?.email?.split('@')[0] || 'Store User'}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                    {user?.role || 'Staff'}
                  </span>
                </div>

                {/* Go to Dashboard CTA */}
                <Link
                  href={dashboardHref}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => logout()}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 active:scale-[0.98] transition-all shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                {/* Distinct Login Link */}
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4 text-slate-600" />
                  <span>Login</span>
                </Link>

                {/* Distinct Sign Up Button */}
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </Link>

                {/* Desktop POS Windows Download */}
                <a
                  href="#download-windows"
                  onClick={handleDownloadClick}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Download</span>
                </a>
              </div>
            )}
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
              {isAuthenticated ? (
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-semibold text-slate-900">
                        {user?.name || user?.email || 'Store User'}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                      {user?.role || 'Staff'}
                    </span>
                  </div>
                  <Link
                    href={dashboardHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Go to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* Distinct Login and Signup in mobile */}
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 px-3 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5 text-slate-600" />
                    <span>Login</span>
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Sign Up</span>
                  </Link>
                </div>
              )}

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
                  href="#download-windows"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleDownloadClick(e);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
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
