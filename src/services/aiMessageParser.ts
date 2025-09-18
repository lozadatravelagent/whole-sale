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
        stops?: 'direct' | 'one_stop' | 'two_stops' | 'any'; // vuelo directo o con escalas
        layoverDuration?: string; // tiempo de escala preferido
        preferredAirline?: string; // aerolínea preferida
    };
    hotels?: {
        city: string;
        hotelName?: string;
        checkinDate: string;
        checkoutDate: string;
        adults: number;
        children: number;
        // Nuevos campos requeridos para hoteles
        roomType: 'single' | 'double' | 'triple'; // Tipo de habitación
        hotelChain?: string; // Cadena hotelera (opcional)
        mealPlan: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only'; // Modalidad de alimentación
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
            missingFields: ['origin', 'destination', 'departureDate', 'adults', 'luggage', 'stops'],
            missingFieldsSpanish: ['origen', 'destino', 'fecha de salida', 'cantidad de pasajeros', 'equipaje', 'tipo de vuelo (directo o con escalas)']
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
    if (!flights.luggage) {
        missingFields.push('luggage');
        missingFieldsSpanish.push('equipaje (con o sin valija)');
    }
    if (!flights.stops) {
        missingFields.push('stops');
        missingFieldsSpanish.push('tipo de vuelo (directo o con escalas)');
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
            missingFields: ['city', 'checkinDate', 'checkoutDate', 'adults', 'roomType', 'mealPlan'],
            missingFieldsSpanish: ['destino', 'fecha de entrada', 'fecha de salida', 'cantidad de pasajeros', 'tipo de habitación', 'modalidad de alimentación']
        };
    }

    const missingFields: string[] = [];
    const missingFieldsSpanish: string[] = [];

    // Validar campos requeridos
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
    if (!hotels.roomType) {
        missingFields.push('roomType');
        missingFieldsSpanish.push('tipo de habitación (single, double, triple)');
    }
    if (!hotels.mealPlan) {
        missingFields.push('mealPlan');
        missingFieldsSpanish.push('modalidad de alimentación (all inclusive, desayuno, media pensión)');
    }

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
                examples.push('👥 **Pasajeros:** Por ejemplo: "2 adultos", "1 adulto y 2 niños"');
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
                examples.push('👥 **Pasajeros:** Por ejemplo: "2 adultos", "1 adulto y 2 niños"');
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
export async function parseMessageWithAI(message: string, previousContext?: ParsedTravelRequest | null): Promise<ParsedTravelRequest> {
    console.log('🤖 Starting AI message parsing for:', message);

    // Pre-parser rápido: captura patrones comunes tipo
    // "Ezeiza - Punta Cana, con valija para 2 personas"
    // para mejorar el contexto antes de llamar al parser de IA.
    const quick: Partial<ParsedTravelRequest> = {} as any;
    try {
        const normalized = message.replace(/\s+/g, ' ').trim();

        // Origen - Destino
        const odMatch = normalized.match(/([\p{L} .]+)\s*-\s*([\p{L} .]+)/u);
        if (odMatch && odMatch[1] && odMatch[2]) {
            quick.requestType = 'flights' as any;
            quick.flights = {
                origin: odMatch[1].trim(),
                destination: odMatch[2].split(',')[0].trim(),
                departureDate: '',
                adults: 1,
                children: 0,
            } as any;
        }

        // Equipaje
        if (/con valija|equipaje facturado/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), luggage: 'checked' as any } as any;
        } else if (/solo equipaje de mano|equipaje de mano/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), luggage: 'carry_on' as any } as any;
        }

        // Pasajeros
        const paxMatch = normalized.match(/(\d+)\s*(personas|pasajeros|adultos)/i);
        if (paxMatch) {
            const adt = Math.max(1, parseInt(paxMatch[1], 10));
            quick.flights = { ...(quick.flights || ({} as any)), adults: adt, children: 0 } as any;
        }

        // Tipo de vuelo
        if (/directo/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), stops: 'direct' as any } as any;
        } else if (/con\s+escala|con\s+escalas|escala/i.test(normalized)) {
            quick.flights = { ...(quick.flights || ({} as any)), stops: 'one_stop' as any } as any;
        }
    } catch (e) {
        console.warn('Quick pre-parse failed:', e);
    }

    try {
        const response = await supabase.functions.invoke('ai-message-parser', {
            body: {
                message,
                language: 'es', // Spanish
                currentDate: new Date().toISOString().split('T')[0],
                previousContext: previousContext // Include conversation context
            }
        });

        if (response.error) {
            console.error('❌ AI parsing error:', response.error);
            return getFallbackParsing(message);
        }

        const parsedResult = response.data?.parsed;
        if (!parsedResult) {
            console.warn('⚠️ No parsed result from AI, using fallback');
            return getFallbackParsing(message);
        }

        console.log('✅ AI parsing successful:', parsedResult);
        return {
            ...parsedResult,
            originalMessage: message
        };

    } catch (error) {
        console.error('❌ AI parsing service error:', error);
        return getFallbackParsing(message);
    }
}

