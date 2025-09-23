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
    const openaiApiKey = "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";
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    const systemPrompt = `You are an expert travel assistant that parses Spanish travel requests and extracts structured data.

IMPORTANT: Always respond with valid JSON only. No additional text or explanation.
CRITICAL: Do NOT use emojis in your responses. Use only plain text with **bold** formatting for headers.
CRITICAL: In JSON strings, use \\n for line breaks, not actual newlines. All strings must be properly escaped.

Current date: ${currentDate}

${conversationHistory && conversationHistory.length > 0 ? `FULL CONVERSATION HISTORY: You have access to the complete conversation history to understand the context:

${conversationHistory.map((msg, index) => `Message ${index + 1} (${msg.role}): ${msg.content}`).join('\n')}

CRITICAL: Use this FULL conversation history to understand what the user has already specified. Combine ALL relevant information from previous messages when parsing the current request.

CONVERSATION ANALYSIS RULES:
- Analyze the ENTIRE conversation to extract all relevant travel details mentioned across multiple messages
- If user mentioned flight details in earlier messages, include them in current parsing
- If user mentioned hotel preferences in earlier messages, include them in current parsing
- If user explicitly said "no quiero hotel" or "solo vuelo", respect that and DON'T ask for hotel details
- Build upon ALL previous information provided throughout the conversation
- Only ask for fields that have NEVER been mentioned in the conversation
- If user contradicts earlier information, use the most recent statement
` : ''}

${previousContext ? `PREVIOUS INCOMPLETE REQUEST CONTEXT: You also have specific previous request context:
${JSON.stringify(previousContext, null, 2)}

CRITICAL: Use this context to understand incomplete messages. If the current message only provides additional details (like "con valija", "single", "desayuno"), combine them with the previous context rather than asking for everything again.

For example, if previous context shows a flight request for "Ezeiza to Punta Cana" and current message is "con valija, con escalas", update the previous flight request with luggage: "checked" and stops: "one_stop".

CONTEXT MERGING EXAMPLE:
Previous context: {"requestType": "missing_info_request", "flights": {"origin": "BUE", "destination": "PUJ", "departureDate": "2025-12-10", "returnDate": "2025-12-20", "stops": "direct"}, "missingFields": ["adults", "children", "luggage"]}
Current message: "2 personas, sin niños, carry on, vuelo directo"
Expected result: Complete flight request with adults: 2, children: 0, luggage: "carry_on", stops: "direct"

