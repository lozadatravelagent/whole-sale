// Refactored Hotel Selector component with enhanced functionality
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import RoomGroupSelector from '@/components/ui/RoomGroupSelector';
import {
  Hotel,
  MapPin,
  Calendar,
  DollarSign,
  Star,
  Phone,
  Globe,
  Bed,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Wifi,
  Car,
  Coffee,
  Utensils
} from 'lucide-react';
import type { HotelSelectorProps } from '../../types/travel';
import { formatCurrency } from '../../utils';

export function HotelSelector({
  hotels,
  selectedHotels,
  onSelectionChange,
  maxSelections = 3
}: HotelSelectorProps) {
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});

  const handleHotelToggle = (hotel: any) => {
    const isSelected = selectedHotels.some(h => h.id === hotel.id);

    if (!isSelected && selectedHotels.length >= maxSelections) {
      // Show error if trying to exceed max selections
      return;
    }

    let newSelectedHotels;
    let newSelectedRooms = { ...selectedRooms };

    if (isSelected) {
      newSelectedHotels = selectedHotels.filter(h => h.id !== hotel.id);
      delete newSelectedRooms[hotel.id];
    } else {
      newSelectedHotels = [...selectedHotels, hotel];
      // Auto-select the first/best room
      if (hotel.rooms && hotel.rooms.length > 0) {
        newSelectedRooms[hotel.id] = hotel.rooms[0].occupancy_id;
      }
    }

    setSelectedRooms(newSelectedRooms);
    onSelectionChange(newSelectedHotels);
  };

  const handleRoomChange = (hotelId: string, roomId: string) => {
    setSelectedRooms(prev => ({
      ...prev,
      [hotelId]: roomId
    }));
  };

  // Helper function to render star rating
  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              }`}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">({rating})</span>
      </div>
    );
  };

  // Helper function to get amenity icon
  const getAmenityIcon = (amenity: string) => {
    const lowerAmenity = amenity.toLowerCase();
    if (lowerAmenity.includes('wifi')) return <Wifi className="h-3 w-3" />;
    if (lowerAmenity.includes('parking')) return <Car className="h-3 w-3" />;
    if (lowerAmenity.includes('breakfast')) return <Coffee className="h-3 w-3" />;
    if (lowerAmenity.includes('restaurant')) return <Utensils className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  if (!hotels || hotels.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron hoteles disponibles.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hotel className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold">Hoteles Disponibles</h3>
          <Badge variant="secondary">
            {hotels.length} opciones
          </Badge>
        </div>

        {selectedHotels.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {selectedHotels.length} seleccionados
          </Badge>
        )}
      </div>

      {/* Selection limit warning */}
      {selectedHotels.length >= maxSelections && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Has alcanzado el límite máximo de {maxSelections} hoteles seleccionados.
          </AlertDescription>
        </Alert>
      )}

      {/* Hotel Cards */}
      <div className="space-y-4">
        {hotels.map((hotel, index) => {
          const isSelected = selectedHotels.some(h => h.id === hotel.id);
          const canSelect = selectedHotels.length < maxSelections || isSelected;
          const selectedRoom = hotel.rooms?.find(room => room.occupancy_id === selectedRooms[hotel.id]);
          const bestRoom = hotel.rooms?.[0]; // Assuming rooms are sorted by price/quality

          return (
            <Card
              key={hotel.id || index}
              className={`transition-all duration-200 ${isSelected
                  ? 'ring-2 ring-green-500 bg-green-50'
                  : canSelect
                    ? 'hover:shadow-md cursor-pointer'
                    : 'opacity-50'
                }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => canSelect && handleHotelToggle(hotel)}
                      disabled={!canSelect}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Hotel className="h-4 w-4 text-green-600" />
                        <CardTitle className="text-lg leading-tight">
                          {hotel.name}
                        </CardTitle>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {hotel.location || hotel.address}
                        </span>
                      </div>

                      {/* Rating */}
                      {hotel.rating && (
                        <div className="mb-2">
                          {renderStarRating(hotel.rating)}
                        </div>
                      )}

                      {/* Distance from center */}
                      {hotel.distance_from_center && (
                        <div className="flex items-center gap-1 mb-2">
                          <MapPin className="h-3 w-3 text-blue-600" />
                          <span className="text-xs text-blue-600">
                            {hotel.distance_from_center} del centro
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
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
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Room Selection - Using RoomGroupSelector */}
                {isSelected && hotel.rooms && hotel.rooms.length > 0 && (
                  <RoomGroupSelector
                    rooms={hotel.rooms}
                    selectedRoomId={selectedRooms[hotel.id]}
                    onRoomSelect={(roomId) => handleRoomChange(hotel.id, roomId)}
                    isDisabled={false}
                    maxInitialRooms={3}
                  />
                )}

                {/* Room Details */}
                {(selectedRoom || bestRoom) && (
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        {(selectedRoom || bestRoom)?.type}
                      </h4>
                      <Badge variant="outline">
                        {(selectedRoom || bestRoom)?.availability} disponibles
                      </Badge>
                    </div>

                    {(selectedRoom || bestRoom)?.description && (
                      <p className="text-sm text-muted-foreground">
                        {(selectedRoom || bestRoom).description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Ocupación máxima
                      </span>
                      <span className="font-medium">
                        {(selectedRoom || bestRoom)?.max_occupancy || 2} personas
                      </span>
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {hotel.amenities && hotel.amenities.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Servicios incluidos:</h4>
                    <div className="flex flex-wrap gap-2">
                      {hotel.amenities.slice(0, 6).map((amenity: string, amenityIndex: number) => (
                        <Badge key={amenityIndex} variant="outline" className="flex items-center gap-1 text-xs">
                          {getAmenityIcon(amenity)}
                          {amenity}
                        </Badge>
                      ))}
                      {hotel.amenities.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{hotel.amenities.length - 6} más
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Info */}
                {(hotel.phone || hotel.website) && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    {hotel.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {hotel.phone}
                      </span>
                    )}
                    {hotel.website && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Sitio web disponible
                      </span>
                    )}
                  </div>
                )}

                {/* Policies */}
                {hotel.policies && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {hotel.policies.cancellation && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>Cancelación: {hotel.policies.cancellation}</span>
                      </div>
                    )}
                    {hotel.policies.checkin && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Check-in: {hotel.policies.checkin}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary and Actions */}
      {selectedHotels.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Resumen de selección</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedHotels.length} hotel{selectedHotels.length > 1 ? 'es' : ''} seleccionado{selectedHotels.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-600">
                  {selectedHotels.reduce((total, hotel) => {
                    const room = hotel.rooms?.find(r => r.occupancy_id === selectedRooms[hotel.id]) || hotel.rooms?.[0];
                    return total + (room?.total_price || 0);
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