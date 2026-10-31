import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import log from 'electron-log';
import { safeStorage, app } from 'electron';
import { getDatabase, now, createBackup } from '../db';

export interface S3ServiceConfig {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;        // Support custom endpoints (Cloudflare R2, MinIO, Wasabi, LocalStack)
  forcePathStyle?: boolean; // Support path-style addressing for MinIO/LocalStack
  enabled: boolean;
  retentionDays: number;
  mockMode?: boolean;       // Enable local filesystem mock adapter when offline or credentials omitted
  retention?: number;       // Compatibility alias for retentionDays
}

export type S3Config = S3ServiceConfig;

export interface S3BackupEntry {
  key: string;
  filename: string;
  size: number;
  lastModified: string;
}

export interface S3ObjectEntry {
  key: string;
  filename: string;
  size: number;
  lastModified: string;
  domain?: string;
  tenantId?: string;
}

export interface TenantStorageMetrics {
  tenantId: string;
  totalSize: number;
  objectCount: number;
  byDomain: Record<string, { count: number; size: number }>;
}

export interface OutboxItem {
  id: string;
  tenantId?: string;
  key: string;
  domain: string;
  payload: string; // Base64 encoded payload
  contentType?: string;
  status: 'pending' | 'processing' | 'failed' | 'uploaded';
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_RETENTION = 30;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly check

function getMockStorageDir(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'mock-s3');
    }
  } catch {
    // ignore
  }
  return path.join(process.cwd(), '.mock-s3');
}

async function streamOrInputToBuffer(input: Buffer | NodeJS.ReadableStream | string): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    input.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    input.on('error', reject);
    input.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function normalizePayload(data: Buffer | string | Record<string, unknown>): { buffer: Buffer; contentType: string } {
  if (Buffer.isBuffer(data)) {
    return { buffer: data, contentType: 'application/octet-stream' };
  }
  if (typeof data === 'string') {
    return { buffer: Buffer.from(data, 'utf8'), contentType: 'text/plain; charset=utf-8' };
  }
  if (typeof data === 'object' && data !== null) {
    return { buffer: Buffer.from(JSON.stringify(data, null, 2), 'utf8'), contentType: 'application/json' };
  }
  return { buffer: Buffer.from(String(data), 'utf8'), contentType: 'text/plain' };
}

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toLowerCase();
  const name = String(err.name || '').toLowerCase();
  return (
    code === 'econnrefused' ||
    code === 'enotfound' ||
    code === 'etimedout' ||
    code === 'econnreset' ||
    code === 'enetunreach' ||
    name.includes('timeout') ||
    name.includes('network') ||
    msg.includes('network') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('socket connection timeout')
  );
}

// Validation helpers strictly preventing tenant isolation violations
export function validateTenantId(tenantId: string): string {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Tenant isolation violation: Invalid or missing tenant identifier');
  }
  const clean = tenantId.trim();
  if (!clean || !/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error(`Tenant isolation violation: Tenant ID "${tenantId}" contains illegal characters or path traversal`);
  }
  return clean;
}

export function validateDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    throw new Error('Invalid storage domain: Domain must be a non-empty string');
  }
  const clean = domain.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error(`Invalid storage domain: Domain "${domain}" contains illegal characters`);
  }
  return clean;
}

export function validateFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename: Filename must be a non-empty string');
  }
  const clean = filename.trim();
  const normalized = clean.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('./')) {
    throw new Error(`Tenant isolation violation: Filename "${filename}" contains path traversal sequence`);
  }
  return normalized;
}

export function buildTenantKey(tenantId: string, domain: string, filename: string, subfolder?: string): string {
  const cleanTenant = validateTenantId(tenantId);
  const cleanDomain = validateDomain(domain);
  const cleanSub = subfolder ? `${validateDomain(subfolder)}/` : '';
  const cleanFilename = validateFilename(filename);
  const expectedPrefix = `tenants/${cleanTenant}/`;
  const key = `${expectedPrefix}${cleanDomain}/${cleanSub}${cleanFilename}`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error(`Tenant isolation violation: Key "${key}" escapes tenant "${cleanTenant}"`);
  }
  return key;
}

