/**
 * Asymmetric Public-Key Commercial Licensing Service for Order It Up.
 * Uses Ed25519 signatures: the private key remains strictly on the licensing server,
 * while distributed customer POS clients only store the public verification key.
 */

import * as crypto from 'node:crypto';
import type { SubscriptionPlan } from './subscription';

// Official Order It Up Licensing Authority Public Key (Ed25519 SPKI format)
// The private signing key is NEVER distributed with desktop clients or packages.
export const DEFAULT_OIU_LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAMn8lOlKlWRskc4nFdYwO+44jpn/U1NdX3mLioJ8QKhY=
-----END PUBLIC KEY-----`;

export interface LicenseVerificationResult {
  valid: boolean;
  plan?: SubscriptionPlan;
  expiresAt?: string;
  storeId?: string;
  isLegacyHmac?: boolean;
  error?: string;
}

export interface LicenseIssuanceParams {
  plan: SubscriptionPlan;
  expiresAt: Date | number;
  storeId: string;
  privateKeyPem: string;
}

/**
 * Verifies an asymmetric Ed25519 Order It Up commercial license key.
 * Expected format: OIU2.<PLAN>.<EXPIRY_HEX>.<STORE_ID>.<ED25519_SIG_BASE64URL>
 */
export function verifyAsymmetricLicense(
  licenseKey: string,
  publicKeyPem?: string
): LicenseVerificationResult {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { valid: false, error: 'A valid license key string is required.' };
  }

  const trimmed = licenseKey.trim();

  // 1. Detect Legacy HMAC Format (OIU-<PLAN>-<EXPIRY>-<SIG>)
  if (trimmed.startsWith('OIU-') && !trimmed.startsWith('OIU2')) {
    return handleLegacyLicenseVerification(trimmed);
  }

  // 2. Parse OIU2 Asymmetric License Token (dot or hyphen delimited)
  const delimiter = trimmed.includes('.') ? '.' : '-';
  const parts = trimmed.split(delimiter);

  if (parts.length < 5 || parts[0].toUpperCase() !== 'OIU2') {
    return {
      valid: false,
      error: 'Invalid license format. Asymmetric commercial licenses must be in OIU2.<PLAN>.<EXPIRY>.<STORE_ID>.<SIG> format.',
    };
  }

  const planCode = parts[1].toLowerCase() as SubscriptionPlan;
  if (!['starter', 'pro', 'enterprise'].includes(planCode)) {
    return { valid: false, error: `Invalid or unsupported plan tier: ${parts[1]}.` };
  }

  // 3. Verify Expiry Timestamp
  const expiryTimestampSec = parseInt(parts[2], 16);
  if (isNaN(expiryTimestampSec) || expiryTimestampSec <= 0) {
    return { valid: false, error: 'Malformed license expiration timestamp.' };
  }

  const expiryMs = expiryTimestampSec * 1000;
  if (expiryMs < Date.now()) {
    return { valid: false, error: `Commercial license expired on ${new Date(expiryMs).toISOString().split('T')[0]}.` };
  }

  const storeId = parts[3].trim();
  const signatureBase64 = parts[4].trim();

  // 4. Verify Cryptographic Signature using Ed25519 Public Key
  const activePublicKeyPem = publicKeyPem || process.env.OIU_LICENSE_PUBLIC_KEY || DEFAULT_OIU_LICENSE_PUBLIC_KEY;
  const payloadData = Buffer.from(`OIU2.${parts[1].toUpperCase()}.${parts[2].toLowerCase()}.${storeId.toUpperCase()}`, 'utf8');

  let signatureBuf: Buffer;
  try {
    signatureBuf = Buffer.from(signatureBase64, 'base64url');
    if (signatureBuf.length !== 64) {
      // Attempt standard base64 fallback
      signatureBuf = Buffer.from(signatureBase64, 'base64');
    }
    if (signatureBuf.length !== 64) {
      return { valid: false, error: 'Malformed cryptographic signature length (expected 64-byte Ed25519 signature).' };
    }
  } catch {
    return { valid: false, error: 'Failed to decode cryptographic license signature.' };
  }

  try {
    const pubKey = crypto.createPublicKey(activePublicKeyPem);
    const isVerified = crypto.verify(null, payloadData, pubKey, signatureBuf);

    if (!isVerified) {
      return { valid: false, error: 'Cryptographic license verification failed. Signature is invalid or counterfeit.' };
    }

    return {
      valid: true,
      plan: planCode,
      expiresAt: new Date(expiryMs).toISOString(),
      storeId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { valid: false, error: `Public key verification error: ${message}` };
  }
}

/**
 * Helper to generate valid asymmetric license keys (for licensing authority server / automated testing).
 * This function requires the private key and MUST NOT be called in customer-facing production clients.
 */
export function issueAsymmetricLicense(params: LicenseIssuanceParams): string {
  const { plan, storeId, privateKeyPem } = params;
  const expiresAtMs = typeof params.expiresAt === 'number' ? params.expiresAt : params.expiresAt.getTime();
  const expiryHex = Math.floor(expiresAtMs / 1000).toString(16);

  const payload = `OIU2.${plan.toUpperCase()}.${expiryHex}.${storeId.toUpperCase()}`;
  const privKey = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), privKey);

  return `${payload}.${sig.toString('base64url')}`;
}

/**
 * Migration handler for legacy HMAC-SHA256 licenses.
 */
function handleLegacyLicenseVerification(trimmed: string): LicenseVerificationResult {
  const allowLegacy = process.env.OIU_ALLOW_LEGACY_HMAC === 'true';

  if (!allowLegacy) {
    return {
      valid: false,
      isLegacyHmac: true,
      error: 'Legacy HMAC license keys are deprecated for security. Please request an updated OIU2 asymmetric commercial license.',
    };
  }

  const parts = trimmed.split('-');
  if (parts.length < 4 || parts[0].toUpperCase() !== 'OIU') {
    return { valid: false, error: 'Malformed legacy license key.' };
  }

  const planCode = parts[1].toLowerCase() as SubscriptionPlan;
  if (!['starter', 'pro', 'enterprise'].includes(planCode)) {
    return { valid: false, error: 'Unknown plan in legacy license.' };
  }

  const expiryTimestamp = parseInt(parts[2], 16) * 1000;
  if (isNaN(expiryTimestamp) || expiryTimestamp < Date.now()) {
    return { valid: false, error: 'Legacy license has expired.' };
  }

  const legacySecret = process.env.OIU_LICENSE_SECRET || process.env.JWT_SECRET;
  if (!legacySecret) {
    return { valid: false, error: 'Legacy HMAC secret is not configured.' };
  }

  const payload = `${parts[0]}-${parts[1]}-${parts[2]}`;
  const expectedSig = crypto.createHmac('sha256', legacySecret).update(payload).digest('hex').slice(0, parts[3].length);

  const sigBuf = Buffer.from(parts[3].toLowerCase(), 'utf8');
  const expBuf = Buffer.from(expectedSig.toLowerCase(), 'utf8');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid legacy license signature.' };
  }

  return {
    valid: true,
    plan: planCode,
    expiresAt: new Date(expiryTimestamp).toISOString(),
    isLegacyHmac: true,
  };
}
