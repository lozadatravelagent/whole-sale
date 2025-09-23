// Main Travel Selector component that combines flights and hotels
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plane,
  Hotel,
  Package,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import type { TravelSelectorProps } from '../../types/travel';
import { useTravelSelection } from '../../hooks/useTravelSelection';
import { FlightSelector } from './FlightSelector';
import { HotelSelector } from './HotelSelector';
import { TravelSummary } from './TravelSummary';

export function TravelSelector({
  combinedData,
  onPdfGenerated,
  onSelectionChange
}: TravelSelectorProps) {
  const {
    selectedFlights,
    selectedHotels,
    activeTab,
    isGeneratingPdf,
    setActiveTab,
    setSelectedFlights,
    setSelectedHotels,
    generatePdf,
    getSelectionSummary,
    canGeneratePdf
  } = useTravelSelection();

  // Handle flight selection changes
  const handleFlightSelectionChange = (flights: any[]) => {
    setSelectedFlights(flights);
    onSelectionChange?.({
      selectedFlights: flights,
      selectedHotels,
      isGeneratingPdf,
      activeTab
    });
  };

  // Handle hotel selection changes
  const handleHotelSelectionChange = (hotels: any[]) => {
    setSelectedHotels(hotels);
    onSelectionChange?.({
      selectedFlights,
      selectedHotels: hotels,
      isGeneratingPdf,
      activeTab
    });
  };

  // Handle PDF generation
  const handleGeneratePdf = async () => {
    const pdfUrl = await generatePdf();
    if (pdfUrl && onPdfGenerated) {
      await onPdfGenerated(pdfUrl, selectedFlights, selectedHotels);
    }
  };

  // Get selection summary
  const summary = getSelectionSummary();

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Selector de Viajes</h2>
          <p className="text-muted-foreground">
            Selecciona vuelos y hoteles para crear tu cotización
          </p>
        </div>

        {summary.totalItems > 0 && (
          <Card className="w-80">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Selección actual</span>
                <Badge variant="outline">
                  {summary.totalItems} item{summary.totalItems > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                {summary.flightCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Plane className="h-3 w-3" />
                      {summary.flightCount} vuelo{summary.flightCount > 1 ? 's' : ''}
                    </span>
                    <span className="font-medium text-blue-600">
                      ${summary.flightTotal.toFixed(2)}
                    </span>
                  </div>
                )}
                {summary.hotelCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hotel className="h-3 w-3" />
                      {summary.hotelCount} hotel{summary.hotelCount > 1 ? 'es' : ''}
                    </span>
                    <span className="font-medium text-green-600">
                      ${summary.hotelTotal.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-1 mt-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg text-primary">
                      ${summary.grandTotal.toFixed(2)} {summary.currency}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flights" className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            Vuelos
            {selectedFlights.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedFlights.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="hotels" className="flex items-center gap-2">
            <Hotel className="h-4 w-4" />
            Hoteles
            {selectedHotels.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedHotels.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="combined" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Resumen
            {summary.totalItems > 0 && (
              <Badge variant="secondary" className="ml-1">
                {summary.totalItems}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Flights Tab */}
        <TabsContent value="flights">
          {combinedData.flights && combinedData.flights.length > 0 ? (
            <FlightSelector
              flights={combinedData.flights}
              selectedFlights={selectedFlights}
              onSelectionChange={handleFlightSelectionChange}
              maxSelections={2}
            />
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No se encontraron vuelos para los criterios de búsqueda.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Hotels Tab */}
        <TabsContent value="hotels">
          {combinedData.hotels && combinedData.hotels.length > 0 ? (
            <HotelSelector
              hotels={combinedData.hotels}
              selectedHotels={selectedHotels}
              onSelectionChange={handleHotelSelectionChange}
              maxSelections={3}
            />
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No se encontraron hoteles para los criterios de búsqueda.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Combined/Summary Tab */}
        <TabsContent value="combined">
          <TravelSummary
            selectedFlights={selectedFlights}
            selectedHotels={selectedHotels}
            onGeneratePdf={handleGeneratePdf}
            isGenerating={isGeneratingPdf}
          />
        </TabsContent>
      </Tabs>

      {/* Action Bar */}
      {summary.totalItems > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">
                    {summary.totalItems} elemento{summary.totalItems > 1 ? 's' : ''} seleccionado{summary.totalItems > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-primary">${summary.grandTotal.toFixed(2)} USD</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('combined')}
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Ver Resumen
                </Button>

                <Button
                  onClick={handleGeneratePdf}
                  disabled={!canGeneratePdf() || isGeneratingPdf}
                  className="flex items-center gap-2"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Generar Cotización
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}