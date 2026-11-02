"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

type WebhookStatus = "received" | "processed" | "ignored" | "failed";
type WebhookEvent = {
  id: string;
  provider_event_id: string;
  event_type: string;
  provider_order_id?: string | null;
  provider_payment_id?: string | null;
  status: WebhookStatus;
  error_code?: string | null;
  received_at: string;
  processed_at?: string | null;
};

const PAGE_SIZE = 20;

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Request failed (${response.status})`);
  return data;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function statusStyle(status: WebhookStatus): string {
  if (status === "processed") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-800 ring-rose-200";
  if (status === "received") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export default function BillingWebhookEventsPanel({
  apiBase,
  token,
  onSessionExpired,
}: {
  apiBase: string;
  token: string;
  onSessionExpired: () => void;
}) {
  const [items, setItems] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("failed");
  const [offset, setOffset] = useState(0);
  const [retryId, setRetryId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apiRequest = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: "omit", cache: "no-store" });
    try { return await readResponse<T>(response); }
    catch (requestError) {
      if (response.status === 401) onSessionExpired();
      throw requestError;
    }
  }, [apiBase, onSessionExpired, token]);

  const loadEvents = useCallback(async () => {
    setBusy(true);
    setError("");
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (statusFilter) params.set("status", statusFilter);
    try {
      const data = await apiRequest<{ events: WebhookEvent[]; pagination: { total: number } }>(`/api/platform-admin/billing/webhook-events?${params}`);
      setItems(data.events || []);
      setTotal(data.pagination?.total || 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load payment webhook events.");
    } finally { setBusy(false); }
  }, [apiRequest, offset, statusFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => { void loadEvents(); }, 0);
    return () => window.clearTimeout(handle);
  }, [loadEvents]);

  const retryEvent = async (event: WebhookEvent) => {
    if (reason.trim().length < 10) {
      setError("Add an audit reason of at least 10 characters before retrying reconciliation.");
      return;
    }
    setRetryBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/platform-admin/billing/webhook-events/${encodeURIComponent(event.id)}/retry`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setNotice(`Reconciliation completed for event ${event.provider_event_id}. The attempt was recorded in the admin audit log.`);
      setRetryId("");
      setReason("");
      await loadEvents();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Payment reconciliation could not be retried.");
      await loadEvents();
    } finally { setRetryBusy(false); }
  };

  return (
    <section className="space-y-4" aria-labelledby="billing-webhooks-heading">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-700"><AlertCircle className="h-4 w-4" /> Billing operations</p>
          <h2 id="billing-webhooks-heading" className="mt-1 text-lg font-extrabold text-slate-950">Payment webhook events</h2>
          <p className="mt-1 text-xs text-slate-500">Provider event IDs and payment references only; raw payloads and customer details are not stored.</p>
        </div>
        <button type="button" onClick={() => void loadEvents()} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 sm:self-auto"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh</button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">Status
          <select value={statusFilter} onChange={(event) => { setOffset(0); setStatusFilter(event.target.value); }} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal">
            <option value="failed">Failed</option><option value="received">Received</option><option value="processed">Processed</option><option value="ignored">Ignored</option><option value="">All events</option>
          </select>
        </label>
        <p className="text-xs text-slate-500">{total.toLocaleString("en-IN")} matching event{total === 1 ? "" : "s"}</p>
      </div>

      <div className="space-y-3" aria-live="polite">
        {busy && items.length === 0 && <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading verified webhook events…</p>}
        {!busy && items.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No events match this filter.</p>}
        {items.map((item) => <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="break-all font-mono text-sm font-bold text-slate-900">{item.provider_event_id}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1 ring-inset ${statusStyle(item.status)}`}>{item.status}</span></div>
              <p className="mt-1 text-xs text-slate-600">{item.event_type} · received {formatDate(item.received_at)}</p>
              <div className="mt-3 grid gap-x-5 gap-y-1 text-xs text-slate-500 sm:grid-cols-2"><p>Order: <span className="break-all font-mono text-slate-700">{item.provider_order_id || "Not linked"}</span></p><p>Payment: <span className="break-all font-mono text-slate-700">{item.provider_payment_id || "Not linked"}</span></p>{item.error_code && <p className="sm:col-span-2">Failure code: <span className="font-mono text-rose-700">{item.error_code}</span></p>}{item.processed_at && <p>Processed: {formatDate(item.processed_at)}</p>}</div>
            </div>
            {(["failed", "received"].includes(item.status) && item.provider_order_id && item.provider_payment_id) && <button type="button" onClick={() => { setRetryId(retryId === item.id ? "" : item.id); setError(""); setNotice(""); }} className="min-h-10 shrink-0 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700">{retryId === item.id ? "Cancel retry" : "Retry verification"}</button>}
          </div>
          {retryId === item.id && <form onSubmit={(event) => { event.preventDefault(); void retryEvent(item); }} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-xs font-semibold text-slate-700">Audit reason <span className="font-normal text-slate-500">(10–500 characters)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} required rows={2} placeholder="Describe why this payment reconciliation is being retried." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
            <button type="submit" disabled={retryBusy} className="min-h-10 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">{retryBusy ? "Checking provider…" : "Confirm retry"}</button>
          </form>}
        </article>)}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
        <span>{total ? `${offset + 1}–${Math.min(offset + items.length, total)} of ${total}` : "0 events"}</span>
        <div className="flex gap-2"><button type="button" disabled={offset === 0 || busy} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={offset + PAGE_SIZE >= total || busy} onClick={() => setOffset((value) => value + PAGE_SIZE)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Next</button></div>
      </div>
    </section>
  );
}
