import { useCallback } from 'react';
import { parseMessageWithAI, combineWithPreviousRequest, validateFlightRequiredFields, validateHotelRequiredFields, generateMissingInfoMessage } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { handleFlightSearch, handleHotelSearch, handleCombinedSearch, handlePackageSearch, handleServiceSearch, handleGeneralQuery } from '../services/searchHandlers';
import { addMessageViaSupabase } from '../services/messageService';
import { generateChatTitle } from '../utils/messageHelpers';
import { isAddHotelRequest, isCheaperFlightRequest, isPriceChangeRequest } from '../utils/intentDetection';
import type { MessageRow } from '../types/chat';
import { useMessages } from '@/hooks/useChat-polling';

const useMessageHandler = (
  selectedConversation: string | null,
  previousParsedRequest: ParsedTravelRequest | null,
  setPreviousParsedRequest: (request: ParsedTravelRequest | null) => void,
  loadContextualMemory: (conversationId: string) => Promise<ParsedTravelRequest | null>,
  saveContextualMemory: (conversationId: string, request: ParsedTravelRequest) => Promise<void>,
  clearContextualMemory: (conversationId: string) => Promise<void>,
  updateMessageStatus: (messageId: string, status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed') => Promise<any>,
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>,
  handleCheaperFlightsSearch: (message: string) => Promise<string | null>,
  handlePriceChangeRequest: (message: string) => Promise<{ response: string; modifiedPdfUrl?: string } | null>,
  setIsLoading: (loading: boolean) => void,
  setIsTyping: (typing: boolean) => void,
  setMessage: (message: string) => void,
  toast: any
) => {
  const { messages, refreshMessages } = useMessages(selectedConversation);

  // Track active domain for this conversation to avoid cross responses
  let activeDomain: 'flights' | 'hotels' | null = null;

  // Helper: extract last flight context (destination/dates/adults/children) from recent assistant message
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
      return { origin, destination, departureDate, returnDate, adults, children };
    } catch (e) {
      console.warn('⚠️ [CONTEXT] Could not extract last flight context:', e);
      return null;
    }
  }, [messages]);

  const handleSendMessage = useCallback(async (currentMessage: string) => {
    console.log('🚀 [MESSAGE FLOW] Starting handleSendMessage process');
    console.log('📝 Message content:', currentMessage);
    console.log('💬 Selected conversation:', selectedConversation);

    if (!currentMessage.trim() || !selectedConversation) {
      console.warn('❌ [MESSAGE FLOW] Validation failed - aborting send');
      return;
    }

    // Check if this is a cheaper flights search request for a previously uploaded PDF
    if (isCheaperFlightRequest(currentMessage)) {
      console.log('✈️ [CHEAPER FLIGHTS] Detected cheaper flights search request for previous PDF');

      setIsLoading(true);

      try {
        const responseMessage = await handleCheaperFlightsSearch(currentMessage);

        if (responseMessage) {
          // Send response message
          await addMessageViaSupabase({
            conversation_id: selectedConversation,
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
        return; // Exit early, don't process as regular message

      } catch (error) {
        console.error('❌ Error searching for cheaper flights:', error);

        await addMessageViaSupabase({
          conversation_id: selectedConversation,
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
        return;
      }
    }

    // If user asks to add a hotel for same dates after flight results, coerce to combined using last flight context
    if (isAddHotelRequest(currentMessage)) {
      // Try to reuse flight context from last assistant message; fallback to previous parsed request
      const flightCtx = getContextFromLastFlights() || (previousParsedRequest?.flights ? {
        origin: previousParsedRequest.flights.origin,
        destination: previousParsedRequest.flights.destination,
        departureDate: previousParsedRequest.flights.departureDate,
        returnDate: previousParsedRequest.flights.returnDate,
        adults: previousParsedRequest.flights.adults,
        children: previousParsedRequest.flights.children || 0
      } : null);
      if (flightCtx) {
        console.log('🏨 [INTENT] Add hotel detected, reusing flight context for combined search');
        setIsLoading(true);
        try {
          // Save user's intent message into conversation before executing
          await addMessageViaSupabase({
            conversation_id: selectedConversation!,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sent', messageType: 'add_hotel_intent' }
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
              roomType: 'double',
              mealPlan: 'breakfast'
            },
            confidence: 0.9,
            originalMessage: currentMessage
          } as any;

          // Persist context for follow-ups
          setPreviousParsedRequest(hotelsParsed);
          await saveContextualMemory(selectedConversation, hotelsParsed);

          // Run HOTELS search only
          const hotelResult = await handleHotelSearch(hotelsParsed);

          await addMessageViaSupabase({
            conversation_id: selectedConversation,
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
      }
    }

    // Check if this is a price change request for a previously uploaded PDF
    if (isPriceChangeRequest(currentMessage)) {
      console.log('💰 [PRICE CHANGE] Detected price change request for previous PDF');

      setIsLoading(true);

      try {
        // Add user message
        await addMessageViaSupabase({
          conversation_id: selectedConversation,
          role: 'user' as const,
          content: { text: currentMessage.trim() },
          meta: { status: 'sent', messageType: 'price_change_request' }
        });

        const result = await handlePriceChangeRequest(currentMessage);

        if (result) {
          // Add assistant response
          await addMessageViaSupabase({
            conversation_id: selectedConversation,
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

        setMessage('');
        return; // Exit early, don't continue with normal flow

      } catch (error) {
        console.error('❌ Error processing price change request:', error);
        toast({
          title: "Error",
          description: "No pude procesar tu solicitud de cambio de precio.",
          variant: "destructive",
        });
        setMessage('');
        return;
      } finally {
        setIsLoading(false);
      }
    }

    setMessage('');
    setIsLoading(true);
    setIsTyping(true);

    console.log('✅ [MESSAGE FLOW] Step 1: Message validation passed');
    console.log('📨 Processing message:', currentMessage);

    try {
      // 1. Save user message
      console.log('📤 [MESSAGE FLOW] Step 2: About to save user message (Supabase INSERT)');

      const userMessage = await addMessageViaSupabase({
        conversation_id: selectedConversation,
        role: 'user' as const,
        content: { text: currentMessage },
        meta: { status: 'sending' }
      });

      console.log('✅ [MESSAGE FLOW] Step 3: User message saved successfully');

      console.log('📤 [MESSAGE FLOW] Step 4: About to update message status (Supabase UPDATE)');
      await updateMessageStatus(userMessage.id, 'sent');
      console.log('✅ [MESSAGE FLOW] Step 5: Message status updated to "sent"');

      // Force refresh messages to ensure UI updates (immediate + delayed)
      console.log('🔄 [MESSAGE FLOW] Step 5.5: Force refreshing messages to ensure UI updates');
      refreshMessages(); // Immediate refresh
      setTimeout(() => refreshMessages(), 500); // Quick fallback

      // 2. Update conversation title if first message
      if (messages.length === 0) {
        console.log('🏷️ [MESSAGE FLOW] Step 6: First message - updating conversation title');
        const title = generateChatTitle(currentMessage);
        console.log('📝 Generated title:', title);

        try {
          console.log('📤 [MESSAGE FLOW] About to update conversation title (Supabase UPDATE)');
          await updateConversationTitle(selectedConversation, title);
          console.log(`✅ [MESSAGE FLOW] Step 7: Conversation title updated to: "${title}"`);
        } catch (titleError) {
          console.error('❌ [MESSAGE FLOW] Error updating conversation title:', titleError);
          // Don't fail the whole process if title update fails
        }
      }

      // 3. Load contextual memory before parsing
      console.log('🧠 [MESSAGE FLOW] Step 7.5: Loading contextual memory before parsing');
      console.log('🔍 [DEBUG] Selected conversation:', selectedConversation);
      console.log('🔍 [DEBUG] Previous parsed request from state:', previousParsedRequest);

      const contextFromDB = await loadContextualMemory(selectedConversation);
      // Load persistent context state (params that persist across turns)
      const { loadContextState, saveContextState } = require('./useContextualMemory');
      const persistentState = await (loadContextState as any)(selectedConversation);
      console.log('🔍 [DEBUG] Context loaded from DB:', contextFromDB);
      console.log('🔍 [DEBUG] Persistent context state:', persistentState);

      const contextToUse = contextFromDB || previousParsedRequest || persistentState;
      console.log('📝 [CONTEXT] Final context to use:', contextToUse);

      // 4. Use AI Parser to classify request
      console.log('🤖 [MESSAGE FLOW] Step 8: Starting AI parsing process');
      console.log('📤 [MESSAGE FLOW] About to call AI message parser (Supabase Edge Function)');
      console.log('🧠 Message to parse:', currentMessage);

      // Prepare full conversation history for better context understanding
      const conversationHistory = messages?.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string'
          ? msg.content
          : typeof msg.content === 'object' && msg.content !== null
            ? (msg.content as { text?: string }).text || ''
            : '',
        timestamp: msg.created_at
      })) || [];

      console.log('📚 [CONTEXT] Sending full conversation history to AI parser:', {
        messageCount: conversationHistory.length,
        previousContext: contextToUse ? 'Yes' : 'No'
      });

      let parsedRequest = await parseMessageWithAI(currentMessage, contextToUse, conversationHistory);

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

      // If user replied "con escalas" after a direct-only attempt, force a flights request with stops:any using prior context
      if (/\bcon\s+escalas\b/i.test(currentMessage)) {
        const baseFlights = parsedRequest?.flights || previousParsedRequest?.flights || (contextToUse as any)?.flights;
        if (baseFlights?.origin && baseFlights?.destination && baseFlights?.departureDate && (baseFlights?.adults ?? 0) >= 1) {
          parsedRequest = {
            requestType: 'flights',
            flights: {
              ...baseFlights,
              stops: 'any' as any
            },
            confidence: parsedRequest?.confidence ?? 0.9,
            originalMessage: currentMessage
          } as any;
          console.log('🔀 [INTENT] Forced flights search with stops:any using prior context');
        }
      }

      console.log('✅ [MESSAGE FLOW] Step 9: AI parsing completed successfully');
      console.log('🎯 AI parsing result:', parsedRequest);

      // 5. Combine with previous request if available (contextual memory)
      console.log('🧠 [MESSAGE FLOW] Step 10: Combining with previous request');
      if (previousParsedRequest) {
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

      // Only coerce to combined if user explicitly mentions both services AND doesn't reject hotel
      if (explicitlyWantsHotel && explicitlyWantsFlight && !explicitlyRejectsHotel && parsedRequest.requestType !== 'combined') {
        console.log('🔀 [INTENT] Coercing requestType to combined based on explicit hotel+flight mention');
        parsedRequest.requestType = 'combined';
        // Mirror city/dates from flights to hotels if missing
        const f = parsedRequest.flights;
        parsedRequest.hotels = parsedRequest.hotels || ({} as any);
        if (f?.destination && !parsedRequest.hotels.city) parsedRequest.hotels.city = f.destination as any;
        if (f?.departureDate && !parsedRequest.hotels.checkinDate) parsedRequest.hotels.checkinDate = f.departureDate as any;
        if (f?.returnDate && !parsedRequest.hotels.checkoutDate) parsedRequest.hotels.checkoutDate = f.returnDate as any;
        if (f?.adults && !parsedRequest.hotels.adults) parsedRequest.hotels.adults = f.adults as any;
        parsedRequest.hotels.children = parsedRequest.hotels.children ?? (f?.children as any) ?? 0;
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
        const flightVal = validateFlightRequiredFields(parsedRequest.flights);
        const hotelVal = validateHotelRequiredFields(parsedRequest.hotels);

        const missingAny = !flightVal.isValid || !hotelVal.isValid;
        console.log('🧾 [VALIDATION] Combined results:', { flight: flightVal, hotel: hotelVal });
        if (missingAny) {
          // Persist context
          setPreviousParsedRequest(parsedRequest);
          await saveContextualMemory(selectedConversation, parsedRequest);

          // Build aggregated message
          let parts: string[] = [];
          if (!flightVal.isValid) {
            parts.push(
              generateMissingInfoMessage(flightVal.missingFieldsSpanish, 'flights')
            );
          }
          if (!hotelVal.isValid) {
            parts.push(
              generateMissingInfoMessage(hotelVal.missingFieldsSpanish, 'hotels')
            );
          }
          const missingInfoMessage = parts.join('\n\n');

          await addMessageViaSupabase({
            conversation_id: selectedConversation,
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
          return;
        }

        console.log('✅ [VALIDATION] Combined: all required fields present');
        setPreviousParsedRequest(null);
        await clearContextualMemory(selectedConversation);
      } else if (parsedRequest.requestType === 'flights') {
        // Validate flight fields
        console.log('✈️ [VALIDATION] Validating flight required fields');
        const validation = validateFlightRequiredFields(parsedRequest.flights);

        console.log('📋 [VALIDATION] Validation result:', {
          isValid: validation.isValid,
          missingFields: validation.missingFields,
          missingFieldsSpanish: validation.missingFieldsSpanish
        });

        if (!validation.isValid) {
          console.log('⚠️ [VALIDATION] Missing required fields, requesting more info');

          // Store the current parsed request for future combination
          setPreviousParsedRequest(parsedRequest);
          await saveContextualMemory(selectedConversation, parsedRequest);

          // Generate message asking for missing information
          const missingInfoMessage = generateMissingInfoMessage(
            validation.missingFieldsSpanish,
            parsedRequest.requestType
          );

          console.log('💬 [VALIDATION] Generated missing info message');

          // Add assistant message with missing info request
          await addMessageViaSupabase({
            conversation_id: selectedConversation,
            role: 'assistant' as const,
            content: { text: missingInfoMessage },
            meta: {
              status: 'sent',
              messageType: 'missing_info_request',
              missingFields: validation.missingFields,
              originalRequest: parsedRequest
            }
          });

          console.log('✅ [VALIDATION] Missing info message sent, stopping process');
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
          // Attempt to auto-enrich hotel params from last flight context
          const flightCtx = getContextFromLastFlights() || (previousParsedRequest?.flights ? {
            origin: previousParsedRequest.flights.origin,
            destination: previousParsedRequest.flights.destination,
            departureDate: previousParsedRequest.flights.departureDate,
            returnDate: previousParsedRequest.flights.returnDate,
            adults: previousParsedRequest.flights.adults,
            children: previousParsedRequest.flights.children || 0
          } : null);

          if (flightCtx) {
            console.log('🧩 [ENRICH] Filling missing hotel fields from flight context');
            parsedRequest.hotels = {
              city: parsedRequest.hotels?.city || flightCtx.destination,
              checkinDate: parsedRequest.hotels?.checkinDate || flightCtx.departureDate,
              checkoutDate: parsedRequest.hotels?.checkoutDate || (flightCtx.returnDate || new Date(new Date(flightCtx.departureDate).getTime() + 3 * 86400000).toISOString().split('T')[0]),
              adults: parsedRequest.hotels?.adults || flightCtx.adults,
              children: parsedRequest.hotels?.children ?? flightCtx.children ?? 0,
              roomType: parsedRequest.hotels?.roomType || 'double',
              mealPlan: parsedRequest.hotels?.mealPlan || 'breakfast'
            } as any;

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
              await saveContextualMemory(selectedConversation, parsedRequest);

              const missingInfoMessage = generateMissingInfoMessage(
                reval.missingFieldsSpanish,
                parsedRequest.requestType
              );

              await addMessageViaSupabase({
                conversation_id: selectedConversation,
                role: 'assistant' as const,
                content: { text: missingInfoMessage },
                meta: {
                  status: 'sent',
                  messageType: 'missing_info_request',
                  missingFields: reval.missingFields,
                  originalRequest: parsedRequest
                }
              });

              return; // wait for user response
            }
          } else {
            console.log('⚠️ [VALIDATION] Missing hotel required fields and no flight context available');
            // Store the current parsed request for future combination
            setPreviousParsedRequest(parsedRequest);
            await saveContextualMemory(selectedConversation, parsedRequest);

            const missingInfoMessage = generateMissingInfoMessage(
              validation.missingFieldsSpanish,
              parsedRequest.requestType
            );

            await addMessageViaSupabase({
              conversation_id: selectedConversation,
              role: 'assistant' as const,
              content: { text: missingInfoMessage },
              meta: {
                status: 'sent',
                messageType: 'missing_info_request',
                missingFields: validation.missingFields,
                originalRequest: parsedRequest
              }
            });

            return;
          }
        }

        console.log('✅ [VALIDATION] All hotel required fields present, proceeding with search');
        // Clear previous request since we have all required fields
        setPreviousParsedRequest(null);
        await clearContextualMemory(selectedConversation);
      }

      // 6. Execute searches based on type (WITHOUT N8N)
      console.log('🔍 [MESSAGE FLOW] Step 12: Starting search process');

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
          const flightResult = await handleFlightSearch(parsedRequest);
          assistantResponse = flightResult.response;
          structuredData = flightResult.data;
          console.log('✅ [MESSAGE FLOW] Flight search completed');
          break;
        }
        case 'hotels': {
          console.log('🏨 [MESSAGE FLOW] Step 12c: Processing hotel search');
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
            const hotelResult = await handleHotelSearch({
              ...parsedRequest,
              requestType: 'hotels'
            } as any);
            assistantResponse = hotelResult.response;
            structuredData = hotelResult.data;
          } else {
            console.log('🌟 [MESSAGE FLOW] Step 12f: Processing combined search');
            const combinedResult = await handleCombinedSearch(parsedRequest);
            assistantResponse = combinedResult.response;
            structuredData = combinedResult.data;
            console.log('✅ [MESSAGE FLOW] Combined search completed');
          }
          break;
        }
        default:
          console.log('💬 [MESSAGE FLOW] Step 12g: Processing general query');
          assistantResponse = await handleGeneralQuery(parsedRequest);
          console.log('✅ [MESSAGE FLOW] General query completed');
      }

      console.log('📝 [MESSAGE FLOW] Step 12: Generated assistant response');
      console.log('💬 Response preview:', assistantResponse.substring(0, 100) + '...');
      console.log('📊 Structured data:', structuredData);

      // Clear or preserve contextual memory depending on search results
      try {
        if (parsedRequest.requestType === 'flights') {
          const flightsCount = (structuredData as any)?.combinedData?.flights?.length ?? 0;
          if (flightsCount > 0) {
            // We have usable results, clear context
            setPreviousParsedRequest(null);
            await clearContextualMemory(selectedConversation);
            // Save persistent state for flights
            const state = {
              flights: parsedRequest.flights,
              domain: 'flights'
            };
            await (saveContextState as any)(selectedConversation, state);
          } else {
            // No results (e.g., no direct flights). Preserve context so follow-up like "con escalas" can merge.
            await saveContextualMemory(selectedConversation, parsedRequest);
            setPreviousParsedRequest(parsedRequest);
          }
        } else if (parsedRequest.requestType === 'hotels') {
          const hotelsCount = (structuredData as any)?.combinedData?.hotels?.length ?? 0;
          if (hotelsCount > 0) {
            const state = {
              hotels: parsedRequest.hotels,
              domain: 'hotels'
            };
            await (saveContextState as any)(selectedConversation, state);
          }
        }
      } catch (memErr) {
        console.warn('⚠️ [MEMORY] Could not update contextual memory after search:', memErr);
      }

      // 5. Save response with structured data
      console.log('📤 [MESSAGE FLOW] Step 13: About to save assistant message (Supabase INSERT)');

      await addMessageViaSupabase({
        conversation_id: selectedConversation,
        role: 'assistant' as const,
        content: { text: assistantResponse },
        meta: structuredData ? {
          source: 'AI_PARSER + EUROVIPS',
          ...structuredData
        } : {}
      });

      console.log('✅ [MESSAGE FLOW] Step 14: Assistant message saved successfully');

      // Force refresh messages after assistant response (immediate + delayed)
      console.log('🔄 [MESSAGE FLOW] Step 14.5: Force refreshing messages after assistant response');
      refreshMessages(); // Immediate refresh
      setTimeout(() => refreshMessages(), 500); // Quick fallback
      setTimeout(() => refreshMessages(), 1500); // Extended fallback

      // 6. Lead generation disabled - Only manual creation via button
      console.log('📋 [MESSAGE FLOW] Step 15: Automatic lead generation disabled - only manual creation available');

      console.log('🎉 [MESSAGE FLOW] Message processing completed successfully');

    } catch (error) {
      console.error('❌ [MESSAGE FLOW] Error in handleSendMessage process:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 [MESSAGE FLOW] Cleaning up - setting loading states to false');
      setIsLoading(false);
      setIsTyping(false);
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
    getContextFromLastFlights
  ]);

  return {
    handleSendMessage
  };
};

export default useMessageHandler;