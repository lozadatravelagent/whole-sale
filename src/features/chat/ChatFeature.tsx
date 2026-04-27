import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UnifiedLayout from '@/components/layouts/UnifiedLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useConversationSearch } from '@/hooks/useChat';
import { updateLeadWithPdfData, diagnoseCRMIntegration, createComprehensiveLeadFromChat } from '@/utils/chatToLead';
import type { FlightData as GlobalFlightData, HotelData as GlobalHotelData } from '@/types';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ContextState } from './types/contextState';
import type { ConversationWithAgency, ConversationWorkspaceMode } from './types/chat';
import type { PreloadedConversationKnowledge } from './types/knowledge';

// Import feature components and hooks
import ChatSidebar from './components/ChatSidebar';
import ChatSidebarCompanion from './components/ChatSidebarCompanion';
import ChatInterface from './components/ChatInterface';
import ChatSidebarFrame from './components/ChatSidebarFrame';
import EmptyState from './components/EmptyState';
import useChatState from './hooks/useChatState';
import ChatContextPanel from './components/ChatContextPanel';
import { ChatWorkspaceHeaderActions, ChatWorkspaceHeaderContext } from './components/ChatWorkspaceHeader';
import { getLatestDiscoveryContext, hasChatContextPanelContent } from './utils/chatContextPanel';
import useContextualMemory from './hooks/useContextualMemory';
import usePdfAnalysis from './hooks/usePdfAnalysis';
import useMessageHandler from './hooks/useMessageHandler';
import { addMessageViaSupabase } from './services/messageService';
import { preloadConversationKnowledge } from './services/conversationKnowledgeService';
import TripPlannerWorkspace from '@/features/trip-planner/components/TripPlannerWorkspace';
import useTripPlanner from '@/features/trip-planner/useTripPlanner';
import { buildPlannerPromptContext } from '@/features/trip-planner/utils';
import { deriveDefaultMode, type ChatMode } from './utils/deriveDefaultMode';
import { generateItineraryPdf } from '@/services/pdf/itineraryPdfGenerator';

interface ChatFeatureProps {
  mode?: 'b2b' | 'companion';
}

