import type { FlightData } from '../types/chat';

const DB_NAME = 'FlightSearchDB';
const DB_VERSION = 1;
const STORE_NAME = 'flights';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutos

interface FlightRecord {
  id: string; // searchId
  flights: FlightData[];
  timestamp: number;
  searchParams: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
  };
}

/**
 * IndexedDB wrapper para almacenamiento de búsquedas de vuelos
 * Permite guardar TODOS los vuelos sin límite de cantidad
 */
export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initialized = false;

  /**
   * Inicializar la base de datos IndexedDB
   */
  async init(): Promise<void> {
    if (this.initialized && this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [INDEXEDDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('✅ [INDEXEDDB] Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔄 [INDEXEDDB] Database upgrade needed');

        // Crear store para vuelos si no existe
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('✅ [INDEXEDDB] Created flights store with timestamp index');
        }
      };
    });
  }

  /**
   * Guardar TODOS los vuelos de una búsqueda
   */
  async saveFlights(
    searchId: string,
    flights: FlightData[],
    searchParams: FlightRecord['searchParams']
  ): Promise<void> {
    await this.ensureInitialized();
    
    // Cleanup automático antes de guardar
    await this.cleanupOldSearches();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: FlightRecord = {
        id: searchId,
        flights,
        timestamp: Date.now(),
        searchParams
      };

      const request = store.put(record);

      request.onsuccess = () => {
        const dataSize = new Blob([JSON.stringify(record)]).size;
        console.log(`💾 [INDEXEDDB] Saved ${flights.length} flights with searchId: ${searchId}`);
        console.log(`📊 [INDEXEDDB] Data size: ${(dataSize / 1024).toFixed(2)} KB`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ [INDEXEDDB] Failed to save flights:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Cargar vuelos por searchId
   */
  async loadFlights(searchId: string): Promise<FlightData[] | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const request = store.get(searchId);

      request.onsuccess = () => {
        const record = request.result as FlightRecord | undefined;

        if (!record) {
          console.log(`📭 [INDEXEDDB] No data found for searchId: ${searchId}`);
          resolve(null);
          return;
        }

        // Verificar expiración
        if (Date.now() - record.timestamp > MAX_AGE_MS) {
          console.log(`⏰ [INDEXEDDB] Data expired for searchId: ${searchId}`);
          this.deleteFlights(searchId);
          resolve(null);
          return;
        }

        console.log(`📦 [INDEXEDDB] Retrieved ${record.flights.length} flights for searchId: ${searchId}`);
        resolve(record.flights);
      };

      request.onerror = () => {
        console.error('❌ [INDEXEDDB] Failed to load flights:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Eliminar vuelos por searchId
   */
  async deleteFlights(searchId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.delete(searchId);

      request.onsuccess = () => {
        console.log(`🗑️ [INDEXEDDB] Deleted flights for searchId: ${searchId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ [INDEXEDDB] Failed to delete flights:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Cleanup automático de búsquedas viejas (> 30 minutos)
   */
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
            console.log(`🧹 [INDEXEDDB] Cleaned up ${removedCount} old searches`);
          }
          resolve();
        }
      };

      request.onerror = () => {
        console.error('❌ [INDEXEDDB] Failed to cleanup old searches:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Limpiar todos los datos
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.clear();

      request.onsuccess = () => {
        console.log(`🗑️ [INDEXEDDB] Cleared all stored searches`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ [INDEXEDDB] Failed to clear all data:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Obtener estadísticas del almacenamiento
   */
  async getStorageStats(): Promise<{
    totalSearches: number;
    totalFlights: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  }> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as FlightRecord[];
        
        const stats = {
          totalSearches: records.length,
          totalFlights: records.reduce((sum, record) => sum + record.flights.length, 0),
          oldestTimestamp: records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : null,
          newestTimestamp: records.length > 0 ? Math.max(...records.map(r => r.timestamp)) : null
        };

        console.log(`📊 [INDEXEDDB] Storage stats:`, stats);
        resolve(stats);
      };

      request.onerror = () => {
        console.error('❌ [INDEXEDDB] Failed to get storage stats:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Asegurar que la base de datos esté inicializada
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.db) {
      await this.init();
    }
  }
}

// Singleton instance
const indexedDBStorage = new IndexedDBStorage();

// Inicializar automáticamente al importar el módulo
indexedDBStorage.init().catch((error) => {
  console.error('❌ [INDEXEDDB] Failed to initialize on module load:', error);
});

export default indexedDBStorage;