import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MessageInput from '@/features/chat/components/MessageInput';
import MessageItem from '@/features/chat/components/MessageItem';
import type { LocalHotelData, MessageRow } from '@/features/chat/types/chat';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  FileDown,
  GripVertical,
  Hotel,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useChatPanelResize } from '@/features/trip-planner/hooks/useAssistantResize';
import { useDragReorder } from '@/features/trip-planner/hooks/useDragReorder';
import { useSegmentVisibility } from '@/features/trip-planner/hooks/useSegmentVisibility';
import type {
  DiscoveryCard,
  PlannerActivity,
  PlannerBudgetLevel,
  PlannerFieldProvenance,
  PlannerPace,
  PlannerPlaceCandidate,
  PlannerPlaceCategory,
  PlannerPlaceHotelCandidate,
  PlannerSyncingFields,
  TripPlannerState,
} from '../types';
import {
  formatDateRange,
  formatDayBlockLabel,
  formatDestinationLabel,
  formatFlexibleMonth,
  getPlannerHotelDisplayId,
  isEurovipsInventoryHotel,
  formatShortDate,
  buildPlannerPdfHtml,
  haversineDistanceKm,
} from '../utils';
import { getPlannerPlaceCategoryLabel, getPlannerPlaceEmoji } from '../services/plannerPlaceMapper';
import { fetchNearbyPlacesByCategory, type PlaceDetails } from '../services/placesService';
import PlannerContextSidebar from './PlannerContextSidebar';
import type { PlaceDetailData } from './PlannerPlaceDetailPanel';
import TripPlannerMap from './TripPlannerMap';
import PlannerDateSelectionModal from './PlannerDateSelectionModal';
import PlannerMapPlaceAssignModal from './PlannerMapPlaceAssignModal';
import PlannerChatDestinationCards, { DiscoveryPlaceCard } from './PlannerChatDestinationCards';
import TripListPanel from './TripListPanel';
import LeadSelector from './LeadSelector';
import { useAuth } from '@/contexts/AuthContext';
import { updateTripLeadId } from '../services/tripService';
import SuggestionChips from '@/features/chat/components/SuggestionChips';
import usePlannerSuggestions from '../hooks/usePlannerSuggestions';
import useSuggestionActions from '../hooks/useSuggestionActions';
import TripPlannerStarterTemplate from './TripPlannerStarterTemplate';
import PlannerDiscoveryPanel from './PlannerDiscoveryPanel';
import TripSpecsBar from './TripSpecsBar';
import TripPlannerWorkspaceSkeleton from './TripPlannerWorkspaceSkeleton';
import DayCarousel, { type DayCardItem } from './DayCarousel';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

const PLANNER_MAP_FILTERS: PlannerPlaceCategory[] = ['hotel', 'restaurant', 'cafe', 'museum', 'activity', 'sights', 'nightlife', 'parks', 'shopping', 'culture'];
type PlannerPlacesByCategory = Record<string, PlannerPlaceCandidate[]>;
const EAGER_FETCH_CATEGORIES: PlannerPlaceCategory[] = ['restaurant', 'cafe', 'museum', 'activity'];
const CHAT_PUSH_CATEGORIES: Set<PlannerPlaceCategory> = new Set(['activity', 'sights']);
const DEFAULT_MAP_ACTIVE_CATEGORIES: Record<PlannerPlaceCategory, boolean> = {
  hotel: true,
  restaurant: true,
  cafe: true,
  museum: true,
  activity: true,
  sights: false,
  nightlife: false,
  parks: false,
  shopping: false,
  culture: false,
};

const PLANNER_MAP_FILTER_LABELS: Record<PlannerPlaceCategory, string> = {
  hotel: 'Hoteles',
  restaurant: 'Restaurantes',
  cafe: 'Cafes',
  museum: 'Museos',
  activity: 'Que hacer',
  sights: 'Puntos de interés',
  nightlife: 'Bares y noche',
  parks: 'Parques',
  shopping: 'Compras',
  culture: 'Cultura',
};

const BUDGET_OPTIONS: { value: PlannerBudgetLevel; label: string; icon: string }[] = [
  { value: 'low', label: 'Bajo', icon: '$' },
  { value: 'mid', label: 'Medio', icon: '$$' },
  { value: 'high', label: 'Alto', icon: '$$$' },
  { value: 'luxury', label: 'Lujo', icon: '$$$$' },
];

