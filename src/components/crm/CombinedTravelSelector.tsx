import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { FlightData, HotelData, HotelDataWithSelectedRoom, CombinedTravelResults } from '@/types';
import { generateFlightPdf, generateCombinedTravelPdf } from '@/services/pdf/customPdfGenerator';
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
  Navigation,
  Plus
} from 'lucide-react';
import { formatTime } from '@/features/chat/utils/messageHelpers';
import { getCityNameFromCode } from '@/features/chat/utils/flightHelpers';
import { getResultSelectorCopy, LOCALE_BY_LANGUAGE, normalizeSupportedLanguage, type UserLanguage } from '@/features/chat/i18n/chatResultCopy';
import BaggageIcon from '@/components/ui/BaggageIcon';
import PeekCarousel from '@/components/ui/PeekCarousel';
import { supabase } from '@/integrations/supabase/client';

const ensureHttps = (url: string) =>
  url.startsWith('http://') ? url.replace('http://', 'https://') : url;

interface CombinedTravelSelectorProps {
  combinedData: CombinedTravelResults;
  conversationId?: string; // Add conversation ID to get agency_id
  onPdfGenerated?: (pdfUrl: string, selectedFlights: FlightData[], selectedHotels: HotelData[]) => Promise<void>;
  // "Agregar al itinerario" handlers — when present, the selector switches to cart mode:
  // each card shows an "Agregar al itinerario" button and the inline PDF flow is hidden.
  onAddFlight?: (flight: FlightData) => void;
  onAddHotel?: (hotel: HotelData) => void;
  responseLanguage?: UserLanguage | string;
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
const getBaggageTextFromLeg = (leg: any, airlineCode?: string, optionIndex: number = 0, language: UserLanguage = 'es'): string => {
  const copy = getResultSelectorCopy(language);
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
    parts.push(copy.checked(checkedPieces));
  }

  if (hasCarryOn) {
    parts.push(`1 ${copy.carryOn}`);
  }

  // Si no hay equipaje despachado ni carry-on, decidir según aerolínea
  if (parts.length === 0) {
    // Aerolíneas que muestran "Tarifa Light" cuando no hay equipaje
    const lightTarifAirlines = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];

