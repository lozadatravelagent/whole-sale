import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useReports } from '@/hooks/useReports';
import { useActivities } from '@/hooks/useActivities';
import { TeamPerformanceCard } from '@/components/dashboard/TeamPerformanceCard';
import { PersonalMetricsCard } from '@/components/dashboard/PersonalMetricsCard';
import { SellerUrgentLeadsCard } from '@/components/dashboard/SellerUrgentLeadsCard';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
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
  const { user, isOwner, isSuperAdmin, isAdmin, isSeller, loading: authLoading } = useAuth();
  const { metrics, loading: metricsLoading } = useReports();
  const { activities, loading: activitiesLoading } = useActivities(4);

  // Map real metrics from useReports to Dashboard display format
  const displayMetrics = React.useMemo(() => metrics ? {
    conversations_today: metrics.totalConversations || 0,
    quotes_generated: Math.floor((metrics.totalLeads || 0) * 0.5), // Estimate: 50% of leads get quotes
    pdfs_created: Math.floor((metrics.totalLeads || 0) * 0.3), // Estimate: 30% get PDFs
    leads_won: metrics.leadsWon || 0,
    leads_lost: metrics.leadsLost || 0,
    conversion_rate: Math.round(metrics.conversionRate || 0),
    response_time: 4.2, // Estimado temporal
    satisfaction: 4.8, // Estimado temporal
    monthly_revenue: Math.round(metrics.totalRevenue || 0),
    monthly_goal: 200000, // Referencia por defecto
    active_integrations: 6, // Referencia por defecto
    total_integrations: 8, // Referencia por defecto
    pending_followups: metrics.pendingFollowups || 0,
    urgent_leads: metrics.urgentLeads || 0
  } : {
    // Fallback mock metrics when no real data
    conversations_today: 0,
    quotes_generated: 0,
    pdfs_created: 0,
    leads_won: 0,
    leads_lost: 0,
    conversion_rate: 0,
    response_time: 0,
    satisfaction: 0,
    monthly_revenue: 0,
    monthly_goal: 200000,
    active_integrations: 0,
    total_integrations: 0,
    pending_followups: 0,
    urgent_leads: 0
  }, [metrics]);

  // Real team performance from useReports (for ADMIN)
  const teamPerformance = metrics?.teamPerformance || [];

  // Real upcoming deadlines from useReports (for SELLER)
  const upcomingDeadlines = React.useMemo(() => {
    if (!metrics?.personalMetrics?.upcoming_deadlines) return [];

    return metrics.personalMetrics.upcoming_deadlines.map(deadline => {
      const dueDate = new Date(deadline.due_date);
      const today = new Date();
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        client: deadline.contact_name,
        destination: deadline.destination,
        days: diffDays,
        type: 'followup',
        amount: 0 // We don't have budget in deadline info
      };
    });
  }, [metrics?.personalMetrics?.upcoming_deadlines]);

  // Generate real alerts based on actual data
  const alerts = React.useMemo(() => {
    const alertList = [];

    // Urgent: Check for pending followups
    if (displayMetrics.pending_followups > 0) {
      alertList.push({
        type: 'urgent',
        message: `${displayMetrics.pending_followups} leads pendientes de seguimiento`,
        action: 'Ver leads',
        icon: AlertTriangle
      });
    }

    // Info: Show today's tasks for sellers
    if (isSeller && upcomingDeadlines.length > 0) {
      alertList.push({
        type: 'info',
        message: `${upcomingDeadlines.length} seguimientos programados próximamente`,
        action: 'Ver agenda',
        icon: Clock
      });
    }

    // Default alert if no real data
    if (alertList.length === 0) {
      alertList.push({
        type: 'info',
        message: 'Todo al día. ¡Buen trabajo!',
        action: 'Ver CRM',
        icon: CheckCircle
      });
    }

    return alertList;
  }, [displayMetrics.pending_followups, isSeller, upcomingDeadlines.length]);

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
      case 'Ver CRM':
        navigate('/crm');
        break;
      case 'Ver agenda':
        navigate('/crm');
        break;
      case 'Revisar':
        navigate('/marketplace');
        break;
      default:
        navigate('/dashboard');
    }
  };

  // Títulos y descripciones contextuales por rol
  const getDashboardTitle = () => {
    if (isOwner) return 'Dashboard Global (OWNER)';
    if (isSuperAdmin) return 'Dashboard del Mayorista';
    if (isAdmin) return 'Dashboard de la Agencia';
    if (isSeller) return 'Mi Dashboard Personal';
    return 'Dashboard';
  };

  const getDashboardDescription = () => {
    if (isOwner) return 'Vista completa de todos los tenants y agencias del sistema';
    if (isSuperAdmin) return 'Gestión y supervisión de todas tus agencias';
    if (isAdmin) return 'Supervisión del equipo de vendedores y métricas de agencia';
    if (isSeller) return 'Tus leads asignados y métricas personales de rendimiento';
    return 'Resumen del rendimiento comercial de tu agencia';
  };

  // Show loading state
  if (authLoading || metricsLoading) {
    return <DashboardSkeleton />;
  }

  // No user logged in
  if (!user) {
    return (
      <MainLayout>
        <div className="flex h-96 items-center justify-center">
          <p className="text-muted-foreground">Por favor, inicia sesión para ver el dashboard</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userRole="ADMIN">
      <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{getDashboardTitle()}</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              {getDashboardDescription()}
            </p>
          </div>
          <Badge variant="outline" className="h-6 text-xs md:text-sm w-fit">
            Hoy, {new Date().toLocaleDateString()}
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
        <Card className="shadow-card">
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
                <span className="text-lg md:text-xl font-bold text-success">
                  ${displayMetrics.monthly_revenue.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                De {displayMetrics.leads_won} leads ganados este mes
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="font-medium text-sm md:text-base">Tasa de Conversión</span>
                <span className="text-lg md:text-xl font-bold text-primary">
                  {displayMetrics.conversion_rate}%
                </span>
              </div>
              <Progress value={displayMetrics.conversion_rate} className="h-2 md:h-3" />
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {displayMetrics.leads_won} ganados de {displayMetrics.leads_won + displayMetrics.leads_lost} leads cerrados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Métricas Clave Mejoradas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">Conversaciones Hoy</CardTitle>
              <MessageSquare className="h-3.5 md:h-4 w-3.5 md:w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold">{displayMetrics.conversations_today}</div>
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
              <div className="text-xl md:text-2xl font-bold">{displayMetrics.quotes_generated}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {displayMetrics.pdfs_created} PDFs enviados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ✅ DASHBOARDS PERSONALIZADOS POR ROL */}
        {isSeller && metrics?.personalMetrics && (
          <>
            <SellerUrgentLeadsCard urgentLeads={metrics.personalMetrics.upcoming_deadlines || []} />
            <PersonalMetricsCard metrics={metrics.personalMetrics} />
          </>
        )}

        {isAdmin && metrics?.teamPerformance && (
          <TeamPerformanceCard teamPerformance={metrics.teamPerformance} />
        )}

        {(isSuperAdmin || isOwner) && metrics?.agenciesPerformance && (
          <Card className="shadow-card">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Building className="h-4 md:h-5 w-4 md:w-5 text-primary" />
                {isOwner ? 'Performance por Agencia (Todas)' : 'Performance de Agencias'}
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {isOwner ? 'Comparativa cross-tenant' : 'Agencias de tu mayorista'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
                {metrics.agenciesPerformance.slice(0, 5).map((agency) => (
                  <div key={agency.agency_id} className="p-4 rounded-lg bg-gradient-card border border-border">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">{agency.agency_name}</h4>
                        {agency.tenant_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">{agency.tenant_name}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {agency.conversion_rate.toFixed(1)}% conversión
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Ingresos</p>
                        <p className="font-bold text-success">${agency.revenue.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Leads</p>
                        <p className="font-semibold">{agency.leads_count}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Conversaciones</p>
                        <p className="font-semibold">{agency.active_conversations}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Vendedores</p>
                        <p className="font-semibold">{agency.sellers_count || 0}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance del Equipo (MOCK - Solo para demo) */}
        {!isSeller && !isAdmin && !isSuperAdmin && !isOwner && (
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
                        <div className={`absolute -bottom-1 -right-1 w-2.5 md:w-3 h-2.5 md:h-3 rounded-full border-2 border-background bg-success`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base truncate">{member.seller_name}</p>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-muted-foreground">
                          <span>{member.leads_count} leads</span>
                          <span>{member.won_count} ganados</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-2.5 md:h-3 w-2.5 md:w-3 text-warning" />
                            {member.conversion_rate.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-success text-sm md:text-base">${member.revenue.toLocaleString()}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">
                        {member.conversion_rate.toFixed(1)}% conversión
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

              {displayMetrics.pending_followups > 0 && (
                <div className="pt-2 border-t">
                  <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
                    <Briefcase className="h-3.5 md:h-4 w-3.5 md:w-4 mr-2" />
                    Ver {displayMetrics.pending_followups} seguimientos pendientes
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
              {activitiesLoading ? (
                <div className="text-center text-muted-foreground text-sm">Cargando actividades...</div>
              ) : activities.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm">No hay actividades recientes</div>
              ) : (
                activities.map((activity, index) => {
                  // Map activity type to icon and color
                  const getActivityIcon = (type: string) => {
                    switch (type) {
                      case 'lead_won': return { icon: CheckCircle, color: 'text-success' };
                      case 'lead_lost': return { icon: XCircle, color: 'text-destructive' };
                      case 'lead_created': return { icon: Users, color: 'text-primary' };
                      case 'quote_sent': return { icon: FileText, color: 'text-accent' };
                      case 'message_sent': return { icon: MessageSquare, color: 'text-blue-500' };
                      case 'status_changed': return { icon: Activity, color: 'text-orange-500' };
                      default: return { icon: Activity, color: 'text-muted-foreground' };
                    }
                  };

                  const { icon: IconComponent, color } = getActivityIcon(activity.activity_type);

                  // Format time ago
                  const timeAgo = (dateStr: string) => {
                    const date = new Date(dateStr);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) return 'Justo ahora';
                    if (diffMins < 60) return `${diffMins} min`;
                    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''}`;
                    return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
                  };

                  return (
                    <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 md:p-3 rounded-lg bg-gradient-card">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                          <IconComponent className={`h-3.5 md:h-4 w-3.5 md:w-4 ${color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">{activity.description}</p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            {activity.metadata?.destination ? `Destino: ${activity.metadata.destination}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        {activity.metadata?.budget && (
                          <p className={`font-semibold text-sm md:text-base ${color}`}>
                            ${activity.metadata.budget.toLocaleString()}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{timeAgo(activity.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
