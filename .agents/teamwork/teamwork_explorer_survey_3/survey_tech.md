# Technical Setup & Architecture Report: Independent Landing Page (`landing/`)

**Author:** teamwork_explorer_survey_3 (Explorer / Technical Surveyor)  
**Date:** 2026-10-30  
**Target Path:** `d:\narayana\order-it-up\landing`  
**Status:** Approved Technical Blueprint  

---

## 1. Executive Summary & Mission Scope

This report specifies the comprehensive technical architecture, directory layout, dependency manifest, build tooling, and design system setup for the new marketing landing page for **Order It Up**, located in `landing/`.

The primary objective is to deliver a modern, high-converting, responsive marketing landing page that:
1. **Mirrors the brand identity, styling, and visual aesthetic** of the Order It Up desktop POS application (saffron orange `#F07928`, dark slate surfaces, Geist typography, clean border radii).
2. **Maintains 100% architectural isolation** from the desktop POS renderer in `frontend/` (independent `package.json`, isolated dependencies, zero cross-directory imports).
3. **Builds and lints cleanly with zero errors** across Windows OS and Node.js 22+ environments using Next.js 16, React 19, and Tailwind CSS v4.
4. **Leverages Next.js Static Export (`output: 'export'`)** to maximize delivery speed, eliminate backend runtime vulnerabilities, provide offline previewability, and simplify global CDN hosting.

---

## 2. Environment Constraints & Compatibility Audit

