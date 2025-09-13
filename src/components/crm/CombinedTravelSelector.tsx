import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { FlightData, HotelData, CombinedTravelResults } from '@/types';
import { generateFlightPdf } from '@/services/pdfMonkey';
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
  Package
} from 'lucide-react';

interface CombinedTravelSelectorProps {
  combinedData: CombinedTravelResults;
  onPdfGenerated?: (pdfUrl: string) => void;
}

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
  
  console.log('🌟 CombinedTravelSelector rendered with data:', combinedData);

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
    // For now, we'll generate PDF only for flights (existing functionality)
    // TODO: Extend pdfMonkey service to support combined travel packages
    
    if (selectedFlights.length === 0) {
      toast({
        title: "Selección requerida",
        description: "Selecciona al menos un vuelo para generar el PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const selectedFlightData = combinedData.flights.filter(flight => 
        selectedFlights.includes(flight.id!)
      );
      
      console.log('📄 Generating PDF for selected flights:', selectedFlightData);
      
      const pdfUrl = await generateFlightPdf(selectedFlightData);
      
      if (pdfUrl && onPdfGenerated) {
        onPdfGenerated(pdfUrl);
      }
      
      toast({
        title: "PDF Generado",
        description: "Tu cotización de viaje está lista para descargar.",
      });
      
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
    <div className="space-y-4">
      {/* Header with service info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            <span>
              {combinedData.requestType === 'combined' ? 'Viaje Combinado' :
               combinedData.requestType === 'flights-only' ? 'Vuelos' : 'Hoteles'} - EUROVIPS
            </span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {combinedData.requestType === 'combined' ? 
              `${combinedData.flights.length} vuelos y ${combinedData.hotels.length} hoteles disponibles` :
              combinedData.requestType === 'flights-only' ? 
              `${combinedData.flights.length} opciones de vuelos` :
              `${combinedData.hotels.length} opciones de hoteles`
            }
          </p>
        </CardHeader>
      </Card>

      {/* Tabs for flights and hotels */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
          <TabsContent value="flights" className="space-y-3">
            {combinedData.flights.map((flight, index) => {
              const isSelected = selectedFlights.includes(flight.id!);
              
              return (
                <Card key={flight.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleFlightToggle(flight.id!)}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <Plane className="h-4 w-4 text-primary" />
                            <span className="font-medium">{flight.airline.name}</span>
                            <Badge variant="secondary" className="text-xs">{flight.airline.code}</Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{flight.adults} adult{flight.adults > 1 ? 'os' : 'o'}</span>
                              {flight.childrens > 0 && <span>, {flight.childrens} niño{flight.childrens > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">
                          {formatPrice(flight.price.amount, flight.price.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">por persona</div>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Flight legs */}
                    <div className="space-y-3">
                      {flight.legs.map((leg, legIndex) => (
                        <div key={legIndex} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant={leg.flight_type === 'outbound' ? 'default' : 'secondary'} className="text-xs">
                                {leg.flight_type === 'outbound' ? '🛫 Ida' : '🛬 Regreso'}
                              </Badge>
                              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{leg.duration}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="text-center">
                                <div className="font-medium">{leg.departure.city_code}</div>
                                <div className="text-xs text-muted-foreground">{leg.departure.city_name}</div>
                                <div className="text-sm font-medium text-primary">{formatTime(leg.departure.time)}</div>
                              </div>
                              
                              <div className="flex items-center px-4">
                                <div className="h-px bg-border flex-1"></div>
                                <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                                <div className="h-px bg-border flex-1"></div>
                              </div>
                              
                              <div className="text-center">
                                <div className="font-medium">{leg.arrival.city_code}</div>
                                <div className="text-xs text-muted-foreground">{leg.arrival.city_name}</div>
                                <div className="text-sm font-medium text-primary">{formatTime(leg.arrival.time)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
          <TabsContent value="hotels" className="space-y-3">
            {combinedData.hotels.map((hotel) => {
              const isSelected = selectedHotels.includes(hotel.id);
              
              return (
                <Card key={hotel.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleHotelToggle(hotel.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Hotel className="h-4 w-4 text-primary" />
                            <span className="font-medium">{hotel.name}</span>
                            {hotel.category && (
                              <Badge variant="outline" className="text-xs">
                                {hotel.category}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm text-muted-foreground">
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

                    {/* Hotel rooms */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Habitaciones disponibles:</h4>
                      {hotel.rooms.map((room, roomIndex) => {
                        const availabilityStatus = getAvailabilityStatus(room.availability);
                        const AvailabilityIcon = availabilityStatus.icon;
                        const isRoomSelected = selectedRooms[hotel.id] === room.occupancy_id;
                        
                        return (
                          <div key={roomIndex} className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isRoomSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                          } ${!isSelected ? 'opacity-50 pointer-events-none' : ''}`}
                          onClick={() => isSelected && handleRoomSelect(hotel.id, room.occupancy_id)}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Bed className="h-4 w-4" />
                                  <span className="font-medium text-sm">{room.type}</span>
                                </div>
                                {room.description !== room.type && (
                                  <p className="text-xs text-muted-foreground">{room.description}</p>
                                )}
                              </div>
                              
                              <div className="text-right space-y-1">
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
                disabled={selectedFlights.length === 0 || isGenerating}
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