const ChatFeature = ({ mode = 'b2b' }: ChatFeatureProps = {}) => {
  const navigate = useNavigate();
  const { isOwner, isSuperAdmin, user } = useAuth();
  // PR 3 (C5): chat mode for agents. Lives in component state (not useChatState)
  // so it persists across conversations in the same session and never resets on
  // conversation switch / createNewChat. Consumers don't use it; `chatMode` is
  // passed to `useMessageHandler` only when accountType === 'agent'.
  const [chatMode, setChatMode] = useState<ChatMode>(() => deriveDefaultMode(user));
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  // PR 3 (C6): reactive derivation of agency availability. Inline expression
  // (no useMemo) — the bool is cheap and re-derives on every ChatFeature
  // render. Reactivity comes from AuthContext re-rendering this component
  // when `user` updates (admin assigns an agency on a live session, etc.).
  const hasAgency = user?.agency_id != null;
  const {
    // State
    selectedConversation,
    message,
    isLoading,
    isTyping,
    typingMessage,
    activeTab,
    workspaceMode,
    historyMode,
    sidebarLimit,
    previousParsedRequest,
    isAddingToCRM,

    // Related data
    conversations,

    // Setters
    setSelectedConversation,
    setMessage,
    setIsLoading,
    setIsTyping,
    setTypingMessage,
    setActiveTab,
    setWorkspaceMode,
    setHistoryMode,
    setPreviousParsedRequest,
    setIsAddingToCRM,

    // Actions
    createNewChat,
    updateConversationState,
    updateConversationTitle,

    // Refs
    selectedConversationRef,

    // Utils
    toast
  } = useChatState({ defaultWorkspaceMode: mode === 'companion' ? 'companion' : 'standard' });

  const {
    messages,
    loading: messagesLoading,
    updateMessageStatus,
    loadMessages,
    refreshMessages,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage
  } = useMessages(selectedConversation);

  const { searchResults, searching, searchMessages, clearSearch } = useConversationSearch();

  // Contextual memory hooks
  const {
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    loadContextState,
    saveContextState,
  } = useContextualMemory();

  // Preload context when conversation changes to avoid DB calls during message send
  const [preloadedContext, setPreloadedContext] = useState<PreloadedConversationKnowledge | null>(null);

  useEffect(() => {
    if (!selectedConversation || selectedConversation.startsWith('temp-')) {
      setPreloadedContext(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      loadContextualMemory(selectedConversation),
      loadContextState(selectedConversation) as Promise<ContextState | null>,
    ]).then(async ([mem, state]) => {
      const knowledge = await preloadConversationKnowledge({
        conversationId: selectedConversation,
        contextualMemory: mem,
        contextState: state,
      });

      if (!cancelled) {
        setPreloadedContext(knowledge);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedConversation, loadContextualMemory, loadContextState]);

  // Save message to DB and immediately add assistant messages to local state (no Realtime dependency)
  const saveAndDisplayMessage = useCallback(async (messageData: Parameters<typeof addMessageViaSupabase>[0]) => {
    const saved = await addMessageViaSupabase(messageData);
    if (saved && messageData.role === 'assistant') {
      addOptimisticMessage(saved);
    }
    return saved;
  }, [addOptimisticMessage]);

  const conversationScopedMessages = useMemo(() => {
    if (!selectedConversation) {
      return [];
    }

    return messages.filter((message) => message.conversation_id === selectedConversation);
  }, [messages, selectedConversation]);
  const planner = useTripPlanner(selectedConversation, conversationScopedMessages, toast);
  const previousPlannerConversationRef = useRef<string | null>(selectedConversation);
  const [plannerWorkspaceKey, setPlannerWorkspaceKey] = useState<string | null>(selectedConversation);

  const selectedConversationRow = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversation) || null,
    [conversations, selectedConversation]
  );

  const getConversationWorkspaceMode = useCallback((conversation: ConversationWithAgency | null | undefined): ConversationWorkspaceMode => {
    if (conversation?.workspace_mode === 'planner') {
      return 'planner';
    }

    return conversation?.external_key === 'Planificador de Viajes' ? 'planner' : 'standard';
  }, []);

  const conversationLooksLikePlanner = useMemo(() => {
    if (!selectedConversationRow && !conversationScopedMessages.length) {
      return false;
    }

    if (selectedConversationRow?.workspace_mode === 'planner') {
      return true;
    }

    if (planner.plannerState || previousParsedRequest?.requestType === 'itinerary') {
      return true;
    }

    if (selectedConversationRow?.external_key === 'Planificador de Viajes') {
      return true;
    }

    return conversationScopedMessages.some((message) => {
      const meta = message.meta as any;
      const parsedRequest = meta?.parsedRequest || meta?.originalRequest;
      return Boolean(
        meta?.plannerData ||
        meta?.plannerPromptAction === 'open_date_selector' ||
        meta?.plannerDateSelector?.enabled ||
        meta?.messageType === 'trip_planner' ||
        meta?.messageType === 'trip_planner_state' ||
        meta?.messageType === 'planner_date_selection' ||
        (meta?.messageType === 'missing_info_request' && (
          meta?.plannerPromptAction === 'open_date_selector' ||
          meta?.missingFields?.includes?.('exact_dates')
        )) ||
        (meta?.messageType === 'contextual_memory' && parsedRequest?.requestType === 'itinerary') ||
        parsedRequest?.requestType === 'itinerary'
      );
    });
  }, [conversationScopedMessages, planner.plannerState, previousParsedRequest, selectedConversationRow]);

  const latestDiscoveryContext = useMemo(
    () => getLatestDiscoveryContext(conversationScopedMessages),
    [conversationScopedMessages],
  );

  useEffect(() => {
    if (!selectedConversationRow) {
      return;
    }

    const nextWorkspaceMode = getConversationWorkspaceMode(selectedConversationRow);

    if (workspaceMode !== nextWorkspaceMode) {
      setWorkspaceMode(nextWorkspaceMode);
    }

    if (historyMode !== nextWorkspaceMode) {
      setHistoryMode(nextWorkspaceMode);
    }
  }, [getConversationWorkspaceMode, historyMode, selectedConversationRow, setHistoryMode, setWorkspaceMode, workspaceMode]);

  // Keep planner mode for planner-like conversations, including empty "Nuevo plan" chats.
  useEffect(() => {
    if (
      workspaceMode === 'planner' &&
      !isLoading &&
      !isTyping &&
      !planner.isLoadingPlanner &&
      !planner.plannerState &&
      selectedConversation &&
      !selectedConversation.startsWith('temp-') &&
      selectedConversationRow &&
      selectedConversationRow.workspace_mode !== 'planner' &&
      !conversationLooksLikePlanner
    ) {
      setWorkspaceMode('standard');
    }
  }, [
    conversationLooksLikePlanner,
    isLoading,
    isTyping,
    planner.isLoadingPlanner,
    planner.plannerState,
    previousParsedRequest,
    selectedConversation,
    selectedConversationRow,
    setWorkspaceMode,
    workspaceMode,
  ]);

  useEffect(() => {
    if (workspaceMode !== 'planner') {
      previousPlannerConversationRef.current = selectedConversation;
      return;
    }

    const previousConversation = previousPlannerConversationRef.current;
    const nextConversation = selectedConversation;
    const isTempToRealPromotion = Boolean(
      previousConversation?.startsWith('temp-') &&
      nextConversation &&
      !nextConversation.startsWith('temp-')
    );

    if (!isTempToRealPromotion) {
      setPlannerWorkspaceKey(nextConversation);
    }

    previousPlannerConversationRef.current = nextConversation;
  }, [selectedConversation, workspaceMode]);

  // PDF analysis hooks
  const {
    isUploadingPdf,
    handlePdfUpload,
    handleCheaperFlightsSearch,
    handlePriceChangeRequest: handlePdfPriceChange
  } = usePdfAnalysis(
    selectedConversation,
    conversationScopedMessages,
    updateConversationTitle,
    setIsTyping,
    setTypingMessage,
    addOptimisticMessage,
    toast
  );

  // Message handler hook
  const { handleSendMessage: handleSendMessageRaw, handlePlannerDateSelection } = useMessageHandler(
    selectedConversation,
    selectedConversationRef,
    conversationScopedMessages, // Only expose messages from the currently selected conversation
    previousParsedRequest,
    setPreviousParsedRequest,
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    loadContextState,
    saveContextState,
    updateMessageStatus,
    updateConversationTitle,
    handleCheaperFlightsSearch,
    handlePdfPriceChange,
    setIsLoading,
    setIsTyping,
    setMessage,
    toast,
    setTypingMessage,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage
    ,
    workspaceMode === 'planner' && planner.plannerState ? buildPlannerPromptContext(planner.plannerState) : null,
    planner.plannerState,
    planner.persistPlannerState,
    planner.setDraftPlannerFromRequest,
    planner.setPlannerDraftPhase,
    planner.updatePlannerState,
    preloadedContext,
    workspaceMode,
    // PR 3 (C5): pass strict chatMode only for agent accounts. Consumer keeps
    // legacy orchestrator behavior (mode=undefined) — no bridges, no strict
    // routing — preserving pre-PR-3 semantics untouched for B2C.
    user?.accountType === 'agent' ? chatMode : undefined
  );

  // PR 3 (C5): bridge chip handlers. Wired only into the B2B (agent) branch of
  // ChatInterface below. Consumer branch doesn't pass them — the bridge never
  // emits for consumer (chatMode is undefined → legacy orchestrator path).
  //
  // C7.1.a: both handlers pass `mode` explicitly to handleSendMessageRaw so the
  // orchestrator sees the intended mode regardless of React's async setState
  // scheduling. Without the override, `setChatMode(new)` + immediate send runs
  // the handler's closure with the pre-click `chatMode`, and the orchestrator
  // receives the wrong mode (the symptom of the C7 smoke bug).
  const handleBridgeSwitch = useCallback(
    (suggestedMode: ChatMode, originalText: string) => {
      setChatMode(suggestedMode);
      if (originalText && originalText.trim().length > 0) {
        handleSendMessageRaw(originalText, { mode: suggestedMode });
      }
    },
    [handleSendMessageRaw],
  );

  const handleBridgeStay = useCallback(
    (originalText: string) => {
      if (originalText && originalText.trim().length > 0) {
        handleSendMessageRaw(originalText, { forceCurrentMode: true, mode: chatMode });
      }
    },
    [handleSendMessageRaw, chatMode],
  );

  // CTA: Retry with stops when no direct flights
  useEffect(() => {
    const onRetryWithStops = () => {
      if (isLoading) return;
      // Send a minimal message that our parser understands to allow stops
      handleSendMessageRaw('con escalas');
      toast({ title: 'Buscando con escalas', description: 'Reintentando la búsqueda permitiendo conexiones.' });
    };
    window.addEventListener('chat:retryWithStops', onRetryWithStops);
    return () => window.removeEventListener('chat:retryWithStops', onRetryWithStops);
  }, [handleSendMessageRaw, isLoading, toast]);

  // Wrapper for handleSendMessage
  const handleSendMessage = useCallback(() => {
    if (!message.trim() || isLoading) return;
    handleSendMessageRaw(message);
  }, [message, isLoading, handleSendMessageRaw]);

  // Handle Archive conversation
  const handleArchiveConversation = useCallback(async (conversationId: string, currentState: 'active' | 'closed') => {
    try {
      // Toggle state: if active -> archive (closed), if closed -> restore (active)
      const newState = currentState === 'active' ? 'closed' : 'active';

      await updateConversationState(conversationId, newState);

      toast({
        title: currentState === 'active' ? "Conversación archivada" : "Conversación restaurada",
        description: currentState === 'active'
          ? "La conversación ha sido archivada exitosamente"
          : "La conversación ha sido restaurada exitosamente",
      });

      // Switch to the appropriate tab after archiving/restoring
      setActiveTab(currentState === 'active' ? 'archived' : 'active');

      // If we archived the currently selected conversation, deselect it
      if (conversationId === selectedConversation && currentState === 'active') {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error('❌ [ARCHIVE] Error archiving/restoring conversation:', error);
      toast({
        title: "Error",
        description: "No se pudo archivar/restaurar la conversación",
        variant: "destructive"
      });
    }
  }, [selectedConversation, updateConversationState, toast, setActiveTab, setSelectedConversation]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find((item) => item.id === conversationId) || null;
    const nextWorkspaceMode = getConversationWorkspaceMode(conversation);

    setSelectedConversation(conversationId);
    setWorkspaceMode(nextWorkspaceMode);
    setHistoryMode(nextWorkspaceMode);
  }, [conversations, getConversationWorkspaceMode, setHistoryMode, setSelectedConversation, setWorkspaceMode]);

  const handleHistoryModeChange = useCallback((mode: ConversationWorkspaceMode) => {
    setHistoryMode(mode);

    if (!selectedConversationRow) {
      setWorkspaceMode(mode);
      return;
    }

    const selectedMode = getConversationWorkspaceMode(selectedConversationRow);
    if (selectedMode !== mode) {
      setSelectedConversation(null);
      setWorkspaceMode(mode);
    }
  }, [getConversationWorkspaceMode, selectedConversationRow, setHistoryMode, setSelectedConversation, setWorkspaceMode]);

  const handleHistoryTabChange = useCallback((tab: string) => {
    setActiveTab(tab);

    if (!selectedConversationRow) {
      return;
    }

    const shouldKeepSelection =
      (tab === 'active' && selectedConversationRow.state === 'active') ||
      (tab === 'archived' && selectedConversationRow.state === 'closed');

    if (!shouldKeepSelection) {
      setSelectedConversation(null);
    }
  }, [selectedConversationRow, setActiveTab, setSelectedConversation]);

  const handleCreateStandardConversation = useCallback(() => {
    createNewChat(undefined, 'standard');
  }, [createNewChat]);

  const handleCreatePlannerConversation = useCallback(() => {
    createNewChat('Planificador de Viajes', 'planner');
  }, [createNewChat]);

  const handleCreateCompanionConversation = useCallback(() => {
    createNewChat(undefined, 'companion');
  }, [createNewChat]);

  const handleRequestItineraryChanges = useCallback(() => {
    setMessage('Quiero ajustar mi viaje: ');
  }, [setMessage]);

  const handleExportItineraryPdf = useCallback(async () => {
    if (!planner.plannerState) return;
    await generateItineraryPdf(planner.plannerState, user?.agency_id ?? undefined);
  }, [planner.plannerState, user?.agency_id]);

  // Handle Add to CRM button click
  const handleAddToCRM = useCallback(async () => {
    if (!selectedConversation || !conversationScopedMessages.length) {
      toast({
        title: "Error",
        description: "No hay conversación seleccionada o mensajes disponibles",
        variant: "destructive"
      });
      return;
    }

    setIsAddingToCRM(true);

    try {
      console.log('📋 [ADD TO CRM] Starting comprehensive lead creation');

      // Get current conversation
      const conversation = conversations.find(c => c.id === selectedConversation);
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }

      // Get the most recent parsed request from memory or messages
      let parsedRequest = previousParsedRequest;

      // If no parsed request in memory, try to find one in recent messages
      if (!parsedRequest) {
        console.log('🔍 [ADD TO CRM] No parsed request in memory, searching in messages...');

        // First, try to find in assistant messages
        const recentAssistantMessage = conversationScopedMessages
          .filter(msg => msg.role === 'assistant')
          .reverse()
          .find(msg => {
            const meta = msg.meta as any;
            return meta?.originalRequest || meta?.parsedRequest;
          });

        if (recentAssistantMessage) {
          const meta = recentAssistantMessage.meta as any;
          parsedRequest = meta?.originalRequest || meta?.parsedRequest;
          console.log('📊 [ADD TO CRM] Found parsed request in assistant message:', parsedRequest);
        }

        // If still no parsed request, try to find in user messages
        if (!parsedRequest) {
          const recentUserMessage = conversationScopedMessages
            .filter(msg => msg.role === 'user')
            .reverse()
            .find(msg => {
              const meta = msg.meta as any;
              return meta?.parsedRequest;
            });

          if (recentUserMessage) {
            const meta = recentUserMessage.meta as any;
            parsedRequest = meta?.parsedRequest;
            console.log('📊 [ADD TO CRM] Found parsed request in user message:', parsedRequest);
          }
        }
      }

      // Extract budget and flight data from latest PDF if available
      let budgetFromPdf = 0;
      const latestPdfMessage = conversationScopedMessages
        .filter(msg => {
          const hasPdf = typeof msg.content === 'object' && msg.content && 'pdfUrl' in msg.content;
          const metadata = (msg.content as any)?.metadata;
          return hasPdf && metadata?.type === 'pdf_generated';
        })
        .reverse()[0]; // Get the most recent PDF

      if (latestPdfMessage) {
        console.log('📄 [ADD TO CRM] Found latest PDF message, extracting budget and flight data');
        try {
          // Look for combined travel results in the message metadata
          const metadata = (latestPdfMessage.content as any)?.metadata;
          if (metadata?.combinedResults) {
            const { flights, hotels } = metadata.combinedResults;

            // Calculate budget from flights
            if (flights && Array.isArray(flights)) {
              flights.forEach((flight: any) => {
                budgetFromPdf += flight.price?.amount || 0;
              });
            }

            // Calculate budget from hotels
            if (hotels && Array.isArray(hotels)) {
              hotels.forEach((hotel: any) => {
                const cheapestRoom = hotel.rooms?.reduce((cheapest: any, room: any) =>
                  room.total_price < cheapest.total_price ? room : cheapest
                );
                if (cheapestRoom) {
                  budgetFromPdf += cheapestRoom.total_price;
                }
              });
            }

            // If no parsed request found, try to construct one from PDF data
            if (!parsedRequest && flights && Array.isArray(flights) && flights.length > 0) {
              const firstFlight = flights[0];
              console.log('🔧 [ADD TO CRM] Constructing parsed request from PDF flight data:', firstFlight);

              parsedRequest = {
                requestType: 'flights' as const,
                flights: {
                  origin: firstFlight.legs?.[0]?.departure?.city_name || 'Unknown',
                  destination: firstFlight.legs?.[0]?.arrival?.city_name || 'Unknown',
                  departureDate: firstFlight.departure_date || '',
                  returnDate: firstFlight.return_date || undefined,
                  adults: firstFlight.adults || 1,
                  children: firstFlight.childrens || 0,
                  luggage: firstFlight.luggage ? 'checked' : 'none'
                },
                confidence: 0.9,
                originalMessage: 'Reconstructed from PDF data'
              };
              console.log('✅ [ADD TO CRM] Constructed parsed request from PDF:', parsedRequest);
            }
          }
        } catch (error) {
          console.warn('⚠️ [ADD TO CRM] Error extracting data from PDF:', error);
        }
      }

      console.log('📊 [ADD TO CRM] Final parsed request to use:', parsedRequest);
      console.log('💰 [ADD TO CRM] Budget from latest PDF:', budgetFromPdf);

      // Create comprehensive lead
      const leadId = await createComprehensiveLeadFromChat(
        conversation,
        conversationScopedMessages,
        parsedRequest,
        budgetFromPdf > 0 ? budgetFromPdf : undefined
      );

      if (leadId) {
        toast({
          title: "¡Lead creado exitosamente!",
          description: `Lead agregado al CRM con ID: ${leadId}`,
        });

        console.log('✅ [ADD TO CRM] Lead created successfully:', leadId);
      } else {
        throw new Error('No se pudo crear el lead');
      }

    } catch (error) {
      console.error('❌ [ADD TO CRM] Error creating lead:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el lead. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsAddingToCRM(false);
    }
  }, [selectedConversation, conversationScopedMessages, conversations, previousParsedRequest, toast, setIsAddingToCRM]);

  // Handle PDF generated from selectors
  const handlePdfGenerated = useCallback(async (pdfUrl: string, selectedFlights: GlobalFlightData[], selectedHotels: GlobalHotelData[]) => {
    console.log('📄 PDF generated, adding to chat and updating lead:', pdfUrl);
    console.log('🛫 Selected flights:', selectedFlights.length);
    console.log('🏨 Selected hotels:', selectedHotels.length);

    if (!selectedConversation) {
      console.warn('❌ No conversation selected, cannot add PDF message');
      return;
    }

    try {
      // Add PDF message from Emilia (assistant)
      await saveAndDisplayMessage({
        conversation_id: selectedConversation,
        role: 'assistant' as const,
        content: {
          text: '¡He generado tu cotización de viaje! 📄✈️🏨\n\nPuedes descargar el PDF con todos los detalles de tu viaje combinado.',
          pdfUrl: pdfUrl,
          metadata: {
            type: 'pdf_generated',
            source: 'combined_travel_pdf',
            timestamp: new Date().toISOString(),
            selectedFlights: selectedFlights.length,
            selectedHotels: selectedHotels.length,
            combinedResults: {
              flights: selectedFlights,
              hotels: selectedHotels
            }
          }
        },
        meta: {
          status: 'sent',
          messageType: 'pdf_delivery'
        }
      });

      // Run CRM diagnosis before updating
      console.log('🔍 Running CRM diagnosis...');
      await diagnoseCRMIntegration(selectedConversation);

      // Update lead with PDF data
      console.log('📋 Updating lead with PDF data...');
      const leadId = await updateLeadWithPdfData(
        selectedConversation,
        pdfUrl,
        selectedFlights,
        selectedHotels
      );

      if (leadId) {
        console.log('✅ Lead updated successfully with PDF data, Lead ID:', leadId);
        toast({
          title: "PDF Generado y Lead Actualizado",
          description: "Tu cotización se ha generado y el lead se ha actualizado en el CRM.",
        });
      } else {
        console.warn('⚠️ PDF generated but lead update failed');
        toast({
          title: "PDF Generado",
          description: "Tu cotización se ha generado y agregado al chat.",
        });
      }

      console.log('✅ PDF message added to chat successfully');

    } catch (error) {
      console.error('❌ Error adding PDF message to chat or updating lead:', error);
      toast({
        title: "PDF Generado",
        description: "Tu cotización se ha generado exitosamente.",
      });
    }
  }, [selectedConversation, toast, saveAndDisplayMessage]);

  // Handle new message from empty state
  const handleSendNewMessage = useCallback(async (messageToSend: string) => {
    console.log('🚀 [NEW CHAT] Creating new conversation with message:', messageToSend);

    try {
      const nextWorkspaceMode: ConversationWorkspaceMode = historyMode === 'planner' ? 'planner' : 'standard';

      // ✅ UNIFIED FLOW: Create new conversation (with temp ID) and let normal flow handle the rest
      // This makes "type from EmptyState" follow the SAME path as "Nuevo Chat button + type message"
      const newConversation = await createNewChat(
        nextWorkspaceMode === 'planner' ? 'Planificador de Viajes' : undefined,
        nextWorkspaceMode
      );

      if (newConversation) {
        console.log('✅ [NEW CHAT] Conversation created:', newConversation.id);

        // Set as selected conversation (triggers MessageInput auto-focus)
        setSelectedConversation(newConversation.id);

        // Set the message in state (so it appears in the input)
        setMessage(messageToSend);

        // Wait a tick for state updates to propagate
        await new Promise(resolve => setTimeout(resolve, 50));

        // ✅ Use the SAME normal flow as when user types in MessageInput
        // This ensures consistent behavior: temp ID → real ID wait, typing states, etc.
        console.log('📤 [NEW CHAT] Sending message through normal flow (handleSendMessageRaw)');
        handleSendMessageRaw(messageToSend);
      }
    } catch (error) {
      console.error('❌ [NEW CHAT] Error creating conversation or sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la conversación. Inténtalo de nuevo.",
        variant: "destructive",
      });
      throw error;
    }
  }, [createNewChat, handleSendMessageRaw, historyMode, setMessage, setSelectedConversation, toast]);

  const sharedSidebarProps = {
    conversations,
    selectedConversation,
    activeTab,
    historyMode,
    sidebarLimit,
    onSelectConversation: handleSelectConversation,
    onCreateNewChat: handleCreateStandardConversation,
    onCreateNewPlanner: handleCreatePlannerConversation,
    onTabChange: handleHistoryTabChange,
    onHistoryModeChange: handleHistoryModeChange,
    onArchiveConversation: handleArchiveConversation,
    contentSearchResults: searchResults,
    isSearching: searching,
    onSearchMessages: searchMessages,
    onClearSearch: clearSearch,
  };

  const chatContextPanel = selectedConversation && hasChatContextPanelContent(planner.plannerState, latestDiscoveryContext) ? (
    <ChatContextPanel
      plannerState={planner.plannerState}
      discoveryContext={latestDiscoveryContext}
      onRequestChanges={handleRequestItineraryChanges}
      onExportPdf={handleExportItineraryPdf}
    />
  ) : undefined;

  const headerContext = selectedConversation ? (
    <ChatWorkspaceHeaderContext
      selectedConversation={selectedConversation}
      conversation={selectedConversationRow}
      plannerState={planner.plannerState}
      discoveryContext={latestDiscoveryContext}
    />
  ) : undefined;

  const consumerHeaderActions = selectedConversation ? (
    <ChatWorkspaceHeaderActions
      accountType="consumer"
      selectedConversation={selectedConversation}
      messagesCount={conversationScopedMessages.length}
      plannerState={planner.plannerState}
      isAddingToCRM={isAddingToCRM}
      onAddToCRM={handleAddToCRM}
      onRequestChanges={handleRequestItineraryChanges}
      onExportPdf={handleExportItineraryPdf}
    />
  ) : undefined;

  if (mode === 'companion') {
    return (
      <UnifiedLayout
        rightPanel={chatContextPanel}
        rightPanelWidth="clamp(420px, 42vw, 640px)"
        headerContext={headerContext}
        headerActions={consumerHeaderActions}
      >
        <div className="flex h-full min-w-0">
          <ChatSidebarFrame
            selectedConversation={selectedConversation}
            collapsed={isHistoryCollapsed}
            onCollapsedChange={setIsHistoryCollapsed}
          >
            <ChatSidebarCompanion
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
              onCreateNewChat={handleCreateCompanionConversation}
            />
          </ChatSidebarFrame>
          <div
            className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 min-w-0`}
          >
            {selectedConversation ? (
              <div className="flex-1 min-h-0">
                <ChatInterface
                  selectedConversation={selectedConversation}
                  message={message}
                  isLoading={isLoading}
                  isTyping={isTyping}
                  typingMessage={typingMessage}
                  isUploadingPdf={isUploadingPdf}
                  isAddingToCRM={isAddingToCRM}
                  messages={conversationScopedMessages}
                  refreshMessages={refreshMessages}
                  onMessageChange={setMessage}
                  onSendMessage={handleSendMessage}
                  onPdfUpload={handlePdfUpload}
                  onAddToCRM={handleAddToCRM}
                  onPdfGenerated={handlePdfGenerated}
                  onBackToList={() => setSelectedConversation(null)}
                  accountType="consumer"
                  headerVisibility="mobile-only"
                />
              </div>
            ) : (
              <EmptyState onSendNewMessage={handleSendNewMessage} />
            )}
          </div>
        </div>
      </UnifiedLayout>
    );
  }

  const agentRightPanel = workspaceMode !== 'planner' ? chatContextPanel : undefined;
  const agentHeaderActions = selectedConversation ? (
    <ChatWorkspaceHeaderActions
      accountType="agent"
      selectedConversation={selectedConversation}
      messagesCount={conversationScopedMessages.length}
      plannerState={planner.plannerState}
      chatMode={chatMode}
      hasAgency={hasAgency}
      isAddingToCRM={isAddingToCRM}
      onModeChange={setChatMode}
      onAddToCRM={handleAddToCRM}
      onRequestChanges={handleRequestItineraryChanges}
      onExportPdf={handleExportItineraryPdf}
    />
  ) : undefined;

  return (
    <UnifiedLayout
      rightPanel={agentRightPanel}
      rightPanelWidth="clamp(420px, 42vw, 640px)"
      headerContext={headerContext}
      headerActions={agentHeaderActions}
    >
      {selectedConversation && workspaceMode === 'planner' ? (
        <TripPlannerWorkspace
          key={plannerWorkspaceKey ?? selectedConversation ?? 'planner-workspace'}
          selectedConversation={selectedConversation}
          message={message}
          isLoading={isLoading}
          isTyping={isTyping}
          typingMessage={typingMessage}
          isUploadingPdf={isUploadingPdf}
          messages={conversationScopedMessages}
          onMessageChange={setMessage}
          onSendMessage={handleSendMessage}
          onPdfUpload={handlePdfUpload}
          onPdfGenerated={handlePdfGenerated}
          plannerState={planner.plannerState}
          isLoadingPlanner={planner.isLoadingPlanner}
          activePlannerMutation={planner.activePlannerMutation}
          isResolvingLocations={planner.isResolvingLocations}
          plannerError={planner.plannerError}
          plannerLocationWarning={planner.plannerLocationWarning}
          onUpdateTripField={planner.updateTripField}
          onApplyPlannerDateSelection={planner.applyPlannerDateSelection}
          onAddDestination={planner.addDestination}
          onRemoveDestination={planner.removeDestination}
          onReorderDestinations={planner.reorderDestinations}
          onEnsureSegmentEnriched={planner.ensureSegmentEnriched}
          onSelectHotel={planner.selectHotel}
          onSelectHotelPlaceFromMap={planner.selectHotelPlaceFromMap}
          onAddPlaceToPlanner={planner.addPlaceToPlanner}
          onAddPlaceToFirstAvailableSlot={planner.addPlaceToFirstAvailableSlot}
          onAutoFillSegmentWithRealPlaces={planner.autoFillSegmentWithRealPlaces}
          onResolveInventoryMatch={planner.resolveInventoryMatchForSegment}
          onConfirmInventoryHotelMatch={planner.confirmInventoryHotelMatch}
          onRefreshQuotedHotel={planner.refreshQuotedHotel}
          onSelectTransportOption={planner.selectTransportOption}
          onLoadHotelsForSegment={planner.loadHotelsForSegment}
          onLoadTransportForSegment={planner.loadTransportForSegment}
          onSendMessageRaw={handleSendMessageRaw}
          onCompletePlannerDateSelection={handlePlannerDateSelection}
        />
      ) : (
        <div className="flex h-full min-w-0">
          <ChatSidebarFrame
            selectedConversation={selectedConversation}
            collapsed={isHistoryCollapsed}
            onCollapsedChange={setIsHistoryCollapsed}
          >
            <ChatSidebar {...sharedSidebarProps} />
          </ChatSidebarFrame>
          <div
            className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 min-w-0`}
          >
            {selectedConversation ? (
              <ChatInterface
                selectedConversation={selectedConversation}
                message={message}
                isLoading={isLoading}
                isTyping={isTyping}
                typingMessage={typingMessage}
                isUploadingPdf={isUploadingPdf}
                isAddingToCRM={isAddingToCRM}
                messages={conversationScopedMessages}
                refreshMessages={refreshMessages}
                onMessageChange={setMessage}
                onSendMessage={handleSendMessage}
                onPdfUpload={handlePdfUpload}
                onAddToCRM={handleAddToCRM}
                onPdfGenerated={handlePdfGenerated}
                onBackToList={() => setSelectedConversation(null)}
                onGoToPlanner={planner.plannerState ? () => {
                  setWorkspaceMode('planner');
                  setHistoryMode('planner');
                } : undefined}
                accountType="agent"
                mode={chatMode}
                hasAgency={hasAgency}
                onModeChange={setChatMode}
                onBridgeSwitch={handleBridgeSwitch}
                onBridgeStay={handleBridgeStay}
                headerVisibility="mobile-only"
              />
            ) : (
              <EmptyState
                onSendNewMessage={handleSendNewMessage}
                onCreatePlanner={isOwner || isSuperAdmin ? handleCreatePlannerConversation : undefined}
              />
            )}
          </div>
        </div>
      )}
    </UnifiedLayout>
  );
};

export default ChatFeature;
