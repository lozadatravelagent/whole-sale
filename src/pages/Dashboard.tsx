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
      <div className="h-full overflow-y-auto p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your travel agency performance
            </p>
          </div>
          <Badge variant="outline" className="h-6">
            Today, {new Date().toLocaleDateString()}
          </Badge>
        </div>

        {/* Alertas Importantes */}
        {alerts.length > 0 && (
          <Card className="shadow-card border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-warning" />
                  <CardTitle className="text-lg">Alertas Importantes</CardTitle>
                </div>
                <Badge variant="secondary">{alerts.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert, index) => {
                const IconComponent = alert.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-4 w-4 text-warning" />
                      <span className="text-sm">{alert.message}</span>
                    </div>
                    <Button
                      variant={getAlertVariant(alert.type)}
                      size="sm"
                      onClick={() => handleAlertAction(alert.action)}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Objetivos del Mes
              </CardTitle>
              <CardDescription>Progreso hacia las metas establecidas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Ingresos Mensuales</span>
                  <span className="text-sm text-muted-foreground">
                    ${metrics.monthly_revenue.toLocaleString()} / ${metrics.monthly_goal.toLocaleString()}
                  </span>
                </div>
                <Progress value={(metrics.monthly_revenue / metrics.monthly_goal) * 100} className="h-3" />
                <p className="text-xs text-muted-foreground mt-1">
                  {((metrics.monthly_revenue / metrics.monthly_goal) * 100).toFixed(1)}% completado
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Tasa de Conversión</span>
                  <span className="text-sm text-muted-foreground">{metrics.conversion_rate}% / 70%</span>
                </div>
                <Progress value={metrics.conversion_rate} className="h-3" />
                <p className="text-xs text-muted-foreground mt-1">Objetivo: 70%</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Tiempo de Respuesta</span>
                  <span className="text-sm text-muted-foreground">{metrics.response_time} min / 5 min</span>
                </div>
                <Progress value={(5 - metrics.response_time) * 20} className="h-3" />
                <p className="text-xs text-success mt-1">
                  <CheckCircle className="inline h-3 w-3 mr-1" />
                  Bajo el objetivo
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent" />
                Integraciones
              </CardTitle>
              <CardDescription>Estado de conexiones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{metrics.active_integrations}</div>
                <p className="text-sm text-muted-foreground">de {metrics.total_integrations} activas</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-success" />
                    <span className="text-sm">Eurovips</span>
                  </div>
                  <Badge variant="outline" className="text-success">Activo</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-success" />
                    <span className="text-sm">Starlings</span>
                  </div>
                  <Badge variant="outline" className="text-success">Activo</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-destructive" />
                    <span className="text-sm">Delfos</span>
                  </div>
                  <Badge variant="destructive">Error</Badge>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full">
                Ver Todas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Métricas Clave Mejoradas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversaciones Hoy</CardTitle>
              <MessageSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversations_today}</div>
              <p className="text-xs text-success flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12% desde ayer
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.quotes_generated}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.pdfs_created} PDFs enviados
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfacción</CardTitle>
              <Star className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.satisfaction}</div>
              <p className="text-xs text-success flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                Rating promedio
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Respuesta</CardTitle>
              <Timer className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.response_time}m</div>
              <p className="text-xs text-success flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Bajo objetivo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance del Equipo */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Performance del Equipo
                </CardTitle>
                <CardDescription>Rendimiento de vendedores este mes</CardDescription>
              </div>
              <Button variant="outline" size="sm">Ver Todos</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamPerformance.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gradient-card">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(member.status)}`} />
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{member.leads} leads</span>
                        <span>{member.conversions} conversiones</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-warning" />
                          {member.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success">${member.revenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {((member.conversions / member.leads) * 100).toFixed(1)}% conversión
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Próximos Vencimientos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Próximos Vencimientos
              </CardTitle>
              <CardDescription>Acciones importantes pendientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingDeadlines.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.days <= 2 ? 'bg-destructive/10' : item.days <= 5 ? 'bg-warning/10' : 'bg-success/10'
                      }`}>
                      <Calendar className={`h-4 w-4 ${item.days <= 2 ? 'text-destructive' : item.days <= 5 ? 'text-warning' : 'text-success'
                        }`} />
                    </div>
                    <div>
                      <p className="font-medium">{item.client}</p>
                      <p className="text-xs text-muted-foreground">{item.destination}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={item.days <= 2 ? 'destructive' : item.days <= 5 ? 'secondary' : 'outline'}>
                      {item.days} días
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{item.type}</p>
                  </div>
                </div>
              ))}

              {metrics.pending_followups > 0 && (
                <div className="pt-2 border-t">
                  <Button variant="outline" size="sm" className="w-full">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Ver {metrics.pending_followups} seguimientos pendientes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Actividad Reciente
              </CardTitle>
              <CardDescription>Últimas interacciones importantes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                        <IconComponent className={`h-4 w-4 ${activity.color}`} />
                      </div>
                      <div>
                        <p className="font-medium">{activity.customer}</p>
                        <p className="text-xs text-muted-foreground">{activity.action}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${activity.color}`}>{activity.amount}</p>
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