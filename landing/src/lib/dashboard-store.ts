"use client";

import { useSyncExternalStore, useEffect } from "react";
import type {
  OperationalRole,
  TicketItemStatus,
  TableStatus,
  PaymentMethodType,
  DeliveryRiderStatus,
  CourseType,
  RestaurantOutlet,
  StaffUser,
  RestaurantTable,
  RestaurantOrder,
  ShiftZReport,
  DeliveryDispatch,
  PlatformTenant,
  CentralMenuItem,
  SplitSettlementDetails,
  ShiftClosureInput,
  DrawerPulseEvent,
  ActiveShiftTill,
  PlanTier,
  IssuedLicenseRecord,
  DashboardPerspective,
} from "./dashboard-models";

// ============================================================================
// STORE STATE INTERFACE
// ============================================================================

export interface DashboardState {
  // Navigation & Perspective
  activePerspective: DashboardPerspective;
  activeRole: OperationalRole;
  selectedOutletId: string; // "all" or specific outlet id
  isHydrated: boolean;

  // Multi-Outlet Restaurant Chain
  outlets: RestaurantOutlet[];
  catalog: CentralMenuItem[];
  tables: RestaurantTable[];
  orders: RestaurantOrder[];
  staff: StaffUser[];
  zReports: ShiftZReport[];
  dispatches: DeliveryDispatch[];

  // Active Cash Drawer & Session State
  activeCashShift: ActiveShiftTill;
  drawerPulseHistory: DrawerPulseEvent[];

  // Platform Founder Entities
  tenants: PlatformTenant[];
}

// ============================================================================
// INITIAL SEED DATA: SPICE ROUTE HOSPITALITY GROUP
// ============================================================================

