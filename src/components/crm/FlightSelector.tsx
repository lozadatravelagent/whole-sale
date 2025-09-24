import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { FlightData } from '@/types';
import { generateFlightPdf } from '@/services/pdfMonkey';
import {
  Plane,
  Clock,
  MapPin,
  DollarSign,
  FileText,
  Loader2,
  Download,
  ChevronRight,
  Users,
  Luggage
} from 'lucide-react';
import BaggageIcon from '@/components/ui/BaggageIcon';

interface FlightSelectorProps {
  flights: FlightData[];
  onPdfGenerated?: (pdfUrl: string) => void;
}

// Función para obtener información de equipaje del primer segmento de un leg
const getBaggageInfoFromLeg = (leg: any) => {
  console.log('🧳 getBaggageInfoFromLeg called with leg:', leg);

  // Buscar en la estructura legs -> options -> segments
  if (leg?.options?.[0]?.segments?.[0]) {
    const segment = leg.options[0].segments[0];
    const result = {
      baggage: segment.baggage,
      carryOnBagInfo: segment.carryOnBagInfo
    };
    console.log('🧳 Found baggage info in segment:', result);
    return result;
  }

  console.log('🧳 No baggage info found, returning undefined');
  return { baggage: undefined, carryOnBagInfo: undefined };
};

const FlightSelector: React.FC<FlightSelectorProps> = ({
  flights,
  onPdfGenerated
}) => {
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  console.log('🎯 FlightSelector rendered with flights:', flights.length);
  console.log('🎯 Flights data:', flights);

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

  const handleGeneratePdf = async () => {
    if (selectedFlights.length === 0) {
      toast({
        title: "Sin selección",
        description: "Selecciona al menos un vuelo para generar el PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const flightsToGenerate = flights.filter(flight =>
        flight.id && selectedFlights.includes(flight.id)
      );

      const result = await generateFlightPdf(flightsToGenerate);

      if (result.success && result.document_url) {
        toast({
          title: "PDF Generado",
          description: "Tu cotización de vuelos ha sido generada exitosamente.",
        });

        onPdfGenerated?.(result.document_url);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);

      let errorMessage = "No se pudo generar el PDF. Inténtalo de nuevo.";

      if (error instanceof Error) {
        if (error.message.includes('PDFMONKEY_API_KEY')) {
          errorMessage = "Configuración de API incompleta. Contacta al administrador.";
        } else if (error.message.includes('401')) {
          errorMessage = "API key inválida. Verifica la configuración.";
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    if (!amount || !currency) return 'Precio no disponible';
    return `${amount.toLocaleString()} ${currency}`;
  };

  const formatDuration = (duration: string) => {
    if (!duration) return 'N/A';
    return duration.replace('h', 'h ').replace('m', 'min');
  };

  const safeAirlineName = (flight: FlightData) => {
    return flight.airline?.name || 'Aerolínea no especificada';
  };

  const safePrice = (flight: FlightData) => {
    return flight.price?.amount || 0;
  };

  const safeCurrency = (flight: FlightData) => {
    return flight.price?.currency || 'USD';
  };

  if (flights.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <Plane className="h-5 w-5 mr-2 text-primary" />
          Cotizador de Vuelos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Selecciona hasta 2 vuelos para generar tu cotización en PDF
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {flights.map((flight, index) => (
          <Card
            key={flight.id}
            className={`transition-all cursor-pointer ${flight.id && selectedFlights.includes(flight.id)
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:bg-muted/50'
              }`}
            onClick={() => flight.id && handleFlightToggle(flight.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={flight.id ? selectedFlights.includes(flight.id) : false}
                    onCheckedChange={() => flight.id && handleFlightToggle(flight.id)}
                  />
                  <div>
                    <div className="font-medium text-lg">
                      Opción {index + 1} - {safeAirlineName(flight)}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground space-x-4 mt-1">
                      <span className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {flight.adults || 1} adultos{(flight.childrens || 0) > 0 ? `, ${flight.childrens} niños` : ''}
                      </span>
                      {flight.luggage && (
                        <span className="flex items-center">
                          <Luggage className="h-3 w-3 mr-1" />
                          Equipaje incluido
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {formatPrice(safePrice(flight), safeCurrency(flight))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Precio total
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Flight Legs */}
              <div className="space-y-3">
                {flight.legs.map((leg, legIndex) => (
                  <div key={legIndex} className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {leg.flight_type === 'outbound' ? 'Ida' : 'Regreso'} - {
                            leg.flight_type === 'outbound' ? flight.departure_date : flight.return_date
                          }
                        </Badge>
                        <BaggageIcon
                          {...getBaggageInfoFromLeg(leg)}
                          size="sm"
                          showTooltip={true}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(leg.duration)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="font-mono text-lg font-bold">{leg.departure.city_code}</div>
                        <div className="text-xs text-muted-foreground">{leg.departure.city_name}</div>
                        <div className="text-sm font-medium">{leg.departure.time}</div>
                      </div>

                      <div className="flex-1 mx-4 flex items-center">
                        <div className="flex-1 h-px bg-border"></div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
                        <div className="flex-1 h-px bg-border"></div>
                      </div>

                      <div className="text-center">
                        <div className="font-mono text-lg font-bold">{leg.arrival.city_code}</div>
                        <div className="text-xs text-muted-foreground">{leg.arrival.city_name}</div>
                        <div className="text-sm font-medium">{leg.arrival.time}</div>
                      </div>
                    </div>

                    {/* Layovers */}
                    {leg.layovers && leg.layovers.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        {leg.layovers.map((layover, layoverIndex) => (
                          <div key={layoverIndex} className="text-xs text-amber-600 flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            Escala en {layover.destination_city} ({layover.destination_code}) - {layover.waiting_time}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Optional services */}
              {(flight.travel_assistance && flight.travel_assistance > 0) ||
                (flight.transfers && flight.transfers > 0) ? (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                  {flight.travel_assistance && flight.travel_assistance > 0 && (
                    <div className="text-xs text-muted-foreground">
                      • Asistencia médica: USD {flight.travel_assistance} por pasajero (opcional)
                    </div>
                  )}
                  {flight.transfers && flight.transfers > 0 && (
                    <div className="text-xs text-muted-foreground">
                      • Traslados: USD {flight.transfers} por pasajero (opcional)
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}

        {/* Generate PDF Button */}
        {selectedFlights.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={handleGeneratePdf}
              disabled={isGenerating}
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generar PDF ({selectedFlights.length} vuelo{selectedFlights.length > 1 ? 's' : ''})
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FlightSelector;