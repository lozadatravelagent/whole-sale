import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface AirlineChipProps {
  /** Código IATA de la aerolínea */
  code: string;
  /** Cantidad de vuelos con esta aerolínea */
  count: number;
  /** Si está seleccionada */
  isSelected: boolean;
  /** Callback cuando se togglea */
  onToggle: () => void;
}

export function AirlineChip({
  code,
  count,
  isSelected,
  onToggle,
}: AirlineChipProps) {
  return (
    <Badge
      variant={isSelected ? 'default' : 'outline'}
      className={cn(
        'cursor-pointer transition-all text-xs px-2 py-0.5 gap-1',
        isSelected && 'ring-1 ring-primary',
        !isSelected && 'hover:bg-muted'
      )}
      onClick={onToggle}
    >
      {isSelected && <Check className="h-3 w-3" />}
      {code} ({count})
    </Badge>
  );
}