export const INITIAL_DASHBOARD_STATE: DashboardState = {
  activePerspective: "merchant",
  activeRole: "owner",
  selectedOutletId: "all",
  isHydrated: false,

  outlets: [
    {
      id: "outlet-1",
      name: "Downtown Bistro (Flagship)",
      code: "DEL-CP-01",
      location: "42 Connaught Place, New Delhi",
      city: "New Delhi",
      type: "Fine Dine & Craft Cocktail Bar",
      stateCode: "07",
      gstin: "07AAAAA0000A1Z5",
      fssaiNumber: "10019011000234",
      todaySales: 48920,
      ordersCount: 48,
      avgTicket: 1019.16,
      activeTables: "8 / 12",
      tenders: { upi: 28420, cash: 14200, card: 6300 },
      topDish: "Truffle Mushroom Wood-Fired Pizza",
      posTerminals: 2,
      status: "Operational",
      enginePort: ":3001 (POS Engine) • :3002 (KDS) • :3003 (Waiter)",
      hardware: "2x 80mm ESC/POS Printers • 24V Solenoid Till Active",
      s3Bucket: "orderitup-tenant-spiceroute",
    },
    {
      id: "outlet-2",
      name: "Cyber Hub Express (QSR)",
      code: "HR-GGN-02",
      location: "Building 10B, DLF Cyber Hub, Gurugram",
      city: "Gurugram",
      type: "High-Volume QSR & Delivery Hub",
      stateCode: "06",
      gstin: "06AAAAA0000A1Z2",
      fssaiNumber: "10019011000235",
      todaySales: 64150,
      ordersCount: 112,
      avgTicket: 572.76,
      activeTables: "10 / 12",
      tenders: { upi: 49200, cash: 3000, card: 11950 },
      topDish: "Awadhi Murgh Dum Biryani",
      posTerminals: 2,
      status: "Operational",
      enginePort: ":3001 (POS Engine) • :3002 (KDS)",
      hardware: "2x 80mm ESC/POS Printers • Kitchen Bump Bar Active",
      s3Bucket: "orderitup-tenant-spiceroute",
    },
    {
      id: "outlet-3",
      name: "Airport Terminal 3 Hub",
      code: "DEL-IGI-03",
      location: "Departures Gate 41, IGI Airport T3, New Delhi",
      city: "New Delhi",
      type: "24/7 Transit Grab-and-Go",
      stateCode: "07",
      gstin: "07AAAAA0000A1Z6",
      fssaiNumber: "10019011000236",
      todaySales: 32400,
      ordersCount: 56,
      avgTicket: 578.57,
      activeTables: "4 / 8",
      tenders: { upi: 10200, cash: 2400, card: 19800 },
      topDish: "Classic Cold Brew Latte",
      posTerminals: 2,
      status: "Operational",
      enginePort: ":3001 (POS Engine) • :3002 (KDS)",
      hardware: "1x 80mm ESC/POS Printer • Standalone Barcode Terminal",
      s3Bucket: "orderitup-tenant-spiceroute",
    },
  ],

  catalog: [
    {
      id: "prod-001",
      name: "Truffle Mushroom Wood-Fired Pizza",
      category: "Pizzas",
      basePrice: 540,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "oven",
      course: "main",
      dietaryTag: "veg",
      description: "San Marzano tomatoes, fresh mozzarella, wild forest mushrooms, white truffle oil",
      branchOverrides: {
        "outlet-2": { priceOverride: 520, isAvailable: true },
        "outlet-3": { priceOverride: 620, isAvailable: true },
      },
    },
    {
      id: "prod-002",
      name: "Artisanal Paneer Tikka Platter",
      category: "Starters",
      basePrice: 380,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "tandoor",
      course: "starter",
      dietaryTag: "veg",
      description: "Clay oven roasted malai paneer cubes, bell peppers, mint & laccha onion relish",
      branchOverrides: {
        "outlet-3": { priceOverride: 420, isAvailable: true },
      },
    },
    {
      id: "prod-003",
      name: "24-Hour Slow Cooked Dal Makhani",
      category: "Mains",
      basePrice: 420,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "oven",
      course: "main",
      dietaryTag: "veg",
      description: "Simmered whole black lentils, dairy churned white butter, slow-cooked overnight",
      branchOverrides: {
        "outlet-3": { priceOverride: 480, isAvailable: true },
      },
    },
    {
      id: "prod-004",
      name: "Clay Oven Butter Naan",
      category: "Mains",
      basePrice: 85,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "tandoor",
      course: "main",
      dietaryTag: "veg",
      description: "Traditional hand-stretched leavened flatbread brushed with organic butter",
      branchOverrides: {
        "outlet-3": { priceOverride: 110, isAvailable: true },
      },
    },
    {
      id: "prod-005",
      name: "Awadhi Murgh Dum Biryani",
      category: "Mains",
      basePrice: 520,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "tandoor",
      course: "main",
      dietaryTag: "non-veg",
      description: "Fragrant long-grain aged basmati rice layered with spiced spring chicken in sealed handi",
      branchOverrides: {
        "outlet-3": { priceOverride: 590, isAvailable: true },
      },
    },
    {
      id: "prod-006",
      name: "Classic Cold Brew Latte",
      category: "Beverages",
      basePrice: 220,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "bar",
      course: "beverage",
      dietaryTag: "veg",
      description: "18-hour cold steeped single-origin Arabica coffee with chilled whole milk",
      branchOverrides: {
        "outlet-3": { priceOverride: 260, isAvailable: true },
      },
    },
    {
      id: "prod-007",
      name: "Butter Chicken Bao (x3)",
      category: "Starters",
      basePrice: 460,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "grill",
      course: "starter",
      dietaryTag: "non-veg",
      description: "Steamed lotus leaf buns stuffed with pulled tandoori chicken in makhani reduction",
      branchOverrides: {
        "outlet-3": { priceOverride: 510, isAvailable: true },
      },
    },
    {
      id: "prod-008",
      name: "Belgian Dark Chocolate Lava Cake",
      category: "Desserts",
      basePrice: 280,
      taxRatePercent: 5,
      sacCode: "996331",
      station: "bar",
      course: "dessert",
      dietaryTag: "egg",
      description: "Warm Callebaut 70% molten core sponge cake with Madagascar vanilla bean dust",
      branchOverrides: {
        "outlet-3": { priceOverride: 320, isAvailable: true },
      },
    },
  ],

  tables: [
    // Indoor Dining (6 Tables)
    { id: "tbl-indoor-01", number: "T-01", floor: "Indoor", capacity: 2, status: "available" },
    {
      id: "tbl-indoor-02",
      number: "T-02",
      floor: "Indoor",
      capacity: 4,
      status: "occupied",
      currentOrderId: "ord-101",
      seatedAt: "28 mins ago",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      guestCount: 3,
      pax: 3,
    },
    { id: "tbl-indoor-03", number: "T-03", floor: "Indoor", capacity: 4, status: "reserved" },
    {
      id: "tbl-indoor-04",
      number: "T-04",
      floor: "Indoor",
      capacity: 4,
      status: "occupied",
      currentOrderId: "ord-104",
      seatedAt: "42 mins ago",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      guestCount: 4,
      pax: 4,
      courseFiring: { starter: true, main: true, dessert: false },
    },
    {
      id: "tbl-indoor-05",
      number: "T-05",
      floor: "Indoor",
      capacity: 6,
      status: "billed",
      currentOrderId: "ord-103",
      seatedAt: "65 mins ago",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      guestCount: 6,
      pax: 6,
    },
    { id: "tbl-indoor-06", number: "T-06", floor: "Indoor", capacity: 2, status: "available" },

    // Patio Garden (4 Tables)
    { id: "tbl-patio-01", number: "P-01", floor: "Patio", capacity: 4, status: "available" },
    {
      id: "tbl-patio-02",
      number: "P-02",
      floor: "Patio",
      capacity: 2,
      status: "occupied",
      currentOrderId: "ord-102",
      seatedAt: "14 mins ago",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      guestCount: 2,
      pax: 2,
    },
    { id: "tbl-patio-03", number: "P-03", floor: "Patio", capacity: 4, status: "cleaning" },
    { id: "tbl-patio-04", number: "P-04", floor: "Patio", capacity: 6, status: "available" },

    // Rooftop Lounge (4 Tables)
    { id: "tbl-roof-01", number: "R-01", floor: "Rooftop", capacity: 2, status: "available" },
    {
      id: "tbl-roof-02",
      number: "R-02",
      floor: "Rooftop",
      capacity: 4,
      status: "occupied",
      seatedAt: "35 mins ago",
      guestCount: 4,
      pax: 4,
    },
    { id: "tbl-roof-03", number: "R-03", floor: "Rooftop", capacity: 6, status: "reserved" },
    { id: "tbl-roof-04", number: "R-04", floor: "Rooftop", capacity: 4, status: "available" },

    // Private Dining Room (1 Table)
    { id: "tbl-pdr-01", number: "PDR-01", floor: "Private Dining", capacity: 10, status: "available" },
  ],

  orders: [
    // Order #101: Preparing in oven (Amber SLA Alert)
    {
      id: "ord-101",
      orderNumber: "#101",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-indoor-02",
      tableName: "T-02",
      pax: 3,
      guestCount: 3,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      items: [
        {
          id: "item-101-1",
          productId: "prod-001",
          productName: "Truffle Mushroom Wood-Fired Pizza",
          quantity: 1,
          unitPrice: 540,
          subtotal: 600,
          modifiers: [{ id: "mod-1", name: "Extra Mozzarella", price: 60 }],
          course: "main",
          station: "oven",
          status: "preparing",
          specialInstructions: "Crispy thin crust, well done",
          hsnSac: "996331",
          dietaryTag: "veg",
          prepStartedAt: "2026-10-31T13:25:00Z",
        },
        {
          id: "item-101-2",
          productId: "prod-003",
          productName: "24-Hour Slow Cooked Dal Makhani",
          quantity: 1,
          unitPrice: 420,
          subtotal: 450,
          modifiers: [{ id: "mod-2", name: "White Butter", price: 30 }],
          course: "main",
          station: "oven",
          status: "preparing",
          hsnSac: "996331",
          dietaryTag: "veg",
          prepStartedAt: "2026-10-31T13:25:00Z",
        },
        {
          id: "item-101-3",
          productId: "prod-004",
          productName: "Clay Oven Butter Naan",
          quantity: 3,
          unitPrice: 85,
          subtotal: 255,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "preparing",
          hsnSac: "996331",
          dietaryTag: "veg",
          prepStartedAt: "2026-10-31T13:25:00Z",
        },
      ],
      subtotal: 1305,
      taxableAmount: 1305,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 0,
      cgst: 32.63,
      sgst: 32.63,
      taxTotal: 65.26,
      roundOff: 0.74,
      total: 1371,
      paymentStatus: "unpaid",
      prepStartedAt: "2026-10-31T13:25:00Z",
      createdAt: "2026-10-31T13:20:00Z",
      updatedAt: "2026-10-31T13:26:00Z",
    },

    // Order #102: Ready at bar (Green SLA badge)
    {
      id: "ord-102",
      orderNumber: "#102",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-patio-02",
      tableName: "P-02",
      pax: 2,
      guestCount: 2,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      items: [
        {
          id: "item-102-1",
          productId: "prod-006",
          productName: "Classic Cold Brew Latte",
          quantity: 2,
          unitPrice: 220,
          subtotal: 520,
          modifiers: [{ id: "mod-3", name: "Oat Milk Sub (x2)", price: 80 }],
          course: "beverage",
          station: "bar",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "veg",
          prepStartedAt: "2026-10-31T13:29:00Z",
          readyAt: "2026-10-31T13:32:00Z",
        },
        {
          id: "item-102-2",
          productId: "prod-008",
          productName: "Belgian Dark Chocolate Lava Cake",
          quantity: 1,
          unitPrice: 280,
          subtotal: 280,
          modifiers: [],
          course: "dessert",
          station: "bar",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "egg",
          prepStartedAt: "2026-10-31T13:29:00Z",
          readyAt: "2026-10-31T13:33:00Z",
        },
      ],
      subtotal: 800,
      taxableAmount: 800,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 0,
      cgst: 20.0,
      sgst: 20.0,
      taxTotal: 40.0,
      roundOff: 0.0,
      total: 840,
      paymentStatus: "unpaid",
      prepStartedAt: "2026-10-31T13:29:00Z",
      readyAt: "2026-10-31T13:33:00Z",
      createdAt: "2026-10-31T13:28:00Z",
      updatedAt: "2026-10-31T13:33:00Z",
    },

    // Order #103: Billed at counter (Awaiting Split Settlement)
    {
      id: "ord-103",
      orderNumber: "#103",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-indoor-05",
      tableName: "T-05",
      pax: 6,
      guestCount: 6,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      items: [
        {
          id: "item-103-1",
          productId: "prod-001",
          productName: "Truffle Mushroom Wood-Fired Pizza",
          quantity: 2,
          unitPrice: 540,
          subtotal: 1080,
          modifiers: [],
          course: "main",
          station: "oven",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "veg",
          servedAt: "2026-10-31T13:10:00Z",
        },
        {
          id: "item-103-2",
          productId: "prod-005",
          productName: "Awadhi Murgh Dum Biryani",
          quantity: 2,
          unitPrice: 520,
          subtotal: 1040,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "non-veg",
          servedAt: "2026-10-31T13:12:00Z",
        },
        {
          id: "item-103-3",
          productId: "prod-004",
          productName: "Clay Oven Butter Naan",
          quantity: 4,
          unitPrice: 85,
          subtotal: 340,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "veg",
          servedAt: "2026-10-31T13:12:00Z",
        },
      ],
      subtotal: 2460,
      taxableAmount: 2460,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 145,
      cgst: 57.88,
      sgst: 57.88,
      taxTotal: 115.76,
      roundOff: 0.24,
      total: 2431,
      paymentStatus: "unpaid",
      createdAt: "2026-10-31T12:35:00Z",
      updatedAt: "2026-10-31T13:20:00Z",
    },

    // Order #104: Tableside dining (Multi-Course Progression)
    {
      id: "ord-104",
      orderNumber: "#104",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "dine_in",
      tableId: "tbl-indoor-04",
      tableName: "T-04",
      pax: 4,
      guestCount: 4,
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      waiterId: "usr_server_01",
      waiterName: "Aman Kapoor",
      items: [
        {
          id: "item-104-1",
          productId: "prod-002",
          productName: "Artisanal Paneer Tikka Platter",
          quantity: 2,
          unitPrice: 380,
          subtotal: 760,
          modifiers: [{ id: "mod-4", name: "Mint Chutney", price: 0 }],
          course: "starter",
          station: "tandoor",
          status: "served",
          specialInstructions: "Chef special spice blend",
          hsnSac: "996331",
          dietaryTag: "veg",
          servedAt: "2026-10-31T13:10:00Z",
        },
        {
          id: "item-104-2",
          productId: "prod-001",
          productName: "Truffle Mushroom Wood-Fired Pizza",
          quantity: 1,
          unitPrice: 540,
          subtotal: 600,
          modifiers: [{ id: "mod-5", name: "Extra Mozzarella", price: 60 }],
          course: "main",
          station: "oven",
          status: "preparing",
          specialInstructions: "Course Fired | Crispy crust",
          hsnSac: "996331",
          dietaryTag: "veg",
          prepStartedAt: "2026-10-31T13:22:00Z",
        },
        {
          id: "item-104-3",
          productId: "prod-006",
          productName: "Classic Cold Brew Latte",
          quantity: 2,
          unitPrice: 220,
          subtotal: 520,
          modifiers: [{ id: "mod-6", name: "Oat Milk Sub", price: 80 }],
          course: "beverage",
          station: "bar",
          status: "served",
          hsnSac: "996331",
          dietaryTag: "veg",
          servedAt: "2026-10-31T13:05:00Z",
        },
        {
          id: "item-104-4",
          productId: "prod-008",
          productName: "Belgian Dark Chocolate Lava Cake",
          quantity: 1,
          unitPrice: 280,
          subtotal: 330,
          modifiers: [{ id: "mod-7", name: "Vanilla Bean Gelato", price: 50 }],
          course: "dessert",
          station: "bar",
          status: "pending",
          specialInstructions: "Hold for dessert call",
          hsnSac: "996331",
          dietaryTag: "egg",
        },
      ],
      subtotal: 2210,
      taxableAmount: 1930,
      packagingCharge: 0,
      deliveryCharge: 0,
      discountAmount: 280,
      cgst: 48.25,
      sgst: 48.25,
      taxTotal: 96.5,
      roundOff: 0.5,
      total: 2027,
      paymentStatus: "unpaid",
      createdAt: "2026-10-31T12:55:00Z",
      updatedAt: "2026-10-31T13:22:00Z",
    },

    // Order #105: Swiggy Delivery
    {
      id: "ord-105",
      orderNumber: "#105",
      outletId: "outlet-2",
      outletName: "Cyber Hub Express (QSR)",
      orderType: "delivery",
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      items: [
        {
          id: "item-105-1",
          productId: "prod-005",
          productName: "Awadhi Murgh Dum Biryani",
          quantity: 1,
          unitPrice: 520,
          subtotal: 520,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "non-veg",
        },
        {
          id: "item-105-2",
          productId: "prod-007",
          productName: "Butter Chicken Bao (x3)",
          quantity: 1,
          unitPrice: 460,
          subtotal: 460,
          modifiers: [],
          course: "starter",
          station: "grill",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "non-veg",
        },
      ],
      subtotal: 980,
      taxableAmount: 800,
      packagingCharge: 40,
      deliveryCharge: 0,
      discountAmount: 180,
      cgst: 20.0,
      sgst: 20.0,
      taxTotal: 40.0,
      roundOff: 0.0,
      total: 840,
      paymentStatus: "unpaid",
      deliveryDetails: {
        channel: "swiggy",
        customerName: "Vikram Malhotra",
        customerPhone: "+91 98111 22334",
        customerPhoneMasked: "+91 98*** **334",
        deliveryAddress: "Apt 1402, Tower 4, The Magnolias, DLF Phase 5, Gurugram",
        landmark: "Near Club House Gate 2",
        riderName: "Sumit Kumar",
        riderPhone: "+91 99887 76655",
        riderStatus: "dispatched",
        isCod: true,
        codAmount: 840,
        codCollected: false,
        dispatchedAt: "2026-10-31T13:22:00Z",
      },
      createdAt: "2026-10-31T13:10:00Z",
      updatedAt: "2026-10-31T13:22:00Z",
    },

    // Order #106: Zomato Delivery (Prepaid)
    {
      id: "ord-106",
      orderNumber: "#106",
      outletId: "outlet-2",
      outletName: "Cyber Hub Express (QSR)",
      orderType: "delivery",
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      items: [
        {
          id: "item-106-1",
          productId: "prod-001",
          productName: "Truffle Mushroom Wood-Fired Pizza",
          quantity: 1,
          unitPrice: 520,
          subtotal: 520,
          modifiers: [],
          course: "main",
          station: "oven",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
      ],
      subtotal: 520,
      taxableAmount: 520,
      packagingCharge: 30,
      deliveryCharge: 0,
      discountAmount: 0,
      cgst: 13.0,
      sgst: 13.0,
      taxTotal: 26.0,
      roundOff: 0.0,
      total: 576,
      paymentStatus: "paid",
      settlement: {
        method: "upi",
        tenderedAmount: 576,
        changeReturned: 0,
        cashDrawerPulsed: false,
        paidAt: "2026-10-31T13:15:00Z",
        receiptPrinted: true,
      },
      deliveryDetails: {
        channel: "zomato",
        customerName: "Ananya Sen",
        customerPhone: "+91 98222 33445",
        customerPhoneMasked: "+91 98*** **445",
        deliveryAddress: "Villa 28, Silver Oaks, Golf Course Road, Gurugram",
        landmark: "Opposite Central Plaza",
        riderName: "Rahul Yadav",
        riderPhone: "+91 99112 23344",
        riderStatus: "assigned",
        isCod: false,
        codAmount: 0,
        codCollected: true,
      },
      createdAt: "2026-10-31T13:15:00Z",
      updatedAt: "2026-10-31T13:28:00Z",
    },

    // Order #108: Direct In-House Delivery (COD)
    {
      id: "ord-108",
      orderNumber: "#108",
      outletId: "outlet-1",
      outletName: "Downtown Bistro (Flagship)",
      orderType: "delivery",
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      items: [
        {
          id: "item-108-1",
          productId: "prod-005",
          productName: "Awadhi Murgh Dum Biryani",
          quantity: 2,
          unitPrice: 520,
          subtotal: 1040,
          modifiers: [],
          course: "main",
          station: "tandoor",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "non-veg",
        },
        {
          id: "item-108-2",
          productId: "prod-003",
          productName: "24-Hour Slow Cooked Dal Makhani",
          quantity: 1,
          unitPrice: 420,
          subtotal: 420,
          modifiers: [],
          course: "main",
          station: "oven",
          status: "ready",
          hsnSac: "996331",
          dietaryTag: "veg",
        },
      ],
      subtotal: 1460,
      taxableAmount: 1380,
      packagingCharge: 50,
      deliveryCharge: 0,
      discountAmount: 80,
      cgst: 34.5,
      sgst: 34.5,
      taxTotal: 69.0,
      roundOff: 1.0,
      total: 1450,
      paymentStatus: "unpaid",
      deliveryDetails: {
        channel: "direct",
        customerName: "Rajesh Gupta",
        customerPhone: "+91 98333 44556",
        customerPhoneMasked: "+91 98*** **556",
        deliveryAddress: "Flat 4B, Rohit House, 3 Tolstoy Marg, Connaught Place, New Delhi",
        landmark: "Next to British Council Library",
        riderName: "Ramesh V (In-House Driver)",
        riderPhone: "+91 98110 55443",
        riderStatus: "arrived",
        isCod: true,
        codAmount: 1450,
        codCollected: false,
        dispatchedAt: "2026-10-31T13:30:00Z",
      },
      createdAt: "2026-10-31T13:20:00Z",
      updatedAt: "2026-10-31T13:30:00Z",
    },
  ],

  staff: [
    {
      id: "usr_owner_01",
      name: "Priya Sharma",
      email: "priya@spiceroute.in",
      role: "owner",
      pin: "9021",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Just now",
      phoneNumber: "+91 98110 23456",
    },
    {
      id: "usr_manager_01",
      name: "Arjun Verma",
      email: "arjun@spiceroute.in",
      role: "manager",
      pin: "5512",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "3 mins ago",
      phoneNumber: "+91 98110 98765",
    },
    {
      id: "usr_cashier_01",
      name: "Rohit Singh",
      email: "rohit.singh@spiceroute.in",
      role: "cashier",
      pin: "1044",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Active now",
      phoneNumber: "+91 98110 44321",
    },
    {
      id: "usr_chef_01",
      name: "Marco Rossi",
      email: "marco.rossi@spiceroute.in",
      role: "chef",
      pin: "7732",
      activeOutletId: "outlet-1",
      assignedStation: "all",
      isActive: true,
      lastActive: "Active on KDS",
      phoneNumber: "+91 98110 77889",
    },
    {
      id: "usr_server_01",
      name: "Aman Kapoor",
      email: "aman.kapoor@spiceroute.in",
      role: "server",
      pin: "2481",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Active on Floor",
      phoneNumber: "+91 98110 33221",
    },
    {
      id: "usr_acc_01",
      name: "Kavita Rao",
      email: "kavita.rao@spiceroute.in",
      role: "accountant",
      pin: "3391",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Auditing shift",
      phoneNumber: "+91 98110 66554",
    },
    {
      id: "usr_driver_01",
      name: "Ramesh V",
      email: "ramesh.v@spiceroute.in",
      role: "driver",
      pin: "6120",
      activeOutletId: "outlet-1",
      isActive: true,
      lastActive: "Out for delivery",
      phoneNumber: "+91 98110 55443",
    },
  ],

  zReports: [
    {
      id: "zreport-41",
      zNumber: 41,
      outletId: "outlet-1",
      terminalId: "POS-01",
      businessDate: "2026-10-30",
      openedAt: "2026-10-30T10:00:00Z",
      closedAt: "2026-10-30T23:30:00Z",
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      supervisorId: "usr_manager_01",
      supervisorName: "Arjun Verma",
      openingFloat: 5000,
      grossCashSales: 18400,
      cashRefunds: 0,
      expectedCashInDrawer: 23400,
      actualCountedCash: 23400,
      cashVariance: 0,
      cardTotal: 12800,
      upiTotal: 31200,
      grossSalesTotal: 62400,
      cgstTotal: 1485.71,
      sgstTotal: 1485.71,
      totalTaxCollected: 2971.42,
      totalBillsIssued: 58,
      status: "balanced",
      notes: "Shift closed with perfect register balance. Cash dropped to safe.",
    },
    {
      id: "zreport-42",
      zNumber: 42,
      outletId: "outlet-1",
      terminalId: "POS-01",
      businessDate: "2026-10-31",
      openedAt: "2026-10-31T09:30:00Z",
      closedAt: "2026-10-31T16:00:00Z",
      cashierId: "usr_cashier_01",
      cashierName: "Rohit Singh",
      supervisorId: "usr_manager_01",
      supervisorName: "Arjun Verma",
      openingFloat: 5000,
      grossCashSales: 14200,
      cashRefunds: 0,
      expectedCashInDrawer: 19200,
      actualCountedCash: 19150,
      cashVariance: -50,
      cardTotal: 6300,
      upiTotal: 28420,
      grossSalesTotal: 48920,
      cgstTotal: 1164.76,
      sgstTotal: 1164.76,
      totalTaxCollected: 2329.52,
      totalBillsIssued: 48,
      status: "variance_flagged",
      notes: "Shortage alert: ₹50.00 discrepancy on cash drawer till. Under audit by Kavita Rao.",
    },
    {
      id: "zreport-43",
      zNumber: 43,
      outletId: "outlet-2",
      terminalId: "POS-02",
      businessDate: "2026-10-31",
      openedAt: "2026-10-31T08:00:00Z",
      closedAt: "2026-10-31T15:30:00Z",
      cashierName: "Vikas Gupta",
      supervisorName: "Arjun Verma",
      openingFloat: 3000,
      grossCashSales: 8200,
      cashRefunds: 200,
      expectedCashInDrawer: 11000,
      actualCountedCash: 11020,
      cashVariance: 20,
      cardTotal: 11950,
      upiTotal: 49200,
      grossSalesTotal: 69350,
      cgstTotal: 1651.19,
      sgstTotal: 1651.19,
      totalTaxCollected: 3302.38,
      totalBillsIssued: 74,
      status: "variance_flagged",
      notes: "Overage of ₹20.00 due to uncollected small change.",
    },
  ],

  dispatches: [
    {
      id: "disp-001",
      dispatchNo: "D-801",
      orderId: "ord-105",
      orderNumber: "#105",
      channel: "swiggy",
      customerName: "Vikram Malhotra",
      customerPhone: "+91 98111 22334",
      maskedPhone: "+91 98*** **334",
      deliveryAddress: "Apt 1402, Tower 4, The Magnolias, DLF Phase 5, Gurugram",
      landmark: "Near Club House Gate 2",
      riderName: "Sumit Kumar",
      riderPhone: "+91 99887 76655",
      riderStatus: "dispatched",
      isCod: true,
      codAmount: 840,
      codCollected: false,
      estimatedMinutes: 18,
      dispatchedAt: "2026-10-31T13:22:00Z",
    },
    {
      id: "disp-002",
      dispatchNo: "D-802",
      orderId: "ord-106",
      orderNumber: "#106",
      channel: "zomato",
      customerName: "Ananya Sen",
      customerPhone: "+91 98222 33445",
      maskedPhone: "+91 98*** **445",
      deliveryAddress: "Villa 28, Silver Oaks, Golf Course Road, Gurugram",
      landmark: "Opposite Central Plaza",
      riderName: "Rahul Yadav",
      riderPhone: "+91 99112 23344",
      riderStatus: "assigned",
      isCod: false,
      codAmount: 0,
      codCollected: true,
      estimatedMinutes: 25,
      dispatchedAt: "2026-10-31T13:28:00Z",
    },
    {
      id: "disp-003",
      dispatchNo: "D-803",
      orderId: "ord-108",
      orderNumber: "#108",
      channel: "direct",
      customerName: "Rajesh Gupta",
      customerPhone: "+91 98333 44556",
      maskedPhone: "+91 98*** **556",
      deliveryAddress: "Flat 4B, Rohit House, 3 Tolstoy Marg, Connaught Place, New Delhi",
      landmark: "Next to British Council Library",
      riderName: "Ramesh V (In-House Driver)",
      riderPhone: "+91 98110 55443",
      riderStatus: "arrived",
      isCod: true,
      codAmount: 1450,
      codCollected: false,
      estimatedMinutes: 12,
      dispatchedAt: "2026-10-31T13:30:00Z",
    },
  ],

  activeCashShift: {
    openedAt: "2026-10-31T09:30:00Z",
    openingFloat: 5000,
    grossCashSales: 14200,
    cashRefunds: 0,
    expectedCashInDrawer: 19200,
  },

  drawerPulseHistory: [
    {
      id: "pulse-01",
      timestamp: "2026-10-31T12:45:00Z",
      orderId: "#098",
      amount: 1200,
      reason: "Cash Settlement Kick (0x1B, 0x70, 0x00, 0x19, 0xFA)",
    },
    {
      id: "pulse-02",
      timestamp: "2026-10-31T13:15:00Z",
      amount: 0,
      reason: "Manual Cashier Drawer Audit Pulse (0x1B, 0x70, 0x00, 0x19, 0xFA)",
    },
  ],

  tenants: [
    {
      id: "tenant-0892",
      businessName: "Spice Route Hospitality Group",
      ownerName: "Priya Sharma",
      ownerEmail: "priya@spiceroute.in",
      ownerPhone: "+91 98110 23456",
      tier: "Enterprise Chain",
      tierCode: "enterprise",
      outletsCount: 3,
      activeTerminals: 6,
      s3Bucket: "orderitup-tenant-spiceroute",
      monthGmv: 1485200,
      monthGmvFormatted: "₹14,85,200",
      lastSync: "2 mins ago",
      status: "Active",
      city: "New Delhi & Gurugram",
      createdAt: "2026-01-10T08:00:00Z",
      licenseKeys: [
        {
          id: "lic-0892-01",
          key: "OIUP-ENT1-8F42-K9L2",
          licenseKey: "OIUP-ENT1-8F42-K9L2",
          tenantId: "tenant-0892",
          tenantName: "Spice Route Hospitality Group",
          planTier: "enterprise",
          machineHash: "8F42",
          checksum: "K9L2",
          issuedAt: "2026-01-15T10:00:00Z",
          expiresAt: "2027-01-15T10:00:00Z",
          status: "Active",
          isValid: true,
          durationDays: 365,
        },
        {
          id: "lic-0892-02",
          key: "OIUP-ENT1-8F43-M3P1",
          licenseKey: "OIUP-ENT1-8F43-M3P1",
          tenantId: "tenant-0892",
          tenantName: "Spice Route Hospitality Group",
          planTier: "enterprise",
          machineHash: "8F43",
          checksum: "M3P1",
          issuedAt: "2026-01-15T10:00:00Z",
          expiresAt: "2027-01-15T10:00:00Z",
          status: "Active",
          isValid: true,
          durationDays: 365,
        },
        {
          id: "lic-0892-03",
          key: "OIUP-ENT1-B892-4C7D",
          licenseKey: "OIUP-ENT1-B892-4C7D",
          tenantId: "tenant-0892",
          tenantName: "Spice Route Hospitality Group",
          planTier: "enterprise",
          machineHash: "B892",
          checksum: "4C7D",
          issuedAt: "2026-02-01T10:00:00Z",
          expiresAt: "2027-02-01T10:00:00Z",
          status: "Active",
          isValid: true,
          durationDays: 365,
        },
      ],
      s3Metrics: {
        bucketName: "orderitup-tenant-spiceroute",
        prefix: "tenants/tenant-0892/",
        totalSizeMb: 589.6,
        objectCount: 3514,
        backupsCount: 14,
        lastBackupIso: "2026-10-31T03:00:00Z",
        zeroComminglingVerified: true,
        outboxPendingCount: 0,
        domainBreakdown: {
          backups: { objectCount: 14, sizeMb: 428.0 },
          payments: { objectCount: 3420, sizeMb: 18.4 },
          users: { objectCount: 12, sizeMb: 1.2 },
          media: { objectCount: 68, sizeMb: 142.0 },
        },
      },
    },
    {
      id: "tenant-0441",
      businessName: "Urban Bites Fast-Casual Co.",
      ownerName: "Amit Verma",
      ownerEmail: "amit@urbanbites.co",
      ownerPhone: "+91 98220 34567",
      tier: "Pro Multi-Outlet",
      tierCode: "pro",
      outletsCount: 2,
      activeTerminals: 4,
      s3Bucket: "orderitup-tenant-urbanbites",
      monthGmv: 892400,
      monthGmvFormatted: "₹8,92,400",
      lastSync: "5 mins ago",
      status: "Active",
      city: "Bengaluru",
      createdAt: "2026-02-14T09:30:00Z",
      licenseKeys: [
        {
          id: "lic-0441-01",
          key: "OIUP-PRO1-7A11-X8Y4",
          licenseKey: "OIUP-PRO1-7A11-X8Y4",
          tenantId: "tenant-0441",
          tenantName: "Urban Bites Fast-Casual Co.",
          planTier: "pro",
          machineHash: "7A11",
          checksum: "X8Y4",
          issuedAt: "2026-03-01T10:00:00Z",
          expiresAt: "2027-03-01T10:00:00Z",
          status: "Active",
          isValid: true,
          durationDays: 365,
        },
      ],
      s3Metrics: {
        bucketName: "orderitup-tenant-urbanbites",
        prefix: "tenants/tenant-0441/",
        totalSizeMb: 242.4,
        objectCount: 1912,
        backupsCount: 8,
        lastBackupIso: "2026-10-30T22:00:00Z",
        zeroComminglingVerified: true,
        outboxPendingCount: 0,
        domainBreakdown: {
          backups: { objectCount: 8, sizeMb: 184.0 },
          payments: { objectCount: 1840, sizeMb: 12.4 },
          users: { objectCount: 8, sizeMb: 0.8 },
          media: { objectCount: 56, sizeMb: 45.2 },
        },
      },
    },
    {
      id: "tenant-0129",
      businessName: "Cafe Milano Roasters",
      ownerName: "Marco Rossi",
      ownerEmail: "marco@cafemilano.com",
      ownerPhone: "+91 98330 45678",
      tier: "Single Store Pilot",
      tierCode: "starter",
      outletsCount: 1,
      activeTerminals: 2,
      s3Bucket: "orderitup-tenant-milano",
      monthGmv: 420100,
      monthGmvFormatted: "₹4,20,100",
      lastSync: "1 min ago",
      status: "Active",
      city: "Mumbai",
      createdAt: "2026-04-01T11:00:00Z",
      licenseKeys: [
        {
          id: "lic-0129-01",
          key: "OIUP-STR1-9C33-R2T5",
          licenseKey: "OIUP-STR1-9C33-R2T5",
          tenantId: "tenant-0129",
          tenantName: "Cafe Milano Roasters",
          planTier: "starter",
          machineHash: "9C33",
          checksum: "R2T5",
          issuedAt: "2026-05-10T10:00:00Z",
          expiresAt: "2027-05-10T10:00:00Z",
          status: "Active",
          isValid: true,
          durationDays: 365,
        },
      ],
      s3Metrics: {
        bucketName: "orderitup-tenant-milano",
        prefix: "tenants/tenant-0129/",
        totalSizeMb: 112.8,
        objectCount: 924,
        backupsCount: 4,
        lastBackupIso: "2026-10-31T01:00:00Z",
        zeroComminglingVerified: true,
        outboxPendingCount: 0,
        domainBreakdown: {
          backups: { objectCount: 4, sizeMb: 85.0 },
          payments: { objectCount: 880, sizeMb: 6.2 },
          users: { objectCount: 4, sizeMb: 0.4 },
          media: { objectCount: 36, sizeMb: 21.2 },
        },
      },
    },
    {
      id: "tenant-0773",
      businessName: "The Coastal Catch Bistro",
      ownerName: "Sunita Rao",
      ownerEmail: "sunita@coastalcatch.in",
      ownerPhone: "+91 98440 56789",
      tier: "Enterprise Chain",
      tierCode: "enterprise",
      outletsCount: 4,
      activeTerminals: 8,
      s3Bucket: "orderitup-tenant-coastal",
      monthGmv: 2140900,
      monthGmvFormatted: "₹21,40,900",
      lastSync: "4 mins ago",
      status: "Active",
      city: "Goa & Kochi",
      createdAt: "2026-03-20T10:00:00Z",
      licenseKeys: [
        {
          id: "lic-0773-01",
          key: "OIUP-ENT1-6D99-W1Q8",
          licenseKey: "OIUP-ENT1-6D99-W1Q8",
          tenantId: "tenant-0773",
          tenantName: "The Coastal Catch Bistro",
          planTier: "enterprise",
          machineHash: "6D99",
          checksum: "W1Q8",
          issuedAt: "2026-04-12T10:00:00Z",
          expiresAt: "2027-04-12T10:00:00Z",
          status: "Active",
          isValid: true,
          durationDays: 365,
        },
      ],
      s3Metrics: {
        bucketName: "orderitup-tenant-coastal",
        prefix: "tenants/tenant-0773/",
        totalSizeMb: 642.5,
        objectCount: 4982,
        backupsCount: 19,
        lastBackupIso: "2026-10-31T02:30:00Z",
        zeroComminglingVerified: true,
        outboxPendingCount: 0,
        domainBreakdown: {
          backups: { objectCount: 19, sizeMb: 490.0 },
          payments: { objectCount: 4850, sizeMb: 32.5 },
          users: { objectCount: 16, sizeMb: 1.6 },
          media: { objectCount: 97, sizeMb: 118.4 },
        },
      },
    },
  ],
};

// ============================================================================
// SINGLETON OBSERVABLE STORE WITH LOCALSTORAGE SYNC & SSR HYDRATION SAFETY
// ============================================================================

const STORAGE_KEY = "orderitup_dashboard_state_v1";

let currentState: DashboardState = INITIAL_DASHBOARD_STATE;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn("[DashboardStore] Listener execution error:", err);
    }
  });
}