/**
 * Fallback parsing using simplified logic when AI fails
 */
export function getFallbackParsing(message: string): ParsedTravelRequest {
    console.log('🔄 Using fallback parsing for:', message);

    const lowerMessage = message.toLowerCase();

    // Detect request type
    let requestType: ParsedTravelRequest['requestType'] = 'general';

    if (lowerMessage.includes('paquete')) {
        requestType = 'packages';
    } else if (lowerMessage.includes('vuelo') && lowerMessage.includes('hotel')) {
        requestType = 'combined';
    } else if (lowerMessage.includes('vuelo')) {
        requestType = 'flights';
    } else if (lowerMessage.includes('hotel')) {
        requestType = 'hotels';
    } else if (lowerMessage.includes('transfer') || lowerMessage.includes('excursion')) {
        requestType = 'services';
    }

    // For flights, check if we have all required fields
    if (requestType === 'flights') {
        const hasOrigin = lowerMessage.includes('desde') || lowerMessage.includes('de ') || lowerMessage.includes('buenos aires') || lowerMessage.includes('ezeiza');
        const hasDestination = lowerMessage.includes('a ') || lowerMessage.includes('hacia') || lowerMessage.includes('madrid') || lowerMessage.includes('punta cana');
        const hasDates = lowerMessage.includes('el ') || lowerMessage.includes('día') || lowerMessage.includes('fecha') || /\d{1,2}\s+de\s+[a-záéíóú]+/i.test(message);
        const hasPassengers = /\d+\s+(?:personas?|adultos?)/i.test(message);
        const hasLuggage = lowerMessage.includes('valija') || lowerMessage.includes('equipaje') || lowerMessage.includes('bodega') || lowerMessage.includes('mochila');
        const hasStops = lowerMessage.includes('directo') || lowerMessage.includes('escala') || lowerMessage.includes('escalas');

        const missingFields = [];
        if (!hasOrigin) missingFields.push('origen');
        if (!hasDestination) missingFields.push('destino');
        if (!hasDates) missingFields.push('fechas');
        if (!hasPassengers) missingFields.push('cantidad de personas');
        if (!hasLuggage) missingFields.push('tipo de equipaje');
        if (!hasStops) missingFields.push('tipo de vuelo (directo/escalas)');

        if (missingFields.length > 0) {
            return {
                requestType: 'missing_info_request',
                message: `Para buscar tu vuelo necesito algunos datos adicionales:\n\n${missingFields.map(field => `- ${field}`).join('\n')}\n\nPor favor, proporciona esta información para continuar con la búsqueda.`,
                missingFields,
                confidence: 0.2,
                originalMessage: message
            } as any;
        }
    }

    // Basic people extraction
    const peopleMatch = message.match(/(\d+)\s+(?:personas?|adultos?)/i);
    const adults = peopleMatch ? parseInt(peopleMatch[1]) : 1;

    const result: ParsedTravelRequest = {
        requestType,
        confidence: 0.3, // Low confidence for fallback
        originalMessage: message
    };

    // For all request types, check if we have enough information
    // If not, return missing info request instead of using hardcoded defaults
    const missingFields = [];

    if (requestType === 'flights') {
        if (!lowerMessage.includes('desde') && !lowerMessage.includes('de ') && !lowerMessage.includes('buenos aires') && !lowerMessage.includes('ezeiza')) {
            missingFields.push('origen');
        }
        if (!lowerMessage.includes('a ') && !lowerMessage.includes('hacia') && !lowerMessage.includes('madrid') && !lowerMessage.includes('punta cana')) {
            missingFields.push('destino');
        }
        if (!lowerMessage.includes('el ') && !lowerMessage.includes('día') && !lowerMessage.includes('fecha') && !/\d{1,2}\s+de\s+[a-záéíóú]+/i.test(message)) {
            missingFields.push('fechas');
        }
        if (!/\d+\s+(?:personas?|adultos?)/i.test(message)) {
            missingFields.push('cantidad de personas');
        }
        if (!lowerMessage.includes('valija') && !lowerMessage.includes('equipaje') && !lowerMessage.includes('bodega') && !lowerMessage.includes('mochila')) {
            missingFields.push('tipo de equipaje');
        }
        if (!lowerMessage.includes('directo') && !lowerMessage.includes('escala') && !lowerMessage.includes('escalas')) {
            missingFields.push('tipo de vuelo (directo/escalas)');
        }
    } else if (requestType === 'hotels') {
        if (!lowerMessage.includes('en ') && !lowerMessage.includes('hotel') && !lowerMessage.includes('madrid') && !lowerMessage.includes('punta cana')) {
            missingFields.push('ciudad del hotel');
        }
        if (!lowerMessage.includes('el ') && !lowerMessage.includes('día') && !lowerMessage.includes('fecha') && !/\d{1,2}\s+de\s+[a-záéíóú]+/i.test(message)) {
            missingFields.push('fechas de estadía');
        }
        if (!/\d+\s+(?:personas?|adultos?)/i.test(message)) {
            missingFields.push('cantidad de personas');
        }
    } else if (requestType === 'packages') {
        if (!lowerMessage.includes('para ') && !lowerMessage.includes('destino') && !lowerMessage.includes('españa') && !lowerMessage.includes('madrid')) {
            missingFields.push('destino del paquete');
        }
        if (!lowerMessage.includes('el ') && !lowerMessage.includes('día') && !lowerMessage.includes('fecha') && !/\d{1,2}\s+de\s+[a-záéíóú]+/i.test(message)) {
            missingFields.push('fechas del viaje');
        }
        if (!/\d+\s+(?:personas?|adultos?)/i.test(message)) {
            missingFields.push('cantidad de personas');
        }
    } else if (requestType === 'services') {
        if (!lowerMessage.includes('en ') && !lowerMessage.includes('ciudad') && !lowerMessage.includes('madrid')) {
            missingFields.push('ciudad del servicio');
        }
        if (!lowerMessage.includes('el ') && !lowerMessage.includes('día') && !lowerMessage.includes('fecha') && !/\d{1,2}\s+de\s+[a-záéíóú]+/i.test(message)) {
            missingFields.push('fecha del servicio');
        }
    }

    // If we have missing fields, return missing info request
    if (missingFields.length > 0) {
        return {
            requestType: 'missing_info_request',
            message: `Para ayudarte necesito algunos datos adicionales:\n\n${missingFields.map(field => `- ${field}`).join('\n')}\n\nPor favor, proporciona esta información para continuar.`,
            missingFields,
            confidence: 0.2,
            originalMessage: message
        } as any;
    }

    // If we reach here, we have enough basic info to proceed
    // But we still don't use hardcoded defaults - let the AI parser handle it
    result.requestType = 'general'; // Fallback to general query
    result.confidence = 0.1; // Very low confidence

    console.log('🔄 Fallback parsing result:', result);
    return result;
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
                parsed.hotels?.adults && parsed.hotels?.roomType && parsed.hotels?.mealPlan);

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
