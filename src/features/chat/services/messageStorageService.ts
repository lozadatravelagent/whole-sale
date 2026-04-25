import { supabase } from '@/integrations/supabase/client';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ContextState } from '../types/contextState';
import { isValidContextState } from '../types/contextState';

export async function loadContextualMemory(conversationId: string): Promise<ParsedTravelRequest | null> {
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
}

export async function saveContextualMemory(conversationId: string, parsedRequest: ParsedTravelRequest): Promise<void> {
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
}

export async function clearContextualMemory(conversationId: string): Promise<void> {
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
}

export async function loadContextState(conversationId: string): Promise<ContextState | null> {
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

    // Validate the loaded state has the correct structure
    if (state && isValidContextState(state)) {
      console.log('✅ [STATE] Loaded valid context state:', {
        requestType: state.lastSearch?.requestType,
        hasFlights: !!state.lastSearch?.flightsParams,
        hasHotels: !!state.lastSearch?.hotelsParams,
        turnNumber: state.turnNumber
      });
      return state;
    }

    // Handle legacy state format (old format without lastSearch structure)
    if (state && (state.flights || state.hotels)) {
      console.log('🔄 [STATE] Converting legacy state format to new ContextState');
      const legacyState: ContextState = {
        lastSearch: {
          requestType: state.flights && state.hotels ? 'combined' : (state.flights ? 'flights' : 'hotels'),
          timestamp: state.timestamp || new Date().toISOString(),
          flightsParams: state.flights,
          hotelsParams: state.hotels
        },
        constraintsHistory: [],
        turnNumber: 1,
        schemaVersion: 1
      };
      return legacyState;
    }

    console.log('ℹ️ [STATE] No valid context state found');
    return null;
  } catch (error) {
    console.error('❌ [STATE] Error in loadContextState:', error);
    return null;
  }
}

export async function saveContextState(conversationId: string, contextState: ContextState): Promise<void> {
  try {
    console.log('💾 [STATE] Saving context state for conversation:', conversationId);
    console.log('💾 [STATE] State to save:', {
      requestType: contextState.lastSearch?.requestType,
      hasFlights: !!contextState.lastSearch?.flightsParams,
      hasHotels: !!contextState.lastSearch?.hotelsParams,
      turnNumber: contextState.turnNumber
    });

    // Delete previous context_state messages to avoid duplicates
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('role', 'system')
      .contains('meta', { messageType: 'context_state' });

    if (deleteError) {
      console.warn('⚠️ [STATE] Error deleting old context state:', deleteError);
      // Continue anyway - we'll insert the new one
    }

    // Insert new context state
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
      console.log('✅ [STATE] Context state saved successfully');
    }
  } catch (error) {
    console.error('❌ [STATE] Error in saveContextState:', error);
  }
}
