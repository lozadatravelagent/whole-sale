import { useCallback, useEffect, useRef, useState } from 'react';

const ASSISTANT_WIDTH_DEFAULT = 640;
const ASSISTANT_WIDTH_MIN = 560;
const ASSISTANT_WIDTH_MAX = 920;
const ASSISTANT_WIDTH_STORAGE_KEY = 'tripPlannerAssistantWidth';
const ASSISTANT_COLLAPSED_STORAGE_KEY = 'tripPlannerAssistantCollapsed';

export function useAssistantResize() {
  const [assistantWidth, setAssistantWidth] = useState(ASSISTANT_WIDTH_DEFAULT);
  const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);
  const [isResizingAssistant, setIsResizingAssistant] = useState(false);

  const resizeStartXRef = useRef<number | null>(null);
  const resizeStartWidthRef = useRef<number | null>(null);

  const clampAssistantWidth = useCallback((value: number) => {
    return Math.min(ASSISTANT_WIDTH_MAX, Math.max(ASSISTANT_WIDTH_MIN, value));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedWidth = window.localStorage.getItem(ASSISTANT_WIDTH_STORAGE_KEY);
    const parsedWidth = storedWidth ? Number(storedWidth) : NaN;
    if (!Number.isNaN(parsedWidth)) {
      setAssistantWidth(clampAssistantWidth(Math.max(parsedWidth, ASSISTANT_WIDTH_DEFAULT)));
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

  return {
    assistantWidth,
    isAssistantCollapsed,
    isResizingAssistant,
    handleAssistantResizeStart,
    handleCollapseAssistant,
    handleExpandAssistant,
  };
}
