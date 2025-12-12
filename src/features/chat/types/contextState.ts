/**
 * Context State Types
 * 
 * Define la estructura del estado persistente de contexto para búsquedas iterativas.
 * Este estado se guarda en DB y permite mantener contexto entre turnos de conversación.
 */

/**
 * Parámetros de vuelo guardados en contexto
 */
export interface FlightContextParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  stops?: 'direct' | 'one_stop' | 'two_stops' | 'with_stops' | 'any';
  preferredAirline?: string;
  luggage?: 'carry_on' | 'checked' | 'both' | 'none';
  maxLayoverHours?: number;
}

/**
 * Parámetros de hotel guardados en contexto
 */
export interface HotelContextParams {
  city: string;
  checkinDate: string;
  checkoutDate: string;
  adults: number;
  children: number;
  roomType?: 'single' | 'double' | 'triple';
  mealPlan?: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only';
  hotelChain?: string;
  hotelName?: string;
  freeCancellation?: boolean;
}

/**
 * Resumen de resultados de la última búsqueda
 */
export interface SearchResultsSummary {
  flightsCount: number;
  hotelsCount: number;
  cheapestFlightPrice?: number;
  cheapestHotelPrice?: number;
  currency?: string;
}

/**
 * Registro de constraint aplicado en una iteración
 */
export interface ConstraintHistoryEntry {
  turn: number;
  component: 'flights' | 'hotels';
  constraint: string;
  value: any;
  timestamp: string;
}

/**
 * Información de la última búsqueda realizada
 */
export interface LastSearchInfo {
  /**
   * Tipo de búsqueda original: flights, hotels, o combined
   * CRÍTICO: Este valor debe preservarse en iteraciones
   */
  requestType: 'flights' | 'hotels' | 'combined';
  
  /**
   * Timestamp de la búsqueda
   */
  timestamp: string;
  
  /**
   * Parámetros de vuelo usados (si aplica)
   */
  flightsParams?: FlightContextParams;
  
  /**
   * Parámetros de hotel usados (si aplica)
   */
  hotelsParams?: HotelContextParams;
  
  /**
   * Resumen de resultados obtenidos
   */
  resultsSummary?: SearchResultsSummary;
}

/**
 * Estado completo de contexto persistente
 * 
 * Se guarda en DB como mensaje de sistema con meta.messageType = 'context_state'
 */
export interface ContextState {
  /**
   * Información de la última búsqueda exitosa
   */
  lastSearch: LastSearchInfo;
  
  /**
   * Historial de constraints aplicados (para iteraciones)
   * Permite rastrear qué cambios hizo el usuario en cada turno
   */
  constraintsHistory: ConstraintHistoryEntry[];
  
  /**
   * Número de turno actual en la conversación
   */
  turnNumber: number;
  
  /**
   * Versión del schema de contexto (para migraciones futuras)
   */
  schemaVersion: number;
}

/**
 * Crea un ContextState vacío/inicial
 */
export function createEmptyContextState(): ContextState {
  return {
    lastSearch: {
      requestType: 'flights',
      timestamp: new Date().toISOString(),
    },
    constraintsHistory: [],
    turnNumber: 0,
    schemaVersion: 1
  };
}

/**
 * Valida si un objeto es un ContextState válido
 */
export function isValidContextState(obj: any): obj is ContextState {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.lastSearch || typeof obj.lastSearch !== 'object') return false;
  if (!['flights', 'hotels', 'combined'].includes(obj.lastSearch.requestType)) return false;
  if (!Array.isArray(obj.constraintsHistory)) return false;
  if (typeof obj.turnNumber !== 'number') return false;
  return true;
}

