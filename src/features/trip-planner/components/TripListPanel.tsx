import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTripList } from '../hooks/useTripList';
import type { TripRow } from '../services/tripService';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  ready: 'Listo',
  quoted: 'Cotizado',
  confirmed: 'Confirmado',
  archived: 'Archivado',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  ready: 'outline',
  quoted: 'default',
  confirmed: 'default',
  archived: 'secondary',
};

interface TripListPanelProps {
  onOpenTrip: (tripId: string, conversationId: string | null) => void;
  onDuplicate?: (tripId: string) => void;
  onClose: () => void;
}

export default function TripListPanel({ onOpenTrip, onDuplicate, onClose }: TripListPanelProps) {
  const { data: trips, isLoading } = useTripList();
  const [filter, setFilter] = useState('all');

  const filtered = (trips ?? []).filter(t => filter === 'all' || t.status === filter);
  const filters = ['all', 'draft', 'ready', 'quoted', 'confirmed'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-sm">Itinerarios de la agencia</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-1 p-3 border-b overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {filters.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors shrink-0 ${
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted'
            }`}
          >
            {s === 'all' ? 'Todos' : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-2xl">🗺️</span>
            <p className="text-sm text-muted-foreground">
              No hay itinerarios{filter !== 'all' ? ` con estado "${STATUS_LABELS[filter]}"` : ''}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {filtered.map(trip => (
              <TripListItem
                key={trip.id}
                trip={trip}
                onOpen={() => onOpenTrip(trip.id, null)}
                onDuplicate={onDuplicate ? () => onDuplicate(trip.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TripListItem({
  trip,
  onOpen,
  onDuplicate,
}: {
  trip: TripRow;
  onOpen: () => void;
  onDuplicate?: () => void;
}) {
  const cities = trip.destination_cities ?? [];

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{trip.title ?? 'Sin título'}</p>
        {cities.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {cities.slice(0, 3).map(city => (
              <span key={city} className="text-xs bg-muted px-2 py-0.5 rounded-full">{city}</span>
            ))}
            {cities.length > 3 && (
              <span className="text-xs text-muted-foreground">+{cities.length - 3}</span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {trip.start_date && trip.end_date
            ? `${trip.start_date} → ${trip.end_date}`
            : 'Fechas sin definir'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 ml-2 shrink-0">
        <Badge variant={STATUS_VARIANTS[trip.status] ?? 'secondary'} className="text-[10px]">
          {STATUS_LABELS[trip.status] ?? trip.status}
        </Badge>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpen}>
            Abrir
          </Button>
          {onDuplicate && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDuplicate}>
              Copiar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
