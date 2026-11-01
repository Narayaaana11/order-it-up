export const BRAND = {
  name: "Order It Up",
  tagline: "An Offline-First Restaurant POS Being Prepared for Pilot",
  eyebrow: "EARLY-ACCESS PILOT • OFFLINE-FIRST DESIGN • HARDWARE UNDER EVALUATION",
  description:
    "Explore an offline-first approach to restaurant billing, local kitchen workflows and thermal printing. Features and hardware compatibility vary by build and will be reviewed with pilot users.",
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
    value: "Pilot stage",
    label: "Product availability",
    subtext: "Access is reviewed individually. A request does not automatically create an account.",
  },
  {
    value: "Offline-first",
    label: "Architecture direction",
    subtext: "Selected local workflows are designed to continue without a continuous internet connection.",
  },
  {
    value: "Under evaluation",
    label: "Performance & devices",
    subtext: "No public benchmark or blanket hardware compatibility claim is published.",
  },
  {
    value: "Request access",
    label: "Pilot programme",
    subtext: "Share your current POS and hardware so the team can review fit and next steps.",
  },
];

export const CORE_FEATURES = [
  {
    id: "pos-billing",
    badge: "Counter workflow preview",
    title: "Counter Billing & Order Entry",
    description: "The current desktop build includes counter billing and order-entry workflows. Barcode scanners, weighing scales, split tenders and order hold/recall behaviour must be validated against the installed build and your hardware.",
    icon: "ShoppingCart",
    highlights: ["Product search and cart entry", "Peripheral compatibility: verify first", "Order hold/recall: build-dependent"],
  },
  {
    id: "thermal-printing",
    badge: "Printer compatibility evaluation",
    title: "Thermal Receipts & Peripheral Testing",
    description: "Thermal output is being evaluated with selected ESC/POS printers. Paper width, connection method and cash-drawer trigger behaviour depend on the exact printer, drawer, firmware and installed build.",
    icon: "Printer",
    highlights: ["Printer model and driver checks", "Cash-drawer electrical compatibility checks", "Receipt format review during pilot"],
  },
  {
    id: "kds-kitchen",
    badge: "Kitchen workflow preview",
    title: "Kitchen Display (KDS) Preview",
    description: "The KDS preview illustrates a kitchen-ticket workflow. Live order routing, LAN synchronisation, station behaviour and timing indicators must be verified against the deployed build and network.",
    icon: "ChefHat",
    highlights: ["Illustrative ticket status flow", "Sample station routing", "Build and network validation required"],
  },
  {
    id: "floor-tables",
    badge: "Table workflow preview",
    title: "Table & Floor Workflow Preview",
    description: "A sample view of room layouts and table-state concepts. Check which table layouts, status changes and timers are available in the current pilot build before relying on them.",
    icon: "LayoutGrid",
    highlights: ["Illustrative table layout", "Sample table status indicators", "Availability depends on pilot build"],
  },
  {
    id: "modifiers-inventory",
    badge: "Catalog feature evaluation",
    title: "Catalog, Modifiers & Inventory Evaluation",
    description: "The catalog preview illustrates categories, products and modifier ideas. Recipe-level stock depletion, dietary filters and out-of-stock controls require confirmation in the current installed build.",
    icon: "Sliders",
    highlights: ["Sample product and category views", "Modifier behaviour: build-dependent", "Inventory automation: under evaluation"],
  },
  {
    id: "security-audit",
    badge: "Permissions workflow evaluation",
    title: "Role Permissions & Shift Workflows",
    description: "User roles, approval controls, cash reconciliation, audit coverage and accounting exports depend on the current build and configuration. Confirm the required workflows during pilot onboarding.",
    icon: "ShieldCheck",
    highlights: ["Role permissions: verify by role", "Cash closure workflows: build-dependent", "Audit and export outputs: pilot evaluation"],
  },
];

export const ARCHITECTURE_LAYERS = [
  {
    level: "Local Counter Runtime",
    port: "Local service ports depend on the installed build",
    tech: "Electron, Node.js and local database components",
    description: "Local-first architecture intended to support selected restaurant workflows without a continuous internet connection.",
    status: "Pilot validation",
  },
  {
    level: "Local Network Workflows",
    port: "LAN ports and roles depend on configuration",
    tech: "Local networking and service components",
    description: "Kitchen and staff-device workflows require validation against the installed build, network and participating devices.",
    status: "Network testing required",
  },
  {
    level: "Hardware Peripheral Layer",
    port: "USB / network / serial connections vary by device",
    tech: "Printer and peripheral integrations under evaluation",
    description: "Compatibility and trigger behaviour must be checked for each device, driver, firmware and connection method.",
    status: "Model testing required",
  },
  {
    level: "Optional Cloud Services",
    port: "HTTPS endpoints when enabled",
    tech: "Cloud API and database services",
    description: "Connected features are optional and depend on the deployment, configuration and selected plan.",
    status: "Optional / configuration-dependent",
  },
];

