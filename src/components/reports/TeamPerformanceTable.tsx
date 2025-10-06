import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, TrendingDown, DollarSign, Award, Target } from 'lucide-react';
import type { SellerPerformance } from '@/types';

interface TeamPerformanceTableProps {
  team: SellerPerformance[];
}

export function TeamPerformanceTable({ team }: TeamPerformanceTableProps) {
  if (team.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Rendimiento del Equipo
          </CardTitle>
          <CardDescription>Performance de vendedores de tu agencia</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay sellers con datos aún
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
  const sortedTeam = [...team].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

  // Calculate team average for comparison
  const teamAverage = {
    conversion: team.reduce((sum, s) => sum + (s.conversion_rate || 0), 0) / team.length,
    revenue: team.reduce((sum, s) => sum + (s.revenue || 0), 0) / team.length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Rendimiento del Equipo
        </CardTitle>
        <CardDescription>
          Performance de {team.length} vendedor{team.length !== 1 ? 'es' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ranking</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Ganados</TableHead>
                <TableHead className="text-right">Perdidos</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
                <TableHead className="text-right">Ticket Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeam.map((seller, index) => {
                const isTopPerformer = index === 0;
                const isAboveAverage = (seller.conversion_rate || 0) >= teamAverage.conversion;

                return (
                  <TableRow
                    key={seller.seller_id}
                    className={`hover:bg-muted/50 ${isTopPerformer ? 'bg-primary/5' : ''}`}
                  >
                    <TableCell>
                      <Badge variant={isTopPerformer ? 'default' : 'outline'}>
                        {isTopPerformer && <Award className="h-3 w-3 mr-1" />}
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {seller.seller_name}
                    </TableCell>
                    <TableCell className="text-right">{seller.leads_count || 0}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-success font-medium">{seller.won_count || 0}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-destructive">{seller.lost_count || 0}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-3 w-3 text-success" />
                        <span className="font-medium">{formatCurrency(seller.revenue || 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          {isAboveAverage ? (
                            <TrendingUp className="h-3 w-3 text-success" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-destructive" />
                          )}
                          <span>{(seller.conversion_rate || 0).toFixed(1)}%</span>
                        </div>
                        <Progress
                          value={seller.conversion_rate || 0}
                          className="h-1 w-16"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(seller.avg_budget || 0)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Team Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Conversión Promedio</div>
            <div className="text-2xl font-bold">{teamAverage.conversion.toFixed(1)}%</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Revenue Promedio</div>
            <div className="text-2xl font-bold">{formatCurrency(teamAverage.revenue)}</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(team.reduce((sum, s) => sum + (s.revenue || 0), 0))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
