import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plane } from 'lucide-react';
import type { PlannerSegment } from '../types';
import {
  formatDestinationLabel,
  formatPlannerFlightBaggage,
  formatPlannerFlightCabin,
  formatPlannerFlightDuration,
  formatPlannerFlightPrice,
  formatPlannerFlightStops,
  formatPlannerFlightTimeRange,
  getPlannerFlightRoute,
  getPlannerFlightSegments,
} from '../utils';
import PlannerCircularLoadingState from './PlannerCircularLoadingState';

interface PlannerTransportSectionProps {
  segment: PlannerSegment;
  previousSegment?: PlannerSegment | null;
  disabled?: boolean;
  statusText: string;
  onSelectTransportOption: (segmentId: string, optionId: string) => Promise<void>;
  isLastSegment?: boolean;
  origin?: string;
}

export default function PlannerTransportSection({
  segment,
  previousSegment = null,
  disabled = false,
  statusText,
  onSelectTransportOption,
  isLastSegment = false,
  origin,
}: PlannerTransportSectionProps) {
  if (!previousSegment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="trip-planner-title flex items-center gap-2 text-base">
            <Plane className="h-4 w-4 text-primary" />
            Transporte entre destinos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              El primer destino no necesita transporte previo. Elegí otro tramo para comparar opciones reales.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="trip-planner-title flex items-center gap-2 text-base">
          <Plane className="h-4 w-4 text-primary" />
          Transporte entre destinos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {segment.transportIn?.searchStatus === 'loading' ? (
          <div className="planner-panel-fade-in">
            <PlannerCircularLoadingState
              label={`Buscando transporte a ${formatDestinationLabel(segment.city)}`}
              sublabel={`Estamos consultando opciones reales entre ${formatDestinationLabel(previousSegment.city)} y ${formatDestinationLabel(segment.city)}.`}
            />
          </div>
        ) : (
          <div className="planner-panel-fade-in">
            <p className="trip-planner-body text-xs text-muted-foreground">{statusText}</p>
            {segment.transportIn?.error && (
              <p className="trip-planner-body text-xs text-destructive">{segment.transportIn.error}</p>
            )}
          </div>
        )}

        {segment.transportIn?.searchStatus !== 'loading' && (
          <div className="planner-panel-fade-in space-y-3">
            {segment.transportIn?.options?.slice(0, 3).map((option) => {
              const selected = segment.transportIn?.selectedOptionId === option.id;
              const routeLabel = getPlannerFlightRoute(option);
              const timeRange = formatPlannerFlightTimeRange(option);
              const durationLabel = formatPlannerFlightDuration(option);
              const stopsLabel = formatPlannerFlightStops(option);
              const cabinLabel = formatPlannerFlightCabin(option);
              const baggageLabel = formatPlannerFlightBaggage(option);
              const totalPrice = formatPlannerFlightPrice(option);
              const flightSegments = getPlannerFlightSegments(option);

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40'
                  } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
                  disabled={disabled}
                  onClick={() => void onSelectTransportOption(segment.id, option.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="trip-planner-label text-sm font-semibold">
                        {option.airline?.name || 'Opcion de vuelo'}
                      </p>
                      <p className="trip-planner-body mt-1 text-xs text-muted-foreground">
                        {[routeLabel, option.departure_date].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <Badge variant={selected ? 'default' : 'secondary'} className="shrink-0 rounded-full px-2 py-0.5 text-[11px]">
                      {stopsLabel}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {timeRange && <span>{timeRange}</span>}
                    {durationLabel && <span>{durationLabel}</span>}
                  </div>

                  {flightSegments.length > 0 && (
                    <div className="mt-3 space-y-2 rounded-lg bg-muted/35 px-3 py-2">
                      {flightSegments.slice(0, 3).map((flightSegment) => (
                        <div key={`${option.id}-${flightSegment.segmentNumber}`} className="flex items-start justify-between gap-3 text-[11px]">
                          <div className="min-w-0">
                            <p className="trip-planner-label text-xs font-medium text-foreground">
                              {flightSegment.departure.airportCode} {flightSegment.departure.time} - {flightSegment.arrival.airportCode} {flightSegment.arrival.time}
                            </p>
                            <p className="trip-planner-body mt-1 text-[11px] text-muted-foreground">
                              {flightSegment.operatingAirlineName || option.airline?.name || 'Vuelo'} {flightSegment.flightNumber}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="trip-planner-body text-[11px] text-muted-foreground">
                              {flightSegment.cabinClass}
                            </p>
                            {flightSegment.stops?.length > 0 && (
                              <p className="trip-planner-body mt-1 text-[11px] text-muted-foreground">
                                {flightSegment.stops.length} parada{flightSegment.stops.length === 1 ? '' : 's'}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(cabinLabel || baggageLabel) && (
                    <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
                      {cabinLabel && (
                        <p className="trip-planner-label text-xs font-medium text-foreground">{cabinLabel}</p>
                      )}
                      {baggageLabel && (
                        <p className="trip-planner-body mt-1 text-[11px] text-muted-foreground">{baggageLabel}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="trip-planner-label text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Total
                      </p>
                      <p className="trip-planner-label text-sm font-semibold text-foreground">
                        {totalPrice || 'Consultar'}
                      </p>
                    </div>
                    {option.airline?.code && (
                      <p className="trip-planner-body text-xs text-muted-foreground">{option.airline.code}</p>
                    )}
                  </div>
                </button>
              );
            })}

            {(segment.transportIn?.options?.length || 0) === 0 && segment.transportIn?.searchStatus === 'ready' && (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  No encontramos transporte real para este tramo con la información actual.
                </p>
              </div>
            )}
          </div>
        )}
        {isLastSegment && !segment.transportOut && segment.transportIn?.searchStatus === 'ready' && (
          <div className="planner-panel-fade-in mt-3 rounded-2xl border border-dashed border-amber-300/70 bg-amber-50/50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="trip-planner-label text-sm font-medium text-foreground">
                  Vuelo de regreso
                </p>
                <p className="trip-planner-body mt-0.5 text-xs text-muted-foreground">
                  {formatDestinationLabel(segment.city)} → {origin || 'origen'}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 rounded-full border-amber-400 px-2 py-0.5 text-[11px] text-amber-600 dark:border-amber-600 dark:text-amber-400">
                Pendiente
              </Badge>
            </div>
            <p className="trip-planner-body mt-2 text-[11px] text-muted-foreground">
              Pedile a Emilia que busque el vuelo de regreso en el chat.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
