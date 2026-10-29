# 📱 Order It Up — Mobile & Tablet POS App (Flutter)

> **Fully responsive cross-platform companion app for smartphones and tablets**, built with Flutter & Dart with 100% feature parity to the **Order It Up** offline-first restaurant management desktop suite.

---

## 🌟 100% Desktop POS Capabilities Overview

This mobile application provides end-to-end operational support across all 9 restaurant operations modules:

1. **🍽️ Tables & Floor Map (`WaiterScreen`):**
   - Visual overview of all tables across floor sections (Ground Floor, Terrace, Family AC). Color-coded statuses for Available (Green), Occupied (Amber), and Billed (Blue).
   - Digital Menu Catalog: Instant search, category tabs (Starters, Mains, Biryani, Breads, Drinks, Desserts), and Veg/Non-Veg filter chips.
   - Tableside Cart & Ticket Builder: Quantity steppers, kitchen notes (e.g. *"less spicy"*), and direct KOT dispatch.
   - Live Kitchen Status Tracker: Dishes tracked across statuses: Waiting ⚪ ➔ Preparing 🔥 ➔ Ready 🔔 ➔ Served ✅.

2. **⚡ Counter Quick POS (`QuickPosScreen`):**
   - Dedicated direct sale mode for walk-ins, takeaways, and direct counter checkout without table assignment.
   - Quick customer phone lookup with automatic loyalty wallet display.
   - Direct payment selection (Cash / Card / UPI QR) and instant receipt printing.

3. **💳 Cashier & Billing Terminal (`CashierScreen`):**
   - Active order queue for open dine-in and takeaway tickets.
   - Split & discount engine (presets: 5%, 10%, 15%, 20%) and automatic GST / VAT tax calculation.
   - Multi-Payment Settlement: Cash, Card, and **Dynamic UPI QR Code modal** (Google Pay, PhonePe, Paytm, BHIM).
   - Formatted 80mm ESC/POS digital receipt preview with itemized tax and line breakdown.

4. **⏳ Held Orders Queue (`HeldOrdersScreen`):**
   - Park current carts with reason notes (e.g. *"Guest waiting for party to arrive"*).
   - 1-tap "Recall to Cart" to restore held tickets back into the active order flow.

5. **👨‍🍳 Kitchen Display System (`KdsScreen`):**
   - Real-Time Kanban tickets with SLA prep timers (<5m Fresh, 5-15m Warning, >15m Overdue alert).
   - Station routing (Main Kitchen, Grill Station, Bar, Dessert).
   - 1-tap ticket bump progression: `Waiting ➔ Start Cooking ➔ Mark Ready ➔ Served (Bump)`.

6. **👥 Customer CRM & Loyalty Wallet (`CustomerCrmScreen`):**
   - Customer phone number search and wallet points balance.
   - Visit count and lifetime spend analytics.
   - 1-tap "Tag to Order" and "Add New Customer" modal.

7. **📦 Inventory & Raw Stock (`InventoryScreen`):**
   - Live ingredient stock tracking (kg, ltr, pcs) and cost per unit.
   - Low-stock threshold warning badges.
   - Quick restock action dialog (+5kg, +10kg, etc.).

8. **📅 Table Reservations (`ReservationsScreen`):**
   - Booking calendar & party schedule.
   - Guest count, reservation time, assigned table, and special requests.
   - 1-tap "Seat Guest" action to auto-occupy the assigned table.

9. **🔒 Shift Cash Closure & Z-Report (`ShiftClosureScreen`):**
   - End-of-day drawer cash reconciliation (Opening float + cash sales vs actual counted cash).
   - Cash variance detection (Balanced, Short, Over).
   - 1-tap "Close Shift & Generate Z-Report" with printed Z-Report ticket.

---

## 📐 Responsive Breakpoints & Adaptive UI

The app adapts its UI dynamically using `LayoutBuilder` and `ResponsiveBreakpoints`:

| Screen Type | Width Breakpoint | Navigation Pattern | Layout Architecture |
| :--- | :--- | :--- | :--- |
| **Smartphone** | `< 600dp` | `BottomNavigationBar` | Single-thumb flow, 2-column menu grid, Modal Bottom Sheets for cart & settlement |
| **Small Tablet / Foldable** | `600dp - 839dp` | `NavigationRail` | 2-column split view, 3-column menu grid |
| **Large Tablet / iPad** | `≥ 840dp` | `NavigationRail` (Left) | **3-Pane Master-Detail**: Left Table Rail (250dp), Center Menu Grid (flex), Right Pinned Live Ticket (350dp) |

