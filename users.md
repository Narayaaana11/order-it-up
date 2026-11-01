# Order It Up — User Roles, Credentials & Platform Access Matrix

This document provides a comprehensive reference of all user types, roles, operational credentials, security scopes, and client application boundaries across the **Order It Up** ecosystem.

---

## 1. Architectural Boundary: POS vs. Web Platform

Order It Up enforces a strict separation between **Point of Sale (POS) Billing** and **Web SaaS & CRM Management**:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            ORDER IT UP ECOSYSTEM                                │
├──────────────────────────┬──────────────────────────┬────────────────────────────┤
│   1. DESKTOP POS CLIENT  │   2. MOBILE POS APP      │   3. CLOUD WEB APPLICATION │
│   (Electron / Node 22)   │   (Flutter Android/iOS)  │   (Next.js 16 / React 19)  │
├──────────────────────────┼──────────────────────────┼────────────────────────────┤
│ • Counter POS Billing    │ • Waiter Table Ordering  │ • Public Landing Page      │
│ • Local SQLite Database  │ • Real-time Floor Map    │ • Business Registration    │
│ • ESC/POS Thermal Print  │ • Kitchen Chef Live KDS  │ • SaaS HQ Franchise Portal │
│ • 24V Cash Drawer Pulse  │ • KDS Ticket Bumping     │ • CRM & Loyalty Management │
│ • Barcode & Weight Scale │ • Mobile POS Checkout    │ • Owner/Manager Dashboards │
│ • 100% Offline Resilience│ • Cloud Edge Connected   │ • Sales & Financial Audits │
│                          │                          │ • Master Catalog & Menus   │
│                          │                          │ • Staff Onboarding & Roles │
│                          │                          │ ⛔ NO WEB POS BILLING      │
└──────────────────────────┴──────────────────────────┴────────────────────────────┘
```

> [!IMPORTANT]
> **No Web-Based POS Billing:**
> POS billing is **strictly supported only on the Desktop App (Electron)** and the **Mobile POS App (Flutter)**.
> The Web Application (`https://orderitup.pages.dev` / `localhost:3000`) is dedicated exclusively to **Landing**, **Registration**, **SaaS Control Plane**, **CRM & Customer Relationship Management**, **Owner/Manager Dashboards**, **Financial/Tax Auditing**, and **Staff Management**.

---

## 2. All User Roles & Operational Personas

The system features **10 primary operational personas** categorized into Central SaaS Operators, Restaurant Enterprise Staff, and Customers:

| Persona | Internal Role Key | Primary Client App | Operational Scope & Authority |
| :--- | :--- | :--- | :--- |
| **Super Administrator** | `SUPER_ADMIN` / `super_admin` | Web Cloud HQ Portal | Central SaaS platform operator. Global tenant lifecycle, billing subscriptions, database health, audit logs. |
| **Central Admin** | `ADMIN` / `admin` | Web Cloud HQ Portal | SaaS platform operations, enterprise support escalation, onboarding assistance. |
| **Finance Operator** | `FINANCE` | Web Cloud HQ Portal | SaaS subscription billing, payment reconciliation, franchise royalty audits. |
| **Support Operator** | `SUPPORT` | Web Cloud HQ Portal | Technical troubleshooting, pairing token regeneration, device diagnostics. |
| **Auditor** | `READ_ONLY` | Web Cloud HQ Portal | Read-only inspection of tenant metrics, compliance logs, and security trails. |
| **Restaurant Owner** | `owner` | Web Dashboard & Desktop App | Full authority over restaurant organization, branches, menus, taxes, staff, and finances. |
| **Branch Manager** | `manager` / `branch_manager` | Web Dashboard & Desktop App | Operational supervisor for assigned branch: staff shifts, refunds, discounts, table floorplans. |
| **Accountant** | `accountant` | Web Cloud Dashboard | Financial reports, GST/tax summaries (CGST, SGST, IGST), ledger auditing, Tally XML export. Blocked from billing. |
| **Cashier** | `cashier` | **Desktop POS App** (& Flutter) | Counter billing, split tenders (Cash, UPI QR, Card), cash drawer management, shift closures. |
| **Server / Waiter** | `server` / `waiter` | **Flutter Mobile App** | Table ordering, course firing, modifier selection (spice, allergies), digital table status. |
| **Kitchen Chef** | `chef` / `kitchen` | **Flutter KDS App** & Desktop KDS | Live order ticket queue, ticket bumping (`queued` → `preparing` → `ready`), station routing. |
| **Delivery Driver** | `delivery` | Mobile Driver App | Dispatch routing, customer address navigation, delivery status updates, cash-on-delivery collection. |
| **Customer / Guest** | `customer` | Mobile Browser (QR Dining) | Contactless digital menu browsing, table self-ordering, payment via UPI QR. |

