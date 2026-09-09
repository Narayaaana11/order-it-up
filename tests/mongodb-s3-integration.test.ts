import request from 'supertest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-mongo-s3-test-'));

Module._load = function (requestName: string, parent: unknown, isMain: boolean) {
  if (requestName === 'electron') {
    return {
      app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' },
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: (str: string) => Buffer.from(str),
        decryptString: (buf: Buffer) => buf.toString(),
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

import { startServer, stopServer, getServerPort } from '../main/server';
import { initDatabase, closeDatabase, getDatabase } from '../main/db';

async function run() {
  console.log('Testing MongoDB and Amazon S3 Integration Endpoints...');

  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      throw new Error(`Assertion failed: ${msg}`);
    }
  };

  initDatabase();
  await startServer();

  try {
    const port = getServerPort();
    const serverUrl = `http://127.0.0.1:${port}`;

    // 1. Seed owner user
    const db = getDatabase();
    const bcrypt = require('bcryptjs');
    const hashed = bcrypt.hashSync('OwnerPass123!', 10);
    db.prepare(`
      INSERT INTO users (id, name, email, password, role, is_active)
      VALUES ('user-owner-mongo-s3', 'Owner Test', 'owner-s3@orderitup.local', ?, 'owner', 1)
    `).run(hashed);

    // 2. Login to get token
    const loginRes = await request(serverUrl)
      .post('/api/auth/login')
      .send({ email: 'owner-s3@orderitup.local', password: 'OwnerPass123!' });

    assert(loginRes.status === 200, 'Owner login succeeded');
    const token = loginRes.body.access_token;
    assert(Boolean(token), 'Access token present');

    // 3. Test MongoDB status endpoint (unauthenticated should fail with 401)
    const unauthedMongo = await request(serverUrl).get('/api/mongodb/status');
    assert(unauthedMongo.status === 401, 'MongoDB status requires authentication');

    // 4. Test MongoDB status endpoint (authenticated)
    const mongoStatus = await request(serverUrl)
      .get('/api/mongodb/status')
      .set('Authorization', `Bearer ${token}`);
    assert(mongoStatus.status === 200, 'Authenticated MongoDB status succeeds');
    assert(mongoStatus.body.status.dbName === 'orderitup', 'Default MongoDB dbName is orderitup');
    assert(mongoStatus.body.status.connected === false, 'Initially not connected to MongoDB');

    // 5. Test MongoDB settings save
    const saveMongo = await request(serverUrl)
      .post('/api/mongodb/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        uri: 'mongodb://localhost:27017',
        dbName: 'orderitup_test',
        enabled: false,
      });
    assert(saveMongo.status === 200, 'Save MongoDB settings succeeds');
    assert(saveMongo.body.status.dbName === 'orderitup_test', 'Updated dbName matches');

    // 6. Test MongoDB connection test with dummy uri
    const testMongo = await request(serverUrl)
      .post('/api/mongodb/test-connection')
      .set('Authorization', `Bearer ${token}`)
      .send({ uri: 'mongodb://127.0.0.1:9999/nonexistent' });
    assert(testMongo.status === 200, 'Test connection returns 200 response');
    assert(testMongo.body.success === false, 'Test connection against dummy port correctly returns success: false');

    // 7. Test Amazon S3 status endpoint (unauthenticated should fail with 401)
    const unauthedS3 = await request(serverUrl).get('/api/s3/status');
    assert(unauthedS3.status === 401, 'S3 status requires authentication');

    // 8. Test Amazon S3 status endpoint (authenticated)
    const s3Status = await request(serverUrl)
      .get('/api/s3/status')
      .set('Authorization', `Bearer ${token}`);
    assert(s3Status.status === 200, 'Authenticated S3 status succeeds');
    assert(typeof s3Status.body.status.configured === 'boolean', 'S3 configured field is boolean');
    assert(s3Status.body.status.configured === false, 'Initially S3 is not configured');

    // 9. Test Amazon S3 settings save
    const saveS3 = await request(serverUrl)
      .post('/api/s3/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        region: 'us-west-2',
        bucketName: 'order-it-up-test-bucket',
        accessKeyId: 'AKIA_TEST_KEY',
        secretAccessKey: 'TEST_SECRET_KEY',
        enabled: false,
        retention: 14,
      });
    assert(saveS3.status === 200, 'Save S3 settings succeeds');
    const s3StatusUpdated = await request(serverUrl)
      .get('/api/s3/status')
      .set('Authorization', `Bearer ${token}`);
    assert(s3StatusUpdated.body.status.bucketName === 'order-it-up-test-bucket', 'Saved S3 bucket matches');
    assert(s3StatusUpdated.body.status.region === 'us-west-2', 'Saved S3 region matches');
    assert(s3StatusUpdated.body.status.retention === 14, 'Saved S3 retention matches');

    // 10. Test Amazon S3 backups list when not connected / invalid
    const s3Backups = await request(serverUrl)
      .get('/api/s3/backups')
      .set('Authorization', `Bearer ${token}`);
    assert(s3Backups.status === 500 || s3Backups.status === 400 || s3Backups.status === 200, 'S3 backups list responds');

    console.log('ALL MONGODB AND AMAZON S3 INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    await stopServer();
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
