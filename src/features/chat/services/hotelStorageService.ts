import type { HotelData } from '@/types';

const DB_NAME = 'HotelSearchDB';
const DB_VERSION = 1;
const STORE_NAME = 'hotels';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutos

interface HotelRecord {
  id: string; // searchId
  hotels: HotelData[];
  timestamp: number;
  searchParams: {
    destination?: string;
    checkIn?: string;
    checkOut?: string;
  };
}

/**
 * IndexedDB wrapper para almacenamiento de búsquedas de hoteles
 * Permite guardar TODOS los hoteles sin límite de cantidad
 */
class HotelIndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized && this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [HOTEL INDEXEDDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('✅ [HOTEL INDEXEDDB] Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔄 [HOTEL INDEXEDDB] Database upgrade needed');

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('✅ [HOTEL INDEXEDDB] Created hotels store with timestamp index');
        }
      };
    });
  }

  async saveHotels(
    searchId: string,
    hotels: HotelData[],
    searchParams: HotelRecord['searchParams']
  ): Promise<void> {
    await this.ensureInitialized();
    await this.cleanupOldSearches();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: HotelRecord = {
        id: searchId,
        hotels,
        timestamp: Date.now(),
        searchParams
      };

      const request = store.put(record);

      request.onsuccess = () => {
        const dataSize = new Blob([JSON.stringify(record)]).size;
        console.log(`💾 [HOTEL INDEXEDDB] Saved ${hotels.length} hotels with searchId: ${searchId}`);
        console.log(`📊 [HOTEL INDEXEDDB] Data size: ${(dataSize / 1024).toFixed(2)} KB`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ [HOTEL INDEXEDDB] Failed to save hotels:', request.error);
        reject(request.error);
      };
    });
  }

  async loadHotels(searchId: string): Promise<HotelData[] | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const request = store.get(searchId);

      request.onsuccess = () => {
        const record = request.result as HotelRecord | undefined;

        if (!record) {
          console.log(`📭 [HOTEL INDEXEDDB] No data found for searchId: ${searchId}`);
          resolve(null);
          return;
        }

        if (Date.now() - record.timestamp > MAX_AGE_MS) {
          console.log(`⏰ [HOTEL INDEXEDDB] Data expired for searchId: ${searchId}`);
          this.deleteHotels(searchId);
          resolve(null);
          return;
        }

        console.log(`📦 [HOTEL INDEXEDDB] Retrieved ${record.hotels.length} hotels for searchId: ${searchId}`);
        resolve(record.hotels);
      };

      request.onerror = () => {
        console.error('❌ [HOTEL INDEXEDDB] Failed to load hotels:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteHotels(searchId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.delete(searchId);

      request.onsuccess = () => {
        console.log(`🗑️ [HOTEL INDEXEDDB] Deleted hotels for searchId: ${searchId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ [HOTEL INDEXEDDB] Failed to delete hotels:', request.error);
        reject(request.error);
      };
    });
  }

  async cleanupOldSearches(): Promise<void> {
    await this.ensureInitialized();

    const cutoffTime = Date.now() - MAX_AGE_MS;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');

      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
      let removedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          removedCount++;
          cursor.continue();
        } else {
          if (removedCount > 0) {
            console.log(`🧹 [HOTEL INDEXEDDB] Cleaned up ${removedCount} old searches`);
          }
          resolve();
        }
      };

      request.onerror = () => {
        console.error('❌ [HOTEL INDEXEDDB] Failed to cleanup old searches:', request.error);
        reject(request.error);
      };
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.db) {
      await this.init();
    }
  }
}

// Singleton instance
const hotelStorage = new HotelIndexedDBStorage();

// Inicializar automáticamente al importar el módulo
hotelStorage.init().catch((error) => {
  console.error('❌ [HOTEL INDEXEDDB] Failed to initialize on module load:', error);
});

// Public API functions

export function generateHotelSearchId(params: {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
}): string {
  const { destination, checkIn, checkOut } = params;
  const timestamp = Date.now();
  return `hotel_${destination || 'unknown'}_${checkIn || ''}_${checkOut || ''}_${timestamp}`;
}

export async function saveHotelsToStorage(
  searchId: string,
  hotels: HotelData[],
  searchParams: { destination?: string; checkIn?: string; checkOut?: string }
): Promise<void> {
  return hotelStorage.saveHotels(searchId, hotels, searchParams);
}

export async function getHotelsFromStorage(searchId: string): Promise<HotelData[] | null> {
  return hotelStorage.loadHotels(searchId);
}

export async function clearHotelStorage(searchId: string): Promise<void> {
  return hotelStorage.deleteHotels(searchId);
}

export default hotelStorage;
