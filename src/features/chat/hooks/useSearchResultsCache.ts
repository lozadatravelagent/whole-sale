import { useState, useCallback, useMemo, useEffect } from 'react';
import type { FlightData } from '../types/chat';
import type { SearchResultsCache, FilterState, FilterStats } from '../types/searchCache';
import {
  applyFilters,
  calculateDistribution,
  getDefaultFilters,
} from '../utils/filterPipeline';
import { getFlightsFromStorage } from '../services/flightStorageService';

const TOP_N_DISPLAY = 5;

/**
 * Hook para cachear resultados de búsqueda y aplicar filtros localmente
 *
 * Flujo:
 * 1. Al montar, intenta cargar vuelos de localStorage usando searchId
 * 2. Si existe, cachea para filtrado dinámico
 * 3. Usuario aplica filtro via chip
 * 4. applyFilter() filtra localmente y muestra nuevo Top 5
 */
export function useSearchResultsCache(searchId?: string) {
  const [cache, setCache] = useState<SearchResultsCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);

/**
   * Carga vuelos desde IndexedDB usando el searchId (ahora asíncrono)
   */
  const loadFromStorage = useCallback(async (id: string) => {
    setIsLoading(true);

    try {
      const flights = await getFlightsFromStorage(id);

      if (flights && flights.length > 0) {
        const distribution = calculateDistribution(flights);

        // Ordenar por precio y tomar Top 5 para display inicial
        const sorted = [...flights].sort(
          (a, b) => (a.price.amount || 0) - (b.price.amount || 0)
        );

        setCache({
          allResults: flights,
          activeFilters: getDefaultFilters(),
          displayedResults: sorted.slice(0, TOP_N_DISPLAY),
          distribution,
          timestamp: Date.now(),
        });

        console.log(`📦 [CACHE] Loaded ${flights.length} flights from IndexedDB`);
      } else {
        console.log(`📭 [CACHE] No flights found in IndexedDB for searchId: ${id}`);
      }
    } catch (error) {
      console.error('❌ [CACHE] Error loading flights from IndexedDB:', error);
    }

    setIsLoading(false);
  }, []);

  // Auto-load from localStorage when searchId changes
  useEffect(() => {
    if (searchId) {
      loadFromStorage(searchId);
    }
  }, [searchId, loadFromStorage]);

  /**
   * Cachea resultados directamente (fallback si no hay localStorage)
   */
  const cacheResults = useCallback((results: FlightData[]) => {
    if (!results?.length) {
      setCache(null);
      return;
    }

    const distribution = calculateDistribution(results);

    // Ordenar por precio y tomar Top 5 para display inicial
    const sorted = [...results].sort(
      (a, b) => (a.price.amount || 0) - (b.price.amount || 0)
    );

    setCache({
      allResults: results,
      activeFilters: getDefaultFilters(),
      displayedResults: sorted.slice(0, TOP_N_DISPLAY),
      distribution,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Aplica un filtro y recalcula los resultados visibles
   */
  const applyFilter = useCallback(
    (filterType: keyof FilterState, value: FilterState[keyof FilterState]) => {
      if (!cache) return;

      const newFilters: FilterState = {
        ...cache.activeFilters,
        [filterType]: value,
      };

      // Filtrar desde allResults
      const filtered = applyFilters(cache.allResults, newFilters);

      // Ordenar por precio y tomar Top 5
      const sorted = [...filtered].sort(
        (a, b) => (a.price.amount || 0) - (b.price.amount || 0)
      );
      const displayed = sorted.slice(0, TOP_N_DISPLAY);

      // Recalcular distribución basada en resultados filtrados
      const newDistribution = calculateDistribution(filtered);

      setCache((prev) => ({
        ...prev!,
        activeFilters: newFilters,
        displayedResults: displayed,
        distribution: newDistribution,
      }));
    },
    [cache]
  );

  /**
   * Limpia un filtro específico
   */
  const clearFilter = useCallback(
    (filterType: keyof FilterState) => {
      applyFilter(filterType, null);
    },
    [applyFilter]
  );

  /**
   * Limpia todos los filtros y vuelve al estado inicial
   */
  const clearAllFilters = useCallback(() => {
    if (!cache) return;

    const defaultFilters = getDefaultFilters();

    // Ordenar por precio y tomar Top 5
    const sorted = [...cache.allResults].sort(
      (a, b) => (a.price.amount || 0) - (b.price.amount || 0)
    );

    setCache((prev) => ({
      ...prev!,
      activeFilters: defaultFilters,
      displayedResults: sorted.slice(0, TOP_N_DISPLAY),
      distribution: calculateDistribution(cache.allResults),
    }));
  }, [cache]);

  /**
   * Estadísticas de filtrado para mostrar en UI
   */
  const filterStats: FilterStats | null = useMemo(() => {
    if (!cache) return null;

    const filtered = applyFilters(cache.allResults, cache.activeFilters);

    return {
      totalResults: cache.allResults.length,
      filteredCount: filtered.length,
      displayedCount: cache.displayedResults.length,
      hasActiveFilters: Object.values(cache.activeFilters).some(
        (v) => v !== null
      ),
    };
  }, [cache]);

  /**
   * Toggle de aerolínea (seleccionar/deseleccionar)
   */
  const toggleAirline = useCallback(
    (airlineCode: string) => {
      if (!cache) return;

      const current = cache.activeFilters.airlines ?? [];
      const isSelected = current.includes(airlineCode);

      let newValue: string[] | null;
      if (isSelected) {
        // Deseleccionar
        newValue = current.filter((c) => c !== airlineCode);
        if (newValue.length === 0) newValue = null;
      } else {
        // Seleccionar
        newValue = [...current, airlineCode];
      }

      applyFilter('airlines', newValue);
    },
    [cache, applyFilter]
  );

  /**
   * Toggle de máximo de escalas
   */
  const setMaxStops = useCallback(
    (maxStops: number | null) => {
      applyFilter('maxStops', maxStops);
    },
    [applyFilter]
  );

  /**
   * Toggle de equipaje incluido
   */
  const toggleBaggage = useCallback(
    (required: boolean | null) => {
      applyFilter('includeBaggage', required);
    },
    [applyFilter]
  );

  return {
    // Estado
    cache,
    displayedResults: cache?.displayedResults ?? [],
    activeFilters: cache?.activeFilters ?? getDefaultFilters(),
    distribution: cache?.distribution ?? null,
    filterStats,
    hasCache: cache !== null,
    isLoading,

    // Acciones
    loadFromStorage,
    cacheResults,
    applyFilter,
    clearFilter,
    clearAllFilters,
    toggleAirline,
    setMaxStops,
    toggleBaggage,
  };
}
