import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { FlightData, HotelData, HotelDataWithSelectedRoom, CombinedTravelResults } from '@/types';
import { generateFlightPdf, generateCombinedTravelPdf } from '@/services/pdfMonkey';
import RoomGroupSelector from '@/components/ui/RoomGroupSelector';
import { useSearchResultsCache } from '@/features/chat/hooks/useSearchResultsCache';
import { useHotelResultsCache } from '@/features/chat/hooks/useHotelResultsCache';
import { FilterChips, HotelFilterChips } from '@/features/chat/components';
import { makeBudget, resolveHotelOccupancyForBudget } from '@/services/hotelSearch';
import {
  Plane,
  Hotel,
  Clock,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  Download,
  ChevronRight,
  Users,
  Luggage,
  Star,
  Phone,
  Globe,
  Bed,
  CheckCircle,
  AlertCircle,
  Package,
  ArrowRight,
  RotateCcw,
  Timer,
  Navigation
} from 'lucide-react';
import { formatTime } from '@/features/chat/utils/messageHelpers';
import { getCityNameFromCode } from '@/features/chat/utils/flightHelpers';
import BaggageIcon from '@/components/ui/BaggageIcon';
import { supabase } from '@/integrations/supabase/client';

interface CombinedTravelSelectorProps {
  combinedData: CombinedTravelResults;
  conversationId?: string; // Add conversation ID to get agency_id
  onPdfGenerated?: (pdfUrl: string, selectedFlights: FlightData[], selectedHotels: HotelData[]) => Promise<void>;
}

type GroupedHotelSegment = NonNullable<CombinedTravelResults['hotelSegments']>[number] & {
  uiSegmentId: string;
};

// Función para obtener información de equipaje del primer segmento de un leg
// optionIndex allows selecting which option's baggage info to retrieve
const getBaggageInfoFromLeg = (leg: any, optionIndex: number = 0) => {
  // Buscar en la estructura legs -> options -> segments
  const option = leg?.options?.[optionIndex] || leg?.options?.[0];
  if (option?.segments?.[0]) {
    const segment = option.segments[0];
    return {
      baggage: segment.baggage,
      carryOnBagInfo: segment.carryOnBagInfo
    };
  }
  return { baggage: undefined, carryOnBagInfo: undefined };
};

// Función para obtener texto corto del equipaje para mostrar al lado de IDA/REGRESO
const getBaggageTextFromLeg = (leg: any, airlineCode?: string, optionIndex: number = 0): string => {
  const baggageInfo = getBaggageInfoFromLeg(leg, optionIndex);

  if (!baggageInfo.baggage && !baggageInfo.carryOnBagInfo) {
    return '';
  }

  // Extraer número de piezas de equipaje de bodega
  let checkedPieces = 0;
  if (baggageInfo.baggage) {
    const checkedMatch = baggageInfo.baggage.match(/^(\d+)PC$/);
    if (checkedMatch) {
      checkedPieces = parseInt(checkedMatch[1]);
    }
  }

  // Verificar equipaje de mano
  let hasCarryOn = false;
  if (baggageInfo.carryOnBagInfo && baggageInfo.carryOnBagInfo.quantity) {
    const quantity = parseInt(baggageInfo.carryOnBagInfo.quantity);
    hasCarryOn = quantity > 0;
  }

  // Generar texto corto
  const parts = [];

  if (checkedPieces > 0) {
    parts.push(`${checkedPieces} despachada${checkedPieces > 1 ? 's' : ''}`);
  }

  if (hasCarryOn) {
    parts.push('1 de mano');
  }

  // Si no hay equipaje despachado ni carry-on, decidir según aerolínea
  if (parts.length === 0) {
    // Aerolíneas que muestran "Tarifa Light" cuando no hay equipaje
    const lightTarifAirlines = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];

    if (airlineCode && lightTarifAirlines.includes(airlineCode)) {
      return '1 Mochila';
    } else {
      // Para otras aerolíneas, consideramos que incluye carry-on básico
      return '(1 de mano)';
    }
  }

  const result = `(${parts.join(' + ')})`;

  return result;
};

// Helper function to calculate connection time
const calculateConnectionTime = (segment1: any, segment2: any): string => {
  if (!segment1?.arrival?.time || !segment2?.departure?.time) {
    return 'N/A';
  }

  try {
    // Parse times assuming same day for simplicity
    const [arr1Hours, arr1Minutes] = segment1.arrival.time.split(':').map(Number);
    const [dep2Hours, dep2Minutes] = segment2.departure.time.split(':').map(Number);

    const arrivalMinutes = arr1Hours * 60 + arr1Minutes;
    const departureMinutes = dep2Hours * 60 + dep2Minutes;

    let diffMinutes = departureMinutes - arrivalMinutes;

    // Handle next day departure
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Convierte vuelos del cache (estructura local) a formato de display (estructura global)
 * Local: legs[].options[].segments[].departure.airportCode
 * Global: legs[].departure.city_code
 */
const convertCachedFlightToDisplayFormat = (flight: any): FlightData => {
  // Si ya tiene la estructura correcta (departure.city_code existe), retornar sin cambios
  if (flight.legs?.[0]?.departure?.city_code) {
    return flight as FlightData;
  }

  // Convertir estructura local a global
  const convertedLegs = (flight.legs || []).map((leg: any, legIndex: number) => {
    // Obtener el primer option y sus segmentos
    const firstOption = leg.options?.[0];
    const segments = firstOption?.segments || [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1] || firstSegment;

    // Extraer códigos de aeropuerto
    const departureCode = firstSegment?.departure?.airportCode || '';
    const arrivalCode = lastSegment?.arrival?.airportCode || '';

    // Calcular layovers desde segmentos (escalas entre segmentos)
    const layovers: any[] = [];
    if (segments.length > 1) {
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        const nextSeg = segments[i + 1];
        layovers.push({
          destination_city: getCityNameFromCode(seg.arrival?.airportCode || ''),
          destination_code: seg.arrival?.airportCode || '',
          waiting_time: calculateConnectionTime(seg, nextSeg)
        });
      }
    }

    // Agregar paradas técnicas dentro de segmentos
    for (const segment of segments) {
      if (segment.stops && segment.stops.length > 0) {
        for (const stop of segment.stops) {
          layovers.push({
            destination_city: getCityNameFromCode(stop.airportCode || ''),
            destination_code: stop.airportCode || '',
            waiting_time: 'Escala técnica'
          });
        }
      }
    }

    // Calcular duración formateada
    const duration = firstOption?.duration
      ? `${Math.floor(firstOption.duration / 60)}h ${firstOption.duration % 60}m`
      : '0h 0m';

    // Determinar si llega al día siguiente
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
      duration,
      flight_type: legIndex === 0 ? 'outbound' : 'return',
      layovers,
      arrival_next_day: isNextDay,
      options: leg.options // Preservar options para getBaggageInfoFromLeg
    };
  });

  return {
    ...flight,
    legs: convertedLegs
  } as FlightData;
};

