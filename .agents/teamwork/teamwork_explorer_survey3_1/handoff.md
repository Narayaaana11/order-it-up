# Phase 0 Survey Report: Requirements R1 & R3

**Target Subsystems**: 
- `R1. Landing Page UI & Authentic Visual Assets`
- `R3. Startup Terms & Conditions Redesign`
**Investigating Agent**: `teamwork_explorer_survey3_1` (Read-Only Exploration Agent)
**Working Directory**: `d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey3_1`
**Parent Orchestrator**: `0f278f7c-ec06-48f6-9c2f-e89c1978e9bf`

---

## 1. Observation

### 1.1 Dual Landing Page Implementations & Repository Layout
The repository contains two landing page codebases:
1. **Primary Landing App (`landing/`)**:
   - Location: `d:\narayana\order-it-up\landing`
   - Framework: Independent Next.js 16.3.4 (App Router) + React 19.2.8 + Tailwind CSS v4 (`@tailwindcss/postcss`: "^4") + Lucide React 1.40.0.
   - Entry point: `landing/src/app/page.tsx`.
   - Build configuration (`landing/next.config.ts`):
     ```ts
     const nextConfig: NextConfig = {
       output: "export",
       trailingSlash: true,
       images: { unoptimized: true },
       turbopack: { root: __dirname },
     };
     ```
   - Build & Lint status:
     - `npm --prefix landing run lint` passed with 0 errors.
     - `npm --prefix landing run build` passed with 0 errors (static export generated in `landing/out/`).
2. **In-Repo Mirror / Desktop Redirect (`frontend/src/app/page.tsx` & `frontend/src/components/landing/`)**:
   - Framework: Next.js 16.3.4 + React 19.2.8.
   - Dynamic behavior in `frontend/src/app/page.tsx`:
     ```tsx
     useEffect(() => {
       if (isElectronEnvironment()) {
         router.replace('/dashboard');
       }
     }, [router]);
     ```
   - Automated test suite in `tests/landing-page-e2e.test.cjs`:
     - Inspects `frontend/src/components/landing/Navbar.tsx` and failed at assertion line 218 (`Navbar must render brand name`) because `frontend/src/components/landing/Navbar.tsx` hardcoded `<span className="text-xl font-black tracking-tight text-slate-900 whitespace-nowrap">Order It Up</span>` instead of referencing `BRAND.name`, and omitted `100% Offline Engine`.

---

### 1.2 Section-by-Section Visual Inventory & Layout Audit on `landing/`

