import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { useReports } from '@/hooks/useReports';
import { useAuthUser } from '@/hooks/useAuthUser';
import * as XLSX from 'xlsx';
import { TenantsPerformanceTable } from '@/components/reports/TenantsPerformanceTable';
import { AgenciesPerformanceTable } from '@/components/reports/AgenciesPerformanceTable';
import { TeamPerformanceTable } from '@/components/reports/TeamPerformanceTable';
import { TrendsChart } from '@/components/reports/TrendsChart';
import { ChannelsChart } from '@/components/reports/ChannelsChart';
import { TripTypesChart } from '@/components/reports/TripTypesChart';
import {
  Download,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  FileText,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  Plane,
  Hotel,
  Package,
  Loader2,
  Star,
  Timer,
  Target,
  AlertTriangle,
  Award,
  Activity,
  Zap,
  Globe,
  Phone,
  Monitor,
  RefreshCw
} from 'lucide-react';

const Reports = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 días
    to: new Date()
  });

  // Usar datos reales del sistema
  const { metrics, loading, refresh } = useReports(dateRange?.from, dateRange?.to);
  const { isOwner, isSuperAdmin, isAdmin, isSeller } = useAuthUser();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTripTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'flight': return Plane;
      case 'hotel': return Hotel;
      case 'package':
      default: return Package;
    }
  };

  // Calculated metrics from real data
  const seasonalTrends = React.useMemo(() => {
    if (!metrics?.leadsOverTime) return [];

    // Group by month and calculate totals
    const monthlyData: { [key: string]: { leads: number; revenue: number; won: number } } = {};

    metrics.leadsOverTime.forEach(item => {
      const date = new Date(item.date);
      const monthKey = date.toLocaleDateString('es-ES', { month: 'short' });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { leads: 0, revenue: 0, won: 0 };
      }

      monthlyData[monthKey].leads += item.count;
      monthlyData[monthKey].revenue += item.revenue || 0;
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      leads: data.leads,
      revenue: data.revenue,
      conversion: data.leads > 0 ? ((data.won / data.leads) * 100) : 0
    })).slice(-6); // Last 6 months
  }, [metrics?.leadsOverTime]);

  // Mock data that will be replaced with real data from backend
  const extendedMetrics = {
    responseTimeAnalysis: [
      { range: '0-2 min', count: 45, percentage: 62.5, target: true },
      { range: '2-5 min', count: 18, percentage: 25.0, target: true },
      { range: '5-15 min', count: 6, percentage: 8.3, target: false },
      { range: '+15 min', count: 3, percentage: 4.2, target: false }
    ],
    customerSatisfaction: {
      average: 4.7,
      totalResponses: 284,
      distribution: [
        { stars: 5, count: 189, percentage: 66.5 },
        { stars: 4, count: 71, percentage: 25.0 },
        { stars: 3, count: 18, percentage: 6.3 },
        { stars: 2, count: 4, percentage: 1.4 },
        { stars: 1, count: 2, percentage: 0.7 }
      ]
    },
    integrationPerformance: [
      {
        provider: 'Eurovips',
        requests: 1245,
        successRate: 98.2,
        avgResponseTime: 1.4,
        revenue: 187600,
        status: 'excellent'
      },
      {
        provider: 'Starlings',
        requests: 892,
        successRate: 96.8,
        avgResponseTime: 2.1,
        revenue: 156300,
        status: 'good'
      },
      {
        provider: 'Delfos',
        requests: 534,
        successRate: 89.3,
        avgResponseTime: 4.2,
        revenue: 98700,
        status: 'needs_attention'
      }
    ]
  };

  const handleExport = () => {
    if (!metrics) return;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['Reporte Generado:', new Date().toLocaleDateString()],
      ['Período:', `${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`],
      [''],
      ['Métrica', 'Valor'],
      ['Total Leads', metrics.totalLeads],
      ['Leads Ganados', metrics.leadsWon],
      ['Leads Perdidos', metrics.leadsLost],
      ['Tasa de Conversión', `${metrics.conversionRate.toFixed(2)}%`],
      ['Revenue Total', `$${metrics.totalRevenue.toLocaleString()}`],
      ['Presupuesto Promedio', `$${metrics.averageBudget.toLocaleString()}`],
      ['Total Conversaciones', metrics.totalConversations],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

    // Sheet 2: Team Performance (if ADMIN)
    if (isAdmin && metrics.teamPerformance && metrics.teamPerformance.length > 0) {
      const teamData = metrics.teamPerformance.map(seller => ({
        'Vendedor': seller.seller_name,
        'Leads': seller.leads_count,
        'Ganados': seller.won_count,
        'Perdidos': seller.lost_count,
        'Revenue': seller.revenue,
        'Conversión (%)': seller.conversion_rate.toFixed(2),
        'Ticket Promedio': seller.avg_budget.toFixed(2)
      }));
      const ws2 = XLSX.utils.json_to_sheet(teamData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Equipo');
    }

    // Sheet 3: Agencies Performance (if OWNER/SUPERADMIN)
    if ((isOwner || isSuperAdmin) && metrics.agenciesPerformance && metrics.agenciesPerformance.length > 0) {
      const agenciesData = metrics.agenciesPerformance.map(agency => ({
        'Agencia': agency.agency_name,
        ...(isOwner && { 'Tenant': agency.tenant_name || '-' }),
        'Sellers': agency.sellers_count,
        'Leads': agency.leads_count,
        'Revenue': agency.revenue,
        'Conversión (%)': agency.conversion_rate.toFixed(2),
        'Conversaciones Activas': agency.active_conversations
      }));
      const ws3 = XLSX.utils.json_to_sheet(agenciesData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Agencias');
    }

    // Sheet 4: Destinations
    if (metrics.topDestinations && metrics.topDestinations.length > 0) {
      const destinationsData = metrics.topDestinations.map(dest => ({
        'Destino': dest.destination,
        'Leads': dest.count,
        'Revenue': dest.revenue
      }));
      const ws4 = XLSX.utils.json_to_sheet(destinationsData);
      XLSX.utils.book_append_sheet(wb, ws4, 'Destinos');
    }

    // Sheet 5: Channels
    if (metrics.channelMetrics && metrics.channelMetrics.length > 0) {
      const channelsData = metrics.channelMetrics.map(channel => ({
        'Canal': channel.channel,
        'Conversaciones': channel.conversations,
        'Leads': channel.leads,
        'Conversión (%)': channel.conversion.toFixed(2)
      }));
      const ws5 = XLSX.utils.json_to_sheet(channelsData);
      XLSX.utils.book_append_sheet(wb, ws5, 'Canales');
    }

    // Export to file
    const fileName = `reporte-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <MainLayout userRole="ADMIN">
        <div className="p-8 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Cargando reportes...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!metrics) {
    return (
      <MainLayout userRole="ADMIN">
        <div className="p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">No se pudieron cargar los reportes</h2>
            <Button onClick={refresh}>Reintentar</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-full overflow-y-auto p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
            <p className="text-muted-foreground mt-1">Análisis y métricas del sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={refresh} variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar Reporte
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <DatePickerWithRange
                  date={dateRange}
                  onDateChange={setDateRange}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Mostrando datos de {metrics.totalLeads} leads
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards - DATOS REALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalConversations} conversaciones
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Ganados</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{metrics.leadsWon}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.leadsLost} perdidos
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
              <Progress value={metrics.conversionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                Promedio: {formatCurrency(metrics.averageBudget)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Role-specific Performance Tables */}
        {isOwner && metrics.tenantsPerformance && metrics.tenantsPerformance.length > 0 && (
          <TenantsPerformanceTable tenants={metrics.tenantsPerformance} />
        )}

        {isOwner && metrics.agenciesPerformance && metrics.agenciesPerformance.length > 0 && (
          <AgenciesPerformanceTable agencies={metrics.agenciesPerformance} showTenant={true} />
        )}

        {isSuperAdmin && metrics.agenciesPerformance && metrics.agenciesPerformance.length > 0 && (
          <AgenciesPerformanceTable agencies={metrics.agenciesPerformance} showTenant={false} />
        )}

        {isAdmin && metrics.teamPerformance && metrics.teamPerformance.length > 0 && (
          <TeamPerformanceTable team={metrics.teamPerformance} />
        )}

        {/* Charts Section */}
        {metrics.leadsOverTime && metrics.leadsOverTime.length > 0 && (
          <TrendsChart data={metrics.leadsOverTime} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {metrics.channelMetrics && metrics.channelMetrics.length > 0 && (
            <ChannelsChart data={metrics.channelMetrics} />
          )}

          {metrics.tripTypes && metrics.tripTypes.length > 0 && (
            <TripTypesChart data={metrics.tripTypes} />
          )}
        </div>


        {/* Análisis de Pérdidas - DATOS REALES */}
        {metrics.lossAnalysis && metrics.lossAnalysis.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Análisis de Pérdidas
              </CardTitle>
              <CardDescription>Principales razones por las que se pierden leads ({metrics.leadsLost} perdidos)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.lossAnalysis.map((reason, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{reason.reason}</span>
                    <Badge variant="outline">{reason.count} casos</Badge>
                  </div>
                  <Progress value={reason.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">{reason.percentage.toFixed(1)}% de las pérdidas</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tendencias Estacionales - DATOS REALES */}
        {seasonalTrends.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                Tendencias Estacionales
              </CardTitle>
              <CardDescription>Últimos 6 meses - Leads, ingresos y conversión</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {seasonalTrends.map((month, index) => (
                <div key={index} className="p-3 rounded-lg bg-gradient-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{month.month}</span>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-success">{formatCurrency(month.revenue)}</div>
                      <div className="text-xs text-muted-foreground">{month.leads} leads</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Conversión: {month.conversion.toFixed(1)}%</span>
                    <Progress value={month.conversion} className="h-1 w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Comparativa del Equipo - DATOS REALES */}
        {isAdmin && metrics?.teamPerformance && metrics.teamPerformance.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Comparativa del Equipo
              </CardTitle>
              <CardDescription>Performance detallada de cada vendedor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.teamPerformance.map((member, index) => (
                <div key={index} className="p-4 rounded-lg bg-gradient-card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{member.seller_name}</h4>
                    <Badge variant="outline">{member.conversion_rate.toFixed(1)}% conversión</Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Ingresos</p>
                      <p className="font-semibold text-success">{formatCurrency(member.revenue || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ticket Promedio</p>
                      <p className="font-semibold">{formatCurrency(member.avg_budget || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Leads</p>
                      <p className="font-semibold">{member.leads_count} ({member.won_count} ganados)</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Rendimiento de Integraciones */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              Rendimiento de Integraciones
            </CardTitle>
            <CardDescription>Performance de cada proveedor conectado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extendedMetrics.integrationPerformance.map((integration, index) => (
              <div key={index} className="p-4 rounded-lg bg-gradient-card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{integration.provider}</h4>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Requests</p>
                    <p className="font-semibold">{integration.requests?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tiempo Respuesta</p>
                    <p className="font-semibold">{integration.avgResponseTime || 0}s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ingresos</p>
                    <p className="font-semibold text-success">{formatCurrency(integration.revenue || 0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Leads por Sección - DATOS REALES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Leads por Sección</CardTitle>
              <CardDescription>Distribución en el embudo de ventas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(metrics.leadsBySection).map(([section, count]) => (
                <div key={section} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{section}</span>
                    <Badge variant="outline">{count} leads</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Presupuesto: {formatCurrency(metrics.budgetBySection[section] || 0)}
                  </div>
                  <Progress
                    value={metrics.totalLeads > 0 ? (count / metrics.totalLeads) * 100 : 0}
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Destinos Populares</CardTitle>
              <CardDescription>Los 5 destinos más solicitados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.topDestinations.map((dest, index) => (
                <div key={dest.destination} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">#{index + 1}</Badge>
                      <MapPin className="h-3 w-3 text-primary" />
                      <span className="font-medium">{dest.destination}</span>
                    </div>
                    <Badge variant="outline">{dest.count} leads</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ingresos: {formatCurrency(dest.revenue)}
                  </div>
                  <Progress
                    value={metrics.topDestinations[0] ? (dest.count / metrics.topDestinations[0].count) * 100 : 0}
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Reports;