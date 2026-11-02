"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Mail, Phone, RefreshCw, Search, X } from "lucide-react";

type RequestStatus = "new" | "reviewing" | "contacted" | "approved" | "declined" | "closed";
type PilotRequest = {
  id: string;
  contact_name: string;
  restaurant_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  country: string;
  restaurant_type: string;
  outlet_count: number;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
};
type PilotRequestDetail = PilotRequest & {
  current_pos?: string | null;
  message?: string | null;
  consent_at: string;
  admin_notes: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

const PAGE_SIZE = 20;
const statuses: RequestStatus[] = ["new", "reviewing", "contacted", "approved", "declined", "closed"];

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Request failed (${response.status})`);
  return data;
}

function dateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function statusClasses(status: RequestStatus): string {
  if (status === "new") return "bg-orange-50 text-orange-800 ring-orange-200";
  if (status === "approved") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "declined" || status === "closed") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-blue-50 text-blue-800 ring-blue-200";
}

export default function PilotRequestsPanel({
  apiBase,
  token,
  onSessionExpired,
}: {
  apiBase: string;
  token: string;
  onSessionExpired: () => void;
}) {
  const [items, setItems] = useState<PilotRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PilotRequestDetail | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus>("new");
  const [adminNotes, setAdminNotes] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const apiRequest = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers,
      credentials: "omit",
      cache: "no-store",
    });
    try {
      return await readResponse<T>(response);
    } catch (requestError) {
      if (response.status === 401) onSessionExpired();
      throw requestError;
    }
  }, [apiBase, onSessionExpired, token]);

  const loadRequests = useCallback(async () => {
    setBusy(true);
    setError("");
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (query) params.set("q", query);
    if (filterStatus) params.set("status", filterStatus);
    try {
      const data = await apiRequest<{ requests: PilotRequest[]; pagination: { total: number } }>(`/api/platform-admin/pilot-requests?${params.toString()}`);
      setItems(data.requests || []);
      setTotal(data.pagination?.total || 0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load pilot requests.");
    } finally {
      setBusy(false);
    }
  }, [apiRequest, filterStatus, offset, query]);

  useEffect(() => {
    const handle = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(handle);
  }, [loadRequests]);

  const openRequest = async (id: string) => {
    setSelected(null);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ request: PilotRequestDetail }>(`/api/platform-admin/pilot-requests/${encodeURIComponent(id)}`);
      setSelected(data.request);
      setSelectedStatus(data.request.status);
      setAdminNotes(data.request.admin_notes || "");
      setAuditReason("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load the request details.");
    }
  };

  const saveRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || auditReason.trim().length < 10) {
      setError("Enter an audit reason of at least 10 characters before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await apiRequest<{ request: PilotRequestDetail }>(`/api/platform-admin/pilot-requests/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: selectedStatus, admin_notes: adminNotes.trim(), reason: auditReason.trim() }),
      });
      setSelected({ ...selected, ...data.request });
      setMessage("Request updated. The change was recorded in the platform audit log.");
      setAuditReason("");
      await loadRequests();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOffset(0);
    setQuery(queryInput.trim());
  };

  return (
    <section className="space-y-4" aria-labelledby="pilot-requests-heading">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 id="pilot-requests-heading" className="text-lg font-extrabold text-slate-950">Pilot access requests</h2>
          <p className="mt-1 text-xs text-slate-500">Private contact details from the public request form · {total.toLocaleString("en-IN")} matching requests</p>
        </div>
        <button type="button" onClick={() => void loadRequests()} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 sm:self-auto"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh inbox</button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <form onSubmit={applySearch} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
            <label className="relative block"><span className="sr-only">Search pilot requests</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name, restaurant, email or city" className="min-h-10 w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm" /></label>
            <label><span className="sr-only">Filter by request status</span><select value={filterStatus} onChange={(event) => { setOffset(0); setFilterStatus(event.target.value); }} className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
            <button type="submit" disabled={busy} className="min-h-10 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">Search</button>
          </form>

          <div className="mt-4 space-y-2" aria-live="polite">
            {busy && items.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading requests from D1…</p>}
            {!busy && items.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No requests match these filters.</p>}
            {items.map((item) => (
              <button type="button" key={item.id} onClick={() => void openRequest(item.id)} aria-pressed={selected?.id === item.id} className={`block w-full rounded-xl border p-3 text-left transition hover:border-orange-300 hover:bg-orange-50/40 ${selected?.id === item.id ? "border-orange-400 bg-orange-50/60" : "border-slate-200 bg-white"}`}>
                <span className="flex flex-wrap items-start justify-between gap-2"><strong className="min-w-0 break-words text-sm text-slate-900">{item.restaurant_name}</strong><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1 ring-inset ${statusClasses(item.status)}`}>{item.status}</span></span>
                <span className="mt-1 block break-words text-xs text-slate-600">{item.contact_name} · {item.email}</span>
                <span className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500"><span>{[item.city, item.country].filter(Boolean).join(", ") || "Location not provided"} · {item.outlet_count} outlet{item.outlet_count === 1 ? "" : "s"}</span><span>{dateTime(item.created_at)}</span></span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>{total ? `${offset + 1}–${Math.min(offset + items.length, total)} of ${total}` : "0 requests"}</span>
            <div className="flex gap-2"><button type="button" disabled={offset === 0 || busy} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={offset + PAGE_SIZE >= total || busy} onClick={() => setOffset((value) => value + PAGE_SIZE)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button></div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          {!selected && <div className="flex min-h-44 items-center justify-center text-center text-sm leading-6 text-slate-500">Select a request to review the restaurant details, respond, and update its status.</div>}
          {selected && <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Request details</p><h3 className="mt-1 break-words text-xl font-extrabold text-slate-950">{selected.restaurant_name}</h3><p className="mt-1 text-xs text-slate-500">Received {dateTime(selected.created_at)}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close selected request" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button></div>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Contact</dt><dd className="mt-0.5 break-words font-semibold text-slate-800">{selected.contact_name}</dd></div>
              <div><dt className="text-xs text-slate-500">Business type</dt><dd className="mt-0.5 capitalize text-slate-800">{selected.restaurant_type}</dd></div>
              <div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-0.5 break-words"><a className="inline-flex items-center gap-1.5 font-semibold text-orange-700 underline underline-offset-2" href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent("Order It Up pilot access")}`}><Mail className="h-3.5 w-3.5 shrink-0" />{selected.email}</a></dd></div>
              <div><dt className="text-xs text-slate-500">Phone</dt><dd className="mt-0.5 break-words">{selected.phone ? <a className="inline-flex items-center gap-1.5 font-semibold text-orange-700 underline underline-offset-2" href={`tel:${selected.phone}`}><Phone className="h-3.5 w-3.5" />{selected.phone}</a> : "Not provided"}</dd></div>
              <div><dt className="text-xs text-slate-500">Location</dt><dd className="mt-0.5">{[selected.city, selected.country].filter(Boolean).join(", ") || "Not provided"}</dd></div>
              <div><dt className="text-xs text-slate-500">Outlets</dt><dd className="mt-0.5">{selected.outlet_count}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Current POS</dt><dd className="mt-0.5 break-words">{selected.current_pos || "Not provided"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">What they want to evaluate</dt><dd className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 leading-6 text-slate-700">{selected.message || "No message added."}</dd></div>
            </dl>
            <form onSubmit={saveRequest} className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <label className="block text-sm font-semibold text-slate-700">Review status<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as RequestStatus)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm capitalize">{statuses.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-700">Internal notes<textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} maxLength={2000} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal" placeholder="Private notes for the platform team" /></label>
              <label className="block text-sm font-semibold text-slate-700">Audit reason<textarea value={auditReason} onChange={(event) => setAuditReason(event.target.value)} minLength={10} maxLength={500} required rows={2} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal" placeholder="Why is this request being updated?" /></label>
              <button type="submit" disabled={saving} className="min-h-11 w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{saving ? "Saving review…" : "Save review and status"}</button>
            </form>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">Approving a request records the review decision only. It does not create an account or send an invitation email.</p>
          </>}
        </div>
      </div>
    </section>
  );
}
