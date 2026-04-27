import { useCallback } from 'react';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ContextState } from '../types/contextState';
import type { ConversationSummary } from '../types/knowledge';
import * as messageStorage from '../services/messageStorageService';

const useContextualMemory = () => {
  const loadContextualMemory = useCallback(
    (conversationId: string) => messageStorage.loadContextualMemory(conversationId),
    []
  );

  const saveContextualMemory = useCallback(
    (conversationId: string, parsedRequest: ParsedTravelRequest) => messageStorage.saveContextualMemory(conversationId, parsedRequest),
    []
  );

  const clearContextualMemory = useCallback(
    (conversationId: string) => messageStorage.clearContextualMemory(conversationId),
    []
  );

  const loadContextState = useCallback(
    (conversationId: string): Promise<ContextState | null> => messageStorage.loadContextState(conversationId),
    []
  );

  const saveContextState = useCallback(
    (conversationId: string, contextState: ContextState) => messageStorage.saveContextState(conversationId, contextState),
    []
  );

  const loadConversationSummary = useCallback(
    (conversationId: string): Promise<ConversationSummary | null> => messageStorage.loadConversationSummary(conversationId),
    []
  );

  const saveConversationSummary = useCallback(
    (conversationId: string, conversationSummary: ConversationSummary) => messageStorage.saveConversationSummary(conversationId, conversationSummary),
    []
  );

  return {
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    loadContextState,
    saveContextState,
    loadConversationSummary,
    saveConversationSummary
  };
};

export default useContextualMemory;
