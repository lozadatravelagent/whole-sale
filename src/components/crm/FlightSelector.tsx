import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { FlightData } from '@/types';
import { generateFlightPdf } from '@/services/pdf/customPdfGenerator';
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
import { supabase } from '@/integrations/supabase/client';
import { airlineResolver } from '@/features/chat/services/airlineResolver';
import { getResultSelectorCopy, LOCALE_BY_LANGUAGE, normalizeSupportedLanguage, type UserLanguage } from '@/features/chat/i18n/chatResultCopy';

interface FlightSelectorProps {
  flights: FlightData[];
  conversationId?: string; // Add conversation ID to get agency_id
  onPdfGenerated?: (pdfUrl: string) => void;
  responseLanguage?: UserLanguage | string;
}

// Función para obtener información de equipaje del primer segmento de un leg
const getBaggageInfoFromLeg = (leg: any) => {
  // Buscar en la estructura con mayúsculas: Legs -> Options -> Segments
  if (leg?.Options?.[0]?.Segments?.[0]) {
    const segment = leg.Options[0].Segments[0];

    // Convertir CarryOnBagInfo si existe y no es null
    let carryOnBagInfo = null;
    if (segment.CarryOnBagInfo) {
      carryOnBagInfo = {
        quantity: segment.CarryOnBagInfo.Quantity || segment.CarryOnBagInfo.quantity,
        weight: segment.CarryOnBagInfo.Weight || segment.CarryOnBagInfo.weight,
        dimensions: segment.CarryOnBagInfo.Dimensions || segment.CarryOnBagInfo.dimensions
      };
    }

    const result = {
      baggage: segment.Baggage,
      carryOnBagInfo: carryOnBagInfo
    };
    return result;
  }

  // Fallback para estructura con minúsculas: legs -> options -> segments
  if (leg?.options?.[0]?.segments?.[0]) {
    const segment = leg.options[0].segments[0];
    const result = {
      baggage: segment.baggage,
      carryOnBagInfo: segment.carryOnBagInfo
    };
    return result;
  }
  return { baggage: undefined, carryOnBagInfo: undefined };
};

const FlightSelector: React.FC<FlightSelectorProps> = ({
  flights,
  conversationId,
  onPdfGenerated,
  responseLanguage
}) => {
  const { i18n } = useTranslation('chat');
  const language = normalizeSupportedLanguage(responseLanguage || i18n.language);
  const locale = LOCALE_BY_LANGUAGE[language];
  const copy = getResultSelectorCopy(language);
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [agencyId, setAgencyId] = useState<string | undefined>(undefined);
  const [resolvedAirlineNames, setResolvedAirlineNames] = useState<{ [flightId: string]: string }>({});
  const { toast } = useToast();

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

  // Resolve airline names when flights change
  useEffect(() => {
    const resolveAirlineNames = async () => {
      const resolved: { [flightId: string]: string } = {};

      for (const flight of flights) {
        // If name already exists, use it
        if (flight.airline?.name && flight.airline.name !== 'Unknown' && flight.airline.name !== 'Airline ') {
          resolved[flight.id] = flight.airline.name;
        }
        // Otherwise, try to resolve from code
        else if (flight.airline?.code) {
          try {
            const airlineInfo = await airlineResolver.resolveAirline(flight.airline.code);
            resolved[flight.id] = airlineInfo.name;
          } catch (error) {
            console.warn(`Failed to resolve airline for ${flight.airline.code}:`, error);
            resolved[flight.id] = copy.unspecifiedAirline;
          }
        } else {
          resolved[flight.id] = copy.unspecifiedAirline;
        }
      }

      setResolvedAirlineNames(resolved);
    };

    if (flights.length > 0) {
      resolveAirlineNames();
    }
  }, [copy.unspecifiedAirline, flights]);



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

  const handleGeneratePdf = async () => {
    if (selectedFlights.length === 0) {
      toast({
        title: copy.selectionRequired,
        description: copy.noFlightSelection,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const flightsToGenerate = flights.filter(flight =>
        flight.id && selectedFlights.includes(flight.id)
      );

      console.log('✈️ Generating FLIGHT PDF with agency:', agencyId);
      const result = await generateFlightPdf(flightsToGenerate, agencyId);

      if (result.success && result.document_url) {
        toast({
          title: copy.pdfGenerated,
          description: copy.pdfFlightsReady,
        });

        onPdfGenerated?.(result.document_url);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);

      let errorMessage = copy.pdfError;

      if (error instanceof Error) {
        if (error.message.includes('PDFMONKEY_API_KEY')) {
          errorMessage = copy.apiIncomplete;
        } else if (error.message.includes('401')) {
          errorMessage = copy.invalidApiKey;
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
    if (!amount || !currency) return copy.noPrice;
    return `${amount.toLocaleString(locale)} ${currency}`;
  };

  const formatDuration = (duration: string) => {
    if (!duration) return 'N/A';
    return duration.replace('h', 'h ').replace('m', 'min');
  };

  const safeAirlineName = (flight: FlightData) => {
    // Use resolved name if available
    if (resolvedAirlineNames[flight.id]) {
      return resolvedAirlineNames[flight.id];
    }
    // Fallback to original name if exists
    return flight.airline?.name || copy.unspecifiedAirline;
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
          {copy.quoteBuilder(copy.flights)}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {copy.selectUpToFlights(2)}
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
                      {copy.option(index + 1)} - {safeAirlineName(flight)}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground space-x-4 mt-1">
                      <span className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {copy.adult(flight.adults || 1)}{(flight.childrens || 0) > 0 ? `, ${copy.child(flight.childrens)}` : ''}{(flight.infants || 0) > 0 ? `, ${copy.infant(flight.infants)}` : ''}
                      </span>
                      {flight.luggage && (
                        <span className="flex items-center">
                          <Luggage className="h-3 w-3 mr-1" />
                          {copy.includedBaggage}
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
                    {copy.totalPrice}
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
                          {leg.flight_type === 'outbound' ? copy.outbound : copy.return} - {
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
                          <div key={layoverIndex} className="text-xs text-warning flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {copy.layoverIn(layover.destination_city, layover.destination_code, layover.waiting_time)}
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
                      • {copy.medicalAssistance(flight.travel_assistance)}
                    </div>
                  )}
                  {flight.transfers && flight.transfers > 0 && (
                    <div className="text-xs text-muted-foreground">
                      • {copy.transfers(flight.transfers)}
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
                  {copy.generatingPdf}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {copy.generatePdfWithCount(selectedFlights.length, copy.flightsKind)}
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