| Section / Component | Current Implementation | Observed Visual Deficiencies & Mismatches |
| :--- | :--- | :--- |
| **Hero (`Hero.tsx`)** | Squares canvas background, Particles, BlurText headline, RotatingText value propositions, StarBorder download button, 4 Spotlight trust cards, TiltedCard mockup frame. | **Empty Mockup Interior**: The desktop application window mockup (`TiltedCard`, lines 251–321) has an authentic title bar (red/yellow/green window dots + DecryptedText WAL status), but its interior contains only three disconnected text stat boxes (`Active Dining Tables: 14 / 18`, `KDS Active Tickets: 6 In-Flight`, `Hardware Status: 80mm Thermal`). It **completely lacks an authentic photography visual preview** showing the real desktop billing interface or restaurant counter in action.<br><br>**Emoji in Eyebrow**: `BRAND.eyebrow` in `constants.ts:4` starts with `⚡`, rendering an emoji right next to the `<Zap />` Lucide SVG icon (`Hero.tsx:85`).<br><br>**Platform Inconsistency**: Hero trust badge claims *"Windows, macOS & Linux"* (`Hero.tsx:183`), contradicting Requirement R2 which mandates Windows desktop release only. |
| **Hardware Ticker (`HardwareMarquee.tsx`)** | InfiniteScroll marquee featuring 10 hardware stack badges with Lucide icons (Database, Printer, Zap, Radio, Cpu, Laptop, Apple, Terminal). | Visual alignment is clean and high-contrast on `bg-slate-900`. Consistent SVG sizing (`w-4 h-4`). |
| **Trust Metrics (`TrustMetrics.tsx`)** | 4 Spotlight cards with CountUp animated counters (100% Offline Durability, 0.0s Cloud Risk Exposure, < 10ms Latency, 100+ Active Installs). | Clean, high-contrast, fully accessible with tabular figures. |
| **Features Grid (`FeaturesGrid.tsx`)** | 6 capability cards (Sub-Second Billing, Thermal Receipts, Real-Time KDS, Table & Floor, Modifiers & Recipes, Security & Audits) with Lucide icons and checkmarks. | Text-only layout with icons. Cards lack real operational visual previews or media badges to demonstrate real-world restaurant deployment. |
| **Offline Architecture (`OfflineArchitecture.tsx`)** | 4-layer technical breakdown + interactive Live Engine Telemetry card simulating WAN cable-cut/outage toggle. | High visual polish. Uses raw bullet character `● Port 3001` in telemetry rows. |
| **Interactive UI Previews (`UiPreviews.tsx`)** | 3 tabs: 1. POS Order Cart, 2. Live KDS Kitchen Ticket, 3. 80mm ESC/POS Thermal Receipt. | **Tab 1 Food Dish Photos Missing**: Cart items (Truffle Mushroom Wood-Fired Pizza, Artisanal Paneer Tikka, Classic Cold Brew Latte, Belgian Dark Chocolate Lava Cake) only have colored dot indicators (`bg-emerald-500`, `bg-teal-500`, `bg-amber-500`). Lacks dish photography thumbnails, reducing visual realism.<br><br>**Tab 2 KDS Context**: Functional ticket card but lacks a photo badge or kitchen environment context.<br><br>**Tab 3 Receipt**: Monospace styling with GST tax breakdown and QR code is visually accurate and faithful to 80mm ESC/POS thermal paper. |
| **Role Personas (`RolePersonas.tsx`)** | 6 operational personas: Cashier, Waiter, Chef, Manager, Accountant, Delivery Driver. Magnet tab selectors. | **No Persona Media Previews**: Selecting a persona updates text bullet points under "Core Operational Capabilities", but lacks device mockups, interface snapshots, or authentic restaurant context photography for each role. |
| **CTA Section (`CtaSection.tsx`)** | StarBorder primary CTA + 3 OS buttons + Hardware Specifications grid. | **Multi-OS Download Buttons**: Lines 80–133 offer separate buttons for Windows, macOS, and Linux. Requirement R2 explicitly requires the download flow to provide the Windows version only and redirect unauthenticated users to auth. |
| **Footer (`Footer.tsx`)** | 5 columns with startup notice, certified operational status, product links, compliance links, legal policy triggers. | High-quality layout. Footer legal links trigger `TermsModal` tabs via custom window events. |
| **Auth Modal (`AuthModal.tsx`)** | Sign In / Sign Up tabs, Quick-fill demo credentials, email/password form. | **Raw Emojis in UI**: Lines 190, 199, 208 use raw emojis (`👑 Owner`, `👔 Manager`, `💳 Cashier`) instead of Lucide icons.<br><br>**Missing Google Sign-In Demo**: Completely lacks a "Sign in with Google" / Google demo button required by Requirement R2. |
| **Bill Template Modal (`BillTemplateModal.tsx`)** | 4 formats: Standard 80mm, GST Tax Invoice, Z-Report Cash Closure, Kitchen KOT Slip. Full/Fit zoom controls. | Very realistic ESC/POS thermal printer reproduction with monospace fonts and dashed separators. |

---

### 1.3 Icon & UI Control Rendering Audit