export class AmazonS3Service {
  private client: S3Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isUploading = false;
  private inMemoryOutbox: OutboxItem[] = [];

  constructor() {
    this.ensureOutboxTable();
  }

  private ensureOutboxTable(): void {
    try {
      const db = getDatabase();
      db.exec(`
        CREATE TABLE IF NOT EXISTS s3_upload_outbox (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          key TEXT NOT NULL,
          domain TEXT NOT NULL,
          payload TEXT NOT NULL,
          content_type TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    } catch {
      // Database not ready or running outside DB context
    }
  }

  /** Read configuration from settings table */
  public getConfig(): S3ServiceConfig {
    let db;
    try {
      db = getDatabase();
    } catch {
      const envRetention = Number(process.env.AWS_S3_RETENTION) || DEFAULT_RETENTION;
      return {
        region: process.env.AWS_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET_NAME || '',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        endpoint: process.env.AWS_S3_ENDPOINT || undefined,
        forcePathStyle: (process.env.AWS_S3_FORCE_PATH_STYLE || 'false') === 'true',
        enabled: false,
        retentionDays: envRetention,
        retention: envRetention,
        mockMode: (process.env.AWS_S3_MOCK_MODE || 'false') === 'true',
      };
    }

    const rows = db.prepare(`
      SELECT key, value FROM settings 
      WHERE key IN (
        's3_region', 's3_bucket_name', 's3_access_key_id', 's3_secret_access_key', 
        's3_backup_enabled', 's3_retention', 's3_endpoint', 's3_force_path_style', 's3_mock_mode'
      )
    `).all() as { key: string; value: string }[];

    const map = new Map(rows.map((r) => [r.key, r.value]));

    let secretKey = map.get('s3_secret_access_key') || process.env.AWS_SECRET_ACCESS_KEY || '';
    if (secretKey && safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
      try {
        const decrypted = safeStorage.decryptString(Buffer.from(secretKey, 'base64'));
        if (decrypted) secretKey = decrypted;
      } catch {
        // Fall back to raw string if not encrypted
      }
    }

    const retentionDays = Number(map.get('s3_retention')) || DEFAULT_RETENTION;
    const mockMode = (map.get('s3_mock_mode') || process.env.AWS_S3_MOCK_MODE || 'false') === 'true';

    return {
      region: map.get('s3_region') || process.env.AWS_REGION || 'us-east-1',
      bucketName: map.get('s3_bucket_name') || process.env.AWS_S3_BUCKET_NAME || '',
      accessKeyId: map.get('s3_access_key_id') || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: secretKey,
      endpoint: map.get('s3_endpoint') || process.env.AWS_S3_ENDPOINT || undefined,
      forcePathStyle: (map.get('s3_force_path_style') || process.env.AWS_S3_FORCE_PATH_STYLE || 'false') === 'true',
      enabled: (map.get('s3_backup_enabled') || 'false') === 'true',
      retentionDays,
      retention: retentionDays,
      mockMode,
    };
  }

  /** Save new S3 settings */
  public saveConfig(config: Partial<S3ServiceConfig>): void {
    const db = getDatabase();
    const current = this.getConfig();
    const merged: S3ServiceConfig = {
      ...current,
      ...config,
      retentionDays: config.retentionDays ?? config.retention ?? current.retentionDays,
    };

    let storedSecret = merged.secretAccessKey;
    if (storedSecret && safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
      try {
        storedSecret = safeStorage.encryptString(storedSecret).toString('base64');
      } catch (err) {
        log.warn('[S3] SafeStorage encryption failed, storing raw:', err);
      }
    }

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    const timestamp = now();
    db.transaction(() => {
      upsert.run('s3_region', merged.region, timestamp);
      upsert.run('s3_bucket_name', merged.bucketName, timestamp);
      upsert.run('s3_access_key_id', merged.accessKeyId, timestamp);
      upsert.run('s3_secret_access_key', storedSecret, timestamp);
      upsert.run('s3_backup_enabled', String(merged.enabled), timestamp);
      upsert.run('s3_retention', String(merged.retentionDays), timestamp);
      if (merged.endpoint !== undefined) {
        upsert.run('s3_endpoint', merged.endpoint || '', timestamp);
      }
      if (merged.forcePathStyle !== undefined) {
        upsert.run('s3_force_path_style', String(Boolean(merged.forcePathStyle)), timestamp);
      }
      if (merged.mockMode !== undefined) {
        upsert.run('s3_mock_mode', String(Boolean(merged.mockMode)), timestamp);
      }
    })();

    this.initFromSettings();
  }

  /** Reinitialize client instance */
  public initFromSettings(): void {
    const config = this.getConfig();
    const hasCreds = Boolean(config.region && config.bucketName && config.accessKeyId && config.secretAccessKey);

    if (config.mockMode) {
      this.client = null;
      log.info('[S3] Running in Mock Mode: Local filesystem adapter active');
    } else if (hasCreds) {
      try {
        this.client = new S3Client({
          region: config.region,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          endpoint: config.endpoint?.trim() || undefined,
          forcePathStyle: Boolean(config.forcePathStyle),
        });
        log.info(
          `[S3] Client configured for bucket: ${config.bucketName} (region: ${config.region}, endpoint: ${config.endpoint || 'AWS Default'}, pathStyle: ${Boolean(config.forcePathStyle)})`
        );
      } catch (error) {
        log.error('[S3] Failed to initialize client:', error);
        this.client = null;
      }
    } else {
      this.client = null;
    }

    this.restartScheduler();
  }

  /** Test S3 connection with provided or existing credentials */
  public async testConnection(customConfig?: Partial<S3ServiceConfig>): Promise<{ success: boolean; message: string }> {
    const config = { ...this.getConfig(), ...customConfig };

    if (config.mockMode) {
      this.headMockBucket(config.bucketName || 'mock-bucket');
      return {
        success: true,
        message: `Mock S3 storage operational at local filesystem (${config.bucketName || 'mock-bucket'}).`,
      };
    }

    if (!config.region || !config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
      return { success: false, message: 'All S3 fields (Region, Bucket Name, Access Key ID, Secret Key) are required.' };
    }

    const testClient = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint?.trim() || undefined,
      forcePathStyle: Boolean(config.forcePathStyle),
    });

    try {
      await testClient.send(new HeadBucketCommand({ Bucket: config.bucketName }));
      return { success: true, message: `Successfully connected to S3 bucket "${config.bucketName}".` };
    } catch (err: any) {
      log.error('[S3] Connection test failed:', err);
      return { success: false, message: `S3 connection test failed: ${err.message || err}` };
    }
  }

  // --- Local Filesystem Mock Storage Adapter ---

  private writeMockObject(bucketName: string, key: string, data: Buffer, metadata?: Record<string, string>): void {
    const baseDir = path.join(getMockStorageDir(), bucketName || 'mock-bucket');
    const normalizedKey = key.replace(/\\/g, '/');
    const targetPath = path.join(baseDir, ...normalizedKey.split('/'));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, data);
    if (metadata) {
      fs.writeFileSync(`${targetPath}.meta.json`, JSON.stringify(metadata, null, 2), 'utf8');
    }
  }

  private listMockObjects(bucketName: string, prefix: string): S3ObjectEntry[] {
    const baseDir = path.join(getMockStorageDir(), bucketName || 'mock-bucket');
    const normalizedPrefix = prefix.replace(/\\/g, '/');
    const results: S3ObjectEntry[] = [];

    function scan(currentDir: string) {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
          const relKey = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const stats = fs.statSync(fullPath);
          results.push({
            key: relKey,
            filename: entry.name,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
          });
        }
      }
    }

    if (fs.existsSync(baseDir)) {
      scan(baseDir);
    }

    return results
      .filter((item) => item.key.startsWith(normalizedPrefix))
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  }

  private deleteMockObject(bucketName: string, key: string): boolean {
    const baseDir = path.join(getMockStorageDir(), bucketName || 'mock-bucket');
    const normalizedKey = key.replace(/\\/g, '/');
    const targetPath = path.join(baseDir, ...normalizedKey.split('/'));
    let deleted = false;
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      deleted = true;
    }
    if (fs.existsSync(`${targetPath}.meta.json`)) {
      fs.unlinkSync(`${targetPath}.meta.json`);
    }
    return deleted;
  }

  private headMockBucket(bucketName: string): boolean {
    const baseDir = path.join(getMockStorageDir(), bucketName || 'mock-bucket');
    fs.mkdirSync(baseDir, { recursive: true });
    return true;
  }

  // --- Offline Outbox Queue ---

  public enqueueOutbox(item: {
    tenantId?: string;
    key: string;
    domain: string;
    payload: string;
    contentType?: string;
  }): OutboxItem {
    this.ensureOutboxTable();
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const outboxItem: OutboxItem = {
      id,
      tenantId: item.tenantId,
      key: item.key,
      domain: item.domain,
      payload: item.payload,
      contentType: item.contentType || 'application/octet-stream',
      status: 'pending',
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO s3_upload_outbox (id, tenant_id, key, domain, payload, content_type, status, attempts, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
      `).run(
        outboxItem.id,
        outboxItem.tenantId || null,
        outboxItem.key,
        outboxItem.domain,
        outboxItem.payload,
        outboxItem.contentType || 'application/octet-stream',
        outboxItem.createdAt,
        outboxItem.updatedAt
      );
    } catch {
      this.inMemoryOutbox.push(outboxItem);
    }

    log.warn(`[S3] Enqueued offline outbox item ${id} for key: ${item.key}`);
    return outboxItem;
  }

