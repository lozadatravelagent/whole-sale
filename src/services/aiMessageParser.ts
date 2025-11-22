import { supabase } from '@/integrations/supabase/client';

export interface ParsedTravelRequest {
    requestType: 'flights' | 'hotels' | 'packages' | 'services' | 'combined' | 'general' | 'missing_info_request';
    flights?: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        adults: number;
        children: number;
        // Nuevos campos requeridos
        luggage?: 'carry_on' | 'checked' | 'both' | 'none'; // con o sin valija/equipaje
        departureTimePreference?: string; // horario de salida preferido
        arrivalTimePreference?: string; // horario de llegada preferido  
        stops?: 'direct' | 'one_stop' | 'two_stops' | 'with_stops' | 'any'; // vuelo directo o con escalas
        layoverDuration?: string; // tiempo de escala preferido (ej: "3 hours", "10 hours")
        maxLayoverHours?: number; // duración máxima de escalas en horas
        preferredAirline?: string; // aerolínea preferida
    };
    hotels?: {
        city: string;
        hotelName?: string;
        checkinDate: string;
        checkoutDate: string;
        adults: number;
        children: number;
        // Campos opcionales de preferencias
        roomType?: 'single' | 'double' | 'triple'; // Tipo de habitación (OPCIONAL - solo filtrar si usuario lo especifica)
        hotelChain?: string; // Cadena hotelera (opcional)
        mealPlan?: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only'; // Modalidad de alimentación (OPCIONAL - solo filtrar si usuario lo especifica)
        freeCancellation?: boolean; // Cancelación gratuita (opcional)
        roomView?: 'mountain_view' | 'beach_view' | 'city_view' | 'garden_view'; // Tipo de habitación (opcional)
        roomCount?: number; // Cantidad de habitaciones (opcional, default 1)
    };
    packages?: {
        destination: string;
        dateFrom: string;
        dateTo: string;
        packageClass: 'AEROTERRESTRE' | 'TERRESTRE' | 'AEREO';
        adults: number;
        children: number;
    };
    services?: {
        city: string;
        dateFrom: string;
        dateTo?: string;
        serviceType: '1' | '2' | '3'; // 1=Transfer, 2=Excursion, 3=Other
    };
    confidence: number; // 0-1 score of parsing confidence
    originalMessage: string;
    // Fields for missing_info_request
    message?: string;
    missingFields?: string[];
    missingRequiredFields?: string[]; // Campos requeridos que faltan
    needsMoreInfo?: boolean; // Si necesita más información del usuario
}

// Interfaz para campos requeridos de vuelos
export interface RequiredFlightFields {
    origin: boolean;
    destination: boolean;
    departureDate: boolean;
    adults: boolean;
    luggage: boolean;
    stops: boolean;
}

// Interfaz para campos requeridos de hoteles
export interface RequiredHotelFields {
    city: boolean;
    checkinDate: boolean;
    checkoutDate: boolean;
    adults: boolean;
    roomType: boolean;
    mealPlan: boolean;
}

// Función para validar campos requeridos de vuelos
export function validateFlightRequiredFields(flights?: ParsedTravelRequest['flights']): {
    isValid: boolean;
    missingFields: string[];
    missingFieldsSpanish: string[];
} {
    if (!flights) {
        return {
            isValid: false,
            missingFields: ['origin', 'destination', 'departureDate', 'adults'],
            missingFieldsSpanish: ['origen', 'destino', 'fecha de salida', 'cantidad de pasajeros']
        };
    }

    const missingFields: string[] = [];
    const missingFieldsSpanish: string[] = [];

    // Validar campos requeridos
    if (!flights.origin) {
        missingFields.push('origin');
        missingFieldsSpanish.push('origen');
    }
    if (!flights.destination) {
        missingFields.push('destination');
        missingFieldsSpanish.push('destino');
    }
    if (!flights.departureDate) {
        missingFields.push('departureDate');
        missingFieldsSpanish.push('fecha de salida');
    }
    if (!flights.adults || flights.adults < 1) {
        missingFields.push('adults');
        missingFieldsSpanish.push('cantidad de pasajeros');
    }

    return {
        isValid: missingFields.length === 0,
        missingFields,
        missingFieldsSpanish
    };
}

