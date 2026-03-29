/**
 * IndexedDB cache for Foursquare place data.
 * Follows the same pattern as geocodingCache.ts.
 * Stores: nearby, details, geocoding (hotel geocoding)
 */

const DB_NAME = 'PlacesCacheDB';
const DB_VERSION = 2;
const STORES = ['nearby', 'details', 'geocoding'] as const;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type StoreName = (typeof STORES)[number];

interface CacheRecord {
  key: string;
  value: string; // JSON-stringified
  timestamp: number;
}

let db: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  if (initPromise) return initPromise;

  initPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      initPromise = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const target = (event.target as IDBOpenDBRequest).result;
      for (const store of STORES) {
        if (!target.objectStoreNames.contains(store)) {
          target.createObjectStore(store, { keyPath: 'key' });
        }
      }
    };
  });

  return initPromise;
}

// ── Memory cache layer ──────────────────────────────────────────────────────

const memoryCache = new Map<string, { value: unknown; timestamp: number }>();
const MEMORY_MAX = 500;

function memKey(store: StoreName, key: string) {
  return `${store}::${key}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export const placesCache = {
  async get<T>(store: StoreName, key: string): Promise<T | null> {
    // 1. Memory
    const mk = memKey(store, key);
    const mem = memoryCache.get(mk);
    if (mem && Date.now() - mem.timestamp < TTL_MS) {
      return mem.value as T;
    }

    // 2. IndexedDB
    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction([store], 'readonly');
        const s = tx.objectStore(store);
        const req = s.get(key);
        req.onsuccess = () => {
          const record = req.result as CacheRecord | undefined;
          if (!record || Date.now() - record.timestamp > TTL_MS) {
            resolve(null);
            return;
          }
          const parsed = JSON.parse(record.value) as T;
          memoryCache.set(mk, { value: parsed, timestamp: record.timestamp });
          resolve(parsed);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async set<T>(store: StoreName, key: string, value: T): Promise<void> {
    const now = Date.now();

    // Memory
    const mk = memKey(store, key);
    if (memoryCache.size >= MEMORY_MAX) {
      const oldest = memoryCache.keys().next().value;
      if (oldest) memoryCache.delete(oldest);
    }
    memoryCache.set(mk, { value, timestamp: now });

    // IndexedDB
    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction([store], 'readwrite');
        const s = tx.objectStore(store);
        const record: CacheRecord = { key, value: JSON.stringify(value), timestamp: now };
        const req = s.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // Ignore
    }
  },
};

/** Build consistent cache keys. */
export const cacheKeys = {
  nearby(city: string, category: string, radius: number): string {
    return `${city.trim().toLowerCase()}::${category}::${radius}`;
  },
  details(identifier: string): string {
    return identifier.trim().toLowerCase();
  },
  geocoding(identifier: string): string {
    return identifier.trim().toLowerCase();
  },
};
