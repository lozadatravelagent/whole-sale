import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MessageInput from '@/features/chat/components/MessageInput';
import MessageItem from '@/features/chat/components/MessageItem';
import type { MessageRow } from '@/features/chat/types/chat';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import { Bot, CalendarDays, ChevronRight, GripVertical, Loader2, Lock, LockOpen, PanelRightClose, Plane, Plus, RefreshCcw, Sparkles, Trash2 } from 'lucide-react';
import type { TripPlannerState } from '../types';
import {
  formatBudgetLevel,
  formatDateRange,
  formatDayBlockLabel,
  formatDestinationLabel,
  formatFlexibleMonth,
  formatPlannerFlightBaggage,
  formatPlannerFlightCabin,
  formatPlannerFlightDuration,
  formatPlannerFlightPrice,
  getPlannerFlightSegments,
  formatPlannerFlightStops,
  formatPlannerFlightTimeRange,
  formatPaceLabel,
  formatPlannerHotelCategory,
  getPlannerFlightRoute,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  formatPlannerTravelerSummary,
  formatShortDate,
  getPrimaryPlannerHotelRoom,
  getPlannerHotelDisplayId,
} from '../utils';
import TripPlannerMap from './TripPlannerMap';
import PlannerDateSelectionModal from './PlannerDateSelectionModal';
import PlannerCircularLoadingState from './PlannerCircularLoadingState';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

interface TripPlannerWorkspaceProps {
  selectedConversation: string | null;
  message: string;
  isLoading: boolean;
  isTyping: boolean;
  typingMessage?: string;
  isUploadingPdf: boolean;
  messages: MessageRow[];
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onPdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPdfGenerated: (pdfUrl: string, selectedFlights: GlobalFlightData[], selectedHotels: GlobalHotelData[]) => Promise<void>;
  plannerState: TripPlannerState | null;
  isLoadingPlanner: boolean;
  activePlannerMutation: {
    type: 'regen_plan' | 'regen_segment' | 'regen_day';
    segmentId?: string;
    dayId?: string;
  } | null;
  isResolvingLocations: boolean;
  plannerError: string | null;
  plannerLocationWarning: string | null;
  onUpdateTripField: <K extends keyof TripPlannerState>(field: K, value: TripPlannerState[K]) => Promise<void>;
  onApplyPlannerDateSelection: (selection: {
    startDate?: string;
    endDate?: string;
    isFlexibleDates: boolean;
    flexibleMonth?: string;
    flexibleYear?: number;
    days?: number;
  }) => Promise<void>;
  onAddDestination: (destination: string) => Promise<void>;
  onRemoveDestination: (segmentId: string) => Promise<void>;
  onReorderDestinations: (fromSegmentId: string, toSegmentId: string) => Promise<void>;
  onRegeneratePlanner: () => Promise<void>;
  onRegenerateSegment: (segmentId: string) => Promise<void>;
  onRegenerateDay: (segmentId: string, dayId: string) => Promise<void>;
  onToggleDayLock: (segmentId: string, dayId: string) => Promise<void>;
  onToggleActivityLock: (segmentId: string, dayId: string, block: 'morning' | 'afternoon' | 'evening', activityId: string) => Promise<void>;
  onSelectHotel: (segmentId: string, hotelId: string) => Promise<void>;
  onSelectTransportOption: (segmentId: string, optionId: string) => Promise<void>;
  onCompletePlannerDateSelection: (
    baseRequest: ParsedTravelRequest,
    selection: {
      startDate?: string;
      endDate?: string;
      isFlexibleDates: boolean;
      flexibleMonth?: string;
      flexibleYear?: number;
      days?: number;
    }
  ) => Promise<void>;
}

