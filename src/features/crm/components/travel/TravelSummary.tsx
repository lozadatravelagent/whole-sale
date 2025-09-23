// Travel Summary component for displaying selected items and generating PDFs
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plane,
  Hotel,
  FileText,
  Download,
  Loader2,
  Clock,
  MapPin,
  DollarSign,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  Package
} from 'lucide-react';
import type { TravelSummaryProps } from '../../types/travel';
import { formatCurrency, calculateConnectionTime } from '../../utils';

export function TravelSummary({
  selectedFlights,
  selectedHotels,
  onGeneratePdf,
  isGenerating
}: TravelSummaryProps) {
  // Calculate totals
  const flightTotal = selectedFlights.reduce((sum, flight) => {
    const price = parseFloat(flight.price?.replace(/[^\d.]/g, '') || '0');
    return sum + price;
  }, 0);

  const hotelTotal = selectedHotels.reduce((sum, hotel) => {
    const bestRoom = hotel.rooms?.[0];
    return sum + (bestRoom?.total_price || 0);
  }, 0);

  const grandTotal = flightTotal + hotelTotal;
  const hasItems = selectedFlights.length > 0 || selectedHotels.length > 0;

  if (!hasItems) {
    return (
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          Selecciona vuelos y/o hoteles en las pestañas anteriores para ver el resumen de tu cotización.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Resumen de Cotización</h3>
          <p className="text-muted-foreground">
            Revisa tu selección antes de generar la cotización en PDF
          </p>
        </div>
        <Button
          onClick={onGeneratePdf}
          disabled={isGenerating || !hasItems}
          size="lg"
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando PDF...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Generar Cotización PDF
            </>
          )}
        </Button>
      </div>

      {/* Selected Flights */}
      {selectedFlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-blue-600" />
              Vuelos Seleccionados
              <Badge variant="secondary">{selectedFlights.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedFlights.map((flight, index) => (
              <div key={flight.id || index} className="border rounded-lg p-4 space-y-3">
                {/* Flight Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      Vuelo {index + 1}
                    </Badge>
                    <span className="font-medium">{flight.airline}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600">
                      {flight.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {flight.currency || 'USD'}
                    </div>
                  </div>
                </div>

                {/* Flight Segments */}
                {flight.segments && flight.segments.map((segment: any, segmentIndex: number) => (
                  <div key={segmentIndex}>
                    {segmentIndex > 0 && (
                      <div className="flex items-center justify-center py-2">
                        <Separator className="flex-1" />
                        <Badge variant="outline" className="mx-2 text-xs">
                          Conexión: {calculateConnectionTime(flight.segments[segmentIndex - 1], segment)}
                        </Badge>
                        <Separator className="flex-1" />
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-bold">{segment.departure.time}</div>
                        <div className="text-sm font-medium">{segment.departure.city_code}</div>
                        <div className="text-xs text-muted-foreground">{segment.departure.city_name}</div>
                      </div>

                      <div className="flex-1 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <div className="h-px bg-border flex-1" />
                          <Plane className="h-4 w-4 text-blue-600" />
                          <div className="h-px bg-border flex-1" />
                        </div>
                        <div className="text-xs text-muted-foreground">{segment.flight_number}</div>
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          {segment.duration}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-lg font-bold">{segment.arrival.time}</div>
                        <div className="text-sm font-medium">{segment.arrival.city_code}</div>
                        <div className="text-xs text-muted-foreground">{segment.arrival.city_name}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Subtotal Vuelos:</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(flightTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Hotels */}
      {selectedHotels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-green-600" />
              Hoteles Seleccionados
              <Badge variant="secondary">{selectedHotels.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedHotels.map((hotel, index) => {
              const bestRoom = hotel.rooms?.[0];
              return (
                <div key={hotel.id || index} className="border rounded-lg p-4 space-y-3">
                  {/* Hotel Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Hotel {index + 1}
                        </Badge>
                        <span className="font-medium">{hotel.name}</span>
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {hotel.location || hotel.address}
                        </span>
                      </div>

                      {hotel.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`text-xs ${i < hotel.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                            >
                              ★
                            </span>
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">({hotel.rating})</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        {formatCurrency(bestRoom?.total_price || 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {bestRoom?.currency || 'USD'}
                      </div>
                      {bestRoom?.price_per_night && (
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(bestRoom.price_per_night)}/noche
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Room Details */}
                  {bestRoom && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-green-800">{bestRoom.type}</span>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          {bestRoom.availability} disponibles
                        </Badge>
                      </div>
                      {bestRoom.description && (
                        <p className="text-sm text-green-700 mb-2">{bestRoom.description}</p>
                      )}
                      <div className="flex items-center justify-between text-sm text-green-700">
                        <span>Ocupación máxima:</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {bestRoom.max_occupancy || 2} personas
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Subtotal Hoteles:</span>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(hotelTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Summary */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Resumen Total</h3>

            <div className="space-y-2">
              {selectedFlights.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-blue-600" />
                    {selectedFlights.length} vuelo{selectedFlights.length > 1 ? 's' : ''}
                  </span>
                  <span className="font-medium">{formatCurrency(flightTotal)}</span>
                </div>
              )}

              {selectedHotels.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Hotel className="h-4 w-4 text-green-600" />
                    {selectedHotels.length} hotel{selectedHotels.length > 1 ? 'es' : ''}
                  </span>
                  <span className="font-medium">{formatCurrency(hotelTotal)}</span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between text-lg">
                <span className="font-semibold">Total General:</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(grandTotal)} USD
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Esta cotización incluye todos los servicios seleccionados.
                Los precios están sujetos a disponibilidad al momento de la reserva.
              </span>
            </div>

            {/* Generate PDF Button */}
            <div className="pt-4">
              <Button
                onClick={onGeneratePdf}
                disabled={isGenerating}
                size="lg"
                className="w-full flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generando cotización PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Descargar Cotización en PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}