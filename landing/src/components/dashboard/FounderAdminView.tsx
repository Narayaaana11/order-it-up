"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getCloudApiBase } from "@/lib/auth";

type MoneyRow = { currency: string; amount: number; amount_minor?: number; orders?: number };
type Overview = {
  generated_at: string;
  tenants: { total: number; active: number; suspended: number; closed: number; trial: number };
  infrastructure: { branches: number; terminals: number; active_users: number };
  last_30_days: { orders: number; gross_merchandise_value_by_currency: MoneyRow[] };
  monthly_recurring_revenue_by_currency: MoneyRow[];
  data_source: string;
};
type Tenant = {
  id: string; name: string; legal_name?: string | null; country: string; currency: string; timezone: string;
  account_status: string; created_at: string; plan_code?: string | null; subscription_status?: string | null;
  billing_cycle?: string | null; subscription_currency?: string | null; amount_minor?: number | null;
  trial_ends_at?: string | null; current_period_end?: string | null; branch_count: number;
  terminal_count: number; active_user_count: number; last_terminal_seen_at?: string | null;
};
type Plan = { code: string; name: string; currency: string; monthly_price: number; yearly_price: number; entitlements: Record<string, unknown>; active: boolean };
type Detail = {
  tenant: Tenant;
  branches: { id: string; code: string; name: string; status: string }[];
  terminals: { id: string; terminal_name: string; last_seen_at?: string | null; app_version?: string | null }[];
  users: { id: string; name: string; email: string; role: string; status: string }[];
};

const TOKEN_KEY = "orderitup_platform_admin_token";
const EMAIL_KEY = "orderitup_platform_admin_email";
const PAGE_SIZE = 25;

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${response.status})`);
  }
  return data;
}
function money(value: number, currency: string): string {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-IN")}`; }
}
function dateLabel(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</article>;
}