// Función para validar campos requeridos de hoteles
export function validateHotelRequiredFields(hotels?: ParsedTravelRequest['hotels']): {
    isValid: boolean;
    missingFields: string[];
    missingFieldsSpanish: string[];
} {
    if (!hotels) {
        return {
            isValid: false,
            missingFields: ['city', 'checkinDate', 'checkoutDate', 'adults'],
            missingFieldsSpanish: ['destino', 'fecha de entrada', 'fecha de salida', 'cantidad de pasajeros']
        };
    }

    const missingFields: string[] = [];
    const missingFieldsSpanish: string[] = [];

    // Validar campos requeridos (roomType y mealPlan son OPCIONALES)
    if (!hotels.city) {
        missingFields.push('city');
        missingFieldsSpanish.push('destino');
    }
    if (!hotels.checkinDate) {
        missingFields.push('checkinDate');
        missingFieldsSpanish.push('fecha de entrada');
    }
    if (!hotels.checkoutDate) {
        missingFields.push('checkoutDate');
        missingFieldsSpanish.push('fecha de salida');
    }
    if (!hotels.adults || hotels.adults < 1) {
        missingFields.push('adults');
        missingFieldsSpanish.push('cantidad de pasajeros');
    }
    // roomType y mealPlan son OPCIONALES - no validamos

    return {
        isValid: missingFields.length === 0,
        missingFields,
        missingFieldsSpanish
    };
}

// Función para generar mensaje solicitando información faltante
export function generateMissingInfoMessage(missingFieldsSpanish: string[], requestType: string): string {
    const baseMessage = requestType === 'flights'
        ? 'Para buscar los mejores vuelos, necesito que me proporciones la siguiente información:'
        : requestType === 'hotels'
            ? 'Para buscar los mejores hoteles, necesito que me proporciones la siguiente información:'
            : 'Para buscar las mejores opciones de viaje, necesito que me proporciones la siguiente información:';

    const fieldsList = missingFieldsSpanish.map((field, index) =>
        `${index + 1}. **${field.charAt(0).toUpperCase() + field.slice(1)}**`
    ).join('\n');

    const examples = generateFieldExamples(missingFieldsSpanish);

    return `${baseMessage}

${fieldsList}

${examples}

Por favor, proporciona esta información para que pueda hacer una búsqueda más precisa. 😊`;
}

// Función para generar ejemplos de los campos faltantes
function generateFieldExamples(missingFieldsSpanish: string[]): string {
    const examples: string[] = [];

    missingFieldsSpanish.forEach(field => {
        switch (field) {
            case 'origen':
                examples.push('📍 **Origen:** Por ejemplo: "Buenos Aires", "Madrid", "Ezeiza"');
                break;
            case 'destino':
                examples.push('🎯 **Destino:** Por ejemplo: "Punta Cana", "Barcelona", "Miami"');
                break;
            case 'fecha de salida':
                examples.push('📅 **Fecha de salida:** Por ejemplo: "15 de diciembre", "2025-12-15"');
                break;
            case 'cantidad de pasajeros':
                examples.push('👥 **Pasajeros:** Por ejemplo: "2 adultos", "1 persona", "3 adultos"');
                break;
            case 'equipaje (con o sin valija)':
                examples.push('🧳 **Equipaje:** Por ejemplo: "con valija", "solo equipaje de mano", "sin equipaje"');
                break;
            case 'tipo de vuelo (directo o con escalas)':
                examples.push('✈️ **Tipo de vuelo:** Por ejemplo: "vuelo directo", "con una escala", "cualquier vuelo"');
                break;
            // Ejemplos para hoteles
            case 'destino':
                examples.push('🏨 **Destino:** Por ejemplo: "Punta Cana", "Barcelona", "Miami"');
                break;
            case 'fecha de entrada':
                examples.push('📅 **Fecha de entrada:** Por ejemplo: "15 de diciembre", "2025-12-15"');
                break;
            case 'fecha de salida':
                examples.push('📅 **Fecha de salida:** Por ejemplo: "20 de diciembre", "2025-12-20"');
                break;
            case 'cantidad de pasajeros':
                examples.push('👥 **Pasajeros:** Por ejemplo: "2 adultos", "1 persona", "3 adultos"');
                break;
            case 'tipo de habitación (single, double, triple)':
                examples.push('🛏️ **Tipo de habitación:** Por ejemplo: "single", "double", "triple"');
                break;
            case 'modalidad de alimentación (all inclusive, desayuno, media pensión)':
                examples.push('🍽️ **Modalidad:** Por ejemplo: "all inclusive", "con desayuno", "media pensión"');
                break;
        }
    });

    if (examples.length > 0) {
        return '**Ejemplos:**\n\n' + examples.join('\n\n');
    }

    return '';
}

