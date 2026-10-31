"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Standard health status representation for Order It Up local background services.
 */
export interface BackendHealthStatus {
  mode: "live" | "standalone";
  checkedAt: string;
  apiConnected: boolean;
  kdsConnected: boolean;
  waiterConnected: boolean;
  latencyMs?: number;
}

/**
 * Target probe endpoints for Order It Up desktop services.
 */
export interface BackendProbeEndpoints {
  api: string;
  kds: string;
  waiter: string;
}

/**
 * Granular probe result for an individual service endpoint.
 */
export interface EndpointProbeResult {
  connected: boolean;
  latencyMs?: number;
  service?: string;
  version?: string;
  error?: string;
}

/**
 * Options for configuring the backend detector hook.
 */
export interface BackendDetectorOptions {
  /** Check interval in milliseconds when page is visible (default: 30000 = 30s). Set to 0 to disable periodic check. */
  intervalMs?: number;
  /** Timeout per endpoint check in milliseconds (default: 1500 = 1.5s). */
  timeoutMs?: number;
  /** Custom endpoint URLs overriding defaults. */
  endpoints?: Partial<BackendProbeEndpoints>;
  /** Automatically probe on component mount (default: true). */
  autoCheck?: boolean;
}

/**
 * Complete return value of the `useBackendDetector` hook.
 */
export interface UseBackendDetectorReturn {
  status: BackendHealthStatus;
  isChecking: boolean;
  recheck: () => Promise<BackendHealthStatus>;
  details: {
    api: EndpointProbeResult;
    kds: EndpointProbeResult;
    waiter: EndpointProbeResult;
  };
  isHttps: boolean;
}

export const DEFAULT_BACKEND_ENDPOINTS: BackendProbeEndpoints = {
  api: "http://127.0.0.1:3001/api/health",
  kds: "http://127.0.0.1:3002/api/health",
  waiter: "http://127.0.0.1:3003/api/health",
};

export const DEFAULT_PROBE_TIMEOUT_MS = 1500;
export const DEFAULT_CHECK_INTERVAL_MS = 30000;

export const INITIAL_HEALTH_STATUS: BackendHealthStatus = {
  mode: "standalone",
  checkedAt: "",
  apiConnected: false,
  kdsConnected: false,
  waiterConnected: false,
  latencyMs: undefined,
};

const INITIAL_DETAILS: {
  api: EndpointProbeResult;
  kds: EndpointProbeResult;
  waiter: EndpointProbeResult;
} = {
  api: { connected: false },
  kds: { connected: false },
  waiter: { connected: false },
};

/**
 * Probes a single HTTP endpoint with strict AbortController timeout and total error isolation.
 * Guarantees zero unhandled promise rejections even if blocked by Mixed Content or CORS.
 */
export async function probeSingleEndpoint(
  url: string,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
  parentSignal?: AbortSignal
): Promise<EndpointProbeResult> {
  const controller = new AbortController();
  let timerId: ReturnType<typeof setTimeout> | null = null;

  // Propagate parent signal abort if provided
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  timerId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      mode: "cors",
    });

    const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime;
    const latencyMs = Math.max(1, Math.round(elapsed));

    if (response.ok) {
      let data: Record<string, unknown> | null = null;
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        // Fall back to clean status if response body is empty or non-JSON
      }

      return {
        connected: true,
        latencyMs,
        service: typeof data?.service === "string" ? data.service : "Order It Up Local Service",
        version: typeof data?.version === "string" ? data.version : undefined,
      };
    }

    return {
      connected: false,
      latencyMs,
      error: `HTTP ${response.status} ${response.statusText}`,
    };
  } catch (error: unknown) {
    const isAbort =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("aborted"));

    return {
      connected: false,
      error: isAbort ? `Timeout after ${timeoutMs}ms` : "Network / Mixed Content blocked",
    };
  } finally {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}

/**
 * Pure async function to probe all 3 Order It Up services concurrently.
 * Usable inside or outside React components (e.g. in state stores or scripts).
 */