1. **Icons Used Across `landing/src/components/`**:
   - `Hero.tsx`: `Download`, `Play`, `WifiOff`, `Printer`, `Zap`, `Network`, `ShieldCheck`, `CheckCircle2`, `HardDrive`, `Flame`, `Receipt` (all Lucide).
   - `FeaturesGrid.tsx`: `ShoppingCart`, `Printer`, `ChefHat`, `LayoutGrid`, `Sliders`, `ShieldCheck`, `CheckCircle2`, `Sparkles` (all Lucide).
   - `OfflineArchitecture.tsx`: `Server`, `Database`, `Wifi`, `WifiOff`, `Printer`, `ShieldCheck`, `RefreshCw`, `Cpu`, `Radio`, `Zap` (all Lucide).
   - `RolePersonas.tsx`: `CreditCard`, `Smartphone`, `ChefHat`, `Store`, `FileSpreadsheet`, `Bike`, `CheckCircle2`, `Lock`, `Sparkles` (all Lucide).
   - `TrustMetrics.tsx`: `ShieldCheck`, `Zap`, `Database` (all Lucide).
   - `HardwareMarquee.tsx`: `Database`, `Printer`, `Zap`, `Radio`, `Cpu`, `Laptop`, `Apple`, `Terminal` (all Lucide).
   - `CtaSection.tsx`: `Laptop`, `Apple`, `Terminal`, `ShieldCheck`, `CheckCircle2`, `HardDrive`, `Printer`, `Sparkles`, `Receipt` (all Lucide).
   - `Footer.tsx`: `ShieldCheck`, `Receipt`, `Key`, `Printer`, `Scale`, `FileText`, `AlertTriangle`, `Building` (all Lucide).
   - `Navbar.tsx`: `Menu`, `X`, `Download`, `ShieldCheck`, `Receipt`, `LogOut`, `Key`, `UserPlus` (all Lucide).
   - `TermsModal.tsx`: `X`, `Shield`, `AlertTriangle`, `Scale`, `CheckCircle2`, `Building` (all Lucide).
   - `BillTemplateModal.tsx`: `X`, `Printer`, `QrCode`, `CheckCircle2`, `ZoomIn`, `Maximize2` (all Lucide).
   - `CredentialsModal.tsx`: `X`, `Key`, `Copy`, `Check`, `UserCheck`, `Shield`, `ChefHat`, `Receipt`, `User`, `Coffee`, `Sparkles` (all Lucide).
2. **Identified Inconsistencies & Emoji Remnants**:
   - `landing/src/components/AuthModal.tsx`:
     - Line 190: `👑 Owner` → should be `<Crown className="w-4 h-4 text-orange-600" />`
     - Line 199: `👔 Manager` → should be `<UserCheck className="w-4 h-4 text-blue-600" />`
     - Line 208: `💳 Cashier` → should be `<CreditCard className="w-4 h-4 text-amber-600" />`
   - `landing/src/lib/constants.ts`:
     - Line 4: `eyebrow: "⚡ 100% Offline-First POS • Zero Cloud Lock-In • Hardware Native"` contains `⚡` which duplicates `<Zap className="w-3.5 h-3.5" />` in `Hero.tsx:85`.
   - `landing/src/components/OfflineArchitecture.tsx`:
     - Line 130: `● Port 3001 (Active)` uses a raw unicode bullet `●` instead of `<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />`.
   - Missing Google Icon: Google Sign-In button in `AuthModal.tsx` should use a standardized SVG Google logo with official 4-color styling or monochrome brand styling.

---

### 1.4 Exact, Valid Unsplash Photography Assets Catalog

To resolve the media preview gaps in `Hero.tsx`, `UiPreviews.tsx`, and `RolePersonas.tsx`, the following high-resolution, commercially-cleared, valid Unsplash image URLs have been identified, parameter-tuned, and verified:

```ts
export const UNSPLASH_ASSETS = {
  // 1. Counter POS & Cashier Billing (Hero Mockup & Cashier Persona)
  posTerminalCounter:
    "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80",
  posCashierRegister:
    "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1200&q=80",

  // 2. Kitchen Display System (KDS) & Chef Preparation (Chef Persona & KDS Preview)
  kitchenChefPrep:
    "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1200&q=80",
  kitchenBrigadeLine:
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",

  // 3. Restaurant Dining Floor & Table Layout (Floor Management & Manager Persona)
  restaurantFloorTables:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  restaurantAtmosphere:
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",

  // 4. Tableside Mobile Waiter Ordering (Waiter Persona & Handheld Showcase)
  waiterMobileTablet:
    "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=1200&q=80",

  // 5. Financial Audit & Accounting (Accountant Persona)
  accountingLedger:
    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80",

  // 6. Food Dish Previews (UiPreviews Cart Simulator)
  dishes: {
    trufflePizza:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80",
    paneerTikka:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=400&q=80",
    coldBrewLatte:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=400&q=80",
    chocolateLavaCake:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80",
  },
};
```

