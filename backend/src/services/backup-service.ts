import * as fs from 'node:fs';
import * as path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { D1SqliteAdapter } from '../db/d1-sqlite-adapter';

export interface BackupEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  uploadedToObjectStorage?: boolean;
}

export interface BackupServiceConfig {
  backupDir: string;
  retentionDays: number;
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Prefix?: string;
}

export class BackupService {
  constructor(
    private readonly adapter: D1SqliteAdapter,
    private readonly config: BackupServiceConfig
  ) {}

  async createBackup(reason: 'manual' | 'scheduled' = 'manual'): Promise<BackupEntry> {
    fs.mkdirSync(this.config.backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `oiu-backup-${reason}-${stamp}.db`;
    const destPath = path.join(this.config.backupDir, filename);

    await this.adapter.rawDb.backup(destPath);
    const stat = fs.statSync(destPath);

    let uploadedToObjectStorage = false;
    if (
      this.config.s3Bucket &&
      this.config.s3AccessKeyId &&
      this.config.s3SecretAccessKey
    ) {
      const client = new S3Client({
        region: this.config.s3Region || 'us-ashburn-1',
        endpoint: this.config.s3Endpoint || undefined,
        forcePathStyle: Boolean(this.config.s3Endpoint),
        credentials: {
          accessKeyId: this.config.s3AccessKeyId,
          secretAccessKey: this.config.s3SecretAccessKey,
        },
      });
      const prefix = (this.config.s3Prefix || 'backups').replace(/^\/+|\/+$/g, '');
      const key = `${prefix}/${filename}`;
      const body = fs.readFileSync(destPath);
      await client.send(
        new PutObjectCommand({
          Bucket: this.config.s3Bucket,
          Key: key,
          Body: body,
          ContentType: 'application/x-sqlite3',
        })
      );
      uploadedToObjectStorage = true;
    }

    this.pruneOldBackups();

    return {
      filename,
      sizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
      uploadedToObjectStorage,
    };
  }

  listBackups(): BackupEntry[] {
    if (!fs.existsSync(this.config.backupDir)) return [];
    const entries = fs
      .readdirSync(this.config.backupDir)
      .filter((f) => f.endsWith('.db'))
      .map((filename) => {
        const stat = fs.statSync(path.join(this.config.backupDir, filename));
        return {
          filename,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return entries;
  }

  pruneOldBackups(): number {
    if (!fs.existsSync(this.config.backupDir)) return 0;
    const cutoff = Date.now() - Math.max(1, this.config.retentionDays) * 86_400_000;
    let removed = 0;
    for (const filename of fs.readdirSync(this.config.backupDir)) {
      if (!filename.endsWith('.db')) continue;
      const fullPath = path.join(this.config.backupDir, filename);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        removed += 1;
      }
    }
    return removed;
  }
}
