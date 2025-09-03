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
    const { message } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    console.log(`Processing travel chat request: ${message}`);

    const systemPrompt = `Eres un asistente experto en turismo y viajes. Tu trabajo es ayudar a los usuarios con:

🌍 **Recomendaciones de destinos**
- Mejores lugares para visitar según intereses y presupuesto
- Destinos menos conocidos pero increíbles
- Comparación entre diferentes opciones

✈️ **Información sobre vuelos y hoteles**  
- Aerolíneas recomendadas para cada destino
- Mejores zonas para alojarse
- Tips para encontrar mejores precios
- Temporadas altas y bajas

🎒 **Consejos de viaje**
- Qué empacar según el destino y época
- Consejos de seguridad
- Cómo moverse en cada ciudad/país
- Apps útiles para viajar

🏛️ **Actividades y atracciones turísticas**
- Lugares imperdibles en cada destino
- Actividades según intereses (aventura, cultura, gastronomía, etc.)
- Tours recomendados
- Experiencias locales auténticas

💰 **Presupuestos de viaje**
- Estimaciones de costos por persona/día
- Tips para viajar económico
- Cuándo es más barato viajar
- Cómo ahorrar en vuelos, hoteles y actividades

📋 **Documentación necesaria para viajar**
- Requisitos de visa según nacionalidad
- Documentos necesarios
- Vacunas requeridas
- Seguros de viaje recomendados

🌤️ **Mejor época para viajar**
- Clima ideal según el destino
- Temporadas de lluvia/sequía
- Eventos especiales y festivales
- Cuándo evitar multitudes

🍽️ **Cultura y gastronomía local**
- Platos típicos que debes probar
- Costumbres locales importantes
- Etiqueta y protocolo
- Frases útiles en el idioma local

Responde de manera útil, amigable y profesional. Usa formato Markdown para organizar bien la información con emojis y secciones claras. Sé específico y da consejos prácticos.

Si te preguntan sobre búsquedas específicas de vuelos o hoteles con fechas exactas, explica que el sistema de reservas está temporalmente en mantenimiento, pero puedes dar consejos generales sobre el destino, aerolíneas recomendadas, zonas de alojamiento, mejor época para viajar, etc.`;

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
          { role: 'user', content: message }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const aiResponse = openAIData.choices[0].message.content;

    console.log('Generated AI response successfully');

    return new Response(JSON.stringify({ 
      message: aiResponse
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in travel-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      message: "Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo." 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});