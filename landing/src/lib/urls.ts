const DEFAULT_CLOUD_APP_URL = "https://orderitup-app.pages.dev";

/**
 * Resolve the Order It Up Web App / Cloud Portal base URL and join a route path.
 * Supports NEXT_PUBLIC_OIU_CLOUD_PORTAL_URL (legacy/explicit) and NEXT_PUBLIC_OIU_APP_URL.
 */
export function getCloudPortalUrl(path = "/auth/login/"): string {
  const configured =
    process.env.NEXT_PUBLIC_OIU_CLOUD_PORTAL_URL ||
    process.env.NEXT_PUBLIC_OIU_APP_URL ||
    DEFAULT_CLOUD_APP_URL;

  const normalizedInput = configured.trim().replace(/\/+$/, "");
  // If NEXT_PUBLIC_OIU_CLOUD_PORTAL_URL already includes /auth/login, strip it when joining a path
  const base = normalizedInput.replace(/\/auth\/login$/i, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