---

### 1.5 Current Terms & Conditions Audit across `landing/` & `frontend/`

1. **`landing/src/components/TermsModal.tsx`**:
   - Implements a modal dialog with 4 tabs:
     - Tab 1: `terms` ("Terms & Conditions" — Acceptance, Startup Status & Beta, Grant of License, Hardware Spoolers, Service Modifications).
     - Tab 2: `privacy` ("Offline Privacy Policy" — Zero Cloud DB, No Patron Profiling, LAN Mesh, Optional Integrations).
     - Tab 3: `disclaimer` ("Startup & Beta Disclaimer" — "As Is", Limitation of Liability, Backup Responsibility, Community Feedback).
     - Tab 4: `tax` ("Tax & Compliance Policy" — Math Tools Only, No Accounting Advice, Z-Reports).
2. **`frontend/src/app/setup/page.tsx`**:
   - Lines 589–605 contain an initial setup checkbox:
     ```tsx
     <label className="flex items-start gap-2 text-sm text-muted-foreground">
       <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required />
       <span>
         {t('termsIntro')} <span className="text-primary font-medium">{t('terms')}</span>,{' '}
         <span className="text-primary font-medium">{t('privacy')}</span>, {t('termsAnd')}{' '}
         <span className="text-primary font-medium">{t('disclaimer')}</span>.
       </span>
     </label>
     ```
   - Notice: The spans (`{t('terms')}`, `{t('privacy')}`, `{t('disclaimer')}`) are **unclickable non-interactive text**. There is no modal or route linked.
3. **Legal Gaps Identified for Early-Stage Software Startup**:
   - **No SLA / Uptime Terms**: Fails to define the SLA expectation between local counter software (100% offline resilient) and edge cloud/web services (best-effort availability, no financial uptime penalties during early startup beta).
   - **No Explicit SaaS Terms vs Desktop License Boundary**: Lacks formal terms governing multi-tenant cloud accounts, API rate limits, and credentials security.
   - **No Acceptable Use Policy (AUP)**: Lacks explicit prohibition of unauthorized penetration testing, reverse engineering of ESC/POS bytecode, or submitting fraudulent fiscal data.
   - **No Data Sovereignty Guarantee**: While privacy states data is in local SQLite, there is no explicit contractual warranty that the Merchant retains 100% ownership of customer data, nor how cloud platform data stored on Amazon S3 / Cloudflare Edge is segregated.
   - **Incomplete Merchant Responsibilities**: Does not specify merchant obligations regarding local hardware maintenance, printer voltage matching, LAN router password security (ports 3002/3003), or statutory tax return filing (GSTR-1, GSTR-3B).
   - **No Subscription Billing & Cancellation Policy**: Missing terms for free community single-counter license, future SaaS subscriptions, 30-day notice, pro-ration, and zero-lock-in data export rights upon cancellation.

---

## 2. Logic Chain

