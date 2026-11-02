"use client";

import React, { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCloudApiBase } from "@/lib/auth";

const PORTAL_LOGIN_URL = process.env.NEXT_PUBLIC_OIU_CLOUD_PORTAL_URL || "https://app.orderitup.in/auth/login";

export default function PilotInvitationPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  useEffect(() => {
    const match = window.location.hash.match(/(?:^#|&)token=([a-f0-9]{64})(?:&|$)/i);
    if (match?.[1]) {
      const frame = window.requestAnimationFrame(() => setToken(match[1].toLowerCase()));
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This setup link is missing or invalid. Ask the pilot team for a new link.");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("Choose a password between 8 and 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${getCloudApiBase()}/api/pilot-invitations/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; success?: boolean };
      if (!response.ok) throw new Error(data.error || `We couldn’t set up the account (${response.status}).`);
      setCreated(true);
      setPassword("");
      setConfirmPassword("");
      setToken("");
    } catch (submitError) {
      setError(submitError instanceof DOMException && submitError.name === "AbortError"
        ? "The request took too long. Please retry; if the link was already used, sign in to the Cloud Portal."
        : submitError instanceof Error ? submitError.message : "We couldn’t set up the account. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Navbar />
      <main className="mx-auto flex min-h-[65vh] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {created ? (
          <section className="w-full max-w-xl rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-xl sm:p-10" aria-live="polite">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Pilot account created</p>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">Your restaurant access is ready.</h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">Use the email address from your pilot request and the password you just created to sign in to the Cloud Portal.</p>
            <a href={PORTAL_LOGIN_URL} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700">Continue to Cloud Portal <ArrowRight className="h-4 w-4" /></a>
          </section>
        ) : (
          <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-9">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><KeyRound className="h-7 w-7" /></div>
            <div className="mt-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Approved restaurant pilot</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Set up your account password</h1><p className="mt-3 text-sm leading-6 text-slate-600">Choose a password for the restaurant account linked to your approved pilot request. This one-time link expires after seven days.</p></div>
            {!token && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Setup link not found. Open the complete link sent by the Order It Up pilot team or ask them to create a new one.</p>}
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="pilot-password">New password<input id="pilot-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="pilot-confirm-password">Confirm password<input id="pilot-confirm-password" name="confirm_password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
              <button type="submit" disabled={busy || !token} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Setting up account…</> : <>Create account and continue <ArrowRight className="h-4 w-4" /></>}</button>
            </form>
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">Already completed setup? <a href={PORTAL_LOGIN_URL} className="font-semibold text-orange-700 underline underline-offset-2">Sign in to the Cloud Portal</a>. Need a new link? <Link href="/request-access" className="font-semibold text-orange-700 underline underline-offset-2">Contact the pilot team</Link>.</p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
