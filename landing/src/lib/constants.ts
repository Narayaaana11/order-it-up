export const BRAND = {
  name: "Order It Up",
  tagline: "Offline-first restaurant operations, currently in pilot testing",
  eyebrow: "EARLY-ACCESS PILOT • OFFLINE-FIRST DESIGN • LOCAL WORKFLOWS",
  description:
    "An early-stage restaurant operations product exploring local-first billing, kitchen display workflows and compatible hardware integrations with pilot users.",
  company: "Order It Up pilot team",
  version: "v1.2.0-desktop",
};

export const UNSPLASH_ASSETS = {
  posTerminalCounter:
    "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80",
  posCashierRegister:
    "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1200&q=80",
  kitchenChefPrep:
    "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1200&q=80",
  kitchenBrigadeLine:
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
  restaurantFloorTables:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  restaurantAtmosphere:
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
  waiterMobileTablet:
    "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=1200&q=80",
  accountingLedger:
    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80",
  dishes: {
    trufflePizza:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=160&q=80",
    paneerTikka:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=160&q=80",
    coldBrewLatte:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=160&q=80",
    chocolateLavaCake:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=160&q=80",
  },
};

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Interactive Demo", href: "#ui-preview" },
  { label: "Role Personas", href: "#roles" },
  { label: "Hardware & Specs", href: "#specs" },
];

export const TRUST_METRICS = [
  {
    value: "Local-first",
    label: "Counter workflows",
    subtext: "Designed to keep supported core workflows on the restaurant's local system.",
  },
  {
    value: "SQLite",
    label: "Local data layer",
    subtext: "The desktop architecture uses a local SQLite database.",
  },
  {
    value: "LAN",
    label: "Kitchen and waiter workflows",
    subtext: "KDS and waiter interfaces are designed to communicate over the restaurant's local network.",
  },
  {
    value: "Pilot",
    label: "Compatibility evaluation",
    subtext: "Features and hardware compatibility are being evaluated with pilot users.",
  },
];

export const CORE_FEATURES = [
  {
    id: "pos-billing",
    badge: "Counter workflow evaluation",
    title: "Counter Billing & Order Entry",
    description:
      "The current desktop build includes counter billing and order-entry workflows. Barcode scanners, weighing scales, split tenders and order hold/recall behaviour must be validated against the installed build and your hardware.",
    icon: "ShoppingCart",
    highlights: ["Product search and cart entry", "Peripheral compatibility: verify first", "Order hold/recall: build-dependent"],
  },
  {
    id: "thermal-printing",
    badge: "Printer compatibility evaluation",
    title: "Thermal Receipts & Peripheral Testing",
    description:
      "Thermal output is being evaluated with selected ESC/POS printers. Paper width, connection method and cash-drawer trigger behaviour depend on the exact printer, drawer, firmware and installed build.",
    icon: "Printer",
    highlights: ["Printer model and driver checks", "Cash-drawer electrical compatibility checks", "Receipt format review during pilot"],
  },
  {
    id: "kds-kitchen",
    badge: "Local network workflow",
    title: "Kitchen Display (KDS) Preview",
    description:
      "A local-network kitchen display workflow with ticket status views and station-oriented order handling. Exact behaviour depends on the pilot build and network setup.",
    icon: "ChefHat",
    highlights: ["Illustrative ticket status flow", "Sample station routing", "Build and network validation required"],
  },
  {
    id: "floor-tables",
    badge: "Table workflow preview",
    title: "Table & Floor Workflow Preview",
    description:
      "A sample view of room layouts and table-state concepts. Check which table layouts, status changes and timers are available in the current pilot build before relying on them.",
    icon: "LayoutGrid",
    highlights: ["Illustrative table layout", "Sample table status indicators", "Availability depends on pilot build"],
  },
  {
    id: "modifiers-inventory",
    badge: "Catalog feature evaluation",
    title: "Catalog, Modifiers & Inventory Evaluation",
    description:
      "The catalog preview illustrates categories, products and modifier ideas. Recipe-level stock depletion, dietary filters and out-of-stock controls require confirmation in the current installed build.",
    icon: "Sliders",
    highlights: ["Sample product and category views", "Modifier behaviour: build-dependent", "Inventory automation: under evaluation"],
  },
  {
    id: "security-audit",
    badge: "Role permissions",
    title: "Multi-Role Security & Shift Reconciliation",
    description:
      "Role-based operational views with configurable permissions, cash-closure summaries and accounting export workflows. Availability depends on the pilot build and configuration.",
    icon: "ShieldCheck",
    highlights: ["Role permissions: verify by role", "Cash closure workflows: build-dependent", "Audit and export outputs: pilot evaluation"],
  },
];