/**
 * Combines previous parsed request with new information from user message
 */
export function combineWithPreviousRequest(
    previousRequest: ParsedTravelRequest | null,
    newMessage: string,
    parsedNewRequest: ParsedTravelRequest
): ParsedTravelRequest {
    if (!previousRequest) {
        return parsedNewRequest;
    }

    // If request types don't match, return the new request
    if (previousRequest.requestType !== parsedNewRequest.requestType) {
        return parsedNewRequest;
    }

    console.log('🔄 Combining with previous request:', {
        previousType: previousRequest.requestType,
        newType: parsedNewRequest.requestType,
        previousFields: previousRequest.flights ? Object.keys(previousRequest.flights) :
            previousRequest.hotels ? Object.keys(previousRequest.hotels) : [],
        newFields: parsedNewRequest.flights ? Object.keys(parsedNewRequest.flights) :
            parsedNewRequest.hotels ? Object.keys(parsedNewRequest.hotels) : []
    });

    // Combine flights data
    if (parsedNewRequest.requestType === 'flights' || parsedNewRequest.requestType === 'combined') {
        const combinedFlights = {
            ...previousRequest.flights,
            ...parsedNewRequest.flights,
            // Only update fields that have new values
            ...(parsedNewRequest.flights?.origin && { origin: parsedNewRequest.flights.origin }),
            ...(parsedNewRequest.flights?.destination && { destination: parsedNewRequest.flights.destination }),
            ...(parsedNewRequest.flights?.departureDate && { departureDate: parsedNewRequest.flights.departureDate }),
            ...(parsedNewRequest.flights?.returnDate && { returnDate: parsedNewRequest.flights.returnDate }),
            ...(parsedNewRequest.flights?.adults && { adults: parsedNewRequest.flights.adults }),
            ...(parsedNewRequest.flights?.children && { children: parsedNewRequest.flights.children }),
            ...(parsedNewRequest.flights?.luggage && { luggage: parsedNewRequest.flights.luggage }),
            ...(parsedNewRequest.flights?.stops && { stops: parsedNewRequest.flights.stops }),
            ...(parsedNewRequest.flights?.departureTimePreference && { departureTimePreference: parsedNewRequest.flights.departureTimePreference }),
            ...(parsedNewRequest.flights?.arrivalTimePreference && { arrivalTimePreference: parsedNewRequest.flights.arrivalTimePreference }),
            ...(parsedNewRequest.flights?.layoverDuration && { layoverDuration: parsedNewRequest.flights.layoverDuration }),
            ...(parsedNewRequest.flights?.maxLayoverHours && { maxLayoverHours: parsedNewRequest.flights.maxLayoverHours }),
            ...(parsedNewRequest.flights?.preferredAirline && { preferredAirline: parsedNewRequest.flights.preferredAirline })
        };

        parsedNewRequest.flights = combinedFlights;
    }

    // Combine hotels data
    if (parsedNewRequest.requestType === 'hotels' || parsedNewRequest.requestType === 'combined') {
        const combinedHotels = {
            ...previousRequest.hotels,
            ...parsedNewRequest.hotels,
            // Only update fields that have new values
            ...(parsedNewRequest.hotels?.city && { city: parsedNewRequest.hotels.city }),
            ...(parsedNewRequest.hotels?.checkinDate && { checkinDate: parsedNewRequest.hotels.checkinDate }),
            ...(parsedNewRequest.hotels?.checkoutDate && { checkoutDate: parsedNewRequest.hotels.checkoutDate }),
            ...(parsedNewRequest.hotels?.adults && { adults: parsedNewRequest.hotels.adults }),
            ...(parsedNewRequest.hotels?.children && { children: parsedNewRequest.hotels.children }),
            ...(parsedNewRequest.hotels?.roomType && { roomType: parsedNewRequest.hotels.roomType }),
            ...(parsedNewRequest.hotels?.mealPlan && { mealPlan: parsedNewRequest.hotels.mealPlan }),
            ...(parsedNewRequest.hotels?.hotelChain && { hotelChain: parsedNewRequest.hotels.hotelChain }),
            ...(parsedNewRequest.hotels?.freeCancellation !== undefined && { freeCancellation: parsedNewRequest.hotels.freeCancellation }),
            ...(parsedNewRequest.hotels?.roomView && { roomView: parsedNewRequest.hotels.roomView }),
            ...(parsedNewRequest.hotels?.roomCount && { roomCount: parsedNewRequest.hotels.roomCount })
        };

        parsedNewRequest.hotels = combinedHotels;
    }

    console.log('✅ Combined request result:', {
        type: parsedNewRequest.requestType,
        flights: parsedNewRequest.flights ? Object.keys(parsedNewRequest.flights) : null,
        hotels: parsedNewRequest.hotels ? Object.keys(parsedNewRequest.hotels) : null
    });

    return parsedNewRequest;
}