export async function checkBackendHealth(
  endpoints?: Partial<BackendProbeEndpoints>,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
  parentSignal?: AbortSignal
): Promise<{
  status: BackendHealthStatus;
  details: {
    api: EndpointProbeResult;
    kds: EndpointProbeResult;
    waiter: EndpointProbeResult;
  };
}> {
  const targetEndpoints: BackendProbeEndpoints = {
    ...DEFAULT_BACKEND_ENDPOINTS,
    ...endpoints,
  };

  const [apiResult, kdsResult, waiterResult] = await Promise.all([
    probeSingleEndpoint(targetEndpoints.api, timeoutMs, parentSignal),
    probeSingleEndpoint(targetEndpoints.kds, timeoutMs, parentSignal),
    probeSingleEndpoint(targetEndpoints.waiter, timeoutMs, parentSignal),
  ]);

  const apiConnected = apiResult.connected;
  const kdsConnected = kdsResult.connected;
  const waiterConnected = waiterResult.connected;
  const isAnyConnected = apiConnected || kdsConnected || waiterConnected;

  // Latency is taken from POS API if connected, or fastest connected service
  let latencyMs: number | undefined;
  if (apiConnected && apiResult.latencyMs !== undefined) {
    latencyMs = apiResult.latencyMs;
  } else {
    const validLatencies = [apiResult.latencyMs, kdsResult.latencyMs, waiterResult.latencyMs].filter(
      (l): l is number => typeof l === "number"
    );
    if (validLatencies.length > 0) {
      latencyMs = Math.min(...validLatencies);
    }
  }

  const status: BackendHealthStatus = {
    mode: isAnyConnected ? "live" : "standalone",
    checkedAt: new Date().toISOString(),
    apiConnected,
    kdsConnected,
    waiterConnected,
    latencyMs,
  };

  return {
    status,
    details: {
      api: apiResult,
      kds: kdsResult,
      waiter: waiterResult,
    },
  };
}

/**
 * Client-side React hook for probing local Order It Up backend services.
 * Features:
 * - 1500ms AbortController timeout per check
 * - Total Mixed Content & CORS safety on Cloudflare Pages
 * - Manual `recheck()` trigger
 * - Visibility-aware periodic polling (default 30s, paused when page is hidden)
 * - Safe for static export SSR hydration
 */
export function useBackendDetector(
  options: BackendDetectorOptions = {}
): UseBackendDetectorReturn {
  const {
    intervalMs = DEFAULT_CHECK_INTERVAL_MS,
    timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    endpoints,
    autoCheck = true,
  } = options;

  const [status, setStatus] = useState<BackendHealthStatus>(INITIAL_HEALTH_STATUS);
  const [details, setDetails] = useState(INITIAL_DETAILS);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const activeControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";

  const recheck = useCallback(async (): Promise<BackendHealthStatus> => {
    // Abort any currently in-flight check
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;

    if (isMountedRef.current) {
      setIsChecking(true);
    }

    try {
      const result = await checkBackendHealth(endpoints, timeoutMs, controller.signal);

      if (isMountedRef.current && !controller.signal.aborted) {
        setStatus(result.status);
        setDetails(result.details);
      }
      return result.status;
    } finally {
      if (isMountedRef.current && activeControllerRef.current === controller) {
        setIsChecking(false);
        activeControllerRef.current = null;
      }
    }
  }, [endpoints, timeoutMs]);

  useEffect(() => {
    isMountedRef.current = true;

    // Helper to start/restart interval
    const startPeriodicPolling = () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      if (intervalMs > 0) {
        intervalIdRef.current = setInterval(() => {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            return; // Pause check while hidden
          }
          recheck();
        }, intervalMs);
      }
    };

    // Helper to stop interval
    const stopPeriodicPolling = () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };

    // Visibility listener: pause when tab hidden, resume & recheck when visible
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;

      if (document.visibilityState === "visible") {
        recheck();
        startPeriodicPolling();
      } else {
        stopPeriodicPolling();
      }
    };

    if (autoCheck) {
      recheck();
    }

    startPeriodicPolling();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isMountedRef.current = false;
      stopPeriodicPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
    };
  }, [autoCheck, intervalMs, recheck]);

  return {
    status,
    isChecking,
    recheck,
    details,
    isHttps,
  };
}

/**
 * Helper to generate human-readable status badge label.
 */
export function getBackendStatusLabel(status: BackendHealthStatus): string {
  if (status.mode === "live") {
    const connectedList: string[] = [];
    if (status.apiConnected) connectedList.push(":3001 POS");
    if (status.kdsConnected) connectedList.push(":3002 KDS");
    if (status.waiterConnected) connectedList.push(":3003 Waiter");
    const suffix = status.latencyMs ? ` (${status.latencyMs}ms)` : "";
    return `Live Engine Active: ${connectedList.join(" • ")}${suffix}`;
  }
  return "Standalone Simulation Mode • Offline Edge Sandbox";
}
