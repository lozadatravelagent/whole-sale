import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { FlightData, HotelData, CombinedTravelResults } from '@/types';
import { generateFlightPdf, generateCombinedTravelPdf } from '@/services/pdfMonkey';
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

interface CombinedTravelSelectorProps {
  combinedData: CombinedTravelResults;
  onPdfGenerated?: (pdfUrl: string, selectedFlights: FlightData[], selectedHotels: HotelData[]) => Promise<void>;
}

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

// Component to display flight itinerary with visual connections
const FlightItinerary: React.FC<{ flight: FlightData }> = ({ flight }) => {
  return (
    <div className="space-y-3">
      {flight.legs.map((leg, legIndex) => {
        const legType = leg.flight_type === 'outbound' ? 'IDA' : 'REGRESO';
        const legIcon = leg.flight_type === 'outbound' ? <Plane className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />;

        return (
          <div key={legIndex} className="border rounded-lg p-3 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-2 mb-3">
              {legIcon}
              <span className="font-semibold text-sm text-blue-900">{legType}</span>
            </div>

            {/* Simplified display for current FlightLeg structure */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Navigation className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Vuelo {legType}</div>
                    <div className="text-xs text-gray-600">
                      {leg.duration}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-3">
                <div className="text-center">
                  <div className="font-bold text-lg text-blue-700">{leg.departure.city_code}</div>
                  <div className="text-sm font-medium">{leg.departure.time}</div>
                  <div className="text-xs text-gray-500">{leg.departure.city_name}</div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 flex-1"></div>
                  <Plane className="h-5 w-5 mx-2 text-blue-500" />
                  <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 flex-1"></div>
                </div>

                <div className="text-center">
                  <div className="font-bold text-lg text-blue-700">{leg.arrival.city_code}</div>
                  <div className="text-sm font-medium">{leg.arrival.time}</div>
                  <div className="text-xs text-gray-500">{leg.arrival.city_name}</div>
                </div>
              </div>

              {/* Show layovers if present */}
              {leg.layovers && leg.layovers.length > 0 && (
                <div className="space-y-2">
                  {leg.layovers.map((layover, layoverIndex) => (
                    <div key={layoverIndex} className="flex justify-center">
                      <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-2 min-w-[200px]">
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <Timer className="h-3 w-3 text-yellow-600" />
                            <span className="text-xs font-medium text-yellow-800">CONEXIÓN</span>
                          </div>
                          <div className="text-sm font-bold text-yellow-900">
                            {layover.destination_code} - {layover.waiting_time}
                          </div>
                          <div className="text-xs text-yellow-700">Cambio de terminal/puerta</div>
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
  onPdfGenerated
}) => {
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState(
    combinedData.requestType === 'combined' ? 'flights' :
      combinedData.requestType === 'flights-only' ? 'flights' : 'hotels'
  );
  const { toast } = useToast();
  const hasLoggedData = useRef(false);

  // Log data only once when component mounts or data changes significantly
  useEffect(() => {
    if (!hasLoggedData.current) {
      console.log('🌟 CombinedTravelSelector initialized with data:', {
        requestType: combinedData.requestType,
        flightsCount: combinedData.flights?.length || 0,
        hotelsCount: combinedData.hotels?.length || 0
      });
      hasLoggedData.current = true;
    }
  }, [combinedData.requestType, combinedData.flights?.length, combinedData.hotels?.length]);

  const handleFlightToggle = (flightId: string) => {
    setSelectedFlights(prev => {
      if (prev.includes(flightId)) {
        return prev.filter(id => id !== flightId);
      }

      // Limit to maximum 2 flights
      if (prev.length >= 2) {
        toast({
          title: "Límite alcanzado",
          description: "Solo puedes seleccionar máximo 2 vuelos para el PDF.",
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

      // Limit to maximum 2 hotels
      if (prev.length >= 2) {
        toast({
          title: "Límite alcanzado",
          description: "Solo puedes seleccionar máximo 2 hoteles para el PDF.",
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
      // Get selected data
      const selectedFlightData = combinedData.flights.filter(flight =>
        selectedFlights.includes(flight.id!)
      );

      const selectedHotelData = combinedData.hotels.filter(hotel =>
        selectedHotels.includes(hotel.id)
      );

      console.log('📄 Generating PDF for:', {
        flights: selectedFlightData.length,
        hotels: selectedHotelData.length
      });

      let pdfUrl;

      // Determine which PDF type to generate
      if (selectedFlightData.length > 0 && selectedHotelData.length > 0) {
        // Combined travel PDF (flights + hotels)
        console.log('🌟 Generating COMBINED travel PDF');
        pdfUrl = await generateCombinedTravelPdf(selectedFlightData, selectedHotelData);
      } else if (selectedFlightData.length > 0) {
        // Flight-only PDF (existing functionality)
        console.log('✈️ Generating FLIGHT-only PDF');
        pdfUrl = await generateFlightPdf(selectedFlightData);
      } else if (selectedHotelData.length > 0) {
        // Hotel-only PDF (use combined template with empty flights)
        console.log('🏨 Generating HOTEL-only PDF');
        pdfUrl = await generateCombinedTravelPdf([], selectedHotelData);
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

  return (
    <div className="space-y-4 w-full">
      {/* Tabs for flights and hotels */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-2">
          {(combinedData.requestType === 'combined' || combinedData.requestType === 'flights-only') && (
            <TabsTrigger value="flights" className="flex items-center space-x-2">
              <Plane className="h-4 w-4" />
              <span>Vuelos ({combinedData.flights.length})</span>
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
            {combinedData.flights.map((flight, index) => {
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
                        <div className="text-xs text-muted-foreground">por persona</div>
                      </div>
                    </div>

                    <Separator className="my-2" />

                    {/* Visual Flight Itinerary with Connections */}
                    <FlightItinerary flight={flight} />
                  </CardContent>
                </Card>
              );
            })}

            {combinedData.flights.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Plane className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No se encontraron vuelos disponibles</p>
                  <p className="text-sm text-muted-foreground mt-1">Los servicios de vuelos están siendo configurados en EUROVIPS</p>
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
                                <span>{hotel.check_in} → {hotel.check_out}</span>
                              </div>
                              <span>({hotel.nights} noche{hotel.nights > 1 ? 's' : ''})</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Hotel rooms - More compact layout */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Habitaciones disponibles:</h4>
                      <div className="grid gap-2 sm:grid-cols-1 lg:grid-cols-2">
                        {hotel.rooms.map((room, roomIndex) => {
                          const availabilityStatus = getAvailabilityStatus(room.availability);
                          const AvailabilityIcon = availabilityStatus.icon;
                          const isRoomSelected = selectedRooms[hotel.id] === room.occupancy_id;

                          return (
                            <div key={roomIndex} className={`p-3 border rounded-lg cursor-pointer transition-all ${isRoomSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                              } ${!isSelected ? 'opacity-50 pointer-events-none' : ''}`}
                              onClick={() => isSelected && handleRoomSelect(hotel.id, room.occupancy_id)}>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Bed className="h-4 w-4" />
                                  <span className="font-medium text-sm truncate">{room.type}</span>
                                </div>
                                {room.description !== room.type && (
                                  <p className="text-xs text-muted-foreground truncate">{room.description}</p>
                                )}

                                <div className="flex items-center justify-between">
                                  <div className="text-lg font-bold text-primary">
                                    {formatPrice(room.total_price, room.currency)}
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <div className={`w-2 h-2 rounded-full ${availabilityStatus.color}`}></div>
                                    <span className="text-xs">{availabilityStatus.text}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
            <div className="flex items-center justify-between">
              <div>
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