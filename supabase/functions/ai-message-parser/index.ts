import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { message, language = 'es', currentDate, previousContext } = await req.json();
    if (!message) {
      throw new Error('Message is required');
    }
    console.log('🤖 AI Message Parser - Processing:', message);
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    const systemPrompt = `You are an expert travel assistant that parses Spanish travel requests and extracts structured data.

IMPORTANT: Always respond with valid JSON only. No additional text or explanation.

Current date: ${currentDate}

${previousContext ? `CONVERSATION CONTEXT: You have previous travel request context from this conversation:
${JSON.stringify(previousContext, null, 2)}

CRITICAL: Use this context to understand incomplete messages. If the current message only provides additional details (like "con valija", "single", "desayuno"), combine them with the previous context rather than asking for everything again.

For example, if previous context shows a flight request for "Ezeiza to Punta Cana" and current message is "con valija, con escalas", update the previous flight request with luggage: "checked" and stops: "one_stop".

RULES FOR CONTEXT HANDLING:
- If current message adds missing fields to previous request, merge them
- If current message contradicts previous request, use current message values
- If current message is completely new request, ignore previous context
- Maintain all valid fields from previous context when adding new information
` : ''}

Your task is to analyze travel messages and extract structured information for:
- flights: origin, destination, dates, passengers, luggage, flight preferences
- hotels: city, dates, hotel name (if specified), passengers, room type, meal plan, hotel chain, cancellation, room view, room count
- packages: destination, dates, package type, passengers
- services: city, dates, service type (transfer/excursion)
- combined: flights + hotels together

CRITICAL REQUIREMENTS - NO DEFAULTS ALLOWED:
If ANY required field is missing, you MUST respond with a "missing_info_request" type asking for the specific missing information.

REQUIRED FIELDS FOR FLIGHTS:
- origin (REQUIRED)
- destination (REQUIRED) 
- departureDate (REQUIRED)
- returnDate (REQUIRED for round trips)
- adults (REQUIRED)
- children (REQUIRED - can be 0)
- luggage (REQUIRED - "carry_on", "checked", "both", or "none")
- stops (REQUIRED - "direct", "one_stop", "two_stops", or "any")

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
11. Stops: "direct" (directo), "one_stop" (una escala), "two_stops" (dos escalas), "any" (cualquier vuelo)
12. Layover duration: Use format like "2h", "3h 30m" for preferred connection times
13. Preferred airline: Use airline names like "Aerolíneas Argentinas", "Iberia", "LATAM", etc.

HOTEL SPECIFIC RULES:
14. Room types: "single" (habitación individual), "double" (habitación doble), "triple" (habitación triple)
15. Meal plans: "all_inclusive" (todo incluido), "breakfast" (desayuno), "half_board" (media pensión), "room_only" (solo habitación)
16. Hotel chains: Extract specific hotel chains mentioned like "Hilton", "Marriott", "Iberostar", "Barceló", etc.
17. Free cancellation: Extract if mentioned "cancelación gratuita", "free cancellation", "sin penalización"
18. Room views: "mountain_view" (vista a la montaña), "beach_view" (vista al mar), "city_view" (vista a la ciudad), "garden_view" (vista al jardín)
19. Room count: Default to 1 if not specified, extract number if mentioned "2 habitaciones", "tres habitaciones"
20. NEVER use default values for adults, roomType, or mealPlan - always ask if missing

Examples:

Input: "Quiero un vuelo de Buenos Aires a Madrid el 15 de octubre"
Output: {
  "requestType": "missing_info_request",
  "message": "Para buscar tu vuelo necesito algunos datos adicionales:\n\n✈️ **Fechas:**\n- ¿Cuál es la fecha de regreso? (si es viaje de ida y vuelta)\n\n👥 **Pasajeros:**\n- ¿Cuántos adultos viajan?\n- ¿Cuántos niños viajan? (si los hay)\n\n🧳 **Equipaje:**\n- ¿Necesitas equipaje en bodega (valija) o solo equipaje de mano?\n\n✈️ **Tipo de vuelo:**\n- ¿Prefieres vuelo directo, con una escala, o no te importa?\n\n⏰ **Horarios (opcional):**\n- ¿Tienes preferencia de horario de salida o llegada?\n\n🏢 **Aerolínea (opcional):**\n- ¿Tienes alguna aerolínea preferida?",
  "missingFields": ["returnDate", "adults", "children", "luggage", "stops"],
  "confidence": 0.3
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
  "message": "Para buscar tu vuelo necesito algunos datos adicionales:\n\n✈️ **Fechas:**\n- ¿Es un viaje de ida y vuelta? ¿Cuál es la fecha de regreso?\n\n👥 **Pasajeros:**\n- ¿Cuántos adultos viajan?\n- ¿Cuántos niños viajan? (si los hay)\n\n🧳 **Equipaje:**\n- ¿Necesitas equipaje en bodega (valija) o solo equipaje de mano?\n\n✈️ **Tipo de vuelo:**\n- ¿Prefieres vuelo directo, con una escala, o no te importa?",
  "missingFields": ["returnDate", "adults", "children", "luggage", "stops"],
  "confidence": 0.3
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
  "message": "Para buscar tu paquete combinado necesito algunos datos adicionales:\n\n✈️ **Fechas del vuelo:**\n- ¿Cuál es la fecha de salida?\n- ¿Es un viaje de ida y vuelta? ¿Cuál es la fecha de regreso?\n\n🏨 **Fechas del hotel:**\n- ¿Cuál es la fecha de check-in?\n- ¿Cuál es la fecha de check-out?\n\n👥 **Pasajeros:**\n- ¿Cuántos adultos viajan?\n- ¿Cuántos niños viajan? (si los hay)\n\n🧳 **Equipaje:**\n- ¿Necesitas equipaje en bodega (valija) o solo equipaje de mano?\n\n✈️ **Tipo de vuelo:**\n- ¿Prefieres vuelo directo, con una escala, o no te importa?\n\n🏨 **Habitación:**\n- ¿Qué tipo de habitación prefieres? (individual, doble, triple)\n- ¿Qué modalidad de alimentación? (solo habitación, desayuno, media pensión, todo incluido)",
  "missingFields": ["departureDate", "returnDate", "checkinDate", "checkoutDate", "adults", "children", "luggage", "stops", "roomType", "mealPlan"],
  "confidence": 0.2
}

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
    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.error('❌ AI response was:', aiResponse);
      throw new Error('Invalid JSON response from AI');
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
