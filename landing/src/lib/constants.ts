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
    badge: "QSR & Counter Ready",
    title: "Sub-Second Counter Billing",
    description:
      "Engineered for high-volume counter queues. Barcode scanner support, touch-optimized numpad, fractional weighing scale inputs, and split bills settled in under 3 seconds.",
    icon: "ShoppingCart",
    highlights: ["Speed cart search & scan", "Fractional scales (kg/g/lb)", "Hold & recall orders in 1 click"],
  },
  {
    id: "thermal-printing",
    badge: "ESC/POS Raw Driver",
    title: "Thermal Receipts & 24V Drawer Kick",
    description:
      "Native direct thermal printing without browser print dialog lag. Supports 58mm and 80mm rolls over USB, Ethernet LAN, and Bluetooth, with automated 24V cash drawer pulses.",
    icon: "Printer",
    highlights: ["Raw ESC/POS bytecode engine", "Automated cash drawer pulse", "Bilingual GST/VAT itemized slips"],
  },
  {
    id: "kds-kitchen",
    badge: "Local network workflow",
    title: "Real-Time Kitchen Display (KDS)",
    description:
      "A local-network kitchen display workflow with ticket status views and station-oriented order handling. Exact behaviour depends on the pilot build and network setup.",
    icon: "ChefHat",
    highlights: ["Local Wi-Fi WebSocket sync", "SLA elapsed countdown alerts", "Allergy & course highlight chips"],
  },
  {
    id: "floor-tables",
    badge: "Turnover Intelligence",
    title: "Table & Floor Management",
    description:
      "Visual room designer for Indoor, Patio, Rooftop, and Private Dining. Track live table states (Available, Occupied, Billed, Held, Cleaning) with duration timers to maximize turnover.",
    icon: "LayoutGrid",
    highlights: ["Interactive multi-floor canvas", "Live dining duration alerts", "Pax & cover capacity tracking"],
  },
  {
    id: "modifiers-inventory",
    badge: "Catalog & Recipe Control",
    title: "Modifiers, Add-ons & Stock Depletion",
    description:
      "Hierarchical categories, required/optional modifier groups, dietary badges (Veg, Vegan, Non-Veg, Egg, Gluten-Free), and real-time recipe ingredient depletion with 86'd out-of-stock locking.",
    icon: "Sliders",
    highlights: ["Multi-quantity add-ons", "Dietary & allergy tagging", "Automatic low-stock lockout"],
  },
  {
    id: "security-audit",
    badge: "Role permissions",
    title: "Multi-Role Security & Shift Reconciliation",
    description:
      "Role-based operational views with configurable permissions, cash-closure summaries and accounting export workflows. Availability depends on the pilot build and configuration.",
    icon: "ShieldCheck",
    highlights: ["Master Manager PIN gates", "Opening float & cash drops", "End-of-day Z-Report balancing"],
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
      "Lightning-fast barcode scanning and product search",
      "Dynamic split billing (Cash, Cards, UPI QR, Split Tenders)",
      "Instant 80mm thermal receipt printing & 24V drawer kick",
      "Shift opening float management and daily cash reconciliation",
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
      "Real-time table status monitoring (Available, Occupied, Billed)",
      "Tableside order taking and course firing from mobile phones",
      "Item modifier selection (Spice level, cooking temperature, allergies)",
      "Zero-config 6-digit ephemeral PIN device pairing",
    ],
    accent: "amber",
  },
  {
    id: "chef",
    title: "Kitchen Station Chef",
    subtitle: "Zero-Lag Order Preparation",
    badge: "LAN KDS :3002",
    icon: "ChefHat",
    responsibilities: [
      "Dedicated touch-friendly KDS screen with zero browser lag",
      "One-tap ticket bumping from Pending to Preparing to Ready",
      "Color-coded SLA alert timers (<8m green, 8-15m amber, >15m red)",
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
      "Master Manager PIN overrides for cancellations and refunds",
      "Live sales metrics, average order value (AOV), and table turnover",
      "Menu engineering matrix: Stars, Plowhorses, Puzzles, and Dogs",
      "Staff audit logs tracking every discount, void, and tender change",
    ],
    accent: "sky",
  },
  {
    id: "accountant",
    title: "Head Accountant",
    subtitle: "Financial & Reporting Workflows",
    badge: "GST / VAT & Tally",
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
      "Order package pickup verification and customer address slips",
      "Live order dispatch timestamp tracking",
      "Cash-on-delivery (COD) collection tally",
      "Customer phone number masking for privacy protection",
    ],
    accent: "rose",
  },
];

export const MOCK_ORDER = {
  restaurant: "SAMPLE RESTAURANT — FICTIONAL",
  address: "Sample address, India — not a real business",
  gstin: "SAMPLE ONLY — NOT A VALID GSTIN",
  fssai: "SAMPLE ONLY — NOT A VALID FSSAI LICENCE",
  table: "DEMO TABLE 04",
  pax: 4,
  orderNo: "DEMO-001",
  cashier: "Demo Cashier",
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
    brands: "Epson TM-T82/TM-T88, Star Micronics, TVS RP-3150, Rongta, Munbyn, Bixolon, Xprinter",
  },
  {
    category: "Cash Drawers",
    supported: "Selected compatible cash drawers (electrical checks required)",
    connectivity: "Direct printer kick connection via DK port",
    behavior: "Auto-eject on Cash settlement, manual key lock audit",
  },
  {
    category: "Barcode & Scanners",
    supported: "1D / 2D Barcode & QR Code Scanners",
    connectivity: "USB HID Keyboard Emulation & Serial RS232",
    standards: "EAN-13, UPC-A, Code-128, QR Code, GS1 DataBar",
  },
  {
    category: "Weighing Scales",
    supported: "Digital Counter Scales (Price Computing)",
    connectivity: "Serial COM port RS-232 / USB Virtual COM",
    units: "Grams, Kilograms, Pounds, Ounces with tare support",
  },
  {
    category: "Operating Systems",
    supported: "Desktop platform support under evaluation",
    connectivity: "Confirm currently available build and compatibility with the pilot team",
    runtime: "Zero runtime dependencies, standalone bundled Electron + SQLite",
  },
];

