import type { HotelData } from '@/types';
import type { MealPlanType } from '@/utils/roomFilters';

/**
 * Distribución de planes de comida para UI
 */
export interface MealPlanDistribution {
  all_inclusive: number;
  breakfast: number;
  half_board: number;
  room_only: number;
}

/**
 * Cache de resultados de hoteles
 */
export interface HotelSearchResultsCache {
  /** Todos los resultados de la búsqueda (sin límite) */
  allResults: HotelData[];

  /** Plan de comida seleccionado (null = sin filtro) */
  activeMealPlan: MealPlanType | null;

  /** Resultados visibles después de aplicar filtro */
  displayedResults: HotelData[];

  /** Distribución de planes de comida (calculada sobre TODOS los hoteles) */
  distribution: MealPlanDistribution;

  /** Timestamp de cuando se cachearon los resultados */
  timestamp: number;
}

// Re-export MealPlanType for convenience
export type { MealPlanType } from '@/utils/roomFilters';
