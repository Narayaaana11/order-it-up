# Food Delivery Aggregators & UPI Payment Integration Guide

This document specifies the technical architecture, operational flows, and production deployment guide for third-party online delivery aggregators (Swiggy, Zomato) and dynamic Unified Payments Interface (UPI) integration in **Order It Up**.

---

## 1. Architectural Overview

```mermaid
flowchart TD
    subgraph Inbound Webhook
        SW[Swiggy / Zomato Cloud] -->|HMAC-SHA256 Signed POST| WH[/api/webhooks/:platform/order]
        WH --> AuthCheck{Verify HMAC Secret}
        AuthCheck -->|Valid| Ingest[ingestAggregatorOrder]
        AuthCheck -->|Invalid| R401[401 Unauthorized]
        Ingest --> DB[(SQLite DB)]
        Ingest --> KDS[KDS Broadcast WebSocket]
    end

    subgraph Outbound Status Sync
        KDSAction[Staff / Kitchen Action: Accept, Ready, Dispatch, Reject] --> Enqueue[enqueueAggregatorOutbox]
        Enqueue --> OutboxTable[(aggregator_outbox)]
        Enqueue --> Drain[processAggregatorOutbox]
        Drain --> AdapterLookup{Registered Adapter}
        AdapterLookup -->|Mock / Sandbox| Sim[MockAggregatorAdapter]
        AdapterLookup -->|Production Partner API| Live[Swiggy / Zomato Live API]
        Sim --> UpdateOutbox[Mark 'sent' or increment 'attempts']
        Live --> UpdateOutbox
    end
```

Order It Up implements an **offline-first outbox pattern** (`aggregator_outbox`). Even if the local restaurant loses internet connectivity, staff kitchen decisions (accept, ready, reject, dispatch) commit locally immediately and queue into SQLite. When network connectivity restores, the outbox worker drains pending actions to delivery partner APIs.

---

## 2. Inbound Webhook Specifications

### 2.1 Swiggy Partner Webhook
- **Endpoint:** `POST /api/webhooks/swiggy/order`
- **Signature Header:** `x-swiggy-signature`
- **Signing Algorithm:** `HMAC-SHA256(payload_body, webhook_secret)`
- **Behavior:**
  - Validates signature against configured `aggregator_configs.webhook_secret`.
  - Normalizes order items, packaging charges, taxes, delivery instructions.
  - Idempotent: repeat deliveries with the same `external_order_id` return the existing order.
  - Automatically deducts inventory recipe ingredients (`product_recipes`, `raw_ingredients`). If ingredient stock is insufficient, auto-accept falls back to `pending` for staff review.

### 2.2 Zomato Partner Webhook
- **Endpoint:** `POST /api/webhooks/zomato/order`
- **Signature Header:** `x-zomato-signature` (or `x-zomato-auth`)
- **Signing Algorithm:** `HMAC-SHA256(payload_body, webhook_secret)`
- **Behavior:** Normalizes Zomato cart items, rider status, and order totals into POS orders.

### 2.3 Delivery Partner / Rider Webhook
- **Endpoint:** `POST /api/webhooks/:platform/rider`
- **Payload:** `{ order_id: string, status: string, rider: { name: string, phone: string } }`
- Updates rider details (`rider_name`, `rider_phone`, `rider_status`) and broadcasts to KDS.

---

## 3. Outbound Aggregator Outbox Sync (D7 Resolution)

When staff interact with aggregator orders on the POS or KDS:
1. **Accept Order** (`POST /api/aggregators/orders/:id/accept`):
   - Updates order status to `preparing` with estimated prep time.
   - Enqueues action `accept` with `prep_time_minutes` to `aggregator_outbox`.
   - Sends notification to delivery partner so rider dispatch timing is scheduled.
2. **Food Ready for Pickup** (`POST /api/aggregators/orders/:id/ready`):
   - Updates order status to `ready`.
   - Enqueues action `ready`.
   - Alerts assigned rider that food is packed and ready on the restaurant counter.
3. **Dispatch / Handover** (`POST /api/aggregators/orders/:id/dispatch`):
   - Updates order status to `completed` and `rider_status` to `dispatched`.
   - Enqueues action `dispatch`.
4. **Reject / Cancel** (`POST /api/aggregators/orders/:id/reject`):
   - Updates order status to `cancelled` and records cancellation reason.
   - Enqueues action `reject`.

### Outbox Retry & Management Endpoints
- **List Outbox:** `GET /api/aggregators/outbox?status=pending|sent|failed`
- **Manual Retry:** `POST /api/aggregators/outbox/retry`

---

## 4. Production Partner API Credentials & Setup

To transition from the built-in mock simulator to live partner APIs, the restaurant owner must obtain production credentials from merchant portals:

| Platform | Required Credentials | Production Gateway Base URL |
|---|---|---|
| **Swiggy Partner** | `SWIGGY_PARTNER_ID`, `SWIGGY_CLIENT_ID`, `SWIGGY_CLIENT_SECRET`, `SWIGGY_WEBHOOK_SECRET` | `https://partner.swiggy.com/api/v2/` |
| **Zomato Partner** | `ZOMATO_RESTAURANT_ID`, `ZOMATO_API_KEY`, `ZOMATO_WEBHOOK_SECRET` | `https://api.zomato.com/v1/partner/` |
| **UrbanPiper Hub** *(Alternative aggregator gateway)* | `UP_API_KEY`, `UP_USERNAME`, `UP_LOCATION_ID` | `https://api.urbanpiper.com/v1/` |

> [!IMPORTANT]
> Live partner credentials must never be committed to source control. Configure them in the restaurant POS Settings page or inject via environment variables.

---

## 5. Dynamic UPI QR & Payment Reconciliation

Order It Up generates dynamic, bill-specific UPI QR codes adhering to NPCI (National Payments Corporation of India) standards.

### 5.1 Canonical UPI URI Format
```text
upi://pay?pa=restaurant@bank&pn=MerchantName&am=450.00&cu=INR&tn=Bill%20INV-1024&tr=INV-1024
```
- `pa`: Payee VPA (validated against `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$`).
- `pn`: Payee business legal or operating name.
- `am`: Exact bill total in Indian Rupees (e.g., `450.00`).
- `cu`: Currency code (`INR`).
- `tn`: Transaction note printed on customer's banking app.
- `tr`: Unique transaction / bill reference (used to reconcile incoming credit).

### 5.2 Real-Time Payment Reconciliation
- **API Endpoint:** `POST /api/bills/:id/upi-reconcile`
- **Soundbox / Webhook Callback:** `POST /api/bills/upi-webhook`
- When a payment gateway or audio soundbox (Paytm, PhonePe, BharatPe) notifies the POS:
  1. Validates payment status (`SUCCESS`).
  2. Matches bill by `bill_id` or `bill_number` (`tr`).
  3. Verifies that received amount covers bill total.
  4. Records payment under `payment_method = 'upi'`, stores 12-digit bank UTR (`utr`), and marks bill `paid`.
  5. Automatically writes tamper-evident audit record (`action = 'BILL_PAYMENT'`).
