import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LeadTrip {
  trip_id: string;
  title: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  destination_cities: string[] | null;
  estimated_price: number;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  ready: 'Listo',
  quoted: 'Cotizado',
  confirmed: 'Confirmado',
};

interface LeadTripsListProps {
  leadId: string;
  onOpenTrip?: (tripId: string) => void;
}

export default function LeadTripsList({ leadId, onOpenTrip }: LeadTripsListProps) {
  const { data: trips, isLoading } = useQuery<LeadTrip[]>({
    queryKey: ['lead-trips', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_trips')
        .select('*')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false });
      return (data as LeadTrip[]) ?? [];
    },
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map(i => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!trips?.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sin itinerarios cotizados aún
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {trips.map(trip => (
        <div
          key={trip.trip_id}
          className="flex items-start justify-between p-3 rounded-lg border bg-card"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{trip.title ?? 'Sin título'}</p>
            {trip.destination_cities && trip.destination_cities.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {trip.destination_cities.join(' → ')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {trip.start_date && trip.end_date
                ? `${trip.start_date} → ${trip.end_date}`
                : 'Fechas sin definir'}
            </p>
            {trip.estimated_price > 0 && (
              <p className="text-xs font-medium text-green-600 mt-1">
                ~${trip.estimated_price.toLocaleString()} estimado
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
            <Badge variant={trip.status === 'quoted' || trip.status === 'confirmed' ? 'default' : 'secondary'} className="text-[10px]">
              {STATUS_LABELS[trip.status] ?? trip.status}
            </Badge>
            {onOpenTrip && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenTrip(trip.trip_id)}>
                Abrir
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
