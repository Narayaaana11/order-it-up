"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Download,
  Building,
  Crown,
  Briefcase,
  CreditCard,
} from "lucide-react";
import { DEMO_USERS, setStoredUser, AuthUser } from "@/lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthUser) => void;
  initialMode?: "login" | "signup";
  downloadPendingPlatform?: "windows" | "mac" | "linux" | "any" | null;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "login",
  downloadPendingPlatform = null,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [fullName, setFullName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleQuickLogin = (roleKey: keyof typeof DEMO_USERS) => {
    const preset = DEMO_USERS[roleKey];
    setEmail(preset.email);
    setPassword(preset.pass);
    setIsLoading(true);

    setTimeout(() => {
      setStoredUser(preset.user);
      setIsLoading(false);
      if (onSuccess) onSuccess(preset.user);
      onClose();
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Find matching preset or create new user session
      const matchedKey = Object.keys(DEMO_USERS).find(
        (k) => DEMO_USERS[k].email.toLowerCase() === email.toLowerCase()
      );

      let authUser: AuthUser;
      if (matchedKey) {
        authUser = DEMO_USERS[matchedKey].user;
      } else {
        authUser = {
          id: `usr_${Date.now()}`,
          name: fullName || email.split("@")[0],
          email,
          role: mode === "signup" ? "owner" : "owner",
          organizationName: restaurantName || "My Restaurant",
        };
      }

      setStoredUser(authUser);
      setIsLoading(false);
      if (onSuccess) onSuccess(authUser);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="p-6 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white border border-orange-200 shadow-xs">
              <img src="/logo.png" alt="Order It Up" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {mode === "login" ? "Sign In to Order It Up" : "Create Restaurant Account"}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {downloadPendingPlatform
                  ? "Authentication required to access desktop binaries"
                  : "Access cloud dashboards, franchise analytics & offline POS"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {downloadPendingPlatform && (
          <div className="px-6 py-2.5 bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            <span>Sign in to unlock the {downloadPendingPlatform.toUpperCase()} Desktop POS installer</span>
          </div>
        )}

        <div className="p-6">
          {/* Mode Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMsg("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Account (Free)
            </button>
          </div>

          {/* Google Sign-in Demo Placeholder */}
          <button
            type="button"
            onClick={() => handleQuickLogin("owner")}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2.5 shadow-2xs transition-all cursor-pointer mb-5 active:scale-[0.99]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="font-medium text-slate-800">Continue with Google</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold uppercase tracking-wider">
              Demo
            </span>
          </button>

          {/* Quick-Fill Demo Role Credentials */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Instant Test Credentials (1-Click)
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Seed Accounts
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("owner")}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Crown className="w-3.5 h-3.5 text-orange-600" />
                  <span>Owner</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">demo.owner</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("manager")}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>Manager</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">demo.manager</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("cashier")}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cashier</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">demo.cashier</div>
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center mb-5">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-mono uppercase">
              Or with email
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. Priya Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Restaurant / Cafe Name
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. The Rustic Olive Bistro"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  placeholder="name@restaurant.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>
                    {mode === "login"
                      ? downloadPendingPlatform
                        ? "Sign In & Start Download"
                        : "Sign In to Dashboard"
                      : "Create Account & Unlock Download"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy Note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero cloud vendor lock-in • 100% Offline-First POS Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