/**
 * Uses OpenAI to intelligently parse travel messages and extract structured parameters
 */
export async function parseMessageWithAI(
    message: string,
    previousContext?: ParsedTravelRequest | null,
    conversationHistory?: Array<{ role: string, content: string, timestamp: string }>
): Promise<ParsedTravelRequest> {
    console.log('🤖 Starting AI message parsing for:', message);
    console.log('✅ OpenAI parsing is ENABLED - fallback has been removed, will always use OpenAI');

    // Pre-parser rápido: captura patrones comunes tipo
    // "Ezeiza - Punta Cana, con valija para 2 personas"
    // para mejorar el contexto antes de llamar al parser de IA.
    const quick: Partial<ParsedTravelRequest> = {} as any;
    try {
        const normalized = message.replace(/\s+/g, ' ').trim();

        // Origen - Destino con "desde X a Y"
        const desdeMatch = normalized.match(/desde\s+([^a]+?)\s+a\s+([^a]+?)(?=\s+desde|\s+para|\s+con|$)/i);
        if (desdeMatch && desdeMatch[1] && desdeMatch[2]) {
            quick.requestType = 'flights' as any;
            quick.flights = {
                origin: desdeMatch[1].trim(),
                destination: desdeMatch[2].trim(),
                departureDate: '',
                adults: 1,
                children: 0,
            } as any;
        }

        // Origen - Destino con formato "X - Y"
        const odMatch = normalized.match(/([\p{L} .]+)\s*-\s*([\p{L} .]+)/u);
        if (odMatch && odMatch[1] && odMatch[2] && !quick.flights) {
            quick.requestType = 'flights' as any;
            quick.flights = {
                origin: odMatch[1].trim(),
                destination: odMatch[2].split(',')[0].trim(),
                departureDate: '',
                adults: 1,
                children: 0,
            } as any;
        }

        // Extraer fechas con formato "desde X de mes al Y de mes"
        const fechaMatch = normalized.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+al\s+(\d{1,2})\s+de\s+([a-záéíóú]+))?/i);
        if (fechaMatch && quick.flights) {
            const mes = fechaMatch[2].toLowerCase();
            const meses = {
                'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
                'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
                'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
            };
            const mesNum = meses[mes] || '10';

            // Dynamic year calculation: if month has already passed this year, use next year
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // 0-indexed
            const requestedMonth = parseInt(mesNum, 10);
            const año = requestedMonth < currentMonth ? (currentYear + 1).toString() : currentYear.toString();

            quick.flights.departureDate = `${año}-${mesNum}-${fechaMatch[1].padStart(2, '0')}`;

            if (fechaMatch[3] && fechaMatch[4]) {
                const mes2 = fechaMatch[4].toLowerCase();
                const mes2Num = meses[mes2] || '11';
                const requestedMonth2 = parseInt(mes2Num, 10);
                // For return date, compare with current month and consider if it wraps to next year
                const año2 = requestedMonth2 < currentMonth ? (currentYear + 1).toString() :
                            (requestedMonth2 < requestedMonth ? (parseInt(año) + 1).toString() : año);
                quick.flights.returnDate = `${año2}-${mes2Num}-${fechaMatch[3].padStart(2, '0')}`;
            }
        }

        // Equipaje
        if (/con valija|equipaje facturado/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), luggage: 'checked' as any } as any;
        } else if (/solo equipaje de mano|equipaje de mano|carry on|sin valija/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), luggage: 'carry_on' as any } as any;
        }

        // Cantidad de escalas explícita (1/2 escalas)
        const escalasNumMatch = normalized.match(/(?:con\s+)?(\d+)\s+escala(?:s)?/i);
        if (escalasNumMatch) {
            const num = parseInt(escalasNumMatch[1], 10);
            if (num === 0) {
                quick.flights = { ...(quick.flights || ({} as any)), stops: 'direct' as any } as any;
            } else if (num === 1) {
                quick.flights = { ...(quick.flights || ({} as any)), stops: 'one_stop' as any } as any;
            } else if (num === 2) {
                quick.flights = { ...(quick.flights || ({} as any)), stops: 'two_stops' as any } as any;
            } else {
                quick.flights = { ...(quick.flights || ({} as any)), stops: 'any' as any } as any;
            }
        } else if (/una\s+escala/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), stops: 'one_stop' as any } as any;
        }

        // Máximo tiempo de conexión: "no más de X horas" / "no mas de 8 hs" / "<= 8h"
        const layoverMatch = normalized.match(/no\s+m[áa]s\s+de\s+(\d{1,2})\s*(?:h|hs|hora|horas)\b|<=\s*(\d{1,2})\s*h/i);
        if (layoverMatch) {
            const hours = parseInt(layoverMatch[1] || layoverMatch[2], 10);
            if (!isNaN(hours)) {
                quick.flights = { ...(quick.flights || ({} as any)), maxLayoverHours: hours as any } as any;
            }
        }

        // Pasajeros
        const paxMatch = normalized.match(/(\d+)\s*(personas|pasajeros|adultos)/i);
        if (paxMatch) {
            const adt = Math.max(1, parseInt(paxMatch[1], 10));
            quick.flights = { ...(quick.flights || ({} as any)), adults: adt, children: 0 } as any;
        } else if (/una persona|un pasajero|un adulto/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), adults: 1, children: 0 } as any;
        }

        // Tipo de vuelo
        if (/directo/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), stops: 'direct' as any } as any;
        } else if (/con\s+escalas\b/i.test(normalized)) {
            // "con escalas" genérico = cualquier vuelo con escalas (1 o 2+)
            quick.flights = { ...(quick.flights || ({} as any)), stops: 'with_stops' as any } as any;
        } else if (/con\s+escala\b|\buna\s+escala\b/i.test(normalized)) {
            // "con escala" o "una escala" = específicamente 1 escala
            quick.flights = { ...(quick.flights || ({} as any)), stops: 'one_stop' as any } as any;
        }

        // 🛡️ AIRLINE DETECTOR (Fallback for AI): Detect common airline names
        // This ensures airline filtering works even if AI Edge Function fails to detect
        const normalizedLower = normalized.toLowerCase();

        // Strategy 1: Flexible pattern - captures 1-3 words after "aerolinea/aerolínea/airline"
        // This catches ANY airline mentioned after these keywords, even if not in our predefined list
        const flexibleAirlineMatch = normalizedLower.match(
            /\b(?:aerolinea|aerolínea|airline|con\s+la\s+aerolinea|con\s+la\s+aerolínea)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/i
        );

        if (flexibleAirlineMatch && flexibleAirlineMatch[1]) {
            let detectedAirline = flexibleAirlineMatch[1].trim();

            // Remove everything after (and including) stop words
            // Stop words indicate the airline name has ended
            const stopWords = ['a', 'hacia', 'para', 'desde', 'saliendo', 'regresando', 'directo',
                              'con', 'business', 'economy', 'class', 'primera', 'el', 'la', 'los', 'las',
                              'de', 'en', 'por', 'del', 'al'];

            // Split and find the first stop word, keep only words before it
            const words = detectedAirline.split(/\s+/);
            const stopWordIndex = words.findIndex(word => stopWords.includes(word));

            if (stopWordIndex !== -1) {
                // Found a stop word - keep only words before it
                detectedAirline = words.slice(0, stopWordIndex).join(' ');
            } else {
                // No stop word found - keep all words (already 1-3 words due to regex)
                detectedAirline = words.join(' ');
            }

            if (detectedAirline.length > 2) { // At least 2 characters to avoid false positives
                quick.flights = { ...(quick.flights || ({} as any)), preferredAirline: detectedAirline } as any;
                console.log(`🛡️ [QUICK PRE-PARSER] Detected airline (flexible pattern): "${detectedAirline}"`);
            }
        }

        // Strategy 2: Predefined list with specific patterns (fallback if flexible didn't match)
        if (!quick.flights?.preferredAirline) {
            const commonAirlines = [
                'emirates', 'latam', 'american airlines', 'american', 'united', 'delta',
                'iberia', 'lufthansa', 'air france', 'klm', 'british airways',
                'aerolíneas argentinas', 'aerolineas argentinas', 'aerolineas', 'aerolíneas',
                'qatar', 'turkish', 'avianca', 'copa', 'gol', 'azul', 'tam',
                'alitalia', 'tap', 'swiss', 'singapore', 'cathay', 'ana', 'jal',
                'etihad', 'korean air', 'air canada', 'aeroméxico', 'aeromexico'
            ];

            // Try to find airline mentions with common patterns
            for (const airline of commonAirlines) {
                // Patterns: "con [airline]", "de [airline]", "en [airline]",
                // "[airline] a [destino]", "vuelo [airline]", "prefiero [airline]"
                const patterns = [
                    new RegExp(`\\b(?:con|de|en|vuelo|prefiero|operado por)\\s+${airline}\\b`, 'i'),
                    new RegExp(`\\b${airline}\\s+(?:a|hacia|para|desde)\\b`, 'i'),
                    new RegExp(`\\b${airline}\\s+(?:class|business|economy|primera)\\b`, 'i')
                ];

                for (const pattern of patterns) {
                    if (pattern.test(normalizedLower)) {
                        quick.flights = { ...(quick.flights || ({} as any)), preferredAirline: airline } as any;
                        console.log(`🛡️ [QUICK PRE-PARSER] Detected airline (predefined list): "${airline}"`);
                        break;
                    }
                }

                if (quick.flights?.preferredAirline) break;
            }
        }
    } catch (e) {
        console.warn('Quick pre-parse failed:', e);
    }

    try {
        console.log('🚀 Calling OpenAI via Supabase Edge Function...');
        console.log('📚 [CONTEXT] Sending conversation history:', {
            historyLength: conversationHistory?.length || 0,
            hasPreviousContext: !!previousContext
        });

        const response = await supabase.functions.invoke('ai-message-parser', {
            body: {
                message,
                language: 'es', // Spanish
                currentDate: new Date().toISOString().split('T')[0],
                previousContext: previousContext, // Include conversation context
                conversationHistory: conversationHistory || [] // Include full conversation history
            }
        });

        if (response.error) {
            console.error('❌ AI parsing error:', response.error);
            throw new Error(`AI parsing failed: ${response.error}`);
        }

        const parsedResult = response.data?.parsed;
        if (!parsedResult) {
            console.warn('⚠️ No parsed result from AI');
            throw new Error('No parsed result from AI service');
        }

        console.log('🔍 [DEBUG] parsedResult from Edge Function:', parsedResult);
        console.log('🔍 [DEBUG] parsedResult.hotels:', parsedResult.hotels);
        console.log('🔍 [DEBUG] parsedResult.hotels?.roomType:', parsedResult.hotels?.roomType);
        console.log('🔍 [DEBUG] parsedResult.hotels?.mealPlan:', parsedResult.hotels?.mealPlan);

        // Merge quick pre-parse hints if AI missed them (e.g., max layover hours, stops, preferredAirline)
        const mergedFlights = {
            ...(parsedResult.flights || {}),
            ...(quick.flights?.stops && !parsedResult.flights?.stops ? { stops: quick.flights.stops } : {}),
            ...(quick.flights?.maxLayoverHours && !parsedResult.flights?.maxLayoverHours ? { maxLayoverHours: quick.flights.maxLayoverHours } : {}),
            ...(quick.flights?.preferredAirline && !parsedResult.flights?.preferredAirline ? { preferredAirline: quick.flights.preferredAirline } : {})
        } as any;

        const mergedResult = {
            ...parsedResult,
            flights: Object.keys(mergedFlights).length ? mergedFlights : parsedResult.flights,
            originalMessage: message
        };

        console.log('✅ AI parsing successful (merged with quick hints when missing):', mergedResult);
        return mergedResult;

    } catch (error) {
        console.error('❌ AI parsing service error:', error);
        throw error;
    }
}


