import type { LocalCombinedTravelResults } from '@/features/chat/types/chat';
import { PublicFlightCard } from './PublicFlightCard';
import { PublicHotelCard } from './PublicHotelCard';

interface PublicSearchResultsProps {
  combinedData: LocalCombinedTravelResults;
}

export function PublicSearchResults({ combinedData }: PublicSearchResultsProps) {
  const { flights, hotels, requestType } = combinedData;
  const showFlights = requestType === 'flights-only' || requestType === 'combined';
  const showHotels = requestType === 'hotels-only' || requestType === 'combined';

  return (
    <div className="space-y-4">
      {showFlights && flights.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
            {flights.length} Vuelo{flights.length !== 1 ? 's' : ''} Disponible{flights.length !== 1 ? 's' : ''}
          </div>
          {flights.map((flight) => (
            <PublicFlightCard key={flight.id} flight={flight} />
          ))}
        </div>
      )}

      {showHotels && hotels.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
            {hotels.length} Hotel{hotels.length !== 1 ? 'es' : ''} Disponible{hotels.length !== 1 ? 's' : ''}
          </div>
          {hotels.map((hotel, i) => (
            <PublicHotelCard key={`${hotel.name}-${i}`} hotel={hotel} />
          ))}
        </div>
      )}
    </div>
  );
}
