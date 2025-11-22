import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
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

  // Initialize Supabase client for rate limiting
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Apply rate limiting
  return await withRateLimit(
    req,
    supabase,
    { action: 'message', resource: 'ai-parser' },
    async () => {
      try {
    const { message, language = 'es', currentDate, previousContext, conversationHistory = [] } = await req.json();
    if (!message) {
      throw new Error('Message is required');
    }
    console.log('🤖 AI Message Parser - Processing:', message);
    console.log('📝 Previous context received:', previousContext);
    console.log('📚 Conversation history received:', conversationHistory?.length || 0, 'messages');
    console.log('📅 Current date:', currentDate);
    // Format conversation history - use smart truncation to maximize context
    let conversationHistoryText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      try {
        // Take last 20 messages for comprehensive context (up from 8)
        const recentHistory = conversationHistory.slice(-20);

        conversationHistoryText = recentHistory.map((msg, index) => {
          // Escape problematic characters
          let safeContent = (msg.content || '').replace(/`/g, "'").replace(/\$/g, "\\$");

          // Smart truncation: keep more for recent messages, less for older ones
          const messagesFromEnd = recentHistory.length - index;
          let maxLength;
          if (messagesFromEnd <= 5) {
            maxLength = 800; // Last 5 messages: keep almost full content
          } else if (messagesFromEnd <= 10) {
            maxLength = 500; // Messages 6-10: medium length
          } else {
            maxLength = 300; // Older messages: shorter summary
          }

          safeContent = safeContent.substring(0, maxLength);
          if (safeContent.length === maxLength) {
            safeContent += '...'; // Indicate truncation
          }

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

🚨 CRITICAL CONTEXT EXTRACTION RULES:
- When user says "esas fechas" / "those dates" → Extract dates from LAST flight/hotel search in conversation
- When user says "mismo destino" / "same destination" → Extract destination from LAST search
- When user mentions ONLY a city name (e.g., "miami", "barcelona") → Check if that city was mentioned in previous flights as destination, if so, extract ALL flight details (dates, passengers)
- When user requests "hotel para X adultos" → Check conversation for ANY previous flight search and auto-fill: city (from destination), checkinDate (from departureDate), checkoutDate (from returnDate), adults, children
- ALWAYS prioritize extracting complete context from conversation history over asking for missing fields
- If you find ANY flight details in previous messages, include them in hotels search even if user doesn't explicitly mention them
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

**FLIGHT REQUEST INTENTION DETECTION (CRITICAL):**

RULE: If the message contains ANY flight-related keyword in a REQUEST CONTEXT, classify as requestType: "flights"

**Flight Keywords:** vuelo, vuelos, volar, volando, flight, flights, aéreo, aérea, avión, aviones, boleto, boletos, pasaje, pasajes

**Request Context Indicators:**
- Verbs: quiero, dame, dáme, necesito, busco, me das, puedes, podrías, reserva, cotiza, consigue
- Questions: cuánto cuesta, precio de, costo de, disponibilidad de
- Commands: buscar, reservar, cotizar, conseguir
- Travel phrases: viajar a, ir a, viaje a, viaje de

**Examples that MUST be classified as "flights":**
- "dame un vuelo" ✅
- "quiero un vuelo" ✅
- "necesito volar" ✅
- "busco vuelos baratos" ✅
- "me das precios de vuelos" ✅
- "cuánto cuesta un vuelo" ✅
- "cotización de vuelo" ✅
- "quiero viajar" ✅
- "boletos de avión" ✅

**TYPO AND VARIATION TOLERANCE (CRITICAL):**
Be EXTREMELY tolerant of spelling errors, typos, and variations:
- "bulo" → vuelo
- "buelo" → vuelo
- "vuelo" with any typos → vuelo
- "volar" with typos → volar
- "vijar" → viajar
- "biajar" → viajar
- "aion" → avión
- "abion" → avión
- Casual language: "un vuelo x favor", "vuelo pls", "porfavor vuelo"
- Incomplete phrases: "dame vuelo", "quero vuelo", "nesesito vuelo"
- Mixed languages: "flight", "fly", combined with Spanish

**SEMANTIC ANALYSIS APPROACH:**
1. **Primary Focus**: What is the user TRYING TO DO? (intent over exact words)
2. **Context Clues**: Look for travel-related context even with poor spelling
3. **Fuzzy Matching**: Match words phonetically and by meaning, not just spelling
4. **User Intent**: Always prioritize understanding what the user wants over perfect grammar

INTELLIGENCE RULE: Use semantic understanding and context clues. If the user's intent seems to be about air travel, classify as "flights" regardless of spelling errors or grammatical mistakes.

CRITICAL INSTRUCTION:
- Do NOT require complete flight details to classify as "flights"
- Even incomplete requests like "dame un vuelo" = requestType: "flights"
- Focus on INTENTION, not completeness
- Missing details trigger missing_info_request AFTER confirming flights intention

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
- **CRITICAL YEAR LOGIC:**
  * Current date is: ${currentDate}
  * If the mentioned month has ALREADY PASSED in the current year → use NEXT YEAR (${parseInt(currentDate.split('-')[0]) + 1})
  * If the mentioned month is in the FUTURE (hasn't happened yet this year) → use CURRENT YEAR (${currentDate.split('-')[0]})
  * Example: Today is ${currentDate}. If user says "marzo" (March), since March ${currentDate.split('-')[0]} already passed, use March ${parseInt(currentDate.split('-')[0]) + 1}
  * Example: Today is ${currentDate}. If user says "noviembre" (November), since November ${currentDate.split('-')[0]} hasn't happened yet, use November ${currentDate.split('-')[0]}
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
- "checked": valija, equipaje facturado, equipaje en bodega, maleta, bodega, despachado, con valija
- "both": ambos tipos, equipaje completo, mano y bodega, con equipaje de mano y valija
- "none": sin equipaje, solo personal, nada de equipaje

🚨 **CRITICAL LUGGAGE RULE - READ CAREFULLY:**
- IF the user message contains NO baggage/luggage/equipaje/valija/carry-on/mochila words → DO NOT include "luggage" field
- ONLY include "luggage" field when user EXPLICITLY mentions baggage preferences
- NEVER add luggage field as default or assumption
- Example: "vuelo a madrid" → NO luggage field (user didn't mention baggage)
- Example: "vuelo con equipaje en bodega" → luggage: "checked" (user mentioned baggage)

**STOPS INTERPRETATION:**
- "direct": directo, sin escalas, non-stop, vuelo directo
- "with_stops": con escalas (genérico), vuelos con conexiones, cualquier vuelo con paradas
- "one_stop": una escala, con escala, una conexión
- "two_stops": dos escalas, múltiples conexiones
- "any": cualquier vuelo, no importa, flexible (incluye directos y con escalas)
- Interpret ANY flight preference terminology intelligently

**LAYOVER DURATION EXTRACTION:**
🚨 **CRITICAL RULE - ONLY include maxLayoverHours when user EXPLICITLY mentions time limits:**
- Extract ONLY when user mentions specific time constraints: "no más de X horas", "escalas de máximo X horas", "con escalas de no más de X horas", "escalas cortas", "escalas que sean menos de X horas"
- Convert to maxLayoverHours field (number in hours)
- Examples: "no más de 3 horas" → maxLayoverHours: 3, "escalas de máximo 10 horas" → maxLayoverHours: 10
- "con 1 escala de no más de 3 horas" → stops: "one_stop", maxLayoverHours: 3

❌ **DO NOT include maxLayoverHours if:**
- User only mentions basic flight request without time constraints
- User says "con escalas" without specifying time limit
- User doesn't mention layover duration at all
- Example: "vuelo madrid barcelona" → NO maxLayoverHours field
- Example: "vuelo con escalas" → NO maxLayoverHours field

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

## REQUIRED FIELDS AND DEFAULTS

**FLIGHTS:**
- Required: origin, destination, departureDate
- Optional: returnDate (only if round trip mentioned)
- **DEFAULT: adults = 1** (if not specified, always assume 1 adult)
- children = 0 (default if not specified)

**HOTELS:**
- Required: city, checkinDate, checkoutDate
- **DEFAULT: adults = 1** (if not specified, always assume 1 adult)
- children = 0 (default if not specified)
- roomType, mealPlan (OPTIONAL - ONLY include if user explicitly mentions them)

🚨 **CRITICAL HOTEL PREFERENCE RULES:**
- **roomType**: ONLY include if user explicitly says "habitación simple/single", "habitación doble/double", "habitación triple/triple"
  * If user says NOTHING about room type → DO NOT include roomType field
  * Examples: "hotel en Cancún" → NO roomType, "habitación doble en Cancún" → roomType: "double"
- **mealPlan**: ONLY include if user explicitly mentions food/meal preferences
  * Keywords: "all inclusive", "todo incluido", "desayuno", "breakfast", "media pensión", "half board", "solo alojamiento", "room only"
  * If user says NOTHING about meals → DO NOT include mealPlan field
  * Examples: "hotel en Cancún" → NO mealPlan, "hotel all inclusive" → mealPlan: "all_inclusive"

**COMBINED:** All flight + hotel required fields with same defaults

**IMPORTANT PASSENGER RULES:**
1. If NO passenger count mentioned → adults = 1, children = 0
2. If "para 2" or "2 personas" mentioned → adults = 2, children = 0
3. If "con un niño" mentioned → adults = 1, children = 1
4. If "familia de 4" mentioned → infer adults = 2, children = 2
5. NEVER ask for passenger count if not mentioned - default to 1 adult

## RESPONSE EXAMPLES

Example 1 - Basic flight request WITHOUT passenger count specified:
User: "Quiero un vuelo de [origen] a [destino] para [mes] de [año]"
{
  "requestType": "flights",
  "flights": {
    "origin": [origen]",
    "destination": "[destino]",
    "departureDate": "[fecha de salida]",
    "adults": 1,
    "children": 0,
    "stops": "any"
  },
  "confidence": 0.9
}

Example 2 - Flight with multiple passengers explicitly mentioned:
User: "Necesito vuelo para 2 adultos de [origen] a [destino]"
{
  "requestType": "flights",
  "flights": {
    "origin": "[origen]",
    "destination": "[destino]",
    "departureDate": "[FECHA_SALIDA]",
    "adults": 2,
    "children": 0,
    "stops": "any"
  },
  "confidence": 0.9
}

Example 3 - Flight with preferences (include optional fields only when mentioned):
{
  "requestType": "flights",
  "flights": {
    "origin": "[ORIGEN]",
    "destination": "[DESTINO]",
    "departureDate": "[FECHA_SALIDA]",
    "returnDate": "[FECHA_REGRESO]",
    "adults": 1,
    "children": 0,
    "luggage": "checked",
    "stops": "one_stop",
    "maxLayoverHours": 3,
    "preferredAirline": "[CODIGO_AEROLINEA]"
  },
  "confidence": 0.9
}

Example 4 - Missing critical info (ONLY ask for origin/destination/dates, NOT passengers):
User: "Quiero viajar"
{
  "requestType": "missing_info_request",
  "message": "Para buscar tu vuelo necesito:\\n\\n**Origen:** ¿Desde dónde viajas?\\n**Destino:** ¿A dónde quieres ir?\\n**Fecha:** ¿Cuándo viajas?",
  "missingFields": ["origin", "destination", "departureDate"],
  "confidence": 0.3
}

Example 5 - Hotel request WITHOUT room/meal preferences (ONLY required fields):
User: "quiero un hotel en Cancún"
{
  "requestType": "hotels",
  "hotels": {
    "city": "Cancún",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 1,
    "children": 0
  },
  "confidence": 0.9
}
❌ NOTE: NO roomType or mealPlan because user didn't mention them!

Example 6 - Hotel request WITH room type but NO meal plan:
User: "habitación doble en Cancún"
{
  "requestType": "hotels",
  "hotels": {
    "city": "Cancún",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 2,
    "children": 0,
    "roomType": "double"
  },
  "confidence": 0.9
}
❌ NOTE: NO mealPlan because user didn't mention food preferences!

Example 7 - Hotel request with context from previous flight search (CRITICAL PATTERN):
🚨 PATTERN: When user says "esas fechas" or "those dates", you MUST extract from conversation history:
- Previous flight destination → becomes hotel city
- Previous flight departureDate → becomes hotel checkinDate
- Previous flight returnDate → becomes hotel checkoutDate
- Previous flight adults/children → becomes hotel adults/children

User: "también quiero hotel para esas fechas" (after previous flight search)
{
  "requestType": "hotels",
  "hotels": {
    "city": "[EXTRACT from previous flight DESTINATION]",
    "checkinDate": "[EXTRACT from previous flight DEPARTURE DATE]",
    "checkoutDate": "[EXTRACT from previous flight RETURN DATE]",
    "adults": "[EXTRACT from current message OR previous flight]",
    "children": "[EXTRACT from current message OR previous flight OR 0]"
  },
  "confidence": 0.95
}
❌ NOTE: NO roomType or mealPlan unless user explicitly mentioned them in THIS message!

Example 8 - Hotel request WITH explicit room AND meal preferences:
User: "habitación doble all inclusive en Cancún"
{
  "requestType": "hotels",
  "hotels": {
    "city": "Cancún",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 2,
    "children": 0,
    "roomType": "double",
    "mealPlan": "all_inclusive"
  },
  "confidence": 0.95
}
✅ NOTE: BOTH roomType and mealPlan included because user explicitly mentioned them!

Example 9 - Hotel request mentioning city from previous flight (CRITICAL PATTERN):
🚨 PATTERN: When user mentions a city that appeared in previous flight search, you MUST:
1. Extract ALL flight details from that previous message (dates, passengers)
2. Use flight destination as hotel city
3. Use flight dates as hotel dates
4. Use flight passenger count as hotel passenger count

User: "hotel en Cancún" (after previous flight search to Cancún)
{
  "requestType": "hotels",
  "hotels": {
    "city": "Cancún",
    "checkinDate": "[EXTRACT from previous flight to this city]",
    "checkoutDate": "[EXTRACT from previous flight to this city]",
    "adults": "[EXTRACT from previous flight]",
    "children": "[EXTRACT from previous flight OR 0]"
  },
  "confidence": 0.9
}
❌ NOTE: NO roomType or mealPlan unless user explicitly mentioned them!

🚨 CRITICAL FINAL INSTRUCTION:
- The examples above show PATTERNS and STRUCTURES only
- You MUST extract actual values from the REAL conversation history provided above, NOT from the examples
- NEVER use example cities (Miami, Punta Cana) or example dates unless they appear in the ACTUAL conversation
- Always use [EXTRACT from X] placeholders as instructions to extract from REAL conversation history
- Your response must reflect the ACTUAL user request and ACTUAL conversation context

Now analyze this ACTUAL message and respond with JSON only:`;
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
    }
  );
});
