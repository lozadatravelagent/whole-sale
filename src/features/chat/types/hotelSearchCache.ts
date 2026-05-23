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
 * Rango de precio por noche aplicado por el usuario. `null` en cualquier extremo
 * significa "sin tope". El objeto completo en `null` significa "sin filtro de precio".
 */
export interface PriceRangeFilter {
  min: number | null;
  max: number | null;
}

/**
 * Cache de resultados de hoteles
 */
export interface HotelSearchResultsCache {
  /** Todos los resultados de la búsqueda (sin límite) */
  allResults: HotelData[];

  /** Plan de comida seleccionado (null = sin filtro) */
  activeMealPlan: MealPlanType | null;

  /** Rango de precio por noche aplicado (null = sin filtro de precio) */
  activePriceRange: PriceRangeFilter | null;

  /** Resultados visibles después de aplicar filtro */
  displayedResults: HotelData[];

  /** Distribución de planes de comida (calculada sobre TODOS los hoteles) */
  distribution: MealPlanDistribution;

  /** Min/Max observados en la búsqueda original (para sliders y validación de UI) */
  priceRangeBounds: { min: number; max: number } | null;

  /** Timestamp de cuando se cachearon los resultados */
  timestamp: number;
}

// Re-export MealPlanType for convenience
export type { MealPlanType } from '@/utils/roomFilters';
