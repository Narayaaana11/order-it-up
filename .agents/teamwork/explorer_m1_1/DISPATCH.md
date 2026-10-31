## 2026-10-31T13:26:51Z
You are Explorer 1 for Milestone M1: "Hybrid Reactive Data Architecture & Operational Models".
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\explorer_m1_1\

Read:
- Original Request: d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Scope: d:\narayana\order-it-up\.agents\teamwork\orchestrator_1\PROJECT.md
- Prior Explorer Survey: d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_2\analysis.md and d:\narayana\order-it-up\.agents\teamwork\explorer_survey_dash_3\analysis.md

Task:
1. Define the complete TypeScript type system to be implemented in `landing/src/lib/dashboard-models.ts`.
2. Cover all data structures needed for:
   - Orders & Line Items (with course: starter/main/dessert, kitchen station: oven/tandoor/bar, status: pending/preparing/ready/served)
   - Tables & Rooms (indoor, patio, rooftop, statuses: available/occupied/billed/reserved, covers)
   - Staff & Roles (Owner, Manager, Cashier, Chef, Waiter, Accountant, Driver, with 4-digit PINs)
   - Indian GST Tax Breakdown (CGST 2.5%, SGST 2.5%, SAC 996331, FSSAI: 10019011000234)
   - Cash Registers & Shift Z-Reports (opening float, cash/card/upi collections, variance, z-number)
   - Online & Delivery Dispatches (Swiggy, Zomato, Direct, rider name/phone, status, COD amount)
   - 16-Character License Keys (format `OIUP-[PLAN]-[MACHINE_HASH]-[CHECKSUM]`)
   - Platform Tenants & Chain Outlets (Downtown Bistro, Cyber Hub Express, Airport Terminal 3, menu catalog with branch price overrides, isolated S3 bucket paths)
3. Ensure no placeholder types (`any` or dummy properties).
4. Write your analysis report to `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_1\analysis.md`.
5. Write handoff report to `d:\narayana\order-it-up\.agents\teamwork\explorer_m1_1\handoff.md`.
6. Message orchestrator when complete.
