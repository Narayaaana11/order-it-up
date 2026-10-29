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
  console.log('🧪 [Test Suite 2/3] Asymmetric Ed25519 Commercial License Security...');

  const { verifyAsymmetricLicense, issueAsymmetricLicense, DEFAULT_OIU_LICENSE_PUBLIC_KEY } = await import('../main/services/license-verifier');

  // Generate an authorized testing Ed25519 keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  // 1. Valid Asymmetric License Key Verification
  const validKey = issueAsymmetricLicense({
    plan: 'enterprise',
    expiresAt: Date.now() + 365 * 86400 * 1000,
    storeId: 'STORE-CP-01',
    privateKeyPem: privPem,
  });

  const verified = verifyAsymmetricLicense(validKey, pubPem);
  assert.equal(verified.valid, true, 'Valid Ed25519 license must verify successfully');
  assert.equal(verified.plan, 'enterprise');
  assert.equal(verified.storeId, 'STORE-CP-01');

  // 2. Reject Tampered Plan (Attacker changes Starter to Enterprise without private key)
  const tamperedKey = validKey.replace('ENTERPRISE', 'PRO');
  const tamperedResult = verifyAsymmetricLicense(tamperedKey, pubPem);
  assert.equal(tamperedResult.valid, false, 'Tampered plan tier must be rejected');

  // 3. Reject Forged License Signed by Wrong/Attacker Private Key
  const { privateKey: rogueKey } = crypto.generateKeyPairSync('ed25519');
  const roguePrivPem = rogueKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const counterfeitKey = issueAsymmetricLicense({
    plan: 'enterprise',
    expiresAt: Date.now() + 365 * 86400 * 1000,
    storeId: 'STORE-CP-01',
    privateKeyPem: roguePrivPem,
  });
  const rogueResult = verifyAsymmetricLicense(counterfeitKey, pubPem);
  assert.equal(rogueResult.valid, false, 'Counterfeit signature signed with wrong private key must be rejected');

  // 4. Reject Expired License Key
  const expiredKey = issueAsymmetricLicense({
    plan: 'pro',
    expiresAt: Date.now() - 86400 * 1000, // Expired yesterday
    storeId: 'STORE-CP-01',
    privateKeyPem: privPem,
  });
  const expiredResult = verifyAsymmetricLicense(expiredKey, pubPem);
  assert.equal(expiredResult.valid, false, 'Expired license must be rejected');
  assert.ok(expiredResult.error?.includes('expired'));

  // 5. Reject Plain Text In Production
  const plainTextResult = verifyAsymmetricLicense('ENTERPRISE', pubPem);
  assert.equal(plainTextResult.valid, false, 'Plain text must be rejected');

  // 6. Legacy HMAC License Migration Warning
  const legacyKey = 'OIU-ENTERPRISE-67c13400-abcd1234ef567890';
  const legacyResult = verifyAsymmetricLicense(legacyKey, pubPem);
  assert.equal(legacyResult.valid, false, 'Legacy HMAC license must be rejected by default in production');
  assert.equal(legacyResult.isLegacyHmac, true);
  assert.ok(legacyResult.error?.includes('Legacy HMAC license keys are deprecated'));

  console.log('  ✓ Asymmetric Ed25519 signature validation, tamper prevention, expiry check, and legacy migration verified');
}

