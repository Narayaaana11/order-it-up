export const BRAND = {
  name: "Order It Up",
  tagline: "The Modern Offline-First Restaurant Operating System",
  eyebrow: "⚡ 100% Offline-First POS • Zero Cloud Lock-In • Hardware Native",
  description:
    "Run lightning-fast counter billing with zero cloud dependency, orchestrate real-time kitchen displays over your local LAN, and print thermal receipts directly over USB and network — completely offline with embedded SQLite reliability.",
  company: "IndentDev",
  version: "v1.2.0-desktop",
};

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Dashboard", href: "#roles" },
  { label: "Interactive Demo", href: "#ui-preview" },
  { label: "Architecture", href: "#architecture" },
  { label: "Hardware & Specs", href: "#specs" },
];

export const TRUST_METRICS = [
  {
    value: "100%",
    label: "Offline Durability",
    subtext: "Atomic SQLite WAL transactions on local disk. Zero cloud dependency.",
  },
  {
    value: "0.0s",
    label: "Cloud Risk Exposure",
    subtext: "Never freeze during dinner rush when the internet drops or ISP flickers.",
  },
  {
    value: "< 10ms",
    label: "Local Billing Latency",
    subtext: "Sub-second cart calculation, instant modifier toggles, and snappy settlement.",
  },
  {
    value: "100+",
    label: "Active Installs & Pilots",
    subtext: "Powering busy cafes, QSR counters, bars, and multi-station restaurants.",
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
    badge: "Zero-Cloud LAN Mesh",
    title: "Real-Time Kitchen Display (KDS)",
    description:
      "Dedicated local WebSocket KDS running on port :3002. Drag-and-drop Kanban tickets, color-coded SLA timers, and dynamic item routing to Grill, Bar, Fryer, or Main Kitchen stations.",
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
    badge: "Anti-Theft Safeguards",
    title: "Multi-Role Security & Shift Reconciliation",
    description:
      "10 operational personas with scoped permissions. Master Manager PIN protection on voids, refunds, and discounts, coupled with automated end-of-day Z-reports and Tally XML export.",
    icon: "ShieldCheck",
    highlights: ["Master Manager PIN gates", "Opening float & cash drops", "End-of-day Z-Report balancing"],
  },
];

export const ARCHITECTURE_LAYERS = [
  {
    level: "Local Counter Hardware",
    port: "Port 3001 (Internal)",
    tech: "Electron 34 + Node.js 22 + SQLite WAL (`flo.db`)",
    description: "Sub-10ms transactional engine running completely offline on your counter terminal.",
    status: "Active Authority",
  },
  {
    level: "Local Network Mesh (LAN)",
    port: "Ports 3002 (KDS) & 3003 (Waiter)",
    tech: "Local WebSockets & Micro-HTTP Server",
    description: "Kitchen screens and server tablets communicate directly over your in-house Wi-Fi without internet.",
    status: "Zero Cloud Lag",
  },
  {
    level: "Hardware Peripheral Bus",
    port: "USB / TCP / Serial / Bluetooth",
    tech: "Direct ESC/POS Raw Bytecode & RJ11/RJ12 Solenoids",
    description: "Bypasses operating system print dialogs for instant receipt cutting and cash drawer ejection.",
    status: "Hardware Native",
  },
  {
    level: "Cloud HQ Sync (Optional)",
    port: "HTTPS Background Outbox",
    tech: "Cloudflare Edge + D1 Database",
    description: "Silently synchronizes sales analytics and master menu catalog when internet is available.",
    status: "Graceful Fallback",
  },
];

export const ROLE_PERSONAS = [
  {
    id: "cashier",
    title: "Front Cashier",
    subtitle: "High-Velocity Counter Operations",
    badge: "Sub-3s Checkout",
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
    subtitle: "Financial & Tax Compliance",
    badge: "GST / VAT & Tally",
    icon: "FileSpreadsheet",
    responsibilities: [
      "Automated split GST tax calculations (CGST 2.5%, SGST 2.5%)",
      "Daily Z-report cash closures with expected vs counted balances",
      "One-click Tally XML export for external accounting systems",
      "Archival tax audit reports with tamper-evident serial numbers",
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
  restaurant: "The Rustic Olive Bistro & Bar",
  address: "42 Connaught Place, New Delhi 110001",
  gstin: "07AAAAA0000A1Z5",
  fssai: "10019011000234",
  table: "T-04 (Indoor)",
  pax: 4,
  orderNo: "#104",
  cashier: "Rohit S.",
  date: "30-Oct-2026 19:42",
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
    supported: "ESC/POS 80mm & 58mm Rolls",
    connectivity: "USB 2.0 / 3.0, Ethernet RJ45 TCP/IP, Bluetooth 4.0+, Windows Spooler",
    brands: "Epson TM-T82/TM-T88, Star Micronics, TVS RP-3150, Rongta, Munbyn, Bixolon, Xprinter",
  },
  {
    category: "Cash Drawers",
    supported: "Standard RJ11 / RJ12 24V Solenoid kick pulse",
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
    supported: "Desktop Cross-Platform Native Binary",
    connectivity: "Windows 10 / 11 (x64/ARM64), macOS 12+ (Apple Silicon & Intel), Ubuntu/Debian Linux",
    runtime: "Zero runtime dependencies, standalone bundled Electron + SQLite",
  },
];

