import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  APIProvider,
  Map as GoogleMap,
  RenderingType,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { CalendarDays, MapPinned, Route, Send, Sparkles } from 'lucide-react';
import { HAS_PLANNER_GOOGLE_MAPS, PLANNER_GOOGLE_MAPS_API_KEY, PLANNER_GOOGLE_MAPS_MAP_ID } from '../map';

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

const cityPhotoCache = new Map<string, string>();

function StarterCityPhotoFetcher({
  onPhotosLoaded,
}: {
  onPhotosLoaded: (photos: Record<string, string>) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const fetchedRef = useRef(false);
  const onPhotosLoadedRef = useRef(onPhotosLoaded);
  onPhotosLoadedRef.current = onPhotosLoaded;

  useEffect(() => {
    if (!placesLib || fetchedRef.current) return;
    fetchedRef.current = true;

    // Check cache first
    const cached: Record<string, string> = {};
    let allCached = true;
    for (const card of STARTER_CARDS) {
      const url = cityPhotoCache.get(card.id);
      if (url) {
        cached[card.id] = url;
      } else {
        allCached = false;
      }
    }

    if (allCached) {
      onPhotosLoadedRef.current(cached);
      return;
    }

    const container = document.createElement('div');
    const service = new placesLib.PlacesService(container);
    const photos: Record<string, string> = { ...cached };
    let remaining = STARTER_CARDS.filter((c) => !cached[c.id]).length;

    STARTER_CARDS.forEach((card) => {
      if (cached[card.id]) return;

      service.findPlaceFromQuery(
        { query: card.photoQuery, fields: ['photos'] },
        (results, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            results?.[0]?.photos?.[0]
          ) {
            const url = results[0].photos[0].getUrl({ maxWidth: 800 });
            photos[card.id] = url;
            cityPhotoCache.set(card.id, url);
          }
          remaining--;
          if (remaining <= 0) {
            onPhotosLoadedRef.current(photos);
          }
        },
      );
    });
  }, [placesLib]);

  return null;
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
  const [cityPhotos, setCityPhotos] = useState<Record<string, string>>({});

  const handlePhotosLoaded = useCallback((photos: Record<string, string>) => {
    setCityPhotos(photos);
  }, []);

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
              {HAS_PLANNER_GOOGLE_MAPS ? (
                <APIProvider
                  apiKey={PLANNER_GOOGLE_MAPS_API_KEY}
                  language="es"
                  region="ES"
                >
                  <GoogleMap
                    defaultCenter={{ lat: 30, lng: 10 }}
                    defaultZoom={2.2}
                    mapId={PLANNER_GOOGLE_MAPS_MAP_ID || undefined}
                    reuseMaps
                    disableDefaultUI
                    gestureHandling="cooperative"
                    colorScheme="LIGHT"
                    renderingType={RenderingType.VECTOR}
                    style={{ width: '100%', height: '100%' }}
                  />
                </APIProvider>
              ) : (
                <div className="flex h-full bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(226,232,240,0.92))] p-4">
                  <StarterMapPlaceholder isProcessing={isProcessing} />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-4 top-4 z-10">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
                  <MapPinned className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Mapa del recorrido
                  </span>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10">
                <div className="rounded-full border border-white/70 bg-white/85 px-4 py-2 text-xs text-slate-600 shadow backdrop-blur">
                  <Route className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                  {isProcessing
                    ? 'Los destinos van a aparecer acá cuando termine de interpretar tu pedido.'
                    : 'Acá vas a ver ciudades, hoteles y la ruta completa del viaje.'}
                </div>
              </div>
            </div>
          </div>
          </div>

          {!isProcessing && onSendPrompt && (
            <>
              {HAS_PLANNER_GOOGLE_MAPS && (
                <APIProvider apiKey={PLANNER_GOOGLE_MAPS_API_KEY} language="es" region="ES">
                  <StarterCityPhotoFetcher onPhotosLoaded={handlePhotosLoaded} />
                </APIProvider>
              )}
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
