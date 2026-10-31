# Comprehensive Frontend & React Bits Survey Report

**Report Date:** 2026-10-30  
**Investigator:** Explorer 1 (Landing Page & React Bits Explorer)  
**Target:** Requirement R1 (Landing Page UI Enhancement - React Bits Inspired) & General Frontend Structure  
**Reference Specification:** `ORIGINAL_REQUEST.md`, `users.md`, `AGENTS.md`

---

## 1. Executive Summary & Scope

The objective of this investigation is to provide a complete, deep-dive technical survey of the Order It Up frontend landing page architecture, assess the existing component structure and styling stack, and formulate a concrete, lightweight, dependency-free implementation strategy for React Bits inspired UI animations and aesthetics.

### Key Findings at a Glance:
1. **Next.js & React Setup:** The application runs on **Next.js 16.3.4 (App Router)** and **React 19.2.8** with **Tailwind CSS v4** (`@tailwindcss/postcss: ^4`, `tailwindcss: ^4`). Tailwind v4 uses a CSS-first configuration model (`@theme inline` in `frontend/src/app/globals.css`), with no `tailwind.config.js`.
2. **Current Landing Page Structure:** The landing page (`frontend/src/app/page.tsx`) renders 8 sequential modular components from `frontend/src/components/landing/`: `Navbar`, `Hero`, `TrustMetrics`, `FeaturesGrid`, `OfflineArchitecture`, `UiPreviews`, `RolePersonas`, `CtaSection`, and `Footer`.
3. **Current Animation & Visual State:** The landing page currently uses standard Tailwind utility classes, static metric strings, standard borders, and basic active scale states. There are no smooth animated number counters, no ambient dot grid/spotlight, and no shimmer badges or glassmorphic hover lighting.
4. **Auth & Role Synergy:** The current Navbar only features an "Owner Login" link and a "Download POS" CTA button. There is no Signup/Register (`/auth/register`) button in the Navbar, Hero, or CTA sections. Furthermore, `RolePersonas.tsx` currently displays static bullet points rather than an interactive role dashboard preview showcasing Owner, Cashier, Waiter, Chef, and Accountant experiences.
5. **Zero External Dependency Viability:** All requested React Bits animations (interactive dot grid, mouse-tracking spotlight, shimmer badges, smooth RAF-based number counters, and glassmorphic card hover glow) can be implemented completely natively using pure React 19 hooks (`useRef`, `useState`, `useEffect`) and Tailwind v4 CSS keyframes. Zero external animation packages (`framer-motion`, `three`, etc.) are needed, preserving strict bundle efficiency and static export compatibility.

---

## 2. Component-by-Component Analysis of Landing Page

### 2.1 Overview of Landing Components

