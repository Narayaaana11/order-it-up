"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Download,
  Building,
} from "lucide-react";
import { authenticateWithCloud, AuthUser } from "@/lib/auth";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, initialMode, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Please enter a valid email address");
      return;
    }
    if (!password || password.length < (mode === "signup" ? 8 : 1)) {
      setErrorMsg(mode === "signup" ? "Password must be at least 8 characters" : "Please enter your password");
      return;
    }
    if (mode === "signup" && (!fullName.trim() || !restaurantName.trim())) {
      setErrorMsg("Enter your name and restaurant name to create an account.");
      return;
    }

    setIsLoading(true);
    try {
      const user = await authenticateWithCloud(
        mode === "login"
          ? { email: email.trim().toLowerCase(), password }
          : {
              email: email.trim().toLowerCase(),
              password,
              owner_name: fullName.trim(),
              restaurant_name: restaurantName.trim(),
              country: "IN",
              currency: "INR",
              timezone: "Asia/Kolkata",
              service_model: "qsr",
            },
        mode === "login" ? "login" : "register"
      );
      onSuccess?.(user);
      onClose();
      router.push("/dashboard");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Unable to authenticate. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-2rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-description"
      >
        {/* Modal Top Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-orange-100/80 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white border border-orange-200 shadow-xs">
              <img src="/logo.png" alt="Order It Up" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h3 id="auth-modal-title" className="text-lg font-extrabold text-slate-900">
                {mode === "login" ? "Sign In to Order It Up" : "Create Restaurant Account"}
              </h3>
              <p id="auth-modal-description" className="text-xs text-slate-600 mt-0.5">
                {downloadPendingPlatform
                  ? "Desktop installer downloads are temporarily unavailable"
                  : "Cloud sign-in and registration. The dashboard on this site is a sample preview, not a live restaurant workspace."}
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
            <span>{downloadPendingPlatform.toUpperCase()} Desktop POS installer is not currently available. Contact support for release information.</span>
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

          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            Sign in and account creation use the Order It Up Cloud authentication service. Google sign-in is not enabled yet.
          </div>

          {errorMsg && (
            <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <>
                <div>
                  <label htmlFor="auth-full-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      id="auth-full-name"
                      autoComplete="name"
                      maxLength={120}
                      required
                      placeholder="e.g. Priya Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-restaurant-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Restaurant / Cafe Name
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      id="auth-restaurant-name"
                      autoComplete="organization"
                      maxLength={160}
                      required
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
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  id="auth-email"
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
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  id="auth-password"
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  maxLength={256}
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
                    {mode === "login" ? "Sign In to Dashboard" : "Create Restaurant Account"}
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
