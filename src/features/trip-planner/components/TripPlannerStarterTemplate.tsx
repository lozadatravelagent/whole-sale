import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import MapGL from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { CalendarDays, MapPinned, Route, Send, Sparkles } from 'lucide-react';
import { HAS_MAP, MAPBOX_TOKEN } from '../map';

const STARTER_CARDS = [
  {
    id: 'roma-florencia',
    title: 'Roma & Florencia',
    subtitle: '7 dias · Italia',
    emoji: '🏛️',
    gradient: 'from-amber-600 via-orange-500 to-rose-500',
    prompt: 'Quiero 7 días por Italia visitando Roma y Florencia, 2 adultos, presupuesto medio',
    photoQuery: 'Colosseum Rome Italy',
  },
  {
    id: 'paris-londres',
    title: 'París & Londres',
    subtitle: '10 dias · Francia & UK',
    emoji: '🗼',
    gradient: 'from-blue-600 via-indigo-500 to-violet-500',
    prompt: 'Armame 10 días por París y Londres para una pareja, hoteles 4 estrellas',
    photoQuery: 'Eiffel Tower Paris France',
  },
  {
    id: 'barcelona-madrid',
    title: 'Barcelona & Madrid',
    subtitle: '5 dias · España',
    emoji: '⛪',
    gradient: 'from-red-600 via-rose-500 to-pink-500',
    prompt: 'Viaje de 5 días por España, Barcelona y Madrid, 2 adultos y 1 niño de 8 años',
    photoQuery: 'Sagrada Familia Barcelona Spain',
  },
] as const;

// ---------------------------------------------------------------------------
// Photo fetcher — runs inside an APIProvider to access the Places library
// ---------------------------------------------------------------------------

