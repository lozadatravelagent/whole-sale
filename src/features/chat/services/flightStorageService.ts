import type { FlightData } from '../types/chat';
import indexedDBStorage from './indexedDBStorage';

// Mantener interfaz para compatibilidad con código existente
interface StoredFlightSearch {
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
 * Generates a unique search ID based on search parameters
 */
export function generateSearchId(params: {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
}): string {
  const parts = [
    params.origin || '',
    params.destination || '',
    params.departureDate || '',
    params.returnDate || '',
    Date.now().toString(36), // Add timestamp for uniqueness
  ];
  return parts.join('_');
}

/**
 * Saves all flight results to IndexedDB for later filtering
 */
export async function saveFlightsToStorage(
  searchId: string,
  flights: FlightData[],
  searchParams: StoredFlightSearch['searchParams']
): Promise<void> {
  try {
    await indexedDBStorage.saveFlights(searchId, flights, searchParams);
    console.log(`💾 [FLIGHT_STORAGE] Saved ${flights.length} flights to IndexedDB with searchId: ${searchId}`);
  } catch (error) {
    console.error('❌ [FLIGHT_STORAGE] Error saving flights to IndexedDB:', error);
    throw error;
  }
}

/**
 * Retrieves flight results from IndexedDB
 */
export async function getFlightsFromStorage(searchId: string): Promise<FlightData[] | null> {
  try {
    const flights = await indexedDBStorage.loadFlights(searchId);
    
    if (flights) {
      console.log(`📦 [FLIGHT_STORAGE] Retrieved ${flights.length} flights from IndexedDB for searchId: ${searchId}`);
    } else {
      console.log(`📭 [FLIGHT_STORAGE] No data found for searchId: ${searchId}`);
    }
    
    return flights;
  } catch (error) {
    console.error('❌ [FLIGHT_STORAGE] Error retrieving flights from IndexedDB:', error);
    return null;
  }
}

/**
 * Clears all flight search data from IndexedDB
 */
export async function clearAllFlightStorage(): Promise<void> {
  try {
    await indexedDBStorage.clearAll();
    console.log(`🗑️ [FLIGHT_STORAGE] Cleared all stored searches from IndexedDB`);
  } catch (error) {
    console.error('❌ [FLIGHT_STORAGE] Error clearing IndexedDB storage:', error);
  }
}

/**
 * Get storage statistics for debugging
 */
export async function getStorageStats(): Promise<any> {
  try {
    return await indexedDBStorage.getStorageStats();
  } catch (error) {
    console.error('❌ [FLIGHT_STORAGE] Error getting storage stats:', error);
    return null;
  }
}