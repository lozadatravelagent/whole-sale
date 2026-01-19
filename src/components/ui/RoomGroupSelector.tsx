import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Bed, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { translateRoomDescription } from '@/features/chat/utils/translations';

interface Room {
    occupancy_id: string;
    xml_occupancy_id?: string; // Real OccupancyId from XML for makeBudget
    type: string;
    description?: string;
    total_price: number;
    currency: string;
    availability: number;
    price_per_night?: number;
    fare_id_broker?: string;
    // Campos adicionales para diferencias de precio
    amenities?: string[];
    view?: string;
    floor?: number;
    size?: string;
}

interface ExactPriceData {
    price: number;
    currency: string;
    budgetId: string;
}

interface RoomGroupSelectorProps {
    rooms: Room[];
    selectedRoomId?: string;
    onRoomSelect: (roomId: string) => void;
    isDisabled?: boolean;
    maxInitialRooms?: number;
    requestedRoomType?: 'single' | 'double' | 'triple';
    requestedMealPlan?: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only';
    // New props for exact price display
    exactPrices?: Record<string, ExactPriceData>;
    loadingPrices?: Record<string, boolean>;
    hotelId?: string;
    nights?: number; // Number of nights for per-night price calculation
}

const RoomGroupSelector: React.FC<RoomGroupSelectorProps> = ({
    rooms,
    selectedRoomId,
    onRoomSelect,
    isDisabled = false,
    maxInitialRooms = 3,
    requestedRoomType,
    requestedMealPlan,
    exactPrices = {},
    loadingPrices = {},
    hotelId = '',
    nights
}) => {
    const [showAllRooms, setShowAllRooms] = useState(false);

    // Helper to get exact price for a room
    const getExactPrice = (roomId: string): ExactPriceData | null => {
        const priceKey = `${hotelId}-${roomId}`;
        return exactPrices[priceKey] || null;
    };

    // Helper to check if price is loading for a room
    const isLoadingPrice = (roomId: string): boolean => {
        const priceKey = `${hotelId}-${roomId}`;
        return loadingPrices[priceKey] || false;
    };

    // Helper to calculate per-night price from exact total price
    // Returns null if per-night price cannot be calculated (prevents showing total as per-night)
    const calculateExactPricePerNight = (exactPrice: ExactPriceData, room: Room): number | null => {
        // Validate exactPrice.price is a valid positive number
        if (!exactPrice.price || !isFinite(exactPrice.price) || exactPrice.price <= 0) {
            console.warn('⚠️ [EXACT_PRICE] Invalid exactPrice.price:', exactPrice.price);
            return null; // Return null instead of 0 to indicate calculation not possible
        }

        // If price_per_night exists and is valid (> 0), use the ratio method
        if (room.price_per_night && room.price_per_night > 0 && room.total_price > 0 && isFinite(room.total_price)) {
            // Calculate ratio: price_per_night / total_price
            // Then apply to exact total: exactPrice.price * ratio
            const ratio = room.price_per_night / room.total_price;
            if (isFinite(ratio) && ratio > 0) {
                const perNight = exactPrice.price * ratio;
                // Validate result is finite and positive
                if (isFinite(perNight) && perNight > 0) {
                    return perNight;
                }
            }
        }

        // Fallback: use nights if available
        if (nights && nights > 0 && isFinite(nights)) {
            const perNight = exactPrice.price / nights;
            // Validate result is finite and positive
            if (isFinite(perNight) && perNight > 0) {
                return perNight;
            }
        }

        // Return null if we can't calculate per-night safely
        // This prevents showing total price as per-night price
        console.warn('⚠️ [EXACT_PRICE] Could not calculate per-night price:', {
            hasPricePerNight: !!room.price_per_night,
            totalPrice: room.total_price,
            nights,
            exactTotalPrice: exactPrice.price
        });
        return null;
    };

    // Agrupar habitaciones por tipo y ordenar por precio
    // ✅ Rooms are already filtered by handleHotelSearch, no need to filter again
    const groupedRooms = useMemo(() => {
        const groups: { [key: string]: Room[] } = {};

        console.log(`📊 [ROOM SELECTOR] Total rooms to display: ${rooms.length} (already filtered by backend)`);

        rooms.forEach(room => {
            const roomType = room.type || 'Otro';
            if (!groups[roomType]) {
                groups[roomType] = [];
            }
            groups[roomType].push(room);
        });

        // Ordenar habitaciones dentro de cada grupo por precio (menor a mayor)
        Object.keys(groups).forEach(type => {
            groups[type].sort((a, b) => a.total_price - b.total_price);
        });

        return groups;
    }, [rooms]);

    const getAvailabilityStatus = (availability: number) => {
        if (availability >= 3) return { text: 'Disponible', icon: CheckCircle, color: 'bg-green-500' };
        if (availability >= 2) return { text: 'Consultar', icon: AlertCircle, color: 'bg-yellow-500' };
        return { text: 'No disponible', icon: AlertCircle, color: 'bg-red-500' };
    };

    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency === 'USD' ? 'USD' : 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    // Función para analizar diferencias de precio y generar razones
    const getPriceDifferenceInfo = (room: Room, roomsInType: Room[]) => {
        const cheapestPrice = Math.min(...roomsInType.map(r => r.total_price));
        const mostExpensivePrice = Math.max(...roomsInType.map(r => r.total_price));
        const priceDifference = room.total_price - cheapestPrice;
        const isCheapest = room.total_price === cheapestPrice;
        const isMostExpensive = room.total_price === mostExpensivePrice;

        let reasons: string[] = [];
        let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";

        // Analizar razones basadas en la descripción y otros campos
        const description = (room.description || '').toLowerCase();

        if (isCheapest) {
            reasons.push("Mejor precio");
            badgeVariant = "default";
        } else if (isMostExpensive) {
            badgeVariant = "secondary";
        }

        // Analizar diferencias en la descripción
        if (description.includes('king') || description.includes('king size')) {
            reasons.push("Cama King Size");
        }
        if (description.includes('view') || description.includes('vista')) {
            reasons.push("Vista especial");
        }
        if (description.includes('high') || description.includes('superior')) {
            reasons.push("Categoría superior");
        }
        if (description.includes('confort') || description.includes('comfort')) {
            reasons.push("Mayor comodidad");
        }
        if (description.includes('executive') || description.includes('ejecutiva')) {
            reasons.push("Nivel ejecutivo");
        }
        if (description.includes('deluxe') || description.includes('lujo')) {
            reasons.push("Categoría Deluxe");
        }
        if (description.includes('suite')) {
            reasons.push("Suite");
        }
        if (description.includes('family') || description.includes('familiar')) {
            reasons.push("Capacidad familiar");
        }
        if (description.includes('triple')) {
            reasons.push("Para 3 personas");
        }

        // Si no hay razones específicas, usar diferencias de precio
        if (reasons.length === 0 && priceDifference > 0) {
            reasons.push(`+${formatPrice(priceDifference, room.currency)} vs. opción básica`);
        }

        return {
            priceDifference,
            isCheapest,
            isMostExpensive,
            reasons,
            badgeVariant,
            cheapestPrice,
            mostExpensivePrice
        };
    };

    // Calcular el total de habitaciones visibles
    const totalRooms = Object.values(groupedRooms).reduce((sum, rooms) => sum + rooms.length, 0);
    const shouldShowExpandButton = totalRooms > maxInitialRooms;

    // Obtener habitaciones a mostrar
    const getRoomsToShow = () => {
        if (showAllRooms) {
            return groupedRooms;
        }

        // Mostrar solo las mejores opciones de cada tipo
        const limitedGroups: { [key: string]: Room[] } = {};
        let roomsShown = 0;

        Object.entries(groupedRooms).forEach(([type, rooms]) => {
            if (roomsShown >= maxInitialRooms) return;

            // Mostrar la mejor opción de cada tipo (precio más bajo)
            const bestRoom = rooms[0];
            if (bestRoom) {
                limitedGroups[type] = [bestRoom];
                roomsShown++;
            }
        });

        return limitedGroups;
    };

    const roomsToShow = getRoomsToShow();

    if (rooms.length === 0) {
        return (
            <div className="text-center py-4 text-muted-foreground">
                <Bed className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay habitaciones disponibles</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h4 className="text-sm font-medium">Habitaciones disponibles:</h4>

            <div className="space-y-3">
                {Object.entries(roomsToShow).map(([roomType, roomsInType]) => (
                    <div key={roomType} className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-1 lg:grid-cols-2">
                            {roomsInType.map((room) => {
                                const availabilityStatus = getAvailabilityStatus(room.availability);
                                const AvailabilityIcon = availabilityStatus.icon;
                                const isRoomSelected = selectedRoomId === room.occupancy_id;
                                const priceInfo = getPriceDifferenceInfo(room, roomsInType);

                                return (
                                    <Card
                                        key={room.occupancy_id}
                                        className={`cursor-pointer transition-all ${isRoomSelected
                                            ? 'bg-primary/10 border-primary ring-2 ring-primary/20'
                                            : 'hover:bg-muted/50'
                                            } ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
                                        onClick={() => !isDisabled && onRoomSelect(room.occupancy_id)}
                                    >
                                        <CardContent className="p-3">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Bed className="h-4 w-4 text-muted-foreground" />
                                                        {/* Price display with exact price support */}
                                                        {isLoadingPrice(room.occupancy_id) ? (
                                                            <div className="flex items-center space-x-1">
                                                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                                <span className="text-xs text-muted-foreground">Calculando...</span>
                                                            </div>
                                                        ) : (() => {
                                                            const exactPrice = getExactPrice(room.occupancy_id);
                                                            const exactPricePerNight = exactPrice ? calculateExactPricePerNight(exactPrice, room) : null;

                                                            // Only show exact per-night price if we successfully calculated it
                                                            if (exactPricePerNight !== null) {
                                                                return (
                                                                    <div className="flex items-center space-x-1">
                                                                        <span className="font-medium text-sm text-primary">
                                                                            {formatPrice(exactPricePerNight, exactPrice!.currency)}
                                                                        </span>
                                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                                                                            Exacto
                                                                        </Badge>
                                                                    </div>
                                                                );
                                                            }

                                                            // If we have exact total but can't calculate per-night, show approximate per-night
                                                            // The exact total will be shown below
                                                            return (
                                                                <div className="flex items-center space-x-1">
                                                                    <span className="font-medium text-sm">
                                                                        {formatPrice(room.price_per_night, room.currency)}
                                                                    </span>
                                                                    {exactPrice ? (
                                                                        <span className="text-[10px] text-muted-foreground">(aprox. por noche)</span>
                                                                    ) : room.fare_id_broker ? (
                                                                        <span className="text-[10px] text-muted-foreground">(aprox.)</span>
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    {priceInfo.isCheapest && !getExactPrice(room.occupancy_id) && (
                                                        <Badge variant={priceInfo.badgeVariant} className="text-xs">
                                                            💰 Mejor precio
                                                        </Badge>
                                                    )}
                                                    {getExactPrice(room.occupancy_id) && priceInfo.isCheapest && (
                                                        <Badge variant="default" className="text-xs bg-green-600">
                                                            ✓ Precio verificado
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Mostrar diferencia de precio */}
                                                {priceInfo.priceDifference > 0 && !priceInfo.isCheapest && (
                                                    <div className="text-xs text-orange-600 font-medium">
                                                        +{formatPrice(priceInfo.priceDifference, room.currency)} vs. opción básica
                                                    </div>
                                                )}

                                                {/* Mostrar razones de la diferencia de precio */}
                                                {priceInfo.reasons.length > 0 && (
                                                    <div className="space-y-1">
                                                        {priceInfo.reasons.map((reason, index) => (
                                                            <Badge
                                                                key={index}
                                                                variant="outline"
                                                                className="text-xs mr-1 mb-1"
                                                            >
                                                                {reason}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}

                                                {room.description && room.description !== room.type && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {translateRoomDescription(room.description)}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-1">
                                                        <div className={`w-2 h-2 rounded-full ${availabilityStatus.color}`}></div>
                                                        <span className="text-xs">{availabilityStatus.text}</span>
                                                    </div>

                                                    {isRoomSelected && (
                                                        <CheckCircle className="h-4 w-4 text-primary" />
                                                    )}
                                                </div>

                                                {room.total_price && room.price_per_night !== room.total_price && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {getExactPrice(room.occupancy_id) ? (
                                                            <span className="text-green-700 font-medium">
                                                                {formatPrice(getExactPrice(room.occupancy_id)!.price, getExactPrice(room.occupancy_id)!.currency)} total
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {formatPrice(room.total_price, room.currency)} total {room.fare_id_broker && <span className="text-[10px]">(aprox.)</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {shouldShowExpandButton && (
                <div className="flex justify-center pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllRooms(!showAllRooms)}
                        className="flex items-center space-x-2"
                    >
                        {showAllRooms ? (
                            <>
                                <ChevronUp className="h-4 w-4" />
                                <span>Ver menos</span>
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-4 w-4" />
                                <span>Ver más opciones ({totalRooms - Object.keys(roomsToShow).length} más)</span>
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default RoomGroupSelector;
