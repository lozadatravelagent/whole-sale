import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { HotelData, type TravelSearchProvider } from '@/types';
import RoomGroupSelector from '@/components/ui/RoomGroupSelector';
import { makeBudget, resolveHotelOccupancyForBudget } from '@/services/hotelSearch';
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
import { getResultSelectorCopy, LOCALE_BY_LANGUAGE, normalizeSupportedLanguage, type UserLanguage } from '@/features/chat/i18n/chatResultCopy';

interface HotelSelectorProps {
  hotels: HotelData[];
  onPdfGenerated?: (pdfUrl: string) => void;
  responseLanguage?: UserLanguage | string;
}

const PROVIDER_LABELS: Record<TravelSearchProvider, string> = {
  STARLING: 'Starling',
  EUROVIPS: 'EUROVIPS',
  DELFOS: 'Delfos',
  HOTELBEDS: 'Hotelbeds',
};

const normalizeTravelProvider = (
  provider: string | undefined,
  fallback: TravelSearchProvider
): TravelSearchProvider => {
  const value = provider?.toUpperCase();
  return value && value in PROVIDER_LABELS ? value as TravelSearchProvider : fallback;
};

const getProviderLabel = (provider: string | undefined, fallback: TravelSearchProvider) =>
  PROVIDER_LABELS[normalizeTravelProvider(provider, fallback)];

function ProviderBanner({
  provider,
  fallback,
  label
}: {
  provider?: string;
  fallback: TravelSearchProvider;
  label: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
      <span className="font-medium">{label}</span>
      <Badge variant="secondary" className="shrink-0 px-2 py-0 text-xs">
        {getProviderLabel(provider, fallback)}
      </Badge>
    </div>
  );
}

const HotelSelector: React.FC<HotelSelectorProps> = ({
  hotels,
  onPdfGenerated,
  responseLanguage
}) => {
  const { i18n } = useTranslation('chat');
  const language = normalizeSupportedLanguage(responseLanguage || i18n.language);
  const locale = LOCALE_BY_LANGUAGE[language];
  const copy = getResultSelectorCopy(language);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  // Exact price states for makeBudget integration
  const [exactPrices, setExactPrices] = useState<Record<string, { price: number; currency: string; budgetId: string }>>({});
  const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>({});
  const [failedPrices, setFailedPrices] = useState<Record<string, boolean>>({});
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
          title: copy.limitReached,
          description: copy.maxHotels,
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
      const occupancy = resolveHotelOccupancyForBudget(hotel, room);
      console.log('👥 [EXACT_PRICE] Resolved occupancy:', {
        adults: occupancy.adults,
        children: occupancy.children,
        infants: occupancy.infants,
        childrenAges: occupancy.childrenAges,
        signature: occupancy.signature
      });

      // 8. Call makeBudget
      // Use xml_occupancy_id (from EUROVIPS XML) for makeBudget, fallback to occupancy_id
      const result = await makeBudget({
        fareId: hotel.unique_id,
        fareIdBroker: room.fare_id_broker,
        checkinDate: hotel.check_in,
        checkoutDate: hotel.check_out,
        occupancies: [{
          occupancyId: room.xml_occupancy_id || room.occupancy_id,
          passengers: occupancy.passengers
        }]
      });

      // 9. Save exact price only when we have agency net parity (not gross fallback)
      const exactAgencyNet = result.agencyPricing?.netoAgencia;
      if (result.success && exactAgencyNet && exactAgencyNet > 0) {
        console.log('✅ [EXACT_PRICE] Got exact agency net price:', exactAgencyNet, result.currency);
        setExactPrices(prev => ({
          ...prev,
          [priceKey]: {
            price: exactAgencyNet,
            currency: result.currency || 'USD',
            budgetId: result.budgetId || ''
          }
        }));
      } else if (result.success && result.subTotalAmount && result.subTotalAmount > 0) {
        console.warn('⚠️ [EXACT_PRICE] makeBudget succeeded without agency net parity, using subTotalAmount as fallback:', {
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
        console.warn('⚠️ [EXACT_PRICE] makeBudget succeeded but no usable price:', {
          hasAgencyPricing: !!result.agencyPricing,
          subTotalAmount: result.subTotalAmount
        });
      } else {
        console.warn('⚠️ [EXACT_PRICE] makeBudget failed:', JSON.stringify({
          success: result.success,
          error: result.error,
          errorCode: result.errorCode,
          rawResponse: result.rawResponse,
          hasAgencyPricing: !!result.agencyPricing,
          subTotalAmount: result.subTotalAmount
        }, null, 2));
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
        title: copy.selectionRequired,
        description: copy.noHotelSelection,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // For now, show success message - PDF generation would be implemented later
      toast({
        title: copy.pdfInDevelopment,
        description: copy.pdfDevelopmentDescription(selectedHotels.length),
      });

      // Mock PDF URL for testing
      const mockPdfUrl = "https://example.com/hotel-quote.pdf";
      onPdfGenerated?.(mockPdfUrl);

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

  const formatPrice = (amount: number, currency: string) => {
    if (!amount || !currency) return copy.noPrice;
    return `${amount.toLocaleString(locale)} ${currency}`;
  };

  const getAvailabilityIcon = (availability: number) => {
    if (availability >= 3) return <CheckCircle className="h-4 w-4 text-success" />;
    if (availability >= 2) return <AlertCircle className="h-4 w-4 text-warning" />;
    return <Clock className="h-4 w-4 text-destructive" />;
  };

  const getAvailabilityText = (availability: number) => {
    if (availability >= 3) return copy.availability.available;
    if (availability >= 2) return copy.availability.consult;
    return copy.availability.unavailable;
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
    return hotel.name || copy.hotelNoName;
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
          {copy.quoteBuilder(copy.hotels)}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {copy.selectUpToHotels(3)}
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
                <ProviderBanner provider={hotel.provider} fallback="EUROVIPS" label={copy.provider} />
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleHotelToggle(hotel.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-lg flex items-center space-x-2">
                        <span>{copy.option(index + 1)} - {safeHotelName(hotel)}</span>
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
                            {copy.nights(hotel.nights)}
                          </span>
                        )}
                      </div>

                      {hotel.address && (
                        <div className="mt-1 max-w-xl truncate text-xs text-muted-foreground" title={hotel.address}>
                          📧 {hotel.address.slice(0, 80)}{hotel.address.length > 80 ? '…' : ''}
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
                        <div>{formatPrice(selectedRoom.total_price, selectedRoom.currency)} {copy.total}</div>
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
                    failedPrices={failedPrices}
                    hotelId={hotel.id}
                    nights={hotel.nights}
                    language={language}
                  />
                )}

                {/* Hotel Info — cap length: EUROVIPS often injects policies/URLs here */}
                {hotel.description && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <div
                      className="line-clamp-2 break-words text-sm text-muted-foreground"
                      title={hotel.description}
                    >
                      {hotel.description.length > 120
                        ? `${hotel.description.slice(0, 120).trimEnd()}…`
                        : hotel.description}
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
                  {copy.generatingPdf}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {copy.generatePdfWithCount(selectedHotels.length, copy.hotelsKind)}
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
