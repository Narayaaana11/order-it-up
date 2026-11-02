#!/usr/bin/env node
/**
 * Static parity check between the Flutter API client and the Cloud Worker.
 *
 * Every `/api/...` path used by the mobile client must be either:
 *  - supported by a Cloud route prefix,
 *  - an explicit mobile compatibility adapter,
 *  - intentionally local/LAN-only, or
 *  - blocked on a partner integration.
 *
 * New mobile endpoints that fit none of these fail this check, so a screen
 * cannot silently start calling a route that only exists on the desktop LAN API.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mobileFile = path.join(root, 'mobile', 'lib', 'services', 'api_service.dart');
const source = fs.readFileSync(mobileFile, 'utf8');

const endpoints = [...source.matchAll(/\.(get|post|put|patch|delete)\(\s*['"](\/api\/[^'"]+)['"]/g)]
  .map((match) => match[2].split('?')[0].replace(/\$\{[^}]+\}|\$[A-Za-z0-9_]+/g, ':id'))
  .map((value) => value.replace(/\/+$/, ''));

const unique = [...new Set(endpoints)].sort();

// Cloud route prefixes present in apps/cloud-api/src (index + route modules).
const SUPPORTED = [
  '/api/health',
  '/api/ready',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/setup',
  '/api/branches',
  '/api/restaurants',
  '/api/memberships',
  '/api/orders',
  '/api/tables',
  '/api/kitchen/tickets',
  '/api/customers',
  '/api/customers-search',
  '/api/crm/lookup',
  '/api/held-orders',
  '/api/cash-closures',
  '/api/payments',
  '/api/products',
  '/api/categories',
  '/api/menu-csv',
  '/api/staff',
  '/api/expenses',
  '/api/vendors',
  '/api/reservations',
  '/api/inventory',
  '/api/delivery',
  '/api/shifts',
  '/api/reports',
  '/api/accountant',
  '/api/analytics',
  '/api/catalog',
  '/api/cloud',
  '/api/addon-groups',
  '/api/transfers',
  '/api/pairing',
  '/api/pos',
  '/api/qr',
  '/api/subscription',
  '/api/pilot',
  '/api/platform-admin',
];

// Endpoints intentionally not served by Cloud, with the reason shown to users.
const LOCAL_ONLY = {
  '/api/ai/prep-recommendations': 'Desktop/local AI assistant; Cloud has no model service.',
  '/api/whatsapp/status': 'WhatsApp integration is configured on the local restaurant server.',
  '/api/server-app/info': 'LAN server discovery/info is desktop-only.',
  '/api/kds': 'Legacy LAN KDS endpoint; Cloud uses /api/kitchen/tickets.',
};

const PARTNER_GATED = {
  '/api/aggregators/orders': 'Swiggy/Zomato ingestion requires partner certification and live credentials.',
};

function matchesPrefix(endpoint, prefix) {
  return endpoint === prefix || endpoint.startsWith(`${prefix}/`);
}

const rows = unique.map((endpoint) => {
  const supported = SUPPORTED.find((prefix) => matchesPrefix(endpoint, prefix));
  if (supported) return { endpoint, status: 'cloud', detail: supported };
  const local = Object.keys(LOCAL_ONLY).find((prefix) => matchesPrefix(endpoint, prefix));
  if (local) return { endpoint, status: 'local-only', detail: LOCAL_ONLY[local] };
  const partner = Object.keys(PARTNER_GATED).find((prefix) => matchesPrefix(endpoint, prefix));
  if (partner) return { endpoint, status: 'partner-gated', detail: PARTNER_GATED[partner] };
  return { endpoint, status: 'UNCLASSIFIED', detail: 'No Cloud route or explicit classification.' };
});

const width = Math.max(...rows.map((row) => row.endpoint.length));
for (const row of rows) {
  console.log(`${row.endpoint.padEnd(width)}  ${row.status.padEnd(13)}  ${row.detail}`);
}

const unclassified = rows.filter((row) => row.status === 'UNCLASSIFIED');
console.log(`\n${rows.length} mobile endpoints checked: ${rows.filter((row) => row.status === 'cloud').length} Cloud, ${rows.filter((row) => row.status === 'local-only').length} local-only, ${rows.filter((row) => row.status === 'partner-gated').length} partner-gated.`);

if (unclassified.length > 0) {
  console.error(`\nUnclassified mobile endpoints:\n- ${unclassified.map((row) => row.endpoint).join('\n- ')}`);
  console.error('Add a Cloud route, a mobile-compat adapter, or an explicit reason in scripts/check-mobile-cloud-parity.cjs and docs/MOBILE_CLOUD_SURFACE_MATRIX.md.');
  process.exitCode = 1;
}
