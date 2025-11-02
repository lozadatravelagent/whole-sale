import React, { useState, useEffect } from 'react';
import { Lead, Seller, User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, DollarSign, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const [assignedUser, setAssignedUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadAssignedUser() {
      if (lead.assigned_user_id) {
        const { data } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', lead.assigned_user_id)
          .single();

        if (data) {
          setAssignedUser(data as User);
        }
      }
    }

    loadAssignedUser();
  }, [lead.assigned_user_id]);

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getUserInitials = (user: User) => {
    // Get initials from email (first 2 characters before @)
    const emailName = user.email.split('@')[0];
    return emailName.substring(0, 2).toUpperCase();
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
        {/* Header: Nombre + Avatar asignado */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <h3 className="font-semibold text-sm text-foreground flex-1">
            {lead.contact.name}
          </h3>

          {/* Avatar del usuario asignado */}
          {assignedUser ? (
            <Avatar className="h-6 w-6 flex-shrink-0" title={assignedUser.name || assignedUser.email}>
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                {getUserInitials(assignedUser)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0" title="Sin asignar">
              <UserIcon className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Destino */}
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">{lead.trip.city}</span>
        </div>

        {/* Footer: Presupuesto + Nombre del asignado */}
        <div className="flex items-center justify-between gap-2">
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

          {assignedUser && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={assignedUser.name || assignedUser.email}>
              {assignedUser.name || assignedUser.email.split('@')[0]}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}