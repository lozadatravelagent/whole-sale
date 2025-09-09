import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { conversationId, role, content, meta } = await req.json()

    // Validate required parameters
    if (!conversationId || !role || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: conversationId, role, content' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Insert message into database
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: role,
        content: content,
        meta: meta || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting message:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to insert message', details: error }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Message inserted successfully:', data)

    // Update conversation last_message_at timestamp
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: data,
        info: 'Message added successfully and will appear in real-time'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in add-message function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})