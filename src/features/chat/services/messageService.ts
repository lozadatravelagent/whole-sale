import { supabase } from '@/integrations/supabase/client';
import { createDebugTimer, nowMs, logTimingStep } from '@/utils/debugTiming';

// Use Supabase add-message function instead of direct saveMessage
export const addMessageViaSupabase = async (messageData: {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: { text?: string; cards?: unknown[]; pdfUrl?: string; metadata?: Record<string, unknown>; };
  meta?: { status?: string; client_id?: string; [key: string]: unknown; };
}) => {
  const timer = createDebugTimer('ADD MESSAGE', {
    conversationId: messageData.conversation_id,
    role: messageData.role,
    hasClientId: Boolean(messageData.meta?.client_id),
  });
  console.log('📤 [SUPABASE FUNCTION] About to call add-message function');
  console.log('📋 Message data:', messageData);
  console.log('🔑 [IDEMPOTENCY] client_id:', messageData.meta?.client_id);

  try {
    // Get the current session to ensure we have a valid JWT
    const sessionStart = nowMs();
    const { data: { session } } = await supabase.auth.getSession();
    logTimingStep('ADD MESSAGE', 'getSession', sessionStart, {
      hasSession: Boolean(session),
    });

    if (!session) {
      throw new Error('No active session - please log in again');
    }

    console.log('✅ [AUTH] Session valid, calling function with JWT');

    const invokeStart = nowMs();
    const response = await supabase.functions.invoke('add-message', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        conversationId: messageData.conversation_id,
        role: messageData.role,
        content: messageData.content,
        meta: messageData.meta
      }
    });
    logTimingStep('ADD MESSAGE', 'invoke add-message', invokeStart, {
      hasError: Boolean(response.error),
      role: messageData.role,
    });

    if (response.error) {
      console.error('❌ [SUPABASE FUNCTION] add-message error:', response.error);
      throw response.error;
    }

    console.log('✅ [SUPABASE FUNCTION] add-message success:', response.data);
    timer.end('total', {
      messageId: response.data?.message?.id,
      role: messageData.role,
    });
    return response.data.message;
  } catch (error) {
    timer.fail('failed', error, {
      conversationId: messageData.conversation_id,
      role: messageData.role,
    });
    console.error('❌ [SUPABASE FUNCTION] add-message failed:', error);
    throw error;
  }
};

// ⚠️ DEPRECATED: Old city code service (slow WebService call)
// Use @/services/cityCodeMapping instead for instant O(1) lookup from local JSON
// This function is kept temporarily for reference but should not be used
/*
export const getCityCode = async (cityName: string): Promise<string> => {
  try {
    const response = await supabase.functions.invoke('eurovips-soap', {
      body: { action: 'getCountryList', data: {} }
    });

    const countries = response.data.results?.parsed || [];
    const city = countries.find((c: { name: string; code: string }) =>
      c.name.toLowerCase().includes(cityName.toLowerCase())
    );

    return city?.code || cityName;
  } catch (error) {
    console.error('Error getting city code:', error);
    return cityName;
  }
};
*/