  public getOutboxStatus(): { pendingCount: number; failedCount: number; items: OutboxItem[] } {
    this.ensureOutboxTable();
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, tenant_id as tenantId, key, domain, payload, content_type as contentType, status, attempts, last_error as lastError, created_at as createdAt, updated_at as updatedAt
        FROM s3_upload_outbox
        ORDER BY created_at DESC
        LIMIT 100
      `).all() as OutboxItem[];

      const pendingCount = rows.filter((r) => r.status === 'pending').length;
      const failedCount = rows.filter((r) => r.status === 'failed').length;
      return { pendingCount, failedCount, items: rows };
    } catch {
      const pendingCount = this.inMemoryOutbox.filter((r) => r.status === 'pending').length;
      const failedCount = this.inMemoryOutbox.filter((r) => r.status === 'failed').length;
      return { pendingCount, failedCount, items: this.inMemoryOutbox };
    }
  }

  public async processOutbox(): Promise<{ processed: number; failed: number }> {
    const config = this.getConfig();
    if (!this.client && !config.mockMode) {
      return { processed: 0, failed: 0 };
    }

    const { items } = this.getOutboxStatus();
    const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'failed');
    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        const buffer = Buffer.from(item.payload, 'base64');
        if (config.mockMode || !this.client) {
          this.writeMockObject(config.bucketName, item.key, buffer);
        } else {
          await this.client.send(
            new PutObjectCommand({
              Bucket: config.bucketName,
              Key: item.key,
              Body: buffer,
              ContentType: item.contentType,
            })
          );
        }

        try {
          const db = getDatabase();
          db.prepare('DELETE FROM s3_upload_outbox WHERE id = ?').run(item.id);
        } catch {
          this.inMemoryOutbox = this.inMemoryOutbox.filter((i) => i.id !== item.id);
        }
        processed++;
      } catch (err: any) {
        failed++;
        try {
          const db = getDatabase();
          db.prepare(`
            UPDATE s3_upload_outbox
            SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ?
            WHERE id = ?
          `).run(String(err.message || err), new Date().toISOString(), item.id);
        } catch {
          item.attempts++;
          item.status = 'failed';
          item.lastError = String(err.message || err);
        }
      }
    }

    return { processed, failed };
  }

  // --- Multi-Domain Storage Operations ---

  private async dispatchUpload(params: {
    key: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
    tenantId?: string;
    domain: string;
  }): Promise<{ success: boolean; key: string; size: number; queued?: boolean }> {
    const config = this.getConfig();
    const isMock = Boolean(config.mockMode || !this.client);

    if (isMock) {
      this.writeMockObject(config.bucketName || 'mock-bucket', params.key, params.buffer, params.metadata);
      return {
        success: true,
        key: params.key,
        size: params.buffer.length,
      };
    }

    try {
      await this.client!.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: params.key,
          Body: params.buffer,
          ContentType: params.contentType || 'application/octet-stream',
          Metadata: params.metadata,
        })
      );

      return {
        success: true,
        key: params.key,
        size: params.buffer.length,
      };
    } catch (err: any) {
      if (isNetworkError(err)) {
        this.enqueueOutbox({
          tenantId: params.tenantId,
          key: params.key,
          domain: params.domain,
          payload: params.buffer.toString('base64'),
          contentType: params.contentType,
        });
        return {
          success: true,
          key: params.key,
          size: params.buffer.length,
          queued: true,
        };
      }
      log.error(`[S3] Upload failed for key ${params.key}:`, err);
      throw err;
    }
  }

  /** Upload software platform release artifact */
  public async uploadPlatformRelease(
    version: string,
    filename: string,
    streamOrBuffer: Buffer | NodeJS.ReadableStream | string,
    contentType = 'application/octet-stream'
  ): Promise<{ success: boolean; key: string; size: number; url?: string; queued?: boolean }> {
    const cleanFilename = validateFilename(filename);
    const key = `platform/releases/${cleanFilename}`;
    const buffer = await streamOrInputToBuffer(streamOrBuffer);

    const result = await this.dispatchUpload({
      key,
      buffer,
      contentType,
      metadata: {
        'app-version': version,
        'app-name': 'OrderItUp',
        'uploaded-at': new Date().toISOString(),
      },
      domain: 'platform',
    });

    return result;
  }

  /** Upload tenant user account archive with strict tenant prefix enforcement */
  public async uploadUserAccountArchive(
    tenantId: string,
    filename: string,
    data: Buffer | string | Record<string, unknown>
  ): Promise<{ success: boolean; key: string; size: number; queued?: boolean }> {
    const key = buildTenantKey(tenantId, 'users', filename);
    const { buffer, contentType } = normalizePayload(data);

    return this.dispatchUpload({
      key,
      buffer,
      contentType,
      tenantId,
      domain: 'users',
      metadata: {
        'tenant-id': tenantId,
        'record-type': 'users-archive',
        'uploaded-at': new Date().toISOString(),
      },
    });
  }

  /** Upload tenant payment record with strict tenant prefix enforcement */
  public async uploadPaymentRecord(
    tenantId: string,
    filename: string,
    data: Buffer | string | Record<string, unknown>
  ): Promise<{ success: boolean; key: string; size: number; queued?: boolean }> {
    const key = buildTenantKey(tenantId, 'payments', filename);
    const { buffer, contentType } = normalizePayload(data);

    return this.dispatchUpload({
      key,
      buffer,
      contentType,
      tenantId,
      domain: 'payments',
      metadata: {
        'tenant-id': tenantId,
        'record-type': 'payment-record',
        'uploaded-at': new Date().toISOString(),
      },
    });
  }

  /** Upload tenant media asset with strict tenant prefix enforcement */
  public async uploadMediaAsset(
    tenantId: string,
    category: string,
    filename: string,
    streamOrBuffer: Buffer | NodeJS.ReadableStream | string,
    contentType = 'application/octet-stream'
  ): Promise<{ success: boolean; key: string; size: number; queued?: boolean }> {
    const cleanCategory = validateDomain(category);
    const cleanFilename = validateFilename(filename);
    const key = buildTenantKey(tenantId, 'media', cleanFilename, cleanCategory);
    const buffer = await streamOrInputToBuffer(streamOrBuffer);

    return this.dispatchUpload({
      key,
      buffer,
      contentType,
      tenantId,
      domain: 'media',
      metadata: {
        'tenant-id': tenantId,
        'media-category': cleanCategory,
        'uploaded-at': new Date().toISOString(),
      },
    });
  }

  /** Upload tenant database backup with strict tenant prefix enforcement */
  public async uploadDatabaseBackup(
    tenantId: string,
    dateStr: string,
    streamOrBuffer: Buffer | NodeJS.ReadableStream | string
  ): Promise<{ success: boolean; key: string; size: number; queued?: boolean }> {
    const cleanDate = validateFilename(dateStr).replace(/[:.]/g, '-');
    const filename = `order-it-up-${cleanDate}.db`;
    const key = buildTenantKey(tenantId, 'backups', filename);
    const buffer = await streamOrInputToBuffer(streamOrBuffer);

    return this.dispatchUpload({
      key,
      buffer,
      contentType: 'application/x-sqlite3',
      tenantId,
      domain: 'backups',
      metadata: {
        'tenant-id': tenantId,
        'backup-date': dateStr,
        'uploaded-at': new Date().toISOString(),
      },
    });
  }

  /** List tenant objects strictly under the assigned tenant prefix */
  public async listTenantObjects(
    tenantId: string,
    domain?: string
  ): Promise<S3ObjectEntry[]> {
    const cleanTenant = validateTenantId(tenantId);
    const prefix = domain ? `tenants/${cleanTenant}/${validateDomain(domain)}/` : `tenants/${cleanTenant}/`;

    const config = this.getConfig();
    const isMock = Boolean(config.mockMode || !this.client);

    let entries: S3ObjectEntry[] = [];
    if (isMock) {
      entries = this.listMockObjects(config.bucketName || 'mock-bucket', prefix);
    } else {
      try {
        const response = await this.client!.send(
          new ListObjectsV2Command({
            Bucket: config.bucketName,
            Prefix: prefix,
          })
        );
        if (response.Contents) {
          entries = response.Contents.filter((item) => Boolean(item.Key)).map((item) => ({
            key: item.Key!,
            filename: path.basename(item.Key!),
            size: item.Size || 0,
            lastModified: item.LastModified ? item.LastModified.toISOString() : '',
          }));
        }
      } catch (err: any) {
        log.error(`[S3] Failed to list tenant objects for ${prefix}:`, err);
        throw new Error(`Failed to list tenant objects: ${err.message || err}`);
      }
    }

    // Verify all returned objects adhere strictly to the tenant prefix
    return entries.map((e) => {
      if (!e.key.startsWith(`tenants/${cleanTenant}/`)) {
        throw new Error(`Tenant isolation violation: Object ${e.key} does not belong to tenant ${cleanTenant}`);
      }
      const parts = e.key.replace(`tenants/${cleanTenant}/`, '').split('/');
      const objDomain = parts.length > 1 ? parts[0] : undefined;
      return {
        ...e,
        domain: objDomain,
        tenantId: cleanTenant,
      };
    });
  }

  /** Get storage usage metrics for a specific tenant across all data domains */
  public async getTenantStorageMetrics(tenantId: string): Promise<TenantStorageMetrics> {
    const objects = await this.listTenantObjects(tenantId);
    let totalSize = 0;
    const byDomain: Record<string, { count: number; size: number }> = {
      backups: { count: 0, size: 0 },
      users: { count: 0, size: 0 },
      payments: { count: 0, size: 0 },
      media: { count: 0, size: 0 },
    };

    for (const obj of objects) {
      totalSize += obj.size;
      const domainKey = obj.domain || 'other';
      if (!byDomain[domainKey]) {
        byDomain[domainKey] = { count: 0, size: 0 };
      }
      byDomain[domainKey].count++;
      byDomain[domainKey].size += obj.size;
    }

    return {
      tenantId: validateTenantId(tenantId),
      totalSize,
      objectCount: objects.length,
      byDomain,
    };
  }

  /** Backward-compatible direct database backup snapshot upload */
  public async uploadBackup(tenantId?: string): Promise<{ success: boolean; key: string; size: number; timestamp: string }> {
    if (this.isUploading) {
      throw new Error('An S3 backup upload is already in progress.');
    }

    const config = this.getConfig();
    const isMock = Boolean(config.mockMode || !this.client);

    if (!isMock && (!this.client || !config.bucketName)) {
      throw new Error('Amazon S3 is not configured. Please fill in credentials in Settings.');
    }

    this.isUploading = true;
    let backupPath = '';

    try {
      log.info('[S3] Generating database backup snapshot...');
      const backupResult = await createBackup();
      backupPath = backupResult.path;

      const fileStats = fs.statSync(backupPath);
      const fileBuffer = fs.readFileSync(backupPath);
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');

      let s3Key = `backups/order-it-up-${dateStr}.db`;
      if (tenantId) {
        s3Key = buildTenantKey(tenantId, 'backups', `order-it-up-${dateStr}.db`);
      }

      await this.dispatchUpload({
        key: s3Key,
        buffer: fileBuffer,
        contentType: 'application/x-sqlite3',
        tenantId,
        domain: 'backups',
        metadata: {
          'app-name': 'OrderItUp',
          'schema-version': String(backupResult.schemaVersion),
          'created-at': new Date().toISOString(),
        },
      });

      // Record last successful backup timestamp in settings
      try {
        const db = getDatabase();
        db.prepare(`
          INSERT INTO settings (key, value, updated_at)
          VALUES ('s3_last_backup_at', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).run(new Date().toISOString(), now());
      } catch {
        // ignore in mock/test
      }

