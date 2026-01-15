import { useState, useCallback, useMemo, useEffect } from 'react';
import type { HotelData } from '@/types';
import type { MealPlanType } from '@/utils/roomFilters';
import type { HotelSearchResultsCache, MealPlanDistribution } from '../types/hotelSearchCache';
import {
  filterAndLimitHotels,
  calculateMealPlanDistribution,
  getMinPricePerNight,
} from '../utils/hotelFilterPipeline';
import { getHotelsFromStorage } from '../services/hotelStorageService';

const TOP_N_DISPLAY = 5;

/**
 * Hook para cachear resultados de hoteles y aplicar filtro de plan de comida
 *
 * Flujo:
 * 1. Al montar, intenta cargar hoteles de IndexedDB usando searchId
 * 2. Si existe, cachea para filtrado dinámico
 * 3. Usuario selecciona un plan de comida via chip
 * 4. setMealPlan() filtra localmente y muestra nuevo Top 5
 */
export function useHotelResultsCache(searchId?: string) {
  const [cache, setCache] = useState<HotelSearchResultsCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Carga hoteles desde IndexedDB usando el searchId
   */
  const loadFromStorage = useCallback(async (id: string) => {
    setIsLoading(true);

    try {
      const hotels = await getHotelsFromStorage(id);

      if (hotels && hotels.length > 0) {
        // Calcular distribución sobre TODOS los hoteles (no cambia con filtros)
        const distribution = calculateMealPlanDistribution(hotels);

        // Ordenar por precio y tomar Top 5 para display inicial
        const sorted = [...hotels].sort((a, b) => {
          const priceA = getMinPricePerNight(a);
          const priceB = getMinPricePerNight(b);
          return priceA - priceB;
        });

        setCache({
          allResults: hotels,
          activeMealPlan: null,
          displayedResults: sorted.slice(0, TOP_N_DISPLAY),
          distribution,
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
  }, []);

  // Auto-load desde IndexedDB cuando cambia searchId
  useEffect(() => {
    if (searchId) {
      loadFromStorage(searchId);
    }
  }, [searchId, loadFromStorage]);

  /**
   * Cachea resultados de hoteles directamente (fallback si no hay IndexedDB)
   */
  const cacheResults = useCallback((results: HotelData[]) => {
    if (!results?.length) {
      setCache(null);
      return;
    }

    const distribution = calculateMealPlanDistribution(results);

    // Ordenar por precio y tomar Top 5
    const sorted = [...results].sort((a, b) => {
      const priceA = getMinPricePerNight(a);
      const priceB = getMinPricePerNight(b);
      return priceA - priceB;
    });

    setCache({
      allResults: results,
      activeMealPlan: null,
      displayedResults: sorted.slice(0, TOP_N_DISPLAY),
      distribution,
      timestamp: Date.now(),
    });

    console.log(`📦 [HOTEL CACHE] Cached ${results.length} hotels for filtering`);
  }, []);

  /**
   * Establece el plan de comida y recalcula los resultados visibles
   */
  const setMealPlan = useCallback((mealPlan: MealPlanType | null) => {
    if (!cache) return;

    // Filtrar y limitar a Top 5
    const displayed = filterAndLimitHotels(cache.allResults, mealPlan, TOP_N_DISPLAY);

    setCache((prev) => ({
      ...prev!,
      activeMealPlan: mealPlan,
      displayedResults: displayed,
      // IMPORTANTE: distribution NO se recalcula - siempre muestra totales originales
    }));

    console.log(`🔍 [HOTEL CACHE] Applied meal plan filter: ${mealPlan || 'none'}, showing ${displayed.length} hotels`);
  }, [cache]);

  /**
   * Limpia el filtro (vuelve a mostrar todos)
   */
  const clearFilter = useCallback(() => {
    setMealPlan(null);
  }, [setMealPlan]);

  /**
   * Limpia el cache completamente
   */
  const clearCache = useCallback(() => {
    setCache(null);
  }, []);

  /**
   * Cuenta de hoteles filtrados (para mostrar "X de Y")
   */
  const filteredCount = useMemo(() => {
    if (!cache) return 0;
    if (!cache.activeMealPlan) return cache.allResults.length;

    // Contar cuántos hoteles tienen el plan de comida seleccionado
    return cache.distribution[cache.activeMealPlan] || 0;
  }, [cache]);

  return {
    // Estado
    cache,
    displayedResults: cache?.displayedResults ?? [],
    activeMealPlan: cache?.activeMealPlan ?? null,
    distribution: cache?.distribution ?? null,
    totalCount: cache?.allResults.length ?? 0,
    filteredCount,
    hasCache: cache !== null,
    isLoading,

    // Acciones
    loadFromStorage,
    cacheResults,
    setMealPlan,
    clearFilter,
    clearCache,
  };
}
