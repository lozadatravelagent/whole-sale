import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MessageInput from '@/features/chat/components/MessageInput';
import MessageItem from '@/features/chat/components/MessageItem';
import type { LocalHotelData, MessageRow } from '@/features/chat/types/chat';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileDown,
  GripVertical,
  Hotel,
  Loader2,
  PanelRightClose,
  Plane,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  PlannerActivity,
  PlannerPlaceCandidate,
  PlannerPlaceCategory,
  PlannerPlaceHotelCandidate,
  TripPlannerState,
} from '../types';
import {
  formatBudgetLevel,
  formatDateRange,
  formatDayBlockLabel,
  formatDestinationLabel,
  formatFlexibleMonth,
  formatPaceLabel,
  getPlannerHotelDisplayId,
  isEurovipsInventoryHotel,
  formatShortDate,
  buildPlannerPdfHtml,
  haversineDistanceKm,
} from '../utils';
import { getPlannerPlaceCategoryLabel, getPlannerPlaceEmoji } from '../services/plannerPlaceMapper';
import PlannerContextSidebar from './PlannerContextSidebar';
import type { PlaceDetailData } from './PlannerPlaceDetailPanel';
import TripPlannerMap from './TripPlannerMap';
import PlannerDateSelectionModal from './PlannerDateSelectionModal';
import PlannerMapPlaceAssignModal from './PlannerMapPlaceAssignModal';
import PlannerChatDestinationCards from './PlannerChatDestinationCards';
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

type PlannerRailTab = 'hotels' | 'transport';

interface PlannerHotelDetailState {
  segmentId: string;
  hotelId: string;
}

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

interface DayCardItem {
  id: string;
  title: string;
  photo?: string;
  category?: string;
  rating?: number;
  userRatingsTotal?: number;
  description?: string;
  slot?: 'morning' | 'afternoon' | 'evening';
  time?: string;
  activityType?: PlannerActivity['activityType'];
  placeId?: string;
  formattedAddress?: string;
}

const SLOT_GRADIENT: Record<string, string> = {
  morning: 'from-amber-100 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20',
  afternoon: 'from-sky-100 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/20',
  evening: 'from-indigo-100 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/20',
};

const ACTIVITY_TYPE_GRADIENT: Record<string, string> = {
  food: 'from-orange-200 to-amber-100 dark:from-orange-950/50 dark:to-amber-950/30',
  hotel: 'from-blue-200 to-sky-100 dark:from-blue-950/50 dark:to-sky-950/30',
  transport: 'from-slate-200 to-gray-100 dark:from-slate-950/50 dark:to-gray-950/30',
};

const SLOT_LABEL: Record<string, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
};

const ACTIVITY_EMOJI: Record<string, string> = {
  museum: '🏛️',
  landmark: '🏰',
  walk: '🚶',
  food: '🍽️',
  market: '🛒',
  nightlife: '🌙',
  shopping: '🛍️',
  nature: '🌿',
  family: '👨‍👩‍👧‍👦',
  wellness: '🧘',
  transport: '🚌',
  hotel: '🏨',
  viewpoint: '👀',
  culture: '🎭',
  experience: '✨',
  unknown: '📍',
};

