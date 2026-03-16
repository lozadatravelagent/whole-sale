import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Star,
} from 'lucide-react';
import type { PlannerActivity } from '../types';

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

export interface DayCardItem {
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

interface DayCarouselProps {
  items: DayCardItem[];
  dayId: string;
  onCardClick?: (itemId: string) => void;
  onAddToDay?: (itemId: string) => void;
  suggestions?: DayCardItem[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function DayCarousel({ items, dayId, onCardClick, onAddToDay, suggestions, onLoadMore, hasMore }: DayCarouselProps) {
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
