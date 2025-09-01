import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Plus, 
  FileText, 
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign
} from 'lucide-react';
import type { Lead } from '@/types';

const CRM = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const mockLeads: Lead[] = [
    {
      id: '1',
      tenant_id: 'tenant1',
      agency_id: 'agency1',
      contact: { name: 'María González', phone: '+54911234567', email: 'maria@email.com' },
      trip: {
        type: 'hotel',
        dates: { checkin: '2024-03-15', checkout: '2024-03-22' },
        city: 'Madrid',
        adults: 2,
        children: 0
      },
      status: 'quoted',
      pdf_urls: ['https://example.com/quote-1.pdf'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      tenant_id: 'tenant1',
      agency_id: 'agency1',
      contact: { name: 'Carlos Ruiz', phone: '+54911987654' },
      trip: {
        type: 'package',
        dates: { checkin: '2024-04-10', checkout: '2024-04-17' },
        city: 'Cancún',
        adults: 2,
        children: 1
      },
      status: 'new',
      pdf_urls: [],
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3',
      tenant_id: 'tenant1',
      agency_id: 'agency1',
      contact: { name: 'Ana López', phone: '+54911555444', email: 'ana@email.com' },
      trip: {
        type: 'flight',
        dates: { checkin: '2024-05-01', checkout: '2024-05-08' },
        city: 'Miami',
        adults: 1,
        children: 0
      },
      status: 'won',
      pdf_urls: ['https://example.com/quote-3.pdf', 'https://example.com/booking-3.pdf'],
      created_at: new Date(Date.now() - 172800000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    }
  ];

  const statusColumns = [
    { status: 'new' as const, title: 'New Leads', color: 'bg-muted' },
    { status: 'quoted' as const, title: 'Quoted', color: 'bg-warning/10' },
    { status: 'negotiating' as const, title: 'Negotiating', color: 'bg-primary/10' },
    { status: 'won' as const, title: 'Won', color: 'bg-success/10' },
    { status: 'lost' as const, title: 'Lost', color: 'bg-destructive/10' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'quoted': return 'secondary';
      case 'negotiating': return 'outline';
      case 'won': return 'default';
      case 'lost': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <MainLayout userRole="ADMIN">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
            <p className="text-muted-foreground mt-1">Manage leads and customer relationships</p>
          </div>
          <Button className="bg-gradient-hero shadow-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[600px]">
          {statusColumns.map((column) => {
            const leads = mockLeads.filter(lead => lead.status === column.status);
            
            return (
              <div key={column.status} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    {column.title}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {leads.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {leads.map((lead) => (
                    <Card key={lead.id} className="shadow-card cursor-pointer hover:shadow-lg transition-shadow">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{lead.contact.name}</h4>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <Phone className="h-3 w-3 mr-1" />
                              {lead.contact.phone}
                            </div>
                            {lead.contact.email && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Mail className="h-3 w-3 mr-1" />
                                {lead.contact.email}
                              </div>
                            )}
                          </div>
                          <Badge variant={getStatusColor(lead.status) as any} className="text-xs">
                            {lead.status}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <Calendar className="h-3 w-3 mr-2 text-muted-foreground" />
                            <span className="font-medium">{lead.trip.city}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(lead.trip.dates.checkin)} - {formatDate(lead.trip.dates.checkout)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {lead.trip.adults} adults{lead.trip.children > 0 && `, ${lead.trip.children} children`} • {lead.trip.type}
                          </div>
                        </div>

                        {lead.pdf_urls.length > 0 && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-xs text-muted-foreground">
                              <FileText className="h-3 w-3 mr-1" />
                              {lead.pdf_urls.length} PDF{lead.pdf_urls.length > 1 ? 's' : ''}
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                              View
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(lead.created_at)}
                          </span>
                          {lead.status === 'won' && (
                            <div className="flex items-center text-xs text-success">
                              <DollarSign className="h-3 w-3 mr-1" />
                              Revenue
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {leads.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className={`w-full h-32 rounded-lg ${column.color} flex items-center justify-center`}>
                        <User className="h-8 w-8 opacity-50" />
                      </div>
                      <p className="text-sm mt-2">No leads in {column.title.toLowerCase()}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};

export default CRM;