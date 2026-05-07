import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { normalizeSupportedLanguage, type UserLanguage } from '../../i18n/chatResultCopy';

interface StopsChipProps {
  /** Distribución de escalas: { 0: 5, 1: 22, 2: 10 } */
  distribution: Record<number, number>;
  /** Valor actual del filtro (null = sin filtro) */
  value: number | null;
  /** Callback cuando cambia el filtro */
  onChange: (maxStops: number | null) => void;
  language?: UserLanguage | string;
}

export function StopsChip({ distribution, value, onChange, language }: StopsChipProps) {
  const { i18n } = useTranslation('chat');
  const t = i18n.getFixedT(normalizeSupportedLanguage(language), 'chat');
  const STOPS_OPTIONS = [
    { value: 0, label: t('chips.stopsDirect') },
    { value: 1, label: t('chips.stopsOne') },
    { value: 2, label: t('chips.stopsTwoPlus') },
  ] as const;
  // Agrupar 2+ escalas
  const getCount = (stops: number): number => {
    if (stops === 2) {
      // Sumar todas las escalas >= 2
      return Object.entries(distribution)
        .filter(([key]) => parseInt(key) >= 2)
        .reduce((sum, [, count]) => sum + count, 0);
    }
    return distribution[stops] || 0;
  };

  const handleClick = (stops: number) => {
    if (value === stops) {
      // Deseleccionar
      onChange(null);
    } else {
      onChange(stops);
    }
  };

  return (
    <div className="flex gap-1">
      {STOPS_OPTIONS.map(({ value: stops, label }) => {
        const count = getCount(stops);
        const isSelected = value === stops;
        const isDisabled = count === 0;

        return (
          <Badge
            key={stops}
            variant={isSelected ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer transition-all text-xs px-2 py-0.5',
              isSelected && 'ring-1 ring-primary',
              isDisabled && 'opacity-50 cursor-not-allowed',
              !isDisabled && !isSelected && 'hover:bg-muted'
            )}
            onClick={() => !isDisabled && handleClick(stops)}
          >
            {label} ({count})
          </Badge>
        );
      })}
    </div>
  );
}
