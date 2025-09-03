import React from 'react';
import { Lead, Seller } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, Users, FileText, MoreHorizontal, Trash2, DollarSign, CheckSquare, AlertTriangle, Mail, User, Paperclip } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
  seller?: Seller;
}

export function LeadCard({ lead, onClick, onDelete, isDragging, seller }: LeadCardProps) {
  const tripTypeColors = {
    hotel: 'bg-blue-100 text-blue-800',
    flight: 'bg-green-100 text-green-800',
    package: 'bg-purple-100 text-purple-800'
  };

  const tripTypeLabels = {
    hotel: 'Hotel',
    flight: 'Vuelo', 
    package: 'Paquete'
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM', { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const completedChecklist = (lead.checklist || []).filter(item => item.completed).length;
  const totalChecklist = (lead.checklist || []).length;
  const isTaskOverdue = isOverdue(lead.due_date);

  return (
    <Card 
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md
        ${isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}
        ${isTaskOverdue ? 'border-l-4 border-l-red-500' : ''}
      `}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(lead.contact.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-sm leading-none">{lead.contact.name}</h3>
              <div className="flex items-center gap-1 mt-1">
                <p className="text-xs text-muted-foreground">{lead.contact.phone}</p>
                {lead.contact.email && <Mail className="h-3 w-3 text-muted-foreground" />}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={handleMenuClick}>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border shadow-lg">
              <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                <Trash2 className="h-3 w-3 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Overdue Warning */}
        {isTaskOverdue && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded mb-2">
            <AlertTriangle className="h-3 w-3" />
            <span>Vencido el {formatDate(lead.due_date!)}</span>
          </div>
        )}

        {/* Trip Info */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-xs ${tripTypeColors[lead.trip.type]}`}>
              {tripTypeLabels[lead.trip.type]}
            </Badge>
            <span className="text-xs text-muted-foreground">{lead.trip.city}</span>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              <span>{formatDate(lead.trip.dates.checkin)} - {formatDate(lead.trip.dates.checkout)}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{lead.trip.adults + lead.trip.children}</span>
            </div>
          </div>
        </div>

        {/* Budget */}
        {lead.budget && lead.budget > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Presupuesto:</span>
            <div className="flex items-center text-sm font-semibold text-green-600">
              <DollarSign className="h-3 w-3 mr-1" />
              {formatCurrency(lead.budget)}
            </div>
          </div>
        )}

        {/* Seller */}
        {seller && (
          <div className="flex items-center text-xs text-muted-foreground mb-2">
            <User className="h-3 w-3 mr-1" />
            <span>Vendedor: {seller.name}</span>
          </div>
        )}

        {/* Due Date (if not overdue) */}
        {lead.due_date && !isTaskOverdue && (
          <div className="flex items-center text-xs text-muted-foreground mb-2">
            <CalendarDays className="h-3 w-3 mr-1" />
            <span>Vence: {formatDate(lead.due_date)}</span>
          </div>
        )}

        {/* Progress Indicators */}
        <div className="flex items-center justify-between text-xs mb-3">
          {/* Checklist Progress */}
          {totalChecklist > 0 && (
            <div className="flex items-center space-x-1">
              <CheckSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {completedChecklist}/{totalChecklist}
              </span>
              {completedChecklist === totalChecklist && (
                <span className="text-green-600 font-bold">✓</span>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            {/* Description indicator */}
            {lead.description && (
              <FileText className="h-3 w-3 text-muted-foreground" />
            )}

            {/* Attachments count */}
            {(lead.attachments && lead.attachments.length > 0) && (
              <div className="flex items-center space-x-1">
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{lead.attachments.length}</span>
              </div>
            )}

            {/* PDF count */}
            {lead.pdf_urls && lead.pdf_urls.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {lead.pdf_urls.length} PDF
              </Badge>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {format(new Date(lead.created_at), 'dd/MM/yyyy')}
          </span>
          
          {lead.contact.email && (
            <Badge variant="outline" className="text-xs">
              Email
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}