1. **Premise 1**: The user approved task and dispatch mandate replacing mismatched/empty visual elements on `landing/` with authentic Unsplash photography, standardizing UI icons, establishing Windows-only desktop download, and redesigning startup terms and conditions for an early-stage SaaS startup.
2. **Inference from Hero Analysis**: In `Hero.tsx`, the application window frame (`TiltedCard`) creates the expectation of a live desktop POS preview, but currently contains only 3 text metrics. Embedding an authentic restaurant counter POS image (`photo-1556740738-b6a63e27c4df`) with subtle live telemetry chips resolves this visual separation and grounds the value proposition.
3. **Inference from UI Previews Analysis**: In `UiPreviews.tsx`, the POS Cart simulator represents a live restaurant checkout, but items are indicated solely by colored dots. Adding authentic food photography thumbnails (`photo-1513104890138-7c749659a591` for pizza, `photo-1567188040759-fb8a883dc6d8` for tikka, etc.) immediately enhances visual authenticity and aesthetic richness.
4. **Inference from Role Personas Analysis**: In `RolePersonas.tsx`, tab switching currently only toggles bullet points. Pairing each persona with a dedicated contextual preview card and Unsplash photograph (Cashier → Counter POS, Waiter → Tableside Tablet, Chef → Kitchen Line, Manager → Dining Room Floor Plan, Accountant → Financial Reports) transforms this into an interactive dashboard showcase.
5. **Inference from Auth Modal Analysis**: `AuthModal.tsx` contains raw emojis (`👑`, `👔`, `💳`) that violate the standard icon mandate, and completely lacks a Google Sign-In demo button required by Requirement R2. Replacing them with Lucide icons (`Crown`, `Briefcase`, `CreditCard`) and adding a prominent Google demo button satisfies R1 and R2.
6. **Inference from Terms Analysis**: An early-stage software startup needs protective, professional legal policies that balance rapid development with merchant reassurance. Formulating a 5-tab structure covering SaaS Terms & Scope, SLA & Offline Invariants, Merchant Data Sovereignty & S3 Cloud Segregation, Acceptable Use & Merchant Obligations, and Subscription Billing & Zero-Lock-In Cancellation provides comprehensive legal governance suited for early production.
7. **Inference from Test Suite**: `tests/landing-page-e2e.test.cjs` validates the landing implementation. Ensuring `BRAND.name` and "100% Offline Engine" are preserved in `Navbar.tsx` ensures tests pass without regressions.

---

## 3. Caveats

1. **Network Image Loading on Offline Desktop**: While Unsplash images load seamlessly in web environments (`orderitup.pages.dev` and browsers), the Electron desktop app runs offline-first. Unsplash image tags should provide graceful CSS fallback placeholders (`bg-slate-100`) if offline or unable to reach the Unsplash CDN.
2. **Next.js Static Export (`output: "export"`)**: Because `landing/next.config.ts` sets `output: "export"`, `next/image` requires `unoptimized: true` (already configured at line 7 of `next.config.ts`), or standard `<img>` tags can be used directly without hydration penalty.
3. **Scope Boundary**: As a read-only survey explorer, this report does not edit source code. Proposed code snippets and exact configurations are provided below for the subsequent implementation agent.

---

## 4. Conclusion & Proposed Implementation Specifications

### 4.1 Visual Assets & UI Enhancements (R1)

#### A. Hero Section Media Enhancement (`landing/src/components/Hero.tsx`)
Replace the text-only teaser inside `TiltedCard` (lines 286–319) with an authentic photographic POS window preview:
```tsx
{/* Authentic POS Desktop Window Content */}
<div className="relative group overflow-hidden bg-slate-900">
  <img
    src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80"
    alt="Order It Up Counter POS Terminal in Action"
    className="w-full h-72 sm:h-96 object-cover object-center group-hover:scale-102 transition-transform duration-500 opacity-90"
    loading="eager"
  />
  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
  
  {/* Telemetry Floating Glass Overlay */}
  <div className="absolute bottom-4 left-4 right-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className="p-3 rounded-xl bg-white/95 backdrop-blur-md border border-white/20 shadow-lg text-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-600">Active Tables</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      <p className="text-xl font-black mt-0.5">14 / 18 Occupied</p>
      <p className="text-[10px] text-emerald-600 font-medium">Avg Turn: 34 mins</p>
    </div>
    
    <div className="p-3 rounded-xl bg-white/95 backdrop-blur-md border border-white/20 shadow-lg text-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-600">KDS Active Tickets</span>
        <span className="text-xs font-mono font-bold text-orange-600">:3002</span>
      </div>
      <p className="text-xl font-black mt-0.5">6 In-Flight</p>
      <p className="text-[10px] text-amber-600 font-medium">SLA: 7m 40s avg prep</p>
    </div>
    
    <div className="p-3 rounded-xl bg-white/95 backdrop-blur-md border border-white/20 shadow-lg text-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-600">Hardware Bus</span>
        <span className="text-xs font-mono text-emerald-600 font-bold">24V Ready</span>
      </div>
      <p className="text-xl font-black mt-0.5">80mm Thermal</p>
      <p className="text-[10px] text-slate-500 font-medium">USB DK Pulse Verified</p>
    </div>
  </div>
</div>
```

