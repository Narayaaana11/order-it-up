# Phase 1 Completion Report: Critical Gaps (Recipe BOM & Store-and-Forward Cards)

**Date:** 2026-11-24  
**Status:** COMPLETE (Ready for Phase 2)

---

## 1. Summary of Completed Items

| Item | Scope | Status | Evidence / Files |
|---|---|---|---|
| **1.1 Recipe & Ingredient-Level Inventory** | SQLite + BOM Engine + Audit Trail | **PASS** | `main/services/inventory-engine.ts`, `main/db.ts` (v94), `tests/phase1-critical-gaps.test.ts` |
| **1.2 Offline Card Payment — Store-and-Forward (SAF)** | Local Terminal + Replay + Idempotency | **PASS** | `main/services/saf-engine.ts`, `main/routes/saf.ts`, `tests/phase1-critical-gaps.test.ts` |

---

## 2. Detailed Technical Findings & Invariants Enforced

### 1.1 Recipe & Raw Ingredient BOM with Modifier Deltas
- **Schema (v94)**:
  - Added `addon_recipes` for modifier-driven ingredient additions and subtractions (e.g. Extra Cheese Slice = +20g Cheddar).
  - Added `unit_conversions` (`kg` ↔ `g`, `l` ↔ `ml`, `pcs`) with conversion math.
- **Transactional Stock Decrement & Restoration**:
  - `deductIngredientsForOrderItems`: Atomically consumes recipe base quantities plus modifier deltas in `raw_ingredients` and records transactional audit entries in `inventory_transactions`.
  - `restoreIngredientsForOrderItems`: Accurately restores ingredients when an order or item is voided or cancelled, guarding against double-restoration.
  - **Audit Logging**: Every stock deduction and restoration appends to the tamper-evident hash-chained audit log with actor and before/after states.

### 1.2 Offline Card Payment — Store-and-Forward (SAF)
- **Local Vaulting**:
  - Stored offline card tenders under merchant floor limits (`saf_floor_limit` default: 5,000 INR; `saf_max_cumulative` default: 50,000 INR).
  - Bills are marked `pending_settlement` with explicit terminal offline authorization codes.
- **Idempotent Forwarding & Replay**:
  - Replay processes pending queue records, transitions status to `settled`, and durably links the settlement token to the bill payment details.
  - Repeated executions are completely idempotent (`0` transactions re-processed on replay).
- **Audit Logging**: Every offline card queued and every settlement transition appends directly to the audit log.

---

## 3. Test Harness Verification

```
🧪 Phase 1 Critical Gaps: Recipe BOM, Modifiers, SAF, & Audit Chain
=================================================================
Part 1: Recipe BOM, Modifiers, & Unit Conversions
  ✓ Deduction should succeed
  ✓ 1 bun deducted
  ✓ 1 patty deducted
  ✓ 50g cheese deducted (30g recipe + 20g modifier)
  ✓ Bun stock restored on order void

Part 2: Store-and-Forward (SAF) Offline Cards
  ✓ Queued status initialized
  ✓ Card last 4 digits captured
  ✓ 1 transaction settled on reconnect
  ✓ Transaction marked as settled
  ✓ forwarded_at timestamp set
  ✓ Duplicate replay settled 0 items
  ✓ No more pending transactions

Part 3: Cryptographic Audit Chain Verification
  ✓ Audit chain must be cryptographically valid
  ✓ Should have verified multiple audit records for stock and SAF (found 8)

Results: 14/14 passed
```

- `npm run audit:db`: **PASS (Clean, 0 FK violations, 0 cracks)**
- `npm run test:url-allowlist`: **PASS**
- `npm run i18n:check`: **PASS (8 languages, 0 drift)**

**READY FOR PHASE 2.**