| File Path | Primary Function & Content | Current Limitations & Gaps | Proposed React Bits Enhancement |
| :--- | :--- | :--- | :--- |
| `frontend/src/app/page.tsx` | Main page wrapper. Handles Electron auto-redirect to `/dashboard`. Assembles all 8 landing sections. | Plain background `bg-[#F8FAFC]` with simple vertical flow. | Inject ambient background wrapper (interactive dot pattern + spotlight + floating subtle gradient mesh). |
| `Navbar.tsx` | Sticky top navigation header (`sticky top-0 z-50`). Shows logo, nav anchors, engine status pill, "Owner Login", "Download POS". | Missing `/auth/register` (Signup) button. Status pill is static with standard ping animation. | Add prominent "Sign Up" / "Create Free Store" tactile button + "Login" button. Add shimmer to status badge and tactile transitions to buttons. |
| `Hero.tsx` | Headline, subheading, download + demo CTAs, 4 trust badges, desktop app window mockup preview with 3 metric tiles. | Static radial orange gradient (`blur-[140px]`). CTAs lack direct `/auth/register` link. Cards are static white borders. | Add dynamic interactive mouse-following spotlight, shiny shimmer badge for eyebrow pill, tactile button hover/press effects, glassmorphic elevated mockup container. |
| `TrustMetrics.tsx` | High-contrast trust ribbon displaying 4 metrics (`100%`, `0.0s`, `< 10ms`, `100+`). | Metrics are hardcoded static strings. No animation on scroll or view. | Replace with lightweight `AnimatedCounter` component powered by `IntersectionObserver` + `requestAnimationFrame`. |
| `FeaturesGrid.tsx` | 6-card grid for core POS capabilities (Billing, Thermal Printing, KDS, Floor Tables, Modifiers, Multi-Role Security). | Cards have simple `hover:-translate-y-1 hover:border-orange-300`. No glassmorphism, inner specular highlight, or border glow. | Upgrade cards with glassmorphic `backdrop-blur-md`, subtle inner specular light `shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]`, and glow border hover state. |
| `OfflineArchitecture.tsx` | 4-layer architectural topology stack + interactive live simulated telemetry card with ISP outage toggle button. | Layer cards are standard white borders. Telemetry card lacks modern ambient glass aesthetic. | Apply glassmorphism to layer cards; add shiny active badge and smooth transition on telemetry toggle. |
| `UiPreviews.tsx` | Tabbed interactive simulation: 1. POS Order Cart (item qty, subtotal, tax math, settle), 2. Live KDS Kitchen Ticket (bump stages), 3. Monospace 80mm ESC/POS Thermal Receipt. | Functional, but container styling is conventional box-shadow with plain gray borders. | Add sleek tab selector with tactile slide indicator, glassmorphic card framing, and refined print animation. |
| `RolePersonas.tsx` | Multi-role operations section with role pills (Cashier, Waiter, Chef, Manager, Accountant, Driver) and capability cards. | Displays only static text bullet points. Prospective users cannot experience or preview role dashboards. | Transform into an **Interactive Role Dashboard Showcase** (R3 synergy) with live preview cards, direct test routes/links, and role-scoped action pills. |
| `CtaSection.tsx` | Download banner for Windows/Mac/Linux + hardware compatibility specifications grid (Printers, Drawers, Scanners, Scales, OS). | Lacks direct links to Web SaaS signup (`/auth/register`) or login (`/auth/login`). Download cards are standard. | Add dual Web SaaS ("Start Free Cloud Trial") & Desktop Download actions. Upgrade hardware cards with glassmorphic hover glow. |
| `Footer.tsx` | 5-column footer with brand info, product links, compliance details, architecture notes, and copyright bar. | Clean and functional; minor tactile improvements on link hovers. | Ensure all links are verified and accessible; polish badge styling. |

---

## 3. Frontend Infrastructure, Styling & Configuration Survey

### 3.1 Dependencies (`frontend/package.json`)
- **Next.js:** `16.3.4` (App Router)
- **React & React-DOM:** `19.2.8`
- **Tailwind CSS:** `^4.0.0`
- **PostCSS:** `8.5.28` with `@tailwindcss/postcss: ^4`
- **Animation Helpers:** `tw-animate-css: ^1.4.0` (Tailwind v4 compatible drop-in replacement for `tailwindcss-animate`)
- **Icons:** `lucide-react: ^1.40.0`
- **Class Utilities:** `clsx: ^2.1.1`, `tailwind-merge: ^3.6.0`, `class-variance-authority: ^0.7.1`
- **UI Components:** `radix-ui: ^1.6.7` (Slot, primitives)

### 3.2 Tailwind CSS v4 Configuration Architecture
Unlike Tailwind v3, Tailwind v4 does not use `tailwind.config.js`. Instead, all configuration is centralized in `frontend/src/app/globals.css`:
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  /* ... */
  --color-brand: #F07928;
  --color-brand-light: #FFF3E8;
  --color-brand-hover: #D96A1A;
  --color-brand-ring: #F0792840;
  /* ... */
}
```

### 3.3 Static Export Compatibility (`next.config.ts`)
Static export is controlled via environment variables:
```ts
const isExport = process.env.NEXT_BUILD_MODE === "desktop" || process.env.NEXT_BUILD_MODE === "web" || process.env.NEXT_BUILD_MODE === "export";

