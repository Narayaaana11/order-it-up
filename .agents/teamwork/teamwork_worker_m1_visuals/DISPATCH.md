## 2026-10-31T10:45:30Z
You are a versatile implementation worker (teamwork_worker).
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m1_visuals
Your parent orchestrator conversation ID is: 0f278f7c-ec06-48f6-9c2f-e89c1978e9bf

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read the user request at:
d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project architecture and survey report at:
- d:\narayana\order-it-up\PROJECT.md
- d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey3_1\handoff.md

Your mission is Milestone M1: Landing Page Visuals, Authentic Unsplash Media, Standard Lucide Icons, Google Sign-in demo in AuthModal, and Redesigned Startup Terms & Conditions.

Exclusive File Ownership:
You own exclusively:
- `landing/src/components/Hero.tsx`
- `landing/src/components/UiPreviews.tsx`
- `landing/src/components/RolePersonas.tsx`
- `landing/src/components/AuthModal.tsx`
- `landing/src/components/TermsModal.tsx`
- `landing/src/lib/constants.ts`
- `landing/src/components/OfflineArchitecture.tsx`
Do NOT modify files outside this set.

Tasks:
1. Authentic Unsplash Media:
   - In `landing/src/components/Hero.tsx`: Replace the empty text-only window mockup inside `TiltedCard` (lines 286-319) with an authentic restaurant counter POS terminal photograph (`https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80`) and floating glass telemetry chips (Active Tables, KDS Tickets, Hardware Bus) as specified in survey handoff.md.
   - In `landing/src/components/UiPreviews.tsx`: Attach authentic food photography thumbnails to each cart item (Pizza: `https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=160&q=80`, Paneer Tikka: `https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=160&q=80`, Cold Brew Latte: `https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=160&q=80`, Lava Cake: `https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=160&q=80`).
   - In `landing/src/components/RolePersonas.tsx`: Pair each operational persona with its authentic context photography (Cashier: counter POS `photo-1556740738-b6a63e27c4df`, Waiter: tableside tablet `photo-1556740758-90de374c12ad`, Chef: kitchen brigade `photo-1577219491135-ce391730fb2c`, Manager: dining room `photo-1517248135467-4c7edcad34c4`, Accountant: ledger `photo-1554224155-8d04cb21cd6c`, Driver: dispatch `photo-1556742049-0a67c5574f73`).
2. Clean Lucide Icons & UI Control Standardization:
   - In `landing/src/components/AuthModal.tsx`: Replace emojis (👑, 👔, 💳) with Lucide icons (`Crown`, `Briefcase`, `CreditCard`).
   - In `landing/src/components/AuthModal.tsx`: Add the branded 4-color Google 'G' SVG button ("Continue with Google", "Demo" badge, and 1-click demo sign-in trigger).
   - In `landing/src/lib/constants.ts`: Remove the duplicate `⚡` emoji from `eyebrow`.
   - In `landing/src/components/OfflineArchitecture.tsx`: Replace raw unicode bullet with a clean indicator.
3. Redesigned Startup Terms & Conditions in `landing/src/components/TermsModal.tsx`:
   - Redesign the modal with 5 comprehensive, highly readable tabs suited for an early-stage SaaS startup:
     1. SaaS Terms & Multi-Tier Licensing (desktop offline POS vs cloud platform scope).
     2. SLA & Uptime Expectations (100% offline invariant vs best-effort early cloud beta, no monetary penalties).
     3. Merchant Data Sovereignty, S3 Cloud Storage & Privacy (100% merchant ownership, SQLite WAL, tenant S3 segregation).
     4. Acceptable Use Policy & Merchant Operational Responsibilities (hardware compatibility, 24V solenoids, network security, statutory tax filings).
     5. Limitation of Liability, Subscription Billing, Renewal & Zero-Lock-In Cancellation Policy.
4. Build & Test Verification:
   - Run `npm --prefix landing run lint`
   - Run `npm --prefix landing run build`
   - Document commands, terminal output, and test results in your handoff.

Write your complete handoff report to:
`d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m1_visuals\handoff.md`
Send a completion message via `send_message` when finished.
