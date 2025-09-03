import React from 'react';
import { Lead, Seller } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, DollarSign } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  onDelete?: () => void;
  onSave?: (updates: Partial<Lead>) => void;
  isDragging?: boolean;
  seller?: Seller;
  sectionName?: string; // Nueva prop para el nombre de la sección
}

export function LeadCard({ lead, onClick, isDragging, sectionName }: LeadCardProps) {
  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card 
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]
        ${isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}
      `}
      onClick={onClick}
    >
      <CardContent className="p-3">
        {/* Nombre de la tarjeta */}
        <h3 className="font-semibold text-sm mb-2 text-foreground">
          {lead.contact.name}
        </h3>

        {/* Destino */}
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{lead.trip.city}</span>
        </div>

        {/* Presupuesto */}
        <div className="flex items-center gap-1">
          <DollarSign className={`h-3 w-3 ${
            sectionName?.toLowerCase().includes('perdido') || sectionName?.toLowerCase().includes('lost')
              ? 'text-red-600' 
              : 'text-green-600'
          }`} />
          <span className={`text-sm font-bold ${
            sectionName?.toLowerCase().includes('perdido') || sectionName?.toLowerCase().includes('lost')
              ? 'text-red-600' 
              : 'text-green-600'
          }`}>
            {formatCurrency(lead.budget)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}