const nextConfig: NextConfig = {
  output: isExport ? "export" : undefined,
  trailingSlash: isExport,
  images: {
    unoptimized: isExport,
  },
  // ...
};
```
- For Cloudflare Pages deployment (`NEXT_BUILD_MODE=web`), Next.js exports static HTML files (`trailingSlash: true`).
- All interactive landing page components must operate purely client-side without Next.js server components or server actions, ensuring 100% static hosting compatibility.

---

## 4. React Bits Technical Architecture & Design Patterns (Pure React 19 + Tailwind v4)

To satisfy Requirement R1 without introducing third-party animation libraries, the following lightweight, native implementations have been formulated and verified.

### 4.1 Ambient Background & Interactive Spotlight

#### Concept:
A dual-layer ambient background featuring:
1. **Geometric Dot Matrix Pattern:** A subtle SVG or CSS radial-gradient dot pattern (`1px` dot every `24px` grid) with an elliptical radial-gradient mask that fades naturally toward the viewport edges.
2. **Interactive Cursor Spotlight:** An ambient glow circle that follows the user's cursor across the hero and page header, illuminating elements as the mouse hovers.
3. **Floating Ambient Gradient Mesh Orbs:** Two slow-pulsing background mesh orbs (Saffron `#F07928` and Amber `#F59E0B`) with heavy blur (`blur-[120px]`) and gentle floating keyframe motion.

#### High-Performance Implementation Strategy (0 React Re-renders on MouseMove):
Using `useState` on `mousemove` triggers 60–120 React re-renders per second, causing layout recalculations and stutter. Instead, we use a DOM `ref` and direct CSS variable injection with `requestAnimationFrame`:

