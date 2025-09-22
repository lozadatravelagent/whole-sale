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

  // Datos adicionales para análisis más profundos
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
    lossAnalysis: [
      { reason: 'Precio muy alto', count: 12, percentage: 40.0 },
      { reason: 'No disponibilidad fechas', count: 8, percentage: 26.7 },
      { reason: 'Decidió otra agencia', count: 5, percentage: 16.7 },
      { reason: 'Canceló el viaje', count: 3, percentage: 10.0 },
      { reason: 'No respondió', count: 2, percentage: 6.7 }
    ],
    seasonalTrends: [
      { month: 'Oct', leads: 89, revenue: 142500, conversion: 24.7 },
      { month: 'Nov', leads: 156, revenue: 289600, conversion: 28.2 },
      { month: 'Dic', leads: 203, revenue: 445800, conversion: 31.5 },
      { month: 'Ene', leads: 167, revenue: 298400, conversion: 29.3 },
      { month: 'Feb', leads: 134, revenue: 234700, conversion: 26.9 },
      { month: 'Mar', leads: 178, revenue: 356200, conversion: 32.1 }
    ],
    teamComparison: [
      {
        name: 'María García',
        leads: 45,
        conversions: 28,
        revenue: 89600,
        avgResponseTime: 2.3,
        satisfaction: 4.9,
        avgDealSize: 3200
      },
      {
        name: 'Carlos López',
        leads: 38,
        conversions: 21,
        revenue: 67400,
        avgResponseTime: 3.1,
        satisfaction: 4.7,
        avgDealSize: 3210
      },
      {
        name: 'Ana Martín',
        leads: 42,
        conversions: 25,
        revenue: 78300,
        avgResponseTime: 2.8,
        satisfaction: 4.8,
        avgDealSize: 3132
      }
    ],
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

    const reportData = {
      generatedAt: new Date().toISOString(),
      dateRange: {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString()
      },
      metrics
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

        {/* Análisis de Tiempo de Respuesta */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Análisis de Tiempo de Respuesta
            </CardTitle>
            <CardDescription>Distribución de tiempos de respuesta al cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extendedMetrics.responseTimeAnalysis.map((range, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{range.range}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={range.target ? "default" : "secondary"}>
                      {range.count} leads
                    </Badge>
                    {range.target && <Target className="h-4 w-4 text-success" />}
                  </div>
                </div>
                <Progress value={range.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {range.percentage}% del total {range.target && '(Dentro del objetivo)'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Satisfacción del Cliente */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-warning" />
              Satisfacción del Cliente
            </CardTitle>
            <CardDescription>Basado en {extendedMetrics.customerSatisfaction.totalResponses} respuestas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">{extendedMetrics.customerSatisfaction.average}</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < Math.floor(extendedMetrics.customerSatisfaction.average) ? 'text-warning fill-warning' : 'text-muted'}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {extendedMetrics.customerSatisfaction.distribution.map((item) => (
                <div key={item.stars} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.stars}</span>
                    <Star className="h-3 w-3 text-warning" />
                  </div>
                  <div className="flex items-center gap-3 flex-1 ml-4">
                    <Progress value={item.percentage} className="h-1 flex-1" />
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Análisis de Pérdidas */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Análisis de Pérdidas
            </CardTitle>
            <CardDescription>Principales razones por las que se pierden leads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extendedMetrics.lossAnalysis.map((reason, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{reason.reason}</span>
                  <Badge variant="outline">{reason.count} casos</Badge>
                </div>
                <Progress value={reason.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground">{reason.percentage}% de las pérdidas</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tendencias Estacionales */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              Tendencias Estacionales
            </CardTitle>
            <CardDescription>Últimos 6 meses - Leads, ingresos y conversión</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extendedMetrics.seasonalTrends.map((month, index) => (
              <div key={index} className="p-3 rounded-lg bg-gradient-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{month.month}</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-success">{formatCurrency(month.revenue)}</div>
                    <div className="text-xs text-muted-foreground">{month.leads} leads</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Conversión: {month.conversion}%</span>
                  <Progress value={month.conversion} className="h-1 w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Comparativa del Equipo */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Comparativa del Equipo
            </CardTitle>
            <CardDescription>Performance detallada de cada vendedor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extendedMetrics.teamComparison.map((member, index) => (
              <div key={index} className="p-4 rounded-lg bg-gradient-card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{member.name}</h4>
                  <Badge variant="outline">{((member.conversions / member.leads) * 100).toFixed(1)}% conversión</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ingresos</p>
                    <p className="font-semibold text-success">{formatCurrency(member.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ticket Promedio</p>
                    <p className="font-semibold">{formatCurrency(member.avgDealSize)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tiempo Respuesta</p>
                    <p className="font-semibold">{member.avgResponseTime}m</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Satisfacción</p>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-warning fill-warning" />
                      <span className="font-semibold">{member.satisfaction}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

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
                  <Badge variant={
                    integration.status === 'excellent' ? 'default' :
                      integration.status === 'good' ? 'secondary' : 'destructive'
                  }>
                    {integration.successRate}% éxito
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Requests</p>
                    <p className="font-semibold">{integration.requests.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tiempo Respuesta</p>
                    <p className="font-semibold">{integration.avgResponseTime}s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ingresos</p>
                    <p className="font-semibold text-success">{formatCurrency(integration.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado</p>
                    <div className="flex items-center gap-1">
                      {integration.status === 'excellent' && <CheckCircle className="h-3 w-3 text-success" />}
                      {integration.status === 'good' && <Clock className="h-3 w-3 text-warning" />}
                      {integration.status === 'needs_attention' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      <span className="font-semibold capitalize">{integration.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reportes existentes mejorados */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Rendimiento por Canal</CardTitle>
              <CardDescription>Conversiones por canal de comunicación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.channelMetrics.map((channel) => (
                <div key={channel.channel} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{channel.channel}</span>
                    <Badge variant="outline">{channel.conversion.toFixed(1)}% conversión</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <MessageSquare className="inline h-3 w-3 mr-1" />
                      {channel.conversations} conversaciones
                    </div>
                    <div>
                      <Users className="inline h-3 w-3 mr-1" />
                      {channel.leads} leads
                    </div>
                  </div>
                  <Progress value={channel.conversion} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Tipos de Viaje</CardTitle>
              <CardDescription>Distribución por tipo de servicio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.tripTypes.map((trip) => {
                const IconComponent = getTripTypeIcon(trip.type);
                return (
                  <div key={trip.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-primary" />
                        <span className="font-medium">{trip.type}</span>
                      </div>
                      <Badge variant="secondary">{trip.count} leads</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {trip.percentage.toFixed(1)}% del total
                    </div>
                    <Progress value={trip.percentage} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

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