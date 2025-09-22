import React from 'react';
import {
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Lead } from '@/types';
import { Calendar, MapPin, Users, DollarSign, Phone, Mail } from 'lucide-react';

interface TrelloCardProps {
    lead: Lead;
    onClick: (lead: Lead) => void;
    isDragging?: boolean;
}

export function TrelloCard({ lead, onClick, isDragging }: TrelloCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging
    } = useSortable({
        id: lead.id,
        data: {
            type: 'lead',
            lead
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging || isSortableDragging ? 0.5 : 1,
    };

    // Parse trip data safely
    let tripData: any = {};
    try {
        tripData = typeof lead.trip === 'string' ? JSON.parse(lead.trip) : (lead.trip || {});
    } catch (error) {
        console.warn('Error parsing trip data:', error);
        tripData = {};
    }

    // Parse contact data safely
    let contactData: any = {};
    try {
        contactData = typeof lead.contact === 'string' ? JSON.parse(lead.contact) : (lead.contact || {});
    } catch (error) {
        console.warn('Error parsing contact data:', error);
        contactData = {};
    }

    // Generate title based on trip type
    const getTripTitle = () => {
        const tripType = tripData.type || 'package';
        let title = '';
        let destination = '';
        const price = lead.budget || 0;

        switch (tripType) {
            case 'flight':
                title = 'Vuelo';
                // For flights, we need to extract origin and destination from the description or other fields
                // Let's check if we have flight details in the description
                if (lead.description && lead.description.includes('✈️')) {
                    const lines = lead.description.split('\n');
                    const flightLine = lines.find(line => line.includes('✈️'));
                    if (flightLine) {
                        // Extract origin and destination from format like "Origen: Buenos Aires" and "Destino: Madrid"
                        const originMatch = lead.description.match(/Origen:\s*([^\n]+)/);
                        const destMatch = lead.description.match(/Destino:\s*([^\n]+)/);
                        if (originMatch && destMatch) {
                            destination = `${originMatch[1].trim()}-${destMatch[1].trim()}`;
                        } else if (tripData.city) {
                            destination = tripData.city;
                        }
                    }
                } else if (tripData.city) {
                    destination = tripData.city;
                }
                break;
            case 'hotel':
                title = 'Hotel';
                destination = tripData.city || '';
                break;
            default:
                title = 'Paquete';
                destination = tripData.city || '';
                break;
        }

        // Add destination and price to title
        if (destination) {
            if (price > 0) {
                return `${title} (${destination}, €${price.toFixed(1)})`;
            } else {
                return `${title} (${destination})`;
            }
        } else {
            if (price > 0) {
                return `${title} (€${price.toFixed(1)})`;
            } else {
                return title;
            }
        }
    };

    // Get destination
    const getDestination = () => {
        return tripData.city || 'Sin destino';
    };

    // Get price
    const getPrice = () => {
        return lead.budget || 0;
    };

    // Get status color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'quoted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'negotiating': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'won': return 'bg-green-100 text-green-800 border-green-200';
            case 'lost': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Get initials from name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${isDragging || isSortableDragging ? 'shadow-lg rotate-2' : ''
                }`}
            onClick={() => onClick(lead)}
        >
            <CardContent className="p-3">
                {/* Título: Vuelo/Hotel/Paquete (Origen, Destino, precio) */}
                <h3 className="font-semibold text-sm mb-2 text-foreground">
                    {getTripTitle()}
                </h3>

                {/* Destino */}
                <div className="flex items-center gap-1 mb-2">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{getDestination()}</span>
                </div>

                {/* Precio - alineado a la derecha abajo */}
                <div className="flex justify-end mt-2">
                    <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-600" />
                        <span className="text-sm font-bold text-green-600">
                            {getPrice() > 0 ? formatCurrency(getPrice()) : 'Sin precio'}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