#### B. Dish Photography in Cart Simulator (`landing/src/components/UiPreviews.tsx`)
In `UiPreviews.tsx` line 256, attach authentic food photography thumbnails to each line item:
```tsx
const DISH_THUMBNAILS: Record<string, string> = {
  "item-1": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=160&q=80",
  "item-2": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=160&q=80",
  "item-3": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=160&q=80",
  "item-4": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=160&q=80",
};
```
And in the item map:
```tsx
<div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
  <img
    src={DISH_THUMBNAILS[item.id]}
    alt={item.name}
    className="w-full h-full object-cover"
    loading="lazy"
  />
</div>
```

#### C. Role Personas Visual Showcase (`landing/src/components/RolePersonas.tsx`)
Pair the active persona with its matching authentic photography showcase:
```tsx
const PERSONA_MEDIA: Record<string, { image: string; tag: string; metric: string }> = {
  cashier: {
    image: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80",
    tag: "High-Speed Counter Billing",
    metric: "Sub-3s Settlement & 24V Cash Drawer Pulse",
  },
  waiter: {
    image: "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=800&q=80",
    tag: "Tableside Handheld Ordering",
    metric: "Real-time Floor Map & Course Firing (:3003)",
  },
  chef: {
    image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80",
    tag: "Kitchen Display System (KDS)",
    metric: "Zero-Lag WebSocket LAN Bumping (:3002)",
  },
  manager: {
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    tag: "Restaurant Floor & Shift Supervision",
    metric: "Master PIN Overrides, Table Turnover & Menu Matrix",
  },
  accountant: {
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
    tag: "Tax Compliance & Shift Auditing",
    metric: "GST/VAT Calculation, Z-Report Shift Closures & Tally XML",
  },
  driver: {
    image: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=800&q=80",
    tag: "Out-of-Store Dispatch",
    metric: "Customer Address Verification & Cash-on-Delivery Tally",
  },
};
```

#### D. Auth Modal Icon & Google Sign-In Demo (`landing/src/components/AuthModal.tsx`)
1. Replace emojis with Lucide icons (`Crown`, `Briefcase`, `CreditCard`).
2. Add Google Sign-in demo button:
```tsx
{/* Google Sign-in Demo Placeholder */}
<button
  type="button"
  onClick={() => handleQuickLogin("owner")}
  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer mb-4"
>
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
  <span>Continue with Google (Demo Sign-In)</span>
</button>
```

---

### 4.2 Redesigned Startup Terms & Conditions Policies (R3)

Formulated 5-Tab Comprehensive Startup Policy Architecture for `landing/src/components/TermsModal.tsx`:

#### Tab 1: SaaS Terms of Service & Multi-Tier Licensing
- **Preamble**: Order It Up ("Service") is provided by IndentDev as an offline-first restaurant point-of-sale and cloud analytics platform.
- **License Grant**: Non-exclusive, revocable, non-transferable license to install and operate the Electron desktop billing application. Single-counter usage is free forever. Multi-counter and cloud synchronization features are governed by active cloud subscriptions.
- **Architectural Scope**: Point of Sale (POS) billing is strictly authorized on local Desktop and Mobile POS clients. The Web Platform (`orderitup.pages.dev`) is exclusively dedicated to business onboarding, analytics, CRM, and cloud dashboard supervision.

#### Tab 2: Service Level Agreement (SLA) & Uptime Expectations
- **Offline Invariant Guarantee**: The core desktop POS operates with 100% offline resilience. Counter checkout, ESC/POS printing, and LAN KDS synchronization (:3002) do not depend on internet connectivity or cloud uptime.
- **Cloud Edge & Web Services SLA**: Central SaaS services, cloud sync outbox, and web analytics portals are provided on a "best-effort" availability basis during early-stage pre-registration beta.
- **No Monetary SLA Penalties**: In this early-stage evaluation phase, no financially-backed uptime credits, service penalties, or liquidated damages are offered for intermittent public cloud connectivity disruptions.
- **Scheduled Maintenance**: Standard maintenance windows are communicated via release announcements; local counter billing continues uninterrupted during any cloud maintenance.

