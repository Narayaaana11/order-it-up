"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, CalendarDays, ChefHat, CircleDollarSign, ClipboardList, LoaderCircle,
  Package, Plus, Receipt, RefreshCw, Store, Truck, Utensils, Wallet, X,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getCloudApiBase, setStoredUser } from "@/lib/auth";

type Branch = { id: string; name: string; status?: string };
type Product = { id: string; name: string; base_price: number; is_active?: number; addon_groups?: AddonGroup[] };
type AddonGroup = { id: string; name: string; is_required?: number; min_selection?: number; max_selection?: number; addons?: { id: string; name: string; price: number; is_active?: number }[] };
type Table = { id: string; table_number: string; status: string; capacity?: number };
type Order = { id: string; order_number: string; order_type: string; status: string; version?: number; kitchen_status?: string; payment_status: string; grand_total: number; ordered_at: string; table_number?: string | null; customer_name?: string | null; items?: { product_name: string; quantity: number; modifiers?: { name: string; quantity?: number }[] }[] };
type Ticket = { id: string; order_id: string; order_number: string; status: string; station?: string; items: { name?: string; product_name?: string; quantity?: number }[]; created_at: string };
type DraftLine = { product_id: string; quantity: number; modifiers: { id: string; quantity: number }[] };
type Ingredient = { id: string; name: string; unit: string; current_stock: number; minimum_stock: number; cost_per_unit: number; is_active?: number };
type StockTransaction = { id: string; ingredient_name: string; type: string; quantity: number; balance_after: number; reason?: string | null; created_at: string };
type Expense = { id: string; description: string; amount: number; payment_method: string; category_id?: string | null; category_name?: string | null; expense_date: string; status?: string };
type ExpenseCategory = { id: string; name: string };
type Reservation = { id: string; customer_name: string; customer_phone?: string | null; guest_count: number; reservation_date: string; reservation_time: string; status: string; table_number?: string | null; table_id?: string | null; notes?: string | null };
type DeliveryJob = { id: string; order_id: string; order_number?: string; status: string; address: string; driver_name?: string | null; driver_phone?: string | null; eta_minutes?: number | null; cod_amount: number; cod_collected: number; created_at: string };
type ShiftSummary = { opened_at: string; closed_at: string; business_date: string; opening_cash: number; cash_sales: number; card_sales: number; upi_sales: number; other_sales: number; expected_cash: number; order_count: number; payment_count: number };
type Closure = { id: string; closure_date: string; expected_cash: number; actual_cash: number; variance: number; closed_by: string; closed_at: string };
type TabKey = "floor" | "reservations" | "kitchen" | "cashier" | "inventory" | "expenses" | "delivery" | "reports";

