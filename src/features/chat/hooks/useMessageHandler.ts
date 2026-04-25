import { useCallback } from 'react';
import type React from 'react';
import { parseMessageWithAI, combineWithPreviousRequest, validateFlightRequiredFields, validateHotelRequiredFields, validateItineraryRequiredFields, generateMissingInfoMessage } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { normalizeFlightRequest } from '@/services/flightSegments';
import { handleFlightSearch, handleHotelSearch, handleCombinedSearch, handlePackageSearch, handleServiceSearch, handleGeneralQuery, handleItineraryRequest } from '../services/searchHandlers';
import { addMessageViaSupabase } from '../services/messageService';
import { generateChatTitle } from '../utils/messageHelpers';
import { isAddHotelRequest, isCheaperFlightRequest, isPriceChangeRequest } from '../utils/intentDetection';
import { routeRequest, buildSearchSummary, getInferredFieldDetails } from '../services/routeRequest';
import { detectIterationIntent, mergeIterationContext, generateIterationExplanation } from '../utils/iterationDetection';
import { buildConversationalMissingInfoMessage, buildModeBridgeMessage, resolveConversationTurn } from '../services/conversationOrchestrator';
import { resolveEffectiveMode } from '../utils/resolveEffectiveMode';
import { buildDiscoveryResponsePayload } from '../services/discoveryService';
import type { MessageRow } from '../types/chat';
import type { ContextState } from '../types/contextState';
import type { PlannerFieldProvenance, TripPlannerState } from '@/features/trip-planner/types';
import { applySmartDefaults, normalizePlannerState } from '@/features/trip-planner/utils';
import { mergePlannerFieldUpdate, normalizeLocationLabel, buildPlannerHotelSearchSignature, buildPlannerTransportSearchSignature } from '@/features/trip-planner/helpers';
import { buildCanonicalResultFromStandard, buildCanonicalMeta, persistCanonicalResult, buildTurnContextState, type CanonicalItineraryResult } from '../services/itineraryPipeline';
import { buildEditorialData } from '@/features/trip-planner/editorial';
import { translateBaggage } from '../utils/translations';
import { createDebugTimer, logTimingStep, nowMs } from '@/utils/debugTiming';
import { transformStarlingResults } from '../services/flightTransformer';
import i18n from '@/i18n';

function formatPlannerDateSelectionMessage(selection: {
  startDate?: string;
  endDate?: string;
  isFlexibleDates: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  days?: number;
}) {
  if (selection.isFlexibleDates) {
    const flexibleLabel = selection.flexibleMonth
      ? new Date(`${selection.flexibleYear || new Date().getFullYear()}-${selection.flexibleMonth}-01T00:00:00`)
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : 'mes flexible';

    return `Mes flexible seleccionado: ${flexibleLabel}${selection.days ? ` (${selection.days} días)` : ''}`;
  }

  return `Fechas seleccionadas: ${selection.startDate || 'sin salida'}${selection.endDate ? ` al ${selection.endDate}` : ''}`;
}

