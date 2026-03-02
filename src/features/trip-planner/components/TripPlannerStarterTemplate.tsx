import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, MapPinned, Route, Sparkles } from 'lucide-react';

interface TripPlannerStarterTemplateProps {
  mode: 'idle' | 'processing';
  promptPreview?: string;
  typingMessage?: string;
  plannerError?: string | null;
}

function TemplateBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl border border-dashed border-border/70 bg-background/80 ${className}`.trim()} />;
}

export default function TripPlannerStarterTemplate({
  mode,
  promptPreview,
  typingMessage,
  plannerError,
}: TripPlannerStarterTemplateProps) {
  const isProcessing = mode === 'processing';

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardContent className="space-y-6 p-4 md:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Plantilla inicial
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {isProcessing ? 'Completando desde tu prompt' : 'Lista para empezar'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <p className="trip-planner-title text-3xl font-semibold md:text-4xl">
                  {isProcessing ? 'Armando tu viaje' : 'Diseñá tu próximo viaje'}
                </p>
              </div>
              <p className="trip-planner-body max-w-3xl text-sm leading-6 text-muted-foreground">
                {isProcessing
                  ? 'Estamos tomando tus destinos, fechas y preferencias para convertirlos en un planner editable.'
                  : 'Mandá un prompt en el asistente y este espacio se convertirá en un planner completo con ruta, días, hoteles y transporte.'}
              </p>
            </div>
          </div>

          {promptPreview && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="trip-planner-label text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Último pedido
              </p>
              <p className="trip-planner-body mt-2 text-sm text-foreground">{promptPreview}</p>
              {typingMessage && (
                <p className="trip-planner-body mt-2 text-xs text-muted-foreground">{typingMessage}</p>
              )}
            </div>
          )}

          <div className="rounded-[28px] border border-primary/15 bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(226,232,240,0.92))] p-4 sm:h-[380px]">
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
                  ? 'La ruta y los destinos aparecerán acá apenas el parser termine de interpretar tu pedido.'
                  : 'Acá vas a ver ciudades, hoteles del mapa y la ruta completa entre tramos.'}
              </div>
            </div>
          </div>

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
                    ? 'Vamos a habilitar cotización real y validación de hotel cuando el itinerario termine de generarse.'
                    : 'Cuando empieces, esta tarjeta mostrará hoteles reales, fechas y estado de cotización.'}
                </p>
              </TemplateBlock>

              <TemplateBlock className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Route className="h-4 w-4 text-primary" />
                  Transporte entre destinos
                </div>
                <p className="trip-planner-body mt-2 text-xs text-muted-foreground">
                  Vuelos y conexiones aparecerán acá cuando el plan tenga tramos definidos.
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
