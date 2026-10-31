## 2026-10-31T15:04:20Z
You are Reviewer 2 for Milestone M2: "The 6 Operational Persona Dashboards".
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\reviewer_m2_2\

Read:
- Original Request: d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Scope: d:\narayana\order-it-up\.agents\teamwork\orchestrator_1\PROJECT.md
- Worker M2 Handoff: d:\narayana\order-it-up\.agents\teamwork\worker_m2_dash\handoff.md
- Files to inspect in `landing/src/components/dashboard/`:
  - `CashierView.tsx`
  - `KitchenChefView.tsx`
  - `ServerWaiterView.tsx`
  - `AccountantView.tsx`
  - `DeliveryDriverView.tsx`
  - `OwnerManagerView.tsx`

Review tasks:
1. Verify Accountant view: Indian GST breakdown (CGST 2.5%, SGST 2.5%, SAC 996331), FSSAI verification (`10019011000234`), Z-Report shift closure balancing, and Tally XML export generation.
2. Verify Delivery Driver view: dispatch queue (Swiggy, Zomato, Direct), customer address verification, and COD collection reconciliation.
3. Verify Owner/Manager view: multi-outlet live sales, consolidated chain performance, staff PIN & role assignment, shift closures, S3 cloud backup outbox.
4. Run verification commands:
   - `npm --prefix landing run lint`
   - `npm --prefix landing run build`
   - `node --test tests/landing-dashboard-m2.test.cjs`
5. Formulate your verdict: APPROVE or REQUEST_CHANGES.
6. Write your review report to: `d:\narayana\order-it-up\.agents\teamwork\reviewer_m2_2\handoff.md`.
7. Send completion message with your explicit verdict.
