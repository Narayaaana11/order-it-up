"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ChefHat, CircleDollarSign, LoaderCircle, RefreshCw, Store, Utensils } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getCloudApiBase, setStoredUser } from "@/lib/auth";

type Branch = { id: string; name: string; status?: string };
type Product = { id: string; name: string; category_name?: string; base_price: number; tax_rate?: number; is_active?: number; addon_groups?: AddonGroup[] };
type AddonGroup = { id: string; name: string; is_required?: number; min_selection?: number; max_selection?: number; allow_multiple_quantities?: number; addons?: { id: string; name: string; price: number; is_active?: number }[] };
type Table = { id: string; table_number: string; status: string; capacity?: number };
type Order = { id: string; order_number: string; order_type: string; status: string; version?: number; kitchen_status?: string; payment_status: string; grand_total: number; ordered_at: string; table_number?: string | null; items?: { product_name: string; quantity: number; modifiers?: { name: string; quantity?: number }[] }[] };
type Ticket = { id: string; order_id: string; order_number: string; status: string; station?: string; items: { name?: string; product_name?: string; quantity?: number }[]; created_at: string };
type DraftLine = { product_id: string; quantity: number; modifiers: { id: string; quantity: number }[] };
type PendingOrder = { id: string; payload: Record<string, unknown> };

