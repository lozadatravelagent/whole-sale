import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNearbyPlacesByCategory, fetchViewportNearbyPlaces } from '../services/placesService';
import { clearNearbyPlacesCooldown } from '../services/placesService';
import type { PlannerPlaceCandidate, PlannerPlaceCategory, TripPlannerState } from '../types';

// ── Category policy — single source of truth ──────────────────────────────
// To change category behavior (e.g. swap cafe→lazy / sights→eager), edit
// the flags below. All derived constants update automatically.

interface CategoryPolicy {
  eager: boolean;         // Auto-fetch on segment load
  defaultActive: boolean; // Chip starts ON
  chatPush: boolean;      // Push to chat discovery cards
  viewportFetch: boolean; // Include in viewport dynamic loading
}

const CATEGORY_POLICY: Record<PlannerPlaceCategory, CategoryPolicy> = {
  hotel:      { eager: false, defaultActive: true,  chatPush: false, viewportFetch: false },
  restaurant: { eager: true,  defaultActive: true,  chatPush: false, viewportFetch: true },
  cafe:       { eager: false, defaultActive: false, chatPush: false, viewportFetch: true },
  museum:     { eager: true,  defaultActive: true,  chatPush: false, viewportFetch: true },
  activity:   { eager: true,  defaultActive: true,  chatPush: true,  viewportFetch: true },
  sights:     { eager: true,  defaultActive: true,  chatPush: true,  viewportFetch: true },
  nightlife:  { eager: false, defaultActive: false, chatPush: false, viewportFetch: true },
  parks:      { eager: false, defaultActive: false, chatPush: false, viewportFetch: true },
  shopping:   { eager: false, defaultActive: false, chatPush: false, viewportFetch: true },
  culture:    { eager: false, defaultActive: false, chatPush: false, viewportFetch: true },
};

// Derived constants — do not edit directly
const ALL_CATEGORIES = Object.keys(CATEGORY_POLICY) as PlannerPlaceCategory[];

const EAGER_FETCH_CATEGORIES = ALL_CATEGORIES.filter(cat => CATEGORY_POLICY[cat].eager);

const CHAT_PUSH_CATEGORIES = new Set(ALL_CATEGORIES.filter(cat => CATEGORY_POLICY[cat].chatPush));

export const VIEWPORT_FETCH_CATEGORIES = ALL_CATEGORIES.filter(cat => CATEGORY_POLICY[cat].viewportFetch);

const DEFAULT_ACTIVE = Object.fromEntries(
  ALL_CATEGORIES.map(cat => [cat, CATEGORY_POLICY[cat].defaultActive]),
) as Record<PlannerPlaceCategory, boolean>;

const VIEWPORT_WINDOW_MS = 5 * 60 * 1000;
const VIEWPORT_PROVIDER_CALLS_CAP = 60;

export type CategoryFetchState = 'idle' | 'loading' | 'failed';

export interface PlaceBlock {
  id: string;
  category: PlannerPlaceCategory;
  city: string;
  segmentId: string;
  places: PlannerPlaceCandidate[];
}

/**
 * Owns all places-related state for the trip planner map:
 * - Active category filters
 * - Fetched places indexed by segment + category (survives segment changes)
 * - Chat place blocks for discovery cards
 * - Per-category loading/error state
 *
 * Places are indexed by `segmentId::category` so switching back to a
 * previously visited segment shows results instantly (0 re-fetches).
 *
 * Eager fetch fires individual per-category calls so markers render
 * progressively as each category completes.
 */
