# Order It Up 🍽️

> **Modern, offline-first Restaurant Point of Sale (POS) and Billing Software for cafes, restaurants, bars, and food outlets.**

---

## 🌟 Overview

**Order It Up** is a full-featured Point of Sale (POS) system engineered specifically for food & beverage businesses. Designed to run locally on your counter hardware, it ensures your cash register, kitchen orders, and table service never stall, even when the internet drops.

Orders, menus, tables, customer tabs, and receipts are stored securely in a local **SQLite** database.

---

## 🚀 Key Features

* **Complete Order Workflows:** Fast checkout for Quick Service / Counter, Dine-in (with interactive floor plan), Takeaway, and Delivery orders.
* **Table & Floor Management:** Visual table maps, custom room dimensions, real-time table statuses (vacant, occupied, billed), and tableside order taking.
* **Kitchen Order Tickets (KOT) & Kitchen Display System (KDS):**
  * Real-time KDS interface accessible via any browser on the local network (`http://<ip>:3002/kds`).
  * Category-based kitchen station routing (Bar, Grill, Dessert, Main Kitchen).
* **Thermal Receipt Printing:**
  * ESC/POS direct thermal printing over USB, Local Network (TCP/IP), and Windows print spooler.
  * Standard 58mm and 80mm roll support, customizable headers, footers, tax breakdowns, and cash drawer kick pulse.
* **Menu & Inventory Management:**
  * Product categories, modifiers, add-on groups (sizes, toppings, sides), barcode scanning, and CSV import/export.
* **Staff Access & Roles:**
  * Multi-user PIN authentication with role-based permissions (Owner, Manager, Cashier, Chef).
* **Billing & Analytics:**
  * Split billing, itemized discounts, tax calculations (GST/VAT compliant), daily cash closures, and end-of-day Z-reports.
* **100% Offline-First:**
  * All core operations run entirely on your local machine with automatic SQLite database backups.

---

## 🛠️ Architecture & Tech Stack

```text
Electron Desktop Application
├── Express API & WebSockets (:3001)   — Local POS engine & business logic
├── Kitchen Display Server (:3002)     — Real-time KDS for kitchen screens
├── Waiter App Server (:3003)          — Tableside ordering for handheld tablets
└── SQLite Database (Local)            — Zero-cloud dependency, fast transactions
                 ↕ HTTP & WebSockets
Next.js Renderer Interface
└── React 19 + TypeScript + Zustand    — Touchscreen-optimized UI with Tailwind CSS
```

---

## 💻 Getting Started

### Prerequisites
* **Node.js**: v22.x LTS (recommended) or v24.x
* **npm**: v10+

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd OrderItUp

# 2. Install dependencies
npm install

# 3. Start development environment
npm run dev
```

`npm run dev` builds both the frontend interface and backend server, then launches the Electron desktop application.

---

## 🖨️ Printer Setup

1. Connect your ESC/POS thermal printer via USB or local Ethernet/Wi-Fi.
2. In **Order It Up**, navigate to **Settings → Printer Setup**.
3. Select your printer from the list or enter its local IP address.
4. Test print a receipt to verify paper width (58mm or 80mm).

---

## 📄 License

This software is released under the **MIT License**.
Distributed under permissive open-source terms. See [LICENSE](LICENSE) for details.
