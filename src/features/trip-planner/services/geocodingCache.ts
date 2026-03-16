const DB_NAME = 'PlannerCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'geocoding';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface GeocodeCacheRecord {
  key: string;
  value: string; // JSON-stringified location or null
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
      if (!target.objectStoreNames.contains(STORE_NAME)) {
        target.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });

  return initPromise;
}

export async function geocodeCacheGet(key: string): Promise<string | undefined> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result as GeocodeCacheRecord | undefined;
        if (!record) {
          resolve(undefined);
          return;
        }
        if (Date.now() - record.timestamp > TTL_MS) {
          // Expired — clean up in background
          geocodeCacheDelete(key).catch(() => {});
          resolve(undefined);
          return;
        }
        resolve(record.value);
      };

      request.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

export async function geocodeCacheSet(key: string, value: string): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: GeocodeCacheRecord = { key, value, timestamp: Date.now() };
      const request = store.put(record);
      request.onsuccess = () => {
        resolve();
        // Proactively clean expired entries after each write
        geocodeCacheCleanup().catch(() => {});
      };
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

/** Remove all expired entries from the geocoding cache. */
export async function geocodeCacheCleanup(): Promise<void> {
  try {
    const database = await openDB();
    const now = Date.now();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        const record = cursor.value as GeocodeCacheRecord;
        if (now - record.timestamp > TTL_MS) {
          cursor.delete();
        }
        cursor.continue();
      };
      cursorReq.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

async function geocodeCacheDelete(key: string): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

export async function geocodeCacheGetAll(): Promise<Array<{ key: string; value: string }>> {
  try {
    const database = await openDB();
    const now = Date.now();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result as GeocodeCacheRecord[]).filter(
          (r) => now - r.timestamp <= TTL_MS
        );
        resolve(records.map((r) => ({ key: r.key, value: r.value })));
      };

      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
