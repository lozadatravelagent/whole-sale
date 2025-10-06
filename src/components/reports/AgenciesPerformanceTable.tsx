import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building, TrendingUp, TrendingDown, Users, DollarSign, MessageSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AgencyPerformance } from '@/types';

interface AgenciesPerformanceTableProps {
  agencies: AgencyPerformance[];
  showTenant?: boolean; // OWNER sees tenant column, SUPERADMIN doesn't
}

export function AgenciesPerformanceTable({ agencies, showTenant = false }: AgenciesPerformanceTableProps) {
  const navigate = useNavigate();
  if (agencies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Rendimiento por Agencia
          </CardTitle>
          <CardDescription>Comparativa de todas las agencias</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay agencias con datos aún
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Sort by revenue descending
  const sortedAgencies = [...agencies].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Rendimiento por Agencia
        </CardTitle>
        <CardDescription>
          Comparativa de {agencies.length} agencia{agencies.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ranking</TableHead>
                <TableHead>Agencia</TableHead>
                {showTenant && <TableHead>Tenant</TableHead>}
                <TableHead className="text-right">Sellers</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
                <TableHead className="text-right">Conversaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAgencies.map((agency, index) => (
                <TableRow
                  key={agency.agency_id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/agencies?selected=${agency.agency_id}`)}
                >
                  <TableCell>
                    <Badge variant={index === 0 ? 'default' : 'outline'}>
                      #{index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {agency.agency_name}
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                  </TableCell>
                  {showTenant && (
                    <TableCell className="text-sm text-muted-foreground">
                      {agency.tenant_name || '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {agency.sellers_count || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{agency.leads_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-3 w-3 text-success" />
                      <span className="font-medium">{formatCurrency(agency.revenue || 0)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {agency.conversion_rate >= 50 ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      )}
                      <span>{(agency.conversion_rate || 0).toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      {agency.active_conversations || 0}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