export default function TripPlannerWorkspace({
  selectedConversation,
  message,
  isLoading,
  isTyping,
  typingMessage,
  isUploadingPdf,
  messages,
  onMessageChange,
  onSendMessage,
  onPdfUpload,
  onPdfGenerated,
  plannerState,
  isLoadingPlanner,
  activePlannerMutation,
  isResolvingLocations,
  plannerError,
  plannerLocationWarning,
  onUpdateTripField,
  onApplyPlannerDateSelection,
  onAddDestination,
  onRemoveDestination,
  onReorderDestinations,
  onRegeneratePlanner,
  onRegenerateSegment,
  onRegenerateDay,
  onToggleDayLock,
  onToggleActivityLock,
  onSelectHotel,
  onSelectTransportOption,
  onCompletePlannerDateSelection,
}: TripPlannerWorkspaceProps) {
  const ASSISTANT_WIDTH_DEFAULT = 420;
  const ASSISTANT_WIDTH_MIN = 320;
  const ASSISTANT_WIDTH_MAX = 680;
  const ASSISTANT_WIDTH_STORAGE_KEY = 'tripPlannerAssistantWidth';
  const ASSISTANT_COLLAPSED_STORAGE_KEY = 'tripPlannerAssistantCollapsed';
  const [newDestination, setNewDestination] = useState('');
  const [mobileTab, setMobileTab] = useState('plan');
  const [pendingPlannerDateRequest, setPendingPlannerDateRequest] = useState<ParsedTravelRequest | null>(null);
  const [isDateSelectionModalOpen, setIsDateSelectionModalOpen] = useState(false);
  const [draggedSegmentId, setDraggedSegmentId] = useState<string | null>(null);
  const [dropTargetSegmentId, setDropTargetSegmentId] = useState<string | null>(null);
  const [isReorderingRoute, setIsReorderingRoute] = useState(false);
  const [assistantWidth, setAssistantWidth] = useState(ASSISTANT_WIDTH_DEFAULT);
  const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);
  const [isResizingAssistant, setIsResizingAssistant] = useState(false);
  const resizeStartXRef = useRef<number | null>(null);
  const resizeStartWidthRef = useRef<number | null>(null);

  const clampAssistantWidth = useCallback((value: number) => {
    return Math.min(ASSISTANT_WIDTH_MAX, Math.max(ASSISTANT_WIDTH_MIN, value));
  }, [ASSISTANT_WIDTH_MAX, ASSISTANT_WIDTH_MIN]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedWidth = window.localStorage.getItem(ASSISTANT_WIDTH_STORAGE_KEY);
    const parsedWidth = storedWidth ? Number(storedWidth) : NaN;
    if (!Number.isNaN(parsedWidth)) {
      setAssistantWidth(clampAssistantWidth(parsedWidth));
    }

    const storedCollapsed = window.localStorage.getItem(ASSISTANT_COLLAPSED_STORAGE_KEY);
    setIsAssistantCollapsed(storedCollapsed === 'true');
  }, [clampAssistantWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ASSISTANT_WIDTH_STORAGE_KEY, String(clampAssistantWidth(assistantWidth)));
  }, [assistantWidth, clampAssistantWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ASSISTANT_COLLAPSED_STORAGE_KEY, String(isAssistantCollapsed));
  }, [isAssistantCollapsed]);

  useEffect(() => {
    if (!isResizingAssistant) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (resizeStartXRef.current === null || resizeStartWidthRef.current === null) return;
      const delta = resizeStartXRef.current - event.clientX;
      setAssistantWidth(clampAssistantWidth(resizeStartWidthRef.current + delta));
    };

    const handlePointerUp = () => {
      setIsResizingAssistant(false);
      resizeStartXRef.current = null;
      resizeStartWidthRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [clampAssistantWidth, isResizingAssistant]);

  const handleAssistantResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isAssistantCollapsed) return;
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = assistantWidth;
    setIsResizingAssistant(true);
  }, [assistantWidth, isAssistantCollapsed]);

  const handleCollapseAssistant = useCallback(() => {
    setIsAssistantCollapsed(true);
    setIsResizingAssistant(false);
  }, []);

  const handleExpandAssistant = useCallback(() => {
    setAssistantWidth((current) => clampAssistantWidth(current || ASSISTANT_WIDTH_DEFAULT));
    setIsAssistantCollapsed(false);
  }, [clampAssistantWidth]);

  const handleSelectSegmentFromMap = useCallback((segmentId: string) => {
    const target = document.getElementById(`planner-segment-${segmentId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const destinationLabels = useMemo(
    () => plannerState?.segments.map((segment) => formatDestinationLabel(segment.city)) ?? [],
    [plannerState]
  );

  const plannerDateSummary = plannerState?.isFlexibleDates
    ? formatFlexibleMonth(plannerState.flexibleMonth, plannerState.flexibleYear)
    : formatDateRange(plannerState?.startDate, plannerState?.endDate);
  const hasExactPlannerDates = Boolean(plannerState?.startDate && plannerState?.endDate && !plannerState?.isFlexibleDates);
  const isRegeneratingPlan = activePlannerMutation?.type === 'regen_plan';

  const getHotelStatusText = (segment: TripPlannerState['segments'][number]) => {
    const hasDates = Boolean((segment.startDate || plannerState?.startDate) && (segment.endDate || plannerState?.endDate));

    if (plannerState?.isFlexibleDates || !hasDates) {
      return 'Elegi fechas exactas para cargar hoteles reales.';
    }
    if (segment.hotelPlan.searchStatus === 'error') {
      return 'No pudimos cargar hoteles para este destino en este momento.';
    }
    if (segment.hotelPlan.searchStatus === 'loading') {
      return 'Buscando hoteles para este destino...';
    }
    if (segment.hotelPlan.searchStatus === 'ready' && segment.hotelPlan.hotelRecommendations.length > 0) {
      return `${segment.hotelPlan.hotelRecommendations.length} hoteles encontrados`;
    }
    if (segment.hotelPlan.searchStatus === 'ready') {
      return 'No encontramos hoteles para este tramo con las fechas actuales.';
    }
    return 'Buscando hoteles para este destino...';
  };

  const getTransportStatusText = (
    segment: TripPlannerState['segments'][number],
    previousSegment?: TripPlannerState['segments'][number]
  ) => {
    if (segment.transportIn?.searchStatus === 'error') {
      return 'No pudimos cargar transporte para este tramo en este momento.';
    }
    if (segment.transportIn?.searchStatus === 'ready') {
      const optionCount = segment.transportIn.options?.length || 0;
      return optionCount > 0
        ? `${optionCount} opciones de transporte cargadas`
        : 'No encontramos transporte para este tramo con la informacion actual.';
    }
    return previousSegment
      ? `Carga opciones reales entre ${formatDestinationLabel(previousSegment.city)} y ${formatDestinationLabel(segment.city)}.`
      : 'Carga opciones reales de vuelo para este tramo.';
  };

  const visibleMessages = useMemo(() => messages.filter((m) => {
    const meta = (m as any).meta;
    if (m.role === 'system' && meta && (
      meta.messageType === 'contextual_memory' ||
      meta.messageType === 'context_state' ||
      meta.messageType === 'trip_planner_state'
    )) {
      return false;
    }
    return true;
  }), [messages]);

  const plannerShell = (
    <div className="trip-planner-surface flex flex-col gap-4 overflow-y-auto p-4 lg:p-6">
      {!plannerState ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="trip-planner-title flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Planificador de Viajes
            </CardTitle>
          </CardHeader>
          <CardContent className="trip-planner-body space-y-3 text-sm text-muted-foreground">
            <p>Empezá con un prompt en el panel del asistente, por ejemplo:</p>
            <div className="rounded-lg bg-muted p-3 text-foreground">
              Planeá un viaje por varias ciudades, con un presupuesto medio, buena gastronomía y museos.
            </div>
            {plannerError && <p className="text-destructive">{plannerError}</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-primary/15 shadow-sm">
            <CardContent className="space-y-6 p-4 md:p-6">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {destinationLabels.length} destinos
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {plannerState.days} días
                  </Badge>
                  {(plannerState.startDate || plannerState.endDate || plannerState.isFlexibleDates) && (
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {plannerDateSummary}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Input
                    value={plannerState.title}
                    onChange={(event) => void onUpdateTripField('title', event.target.value)}
                    className="trip-planner-title h-auto border-0 px-0 text-3xl font-semibold shadow-none focus-visible:ring-0 md:text-4xl"
                  />
                  <p className="trip-planner-body max-w-3xl text-sm leading-6 text-muted-foreground">{plannerState.summary}</p>
                </div>
              </div>

              <TripPlannerMap
                segments={plannerState.segments}
                days={plannerState.days}
                isResolvingLocations={isResolvingLocations}
                locationWarning={plannerLocationWarning}
                onSelectSegment={handleSelectSegmentFromMap}
              />

              <div className="rounded-3xl border bg-muted/20 p-4 md:p-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Destinos
                      </p>
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                        {plannerState.segments.length}
                      </Badge>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {plannerState.segments.map((segment, index) => (
                        <div
                          key={segment.id}
                          draggable={!isReorderingRoute && !isLoadingPlanner}
                          onDragStart={() => setDraggedSegmentId(segment.id)}
                          onDragEnd={() => {
                            setDraggedSegmentId(null);
                            setDropTargetSegmentId(null);
                          }}
                          onDragEnter={() => {
                            if (draggedSegmentId && draggedSegmentId !== segment.id) {
                              setDropTargetSegmentId(segment.id);
                            }
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggedSegmentId && draggedSegmentId !== segment.id) {
                              setDropTargetSegmentId(segment.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dropTargetSegmentId === segment.id) {
                              setDropTargetSegmentId(null);
                            }
                          }}
                          onDrop={async () => {
                            if (!draggedSegmentId || draggedSegmentId === segment.id) return;
                            setIsReorderingRoute(true);
                            await onReorderDestinations(draggedSegmentId, segment.id);
                            setIsReorderingRoute(false);
                            setDraggedSegmentId(null);
                            setDropTargetSegmentId(null);
                          }}
                          className={`flex items-center justify-between gap-3 rounded-2xl border bg-background/85 px-3 py-2.5 transition ${
                            draggedSegmentId === segment.id
                              ? 'opacity-45'
                              : dropTargetSegmentId === segment.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                : ''
                          } ${isReorderingRoute || isLoadingPlanner ? 'cursor-wait' : 'cursor-grab'}`}
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {index + 1}
                            </span>
                            <span className="trip-planner-label text-sm text-foreground">
                              {formatDestinationLabel(segment.city)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="text-muted-foreground transition hover:text-foreground"
                            onClick={() => void onRemoveDestination(segment.id)}
                            aria-label={`Eliminar ${formatDestinationLabel(segment.city)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={newDestination}
                        placeholder="Agregar destino"
                        onChange={(event) => setNewDestination(event.target.value)}
                        className="h-10 bg-background/80"
                      />
                      <Button
                        onClick={() => {
                          void onAddDestination(newDestination);
                          setNewDestination('');
                        }}
                        disabled={!newDestination.trim() || isReorderingRoute || isLoadingPlanner}
                        className="h-10 sm:min-w-[120px]"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar
                      </Button>
                    </div>

                    <div className="flex min-h-5 items-center gap-2 text-[11px] text-muted-foreground">
                      {isReorderingRoute ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          <span>Reordenando y recalculando la ruta...</span>
                        </>
                      ) : (
                        <span>Arrastrá los destinos para cambiar el orden.</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border/70 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Configuración del viaje
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void onRegeneratePlanner()}
                        disabled={isLoadingPlanner || isReorderingRoute}
                        className="sm:self-start"
                      >
                        {isRegeneratingPlan && !isReorderingRoute ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="mr-2 h-4 w-4" />
                        )}
                        Regenerar
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className="flex min-h-11 min-w-[260px] flex-1 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                        <span className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Fechas</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 w-full justify-start gap-2 rounded-full px-0 text-left text-sm font-medium hover:bg-transparent"
                          onClick={() => {
                            setPendingPlannerDateRequest(null);
                            setIsDateSelectionModalOpen(true);
                          }}
                        >
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <span className="trip-planner-label">{plannerDateSummary}</span>
                        </Button>
                      </div>

                      <div className="flex min-h-11 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                        <span className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Días</span>
                        {hasExactPlannerDates ? (
                          <span className="trip-planner-label text-sm">{plannerState.days}</span>
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            value={plannerState.days}
                            onChange={(event) => void onUpdateTripField('days', Math.max(1, Number(event.target.value) || 1) as TripPlannerState['days'])}
                            className="h-7 w-14 border-0 bg-transparent px-0 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
                          />
                        )}
                      </div>

                      <div className="flex min-h-11 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                        <span className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Presupuesto</span>
                        <Select
                          value={plannerState.budgetLevel || 'mid'}
                          onValueChange={(value) => void onUpdateTripField('budgetLevel', value as TripPlannerState['budgetLevel'])}
                        >
                          <SelectTrigger className="h-7 w-auto min-w-[88px] border-0 bg-transparent px-0 text-sm font-medium shadow-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">{formatBudgetLevel('low')}</SelectItem>
                            <SelectItem value="mid">{formatBudgetLevel('mid')}</SelectItem>
                            <SelectItem value="high">{formatBudgetLevel('high')}</SelectItem>
                            <SelectItem value="luxury">{formatBudgetLevel('luxury')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex min-h-11 items-center gap-3 rounded-full border bg-background/80 px-4 py-2">
                        <span className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ritmo</span>
                        <Select
                          value={plannerState.pace || 'balanced'}
                          onValueChange={(value) => void onUpdateTripField('pace', value as TripPlannerState['pace'])}
                        >
                          <SelectTrigger className="h-7 w-auto min-w-[92px] border-0 bg-transparent px-0 text-sm font-medium shadow-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relaxed">{formatPaceLabel('relaxed')}</SelectItem>
                            <SelectItem value="balanced">{formatPaceLabel('balanced')}</SelectItem>
                            <SelectItem value="fast">{formatPaceLabel('fast')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {plannerState.segments.map((segment, segmentIndex) => (
              <Card key={segment.id} id={`planner-segment-${segment.id}`} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <CardTitle className="trip-planner-title text-lg">
                        {segmentIndex + 1}. {formatDestinationLabel(segment.city)}
                      </CardTitle>
                      <p className="trip-planner-body mt-1 text-sm text-muted-foreground">
                        {formatDateRange(segment.startDate, segment.endDate)}
                        {segment.summary ? ` • ${segment.summary}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onRegenerateSegment(segment.id)}
                          disabled={isLoadingPlanner}
                        >
                          {activePlannerMutation?.type === 'regen_segment' && activePlannerMutation.segmentId === segment.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4 mr-2" />
                          )}
                          Regenerar tramo
                        </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-4 xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-4">
                    {segment.days.length === 0 ? (
                      <div className="trip-planner-body rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Este destino todavía no tiene días generados. Regenerá el planificador para completarlo.
                      </div>
                    ) : (
                      segment.days.map((day) => (
                        <Card key={day.id}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <CardTitle className="trip-planner-title text-base">
                                  Día {day.dayNumber}: {day.title}
                                </CardTitle>
                                <p className="trip-planner-body text-sm text-muted-foreground">
                                  {day.date ? `${formatShortDate(day.date)} • ` : ''}{formatDestinationLabel(day.city)}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void onRegenerateDay(segment.id, day.id)}
                                    disabled={isLoadingPlanner}
                                  >
                                    {activePlannerMutation?.type === 'regen_day' && activePlannerMutation.segmentId === segment.id && activePlannerMutation.dayId === day.id ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <RefreshCcw className="h-4 w-4 mr-2" />
                                    )}
                                    Regenerar día
                                  </Button>
                                <Button variant="ghost" size="sm" onClick={() => void onToggleDayLock(segment.id, day.id)}>
                                  {day.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="grid gap-4 md:grid-cols-3">
                            {(['morning', 'afternoon', 'evening'] as const).map((block) => (
                              <div key={block} className="space-y-2">
                                <p className="trip-planner-label text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {formatDayBlockLabel(block)}
                                </p>
                                {day[block].map((activity) => (
                                  <div key={activity.id} className="rounded-lg border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {activity.time && (
                                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                                              {activity.time}
                                            </Badge>
                                          )}
                                          {activity.category && (
                                            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                                              {activity.category}
                                            </Badge>
                                          )}
                                          <p className="trip-planner-label text-sm font-medium">
                                            {activity.title}
                                          </p>
                                        </div>
                                        {activity.description && (
                                          <p className="trip-planner-body mt-1 text-xs text-muted-foreground">{activity.description}</p>
                                        )}
                                        {activity.tip && (
                                          <p className="trip-planner-body mt-2 text-xs text-primary">{activity.tip}</p>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => void onToggleActivityLock(segment.id, day.id, block, activity.id)}
                                      >
                                        {activity.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="trip-planner-title flex items-center gap-2 text-base">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          Hoteles recomendados
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {segment.hotelPlan.searchStatus === 'loading' ? (
                          <div className="planner-panel-fade-in">
                            <PlannerCircularLoadingState
                              label={`Buscando hoteles en ${formatDestinationLabel(segment.city)}`}
                              sublabel="Estamos consultando opciones reales para este destino."
                            />
                          </div>
                        ) : (
                          <>
                            <div className="planner-panel-fade-in">
                              <p className="trip-planner-body text-xs text-muted-foreground">{getHotelStatusText(segment)}</p>
                              {segment.hotelPlan.error && (
                                <p className="trip-planner-body text-xs text-destructive">{segment.hotelPlan.error}</p>
                              )}
                            </div>
                          </>
                        )}
                        {segment.hotelPlan.searchStatus !== 'loading' && !plannerState.isFlexibleDates && (segment.startDate || plannerState.startDate) && (segment.endDate || plannerState.endDate) && (
                          <div className="planner-panel-fade-in space-y-3">
                            {segment.hotelPlan.hotelRecommendations.slice(0, 3).map((hotel) => {
                              const hotelId = getPlannerHotelDisplayId(hotel);
                              const selected = segment.hotelPlan.selectedHotelId === hotelId;
                              const primaryRoom = getPrimaryPlannerHotelRoom(hotel);
                              const hotelCategory = formatPlannerHotelCategory(hotel.category);
                              const travelerSummary = formatPlannerTravelerSummary(hotel);
                              const totalPrice = formatPlannerPrice(primaryRoom?.total_price, primaryRoom?.currency);
                              const nightlyPrice = formatPlannerPrice(primaryRoom?.price_per_night, primaryRoom?.currency);
                              return (
                                <button
                                  key={hotelId}
                                  type="button"
                                  className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40'}`}
                                  onClick={() => void onSelectHotel(segment.id, hotelId)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="trip-planner-label text-sm font-semibold">{hotel.name}</p>
                                      <p className="trip-planner-body mt-1 text-xs text-muted-foreground">
                                        {hotel.address || formatDestinationLabel(hotel.city)}
                                      </p>
                                    </div>
                                    {hotelCategory && (
                                      <Badge variant={selected ? 'default' : 'secondary'} className="shrink-0 rounded-full px-2 py-0.5 text-[11px]">
                                        {hotelCategory}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                    <span>{formatDateRange(hotel.check_in, hotel.check_out)}</span>
                                    <span>{hotel.nights} noche{hotel.nights === 1 ? '' : 's'}</span>
                                    {travelerSummary && <span>{travelerSummary}</span>}
                                  </div>

                                  <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
                                    <p className="trip-planner-label text-xs font-medium text-foreground">
                                      {formatPlannerRoomLabel(hotel)}
                                    </p>
                                    {typeof primaryRoom?.availability === 'number' && (
                                      <p className="trip-planner-body mt-1 text-[11px] text-muted-foreground">
                                        Disponibilidad: {primaryRoom.availability}
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-end justify-between gap-3">
                                    <div>
                                      <p className="trip-planner-label text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                        Total
                                      </p>
                                      <p className="trip-planner-label text-sm font-semibold text-foreground">
                                        {totalPrice || 'Consultar'}
                                      </p>
                                    </div>
                                    {nightlyPrice && (
                                      <p className="trip-planner-body text-xs text-muted-foreground">
                                        {nightlyPrice} por noche
                                      </p>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {segmentIndex > 0 && (
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
                                sublabel={`Estamos consultando opciones reales entre ${formatDestinationLabel(plannerState.segments[segmentIndex - 1].city)} y ${formatDestinationLabel(segment.city)}.`}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="planner-panel-fade-in">
                                <p className="trip-planner-body text-xs text-muted-foreground">
                                  {getTransportStatusText(segment, plannerState.segments[segmentIndex - 1])}
                                </p>
                                {segment.transportIn?.error && (
                                  <p className="trip-planner-body text-xs text-destructive">{segment.transportIn.error}</p>
                                )}
                              </div>
                            </>
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
                                    className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40'}`}
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
                                          <p className="trip-planner-label text-xs font-medium text-foreground">
                                            {cabinLabel}
                                          </p>
                                        )}
                                        {baggageLabel && (
                                          <p className="trip-planner-body mt-1 text-[11px] text-muted-foreground">
                                            {baggageLabel}
                                          </p>
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
                                        <p className="trip-planner-body text-xs text-muted-foreground">
                                          {option.airline.code}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const assistantRail = (
    <div className="trip-planner-surface flex h-full flex-col border-l bg-background">
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 lg:inline-flex"
              onClick={handleCollapseAssistant}
              aria-label="Ocultar asistente"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <p className="trip-planner-title text-base font-semibold">Emilia Planificadora</p>
              <p className="trip-planner-body text-xs text-muted-foreground">
                Pedí cambios, reemplazos, mejoras o una regeneración completa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs lg:hidden"
              onClick={() => setMobileTab('plan')}
            >
              Ocultar chat
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {visibleMessages.map((msg) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              onPdfGenerated={onPdfGenerated}
              onOpenPlannerDateSelector={(request) => {
                setPendingPlannerDateRequest(request);
                setIsDateSelectionModalOpen(true);
              }}
            />
          ))}
          {isTyping && (
            <div className="trip-planner-body rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
              {typingMessage || 'Pensando...'}
            </div>
          )}
        </div>
      </div>
      <MessageInput
        value={message}
        onChange={onMessageChange}
        onSend={onSendMessage}
        disabled={isLoading}
        isUploadingPdf={isUploadingPdf}
        onPdfUpload={onPdfUpload}
        selectedConversation={selectedConversation}
      />
    </div>
  );

  return (
    <div className="h-full min-h-0 bg-background">
      <div className="hidden h-full lg:flex">
        <div className="relative min-h-0 min-w-0 flex-1">
          {isAssistantCollapsed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExpandAssistant}
              className="planner-assistant-reopen absolute top-4 right-4 z-20 gap-2 rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
              Mostrar asistente
            </Button>
          )}
          <div className="min-h-0 h-full">{plannerShell}</div>
        </div>
        {!isAssistantCollapsed && (
          <>
            <div
              className={`planner-assistant-resize-gutter ${isResizingAssistant ? 'planner-assistant-resize-gutter--active' : ''}`}
              onPointerDown={handleAssistantResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar asistente"
            />
            <div className="min-h-0 shrink-0 planner-assistant-rail" style={{ width: `${assistantWidth}px` }}>
              {assistantRail}
            </div>
          </>
        )}
      </div>

      <div className="flex h-full flex-col lg:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex h-full flex-col">
          <div className="border-b px-4 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="chat">Asistente</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="plan" className="mt-0 flex-1 min-h-0 overflow-hidden">
            {plannerShell}
          </TabsContent>
          <TabsContent value="chat" className="mt-0 flex-1 min-h-0 overflow-hidden">
            {assistantRail}
          </TabsContent>
        </Tabs>
      </div>

      <PlannerDateSelectionModal
        open={isDateSelectionModalOpen}
        onOpenChange={setIsDateSelectionModalOpen}
        initialDurationDays={pendingPlannerDateRequest?.itinerary?.days || plannerState?.days}
        initialMonthHint={pendingPlannerDateRequest?.originalMessage || plannerState?.summary}
        initialSelection={pendingPlannerDateRequest?.itinerary || (plannerState ? {
          startDate: plannerState.startDate,
          endDate: plannerState.endDate,
          isFlexibleDates: plannerState.isFlexibleDates,
          flexibleMonth: plannerState.flexibleMonth,
          flexibleYear: plannerState.flexibleYear,
          days: plannerState.days,
        } : undefined)}
        onConfirm={(selection) => {
          if (pendingPlannerDateRequest) {
            void onCompletePlannerDateSelection(pendingPlannerDateRequest, selection);
          } else {
            void onApplyPlannerDateSelection(selection);
          }
          setIsDateSelectionModalOpen(false);
          setPendingPlannerDateRequest(null);
        }}
      />
    </div>
  );
}