```tsx
'use client';

import React, { useRef, useEffect } from 'react';

export default function AmbientBackground({ children }: { children?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        container.style.setProperty('--spotlight-x', `${x}px`);
        container.style.setProperty('--spotlight-y', `${y}px`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        '--spotlight-x': '50%',
        '--spotlight-y': '20%',
      } as React.CSSProperties}
    >
      {/* 1. Subtle Dot Matrix Grid with Radial Fade Mask */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)] opacity-60"
        aria-hidden="true"
      />

      {/* 2. Interactive Spotlight Glow following cursor */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(650px circle at var(--spotlight-x) var(--spotlight-y), rgba(240, 121, 40, 0.08), transparent 45%)`,
        }}
        aria-hidden="true"
      />

      {/* 3. Floating Gradient Mesh Orbs */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-orange-400/15 to-amber-300/10 blur-[130px] rounded-full animate-float-slow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-20 w-[450px] h-[450px] bg-gradient-to-bl from-amber-400/10 to-orange-500/10 blur-[140px] rounded-full animate-float-reverse"
        aria-hidden="true"
      />

      {/* Main Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
```

---

### 4.2 Shiny / Shimmer Badges & Tactile Button Feedback

#### Shimmer Badge:
A shiny badge features an animated diagonal light beam traveling across its surface, accompanied by a subtle specular border and glow:
1. **Shimmer Keyframes in `globals.css`:**
   ```css
   @keyframes shimmer {
     0% { transform: translateX(-150%); }
     100% { transform: translateX(150%); }
   }
   .animate-shimmer {
     animation: shimmer 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
   }
   ```
2. **Component Markup:**
   ```tsx
   <div className="relative overflow-hidden inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50/90 border border-orange-200/90 text-xs sm:text-sm font-semibold text-orange-700 shadow-xs hover:shadow-[0_0_15px_rgba(240,121,40,0.25)] hover:border-orange-300 transition-all duration-300">
     {/* Diagonal Shimmer Beam */}
     <div
       className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent w-full h-full"
       aria-hidden="true"
     />
     <Zap className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />
     <span className="relative z-10">{BRAND.eyebrow}</span>
   </div>
   ```

#### Tactile Buttons:
Tactile buttons provide crisp, physical tactile response with:
- Hover elevate: `hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/25`
- Active press depth: `active:translate-y-0.5 active:scale-[0.98]`
- Outer glow & focus ring: `focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2`
- Multi-tier drop shadows: `shadow-[0_4px_14px_0_rgba(240,121,40,0.39)]`

---

### 4.3 Smooth Animated Number Counters for Trust Metrics

#### Problem with Current Implementation:
`TrustMetrics.tsx` displays static values (`"100%"`, `"0.0s"`, `"< 10ms"`, `"100+"`) with no incrementing transition.

#### Solution: `AnimatedCounter.tsx`
- Utilizes `IntersectionObserver` with a `0.2` threshold to initiate counting only when scrolled into the viewport.
- Uses `requestAnimationFrame` with a smooth ease-out cubic curve: $E(t) = 1 - (1 - t)^3$.
- Includes tabular numerals (`tabular-nums`) to prevent text jitter and layout shifts.
- Respects `prefers-reduced-motion`: If reduced motion is requested, instantly displays the final target value.
- SSR Hydration safe: Renders initial numeric text matching target value or SSR-safe placeholder so static export succeeds without layout shift.

#### Implementation Pattern:
```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

export default function AnimatedCounter({
  target,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1600,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<string>(
    `${prefix}${target.toFixed(decimals)}${suffix}`
  );
  const elementRef = useRef<HTMLSpanElement>(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || animatedRef.current) return;

    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(`${prefix}${target.toFixed(decimals)}${suffix}`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animatedRef.current) {
          animatedRef.current = true;
          let startTime: number | null = null;

          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic curve
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = target * easeOut;

            setDisplayValue(`${prefix}${current.toFixed(decimals)}${suffix}`);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setDisplayValue(`${prefix}${target.toFixed(decimals)}${suffix}`);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, prefix, suffix, decimals, duration]);

  return (
    <span ref={elementRef} className="tabular-nums font-black">
      {displayValue}
    </span>
  );
}
```

#### Trust Metrics Mapping:
- **Offline Durability:** `target={100}`, `suffix="%"`, `decimals={0}`
- **Cloud Risk Exposure:** `target={0.0}`, `suffix="s"`, `decimals={1}`
- **Local Billing Latency:** `target={10}`, `prefix="< "`, `suffix="ms"`, `decimals={0}`
- **Active Installs & Pilots:** `target={100}`, `suffix="+"`, `decimals={0}`

---

### 4.4 Glassmorphic Elevated Card Hover States

#### Specification:
For `FeaturesGrid.tsx`, `OfflineArchitecture.tsx`, and `UiPreviews.tsx`:
- **Surface:** `bg-white/80 backdrop-blur-md`
- **Border:** `border border-slate-200/80 hover:border-orange-400/60 transition-colors duration-300`
- **Inner Specular Light:** `shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8)]`
- **Elevation Shadow:** `hover:shadow-[0_20px_35px_-10px_rgba(240,121,40,0.12),0_1px_3px_0_rgba(0,0,0,0.05)]`
- **Micro-Lift:** `hover:-translate-y-1.5 transition-transform duration-300 ease-out`
- **Interactive Border Glow / Spotlight Card:** An inner subtle radial gradient visible on card hover that follows the mouse position or accents the card header icon.

---

## 5. Auth & Role Dashboard Integration (R2 & R3 Synergy)

### 5.1 Requirement R2: Navbar, Hero, and CTA Auth Navigation
Currently, prospective users visiting `orderitup.pages.dev` see:
- Navbar: "Owner Login" (`/auth/login`) and "Download POS" (`#download`). **No Sign Up / Register button.**
- Hero: "Download Desktop POS" (`#download`) and "Explore Interactive Demo" (`#ui-preview`). **No Auth links.**
- CTA Section: Only Windows, Mac, and Linux download buttons. **No SaaS registration.**

