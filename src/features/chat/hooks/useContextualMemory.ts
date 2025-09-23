import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

const useContextualMemory = () => {
  // Load contextual memory from database when conversation changes
  const loadContextualMemory = useCallback(async (conversationId: string) => {
    try {
      console.log('🧠 [MEMORY] Loading contextual memory for conversation:', conversationId);

      // Look for the most recent contextual memory message OR missing info request
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .or('meta->>messageType.eq.contextual_memory,meta->>messageType.eq.missing_info_request')
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('🔍 [MEMORY DEBUG] Query result:', { messages, error });

      if (error) {
        console.error('❌ [MEMORY] Error loading contextual memory:', error);
        return null;
      }

      if (messages && messages.length > 0) {
        const message = messages[0];
        console.log('🔍 [MEMORY DEBUG] Found message:', message);
        const meta = message.meta as any;
        console.log('🔍 [MEMORY DEBUG] Message meta:', meta);
        const parsedRequest = meta?.parsedRequest || meta?.originalRequest;
        console.log('🔍 [MEMORY DEBUG] Extracted parsed request:', parsedRequest);

        if (parsedRequest) {
          console.log('✅ [MEMORY] Found previous incomplete request:', parsedRequest);
          return parsedRequest;
        }
      }

      console.log('ℹ️ [MEMORY] No previous incomplete request found');
      return null;
    } catch (error) {
      console.error('❌ [MEMORY] Error in loadContextualMemory:', error);
      return null;
    }
  }, []);

  // Save contextual memory to database
  const saveContextualMemory = useCallback(async (conversationId: string, parsedRequest: ParsedTravelRequest) => {
    try {
      console.log('💾 [MEMORY] Saving contextual memory for conversation:', conversationId);

      // Store as a special system message for contextual memory WITHOUT visible content
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'system',
          content: { text: '' }, // empty content to avoid visible noise
          meta: {
            messageType: 'contextual_memory',
            parsedRequest: JSON.parse(JSON.stringify(parsedRequest)),
            timestamp: new Date().toISOString()
          }
        });

      if (error) {
        console.error('❌ [MEMORY] Error saving contextual memory:', error);
      } else {
        console.log('✅ [MEMORY] Contextual memory saved successfully');
      }
    } catch (error) {
      console.error('❌ [MEMORY] Error in saveContextualMemory:', error);
    }
  }, []);

  // Clear contextual memory
  const clearContextualMemory = useCallback(async (conversationId: string) => {
    try {
      console.log('🗑️ [MEMORY] Clearing contextual memory for conversation:', conversationId);

      // Delete all contextual memory messages for this conversation
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('role', 'system')
        .contains('meta', { messageType: 'contextual_memory' });

      if (error) {
        console.error('❌ [MEMORY] Error clearing contextual memory:', error);
      } else {
        console.log('✅ [MEMORY] Contextual memory cleared successfully');
      }
    } catch (error) {
      console.error('❌ [MEMORY] Error in clearContextualMemory:', error);
    }
  }, []);

  // Load persistent context state (parameters that persist across turns)
  const loadContextState = useCallback(async (conversationId: string) => {
    try {
      console.log('🧠 [STATE] Loading context state for conversation:', conversationId);
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('role', 'system')
        .contains('meta', { messageType: 'context_state' })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ [STATE] Error loading context state:', error);
        return null;
      }

      const meta: any = messages?.[0]?.meta as any;
      const state = meta && typeof meta === 'object' && 'contextState' in meta ? (meta as any).contextState : null;
      console.log('✅ [STATE] Loaded context state:', state);
      return state;
    } catch (error) {
      console.error('❌ [STATE] Error in loadContextState:', error);
      return null;
    }
  }, []);

  // Save persistent context state
  const saveContextState = useCallback(async (conversationId: string, contextState: any) => {
    try {
      console.log('💾 [STATE] Saving context state for conversation:', conversationId, contextState);
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'system',
          content: { text: '' },
          meta: {
            messageType: 'context_state',
            contextState,
            timestamp: new Date().toISOString()
          }
        });
      if (error) {
        console.error('❌ [STATE] Error saving context state:', error);
      } else {
        console.log('✅ [STATE] Context state saved');
      }
    } catch (error) {
      console.error('❌ [STATE] Error in saveContextState:', error);
    }
  }, []);

  return {
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    loadContextState,
    saveContextState
  };
};

export default useContextualMemory;