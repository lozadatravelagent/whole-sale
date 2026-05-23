import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { MealPlanType } from '@/utils/roomFilters';
import type { PriceRangeFilter } from '../types/hotelSearchCache';
import { getResultSelectorCopy, normalizeSupportedLanguage, type UserLanguage } from '../i18n/chatResultCopy';

interface MealPlanDistribution {
  all_inclusive: number;
  breakfast: number;
  half_board: number;
  room_only: number;
}

/**
 * Buckets predefinidos de rango de precio por noche. Los labels son intencionalmente
 * cortos para caber en un chip; la suma sin tope superior usa `∞`.
 */
const PRICE_BUCKETS: Array<{ id: string; min: number | null; max: number | null; label: string }> = [
  { id: 'lt-1500', min: null, max: 1500, label: '< 1500' },
  { id: '1500-2500', min: 1500, max: 2500, label: '1500–2500' },
  { id: '2500-3500', min: 2500, max: 3500, label: '2500–3500' },
  { id: '3500-5000', min: 3500, max: 5000, label: '3500–5000' },
  { id: 'gt-5000', min: 5000, max: null, label: '> 5000' },
];

function rangeMatchesBucket(
  range: PriceRangeFilter | null,
  bucket: (typeof PRICE_BUCKETS)[number],
): boolean {
  if (!range) return false;
  return range.min === bucket.min && range.max === bucket.max;
}

function formatActiveRange(range: PriceRangeFilter): string {
  if (range.min != null && range.max != null) return `${range.min}–${range.max}`;
  if (range.min != null) return `≥ ${range.min}`;
  if (range.max != null) return `≤ ${range.max}`;
  return '';
}

interface HotelFilterChipsProps {
  /** Distribución de planes de comida */
  distribution: MealPlanDistribution;
  /** Plan de comida actualmente seleccionado */
  activeMealPlan: MealPlanType | null;
  /** Rango de precio por noche actualmente aplicado */
  activePriceRange?: PriceRangeFilter | null;
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

  const handleMealPlanClick = (mealPlan: MealPlanType) => {
    if (activeMealPlan === mealPlan) {
      onMealPlanChange(null);
    } else {
      onMealPlanChange(mealPlan);
    }
  };

  const handlePriceBucketClick = (bucket: (typeof PRICE_BUCKETS)[number]) => {
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

      {onPriceRangeChange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
            USD / noche
          </span>
          {PRICE_BUCKETS.map(bucket => {
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
          {activePriceRange && !PRICE_BUCKETS.some(b => rangeMatchesBucket(activePriceRange, b)) && (
            <Badge variant="default" className="text-xs px-2 py-0.5 ring-1 ring-primary">
              {formatActiveRange(activePriceRange)}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
