import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Activity,
  Bell,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Globe,
  Star,
  Award,
  Timer,
  Briefcase,
  MapPin,
  Plane,
  Building
} from 'lucide-react';

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('today');
  const navigate = useNavigate();

  const metrics = {
    conversations_today: 23,
    quotes_generated: 12,
    pdfs_created: 8,
    leads_won: 3,
    leads_lost: 2,
    conversion_rate: 60,
    response_time: 4.2, // minutos promedio
    satisfaction: 4.8, // rating promedio
    monthly_revenue: 156000,
    monthly_goal: 200000,
    active_integrations: 6,
    total_integrations: 8,
    pending_followups: 12,
    urgent_leads: 3
  };

  const teamPerformance = [
    { name: 'María García', leads: 18, conversions: 12, revenue: 45600, rating: 4.9, status: 'online' },
    { name: 'Carlos López', leads: 15, conversions: 8, revenue: 38200, rating: 4.7, status: 'online' },
    { name: 'Ana Martín', leads: 12, conversions: 9, revenue: 42800, rating: 4.8, status: 'away' },
    { name: 'Luis Rodriguez', leads: 10, conversions: 6, revenue: 29400, rating: 4.6, status: 'offline' }
  ];

  const upcomingDeadlines = [
    { client: 'Familia Pérez', destination: 'Europa', days: 2, type: 'payment', amount: 8500 },
    { client: 'Empresa TechCorp', destination: 'Miami', days: 5, type: 'confirmation', amount: 12300 },
    { client: 'Grupo Aventura', destination: 'Cancún', days: 7, type: 'documents', amount: 15600 }
  ];

  const alerts = [
    { type: 'urgent', message: '3 leads sin respuesta por más de 4 horas', action: 'Ver leads', icon: AlertTriangle },
    { type: 'warning', message: 'Integración Eurovips con errores', action: 'Revisar', icon: Zap },
    { type: 'info', message: '12 seguimientos programados para hoy', action: 'Ver agenda', icon: Clock }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-success';
      case 'away': return 'bg-warning';
      case 'offline': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'urgent': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      default: return 'outline';
    }
  };

  const handleAlertAction = (action: string) => {
    switch (action) {
      case 'Ver leads':
        navigate('/crm');
        break;
      case 'Ver agenda':
        // TODO: Implementar navegación a agenda
        console.log('Navegando a agenda...');
        break;
      case 'Revisar':
        // TODO: Implementar revisión de integraciones
        console.log('Revisando integraciones...');
        break;
      default:
        console.log(`Acción no implementada: ${action}`);
    }
  };

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Overview of your travel agency performance
            </p>
          </div>
          <Badge variant="outline" className="h-6 text-xs md:text-sm w-fit">
            Today, {new Date().toLocaleDateString()}
          </Badge>
        </div>

        {/* Alertas Importantes */}
        {alerts.length > 0 && (
          <Card className="shadow-card border-l-4 border-l-warning">
            <CardHeader className="pb-2 md:pb-3 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 md:h-5 w-4 md:w-5 text-warning" />
                  <CardTitle className="text-base md:text-lg">Alertas Importantes</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">{alerts.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 md:space-y-3 p-4 md:p-6">
              {alerts.map((alert, index) => {
                const IconComponent = alert.icon;
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 md:p-3 rounded-lg bg-gradient-card">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <IconComponent className="h-3.5 md:h-4 w-3.5 md:w-4 text-warning flex-shrink-0" />
                      <span className="text-xs md:text-sm">{alert.message}</span>
                    </div>
                    <Button
                      variant={getAlertVariant(alert.type)}
                      size="sm"
                      onClick={() => handleAlertAction(alert.action)}
                      className="text-xs w-full sm:w-auto"
                    >
                      {alert.action}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Objetivos y Rendimiento General */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Target className="h-4 md:h-5 w-4 md:w-5 text-primary" />
                Objetivos del Mes
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Progreso hacia las metas establecidas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-medium text-sm md:text-base">Ingresos Mensuales</span>
                  <span className="text-xs md:text-sm text-muted-foreground">
                    ${metrics.monthly_revenue.toLocaleString()} / ${metrics.monthly_goal.toLocaleString()}
                  </span>
                </div>
                <Progress value={(metrics.monthly_revenue / metrics.monthly_goal) * 100} className="h-2 md:h-3" />
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  {((metrics.monthly_revenue / metrics.monthly_goal) * 100).toFixed(1)}% completado
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-medium text-sm md:text-base">Tasa de Conversión</span>
                  <span className="text-xs md:text-sm text-muted-foreground">{metrics.conversion_rate}% / 70%</span>
                </div>
                <Progress value={metrics.conversion_rate} className="h-2 md:h-3" />
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Objetivo: 70%</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-medium text-sm md:text-base">Tiempo de Respuesta</span>
                  <span className="text-xs md:text-sm text-muted-foreground">{metrics.response_time} min / 5 min</span>
                </div>
                <Progress value={(5 - metrics.response_time) * 20} className="h-2 md:h-3" />
                <p className="text-[10px] md:text-xs text-success mt-1">
                  <CheckCircle className="inline h-2.5 md:h-3 w-2.5 md:w-3 mr-1" />
                  Bajo el objetivo
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Zap className="h-4 md:h-5 w-4 md:w-5 text-accent" />
                Integraciones
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Estado de conexiones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-success">{metrics.active_integrations}</div>
                <p className="text-xs md:text-sm text-muted-foreground">de {metrics.total_integrations} activas</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 md:h-4 w-3.5 md:w-4 text-success" />
                    <span className="text-xs md:text-sm">Eurovips</span>
                  </div>
                  <Badge variant="outline" className="text-success text-xs">Activo</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plane className="h-3.5 md:h-4 w-3.5 md:w-4 text-success" />
                    <span className="text-xs md:text-sm">Starlings</span>
                  </div>
                  <Badge variant="outline" className="text-success text-xs">Activo</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 md:h-4 w-3.5 md:w-4 text-destructive" />
                    <span className="text-xs md:text-sm">Delfos</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">Error</Badge>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
                Ver Todas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Métricas Clave Mejoradas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">Conversaciones Hoy</CardTitle>
              <MessageSquare className="h-3.5 md:h-4 w-3.5 md:w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold">{metrics.conversations_today}</div>
              <p className="text-[10px] md:text-xs text-success flex items-center mt-1">
                <TrendingUp className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1" />
                +12% desde ayer
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">Cotizaciones</CardTitle>
              <FileText className="h-3.5 md:h-4 w-3.5 md:w-4 text-accent" />
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold">{metrics.quotes_generated}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {metrics.pdfs_created} PDFs enviados
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">Satisfacción</CardTitle>
              <Star className="h-3.5 md:h-4 w-3.5 md:w-4 text-warning" />
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold">{metrics.satisfaction}</div>
              <p className="text-[10px] md:text-xs text-success flex items-center mt-1">
                <TrendingUp className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1" />
                Rating promedio
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">Tiempo Respuesta</CardTitle>
              <Timer className="h-3.5 md:h-4 w-3.5 md:w-4 text-success" />
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold">{metrics.response_time}m</div>
              <p className="text-[10px] md:text-xs text-success flex items-center mt-1">
                <CheckCircle className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1" />
                Bajo objetivo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance del Equipo */}
        <Card className="shadow-card">
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Award className="h-4 md:h-5 w-4 md:w-5 text-primary" />
                  Performance del Equipo
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Rendimiento de vendedores este mes</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="text-xs md:text-sm w-full sm:w-auto">Ver Todos</Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="space-y-3 md:space-y-4">
              {teamPerformance.map((member, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 rounded-lg bg-gradient-card">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 md:h-5 w-4 md:w-5 text-primary" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-2.5 md:w-3 h-2.5 md:h-3 rounded-full border-2 border-background ${getStatusColor(member.status)}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm md:text-base truncate">{member.name}</p>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-muted-foreground">
                        <span>{member.leads} leads</span>
                        <span>{member.conversions} conversiones</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-2.5 md:h-3 w-2.5 md:w-3 text-warning" />
                          {member.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-bold text-success text-sm md:text-base">${member.revenue.toLocaleString()}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {((member.conversions / member.leads) * 100).toFixed(1)}% conversión
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Próximos Vencimientos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card className="shadow-card">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Clock className="h-4 md:h-5 w-4 md:w-5 text-warning" />
                Próximos Vencimientos
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Acciones importantes pendientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
              {upcomingDeadlines.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2 md:p-3 rounded-lg bg-gradient-card">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.days <= 2 ? 'bg-destructive/10' : item.days <= 5 ? 'bg-warning/10' : 'bg-success/10'
                      }`}>
                      <Calendar className={`h-3.5 md:h-4 w-3.5 md:w-4 ${item.days <= 2 ? 'text-destructive' : item.days <= 5 ? 'text-warning' : 'text-success'
                        }`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm md:text-base truncate">{item.client}</p>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{item.destination}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end gap-2">
                    <Badge variant={item.days <= 2 ? 'destructive' : item.days <= 5 ? 'secondary' : 'outline'} className="text-xs">
                      {item.days} días
                    </Badge>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                </div>
              ))}

              {metrics.pending_followups > 0 && (
                <div className="pt-2 border-t">
                  <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
                    <Briefcase className="h-3.5 md:h-4 w-3.5 md:w-4 mr-2" />
                    Ver {metrics.pending_followups} seguimientos pendientes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Activity className="h-4 md:h-5 w-4 md:w-5 text-primary" />
                Actividad Reciente
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Últimas interacciones importantes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
              {[
                {
                  type: 'lead_won',
                  customer: 'María González',
                  action: 'Confirmó viaje a París',
                  amount: '$8,500',
                  time: '2 min ago',
                  icon: CheckCircle,
                  color: 'text-success'
                },
                {
                  type: 'quote_sent',
                  customer: 'Carlos Ruiz',
                  action: 'Cotización enviada - Cancún',
                  amount: '$3,200',
                  time: '15 min ago',
                  icon: FileText,
                  color: 'text-accent'
                },
                {
                  type: 'lead_lost',
                  customer: 'Ana López',
                  action: 'Declinó propuesta - Europa',
                  amount: '$12,400',
                  time: '1 hour ago',
                  icon: XCircle,
                  color: 'text-destructive'
                },
                {
                  type: 'new_lead',
                  customer: 'Roberto Silva',
                  action: 'Nueva consulta - Miami',
                  amount: 'Pendiente',
                  time: '2 hours ago',
                  icon: Users,
                  color: 'text-primary'
                },
              ].map((activity, index) => {
                const IconComponent = activity.icon;
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 md:p-3 rounded-lg bg-gradient-card">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                        <IconComponent className={`h-3.5 md:h-4 w-3.5 md:w-4 ${activity.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm md:text-base truncate">{activity.customer}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{activity.action}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={`font-semibold text-sm md:text-base ${activity.color}`}>{activity.amount}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;