import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // ✅ Get authorization header (JWT token)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ [ADD-MESSAGE] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔑 [ADD-MESSAGE] Auth header received:', authHeader.substring(0, 20) + '...');

    const { id, conversationId, role, content, meta } = await req.json();
    console.log('🆔 [ADD-MESSAGE] Received custom ID:', id);
    console.log('🔑 [IDEMPOTENCY] client_id:', meta?.client_id);
    console.log('📋 [TRACE] conversation_id:', conversationId, 'role:', role);

    // Validate required parameters
    if (!conversationId || !role || !content) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: conversationId, role, content'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ✅ Validate client_id for idempotency (REQUIRED for new messages)
    if (!meta?.client_id) {
      console.warn('⚠️ [ADD-MESSAGE] Missing client_id - idempotency not guaranteed');
      // TODO: Make this a hard error after migration period
      // return new Response(JSON.stringify({
      //   error: 'Missing client_id for idempotency'
      // }), {
      //   status: 400,
      //   headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      // });
    }

    // Create Supabase client with user's JWT (respects RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Create admin client to verify JWT
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ✅ Validate JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ [ADD-MESSAGE] Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 [ADD-MESSAGE] Authenticated user:', user.id);

    // Create user-scoped client for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          authorization: authHeader
        }
      },
      auth: {
        persistSession: false
      }
    });

    // ✅ Validate conversation access (RLS will handle this automatically)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, agency_id, tenant_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('❌ [ADD-MESSAGE] Conversation not found or access denied:', convError);
      return new Response(
        JSON.stringify({
          error: 'Conversation not found or access denied',
          details: convError?.message
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [ADD-MESSAGE] User has access to conversation:', conversationId);

    // ✅ STEP 1: Check for existing message with same client_id (idempotency)
    // Check both the client_id column (primary) and meta->>client_id (fallback for legacy)
    if (meta?.client_id) {
      console.log('🔍 [IDEMPOTENCY] Checking for existing message with client_id:', meta.client_id);
      const { data: existingMessage, error: checkError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('client_id', meta.client_id) // Check direct column first (faster, uses index)
        .maybeSingle();

      if (existingMessage) {
        console.log('✅ [IDEMPOTENCY] Message already exists, returning existing:', existingMessage.id);
        return new Response(JSON.stringify({
          success: true,
          message: existingMessage,
          info: 'Message already exists (idempotent request)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (checkError) {
        console.warn('⚠️ [IDEMPOTENCY] Error checking existing message:', checkError.message);
        // Continue with insert anyway
      }
    }

    // Prepare message data - use custom ID if provided
    const messageData: any = {
      conversation_id: conversationId,
      role: role,
      content: content,
      meta: meta || {},
      created_at: new Date().toISOString()
    };

    // ✅ Extract client_id from meta and save as direct column (for idempotency constraint)
    if (meta?.client_id) {
      messageData.client_id = meta.client_id;
      // Keep client_id in meta as well for backwards compatibility and easier queries
      if (!messageData.meta.client_id) {
        messageData.meta.client_id = meta.client_id;
      }
    }

    // Add custom ID if provided (for optimistic UI)
    if (id) {
      messageData.id = id;
      console.log('🎯 [ADD-MESSAGE] Using provided ID for optimistic UI:', id);
    }

    console.log('💾 [INSERT] Attempting to insert message with client_id:', meta?.client_id);

    // ✅ Insert message into database with ON CONFLICT handling
    // After migration 20251028000001_add_client_id_idempotency.sql is applied,
    // this will use the UNIQUE constraint on (conversation_id, client_id)
    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .maybeSingle(); // Use maybeSingle() to handle ON CONFLICT DO NOTHING (returns null if duplicate)

    // ✅ Handle duplicate detection (ON CONFLICT returned null)
    if (!error && !data && meta?.client_id) {
      console.log('🔒 [ON CONFLICT] Duplicate detected via UNIQUE constraint, fetching existing message');

      // Fetch the existing message with this client_id (check direct column)
      const { data: existingMessage, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('client_id', meta.client_id) // Use direct column (uses index)
        .single();

      if (existingMessage) {
        console.log('✅ [IDEMPOTENCY] Returning existing message:', existingMessage.id);
        return new Response(JSON.stringify({
          success: true,
          message: existingMessage,
          info: 'Duplicate message prevented via ON CONFLICT (idempotent request)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If we can't fetch the existing message, log error but don't fail
      console.error('⚠️ [ON CONFLICT] Could not fetch existing message:', fetchError);
    }

    if (error) {
      console.error('❌ [ADD-MESSAGE] Error inserting message (likely RLS denied):', error);

      // Check if error is unique constraint violation (23505)
      if (error.code === '23505' && meta?.client_id) {
        console.log('🔒 [UNIQUE VIOLATION] Duplicate detected, fetching existing message');

        // Fetch the existing message (check direct column)
        const { data: existingMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('client_id', meta.client_id) // Use direct column (uses index)
          .single();

        if (existingMessage) {
          return new Response(JSON.stringify({
            success: true,
            message: existingMessage,
            info: 'Duplicate message prevented via UNIQUE constraint'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({
        error: 'Failed to insert message - Access denied or invalid data',
        details: error.message
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ [ADD-MESSAGE] Message inserted successfully:', data?.id);
    console.log('🔑 [TRACE] Final message - id:', data?.id, 'client_id:', meta?.client_id);
    // Update conversation last_message_at timestamp
    await supabase.from('conversations').update({
      last_message_at: new Date().toISOString()
    }).eq('id', conversationId);
    return new Response(JSON.stringify({
      success: true,
      message: data,
      info: 'Message added successfully and will appear in real-time'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in add-message function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
