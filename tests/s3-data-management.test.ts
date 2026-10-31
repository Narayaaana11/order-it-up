import request from 'supertest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flo-s3-data-mgmt-test-'));

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

async function run() {
  console.log('Testing S3 Multi-Cloud Compatibility, Data Management & Tenant Segregation...');

  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      throw new Error(`Assertion failed: ${msg}`);
    }
  };

  const { initDatabase, closeDatabase, getDatabase } = await import('../main/db');
  const { startServer, stopServer, getServerPort } = await import('../main/server');
  const {
    amazonS3Service,
    validateTenantId,
    validateDomain,
    validateFilename,
    buildTenantKey,
  } = await import('../main/services/amazon-s3');

  initDatabase();
  await startServer();

  try {
    const port = getServerPort();
    const serverUrl = `http://127.0.0.1:${port}`;

    // --- 1. Unit Tests: Strict Customer Operational Data Segregation & Prefix Validation ---
    console.log('1. Testing Strict Tenant Prefix Hierarchy & Validation...');

    // Valid tenant keys
    const validKey = buildTenantKey('tenant_alpha-01', 'payments', 'invoice-101.json');
    assert(validKey === 'tenants/tenant_alpha-01/payments/invoice-101.json', 'Canonical tenant key built correctly');

    // Reject invalid tenantId with path traversal
    let traversalCaught = false;
    try {
      validateTenantId('../escaped');
    } catch (e: any) {
      traversalCaught = true;
      assert(e.message.includes('Tenant isolation violation'), 'Detected tenant isolation violation in tenantId');
    }
    assert(traversalCaught, 'Path traversal in tenantId was rejected');

    // Reject slashes in tenantId
    let slashCaught = false;
    try {
      validateTenantId('tenant/bravo');
    } catch (e: any) {
      slashCaught = true;
      assert(e.message.includes('Tenant isolation violation'), 'Detected tenant isolation violation on slash');
    }
    assert(slashCaught, 'Slash in tenantId was rejected');

    // Reject path traversal in filename
    let filenameTraversalCaught = false;
    try {
      validateFilename('../../etc/passwd');
    } catch (e: any) {
      filenameTraversalCaught = true;
      assert(e.message.includes('Tenant isolation violation'), 'Detected path traversal in filename');
    }
    assert(filenameTraversalCaught, 'Filename path traversal was rejected');

    // Reject domain traversal
    let domainTraversalCaught = false;
    try {
      validateDomain('../other-domain');
    } catch {
      domainTraversalCaught = true;
    }
    assert(domainTraversalCaught, 'Domain traversal was rejected');

    // --- 2. Unit Tests: Service Multi-Cloud Configuration & Mock Mode ---
    console.log('2. Testing Multi-Cloud Config & Mock Adapter Execution...');

    // Save multi-cloud config with custom endpoint, path-style addressing, and mock mode
    amazonS3Service.saveConfig({
      region: 'us-east-1',
      bucketName: 'order-it-up-cloud-storage',
      accessKeyId: 'MINIO_ADMIN_KEY',
      secretAccessKey: 'MINIO_SECRET_ACCESS_KEY',
      endpoint: 'http://127.0.0.1:9000',
      forcePathStyle: true,
      mockMode: true,
      retentionDays: 45,
      enabled: true,
    });

    const activeConfig = amazonS3Service.getConfig();
    assert(activeConfig.bucketName === 'order-it-up-cloud-storage', 'Bucket name configured');
    assert(activeConfig.endpoint === 'http://127.0.0.1:9000', 'Custom endpoint preserved');
    assert(activeConfig.forcePathStyle === true, 'forcePathStyle set to true');
    assert(activeConfig.mockMode === true, 'mockMode enabled');
    assert(activeConfig.retentionDays === 45, 'retentionDays set to 45');
    assert(activeConfig.retention === 45, 'backward-compatible retention alias matches');

    // Test connection with mock adapter
    const testConn = await amazonS3Service.testConnection();
    assert(testConn.success === true, 'Mock adapter connection test succeeds');
    assert(testConn.message.includes('Mock S3'), 'Mock adapter message indicated');

    // --- 3. Multi-Domain Storage Operations ---
    console.log('3. Testing Multi-Domain Storage Operations (Releases, Users, Payments, Media, Backups)...');

    // 3a. Platform Release
    const releaseRes = await amazonS3Service.uploadPlatformRelease(
      '1.2.0',
      'order-it-up-Setup-1.2.0.exe',
      Buffer.from('binary-installer-data-mock'),
      'application/x-msdownload'
    );
    assert(releaseRes.success === true, 'Platform release upload succeeded');
    assert(releaseRes.key === 'platform/releases/order-it-up-Setup-1.2.0.exe', 'Key matches platform/releases/ prefix');

    // 3b. User Account Archive for Tenant A
    const userArchiveRes = await amazonS3Service.uploadUserAccountArchive(
      'tenant-A',
      'users-audit-20261031.json',
      { tenant: 'tenant-A', users: [{ id: 'u1', role: 'owner' }, { id: 'u2', role: 'cashier' }] }
    );
    assert(userArchiveRes.success === true, 'User archive upload succeeded');
    assert(userArchiveRes.key === 'tenants/tenant-A/users/users-audit-20261031.json', 'Key strictly segregated to tenant-A users');

    // 3c. Payment Record for Tenant A
    const paymentRes = await amazonS3Service.uploadPaymentRecord(
      'tenant-A',
      'z-closure-20261031.json',
      { date: '2026-10-31', totalCollected: 125000, tender: { cash: 50000, card: 75000 } }
    );
    assert(paymentRes.success === true, 'Payment record upload succeeded');
    assert(paymentRes.key === 'tenants/tenant-A/payments/z-closure-20261031.json', 'Key strictly segregated to tenant-A payments');

    // 3d. Media Asset for Tenant A
    const mediaRes = await amazonS3Service.uploadMediaAsset(
      'tenant-A',
      'products',
      'biryani.png',
      Buffer.from('image-png-bytes'),
      'image/png'
    );
    assert(mediaRes.success === true, 'Media asset upload succeeded');
    assert(mediaRes.key === 'tenants/tenant-A/media/products/biryani.png', 'Key strictly segregated to tenant-A media products');

    // 3e. Database Backup for Tenant A
    const backupRes = await amazonS3Service.uploadDatabaseBackup(
      'tenant-A',
      '2026-10-31T12-00-00',
      Buffer.from('sqlite-database-bytes')
    );
    assert(backupRes.success === true, 'Database backup upload succeeded');
    assert(backupRes.key === 'tenants/tenant-A/backups/order-it-up-2026-10-31T12-00-00.db', 'Key strictly segregated to tenant-A backups');

    // 3f. Tenant Isolation: Create object for Tenant B
    await amazonS3Service.uploadPaymentRecord(
      'tenant-B',
      'z-closure-20261031.json',
      { date: '2026-10-31', totalCollected: 30000, tenant: 'tenant-B' }
    );

    // 3g. List Tenant Objects - Tenant A should only see its own objects
    const tenantAObjects = await amazonS3Service.listTenantObjects('tenant-A');
    assert(tenantAObjects.length === 4, `Tenant A has 4 objects, received ${tenantAObjects.length}`);
    for (const obj of tenantAObjects) {
      assert(obj.key.startsWith('tenants/tenant-A/'), `Object ${obj.key} strictly belongs to tenant-A`);
      assert(!obj.key.includes('tenant-B'), `Object ${obj.key} does not bleed into tenant-B`);
    }

    // List filtered by domain
    const tenantAPayments = await amazonS3Service.listTenantObjects('tenant-A', 'payments');
    assert(tenantAPayments.length === 1, 'Domain filter for payments returned 1 object');
    assert(tenantAPayments[0].filename === 'z-closure-20261031.json', 'Filtered payment filename matches');

    // 3h. Tenant Storage Metrics
    const tenantAMetrics = await amazonS3Service.getTenantStorageMetrics('tenant-A');
    assert(tenantAMetrics.tenantId === 'tenant-A', 'Metrics for tenant-A');
    assert(tenantAMetrics.objectCount === 4, '4 objects tracked in metrics');
    assert(tenantAMetrics.byDomain.payments.count === 1, '1 payment object in domain breakdown');
    assert(tenantAMetrics.byDomain.users.count === 1, '1 user object in domain breakdown');
    assert(tenantAMetrics.byDomain.media.count === 1, '1 media object in domain breakdown');
    assert(tenantAMetrics.byDomain.backups.count === 1, '1 backup object in domain breakdown');

    // --- 4. Offline Resilience & Outbox Queue ---
    console.log('4. Testing Offline Outbox Queue & Replay...');

    const outboxItem = amazonS3Service.enqueueOutbox({
      tenantId: 'tenant-A',
      key: 'tenants/tenant-A/payments/offline-txn-001.json',
      domain: 'payments',
      payload: Buffer.from(JSON.stringify({ offline: true, id: 'tx-001' })).toString('base64'),
      contentType: 'application/json',
    });
    assert(Boolean(outboxItem.id), 'Outbox item generated unique ID');
    assert(outboxItem.status === 'pending', 'Outbox item initialized with pending status');

    const outboxStatus = amazonS3Service.getOutboxStatus();
    assert(outboxStatus.pendingCount >= 1, 'Outbox reports pending items');

    const processResult = await amazonS3Service.processOutbox();
    assert(processResult.processed >= 1, 'Process outbox flushed pending item');

    // Verify flushed object now exists in storage
    const reloadedPayments = await amazonS3Service.listTenantObjects('tenant-A', 'payments');
    const flushedItem = reloadedPayments.find((p) => p.filename === 'offline-txn-001.json');
    assert(Boolean(flushedItem), 'Flushed outbox item was stored in mock S3 bucket');

    // --- 5. Express API Routes Integration & Role Guards ---
    console.log('5. Testing S3 Express Routes & Tenant Isolation Endpoints...');

    // Seed Owner and Cashier users
    const db = getDatabase();
    const bcrypt = require('bcryptjs');
    const hashedOwner = bcrypt.hashSync('OwnerPass123!', 10);
    const hashedCashier = bcrypt.hashSync('CashierPass123!', 10);

    db.prepare(`
      INSERT INTO users (id, name, email, password, role, is_active)
      VALUES 
        ('user-owner-s3-m4', 'Owner S3', 'owner-s3-m4@orderitup.local', ?, 'owner', 1),
        ('user-cashier-s3-m4', 'Cashier S3', 'cashier-s3-m4@orderitup.local', ?, 'cashier', 1)
    `).run(hashedOwner, hashedCashier);

    const ownerLogin = await request(serverUrl)
      .post('/api/auth/login')
      .send({ email: 'owner-s3-m4@orderitup.local', password: 'OwnerPass123!' });
    const ownerToken = ownerLogin.body.access_token;

    const cashierLogin = await request(serverUrl)
      .post('/api/auth/login')
      .send({ email: 'cashier-s3-m4@orderitup.local', password: 'CashierPass123!' });
    const cashierToken = cashierLogin.body.access_token;

    // 5a. GET /api/s3/status returns multi-cloud fields
    const statusRes = await request(serverUrl)
      .get('/api/s3/status')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert(statusRes.status === 200, 'Status route returned 200');
    assert(statusRes.body.status.endpoint === 'http://127.0.0.1:9000', 'Status includes custom endpoint');
    assert(statusRes.body.status.forcePathStyle === true, 'Status includes forcePathStyle');
    assert(statusRes.body.status.mockMode === true, 'Status includes mockMode');

    // 5b. POST /api/s3/settings updates multi-cloud settings
    const updateSettingsRes = await request(serverUrl)
      .post('/api/s3/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        region: 'ap-south-1',
        bucketName: 'order-it-up-mumbai',
        endpoint: 'https://r2.cloudflarestorage.com',
        forcePathStyle: false,
        mockMode: true,
        retentionDays: 60,
      });
    assert(updateSettingsRes.status === 200, 'Settings update returned 200');
    assert(updateSettingsRes.body.status.bucketName === 'order-it-up-mumbai', 'Bucket name updated');
    assert(updateSettingsRes.body.status.endpoint === 'https://r2.cloudflarestorage.com', 'Endpoint updated');
    assert(updateSettingsRes.body.status.retentionDays === 60, 'Retention updated to 60');

    // 5c. POST /api/s3/platform/release
    const platformUploadRes = await request(serverUrl)
      .post('/api/s3/platform/release')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        version: '2.0.0',
        filename: 'order-it-up-v2.0.0.exe',
        content: 'installer-binary-payload',
        contentType: 'application/octet-stream',
      });
    assert(platformUploadRes.status === 200, 'Platform release API upload succeeded');
    assert(platformUploadRes.body.result.key === 'platform/releases/order-it-up-v2.0.0.exe', 'Platform release key confirmed');

    // 5d. POST /api/s3/tenants/:tenantId/payments - Accessible by Cashier & Manager
    const paymentApiRes = await request(serverUrl)
      .post('/api/s3/tenants/store-001/payments')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        filename: 'shift-closure-1.json',
        data: { shift: 1, cashier: 'Cashier S3', totalCash: 45000 },
      });
    assert(paymentApiRes.status === 200, 'Cashier can upload payment record to S3');
    assert(paymentApiRes.body.result.key === 'tenants/store-001/payments/shift-closure-1.json', 'Key segregated to store-001');

    // 5e. Tenant Isolation Violation via API: Attempt path traversal in filename -> returns 403 Forbidden
    const illegalPathRes = await request(serverUrl)
      .post('/api/s3/tenants/store-001/payments')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        filename: '../../malicious-escape.json',
        data: { hack: true },
      });
    assert(illegalPathRes.status === 403, `Illegal path traversal rejected with 403 Forbidden (got ${illegalPathRes.status})`);
    assert(illegalPathRes.body.ok === false, 'ok is false on violation');
    assert(illegalPathRes.body.error.includes('Tenant isolation violation'), 'Violation error message returned');

    // 5f. GET /api/s3/tenants/:tenantId/metrics
    const metricsApiRes = await request(serverUrl)
      .get('/api/s3/tenants/store-001/metrics')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert(metricsApiRes.status === 200, 'Metrics API returned 200');
    assert(metricsApiRes.body.metrics.tenantId === 'store-001', 'Metrics for store-001');
    assert(metricsApiRes.body.metrics.objectCount >= 1, 'Object count tracked');

    // 5g. GET /api/s3/outbox
    const outboxApiRes = await request(serverUrl)
      .get('/api/s3/outbox')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert(outboxApiRes.status === 200, 'Outbox API returned 200');
    assert(typeof outboxApiRes.body.outbox.pendingCount === 'number', 'Outbox pendingCount is number');

    console.log('ALL S3 MULTI-CLOUD, DATA MANAGEMENT & TENANT SEGREGATION TESTS PASSED CLEANLY!');
  } finally {
    amazonS3Service.stop();
    await stopServer();
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
