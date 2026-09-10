# Order It Up (OIU) — Subscription Architecture

## Commercial Model
Order It Up is a commercial paid subscription software tailored for Indian food-service businesses.

## Subscription States
```
  [ TRIAL ] ──(Trial Expires)──> [ ACTIVE ] (Upon Payment)
                                     │
                             (Payment Fails)
                                     │
                                     ▼
                              [ PAST DUE ]
                                     │
                             (Grace Period: 7 Days)
                                     │
                                     ▼
                              [ SUSPENDED ]
                                     │
                              (After 30 Days)
                                     │
                                     ▼
                              [ CANCELLED ]
```

## Entitlements & Plan Limits
- **Starter Plan**: Single POS terminal, local thermal printing, core billing, GST reporting.
- **Pro Plan**: Multi-terminal POS, KDS station routing, WhatsApp digital receipts, inventory management.
- **Enterprise Plan**: Multi-outlet chain reporting, centralized menu distribution, priority SLA support.

## Offline Grace Policy
If a restaurant terminal loses internet connection at the renewal date, the POS grants a **7-day local offline grace period** to ensure food service operations are never interrupted during business hours.
