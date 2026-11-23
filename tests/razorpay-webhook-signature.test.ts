import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Test harness simulating the webhook endpoint verification logic
function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!signature || !secret || !rawBody || rawBody.length === 0) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

test('Razorpay Webhook Signature Verification - HMAC SHA256 with constant-time equality', () => {
  const secret = 'whsec_test_secret_key_1234567890abcdef';
  const bodyText = JSON.stringify({
    event: 'payment.captured',
    id: 'evt_123456',
    payload: {
      payment: {
        entity: {
          id: 'pay_ABC123',
          order_id: 'order_XYZ789',
          amount: 50000,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });
  const rawBody = Buffer.from(bodyText, 'utf8');

  // Generate authentic HMAC SHA256 signature
  const validSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // 1. Valid signature must pass
  assert.equal(verifyRazorpayWebhookSignature(rawBody, validSignature, secret), true, 'Authentic signature should verify');

  // 2. Tampered signature must fail
  const tamperedSig = validSignature.slice(0, -2) + '00';
  assert.equal(verifyRazorpayWebhookSignature(rawBody, tamperedSig, secret), false, 'Tampered signature must be rejected');

  // 3. Signature generated with different secret must fail
  const wrongSecret = 'whsec_attacker_controlled_secret';
  const wrongSecretSig = crypto.createHmac('sha256', wrongSecret).update(rawBody).digest('hex');
  assert.equal(verifyRazorpayWebhookSignature(rawBody, wrongSecretSig, secret), false, 'Wrong secret signature must be rejected');

  // 4. Altered body with valid signature of original body must fail
  const alteredBody = Buffer.from(bodyText.replace('pay_ABC123', 'pay_EVIL666'), 'utf8');
  assert.equal(verifyRazorpayWebhookSignature(alteredBody, validSignature, secret), false, 'Altered body payload must fail');

  // 5. Empty or missing fields must fail closed
  assert.equal(verifyRazorpayWebhookSignature(rawBody, '', secret), false, 'Empty signature fails closed');
  assert.equal(verifyRazorpayWebhookSignature(Buffer.alloc(0), validSignature, secret), false, 'Empty body fails closed');
});
