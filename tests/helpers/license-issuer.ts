/**
 * Licensing Authority / Testing License Issuance Helper.
 * 
 * IMPORTANT: This module requires the private Ed25519 signing key and is
 * EXCLUSIVELY intended for automated testing harnesses and the secure licensing authority server.
 * It is completely isolated from main/ and customer-distributed application bundles.
 */

import * as crypto from 'node:crypto';
import type { SubscriptionPlan } from '../../main/services/subscription';

export interface LicenseIssuanceParams {
  plan: SubscriptionPlan;
  expiresAt: Date | number;
  storeId: string;
  privateKeyPem: string;
}

export function issueAsymmetricLicense(params: LicenseIssuanceParams): string {
  const { plan, storeId, privateKeyPem } = params;
  const expiresAtMs = typeof params.expiresAt === 'number' ? params.expiresAt : params.expiresAt.getTime();
  const expiryHex = Math.floor(expiresAtMs / 1000).toString(16);

  const payload = `OIU2.${plan.toUpperCase()}.${expiryHex}.${storeId.toUpperCase()}`;
  const privKey = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), privKey);

  return `${payload}.${sig.toString('base64url')}`;
}
