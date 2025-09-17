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

    return {
        searchParams: {
            origin: parsed.flights.origin,
            destination: parsed.flights.destination,
            departureDate: parsed.flights.departureDate,
            returnDate: parsed.flights.returnDate,
            adults: parsed.flights.adults || 1,
            children: parsed.flights.children || 0
        }
    };
}
