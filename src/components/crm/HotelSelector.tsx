import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { HotelData } from '@/types';
import RoomGroupSelector from '@/components/ui/RoomGroupSelector';
import { makeBudget, buildPassengerList } from '@/services/hotelSearch';
import {
  Hotel,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  Download,
  Star,
  Phone,
  Globe,
  Bed,
  Users,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';

interface HotelSelectorProps {
  hotels: HotelData[];
  onPdfGenerated?: (pdfUrl: string) => void;
}

const HotelSelector: React.FC<HotelSelectorProps> = ({
  hotels,
  onPdfGenerated
}) => {
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  // Exact price states for makeBudget integration
  const [exactPrices, setExactPrices] = useState<Record<string, { price: number; currency: string; budgetId: string }>>({});
  const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  console.log('🎯 HotelSelector rendered with hotels:', hotels.length);
  console.log('🎯 Hotels data:', hotels);

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

      // Auto-select first room when hotel is selected
      const hotel = hotels.find(h => h.id === hotelId);
      if (hotel && hotel.rooms.length > 0) {
        setSelectedRooms(prev => ({
          ...prev,
          [hotelId]: hotel.rooms[0].occupancy_id
        }));
      }

      return [...prev, hotelId];
    });
  };

  const handleRoomSelection = useCallback(async (hotelId: string, roomOccupancyId: string) => {
    // 1. Update selection immediately for responsive UI
    setSelectedRooms(prev => ({
      ...prev,
      [hotelId]: roomOccupancyId
    }));

    // 2. Find hotel and room data
    const hotel = hotels.find(h => h.id === hotelId);
    const room = hotel?.rooms.find(r => r.occupancy_id === roomOccupancyId);

    // 3. Check if we have required data for makeBudget
    if (!room?.fare_id_broker || !hotel?.unique_id) {
      console.log('⚠️ [EXACT_PRICE] Missing fare_id_broker or unique_id, skipping makeBudget');
      return;
    }

    // 4. Generate price key for caching
    const priceKey = `${hotelId}-${roomOccupancyId}`;

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
      const adults = room.adults || hotel.search_adults || 1;
      const children = room.children || hotel.search_children || 0;
      const infants = room.infants || 0;
      const passengers = buildPassengerList(adults, children, infants);

      // 8. Call makeBudget
      // Use xml_occupancy_id (from EUROVIPS XML) for makeBudget, fallback to occupancy_id
      const result = await makeBudget({
        fareId: hotel.unique_id,
        fareIdBroker: room.fare_id_broker,
        checkinDate: hotel.check_in,
        checkoutDate: hotel.check_out,
        occupancies: [{
          occupancyId: room.xml_occupancy_id || room.occupancy_id,
          passengers
        }]
      });

      // 9. Save exact price if successful
      if (result.success && result.subTotalAmount && result.subTotalAmount > 0) {
        console.log('✅ [EXACT_PRICE] Got exact price:', result.subTotalAmount, result.currency);
        setExactPrices(prev => ({
          ...prev,
          [priceKey]: {
            price: result.subTotalAmount!,
            currency: result.currency || 'USD',
            budgetId: result.budgetId || ''
          }
        }));
      } else {
        console.warn('⚠️ [EXACT_PRICE] makeBudget failed:', result.error);
      }
    } catch (error) {
      console.error('❌ [EXACT_PRICE] Error getting exact price:', error);
    } finally {
      setLoadingPrices(prev => ({ ...prev, [priceKey]: false }));
    }
  }, [hotels, exactPrices]);

  const handleGeneratePdf = async () => {
    if (selectedHotels.length === 0) {
      toast({
        title: "Sin selección",
        description: "Selecciona al menos un hotel para generar el PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // For now, show success message - PDF generation would be implemented later
      toast({
        title: "PDF En Desarrollo",
        description: `Funcionalidad de PDF para ${selectedHotels.length} hotel${selectedHotels.length > 1 ? 'es' : ''} en desarrollo.`,
      });

      // Mock PDF URL for testing
      const mockPdfUrl = "https://example.com/hotel-quote.pdf";
      onPdfGenerated?.(mockPdfUrl);

    } catch (error) {
      console.error('Error generating PDF:', error);

      toast({
        title: "Error",
        description: "No se pudo generar el PDF. Inténtalo de nuevo.",
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

  const getAvailabilityIcon = (availability: number) => {
    if (availability >= 3) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (availability >= 2) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <Clock className="h-4 w-4 text-red-500" />;
  };

  const getAvailabilityText = (availability: number) => {
    if (availability >= 3) return "Disponible";
    if (availability >= 2) return "Consultar";
    return "No disponible";
  };

  const renderStars = (category: string) => {
    // Extract number of stars from category (1EST, 2EST, etc.)
    const starsMatch = category.match(/(\d+)EST/);
    if (!starsMatch) return category; // Return original if not in expected format

    const starCount = parseInt(starsMatch[1]);
    if (starCount < 1 || starCount > 5) return category; // Return original if invalid

    return '⭐'.repeat(starCount);
  };

  const safeHotelName = (hotel: HotelData) => {
    return hotel.name || 'Hotel sin nombre';
  };

  const getSelectedRoom = (hotel: HotelData) => {
    const selectedRoomId = selectedRooms[hotel.id];
    return hotel.rooms.find(room => room.occupancy_id === selectedRoomId) || hotel.rooms[0];
  };

  if (hotels.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <Hotel className="h-5 w-5 mr-2 text-primary" />
          Cotizador de Hoteles
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Selecciona hasta 3 hoteles para generar tu cotización en PDF
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {hotels.map((hotel, index) => {
          const isSelected = selectedHotels.includes(hotel.id);
          const selectedRoom = getSelectedRoom(hotel);

          return (
            <Card
              key={hotel.id}
              className={`transition-all cursor-pointer ${isSelected
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:bg-muted/50'
                }`}
              onClick={() => handleHotelToggle(hotel.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleHotelToggle(hotel.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-lg flex items-center space-x-2">
                        <span>Opción {index + 1} - {safeHotelName(hotel)}</span>
                        {hotel.category && (
                          <Badge variant="outline" className="text-xs">
                            {renderStars(hotel.category)}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground space-x-4 mt-1">
                        {hotel.city && (
                          <span className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {hotel.city}
                          </span>
                        )}
                        {hotel.nights > 0 && (
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {hotel.nights} noche{hotel.nights > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {hotel.address && (
                        <div className="text-xs text-muted-foreground mt-1">
                          📧 {hotel.address}
                        </div>
                      )}

                      {hotel.phone && (
                        <div className="text-xs text-muted-foreground">
                          📞 {hotel.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {formatPrice(selectedRoom?.price_per_night || 0, selectedRoom?.currency || 'USD')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedRoom?.total_price && (
                        <div>{formatPrice(selectedRoom.total_price, selectedRoom.currency)} total</div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator className="my-3" />

                {/* Room Selection - Using RoomGroupSelector */}
                {hotel.rooms.length > 0 && (
                  <RoomGroupSelector
                    rooms={hotel.rooms}
                    selectedRoomId={selectedRooms[hotel.id]}
                    onRoomSelect={(roomId) => {
                      if (isSelected) {
                        handleRoomSelection(hotel.id, roomId);
                      }
                    }}
                    isDisabled={!isSelected}
                    maxInitialRooms={4}
                    exactPrices={exactPrices}
                    loadingPrices={loadingPrices}
                    hotelId={hotel.id}
                    nights={hotel.nights}
                  />
                )}

                {/* Hotel Info */}
                {hotel.description && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="text-sm text-muted-foreground">
                      {hotel.description}
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          );
        })}

        {/* Generate PDF Button */}
        {selectedHotels.length > 0 && (
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
                  Generar PDF ({selectedHotels.length} hotel{selectedHotels.length > 1 ? 'es' : ''})
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HotelSelector;