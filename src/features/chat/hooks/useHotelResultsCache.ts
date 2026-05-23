import { useState, useCallback, useMemo, useEffect } from 'react';
import type { HotelData } from '@/types';
import type { MealPlanType } from '@/utils/roomFilters';
import type { HotelSearchResultsCache, PriceRangeFilter } from '../types/hotelSearchCache';
import {
  filterAndLimitHotels,
  calculateMealPlanDistribution,
  calculatePriceRangeBounds,
  type ExactPricePerNightMap,
} from '../utils/hotelFilterPipeline';
import { getHotelsFromStorage } from '../services/hotelStorageService';

const TOP_N_DISPLAY = 5;

/**
 * Initial price range derivado de la búsqueda parseada (cuando el usuario ya
 * pidió "entre 2000 y 3000" en su mensaje). Sirve para preseleccionar el chip.
 */
export interface InitialPriceRange {
  min?: number | null;
  max?: number | null;
}

/**
 * Hook para cachear resultados de hoteles y aplicar filtros (plan de comida + precio)
 *
 * Flujo:
 * 1. Al montar, intenta cargar hoteles de IndexedDB usando searchId
 * 2. Si existe, cachea para filtrado dinámico
 * 3. Usuario selecciona filtros via chips
 * 4. setMealPlan() / setPriceRange() filtra localmente y muestra nuevo Top 5
 */