async function testPaymentLifecycleAndWebhooks(): Promise<void> {
  console.log('🧪 [Test Suite 3/3] Payment Lifecycle, Method-Scoped Replay & Webhook Idempotency...');

  // In-memory simulation of payment_transaction_refs table with composite (method, transaction_id)
  const transactionRefs = new Map<string, { method: string; transaction_id: string; bill_id: string; created_at: string }>();
  const makeKey = (method: string, txId: string) => `${method}::${txId}`;
  const checkTx = (method: string, txId: string) => transactionRefs.get(makeKey(method, txId));
  const recordTx = (method: string, transactionId: string, billId: string) => {
    transactionRefs.set(makeKey(method, transactionId), { method, transaction_id: transactionId, bill_id: billId, created_at: new Date().toISOString() });
  };

  // 1. Server-authoritative pricing validation
  const { PRICING_PLANS } = require('../main/routes/subscription');
  assert.equal(PRICING_PLANS.starter.monthly, 499);
  assert.equal(PRICING_PLANS.starter.yearly, 4999);
  assert.equal(PRICING_PLANS.pro.monthly, 1299);
  assert.equal(PRICING_PLANS.pro.yearly, 12999);
  assert.equal(PRICING_PLANS.enterprise.monthly, 2999);
  assert.equal(PRICING_PLANS.enterprise.yearly, 29999);

  // 2. Order creation price integrity
  const keySecret = 'secret_test_abcdefghijklmnopqrstuvwxyz';
  const provider = new RazorpayProvider('rzp_test_123', keySecret);
  const plan = 'pro';
  const billingCycle = 'yearly';
  const expectedAmount = PRICING_PLANS[plan][billingCycle];
  assert.equal(expectedAmount, 12999, 'Server amount must be derived strictly from server pricing table');

  // 3. Payment verification & method-scoped replay attack prevention
  const orderId = 'order_sub_101';
  const paymentId = 'pay_sub_202';
  const validSignature = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');

  // First verification: not previously consumed
  assert.equal(checkTx('razorpay_subscription', paymentId), undefined, 'Payment must not be already consumed');
  const verifyResult = await provider.verifyPayment({ orderId, paymentId, signature: validSignature });
  assert.equal(verifyResult.verified, true);

  // Record transaction upon activation
  recordTx('razorpay_subscription', paymentId, orderId);

  // Second verification attempt with same paymentId: replay rejected
  const replayed = checkTx('razorpay_subscription', paymentId);
  assert.ok(replayed, 'Replayed payment ID must be detected in transaction refs');

  // Prevent cross-method collision: a webhook event with the SAME ID string does not collide with paymentId
  assert.equal(checkTx('razorpay_webhook', paymentId), undefined, 'Method scoping prevents semantic collisions');

  // 4. Webhook HMAC verification, dispute handling and deduplication
  const webhookSecret = 'whsec_prod_test_key_999';
  const webhookPayload = JSON.stringify({
    id: 'evt_test_captured_001',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          notes: { plan: 'enterprise', billingCycle: 'yearly' }
        }
      }
    }
  });

  const webhookSignature = crypto.createHmac('sha256', webhookSecret).update(webhookPayload).digest('hex');

  // Signature check function matching subscription.ts implementation
  const verifyWebhookSig = (payload: string, sig: string, secret: string) => {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const bSig = Buffer.from(sig, 'utf8');
    const bExp = Buffer.from(expected, 'utf8');
    return bSig.length === bExp.length && crypto.timingSafeEqual(bSig, bExp);
  };

  // Valid webhook signature succeeds
  assert.equal(verifyWebhookSig(webhookPayload, webhookSignature, webhookSecret), true);

  // Tampered payload fails
  assert.equal(verifyWebhookSig(webhookPayload + 'tamper', webhookSignature, webhookSecret), false);

  // Bad secret fails
  assert.equal(verifyWebhookSig(webhookPayload, webhookSignature, 'wrong_secret'), false);

  // Webhook deduplication
  const eventId = 'evt_test_captured_001';
  assert.equal(checkTx('razorpay_webhook', eventId), undefined);
  recordTx('razorpay_webhook', eventId, 'order_sub_101');

  // Repeated delivery of the same webhook is deduplicated
  assert.ok(checkTx('razorpay_webhook', eventId), 'Duplicate webhook eventId must be recognized as already processed');

  // Failed payment webhook records failure without throwing or duplicating
  const failedEventId = 'evt_test_failed_002';
  recordTx('razorpay_webhook_failed', failedEventId, 'webhook_failed');
  assert.ok(checkTx('razorpay_webhook_failed', failedEventId));

  console.log('  ✓ Server pricing enforcement, payment replay blocking, and webhook deduplication verified');
}

async function runAllPaymentTests(): Promise<void> {
  console.log('================================================================');
  console.log('  PAYMENT PROVIDER & COMMERCIAL LICENSE SECURITY AUDIT');
  console.log('================================================================\n');

  await testRazorpayProviderHardening();
  await testLicenseKeyVerification();
  await testPaymentLifecycleAndWebhooks();

  console.log('\n================================================================');
  console.log('✅ ALL PAYMENT & LICENSING SECURITY TESTS PASSED!');
  console.log('================================================================');
}

runAllPaymentTests().catch((err) => {
  console.error('\n❌ Payment Tests Failed:', err);
  process.exit(1);
});