const money = (value: number) => `₹${Number(value || 0).toFixed(2)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

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
  const role = user.role.toLowerCase();

  const canFloor = ["owner", "admin", "manager", "super_admin", "cashier", "server", "waiter", "host"].includes(role);
  const canKitchen = ["owner", "admin", "manager", "super_admin", "chef", "kitchen"].includes(role);
  const canCashier = ["owner", "admin", "manager", "super_admin", "cashier"].includes(role);
  const canInventory = ["owner", "admin", "manager", "super_admin"].includes(role);
  const canExpenses = ["owner", "admin", "manager", "super_admin", "cashier"].includes(role);
  const canDelivery = ["owner", "admin", "manager", "super_admin", "cashier", "delivery"].includes(role);
  const canReports = ["owner", "admin", "manager", "super_admin", "accountant"].includes(role);
  const canCreateOrder = ["owner", "admin", "manager", "super_admin", "cashier", "server", "waiter"].includes(role);

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string; icon: React.ReactNode }[] = [];
    if (canFloor) list.push({ key: "floor", label: "Floor & orders", icon: <Utensils size={16} /> });
    if (canFloor) list.push({ key: "reservations", label: "Reservations", icon: <CalendarDays size={16} /> });
    if (canKitchen) list.push({ key: "kitchen", label: "Kitchen", icon: <ChefHat size={16} /> });
    if (canCashier) list.push({ key: "cashier", label: "Cashier & shift", icon: <CircleDollarSign size={16} /> });
    if (canInventory) list.push({ key: "inventory", label: "Inventory", icon: <Package size={16} /> });
    if (canExpenses) list.push({ key: "expenses", label: "Expenses", icon: <Receipt size={16} /> });
    if (canDelivery) list.push({ key: "delivery", label: "Delivery", icon: <Truck size={16} /> });
    if (canReports) list.push({ key: "reports", label: "Reports", icon: <ClipboardList size={16} /> });
    return list;
  }, [canCashier, canDelivery, canExpenses, canFloor, canInventory, canKitchen, canReports]);

  const [tab, setTab] = useState<TabKey>(() => {
    if (role === "cashier") return "cashier";
    if (role === "accountant") return "reports";
    if (role === "chef" || role === "kitchen") return "kitchen";
    if (role === "delivery") return "delivery";
    return tabs[0]?.key || "floor";
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [lowStock, setLowStock] = useState<Ingredient[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [deliveryJobs, setDeliveryJobs] = useState<DeliveryJob[]>([]);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [taxRows, setTaxRows] = useState<Record<string, unknown>[]>([]);

  const [reservationDate, setReservationDate] = useState(todayIso());
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState<"takeaway" | "dine_in" | "delivery">("takeaway");
  const [tableId, setTableId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<DraftLine[]>([]);

  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category_id: "", payment_method: "cash", expense_date: todayIso() });
  const [categoryName, setCategoryName] = useState("");
  const [ingredientForm, setIngredientForm] = useState({ name: "", unit: "kg", current_stock: "0", minimum_stock: "0", cost_per_unit: "0" });
  const [adjusting, setAdjusting] = useState<{ id: string; type: "increase" | "decrease" | "set"; quantity: string } | null>(null);
  const [reservationForm, setReservationForm] = useState({ customer_name: "", customer_phone: "", guest_count: "2", reservation_date: todayIso(), reservation_time: "19:00", table_id: "", notes: "" });
  const [deliveryForm, setDeliveryForm] = useState({ order_id: "", address: "", cod_amount: "0" });
  const [assigning, setAssigning] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [shiftForm, setShiftForm] = useState({ actual_cash: "", notes: "" });

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

  const loadCatalog = useCallback(async (id: string) => {
    if (!id || !canCreateOrder) return;
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
  }, [canCreateOrder, user]);

  const refreshOperational = useCallback(async (id: string) => {
    if (!id) return;
    const failures: unknown[] = [];
    if (canFloor || canCashier || canKitchen || canDelivery) {
      const [ordersResult, tablesResult] = await Promise.allSettled([
        cloudRequest<{ orders?: Order[] }>(user, `/api/orders?branch_id=${encodeURIComponent(id)}&status=active&limit=50`),
        cloudRequest<{ tables?: Table[] }>(user, `/api/tables?branch_id=${encodeURIComponent(id)}`),
      ]);
      if (ordersResult.status === "fulfilled") setOrders(ordersResult.value.orders || []);
      else failures.push(ordersResult.reason);
      if (tablesResult.status === "fulfilled") setTables(tablesResult.value.tables || []);
      else failures.push(tablesResult.reason);
    }
    if (canKitchen) {
      try {
        const ticketsResult = await cloudRequest<{ tickets?: Ticket[] }>(user, `/api/kitchen/tickets?branch_id=${encodeURIComponent(id)}`);
        setTickets(ticketsResult.tickets || []);
      } catch (ticketError) { failures.push(ticketError); }
    }
    if (canDelivery) {
      try {
        const jobsResult = await cloudRequest<{ jobs?: DeliveryJob[] }>(user, `/api/delivery/jobs?branch_id=${encodeURIComponent(id)}`);
        setDeliveryJobs(jobsResult.jobs || []);
      } catch (jobError) { failures.push(jobError); }
    }
    if (failures.length) throw failures[0];
  }, [canCashier, canDelivery, canFloor, canKitchen, user]);

  const loadTab = useCallback(async (id: string, key: TabKey) => {
    if (!id) return;
    const failures: unknown[] = [];
    const attempt = async <T,>(request: Promise<T>, apply: (value: T) => void) => {
      try { apply(await request); } catch (requestError) { failures.push(requestError); }
    };

    if (key === "reservations") {
      await attempt(cloudRequest<{ reservations?: Reservation[] }>(user, `/api/reservations?branch_id=${encodeURIComponent(id)}&date=${reservationDate}`), (result) => setReservations(result.reservations || []));
    }
    if (key === "inventory") {
      await Promise.all([
        attempt(cloudRequest<{ ingredients?: Ingredient[] }>(user, `/api/inventory/ingredients?branch_id=${encodeURIComponent(id)}`), (result) => setIngredients(result.ingredients || [])),
        attempt(cloudRequest<{ low_stock?: Ingredient[] }>(user, `/api/inventory/low-stock?branch_id=${encodeURIComponent(id)}`), (result) => setLowStock(result.low_stock || [])),
        attempt(cloudRequest<{ transactions?: StockTransaction[] }>(user, `/api/inventory/transactions?branch_id=${encodeURIComponent(id)}&limit=25`), (result) => setStockTransactions(result.transactions || [])),
      ]);
    }
    if (key === "expenses") {
      await Promise.all([
        attempt(cloudRequest<{ expenses?: Expense[] }>(user, `/api/expenses?branch_id=${encodeURIComponent(id)}&start_date=${expenseDate}&end_date=${expenseDate}`), (result) => setExpenses(result.expenses || [])),
        attempt(cloudRequest<{ categories?: ExpenseCategory[] }>(user, "/api/expenses/categories"), (result) => setExpenseCategories(result.categories || [])),
      ]);
    }
    if (key === "cashier") {
      await Promise.all([
        attempt(cloudRequest<{ summary?: ShiftSummary }>(user, `/api/shifts/summary?branch_id=${encodeURIComponent(id)}`), (result) => setShiftSummary(result.summary || null)),
        attempt(cloudRequest<{ closures?: Closure[] }>(user, `/api/shifts/closures?branch_id=${encodeURIComponent(id)}`), (result) => setClosures(result.closures || [])),
      ]);
    }
    if (key === "reports") {
      const date = todayIso();
      await Promise.all([
        attempt(cloudRequest<Record<string, unknown>>(user, `/reports/daily-stats?date=${date}&branch_id=${encodeURIComponent(id)}`), (result) => setReport((current) => ({ ...(current || {}), ...result }))),
        attempt(cloudRequest<{ financialSummary?: Record<string, unknown> }>(user, `/reports/financial-summary?start_date=${date}&end_date=${date}&branch_id=${encodeURIComponent(id)}`), (result) => setReport((current) => ({ ...(current || {}), financial: result.financialSummary || {} }))),
        ...(role === "accountant"
          ? [attempt(cloudRequest<{ tax_by_branch?: Record<string, unknown>[] }>(user, "/api/accountant/tax-summary"), (result) => setTaxRows(result.tax_by_branch || []))]
          : []),
      ]);
    }

    if (failures.length) throw failures[0];
  }, [expenseDate, reservationDate, role, user]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      if (!branches.length) await loadBranches();
      if (branchId) {
        await Promise.all([refreshOperational(branchId), loadCatalog(branchId), loadTab(branchId, tab)]);
      }
    } catch (loadError) {
      setError(message(loadError));
    } finally {
      setLoading(false);
    }
  }, [branchId, branches.length, loadBranches, loadCatalog, loadTab, refreshOperational, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBranches().catch((loadError) => setError(message(loadError))).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBranches]);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void Promise.all([
        refreshOperational(branchId),
        loadCatalog(branchId),
        loadTab(branchId, tab),
      ]).catch((loadError) => setError(message(loadError)))
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // Data is intentionally reloaded when the branch or active tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, tab, reservationDate, expenseDate]);

  useEffect(() => {
    if (!branchId) return;
    const interval = window.setInterval(() => {
      void refreshOperational(branchId).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [branchId, refreshOperational]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(message(actionError));
    } finally {
      setBusy(false);
    }
  };

  const addDraftLine = () => {
    if (!selectedProduct) return;
    const modifiers: DraftLine["modifiers"] = [];
    for (const group of selectedProduct.addon_groups || []) {
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

  const submitOrder = async () => run(async () => {
    if (!branchId || draft.length === 0) return;
    if (orderType === "dine_in" && !tableId) throw new Error("Choose an available table for a dine-in order.");
    if (orderType === "delivery" && !deliveryAddress.trim()) throw new Error("Enter the delivery address before sending this order.");

    const orderId = crypto.randomUUID();
    const payload = {
      id: orderId,
      branch_id: branchId,
      order_type: orderType,
      table_id: tableId || undefined,
      table_number: tables.find((table) => table.id === tableId)?.table_number,
      items: draft,
    };
    const result = await cloudRequest<{ order?: Order }>(user, "/api/orders", { method: "POST", body: JSON.stringify(payload) });
    if (!result.order?.id) throw new Error("Cloud did not confirm the order. Please retry.");

    if (orderType === "delivery") {
      await cloudRequest(user, "/api/delivery/jobs", {
        method: "POST",
        body: JSON.stringify({ order_id: result.order.id, address: deliveryAddress.trim() }),
      });
    }
    setDraft([]);
    setTableId("");
    setDeliveryAddress("");
    setNotice(`Order ${result.order.order_number} was accepted by Cloud${orderType === "delivery" ? " and queued for delivery dispatch" : " and sent to the kitchen"}.`);
    await refreshOperational(branchId);
    await loadTab(branchId, tab);
  });

  const updateTicket = async (ticket: Ticket, status: "preparing" | "ready" | "completed") => run(async () => {
    await cloudRequest(user, `/api/kitchen/tickets/${encodeURIComponent(ticket.id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    setNotice(`Ticket for ${ticket.order_number} moved to ${status}.`);
    await refreshOperational(branchId);
  });

  const setTableState = async (table: Table, status: string) => run(async () => {
    await cloudRequest(user, `/api/tables/${encodeURIComponent(table.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, current_order_id: status === "available" ? null : undefined }),
    });
    setNotice(`Table ${table.table_number} is now ${status}.`);
    await refreshOperational(branchId);
  });

  const collectCash = async (order: Order) => {
    setBusy(true);
    setError("");
    try {
      const summary = await cloudRequest<{ outstanding_balance: number }>(user, `/api/orders/${encodeURIComponent(order.id)}/payments`);
      const amount = Number(summary.outstanding_balance);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("This order has no outstanding balance.");
      if (!window.confirm(`Record ${money(amount)} cash for ${order.order_number}?`)) return;
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
      setNotice(`Cash transaction recorded for ${order.order_number}.`);
      await refreshOperational(branchId).catch(() => undefined);
      await loadTab(branchId, tab).catch(() => undefined);
    } catch (paymentError) {
      setError(message(paymentError));
    } finally {
      setBusy(false);
    }
  };

  const closePaidOrder = async (order: Order) => run(async () => {
    await cloudRequest(user, `/api/orders/${encodeURIComponent(order.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", ...(typeof order.version === "number" ? { expected_version: order.version } : {}) }),
    });
    localStorage.removeItem(`orderitup.cloud-payment:${user.id}:${order.id}`);
    setNotice(`Paid order ${order.order_number} is now closed.`);
    await refreshOperational(branchId).catch(() => undefined);
  });

  const createReservation = async () => run(async () => {
    if (!branchId) return;
    if (!reservationForm.customer_name.trim()) throw new Error("Guest name is required.");
    await cloudRequest(user, "/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        ...reservationForm,
        branch_id: branchId,
        guest_count: Number(reservationForm.guest_count),
        table_id: reservationForm.table_id || null,
      }),
    });
    setReservationDate(reservationForm.reservation_date);
    setReservationForm((current) => ({ ...current, customer_name: "", customer_phone: "", notes: "" }));
    setNotice("Reservation confirmed.");
    await loadTab(branchId, "reservations").catch(() => undefined);
  });

  const moveReservation = (reservation: Reservation, status: string) => run(async () => {
    await cloudRequest(user, `/api/reservations/${encodeURIComponent(reservation.id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    setNotice(`${reservation.customer_name} marked ${status.replace("_", " ")}.`);
    await Promise.allSettled([loadTab(branchId, "reservations"), refreshOperational(branchId)]);
  });

  const createIngredient = async () => run(async () => {
    if (!branchId) return;
    if (!ingredientForm.name.trim()) throw new Error("Ingredient name is required.");
    await cloudRequest(user, "/api/inventory/ingredients", {
      method: "POST",
      body: JSON.stringify({
        branch_id: branchId,
        name: ingredientForm.name,
        unit: ingredientForm.unit,
        current_stock: Number(ingredientForm.current_stock),
        minimum_stock: Number(ingredientForm.minimum_stock),
        cost_per_unit: Number(ingredientForm.cost_per_unit),
      }),
    });
    setIngredientForm({ name: "", unit: "kg", current_stock: "0", minimum_stock: "0", cost_per_unit: "0" });
    setNotice("Ingredient added to the stock ledger.");
    await loadTab(branchId, "inventory").catch(() => undefined);
  });

  const applyAdjustment = async () => run(async () => {
    if (!adjusting) return;
    await cloudRequest(user, "/api/inventory/adjust", {
      method: "POST",
      body: JSON.stringify({
        ingredient_id: adjusting.id,
        adjustment_type: adjusting.type,
        quantity: Number(adjusting.quantity),
        reason: `Cloud dashboard ${adjusting.type}`,
        idempotency_key: crypto.randomUUID(),
      }),
    });
    setAdjusting(null);
    setNotice("Stock adjustment recorded.");
    await loadTab(branchId, "inventory").catch(() => undefined);
  });

  const createExpense = async () => run(async () => {
    if (!branchId) return;
    if (!expenseForm.description.trim()) throw new Error("Description is required.");
    if (Number(expenseForm.amount) <= 0) throw new Error("Enter a positive expense amount.");
    await cloudRequest(user, "/api/expenses", {
      method: "POST",
      body: JSON.stringify({
        ...expenseForm,
        branch_id: branchId,
        amount: Number(expenseForm.amount),
        category_id: expenseForm.category_id || null,
        expense_date: expenseDate,
      }),
    });
    setExpenseForm((current) => ({ ...current, description: "", amount: "" }));
    setNotice("Expense recorded in the branch ledger.");
    await loadTab(branchId, "expenses").catch(() => undefined);
  });

  const addCategory = async () => run(async () => {
    if (!categoryName.trim()) throw new Error("Category name is required.");
    await cloudRequest(user, "/api/expenses/categories", { method: "POST", body: JSON.stringify({ name: categoryName.trim() }) });
    setCategoryName("");
    setNotice("Expense category created.");
    await loadTab(branchId, "expenses").catch(() => undefined);
  });

  const voidExpense = (expense: Expense) => run(async () => {
    if (!window.confirm(`Void the ${money(expense.amount)} expense "${expense.description}"?`)) return;
    await cloudRequest(user, `/api/expenses/${encodeURIComponent(expense.id)}`, { method: "DELETE", body: JSON.stringify({ reason: "Voided from Cloud dashboard" }) });
    setNotice("Expense voided; the audit row is retained.");
    await loadTab(branchId, "expenses").catch(() => undefined);
  });

  const createDeliveryJob = async () => run(async () => {
    if (!branchId || !deliveryForm.order_id) throw new Error("Choose an order that needs delivery.");
    await cloudRequest(user, "/api/delivery/jobs", {
      method: "POST",
      body: JSON.stringify({
        order_id: deliveryForm.order_id,
        branch_id: branchId,
        address: deliveryForm.address,
        cod_amount: Number(deliveryForm.cod_amount || 0),
      }),
    });
    setDeliveryForm({ order_id: "", address: "", cod_amount: "0" });
    setNotice("Delivery job created.");
    await loadTab(branchId, "delivery").catch(() => undefined);
  });

  const assignDriver = async () => run(async () => {
    if (!assigning) return;
    await cloudRequest(user, `/api/delivery/jobs/${encodeURIComponent(assigning.id)}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ driver_name: assigning.name, driver_phone: assigning.phone || null }),
    });
    setAssigning(null);
    setNotice("Driver assigned.");
    await loadTab(branchId, "delivery").catch(() => undefined);
  });

  const moveDelivery = (job: DeliveryJob, status: string, codCollected = false) => run(async () => {
    await cloudRequest(user, `/api/delivery/jobs/${encodeURIComponent(job.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, cod_collected: codCollected }),
    });
    setNotice(`Delivery ${job.order_number || job.order_id} marked ${status.replace("_", " ")}.`);
    await loadTab(branchId, "delivery").catch(() => undefined);
  });

  const closeShift = async () => run(async () => {
    if (!branchId) return;
    const actual = Number(shiftForm.actual_cash);
    if (!Number.isFinite(actual) || actual < 0) throw new Error("Enter the counted cash amount.");
    await cloudRequest(user, "/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({ branch_id: branchId, actual_cash: actual, notes: shiftForm.notes }),
    });
    setShiftForm({ actual_cash: "", notes: "" });
    setNotice("Shift closed and the cash variance was persisted.");
    await Promise.allSettled([loadTab(branchId, "cashier"), refreshOperational(branchId)]);
  });

  const roleTitle = useMemo(() => ({
    owner: "Owner / manager", manager: "Owner / manager", admin: "Administrator",
    cashier: "Cashier", server: "Waiter / server", waiter: "Waiter / server",
    host: "Host / reservations", chef: "Kitchen", kitchen: "Kitchen",
    accountant: "Accountant", delivery: "Delivery", super_admin: "Platform administrator",
  }[role] || user.role), [role, user.role]);

  const availableTables = tables.filter((table) => table.status === "available");
  const deliverableOrders = orders.filter((order) => ["delivery", "takeaway"].includes(order.order_type));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-700"><Store size={20} /></span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black">Live restaurant operations</h1>
              <p className="truncate text-xs text-slate-500">{user.organizationName || user.email} · {roleTitle} · Cloud synchronized</p>
            </div>
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm">
            <span className="sr-only">Branch</span>
            <select aria-label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} className="max-w-52 bg-transparent px-1 outline-none">
              <option value="">Choose branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void refresh()} disabled={loading || busy} aria-label="Refresh live data" className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={onSignOut} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Sign out</button>
        </div>
        {tabs.length > 0 && (
          <nav aria-label="Dashboard sections" className="mx-auto mt-3 flex max-w-7xl gap-1 overflow-x-auto pb-1">
            {tabs.map((item) => (
              <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-current={tab === item.key ? "page" : undefined} className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold ${tab === item.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {item.icon}{item.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <strong>Live data.</strong> This view reads and writes through your authenticated Cloud account. Prices, permissions, branch scope, and order transitions are checked by Cloud.
        </div>
        {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
        {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {loading && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} />Loading authorized branch data…</div>}
        {!loading && !branches.length && <div className="rounded-xl border border-amber-200 bg-white p-6"><h2 className="font-bold">No authorized active branch</h2><p className="mt-1 text-sm text-slate-600">Ask an organization owner to assign this account to an active branch.</p></div>}
        {!loading && branches.length > 0 && tabs.length === 0 && <div className="rounded-xl border border-amber-200 bg-white p-6"><h2 className="font-bold">No operational dashboard is assigned to this role</h2><p className="mt-1 text-sm text-slate-600">This account can sign in, but it has no restaurant operations role. Ask an owner to assign a waiter, cashier, kitchen, inventory, delivery, accountant, or manager membership.</p></div>}

        {!loading && branchId && tab === "floor" && <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric label="Active orders" value={orders.length} icon={<Activity size={18} />} />
            <Metric label="Unpaid orders" value={orders.filter((order) => order.payment_status !== "paid").length} icon={<CircleDollarSign size={18} />} />
            <Metric label="Occupied tables" value={tables.filter((table) => table.status === "occupied").length} icon={<Utensils size={18} />} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Utensils size={20} className="text-orange-600" />Floor plan</h2>
            <p className="mt-1 text-sm text-slate-500">Seat walk-ins, clear tables, or mark a table for cleaning. State is shared with the waiter and cashier apps.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {tables.map((table) => (
                <div key={table.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-black">{table.table_number}</p>
                  <p className="text-xs capitalize text-slate-500">{table.status} · {table.capacity || 4} seats</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {table.status !== "occupied" && <button type="button" disabled={busy} onClick={() => void setTableState(table, "occupied")} className="min-h-8 rounded-md bg-slate-900 px-2 text-[11px] font-bold text-white disabled:opacity-50">Seat</button>}
                    {table.status === "occupied" && <button type="button" disabled={busy} onClick={() => void setTableState(table, "available")} className="min-h-8 rounded-md border border-slate-300 px-2 text-[11px] font-bold disabled:opacity-50">Clear</button>}
                    <button type="button" disabled={busy || table.status === "cleaning"} onClick={() => void setTableState(table, "cleaning")} className="min-h-8 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 disabled:opacity-50">Clean</button>
                  </div>
                </div>
              ))}
            </div>
            {tables.length === 0 && <Empty>No active tables are configured for this branch yet.</Empty>}
          </section>

          {canCreateOrder && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Plus size={20} className="text-orange-600" />{role === "cashier" ? "Create counter order" : "Create waiter order"}</h2>
            <p className="mt-1 text-sm text-slate-500">Menu and branch availability come from Cloud. A confirmed order is queued for the kitchen.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold text-slate-600">Item
                <select value={productId} onChange={(event) => { setProductId(event.target.value); setSelectedAddons({}); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium">
                  <option value="">Choose item</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.base_price)}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">Quantity
                <input type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">Order type
                <select value={orderType} onChange={(event) => setOrderType(event.target.value as typeof orderType)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm">
                  <option value="takeaway">Takeaway</option>
                  <option value="dine_in">Dine in</option>
                  <option value="delivery">Delivery</option>
                </select>
              </label>
              {orderType === "dine_in" && <label className="text-xs font-bold text-slate-600">Available table
                <select value={tableId} onChange={(event) => setTableId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm">
                  <option value="">Choose table</option>
                  {availableTables.map((table) => <option key={table.id} value={table.id}>{table.table_number} · {table.capacity || 4} seats</option>)}
                </select>
              </label>}
              {orderType === "delivery" && <label className="text-xs font-bold text-slate-600">Delivery address
                <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="House, street, area" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>}
            </div>
            {selectedProduct?.addon_groups?.map((group) => (
              <fieldset key={group.id} className="mt-4 rounded-xl border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold">{group.name}{(group.is_required || Number(group.min_selection) > 0) ? " · required" : " · optional"}</legend>
                <div className="flex flex-wrap gap-2">
                  {(group.addons || []).filter((addon) => addon.is_active !== 0).map((addon) => {
                    const checked = (selectedAddons[group.id] || []).includes(addon.id);
                    return <label key={addon.id} className="flex min-h-10 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm">
                      <input type="checkbox" checked={checked} onChange={() => setSelectedAddons((current) => {
                        const selected = current[group.id] || [];
                        return { ...current, [group.id]: checked ? selected.filter((id) => id !== addon.id) : [...selected, addon.id] };
                      })} />
                      {addon.name}{Number(addon.price) > 0 ? ` · ${money(Number(addon.price))}` : ""}
                    </label>;
                  })}
                </div>
              </fieldset>
            ))}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" disabled={!selectedProduct || busy} onClick={addDraftLine} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-50">Add item to order</button>
              <span className="text-sm text-slate-600">{draft.length} item line{draft.length === 1 ? "" : "s"} in order</span>
              <button type="button" disabled={!draft.length || busy} onClick={() => void submitOrder()} className="min-h-11 rounded-lg bg-orange-600 px-5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? "Sending…" : "Send order to kitchen"}</button>
            </div>
            {draft.length > 0 && <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
              {draft.map((line, index) => <li key={`${line.product_id}-${index}`} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{products.find((product) => product.id === line.product_id)?.name} × {line.quantity}</span>
                <button type="button" disabled={busy} onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-bold text-red-700 disabled:opacity-40">Remove</button>
              </li>)}
            </ul>}
          </section>}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-black">Live branch orders</h2>
            <OrderList orders={orders} action={canCashier ? (order) => (
              <button type="button" disabled={busy} onClick={() => void (order.payment_status === "paid" ? closePaidOrder(order) : collectCash(order))} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">
                {order.payment_status === "paid" ? "Close paid order" : "Collect cash"}
              </button>
            ) : undefined} />
          </section>
        </>}

        {!loading && branchId && tab === "reservations" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black"><CalendarDays size={20} className="text-orange-600" />Reservations</h2>
                <p className="mt-1 text-sm text-slate-500">Table bookings are branch-scoped. Seating a booking occupies the table; completing it releases the table.</p>
              </div>
              <label className="text-xs font-bold text-slate-600">Date
                <input type="date" value={reservationDate} onChange={(event) => setReservationDate(event.target.value)} className="ms-2 min-h-10 rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Guest name"><input value={reservationForm.customer_name} onChange={(event) => setReservationForm({ ...reservationForm, customer_name: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Phone"><input value={reservationForm.customer_phone} onChange={(event) => setReservationForm({ ...reservationForm, customer_phone: event.target.value })} inputMode="tel" className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Guests"><input type="number" min={1} max={100} value={reservationForm.guest_count} onChange={(event) => setReservationForm({ ...reservationForm, guest_count: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Date"><input type="date" value={reservationForm.reservation_date} onChange={(event) => setReservationForm({ ...reservationForm, reservation_date: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Time"><input type="time" value={reservationForm.reservation_time} onChange={(event) => setReservationForm({ ...reservationForm, reservation_time: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Table (optional)">
                <select value={reservationForm.table_id} onChange={(event) => setReservationForm({ ...reservationForm, table_id: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
                  <option value="">No table yet</option>
                  {tables.map((table) => <option key={table.id} value={table.id}>{table.table_number} · {table.capacity || 4} seats</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <input value={reservationForm.notes} onChange={(event) => setReservationForm({ ...reservationForm, notes: event.target.value })} placeholder="Notes (allergies, birthday, seating preference)" className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
              <button type="button" disabled={busy} onClick={() => void createReservation()} className="min-h-10 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50">Create reservation</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-black">Bookings for {reservationDate}</h2>
            {reservations.length === 0 && <Empty>No reservations for this date.</Empty>}
            <div className="mt-3 divide-y divide-slate-100">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-bold">{reservation.customer_name} · {reservation.guest_count} guests</p>
                    <p className="text-xs text-slate-500">{reservation.reservation_time} · {reservation.table_number || "no table"} · {reservation.customer_phone || "no phone"} · <span className="capitalize">{reservation.status.replace("_", " ")}</span></p>
                    {reservation.notes && <p className="truncate text-xs text-slate-500">{reservation.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reservation.status === "confirmed" && <>
                      <ActionButton disabled={busy} onClick={() => void moveReservation(reservation, "seated")}>Seat</ActionButton>
                      <ActionButton disabled={busy} tone="muted" onClick={() => void moveReservation(reservation, "no_show")}>No show</ActionButton>
                    </>}
                    {reservation.status === "seated" && <ActionButton disabled={busy} onClick={() => void moveReservation(reservation, "completed")}>Complete</ActionButton>}
                    {["confirmed", "seated"].includes(reservation.status) && <ActionButton disabled={busy} tone="danger" onClick={() => void moveReservation(reservation, "cancelled")}>Cancel</ActionButton>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>}

        {!loading && branchId && tab === "kitchen" && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-black"><ChefHat size={20} className="text-orange-600" />Kitchen queue</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-black">{ticket.order_number}</h3><p className="text-xs text-slate-500">{ticket.station || "Kitchen"} · {new Date(ticket.created_at).toLocaleTimeString()}</p></div>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold capitalize text-amber-800">{ticket.status}</span>
                </div>
                <ul className="my-3 space-y-1 text-sm">{ticket.items.map((item, index) => <li key={`${item.name || item.product_name}-${index}`}>{item.quantity || 1} × {item.name || item.product_name}</li>)}</ul>
                <div className="flex gap-2">
                  {ticket.status === "pending" && <ActionButton disabled={busy} onClick={() => void updateTicket(ticket, "preparing")}>Start</ActionButton>}
                  {ticket.status === "preparing" && <ActionButton disabled={busy} onClick={() => void updateTicket(ticket, "ready")}>Mark ready</ActionButton>}
                  {ticket.status === "ready" && <ActionButton disabled={busy} onClick={() => void updateTicket(ticket, "completed")}>Complete</ActionButton>}
                </div>
              </article>
            ))}
          </div>
          {tickets.length === 0 && <Empty>There are no active kitchen tickets at this branch.</Empty>}
        </section>}

        {!loading && branchId && tab === "cashier" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><CircleDollarSign size={20} className="text-orange-600" />Cashier payment queue</h2>
            <p className="mt-1 text-sm text-slate-500">Cash collection is written to the Cloud payment ledger. Card and UPI require a verified terminal/provider flow.</p>
            <OrderList orders={orders} action={(order) => (
              <button type="button" disabled={busy} onClick={() => void (order.payment_status === "paid" ? closePaidOrder(order) : collectCash(order))} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">
                {order.payment_status === "paid" ? "Close paid order" : "Collect cash"}
              </button>
            )} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Wallet size={20} className="text-orange-600" />Shift close</h2>
            {!shiftSummary && <Empty>The shift summary could not be loaded.</Empty>}
            {shiftSummary && <>
              <p className="mt-1 text-sm text-slate-500">Window {new Date(shiftSummary.opened_at).toLocaleString()} → {new Date(shiftSummary.closed_at).toLocaleString()} · {shiftSummary.order_count} orders · {shiftSummary.payment_count} payments</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Cash sales" value={shiftSummary.cash_sales} icon={<CircleDollarSign size={18} />} money />
                <Metric label="Card sales" value={shiftSummary.card_sales} icon={<Receipt size={18} />} money />
                <Metric label="UPI sales" value={shiftSummary.upi_sales} icon={<Wallet size={18} />} money />
                <Metric label="Expected drawer" value={shiftSummary.expected_cash} icon={<Store size={18} />} money />
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Field label="Counted cash"><input type="number" min={0} step="0.01" value={shiftForm.actual_cash} onChange={(event) => setShiftForm({ ...shiftForm, actual_cash: event.target.value })} className="min-h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Notes"><input value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} className="min-h-10 w-64 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <button type="button" disabled={busy} onClick={() => void closeShift()} className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">Close shift</button>
              </div>
            </>}
            {closures.length > 0 && <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Date</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Closed by</th></tr></thead>
                <tbody>{closures.map((closure) => <tr key={closure.id} className="border-b border-slate-100"><td className="py-2">{closure.closure_date}</td><td>{money(closure.expected_cash)}</td><td>{money(closure.actual_cash)}</td><td className={Number(closure.variance) < 0 ? "font-bold text-red-700" : "font-bold text-emerald-700"}>{money(closure.variance)}</td><td>{closure.closed_by}</td></tr>)}</tbody>
              </table>
            </div>}
          </section>
        </>}

        {!loading && branchId && tab === "inventory" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Package size={20} className="text-orange-600" />Inventory</h2>
            <p className="mt-1 text-sm text-slate-500">Raw ingredients, low-stock alerts, and an auditable movement ledger. Recipe costs are calculated from live ingredient costs.</p>
            {lowStock.length > 0 && <div role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>{lowStock.length} low-stock item{lowStock.length === 1 ? "" : "s"}:</strong> {lowStock.map((item) => `${item.name} (${item.current_stock} ${item.unit})`).join(", ")}</div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Ingredient"><input value={ingredientForm.name} onChange={(event) => setIngredientForm({ ...ingredientForm, name: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Unit"><input value={ingredientForm.unit} onChange={(event) => setIngredientForm({ ...ingredientForm, unit: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Opening stock"><input type="number" min={0} step="0.01" value={ingredientForm.current_stock} onChange={(event) => setIngredientForm({ ...ingredientForm, current_stock: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Minimum"><input type="number" min={0} step="0.01" value={ingredientForm.minimum_stock} onChange={(event) => setIngredientForm({ ...ingredientForm, minimum_stock: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Cost / unit"><input type="number" min={0} step="0.01" value={ingredientForm.cost_per_unit} onChange={(event) => setIngredientForm({ ...ingredientForm, cost_per_unit: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
            </div>
            <button type="button" disabled={busy} onClick={() => void createIngredient()} className="mt-3 min-h-10 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50">Add ingredient</button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-black">Stock on hand</h2>
            {ingredients.length === 0 && <Empty>No ingredients have been added for this branch yet.</Empty>}
            <div className="mt-3 divide-y divide-slate-100">
              {ingredients.map((ingredient) => (
                <div key={ingredient.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">{ingredient.name} {ingredient.is_active === 0 && <span className="text-xs font-semibold text-slate-400">(inactive)</span>}</p>
                    <p className="text-xs text-slate-500">{ingredient.current_stock} {ingredient.unit} on hand · minimum {ingredient.minimum_stock} · {money(ingredient.cost_per_unit)}/{ingredient.unit}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {adjusting?.id === ingredient.id ? <>
                      <select value={adjusting.type} onChange={(event) => setAdjusting({ ...adjusting, type: event.target.value as typeof adjusting.type })} className="min-h-9 rounded-lg border border-slate-200 px-2 text-xs">
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                        <option value="set">Set to</option>
                      </select>
                      <input type="number" min={0} step="0.01" value={adjusting.quantity} onChange={(event) => setAdjusting({ ...adjusting, quantity: event.target.value })} className="min-h-9 w-24 rounded-lg border border-slate-200 px-2 text-xs" aria-label={`Adjustment quantity for ${ingredient.name}`} />
                      <ActionButton disabled={busy} onClick={() => void applyAdjustment()}>Save</ActionButton>
                      <ActionButton disabled={busy} tone="muted" onClick={() => setAdjusting(null)}>Cancel</ActionButton>
                    </> : <ActionButton disabled={busy} onClick={() => setAdjusting({ id: ingredient.id, type: "increase", quantity: "1" })}>Adjust</ActionButton>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-black">Recent stock movements</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">When</th><th>Ingredient</th><th>Type</th><th>Change</th><th>Balance</th></tr></thead>
                <tbody>{stockTransactions.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="py-2 text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</td><td className="font-semibold">{row.ingredient_name}</td><td className="capitalize">{row.type.replaceAll("_", " ")}</td><td className={Number(row.quantity) < 0 ? "text-red-700" : "text-emerald-700"}>{Number(row.quantity) > 0 ? "+" : ""}{row.quantity}</td><td>{row.balance_after}</td></tr>)}</tbody>
              </table>
            </div>
            {stockTransactions.length === 0 && <Empty>No stock movements have been recorded yet.</Empty>}
          </section>
        </>}

        {!loading && branchId && tab === "expenses" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black"><Receipt size={20} className="text-orange-600" />Expenses & petty cash</h2>
              <label className="text-xs font-bold text-slate-600">Date <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className="ms-2 min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Description"><input value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Amount"><input type="number" min={0} step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="Category">
                <select value={expenseForm.category_id} onChange={(event) => setExpenseForm({ ...expenseForm, category_id: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
                  <option value="">No category</option>
                  {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </Field>
              <Field label="Payment method">
                <select value={expenseForm.payment_method} onChange={(event) => setExpenseForm({ ...expenseForm, payment_method: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option>
                </select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={() => void createExpense()} className="min-h-10 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50">Record expense</button>
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category name" className="min-h-10 w-52 rounded-lg border border-slate-200 px-3 text-sm" />
              <button type="button" disabled={busy || !categoryName.trim()} onClick={() => void addCategory()} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:opacity-50">Add category</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-black">Expense ledger for {expenseDate}</h2>
              <p className="text-sm font-bold text-red-700">{money(expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0))}</p>
            </div>
            {expenses.length === 0 && <Empty>No expenses recorded for this date.</Empty>}
            <div className="mt-3 divide-y divide-slate-100">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">{expense.description}</p>
                    <p className="text-xs text-slate-500">{expense.category_name || "Uncategorised"} · {expense.payment_method.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong>{money(expense.amount)}</strong>
                    <ActionButton disabled={busy} tone="danger" onClick={() => void voidExpense(expense)}>Void</ActionButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>}

        {!loading && branchId && tab === "delivery" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Truck size={20} className="text-orange-600" />Delivery dispatch</h2>
            <p className="mt-1 text-sm text-slate-500">Delivery orders, driver assignment, and handoff transitions. Cash-on-delivery must be explicitly collected before a job can close.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Order">
                <select value={deliveryForm.order_id} onChange={(event) => setDeliveryForm({ ...deliveryForm, order_id: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
                  <option value="">Choose delivery order</option>
                  {deliverableOrders.map((order) => <option key={order.id} value={order.id}>{order.order_number} · {money(order.grand_total)}</option>)}
                </select>
              </Field>
              <Field label="Address"><input value={deliveryForm.address} onChange={(event) => setDeliveryForm({ ...deliveryForm, address: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              <Field label="COD amount"><input type="number" min={0} step="0.01" value={deliveryForm.cod_amount} onChange={(event) => setDeliveryForm({ ...deliveryForm, cod_amount: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></Field>
            </div>
            <button type="button" disabled={busy || !deliveryForm.order_id} onClick={() => void createDeliveryJob()} className="mt-3 min-h-10 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50">Create delivery job</button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-black">Dispatch board</h2>
            {deliveryJobs.length === 0 && <Empty>No delivery jobs for this branch.</Empty>}
            <div className="mt-3 space-y-3">
              {deliveryJobs.map((job) => (
                <article key={job.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black">{job.order_number || job.order_id} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold capitalize text-slate-700">{job.status.replace("_", " ")}</span></p>
                      <p className="text-sm text-slate-600">{job.address}</p>
                      <p className="text-xs text-slate-500">{job.driver_name ? `${job.driver_name}${job.driver_phone ? ` · ${job.driver_phone}` : ""}${job.eta_minutes ? ` · ETA ${job.eta_minutes} min` : ""}` : "No driver assigned"}{Number(job.cod_amount) > 0 ? ` · COD ${money(job.cod_amount)}${job.cod_collected ? " collected" : ""}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {job.status === "pending" && (assigning?.id === job.id ? <>
                        <input value={assigning.name} onChange={(event) => setAssigning({ ...assigning, name: event.target.value })} placeholder="Driver name" className="min-h-9 w-36 rounded-lg border border-slate-200 px-2 text-xs" />
                        <input value={assigning.phone} onChange={(event) => setAssigning({ ...assigning, phone: event.target.value })} placeholder="Phone" className="min-h-9 w-28 rounded-lg border border-slate-200 px-2 text-xs" />
                        <ActionButton disabled={busy} onClick={() => void assignDriver()}>Save</ActionButton>
                        <ActionButton disabled={busy} tone="muted" onClick={() => setAssigning(null)}>Cancel</ActionButton>
                      </> : <ActionButton disabled={busy} onClick={() => setAssigning({ id: job.id, name: "", phone: "" })}>Assign driver</ActionButton>)}
                      {job.status === "assigned" && <ActionButton disabled={busy} onClick={() => void moveDelivery(job, "picked_up")}>Picked up</ActionButton>}
                      {job.status === "picked_up" && <ActionButton disabled={busy} onClick={() => void moveDelivery(job, "delivered", Number(job.cod_amount) > 0)}>Delivered</ActionButton>}
                      {["pending", "assigned", "picked_up"].includes(job.status) && <ActionButton disabled={busy} tone="danger" onClick={() => void moveDelivery(job, "cancelled")}>Cancel</ActionButton>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>}

        {!loading && branchId && tab === "reports" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><ClipboardList size={20} className="text-orange-600" />Today at a glance</h2>
            {!report && <Empty>Report data is not available for this account yet.</Empty>}
            {report && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Sales" value={Number(report.sales || 0)} icon={<CircleDollarSign size={18} />} money />
              <Metric label="Running orders" value={Number(report.runningOrders || 0)} icon={<Activity size={18} />} />
              <Metric label="Pending orders" value={Number(report.pendingOrders || 0)} icon={<ClipboardList size={18} />} />
              <Metric label="Tables occupied" value={Number(report.tablesOccupied || 0)} icon={<Utensils size={18} />} />
              <Metric label="Avg table turn" value={Number(report.avgTableTurnMinutes || 0)} icon={<RefreshCw size={18} />} suffix="min" />
              <Metric label="Net collected" value={Number((report.financial as Record<string, unknown> | undefined)?.netCollected || 0)} icon={<Wallet size={18} />} money />
            </div>}
          </section>

          {user.role.toLowerCase() === "accountant" && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-black">Tax summary from Cloud</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Branch</th><th>Bills</th><th>Taxable</th><th>Tax collected</th><th>Gross</th></tr></thead>
                <tbody>{taxRows.map((row, index) => <tr key={String(row.branch_id || index)} className="border-b border-slate-100"><td className="py-3 font-semibold">{String(row.branch_name || "Branch")}</td><td>{Number(row.total_bills || 0)}</td><td>{money(Number(row.taxable_amount || 0))}</td><td>{money(Number(row.tax_collected || 0))}</td><td>{money(Number(row.gross_turnover || 0))}</td></tr>)}</tbody>
              </table>
            </div>
            {taxRows.length === 0 && <Empty>No Cloud tax rows were returned for the current period.</Empty>}
          </section>}
        </>}
      </div>
    </main>
  );
}

function Metric({ label, value, icon, money: isMoney, suffix }: { label: string; value: number; icon: React.ReactNode; money?: boolean; suffix?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-700">{icon}</span>
    <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-lg font-black">{isMoney ? money(value) : value}{suffix ? ` ${suffix}` : ""}</p></div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-600">{label}<span className="mt-1 block">{children}</span></label>;
}

function OrderList({ orders, action }: { orders: Order[]; action?: (order: Order) => React.ReactNode }) {
  if (!orders.length) return <Empty>No active Cloud orders for this branch.</Empty>;
  return <div className="mt-3 divide-y divide-slate-100">{orders.map((order) => (
    <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-bold">{order.order_number} <span className="font-normal capitalize text-slate-500">· {order.order_type.replaceAll("_", " ")}{order.table_number ? ` · Table ${order.table_number}` : ""}</span></p>
        <p className="text-xs text-slate-500">Kitchen: {order.kitchen_status || "pending"} · Payment: {order.payment_status}</p>
        <p className="truncate text-xs text-slate-500">{(order.items || []).map((item) => `${item.quantity}× ${item.product_name}`).join(", ")}</p>
      </div>
      <div className="flex items-center gap-3"><strong>{money(order.grand_total)}</strong>{action?.(order)}</div>
    </div>
  ))}</div>;
}

function ActionButton({ children, disabled, onClick, tone = "primary" }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; tone?: "primary" | "muted" | "danger" }) {
  const styles = tone === "danger" ? "bg-red-700 text-white" : tone === "muted" ? "border border-slate-300 text-slate-700" : "bg-slate-900 text-white";
  return <button type="button" disabled={disabled} onClick={onClick} className={`min-h-9 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${styles}`}>{children}</button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{children}</p>;
}
