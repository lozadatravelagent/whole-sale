import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    if (!messages) {
      throw new Error('Messages are required');
    }

    console.log(`Extracting travel info from: ${messages}`);

    const systemPrompt = `Eres un experto en extraer información estructurada de conversaciones sobre viajes. Tu tarea es analizar mensajes de chat y extraer información relevante para crear un lead de CRM.

Extrae la siguiente información del texto y devuélvela en formato JSON:

{
  "destination": "nombre de la ciudad/destino mencionado",
  "dates": {
    "checkin": "fecha de entrada en formato YYYY-MM-DD si se menciona",
    "checkout": "fecha de salida en formato YYYY-MM-DD si se menciona"
  },
  "travelers": {
    "adults": número de adultos,
    "children": número de niños
  },
  "budget": presupuesto mencionado en números,
  "tripType": "hotel", "flight", o "package" según lo que se infiera,
  "contactInfo": {
    "name": "nombre si se menciona",
    "phone": "teléfono si se menciona", 
    "email": "email si se menciona"
  },
  "description": "resumen breve de lo que quiere el cliente"
}

Si no encuentras información específica, omite ese campo o usa valores por defecto lógicos.

Ejemplos de fechas: "15 de enero" -> "2024-01-15", "marzo 2024" -> buscar fechas razonables en marzo.
Para presupuesto: busca números seguidos de "USD", "dólares", "$", etc.
Para personas: "somos 4", "2 adultos", "familia de 5", etc.`;

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extrae información de este texto: "${messages}"` }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const aiResponse = openAIData.choices[0].message.content;

    console.log('AI response:', aiResponse);

    // Intentar parsear la respuesta JSON
    let travelInfo = {};
    try {
      travelInfo = JSON.parse(aiResponse);
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using fallback');
      // Si no se puede parsear, crear un objeto básico
      travelInfo = {
        description: messages.length > 200 ? messages.substring(0, 200) + '...' : messages,
        tripType: 'package'
      };
    }

    console.log('Extracted travel info:', travelInfo);

    return new Response(JSON.stringify({ 
      travelInfo
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-travel-info function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      travelInfo: {}
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});