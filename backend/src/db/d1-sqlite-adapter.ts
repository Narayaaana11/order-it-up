import Database from 'better-sqlite3';

export interface D1Meta {
  duration: number;
  changes: number;
  last_row_id: number;
  changed_db?: boolean;
  size_after?: number;
  rows_read?: number;
  rows_written?: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

function normalizeParam(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

class SqliteD1PreparedStatement {
  private readonly db: Database.Database;
  private readonly sql: string;
  private readonly params: unknown[];

  constructor(db: Database.Database, sql: string, params: unknown[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): SqliteD1PreparedStatement {
    return new SqliteD1PreparedStatement(
      this.db,
      this.sql,
      values.map(normalizeParam)
    );
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    if (!stmt.reader) {
      stmt.run(...this.params);
      return null;
    }
    const row = stmt.get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (colName !== undefined) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const start = Date.now();
    const stmt = this.db.prepare(this.sql);
    if (!stmt.reader) {
      const info = stmt.run(...this.params);
      return {
        results: [],
        success: true,
        meta: {
          duration: Date.now() - start,
          changes: info.changes,
          last_row_id: Number(info.lastInsertRowid),
        },
      };
    }
    const rows = stmt.all(...this.params) as T[];
    return {
      results: rows,
      success: true,
      meta: {
        duration: Date.now() - start,
        changes: 0,
        last_row_id: 0,
      },
    };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const start = Date.now();
    const stmt = this.db.prepare(this.sql);
    if (stmt.reader) {
      const rows = stmt.all(...this.params) as T[];
      return {
        results: rows,
        success: true,
        meta: {
          duration: Date.now() - start,
          changes: rows.length,
          last_row_id: 0,
        },
      };
    }
    const info = stmt.run(...this.params);
    return {
      results: [],
      success: true,
      meta: {
        duration: Date.now() - start,
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const stmt = this.db.prepare(this.sql);
    if (!stmt.reader) {
      stmt.run(...this.params);
      return [];
    }
    return stmt.raw(true).all(...this.params) as T[];
  }

  executeSync(): D1Result<Record<string, unknown>> {
    const start = Date.now();
    const stmt = this.db.prepare(this.sql);
    if (stmt.reader) {
      const rows = stmt.all(...this.params) as Record<string, unknown>[];
      return {
        results: rows,
        success: true,
        meta: {
          duration: Date.now() - start,
          changes: rows.length,
          last_row_id: 0,
        },
      };
    }
    const info = stmt.run(...this.params);
    return {
      results: [],
      success: true,
      meta: {
        duration: Date.now() - start,
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }
}

/**
 * Cloudflare D1-compatible adapter backed by better-sqlite3 in WAL mode.
 * Allows all existing Cloud API routes and SQLite/D1 migrations to run natively on Node.js.
 */
export class D1SqliteAdapter {
  public readonly rawDb: Database.Database;

  constructor(dbPath: string) {
    this.rawDb = new Database(dbPath);
    this.rawDb.pragma('journal_mode = WAL');
    this.rawDb.pragma('foreign_keys = ON');
    this.rawDb.pragma('busy_timeout = 5000');
    this.rawDb.pragma('synchronous = NORMAL');
  }

  prepare(query: string): SqliteD1PreparedStatement {
    return new SqliteD1PreparedStatement(this.rawDb, query);
  }

  async batch<T = Record<string, unknown>>(
    statements: SqliteD1PreparedStatement[]
  ): Promise<D1Result<T>[]> {
    const runBatch = this.rawDb.transaction((stmts: SqliteD1PreparedStatement[]) => {
      return stmts.map((stmt) => stmt.executeSync() as D1Result<T>);
    });
    return runBatch(statements);
  }

  async exec(query: string): Promise<D1ExecResult> {
    const start = Date.now();
    this.rawDb.exec(query);
    return {
      count: 1,
      duration: Date.now() - start,
    };
  }

  async dump(): Promise<ArrayBuffer> {
    const buf = this.rawDb.serialize();
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }

  checkpoint(): void {
    this.rawDb.pragma('wal_checkpoint(TRUNCATE)');
  }

  close(): void {
    try {
      this.checkpoint();
    } catch {
      // Best-effort checkpoint on shutdown
    }
    this.rawDb.close();
  }
}
