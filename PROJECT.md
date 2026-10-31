# Project: Order It Up Landing Page & Role Dashboard Enhancement

## Architecture
- **Framework & Runtime**: Next.js 16 (App Router), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), TypeScript.
- **Platform Deployment**: Statically exported (`output: 'export'`, `trailingSlash: true`) for Cloudflare Pages (`orderitup.pages.dev`) while preserving Electron desktop POS compatibility.
- **Design Aesthetic**: Modern React Bits inspired aesthetic implemented purely in dependency-free React 19 and Tailwind CSS:
  - Interactive ambient dot pattern & mouse-following spotlight (CSS variables `--spotlight-x`, `--spotlight-y` updated via container ref without triggering React re-renders).
  - Shimmering light beam badges (`@keyframes shimmer` in `globals.css`).
  - Smooth animated number counters using `requestAnimationFrame` + `IntersectionObserver` with cubic ease-out.
  - Tactile button feedback (subtle active scale, border glow, shadow transitions).
  - Glassmorphic elevated cards (`backdrop-blur-md`, subtle specular inset highlights, border color transitions).
- **Authentication & Navigation**:
  - Direct, accessible links to `/auth/login` and `/auth/register` across Navbar, Hero, and CTA sections.
  - Client-side auth awareness using `useAuthStore` with hydration-safe `mounted` guards.
  - Static-export safety: No un-Suspended `useSearchParams()`; all paths registered in static export manifest.
- **Role Showcase & Routing**:
  - Interactive 6-tab Role Dashboard Showcase (`RolePersonas.tsx`) allowing prospective users to preview Owner (`/cloud-portal`), Manager (`/dashboard`), Cashier (`/pos`), Waiter (`/tables`), Chef (`/kds`), and Accountant (`/reports`).
  - Centralized role-based routing utility (`frontend/src/lib/role-routing.ts`) aligning `users.md` roles with platform invariants (desktop POS vs web SaaS portal).
  - Update `AuthGuard.tsx` (`getLandingPage()`) and `(dashboard)/dashboard/page.tsx` to handle managers and all operational roles seamlessly on web.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Ambient Background | Interactive dot pattern + mouse spotlight + gradient mesh in pure React 19/Tailwind | M1 | R1 |
| 2 | Shimmer Badges & Tactile Buttons | Shiny sweeping beam badges and tactile click/hover button styling | M1 | R1 |
| 3 | Animated Number Counters | Smooth RAF + IntersectionObserver counters for TrustMetrics and showcase | M1 | R1 |
| 4 | Glassmorphic Cards | Elevated hover states with backdrop-blur and specular reflections | M1 | R1 |
| 5 | Navbar Auth Integration | Accessible Login (`/auth/login`) and Signup (`/auth/register`) buttons in desktop & mobile nav | M2 | R2 |
| 6 | Hero & CTA Auth Integration | Direct SaaS registration and login action buttons in Hero and CtaSection | M2 | R2 |
| 7 | Static Export Compatibility | 100% clean static export (`output: 'export'`) on Cloudflare Pages without hydration errors | M2 | R2 |
| 8 | Interactive Role Showcase | 6-tab interactive preview canvas for Owner, Manager, Cashier, Waiter, Chef, Accountant | M3 | R3 |
| 9 | Granular Role-Based Routing | Centralized routing utility (`role-routing.ts`) directing each role to its `users.md` route | M3 | R3 |
| 10 | Manager Web Access Fix | Allow `manager` role access in `dashboard/page.tsx` without erroneous redirect to `/pos` | M3 | R3 |
| 11 | Validation & Test Suite | Full `npm run lint`, `npm run build:frontend`, and integration smoke testing with 0 errors | M4 | R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | React Bits UI & Aesthetics | `AmbientBackground.tsx`, `AnimatedCounter.tsx`, `ShimmerBadge.tsx`, `globals.css`, `Hero.tsx`, `TrustMetrics.tsx`, `FeaturesGrid.tsx` | none | DONE |
| M2 | Complete Auth & Navigation Integration | `Navbar.tsx`, `Hero.tsx`, `CtaSection.tsx`, `auth/login/page.tsx`, `auth/register/page.tsx`, static export safety | M1 | DONE |
| M3 | Role Showcase & Role-Based Routing | `RolePersonas.tsx`, `frontend/src/lib/role-routing.ts`, `AuthGuard.tsx`, `dashboard/page.tsx` | M1, M2 | DONE |
| M4 | Final Milestone: 100% Verification & Adversarial Hardening | E2E test execution, reviewer verification, challenger stress tests, and forensic integrity audit | M1, M2, M3 | DONE |

## Interface Contracts
### `frontend/src/lib/role-routing.ts`
```typescript
export interface UserRoleInfo {
  role?: string;
  isOwner?: boolean;
  tenantRole?: string;
}

export function getRoleDefaultRoute(user: UserRoleInfo | null, isElectron: boolean): string;
export function isRoleAllowedOnWeb(role: string): boolean;
```

### `frontend/src/components/landing/AmbientBackground.tsx`
```typescript
export interface AmbientBackgroundProps {
  children?: React.ReactNode;
  showSpotlight?: boolean;
  className?: string;
}
```

### `frontend/src/components/landing/AnimatedCounter.tsx`
```typescript
export interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}
```

## Code Layout
- `frontend/src/app/globals.css`: React Bits keyframes (`@keyframes shimmer`, ambient gradients)
- `frontend/src/components/landing/AmbientBackground.tsx`: Ambient dot grid + interactive spotlight
- `frontend/src/components/landing/AnimatedCounter.tsx`: Lightweight RAF-based viewport number counter
- `frontend/src/components/landing/Navbar.tsx`: Navbar with prominent Login/Register buttons and auth state
- `frontend/src/components/landing/Hero.tsx`: Hero with ambient background, shimmer badge, and direct auth CTAs
- `frontend/src/components/landing/TrustMetrics.tsx`: Trust metrics powered by `AnimatedCounter`
- `frontend/src/components/landing/FeaturesGrid.tsx`: Glassmorphic elevated cards
- `frontend/src/components/landing/RolePersonas.tsx`: Interactive 6-tab Role Showcase preview
- `frontend/src/components/landing/CtaSection.tsx`: SaaS Register/Login CTAs alongside desktop downloads
- `frontend/src/lib/role-routing.ts`: Canonical role-to-route mapper aligned with `users.md`
- `frontend/src/components/layout/AuthGuard.tsx`: Updated post-login redirection using `getRoleDefaultRoute`
- `frontend/src/app/(dashboard)/dashboard/page.tsx`: Role guard updated to allow manager access on web