export function FounderAdminView() {
  const apiBase = getCloudApiBase();
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem(TOKEN_KEY) || "");
  const [adminEmail, setAdminEmail] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem(EMAIL_KEY) || "");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const request = useCallback(async <T,>(path: string): Promise<T> => {
    const headers = new Headers({ Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${apiBase}${path}`, { method: "GET", headers, credentials: "omit", cache: "no-store" });
    return responseData<T>(res);
  }, [apiBase, token]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (search) params.set("q", search);
      if (status) params.set("status", status);
      if (planCode) params.set("plan", planCode);
      const [metrics, plansData, tenantData] = await Promise.all([
        request<Overview>("/api/platform-admin/overview"),
        request<{ plans: Plan[] }>("/api/platform-admin/plans"),
        request<{ tenants: Tenant[]; pagination: { total: number } }>(`/api/platform-admin/tenants?${params.toString()}`),
      ]);
      setOverview(metrics);
      setPlans(plansData.plans || []);
      setTenants(tenantData.tenants || []);
      setTotal(tenantData.pagination?.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load platform records.";
      setError(message);
      if (/unauthorized/i.test(message)) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(EMAIL_KEY);
        setToken("");
        setAdminEmail("");
      }
    } finally {
      setBusy(false);
    }
  }, [offset, planCode, request, search, status, token]);

  useEffect(() => { if (token) void loadDashboard(); }, [loadDashboard, token]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/platform-admin/login`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), password }), credentials: "omit", cache: "no-store",
      });
      const data = await responseData<{ token: string; admin: { email: string; role: string } }>(res);
      if (!data.token || !data.admin?.email) throw new Error("The platform admin service returned an incomplete session.");
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(EMAIL_KEY, data.admin.email);
      setToken(data.token);
      setAdminEmail(data.admin.email);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Platform administrator sign in failed.");
    } finally { setLoginBusy(false); }
  };

  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(EMAIL_KEY);
    setToken(""); setAdminEmail(""); setOverview(null); setPlans([]); setTenants([]); setSelected(null); setError("");
  };

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setOffset(0); setSearch(searchInput.trim());
  };

  const openTenant = async (id: string) => {
    setSelected(null); setDetailBusy(true); setError("");
    try { setSelected(await request<Detail>(`/api/platform-admin/tenants/${encodeURIComponent(id)}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load organization details."); }
    finally { setDetailBusy(false); }
  };

  const mrr = useMemo(() => overview?.monthly_recurring_revenue_by_currency || [], [overview]);
  const gmv = useMemo(() => overview?.last_30_days.gross_merchandise_value_by_currency || [], [overview]);

  if (!token) {
    return <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Restricted control plane</p><h1 className="mt-1 text-2xl font-extrabold text-slate-950">Platform administrator sign in</h1><p className="mt-2 text-sm leading-6 text-slate-600">This identity is separate from restaurant owner accounts. A provisioned platform administrator is required.</p></div>
      <form onSubmit={handleLogin} className="space-y-4">
        <label className="block text-sm font-semibold text-slate-700">Administrator email<input type="email" required autoComplete="username" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
        <label className="block text-sm font-semibold text-slate-700">Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <button type="submit" disabled={loginBusy} className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{loginBusy ? "Signing in…" : "Sign in to platform admin"}</button>
      </form>
      <p className="mt-4 text-xs leading-5 text-slate-500">The Cloud API must be configured with PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD_HASH and a dedicated PLATFORM_ADMIN_JWT_SECRET. No sample credentials or browser-side fallback is provided.</p>
    </section>;
  }

  return <div className="space-y-6 text-slate-900">
    <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">D1-backed control plane</p><h1 className="mt-1 text-2xl font-extrabold text-slate-950">Platform operations</h1><p className="mt-1 text-sm text-slate-600">Signed in as {adminEmail}. Data is read from Cloudflare D1, not local browser fixtures.</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => void loadDashboard()} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{busy ? "Refreshing…" : "Refresh"}</button><button type="button" onClick={signOut} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Sign out</button></div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!overview && busy && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading verified platform records…</p>}
    {overview && <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Organizations" value={overview.tenants.total} hint={`${overview.tenants.active} active · ${overview.tenants.suspended} suspended`} />
        <Metric label="Trials" value={overview.tenants.trial} hint={`${overview.tenants.closed} closed`} />
        <Metric label="Branches" value={overview.infrastructure.branches} />
        <Metric label="Terminals" value={overview.infrastructure.terminals} hint={`${overview.infrastructure.active_users} active users`} />
        <Metric label="Orders · 30 days" value={overview.last_30_days.orders} />
      </section>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Monthly recurring revenue</h2><p className="mt-1 text-xs text-slate-500">Active subscription snapshots only. Currency groups are not converted.</p><div className="mt-4 space-y-3">{mrr.length ? mrr.map((row) => <div key={row.currency} className="flex justify-between border-b border-slate-100 pb-2 text-sm"><span className="text-slate-600">{row.currency}</span><strong>{money(row.amount, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No active subscription revenue is recorded.</p>}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">GMV · last 30 days</h2><p className="mt-1 text-xs text-slate-500">Non-cancelled synced orders, grouped by original currency.</p><div className="mt-4 space-y-3">{gmv.length ? gmv.map((row) => <div key={row.currency} className="flex justify-between border-b border-slate-100 pb-2"><div><span className="text-sm text-slate-600">{row.currency}</span><p className="text-xs text-slate-500">{row.orders} orders</p></div><strong>{money(row.amount, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No synced sales recorded in this period.</p>}</div></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold">Restaurant organizations</h2><p className="text-xs text-slate-500">{total.toLocaleString("en-IN")} matching organizations</p></div>
          <form onSubmit={applyFilters} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_145px_145px_auto]">
            <input aria-label="Search organizations" placeholder="Search name or ID" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <select aria-label="Account status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select>
            <select aria-label="Subscription plan" value={planCode} onChange={(event) => setPlanCode(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">All plans</option><option value="starter">Starter</option><option value="pro">Professional</option><option value="enterprise">Enterprise</option></select>
            <button type="submit" disabled={busy} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">Search</button>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Organization</th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Subscription</th><th className="px-3 py-3">Branches</th><th className="px-3 py-3">Terminals</th><th className="px-3 py-3">Created</th><th className="px-3 py-3">Details</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{tenants.map((tenant) => <tr key={tenant.id} className="hover:bg-slate-50"><td className="px-3 py-3"><p className="font-semibold">{tenant.name}</p><p className="font-mono text-xs text-slate-500">{tenant.id}</p></td><td className="px-3 py-3 capitalize">{tenant.account_status}</td><td className="px-3 py-3"><span className="capitalize">{tenant.plan_code || "Not assigned"}</span><p className="text-xs capitalize text-slate-500">{tenant.subscription_status || "No subscription record"}</p></td><td className="px-3 py-3 tabular-nums">{tenant.branch_count}</td><td className="px-3 py-3 tabular-nums">{tenant.terminal_count}</td><td className="px-3 py-3">{dateLabel(tenant.created_at)}</td><td className="px-3 py-3"><button type="button" onClick={() => void openTenant(tenant.id)} className="font-semibold text-orange-700 hover:text-orange-900">View</button></td></tr>)}
            {!tenants.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No organizations match these filters.</td></tr>}</tbody></table></div>
        <div className="mt-4 flex items-center justify-between"><p className="text-xs text-slate-500">Showing {tenants.length ? offset + 1 : 0}–{Math.min(offset + tenants.length, total)} of {total}</p><div className="flex gap-2"><button type="button" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={offset + PAGE_SIZE >= total || busy} onClick={() => setOffset(offset + PAGE_SIZE)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button></div></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Published subscription plans</h2><div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">{plans.map((plan) => <article key={plan.code} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><h3 className="font-bold">{plan.name}</h3><span className="text-xs text-emerald-700">{plan.active ? "Active" : "Inactive"}</span></div><p className="mt-2 text-lg font-extrabold">{money(plan.monthly_price, plan.currency)}<span className="text-xs font-normal text-slate-500"> / month</span></p><p className="text-xs text-slate-500">{money(plan.yearly_price, plan.currency)} / year</p><p className="mt-2 text-xs text-slate-600">Maximum terminals: {String(plan.entitlements.maxTerminals ?? "—")}</p></article>)}</div></section>
      <p className="text-xs leading-5 text-slate-500">Read-only control plane. Tenant creation, status changes, subscription grants, license issuance and storage audits are not available until audited server-side workflows are implemented. Updated {dateLabel(overview.generated_at)} · Source: {overview.data_source}.</p>
    </>}
    {detailBusy && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading organization details…</p>}
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="tenant-detail-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Organization detail</p><h2 id="tenant-detail-title" className="mt-1 text-xl font-bold">{selected.tenant.name}</h2><p className="font-mono text-xs text-slate-500">{selected.tenant.id}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Close</button></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Branches" value={selected.branches.length} /><Metric label="Terminals" value={selected.terminals.length} /><Metric label="Users" value={selected.users.length} /><Metric label="Account" value={selected.tenant.account_status} /></div>
      <h3 className="mt-6 font-bold">Branches</h3><ul className="mt-2 divide-y divide-slate-100">{selected.branches.map((branch) => <li key={branch.id} className="py-2 text-sm"><strong>{branch.name}</strong><span className="ml-2 text-xs text-slate-500">{branch.code} · {branch.status}</span></li>)}</ul>
      <h3 className="mt-5 font-bold">Terminals</h3><ul className="mt-2 divide-y divide-slate-100">{selected.terminals.map((terminal) => <li key={terminal.id} className="py-2 text-sm"><strong>{terminal.terminal_name}</strong><span className="ml-2 text-xs text-slate-500">{terminal.last_seen_at ? dateLabel(terminal.last_seen_at) : "Never seen"} · {terminal.app_version || "Unknown version"}</span></li>)}</ul>
      <h3 className="mt-5 font-bold">Users</h3><ul className="mt-2 divide-y divide-slate-100">{selected.users.map((user) => <li key={user.id} className="py-2 text-sm"><strong>{user.name}</strong><span className="ml-2 text-xs text-slate-500">{user.email} · {user.role} · {user.status}</span></li>)}</ul></section></div>}
  </div>;
}