function persistState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  } catch (err) {
    console.warn("[DashboardStore] LocalStorage write failed:", err);
  }
}

export function getDashboardSnapshot(): DashboardState {
  return currentState;
}

export function getDashboardServerSnapshot(): DashboardState {
  return INITIAL_DASHBOARD_STATE;
}

export function subscribeDashboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateDashboardState(updater: (prev: DashboardState) => DashboardState): void {
  currentState = updater(currentState);
  persistState();
  notifyListeners();
}

/**
 * Hydrates state from localStorage in the browser without SSR mismatch.
 */
export function hydrateDashboardStore(): void {
  if (typeof window === "undefined" || currentState.isHydrated) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DashboardState>;
      currentState = {
        ...INITIAL_DASHBOARD_STATE,
        ...parsed,
        isHydrated: true,
      };
    } else {
      currentState = { ...currentState, isHydrated: true };
      persistState();
    }
  } catch {
    currentState = { ...currentState, isHydrated: true };
  }
  notifyListeners();
}

// Cross-tab synchronization via storage event
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as Partial<DashboardState>;
        currentState = {
          ...INITIAL_DASHBOARD_STATE,
          ...parsed,
          isHydrated: true,
        };
        notifyListeners();
      } catch {
        // ignore malformed payloads from other tabs
      }
    }
  });
}

