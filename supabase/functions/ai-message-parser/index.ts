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
        const requestBody = await req.json();
        const {
          message = requestBody.prompt, // Support both 'message' and 'prompt'
          language = 'es',
          currentDate = new Date().toISOString().split('T')[0], // Default to today's date (YYYY-MM-DD)
          previousContext,
          conversationHistory = []
        } = requestBody;

        if (!message) {
          throw new Error('Message or prompt is required');
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

TASK: Extract structured data for flights, hotels, packages, services, combined, or itinerary requests.

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
- "backpack": mochila, solo mochila, con mochila, item personal, bolso personal, personal item
- "carry_on": carry on, equipaje de mano, cabina, solo carry on, solo equipaje de mano, sin bodega, sin valija (NO mochila, NO bodega)
- "checked": valija, equipaje facturado, equipaje en bodega, maleta, bodega, despachado, con valija, con equipaje
- "both": ambos tipos, equipaje completo, mano y bodega, con equipaje de mano y valija
- "none": sin equipaje, nada de equipaje

🚨 **CRITICAL DISTINCTION: backpack vs carry_on vs checked:**
- "backpack": ONLY personal item/backpack (smallest, typically light fare airlines like LATAM, Avianca, JetSmart)
- "carry_on": ONLY standard cabin baggage (larger than backpack, fits in overhead bin) - NO checked baggage, NO backpack
- "checked": Flights with checked baggage in hold (may also include carry-on)
- If user says "mochila" or "item personal" → use "backpack"
- If user says "carry on" or "equipaje de mano" or "cabina" or "sin bodega" → use "carry_on"
- If user says "valija" or "bodega" or "facturado" or "maleta" → use "checked"

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

**HORARIOS DE SALIDA Y LLEGADA (departureTimePreference / arrivalTimePreference):**
🚨 **CRITICAL RULE - ONLY include when user EXPLICITLY mentions time of day:**
- Extract ONLY when user says: "que salga de noche", "que vuelva de día", "salida por la mañana", "llegada en la tarde", "que salga temprano", "que llegue de noche"
- Valid values: 'morning' (6-12h), 'afternoon' (12-18h), 'evening' (18-22h), 'night' (22-6h)
- Map Spanish to English:
  * "mañana" / "temprano" → "morning"
  * "tarde" / "mediodía" / "día" → "afternoon"
  * "noche" → "evening"
  * "madrugada" → "night"
- departureTimePreference: Aplica al primer leg (IDA)
- arrivalTimePreference: Aplica al último leg (VUELTA en round trip, o IDA en one-way)

**Examples:**
- "vuelo que salga de noche" → departureTimePreference: "evening"
- "que llegue de día" → arrivalTimePreference: "afternoon"
- "salida por la mañana y llegada en la tarde" → departureTimePreference: "morning", arrivalTimePreference: "afternoon"
- "que salga temprano" → departureTimePreference: "morning"
- "que vuelva de noche" → arrivalTimePreference: "evening"

❌ **DO NOT include if:**
- User only says "vuelo" without time reference
- User mentions flight type ("directo", "con escalas") but NOT time
- Example: "vuelo directo" → NO departureTimePreference/arrivalTimePreference fields
- Example: "vuelo a madrid" → NO time fields

**COMBINED SEARCH TRIGGERS:**
- "vuelo y hotel", "con hotel", "hotel incluido", "paquete", "agrega hotel"

## 🗺️ ITINERARY REQUEST DETECTION (CRITICAL NEW FEATURE)

**ITINERARY INTENTION DETECTION:**
If the user wants to plan activities/things to do in a destination WITHOUT booking flights or hotels, classify as requestType: "itinerary"

**Itinerary Keywords (Spanish):**
- itinerario, plan de viaje, ruta de viaje, agenda de viaje, cronograma
- qué hacer en, qué visitar en, qué ver en, lugares para visitar
- organiza mi viaje, arma mi viaje, planifica mi viaje, armame un plan
- actividades en, recorrido por, tour por

**Itinerary Keywords (English):**
- itinerary, travel plan, trip plan, travel route, schedule
- what to do in, what to visit, what to see, places to visit
- plan my trip, organize my trip

**Itinerary Request Patterns:**
- "Armame un itinerario de X días para [destino]"
- "Plan de viaje de X días por [país/ciudad]"
- "Qué puedo hacer en [ciudad] durante X días?"
- "Necesito un itinerario para mi viaje a [destino]"
- "Organiza mi viaje de X días por [lista de lugares]"
- "Ruta de X días por [destino]"
- "Dame actividades para X días en [ciudad]"

**Duration Extraction:**
- Numbers: "5 días", "10 days", "3 noches"
- Words: "una semana" = 7, "dos semanas" = 14, "un fin de semana" = 2
- Phrases: "fin de semana largo" = 3, "puente" = 3-4

**Destination Extraction:**
- Single city: "Roma", "Barcelona", "Tokyo"
- Single country: "Italia", "España", "Japón"
- Multiple destinations: "Italia y Francia", "Madrid, Barcelona y Valencia"
- Regions: "Europa", "Patagonia", "Caribe"

**CRITICAL: Itinerary vs Flights/Hotels Distinction:**
- If user mentions "vuelo", "hotel", "reservar", "cotizar" → NOT itinerary, use flights/hotels/combined
- If user ONLY asks for activities/plans/what to do → itinerary
- Itinerary is for PLANNING, not BOOKING

**ITINERARY Required Fields:**
- destinations: array of destination names (cities, countries, or regions)
- days: number of days for the trip

**ITINERARY Examples:**

Example A - Basic itinerary request:
User: "Armame un itinerario de 5 días para Roma"
{
  "requestType": "itinerary",
  "itinerary": {
    "destinations": ["Roma"],
    "days": 5
  },
  "confidence": 0.95
}

Example B - Multiple destinations:
User: "Plan de viaje de 10 días por Italia y Francia"
{
  "requestType": "itinerary",
  "itinerary": {
    "destinations": ["Italia", "Francia"],
    "days": 10
  },
  "confidence": 0.95
}

Example C - Question format:
User: "Qué puedo hacer en Barcelona durante una semana?"
{
  "requestType": "itinerary",
  "itinerary": {
    "destinations": ["Barcelona"],
    "days": 7
  },
  "confidence": 0.9
}

Example D - Missing days (ask for info):
User: "Quiero un itinerario para Madrid"
{
  "requestType": "itinerary",
  "itinerary": {
    "destinations": ["Madrid"],
    "days": null
  },
  "missingFields": ["days"],
  "message": "Para armar tu itinerario de viaje a Madrid, necesito saber:\\n\\n**¿Cuántos días durará tu viaje?**\\n\\nPor ejemplo: '5 días', 'una semana', '10 días'",
  "confidence": 0.7
}

Example E - Missing destination (ask for info):
User: "Armame un plan de viaje de 7 días"
{
  "requestType": "itinerary",
  "itinerary": {
    "destinations": [],
    "days": 7
  },
  "missingFields": ["destinations"],
  "message": "Para armar tu itinerario de 7 días, necesito saber:\\n\\n**¿A qué destino(s) quieres viajar?**\\n\\nPor ejemplo: 'Roma', 'Italia y Francia', 'Barcelona, Madrid y París'",
  "confidence": 0.7
}

## REQUIRED FIELDS AND DEFAULTS

**FLIGHTS:**
- Required: origin, destination, departureDate
- Optional: returnDate (only if round trip mentioned)
- **DEFAULT: adults = 1** (if not specified, always assume 1 adult)
- children = 0 (default if not specified) - Niños de 2-12 años
- infants = 0 (default if not specified) - Bebés/infantes de 0-2 años (viajan en brazos)

**HOTELS:**
- Required: city, checkinDate, checkoutDate
- **DEFAULT: adults = 1** (if not specified, always assume 1 adult)
- children = 0 (default if not specified) - Niños de 2-12 años
- infants = 0 (default if not specified) - Bebés/infantes de 0-2 años
- roomType, mealPlan (OPTIONAL - ONLY include if user explicitly mentions them)

🚨 **CRITICAL HOTEL PREFERENCE RULES - READ CAREFULLY:**
- **roomType**: ONLY include if user explicitly mentions room type/capacity
  * **Be VERY tolerant with spelling variations - accept ALL these patterns:**
    - WITH accents: "habitación simple", "habitación doble", "habitación triple"
    - WITHOUT accents: "habitacion simple", "habitacion doble", "habitacion triple"
    - Abbreviated: "hab simple", "hab doble", "hab triple"
    - Just the type: "simple", "doble", "double", "triple", "sencilla", "individual"
    - English: "single room", "double room", "triple room"
  * If user says NOTHING about room type → DO NOT include roomType field
  * Map all variations to standard enum: 'single', 'double', 'triple'
  * Examples:
    - "hotel en Cancún" → NO roomType ❌
    - "habitación doble en Cancún" → roomType: "double" ✅
    - "habitacion doble en Cancún" → roomType: "double" ✅ (no accent is OK!)
    - "hab doble en Cancún" → roomType: "double" ✅
    - "doble en Cancún" → roomType: "double" ✅
- **mealPlan**: ONLY include if user explicitly mentions food/meal preferences IN THE CURRENT MESSAGE
  * ✅ **Include mealPlan ONLY IF these keywords appear in CURRENT message:**
    - "all inclusive", "todo incluido", "all-inclusive", "all inc"
    - "desayuno", "breakfast", "con desayuno"
    - "media pensión", "media pension", "half board"
    - "solo alojamiento", "solo habitacion", "room only", "sin comida"
  * ❌ **DO NOT include mealPlan if:**
    - User only says "hotel" or "habitación" without food keywords
    - User mentions ONLY room type ("habitación doble") but NO meal plan
    - Previous conversation mentioned meals but CURRENT message does NOT
  * Examples:
    - "hotel en Cancún" → NO mealPlan ❌
    - "habitación doble en Cancún" → NO mealPlan ❌
    - "hotel all inclusive" → mealPlan: "all_inclusive" ✅
    - "habitación doble con desayuno" → roomType: "double", mealPlan: "breakfast" ✅

🚨 **ULTRA-STRICT RULE FOR mealPlan:**
You MUST scan the CURRENT user message for these EXACT keywords before including mealPlan:
- Scan message for: "incluido", "inclusive", "desayuno", "breakfast", "pensión", "pension", "board", "comida", "alojamiento"
- If NONE of these keywords found → DO NOT include mealPlan field AT ALL
- NEVER infer mealPlan from context, previous messages, or assumptions
- ONLY include if user EXPLICITLY types food/meal keywords in THIS message

🏨 **HOTEL CHAIN DETECTION (hotelChains) - MULTIPLE CHAINS SUPPORT:**
Detect hotel chains when user mentions them. ONLY include hotelChains if user explicitly mentions one or more chains.

**IMPORTANT:** The field is now hotelChains (PLURAL), which is an array of strings.

**Patterns to detect:**
- Single chain: "cadena [nombre]", "de la cadena [nombre]", "chain [nombre]"
- Multiple chains: "cadena [nombre1] y [nombre2]", "hoteles [nombre1] o [nombre2]"
- Direct chain mentions: "quiero un Riu", "un Iberostar", "hotel Melia"

**Separators to detect multiple chains:**
- "y", "e", "and" → ["Riu", "Iberostar"]
- "o", "or" → ["Riu", "Iberostar"]
- "," (comas) → ["Riu", "Iberostar", "Melia"]
- "/" (slash) → ["Riu", "Iberostar"]
- "&" (ampersand) → ["Riu", "Iberostar"]

**Known hotel chains (case-insensitive):**
- Riu, RIU Hotels, RIU Palace, RIU Resorts
- Iberostar, Iberoestars
- Melia, Meliá, Sol Melia, ME by Melia, Tryp
- Bahia Principe, Bahía Príncipe, Grand Bahia Principe
- Barcelo, Barceló, Occidental
- NH, NH Hotels, NH Collection
- Hilton, DoubleTree, Hampton Inn, Waldorf Astoria
- Marriott, Sheraton, Westin, Ritz Carlton
- Hyatt, Grand Hyatt, Park Hyatt
- Accor, Novotel, Ibis, Sofitel
- Sunscape, Hard Rock, Excellence, Secrets, Dreams
- Palace Resorts, Moon Palace, Le Blanc
- Sandals, Club Med, Royalton, Breathless
- Now Resorts, Catalonia, Princess Hotels

**Examples:**
- "hotel de la cadena Riu" → hotelChains: ["Riu"] ✅
- "hoteles Iberostar" → hotelChains: ["Iberostar"] ✅
- "quiero un Melia" → hotelChains: ["Melia"] ✅
- "hotel en Cancún" → NO hotelChains (no chain mentioned) ❌
- "habitación doble all inclusive en la CADENA riu" → hotelChains: ["Riu"], roomType: "double", mealPlan: "all_inclusive" ✅
- "quiero cadena riu y iberostar" → hotelChains: ["Riu", "Iberostar"] ✅ (MULTIPLE CHAINS)
- "hoteles de la cadena Riu, Iberostar o Melia" → hotelChains: ["Riu", "Iberostar", "Melia"] ✅ (MULTIPLE CHAINS)
- "cadena Barcelo/NH" → hotelChains: ["Barcelo", "NH"] ✅ (MULTIPLE CHAINS)

🏨 **SPECIFIC HOTEL NAME DETECTION (hotelName) - NEW FEATURE:**
Detect specific hotel names when user mentions them. ONLY include hotelName if user explicitly mentions a specific hotel.

**Patterns to detect:**
- "en el hotel [nombre completo]"
- "hotel [nombre específico]" (when it's a specific hotel, not just a chain)
- "[nombre de hotel]" with chain + specific name (e.g., "Riu Bambu", "Iberostar Dominicana")

**Examples:**
- "en el hotel Riu Bambu" → hotelName: "Riu Bambu", hotelChain: "Riu" ✅
- "quiero el Iberostar Dominicana" → hotelName: "Iberostar Dominicana", hotelChain: "Iberostar" ✅
- "hotel Bahia Principe Grand Punta Cana" → hotelName: "Bahia Principe Grand Punta Cana", hotelChain: "Bahia Principe" ✅
- "hotel en Cancún" → NO hotelName ❌

**IMPORTANT:** When extracting hotelName, if it contains a chain name, also extract hotelChain.

## 🚗 TRASLADOS (TRANSFERS) DETECTION

**TRANSFER INTENTION DETECTION:**
Detect when user requests airport-hotel transportation services.

**Transfer Keywords (Spanish):**
- traslado, traslados, transfer, transfers
- aeropuerto al hotel, hotel al aeropuerto
- transfer in, transfer out, in/out
- transporte, transporte incluido, con transporte
- pickup, recogida, recoger en aeropuerto

**Transfer Keywords (English):**
- transfer, transfers, shuttle
- airport transfer, hotel transfer
- transportation, transport
- pickup, drop-off

**Transfer Types:**
- "transfer in" / "traslado de entrada" / "aeropuerto al hotel" → type: "in"
- "transfer out" / "traslado de salida" / "hotel al aeropuerto" → type: "out"
- "transfer in/out" / "traslados" / "con traslados" → type: "in_out" (DEFAULT when no specific type mentioned)

**CRITICAL RULE: ONLY include transfers field if user EXPLICITLY mentions transfer/traslado keywords**

**transfers Required Fields:**
- included: boolean (true if user mentioned transfers)
- type: 'in' | 'out' | 'in_out' (optional, default: 'in_out' if not specified)

**Transfer Examples:**

Example A - Generic transfers request:
User: "Vuelo a Punta Cana con traslados incluidos"
{
  "requestType": "flights",
  "flights": { ... },
  "transfers": {
    "included": true,
    "type": "in_out"
  }
}

Example B - Specific transfer type:
User: "Hotel en Cancún con transfer del aeropuerto al hotel"
{
  "requestType": "hotels",
  "hotels": { ... },
  "transfers": {
    "included": true,
    "type": "in"
  }
}

Example C - NO transfers (user didn't mention):
User: "Vuelo a Miami"
{
  "requestType": "flights",
  "flights": { ... }
}
❌ NOTE: NO transfers field because user didn't mention traslados/transfers!

## 🏥 SEGURO / ASISTENCIA MÉDICA (TRAVEL ASSISTANCE) DETECTION

**TRAVEL ASSISTANCE INTENTION DETECTION:**
Detect when user requests travel insurance or medical assistance coverage.

**Assistance Keywords (Spanish):**
- seguro, seguros, seguro de viaje
- asistencia, asistencia médica, asistencia al viajero
- cobertura, cobertura médica
- assist card, assistance card
- con seguro, incluye seguro

**Assistance Keywords (English):**
- insurance, travel insurance
- medical assistance, travel assistance
- coverage, medical coverage
- assistance card

**Coverage Amount Extraction:**
- Look for amounts like "seguro de USD 50000", "cobertura de 100000 dólares"
- Extract numeric value if specified

**CRITICAL RULE: ONLY include travelAssistance field if user EXPLICITLY mentions seguro/asistencia/insurance keywords**

**travelAssistance Required Fields:**
- included: boolean (true if user mentioned insurance/assistance)
- coverageAmount: number (optional, only if user specified amount)

**Travel Assistance Examples:**

Example A - Basic insurance request:
User: "Vuelo a Europa con seguro de viaje"
{
  "requestType": "flights",
  "flights": { ... },
  "travelAssistance": {
    "included": true
  }
}

Example B - Insurance with coverage amount:
User: "Necesito asistencia médica de USD 50000 para mi viaje"
{
  "requestType": "combined",
  "flights": { ... },
  "travelAssistance": {
    "included": true,
    "coverageAmount": 50000
  }
}

Example C - NO insurance (user didn't mention):
User: "Vuelo a Madrid"
{
  "requestType": "flights",
  "flights": { ... }
}
❌ NOTE: NO travelAssistance field because user didn't mention seguro/asistencia!

Example D - Combined with transfers:
User: "Paquete a Cancún todo incluido con traslados y seguro de viaje"
{
  "requestType": "combined",
  "flights": { ... },
  "hotels": { ... },
  "transfers": {
    "included": true,
    "type": "in_out"
  },
  "travelAssistance": {
    "included": true
  }
}

**COMBINED:** All flight + hotel required fields with same defaults

**ITINERARY:**
- Required: destinations (array of strings, at least 1), days (number > 0)
- If either is missing, set requestType to "itinerary" but include missingFields array and message

**IMPORTANT PASSENGER RULES:**
1. If NO passenger count mentioned → adults = 1, children = 0, infants = 0
2. If "para 2" or "2 personas" mentioned → adults = 2, children = 0, infants = 0
3. If "con un niño" mentioned → adults = 1, children = 1, infants = 0
4. If "familia de 4" mentioned → infer adults = 2, children = 2, infants = 0
5. NEVER ask for passenger count if not mentioned - default to 1 adult

**INFANT/BABY DETECTION RULES (0-2 años):**
Detect infants when user mentions babies. Keywords to detect:
- "bebé", "bebe", "bebés", "bebes"
- "infante", "infantes"
- "lactante", "lactantes"
- "menor de 2 años", "menor de dos años"
- "en brazos"
- "baby", "babies", "infant"

**Examples:**
- "2 adultos y 1 bebé" → adults = 2, children = 0, infants = 1
- "vuelo para familia con un niño y un bebé" → adults = 2, children = 1, infants = 1
- "3 adultos, 2 niños y 1 infante" → adults = 3, children = 2, infants = 1
- "con un menor de 2 años" → infants = 1
- "niño en brazos" → infants = 1

**IMPORTANT INFANT RESTRICTION:**
- Infants (0-2 años) travel on adult's lap - MAX 1 infant per adult
- If infants > adults, warn or adjust: "Necesitas 1 adulto por cada bebé"

**CHILDREN vs INFANTS DISTINCTION:**
- "niño", "niños", "menor", "menores", "chico", "chicos", "hijo", "hijos" (without age) → children (2-12 años)
- "bebé", "bebe", "infante", "menor de 2", "en brazos" → infants (0-2 años)
- If user specifies age: "niño de 5 años" → children; "niño de 1 año" → infants

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
    "infants": 0,
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
    "infants": 0,
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
    "infants": 0,
    "luggage": "checked",
    "stops": "one_stop",
    "maxLayoverHours": 3,
    "preferredAirline": "[CODIGO_AEROLINEA]",
    "departureTimePreference": "morning",
    "arrivalTimePreference": "afternoon"
  },
  "confidence": 0.9
}

Example 3b - Flight with children and infant:
User: "Vuelo de Buenos Aires a Miami para 2 adultos, 1 niño y 1 bebé"
{
  "requestType": "flights",
  "flights": {
    "origin": "Buenos Aires",
    "destination": "Miami",
    "departureDate": "[FECHA_SALIDA]",
    "adults": 2,
    "children": 1,
    "infants": 1,
    "stops": "any"
  },
  "confidence": 0.95
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
    "children": 0,
    "infants": 0
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
    "infants": 0,
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
- Previous flight adults/children/infants → becomes hotel adults/children/infants

User: "también quiero hotel para esas fechas" (after previous flight search)
{
  "requestType": "hotels",
  "hotels": {
    "city": "[EXTRACT from previous flight DESTINATION]",
    "checkinDate": "[EXTRACT from previous flight DEPARTURE DATE]",
    "checkoutDate": "[EXTRACT from previous flight RETURN DATE]",
    "adults": "[EXTRACT from current message OR previous flight]",
    "children": "[EXTRACT from current message OR previous flight OR 0]",
    "infants": "[EXTRACT from current message OR previous flight OR 0]"
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
    "infants": 0,
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
    "children": "[EXTRACT from previous flight OR 0]",
    "infants": "[EXTRACT from previous flight OR 0]"
  },
  "confidence": 0.9
}
❌ NOTE: NO roomType or mealPlan unless user explicitly mentioned them!

Example 10 - Combined flight + hotel WITHOUT meal plan (CRITICAL - REAL USER CASE):
User: "quiero un vuelo desde buenos aires a cancun para dos personas desde el 5 de enero al 15 de enero con escala de menos de 3 horas tambien quiero un hotel habitacion doble para ambas fechas"
{
  "requestType": "combined",
  "flights": {
    "origin": "Buenos Aires",
    "destination": "Cancún",
    "departureDate": "2026-01-05",
    "returnDate": "2026-01-15",
    "adults": 2,
    "children": 0,
    "infants": 0,
    "stops": "any",
    "maxLayoverHours": 3
  },
  "hotels": {
    "city": "Cancún",
    "checkinDate": "2026-01-05",
    "checkoutDate": "2026-01-15",
    "adults": 2,
    "children": 0,
    "infants": 0,
    "roomType": "double"
  },
  "confidence": 0.95
}
❌ CRITICAL: NO mealPlan because user ONLY said "habitacion doble" without mentioning food/meals!
✅ roomType: "double" is included because user said "habitacion doble" (WITHOUT accent - this is OK!)
🚨 IMPORTANT: Accept "habitacion" (no accent) as valid - users often omit accents!

Example 11 - Hotel with room type but NO meal (to reinforce - WITHOUT accents):
User: "habitacion doble en cancun para 2 personas"
{
  "requestType": "hotels",
  "hotels": {
    "city": "Cancún",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 2,
    "children": 0,
    "infants": 0,
    "roomType": "double"
  },
  "confidence": 0.9
}
❌ NO mealPlan - user mentioned "habitacion doble" but did NOT mention meals!
✅ roomType: "double" - detected "habitacion doble" even WITHOUT accent on "habitacion"

Example 12 - Hotel with CHAIN specified (NEW - hotelChains extraction):
User: "quiero un hotel de la cadena Riu all inclusive habitacion doble"
{
  "requestType": "hotels",
  "hotels": {
    "city": "[EXTRACT from context OR ask]",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 2,
    "children": 0,
    "infants": 0,
    "roomType": "double",
    "mealPlan": "all_inclusive",
    "hotelChains": ["Riu"]
  },
  "confidence": 0.95
}
✅ hotelChains: ["Riu"] - user said "cadena Riu"
✅ mealPlan: "all_inclusive" - user said "all inclusive"
✅ roomType: "double" - user said "habitacion doble"

Example 12b - Hotel with MULTIPLE CHAINS (NEW - hotelChains array):
User: "quiero cadena riu y iberostar all inclusive habitacion doble"
{
  "requestType": "hotels",
  "hotels": {
    "city": "[EXTRACT from context OR ask]",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 2,
    "children": 0,
    "infants": 0,
    "roomType": "double",
    "mealPlan": "all_inclusive",
    "hotelChains": ["Riu", "Iberostar"]
  },
  "confidence": 0.95
}
✅ hotelChains: ["Riu", "Iberostar"] - user said "cadena riu y iberostar"
✅ mealPlan: "all_inclusive" - user said "all inclusive"
✅ roomType: "double" - user said "habitacion doble"

Example 13 - Hotel with SPECIFIC NAME and CHAIN (NEW - hotelName + hotelChains):
User: "quiero reservar el hotel Riu Bambu en Punta Cana"
{
  "requestType": "hotels",
  "hotels": {
    "city": "Punta Cana",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 1,
    "children": 0,
    "infants": 0,
    "hotelName": "Riu Bambu",
    "hotelChains": ["Riu"]
  },
  "confidence": 0.95
}
✅ hotelName: "Riu Bambu" - user specified exact hotel
✅ hotelChains: ["Riu"] - extracted from hotel name (Riu Bambu contains "Riu")
❌ NO roomType or mealPlan - user didn't mention them

Example 14 - Hotel chain with context from previous flight (CRITICAL PATTERN):
User: "para las mismas fechas quiero un hotel Iberostar habitacion doble"
{
  "requestType": "hotels",
  "hotels": {
    "city": "[EXTRACT from previous flight DESTINATION]",
    "checkinDate": "[EXTRACT from previous flight DEPARTURE DATE]",
    "checkoutDate": "[EXTRACT from previous flight RETURN DATE]",
    "adults": "[EXTRACT from previous flight]",
    "children": "[EXTRACT from previous flight OR 0]",
    "infants": "[EXTRACT from previous flight OR 0]",
    "roomType": "double",
    "hotelChains": ["Iberostar"]
  },
  "confidence": 0.95
}
✅ hotelChains: ["Iberostar"] - user said "hotel Iberostar"
✅ roomType: "double" - user said "habitacion doble"
❌ NO mealPlan - user didn't mention food/meals

Example 15 - Chain mention with typos/variations (TOLERANCE):
User: "hotel melia todo incluido doble" or "hoteles meliá" or "un sol melia"
{
  "requestType": "hotels",
  "hotels": {
    "city": "[EXTRACT from context]",
    "checkinDate": "[DATE]",
    "checkoutDate": "[DATE]",
    "adults": 2,
    "children": 0,
    "infants": 0,
    "roomType": "double",
    "mealPlan": "all_inclusive",
    "hotelChains": ["Melia"]
  },
  "confidence": 0.9
}
✅ hotelChains: ["Melia"] - recognize "melia", "meliá", "sol melia" as the same chain
🚨 NOTE: Be tolerant with accents and variations (melia = meliá = sol melia)

🚨 CRITICAL FINAL INSTRUCTION:
- The examples above show PATTERNS and STRUCTURES only
- You MUST extract actual values from the REAL conversation history provided above, NOT from the examples
- NEVER use example cities (Miami, Punta Cana) or example dates unless they appear in the ACTUAL conversation
- Always use [EXTRACT from X] placeholders as instructions to extract from REAL conversation history
- Your response must reflect the ACTUAL user request and ACTUAL conversation context

🚨 FINAL REMINDER - mealPlan RULE:
Before including "mealPlan" field in your JSON response, ask yourself:
1. Did the user type ANY of these words in the CURRENT message? "incluido", "inclusive", "desayuno", "breakfast", "pensión", "pension", "board", "comida", "alojamiento"
2. If answer is NO → DO NOT include "mealPlan" field in JSON
3. If answer is YES → Include "mealPlan" with appropriate value

Examples to verify your understanding:
- "hotel habitacion doble" → NO food keywords → NO mealPlan field ❌
- "habitacion doble all inclusive" → "inclusive" keyword found → mealPlan: "all_inclusive" ✅
- "hotel con desayuno" → "desayuno" keyword found → mealPlan: "breakfast" ✅

🚨 FINAL REMINDER - roomType TOLERANCE:
Be EXTREMELY tolerant with spelling variations for room types:
- "habitacion doble" (no accent) = "habitación doble" (with accent) → roomType: "double" ✅
- "hab doble" = "habitación doble" → roomType: "double" ✅
- "doble" alone (in hotel context) → roomType: "double" ✅
- Users OFTEN omit accents - this is NORMAL and VALID!

🚨 FINAL REMINDER - hotelChains RULE (PLURAL ARRAY):
Before including "hotelChains" field in your JSON response:
1. Did the user mention ANY hotel chain by name? (Riu, Iberostar, Melia, Bahia Principe, Barcelo, NH, Hilton, Marriott, etc.)
2. Did the user use patterns like "cadena [name]", "hoteles [name]", "de la cadena [name]"?
3. Did the user mention MULTIPLE chains? (e.g., "riu y iberostar", "Melia o Barcelo")
4. If YES to any → Include hotelChains as an ARRAY with ALL mentioned chain names
5. If NO → DO NOT include hotelChains field

Examples to verify:
- "hotel en Cancún" → NO chain mentioned → NO hotelChains field ❌
- "hotel Riu en Cancún" → "Riu" is a chain → hotelChains: ["Riu"] ✅
- "cadena Iberostar" → explicit chain mention → hotelChains: ["Iberostar"] ✅
- "un Melia todo incluido" → "Melia" is a chain → hotelChains: ["Melia"] ✅
- "cadena riu y iberostar" → MULTIPLE chains → hotelChains: ["Riu", "Iberostar"] ✅
- "hoteles Melia, Barcelo o NH" → MULTIPLE chains → hotelChains: ["Melia", "Barcelo", "NH"] ✅

🚨 FINAL REMINDER - hotelName RULE:
Before including "hotelName" field in your JSON response:
1. Did the user mention a SPECIFIC hotel name (not just a chain)?
2. Specific names include: "Riu Bambu", "Iberostar Dominicana", "Bahia Principe Grand Punta Cana", etc.
3. If YES → Include hotelName AND also extract hotelChains from the name (as array)
4. If user only mentions chain (e.g., "Riu") without specific hotel → ONLY hotelChains, NO hotelName

Examples:
- "hotel Riu" → only chain → hotelChains: ["Riu"], NO hotelName ❌
- "hotel Riu Bambu" → specific hotel → hotelName: "Riu Bambu", hotelChains: ["Riu"] ✅
- "Iberostar Dominicana" → specific hotel → hotelName: "Iberostar Dominicana", hotelChains: ["Iberostar"] ✅

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