/**
 * Validates that required fields are present for each request type
 */
export function validateParsedRequest(parsed: ParsedTravelRequest): boolean {
    switch (parsed.requestType) {
        case 'flights':
            return !!(parsed.flights?.origin && parsed.flights?.destination && parsed.flights?.departureDate);

        case 'hotels':
            return !!(parsed.hotels?.city && parsed.hotels?.checkinDate && parsed.hotels?.checkoutDate &&
                parsed.hotels?.adults);

        case 'packages':
            return !!(parsed.packages?.destination && parsed.packages?.dateFrom && parsed.packages?.dateTo);

        case 'services':
            return !!(parsed.services?.city && parsed.services?.dateFrom);

        case 'combined':
            return validateParsedRequest({ ...parsed, requestType: 'flights' }) &&
                validateParsedRequest({ ...parsed, requestType: 'hotels' });

        default:
            return true;
    }
}

/**
 * Formats parsed data for EUROVIPS API calls
 */
export function formatForEurovips(parsed: ParsedTravelRequest) {
    const result: any = {};

    if (parsed.flights) {
        result.flightParams = {
            originCode: parsed.flights.origin,
            destinationCode: parsed.flights.destination,
            departureDate: parsed.flights.departureDate,
            returnDate: parsed.flights.returnDate,
            adults: parsed.flights.adults,
            children: parsed.flights.children
        };
    }

    if (parsed.hotels) {
        result.hotelParams = {
            cityCode: parsed.hotels.city,
            hotelName: parsed.hotels.hotelName,
            checkinDate: parsed.hotels.checkinDate,
            checkoutDate: parsed.hotels.checkoutDate,
            adults: parsed.hotels.adults,
            children: parsed.hotels.children
        };
    }

    if (parsed.packages) {
        result.packageParams = {
            cityCode: parsed.packages.destination,
            dateFrom: parsed.packages.dateFrom,
            dateTo: parsed.packages.dateTo,
            packageClass: parsed.packages.packageClass
        };
    }

    if (parsed.services) {
        result.serviceParams = {
            cityCode: parsed.services.city,
            dateFrom: parsed.services.dateFrom,
            dateTo: parsed.services.dateTo,
            serviceType: parsed.services.serviceType
        };
    }

    return result;
}

/**
 * Formats parsed data for Starling API calls
 */
export function formatForStarling(parsed: ParsedTravelRequest) {
    if (!parsed.flights) return null;

    // Create passenger array for TVC API format
    const passengers = [];
    if ((parsed.flights.adults || 1) > 0) {
        passengers.push({
            Count: parsed.flights.adults || 1,
            Type: 'ADT'
        });
    }
    if ((parsed.flights.children || 0) > 0) {
        passengers.push({
            Count: parsed.flights.children,
            Type: 'CHD'
        });
    }

    // Create legs array for TVC API format
    const legs = [
        {
            DepartureAirportCity: parsed.flights.origin,
            ArrivalAirportCity: parsed.flights.destination,
            FlightDate: parsed.flights.departureDate
        }
    ];

    // Add return leg if this is a round trip
    if (parsed.flights.returnDate) {
        legs.push({
            DepartureAirportCity: parsed.flights.destination,
            ArrivalAirportCity: parsed.flights.origin,
            FlightDate: parsed.flights.returnDate
        });
    }

    return {
        Passengers: passengers,
        Legs: legs,
        Airlines: null
    };
}