export const ROLE_PERSONAS = [
  {
    id: "cashier",
    title: "Front Cashier",
    subtitle: "Counter billing workflow",
    badge: "Workflow preview",
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
    subtitle: "Tableside workflow preview",
    badge: "Build-dependent",
    icon: "Smartphone",
    responsibilities: [
      "Example table status views; confirm live behaviour in the pilot build",
      "Mobile order entry and course firing are under evaluation",
      "Modifier options depend on the configured menu and current build",
      "Device pairing and permissions must be verified before use",
    ],
    accent: "amber",
  },
  {
    id: "chef",
    title: "Kitchen Station Chef",
    subtitle: "Kitchen ticket handling preview",
    badge: "KDS preview",
    icon: "ChefHat",
    responsibilities: [
      "Illustrative kitchen-ticket view",
      "Ticket status transitions depend on the installed build",
      "Sample elapsed-time indicators; no service-level performance is promised",
      "Station routing requires build and network validation",
    ],
    accent: "emerald",
  },
  {
    id: "manager",
    title: "Restaurant Owner & GM",
    subtitle: "Management workflow preview",
    badge: "Management preview",
    icon: "Store",
    responsibilities: [
      "Role-controlled cancellation and refund permissions depend on configuration",
      "Example management reporting; confirm each report in the current build",
      "Menu and branch management features are build-dependent",
      "Audit-event coverage depends on the enabled build and configuration",
    ],
    accent: "sky",
  },
  {
    id: "accountant",
    title: "Head Accountant",
    subtitle: "Financial and reporting workflow preview",
    badge: "Reports preview",
    icon: "FileSpreadsheet",
    responsibilities: [
      "Review configured tax summaries and transaction records",
      "Daily cash closure workflows must be verified in the pilot build",
      "Accounting export availability requires validation",
      "Have your accountant review all tax and accounting outputs before use",
    ],
    accent: "purple",
  },
  {
    id: "driver",
    title: "Delivery Driver",
    subtitle: "Delivery workflow concept",
    badge: "Under evaluation",
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
  table: "SAMPLE TABLE",
  pax: 2,
  orderNo: "SAMPLE-001",
  cashier: "Sample cashier",
  date: "SAMPLE DATE / TIME",
  items: [
    {
      id: "item-1",
      name: "Sample menu item A",
      qty: 1,
      price: 100,
      modifier: "Sample modifier",
      modPrice: 0,
      note: "Illustrative item only",
      tag: "veg",
    },
    {
      id: "item-2",
      name: "Sample menu item B",
      qty: 1,
      price: 80,
      modifier: "No modifier",
      modPrice: 0,
      note: "Illustrative item only",
      tag: "veg",
    },
  ],
};

export const HARDWARE_SPECS = [
  {
    category: "Thermal Printers",
    supported: "Candidate ESC/POS models only — compatibility not certified",
    connectivity: "Connection support varies by model, driver, operating system and firmware",
    brands: "No brand-wide compatibility claim; request a model-specific pilot check",
  },
  {
    category: "Cash Drawers",
    supported: "Cash-drawer support is under evaluation",
    connectivity: "Electrical and firmware compatibility must be checked per model",
    behavior: "No automated drawer trigger behaviour is guaranteed",
  },
  {
    category: "Barcode & Scanners",
    supported: "Barcode and QR scanner input is under evaluation",
    connectivity: "Input mode and connection depend on the candidate device",
    standards: "Symbology support must be verified against the exact build and device",
  },
  {
    category: "Weighing Scales",
    supported: "Digital weighing-scale integration is under evaluation",
    connectivity: "Serial/USB integration requires device and driver testing",
    units: "Units, tare and price-computing behaviour are not yet certified",
  },
  {
    category: "Operating Systems",
    supported: "Check current release availability before installation",
    connectivity: "Compatibility varies by operating system and package",
    runtime: "Runtime and platform requirements depend on the distributed build",
  },
];