// Static photo URLs for starter cards (no API call needed)
function getStarterCardPhoto(photoQuery: string): string {
  return `https://source.unsplash.com/800x600/?${encodeURIComponent(photoQuery)}`;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

interface TripPlannerStarterTemplateProps {
  mode: 'idle' | 'processing';
  promptPreview?: string;
  typingMessage?: string;
  plannerError?: string | null;
  onSendPrompt?: (prompt: string) => void;
}

function TemplateBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl border border-dashed border-border/70 bg-background/80 ${className}`.trim()} />;
}

function StarterMapPlaceholder({ isProcessing }: { isProcessing: boolean }) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-[24px] border border-white/80 bg-white/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        <MapPinned className="h-3.5 w-3.5 text-primary" />
        Mapa del recorrido
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TemplateBlock className="h-24" />
        <TemplateBlock className="h-24" />
        <TemplateBlock className="h-24" />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Route className="h-3.5 w-3.5 text-primary" />
        {isProcessing
          ? 'La ruta y los destinos van a aparecer acá apenas termine de interpretar tu pedido.'
          : 'Acá vas a seguir ciudades, hoteles del mapa y la ruta completa entre tramos.'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TripPlannerStarterTemplate({
  mode,
  promptPreview,
  typingMessage,
  plannerError,
  onSendPrompt,
}: TripPlannerStarterTemplateProps) {
  const isProcessing = mode === 'processing';

  // Pre-compute photo URLs (no API call)
  const cityPhotos = STARTER_CARDS.reduce<Record<string, string>>((acc, card) => {
    acc[card.id] = getStarterCardPhoto(card.photoQuery);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardContent className="space-y-6 p-4 md:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Primer borrador
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {isProcessing ? 'Interpretando tu pedido' : 'Esperando tu viaje'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <p className="trip-planner-title text-3xl font-semibold md:text-4xl">
                  {isProcessing ? 'Estoy armando tu viaje' : 'Contame cómo querés viajar'}
                </p>
              </div>
              <p className="trip-planner-body max-w-3xl text-sm leading-6 text-muted-foreground">
                {isProcessing
                  ? 'Estoy tomando destinos, fechas y preferencias para convertirlos en un planner editable y más fácil de ajustar.'
                  : 'Escribí tu idea en el asistente y este espacio se va a llenar con ruta, días, hoteles y transporte.'}
              </p>
            </div>
          </div>

          {promptPreview && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="trip-planner-label text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Tu pedido
              </p>
              <p className="trip-planner-body mt-2 text-sm text-foreground">{promptPreview}</p>
              {typingMessage && (
                <p className="trip-planner-body mt-2 text-xs text-muted-foreground">{typingMessage}</p>
              )}
            </div>
          )}

          <div className="w-full">
            <div className="overflow-hidden rounded-[28px] border border-primary/15 shadow-sm">
              <div className="relative h-[320px] sm:h-[380px]">
                {HAS_MAP ? (
                  <MapGL
                    mapboxAccessToken={MAPBOX_TOKEN}
                    initialViewState={{ longitude: 9, latitude: 42, zoom: 3 }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                    interactive={false}
                  />
                ) : (
                  <div className="flex h-full bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(226,232,240,0.92))] p-4">
                    <StarterMapPlaceholder isProcessing={isProcessing} />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 px-6 text-center backdrop-blur-[1px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPinned className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">
                      {isProcessing ? 'Armando tu viaje...' : 'Esperando destinos del viaje'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {isProcessing
                        ? 'Los destinos van a aparecer acá cuando termine de interpretar tu pedido.'
                        : 'El mapa mostrará la ruta completa cuando se definan los destinos.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isProcessing && onSendPrompt && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {STARTER_CARDS.map((card) => {
                  const photoUrl = cityPhotos[card.id];
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="group relative flex h-56 flex-col justify-end overflow-hidden rounded-3xl text-left shadow-md transition-all hover:scale-[1.02] hover:shadow-xl"
                      onClick={() => onSendPrompt(card.prompt)}
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={card.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <span className="absolute right-4 top-4 text-5xl opacity-25 drop-shadow-lg transition-transform group-hover:scale-110">
                        {card.emoji}
                      </span>
                      <div className="relative z-10 p-5">
                        <p className="text-[11px] font-medium uppercase tracking-widest text-white/70">
                          {card.subtitle}
                        </p>
                        <p className="mt-1 text-lg font-bold tracking-tight text-white drop-shadow-sm">
                          {card.title}
                        </p>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-white/85">
                          {card.prompt}
                        </p>
                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm transition-all group-hover:bg-white/30">
                          <Send className="h-3 w-3" />
                          Probar este viaje
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="grid gap-4 @4xl:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              {[1, 2].map((segment) => (
                <TemplateBlock key={segment} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-2">
                        <div className="h-5 w-40 rounded-md bg-muted/60" />
                        <div className="h-4 w-56 rounded-md bg-muted/40" />
                      </div>
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                        Destino {segment}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg bg-muted/45 p-3">
                        <p className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Mañana</p>
                        <p className="trip-planner-body mt-2 text-xs text-muted-foreground">Actividades sugeridas</p>
                      </div>
                      <div className="rounded-lg bg-muted/45 p-3">
                        <p className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tarde</p>
                        <p className="trip-planner-body mt-2 text-xs text-muted-foreground">Restaurantes y recorridos</p>
                      </div>
                      <div className="rounded-lg bg-muted/45 p-3">
                        <p className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Noche</p>
                        <p className="trip-planner-body mt-2 text-xs text-muted-foreground">Experiencias y cierre del día</p>
                      </div>
                    </div>
                  </div>
                </TemplateBlock>
              ))}
            </div>

            <div className="space-y-4">
              <TemplateBlock className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Hoteles y fechas
                </div>
                <p className="trip-planner-body mt-2 text-xs text-muted-foreground">
                  {isProcessing
                    ? 'Cuando cierre el borrador, desde acá vas a poder pasar de sugerencia a precio real.'
                    : 'Acá vas a ver sugerencias del planner, hoteles reales y estado de cotización.'}
                </p>
              </TemplateBlock>

              <TemplateBlock className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Route className="h-4 w-4 text-primary" />
                  Transporte entre destinos
                </div>
                <p className="trip-planner-body mt-2 text-xs text-muted-foreground">
                  Cuando el viaje tenga tramos definidos, acá vas a poder comparar vuelos y conexiones reales.
                </p>
              </TemplateBlock>
            </div>
          </div>

          {plannerError && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="trip-planner-body text-sm text-destructive">{plannerError}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
