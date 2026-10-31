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

## 3. Seed & Demo Credentials Reference

### 3.1 Central SaaS Control Plane Operators (In-Memory / Seed)
These operators manage the central multi-tenant cloud control plane (`main/admin/auth.ts`).

| Operator Name | Email Address | Role | Default Password | Environment |
| :--- | :--- | :--- | :--- | :--- |
| **Super Administrator** | `admin@orderitup.in` | `SUPER_ADMIN` | `AdminPass123!` | SaaS Production & Staging |
| **Super Administrator (Dev)** | `superadmin@orderitup.in` | `SUPER_ADMIN` | `AdminPass123!` | Local Dev & Staging |
| **Operations Admin** | `admin@orderitup.local` | `ADMIN` | `AdminPass123!` | Local Offline Engine |
| **Finance & Billing Lead** | `finance@orderitup.in` | `FINANCE` | `AdminPass123!` | Cloud HQ |
| **Technical Support Lead** | `support@orderitup.in` | `SUPPORT` | `AdminPass123!` | Cloud HQ |
| **Compliance Auditor** | `readonly@orderitup.in` | `READ_ONLY` | `AdminPass123!` | Cloud HQ |

---

### 3.2 Cloud Edge Multi-Location Staging Organization
Provisioned under organization ID `org_demo_showcase_01` (Cloudflare D1 Edge Worker):

| Persona | Email Address | Role Key | Password / Token | Portal / Client |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Organization Owner** | `demo.owner@orderitup.in` | `owner` | `DemoOwner2026!` | Web Cloud HQ & Owner Dashboard |
| **Branch Operations Manager** | `demo.manager@orderitup.in` | `manager` | `DemoManager2026!` | Web Dashboard & Desktop App |
| **Head Accountant** | `demo.accountant@orderitup.in` | `accountant` | `DemoAccountant2026!` | Web Cloud Dashboard (`/reports`) |
| **Lead Counter Cashier** | `demo.cashier@orderitup.in` | `cashier` | `DemoCashier2026!` | **Desktop POS Client** |
| **Floor Captain / Waiter** | `demo.server@orderitup.in` | `server` | `DemoServer2026!` | **Flutter Mobile App** |
| **Executive Kitchen Chef** | `demo.chef@orderitup.in` | `chef` | `DemoChef2026!` | **Flutter KDS / Standalone KDS** |

---

### 3.3 Desktop POS Client Local SQLite Store & Master PINs
For offline-first local deployment running on SQLite (`dev-server.js` or packaged Electron app):

| User / Function | Identifier | Default Credential / PIN | Details |
| :--- | :--- | :--- | :--- |
| **Initial Local Owner** | `owner@orderitup.local` | Configured during initial `/setup` wizard | Has root control over local SQLite database. |
| **Manager Authorization PIN** | Master PIN | `1234` or `9999` (Configurable in Settings) | Authorizes bill refunds, manager discounts, and shift audits. |
| **Demo Manager** | `manager@orderitup.local` | Seeded inactive with random hash | Activated via Owner staff settings (`/staff`). |
| **Demo Cashier** | `cashier@orderitup.local` | Seeded inactive with random hash | Activated via Owner staff settings (`/staff`). |
| **Demo Chef** | `chef@orderitup.local` | Seeded inactive with random hash | Activated via Owner staff settings (`/staff`). |

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

