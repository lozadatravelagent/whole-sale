import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { message, language = 'es', currentDate, previousContext, conversationHistory = [] } = await req.json();
    if (!message) {
      throw new Error('Message is required');
    }
    console.log('🤖 AI Message Parser - Processing:', message);
    console.log('📝 Previous context received:', previousContext);
    console.log('📚 Conversation history received:', conversationHistory?.length || 0, 'messages');
    console.log('📅 Current date:', currentDate);
    // Safely format conversation history - limit to last 5 messages to avoid prompt length issues
    let conversationHistoryText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      try {
        const recentHistory = conversationHistory.slice(-8); // Last 8 messages for better context
        conversationHistoryText = recentHistory.map((msg, index) => {
          // Escape any problematic characters and truncate long messages
          const safeContent = (msg.content || '').replace(/`/g, "'").replace(/\$/g, "\\$").substring(0, 300); // Increased message length for better context
          return `${msg.role}: ${safeContent}`;
        }).join('\\n');
      } catch (e) {
        console.error('Error formatting conversation history:', e);
        conversationHistoryText = '';
      }
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OpenAI API key not configured');
    const systemPrompt = `Eres un experto asistente de viajes que analiza solicitudes de viaje en ESPAÑOL y extrae datos estructurados en JSON.

FECHA ACTUAL: ${currentDate}
IMPORTANTE: Siempre responde solo con JSON válido. Usa \\n para saltos de línea en strings.

${conversationHistoryText ? `CONVERSATION HISTORY:
${conversationHistoryText}

CONVERSATION CONTEXT RULES:
- Analyze ENTIRE conversation to extract all travel details mentioned across messages
- If user mentioned flight details earlier, include them in current parsing
- If user mentioned hotel preferences earlier, include them in current parsing
- If user said "no hotel" or "solo vuelo", respect that preference
- Build upon ALL previous information - never lose context between messages
- Only ask for fields NEVER mentioned in any previous message
- If user contradicts earlier info, use most recent statement
` : ''}

${previousContext ? `PREVIOUS CONTEXT:
${JSON.stringify(previousContext, null, 2)}

CONTEXT MERGING RULES:
1. If current message modifies preferences ("con escalas", "con valija"), merge with previous context - keep ALL existing fields, only update mentioned preference
2. If current message adds missing info, merge with previous context
3. If current message is completely new request (new origin/destination), ignore previous context
4. NEVER ask for info already in context

EXAMPLES:
- Previous has complete flight + current "con escalas" → Return complete flight with stops: "any"
- Previous has complete flight + current "sin escalas" → Return complete flight with stops: "direct"
- Previous has complete flight + current "con valija" → Return complete flight with luggage: "checked"
` : ''}

TASK: Extract structured data for flights, hotels, packages, services, or combined requests.

**INTELLIGENCE GUIDELINES:**
- Be extremely flexible interpreting ANY city, airport, country, or destination name globally
- Understand ANY Spanish/English month names, date formats, and relative dates
- Recognize ANY passenger count format (numbers, words, "personas", "adultos", families, etc.)
- Interpret ANY luggage terminology in Spanish/English intelligently
- Understand ANY flight preference expressions (escalas, directo, conexiones, etc.)
- Use world knowledge to map locations to correct IATA codes
- When uncertain, choose the most logical interpretation rather than asking for clarification

## CORE PARSING RULES

**SMART DEFAULTS (don't ask user):**
- stops: "any" if not specified
- children: 0 if not specified
- luggage: NEVER include unless user explicitly mentions baggage preferences (valija, equipaje, carry-on, etc.)
- preferredAirline: NEVER include unless user explicitly mentions an airline name

**DATE INTERPRETATION:**
- Month names (enero, febrero, etc.) → first day of month
- "primer/primera semana de [mes]" → first day of month
- Year logic: Use current year (${currentDate.split('-')[0]}) unless month has passed, then use next year
- No date mentioned → current date + 7 days
- Round trip indicators: "vuelta", "regreso", "ida y vuelta" → require returnDate

**PASSENGER INTERPRETATION:**
- "[número] personas" = that many adults, 0 children
- "una persona" = 1 adult, 0 children
- "para [número] persona(s)" = that many adults, 0 children

**LOCATION INTERPRETATION:**
- Convert ANY city/airport name to appropriate IATA code using your knowledge
- Major cities: Use primary international airport (Madrid→MAD, Paris→CDG, London→LHR, etc.)
- Multiple airports: Buenos Aires (EZE for international, AEP for domestic), New York (JFK/LGA/EWR), etc.
- Beach/resort destinations: Use closest airport (Riviera Maya→CZM, Punta Cana→PUJ, etc.)
- Unknown locations: Use best available IATA code or keep city name if no clear airport
- Be intelligent about regional airports vs major hubs

**LUGGAGE INTERPRETATION (ONLY when explicitly mentioned):**
- "carry_on": equipaje de mano, cabina, carry on, solo mochila, solo equipaje de mano
- "checked": valija, equipaje facturado, maleta, bodega, despachado, con valija
- "both": ambos tipos, equipaje completo, mano y bodega, con equipaje de mano y valija
- "none": sin equipaje, solo personal, nada de equipaje
- CRITICAL: If NO luggage terms mentioned, DO NOT include luggage field at all
- NEVER assume luggage preferences - only include when user specifically mentions baggage

**STOPS INTERPRETATION:**
- "direct": directo, sin escalas, non-stop, vuelo directo
- "any": con escalas, cualquier vuelo, no importa, flexible
- "one_stop": una escala, con escala, una conexión
- "two_stops": dos escalas, múltiples conexiones
- Interpret ANY flight preference terminology intelligently

**LAYOVER DURATION EXTRACTION:**
- Extract specific layover time constraints: "no más de X horas", "escalas de máximo X horas", "con escalas de no más de X horas"
- Convert to maxLayoverHours field (number in hours)
- Examples: "no más de 3 horas" → maxLayoverHours: 3, "escalas de máximo 10 horas" → maxLayoverHours: 10
- "con 1 escala de no más de 3 horas" → stops: "one_stop", maxLayoverHours: 3

**AIRLINE PREFERENCE EXTRACTION (OPTIONAL):**
- CRITICAL: ONLY include preferredAirline if user EXPLICITLY mentions an airline name or preference
- NEVER assume or infer airlines based on routes, destinations, or your knowledge of popular carriers
- NEVER include preferredAirline unless user specifically says airline name like "Iberia", "Air France", "American Airlines", etc.
- Common explicit patterns: "aerolínea [name]", "aerolinea [name]", "con [airline]", "vuelo de [airline]", "en [airline]", "de [airline]", "prefiero [airline]"
- Convert mentioned airlines to IATA code when you know it, otherwise use the airline name as provided
- If NO airline is explicitly mentioned by user, DO NOT include preferredAirline field at all
- Do not make route-based assumptions (e.g., EZE-MAD does NOT automatically mean Iberia)
- Be intelligent about airline recognition but ONLY when explicitly mentioned

**COMBINED SEARCH TRIGGERS:**
- "vuelo y hotel", "con hotel", "hotel incluido", "paquete", "agrega hotel"

## REQUIRED FIELDS

**FLIGHTS:** origin, destination, departureDate, adults (returnDate only if round trip mentioned)
**HOTELS:** city, checkinDate, checkoutDate, adults, roomType, mealPlan
**COMBINED:** All flight + hotel required fields

## RESPONSE EXAMPLES

Basic flight request (only include fields that are mentioned or required):
{
  "requestType": "flights",
  "flights": {
    "origin": "MAD",
    "destination": "MIA",
    "departureDate": "2025-11-01",
    "adults": 2,
    "children": 0,
    "stops": "direct"
  },
  "confidence": 0.9
}

Flight with explicit preferences (include optional fields only when mentioned):
{
  "requestType": "flights",
  "flights": {
    "origin": "EZE",
    "destination": "CDG",
    "departureDate": "2025-10-02",
    "returnDate": "2025-10-20",
    "adults": 1,
    "luggage": "checked",
    "stops": "one_stop",
    "maxLayoverHours": 3,
    "preferredAirline": "AF"
  },
  "confidence": 0.9
}

Missing info request:
{
  "requestType": "missing_info_request",
  "message": "Para buscar tu vuelo necesito:\\n\\n**Pasajeros:** ¿Cuántos adultos?",
  "missingFields": ["adults"],
  "confidence": 0.3
}

Analyze this message and respond with JSON only:`;
    const userPrompt = message;
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
            content: userPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
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
    console.log('🤖 Raw AI response:', aiResponse);
    console.log('🤖 AI response type:', typeof aiResponse);
    console.log('🤖 AI response length:', aiResponse?.length);
    // Clean the AI response to handle emojis and special characters properly
    let cleanedResponse = aiResponse.trim();
    // Remove any potential BOM or invisible characters
    cleanedResponse = cleanedResponse.replace(/^\uFEFF/, '');
    // Try to fix JSON by replacing literal newlines in string values with \\n
    // This is a more targeted approach to fix the specific issue
    try {
      // First, try to parse as-is
      JSON.parse(cleanedResponse);
    } catch (error) {
      // If parsing fails, try to fix common issues
      console.log('🔧 Attempting to fix JSON formatting issues...');
      // Fix literal newlines in string values by replacing them with \\n
      cleanedResponse = cleanedResponse.replace(/"([^"]*)\n([^"]*)"/g, (match, before, after) => {
        return `"${before}\\n${after}"`;
      });
      // Fix multiple consecutive newlines
      cleanedResponse = cleanedResponse.replace(/"([^"]*)\n\n([^"]*)"/g, (match, before, after) => {
        return `"${before}\\n\\n${after}"`;
      });
    }
    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.error('❌ AI response was:', aiResponse);
      console.error('❌ Cleaned response was:', cleanedResponse);
      // Try to extract JSON from the response if it's wrapped in other text
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
    // Fix common type issues from AI response
    if (typeof parsed.confidence === 'string') {
      parsed.confidence = parseFloat(parsed.confidence);
    }

    // Add default confidence if missing
    if (parsed.confidence === undefined || parsed.confidence === null) {
      console.log('⚠️ Missing confidence field, setting default value of 0.8');
      parsed.confidence = 0.8;
    }

    // Fix maxLayoverHours if it's a string
    if (parsed.flights?.maxLayoverHours && typeof parsed.flights.maxLayoverHours === 'string') {
      parsed.flights.maxLayoverHours = parseInt(parsed.flights.maxLayoverHours, 10);
    }

    // Validate the response structure
    if (!parsed.requestType || typeof parsed.confidence !== 'number') {
      console.error('❌ Invalid response structure from AI:', {
        requestType: parsed.requestType,
        confidence: parsed.confidence,
        confidenceType: typeof parsed.confidence,
        fullResponse: parsed
      });
      throw new Error(`Invalid response structure from AI - requestType: ${parsed.requestType}, confidence: ${parsed.confidence} (${typeof parsed.confidence})`);
    }
    console.log('✅ AI parsing successful:', parsed);
    return new Response(JSON.stringify({
      success: true,
      parsed,
      aiResponse: aiResponse,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ AI Message Parser error:', error);
    console.error('❌ Error stack:', error.stack);
    // More specific error handling
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.message?.includes('OpenAI')) {
      statusCode = 502; // Bad Gateway for external service errors
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
});
