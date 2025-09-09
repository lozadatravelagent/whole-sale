import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS universal
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Body esperado: { message: string, conversationId?: string }
    const { message, conversationId } = await req.json();
    if (!message) {
      throw new Error('Message is required');
    }

    console.log(`Processing travel chat request: ${message}`);

    // URL del webhook de n8n (definida como secret N8N_WEBHOOK_URL)
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      throw new Error('N8N webhook URL not configured');
    }

    // Enviar al webhook
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationId: conversationId ?? null,
        timestamp: new Date().toISOString(),
        source: 'wholesale-connect-chat',
      }),
    });

    if (!n8nResponse.ok) {
      const text = await n8nResponse.text();
      console.error('N8N webhook error:', text);
      throw new Error(`N8N webhook error: ${n8nResponse.status}`);
    }

    const n8nData = await n8nResponse.json();
    const aiResponse = n8nData.response || n8nData.message || 'Lo siento, no pude procesar tu mensaje.';

    console.log('Generated AI response successfully');

    return new Response(
      JSON.stringify({ message: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in travel-chat function:', error);
    return new Response(
      JSON.stringify({ error: error.message, message: 'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});