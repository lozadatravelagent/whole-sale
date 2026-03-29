import { useCallback, useEffect, useRef, useState } from 'react';

const CHAT_PANEL_STORAGE_KEY = 'plannerChatPanelWidth';
const CHAT_PANEL_MIN = 380;
const MAP_PANEL_MIN = 400;
const GUTTER_WIDTH = 12;

export function useChatPanelResize() {
  const [chatPanelWidth, setChatPanelWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizeStartXRef = useRef<number | null>(null);
  const resizeStartWidthRef = useRef<number | null>(null);
  const didRestoreStoredWidthRef = useRef(false);

  const clampChatWidth = useCallback((value: number) => {
    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
    const maxChat = containerWidth - MAP_PANEL_MIN - GUTTER_WIDTH;
    return Math.min(maxChat, Math.max(CHAT_PANEL_MIN, value));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(CHAT_PANEL_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (!Number.isNaN(parsed) && parsed >= CHAT_PANEL_MIN) {
      didRestoreStoredWidthRef.current = true;
      setChatPanelWidth(clampChatWidth(parsed));
    }
  }, [clampChatWidth]);

  useEffect(() => {
    if (typeof window === 'undefined' || chatPanelWidth === null || !didRestoreStoredWidthRef.current) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 220);

    didRestoreStoredWidthRef.current = false;

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [chatPanelWidth]);

  useEffect(() => {
    if (typeof window === 'undefined' || chatPanelWidth === null) return;
    window.localStorage.setItem(CHAT_PANEL_STORAGE_KEY, String(chatPanelWidth));
  }, [chatPanelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (resizeStartXRef.current === null || resizeStartWidthRef.current === null) return;
      const delta = event.clientX - resizeStartXRef.current;
      // Delta positive = gutter moved RIGHT = chat GROWS (chat is on the left)
      setChatPanelWidth(clampChatWidth(resizeStartWidthRef.current + delta));
      // Notify Mapbox GL (listens to window resize natively) that layout changed
      window.dispatchEvent(new Event('resize'));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
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
  }, [clampChatWidth, isResizing]);

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    resizeStartXRef.current = event.clientX;
    const currentWidth = chatPanelWidth
      ?? (containerRef.current
        ? Math.floor((containerRef.current.clientWidth - GUTTER_WIDTH) / 2)
        : 480);
    resizeStartWidthRef.current = currentWidth;
    setIsResizing(true);
  }, [chatPanelWidth]);

  return {
    chatPanelWidth,
    isResizing,
    containerRef,
    handleResizeStart,
  };
}
