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
import {
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  FileDown,
  GripVertical,
  Loader2,
  Lock,
  LockOpen,
  PanelRightClose,
  Plane,
  Plus,
  Trash2,
} from 'lucide-react';
import type { PlannerPlaceCandidate, PlannerPlaceCategory, PlannerPlaceHotelCandidate, TripPlannerState } from '../types';
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
  getPlannerFlightRoute,
  formatShortDate,
  buildPlannerPdfHtml,
} from '../utils';
import { getPlannerPlaceEmoji } from '../services/plannerPlaceMapper';
import TripPlannerMap from './TripPlannerMap';
import PlannerDateSelectionModal from './PlannerDateSelectionModal';
import PlannerMapPlaceAssignModal from './PlannerMapPlaceAssignModal';
import PlannerCircularLoadingState from './PlannerCircularLoadingState';
import PlannerHotelInventorySection from './PlannerHotelInventorySection';
import TripPlannerStarterTemplate from './TripPlannerStarterTemplate';
import TripPlannerWorkspaceSkeleton from './TripPlannerWorkspaceSkeleton';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

const PLANNER_MAP_FILTERS: PlannerPlaceCategory[] = ['hotel', 'restaurant', 'cafe', 'museum', 'activity'];
type PlannerPlacesByCategory = Record<PlannerPlaceCategory, PlannerPlaceCandidate[]>;
const DEFAULT_MAP_ACTIVE_CATEGORIES: Record<PlannerPlaceCategory, boolean> = {
  hotel: true,
  restaurant: true,
  cafe: true,
  museum: true,
  activity: true,
};

