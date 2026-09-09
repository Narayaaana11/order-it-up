import { MongoClient, Db } from 'mongodb';
import log from 'electron-log';
import { safeStorage } from 'electron';
import { getDatabase, now } from '../db';

export interface MongoSyncConfig {
  uri: string;
  dbName: string;
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface MongoSyncStatus {
  connected: boolean;
  enabled: boolean;
  dbName: string;
  lastSyncedAt: string | null;
  counts: Record<string, number>;
  error: string | null;
}

const SYNC_INTERVAL_MS = 60 * 1000; // 1 minute incremental check

class MongoSyncService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastError: string | null = null;

  constructor() {}

  /** Read configuration from SQLite settings */
  public getConfig(): MongoSyncConfig {
    let sqlite;
    try {
      sqlite = getDatabase();
    } catch {
      return {
        uri: process.env.MONGODB_URI || '',
        dbName: process.env.MONGODB_DB_NAME || 'orderitup',
        enabled: false,
        lastSyncedAt: null,
      };
    }

    const rows = sqlite.prepare(`
      SELECT key, value FROM settings 
      WHERE key IN ('mongodb_uri', 'mongodb_database_name', 'mongodb_sync_enabled', 'mongodb_last_synced_at')
    `).all() as { key: string; value: string }[];

    const map = new Map(rows.map((r) => [r.key, r.value]));

    let uri = map.get('mongodb_uri') || process.env.MONGODB_URI || '';
    if (uri && safeStorage.isEncryptionAvailable()) {
      try {
        const decrypted = safeStorage.decryptString(Buffer.from(uri, 'base64'));
        if (decrypted) uri = decrypted;
      } catch {
        // Fall back to raw string
      }
    }

    return {
      uri,
      dbName: map.get('mongodb_database_name') || process.env.MONGODB_DB_NAME || 'orderitup',
      enabled: (map.get('mongodb_sync_enabled') || 'false') === 'true',
      lastSyncedAt: map.get('mongodb_last_synced_at') || null,
    };
  }

  /** Save new MongoDB settings */
  public saveConfig(config: Partial<MongoSyncConfig>): void {
    const sqlite = getDatabase();
    const current = this.getConfig();
    const merged = { ...current, ...config };

    let storedUri = merged.uri;
    if (storedUri && safeStorage.isEncryptionAvailable()) {
      try {
        storedUri = safeStorage.encryptString(storedUri).toString('base64');
      } catch (err) {
        log.warn('[MongoSync] SafeStorage encryption failed, storing raw:', err);
      }
    }

    const upsert = sqlite.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    const timestamp = now();
    sqlite.transaction(() => {
      upsert.run('mongodb_uri', storedUri, timestamp);
      upsert.run('mongodb_database_name', merged.dbName, timestamp);
      upsert.run('mongodb_sync_enabled', String(merged.enabled), timestamp);
    })();

    this.initFromSettings();
  }

  /** Initialize or reinitialize connection */
  public async initFromSettings(): Promise<void> {
    const config = this.getConfig();
    this.stop();

    if (config.enabled && config.uri) {
      try {
        this.client = new MongoClient(config.uri, {
          connectTimeoutMS: 10000,
          serverSelectionTimeoutMS: 10000,
        });
        await this.client.connect();
        this.db = this.client.db(config.dbName);
        this.lastError = null;
        log.info(`[MongoSync] Connected to MongoDB database "${config.dbName}"`);

        // Start periodic sync timer
        this.timer = setInterval(() => {
          void this.syncIncremental();
        }, SYNC_INTERVAL_MS);

        // Initial sync check
        setTimeout(() => {
          void this.syncIncremental();
        }, 5000);
      } catch (err: any) {
        this.lastError = err.message || String(err);
        log.error('[MongoSync] Connection failed:', this.lastError);
        this.client = null;
        this.db = null;
      }
    } else {
      this.client = null;
      this.db = null;
    }
  }

