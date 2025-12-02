import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Interface for structured itinerary day
interface ItineraryActivity {
    time: string;
    activity: string;
    tip?: string;
}

interface ItineraryRestaurant {
    name: string;
    type: string;
    priceRange: string;
}

interface ItineraryDay {
    day: number;
    title: string;
    morning: ItineraryActivity[];
    afternoon: ItineraryActivity[];
    evening: ItineraryActivity[];
    restaurants: ItineraryRestaurant[];
    travelTip: string;
}

interface ItineraryResponse {
    destinations: string[];
    days: number;
    title: string;
    introduction: string;
    itinerary: ItineraryDay[];
    generalTips: string[];
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders
        });
    }

    // Initialize Supabase client for rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Apply rate limiting
    return await withRateLimit(
        req,
        supabase,
        { action: 'api_call', resource: 'travel-itinerary' },
        async () => {
            try {
                const { destinations, days } = await req.json();

                if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
                    throw new Error('Destinations array is required');
                }

                if (!days || typeof days !== 'number' || days < 1) {
                    throw new Error('Days must be a positive number');
                }

                console.log('🗺️ Travel Itinerary Generator - Processing:', { destinations, days });

                const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
                if (!openaiApiKey) throw new Error('OpenAI API key not configured');

                const destinationsText = destinations.join(', ');
                const isMultipleDestinations = destinations.length > 1;

                const systemPrompt = `Eres un experto planificador de viajes que crea itinerarios detallados y personalizados en ESPAÑOL.

TAREA: Crear un itinerario de ${days} días para ${destinationsText}.

REGLAS IMPORTANTES:
1. Responde SOLO con JSON válido, sin texto adicional
2. El itinerario debe ser realista y considerar tiempos de traslado
3. Incluye actividades populares Y experiencias locales auténticas
4. Los horarios deben ser prácticos (no empezar muy temprano ni muy tarde)
5. Incluye opciones gastronómicas variadas (local, internacional, casual, formal)
6. Los tips deben ser útiles y específicos del destino
7. ${isMultipleDestinations ? 'Distribuye los días entre los destinos de forma lógica, agrupando destinos cercanos' : 'Maximiza las experiencias en el destino'}
8. Considera temporadas, clima típico y festividades locales
9. Incluye tiempo libre/descanso en el itinerario

ESTRUCTURA JSON REQUERIDA:
{
  "destinations": ["lista", "de", "destinos"],
  "days": ${days},
  "title": "Título atractivo del viaje",
  "introduction": "Breve introducción (2-3 oraciones) describiendo qué hace especial este viaje",
  "itinerary": [
    {
      "day": 1,
      "title": "Título del día (ej: 'Descubriendo el centro histórico')",
      "morning": [
        {"time": "09:00", "activity": "Descripción de la actividad", "tip": "Tip opcional útil"}
      ],
      "afternoon": [
        {"time": "13:00", "activity": "Descripción de la actividad", "tip": "Tip opcional"}
      ],
      "evening": [
        {"time": "19:00", "activity": "Descripción de la actividad"}
      ],
      "restaurants": [
        {"name": "Nombre del restaurante", "type": "Tipo de cocina", "priceRange": "$$"}
      ],
      "travelTip": "Un tip de viaje específico para este día"
    }
  ],
  "generalTips": [
    "Tip general 1 sobre el destino",
    "Tip general 2 sobre transporte/dinero/seguridad",
    "Tip general 3 sobre cultura local"
  ]
}

DETALLES POR TRAMO DEL DÍA:
- Morning (mañana): 2-3 actividades entre 8:00-13:00
- Afternoon (tarde): 2-3 actividades entre 13:00-19:00  
- Evening (noche): 1-2 actividades entre 19:00-23:00
- Restaurants: 2-3 opciones variadas por día
- PriceRange: $ (económico), $$ (moderado), $$$ (premium), $$$$ (lujo)

TIPS DE CALIDAD:
- Incluir información práctica: mejores horas para visitar, cómo evitar colas, etc.
- Mencionar si algo requiere reserva anticipada
- Incluir alternativas para días de lluvia cuando sea relevante
- Sugerir zonas/barrios para cada actividad

Genera el itinerario ahora en formato JSON:`;

                const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openaiApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: `Genera un itinerario detallado de ${days} días para: ${destinationsText}`
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 4000
                    })
                });

                if (!openaiResponse.ok) {
                    const errorData = await openaiResponse.text();
                    console.error('❌ OpenAI API error:', errorData);
                    throw new Error(`OpenAI API error: ${openaiResponse.status}`);
                }

                const openaiData = await openaiResponse.json();
                const aiResponse = openaiData.choices[0]?.message?.content;

                if (!aiResponse) {
                    throw new Error('No response from OpenAI');
                }

                console.log('🤖 Raw AI response:', aiResponse.substring(0, 200) + '...');

                // Clean and parse the JSON response
                let cleanedResponse = aiResponse.trim();

                // Remove markdown code blocks if present
                cleanedResponse = cleanedResponse.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');

                // Remove BOM and invisible characters
                cleanedResponse = cleanedResponse.replace(/^\uFEFF/, '');

                let parsed: ItineraryResponse;
                try {
                    parsed = JSON.parse(cleanedResponse);
                } catch (parseError) {
                    console.error('❌ Failed to parse AI response as JSON:', parseError);

                    // Try to extract JSON from the response
                    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            parsed = JSON.parse(jsonMatch[0]);
                            console.log('✅ Successfully extracted JSON from wrapped response');
                        } catch (secondParseError) {
                            console.error('❌ Failed to parse extracted JSON:', secondParseError);
                            throw new Error('Invalid JSON response from AI');
                        }
                    } else {
                        throw new Error('Invalid JSON response from AI');
                    }
                }

                // Validate response structure
                if (!parsed.itinerary || !Array.isArray(parsed.itinerary)) {
                    throw new Error('Invalid itinerary structure');
                }

                console.log('✅ Itinerary generated successfully:', {
                    destinations: parsed.destinations,
                    days: parsed.days,
                    itineraryDays: parsed.itinerary.length
                });

                return new Response(JSON.stringify({
                    success: true,
                    data: parsed,
                    timestamp: new Date().toISOString()
                }), {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });

            } catch (error) {
                console.error('❌ Travel Itinerary Generator error:', error);
                console.error('❌ Error stack:', error.stack);

                let errorMessage = 'Unknown error occurred';
                let statusCode = 500;

                if (error.message) {
                    errorMessage = error.message;
                }

                if (error.message?.includes('OpenAI')) {
                    statusCode = 502;
                }

                return new Response(JSON.stringify({
                    success: false,
                    error: errorMessage,
                    errorType: error.constructor.name,
                    timestamp: new Date().toISOString()
                }), {
                    status: statusCode,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
    );
});

