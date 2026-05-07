import type { LocalCombinedTravelResults } from '@/types/external';
import { PublicFlightCard } from './PublicFlightCard';
import { PublicHotelCard } from './PublicHotelCard';
import { getPublicChatCopy, normalizeSupportedLanguage, type UserLanguage } from '@/features/chat/i18n/chatResultCopy';

interface PublicSearchResultsProps {
  combinedData: LocalCombinedTravelResults;
  responseLanguage?: UserLanguage | string;
}

export function PublicSearchResults({ combinedData, responseLanguage }: PublicSearchResultsProps) {
  const { flights, hotels, hotelSegments, requestType } = combinedData;
  const language = normalizeSupportedLanguage(responseLanguage);
  const copy = getPublicChatCopy(language);
  const showFlights = requestType === 'flights-only' || requestType === 'combined';
  const showHotels = requestType === 'hotels-only' || requestType === 'combined';
  const hasGroupedHotels = Boolean(hotelSegments && hotelSegments.length > 0);

  return (
    <div className="space-y-4">
      {showFlights && flights.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
            {copy.availableFlights(flights.length)}
          </div>
          {flights.map((flight) => (
            <PublicFlightCard key={flight.id} flight={flight} responseLanguage={language} />
          ))}
        </div>
      )}

      {showHotels && hasGroupedHotels && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
            {copy.hotelSegments(hotelSegments!.length)}
          </div>
          {hotelSegments!.map((segment) => (
            <div
              key={segment.segmentId}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 md:p-4 space-y-3"
            >
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{segment.city}</div>
                  <div className="text-xs text-gray-400">
                    {segment.checkinDate} → {segment.checkoutDate}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {copy.hotelCount(segment.hotels.length)}
                </div>
              </div>

              {segment.error ? (
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {segment.error}
                </div>
              ) : (
                <div className="space-y-2">
                  {segment.hotels.map((hotel, i) => (
                    <PublicHotelCard key={`${segment.segmentId}-${hotel.name}-${i}`} hotel={hotel} responseLanguage={language} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showHotels && !hasGroupedHotels && hotels.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
            {copy.availableHotels(hotels.length)}
          </div>
          {hotels.map((hotel, i) => (
            <PublicHotelCard key={`${hotel.name}-${i}`} hotel={hotel} responseLanguage={language} />
          ))}
        </div>
      )}
    </div>
  );
}
