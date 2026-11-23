/** Integration test for asymmetric Ed25519 license key generation and verification. */

const assert = require('node:assert');
const { generateEd25519Keypair, signLicense, verifyLicense } = require('../scripts/generate-license.cjs');
const { verifyAsymmetricLicense } = require('../main/services/license-verifier');

async function testLicenseGenerationAndVerification() {
  console.log('[Test] 1. Generate keypair');
  const pair = generateEd25519Keypair();
  assert.ok(pair.privateKey.includes('BEGIN PRIVATE KEY'));
  assert.ok(pair.publicKey.includes('BEGIN PUBLIC KEY'));

  console.log('[Test] 2. Sign valid commercial license (Enterprise, 30 days)');
  const signed = signLicense('enterprise', 30, 'STORE-DELHI-01', pair.privateKey);
  assert.ok(signed.licenseKey.startsWith('OIU2.ENTERPRISE.'));
  assert.strictEqual(signed.plan, 'ENTERPRISE');
  assert.strictEqual(signed.storeId, 'STORE-DELHI-01');

  console.log('[Test] 3. Verify license with script verifyLicense()');
  const scriptVerified = verifyLicense(signed.licenseKey, pair.publicKey);
  assert.strictEqual(scriptVerified, true, 'Script verification should pass');

  console.log('[Test] 4. Verify license with main/services/license-verifier.ts');
  const coreVerified = verifyAsymmetricLicense(signed.licenseKey, pair.publicKey);
  assert.strictEqual(coreVerified.valid, true, 'Core license verifier should report valid');
  assert.strictEqual(coreVerified.plan, 'enterprise');
  assert.strictEqual(coreVerified.storeId, 'STORE-DELHI-01');
  assert.ok(coreVerified.expiresAt, 'ExpiresAt timestamp should be returned');

  console.log('[Test] 5. Tamper protection: change plan tier in token');
  const tamperedPlan = signed.licenseKey.replace('ENTERPRISE', 'STARTER');
  const tamperedPlanRes = verifyAsymmetricLicense(tamperedPlan, pair.publicKey);
  assert.strictEqual(tamperedPlanRes.valid, false, 'Tampered plan should fail signature verification');

  console.log('[Test] 6. Tamper protection: change store ID in token');
  const tamperedStore = signed.licenseKey.replace('STORE-DELHI-01', 'STORE-MUMBAI-99');
  const tamperedStoreRes = verifyAsymmetricLicense(tamperedStore, pair.publicKey);
  assert.strictEqual(tamperedStoreRes.valid, false, 'Tampered store ID should fail signature verification');

  console.log('[Test] 7. Tamper protection: corrupted signature bytes');
  const parts = signed.licenseKey.split('.');
  const corruptedSig = parts.slice(0, 4).join('.') + '.AbCdEf123456';
  const corruptedRes = verifyAsymmetricLicense(corruptedSig, pair.publicKey);
  assert.strictEqual(corruptedRes.valid, false, 'Corrupted signature length/bytes should fail');

  console.log('[Test] 8. Expiration validation: sign an already-expired license');
  const expiredLicense = signLicense('pro', -5, 'STORE-EXPIRED-01', pair.privateKey);
  const expiredRes = verifyAsymmetricLicense(expiredLicense.licenseKey, pair.publicKey);
  assert.strictEqual(expiredRes.valid, false, 'Expired license must not be valid');
  assert.ok(expiredRes.error?.includes('expired'), 'Error message should mention expiration');

  console.log('All license generation and asymmetric verification tests passed successfully.');
}

testLicenseGenerationAndVerification().catch((err) => {
  console.error('[FATAL] License test failed:', err);
  process.exit(1);
});
