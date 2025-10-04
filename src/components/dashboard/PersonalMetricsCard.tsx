import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, DollarSign, Target, TrendingUp } from "lucide-react";
import type { SellerPersonalMetrics } from "@/types";

interface PersonalMetricsCardProps {
  metrics: SellerPersonalMetrics;
}

export function PersonalMetricsCard({ metrics }: PersonalMetricsCardProps) {
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.my_leads}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.my_won} ganados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mi Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.my_revenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio: ${metrics.my_won > 0 ? Math.round(metrics.my_revenue / metrics.my_won).toLocaleString() : 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.my_conversion_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.my_won} / {metrics.my_leads} leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Mensual</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.monthly_progress?.toFixed(0) || 0}%
            </div>
            <Progress value={metrics.monthly_progress || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Próximos vencimientos */}
      {metrics.upcoming_deadlines && metrics.upcoming_deadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos Vencimientos</CardTitle>
            <CardDescription>Leads que requieren atención</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.upcoming_deadlines.map((deadline) => (
                <div
                  key={deadline.lead_id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{deadline.contact_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {deadline.destination}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {new Date(deadline.due_date).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mis leads por sección */}
      <Card>
        <CardHeader>
          <CardTitle>Mis Leads por Sección</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(metrics.my_leads_by_section).map(([section, count]) => (
              <div key={section} className="flex items-center justify-between">
                <span className="text-sm">{section}</span>
                <Badge>{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
