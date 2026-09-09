import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';
import { safeStorage } from 'electron';
import { getDatabase, now, createBackup } from '../db';

export interface S3Config {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  enabled: boolean;
  retention: number;
}

export interface S3BackupEntry {
  key: string;
  filename: string;
  size: number;
  lastModified: string;
}

const DEFAULT_RETENTION = 30;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly check

class AmazonS3Service {
  private client: S3Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isUploading = false;

  constructor() {}

  /** Read configuration from settings table */
  public getConfig(): S3Config {
    let db;
    try {
      db = getDatabase();
    } catch {
      return {
        region: process.env.AWS_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET_NAME || '',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        enabled: false,
        retention: DEFAULT_RETENTION,
      };
    }

    const rows = db.prepare(`
      SELECT key, value FROM settings 
      WHERE key IN ('s3_region', 's3_bucket_name', 's3_access_key_id', 's3_secret_access_key', 's3_backup_enabled', 's3_retention')
    `).all() as { key: string; value: string }[];

    const map = new Map(rows.map((r) => [r.key, r.value]));

    let secretKey = map.get('s3_secret_access_key') || process.env.AWS_SECRET_ACCESS_KEY || '';
    if (secretKey && safeStorage.isEncryptionAvailable()) {
      try {
        const decrypted = safeStorage.decryptString(Buffer.from(secretKey, 'base64'));
        if (decrypted) secretKey = decrypted;
      } catch {
        // Fall back to raw string if not encrypted
      }
    }

    return {
      region: map.get('s3_region') || process.env.AWS_REGION || 'us-east-1',
      bucketName: map.get('s3_bucket_name') || process.env.AWS_S3_BUCKET_NAME || '',
      accessKeyId: map.get('s3_access_key_id') || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: secretKey,
      enabled: (map.get('s3_backup_enabled') || 'false') === 'true',
      retention: Number(map.get('s3_retention')) || DEFAULT_RETENTION,
    };
  }

  /** Save new S3 settings */
  public saveConfig(config: Partial<S3Config>): void {
    const db = getDatabase();
    const current = this.getConfig();
    const merged = { ...current, ...config };

    let storedSecret = merged.secretAccessKey;
    if (storedSecret && safeStorage.isEncryptionAvailable()) {
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
      upsert.run('s3_retention', String(merged.retention), timestamp);
    })();

    this.initFromSettings();
  }

  /** Reinitialize client instance */
  public initFromSettings(): void {
    const config = this.getConfig();
    if (config.region && config.bucketName && config.accessKeyId && config.secretAccessKey) {
      try {
        this.client = new S3Client({
          region: config.region,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        });
        log.info('[S3] Client configured for bucket:', config.bucketName, 'in region:', config.region);
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
  public async testConnection(customConfig?: Partial<S3Config>): Promise<{ success: boolean; message: string }> {
    const config = { ...this.getConfig(), ...customConfig };
    if (!config.region || !config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
      return { success: false, message: 'All S3 fields (Region, Bucket Name, Access Key ID, Secret Key) are required.' };
    }

    const testClient = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    try {
      // Test bucket access
      await testClient.send(new HeadBucketCommand({ Bucket: config.bucketName }));
      return { success: true, message: `Successfully connected to S3 bucket "${config.bucketName}".` };
    } catch (err: any) {
      log.error('[S3] Connection test failed:', err);
      return { success: false, message: `S3 connection test failed: ${err.message || err}` };
    }
  }

  /** Upload database backup snapshot directly to S3 */
  public async uploadBackup(): Promise<{ success: boolean; key: string; size: number; timestamp: string }> {
    if (this.isUploading) {
      throw new Error('An S3 backup upload is already in progress.');
    }

    const config = this.getConfig();
    if (!this.client || !config.bucketName) {
      throw new Error('Amazon S3 is not configured. Please fill in credentials in Settings.');
    }

    this.isUploading = true;
    let backupPath = '';

    try {
      log.info('[S3] Generating database backup snapshot...');
      const backupResult = await createBackup();
      backupPath = backupResult.path;

      const fileStats = fs.statSync(backupPath);
      const fileStream = fs.createReadStream(backupPath);
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `order-it-up-${dateStr}.db`;
      const s3Key = `backups/${filename}`;

      log.info(`[S3] Uploading ${s3Key} (${fileStats.size} bytes) to bucket ${config.bucketName}...`);

      const putCommand = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: 'application/x-sqlite3',
        Metadata: {
          'app-name': 'OrderItUp',
          'schema-version': String(backupResult.schemaVersion),
          'created-at': new Date().toISOString(),
        },
      });

      await this.client.send(putCommand);
      log.info(`[S3] Successfully uploaded backup to ${s3Key}`);

      // Record last successful backup timestamp in settings
      const db = getDatabase();
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('s3_last_backup_at', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(new Date().toISOString(), now());

      // Auto-prune old backups past retention limit
      void this.pruneOldBackups(config.retention);

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
      // Clean up temporary local backup snapshot
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath);
        } catch {
          // ignore cleanup error
        }
      }
    }
  }

  /** List existing backups in the S3 bucket */
  public async listBackups(): Promise<S3BackupEntry[]> {
    const config = this.getConfig();
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
    if (!this.client || retentionCount <= 0) return 0;
    const config = this.getConfig();

    try {
      const backups = await this.listBackups();
      if (backups.length <= retentionCount) return 0;

      const toDelete = backups.slice(retentionCount);
      let deleted = 0;

      for (const entry of toDelete) {
        log.info(`[S3] Pruning old backup past retention: ${entry.key}`);
        await this.client.send(new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: entry.key,
        }));
        deleted++;
      }

      log.info(`[S3] Pruned ${deleted} old backups.`);
      return deleted;
    } catch (err) {
      log.warn('[S3] Pruning old backups failed:', err);
      return 0;
    }
  }

  /** Start background scheduler */
  private restartScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const config = this.getConfig();
    if (!config.enabled || !this.client) return;

    this.timer = setInterval(() => {
      void this.checkScheduledBackup();
    }, CHECK_INTERVAL_MS);

    // Initial check on launch
    setTimeout(() => {
      void this.checkScheduledBackup();
    }, 15000);
  }

  /** Check if 24 hours have elapsed since last backup */
  private async checkScheduledBackup(): Promise<void> {
    const config = this.getConfig();
    if (!config.enabled || !this.client || this.isUploading) return;

    const db = getDatabase();
    const row = db.prepare("SELECT value FROM settings WHERE key = 's3_last_backup_at'").get() as { value?: string } | undefined;
    const lastBackupTime = row?.value ? new Date(row.value).getTime() : 0;
    const nowMs = Date.now();

    // 24 hours interval
    if (nowMs - lastBackupTime >= 24 * 60 * 60 * 1000) {
      log.info('[S3] Triggering scheduled daily backup to S3...');
      try {
        await this.uploadBackup();
      } catch (err) {
        log.error('[S3] Scheduled backup failed:', err);
      }
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