export function usePlacesOrchestrator(
  plannerState: TripPlannerState | null,
  activeSegmentId: string | null,
) {
  const [activeCategories, setActiveCategories] = useState(DEFAULT_ACTIVE);
  const [placesBySegment, setPlacesBySegment] = useState<
    Record<string, Record<string, PlannerPlaceCandidate[]>>
  >({});
  const [fetchedKeys, setFetchedKeys] = useState<Set<string>>(new Set());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());
  const [chatPlaceBlocks, setChatPlaceBlocks] = useState<PlaceBlock[]>([]);

  // Ref for synchronous in-flight dedup (avoids stale-closure issues)
  const inFlightRef = useRef<Set<string>>(new Set());

  // ── Helpers ──────────────────────────────────────────────────────────────

  const mergePlacesIntoSegment = useCallback(
    (segmentId: string, category: PlannerPlaceCategory, places: PlannerPlaceCandidate[]) => {
      setPlacesBySegment(prev => {
        const segData = prev[segmentId] || {};
        const existing = segData[category] || [];
        const merged = [
          ...existing,
          ...places.filter(p => !existing.some(e => e.placeId === p.placeId)),
        ];
        return { ...prev, [segmentId]: { ...segData, [category]: merged } };
      });
    },
    [],
  );

  const pushChatBlock = useCallback(
    (segmentId: string, city: string, category: PlannerPlaceCategory, places: PlannerPlaceCandidate[]) => {
      if (!CHAT_PUSH_CATEGORIES.has(category) || places.length === 0) return;
      const blockId = `${segmentId}::${category}`;
      setChatPlaceBlocks(prev => {
        if (prev.some(b => b.id === blockId)) return prev;
        return [
          ...prev,
          {
            id: blockId,
            category,
            city,
            segmentId,
            places: places
              .filter(p => (p.photoUrls?.length ?? 0) > 0 || p.rating != null)
              .sort(
                (a, b) =>
                  (b.rating || 0) * (b.userRatingsTotal || 0) -
                  (a.rating || 0) * (a.userRatingsTotal || 0),
              )
              .slice(0, 6),
          },
        ];
      });
    },
    [],
  );

  // ── Single-category fetch ───────────────────────────────────────────────

  const fetchAndMerge = useCallback(
    (
      segmentId: string,
      city: string,
      location: { lat: number; lng: number },
      category: PlannerPlaceCategory,
      pushToChat = false,
    ) => {
      const key = `${segmentId}::${category}`;

      // Prevent duplicate in-flight requests
      if (inFlightRef.current.has(key)) return Promise.resolve([] as PlannerPlaceCandidate[]);
      inFlightRef.current.add(key);

      // Clear backend cooldown for this exact request so retries hit the API
      clearNearbyPlacesCooldown(city, location, [category]);

      // Mark loading, clear any previous failure
      setLoadingKeys(prev => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setFailedKeys(prev => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      return fetchNearbyPlacesByCategory(city, location, category)
        .then(places => {
          // Mark as successfully fetched
          setFetchedKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });

          mergePlacesIntoSegment(segmentId, category, places);
          if (pushToChat) pushChatBlock(segmentId, city, category, places);

          return places;
        })
        .catch(() => {
          // Mark failed — do NOT mark as fetched so retry is possible
          setFailedKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          return [] as PlannerPlaceCandidate[];
        })
        .finally(() => {
          inFlightRef.current.delete(key);
          setLoadingKeys(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        });
    },
    [mergePlacesIntoSegment, pushChatBlock],
  );

  // ── Eager fetch — progressive per-category ──────────────────────────────

  useEffect(() => {
    if (!plannerState || !activeSegmentId) return;
    const seg = plannerState.segments.find(s => s.id === activeSegmentId);
    if (!seg?.location) return;

    const loc = { lat: seg.location.lat, lng: seg.location.lng };
    const missing = EAGER_FETCH_CATEGORIES.filter(cat => {
      const key = `${activeSegmentId}::${cat}`;
      return !fetchedKeys.has(key) && !inFlightRef.current.has(key);
    });

    if (missing.length === 0) return;

    // Fire individual calls — each category renders as soon as it resolves
    const segId = activeSegmentId;
    missing.forEach(cat => {
      fetchAndMerge(segId, seg.city, loc, cat, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegmentId, plannerState]);

  // ── Toggle category (with retry for failed categories) ──────────────────

  const toggleCategory = useCallback(
    (category: PlannerPlaceCategory) => {
      if (!activeSegmentId) {
        setActiveCategories(current => ({ ...current, [category]: !current[category] }));
        return;
      }

      const key = `${activeSegmentId}::${category}`;

      // If active and failed → retry instead of toggling off
      if (activeCategories[category] && failedKeys.has(key)) {
        const seg = plannerState?.segments.find(s => s.id === activeSegmentId);
        const loc = seg?.location;
        if (seg && loc) {
          fetchAndMerge(activeSegmentId, seg.city, { lat: loc.lat, lng: loc.lng }, category, true);
        }
        return;
      }

      setActiveCategories(current => ({ ...current, [category]: !current[category] }));

      // Fetch on activate if not yet fetched
      if (category !== 'hotel' && !activeCategories[category]) {
        const seg = plannerState?.segments.find(s => s.id === activeSegmentId);
        const loc = seg?.location;
        if (seg && loc && !fetchedKeys.has(key)) {
          fetchAndMerge(activeSegmentId, seg.city, { lat: loc.lat, lng: loc.lng }, category, true);
        }
      }
    },
    [plannerState, activeSegmentId, activeCategories, fetchedKeys, failedKeys, fetchAndMerge],
  );

  // ── Viewport-triggered fetch with client-side cache ──────────────────────

  interface ViewportCacheEntry {
    placesByCategory: Record<string, PlannerPlaceCandidate[]>;
    partial: boolean;
    retriedOnce: boolean;
  }

  const viewportCacheRef = useRef<Map<string, ViewportCacheEntry>>(new Map());
  const inFlightViewportRef = useRef(false);

  // Rolling window rate limit based on real provider calls
  const viewportCallLogRef = useRef<Array<{ ts: number; calls: number }>>([]);

  // Provider cooldown propagated from backend 429 handling
  const providerCooldownUntilRef = useRef(0);
  const pendingViewportRef = useRef<{
    segmentId: string;
    city: string;
    searchPoints: Array<{ center: { lat: number; lng: number }; radius: number }>;
    categories: PlannerPlaceCategory[];
    viewportSig: string;
  } | null>(null);

  // Ref to latest fetchForViewport so .finally() can call it for pending viewport
  const fetchForViewportRef = useRef<(
    segmentId: string,
    city: string,
    searchPoints: Array<{ center: { lat: number; lng: number }; radius: number }>,
    categories: PlannerPlaceCategory[],
    viewportSig: string,
  ) => void>(() => {});

  const fetchForViewport = useCallback(
    (
      segmentId: string,
      city: string,
      searchPoints: Array<{ center: { lat: number; lng: number }; radius: number }>,
      categories: PlannerPlaceCategory[],
      viewportSig: string,
    ) => {
      const cacheKey = `${segmentId}::${viewportSig}`;

      const cached = viewportCacheRef.current.get(cacheKey);
      if (cached) {
        // Always merge cached data into segment
        for (const [cat, places] of Object.entries(cached.placesByCategory)) {
          if (places.length > 0) {
            mergePlacesIntoSegment(segmentId, cat as PlannerPlaceCategory, places);
          }
        }

        // Complete → done. Partial + already retried → done (no infinite retries).
        if (!cached.partial || cached.retriedOnce) {
          const totalPlaces = Object.values(cached.placesByCategory).reduce((s, p) => s + p.length, 0);
          console.log(`🗺️ [Viewport] cache-hit`, { sig: viewportSig, segmentId, places: totalPlaces, partial: cached.partial, retriedOnce: cached.retriedOnce });
          return;
        }

        // Partial + not yet retried → fall through to re-fetch
        console.log(`🗺️ [Viewport] partial-retry`, { sig: viewportSig, segmentId });
      }

      // If another viewport fetch is in flight, save as pending (latest wins)
      if (inFlightViewportRef.current) {
        pendingViewportRef.current = { segmentId, city, searchPoints, categories, viewportSig };
        console.log(`🗺️ [Viewport] pending-saved`, { sig: viewportSig });
        return;
      }

      // Provider cooldown — skip if Foursquare is rate-limiting us
      const now = Date.now();
      const cooldownRemaining = providerCooldownUntilRef.current - now;
      if (cooldownRemaining > 0) {
        console.log(`🗺️ [Viewport] provider-cooldown`, { sig: viewportSig, remainingS: Math.ceil(cooldownRemaining / 1000) });
        return;
      }

      // Rolling window rate limit based on accumulated provider calls
      viewportCallLogRef.current = viewportCallLogRef.current.filter(e => now - e.ts < VIEWPORT_WINDOW_MS);
      const totalProviderCalls = viewportCallLogRef.current.reduce((s, e) => s + e.calls, 0);
      if (totalProviderCalls >= VIEWPORT_PROVIDER_CALLS_CAP) {
        console.log(`🗺️ [Viewport] rate-limited`, { sig: viewportSig, providerCallsInWindow: totalProviderCalls, cap: VIEWPORT_PROVIDER_CALLS_CAP });
        return;
      }

      inFlightViewportRef.current = true;

      const fetchStartMs = Date.now();
      const isRetry = Boolean(cached?.partial);
      console.log(`🗺️ [Viewport] fetch-start`, { sig: viewportSig, segmentId, points: searchPoints.length, categories: categories.length, retry: isRetry });

      fetchViewportNearbyPlaces(city, searchPoints, categories)
        .then(({ placesByCategory, partial, providerCalls, cooldownRemainingS }) => {
          const durationMs = Date.now() - fetchStartMs;

          // Record real provider calls for rate limit window
          if (providerCalls) {
            viewportCallLogRef.current.push({ ts: Date.now(), calls: providerCalls });
          }

          // Propagate provider cooldown to prevent useless fetches
          if (cooldownRemainingS && cooldownRemainingS > 0) {
            providerCooldownUntilRef.current = Date.now() + cooldownRemainingS * 1000;
            console.log(`🗺️ [Viewport] provider-cooldown-set`, { cooldownS: cooldownRemainingS });
          }

          // Merge with existing cached data (if retrying a partial)
          const existing = viewportCacheRef.current.get(cacheKey);
          const merged: Record<string, PlannerPlaceCandidate[]> = { ...(existing?.placesByCategory || {}) };
          for (const [cat, places] of Object.entries(placesByCategory)) {
            const prev = merged[cat] || [];
            const fresh = places.filter(p => !prev.some(e => e.placeId === p.placeId));
            merged[cat] = [...prev, ...fresh];
          }

          const wasRetry = existing?.partial && !existing.retriedOnce;
          viewportCacheRef.current.set(cacheKey, {
            placesByCategory: merged,
            partial: partial ?? false,
            retriedOnce: wasRetry || (existing?.retriedOnce ?? false),
          });

          for (const [cat, places] of Object.entries(merged)) {
            if (places.length > 0) {
              mergePlacesIntoSegment(segmentId, cat as PlannerPlaceCategory, places);
            }
          }

          const totalPlaces = Object.values(merged).reduce((s, p) => s + p.length, 0);
          console.log(`🗺️ [Viewport] fetch-complete`, { sig: viewportSig, segmentId, durationMs, places: totalPlaces, partial, providerCalls, retry: isRetry });
        })
        .catch((err) => {
          console.log(`🗺️ [Viewport] fetch-error`, { sig: viewportSig, segmentId, error: err instanceof Error ? err.message : 'unknown' });
        })
        .finally(() => {
          inFlightViewportRef.current = false;
          // Process pending viewport (latest wins)
          const pending = pendingViewportRef.current;
          if (pending) {
            pendingViewportRef.current = null;
            console.log(`🗺️ [Viewport] pending-execute`, { sig: pending.viewportSig });
            fetchForViewportRef.current(pending.segmentId, pending.city, pending.searchPoints, pending.categories, pending.viewportSig);
          }
        });
    },
    [mergePlacesIntoSegment],
  );

  // Keep ref in sync so .finally() always calls the latest version
  fetchForViewportRef.current = fetchForViewport;

  // ── Derived state ───────────────────────────────────────────────────────

  // True while any eager category is loading for active segment
  const isLoading = useMemo(() => {
    if (!activeSegmentId) return false;
    return EAGER_FETCH_CATEGORIES.some(cat => loadingKeys.has(`${activeSegmentId}::${cat}`));
  }, [activeSegmentId, loadingKeys]);

  // Per-category fetch state for the active segment (used by chip UI)
  const categoryStates = useMemo((): Record<PlannerPlaceCategory, CategoryFetchState> => {
    const result = {} as Record<PlannerPlaceCategory, CategoryFetchState>;
    for (const cat of ALL_CATEGORIES) {
      const key = activeSegmentId ? `${activeSegmentId}::${cat}` : '';
      if (loadingKeys.has(key)) result[cat] = 'loading';
      else if (failedKeys.has(key)) result[cat] = 'failed';
      else result[cat] = 'idle';
    }
    return result;
  }, [activeSegmentId, loadingKeys, failedKeys]);

  // Flat by-category view for the active segment (same shape the map expects)
  const placesForActiveSegment = useMemo((): Record<string, PlannerPlaceCandidate[]> => {
    if (!activeSegmentId) return {};
    return placesBySegment[activeSegmentId] || {};
  }, [activeSegmentId, placesBySegment]);

  // Discovery places flat by segment (for discovery cards)
  const discoveryPlacesBySegment = useMemo((): Record<string, PlannerPlaceCandidate[]> => {
    const result: Record<string, PlannerPlaceCandidate[]> = {};
    for (const [segId, cats] of Object.entries(placesBySegment)) {
      result[segId] = Object.values(cats).flat();
    }
    return result;
  }, [placesBySegment]);

  const ensureCategoryActive = useCallback((category: PlannerPlaceCategory) => {
    setActiveCategories(prev => {
      if (prev[category]) return prev;
      return { ...prev, [category]: true };
    });
  }, []);

  const resetForConversation = useCallback(() => {
    setActiveCategories(DEFAULT_ACTIVE);
    setPlacesBySegment({});
    setFetchedKeys(new Set());
    setLoadingKeys(new Set());
    setFailedKeys(new Set());
    setChatPlaceBlocks([]);
    inFlightRef.current.clear();
    viewportCacheRef.current.clear();
    inFlightViewportRef.current = false;
    pendingViewportRef.current = null;
    viewportCallLogRef.current = [];
    providerCooldownUntilRef.current = 0;
  }, []);

  return {
    activeCategories,
    placesForActiveSegment,
    allPlacesBySegment: placesBySegment,
    isLoading,
    chatPlaceBlocks,
    discoveryPlacesBySegment,
    categoryStates,
    toggleCategory,
    ensureCategoryActive,
    resetForConversation,
    fetchForViewport,
  };
}
