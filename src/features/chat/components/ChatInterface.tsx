import React, { useEffect, useRef, useState, useCallback } from 'react';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import PlannerAgentInputPrompt from '@/features/trip-planner/components/PlannerAgentInputPrompt';
import PlannerChatHotelCard from '@/features/trip-planner/components/PlannerChatHotelCard';
import PlannerChatFlightCard from '@/features/trip-planner/components/PlannerChatFlightCard';
import DiscoveryMapPreview from './DiscoveryMapPreview';
import RecommendedPlacesList from './RecommendedPlacesList';
import type { MessageRow, LocalHotelData, FlightData } from '../types/chat';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import { ArrowUpFromLine } from 'lucide-react';
import { deriveConversationGaps, extractRecommendedPlacesFromMeta, getDiscoveryVisualConfig } from '../services/conversationOrchestrator';
import { resolveRenderPolicy } from '../services/itineraryPipeline';
import type { DiscoveryContext } from '../services/discoveryService';

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
  /** Forwarded to ChatHeader to hide agent-only chrome in companion mode. */
  mode?: 'companion' | 'standard';
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
  mode = 'standard'
}: ChatInterfaceProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Contador de profundidad para manejar drag sobre elementos hijos
  const dragDepthRef = useRef(0);

  // Filter out system contextual memory messages
  const visibleMessages = messages.filter((m: MessageRow) => {
    const meta = (m as any).meta;
    // Hide system memory/context messages
    if (m.role === 'system' && meta && (meta.messageType === 'contextual_memory' || meta.messageType === 'context_state' || meta.messageType === 'trip_planner_state')) return false;
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
  const lastConversationGaps = deriveConversationGaps(lastMeta);
  const lastMessageText = typeof lastVisibleMessage?.content === 'string'
    ? lastVisibleMessage.content
    : (lastVisibleMessage?.content as { text?: string } | undefined)?.text || '';
  const discoveryVisual = isShowPlacesTurn
    ? getDiscoveryVisualConfig(((lastMeta as any)?.requestText as string | undefined) || lastMessageText, lastRecommendedPlaces[0]?.city)
    : null;

  return (
    <div
      className="flex-1 flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ChatHeader
        isTyping={isTyping}
        isAddingToCRM={isAddingToCRM}
        selectedConversation={selectedConversation}
        messagesCount={messages.length}
        onAddToCRM={onAddToCRM}
        onBackToList={onBackToList}
        mode={mode}
      />

      {/* Drag and Drop Overlay - pointer-events-none para no interferir con drag events */}
      {isDraggingOver && (
        <div 
          className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none"
          aria-live="polite"
          role="status"
        >
          <div className="text-center">
            <ArrowUpFromLine className="h-16 w-16 text-primary mx-auto mb-4 animate-bounce" />
            <p className="text-xl font-semibold text-primary">Suelta el PDF aquí</p>
            <p className="text-sm text-muted-foreground mt-2">Solo archivos PDF (máx. 10MB)</p>
            <p className="text-xs text-muted-foreground mt-1">Presiona ESC para cancelar</p>
          </div>
        </div>
      )}

      {/* Messages area - scrollable with fixed height */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0"
      >
        <div className="space-y-3 md:space-y-4">
          {/* Inline skeleton while loading messages - only for existing conversations */}
          {isLoading && visibleMessages.length === 0 && selectedConversation && !selectedConversation.startsWith('temp-') ? (
            <div className="space-y-4" aria-busy="true" aria-label="Cargando mensajes">
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
                  onPdfGenerated={onPdfGenerated}
                  onGoToPlanner={onGoToPlanner}
                />
              ))}
              {/* Guided input for planner-agent missing info requests */}
              {(() => {
                const meta = lastMeta as any;
                const conversationTurn = meta?.conversationTurn;
                const resolvedMessageType = conversationTurn?.messageType || meta?.messageType;
                const resolvedMissingFields = meta?.normalizedMissingFields || meta?.missingFields || conversationTurn?.normalizedMissingFields || [];
                const needsGuidedInput = !isShowPlacesTurn && (resolvedMessageType === 'missing_info_request' || resolvedMessageType === 'collect_question')
                  && resolvedMissingFields.length > 0;
                if (needsGuidedInput && !isLoading) {
                  return (
                    <div className="px-4 py-2">
                      <PlannerAgentInputPrompt
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
              {/* Inline hotel/flight cards from planner-agent */}
              {(() => {
                const lastMsg = lastVisibleMessage;
                const meta = lastMeta as any;
                if (meta?.source === 'planner-agent' && meta?.combinedData && lastMsg?.role === 'assistant' && !isLoading && !isFirstPlanProposal) {
                  const hotels = (meta.combinedData.hotels as LocalHotelData[] | undefined)?.slice(0, 3);
                  const flights = (meta.combinedData.flights as FlightData[] | undefined)?.slice(0, 3);
                  const city = meta.combinedData.searchCity || '';
                  const travelers = meta.combinedData.travelers?.adults ?? 2;
                  const hasCards = (hotels?.length ?? 0) > 0 || (flights?.length ?? 0) > 0;

                  if (!hasCards) return null;

                  return (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {hotels && hotels.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                          {hotels.map((hotel, i) => (
                            <PlannerChatHotelCard
                              key={hotel.hotel_id || hotel.name || i}
                              hotel={hotel}
                              segmentCity={city || hotel.city}
                              onAdd={(h) => {
                                onMessageChange(`Agregá el hotel ${h.name} al itinerario`);
                                setTimeout(() => onSendMessage(), 50);
                              }}
                              onViewDetails={(h) => {
                                onMessageChange(`Contame más sobre el hotel ${h.name}`);
                                setTimeout(() => onSendMessage(), 50);
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {flights && flights.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                          {flights.map((flight, i) => (
                            <PlannerChatFlightCard
                              key={flight.id || i}
                              flight={flight}
                              travelers={travelers}
                              onSelect={(f) => {
                                onMessageChange(`Seleccioná el vuelo de ${f.airline?.name || 'la aerolínea'}`);
                                setTimeout(() => onSendMessage(), 50);
                              }}
                              onViewAlternatives={() => {
                                onMessageChange('Mostrá más opciones de vuelo');
                                setTimeout(() => onSendMessage(), 50);
                              }}
                            />
                          ))}
                        </div>
                      )}
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
                    onMessageChange(isShowPlacesTurn
                      ? `Guardá ${place.name} como imperdible en ${place.city}`
                      : `Sumá ${place.name} en ${place.city} al itinerario`);
                    setTimeout(() => onSendMessage(), 50);
                  }}
                  onExplore={(place) => {
                    onMessageChange(isShowPlacesTurn
                      ? `Mostrame más lugares como ${place.name} en ${place.city}`
                      : `Contame más sobre ${place.name} en ${place.city}`);
                    setTimeout(() => onSendMessage(), 50);
                  }}
                />
              )}
              {lastVisibleMessage?.role === 'assistant' && isShowPlacesTurn && !isFirstPlanProposal && discoveryContext && !isLoading && (
                <DiscoveryMapPreview discoveryContext={discoveryContext} />
              )}
              {lastVisibleMessage?.role === 'assistant' && lastConversationGaps.length > 0 && !isLoading && (
                <div className="mx-4 mb-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 animate-in fade-in duration-300">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Para seguir avanzando:</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {lastConversationGaps.map((gap) => (
                      <span key={gap.key}>{gap.label}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Action chips from planner-agent */}
              {(() => {
                const lastMsg = lastVisibleMessage;
                const meta = lastMeta as any;
                if (!isShowPlacesTurn && meta?.actionChips?.length > 0 && lastMsg?.role === 'assistant' && !isLoading && !isTyping) {
                  return (
                    <div className="flex flex-wrap gap-2 px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {(meta.actionChips as Array<{ label: string; message: string }>).map((chip: { label: string; message: string }, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            onMessageChange(chip.message);
                            setTimeout(() => onSendMessage(), 50);
                          }}
                          className="text-sm px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {isTyping && (
            <div className="flex items-start gap-2 md:gap-3 animate-in fade-in duration-300">
              <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <span className="text-base md:text-lg">🤖</span>
              </div>
              <div className="flex-1 bg-muted/50 border border-primary/10 rounded-2xl p-3 md:p-4 max-w-[85%] md:max-w-[80%]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex gap-1 md:gap-1.5">
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }}></div>
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '0.6s' }}></div>
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '0.6s' }}></div>
                    </div>
                    <span className="text-xs md:text-sm font-medium text-foreground/80 animate-pulse">
                      {typingMessage || 'Pensando...'}
                    </span>
                  </div>
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
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