  /** Test connection with given or stored URI */
  public async testConnection(uri: string, dbName = 'orderitup'): Promise<{ success: boolean; message: string }> {
    if (!uri) return { success: false, message: 'MongoDB URI connection string is required.' };

    const tempClient = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });

    try {
      await tempClient.connect();
      await tempClient.db(dbName).command({ ping: 1 });
      return { success: true, message: `Connected successfully to MongoDB database "${dbName}".` };
    } catch (err: any) {
      return { success: false, message: `MongoDB connection failed: ${err.message || err}` };
    } finally {
      await tempClient.close().catch(() => {});
    }
  }

  /** Get current sync status and collection counts */
  public async getStatus(): Promise<MongoSyncStatus> {
    const config = this.getConfig();
    const counts: Record<string, number> = {
      bills: 0,
      orders: 0,
      products: 0,
      categories: 0,
      customers: 0,
      cash_closures: 0,
    };

    if (this.db) {
      try {
        const collections = ['bills', 'orders', 'products', 'categories', 'customers', 'cash_closures'];
        for (const col of collections) {
          counts[col] = await this.db.collection(col).estimatedDocumentCount();
        }
      } catch {
        // ignore count errors
      }
    }

    return {
      connected: !!this.db,
      enabled: config.enabled,
      dbName: config.dbName,
      lastSyncedAt: config.lastSyncedAt,
      counts,
      error: this.lastError,
    };
  }

  /** Full sync of all SQLite tables to MongoDB collections */
  public async syncAll(): Promise<{ success: boolean; synced: Record<string, number> }> {
    if (this.isSyncing) throw new Error('A sync operation is already in progress.');
    if (!this.db) throw new Error('MongoDB is not connected. Check your URI in Settings.');

    this.isSyncing = true;
    const synced: Record<string, number> = {};

    try {
      const sqlite = getDatabase();

      // 1. Categories
      const categories = sqlite.prepare("SELECT * FROM categories WHERE deleted_at IS NULL").all();
      synced.categories = await this.upsertMany('categories', categories, 'id');

      // 2. Addon Groups
      const addonGroups = sqlite.prepare("SELECT * FROM addon_groups WHERE deleted_at IS NULL").all();
      synced.addon_groups = await this.upsertMany('addon_groups', addonGroups, 'id');

      // 3. Products
      const products = sqlite.prepare("SELECT * FROM products WHERE deleted_at IS NULL").all();
      synced.products = await this.upsertMany('products', products, 'id');

      // 4. Tables
      const tables = sqlite.prepare("SELECT * FROM restaurant_tables WHERE deleted_at IS NULL").all();
      synced.tables = await this.upsertMany('tables', tables, 'id');

      // 5. Customers
      const customers = sqlite.prepare("SELECT * FROM customers WHERE deleted_at IS NULL").all();
      synced.customers = await this.upsertMany('customers', customers, 'id');

      // 6. Orders
      const orders = sqlite.prepare("SELECT * FROM orders").all();
      synced.orders = await this.upsertMany('orders', orders, 'id');

      // 7. Bills
      const bills = sqlite.prepare("SELECT * FROM bills").all();
      synced.bills = await this.upsertMany('bills', bills, 'id');

      // 8. Cash Closures
      const closures = sqlite.prepare("SELECT * FROM cash_closures").all();
      synced.cash_closures = await this.upsertMany('cash_closures', closures, 'id');

      // Update last sync time
      const timestamp = new Date().toISOString();
      sqlite.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('mongodb_last_synced_at', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(timestamp, now());

      this.lastError = null;
      log.info('[MongoSync] Full sync completed successfully:', synced);
      return { success: true, synced };
    } catch (err: any) {
      this.lastError = err.message || String(err);
      log.error('[MongoSync] Full sync failed:', err);
      throw new Error(`Sync failed: ${this.lastError}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /** Incremental sync for changes since last sync */
  public async syncIncremental(): Promise<void> {
    if (this.isSyncing || !this.db) return;
    const config = this.getConfig();
    if (!config.enabled) return;

    this.isSyncing = true;
    try {
      const sqlite = getDatabase();
      const lastSync = config.lastSyncedAt || '1970-01-01T00:00:00.000Z';

      // Incremental bills
      const bills = sqlite.prepare("SELECT * FROM bills WHERE updated_at > ? OR created_at > ?").all(lastSync, lastSync);
      if (bills.length > 0) await this.upsertMany('bills', bills, 'id');

      // Incremental orders
      const orders = sqlite.prepare("SELECT * FROM orders WHERE updated_at > ? OR created_at > ?").all(lastSync, lastSync);
      if (orders.length > 0) await this.upsertMany('orders', orders, 'id');

      // Incremental products
      const products = sqlite.prepare("SELECT * FROM products WHERE updated_at > ? OR created_at > ?").all(lastSync, lastSync);
      if (products.length > 0) await this.upsertMany('products', products, 'id');

      // Incremental customers
      const customers = sqlite.prepare("SELECT * FROM customers WHERE updated_at > ? OR created_at > ?").all(lastSync, lastSync);
      if (customers.length > 0) await this.upsertMany('customers', customers, 'id');

      // Incremental closures
      const closures = sqlite.prepare("SELECT * FROM cash_closures WHERE closed_at > ?").all(lastSync);
      if (closures.length > 0) await this.upsertMany('cash_closures', closures, 'id');

      // Record sync timestamp
      const timestamp = new Date().toISOString();
      sqlite.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('mongodb_last_synced_at', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(timestamp, now());

      this.lastError = null;
    } catch (err: any) {
      this.lastError = err.message || String(err);
      log.warn('[MongoSync] Incremental sync error:', this.lastError);
    } finally {
      this.isSyncing = false;
    }
  }

  /** Helper to bulk upsert documents by ID */
  private async upsertMany(collectionName: string, items: any[], keyField: string): Promise<number> {
    if (!this.db || items.length === 0) return 0;
    const collection = this.db.collection(collectionName);

    const operations = items.map((item) => {
      const doc = { ...item };
      // Map SQLite integer booleans / JSON fields if appropriate
      if (typeof doc.items === 'string') {
        try { doc.items = JSON.parse(doc.items); } catch {}
      }
      if (typeof doc.taxes === 'string') {
        try { doc.taxes = JSON.parse(doc.taxes); } catch {}
      }
      if (typeof doc.payments === 'string') {
        try { doc.payments = JSON.parse(doc.payments); } catch {}
      }

      return {
        replaceOne: {
          filter: { [keyField]: doc[keyField] },
          replacement: doc,
          upsert: true,
        },
      };
    });

    const res = await collection.bulkWrite(operations, { ordered: false });
    return (res.upsertedCount || 0) + (res.modifiedCount || 0);
  }

  /** Stop client and timers */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.client) {
      this.client.close().catch(() => {});
      this.client = null;
      this.db = null;
    }
  }
}

export const mongoSyncService = new MongoSyncService();
