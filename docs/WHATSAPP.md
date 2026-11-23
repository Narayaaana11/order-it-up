# WhatsApp Business Messaging: Cloud API vs Baileys Integration

> [!NOTE]
> Resolves **Defect D11**: Mitigating account ban risk by providing the official Meta WhatsApp Cloud API provider adapter alongside Baileys.

---

## 1. Provider Comparison

| Feature | Official Meta Cloud API (`cloud_api`) | Baileys Web Client (`baileys`) |
|---|---|---|
| **Legality & Compliance** | 100% compliant with Meta WhatsApp Terms of Service | Violates WhatsApp Terms of Service (Reverse-engineered Web API) |
| **Phone Number Ban Risk** | **0% risk** — Official Meta partnership channel | **High risk** — WhatsApp bot detection algorithms frequently ban numbers |
| **Message Throughput** | Up to 80-500 messages/sec (Tiered) | Limited (~4-10 messages/min to avoid rate limits) |
| **Hardware / App Need** | Fully server-side via HTTPS. Restaurant phone does not need to be online. | Requires a linked Android/iOS smartphone running WhatsApp active on LAN. |
| **Pricing** | First 1,000 service conversations/month free; then standard Meta per-conversation rates (₹0.30 - ₹0.80 per conversation in India) | Free (excluding mobile carrier cellular cost) |
| **Templates** | Requires Meta Business Manager template pre-approval | Freeform text, no templates required |

---

## 2. Meta WhatsApp Cloud API Setup Guide

### 2.1 Prerequisites
1. A **Meta for Developers** account (`developers.facebook.com`).
2. A verified **Meta Business Account**.
3. A dedicated phone number not currently registered on personal WhatsApp.

### 2.2 Configuration in Order It Up
In the restaurant Settings page or SQLite settings table:
- `whatsapp_provider`: set to `'cloud_api'` (or `'mock'` for local testing)
- `whatsapp_phone_number_id`: Meta Phone Number ID (e.g. `104928172819281`)
- `whatsapp_business_account_id`: Meta WABA ID
- `whatsapp_access_token`: System User Permanent Access Token with `whatsapp_business_messaging` permissions.

---

## 3. Approved Template Examples (India Restaurant Operations)

### Template: `order_bill_receipt`
- **Category:** `UTILITY`
- **Language:** `en_US` (or `hi`, `te`, `ta`)
- **Body Text:**
  ```text
  Hello {{1}}, thank you for dining at {{2}}! Your bill for Order #{{3}} is ₹{{4}}. View your detailed tax invoice: {{5}}
  ```
- **Variables:**
  - `{{1}}`: Customer Name
  - `{{2}}`: Restaurant Name
  - `{{3}}`: Order Number
  - `{{4}}`: Total Amount
  - `{{5}}`: Invoice Link
