import type { TripPlannerState } from '../types';

const DB_NAME = 'PlannerStateDB';
const DB_VERSION = 1;
const STORE_NAME = 'states';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PlannerStateRecord {
  conversationId: string;
  state: TripPlannerState;
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
        target.createObjectStore(STORE_NAME, { keyPath: 'conversationId' });
      }
    };
  });

  return initPromise;
}

export async function getPlannerStateFromCache(conversationId: string): Promise<TripPlannerState | null> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(conversationId);

      request.onsuccess = () => {
        const record = request.result as PlannerStateRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }
        if (Date.now() - record.timestamp > TTL_MS) {
          // Expired — clean up in background
          plannerStateCacheDelete(conversationId).catch(() => {});
          resolve(null);
          return;
        }
        resolve(record.state);
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setPlannerStateInCache(conversationId: string, state: TripPlannerState): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: PlannerStateRecord = { conversationId, state, timestamp: Date.now() };
      const request = store.put(record);
      request.onsuccess = () => {
        resolve();
        // Proactively clean expired entries after each write
        plannerStateCacheCleanup().catch(() => {});
      };
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

async function plannerStateCacheDelete(conversationId: string): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(conversationId);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

/** Remove all expired entries from the planner state cache. */
async function plannerStateCacheCleanup(): Promise<void> {
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
        const record = cursor.value as PlannerStateRecord;
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
