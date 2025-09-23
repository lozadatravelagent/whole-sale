// Kanban Card component for displaying lead information in columns
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Phone,
  Mail,
  Clock,
  Plane,
  Hotel,
  Package,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import type { KanbanCardProps } from '../../types/kanban';
import {
  formatCurrency,
  formatDate,
  calculateChecklistProgress,
  formatTripType
} from '../../utils';

export function KanbanCard({
  lead,
  onClick,
  isDragging,
  sectionName
}: KanbanCardProps) {
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

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(lead);
  };

  // Calculate progress
  const checklistProgress = calculateChecklistProgress(lead.checklist);

  // Get trip icon
  const getTripIcon = () => {
    switch (lead.trip.type) {
      case 'flight':
        return <Plane className="h-3 w-3" />;
      case 'hotel':
        return <Hotel className="h-3 w-3" />;
      case 'package':
        return <Package className="h-3 w-3" />;
      default:
        return <Package className="h-3 w-3" />;
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (lead.status) {
      case 'new':
        return 'bg-blue-500';
      case 'quoted':
        return 'bg-yellow-500';
      case 'negotiating':
        return 'bg-orange-500';
      case 'won':
        return 'bg-green-500';
      case 'lost':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Check if lead is urgent (due date within 3 days)
  const isUrgent = () => {
    if (!lead.due_date) return false;
    const dueDate = new Date(lead.due_date);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3 && diffDays >= 0;
  };

  // Check if lead is overdue
  const isOverdue = () => {
    if (!lead.due_date) return false;
    const dueDate = new Date(lead.due_date);
    const today = new Date();
    return dueDate < today;
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]
        ${isDragging || isSortableDragging ? 'rotate-2 shadow-lg' : ''}
        ${isOverdue() ? 'border-red-500 bg-red-50' : isUrgent() ? 'border-yellow-500 bg-yellow-50' : ''}
      `}
      onClick={handleCardClick}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header with avatar and status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10">
                {getInitials(lead.contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">
                {lead.contact.name}
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            {(isOverdue() || isUrgent()) && (
              <AlertTriangle className={`h-3 w-3 ${isOverdue() ? 'text-red-500' : 'text-yellow-500'}`} />
            )}
          </div>
        </div>

        {/* Trip Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            {getTripIcon()}
            <span className="text-xs text-muted-foreground">
              {formatTripType(lead.trip.type)}
            </span>
            <Badge variant="outline" className="text-xs ml-auto">
              {lead.status}
            </Badge>
          </div>

          {/* Destination */}
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {lead.trip.city}
            </span>
          </div>

          {/* Dates */}
          {lead.trip.dates.checkin && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                {formatDate(lead.trip.dates.checkin, 'short')}
                {lead.trip.dates.checkout && (
                  <> - {formatDate(lead.trip.dates.checkout, 'short')}</>
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
        <div className="flex items-center justify-between">
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
              <Clock className={`h-3 w-3 ${isOverdue() ? 'text-red-500' : isUrgent() ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              <span className={`text-xs ${isOverdue() ? 'text-red-500' : isUrgent() ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {(() => {
                  const days = Math.ceil((new Date(lead.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  if (days < 0) return `${Math.abs(days)} días vencido`;
                  if (days === 0) return 'Vence hoy';
                  if (days === 1) return 'Vence mañana';
                  return `${days} días`;
                })()}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {lead.checklist && lead.checklist.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progreso</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
                {checklistProgress === 100 && (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  checklistProgress === 100 ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lead.contact.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span className="truncate">{lead.contact.phone}</span>
            </div>
          )}
          {lead.contact.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.contact.email}</span>
            </div>
          )}
        </div>

        {/* Tags/Labels */}
        <div className="flex flex-wrap gap-1">
          {lead.trip.type && (
            <Badge variant="outline" className="text-xs">
              {formatTripType(lead.trip.type)}
            </Badge>
          )}
          {isUrgent() && !isOverdue() && (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
              Urgente
            </Badge>
          )}
          {isOverdue() && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-600">
              Vencido
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}