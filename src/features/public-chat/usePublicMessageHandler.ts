import { useState, useCallback, useRef } from 'react';
import { parseMessageWithAI, combineWithPreviousRequest } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import {
  handleFlightSearch,
  handleHotelSearch,
  handleCombinedSearch,
  handlePackageSearch,
  handleServiceSearch,
  handleItineraryRequest,
  handleGeneralQuery,
} from '@/features/chat/services/searchHandlers';
import {
  validateFlightRequiredFields,
  validateHotelRequiredFields,
  validateItineraryRequiredFields,
  generateMissingInfoMessage,
} from '@/services/aiMessageParser';

export interface PublicMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const SEARCH_TYPES = new Set(['flights', 'hotels', 'combined', 'packages', 'services', 'itinerary']);

export function usePublicMessageHandler() {
  const [messages, setMessages] = useState<PublicMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola, soy **Emilia**, tu asistente de viajes con IA. Contame que viaje buscas y te ayudo a encontrar las mejores opciones.\n\nPuedo buscar **vuelos**, **hoteles**, **paquetes** y mas.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const previousContext = useRef<ParsedTravelRequest | null>(null);
  const messageIdCounter = useRef(1);

  const buildConversationHistory = useCallback(() => {
    return messages
      .filter(m => m.id !== 'welcome')
      .slice(-10) // Keep last 10 messages for context
      .map(m => ({
        role: m.role,
        content: m.text,
        timestamp: m.timestamp,
      }));
  }, [messages]);

  const addMessage = useCallback((role: 'user' | 'assistant', text: string): PublicMessage => {
    const msg: PublicMessage = {
      id: `msg-${Date.now()}-${messageIdCounter.current++}`,
      role,
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      options: {
        canSearch: boolean;
        incrementSearch: () => void;
        onLimitReached: () => void;
      }
    ) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;

      setIsProcessing(true);
      addMessage('user', trimmed);

      try {
        // Parse the message with AI
        const conversationHistory = buildConversationHistory();
        let parsed = await parseMessageWithAI(trimmed, previousContext.current, conversationHistory);

        // Combine with previous context for follow-up questions
        if (previousContext.current) {
          parsed = combineWithPreviousRequest(previousContext.current, trimmed, parsed);
        }

        const isSearchIntent = SEARCH_TYPES.has(parsed.requestType);

        // Check limit before executing search
        if (isSearchIntent && !options.canSearch) {
          options.onLimitReached();
          setIsProcessing(false);
          return;
        }

        // Validate required fields for search types
        if (parsed.requestType === 'flights' || parsed.requestType === 'combined') {
          const validation = validateFlightRequiredFields(parsed.flights);
          if (!validation.isValid) {
            if (validation.errorMessage) {
              addMessage('assistant', validation.errorMessage);
            } else {
              addMessage('assistant', generateMissingInfoMessage(validation.missingFieldsSpanish, 'flights'));
            }
            previousContext.current = parsed;
            setIsProcessing(false);
            return;
          }
        }

        if (parsed.requestType === 'hotels' || parsed.requestType === 'combined') {
          const validation = validateHotelRequiredFields(parsed.hotels);
          if (!validation.isValid) {
            if (validation.errorMessage) {
              addMessage('assistant', validation.errorMessage);
            } else {
              addMessage('assistant', generateMissingInfoMessage(validation.missingFieldsSpanish, 'hotels'));
            }
            previousContext.current = parsed;
            setIsProcessing(false);
            return;
          }
        }

        if (parsed.requestType === 'itinerary') {
          const validation = validateItineraryRequiredFields(parsed.itinerary);
          if (!validation.isValid) {
            addMessage('assistant', generateMissingInfoMessage(validation.missingFieldsSpanish, 'itinerary'));
            previousContext.current = parsed;
            setIsProcessing(false);
            return;
          }
        }

        // Route to appropriate handler
        let responseText: string;

        switch (parsed.requestType) {
          case 'flights': {
            const result = await handleFlightSearch(parsed);
            responseText = result.response;
            break;
          }
          case 'hotels': {
            const result = await handleHotelSearch(parsed);
            responseText = result.response;
            break;
          }
          case 'combined': {
            const result = await handleCombinedSearch(parsed);
            responseText = result.response;
            break;
          }
          case 'packages': {
            const result = await handlePackageSearch(parsed);
            responseText = result.response;
            break;
          }
          case 'services': {
            const result = await handleServiceSearch(parsed);
            responseText = result.response;
            break;
          }
          case 'itinerary': {
            const result = await handleItineraryRequest(parsed);
            responseText = result.response;
            break;
          }
          case 'missing_info_request': {
            responseText = parsed.message || 'Necesito mas informacion para ayudarte. ¿Podrias darme mas detalles?';
            previousContext.current = parsed;
            setIsProcessing(false);
            addMessage('assistant', responseText);
            return; // Don't count as search
          }
          case 'general':
          default: {
            responseText = await handleGeneralQuery(parsed);
            setIsProcessing(false);
            addMessage('assistant', responseText);
            return; // Don't count as search
          }
        }

        // Only increment search counter after successful search execution
        if (isSearchIntent) {
          options.incrementSearch();
        }

        previousContext.current = parsed;
        addMessage('assistant', responseText);
      } catch (error) {
        console.error('[PublicChat] Error processing message:', error);
        addMessage(
          'assistant',
          'Lo siento, hubo un error procesando tu consulta. Por favor, intenta nuevamente.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, addMessage, buildConversationHistory]
  );

  return { messages, isProcessing, sendMessage };
}
