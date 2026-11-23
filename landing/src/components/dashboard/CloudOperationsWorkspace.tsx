"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, CalendarDays, ChefHat, CircleDollarSign, ClipboardList, LoaderCircle,
  Package, Plus, Receipt, RefreshCw, Store, Truck, Utensils, Wallet, X,
  Users, UserCheck, Building2, QrCode, Printer, Split, Check, Search, KeyRound, Copy
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getCloudApiBase, setStoredUser } from "@/lib/auth";
import { ThermalReceiptModal, ReceiptOrder } from "./ThermalReceiptModal";

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
type PaymentCapabilities = { cash: boolean; card: boolean; upi: boolean; provider: string | null; configured: boolean; reason: string | null };
type Closure = { id: string; closure_date: string; expected_cash: number; actual_cash: number; variance: number; closed_by: string; closed_at: string };

type StaffMember = { id: string; name: string; email: string | null; role: string; is_active: number; branch_id: string | null; created_at: string };
type Customer = { id: string; name: string; phone: string; email?: string | null; notes?: string | null; total_spent?: number; visits_count?: number; last_visit_at?: string | null };
type Vendor = { id: string; name: string; contact_person?: string | null; phone?: string | null; email?: string | null; gstin?: string | null; address?: string | null; balance?: number; status?: string };

type TabKey = "floor" | "reservations" | "kitchen" | "cashier" | "inventory" | "expenses" | "delivery" | "reports" | "staff" | "customers" | "vendors";

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

type RazorpayInstance = { open: () => void };

function loadRazorpayCheckout(): Promise<void> {
  const scope = window as unknown as { Razorpay?: unknown };
  if (scope.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The payment provider checkout could not be loaded. No payment was recorded."));
    document.body.appendChild(script);
  });
}

