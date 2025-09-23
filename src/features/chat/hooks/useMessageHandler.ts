import { useCallback } from 'react';
import { parseMessageWithAI, combineWithPreviousRequest, validateFlightRequiredFields, validateHotelRequiredFields, generateMissingInfoMessage } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { handleFlightSearch, handleHotelSearch, handleCombinedSearch, handlePackageSearch, handleServiceSearch, handleGeneralQuery } from '../services/searchHandlers';
import { addMessageViaSupabase } from '../services/messageService';
import { generateChatTitle } from '../utils/messageHelpers';
import { isAddHotelRequest, isCheaperFlightRequest, isPriceChangeRequest } from '../utils/intentDetection';
import type { MessageRow } from '../types/chat';
import { useMessages } from '@/hooks/useChat';

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
  const { messages } = useMessages(selectedConversation);

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
      const flightCtx = getContextFromLastFlights();
      if (flightCtx) {
        console.log('🏨 [INTENT] Add hotel detected, reusing flight context for combined search');
        setIsLoading(true);
        try {
          // Persist a synthetic combined request and run combined search directly
          const combinedParsed: ParsedTravelRequest = {
            requestType: 'combined',
            flights: {
              origin: flightCtx.origin,
              destination: flightCtx.destination,
              departureDate: flightCtx.departureDate,
              returnDate: flightCtx.returnDate,
              adults: flightCtx.adults,
              children: flightCtx.children,
              luggage: 'checked',
              stops: 'any'
            },
            hotels: {
              city: flightCtx.destination,
              checkinDate: flightCtx.departureDate,
              checkoutDate: flightCtx.returnDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
              adults: flightCtx.adults,
              children: flightCtx.children,
              roomType: 'double',
              mealPlan: 'breakfast'
            },
            confidence: 0.9,
            originalMessage: currentMessage
          } as any;

          // Save minimal context for later refinement
          setPreviousParsedRequest(combinedParsed);
          await saveContextualMemory(selectedConversation, combinedParsed);

          // Run combined search (will ask only missing hotel details later if needed)
          const combinedResult = await handleCombinedSearch(combinedParsed);

          await addMessageViaSupabase({
            conversation_id: selectedConversation,
            role: 'assistant' as const,
            content: { text: combinedResult.response },
            meta: combinedResult.data ? { ...combinedResult.data } : {}
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
      console.log('🔍 [DEBUG] Context loaded from DB:', contextFromDB);

      const contextToUse = contextFromDB || previousParsedRequest;
      console.log('📝 [CONTEXT] Final context to use:', contextToUse);

      // 4. Use AI Parser to classify request
      console.log('🤖 [MESSAGE FLOW] Step 8: Starting AI parsing process');
      console.log('📤 [MESSAGE FLOW] About to call AI message parser (Supabase Edge Function)');
      console.log('🧠 Message to parse:', currentMessage);

      let parsedRequest = await parseMessageWithAI(currentMessage, contextToUse);

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
      const lowerMsg = currentMessage.toLowerCase();
      const impliesHotel = /\bhotel|alojamiento|noche|noches\b/.test(lowerMsg);
      const impliesFlight = /\bvuelo|vuelos\b/.test(lowerMsg);
      if (impliesHotel && impliesFlight && parsedRequest.requestType !== 'combined') {
        console.log('🔀 [INTENT] Coercing requestType to combined based on message keywords');
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
        // Clear previous request since we have all required fields
        setPreviousParsedRequest(null);
        await clearContextualMemory(selectedConversation);
      } else if (parsedRequest.requestType === 'hotels') {
        console.log('🏨 [VALIDATION] Validating hotel required fields');
        const validation = validateHotelRequiredFields(parsedRequest.hotels);

        console.log('📋 [VALIDATION] Hotel validation result:', {
          isValid: validation.isValid,
          missingFields: validation.missingFields,
          missingFieldsSpanish: validation.missingFieldsSpanish
        });

        if (!validation.isValid) {
          console.log('⚠️ [VALIDATION] Missing hotel required fields, requesting more info');

          // Store the current parsed request for future combination
          setPreviousParsedRequest(parsedRequest);
          await saveContextualMemory(selectedConversation, parsedRequest);

          // Generate message asking for missing information
          const missingInfoMessage = generateMissingInfoMessage(
            validation.missingFieldsSpanish,
            parsedRequest.requestType
          );

          console.log('💬 [VALIDATION] Generated missing hotel info message');

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

          console.log('✅ [VALIDATION] Missing hotel info message sent, stopping process');
          return; // Stop processing here, wait for user response
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
          console.log('🌟 [MESSAGE FLOW] Step 12f: Processing combined search');
          const combinedResult = await handleCombinedSearch(parsedRequest);
          assistantResponse = combinedResult.response;
          structuredData = combinedResult.data;
          console.log('✅ [MESSAGE FLOW] Combined search completed');
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