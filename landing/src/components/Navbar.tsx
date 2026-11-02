"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { triggerOpenAuthModal } from "@/lib/modalEvents";

function sectionHref(href: string) {
  return href.startsWith("#") ? `/${href}` : href;
}

function getDashboardHref(user: AuthUser | null): string | null {
  if (!user) return null;

  const role = String(user.role || "").trim().toLowerCase();

  switch (role) {
    case "super_admin":
      return "/dashboard?perspective=founder";

    case "owner":
      return "/dashboard?perspective=merchant&role=owner";

    case "manager":
    case "branch_manager":
      return "/dashboard?perspective=merchant&role=owner";

    case "accountant":
      return "/dashboard?perspective=merchant&role=accountant";

    case "cashier":
      return "/dashboard?perspective=merchant&role=cashier";

    case "server":
    case "waiter":
      return "/dashboard?perspective=merchant&role=waiter";

    case "chef":
    case "kitchen":
      return "/dashboard?perspective=merchant&role=chef";

    case "delivery":
    case "driver":
      return "/dashboard?perspective=merchant&role=driver";

    case "customer":
    case "guest":
    default:
      return null;
  }
}

export default function Navbar() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const syncUser = () => {
      setCurrentUser(getStoredUser());
      setSessionChecked(true);
    };

    syncUser();
    window.addEventListener("orderitup_auth_change", syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("orderitup_auth_change", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  const openLogin = () => {
    setMobileMenuOpen(false);
    triggerOpenAuthModal("login");
  };

  const dashboardHref = getDashboardHref(currentUser);
  const hasDashboardAccess = Boolean(currentUser && dashboardHref);
  const showDashboardLink = sessionChecked && (!currentUser || hasDashboardAccess);

  const openDashboard = () => {
    setMobileMenuOpen(false);
    if (!currentUser) {
      triggerOpenAuthModal("login");
      return;
    }
    if (dashboardHref) router.push(dashboardHref);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 sm:min-h-[76px]">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Order It Up home"
            className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <img src="/logo.png" alt="" className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
            <span className="whitespace-nowrap text-lg font-black tracking-tight text-slate-950 sm:text-xl">Order It Up</span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-5 xl:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={sectionHref(link.href)} className="whitespace-nowrap rounded-lg px-1 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                {link.label}
              </Link>
            ))}
            {showDashboardLink && (
              <button type="button" onClick={openDashboard} className="whitespace-nowrap rounded-lg px-1 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                Dashboard
              </button>
            )}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            {!currentUser ? (
              <>
                <button type="button" onClick={openLogin} className="min-h-10 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                  Log in
                </button>
                <Link href="/request-access" className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-orange-600/20 transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
                  Request Pilot Access <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            ) : hasDashboardAccess ? (
              <button type="button" onClick={openDashboard} className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-orange-600/20 transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
                Open Dashboard <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 xl:hidden">
            {!currentUser && (
              <button type="button" onClick={openLogin} className="min-h-10 rounded-lg px-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Log in</button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-slate-200 py-3 xl:hidden">
            <div className="grid gap-1 sm:grid-cols-2">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={sectionHref(link.href)} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                  {link.label}
                </Link>
              ))}
              {showDashboardLink && (
                <button type="button" onClick={openDashboard} className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                  Dashboard
                </button>
              )}
              <Link href="/#ui-preview" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Explore Demo</Link>
            </div>
            {!currentUser ? (
              <Link href="/request-access" onClick={() => setMobileMenuOpen(false)} className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
                Request Pilot Access <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : hasDashboardAccess ? (
              <button type="button" onClick={openDashboard} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
                Open Dashboard <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </nav>
        )}
      </div>
    </header>
  );
}
