# Order It Up — User Access & Role Operation Guide

This guide describes how to access, navigate, and manage the Order It Up SaaS platform across all operational personas and client environments (Web, Desktop, and Mobile).

> [!IMPORTANT]
> **No plaintext passwords are contained in this document.** Temporary credentials for the Primary Owner and QA Demo organization have been provisioned and delivered privately in the encrypted bundle:
> `deployment-private/orderitup-production-credentials.enc`

---

## 1. System Access Points

| Platform | URL / Access Method | Intended Personas | Capabilities |
| :--- | :--- | :--- | :--- |
| **Cloud Web Dashboard** | [https://orderitup.pages.dev](https://orderitup.pages.dev) | Owner, Manager, Accountant | Multi-branch management, hierarchy, live analytics, catalog |
| **Desktop POS Client** | Electron Application (`npm run dev` or packaged binary) | Cashier, Server, Manager | Offline-first billing, local SQLite, thermal ESC/POS printing |
| **Mobile POS App** | Flutter Application (Android / iOS) | Server (Waiter), Kitchen Chef, Cashier | Table ordering, KDS ticket bumping, mobile billing |

---

## 2. Role-Based Access Scopes

### 2.1 Owner (Primary Administrator)
- **Scope:** Organization-level (All restaurants and branches).
- **Primary Capabilities:**
  - Full authority over organization settings, legal entities, currency (`INR`), and timezone (`Asia/Kolkata`).
  - Creation and management of restaurant concepts and geographic branches.
  - Staff provisioning, role assignment, and access revocation.
  - Master catalog management and price authority.
  - Complete access to financial reports, ledger reconciliation, and tax summaries.
- **Login Portal:** Navigate to `https://orderitup.pages.dev/auth/login` and enter your owner email and password.

### 2.2 Manager (Restaurant & Branch Level)
- **Scope:** Assigned restaurant concept or specific branch.
- **Primary Capabilities:**
  - Operational control over assigned branch tables, active orders, and kitchen flow.
  - Staff scheduling and branch-scoped staff account provisioning.
  - Applying authorized discounts and manager overrides on bills.
  - Auditable refund approvals and cash shift closures.
  - *Restricted:* Cannot demote the organization owner or grant organization-level permissions.

### 2.3 Accountant (Financial & Compliance Scope)
- **Scope:** Organization-wide financial oversight.
- **Primary Capabilities:**
  - Real-time and historical tax summary review (CGST, SGST, IGST).
  - Cash closure audits and payment reconciliation ledgers.
  - Tally XML and CSV export for external bookkeeping.
  - *Restricted:* Blocked from POS billing operations, table management, and order modification (HTTP 403 enforced).

### 2.4 Cashier (Branch Billing Scope)
- **Scope:** Assigned branch counter.
- **Primary Capabilities:**
  - Order settlement, split payments (Cash, UPI QR, Credit/Debit card).
  - Cashier-collected and manual cashier-confirmed verification workflows.
  - Table auto-release upon bill settlement.
  - Shift cash drawer reconciliation and closure reports.
  - *Restricted:* Blocked from accountant tax summaries and staff management.

### 2.5 Server / Waiter (Branch Floor Scope)
- **Scope:** Assigned branch dining floor.
- **Primary Capabilities:**
  - Real-time table status view (Vacant, Occupied, Billed).
  - Creating dine-in orders and firing items to the kitchen display.
  - Modifying active order items before billing.
  - *Restricted:* Blocked from financial accounting reports, refunds, and discounts without manager authorization.

### 2.6 Kitchen Chef (Branch Kitchen Scope)
- **Scope:** Assigned branch kitchen.
- **Primary Capabilities:**
  - Real-time Kitchen Display System (KDS) live ticket queue.
  - Status updates: `queued` → `preparing` → `ready`.
  - Item modifier alerts (allergies, spice level, preparation notes).
  - *Restricted:* Blocked from customer billing, payments, and financial reports.

---

## 3. Staff Onboarding & Account Management

### 3.1 Inviting Real Staff Members
1. Log in to the Cloud Dashboard as **Owner** or **Manager**.
2. Navigate to **Staff & Permissions** (`/staff`) or **Memberships** (`/cloud-portal`).
3. Click **Add Staff Member** and specify:
   - **Full Name:** Real name of the employee.
   - **Email:** The employee's actual business email address.
   - **Assigned Role:** `manager`, `accountant`, `cashier`, `server`, or `chef`.
   - **Assigned Location:** Select the restaurant and branch (if branch-scoped).
   - **Initial Password:** A strong temporary password (minimum 8 characters).
4. Share the credentials securely with the employee.

### 3.2 Password Rotation & First-Login Security
- All temporary credentials must be updated upon first login.
- To update a password:
  1. Click on the profile icon in the top right navigation bar.
  2. Select **Account Security** or **Change Password**.
  3. Enter the current temporary password, followed by the new strong password twice.
  4. Passwords are salted and hashed using cryptographic `scrypt` (N=16384, r=8, p=1).

### 3.3 Switching Restaurant & Branch Context
- Multi-location merchants can switch operating context from the top navigation bar dropdown:
  1. Click on the **Branch Selector** in the dashboard header.
  2. Select any authorized restaurant or branch.
  3. All tables, orders, catalogs, and kitchen tickets dynamically re-scope to the chosen branch.

---

## 4. Connecting Clients to Production Cloud Edge

### 4.1 Connecting Desktop POS to Production
1. In the Desktop POS, navigate to **Settings > Cloud HQ Sync**.
2. Enter the Cloud API Base URL:
   ```text
   https://orderitup-cloud-api.narayaaana11.workers.dev
   ```
3. Generate a Pairing Token from the Cloud Dashboard under **Terminals > Pair Device**.
4. Enter the 6-digit cryptographic PIN on the desktop client to securely enroll the terminal.

### 4.2 Connecting Flutter Mobile POS
1. Open the Flutter app on Android or iOS.
2. On the initial connection screen, select **Cloud Edge Mode**.
3. Log in with your assigned role credentials (`server`, `chef`, or `cashier`).
4. The client will authenticate against the production Worker and cache JWT tokens in secure device storage.