---

## 3. Account Provisioning & Authentication

Order It Up does not ship public shared operator credentials or a production demo-password list.

- **Restaurant owners and staff:** create accounts through the configured cloud registration flow. Passwords are stored as password hashes; never share or commit real passwords.
- **Google sign-in:** requires a Google Identity Services Web client ID in the frontend build and the matching `GOOGLE_CLIENT_ID` Worker variable. Google identity tokens are verified by the Cloud API before an account is linked or created.
- **Central SaaS operators:** provision named operators explicitly with `OIU_ADMIN_OPERATORS_JSON`, using bcrypt password hashes, and set `OIU_ADMIN_JWT_SECRET` to a strong secret of at least 32 characters. There are no fallback operators or default admin passwords. Central admin login remains disabled until both settings are valid.
- **Local POS owner:** create the initial owner through the local setup wizard.
- **Manager authorization:** set and rotate PINs from the authenticated local staff/permissions settings. Do not rely on a shared default PIN.

Never put production passwords, API keys, signing secrets, or reusable session tokens in this repository or in public documentation.

---

## 4. Platform Access & Role Permissions Matrix

| Route / Capability | Super Admin | Owner | Manager | Accountant | Cashier | Server | Chef |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Landing & Register** (`/`, `/auth/*`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cloud HQ Multi-Branch** (`/cloud-portal`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Owner Dashboard** (`/dashboard`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CRM & Customers** (`/customers`) | ✅ | ✅ | ✅ | ❌ | View | ❌ | ❌ |
| **WhatsApp Marketing** (`/whatsapp`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **AI Insights & Analytics** (`/ai-insights`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Sales & Tax Reports** (`/reports`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Menu & Catalog** (`/products`, `/menu`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Table Layout** (`/tables`) | ✅ | ✅ | ✅ | ❌ | View | View | ❌ |
| **Staff Management** (`/staff`) | ✅ | ✅ | Branch Only | ❌ | ❌ | ❌ | ❌ |
| **Store Settings** (`/settings`) | ✅ | ✅ | Partial | ❌ | ❌ | ❌ | ❌ |
| **Desktop Counter POS Billing** | ❌ | ✅ | ✅ | ❌ | ✅ (Primary) | ❌ | ❌ |
| **Mobile Waiter Table Ordering** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ (Primary) | ❌ |
| **Kitchen Display (KDS)** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (Primary) |

---

## 5. Security & Authentication Implementation

1. **Scrypt Cryptographic Hashing**:
   - Production Cloud API hashes all passwords with cryptographic `scrypt`:
     `scrypt$N=16384,r=8,p=1$<salt_hex>$<derived_key_hex>` using a 16-byte random salt.
   - Timing-safe buffer comparisons prevent side-channel timing attacks.

2. **Bcrypt for Local Storage**:
   - Local Express API salts and hashes passwords using `bcrypt` (10 rounds).

3. **Rate Limiting & Account Protection**:
   - Cloud Edge Worker enforces sliding-window IP rate limiting via Cloudflare Workers KV.
   - 5 failed login attempts trigger an automatic 5-minute cooldown lockout.

4. **Hardware Terminal Pairing**:
   - Desktop and Mobile terminals authenticate using ephemeral **6-digit cryptographic PINs** generated in the Cloud HQ Portal (`Terminals > Pair Device`).
   - Pairing tokens expire after 10 minutes and produce scoped JWT bearer tokens stored in secure client storage.