export function CloudOperationsWorkspace({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const router = useRouter();
  const role = user.role.toLowerCase();

  const canFloor = ["owner", "admin", "manager", "branch_manager", "super_admin", "cashier", "server", "waiter", "host"].includes(role);
  const canKitchen = ["owner", "admin", "manager", "branch_manager", "super_admin", "chef", "kitchen"].includes(role);
  const canCashier = ["owner", "admin", "manager", "branch_manager", "super_admin", "cashier"].includes(role);
  const canInventory = ["owner", "admin", "manager", "branch_manager", "super_admin"].includes(role);
  const canExpenses = ["owner", "admin", "manager", "branch_manager", "super_admin", "cashier"].includes(role);
  const canDelivery = ["owner", "admin", "manager", "branch_manager", "super_admin", "cashier", "delivery"].includes(role);
  const canReports = ["owner", "admin", "manager", "branch_manager", "super_admin", "accountant"].includes(role);
  const canCreateOrder = ["owner", "admin", "manager", "branch_manager", "super_admin", "cashier", "server", "waiter"].includes(role);
  const canStaff = ["owner", "admin", "manager", "branch_manager", "super_admin"].includes(role);
  const canCustomers = ["owner", "admin", "manager", "branch_manager", "super_admin", "cashier", "server", "waiter"].includes(role);
  const canVendors = ["owner", "admin", "manager", "branch_manager", "super_admin"].includes(role);

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string; icon: React.ReactNode }[] = [];
    if (canFloor) list.push({ key: "floor", label: "Floor & orders", icon: <Utensils size={16} /> });
    if (canFloor) list.push({ key: "reservations", label: "Reservations", icon: <CalendarDays size={16} /> });
    if (canKitchen) list.push({ key: "kitchen", label: "Kitchen", icon: <ChefHat size={16} /> });
    if (canCashier) list.push({ key: "cashier", label: "Cashier & shift", icon: <CircleDollarSign size={16} /> });
    if (canInventory) list.push({ key: "inventory", label: "Inventory", icon: <Package size={16} /> });
    if (canExpenses) list.push({ key: "expenses", label: "Expenses", icon: <Receipt size={16} /> });
    if (canDelivery) list.push({ key: "delivery", label: "Delivery", icon: <Truck size={16} /> });
    if (canCustomers) list.push({ key: "customers", label: "Customers", icon: <UserCheck size={16} /> });
    if (canVendors) list.push({ key: "vendors", label: "Vendors", icon: <Building2 size={16} /> });
    if (canStaff) list.push({ key: "staff", label: "Staff", icon: <Users size={16} /> });
    if (canReports) list.push({ key: "reports", label: "Reports", icon: <ClipboardList size={16} /> });
    return list;
  }, [canCashier, canCustomers, canDelivery, canExpenses, canFloor, canInventory, canKitchen, canReports, canStaff, canVendors]);

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
  const [capabilities, setCapabilities] = useState<PaymentCapabilities | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [taxRows, setTaxRows] = useState<Record<string, unknown>[]>([]);

  // Staff, Customer & Vendor state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", role: "server", branch_id: "" });
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [vendorForm, setVendorForm] = useState({ name: "", contact_person: "", phone: "", email: "", gstin: "", address: "" });

  // Interactive Modals State
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<ReceiptOrder | null>(null);
  const [selectedQrTable, setSelectedQrTable] = useState<Table | null>(null);
  const [splitOrder, setSplitOrder] = useState<Order | null>(null);
  const [splitAmounts, setSplitAmounts] = useState<{ cash: string; cardUpi: string }>({ cash: "0", cardUpi: "0" });
  const [qrCopied, setQrCopied] = useState(false);

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

  const [reservationForm, setReservationForm] = useState({
    customer_name: "",
    customer_phone: "",
    guest_count: 2,
    reservation_date: todayIso(),
    reservation_time: "19:30",
    table_id: "",
    notes: "",
  });

  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    unit: "kg",
    current_stock: "0",
    minimum_stock: "0",
    cost_per_unit: "0",
  });

  const [adjusting, setAdjusting] = useState<{ id: string; name: string; unit: string } | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("1");
  const [adjustmentReason, setAdjustmentReason] = useState("Restock");

  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "0",
    category_id: "",
    payment_method: "cash",
  });

  const [shiftForm, setShiftForm] = useState({
    actual_cash: "0",
    notes: "",
  });

  const activeBranch = branches.find((branch) => branch.id === branchId) || branches[0];
  const availableTables = useMemo(() => tables.filter((table) => table.status === "available"), [tables]);
  const currentProduct = useMemo(() => products.find((product) => product.id === productId), [products, productId]);

  const loadBranches = useCallback(async () => {
    const result = await cloudRequest<{ branches?: Branch[] }>(user, "/api/branches");
    const list = result.branches || [];
    setBranches(list);
    if (list[0]?.id && !branchId) setBranchId(list[0].id);
    return list;
  }, [branchId, user]);

  const loadCatalog = useCallback(async (id: string) => {
    if (!id) return;
    const result = await cloudRequest<{ catalog?: { categories?: { products?: Product[] }[] } }>(
      user,
      `/api/catalog/effective?branch_id=${encodeURIComponent(id)}`,
    );
    const catalogProducts = (result.catalog?.categories || []).flatMap((category) => category.products || []);
    setProducts(catalogProducts.filter((product) => (product.is_active ?? 1) === 1));
  }, [user]);

  const refreshOperational = useCallback(async (id: string) => {
    if (!id) return;
    const failures: unknown[] = [];
    if (canFloor) {
      try {
        const tablesResult = await cloudRequest<{ tables?: Table[] }>(user, `/api/tables?branch_id=${encodeURIComponent(id)}`);
        setTables(tablesResult.tables || []);
      } catch (tableError) { failures.push(tableError); }
    }
    if (canFloor || canCashier) {
      try {
        const ordersResult = await cloudRequest<{ orders?: Order[] }>(user, `/api/orders?branch_id=${encodeURIComponent(id)}`);
        setOrders(ordersResult.orders || []);
      } catch (orderError) { failures.push(orderError); }
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
        attempt(cloudRequest<PaymentCapabilities>(user, "/api/payments/capabilities"), (result) => setCapabilities(result)),
      ]);
    }
    if (key === "staff") {
      await attempt(cloudRequest<{ staff?: StaffMember[] }>(user, "/api/staff"), (result) => setStaffList(result.staff || []));
    }
    if (key === "customers") {
      await attempt(cloudRequest<{ customers?: Customer[] }>(user, `/api/customers${customerSearch ? `?q=${encodeURIComponent(customerSearch)}` : ""}`), (result) => setCustomerList(result.customers || []));
    }
    if (key === "vendors") {
      await attempt(cloudRequest<{ vendors?: Vendor[] }>(user, "/api/vendors"), (result) => setVendorList(result.vendors || []));
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
  }, [customerSearch, expenseDate, reservationDate, role, user]);

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
    void refresh();
  }, [refresh]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (taskError) {
      setError(message(taskError));
    } finally {
      setBusy(false);
    }
  };

  const handleBranchSelect = (id: string) => {
    setBranchId(id);
    setTableId("");
    setDraft([]);
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([refreshOperational(id), loadCatalog(id), loadTab(id, tab)]);
      } catch (loadError) {
        setError(message(loadError));
      } finally {
        setLoading(false);
      }
    })();
  };

  const addLine = () => {
    if (!productId) return;
    const modifiers = Object.entries(selectedAddons).flatMap(([, ids]) => ids.map((id) => ({ id, quantity: 1 })));
    setDraft((current) => [...current, { product_id: productId, quantity, modifiers }]);
    setProductId("");
    setSelectedAddons({});
    setQuantity(1);
  };

  const removeLine = (index: number) => {
    setDraft((current) => current.filter((_, lineIndex) => lineIndex !== index));
  };

  const submitOrder = async () => run(async () => {
    if (!branchId) return;
    if (!draft.length) throw new Error("Add at least one item to submit an order.");
    if (orderType === "dine_in" && !tableId) throw new Error("A dine-in order requires an available table.");
    if (orderType === "delivery" && !deliveryAddress.trim()) throw new Error("A delivery order requires a drop-off address.");

    const key = `orderitup.cloud-order:${user.id}:${Date.now()}`;
    await cloudRequest(user, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        branch_id: branchId,
        order_type: orderType,
        table_id: orderType === "dine_in" ? tableId : null,
        delivery_address: orderType === "delivery" ? deliveryAddress : null,
        items: draft,
        idempotency_key: key,
      }),
    });
    setDraft([]);
    setTableId("");
    setDeliveryAddress("");
    setNotice("Order placed and queued for the kitchen.");
    await refreshOperational(branchId);
  });

  const setTableState = (table: Table, status: string) => run(async () => {
    await cloudRequest(user, `/api/tables/${encodeURIComponent(table.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setNotice(`Table ${table.table_number} marked ${status}.`);
    await refreshOperational(branchId);
  });

  const advanceTicket = (ticket: Ticket, nextStatus: string) => run(async () => {
    await cloudRequest(user, `/api/kitchen/tickets/${encodeURIComponent(ticket.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    setNotice(`Ticket ${ticket.order_number} marked ${nextStatus}.`);
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

  const collectProvider = async (order: Order) => {
    setBusy(true);
    setError("");
    try {
      if (!capabilities?.configured) {
        throw new Error(capabilities?.reason || "The payment provider is not configured for this environment.");
      }
      const summary = await cloudRequest<{ outstanding_balance: number }>(user, `/api/orders/${encodeURIComponent(order.id)}/payments`);
      const amount = Number(summary.outstanding_balance);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("This order has no outstanding balance.");

      const storageKey = `orderitup.cloud-intent:${user.id}:${order.id}`;
      let idempotencyKey = localStorage.getItem(storageKey);
      if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); localStorage.setItem(storageKey, idempotencyKey); }

      const created = await cloudRequest<{ intent: { id: string; provider_order_id: string; amount: number; currency: string }; provider: { key_id: string } }>(
        user,
        `/api/orders/${encodeURIComponent(order.id)}/payment-intent`,
        { method: "POST", body: JSON.stringify({ amount, idempotency_key: idempotencyKey }) },
      );

      await loadRazorpayCheckout();
      const scope = window as unknown as { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance };
      if (!scope.Razorpay) throw new Error("The payment provider checkout is unavailable. No payment was recorded.");

      await new Promise<void>((resolve, reject) => {
        const checkout = new scope.Razorpay!({
          key: created.provider.key_id,
          amount: Math.round(created.intent.amount * 100),
          currency: created.intent.currency,
          name: "Order It Up",
          description: `Bill ${order.order_number}`,
          order_id: created.intent.provider_order_id,
          handler: (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
            void (async () => {
              try {
                const verified = await cloudRequest<{ order_payment_status: string }>(user, "/api/payments/verify", {
                  method: "POST",
                  body: JSON.stringify({
                    intent_id: created.intent.id,
                    provider_payment_id: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                  }),
                });
                localStorage.removeItem(storageKey);
                setNotice(`Card/UPI payment verified for ${order.order_number} (${verified.order_payment_status}).`);
                await Promise.allSettled([refreshOperational(branchId), loadTab(branchId, "cashier")]);
                resolve();
              } catch (verifyError) {
                setError(message(verifyError));
                reject(verifyError);
              }
            })();
          },
          modal: {
            ondismiss: () => {
              setNotice("Provider checkout was dismissed. No non-cash payment was recorded; the intent remains for a safe retry.");
              resolve();
            },
          },
        });
        checkout.open();
      });
    } catch (providerError) {
      setError(message(providerError));
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

  const openSplitModal = (order: Order) => {
    setSplitOrder(order);
    const half = (order.grand_total / 2).toFixed(2);
    setSplitAmounts({ cash: half, cardUpi: (order.grand_total - Number(half)).toFixed(2) });
  };

  const executeSplitPayment = async () => run(async () => {
    if (!splitOrder) return;
    const cashAmt = Number(splitAmounts.cash);
    const cardAmt = Number(splitAmounts.cardUpi);
    if (cashAmt < 0 || cardAmt < 0) throw new Error("Tender amounts cannot be negative.");
    if (Math.abs(cashAmt + cardAmt - splitOrder.grand_total) > 0.05) {
      throw new Error(`Total split tenders must equal the order total ${money(splitOrder.grand_total)}.`);
    }

    if (cashAmt > 0) {
      const key = `orderitup.split-cash:${user.id}:${splitOrder.id}:${Date.now()}`;
      await cloudRequest(user, `/api/orders/${encodeURIComponent(splitOrder.id)}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: cashAmt, payment_method: "cash", idempotency_key: key }),
      });
    }

    if (cardAmt > 0) {
      const key = `orderitup.split-card:${user.id}:${splitOrder.id}:${Date.now()}`;
      await cloudRequest(user, `/api/orders/${encodeURIComponent(splitOrder.id)}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: cardAmt, payment_method: "card", idempotency_key: key }),
      });
    }

    await cloudRequest(user, `/api/orders/${encodeURIComponent(splitOrder.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });

    setSplitOrder(null);
    setNotice(`Split payment recorded for ${splitOrder.order_number}.`);
    await Promise.allSettled([refreshOperational(branchId), loadTab(branchId, "cashier")]);
  });

  // Staff actions
  const createStaff = async () => run(async () => {
    if (!staffForm.name.trim() || !staffForm.email.trim() || !staffForm.password) {
      throw new Error("Name, email, and password (at least 8 chars) are required.");
    }
    await cloudRequest(user, "/api/staff", {
      method: "POST",
      body: JSON.stringify({ ...staffForm, branch_id: branchId || null }),
    });
    setStaffForm({ name: "", email: "", password: "", role: "server", branch_id: "" });
    setNotice("Staff member added successfully.");
    await loadTab(branchId, "staff");
  });

  const resetStaffPassword = async (staffId: string) => {
    const newPass = window.prompt("Enter new password for this staff member (minimum 8 characters):");
    if (!newPass) return;
    if (newPass.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }
    await run(async () => {
      await cloudRequest(user, `/api/staff/${encodeURIComponent(staffId)}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPass }),
      });
      setNotice("Staff password reset successfully.");
    });
  };

  const toggleStaffStatus = async (staff: StaffMember) => run(async () => {
    const nextStatus = staff.is_active ? 0 : 1;
    await cloudRequest(user, `/api/staff/${encodeURIComponent(staff.id)}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: nextStatus }),
    });
    setNotice(`Staff member ${staff.name} ${nextStatus ? "reactivated" : "deactivated"}.`);
    await loadTab(branchId, "staff");
  });

  // Customer actions
  const createCustomer = async () => run(async () => {
    if (!customerForm.name.trim() || !customerForm.phone.trim()) {
      throw new Error("Customer name and phone number are required.");
    }
    await cloudRequest(user, "/api/customers", {
      method: "POST",
      body: JSON.stringify(customerForm),
    });
    setCustomerForm({ name: "", phone: "", email: "", notes: "" });
    setNotice("Customer registered in CRM.");
    await loadTab(branchId, "customers");
  });

  // Vendor actions
  const createVendor = async () => run(async () => {
    if (!vendorForm.name.trim()) throw new Error("Vendor supplier name is required.");
    await cloudRequest(user, "/api/vendors", {
      method: "POST",
      body: JSON.stringify(vendorForm),
    });
    setVendorForm({ name: "", contact_person: "", phone: "", email: "", gstin: "", address: "" });
    setNotice("Vendor supplier created successfully.");
    await loadTab(branchId, "vendors");
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
        quantity: Number(adjustmentQuantity),
        reason: adjustmentReason,
      }),
    });
    setAdjusting(null);
    setNotice(`Stock adjustment recorded for ${adjusting.name}.`);
    await loadTab(branchId, "inventory").catch(() => undefined);
  });

  const recordExpense = async () => run(async () => {
    if (!branchId) return;
    if (!expenseForm.description.trim()) throw new Error("Expense description is required.");
    await cloudRequest(user, "/api/expenses", {
      method: "POST",
      body: JSON.stringify({
        branch_id: branchId,
        description: expenseForm.description,
        amount: Number(expenseForm.amount),
        category_id: expenseForm.category_id || null,
        payment_method: expenseForm.payment_method,
        expense_date: expenseDate,
      }),
    });
    setExpenseForm({ description: "", amount: "0", category_id: "", payment_method: "cash" });
    setNotice("Expense transaction posted.");
    await loadTab(branchId, "expenses").catch(() => undefined);
  });

  const voidExpense = (expense: Expense) => run(async () => {
    await cloudRequest(user, `/api/expenses/${encodeURIComponent(expense.id)}`, { method: "DELETE" });
    setNotice(`Expense '${expense.description}' was voided.`);
    await loadTab(branchId, "expenses").catch(() => undefined);
  });

  const closeShift = async () => run(async () => {
    if (!branchId) return;
    await cloudRequest(user, "/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({
        branch_id: branchId,
        actual_cash: Number(shiftForm.actual_cash),
        notes: shiftForm.notes,
      }),
    });
    setNotice("Shift closed and cash drawer variance reconciled.");
    await loadTab(branchId, "cashier").catch(() => undefined);
  });

  const updateDeliveryJob = (job: DeliveryJob, status: string) => run(async () => {
    await cloudRequest(user, `/api/delivery/jobs/${encodeURIComponent(job.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setNotice(`Delivery job ${job.order_number || job.id} marked ${status.replace("_", " ")}.`);
    await refreshOperational(branchId).catch(() => undefined);
  });

  return (
    <main className="min-h-screen bg-slate-100/60 pb-12 font-sans text-slate-900">
      {/* Thermal Receipt Modal */}
      {selectedReceiptOrder && (
        <ThermalReceiptModal
          order={selectedReceiptOrder}
          branchName={activeBranch?.name}
          onClose={() => setSelectedReceiptOrder(null)}
        />
      )}

      {/* Table QR Code Dialog */}
      {selectedQrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center">
            <button
              type="button"
              onClick={() => setSelectedQrTable(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 mx-auto rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Table {selectedQrTable.table_number} QR Code</h3>
            <p className="text-xs text-slate-500 mt-1">Customers scan this code to browse menu & place orders.</p>

            <div className="my-5 p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://orderitup.in/qr?branch=${branchId}&table=${selectedQrTable.table_number}`)}`}
                alt={`Table ${selectedQrTable.table_number} QR`}
                className="w-40 h-40 object-contain rounded-md"
              />
            </div>

            <p className="text-[11px] font-mono text-slate-600 truncate bg-slate-100 p-2 rounded-lg mb-4">
              https://orderitup.in/qr?table={selectedQrTable.table_number}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`https://orderitup.in/qr?branch=${branchId}&table=${selectedQrTable.table_number}`);
                  setQrCopied(true);
                  setTimeout(() => setQrCopied(false), 2000);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {qrCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{qrCopied ? "Link Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Payment Dialog */}
      {splitOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
            <button
              type="button"
              onClick={() => setSplitOrder(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Split className="w-5 h-5 text-orange-600" />
              <h3 className="text-base font-black text-slate-900">Split Tender Settlement</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Split order <strong>{splitOrder.order_number}</strong> balance across multiple payment methods.
            </p>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl mb-4 text-xs flex justify-between">
              <span className="font-semibold text-orange-950">Total Bill Amount:</span>
              <span className="font-black text-orange-950 text-sm">{money(splitOrder.grand_total)}</span>
            </div>

            <div className="space-y-3 mb-6">
              <Field label="Portion 1: Cash Amount (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={splitAmounts.cash}
                  onChange={(e) => {
                    const val = e.target.value;
                    const rem = Math.max(0, splitOrder.grand_total - Number(val)).toFixed(2);
                    setSplitAmounts({ cash: val, cardUpi: rem });
                  }}
                  className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold"
                />
              </Field>
              <Field label="Portion 2: Card / UPI Amount (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={splitAmounts.cardUpi}
                  onChange={(e) => {
                    const val = e.target.value;
                    const rem = Math.max(0, splitOrder.grand_total - Number(val)).toFixed(2);
                    setSplitAmounts({ cash: rem, cardUpi: val });
                  }}
                  className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold"
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSplitOrder(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executeSplitPayment()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                Confirm Split Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 font-black text-white shadow-xs">OIU</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black leading-tight sm:text-lg">Unified Cloud Operations</h1>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">Cloud Live</span>
              </div>
              <p className="text-xs text-slate-500">{user.name} · Role: <span className="font-bold capitalize">{user.role}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(event) => handleBranchSelect(event.target.value)}
              className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => void refresh()}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh live data"
            >
              <RefreshCw size={14} className={loading || busy ? "animate-spin text-orange-600" : ""} />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        {/* Navigation Tabs */}
        <nav aria-label="Operations workspace sections" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setTab(item.key); void loadTab(branchId, item.key); }}
              aria-current={tab === item.key ? "page" : undefined}
              className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold cursor-pointer ${
                tab === item.key ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Notices and Alerts */}
        {error && (
          <div role="alert" className="mt-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-900">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="p-1 hover:text-red-700"><X size={14} /></button>
          </div>
        )}
        {notice && (
          <div role="status" className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} className="p-1 hover:text-emerald-700"><X size={14} /></button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm font-semibold text-slate-500">
            <LoaderCircle size={18} className="animate-spin text-orange-600" />
            <span>Syncing Cloud branch data…</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: FLOOR & ORDERS                                             */}
        {/* ================================================================= */}
        {!loading && branchId && tab === "floor" && <>
          <section className="grid gap-3 sm:grid-cols-3 mt-4">
            <Metric label="Active orders" value={orders.length} icon={<Activity size={18} />} />
            <Metric label="Unpaid orders" value={orders.filter((order) => order.payment_status !== "paid").length} icon={<CircleDollarSign size={18} />} />
            <Metric label="Occupied tables" value={tables.filter((table) => table.status === "occupied").length} icon={<Utensils size={18} />} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><Utensils size={20} className="text-orange-600" />Floor plan & Table QR</h2>
            <p className="mt-1 text-sm text-slate-500">Seat walk-ins, clear tables, or generate digital table QR codes for customer self-ordering.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {tables.map((table) => (
                <div key={table.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <p className="font-black text-slate-900">Table {table.table_number}</p>
                  <p className="text-xs capitalize text-slate-500">{table.status} · {table.capacity || 4} seats</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {table.status !== "occupied" && (
                      <button type="button" disabled={busy} onClick={() => void setTableState(table, "occupied")} className="min-h-7 rounded-md bg-slate-900 px-2 text-[11px] font-bold text-white disabled:opacity-50 cursor-pointer">
                        Seat
                      </button>
                    )}
                    {table.status === "occupied" && (
                      <button type="button" disabled={busy} onClick={() => void setTableState(table, "available")} className="min-h-7 rounded-md border border-slate-300 px-2 text-[11px] font-bold disabled:opacity-50 cursor-pointer">
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedQrTable(table)}
                      className="min-h-7 rounded-md border border-orange-200 bg-orange-50 px-2 text-[11px] font-bold text-orange-700 hover:bg-orange-100 flex items-center gap-1 cursor-pointer"
                      title="View Table QR Code"
                    >
                      <QrCode size={12} /> QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {tables.length === 0 && <Empty>No active tables are configured for this branch yet.</Empty>}
          </section>

          {canCreateOrder && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
              <h2 className="flex items-center gap-2 text-lg font-black"><Plus size={20} className="text-orange-600" />{role === "cashier" ? "Create counter order" : "Create waiter order"}</h2>
              <p className="mt-1 text-sm text-slate-500">Menu items and modifiers are fetched directly from Cloud D1.</p>
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
                {orderType === "dine_in" && (
                  <label className="text-xs font-bold text-slate-600">Available table
                    <select value={tableId} onChange={(event) => setTableId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm">
                      <option value="">Choose table</option>
                      {availableTables.map((table) => <option key={table.id} value={table.id}>Table {table.table_number} · {table.capacity || 4} seats</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button type="button" onClick={addLine} disabled={!productId} className="min-h-10 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
                  Add line item
                </button>
              </div>

              {draft.length > 0 && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold uppercase text-slate-700 mb-2">Cart Lines ({draft.length})</h4>
                  <div className="space-y-1.5">
                    {draft.map((line, idx) => {
                      const prod = products.find((p) => p.id === line.product_id);
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-200">
                          <span>{line.quantity}× {prod?.name} ({money((prod?.base_price || 0) * line.quantity)})</span>
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-600 hover:text-red-800 font-bold p-1">Remove</button>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" disabled={busy} onClick={() => void submitOrder()} className="mt-3 w-full py-2.5 rounded-lg bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs cursor-pointer shadow-xs">
                    Fire Order to Kitchen
                  </button>
                </div>
              )}
            </section>
          )}
        </>}

        {/* ================================================================= */}
        {/* TAB 2: CASHIER & SHIFT                                            */}
        {/* ================================================================= */}
        {!loading && branchId && tab === "cashier" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><CircleDollarSign size={20} className="text-orange-600" />Cashier payment queue</h2>
            <p className="mt-1 text-sm text-slate-500">Record cash, card/UPI, or split tender payments. Print formatted 80mm thermal receipts upon settlement.</p>
            {capabilities && !capabilities.configured && <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"><strong>Card/UPI unavailable.</strong> {capabilities.reason}</p>}
            {capabilities?.configured && <p className="mt-2 text-xs font-semibold text-emerald-800">Card/UPI provider ready ({capabilities.provider}).</p>}

            <OrderList orders={orders} action={(order) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" disabled={busy} onClick={() => void (order.payment_status === "paid" ? closePaidOrder(order) : collectCash(order))} className="min-h-8 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
                  {order.payment_status === "paid" ? "Close Order" : "Cash"}
                </button>
                {order.payment_status !== "paid" && (capabilities?.card || capabilities?.upi) && (
                  <button type="button" disabled={busy} onClick={() => void collectProvider(order)} className="min-h-8 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
                    Card/UPI
                  </button>
                )}
                {order.payment_status !== "paid" && (
                  <button type="button" disabled={busy} onClick={() => openSplitModal(order)} className="min-h-8 rounded-lg bg-orange-600 hover:bg-orange-700 px-3 text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                    <Split size={12} /> Split
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReceiptOrder(order as unknown as ReceiptOrder)}
                  className="min-h-8 rounded-lg border border-slate-300 hover:bg-slate-100 px-3 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Print Thermal Receipt"
                >
                  <Printer size={12} /> Bill
                </button>
              </div>
            )} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
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

        {/* ================================================================= */}
        {/* TAB 3: STAFF & ROLES                                              */}
        {/* ================================================================= */}
        {!loading && branchId && tab === "staff" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><Users size={20} className="text-orange-600" />Restaurant Staff Directory</h2>
            <p className="mt-1 text-sm text-slate-500">Manage employee accounts, roles, branch assignments, and secure password resets.</p>

            {/* Add Staff Form */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Add New Employee</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Full Name">
                  <input
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Email Address">
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="ramesh@restaurant.com"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Initial Password (min 8 chars)">
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Role Permission">
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold"
                  >
                    <option value="server">Server / Waiter</option>
                    <option value="cashier">Counter Cashier</option>
                    <option value="chef">Kitchen Chef</option>
                    <option value="manager">Branch Manager</option>
                    <option value="delivery">Delivery Rider</option>
                    <option value="accountant">Accountant / Tax</option>
                  </select>
                </Field>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createStaff()}
                className="mt-3 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
              >
                Create Staff Account
              </button>
            </div>

            {/* Staff Table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500 font-bold">
                    <th className="py-2.5">Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffList.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-bold text-slate-900">{member.name}</td>
                      <td className="text-slate-600">{member.email || "—"}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                          {member.role}
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${member.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => void resetStaffPassword(member.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                        >
                          Reset Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStaffStatus(member)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                        >
                          {member.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {staffList.length === 0 && <Empty>No staff accounts found.</Empty>}
            </div>
          </section>
        </>}

        {/* ================================================================= */}
        {/* TAB 4: CUSTOMERS & CRM                                            */}
        {/* ================================================================= */}
        {!loading && branchId && tab === "customers" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><UserCheck size={20} className="text-orange-600" />Customer Registry & CRM</h2>
            <p className="mt-1 text-sm text-slate-500">Track guest visit counts, lifetime spend, and customer profiles across orders.</p>

            {/* Quick Customer Add & Search Bar */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void loadTab(branchId, "customers"); }}
                  placeholder="Search customer by name or phone..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
              <button
                type="button"
                onClick={() => void loadTab(branchId, "customers")}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Search
              </button>
            </div>

            {/* Register Customer Form */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Add Guest Profile</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Guest Name">
                  <input
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    placeholder="Priya Sharma"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Phone (10 digits)">
                  <input
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    placeholder="9876543210"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Email Address (Optional)">
                  <input
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="priya@example.com"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Dietary / Preference Notes">
                  <input
                    value={customerForm.notes}
                    onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                    placeholder="VIP table, No nuts"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createCustomer()}
                className="mt-3 px-4 py-2.5 rounded-lg bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
              >
                Save Guest Profile
              </button>
            </div>

            {/* Customers Table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500 font-bold">
                    <th className="py-2.5">Customer</th>
                    <th>Phone</th>
                    <th>Visits</th>
                    <th>Lifetime Spend</th>
                    <th>Last Visit</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerList.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-bold text-slate-900">{cust.name}</td>
                      <td className="font-mono text-xs text-slate-700">{cust.phone}</td>
                      <td className="font-semibold">{cust.visits_count || 0}</td>
                      <td className="font-bold text-emerald-700">{money(cust.total_spent || 0)}</td>
                      <td className="text-xs text-slate-500">{cust.last_visit_at ? new Date(cust.last_visit_at).toLocaleDateString() : "Never"}</td>
                      <td className="text-xs text-slate-600 max-w-[200px] truncate">{cust.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customerList.length === 0 && <Empty>No customer records found.</Empty>}
            </div>
          </section>
        </>}

        {/* ================================================================= */}
        {/* TAB 5: VENDORS & SUPPLIERS                                        */}
        {/* ================================================================= */}
        {!loading && branchId && tab === "vendors" && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><Building2 size={20} className="text-orange-600" />Raw Ingredient Suppliers & Vendors</h2>
            <p className="mt-1 text-sm text-slate-500">Manage procurement suppliers, outstanding balances, and supplier invoices.</p>

            {/* Add Vendor Form */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Add Supplier</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Vendor Company Name">
                  <input
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    placeholder="Metro Cash & Carry"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Contact Person">
                  <input
                    value={vendorForm.contact_person}
                    onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                    placeholder="Sunil Verma"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    placeholder="+91 98110 00000"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="GSTIN / Tax ID">
                  <input
                    value={vendorForm.gstin}
                    onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                    placeholder="07AAAAA0000A1Z5"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Address / City">
                  <input
                    value={vendorForm.address}
                    onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                    placeholder="Okhla Phase 3, New Delhi"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createVendor()}
                className="mt-3 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
              >
                Register Supplier
              </button>
            </div>

            {/* Vendor List */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500 font-bold">
                    <th className="py-2.5">Supplier Name</th>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th>GSTIN</th>
                    <th>Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendorList.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-bold text-slate-900">{vendor.name}</td>
                      <td className="text-slate-600">{vendor.contact_person || "—"}</td>
                      <td className="font-mono text-xs">{vendor.phone || "—"}</td>
                      <td className="font-mono text-xs text-slate-500">{vendor.gstin || "—"}</td>
                      <td className="font-bold text-slate-800">{money(vendor.balance || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vendorList.length === 0 && <Empty>No registered vendors yet.</Empty>}
            </div>
          </section>
        </>}

        {/* ================================================================= */}
        {/* OTHER TABS (Kitchen, Inventory, Expenses, Delivery, Reports)      */}
        {/* ================================================================= */}
        {!loading && branchId && tab === "kitchen" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><ChefHat size={20} className="text-orange-600" />Kitchen Display & Ticket Lifecycle</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-black">Ticket #{ticket.order_number} · <span className="capitalize text-slate-500">{ticket.status}</span></p>
                    <p className="text-xs text-slate-600">{ticket.items.map((i) => `${i.quantity || 1}× ${i.name || i.product_name}`).join(", ")}</p>
                  </div>
                  <div className="flex gap-2">
                    {ticket.status === "pending" && <button type="button" onClick={() => void advanceTicket(ticket, "preparing")} className="min-h-8 rounded-md bg-amber-600 text-white font-bold text-xs px-3">Prep</button>}
                    {ticket.status === "preparing" && <button type="button" onClick={() => void advanceTicket(ticket, "ready")} className="min-h-8 rounded-md bg-emerald-600 text-white font-bold text-xs px-3">Ready</button>}
                    {ticket.status === "ready" && <button type="button" onClick={() => void advanceTicket(ticket, "served")} className="min-h-8 rounded-md bg-slate-900 text-white font-bold text-xs px-3">Served</button>}
                  </div>
                </div>
              ))}
              {tickets.length === 0 && <Empty>Kitchen queue is clear.</Empty>}
            </div>
          </section>
        )}

        {!loading && branchId && tab === "reservations" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><CalendarDays size={20} className="text-orange-600" />Reservations</h2>
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Book Table</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Guest Name"><input value={reservationForm.customer_name} onChange={(e) => setReservationForm({ ...reservationForm, customer_name: e.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Phone"><input value={reservationForm.customer_phone} onChange={(e) => setReservationForm({ ...reservationForm, customer_phone: e.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Guests"><input type="number" min={1} max={50} value={reservationForm.guest_count} onChange={(e) => setReservationForm({ ...reservationForm, guest_count: Number(e.target.value) || 2 })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Time"><input type="time" value={reservationForm.reservation_time} onChange={(e) => setReservationForm({ ...reservationForm, reservation_time: e.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              </div>
              <button type="button" disabled={busy} onClick={() => void createReservation()} className="mt-3 px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs">Create Booking</button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {reservations.map((r) => (
                <div key={r.id} className="py-2.5 flex justify-between items-center text-sm">
                  <div><strong>{r.customer_name}</strong> · {r.guest_count} guests at {r.reservation_time} ({r.status})</div>
                  <div className="flex gap-1.5">
                    {r.status === "confirmed" && <button type="button" onClick={() => void moveReservation(r, "seated")} className="px-2 py-1 text-xs font-bold bg-emerald-700 text-white rounded-md">Seat</button>}
                    {r.status !== "cancelled" && <button type="button" onClick={() => void moveReservation(r, "cancelled")} className="px-2 py-1 text-xs border border-slate-300 rounded-md">Cancel</button>}
                  </div>
                </div>
              ))}
              {reservations.length === 0 && <Empty>No reservations for this date.</Empty>}
            </div>
          </section>
        )}

        {!loading && branchId && tab === "inventory" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><Package size={20} className="text-orange-600" />Raw Inventory & Recipe Costing</h2>
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">New Raw Ingredient</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Ingredient"><input value={ingredientForm.name} onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })} placeholder="Basmati Rice" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Unit"><input value={ingredientForm.unit} onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })} placeholder="kg" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Stock"><input type="number" value={ingredientForm.current_stock} onChange={(e) => setIngredientForm({ ...ingredientForm, current_stock: e.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Cost / Unit"><input type="number" value={ingredientForm.cost_per_unit} onChange={(e) => setIngredientForm({ ...ingredientForm, cost_per_unit: e.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
              </div>
              <button type="button" disabled={busy} onClick={() => void createIngredient()} className="mt-3 px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs">Add Ingredient</button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b text-xs uppercase text-slate-500 font-bold"><th className="py-2">Item</th><th>Stock</th><th>Min Stock</th><th>Cost</th></tr></thead>
                <tbody>
                  {ingredients.map((ing) => (
                    <tr key={ing.id} className="border-b border-slate-100">
                      <td className="py-2.5 font-bold">{ing.name}</td>
                      <td>{ing.current_stock} {ing.unit}</td>
                      <td>{ing.minimum_stock} {ing.unit}</td>
                      <td>{money(ing.cost_per_unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && branchId && tab === "expenses" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><Receipt size={20} className="text-orange-600" />Branch Expenses</h2>
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Record Outflow</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Description"><input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Vendor cash purchase" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Amount"><input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /></Field>
                <Field label="Payment Method">
                  <select value={expenseForm.payment_method} onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                  </select>
                </Field>
              </div>
              <button type="button" disabled={busy} onClick={() => void recordExpense()} className="mt-3 px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs">Record Expense</button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {expenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex justify-between items-center text-sm">
                  <div><strong>{exp.description}</strong> · {exp.payment_method}</div>
                  <div className="flex items-center gap-3"><span className="font-bold text-red-700">{money(exp.amount)}</span><button type="button" onClick={() => void voidExpense(exp)} className="text-xs text-slate-400 hover:text-red-700">Void</button></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && branchId && tab === "delivery" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><Truck size={20} className="text-orange-600" />Online Orders & Delivery Dispatch</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {deliveryJobs.map((job) => (
                <div key={job.id} className="py-3 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-bold">Order #{job.order_number || job.order_id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{job.address}</p>
                  </div>
                  <div className="flex gap-2">
                    {job.status === "assigned" && <button type="button" onClick={() => void updateDeliveryJob(job, "picked_up")} className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-md">Pick Up</button>}
                    {job.status === "picked_up" && <button type="button" onClick={() => void updateDeliveryJob(job, "delivered")} className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-md">Deliver</button>}
                  </div>
                </div>
              ))}
              {deliveryJobs.length === 0 && <Empty>No delivery dispatches at this moment.</Empty>}
            </div>
          </section>
        )}

        {!loading && branchId && tab === "reports" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 mt-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><ClipboardList size={20} className="text-orange-600" />Today at a glance</h2>
            {report && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="Sales" value={Number(report.sales || 0)} icon={<CircleDollarSign size={18} />} money />
                <Metric label="Running orders" value={Number(report.runningOrders || 0)} icon={<Activity size={18} />} />
                <Metric label="Pending orders" value={Number(report.pendingOrders || 0)} icon={<ClipboardList size={18} />} />
                <Metric label="Tables occupied" value={Number(report.tablesOccupied || 0)} icon={<Utensils size={18} />} />
                <Metric label="Avg table turn" value={Number(report.avgTableTurnMinutes || 0)} icon={<RefreshCw size={18} />} suffix="min" />
                <Metric label="Net collected" value={Number((report.financial as Record<string, unknown> | undefined)?.netCollected || 0)} icon={<Wallet size={18} />} money />
              </div>
            )}
            {taxRows.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Cloud Tax Breakdown</h3>
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b text-xs uppercase text-slate-500 font-bold"><th className="py-2">Branch</th><th>Bills</th><th>Taxable</th><th>Tax Collected</th><th>Gross</th></tr></thead>
                  <tbody>
                    {taxRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2.5 font-bold">{String(row.branch_name || "Branch")}</td>
                        <td>{Number(row.total_bills || 0)}</td>
                        <td>{money(Number(row.taxable_amount || 0))}</td>
                        <td>{money(Number(row.tax_collected || 0))}</td>
                        <td>{money(Number(row.gross_turnover || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, icon, money: isMoney, suffix }: { label: string; value: number; icon: React.ReactNode; money?: boolean; suffix?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-700">{icon}</span>
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-lg font-black">{isMoney ? money(value) : value}{suffix ? ` ${suffix}` : ""}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function OrderList({ orders, action }: { orders: Order[]; action?: (order: Order) => React.ReactNode }) {
  if (!orders.length) return <Empty>No active Cloud orders for this branch.</Empty>;
  return (
    <div className="mt-3 divide-y divide-slate-100">
      {orders.map((order) => (
        <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-bold">
              {order.order_number}{" "}
              <span className="font-normal capitalize text-slate-500">
                · {order.order_type.replaceAll("_", " ")}{order.table_number ? ` · Table ${order.table_number}` : ""}
              </span>
            </p>
            <p className="text-xs text-slate-500">Kitchen: {order.kitchen_status || "pending"} · Payment: {order.payment_status}</p>
            <p className="truncate text-xs text-slate-500">{(order.items || []).map((item) => `${item.quantity}× ${item.product_name}`).join(", ")}</p>
          </div>
          <div className="flex items-center gap-3">
            <strong>{money(order.grand_total)}</strong>
            {action?.(order)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{children}</p>;
}
