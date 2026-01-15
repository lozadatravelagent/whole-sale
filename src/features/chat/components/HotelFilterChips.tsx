import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { MealPlanType } from '@/utils/roomFilters';

interface MealPlanDistribution {
  all_inclusive: number;
  breakfast: number;
  half_board: number;
  room_only: number;
}

interface HotelFilterChipsProps {
  /** Distribución de planes de comida */
  distribution: MealPlanDistribution;
  /** Plan de comida actualmente seleccionado */
  activeMealPlan: MealPlanType | null;
  /** Total de hoteles antes de filtrar */
  totalCount: number;
  /** Hoteles después de filtrar */
  filteredCount: number;
  /** Callback cuando cambia el filtro */
  onMealPlanChange: (mealPlan: MealPlanType | null) => void;
}

const MEAL_PLAN_OPTIONS: { value: MealPlanType; label: string }[] = [
  { value: 'all_inclusive', label: 'Todo Incluido' },
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'half_board', label: 'Media Pensión' },
  { value: 'room_only', label: 'Solo Habitación' },
];

export function HotelFilterChips({
  distribution,
  activeMealPlan,
  totalCount,
  filteredCount,
  onMealPlanChange,
}: HotelFilterChipsProps) {
  const hasActiveFilter = activeMealPlan !== null;

  const handleClick = (mealPlan: MealPlanType) => {
    if (activeMealPlan === mealPlan) {
      // Deseleccionar
      onMealPlanChange(null);
    } else {
      onMealPlanChange(mealPlan);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 px-1 border-b border-border/50 mb-2">
      {/* Chips de planes de comida */}
      {MEAL_PLAN_OPTIONS.map(({ value: mealPlan, label }) => {
        const count = distribution[mealPlan] || 0;
        const isSelected = activeMealPlan === mealPlan;
        const isDisabled = count === 0;

        return (
          <Badge
            key={mealPlan}
            variant={isSelected ? 'default' : 'outline'}
            className={`
              cursor-pointer transition-all text-xs px-2 py-0.5
              ${isSelected ? 'ring-1 ring-primary' : ''}
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${!isDisabled && !isSelected ? 'hover:bg-muted' : ''}
            `}
            onClick={() => !isDisabled && handleClick(mealPlan)}
          >
            {label} ({count})
          </Badge>
        );
      })}

      {/* Indicador de filtros activos + botón limpiar */}
      {hasActiveFilter && (
        <>
          <div className="h-4 w-px bg-border mx-1" />
          <Badge variant="secondary" className="text-xs">
            {filteredCount} de {totalCount}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onMealPlanChange(null)}
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        </>
      )}
    </div>
  );
}
