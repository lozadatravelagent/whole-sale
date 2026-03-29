import { MapPin } from 'lucide-react';
import { HAS_MAP, MAPBOX_TOKEN } from '@/features/trip-planner/map';
import type { DiscoveryContext } from '../services/discoveryService';

interface DiscoveryMapPreviewProps {
  discoveryContext: DiscoveryContext;
}

function buildStaticMapUrl(discoveryContext: DiscoveryContext): string | null {
  if (!HAS_MAP || !MAPBOX_TOKEN) return null;

  const markers = discoveryContext.places
    .filter((place) => typeof place.lat === 'number' && typeof place.lng === 'number')
    .slice(0, 5)
    .map((place, index) => `pin-s-${index + 1}+d97706(${place.lng},${place.lat})`)
    .join(',');

  const center = `${discoveryContext.destination.lng},${discoveryContext.destination.lat},11.5,0`;
  const overlay = markers ? `${markers}/` : '';
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}${center}/900x260?access_token=${MAPBOX_TOKEN}`;
}

export default function DiscoveryMapPreview({ discoveryContext }: DiscoveryMapPreviewProps) {
  const mapUrl = buildStaticMapUrl(discoveryContext);
  const placeCount = discoveryContext.places.length;

  return (
    <div className="mx-4 rounded-xl border border-border/60 bg-card overflow-hidden animate-in fade-in duration-300">
      {mapUrl ? (
        <img
          src={mapUrl}
          alt={`Mapa de ${discoveryContext.destination.city}`}
          className="h-40 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-28 w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
          Vista de mapa no disponible
        </div>
      )}
      <div className="p-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Explorando {discoveryContext.destination.city}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {placeCount} lugar{placeCount !== 1 ? 'es' : ''} curado{placeCount !== 1 ? 's' : ''} para esta búsqueda
          </p>
        </div>
        <span className="text-[11px] rounded-full bg-muted px-2 py-1 text-muted-foreground">
          {discoveryContext.queryType === 'broad' ? 'Discovery' : titleCase(discoveryContext.queryType)}
        </span>
      </div>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
