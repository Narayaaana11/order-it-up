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

export const DEMO_USERS: Record<string, { email: string; pass: string; user: AuthUser }> = {
  owner: {
    email: "demo.owner@orderitup.in",
    pass: "DemoOwner2026!",
    user: {
      id: "usr_owner_01",
      name: "Priya Sharma",
      email: "demo.owner@orderitup.in",
      role: "owner",
      organizationId: "org_demo_showcase_01",
      organizationName: "The Rustic Olive Bistro & Bar",
    },
  },
  manager: {
    email: "demo.manager@orderitup.in",
    pass: "DemoManager2026!",
    user: {
      id: "usr_manager_01",
      name: "Arjun Verma",
      email: "demo.manager@orderitup.in",
      role: "manager",
      organizationId: "org_demo_showcase_01",
      organizationName: "The Rustic Olive (Connaught Place)",
    },
  },
  accountant: {
    email: "demo.accountant@orderitup.in",
    pass: "DemoAccountant2026!",
    user: {
      id: "usr_acc_01",
      name: "Kavita Rao",
      email: "demo.accountant@orderitup.in",
      role: "accountant",
      organizationId: "org_demo_showcase_01",
      organizationName: "The Rustic Olive Accounting",
    },
  },
  cashier: {
    email: "demo.cashier@orderitup.in",
    pass: "DemoCashier2026!",
    user: {
      id: "usr_cashier_01",
      name: "Rohit Singh",
      email: "demo.cashier@orderitup.in",
      role: "cashier",
      organizationId: "org_demo_showcase_01",
      organizationName: "Counter Terminal 01",
    },
  },
  server: {
    email: "demo.server@orderitup.in",
    pass: "DemoServer2026!",
    user: {
      id: "usr_server_01",
      name: "Aman Kapoor",
      email: "demo.server@orderitup.in",
      role: "server",
      organizationId: "org_demo_showcase_01",
      organizationName: "Floor Service Station",
    },
  },
  chef: {
    email: "demo.chef@orderitup.in",
    pass: "DemoChef2026!",
    user: {
      id: "usr_chef_01",
      name: "Chef Marco D.",
      email: "demo.chef@orderitup.in",
      role: "chef",
      organizationId: "org_demo_showcase_01",
      organizationName: "Main Kitchen KDS",
    },
  },
  superadmin: {
    email: "admin@orderitup.in",
    pass: "AdminPass123!",
    user: {
      id: "usr_admin_01",
      name: "Platform Administrator",
      email: "admin@orderitup.in",
      role: "SUPER_ADMIN",
      organizationId: "org_cloud_platform",
      organizationName: "Order It Up SaaS Cloud Control",
    },
  },
};

const AUTH_STORAGE_KEY = "orderitup_demo_auth_user";

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    window.dispatchEvent(new Event("orderitup_auth_change"));
  } catch {
    // ignore
  }
}

