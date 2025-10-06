import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plane, Hotel, Package } from 'lucide-react';

interface TripTypesChartProps {
  data: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

const COLORS = {
  'Flight': '#3b82f6',
  'Hotel': '#10b981',
  'Package': '#f59e0b',
  'Vuelo': '#3b82f6',
  'Paquete': '#f59e0b'
};

const ICONS = {
  'Flight': Plane,
  'Hotel': Hotel,
  'Package': Package,
  'Vuelo': Plane,
  'Paquete': Package
};

export function TripTypesChart({ data }: TripTypesChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Distribución por Tipo de Viaje
          </CardTitle>
          <CardDescription>No hay datos de viajes disponibles</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getColor = (type: string): string => {
    return COLORS[type as keyof typeof COLORS] || '#6b7280';
  };

  const getIcon = (type: string) => {
    const Icon = ICONS[type as keyof typeof ICONS] || Package;
    return Icon;
  };

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Distribución por Tipo de Viaje
        </CardTitle>
        <CardDescription>
          Porcentaje de leads por tipo de servicio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((item, index) => {
          const Icon = getIcon(item.type);
          return (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${getColor(item.type)}20` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: getColor(item.type) }} />
                  </div>
                  <div>
                    <p className="font-medium">{item.type}</p>
                    <p className="text-sm text-muted-foreground">{item.count} leads</p>
                  </div>
                </div>
                <Badge variant="outline" style={{ borderColor: getColor(item.type), color: getColor(item.type) }}>
                  {item.percentage.toFixed(1)}%
                </Badge>
              </div>
              <Progress
                value={(item.count / maxCount) * 100}
                className="h-2"
                style={{
                  ['--progress-background' as any]: getColor(item.type)
                }}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