const PACE_OPTIONS: { value: PlannerPace; label: string; icon: string }[] = [
  { value: 'relaxed', label: 'Relajado', icon: '\u{1F9D8}' },
  { value: 'balanced', label: 'Equilibrado', icon: '\u{2696}\u{FE0F}' },
  { value: 'fast', label: 'Intenso', icon: '\u{26A1}' },
];

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
  onSelectHotel: (segmentId: string, hotelId: string, roomIndex?: number) => Promise<void>;
  onSelectHotelPlaceFromMap: (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => Promise<void>;
  onAddPlaceToPlanner: (segmentId: string, input: {
    place: PlannerPlaceCandidate;
    dayId: string;
    block: 'morning' | 'afternoon' | 'evening';
  }) => Promise<void>;
  onAddPlaceToFirstAvailableSlot: (place: {
    name: string;
    description?: string;
    category: string;
    suggestedSlot: 'morning' | 'afternoon' | 'evening';
    segmentCity: string;
  }) => Promise<void>;
  onAutoFillSegmentWithRealPlaces: (segmentId: string, placesByCategory: PlannerPlacesByCategory) => Promise<void>;
  onResolveInventoryMatch: (segmentId: string) => Promise<void>;
  onConfirmInventoryHotelMatch: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
  onSelectTransportOption: (segmentId: string, optionId: string) => Promise<void>;
  onLoadHotelsForSegment: (segmentId: string) => Promise<void>;
  onLoadTransportForSegment: (segmentId: string) => void;
  onSendMessageRaw: (message: string) => void;
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
  onSelectHotel,
  onSelectHotelPlaceFromMap,
  onAddPlaceToPlanner,
  onAddPlaceToFirstAvailableSlot,
  onAutoFillSegmentWithRealPlaces,
  onResolveInventoryMatch,
  onConfirmInventoryHotelMatch,
  onRefreshQuotedHotel,
  onSelectTransportOption,
  onLoadHotelsForSegment,
  onLoadTransportForSegment,
  onSendMessageRaw,
  onCompletePlannerDateSelection,
}: TripPlannerWorkspaceProps) {
  const {
    chatPanelWidth,
    isResizing,
    containerRef,
    handleResizeStart,
  } = useChatPanelResize();

  const {
    draggedSegmentId,
    dropTargetSegmentId,
    isReorderingRoute,
    dragHandlers,
  } = useDragReorder(onReorderDestinations);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newDestination, setNewDestination] = useState('');
  const [activeHeaderPanel, setActiveHeaderPanel] = useState<'destinations' | 'trips' | null>(null);
  const [linkedLead, setLinkedLead] = useState<{ id: string; name: string } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const { user } = useAuth();
  const [mobileTab, setMobileTab] = useState('plan');
  const [pendingPlannerDateRequest, setPendingPlannerDateRequest] = useState<ParsedTravelRequest | null>(null);
  const [pendingMapPlaceAssignment, setPendingMapPlaceAssignment] = useState<{
    segmentId: string;
    place: PlannerPlaceCandidate;
  } | null>(null);
  const [mapActiveCategories, setMapActiveCategories] = useState<Record<PlannerPlaceCategory, boolean>>(DEFAULT_MAP_ACTIVE_CATEGORIES);
  const [isDateSelectionModalOpen, setIsDateSelectionModalOpen] = useState(false);
  const [activeRailTab, setActiveRailTab] = useState<PlannerRailTab>('hotels');
  const [isContextSidebarOpen, setIsContextSidebarOpen] = useState(false);
  const [hotelDetailState, setHotelDetailState] = useState<PlannerHotelDetailState | null>(null);
  const [placeDetailState, setPlaceDetailState] = useState<PlaceDetailData | null>(null);
  const [placeDetailSegmentId, setPlaceDetailSegmentId] = useState<string | null>(null);
  const [discoveryPlacesBySegment, setDiscoveryPlacesBySegment] = useState<Record<string, PlannerPlaceCandidate[]>>({});
  const [inventoryHotelPlacesMap, setInventoryHotelPlacesMap] = useState<Record<string, PlannerPlaceHotelCandidate[]>>({});
  const [fetchedCats, setFetchedCats] = useState<Set<string>>(new Set());
  const [mapPlacesByCategory, setMapPlacesByCategory] = useState<Record<string, PlannerPlaceCandidate[]>>({});
  const [mapPlacesLoading, setMapPlacesLoading] = useState(false);
  const [chatPlaceBlocks, setChatPlaceBlocks] = useState<
    Array<{ id: string; category: PlannerPlaceCategory; city: string; segmentId: string; places: PlannerPlaceCandidate[] }>
  >([]);
  const [persistedMapPlannerState, setPersistedMapPlannerState] = useState<TripPlannerState | null>(null);

  const visibleMapPlannerState = plannerState ?? persistedMapPlannerState;

  const {
    segmentRefs,
    activeMapSegmentId,
    setActiveMapSegmentId,
    handleSelectSegmentFromMap,
    handleViewportSegmentSelection,
  } = useSegmentVisibility(visibleMapPlannerState);

  // Fetch places for a single category and merge into state.
  // pushToChat controls whether results inject a block into the chat rail —
  // true only for explicit user actions (category toggle), false for eager/hydration fetches.
  const fetchAndMergeCategory = useCallback((
    segmentId: string,
    city: string,
    location: { lat: number; lng: number },
    category: PlannerPlaceCategory,
    pushToChat = false,
  ) => {
    const catKey = `${segmentId}::${category}`;
    setFetchedCats((prev) => {
      if (prev.has(catKey)) return prev;
      const next = new Set(prev);
      next.add(catKey);
      return next;
    });
    return fetchNearbyPlacesByCategory(null, city, location, category)
      .then((places) => {
        setMapPlacesByCategory((prev) => ({
          ...prev,
          [category]: [
            ...(prev[category] || []),
            ...places.filter((p) => !(prev[category] || []).some((e) => e.placeId === p.placeId)),
          ],
        }));
        setDiscoveryPlacesBySegment((prev) => ({
          ...prev,
          [segmentId]: [
            ...(prev[segmentId] || []),
            ...places.filter((p) => !(prev[segmentId] || []).some((e) => e.placeId === p.placeId)),
          ],
        }));
        // Push to chat only when explicitly requested (user-triggered category toggle)
        if (pushToChat && CHAT_PUSH_CATEGORIES.has(category) && places.length > 0) {
          const blockId = `${segmentId}::${category}`;
          setChatPlaceBlocks((prev) => {
            if (prev.some((b) => b.id === blockId)) return prev;
            return [...prev, {
              id: blockId,
              category,
              city,
              segmentId,
              places: places
                .filter((p) => (p.photoUrls?.length ?? 0) > 0 || p.rating != null)
                .sort((a, b) => (b.rating || 0) * (b.userRatingsTotal || 0) - (a.rating || 0) * (a.userRatingsTotal || 0))
                .slice(0, 6),
            }];
          });
        }
        return places;
      })
      .catch(() => [] as PlannerPlaceCandidate[]);
  }, []);

  // Toggle a map category filter — fetch on activate for any non-hotel category
  const handleMapCategoryToggle = useCallback((category: PlannerPlaceCategory) => {
    setMapActiveCategories((current) => {
      const next = { ...current, [category]: !current[category] };
      const activating = !current[category];

      if (activating && category !== 'hotel') {
        const activeSegment = plannerState?.segments.find((s) => s.id === activeMapSegmentId);
        const loc = activeSegment?.location;
        if (activeSegment && loc) {
          const catKey = `${activeSegment.id}::${category}`;
          if (!fetchedCats.has(catKey)) {
            void fetchAndMergeCategory(activeSegment.id, activeSegment.city, { lat: loc.lat, lng: loc.lng }, category, true);
          }
        }
      }

      return next;
    });
  }, [plannerState, activeMapSegmentId, fetchedCats, fetchAndMergeCategory]);

  // Eagerly fetch default-active categories when active segment changes
  useEffect(() => {
    if (!plannerState || !activeMapSegmentId) return;
    const seg = plannerState.segments.find((s) => s.id === activeMapSegmentId);
    if (!seg?.location) return;

    setFetchedCats(new Set());
    setMapPlacesByCategory({});
    setMapPlacesLoading(true);

    const loc = { lat: seg.location.lat, lng: seg.location.lng };
    Promise.all(
      EAGER_FETCH_CATEGORIES.map((cat) => fetchAndMergeCategory(seg.id, seg.city, loc, cat)),
    ).finally(() => setMapPlacesLoading(false));
  }, [activeMapSegmentId, plannerState, fetchAndMergeCategory]);

  // Auto-fill segments with real places when places are loaded and segment is ready
  useEffect(() => {
    if (!plannerState || mapPlacesLoading) return;
    const hasPlaces = Object.values(mapPlacesByCategory).some((items) => items.length > 0);
    if (!hasPlaces) return;
    for (const seg of plannerState.segments) {
      if (seg.contentStatus !== 'ready') continue;
      if (seg.realPlacesStatus === 'ready' || seg.realPlacesStatus === 'loading') continue;
      void onAutoFillSegmentWithRealPlaces(seg.id, mapPlacesByCategory);
      break; // one at a time
    }
  }, [plannerState, mapPlacesByCategory, mapPlacesLoading, onAutoFillSegmentWithRealPlaces]);

  const toggleHeaderDestinationsPanel = useCallback(() => {
    setActiveHeaderPanel((current) => current === 'destinations' ? null : 'destinations');
  }, []);

  const handleInventoryHotelPlacesReady = useCallback((segmentId: string, places: PlannerPlaceHotelCandidate[]) => {
    setInventoryHotelPlacesMap((prev) => ({ ...prev, [segmentId]: places }));
  }, []);

  const handleStarterPrompt = useCallback((prompt: string) => {
    onMessageChange(prompt);
    setTimeout(() => onSendMessage(), 0);
  }, [onMessageChange, onSendMessage]);

  useEffect(() => {
    if (plannerState) {
      setPersistedMapPlannerState(plannerState);
    }
  }, [plannerState]);

  useEffect(() => {
    // Reset all transient UI state when conversation changes
    setPersistedMapPlannerState(null);
    setMapActiveCategories(DEFAULT_MAP_ACTIVE_CATEGORIES);
    setActiveRailTab('hotels');
    setIsContextSidebarOpen(false);
    setHotelDetailState(null);
    setPlaceDetailState(null);
    setPlaceDetailSegmentId(null);
    setDiscoveryPlacesBySegment({});
    setInventoryHotelPlacesMap({});
    setFetchedCats(new Set());
    setMapPlacesByCategory({});
    setChatPlaceBlocks([]);
    setPendingMapPlaceAssignment(null);
    setLinkedLead(null);
    setNewDestination('');
    setIsEditingTitle(false);
    setActiveHeaderPanel(null);
    setIsDateSelectionModalOpen(false);
    setPendingPlannerDateRequest(null);
  }, [selectedConversation]);

  const destinationLabels = useMemo(
    () => plannerState?.segments.map((segment) => formatDestinationLabel(segment.city)) ?? [],
    [plannerState]
  );

  const isDraftPlanner = Boolean(plannerState?.generationMeta?.isDraft);

  const suggestions = usePlannerSuggestions(plannerState);
  const openDateSelectorForSuggestion = useCallback(() => {
    setIsDateSelectionModalOpen(true);
  }, []);
  const { handleSuggestionClick, loadingActionId } = useSuggestionActions({
    loadTransportForSegment: onLoadTransportForSegment,
    loadHotelsForSegment: onLoadHotelsForSegment,
    updateTripField: onUpdateTripField,
    plannerState,
    onSendMessage: onSendMessageRaw,
    onOpenDateSelector: openDateSelectorForSuggestion,
  });

  const isAssumed = useCallback((field: keyof PlannerFieldProvenance) => plannerState?.fieldProvenance?.[field] === 'assumed', [plannerState?.fieldProvenance]);
  const fieldIsSyncing = useCallback((field: keyof PlannerSyncingFields) => Boolean(plannerState?.syncingFields?.[field]), [plannerState?.syncingFields]);
  const hasAssumedFields = useMemo(() => {
    const fp = plannerState?.fieldProvenance;
    if (!fp) return false;
    return Object.values(fp).some(v => v === 'assumed');
  }, [plannerState?.fieldProvenance]);
  const [dismissedBannerId, setDismissedBannerId] = useState<string | null>(null);
  const currentBannerId = plannerState?.id || null;
  const showAssumedBanner = hasAssumedFields && !isDraftPlanner && dismissedBannerId !== currentBannerId;
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

    // Ensure the place's category is active so the map won't immediately deselect it
    setMapActiveCategories((prev) => {
      if (prev[payload.place.category]) return prev;
      return { ...prev, [payload.place.category]: true };
    });
  }, [openHotelDetail]);

  const handleAutoSlotPlace = useCallback((payload: { segmentId: string; place: PlannerPlaceCandidate }) => {
    onAddPlaceToFirstAvailableSlot({
      name: payload.place.name,
      category: payload.place.category,
      suggestedSlot: 'morning',
      segmentCity: plannerState?.segments.find((s) => s.id === payload.segmentId)?.city || '',
    });
  }, [onAddPlaceToFirstAvailableSlot, plannerState?.segments]);

  const handleAutoSlotRecommendedPlace = useCallback((rp: {
    name: string;
    description?: string;
    category: string;
    suggestedSlot: 'morning' | 'afternoon' | 'evening';
    segmentCity: string;
  }) => {
    onAddPlaceToFirstAvailableSlot(rp);
  }, [onAddPlaceToFirstAvailableSlot]);

  const agentDiscoveryCards = useMemo((): DiscoveryCard[] => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return [];
    const meta = (lastAssistant as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    const places = meta?.recommendedPlaces as Array<Record<string, unknown>> | undefined;
    if (!places || places.length === 0) return [];
    return places.slice(0, 6).map(rp => {
      const cat = ((rp.category as string) || '').toLowerCase();
      let type: DiscoveryCard['type'] = 'activity';
      if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe')) type = 'restaurant';
      else if (cat.includes('experience') || cat.includes('tour')) type = 'experience';
      return {
        label: (rp.name as string) || '',
        type,
        city: (rp.segmentCity as string) || '',
        slot: ((rp.suggestedSlot as string) || 'afternoon') as DiscoveryCard['slot'],
        description: rp.description as string | undefined,
      };
    });
  }, [messages]);

  const handleDiscoveryAdd = useCallback((card: DiscoveryCard) => {
    onAddPlaceToFirstAvailableSlot({
      name: card.label,
      category: card.type,
      suggestedSlot: card.slot,
      segmentCity: card.city,
      description: card.description,
    });
  }, [onAddPlaceToFirstAvailableSlot]);

  const handlePlaceDetailsLoaded = useCallback((details: PlaceDetails | null) => {
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
    const meta = (m as MessageRow & { meta?: Record<string, unknown> }).meta;
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

  // Auto-scroll chat to bottom on new messages or conversation switch
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length, isTyping, selectedConversation]);

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
  const shouldShowMapSkeleton = !visibleMapPlannerState && shouldShowInitialPlannerSkeleton;

  const plannerHeader = plannerState ? (
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

		                      <button
		                        type="button"
		                        onClick={() => setActiveHeaderPanel(activeHeaderPanel === 'trips' ? null : 'trips')}
		                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition whitespace-nowrap ${activeHeaderPanel === 'trips' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
		                      >
		                        🗺️ Trips
		                      </button>

		                      <div className="shrink-0">
		                        <LeadSelector
		                          value={linkedLead?.id ?? null}
		                          leadName={linkedLead?.name}
		                          onSelect={async (leadId, leadName) => {
		                            setLinkedLead({ id: leadId, name: leadName });
		                            if (selectedConversation && user?.id) {
		                              await updateTripLeadId(selectedConversation, leadId, user.id);
		                            }
		                          }}
		                          onClear={async () => {
		                            setLinkedLead(null);
		                            if (selectedConversation && user?.id) {
		                              await updateTripLeadId(selectedConversation, null, user.id);
		                            }
		                          }}
		                        />
		                      </div>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <TooltipProvider delayDuration={300}>
		                        <Tooltip>
		                          <TooltipTrigger asChild>
		                            <button
		                              type="button"
		                              disabled={isDraftPlanner}
		                              onClick={() => {
		                                setPendingPlannerDateRequest(null);
		                                setIsDateSelectionModalOpen(true);
		                              }}
		                              className={`relative flex min-w-[10.75rem] items-center rounded-full px-4 py-2 text-left text-sm font-medium transition whitespace-nowrap xl:min-w-[11.5rem] ${isAssumed('startDate') ? 'ring-1 ring-amber-300/60' : ''} ${isDraftPlanner ? 'cursor-default opacity-80' : 'text-foreground hover:bg-muted'}`}
		                              aria-label="Editar fechas"
		                            >
		                              {fieldIsSyncing('dates') ? <Loader2 className="absolute -top-1 -right-1 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('startDate') && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
		                              {plannerDateSummary}
		                            </button>
		                          </TooltipTrigger>
		                          {isAssumed('startDate') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
		                        </Tooltip>
		                      </TooltipProvider>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <TooltipProvider delayDuration={300}>
		                        <Tooltip>
		                          <TooltipTrigger asChild>
		                            <div className={`relative flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium text-foreground whitespace-nowrap ${isAssumed('days') ? 'ring-1 ring-amber-300/60' : ''}`}>
		                              {fieldIsSyncing('dates') ? <Loader2 className="absolute -top-1 -right-1 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('days') && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
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
		                          </TooltipTrigger>
		                          {isAssumed('days') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
		                        </Tooltip>
		                      </TooltipProvider>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <TooltipProvider delayDuration={300}>
		                        <Tooltip>
		                          <TooltipTrigger asChild>
		                            <div className={`relative flex shrink-0 items-center gap-1 rounded-full p-0.5 ${isAssumed('budgetLevel') ? 'ring-1 ring-amber-300/60' : ''}`}>
		                              {fieldIsSyncing('budgetLevel') ? <Loader2 className="absolute -top-1 -right-1 z-10 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('budgetLevel') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
		                              {BUDGET_OPTIONS.map((opt) => (
		                                <button
		                                  key={opt.value}
		                                  type="button"
		                                  disabled={isDraftPlanner}
		                                  onClick={() => void onUpdateTripField('budgetLevel', opt.value)}
		                                  className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${
		                                    (plannerState.budgetLevel || 'mid') === opt.value
		                                      ? 'bg-foreground text-background shadow-sm'
		                                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
		                                  } ${isDraftPlanner ? 'cursor-default opacity-80' : ''}`}
		                                >
		                                  <span className="mr-0.5">{opt.icon}</span>
		                                  <span className="hidden @lg:inline">{opt.label}</span>
		                                </button>
		                              ))}
		                            </div>
		                          </TooltipTrigger>
		                          {isAssumed('budgetLevel') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
		                        </Tooltip>
		                      </TooltipProvider>

		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <TooltipProvider delayDuration={300}>
		                        <Tooltip>
		                          <TooltipTrigger asChild>
		                            <div className={`relative flex shrink-0 items-center gap-1 rounded-full p-0.5 ${isAssumed('pace') ? 'ring-1 ring-amber-300/60' : ''}`}>
		                              {fieldIsSyncing('pace') ? <Loader2 className="absolute -top-1 -right-1 z-10 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('pace') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
		                              {PACE_OPTIONS.map((opt) => (
		                                <button
		                                  key={opt.value}
		                                  type="button"
		                                  disabled={isDraftPlanner}
		                                  onClick={() => void onUpdateTripField('pace', opt.value)}
		                                  className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${
		                                    (plannerState.pace || 'balanced') === opt.value
		                                      ? 'bg-foreground text-background shadow-sm'
		                                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
		                                  } ${isDraftPlanner ? 'cursor-default opacity-80' : ''}`}
		                                >
		                                  <span className="mr-0.5">{opt.icon}</span>
		                                  <span className="hidden @lg:inline">{opt.label}</span>
		                                </button>
		                              ))}
		                            </div>
		                          </TooltipTrigger>
		                          {isAssumed('pace') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
		                        </Tooltip>
		                      </TooltipProvider>
		                      <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />

		                      <TooltipProvider delayDuration={300}>
		                        <Tooltip>
		                          <TooltipTrigger asChild>
		                            <div className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium text-foreground whitespace-nowrap ${isAssumed('travelers') ? 'ring-1 ring-amber-300/60' : ''}`}>
		                              {fieldIsSyncing('travelers') ? <Loader2 className="absolute -top-1 -right-1 z-10 h-3 w-3 animate-spin text-muted-foreground" /> : isAssumed('travelers') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
		                              <span>{plannerState.travelers.adults} adulto{plannerState.travelers.adults !== 1 ? 's' : ''}{plannerState.travelers.children > 0 ? `, ${plannerState.travelers.children} niño${plannerState.travelers.children !== 1 ? 's' : ''}` : ''}{plannerState.travelers.infants > 0 ? `, ${plannerState.travelers.infants} bebé${plannerState.travelers.infants !== 1 ? 's' : ''}` : ''}</span>
		                            </div>
		                          </TooltipTrigger>
		                          {isAssumed('travelers') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
		                        </Tooltip>
		                      </TooltipProvider>

		                      {plannerState.origin && (
		                        <>
		                          <div className="mx-1 hidden h-6 w-px bg-border/80 xl:block" />
		                          <TooltipProvider delayDuration={300}>
		                            <Tooltip>
		                              <TooltipTrigger asChild>
		                                <div className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium text-foreground whitespace-nowrap ${isAssumed('origin') ? 'ring-1 ring-amber-300/60' : ''}`}>
		                                  {isAssumed('origin') && <span className="absolute -top-0.5 -right-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
		                                  <span>Desde {plannerState.origin}</span>
		                                </div>
		                              </TooltipTrigger>
		                              {isAssumed('origin') && <TooltipContent>Valor sugerido — hacé clic para modificar</TooltipContent>}
		                            </Tooltip>
		                          </TooltipProvider>
		                        </>
		                      )}

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

	                {showAssumedBanner && (
	                  <Alert className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20">
	                    <AlertDescription className="flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
	                      <span>Algunos valores fueron estimados. Los campos con borde naranja son sugeridos — hacé clic para confirmarlos.</span>
	                      <button type="button" onClick={() => setDismissedBannerId(currentBannerId)} className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400">
	                        <X className="h-3.5 w-3.5" />
	                      </button>
	                    </AlertDescription>
	                  </Alert>
	                )}

	                {plannerState?.seasonalityAlert && !isDraftPlanner && (
	                  <Alert className="border-orange-300/60 bg-orange-50/50 dark:bg-orange-950/20">
	                    <AlertDescription className="flex items-center gap-2 text-xs text-orange-800 dark:text-orange-200">
	                      <AlertTriangle className="h-4 w-4 shrink-0" />
	                      <span>{plannerState.seasonalityAlert}</span>
	                    </AlertDescription>
	                  </Alert>
	                )}

	                {activeHeaderPanel === 'trips' && (
	                  <div className="planner-panel-fade-in rounded-2xl border bg-muted/20 max-h-[400px] overflow-hidden">
	                    <TripListPanel
	                      onOpenTrip={(tripId) => {
	                        console.log('[PLANNER] Open trip:', tripId);
	                        setActiveHeaderPanel(null);
	                      }}
	                      onClose={() => setActiveHeaderPanel(null)}
	                    />
	                  </div>
	                )}

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
	                          {...dragHandlers(segment.id)}
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
                        onClick={() => handleMapCategoryToggle(category)}
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

            </CardContent>
          </Card>
  ) : null;

  // Overlay panels — extracted from plannerHeader for desktop overlay rendering
  const destinationsPanel = plannerState ? (
    <div className="planner-panel-fade-in">
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
            {...dragHandlers(segment.id)}
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
  ) : null;

  const tripsPanel = (
    <div className="planner-panel-fade-in max-h-[400px] overflow-hidden">
      <TripListPanel
        onOpenTrip={(tripId) => {
          console.log('[PLANNER] Open trip:', tripId);
          setActiveHeaderPanel(null);
        }}
        onClose={() => setActiveHeaderPanel(null)}
      />
    </div>
  );

  const plannerMap = visibleMapPlannerState ? (
    <TripPlannerMap
      segments={visibleMapPlannerState.segments}
      days={visibleMapPlannerState.days}
      selectedSegmentId={activeMapSegmentId}
      activeCategories={mapActiveCategories}
      placesByCategory={mapPlacesByCategory}
      placesLoading={mapPlacesLoading}
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
      onOpenPlaceDetail={isDraftPlanner ? undefined : handleOpenPlaceDetail}
      onPlaceDetailsLoaded={handlePlaceDetailsLoaded}
      fetchPlaceDetailFor={placeDetailState?.loading ? placeDetailState.place : null}
      onInventoryHotelPlacesReady={handleInventoryHotelPlacesReady}
    />
  ) : null;

  const plannerSegments = plannerState ? (
          <div className="grid gap-4">
            {plannerState.segments.map((segment, segmentIndex) => {
              const previousSegment = segmentIndex > 0 ? plannerState.segments[segmentIndex - 1] : undefined;
              const hotelCtaState = getHotelCtaState(segment);
              const segmentHeaderImage = getSegmentHeaderImage(segment);

              if (!segmentHeaderImage) {
                return null;
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
                            .filter((r) => r.placeId || (r.photoUrls && r.photoUrls.length > 0))
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
  ) : null;

  const plannerShell = (
    shouldShowInitialPlannerSkeleton ? (
      <TripPlannerWorkspaceSkeleton />
    ) : (
    <div className="trip-planner-surface @container flex flex-col gap-4 p-4 lg:p-6">
      {!plannerState && !visibleMapPlannerState ? (
        <TripPlannerStarterTemplate
          mode={isLoading || isTyping ? 'processing' : 'idle'}
          promptPreview={latestUserPrompt}
          typingMessage={typingMessage}
          plannerError={plannerError}
          onSendPrompt={handleStarterPrompt}
        />
      ) : (
        <>
          {plannerState ? plannerHeader : null}
          <div className="w-full">{plannerMap}</div>
          {plannerState ? plannerSegments : null}
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
      isLastSegment={activeRailSegmentIndex >= 0 && activeRailSegmentIndex === (plannerState?.segments.length ?? 0) - 1}
      origin={plannerState?.origin}
    />
  ) : null;

  const assistantRail = (
    <div className="trip-planner-surface flex h-full flex-col md:border-r bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">Emilia</span>
          {isTyping && (
            <span className="text-xs text-muted-foreground truncate">
              {typingMessage || 'Procesando...'}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs md:hidden" onClick={() => setMobileTab('plan')}>
          Ocultar
        </Button>
      </div>
      <div className="relative flex-1 overflow-y-auto p-4">
        <div className="space-y-2.5">
          {visibleMessages.map((msg) => {
            const msgMeta = (msg as Record<string, unknown>).meta as Record<string, unknown> | undefined;
            const recommendedPlaces = msgMeta?.recommendedPlaces as Array<{
              name: string;
              description?: string;
              category: string;
              suggestedSlot: 'morning' | 'afternoon' | 'evening';
              segmentCity: string;
            }> | undefined;
            const slotLabel = (slot: string) =>
              slot === 'morning' ? 'Mañana' : slot === 'afternoon' ? 'Tarde' : 'Noche';

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
                {recommendedPlaces && recommendedPlaces.length > 0 && (
                  <div className="mt-2 ml-9">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Lugares recomendados:
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {recommendedPlaces.map((rp) => (
                        <button
                          key={rp.name}
                          type="button"
                          className="group shrink-0 flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-left text-xs shadow-sm transition-shadow hover:shadow-md"
                          onClick={() => handleAutoSlotRecommendedPlace(rp)}
                        >
                          <div>
                            <p className="font-semibold text-foreground">{rp.name}</p>
                            <p className="text-muted-foreground">{rp.segmentCity} · {slotLabel(rp.suggestedSlot)}</p>
                          </div>
                          <Plus className="h-4 w-4 shrink-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!isTyping && plannerState && !isDraftPlanner && (suggestions.length > 0 || agentDiscoveryCards.length > 0) && (
            <SuggestionChips
              suggestions={suggestions}
              onSuggestionClick={handleSuggestionClick}
              loadingAction={loadingActionId}
              discoveryCards={agentDiscoveryCards}
              onDiscoveryAdd={handleDiscoveryAdd}
            />
          )}
          {!isTyping && chatPlaceBlocks.length > 0 && chatPlaceBlocks.map((block) => (
            <div key={block.id} className="animate-in fade-in duration-300">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {block.category === 'sights' ? 'Puntos de interés en' : 'Qué hacer en'} {formatDestinationLabel(block.city)}
              </p>
              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {block.places.map((place) => (
                  <DiscoveryPlaceCard
                    key={place.placeId}
                    place={place}
                    onClick={() => handleOpenPlaceDetail({ segmentId: block.segmentId, place })}
                    onAddClick={() => handleAutoSlotPlace({ segmentId: block.segmentId, place })}
                  />
                ))}
              </div>
            </div>
          ))}
          {!isTyping && plannerState && !isDraftPlanner && (
            <PlannerChatDestinationCards
              destinations={plannerState.destinations}
              segments={plannerState.segments}
              discoveryPlacesBySegment={discoveryPlacesBySegment}
              onPlaceClick={handleOpenPlaceDetail}
              onAutoSlotPlace={handleAutoSlotPlace}
            />
          )}
          {isTyping && (
            <div className="flex items-start gap-2 animate-in fade-in duration-200">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-xs font-medium text-foreground">
                  {activePlannerMutation?.type === 'regen_plan' ? 'Regenerando itinerario...' :
                   activePlannerMutation?.type === 'regen_segment' ? 'Actualizando tramo...' :
                   activePlannerMutation?.type === 'regen_day' ? 'Recalculando el día...' :
                   plannerState?.syncingFields?.hotels ? 'Buscando hoteles...' :
                   plannerState?.syncingFields?.transport ? 'Buscando vuelos...' :
                   typingMessage || 'Procesando...'}
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
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
      <div ref={containerRef} className="hidden h-full md:flex md:flex-col">

        {/* ── SPECS BAR (full-width, persistent) ── */}
        {plannerState && !shouldShowInitialPlannerSkeleton && (
          <div className="relative shrink-0">
            <div className="border-b bg-background px-4 py-2">
              <TripSpecsBar
                plannerState={plannerState}
                isDraft={isDraftPlanner}
                dateSummary={plannerDateSummary}
                hasExactDates={hasExactPlannerDates}
                isAssumed={isAssumed}
                fieldIsSyncing={fieldIsSyncing}
                showAssumedBanner={showAssumedBanner}
                onDismissAssumedBanner={() => setDismissedBannerId(currentBannerId)}
                activePanel={activeHeaderPanel}
                onToggleDestinations={toggleHeaderDestinationsPanel}
                onToggleTrips={() => setActiveHeaderPanel(activeHeaderPanel === 'trips' ? null : 'trips')}
                onUpdateBudget={(v) => void onUpdateTripField('budgetLevel', v)}
                onUpdatePace={(v) => void onUpdateTripField('pace', v)}
                onOpenDateSelector={() => { setPendingPlannerDateRequest(null); setIsDateSelectionModalOpen(true); }}
                onUpdateDays={(d) => void onUpdateTripField('days', d as TripPlannerState['days'])}
                onExportPdf={handleExportPdf}
                linkedLead={linkedLead}
                onSelectLead={async (id, name) => { setLinkedLead({ id, name }); if (selectedConversation && user?.id) await updateTripLeadId(selectedConversation, id, user.id); }}
                onClearLead={async () => { setLinkedLead(null); if (selectedConversation && user?.id) await updateTripLeadId(selectedConversation, null, user.id); }}
                draftProgress={null}
                loadingPhase={null}
              />
            </div>

            {/* Overlay panels */}
            {activeHeaderPanel && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setActiveHeaderPanel(null)} />
                <div className={`absolute left-4 top-full z-40 mt-1 overflow-y-auto rounded-xl border bg-background p-4 shadow-xl ${
                  activeHeaderPanel === 'destinations' ? 'max-w-lg max-h-[50vh]' : 'max-w-md max-h-[400px]'
                }`}>
                  {activeHeaderPanel === 'destinations' && destinationsPanel}
                  {activeHeaderPanel === 'trips' && tripsPanel}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CHAT + MAP ROW ── */}
        <div className="flex-1 min-h-0 flex">

          {/* LEFT: chat — width controlled by resize */}
          <div
            className="min-h-0 flex flex-col"
            style={chatPanelWidth !== null
              ? { width: `${chatPanelWidth}px`, flexShrink: 0 }
              : { flex: 1, minWidth: '380px' }
            }
          >
            {assistantRail}
          </div>

          {/* RESIZE GUTTER */}
          <div
            className={`planner-assistant-resize-gutter ${isResizing ? 'planner-assistant-resize-gutter--active' : ''}`}
            onPointerDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar paneles"
          />

          {/* RIGHT: map — always flex-1 */}
          <div
            className="relative"
            style={{ flex: 1, minWidth: '400px', minHeight: 0 }}
          >
            {shouldShowMapSkeleton ? (
              <TripPlannerWorkspaceSkeleton />
            ) : !visibleMapPlannerState ? (
              <PlannerDiscoveryPanel onSendPrompt={handleStarterPrompt} />
            ) : (
              <div className="h-full relative">
                {plannerMap}

                {/* Title overlay — editable on double-click */}
                {plannerState?.title && (
                  <div className="absolute left-3 top-3 z-10 max-w-[60%] rounded-lg bg-background/85 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                    {isEditingTitle ? (
                      <Input
                        autoFocus
                        value={plannerState.title}
                        onChange={(e) => void onUpdateTripField('title', e.target.value)}
                        onBlur={() => setIsEditingTitle(false)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); }}
                        className="h-auto border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                      />
                    ) : (
                      <p className="text-sm font-semibold line-clamp-1 cursor-text"
                        onDoubleClick={() => { if (!isDraftPlanner) setIsEditingTitle(true); }}>
                        {plannerState.title}
                      </p>
                    )}
                  </div>
                )}

                {/* Map filters overlay — bottom center */}
                <div className="absolute bottom-3 left-3 right-3 z-30 flex justify-center gap-1 overflow-x-auto rounded-full border bg-background/90 px-1.5 py-1 shadow-md backdrop-blur-sm" style={{ scrollbarWidth: 'none' }}>
                  {PLANNER_MAP_FILTERS.map((category) => (
                    <button key={category} type="button"
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        mapActiveCategories[category] ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted'
                      }`}
                      onClick={() => handleMapCategoryToggle(category)}>
                      <span className="mr-0.5">{getPlannerPlaceEmoji(category)}</span>
                      {PLANNER_MAP_FILTER_LABELS[category]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-full flex-col md:hidden">
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
