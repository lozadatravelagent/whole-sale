import { Hotel, MapPin, Calendar } from 'lucide-react';
import type { LocalHotelData } from '@/features/chat/types/chat';

interface PublicHotelCardProps {
  hotel: LocalHotelData;
}

export function PublicHotelCard({ hotel }: PublicHotelCardProps) {
  const { name, city, category, check_in, check_out, nights, rooms } = hotel;

  // Find cheapest room
  const sortedRooms = [...rooms].sort((a, b) => a.total_price - b.total_price);
  const cheapestPrice = sortedRooms[0]?.total_price;
  const currency = sortedRooms[0]?.currency || 'USD';
  const topRooms = sortedRooms.slice(0, 3);

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Hotel className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-semibold text-gray-100 truncate">{name}</span>
          {category && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 shrink-0">{category}</span>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        {city && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {city}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(check_in)} → {formatDate(check_out)}
          <span className="text-gray-500">({nights} noche{nights !== 1 ? 's' : ''})</span>
        </span>
      </div>

      {/* Price */}
      {cheapestPrice != null && (
        <div className="text-lg font-bold text-cyan-400">
          Desde {currency} {cheapestPrice.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
        </div>
      )}

      {/* Top rooms */}
      {topRooms.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-white/5">
          {topRooms.map((room, i) => (
            <div key={i} className="flex items-center justify-between text-xs gap-2">
              <span className="text-gray-300 truncate">{room.description || room.type || 'Habitación'}</span>
              <span className="text-gray-400 shrink-0 font-mono">
                {room.currency} {room.total_price.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
