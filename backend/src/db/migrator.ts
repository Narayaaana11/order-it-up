import * as fs from 'node:fs';
import * as path from 'node:path';
import { D1SqliteAdapter } from './d1-sqlite-adapter';

export interface MigrationResult {
  applied: string[];
  skipped: number;
  backupPath: string | null;
}

/**
 * Forward-only SQLite migration runner.
 * Creates an automatic pre-migration backup when pending migrations exist on an existing database.
 */
export function runMigrations(
  adapter: D1SqliteAdapter,
  migrationDirs: string[],
  backupDir?: string
): MigrationResult {
  const db = adapter.rawDb;

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>;
  const appliedSet = new Set(appliedRows.map((r) => r.id));

  const migrationFiles: Array<{ id: string; fullPath: string }> = [];
  for (const dir of migrationDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      migrationFiles.push({ id: file, fullPath: path.join(dir, file) });
    }
  }

  const pending = migrationFiles.filter((m) => !appliedSet.has(m.id));
  if (pending.length === 0) {
    return { applied: [], skipped: migrationFiles.length, backupPath: null };
  }

  let backupPath: string | null = null;
  if (backupDir && appliedSet.size > 0) {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = path.join(backupDir, `pre-migration-${stamp}.db`);
    const sourcePath = db.name;
    if (sourcePath && sourcePath !== ':memory:' && fs.existsSync(sourcePath)) {
      adapter.checkpoint();
      fs.copyFileSync(sourcePath, backupPath);
    } else {
      backupPath = null;
    }
  }

  const applied: string[] = [];
  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)'
  );

  for (const migration of pending) {
    const sql = fs.readFileSync(migration.fullPath, 'utf8');
    const applyOne = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(migration.id, new Date().toISOString());
    });
    applyOne();
    applied.push(migration.id);
  }

  return {
    applied,
    skipped: migrationFiles.length - applied.length,
    backupPath,
  };
}
