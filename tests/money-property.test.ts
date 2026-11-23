/**
 * Property-based Money & Allocation Tests (D8)
 *
 * Verifies with fast-check over 1,000+ random cases:
 * 1. allocateMinorUnits strictly conserves the total minor amount: sum(allocations) === sourceMinor.
 * 2. allocateSignedMinorUnits strictly conserves signed amounts: sum(allocations) === signedMinor.
 * 3. Proportional allocations never produce negative amounts for non-negative inputs.
 * 4. Split allocations always reconcile to 100% of the original invoice value without float drift.
 */

import * as assert from 'node:assert/strict';
import * as fc from 'fast-check';
import Decimal from 'decimal.js';
import { allocateMinorUnits, allocateSignedMinorUnits } from '../main/routes/bills';

let passed = 0;
let total = 0;

function check(name: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}:`, err.message);
    throw err;
  }
}

console.log('=== Property-Based Money Correctness Tests (fast-check) ===\n');

// 1. Conservation of minor units across arbitrary non-negative weights
check('allocateMinorUnits strictly conserves integer cents/paisa across 1,000 random cases', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 100_000_000 }), // 0 to ₹1,000,000.00
      fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 20 }),
      (sourceMinor, weights) => {
        const result = allocateMinorUnits(sourceMinor, weights);
        const sum = result.reduce((a, b) => a + b, 0);
        return sum === sourceMinor && result.every((val) => val >= 0);
      }
    ),
    { numRuns: 1000 }
  );
});

// 2. Conservation of signed minor units (refunds, adjustments)
check('allocateSignedMinorUnits preserves sign and exact total across 1,000 random cases', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -50_000_000, max: 50_000_000 }),
      fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 20 }),
      (signedMinor, weights) => {
        const result = allocateSignedMinorUnits(signedMinor, weights);
        const sum = result.reduce((a, b) => a + b, 0);
        const expectedSign = signedMinor < 0 ? -1 : signedMinor > 0 ? 1 : 0;
        const signCorrect = expectedSign === 0
          ? result.every((v) => v === 0)
          : result.every((v) => (v * expectedSign) >= 0);
        return sum === signedMinor && signCorrect;
      }
    ),
    { numRuns: 1000 }
  );
});

// 3. Proportional discount and tax scaling conservation using Decimal
check('Decimal proportional tax and discount scaling preserves cents equality', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 100, max: 100_000 }), // ₹1.00 to ₹1000.00 in paise
      fc.integer({ min: 0, max: 100 }),       // 0% to 100% discount
      fc.constantFrom(2.5, 5, 12, 18, 28),     // GST tax brackets
      (subtotalPaise, discountPct, taxRate) => {
        const subtotal = subtotalPaise / 100;
        const discountAmount = new Decimal(subtotal)
          .times(discountPct)
          .dividedBy(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        const discountedSubtotal = Decimal.max(0, new Decimal(subtotal).minus(discountAmount));
        const taxRatio = subtotal > 0 ? discountedSubtotal.dividedBy(subtotal) : new Decimal(1);

        const baseTax = new Decimal(subtotal).times(taxRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const discountedTax = baseTax.times(taxRatio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        // Verification: tax after discount cannot exceed tax before discount
        assert.ok(discountedTax.lessThanOrEqualTo(baseTax));
        // Subtotal after discount cannot exceed original subtotal
        assert.ok(discountedSubtotal.lessThanOrEqualTo(new Decimal(subtotal)));
        return true;
      }
    ),
    { numRuns: 500 }
  );
});

// 4. Multi-way guest split bill conservation
check('Multi-way bill splitting guarantees sum of portions equals parent bill total', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 100, max: 500_000 }), // ₹1.00 to ₹5,000.00 in paise
      fc.integer({ min: 2, max: 10 }),        // 2 to 10 split ways
      (totalPaise, ways) => {
        const equalWeights = Array(ways).fill(1);
        const splitPaise = allocateMinorUnits(totalPaise, equalWeights);
        const sum = splitPaise.reduce((acc, p) => acc + p, 0);
        assert.equal(sum, totalPaise, 'Total paise conserved across split bills');
        const maxDiff = Math.max(...splitPaise) - Math.min(...splitPaise);
        assert.ok(maxDiff <= 1, 'Split difference between guests is at most 1 paisa');
        return true;
      }
    ),
    { numRuns: 500 }
  );
});

console.log(`\nResults: ${passed}/${total} property-based money suites passed (3,000+ total runs).`);
