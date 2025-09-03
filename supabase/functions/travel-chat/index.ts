import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  message: string;
  conversationId?: string;
}

interface TravelSearchParams {
  type: 'flight' | 'hotel' | 'package';
  destination: string;
  origin?: string;
  departureDate: string;
  returnDate?: string;
  checkinDate?: string;
  checkoutDate?: string;
  adults: number;
  children?: number;
  directFlight?: boolean;
  rooms?: number;
}

class TravelChatAgent {
  private openAIKey: string;
  private supabase: any;

  constructor(openAIKey: string, supabaseUrl: string, supabaseKey: string) {
    this.openAIKey = openAIKey;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async parseUserRequest(message: string): Promise<TravelSearchParams | null> {
    const systemPrompt = `Eres un asistente de viajes especializado en extraer parámetros de búsqueda de mensajes de usuarios.

Tu trabajo es analizar el mensaje del usuario y extraer los parámetros de búsqueda de viajes.

Responde SOLO con un JSON válido con la siguiente estructura:
{
  "type": "flight" | "hotel" | "package",
  "destination": "código de ciudad/aeropuerto",
  "origin": "código de ciudad/aeropuerto (solo para vuelos)",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD (opcional)",
  "checkinDate": "YYYY-MM-DD (para hoteles)",
  "checkoutDate": "YYYY-MM-DD (para hoteles)",
  "adults": number,
  "children": number,
  "directFlight": boolean,
  "rooms": number
}

Si no puedes extraer información suficiente, responde con null.

Ejemplos de destinos comunes:
- Cancún: CUN
- Ciudad de México: MEX
- Madrid: MAD
- Barcelona: BCN
- Buenos Aires: EZE
- Miami: MIA`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse OpenAI response:', content);
      return null;
    }
  }

  async searchFlights(params: TravelSearchParams) {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/starling-flights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        searchParams: {
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departureDate,
          returnDate: params.returnDate,
          adults: params.adults,
          children: params.children || 0,
          directFlight: params.directFlight || false,
        }
      }),
    });

    return await response.json();
  }

  async searchHotels(params: TravelSearchParams) {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/eurovips-hotels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        searchParams: {
          destination: params.destination,
          checkinDate: params.checkinDate || params.departureDate,
          checkoutDate: params.checkoutDate || params.returnDate,
          adults: params.adults,
          children: params.children || 0,
          rooms: params.rooms || 1,
        }
      }),
    });

    return await response.json();
  }

  async generateRecommendations(searchParams: TravelSearchParams, flightResults: any, hotelResults: any): Promise<{ narrative: string; recommendations: any[] }> {
    const systemPrompt = `Eres un agente de viajes experto. Devuelve SOLO JSON válido con este esquema:
{
  "narrative": string, // texto breve en español con formato markdown (titulares y bullets)
  "recommendations": [
    {
      "title": string,              // nombre comercial de la opción
      "price": number,              // precio total estimado
      "currency": "USD",
      "flightSummary": string,      // ruta, fechas, aerolínea, si es directo
      "hotelSummary": string,       // hotel, plan, ubicación, rating
      "notes": string[]             // bullets con ventajas
    }
  ]
}
Si no hay información suficiente, devuelve recommendations como [].`;

    const userMessage = `
Búsqueda: ${JSON.stringify(searchParams)}
Resultados de vuelos: ${JSON.stringify(flightResults)}
Resultados de hoteles: ${JSON.stringify(hotelResults)}
Genera hasta 5 recomendaciones combinadas. NO inventes datos: si algún valor no está disponible, omítelo.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1600,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    try {
      const parsed = JSON.parse(content);
      return { narrative: parsed.narrative || '', recommendations: parsed.recommendations || [] };
    } catch (e) {
      // Fallback: wrap as narrative text
      return { narrative: content, recommendations: [] };
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const { message, conversationId }: SearchRequest = await req.json();
    const agent = new TravelChatAgent(OPENAI_API_KEY, SUPABASE_URL!, SUPABASE_ANON_KEY!);

    console.log('Processing travel chat request:', message);

    // Parse user request
    let searchParams = await agent.parseUserRequest(message);
    
    if (!searchParams) {
      return new Response(JSON.stringify({
        success: true,
        response: "No pude entender los parámetros de búsqueda. ¿Podrías ser más específico? Por ejemplo: 'Quiero un vuelo y hotel para 2 personas del 10 al 20 de septiembre para Cancún, vuelo directo'",
        type: 'clarification'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize IATA codes and dates to future
    const cityMap: Record<string, string> = {
      'BUENOS AIRES': 'EZE', 'EZEIZA': 'EZE', 'AEROPARQUE': 'AEP', 'AEP': 'AEP', 'EZE': 'EZE',
      'CANCUN': 'CUN', 'CANCÚN': 'CUN', 'CUN': 'CUN',
      'PUNTA CANA': 'PUJ', 'PUJ': 'PUJ',
      'MADRID': 'MAD', 'BARCELONA': 'BCN', 'MIAMI': 'MIA'
    };
    const normCode = (s?: string) => {
      if (!s) return s;
      const up = s.trim().toUpperCase();
      if (up.length === 3) return up;
      return cityMap[up] || up;
    };
    searchParams.origin = normCode(searchParams.origin);
    searchParams.destination = normCode(searchParams.destination);

    const toFuture = (d?: string) => {
      if (!d) return d;
      const parts = d.split('-');
      if (parts.length !== 3) return d;
      const dt = new Date(d + 'T00:00:00');
      const today = new Date();
      // If date is in the past, push to next year same month-day
      if (dt < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        const next = new Date(dt);
        next.setFullYear(today.getFullYear() + 1);
        const mm = String(next.getMonth() + 1).padStart(2, '0');
        const dd = String(next.getDate()).padStart(2, '0');
        return `${next.getFullYear()}-${mm}-${dd}`;
      }
      return d;
    };

    searchParams.departureDate = toFuture(searchParams.departureDate)!;
    if (searchParams.returnDate) {
      searchParams.returnDate = toFuture(searchParams.returnDate)!;
    }
    if (searchParams.type === 'hotel' || searchParams.type === 'package') {
      searchParams.checkinDate = toFuture(searchParams.checkinDate || searchParams.departureDate)!;
      searchParams.checkoutDate = toFuture(searchParams.checkoutDate || searchParams.returnDate)!;
    }

    console.log('Normalized search parameters:', searchParams);

    // Search flights and hotels in parallel
    const searchPromises = [] as any[];
    
    if (searchParams.type === 'flight' || searchParams.type === 'package') {
      searchPromises.push(agent.searchFlights(searchParams));
    } else {
      searchPromises.push(Promise.resolve(null));
    }

    if (searchParams.type === 'hotel' || searchParams.type === 'package') {
      searchPromises.push(agent.searchHotels(searchParams));
    } else {
      searchPromises.push(Promise.resolve(null));
    }

    const [flightResults, hotelResults] = await Promise.all(searchPromises);
    
    console.log('Flight results:', flightResults);
    console.log('Hotel results:', hotelResults);

    // Generate AI recommendations
    const rec = await agent.generateRecommendations(searchParams, flightResults, hotelResults);

    return new Response(JSON.stringify({
      success: true,
      response: rec.narrative,
      recommendations: rec.recommendations,
      searchParams,
      results: {
        flights: flightResults,
        hotels: hotelResults
      },
      type: 'recommendations'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in travel-chat function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      response: "Lo siento, hubo un error procesando tu búsqueda. Por favor, inténtalo de nuevo."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});