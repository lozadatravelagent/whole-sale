import { Button } from '@/components/ui/button';
import type { LocalHotelData } from '@/features/chat/types/chat';

interface PlannerChatHotelCardProps {
  hotel: LocalHotelData;
  segmentCity: string;
  onAdd: (hotel: LocalHotelData) => void;
  onViewDetails: (hotel: LocalHotelData) => void;
}

export default function PlannerChatHotelCard({
  hotel,
  segmentCity,
  onAdd,
  onViewDetails,
}: PlannerChatHotelCardProps) {
  const photoUrl = hotel.images?.find(Boolean);
  const stars = parseInt(hotel.category || '0', 10) || 0;
  const cheapestRoom = hotel.rooms?.[0];
  const pricePerNight = cheapestRoom?.price_per_night ?? (
    cheapestRoom?.total_price && hotel.nights > 0
      ? Math.round(cheapestRoom.total_price / hotel.nights)
      : null
  );
  const roomType = cheapestRoom?.type || cheapestRoom?.description;

  return (
    <div className="rounded-xl border bg-card overflow-hidden w-[280px] shrink-0 snap-start">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={hotel.name}
          className="w-full h-28 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-28 bg-muted flex items-center justify-center text-3xl">
          🏨
        </div>
      )}

      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-1">
          <p className="font-medium text-sm leading-snug line-clamp-2 flex-1">
            {hotel.name}
          </p>
          {stars > 0 && (
            <span className="text-xs shrink-0 text-yellow-500 leading-snug">
              {'★'.repeat(Math.min(stars, 5))}
            </span>
          )}
        </div>

        {(hotel.address || segmentCity) && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            📍 {hotel.address || segmentCity}
          </p>
        )}

        <div className="flex items-center justify-between gap-1">
          {pricePerNight ? (
            <span className="text-sm font-semibold">
              ${pricePerNight}
              <span className="text-xs font-normal text-muted-foreground">/noche</span>
            </span>
          ) : cheapestRoom?.total_price ? (
            <span className="text-sm font-semibold">
              ${cheapestRoom.total_price}
              <span className="text-xs font-normal text-muted-foreground"> total</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Precio a consultar</span>
          )}
          {roomType && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[100px]">
              {roomType}
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => onAdd(hotel)}>
            Agregar
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onViewDetails(hotel)}>
            Ver más
          </Button>
        </div>
      </div>
    </div>
  );
}
