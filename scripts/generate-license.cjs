#!/usr/bin/env node
/**
 * Asymmetric Ed25519 Commercial License Generator for Order It Up.
 * Generates cryptographic license tokens compatible with main/services/license-verifier.ts.
 *
 * Usage:
 *   node scripts/generate-license.cjs --plan enterprise --days 365 --store STORE01
 *   node scripts/generate-license.cjs --generate-keypair
 */

const crypto = require('node:crypto');
const fs = require('node:fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    plan: 'enterprise',
    days: 365,
    store: 'STORE01',
    privateKeyPath: null,
    generateKeypair: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--generate-keypair') {
      options.generateKeypair = true;
    } else if (arg === '--plan' && i + 1 < args.length) {
      options.plan = args[++i].toLowerCase();
    } else if (arg === '--days' && i + 1 < args.length) {
      options.days = parseInt(args[++i], 10);
    } else if (arg === '--store' && i + 1 < args.length) {
      options.store = args[++i];
    } else if (arg === '--private-key' && i + 1 < args.length) {
      options.privateKeyPath = args[++i];
    }
  }

  return options;
}

function generateEd25519Keypair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function signLicense(plan, days, storeId, privateKeyPem) {
  const validPlans = ['starter', 'pro', 'enterprise'];
  if (!validPlans.includes(plan)) {
    throw new Error(`Invalid plan: ${plan}. Must be one of: ${validPlans.join(', ')}`);
  }

  const expirySec = Math.floor(Date.now() / 1000) + days * 86400;
  const expiryHex = expirySec.toString(16).toLowerCase();
  const normalizedPlan = plan.toUpperCase();
  const normalizedStore = storeId.toUpperCase();

  const payloadString = `OIU2.${normalizedPlan}.${expiryHex}.${normalizedStore}`;
  const payloadData = Buffer.from(payloadString, 'utf8');

  const privKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, payloadData, privKey);
  const signatureBase64Url = signature.toString('base64url');

  const licenseKey = `${payloadString}.${signatureBase64Url}`;
  return {
    licenseKey,
    plan: normalizedPlan,
    expiresAt: new Date(expirySec * 1000).toISOString(),
    storeId: normalizedStore,
    payloadString,
  };
}

function verifyLicense(licenseKey, publicKeyPem) {
  const parts = licenseKey.split('.');
  if (parts.length < 5 || parts[0] !== 'OIU2') return false;

  const payloadData = Buffer.from(`OIU2.${parts[1]}.${parts[2]}.${parts[3]}`, 'utf8');
  const sigBuf = Buffer.from(parts[4], 'base64url');
  const pubKey = crypto.createPublicKey(publicKeyPem);

  return crypto.verify(null, payloadData, pubKey, sigBuf);
}

function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
Order It Up - Commercial License Generator (Ed25519)

Options:
  --plan <starter|pro|enterprise>  Plan tier (default: enterprise)
  --days <number>                  Validity in days from now (default: 365)
  --store <id>                     Store ID identifier (default: STORE01)
  --private-key <file>             Path to Ed25519 private key PEM file
  --generate-keypair               Generate a new Ed25519 keypair and exit
  -h, --help                       Show this help message
`);
    process.exit(0);
  }

  if (options.generateKeypair) {
    const pair = generateEd25519Keypair();
    console.log('=== OFFICIAL Ed25519 PRIVATE KEY (KEEP STRICTLY SECRET) ===');
    console.log(pair.privateKey);
    console.log('=== OFFICIAL Ed25519 PUBLIC KEY (DISTRIBUTE TO CLIENTS) ===');
    console.log(pair.publicKey);
    process.exit(0);
  }

  let privateKeyPem = process.env.OIU_LICENSE_PRIVATE_KEY;
  let publicKeyPem = process.env.OIU_LICENSE_PUBLIC_KEY;

  if (options.privateKeyPath) {
    privateKeyPem = fs.readFileSync(options.privateKeyPath, 'utf8');
  }

  if (!privateKeyPem) {
    // Generate an ephemeral test keypair if no private key is provided
    const testPair = generateEd25519Keypair();
    privateKeyPem = testPair.privateKey;
    publicKeyPem = testPair.publicKey;
    console.log('[Notice] No private key supplied. Generated an ephemeral keypair for this license.');
    console.log('[Notice] Public key for testing:\n' + publicKeyPem);
  }

  const result = signLicense(options.plan, options.days, options.store, privateKeyPem);
  console.log('\n--- Commercial License Token ---');
  console.log(result.licenseKey);
  console.log('--------------------------------');
  console.log(`Plan:       ${result.plan}`);
  console.log(`Store ID:   ${result.storeId}`);
  console.log(`Expires At: ${result.expiresAt}`);

  if (publicKeyPem) {
    const valid = verifyLicense(result.licenseKey, publicKeyPem);
    console.log(`Verification Check: ${valid ? 'VALID (Signature verified successfully)' : 'FAILED'}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateEd25519Keypair,
  signLicense,
  verifyLicense,
};
