import type { FlightData } from '../types/chat';

/**
 * Estado del cache de resultados de búsqueda
 * Almacena todos los resultados y permite filtrado local instantáneo
 */
export interface SearchResultsCache {
  /** Todos los resultados de la búsqueda (sin límite) */
  allResults: FlightData[];

  /** Filtros actualmente aplicados por el usuario */
  activeFilters: FilterState;

  /** Resultados visibles después de aplicar filtros (Top 5) */
  displayedResults: FlightData[];

  /** Distribución de resultados para mostrar en chips */
  distribution: Distribution;

  /** Timestamp de cuando se cachearon los resultados */
  timestamp: number;
}

/**
 * Estado de los filtros aplicados
 * null = sin filtro aplicado para ese campo
 */
export interface FilterState {
  /** Códigos IATA de aerolíneas seleccionadas */
  airlines: string[] | null;

  /** Máximo número de escalas (0 = directo, 1 = máx 1 escala, etc.) */
  maxStops: number | null;

  /** Rango de hora de salida [HHMM, HHMM] ej: [600, 1200] = 6am-12pm */
  departureTimeRange: [number, number] | null;

  /** Rango de hora de llegada [HHMM, HHMM] */
  arrivalTimeRange: [number, number] | null;

  /** Filtrar solo vuelos con equipaje incluido */
  includeBaggage: boolean | null;

  /** Duración máxima de escala en horas (ej: 3 = máximo 3 horas de espera) */
  maxLayoverHours: number | null;
}

/**
 * Distribución de resultados para UI de chips
 * Muestra cuántos vuelos hay en cada categoría
 */
export interface Distribution {
  /** Conteo por aerolínea: { "LA": 12, "AA": 8, ... } */
  airlines: Record<string, number>;

  /** Conteo por número de escalas: { 0: 5, 1: 22, 2: 10 } */
  stops: Record<number, number>;

  /** Rango de precios [min, max] */
  priceRange: [number, number];

  /** Conteo por franja horaria de salida */
  departureTimeSlots: {
    morning: number;    // 06:00 - 11:59
    afternoon: number;  // 12:00 - 17:59
    evening: number;    // 18:00 - 21:59
    night: number;      // 22:00 - 05:59
  };

  /** Conteo por franja horaria de llegada */
  arrivalTimeSlots?: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };

  /** Conteo de vuelos con equipaje incluido */
  withBaggage?: number;

  /** Conteo de vuelos sin equipaje */
  withoutBaggage?: number;
}

/**
 * Estadísticas de filtrado para mostrar en UI
 */
export interface FilterStats {
  /** Total de resultados antes de filtrar */
  totalResults: number;

  /** Resultados después de aplicar filtros */
  filteredCount: number;

  /** Resultados mostrados (típicamente 5) */
  displayedCount: number;

  /** Si hay algún filtro activo */
  hasActiveFilters: boolean;
}
