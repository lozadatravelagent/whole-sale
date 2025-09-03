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

    const systemPrompt = `Eres un experto extractor de información de viajes. Analiza el texto y extrae TODA la información relevante para crear un lead de CRM completo.

INSTRUCCIONES CRÍTICAS:
- Busca fechas en CUALQUIER formato (15 enero, enero 2024, 15/01, etc.)
- Identifica números de personas (adultos, niños, bebés)
- Encuentra presupuestos en cualquier moneda o formato
- Detecta destinos, ciudades, países
- Determina el tipo de servicio (vuelo, hotel, paquete)
- Extrae nombres, teléfonos, emails si aparecen

Devuelve SIEMPRE un JSON válido con esta estructura exacta:
{
  "destination": "ciudad/destino mencionado o null",
  "dates": {
    "checkin": "fecha inicio en formato YYYY-MM-DD o null",
    "checkout": "fecha fin en formato YYYY-MM-DD o null"
  },
  "travelers": {
    "adults": número de adultos o 1,
    "children": número de niños o 0
  },
  "budget": número del presupuesto o 0,
  "tripType": "flight", "hotel", o "package",
  "contactInfo": {
    "name": null,
    "phone": null,
    "email": null
  },
  "description": "resumen de la consulta"
}

EJEMPLOS:
- "Vuelo para 2 adultos y 1 niño a París del 15 enero al 20 enero, presupuesto 3000 USD"
- "Necesito hotel en Madrid para 4 personas con $2000 dólares"
- "Viaje familiar a Cancún en marzo con 2500 de presupuesto"

SÉ MUY CUIDADOSO: Siempre devuelve JSON válido, nunca texto adicional.`;

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
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `EXTRAE INFORMACIÓN DE: "${messages}"` }
        ],
        max_completion_tokens: 800,
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

    // Limpiar la respuesta y extraer solo el JSON
    let cleanResponse = aiResponse.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
    }
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Intentar parsear la respuesta JSON
    let travelInfo = {};
    try {
      travelInfo = JSON.parse(cleanResponse);
      console.log('Successfully parsed travel info:', travelInfo);
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON:', parseError);
      console.warn('Raw response was:', cleanResponse);
      
      // Fallback: crear objeto básico con información extraíble
      travelInfo = {
        description: messages.length > 200 ? messages.substring(0, 200) + '...' : messages,
        tripType: 'package',
        travelers: { adults: 1, children: 0 },
        budget: 0
      };
    }

    return new Response(JSON.stringify({ 
      travelInfo
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-travel-info function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      travelInfo: {
        description: "Error al extraer información",
        tripType: 'package',
        travelers: { adults: 1, children: 0 },
        budget: 0
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});