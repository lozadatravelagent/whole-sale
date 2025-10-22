import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Bed, ChevronDown, ChevronUp } from 'lucide-react';
import { translateRoomDescription } from '@/features/chat/utils/translations';

interface Room {
    occupancy_id: string;
    type: string;
    description?: string;
    total_price: number;
    currency: string;
    availability: number;
    price_per_night?: number;
    // Campos adicionales para diferencias de precio
    amenities?: string[];
    view?: string;
    floor?: number;
    size?: string;
}

interface RoomGroupSelectorProps {
    rooms: Room[];
    selectedRoomId?: string;
    onRoomSelect: (roomId: string) => void;
    isDisabled?: boolean;
    maxInitialRooms?: number;
}

const RoomGroupSelector: React.FC<RoomGroupSelectorProps> = ({
    rooms,
    selectedRoomId,
    onRoomSelect,
    isDisabled = false,
    maxInitialRooms = 3
}) => {
    const [showAllRooms, setShowAllRooms] = useState(false);

    // Agrupar habitaciones por tipo y ordenar por precio
    const groupedRooms = useMemo(() => {
        const groups: { [key: string]: Room[] } = {};

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
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {translateRoomDescription(roomType)}
                        </div>

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
                                                        <span className="font-medium text-sm">
                                                            {formatPrice(room.price_per_night, room.currency)}
                                                        </span>
                                                    </div>

                                                    {priceInfo.isCheapest && (
                                                        <Badge variant={priceInfo.badgeVariant} className="text-xs">
                                                            💰 Mejor precio
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
                                                        {formatPrice(room.total_price, room.currency)} total
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
