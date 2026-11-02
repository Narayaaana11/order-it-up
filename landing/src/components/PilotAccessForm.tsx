"use client";

import Link from "next/link";
import React, { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { getCloudApiBase } from "@/lib/auth";

type RequestResult = { ok: boolean; request?: { id: string }; message?: string; error?: string };

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const labelClass = "block text-sm font-semibold text-slate-700";

export default function PilotAccessForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<RequestResult | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const outletCount = Number(form.get("outlet_count"));
    const payload = {
      contact_name: String(form.get("contact_name") || "").trim(),
      restaurant_name: String(form.get("restaurant_name") || "").trim(),
      email: String(form.get("email") || "").trim().toLowerCase(),
      phone: String(form.get("phone") || "").trim(),
      city: String(form.get("city") || "").trim(),
      country: String(form.get("country") || "IN"),
      restaurant_type: String(form.get("restaurant_type") || ""),
      outlet_count: outletCount,
      current_pos: String(form.get("current_pos") || "").trim(),
      message: String(form.get("message") || "").trim(),
      consent: form.get("consent") === "on",
      website: String(form.get("website") || ""),
    };

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const requestKey = idempotencyKey.current;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      let response: Response;
      try {
        response = await fetch(`${getCloudApiBase()}/api/pilot-requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Idempotency-Key": requestKey,
          },
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify(payload),
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const data = await response.json().catch(() => ({})) as RequestResult;
      if (!response.ok) throw new Error(data.error || `We couldn’t send your request (${response.status}). Please try again.`);
      setSubmitted(data);
      idempotencyKey.current = null;
      formElement.reset();
    } catch (submitError) {
      setError(submitError instanceof DOMException && submitError.name === "AbortError"
        ? "The request took too long to send. Your details are still here; please try again."
        : submitError instanceof Error ? submitError.message : "We couldn’t send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-xl sm:p-10" aria-live="polite">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Request received</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">Thanks for telling us about your restaurant.</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">{submitted.message || "The pilot team will review your request and contact you about next steps."}</p>
          {submitted.request?.id && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">Reference: {submitted.request.id}</p>}
          <p className="mt-4 text-xs leading-5 text-slate-500">A request does not create an account or grant access automatically. If you already have an account, you can <Link href="/" className="font-semibold text-orange-700 underline underline-offset-2">log in from the navigation</Link>.</p>
          <button type="button" onClick={() => setSubmitted(null)} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700">Submit another request</button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={labelClass} htmlFor="pilot-contact-name">Your name <span className="text-orange-700">*</span>
          <input className={inputClass} id="pilot-contact-name" name="contact_name" autoComplete="name" maxLength={120} required placeholder="Name of the owner or contact" />
        </label>
        <label className={labelClass} htmlFor="pilot-restaurant-name">Restaurant or business name <span className="text-orange-700">*</span>
          <input className={inputClass} id="pilot-restaurant-name" name="restaurant_name" autoComplete="organization" maxLength={160} required placeholder="Your restaurant name" />
        </label>
        <label className={labelClass} htmlFor="pilot-email">Business email <span className="text-orange-700">*</span>
          <input className={inputClass} id="pilot-email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@restaurant.com" />
        </label>
        <label className={labelClass} htmlFor="pilot-phone">Phone / WhatsApp <span className="font-normal text-slate-500">(optional)</span>
          <input className={inputClass} id="pilot-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="Include country code if outside India" />
        </label>
        <label className={labelClass} htmlFor="pilot-city">City or region
          <input className={inputClass} id="pilot-city" name="city" autoComplete="address-level2" maxLength={120} placeholder="City" />
        </label>
        <label className={labelClass} htmlFor="pilot-country">Country
          <select className={inputClass} id="pilot-country" name="country" defaultValue="IN">
            <option value="IN">India</option><option value="AE">United Arab Emirates</option><option value="GB">United Kingdom</option><option value="US">United States</option><option value="ZZ">Other</option>
          </select>
        </label>
        <label className={labelClass} htmlFor="pilot-restaurant-type">Business type <span className="text-orange-700">*</span>
          <select className={inputClass} id="pilot-restaurant-type" name="restaurant_type" required defaultValue="">
            <option value="" disabled>Select a business type</option><option value="restaurant">Restaurant</option><option value="cafe">Cafe</option><option value="qsr">Quick service / QSR</option><option value="bar">Bar or pub</option><option value="other">Other food business</option>
          </select>
        </label>
        <label className={labelClass} htmlFor="pilot-outlet-count">Number of outlets <span className="text-orange-700">*</span>
          <input className={inputClass} id="pilot-outlet-count" name="outlet_count" type="number" min={1} max={10000} step={1} defaultValue={1} required />
        </label>
        <label className={`${labelClass} sm:col-span-2`} htmlFor="pilot-current-pos">Current POS or setup <span className="font-normal text-slate-500">(optional)</span>
          <input className={inputClass} id="pilot-current-pos" name="current_pos" maxLength={160} placeholder="What do you use today?" />
        </label>
        <label className={`${labelClass} sm:col-span-2`} htmlFor="pilot-message">What would you like to evaluate? <span className="font-normal text-slate-500">(optional)</span>
          <textarea className={`${inputClass} min-h-28 resize-y`} id="pilot-message" name="message" maxLength={1500} placeholder="Tell us about the workflows or hardware you want to explore." />
        </label>
      </div>

      <label className="sr-only" aria-hidden="true" htmlFor="pilot-website">Leave this field empty
        <input id="pilot-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
        <input className="mt-1 h-4 w-4 shrink-0 accent-orange-600" type="checkbox" name="consent" required />
        <span>I agree that the pilot team may use these details to respond to this request. I have read the <Link className="font-semibold text-orange-700 underline underline-offset-2" href="/legal/privacy">Privacy Policy</Link>.</span>
      </label>

      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Back to Order It Up</Link>
        <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#F07928] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#EA580C] disabled:cursor-wait disabled:opacity-60">
          {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending request…</> : <>Send pilot request <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">This form sends your request to the Order It Up Cloud API for the pilot team to review. It does not create an account or guarantee access.</p>
    </form>
  );
}
