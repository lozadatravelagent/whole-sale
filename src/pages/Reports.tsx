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
  Loader2
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
      <div className="p-8 space-y-8">
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

        {/* Rendimiento por Canal - DATOS REALES */}
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