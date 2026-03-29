import { Compass, History, Lightbulb, Send, Sparkles } from 'lucide-react';
import { useTripList } from '../hooks/useTripList';
import type { TripRow } from '../services/tripService';

// ---------------------------------------------------------------------------
// Quick-start prompts — each click sends the prompt to the chat
// ---------------------------------------------------------------------------

const QUICK_START_OPTIONS = [
  {
    id: 'europa-clasica',
    label: 'Europa clásica 10 días',
    prompt: 'Quiero armar un viaje de 10 días por Europa clásica: París, Roma y Barcelona. 2 adultos, presupuesto medio.',
    icon: '🏛️',
  },
  {
    id: 'caribe-familia',
    label: 'Caribe en familia',
    prompt: 'Armame un viaje al Caribe para una familia con 2 adultos y 2 chicos, 7 días, todo incluido si es posible.',
    icon: '🏖️',
  },
  {
    id: 'japon-corea',
    label: 'Japón + Corea',
    prompt: 'Quiero 14 días por Japón y Corea del Sur: Tokio, Kioto, Osaka y Seúl. 2 adultos, presupuesto alto.',
    icon: '⛩️',
  },
  {
    id: 'luna-miel-italia',
    label: 'Luna de miel en Italia',
    prompt: 'Luna de miel en Italia: Roma, Costa Amalfitana y Venecia. 10 días, hoteles de lujo, 2 adultos.',
    icon: '💍',
  },
  {
    id: 'economico-julio',
    label: 'Viaje económico en julio',
    prompt: 'Necesito un viaje económico en julio para 2 adultos, 7 días, destino flexible en Europa. Presupuesto bajo.',
    icon: '💰',
  },
  {
    id: 'vuelo-hotel-madrid',
    label: 'Solo vuelo + hotel a Madrid',
    prompt: 'Solo necesito vuelo y hotel a Madrid para 2 adultos, 5 noches, presupuesto medio.',
    icon: '✈️',
  },
] as const;

const COMMERCIAL_SUGGESTIONS = [
  { label: 'Comparar Punta Cana vs Cancún', prompt: 'Quiero comparar opciones entre Punta Cana y Cancún para 2 adultos, 7 días, todo incluido.' },
  { label: 'Ruta Europa para primer viaje', prompt: 'Armame una ruta por Europa para alguien que viaja por primera vez: destinos clásicos, 12 días, presupuesto medio.' },
  { label: 'Vacaciones en familia con presupuesto', prompt: 'Vacaciones en familia para 2 adultos y 2 chicos con presupuesto limitado, 7 días, destino playa.' },
  { label: 'Escapada corta internacional', prompt: 'Escapada de fin de semana largo a una ciudad internacional cercana, 4 días, 2 adultos.' },
] as const;

// ---------------------------------------------------------------------------
// Recent trips section
// ---------------------------------------------------------------------------

function RecentTripsSection({ onOpenTrip }: { onOpenTrip?: (tripId: string) => void }) {
  const { data: trips } = useTripList();
  const recent = (trips ?? []).slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">Trips recientes</span>
      </div>
      <div className="grid gap-2">
        {recent.map((trip) => (
          <RecentTripCard key={trip.id} trip={trip} onOpen={onOpenTrip ? () => onOpenTrip(trip.id) : undefined} />
        ))}
      </div>
    </div>
  );
}

function RecentTripCard({ trip, onOpen }: { trip: TripRow; onOpen?: () => void }) {
  const cities = trip.destination_cities ?? [];
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60 disabled:cursor-default"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
        🗺️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{trip.title ?? 'Sin título'}</p>
        {cities.length > 0 && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {cities.slice(0, 3).join(', ')}{cities.length > 3 ? ` +${cities.length - 3}` : ''}
          </p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PlannerDiscoveryPanelProps {
  onSendPrompt: (prompt: string) => void;
  onOpenTrip?: (tripId: string) => void;
}

export default function PlannerDiscoveryPanel({ onSendPrompt, onOpenTrip }: PlannerDiscoveryPanelProps) {
  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">

        {/* Hero */}
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ¿Qué viaje querés armar hoy?
          </h1>
          <p className="text-sm text-muted-foreground">
            Pedime una idea, una ruta o una cotización.
          </p>
        </div>

        {/* Quick start grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Compass className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em]">Ideas para arrancar</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {QUICK_START_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm"
                onClick={() => onSendPrompt(opt.prompt)}
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <Send className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent trips */}
        <RecentTripsSection onOpenTrip={onOpenTrip} />

        {/* Commercial suggestions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em]">Sugerencias para vender</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMMERCIAL_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                className="rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/[0.03]"
                onClick={() => onSendPrompt(s.prompt)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
