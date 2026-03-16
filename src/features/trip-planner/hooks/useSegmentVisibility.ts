import { useCallback, useEffect, useRef, useState } from 'react';
import type { TripPlannerState } from '../types';

export function useSegmentVisibility(plannerState: TripPlannerState | null) {
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const segmentVisibilityRef = useRef<Record<string, number>>({});
  const [activeMapSegmentId, setActiveMapSegmentId] = useState<string | null>(null);

  const handleSelectSegmentFromMap = useCallback((segmentId: string) => {
    setActiveMapSegmentId(segmentId);
    const target = document.getElementById(`planner-segment-${segmentId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleViewportSegmentSelection = useCallback((segmentId: string) => {
    setActiveMapSegmentId((current) => current === segmentId ? current : segmentId);
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

  return {
    segmentRefs,
    activeMapSegmentId,
    setActiveMapSegmentId,
    handleSelectSegmentFromMap,
    handleViewportSegmentSelection,
  };
}
