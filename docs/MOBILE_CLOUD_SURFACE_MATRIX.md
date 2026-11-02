# Mobile ↔ Cloud surface matrix

**Source of truth:** `mobile/lib/services/api_service.dart`, checked by `npm run check:mobile-cloud`.
**Last check:** 35 mobile endpoints — 29 Cloud, 5 local-only, 1 partner-gated, 0 unclassified.

The Flutter app runs in two modes: a Cloud session (bearer token present) and a LAN session (desktop server). This matrix records which endpoints each mode can use and what the UI must show when a surface is unavailable.

## Cloud-backed (served by the Worker)

| Area | Endpoints |
|---|---|
| Session | `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/refresh` |
| Orders | `/api/orders`, `/api/orders/:id/items`, `/api/orders/:id/payments` |
| Floor | `/api/tables`, `/api/held-orders`, `/api/held-orders/:id` |
| Kitchen | `/api/kitchen/tickets`, `/api/kitchen/tickets/:id/status` |
| Payments | `/api/cash-closures` |
| Menu | `/api/products`, `/api/categories`, `/api/inventory/ingredients` |
| People | `/api/customers`, `/api/crm/lookup`, `/api/staff` |
| Ops | `/api/expenses`, `/api/reservations`, `/api/delivery`, `/api/shifts` |
| Reporting | `/api/reports` (financial summary + top products) |
| Cloud tools | `/api/cloud/catalog`, `/api/cloud/catalog/override`, `/api/cloud/overview`, `/api/cloud/transfers`, `/api/cloud/transfers/:id/status` |
| Devices | `/api/pos/pair`, `/api/health` |

Kitchen status aliases are accepted: `waiting` → `pending`, `served` → `completed`. The Flutter KDS maps Cloud states back to its display vocabulary.

## Local/LAN-only (must not be presented as Cloud features)

| Endpoint | Why |
|---|---|
| `/api/kds`, `/api/kds/:id/status` | Legacy desktop KDS; Cloud uses `/api/kitchen/tickets` |
| `/api/server-app/info` | LAN server discovery |
| `/api/whatsapp/status` | WhatsApp is configured on the restaurant server |
| `/api/ai/prep-recommendations` | Desktop/local AI assistant; no Cloud model service |

## Partner-gated

| Endpoint | Why |
|---|---|
| `/api/aggregators/orders`, `/api/aggregators/orders/:id/:action` | Swiggy/Zomato ingestion requires partner certification and live credentials |

## UI expectations

- In Cloud mode, a local-only or partner-gated surface must render an explicit unavailable state with the reason above — never a fabricated number or a silent empty success.
- Network failures keep the last known data and expose a retry.
- Adding a new mobile endpoint requires either a Cloud route, a mobile-compat adapter, or an explicit entry here and in `scripts/check-mobile-cloud-parity.cjs`; otherwise CI fails.
