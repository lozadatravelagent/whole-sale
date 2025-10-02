// Refactored Flight Selector component with enhanced functionality
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Luggage,
  AlertCircle
} from 'lucide-react';
import type { FlightSelectorProps } from '../../types/travel';
import { useTravelSelection } from '../../hooks/useTravelSelection';
import { calculateConnectionTime } from '../../utils';

export function FlightSelector({
  flights,
  selectedFlights,
  onSelectionChange,
  maxSelections = 2
}: FlightSelectorProps) {
  const {
    toggleFlightSelection,
    isFlightSelected,
    generatePdf,
    isGeneratingPdf
  } = useTravelSelection();

  const handleFlightToggle = (flight: any) => {
    if (selectedFlights.length >= maxSelections && !isFlightSelected(flight.id)) {
      // Show error if trying to exceed max selections
      return;
    }

    const newSelectedFlights = isFlightSelected(flight.id)
      ? selectedFlights.filter(f => f.id !== flight.id)
      : [...selectedFlights, flight];

    onSelectionChange(newSelectedFlights);
  };

  // Helper function to format flight duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Helper function to format time
  const formatTime = (timeString: string): string => {
    try {
      const time = new Date(`2000-01-01T${timeString}`);
      return time.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return timeString;
    }
  };

  if (!flights || flights.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron vuelos disponibles.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Vuelos Disponibles</h3>
          <Badge variant="secondary">
            {flights.length} opciones
          </Badge>
        </div>

        {selectedFlights.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {selectedFlights.length} seleccionados
          </Badge>
        )}
      </div>

      {/* Selection limit warning */}
      {selectedFlights.length >= maxSelections && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Has alcanzado el límite máximo de {maxSelections} vuelos seleccionados.
          </AlertDescription>
        </Alert>
      )}

      {/* Flight Cards */}
      <div className="space-y-4">
        {flights.map((flight, index) => {
          const isSelected = selectedFlights.some(f => f.id === flight.id);
          const canSelect = selectedFlights.length < maxSelections || isSelected;

          return (
            <Card
              key={flight.id || index}
              className={`transition-all duration-200 ${
                isSelected
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : canSelect
                    ? 'hover:shadow-md cursor-pointer'
                    : 'opacity-50'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => canSelect && handleFlightToggle(flight)}
                      disabled={!canSelect}
                    />
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-blue-600" />
                      <CardTitle className="text-lg">
                        {flight.airline || 'Aerolínea'}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {flight.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {flight.currency || 'USD'}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Flight Segments */}
                {flight.segments && flight.segments.map((segment: any, segmentIndex: number) => (
                  <div key={segmentIndex}>
                    {segmentIndex > 0 && (
                      <div className="flex items-center justify-center py-2">
                        <Separator className="flex-1" />
                        <Badge variant="outline" className="mx-2 text-xs bg-black text-white border-orange-500">
                          Conexión: {calculateConnectionTime(flight.segments[segmentIndex - 1], segment)}
                        </Badge>
                        <Separator className="flex-1" />
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      {/* Departure */}
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {formatTime(segment.departure.time)}
                        </div>
                        <div className="text-sm font-medium">
                          {segment.departure.city_code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {segment.departure.city_name}
                        </div>
                      </div>

                      {/* Flight Info */}
                      <div className="flex-1 text-center space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-px bg-border flex-1" />
                          <Plane className="h-4 w-4 text-blue-600" />
                          <div className="h-px bg-border flex-1" />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {segment.flight_number}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          {segment.duration}
                        </div>
                      </div>

                      {/* Arrival */}
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {formatTime(segment.arrival.time)}
                        </div>
                        <div className="text-sm font-medium">
                          {segment.arrival.city_code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {segment.arrival.city_name}
                        </div>
                      </div>
                    </div>

                    {/* Additional segment info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Luggage className="h-3 w-3" />
                          Equipaje incluido
                        </span>
                        {segment.aircraft && (
                          <span>
                            {segment.aircraft}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {segment.flight_type === 'outbound' ? 'Ida' : 'Vuelta'}
                      </Badge>
                    </div>
                  </div>
                ))}

                {/* Flight Summary */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Duración total: {flight.total_duration || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {flight.passengers || 1} pasajero{(flight.passengers || 1) > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {flight.refundable && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Reembolsable
                        </Badge>
                      )}
                      {flight.direct && (
                        <Badge variant="outline" className="text-blue-600 border-blue-600">
                          Directo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary and Actions */}
      {selectedFlights.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Resumen de selección</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedFlights.length} vuelo{selectedFlights.length > 1 ? 's' : ''} seleccionado{selectedFlights.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-600">
                  {selectedFlights.reduce((total, flight) => {
                    const price = parseFloat(flight.price?.replace(/[^\d.]/g, '') || '0');
                    return total + price;
                  }, 0).toFixed(2)} USD
                </div>
                <p className="text-sm text-muted-foreground">Total estimado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}