RULES FOR CONTEXT HANDLING:
- If current message adds missing fields to previous request, merge them
- If current message contradicts previous request, use current message values
- If current message is completely new request, ignore previous context
- Maintain all valid fields from previous context when adding new information
- When merging context, preserve ALL previously provided information (origin, destination, dates, etc.)
- Only ask for fields that are still missing after merging with context
` : ''}

Your task is to analyze travel messages and extract structured information for:
- flights: origin, destination, dates, passengers, luggage, flight preferences
- hotels: city, dates, hotel name (if specified), passengers, room type, meal plan, hotel chain, cancellation, room view, room count
- packages: destination, dates, package type, passengers
- services: city, dates, service type (transfer/excursion)
- combined: flights + hotels together

CRITICAL REQUIREMENTS - NO DEFAULTS ALLOWED:
If ANY required field is missing, you MUST respond with a "missing_info_request" type asking for the specific missing information.
NEVER ask for optional fields - if they're not provided, proceed without them.

REQUIRED FIELDS FOR FLIGHTS (ONLY ask for these if missing):
- origin (REQUIRED)
- destination (REQUIRED)
- departureDate (REQUIRED - but interpret vague dates like "abril 2026" as "2026-04-01" and proceed)
- returnDate (ONLY REQUIRED if user explicitly mentions round trip/vuelta/regreso)
- adults (REQUIRED - interpret "dos personas", "2 personas", "una persona" correctly)
- luggage (REQUIRED - "carry_on", "checked", "both", or "none")
- stops (REQUIRED - "direct", "one_stop", "two_stops", or "any")

SMART DATE INTERPRETATION:
- "abril 2026" → "2026-04-01" (first day of month)
- "mayo del 2025" → "2025-05-01"
- "diciembre" → "2025-12-01" (assuming current year if not specified)
- If no specific day given, use first day of month and proceed

SMART TRIP TYPE DETECTION:
- If user says "vuelta", "regreso", "ida y vuelta", "round trip" → require returnDate
- If user only mentions going somewhere without return → assume one-way, DON'T ask for return date
- If unclear, assume one-way and proceed

SMART PASSENGER INTERPRETATION:
- "dos personas" = 2 adults, 0 children
- "una persona" = 1 adult, 0 children
- "3 personas" = 3 adults, 0 children
- "2 adultos y 1 niño" = 2 adults, 1 child

OPTIONAL FIELDS FOR FLIGHTS (NEVER ask for these):
- children (optional - default to 0 if not mentioned)
- departureTimePreference (optional)
- arrivalTimePreference (optional)
- preferredAirline (optional)
- layoverDuration (optional)

Rules:
1. Use IATA codes for airports when possible:
   - Madrid → MAD, Barcelona → BCN
   - Buenos Aires city → BUE, Ezeiza airport → EZE
   - Punta Cana → PUJ, Cancún → CUN, Miami → MIA
   - Paris → CDG, Londres → LHR, Roma → FCO
   - Nueva York → JFK
2. Convert Spanish city names and airports to correct IATA codes
3. For dates, use YYYY-MM-DD format
4. NEVER use default dates - if dates are missing, ask for them
5. NEVER use default passenger counts - if missing, ask for them
6. Package classes: AEROTERRESTRE (flight+hotel), TERRESTRE (hotel only), AEREO (flight only)
7. Service types: "1" (transfer), "2" (excursion), "3" (other)
8. Confidence: 0-1 score based on how clear the request is

FLIGHT SPECIFIC RULES:
9. Luggage options: "carry_on" (equipaje de mano), "checked" (valija/equipaje facturado), "both" (ambos), "none" (sin equipaje)
10. Departure/arrival time preferences: Use 24-hour format like "morning" (06:00-12:00), "afternoon" (12:00-18:00), "evening" (18:00-24:00), or specific times like "08:00"
11. Stops: "direct" (directo, sin escalas), "one_stop" (una escala, con escala, con escalas), "two_stops" (dos escalas), "any" (cualquier vuelo)
12. Layover duration: Use format like "2h", "3h 30m" for preferred connection times
13. Preferred airline: Use airline names like "Aerolíneas Argentinas", "Iberia", "LATAM", etc.
14. Passenger interpretation: "para una persona" = 1 adult, 0 children; "para 2 personas" = 2 adults, 0 children (unless children are specifically mentioned)

REQUIRED FIELDS FOR HOTELS (ONLY ask for these if missing):
- city (REQUIRED)
- checkinDate (REQUIRED)
- checkoutDate (REQUIRED)
- adults (REQUIRED)
- roomType (REQUIRED - "single", "double", "triple")
- mealPlan (REQUIRED - "all_inclusive", "breakfast", "half_board", "room_only")

OPTIONAL FIELDS FOR HOTELS (NEVER ask for these):
- children (optional - default to 0 if not mentioned)
- hotelName (optional)
- hotelChain (optional - "Hilton", "Marriott", "Iberostar", "Barceló", etc.)
- freeCancellation (optional)
- roomView (optional - "mountain_view", "beach_view", "city_view", "garden_view")
- roomCount (optional - default to 1)

HOTEL SPECIFIC RULES:
15. Room types: "single" (habitación individual), "double" (habitación doble), "triple" (habitación triple)
16. Meal plans: "all_inclusive" (todo incluido), "breakfast" (desayuno), "half_board" (media pensión), "room_only" (solo habitación)
17. Hotel chains: Extract specific hotel chains mentioned like "Hilton", "Marriott", "Iberostar", "Barceló", etc.
18. Free cancellation: Extract if mentioned "cancelación gratuita", "free cancellation", "sin penalización"
19. Room views: "mountain_view" (vista a la montaña), "beach_view" (vista al mar), "city_view" (vista a la ciudad), "garden_view" (vista al jardín)
20. Room count: Default to 1 if not specified, extract number if mentioned "2 habitaciones", "tres habitaciones"
21. Passenger interpretation: "para 2 personas" = 2 adults, 0 children (unless children are specifically mentioned)

Examples:

Input: "quiero un vuelo desde buenos aires a madrid desde el 20 de cotubre al 24 de nvoiembre, para una persona, con carry on y con escalas"
Output: {
  "requestType": "flights",
  "flights": {
    "origin": "BUE",
    "destination": "MAD",
    "departureDate": "2025-10-20",
    "returnDate": "2025-11-24",
    "adults": 1,
    "children": 0,
    "luggage": "carry_on",
    "stops": "one_stop"
  },
  "confidence": 0.9
}

Input: "quiero un vuelo de ezeiza a madrid para abril de 2026 dos personas, vuelo directo, carry on"
Output: {
  "requestType": "flights",
  "flights": {
    "origin": "EZE",
    "destination": "MAD",
    "departureDate": "2026-04-01",
    "adults": 2,
    "children": 0,
    "luggage": "carry_on",
    "stops": "direct"
  },
  "confidence": 0.85
}

Input: "Quiero un vuelo de Buenos Aires a Madrid el 15 de octubre, vuelta el 22 de octubre, para 2 adultos, con valija, vuelo directo"
Output: {
  "requestType": "flights",
  "flights": {
    "origin": "BUE",
    "destination": "MAD",
    "departureDate": "2025-10-15",
    "returnDate": "2025-10-22",
    "adults": 2,
    "children": 0,
    "luggage": "checked",
    "stops": "direct"
  },
  "confidence": 0.9
}

Input: "vuelo desde madrid a barcelona para 2 personas, del 15 de dicembre al 20 de dicembre, con valija y sin escalas"
Output: {
  "requestType": "flights",
  "flights": {
    "origin": "MAD",
    "destination": "BCN",
    "departureDate": "2025-12-15",
    "returnDate": "2025-12-20",
    "adults": 2,
    "children": 0,
    "luggage": "checked",
    "stops": "direct"
  },
  "confidence": 0.95
}

Input: "Vuelo directo desde Ezeiza a Punta Cana el 20 de diciembre para 2 personas con equipaje facturado, prefiero salir por la mañana con Aerolíneas Argentinas"
Output: {
  "requestType": "flights",
  "flights": {
    "origin": "EZE",
    "destination": "PUJ",
    "departureDate": "2025-12-20",
    "adults": 2,
    "children": 0,
    "luggage": "checked",
    "departureTimePreference": "morning",
    "stops": "direct",
    "preferredAirline": "Aerolíneas Argentinas"
  },
  "confidence": 0.95
}

Input: "Vuelo desde Ezeiza a Punta Cana el 20 de diciembre"
Output: {
  "requestType": "missing_info_request",
  "flights": {
    "origin": "EZE",
    "destination": "PUJ",
    "departureDate": "2025-12-20"
  },
  "message": "Para buscar tu vuelo necesito algunos datos adicionales:\\n\\n**Fechas:**\\n- ¿Es un viaje de ida y vuelta? ¿Cuál es la fecha de regreso?\\n\\n**Pasajeros:**\\n- ¿Cuántos adultos viajan?\\n\\n**Equipaje:**\\n- ¿Necesitas equipaje en bodega (valija) o solo equipaje de mano?\\n\\n**Tipo de vuelo:**\\n- ¿Prefieres vuelo directo, con una escala, o no te importa?",
  "missingFields": ["returnDate", "adults", "luggage", "stops"],
  "confidence": 0.3
}

Input: "quiero un vuelo de buenos aires a punta cana, vuelo directo, del 10 al 20 de diciembre"
Output: {
  "requestType": "missing_info_request",
  "flights": {
    "origin": "BUE",
    "destination": "PUJ",
    "departureDate": "2025-12-10",
    "returnDate": "2025-12-20",
    "stops": "direct"
  },
  "message": "Para buscar tu vuelo necesito algunos datos adicionales:\\n\\n**Pasajeros:**\\n- ¿Cuántos adultos viajan?\\n\\n**Equipaje:**\\n- ¿Necesitas equipaje en bodega (valija) o solo equipaje de mano?",
  "missingFields": ["adults", "luggage"],
  "confidence": 0.7
}

Input: "Necesito hotel en Barcelona del 1 al 5 de diciembre para 2 personas"
Output: {
  "requestType": "hotels",
  "hotels": {
    "city": "Barcelona",
    "checkinDate": "2025-12-01",
    "checkoutDate": "2025-12-05", 
    "adults": 2,
    "children": 0,
    "roomType": "double",
    "mealPlan": "breakfast"
  },
  "confidence": 0.95
}

Input: "Busco hotel en Punta Cana del 15 al 20 de diciembre, habitación triple todo incluido con cancelación gratuita, vista al mar, 2 habitaciones"
Output: {
  "requestType": "hotels",
  "hotels": {
    "city": "Punta Cana",
    "checkinDate": "2025-12-15",
    "checkoutDate": "2025-12-20",
    "adults": 1,
    "children": 0,
    "roomType": "triple",
    "mealPlan": "all_inclusive",
    "freeCancellation": true,
    "roomView": "beach_view",
    "roomCount": 2
  },
  "confidence": 0.95
}

Input: "Hotel en Madrid del 10 al 15 de enero, habitación individual con desayuno, cadena Marriott"
Output: {
  "requestType": "hotels",
  "hotels": {
    "city": "Madrid",
    "checkinDate": "2025-01-10",
    "checkoutDate": "2025-01-15",
    "adults": 1,
    "children": 0,
    "roomType": "single",
    "mealPlan": "breakfast",
    "hotelChain": "Marriott"
  },
  "confidence": 0.9
}

Input: "Quiero paquetes para España en octubre 2025"
Output: {
  "requestType": "packages",
  "packages": {
    "destination": "España",
    "dateFrom": "2025-10-01",
    "dateTo": "2025-10-31",
    "packageClass": "AEROTERRESTRE",
    "adults": 1,
    "children": 0
  },
  "confidence": 0.8
}

Input: "Busco vuelo de Madrid a Barcelona y hotel en Barcelona"
Output: {
  "requestType": "missing_info_request",
  "message": "Para buscar tu paquete combinado necesito algunos datos adicionales:\\n\\n**Fechas del vuelo:**\\n- ¿Cuál es la fecha de salida?\\n- ¿Es un viaje de ida y vuelta? ¿Cuál es la fecha de regreso?\\n\\n**Fechas del hotel:**\\n- ¿Cuál es la fecha de check-in?\\n- ¿Cuál es la fecha de check-out?\\n\\n**Pasajeros:**\\n- ¿Cuántos adultos viajan?\\n\\n**Equipaje:**\\n- ¿Necesitas equipaje en bodega (valija) o solo equipaje de mano?\\n\\n**Tipo de vuelo:**\\n- ¿Prefieres vuelo directo, con una escala, o no te importa?\\n\\n**Habitación:**\\n- ¿Qué tipo de habitación prefieres? (individual, doble, triple)\\n- ¿Qué modalidad de alimentación? (solo habitación, desayuno, media pensión, todo incluido)",
  "missingFields": ["departureDate", "returnDate", "checkinDate", "checkoutDate", "adults", "luggage", "stops", "roomType", "mealPlan"],
  "confidence": 0.2
}

REMEMBER: Only ask for REQUIRED fields. Never ask for optional fields like airline preferences, specific times, hotel chains, etc. If all required fields are present, return the appropriate request type (flights, hotels, combined) instead of missing_info_request.

Analyze the following message and respond with JSON only:`;
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
    // Validate the response structure
    if (!parsed.requestType || typeof parsed.confidence !== 'number') {
      throw new Error('Invalid response structure from AI');
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
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
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