export const ARCHITECTURE_LAYERS = [
  {
    level: "Local Counter Hardware",
    port: "Port 3001 (Internal)",
    tech: "Electron 34 + Node.js 22 + SQLite WAL (`flo.db`)",
    description: "Local desktop transaction engine designed to operate without a continuous internet connection for supported workflows.",
    status: "Local-first design",
  },
  {
    level: "Local Network Mesh (LAN)",
    port: "Ports 3002 (KDS) & 3003 (Waiter)",
    tech: "Local WebSockets & Micro-HTTP Server",
    description: "Kitchen screens and server tablets communicate directly over your in-house Wi-Fi without internet.",
    status: "LAN workflow",
  },
  {
    level: "Hardware Peripheral Bus",
    port: "USB / TCP / Serial / Bluetooth",
    tech: "Direct ESC/POS Raw Bytecode & RJ11/RJ12 Solenoids",
    description: "Compatible printer and cash-drawer behaviour depends on the device, connection, firmware and configuration.",
    status: "Model testing required",
  },
  {
    level: "Cloud HQ Sync (Optional)",
    port: "HTTPS Background Outbox",
    tech: "Cloudflare Edge + D1 Database",
    description: "Optional connected features may synchronise selected information when enabled and configured.",
    status: "Optional / configuration-dependent",
  },
];

export const ROLE_PERSONAS = [
  {
    id: "cashier",
    title: "Front Cashier",
    subtitle: "High-Velocity Counter Operations",
    badge: "Checkout workflow demo",
    icon: "CreditCard",
    responsibilities: [
      "Illustrative product search and counter workflow; scanner support requires device testing",
      "Payment and split-tender options depend on enabled payment workflows",
      "Receipt output and cash-drawer behaviour depend on tested hardware",
      "Shift and cash-reconciliation workflows require pilot-build verification",
    ],
    accent: "orange",
  },
  {
    id: "waiter",
    title: "Floor Captain & Waiter",
    subtitle: "Tableside Handheld Ordering",
    badge: "Mobile Handheld :3003",
    icon: "Smartphone",
    responsibilities: [
      "Example table status views; confirm live behaviour in the pilot build",
      "Mobile order entry and course firing are under evaluation",
      "Modifier options depend on the configured menu and current build",
      "PIN-based device pairing where enabled by the pilot build",
    ],
    accent: "amber",
  },
  {
    id: "chef",
    title: "Kitchen Station Chef",
    subtitle: "Kitchen Ticket Handling Preview",
    badge: "LAN KDS :3002",
    icon: "ChefHat",
    responsibilities: [
      "Touch-friendly KDS view for kitchen ticket handling",
      "One-tap ticket bumping from Pending to Preparing to Ready",
      "Sample elapsed-time indicators; no service-level performance is promised",
      "Station routing: Bar, Oven, Grill, Fryer, Main Kitchen",
    ],
    accent: "emerald",
  },
  {
    id: "manager",
    title: "Restaurant Owner & GM",
    subtitle: "Complete Operational Control",
    badge: "Executive HQ",
    icon: "Store",
    responsibilities: [
      "Role-controlled cancellation and refund permissions depend on configuration",
      "Example management reporting; confirm each report in the current build",
      "Menu engineering matrix: Stars, Plowhorses, Puzzles, and Dogs",
      "Audit-event coverage depends on the enabled build and configuration",
    ],
    accent: "sky",
  },
  {
    id: "accountant",
    title: "Head Accountant",
    subtitle: "Financial & Reporting Workflows",
    badge: "Reports & exports",
    icon: "FileSpreadsheet",
    responsibilities: [
      "Review configured tax summaries and transaction records",
      "Daily Z-report cash closures with expected vs counted balances",
      "One-click Tally XML export for external accounting systems",
      "Export available reports for review with your accountant",
    ],
    accent: "purple",
  },
  {
    id: "driver",
    title: "Delivery Driver",
    subtitle: "Out-of-Store Fulfillment",
    badge: "Dispatch Ready",
    icon: "Bike",
    responsibilities: [
      "Illustrative delivery workflow; not a live driver service",
      "Dispatch tracking is subject to pilot-build verification",
      "Payment collection workflows must be validated before operational use",
      "Do not enter customer contact data until the selected workflow and privacy controls have been verified",
    ],
    accent: "rose",
  },
];