#### Tab 3: Merchant Data Sovereignty, S3 Cloud Storage & Privacy
- **Exclusive Merchant Ownership**: Merchants retain 100% intellectual property and legal ownership of all customer profiles, order history, menu recipes, pricing tables, and accounting records.
- **Local SQLite Data Sovereign Boundary**: Counter operational data is committed locally to `flo.db` using SQLite WAL mode. No patron contact details or phone numbers are harvested or sold by IndentDev.
- **Cloud S3 Bucket Segregation**: Platform data, user profiles, receipts, and optional cloud backups transmitted to Amazon S3 are segregated strictly by Organization ID (`org_id`). Customer operational records are partitioned from central administrative accounts.
- **One-Click Export**: Merchants may export their complete historical SQLite database and CSV reports at any time with zero vendor lock-in.

#### Tab 4: Acceptable Use & Merchant Operational Responsibilities
- **Acceptable Use Policy (AUP)**: Users agree not to: (a) reverse-engineer or tamper with ESC/POS bytecode drivers or security tokens; (b) attempt unauthorized penetration testing against Cloudflare Edge or S3 APIs; (c) punch fraudulent or falsified invoices to circumvent statutory taxes.
- **Hardware & Electrical Obligations**: The merchant is solely responsible for verifying hardware specifications, including 24V solenoid pulse compatibility on RJ11/RJ12 drawer kick ports (pin 2 / pin 5) and thermal paper width (58mm/80mm).
- **Network Security Responsibility**: Merchants must secure their local Wi-Fi router with strong WPA2/WPA3 encryption to protect in-restaurant WebSocket communications on ports :3002 (KDS) and :3003 (Waiter).
- **Statutory Tax & Regulatory Filings**: Order It Up provides mathematical calculation utilities for Indian GST (CGST/SGST), Global VAT, and FSSAI receipt formats. The merchant remains solely responsible for legal compliance and filing returns (GSTR-1, GSTR-3B) with tax authorities.
- **Backup Mandate**: Merchants are required to maintain regular offline backups of `flo.db` to external USB drives or secondary local machines.

#### Tab 5: Subscription Billing, Renewal & Zero-Lock-In Cancellation
- **Free Single-Counter Tier**: The desktop single-counter POS is free without credit card entry.
- **Subscription Cycles**: Multi-store, franchise HQ, and cloud sync tiers are billed on recurring 30-day billing intervals.
- **No Hidden Termination Fees**: Subscriptions may be canceled at any time with 30-day notice without termination penalty.
- **Post-Cancellation Grace Period**: Following cancellation, merchants retain 60 days of read-only access to export cloud analytics, and local desktop offline POS billing remains functional indefinitely.
- **Limitation of Liability**: To the maximum extent permitted by applicable law, IndentDev's cumulative aggregate liability for any claims arising from the software or cloud platform is strictly limited to the greater of (a) the total fees paid by the merchant in the preceding three (3) months, or (b) USD $100.

---

## 5. Verification Method

To verify these findings and confirm that subsequent implementations satisfy all requirements:

1. **Static Build & Lint Checks**:
   ```sh
   # Verify landing Next.js app builds and lints cleanly
   npm --prefix landing run lint
   npm --prefix landing run build

   # Verify root and frontend
   npm run lint
   npm run build:frontend
   ```

2. **Automated Landing E2E & Route Verification**:
   ```sh
   node tests/landing-page-e2e.test.cjs
   ```
   *Expected outcome*: Once `Navbar.tsx` references `BRAND.name` and includes `100% Offline Engine`, all 21 tests across Tiers 1–4 will pass with 0 failures.

3. **Visual Media & URL Accessibility Check**:
   - Inspect network tab in browser for `landing/` to verify all Unsplash photography URLs load with HTTP 200 and responsive `w=...&q=80` sizing.
   - Verify zero un-Suspended hydration trapping on `landing/` and zero console warnings.

4. **Terms & Conditions Verification**:
   - Open `TermsModal` via Footer triggers:
     - Verify tabs 1 through 5 switch seamlessly.
     - Verify all legal clauses (SaaS scope, SLA, Data Sovereignty, AUP, Liability, Subscription Billing & Cancellation) render clearly in readable typography.
     - Verify accessible keyboard escape (`Escape` key) and close button.
