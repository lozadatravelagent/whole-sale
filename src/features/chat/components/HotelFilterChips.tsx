import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { MealPlanType } from '@/utils/roomFilters';
import type { PriceRangeFilter } from '../types/hotelSearchCache';
import { buildPriceBuckets, type PriceBucket } from '../utils/hotelFilterPipeline';
import { getResultSelectorCopy, normalizeSupportedLanguage, type UserLanguage } from '../i18n/chatResultCopy';

interface MealPlanDistribution {
  all_inclusive: number;
  breakfast: number;
  half_board: number;
  room_only: number;
}

function rangeMatchesBucket(
  range: PriceRangeFilter | null | undefined,
  bucket: PriceBucket,
): boolean {
  if (!range) return false;
  return range.min === bucket.min && range.max === bucket.max;
}

function formatActiveRange(range: PriceRangeFilter): string {
  if (range.min != null && range.max != null) return `${Math.round(range.min)}–${Math.round(range.max)}`;
  if (range.min != null) return `≥ ${Math.round(range.min)}`;
  if (range.max != null) return `≤ ${Math.round(range.max)}`;
  return '';
}

interface HotelFilterChipsProps {
  /** Distribución de planes de comida */
  distribution: MealPlanDistribution;
  /** Plan de comida actualmente seleccionado */
  activeMealPlan: MealPlanType | null;
  /** Rango de precio por noche actualmente aplicado */
  activePriceRange?: PriceRangeFilter | null;
  /** Bounds reales (min/max por noche) de la búsqueda actual; null si no hay datos */
  priceRangeBounds?: { min: number; max: number } | null;
  /** Total de hoteles antes de filtrar */
  totalCount: number;
  /** Hoteles después de filtrar */
  filteredCount: number;
  /** Callback cuando cambia el filtro de plan de comida */
  onMealPlanChange: (mealPlan: MealPlanType | null) => void;
  /** Callback cuando cambia el rango de precio (opcional para retrocompat) */
  onPriceRangeChange?: (range: PriceRangeFilter | null) => void;
  language?: UserLanguage | string;
}

export function HotelFilterChips({
  distribution,
  activeMealPlan,
  activePriceRange = null,
  priceRangeBounds = null,
  totalCount,
  filteredCount,
  onMealPlanChange,
  onPriceRangeChange,
  language,
}: HotelFilterChipsProps) {
  const copy = getResultSelectorCopy(normalizeSupportedLanguage(language));
  const hasActiveFilter = activeMealPlan !== null || activePriceRange !== null;
  const mealPlanOptions: { value: MealPlanType; label: string }[] = [
    { value: 'all_inclusive', label: copy.mealPlans.all_inclusive },
    { value: 'breakfast', label: copy.mealPlans.breakfast },
    { value: 'half_board', label: copy.mealPlans.half_board },
    { value: 'room_only', label: copy.mealPlans.room_only },
  ];

  const priceBuckets = useMemo(() => buildPriceBuckets(priceRangeBounds, 4), [priceRangeBounds]);
  const showPriceRow = Boolean(onPriceRangeChange) && priceBuckets.length > 0;

  const handleMealPlanClick = (mealPlan: MealPlanType) => {
    if (activeMealPlan === mealPlan) {
      onMealPlanChange(null);
    } else {
      onMealPlanChange(mealPlan);
    }
  };

  const handlePriceBucketClick = (bucket: PriceBucket) => {
    if (!onPriceRangeChange) return;
    if (rangeMatchesBucket(activePriceRange, bucket)) {
      onPriceRangeChange(null);
    } else {
      onPriceRangeChange({ min: bucket.min, max: bucket.max });
    }
  };

  const handleClearAll = () => {
    onMealPlanChange(null);
    onPriceRangeChange?.(null);
  };

  return (
    <div className="flex flex-col gap-1 py-2 px-1 border-b border-border/50 mb-2">
      <div className="flex flex-wrap items-center gap-2">
        {mealPlanOptions.map(({ value: mealPlan, label }) => {
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
              onClick={() => !isDisabled && handleMealPlanClick(mealPlan)}
            >
              {label} ({count})
            </Badge>
          );
        })}

        {hasActiveFilter && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <Badge variant="secondary" className="text-xs">
              {filteredCount} / {totalCount}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleClearAll}
            >
              <X className="h-3 w-3 mr-1" />
              {copy.clearFilter}
            </Button>
          </>
        )}
      </div>

      {showPriceRow && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
            USD / noche
          </span>
          {priceBuckets.map(bucket => {
            const isSelected = rangeMatchesBucket(activePriceRange, bucket);
            return (
              <Badge
                key={bucket.id}
                variant={isSelected ? 'default' : 'outline'}
                className={`
                  cursor-pointer transition-all text-xs px-2 py-0.5
                  ${isSelected ? 'ring-1 ring-primary' : ''}
                  hover:bg-muted
                `}
                onClick={() => handlePriceBucketClick(bucket)}
              >
                {bucket.label}
              </Badge>
            );
          })}
          {activePriceRange && !priceBuckets.some(b => rangeMatchesBucket(activePriceRange, b)) && (
            <Badge variant="default" className="text-xs px-2 py-0.5 ring-1 ring-primary">
              {formatActiveRange(activePriceRange)}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
