import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ChatHeader from './ChatHeader';
import ChatInputDock from './shell/ChatInputDock';
import ChatEmptyState from './shell/ChatEmptyState';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import { OrbitMark } from '@/components/meridian';
import MissingFieldsInputPrompt from '@/features/trip-planner/components/MissingFieldsInputPrompt';
import DiscoveryMapPreview from './DiscoveryMapPreview';
import RecommendedPlacesList from './RecommendedPlacesList';
import type { ChatSuggestedAction, MessageRow } from '../types/chat';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import { ArrowUpFromLine, Hotel, Map, Plane, Search, Sparkles } from 'lucide-react';
import { deriveConversationGaps, extractRecommendedPlacesFromMeta, getDiscoveryVisualConfig } from '../services/conversationOrchestrator';
import { resolveRenderPolicy } from '../services/itineraryPipeline';
import type { DiscoveryContext } from '../services/discoveryService';
import { extractBridgeTurnProps, type BridgeChatMode } from '../utils/extractBridgeTurnProps';
import { getTypingStatusCopy, normalizeSupportedLanguage } from '@/features/chat/i18n/chatResultCopy';

interface ChatInterfaceProps {
  selectedConversation: string | null;
  message: string;
  isLoading: boolean;
  isTyping: boolean;
  typingMessage?: string;
  isUploadingPdf: boolean;
  isAddingToCRM: boolean;
  messages: MessageRow[];
  refreshMessages: () => void;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onPdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAddToCRM: () => void;
  onPdfGenerated: (pdfUrl: string, selectedFlights: GlobalFlightData[], selectedHotels: GlobalHotelData[]) => Promise<void>;
  onBackToList?: () => void;
  onGoToPlanner?: () => void;
  /**
   * "Agregar al itinerario" handlers wired from ChatFeature → useTripPlanner.
   * When passed down to MessageItem and RecommendedPlacesList, the chat
   * switches the cards to cart mode (button per card, no inline PDF).
   */
  onAddFlight?: (flight: GlobalFlightData) => void;
  onAddHotel?: (hotel: GlobalHotelData) => void;
  onAddPlace?: (place: {
    name: string;
    description?: string;
    category: string;
    suggestedSlot: 'morning' | 'afternoon' | 'evening';
    segmentCity: string;
    placeId?: string;
    formattedAddress?: string;
    photoUrls?: string[];
    rating?: number;
    userRatingsTotal?: number;
  }) => void;
  /**
   * PR 3 (C5): account type gates the agent-only chrome in ChatHeader and
   * (post-C6) the ModeSwitch. Replaces the pre-C5 `mode: 'companion' |
   * 'standard'` prop. `accountType === 'consumer'` is the former `companion`;
   * `accountType === 'agent'` is the former `standard`.
   */
  accountType: 'consumer' | 'agent';
  /**
   * PR 3 (C5): strict chat mode for agents. Propagated to ChatHeader so C6
   * can render the ModeSwitch with the active mode. Ignored when accountType
   * is 'consumer'.
   */
  mode?: 'agency' | 'passenger';
  /**
   * PR 3 (C4 prop shape, C5 wires it): bridge chip handlers. `onBridgeSwitch`
   * receives the suggested mode AND the original user text so ChatFeature can
   * flip mode + replay without reaching back into the messages array itself.
   * Both optional; when undefined (consumer branch) the chips no-op.
   */
  onBridgeSwitch?: (suggestedMode: BridgeChatMode, originalText: string) => void;
  onBridgeStay?: (originalText: string) => void;
  /** @deprecated Chips now call onChipInsert. Retained so existing ChatFeature call sites compile without changes; remove once all callers are migrated. */
  onSuggestedAction?: (prompt: string) => void;
  onChipInsert?: (text: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  /**
   * PR 3 (C6): forwarded to ChatHeader so the ModeSwitch can render. Both
   * optional — when missing (consumer branch) the switch doesn't render.
   */
  hasAgency?: boolean;
  onModeChange?: (next: 'agency' | 'passenger') => void;
  headerVisibility?: 'default' | 'mobile-only' | 'hidden';
}

const ChatInterface = React.memo(({
  selectedConversation,
  message,
  isLoading,
  isTyping,
  typingMessage,
  isUploadingPdf,
  isAddingToCRM,
  messages,
  refreshMessages,
  onMessageChange,
  onSendMessage,
  onPdfUpload,
  onAddToCRM,
  onPdfGenerated,
  onBackToList,
  onGoToPlanner,
  onAddFlight,
  onAddHotel,
  onAddPlace,
  accountType,
  mode,
  onBridgeSwitch,
  onBridgeStay,
  onSuggestedAction,
  onChipInsert,
  inputRef,
  hasAgency,
  onModeChange,
  headerVisibility = 'default',
}: ChatInterfaceProps) => {
  const { t, i18n } = useTranslation('chat');
  const typingCopy = getTypingStatusCopy(normalizeSupportedLanguage(i18n.language));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Contador de profundidad para manejar drag sobre elementos hijos
  const dragDepthRef = useRef(0);

  // Filter out system contextual memory messages
  const visibleMessages = messages.filter((m: MessageRow) => {
    const meta = m.meta as Record<string, unknown> | null;
    // Hide system memory/context messages
    if (m.role === 'system' && meta && (meta.messageType === 'contextual_memory' || meta.messageType === 'context_state' || meta.messageType === 'trip_planner_state' || meta.messageType === 'conversation_summary')) return false;
    return true;
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleMessages.length, isTyping]);

  // ⚡ OPTIMIZATION: Removed redundant refreshMessages call
  // Messages are already loaded by useMessages hook in useChat.ts (line 394)
  // This was causing DOUBLE SELECT on every conversation change (~50-150ms wasted)

  // Add CSS animations to head (only once)
  useEffect(() => {
    if (document.querySelector('#chat-animations')) return; // Already added

    const style = document.createElement('style');
    style.id = 'chat-animations';
    style.textContent = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes fadeInOut {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.querySelector('#chat-animations');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  // Función para resetear el estado de drag (usada por múltiples handlers)
  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
  }, []);

  // Handle drag and drop for PDF files
  // Usamos dragenter/dragleave con contador de profundidad para detectar correctamente
  // cuando el cursor entra/sale del contenedor vs elementos hijos
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragDepthRef.current++;
    
    // Solo mostrar overlay si hay archivos en el drag
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Necesario para permitir el drop, pero no cambiamos estado aquí
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragDepthRef.current--;
    
    // Solo ocultar cuando realmente salimos del contenedor (depth = 0)
    if (dragDepthRef.current <= 0) {
      resetDragState();
    }
  }, [resetDragState]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resetDragState();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check if it's a PDF
      if (file.type === 'application/pdf') {
        // Create a synthetic event to match the expected type
        const syntheticEvent = {
          target: {
            files: files
          }
        } as React.ChangeEvent<HTMLInputElement>;

        onPdfUpload(syntheticEvent);
      } else {
        // You could show a toast here for invalid file type
        console.warn('Only PDF files are supported');
      }
    }
  }, [onPdfUpload, resetDragState]);

  // Listeners globales para casos edge: drop fuera de ventana, ESC, cambio de pestaña
  useEffect(() => {
    // Handler para drop en window (usuario suelta fuera del área de chat)
    const handleWindowDrop = (e: DragEvent) => {
      // Solo resetear si estamos mostrando el overlay
      if (isDraggingOver) {
        resetDragState();
      }
    };

    // Handler para dragend (drag cancelado o terminado)
    const handleWindowDragEnd = () => {
      resetDragState();
    };

    // Handler para ESC key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingOver) {
        resetDragState();
      }
    };

    // Handler para blur/visibilitychange (cambio de pestaña o ventana)
    const handleVisibilityChange = () => {
      if (document.hidden && isDraggingOver) {
        resetDragState();
      }
    };

    const handleWindowBlur = () => {
      // Pequeño delay para evitar falsos positivos al hacer click en el overlay
      setTimeout(() => {
        if (isDraggingOver) {
          resetDragState();
        }
      }, 100);
    };

    // Handler para cuando el mouse sale de la ventana completamente
    const handleMouseLeave = (e: MouseEvent) => {
      // Si salimos de la ventana mientras arrastramos
      if (isDraggingOver && !e.relatedTarget) {
        resetDragState();
      }
    };

    // Registrar listeners
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragend', handleWindowDragEnd);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Cleanup
    return () => {
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragend', handleWindowDragEnd);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDraggingOver, resetDragState]);

  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
  const lastMeta = (lastVisibleMessage?.meta as Record<string, unknown> | undefined) || undefined;
  const lastConversationTurn = (lastMeta?.conversationTurn as { responseMode?: string } | undefined) || undefined;
  const lastResponseMode = (lastConversationTurn?.responseMode || lastMeta?.responseMode || 'standard') as string;
  const renderPolicy = resolveRenderPolicy(lastResponseMode);
  const isShowPlacesTurn = lastResponseMode === 'show_places';
  const isFirstPlanProposal = renderPolicy.showPlannerCta && !renderPolicy.showCombinedCards;
  const discoveryContext = (lastMeta?.discoveryContext as DiscoveryContext | undefined) || undefined;
  const lastRecommendedPlaces = extractRecommendedPlacesFromMeta(lastMeta);
  const lastConversationGaps = deriveConversationGaps(lastMeta, normalizeSupportedLanguage(i18n.language));
  const suggestedActions = Array.isArray(lastMeta?.suggestedActions)
    ? (lastMeta.suggestedActions as ChatSuggestedAction[])
        .filter((action) => typeof action?.label === 'string' && typeof action?.prompt === 'string')
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
        .slice(0, 3)
    : [];
  // Quick-action chips for inferred defaults (Emilia transparency).
  // We surface a chip for each value Emilia inferred (adults default, one-way trip type,
  // origin from geolocation, etc.) so users can correct in one tap.
  // Phase 3 / sub-task C: prefer `meta.emiliaNarrative.chips` when the message
  // carries narrative-emitted chips. Fall back to deriving chips from the
  // legacy `meta.emiliaRoute.inferredFields` so older message history (pre-
  // Phase 3) keeps rendering the same chip set.
  const emiliaRoute = lastMeta?.emiliaRoute as { inferredFields?: unknown } | undefined;
  const inferredFieldList = Array.isArray(emiliaRoute?.inferredFields)
    ? (emiliaRoute.inferredFields as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];
  const inferredFieldSet = new Set(inferredFieldList);
  type NarrativeChipShape = {
    id: string;
    label: string;
    icon?: string;
    // kind preserved for schema back-compat; the call site now treats 'submit' and 'prefill' identically via onChipInsert.
    action: { kind: 'submit' | 'prefill'; text: string };
  };
  const emiliaNarrative = lastMeta?.emiliaNarrative as { chips?: unknown } | undefined;
  const narrativeChips: NarrativeChipShape[] = Array.isArray(emiliaNarrative?.chips)
    ? (emiliaNarrative!.chips as unknown[]).filter((chip): chip is NarrativeChipShape => {
        if (!chip || typeof chip !== 'object') return false;
        const c = chip as Record<string, unknown>;
        const action = c.action as Record<string, unknown> | undefined;
        return (
          typeof c.id === 'string' &&
          typeof c.label === 'string' &&
          !!action &&
          (action.kind === 'submit' || action.kind === 'prefill') &&
          typeof action.text === 'string'
        );
      })
    : [];
  const hasNarrativeChips = narrativeChips.length > 0;
  const lastMessageText = typeof lastVisibleMessage?.content === 'string'
    ? lastVisibleMessage.content
    : (lastVisibleMessage?.content as { text?: string } | undefined)?.text || '';
  const discoveryVisual = isShowPlacesTurn
    ? getDiscoveryVisualConfig(
        (lastMeta?.requestText as string | undefined) || lastMessageText,
        lastRecommendedPlaces[0]?.city,
        normalizeSupportedLanguage(i18n.language),
      )
    : null;

  return (
    <div
      className="flex-1 flex flex-col h-full relative min-w-0"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={headerVisibility === 'hidden' ? 'hidden' : headerVisibility === 'mobile-only' ? 'md:hidden' : undefined}>
        <ChatHeader
          isTyping={isTyping}
          isAddingToCRM={isAddingToCRM}
          selectedConversation={selectedConversation}
          messagesCount={messages.length}
          onAddToCRM={onAddToCRM}
          onBackToList={onBackToList}
          accountType={accountType}
          mode={mode}
          hasAgency={hasAgency}
          onModeChange={onModeChange}
        />
      </div>

      {/* Drag and Drop Overlay — Meridian glass */}
      {isDraggingOver && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none meridian-glass-strong rounded-3xl m-3 border-2 border-dashed border-primary/60"
          aria-live="polite"
          role="status"
        >
          <div className="text-center px-6">
            <ArrowUpFromLine className="h-14 w-14 text-primary mx-auto mb-4 animate-bounce" />
            <p className="font-display italic text-2xl text-foreground tracking-tight">{t('dragDrop.title')}</p>
            <p className="text-sm text-muted-foreground mt-2 font-sans">{t('dragDrop.hint')}</p>
            <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground/60 mt-3 uppercase">{t('dragDrop.cancel')}</p>
          </div>
        </div>
      )}

      {/* Messages area - scrollable with fixed height */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0 min-w-0"
      >
        <div className="space-y-3 md:space-y-4">
          {/* Inline skeleton while loading messages - only for existing conversations */}
          {isLoading && visibleMessages.length === 0 && selectedConversation && !selectedConversation.startsWith('temp-') ? (
            <div className="space-y-4" aria-busy="true" aria-label={t('dragDrop.loadingMessages')}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-start gap-2">
                  <div className="h-8 w-8 bg-muted/50 animate-pulse rounded-full" />
                  <div className={`flex-1 space-y-2 ${i % 2 === 0 ? 'ml-auto max-w-[75%]' : 'max-w-[75%]'}`}>
                    <div className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {visibleMessages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  onPdfGenerated={onAddFlight || onAddHotel ? undefined : onPdfGenerated}
                  onGoToPlanner={onGoToPlanner}
                  onAddFlight={onAddFlight}
                  onAddHotel={onAddHotel}
                />
              ))}
              {/* Guided input for any turn that surfaces missing fields (validation
                  fallbacks emit 'missing_info_request'; ask_minimal emits 'collect_question').
                  Only renders for fields with a specialized control (chips/stepper/calendar/buttons)
                  to avoid duplicating the bottom ChatInput for plain text answers. */}
              {(() => {
                const meta = lastMeta;
                const conversationTurn = meta?.conversationTurn as Record<string, unknown> | undefined;
                const resolvedMessageType = conversationTurn?.messageType || meta?.messageType;
                const resolvedMissingFields = (
                  meta?.normalizedMissingFields ||
                  meta?.missingFields ||
                  conversationTurn?.normalizedMissingFields ||
                  []
                ) as string[];
                const GUIDED_FIELDS = new Set(['confirmation', 'budget', 'dates', 'passengers']);
                const primaryField = resolvedMissingFields[0];
                const needsGuidedInput = !isShowPlacesTurn
                  && (resolvedMessageType === 'missing_info_request' || resolvedMessageType === 'collect_question')
                  && resolvedMissingFields.length > 0
                  && GUIDED_FIELDS.has(primaryField);
                if (needsGuidedInput && !isLoading) {
                  return (
                    <div className="px-4 py-2">
                      <MissingFieldsInputPrompt
                        missingFields={resolvedMissingFields}
                        pendingAction={meta.pendingAction}
                        onSubmit={(text) => {
                          onMessageChange(text);
                          setTimeout(() => onSendMessage(), 50);
                        }}
                      />
                    </div>
                  );
                }
                return null;
              })()}
              {lastVisibleMessage?.role === 'assistant' && lastRecommendedPlaces.length > 0 && !isLoading && !isFirstPlanProposal && (
                <RecommendedPlacesList
                  places={lastRecommendedPlaces}
                  title={discoveryVisual?.title}
                  subtitle={discoveryVisual?.subtitle}
                  addLabel={discoveryVisual?.primaryCtaLabel}
                  exploreLabel={discoveryVisual?.secondaryCtaLabel}
                  onAdd={(place) => {
                    if (onAddPlace) {
                      onAddPlace({
                        name: place.name,
                        description: place.description,
                        category: place.category,
                        suggestedSlot: place.suggestedSlot ?? 'morning',
                        segmentCity: place.city,
                        placeId: place.placeId,
                        photoUrls: place.photoUrl ? [place.photoUrl] : undefined,
                      });
                      return;
                    }
                    // Legacy fallback: send a chat message asking to add the place
                    onMessageChange(isShowPlacesTurn
                      ? t('recommendedPlaces.saveAsHighlight', { name: place.name, city: place.city })
                      : t('recommendedPlaces.addToItinerary', { name: place.name, city: place.city }));
                    setTimeout(() => onSendMessage(), 50);
                  }}
                  onExplore={(place) => {
                    onMessageChange(isShowPlacesTurn
                      ? t('recommendedPlaces.showMorePlaces', { name: place.name, city: place.city })
                      : t('recommendedPlaces.tellMeMore', { name: place.name, city: place.city }));
                    setTimeout(() => onSendMessage(), 50);
                  }}
                />
              )}
              {lastVisibleMessage?.role === 'assistant' && isShowPlacesTurn && !isFirstPlanProposal && discoveryContext && !isLoading && (
                <DiscoveryMapPreview discoveryContext={discoveryContext} />
              )}
              {lastVisibleMessage?.role === 'assistant' && lastConversationGaps.length > 0 && !isLoading && (
                <div className="mx-4 mb-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 animate-in fade-in duration-300">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{t('recommendedPlaces.contextGap')}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {lastConversationGaps.map((gap) => (
                      <span key={gap.key}>{gap.label}</span>
                    ))}
                  </div>
                </div>
              )}
              {lastVisibleMessage?.role === 'assistant' && suggestedActions.length > 0 && !isLoading && !isTyping && (
                <div className="flex flex-wrap gap-2 px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {suggestedActions.map((action) => {
                    const Icon =
                      action.type === 'flight' ? Plane :
                      action.type === 'hotel' ? Hotel :
                      action.type === 'itinerary' ? Map :
                      action.type === 'quote' ? Sparkles :
                      Search;

                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => onChipInsert?.(action.prompt)}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/60 bg-background px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                        title={action.prompt}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Inferred-default chips: surface a 1-tap correction for each value Emilia
                  assumed (adults default, one-way trip type, origin from geolocation, etc.).
                  Mirrors the Gere "reglas default" §4.3 / §11 product spec.
                  - "Buscar ida y vuelta" auto-submits a follow-up that re-runs the parser.
                  - "Cambiar pasajeros" / "Cambiar origen" pre-fill the input so the user can finish typing.
                  Phase 3 / sub-task C: prefer narrative-emitted chips when present
                  (`meta.emiliaNarrative.chips`), and fall back to deriving the chip set
                  from the legacy `meta.emiliaRoute.inferredFields` so existing message
                  history (pre-Phase 3) renders identically. */}
              {lastVisibleMessage?.role === 'assistant' && hasNarrativeChips && !isLoading && !isTyping && (
                <div
                  data-testid="inferred-defaults-chips"
                  className="flex flex-wrap gap-2 px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {narrativeChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => onChipInsert?.(chip.action.text)}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/60 bg-background px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{chip.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {lastVisibleMessage?.role === 'assistant' && !hasNarrativeChips && inferredFieldList.length > 0 && !isLoading && !isTyping && (
                <div
                  data-testid="inferred-defaults-chips"
                  className="flex flex-wrap gap-2 px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {inferredFieldSet.has('tripType') && (
                    <button
                      type="button"
                      onClick={() => onChipInsert?.('Convertir a ida y vuelta')}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/60 bg-background px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Plane className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t('chips.changeRoundtrip')}</span>
                    </button>
                  )}
                  {inferredFieldSet.has('adults') && (
                    <button
                      type="button"
                      onClick={() => onChipInsert?.('Somos ')}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/60 bg-background px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t('chips.changePassengers')}</span>
                    </button>
                  )}
                  {inferredFieldSet.has('origin') && (
                    <button
                      type="button"
                      onClick={() => onChipInsert?.('Salimos desde ')}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/60 bg-background px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Map className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t('chips.changeOrigin')}</span>
                    </button>
                  )}
                  {(inferredFieldSet.has('dates') || inferredFieldSet.has('departureDate')) && (
                    <button
                      type="button"
                      onClick={() => onChipInsert?.('Cambiar fecha a ')}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/60 bg-background px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Search className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t('chips.changeDate')}</span>
                    </button>
                  )}
                </div>
              )}
              {/* PR 3 (C4): mode_bridge turn chips — "switch" + "stay". Handlers are optional; C5 wires them from ChatFeature. */}
              {(() => {
                if (isLoading || isTyping) return null;
                const bridge = extractBridgeTurnProps(visibleMessages);
                if (!bridge || !bridge.canRender) return null;
                const otherLabel = t(`mode.${bridge.suggestedMode}`);
                return (
                  <div className="flex flex-wrap gap-2 px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <button
                      onClick={() => onBridgeSwitch?.(bridge.suggestedMode, bridge.originalUserText)}
                      className="text-sm px-3 py-1.5 rounded-full border border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      {t('mode.bridgeSwitchTo', { otherMode: otherLabel })}
                    </button>
                    <button
                      onClick={() => onBridgeStay?.(bridge.originalUserText)}
                      className="text-sm px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                    >
                      {t('mode.bridgeStay')}
                    </button>
                  </div>
                );
              })()}
            </>
          )}

          {isTyping && (
            <div className="flex items-start gap-2 md:gap-3 animate-in fade-in duration-300">
              <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center">
                <OrbitMark size={36} animated />
              </div>
              <div className="flex-1 meridian-glass rounded-3xl p-3 md:p-4 max-w-[85%] md:max-w-[80%]">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '0.6s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '0.6s' }}></div>
                  </div>
                  <span className="font-utility text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground animate-pulse">
                    {typingMessage || typingCopy.thinking}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area - always fixed at bottom */}
      <div className="flex-shrink-0">
        <ChatInputDock
          value={message}
          onChange={onMessageChange}
          onSend={onSendMessage}
          disabled={isLoading}
          isUploadingPdf={isUploadingPdf}
          onPdfUpload={onPdfUpload}
          selectedConversation={selectedConversation}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
