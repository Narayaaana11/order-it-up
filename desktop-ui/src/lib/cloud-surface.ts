/**
 * Navigation gate for surfaces that only exist in the desktop POS.
 *
 * In the Cloud web/tablet build these pages call LAN-only endpoints (settings,
 * WhatsApp integration, the local AI assistant, aggregator ingestion). Showing
 * them in the sidebar produces dead dashboards, so the web navigation hides them
 * until a Cloud equivalent exists.
 */
export const DESKTOP_ONLY_ROUTES = [
  '/ai-insights',
  '/online-orders',
  '/whatsapp',
  '/settings',
] as const;

export function isDesktopOnlyRoute(href: string): boolean {
  const path = href.split('?')[0];
  return DESKTOP_ONLY_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

/** True when the route should be hidden for the current runtime. */
export function shouldHideInCloud(href: string, isElectron: boolean): boolean {
  return !isElectron && isDesktopOnlyRoute(href);
}
