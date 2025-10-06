import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, TrendingUp, TrendingDown, Users, DollarSign, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TenantWithMetrics } from '@/types';

interface TenantsPerformanceTableProps {
  tenants: TenantWithMetrics[];
}

export function TenantsPerformanceTable({ tenants }: TenantsPerformanceTableProps) {
  const navigate = useNavigate();
  if (tenants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Rendimiento por Tenant
          </CardTitle>
          <CardDescription>Comparativa de todos los tenants del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay tenants con datos aún
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Rendimiento por Tenant
        </CardTitle>
        <CardDescription>
          Comparativa de {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} del sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Agencias</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/tenants?selected=${tenant.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {tenant.name}
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{tenant.agencies_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {tenant.users_count || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{tenant.leads_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-3 w-3 text-success" />
                      <span className="font-medium">{formatCurrency(tenant.revenue || 0)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {tenant.conversion_rate >= 50 ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      )}
                      <span>{(tenant.conversion_rate || 0).toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                      {tenant.status === 'active' ? 'Activo' : 'Suspendido'}
                    </Badge>
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
