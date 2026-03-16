import { useCallback, useState } from 'react';

export function useDragReorder(onReorderDestinations: (fromSegmentId: string, toSegmentId: string) => Promise<void>) {
  const [draggedSegmentId, setDraggedSegmentId] = useState<string | null>(null);
  const [dropTargetSegmentId, setDropTargetSegmentId] = useState<string | null>(null);
  const [isReorderingRoute, setIsReorderingRoute] = useState(false);

  const dragHandlers = useCallback((segmentId: string) => ({
    onDragStart: () => setDraggedSegmentId(segmentId),
    onDragEnd: () => {
      setDraggedSegmentId(null);
      setDropTargetSegmentId(null);
    },
    onDragEnter: () => {
      if (draggedSegmentId && draggedSegmentId !== segmentId) {
        setDropTargetSegmentId(segmentId);
      }
    },
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      if (draggedSegmentId && draggedSegmentId !== segmentId) {
        setDropTargetSegmentId(segmentId);
      }
    },
    onDragLeave: () => {
      if (dropTargetSegmentId === segmentId) {
        setDropTargetSegmentId(null);
      }
    },
    onDrop: async () => {
      if (!draggedSegmentId || draggedSegmentId === segmentId) return;
      setIsReorderingRoute(true);
      await onReorderDestinations(draggedSegmentId, segmentId);
      setIsReorderingRoute(false);
      setDraggedSegmentId(null);
      setDropTargetSegmentId(null);
    },
  }), [draggedSegmentId, dropTargetSegmentId, onReorderDestinations]);

  return {
    draggedSegmentId,
    dropTargetSegmentId,
    isReorderingRoute,
    dragHandlers,
  };
}
