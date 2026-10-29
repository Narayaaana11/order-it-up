/**
 * Hardened Authentication & Cryptographic Helpers for Order It Up Cloud Edge Worker.
 * 
 * Features:
 * 1. Modern password hashing via scrypt (N=16384, r=8, p=1, 16-byte cryptographically secure random salt).
 * 2. Safe backward-compatible verification and rehash signaling for legacy SHA-256 password records.
 * 3. Constant-time buffer comparisons to prevent timing side-channel attacks.
 * 4. Strict Web Crypto JWT signing and verification with zero fallback defaults.
 * 5. Mandatory strong secret requirement (minimum 32 characters / 256 bits).
 * 6. Exhaustive header (alg: HS256, typ: JWT) and payload claim schema validation.
 */

import { scrypt, timingSafeEqual, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { CloudUser, CloudRole } from '../../../shared/cloud-types';

export interface JWTPayload {
  sub: string;             // User ID (non-empty string)
  org: string;             // Organization ID (non-empty string)
  email: string;           // Normalized user email
  role: CloudRole;         // Validated CloudRole
  branch?: string | null;  // Optional assigned branch
  exp: number;             // Expiration timestamp in seconds
  iat?: number;            // Issued-at timestamp in seconds
}

export const MIN_SECRET_LENGTH = 32;

/**
 * Validates that a JWT secret is configured and meets minimum entropy standards (>= 32 chars).
 */
export function isSecretValid(secret: unknown): secret is string {
  return typeof secret === 'string' && secret.trim().length >= MIN_SECRET_LENGTH;
}

/**
 * Constant-time buffer comparison to prevent timing leaks.
 */
function timingSafeBufferEqual(a: Buffer | Uint8Array, b: Buffer | Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Promisified scrypt wrapper for key derivation.
 */
function deriveScrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err: any, derivedKey: any) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hashes a password using modern scrypt with a 16-byte cryptographically random salt.
 * 
 * Format: scrypt$N=16384,r=8,p=1$<salt_hex>$<derived_key_hex>
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = randomBytes(16);
  const derivedKey = await deriveScrypt(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a candidate password against a stored hash string.
 * 
 * Supported schemes:
 * 1. Modern scrypt: scrypt$N=...,r=...,p=...$<salt>$<hash> -> returns { valid, needsRehash: false }
 * 2. Legacy SHA-256 (64 hex characters) -> returns { valid, needsRehash: valid } to trigger rehash
 * 3. All other formats, empty strings, or nulls fail closed -> returns { valid: false, needsRehash: false }
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<{ valid: boolean; needsRehash: boolean }> {
  // Fail closed immediately on missing or malformed inputs
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, needsRehash: false };
  }
  if (typeof storedHash !== 'string' || storedHash.trim().length === 0) {
    return { valid: false, needsRehash: false };
  }

  const trimmedHash = storedHash.trim();

  // 1. Modern scrypt format
  if (trimmedHash.startsWith('scrypt$')) {
    const match = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([0-9a-fA-F]+)\$([0-9a-fA-F]+)$/.exec(trimmedHash);
    if (!match) {
      return { valid: false, needsRehash: false };
    }

    const N = parseInt(match[1], 10);
    const r = parseInt(match[2], 10);
    const p = parseInt(match[3], 10);
    const saltHex = match[4];
    const expectedKeyHex = match[5];

    if (!N || !r || !p || saltHex.length === 0 || expectedKeyHex.length === 0) {
      return { valid: false, needsRehash: false };
    }

    try {
      const salt = Buffer.from(saltHex, 'hex');
      const expectedKey = Buffer.from(expectedKeyHex, 'hex');
      const derivedKey = await deriveScrypt(password, salt, expectedKey.length, { N, r, p });
      const valid = timingSafeBufferEqual(derivedKey, expectedKey);
      return { valid, needsRehash: false };
    } catch (err) {
      console.error('Password verification error:', err);
      return { valid: false, needsRehash: false };
    }
  }

  // 2. Legacy SHA-256 format (64-char hex)
  if (/^[0-9a-fA-F]{64}$/.test(trimmedHash)) {
    try {
      const candidateHex = await hashString(password);
      const candidateBuf = Buffer.from(candidateHex, 'hex');
      const storedBuf = Buffer.from(trimmedHash, 'hex');
      const valid = timingSafeBufferEqual(candidateBuf, storedBuf);
      return { valid, needsRehash: valid };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Any unrecognized or unparseable format fails closed
  return { valid: false, needsRehash: false };
}

/**
 * Standard Web Crypto SHA-256 hash for deterministic device/pairing tokens and legacy hash verification.
 */
export async function hashString(value: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * URL-safe Base64 encoder without padding.
 */
function toBase64Url(buffer: Uint8Array | Buffer): string {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * URL-safe Base64 decoder with padding reconstruction and strict character set validation.
 */
function fromBase64Url(str: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(str)) {
    throw new Error('Invalid base64url characters');
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad === 1) throw new Error('Illegal base64url string length');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeJsonBase64Url(obj: unknown): string {
  const jsonStr = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(jsonStr);
  return toBase64Url(bytes);
}

function decodeJsonBase64Url<T = any>(str: string): T {
  const bytes = fromBase64Url(str);
  const jsonStr = new TextDecoder().decode(bytes);
  return JSON.parse(jsonStr);
}

/**
 * Generates an HMAC-SHA256 JWT using Web Crypto standard.
 * 
 * Fails closed if secret is missing or under 32 characters.
 */
export async function createJWT(payload: JWTPayload, secret: string): Promise<string> {
  if (!isSecretValid(secret)) {
    throw new Error(`JWT secret must be a configured string of at least ${MIN_SECRET_LENGTH} characters`);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('JWT payload must be an object');
  }
  if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    throw new Error('JWT payload requires a non-empty string sub');
  }
  if (typeof payload.org !== 'string' || payload.org.trim() === '') {
    throw new Error('JWT payload requires a non-empty string org');
  }
  if (typeof payload.email !== 'string' || payload.email.trim() === '') {
    throw new Error('JWT payload requires a valid email');
  }
  const allowedRoles: CloudRole[] = ['owner', 'accountant', 'manager', 'cashier', 'kitchen', 'waiter'];
  if (!allowedRoles.includes(payload.role)) {
    throw new Error(`JWT payload role must be one of: ${allowedRoles.join(', ')}`);
  }
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw new Error('JWT payload requires a numeric expiration (exp)');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = encodeJsonBase64Url(header);
  const payloadB64 = encodeJsonBase64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  const sigB64 = toBase64Url(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 JWT using Web Crypto standard.
 * 
 * Enforces:
 * - Secret validity (>= 32 chars)
 * - Exact header matching: alg='HS256', typ='JWT'
 * - Cryptographic HMAC signature verification
 * - Non-expired exp timestamp
 * - Strict required claims: sub (string), org (string), email (valid email string), role (CloudRole)
 * 
 * Fails closed by returning null on ANY validation error or tampering attempt.
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    // 1. Secret validation
    if (!isSecretValid(secret)) {
      return null;
    }

    // 2. Token structure check
    if (typeof token !== 'string' || token.trim() === '') {
      return null;
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, sigB64] = parts;
    if (!headerB64 || !payloadB64 || !sigB64) {
      return null;
    }

    // 3. Header decode & strict validation
    let header: any;
    try {
      header = decodeJsonBase64Url(headerB64);
    } catch {
      return null;
    }

    if (!header || typeof header !== 'object' || Array.isArray(header)) {
      return null;
    }

    // Reject unsupported algorithms: ONLY exact 'HS256' is permitted
    if (header.alg !== 'HS256') {
      return null;
    }
    if (typeof header.typ === 'string' && header.typ.toUpperCase() !== 'JWT') {
      return null;
    }

    // 4. Cryptographic signature verification
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signingInput = `${headerB64}.${payloadB64}`;
    let sigBytes: Uint8Array;
    try {
      sigBytes = fromBase64Url(sigB64);
    } catch {
      return null;
    }

    const isValidSig = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(signingInput));
    if (!isValidSig) {
      return null;
    }

    // 5. Payload decode & strict claim schema validation
    let payload: any;
    try {
      payload = decodeJsonBase64Url(payloadB64);
    } catch {
      return null;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    // Subject (sub) claim
    if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
      return null;
    }

    // Organization (org) claim
    if (typeof payload.org !== 'string' || payload.org.trim().length === 0) {
      return null;
    }

    // Email claim
    if (typeof payload.email !== 'string' || payload.email.trim().length === 0 || !payload.email.includes('@')) {
      return null;
    }

    // Role claim
    const validRoles: CloudRole[] = ['owner', 'accountant', 'manager', 'cashier', 'kitchen', 'waiter'];
    if (!validRoles.includes(payload.role)) {
      return null;
    }

    // Expiration (exp) claim
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) {
      return null; // Expired
    }

    // Not Before (nbf) claim if present
    if (payload.nbf !== undefined) {
      if (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf) || payload.nbf > nowSec + 60) {
        return null;
      }
    }

    // Issued At (iat) claim if present
    if (payload.iat !== undefined) {
      if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > nowSec + 300) {
        return null;
      }
    }

    // Branch claim if present
    if (payload.branch !== undefined && payload.branch !== null && typeof payload.branch !== 'string') {
      return null;
    }

    return {
      sub: payload.sub,
      org: payload.org,
      email: payload.email,
      role: payload.role,
      branch: payload.branch || null,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}
