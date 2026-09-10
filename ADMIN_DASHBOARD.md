# Order It Up (OIU) — Central Admin Dashboard

## Purpose
The Central Admin Dashboard is the administrative control plane for the Order It Up SaaS operator (US). It is completely segregated from restaurant customer POS installations.

## Core Modules
1. **Executive Dashboard**: Active stores, trial conversions, monthly recurring revenue (MRR), sync queue health, active device count.
2. **Restaurant & Outlet Manager**: Provision new restaurant accounts, assign outlets, view usage metrics, suspend/reactivate accounts.
3. **Subscription & Plan Control**: Configure Starter/Pro/Enterprise plans, trial durations, grace periods, billing cycles, manual payment overrides.
4. **Device Management & Licensing**: View all connected terminals per store, monitor app versions, approve or revoke device authorizations.
5. **Feature Flags**: Remotely enable or disable premium features (e.g. WhatsApp messaging, tableside ordering, multi-station KDS).
6. **Backup & Disaster Monitoring**: Real-time status of automated S3 snapshot uploads and health checks.
7. **Support Center**: View, assign, and resolve support tickets submitted by restaurant managers directly from their POS.
8. **Audit Trail**: Immutable append-only log of all administrative actions, logins, and permission changes.

## Security & RBAC
Access is restricted to authorized operators with granular roles:
- `SUPER_ADMIN`: Full access including financial adjustments and operator creation.
- `ADMIN`: Tenant onboarding, device management, plan assignments.
- `SUPPORT`: Read-only tenant details and support ticket resolution.
- `FINANCE`: Billing, invoices, and payment tracking.
