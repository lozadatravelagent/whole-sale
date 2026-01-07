import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Luggage, X } from 'lucide-react';

interface BaggageChipProps {
  /** Si el filtro está activo (true) o no (null/false) */
  value: boolean | null;
  /** Cantidad de vuelos con equipaje incluido */
  count?: number;
  /** Callback cuando cambia el filtro */
  onChange: (value: boolean | null) => void;
}

export function BaggageChip({ value, count = 0, onChange }: BaggageChipProps) {
  const hasFilter = value === true;

  const handleClick = () => {
    // Toggle: null → true → null
    onChange(hasFilter ? null : true);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <button type="button" className="inline-flex" onClick={handleClick}>
      <Badge
        variant={hasFilter ? 'default' : 'outline'}
        className={cn(
          'cursor-pointer transition-all text-xs px-2 py-0.5 gap-1',
          hasFilter && 'ring-1 ring-primary',
          !hasFilter && 'hover:bg-muted'
        )}
      >
        <Luggage className="h-3 w-3" />
        Con equipaje
        {count > 0 && (
          <span className="text-[10px] opacity-70">({count})</span>
        )}
        {hasFilter && (
          <X
            className="h-3 w-3 ml-1 hover:text-destructive"
            onClick={handleClear}
          />
        )}
      </Badge>
    </button>
  );
}
