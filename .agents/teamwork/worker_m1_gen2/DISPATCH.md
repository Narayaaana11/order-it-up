## 2026-10-30T22:55:59Z
You are Worker 1 Gen 2 (teamwork_worker) implementing Milestone 1: React Bits UI & Aesthetics. You are replacing worker_m1 following a temporary quota reset.
Your working directory is: `d:\narayana\order-it-up\.agents\teamwork\worker_m1_gen2\`

MANDATORY FIRST STEP:
Read the authoritative user request at:
`d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md`
Also read:
`d:\narayana\order-it-up\PROJECT.md`
And consult the technical survey findings in:
`d:\narayana\order-it-up\.agents\teamwork\explorer_survey_1\survey_report.md`
`d:\narayana\order-it-up\.agents\teamwork\explorer_survey_1\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP FOR MILESTONE 1:
- `frontend/src/app/globals.css`
- `frontend/src/components/landing/AmbientBackground.tsx`
- `frontend/src/components/landing/AnimatedCounter.tsx`
- `frontend/src/components/landing/ShimmerBadge.tsx`
- `frontend/src/components/landing/TrustMetrics.tsx`
- `frontend/src/components/landing/FeaturesGrid.tsx`
- `frontend/src/components/landing/Hero.tsx` (styling enhancements for ambient background / shimmer badges / glassmorphic cards)
Do NOT modify files outside your ownership scope.

TASKS FOR MILESTONE 1:
1. `globals.css`:
   - Add `@keyframes shimmer` and `.animate-shimmer` utility class for shiny badges.
   - Ensure support for reduced motion (`@media (prefers-reduced-motion: reduce)`).
2. `frontend/src/components/landing/AmbientBackground.tsx`:
   - Implement an interactive ambient background in pure React 19 + Tailwind v4.
   - Include subtle dot pattern / grid, interactive mouse-tracking spotlight (updating CSS variables `--spotlight-x`, `--spotlight-y` directly on a container ref without triggering re-renders), and soft gradient mesh orbs.
   - Ensure hydration safety and smooth 60fps performance.
3. `frontend/src/components/landing/AnimatedCounter.tsx`:
   - Implement a lightweight, dependency-free animated number counter component.
   - Uses `IntersectionObserver` to trigger when scrolled into view.
   - Uses `requestAnimationFrame` with cubic ease-out to smoothly animate values (e.g. from 0 to target).
   - Supports `value`, `prefix`, `suffix`, `decimals`, `duration`.
4. `frontend/src/components/landing/ShimmerBadge.tsx` (or integrated shimmer badge):
   - Modern shiny badge with sweeping specular reflection beam for trust/eyebrow badges.
5. `frontend/src/components/landing/TrustMetrics.tsx`:
   - Upgrade the static hardcoded metric values (`100%`, `0.0s`, `< 10ms`, `100+`) to use `AnimatedCounter` with smooth incrementing into view.
6. `frontend/src/components/landing/FeaturesGrid.tsx` & `Hero.tsx`:
   - Upgrade feature and preview cards with glassmorphic elevated hover states (`backdrop-blur-md`, subtle specular highlights `shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]`, smooth hover elevation and border glow).
   - In `Hero.tsx`, add the shiny shimmer eyebrow badge and tactile button transitions.

VERIFICATION REQUIREMENTS:
- Run `npm run lint` and verify 0 errors.
- Run `npm run build:frontend` and verify compilation and static export succeed with exit code 0.
- Update `progress.md` with `Last visited: [timestamp]` header.
- Document exact commands and results in `handoff.md`.
- Send completion message to parent orchestrator via `send_message`.
