import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface PdfExtractedData {
  flights: Array<{
    airline: string;
    airlineCode?: string;
    route: string;
    origin: string;
    originCity: string;
    destination: string;
    destinationCity: string;
    date: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    price: number;
    direction: 'outbound' | 'return';
    layovers: Array<{
      airport: string;
      city: string;
      waitTime: string;
    }>;
  }>;
  hotels: Array<{
    optionNumber: number;
    name: string;
    stars: number;
    location: string;
    address: string;
    roomType: string;
    mealPlan: string;
    nights: number;
    packagePrice: number;
  }>;
  passengers: {
    adults: number;
    children: number;
    total: number;
  };
  dates: {
    departure: string;
    return: string;
  };
  nights: number;
  currency: string;
  hasTransfers: boolean;
  hasTravelAssistance: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText, fileName } = await req.json();

    if (!pdfText) {
      throw new Error('PDF text is required');
    }

    console.log('🤖 [PDF-AI-ANALYZER] Processing PDF:', fileName);
    console.log('📄 [PDF-AI-ANALYZER] Text length:', pdfText.length);
    console.log('📄 [PDF-AI-ANALYZER] Text preview:', pdfText.substring(0, 500));

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `Eres un experto extrayendo datos estructurados de cotizaciones de viaje en español.

IMPORTANTE: Responde SOLO con JSON válido, sin markdown ni texto adicional.

Analiza el texto del PDF y extrae la información en el siguiente formato JSON:

{
  "flights": [
    {
      "airline": "Nombre completo de la aerolínea",
      "airlineCode": "Código IATA (2 letras)",
      "route": "ORIGEN → DESTINO",
      "origin": "Código aeropuerto origen (3 letras)",
      "originCity": "Nombre de la ciudad origen",
      "destination": "Código aeropuerto destino (3 letras)",
      "destinationCity": "Nombre de la ciudad destino",
      "date": "YYYY-MM-DD",
      "departureTime": "HH:MM (hora de salida)",
      "arrivalTime": "HH:MM (hora de llegada)",
      "duration": "Xh Xm (duración total del vuelo)",
      "price": 0,
      "direction": "outbound o return",
      "layovers": [
        {
          "airport": "Código aeropuerto escala (3 letras)",
          "city": "Nombre de la ciudad de escala",
          "waitTime": "Xh Xm (tiempo de espera)"
        }
      ]
    }
  ],
  "hotels": [
    {
      "optionNumber": 1,
      "name": "Nombre del hotel SIN el número de opción",
      "stars": 5,
      "location": "Ciudad o zona (ej: Cancún, Punta Cana)",
      "address": "Dirección completa del hotel (ej: Boulevard Kukulkan Km 17, CANCÚN)",
      "roomType": "Tipo de habitación",
      "mealPlan": "Todo incluido / Desayuno / etc",
      "nights": 7,
      "packagePrice": 0
    }
  ],
  "passengers": {
    "adults": 2,
    "children": 0,
    "total": 2
  },
  "dates": {
    "departure": "YYYY-MM-DD",
    "return": "YYYY-MM-DD"
  },
  "nights": 7,
  "currency": "USD",
  "hasTransfers": true,
  "hasTravelAssistance": true
}

REGLAS CRÍTICAS:
1. VUELOS:
   - Si el precio del vuelo no está separado del paquete, pon price: 0
   - SIEMPRE extrae departureTime, arrivalTime y duration del detalle del vuelo
   - SIEMPRE extrae las escalas con sus tiempos de espera (ej: "Escala en Santiago - Tiempo de espera: 10h 11m")
   - El originCity y destinationCity deben ser nombres de ciudad (ej: "Buenos Aires", "Cancún"), NO códigos
   - Busca la sección "DETALLE DEL VUELO" para obtener tiempos exactos
2. HOTELES:
   - Cada "Opción X $PRECIO" representa un hotel/paquete diferente
   - El nombre del hotel aparece DESPUÉS de "Opción X $PRECIO"
   - El packagePrice es el precio TOTAL del paquete (vuelo + hotel) para esa opción
   - La location es la ciudad/zona (ej: "Cancún", "Punta Cana")
   - El address es la dirección física completa del hotel
   - El roomType viene entre paréntesis
   - El mealPlan se extrae del roomType (TODO INCLUIDO, ALL-INCLUSIVE, etc)
3. FECHAS: Extrae del campo "FECHAS" en formato YYYY-MM-DD
4. Si hay información que no puedes extraer, usa valores por defecto razonables
5. NO inventes datos que no estén en el texto
6. SERVICIOS INCLUIDOS: Busca la sección "INCLUYE" del PDF:
   - hasTransfers: true si menciona "Traslado", "Transfer", "Aeropuerto - Hotel" o similar
   - hasTravelAssistance: true si menciona "Seguro", "Asistencia médica", "Asistencia" o similar
   - Si no encuentras la sección INCLUYE o no hay mención de estos servicios, pon false`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extrae los datos de esta cotización de viaje:\n\n${pdfText}` }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [PDF-AI-ANALYZER] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const openaiResponse = await response.json();
    const content = openaiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('🤖 [PDF-AI-ANALYZER] OpenAI response:', content);

    // Parse JSON response - handle potential markdown code blocks
    let extractedData: PdfExtractedData;
    try {
      // Remove markdown code blocks if present
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }
      jsonContent = jsonContent.trim();

      extractedData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('❌ [PDF-AI-ANALYZER] JSON parse error:', parseError);
      console.error('❌ [PDF-AI-ANALYZER] Content that failed to parse:', content);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // Validate and ensure required fields
    if (!extractedData.flights) extractedData.flights = [];
    if (!extractedData.hotels) extractedData.hotels = [];
    if (!extractedData.passengers) {
      extractedData.passengers = { adults: 2, children: 0, total: 2 };
    }
    if (!extractedData.currency) extractedData.currency = 'USD';
    if (extractedData.hasTransfers === undefined) extractedData.hasTransfers = false;
    if (extractedData.hasTravelAssistance === undefined) extractedData.hasTravelAssistance = false;

    console.log('🚗 [PDF-AI-ANALYZER] Transfers included:', extractedData.hasTransfers);
    console.log('🏥 [PDF-AI-ANALYZER] Travel assistance included:', extractedData.hasTravelAssistance);

    console.log('✅ [PDF-AI-ANALYZER] Successfully extracted data:', JSON.stringify(extractedData, null, 2));

    return new Response(JSON.stringify({
      success: true,
      data: extractedData,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ [PDF-AI-ANALYZER] Error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
