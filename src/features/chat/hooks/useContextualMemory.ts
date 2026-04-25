import { useCallback } from 'react';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ContextState } from '../types/contextState';
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

  return {
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    loadContextState,
    saveContextState
  };
};

export default useContextualMemory;