#### Proposed Placement & Styling:
1. **Navbar:**
   - Add secondary button: `Sign In` (`/auth/login`)
   - Add primary tactile button: `Start Free / Sign Up` (`/auth/register`) with brand orange background, subtle shimmer, and tactile press scaling.
   - Retain Desktop "Download" icon link or dropdown.
2. **Hero Section:**
   - Primary Action: `Start Free Cloud Account` (`/auth/register`) or `Download Desktop POS` (`#download`).
   - Secondary Action: `Sign In to Portal` (`/auth/login`) & `Explore Demo` (`#ui-preview`).
3. **CTA Banner:**
   - Prominently feature `Create Your Restaurant Account` (`/auth/register`) next to the native OS desktop installer downloads.

### 5.2 Requirement R3: Role-Based Dashboard Showcase
In `users.md`, there are 10 operational personas and their respective routes:
- **Owner / Super Admin:** `/cloud-portal` & `/dashboard`
- **Manager:** `/dashboard` & `/reports`
- **Accountant:** `/reports` (Tax & GST summaries, Tally XML)
- **Cashier:** `/pos` (Counter POS Billing)
- **Waiter / Server:** `/tables` (Table Floor Plan) & `/orders`
- **Kitchen Chef:** `/kds` & `/kds-standalone` (Kitchen Display System)
- **Customer / Guest:** `/menu` & `/qr`

#### Proposed Interactive Role Showcase Component (`RoleShowcase.tsx` or enhanced `RolePersonas.tsx`):
- Tab selector allowing users to switch between the 5 key roles:
  1. **Restaurant Owner** (Cloud HQ Portal, multi-branch, revenue analytics)
  2. **Counter Cashier** (Sub-second POS billing, split tenders, cash drawer kick)
  3. **Floor Captain / Waiter** (Tableside ordering, visual table status, course firing)
  4. **Kitchen Station Chef** (LAN KDS, ticket bumping, SLA countdown timers)
  5. **Head Accountant** (GST/VAT tax calculations, Z-reports, Tally XML export)
- For each role, provide:
  - Role identity badge & security scope
  - Interactive mock dashboard preview or screenshot card
  - Key operational capabilities checklist
  - Direct "Explore Role Dashboard" button linking to the route (e.g., `/cloud-portal`, `/pos`, `/tables`, `/kds`, `/reports`) or opening demo credentials modal referencing `users.md`.

### 5.3 Post-Login Role Routing Update (`AuthGuard.tsx`)
In `frontend/src/components/layout/AuthGuard.tsx`, update `getLandingPage()` to reflect `users.md` role permissions:
```ts
export function getLandingPage(): string {
  if (typeof window !== 'undefined') {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        const role = (u.role || '').toLowerCase();
        if (role === 'owner' || role === 'super_admin') return '/cloud-portal';
        if (role === 'manager' || role === 'branch_manager') return '/dashboard';
        if (role === 'accountant') return '/reports';
        if (role === 'cashier') return '/pos';
        if (role === 'server' || role === 'waiter') return '/tables';
        if (role === 'chef' || role === 'kitchen') return '/kds';
        if (role === 'customer') return '/qr';
      }
    } catch {}
    if (!isElectronEnvironment()) {
      return '/dashboard';
    }
  }
  return '/pos';
}
```

---

## 6. Pitfalls, Regressions & Mitigation Strategies