      // Auto-prune old backups past retention limit
      void this.pruneOldBackups(config.retentionDays || config.retention || DEFAULT_RETENTION);

      return {
        success: true,
        key: s3Key,
        size: fileStats.size,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      log.error('[S3] Failed to upload backup:', err);
      throw new Error(`S3 backup failed: ${err.message || err}`);
    } finally {
      this.isUploading = false;
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath);
        } catch {
          // ignore
        }
      }
    }
  }

  /** List existing backups in the S3 bucket */
  public async listBackups(): Promise<S3BackupEntry[]> {
    const config = this.getConfig();
    const isMock = Boolean(config.mockMode || !this.client);

    if (isMock) {
      const mockItems = this.listMockObjects(config.bucketName || 'mock-bucket', 'backups/');
      return mockItems
        .filter((item) => item.key.endsWith('.db'))
        .map((item) => ({
          key: item.key,
          filename: path.basename(item.key),
          size: item.size,
          lastModified: item.lastModified,
        }));
    }

    if (!this.client || !config.bucketName) {
      return [];
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: 'backups/',
      });

      const response = await this.client.send(command);
      if (!response.Contents) return [];

      const entries: S3BackupEntry[] = response.Contents
        .filter((item) => item.Key && item.Key.endsWith('.db'))
        .map((item) => ({
          key: item.Key!,
          filename: path.basename(item.Key!),
          size: item.Size || 0,
          lastModified: item.LastModified ? item.LastModified.toISOString() : '',
        }))
        .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

      return entries;
    } catch (err: any) {
      log.error('[S3] Failed to list backups:', err);
      throw new Error(`Failed to list S3 backups: ${err.message || err}`);
    }
  }

  /** Delete older backups exceeding retention count */
  public async pruneOldBackups(retentionCount: number): Promise<number> {
    if (retentionCount <= 0) return 0;
    const config = this.getConfig();
    const isMock = Boolean(config.mockMode || !this.client);

    try {
      const backups = await this.listBackups();
      if (backups.length <= retentionCount) return 0;

      const toDelete = backups.slice(retentionCount);
      let deleted = 0;

      for (const entry of toDelete) {
        log.info(`[S3] Pruning old backup past retention: ${entry.key}`);
        if (isMock) {
          this.deleteMockObject(config.bucketName || 'mock-bucket', entry.key);
        } else if (this.client) {
          await this.client.send(
            new DeleteObjectCommand({
              Bucket: config.bucketName,
              Key: entry.key,
            })
          );
        }
        deleted++;
      }

      log.info(`[S3] Pruned ${deleted} old backups.`);
      return deleted;
    } catch (err) {
      log.warn('[S3] Pruning old backups failed:', err);
      return 0;
    }
  }

  /** Read an object from S3 or mock adapter (strictly verifying tenant isolation if tenantId is supplied) */
  public async getObjectData(key: string, tenantId?: string): Promise<{ buffer: Buffer; contentType?: string }> {
    if (tenantId) {
      const cleanTenant = validateTenantId(tenantId);
      if (!key.startsWith(`tenants/${cleanTenant}/`)) {
        throw new Error(`Tenant isolation violation: Key "${key}" does not belong to tenant "${cleanTenant}"`);
      }
    }

    const config = this.getConfig();
    const isMock = Boolean(config.mockMode || !this.client);

    if (isMock) {
      const baseDir = path.join(getMockStorageDir(), config.bucketName || 'mock-bucket');
      const targetPath = path.join(baseDir, ...key.replace(/\\/g, '/').split('/'));
      if (!fs.existsSync(targetPath)) {
        throw new Error(`Object not found in mock S3: ${key}`);
      }
      const buffer = fs.readFileSync(targetPath);
      let contentType = 'application/octet-stream';
      if (fs.existsSync(`${targetPath}.meta.json`)) {
        try {
          const meta = JSON.parse(fs.readFileSync(`${targetPath}.meta.json`, 'utf8'));
          if (meta['content-type']) contentType = meta['content-type'];
        } catch {
          // ignore
        }
      }
      return { buffer, contentType };
    }

    try {
      const response = await this.client!.send(
        new GetObjectCommand({
          Bucket: config.bucketName,
          Key: key,
        })
      );
      const buffer = await streamOrInputToBuffer(response.Body as NodeJS.ReadableStream);
      return { buffer, contentType: response.ContentType };
    } catch (err: any) {
      log.error(`[S3] Failed to get object ${key}:`, err);
      throw err;
    }
  }

  /** Start background scheduler */
  private restartScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const config = this.getConfig();
    if (!config.enabled && !config.mockMode) return;

    this.timer = setInterval(() => {
      void this.checkScheduledBackup();
      void this.processOutbox();
    }, CHECK_INTERVAL_MS);

    // Initial check on launch
    setTimeout(() => {
      void this.checkScheduledBackup();
      void this.processOutbox();
    }, 15000);
  }

  /** Check if 24 hours have elapsed since last backup */
  private async checkScheduledBackup(): Promise<void> {
    const config = this.getConfig();
    if (!config.enabled || this.isUploading) return;

    try {
      const db = getDatabase();
      const row = db.prepare("SELECT value FROM settings WHERE key = 's3_last_backup_at'").get() as
        | { value?: string }
        | undefined;
      const lastBackupTime = row?.value ? new Date(row.value).getTime() : 0;
      const nowMs = Date.now();

      if (nowMs - lastBackupTime >= 24 * 60 * 60 * 1000) {
        log.info('[S3] Triggering scheduled daily backup to S3...');
        await this.uploadBackup();
      }
    } catch (err) {
      log.error('[S3] Scheduled backup failed:', err);
    }
  }

  /** Stop service and timers on app quit */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const amazonS3Service = new AmazonS3Service();
