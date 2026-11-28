/**
 * Durable IndexedDB persistence for Tablet POS & Waiter Station.
 *
 * Replaces volatile localStorage for offline takeaway outbox queues and
 * branch catalog caches, with automatic localStorage fallback when IndexedDB
 * is unavailable (e.g., SSR or restricted WebViews).
 */

const DB_NAME = 'oiu_tablet_offline_v1';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readOfflineValue<T>(key: string): Promise<T | null> {
  const db = await openOfflineDb();
  if (db) {
    try {
      const value = await new Promise<T | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
        req.onerror = () => resolve(null);
      });
      if (value !== null) return value;
    } catch {
      // Fall through to localStorage migration/fallback.
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        if (db) {
          await writeOfflineValue(key, parsed);
          window.localStorage.removeItem(key);
        }
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function writeOfflineValue<T>(key: string, value: T): Promise<boolean> {
  const db = await openOfflineDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return true;
    } catch {
      // Fall through to localStorage fallback.
    }
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
