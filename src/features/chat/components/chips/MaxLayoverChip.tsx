import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Timer, X } from 'lucide-react';
import { useState } from 'react';

interface MaxLayoverChipProps {
  /** Valor actual del filtro (horas) o null */
  value: number | null;
  /** Callback cuando cambia el filtro */
  onChange: (hours: number | null) => void;
}

const LAYOVER_OPTIONS = [
  { hours: 2, label: '≤2h' },
  { hours: 3, label: '≤3h' },
  { hours: 5, label: '≤5h' },
  { hours: 8, label: '≤8h' },
] as const;

export function MaxLayoverChip({ value, onChange }: MaxLayoverChipProps) {
  const [open, setOpen] = useState(false);

  const hasFilter = value !== null;

  const getLabel = (): string => {
    if (!value) return 'Escala';

    return `Escala ≤${value}h`;
  };

  const handleOptionClick = (hours: number) => {
    // Si ya está seleccionada esta opción, limpiar
    if (value === hours) {
      onChange(null);
    } else {
      onChange(hours);
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
            <Timer className="h-3 w-3" />
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
      <PopoverContent className="w-48 p-2" align="start">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Duración máxima de escala
        </div>
        <div className="grid grid-cols-2 gap-1">
          {LAYOVER_OPTIONS.map(({ hours, label }) => {
            const isSelected = value === hours;

            return (
              <Button
                key={hours}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                className="h-auto py-2 text-left justify-start"
                onClick={() => handleOptionClick(hours)}
              >
                <span className="text-xs">{label}</span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