async function cloudRequest<T>(user: AuthUser, path: string, init: RequestInit = {}): Promise<T> {
  if (!user.token) throw new Error("This demo preview does not have a live Cloud API session.");
  const response = await fetch(`${getCloudApiBase()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${user.token}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (response.status === 401) {
    setStoredUser(null);
    window.dispatchEvent(new Event("orderitup_cloud_session_expired"));
    throw new Error("Your Cloud session expired. Sign in again to continue.");
  }
  if (!response.ok) throw new Error(data.error || `Cloud request failed (${response.status}).`);
  return data;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The Cloud request could not be completed.";
}

export function CloudOperationsWorkspace({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [taxRows, setTaxRows] = useState<Record<string, unknown>[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState<"takeaway" | "dine_in">("takeaway");
  const [tableId, setTableId] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const role = user.role.toLowerCase();
  const isWaiter = role === "server" || role === "waiter" || role === "cashier" || role === "owner" || role === "manager";
  const isKitchen = role === "chef" || role === "kitchen" || role === "owner" || role === "manager";
  const isCashier = role === "cashier" || role === "owner" || role === "manager";
  const isAccountant = role === "accountant";
  const selectedProduct = products.find((product) => product.id === productId);

  useEffect(() => {
    const expireSession = () => router.replace("/");
    window.addEventListener("orderitup_cloud_session_expired", expireSession);
    return () => window.removeEventListener("orderitup_cloud_session_expired", expireSession);
  }, [router]);

  const loadBranches = useCallback(async () => {
    const result = await cloudRequest<{ branches?: Branch[] }>(user, "/api/branches");
    const list = result.branches || [];
    setBranches(list);
    setBranchId((current) => current && list.some((branch) => branch.id === current) ? current : list[0]?.id || "");
  }, [user]);

  const refreshBranch = useCallback(async (id: string) => {
    if (!id) return;
    if (isWaiter || isCashier || isKitchen) {
      const [ordersResult, tablesResult] = await Promise.all([
        cloudRequest<{ orders?: Order[] }>(user, `/api/orders?branch_id=${encodeURIComponent(id)}&status=active&limit=50`),
        cloudRequest<{ tables?: Table[] }>(user, `/api/tables?branch_id=${encodeURIComponent(id)}`),
      ]);
      setOrders(ordersResult.orders || []);
      setTables(tablesResult.tables || []);
    } else {
      setOrders([]);
      setTables([]);
    }
    if (isKitchen) {
      const ticketsResult = await cloudRequest<{ tickets?: Ticket[] }>(user, `/api/kitchen/tickets?branch_id=${encodeURIComponent(id)}`);
      setTickets(ticketsResult.tickets || []);
    }
    if (isAccountant) {
      const taxResult = await cloudRequest<{ tax_by_branch?: Record<string, unknown>[] }>(user, "/api/accountant/tax-summary");
      setTaxRows(taxResult.tax_by_branch || []);
    }
  }, [isAccountant, isCashier, isKitchen, isWaiter, user]);

  const loadCatalog = useCallback(async (id: string) => {
    if (!id || !isWaiter) return;
    const [masterResult, branchResult] = await Promise.all([
      cloudRequest<{ products?: Product[] }>(user, "/api/catalog/master"),
      cloudRequest<{ catalog?: Record<string, unknown>[] }>(user, `/api/catalog/branch/${encodeURIComponent(id)}`),
    ]);
    const effective = new Map((branchResult.catalog || []).map((item) => [String(item.id), item]));
    const available = (masterResult.products || []).filter((product) => {
      const branchItem = effective.get(product.id);
      return Number(product.is_active ?? 1) === 1 && Number(branchItem?.is_available ?? 1) === 1;
    }).map((product) => ({ ...product, base_price: Number(effective.get(product.id)?.effective_price ?? product.base_price) }));
    setProducts(available);
    setProductId((current) => current && available.some((item) => item.id === current) ? current : available[0]?.id || "");
  }, [isWaiter, user]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      if (!branches.length) await loadBranches();
      if (branchId) await Promise.all([refreshBranch(branchId), loadCatalog(branchId)]);
    } catch (loadError) {
      setError(message(loadError));
    } finally {
      setLoading(false);
    }
  }, [branchId, branches.length, loadBranches, loadCatalog, refreshBranch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBranches().catch((loadError) => setError(message(loadError))).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBranches]);
  useEffect(() => {
    if (!branchId) return;
    const timer = window.setTimeout(() => {
      setPendingOrder(null);
      setDraft([]);
      const storageKey = `orderitup.pending-order:${user.id}:${branchId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const attempt = JSON.parse(stored) as PendingOrder;
          if (attempt.id && attempt.payload?.id && Array.isArray(attempt.payload.items)) {
            setPendingOrder(attempt);
            setDraft(attempt.payload.items as DraftLine[]);
          }
        } catch { localStorage.removeItem(storageKey); }
      }
      setLoading(true);
      void Promise.all([refreshBranch(branchId), loadCatalog(branchId)])
        .catch((loadError) => setError(message(loadError)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [branchId, loadCatalog, refreshBranch, user.id]);
  useEffect(() => {
    if (!branchId) return;
    const interval = window.setInterval(() => void refreshBranch(branchId).catch((loadError) => setError(message(loadError))), 15000);
    return () => window.clearInterval(interval);
  }, [branchId, refreshBranch]);

  const addDraftLine = () => {
    if (!selectedProduct) return;
    const addons = selectedProduct.addon_groups || [];
    const modifiers: DraftLine["modifiers"] = [];
    for (const group of addons) {
      const selected = selectedAddons[group.id] || [];
      const minimum = Math.max(Number(group.min_selection) || 0, Number(group.is_required) ? 1 : 0);
      if (selected.length < minimum || selected.length > Number(group.max_selection ?? 1)) {
        setError(`Choose between ${minimum} and ${Number(group.max_selection ?? 1)} options from ${group.name}.`);
        return;
      }
      modifiers.push(...selected.map((id) => ({ id, quantity: 1 })));
    }
    setDraft((current) => [...current, { product_id: selectedProduct.id, quantity: Math.max(1, quantity), modifiers }]);
    setSelectedAddons({});
    setError("");
  };

  const submitOrder = async () => {
    if (!branchId || draft.length === 0) return;
    if (orderType === "dine_in" && !tableId) { setError("Choose an available table for a dine-in order."); return; }
    const orderId = crypto.randomUUID();
    const saved = pendingOrder || {
      id: orderId,
      payload: {
        id: orderId,
        branch_id: branchId,
        order_type: orderType,
        table_id: tableId || undefined,
        items: draft,
      },
    };
    const id = String(saved.payload.id || saved.id);
    const attempt = { ...saved, id };
    setPendingOrder(attempt);
    try { localStorage.setItem(`orderitup.pending-order:${user.id}:${branchId}`, JSON.stringify(attempt)); } catch { /* The order remains in memory for this session. */ }
    setBusy(true);
    setError("");
    try {
      const result = await cloudRequest<{ order?: Order }>(user, "/api/orders", { method: "POST", body: JSON.stringify(attempt.payload) });
      if (!result.order?.id) throw new Error("Cloud did not confirm the order. It remains available for a safe retry.");
      localStorage.removeItem(`orderitup.pending-order:${user.id}:${branchId}`);
      setPendingOrder(null);
      setDraft([]);
      setTableId("");
      setNotice(`Order ${result.order.order_number} was accepted by Cloud and sent to the kitchen.`);
      await refreshBranch(branchId);
    } catch (submitError) { setError(message(submitError)); }
    finally { setBusy(false); }
  };

  const updateTicket = async (ticket: Ticket, status: "preparing" | "ready" | "completed") => {
    setBusy(true);
    try {
      await cloudRequest(user, `/api/kitchen/tickets/${encodeURIComponent(ticket.id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refreshBranch(branchId);
      setNotice(`Ticket for ${ticket.order_number} moved to ${status}.`);
    } catch (ticketError) { setError(message(ticketError)); }
    finally { setBusy(false); }
  };

  const collectCash = async (order: Order) => {
    setBusy(true);
    try {
      const summary = await cloudRequest<{ outstanding_balance: number }>(user, `/api/orders/${encodeURIComponent(order.id)}/payments`);
      const amount = Number(summary.outstanding_balance);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("This order has no outstanding balance.");
      if (!window.confirm(`Record ₹${amount.toFixed(2)} cash for ${order.order_number}?`)) return;
      const key = `orderitup.cloud-payment:${user.id}:${order.id}`;
      let idempotencyKey = localStorage.getItem(key);
      if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); localStorage.setItem(key, idempotencyKey); }
      const payment = await cloudRequest<{ outstanding_balance: number; order_version: number }>(user, `/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount, payment_method: "cash", idempotency_key: idempotencyKey }),
      });
      if (payment.outstanding_balance <= 0.05) {
        await cloudRequest(user, `/api/orders/${encodeURIComponent(order.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: "completed", expected_version: payment.order_version }) });
      }
      localStorage.removeItem(key);
      await refreshBranch(branchId);
      setNotice(`Cash transaction recorded for ${order.order_number}.`);
    } catch (paymentError) {
      await refreshBranch(branchId).catch(() => undefined);
      setError(message(paymentError));
    } finally { setBusy(false); }
  };

  const closePaidOrder = async (order: Order) => {
    setBusy(true);
    try {
      await cloudRequest(user, `/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed", ...(typeof order.version === "number" ? { expected_version: order.version } : {}) }),
      });
      localStorage.removeItem(`orderitup.cloud-payment:${user.id}:${order.id}`);
      await refreshBranch(branchId);
      setNotice(`Paid order ${order.order_number} is now closed.`);
    } catch (closeError) { setError(message(closeError)); }
    finally { setBusy(false); }
  };

  const roleTitle = useMemo(() => ({
    owner: "Owner / manager",
    manager: "Owner / manager",
    cashier: "Cashier",
    server: "Waiter / server",
    waiter: "Waiter / server",
    chef: "Kitchen",
    kitchen: "Kitchen",
    accountant: "Accountant",
    delivery: "Delivery",
    super_admin: "Platform administrator",
  }[role] || user.role), [role, user.role]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-700"><Store size={20} /></span><div className="min-w-0"><h1 className="truncate text-base font-black">Live restaurant operations</h1><p className="truncate text-xs text-slate-500">{user.organizationName || user.email} · {roleTitle} · Cloud synchronized</p></div></div>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm"><span className="sr-only">Branch</span><select aria-label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} className="max-w-52 bg-transparent px-1 outline-none"><option value="">Choose branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <button type="button" onClick={() => void refresh()} disabled={loading || busy} aria-label="Refresh live data" className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
          <button type="button" onClick={onSignOut} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Sign out</button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><strong>Live data.</strong> This view reads and writes through your authenticated Cloud account. Amounts, permissions, and order transitions are checked by Cloud.</div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{notice}</div>}
        {loading && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} />Loading authorized branch data…</div>}
        {!loading && !branches.length && <div className="rounded-xl border border-amber-200 bg-white p-6"><h2 className="font-bold">No authorized active branch</h2><p className="mt-1 text-sm text-slate-600">Ask an organization owner to assign this account to an active branch.</p></div>}

        {!loading && branchId && <>
          {(role === "owner" || role === "manager") && <section className="grid gap-3 sm:grid-cols-3"><Metric label="Active orders" value={orders.length} icon={<Activity size={18} />} /><Metric label="Unpaid orders" value={orders.filter((order) => order.payment_status !== "paid").length} icon={<CircleDollarSign size={18} />} /><Metric label="Occupied tables" value={tables.filter((table) => table.status === "occupied").length} icon={<Utensils size={18} />} /></section>}

          {isWaiter && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="flex items-center gap-2 text-lg font-black"><Utensils size={20} className="text-orange-600" />{role === "cashier" ? "Create counter order" : "Create waiter order"}</h2><p className="mt-1 text-sm text-slate-500">Menu and branch availability come from Cloud. A confirmed order is queued for the kitchen.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold text-slate-600">Item<select value={productId} onChange={(event) => { setProductId(event.target.value); setSelectedAddons({}); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium"><option value="">Choose item</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · ₹{Number(product.base_price).toFixed(2)}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Quantity<input type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="text-xs font-bold text-slate-600">Order type<select value={orderType} onChange={(event) => setOrderType(event.target.value as "takeaway" | "dine_in")} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="takeaway">Takeaway</option><option value="dine_in">Dine in</option></select></label>{orderType === "dine_in" && <label className="text-xs font-bold text-slate-600">Available table<select value={tableId} onChange={(event) => setTableId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="">Choose table</option>{tables.filter((table) => table.status === "available").map((table) => <option key={table.id} value={table.id}>{table.table_number}</option>)}</select></label>}</div>
            {selectedProduct?.addon_groups?.map((group) => <fieldset key={group.id} className="mt-4 rounded-xl border border-slate-200 p-3"><legend className="px-1 text-xs font-bold">{group.name}{(group.is_required || Number(group.min_selection) > 0) ? " · required" : " · optional"}</legend><div className="flex flex-wrap gap-2">{(group.addons || []).filter((addon) => addon.is_active !== 0).map((addon) => { const checked = (selectedAddons[group.id] || []).includes(addon.id); return <label key={addon.id} className="flex min-h-10 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm"><input type="checkbox" checked={checked} onChange={() => setSelectedAddons((current) => { const selected = current[group.id] || []; return { ...current, [group.id]: checked ? selected.filter((id) => id !== addon.id) : [...selected, addon.id] }; })} />{addon.name}{Number(addon.price) > 0 ? ` · ₹${Number(addon.price).toFixed(2)}` : ""}</label>; })}</div></fieldset>)}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={!selectedProduct || busy || Boolean(pendingOrder)} onClick={addDraftLine} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-50">Add item to order</button><span className="text-sm text-slate-600">{draft.length} item line{draft.length === 1 ? "" : "s"} in order</span><button type="button" disabled={!draft.length || busy} onClick={() => void submitOrder()} className="min-h-11 rounded-lg bg-orange-600 px-5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? "Sending…" : pendingOrder ? "Retry same order" : "Send order to kitchen"}</button></div>
            {pendingOrder && <p className="mt-2 text-xs font-medium text-amber-800">This order is pending confirmation. Retry it with the same ID before changing its contents.</p>}
            {draft.length > 0 && <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">{draft.map((line, index) => <li key={`${line.product_id}-${index}`} className="flex items-center justify-between px-3 py-2 text-sm"><span>{products.find((product) => product.id === line.product_id)?.name} × {line.quantity}</span><button type="button" disabled={Boolean(pendingOrder)} onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-bold text-red-700 disabled:opacity-40">Remove</button></li>)}</ul>}
          </section>}

          {isKitchen && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="flex items-center gap-2 text-lg font-black"><ChefHat size={20} className="text-orange-600" />Kitchen queue</h2><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{ticket.order_number}</h3><p className="text-xs text-slate-500">{ticket.station || "Kitchen"} · {new Date(ticket.created_at).toLocaleTimeString()}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold capitalize text-amber-800">{ticket.status}</span></div><ul className="my-3 space-y-1 text-sm">{ticket.items.map((item, index) => <li key={`${item.name || item.product_name}-${index}`}>{item.quantity || 1} × {item.name || item.product_name}</li>)}</ul><div className="flex gap-2">{ticket.status === "pending" && <ActionButton disabled={busy} onClick={() => void updateTicket(ticket, "preparing")}>Start</ActionButton>}{ticket.status === "preparing" && <ActionButton disabled={busy} onClick={() => void updateTicket(ticket, "ready")}>Mark ready</ActionButton>}{ticket.status === "ready" && <ActionButton disabled={busy} onClick={() => void updateTicket(ticket, "completed")}>Complete</ActionButton>}</div></article>)}</div>{tickets.length === 0 && <Empty>There are no active kitchen tickets at this branch.</Empty>}</section>}

          {isCashier && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="flex items-center gap-2 text-lg font-black"><CircleDollarSign size={20} className="text-orange-600" />Cashier payment queue</h2><p className="mt-1 text-sm text-slate-500">Cash collection is written to the Cloud payment ledger. Card and UPI require a verified terminal/provider flow.</p><OrderList orders={orders} action={(order) => <button type="button" disabled={busy} onClick={() => void (order.payment_status === "paid" ? closePaidOrder(order) : collectCash(order))} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">{order.payment_status === "paid" ? "Close paid order" : "Collect cash"}</button>} /></section>}

          {isWaiter && role !== "owner" && role !== "manager" && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-black">Branch orders and kitchen progress</h2><OrderList orders={orders} /></section>}

          {(role === "owner" || role === "manager" || (!isWaiter && !isKitchen && !isCashier && !isAccountant && !["delivery", "super_admin"].includes(role))) && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-black">Live branch orders</h2><OrderList orders={orders} /></section>}

          {isAccountant && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-black">Tax summary from Cloud</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Branch</th><th>Bills</th><th>Taxable</th><th>Tax collected</th><th>Gross</th></tr></thead><tbody>{taxRows.map((row, index) => <tr key={String(row.branch_id || index)} className="border-b border-slate-100"><td className="py-3 font-semibold">{String(row.branch_name || "Branch")}</td><td>{Number(row.total_bills || 0)}</td><td>₹{Number(row.taxable_amount || 0).toFixed(2)}</td><td>₹{Number(row.tax_collected || 0).toFixed(2)}</td><td>₹{Number(row.gross_turnover || 0).toFixed(2)}</td></tr>)}</tbody></table></div>{taxRows.length === 0 && <Empty>No Cloud tax rows were returned for the current period.</Empty>}</section>}

          {role === "delivery" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Delivery dispatch is not connected to this Cloud workspace yet.</strong> No simulated dispatch or COD settlement is shown for this authenticated account.</div>}
          {role === "super_admin" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Open the platform administration view to manage pilot requests and tenant operations.</div>}
        </>}
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-700">{icon}</span><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-xl font-black">{value}</p></div></div>;
}

function OrderList({ orders, action }: { orders: Order[]; action?: (order: Order) => React.ReactNode }) {
  if (!orders.length) return <Empty>No active Cloud orders for this branch.</Empty>;
  return <div className="mt-3 divide-y divide-slate-100">{orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-bold">{order.order_number} <span className="font-normal capitalize text-slate-500">· {order.order_type.replaceAll("_", " ")}{order.table_number ? ` · Table ${order.table_number}` : ""}</span></p><p className="text-xs text-slate-500">Kitchen: {order.kitchen_status || "pending"} · Payment: {order.payment_status}</p><p className="truncate text-xs text-slate-500">{(order.items || []).map((item) => `${item.quantity}× ${item.product_name}`).join(", ")}</p></div><div className="flex items-center gap-3"><strong>₹{Number(order.grand_total).toFixed(2)}</strong>{action?.(order)}</div></div>)}</div>;
}

function ActionButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50">{children}</button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{children}</p>;
}
