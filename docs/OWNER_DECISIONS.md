# Business Owner Decision Log & Architecture Choices

This document tracks strategic business, licensing, compliance, and integration decisions that require executive/owner confirmation.

---

## 1. Decision Log

### Decision OD-1: Software Licensing Model
- **Issue:** Tension between open MIT license and commercial subscription features (Defect D9).
- **Options Evaluated:** Open-Core (MIT + Proprietary Add-ons), Business Source License (BSL 1.1), AGPLv3, Closed Commercial EULA. See [docs/LICENSE_OPTIONS.md](LICENSE_OPTIONS.md).
- **Default Baseline Implemented:** Kept `LICENSE` as MIT for current pre-release tester base. Subscription checks implemented in `main/middleware/subscription-gate.ts` with graceful offline fallback.
- **Action Required by Owner:** Choose between Open-Core or BSL 1.1 prior to commercial v1.0 general public release.

---

### Decision OD-2: Payment Gateway & UPI Soundbox Provider
- **Issue:** Which Indian payment aggregator and soundbox hardware to standardize for automatic payment reconciliation?
- **Options Evaluated:**
  - **Paytm Payment Gateway & Soundbox 4G** (Widespread merchant footprint, simple webhook callbacks)
  - **PhonePe POS & SmartSpeaker** (Strong UPI market share)
  - **Razorpay POS / PineLabs Plutus Smart** (Enterprise card + dynamic UPI)
- **Default Baseline Implemented:** Universal NPCI Dynamic UPI QR code generator (`main/services/upi.ts`) with open reconciliation webhook (`POST /api/webhooks/upi`) compatible with any webhook-enabled soundbox or gateway.
- **Action Required by Owner:** Sign merchant aggregator contract with preferred provider and inject production webhook URL.

---

### Decision OD-3: Food Aggregator Integration Strategy
- **Issue:** Whether to integrate directly with Swiggy/Zomato Partner APIs or through an aggregator middleware hub like UrbanPiper.
- **Options Evaluated:**
  - **Direct Partner API:** No monthly per-order SaaS tax to third parties, but requires separate onboarding and review with Swiggy and Zomato developer partnerships.
  - **UrbanPiper Hub (Atlas / Prime):** Single integration covers Swiggy, Zomato, Magicpin, and ONDC, but incurs monthly SaaS fees per store.
- **Default Baseline Implemented:** Implemented standardized `AggregatorAdapter` interface with mock sandbox simulator and SQLite outbox retry queue. See [docs/AGGREGATORS.md](AGGREGATORS.md).
- **Action Required by Owner:** Decide on direct partner contracts vs UrbanPiper aggregator subscription.

---

### Decision OD-4: WhatsApp Provider Strategy
- **Issue:** Baileys library reverse-engineers WhatsApp Web and carries WhatsApp account ban risks if spammed.
- **Options Evaluated:**
  - **Official Meta Cloud API (Graph API v21.0):** 0% ban risk, official green tick support, compliant with Meta Business terms, pay-per-conversation pricing.
  - **Baileys Web Client:** Free, no Meta developer setup needed, but risk of merchant phone number suspension.
- **Default Baseline Implemented:** Dual provider architecture: Official Meta Cloud API adapter (`main/services/whatsapp-cloud.ts`) with mock/sandbox mode, alongside Baileys. See [docs/WHATSAPP.md](WHATSAPP.md).
- **Action Required by Owner:** Create Meta Business Manager app and configure Cloud API credentials for production restaurants.
