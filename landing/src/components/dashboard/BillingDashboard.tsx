"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  ArrowRight,
  Download,
  RefreshCw,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { getStoredUser, getCloudApiBase } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanConfig {
  code: string;
  name: string;
  badge: string;
  monthlyMinor: number;
  yearlyMinor: number;
  popular: boolean;
  features: { text: string; included: boolean }[];
}

interface SubscriptionState {
  plan: string;
  plan_name: string | null;
  status: string;
  billing_cycle: string | null;
  amount_minor: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_end: string | null;
  cancel_at_period_end: boolean;
  entitlements: Record<string, unknown>;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  plan_code: string;
  billing_cycle: string;
  total_amount_minor: number;
  currency: string;
  payment_order_id: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLANS: PlanConfig[] = [
  {
    code: "starter",
    name: "Starter",
    badge: "Solo Counters & Cafes",
    monthlyMinor: 49900,
    yearlyMinor: 499000,
    popular: false,
    features: [
      { text: "1 POS Terminal", included: true },
      { text: "Core billing & thermal printing", included: true },
      { text: "Local SQLite offline storage", included: true },
      { text: "Kitchen Display System (KDS)", included: false },
      { text: "Cloud sync & multi-device", included: false },
      { text: "WhatsApp digital receipts", included: false },
    ],
  },
  {
    code: "pro",
    name: "Professional",
    badge: "Most Popular — Dine-in & QSR",
    monthlyMinor: 149900,
    yearlyMinor: 1499000,
    popular: true,
    features: [
      { text: "Up to 3 POS & Waiter terminals", included: true },
      { text: "Kitchen Display System (KDS)", included: true },
      { text: "Cloud HQ sync & multi-device", included: true },
      { text: "WhatsApp digital receipts", included: true },
      { text: "Advanced reports & analytics", included: true },
      { text: "Multi-outlet central management", included: false },
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    badge: "Chains & Multi-Outlet",
    monthlyMinor: 399900,
    yearlyMinor: 3999000,
    popular: false,
    features: [
      { text: "Unlimited terminals across outlets", included: true },
      { text: "Multi-outlet catalog & price overrides", included: true },
      { text: "Inter-branch inventory transfers", included: true },
      { text: "Offline Ed25519 asymmetric license", included: true },
      { text: "Custom tax packs & compliance", included: true },
      { text: "24/7 Priority support & deployment SLA", included: true },
    ],
  },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-300",
  trial: "bg-blue-100 text-blue-800 border-blue-300",
  grace_period: "bg-amber-100 text-amber-800 border-amber-300",
  past_due: "bg-orange-100 text-orange-800 border-orange-300",
  suspended: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-slate-100 text-slate-600 border-slate-300",
  expired: "bg-red-100 text-red-800 border-red-300",
  legacy: "bg-purple-100 text-purple-800 border-purple-300",
};

function minorToRupees(minor: number): string {
  return "₹" + (minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysRemaining(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

// ── Status Banner ─────────────────────────────────────────────────────────────

function StatusBanner({ sub }: { sub: SubscriptionState }) {
  const statusClass = STATUS_COLORS[sub.status] ?? "bg-slate-100 text-slate-600 border-slate-300";
  const renewalDate =
    sub.status === "trial" ? sub.trial_ends_at :
    sub.status === "grace_period" ? sub.grace_period_end :
    sub.current_period_end;
  const days = daysRemaining(renewalDate);

  const icon =
    sub.status === "active" ? <CheckCircle2 className="w-4 h-4" /> :
    sub.status === "trial" ? <Clock className="w-4 h-4" /> :
    <AlertTriangle className="w-4 h-4" />;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${statusClass} mb-6`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="text-sm">
        <p className="font-bold capitalize">{sub.status.replace("_", " ")} — {sub.plan_name ?? sub.plan}</p>
        {renewalDate && (
          <p className="text-xs mt-0.5 opacity-80">
            {sub.status === "trial" ? "Trial ends" :
             sub.status === "grace_period" ? "Grace period ends" :
             sub.status === "active" && sub.cancel_at_period_end ? "Cancels" : "Renews"}
            {" "}on {formatDate(renewalDate)} ({days} days remaining)
          </p>
        )}
        {(sub.status === "grace_period") && (
          <p className="text-xs mt-1 font-semibold">
            ⚠ Your POS will be locked when the grace period ends. Renew now to avoid interruption.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Plan Cards ────────────────────────────────────────────────────────────────

function PlanCards({
  currentPlan,
  billingCycle,
  onUpgrade,
  loading,
}: {
  currentPlan: string;
  billingCycle: "monthly" | "yearly";
  onUpgrade: (planCode: string, cycle: "monthly" | "yearly") => void;
  loading: string | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
      {PLANS.map((plan) => {
        const price = billingCycle === "yearly" ? plan.yearlyMinor : plan.monthlyMinor;
        const isCurrent = currentPlan === plan.code;
        const isLoading = loading === plan.code;

        return (
          <div
            key={plan.code}
            className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
              plan.popular
                ? "border-orange-400 shadow-lg bg-gradient-to-b from-orange-50/60 to-white"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            } ${isCurrent ? "ring-2 ring-orange-500" : ""}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 fill-white" /> Most Popular
              </div>
            )}
            {isCurrent && (
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase rounded-full border border-orange-200">
                Current
              </div>
            )}

            <div className="mb-3">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{plan.badge}</p>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">{plan.name}</h3>
            </div>

            <div className="mb-4 pb-4 border-b border-slate-100">
              <span className="text-3xl font-black text-slate-900">{minorToRupees(price)}</span>
              <span className="text-xs text-slate-500 ml-1">/{billingCycle === "yearly" ? "year" : "month"}</span>
              {billingCycle === "yearly" && (
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  ≈ {minorToRupees(Math.round(price / 12))}/mo · 2 months free
                </p>
              )}
            </div>

            <ul className="space-y-2 text-xs mb-6 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  {f.included
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                  <span className={f.included ? "text-slate-700 font-medium" : "text-slate-400 line-through"}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={isCurrent || isLoading}
              onClick={() => onUpgrade(plan.code, billingCycle)}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                isCurrent
                  ? "bg-slate-100 text-slate-400 cursor-default"
                  : plan.popular
                  ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/20 shadow-md"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isCurrent ? (
                "Current Plan"
              ) : (
                <>
                  {plan.code === "enterprise" ? "Contact Sales" : `Switch to ${plan.name}`}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Invoice Table ─────────────────────────────────────────────────────────────

function InvoiceTable({
  invoices,
  cloudBaseUrl,
  token,
}: {
  invoices: InvoiceRow[];
  cloudBaseUrl: string;
  token: string | null;
}) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        No invoices yet. Payments appear here after checkout completes.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {["Invoice #", "Date", "Plan", "Cycle", "Amount", ""].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-4 py-3 font-mono text-slate-700">{inv.invoice_number}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(inv.invoice_date)}</td>
              <td className="px-4 py-3 capitalize text-slate-700 font-medium">{inv.plan_code}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{inv.billing_cycle}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {minorToRupees(inv.total_amount_minor)}
                <span className="text-slate-400 font-normal ml-1 text-[10px]">incl. 18% GST</span>
              </td>
              <td className="px-4 py-3">
                <a
                  href={`${cloudBaseUrl}/api/subscription/invoices/${inv.payment_order_id}`}
                  download={`${inv.invoice_number}.html`}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                  onClick={(e) => {
                    // Attach auth header via fetch for download
                    if (token) {
                      e.preventDefault();
                      fetch(`${cloudBaseUrl}/api/subscription/invoices/${inv.payment_order_id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      })
                        .then((r) => r.blob())
                        .then((blob) => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${inv.invoice_number}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        });
                    }
                  }}
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main BillingDashboard ─────────────────────────────────────────────────────

export function BillingDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    const syncAuth = () => {
      const user = getStoredUser();
      setToken(user?.token ?? null);
      setBaseUrl(getCloudApiBase());
    };
    syncAuth();
    window.addEventListener("orderitup_auth_change", syncAuth);
    return () => window.removeEventListener("orderitup_auth_change", syncAuth);
  }, []);

  const fetchSubscription = useCallback(async () => {
    if (!token || !baseUrl) return;
    setSubLoading(true);
    try {
      const r = await fetch(`${baseUrl}/api/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSub(data.subscription);
    } catch (e) {
      setError("Could not load subscription status. Check your connection.");
    } finally {
      setSubLoading(false);
    }
  }, [token, baseUrl]);

  const fetchInvoices = useCallback(async () => {
    if (!token || !baseUrl) return;
    try {
      const r = await fetch(`${baseUrl}/api/subscription/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setInvoices(data.invoices ?? []);
    } catch {
      // Non-fatal
    }
  }, [token, baseUrl]);

  useEffect(() => {
    void fetchSubscription();
    void fetchInvoices();
  }, [fetchSubscription, fetchInvoices]);

  const handleUpgrade = useCallback(
    async (planCode: string, cycle: "monthly" | "yearly") => {
      if (planCode === "enterprise") {
        window.open("/request-access?plan=enterprise", "_blank");
        return;
      }
      if (!token || !baseUrl) {
        setError("Please sign in to manage your subscription.");
        return;
      }
      setUpgradeLoading(planCode);
      setError(null);
      try {
        const idempotencyKey = crypto.randomUUID();
        const orderRes = await fetch(`${baseUrl}/api/subscription/create-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ plan_code: planCode, billing_cycle: cycle }),
        });
        if (!orderRes.ok) {
          const err = await orderRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Order creation failed (${orderRes.status})`);
        }
        const { order } = await orderRes.json();

        // Load Razorpay checkout script dynamically
        await new Promise<void>((resolve, reject) => {
          if ((window as any).Razorpay) { resolve(); return; }
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
          document.head.appendChild(script);
        });

        await new Promise<void>((resolve, reject) => {
          const rzp = new (window as any).Razorpay({
            key: order.key_id,
            amount: order.amount,
            currency: "INR",
            order_id: order.id,
            name: "Order It Up",
            description: `${planCode.charAt(0).toUpperCase() + planCode.slice(1)} Plan — ${cycle}`,
            theme: { color: "#ea580c" },
            modal: { ondismiss: () => resolve() },
            handler: async ({
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
            }: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              try {
                const verifyRes = await fetch(`${baseUrl}/api/subscription/verify-payment`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    order_id: razorpay_order_id,
                    payment_id: razorpay_payment_id,
                    signature: razorpay_signature,
                  }),
                });
                if (!verifyRes.ok) {
                  const err = await verifyRes.json().catch(() => ({}));
                  throw new Error(err.error ?? "Payment verification failed");
                }
                await fetchSubscription();
                await fetchInvoices();
                resolve();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Payment verification failed");
                reject(e);
              }
            },
          });
          rzp.on("payment.failed", (response: any) => {
            setError(`Payment failed: ${response?.error?.description ?? "Unknown error"}`);
            resolve();
          });
          rzp.open();
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unexpected error occurred");
      } finally {
        setUpgradeLoading(null);
      }
    },
    [token, baseUrl, fetchSubscription, fetchInvoices]
  );

  if (!token) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-8">
        <ShieldCheck className="w-12 h-12 text-orange-500" />
        <h2 className="text-xl font-black text-slate-900">Sign In Required</h2>
        <p className="text-sm text-slate-600 max-w-xs">
          Please sign in to your Order It Up account to manage your subscription and billing.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-orange-600" />
          <h1 className="text-2xl font-black text-slate-900">Subscription & Billing</h1>
        </div>
        <p className="text-sm text-slate-500">
          Manage your Order It Up plan, upgrade or downgrade, and download GST invoices.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Status Banner */}
      {subLoading ? (
        <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
      ) : sub ? (
        <StatusBanner sub={sub} />
      ) : null}

      {/* Plan Selector */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-black text-slate-900">Choose a Plan</h2>
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  billingCycle === cycle
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {cycle === "monthly" ? "Monthly" : (
                  <span className="flex items-center gap-1.5">
                    Annual
                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full">
                      SAVE 17%
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <PlanCards
          currentPlan={sub?.plan ?? ""}
          billingCycle={billingCycle}
          onUpgrade={handleUpgrade}
          loading={upgradeLoading}
        />
      </section>

      {/* Invoice History */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-slate-900">Tax Invoices</h2>
          <span className="text-xs text-slate-500">All amounts include 18% GST</span>
        </div>
        <InvoiceTable invoices={invoices} cloudBaseUrl={baseUrl} token={token ?? null} />
      </section>

      {/* Air-Gapped Licensing Banner */}
      <section className="rounded-2xl bg-slate-900 text-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-orange-400 text-[10px] font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3 h-3" /> Offline / Air-Gapped Licensing
            </div>
            <h3 className="text-base font-black">Need an offline cryptographic license?</h3>
            <p className="text-xs text-slate-300 mt-1">
              Activate unlimited terminals without internet using our Ed25519 signed OIU2 license tokens.
            </p>
          </div>
          <a
            href="/request-access?type=airgapped"
            className="shrink-0 px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Request Air-Gapped Key
          </a>
        </div>
      </section>
    </div>
  );
}
