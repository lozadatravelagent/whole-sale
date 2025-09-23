// Refactored Lead Card component with enhanced functionality
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, DollarSign, Calendar, Users, Clock } from 'lucide-react';
import type { LeadCardProps } from '../../types/lead';
import { formatCurrency, formatLeadSubtitle, formatLeadStatusColor, calculateChecklistProgress } from '../../utils';

export function LeadCard({
  lead,
  onClick,
  isDragging,
  sectionName,
  onDelete,
  onSave
}: LeadCardProps) {
  const checklistProgress = calculateChecklistProgress(lead.checklist);
  const statusColor = formatLeadStatusColor(lead.status);

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.();
  };

  return (
    <Card
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]
        ${isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}
      `}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
        {/* Header with name and status */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-sm text-foreground line-clamp-1">
            {lead.contact.name}
          </h3>
          <Badge
            variant="secondary"
            className={`text-xs px-2 py-1 ${statusColor} text-white`}
          >
            {lead.status}
          </Badge>
        </div>

        {/* Trip details */}
        <div className="space-y-1 mb-3">
          {/* Destination */}
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{lead.trip.city}</span>
          </div>

          {/* Dates */}
          {lead.trip.dates.checkin && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                {new Date(lead.trip.dates.checkin).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short'
                })}
                {lead.trip.dates.checkout && (
                  <> - {new Date(lead.trip.dates.checkout).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short'
                  })}</>
                )}
              </span>
            </div>
          )}

          {/* Travelers */}
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              {lead.trip.adults + lead.trip.children} personas
            </span>
          </div>
        </div>

        {/* Budget */}
        <div className="flex items-center justify-between mb-2">
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

          {/* Due date indicator */}
          {lead.due_date && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-orange-500" />
              <span className="text-xs text-orange-500">
                {Math.ceil((new Date(lead.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} días
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {lead.checklist && lead.checklist.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progreso</span>
              <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Trip type indicator */}
        <div className="mt-2 flex justify-end">
          <Badge variant="outline" className="text-xs">
            {lead.trip.type === 'hotel' ? 'Hotel' : lead.trip.type === 'flight' ? 'Vuelo' : 'Paquete'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}