import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { Distribution, FilterState, FilterStats } from '../types/searchCache';
import {
  StopsChip,
  AirlineChip,
  TimeRangeChip,
  ArrivalTimeRangeChip,
  BaggageChip,
  MaxLayoverChip,
} from './chips';

interface FilterChipsProps {
  /** Distribución de resultados para mostrar conteos */
  distribution: Distribution;
  /** Filtros actualmente aplicados */
  activeFilters: FilterState;
  /** Estadísticas de filtrado */
  filterStats: FilterStats;
  /** Callback cuando cambia cualquier filtro */
  onFilterChange: (filterType: keyof FilterState, value: any) => void;
  /** Callback para limpiar todos los filtros */
  onClearAll: () => void;
  /** Callback para toggle de aerolínea */
  onToggleAirline: (code: string) => void;
}

const MAX_AIRLINES_SHOWN = 4;

export function FilterChips({
  distribution,
  activeFilters,
  filterStats,
  onFilterChange,
  onClearAll,
  onToggleAirline,
}: FilterChipsProps) {
  // Ordenar aerolíneas por cantidad de vuelos (mayor primero)
  const sortedAirlines = Object.entries(distribution.airlines)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_AIRLINES_SHOWN);

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 px-1 border-b border-border/50 mb-2">
      {/* Escalas */}
      <StopsChip
        distribution={distribution.stops}
        value={activeFilters.maxStops}
        onChange={(value) => onFilterChange('maxStops', value)}
      />

      {/* Separador visual */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Aerolíneas (top 4) */}
      {sortedAirlines.map(([code, count]) => (
        <AirlineChip
          key={code}
          code={code}
          count={count}
          isSelected={activeFilters.airlines?.includes(code) ?? false}
          onToggle={() => onToggleAirline(code)}
        />
      ))}

      {/* Separador visual */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Horario de salida */}
      <TimeRangeChip
        value={activeFilters.departureTimeRange}
        distribution={distribution.departureTimeSlots}
        onChange={(value) => onFilterChange('departureTimeRange', value)}
      />

      {/* Separador visual */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Horario de llegada */}
      <ArrivalTimeRangeChip
        value={activeFilters.arrivalTimeRange}
        distribution={distribution.arrivalTimeSlots}
        onChange={(value) => onFilterChange('arrivalTimeRange', value)}
      />

      {/* Separador visual */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Equipaje incluido */}
      <BaggageChip
        value={activeFilters.includeBaggage}
        count={distribution.withBaggage}
        onChange={(value) => onFilterChange('includeBaggage', value)}
      />

      {/* Separador visual */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Máximo de escala */}
      <MaxLayoverChip
        value={activeFilters.maxLayoverHours}
        onChange={(value) => onFilterChange('maxLayoverHours', value)}
      />

      {/* Indicador de filtros activos + botón limpiar */}
      {filterStats.hasActiveFilters && (
        <>
          <div className="h-4 w-px bg-border mx-1" />
          <Badge variant="secondary" className="text-xs">
            {filterStats.filteredCount} de {filterStats.totalResults}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearAll}
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        </>
      )}
    </div>
  );
}