---

## 🛠️ Project Structure

```text
mobile/
├── pubspec.yaml                 # Dependencies (provider, http, shared_preferences, intl, uuid)
├── analysis_options.yaml        # Flutter linter configuration
├── assets/
│   └── images/
│       ├── logo.png             # Official Order It Up logo asset
│       └── icon.png             # Official 512x512 app icon asset
├── lib/
│   ├── main.dart                # App entry point & 13 MultiProvider dependencies
│   ├── core/
│   │   ├── constants/           # AppConstants (ports, routes, storage keys)
│   │   ├── network/             # ApiClient (HTTP, auth headers, idempotency keys)
│   │   ├── responsive/          # ResponsiveLayout, ResponsiveBreakpoints
│   │   └── theme/               # AppTheme (Order It Up Material 3 Brand palette)
│   ├── models/
│   │   ├── bill_model.dart      # Itemized bill, discounts, and GST/VAT tax breakdown
│   │   ├── cash_closure_model.dart # Shift closures & Z-Report model
│   │   ├── category_model.dart  # Menu categories
│   │   ├── customer_model.dart  # CRM guests & loyalty wallet
│   │   ├── held_order_model.dart# Parked carts & recall
│   │   ├── ingredient_model.dart# Raw stock & BOM thresholds
│   │   ├── kds_ticket_model.dart# KDS tickets with SLA countdowns
│   │   ├── order_model.dart     # Order, OrderItem, and DraftLine
│   │   ├── product_model.dart   # Dishes, pricing, dietary indicators
│   │   ├── reservation_model.dart # Table bookings & party schedule
│   │   ├── table_model.dart     # Restaurant table & floor states
│   │   └── user_model.dart      # Staff user & role access
│   ├── services/
│   │   ├── api_service.dart     # Live REST client with mock fallback
│   │   ├── auth_service.dart    # Token & credential management
│   │   ├── mock_data_service.dart# 100% offline standalone demo dataset
│   │   └── storage_service.dart # Persistent SharedPreferences wrapper
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   ├── cashier_provider.dart
│   │   ├── closure_provider.dart
│   │   ├── customer_provider.dart
│   │   ├── held_order_provider.dart
│   │   ├── inventory_provider.dart
│   │   ├── kds_provider.dart
│   │   ├── manager_provider.dart
│   │   ├── menu_provider.dart
│   │   ├── order_provider.dart
│   │   ├── reservation_provider.dart
│   │   ├── server_config_provider.dart
│   │   └── table_provider.dart
│   ├── screens/
│   │   ├── closures/shift_closure_screen.dart
│   │   ├── customers/customer_crm_screen.dart
│   │   ├── held_orders/held_orders_screen.dart
│   │   ├── home/operations_home_screen.dart
│   │   ├── inventory/inventory_screen.dart
│   │   ├── pos/quick_pos_screen.dart
│   │   ├── reservations/reservations_screen.dart
│   │   ├── splash_screen.dart
│   │   ├── server_connect_screen.dart
│   │   ├── login_screen.dart
│   │   ├── main_navigation_screen.dart
│   │   ├── waiter/waiter_screen.dart
│   │   ├── cashier/cashier_screen.dart
│   │   ├── kds/kds_screen.dart
│   │   ├── manager/manager_screen.dart
│   │   └── settings/settings_screen.dart
│   └── widgets/
│       ├── item_modifier_dialog.dart
│       ├── kds_ticket_card.dart
│       ├── kpi_metric_card.dart
│       ├── order_cart_sheet.dart
│       ├── product_grid_card.dart
│       ├── receipt_preview_dialog.dart
│       ├── table_grid_card.dart
│       └── upi_qr_dialog.dart
└── test/
    ├── desktop_parity_test.dart
    ├── models_serialization_test.dart
    ├── order_provider_test.dart
    └── responsive_breakpoints_test.dart
```

---

## 📦 Release Deliverable

The production release APK is generated and packaged in:
```text
release/mobile/order-it-up.apk
```

To re-package or build locally anytime:
```powershell
powershell -ExecutionPolicy Bypass -File "scripts/package-release-apk.ps1"
```

CI/CD automated build workflow is configured in [`.github/workflows/mobile-release.yml`](../.github/workflows/mobile-release.yml).
