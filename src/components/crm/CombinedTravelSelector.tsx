import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { FlightData, HotelData, HotelDataWithSelectedRoom, CombinedTravelResults } from '@/types';
import { generateFlightPdf, generateCombinedTravelPdf } from '@/services/pdfMonkey';
import RoomGroupSelector from '@/components/ui/RoomGroupSelector';
import { useSearchResultsCache } from '@/features/chat/hooks/useSearchResultsCache';
import { FilterChips } from '@/features/chat/components';
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

// Función para obtener información de equipaje del primer segmento de un leg
const getBaggageInfoFromLeg = (leg: any) => {
  // Buscar en la estructura legs -> options -> segments
  if (leg?.options?.[0]?.segments?.[0]) {
    const segment = leg.options[0].segments[0];
    return {
      baggage: segment.baggage,
      carryOnBagInfo: segment.carryOnBagInfo
    };
  }
  return { baggage: undefined, carryOnBagInfo: undefined };
};

// Función para obtener texto corto del equipaje para mostrar al lado de IDA/REGRESO
const getBaggageTextFromLeg = (leg: any, airlineCode?: string): string => {
  const baggageInfo = getBaggageInfoFromLeg(leg);

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

// Component to display flight itinerary with visual connections
const FlightItinerary: React.FC<{ flight: FlightData }> = ({ flight }) => {
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
        const arrivalDate = leg.arrival_next_day ? addDays(baseDate, 1) : baseDate;

        return (
          <div key={legIndex} className="border border-border rounded-lg p-3 bg-background">
            <div className="flex items-center space-x-2 mb-3">
              {React.cloneElement(legIcon, { className: "h-4 w-4 text-foreground" })}
              <span className="font-semibold text-sm text-foreground">{legType}</span>
              <BaggageIcon
                {...getBaggageInfoFromLeg(leg)}
                size="sm"
                showTooltip={true}
                className="text-foreground"
              />
              {/* Mostrar texto del equipaje al lado */}
              <span className="text-sm text-foreground font-bold">
                {getBaggageTextFromLeg(leg, flight.airline.code)}
              </span>
            </div>

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
                    {leg.arrival_next_day && (
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
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [agencyId, setAgencyId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState(
    combinedData.requestType === 'combined' ? 'flights' :
      combinedData.requestType === 'flights-only' ? 'flights' : 'hotels'
  );
  const { toast } = useToast();
  const hasLoggedData = useRef(false);

  // Hook para cache de resultados y filtrado dinámico
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

  const handleHotelToggle = (hotelId: string) => {
    setSelectedHotels(prev => {
      if (prev.includes(hotelId)) {
        // Remove hotel and its selected room
        const newSelected = prev.filter(id => id !== hotelId);
        const newRooms = { ...selectedRooms };
        delete newRooms[hotelId];
        setSelectedRooms(newRooms);
        return newSelected;
      }

      // Limit to maximum 3 hotels
      if (prev.length >= 3) {
        toast({
          title: "Límite alcanzado",
          description: "Solo puedes seleccionar máximo 3 hoteles para el PDF.",
          variant: "destructive",
        });
        return prev;
      }

      return [...prev, hotelId];
    });
  };

  const handleRoomSelect = (hotelId: string, roomId: string) => {
    setSelectedRooms(prev => ({
      ...prev,
      [hotelId]: roomId
    }));
  };

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
      // 🔍 DEBUG: Log combinedData flights BEFORE filtering
      console.log('🔍 [CombinedTravelSelector] Flights in combinedData BEFORE filter:');
      combinedData.flights.forEach((flight, idx) => {
        console.log(`   Flight ${idx + 1}: transfers=${JSON.stringify(flight.transfers)}, travel_assistance=${JSON.stringify(flight.travel_assistance)}`);
      });

      // Get selected data
      const selectedFlightData = combinedData.flights.filter(flight =>
        selectedFlights.includes(flight.id!)
      );

      // 🔍 DEBUG: Log selected flights AFTER filtering
      console.log('🔍 [CombinedTravelSelector] Selected flights AFTER filter:');
      selectedFlightData.forEach((flight, idx) => {
        console.log(`   Flight ${idx + 1}: transfers=${JSON.stringify(flight.transfers)}, travel_assistance=${JSON.stringify(flight.travel_assistance)}`);
      });

      const selectedHotelData = combinedData.hotels.filter(hotel =>
        selectedHotels.includes(hotel.id)
      );

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

      // Prepare hotel data with selected rooms
      const selectedHotelDataWithRooms = selectedHotelData.map(hotel => {
        const selectedRoomId = selectedRooms[hotel.id];
        const selectedRoom = hotel.rooms.find(room => room.occupancy_id === selectedRoomId);

        console.log(`🏨 Preparing hotel ${hotel.name} for PDF:`, {
          hotel_id: hotel.id,
          hotel_nights: hotel.nights,
          category: hotel.category,
          category_type: typeof hotel.category,
          address: hotel.address,
          city: hotel.city,
          selected_room_id: selectedRoomId,
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

        // Explicitly preserve all hotel fields including category
        const hotelWithRoom: HotelDataWithSelectedRoom = {
          ...hotel,
          category: hotel.category || '', // Explicitly preserve category
          address: hotel.address || '', // Explicitly preserve address
          city: hotel.city || '', // Explicitly preserve city
          selectedRoom: selectedRoom || hotel.rooms[0] // fallback to first room if none selected
        };

        console.log(`✅ Hotel ${hotel.name} prepared with category:`, {
          original_category: hotel.category,
          prepared_category: hotelWithRoom.category,
          has_category: !!hotelWithRoom.category,
          original_address: hotel.address,
          prepared_address: hotelWithRoom.address
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

  const formatPassengerText = (adults: number, children: number = 0) => {
    const parts = [];

    if (adults > 0) {
      parts.push(`${adults} adult${adults > 1 ? 'os' : 'o'}`);
    }

    if (children > 0) {
      parts.push(`${children} niñ${children > 1 ? 'os' : 'o'}`);
    }

    if (parts.length === 0) {
      return 'por persona';
    }

    const totalPassengers = adults + children;
    const passengerText = parts.join(' + ');

    return `para ${passengerText} (${totalPassengers} ${totalPassengers > 1 ? 'personas' : 'persona'})`;
  };

  return (
    <div className="space-y-4 w-full">
      {/* Tabs for flights and hotels */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-2">
          {(combinedData.requestType === 'combined' || combinedData.requestType === 'flights-only') && (
            <TabsTrigger value="flights" className="flex items-center space-x-2">
              <Plane className="h-4 w-4" />
              <span>Vuelos ({hasCache ? filteredFlights.length : combinedData.flights.length})</span>
            </TabsTrigger>
          )}
          {(combinedData.requestType === 'combined' || combinedData.requestType === 'hotels-only') && (
            <TabsTrigger value="hotels" className="flex items-center space-x-2">
              <Hotel className="h-4 w-4" />
              <span>Hoteles ({combinedData.hotels.length})</span>
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
                <Card key={flight.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleFlightToggle(flight.id!)}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <Plane className="h-3 w-3 text-primary" />
                            <span className="font-medium text-sm">{flight.airline.name}</span>
                            <Badge variant="secondary" className="text-xs px-1 py-0">{flight.airline.code}</Badge>
                          </div>
                          <div className="flex items-center space-x-3 mt-0.5 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{flight.adults} adult{flight.adults > 1 ? 'os' : 'o'}</span>
                              {flight.childrens > 0 && <span>, {flight.childrens} niño{flight.childrens > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          {formatPrice(flight.price.amount, flight.price.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPassengerText(flight.adults, flight.childrens)}
                        </div>
                      </div>
                    </div>

                    <Separator className="my-2" />

                    {/* Visual Flight Itinerary with Connections */}
                    <FlightItinerary flight={flight} />
                  </CardContent>
                </Card>
              );
            })}

            {/* Mensaje cuando no hay vuelos después de filtrar */}
            {hasCache && filteredFlights.length === 0 && combinedData.flights.length > 0 && (
              <Card>
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
              <Card>
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
            {combinedData.hotels.map((hotel) => {
              const isSelected = selectedHotels.includes(hotel.id);

              return (
                <Card key={hotel.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleHotelToggle(hotel.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Hotel className="h-3 w-3 text-primary" />
                            <span className="font-medium text-sm">{hotel.name}</span>
                            {hotel.category && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {hotel.category}
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            {hotel.city && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-3 w-3" />
                                <span>{hotel.city}</span>
                              </div>
                            )}
                            {hotel.address && (
                              <div className="text-xs">{hotel.address}</div>
                            )}
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{hotel.check_in || 'N/A'} → {hotel.check_out || 'N/A'}</span>
                              </div>
                              <span>({hotel.nights} noche{hotel.nights > 1 ? 's' : ''})</span>
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
                      onRoomSelect={(roomId) => handleRoomSelect(hotel.id, roomId)}
                      isDisabled={!isSelected}
                      maxInitialRooms={3}
                      requestedRoomType={combinedData.requestedRoomType}
                      requestedMealPlan={combinedData.requestedMealPlan}
                    />
                  </CardContent>
                </Card>
              );
            })}

            {combinedData.hotels.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Hotel className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No se encontraron hoteles disponibles</p>
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
              </div>
              <Button
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
    </div>
  );
};

export default CombinedTravelSelector;