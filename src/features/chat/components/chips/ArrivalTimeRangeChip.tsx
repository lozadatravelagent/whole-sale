import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Clock, X } from 'lucide-react';
import { useState } from 'react';
import type { Distribution } from '../../types/searchCache';
import { timeNumberToString } from '../../utils/filterPipeline';

interface ArrivalTimeRangeChipProps {
  /** Valor actual del filtro [minHHMM, maxHHMM] o null */
  value: [number, number] | null;
  /** Distribución por franjas horarias de llegada */
  distribution?: Distribution['arrivalTimeSlots'];
  /** Callback cuando cambia el filtro */
  onChange: (range: [number, number] | null) => void;
}

const TIME_SLOTS = [
  { key: 'morning', label: 'Mañana', range: [600, 1159] as [number, number], icon: '🌅' },
  { key: 'afternoon', label: 'Tarde', range: [1200, 1759] as [number, number], icon: '☀️' },
  { key: 'evening', label: 'Noche', range: [1800, 2159] as [number, number], icon: '🌆' },
  { key: 'night', label: 'Madrugada', range: [2200, 559] as [number, number], icon: '🌙' },
] as const;

export function ArrivalTimeRangeChip({ value, distribution, onChange }: ArrivalTimeRangeChipProps) {
  const [open, setOpen] = useState(false);

  const hasFilter = value !== null;

  const getLabel = (): string => {
    if (!value) return 'Llegada';

    const [min, max] = value;
    return `Llegada ${timeNumberToString(min)} - ${timeNumberToString(max)}`;
  };

  const handleSlotClick = (range: [number, number]) => {
    // Si ya está seleccionado este rango, limpiar
    if (value && value[0] === range[0] && value[1] === range[1]) {
      onChange(null);
    } else {
      onChange(range);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex">
          <Badge
            variant={hasFilter ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer transition-all text-xs px-2 py-0.5 gap-1',
              hasFilter && 'ring-1 ring-primary',
              !hasFilter && 'hover:bg-muted'
            )}
          >
            <Clock className="h-3 w-3" />
            {getLabel()}
            {hasFilter && (
              <X
                className="h-3 w-3 ml-1 hover:text-destructive"
                onClick={handleClear}
              />
            )}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Horario de llegada
        </div>
        <div className="grid grid-cols-2 gap-1">
          {TIME_SLOTS.map(({ key, label, range, icon }) => {
            const count = distribution?.[key as keyof typeof distribution] || 0;
            const isSelected = value && value[0] === range[0] && value[1] === range[1];
            const isDisabled = count === 0;

            return (
              <Button
                key={key}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                disabled={isDisabled}
                className={cn(
                  'h-auto py-2 flex-col items-start text-left',
                  isDisabled && 'opacity-50'
                )}
                onClick={() => handleSlotClick(range)}
              >
                <span className="text-xs">
                  {icon} {label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {count} vuelos
                </span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
