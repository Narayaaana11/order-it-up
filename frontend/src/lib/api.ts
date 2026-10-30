import axios from 'axios';

let authRedirectInProgress = false;

export const CLOUD_API_BASE =
  process.env.NEXT_PUBLIC_OIU_CLOUD_API_URL ||
  'https://orderitup-cloud-api.narayaaana11.workers.dev';

/**
 * Returns true if the frontend is running embedded inside the Electron desktop shell.
 */
export function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).electronAPI ||
    (window as any).process?.versions?.electron ||
    navigator.userAgent.toLowerCase().includes('electron')
  );
}

/**
 * Derives appropriate base API URL depending on deployment context:
 * - Inside Electron Desktop: Local Express server (window.location.origin/api)
 * - In Web Browser (e.g. Cloudflare Pages): Cloudflare Edge Worker API
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api';
  if (isElectronEnvironment()) {
    return `${window.location.origin}/api`;
  }
  return CLOUD_API_BASE;
}

// Default API client (adapts to environment)
const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Dedicated Cloud Edge API client (always connects to Cloudflare Worker)
export const cloudApi = axios.create({
  baseURL: CLOUD_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

function attachAuthToken(instance: typeof api) {
  instance.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token') || localStorage.getItem('cloud_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });
}

attachAuthToken(api);
attachAuthToken(cloudApi);

function handleAuthError(error: any) {
  if (error.response?.status === 401 && typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const isPublicOrAuth =
      pathname === '/' ||
      pathname.includes('/auth/login') ||
      pathname.includes('/auth/register') ||
      pathname.startsWith('/setup') ||
      pathname.startsWith('/qr') ||
      pathname.startsWith('/cloud-portal') ||
      pathname.startsWith('/kds') ||
      pathname.startsWith('/server-standalone');

    localStorage.removeItem('token');
    localStorage.removeItem('cloud_token');

    if (!isPublicOrAuth && !authRedirectInProgress) {
      authRedirectInProgress = true;
      localStorage.removeItem('tenant');
      localStorage.removeItem('user');
      window.location.replace('/auth/login');
    }
  }
  return Promise.reject(error);
}

// Handle 401 responses without infinite refresh loops
api.interceptors.response.use((response) => response, handleAuthError);
cloudApi.interceptors.response.use((response) => response, handleAuthError);

export default api;

// ── Shared Operational API Helpers ──────────────────────────────────────────

export interface SharedOrderFilter {
  status?: string;
  kitchen_status?: string;
  payment_status?: string;
  table_id?: string;
  limit?: number;
  offset?: number;
}

export async function fetchSharedOrders(branchId: string, filters: SharedOrderFilter = {}) {
  const params = new URLSearchParams({ branch_id: branchId });
  if (filters.status) params.set('status', filters.status);
  if (filters.kitchen_status) params.set('kitchen_status', filters.kitchen_status);
  if (filters.payment_status) params.set('payment_status', filters.payment_status);
  if (filters.table_id) params.set('table_id', filters.table_id);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.get(`/orders?${params.toString()}`);
  return res.data;
}

export async function fetchSharedOrder(orderId: string) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.get(`/orders/${orderId}`);
  return res.data;
}

export async function createSharedOrder(payload: any) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.post('/orders', payload);
  return res.data;
}

export async function addSharedOrderItems(orderId: string, items: any[], expectedVersion?: number) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.post(`/orders/${orderId}/items`, { items, expected_version: expectedVersion });
  return res.data;
}

export async function updateSharedOrderStatus(orderId: string, status: string, cancellationReason?: string, expectedVersion?: number) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.patch(`/orders/${orderId}/status`, {
    status,
    cancellation_reason: cancellationReason,
    expected_version: expectedVersion,
  });
  return res.data;
}

/**
 * @deprecated Direct payment status mutation is disabled to prevent financial ledger bypass.
 * Use recordCustomerPayment() to record an auditable payment transaction instead.
 */
export async function updateSharedOrderPayment(_orderId: string, _paymentStatus: string, _paymentMethod?: string): Promise<never> {
  throw new Error('updateSharedOrderPayment is deprecated: use recordCustomerPayment() to record an auditable payment transaction.');
}

export async function fetchSharedTables(branchId: string) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.get(`/tables?branch_id=${encodeURIComponent(branchId)}`);
  return res.data;
}

export async function updateSharedTableStatus(tableId: string, status: string, currentOrderId?: string | null) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.patch(`/tables/${tableId}/status`, {
    status,
    current_order_id: currentOrderId,
  });
  return res.data;
}

export async function fetchKitchenTickets(branchId: string, station?: string, status?: string) {
  const params = new URLSearchParams({ branch_id: branchId });
  if (station) params.set('station', station);
  if (status) params.set('status', status);

  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.get(`/kitchen/tickets?${params.toString()}`);
  return res.data;
}

export async function bumpKitchenTicket(ticketId: string, status: string) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.patch(`/kitchen/tickets/${ticketId}/status`, { status });
  return res.data;
}

export async function recordCustomerPayment(
  orderId: string,
  payload: {
    amount: number;
    payment_method: string;
    external_reference_id?: string | null;
    idempotency_key?: string;
    terminal_id?: string;
    metadata?: any;
  }
) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const headers: Record<string, string> = {};
  if (payload.idempotency_key) {
    headers['Idempotency-Key'] = payload.idempotency_key;
  }
  const res = await client.post(`/orders/${orderId}/payments`, payload, { headers });
  return res.data;
}

export async function fetchOrderPayments(orderId: string) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.get(`/orders/${orderId}/payments`);
  return res.data;
}

export async function refundCustomerPayment(
  orderId: string,
  paymentId: string,
  payload: { amount?: number; reason: string }
) {
  const client = isElectronEnvironment() ? api : cloudApi;
  const res = await client.post(`/orders/${orderId}/payments/${paymentId}/refund`, payload);
  return res.data;
}

/**
 * Lightweight, visibility-aware polling controller for real-time operational views.
 * Bounded intervals, pauses when backgrounded, exponential backoff on network failures.
 */
export function createPollingController(
  callback: () => Promise<void>,
  intervalMs: number = 10000
): { start: () => void; stop: () => void } {
  let timer: any = null;
  let isRunning = false;
  let consecutiveErrors = 0;

  const run = async () => {
    if (!isRunning) return;
    if (typeof document !== 'undefined' && document.hidden) {
      // Slow down polling to 60s when browser tab is inactive/minimized
      timer = setTimeout(run, 60000);
      return;
    }

    try {
      await callback();
      consecutiveErrors = 0;
    } catch {
      consecutiveErrors = Math.min(consecutiveErrors + 1, 5);
    }

    if (isRunning) {
      // Exponential backoff up to 60s
      const delay = consecutiveErrors > 0
        ? Math.min(intervalMs * Math.pow(1.5, consecutiveErrors), 60000)
        : intervalMs;
      timer = setTimeout(run, delay);
    }
  };

  return {
    start: () => {
      if (isRunning) return;
      isRunning = true;
      run();
    },
    stop: () => {
      isRunning = false;
      if (timer) clearTimeout(timer);
    },
  };
}