function DayCarousel({ items, dayId, onCardClick, onAddToDay, suggestions, onLoadMore, hasMore }: { items: DayCardItem[]; dayId: string; onCardClick?: (itemId: string) => void; onAddToDay?: (itemId: string) => void; suggestions?: DayCardItem[]; onLoadMore?: () => void; hasMore?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState, items.length, suggestions?.length]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  }, []);

  const allItems = (suggestions ? [...items, ...suggestions] : items).slice(0, 8);
  if (allItems.length === 0) return null;

  return (
    <div className="group/carousel relative -mx-1">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute -left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-lg opacity-0 transition-opacity group-hover/carousel:opacity-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute -right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-lg opacity-0 transition-opacity group-hover/carousel:opacity-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth px-1 py-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {allItems.map((item) => (
          <div
            key={`${dayId}-${item.id}`}
            className="group/card relative w-[calc(33.333%-8px)] min-w-[260px] flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-background shadow-md transition-shadow hover:shadow-xl"
            onClick={() => onCardClick?.(item.id)}
          >
            {onAddToDay && item.placeId && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAddToDay(item.id); }}
                className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-primary hover:text-white hover:scale-110 opacity-0 group-hover/card:opacity-100"
                aria-label="Agregar al itinerario"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            {item.photo ? (
              <div className="relative">
                <img
                  src={item.photo}
                  alt={item.title}
                  className="h-36 w-full object-cover"
                />
                {item.category && (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm">
                    {item.category}
                  </span>
                )}
              </div>
            ) : (
              <div className={`relative flex h-28 items-end bg-gradient-to-br ${(item.activityType && ACTIVITY_TYPE_GRADIENT[item.activityType]) || SLOT_GRADIENT[item.slot || 'morning'] || SLOT_GRADIENT.morning}`}>
                {item.category && (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm">
                    {item.category}
                  </span>
                )}
              </div>
            )}
            <div className="space-y-1 p-3">
              <div className="flex items-center gap-1.5">
                {item.slot && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {SLOT_LABEL[item.slot]}
                  </span>
                )}
                {item.time && (
                  <span className="text-[11px] text-muted-foreground">{item.time}</span>
                )}
              </div>
              <p className="line-clamp-1 text-[14px] font-semibold leading-snug">{item.title}</p>
              {item.rating != null && (
                <div className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 fill-current text-foreground" />
                  <span className="font-medium">{item.rating.toFixed(1)}</span>
                  {item.userRatingsTotal != null && (
                    <span className="text-muted-foreground">({item.userRatingsTotal.toLocaleString()})</span>
                  )}
                </div>
              )}
              {item.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
              )}
              {item.placeId && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.title)}&query_place_id=${item.placeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver en Google Maps
                </a>
              )}
            </div>
          </div>
        ))}
        {hasMore && onLoadMore && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onLoadMore(); }}
            className="flex h-full min-h-[160px] w-[100px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[11px] font-medium leading-tight text-center">Ver mas</span>
          </button>
        )}
      </div>
    </div>
  );
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
  const [activeMapSegmentId, setActiveMapSegmentId] = useState<string | null>(null);
  const [assistantWidth, setAssistantWidth] = useState(ASSISTANT_WIDTH_DEFAULT);
  const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);
  const [isResizingAssistant, setIsResizingAssistant] = useState(false);
  const [activeRailTab, setActiveRailTab] = useState<PlannerRailTab>('hotels');
  const [isContextSidebarOpen, setIsContextSidebarOpen] = useState(false);
  const [hotelDetailState, setHotelDetailState] = useState<PlannerHotelDetailState | null>(null);
  const [placeDetailState, setPlaceDetailState] = useState<PlaceDetailData | null>(null);
  const [placeDetailSegmentId, setPlaceDetailSegmentId] = useState<string | null>(null);
  const [discoveryPlacesBySegment, setDiscoveryPlacesBySegment] = useState<Record<string, PlannerPlaceCandidate[]>>({});
  const [inventoryHotelPlacesMap, setInventoryHotelPlacesMap] = useState<Record<string, PlannerPlaceHotelCandidate[]>>({});

  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const segmentVisibilityRef = useRef<Record<string, number>>({});
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

  const handleViewportSegmentSelection = useCallback((segmentId: string) => {
    setActiveMapSegmentId((current) => current === segmentId ? current : segmentId);
  }, []);

  const handleInventoryHotelPlacesReady = useCallback((segmentId: string, places: PlannerPlaceHotelCandidate[]) => {
    setInventoryHotelPlacesMap((prev) => ({ ...prev, [segmentId]: places }));
  }, []);

  const handleStarterPrompt = useCallback((prompt: string) => {
    onMessageChange(prompt);
    setTimeout(() => onSendMessage(), 0);
  }, [onMessageChange, onSendMessage]);

  const handleSelectSegmentFromMap = useCallback((segmentId: string) => {
    setActiveMapSegmentId(segmentId);
    const target = document.getElementById(`planner-segment-${segmentId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!plannerState?.segments.length) {
      setActiveMapSegmentId(null);
      segmentVisibilityRef.current = {};
      return;
    }

    if (!activeMapSegmentId || !plannerState.segments.some((segment) => segment.id === activeMapSegmentId)) {
      setActiveMapSegmentId(plannerState.segments[0].id);
    }
  }, [activeMapSegmentId, plannerState]);

  useEffect(() => {
    if (!plannerState?.segments.length || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observedEntries = plannerState.segments
      .map((segment) => ({
        segmentId: segment.id,
        node: segmentRefs.current[segment.id],
      }))
      .filter((entry): entry is { segmentId: string; node: HTMLDivElement } => Boolean(entry.node));

    if (observedEntries.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const segmentId = (entry.target as HTMLDivElement).dataset.segmentId;
          if (!segmentId) return;
          segmentVisibilityRef.current[segmentId] = entry.isIntersecting ? entry.intersectionRatio : 0;
        });

        const bestVisibleSegment = plannerState.segments
          .map((segment) => ({
            segmentId: segment.id,
            ratio: segmentVisibilityRef.current[segment.id] || 0,
          }))
          .sort((left, right) => right.ratio - left.ratio)[0];

        if (bestVisibleSegment && bestVisibleSegment.ratio > 0.18) {
          setActiveMapSegmentId((current) => current === bestVisibleSegment.segmentId ? current : bestVisibleSegment.segmentId);
        }
      },
      {
        root: null,
        threshold: [0.2, 0.35, 0.5, 0.7],
        rootMargin: '-18% 0px -42% 0px',
      }
    );

    observedEntries.forEach(({ node }) => observer.observe(node));

    return () => {
      observer.disconnect();
    };
  }, [plannerState]);

  useEffect(() => {
    setMapActiveCategories(DEFAULT_MAP_ACTIVE_CATEGORIES);
  }, [selectedConversation]);

  useEffect(() => {
    setActiveRailTab('hotels');
    setIsContextSidebarOpen(false);
    setHotelDetailState(null);
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

  const getSegmentHasExactDates = useCallback((segment: TripPlannerState['segments'][number]) => {
    return !plannerState?.isFlexibleDates && Boolean((segment.startDate || plannerState?.startDate) && (segment.endDate || plannerState?.endDate));
  }, [plannerState]);

  const getInventoryHotelsForSegment = useCallback((segment: TripPlannerState['segments'][number]): LocalHotelData[] => {
    const inventoryHotels = segment.hotelPlan.hotelRecommendations.filter(isEurovipsInventoryHotel);
    const confirmedHotel = segment.hotelPlan.confirmedInventoryHotel;

    if (!isEurovipsInventoryHotel(confirmedHotel)) {
      return inventoryHotels;
    }

    const confirmedHotelId = getPlannerHotelDisplayId(confirmedHotel);
    const alreadyIncluded = inventoryHotels.some((hotel) => getPlannerHotelDisplayId(hotel) === confirmedHotelId);
    return alreadyIncluded ? inventoryHotels : [confirmedHotel, ...inventoryHotels];
  }, []);

  const getSegmentHeaderImage = useCallback((segment: TripPlannerState['segments'][number]) => {
    const getDestinationImagePriority = (activity: PlannerActivity) => {
      const normalizedCategory = (activity.category || '').toLowerCase();
      const normalizedTitle = (activity.title || '').toLowerCase();
      const mentionsHotel = normalizedCategory.includes('hotel') || normalizedTitle.includes('hotel');

      if (activity.activityType === 'hotel' || mentionsHotel) {
        return -1;
      }

      let score = 0;

      if (activity.source === 'google_maps') score += 5;
      if (activity.placeId) score += 2;
      if (activity.formattedAddress) score += 1;

      switch (activity.activityType) {
        case 'culture':
        case 'museum':
        case 'viewpoint':
        case 'landmark':
        case 'nature':
        case 'experience':
        case 'walk':
          score += 9;
          break;
        case 'food':
        case 'market':
        case 'nightlife':
        case 'shopping':
          score += 5;
          break;
        default:
          score += 2;
          break;
      }

      return score;
    };

    const destinationActivities = segment.days
      .flatMap((day) => [...day.morning, ...day.afternoon, ...day.evening])
      .filter((activity) => (activity.photoUrls?.length || 0) > 0)
      .map((activity) => ({
        activity,
        score: getDestinationImagePriority(activity),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => right.score - left.score);

    return destinationActivities[0]?.activity.photoUrls?.find(Boolean);
  }, []);

  const activeRailSegment = useMemo(() => {
    if (!plannerState?.segments.length) return null;
    const targetSegmentId = activeMapSegmentId || plannerState.segments[0]?.id;
    return plannerState.segments.find((segment) => segment.id === targetSegmentId) || plannerState.segments[0] || null;
  }, [activeMapSegmentId, plannerState]);

  const activeRailSegmentIndex = useMemo(() => {
    if (!plannerState || !activeRailSegment) return -1;
    return plannerState.segments.findIndex((segment) => segment.id === activeRailSegment.id);
  }, [activeRailSegment, plannerState]);

  const activeRailPreviousSegment = useMemo(() => {
    if (!plannerState || activeRailSegmentIndex <= 0) return null;
    return plannerState.segments[activeRailSegmentIndex - 1] || null;
  }, [activeRailSegmentIndex, plannerState]);

  useEffect(() => {
    if (activeRailTab === 'transport' && !activeRailPreviousSegment) {
      setActiveRailTab('hotels');
    }
  }, [activeRailPreviousSegment, activeRailTab]);

  useEffect(() => {
    if (hotelDetailState && activeRailSegment && hotelDetailState.segmentId !== activeRailSegment.id) {
      setHotelDetailState(null);
    }
  }, [activeRailSegment, hotelDetailState]);

  const activeHotelDetail = useMemo(() => {
    if (!plannerState || !hotelDetailState) return null;
    const segment = plannerState.segments.find((item) => item.id === hotelDetailState.segmentId);
    if (!segment) return null;
    const hotel = getInventoryHotelsForSegment(segment).find(
      (item) => getPlannerHotelDisplayId(item) === hotelDetailState.hotelId
    );

    if (!hotel) return null;

    return { segment, hotel };
  }, [getInventoryHotelsForSegment, hotelDetailState, plannerState]);

  useEffect(() => {
    if (hotelDetailState && !activeHotelDetail) {
      setHotelDetailState(null);
    }
  }, [activeHotelDetail, hotelDetailState]);

  const openRailForSegment = useCallback((segmentId: string, tab: PlannerRailTab) => {
    setActiveMapSegmentId(segmentId);
    setActiveRailTab(tab);
    setHotelDetailState(null);
    setPlaceDetailState(null);
    setIsContextSidebarOpen(true);
  }, []);

  const openHotelDetail = useCallback((segmentId: string, hotelId: string) => {
    setActiveMapSegmentId(segmentId);
    setActiveRailTab('hotels');
    setHotelDetailState({ segmentId, hotelId });
    setPlaceDetailState(null);
    setIsContextSidebarOpen(true);
  }, []);

  const openHotelListForSegment = useCallback((segmentId: string) => {
    openRailForSegment(segmentId, 'hotels');
  }, [openRailForSegment]);

  const handleOpenPlaceDetail = useCallback((payload: { segmentId: string; place: PlannerPlaceCandidate }) => {
    // Inventory hotels have fake placeIds (inventory:*) that can't be resolved via
    // Google Places API.  Instead of opening the place-detail flow (which would stay
    // stuck in "loading"), open the hotel inventory detail directly.
    if (payload.place.source === 'inventory' && payload.place.category === 'hotel') {
      const hotelPlace = payload.place as PlannerPlaceHotelCandidate;
      if (hotelPlace.hotelId) {
        openHotelDetail(payload.segmentId, hotelPlace.hotelId);
        return;
      }
    }

    setPlaceDetailState({ place: payload.place, details: null, loading: true });
    setPlaceDetailSegmentId(payload.segmentId);
    setActiveMapSegmentId(payload.segmentId);
    setHotelDetailState(null);
    setIsContextSidebarOpen(true);
  }, [openHotelDetail]);

  const handlePlaceDetailsLoaded = useCallback((details: import('../services/placesService').PlaceDetails) => {
    setPlaceDetailState((prev) => prev ? { ...prev, details, loading: false } : null);
  }, []);

  const handleCardClick = useCallback((activity: PlannerActivity, segmentId: string) => {
    const place: PlannerPlaceCandidate = {
      placeId: activity.placeId || activity.id,
      name: activity.title,
      formattedAddress: activity.formattedAddress,
      rating: activity.rating,
      userRatingsTotal: activity.userRatingsTotal,
      photoUrls: activity.photoUrls || [],
      category: (activity.category as PlannerPlaceCategory) || 'activity',
      activityType: activity.activityType,
      source: activity.source === 'google_maps' ? 'google_maps' : undefined,
    };
    setPlaceDetailState({ place, details: null, loading: Boolean(activity.placeId) });
    setPlaceDetailSegmentId(segmentId);
    setActiveMapSegmentId(segmentId);
    setHotelDetailState(null);
    setIsContextSidebarOpen(true);
  }, []);

  const handleCardAddToDay = useCallback((activity: PlannerActivity, segmentId: string) => {
    if (!activity.placeId) return;
    const place: PlannerPlaceCandidate = {
      placeId: activity.placeId,
      name: activity.title,
      formattedAddress: activity.formattedAddress,
      rating: activity.rating,
      userRatingsTotal: activity.userRatingsTotal,
      photoUrls: activity.photoUrls || [],
      category: (activity.category as PlannerPlaceCategory) || 'activity',
      activityType: activity.activityType,
      source: 'google_maps',
    };
    setPendingMapPlaceAssignment({ segmentId, place });
  }, []);

  const getHotelCtaState = useCallback((segment: TripPlannerState['segments'][number]) => {
    const inventoryHotels = getInventoryHotelsForSegment(segment);

    if (!getSegmentHasExactDates(segment)) {
      return {
        label: 'Definir fechas',
        tone: 'outline' as const,
        summary: 'Necesitás fechas exactas para ver hoteles reales.',
      };
    }

    if (segment.hotelPlan.matchStatus === 'matching_inventory' || segment.hotelPlan.searchStatus === 'loading') {
      return {
        label: 'Buscando hotel',
        tone: 'secondary' as const,
        summary: 'Estoy consultando inventario real para este destino.',
      };
    }

    if (segment.hotelPlan.matchStatus === 'quoting') {
      return {
        label: 'Actualizando precio',
        tone: 'secondary' as const,
        summary: 'Refrescando la cotización del hotel seleccionado.',
      };
    }

    if (segment.hotelPlan.selectedHotelId || segment.hotelPlan.confirmedInventoryHotel) {
      return {
        label: 'Hotel elegido',
        tone: 'default' as const,
        summary: segment.hotelPlan.confirmedInventoryHotel?.name || inventoryHotels[0]?.name || 'Hotel listo para revisar.',
      };
    }

    if (segment.hotelPlan.selectedPlaceCandidate) {
      return {
        label: 'Buscar hotel real',
        tone: 'outline' as const,
        summary: 'Ya elegiste un hotel en mapa; falta resolverlo en inventario.',
      };
    }

    if (inventoryHotels.length > 0) {
      return {
        label: 'Elegir hotel',
        tone: 'outline' as const,
        summary: `${inventoryHotels.length} opcion${inventoryHotels.length === 1 ? '' : 'es'} reales para comparar.`,
      };
    }

    if (segment.hotelPlan.searchStatus === 'error') {
      return {
        label: 'Revisar hoteles',
        tone: 'outline' as const,
        summary: 'No pude traer hoteles reales para este destino.',
      };
    }

    return {
      label: 'Ver hoteles',
      tone: 'outline' as const,
      summary: 'Abrí el panel para revisar disponibilidad y match con inventario.',
    };
  }, [getInventoryHotelsForSegment, getSegmentHasExactDates]);

  const getTransportCtaState = useCallback((
    segment: TripPlannerState['segments'][number],
    previousSegment?: TripPlannerState['segments'][number]
  ) => {
    if (!previousSegment) {
      return null;
    }

    if (segment.transportIn?.searchStatus === 'loading') {
      return {
        label: 'Buscando transporte',
        tone: 'secondary' as const,
        summary: `Consultando opciones entre ${formatDestinationLabel(previousSegment.city)} y ${formatDestinationLabel(segment.city)}.`,
      };
    }

    if (segment.transportIn?.selectedOptionId) {
      return {
        label: 'Transporte elegido',
        tone: 'default' as const,
        summary: 'Hay una opción seleccionada para este tramo.',
      };
    }

    if (segment.transportIn?.searchStatus === 'ready') {
      const optionCount = segment.transportIn.options?.length || 0;
      return {
        label: optionCount > 0 ? 'Ver transporte' : 'Sin opciones',
        tone: 'outline' as const,
        summary: optionCount > 0
          ? `${optionCount} opcion${optionCount === 1 ? '' : 'es'} reales para este tramo.`
          : 'No encontramos transporte con la información actual.',
      };
    }

    if (segment.transportIn?.searchStatus === 'error') {
      return {
        label: 'Revisar transporte',
        tone: 'outline' as const,
        summary: 'No pude traer transporte para este tramo.',
      };
    }

    return {
      label: 'Ver transporte',
      tone: 'outline' as const,
      summary: `Opciones entre ${formatDestinationLabel(previousSegment.city)} y ${formatDestinationLabel(segment.city)}.`,
    };
  }, []);
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

    if (!getSegmentHasExactDates(segment)) {
      return 'Definí fechas exactas y te muestro hoteles reales para este tramo.';
    }
    if (segment.hotelPlan.searchStatus === 'error') {
      return 'No pude traer hoteles reales para este destino. Probá de nuevo en un momento.';
    }
    if (segment.hotelPlan.searchStatus === 'loading') {
      return 'Estoy buscando hoteles reales para este destino...';
    }
    const inventoryOptions = getInventoryHotelsForSegment(segment);
    if (segment.hotelPlan.searchStatus === 'ready' && inventoryOptions.length > 0) {
      return `${inventoryOptions.length} opciones reales para comparar`;
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
    <div className="trip-planner-surface @container flex flex-col gap-4 p-4 lg:p-6">
      {!plannerState ? (
        <TripPlannerStarterTemplate
          mode={isLoading || isTyping ? 'processing' : 'idle'}
          promptPreview={latestUserPrompt}
          typingMessage={typingMessage}
          plannerError={plannerError}
          onSendPrompt={handleStarterPrompt}
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
                  <div className="md:hidden">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => openRailForSegment(activeRailSegment?.id || plannerState.segments[0].id, activeRailPreviousSegment ? activeRailTab : 'hotels')}
                    >
                      <Hotel className="mr-2 h-4 w-4" />
                      Hoteles y transporte
                    </Button>
                  </div>
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
                  selectedSegmentId={activeMapSegmentId}
                  activeCategories={mapActiveCategories}
                  isResolvingLocations={isResolvingLocations}
                  locationWarning={plannerLocationWarning}
                  draftPhrase={isDraftGenerating ? DRAFT_GENERATING_PHRASES[draftPhraseIndex] : null}
                  onSelectSegment={handleSelectSegmentFromMap}
                  onViewportSelectSegment={handleViewportSegmentSelection}
                  onAddHotelToSegment={isDraftPlanner
                    ? undefined
                    : ((segmentId, placeCandidate) => {
                        void (async () => {
                          await onSelectHotelPlaceFromMap(segmentId, placeCandidate);
                          if (placeCandidate.source === 'inventory' && placeCandidate.hotelId) {
                            openHotelDetail(segmentId, placeCandidate.hotelId);
                          } else {
                            openRailForSegment(segmentId, 'hotels');
                          }
                        })();
                      })}
                  onRequestAddPlaceToPlanner={isDraftPlanner
                    ? undefined
                    : ((payload) => setPendingMapPlaceAssignment(payload))}
                  onAutoFillRealPlaces={isDraftPlanner
                    ? undefined
                    : ((payload) => {
                        void onAutoFillSegmentWithRealPlaces(payload.segmentId, payload.placesByCategory);
                        const allPlaces = Object.values(payload.placesByCategory).flat().filter((p) => p.category !== 'hotel');
                        setDiscoveryPlacesBySegment((prev) => ({ ...prev, [payload.segmentId]: allPlaces }));
                      })}
                  onOpenPlaceDetail={isDraftPlanner ? undefined : handleOpenPlaceDetail}
                  onPlaceDetailsLoaded={handlePlaceDetailsLoaded}
                  fetchPlaceDetailFor={placeDetailState?.loading ? placeDetailState.place : null}
                  onInventoryHotelPlacesReady={handleInventoryHotelPlacesReady}
                />
              </div>

            </CardContent>
          </Card>

          <div className="grid gap-4">
            {plannerState.segments.map((segment, segmentIndex) => {
              const previousSegment = segmentIndex > 0 ? plannerState.segments[segmentIndex - 1] : undefined;
              const hotelCtaState = getHotelCtaState(segment);
              const segmentHeaderImage = getSegmentHeaderImage(segment);

              if (!segmentHeaderImage) {
                return (
                  <Card
                    key={segment.id}
                    id={`planner-segment-${segment.id}`}
                    className="relative overflow-hidden"
                    ref={(node) => { segmentRefs.current[segment.id] = node; }}
                    data-segment-id={segment.id}
                  >
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium">
                          {segmentIndex + 1}. {formatDestinationLabel(segment.city)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Preparando destino…
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              return (
              <Card
                key={segment.id}
                id={`planner-segment-${segment.id}`}
                className={`relative overflow-hidden ${activeRailSegment?.id === segment.id ? 'border-primary/30 shadow-sm ring-1 ring-primary/10' : ''}`}
                ref={(node) => {
                  segmentRefs.current[segment.id] = node;
                }}
                data-segment-id={segment.id}
              >
                <CardHeader className="relative overflow-hidden border-b p-0">
                  <div className="relative min-h-[248px]">
                    <img
                      src={segmentHeaderImage}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.18)_0%,rgba(15,23,42,0.48)_38%,rgba(15,23,42,0.86)_100%)]" />

                    <div className="relative z-10 flex h-full min-h-[248px] flex-col justify-end p-6">
                      {segment.contentStatus === 'error' && (
                        <div className="absolute right-4 top-4 flex items-center gap-2">
                          <Badge className="rounded-full border-white/20 bg-destructive/25 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                            Pendiente
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/16 hover:text-white"
                            onClick={() => void onEnsureSegmentEnriched(segment.id)}
                            disabled={isDraftPlanner || isLoadingPlanner}
                          >
                            <Bot className="mr-2 h-4 w-4" />
                            Reintentar
                          </Button>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <CardTitle className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                            {segmentIndex + 1}. {formatDestinationLabel(segment.city)}
                          </CardTitle>
                          <p className="mt-2 text-base text-white/80 sm:text-lg">
                            {formatDateRange(segment.startDate, segment.endDate)}
                            {segment.nights != null && <> · {segment.nights} noche{segment.nights === 1 ? '' : 's'}</>}
                          </p>
                        </div>

                        <Button
                          variant={hotelCtaState.tone}
                          size="sm"
                          className="rounded-full shadow-sm"
                          onClick={() => openHotelListForSegment(segment.id)}
                        >
                          {hotelCtaState.label === 'Buscando hotel' || hotelCtaState.label === 'Actualizando precio' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Hotel className="mr-2 h-4 w-4" />
                          )}
                          Reservar alojamiento y transporte
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
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
                      <div className="space-y-8">
                        {segment.days.map((day) => {
                          const allActivities = [
                            ...day.morning.map((a) => ({ ...a, _slot: 'morning' as const })),
                            ...day.afternoon.map((a) => ({ ...a, _slot: 'afternoon' as const })),
                            ...day.evening.map((a) => ({ ...a, _slot: 'evening' as const })),
                          ] as (PlannerActivity & { _slot: 'morning' | 'afternoon' | 'evening' })[];

                          const restaurantCards: DayCardItem[] = day.restaurants
                            .filter((r) => r.placeId || r.name)
                            .map((r) => ({
                              id: r.id,
                              title: r.name,
                              photo: r.photoUrls?.find(Boolean) || undefined,
                              category: '🍽️ Restaurante',
                              rating: r.rating,
                              userRatingsTotal: r.userRatingsTotal,
                              description: [r.type, r.priceRange].filter(Boolean).join(' · ') || undefined,
                              activityType: 'food' as const,
                              placeId: r.placeId,
                              formattedAddress: r.formattedAddress,
                            }));

                          const dayActivities: DayCardItem[] = [
                            ...allActivities
                              .filter((a) => {
                                if ((a.activityType === 'hotel' || a.activityType === 'transport') && !a.placeId) return false;
                                if (a.source === 'generated' && !a.placeId && (!a.photoUrls || a.photoUrls.length === 0)) return false;
                                return true;
                              })
                              .map((a) => ({
                                id: a.id,
                                title: a.title,
                                photo: a.photoUrls?.find(Boolean) || undefined,
                                category: a.category,
                                rating: a.rating,
                                userRatingsTotal: a.userRatingsTotal,
                                description: a.description,
                                slot: a._slot,
                                time: a.time,
                                activityType: a.activityType,
                                placeId: a.placeId,
                                formattedAddress: a.formattedAddress,
                              })),
                            ...restaurantCards,
                          ];

                          const usedPlaceIds = new Set(
                            segment.days
                              .flatMap((d) => [...d.morning, ...d.afternoon, ...d.evening, ...d.restaurants])
                              .map((a) => ('placeId' in a ? a.placeId : undefined))
                              .filter(Boolean)
                          );
                          const segmentDiscovery = discoveryPlacesBySegment[segment.id] || [];
                          const availableDiscovery = segmentDiscovery.filter((p) => !usedPlaceIds.has(p.placeId));
                          const suggestions: DayCardItem[] = availableDiscovery
                            .slice(0, 6)
                            .map((p) => ({
                              id: `suggest-${p.placeId}`,
                              title: p.name,
                              photo: p.photoUrls?.[0] || undefined,
                              category: getPlannerPlaceCategoryLabel(p.category),
                              rating: p.rating,
                              userRatingsTotal: p.userRatingsTotal,
                              placeId: p.placeId,
                              activityType: p.activityType,
                              formattedAddress: p.formattedAddress,
                            }));

                          return (
                            <div key={day.id} className="space-y-3">
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-semibold tracking-tight">
                                  Día {day.dayNumber}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {day.date ? `${formatShortDate(day.date)} · ` : ''}{day.title}
                                </span>
                              </div>

                              <DayCarousel
                                items={dayActivities}
                                dayId={day.id}
                                suggestions={suggestions}
                                onCardClick={(itemId) => {
                                  const suggestPlace = segmentDiscovery.find((p) => `suggest-${p.placeId}` === itemId);
                                  if (suggestPlace) {
                                    handleOpenPlaceDetail({ segmentId: segment.id, place: suggestPlace });
                                    return;
                                  }
                                  const activity = allActivities.find((a) => a.id === itemId);
                                  if (activity) {
                                    handleCardClick(activity, segment.id);
                                    return;
                                  }
                                  const restaurant = day.restaurants.find((r) => r.id === itemId);
                                  if (restaurant) {
                                    const place: PlannerPlaceCandidate = {
                                      placeId: restaurant.placeId || restaurant.id,
                                      name: restaurant.name,
                                      formattedAddress: restaurant.formattedAddress,
                                      rating: restaurant.rating,
                                      userRatingsTotal: restaurant.userRatingsTotal,
                                      photoUrls: restaurant.photoUrls || [],
                                      category: 'restaurant',
                                      activityType: 'food',
                                      source: restaurant.source === 'google_maps' ? 'google_maps' : undefined,
                                    };
                                    handleOpenPlaceDetail({ segmentId: segment.id, place });
                                  }
                                }}
                                onAddToDay={(itemId) => {
                                  const suggestPlace = segmentDiscovery.find((p) => `suggest-${p.placeId}` === itemId);
                                  if (suggestPlace) {
                                    setPendingMapPlaceAssignment({ segmentId: segment.id, place: suggestPlace });
                                    return;
                                  }
                                  const activity = allActivities.find((a) => a.id === itemId);
                                  if (activity) handleCardAddToDay(activity, segment.id);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
	                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
    )
  );

  const activeSegmentHotelPlaces = activeRailSegment
    ? inventoryHotelPlacesMap[activeRailSegment.id]
    : undefined;

  const activeHotelDistanceKm = useMemo(() => {
    if (!activeHotelDetail || !activeSegmentHotelPlaces) return undefined;
    const segment = activeHotelDetail.segment;
    if (!segment.location) return undefined;
    const hotelName = activeHotelDetail.hotel.name?.trim().toLowerCase();
    if (!hotelName) return undefined;
    const matched = activeSegmentHotelPlaces.find(
      (p) => p.name?.trim().toLowerCase() === hotelName
    );
    if (!matched || matched.lat == null || matched.lng == null) return undefined;
    return haversineDistanceKm(segment.location, { lat: matched.lat, lng: matched.lng });
  }, [activeHotelDetail, activeSegmentHotelPlaces]);

  const contextSidebar = plannerState ? (
    <PlannerContextSidebar
      open={isContextSidebarOpen}
      onOpenChange={(open) => {
        setIsContextSidebarOpen(open);
        if (!open) {
          setHotelDetailState(null);
          setPlaceDetailState(null);
        }
      }}
      onHideSidebar={() => {
        setIsContextSidebarOpen(false);
        setHotelDetailState(null);
        setPlaceDetailState(null);
      }}
      segment={activeRailSegment}
      previousSegment={activeRailPreviousSegment}
      headerImageUrl={activeRailSegment ? getSegmentHeaderImage(activeRailSegment) : undefined}
      activeTab={activeRailTab}
      onTabChange={setActiveRailTab}
      activeHotel={activeHotelDetail?.hotel || null}
      onBackFromHotelDetail={() => setHotelDetailState(null)}
      hasExactDates={activeRailSegment ? getSegmentHasExactDates(activeRailSegment) : false}
      disabled={isDraftPlanner}
      travelers={plannerState.travelers}
      hotelStatusText={activeRailSegment ? getHotelStatusText(activeRailSegment) : ''}
      transportStatusText={activeRailSegment ? getTransportStatusText(activeRailSegment, activeRailPreviousSegment || undefined) : ''}
      onOpenHotelDetail={openHotelDetail}
      onResolveInventoryMatch={onResolveInventoryMatch}
      onConfirmInventoryHotelMatch={onConfirmInventoryHotelMatch}
      onRefreshQuotedHotel={onRefreshQuotedHotel}
      onSelectHotel={onSelectHotel}
      onSelectTransportOption={onSelectTransportOption}
      hotelPlaces={activeSegmentHotelPlaces}
      activeHotelDistanceKm={activeHotelDistanceKm}
      activePlace={placeDetailState}
      onBackFromPlaceDetail={() => setPlaceDetailState(null)}
      onAddPlaceToItinerary={placeDetailState && placeDetailSegmentId ? () => {
        setPendingMapPlaceAssignment({
          segmentId: placeDetailSegmentId,
          place: placeDetailState.place,
        });
        setPlaceDetailState(null);
      } : undefined}
      canAddPlace={Boolean(
        placeDetailState
        && placeDetailSegmentId
        && plannerState?.segments.find((s) => s.id === placeDetailSegmentId)?.days.length
      )}
    />
  ) : null;

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
      <div className="relative flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {visibleMessages.map((msg) => {
            return (
              <div key={msg.id}>
                <MessageItem
                  msg={msg}
                  onPdfGenerated={onPdfGenerated}
                  onOpenPlannerDateSelector={(request) => {
                    setPendingPlannerDateRequest(request);
                    setIsDateSelectionModalOpen(true);
                  }}
                />
              </div>
            );
          })}
          {!isTyping && plannerState && !isDraftPlanner && (
            <PlannerChatDestinationCards
              destinations={plannerState.destinations}
              segments={plannerState.segments}
              discoveryPlacesBySegment={discoveryPlacesBySegment}
              onPlaceClick={handleOpenPlaceDetail}
            />
          )}
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
    <div className="h-full min-h-0 bg-background relative overflow-hidden">
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
          <div className="min-h-0 h-full overflow-y-auto">{plannerShell}</div>
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

      {contextSidebar}

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
