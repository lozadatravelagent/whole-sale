import { supabase } from '@/integrations/supabase/client';

export interface ParsedTravelRequest {
    requestType: 'flights' | 'hotels' | 'packages' | 'services' | 'combined' | 'general';
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

// Función para generar mensaje solicitando información faltante
export function generateMissingInfoMessage(missingFieldsSpanish: string[], requestType: string): string {
    const baseMessage = requestType === 'flights'
        ? 'Para buscar los mejores vuelos, necesito que me proporciones la siguiente información:'
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
        }
    });

    if (examples.length > 0) {
        return '**Ejemplos:**\n' + examples.join('\n');
    }

    return '';
}

/**
 * Uses OpenAI to intelligently parse travel messages and extract structured parameters
 */
export async function parseMessageWithAI(message: string): Promise<ParsedTravelRequest> {
    console.log('🤖 Starting AI message parsing for:', message);

    try {
        const response = await supabase.functions.invoke('ai-message-parser', {
            body: {
                message,
                language: 'es', // Spanish
                currentDate: new Date().toISOString().split('T')[0]
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

    // Basic date extraction
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 7);

    const defaultDateFrom = today.toISOString().split('T')[0];
    const defaultDateTo = futureDate.toISOString().split('T')[0];

    // Basic people extraction
    const peopleMatch = message.match(/(\d+)\s+(?:personas?|adultos?)/i);
    const adults = peopleMatch ? parseInt(peopleMatch[1]) : 1;

    const result: ParsedTravelRequest = {
        requestType,
        confidence: 0.3, // Low confidence for fallback
        originalMessage: message
    };

    // Add type-specific data based on detected type
    switch (requestType) {
        case 'flights':
            result.flights = {
                origin: 'Buenos Aires',
                destination: 'Madrid',
                departureDate: defaultDateFrom,
                returnDate: defaultDateTo,
                adults,
                children: 0
            };
            break;

        case 'hotels':
            result.hotels = {
                city: 'Madrid',
                checkinDate: defaultDateFrom,
                checkoutDate: defaultDateTo,
                adults,
                children: 0
            };
            break;

        case 'packages':
            result.packages = {
                destination: 'España',
                dateFrom: defaultDateFrom,
                dateTo: defaultDateTo,
                packageClass: 'AEROTERRESTRE',
                adults,
                children: 0
            };
            break;

        case 'services':
            result.services = {
                city: 'Madrid',
                dateFrom: defaultDateFrom,
                serviceType: '1'
            };
            break;

        case 'combined':
            result.flights = {
                origin: 'Buenos Aires',
                destination: 'Madrid',
                departureDate: defaultDateFrom,
                returnDate: defaultDateTo,
                adults,
                children: 0
            };
            result.hotels = {
                city: 'Madrid',
                checkinDate: defaultDateFrom,
                checkoutDate: defaultDateTo,
                adults,
                children: 0
            };
            break;
    }

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
            return !!(parsed.hotels?.city && parsed.hotels?.checkinDate && parsed.hotels?.checkoutDate);

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