export const MOCK_ORDER = {
  restaurant: "Sample restaurant — illustrative preview only",
  address: "No business address supplied in this sample",
  gstin: "Not supplied in this sample",
  fssai: "Not supplied in this sample",
  table: "DEMO TABLE 04",
  pax: 4,
  orderNo: "SAMPLE-001",
  cashier: "Sample cashier",
  date: "SAMPLE DATE / TIME",
  items: [
    {
      id: "item-1",
      name: "Truffle Mushroom Wood-Fired Pizza",
      qty: 1,
      price: 540,
      modifier: "Extra Mozzarella (+₹60.00)",
      modPrice: 60,
      note: "Crispy thin crust, well done",
      tag: "veg",
    },
    {
      id: "item-2",
      name: "Artisanal Paneer Tikka Platter",
      qty: 2,
      price: 380,
      modifier: "Mint Chutney & Laccha Onion",
      modPrice: 0,
      note: "Chef special spice blend",
      tag: "veg",
    },
    {
      id: "item-3",
      name: "Classic Cold Brew Latte",
      qty: 2,
      price: 220,
      modifier: "Oat Milk Sub (x2) (+₹80.00)",
      modPrice: 80,
      note: "Served chilled with coffee ice cubes",
      tag: "vegan",
    },
    {
      id: "item-4",
      name: "Belgian Dark Chocolate Lava Cake",
      qty: 1,
      price: 280,
      modifier: "Vanilla Bean Gelato Scoop (+₹50.00)",
      modPrice: 50,
      note: "Hold for dessert call",
      tag: "egg",
    },
  ],
};

export const HARDWARE_SPECS = [
  {
    category: "Thermal Printers",
    supported: "Selected ESC/POS 80mm & 58mm models (testing required)",
    connectivity: "USB 2.0 / 3.0, Ethernet RJ45 TCP/IP, Bluetooth 4.0+, Windows Spooler",
    brands: "Candidate models only — no compatibility claim; test before purchase", 
  },
  {
    category: "Cash Drawers",
    supported: "Cash-drawer support is not certified; electrical and firmware checks are required", 
    connectivity: "Direct printer kick connection via DK port",
    behavior: "Trigger behaviour has not been confirmed across hardware models", 
  },
  {
    category: "Barcode & Scanners",
    supported: "Barcode and QR scanner input is under evaluation", 
    connectivity: "Input mode and connection depend on the candidate device", 
    standards: "Symbologies supported must be verified by model and build", 
  },
  {
    category: "Weighing Scales",
    supported: "Digital weighing-scale integration is under evaluation", 
    connectivity: "Serial/USB integration requires device and driver testing", 
    units: "Units, tare and price-computing behaviour are not yet certified", 
  },
  {
    category: "Operating Systems",
    supported: "Desktop platform support under evaluation",
    connectivity: "Confirm currently available build and compatibility with the pilot team",
    runtime: "Runtime and platform requirements depend on the distributed build", 
  },
];

