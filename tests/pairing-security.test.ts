/**
 * Regression and Verification Test Suite: Terminal Pairing Security Hardening
 * Tests unauthenticated claim limits, single-use burning, attempt bounding, and branch isolation.
 */

import assert from 'node:assert/strict';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { cloudHqRoutes, activePairingSessions, resetPairingStore, pairClaimAttempts } from '../main/routes/cloud-hq';

function createApp() {
  const app = express();
  app.use(express.json());

  // Emulate server.ts normalized authentication barrier
  app.use((req: Request, res: Response, next: NextFunction) => {
    const normalizedPath = req.path.toLowerCase().replace(/\/+$/, '');
    // Only POST requests to the pairing claim endpoints bypass Bearer auth
    if (req.method === 'POST' && (normalizedPath === '/api/pos/pair' || normalizedPath === '/api/cloud/pair' || normalizedPath === '/api/cloud/pair/claim')) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer authed-owner-token')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    (req as any).user = { role: 'owner', userId: 'usr-owner-1' };
    next();
  });

  app.use('/api/cloud', cloudHqRoutes);
  app.post('/api/pos/pair', (req, res, next) => {
    req.url = '/pair';
    cloudHqRoutes(req, res, next);
  });

  return app;
}

async function testPairingSecurity(): Promise<void> {
  console.log('================================================================');
  console.log('  TERMINAL PAIRING SECURITY & AUTHENTICATION BYPASS AUDIT');
  console.log('================================================================\n');

  const app = createApp();

  // 1. Boundary & HTTP Method Verification
  console.log('🧪 [Test 1/6] Unauthenticated Endpoint Boundaries & Method Guarding...');
  
  // GET on /api/cloud/pair must be rejected (401)
  const getPairRes = await request(app).get('/api/cloud/pair');
  assert.equal(getPairRes.status, 401, 'GET /api/cloud/pair must require authentication');

  // POST on /api/cloud/pair/generate must require authentication (401)
  const unauthedGen = await request(app).post('/api/cloud/pair/generate').send({ branch_id: 'br-02' });
  assert.equal(unauthedGen.status, 401, 'POST /api/cloud/pair/generate must require authentication');

  // Other cloud endpoints must require authentication
  const overviewRes = await request(app).get('/api/cloud/overview');
  assert.equal(overviewRes.status, 401, 'GET /api/cloud/overview must require authentication');
  console.log('  ✓ Unauthenticated exemptions strictly limited to POST claim endpoints');

  // 2. PIN Generation & Valid Claim
  console.log('🧪 [Test 2/6] Cryptographic PIN Generation & Scoped Terminal Enrollment...');
  resetPairingStore();

  const genRes = await request(app)
    .post('/api/cloud/pair/generate')
    .set('Authorization', 'Bearer authed-owner-token')
    .send({ branch_id: 'br-03', terminal_name: 'Patio Tablet' });
  assert.equal(genRes.status, 200);
  assert.equal(genRes.body.success, true);
  assert.equal(genRes.body.branch_id, 'br-03');
  assert.equal(genRes.body.terminal_name, 'Patio Tablet');
  
  const rawCode = genRes.body.code.replace(/\D/g, '');
  assert.equal(rawCode.length, 6, 'Generated code must have 6 digits');

  // Claim with generated code via unauthenticated POST /api/cloud/pair/claim
  const claimRes = await request(app)
    .post('/api/cloud/pair/claim')
    .send({ code: genRes.body.code });
  assert.equal(claimRes.status, 200);
  assert.equal(claimRes.body.success, true);
  assert.equal(claimRes.body.branch_id, 'br-03', 'Must be bound to branch specified at generation');
  assert.equal(claimRes.body.terminal_name, 'Patio Tablet');
  assert.ok(claimRes.body.token.includes('br-03'));
  console.log('  ✓ Cryptographic PIN generation and correctly scoped terminal enrollment verified');

  // 3. Single-Use Burning & Replay Prevention
  console.log('🧪 [Test 3/6] Single-Use Burning & Replay Prevention...');
  const replayRes = await request(app)
    .post('/api/cloud/pair/claim')
    .send({ code: genRes.body.code });
  assert.equal(replayRes.status, 404, 'Claimed code must be burned and rejected on replay');
  console.log('  ✓ Single-use burning prevents replay attacks');

  // 4. Input Sanitization & Expiration Check
  console.log('🧪 [Test 4/6] Input Sanitization & Expiration Enforcement...');
  const shortPinRes = await request(app)
    .post('/api/cloud/pair/claim')
    .send({ code: '123' });
  assert.equal(shortPinRes.status, 400);

  const nonExistentRes = await request(app)
    .post('/api/cloud/pair/claim')
    .send({ code: '999888' });
  assert.equal(nonExistentRes.status, 404);

  // Seed expired token
  activePairingSessions.set('777666', {
    code: '777666',
    branchId: 'br-01',
    terminalName: 'Expired Tablet',
    attempts: 0,
    claimed: false,
    expiresAt: Date.now() - 1000, // Expired 1 second ago
    createdAt: Date.now() - 60000,
  });

  const expiredRes = await request(app)
    .post('/api/cloud/pair/claim')
    .send({ code: '777 666' });
  assert.equal(expiredRes.status, 410, 'Expired token must return HTTP 410');
  console.log('  ✓ Input format checks and expiration enforcement verified');

  // 5. Code Attempt Bounding (Max 5 attempts)
  console.log('🧪 [Test 5/6] Code Attempt Bounding (Max 5 Attempts)...');
  activePairingSessions.set('555444', {
    code: '555444',
    branchId: 'br-01',
    terminalName: 'Attacked Tablet',
    attempts: 5, // Already reached max attempts
    claimed: false,
    expiresAt: Date.now() + 600000,
    createdAt: Date.now(),
  });

  const boundedRes = await request(app)
    .post('/api/cloud/pair/claim')
    .send({ code: '555 444' });
  assert.equal(boundedRes.status, 429, 'Over-attempted code must be burned and return HTTP 429');
  console.log('  ✓ Maximum attempt limit per code enforced');

  // 6. IP Brute-Force Rate Limiting (10 attempts / 5 minutes)
  console.log('🧪 [Test 6/6] IP Brute-Force Throttling...');
  resetPairingStore();

  // Simulate 10 failed attempts
  for (let i = 0; i < 10; i++) {
    await request(app).post('/api/cloud/pair/claim').send({ code: '111111' });
  }

  // 11th attempt must be throttled with HTTP 429
  const throttledRes = await request(app).post('/api/cloud/pair/claim').send({ code: '111111' });
  assert.equal(throttledRes.status, 429, 'Excessive failed pairing attempts must be throttled');
  assert.ok(throttledRes.headers['retry-after'], 'Throttled response must include Retry-After header');
  console.log('  ✓ IP brute-force protection with Retry-After header verified');

  console.log('\n================================================================');
  console.log('✅ ALL TERMINAL PAIRING SECURITY TESTS PASSED!');
  console.log('================================================================');
}

testPairingSecurity().catch(err => {
  console.error('\n❌ PAIRING TEST FAILED:', err);
  process.exit(1);
});