const PLANNER_MAP_FILTER_LABELS: Record<PlannerPlaceCategory, string> = {
  hotel: 'Hoteles',
  restaurant: 'Restaurantes',
  cafe: 'Cafes',
  museum: 'Museos',
  activity: 'Que hacer',
};

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
  onEnsureSegmentEnriched: (segmentId: string) => Promise<void>;
  onToggleDayLock: (segmentId: string, dayId: string) => Promise<void>;
  onToggleActivityLock: (segmentId: string, dayId: string, block: 'morning' | 'afternoon' | 'evening', activityId: string) => Promise<void>;
  onSelectHotel: (segmentId: string, hotelId: string) => Promise<void>;
  onSelectHotelPlaceFromMap: (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => Promise<void>;
  onAddPlaceToPlanner: (segmentId: string, input: {
    place: PlannerPlaceCandidate;
    dayId: string;
    block: 'morning' | 'afternoon' | 'evening';
  }) => Promise<void>;
  onAutoFillSegmentWithRealPlaces: (segmentId: string, placesByCategory: PlannerPlacesByCategory) => Promise<void>;
  onResolveInventoryMatch: (segmentId: string) => Promise<void>;
  onConfirmInventoryHotelMatch: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
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
  onEnsureSegmentEnriched,
  onToggleDayLock,
  onToggleActivityLock,
  onSelectHotel,
  onSelectHotelPlaceFromMap,
  onAddPlaceToPlanner,
  onAutoFillSegmentWithRealPlaces,
  onResolveInventoryMatch,
  onConfirmInventoryHotelMatch,
  onRefreshQuotedHotel,
  onSelectTransportOption,
  onCompletePlannerDateSelection,
}: TripPlannerWorkspaceProps) {
  const ASSISTANT_WIDTH_DEFAULT = 640;
  const ASSISTANT_WIDTH_MIN = 560;
  const ASSISTANT_WIDTH_MAX = 920;
  const ASSISTANT_WIDTH_STORAGE_KEY = 'tripPlannerAssistantWidth';
  const ASSISTANT_COLLAPSED_STORAGE_KEY = 'tripPlannerAssistantCollapsed';
  const [newDestination, setNewDestination] = useState('');
  const [activeHeaderPanel, setActiveHeaderPanel] = useState<'destinations' | null>(null);
  const [mobileTab, setMobileTab] = useState('plan');
  const [pendingPlannerDateRequest, setPendingPlannerDateRequest] = useState<ParsedTravelRequest | null>(null);
  const [pendingMapPlaceAssignment, setPendingMapPlaceAssignment] = useState<{
    segmentId: string;
    place: PlannerPlaceCandidate;
  } | null>(null);
  const [mapActiveCategories, setMapActiveCategories] = useState<Record<PlannerPlaceCategory, boolean>>(DEFAULT_MAP_ACTIVE_CATEGORIES);
  const [isDateSelectionModalOpen, setIsDateSelectionModalOpen] = useState(false);
  const [draggedSegmentId, setDraggedSegmentId] = useState<string | null>(null);
  const [dropTargetSegmentId, setDropTargetSegmentId] = useState<string | null>(null);
  const [isReorderingRoute, setIsReorderingRoute] = useState(false);
  const [assistantWidth, setAssistantWidth] = useState(ASSISTANT_WIDTH_DEFAULT);
  const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);
  const [isResizingAssistant, setIsResizingAssistant] = useState(false);
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
      setAssistantWidth(clampAssistantWidth(Math.max(parsedWidth, ASSISTANT_WIDTH_DEFAULT)));
    }

    const storedCollapsed = window.localStorage.getItem(ASSISTANT_COLLAPSED_STORAGE_KEY);
    setIsAssistantCollapsed(storedCollapsed === 'true');
  }, [ASSISTANT_WIDTH_DEFAULT, clampAssistantWidth]);

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

  const toggleHeaderDestinationsPanel = useCallback(() => {
    setActiveHeaderPanel((current) => current === 'destinations' ? null : 'destinations');
  }, []);

  const handleSelectSegmentFromMap = useCallback((segmentId: string) => {
    const target = document.getElementById(`planner-segment-${segmentId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    setMapActiveCategories(DEFAULT_MAP_ACTIVE_CATEGORIES);
  }, [selectedConversation]);

  const destinationLabels = useMemo(
    () => plannerState?.segments.map((segment) => formatDestinationLabel(segment.city)) ?? [],
    [plannerState]
  );

  const isDraftPlanner = Boolean(plannerState?.generationMeta?.isDraft);
  const plannerDateSummary = plannerState?.isFlexibleDates
    ? formatFlexibleMonth(plannerState.flexibleMonth, plannerState.flexibleYear)
    : formatDateRange(plannerState?.startDate, plannerState?.endDate);
  const hasExactPlannerDates = Boolean(plannerState?.startDate && plannerState?.endDate && !plannerState?.isFlexibleDates);
  useEffect(() => {
    if (!plannerState || isDraftPlanner) {
      return;
    }

    const hasPendingSegmentRequest = plannerState.segments.some((segment) => segment.contentStatus === 'loading');
    if (hasPendingSegmentRequest) {
      return;
    }

    const nextSkeletonSegment = plannerState.segments.find((segment) => segment.contentStatus === 'skeleton');
    if (!nextSkeletonSegment) {
      return;
    }

    void onEnsureSegmentEnriched(nextSkeletonSegment.id);
  }, [isDraftPlanner, onEnsureSegmentEnriched, plannerState]);

  const handleExportPdf = useCallback(() => {
    if (!plannerState) return;
    const html = buildPlannerPdfHtml(plannerState);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, [plannerState]);

  const plannerLoadingPhase = useMemo(() => {
    if (!plannerState && !isLoadingPlanner) return null;
    if (activePlannerMutation) return { busy: true, steps: [] as { label: string; status: 'done' | 'active' | 'pending' }[] };

    type Step = { label: string; status: 'done' | 'active' | 'pending' };
    const steps: Step[] = [];

    // Step 1: Itinerary generation
    const isDraftGenerating = isDraftPlanner && plannerState?.generationMeta?.uiPhase === 'draft_generating';
    if (isDraftPlanner) {
      steps.push({
        label: 'Armando el itinerario',
        status: isDraftGenerating ? 'active' : 'done',
      });
    }

    if (!plannerState || isDraftGenerating) {
      return steps.length > 0 ? { busy: true, steps } : isLoadingPlanner ? { busy: true, steps: [{ label: 'Abriendo tu planner', status: 'active' as const }] } : null;
    }

    // Step 2: Geocoding
    const allHaveLocation = plannerState.segments.every((s) => s.location);
    if (isResolvingLocations || !allHaveLocation) {
      steps.push({
        label: `Ubicando ${plannerState.segments.length} destinos en el mapa`,
        status: isResolvingLocations ? 'active' : allHaveLocation ? 'done' : 'pending',
      });
    } else if (plannerState.segments.length > 0) {
      steps.push({ label: `${plannerState.segments.length} destinos ubicados`, status: 'done' });
    }

    // Step 3: Hotels
    const hotelsLoading = plannerState.segments.filter((s) => s.hotelPlan.searchStatus === 'loading');
    const hotelsReady = plannerState.segments.filter((s) => s.hotelPlan.searchStatus === 'ready' || s.hotelPlan.searchStatus === 'error');
    const hotelsTotal = plannerState.segments.length;
    if (hasExactPlannerDates && !isDraftPlanner) {
      if (hotelsLoading.length > 0) {
        const currentCity = hotelsLoading[0] ? formatDestinationLabel(hotelsLoading[0].city) : '';
        steps.push({ label: `Consultando hoteles en ${currentCity} (${hotelsReady.length}/${hotelsTotal})`, status: 'active' });
      } else if (hotelsReady.length === hotelsTotal) {
        steps.push({ label: `Hoteles listos en ${hotelsTotal} destinos`, status: 'done' });
      } else {
        steps.push({ label: 'Hoteles listos para buscar', status: 'pending' });
      }
    }

    // Step 4: Transport
    const transportSegments = plannerState.segments.slice(1);
    const transportLoading = transportSegments.filter((s) => s.transportIn?.searchStatus === 'loading');
    const transportReady = transportSegments.filter((s) => s.transportIn?.searchStatus === 'ready' || s.transportIn?.searchStatus === 'error');
    if (hasExactPlannerDates && !isDraftPlanner && transportSegments.length > 0) {
      if (transportLoading.length > 0) {
        const currentRoute = transportLoading[0]
          ? `${formatDestinationLabel(transportLoading[0].transportIn?.origin || '')} → ${formatDestinationLabel(transportLoading[0].city)}`
          : '';
        steps.push({ label: `Consultando transporte ${currentRoute} (${transportReady.length}/${transportSegments.length})`, status: 'active' });
      } else if (transportReady.length === transportSegments.length) {
        steps.push({ label: `Transporte listo en ${transportSegments.length} tramos`, status: 'done' });
      } else {
        steps.push({ label: 'Transporte listo para buscar', status: 'pending' });
      }
    }

    const busy = steps.some((s) => s.status === 'active' || s.status === 'pending');
    if (!busy) return null;
    // Only keep done steps that precede an active/pending one (context), drop trailing dones
    const lastActiveIndex = steps.reduce((acc, s, i) => (s.status !== 'done' ? i : acc), -1);
    const visibleSteps = steps.filter((_, i) => i <= lastActiveIndex);
    return { busy, steps: visibleSteps };
  }, [activePlannerMutation, hasExactPlannerDates, isDraftPlanner, isLoadingPlanner, isResolvingLocations, plannerState]);

  const getHotelStatusText = (segment: TripPlannerState['segments'][number]) => {
    if (isDraftPlanner) {
      return 'Cuando termine el borrador, acá vas a poder pasar de idea a precio real.';
    }

    const hasDates = Boolean((segment.startDate || plannerState?.startDate) && (segment.endDate || plannerState?.endDate));

    if (plannerState?.isFlexibleDates || !hasDates) {
      return 'Definí fechas exactas y te muestro hoteles reales para este tramo.';
    }
    if (segment.hotelPlan.searchStatus === 'error') {
      return 'No pude traer hoteles reales para este destino. Probá de nuevo en un momento.';
    }
    if (segment.hotelPlan.searchStatus === 'loading') {
      return 'Estoy buscando hoteles reales para este destino...';
    }
    if (segment.hotelPlan.searchStatus === 'ready' && segment.hotelPlan.hotelRecommendations.length > 0) {
      return `${segment.hotelPlan.hotelRecommendations.length} opciones reales para comparar`;
    }
    if (segment.hotelPlan.searchStatus === 'ready') {
      return 'No encontré hoteles para este tramo con las fechas actuales. Probá ajustar fechas o destino.';
    }
    return 'Estoy preparando la búsqueda de hoteles para este destino...';
  };

  const getTransportStatusText = (
    segment: TripPlannerState['segments'][number],
    previousSegment?: TripPlannerState['segments'][number]
  ) => {
    if (isDraftPlanner) {
      return 'Cuando el recorrido quede listo, acá vas a ver opciones reales entre destinos.';
    }

    if (segment.transportIn?.searchStatus === 'error') {
      return 'No pude traer transporte para este tramo. Probá de nuevo en un momento.';
    }
    if (segment.transportIn?.searchStatus === 'ready') {
      const optionCount = segment.transportIn.options?.length || 0;
      return optionCount > 0
        ? `${optionCount} opciones reales para este tramo`
        : 'No encontré transporte con la información actual. Conviene revisar fechas o ciudades.';
    }
    return previousSegment
      ? `Cuando quieras cotizar, voy a buscar opciones entre ${formatDestinationLabel(previousSegment.city)} y ${formatDestinationLabel(segment.city)}.`
      : 'Cuando quieras cotizar, voy a buscar opciones reales para este tramo.';
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

  const latestUserPrompt = useMemo(() => {
    const latestUserMessage = [...visibleMessages]
      .reverse()
      .find((item) => item.role === 'user');

    if (!latestUserMessage) return undefined;

    const content = latestUserMessage.content as { text?: string } | string | null;
    if (typeof content === 'string') {
      return content;
    }

    return content?.text;
  }, [visibleMessages]);

  const DRAFT_GENERATING_PHRASES = useMemo(() => [
    'Estoy ordenando destinos y noches por ciudad...',
    'Estoy armando un día a día claro para cada tramo...',
    'Estoy sumando paradas para comer y descansar...',
    'Estoy eligiendo actividades que encajen con el ritmo del viaje...',
    'Estoy acomodando tiempos para que el recorrido sea viable...',
    'Estoy preparando tips útiles para cada ciudad...',
    'Estoy ajustando el orden del recorrido...',
    'Estoy cerrando los últimos detalles del itinerario...',
  ], []);

  const isDraftGenerating = isDraftPlanner && plannerState?.generationMeta?.uiPhase === 'draft_generating';
  const [draftPhraseIndex, setDraftPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isDraftGenerating) {
      setDraftPhraseIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setDraftPhraseIndex((i) => (i + 1) % DRAFT_GENERATING_PHRASES.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [isDraftGenerating, DRAFT_GENERATING_PHRASES]);

  const draftProgress = useMemo(() => {
    if (!plannerState || !isDraftPlanner) {
      return null;
    }

    if (plannerState.generationMeta?.uiPhase === 'draft_generating') {
      return {
        label: 'Armando tu itinerario',
        description: typingMessage || 'Estoy convirtiendo tu pedido en un planner editable con ruta, días y sugerencias.',
        generating: true,
      };
    }

    if (!plannerState.startDate && !plannerState.endDate && !plannerState.isFlexibleDates) {
      return {
        label: 'Primer borrador listo',
        description: 'Ya interpreté destinos y preferencias. Sumá fechas para habilitar precios reales cuando quieras cotizar.',
      };
    }

    return {
      label: 'Leyendo tu pedido',
      description: 'Estoy transformando tu mensaje en un planner ordenado y editable antes de mostrar la versión final.',
    };
  }, [isDraftPlanner, plannerState, typingMessage]);

  const shouldShowInitialPlannerSkeleton = !plannerState && isLoadingPlanner;

  const plannerShell = (
    shouldShowInitialPlannerSkeleton ? (
      <TripPlannerWorkspaceSkeleton />
    ) : (
    <div className="trip-planner-surface @container flex flex-col gap-4 overflow-y-auto p-4 lg:p-6">
      {!plannerState ? (
        <TripPlannerStarterTemplate
          mode={isLoading || isTyping ? 'processing' : 'idle'}
          promptPreview={latestUserPrompt}
          typingMessage={typingMessage}
          plannerError={plannerError}
        />
      ) : (
        <>
	          <Card className="overflow-hidden border-primary/15 shadow-sm">
	            <CardContent className="space-y-6 p-4 md:p-6">
	              <div className="space-y-4">
		                <div className="w-full overflow-x-auto">
		                    <div className="flex min-w-full flex-wrap items-center rounded-[28px] border border-border/70 bg-background/90 p-1 shadow-sm xl:flex-nowrap">
		                      <button
		                        type="button"
		                        onClick={toggleHeaderDestinationsPanel}
		                        disabled={isDraftPlanner}
		                        className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${activeHeaderPanel === 'destinations' ? 'bg-foreground text-background shadow-sm' : 'text-foreground hover:bg-muted'} ${isDraftPlanner ? 'cursor-default opacity-80' : ''}`}
		                        aria-label="Editar destinos"
		                      >
		                        <span>{plannerState.segments.length} destinos</span>
		                        <ChevronRight className={`h-4 w-4 transition ${activeHeaderPanel === 'destinations' ? 'rotate-90' : ''}`} />
		                      </button>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <button
		                        type="button"
		                        disabled={isDraftPlanner}
		                        onClick={() => {
		                          setPendingPlannerDateRequest(null);
		                          setIsDateSelectionModalOpen(true);
		                        }}
		                        className={`flex min-w-[10.75rem] items-center rounded-full px-4 py-2 text-left text-sm font-medium transition whitespace-nowrap xl:min-w-[11.5rem] ${isDraftPlanner ? 'cursor-default opacity-80' : 'text-foreground hover:bg-muted'}`}
		                        aria-label="Editar fechas"
		                      >
		                        {plannerDateSummary}
		                      </button>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <div className="flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium text-foreground whitespace-nowrap">
		                        {hasExactPlannerDates ? (
		                          <span>{plannerState.days} días</span>
		                        ) : (
		                          <div className="flex items-center gap-2">
		                            <Input
		                              type="number"
		                              min={1}
		                              value={plannerState.days}
		                              onChange={(event) => void onUpdateTripField('days', Math.max(1, Number(event.target.value) || 1) as TripPlannerState['days'])}
		                              disabled={isDraftPlanner}
		                              className="h-7 w-14 border-0 bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus-visible:ring-0"
		                            />
		                            <span>días</span>
		                          </div>
		                        )}
		                      </div>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <div className="shrink-0">
		                        <Select
		                          value={plannerState.budgetLevel || 'mid'}
		                          disabled={isDraftPlanner}
		                          onValueChange={(value) => void onUpdateTripField('budgetLevel', value as TripPlannerState['budgetLevel'])}
		                        >
		                          <SelectTrigger className="h-auto w-[6.75rem] rounded-full border-0 bg-transparent px-4 py-2 text-center text-sm font-medium text-foreground shadow-none focus:ring-0">
		                            <SelectValue placeholder="Presupuesto" />
		                          </SelectTrigger>
		                          <SelectContent>
		                            <SelectItem value="low">{formatBudgetLevel('low')}</SelectItem>
		                            <SelectItem value="mid">{formatBudgetLevel('mid')}</SelectItem>
		                            <SelectItem value="high">{formatBudgetLevel('high')}</SelectItem>
		                            <SelectItem value="luxury">{formatBudgetLevel('luxury')}</SelectItem>
		                          </SelectContent>
		                        </Select>
		                      </div>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <div className="shrink-0">
		                        <Select
		                          value={plannerState.pace || 'balanced'}
		                          disabled={isDraftPlanner}
		                          onValueChange={(value) => void onUpdateTripField('pace', value as TripPlannerState['pace'])}
		                        >
		                          <SelectTrigger className="h-auto w-[8rem] rounded-full border-0 bg-transparent px-4 py-2 text-center text-sm font-medium text-foreground shadow-none focus:ring-0">
		                            <SelectValue placeholder="Ritmo" />
		                          </SelectTrigger>
		                          <SelectContent>
		                            <SelectItem value="relaxed">{formatPaceLabel('relaxed')}</SelectItem>
		                            <SelectItem value="balanced">{formatPaceLabel('balanced')}</SelectItem>
		                            <SelectItem value="fast">{formatPaceLabel('fast')}</SelectItem>
		                          </SelectContent>
		                        </Select>
		                      </div>
		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:ml-auto xl:block" />
		                      <button
		                        type="button"
		                        disabled={isDraftPlanner}
		                        onClick={handleExportPdf}
		                        className={`ml-auto flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${isDraftPlanner ? 'cursor-default opacity-80' : 'text-foreground hover:bg-muted'}`}
		                        aria-label="Exportar planner en PDF"
		                      >
		                        <FileDown className="h-4 w-4" />
		                        <span>Exportar PDF</span>
		                      </button>
		                    </div>
	                </div>

	                {activeHeaderPanel === 'destinations' && (
	                  <div className="planner-panel-fade-in rounded-2xl border bg-muted/20 p-4 md:p-5">
	                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
	                      <div className="space-y-2">
	                        <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
	                          Destinos
	                        </p>
	                        <p className="trip-planner-body text-xs text-muted-foreground">
	                          {isReorderingRoute
	                            ? 'Reordenando y recalculando la ruta...'
	                            : isDraftPlanner
	                              ? 'Cuando termine el borrador vas a poder editar la ruta y sumar destinos manualmente.'
	                              : 'Arrastrá los destinos para cambiar el orden.'}
	                        </p>
	                      </div>
	                      <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
	                        {plannerState.segments.length}
	                      </Badge>
	                    </div>

	                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
	                      {plannerState.segments.map((segment, index) => (
	                        <div
	                          key={segment.id}
	                          draggable={!isDraftPlanner && !isReorderingRoute && !isLoadingPlanner}
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
	                            disabled={isDraftPlanner}
	                            onClick={() => void onRemoveDestination(segment.id)}
	                            aria-label={`Eliminar ${formatDestinationLabel(segment.city)}`}
	                          >
	                            <Trash2 className="h-3.5 w-3.5" />
	                          </button>
	                        </div>
	                      ))}
	                    </div>

	                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
	                      <Input
	                        value={newDestination}
	                        placeholder="Agregar destino"
	                        onChange={(event) => setNewDestination(event.target.value)}
	                        className="h-10 bg-background/80"
	                        disabled={isDraftPlanner}
	                      />
	                      <Button
	                        onClick={() => {
	                          void onAddDestination(newDestination);
	                          setNewDestination('');
	                        }}
	                        disabled={isDraftPlanner || !newDestination.trim() || isReorderingRoute || isLoadingPlanner}
	                        className="h-10 sm:min-w-[120px]"
	                      >
	                        <Plus className="mr-2 h-4 w-4" />
	                        Agregar
	                      </Button>
	                    </div>
	                  </div>
	                )}

	                <div className="space-y-2">
	                  <Input
	                    value={plannerState.title}
	                    onChange={(event) => {
	                      if (isDraftPlanner) return;
                      void onUpdateTripField('title', event.target.value);
                    }}
                    readOnly={isDraftPlanner}
                    className="trip-planner-title h-auto border-0 px-0 text-3xl font-semibold shadow-none focus-visible:ring-0 md:text-4xl"
                  />
                  <p className="trip-planner-body max-w-3xl text-sm leading-6 text-muted-foreground">{plannerState.summary}</p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {PLANNER_MAP_FILTERS.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                          mapActiveCategories[category]
                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                        onClick={() => setMapActiveCategories((current) => ({ ...current, [category]: !current[category] }))}
                      >
                        <span className="mr-1">{getPlannerPlaceEmoji(category)}</span>
                        {PLANNER_MAP_FILTER_LABELS[category]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {draftProgress && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                      {draftProgress.label}
                    </Badge>
                    {plannerState.generationMeta?.draftOriginMessage && (
                      <span className="trip-planner-body text-xs text-muted-foreground">
                        {plannerState.generationMeta.draftOriginMessage}
                      </span>
                    )}
                  </div>
                  <p className="trip-planner-body mt-2 text-xs text-muted-foreground">{draftProgress.description}</p>
                  {draftProgress.generating && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span className="text-xs font-medium text-primary">Generando itinerario...</span>
                    </div>
                  )}
                </div>
              )}

              {!draftProgress && plannerLoadingPhase && plannerLoadingPhase.steps.length > 0 && (
                <div className="planner-panel-fade-in rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {plannerLoadingPhase.steps.map((step) => (
                      <span key={step.label} className="flex items-center gap-1.5 text-xs">
                        {step.status === 'done' ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15">
                            <Check className="h-2.5 w-2.5 text-primary" />
                          </span>
                        ) : step.status === 'active' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                        )}
                        <span className={`trip-planner-body ${step.status === 'active' ? 'font-medium text-foreground' : step.status === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                          {step.label}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="w-full">
                <TripPlannerMap
                  segments={plannerState.segments}
                  days={plannerState.days}
                  activeCategories={mapActiveCategories}
                  isResolvingLocations={isResolvingLocations}
                  locationWarning={plannerLocationWarning}
                  draftPhrase={isDraftGenerating ? DRAFT_GENERATING_PHRASES[draftPhraseIndex] : null}
                  onSelectSegment={handleSelectSegmentFromMap}
                  onAddHotelToSegment={isDraftPlanner
                    ? undefined
                    : ((segmentId, placeCandidate) => void onSelectHotelPlaceFromMap(segmentId, placeCandidate))}
                  onRequestAddPlaceToPlanner={isDraftPlanner
                    ? undefined
                    : ((payload) => setPendingMapPlaceAssignment(payload))}
                  onAutoFillRealPlaces={isDraftPlanner
                    ? undefined
                    : ((payload) => void onAutoFillSegmentWithRealPlaces(payload.segmentId, payload.placesByCategory))}
                />
              </div>

            </CardContent>
          </Card>

          <div className="grid gap-4">
            {plannerState.segments.map((segment, segmentIndex) => (
              <Card
                key={segment.id}
                id={`planner-segment-${segment.id}`}
                className="relative overflow-hidden"
                ref={(node) => {
                  segmentRefs.current[segment.id] = node;
                }}
                data-segment-id={segment.id}
              >
                {segment.contentStatus === 'loading' && (
                  <div className="planner-segment-progress pointer-events-none absolute inset-x-4 top-0 z-10 h-[3px] rounded-b-full">
                    <div className="planner-segment-progress__bar h-full" />
                  </div>
                )}
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex flex-col gap-3 @xl:flex-row @xl:items-start @xl:justify-between">
                    <div>
                      <CardTitle className="trip-planner-title text-lg">
                        {segmentIndex + 1}. {formatDestinationLabel(segment.city)}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="trip-planner-body text-sm text-muted-foreground">
                          {formatDateRange(segment.startDate, segment.endDate)}
                          {segment.summary ? ` • ${segment.summary}` : ''}
                        </p>
                        {segment.contentStatus === 'skeleton' && (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                            Resumen base
                          </Badge>
                        )}
                        {segment.contentStatus === 'loading' && (
                          <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Completando
                          </Badge>
                        )}
                        {segment.contentStatus === 'error' && (
                          <Badge variant="outline" className="rounded-full border-destructive/30 px-2 py-0.5 text-[11px] text-destructive">
                            Pendiente
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {segment.contentStatus === 'error' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onEnsureSegmentEnriched(segment.id)}
                          disabled={isDraftPlanner || isLoadingPlanner}
                        >
                          <Bot className="h-4 w-4 mr-2" />
                          Reintentar tramo
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-4 @4xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-4">
                    {segment.days.length === 0 ? (
                      <div className="trip-planner-body rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        {isDraftPlanner
                          ? 'Estamos completando este destino a partir de tu prompt. En cuanto termine la generación vas a ver días, actividades y recomendaciones.'
                          : 'Este destino todavía no tiene días generados. Regenerá el planificador para completarlo.'}
                      </div>
                    ) : segment.contentStatus !== 'ready' ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                          <div className="flex items-start gap-3">
                            {segment.contentStatus === 'loading' ? (
                              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-primary" />
                            ) : (
                              <Bot className="mt-0.5 h-4 w-4 text-primary" />
                            )}
                            <div className="space-y-1.5">
                              <p className="trip-planner-label text-sm font-medium text-foreground">
                                {segment.contentStatus === 'error'
                                  ? 'No pudimos completar este tramo todavía'
                                  : 'Estamos completando este tramo a medida que lo abrís'}
                              </p>
                              <p className="trip-planner-body text-xs text-muted-foreground">
                                {segment.contentError
                                  || 'Ya dejamos la estructura del viaje. Ahora sumamos actividades, comidas y tips reales para este destino.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {segment.highlights && segment.highlights.length > 0 && (
                          <div className="rounded-xl border bg-background/80 p-4">
                            <p className="trip-planner-label text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Principales actividades
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {segment.highlights.map((highlight) => (
                                <Badge
                                  key={`${segment.id}-${highlight}`}
                                  variant="secondary"
                                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                                >
                                  {highlight}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {segment.days.map((day) => (
                          <div key={day.id} className="rounded-xl border bg-background p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                                Día {day.dayNumber}
                              </Badge>
                              {day.date && (
                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                                  {formatShortDate(day.date)}
                                </Badge>
                              )}
                              <p className="trip-planner-label text-sm font-medium">{day.title}</p>
                            </div>
                            <p className="trip-planner-body mt-2 text-xs text-muted-foreground">
                              {day.summary || 'Base del día lista. Vamos a completar mañana, tarde y noche en este tramo.'}
                            </p>
                          </div>
                        ))}
                      </div>
	                    ) : (
	                      <div className="space-y-4">
	                        {segment.highlights && segment.highlights.length > 0 && (
	                          <div className="rounded-xl border bg-background/80 p-4">
	                            <p className="trip-planner-label text-xs font-semibold uppercase tracking-wide text-muted-foreground">
	                              Principales actividades
	                            </p>
	                            <div className="mt-3 flex flex-wrap gap-2">
	                              {segment.highlights.map((highlight) => (
	                                <Badge
	                                  key={`${segment.id}-ready-${highlight}`}
	                                  variant="secondary"
	                                  className="rounded-full px-3 py-1 text-[11px] font-medium"
	                                >
	                                  {highlight}
	                                </Badge>
	                              ))}
	                            </div>
	                          </div>
	                        )}
	                        {segment.days.map((day) => (
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
                                  variant="ghost"
                                  size="sm"
                                  disabled={isDraftPlanner}
                                  onClick={() => void onToggleDayLock(segment.id, day.id)}
                                >
                                  {day.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="grid gap-4 @xl:grid-cols-3">
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
	                                          {activity.source === 'google_maps' && (
	                                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
	                                              Lugar real
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
                                        disabled={isDraftPlanner}
                                        onClick={() => void onToggleActivityLock(segment.id, day.id, block, activity.id)}
                                      >
                                        {activity.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {day.restaurants.length > 0 && (
                              <div className="@xl:col-span-3 space-y-2 rounded-xl border border-dashed p-3">
                                <p className="trip-planner-label text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Restaurantes guardados
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {day.restaurants.map((restaurant) => (
                                    <div key={restaurant.id} className="rounded-full border bg-muted/35 px-3 py-1.5 text-xs text-foreground">
                                      <span className="font-medium">{restaurant.name}</span>
                                      {restaurant.type ? ` • ${restaurant.type}` : ''}
                                      {restaurant.source === 'google_maps' ? ' • Google Maps' : ''}
                                    </div>
                                  ))}
                                </div>
                              </div>
	                            )}
	                          </CardContent>
	                        </Card>
	                      ))}
	                      </div>
	                    )}
	                  </div>

                  <div className="space-y-4">
                    <PlannerHotelInventorySection
                      segment={segment}
                      disabled={isDraftPlanner}
                      hasExactDates={!plannerState.isFlexibleDates && Boolean((segment.startDate || plannerState.startDate) && (segment.endDate || plannerState.endDate))}
                      travelers={plannerState.travelers}
                      statusText={getHotelStatusText(segment)}
                      onSelectHotel={onSelectHotel}
                      onResolveInventoryMatch={onResolveInventoryMatch}
                      onConfirmInventoryHotelMatch={onConfirmInventoryHotelMatch}
                      onRefreshQuotedHotel={onRefreshQuotedHotel}
                    />

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
                                    className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40'} ${isDraftPlanner ? 'cursor-not-allowed opacity-70' : ''}`}
                                    disabled={isDraftPlanner}
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
    )
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
                Pedime ajustes en días, hoteles, ritmo, presupuesto o tramos.
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
              {typingMessage || 'Estoy trabajando en tu pedido...'}
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
    <div className="h-full min-h-0 bg-background relative">
      {plannerLoadingPhase?.busy && (
        <div className="planner-global-progress absolute inset-x-0 top-0 z-50 h-[3px]" aria-hidden="true">
          <div className="planner-global-progress__bar h-full w-full bg-primary/80" />
        </div>
      )}
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

      <PlannerMapPlaceAssignModal
        open={Boolean(pendingMapPlaceAssignment)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMapPlaceAssignment(null);
          }
        }}
        plannerState={plannerState}
        place={pendingMapPlaceAssignment?.place || null}
        initialSegmentId={pendingMapPlaceAssignment?.segmentId}
        onConfirm={async (selection) => {
          if (!pendingMapPlaceAssignment) return;
          await onAddPlaceToPlanner(selection.segmentId, {
            place: pendingMapPlaceAssignment.place,
            dayId: selection.dayId,
            block: selection.block,
          });
          setPendingMapPlaceAssignment(null);
        }}
      />
    </div>
  );
}
