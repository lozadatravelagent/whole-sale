import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MessageSquare } from 'lucide-react';

interface ChannelsChartProps {
  data: Array<{
    channel: string;
    conversations: number;
    leads: number;
    conversion: number;
  }>;
}

const COLORS = {
  'WhatsApp': '#25D366',
  'Web': '#3b82f6',
  'Facebook': '#1877f2',
  'Instagram': '#E4405F'
};

export function ChannelsChart({ data }: ChannelsChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Rendimiento por Canal
          </CardTitle>
          <CardDescription>No hay datos de canales disponibles</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const maxConversations = Math.max(...data.map(d => d.conversations));
  const maxLeads = Math.max(...data.map(d => d.leads));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Rendimiento por Canal
        </CardTitle>
        <CardDescription>
          Comparativa de conversaciones, leads y conversión por canal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((channel, index) => (
          <div key={index} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[channel.channel as keyof typeof COLORS] || '#6b7280' }}
                />
                <span className="font-medium">{channel.channel}</span>
              </div>
              <Badge variant="outline">{channel.conversion.toFixed(1)}% conversión</Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Conversaciones</span>
                <span className="font-semibold">{channel.conversations}</span>
              </div>
              <Progress
                value={(channel.conversations / maxConversations) * 100}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Leads generados</span>
                <span className="font-semibold">{channel.leads}</span>
              </div>
              <Progress
                value={(channel.leads / maxLeads) * 100}
                className="h-2"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