// ============================================================================
// 8 OPERATIONAL MUTATION METHODS
// ============================================================================

export const dashboardActions = {
  /**
   * 1. Bump Kitchen Ticket / Order Item across lifecycle:
   * pending -> preparing -> ready -> served
   */
  bumpTicket(orderId: string, itemId?: string, newStatus?: TicketItemStatus): void {
    updateDashboardState((state) => {
      const orders = state.orders.map((order) => {
        if (order.id !== orderId) return order;

        const updatedItems = order.items.map((item) => {
          if (itemId && itemId !== "all" && item.id !== itemId) return item;

          let targetStatus = newStatus;
          if (!targetStatus) {
            if (item.status === "pending") targetStatus = "preparing";
            else if (item.status === "preparing") targetStatus = "ready";
            else if (item.status === "ready") targetStatus = "served";
            else targetStatus = item.status;
          }

          const nowIso = new Date().toISOString();
          return {
            ...item,
            status: targetStatus,
            prepStartedAt:
              targetStatus === "preparing" && !item.prepStartedAt ? nowIso : item.prepStartedAt,
            readyAt: targetStatus === "ready" && !item.readyAt ? nowIso : item.readyAt,
            servedAt: targetStatus === "served" && !item.servedAt ? nowIso : item.servedAt,
          };
        });

        const allReady =
          updatedItems.length > 0 &&
          updatedItems.every((i) => i.status === "ready" || i.status === "served");
        const hasPreparing = updatedItems.some((i) => i.status === "preparing");
        const now = new Date().toISOString();

        return {
          ...order,
          items: updatedItems,
          prepStartedAt:
            hasPreparing && !order.prepStartedAt ? now : order.prepStartedAt,
          readyAt: allReady && !order.readyAt ? now : order.readyAt,
          updatedAt: now,
        };
      });

      return { ...state, orders };
    });
  },

  /**
   * 2. Fire Course (Tableside Waiter Handheld :3003)
   * Releases held courses (Starters, Mains, Dessert) to kitchen brigade.
   */
  fireCourse(tableId: string, course: CourseType): void {
    updateDashboardState((state) => {
      const table = state.tables.find((t) => t.id === tableId);
      if (!table || !table.currentOrderId) return state;

      const now = new Date().toISOString();
      const orders = state.orders.map((order) => {
        if (order.id !== table.currentOrderId) return order;

        const updatedItems = order.items.map((item) => {
          if (item.course === course && item.status === "pending") {
            return {
              ...item,
              status: "preparing" as TicketItemStatus,
              specialInstructions:
                (item.specialInstructions ? item.specialInstructions + " | " : "") +
                "Course Fired",
              prepStartedAt: now,
            };
          }
          return item;
        });

        return {
          ...order,
          items: updatedItems,
          prepStartedAt: order.prepStartedAt || now,
          updatedAt: now,
        };
      });

      // Update table's courseFiring tracker
      const updatedTables = state.tables.map((t) => {
        if (t.id !== tableId) return t;
        const currentFiring = t.courseFiring || { starter: false, main: false, dessert: false };
        return {
          ...t,
          courseFiring: {
            ...currentFiring,
            [course]: true,
          },
        };
      });

      return { ...state, orders, tables: updatedTables };
    });
  },

  /**
   * 3. Settle Counter Payment (Split Tenders + 24V Drawer Solenoid + Table Freeing)
   */
  settlePayment(
    orderId: string,
    paymentMethod: PaymentMethodType,
    splitDetails?: SplitSettlementDetails
  ): void {
    updateDashboardState((state) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || order.paymentStatus === "paid") return state;

      const cashAmount =
        paymentMethod === "cash"
          ? order.total
          : paymentMethod === "split"
          ? splitDetails?.cash || 0
          : 0;
      const upiAmount =
        paymentMethod === "upi"
          ? order.total
          : paymentMethod === "split"
          ? splitDetails?.upi || 0
          : 0;
      const cardAmount =
        paymentMethod === "card"
          ? order.total
          : paymentMethod === "split"
          ? splitDetails?.card || 0
          : 0;

      const now = new Date().toISOString();

      // Update Order
      const updatedOrders = state.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentStatus: "paid" as const,
          settlement: {
            method: paymentMethod,
            tenderedAmount: order.total,
            changeReturned: splitDetails?.changeGiven || 0,
            splitBreakdown: splitDetails,
            paidAt: now,
            receiptPrinted: true,
            cashDrawerPulsed: cashAmount > 0,
          },
          updatedAt: now,
        };
      });

      // Free Linked Dining Table
      let updatedTables = state.tables;
      if (order.tableId) {
        updatedTables = state.tables.map((t) => {
          if (t.id !== order.tableId) return t;
          return {
            ...t,
            status: "available" as TableStatus,
            currentOrderId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            pax: undefined,
            courseFiring: undefined,
          };
        });
      }

      // Update Cash Drawer Pulse History & Shift Till
      const updatedPulseHistory = [...state.drawerPulseHistory];
      const updatedShift = { ...state.activeCashShift };
      if (cashAmount > 0) {
        updatedPulseHistory.unshift({
          id: `pulse-${Date.now()}`,
          timestamp: now,
          orderId: order.orderNumber,
          amount: cashAmount,
          reason: "Cash Settlement Kick (0x1B, 0x70, 0x00, 0x19, 0xFA)",
        });
        updatedShift.grossCashSales += cashAmount;
        updatedShift.expectedCashInDrawer += cashAmount;
      }

      // Update Outlet Sales Aggregates
      const updatedOutlets = state.outlets.map((outlet) => {
        if (outlet.id !== order.outletId) return outlet;
        const newSales = outlet.todaySales + order.total;
        const newCount = outlet.ordersCount + 1;
        return {
          ...outlet,
          todaySales: newSales,
          ordersCount: newCount,
          avgTicket: Math.round((newSales / newCount) * 100) / 100,
          tenders: {
            cash: outlet.tenders.cash + cashAmount,
            upi: outlet.tenders.upi + upiAmount,
            card: outlet.tenders.card + cardAmount,
          },
        };
      });

      return {
        ...state,
        orders: updatedOrders,
        tables: updatedTables,
        outlets: updatedOutlets,
        activeCashShift: updatedShift,
        drawerPulseHistory: updatedPulseHistory,
      };
    });
  },

  /**
   * 4. Record Shift Closure & Generate Z-Report
   * Computes expected vs counted cash, records variances, and resets till.
   */
  recordShiftClosure(shiftData: ShiftClosureInput): ShiftZReport {
    let generatedReport: ShiftZReport | null = null;

    updateDashboardState((state) => {
      const opening = state.activeCashShift.openingFloat;
      const grossCash = state.activeCashShift.grossCashSales;
      const refunds = state.activeCashShift.cashRefunds;
      const expected = opening + grossCash - refunds;
      const variance = shiftData.actualCountedCash - expected;

      const nextZNumber =
        state.zReports.length > 0 ? Math.max(...state.zReports.map((z) => z.zNumber)) + 1 : 44;

      const grossSalesTotal = grossCash + 6300 + 28420;
      const cgstTotal = Math.round(grossSalesTotal * 0.025 * 100) / 100;
      const sgstTotal = Math.round(grossSalesTotal * 0.025 * 100) / 100;
      const totalTaxCollected = Math.round(grossSalesTotal * 0.05 * 100) / 100;
      const now = new Date().toISOString();

      generatedReport = {
        id: `zreport-${nextZNumber}`,
        zNumber: nextZNumber,
        outletId: shiftData.outletId,
        terminalId: "POS-01",
        businessDate: now.split("T")[0],
        openedAt: state.activeCashShift.openedAt,
        closedAt: now,
        cashierName: shiftData.cashierName,
        supervisorName: shiftData.supervisorName,
        openingFloat: opening,
        grossCashSales: grossCash,
        cashRefunds: refunds,
        expectedCashInDrawer: expected,
        actualCountedCash: shiftData.actualCountedCash,
        cashVariance: variance,
        cardTotal: 6300,
        upiTotal: 28420,
        grossSalesTotal,
        cgstTotal,
        sgstTotal,
        totalTaxCollected,
        totalBillsIssued: 48,
        status: Math.abs(variance) < 0.01 ? "balanced" : "variance_flagged",
        notes:
          shiftData.notes ||
          (variance < 0
            ? `Cash shortage of ₹${Math.abs(variance).toFixed(2)} flagged on closing register.`
            : variance > 0
            ? `Cash overage of ₹${variance.toFixed(2)} recorded.`
            : "Register closed with zero cash variance."),
      };

      const nextFloat = shiftData.nextOpeningFloat ?? 5000;
      const nextShift: ActiveShiftTill = {
        openedAt: now,
        openingFloat: nextFloat,
        grossCashSales: 0,
        cashRefunds: 0,
        expectedCashInDrawer: nextFloat,
      };

      return {
        ...state,
        zReports: [generatedReport, ...state.zReports],
        activeCashShift: nextShift,
      };
    });

    return generatedReport!;
  },

  /**
   * 5. Assign Staff Role & 4-Digit Security PIN
   */
  assignStaffRole(staffId: string, role: OperationalRole, pin: string): void {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Staff PIN must be exactly 4 numeric digits");
    }

    updateDashboardState((state) => {
      const updatedStaff = state.staff.map((user) => {
        if (user.id !== staffId) return user;
        return {
          ...user,
          role,
          pin,
          lastActive: "Just now",
        };
      });

      return { ...state, staff: updatedStaff };
    });
  },

  /**
   * 6. Update Branch Menu Price Override
   */
  updateBranchPriceOverride(outletId: string, itemId: string, price: number | null): void {
    if (price !== null && price < 0) {
      throw new Error("Price override cannot be negative");
    }

    updateDashboardState((state) => {
      const updatedCatalog = state.catalog.map((item) => {
        if (item.id !== itemId) return item;

        const currentOverrides = item.branchOverrides || {};
        const outletOverride = currentOverrides[outletId] || { isAvailable: true };

        return {
          ...item,
          branchOverrides: {
            ...currentOverrides,
            [outletId]: {
              ...outletOverride,
              priceOverride: price,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });

      return { ...state, catalog: updatedCatalog };
    });
  },

  /**
   * 7. Generate 16-Character Hardware-Bound License Key
   * Format: OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]
   */
  generateLicenseKey(tenantId: string, plan: PlanTier, machineHash: string): string {
    const cleanHash = (machineHash || "8F42")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .padEnd(4, "0")
      .slice(0, 4);

    const planCode = plan === "enterprise" ? "ENT1" : plan === "pro" ? "PRO1" : "STR1";

    // Deterministic 4-character checksum
    let hash = 0x811c9dc5;
    const seed = `OIUP${planCode}${cleanHash}${tenantId}`;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const checksum = Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(-4);
    const key = `OIUP-${planCode}-${cleanHash}-${checksum}` as const;

    updateDashboardState((state) => {
      const updatedTenants = state.tenants.map((tenant) => {
        if (tenant.id !== tenantId) return tenant;

        const newLicense: IssuedLicenseRecord = {
          id: `lic-${Date.now()}`,
          key,
          licenseKey: key,
          tenantId,
          tenantName: tenant.businessName,
          planTier: plan,
          machineHash: cleanHash,
          checksum,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: "Active",
          isValid: true,
          durationDays: 365,
        };

        return {
          ...tenant,
          licenseKeys: [newLicense, ...(tenant.licenseKeys || [])],
        };
      });

      return { ...state, tenants: updatedTenants };
    });

    return key;
  },

  /**
   * 8. Update Delivery Status & Reconcile COD
   */
  updateDeliveryStatus(
    dispatchId: string,
    status: DeliveryRiderStatus,
    codCollected?: boolean
  ): void {
    updateDashboardState((state) => {
      const dispatch = state.dispatches.find((d) => d.id === dispatchId);
      if (!dispatch) return state;

      const isDelivered = status === "delivered";
      const isCodSettled = codCollected === true && dispatch.isCod;
      const now = new Date().toISOString();

      const updatedDispatches = state.dispatches.map((d) => {
        if (d.id !== dispatchId) return d;
        return {
          ...d,
          riderStatus: status,
          codCollected: codCollected !== undefined ? codCollected : d.codCollected,
          deliveredAt: isDelivered ? now : d.deliveredAt,
        };
      });

      let updatedOrders = state.orders;
      let updatedShift = state.activeCashShift;

      if (isCodSettled) {
        updatedShift = {
          ...state.activeCashShift,
          grossCashSales: state.activeCashShift.grossCashSales + dispatch.codAmount,
          expectedCashInDrawer: state.activeCashShift.expectedCashInDrawer + dispatch.codAmount,
        };

        updatedOrders = state.orders.map((o) => {
          if (o.id !== dispatch.orderId) return o;
          return {
            ...o,
            paymentStatus: "paid" as const,
            settlement: {
              method: "cash" as const,
              tenderedAmount: dispatch.codAmount,
              changeReturned: 0,
              paidAt: now,
              receiptPrinted: true,
              cashDrawerPulsed: false,
            },
            updatedAt: now,
          };
        });
      }

      return {
        ...state,
        dispatches: updatedDispatches,
        orders: updatedOrders,
        activeCashShift: updatedShift,
      };
    });
  },

  // Global Navigation & Reset Mutators
  setActivePerspective(perspective: DashboardPerspective): void {
    updateDashboardState((state) => ({ ...state, activePerspective: perspective }));
  },

  setActiveRole(role: OperationalRole): void {
    updateDashboardState((state) => ({ ...state, activeRole: role }));
  },

  setSelectedOutletId(outletId: string): void {
    updateDashboardState((state) => ({ ...state, selectedOutletId: outletId }));
  },

  resetToSeedData(): void {
    currentState = { ...INITIAL_DASHBOARD_STATE, isHydrated: true };
    persistState();
    notifyListeners();
  },
};

// ============================================================================
// REACT HOOKS
// ============================================================================

export function useDashboardStore<T>(selector: (state: DashboardState) => T): T {
  useEffect(() => {
    hydrateDashboardStore();
  }, []);

  const state = useSyncExternalStore(
    subscribeDashboard,
    getDashboardSnapshot,
    getDashboardServerSnapshot
  );
  return selector(state);
}

export function useDashboardActions() {
  return dashboardActions;
}

// Domain-Specific Hooks
export function useActivePerspective() {
  return useDashboardStore((s) => s.activePerspective);
}

export function useActiveRole() {
  return useDashboardStore((s) => s.activeRole);
}

export function useSelectedOutletId() {
  return useDashboardStore((s) => s.selectedOutletId);
}

export function useOutlets() {
  return useDashboardStore((s) => s.outlets);
}

export function useOrders() {
  return useDashboardStore((s) => s.orders);
}

export function useTables() {
  return useDashboardStore((s) => s.tables);
}

export function useStaff() {
  return useDashboardStore((s) => s.staff);
}

export function useCatalog() {
  return useDashboardStore((s) => s.catalog);
}

export function useZReports() {
  return useDashboardStore((s) => s.zReports);
}

export function useDispatches() {
  return useDashboardStore((s) => s.dispatches);
}

export function useTenants() {
  return useDashboardStore((s) => s.tenants);
}

export function useActiveCashShift() {
  return useDashboardStore((s) => s.activeCashShift);
}

export function useDrawerPulseHistory() {
  return useDashboardStore((s) => s.drawerPulseHistory);
}

export function useIsStoreHydrated() {
  return useDashboardStore((s) => s.isHydrated);
}
