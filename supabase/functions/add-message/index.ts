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

    // Prepare message data - use custom ID if provided
    const messageData = {
      conversation_id: conversationId,
      role: role,
      content: content,
      meta: meta || {},
      created_at: new Date().toISOString()
    };

    // Add custom ID if provided (for optimistic UI)
    if (id) {
      messageData.id = id;
      console.log('🎯 [ADD-MESSAGE] Using provided ID for optimistic UI:', id);
    }

    // ✅ Insert message into database (RLS validates permissions automatically)
    const { data, error } = await supabase.from('messages').insert(messageData).select().single();
    if (error) {
      console.error('❌ [ADD-MESSAGE] Error inserting message (likely RLS denied):', error);
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
    console.log('✅ [ADD-MESSAGE] Message inserted successfully:', data.id);
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