// Helper function to format option summary for tab display
const formatOptionSummary = (option: any): string => {
  const segments = option?.segments || [];
  if (segments.length <= 1) return 'Directo';

  // Calculate max layover duration for this option
  let maxLayoverMinutes = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    const currentSeg = segments[i];
    const nextSeg = segments[i + 1];

    if (currentSeg?.arrival?.time && currentSeg?.arrival?.date &&
        nextSeg?.departure?.time && nextSeg?.departure?.date) {
      try {
        const arrival = new Date(`${currentSeg.arrival.date}T${currentSeg.arrival.time}:00`);
        const departure = new Date(`${nextSeg.departure.date}T${nextSeg.departure.time}:00`);
        const layoverMinutes = (departure.getTime() - arrival.getTime()) / (1000 * 60);
        if (layoverMinutes > maxLayoverMinutes) {
          maxLayoverMinutes = layoverMinutes;
        }
      } catch (e) { /* ignore parse errors */ }
    }
  }

  const hours = Math.floor(maxLayoverMinutes / 60);
  const minutes = Math.round(maxLayoverMinutes % 60);
  const durationStr = hours > 0
    ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`)
    : `${minutes}m`;

  const stops = segments.length - 1;
  return `${stops} escala${stops > 1 ? 's' : ''} (${durationStr})`;
};

// Component to display flight itinerary with visual connections
interface FlightItineraryProps {
  flight: FlightData;
  selectedOptionPerLeg?: Record<number, number>;
  onSelectOption?: (legIndex: number, optionIndex: number) => void;
}

const FlightItinerary: React.FC<FlightItineraryProps> = ({ flight, selectedOptionPerLeg = {}, onSelectOption }) => {
  const formatDate = (iso?: string) => (iso ? iso : '');
  const addDays = (iso: string, days: number) => {
    try {
      const d = new Date(iso);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    } catch {
      return iso;
    }
  };
  return (
    <div className="space-y-3">
      {flight.legs.map((leg, legIndex) => {
        const legType = leg.flight_type === 'outbound' ? 'IDA' : 'REGRESO';
        const legIcon = leg.flight_type === 'outbound' ? <Plane className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />;
        const baseDate = leg.flight_type === 'outbound' ? flight.departure_date : (flight.return_date || flight.departure_date);

        // Get options from the leg (local structure: leg.options[])
        const legOptions = (leg as any).options || [];
        const hasMultipleOptions = legOptions.length > 1;
        const selectedOptionIndex = selectedOptionPerLeg[legIndex] ?? 0;
        const selectedOption = legOptions[selectedOptionIndex] || legOptions[0];

        // Calculate arrival_next_day from selected option's segments
        let arrivalNextDay = leg.arrival_next_day;
        if (selectedOption?.segments?.length > 0) {
          const firstSeg = selectedOption.segments[0];
          const lastSeg = selectedOption.segments[selectedOption.segments.length - 1];
          if (firstSeg?.departure?.date && lastSeg?.arrival?.date) {
            arrivalNextDay = new Date(lastSeg.arrival.date).getTime() > new Date(firstSeg.departure.date).getTime();
          }
        }

        const arrivalDate = arrivalNextDay ? addDays(baseDate, 1) : baseDate;

        // Get baggage info from selected option
        const baggageInfo = getBaggageInfoFromLeg(leg, selectedOptionIndex);

        return (
          <div key={legIndex} className="border border-border rounded-lg p-3 bg-background">
            <div className="flex items-center space-x-2 mb-3">
              {React.cloneElement(legIcon, { className: "h-4 w-4 text-foreground" })}
              <span className="font-semibold text-sm text-foreground">{legType}</span>
              <BaggageIcon
                {...baggageInfo}
                size="sm"
                showTooltip={true}
                className="text-foreground"
              />
              {/* Mostrar texto del equipaje al lado */}
              <span className="text-sm text-foreground font-bold">
                {getBaggageTextFromLeg(leg, flight.airline.code, selectedOptionIndex)}
              </span>
            </div>

            {/* Option selection tabs when multiple options exist */}
            {hasMultipleOptions && onSelectOption && (
              <div className="flex flex-wrap gap-1 mb-3">
                {legOptions.map((option: any, optIdx: number) => (
                  <Button
                    key={optIdx}
                    variant={selectedOptionIndex === optIdx ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => onSelectOption(legIndex, optIdx)}
                  >
                    Opción {optIdx + 1}
                    <span className="ml-1 opacity-70">
                      ({formatOptionSummary(option)})
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {/* Simplified display for current FlightLeg structure */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border">
                <div className="flex items-center space-x-3">
                  <div className="bg-muted p-2 rounded-full">
                    <Navigation className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-foreground">Vuelo {legType}</div>
                    <div className="text-xs text-muted-foreground">
                      {leg.duration}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-3">
                <div className="text-center">
                  <div className="font-bold text-lg text-foreground">{leg.departure.city_code}</div>
                  <div className="text-sm font-medium text-foreground">{leg.departure.time}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(baseDate)}</div>
                  <div className="text-xs text-muted-foreground">{leg.departure.city_name}</div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div className="h-0.5 bg-gradient-to-r from-muted to-muted-foreground flex-1"></div>
                  <Plane className="h-5 w-5 mx-2 text-foreground" />
                  <div className="h-0.5 bg-gradient-to-r from-muted-foreground to-muted flex-1"></div>
                </div>

                <div className="text-center">
                  <div className="font-bold text-lg text-foreground">{leg.arrival.city_code}</div>
                  <div className="text-sm font-medium text-foreground flex items-center justify-center space-x-1">
                    <span>{formatTime(leg.arrival.time)}</span>
                    {arrivalNextDay && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-background text-foreground border border-orange-500">+1</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(arrivalDate)}</div>
                  <div className="text-xs text-muted-foreground">{leg.arrival.city_name}</div>
                </div>
              </div>

              {/* Show layovers if present */}
              {leg.layovers && leg.layovers.length > 0 && (
                <div className="space-y-2">
                  {leg.layovers.map((layover, layoverIndex) => (
                    <div key={layoverIndex} className="flex justify-center">
                      <div className="bg-background border border-orange-500 rounded-lg p-2 min-w-[200px]">
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <Timer className="h-3 w-3 text-orange-500" />
                            <span className="text-xs font-medium text-foreground">CONEXIÓN</span>
                          </div>
                          <div className="text-sm font-bold text-foreground">
                            {layover.destination_code} - {layover.waiting_time}
                          </div>
                          <div className="text-xs text-muted-foreground">Cambio de terminal/puerta</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CombinedTravelSelector: React.FC<CombinedTravelSelectorProps> = ({
  combinedData,
  conversationId,
  onPdfGenerated
}) => {
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedHotelSnapshots, setSelectedHotelSnapshots] = useState<Record<string, HotelData>>({});
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  // Track selected option per leg for each flight: flightId -> { legIndex -> optionIndex }
  const [selectedFlightOptions, setSelectedFlightOptions] = useState<Record<string, Record<number, number>>>({});

  const getSelectedOptionIndex = useCallback((flightId: string, legIndex: number): number => {
    return selectedFlightOptions[flightId]?.[legIndex] ?? 0;
  }, [selectedFlightOptions]);

  const setSelectedOption = useCallback((flightId: string, legIndex: number, optionIndex: number) => {
    setSelectedFlightOptions(prev => ({
      ...prev,
      [flightId]: {
        ...(prev[flightId] || {}),
        [legIndex]: optionIndex
      }
    }));
  }, []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [agencyId, setAgencyId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState(
    combinedData.requestType === 'combined' ? 'flights' :
      combinedData.requestType === 'flights-only' ? 'flights' : 'hotels'
  );
  const [activeHotelSegmentId, setActiveHotelSegmentId] = useState<string | null>(null);
  // Exact price states for makeBudget integration
  const [exactPrices, setExactPrices] = useState<Record<string, { price: number; currency: string; budgetId: string }>>({});
  const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>({});
  const [failedPrices, setFailedPrices] = useState<Record<string, boolean>>({});
  // Hotel gallery state
  const [galleryHotel, setGalleryHotel] = useState<HotelData | null>(null);
  const { toast } = useToast();
  const hasLoggedData = useRef(false);

  // Hook para cache de resultados y filtrado dinámico de vuelos
  // Pasa el searchId para cargar todos los vuelos desde localStorage
  const {
    displayedResults: cachedFlights,
    activeFilters,
    distribution,
    filterStats,
    applyFilter,
    clearAllFilters,
    toggleAirline,
    hasCache,
  } = useSearchResultsCache(combinedData.flightSearchId);

  // Hook para cache de resultados y filtrado dinámico de hoteles
  // Pasa el searchId para cargar TODOS los hoteles desde IndexedDB
  const {
    displayedResults: filteredHotels,
    activeMealPlan,
    distribution: hotelDistribution,
    totalCount: hotelTotalCount,
    filteredCount: hotelFilteredCount,
    hasCache: hasHotelCache,
    setMealPlan,
    cacheResults: cacheHotelResults,
    clearCache: clearHotelCache,
  } = useHotelResultsCache(
    combinedData.hotelSegments?.length
      ? combinedData.hotelSegments.find((segment, index) => `${segment.segmentId || 'hotel-segment'}-${index}` === activeHotelSegmentId)?.hotelSearchId
      : combinedData.hotelSearchId
  );

  const groupedHotelSegments = useMemo<GroupedHotelSegment[]>(
    () => (combinedData.hotelSegments?.filter(segment => segment.city || segment.hotels.length > 0 || segment.error) ?? [])
      .map((segment, index) => ({
        ...segment,
        uiSegmentId: `${segment.segmentId || 'hotel-segment'}-${index}`
      })),
    [combinedData.hotelSegments]
  );

  const hasGroupedHotelSegments = groupedHotelSegments.length > 0;

  useEffect(() => {
    if (!hasGroupedHotelSegments) {
      if (activeHotelSegmentId !== null) {
        setActiveHotelSegmentId(null);
      }
      return;
    }

    const activeExists = groupedHotelSegments.some(segment => segment.uiSegmentId === activeHotelSegmentId);
    if (!activeExists) {
      setActiveHotelSegmentId(groupedHotelSegments[0].uiSegmentId);
    }
  }, [activeHotelSegmentId, groupedHotelSegments, hasGroupedHotelSegments]);

  const activeHotelSegment = useMemo(() => {
    if (!hasGroupedHotelSegments) return null;
    return groupedHotelSegments.find(segment => segment.uiSegmentId === activeHotelSegmentId) ?? groupedHotelSegments[0] ?? null;
  }, [activeHotelSegmentId, groupedHotelSegments, hasGroupedHotelSegments]);

  const activeHotelSegmentIndex = useMemo(() => {
    if (!activeHotelSegment) return -1;
    return groupedHotelSegments.findIndex(segment => segment.uiSegmentId === activeHotelSegment.uiSegmentId);
  }, [activeHotelSegment, groupedHotelSegments]);

  const withSegmentContext = useCallback((
    hotel: HotelData,
    segment?: GroupedHotelSegment,
    segmentOrder?: number
  ): HotelData => ({
    ...hotel,
    segmentId: hotel.segmentId ?? segment?.segmentId,
    segmentCity: hotel.segmentCity ?? segment?.city ?? hotel.city,
    segmentCheckIn: hotel.segmentCheckIn ?? segment?.checkinDate ?? hotel.check_in,
    segmentCheckOut: hotel.segmentCheckOut ?? segment?.checkoutDate ?? hotel.check_out,
    segmentOrder: hotel.segmentOrder ?? segmentOrder
  }), []);

  const groupedHotelsFlat = useMemo(
    () => groupedHotelSegments.flatMap((segment, index) => segment.hotels.map(hotel => withSegmentContext(hotel, segment, index))),
    [groupedHotelSegments, withSegmentContext]
  );

  const activeBaseHotels = useMemo(() => {
    if (hasGroupedHotelSegments) {
      return activeHotelSegment?.hotels ?? [];
    }
    return combinedData.hotels;
  }, [activeHotelSegment, combinedData.hotels, hasGroupedHotelSegments]);

  useEffect(() => {
    if (hasGroupedHotelSegments ? activeHotelSegment?.hotelSearchId : combinedData.hotelSearchId) {
      return;
    }

    if (activeBaseHotels.length > 0) {
      cacheHotelResults(activeBaseHotels);
      return;
    }

    clearHotelCache();
  }, [
    activeBaseHotels,
    activeHotelSegment?.hotelSearchId,
    cacheHotelResults,
    clearHotelCache,
    combinedData.hotelSearchId,
    hasGroupedHotelSegments
  ]);

  const activeHotels = useMemo(() => {
    const hotels = hasHotelCache ? filteredHotels : activeBaseHotels;

    if (!hasGroupedHotelSegments || !activeHotelSegment) {
      return hotels;
    }

    return hotels.map(hotel => withSegmentContext(hotel, activeHotelSegment, activeHotelSegmentIndex));
  }, [
    activeBaseHotels,
    activeHotelSegment,
    activeHotelSegmentIndex,
    filteredHotels,
    hasGroupedHotelSegments,
    hasHotelCache,
    withSegmentContext
  ]);

  const hotelUniverse = useMemo(() => {
    const hotelsById = new Map<string, HotelData>();

    const registerHotel = (hotel?: HotelData | null) => {
      if (!hotel?.id) return;
      hotelsById.set(hotel.id, hotel);
    };

    combinedData.hotels.forEach(registerHotel);
    groupedHotelsFlat.forEach(registerHotel);
    activeHotels.forEach(registerHotel);
    Object.values(selectedHotelSnapshots).forEach(registerHotel);

    return hotelsById;
  }, [activeHotels, combinedData.hotels, groupedHotelsFlat, selectedHotelSnapshots]);

  const hotelTabCount = groupedHotelsFlat.length > 0 ? groupedHotelsFlat.length : combinedData.hotels.length;

  const getHotelSegmentKey = useCallback((hotel?: Partial<HotelData> | null) => {
    if (!hotel) return 'default';

    return hotel.segmentId
      || `${hotel.segmentCity || hotel.city || 'default'}|${hotel.segmentCheckIn || hotel.check_in || ''}|${hotel.segmentCheckOut || hotel.check_out || ''}`;
  }, []);

  const getSegmentSelectionCount = useCallback((segmentKey: string, selectedIds: string[]) => {
    return selectedIds.reduce((count, hotelId) => {
      const selectedHotel = selectedHotelSnapshots[hotelId] || hotelUniverse.get(hotelId);
      if (!selectedHotel) return count;
      return getHotelSegmentKey(selectedHotel) === segmentKey ? count + 1 : count;
    }, 0);
  }, [getHotelSegmentKey, hotelUniverse, selectedHotelSnapshots]);

  const activeSegmentSelectionCount = useMemo(() => {
    if (!hasGroupedHotelSegments || !activeHotelSegment) return 0;
    return getSegmentSelectionCount(getHotelSegmentKey(activeHotelSegment.hotels[0] || {
      segmentId: activeHotelSegment.segmentId,
      segmentCity: activeHotelSegment.city,
      segmentCheckIn: activeHotelSegment.checkinDate,
      segmentCheckOut: activeHotelSegment.checkoutDate
    }), selectedHotels);
  }, [activeHotelSegment, getHotelSegmentKey, getSegmentSelectionCount, hasGroupedHotelSegments, selectedHotels]);

  // Convertir vuelos del cache a formato de display
  const filteredFlights = useMemo(() => {
    if (!cachedFlights?.length) return [];
    return cachedFlights.map(convertCachedFlightToDisplayFormat);
  }, [cachedFlights]);

  // Debug: Log received filter preferences
  useEffect(() => {
    if (combinedData.requestedRoomType || combinedData.requestedMealPlan) {
      console.log('🏨 [COMBINED_SELECTOR] Received filter preferences:', {
        requestedRoomType: combinedData.requestedRoomType,
        requestedMealPlan: combinedData.requestedMealPlan,
        hotels: combinedData.hotels.length
      });
    }
  }, [combinedData.requestedRoomType, combinedData.requestedMealPlan, combinedData.hotels.length]);

  // Load agency_id from conversation
  useEffect(() => {
    if (conversationId) {
      supabase
        .from('conversations')
        .select('agency_id')
        .eq('id', conversationId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.warn('[PDF] Could not fetch agency_id from conversation:', error);
            return;
          }
          if (data?.agency_id) {
            setAgencyId(data.agency_id);
            console.log('[PDF] Loaded agency_id for PDF generation:', data.agency_id);
          }
        });
    }
  }, [conversationId]);

  const handleFlightToggle = (flightId: string) => {
    setSelectedFlights(prev => {
      if (prev.includes(flightId)) {
        return prev.filter(id => id !== flightId);
      }

      // Limit to maximum 4 flights
      if (prev.length >= 4) {
        toast({
          title: "Límite alcanzado",
          description: "Solo puedes seleccionar máximo 4 vuelos para el PDF.",
          variant: "destructive",
        });
        return prev;
      }

      return [...prev, flightId];
    });
  };

  const handleHotelToggle = (hotel: HotelData) => {
    const hotelId = hotel.id;

    setSelectedHotels(prev => {
      if (prev.includes(hotelId)) {
        setSelectedRooms(currentRooms => {
          const nextRooms = { ...currentRooms };
          delete nextRooms[hotelId];
          return nextRooms;
        });
        setSelectedHotelSnapshots(currentSnapshots => {
          const nextSnapshots = { ...currentSnapshots };
          delete nextSnapshots[hotelId];
          return nextSnapshots;
        });
        return prev.filter(id => id !== hotelId);
      }

      if (hasGroupedHotelSegments) {
        const segmentKey = getHotelSegmentKey(hotel);
        const selectedInSegment = getSegmentSelectionCount(segmentKey, prev);

        if (selectedInSegment >= 2) {
          toast({
            title: "Límite alcanzado",
            description: `Solo puedes seleccionar hasta 2 hoteles para ${formatCityLabel(hotel.segmentCity || hotel.city)}.`,
            variant: "destructive",
          });
          return prev;
        }
      } else if (prev.length >= 3) {
        toast({
          title: "Límite alcanzado",
          description: "Solo puedes seleccionar máximo 3 hoteles para el PDF.",
          variant: "destructive",
        });
        return prev;
      }

      setSelectedHotelSnapshots(currentSnapshots => ({
        ...currentSnapshots,
        [hotelId]: hotel
      }));

      return [...prev, hotelId];
    });
  };

  const handleRoomSelect = useCallback(async (hotel: HotelData, roomId: string) => {
    const hotelId = hotel.id;

    // 1. Update selection immediately for responsive UI
    setSelectedRooms(prev => ({
      ...prev,
      [hotelId]: roomId
    }));

    setSelectedHotelSnapshots(prev => ({
      ...prev,
      [hotelId]: hotel
    }));

    // 2. Find hotel and room data
    const room = hotel?.rooms.find(r => r.occupancy_id === roomId);

    // 3. Check if we have required data for makeBudget
    if (!room?.fare_id_broker || !hotel?.unique_id) {
      console.log('⚠️ [EXACT_PRICE] Missing fare_id_broker or unique_id, skipping makeBudget');
      return;
    }

    // 4. Generate price key for caching
    const priceKey = `${hotelId}-${roomId}`;

    // 5. Check if we already have exact price cached
    if (exactPrices[priceKey]) {
      console.log('✅ [EXACT_PRICE] Already have exact price for:', priceKey);
      return;
    }

    // 6. Show loading state
    setLoadingPrices(prev => ({ ...prev, [priceKey]: true }));

    try {
      console.log('💰 [EXACT_PRICE] Calling makeBudget for hotel:', hotel.name);

      // 7. Build passenger list from hotel search params or room data
      const occupancy = resolveHotelOccupancyForBudget(hotel, room);
      console.log('👥 [EXACT_PRICE] Resolved occupancy:', {
        adults: occupancy.adults,
        children: occupancy.children,
        infants: occupancy.infants,
        childrenAges: occupancy.childrenAges,
        signature: occupancy.signature
      });

      // 8. Call makeBudget
      // Use xml_occupancy_id (from EUROVIPS XML) for makeBudget, fallback to occupancy_id
      const result = await makeBudget({
        fareId: hotel.unique_id,
        fareIdBroker: room.fare_id_broker,
        checkinDate: hotel.check_in,
        checkoutDate: hotel.check_out,
        occupancies: [{
          occupancyId: room.xml_occupancy_id || room.occupancy_id,
          passengers: occupancy.passengers
        }]
      });

      // 9. Save exact price only when we have agency net parity (not gross fallback)
      const exactAgencyNet = result.agencyPricing?.netoAgencia;
      if (result.success && exactAgencyNet && exactAgencyNet > 0) {
        console.log('✅ [EXACT_PRICE] Got exact agency net price:', exactAgencyNet, result.currency);
        setExactPrices(prev => ({
          ...prev,
          [priceKey]: {
            price: exactAgencyNet,
            currency: result.currency || 'USD',
            budgetId: result.budgetId || ''
          }
        }));
      } else if (result.success) {
        console.warn('⚠️ [EXACT_PRICE] makeBudget succeeded without agency net parity, keeping approximate label:', {
          hasAgencyPricing: !!result.agencyPricing,
          subTotalAmount: result.subTotalAmount
        });
      } else {
        console.warn('⚠️ [EXACT_PRICE] makeBudget failed:', {
          success: result.success,
          error: result.error,
          hasAgencyPricing: !!result.agencyPricing,
          subTotalAmount: result.subTotalAmount
        });
        // Mark as failed - show "Consultar disponibilidad" in UI
        setFailedPrices(prev => ({ ...prev, [priceKey]: true }));
      }
    } catch (error) {
      console.error('❌ [EXACT_PRICE] Error getting exact price:', error);
      // Mark as failed on error
      setFailedPrices(prev => ({ ...prev, [priceKey]: true }));
    } finally {
      setLoadingPrices(prev => ({ ...prev, [priceKey]: false }));
    }
  }, [exactPrices]);

  const handleGeneratePdf = async () => {
    // Validate selections
    if (selectedFlights.length === 0 && selectedHotels.length === 0) {
      toast({
        title: "Selección requerida",
        description: "Selecciona al menos un vuelo o un hotel para generar el PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Usar vuelos del cache filtrado cuando está activo, sino los originales
      // Esto es CRÍTICO: cuando hay filtros activos, los vuelos mostrados vienen de filteredFlights
      // (cache completo filtrado), no de combinedData.flights (solo Top 5 original)
      const flightsSource = hasCache ? filteredFlights : combinedData.flights;

      // 🔍 DEBUG: Log flights source BEFORE filtering
      console.log('🔍 [CombinedTravelSelector] Flights source:', hasCache ? 'filteredFlights (cache)' : 'combinedData.flights (original)');
      console.log(`🔍 [CombinedTravelSelector] Total flights in source: ${flightsSource.length}`);
      flightsSource.forEach((flight, idx) => {
        console.log(`   Flight ${idx + 1}: id=${flight.id}, transfers=${JSON.stringify(flight.transfers)}, travel_assistance=${JSON.stringify(flight.travel_assistance)}`);
      });

      // Get selected data from the correct source
      const selectedFlightDataRaw = flightsSource.filter(flight =>
        selectedFlights.includes(flight.id!)
      );

      // Transform flights to use selected options for each leg
      // This ensures PDF shows the itinerary options the user selected
      const selectedFlightData = selectedFlightDataRaw.map(flight => {
        const flightOptions = selectedFlightOptions[flight.id!] || {};

        // If no options were selected (all use default 0), return as-is
        if (Object.keys(flightOptions).length === 0) {
          return flight;
        }

        // Transform legs to use selected option data
        const transformedLegs = flight.legs.map((leg, legIndex) => {
          const legAny = leg as any;
          const options = legAny.options || [];
          const selectedOptionIndex = flightOptions[legIndex] ?? 0;
          const selectedOption = options[selectedOptionIndex] || options[0];

          // If no options or only one option, return leg as-is
          if (!selectedOption || options.length <= 1) {
            return leg;
          }

          // Extract data from selected option's segments
          const segments = selectedOption.segments || [];
          const firstSegment = segments[0];
          const lastSegment = segments[segments.length - 1] || firstSegment;

          // Calculate layovers from selected option
          const layovers: any[] = [];
          if (segments.length > 1) {
            for (let i = 0; i < segments.length - 1; i++) {
              const seg = segments[i];
              const nextSeg = segments[i + 1];
              layovers.push({
                destination_city: getCityNameFromCode(seg.arrival?.airportCode || ''),
                destination_code: seg.arrival?.airportCode || '',
                waiting_time: calculateConnectionTime(seg, nextSeg)
              });
            }
          }

          // Calculate duration
          const duration = selectedOption.duration
            ? `${Math.floor(selectedOption.duration / 60)}h ${selectedOption.duration % 60}m`
            : leg.duration;

          // Check if arrival is next day
          const arrivalNextDay = (firstSegment?.departure?.date && lastSegment?.arrival?.date)
            ? new Date(lastSegment.arrival.date).getTime() > new Date(firstSegment.departure.date).getTime()
            : leg.arrival_next_day;

          return {
            ...leg,
            departure: {
              city_code: firstSegment?.departure?.airportCode || leg.departure.city_code,
              city_name: getCityNameFromCode(firstSegment?.departure?.airportCode || '') || leg.departure.city_name,
              time: firstSegment?.departure?.time || leg.departure.time
            },
            arrival: {
              city_code: lastSegment?.arrival?.airportCode || leg.arrival.city_code,
              city_name: getCityNameFromCode(lastSegment?.arrival?.airportCode || '') || leg.arrival.city_name,
              time: lastSegment?.arrival?.time || leg.arrival.time
            },
            duration,
            layovers,
            arrival_next_day: arrivalNextDay,
            // Preserve options with selected one at index 0 for PDF processing
            options: [selectedOption, ...options.filter((_: any, i: number) => i !== selectedOptionIndex)]
          };
        });

        return {
          ...flight,
          legs: transformedLegs
        };
      });

      // 🔍 DEBUG: Log selected flights AFTER filtering
      console.log('🔍 [CombinedTravelSelector] Selected flights AFTER filter:');
      selectedFlightData.forEach((flight, idx) => {
        console.log(`   Flight ${idx + 1}: transfers=${JSON.stringify(flight.transfers)}, travel_assistance=${JSON.stringify(flight.travel_assistance)}`);
      });

      const selectedHotelData = selectedHotels
        .map(hotelId => selectedHotelSnapshots[hotelId] || hotelUniverse.get(hotelId))
        .filter((hotel): hotel is HotelData => !!hotel);

      console.log('🔍 [CombinedTravelSelector] Selected hotel snapshots:', {
        selectedCount: selectedHotelData.length,
        availableSnapshots: Object.keys(selectedHotelSnapshots).length,
        groupedSegments: groupedHotelSegments.length
      });

      // Debug: Log hotel categories in selectedHotelData
      console.log('🏨 [DEBUG] Selected hotels BEFORE mapping:', selectedHotelData.map((h, i) => ({
        index: i + 1,
        name: h.name,
        category: h.category,
        category_type: typeof h.category,
        address: h.address,
        city: h.city
      })));

      console.log('📄 Generating PDF for:', {
        flights: selectedFlightData.length,
        hotels: selectedHotelData.length
      });

      let pdfUrl;

      // Prepare hotel data with selected rooms (using exact prices when available)
      const selectedHotelDataWithRooms = selectedHotelData.map(hotel => {
        const selectedRoomId = selectedRooms[hotel.id];
        const selectedRoom = hotel.rooms.find(room => room.occupancy_id === selectedRoomId);

        // Check for exact price
        const priceKey = `${hotel.id}-${selectedRoomId}`;
        const exactPrice = exactPrices[priceKey];

        console.log(`🏨 Preparing hotel ${hotel.name} for PDF:`, {
          hotel_id: hotel.id,
          hotel_nights: hotel.nights,
          category: hotel.category,
          category_type: typeof hotel.category,
          address: hotel.address,
          city: hotel.city,
          selected_room_id: selectedRoomId,
          has_exact_price: !!exactPrice,
          exact_price: exactPrice?.price,
          selected_room: selectedRoom ? {
            type: selectedRoom.type,
            price_per_night: selectedRoom.price_per_night,
            total_price: selectedRoom.total_price,
            currency: selectedRoom.currency
          } : 'NO_ROOM_SELECTED',
          fallback_room: hotel.rooms[0] ? {
            type: hotel.rooms[0].type,
            price_per_night: hotel.rooms[0].price_per_night,
            total_price: hotel.rooms[0].total_price,
            currency: hotel.rooms[0].currency
          } : 'NO_ROOMS_AVAILABLE'
        });

        // Build room with exact price if available
        const roomToUse = selectedRoom || hotel.rooms[0];
        const roomWithExactPrice = exactPrice && roomToUse ? {
          ...roomToUse,
          total_price: exactPrice.price,
          price_per_night: hotel.nights > 0 ? exactPrice.price / hotel.nights : exactPrice.price,
          currency: exactPrice.currency
        } : roomToUse;

        // Explicitly preserve all hotel fields including category
        const hotelWithRoom: HotelDataWithSelectedRoom = {
          ...hotel,
          category: hotel.category || '', // Explicitly preserve category
          address: hotel.address || '', // Explicitly preserve address
          city: hotel.city || '', // Explicitly preserve city
          segmentId: hotel.segmentId,
          segmentCity: hotel.segmentCity,
          segmentCheckIn: hotel.segmentCheckIn,
          segmentCheckOut: hotel.segmentCheckOut,
          segmentOrder: hotel.segmentOrder,
          selectedRoom: roomWithExactPrice // Use room with exact price if available
        };

        console.log(`✅ Hotel ${hotel.name} prepared with category:`, {
          original_category: hotel.category,
          prepared_category: hotelWithRoom.category,
          has_category: !!hotelWithRoom.category,
          original_address: hotel.address,
          prepared_address: hotelWithRoom.address,
          using_exact_price: !!exactPrice,
          final_total_price: hotelWithRoom.selectedRoom?.total_price
        });

        return hotelWithRoom;
      });

      // Determine which PDF type to generate
      if (selectedFlightData.length > 0 && selectedHotelDataWithRooms.length > 0) {
        // Combined travel PDF (flights + hotels)
        console.log('🌟 Generating COMBINED travel PDF with agency:', agencyId);
        pdfUrl = await generateCombinedTravelPdf(selectedFlightData, selectedHotelDataWithRooms, agencyId);
      } else if (selectedFlightData.length > 0) {
        // Flight-only PDF (existing functionality)
        console.log('✈️ Generating FLIGHT-only PDF with agency:', agencyId);
        pdfUrl = await generateFlightPdf(selectedFlightData, agencyId);
      } else if (selectedHotelDataWithRooms.length > 0) {
        // Hotel-only PDF (use combined template with empty flights)
        console.log('🏨 Generating HOTEL-only PDF with agency:', agencyId);
        pdfUrl = await generateCombinedTravelPdf([], selectedHotelDataWithRooms, agencyId);
      }

      if (pdfUrl?.document_url && onPdfGenerated) {
        await onPdfGenerated(pdfUrl.document_url, selectedFlightData, selectedHotelData);
      }

      if (pdfUrl?.success) {
        toast({
          title: "PDF Generado",
          description: `Tu cotización de ${selectedFlightData.length > 0 && selectedHotelData.length > 0 ? 'viaje combinado' : selectedFlightData.length > 0 ? 'vuelos' : 'hoteles'} está lista para descargar.`,
        });
      } else {
        throw new Error(pdfUrl?.error || 'Error desconocido');
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getAvailabilityStatus = (availability: number) => {
    if (availability >= 3) return { text: 'Disponible', icon: CheckCircle, color: 'bg-green-500' };
    if (availability >= 2) return { text: 'Consultar', icon: AlertCircle, color: 'bg-yellow-500' };
    return { text: 'No disponible', icon: AlertCircle, color: 'bg-red-500' };
  };

  const formatTime = (timeStr: string) => {
    return timeStr || 'N/A';
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatPassengerText = (adults: number, children: number = 0, infants: number = 0) => {
    const parts = [];

    if (adults > 0) {
      parts.push(`${adults} adult${adults > 1 ? 'os' : 'o'}`);
    }

    if (children > 0) {
      parts.push(`${children} niñ${children > 1 ? 'os' : 'o'}`);
    }

    if (infants > 0) {
      parts.push(`${infants} bebé${infants > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'por persona';
    }

    const totalPassengers = adults + children + infants;
    const passengerText = parts.join(' + ');

    return `para ${passengerText} (${totalPassengers} ${totalPassengers > 1 ? 'personas' : 'persona'})`;
  };

  const formatSegmentTabLabel = (checkIn?: string, checkOut?: string) => {
    if (!checkIn || !checkOut) return 'Fechas sin definir';

    try {
      const formatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      const start = new Date(`${checkIn}T00:00:00`).toLocaleDateString('es-AR', formatOptions).replace('.', '');
      const end = new Date(`${checkOut}T00:00:00`).toLocaleDateString('es-AR', formatOptions).replace('.', '');
      return `${start} - ${end}`;
    } catch {
      return `${checkIn} - ${checkOut}`;
    }
  };

  const formatCityLabel = (city?: string) => {
    if (!city) return 'Destino';

    const lowerJoiners = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

    return city
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((word, index) => {
        if (!word) return word;
        if (index > 0 && lowerJoiners.has(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const formatMealPlanLabel = (mealPlan?: string) => {
    switch (mealPlan) {
      case 'all_inclusive':
        return 'All Inclusive';
      case 'breakfast':
        return 'Desayuno';
      case 'half_board':
        return 'Media pensión';
      case 'room_only':
        return 'Solo habitación';
      default:
        return mealPlan ? mealPlan.replace(/_/g, ' ') : '';
    }
  };

  const formatRoomTypeLabel = (roomType?: string) => {
    switch (roomType) {
      case 'single':
        return 'Single';
      case 'double':
        return 'Doble';
      case 'triple':
        return 'Triple';
      default:
        return roomType ? roomType.replace(/_/g, ' ') : '';
    }
  };

  const selectedHotelsBySegment = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; order: number }>();

    selectedHotels.forEach(hotelId => {
      const hotel = selectedHotelSnapshots[hotelId] || hotelUniverse.get(hotelId);
      if (!hotel) return;

      const segmentKey = getHotelSegmentKey(hotel);
      const segmentLabel = hotel.segmentCity || hotel.city || 'Hoteles';
      const current = counts.get(segmentKey);

      counts.set(segmentKey, {
        label: formatCityLabel(segmentLabel),
        count: (current?.count || 0) + 1,
        order: hotel.segmentOrder ?? current?.order ?? 0
      });
    });

    return Array.from(counts.values()).sort((a, b) => a.order - b.order);
  }, [getHotelSegmentKey, hotelUniverse, selectedHotelSnapshots, selectedHotels]);

  return (
    <div className="space-y-4 w-full">
      {/* Tabs for flights and hotels */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-2" data-testid="results-tabs">
          {(combinedData.requestType === 'combined' || combinedData.requestType === 'flights-only') && (
            <TabsTrigger value="flights" className="flex items-center space-x-2" data-testid="results-tab-flights">
              <Plane className="h-4 w-4" />
              <span>Vuelos ({hasCache ? filteredFlights.length : combinedData.flights.length})</span>
            </TabsTrigger>
          )}
          {(combinedData.requestType === 'combined' || combinedData.requestType === 'hotels-only') && (
            <TabsTrigger value="hotels" className="flex items-center space-x-2" data-testid="results-tab-hotels">
              <Hotel className="h-4 w-4" />
              <span>Hoteles ({hotelTabCount})</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Flights Tab */}
        {(combinedData.requestType === 'combined' || combinedData.requestType === 'flights-only') && (
          <TabsContent value="flights" className="space-y-2">
            {/* Dynamic Filter Chips */}
            {hasCache && distribution && filterStats && (
              <FilterChips
                distribution={distribution}
                activeFilters={activeFilters}
                filterStats={filterStats}
                onFilterChange={applyFilter}
                onClearAll={clearAllFilters}
                onToggleAirline={toggleAirline}
              />
            )}

            {/* Usar vuelos filtrados (filteredFlights) cuando hay cache, sino los originales */}
            {(hasCache ? filteredFlights : combinedData.flights).map((flight, index) => {
              const isSelected = selectedFlights.includes(flight.id!);

              return (
                <Card
                  key={flight.id}
                  data-testid={`flight-card-${flight.id || index}`}
                  className={`transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          data-testid={`select-flight-${flight.id || index}`}
                          checked={isSelected}
                          onCheckedChange={() => handleFlightToggle(flight.id!)}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <Plane className="h-3 w-3 text-primary" />
                            <span className="font-medium text-sm">{flight.airline.name}</span>
                            <Badge variant="secondary" className="text-xs px-1 py-0">{flight.airline.code}</Badge>
                            {flight.cabin?.brandName && (
                              <Badge
                                variant={
                                  flight.cabin.class === 'F' ? 'destructive' :
                                  ['C', 'J'].includes(flight.cabin.class) ? 'default' : 'secondary'
                                }
                                className="text-xs px-1 py-0"
                              >
                                {flight.cabin.brandName}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 mt-0.5 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{flight.adults} adult{flight.adults > 1 ? 'os' : 'o'}</span>
                              {flight.childrens > 0 && <span>, {flight.childrens} niño{flight.childrens > 1 ? 's' : ''}</span>}
                              {flight.infants > 0 && <span>, {flight.infants} bebé{flight.infants > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          {formatPrice(flight.price.amount, flight.price.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPassengerText(flight.adults, flight.childrens, flight.infants)}
                        </div>
                      </div>
                    </div>

                    <Separator className="my-2" />

                    {/* Visual Flight Itinerary with Connections */}
                    <FlightItinerary
                      flight={flight}
                      selectedOptionPerLeg={selectedFlightOptions[flight.id!] || {}}
                      onSelectOption={(legIndex, optionIndex) => setSelectedOption(flight.id!, legIndex, optionIndex)}
                    />
                  </CardContent>
                </Card>
              );
            })}

            {/* Mensaje cuando no hay vuelos después de filtrar */}
            {hasCache && filteredFlights.length === 0 && combinedData.flights.length > 0 && (
              <Card data-testid="flights-empty-state">
                <CardContent className="p-6 text-center">
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No hay vuelos con los filtros seleccionados</p>
                  <p className="text-sm text-muted-foreground mt-1">Prueba cambiando o limpiando los filtros</p>
                  <div className="mt-3">
                    <Button variant="outline" onClick={clearAllFilters}>
                      Limpiar filtros
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mensaje cuando no hay vuelos en la búsqueda original */}
            {combinedData.flights.length === 0 && (
              <Card data-testid="flights-empty-state">
                <CardContent className="p-6 text-center">
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No se encontraron vuelos directos para este itinerario</p>
                  <p className="text-sm text-muted-foreground mt-1">¿Quieres repetir la búsqueda permitiendo escalas?</p>
                  <div className="mt-3">
                    <Button
                      onClick={() => {
                        try {
                          window.dispatchEvent(new CustomEvent('chat:retryWithStops'));
                        } catch (e) { }
                      }}
                    >
                      Repetir búsqueda con escalas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Hotels Tab */}
        {(combinedData.requestType === 'combined' || combinedData.requestType === 'hotels-only') && (
          <TabsContent value="hotels" className="space-y-2">
            {hasGroupedHotelSegments && activeHotelSegment && (
              <Tabs value={activeHotelSegment.uiSegmentId} onValueChange={setActiveHotelSegmentId} className="space-y-3">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-muted/60 p-1">
                  {groupedHotelSegments.map(segment => (
                    <TabsTrigger
                      key={segment.uiSegmentId}
                      value={segment.uiSegmentId}
                      className="flex h-auto min-h-10 flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left"
                    >
                      <span className="font-medium">{formatCityLabel(segment.city)}</span>
                      <span className="text-[11px] opacity-80">
                        {formatSegmentTabLabel(segment.checkinDate, segment.checkoutDate)}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {hasGroupedHotelSegments && activeHotelSegment && (
              <Card className="border-dashed bg-muted/30">
                <CardContent className="flex flex-col gap-3 p-3 text-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{formatCityLabel(activeHotelSegment.city)}</p>
                    <p className="text-muted-foreground">
                      {formatSegmentTabLabel(activeHotelSegment.checkinDate, activeHotelSegment.checkoutDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeSegmentSelectionCount} de 2 hoteles seleccionados
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {activeHotelSegment.requestedMealPlan && (
                      <Badge variant="secondary" className="px-2 py-1">
                        Plan: {formatMealPlanLabel(activeHotelSegment.requestedMealPlan)}
                      </Badge>
                    )}
                    {activeHotelSegment.requestedRoomType && (
                      <Badge variant="outline" className="px-2 py-1">
                        Habitación: {formatRoomTypeLabel(activeHotelSegment.requestedRoomType)}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeHotelSegment?.error && (
              <Card data-testid="hotels-segment-error">
                <CardContent className="p-6 text-center">
                  <AlertCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{activeHotelSegment.error}</p>
                </CardContent>
              </Card>
            )}

            {/* Dynamic Filter Chips for Hotels - Solo Plan de Comidas */}
            {!activeHotelSegment?.error && hasHotelCache && hotelDistribution && (
              <HotelFilterChips
                distribution={hotelDistribution}
                activeMealPlan={activeMealPlan}
                totalCount={hotelTotalCount}
                filteredCount={hotelFilteredCount}
                onMealPlanChange={setMealPlan}
              />
            )}

            {/* Usar hoteles filtrados cuando hay cache, sino los originales */}
            {!activeHotelSegment?.error && activeHotels.map((hotel) => {
              const isSelected = selectedHotels.includes(hotel.id);

              return (
                <Card
                  key={hotel.id}
                  data-testid={`hotel-card-${hotel.id || 'unknown'}`}
                  className={`transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-2">
                      {/* Checkbox */}
                      <Checkbox
                        data-testid={`select-hotel-${hotel.id || 'unknown'}`}
                        checked={isSelected}
                        onCheckedChange={() => handleHotelToggle(hotel)}
                        className="mt-1"
                      />

                      {/* Hotel thumbnail */}
                      <div
                        className={`relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 ${hotel.images?.length ? 'cursor-pointer hover:opacity-90' : ''} transition-opacity`}
                        onClick={() => hotel.images?.length && setGalleryHotel(hotel)}
                      >
                        {hotel.images?.[0] ? (
                          <img
                            src={hotel.images[0]}
                            alt={hotel.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Hotel className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                        {hotel.images && hotel.images.length > 1 && (
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                            +{hotel.images.length - 1}
                          </div>
                        )}
                      </div>

                      {/* Hotel info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Hotel className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{hotel.name}</span>
                          {hotel.category && (
                            <Badge variant="outline" className="text-xs px-1 py-0 flex-shrink-0">
                              {hotel.category}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {hotel.city && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{formatCityLabel(hotel.city).slice(0, 50)}</span>
                            </div>
                          )}
                          {hotel.address && (
                            <div className="text-xs truncate">{hotel.address.slice(0, 80)}</div>
                          )}
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span>{hotel.check_in || 'N/A'} → {hotel.check_out || 'N/A'}</span>
                            </div>
                            <span>({hotel.nights} noche{hotel.nights > 1 ? 's' : ''})</span>
                          </div>
                          <div className="flex items-center space-x-3 mt-0.5 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{hotel.search_adults || 1} adult{(hotel.search_adults || 1) > 1 ? 'os' : 'o'}</span>
                              {(hotel.search_children || 0) > 0 && <span>, {hotel.search_children} niño{hotel.search_children! > 1 ? 's' : ''}</span>}
                              {(hotel.search_infants || 0) > 0 && <span>, {hotel.search_infants} bebé{hotel.search_infants! > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Hotel rooms - Using RoomGroupSelector */}
                    <RoomGroupSelector
                      rooms={hotel.rooms}
                      selectedRoomId={selectedRooms[hotel.id]}
                      onRoomSelect={(roomId) => handleRoomSelect(hotel, roomId)}
                      isDisabled={!isSelected}
                      maxInitialRooms={3}
                      requestedRoomType={activeHotelSegment?.requestedRoomType ?? combinedData.requestedRoomType}
                      requestedMealPlan={activeHotelSegment?.requestedMealPlan ?? combinedData.requestedMealPlan}
                      exactPrices={exactPrices}
                      loadingPrices={loadingPrices}
                      failedPrices={failedPrices}
                      hotelId={hotel.id}
                      nights={hotel.nights}
                    />
                  </CardContent>
                </Card>
              );
            })}

            {/* Mensaje cuando no hay hoteles después de filtrar */}
            {!activeHotelSegment?.error && hasHotelCache && activeHotels.length === 0 && activeBaseHotels.length > 0 && (
              <Card data-testid="hotels-empty-state">
                <CardContent className="p-6 text-center">
                  <Hotel className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No hay hoteles con el plan de comidas seleccionado</p>
                  <p className="text-sm text-muted-foreground mt-1">Prueba seleccionando otro plan de comidas</p>
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => setMealPlan(null)}>
                      Limpiar filtro
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mensaje cuando no hay hoteles en la búsqueda original */}
            {!activeHotelSegment?.error && activeBaseHotels.length === 0 && (
              <Card data-testid="hotels-empty-state">
                <CardContent className="p-6 text-center">
                  <Hotel className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    {activeHotelSegment ? `No se encontraron hoteles disponibles en ${activeHotelSegment.city}` : 'No se encontraron hoteles disponibles'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Verificando códigos de destino en EUROVIPS</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Generate PDF Button */}
      {((combinedData.flights && combinedData.flights.length > 0) || (combinedData.hotels && combinedData.hotels.length > 0)) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="font-medium">Generar Cotización</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedFlights.length > 0 && `${selectedFlights.length} vuelo(s)`}
                  {selectedFlights.length > 0 && selectedHotels.length > 0 && ' y '}
                  {selectedHotels.length > 0 && `${selectedHotels.length} hotel(es)`} seleccionado(s)
                </p>
                {selectedHotelsBySegment.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {selectedHotelsBySegment.map(segment => (
                      <p key={segment.label}>
                        {segment.label}: {segment.count} hotel(es) seleccionado(s)
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <Button
                data-testid="generate-pdf-button"
                onClick={handleGeneratePdf}
                disabled={(selectedFlights.length === 0 && selectedHotels.length === 0) || isGenerating}
                className="flex items-center space-x-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                <span>{isGenerating ? 'Generando...' : 'Generar PDF'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hotel Gallery Dialog */}
      <Dialog open={!!galleryHotel} onOpenChange={() => setGalleryHotel(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Hotel className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">{galleryHotel?.name}</h3>
              {galleryHotel?.category && (
                <Badge variant="outline" className="text-xs">
                  {galleryHotel.category}
                </Badge>
              )}
            </div>
            {galleryHotel?.city && (
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{galleryHotel.city}</span>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {galleryHotel?.images?.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${galleryHotel.name} - ${idx + 1}`}
                  className="w-full aspect-[4/3] object-cover rounded-lg hover:opacity-95 transition-opacity"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CombinedTravelSelector;