| Potential Pitfall / Risk | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **SSR Hydration Mismatch** | `window.innerWidth`, `Math.random()`, or dynamic counter values differing between server render and client mount. | React 19 hydration error; ugly visual flashing. | Initialize state with static target values or use `useEffect` after mount. Wrap client-interactive components in `'use client'`. |
| **Cumulative Layout Shift (CLS)** | Dynamic number counting changes character count, shifting adjacent text. | Degraded Core Web Vitals score; visual jumping. | Always apply `tabular-nums` CSS class and specify minimum widths on number containers (`min-w-[...]`). |
| **Mousemove Performance Degradation** | Calling `setState` on every `mousemove` event triggers 60–120 re-renders/sec. | CPU spikes, fan spin, stuttering on low-end laptops. | Mutate CSS variables (`--spotlight-x`, `--spotlight-y`) directly on the container DOM element via `ref.current.style.setProperty` inside `requestAnimationFrame`. Zero React re-renders. |
| **Tailwind v4 Configuration Errors** | Adding Tailwind v3 `@apply` rules or expecting `tailwind.config.js` to load. | Build fails during PostCSS compilation. | Put all keyframes and theme definitions in `frontend/src/app/globals.css` using standard CSS `@keyframes` and `@theme inline`. |
| **Static Export 404s on Cloudflare Pages** | Hardcoded dynamic server routes or client routing without trailing slash. | Broken page links on `orderitup.pages.dev`. | Rely on Next.js `<Link href="...">` with valid static routes (`/auth/login`, `/auth/register`, `/cloud-portal`). |
| **Reduced Motion Non-Compliance** | Forcing looping shimmer or number tickers on users with vestibular disorders. | Accessibility violation. | Implement `window.matchMedia('(prefers-reduced-motion: reduce)')` checks to disable animations and render final states immediately. |

---

## 7. Actionable Implementation Plan for Planner & Coders

### Step 1: CSS Keyframes & Global Animations (`frontend/src/app/globals.css`)
- Add `@keyframes shimmer` for shiny badges and button gleams.
- Add `@keyframes float-slow` and `@keyframes float-reverse` for ambient mesh orbs.
- Ensure reduced-motion media query disables shimmer and floating animations.

### Step 2: Create Modular React Bits UI Components
- `frontend/src/components/landing/AmbientBackground.tsx`: Interactive dot grid + cursor-following spotlight + ambient gradient mesh.
- `frontend/src/components/landing/AnimatedCounter.tsx`: IntersectionObserver + RAF number ticker with tabular numerals.
- `frontend/src/components/landing/ShimmerBadge.tsx`: Reusable shiny badge with sweeping light beam.

### Step 3: Upgrade Landing Components
- `page.tsx`: Wrap content with `AmbientBackground`.
- `Navbar.tsx`: Add prominent `/auth/register` (Signup) and `/auth/login` (Login) buttons with tactile hover/press states.
- `Hero.tsx`: Integrate shimmer badge, tactile action buttons (Download + Register), and glassmorphic window mockup.
- `TrustMetrics.tsx`: Replace static text with `AnimatedCounter` instances.
- `FeaturesGrid.tsx` & `OfflineArchitecture.tsx`: Upgrade cards with glassmorphic styling (`backdrop-blur-md`, inset specular highlight, glow border hover).
- `RolePersonas.tsx`: Upgrade to an interactive role dashboard showcase covering Owner, Cashier, Waiter, Chef, and Accountant with live previews and direct links.
- `CtaSection.tsx`: Add direct SaaS Signup button and glassmorphic hardware spec cards.

### Step 4: Update Post-Login Routing (`frontend/src/components/layout/AuthGuard.tsx`)
- Extend `getLandingPage()` to route all operational roles defined in `users.md` to their corresponding dashboards.

### Step 5: Verification & Quality Gate
- Run `npm run lint` across backend and frontend.
- Run `npm run build:frontend` to verify Next.js static export succeeds without errors.
- Validate zero layout shift, smooth 60fps animations, and full static navigation compatibility on `orderitup.pages.dev`.