export function useHotelResultsCache(
  searchId?: string,
  initialPriceRange?: InitialPriceRange,
  exactPrices?: ExactPricePerNightMap,
) {
  const [cache, setCache] = useState<HotelSearchResultsCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const buildInitialPriceRange = useCallback((): PriceRangeFilter | null => {
    if (!initialPriceRange) return null;
    const min = initialPriceRange.min ?? null;
    const max = initialPriceRange.max ?? null;
    if (min == null && max == null) return null;
    return { min, max };
  }, [initialPriceRange]);

  /**
   * Carga hoteles desde IndexedDB usando el searchId
   */
  const loadFromStorage = useCallback(async (id: string) => {
    setIsLoading(true);

    try {
      const hotels = await getHotelsFromStorage(id);

      if (hotels && hotels.length > 0) {
        const distribution = calculateMealPlanDistribution(hotels);
        const priceRangeBounds = calculatePriceRangeBounds(hotels, exactPrices);
        const initial = buildInitialPriceRange();

        const displayed = filterAndLimitHotels(hotels, null, TOP_N_DISPLAY, initial, exactPrices);

        setCache({
          allResults: hotels,
          activeMealPlan: null,
          activePriceRange: initial,
          displayedResults: displayed,
          distribution,
          priceRangeBounds,
          timestamp: Date.now(),
        });

        console.log(`📦 [HOTEL CACHE] Loaded ${hotels.length} hotels from IndexedDB`);
      } else {
        console.log(`📭 [HOTEL CACHE] No hotels found in IndexedDB for searchId: ${id}`);
      }
    } catch (error) {
      console.error('❌ [HOTEL CACHE] Error loading hotels from IndexedDB:', error);
    }

    setIsLoading(false);
  }, [buildInitialPriceRange, exactPrices]);

  // Auto-load desde IndexedDB cuando cambia searchId
  useEffect(() => {
    if (searchId) {
      loadFromStorage(searchId);
    }
  }, [searchId, loadFromStorage]);

  // Cuando llegan precios exactos (makeBudget), recalcula bounds + Top N para
  // que los chips reflejen el precio real visible en la card, no el crudo de búsqueda.
  useEffect(() => {
    if (!cache || !exactPrices || Object.keys(exactPrices).length === 0) return;

    const priceRangeBounds = calculatePriceRangeBounds(cache.allResults, exactPrices);
    const displayed = filterAndLimitHotels(
      cache.allResults,
      cache.activeMealPlan,
      TOP_N_DISPLAY,
      cache.activePriceRange,
      exactPrices,
    );

    setCache((prev) => prev ? { ...prev, priceRangeBounds, displayedResults: displayed } : prev);
  }, [exactPrices]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Cachea resultados de hoteles directamente (fallback si no hay IndexedDB)
   */
  const cacheResults = useCallback((results: HotelData[]) => {
    if (!results?.length) {
      setCache(null);
      return;
    }

    const distribution = calculateMealPlanDistribution(results);
    const priceRangeBounds = calculatePriceRangeBounds(results, exactPrices);
    const initial = buildInitialPriceRange();

    const displayed = filterAndLimitHotels(results, null, TOP_N_DISPLAY, initial, exactPrices);

    setCache({
      allResults: results,
      activeMealPlan: null,
      activePriceRange: initial,
      displayedResults: displayed,
      distribution,
      priceRangeBounds,
      timestamp: Date.now(),
    });

    console.log(`📦 [HOTEL CACHE] Cached ${results.length} hotels for filtering`);
  }, [buildInitialPriceRange, exactPrices]);

  /**
   * Establece el plan de comida y recalcula los resultados visibles
   */
  const setMealPlan = useCallback((mealPlan: MealPlanType | null) => {
    if (!cache) return;

    const displayed = filterAndLimitHotels(
      cache.allResults,
      mealPlan,
      TOP_N_DISPLAY,
      cache.activePriceRange,
      exactPrices,
    );

    setCache((prev) => ({
      ...prev!,
      activeMealPlan: mealPlan,
      displayedResults: displayed,
      // IMPORTANTE: distribution NO se recalcula - siempre muestra totales originales
    }));

    console.log(`🔍 [HOTEL CACHE] Applied meal plan filter: ${mealPlan || 'none'}, showing ${displayed.length} hotels`);
  }, [cache, exactPrices]);

  /**
   * Establece el rango de precio por noche y recalcula los resultados visibles
   */
  const setPriceRange = useCallback((range: PriceRangeFilter | null) => {
    if (!cache) return;

    const normalized: PriceRangeFilter | null = (() => {
      if (!range) return null;
      const min = range.min == null || Number.isNaN(range.min) ? null : range.min;
      const max = range.max == null || Number.isNaN(range.max) ? null : range.max;
      if (min == null && max == null) return null;
      return { min, max };
    })();

    const displayed = filterAndLimitHotels(
      cache.allResults,
      cache.activeMealPlan,
      TOP_N_DISPLAY,
      normalized,
      exactPrices,
    );

    setCache((prev) => ({
      ...prev!,
      activePriceRange: normalized,
      displayedResults: displayed,
    }));

    console.log(
      `🔍 [HOTEL CACHE] Applied price filter: ${normalized ? JSON.stringify(normalized) : 'none'}, showing ${displayed.length} hotels`,
    );
  }, [cache, exactPrices]);

  /**
   * Limpia los filtros (plan de comida + rango de precio).
   */
  const clearFilter = useCallback(() => {
    if (!cache) return;
    const displayed = filterAndLimitHotels(cache.allResults, null, TOP_N_DISPLAY, null, exactPrices);
    setCache((prev) => ({
      ...prev!,
      activeMealPlan: null,
      activePriceRange: null,
      displayedResults: displayed,
    }));
  }, [cache, exactPrices]);

  /**
   * Limpia el cache completamente
   */
  const clearCache = useCallback(() => {
    setCache(null);
  }, []);

  /**
   * Cuenta exacta de hoteles que pasan los filtros activos (plan de comida + precio).
   * Calculada sobre `allResults` para que el contador refleje el resultado real,
   * no solo el TopN visible.
   */
  const filteredCount = useMemo(() => {
    if (!cache) return 0;
    if (!cache.activeMealPlan && !cache.activePriceRange) return cache.allResults.length;

    return filterAndLimitHotels(
      cache.allResults,
      cache.activeMealPlan,
      cache.allResults.length,
      cache.activePriceRange,
      exactPrices,
    ).length;
  }, [cache, exactPrices]);

  return {
    // Estado
    cache,
    displayedResults: cache?.displayedResults ?? [],
    activeMealPlan: cache?.activeMealPlan ?? null,
    activePriceRange: cache?.activePriceRange ?? null,
    priceRangeBounds: cache?.priceRangeBounds ?? null,
    distribution: cache?.distribution ?? null,
    totalCount: cache?.allResults.length ?? 0,
    filteredCount,
    hasCache: cache !== null,
    isLoading,

    // Acciones
    loadFromStorage,
    cacheResults,
    setMealPlan,
    setPriceRange,
    clearFilter,
    clearCache,
  };
}
