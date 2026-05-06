import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PeekCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isActive: boolean) => ReactNode;
  getKey: (item: T, index: number) => string | number;
  peek?: number;
  gap?: number;
  minCardWidth?: number;
  maxCardWidth?: number;
  prevLabel?: string;
  nextLabel?: string;
  showDots?: boolean;
  className?: string;
  itemClassName?: string;
}

export default function PeekCarousel<T>({
  items,
  renderItem,
  getKey,
  peek = 24,
  gap = 12,
  minCardWidth = 260,
  maxCardWidth = 460,
  prevLabel = 'Anterior',
  nextLabel = 'Siguiente',
  showDots = true,
  className,
  itemClassName,
}: PeekCarouselProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const naturalCardWidth = width > 0 ? width - 2 * peek - 2 * gap : 0;
  const cardWidth =
    width > 0
      ? Math.min(maxCardWidth, Math.max(minCardWidth, naturalCardWidth))
      : 0;
  const effectivePeek =
    width > 0 ? Math.max(peek, (width - cardWidth - 2 * gap) / 2) : peek;
  const trackOffset =
    width > 0 ? effectivePeek + gap - index * (cardWidth + gap) : 0;

  const canPrev = index > 0;
  const canNext = index < items.length - 1;

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-2xl space-y-3',
        className,
      )}
    >
      <div
        ref={containerRef}
        className="relative w-full min-w-0 overflow-hidden"
        role="list"
      >
        {canPrev && (
          <button
            type="button"
            aria-label={prevLabel}
            onClick={() => setIndex((i) => i - 1)}
            className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 shadow-lg backdrop-blur-sm transition-all duration-150 hover:scale-105 hover:bg-black/65"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        )}
        {canNext && (
          <button
            type="button"
            aria-label={nextLabel}
            onClick={() => setIndex((i) => i + 1)}
            className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 shadow-lg backdrop-blur-sm transition-all duration-150 hover:scale-105 hover:bg-black/65"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        )}
        <div
          className="flex"
          style={{
            gap: `${gap}px`,
            transform: `translateX(${trackOffset}px)`,
            transition:
              'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: 'transform',
          }}
        >
          {items.map((item, i) => (
            <div
              key={getKey(item, i)}
              role="listitem"
              className={cn('overflow-hidden rounded-lg', itemClassName)}
              style={{
                width: cardWidth > 0 ? `${cardWidth}px` : `${maxCardWidth}px`,
                flexShrink: 0,
              }}
            >
              {renderItem(item, i, i === index)}
            </div>
          ))}
        </div>
      </div>

      {showDots && items.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir al elemento ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                i === index
                  ? 'w-5 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