    if (airlineCode && lightTarifAirlines.includes(airlineCode)) {
      return `1 ${copy.backpack}`;
    } else {
      // Para otras aerolíneas, consideramos que incluye carry-on básico
      return `(${copy.baggageFallback})`;
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

// Component to display flight itinerary with visual connections
interface FlightItineraryProps {
  flight: FlightData;
  selectedOptionPerLeg?: Record<number, number>;
  compact?: boolean;
  language?: UserLanguage;
}

const FlightItinerary: React.FC<FlightItineraryProps> = ({ flight, selectedOptionPerLeg = {}, compact = false, language = 'es' }) => {
  const copy = getResultSelectorCopy(language);
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
    <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-3"}>
      {flight.legs.map((leg, legIndex) => {
        const legType = leg.flight_type === 'outbound' ? copy.outbound : copy.return;
        const legIcon = leg.flight_type === 'outbound' ? <Plane className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />;
        const baseDate = leg.flight_type === 'outbound' ? flight.departure_date : (flight.return_date || flight.departure_date);

        // Get options from the leg (local structure: leg.options[])
        const legOptions = (leg as any).options || [];
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
          <div key={legIndex} className={`meridian-glass min-w-0 rounded-2xl ${compact ? 'p-2' : 'p-4'}`}>
            <div className={`flex items-center space-x-2 ${compact ? 'mb-2' : 'mb-4'}`}>
              {React.cloneElement(legIcon, { className: `${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-primary` })}
              <span className={`font-display italic text-foreground tracking-tight ${compact ? 'text-sm' : 'text-base'}`}>{legType}</span>
              <div className="ml-auto flex items-center gap-2">
                <BaggageIcon
                  {...baggageInfo}
                  size="sm"
                  showTooltip={true}
                  className="text-foreground"
                />
                <span className={`font-utility font-bold uppercase tracking-[0.08em] text-foreground ${compact ? 'max-w-[5rem] truncate text-[9px]' : 'text-[11px]'}`}>
                  {getBaggageTextFromLeg(leg, flight.airline.code, selectedOptionIndex, language)}
                </span>
              </div>
            </div>

            {/* Vuelo summary pill — flat surface (no glass, avoids stacking with parent) */}
            <div className={compact ? "space-y-2" : "space-y-3"}>
              <div className={`flex items-center justify-between rounded-2xl border border-border/40 bg-foreground/[0.03] ${compact ? 'p-2' : 'p-3'}`}>
                <div className={`flex min-w-0 items-center ${compact ? 'space-x-2' : 'space-x-3'}`}>
                  <div className={`rounded-full bg-primary/20 ${compact ? 'p-1.5' : 'p-2'}`}>
                    <Navigation className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-primary`} />
                  </div>
                  <div className="min-w-0">
                    <div className={`truncate font-display italic text-foreground tracking-tight ${compact ? 'text-sm' : 'text-base'}`}>{copy.flightLeg(legType)}</div>
                    <div className={`font-mono tracking-[0.08em] uppercase text-muted-foreground ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                      {leg.duration}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`flex items-center justify-between ${compact ? 'px-1' : 'px-3'}`}>
                <div className="min-w-0 text-center">
                  <div className={`font-display italic text-foreground tracking-tight ${compact ? 'text-xl' : 'text-2xl'}`}>{leg.departure.city_code}</div>
                  <div className={`font-mono tracking-[0.05em] text-foreground ${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'}`}>{leg.departure.time}</div>
                  <div className={`font-mono tracking-[0.08em] uppercase text-muted-foreground ${compact ? 'text-[8px]' : 'mt-0.5 text-[10px]'}`}>{formatDate(baseDate)}</div>
                  <div className={`truncate font-display italic text-muted-foreground ${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'}`}>{leg.departure.city_name}</div>
                </div>

                <div className={`flex flex-1 items-center justify-center ${compact ? 'px-1' : 'px-2'}`}>
                  <div className="h-px bg-gradient-to-r from-transparent to-primary/30 flex-1"></div>
                  <Plane className={`${compact ? 'mx-1 h-3.5 w-3.5' : 'mx-2 h-4 w-4'} text-primary`} />
                  <div className="h-px bg-gradient-to-r from-primary/30 to-transparent flex-1"></div>
                </div>

                <div className="min-w-0 text-center">
                  <div className={`font-display italic text-foreground tracking-tight ${compact ? 'text-xl' : 'text-2xl'}`}>{leg.arrival.city_code}</div>
                  <div className={`flex items-center justify-center gap-1 font-mono tracking-[0.05em] text-foreground ${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'}`}>
                    <span>{formatTime(leg.arrival.time)}</span>
                    {arrivalNextDay && (
                      <span className="font-utility text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">+1</span>
                    )}
                  </div>
                  <div className={`font-mono tracking-[0.08em] uppercase text-muted-foreground ${compact ? 'text-[8px]' : 'mt-0.5 text-[10px]'}`}>{formatDate(arrivalDate)}</div>
                  <div className={`truncate font-display italic text-muted-foreground ${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'}`}>{leg.arrival.city_name}</div>
                </div>
              </div>

              {/* Show layovers if present */}
              {leg.layovers && leg.layovers.length > 0 && (
                <div className={compact ? "space-y-1 pt-0.5" : "space-y-2 pt-1"}>
                  {leg.layovers.map((layover, layoverIndex) => (
                    <div key={layoverIndex} className="flex justify-center">
                      <div className={`rounded-2xl border border-primary/25 bg-primary/[0.06] ${compact ? 'w-full px-2 py-2' : 'min-w-[220px] px-4 py-2.5'}`}>
                        <div className="text-center">
                          <div className={`flex items-center justify-center gap-1.5 ${compact ? 'mb-1' : 'mb-1.5'}`}>
                            <Timer className="h-3 w-3 text-primary" />
                            <span className={`font-utility font-bold uppercase tracking-[0.18em] text-primary ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{copy.connection}</span>
                          </div>
                          <div className={`font-mono font-bold tracking-[0.08em] text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                            {layover.destination_code} · {layover.waiting_time === 'Escala técnica' ? copy.technicalStop : layover.waiting_time}
                          </div>
                          <div className={`font-utility uppercase tracking-[0.18em] text-muted-foreground ${compact ? 'mt-0.5 text-[7px]' : 'mt-1 text-[9px]'}`}>{copy.terminalChange}</div>
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
  onPdfGenerated,
  onAddFlight,
  onAddHotel,
  responseLanguage
}) => {
  const language = normalizeSupportedLanguage(responseLanguage);
  const locale = LOCALE_BY_LANGUAGE[language];
  const copy = getResultSelectorCopy(language);
  const { t: tChat } = useTranslation('chat');
  const isCartMode = Boolean(onAddFlight || onAddHotel);
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedHotelSnapshots, setSelectedHotelSnapshots] = useState<Record<string, HotelData>>({});
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  // Track selected option per leg for each flight: flightId -> { legIndex -> optionIndex }
  const [selectedFlightOptions, setSelectedFlightOptions] = useState<Record<string, Record<number, number>>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [agencyId, setAgencyId] = useState<string | undefined>(undefined);
  // Default tab honors the order the user expressed (combinedData.productOrder).
  // When user said "hotel, después vuelo" → productOrder[0]==='hotel' → open hotels tab.
  // Falls back to 'flights' for combined/flights-only when no order was expressed.
  const [activeTab, setActiveTab] = useState(() => {
    if (combinedData.requestType === 'hotels-only') return 'hotels';
    const firstFromOrder = combinedData.productOrder?.find(p => p === 'flight' || p === 'hotel');
    if (firstFromOrder === 'hotel') return 'hotels';
    return 'flights';
  });
  const [activeHotelSegmentId, setActiveHotelSegmentId] = useState<string | null>(null);
  // Exact price states for makeBudget integration
  const [exactPrices, setExactPrices] = useState<Record<string, { price: number; currency: string; budgetId: string }>>({});
  const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>({});
  const [failedPrices, setFailedPrices] = useState<Record<string, boolean>>({});
  // Hotel gallery state
  const [galleryHotel, setGalleryHotel] = useState<HotelData | null>(null);
  const { toast } = useToast();
  const hasLoggedData = useRef(false);
  const requestedPricesRef = useRef(new Set<string>());

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
  // Pasa el searchId para cargar TODOS los hoteles desde IndexedDB.
  // El rango de precio inicial proviene del parser cuando el usuario lo
  // pidió en el mensaje original (ej: "entre 2000 y 3000").
  const hotelInitialPriceRange = useMemo(
    () => ({
      min: combinedData.hotelSearchPriceMin ?? null,
      max: combinedData.hotelSearchPriceMax ?? null,
    }),
    [combinedData.hotelSearchPriceMin, combinedData.hotelSearchPriceMax],
  );

  const {
    displayedResults: filteredHotels,
    activeMealPlan,
    activePriceRange: activeHotelPriceRange,
    distribution: hotelDistribution,
    totalCount: hotelTotalCount,
    filteredCount: hotelFilteredCount,
    hasCache: hasHotelCache,
    setMealPlan,
    setPriceRange: setHotelPriceRange,
    cacheResults: cacheHotelResults,
    clearCache: clearHotelCache,
  } = useHotelResultsCache(
    combinedData.hotelSegments?.length
      ? combinedData.hotelSegments.find((segment, index) => `${segment.segmentId || 'hotel-segment'}-${index}` === activeHotelSegmentId)?.hotelSearchId
      : combinedData.hotelSearchId,
    hotelInitialPriceRange,
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
    // When no meal plan filter is active, prefer segment hotels (preserves chain interleaving).
    // Only use cache results when user has actively selected a meal plan filter.
    const hotels = (hasHotelCache && activeMealPlan) ? filteredHotels : activeBaseHotels;

    if (!hasGroupedHotelSegments || !activeHotelSegment) {
      return hotels;
    }

    return hotels.map(hotel => withSegmentContext(hotel, activeHotelSegment, activeHotelSegmentIndex));
  }, [
    activeBaseHotels,
    activeHotelSegment,
    activeHotelSegmentIndex,
    activeMealPlan,
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

  const visibleFlights = hasCache ? filteredFlights : combinedData.flights;

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
          title: copy.limitReached,
          description: copy.maxFlights,
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
            title: copy.limitReached,
            description: copy.maxHotelsForCity(formatCityLabel(hotel.segmentCity || hotel.city)),
            variant: "destructive",
          });
          return prev;
        }
      } else if (prev.length >= 3) {
        toast({
          title: copy.limitReached,
          description: copy.maxHotels,
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

  const fetchExactPrice = useCallback(async (hotel: HotelData, roomId: string) => {
    const hotelId = hotel.id;
    const room = hotel?.rooms.find(r => r.occupancy_id === roomId);

    if (!room?.fare_id_broker || !hotel?.unique_id) {
      console.log('⚠️ [AUTO_PRICE] Missing fare_id_broker or unique_id, skipping makeBudget for:', hotel.name);
      return;
    }

    const priceKey = `${hotelId}-${roomId}`;

    // Deduplicate using ref (avoids stale closure issues with state)
    if (requestedPricesRef.current.has(priceKey)) {
      return;
    }
    requestedPricesRef.current.add(priceKey);

    setLoadingPrices(prev => ({ ...prev, [priceKey]: true }));

    try {
      console.log('💰 [AUTO_PRICE] Calling makeBudget for hotel:', hotel.name);

      const occupancy = resolveHotelOccupancyForBudget(hotel, room);
      console.log('👥 [AUTO_PRICE] Resolved occupancy:', {
        adults: occupancy.adults,
        children: occupancy.children,
        infants: occupancy.infants,
        childrenAges: occupancy.childrenAges,
        signature: occupancy.signature
      });

      const result = await makeBudget({
        fareId: hotel.unique_id,
        fareIdBroker: room.fare_id_broker,
        checkinDate: hotel.check_in,
        checkoutDate: hotel.check_out,
        roomType: room.type,
        occupancies: [{
          occupancyId: room.xml_occupancy_id || room.occupancy_id,
          passengers: occupancy.passengers
        }]
      });

      const exactAgencyNet = result.agencyPricing?.netoAgencia;
      if (result.success && exactAgencyNet && exactAgencyNet > 0) {
        console.log('✅ [AUTO_PRICE] Got exact agency net price:', exactAgencyNet, result.currency);
        setExactPrices(prev => ({
          ...prev,
          [priceKey]: {
            price: exactAgencyNet,
            currency: result.currency || 'USD',
            budgetId: result.budgetId || ''
          }
        }));
      } else if (result.success && result.subTotalAmount && result.subTotalAmount > 0) {
        console.warn('⚠️ [AUTO_PRICE] makeBudget succeeded without agency net parity, using subTotalAmount as fallback:', {
          hasAgencyPricing: !!result.agencyPricing,
          subTotalAmount: result.subTotalAmount
        });
        setExactPrices(prev => ({
          ...prev,
          [priceKey]: {
            price: result.subTotalAmount!,
            currency: result.currency || 'USD',
            budgetId: result.budgetId || ''
          }
        }));
      } else if (result.success) {
        console.warn('⚠️ [AUTO_PRICE] makeBudget succeeded but no usable price:', {
          hasAgencyPricing: !!result.agencyPricing,
          subTotalAmount: result.subTotalAmount
        });
      } else {
        console.warn('⚠️ [AUTO_PRICE] makeBudget failed:', JSON.stringify({
          success: result.success,
          error: result.error,
          errorCode: result.errorCode,
          rawResponse: result.rawResponse,
          hasAgencyPricing: !!result.agencyPricing,
          subTotalAmount: result.subTotalAmount
        }, null, 2));
      }
    } catch (error) {
      console.error('❌ [AUTO_PRICE] Error getting exact price:', error);
    } finally {
      setLoadingPrices(prev => ({ ...prev, [priceKey]: false }));
    }
  }, []);

  const handleRoomSelect = useCallback(async (hotel: HotelData, roomId: string) => {
    setSelectedRooms(prev => ({ ...prev, [hotel.id]: roomId }));
    setSelectedHotelSnapshots(prev => ({ ...prev, [hotel.id]: hotel }));
    await fetchExactPrice(hotel, roomId);
  }, [fetchExactPrice]);

  // Auto-pricing: fetch exact prices for all hotels immediately after search results arrive
  useEffect(() => {
    const allHotels: HotelData[] = [];

    if (combinedData.hotels?.length) {
      allHotels.push(...combinedData.hotels);
    }
    if (combinedData.hotelSegments?.length) {
      combinedData.hotelSegments.forEach(segment => {
        if (segment.hotels?.length) allHotels.push(...segment.hotels);
      });
    }

    if (allHotels.length === 0) return;

    console.log(`🔄 [AUTO_PRICE] Auto-pricing ${allHotels.length} hotels post-search`);

    allHotels.forEach(hotel => {
      const room = hotel.rooms?.[0];
      if (room) fetchExactPrice(hotel, room.occupancy_id);
    });
  }, [combinedData.hotels, combinedData.hotelSegments, fetchExactPrice]);

  const handleGeneratePdf = async () => {
    // Validate selections
    if (selectedFlights.length === 0 && selectedHotels.length === 0) {
      toast({
        title: copy.selectionRequired,
        description: copy.selectOne,
        variant: "destructive",
      });
      return;
    }

    // Check if any selected hotel's room still has a loading price
    const hasLoadingPrices = selectedHotels.some(hotelId => {
      const roomId = selectedRooms[hotelId];
      return roomId && loadingPrices[`${hotelId}-${roomId}`];
    });
    if (hasLoadingPrices) {
      toast({
        title: copy.waitingExactPrices,
        description: copy.pricesUpdating,
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
        const quoteKind = selectedFlightData.length > 0 && selectedHotelData.length > 0
          ? copy.combinedTrip
          : selectedFlightData.length > 0
            ? copy.flightsKind
            : copy.hotelsKind;
        toast({
          title: copy.pdfGenerated,
          description: copy.pdfReady(quoteKind),
        });
      } else {
        throw new Error(pdfUrl?.error || 'Error desconocido');
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: copy.pdfError,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getAvailabilityStatus = (availability: number) => {
    if (availability >= 3) return { text: 'Disponible', icon: CheckCircle, color: 'bg-success' };
    if (availability >= 2) return { text: 'Consultar', icon: AlertCircle, color: 'bg-warning' };
    return { text: 'No disponible', icon: AlertCircle, color: 'bg-destructive' };
  };

  const formatTime = (timeStr: string) => {
    return timeStr || 'N/A';
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatPassengerText = (adults: number, children: number = 0, infants: number = 0) => {
    const parts = [];

    if (adults > 0) {
      parts.push(copy.adult(adults));
    }

    if (children > 0) {
      parts.push(copy.child(children));
    }

    if (infants > 0) {
      parts.push(copy.infant(infants));
    }

    if (parts.length === 0) {
      return copy.perPerson;
    }

    const totalPassengers = adults + children + infants;
    const passengerText = parts.join(' + ');

    return copy.passengerSummary(passengerText, totalPassengers);
  };

  const formatTravelersInline = (adults: number = 0, children: number = 0, infants: number = 0) => {
    const parts = [];
    if (adults > 0) parts.push(copy.adult(adults));
    if (children > 0) parts.push(copy.child(children));
    if (infants > 0) parts.push(copy.infant(infants));
    return parts.join(', ');
  };

  const formatSegmentTabLabel = (checkIn?: string, checkOut?: string) => {
    if (!checkIn || !checkOut) return copy.datesUndefined;

    try {
      const formatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      const start = new Date(`${checkIn}T00:00:00`).toLocaleDateString(locale, formatOptions).replace('.', '');
      const end = new Date(`${checkOut}T00:00:00`).toLocaleDateString(locale, formatOptions).replace('.', '');
      return `${start} - ${end}`;
    } catch {
      return `${checkIn} - ${checkOut}`;
    }
  };

  const formatCityLabel = (city?: string) => {
    if (!city) return copy.destination;

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
    return mealPlan && mealPlan in copy.mealPlans
      ? copy.mealPlans[mealPlan as keyof typeof copy.mealPlans]
      : mealPlan ? mealPlan.replace(/_/g, ' ') : '';
  };

  const formatRoomTypeLabel = (roomType?: string) => {
    return roomType && roomType in copy.roomTypes
      ? copy.roomTypes[roomType as keyof typeof copy.roomTypes]
      : roomType ? roomType.replace(/_/g, ' ') : '';
  };

  const formatCabinBrand = (brandName?: string) => {
    if (!brandName || language !== 'en') return brandName;
    return brandName.replace(/^Econ[oó]mica\b/i, 'Economy');
  };

  const selectedHotelsBySegment = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; order: number }>();

    selectedHotels.forEach(hotelId => {
      const hotel = selectedHotelSnapshots[hotelId] || hotelUniverse.get(hotelId);
      if (!hotel) return;

      const segmentKey = getHotelSegmentKey(hotel);
      const segmentLabel = hotel.segmentCity || hotel.city || copy.hotels;
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
    <div className="w-full min-w-0 space-y-4">
      {/* Tabs for flights and hotels */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-2" data-testid="results-tabs">
          {(() => {
            const showFlights = combinedData.requestType === 'combined' || combinedData.requestType === 'flights-only';
            const showHotels = combinedData.requestType === 'combined' || combinedData.requestType === 'hotels-only';
            // Trigger order honors what the user said first when productOrder is present.
            const order: Array<'flight' | 'hotel'> = (() => {
              if (combinedData.productOrder?.[0] === 'hotel') return ['hotel', 'flight'];
              if (combinedData.productOrder?.[0] === 'flight') return ['flight', 'hotel'];
              return ['flight', 'hotel'];
            })();
            return order.map(kind => {
              if (kind === 'flight' && showFlights) {
                return (
                  <TabsTrigger key="flights" value="flights" className="flex items-center space-x-2" data-testid="results-tab-flights">
                    <Plane className="h-4 w-4" />
                    <span>{copy.flights} ({hasCache ? filteredFlights.length : combinedData.flights.length})</span>
                  </TabsTrigger>
                );
              }
              if (kind === 'hotel' && showHotels) {
                return (
                  <TabsTrigger key="hotels" value="hotels" className="flex items-center space-x-2" data-testid="results-tab-hotels">
                    <Hotel className="h-4 w-4" />
                    <span>{copy.hotels} ({hotelTabCount})</span>
                  </TabsTrigger>
                );
              }
              return null;
            });
          })()}
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
                language={language}
              />
            )}

            {visibleFlights.length > 0 && (
              <PeekCarousel
                items={visibleFlights}
                getKey={(flight, i) => flight.id ?? i}
                prevLabel={copy.previousFlight}
                nextLabel={copy.nextFlight}
                minCardWidth={320}
                maxCardWidth={460}
                renderItem={(flight, index) => {
                  const isSelected = selectedFlights.includes(flight.id!);
                  return (
                    <Card
                      data-testid={`flight-card-${flight.id || index}`}
                      className={`transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {!isCartMode && (
                              <Checkbox
                                data-testid={`select-flight-${flight.id || index}`}
                                checked={isSelected}
                                onCheckedChange={() => handleFlightToggle(flight.id!)}
                              />
                            )}
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
                                    {formatCabinBrand(flight.cabin.brandName)}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-3 mt-0.5 text-xs text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <Users className="h-3 w-3" />
                                  <span>{formatTravelersInline(flight.adults, flight.childrens, flight.infants)}</span>
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
                        <FlightItinerary
                          flight={flight}
                          selectedOptionPerLeg={selectedFlightOptions[flight.id!] || {}}
                          compact={combinedData.requestType === 'combined'}
                          language={language}
                        />
                        {isCartMode && onAddFlight && (
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              data-testid={`add-flight-${flight.id || index}`}
                              onClick={() => onAddFlight(flight)}
                              className="h-8"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              {tChat('cart.addFlight')}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                }}
              />
            )}

            {/* Mensaje cuando no hay vuelos después de filtrar */}
            {hasCache && filteredFlights.length === 0 && combinedData.flights.length > 0 && (
              <Card data-testid="flights-empty-state">
                <CardContent className="p-6 text-center">
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">{copy.noFilteredFlights}</p>
                  <p className="text-sm text-muted-foreground mt-1">{copy.tryChangingFilters}</p>
                  <div className="mt-3">
                    <Button variant="outline" onClick={clearAllFilters}>
                      {copy.clearFilters}
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
                  <p className="text-muted-foreground">{copy.noDirectFlights}</p>
                  <p className="text-sm text-muted-foreground mt-1">{copy.retryWithStopsQuestion}</p>
                  <div className="mt-3">
                    <Button
                      onClick={() => {
                        try {
                          window.dispatchEvent(new CustomEvent('chat:retryWithStops'));
                        } catch (e) { }
                      }}
                    >
                      {copy.retryWithStops}
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
                      {copy.segmentSelectionCount(activeSegmentSelectionCount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {activeHotelSegment.requestedMealPlan && (
                      <Badge variant="secondary" className="px-2 py-1">
                        {copy.mealPlan}: {formatMealPlanLabel(activeHotelSegment.requestedMealPlan)}
                      </Badge>
                    )}
                    {activeHotelSegment.requestedRoomType && (
                      <Badge variant="outline" className="px-2 py-1">
                        {copy.room}: {formatRoomTypeLabel(activeHotelSegment.requestedRoomType)}
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

            {/* Dynamic Filter Chips for Hotels - Plan de Comidas + Precio */}
            {!activeHotelSegment?.error && hasHotelCache && hotelDistribution && (
              <HotelFilterChips
                distribution={hotelDistribution}
                activeMealPlan={activeMealPlan}
                activePriceRange={activeHotelPriceRange}
                totalCount={hotelTotalCount}
                filteredCount={hotelFilteredCount}
                onMealPlanChange={setMealPlan}
                onPriceRangeChange={setHotelPriceRange}
                language={language}
              />
            )}

            {/* Usar hoteles filtrados cuando hay cache, sino los originales */}
            {!activeHotelSegment?.error && activeHotels.length > 0 && (
              <PeekCarousel
                items={activeHotels}
                getKey={(hotel) => hotel.id}
                prevLabel={copy.previousHotels}
                nextLabel={copy.nextHotels}
                minCardWidth={320}
                maxCardWidth={460}
                itemClassName="h-full"
                renderItem={(hotel) => {
                  const isSelected = selectedHotels.includes(hotel.id);
                  return (
                    <Card
                      data-testid={`hotel-card-${hotel.id || 'unknown'}`}
                      className={`${isCartMode ? 'h-[28rem]' : 'h-[25rem]'} overflow-hidden transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <CardContent className="flex h-full flex-col p-4">
                        <div className="mb-2 flex min-h-[5.25rem] items-start gap-3">
                          {/* Checkbox */}
                          {!isCartMode && (
                            <Checkbox
                              data-testid={`select-hotel-${hotel.id || 'unknown'}`}
                              checked={isSelected}
                              onCheckedChange={() => handleHotelToggle(hotel)}
                              className="mt-1"
                            />
                          )}

                          {/* Hotel thumbnail */}
                          <div
                            className={`relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 ${hotel.images?.length ? 'cursor-pointer hover:opacity-90' : ''} transition-opacity`}
                            onClick={() => hotel.images?.length && setGalleryHotel(hotel)}
                          >
                            <div className="w-full h-full flex items-center justify-center">
                              <Hotel className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            {hotel.images?.[0] && (
                              <img
                                src={ensureHttps(hotel.images[0])}
                                alt={hotel.name}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            {hotel.images && hotel.images.length > 1 && (
                              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                                +{hotel.images.length - 1}
                              </div>
                            )}
                          </div>

                          {/* Hotel info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Hotel className="h-3 w-3 text-primary flex-shrink-0" />
                              <span className="min-w-0 truncate text-sm font-medium">{hotel.name}</span>
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
                              <div className="flex min-w-0 items-center space-x-4">
                                <div className="flex min-w-0 items-center space-x-1">
                                  <Calendar className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{hotel.check_in || 'N/A'} → {hotel.check_out || 'N/A'}</span>
                                </div>
                                <span className="shrink-0">({copy.nights(hotel.nights)})</span>
                              </div>
                              <div className="flex items-center space-x-3 mt-0.5 text-xs text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <Users className="h-3 w-3" />
                                  <span>{formatTravelersInline(hotel.search_adults || 1, hotel.search_children || 0, hotel.search_infants || 0)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        {/* Hotel rooms — scrolls vertically inside the card when room
                            options expand (e.g. "Show more options"). The flex-1 + min-h-0
                            combo keeps the scroll scoped here so the header and the
                            "Add to itinerary" button stay fixed. */}
                        <div
                          className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          <RoomGroupSelector
                            rooms={hotel.rooms}
                            selectedRoomId={selectedRooms[hotel.id]}
                            onRoomSelect={(roomId) => handleRoomSelect(hotel, roomId)}
                            isDisabled={!isCartMode && !isSelected}
                            maxInitialRooms={1}
                            compact
                            requestedRoomType={activeHotelSegment?.requestedRoomType ?? combinedData.requestedRoomType}
                            requestedMealPlan={activeHotelSegment?.requestedMealPlan ?? combinedData.requestedMealPlan}
                            exactPrices={exactPrices}
                            loadingPrices={loadingPrices}
                            failedPrices={failedPrices}
                            hotelId={hotel.id}
                            nights={hotel.nights}
                            language={language}
                          />
                        </div>
                        {isCartMode && onAddHotel && (
                          <div className="pt-3 flex justify-end shrink-0">
                            <Button
                              size="sm"
                              data-testid={`add-hotel-${hotel.id || 'unknown'}`}
                              onClick={() => onAddHotel(hotel)}
                              className="h-8"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              {tChat('cart.addHotel')}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                }}
              />
            )}

            {/* Mensaje cuando no hay hoteles después de filtrar */}
            {!activeHotelSegment?.error && hasHotelCache && activeHotels.length === 0 && activeBaseHotels.length > 0 && (
              <Card data-testid="hotels-empty-state">
                <CardContent className="p-6 text-center">
                  <Hotel className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">{copy.noFilteredHotels}</p>
                  <p className="text-sm text-muted-foreground mt-1">{copy.tryAnotherMealPlan}</p>
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => setMealPlan(null)}>
                      {copy.clearFilter}
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
                    {activeHotelSegment ? copy.noHotelsIn(activeHotelSegment.city) : copy.noHotels}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{copy.checkingEurovips}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Generate PDF Button — hidden in cart mode (PDF lives in TripPlannerWorkspace) */}
      {!isCartMode && ((combinedData.flights && combinedData.flights.length > 0) || (combinedData.hotels && combinedData.hotels.length > 0)) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="font-medium">{copy.generateQuote}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedFlights.length > 0 && copy.flightCount(selectedFlights.length)}
                  {selectedFlights.length > 0 && selectedHotels.length > 0 && copy.selectedJoin}
                  {selectedHotels.length > 0 && copy.hotelCount(selectedHotels.length)} {(selectedFlights.length > 0 || selectedHotels.length > 0) && copy.selected}
                </p>
                {selectedHotelsBySegment.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {selectedHotelsBySegment.map(segment => (
                      <p key={segment.label}>
                        {segment.label}: {copy.hotelSelectionCount(segment.count)}
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
                <span>{isGenerating ? copy.generating : copy.generatePdf}</span>
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
                  src={ensureHttps(img)}
                  alt={`${galleryHotel.name} - ${idx + 1}`}
                  className="w-full aspect-[4/3] object-cover rounded-lg hover:opacity-95 transition-opacity"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
