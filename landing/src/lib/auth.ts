"use client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "owner" | "manager" | "accountant" | "cashier" | "server" | "chef" | "delivery" | "customer";
  organizationId?: string;
  organizationName?: string;
  token?: string;
}

type DemoProfile = { user: AuthUser };

export const DEMO_USERS: Record<string, DemoProfile> = {
  owner: { user: { id: "preview-owner", name: "Priya Sharma", email: "owner@example.invalid", role: "owner", organizationId: "preview-org", organizationName: "Sample Restaurant" } },
  manager: { user: { id: "preview-manager", name: "Arjun Verma", email: "manager@example.invalid", role: "manager", organizationId: "preview-org", organizationName: "Sample Restaurant" } },
  accountant: { user: { id: "preview-accountant", name: "Kavita Rao", email: "accountant@example.invalid", role: "accountant", organizationId: "preview-org", organizationName: "Sample Restaurant" } },
  cashier: { user: { id: "preview-cashier", name: "Rohit Singh", email: "cashier@example.invalid", role: "cashier", organizationId: "preview-org", organizationName: "Sample Restaurant" } },
  server: { user: { id: "preview-server", name: "Aman Kapoor", email: "server@example.invalid", role: "server", organizationId: "preview-org", organizationName: "Sample Restaurant" } },
  chef: { user: { id: "preview-chef", name: "Chef Marco", email: "chef@example.invalid", role: "chef", organizationId: "preview-org", organizationName: "Sample Restaurant" } },
};

const AUTH_STORAGE_KEY = "orderitup_auth_user";
const DEMO_PREVIEW_KEY = "orderitup_demo_preview_user";
const CLOUD_API_BASE = (process.env.NEXT_PUBLIC_OIU_CLOUD_API_URL || "https://api.orderitup.in").replace(/\/$/, "");

export function getCloudApiBase(): string {
  return CLOUD_API_BASE;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const legacyToken = localStorage.getItem("token") || localStorage.getItem("cloud_token");
    if (legacyToken && (legacyToken.startsWith("demo_") || legacyToken.startsWith("demo-jwt"))) {
      localStorage.removeItem("token");
      localStorage.removeItem("cloud_token");
      localStorage.removeItem("user");
      localStorage.removeItem("tenant");
      localStorage.removeItem("orderitup_demo_auth_user");
    }
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw) as AuthUser;
      if (typeof user.token === "string" && user.token.length > 20) return user;
      // Never trust or restore old synthetic/demo tokens.
      setStoredUser(null);
    }
    const preview = sessionStorage.getItem(DEMO_PREVIEW_KEY);
    return preview ? JSON.parse(preview) as AuthUser : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      if (typeof user.token !== "string" || user.token.length < 20) {
        throw new Error("A valid cloud access token is required to create an authenticated session.");
      }
      sessionStorage.removeItem(DEMO_PREVIEW_KEY);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem("token", user.token);
      localStorage.setItem("cloud_token", user.token);
      localStorage.setItem("user", JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isOwner: user.role === "owner" || user.role === "SUPER_ADMIN",
        organization_id: user.organizationId,
        organization_name: user.organizationName,
      }));
      localStorage.setItem("tenant", JSON.stringify({
        id: user.organizationId,
        business_name: user.organizationName,
        name: user.organizationName,
        database_name: "cloud_d1",
        business_type: "restaurant",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        role: user.role,
      }));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem("token");
      localStorage.removeItem("cloud_token");
      localStorage.removeItem("user");
      localStorage.removeItem("tenant");
      sessionStorage.removeItem(DEMO_PREVIEW_KEY);
      // Remove credentials created by earlier demo builds.
      localStorage.removeItem("orderitup_demo_auth_user");
    }
    window.dispatchEvent(new Event("orderitup_auth_change"));
  } catch (error) {
    if (user) throw error;
  }
}

/** A preview is intentionally stored only in sessionStorage and never creates an API token. */
export function setDemoPreviewUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("token");
    localStorage.removeItem("cloud_token");
    localStorage.removeItem("user");
    localStorage.removeItem("tenant");
    sessionStorage.setItem(DEMO_PREVIEW_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(DEMO_PREVIEW_KEY);
  }
  window.dispatchEvent(new Event("orderitup_auth_change"));
}

export function isDemoPreviewSession(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(DEMO_PREVIEW_KEY) !== null;
}

export interface CloudAuthResponse {
  token?: string;
  access_token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: AuthUser["role"];
    organization_id: string;
    organization_name: string;
  };
  error?: string;
}

export async function authenticateWithCloud(payload: Record<string, string>, endpoint: "login" | "register"): Promise<AuthUser> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${CLOUD_API_BASE}/api/auth/${endpoint === "register" ? "register" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The authentication service took too long to respond. Please try again.");
    }
    throw new Error("Could not reach the authentication service. Check your connection and try again.");
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({})) as CloudAuthResponse;
  if (!response.ok) {
    throw new Error(data.error || (response.status === 429 ? "Too many attempts. Please try again later." : "Authentication failed."));
  }
  const token = data.token || data.access_token;
  if (!token || !data.user?.id || !data.user.email || !data.user.role) {
    throw new Error("The authentication service returned an incomplete session. Please contact support.");
  }
  const user: AuthUser = {
    id: data.user.id,
    name: data.user.name || data.user.email,
    email: data.user.email,
    role: data.user.role,
    organizationId: data.user.organization_id,
    organizationName: data.user.organization_name,
    token,
  };
  setStoredUser(user);
  return user;
}