### 2.1 Operating System & Shell (Windows 11 / PowerShell)
- **Runtime Environment:** Windows OS with PowerShell / Windows Terminal.
- **Shell Compatibility:** PowerShell handles script chaining differently than Unix bash (`&&` is reserved or disallowed in standard Windows PowerShell 5.1). All npm scripts within `landing/package.json` are authored to run cross-platform commands without shell-specific chained tokens.
- **Path Resolution:** Windows file paths use backslashes (`\`), but TypeScript path aliases, Next.js bundlers, and CSS imports must use canonical forward slashes (`/`).
- **File System Case-Insensitivity:** Windows NTFS is case-insensitive, but CI environments (Linux/macOS) are case-sensitive. All import paths must strictly preserve exact casing.

### 2.2 Node.js & Package Management
- **Node.js Version:** `v22.13.1` (satisfies root engine constraint `>=22.12.0`).
- **Package Manager:** `npm 10.9.2`.
- **Workspace Architecture:** The root repository does not utilize npm multi-package workspaces; instead, subsystems are invoked via standard prefix flags (e.g., `npm --prefix frontend run lint`).
- **Isolation Guarantee:** `landing/` will have its own dedicated `package.json` and its own local `landing/node_modules/`. It will never import from `../frontend` or `../node_modules`.

### 2.3 Subsystem Boundary Audit
| Boundary | Rule / Invariant | Verification Check |
| :--- | :--- | :--- |
| **Code Imports** | `landing/` MUST NOT import any file from `frontend/`, `main/`, or `shared/`. | Verified by ESLint import boundary rules and self-contained `tsconfig.json`. |
| **Asset Isolation** | All brand assets (logos, icons, illustrations, mockups) must be stored in `landing/public/`. | No relative asset path references outside `landing/`. |
| **Root Tooling Isolation** | Root `eslint.config.mjs` targets only `main/**/*.ts` and `shared/**/*.ts`. Root `tsconfig.json` targets only `main/` and `shared/`. | Neither root tool scans or interferes with `landing/`. |
| **Lockfile Isolation** | `landing/` contains its own `package-lock.json` committed inside `landing/` (or managed independently). | Root `package.json` remains pristine and untouched during landing operations. |

---

## 3. Next.js Architecture: Static Export vs. Standalone Node App

### 3.1 Comparison Matrix

| Evaluation Dimension | Static Export (`output: 'export'`) | Standalone Node App (`output: 'standalone'`) |
| :--- | :--- | :--- |
| **Architecture** | Pre-renders all routes to static HTML/CSS/JS files in `landing/out/` during `npm run build`. | Packages a minimal Node.js HTTP server running an Express/Next listener. |
| **Server Maintenance** | Zero. No server process, no memory leaks, no crash recovery needed. | Requires a managed Node process, PM2 or container, port monitoring. |
| **Port Conflicts** | None. Static assets are served over any HTTP port or file server. | Risk of port collisions with POS services (`:3001` Express, `:3002` KDS, `:3003` Server App). |
| **Security Surface** | Extremely low. Static files have zero attack surface for remote code execution or SSR denial-of-service. | Vulnerable to HTTP header injections, SSR ReDoS, and Node runtime vulnerabilities. |
| **Hosting Options** | Universal: Cloudflare Pages, GitHub Pages, Vercel, Netlify, AWS S3/CloudFront, local static servers. | Requires Node-capable compute (VPS, Docker, Cloud Run, AWS ECS). |
| **Offline Distribution** | Can be packaged directly into desktop offline installers or documentation bundles. | Requires running an internal Node instance to view. |
| **SEO & Performance** | Instant TTFB (Time-To-First-Byte), pre-rendered metadata, optimal Lighthouse scores. | Good, but dependent on server compute and warm-up latency. |
| **Next.js Features** | Fully supports App Router, Client Components, Server Components at build time. | Supports dynamic server headers, cookies, and on-demand SSR. |

### 3.2 Architectural Decision
**Selected Mode:** **Static Export (`output: 'export'`)**.
For a public-facing product marketing landing page, Static Export is strictly superior. It offers maximum speed, zero server maintenance costs, absolute security, and deterministic static verification (`npm run build` outputs a standalone `out/` directory).

### 3.3 Static Export Requirements in `next.config.ts`:
1. `output: 'export'`
2. `trailingSlash: true` (ensures `/download/index.html` structure for compatible static CDN routing)
3. `images: { unoptimized: true }` (built-in Next.js on-demand image optimization requires a running Node.js server; static export serves optimized WebP/PNG assets directly from `public/`)

---

## 4. Visual Design System Alignment (Desktop POS Aesthetic)

To maintain cohesive brand equity across the ecosystem, `landing/` mirrors the visual identity of the Order It Up desktop POS application.

### 4.1 Color Palette & Design Tokens
```css
/* Order It Up Brand Palette */
--color-brand: #F07928;          /* Primary Saffron Orange */
--color-brand-hover: #D96A1A;    /* Darker Saffron for interactive hover states */
--color-brand-light: #FFF3E8;    /* Soft warm cream tint for badge backgrounds */
--color-brand-ring: rgba(240, 121, 40, 0.25); /* Focus rings and ambient glows */

/* Surface & Neutral Tones */
--color-surface-dark: #09090B;   /* Zinc 950 deep obsidian backdrop */
--color-surface-elevated: #18181B; /* Zinc 900 card surface */
--color-surface-border: #27272A; /* Zinc 800 subtle borders */
--color-text-main: #FAFAFA;      /* Zinc 50 primary text */
--color-text-muted: #A1A1AA;     /* Zinc 400 secondary body text */

/* Operational Accent Colors */
--color-success: #00CC61;        /* Offline-Ready & Active LAN status */
--color-success-light: #DCFCE7;  /* Soft green pill background */
--color-info: #3248FF;           /* Cloud sync / KDS indicator */
```

### 4.2 Typography & Elevation
- **Primary Typography:** Geist Sans (`--font-geist-sans`) with fallback to modern system sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Code & Tech Specs Typography:** Geist Mono (`--font-geist-mono`) for architecture endpoints, port indicators, and code snippets.
- **Card Styling:** Rounded corners (`rounded-2xl` / `16px`), 1px subtle borders (`border-white/10` or `border-zinc-800`), backdrop-blur overlays, and soft orange glow shadows (`shadow-[0_0_50px_-12px_rgba(240,121,40,0.15)]`).

---

## 5. Recommended Directory Layout for `landing/`

```text
landing/
├── public/                               # Static assets served at root
│   ├── favicon.ico                       # Brand favicon
│   ├── logo.svg                          # Order It Up vector brandmark
│   ├── logo.png                          # High-resolution brandmark
│   ├── mockups/                          # High-fidelity UI showcase graphics
│   │   ├── pos-checkout.png              # Counter billing & cart preview
│   │   ├── kds-display.png               # Real-time kitchen display view
│   │   ├── floor-map.png                 # Interactive table management
│   │   └── reports-insights.png          # Sales, GST & analytics dashboard
│   └── icons/                            # Platform & hardware badges
│       ├── windows.svg
│       ├── apple.svg
│       ├── linux.svg
│       └── thermal-printer.svg
├── src/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css                   # Tailwind v4 imports, brand tokens, keyframes
│   │   ├── layout.tsx                    # Root HTML layout, font injection, SEO metadata
│   │   └── page.tsx                      # Main single-page marketing landing page
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx                # Sticky blurred header, desktop links, mobile drawer
│   │   │   └── Footer.tsx                # Comprehensive footer with copyright & links
│   │   ├── sections/
│   │   │   ├── HeroSection.tsx           # Headline, primary CTAs, perspective POS mockup
│   │   │   ├── TrustRibbon.tsx           # Key metrics: 100% offline, <5ms latency, $0 lock-in
│   │   │   ├── FeaturesGrid.tsx          # 6 core POS pillars (Billing, Tables, KDS, Print, Staff, Inventory)
│   │   │   ├── ArchitectureSection.tsx   # Offline-first SQLite + LAN KDS interactive diagram
│   │   │   ├── UIPreviewShowcase.tsx     # Tabbed interactive preview (POS, KDS, Floor, Reports)
│   │   │   ├── ComparisonMatrix.tsx      # Cloud POS vs. Order It Up comparison
│   │   │   ├── HardwareSpecs.tsx         # ESC/POS thermal printers, scanners, OS requirements
│   │   │   └── CtaSection.tsx            # High-conversion download/demo callout
│   │   └── ui/
│   │       ├── Button.tsx                # Styled buttons (primary saffron, secondary dark, outline)
│   │       ├── Badge.tsx                 # Status pills (Offline-First, Zero Latency, Free Download)
│   │       └── Card.tsx                  # Elevated card with border glow and backdrop blur
│   ├── lib/
│   │   ├── constants.ts                  # Brand copy, navigation links, download URLs
│   │   └── utils.ts                      # Class merging utility (clsx + tailwind-merge)
│   └── types/
│       └── index.ts                      # TypeScript interfaces for features, tabs, specs
├── .gitignore                            # Local gitignore (node_modules, .next, out)
├── eslint.config.mjs                     # ESLint 9 Flat Config
├── next.config.ts                        # Next.js configuration (static export, unoptimized images)
├── package.json                          # Isolated package manifest and scripts
├── postcss.config.mjs                    # PostCSS plugin config for @tailwindcss/postcss
└── tsconfig.json                         # Strict TypeScript configuration
```

---

## 6. Exact Configuration Specifications

### 6.1 `landing/package.json`
```json
{
  "name": "order-it-up-landing",
  "version": "1.0.0",
  "private": true,
  "description": "Marketing landing page for Order It Up - Offline-First Restaurant POS & Billing",
  "scripts": {
    "dev": "next dev -p 3004",
    "build": "next build",
    "start": "next start -p 3004",
    "export": "next build",
    "lint": "eslint ."
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^1.40.0",
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "tailwind-merge": "^3.6.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^26",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9.39.5",
    "eslint-config-next": "16.3.4",
    "postcss": "8.5.28",
    "tailwindcss": "^4",
    "typescript": "5.9.3"
  }
}
```

*Note on dev port:* Setting `-p 3004` avoids collisions with the POS Express API (`:3001`), Standalone KDS (`:3002`), and Server App (`:3003`).

### 6.2 `landing/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "out"
  ]
}
```

### 6.3 `landing/next.config.ts`
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export outputs pure HTML/CSS/JS to landing/out/
  output: "export",

  // Generates /path/index.html instead of /path.html for universal static hosting
  trailingSlash: true,

  // Built-in image optimization server is disabled for static export
  images: {
    unoptimized: true,
  },

  // Ensure Turbopack roots directly inside landing
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
```

