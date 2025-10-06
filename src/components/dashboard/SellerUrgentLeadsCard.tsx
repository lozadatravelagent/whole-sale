import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, MapPin, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UrgentLead {
  lead_id: string;
  contact_name: string;
  destination: string;
  due_date: string;
}

interface SellerUrgentLeadsCardProps {
  urgentLeads: UrgentLead[];
}

export function SellerUrgentLeadsCard({ urgentLeads }: SellerUrgentLeadsCardProps) {
  const navigate = useNavigate();

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyBadge = (days: number) => {
    if (days < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    } else if (days === 0) {
      return <Badge variant="destructive">Hoy</Badge>;
    } else if (days === 1) {
      return <Badge className="bg-orange-500">Mañana</Badge>;
    } else if (days <= 3) {
      return <Badge className="bg-yellow-500">{days} días</Badge>;
    }
    return <Badge variant="outline">{days} días</Badge>;
  };

  if (urgentLeads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-success" />
            Leads Urgentes
          </CardTitle>
          <CardDescription>No tienes leads urgentes. ¡Todo al día!</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-warning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Leads Urgentes
        </CardTitle>
        <CardDescription>{urgentLeads.length} lead{urgentLeads.length !== 1 ? 's' : ''} requiere{urgentLeads.length === 1 ? '' : 'n'} atención inmediata</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {urgentLeads.map((lead) => {
          const days = getDaysUntilDue(lead.due_date);

          return (
            <div
              key={lead.lead_id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              onClick={() => navigate('/crm')}
            >
              <div className="flex-1">
                <div className="font-medium">{lead.contact_name}</div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {lead.destination}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(lead.due_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div>
                {getUrgencyBadge(days)}
              </div>
            </div>
          );
        })}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate('/crm')}
        >
          Ver todos en CRM
        </Button>
      </CardContent>
    </Card>
  );
}
