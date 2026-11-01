"use client";

import React, { FormEvent, useState } from "react";
import Link from "next/link";
import { PILOT_API_BASE } from "@/lib/pilot-api";

type FormState = {
  contact_name: string;
  restaurant_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  business_type: string;
  existing_pos: string;
  hardware: string;
  outlets: string;
  message: string;
  consent: boolean;
  website: string;
};

const INITIAL_FORM: FormState = {
  contact_name: "",
  restaurant_name: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  business_type: "restaurant",
  existing_pos: "",
  hardware: "",
  outlets: "1",
  message: "",
  consent: false,
  website: "",
};

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const labelClass = "block text-sm font-semibold text-slate-700";

export default function PilotAccessForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<"sent" | "pending" | null>(null);

  const update = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(null);
    setSubmitting(true);
    try {
      const response = await fetch(`${PILOT_API_BASE}/api/pilot-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...form,
          outlets: Number(form.outlets),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "We could not submit your request. Please try again.");
      }
      setSuccess(result.notification_status === "sent" ? "sent" : "pending");
      setForm(INITIAL_FORM);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Order It Up early-access pilot</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">Request pilot access</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          Tell us about your restaurant and current setup. The team will review your requirements and contact you to discuss fit, availability and next steps. Submitting this form does not automatically create an account or grant access.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
        {success && (
          <div role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {success === "sent"
              ? "Your pilot request has been saved and the pilot team has been notified. We will contact you using the details you provided."
              : "Your pilot request has been saved, but the automatic team notification is not configured or could not be sent. Please also email narayaaana11@gmail.com so we can follow up."}
          </div>
        )}
        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Your name *
              <input className={inputClass} name="contact_name" autoComplete="name" required minLength={2} maxLength={100} value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
            </label>
            <label className={labelClass}>
              Restaurant / business name *
              <input className={inputClass} name="restaurant_name" required minLength={2} maxLength={120} value={form.restaurant_name} onChange={(e) => update("restaurant_name", e.target.value)} placeholder="Your restaurant name" />
            </label>
            <label className={labelClass}>
              Business email *
              <input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@business.com" />
            </label>
            <label className={labelClass}>
              Phone / WhatsApp
              <input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={32} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+91 ..." />
            </label>
            <label className={labelClass}>
              City *
              <input className={inputClass} name="city" required minLength={2} maxLength={100} value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="City" />
            </label>
            <label className={labelClass}>
              State / region
              <input className={inputClass} name="state" maxLength={100} value={form.state} onChange={(e) => update("state", e.target.value)} placeholder="State" />
            </label>
            <label className={labelClass}>
              Business type *
              <select className={inputClass} name="business_type" required value={form.business_type} onChange={(e) => update("business_type", e.target.value)}>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Cafe</option>
                <option value="qsr">Quick-service / takeaway</option>
                <option value="bakery">Bakery</option>
                <option value="cloud-kitchen">Cloud kitchen</option>
                <option value="hotel">Hotel / food service</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className={labelClass}>
              Number of outlets *
              <input className={inputClass} name="outlets" type="number" min={1} max={500} step={1} required value={form.outlets} onChange={(e) => update("outlets", e.target.value)} />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              What POS do you use today? *
              <select className={inputClass} name="existing_pos" required value={form.existing_pos} onChange={(e) => update("existing_pos", e.target.value)}>
                <option value="">Select an option</option>
                <option value="No POS / manual billing">No POS / manual billing</option>
                <option value="Excel or spreadsheet">Excel / spreadsheet</option>
                <option value="Other POS software">Another POS software</option>
                <option value="Custom-built system">Custom-built system</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
            <label className={labelClass}>
              Current hardware *
              <input className={inputClass} name="hardware" required maxLength={700} value={form.hardware} onChange={(e) => update("hardware", e.target.value)} placeholder="PC / tablet, printer model, scanner, cash drawer..." />
            </label>
          </div>

          <label className={labelClass}>
            Anything else we should know?
            <textarea className={inputClass + " min-h-28 resize-y"} name="message" maxLength={1500} value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Share your workflow, connectivity or hardware requirements." />
          </label>

          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label>Leave this field empty<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update("website", e.target.value)} /></label>
          </div>

          <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
            <input type="checkbox" required checked={form.consent} onChange={(e) => update("consent", e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
            <span>I agree that the Order It Up pilot team may use these details to review and respond to my pilot request. I have read the <Link className="font-semibold text-orange-700 underline" href="/legal/privacy/">Privacy Policy</Link>.</span>
          </label>

          <button type="submit" disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F07928] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Sending request..." : "Submit pilot request"}
          </button>
          <p className="text-center text-xs leading-5 text-slate-500">
            We will review your details and contact you. This is an enquiry only; no account is created and no payment is taken.
          </p>
        </form>
      </div>
    </section>
  );
}
