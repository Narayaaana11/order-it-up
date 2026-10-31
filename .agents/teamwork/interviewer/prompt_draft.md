Enhance the Order It Up landing page (`frontend/src/app/page.tsx` and `frontend/src/components/landing/`) with modern React Bits inspired UI animations, complete authentication integration, role-based dashboard showcase tabs, and routing across user roles defined in `users.md`, fully compatible with Cloudflare Pages static export (`orderitup.pages.dev`).

Integrity mode: demo
The team must NOT: copy code from existing open-source projects for core logic, run external scripts or delegate execution to other tools

Reference: `users.md` for role definitions, credentials, and platform boundaries

## Requirements

### R1. Landing Page UI Enhancement (React Bits Inspired)
Upgrade the main landing page (`frontend/src/app/page.tsx` and `frontend/src/components/landing/`) using modern, high-performance React Bits aesthetic and animations implemented with lightweight, dependency-safe React 19 and Tailwind CSS:
- Ambient background (such as subtle interactive dot pattern, spotlight, or gradient mesh).
- Shiny badges, smooth animated number counters for trust metrics, tactile button interactions, and glassmorphic elevated card hover states.
- Maintain full compatibility with React 19, Next.js 16 (App Router), and Tailwind CSS without introducing heavy external npm packages.

### R2. Complete Auth & Navigation Integration
- Prominently integrate Login (`/auth/login`) and Signup (`/auth/register`) in the navbar, hero section, and call-to-action (CTA) sections of the landing page.
- Ensure full compatibility with Cloudflare Pages (`orderitup.pages.dev`) static export and client navigation.

### R3. User Dashboards Showcase & Role-Based Routing
- Connect the login flow and navigation to role-based dashboards defined in `users.md`:
  - Owner / Super Admin: Cloud HQ Portal (`/cloud-portal`) & Store Management (`/dashboard`)
  - Manager: Store Dashboard & Operations (`/dashboard`, `/reports`)
  - Accountant: Financial & Tax Summaries (`/reports`)
  - Cashier: Counter POS Billing (`/pos`)
  - Waiter / Server: Table Floor Plan & Live Orders (`/tables`, `/orders`)
  - Kitchen Chef: Kitchen Display System (`/kds`, `/kds-standalone`)
  - Guest / Customer: Digital Menu & QR Dining (`/menu`, `/qr`)
- The team decides the optimal routing and handling for operational roles on the web platform, balancing `users.md` boundaries and web preview usability.
- Add an interactive dashboard showcase / preview tabs or selector on the landing page so prospective users can explore how different roles (Owner, Cashier, Waiter, Chef, Accountant) experience Order It Up.

### R4. Validation and Compatibility
- Verify `npm run lint` and `npm run build:frontend` pass cleanly with zero errors.
- Ensure smoke and integration tests pass with no regressions across dual-server or authentication paths.

## Acceptance Criteria

### Landing Page UI & React Bits Aesthetics
- [ ] Landing page renders ambient background (dot pattern, spotlight, or gradient mesh) without visual stutter or layout shift.
- [ ] Trust metrics display smooth animated number counters that increment into view.
- [ ] Badges feature subtle shiny/shimmer styling and interactive buttons provide tactile feedback on hover and press.
- [ ] Feature, preview, and architecture cards render with glassmorphic elevated hover states.
- [ ] All animations and components are implemented in lightweight React 19 and Tailwind CSS with no heavy external dependencies added.

### Auth & Navigation Integration
- [ ] Navbar contains accessible, prominent Login and Signup buttons linking to `/auth/login` and `/auth/register`.
- [ ] Hero and CTA sections feature direct action buttons directing users to registration and login.
- [ ] All landing page links and navigation routes work seamlessly on static export without 404s or broken transitions.

### Role Dashboards Showcase & Role Routing
- [ ] Landing page includes an interactive role showcase/preview selector covering key roles (Owner, Cashier, Waiter, Chef, Accountant) allowing prospective users to preview each experience.
- [ ] Post-login flow and navigation direct authenticated users to their corresponding dashboard route defined in `users.md`.

### Build & Test Validation
- [ ] `npm run lint` completes with zero errors.
- [ ] `npm run build:frontend` completes with zero errors.
- [ ] Integration and smoke test suite runs cleanly without regressions on auth or dual-server pathways.
