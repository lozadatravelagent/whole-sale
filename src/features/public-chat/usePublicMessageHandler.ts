import { useState, useCallback, useRef } from 'react';
import i18n from '@/i18n';
import { parseMessageWithAI, combineWithPreviousRequest, detectMessageLanguage, normalizeSupportedLanguage } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { getPublicChatCopy, type UserLanguage } from '@/features/chat/i18n/chatResultCopy';
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
import type { LocalCombinedTravelResults } from '@/types/external';

export interface PublicMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  data?: { combinedData?: LocalCombinedTravelResults; responseLanguage?: UserLanguage };
}

const SEARCH_TYPES = new Set(['flights', 'hotels', 'combined', 'packages', 'services', 'itinerary']);

export function usePublicMessageHandler() {
  const initialLanguage = normalizeSupportedLanguage(i18n.language);
  const [messages, setMessages] = useState<PublicMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: getPublicChatCopy(initialLanguage).welcome,
      timestamp: new Date().toISOString(),
      data: { responseLanguage: initialLanguage },
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

  const addMessage = useCallback((role: 'user' | 'assistant', text: string, data?: PublicMessage['data']): PublicMessage => {
    const msg: PublicMessage = {
      id: `msg-${Date.now()}-${messageIdCounter.current++}`,
      role,
      text,
      timestamp: new Date().toISOString(),
      ...(data ? { data } : {}),
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
        const userLanguage = detectMessageLanguage(trimmed, normalizeSupportedLanguage(i18n.language));
        let parsed = await parseMessageWithAI(trimmed, previousContext.current, conversationHistory, undefined, userLanguage);
        parsed.responseLanguage = userLanguage;

        // Combine with previous context for follow-up questions
        if (previousContext.current) {
          parsed = combineWithPreviousRequest(previousContext.current, trimmed, parsed);
        }
        parsed.responseLanguage = userLanguage;

        const isSearchIntent = SEARCH_TYPES.has(parsed.requestType);

        // Check limit before executing search
        if (isSearchIntent && !options.canSearch) {
          options.onLimitReached();
          setIsProcessing(false);
          return;
        }

        // Validate required fields for search types
        const publicCopy = getPublicChatCopy(userLanguage);

        if (parsed.requestType === 'flights' || parsed.requestType === 'combined') {
          const validation = validateFlightRequiredFields(parsed.flights, userLanguage);
          if (!validation.isValid) {
            if (validation.errorMessage) {
              addMessage('assistant', validation.errorMessage);
            } else {
              addMessage('assistant', generateMissingInfoMessage(validation.missingFieldsSpanish, 'flights', undefined, userLanguage));
            }
            previousContext.current = parsed;
            setIsProcessing(false);
            return;
          }
        }

        if (parsed.requestType === 'hotels' || parsed.requestType === 'combined') {
          const validation = validateHotelRequiredFields(parsed.hotels, userLanguage);
          if (!validation.isValid) {
            if (validation.errorMessage) {
              addMessage('assistant', validation.errorMessage);
            } else {
              addMessage('assistant', generateMissingInfoMessage(validation.missingFieldsSpanish, 'hotels', undefined, userLanguage));
            }
            previousContext.current = parsed;
            setIsProcessing(false);
            return;
          }
        }

        if (parsed.requestType === 'itinerary') {
          const validation = validateItineraryRequiredFields(parsed.itinerary);
          if (!validation.isValid) {
            addMessage('assistant', generateMissingInfoMessage(validation.missingFieldsSpanish, 'itinerary', {
              itinerary: parsed.itinerary,
              originalMessage: parsed.originalMessage,
            }, userLanguage));
            previousContext.current = parsed;
            setIsProcessing(false);
            return;
          }
        }

        // Route to appropriate handler
        let responseText: string;
        let resultData: PublicMessage['data'] | undefined;

        switch (parsed.requestType) {
          case 'flights': {
            const result = await handleFlightSearch(parsed);
            responseText = result.response;
            resultData = result.data?.combinedData ? { combinedData: result.data.combinedData, responseLanguage: userLanguage } : undefined;
            break;
          }
          case 'hotels': {
            const result = await handleHotelSearch(parsed);
            responseText = result.response;
            resultData = result.data?.combinedData ? { combinedData: result.data.combinedData, responseLanguage: userLanguage } : undefined;
            break;
          }
          case 'combined': {
            const result = await handleCombinedSearch(parsed);
            responseText = result.response;
            resultData = result.data?.combinedData ? { combinedData: result.data.combinedData, responseLanguage: userLanguage } : undefined;
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
            responseText = parsed.message || publicCopy.missingInfoFallback;
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
        addMessage('assistant', responseText, resultData);
      } catch (error) {
        console.error('[PublicChat] Error processing message:', error);
        addMessage(
          'assistant',
          getPublicChatCopy(normalizeSupportedLanguage(i18n.language)).processingError
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, addMessage, buildConversationHistory]
  );

  return { messages, isProcessing, sendMessage };
}
