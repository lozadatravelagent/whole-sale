import React, { useMemo, Suspense, lazy, useState } from 'react';
import { Button } from '@/components/ui/button';
import { User, Bot, FileText, Download, Clock, Check, CheckCheck, Loader2 } from 'lucide-react';

// Lazy load heavy components
const ReactMarkdown = lazy(() => import('react-markdown'));
const CombinedTravelSelector = lazy(() => import('@/components/crm/CombinedTravelSelector'));
import type { MessageRow, LocalCombinedTravelResults } from '../types/chat';
import type { CombinedTravelResults, FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import { getMessageContent, getMessageStatusIconType, formatTime } from '../utils/messageHelpers';
import { getCityNameFromCode } from '../utils/flightHelpers';
import { translateRoomDescription } from '../utils/translations';

interface MessageItemProps {
  msg: MessageRow;
  onPdfGenerated: (pdfUrl: string, selectedFlights: GlobalFlightData[], selectedHotels: GlobalHotelData[]) => Promise<void>;
}

// Markdown wrapper component that lazy loads remarkGfm
const MarkdownContent = ({ content }: { content: string }) => {
  const [remarkGfm, setRemarkGfm] = React.useState<(() => void) | null>(null);

  React.useEffect(() => {
    import('remark-gfm').then((module) => setRemarkGfm(() => module.default));
  }, []);

  if (!remarkGfm) {
    // Fallback while loading remarkGfm plugin
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  );
};

// Memoized message component to prevent unnecessary re-renders
const MessageItem = React.memo(({ msg, onPdfGenerated }: MessageItemProps) => {
  const messageText = getMessageContent(msg);
  const [isDownloading, setIsDownloading] = useState(false);

  // Check for PDF content
  const hasPdf = typeof msg.content === 'object' && msg.content && 'pdfUrl' in msg.content;
  const pdfUrl = hasPdf ? (msg.content as { pdfUrl?: string }).pdfUrl : null;

  // Force download PDF instead of opening in browser (prevents freeze on Windows)
  const handleDownloadPdf = async () => {
    if (!pdfUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Error descargando PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cotizacion-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // Fallback to window.open if fetch fails (e.g., CORS issues)
      window.open(pdfUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // Check for combined travel data
  const hasCombinedTravel = msg.role === 'assistant' && (
    (typeof msg.meta === 'object' && msg.meta && 'combinedData' in msg.meta)
  );

  let combinedTravelData = null;
  if (hasCombinedTravel && typeof msg.meta === 'object' && msg.meta && 'combinedData' in msg.meta) {
    combinedTravelData = (msg.meta as unknown as { combinedData: LocalCombinedTravelResults }).combinedData;
  }

  // Convert local combined data to global type for component compatibility
  const convertToGlobalCombinedData = (localData: LocalCombinedTravelResults): CombinedTravelResults => {
    // 🔍 DEBUG: Log original data to verify transfers and travel_assistance are present
    console.log('🔍 [MessageItem] Converting combined data, checking services in flights:');
    localData.flights.forEach((flight, idx) => {
      console.log(`   Flight ${idx + 1}: transfers=${JSON.stringify(flight.transfers)}, travel_assistance=${JSON.stringify(flight.travel_assistance)}`);
    });

    const calcWait = (arrTime?: string, depTime?: string) => {
      if (!arrTime || !depTime) return 'N/A';
      try {
        const [ah, am] = arrTime.split(':').map(Number);
        const [dh, dm] = depTime.split(':').map(Number);
        let diff = (dh * 60 + dm) - (ah * 60 + am);
        if (diff < 0) diff += 24 * 60; // handle next-day departures
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
      } catch {
        return 'N/A';
      }
    };
    return {
      flights: localData.flights.map(flight => ({
        id: flight.id,
        airline: flight.airline,
        price: flight.price,
        adults: flight.adults,
        childrens: flight.childrens,
        departure_date: flight.departure_date,
        return_date: flight.return_date,
        legs: flight.legs.map((leg, legIndex) => {
          // Find the option with technical stops or use the first option
          let selectedOption = leg.options?.[0];
          let hasTechnicalStops = false;

          // Check if any option has technical stops
          for (const option of leg.options || []) {
            for (const segment of option.segments || []) {
              if (segment.stops && segment.stops.length > 0) {
                selectedOption = option;
                hasTechnicalStops = true;
                break;
              }
            }
            if (hasTechnicalStops) break;
          }

          const firstSegment = selectedOption?.segments?.[0];
          const lastSegment = selectedOption?.segments?.[selectedOption?.segments?.length - 1] || firstSegment;

          const departureCode = firstSegment?.departure?.airportCode || '';
          const arrivalCode = lastSegment?.arrival?.airportCode || '';
          // Build layovers from intermediate segments AND technical stops within segments
          const layovers = [];

          // Add layovers from multiple segments (EZE-GRU-MAD => layover at GRU)
          if (selectedOption?.segments && selectedOption.segments.length > 1) {
            const segmentLayovers = selectedOption.segments.slice(0, -1).map((seg, idx) => {
              const next = selectedOption.segments[idx + 1];
              return {
                destination_city: getCityNameFromCode(seg.arrival?.airportCode || ''),
                destination_code: seg.arrival?.airportCode || '',
                waiting_time: calcWait(seg.arrival?.time, next?.departure?.time)
              };
            });
            layovers.push(...segmentLayovers);
          }

          // Add technical stops from within segments (single segment with stops)
          if (selectedOption?.segments) {
            for (const segment of selectedOption.segments) {
              if (segment.stops && segment.stops.length > 0) {
                const technicalStops = segment.stops.map((stop, stopIndex) => {
                  // For technical stops, calculate layover time using the stop's arrival and departure times
                  let waitingTime = 'N/A';

                  // Try to calculate the layover time
                  // The stop contains when we arrive at the stop airport
                  // For departure time, we need to look at the stop's Time field (which is departure from the stop)
                  const stopArrivalTime = stop.date || '';  // When we arrive at the stop
                  const stopDepartureTime = stop.time || ''; // When we depart from the stop


                  if (stopArrivalTime && stopDepartureTime) {
                    try {
                      // Parse the stop arrival (format: "2025-11-12T22:35")
                      const arrivalDateTime = new Date(stopArrivalTime);

                      // Parse the departure time - need to construct full datetime
                      // Extract date from arrival and combine with departure time
                      const arrivalDate = stopArrivalTime.split('T')[0]; // "2025-11-12"
                      const departureDateTime = new Date(`${arrivalDate}T${stopDepartureTime}:00`);

                      // If departure is next day (common for overnight layovers)
                      if (departureDateTime.getTime() < arrivalDateTime.getTime()) {
                        departureDateTime.setDate(departureDateTime.getDate() + 1);
                      }

                      // Calculate layover in hours
                      const layoverMs = departureDateTime.getTime() - arrivalDateTime.getTime();
                      const layoverHours = layoverMs / (1000 * 60 * 60);

                      if (layoverHours < 1) {
                        waitingTime = `${Math.round(layoverHours * 60)}m`;
                      } else if (layoverHours < 24) {
                        const hours = Math.floor(layoverHours);
                        const minutes = Math.round((layoverHours - hours) * 60);
                        waitingTime = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
                      } else {
                        waitingTime = `${Math.round(layoverHours)}h`;
                      }
                    } catch (error) {
                      console.error('Error calculating technical stop layover time:', error);
                      waitingTime = 'N/A';
                    }
                  }

                  return {
                    destination_city: getCityNameFromCode(stop.airportCode || ''),
                    destination_code: stop.airportCode || '',
                    waiting_time: waitingTime
                  };
                });
                layovers.push(...technicalStops);
              }
            }
          }

          // Determine if arrival date is next day vs first segment departure date
          const isNextDay = (firstSegment?.departure?.date && lastSegment?.arrival?.date)
            ? (new Date(lastSegment.arrival.date).getTime() > new Date(firstSegment.departure.date).getTime())
            : false;

          return {
            departure: {
              city_code: departureCode,
              city_name: getCityNameFromCode(departureCode),
              time: firstSegment?.departure?.time || ''
            },
            arrival: {
              city_code: arrivalCode,
              city_name: getCityNameFromCode(arrivalCode),
              time: lastSegment?.arrival?.time || ''
            },
            duration: selectedOption?.duration ? `${Math.floor(selectedOption.duration / 60)}h ${selectedOption.duration % 60}m` : '0h 0m',
            flight_type: legIndex === 0 ? 'outbound' : 'return',
            layovers,
            arrival_next_day: isNextDay,
            // Preservar la información de equipaje del segmento original
            options: leg.options
          };
        }),
        luggage: flight.luggage || false,
        // 🚗 TRASLADOS - Preserve from flight data
        transfers: flight.transfers,
        // 🏥 ASISTENCIA MÉDICA / SEGURO - Preserve from flight data
        travel_assistance: flight.travel_assistance
      })),
      hotels: localData.hotels.map(hotel => ({
        id: hotel.hotel_id || `hotel_${hotel.name}_${hotel.city}`,
        unique_id: hotel.hotel_id || `hotel_${hotel.name}_${hotel.city}`,
        name: hotel.name,
        category: hotel.category || '',
        city: hotel.city,
        address: hotel.address || '',
        rooms: hotel.rooms.map(room => ({
          type: room.type || 'Standard',
          description: translateRoomDescription(room.description || 'Habitación estándar'),
          price_per_night: room.price_per_night, // Use the price_per_night from EUROVIPS directly
          total_price: room.total_price, // Use the total_price from EUROVIPS directly
          currency: room.currency,
          availability: room.availability >= 0 ? Math.max(room.availability, 3) : 5, // Ensure at least "Consultar" status
          occupancy_id: room.occupancy_id || Math.random().toString(36)
        })),
        check_in: hotel.check_in || (localData.flights.length > 0 && localData.flights[0].departure_date
          ? localData.flights[0].departure_date
          : new Date().toISOString().split('T')[0]),
        check_out: hotel.check_out || (localData.flights.length > 0 && localData.flights[0].return_date
          ? localData.flights[0].return_date
          : new Date(Date.now() + 86400000 * hotel.nights).toISOString().split('T')[0]),
        nights: hotel.nights,
        // Preserve search params for PDF occupancy (hotel-only mode)
        search_adults: hotel.search_adults,
        search_children: hotel.search_children
      })),
      requestType: localData.requestType,
      // Pass filter preferences through to UI
      requestedRoomType: localData.requestedRoomType,
      requestedMealPlan: localData.requestedMealPlan,
      // Pass flight search ID for localStorage lookup (dynamic filtering)
      flightSearchId: localData.flightSearchId
    };
  };

  // Memoize the conversion to prevent recalculation on every render
  const memoizedCombinedData = useMemo(() => {
    return combinedTravelData ? convertToGlobalCombinedData(combinedTravelData) : null;
  }, [combinedTravelData]);

  return (
    <div key={msg.id}>
      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`${hasCombinedTravel ? 'max-w-full md:max-w-4xl' : 'max-w-[85%] md:max-w-lg'} flex items-start space-x-1.5 md:space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-card flex items-center justify-center flex-shrink-0">
            {msg.role === 'user' ? <User className="h-3.5 md:h-4 w-3.5 md:w-4 text-primary" /> : <Bot className="h-3.5 md:h-4 w-3.5 md:w-4 text-accent" />}
          </div>
          <div className={`rounded-lg p-3 md:p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'} text-sm md:text-base`}>

            {/* Interactive selectors */}
            {hasCombinedTravel && combinedTravelData ? (
              <div className="space-y-3">
                <Suspense fallback={
                  <div className="h-64 bg-muted/30 animate-pulse rounded-lg flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Cargando selector...</p>
                  </div>
                }>
                  <CombinedTravelSelector
                    combinedData={memoizedCombinedData!}
                    conversationId={msg.conversation_id}
                    onPdfGenerated={onPdfGenerated}
                  />
                </Suspense>
              </div>
            ) : (
              <>
                <Suspense fallback={<div className="whitespace-pre-wrap text-muted-foreground">{messageText}</div>}>
                  <MarkdownContent content={messageText} />
                </Suspense>

                {/* PDF Download Button */}
                {hasPdf && pdfUrl && (
                  <div className="mt-2 md:mt-3 p-2 md:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 md:h-5 w-4 md:w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium text-blue-900 truncate">
                          Cotización de Viaje
                        </p>
                        <p className="text-[10px] md:text-xs text-blue-700 truncate">
                          PDF con todos los detalles de tu viaje
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                        className="bg-blue-600 hover:bg-blue-700 flex-shrink-0 text-xs md:text-sm px-2 md:px-3"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-3 md:h-4 w-3 md:w-4 animate-spin md:mr-1" />
                        ) : (
                          <Download className="h-3 md:h-4 w-3 md:w-4 md:mr-1" />
                        )}
                        <span className="hidden md:inline">{isDownloading ? 'Descargando...' : 'Descargar'}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-[10px] md:text-xs opacity-70 mt-1 flex items-center justify-between">
              <span className="flex items-center">
                {getMessageStatusIconType('sent') === 'sending' && <Clock className="h-2.5 md:h-3 w-2.5 md:w-3" />}
                {getMessageStatusIconType('sent') === 'sent' && <Check className="h-2.5 md:h-3 w-2.5 md:w-3" />}
                {getMessageStatusIconType('sent') === 'delivered' && <CheckCheck className="h-2.5 md:h-3 w-2.5 md:w-3" />}
                <span className="ml-1">{formatTime(msg.created_at)}</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;