### 6.4 `landing/postcss.config.mjs`
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

### 6.5 `landing/eslint.config.mjs`
```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

### 6.6 `landing/src/app/globals.css`
```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-brand: #F07928;
  --color-brand-hover: #D96A1A;
  --color-brand-light: #FFF3E8;
  --color-brand-dark: #B8530B;
  --color-brand-ring: rgba(240, 121, 40, 0.25);
  --color-surface-dark: #09090B;
  --color-surface-elevated: #18181B;
  --color-surface-card: #121215;
  --color-surface-border: #27272A;
  --color-success: #00CC61;
}

:root {
  --font-sans: "Geist", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Geist Mono", monospace;
}

body {
  font-family: var(--font-sans);
  background-color: #09090B;
  color: #FAFAFA;
  overflow-x: hidden;
  selection-background-color: #F07928;
  selection-color: #FFFFFF;
}

/* Custom smooth scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #09090B;
}
::-webkit-scrollbar-thumb {
  background: #27272A;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #F07928;
}
```

---

## 7. Responsive Viewport Architecture & Layout Strategy

The landing page implements an adaptive, responsive viewport layout using Tailwind's standard mobile-first breakpoints:

```
Mobile (<640px) ──► Tablet (640px–1024px) ──► Desktop (1024px–1280px) ──► Wide Desktop (1280px+)
```

### 7.1 Breakpoint Breakdown
1. **Mobile Viewport (`< 640px` / default):**
   - **Navigation:** Compact sticky bar (height `56px`) with brand logo, quick download CTA, and animated hamburger menu triggering a full-screen or slide-over navigation overlay.
   - **Hero Section:** Single-column stacked layout. Headline centered (`text-3xl font-extrabold`), concise 2-sentence value proposition, vertical full-width CTA buttons with minimum touch target size of `48px` (`min-h-[48px]`).
   - **Feature Showcase:** Single-column vertical stack with clear icon badges, high-contrast typography, and expandable cards.
   - **UI Previews:** Horizontally swipeable tabs with high-resolution zoomed preview snippets.
   - **Architecture Diagram:** Vertical flowchart showing POS terminal flowing downward to SQLite, Kitchen screens, and Thermal Printer.

2. **Tablet Viewport (`640px - 1024px` / `sm` & `md`):**
   - **Navigation:** Expanded header with visible primary links and "Get Started" CTA.
   - **Hero Section:** Centered headline (`text-5xl`), dual inline CTAs ("Download Desktop POS" + "View Live Demo").
   - **Feature Grid:** 2-column balanced grid (`grid-cols-2 gap-6`).
   - **Metrics Ribbon:** 2x2 grid layout highlighting key performance benchmarks.

3. **Desktop Viewport (`1024px - 1280px` / `lg`):**
   - **Navigation:** Full desktop navbar with sticky glassmorphism (`backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/80`), section anchor links, and platform download dropdown.
   - **Hero Section:** Split-screen layout (`grid-cols-12`): 7 columns for headline, feature highlights, and download buttons; 5 columns for an angled 3D software window mockup with ambient orange back-glow.
   - **Feature Grid:** 3-column asymmetric layout showcasing deep capabilities.
   - **Architecture Section:** Full horizontal topology map connecting Terminal, Local Network, SQLite, Waiter Tablets, KDS, and ESC/POS printer.
   - **Interactive UI Preview:** Tabbed selector (POS Counter, KDS Screen, Floor Layout, Reports) displaying realistic interactive software mockups.

4. **Wide Desktop Viewport (`1280px+` / `xl` & `2xl`):**
   - Container constrained to `max-w-7xl mx-auto px-6 lg:px-8` to prevent excessive visual dispersion.
   - Enhanced ambient light gradients (`bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-zinc-950/0 to-zinc-950`).

---

## 8. Content Sections & Messaging Blueprint

### 8.1 Section Inventory
| Section Component | Primary Heading | Core Value Proposition & Content |
| :--- | :--- | :--- |
| **`Navbar`** | Order It Up | Sticky navigation: Features, Architecture, Showcase, Comparison, Download button. |
| **`HeroSection`** | *The Offline-First Restaurant POS That Never Stops* | "Lightning-fast billing, tableside ordering, and real-time kitchen displays designed for modern restaurants, cafes, and bars. Zero cloud lag, 100% offline reliability." Dual CTAs: "Download Free for Desktop" + "Explore Live Preview". |
| **`TrustRibbon`** | Performance Invariants | 4 key badges: **100% Offline Resilience** (Local SQLite), **< 5ms Checkout Latency**, **Zero Monthly Subscriptions**, **Direct ESC/POS Thermal Printing**. |
| **`FeaturesGrid`** | *Built for High-Speed Food & Beverage Operations* | 6 core feature cards: Counter POS & Express Billing, Visual Floor & Table Management, Real-time LAN Kitchen Display (KDS), ESC/POS Thermal Printing & Cash Drawer Pulse, Staff Security & Multi-PIN Access, Inventory & Tax Packs (GST/VAT). |
| **`ArchitectureSection`** | *Engineered for Local Reliability* | Diagrammatic visual breakdown: Counter PC (Electron + SQLite + Express), Kitchen Tablets via LAN (`:3002/kds`), Handheld Waiter ordering (`:3003`), USB/LAN thermal printers, optional Cloud sync. |
| **`UIPreviewShowcase`** | *Experience the Interface* | Interactive tabbed showcase toggling between: **1. High-Speed Counter POS**, **2. Real-Time Kitchen Display (KDS)**, **3. Visual Table Floor Plan**, and **4. Daily Z-Reports & Insights**. |
| **`ComparisonMatrix`** | *Why Modern Restaurateurs Choose Order It Up* | Side-by-side comparison table: Order It Up vs. Cloud-Only POS systems (Internet outage tolerance, recurring fees, hardware vendor lock-in, data privacy). |
| **`HardwareSpecs`** | *Runs on the Hardware You Already Own* | OS compatibility (Windows 10/11, macOS Apple Silicon/Intel, Linux), Printer protocols (ESC/POS 58mm/80mm USB, TCP/IP, Bluetooth), Peripherals (scanners, cash drawers). |
| **`CtaSection`** | *Upgrade Your Counter Today* | High-impact callout with multi-platform download buttons, GitHub repository link, and quick setup instructions. |
| **`Footer`** | Order It Up 🍽️ | Platform links, legal/MIT license, documentation links, copyright notice. |

---

## 9. Verification & Quality Assurance Protocol

Following implementation, the landing page must pass the following verification tests:

### 9.1 Clean Installation
```bash
cd d:\narayana\order-it-up\landing
npm install
```
*Criteria:* Dependencies install cleanly without peer dependency conflicts or postinstall script failures.

### 9.2 Clean Compilation & Static Export
```bash
cd d:\narayana\order-it-up\landing
npm run build
```
*Criteria:* Build finishes with exit code `0`. Next.js reports static export complete. `landing/out/index.html` and `landing/out/_next/` are generated cleanly with zero compilation errors.

### 9.3 Clean Linting
```bash
cd d:\narayana\order-it-up\landing
npm run lint
```
*Criteria:* ESLint completes with exit code `0` and 0 errors, 0 warnings.

### 9.4 Isolation Verification
- Verify that `landing/package.json` contains no dependencies pointing to `file:../frontend`.
- Verify that no source file in `landing/src/` imports from `../../frontend/` or `../../main/`.
- Verify that running `npm run build` in root (`order-it-up`) remains unaffected.

---

## 10. Summary & Handoff Recommendation

The technical setup for `landing/` is thoroughly planned, adheres strictly to project boundaries, leverages the proven Next.js 16 + React 19 + Tailwind v4 stack, and guarantees complete isolation from the existing desktop POS frontend. The implementation agent can follow this blueprint to scaffold and build the landing page with zero friction.
