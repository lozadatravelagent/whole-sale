import { supabase } from '@/integrations/supabase/client';
import { createDebugTimer, nowMs, logTimingStep } from '@/utils/debugTiming';

/**
 * Direct INSERT to `messages` (replaces the previous `add-message` edge
 * function wrapper). RLS policies on the table validate agency access via
 * the user's JWT — no edge function needed for that.
 *
 * Why this is faster:
 *   Before: client → edge function (cold start + JWT verify + SELECT idempotency
 *           + INSERT + UPDATE last_message_at) ≈ 1.2-1.9s per call.
 *   After:  client → REST INSERT (RLS validates) ≈ 200-500ms per call,
 *           plus a fire-and-forget UPDATE of last_message_at in parallel.
 *
 * Idempotency: the UNIQUE partial index on (conversation_id, client_id)
 * (migration 20251028000001) handles duplicates at the DB level. On a
 * UNIQUE violation (Postgres error 23505), we re-fetch and return the
 * existing row — same contract as the previous edge function.
 *
 * The edge function `supabase/functions/add-message/index.ts` is kept
 * deployed as a rollback path (revert this client change if needed).
 */
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
  console.log('📤 [DIRECT INSERT] Inserting message via Supabase REST');
  console.log('📋 Message data:', messageData);
  console.log('🔑 [IDEMPOTENCY] client_id:', messageData.meta?.client_id);

  try {
    // Quick session check — ensures the supabase client has a valid JWT
    // attached for RLS. We don't need to extract the token (the client
    // includes it automatically on every PostgREST call).
    const sessionStart = nowMs();
    const { data: { session } } = await supabase.auth.getSession();
    logTimingStep('ADD MESSAGE', 'getSession', sessionStart, {
      hasSession: Boolean(session),
    });

    if (!session) {
      throw new Error('No active session - please log in again');
    }

    const clientId = messageData.meta?.client_id ?? null;
    const createdAt = new Date().toISOString();
    const insertRow = {
      conversation_id: messageData.conversation_id,
      role: messageData.role,
      content: messageData.content,
      meta: messageData.meta ?? {},
      // Direct column for the UNIQUE idempotency index — also kept inside
      // meta by callers for backward-compat with consumers that read it
      // from there.
      client_id: clientId,
      created_at: createdAt,
    };

    const insertStart = nowMs();
    let { data, error } = await supabase
      .from('messages')
      .insert(insertRow)
      .select()
      .maybeSingle();
    logTimingStep('ADD MESSAGE', 'insert messages', insertStart, {
      hasError: Boolean(error),
      role: messageData.role,
    });

    // Idempotency path: UNIQUE violation on (conversation_id, client_id)
    // means another concurrent request already inserted this message.
    // Re-fetch and return the existing row.
    if (error && error.code === '23505' && clientId) {
      console.log('🔒 [IDEMPOTENCY] Duplicate via UNIQUE — fetching existing message');
      const { data: existing } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', messageData.conversation_id)
        .eq('client_id', clientId)
        .maybeSingle();
      if (existing) {
        data = existing;
        error = null;
      }
    }

    if (error || !data) {
      const failure = error ?? new Error('INSERT returned no row');
      console.error('❌ [DIRECT INSERT] Failed to insert message:', failure);
      throw failure;
    }

    // Fire-and-forget UPDATE of conversations.last_message_at. Used by the
    // sidebar via Realtime to show the most recent activity. We do NOT
    // await it: the assistant message UI does not depend on this row.
    void supabase
      .from('conversations')
      .update({ last_message_at: createdAt })
      .eq('id', messageData.conversation_id)
      .then((res) => {
        if (res.error) {
          console.warn('⚠️ [DIRECT INSERT] last_message_at update failed:', res.error);
        }
      });

    console.log('✅ [DIRECT INSERT] Message inserted:', data.id);
    timer.end('total', {
      messageId: data.id,
      role: messageData.role,
    });
    return data;
  } catch (error) {
    timer.fail('failed', error, {
      conversationId: messageData.conversation_id,
      role: messageData.role,
    });
    console.error('❌ [DIRECT INSERT] addMessageViaSupabase failed:', error);
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
