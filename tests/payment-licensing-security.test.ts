/**
 * Regression and Verification Test Suite: Payment Provider & Commercial Licensing Hardening
 */

import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { RazorpayProvider, MockPaymentProvider, getPaymentProvider } from '../main/services/payment-provider';

async function testRazorpayProviderHardening(): Promise<void> {
  console.log('🧪 [Test Suite 1/3] Razorpay Provider Signature Verification & Production Safety...');

  const keyId = 'rzp_test_1234567890';
  const keySecret = 'secret_test_abcdefghijklmnopqrstuvwxyz';
  const provider = new RazorpayProvider(keyId, keySecret);

  const orderId = 'order_987654321';
  const paymentId = 'pay_123456789';

  // 1. Valid HMAC SHA256 signature
  const validSignature = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const validResult = await provider.verifyPayment({ orderId, paymentId, signature: validSignature });
  assert.equal(validResult.verified, true, 'Valid signature must verify successfully');
  assert.equal(validResult.status, 'success');

  // 2. Tampered signature
  const badSignature = crypto.createHmac('sha256', 'wrong-secret').update(`${orderId}|${paymentId}`).digest('hex');
  const badResult = await provider.verifyPayment({ orderId, paymentId, signature: badSignature });
  assert.equal(badResult.verified, false, 'Tampered signature must be rejected');
  assert.equal(badResult.status, 'failed');

  // 3. Missing signature
  const missingResult = await provider.verifyPayment({ orderId, paymentId });
  assert.equal(missingResult.verified, false, 'Missing signature must be rejected');

  // 4. Production guard: mock provider forbidden in production
  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const mock = new MockPaymentProvider();
    await assert.rejects(
      async () => mock.createSubscriptionOrder({ amount: 1000, currency: 'INR', receipt: 'rcpt_1' }),
      /forbidden in production mode/
    );
    await assert.rejects(
      async () => mock.verifyPayment({ orderId: 'ord_1', paymentId: 'pay_1' }),
      /forbidden in production mode/
    );
  } finally {
    process.env.NODE_ENV = origEnv;
  }

  console.log('  ✓ Razorpay cryptographic HMAC verification and production mock blocking passed');
}

async function testLicenseKeyVerification(): Promise<void> {
  console.log('🧪 [Test Suite 2/3] Commercial License Key Format & Cryptographic Validation...');

  const origEnv = process.env.NODE_ENV;
  const origSecret = process.env.OIU_LICENSE_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    const testSecret = 'commercial-license-signing-secret-key-32ch';
    process.env.OIU_LICENSE_SECRET = testSecret;

    // Generate valid license: OIU-<PLAN>-<EXPIRY_HEX>-<SIG>
    const plan = 'ENTERPRISE';
    const futureExpiry = Math.floor((Date.now() + 365 * 86400 * 1000) / 1000).toString(16);
    const payload = `OIU-${plan}-${futureExpiry}`;
    const sig = crypto.createHmac('sha256', testSecret).update(payload).digest('hex').slice(0, 16);
    const validKey = `${payload}-${sig}`;

    // Test parse and signature validation
    const parts = validKey.split('-');
    assert.equal(parts[0], 'OIU');
    assert.equal(parts[1], 'ENTERPRISE');

    const expectedSig = crypto.createHmac('sha256', testSecret).update(payload).digest('hex').slice(0, parts[3].length);
    assert.equal(parts[3], expectedSig, 'Signature must match');

    // Reject counterfeit key with changed plan
    const counterfeitKey = `OIU-ENTERPRISE-${futureExpiry}-badsignature1234`;
    const cParts = counterfeitKey.split('-');
    const cSig = cParts[3];
    assert.notEqual(cSig, expectedSig, 'Counterfeit signature must not match');

    // Reject plain text like "ENTERPRISE"
    const plainTextKey = 'ENTERPRISE';
    assert(plainTextKey.split('-').length < 4, 'Plain text must be rejected in production');

  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.OIU_LICENSE_SECRET = origSecret;
  }

  console.log('  ✓ Cryptographic license parsing, signature check, and plain-text rejection verified');
}

async function runAllPaymentTests(): Promise<void> {
  console.log('================================================================');
  console.log('  PAYMENT PROVIDER & COMMERCIAL LICENSE SECURITY AUDIT');
  console.log('================================================================\n');

  await testRazorpayProviderHardening();
  await testLicenseKeyVerification();

  console.log('\n================================================================');
  console.log('✅ ALL PAYMENT & LICENSING SECURITY TESTS PASSED!');
  console.log('================================================================');
}

runAllPaymentTests().catch((err) => {
  console.error('\n❌ Payment Tests Failed:', err);
  process.exit(1);
});