function calculateTripDays(startDate?: string, endDate?: string): number | undefined {
  if (!startDate || !endDate) return undefined;
  const diff = new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime();
  if (Number.isNaN(diff)) return undefined;
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

const useMessageHandler = (
  selectedConversation: string | null,
  selectedConversationRef: React.MutableRefObject<string | null>,
  messages: MessageRow[], // ✅ Pass messages directly instead of calling useMessages again
  previousParsedRequest: ParsedTravelRequest | null,
  setPreviousParsedRequest: (request: ParsedTravelRequest | null) => void,
  loadContextualMemory: (conversationId: string) => Promise<ParsedTravelRequest | null>,
  saveContextualMemory: (conversationId: string, request: ParsedTravelRequest) => Promise<void>,
  clearContextualMemory: (conversationId: string) => Promise<void>,
  loadContextState: (conversationId: string) => Promise<any>,
  saveContextState: (conversationId: string, state: any) => Promise<void>,
  updateMessageStatus: (messageId: string, status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed') => Promise<any>,
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>,
  handleCheaperFlightsSearch: (message: string) => Promise<string | null>,
  handlePriceChangeRequest: (message: string) => Promise<{ response: string; modifiedPdfUrl?: string } | null>,
  setIsLoading: (loading: boolean) => void,
  setIsTyping: (typing: boolean, conversationId?: string | null) => void,
  setMessage: (message: string) => void,
  toast: any,
  setTypingMessage: (message: string, conversationId?: string | null) => void,
  addOptimisticMessage: (message: any) => void,
  updateOptimisticMessage: (messageId: string, updates: Partial<any>) => void,
  removeOptimisticMessage: (messageId: string) => void,
  plannerContextRequest: ParsedTravelRequest | null,
  plannerState: any,
  persistPlannerState?: (state: any, source: TripPlannerState['generationMeta']['source']) => Promise<void>,
  setDraftPlannerFromRequest?: (request: ParsedTravelRequest, fieldProvenance?: PlannerFieldProvenance) => void,
  setPlannerDraftPhase?: (phase: 'draft_parsing' | 'draft_generating') => void,
  updatePlannerState?: (updater: (current: TripPlannerState) => TripPlannerState, source?: 'ui_edit' | 'system') => Promise<void>,
  preloadedContext?: {
    conversationId: string;
    contextualMemory: ParsedTravelRequest | null;
    contextState: ContextState | null;
  } | null,
  workspaceMode?: 'standard' | 'planner',
  // PR 3 (C5): strict agency/passenger mode. When undefined, the orchestrator
  // runs its legacy path (used by consumer / any pre-PR-3 call site).
  chatMode?: 'agency' | 'passenger',
) => {
  // ✅ Messages are now passed as parameter - no need for second useMessages call

  // Save message to DB and immediately add assistant messages to local state (no Realtime dependency)
  const saveAndDisplayMessage = useCallback(async (messageData: Parameters<typeof addMessageViaSupabase>[0]) => {
    const saved = await addMessageViaSupabase(messageData);
    if (saved && messageData.role === 'assistant') {
      addOptimisticMessage(saved);
    }
    return saved;
  }, [addOptimisticMessage]);

  // Track active domain for this conversation to avoid cross responses
  let activeDomain: 'flights' | 'hotels' | null = null;

  // Helper: extract last flight context (destination/dates/adults/children/infants) from recent assistant message
  const getContextFromLastFlights = useCallback(() => {
    try {
      const lastWithFlights = [...(messages || [])]
        .filter(m => m.role === 'assistant' && m.meta && (m.meta as any).combinedData && Array.isArray((m.meta as any).combinedData.flights) && (m.meta as any).combinedData.flights.length > 0)
        .pop();
      if (!lastWithFlights) return null;
      const meta = lastWithFlights.meta as any;
      const flights = meta.combinedData.flights as Array<any>;
      const first = flights[0];
      if (!first) return null;
      const destination = first.legs?.[0]?.arrival?.city_code || '';
      const origin = first.legs?.[0]?.departure?.city_code || '';
      const departureDate = first.departure_date || '';
      const returnDate = first.return_date || undefined;
      const adults = first.adults || 1;
      const children = first.childrens || 0;
      const infants = first.infants || 0;
      return { origin, destination, departureDate, returnDate, adults, children, infants };
    } catch (e) {
      console.warn('⚠️ [CONTEXT] Could not extract last flight context:', e);
      return null;
    }
  }, [messages]);

  const handleSendMessage = useCallback(async (
    currentMessage: string,
    // PR 3 (C4/C7.1): optional send options.
    // - `forceCurrentMode`: orchestrator bridge guardrail G2 (C4). Populated by
    //   C5's "Seguir en este modo" chip handler.
    // - `mode`: explicit mode override that wins over the closure-captured
    //   `chatMode` (C7.1.a). Needed because `setChatMode` is async and a chip
    //   handler that calls `setChatMode(new) + handleSendMessageRaw(text)` runs
    //   the send with a stale closure; the orchestrator would then receive the
    //   pre-click mode. Callers that just flipped the mode must pass it here.
    options?: { forceCurrentMode?: boolean; mode?: 'agency' | 'passenger' },
  ) => {
    console.log('🚀 [MESSAGE FLOW] Starting handleSendMessage process');
    console.log('📝 Message content:', currentMessage);

    // ✅ Use ref to get the CURRENT conversation ID (not the closure value)
    // This ensures we always have the latest value, even if called immediately after setSelectedConversation
    const currentConversationId = selectedConversationRef.current;
    console.log('💬 Selected conversation (from ref):', currentConversationId);
    const flowTimer = createDebugTimer('MESSAGE FLOW', {
      conversationId: currentConversationId,
      messageLength: currentMessage.length,
    });

    if (!currentMessage.trim() || !currentConversationId) {
      flowTimer.end('stopped - invalid input', {
        hasConversationId: Boolean(currentConversationId),
        hasMessage: Boolean(currentMessage.trim()),
      });
      console.warn('❌ [MESSAGE FLOW] Validation failed - aborting send');
      return;
    }

    // Check if this is a cheaper flights search request for a previously uploaded PDF
    if (isCheaperFlightRequest(currentMessage)) {
      console.log('✈️ [CHEAPER FLIGHTS] Detected cheaper flights search request for previous PDF');

      // Clear the input immediately
      setMessage('');

      // Run the cheaper flights search in the background
      (async () => {
        setIsLoading(true);
        try {
          // Generate unique client_id for idempotency
          const clientId = crypto.randomUUID();
          console.log('🔑 [CHEAPER FLIGHTS] Generated client_id:', clientId);

          // ⚡ Optimistic UI update - add user message to UI immediately
          const optimisticUserMessage = {
            id: `temp-${clientId}`,
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sending', client_id: clientId, messageType: 'cheaper_flights_request' },
            created_at: new Date().toISOString()
          };

          // Add to local messages immediately (Realtime will replace with real message from DB)
          addOptimisticMessage(optimisticUserMessage as any);

          // Add user message to database (in background)
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sent', messageType: 'cheaper_flights_request', client_id: clientId }
          });

          const responseMessage = await handleCheaperFlightsSearch(currentMessage);

          if (responseMessage) {
            // Send response message
            await saveAndDisplayMessage({
              conversation_id: currentConversationId,
              role: 'assistant' as const,
              content: {
                text: responseMessage,
                metadata: {
                  type: 'cheaper_flights_search',
                  originalRequest: currentMessage
                }
              },
              meta: {
                status: 'sent',
                messageType: 'cheaper_flights_response'
              }
            });
          }

          setIsLoading(false);

        } catch (error) {
          console.error('❌ Error searching for cheaper flights:', error);

          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'assistant' as const,
            content: {
              text: `❌ **Error en la búsqueda de vuelos**\n\nNo pude buscar vuelos alternativos en este momento. Esto puede deberse a:\n\n• Problemas temporales con el servicio de búsqueda\n• El PDF no contiene información de vuelos válida\n• Error de conectividad\n\n¿Podrías intentarlo nuevamente o proporcionarme manualmente los detalles del vuelo?`
            },
            meta: {
              status: 'sent',
              messageType: 'error_response'
            }
          });

          setIsLoading(false);
        }
      })();

      return; // Exit early, don't process as regular message
    }

    // If user asks to add a hotel for same dates after flight results, coerce to combined using last flight context
    if (isAddHotelRequest(currentMessage)) {
      // Load persistent context state first, then fallback to other sources
      const persistentState = await loadContextState(currentConversationId) as ContextState | null;
      
      // Try new ContextState structure first, then legacy structure, then previousParsedRequest
      const flightCtx = persistentState?.lastSearch?.flightsParams || 
        (persistentState as any)?.flights ||  // Legacy fallback
        (previousParsedRequest?.flights ? {
          origin: previousParsedRequest.flights.origin,
          destination: previousParsedRequest.flights.destination,
          departureDate: previousParsedRequest.flights.departureDate,
          returnDate: previousParsedRequest.flights.returnDate,
          adults: previousParsedRequest.flights.adults,
          children: previousParsedRequest.flights.children || 0,
          infants: previousParsedRequest.flights.infants || 0
        } : null);
      if (flightCtx) {
        console.log('🏨 [INTENT] Add hotel detected, reusing flight context for combined search');
        console.log('🏨 [INTENT] Flight context:', flightCtx);
        console.log('🏨 [INTENT] Persistent state:', persistentState);
        setMessage('');
        setIsLoading(true);
        try {
          // Generate unique client_id for idempotency
          const clientId = crypto.randomUUID();
          console.log('🔑 [ADD HOTEL] Generated client_id:', clientId);

          // ⚡ Optimistic UI update - add user message to UI immediately
          const optimisticUserMessage = {
            id: `temp-${clientId}`,
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sending', client_id: clientId, messageType: 'add_hotel_intent' },
            created_at: new Date().toISOString()
          };

          // Add to local messages immediately (Realtime will replace with real message from DB)
          addOptimisticMessage(optimisticUserMessage as any);

          // Save user's intent message into conversation (in background)
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sent', messageType: 'add_hotel_intent', client_id: clientId }
          });

          // Build a hotels-only request using flight context (city/dates/pax inferred)
          const hotelsParsed: ParsedTravelRequest = {
            requestType: 'hotels',
            hotels: {
              city: flightCtx.destination,
              checkinDate: flightCtx.departureDate,
              checkoutDate: flightCtx.returnDate || new Date(new Date(flightCtx.departureDate).getTime() + 3 * 86400000).toISOString().split('T')[0],
              adults: flightCtx.adults,
              children: flightCtx.children,
              infants: flightCtx.infants,
              roomType: 'doble',
              mealPlan: 'desayuno'
            },
            confidence: 0.9,
            originalMessage: currentMessage
          } as any;

          console.log('🏨 [INTENT] Hotel request built:', {
            city: hotelsParsed.hotels?.city,
            checkinDate: hotelsParsed.hotels?.checkinDate,
            checkoutDate: hotelsParsed.hotels?.checkoutDate,
            adults: hotelsParsed.hotels?.adults,
            flightCtx: flightCtx
          });

          // Persist context for follow-ups
          setPreviousParsedRequest(hotelsParsed);
          await saveContextualMemory(currentConversationId, hotelsParsed);

          // Run HOTELS search only
          const hotelResult = await handleHotelSearch(hotelsParsed);

          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'assistant' as const,
            content: { text: hotelResult.response },
            meta: hotelResult.data ? { ...hotelResult.data } : {}
          });

          setMessage('');
          setIsLoading(false);
          return;
        } catch (err) {
          console.error('❌ [INTENT] Add hotel flow failed:', err);
          setIsLoading(false);
          // fall through to normal flow
        }
      } else {
        console.warn('⚠️ [INTENT] Add hotel detected but no flight context found');
        console.warn('⚠️ [INTENT] Available sources:', {
          persistentState,
          previousParsedRequest: previousParsedRequest?.flights
        });
        // Continue to normal AI parsing flow
      }
    }

    // Check if this is a price change request for a previously uploaded PDF
    if (isPriceChangeRequest(currentMessage)) {
      console.log('💰 [PRICE CHANGE] Detected price change request for previous PDF');

      // Clear the input immediately
      setMessage('');

      // Run the price change process in the background
      (async () => {
        setIsLoading(true);
        try {
          // Generate unique client_id for idempotency
          const clientId = crypto.randomUUID();
          console.log('🔑 [PRICE CHANGE] Generated client_id:', clientId);

          // ⚡ Optimistic UI update - add user message to UI immediately
          const optimisticUserMessage = {
            id: `temp-${clientId}`,
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sending', client_id: clientId, messageType: 'price_change_request' },
            created_at: new Date().toISOString()
          };

          // Add to local messages immediately (Realtime will replace with real message from DB)
          addOptimisticMessage(optimisticUserMessage as any);

          // Show typing indicator while processing price change
          setIsTyping(true, currentConversationId);
          setTypingMessage('Cambiando el precio...', currentConversationId);

          // Add user message to database (in background)
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sent', messageType: 'price_change_request', client_id: clientId }
          });

          // Update typing message while generating PDF
          setTypingMessage('Generando nuevo PDF...', currentConversationId);

          const result = await handlePriceChangeRequest(currentMessage);

          // CRITICAL: If no PDF exists, handlePriceChangeRequest returns null
          if (!result) {
            console.log('❌ [PRICE CHANGE] No PDF analysis found for this conversation');

            // Inform user they need to upload a PDF first
            await saveAndDisplayMessage({
              conversation_id: currentConversationId,
              role: 'assistant' as const,
              content: {
                text: '❌ **No hay PDF analizado**\n\nPara modificar precios, primero necesito que subas o arrastres un PDF con la cotización que deseas modificar.\n\n📄 Una vez que analice el PDF, podré ayudarte a cambiar los precios según lo que necesites.'
              },
              meta: {
                status: 'sent',
                messageType: 'error_no_pdf'
              }
            });

            // Clear typing indicator AND message
            setTypingMessage('', currentConversationId);
            setIsTyping(false, currentConversationId);
            setIsLoading(false);
            return; // Exit early - PDF validation failed
          }

          // PDF exists and price change was processed
          if (result) {
            // Add assistant response
            await saveAndDisplayMessage({
              conversation_id: currentConversationId,
              role: 'assistant' as const,
              content: {
                text: result.response,
                pdfUrl: result.modifiedPdfUrl,
                metadata: {
                  type: 'price_change_response',
                  hasModifiedPdf: !!result.modifiedPdfUrl
                }
              },
              meta: {
                status: 'sent',
                messageType: result.modifiedPdfUrl ? 'pdf_generated' : 'price_change_response'
              }
            });

            if (result.modifiedPdfUrl) {
              toast({
                title: "PDF Modificado Generado",
                description: "He creado un nuevo PDF con el precio que solicitaste.",
              });
            }
          }
        } catch (error) {
          console.error('❌ Error processing price change request:', error);

          // Send error message to user
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'assistant' as const,
            content: {
              text: '❌ **Error al procesar cambio de precio**\n\nNo pude procesar tu solicitud de cambio de precio. Por favor, verifica que:\n\n• El PDF esté correctamente analizado\n• El precio que indicaste sea un número válido\n• Intenta nuevamente en unos momentos'
            },
            meta: {
              status: 'sent',
              messageType: 'error_response'
            }
          });

          toast({
            title: "Error",
            description: "No pude procesar tu solicitud de cambio de precio.",
            variant: "destructive",
          });
        } finally {
          // Clear typing indicator AND message
          setTypingMessage('', currentConversationId);
          setIsTyping(false, currentConversationId);
          setIsLoading(false);
        }
      })();

      return; // Exit early, don't continue with normal flow
    }

    setMessage('');
    setIsLoading(true);

    // ✅ CAPTURE conversation ID at the start - this ensures typing state is updated for THIS conversation
    // even if user switches to another conversation while this search is running
    const conversationIdForThisSearch = currentConversationId;

    setIsTyping(true, conversationIdForThisSearch);
    setTypingMessage('Chequeando tu pedido...', conversationIdForThisSearch);

    console.log('✅ [MESSAGE FLOW] Step 1: Message validation passed');
    console.log('📨 Processing message:', currentMessage);
    console.log('🔑 [CONVERSATION] Captured conversation ID for this search:', conversationIdForThisSearch);

    // ✅ WAIT FOR REAL CONVERSATION ID: If conversation is temporary, wait for it to be created
    let finalConversationId = currentConversationId;
    if (currentConversationId.startsWith('temp-')) {
      console.log('⏳ [CONVERSATION] Waiting for temporary conversation to be created:', currentConversationId);

      // Poll until conversation ID is real (max 5 seconds)
      const maxWaitTime = 5000; // 5 seconds max
      const pollInterval = 50; // Check every 50ms
      const startTime = Date.now();

      // Poll the ref until it's not a temp ID
      while (
        selectedConversationRef.current?.startsWith('temp-') &&
        Date.now() - startTime < maxWaitTime
      ) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      if (selectedConversationRef.current?.startsWith('temp-')) {
        console.error('❌ [CONVERSATION] Timeout waiting for conversation creation');
        throw new Error('Timeout esperando la creación de la conversación');
      }

      // Update local variable with real ID
      finalConversationId = selectedConversationRef.current!;
      console.log('✅ [CONVERSATION] Got real conversation ID:', finalConversationId);
    }

    try {
      // 1. Generate unique client_id for idempotency (prevents duplicates)
      // Using crypto.randomUUID() - native browser/Node API, no external deps needed
      const clientId = crypto.randomUUID();
      console.log('🔑 [IDEMPOTENCY] Generated client_id:', clientId);

      // 2. Optimistic UI update - add user message to UI immediately (without waiting for DB)
      console.log('⚡ [OPTIMISTIC UI] Adding user message to UI instantly');
      const optimisticUserMessage = {
        id: `temp-${clientId}`, // Use client_id in temp ID for easier reconciliation
        conversation_id: finalConversationId,
        role: 'user' as const,
        content: { text: currentMessage },
        meta: { status: 'sending', client_id: clientId }, // Include client_id for de-dupe
        created_at: new Date().toISOString()
      };

      // Add to local messages immediately (Realtime will replace with real message from DB)
      addOptimisticMessage(optimisticUserMessage as any);

      console.log('📤 [MESSAGE FLOW] Step 2: Saving user message + loading context in parallel');

      // 2. Update conversation title if first message (fire-and-forget)
      const isPdfUpload = currentMessage.toLowerCase().includes('he subido el pdf') ||
        currentMessage.toLowerCase().includes('pdf para análisis');

      if (messages.length === 0 && !isPdfUpload) {
        const title = generateChatTitle(currentMessage);
        updateConversationTitle(finalConversationId, title).catch((titleError) => {
          console.error('❌ [MESSAGE FLOW] Error updating conversation title:', titleError);
        });
      }

      // Check if we can use preloaded context (same conversation, not first message)
      const canUsePreloaded = preloadedContext &&
        preloadedContext.conversationId === finalConversationId &&
        messages.length > 0;

      // Run DB save + context loading in parallel
      const saveAndContextStart = nowMs();
      const [userMessage, contextFromDB, persistentState] = await Promise.all([
        addMessageViaSupabase({
          conversation_id: finalConversationId,
          role: 'user' as const,
          content: { text: currentMessage },
          meta: { status: 'sent', client_id: clientId }
        }),
        canUsePreloaded
          ? Promise.resolve(preloadedContext!.contextualMemory)
          : loadContextualMemory(finalConversationId),
        canUsePreloaded
          ? Promise.resolve(preloadedContext!.contextState)
          : loadContextState(finalConversationId) as Promise<ContextState | null>,
      ]);
      logTimingStep('MESSAGE FLOW', 'save user message + load context', saveAndContextStart, {
        canUsePreloaded,
        hasContextFromDb: Boolean(contextFromDB),
        hasPersistentState: Boolean(persistentState),
      });

      console.log('✅ [MESSAGE FLOW] Step 3: User message saved + context loaded in parallel');
      console.log('🔍 [DEBUG] Context loaded from DB:', contextFromDB);
      console.log('🔍 [DEBUG] Persistent context state:', persistentState);

      // 🔄 ITERATION DETECTION: Check if this message is an iteration on previous search
      const iterationContext = detectIterationIntent(currentMessage, persistentState);
      console.log('🔄 [ITERATION] Detection result:', {
        isIteration: iterationContext.isIteration,
        type: iterationContext.iterationType,
        baseRequestType: iterationContext.baseRequestType,
        modifiedComponent: iterationContext.modifiedComponent,
        confidence: iterationContext.confidence,
        matchedPattern: iterationContext.matchedPattern
      });

      // 🧹 Clean context for new conversations (first message)
      let contextToUse = null;
      const isFirstMessage = messages.length === 0;
      const hasNoStoredContext = !contextFromDB && !persistentState;

      if (isFirstMessage) {
        console.log('🧹 [NEW CONVERSATION] First message detected - cleaning ALL context including React state');
        contextToUse = null; // Start fresh for new conversations
        // Also clear the React state to prevent cross-conversation contamination
        setPreviousParsedRequest(null);
      } else if (hasNoStoredContext) {
        console.log('🧹 [NEW CONVERSATION] No stored context - falling back to planner context if available');
        contextToUse = plannerContextRequest || null;
      } else {
        contextToUse = contextFromDB || plannerContextRequest || previousParsedRequest || persistentState;
      }
      console.log('📝 [CONTEXT] Final context to use:', contextToUse);

      // 4. Use AI Parser to classify request
      console.log('🤖 [MESSAGE FLOW] Step 8: Starting AI parsing process');
      console.log('📤 [MESSAGE FLOW] About to call AI message parser (Supabase Edge Function)');
      console.log('🧠 Message to parse:', currentMessage);

      setTypingMessage('Analizando tu mensaje...', conversationIdForThisSearch);

      // ✅ Helper to get client_id from message (checks direct column first, then meta)
      const getClientId = (msg: any): string | null | undefined => {
        if (msg.client_id) return msg.client_id;
        const meta = msg.meta as any;
        return meta?.client_id;
      };

      // Prepare full conversation history for better context understanding
      // ✅ FIX: Filter out optimistic messages (temp-*) to prevent sending duplicates to AI
      // Also filter duplicates by client_id to ensure unique messages only
      const seenClientIds = new Set<string>();
      const conversationHistory = (messages || [])
        .filter(msg => {
          const meta = msg.meta as any;
          if (msg.role === 'system' && meta && (
            meta.messageType === 'contextual_memory' ||
            meta.messageType === 'context_state' ||
            meta.messageType === 'trip_planner_state'
          )) {
            return false;
          }

          // Skip optimistic messages (they will be replaced by real ones)
          if (msg.id.toString().startsWith('temp-')) {
            const clientId = getClientId(msg);
            if (clientId && seenClientIds.has(clientId)) {
              return false; // Skip duplicate optimistic message
            }
            if (clientId) {
              seenClientIds.add(clientId);
            }
            // Check if there's a real message with same client_id already
            const hasRealMessage = messages?.some(realMsg =>
              !realMsg.id.toString().startsWith('temp-') &&
              getClientId(realMsg) === clientId
            );
            if (hasRealMessage) {
              console.log('🔒 [HISTORY] Skipping optimistic message, real message exists:', clientId);
              return false; // Skip optimistic if real message exists
            }
            // Keep optimistic only if no real message found
            return true;
          }

          // For real messages, check for duplicates by client_id
          const clientId = getClientId(msg);
          if (clientId) {
            if (seenClientIds.has(clientId)) {
              console.log('🔒 [HISTORY] Skipping duplicate message by client_id:', clientId);
              return false;
            }
            seenClientIds.add(clientId);
          }

          return true;
        })
        .map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : typeof msg.content === 'object' && msg.content !== null
              ? (msg.content as { text?: string }).text || ''
              : '',
          timestamp: msg.created_at
        }));

      console.log('📚 [CONTEXT] Sending full conversation history to AI parser:', {
        messageCount: conversationHistory.length,
        originalMessageCount: messages?.length || 0,
        filtered: (messages?.length || 0) - conversationHistory.length,
        previousContext: contextToUse ? 'Yes' : 'No'
      });

      // === EMILIA 5.0: PARSE + ROUTE ===
      // Always parse first, then route based on content (not workspace_mode)
      const parseStart = nowMs();
      let parsedRequest = await parseMessageWithAI(currentMessage, contextToUse, conversationHistory);
      logTimingStep('MESSAGE FLOW', 'parseMessageWithAI', parseStart, {
        requestType: parsedRequest.requestType,
      });

      const routeResult = routeRequest(parsedRequest, plannerState);
      console.log('🧭 [ROUTER] Emilia route decision:', {
        route: routeResult.route,
        score: routeResult.score.toFixed(2),
        dimensions: routeResult.dimensions,
        missingFields: routeResult.missingFields,
        reason: routeResult.reason,
      });

      const MAX_COLLECT_TURNS = 3;
      const recentCollectCount = (messages || [])
        .filter(m =>
          m.conversation_id === finalConversationId &&
          m.role === 'assistant' &&
          (m.meta as Record<string, unknown>)?.messageType === 'collect_question'
        )
        .slice(-MAX_COLLECT_TURNS)
        .length;

      // PR 3 (C4): read the last assistant message's messageType so the
      // orchestrator can apply guardrail G1 (anti-loop for mode_bridge).
      // Passed regardless of whether `mode` is defined — the legacy path
      // ignores it safely. Value becomes meaningful once C5 wires `mode`
      // from ChatFeature.
      const previousAssistant = [...(messages || [])]
        .filter((m) => m.conversation_id === finalConversationId && m.role === 'assistant')
        .pop();
      const previousMessageType =
        ((previousAssistant?.meta as Record<string, unknown> | undefined)?.messageType as
          | string
          | undefined) || undefined;

      // C7.1.a: options.mode wins over the closure-captured chatMode. Bridge
      // chip handlers that just called setChatMode pass it explicitly.
      const effectiveMode = resolveEffectiveMode(options?.mode, chatMode);
      const conversationTurn = resolveConversationTurn({
        parsedRequest,
        routeResult,
        plannerState,
        hasPersistentContext: Boolean(contextToUse),
        hasPreviousParsedRequest: Boolean(previousParsedRequest),
        recentCollectCount,
        maxCollectTurns: MAX_COLLECT_TURNS,
        previousMessageType,
        forceCurrentMode: options?.forceCurrentMode,
        mode: effectiveMode,
      });

      console.log('🧠 [CONVERSATION] Turn resolution:', conversationTurn);

      // === EMILIA COLLECT: router-detected gaps that benefit from a clean single question ===
      // Intercepts when:
      //   1. Passenger ambiguity ("familia" without count) — validation doesn't catch this
      //   2. Quote intent but incomplete, AND no previous context to fill gaps
      // Max 3 consecutive COLLECT turns — after that, fall through to PLAN or existing validation
      const collectExhausted = recentCollectCount >= MAX_COLLECT_TURNS;

      if (collectExhausted && routeResult.route === 'COLLECT') {
        console.log(`🔄 [COLLECT] ${MAX_COLLECT_TURNS} turns exhausted — falling through to standard flow`);
      }

      if (conversationTurn.shouldAskMinimalQuestion && routeResult.collectQuestion) {
        console.log('🔄 [COLLECT] Router intercepting with focused question:', routeResult.reason, `(turn ${recentCollectCount + 1}/${MAX_COLLECT_TURNS})`);
        setPreviousParsedRequest(parsedRequest);
        await saveContextualMemory(finalConversationId, parsedRequest);

        const collectMessage = buildConversationalMissingInfoMessage({
          parsedRequest,
          missingFields: routeResult.missingFields,
          fallbackMessage: routeResult.collectQuestion,
        });

        await saveAndDisplayMessage({
          conversation_id: finalConversationId,
          role: 'assistant' as const,
          content: { text: collectMessage },
          meta: {
            status: 'sent',
            messageType: conversationTurn.messageType,
            responseMode: conversationTurn.responseMode,
            routeScore: routeResult.score,
            collectTurn: recentCollectCount + 1,
            missingFields: conversationTurn.normalizedMissingFields,
            normalizedMissingFields: conversationTurn.normalizedMissingFields,
            originalRequest: parsedRequest,
            requestText: parsedRequest.originalMessage || currentMessage,
            conversationTurn,
          }
        });

        setIsTyping(false, conversationIdForThisSearch);
        setIsLoading(false);
        flowTimer.end('collect - router template question', {
          route: routeResult.route,
          collectTurn: recentCollectCount + 1,
          missingFields: routeResult.missingFields,
        });
        return;
      }

      // === MODE_BRIDGE BRANCH (PR 3 / C4) ===
      // Emitted by the orchestrator when content doesn't match the active
      // mode. Persisted as its own assistant message with messageType=
      // 'mode_bridge'; ChatInterface reads meta.suggestedMode and renders the
      // 2 chips (switch / stay). Unreachable at runtime until C5 passes
      // `mode` from ChatFeature.
      if (conversationTurn.executionBranch === 'mode_bridge') {
        const suggestedMode = conversationTurn.uiMeta.suggestedMode;
        console.log('🌉 [MODE BRIDGE] Emitting mode_bridge turn, suggesting:', suggestedMode);
        const bridgeText = suggestedMode
          ? buildModeBridgeMessage({
              suggestedMode,
              t: (key: string) => i18n.t(key, { ns: 'chat', defaultValue: key }),
            })
          : '';

        await saveAndDisplayMessage({
          conversation_id: finalConversationId,
          role: 'assistant' as const,
          content: { text: bridgeText },
          meta: {
            status: 'sent',
            messageType: 'mode_bridge',
            responseMode: conversationTurn.responseMode,
            suggestedMode,
            originalRequest: parsedRequest,
            requestText: parsedRequest.originalMessage || currentMessage,
            conversationTurn,
          },
        });

        setIsTyping(false, conversationIdForThisSearch);
        setIsLoading(false);
        flowTimer.end('mode_bridge emitted', {
          suggestedMode,
          route: routeResult.route,
        });
        return;
      }

      // Merge persistent state into parsed request where fields are missing (user intent wins over stored)
      const mergeFlights = (a: any, b: any) => ({
        ...(b || {}),
        ...(a || {})
      });
      const mergeHotels = (a: any, b: any) => ({
        ...(b || {}),
        ...(a || {})
      });
      if (persistentState) {
        if (parsedRequest.flights || persistentState.flights) {
          parsedRequest.flights = mergeFlights(parsedRequest.flights, persistentState.flights);
        }
        if (parsedRequest.hotels || persistentState.hotels) {
          parsedRequest.hotels = mergeHotels(parsedRequest.hotels, persistentState.hotels);
        }
      }

      console.log('✅ [MESSAGE FLOW] Step 9: AI parsing completed successfully');
      console.log('🎯 AI parsing result:', parsedRequest);

      // 🔄 ITERATION MERGE: If this is an iteration, merge with previous context
      // This runs BEFORE combineWithPreviousRequest to properly handle hotel/flight iterations
      if (iterationContext.isIteration && persistentState) {
        console.log('🔄 [ITERATION] Applying iteration merge');
        console.log('🔄 [ITERATION] Before merge - requestType:', parsedRequest.requestType);
        parsedRequest = mergeIterationContext(persistentState, parsedRequest, iterationContext);
        console.log('🔄 [ITERATION] After merge - requestType:', parsedRequest.requestType);
        console.log('🔄 [ITERATION] Merged request:', {
          requestType: parsedRequest.requestType,
          hasFlights: !!parsedRequest.flights,
          hasHotels: !!parsedRequest.hotels,
          flightsOrigin: parsedRequest.flights?.origin,
          flightsDest: parsedRequest.flights?.destination,
          stops: parsedRequest.flights?.stops,
          hotelChains: parsedRequest.hotels?.hotelChains
        });
      }

      // 🔄 LEGACY FALLBACK: "con escalas" heuristic (only if iteration system didn't handle it)
      // This is kept as a fallback for cases where the new iteration system might miss the pattern
      if (!iterationContext.isIteration && /\bcon\s+escalas\b/i.test(currentMessage)) {
        const baseFlights = parsedRequest?.flights || previousParsedRequest?.flights || (contextToUse as any)?.flights;
        if (baseFlights?.origin && baseFlights?.destination && baseFlights?.departureDate && (baseFlights?.adults ?? 0) >= 1) {
          console.log('🔀 [LEGACY FALLBACK] "con escalas" detected - forcing stops:with_stops');
          parsedRequest = {
            requestType: 'flights',
            flights: {
              ...baseFlights,
              stops: 'with_stops' as any
            },
            confidence: parsedRequest?.confidence ?? 0.9,
            originalMessage: currentMessage
          } as any;
        }
      }

      // 5. Combine with previous request if available (contextual memory)
      // Note: This is a fallback for non-iteration cases
      console.log('🧠 [MESSAGE FLOW] Step 10: Combining with previous request');
      if (previousParsedRequest && !iterationContext.isIteration) {
        console.log('🔄 [MEMORY] Combining with previous request:', {
          previousType: previousParsedRequest.requestType,
          newType: parsedRequest.requestType
        });
        parsedRequest = combineWithPreviousRequest(previousParsedRequest, currentMessage, parsedRequest);
      }

      // 6. Validate required fields (handle combined specially)
      console.log('🔍 [MESSAGE FLOW] Step 11: Validating required fields');
      console.log('📊 Request type detected:', parsedRequest.requestType);

      // If it's a missing_info_request but no fields are actually missing, convert to the appropriate type
      if (parsedRequest.requestType === 'missing_info_request' &&
        (!parsedRequest.missingFields || parsedRequest.missingFields.length === 0)) {
        console.log('🔀 [VALIDATION] No missing fields detected - converting missing_info_request to appropriate type');

        if (parsedRequest.flights) {
          parsedRequest.requestType = 'flights';
          console.log('✈️ [VALIDATION] Converted to flights request');
        } else if (parsedRequest.hotels) {
          parsedRequest.requestType = 'hotels';
          console.log('🏨 [VALIDATION] Converted to hotels request');
        } else if (parsedRequest.flights && parsedRequest.hotels) {
          parsedRequest.requestType = 'combined';
          console.log('🏨✈️ [VALIDATION] Converted to combined request');
        }
      }

      // If message implies combined (mentions hotel y vuelo), coerce to combined and mirror basic fields
      // BUT be more careful - only if user explicitly wants both services
      const lowerMsg = currentMessage.toLowerCase();
      const explicitlyWantsHotel = /\b(hotel|alojamiento|hospedaje|donde quedarme|donde alojarme)\b/.test(lowerMsg);
      const explicitlyWantsFlight = /\b(vuelo|vuelos|avion|aereo)\b/.test(lowerMsg);
      const explicitlyRejectsHotel = /\b(no quiero hotel|sin hotel|solo vuelo|solo el vuelo|no necesito hotel)\b/.test(lowerMsg);
      const explicitlyReferencesPreviousContext = /\b(mism[ao]s?\s+busqueda|misma\s+consulta|mismo\s+vuelo|mismas?\s+fechas?|esas?\s+fechas?|lo\s+mismo\s+pero|igual\s+que\s+antes|como\s+antes|busqueda\s+anterior|busqueda\s+previa)\b/.test(lowerMsg);
      const normalizeIntentText = (value?: string) =>
        (value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      const normalizedMessageForIntent = normalizeIntentText(currentMessage);
      const messageMentions = (value?: string) => {
        const normalizedValue = normalizeIntentText(value);
        return normalizedValue.length > 0 && normalizedMessageForIntent.includes(normalizedValue);
      };

      // If combined intent has mismatched destinations, prefer the destination explicitly present in the message.
      // This avoids stale destination leakage from previous context (e.g., old Cancún overriding new Punta Cana).
      if (explicitlyWantsHotel && explicitlyWantsFlight && !explicitlyReferencesPreviousContext) {
        const flightDestination = parsedRequest.flights?.destination;
        const hotelCity = parsedRequest.hotels?.city;
        const normalizedFlightDestination = normalizeIntentText(flightDestination);
        const normalizedHotelCity = normalizeIntentText(hotelCity);

        if (
          normalizedFlightDestination &&
          normalizedHotelCity &&
          normalizedFlightDestination !== normalizedHotelCity
        ) {
          const mentionsFlightDestination = messageMentions(flightDestination);
          const mentionsHotelCity = messageMentions(hotelCity);

          if (mentionsHotelCity && !mentionsFlightDestination && parsedRequest.flights) {
            console.log(`🛡️ [INTENT] Aligning flight destination to explicit hotel city mention: ${flightDestination} -> ${hotelCity}`);
            parsedRequest.flights.destination = hotelCity as any;
          } else if (mentionsFlightDestination && !mentionsHotelCity && parsedRequest.hotels) {
            console.log(`🛡️ [INTENT] Aligning hotel city to explicit flight destination mention: ${hotelCity} -> ${flightDestination}`);
            parsedRequest.hotels.city = flightDestination as any;
          }
        }
      }

      // Strong guard: if user clearly asks ONLY hotel (no flight mention, no context-ref),
      // never carry flights from previous context in this turn.
      if (explicitlyWantsHotel && !explicitlyWantsFlight && !explicitlyReferencesPreviousContext) {
        const flightsSnapshot = parsedRequest.flights;
        if (parsedRequest.requestType !== 'hotels') {
          console.log('🏨 [INTENT] Forcing hotels-only request based on explicit hotel intent');
          parsedRequest.requestType = 'hotels';
        }

        // If AI returned only flights but user explicitly asked hotel, map minimal hotel base.
        if (!parsedRequest.hotels && flightsSnapshot?.destination) {
          parsedRequest.hotels = {
            city: flightsSnapshot.destination as any,
            checkinDate: flightsSnapshot.departureDate as any,
            checkoutDate: flightsSnapshot.returnDate as any,
            adults: (flightsSnapshot.adults as any) || 1,
            children: (flightsSnapshot.children as any) ?? 0,
            infants: (flightsSnapshot.infants as any) ?? 0
          } as any;
        }

        parsedRequest.flights = undefined;
      }

      // Only coerce to combined if user explicitly mentions both services AND doesn't reject hotel
      if (explicitlyWantsHotel && explicitlyWantsFlight && !explicitlyRejectsHotel && parsedRequest.requestType !== 'combined') {
        console.log('🔀 [INTENT] Coercing requestType to combined based on explicit hotel+flight mention');
        parsedRequest.requestType = 'combined';
        // Mirror city/dates from flights to hotels if missing
        const f = parsedRequest.flights;
        const existingHotels = parsedRequest.hotels || ({} as any);
        parsedRequest.hotels = {
          ...existingHotels, // ✅ PRESERVE existing hotel fields (roomType, mealPlan, etc.)
          city: existingHotels.city || (f?.destination as any),
          checkinDate: existingHotels.checkinDate || (f?.departureDate as any),
          checkoutDate: existingHotels.checkoutDate || (f?.returnDate as any),
          adults: existingHotels.adults || (f?.adults as any),
          children: existingHotels.children ?? (f?.children as any) ?? 0,
          infants: existingHotels.infants ?? (f?.infants as any) ?? 0
        } as any;
      }

      // If user explicitly rejects hotel, force flights-only
      if (explicitlyRejectsHotel && parsedRequest.requestType === 'combined') {
        console.log('🚫 [INTENT] User explicitly rejects hotel - forcing flights-only');
        parsedRequest.requestType = 'flights';
        parsedRequest.hotels = undefined;
      }

      // Combined flow: validate both and send ONE aggregated prompt
      if (parsedRequest.requestType === 'combined') {
        console.log('🌟 [VALIDATION] Combined request - validating flights and hotels');

        // Only validate flights if flight data was actually provided
        // This handles cases like "hotel + transfers + insurance" where AI returns combined but no flights
        const hasFlightData = parsedRequest.flights && (
          parsedRequest.flights.origin ||
          parsedRequest.flights.destination ||
          parsedRequest.flights.departureDate
        );

        const flightVal = hasFlightData
          ? validateFlightRequiredFields(parsedRequest.flights)
          : { isValid: true, missingFields: [], missingFieldsSpanish: [] }; // Skip flight validation if no flight data
        const hotelVal = validateHotelRequiredFields(parsedRequest.hotels);

        console.log(`📊 [VALIDATION] hasFlightData: ${hasFlightData}, flightVal.isValid: ${flightVal.isValid}, hotelVal.isValid: ${hotelVal.isValid}`);

        const missingAny = !flightVal.isValid || !hotelVal.isValid;
        console.log('🧾 [VALIDATION] Combined results:', { flight: flightVal, hotel: hotelVal });
        if (missingAny) {
          // Persist context
          setPreviousParsedRequest(parsedRequest);
          await saveContextualMemory(finalConversationId, parsedRequest);

          const missingInfoMessage = buildConversationalMissingInfoMessage({
            parsedRequest,
            missingFields: [
              ...flightVal.missingFields,
              ...hotelVal.missingFields,
            ],
            fallbackMessage: generateMissingInfoMessage(
              [
                ...flightVal.missingFieldsSpanish,
                ...hotelVal.missingFieldsSpanish,
              ],
              'combined'
            ),
          });

          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: missingInfoMessage },
            meta: {
              status: 'sent',
              messageType: 'missing_info_request',
              missingFlightFields: flightVal.missingFields,
              missingHotelFields: hotelVal.missingFields,
              originalRequest: parsedRequest
            }
          });

          console.log('✅ [VALIDATION] Aggregated missing info message sent');
          flowTimer.end('stopped - combined validation missing info', {
            requestType: parsedRequest.requestType,
            missingFlightFields: flightVal.missingFields,
            missingHotelFields: hotelVal.missingFields,
          });
          return;
        }

        console.log('✅ [VALIDATION] Combined: all required fields present');
        setPreviousParsedRequest(null);
        await clearContextualMemory(finalConversationId);
      } else if (parsedRequest.requestType === 'flights') {
        // Validate flight fields
        console.log('✈️ [VALIDATION] Validating flight required fields');
        const validation = validateFlightRequiredFields(parsedRequest.flights);

        console.log('📋 [VALIDATION] Validation result:', {
          isValid: validation.isValid,
          missingFields: validation.missingFields,
          missingFieldsSpanish: validation.missingFieldsSpanish,
          errorMessage: validation.errorMessage // ✨ Log custom error message if present
        });

        if (!validation.isValid) {
          console.log('⚠️ [VALIDATION] Missing required fields, requesting more info');

          // Store the current parsed request for future combination
          setPreviousParsedRequest(parsedRequest);
          await saveContextualMemory(finalConversationId, parsedRequest);

          // ✨ CRITICAL: Also save to context state for iteration detection (e.g., "agrega X adultos")
          // This ensures the iteration system can access the failed search context
          const contextStateForFailedSearch: ContextState = {
            lastSearch: {
              requestType: parsedRequest.requestType as 'flights' | 'hotels' | 'combined',
              flightsParams: parsedRequest.flights ? (() => {
                const normalizedFlight = normalizeFlightRequest(parsedRequest.flights);
                return {
                  origin: normalizedFlight?.origin || '',
                  destination: normalizedFlight?.destination || '',
                  departureDate: normalizedFlight?.departureDate || '',
                  returnDate: normalizedFlight?.returnDate,
                  tripType: normalizedFlight?.tripType,
                  segments: normalizedFlight?.segments,
                  adults: normalizedFlight?.adults || 0,
                  children: normalizedFlight?.children || 0,
                  infants: normalizedFlight?.infants || 0,
                  stops: normalizedFlight?.stops,
                  luggage: normalizedFlight?.luggage,
                  preferredAirline: normalizedFlight?.preferredAirline,
                  maxLayoverHours: normalizedFlight?.maxLayoverHours
                };
              })() : undefined
            },
            turnNumber: (persistentState?.turnNumber || 0) + 1
          };
          saveContextState(finalConversationId, contextStateForFailedSearch).catch((e) => console.warn('⚠️ [CONTEXT] Failed to save context state:', e));
          console.log('💾 [CONTEXT] Saving context state for failed validation (fire-and-forget)');

          // ✨ Use custom errorMessage if available (e.g., "only minors" case), otherwise generate standard message
          const missingInfoMessage = validation.errorMessage || buildConversationalMissingInfoMessage({
            parsedRequest,
            missingFields: validation.missingFields,
            fallbackMessage: generateMissingInfoMessage(
              validation.missingFieldsSpanish,
              parsedRequest.requestType
            ),
          });

          console.log('💬 [VALIDATION] Generated missing info message');

          // Add assistant message with missing info request
          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: missingInfoMessage },
            meta: {
              status: 'sent',
              messageType: validation.errorMessage ? 'only_minors_error' : 'missing_info_request',
              missingFields: validation.missingFields,
              originalRequest: parsedRequest
            }
          });

          console.log('✅ [VALIDATION] Missing info message sent, stopping process');
          setIsTyping(false, conversationIdForThisSearch);
          setIsLoading(false);
          flowTimer.end('stopped - flight validation missing info', {
            requestType: parsedRequest.requestType,
            missingFields: validation.missingFields,
          });
          return; // Stop processing here, wait for user response
        }

        console.log('✅ [VALIDATION] All required fields present, proceeding with search');
        // Do NOT clear contextual memory yet. We will clear it after search only if we find results.
      } else if (parsedRequest.requestType === 'hotels') {
        console.log('🏨 [VALIDATION] Validating hotel required fields');
        const validation = validateHotelRequiredFields(parsedRequest.hotels);

        console.log('📋 [VALIDATION] Hotel validation result:', {
          isValid: validation.isValid,
          missingFields: validation.missingFields,
          missingFieldsSpanish: validation.missingFieldsSpanish
        });

        if (!validation.isValid) {
          // ✨ CRITICAL: Check if this is a "only minors" error (has custom errorMessage)
          // If so, don't try to auto-enrich - the issue is specifically about adults
          if (validation.errorMessage) {
            console.log('⚠️ [VALIDATION] "Only minors" error detected - skipping auto-enrich');

            // Store context for iteration detection (enables "agrega X adultos")
            setPreviousParsedRequest(parsedRequest);
            await saveContextualMemory(finalConversationId, parsedRequest);

            const contextStateForFailedSearch: ContextState = {
              lastSearch: {
                requestType: parsedRequest.requestType as 'flights' | 'hotels' | 'combined',
                hotelsParams: parsedRequest.hotels ? {
                  city: parsedRequest.hotels.city,
                  checkinDate: parsedRequest.hotels.checkinDate,
                  checkoutDate: parsedRequest.hotels.checkoutDate,
                  adults: parsedRequest.hotels.adults || 0,
                  children: parsedRequest.hotels.children || 0,
                  infants: (parsedRequest.hotels as any).infants || 0,
                  roomType: parsedRequest.hotels.roomType,
                  mealPlan: parsedRequest.hotels.mealPlan,
                  hotelChains: parsedRequest.hotels.hotelChains
                } : undefined
              },
              turnNumber: (persistentState?.turnNumber || 0) + 1
            };
            saveContextState(finalConversationId, contextStateForFailedSearch).catch((e) => console.warn('⚠️ [CONTEXT] Failed to save context state:', e));
            console.log('💾 [CONTEXT] Saving context state for failed hotel validation (fire-and-forget)');

            await saveAndDisplayMessage({
              conversation_id: finalConversationId,
              role: 'assistant' as const,
              content: { text: validation.errorMessage },
              meta: {
                status: 'sent',
                messageType: 'only_minors_error',
                missingFields: validation.missingFields,
                originalRequest: parsedRequest
              }
            });

            setIsTyping(false, conversationIdForThisSearch);
            setIsLoading(false);
            flowTimer.end('stopped - hotel validation minors only', {
              requestType: parsedRequest.requestType,
              missingFields: validation.missingFields,
            });
            return;
          }

          // Attempt to auto-enrich hotel params from last flight context
          const flightCtx = getContextFromLastFlights() || (previousParsedRequest?.flights ? {
            origin: previousParsedRequest.flights.origin,
            destination: previousParsedRequest.flights.destination,
            departureDate: previousParsedRequest.flights.departureDate,
            returnDate: previousParsedRequest.flights.returnDate,
            adults: previousParsedRequest.flights.adults,
            children: previousParsedRequest.flights.children || 0,
            infants: previousParsedRequest.flights.infants || 0
          } : null);

          if (flightCtx) {
            console.log('🧩 [ENRICH] Filling missing hotel fields from flight context');
            parsedRequest.hotels = {
              // ✅ PRESERVE all existing hotel fields first (hotelChain, hotelName, roomType, mealPlan, etc.)
              ...parsedRequest.hotels,
              // Then fill in missing required fields from flight context
              city: parsedRequest.hotels?.city || flightCtx.destination,
              checkinDate: parsedRequest.hotels?.checkinDate || flightCtx.departureDate,
              checkoutDate: parsedRequest.hotels?.checkoutDate || (flightCtx.returnDate || new Date(new Date(flightCtx.departureDate).getTime() + 3 * 86400000).toISOString().split('T')[0]),
              adults: parsedRequest.hotels?.adults || flightCtx.adults,
              children: parsedRequest.hotels?.children ?? flightCtx.children ?? 0,
              infants: parsedRequest.hotels?.infants ?? flightCtx.infants ?? 0
            } as any;
            console.log('🏨 [ENRICH] Preserved hotel preferences:', {
              hotelChains: parsedRequest.hotels?.hotelChains,
              hotelName: parsedRequest.hotels?.hotelName,
              roomType: parsedRequest.hotels?.roomType,
              mealPlan: parsedRequest.hotels?.mealPlan
            });

            const reval = validateHotelRequiredFields(parsedRequest.hotels);
            console.log('📋 [REVALIDATION] After enrichment:', reval);
            if (!reval.isValid) {
              console.log('⚠️ [VALIDATION] Still missing hotel required fields, requesting more info');
            } else {
              console.log('✅ [VALIDATION] Hotel fields completed via enrichment, continuing');
            }

            if (reval.isValid) {
              // proceed without asking
            } else {
              // Store the current parsed request for future combination
              setPreviousParsedRequest(parsedRequest);
              await saveContextualMemory(finalConversationId, parsedRequest);

              // ✨ Use custom errorMessage if available
              const missingInfoMessage = reval.errorMessage || buildConversationalMissingInfoMessage({
                parsedRequest,
                missingFields: reval.missingFields,
                fallbackMessage: generateMissingInfoMessage(
                  reval.missingFieldsSpanish,
                  parsedRequest.requestType
                ),
              });

              await saveAndDisplayMessage({
                conversation_id: finalConversationId,
                role: 'assistant' as const,
                content: { text: missingInfoMessage },
                meta: {
                  status: 'sent',
                  messageType: reval.errorMessage ? 'only_minors_error' : 'missing_info_request',
                  missingFields: reval.missingFields,
                  originalRequest: parsedRequest
                }
              });

              setIsTyping(false, conversationIdForThisSearch);
              setIsLoading(false);
              flowTimer.end('stopped - hotel revalidation missing info', {
                requestType: parsedRequest.requestType,
                missingFields: reval.missingFields,
              });
              return; // wait for user response
            }
          } else {
            console.log('⚠️ [VALIDATION] Missing hotel required fields and no flight context available');
            // Store the current parsed request for future combination
            setPreviousParsedRequest(parsedRequest);
            await saveContextualMemory(finalConversationId, parsedRequest);

            // ✨ Use custom errorMessage if available
            const missingInfoMessage = validation.errorMessage || buildConversationalMissingInfoMessage({
              parsedRequest,
              missingFields: validation.missingFields,
              fallbackMessage: generateMissingInfoMessage(
                validation.missingFieldsSpanish,
                parsedRequest.requestType
              ),
            });

            await saveAndDisplayMessage({
              conversation_id: finalConversationId,
              role: 'assistant' as const,
              content: { text: missingInfoMessage },
              meta: {
                status: 'sent',
                messageType: validation.errorMessage ? 'only_minors_error' : 'missing_info_request',
                missingFields: validation.missingFields,
                originalRequest: parsedRequest
              }
            });

            setIsTyping(false, conversationIdForThisSearch);
            setIsLoading(false);
            flowTimer.end('stopped - hotel validation missing info', {
              requestType: parsedRequest.requestType,
              missingFields: validation.missingFields,
            });
            return;
          }
        }

        console.log('✅ [VALIDATION] All hotel required fields present, proceeding with search');
        // Clear previous request since we have all required fields
        setPreviousParsedRequest(null);
        await clearContextualMemory(finalConversationId);
      } else if (parsedRequest.requestType === 'itinerary') {
        console.log('🗺️ [VALIDATION] Validating itinerary required fields');

        // Hard requirement: at least 1 destination
        if (!parsedRequest.itinerary?.destinations?.length) {
          console.log('⚠️ [VALIDATION] No destinations provided, requesting more info');
          setPreviousParsedRequest(parsedRequest);
          await saveContextualMemory(finalConversationId, parsedRequest);

          const missingInfoMessage = buildConversationalMissingInfoMessage({
            parsedRequest,
            missingFields: ['destinations'],
            fallbackMessage: generateMissingInfoMessage(
              ['destino(s)'],
              'itinerary',
              {
                itinerary: parsedRequest.itinerary,
                originalMessage: parsedRequest.originalMessage,
              }
            ),
          });

          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: missingInfoMessage },
            meta: {
              status: 'sent',
              messageType: 'missing_info_request',
              missingFields: ['destinations'],
              originalRequest: parsedRequest,
            }
          });

          setIsTyping(false, conversationIdForThisSearch);
          setIsLoading(false);
          flowTimer.end('stopped - itinerary missing destinations', {
            requestType: parsedRequest.requestType,
          });
          return;
        }

        // Merge follow-up into existing planner with assumed fields
        if (plannerState?.fieldProvenance) {
          const hasAssumedFields = Object.values(plannerState.fieldProvenance).some(
            (source: string) => source === 'assumed'
          );
          if (hasAssumedFields && parsedRequest.itinerary) {
            console.log('🔄 [VALIDATION] Merging follow-up into existing planner with assumed fields');
            const { merged, fieldProvenance: updatedProvenance, requiresRegeneration } =
              mergePlannerFieldUpdate(plannerState, parsedRequest.itinerary);

            if (!requiresRegeneration) {
              // Cosmetic update only — update state and respond without regeneration
              await updatePlannerState?.((current) => ({
                ...current,
                ...merged,
                fieldProvenance: updatedProvenance,
              }));

              const confirmedFields = Object.entries(updatedProvenance)
                .filter(([, source]) => source === 'confirmed')
                .map(([field]) => field);
              const confirmMsg = confirmedFields.length > 0
                ? `Actualicé ${confirmedFields.join(', ')} en tu planificador.`
                : 'Tu planificador fue actualizado.';

              await saveAndDisplayMessage({
                conversation_id: finalConversationId,
                role: 'assistant' as const,
                content: { text: confirmMsg },
                meta: { status: 'sent', messageType: 'planner_field_update' },
              });

              setIsTyping(false, conversationIdForThisSearch);
              setIsLoading(false);
              flowTimer.end('completed - planner cosmetic update', {});
              return;
            }

            // Structural change — update parsedRequest with merged data for regeneration
            parsedRequest = {
              ...parsedRequest,
              itinerary: {
                ...parsedRequest.itinerary,
                destinations: merged.destinations,
                days: merged.days,
                startDate: merged.startDate,
                endDate: merged.endDate,
                isFlexibleDates: merged.isFlexibleDates,
                flexibleMonth: merged.flexibleMonth,
                flexibleYear: merged.flexibleYear,
                budgetLevel: merged.budgetLevel,
                pace: merged.pace,
                travelers: merged.travelers,
              },
            };
            setDraftPlannerFromRequest?.(parsedRequest, updatedProvenance);
          }
        }

        // Apply smart defaults for missing optional fields
        if (!plannerState?.fieldProvenance) {
          const { enrichedItinerary, fieldProvenance } = applySmartDefaults(parsedRequest.itinerary);
          parsedRequest = {
            ...parsedRequest,
            itinerary: enrichedItinerary,
          };
          setDraftPlannerFromRequest?.(parsedRequest, fieldProvenance);
        }

        console.log('✅ [VALIDATION] Itinerary proceeding with generation (smart defaults applied)');
        setPreviousParsedRequest(null);
        await clearContextualMemory(finalConversationId);
      }

      // 6. Execute searches based on type (WITHOUT N8N)
      console.log('🔍 [MESSAGE FLOW] Step 12: Starting search process');
      const searchStart = nowMs();

      let assistantResponse = '';
      let structuredData = null;

      // Lock domain for this turn to avoid cross responses
      const domainForTurn = parsedRequest.requestType === 'hotels' ? 'hotels'
        : parsedRequest.requestType === 'flights' ? 'flights'
          : parsedRequest.requestType === 'combined' ? 'flights' : null;
      activeDomain = domainForTurn || activeDomain;

      switch (parsedRequest.requestType) {
        case 'missing_info_request': {
          console.log('❓ [MESSAGE FLOW] Step 12a: Missing info request - asking for more details');
          assistantResponse = parsedRequest.message || 'Necesito más información para ayudarte. Por favor, proporciona los datos faltantes.';
          structuredData = {
            messageType: 'missing_info_request',
            missingFields: parsedRequest.missingFields || [],
            originalRequest: parsedRequest // ← Guardamos el request completo para contexto
          };
          console.log('✅ [MESSAGE FLOW] Missing info request completed');
          break;
        }
        case 'flights': {
          console.log('✈️ [MESSAGE FLOW] Step 12b: Processing flight search');
          setTypingMessage('Buscando los mejores vuelos...', conversationIdForThisSearch);
          const flightResult = await handleFlightSearch(parsedRequest);
          assistantResponse = flightResult.response;
          structuredData = flightResult.data;
          console.log('✅ [MESSAGE FLOW] Flight search completed');
          break;
        }
        case 'hotels': {
          console.log('🏨 [MESSAGE FLOW] Step 12c: Processing hotel search');
          setTypingMessage('Buscando los mejores hoteles...', conversationIdForThisSearch);
          const hotelResult = await handleHotelSearch(parsedRequest);
          assistantResponse = hotelResult.response;
          structuredData = hotelResult.data;
          console.log('✅ [MESSAGE FLOW] Hotel search completed');
          break;
        }
        case 'packages': {
          console.log('🎒 [MESSAGE FLOW] Step 12d: Processing package search');
          const packageResult = await handlePackageSearch(parsedRequest);
          assistantResponse = packageResult.response;
          structuredData = packageResult.data;
          console.log('✅ [MESSAGE FLOW] Package search completed');
          break;
        }
        case 'services': {
          console.log('🚌 [MESSAGE FLOW] Step 12e: Processing service search');
          const serviceResult = await handleServiceSearch(parsedRequest);
          assistantResponse = serviceResult.response;
          console.log('✅ [MESSAGE FLOW] Service search completed');
          break;
        }
        case 'combined': {
          // Respect domain lock: if user intent was hotel-only turn, prioritize hotels; else run combined
          if (activeDomain === 'hotels') {
            console.log('🏨 [MESSAGE FLOW] Step 12f: Domain locked to hotels, skipping flights');
            setTypingMessage('Buscando los mejores hoteles...', conversationIdForThisSearch);
            const hotelResult = await handleHotelSearch({
              ...parsedRequest,
              requestType: 'hotels'
            } as any);
            assistantResponse = hotelResult.response;
            structuredData = hotelResult.data;
          } else {
            console.log('🌟 [MESSAGE FLOW] Step 12f: Processing combined search');
            setTypingMessage('Buscando las mejores opciones de viaje...', conversationIdForThisSearch);
            const combinedResult = await handleCombinedSearch(parsedRequest);
            assistantResponse = combinedResult.response;
            structuredData = combinedResult.data;
            console.log('✅ [MESSAGE FLOW] Combined search completed');
          }
          break;
        }
        case 'itinerary': {
          console.log('🗺️ [MESSAGE FLOW] Step 12g: Processing itinerary request');
          if (conversationTurn.responseMode === 'show_places') {
            setTypingMessage('Buscando los lugares más representativos...', conversationIdForThisSearch);
            const discoveryResult = await buildDiscoveryResponsePayload({
              message: parsedRequest.originalMessage || currentMessage,
              parsedRequest,
              plannerState: plannerState || null,
              conversationHistory: messages,
            });
            assistantResponse = discoveryResult.text;
            structuredData = {
              messageType: 'discovery_results',
              discoveryContext: discoveryResult.discoveryContext,
              recommendedPlaces: discoveryResult.recommendedPlaces,
            };
          } else {
            setPlannerDraftPhase?.('draft_generating');
            setTypingMessage('Generando tu itinerario de viaje...', conversationIdForThisSearch);
            const itineraryResult = await handleItineraryRequest(parsedRequest, plannerState || null);
            // Wrap in canonical pipeline
            const canonicalStdResult = buildCanonicalResultFromStandard({
              response: itineraryResult.response,
              structuredData: itineraryResult.data,
              conversationTurn,
              routeResult,
              requestText: parsedRequest.originalMessage || currentMessage,
              editorial: itineraryResult.data?.editorial ?? null,
            });
            assistantResponse = canonicalStdResult.response;
            structuredData = canonicalStdResult;
          }
          console.log('✅ [MESSAGE FLOW] Itinerary generation completed');
          break;
        }
        default:
          console.log('💬 [MESSAGE FLOW] Step 12h: Processing general query');
          assistantResponse = await handleGeneralQuery(parsedRequest);
          console.log('✅ [MESSAGE FLOW] General query completed');
      }

      logTimingStep('MESSAGE FLOW', `search handler (${parsedRequest.requestType})`, searchStart, {
        hasStructuredData: Boolean(structuredData),
      });

      // === EMILIA: Prepend inferred-field summary when defaults were applied ===
      if (routeResult.inferredFields.length > 0 && assistantResponse && conversationTurn.responseMode !== 'show_places') {
        const inferredDetails = getInferredFieldDetails(parsedRequest);
        if (inferredDetails.length > 0) {
          const summary = buildSearchSummary(parsedRequest, inferredDetails);
          if (summary) {
            assistantResponse = `${summary}\n\n${assistantResponse}`;
            console.log('📋 [ROUTER] Prepended inferred-field summary:', summary);
          }
        }
      }

      console.log('📝 [MESSAGE FLOW] Step 12: Generated assistant response');
      console.log('💬 Response preview:', assistantResponse.substring(0, 100) + '...');
      console.log('📊 Structured data:', structuredData);

      // Clear or preserve contextual memory depending on search results
      // 🔄 ENHANCED: Save complete ContextState for iteration support
      try {
        const flightsCount = (structuredData as any)?.combinedData?.flights?.length ?? 0;
        const hotelsCount = (structuredData as any)?.combinedData?.hotels?.length ?? 0;
        const hasPlannerData = Boolean((structuredData as any)?.plannerData);
        const hasDiscoveryContext = Boolean((structuredData as any)?.discoveryContext);
        const hasResults = flightsCount > 0 || hotelsCount > 0 || hasPlannerData || hasDiscoveryContext;
        
        if (hasResults) {
          // We have usable results, clear old contextual memory
          setPreviousParsedRequest(null);
          await clearContextualMemory(finalConversationId);

          if (hasPlannerData && (structuredData as any)?.source) {
            // Canonical itinerary result — use unified persistence pipeline
            await persistCanonicalResult(structuredData as CanonicalItineraryResult, { persistPlannerState });
          } else if (hasPlannerData && persistPlannerState && conversationTurn.responseMode !== 'show_places') {
            // Non-canonical (other request types) — legacy persistence
            await persistPlannerState((structuredData as any).plannerData, 'chat');
          }

          // Extract actual dates from the first flight found (if any)
          const firstFlight = (structuredData as any)?.combinedData?.flights?.[0];
          const actualDepartureDate = firstFlight?.departure_date || parsedRequest.flights?.departureDate;
          const actualReturnDate = firstFlight?.return_date || parsedRequest.flights?.returnDate;

          if (parsedRequest.requestType !== 'itinerary') {
            // Build ContextState via shared builder
            const normalizedFlight = parsedRequest.flights ? normalizeFlightRequest(parsedRequest.flights) : null;
            const newConstraints: Array<{ component: string; constraint: string; value: unknown }> = [];
            if (iterationContext.isIteration && parsedRequest.hotels?.hotelChains) {
              newConstraints.push({ component: 'hotels', constraint: 'hotelChains', value: parsedRequest.hotels.hotelChains });
            }
            if (iterationContext.isIteration && parsedRequest.hotels?.hotelName) {
              newConstraints.push({ component: 'hotels', constraint: 'hotelName', value: parsedRequest.hotels.hotelName });
            }

            const newContextState = buildTurnContextState({
              requestType: parsedRequest.requestType as 'flights' | 'hotels' | 'combined',
              flightsParams: normalizedFlight ? {
                origin: normalizedFlight.origin || '',
                destination: normalizedFlight.destination || '',
                departureDate: actualDepartureDate || normalizedFlight.departureDate || '',
                returnDate: actualReturnDate || normalizedFlight.returnDate,
                tripType: normalizedFlight.tripType,
                segments: normalizedFlight.segments,
                adults: normalizedFlight.adults || 1,
                children: normalizedFlight.children || 0,
                infants: normalizedFlight.infants || 0,
                stops: normalizedFlight.stops,
                preferredAirline: normalizedFlight.preferredAirline,
                luggage: normalizedFlight.luggage,
                maxLayoverHours: normalizedFlight.maxLayoverHours,
              } : null,
              hotelsParams: parsedRequest.hotels ? {
                city: parsedRequest.hotels.city,
                checkinDate: parsedRequest.hotels.checkinDate,
                checkoutDate: parsedRequest.hotels.checkoutDate,
                adults: parsedRequest.hotels.adults || 1,
                children: parsedRequest.hotels.children || 0,
                infants: parsedRequest.hotels.infants || 0,
                roomType: parsedRequest.hotels.roomType,
                mealPlan: parsedRequest.hotels.mealPlan,
                hotelChains: parsedRequest.hotels.hotelChains,
                hotelName: parsedRequest.hotels.hotelName,
              } : null,
              flightsCount,
              hotelsCount,
              previousState: persistentState,
              newConstraints,
            });

            saveContextState(finalConversationId, newContextState).catch((e) => console.warn('⚠️ [CONTEXT] Failed to save context state:', e));
          }
        } else {
          // No results - preserve context for retry (e.g., "con escalas")
          console.log('⚠️ [STATE] No results, preserving context for potential retry');
          saveContextualMemory(finalConversationId, parsedRequest).catch((e) => console.warn('⚠️ [MEMORY] Failed to save contextual memory:', e));
          setPreviousParsedRequest(parsedRequest);
        }
      } catch (memErr) {
        console.warn('⚠️ [MEMORY] Could not update contextual memory after search:', memErr);
      }

      // 5. Save response with structured data
      console.log('📤 [MESSAGE FLOW] Step 13: About to save assistant message (Supabase INSERT)');

      // Save assistant message to database
      const saveAssistantStart = nowMs();
      await saveAndDisplayMessage({
        conversation_id: finalConversationId,
        role: 'assistant' as const,
        content: { text: assistantResponse },
        meta: (structuredData as any)?.source
          ? buildCanonicalMeta(structuredData as CanonicalItineraryResult)
          : {
              messageType: conversationTurn.messageType,
              responseMode: conversationTurn.responseMode,
              ...(conversationTurn.normalizedMissingFields.length > 0 ? { normalizedMissingFields: conversationTurn.normalizedMissingFields } : {}),
              requestText: parsedRequest.originalMessage || currentMessage,
              ...(structuredData ? { source: 'AI_PARSER + EUROVIPS', ...structuredData } : {}),
              emiliaRoute: {
                route: routeResult.route,
                score: routeResult.score,
                reason: routeResult.reason,
                inferredFields: routeResult.inferredFields,
              },
              conversationTurn,
            },
      });
      logTimingStep('MESSAGE FLOW', 'save assistant message', saveAssistantStart, {
        hasStructuredData: Boolean(structuredData),
      });

      console.log('✅ [MESSAGE FLOW] Step 14: Assistant message saved successfully');

      // ✅ Hide typing indicator for THIS conversation (not the current one, in case user switched)
      setIsTyping(false, conversationIdForThisSearch);
      setIsLoading(false);
      console.log('✅ [TYPING] Hiding typing indicator for conversation:', conversationIdForThisSearch);

      // 6. Lead generation disabled - Only manual creation via button
      console.log('📋 [MESSAGE FLOW] Step 15: Automatic lead generation disabled - only manual creation available');

      console.log('🎉 [MESSAGE FLOW] Message processing completed successfully');
      flowTimer.end('total', {
        requestType: parsedRequest.requestType,
        hasStructuredData: Boolean(structuredData),
      });

    } catch (error) {
      flowTimer.fail('failed', error, {
        conversationId: currentConversationId,
      });
      console.error('❌ [MESSAGE FLOW] Error in handleSendMessage process:', error);

      // ✅ Hide indicators for THIS conversation (not the current one)
      setIsLoading(false);
      setIsTyping(false, conversationIdForThisSearch);
      console.log('❌ [TYPING] Hiding typing indicator due to error for conversation:', conversationIdForThisSearch);

      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  }, [
    selectedConversation,
    previousParsedRequest,
    setPreviousParsedRequest,
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    updateMessageStatus,
    updateConversationTitle,
    handleCheaperFlightsSearch,
    handlePriceChangeRequest,
    setIsLoading,
    setIsTyping,
    setMessage,
    toast,
    messages,
    getContextFromLastFlights,
    persistPlannerState,
    plannerState,
    setDraftPlannerFromRequest,
    setPlannerDraftPhase,
    updatePlannerState,
    setTypingMessage,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
    saveAndDisplayMessage,
    chatMode,
  ]);

  const handlePlannerDateSelection = useCallback(async (
    baseRequest: ParsedTravelRequest,
    selection: {
      startDate?: string;
      endDate?: string;
      isFlexibleDates: boolean;
      flexibleMonth?: string;
      flexibleYear?: number;
      days?: number;
    }
  ) => {
    const currentConversationId = selectedConversationRef.current;
    if (!currentConversationId) {
      toast({
        title: "Error",
        description: "No hay una conversación activa para continuar el plan.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsTyping(true, currentConversationId);
    setTypingMessage('Generando tu itinerario de viaje...', currentConversationId);

    try {
      const computedDays = selection.isFlexibleDates
        ? (selection.days || baseRequest.itinerary?.days)
        : (selection.days || calculateTripDays(selection.startDate, selection.endDate) || baseRequest.itinerary?.days);

      const mergedRequest: ParsedTravelRequest = {
        ...baseRequest,
        requestType: 'itinerary',
        itinerary: {
          ...baseRequest.itinerary,
          days: computedDays,
          startDate: selection.isFlexibleDates ? undefined : selection.startDate,
          endDate: selection.isFlexibleDates ? undefined : selection.endDate,
          isFlexibleDates: selection.isFlexibleDates,
          flexibleMonth: selection.isFlexibleDates ? selection.flexibleMonth : undefined,
          flexibleYear: selection.isFlexibleDates ? selection.flexibleYear : undefined,
          dateSelectionSource: selection.isFlexibleDates ? 'chat_modal_flexible' : 'chat_modal_exact',
        },
        originalMessage: baseRequest.originalMessage,
      };

      setDraftPlannerFromRequest?.(mergedRequest);
      const validation = validateItineraryRequiredFields(mergedRequest.itinerary);
      if (!validation.isValid) {
        const missingInfoMessage = buildConversationalMissingInfoMessage({
          parsedRequest: mergedRequest,
          missingFields: validation.missingFields,
          fallbackMessage: generateMissingInfoMessage(
            validation.missingFieldsSpanish,
            'itinerary',
            {
              itinerary: mergedRequest.itinerary,
              originalMessage: mergedRequest.originalMessage,
            }
          ),
        });

        await saveAndDisplayMessage({
          conversation_id: currentConversationId,
          role: 'assistant',
          content: { text: missingInfoMessage },
          meta: {
            status: 'sent',
            messageType: 'missing_info_request',
            missingFields: validation.missingFields,
            originalRequest: mergedRequest,
            plannerPromptAction: 'open_date_selector',
            plannerDateSelector: {
              enabled: true,
              mode: 'required',
              suggestedDurationDays: mergedRequest.itinerary?.days,
              suggestedMonthText: mergedRequest.originalMessage,
            }
          }
        });

        setPreviousParsedRequest(mergedRequest);
        await saveContextualMemory(currentConversationId, mergedRequest);
        setIsTyping(false, currentConversationId);
        setIsLoading(false);
        return;
      }

      setPlannerDraftPhase?.('draft_generating');
      await saveAndDisplayMessage({
        conversation_id: currentConversationId,
        role: 'user',
        content: { text: formatPlannerDateSelectionMessage(selection) },
        meta: {
          status: 'sent',
          messageType: 'planner_date_selection',
          originalRequest: mergedRequest,
        }
      });

      const itineraryResult = await handleItineraryRequest(mergedRequest, plannerState || null);
      const assistantResponse = itineraryResult.response;
      const structuredData = itineraryResult.data;
      const hasPlannerData = Boolean((structuredData as any)?.plannerData);

      if (hasPlannerData) {
        setPreviousParsedRequest(null);
        await clearContextualMemory(currentConversationId);
        if (persistPlannerState) {
          await persistPlannerState((structuredData as any).plannerData, 'chat');
        }
      } else {
        setPreviousParsedRequest(mergedRequest);
        await saveContextualMemory(currentConversationId, mergedRequest);
      }

      await saveAndDisplayMessage({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: { text: assistantResponse },
        meta: structuredData
          ? {
              source: 'PLANNER_DATE_MODAL',
              ...structuredData,
              originalRequest: mergedRequest,
            }
          : {
              source: 'PLANNER_DATE_MODAL',
              originalRequest: mergedRequest,
            }
      });

      setIsTyping(false, currentConversationId);
      setIsLoading(false);
    } catch (error) {
      console.error('❌ [PLANNER DATE MODAL] Error continuing planner flow:', error);
      setIsLoading(false);
      setIsTyping(false, currentConversationId);
      toast({
        title: "Error",
        description: "No se pudo continuar el plan con las fechas elegidas.",
        variant: "destructive",
      });
    }
  }, [
    clearContextualMemory,
    persistPlannerState,
    plannerState,
    saveContextualMemory,
    setDraftPlannerFromRequest,
    setPlannerDraftPhase,
    selectedConversationRef,
    setIsLoading,
    setIsTyping,
    setPreviousParsedRequest,
    setTypingMessage,
    toast,
    validateItineraryRequiredFields,
    saveAndDisplayMessage,
  ]);

  return {
    handleSendMessage,
    handlePlannerDateSelection,
  };
};

export default useMessageHandler;
