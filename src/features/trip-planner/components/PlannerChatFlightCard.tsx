import { Button } from '@/components/ui/button';
import type { FlightData } from '@/features/chat/types/chat';

interface PlannerChatFlightCardProps {
  flight: FlightData;
  travelers: number;
  onSelect: (flight: FlightData) => void;
  onViewAlternatives: () => void;
}

export default function PlannerChatFlightCard({
  flight,
  travelers,
  onSelect,
  onViewAlternatives,
}: PlannerChatFlightCardProps) {
  // Extract route info from legs
  const firstLeg = flight.legs?.[0];
  const firstOption = firstLeg?.options?.[0];
  const firstSeg = firstOption?.segments?.[0];
  const lastSeg = firstOption?.segments?.[firstOption.segments.length - 1];

  const origin = firstSeg?.departure?.airportCode || '';
  const destination = lastSeg?.arrival?.airportCode || '';
  const depTime = firstSeg?.departure?.time?.slice(0, 5) || '';
  const arrTime = lastSeg?.arrival?.time?.slice(0, 5) || '';

  const stopsCount = flight.stops?.count ?? 0;
  const duration = flight.duration?.formatted || '';
  const pricePerPerson = flight.price?.amount ?? 0;
  const totalPrice = pricePerPerson * travelers;
  const cabinClass = flight.cabin?.brandName || flight.cabin?.class || '';

  return (
    <div className="rounded-xl border bg-card p-3 w-[280px] shrink-0 snap-start flex flex-col gap-3">
      {/* Header: airline */}
      <div className="flex items-center gap-2">
        <span className="text-base">✈️</span>
        <span className="text-xs text-muted-foreground flex-1 truncate">
          {flight.airline?.name || 'Aerolínea'}
        </span>
        {cabinClass && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full truncate max-w-[80px]">
            {cabinClass}
          </span>
        )}
      </div>

      {/* Route */}
      <div className="flex items-center gap-2">
        <div className="text-center min-w-[48px]">
          <p className="font-semibold text-sm">{origin}</p>
          {depTime && <p className="text-xs text-muted-foreground">{depTime}</p>}
        </div>

        <div className="flex-1 flex flex-col items-center gap-0.5">
          {duration && <p className="text-xs text-muted-foreground">{duration}</p>}
          <div className="flex items-center gap-1 w-full">
            <div className="h-px flex-1 bg-border" />
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-xs text-muted-foreground">
            {stopsCount === 0 ? 'Directo' : `${stopsCount} escala${stopsCount > 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="text-center min-w-[48px]">
          <p className="font-semibold text-sm">{destination}</p>
          {arrTime && <p className="text-xs text-muted-foreground">{arrTime}</p>}
        </div>
      </div>

      {/* Date + price + CTAs */}
      <div className="flex items-end justify-between pt-1 border-t border-border/50">
        <div>
          <p className="text-xs text-muted-foreground">{flight.departure_date}</p>
          <p className="font-semibold text-sm">
            ${pricePerPerson.toLocaleString()}
            <span className="text-xs font-normal text-muted-foreground">/persona</span>
          </p>
          {travelers > 1 && (
            <p className="text-xs text-muted-foreground">
              Total: ${totalPrice.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 items-end">
          <Button size="sm" className="h-7 text-xs" onClick={() => onSelect(flight)}>
            Seleccionar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onViewAlternatives}>
            Ver más
          </Button>
        </div>
      </div>
    </div>
  );
}
