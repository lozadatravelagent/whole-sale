import { supabase } from '@/integrations/supabase/client';
import {
    getNormalizedFlightSegments,
    normalizeFlightRequest,
    normalizeParsedFlightRequest,
    type FlightTripType
} from '@/services/flightSegments';

export interface ParsedTravelRequest {
    requestType: 'flights' | 'hotels' | 'packages' | 'services' | 'combined' | 'general' | 'missing_info_request' | 'itinerary';
    flights?: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        tripType?: FlightTripType;
        segments?: Array<{
            origin?: string;
            destination?: string;
            departureDate?: string;
        }>;
        adults: number;
        adultsExplicit?: boolean;
        children: number;
        infants?: number; // Bebés de 0-2 años (viajan en brazos)
        // Nuevos campos requeridos
        luggage?: 'backpack' | 'carry_on' | 'checked' | 'both' | 'none'; // con o sin valija/equipaje
        departureTimePreference?: string; // horario de salida preferido
        arrivalTimePreference?: string; // horario de llegada preferido
        stops?: 'direct' | 'one_stop' | 'two_stops' | 'with_stops' | 'any'; // vuelo directo o con escalas
        layoverDuration?: string; // tiempo de escala preferido (ej: "3 hours", "10 hours")
        maxLayoverHours?: number; // duración máxima de escalas en horas
        preferredAirline?: string; // aerolínea preferida
        cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first'; // clase de cabina
    };
    hotels?: {
        city: string;
        hotelName?: string;
        hotelNames?: string[]; // Nombres específicos de hoteles (ej: ["Riu Republica", "Iberostar Dominicana"])
        checkinDate: string;
        checkoutDate: string;
        adults: number;
        adultsExplicit?: boolean;
        children: number;
        childrenAges?: number[]; // Edades de niños para paridad exacta con EUROVIPS
        infants?: number; // Bebés de 0-2 años
        // Campos opcionales de preferencias
        roomType?: 'single' | 'double' | 'triple'; // Tipo de habitación (OPCIONAL - solo filtrar si usuario lo especifica)
        hotelChains?: string[]; // Cadenas hoteleras - soporta múltiples cadenas (opcional)
        mealPlan?: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only'; // Modalidad de alimentación (OPCIONAL - solo filtrar si usuario lo especifica)
        freeCancellation?: boolean; // Cancelación gratuita (opcional)
        roomView?: 'mountain_view' | 'beach_view' | 'city_view' | 'garden_view'; // Tipo de habitación (opcional)
        roomCount?: number; // Cantidad de habitaciones (opcional, default 1)
    };
    // 🚗 TRASLADOS (transfers) - Servicios de traslado aeropuerto-hotel
    transfers?: {
        included: boolean; // Si el usuario solicitó traslados
        type?: 'in' | 'out' | 'in_out'; // Tipo: solo ida, solo vuelta, o ambos
    };
    // 🏥 ASISTENCIA MÉDICA / SEGURO DE VIAJE (travel_assistance)
    travelAssistance?: {
        included: boolean; // Si el usuario solicitó seguro/asistencia
        coverageAmount?: number; // Monto de cobertura si se especificó
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
    itinerary?: {
        destinations: string[]; // Lista de destinos (ciudades, países o combinación)
        days: number; // Cantidad de días del itinerario
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

// Interfaz para campos requeridos de itinerarios
export interface RequiredItineraryFields {
    destinations: boolean;
    days: boolean;
}

// Función para validar campos requeridos de vuelos
export function validateFlightRequiredFields(flights?: ParsedTravelRequest['flights']): {
    isValid: boolean;
    missingFields: string[];
    missingFieldsSpanish: string[];
    errorMessage?: string;
} {
    const normalizedFlights = normalizeFlightRequest(flights);

    if (!normalizedFlights) {
        return {
            isValid: false,
            missingFields: ['origin', 'destination', 'departureDate', 'adults'],
            missingFieldsSpanish: ['origen', 'destino', 'fecha de salida', 'cantidad de pasajeros']
        };
    }

    const missingFields: string[] = [];
    const missingFieldsSpanish: string[] = [];

    // 🚨 CRITICAL: Check for "only minors" FIRST - children/infants traveling without adults
    const hasOnlyMinors = (normalizedFlights.adults === 0 || !normalizedFlights.adults) &&
        (((normalizedFlights.children ?? 0) > 0) || ((normalizedFlights.infants ?? 0) > 0));

    if (hasOnlyMinors) {
        console.log('⚠️ [VALIDATION] Only minors detected without adults - rejecting search');
        return {
            isValid: false,
            missingFields: ['adults'],
            missingFieldsSpanish: ['adulto acompañante'],
            errorMessage: '⚠️ **Los menores no pueden viajar solos**\n\nPor normativa de las aerolíneas, los niños y bebés deben viajar acompañados por al menos un adulto.\n\n**¿Cuántos adultos los acompañarán?**\n\nPor ejemplo: "agrega 1 adulto", "con 2 adultos"'
        };
    }

    const segments = getNormalizedFlightSegments(normalizedFlights);

    if (segments.length > 3) {
        return {
            isValid: false,
            missingFields: ['segments'],
            missingFieldsSpanish: ['máximo 3 tramos'],
            errorMessage: 'Para vuelos multi-city puedo procesar hasta 3 tramos por búsqueda.'
        };
    }

    if (segments.length > 0) {
        segments.forEach((segment, index) => {
            const segmentNumber = index + 1;

            if (!segment.origin) {
                missingFields.push(`segment_${segmentNumber}_origin`);
                missingFieldsSpanish.push(`origen del tramo ${segmentNumber}`);
            }
            if (!segment.destination) {
                missingFields.push(`segment_${segmentNumber}_destination`);
                missingFieldsSpanish.push(`destino del tramo ${segmentNumber}`);
            }
            if (!segment.departureDate) {
                missingFields.push(`segment_${segmentNumber}_departureDate`);
                missingFieldsSpanish.push(`fecha del tramo ${segmentNumber}`);
            }
        });
    } else {
        if (!normalizedFlights.origin) {
            missingFields.push('origin');
            missingFieldsSpanish.push('origen');
        }
        if (!normalizedFlights.destination) {
            missingFields.push('destination');
            missingFieldsSpanish.push('destino');
        }
        if (!normalizedFlights.departureDate) {
            missingFields.push('departureDate');
            missingFieldsSpanish.push('fecha de salida');
        }
    }

    if (!normalizedFlights.adults || normalizedFlights.adults < 1) {
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
    errorMessage?: string;
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

    // 🚨 CRITICAL: Check for "only minors" FIRST - children/infants without adults
    const hasOnlyMinors = (hotels.adults === 0 || !hotels.adults) &&
        (((hotels.children ?? 0) > 0) || ((hotels.infants ?? 0) > 0));

    if (hasOnlyMinors) {
        console.log('⚠️ [VALIDATION] Only minors detected in hotel search without adults - rejecting');
        return {
            isValid: false,
            missingFields: ['adults'],
            missingFieldsSpanish: ['adulto acompañante'],
            errorMessage: '⚠️ **Los menores no pueden hospedarse solos**\n\nLos niños y bebés deben estar acompañados por al menos un adulto responsable.\n\n**¿Cuántos adultos los acompañarán?**\n\nPor ejemplo: "agrega 1 adulto", "con 2 adultos"'
        };
    }

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

// Función para validar campos requeridos de itinerarios
export function validateItineraryRequiredFields(itinerary?: ParsedTravelRequest['itinerary']): {
    isValid: boolean;
    missingFields: string[];
    missingFieldsSpanish: string[];
} {
    if (!itinerary) {
        return {
            isValid: false,
            missingFields: ['destinations', 'days'],
            missingFieldsSpanish: ['destino(s)', 'cantidad de días']
        };
    }

    const missingFields: string[] = [];
    const missingFieldsSpanish: string[] = [];

    // Validar campos requeridos
    if (!itinerary.destinations || itinerary.destinations.length === 0) {
        missingFields.push('destinations');
        missingFieldsSpanish.push('destino(s)');
    }
    if (!itinerary.days || itinerary.days < 1) {
        missingFields.push('days');
        missingFieldsSpanish.push('cantidad de días');
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
            : requestType === 'itinerary'
                ? 'Para armar tu itinerario de viaje, necesito que me proporciones la siguiente información:'
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
            // Ejemplos para itinerarios
            case 'destino(s)':
                examples.push('🌍 **Destino(s):** Por ejemplo: "Roma", "Italia y Francia", "Barcelona, Madrid y París"');
                break;
            case 'cantidad de días':
                examples.push('📅 **Días:** Por ejemplo: "5 días", "una semana", "10 días"');
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
    const normalizedPreviousRequest = previousRequest ? normalizeParsedFlightRequest(previousRequest) : null;
    const normalizedParsedNewRequest = normalizeParsedFlightRequest(parsedNewRequest);

    if (!previousRequest) {
        return normalizedParsedNewRequest;
    }

    // If request types don't match, return the new request
    if (normalizedPreviousRequest.requestType !== normalizedParsedNewRequest.requestType) {
        return normalizedParsedNewRequest;
    }

    console.log('🔄 Combining with previous request:', {
        previousType: normalizedPreviousRequest.requestType,
        newType: normalizedParsedNewRequest.requestType,
        previousFields: normalizedPreviousRequest.flights ? Object.keys(normalizedPreviousRequest.flights) :
            normalizedPreviousRequest.hotels ? Object.keys(normalizedPreviousRequest.hotels) : [],
        newFields: normalizedParsedNewRequest.flights ? Object.keys(normalizedParsedNewRequest.flights) :
            normalizedParsedNewRequest.hotels ? Object.keys(normalizedParsedNewRequest.hotels) : []
    });

    // Combine flights data
    if (normalizedParsedNewRequest.requestType === 'flights' || normalizedParsedNewRequest.requestType === 'combined') {
        const combinedFlights = {
            ...normalizedPreviousRequest.flights,
            ...normalizedParsedNewRequest.flights,
            // Only update fields that have new values
            ...(normalizedParsedNewRequest.flights?.origin && { origin: normalizedParsedNewRequest.flights.origin }),
            ...(normalizedParsedNewRequest.flights?.destination && { destination: normalizedParsedNewRequest.flights.destination }),
            ...(normalizedParsedNewRequest.flights?.departureDate && { departureDate: normalizedParsedNewRequest.flights.departureDate }),
            ...(normalizedParsedNewRequest.flights?.returnDate && { returnDate: normalizedParsedNewRequest.flights.returnDate }),
            ...(normalizedParsedNewRequest.flights?.tripType && { tripType: normalizedParsedNewRequest.flights.tripType }),
            ...(normalizedParsedNewRequest.flights?.segments && normalizedParsedNewRequest.flights.segments.length > 0 && {
                segments: normalizedParsedNewRequest.flights.segments
            }),
            ...(normalizedParsedNewRequest.flights?.adults !== undefined && { adults: normalizedParsedNewRequest.flights.adults }),
            ...(normalizedParsedNewRequest.flights?.children !== undefined && { children: normalizedParsedNewRequest.flights.children }),
            ...(normalizedParsedNewRequest.flights?.infants !== undefined && { infants: normalizedParsedNewRequest.flights.infants }),
            ...(normalizedParsedNewRequest.flights?.adultsExplicit !== undefined && { adultsExplicit: normalizedParsedNewRequest.flights.adultsExplicit }),
            ...(normalizedParsedNewRequest.flights?.luggage && { luggage: normalizedParsedNewRequest.flights.luggage }),
            ...(normalizedParsedNewRequest.flights?.stops && { stops: normalizedParsedNewRequest.flights.stops }),
            ...(normalizedParsedNewRequest.flights?.departureTimePreference && { departureTimePreference: normalizedParsedNewRequest.flights.departureTimePreference }),
            ...(normalizedParsedNewRequest.flights?.arrivalTimePreference && { arrivalTimePreference: normalizedParsedNewRequest.flights.arrivalTimePreference }),
            ...(normalizedParsedNewRequest.flights?.layoverDuration && { layoverDuration: normalizedParsedNewRequest.flights.layoverDuration }),
            ...(normalizedParsedNewRequest.flights?.maxLayoverHours && { maxLayoverHours: normalizedParsedNewRequest.flights.maxLayoverHours }),
            ...(normalizedParsedNewRequest.flights?.preferredAirline && { preferredAirline: normalizedParsedNewRequest.flights.preferredAirline }),
            ...(normalizedParsedNewRequest.flights?.cabinClass && { cabinClass: normalizedParsedNewRequest.flights.cabinClass })
        };

        normalizedParsedNewRequest.flights = normalizeFlightRequest(combinedFlights);
    }

    // Combine hotels data
    if (normalizedParsedNewRequest.requestType === 'hotels' || normalizedParsedNewRequest.requestType === 'combined') {
        const combinedHotels = {
            ...normalizedPreviousRequest.hotels,
            ...normalizedParsedNewRequest.hotels,
            // Only update fields that have new values
            ...(normalizedParsedNewRequest.hotels?.city && { city: normalizedParsedNewRequest.hotels.city }),
            ...(normalizedParsedNewRequest.hotels?.checkinDate && { checkinDate: normalizedParsedNewRequest.hotels.checkinDate }),
            ...(normalizedParsedNewRequest.hotels?.checkoutDate && { checkoutDate: normalizedParsedNewRequest.hotels.checkoutDate }),
            ...(normalizedParsedNewRequest.hotels?.adults && { adults: normalizedParsedNewRequest.hotels.adults }),
            ...(normalizedParsedNewRequest.hotels?.children && { children: normalizedParsedNewRequest.hotels.children }),
            ...(normalizedParsedNewRequest.hotels?.childrenAges && normalizedParsedNewRequest.hotels.childrenAges.length > 0 && {
                childrenAges: normalizedParsedNewRequest.hotels.childrenAges
            }),
            ...(normalizedParsedNewRequest.hotels?.infants !== undefined && { infants: normalizedParsedNewRequest.hotels.infants }),
            ...(normalizedParsedNewRequest.hotels?.roomType && { roomType: normalizedParsedNewRequest.hotels.roomType }),
            ...(normalizedParsedNewRequest.hotels?.mealPlan && { mealPlan: normalizedParsedNewRequest.hotels.mealPlan }),
            ...(normalizedParsedNewRequest.hotels?.hotelChains && { hotelChains: normalizedParsedNewRequest.hotels.hotelChains }),
            ...(normalizedParsedNewRequest.hotels?.hotelName && { hotelName: normalizedParsedNewRequest.hotels.hotelName }),
            ...(normalizedParsedNewRequest.hotels?.freeCancellation !== undefined && { freeCancellation: normalizedParsedNewRequest.hotels.freeCancellation }),
            ...(normalizedParsedNewRequest.hotels?.roomView && { roomView: normalizedParsedNewRequest.hotels.roomView }),
            ...(normalizedParsedNewRequest.hotels?.roomCount && { roomCount: normalizedParsedNewRequest.hotels.roomCount })
        };

        normalizedParsedNewRequest.hotels = combinedHotels;
    }

    // Combine transfers data
    if (normalizedParsedNewRequest.transfers || normalizedPreviousRequest.transfers) {
        const combinedTransfers = {
            ...normalizedPreviousRequest.transfers,
            ...normalizedParsedNewRequest.transfers
        };
        normalizedParsedNewRequest.transfers = combinedTransfers;
    }

    // Combine travel assistance data
    if (normalizedParsedNewRequest.travelAssistance || normalizedPreviousRequest.travelAssistance) {
        const combinedTravelAssistance = {
            ...normalizedPreviousRequest.travelAssistance,
            ...normalizedParsedNewRequest.travelAssistance
        };
        normalizedParsedNewRequest.travelAssistance = combinedTravelAssistance;
    }

    console.log('✅ Combined request result:', {
        type: normalizedParsedNewRequest.requestType,
        flights: normalizedParsedNewRequest.flights ? Object.keys(normalizedParsedNewRequest.flights) : null,
        hotels: normalizedParsedNewRequest.hotels ? Object.keys(normalizedParsedNewRequest.hotels) : null,
        transfers: normalizedParsedNewRequest.transfers,
        travelAssistance: normalizedParsedNewRequest.travelAssistance
    });

    return normalizeParsedFlightRequest(normalizedParsedNewRequest);
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
        const normalizedLower = normalized.toLowerCase();

        // 🏨 HOTEL KEYWORD DETECTION - CHECK FIRST BEFORE ASSUMING FLIGHTS
        // If message contains hotel-specific keywords, DO NOT auto-assign flights
        const hotelKeywords = [
            'hotel', 'hoteles', 'habitacion', 'habitación', 'alojamiento',
            'all inclusive', 'todo incluido', 'media pension', 'media pensión',
            'cadena', 'resort', 'hostal', 'hospedaje', 'posada'
        ];
        const hasHotelKeywords = hotelKeywords.some(kw => normalizedLower.includes(kw));

        // Flight-specific keywords (NOT just origin-destination pattern)
        const flightKeywords = [
            'vuelo', 'vuelos', 'volar', 'avion', 'avión', 'aereo', 'aéreo',
            'pasaje', 'pasajes', 'boleto', 'boletos', 'flight', 'flights'
        ];
        const hasFlightKeywords = flightKeywords.some(kw => normalizedLower.includes(kw));

        // Origen - Destino con "desde X a Y"
        // Determine request type based on keywords present
        const desdeMatch = normalized.match(/desde\s+([^a]+?)\s+a\s+([^a]+?)(?=\s+desde|\s+para|\s+con|$)/i);
        if (desdeMatch && desdeMatch[1] && desdeMatch[2]) {
            // Extract origin and destination regardless of request type
            const origin = desdeMatch[1].trim();
            const destination = desdeMatch[2].trim();

            if (hasHotelKeywords && hasFlightKeywords) {
                // BOTH hotel AND flight keywords → COMBINED (vuelo y hotel)
                console.log(`✈️🏨 [PRE-PARSER] Both hotel AND flight keywords detected → COMBINED`);
                quick.requestType = 'combined' as any;
                quick.flights = {
                    origin: origin,
                    destination: destination,
                    departureDate: '',
                    adults: 1,
                    children: 0,
                } as any;
                // Hotels will be filled by AI with destination as city
            } else if (hasHotelKeywords && !hasFlightKeywords) {
                // ONLY hotel keywords → let AI decide (hotels)
                // "desde X a Y" means user is FROM X going TO Y for hotel
                console.log(`🏨 [PRE-PARSER] Hotel keywords detected with "desde X a Y" pattern - NOT auto-assigning flights`);
                console.log(`   Origin context: ${origin}, Destination: ${destination}`);
                // Don't set requestType, let AI handle it
            } else if (hasFlightKeywords && !hasHotelKeywords) {
                // ONLY flight keywords → flights
                console.log(`✈️ [PRE-PARSER] Flight keywords detected → FLIGHTS`);
                quick.requestType = 'flights' as any;
                quick.flights = {
                    origin: origin,
                    destination: destination,
                    departureDate: '',
                    adults: 1,
                    children: 0,
                } as any;
            } else {
                // No specific keywords, pattern "desde X a Y" → assume flights
                quick.requestType = 'flights' as any;
                quick.flights = {
                    origin: origin,
                    destination: destination,
                    departureDate: '',
                    adults: 1,
                    children: 0,
                } as any;
            }
        }

        // Origen - Destino con formato "X - Y"
        const odMatch = normalized.match(/([\p{L} .]+)\s*-\s*([\p{L} .]+)/u);
        if (odMatch && odMatch[1] && odMatch[2] && !quick.flights) {
            const origin = odMatch[1].trim();
            const destination = odMatch[2].split(',')[0].trim();

            if (hasHotelKeywords && hasFlightKeywords) {
                // BOTH → COMBINED
                console.log(`✈️🏨 [PRE-PARSER] Both keywords with "X - Y" pattern → COMBINED`);
                quick.requestType = 'combined' as any;
                quick.flights = {
                    origin: origin,
                    destination: destination,
                    departureDate: '',
                    adults: 1,
                    children: 0,
                } as any;
            } else if (hasHotelKeywords && !hasFlightKeywords) {
                // ONLY hotel → let AI decide
                console.log(`🏨 [PRE-PARSER] Hotel keywords detected with "X - Y" pattern - NOT auto-assigning flights`);
            } else {
                // Flight keywords or no specific keywords → flights
                quick.requestType = 'flights' as any;
                quick.flights = {
                    origin: origin,
                    destination: destination,
                    departureDate: '',
                    adults: 1,
                    children: 0,
                } as any;
            }
        }

        // Extraer fechas con formato "X de mes al Y [de mes]" - mes de vuelta opcional
        const fechaMatch = normalized.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+al\s+(\d{1,2})(?:\s+de\s+([a-záéíóú]+))?)?/i);
        // Formato alternativo: "del X al Y de mes" (mes al final aplica a ambas fechas)
        const fechaAltMatch = !fechaMatch ? normalized.match(/del?\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)/i) : null;

        const meses = {
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };

        if (fechaMatch && quick.flights) {
            const mes = fechaMatch[2].toLowerCase();
            const mesNum = meses[mes] || '10';

            // Dynamic year calculation: if month has already passed this year, use next year
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // 0-indexed
            const requestedMonth = parseInt(mesNum, 10);
            const año = requestedMonth < currentMonth ? (currentYear + 1).toString() : currentYear.toString();

            quick.flights.departureDate = `${año}-${mesNum}-${fechaMatch[1].padStart(2, '0')}`;

            if (fechaMatch[3]) {
                // Si hay mes de vuelta explícito, usarlo; sino usar el mismo mes de ida
                const mes2 = fechaMatch[4] ? fechaMatch[4].toLowerCase() : mes;
                const mes2Num = meses[mes2] || mesNum;
                const requestedMonth2 = parseInt(mes2Num, 10);
                // For return date, compare with current month and consider if it wraps to next year
                const año2 = requestedMonth2 < currentMonth ? (currentYear + 1).toString() :
                    (requestedMonth2 < requestedMonth ? (parseInt(año) + 1).toString() : año);
                quick.flights.returnDate = `${año2}-${mes2Num}-${fechaMatch[3].padStart(2, '0')}`;
            }
        } else if (fechaAltMatch && quick.flights) {
            // Formato "del X al Y de mes" - mismo mes para ambas fechas
            const mes = fechaAltMatch[3].toLowerCase();
            const mesNum = meses[mes] || '10';

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const requestedMonth = parseInt(mesNum, 10);
            const año = requestedMonth < currentMonth ? (currentYear + 1).toString() : currentYear.toString();

            quick.flights.departureDate = `${año}-${mesNum}-${fechaAltMatch[1].padStart(2, '0')}`;
            quick.flights.returnDate = `${año}-${mesNum}-${fechaAltMatch[2].padStart(2, '0')}`;
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

        // 🛡️ AIRLINE DETECTOR: Usa el sistema centralizado de detección
        // Importamos el detector desde el archivo de aliases
        const { detectAirlineInText } = await import('@/features/chat/data/airlineAliases');

        const airlineDetection = detectAirlineInText(normalized);
        if (airlineDetection) {
            quick.flights = {
                ...(quick.flights || ({} as any)),
                preferredAirline: airlineDetection.name
            } as any;
            console.log(`🛡️ [QUICK PRE-PARSER] Detected airline: "${airlineDetection.name}" → ${airlineDetection.code} (confidence: ${airlineDetection.confidence})`);
        }

        // 🏨 HOTEL/CHAIN DETECTOR: Usa el sistema centralizado de detección
        // Similar a airlines, pero para cadenas hoteleras y nombres de hotel
        // FLOW: Pre-parser → AI Parser (hints) → Post-search filtering
        // UPDATED: Now supports MULTIPLE hotel chains (e.g., "cadena riu y iberostar")
        const { detectMultipleHotelChains, detectMultipleHotelNames } = await import('@/features/chat/data/hotelChainAliases');

        // Detect specific hotel names FIRST (more specific takes priority)
        // Examples: "riu republica", "iberostar dominicana", "barcelo bavaro"
        const detectedNames = detectMultipleHotelNames(message);
        if (detectedNames.length > 0) {
            (quick as any).hotels = {
                ...((quick as any).hotels || {}),
                hotelNames: detectedNames // Array of specific hotel names
            };
            console.log(`🏨 [QUICK PRE-PARSER] Detected specific hotel names:`, {
                hotelNames: detectedNames,
                count: detectedNames.length
            });
        }

        // Detect chains only if no specific names were detected
        // (specific names already imply the chain, no need to double-filter)
        if (detectedNames.length === 0) {
            const detectedChains = detectMultipleHotelChains(message); // Detects multiple chains
            if (detectedChains.length > 0) {
                (quick as any).hotels = {
                    ...((quick as any).hotels || {}),
                    hotelChains: detectedChains // Array of chain names
                };
                console.log(`🏨 [QUICK PRE-PARSER] Detected hotel chains:`, {
                    hotelChains: detectedChains,
                    count: detectedChains.length
                });
            }
        }
    } catch (e) {
        console.warn('Quick pre-parse failed:', e);
    }

    // 🕐 HORARIOS DE SALIDA/LLEGADA - Detección mediante regex
    try {
        // Importar mapper centralizado
        const { timePreferenceToRange } = await import('@/features/chat/utils/timeSlotMapper');

        // Normalizar mensaje para detección de tiempo (scope local)
        const normalizedForTime = message.replace(/\s+/g, ' ').trim();

        // Detectar "que salga de noche", "que vuelva de día", etc.
        // Note: Using [a-záéíóúñü]+ instead of \w+ to include Spanish characters (ñ, accents)
        const departureTimeMatch = normalizedForTime.match(/\b(?:que\s+)?(?:salga|sal[íi]|vuele)\s+(?:de\s+)?(?:la\s+)?([a-záéíóúñü]+)\b/i);
        if (departureTimeMatch) {
            const preference = departureTimeMatch[1]; // "noche", "tarde", "mañana", etc.
            const range = timePreferenceToRange(preference);

            if (range) {
                quick.flights = {
                    ...(quick.flights || ({} as any)),
                    departureTimePreference: preference
                } as any;
                console.log(`🕐 [QUICK PRE-PARSER] Detected departure time: "${preference}" → [${range[0]}, ${range[1]}]`);
            }
        }

        // Detectar "que llegue de día", "que vuelva de noche", etc.
        // Note: Using [a-záéíóúñü]+ instead of \w+ to include Spanish characters (ñ, accents)
        const arrivalTimeMatch = normalizedForTime.match(/\b(?:que\s+)?(?:llegue|llegu[eé]|vuelva)\s+(?:de\s+)?(?:la\s+)?([a-záéíóúñü]+)\b/i);
        if (arrivalTimeMatch) {
            const preference = arrivalTimeMatch[1];
            const range = timePreferenceToRange(preference);

            if (range) {
                quick.flights = {
                    ...(quick.flights || ({} as any)),
                    arrivalTimePreference: preference
                } as any;
                console.log(`🕐 [QUICK PRE-PARSER] Detected arrival time: "${preference}" → [${range[0]}, ${range[1]}]`);
            }
        }
    } catch (e) {
        console.warn('⚠️ [QUICK PRE-PARSER] Time detection failed:', e);
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

        // Merge quick pre-parse hints if AI missed them (e.g., max layover hours, stops, preferredAirline, time preferences)
        const mergedFlights = {
            ...(parsedResult.flights || {}),
            ...(quick.flights?.stops && !parsedResult.flights?.stops ? { stops: quick.flights.stops } : {}),
            ...(quick.flights?.maxLayoverHours && !parsedResult.flights?.maxLayoverHours ? { maxLayoverHours: quick.flights.maxLayoverHours } : {}),
            ...(quick.flights?.preferredAirline && !parsedResult.flights?.preferredAirline ? { preferredAirline: quick.flights.preferredAirline } : {}),
            // 🕐 Time preference merge - if pre-parser detected but AI missed
            ...((quick.flights as any)?.departureTimePreference && !parsedResult.flights?.departureTimePreference ? { departureTimePreference: (quick.flights as any).departureTimePreference } : {}),
            ...((quick.flights as any)?.arrivalTimePreference && !parsedResult.flights?.arrivalTimePreference ? { arrivalTimePreference: (quick.flights as any).arrivalTimePreference } : {})
        } as any;

        // 🏨 Merge hotel pre-parse hints if AI missed them (hotelChains, hotelName, hotelNames)
        // PRE-PARSER acts as fallback: if AI didn't detect chains/name but pre-parser did, use pre-parser values
        const quickHotels = (quick as any).hotels;
        const mergedHotels = {
            ...(parsedResult.hotels || {}),
            // If AI didn't detect hotelChains but pre-parser did → use pre-parser value (array)
            ...(quickHotels?.hotelChains && !parsedResult.hotels?.hotelChains ? { hotelChains: quickHotels.hotelChains } : {}),
            // If AI didn't detect hotelName but pre-parser did → use pre-parser value
            ...(quickHotels?.hotelName && !parsedResult.hotels?.hotelName ? { hotelName: quickHotels.hotelName } : {}),
            // If AI didn't detect hotelNames (plural) but pre-parser did → use pre-parser value (array of specific hotel names)
            ...(quickHotels?.hotelNames && !parsedResult.hotels?.hotelNames ? { hotelNames: quickHotels.hotelNames } : {})
        } as any;

        // Log merge details for debugging
        if (quickHotels?.hotelChains || quickHotels?.hotelName || quickHotels?.hotelNames) {
            console.log(`🏨 [MERGE] Pre-parser hotel hints:`, quickHotels);
            console.log(`🏨 [MERGE] AI detected hotels:`, parsedResult.hotels);
            console.log(`🏨 [MERGE] Final merged hotels:`, mergedHotels);
        }

        const mergedResult = normalizeParsedFlightRequest({
            ...parsedResult,
            flights: Object.keys(mergedFlights).length ? mergedFlights : parsedResult.flights,
            // Only include hotels if there's actual data (not empty object)
            hotels: Object.keys(mergedHotels).length ? mergedHotels : parsedResult.hotels,
            originalMessage: message
        });

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
    const normalizedParsed = normalizeParsedFlightRequest(parsed);

    switch (normalizedParsed.requestType) {
        case 'flights':
            return validateFlightRequiredFields(normalizedParsed.flights).isValid;

        case 'hotels':
            return !!(normalizedParsed.hotels?.city && normalizedParsed.hotels?.checkinDate && normalizedParsed.hotels?.checkoutDate &&
                normalizedParsed.hotels?.adults);

        case 'packages':
            return !!(normalizedParsed.packages?.destination && normalizedParsed.packages?.dateFrom && normalizedParsed.packages?.dateTo);

        case 'services':
            return !!(normalizedParsed.services?.city && normalizedParsed.services?.dateFrom);

        case 'combined':
            return validateParsedRequest({ ...normalizedParsed, requestType: 'flights' }) &&
                validateParsedRequest({ ...normalizedParsed, requestType: 'hotels' });

        case 'itinerary':
            return !!(normalizedParsed.itinerary?.destinations && normalizedParsed.itinerary.destinations.length > 0 &&
                normalizedParsed.itinerary?.days && normalizedParsed.itinerary.days > 0);

        default:
            return true;
    }
}

/**
 * Formats parsed data for EUROVIPS API calls
 */
export function formatForEurovips(parsed: ParsedTravelRequest) {
    const result: any = {};
    const normalizedParsed = normalizeParsedFlightRequest(parsed);

    if (normalizedParsed.flights) {
        result.flightParams = {
            originCode: normalizedParsed.flights.origin,
            destinationCode: normalizedParsed.flights.destination,
            departureDate: normalizedParsed.flights.departureDate,
            returnDate: normalizedParsed.flights.returnDate,
            adults: normalizedParsed.flights.adults,
            children: normalizedParsed.flights.children,
            infants: normalizedParsed.flights.infants
        };
    }

    if (normalizedParsed.hotels) {
        result.hotelParams = {
            cityCode: normalizedParsed.hotels.city,
            hotelName: normalizedParsed.hotels.hotelName,
            checkinDate: normalizedParsed.hotels.checkinDate,
            checkoutDate: normalizedParsed.hotels.checkoutDate,
            adults: normalizedParsed.hotels.adults,
            children: normalizedParsed.hotels.children,
            childrenAges: normalizedParsed.hotels.childrenAges || [],
            infants: normalizedParsed.hotels.infants
        };
    }

    if (normalizedParsed.packages) {
        result.packageParams = {
            cityCode: normalizedParsed.packages.destination,
            dateFrom: normalizedParsed.packages.dateFrom,
            dateTo: normalizedParsed.packages.dateTo,
            packageClass: normalizedParsed.packages.packageClass
        };
    }

    if (normalizedParsed.services) {
        result.serviceParams = {
            cityCode: normalizedParsed.services.city,
            dateFrom: normalizedParsed.services.dateFrom,
            dateTo: normalizedParsed.services.dateTo,
            serviceType: normalizedParsed.services.serviceType
        };
    }

    return result;
}

/**
 * ⭐ STARLING API FORMATTER - WITH STRICT IATA VALIDATION ⭐
 *
 * Formats parsed travel request for Starling TVC API.
 * GUARANTEES that only valid IATA codes are sent to Starling.
 *
 * CRITICAL REQUIREMENTS:
 * - DepartureAirportCity: Must be valid 3-letter IATA code
 * - ArrivalAirportCity: Must be valid 3-letter IATA code
 * - FlightDate: Must be in YYYY-MM-DD format
 *
 * @param parsed - Parsed travel request from AI
 * @returns Formatted request for Starling API with validated IATA codes
 * @throws Error if city codes cannot be resolved
 */
export async function formatForStarling(parsed: ParsedTravelRequest) {
    const normalizedParsed = normalizeParsedFlightRequest(parsed);

    if (!normalizedParsed.flights) {
        console.warn('⚠️ [STARLING FORMAT] No flight data in parsed request');
        return null;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🚀 [STARLING API FORMATTER] Starting...');
    console.log('='.repeat(60));

    // ============================================
    // STEP 1: Import unified code resolver
    // ============================================
    const { getUnifiedAirportCode } = await import('@/services/cityCodeService');

    // ============================================
    // STEP 2: Convert city names to IATA codes
    // ============================================
    console.log('\n📍 [CITY CONVERSION] Converting city names to IATA codes...');
    console.log(`   Trip type:   "${normalizedParsed.flights.tripType || 'one_way'}"`);

    // ============================================
    // STEP 3: Build passenger array
    // ============================================
    const passengers = [];
    if ((normalizedParsed.flights.adults || 1) > 0) {
        passengers.push({
            Count: normalizedParsed.flights.adults || 1,
            Type: 'ADT'
        });
    }
    if ((normalizedParsed.flights.children || 0) > 0) {
        passengers.push({
            Count: normalizedParsed.flights.children,
            Type: 'CHD'
        });
    }
    if ((normalizedParsed.flights.infants || 0) > 0) {
        passengers.push({
            Count: Math.min(normalizedParsed.flights.infants || 0, normalizedParsed.flights.adults || 1),
            Type: 'INF'
        });
    }

    console.log(`\n👥 [PASSENGERS] ${passengers.length} passenger type(s):`, passengers);

    // ============================================
    // STEP 4: Build legs array with IATA codes
    // ============================================
    const legs = [];
    for (const segment of getNormalizedFlightSegments(normalizedParsed.flights)) {
        try {
            const originCode = await getUnifiedAirportCode(segment.origin, {
                destination: segment.destination,
                searchType: 'flight'
            });
            const destinationCode = await getUnifiedAirportCode(segment.destination, {
                destination: segment.origin,
                searchType: 'flight'
            });

            console.log(`   "${segment.origin}" → ${originCode}`);
            console.log(`   "${segment.destination}" → ${destinationCode}`);

            legs.push({
                DepartureAirportCity: originCode,
                ArrivalAirportCity: destinationCode,
                FlightDate: segment.departureDate
            });
        } catch (error) {
            console.error('\n❌ [CITY CONVERSION FAILED]', error);
            throw new Error(
                `No se pudieron convertir las ciudades a códigos IATA: ${(error as Error).message}`
            );
        }
    }

    console.log(`\n✈️  [LEGS] ${legs.length} leg(s) created:`);
    legs.forEach((leg, index) => {
        console.log(`   Leg ${index + 1}: ${leg.DepartureAirportCity} → ${leg.ArrivalAirportCity} (${leg.FlightDate})`);
    });

    // ============================================
    // STEP 5: CRITICAL VALIDATION BEFORE SENDING
    // ============================================
    const starlingRequest = {
        Passengers: passengers,
        Legs: legs,
        Airlines: null
    };

    console.log('\n🔍 [VALIDATION] Validating request before sending to Starling...');
    validateStarlingRequest(starlingRequest);
    console.log('✅ [VALIDATION PASSED] All checks OK!');

    // ============================================
    // STEP 6: Final formatted request
    // ============================================
    console.log('\n📦 [FINAL REQUEST] Ready to send to Starling API:');
    console.log(JSON.stringify(starlingRequest, null, 2));
    console.log('='.repeat(60) + '\n');

    return starlingRequest;
}

/**
 * ⛔ STRICT VALIDATION FOR STARLING API REQUESTS ⛔
 *
 * Validates that the request meets Starling API requirements.
 * Throws error if validation fails (prevents sending invalid requests).
 *
 * @param request - Formatted Starling request
 * @throws Error if validation fails
 */
function validateStarlingRequest(request: any): void {
    // Validate structure
    if (!request.Legs || !Array.isArray(request.Legs)) {
        throw new Error('❌ Invalid request: Legs array is required');
    }

    if (!request.Passengers || !Array.isArray(request.Passengers)) {
        throw new Error('❌ Invalid request: Passengers array is required');
    }

    // Validate each leg
    request.Legs.forEach((leg: any, index: number) => {
        const legNum = index + 1;

        // Validate DepartureAirportCity
        if (!leg.DepartureAirportCity) {
            throw new Error(`❌ Leg ${legNum}: DepartureAirportCity is missing`);
        }
        if (typeof leg.DepartureAirportCity !== 'string') {
            throw new Error(`❌ Leg ${legNum}: DepartureAirportCity must be a string`);
        }
        if (leg.DepartureAirportCity.length !== 3) {
            throw new Error(
                `❌ Leg ${legNum}: DepartureAirportCity "${leg.DepartureAirportCity}" ` +
                `must be exactly 3 characters (got ${leg.DepartureAirportCity.length})`
            );
        }
        if (!/^[A-Z0-9]{3}$/.test(leg.DepartureAirportCity)) {
            throw new Error(
                `❌ Leg ${legNum}: DepartureAirportCity "${leg.DepartureAirportCity}" ` +
                `must contain only uppercase letters/numbers`
            );
        }

        // Validate ArrivalAirportCity
        if (!leg.ArrivalAirportCity) {
            throw new Error(`❌ Leg ${legNum}: ArrivalAirportCity is missing`);
        }
        if (typeof leg.ArrivalAirportCity !== 'string') {
            throw new Error(`❌ Leg ${legNum}: ArrivalAirportCity must be a string`);
        }
        if (leg.ArrivalAirportCity.length !== 3) {
            throw new Error(
                `❌ Leg ${legNum}: ArrivalAirportCity "${leg.ArrivalAirportCity}" ` +
                `must be exactly 3 characters (got ${leg.ArrivalAirportCity.length})`
            );
        }
        if (!/^[A-Z0-9]{3}$/.test(leg.ArrivalAirportCity)) {
            throw new Error(
                `❌ Leg ${legNum}: ArrivalAirportCity "${leg.ArrivalAirportCity}" ` +
                `must contain only uppercase letters/numbers`
            );
        }

        // Validate FlightDate
        if (!leg.FlightDate) {
            throw new Error(`❌ Leg ${legNum}: FlightDate is missing`);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(leg.FlightDate)) {
            throw new Error(
                `❌ Leg ${legNum}: FlightDate "${leg.FlightDate}" ` +
                `must be in YYYY-MM-DD format`
            );
        }

        console.log(`   ✓ Leg ${legNum}: ${leg.DepartureAirportCity} → ${leg.ArrivalAirportCity} (${leg.FlightDate})`);
    });

    // Validate passengers
    if (request.Passengers.length === 0) {
        throw new Error('❌ Invalid request: At least one passenger type is required');
    }

    request.Passengers.forEach((passenger: any, index: number) => {
        if (!passenger.Type || !['ADT', 'CHD', 'INF'].includes(passenger.Type)) {
            throw new Error(
                `❌ Passenger ${index + 1}: Invalid type "${passenger.Type}" ` +
                `(must be ADT, CHD, or INF)`
            );
        }
        if (!passenger.Count || passenger.Count < 1) {
            throw new Error(
                `❌ Passenger ${index + 1}: Count must be at least 1 (got ${passenger.Count})`
            );
        }
        console.log(`   ✓ Passenger: ${passenger.Count} ${passenger.Type}`);
    });
}
